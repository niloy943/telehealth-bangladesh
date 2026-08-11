import json
from rest_framework import serializers
from django.contrib.auth import get_user_model
from api.models import (
    DoctorProfile, PatientProfile, Appointment, 
    Consultation, Prescription, HealthRecord, 
    Consent, AuditLog, MedicineOrder, PatientImageProfile
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
            if not attrs.get('bmdc_reg'):
                raise serializers.ValidationError({"bmdc_reg": "BMDC registration number is required for doctors."})
            if not attrs.get('specialty'):
                raise serializers.ValidationError({"specialty": "Specialty is required for doctors."})
        elif role == 'patient':
            if not attrs.get('nid'):
                raise serializers.ValidationError({"nid": "National ID (NID) is required for patients."})
        return attrs

    def create(self, validated_data):
        # Extract profiles details
        role = validated_data.get('role', 'patient')
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
                fees=fees
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
        fields = ('id', 'username', 'email', 'first_name', 'last_name', 'role', 'phone', 'nid', 'bmdc_reg')

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
        fields = ('id', 'type', 'status', 'start_time', 'end_time')

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
