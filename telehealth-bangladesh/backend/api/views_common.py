import random
import uuid
import hashlib
import json
import secrets
from datetime import datetime
from decimal import Decimal

from django.utils import timezone
from rest_framework import status, permissions, generics, throttling
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied, ValidationError
from django.contrib.auth import get_user_model, authenticate
from django.db.models import Q
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView
from django.http import HttpResponse, HttpResponseForbidden
from django.shortcuts import redirect

from api.models import (
    DoctorProfile, PatientProfile, Appointment, 
    Consultation, Prescription, HealthRecord, 
    Consent, AuditLog, Medicine, MedicineOrder, 
    PatientImageProfile, OTPCode, LoginAttempt,
    PaymentTransaction, BlockchainRecord, TelephonyCall,
    AIConversation, AIMessage,
    ConsentRequest, PatientConsent, ConsentPermission,
    ConsentHistory, RecordAccessLog, EmergencyAccessSetting,
    EmergencyAccessLog
)
from api.serializers import (
    UserRegistrationSerializer, UserSerializer, DoctorProfileSerializer,
    AppointmentSerializer, ConsultationSerializer, PrescriptionSerializer,
    HealthRecordSerializer, ConsentSerializer, AuditLogSerializer,
    MedicineSerializer, MedicineOrderSerializer, ForgotPasswordSerializer, 
    ResetPasswordSerializer, PatientImageProfileSerializer,
    PaymentTransactionSerializer, BlockchainRecordSerializer,
    TelephonyCallSerializer, AIHealthAssistantRequestSerializer,
    AIConversationSerializer, AIMessageSerializer, CustomTokenObtainPairSerializer
)
from api.permissions import IsAdminUserRole, IsDoctorRole, IsPatientRole
from api.twilio_service import twilio_service
from api.gov_service import gov_service
from api.payment_service import payment_service
from api.storage_service import storage_service
from api.blockchain_service import blockchain_service
from api.services.ai_health_assistant import ai_health_assistant_service

User = get_user_model()

def generate_anonymous_session_id():
    chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "".join(secrets.choice(chars) for _ in range(6))
from decimal import Decimal
from django.utils import timezone
from rest_framework import status, permissions, generics, throttling
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied, ValidationError
from django.contrib.auth import get_user_model, authenticate
from django.db.models import Q
from rest_framework_simplejwt.tokens import RefreshToken

from django.http import HttpResponse, HttpResponseForbidden
from django.shortcuts import redirect
from api.models import (
    DoctorProfile, PatientProfile, Appointment, 
    Consultation, Prescription, HealthRecord, 
    Consent, AuditLog, Medicine, MedicineOrder, 
    PatientImageProfile, OTPCode, LoginAttempt,
    PaymentTransaction, BlockchainRecord, TelephonyCall,
    AIConversation, AIMessage,
    ConsentRequest, PatientConsent, ConsentPermission,
    ConsentHistory, RecordAccessLog, EmergencyAccessSetting,
    EmergencyAccessLog
)
from api.serializers import (
    UserRegistrationSerializer, UserSerializer, DoctorProfileSerializer,
    AppointmentSerializer, ConsultationSerializer, PrescriptionSerializer,
    HealthRecordSerializer, ConsentSerializer, AuditLogSerializer,
    MedicineSerializer, MedicineOrderSerializer, ForgotPasswordSerializer, 
    ResetPasswordSerializer, PatientImageProfileSerializer,
    PaymentTransactionSerializer, BlockchainRecordSerializer,
    TelephonyCallSerializer, AIHealthAssistantRequestSerializer,
    AIConversationSerializer, AIMessageSerializer, CustomTokenObtainPairSerializer
)
from api.permissions import IsAdminUserRole, IsDoctorRole, IsPatientRole
from rest_framework_simplejwt.views import TokenObtainPairView
from api.twilio_service import twilio_service
from api.gov_service import gov_service
from api.payment_service import payment_service
from api.storage_service import storage_service
from api.blockchain_service import blockchain_service
from api.services.ai_health_assistant import ai_health_assistant_service

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
        user=user if user and user.is_authenticated else None,
        action=action,
        details=details,
        ip_address=ip
    )

class AuditLogListView(generics.ListAPIView):
    queryset = AuditLog.objects.all().order_by('-timestamp')
    serializer_class = AuditLogSerializer
    permission_classes = [IsAdminUserRole]

    def get_queryset(self):
        user = self.request.user
        if not (getattr(user, 'role', None) == 'admin' or user.is_staff or user.is_superuser):
            raise PermissionDenied("Audit tracking access requires Administrative privileges.")
        return super().get_queryset()

