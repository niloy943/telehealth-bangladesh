import json
from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.db.models import Q
from api.models import (
    DoctorProfile, PatientProfile, Appointment, 
    Consultation, Prescription, HealthRecord, 
    Consent, AuditLog, Medicine, MedicineOrder, 
    PatientImageProfile, OTPCode, LoginAttempt, 
    PaymentTransaction, BlockchainRecord, TelephonyCall,
    AIConversation, AIMessage
)

User = get_user_model()

class UserRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    specialty = serializers.CharField(required=False, allow_blank=True)
    hospital = serializers.CharField(required=False, allow_blank=True)
    fees = serializers.IntegerField(required=False, default=500)
    bmdc_reg = serializers.CharField(required=False, allow_blank=True)
    nid = serializers.CharField(required=False, allow_blank=True)
    date_of_birth = serializers.DateField(required=False, allow_null=True)
    blood_group = serializers.CharField(required=False, allow_blank=True)
    address = serializers.CharField(required=False, allow_blank=True)
    emergency_contact = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = User
        fields = (
            'username', 'password', 'email', 'first_name', 'last_name',
            'role', 'phone', 'nid', 'bmdc_reg', 'specialty', 'hospital', 
            'fees', 'date_of_birth', 'blood_group', 'address', 'emergency_contact'
        )

    def to_internal_value(self, data):
        data = data.copy()
        if 'date_of_birth' in data and data['date_of_birth'] == '':
            data['date_of_birth'] = None
        if 'fees' in data and data['fees'] == '':
            data['fees'] = 500
        return super().to_internal_value(data)

    def validate_email(self, value):
        if value:
            if User.objects.filter(email=value).exists():
                raise serializers.ValidationError("A user with this email already exists.")
        return value

    def validate_phone(self, value):
        if value:
            if User.objects.filter(phone=value).exists():
                raise serializers.ValidationError("A user with this phone number already exists.")
        return value

    def validate(self, attrs):
        role = attrs.get('role', 'patient')
        if role == 'doctor':
            raise serializers.ValidationError({
                "role": "Public doctor registration is disabled. Doctor accounts must be provisioned directly by a Super Admin."
            })
        elif role in ['admin', 'superadmin', 'staff']:
            raise serializers.ValidationError({
                "role": "Administrative accounts cannot be registered publicly."
            })
        elif role != 'patient':
            raise serializers.ValidationError({
                "role": "Invalid registration role specified. Only patients can register publicly."
            })

        if not attrs.get('nid'):
            raise serializers.ValidationError({"nid": "National ID (NID) is required for patients."})
        return attrs

    def create(self, validated_data):
        # Force role to patient for public registration - no privilege escalation possible
        validated_data['role'] = 'patient'
        role = 'patient'
        password = validated_data.pop('password')
        
        # Pull profile fields
        specialty = validated_data.pop('specialty', '')
        hospital = validated_data.pop('hospital', '')
        fees = validated_data.pop('fees', 500)
        date_of_birth = validated_data.pop('date_of_birth', None)
        blood_group = validated_data.pop('blood_group', '')
        address = validated_data.pop('address', '')
        emergency_contact = validated_data.pop('emergency_contact', '')

        # Create basic user
        user = User.objects.create(**validated_data)
        user.set_password(password)
        user.save()

        # Build dynamic profile based on roles
        if role == 'doctor':
            DoctorProfile.objects.create(
                user=user,
                specialty=specialty,
                hospital=hospital,
                fees=fees,
                verification_status='pending'  # New registered doctors are pending KYC review
            )
        elif role == 'patient':
            PatientProfile.objects.create(
                user=user,
                date_of_birth=date_of_birth,
                blood_group=blood_group,
                address=address,
                emergency_contact=emergency_contact
            )

        return user

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = (
            'id', 'username', 'email', 'first_name', 'last_name', 
            'role', 'phone', 'nid', 'bmdc_reg', 'is_active', 
            'is_staff', 'is_superuser', 'date_joined', 'last_login'
        )

