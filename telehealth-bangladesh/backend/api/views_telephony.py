from api.views_common import (
    User, write_audit_log, generate_anonymous_session_id,
    random, uuid, hashlib, json, secrets, datetime, Decimal, timezone,
    status, permissions, generics, throttling, APIView, Response,
    PermissionDenied, ValidationError, authenticate, Q, RefreshToken,
    TokenObtainPairView, HttpResponse, HttpResponseForbidden, redirect,
    DoctorProfile, PatientProfile, Appointment, Consultation, Prescription,
    HealthRecord, Consent, AuditLog, Medicine, MedicineOrder, PatientImageProfile,
    OTPCode, LoginAttempt, PaymentTransaction, BlockchainRecord, TelephonyCall,
    AIConversation, AIMessage, ConsentRequest, PatientConsent, ConsentPermission,
    ConsentHistory, RecordAccessLog, EmergencyAccessSetting, EmergencyAccessLog,
    UserRegistrationSerializer, UserSerializer, DoctorProfileSerializer,
    AppointmentSerializer, ConsultationSerializer, PrescriptionSerializer,
    HealthRecordSerializer, ConsentSerializer, AuditLogSerializer,
    MedicineSerializer, MedicineOrderSerializer, ForgotPasswordSerializer,
    ResetPasswordSerializer, PatientImageProfileSerializer,
    PaymentTransactionSerializer, BlockchainRecordSerializer,
    TelephonyCallSerializer, AIHealthAssistantRequestSerializer,
    AIConversationSerializer, AIMessageSerializer, CustomTokenObtainPairSerializer,
    IsAdminUserRole, IsDoctorRole, IsPatientRole,
    twilio_service, gov_service, payment_service, storage_service,
    blockchain_service, ai_health_assistant_service
)

