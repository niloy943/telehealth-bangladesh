from datetime import datetime
from django.utils import timezone
from rest_framework import status, permissions, generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied, ValidationError
from django.contrib.auth import get_user_model
from django.db.models import Q

from api.models import (
    DoctorProfile, PatientProfile, Appointment, 
    Consultation, Prescription, HealthRecord, 
    Consent, AuditLog, MedicineOrder, PatientImageProfile
)
from api.serializers import (
    UserRegistrationSerializer, UserSerializer, DoctorProfileSerializer,
    AppointmentSerializer, ConsultationSerializer, PrescriptionSerializer,
    HealthRecordSerializer, ConsentSerializer, AuditLogSerializer,
    MedicineOrderSerializer, ForgotPasswordSerializer, ResetPasswordSerializer,
    PatientImageProfileSerializer
)

User = get_user_model()

# helper for logging actions
def write_audit_log(user, action, details, request=None):
    ip = None
    if request:
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
    
    AuditLog.objects.create(
        user=user,
        action=action,
        details=details,
        ip_address=ip
    )

class UserRegistrationView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserRegistrationSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        write_audit_log(user, "USER_REGISTER", f"User registered with role: {user.role}", request)
        return Response(
            {"message": "User registered successfully", "user": UserSerializer(user).data},
            status=status.HTTP_201_CREATED
        )

class UserProfileView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        data = UserSerializer(user).data
        if user.role == 'doctor':
            profile = DoctorProfile.objects.get(user=user)
            data['doctor_profile'] = DoctorProfileSerializer(profile).data
        elif user.role == 'patient':
            try:
                profile = PatientProfile.objects.get(user=user)
                data['patient_profile'] = {
                    "address": profile.address,
                    "date_of_birth": str(profile.date_of_birth),
                    "blood_group": profile.blood_group,
                    "emergency_contact": profile.emergency_contact
                }
            except PatientProfile.DoesNotExist:
                pass
        return Response(data)

class DoctorListView(generics.ListAPIView):
    queryset = DoctorProfile.objects.filter(user__role='doctor')
    serializer_class = DoctorProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

