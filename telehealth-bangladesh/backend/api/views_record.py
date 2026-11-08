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

class PatientStorageView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        target_patient = user
        if user.role != 'patient':
            pid = request.query_params.get('patient_id') or request.query_params.get('patientId')
            if pid and str(pid).isdigit():
                target_patient = User.objects.filter(id=int(pid), role='patient').first() or user
            elif pid:
                target_patient = User.objects.filter(username__iexact=str(pid), role='patient').first() or user

        records = HealthRecord.objects.filter(patient=target_patient)
        used_bytes = 0
        for r in records:
            if r.file_size and r.file_size > 0:
                used_bytes += r.file_size
            elif r.file_data:
                used_bytes += len(r.file_data)
            else:
                used_bytes += len(r.encrypted_data or '') + 28000

        total_bytes = PATIENT_STORAGE_LIMIT_BYTES
        available_bytes = max(0, total_bytes - used_bytes)
        used_mb = round(used_bytes / (1024 * 1024), 2)
        total_mb = 250.0
        available_mb = round(available_bytes / (1024 * 1024), 2)
        percentage = round((used_bytes / total_bytes) * 100, 1) if total_bytes > 0 else 0

        return Response({
            "total_bytes": total_bytes,
            "total_mb": total_mb,
            "used_bytes": used_bytes,
            "used_mb": used_mb,
            "available_bytes": available_bytes,
            "available_mb": available_mb,
            "usage_percentage": min(100.0, percentage),
            "files_count": records.count(),
            "patient_id": target_patient.id,
            "patient_username": target_patient.username,
            "supported_formats": ["PDF", "JPG", "JPEG"],
            "max_capacity_label": "250 MB"
        })

