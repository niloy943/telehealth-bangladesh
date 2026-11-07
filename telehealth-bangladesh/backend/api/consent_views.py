import json
import logging
from datetime import timedelta
from django.utils import timezone
from django.db.models import Q
from django.core.exceptions import PermissionDenied
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from api.models import (
    User, Consultation, HealthRecord, Appointment, AuditLog, Consent,
    ConsentRequest, PatientConsent, ConsentPermission, ConsentHistory,
    RecordAccessLog, EmergencyAccessSetting, EmergencyAccessLog
)
from api.serializers import (
    ConsentRequestSerializer, PatientConsentSerializer,
    ConsentHistorySerializer, RecordAccessLogSerializer,
    EmergencyAccessSettingSerializer, EmergencyAccessLogSerializer,
    HealthRecordSerializer
)
from api.views import write_audit_log

logger = logging.getLogger(__name__)


def get_client_ip(request):
    if not request:
        return '127.0.0.1'
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        return x_forwarded_for.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR') or '127.0.0.1'


def broadcast_consent_event(event_type, patient_id, doctor_id, consultation_id=None, extra_data=None):
    """
    Broadcasts real-time consent updates via Django Channels WebSocket layer
    to patient, doctor, and consultation room groups.
    """
    try:
        channel_layer = get_channel_layer()
        if not channel_layer:
            return

        payload = {
            'type': 'consent_event_handler',
            'action': event_type,
            'patient_id': patient_id,
            'doctor_id': doctor_id,
            'consultation_id': consultation_id,
            'timestamp': timezone.now().isoformat(),
            'extra': extra_data or {}
        }

        # 1. Broadcast to consultation room if active
        if consultation_id:
            async_to_sync(channel_layer.group_send)(
                f'consultation_{consultation_id}',
                payload
            )

        # 2. Broadcast to doctor and patient notification groups
        async_to_sync(channel_layer.group_send)(
            f'user_{patient_id}',
            payload
        )
        async_to_sync(channel_layer.group_send)(
            f'user_{doctor_id}',
            payload
        )
    except Exception as e:
        logger.warning(f"WebSocket broadcast error for consent event: {e}")


# =====================================================================
# Phase 5: Centralized Consent Authorization Engine
# =====================================================================

class ConsentAuthorizationEngine:
    """
    Centralized evaluation engine for patient-controlled access.
    Guarantees that doctors can only view records explicitly authorized
    by active, unexpired, unrevoked patient consent or authorized emergency break-glass.
    """

    @staticmethod
    def evaluate_access(doctor, patient, consultation=None, record_id=None):
        now = timezone.now()

        # 1. Check Emergency Break-Glass Override
        setting, _ = EmergencyAccessSetting.objects.get_or_create(patient=patient)
        if setting.allow_emergency_break_glass:
            recent_emergency = EmergencyAccessLog.objects.filter(
                patient=patient,
                doctor=doctor,
                timestamp__gte=now - timedelta(hours=setting.auto_revoke_hours or 2)
            ).order_by('-timestamp').first()

            if recent_emergency:
                return {
                    'is_authorized': True,
                    'status': 'EMERGENCY_OVERRIDE',
                    'reason': f"Emergency Break-Glass Active: {recent_emergency.justification}",
                    'active_consent': None,
                    'emergency_log': recent_emergency,
                    'permitted_categories': ['Prescriptions', 'Lab Report', 'Lab Reports', 'Clinical notes', 'Diagnostic Report', 'Blood report', 'All']
                }

        # 2. Query Active Patient Consent
        active_consent = PatientConsent.objects.filter(
            patient=patient,
            doctor=doctor,
            status='active',
            valid_until__gt=now
        ).order_by('-approved_at').first()

        if not active_consent:
            # Check past history for explicit failure messaging
            revoked_consent = PatientConsent.objects.filter(
                patient=patient, doctor=doctor, status='revoked'
            ).order_by('-revoked_at').first()

            expired_consent = PatientConsent.objects.filter(
                patient=patient, doctor=doctor, status='active', valid_until__lte=now
            ).order_by('-valid_until').first()

            if revoked_consent:
                reason = "Access was explicitly revoked by the patient."
                status_code = 'REVOKED'
            elif expired_consent:
                reason = f"Consent authorization expired on {expired_consent.valid_until.strftime('%b %d, %Y at %I:%M %p')}."
                status_code = 'EXPIRED'
            else:
                reason = "Patient has not granted clinical record access consent."
                status_code = 'NO_CONSENT'

            return {
                'is_authorized': False,
                'status': status_code,
                'reason': reason,
                'active_consent': None,
                'emergency_log': None,
                'permitted_categories': []
            }

        # 3. If Consultation Only duration, verify active consultation
        if active_consent.duration_type == 'consultation_only' and active_consent.consultation:
            if consultation and consultation.id != active_consent.consultation.id:
                return {
                    'is_authorized': False,
                    'status': 'CONSULTATION_MISMATCH',
                    'reason': "Consent was granted exclusively for a different consultation session.",
                    'active_consent': active_consent,
                    'emergency_log': None,
                    'permitted_categories': []
                }

        # 4. Determine Permitted Record Categories
        allowed_cats = []
        if active_consent.can_view_lab_reports:
            allowed_cats.extend(['Lab Report', 'Lab Reports', 'Blood report', 'Radiology', 'Diagnostic Report'])
        if active_consent.can_view_prescriptions:
            allowed_cats.extend(['Prescriptions', 'Prescription', 'Rx'])
        if active_consent.can_view_clinical_notes:
            allowed_cats.extend(['Clinical notes', 'Clinical Document', 'Doctor Notes'])

        # 5. Check Record-Level Restrictions
        if record_id:
            perm = ConsentPermission.objects.filter(consent=active_consent, record_id=record_id).first()
            if perm and not perm.is_allowed:
                return {
                    'is_authorized': False,
                    'status': 'RECORD_WITHHELD',
                    'reason': "Patient explicitly withheld access to this specific medical record.",
                    'active_consent': active_consent,
                    'emergency_log': None,
                    'permitted_categories': allowed_cats
                }

        return {
            'is_authorized': True,
            'status': 'AUTHORIZED',
            'reason': f"Access authorized under active patient consent (expires {active_consent.valid_until.strftime('%b %d, %Y at %I:%M %p')}).",
            'active_consent': active_consent,
            'emergency_log': None,
            'permitted_categories': allowed_cats
        }

    @staticmethod
    def log_access(patient, doctor, record=None, consultation=None, access_type='VIEW', permission_status='AUTHORIZED', reason=None, request=None):
        ip = get_client_ip(request)
        RecordAccessLog.objects.create(
            patient=patient,
            doctor=doctor,
            record=record,
            consultation=consultation,
            access_type=access_type,
            permission_status=permission_status,
            reason=reason or '',
            ip_address=ip
        )


