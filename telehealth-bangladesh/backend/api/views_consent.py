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

class ConsentViewSet(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.role == 'patient':
            consents = Consent.objects.filter(patient=user).order_by('-created_at')
        elif user.role == 'doctor':
            consents = Consent.objects.filter(doctor=user, granted=True, expires_at__gt=timezone.now()).order_by('-created_at')
        else:
            consents = Consent.objects.all().order_by('-created_at')
        
        return Response(ConsentSerializer(consents, many=True).data)

    def post(self, request, pk=None):
        user = request.user
        action = request.data.get('action') or ('approve' if pk else None)

        # ── Action: Doctor Requests Record Access ──
        if action == 'request':
            if user.role != 'doctor':
                raise PermissionDenied("Only doctors can request access to patient records.")
            patient_id = request.data.get('patient_id') or request.data.get('patientId')
            try:
                if str(patient_id).isdigit():
                    target_patient = User.objects.get(id=int(patient_id), role='patient')
                else:
                    target_patient = User.objects.get(username__iexact=str(patient_id), role='patient')
            except User.DoesNotExist:
                return Response({"error": "Patient not found"}, status=status.HTTP_404_NOT_FOUND)

            # Check for appointment relationship
            has_appt = Appointment.objects.filter(doctor=user, patient=target_patient, status__in=['approved', 'completed']).exists()
            if not has_appt:
                raise PermissionDenied("You can only request access for patients with a confirmed consultation appointment.")

            consent, created = Consent.objects.get_or_create(
                patient=target_patient,
                doctor=user,
                defaults={
                    'granted': False,
                    'status': 'pending',
                    'expires_at': timezone.now() + timezone.timedelta(hours=24)
                }
            )
            if not created:
                consent.status = 'pending'
                consent.granted = False
                consent.expires_at = timezone.now() + timezone.timedelta(hours=24)
                consent.save()

            write_audit_log(user, "REQUEST_RECORD_CONSENT", f"Doctor {user.username} requested record access authorization from Patient {target_patient.username}", request)
            return Response(ConsentSerializer(consent).data, status=status.HTTP_200_OK)

        # ── Action: Patient Approves Access ──
        if action == 'approve':
            if user.role != 'patient':
                raise PermissionDenied("Only the patient can approve record access authorization.")

            consent = None
            if pk:
                consent = Consent.objects.filter(id=pk, patient=user).first()
            if not consent:
                doctor_id = request.data.get('doctor_id') or request.data.get('doctorId')
                if doctor_id:
                    consent = Consent.objects.filter(patient=user, doctor_id=doctor_id).order_by('-id').first()
            
            if not consent:
                return Response({"error": "Consent authorization request not found."}, status=status.HTTP_404_NOT_FOUND)

            expires_hours = int(request.data.get('expires_hours') or request.data.get('hours') or 24)
            consent.granted = True
            consent.status = 'granted'
            consent.expires_at = timezone.now() + timezone.timedelta(hours=expires_hours)
            consent.save()

            write_audit_log(user, "APPROVE_RECORD_CONSENT", f"Patient {user.username} approved record access for Doctor #{consent.doctor_id} ({expires_hours}h window)", request)
            return Response(ConsentSerializer(consent).data, status=status.HTTP_200_OK)

        # ── Standard Consent Grant by Patient ──
        if user.role != 'patient':
            raise PermissionDenied("Only patients can delegate record consent.")

        doctor_id = request.data.get('doctor_id')
        expires_hours = int(request.data.get('expires_hours', 24))
        
        try:
            doctor = User.objects.get(id=doctor_id, role='doctor')
        except User.DoesNotExist:
            return Response({"error": "Doctor not found"}, status=status.HTTP_404_NOT_FOUND)

        expiry = timezone.now() + timezone.timedelta(hours=expires_hours)
        
        consent, created = Consent.objects.get_or_create(
            patient=user,
            doctor=doctor,
            defaults={'expires_at': expiry, 'granted': True, 'status': 'granted'}
        )
        if not created:
            consent.granted = True
            consent.status = 'granted'
            consent.expires_at = expiry
            consent.save()

        write_audit_log(user, "GRANT_CONSENT", f"Patient granted record access consent to Doctor ID: {doctor_id} for {expires_hours} hours", request)
        return Response(ConsentSerializer(consent).data, status=status.HTTP_201_CREATED)

    def put(self, request, pk=None):
        user = request.user
        if not pk:
            pk = request.data.get('id')
        try:
            consent = Consent.objects.get(id=pk)
        except Consent.DoesNotExist:
            return Response({"error": "Consent not found"}, status=status.HTTP_404_NOT_FOUND)

        if consent.patient != user and not user.is_staff:
            raise PermissionDenied("Only the patient can modify or revoke this consent.")

        action = request.data.get('action')
        if action == 'approve':
            hours = int(request.data.get('expires_hours') or request.data.get('hours') or 24)
            consent.granted = True
            consent.status = 'granted'
            consent.expires_at = timezone.now() + timezone.timedelta(hours=hours)
            consent.save()
            write_audit_log(user, "APPROVE_RECORD_CONSENT", f"Patient approved consent #{consent.id} for Doctor #{consent.doctor_id}", request)
        else:
            consent.granted = False
            consent.status = 'revoked'
            consent.expires_at = timezone.now()
            consent.save()
            write_audit_log(user, "REVOKE_CONSENT", f"Patient revoked consent #{consent.id} for Doctor #{consent.doctor_id}", request)

        return Response(ConsentSerializer(consent).data, status=status.HTTP_200_OK)

