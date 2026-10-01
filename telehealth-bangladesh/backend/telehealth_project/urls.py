from django.contrib import admin
from django.urls import path
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)
from api.views import (
    CustomTokenObtainPairView,
    UserRegistrationView, UserProfileView, DoctorListView,
    AppointmentViewSet, HealthRecordViewSet, ConsentViewSet,
    PrescriptionViewSet, PrescriptionShareView, SharedPrescriptionView,
    MedicineListView, MedicineOrderViewSet, AuditLogListView,
    ForgotPasswordView, ResetPasswordView, ChangePasswordView, PatientImageProfileViewSet,
    SecureLoginView, MFAVerifyView, AdminDoctorKYCView, AdminDoctorActionView,
    AdminStaffManagementView, AdminStaffDetailView,
    PaymentInitiateView, PaymentCallbackView, PaymentIPNView, PaymentStatusView, PaymentHistoryView,
    TelephonyCallView,
    TelephonyCallTerminateView, TelephonyCallStatusView, TelephonyCallListView,
    TelephonyTwiMLView, ConsultationDetailView,
    GovNIDVerifyView, GovBMDCVerifyView, FileUploadView, FileDownloadView,
    BlockchainLedgerView, BlockchainVerifyView, BlockchainTransactionDetailView,
    AIHealthAssistantView, AIConversationListView, AIConversationDetailView
)

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # Auth & Security Endpoints
    path('api/register/', UserRegistrationView.as_view(), name='api_register'),
    path('api/login/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/login-secure/', SecureLoginView.as_view(), name='secure_login'),
    path('api/auth/mfa-verify/', MFAVerifyView.as_view(), name='mfa_verify'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/auth/forgot-password/', ForgotPasswordView.as_view(), name='forgot_password'),
    path('api/auth/reset-password/', ResetPasswordView.as_view(), name='reset_password'),
    path('api/auth/change-password/', ChangePasswordView.as_view(), name='change_password'),
    path('api/change-password/', ChangePasswordView.as_view(), name='change_password_alias'),
    
    # User & Doctor Profiles / KYC Review Center / Staff Management
    path('api/profile/', UserProfileView.as_view(), name='profile_detail'),
    path('api/doctors/', DoctorListView.as_view(), name='doctor_list'),
    path('api/admin/doctors/', AdminDoctorKYCView.as_view(), name='admin_doctor_kyc_list'),
    path('api/admin/doctors/<int:pk>/', AdminDoctorActionView.as_view(), name='admin_doctor_detail'),
    path('api/admin/doctors/<int:pk>/action/', AdminDoctorActionView.as_view(), name='admin_doctor_kyc_action'),
    path('api/admin/staff/', AdminStaffManagementView.as_view(), name='admin_staff_list_create'),
    path('api/admin/staff/<int:pk>/', AdminStaffDetailView.as_view(), name='admin_staff_detail'),
    path('api/admin/staff/<int:pk>/action/', AdminStaffDetailView.as_view(), name='admin_staff_action'),
    
    # Telemedicine Appointments & Clinical Sessions
    path('api/appointments/', AppointmentViewSet.as_view(), name='appointments_list_create'),
    path('api/appointments/<int:pk>/', AppointmentViewSet.as_view(), name='appointment_action'),
    path('api/consultations/<int:pk>/', ConsultationDetailView.as_view(), name='consultation_detail'),
    
    # E2EE Patient Records & Consent
    path('api/records/', HealthRecordViewSet.as_view(), name='health_records_list_create'),
    path('api/consent/', ConsentViewSet.as_view(), name='consent_list_create'),
    path('api/consent/<int:pk>/', ConsentViewSet.as_view(), name='consent_revoke'),
    
    # E-Prescriptions & Secure Token Sharing
    path('api/prescriptions/', PrescriptionViewSet.as_view(), name='prescription_list_create'),
    path('api/prescriptions/<int:pk>/share/', PrescriptionShareView.as_view(), name='prescription_share'),
    path('api/prescriptions/shared/<str:token>/', SharedPrescriptionView.as_view(), name='prescription_shared_view'),
    
    # Medicine Store & Orders
    path('api/medicines/', MedicineListView.as_view(), name='medicine_list'),
    path('api/orders/', MedicineOrderViewSet.as_view(), name='medicine_order_list_create'),
    path('api/orders/<int:pk>/', MedicineOrderViewSet.as_view(), name='medicine_order_update'),
    
    # Payment Gateway (SSLCommerz V4 Live & Sandbox)
    path('api/payment/initiate/', PaymentInitiateView.as_view(), name='payment_initiate'),
    path('api/payment/callback/', PaymentCallbackView.as_view(), name='payment_callback'),
    path('api/payment/ipn/', PaymentIPNView.as_view(), name='payment_ipn'),
    path('api/payment/status/<str:transaction_ref>/', PaymentStatusView.as_view(), name='payment_status'),
    path('api/payment/history/', PaymentHistoryView.as_view(), name='payment_history'),
    path('api/telephony/call/', TelephonyCallView.as_view(), name='telephony_call'),
    path('api/telephony/call/<str:call_sid>/terminate/', TelephonyCallTerminateView.as_view(), name='telephony_call_terminate'),
    path('api/telephony/call/<str:call_sid>/status/', TelephonyCallStatusView.as_view(), name='telephony_call_status'),
    path('api/telephony/calls/', TelephonyCallListView.as_view(), name='telephony_call_list'),
    path('api/telephony/twiml/', TelephonyTwiMLView.as_view(), name='telephony_twiml'),
    path('api/telephony/twiml/<int:consultation_id>/', TelephonyTwiMLView.as_view(), name='telephony_twiml_consultation'),
    
    # Government DGHS / NID / BMDC Integration
    path('api/gov/verify-nid/', GovNIDVerifyView.as_view(), name='gov_verify_nid'),
    path('api/gov/verify-bmdc/', GovBMDCVerifyView.as_view(), name='gov_verify_bmdc'),
    
    # Cloud Storage & File Access
    path('api/storage/upload/', FileUploadView.as_view(), name='storage_upload'),
    path('api/storage/file/<str:filename>/', FileDownloadView.as_view(), name='storage_download'),
    
    # Blockchain Integrity Ledger
    path('api/blockchain/records/', BlockchainLedgerView.as_view(), name='blockchain_records'),
    path('api/blockchain/verify-record/', BlockchainVerifyView.as_view(), name='blockchain_verify'),
    path('api/blockchain/transaction/<str:tx_hash>/', BlockchainTransactionDetailView.as_view(), name='blockchain_tx_detail'),
    
    # System Audit Logs & Vision Profiles
    path('api/audit-logs/', AuditLogListView.as_view(), name='admin_audit_logs'),
    path('api/image-profiles/', PatientImageProfileViewSet.as_view(), name='image_profiles_list_create'),
    
    # AI Health Assistant (Server-Side OpenAI Integration)
    path('api/ai/health-assistant/', AIHealthAssistantView.as_view(), name='ai_health_assistant'),
    path('api/ai/health-assistant/conversations/', AIConversationListView.as_view(), name='ai_conversations_list'),
    path('api/ai/health-assistant/conversations/<str:conversation_id>/', AIConversationDetailView.as_view(), name='ai_conversation_detail'),
]