# =====================================================================
# Phase 1: Patient Portal Endpoints
# =====================================================================

class PatientConsentDashboardView(APIView):
    """
    GET /api/consent/dashboard/
    Complete dashboard overview of patient's privacy and consent settings.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.role != 'patient' and not user.is_staff:
            raise PermissionDenied("Only patients can access the Privacy & Data Consent Manager dashboard.")

        now = timezone.now()

        # Auto-expire any active consents whose valid_until is past
        expired_consents = PatientConsent.objects.filter(patient=user, status='active', valid_until__lte=now)
        for ec in expired_consents:
            ec.status = 'expired'
            ec.save(update_fields=['status'])
            ConsentHistory.objects.create(
                consent=ec,
                patient=user,
                doctor=ec.doctor,
                action='EXPIRED',
                details=f"Consent validity window expired at {now.isoformat()}.",
                ip_address=get_client_ip(request)
            )

        # 1. Active Consents
        active_consents = PatientConsent.objects.filter(
            patient=user, status='active', valid_until__gt=now
        ).select_related('doctor', 'doctor__doctor_profile', 'consultation').prefetch_related('permissions')

        # 2. Pending Requests
        pending_requests = ConsentRequest.objects.filter(
            patient=user, status='pending'
        ).select_related('doctor', 'doctor__doctor_profile', 'consultation').prefetch_related('requested_records').order_by('-requested_at')

        # 3. History
        recent_history = ConsentHistory.objects.filter(
            patient=user
        ).select_related('performed_by', 'doctor', 'doctor__doctor_profile').order_by('-timestamp')[:20]

        # 4. Audit Logs
        recent_access_logs = RecordAccessLog.objects.filter(
            patient=user
        ).select_related('doctor', 'doctor__doctor_profile', 'record', 'consultation').order_by('-timestamp')[:25]

        # 5. Emergency Settings
        emergency_setting, _ = EmergencyAccessSetting.objects.get_or_create(patient=user)

        # 6. Available Doctors (for proactive granting)
        appointments = Appointment.objects.filter(patient=user).select_related('doctor', 'doctor__doctor_profile').order_by('-id')
        doctor_map = {}
        for appt in appointments:
            doc = appt.doctor
            if doc and doc.id not in doctor_map:
                spec = doc.doctor_profile.specialty if hasattr(doc, 'doctor_profile') and doc.doctor_profile else 'Specialist'
                doctor_map[doc.id] = {
                    'id': doc.id,
                    'name': f"Dr. {doc.first_name or doc.username}",
                    'specialty': spec,
                    'username': doc.username,
                    'appointment_id': appt.id
                }

        # 7. Patient's Health Records (for selective record sharing)
        records = HealthRecord.objects.filter(patient=user).select_related('patient', 'patient__patient_profile').order_by('-created_at')

        return Response({
            "active_consents": PatientConsentSerializer(active_consents, many=True).data,
            "pending_requests": ConsentRequestSerializer(pending_requests, many=True).data,
            "recent_history": ConsentHistorySerializer(recent_history, many=True).data,
            "recent_access_logs": RecordAccessLogSerializer(recent_access_logs, many=True).data,
            "emergency_settings": EmergencyAccessSettingSerializer(emergency_setting).data,
            "available_doctors": list(doctor_map.values()),
            "patient_records": HealthRecordSerializer(records, many=True).data,
            "stats": {
                "active_count": active_consents.count(),
                "pending_count": pending_requests.count(),
                "history_count": ConsentHistory.objects.filter(patient=user).count(),
                "audit_logs_count": RecordAccessLog.objects.filter(patient=user).count(),
                "emergency_allowed": emergency_setting.allow_emergency_break_glass
            }
        })


class PatientConsentRequestsView(APIView):
    """
    GET /api/consent/requests/
    List pending access requests for the patient.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.role != 'patient' and not user.is_staff:
            raise PermissionDenied("Only patients can view their access requests.")

        requests = ConsentRequest.objects.filter(
            patient=user, status='pending'
        ).select_related('doctor', 'consultation').order_by('-requested_at')

        return Response(ConsentRequestSerializer(requests, many=True).data)