class HealthRecordViewSet(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk=None):
        user = request.user
        patient_id = request.query_params.get('patient_id') or request.query_params.get('patientId')
        consultation_id = request.query_params.get('consultation_id') or request.query_params.get('consultationId')

        # Scenario A: Patient viewing their own records
        if user.role == 'patient' or not patient_id or (str(patient_id).isdigit() and int(patient_id) == user.id):
            records = HealthRecord.objects.filter(patient=user).select_related('patient', 'patient__patient_profile').prefetch_related('shared_consultations').order_by('-created_at')
            serializer = HealthRecordSerializer(records, many=True)
            return Response(serializer.data)

        # Scenario B: Doctor inspecting patient records (Separation of Availability vs Accessibility)
        if user.role == 'doctor':
            try:
                if str(patient_id).isdigit():
                    patient_user = User.objects.get(id=int(patient_id))
                else:
                    patient_user = User.objects.get(username__iexact=str(patient_id))
            except User.DoesNotExist:
                return Response({"error": "Patient not found"}, status=status.HTTP_404_NOT_FOUND)

            # Check if active consultation shared records are requested
            if consultation_id and str(consultation_id).isdigit():
                c_int = int(consultation_id)
                consult = Consultation.objects.filter(id=c_int).first()
                if consult and (consult.appointment.doctor == user or getattr(consult, 'doctor_id', None) == user.id):
                    shared = HealthRecord.objects.filter(patient=patient_user, shared_consultations=consult).select_related('patient', 'patient__patient_profile').prefetch_related('shared_consultations').order_by('-created_at')
                    return Response(HealthRecordSerializer(shared, many=True).data)

            # 1. Verify clinical appointment relationship
            has_appt = Appointment.objects.filter(
                doctor=user, 
                patient=patient_user, 
                status__in=['approved', 'completed']
            ).exists()

            if not has_appt:
                write_audit_log(user, "BLOCK_ACCESS_ATTEMPT", f"Doctor blocked: No appointment relationship with Patient #{patient_id}", request)
                raise PermissionDenied("You do not have a clinical appointment relationship with this patient.")

            # 2. Check active consent delegation via Centralized Consent Authorization Engine
            from api.consent_views import ConsentAuthorizationEngine
            eval_result = ConsentAuthorizationEngine.evaluate_access(user, patient_user, consultation=consult if 'consult' in locals() else None)

            all_records = HealthRecord.objects.filter(patient=patient_user).select_related('patient', 'patient__patient_profile').prefetch_related('shared_consultations').order_by('-created_at')

            # Patient Authorization Enforcement:
            # If consent is NOT active, expose record AVAILABILITY metadata only, NOT decrypted content!
            if not eval_result['is_authorized']:
                pending_req = ConsentRequest.objects.filter(
                    patient=patient_user,
                    doctor=user,
                    status='pending'
                ).exists() or Consent.objects.filter(
                    patient=patient_user,
                    doctor=user,
                    status='pending'
                ).exists()

                write_audit_log(user, "VIEW_RECORD_AVAILABILITY", f"Doctor viewed record availability for Patient #{patient_user.id} (Encrypted at rest)", request)
                return Response({
                    "authorized": False,
                    "status": "LOCKED",
                    "reason": eval_result['reason'],
                    "has_pending_request": pending_req,
                    "record_count": all_records.count(),
                    "total_records_on_file": all_records.count(),
                    "records_available": all_records.count() > 0,
                    "message": eval_result['reason'],
                    "records_metadata": [
                        {
                            "id": r.id,
                            "title": r.title or f"{r.record_type} Report",
                            "record_type": r.record_type,
                            "file_name": r.file_name or f"{r.record_type}.pdf",
                            "file_size": r.file_size or 45000,
                            "mime_type": r.mime_type or "application/pdf",
                            "date": r.created_at.strftime('%Y-%m-%d'),
                            "security_status": "ENCRYPTED_AT_REST",
                            "encryption_algo": "AES-256-GCM"
                        }
                        for r in all_records
                    ]
                }, status=status.HTTP_200_OK)

            # Consent is active: filter permitted categories and decrypt
            permitted_cats = eval_result['permitted_categories']
            filtered_records = all_records
            if 'All' not in permitted_cats and permitted_cats:
                q_cat = Q()
                for c in permitted_cats:
                    q_cat |= Q(record_type__icontains=c)
                filtered_records = filtered_records.filter(q_cat)

            # Apply selective allowed & withheld permissions
            active_consent = eval_result.get('active_consent')
            if active_consent:
                explicit_allowed = list(ConsentPermission.objects.filter(
                    consent=active_consent, is_allowed=True, record__isnull=False
                ).values_list('record_id', flat=True))
                if explicit_allowed:
                    filtered_records = filtered_records.filter(id__in=explicit_allowed)

                withheld_ids = list(ConsentPermission.objects.filter(
                    consent=active_consent, is_allowed=False
                ).values_list('record_id', flat=True))
                if withheld_ids:
                    filtered_records = filtered_records.exclude(id__in=withheld_ids)

            write_audit_log(user, "VIEW_HEALTH_RECORD", f"Doctor accessed authorized health records for Patient #{patient_user.id} ({eval_result['status']})", request)
            for rec in filtered_records:
                ConsentAuthorizationEngine.log_access(
                    patient=patient_user,
                    doctor=user,
                    record=rec,
                    access_type='VIEW',
                    permission_status=eval_result['status'],
                    reason=eval_result['reason'],
                    request=request
                )
            serializer = HealthRecordSerializer(filtered_records, many=True)
            return Response(serializer.data)
        
        raise PermissionDenied("Unauthorized access role.")

    def post(self, request):
        user = request.user
        if user.role != 'patient':
            raise PermissionDenied("Only patients can add medical records directly.")
        
        record_type = request.data.get('record_type') or request.data.get('category') or 'Lab Report'
        raw_data = request.data.get('content') or request.data.get('findings') or ''
        title = request.data.get('title') or f"{record_type} Report"
        file_name = request.data.get('fileName') or request.data.get('file_name')
        file_size = int(request.data.get('fileSize') or request.data.get('file_size') or 0)
        mime_type = request.data.get('mimeType') or request.data.get('mime_type')
        file_data = request.data.get('fileData') or request.data.get('file_data') or request.data.get('image_file')

        if not raw_data and not file_data:
            raw_data = f"Clinical diagnostic findings recorded for {title}."

        # File format validation: PDF, JPG, JPEG
        if file_name:
            lower_name = file_name.lower()
            if not (lower_name.endswith('.pdf') or lower_name.endswith('.jpg') or lower_name.endswith('.jpeg') or lower_name.endswith('.png')):
                raise ValidationError("Supported formats are PDF, JPG, and JPEG only.")
            if not mime_type:
                mime_type = "application/pdf" if lower_name.endswith('.pdf') else "image/jpeg"

        # Calculate file size if not explicitly provided
        if file_size <= 0:
            if file_data:
                file_size = int(len(file_data) * 0.75) # Base64 decoding approximation
            else:
                file_size = len(raw_data.encode('utf-8')) + 35000

        # Enforce 250 MB Storage Capacity Limit per Patient
        existing_records = HealthRecord.objects.filter(patient=user)
        current_used_bytes = 0
        for r in existing_records:
            if r.file_size and r.file_size > 0:
                current_used_bytes += r.file_size
            elif r.file_data:
                current_used_bytes += len(r.file_data)
            else:
                current_used_bytes += len(r.encrypted_data or '') + 28000

        if current_used_bytes + file_size > PATIENT_STORAGE_LIMIT_BYTES:
            avail_mb = round(max(0, PATIENT_STORAGE_LIMIT_BYTES - current_used_bytes) / (1024 * 1024), 2)
            raise ValidationError(f"Storage capacity exceeded: 250 MB total limit. Remaining available: {avail_mb} MB.")

        record = HealthRecord(
            patient=user,
            record_type=record_type,
            title=title,
            file_name=file_name or f"{record_type.replace(' ', '_')}_{int(timezone.now().timestamp())}.pdf",
            file_size=file_size,
            mime_type=mime_type or "application/pdf",
            file_data=file_data or ""
        )
        record.set_content(raw_data)
        record.save()

        # Link to active consultation if provided
        consultation_id = request.data.get('consultation_id') or request.data.get('consultationId')
        if consultation_id and str(consultation_id).isdigit():
            consult = Consultation.objects.filter(id=int(consultation_id)).first()
            if consult:
                record.shared_consultations.add(consult)

        # Commit cryptographic hash proof to Blockchain
        blockchain_service.commit_record("health_record", record.id, {
            "patient_id": user.id,
            "title": title,
            "type": record_type,
            "file_name": record.file_name,
            "file_size": file_size
        })

        write_audit_log(user, "CREATE_HEALTH_RECORD", f"Patient uploaded record ID: {record.id} ({record.file_name}, {file_size} bytes)", request)
        return Response(HealthRecordSerializer(record).data, status=status.HTTP_201_CREATED)

    def delete(self, request, pk=None):
        user = request.user
        record_id = pk or request.data.get('record_id') or request.query_params.get('record_id')
        if not record_id:
            return Response({"error": "Record ID is required."}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            record = HealthRecord.objects.get(id=record_id)
        except HealthRecord.DoesNotExist:
            return Response({"error": "Health record not found."}, status=status.HTTP_404_NOT_FOUND)

        if record.patient != user and not (user.is_staff or user.is_superuser):
            raise PermissionDenied("You can only delete your own health records.")

        freed_bytes = record.file_size or 35000
        title = record.title or "Health Record"
        file_name = record.file_name or "document"

        # Update blockchain/audit history with permanent DELETED ledger event
        blockchain_service.commit_record("health_record_revocation", record.id, {
            "patient_id": user.id,
            "record_id": record.id,
            "title": title,
            "file_name": file_name,
            "action": "PERMANENT_DELETION",
            "freed_bytes": freed_bytes
        })

        record.delete()
        write_audit_log(user, "DELETE_HEALTH_RECORD", f"Patient deleted record #{record_id} - {title} ({file_name}, freed {freed_bytes} bytes)", request)

        return Response({
            "message": "Health record deleted successfully.",
            "freed_bytes": freed_bytes,
            "record_id": record_id
        }, status=status.HTTP_200_OK)

class ConsultationSharedRecordsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def _resolve_consultation(self, user, pk):
        consult = Consultation.objects.filter(id=pk).first()
        if not consult:
            consult = Consultation.objects.filter(appointment_id=pk).first()
        if not consult:
            appt = Appointment.objects.filter(id=pk).first()
            if appt:
                consult, _ = Consultation.objects.get_or_create(
                    appointment=appt,
                    defaults={'type': appt.consultation_type or 'video', 'status': appt.status or 'pending'}
                )
        if not consult:
            # Fallback to user's most recent appointment if pk was stale from past session
            if getattr(user, 'role', None) == 'patient':
                recent = Appointment.objects.filter(patient=user).order_by('-id').first()
                if recent:
                    consult, _ = Consultation.objects.get_or_create(
                        appointment=recent,
                        defaults={'type': recent.consultation_type or 'video', 'status': recent.status or 'pending'}
                    )
            elif getattr(user, 'role', None) == 'doctor':
                recent = Appointment.objects.filter(doctor=user).order_by('-id').first()
                if recent:
                    consult, _ = Consultation.objects.get_or_create(
                        appointment=recent,
                        defaults={'type': recent.consultation_type or 'video', 'status': recent.status or 'pending'}
                    )
        return consult

    def get(self, request, pk):
        user = request.user
        consult = self._resolve_consultation(user, pk)
        if not consult:
            return Response({"error": "Consultation not found."}, status=status.HTTP_404_NOT_FOUND)

        # Verify participant authorization (must be either the doctor or patient)
        appt = consult.appointment
        is_patient = (appt and appt.patient == user) or (getattr(consult, 'patient_id', None) == user.id)
        is_doctor = (appt and appt.doctor == user) or (getattr(consult, 'doctor_id', None) == user.id)

        if not is_patient and not is_doctor and not user.is_staff:
            raise PermissionDenied("You are not an authorized participant of this consultation session.")

        # Return ONLY the records explicitly shared by the patient for this consultation
        shared_records = consult.shared_records.all().order_by('-created_at')
        serialized_shared = HealthRecordSerializer(shared_records, many=True).data
        shared_ids = list(shared_records.values_list('id', flat=True))

        data = {
            "consultation_id": consult.id,
            "shared_records": serialized_shared,
            "shared_record_ids": shared_ids,
            "total_shared": len(shared_ids),
        }

        # If patient, also include full records list and 250 MB quota details
        if is_patient:
            all_records = HealthRecord.objects.filter(patient=user).order_by('-created_at')
            data["all_patient_records"] = HealthRecordSerializer(all_records, many=True).data
            used_bytes = sum(r.file_size or 35000 for r in all_records)
            total_bytes = PATIENT_STORAGE_LIMIT_BYTES
            avail_bytes = max(0, total_bytes - used_bytes)
            data["storage"] = {
                "total_bytes": total_bytes,
                "total_mb": 250.0,
                "used_bytes": used_bytes,
                "used_mb": round(used_bytes / (1024 * 1024), 2),
                "available_bytes": avail_bytes,
                "available_mb": round(avail_bytes / (1024 * 1024), 2),
                "usage_percentage": min(100.0, round((used_bytes / total_bytes) * 100, 1)),
                "files_count": all_records.count(),
                "supported_formats": ["PDF", "JPG", "JPEG"],
                "max_capacity_label": "250 MB"
            }

        return Response(data)

    def post(self, request, pk):
        user = request.user
        consult = self._resolve_consultation(user, pk)
        if not consult:
            return Response({"error": "Consultation not found."}, status=status.HTTP_404_NOT_FOUND)

        appt = consult.appointment
        is_patient = (appt and appt.patient == user) or (getattr(consult, 'patient_id', None) == user.id)
        if not is_patient and not user.is_staff:
            raise PermissionDenied("Only the patient can select and authorize records for consultation sharing.")

        # 1. Update selection of existing records
        record_ids = request.data.get('record_ids') or request.data.get('recordIds') or []
        if isinstance(record_ids, list):
            valid_patient_records = HealthRecord.objects.filter(id__in=record_ids, patient=user)
            consult.shared_records.set(valid_patient_records)

        # 2. Allow uploading a new report directly within the consultation sharing modal
        new_record_data = request.data.get('new_record') or request.data.get('newRecord')
        if new_record_data and isinstance(new_record_data, dict):
            title = new_record_data.get('title') or "Consultation Report"
            record_type = new_record_data.get('record_type') or new_record_data.get('category') or "Lab Report"
            content = new_record_data.get('content') or f"Diagnostic findings for {title}."
            file_name = new_record_data.get('file_name') or new_record_data.get('fileName')
            file_size = int(new_record_data.get('file_size') or new_record_data.get('fileSize') or 0)
            file_data = new_record_data.get('file_data') or new_record_data.get('fileData')
            mime_type = new_record_data.get('mime_type') or ("application/pdf" if str(file_name).endswith('.pdf') else "image/jpeg")

            if file_size <= 0 and file_data:
                file_size = int(len(file_data) * 0.75)

            # Format validation (PDF, JPG, JPEG only)
            fn_lower = str(file_name or '').lower()
            is_valid_format = (
                fn_lower.endswith('.pdf') or fn_lower.endswith('.jpg') or fn_lower.endswith('.jpeg') or
                mime_type in ['application/pdf', 'image/jpeg', 'image/jpg']
            )
            if not is_valid_format:
                return Response({
                    "error": "Unsupported file format. Only PDF, JPG, and JPEG documents are permitted."
                }, status=status.HTTP_400_BAD_REQUEST)

            # Enforce 250 MB quota
            current_used = sum(r.file_size or 35000 for r in HealthRecord.objects.filter(patient=user))
            if current_used + file_size > PATIENT_STORAGE_LIMIT_BYTES:
                return Response({
                    "error": f"Upload exceeds your 250 MB storage limit. Used: {round(current_used / (1024*1024), 2)} MB, Attempted: {round(file_size / (1024*1024), 2)} MB."
                }, status=status.HTTP_400_BAD_REQUEST)

            new_rec = HealthRecord(
                patient=user,
                record_type=record_type,
                title=title,
                file_name=file_name or f"Report_{int(timezone.now().timestamp())}.pdf",
                file_size=file_size,
                mime_type=mime_type,
                file_data=file_data or ""
            )
            new_rec.set_content(content)
            new_rec.save()
            new_rec.shared_consultations.add(consult)

        shared = consult.shared_records.all().order_by('-created_at')
        write_audit_log(user, "SHARE_CONSULTATION_RECORDS", f"Patient updated shared records for Consultation #{consult.id} ({shared.count()} records shared)", request)

        # Broadcast real-time record update event to active consultation room
        try:
            from asgiref.sync import async_to_sync
            from channels.layers import get_channel_layer
            cl = get_channel_layer()
            if cl:
                async_to_sync(cl.group_send)(
                    f'consultation_{consult.id}',
                    {
                        'type': 'records_shared_handler',
                        'sender': user.username,
                        'consultation_id': consult.id,
                        'count': shared.count()
                    }
                )
        except Exception as e:
            logger.warning(f"WebSocket records broadcast notice: {e}")

        return Response({
            "message": f"Successfully authorized {shared.count()} records for consultation sharing.",
            "shared_records": HealthRecordSerializer(shared, many=True).data
        }, status=status.HTTP_200_OK)


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

        # Enforce patient-controlled consent when a physician downloads a patient file
        user = request.user
        if user.role == 'doctor':
            rec = HealthRecord.objects.filter(file_name=filename).first()
            if rec:
                from api.consent_views import ConsentAuthorizationEngine
                eval_res = ConsentAuthorizationEngine.evaluate_access(user, rec.patient, record_id=rec.id)
                if not eval_res['is_authorized']:
                    ConsentAuthorizationEngine.log_access(
                        patient=rec.patient,
                        doctor=user,
                        record=rec,
                        access_type='DOWNLOAD',
                        permission_status='DENIED',
                        reason=eval_res['reason'],
                        request=request
                    )
                    return Response({"error": f"Access Denied: {eval_res['reason']}"}, status=status.HTTP_403_FORBIDDEN)

                # Log authorized download
                ConsentAuthorizationEngine.log_access(
                    patient=rec.patient,
                    doctor=user,
                    record=rec,
                    access_type='DOWNLOAD',
                    permission_status=eval_res['status'],
                    reason="Doctor downloaded record file",
                    request=request
                )
                write_audit_log(user, "DOWNLOAD_HEALTH_RECORD", f"Doctor downloaded {filename} for Patient #{rec.patient.id}", request)

        from django.http import FileResponse
        return FileResponse(open(file_path, 'rb'))

