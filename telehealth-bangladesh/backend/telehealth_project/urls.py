from django.contrib import admin
from django.urls import path
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)
from api.views import (
    UserRegistrationView, UserProfileView, DoctorListView,
    AppointmentViewSet, HealthRecordViewSet, ConsentViewSet,
    PrescriptionViewSet, MedicineOrderViewSet, AuditLogListView,
    ForgotPasswordView, ResetPasswordView, PatientImageProfileViewSet
)

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # Auth Endpoints
    path('api/register/', UserRegistrationView.as_view(), name='api_register'),
    path('api/login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/auth/forgot-password/', ForgotPasswordView.as_view(), name='forgot_password'),
    path('api/auth/reset-password/', ResetPasswordView.as_view(), name='reset_password'),
    
    # Functional Telemedicine API
    path('api/profile/', UserProfileView.as_view(), name='profile_detail'),
    path('api/doctors/', DoctorListView.as_view(), name='doctor_list'),
    
    path('api/appointments/', AppointmentViewSet.as_view(), name='appointments_list_create'),
    path('api/appointments/<int:pk>/', AppointmentViewSet.as_view(), name='appointment_action'),
    
    path('api/records/', HealthRecordViewSet.as_view(), name='health_records_list_create'),
    
    path('api/consent/', ConsentViewSet.as_view(), name='consent_list_create'),
    path('api/consent/<int:pk>/', ConsentViewSet.as_view(), name='consent_revoke'),
    
    path('api/prescriptions/', PrescriptionViewSet.as_view(), name='prescription_list_create'),
    
    path('api/orders/', MedicineOrderViewSet.as_view(), name='medicine_order_list_create'),
    path('api/orders/<int:pk>/', MedicineOrderViewSet.as_view(), name='medicine_order_update'),
    
    path('api/audit-logs/', AuditLogListView.as_view(), name='admin_audit_logs'),
    path('api/image-profiles/', PatientImageProfileViewSet.as_view(), name='image_profiles_list_create'),
]