class PatientApproveRequestView(APIView):
    """
    POST /api/consent/requests/<id>/approve/
    Patient approves a doctor's access request with granular settings.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        user = request.user
        if user.role != 'patient' and not user.is_staff:
            raise PermissionDenied("Only the patient can approve medical data access requests.")

        try:
            consent_req = ConsentRequest.objects.get(id=pk, patient=user)
        except ConsentRequest.DoesNotExist:
            return Response({"error": "Consent request not found."}, status=status.HTTP_404_NOT_FOUND)

        if consent_req.status != 'pending':
            return Response({
                "error": f"Request has already been {consent_req.status}."
            }, status=status.HTTP_400_BAD_REQUEST)

        # Duration logic
        duration_type = request.data.get('duration_type', '24_hours')
        now = timezone.now()

        if duration_type == 'consultation_only':
            valid_until = now + timedelta(hours=2)
        elif duration_type == '7_days':
            valid_until = now + timedelta(days=7)
        elif duration_type == 'custom':
            custom_hours = int(request.data.get('custom_hours', 24))
            valid_until = now + timedelta(hours=custom_hours)
        else:  # default 24_hours
            duration_type = '24_hours'
            valid_until = now + timedelta(hours=24)

        can_view_prescriptions = bool(request.data.get('can_view_prescriptions', True))
        can_view_lab_reports = bool(request.data.get('can_view_lab_reports', True))
        can_view_clinical_notes = bool(request.data.get('can_view_clinical_notes', True))

        # Create or update PatientConsent
        consent = PatientConsent.objects.create(
            patient=user,
            doctor=consent_req.doctor,
            consultation=consent_req.consultation,
            request=consent_req,
            status='active',
            duration_type=duration_type,
            valid_until=valid_until,
            can_view_prescriptions=can_view_prescriptions,
            can_view_lab_reports=can_view_lab_reports,
            can_view_clinical_notes=can_view_clinical_notes
        )

        # Selective record permissions
        allowed_record_ids = request.data.get('allowed_record_ids', [])
        withheld_record_ids = request.data.get('withheld_record_ids', [])

        if allowed_record_ids:
            for rid in allowed_record_ids:
                ConsentPermission.objects.create(
                    consent=consent,
                    record_id=rid,
                    record_category='Selected Record',
                    is_allowed=True
                )

        if withheld_record_ids:
            for rid in withheld_record_ids:
                ConsentPermission.objects.create(
                    consent=consent,
                    record_id=rid,
                    record_category='Withheld Record',
                    is_allowed=False
                )

        # Mark request as approved
        consent_req.status = 'approved'
        consent_req.responded_at = now
        consent_req.save()

        # Update legacy Consent model for full backward compatibility
        legacy_c, _ = Consent.objects.get_or_create(
            patient=user,
            doctor=consent_req.doctor,
            defaults={'granted': True, 'status': 'granted', 'expires_at': valid_until}
        )
        legacy_c.granted = True
        legacy_c.status = 'granted'
        legacy_c.expires_at = valid_until
        legacy_c.save()

        # Audit & History logging
        ip = get_client_ip(request)
        ConsentHistory.objects.create(
            consent=consent,
            request=consent_req,
            patient=user,
            doctor=consent_req.doctor,
            action='APPROVED',
            performed_by=user,
            details=f"Patient approved access request #{consent_req.id} for Dr. {consent_req.doctor.username} ({duration_type}, valid until {valid_until.strftime('%b %d, %Y %I:%M %p')}).",
            ip_address=ip
        )
        write_audit_log(user, "APPROVE_RECORD_CONSENT", f"Patient approved consent #{consent.id} for Dr. {consent_req.doctor.username}", request)

        # Real-time WebSocket event
        broadcast_consent_event(
            'consent_approved',
            patient_id=user.id,
            doctor_id=consent_req.doctor.id,
            consultation_id=consent_req.consultation.id if consent_req.consultation else None,
            extra_data={'consent_id': consent.id, 'duration_type': duration_type, 'valid_until': valid_until.isoformat()}
        )

        return Response({
            "message": "Access request approved successfully.",
            "consent": PatientConsentSerializer(consent).data
        }, status=status.HTTP_200_OK)


class PatientRejectRequestView(APIView):
    """
    POST /api/consent/requests/<id>/reject/
    Patient rejects a doctor's access request with an optional reason.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        user = request.user
        if user.role != 'patient' and not user.is_staff:
            raise PermissionDenied("Only the patient can reject medical data access requests.")

        try:
            consent_req = ConsentRequest.objects.get(id=pk, patient=user)
        except ConsentRequest.DoesNotExist:
            return Response({"error": "Consent request not found."}, status=status.HTTP_404_NOT_FOUND)

        if consent_req.status != 'pending':
            return Response({
                "error": f"Request has already been {consent_req.status}."
            }, status=status.HTTP_400_BAD_REQUEST)

        reason = request.data.get('rejection_reason') or request.data.get('reason') or "Declined by patient."
        now = timezone.now()

        consent_req.status = 'rejected'
        consent_req.rejection_reason = reason
        consent_req.responded_at = now
        consent_req.save()

        # Update legacy model
        legacy_c = Consent.objects.filter(patient=user, doctor=consent_req.doctor).first()
        if legacy_c:
            legacy_c.granted = False
            legacy_c.status = 'rejected'
            legacy_c.save()

        # Audit & History logging
        ip = get_client_ip(request)
        ConsentHistory.objects.create(
            request=consent_req,
            patient=user,
            doctor=consent_req.doctor,
            action='REJECTED',
            performed_by=user,
            details=f"Patient rejected request #{consent_req.id} from Dr. {consent_req.doctor.username}. Reason: {reason}",
            ip_address=ip
        )
        write_audit_log(user, "REJECT_RECORD_CONSENT", f"Patient rejected request from Dr. {consent_req.doctor.username}", request)

        # Real-time WebSocket event
        broadcast_consent_event(
            'consent_rejected',
            patient_id=user.id,
            doctor_id=consent_req.doctor.id,
            consultation_id=consent_req.consultation.id if consent_req.consultation else None,
            extra_data={'request_id': consent_req.id, 'reason': reason}
        )

        return Response({
            "message": "Access request rejected.",
            "request": ConsentRequestSerializer(consent_req).data
        }, status=status.HTTP_200_OK)


