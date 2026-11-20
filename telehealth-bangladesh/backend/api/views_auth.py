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
            return DoctorProfile.objects.filter(user__role='doctor').select_related('user')
        return DoctorProfile.objects.filter(user__role='doctor', verification_status='approved', user__is_active=True).select_related('user')

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
        specialty = data.get('specialty', 'General Doctor')
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
                "error": f"Account locked due to consecutive failed . Please retry in {seconds_left} seconds."
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
            # Increment failed 
            attempt.failed_count += 1
            if attempt.failed_count >= 5:
                attempt.locked_until = timezone.now() + timezone.timedelta(minutes=15)
                write_audit_log(None, "BRUTE_FORCE_LOCKOUT", f"Account {username} locked out after 5 failed  from IP {ip_addr}", request)
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
            return Response({"error": "Too many failed OTP . MFA session locked. Please login again."}, status=status.HTTP_400_BAD_REQUEST)

        computed_hash = hashlib.sha256(otp_code.encode('utf-8')).hexdigest()

        if computed_hash != otp_record.code_hash:
            otp_record.retry_attempts += 1
            otp_record.save()
            remaining = 3 - otp_record.retry_attempts
            return Response({"error": f"Invalid OTP code. {remaining}  remaining."}, status=status.HTTP_400_BAD_REQUEST)

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

class ChangePasswordView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        current_password = request.data.get('current_password') or request.data.get('current')
        new_password = request.data.get('new_password') or request.data.get('new')
        confirm_password = request.data.get('confirm_password') or request.data.get('confirm')

        if not current_password or not new_password:
            return Response({"error": "Current password and new password are required."}, status=status.HTTP_400_BAD_REQUEST)

        if not user.check_password(current_password):
            return Response({"error": "Current password is incorrect."}, status=status.HTTP_400_BAD_REQUEST)

        if confirm_password and new_password != confirm_password:
            return Response({"error": "New passwords do not match."}, status=status.HTTP_400_BAD_REQUEST)

        if len(new_password) < 6:
            return Response({"error": "New password must be at least 6 characters long."}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        user.save()

        # Keep Node backend SQLite Users table in sync if present
        try:
            import sqlite3
            import bcrypt
            from pathlib import Path
            node_db_path = Path(__file__).resolve().parent.parent.parent / "node-backend" / "src" / "config" / "database.sqlite"
            if node_db_path.exists():
                hashed = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
                conn = sqlite3.connect(str(node_db_path))
                cursor = conn.cursor()
                cursor.execute("UPDATE Users SET password = ? WHERE username = ? OR email = ?", (hashed, user.username, user.email))
                conn.commit()
                conn.close()
        except Exception as e:
            print(f"Node DB password sync note: {e}")

        write_audit_log(user, "PASSWORD_CHANGED", f"User {user.username} successfully rotated account password.", request)

        return Response({"message": "Password changed successfully."}, status=status.HTTP_200_OK)

class PatientImageProfileViewSet(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        patient_id = request.query_params.get('patient_id')

        if user.role == 'patient':
            # Patients can strictly ONLY view their own image profiles
            profiles = PatientImageProfile.objects.filter(patient=user).order_by('-created_at')
        elif user.role == 'doctor':
            if not patient_id:
                raise PermissionDenied("Clinical patient_id parameter is required for doctor access.")
            try:
                target_patient = User.objects.get(id=patient_id, role='patient')
            except User.DoesNotExist:
                return Response({"error": "Patient not found"}, status=status.HTTP_404_NOT_FOUND)

            # Enforce active clinical relationship: approved/completed appointment or active consent
            has_appt = Appointment.objects.filter(
                doctor=user, 
                patient=target_patient, 
                status__in=['approved', 'completed']
            ).exists()
            has_consent = Consent.objects.filter(
                patient=target_patient, 
                doctor=user, 
                granted=True, 
                expires_at__gt=timezone.now()
            ).exists()

            if not has_appt and not has_consent:
                write_audit_log(user, "BLOCK_IMAGE_ACCESS", f"Doctor blocked from accessing patient images #{patient_id}: Missing relationship or consent", request)
                raise PermissionDenied("Access to patient medical images requires an active clinical appointment or delegated consent.")

            write_audit_log(user, "VIEW_PATIENT_IMAGES", f"Doctor viewed image profiles for patient #{patient_id}", request)
            profiles = PatientImageProfile.objects.filter(patient=target_patient).order_by('-created_at')
        elif user.role == 'admin' or user.is_staff:
            write_audit_log(user, "ADMIN_AUDIT_IMAGES", f"Admin audited patient images (filter={patient_id})", request)
            if patient_id:
                profiles = PatientImageProfile.objects.filter(patient_id=patient_id).order_by('-created_at')
            else:
                profiles = PatientImageProfile.objects.all().order_by('-created_at')
        else:
            raise PermissionDenied("Unauthorized role for medical image access.")

        serializer = PatientImageProfileSerializer(profiles, many=True)
        return Response(serializer.data)

    def post(self, request):
        user = request.user
        patient_id = request.data.get('patient', user.id)

        if user.role == 'patient':
            if int(patient_id) != user.id:
                raise PermissionDenied("Patients can only upload scans to their own health record.")
        elif user.role == 'doctor':
            has_rel = Appointment.objects.filter(doctor=user, patient_id=patient_id, status__in=['approved', 'completed']).exists()
            if not has_rel:
                raise PermissionDenied("Doctors can only upload medical images for patients with an active appointment.")
        elif not (user.role == 'admin' or user.is_staff):
            raise PermissionDenied("Unauthorized to upload patient medical images.")

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