class TelephonyCallView(APIView):
    """
    POST /api/telephony/call/
    Initiates a real Twilio PSTN voice call (or safe Sandbox/Mock simulation).
    Validates caller authorization, enforces authorized participant phone lookup,
    sanitizes phone number to E.164, tracks database state, and logs audit events.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        to_phone = request.data.get('phone')
        consultation_id = request.data.get('consultation_id')

        consultation_obj = None
        target_phone = None

        if consultation_id:
            try:
                consultation_obj = Consultation.objects.select_related(
                    'appointment__doctor', 'appointment__patient'
                ).get(id=consultation_id)
            except Consultation.DoesNotExist:
                return Response(
                    {"success": False, "error": f"Consultation #{consultation_id} not found."},
                    status=status.HTTP_404_NOT_FOUND
                )

            # Verify consultation state
            if consultation_obj.status in ['cancelled', 'completed']:
                return Response(
                    {"success": False, "error": f"Cannot initiate call for a {consultation_obj.status} consultation."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Enforce authorization: only participating doctor, patient, or admin may initiate
            appt = consultation_obj.appointment
            is_doctor = (user == appt.doctor)
            is_patient = (user == appt.patient)
            is_admin = (user.role == 'admin' or user.is_staff)

            if not (is_doctor or is_patient or is_admin):
                raise PermissionDenied("You are not authorized to initiate calls for this consultation.")

            # Resolve authorized counterparty's phone number authoritatively
            if is_doctor and appt.patient and appt.patient.phone:
                target_phone = appt.patient.phone
            elif is_patient and appt.doctor and appt.doctor.phone:
                target_phone = appt.doctor.phone

            # If client passed to_phone, verify it against authorized target_phone (unless admin)
            if to_phone and target_phone and not is_admin:
                is_v, clean_req, _ = twilio_service.validate_e164(to_phone)
                is_tv, clean_tgt, _ = twilio_service.validate_e164(target_phone)
                if is_v and is_tv and clean_req != clean_tgt:
                    # Client attempted to dial an arbitrary number; enforce authorized counterparty phone
                    to_phone = target_phone
            elif not to_phone:
                to_phone = target_phone
        else:
            # Standalone test calls allowed only for admins or user verifying their own phone
            if user.role != 'admin' and not user.is_staff:
                if not to_phone or twilio_service.validate_e164(to_phone)[1] != twilio_service.validate_e164(user.phone or "")[1]:
                    return Response(
                        {"success": False, "error": "consultation_id is required for clinical telephony calls."},
                        status=status.HTTP_400_BAD_REQUEST
                    )

        if not to_phone:
            to_phone = user.phone

        if not to_phone:
            return Response(
                {"success": False, "error": "Destination phone number is required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate & sanitize destination phone to E.164 standard
        is_valid, sanitized_phone, error_msg = twilio_service.validate_e164(to_phone)
        if not is_valid:
            write_audit_log(
                user, 
                "TELEPHONY_CALL_FAILED", 
                f"Call initiation rejected: Invalid phone number {to_phone} ({error_msg})", 
                request
            )
            return Response(
                {"success": False, "error": error_msg, "code": "INVALID_PHONE_NUMBER"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Initiate call via Twilio service (Live or Mock fallback)
        result = twilio_service.initiate_call(
            to_phone=sanitized_phone,
            consultation_id=consultation_id
        )

        if result.get('success'):
            call_sid = result.get('call_sid')
            mode = result.get('mode', 'mock')
            call_status = result.get('status', 'queued')

            # Create TelephonyCall database record
            telephony_record = TelephonyCall.objects.create(
                caller=user,
                recipient_phone=result.get('to', sanitized_phone),
                from_phone=result.get('from'),
                twilio_call_sid=call_sid,
                status=call_status,
                mode=mode,
                consultation=consultation_obj,
                started_at=timezone.now() if call_status == 'in-progress' else None
            )

            write_audit_log(
                user,
                "TELEPHONY_CALL_INITIATED",
                f"Voice call {call_sid} ({mode.upper()}) initiated to {result.get('to')} for Consultation #{consultation_id or 'Direct'}",
                request
            )

            return Response({
                "success": True,
                "call_id": telephony_record.id,
                "call_sid": call_sid,
                "status": call_status,
                "mode": mode,
                "to": result.get('to'),
                "from": result.get('from'),
                "message": result.get('message', "Telemedicine call initiated successfully."),
                "note": result.get('note')
            }, status=status.HTTP_201_CREATED)
        else:
            write_audit_log(
                user,
                "TELEPHONY_CALL_FAILED",
                f"Voice call initiation failed for {sanitized_phone}: {result.get('error')}",
                request
            )
            http_status = status.HTTP_503_SERVICE_UNAVAILABLE if result.get('code') == 'TWILIO_CREDENTIALS_MISSING' else status.HTTP_400_BAD_REQUEST
            return Response(result, status=http_status)

class TelephonyCallTerminateView(APIView):
    """
    POST /api/telephony/call/<str:call_sid>/terminate/
    Terminates an active voice call via Twilio REST API or Sandbox simulation.
    Enforces authorization: caller, consultation participants, or admin.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, call_sid):
        user = request.user
        call_record = TelephonyCall.objects.filter(twilio_call_sid=call_sid).first()

        # Authorization check: caller, consultation participants, or admin
        if call_record:
            is_caller = (call_record.caller == user)
            is_participant = False
            if call_record.consultation and call_record.consultation.appointment:
                appt = call_record.consultation.appointment
                is_participant = (user == appt.doctor or user == appt.patient)
            is_admin = (user.role == 'admin' or user.is_staff)

            if not (is_caller or is_participant or is_admin):
                raise PermissionDenied("You are not authorized to terminate this call.")
        else:
            if user.role != 'admin' and not user.is_staff:
                raise PermissionDenied("Call record not found or you are not authorized to terminate.")

        result = twilio_service.terminate_call(call_sid)

        if call_record:
            call_record.status = 'completed'
            call_record.ended_at = timezone.now()
            if call_record.started_at:
                call_record.duration = max(0, int((call_record.ended_at - call_record.started_at).total_seconds()))
            call_record.save()

        write_audit_log(
            user,
            "TELEPHONY_CALL_TERMINATED",
            f"Telephony call {call_sid} terminated by user {user.username}",
            request
        )

        return Response(result, status=status.HTTP_200_OK if result.get('success') else status.HTTP_400_BAD_REQUEST)