class PatientRevokeConsentView(APIView):
    """
    POST /api/consent/<id>/revoke/
    Patient immediately revokes an active consent.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        user = request.user
        if user.role != 'patient' and not user.is_staff:
            raise PermissionDenied("Only the patient can revoke medical data access permissions.")

        # Find PatientConsent or fallback to legacy Consent
        consent = PatientConsent.objects.filter(id=pk, patient=user).first()
        if not consent:
            # Check legacy consent
            legacy = Consent.objects.filter(id=pk, patient=user).first()
            if legacy:
                legacy.granted = False
                legacy.status = 'revoked'
                legacy.expires_at = timezone.now()
                legacy.save()
                write_audit_log(user, "REVOKE_CONSENT", f"Patient revoked legacy consent #{pk}", request)
                return Response({"message": "Access consent revoked successfully."}, status=status.HTTP_200_OK)
            return Response({"error": "Consent record not found."}, status=status.HTTP_404_NOT_FOUND)

        now = timezone.now()
        reason = request.data.get('revocation_reason') or request.data.get('reason') or "Revoked by patient."

        consent.status = 'revoked'
        consent.revoked_at = now
        consent.revocation_reason = reason
        consent.save()

        # Update legacy model
        legacy_c = Consent.objects.filter(patient=user, doctor=consent.doctor).first()
        if legacy_c:
            legacy_c.granted = False
            legacy_c.status = 'revoked'
            legacy_c.expires_at = now
            legacy_c.save()

        # Audit & History logging
        ip = get_client_ip(request)
        ConsentHistory.objects.create(
            consent=consent,
            patient=user,
            doctor=consent.doctor,
            action='REVOKED',
            performed_by=user,
            details=f"Patient revoked consent #{consent.id} for Dr. {consent.doctor.username}. Reason: {reason}",
            ip_address=ip
        )
        write_audit_log(user, "REVOKE_CONSENT", f"Patient revoked consent #{consent.id} for Dr. {consent.doctor.username}", request)

        # Real-time WebSocket event
        broadcast_consent_event(
            'consent_revoked',
            patient_id=user.id,
            doctor_id=consent.doctor.id,
            consultation_id=consent.consultation.id if consent.consultation else None,
            extra_data={'consent_id': consent.id, 'reason': reason}
        )

        return Response({
            "message": "Access revoked successfully. Doctor has been locked out of patient records.",
            "consent": PatientConsentSerializer(consent).data
        }, status=status.HTTP_200_OK)


class PatientModifyDurationView(APIView):
    """
    POST /api/consent/<id>/duration/
    Patient modifies duration validity or category permissions of an active consent.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        user = request.user
        if user.role != 'patient' and not user.is_staff:
            raise PermissionDenied("Only the patient can modify consent duration.")

        try:
            consent = PatientConsent.objects.get(id=pk, patient=user)
        except PatientConsent.DoesNotExist:
            return Response({"error": "Consent record not found."}, status=status.HTTP_404_NOT_FOUND)

        duration_type = request.data.get('duration_type', consent.duration_type)
        now = timezone.now()

        if duration_type == 'consultation_only':
            valid_until = now + timedelta(hours=2)
        elif duration_type == '7_days':
            valid_until = now + timedelta(days=7)
        elif duration_type == 'custom':
            custom_hours = int(request.data.get('custom_hours', 24))
            valid_until = now + timedelta(hours=custom_hours)
        else:
            duration_type = '24_hours'
            valid_until = now + timedelta(hours=24)

        consent.duration_type = duration_type
        consent.valid_until = valid_until
        consent.status = 'active'

        if 'can_view_prescriptions' in request.data:
            consent.can_view_prescriptions = bool(request.data['can_view_prescriptions'])
        if 'can_view_lab_reports' in request.data:
            consent.can_view_lab_reports = bool(request.data['can_view_lab_reports'])
        if 'can_view_clinical_notes' in request.data:
            consent.can_view_clinical_notes = bool(request.data['can_view_clinical_notes'])

        consent.save()

        # Update legacy model
        legacy_c = Consent.objects.filter(patient=user, doctor=consent.doctor).first()
        if legacy_c:
            legacy_c.granted = True
            legacy_c.status = 'granted'
            legacy_c.expires_at = valid_until
            legacy_c.save()

        # Audit & History
        ip = get_client_ip(request)
        ConsentHistory.objects.create(
            consent=consent,
            patient=user,
            doctor=consent.doctor,
            action='MODIFIED',
            performed_by=user,
            details=f"Patient updated consent #{consent.id} duration to {duration_type} (expires {valid_until.strftime('%b %d, %Y %I:%M %p')}).",
            ip_address=ip
        )
        write_audit_log(user, "MODIFY_CONSENT_DURATION", f"Patient modified consent duration for Dr. {consent.doctor.username}", request)

        return Response({
            "message": "Consent duration and permissions updated successfully.",
            "consent": PatientConsentSerializer(consent).data
        }, status=status.HTTP_200_OK)


