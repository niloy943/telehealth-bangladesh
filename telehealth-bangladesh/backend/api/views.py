import random
import uuid
import hashlib
import json
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

from django.http import HttpResponse, HttpResponseForbidden
from django.shortcuts import redirect
from api.models import (
    DoctorProfile, PatientProfile, Appointment, 
    Consultation, Prescription, HealthRecord, 
    Consent, AuditLog, Medicine, MedicineOrder, 
    PatientImageProfile, OTPCode, LoginAttempt,
    PaymentTransaction, BlockchainRecord, TelephonyCall,
    AIConversation, AIMessage
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

class CustomTokenObtainPairView(TokenObtainPairView):
    """
    Issues JWT access/refresh tokens with server-authoritative role claims.
    """
    serializer_class = CustomTokenObtainPairSerializer

class UserRegistrationView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserRegistrationSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        role = request.data.get('role', 'patient')
        if role == 'doctor':
            return Response(
                {"error": "Public doctor registration is disabled. Doctor accounts must be provisioned directly by a Super Admin."},
                status=status.HTTP_403_FORBIDDEN
            )
        if role in ['admin', 'superadmin', 'staff']:
            return Response(
                {"error": "Administrative accounts cannot be registered publicly."},
                status=status.HTTP_403_FORBIDDEN
            )
        if role != 'patient':
            return Response(
                {"error": "Invalid registration role specified. Only patients can register publicly."},
                status=status.HTTP_400_BAD_REQUEST
            )

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
            try:
                profile = DoctorProfile.objects.get(user=user)
                data['doctor_profile'] = DoctorProfileSerializer(profile).data
            except DoctorProfile.DoesNotExist:
                pass
        elif user.role == 'patient':
            try:
                profile = PatientProfile.objects.get(user=user)
                data['patient_profile'] = {
                    "address": profile.address,
                    "date_of_birth": str(profile.date_of_birth) if profile.date_of_birth else None,
                    "blood_group": profile.blood_group,
                    "emergency_contact": profile.emergency_contact
                }
            except PatientProfile.DoesNotExist:
                pass
        return Response(data)

    def put(self, request):
        user = request.user
        data = request.data.copy()
        
        # Security protection: Prevent changing role or privileges through profile update API
        for restricted in ['role', 'is_staff', 'is_superuser', 'user_permissions', 'groups']:
            if restricted in data:
                data.pop(restricted)
        
        serializer = UserSerializer(user, data=data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        # Also persist patient_profile or doctor_profile fields if provided
        if user.role == 'patient':
            try:
                p_profile, _ = PatientProfile.objects.get_or_create(user=user)
                if 'address' in data:
                    p_profile.address = data['address']
                if 'emergency_contact' in data:
                    p_profile.emergency_contact = data['emergency_contact']
                if 'blood_group' in data:
                    p_profile.blood_group = data['blood_group']
                if 'date_of_birth' in data and data['date_of_birth']:
                    p_profile.date_of_birth = data['date_of_birth']
                p_profile.save()
            except Exception as e:
                logger.warning(f"Error updating patient profile: {e}")
        elif user.role == 'doctor':
            try:
                d_profile, _ = DoctorProfile.objects.get_or_create(user=user)
                if 'specialty' in data:
                    d_profile.specialty = data['specialty']
                if 'hospital' in data:
                    d_profile.hospital = data['hospital']
                if 'bio' in data:
                    d_profile.bio = data['bio']
                if 'experience' in data:
                    try:
                        d_profile.experience = int(data['experience'])
                    except (ValueError, TypeError):
                        pass
                if 'online' in data:
                    d_profile.online = bool(data['online'])
                if 'fees' in data and data['fees'] is not None:
                    try:
                        d_profile.fees = int(data['fees'])
                    except (ValueError, TypeError):
                        pass
                if 'schedule' in data:
                    d_profile.schedule = data['schedule']
                d_profile.save()
            except Exception as e:
                logger.warning(f"Error updating doctor profile: {e}")

        write_audit_log(user, "UPDATE_PROFILE", f"User updated profile details.", request)
        return self.get(request)

class DoctorListView(generics.ListAPIView):
    serializer_class = DoctorProfileSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        user = self.request.user
        # Admins see all doctors; patients and public directory only see active approved doctors
        if user and user.is_authenticated and (user.role == 'admin' or user.is_staff or user.is_superuser):
            return DoctorProfile.objects.filter(user__role='doctor')
        return DoctorProfile.objects.filter(user__role='doctor', verification_status='approved', user__is_active=True)

class AdminDoctorKYCView(APIView):
    permission_classes = [IsAdminUserRole]

    def get(self, request):
        if request.user.role != 'admin' and not request.user.is_staff and not request.user.is_superuser:
            raise PermissionDenied("Admin access required for KYC Review Center.")
        
        search_query = request.GET.get('search', '').strip()
        status_filter = request.GET.get('status', '').strip()
        
        doctors = DoctorProfile.objects.filter(user__role='doctor')
        
        if status_filter and status_filter != 'all':
            if status_filter == 'active':
                doctors = doctors.filter(verification_status='approved', user__is_active=True)
            elif status_filter == 'deactivated':
                doctors = doctors.filter(user__is_active=False)
            else:
                doctors = doctors.filter(verification_status=status_filter)
                
        if search_query:
            doctors = doctors.filter(
                Q(user__username__icontains=search_query) |
                Q(user__first_name__icontains=search_query) |
                Q(user__last_name__icontains=search_query) |
                Q(user__email__icontains=search_query) |
                Q(user__phone__icontains=search_query) |
                Q(user__bmdc_reg__icontains=search_query) |
                Q(specialty__icontains=search_query) |
                Q(hospital__icontains=search_query)
            )
            
        doctors = doctors.order_by('-user__date_joined')
        return Response(DoctorProfileSerializer(doctors, many=True).data)

    def post(self, request):
        if request.user.role != 'admin' and not request.user.is_staff and not request.user.is_superuser:
            raise PermissionDenied("Admin access required to onboard doctor accounts.")
        
        data = request.data
        username = data.get('username')
        password = data.get('password')
        email = data.get('email', '')
        first_name = data.get('first_name', '')
        last_name = data.get('last_name', '')
        phone = data.get('phone', '')
        bmdc_reg = data.get('bmdc_reg', '')
        specialty = data.get('specialty', 'General Physician')
        hospital = data.get('hospital', '')
        fees = data.get('fees', 500)
        experience = data.get('experience', 1)
        bio = data.get('bio', '')

        if not username or not password:
            return Response({"error": "Username and password are required."}, status=status.HTTP_400_BAD_REQUEST)
        
        if User.objects.filter(username=username).exists():
            return Response({"error": "A user with this username already exists."}, status=status.HTTP_400_BAD_REQUEST)
        if email and User.objects.filter(email=email).exists():
            return Response({"error": "A user with this email already exists."}, status=status.HTTP_400_BAD_REQUEST)
        if not bmdc_reg:
            return Response({"error": "BMDC registration number is required."}, status=status.HTTP_400_BAD_REQUEST)

        # Create doctor user directly with role='doctor'
        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
            phone=phone,
            bmdc_reg=bmdc_reg,
            role='doctor',
            is_active=True
        )

        doc_profile = DoctorProfile.objects.create(
            user=user,
            specialty=specialty,
            hospital=hospital,
            fees=fees,
            experience=experience,
            bio=bio,
            verification_status='approved',
            verified_at=timezone.now(),
            verified_by=request.user
        )

        write_audit_log(request.user, "SUPERADMIN_CREATE_DOCTOR", f"Super Admin onboarded Doctor account: Dr. {username} (BMDC: {bmdc_reg})", request)

        return Response({
            "message": f"Doctor Dr. {first_name} {last_name} ({username}) created successfully.",
            "doctor": DoctorProfileSerializer(doc_profile).data
        }, status=status.HTTP_201_CREATED)

class AdminDoctorActionView(APIView):
    permission_classes = [IsAdminUserRole]

    def get(self, request, pk):
        if request.user.role != 'admin' and not request.user.is_staff and not request.user.is_superuser:
            raise PermissionDenied("Admin access required.")
        doc_profile = DoctorProfile.objects.filter(Q(pk=pk) | Q(user__id=pk)).first()
        if not doc_profile:
            return Response({"error": "Doctor profile not found"}, status=status.HTTP_404_NOT_FOUND)
        return Response(DoctorProfileSerializer(doc_profile).data)

    def post(self, request, pk):
        if request.user.role != 'admin' and not request.user.is_staff and not request.user.is_superuser:
            raise PermissionDenied("Admin access required for Doctor verification actions.")
        
        doc_profile = DoctorProfile.objects.filter(Q(pk=pk) | Q(user__id=pk)).first()
        if not doc_profile:
            return Response({"error": "Doctor profile not found"}, status=status.HTTP_404_NOT_FOUND)

        action = request.data.get('action') # 'approve', 'reject', 'pending', 'deactivate', 'activate', 'suspend', 'unsuspend', 'delete'
        reason = request.data.get('reason', '')

        if action == 'approve':
            doc_profile.verification_status = 'approved'
            doc_profile.rejection_reason = None
            doc_profile.verified_at = timezone.now()
            doc_profile.verified_by = request.user
            doc_profile.save()
            user = doc_profile.user
            user.is_active = True
            user.save()
            write_audit_log(request.user, "APPROVE_DOCTOR_KYC", f"Approved KYC for Dr. {doc_profile.user.username}", request)
            return Response({"message": f"Dr. {doc_profile.user.username} approved successfully.", "doctor": DoctorProfileSerializer(doc_profile).data})
        
        elif action == 'reject':
            doc_profile.verification_status = 'rejected'
            doc_profile.rejection_reason = reason
            doc_profile.verified_at = timezone.now()
            doc_profile.verified_by = request.user
            doc_profile.save()
            write_audit_log(request.user, "REJECT_DOCTOR_KYC", f"Rejected KYC for Dr. {doc_profile.user.username}. Reason: {reason}", request)
            return Response({"message": f"Dr. {doc_profile.user.username} rejected.", "doctor": DoctorProfileSerializer(doc_profile).data})
        
        elif action == 'pending':
            doc_profile.verification_status = 'pending'
            doc_profile.rejection_reason = None
            doc_profile.save()
            write_audit_log(request.user, "RESET_DOCTOR_KYC", f"Reset KYC to pending for Dr. {doc_profile.user.username}", request)
            return Response({"message": f"Dr. {doc_profile.user.username} status set to pending.", "doctor": DoctorProfileSerializer(doc_profile).data})
        
        elif action in ['deactivate', 'suspend']:
            user = doc_profile.user
            user.is_active = False
            user.save()
            doc_profile.online = False
            doc_profile.save()
            write_audit_log(request.user, "DEACTIVATE_DOCTOR", f"Suspended/Deactivated Doctor account: Dr. {user.username}", request)
            return Response({"message": f"Dr. {user.username} account suspended successfully.", "doctor": DoctorProfileSerializer(doc_profile).data})
        
        elif action in ['activate', 'unsuspend']:
            user = doc_profile.user
            user.is_active = True
            user.save()
            write_audit_log(request.user, "ACTIVATE_DOCTOR", f"Activated Doctor account: Dr. {user.username}", request)
            return Response({"message": f"Dr. {user.username} account activated successfully.", "doctor": DoctorProfileSerializer(doc_profile).data})
        
        elif action == 'delete':
            user = doc_profile.user
            username = user.username
            user.delete()
            write_audit_log(request.user, "ADMIN_DELETE_DOCTOR", f"Admin deleted doctor account: Dr. {username}", request)
            return Response({"message": f"Dr. {username} removed successfully."})
        
        else:
            return Response({"error": "Invalid action. Use 'approve', 'reject', 'pending', 'deactivate', 'activate', 'suspend', 'unsuspend', or 'delete'."}, status=status.HTTP_400_BAD_REQUEST)

    def put(self, request, pk):
        if request.user.role != 'admin' and not request.user.is_staff and not request.user.is_superuser:
            raise PermissionDenied("Admin access required to edit doctor profiles.")
        
        doc_profile = DoctorProfile.objects.filter(Q(pk=pk) | Q(user__id=pk)).first()
        if not doc_profile:
            return Response({"error": "Doctor profile not found"}, status=status.HTTP_404_NOT_FOUND)

        data = request.data
        user = doc_profile.user

        # Update User fields if provided
        if 'first_name' in data:
            user.first_name = data['first_name']
        if 'last_name' in data:
            user.last_name = data['last_name']
        if 'email' in data:
            user.email = data['email']
        if 'phone' in data:
            user.phone = data['phone']
        if 'bmdc_reg' in data:
            user.bmdc_reg = data['bmdc_reg']
        if 'is_active' in data:
            user.is_active = bool(data['is_active'])
            if not user.is_active:
                doc_profile.online = False
        user.save()

        # Update DoctorProfile fields
        if 'specialty' in data:
            doc_profile.specialty = data['specialty']
        if 'hospital' in data:
            doc_profile.hospital = data['hospital']
        if 'fees' in data and data['fees'] is not None:
            try:
                doc_profile.fees = int(data['fees'])
            except (ValueError, TypeError):
                pass
        if 'experience' in data:
            try:
                doc_profile.experience = int(data['experience'])
            except (ValueError, TypeError):
                pass
        if 'bio' in data:
            doc_profile.bio = data['bio']
        if 'verification_status' in data:
            doc_profile.verification_status = data['verification_status']
        doc_profile.save()

        write_audit_log(request.user, "ADMIN_UPDATE_DOCTOR", f"Admin updated Doctor profile: Dr. {user.username}", request)
        return Response({
            "message": f"Doctor Dr. {user.username} updated successfully.",
            "doctor": DoctorProfileSerializer(doc_profile).data
        })

    def delete(self, request, pk):
        if request.user.role != 'admin' and not request.user.is_staff and not request.user.is_superuser:
            raise PermissionDenied("Admin access required to delete doctor accounts.")
        
        doc_profile = DoctorProfile.objects.filter(Q(pk=pk) | Q(user__id=pk)).first()
        if not doc_profile:
            return Response({"error": "Doctor profile not found"}, status=status.HTTP_404_NOT_FOUND)
        
        user = doc_profile.user
        username = user.username
        user.delete()
        write_audit_log(request.user, "ADMIN_DELETE_DOCTOR", f"Admin removed doctor account: Dr. {username}", request)
        return Response({"message": f"Dr. {username} removed successfully."})

class AdminStaffManagementView(APIView):
    permission_classes = [IsAdminUserRole]

    def get(self, request):
        if request.user.role != 'admin' and not request.user.is_staff and not request.user.is_superuser:
            raise PermissionDenied("Admin access required for Staff Management.")

        search_query = request.GET.get('search', '').strip()
        status_filter = request.GET.get('status', '').strip()

        admins = User.objects.filter(Q(role='admin') | Q(is_staff=True) | Q(is_superuser=True))

        if status_filter and status_filter != 'all':
            if status_filter == 'active':
                admins = admins.filter(is_active=True)
            elif status_filter == 'deactivated':
                admins = admins.filter(is_active=False)
            elif status_filter == 'superuser':
                admins = admins.filter(is_superuser=True)

        if search_query:
            admins = admins.filter(
                Q(username__icontains=search_query) |
                Q(first_name__icontains=search_query) |
                Q(last_name__icontains=search_query) |
                Q(email__icontains=search_query) |
                Q(phone__icontains=search_query)
            )

        admins = admins.order_by('-date_joined')
        return Response(UserSerializer(admins, many=True).data)

    def post(self, request):
        if request.user.role != 'admin' and not request.user.is_staff and not request.user.is_superuser:
            raise PermissionDenied("Super Admin access required to create Administrator accounts.")

        data = request.data
        username = data.get('username', '').strip()
        password = data.get('password', '').strip()
        email = data.get('email', '').strip()
        first_name = data.get('first_name', '').strip()
        last_name = data.get('last_name', '').strip()
        phone = data.get('phone', '').strip()
        is_superuser = bool(data.get('is_superuser', False))
        is_staff = bool(data.get('is_staff', True))

        if not username or not password:
            return Response({"error": "Username and password are required."}, status=status.HTTP_400_BAD_REQUEST)

        if len(password) < 6:
            return Response({"error": "Password must be at least 6 characters."}, status=status.HTTP_400_BAD_REQUEST)

        if User.objects.filter(username=username).exists():
            return Response({"error": "A user with this username already exists."}, status=status.HTTP_400_BAD_REQUEST)

        if email and User.objects.filter(email=email).exists():
            return Response({"error": "A user with this email already exists."}, status=status.HTTP_400_BAD_REQUEST)

        admin_user = User.objects.create_user(
            username=username,
            password=password,
            email=email,
            first_name=first_name,
            last_name=last_name,
            phone=phone,
            role='admin',
            is_staff=is_staff,
            is_superuser=is_superuser,
            is_active=True
        )

        role_desc = "Super Admin" if is_superuser else "Administrator"
        write_audit_log(
            request.user, 
            "SUPERADMIN_CREATE_ADMIN", 
            f"Created {role_desc} account: {username} (ID: {admin_user.id})", 
            request
        )

        return Response({
            "message": f"{role_desc} '{username}' created successfully.",
            "admin": UserSerializer(admin_user).data
        }, status=status.HTTP_201_CREATED)

class AdminStaffDetailView(APIView):
    permission_classes = [IsAdminUserRole]

    def get(self, request, pk):
        try:
            admin_user = User.objects.get(pk=pk)
            return Response(UserSerializer(admin_user).data)
        except User.DoesNotExist:
            return Response({"error": "Administrator account not found."}, status=status.HTTP_404_NOT_FOUND)

    def put(self, request, pk):
        try:
            admin_user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({"error": "Administrator account not found."}, status=status.HTTP_404_NOT_FOUND)

        data = request.data

        # Update basic info
        if 'first_name' in data:
            admin_user.first_name = data['first_name']
        if 'last_name' in data:
            admin_user.last_name = data['last_name']
        if 'email' in data:
            email_val = data['email'].strip()
            if email_val and email_val != admin_user.email and User.objects.filter(email=email_val).exclude(pk=pk).exists():
                return Response({"error": "Another account already uses this email."}, status=status.HTTP_400_BAD_REQUEST)
            admin_user.email = email_val
        if 'phone' in data:
            admin_user.phone = data['phone']

        # Update active state with self-deactivation protection
        if 'is_active' in data:
            new_active = bool(data['is_active'])
            if not new_active and admin_user.id == request.user.id:
                return Response({"error": "You cannot deactivate your own administrative account."}, status=status.HTTP_400_BAD_REQUEST)
            admin_user.is_active = new_active

        # Update superuser status
        if 'is_superuser' in data:
            new_su = bool(data['is_superuser'])
            if not new_su and admin_user.id == request.user.id:
                # Check if other superusers exist
                if User.objects.filter(is_superuser=True, is_active=True).exclude(pk=pk).count() == 0:
                    return Response({"error": "Cannot demote the sole active Super Administrator."}, status=status.HTTP_400_BAD_REQUEST)
            admin_user.is_superuser = new_su

        # Update staff status
        if 'is_staff' in data:
            admin_user.is_staff = bool(data['is_staff'])

        # Optional password update
        if data.get('password'):
            pass_val = data['password'].strip()
            if len(pass_val) < 6:
                return Response({"error": "Password must be at least 6 characters."}, status=status.HTTP_400_BAD_REQUEST)
            admin_user.set_password(pass_val)

        admin_user.save()

        write_audit_log(
            request.user, 
            "SUPERADMIN_UPDATE_ADMIN", 
            f"Updated administrator profile: {admin_user.username}", 
            request
        )

        return Response({
            "message": f"Administrator '{admin_user.username}' updated successfully.",
            "admin": UserSerializer(admin_user).data
        })

    def post(self, request, pk):
        try:
            admin_user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({"error": "Administrator account not found."}, status=status.HTTP_404_NOT_FOUND)

        action = request.data.get('action') # 'activate', 'deactivate', 'delete', 'reset_password'

        if action == 'activate':
            admin_user.is_active = True
            admin_user.save()
            write_audit_log(request.user, "ADMIN_ACTIVATE_STAFF", f"Activated admin account: {admin_user.username}", request)
            return Response({"message": f"Admin '{admin_user.username}' activated successfully.", "admin": UserSerializer(admin_user).data})

        elif action in ['deactivate', 'suspend']:
            if admin_user.id == request.user.id:
                return Response({"error": "You cannot deactivate your own administrative account."}, status=status.HTTP_400_BAD_REQUEST)
            admin_user.is_active = False
            admin_user.save()
            write_audit_log(request.user, "ADMIN_DEACTIVATE_STAFF", f"Deactivated admin account: {admin_user.username}", request)
            return Response({"message": f"Admin '{admin_user.username}' deactivated.", "admin": UserSerializer(admin_user).data})

        elif action == 'delete':
            if admin_user.id == request.user.id:
                return Response({"error": "You cannot delete your own administrative account."}, status=status.HTTP_400_BAD_REQUEST)
            if admin_user.is_superuser and User.objects.filter(is_superuser=True, is_active=True).exclude(pk=pk).count() == 0:
                return Response({"error": "Cannot delete the sole active Super Administrator."}, status=status.HTTP_400_BAD_REQUEST)
            username = admin_user.username
            admin_user.delete()
            write_audit_log(request.user, "SUPERADMIN_DELETE_ADMIN", f"Deleted administrator account: {username}", request)
            return Response({"message": f"Administrator '{username}' removed successfully."})

        elif action == 'reset_password':
            new_password = request.data.get('new_password', '').strip()
            if not new_password or len(new_password) < 6:
                return Response({"error": "New password must be at least 6 characters."}, status=status.HTTP_400_BAD_REQUEST)
            admin_user.set_password(new_password)
            admin_user.save()
            write_audit_log(request.user, "SUPERADMIN_RESET_ADMIN_PASSWORD", f"Reset password for admin: {admin_user.username}", request)
            return Response({"message": f"Password reset for '{admin_user.username}' successfully."})

        else:
            return Response({"error": "Invalid action. Use 'activate', 'deactivate', 'delete', or 'reset_password'."}, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        try:
            admin_user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({"error": "Administrator account not found."}, status=status.HTTP_404_NOT_FOUND)

        if admin_user.id == request.user.id:
            return Response({"error": "You cannot delete your own administrative account."}, status=status.HTTP_400_BAD_REQUEST)

        if admin_user.is_superuser and User.objects.filter(is_superuser=True, is_active=True).exclude(pk=pk).count() == 0:
            return Response({"error": "Cannot delete the sole active Super Administrator."}, status=status.HTTP_400_BAD_REQUEST)

        username = admin_user.username
        admin_user.delete()
        write_audit_log(request.user, "SUPERADMIN_DELETE_ADMIN", f"Deleted administrator account: {username}", request)
        return Response({"message": f"Administrator '{username}' removed successfully."})

class SecureLoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')
        
        ip_addr = request.META.get('HTTP_X_FORWARDED_FOR', request.META.get('REMOTE_ADDR', '127.0.0.1')).split(',')[0]

        if not username or not password:
            return Response({"error": "Username and password are required."}, status=status.HTTP_400_BAD_REQUEST)

        # Brute Force Protection check
        attempt, _ = LoginAttempt.objects.get_or_create(username=username, defaults={'ip_address': ip_addr})
        if attempt.locked_until and attempt.locked_until > timezone.now():
            seconds_left = int((attempt.locked_until - timezone.now()).total_seconds())
            return Response({
                "error": f"Account locked due to consecutive failed attempts. Please retry in {seconds_left} seconds."
            }, status=status.HTTP_429_TOO_MANY_REQUESTS)

        # Check if account exists and is deactivated/suspended before authentication fails obscurely
        target_user = User.objects.filter(Q(username__iexact=username) | Q(email__iexact=username)).first()
        if target_user and target_user.check_password(password) and not target_user.is_active:
            write_audit_log(target_user, "SUSPENDED_LOGIN_ATTEMPT", f"Suspended account '{username}' attempted login.", request)
            return Response({
                "error": "Account suspended: Your account has been deactivated by administration. Please contact support."
            }, status=status.HTTP_403_FORBIDDEN)

        user = authenticate(username=username, password=password)

        if not user:
            # Increment failed attempts
            attempt.failed_count += 1
            if attempt.failed_count >= 5:
                attempt.locked_until = timezone.now() + timezone.timedelta(minutes=15)
                write_audit_log(None, "BRUTE_FORCE_LOCKOUT", f"Account {username} locked out after 5 failed attempts from IP {ip_addr}", request)
            attempt.save()
            write_audit_log(None, "LOGIN_FAILED", f"Failed login for {username}", request)
            return Response({"error": "Invalid username or password."}, status=status.HTTP_401_UNAUTHORIZED)

        # Server-side Role Resolution: Verify requested role matches actual database role
        requested_role = request.data.get('role')
        if requested_role:
            requested_role = str(requested_role).lower().strip()
            user_role = getattr(user, 'role', 'patient')
            if requested_role in ['admin', 'superadmin'] and not (user_role == 'admin' or user.is_staff or user.is_superuser):
                write_audit_log(user, "UNAUTHORIZED_ADMIN_LOGIN_ATTEMPT", f"User {username} attempted unauthorized login with role: {requested_role}", request)
                return Response({"error": "Authentication failed: Account does not have administrative privileges."}, status=status.HTTP_403_FORBIDDEN)
            elif requested_role == 'doctor' and user_role != 'doctor':
                return Response({"error": "Authentication failed: Account is not registered as a Doctor."}, status=status.HTTP_403_FORBIDDEN)
            elif requested_role == 'patient' and user_role != 'patient':
                return Response({"error": "Authentication failed: Account is not registered as a Patient."}, status=status.HTTP_403_FORBIDDEN)

        # Login successful! Reset failed counter
        attempt.failed_count = 0
        attempt.locked_until = None
        attempt.save()

        # Generate MFA 6-digit OTP code stored server-side
        otp_val = str(random.randint(100000, 999999))
        otp_hash = hashlib.sha256(otp_val.encode('utf-8')).hexdigest()
        expiry = timezone.now() + timezone.timedelta(minutes=5)

        # Invalidate old OTPs for user
        OTPCode.objects.filter(user=user, purpose='mfa', is_used=False).update(is_used=True)

        OTPCode.objects.create(
            user=user,
            code_hash=otp_hash,
            purpose='mfa',
            expiry_time=expiry,
            retry_attempts=0
        )

        print("\n========================================================")
        print(f"SERVER-SIDE MFA OTP GENERATED FOR USER: {user.username}")
        print(f"6-DIGIT OTP CODE: {otp_val} (Valid for 5 minutes)")
        print("========================================================\n")

        write_audit_log(user, "MFA_CHALLENGE_ISSUED", f"Server-side MFA OTP dispatched for {user.username}", request)

        return Response({
            "mfa_required": True,
            "username": user.username,
            "message": "Authentication successful. Please enter the 6-digit MFA OTP sent to your registered device/console."
        }, status=status.HTTP_200_OK)

class MFAVerifyView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        username = request.data.get('username')
        otp_code = request.data.get('otp_code')

        if not username or not otp_code:
            return Response({"error": "Username and MFA OTP code are required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            return Response({"error": "Invalid MFA session request."}, status=status.HTTP_400_BAD_REQUEST)

        if not user.is_active:
            return Response({"error": "Account suspended: Your account has been deactivated by administration."}, status=status.HTTP_403_FORBIDDEN)

        otp_record = OTPCode.objects.filter(user=user, purpose='mfa', is_used=False).order_by('-created_at').first()

        if not otp_record:
            return Response({"error": "No active MFA session found. Please login again."}, status=status.HTTP_400_BAD_REQUEST)

        if otp_record.expiry_time < timezone.now():
            return Response({"error": "MFA OTP has expired (5 minute limit). Please login again."}, status=status.HTTP_400_BAD_REQUEST)

        if otp_record.retry_attempts >= 3:
            otp_record.is_used = True
            otp_record.save()
            return Response({"error": "Too many failed OTP attempts. MFA session locked. Please login again."}, status=status.HTTP_400_BAD_REQUEST)

        computed_hash = hashlib.sha256(otp_code.encode('utf-8')).hexdigest()

        if computed_hash != otp_record.code_hash:
            otp_record.retry_attempts += 1
            otp_record.save()
            remaining = 3 - otp_record.retry_attempts
            return Response({"error": f"Invalid OTP code. {remaining} attempts remaining."}, status=status.HTTP_400_BAD_REQUEST)

        # Successful MFA verification! Mark OTP as used and issue JWT tokens
        otp_record.is_used = True
        otp_record.save()

        refresh = RefreshToken.for_user(user)
        
        write_audit_log(user, "LOGIN_SUCCESS_MFA", f"User {user.username} successfully authenticated with Server-Side MFA.", request)

        return Response({
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "user": UserSerializer(user).data
        }, status=status.HTTP_200_OK)

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
        
        data = AppointmentSerializer(appts, many=True).data

        # Anonymous Consultation identity masking for doctors
        if user.role == 'doctor':
            for item in data:
                if item.get('is_anonymous'):
                    item['patient_details'] = {
                        "id": item['patient'],
                        "username": f"Anonymous Patient #{item['patient']}",
                        "first_name": "Anonymous",
                        "last_name": f"Patient #{item['patient']}",
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
            return Response({"error": "Selected physician is currently suspended or inactive and cannot accept appointments."}, status=status.HTTP_400_BAD_REQUEST)

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

        serializer = AppointmentSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        appt = serializer.save()

        is_anon = data.get('is_anonymous', False)
        if is_anon:
            appt.is_anonymous = True
            appt.save()

        # Create linked Consultation entry
        Consultation.objects.create(
            appointment=appt,
            type=request.data.get('consultation_type', 'chat'),
            status='pending',
            is_anonymous=is_anon
        )

        write_audit_log(user, "BOOK_APPOINTMENT", f"Patient booked appointment ID: {appt.id} (Anonymous: {is_anon})", request)
        return Response(AppointmentSerializer(appt).data, status=status.HTTP_201_CREATED)

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

            # 1. Verify appointment relationship
            has_appt = Appointment.objects.filter(
                doctor=user, 
                patient=patient_user, 
                status__in=['approved', 'completed']
            ).exists()

            # 2. Check active consent delegation
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
        record.set_content(raw_data)
        record.save()

        # Commit cryptographic hash proof to Blockchain
        blockchain_service.commit_record("health_record", record.id, {"patient_id": user.id, "type": record_type})

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
        medicines = request.data.get('medicines')
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

        # Commit hash proof to Blockchain
        blockchain_service.commit_record("prescription", prescription.id, {
            "doctor": user.username,
            "patient": consult.appointment.patient.username,
            "diagnosis": diagnosis
        })

        write_audit_log(user, "WRITE_PRESCRIPTION", f"Doctor wrote prescription ID: {prescription.id} for Patient ID: {prescription.patient_id}", request)
        return Response(PrescriptionSerializer(prescription).data, status=status.HTTP_201_CREATED)

class PrescriptionShareView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        user = request.user
        try:
            prescription = Prescription.objects.get(pk=pk)
        except Prescription.DoesNotExist:
            return Response({"error": "Prescription not found"}, status=status.HTTP_404_NOT_FOUND)

        # Ensure patient or assigned doctor is sharing
        if prescription.patient != user and prescription.doctor != user and user.role != 'admin':
            raise PermissionDenied("Unauthorized to share this prescription.")

        if not prescription.share_token:
            prescription.share_token = f"RX-{uuid.uuid4().hex[:16]}"
            prescription.shared_at = timezone.now()
            prescription.save()

        share_url = f"http://localhost:3000/?rx_token={prescription.share_token}"
        write_audit_log(user, "SHARE_PRESCRIPTION", f"Generated secure share link for Prescription ID: {pk}", request)

        return Response({
            "share_token": prescription.share_token,
            "share_url": share_url,
            "message": "Secure tokenized prescription share link generated."
        })

class SharedPrescriptionView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, token):
        try:
            prescription = Prescription.objects.get(share_token=token)
        except Prescription.DoesNotExist:
            return Response({"error": "Invalid or expired prescription share token."}, status=status.HTTP_404_NOT_FOUND)

        return Response(PrescriptionSerializer(prescription).data)

class MedicineListView(generics.ListAPIView):
    queryset = Medicine.objects.all()
    serializer_class = MedicineSerializer
    permission_classes = [permissions.AllowAny]

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
        items = request.data.get('items', []) # Expected list: [{medicine_id, quantity}]

        try:
            prescription = Prescription.objects.get(id=prescription_id, patient=user) if prescription_id else None
        except Prescription.DoesNotExist:
            prescription = None

        # Server-Side Recalculation of Order Total Cost to Prevent Price Tampering
        items_breakdown = []
        subtotal = 0.0

        if items:
            for item in items:
                m_id = item.get('medicine_id')
                qty = int(item.get('quantity', 1))
                try:
                    med = Medicine.objects.get(id=m_id)
                    item_cost = float(med.price) * qty
                    subtotal += item_cost
                    items_breakdown.append({
                        "medicine_id": med.id,
                        "name": med.name,
                        "price": float(med.price),
                        "quantity": qty
                    })
                except Medicine.DoesNotExist:
                    pass
        else:
            # Default fallback for simple order
            subtotal = 200.0
            items_breakdown = [{"medicine_id": 1, "name": "Prescribed Medication Pack", "price": 200.0, "quantity": 1}]

        delivery_fee = 50.0
        final_total = subtotal + delivery_fee

        order = MedicineOrder.objects.create(
            patient=user,
            prescription=prescription,
            delivery_address=address or "Patient Primary Address",
            items_breakdown=items_breakdown,
            delivery_fee=delivery_fee,
            total_price=final_total,
            status='pending'
        )

        write_audit_log(user, "PLACE_MEDICINE_ORDER", f"Patient placed medicine order ID: {order.id}. Total calculated: BDT {final_total}", request)
        return Response(MedicineOrderSerializer(order).data, status=status.HTTP_201_CREATED)

    def put(self, request, pk):
        user = request.user
        try:
            order = MedicineOrder.objects.get(pk=pk)
        except MedicineOrder.DoesNotExist:
            return Response({"error": "Order details not found"}, status=status.HTTP_404_NOT_FOUND)

        if user.role != 'admin':
            raise PermissionDenied("Only administrative accounts can update delivery transit states.")

        status_val = request.data.get('status') # 'confirmed', 'packing', 'shipping', 'out_for_delivery', 'delivered', 'cancelled'
        if status_val in ['pending', 'confirmed', 'packing', 'shipping', 'out_for_delivery', 'delivered', 'cancelled']:
            order.status = status_val
            order.save()
            write_audit_log(user, "UPDATE_ORDER_STATUS", f"Admin updated order ID: {order.id} to {status_val}", request)
            return Response(MedicineOrderSerializer(order).data)
        
        return Response({"error": "Invalid order status value"}, status=status.HTTP_400_BAD_REQUEST)

class PaymentInitiateView(APIView):
    """
    POST /api/payment/initiate/
    Initiates an authoritative payment transaction for an Appointment or MedicineOrder.
    Calculates the exact amount server-side (never trusts client amount values).
    Dispatches to SSLCommerz V4 API and returns the official gateway hosted checkout URL.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        appointment_id = request.data.get('appointment_id')
        order_id = request.data.get('order_id')
        payment_method = request.data.get('method') or request.data.get('payment_method') or 'sslcommerz'

        if not appointment_id and not order_id:
            return Response(
                {"error": "Either appointment_id or order_id must be provided to initiate payment."},
                status=status.HTTP_400_BAD_REQUEST
            )

        appointment = None
        order = None
        authoritative_amount = Decimal("0.00")
        service_type = "consultation"
        reference_id = None

        if appointment_id:
            try:
                appointment = Appointment.objects.select_related('doctor', 'doctor__doctor_profile').get(
                    id=appointment_id, patient=user
                )
            except Appointment.DoesNotExist:
                return Response({"error": "Appointment not found or unauthorized."}, status=status.HTTP_404_NOT_FOUND)

            # Prevent duplicate payment for already paid appointments
            if appointment.payment_status == 'paid':
                return Response(
                    {"error": "This appointment has already been paid and confirmed."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Authoritative doctor consultation fee
            doc_prof = getattr(appointment.doctor, 'doctor_profile', None)
            authoritative_amount = doc_prof.fees if (doc_prof and doc_prof.fees) else Decimal("500.00")
            service_type = "consultation"
            reference_id = str(appointment.id)

        elif order_id:
            try:
                order = MedicineOrder.objects.get(id=order_id, patient=user)
            except MedicineOrder.DoesNotExist:
                return Response({"error": "Medicine order not found or unauthorized."}, status=status.HTTP_404_NOT_FOUND)

            if order.status in ('confirmed', 'shipping', 'delivered'):
                return Response(
                    {"error": "This order has already been paid and confirmed."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            authoritative_amount = Decimal(str(order.total_price))
            service_type = "pharmacy"
            reference_id = str(order.id)

        # Generate unique transaction reference
        txn_ref = payment_service.generate_transaction_ref(prefix="SSL")

        # Pre-create transaction in database with pending status
        txn = PaymentTransaction.objects.create(
            user=user,
            appointment=appointment,
            order=order,
            transaction_ref=txn_ref,
            payment_method=payment_method,
            gateway='sslcommerz',
            amount=authoritative_amount,
            currency='BDT',
            status='pending'
        )

        if appointment:
            appointment.payment_status = 'pending'
            appointment.save()

        # Customer information payload
        customer_info = {
            "name": f"{user.first_name} {user.last_name}".strip() or user.username,
            "email": user.email or f"{user.username}@healnsight.com.bd",
            "phone": user.phone or "+8801700000000",
            "address": getattr(user, 'patient_profile', None).address if hasattr(user, 'patient_profile') and user.patient_profile.address else "Dhaka, Bangladesh"
        }

        # Dispatch initiation to SSLCommerz service
        gateway_res = payment_service.initiate_transaction(
            amount=float(authoritative_amount),
            transaction_ref=txn_ref,
            customer_info=customer_info,
            service_type=service_type,
            reference_id=reference_id
        )

        if not gateway_res.get("success"):
            txn.status = 'failed'
            txn.failure_reason = gateway_res.get("error", "Gateway initiation rejected.")
            txn.save()
            return Response({"success": False, "error": txn.failure_reason}, status=status.HTTP_400_BAD_REQUEST)

        write_audit_log(
            user,
            "PAYMENT_INITIATED",
            f"Payment initiated for {service_type.upper()} #{reference_id}. Txn Ref: {txn_ref} ({authoritative_amount} BDT)",
            request
        )

        return Response({
            "success": True,
            "mode": gateway_res.get("mode", "sandbox"),
            "transaction_ref": txn_ref,
            "amount": float(authoritative_amount),
            "currency": "BDT",
            "gateway_url": gateway_res.get("gateway_url"),
            "session_key": gateway_res.get("session_key"),
            "is_simulated": gateway_res.get("is_simulated", False),
            "message": gateway_res.get("message", "Payment session generated.")
        })


class PaymentCallbackView(APIView):
    """
    POST/GET /api/payment/callback/
    Receives user browser redirects and POST callbacks from SSLCommerz.
    Executes authoritative server-side Order Validation API check.
    Guarantees idempotency and redirects user back to frontend with verified state.
    """
    permission_classes = [permissions.AllowAny]

    def _process_callback(self, request):
        data = request.data if request.data else request.POST
        tran_id = (
            data.get('tran_id') or 
            request.query_params.get('tran_id') or 
            data.get('transaction_ref') or
            request.query_params.get('transaction_ref')
        )
        val_id = data.get('val_id') or request.query_params.get('val_id')
        callback_status = (
            request.query_params.get('status') or 
            data.get('status', '')
        ).lower()

        frontend_base = payment_service.frontend_base_url

        if not tran_id:
            redirect_url = f"{frontend_base}/?payment_status=failed&error=missing_transaction_ref"
            if request.accepted_renderer.format == 'json' or request.headers.get('Accept') == 'application/json':
                return Response({"error": "Missing transaction reference in callback."}, status=status.HTTP_400_BAD_REQUEST)
            return redirect(redirect_url)

        try:
            txn = PaymentTransaction.objects.select_related('appointment', 'order', 'user').get(transaction_ref=tran_id)
        except PaymentTransaction.DoesNotExist:
            redirect_url = f"{frontend_base}/?payment_status=failed&error=transaction_not_found&txn_ref={tran_id}"
            if request.accepted_renderer.format == 'json' or request.headers.get('Accept') == 'application/json':
                return Response({"error": f"Transaction '{tran_id}' not found."}, status=status.HTTP_404_NOT_FOUND)
            return redirect(redirect_url)

        # 1. User Cancelled Payment
        if callback_status in ('cancel', 'cancelled'):
            if txn.status not in ('completed', 'cancelled'):
                txn.status = 'cancelled'
                txn.failure_reason = 'Payment was cancelled by the customer on the gateway.'
                txn.save()
                write_audit_log(txn.user, "PAYMENT_CANCELLED", f"Txn {tran_id} cancelled by user.", request)
            
            redirect_url = f"{frontend_base}/?payment_status=cancelled&txn_ref={tran_id}"
            if request.accepted_renderer.format == 'json' or request.headers.get('Accept') == 'application/json':
                return Response({"status": "cancelled", "transaction_ref": tran_id})
            return redirect(redirect_url)

        # 2. Gateway Reported Failure
        if callback_status in ('fail', 'failed'):
            if txn.status not in ('completed', 'failed'):
                txn.status = 'failed'
                txn.failure_reason = data.get('error') or data.get('failedreason') or 'Gateway reported transaction failure.'
                txn.save()
                write_audit_log(txn.user, "PAYMENT_FAILED", f"Txn {tran_id} failed: {txn.failure_reason}", request)

            redirect_url = f"{frontend_base}/?payment_status=failed&txn_ref={tran_id}"
            if request.accepted_renderer.format == 'json' or request.headers.get('Accept') == 'application/json':
                return Response({"status": "failed", "transaction_ref": tran_id})
            return redirect(redirect_url)

        # 3. Gateway Reported Success - Must Validate Server-to-Server!
        # Idempotency check: If already marked completed, do not duplicate actions
        if txn.status == 'completed':
            redirect_url = f"{frontend_base}/?payment_status=success&txn_ref={tran_id}"
            if request.accepted_renderer.format == 'json' or request.headers.get('Accept') == 'application/json':
                return Response({"status": "completed", "transaction_ref": tran_id, "idempotent": True})
            return redirect(redirect_url)

        if not val_id:
            val_id = data.get('val_id')

        # Execute Order Validation API check
        val_res = payment_service.validate_transaction(
            val_id=val_id,
            expected_txn_ref=txn.transaction_ref,
            expected_amount=float(txn.amount)
        )

        if val_res.get("is_valid"):
            txn.status = 'completed'
            txn.val_id = val_res.get("val_id") or val_id
            txn.bank_tran_id = val_res.get("bank_tran_id")
            txn.card_type = val_res.get("card_type")
            txn.card_brand = val_res.get("card_brand")
            txn.gateway_response = val_res.get("gateway_response", {})
            txn.failure_reason = None
            txn.save()

            # Update linked Appointment
            if txn.appointment:
                txn.appointment.payment_status = 'paid'
                txn.appointment.status = 'approved'
                txn.appointment.save()

            # Update linked MedicineOrder
            if txn.order:
                txn.order.status = 'confirmed'
                txn.order.save()

            write_audit_log(
                txn.user,
                "PAYMENT_SUCCESS",
                f"Payment verified for Txn {tran_id}. Amount: {txn.amount} BDT. Val ID: {txn.val_id}",
                request
            )

            redirect_url = f"{frontend_base}/?payment_status=success&txn_ref={tran_id}"
            if request.accepted_renderer.format == 'json' or request.headers.get('Accept') == 'application/json':
                return Response({"status": "completed", "transaction_ref": tran_id, "verified": True})
            return redirect(redirect_url)
        else:
            txn.status = 'failed'
            txn.failure_reason = val_res.get("message", "Server-side order validation failed.")
            txn.save()

            write_audit_log(
                txn.user,
                "PAYMENT_FAILED",
                f"Validation failed for Txn {tran_id}: {txn.failure_reason}",
                request
            )

            redirect_url = f"{frontend_base}/?payment_status=failed&txn_ref={tran_id}&reason=validation_failed"
            if request.accepted_renderer.format == 'json' or request.headers.get('Accept') == 'application/json':
                return Response({"status": "failed", "transaction_ref": tran_id, "error": txn.failure_reason}, status=status.HTTP_400_BAD_REQUEST)
            return redirect(redirect_url)

    def post(self, request):
        return self._process_callback(request)

    def get(self, request):
        return self._process_callback(request)


class PaymentIPNView(APIView):
    """
    POST /api/payment/ipn/
    Official SSLCommerz Instant Payment Notification (IPN) server-to-server webhook.
    Validates transaction asynchronously and idempotently updates database state.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        data = request.data if request.data else request.POST
        tran_id = data.get('tran_id') or request.query_params.get('tran_id')
        val_id = data.get('val_id') or request.query_params.get('val_id')

        if not tran_id or not val_id:
            return Response({"error": "IPN requires tran_id and val_id."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            txn = PaymentTransaction.objects.select_related('appointment', 'order', 'user').get(transaction_ref=tran_id)
        except PaymentTransaction.DoesNotExist:
            return Response({"error": f"Transaction '{tran_id}' not found."}, status=status.HTTP_404_NOT_FOUND)

        # Idempotency check: if already completed, acknowledge IPN without duplicating actions
        if txn.status == 'completed':
            return Response({"status": "IPN_ACKNOWLEDGED", "message": "Transaction is already completed."})

        # Validate with SSLCommerz Order Validation API
        val_res = payment_service.validate_transaction(
            val_id=val_id,
            expected_txn_ref=txn.transaction_ref,
            expected_amount=float(txn.amount)
        )

        if val_res.get("is_valid"):
            txn.status = 'completed'
            txn.val_id = val_res.get("val_id") or val_id
            txn.bank_tran_id = val_res.get("bank_tran_id")
            txn.card_type = val_res.get("card_type")
            txn.card_brand = val_res.get("card_brand")
            txn.gateway_response = val_res.get("gateway_response", {})
            txn.save()

            if txn.appointment:
                txn.appointment.payment_status = 'paid'
                txn.appointment.status = 'approved'
                txn.appointment.save()

            if txn.order:
                txn.order.status = 'confirmed'
                txn.order.save()

            write_audit_log(txn.user, "PAYMENT_IPN_PROCESSED", f"IPN validated Txn {tran_id}", request)
            return Response({"status": "IPN_SUCCESS", "transaction_ref": tran_id})
        else:
            txn.status = 'failed'
            txn.failure_reason = val_res.get("message", "IPN validation failed.")
            txn.save()
            write_audit_log(txn.user, "PAYMENT_IPN_FAILED", f"IPN failed for Txn {tran_id}", request)
            return Response({"status": "IPN_FAILED", "error": txn.failure_reason}, status=status.HTTP_400_BAD_REQUEST)


class PaymentStatusView(APIView):
    """
    GET /api/payment/status/<str:transaction_ref>/
    Returns verified payment transaction state.
    Enforces authorization: only the transaction owner or an administrator may view.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, transaction_ref):
        user = request.user
        try:
            txn = PaymentTransaction.objects.select_related('appointment', 'order', 'user').get(transaction_ref=transaction_ref)
        except PaymentTransaction.DoesNotExist:
            return Response({"error": "Payment transaction not found."}, status=status.HTTP_404_NOT_FOUND)

        # Enforce strict user isolation
        if txn.user and txn.user != user and user.role != 'admin' and not user.is_staff:
            raise PermissionDenied("You do not have permission to inspect this payment transaction.")

        serializer = PaymentTransactionSerializer(txn)
        return Response(serializer.data)


class PaymentHistoryView(APIView):
    """
    GET /api/payment/history/
    Lists payment transactions for the authenticated user with optional status filter.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        status_filter = request.query_params.get('status', 'all').strip().lower()

        if user.role == 'admin':
            queryset = PaymentTransaction.objects.all()
        else:
            queryset = PaymentTransaction.objects.filter(user=user)

        if status_filter != 'all':
            queryset = queryset.filter(status=status_filter)

        queryset = queryset.order_by('-created_at')[:50]
        serializer = PaymentTransactionSerializer(queryset, many=True)
        return Response(serializer.data)

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
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        try:
            consultation = Consultation.objects.select_related(
                'appointment__doctor__doctor_profile', 
                'appointment__patient__patient_profile'
            ).get(pk=pk)
        except Consultation.DoesNotExist:
            return Response({"error": "Consultation not found"}, status=status.HTTP_404_NOT_FOUND)

        appt = consultation.appointment
        user = request.user
        if user != appt.doctor and user != appt.patient and user.role != 'admin':
            raise PermissionDenied("You are not a participant in this consultation.")

        data = {
            "id": consultation.id,
            "type": consultation.type,
            "status": consultation.status,
            "is_anonymous": consultation.is_anonymous,
            "appointment_id": appt.id,
            "appointment_date": str(appt.date),
            "appointment_time": appt.time,
            "doctor": {
                "id": appt.doctor.id,
                "name": f"Dr. {appt.doctor.first_name} {appt.doctor.last_name}".strip() or appt.doctor.username,
                "phone": appt.doctor.phone or "",
                "specialty": getattr(getattr(appt.doctor, 'doctor_profile', None), 'specialty', 'General Physician')
            },
            "patient": {
                "id": appt.patient.id,
                "name": f"{appt.patient.first_name} {appt.patient.last_name}".strip() or appt.patient.username if not consultation.is_anonymous else f"Anonymous Patient #{appt.patient.id}",
                "phone": appt.patient.phone if not consultation.is_anonymous else "",
                "blood_group": getattr(getattr(appt.patient, 'patient_profile', None), 'blood_group', '')
            }
        }
        return Response(data)


class GovNIDVerifyView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        nid = request.data.get('nid')
        dob = request.data.get('dob')
        res = gov_service.verify_nid(nid, dob)
        return Response(res)

class GovBMDCVerifyView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        bmdc = request.data.get('bmdc_reg')
        name = request.data.get('name', '')
        res = gov_service.verify_bmdc_license(bmdc, name)
        return Response(res)

class FileUploadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({"error": "No file uploaded."}, status=status.HTTP_400_BAD_REQUEST)

        res = storage_service.save_file(file_obj, file_obj.name)
        if res.get('success'):
            write_audit_log(request.user, "FILE_UPLOAD", f"Uploaded file: {file_obj.name}", request)
            return Response(res, status=status.HTTP_201_CREATED)
        else:
            return Response(res, status=status.HTTP_400_BAD_REQUEST)

class FileDownloadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, filename):
        file_path = os.path.join(storage_service.local_dir, filename)
        if not os.path.exists(file_path):
            return Response({"error": "File not found or access denied."}, status=status.HTTP_404_NOT_FOUND)

        from django.http import FileResponse
        return FileResponse(open(file_path, 'rb'))

class BlockchainLedgerView(generics.ListAPIView):
    queryset = BlockchainRecord.objects.all().order_by('-block_number')
    serializer_class = BlockchainRecordSerializer
    permission_classes = [IsAdminUserRole]

    def get_queryset(self):
        user = self.request.user
        if not (getattr(user, 'role', None) == 'admin' or user.is_staff or user.is_superuser):
            raise PermissionDenied("Admin access required to view blockchain ledger records.")
        return super().get_queryset()

    def get_serializer_context(self):
        context = super().get_serializer_context()
        # Attach network connection info
        context['blockchain_connected'] = blockchain_service.is_connected()
        context['contract_address'] = blockchain_service.contract_address
        return context

class BlockchainVerifyView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        record_type = request.data.get('record_type')
        record_id = request.data.get('record_id')
        simulate_tampering = request.data.get('simulate_tampering', False)

        if record_type == 'prescription':
            try:
                rx = Prescription.objects.get(id=record_id)
                if simulate_tampering:
                    payload = {"doctor": rx.doctor.username, "patient": rx.patient.username, "diagnosis": "TAMPERED: Patient injected insulin 500U"}
                else:
                    payload = {"doctor": rx.doctor.username, "patient": rx.patient.username, "diagnosis": rx.diagnosis}
            except Prescription.DoesNotExist:
                return Response({"error": "Prescription record not found."}, status=status.HTTP_404_NOT_FOUND)
        else:
            try:
                hr = HealthRecord.objects.get(id=record_id)
                if simulate_tampering:
                    payload = {"patient_id": hr.patient_id, "type": "TAMPERED: HIV positive report"}
                else:
                    payload = {"patient_id": hr.patient_id, "type": hr.record_type}
            except HealthRecord.DoesNotExist:
                return Response({"error": "Health record not found."}, status=status.HTTP_404_NOT_FOUND)

        res = blockchain_service.verify_record_integrity(record_type, int(record_id), payload)
        return Response(res)

class BlockchainTransactionDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, tx_hash):
        if not blockchain_service.is_connected():
            return Response({
                "tx_hash": tx_hash,
                "status": "Sepolia Sim Mode",
                "receipt": {
                    "status": 1,
                    "blockNumber": 987654,
                    "gasUsed": 21000
                }
            })
        try:
            receipt = blockchain_service.w3.eth.get_transaction_receipt(tx_hash)
            return Response({
                "tx_hash": tx_hash,
                "status": "CONFIRMED" if receipt['status'] == 1 else "FAILED",
                "receipt": {
                    "status": receipt['status'],
                    "blockNumber": receipt['blockNumber'],
                    "gasUsed": receipt['gasUsed'],
                    "from": receipt['from'],
                    "to": receipt['to']
                }
            })
        except Exception as e:
            return Response({"error": f"Transaction receipt not found or pending: {str(e)}"}, status=status.HTTP_404_NOT_FOUND)


class AuditLogListView(generics.ListAPIView):
    queryset = AuditLog.objects.all().order_by('-timestamp')
    serializer_class = AuditLogSerializer
    permission_classes = [IsAdminUserRole]

    def get_queryset(self):
        user = self.request.user
        if not (getattr(user, 'role', None) == 'admin' or user.is_staff or user.is_superuser):
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
            reset_link = f"http://localhost:3000/?reset_token={token_str}"

            subject = "Password Reset Request - HealNSight"
            message = f"Hello {user.first_name or user.username},\n\nWe received a request to reset your password. Please use the link below to set a new password. The link is valid for 15 minutes.\n\n{reset_link}\n\nIf you did not request this, please ignore this email.\n\nBest regards,\nHealNsightTeam"

            try:
                if user.email:
                    send_mail(
                        subject,
                        message,
                        settings.DEFAULT_FROM_EMAIL or 'noreply@HealNSight.com',
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

        # Support both 'reset_token' and 'token' parameters consistently
        token = request.data.get('reset_token') or request.data.get('token')
        new_password = request.data.get('new_password')
        confirm_password = request.data.get('confirm_password')

        if not token or not new_password:
            return Response({"error": "Reset token and new password are required."}, status=status.HTTP_400_BAD_REQUEST)

        if confirm_password and new_password != confirm_password:
            return Response({"error": "Passwords do not match."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            uidb64, token_char = token.split('-', 1)
            uid = force_str(urlsafe_base64_decode(uidb64))
            user = User.objects.get(pk=uid)
        except (ValueError, TypeError, OverflowError, User.DoesNotExist):
            return Response({"error": "Invalid or expired password reset token."}, status=status.HTTP_400_BAD_REQUEST)

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


# ==============================================================================
# AI HEALTH ASSISTANT: PRODUCTION SERVER-SIDE SERVICE VIEWS
# ==============================================================================

class AIHealthAssistantRateThrottle(throttling.UserRateThrottle):
    """Protects OpenAI endpoint from abuse with 30 queries per minute per authenticated user."""
    rate = '30/minute'
    scope = 'ai_assistant'


class AIHealthAssistantView(APIView):
    """
    Authenticated endpoint for the AI Health Assistant.
    Securely communicates with the backend AI service (OpenAI SDK).
    The API key remains strictly server-side and is NEVER exposed to the frontend.
    """
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [AIHealthAssistantRateThrottle]

    def post(self, request):
        serializer = AIHealthAssistantRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        message = serializer.validated_data['message']
        conversation_id = serializer.validated_data.get('conversation_id') or None

        # Execute AI service processing
        result = ai_health_assistant_service.process_message(
            user=request.user,
            message=message,
            conversation_id=conversation_id
        )

        if result.get("status_code", 200) != 200:
            return Response(
                {"error": result.get("error", "Failed to process message.")},
                status=result.get("status_code", status.HTTP_500_INTERNAL_SERVER_ERROR)
            )

        # Audit logging (metadata only; never log private medical text into audit logs)
        write_audit_log(
            user=request.user,
            action="AI_HEALTH_ASSISTANT_QUERY",
            details=f"AI query processed. Conversation: {result.get('conversation_id')}, Safety: {result.get('safety_level')}, Provider: {result.get('provider')}",
            request=request
        )

        return Response({
            "response": result["response"],
            "conversation_id": result["conversation_id"],
            "safety_level": result["safety_level"],
            "created_at": result["created_at"]
        }, status=status.HTTP_200_OK)


class AIConversationListView(APIView):
    """
    Retrieves past AI conversation threads for the authenticated user only.
    Prevents cross-patient data access.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        conversations = AIConversation.objects.filter(user=request.user).order_by('-updated_at')
        serializer = AIConversationSerializer(conversations, many=True)
        return Response(serializer.data)


class AIConversationDetailView(APIView):
    """
    Retrieves or deletes a specific conversation and its message history.
    Strictly verifies ownership: one user can never inspect another's conversation.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, conversation_id):
        try:
            conversation = AIConversation.objects.get(
                conversation_id=conversation_id,
                user=request.user
            )
        except AIConversation.DoesNotExist:
            return Response(
                {"error": "Conversation not found or access denied."},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = AIConversationSerializer(conversation)
        return Response(serializer.data)

    def delete(self, request, conversation_id):
        try:
            conversation = AIConversation.objects.get(
                conversation_id=conversation_id,
                user=request.user
            )
            conversation.delete()
            return Response({"message": "Conversation deleted successfully."}, status=status.HTTP_200_OK)
        except AIConversation.DoesNotExist:
            return Response(
                {"error": "Conversation not found or access denied."},
                status=status.HTTP_404_NOT_FOUND
            )