class TelephonyCallStatusView(APIView):
    """
    GET /api/telephony/call/<str:call_sid>/status/
    Retrieves current status of a voice call, updates database, and logs state transitions.
    Enforces authorization: caller, consultation participants, or admin.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, call_sid):
        user = request.user
        call_record = TelephonyCall.objects.filter(twilio_call_sid=call_sid).first()
        if call_record:
            is_caller = (call_record.caller == user)
            is_participant = False
            if call_record.consultation and call_record.consultation.appointment:
                appt = call_record.consultation.appointment
                is_participant = (user == appt.doctor or user == appt.patient)
            is_admin = (user.role == 'admin' or user.is_staff)

            if not (is_caller or is_participant or is_admin):
                raise PermissionDenied("You are not authorized to inspect this call.")

        result = twilio_service.get_call_status(call_sid)
        if not result.get('success'):
            return Response(result, status=status.HTTP_404_NOT_FOUND)

        new_status = result.get('status', 'queued')
        duration = result.get('duration', 0)

        if call_record:
            old_status = call_record.status
            if old_status != new_status:
                call_record.status = new_status
                if new_status == 'in-progress' and not call_record.started_at:
                    call_record.started_at = timezone.now()
                    write_audit_log(
                        call_record.caller,
                        "TELEPHONY_CALL_CONNECTED",
                        f"Telephony call {call_sid} connected (in-progress)",
                        request
                    )
                elif new_status in ['completed', 'failed', 'busy', 'no-answer', 'canceled']:
                    if not call_record.ended_at:
                        call_record.ended_at = timezone.now()
                    if new_status == 'completed':
                        write_audit_log(
                            call_record.caller,
                            "TELEPHONY_CALL_COMPLETED",
                            f"Telephony call {call_sid} completed successfully. Duration: {duration}s",
                            request
                        )
                    elif new_status in ['failed', 'busy', 'no-answer']:
                        write_audit_log(
                            call_record.caller,
                            "TELEPHONY_CALL_FAILED",
                            f"Telephony call {call_sid} ended with state: {new_status}",
                            request
                        )
                call_record.duration = duration
                call_record.save()

            result["call_id"] = call_record.id
            result["recipient_phone"] = call_record.recipient_phone
            result["mode"] = call_record.mode

        return Response(result, status=status.HTTP_200_OK)

class TelephonyCallListView(APIView):
    """
    GET /api/telephony/calls/
    Returns telephony call records for a consultation or the authenticated user.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        consultation_id = request.query_params.get('consultation_id')

        if consultation_id:
            calls = TelephonyCall.objects.filter(consultation_id=consultation_id).order_by('-created_at')
        elif user.role == 'admin':
            calls = TelephonyCall.objects.all().order_by('-created_at')[:50]
        else:
            calls = TelephonyCall.objects.filter(
                Q(caller=user) | 
                Q(consultation__appointment__doctor=user) | 
                Q(consultation__appointment__patient=user)
            ).distinct().order_by('-created_at')[:30]

        return Response(TelephonyCallSerializer(calls, many=True).data)

