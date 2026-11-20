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

class AppointmentViewSet(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        rel_fields = ('doctor', 'doctor__doctor_profile', 'patient', 'patient__patient_profile', 'consultation')
        if user.role == 'doctor':
            appts = Appointment.objects.filter(doctor=user).select_related(*rel_fields).order_by('-date')
        elif user.role == 'patient':
            appts = Appointment.objects.filter(patient=user).select_related(*rel_fields).order_by('-date')
        else:
            appts = Appointment.objects.all().select_related(*rel_fields).order_by('-date')
        
        data = AppointmentSerializer(appts, many=True, context={'request': request}).data

        # Anonymous Consultation identity masking for doctors
        if user.role == 'doctor':
            for item in data:
                if item.get('is_anonymous'):
                    anon_token = item.get('anonymous_session_id') or f"A{item.get('id', 0):04d}"
                    item['patient'] = None  # Prevent IDOR leakage of patient ID
                    item['patient_details'] = {
                        "id": None,
                        "username": f"Anonymous Patient #{anon_token}",
                        "first_name": "Anonymous",
                        "last_name": f"Patient #{anon_token}",
                        "role": "patient",
                        "phone": "HIDDEN_ANONYMOUS",
                        "email": "anonymous@healnsight.com.bd"
                    }

        return Response(data)

    def post(self, request):
        user = request.user
        if user.role != 'patient':
            raise PermissionDenied("Only patients can book consultations.")
        
        data = request.data.copy()
        data['patient'] = user.id

        # Robust doctor ID resolution: client may pass User.id or DoctorProfile.id
        doc_val = data.get('doctor')
        if doc_val:
            try:
                doc_int = int(doc_val)
                if not User.objects.filter(id=doc_int, role='doctor').exists():
                    doc_prof = DoctorProfile.objects.filter(id=doc_int).select_related('user').first()
                    if doc_prof:
                        data['doctor'] = doc_prof.user.id
            except (ValueError, TypeError):
                pass

        # Verify doctor account is active and approved
        target_doc = User.objects.filter(id=data.get('doctor'), role='doctor').first()
        if not target_doc or not target_doc.is_active:
            return Response({"error": "Selected doctor is currently suspended or inactive and cannot accept appointments."}, status=status.HTTP_400_BAD_REQUEST)

        # Robust date parsing: accept standard YYYY-MM-DD or localized string formats (e.g. 17-Sep-2026, 17/09/2026)
        raw_date = data.get('date')
        if raw_date and isinstance(raw_date, str):
            clean_date = raw_date.strip()
            for fmt in ('%Y-%m-%d', '%d-%b-%Y', '%d-%B-%Y', '%d/%m/%Y', '%d-%m-%Y', '%m/%d/%Y'):
                try:
                    parsed_dt = datetime.strptime(clean_date, fmt).date()
                    data['date'] = parsed_dt.strftime('%Y-%m-%d')
                    break
                except ValueError:
                    continue

        serializer = AppointmentSerializer(data=data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        appt = serializer.save()

        consult_type = request.data.get('consultation_type', 'chat')
        is_anon = bool(data.get('is_anonymous', False))
        if consult_type == 'audio':
            # Audio consultations are anonymous by requirement
            is_anon = True

        anon_id = None
        if is_anon:
            anon_id = generate_anonymous_session_id()
            appt.is_anonymous = True
            appt.anonymous_session_id = anon_id
        
        appt.consultation_type = consult_type
        appt.save()

        # Create linked Consultation entry
        audio_only = (consult_type == 'audio' or bool(request.data.get('audio_only', False)))
        Consultation.objects.create(
            appointment=appt,
            type=consult_type,
            status='pending',
            is_anonymous=is_anon,
            anonymous_session_id=anon_id,
            audio_only=audio_only
        )

        write_audit_log(user, "BOOK_APPOINTMENT", f"Patient booked appointment ID: {appt.id} (Anonymous: {is_anon}, Mode: {consult_type})", request)
        return Response(AppointmentSerializer(appt, context={'request': request}).data, status=status.HTTP_201_CREATED)

    def put(self, request, pk):
        try:
            appt = Appointment.objects.get(pk=pk)
        except Appointment.DoesNotExist:
            return Response({"error": "Appointment not found"}, status=status.HTTP_404_NOT_FOUND)

        user = request.user
        if user.role == 'doctor' and appt.doctor != user:
            raise PermissionDenied("Unauthorized to update this appointment.")
        
        action = request.data.get('action') # 'approve' or 'cancel' or 'complete'
        if action == 'approve':
            appt.status = 'approved'
            appt.save()
            if hasattr(appt, 'consultation'):
                appt.consultation.status = 'active'
                appt.consultation.start_time = timezone.now()
                appt.consultation.save()
            write_audit_log(user, "APPROVE_APPOINTMENT", f"Doctor approved appointment ID: {appt.id}", request)
        elif action == 'cancel':
            appt.status = 'cancelled'
            appt.save()
            if hasattr(appt, 'consultation'):
                appt.consultation.status = 'ended'
                appt.consultation.save()
            write_audit_log(user, "CANCEL_APPOINTMENT", f"Appointment ID: {appt.id} cancelled", request)
        elif action == 'complete':
            appt.status = 'completed'
            appt.save()
            if hasattr(appt, 'consultation'):
                appt.consultation.status = 'ended'
                appt.consultation.end_time = timezone.now()
                appt.consultation.save()
            write_audit_log(user, "COMPLETE_APPOINTMENT", f"Appointment ID: {appt.id} marked complete", request)
        else:
            return Response({"error": "Invalid action"}, status=status.HTTP_400_BAD_REQUEST)

        return Response(AppointmentSerializer(appt).data)

# Patient Total Medical Records Storage Quota: 250 MB
PATIENT_STORAGE_LIMIT_BYTES = 250 * 1024 * 1024  # 262,144,000 bytes