class AppointmentViewSet(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.role == 'doctor':
            appts = Appointment.objects.filter(doctor=user).order_by('-date')
        elif user.role == 'patient':
            appts = Appointment.objects.filter(patient=user).order_by('-date')
        else:
            appts = Appointment.objects.all().order_by('-date')
        
        serializer = AppointmentSerializer(appts, many=True)
        return Response(serializer.data)

    def post(self, request):
        user = request.user
        if user.role != 'patient':
            raise PermissionDenied("Only patients can book consultations.")
        
        data = request.data.copy()
        data['patient'] = user.id
        serializer = AppointmentSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        appt = serializer.save()

        # Create linked Consultation entry
        Consultation.objects.create(
            appointment=appt,
            type=request.data.get('consultation_type', 'chat'),
            status='pending'
        )

        write_audit_log(user, "BOOK_APPOINTMENT", f"Patient booked appointment ID: {appt.id} with Doctor ID: {appt.doctor_id}", request)
        return Response(AppointmentSerializer(appt).data, status=status.HTTP_201_CREATED)

    def put(self, request, pk):
        # Approve or decline appointment
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
            
            # Start consultation
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

class HealthRecordViewSet(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        patient_id = request.query_params.get('patient_id')

        # Scenario A: Patient viewing their own records
        if not patient_id or int(patient_id) == user.id:
            records = HealthRecord.objects.filter(patient=user)
            serializer = HealthRecordSerializer(records, many=True)
            return Response(serializer.data)

        # Scenario B: Doctor trying to view patient records (Enforce Consent)
        if user.role == 'doctor':
            try:
                patient_user = User.objects.get(id=patient_id)
            except User.DoesNotExist:
                return Response({"error": "Patient not found"}, status=status.HTTP_404_NOT_FOUND)

            # 1. Verify if this doctor has an appointment with the patient
            has_appt = Appointment.objects.filter(
                doctor=user, 
                patient=patient_user, 
                status__in=['approved', 'completed']
            ).exists()

            # 2. Check for active consent delegation
            has_consent = Consent.objects.filter(
                patient=patient_user,
                doctor=user,
                granted=True,
                expires_at__gt=timezone.now()
            ).exists()

            if not has_appt:
                write_audit_log(user, "BLOCK_ACCESS_ATTEMPT", f"Doctor blocked: No appointment relationship with Patient ID: {patient_id}", request)
                raise PermissionDenied("You do not have a clinical appointment relationship with this patient.")

            if not has_consent:
                write_audit_log(user, "BLOCK_ACCESS_ATTEMPT", f"Doctor blocked: Access to records for Patient ID: {patient_id} requires consent.", request)
                raise PermissionDenied("Patient has not granted you active clinical record access consent.")

            # Authorized access! Log viewing audit trail.
            write_audit_log(user, "VIEW_HEALTH_RECORD", f"Doctor accessed health records for Patient ID: {patient_id}", request)
            records = HealthRecord.objects.filter(patient=patient_user)
            serializer = HealthRecordSerializer(records, many=True)
            return Response(serializer.data)
        
        raise PermissionDenied("Unauthorized access role.")

    def post(self, request):
        user = request.user
        if user.role != 'patient':
            raise PermissionDenied("Only patients can add records directly.")
        
        record_type = request.data.get('record_type')
        raw_data = request.data.get('content')
        
        if not record_type or not raw_data:
            raise ValidationError("Parameters 'record_type' and 'content' are required.")

        record = HealthRecord(patient=user, record_type=record_type)
        record.set_content(raw_data) # Encrypt value before storing
        record.save()

        write_audit_log(user, "CREATE_HEALTH_RECORD", f"Patient uploaded record ID: {record.id} ({record_type})", request)
        return Response(HealthRecordSerializer(record).data, status=status.HTTP_201_CREATED)

class ConsentViewSet(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.role == 'patient':
            consents = Consent.objects.filter(patient=user)
        elif user.role == 'doctor':
            consents = Consent.objects.filter(doctor=user, granted=True, expires_at__gt=timezone.now())
        else:
            consents = Consent.objects.all()
        
        return Response(ConsentSerializer(consents, many=True).data)

    def post(self, request):
        user = request.user
        if user.role != 'patient':
            raise PermissionDenied("Only patients can delegate record consent.")

        doctor_id = request.data.get('doctor_id')
        expires_hours = int(request.data.get('expires_hours', 24))
        
        try:
            doctor = User.objects.get(id=doctor_id, role='doctor')
        except User.DoesNotExist:
            return Response({"error": "Doctor not found"}, status=status.HTTP_404_NOT_FOUND)

        expiry = timezone.now() + timezone.timedelta(hours=expires_hours)
        
        # Check if consent exists and update or create
        consent, created = Consent.objects.get_or_create(
            patient=user,
            doctor=doctor,
            defaults={'expires_at': expiry, 'granted': True}
        )
        if not created:
            consent.granted = True
            consent.expires_at = expiry
            consent.save()

        write_audit_log(user, "GRANT_CONSENT", f"Patient granted record access consent to Doctor ID: {doctor_id} for {expires_hours} hours", request)
        return Response(ConsentSerializer(consent).data, status=status.HTTP_201_CREATED)

    def put(self, request, pk):
        user = request.user
        try:
            consent = Consent.objects.get(pk=pk, patient=user)
        except Consent.DoesNotExist:
            return Response({"error": "Consent delegation record not found"}, status=status.HTTP_404_NOT_FOUND)

        consent.granted = False
        consent.save()

        write_audit_log(user, "REVOKE_CONSENT", f"Patient revoked record access consent from Doctor ID: {consent.doctor_id}", request)
        return Response(ConsentSerializer(consent).data)

class PrescriptionViewSet(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.role == 'doctor':
            prescs = Prescription.objects.filter(doctor=user).order_by('-date')
        elif user.role == 'patient':
            prescs = Prescription.objects.filter(patient=user).order_by('-date')
        else:
            prescs = Prescription.objects.all().order_by('-date')

        return Response(PrescriptionSerializer(prescs, many=True).data)

    def post(self, request):
        user = request.user
        if user.role != 'doctor':
            raise PermissionDenied("Only certified doctors can write prescriptions.")

        consultation_id = request.data.get('consultation_id')
        try:
            consult = Consultation.objects.get(id=consultation_id, appointment__doctor=user)
        except Consultation.DoesNotExist:
            return Response({"error": "Active consultation channel not found"}, status=status.HTTP_404_NOT_FOUND)

        symptoms = request.data.get('symptoms')
        diagnosis = request.data.get('diagnosis')
        medicines = request.data.get('medicines') # Expected string or JSON text
        instructions = request.data.get('instructions')

        prescription = Prescription.objects.create(
            consultation=consult,
            doctor=user,
            patient=consult.appointment.patient,
            symptoms=symptoms,
            diagnosis=diagnosis,
            medicines=medicines,
            instructions=instructions
        )

        write_audit_log(user, "WRITE_PRESCRIPTION", f"Doctor wrote prescription ID: {prescription.id} for Patient ID: {prescription.patient_id}", request)
        return Response(PrescriptionSerializer(prescription).data, status=status.HTTP_201_CREATED)

class MedicineOrderViewSet(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.role == 'patient':
            orders = MedicineOrder.objects.filter(patient=user).order_by('-created_at')
        else:
            orders = MedicineOrder.objects.all().order_by('-created_at')
        
        return Response(MedicineOrderSerializer(orders, many=True).data)

    def post(self, request):
        user = request.user
        if user.role != 'patient':
            raise PermissionDenied("Only patients can order medications.")

        prescription_id = request.data.get('prescription_id')
        address = request.data.get('delivery_address')
        price = request.data.get('total_price', 250)

        try:
            prescription = Prescription.objects.get(id=prescription_id, patient=user)
        except Prescription.DoesNotExist:
            prescription = None

        order = MedicineOrder.objects.create(
            patient=user,
            prescription=prescription,
            delivery_address=address,
            total_price=price,
            status='pending'
        )

        write_audit_log(user, "PLACE_MEDICINE_ORDER", f"Patient ordered prescription ID: {prescription_id}. Order ID: {order.id}", request)
        return Response(MedicineOrderSerializer(order).data, status=status.HTTP_201_CREATED)

    def put(self, request, pk):
        user = request.user
        # Admins or riders update order status
        try:
            order = MedicineOrder.objects.get(pk=pk)
        except MedicineOrder.DoesNotExist:
            return Response({"error": "Order details not found"}, status=status.HTTP_404_NOT_FOUND)

        if user.role != 'admin':
            raise PermissionDenied("Only administrative accounts can update transit states.")

        status_val = request.data.get('status') # 'packing', 'shipping', 'delivered'
        if status_val in ['packing', 'shipping', 'delivered']:
            order.status = status_val
            order.save()
            write_audit_log(user, "UPDATE_ORDER_STATUS", f"Admin updated order ID: {order.id} to {status_val}", request)
            return Response(MedicineOrderSerializer(order).data)
        
        return Response({"error": "Invalid order status value"}, status=status.HTTP_400_BAD_REQUEST)

class AuditLogListView(generics.ListAPIView):
    queryset = AuditLog.objects.all().order_by('-timestamp')
    serializer_class = AuditLogSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role != 'admin':
            raise PermissionDenied("Audit tracking access requires Administrative privileges.")
        return super().get_queryset()

class ForgotPasswordView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        from django.utils.http import urlsafe_base64_encode
        from django.utils.encoding import force_bytes
        from django.contrib.auth.tokens import default_token_generator
        from django.core.mail import send_mail
        from django.conf import settings

        serializer = ForgotPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email_or_phone = serializer.validated_data['email_or_phone']

        user = User.objects.filter(Q(email__iexact=email_or_phone) | Q(phone=email_or_phone)).first()
        success_msg = "If an account exists with this email/phone, a reset link has been sent."

        if user:
            token = default_token_generator.make_token(user)
            uidb64 = urlsafe_base64_encode(force_bytes(user.pk))
            token_str = f"{uidb64}-{token}"
            reset_link = f"http://localhost:3000/?token={token_str}"

            subject = "Password Reset Request - SwasthoNirapod"
            message = f"Hello {user.first_name or user.username},\n\nWe received a request to reset your password. Please use the link below to set a new password. The link is valid for 15 minutes.\n\n{reset_link}\n\nIf you did not request this, please ignore this email.\n\nBest regards,\nSwasthoNirapod Team"

            try:
                if user.email:
                    send_mail(
                        subject,
                        message,
                        settings.DEFAULT_FROM_EMAIL or 'noreply@swasthonirapod.com',
                        [user.email],
                        fail_silently=False
                    )
                print("\n========================================================")
                print(f"PASSWORD RESET REQUEST FOR USER: {user.username}")
                print(f"RESET LINK: {reset_link}")
                print("========================================================\n")
            except Exception as e:
                print(f"Error sending password reset email: {e}")

            write_audit_log(user, "PASSWORD_RESET_REQUEST", f"Password reset token requested for username: {user.username}", request)

        return Response({"message": success_msg}, status=status.HTTP_200_OK)

class ResetPasswordView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        from django.utils.http import urlsafe_base64_decode
        from django.utils.encoding import force_str
        from django.contrib.auth.tokens import default_token_generator

        serializer = ResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        token = serializer.validated_data['token']
        new_password = serializer.validated_data['new_password']

        try:
            uidb64, token_char = token.split('-', 1)
            uid = force_str(urlsafe_base64_decode(uidb64))
            user = User.objects.get(pk=uid)
        except (ValueError, TypeError, OverflowError, User.DoesNotExist):
            return Response({"error": "Invalid token or user does not exist."}, status=status.HTTP_400_BAD_REQUEST)

        if not default_token_generator.check_token(user, token_char):
            return Response({"error": "The reset link is invalid or has expired."}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        user.save()

        write_audit_log(user, "PASSWORD_RESET_SUCCESS", f"Password successfully reset for username: {user.username}", request)

        return Response({"message": "Password has been successfully reset. You can now login with your new password."}, status=status.HTTP_200_OK)

class PatientImageProfileViewSet(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        patient_id = request.query_params.get('patient_id')

        # Patients view their own, doctors/admins can view any
        if user.role == 'patient':
            profiles = PatientImageProfile.objects.filter(patient=user).order_by('-created_at')
        elif patient_id:
            profiles = PatientImageProfile.objects.filter(patient_id=patient_id).order_by('-created_at')
        else:
            profiles = PatientImageProfile.objects.all().order_by('-created_at')

        serializer = PatientImageProfileSerializer(profiles, many=True)
        return Response(serializer.data)

    def post(self, request):
        user = request.user
        patient_id = request.data.get('patient', user.id)
        
        # Security check: patients cannot upload for others
        if user.role == 'patient' and int(patient_id) != user.id:
            raise PermissionDenied("You cannot upload image profiles for other patients.")

        try:
            patient_user = User.objects.get(id=patient_id)
        except User.DoesNotExist:
            return Response({"error": "Patient not found"}, status=status.HTTP_404_NOT_FOUND)

        image_name = request.data.get('image_name', 'Medical Scan')
        image_file = request.data.get('image_file', '')
        previous_data = request.data.get('previous_data', {})

        profile = PatientImageProfile.objects.create(
            patient=patient_user,
            image_name=image_name,
            image_file=image_file,
            previous_data=previous_data
        )

        write_audit_log(user, "UPLOAD_MEDICAL_IMAGE", f"Uploaded legacy image scan ID: {profile.id} for Patient ID: {patient_id}", request)
        return Response(PatientImageProfileSerializer(profile).data, status=status.HTTP_201_CREATED)