class PatientGrantConsentDirectView(APIView):
    """
    POST /api/consent/grant/
    Patient directly initiates and grants consent to a doctor.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        if user.role != 'patient' and not user.is_staff:
            raise PermissionDenied("Only patients can grant medical data access.")

        doctor_id = request.data.get('doctor_id') or request.data.get('doctorId')
        if not doctor_id:
            return Response({"error": "doctor_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            if str(doctor_id).isdigit():
                doctor = User.objects.get(id=int(doctor_id), role='doctor')
            else:
                doctor = User.objects.get(username__iexact=str(doctor_id), role='doctor')
        except User.DoesNotExist:
            return Response({"error": "Doctor not found."}, status=status.HTTP_404_NOT_FOUND)

        duration_type = request.data.get('duration_type', '24_hours')
        now = timezone.now()

        if duration_type == 'consultation_only':
            valid_until = now + timedelta(hours=2)
        elif duration_type == '7_days':
            valid_until = now + timedelta(days=7)
        elif duration_type == 'custom':
            custom_hours = int(request.data.get('custom_hours', 24))
            valid_until = now + timedelta(hours=custom_hours)
        else:
            duration_type = '24_hours'
            valid_until = now + timedelta(hours=24)

        can_view_prescriptions = bool(request.data.get('can_view_prescriptions', True))
        can_view_lab_reports = bool(request.data.get('can_view_lab_reports', True))
        can_view_clinical_notes = bool(request.data.get('can_view_clinical_notes', True))

        consultation_id = request.data.get('consultation_id')
        consultation = Consultation.objects.filter(id=consultation_id).first() if consultation_id else None

        consent = PatientConsent.objects.create(
            patient=user,
            doctor=doctor,
            consultation=consultation,
            status='active',
            duration_type=duration_type,
            valid_until=valid_until,
            can_view_prescriptions=can_view_prescriptions,
            can_view_lab_reports=can_view_lab_reports,
            can_view_clinical_notes=can_view_clinical_notes
        )

        # Update legacy model
        legacy_c, _ = Consent.objects.get_or_create(
            patient=user,
            doctor=doctor,
            defaults={'granted': True, 'status': 'granted', 'expires_at': valid_until}
        )
        legacy_c.granted = True
        legacy_c.status = 'granted'
        legacy_c.expires_at = valid_until
        legacy_c.save()

        # Audit & History
        ip = get_client_ip(request)
        ConsentHistory.objects.create(
            consent=consent,
            patient=user,
            doctor=doctor,
            action='APPROVED',
            performed_by=user,
            details=f"Patient directly granted consent to Dr. {doctor.username} ({duration_type}, expires {valid_until.strftime('%b %d, %Y %I:%M %p')}).",
            ip_address=ip
        )
        write_audit_log(user, "GRANT_CONSENT", f"Patient granted access to Dr. {doctor.username}", request)

        # Broadcast
        broadcast_consent_event(
            'consent_approved',
            patient_id=user.id,
            doctor_id=doctor.id,
            consultation_id=consultation.id if consultation else None,
            extra_data={'consent_id': consent.id, 'duration_type': duration_type}
        )

        return Response({
            "message": "Consent granted successfully.",
            "consent": PatientConsentSerializer(consent).data
        }, status=status.HTTP_201_CREATED)


class PatientConsentHistoryView(APIView):
    """
    GET /api/consent/history/
    Audit trail of all previous consent decisions.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.role != 'patient' and not user.is_staff:
            raise PermissionDenied("Only patients can view their consent history.")

        history = ConsentHistory.objects.filter(
            patient=user
        ).select_related('performed_by', 'doctor', 'consent').order_by('-timestamp')

        return Response(ConsentHistorySerializer(history, many=True).data)


