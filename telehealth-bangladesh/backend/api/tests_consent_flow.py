import json
from datetime import timedelta
from django.utils import timezone
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase
from rest_framework import status
from api.models import (
    DoctorProfile, PatientProfile, Appointment, HealthRecord,
    PatientConsent, ConsentPermission, ConsentRequest,
    ConsentHistory, RecordAccessLog, EmergencyAccessSetting,
    EmergencyAccessLog
)

User = get_user_model()


class ConsentManagerFlowTests(APITestCase):
    """
    End-to-end integration tests for HealNSight Privacy & Data Consent Manager.
    Validates Scenarios A through G covering zero-trust patient sovereignty,
    active grants, revoking, expiration, emergency break-glass, and audit logging.
    """

    def setUp(self):
        # 1. Create Patient
        self.patient = User.objects.create_user(
            username="test_patient",
            email="patient@healnsight.test",
            password="Password123!",
            role="patient",
            first_name="Rahim",
            last_name="Uddin"
        )
        self.patient_profile = PatientProfile.objects.create(
            user=self.patient,
            blood_group="B+",
            emergency_contact="01700000000"
        )

        # 2. Create Doctor
        self.doctor = User.objects.create_user(
            username="test_doctor",
            email="doctor@healnsight.test",
            password="Password123!",
            role="doctor",
            first_name="Sarah",
            last_name="Jenkins",
            bmdc_reg="BMDC-78492"
        )
        self.doctor_profile = DoctorProfile.objects.create(
            user=self.doctor,
            specialty="Cardiology",
            hospital="Dhaka Medical College Hospital",
            verification_status="approved",
            experience=8,
            fees=800
        )

        # 3. Create Second Doctor (for search & multi-doctor verification)
        self.doctor2 = User.objects.create_user(
            username="test_doctor_two",
            email="doctor2@healnsight.test",
            password="Password123!",
            role="doctor",
            first_name="Arman",
            last_name="Chowdhury",
            bmdc_reg="BMDC-99214"
        )
        self.doctor2_profile = DoctorProfile.objects.create(
            user=self.doctor2,
            specialty="Neurology",
            hospital="Square Hospital",
            verification_status="approved",
            experience=12,
            fees=1200
        )

        # 4. Create an Appointment between Patient & Doctor 1
        self.appointment = Appointment.objects.create(
            patient=self.patient,
            doctor=self.doctor,
            date=timezone.now().date(),
            time="10:00 AM",
            reason="Chest pain and palpitations",
            status="approved"
        )

        # 5. Create Patient Health Records
        self.rec1 = HealthRecord.objects.create(
            patient=self.patient,
            record_type="Lab Report",
            title="Blood Biochemistry Lipid Profile",
            file_name="lipid_profile_01.pdf",
            file_size=45000,
            mime_type="application/pdf"
        )
        self.rec1.set_content("Total Cholesterol: 240 mg/dL, HDL: 38 mg/dL, LDL: 165 mg/dL")
        self.rec1.save()

        self.rec2 = HealthRecord.objects.create(
            patient=self.patient,
            record_type="Prescriptions",
            title="Cardiology Rx - Beta Blockers",
            file_name="cardio_rx_01.pdf",
            file_size=32000,
            mime_type="application/pdf"
        )
        self.rec2.set_content("Tab. Metoprolol 25mg 1+0+0, Tab. Atorvastatin 20mg 0+0+1")
        self.rec2.save()

        self.rec3 = HealthRecord.objects.create(
            patient=self.patient,
            record_type="Clinical notes",
            title="Confidential Psychiatric Consultation Note",
            file_name="psych_eval_01.pdf",
            file_size=28000,
            mime_type="application/pdf"
        )
        self.rec3.set_content("Patient exhibits mild situational anxiety.")
        self.rec3.save()

    # =========================================================================
    # SCENARIO A: Grant Direct Access to Doctor -> DB Persistence -> Record Access
    # =========================================================================
    def test_scenario_a_grant_direct_access(self):
        self.client.force_authenticate(user=self.patient)

        # Patient grants proactive access to Doctor 2 (selective to rec1 only)
        payload = {
            "doctor_id": self.doctor2.id,
            "duration_type": "24_hours",
            "can_view_lab_reports": True,
            "can_view_prescriptions": False,
            "can_view_clinical_notes": False,
            "allowed_record_ids": [self.rec1.id]
        }
        resp = self.client.post('/api/consent/grant/', payload, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertIn("consent", resp.data)

        # Verify DB records
        consent = PatientConsent.objects.filter(patient=self.patient, doctor=self.doctor2, status='active').first()
        self.assertIsNotNone(consent)
        self.assertEqual(consent.duration_type, "24_hours")
        self.assertTrue(consent.is_valid)

        # Verify permissions table
        perm = ConsentPermission.objects.filter(consent=consent, record=self.rec1, is_allowed=True).first()
        self.assertIsNotNone(perm)

        # Doctor 2 inspects records
        self.client.force_authenticate(user=self.doctor2)
        doc_resp = self.client.get(f'/api/doctor/consent/records/?patientId={self.patient.id}')
        self.assertEqual(doc_resp.status_code, status.HTTP_200_OK)
        records = doc_resp.data.get('records', [])
        # Only rec1 must be returned (rec2 and rec3 are restricted)
        record_ids = [r['id'] for r in records]
        self.assertIn(self.rec1.id, record_ids)
        self.assertNotIn(self.rec2.id, record_ids)
        self.assertNotIn(self.rec3.id, record_ids)

    # =========================================================================
    # SCENARIO B: Doctor Requests -> Patient Approves -> Doctor Accesses Records
    # =========================================================================
    def test_scenario_b_request_and_approve_flow(self):
        # Doctor 1 requests access
        self.client.force_authenticate(user=self.doctor)
        req_resp = self.client.post('/api/doctor/consent/request/', {
            "patient_id": self.patient.id,
            "access_purpose": "Reviewing cardiovascular diagnostic labs prior to consultation",
            "requested_categories": ["Lab Reports", "Prescriptions"]
        }, format='json')
        self.assertEqual(req_resp.status_code, status.HTTP_201_CREATED)

        req_id = req_resp.data['request']['id']
        consent_req = ConsentRequest.objects.get(id=req_id)
        self.assertEqual(consent_req.status, 'pending')

        # Patient approves request with 7 days validity
        self.client.force_authenticate(user=self.patient)
        approve_resp = self.client.post(f'/api/consent/requests/{req_id}/approve/', {
            "duration_type": "7_days",
            "can_view_lab_reports": True,
            "can_view_prescriptions": True,
            "can_view_clinical_notes": False
        }, format='json')
        self.assertEqual(approve_resp.status_code, status.HTTP_200_OK)

        # Verify request status in DB
        consent_req.refresh_from_db()
        self.assertEqual(consent_req.status, 'approved')

        # Verify history entry
        history_entry = ConsentHistory.objects.filter(patient=self.patient, doctor=self.doctor, action='APPROVED').first()
        self.assertIsNotNone(history_entry)

        # Doctor 1 accesses approved records
        self.client.force_authenticate(user=self.doctor)
        records_resp = self.client.get(f'/api/doctor/consent/records/?patientId={self.patient.id}')
        self.assertEqual(records_resp.status_code, status.HTTP_200_OK)
        rec_ids = [r['id'] for r in records_resp.data.get('records', [])]
        self.assertIn(self.rec1.id, rec_ids)
        self.assertIn(self.rec2.id, rec_ids)
        self.assertNotIn(self.rec3.id, rec_ids)

    # =========================================================================
    # SCENARIO C: Doctor Requests -> Patient Rejects -> Doctor Access Locked (403)
    # =========================================================================
    def test_scenario_c_request_and_reject_flow(self):
        # Doctor 1 requests
        self.client.force_authenticate(user=self.doctor)
        req_resp = self.client.post('/api/doctor/consent/request/', {
            "patient_id": self.patient.id,
            "access_purpose": "Reviewing full diagnostic history",
            "requested_categories": ["Lab Reports"]
        }, format='json')
        req_id = req_resp.data['request']['id']

        # Patient rejects
        self.client.force_authenticate(user=self.patient)
        reject_resp = self.client.post(f'/api/consent/requests/{req_id}/reject/', {
            "rejection_reason": "Records are not relevant to current consultation"
        }, format='json')
        self.assertEqual(reject_resp.status_code, status.HTTP_200_OK)

        # Verify request in DB
        consent_req = ConsentRequest.objects.get(id=req_id)
        self.assertEqual(consent_req.status, 'rejected')
        self.assertEqual(consent_req.rejection_reason, "Records are not relevant to current consultation")

        # Doctor attempts access -> Must be denied 403
        self.client.force_authenticate(user=self.doctor)
        access_resp = self.client.get(f'/api/doctor/consent/records/?patientId={self.patient.id}')
        self.assertEqual(access_resp.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(access_resp.data.get('status'), 'LOCKED')

    # =========================================================================
    # SCENARIO D: Patient Revokes Consent -> Doctor Loses Access Immediately
    # =========================================================================
    def test_scenario_d_revoke_access_immediately(self):
        # Create active consent
        consent = PatientConsent.objects.create(
            patient=self.patient,
            doctor=self.doctor,
            status='active',
            valid_until=timezone.now() + timedelta(hours=24),
            can_view_lab_reports=True,
            can_view_prescriptions=True
        )

        # Doctor can access initially
        self.client.force_authenticate(user=self.doctor)
        resp1 = self.client.get(f'/api/doctor/consent/records/?patientId={self.patient.id}')
        self.assertEqual(resp1.status_code, status.HTTP_200_OK)

        # Patient revokes
        self.client.force_authenticate(user=self.patient)
        revoke_resp = self.client.post(f'/api/consent/{consent.id}/revoke/', {
            "revocation_reason": "Consultation concluded; terminating record delegation."
        }, format='json')
        self.assertEqual(revoke_resp.status_code, status.HTTP_200_OK)

        consent.refresh_from_db()
        self.assertEqual(consent.status, 'revoked')

        # Doctor immediately re-queries -> 403 Forbidden
        self.client.force_authenticate(user=self.doctor)
        resp2 = self.client.get(f'/api/doctor/consent/records/?patientId={self.patient.id}')
        self.assertEqual(resp2.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(resp2.data.get('status'), 'LOCKED')

        # Verify revocation event is logged in ConsentHistory
        rev_history = ConsentHistory.objects.filter(patient=self.patient, doctor=self.doctor, action='REVOKED').first()
        self.assertIsNotNone(rev_history)

    # =========================================================================
    # SCENARIO E: Consent Validity Window Expires -> Automatic Lockout
    # =========================================================================
    def test_scenario_e_expired_consent_denial(self):
        # Create an expired consent
        past_time = timezone.now() - timedelta(hours=1)
        expired_consent = PatientConsent.objects.create(
            patient=self.patient,
            doctor=self.doctor,
            status='active',  # before cron/auto-expire
            valid_until=past_time,
            can_view_lab_reports=True
        )

        # Trigger auto-expiration via patient dashboard or doctor query
        self.client.force_authenticate(user=self.patient)
        dash_resp = self.client.get('/api/consent/dashboard/')
        self.assertEqual(dash_resp.status_code, status.HTTP_200_OK)

        expired_consent.refresh_from_db()
        self.assertEqual(expired_consent.status, 'expired')

        # Doctor attempts access -> 403 Forbidden
        self.client.force_authenticate(user=self.doctor)
        access_resp = self.client.get(f'/api/doctor/consent/records/?patientId={self.patient.id}')
        self.assertEqual(access_resp.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn("expired", access_resp.data.get('reason', '').lower())

    # =========================================================================
    # SCENARIO F: Doctor Views Records -> Action Logged -> Visible in Patient Audit
    # =========================================================================
    def test_scenario_f_audit_logs_visibility(self):
        # Grant consent
        PatientConsent.objects.create(
            patient=self.patient,
            doctor=self.doctor,
            status='active',
            valid_until=timezone.now() + timedelta(hours=24),
            can_view_lab_reports=True
        )

        # Doctor accesses records
        self.client.force_authenticate(user=self.doctor)
        access_resp = self.client.get(f'/api/doctor/consent/records/?patientId={self.patient.id}')
        self.assertEqual(access_resp.status_code, status.HTTP_200_OK)

        # Verify RecordAccessLog exists in DB
        access_log = RecordAccessLog.objects.filter(patient=self.patient, doctor=self.doctor, record=self.rec1).first()
        self.assertIsNotNone(access_log)
        self.assertEqual(access_log.access_type, 'VIEW')
        self.assertEqual(access_log.permission_status, 'AUTHORIZED')

        # Patient inspects audit logs endpoint
        self.client.force_authenticate(user=self.patient)
        audit_resp = self.client.get('/api/consent/audit-logs/')
        self.assertEqual(audit_resp.status_code, status.HTTP_200_OK)
        logs = audit_resp.data
        self.assertTrue(len(logs) > 0)
        first_log = logs[0]
        self.assertIn("Dr.", first_log.get('doctor_name', ''))
        self.assertEqual(first_log.get('access_type'), 'VIEW')

    # =========================================================================
    # SCENARIO G: Emergency Break-Glass Protocols
    # =========================================================================
    def test_scenario_g_emergency_break_glass(self):
        # Doctor 2 invokes emergency break glass
        self.client.force_authenticate(user=self.doctor2)
        justification = "Acute coronary syndrome with severe hypotension in emergency room"
        break_resp = self.client.post('/api/doctor/consent/emergency-access/', {
            "patient_id": self.patient.id,
            "justification": justification
        }, format='json')
        self.assertEqual(break_resp.status_code, status.HTTP_200_OK)
        self.assertIn("emergency_log", break_resp.data)

        # Verify DB log
        em_log = EmergencyAccessLog.objects.filter(patient=self.patient, doctor=self.doctor2).first()
        self.assertIsNotNone(em_log)
        self.assertEqual(em_log.justification, justification)

        # Doctor 2 can now access patient records with EMERGENCY_OVERRIDE status
        access_resp = self.client.get(f'/api/doctor/consent/records/?patientId={self.patient.id}')
        self.assertEqual(access_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(access_resp.data.get('status'), 'EMERGENCY_OVERRIDE')

        # Patient disables emergency break-glass
        self.client.force_authenticate(user=self.patient)
        setting_resp = self.client.post('/api/consent/emergency-settings/', {
            "allow_emergency_break_glass": False
        }, format='json')
        self.assertEqual(setting_resp.status_code, status.HTTP_200_OK)

        # Doctor 1 attempts emergency break glass -> 403 Forbidden
        self.client.force_authenticate(user=self.doctor)
        blocked_resp = self.client.post('/api/doctor/consent/emergency-access/', {
            "patient_id": self.patient.id,
            "justification": "Patient unconscious in trauma bay requiring records"
        }, format='json')
        self.assertEqual(blocked_resp.status_code, status.HTTP_403_FORBIDDEN)

    # =========================================================================
    # SCENARIO H: Security & Validation Checks
    # =========================================================================
    def test_security_validations(self):
        # 1. Non-doctor cannot request consent
        self.client.force_authenticate(user=self.patient)
        bad_req = self.client.post('/api/doctor/consent/request/', {
            "patient_id": self.patient.id,
            "access_purpose": "Trying to request access as patient"
        }, format='json')
        self.assertEqual(bad_req.status_code, status.HTTP_403_FORBIDDEN)

        # 2. Patient cannot grant consent to self
        bad_grant = self.client.post('/api/consent/grant/', {
            "doctor_id": self.patient.id,
            "duration_type": "24_hours"
        }, format='json')
        self.assertEqual(bad_grant.status_code, status.HTTP_400_BAD_REQUEST)

        # 3. Doctor cannot self-authorize or approve request
        self.client.force_authenticate(user=self.doctor)
        bad_approve = self.client.post(f'/api/consent/requests/999/approve/', format='json')
        self.assertEqual(bad_approve.status_code, status.HTTP_403_FORBIDDEN)