from rest_framework import exceptions
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        # Server-authoritative role claim from active DB model
        token['role'] = getattr(user, 'role', 'patient')
        token['username'] = user.username
        token['is_staff'] = user.is_staff
        token['is_superuser'] = user.is_superuser
        return token

    def validate(self, attrs):
        # Support authentication via either username or email
        username_val = attrs.get('username')
        if username_val and '@' in username_val:
            user_by_email = User.objects.filter(email__iexact=username_val).first()
            if user_by_email:
                attrs['username'] = user_by_email.username
                username_val = user_by_email.username

        if username_val:
            target_user = User.objects.filter(Q(username__iexact=username_val) | Q(email__iexact=username_val)).first()
            if target_user and not target_user.is_active:
                raise exceptions.AuthenticationFailed(
                    "Account suspended: Your account has been suspended by administration. Please contact support."
                )

        data = super().validate(attrs)

        # Server-side Role Resolution: Verify requested role matches actual database role
        requested_role = self.initial_data.get('role')
        user_role = getattr(self.user, 'role', 'patient')
        is_admin_user = bool(user_role == 'admin' or self.user.is_staff or self.user.is_superuser)

        if requested_role:
            requested_role = str(requested_role).lower().strip()

            if is_admin_user:
                # Administrator authenticated with valid credentials - seamlessly authorize
                pass
            elif requested_role == 'patient':
                if user_role != 'patient':
                    raise exceptions.AuthenticationFailed(
                        "Authentication failed: Account is not registered as a Patient."
                    )
            elif requested_role == 'doctor':
                if user_role != 'doctor':
                    raise exceptions.AuthenticationFailed(
                        "Authentication failed: Account is not registered as a Doctor."
                    )
            elif requested_role in ['admin', 'superadmin']:
                if not is_admin_user:
                    raise exceptions.AuthenticationFailed(
                        "Authentication failed: Account does not have administrative privileges."
                    )
            else:
                if requested_role != user_role:
                    raise exceptions.AuthenticationFailed(
                        "Authentication failed: Account role mismatch."
                    )

        data['user'] = UserSerializer(self.user).data
        return data

class DoctorProfileSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    class Meta:
        model = DoctorProfile
        fields = '__all__'

class PatientProfileSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    class Meta:
        model = PatientProfile
        fields = '__all__'

class ConsultationMinimalSerializer(serializers.ModelSerializer):
    class Meta:
        model = Consultation
        fields = ('id', 'type', 'status', 'is_anonymous', 'start_time', 'end_time')

class AppointmentSerializer(serializers.ModelSerializer):
    patient_details = UserSerializer(source='patient', read_only=True)
    doctor_details = UserSerializer(source='doctor', read_only=True)
    consultation = ConsultationMinimalSerializer(read_only=True)
    
    class Meta:
        model = Appointment
        fields = '__all__'

class ConsultationSerializer(serializers.ModelSerializer):
    appointment_details = AppointmentSerializer(source='appointment', read_only=True)
    class Meta:
        model = Consultation
        fields = '__all__'

class PrescriptionSerializer(serializers.ModelSerializer):
    doctor_details = UserSerializer(source='doctor', read_only=True)
    patient_details = UserSerializer(source='patient', read_only=True)
    class Meta:
        model = Prescription
        fields = '__all__'

class HealthRecordSerializer(serializers.ModelSerializer):
    patient_details = UserSerializer(source='patient', read_only=True)
    decrypted_content = serializers.SerializerMethodField()

    class Meta:
        model = HealthRecord
        fields = ('id', 'patient', 'patient_details', 'record_type', 'decrypted_content', 'created_at', 'updated_at')

    def get_decrypted_content(self, obj):
        try:
            return obj.get_content()
        except Exception:
            return "[Decryption Error]"

class ConsentSerializer(serializers.ModelSerializer):
    patient_details = UserSerializer(source='patient', read_only=True)
    doctor_details = UserSerializer(source='doctor', read_only=True)
    class Meta:
        model = Consent
        fields = '__all__'

class AuditLogSerializer(serializers.ModelSerializer):
    user_details = UserSerializer(source='user', read_only=True)
    class Meta:
        model = AuditLog
        fields = '__all__'

class MedicineSerializer(serializers.ModelSerializer):
    class Meta:
        model = Medicine
        fields = '__all__'