class PatientAuditLogsView(APIView):
    """
    GET /api/consent/audit-logs/
    Detailed log of every access event to the patient's records.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.role != 'patient' and not user.is_staff:
            raise PermissionDenied("Only patients can inspect data access audit logs.")

        logs = RecordAccessLog.objects.filter(
            patient=user
        ).select_related('doctor', 'record', 'consultation').order_by('-timestamp')

        return Response(RecordAccessLogSerializer(logs, many=True).data)


class PatientEmergencySettingsView(APIView):
    """
    GET /api/consent/emergency-settings/
    POST /api/consent/emergency-settings/
    Review and manage emergency break-glass permissions.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.role != 'patient' and not user.is_staff:
            raise PermissionDenied("Only patients can view emergency access settings.")

        setting, _ = EmergencyAccessSetting.objects.get_or_create(patient=user)
        emergency_logs = EmergencyAccessLog.objects.filter(patient=user).select_related('doctor').order_by('-timestamp')

        return Response({
            "settings": EmergencyAccessSettingSerializer(setting).data,
            "emergency_logs": EmergencyAccessLogSerializer(emergency_logs, many=True).data
        })

    def post(self, request):
        user = request.user
        if user.role != 'patient' and not user.is_staff:
            raise PermissionDenied("Only patients can modify emergency access settings.")

        setting, _ = EmergencyAccessSetting.objects.get_or_create(patient=user)

        if 'allow_emergency_break_glass' in request.data:
            setting.allow_emergency_break_glass = bool(request.data['allow_emergency_break_glass'])
        if 'require_immediate_sms' in request.data:
            setting.require_immediate_sms = bool(request.data['require_immediate_sms'])
        if 'require_immediate_email' in request.data:
            setting.require_immediate_email = bool(request.data['require_immediate_email'])
        if 'auto_revoke_hours' in request.data:
            setting.auto_revoke_hours = max(1, min(24, int(request.data['auto_revoke_hours'])))

        setting.save()

        write_audit_log(
            user,
            "UPDATE_EMERGENCY_SETTINGS",
            f"Patient updated emergency settings (Break-glass allowed: {setting.allow_emergency_break_glass})",
            request
        )

        return Response({
            "message": "Emergency access settings updated successfully.",
            "settings": EmergencyAccessSettingSerializer(setting).data
        }, status=status.HTTP_200_OK)


# =====================================================================
# Phase 2: Doctor Portal Endpoints
# =====================================================================

