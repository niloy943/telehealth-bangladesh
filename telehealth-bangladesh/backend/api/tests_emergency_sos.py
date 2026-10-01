import os
import unittest
from unittest.mock import patch, MagicMock
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status

from api.models import EmergencyAlert, AuditLog
from api.twilio_service import TwilioTelephonyService

User = get_user_model()


class EmergencySOSWorkflowTests(TestCase):
    """
    Comprehensive test suite for the HealNSight Real Emergency SOS Workflow.
    Verifies authentication, RBAC, geolocation validation, Twilio SMS dispatch,
    rate limiting, privacy safety, audit logging, and resolution lifecycle.
    """

    def setUp(self):
        self.client = APIClient()

        # Patient User 1
        self.patient1 = User.objects.create_user(
            username="patient_emergency1",
            email="patient1@telehealth.bd",
            password="SecurePassword123!",
            role="patient",
            first_name="Rahim",
            last_name="Uddin",
            phone="+8801711111111"
        )

        # Patient User 2
        self.patient2 = User.objects.create_user(
            username="patient_emergency2",
            email="patient2@telehealth.bd",
            password="SecurePassword123!",
            role="patient",
            first_name="Fatima",
            last_name="Begum",
            phone="+8801722222222"
        )

        # Doctor User
        self.doctor = User.objects.create_user(
            username="dr_emergency_test",
            email="doctor@telehealth.bd",
            password="SecurePassword123!",
            role="doctor",
            first_name="Dr. Tanvir",
            last_name="Ahmed",
            phone="+8801733333333"
        )

        # Admin User
        self.admin = User.objects.create_superuser(
            username="admin_emergency",
            email="admin@telehealth.bd",
            password="SecurePassword123!",
            role="admin"
        )

        self.sos_url = reverse("emergency_sos")

    def test_01_patient_can_trigger_emergency_sos_with_coordinates(self):
        """Scenario 1: Authenticated patient triggers SOS with valid coordinates; Twilio sends SMS."""
        self.client.force_authenticate(user=self.patient1)

        payload = {
            "latitude": 23.810332,
            "longitude": 90.412518,
            "location_accuracy": 15.5
        }

        with patch.dict(os.environ, {"EMERGENCY_CONTACT_NUMBERS": "+8801700000001"}):
            with patch("api.views.twilio_service.send_emergency_sms") as mock_sms:
                mock_sms.return_value = {
                    "success": True,
                    "sid": "SM_emergency_mock_sid_123",
                    "status": "queued",
                    "to": "+8801700000001"
                }

                response = self.client.post(self.sos_url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.data

        self.assertEqual(data["contacts_notified"], 1)
        alert_data = data["alert"]
        self.assertEqual(alert_data["status"], "SMS_SENT")
        self.assertEqual(alert_data["sms_status"], "SENT")
        self.assertTrue(alert_data["location_available"])
        self.assertIn("google.com/maps", alert_data["map_url"])

        # Check DB record
        alert_db = EmergencyAlert.objects.get(id=alert_data["id"])
        self.assertEqual(alert_db.patient, self.patient1)
        self.assertEqual(alert_db.status, EmergencyAlert.Status.SMS_SENT)
        self.assertEqual(alert_db.twilio_message_sid, "SM_emergency_mock_sid_123")
        self.assertIsNotNone(alert_db.sms_sent_at)

        # Check Audit Log
        audit = AuditLog.objects.filter(user=self.patient1, action="EMERGENCY_SOS_SMS_SENT").first()
        self.assertIsNotNone(audit)

    def test_02_patient_can_trigger_sos_without_coordinates(self):
        """Scenario 2: Patient device cannot obtain GPS; alert is still created with location_available=False."""
        self.client.force_authenticate(user=self.patient1)

        with patch.dict(os.environ, {"EMERGENCY_CONTACT_NUMBERS": "+8801700000001"}):
            with patch("api.views.twilio_service.send_emergency_sms") as mock_sms:
                mock_sms.return_value = {"success": True, "sid": "SM_mock_no_coords", "status": "queued"}
                response = self.client.post(self.sos_url, {}, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        alert_data = response.data["alert"]
        self.assertFalse(alert_data["location_available"])
        self.assertIsNone(alert_data["latitude"])
        self.assertIsNone(alert_data["map_url"])

        # Check that SMS body noted location as unavailable
        called_args, called_kwargs = mock_sms.call_args
        self.assertIn("Location unavailable", called_args[1])

    def test_03_sos_requires_authentication(self):
        """Scenario 3: Unauthenticated / anonymous request receives 401 Unauthorized."""
        response = self.client.post(self.sos_url, {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_04_doctor_cannot_trigger_emergency_sos(self):
        """Scenario 4: Doctor role receives 403 Forbidden when attempting to trigger SOS."""
        self.client.force_authenticate(user=self.doctor)
        response = self.client.post(self.sos_url, {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn("Only registered patients", response.data["error"])

    def test_05_rate_limiting_cooldown(self):
        """Scenario 5: Consecutive SOS trigger within cooldown window returns 429 Too Many Requests."""
        self.client.force_authenticate(user=self.patient1)

        with patch.dict(os.environ, {"EMERGENCY_CONTACT_NUMBERS": "+8801700000001", "EMERGENCY_SOS_COOLDOWN_SECONDS": "60"}):
            with patch("api.views.twilio_service.send_emergency_sms") as mock_sms:
                mock_sms.return_value = {"success": True, "sid": "SM_first", "status": "queued"}
                first_resp = self.client.post(self.sos_url, {}, format="json")
                self.assertEqual(first_resp.status_code, status.HTTP_201_CREATED)

                # Immediate second attempt
                second_resp = self.client.post(self.sos_url, {}, format="json")
                self.assertEqual(second_resp.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
                self.assertIn("cooldown_remaining", second_resp.data)
                self.assertIn("already triggered recently", second_resp.data["error"])

    def test_06_cooldown_bypassed_after_resolving_alert(self):
        """Scenario 6: Resolving previous alert allows new SOS even before cooldown timer expires."""
        self.client.force_authenticate(user=self.patient1)

        with patch.dict(os.environ, {"EMERGENCY_CONTACT_NUMBERS": "+8801700000001", "EMERGENCY_SOS_COOLDOWN_SECONDS": "60"}):
            with patch("api.views.twilio_service.send_emergency_sms") as mock_sms:
                mock_sms.return_value = {"success": True, "sid": "SM_first", "status": "queued"}
                first_resp = self.client.post(self.sos_url, {}, format="json")
                alert_id = first_resp.data["alert"]["id"]

                # Resolve alert
                resolve_url = reverse("emergency_sos_resolve", kwargs={"pk": alert_id})
                resolve_resp = self.client.post(resolve_url, {"action": "resolve"}, format="json")
                self.assertEqual(resolve_resp.status_code, status.HTTP_200_OK)

                # Trigger again should succeed now
                mock_sms.return_value = {"success": True, "sid": "SM_second", "status": "queued"}
                second_resp = self.client.post(self.sos_url, {}, format="json")
                self.assertEqual(second_resp.status_code, status.HTTP_201_CREATED)

    def test_07_no_emergency_contacts_configured(self):
        """Scenario 7: When EMERGENCY_CONTACT_NUMBERS is not set, status is SMS_NOT_CONFIGURED."""
        self.client.force_authenticate(user=self.patient1)

        with patch.dict(os.environ, {"EMERGENCY_CONTACT_NUMBERS": ""}):
            response = self.client.post(self.sos_url, {}, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.data
        self.assertEqual(data["contacts_notified"], 0)
        self.assertEqual(data["alert"]["status"], "SMS_NOT_CONFIGURED")
        self.assertEqual(data["alert"]["sms_status"], "NOT_CONFIGURED")

        # Audit log written
        audit = AuditLog.objects.filter(user=self.patient1, action="EMERGENCY_SOS_NO_CONTACTS").first()
        self.assertIsNotNone(audit)

    def test_08_twilio_failure_updates_status_to_sms_failed(self):
        """Scenario 8: If Twilio SMS dispatch fails, alert status is SMS_FAILED."""
        self.client.force_authenticate(user=self.patient1)

        with patch.dict(os.environ, {"EMERGENCY_CONTACT_NUMBERS": "+8801700000001"}):
            with patch("api.views.twilio_service.send_emergency_sms") as mock_sms:
                mock_sms.return_value = {
                    "success": False,
                    "status": "SMS_FAILED",
                    "error": "Twilio 21614: 'To' number is not a valid mobile number."
                }
                response = self.client.post(self.sos_url, {}, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["contacts_notified"], 0)
        self.assertEqual(response.data["alert"]["status"], "SMS_FAILED")
        self.assertIn("21614", response.data["alert"]["failure_reason"])

    def test_09_patient_can_resolve_own_alert(self):
        """Scenario 9: Patient resolves their own active alert."""
        alert = EmergencyAlert.objects.create(
            patient=self.patient1,
            status=EmergencyAlert.Status.SMS_SENT,
            sms_status="SENT"
        )

        self.client.force_authenticate(user=self.patient1)
        resolve_url = reverse("emergency_sos_resolve", kwargs={"pk": alert.id})
        response = self.client.post(resolve_url, {"action": "resolve"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["alert"]["status"], "RESOLVED")

        alert.refresh_from_db()
        self.assertEqual(alert.status, EmergencyAlert.Status.RESOLVED)
        self.assertIsNotNone(alert.resolved_at)

    def test_10_patient_cannot_resolve_other_patients_alert(self):
        """Scenario 10: Patient 2 is forbidden from resolving Patient 1's alert."""
        alert = EmergencyAlert.objects.create(
            patient=self.patient1,
            status=EmergencyAlert.Status.SMS_SENT,
            sms_status="SENT"
        )

        self.client.force_authenticate(user=self.patient2)
        resolve_url = reverse("emergency_sos_resolve", kwargs={"pk": alert.id})
        response = self.client.post(resolve_url, {"action": "resolve"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        alert.refresh_from_db()
        self.assertEqual(alert.status, EmergencyAlert.Status.SMS_SENT)

    def test_11_admin_can_resolve_any_alert(self):
        """Scenario 11: Admin can resolve any patient's alert."""
        alert = EmergencyAlert.objects.create(
            patient=self.patient1,
            status=EmergencyAlert.Status.SMS_SENT,
            sms_status="SENT"
        )

        self.client.force_authenticate(user=self.admin)
        resolve_url = reverse("emergency_sos_resolve", kwargs={"pk": alert.id})
        response = self.client.post(resolve_url, {"action": "resolve"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["alert"]["status"], "RESOLVED")

    def test_12_patient_list_only_sees_own_alerts(self):
        """Scenario 12: Patient GET /api/emergency/sos/ returns only their own alerts."""
        EmergencyAlert.objects.create(patient=self.patient1, status=EmergencyAlert.Status.SMS_SENT)
        EmergencyAlert.objects.create(patient=self.patient2, status=EmergencyAlert.Status.SMS_SENT)

        self.client.force_authenticate(user=self.patient1)
        response = self.client.get(self.sos_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["patient"], self.patient1.id)

    def test_13_admin_list_sees_all_alerts(self):
        """Scenario 13: Admin GET /api/emergency/sos/ returns alerts from all patients."""
        EmergencyAlert.objects.create(patient=self.patient1, status=EmergencyAlert.Status.SMS_SENT)
        EmergencyAlert.objects.create(patient=self.patient2, status=EmergencyAlert.Status.SMS_SENT)

        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self.sos_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(response.data), 2)

    def test_14_sms_body_never_exposes_sensitive_medical_history(self):
        """Scenario 14: SMS message contains only necessary emergency info, no diagnoses or passwords."""
        self.client.force_authenticate(user=self.patient1)

        with patch.dict(os.environ, {"EMERGENCY_CONTACT_NUMBERS": "+8801700000001"}):
            with patch("api.views.twilio_service.send_emergency_sms") as mock_sms:
                mock_sms.return_value = {"success": True, "sid": "SM_safe_test", "status": "queued"}
                payload = {"latitude": 23.810332, "longitude": 90.412518}
                self.client.post(self.sos_url, payload, format="json")

        call_args = mock_sms.call_args[0]
        sms_text = call_args[1]

        # Ensure sensitive words are absent
        for forbidden in ["password", "diagnosis", "prescription", "disease", "token", "jwt", "secret"]:
            self.assertNotIn(forbidden, sms_text.lower())

        # Ensure necessary alert info is present
        self.assertIn("EMERGENCY SOS", sms_text)
        self.assertIn("Rahim Uddin", sms_text)
        self.assertIn("https://www.google.com/maps?q=", sms_text)

    def test_15_twilio_message_sid_not_exposed_in_serializer(self):
        """Scenario 15: twilio_message_sid must NEVER be leaked in frontend API responses."""
        alert = EmergencyAlert.objects.create(
            patient=self.patient1,
            status=EmergencyAlert.Status.SMS_SENT,
            sms_status="SENT",
            twilio_message_sid="SM_SUPER_SECRET_TWILIO_SID_DO_NOT_LEAK"
        )

        self.client.force_authenticate(user=self.patient1)
        response = self.client.get(self.sos_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        alert_json = response.data[0]
        self.assertNotIn("twilio_message_sid", alert_json)
        self.assertNotIn("SM_SUPER_SECRET_TWILIO_SID_DO_NOT_LEAK", str(response.data))

    def test_16_coordinate_validation_bounds(self):
        """Scenario 16: Invalid latitude (>90) or longitude (>180) fails serializer validation."""
        self.client.force_authenticate(user=self.patient1)

        # Latitude out of bounds
        bad_lat_resp = self.client.post(self.sos_url, {"latitude": 95.0, "longitude": 90.0}, format="json")
        self.assertEqual(bad_lat_resp.status_code, status.HTTP_400_BAD_REQUEST)

        # Longitude out of bounds
        bad_lon_resp = self.client.post(self.sos_url, {"latitude": 23.0, "longitude": 195.0}, format="json")
        self.assertEqual(bad_lon_resp.status_code, status.HTTP_400_BAD_REQUEST)