class MedicineOrderSerializer(serializers.ModelSerializer):
    patient_details = UserSerializer(source='patient', read_only=True)
    prescription_details = PrescriptionSerializer(source='prescription', read_only=True)
    
    class Meta:
        model = MedicineOrder
        fields = '__all__'

class ForgotPasswordSerializer(serializers.Serializer):
    email_or_phone = serializers.CharField(required=True)

class ResetPasswordSerializer(serializers.Serializer):
    token = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, write_only=True)
    confirm_password = serializers.CharField(required=True, write_only=True)

    def validate(self, data):
        if data['new_password'] != data['confirm_password']:
            raise serializers.ValidationError({"confirm_password": "Passwords do not match."})
        return data

    def validate_new_password(self, value):
        from django.contrib.auth.password_validation import validate_password
        from django.core.exceptions import ValidationError as DjangoValidationError
        try:
            validate_password(value)
        except DjangoValidationError as e:
            raise serializers.ValidationError(list(e.messages))
        return value

class PatientImageProfileSerializer(serializers.ModelSerializer):
    patient_details = UserSerializer(source='patient', read_only=True)

    class Meta:
        model = PatientImageProfile
        fields = '__all__'

class PaymentTransactionSerializer(serializers.ModelSerializer):
    appointment_details = serializers.SerializerMethodField()
    order_details = serializers.SerializerMethodField()

    class Meta:
        model = PaymentTransaction
        fields = '__all__'

    def get_appointment_details(self, obj):
        if not obj.appointment:
            return None
        doc = obj.appointment.doctor
        doc_prof = getattr(doc, 'doctor_profile', None)
        return {
            "id": obj.appointment.id,
            "doctor_name": f"Dr. {doc.first_name} {doc.last_name}".strip() or doc.username,
            "specialty": doc_prof.specialty if doc_prof else "General Physician",
            "date": str(obj.appointment.date),
            "time": obj.appointment.time,
        }

    def get_order_details(self, obj):
        if not obj.order:
            return None
        return {
            "id": obj.order.id,
            "items_count": len(obj.order.items_breakdown) if isinstance(obj.order.items_breakdown, list) else 0,
            "delivery_address": obj.order.delivery_address,
            "delivery_fee": float(obj.order.delivery_fee),
            "total_price": float(obj.order.total_price),
        }

class BlockchainRecordSerializer(serializers.ModelSerializer):
    blockchain_connected = serializers.SerializerMethodField()
    admin_contract_address = serializers.SerializerMethodField()

    class Meta:
        model = BlockchainRecord
        fields = '__all__'

    def get_blockchain_connected(self, obj):
        return self.context.get('blockchain_connected', False)

    def get_admin_contract_address(self, obj):
        return self.context.get('contract_address', '')

class TelephonyCallSerializer(serializers.ModelSerializer):
    caller_details = UserSerializer(source='caller', read_only=True)
    consultation_id = serializers.PrimaryKeyRelatedField(source='consultation', read_only=True)

    class Meta:
        model = TelephonyCall
        fields = (
            'id', 'caller', 'caller_details', 'recipient_phone', 'from_phone',
            'twilio_call_sid', 'status', 'mode', 'consultation', 'consultation_id',
            'started_at', 'ended_at', 'duration', 'error_message', 'created_at', 'updated_at'
        )


class AIHealthAssistantRequestSerializer(serializers.Serializer):
    message = serializers.CharField(
        required=True,
        allow_blank=False,
        max_length=2000,
        trim_whitespace=True,
        error_messages={
            'blank': 'Message cannot be empty.',
            'required': 'Message is required.',
            'max_length': 'Message cannot exceed 2000 characters.'
        }
    )
    conversation_id = serializers.CharField(
        required=False,
        allow_blank=True,
        default='',
        max_length=64
    )


class AIMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = AIMessage
        fields = ('id', 'role', 'content', 'safety_level', 'created_at')


class AIConversationSerializer(serializers.ModelSerializer):
    messages = AIMessageSerializer(many=True, read_only=True)

    class Meta:
        model = AIConversation
        fields = ('id', 'conversation_id', 'title', 'created_at', 'updated_at', 'messages')