class DoctorConsentStatusView(APIView):
    """
    GET /api/doctor/consent/status/
    Checks current consent status for a specific patient.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.role != 'doctor' and not user.is_staff:
            raise PermissionDenied("Only doctors can query patient consent status.")

        patient_id = request.query_params.get('patientId') or request.query_params.get('patient_id')
        if not patient_id:
            return Response({"error": "patientId query parameter is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            if str(patient_id).isdigit():
                patient = User.objects.get(id=int(patient_id), role='patient')
            else:
                patient = User.objects.get(username__iexact=str(patient_id), role='patient')
        except User.DoesNotExist:
            return Response({"error": "Patient not found."}, status=status.HTTP_404_NOT_FOUND)

        consultation_id = request.query_params.get('consultationId') or request.query_params.get('consultation_id')
        consultation = Consultation.objects.filter(id=consultation_id).first() if consultation_id else None

        # Check pending requests
        pending_req = ConsentRequest.objects.filter(
            doctor=user, patient=patient, status='pending'
        ).order_by('-requested_at').first()

        # Evaluate via centralized engine
        eval_result = ConsentAuthorizationEngine.evaluate_access(user, patient, consultation=consultation)

        active_consent = eval_result.get('active_consent')
        time_remaining = 0
        valid_until_iso = None

        if active_consent and active_consent.valid_until:
            now = timezone.now()
            if active_consent.valid_until > now:
                time_remaining = int((active_consent.valid_until - now).total_seconds())
                valid_until_iso = active_consent.valid_until.isoformat()

        restrictions = [
            "Doctors cannot approve their own requests.",
            "Doctors cannot alter patient consent permissions.",
            "Doctors cannot access unapproved medical records.",
            "Patient maintains absolute authority to revoke access at any time."
        ]

        return Response({
            "is_authorized": eval_result['is_authorized'],
            "status": eval_result['status'],
            "reason": eval_result['reason'],
            "has_pending_request": bool(pending_req),
            "pending_request": ConsentRequestSerializer(pending_req).data if pending_req else None,
            "active_consent": PatientConsentSerializer(active_consent).data if active_consent else None,
            "time_remaining_seconds": time_remaining,
            "valid_until": valid_until_iso,
            "permitted_categories": eval_result['permitted_categories'],
            "restrictions": restrictions
        })


class DoctorConsentRequestView(APIView):
    """
    POST /api/doctor/consent/request/
    Doctor submits an access request to the patient.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        if user.role != 'doctor' and not user.is_staff:
            raise PermissionDenied("Only doctors can submit medical data access requests.")

        patient_id = request.data.get('patient_id') or request.data.get('patientId')
        if not patient_id:
            return Response({"error": "patient_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            if str(patient_id).isdigit():
                patient = User.objects.get(id=int(patient_id), role='patient')
            else:
                patient = User.objects.get(username__iexact=str(patient_id), role='patient')
        except User.DoesNotExist:
            return Response({"error": "Patient not found."}, status=status.HTTP_404_NOT_FOUND)

        # Access Purpose Validation
        access_purpose = (request.data.get('access_purpose') or request.data.get('purpose') or '').strip()
        if len(access_purpose) < 5:
            return Response({
                "error": "A clinical reason / medical purpose is required (minimum 5 characters)."
            }, status=status.HTTP_400_BAD_REQUEST)

        # Check for confirmed appointment / consultation relationship
        consultation_id = request.data.get('consultation_id') or request.data.get('consultationId')
        consultation = Consultation.objects.filter(id=consultation_id).first() if consultation_id else None

        has_appt = Appointment.objects.filter(
            doctor=user, patient=patient, status__in=['approved', 'completed', 'pending']
        ).exists()
        if not has_appt and not consultation:
            return Response({
                "error": "You can only request access for patients with whom you have a scheduled or completed consultation."
            }, status=status.HTTP_403_FORBIDDEN)

        requested_categories = request.data.get('requested_categories') or ['Prescriptions', 'Lab Reports', 'Clinical Notes']

        # Prevent duplicate pending requests
        existing_pending = ConsentRequest.objects.filter(
            doctor=user, patient=patient, status='pending'
        ).first()

        if existing_pending:
            existing_pending.access_purpose = access_purpose
            existing_pending.requested_categories = requested_categories
            if consultation:
                existing_pending.consultation = consultation
            existing_pending.save()
            consent_req = existing_pending
        else:
            consent_req = ConsentRequest.objects.create(
                patient=patient,
                doctor=user,
                consultation=consultation,
                requested_categories=requested_categories,
                access_purpose=access_purpose,
                status='pending'
            )

        # Update legacy model
        legacy_c, _ = Consent.objects.get_or_create(
            patient=patient,
            doctor=user,
            defaults={'granted': False, 'status': 'pending', 'expires_at': timezone.now() + timedelta(hours=24)}
        )
        legacy_c.granted = False
        legacy_c.status = 'pending'
        legacy_c.save()

        # Audit & History
        ip = get_client_ip(request)
        ConsentHistory.objects.create(
            request=consent_req,
            patient=patient,
            doctor=user,
            action='REQUESTED',
            performed_by=user,
            details=f"Dr. {user.username} requested access to records. Purpose: {access_purpose}",
            ip_address=ip
        )
        write_audit_log(user, "REQUEST_RECORD_CONSENT", f"Dr. {user.username} requested record access from Patient {patient.username}", request)

        # Real-time WebSocket event to notify patient
        broadcast_consent_event(
            'consent_requested',
            patient_id=patient.id,
            doctor_id=user.id,
            consultation_id=consultation.id if consultation else None,
            extra_data={'request_id': consent_req.id, 'purpose': access_purpose}
        )

        return Response({
            "message": "Access request submitted. Awaiting patient approval.",
            "request": ConsentRequestSerializer(consent_req).data
        }, status=status.HTTP_201_CREATED)


class DoctorApprovedRecordsView(APIView):
    """
    GET /api/doctor/consent/records/
    Retrieves authorized patient medical records.
    Strictly enforced by ConsentAuthorizationEngine.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.role != 'doctor' and not user.is_staff:
            raise PermissionDenied("Only doctors can access patient clinical records.")

        patient_id = request.query_params.get('patientId') or request.query_params.get('patient_id')
        if not patient_id:
            return Response({"error": "patientId query parameter is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            if str(patient_id).isdigit():
                patient = User.objects.get(id=int(patient_id), role='patient')
            else:
                patient = User.objects.get(username__iexact=str(patient_id), role='patient')
        except User.DoesNotExist:
            return Response({"error": "Patient not found."}, status=status.HTTP_404_NOT_FOUND)

        consultation_id = request.query_params.get('consultationId') or request.query_params.get('consultation_id')
        consultation = Consultation.objects.filter(id=consultation_id).first() if consultation_id else None

        # Evaluate authorization
        eval_result = ConsentAuthorizationEngine.evaluate_access(user, patient, consultation=consultation)

        if not eval_result['is_authorized']:
            # Log denied access attempt
            ConsentAuthorizationEngine.log_access(
                patient=patient,
                doctor=user,
                consultation=consultation,
                access_type='VIEW',
                permission_status='DENIED',
                reason=eval_result['reason'],
                request=request
            )
            return Response({
                "status": "LOCKED",
                "error": "Access Denied",
                "reason": eval_result['reason'],
                "total_records_on_file": HealthRecord.objects.filter(patient=patient).count(),
                "has_pending_request": ConsentRequest.objects.filter(doctor=user, patient=patient, status='pending').exists(),
                "restrictions": [
                    "Zero-Trust Patient Sovereignty enforced.",
                    "Patient must explicitly delegate access consent before records can be decrypted."
                ]
            }, status=status.HTTP_403_FORBIDDEN)

        # Authorized: filter records by permitted categories and individual permissions
        permitted_categories = eval_result['permitted_categories']
        records_query = HealthRecord.objects.filter(patient=patient)

        # Category filter
        if 'All' not in permitted_categories:
            q_filter = Q()
            for cat in permitted_categories:
                q_filter |= Q(record_type__icontains=cat)
            records_query = records_query.filter(q_filter)

        # Check withheld records
        active_consent = eval_result.get('active_consent')
        if active_consent:
            withheld_ids = list(ConsentPermission.objects.filter(
                consent=active_consent, is_allowed=False
            ).values_list('record_id', flat=True))
            if withheld_ids:
                records_query = records_query.exclude(id__in=withheld_ids)

        records = records_query.order_by('-created_at')

        # Log authorized access
        for rec in records:
            ConsentAuthorizationEngine.log_access(
                patient=patient,
                doctor=user,
                record=rec,
                consultation=consultation,
                access_type='VIEW',
                permission_status=eval_result['status'],
                reason=eval_result['reason'],
                request=request
            )

        return Response({
            "status": eval_result['status'],
            "access_type": eval_result['status'],
            "records": HealthRecordSerializer(records, many=True).data,
            "total_authorized": records.count(),
            "valid_until": active_consent.valid_until.isoformat() if active_consent else None
        }, status=status.HTTP_200_OK)


class DoctorConsentExpiryView(APIView):
    """
    GET /api/doctor/consent/expiry/
    Check remaining access validity window.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.role != 'doctor' and not user.is_staff:
            raise PermissionDenied("Only doctors can query consent expiry.")

        patient_id = request.query_params.get('patientId') or request.query_params.get('patient_id')
        if not patient_id:
            return Response({"error": "patientId is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            if str(patient_id).isdigit():
                patient = User.objects.get(id=int(patient_id), role='patient')
            else:
                patient = User.objects.get(username__iexact=str(patient_id), role='patient')
        except User.DoesNotExist:
            return Response({"error": "Patient not found."}, status=status.HTTP_404_NOT_FOUND)

        active_consent = PatientConsent.objects.filter(
            doctor=user, patient=patient, status='active'
        ).order_by('-approved_at').first()

        if not active_consent:
            return Response({
                "is_active": False,
                "message": "No active consent exists for this patient."
            }, status=status.HTTP_200_OK)

        now = timezone.now()
        is_expired = active_consent.valid_until <= now
        remaining_seconds = max(0, int((active_consent.valid_until - now).total_seconds()))

        hours = remaining_seconds // 3600
        minutes = (remaining_seconds % 3600) // 60

        return Response({
            "is_active": not is_expired,
            "is_expired": is_expired,
            "valid_until": active_consent.valid_until.isoformat(),
            "remaining_seconds": remaining_seconds,
            "formatted_remaining": f"{hours}h {minutes}m remaining" if not is_expired else "Expired",
            "duration_type": active_consent.duration_type
        }, status=status.HTTP_200_OK)


class DoctorConsentRestrictionsView(APIView):
    """
    GET /api/doctor/consent/restrictions/
    Returns formal zero-trust patient-controlled security policies.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response({
            "policy_title": "HealNSight Patient-Controlled Access Policy",
            "principles": [
                {
                    "title": "Patient Sovereignty",
                    "description": "Patients retain exclusive ownership and authority over their medical history."
                },
                {
                    "title": "No Self-Authorization",
                    "description": "Doctors cannot approve their own record access requests under any circumstances."
                },
                {
                    "title": "Immutable Permission Control",
                    "description": "Doctors cannot alter or escalate consent permissions delegated by patients."
                },
                {
                    "title": "Strict Zero-Trust Isolation",
                    "description": "Medical records remain AES-256 encrypted at rest. Unapproved records cannot be decrypted or streamed."
                },
                {
                    "title": "Real-Time Revocation",
                    "description": "When a patient revokes consent, doctor access is terminated immediately with zero latency."
                },
                {
                    "title": "Audit Transparency",
                    "description": "Every access attempt (authorized or denied) is permanently logged and visible to the patient."
                }
            ]
        })


class DoctorEmergencyBreakGlassView(APIView):
    """
    POST /api/doctor/consent/emergency-access/
    Emergency Break-Glass Access for critical care situations.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        if user.role != 'doctor' and not user.is_staff:
            raise PermissionDenied("Only verified physicians can invoke emergency break-glass protocols.")

        patient_id = request.data.get('patient_id') or request.data.get('patientId')
        if not patient_id:
            return Response({"error": "patient_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            if str(patient_id).isdigit():
                patient = User.objects.get(id=int(patient_id), role='patient')
            else:
                patient = User.objects.get(username__iexact=str(patient_id), role='patient')
        except User.DoesNotExist:
            return Response({"error": "Patient not found."}, status=status.HTTP_404_NOT_FOUND)

        justification = (request.data.get('justification') or request.data.get('reason') or '').strip()
        if len(justification) < 10:
            return Response({
                "error": "A detailed medical emergency justification is required (minimum 10 characters)."
            }, status=status.HTTP_400_BAD_REQUEST)

        # Check patient's emergency settings
        setting, _ = EmergencyAccessSetting.objects.get_or_create(patient=patient)
        if not setting.allow_emergency_break_glass:
            return Response({
                "error": "Emergency break-glass access has been disabled by the patient in their Privacy & Security settings."
            }, status=status.HTTP_403_FORBIDDEN)

        consultation_id = request.data.get('consultation_id') or request.data.get('consultationId')
        consultation = Consultation.objects.filter(id=consultation_id).first() if consultation_id else None

        duration_minutes = (setting.auto_revoke_hours or 2) * 60
        ip = get_client_ip(request)

        # Create EmergencyAccessLog
        emergency_log = EmergencyAccessLog.objects.create(
            patient=patient,
            doctor=user,
            consultation=consultation,
            justification=justification,
            duration_minutes=duration_minutes,
            ip_address=ip,
            notified_patient=True
        )

        # Log to ConsentHistory
        ConsentHistory.objects.create(
            patient=patient,
            doctor=user,
            action='EMERGENCY_ACCESS',
            performed_by=user,
            details=f"Dr. {user.username} invoked emergency break-glass. Justification: {justification}",
            ip_address=ip
        )

        # Log system audit log
        write_audit_log(
            user,
            "EMERGENCY_BREAK_GLASS",
            f"Dr. {user.username} invoked emergency break-glass for Patient {patient.username}. Reason: {justification}",
            request
        )

        # Broadcast emergency event
        broadcast_consent_event(
            'emergency_access_invoked',
            patient_id=patient.id,
            doctor_id=user.id,
            consultation_id=consultation.id if consultation else None,
            extra_data={'justification': justification, 'log_id': emergency_log.id}
        )

        return Response({
            "message": "Emergency break-glass access authorized and logged. Patient has been notified.",
            "emergency_log": EmergencyAccessLogSerializer(emergency_log).data,
            "valid_duration_hours": setting.auto_revoke_hours
        }, status=status.HTTP_200_OK)