class TelephonyTwiMLView(APIView):
    """
    GET/POST /api/telephony/twiml/
    GET/POST /api/telephony/twiml/<int:consultation_id>/
    Twilio Voice webhook returning valid TwiML instructions for consultation calls.
    Validates Twilio request signature in live mode.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request, consultation_id=None):
        if not self._validate_twilio_request(request):
            return HttpResponseForbidden("Invalid Twilio request signature.")
        return self._generate_twiml(consultation_id)

    def post(self, request, consultation_id=None):
        if not self._validate_twilio_request(request):
            return HttpResponseForbidden("Invalid Twilio request signature.")
        return self._generate_twiml(consultation_id)

    def _validate_twilio_request(self, request):
        if not twilio_service.is_live:
            return True
        signature = request.headers.get('X-Twilio-Signature') or request.META.get('HTTP_X_TWILIO_SIGNATURE', '')
        url = request.build_absolute_uri()
        post_data = request.POST.dict() if request.method == 'POST' else {}
        return twilio_service.validate_webhook_signature(url, post_data, signature)

    def _generate_twiml(self, consultation_id):
        consultation_text = f" for consultation #{consultation_id}" if consultation_id else ""
        
        # Check if consultation exists to bridge counterparty
        bridge_number = None
        if consultation_id:
            try:
                consultation = Consultation.objects.select_related(
                    'appointment__doctor', 'appointment__patient'
                ).get(id=consultation_id)
                # If doctor's phone is available, can bridge doctor
                if consultation.appointment and consultation.appointment.doctor and consultation.appointment.doctor.phone:
                    bridge_number = consultation.appointment.doctor.phone
            except Consultation.DoesNotExist:
                pass

        dial_block = ""
        if bridge_number:
            is_v, clean_bridge, _ = twilio_service.validate_e164(bridge_number)
            if is_v:
                dial_block = f'    <Dial callerId="{twilio_service.from_number}">\n        <Number>{clean_bridge}</Number>\n    </Dial>\n'

        xml_content = (
            '<?xml version="1.0" encoding="UTF-8"?>\n'
            '<Response>\n'
            f'    <Say voice="Polly.Aditi">You are being connected to your HealNSight telemedicine consultation{consultation_text}. Please hold while your doctor is bridged.</Say>\n'
            '    <Pause length="1"/>\n'
            f'{dial_block}'
            '</Response>'
        )
        return HttpResponse(xml_content, content_type='application/xml')

class ConsultationDetailView(APIView):
    """
    GET /api/consultations/<int:pk>/
    Returns consultation metadata and participant details for Clinical Room.
    PATCH/PUT /api/consultations/<int:pk>/
    Updates consultation status/started_at/ended_at/duration.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        consultation = None
        if str(pk).isdigit():
            pk_int = int(pk)
            consultation = Consultation.objects.select_related(
                'appointment__doctor__doctor_profile', 
                'appointment__patient__patient_profile'
            ).filter(pk=pk_int).first()
            if not consultation:
                consultation = Consultation.objects.select_related(
                    'appointment__doctor__doctor_profile', 
                    'appointment__patient__patient_profile'
                ).filter(appointment_id=pk_int).first()
        if not consultation:
            return Response({"error": "Consultation not found"}, status=status.HTTP_404_NOT_FOUND)

        appt = consultation.appointment
        user = request.user
        if user != appt.doctor and user != appt.patient and user.role != 'admin':
            raise PermissionDenied("You are not a participant in this consultation.")

        now = timezone.now()
        # Enforce server-side 45-minute session timeout
        if consultation.status == 'active' and consultation.is_expired:
            consultation.status = 'completed'
            consultation.ended_at = now
            if consultation.effective_start_time:
                consultation.duration = min(2700, max(1, int((now - consultation.effective_start_time).total_seconds())))
            consultation.save(update_fields=['status', 'ended_at', 'duration'])
            if appt.status != 'completed':
                appt.status = 'completed'
                appt.save(update_fields=['status'])
            write_audit_log(user, "AUTO_TIMEOUT_CONSULTATION", f"Consultation #{consultation.id} automatically ended (45-minute timeout)", request)

        anon_token = consultation.anonymous_session_id or (appt.anonymous_session_id if appt else None) or f"A{consultation.id:04d}"

        # If user is doctor and consultation is anonymous, mask patient details completely (zero IDOR/PII leak)
        is_doctor = (user == appt.doctor)
        if consultation.is_anonymous and is_doctor:
            patient_info = {
                "id": None,
                "name": f"Anonymous Patient #{anon_token}",
                "phone": "",
                "blood_group": "",
                "is_anonymous": True,
                "anonymous_session_id": anon_token
            }
        else:
            patient_info = {
                "id": appt.patient.id,
                "username": appt.patient.username,
                "email": appt.patient.email or f"{appt.patient.username}@healnsight.com.bd",
                "name": f"{appt.patient.first_name} {appt.patient.last_name}".strip() or appt.patient.username,
                "phone": appt.patient.phone or "",
                "blood_group": getattr(getattr(appt.patient, 'patient_profile', None), 'blood_group', ''),
                "is_anonymous": consultation.is_anonymous,
                "anonymous_session_id": anon_token if consultation.is_anonymous else None
            }

        data = {
            "id": consultation.id,
            "type": consultation.type,
            "status": consultation.status,
            "is_anonymous": consultation.is_anonymous,
            "anonymous_session_id": anon_token if consultation.is_anonymous else None,
            "anonymous_identifier": f"Anonymous Patient #{anon_token}" if consultation.is_anonymous else None,
            "audio_only": consultation.audio_only or (consultation.type == 'audio'),
            "started_at": consultation.started_at,
            "ended_at": consultation.ended_at,
            "duration": consultation.duration,
            "expires_at": consultation.expires_at.isoformat() if consultation.expires_at else None,
            "is_expired": consultation.is_expired,
            "remaining_seconds": consultation.remaining_seconds,
            "max_duration_seconds": 2700,
            "appointment_id": appt.id,
            "appointment_date": str(appt.date),
            "appointment_time": appt.time,
            "doctor": {
                "id": appt.doctor.id,
                "name": f"Dr. {appt.doctor.first_name} {appt.doctor.last_name}".strip() or appt.doctor.username,
                "phone": appt.doctor.phone or "",
                "specialty": getattr(getattr(appt.doctor, 'doctor_profile', None), 'specialty', 'General Doctor')
            },
            "patient": patient_info
        }
        return Response(data)

    def put(self, request, pk):
        return self.patch(request, pk)

    def patch(self, request, pk):
        try:
            consultation = Consultation.objects.select_related('appointment__doctor', 'appointment__patient').get(pk=pk)
        except Consultation.DoesNotExist:
            return Response({"error": "Consultation not found"}, status=status.HTTP_404_NOT_FOUND)

        user = request.user
        appt = consultation.appointment
        if user != appt.doctor and user != appt.patient and user.role != 'admin':
            raise PermissionDenied("You are not a participant in this consultation.")

        action = request.data.get('action')
        requested_status = request.data.get('status')
        now = timezone.now()

        # Block any attempt to reactivate or rejoin a completed/expired consultation
        if (action == 'start' or requested_status == 'active' or action == 'rejoin') and (
            consultation.is_expired or consultation.status in ['ended', 'completed'] or appt.status == 'completed'
        ):
            return Response(
                {"error": "This consultation is completed or its 45-minute limit expired. Rejoining is strictly prohibited.", "is_expired": True, "status": "completed"},
                status=status.HTTP_403_FORBIDDEN
            )

        if action == 'start' or requested_status == 'active':
            if not consultation.started_at:
                consultation.started_at = now
            if not consultation.start_time:
                consultation.start_time = now
            consultation.status = 'active'
            consultation.save()
            write_audit_log(user, "START_CONSULTATION", f"Consultation #{consultation.id} started", request)
        elif action in ['end', 'complete']:
            consultation.ended_at = now
            consultation.status = 'completed'
            if consultation.started_at:
                diff = (now - consultation.started_at).total_seconds()
                consultation.duration = max(1, int(diff))
            elif request.data.get('duration'):
                try:
                    consultation.duration = int(request.data.get('duration'))
                except (ValueError, TypeError):
                    pass
            consultation.save()
            if appt.status != 'completed':
                appt.status = 'completed'
                appt.save()
            write_audit_log(user, "END_CONSULTATION", f"Consultation #{consultation.id} ended (Duration: {consultation.duration}s)", request)

            # Broadcast real-time consultation completion event
            try:
                from asgiref.sync import async_to_sync
                from channels.layers import get_channel_layer
                cl = get_channel_layer()
                if cl:
                    async_to_sync(cl.group_send)(
                        f'consultation_{consultation.id}',
                        {
                            'type': 'consultation_ended_handler',
                            'sender': user.username,
                            'consultation_id': consultation.id,
                            'message': 'Consultation completed and closed.'
                        }
                    )
            except Exception as e:
                logger.warning(f"WebSocket consultation ended broadcast notice: {e}")

        return self.get(request, pk)

class ConsultationChatView(APIView):
    """
    GET /api/consultations/<int:pk>/chat-history/
    Returns full encrypted chat history for the consultation.
    POST /api/consultations/<int:pk>/chat-message/
    Saves an encrypted message and returns stored status.
    POST /api/consultations/<int:pk>/chat-status/
    Updates message state to delivered or read.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        try:
            consultation = Consultation.objects.select_related('appointment__doctor', 'appointment__patient').get(pk=pk)
        except Consultation.DoesNotExist:
            return Response({"error": "Consultation not found"}, status=status.HTTP_404_NOT_FOUND)

        user = request.user
        appt = consultation.appointment
        if user != appt.doctor and user != appt.patient and user.role != 'admin':
            raise PermissionDenied("You are not a participant in this consultation.")

        from api.models import ConsultationChatMessage
        msgs = ConsultationChatMessage.objects.filter(consultation=consultation).order_by('created_at')
        data = [
            {
                'message_id': m.message_id,
                'sender': m.sender_username,
                'ciphertext': m.ciphertext,
                'iv': m.iv,
                'aad': m.aad,
                'timestamp': m.timestamp,
                'status': m.status,
                'created_at': m.created_at.isoformat()
            }
            for m in msgs
        ]
        return Response(data)

    def post(self, request, pk):
        try:
            consultation = Consultation.objects.select_related('appointment__doctor', 'appointment__patient').get(pk=pk)
        except Consultation.DoesNotExist:
            return Response({"error": "Consultation not found"}, status=status.HTTP_404_NOT_FOUND)

        user = request.user
        appt = consultation.appointment
        if user != appt.doctor and user != appt.patient and user.role != 'admin':
            raise PermissionDenied("You are not a participant in this consultation.")

        from api.models import ConsultationChatMessage
        action = request.data.get('action')

        if action == 'update_status':
            message_id = request.data.get('message_id')
            new_status = request.data.get('status', 'read')
            ConsultationChatMessage.objects.filter(consultation=consultation, message_id=message_id).update(status=new_status)
            return Response({"success": True, "message_id": message_id, "status": new_status})

        message_id = request.data.get('message_id') or f"msg_{timezone.now().timestamp()}_{uuid.uuid4().hex[:6]}"
        ciphertext = request.data.get('ciphertext')
        iv = request.data.get('iv')
        aad = request.data.get('aad', {})
        timestamp = request.data.get('timestamp') or ''
        sender = user.username

        msg, created = ConsultationChatMessage.objects.get_or_create(
            message_id=message_id,
            defaults={
                'consultation': consultation,
                'sender_username': sender,
                'ciphertext': ciphertext,
                'iv': iv,
                'aad': aad if isinstance(aad, dict) else {},
                'timestamp': timestamp,
                'status': 'sent'
            }
        )

        return Response({
            'message_id': msg.message_id,
            'sender': msg.sender_username,
            'ciphertext': msg.ciphertext,
            'iv': msg.iv,
            'aad': msg.aad,
            'timestamp': msg.timestamp,
            'status': msg.status,
            'created_at': msg.created_at.isoformat()
        }, status=status.HTTP_201_CREATED)


