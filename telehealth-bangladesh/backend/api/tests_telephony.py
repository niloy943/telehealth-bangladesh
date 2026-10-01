import os
import unittest
from unittest.mock import patch, MagicMock
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from twilio.base.exceptions import TwilioRestException

from api.models import (
    DoctorProfile, PatientProfile, Appointment, 
    Consultation, TelephonyCall, AuditLog
)
from api.twilio_service import TwilioTelephonyService, twilio_service

User = get_user_model()


class TelephonyPhoneValidationUnitTests(unittest.TestCase):
    """Scenario 7: Unit tests for phone number sanitization and E.164 compliance."""

    def test_bangladesh_local_number_conversion(self):
        is_valid, formatted, err = TwilioTelephonyService.validate_e164("01712345678")
        self.assertTrue(is_valid)
        self.assertEqual(formatted, "+8801712345678")
        self.assertEqual(err, "")

    def test_bangladesh_all_operator_prefixes(self):
        # 013 (GP), 014 (BL), 015 (Teletalk), 016 (Airtel), 017 (GP), 018 (Robi), 019 (BL)
        operators = ["01311111111", "01422222222", "01533333333", "01644444444", "01755555555", "01866666666", "01977777777"]
        for num in operators:
            is_valid, formatted, err = TwilioTelephonyService.validate_e164(num)
            self.assertTrue(is_valid, f"Failed for {num}")
            self.assertTrue(formatted.startswith("+8801"))

    def test_bangladesh_e164_with_country_code(self):
        is_valid, formatted, err = TwilioTelephonyService.validate_e164("+8801812345678")
        self.assertTrue(is_valid)
        self.assertEqual(formatted, "+8801812345678")

    def test_bangladesh_dashed_and_spaced_input(self):
        is_valid, formatted, err = TwilioTelephonyService.validate_e164("019-12 34 (5678)")
        self.assertTrue(is_valid)
        self.assertEqual(formatted, "+8801912345678")

    def test_international_e164_number(self):
        is_valid, formatted, err = TwilioTelephonyService.validate_e164("+14155552671")
        self.assertTrue(is_valid)
        self.assertEqual(formatted, "+14155552671")

    def test_invalid_phone_formats(self):
        invalid_numbers = [
            "",
            "not-a-number",
            "1234",
            "+00123",
            "01112345678999999999",
            "+12345678901234567890"  # Too long (> 15 digits)
        ]
        for num in invalid_numbers:
            is_valid, formatted, err = TwilioTelephonyService.validate_e164(num)
            self.assertFalse(is_valid, f"Expected {num} to be invalid")


class TelephonyServiceLiveAndMockUnitTests(unittest.TestCase):
    """Tests for TwilioTelephonyService in mock and live modes."""

    def setUp(self):
        self.service = TwilioTelephonyService()

    # 1. Missing Twilio credentials in live mode
    @patch.dict('os.environ', {
        'TWILIO_ENVIRONMENT': 'live',
        'TWILIO_ACCOUNT_SID': '',
        'TWILIO_AUTH_TOKEN': '',
    })
    def test_missing_twilio_credentials_in_live_mode_fails_safely(self):
        res = self.service.initiate_call("+8801712345678", consultation_id=1)
        self.assertFalse(res["success"])
        self.assertEqual(res["code"], "TWILIO_CREDENTIALS_MISSING")
        self.assertEqual(res["mode"], "live")
        self.assertIn("missing or invalid", res["error"])

    # 2. Invalid credentials in live mode (Auth failure)
    @patch('twilio.rest.Client')
    @patch.dict('os.environ', {
        'TWILIO_ENVIRONMENT': 'live',
        'TWILIO_ACCOUNT_SID': 'AC11111111111111111111111111111111',
        'TWILIO_AUTH_TOKEN': '22222222222222222222222222222222',
    })
    def test_invalid_credentials_auth_failure(self, mock_client_cls):
        mock_client = MagicMock()
        mock_client.calls.create.side_effect = TwilioRestException(
            status=401, uri="/2010-04-01/Accounts/calls.json", msg="Authenticate", code=20003
        )
        mock_client_cls.return_value = mock_client

        res = self.service.initiate_call("+8801712345678", consultation_id=1)
        self.assertFalse(res["success"])
        self.assertEqual(res["mode"], "live")
        self.assertEqual(res["code"], "TWILIO_ERR_20003")
        self.assertIn("Authentication error", res["error"])

    # 3. Live-mode configuration & outbound call
    @patch('twilio.rest.Client')
    @patch.dict('os.environ', {
        'TWILIO_ENVIRONMENT': 'live',
        'TWILIO_ACCOUNT_SID': 'AC11111111111111111111111111111111',
        'TWILIO_AUTH_TOKEN': '22222222222222222222222222222222',
        'TWILIO_PHONE_NUMBER': '+18005550199'
    })
    def test_live_mode_configuration_and_call(self, mock_client_cls):
        mock_client = MagicMock()
        mock_call = MagicMock()
        mock_call.sid = "CA1234567890abcdef1234567890abcdef"
        mock_call.status = "queued"
        mock_client.calls.create.return_value = mock_call
        mock_client_cls.return_value = mock_client

        res = self.service.initiate_call("+8801712345678", consultation_id=101)
        self.assertTrue(res["success"])
        self.assertEqual(res["mode"], "live")
        self.assertEqual(res["call_sid"], "CA1234567890abcdef1234567890abcdef")
        mock_client.calls.create.assert_called_once()

    # 4. Mock-mode configuration
    def test_mock_mode_configuration_and_call(self):
        self.service.environment = "sandbox"
        self.service.is_live = False

        res = self.service.initiate_call("+8801712345678", consultation_id=42)
        self.assertTrue(res["success"])
        self.assertEqual(res["mode"], "mock")
        self.assertTrue(res["call_sid"].startswith("CA_MOCK_"))
        self.assertEqual(res["to"], "+8801712345678")
        self.assertEqual(res["status"], "queued")

    # 11. Twilio API failure handling
    @patch('twilio.rest.Client')
    @patch.dict('os.environ', {
        'TWILIO_ENVIRONMENT': 'live',
        'TWILIO_ACCOUNT_SID': 'AC11111111111111111111111111111111',
        'TWILIO_AUTH_TOKEN': '22222222222222222222222222222222',
    })
    def test_twilio_api_general_failure_handled(self, mock_client_cls):
        mock_client = MagicMock()
        mock_client.calls.create.side_effect = Exception("Connection timeout")
        mock_client_cls.return_value = mock_client

        res = self.service.initiate_call("+8801712345678", consultation_id=1)
        self.assertFalse(res["success"])
        self.assertEqual(res["code"], "TWILIO_ERROR")
        self.assertNotIn("22222222222222222222222222222222", str(res))  # Never leak token

    # 13. Webhook signature validation
    @patch('twilio.request_validator.RequestValidator.validate')
    @patch.dict('os.environ', {
        'TWILIO_ENVIRONMENT': 'live',
        'TWILIO_ACCOUNT_SID': 'AC11111111111111111111111111111111',
        'TWILIO_AUTH_TOKEN': '22222222222222222222222222222222',
    })
    def test_webhook_signature_validation_in_live_mode(self, mock_validate):
        # Valid signature
        mock_validate.return_value = True
        self.assertTrue(self.service.validate_webhook_signature("https://api.healnsight.com/twiml/", {}, "valid_sig"))

        # Invalid signature
        mock_validate.return_value = False
        self.assertFalse(self.service.validate_webhook_signature("https://api.healnsight.com/twiml/", {}, "bad_sig"))

        # Empty signature in live mode must fail
        self.assertFalse(self.service.validate_webhook_signature("https://api.healnsight.com/twiml/", {}, ""))


class TelephonyAPITestCase(TestCase):
    """Integration test suite for Telephony REST API endpoints, TwiML, and Audit Logs."""

    def setUp(self):
        self.client = APIClient()

        # Create doctor
        self.doctor = User.objects.create_user(
            username="testdoctor",
            password="DoctorPass123!",
            role="doctor",
            phone="+8801711111111",
            first_name="Rahim",
            last_name="Chowdhury"
        )
        DoctorProfile.objects.create(
            user=self.doctor,
            specialty="Cardiology",
            fees=800,
            verification_status="approved"
        )

        # Create patient
        self.patient = User.objects.create_user(
            username="testpatient",
            password="PatientPass123!",
            role="patient",
            phone="+8801822222222",
            first_name="Fatima",
            last_name="Begum"
        )
        PatientProfile.objects.create(
            user=self.patient,
            blood_group="O+"
        )

        # Create appointment and consultation
        self.appointment = Appointment.objects.create(
            patient=self.patient,
            doctor=self.doctor,
            date="2026-09-01",
            time="10:00 AM",
            reason="Routine Checkup",
            status="approved"
        )
        self.consultation = Consultation.objects.create(
            appointment=self.appointment,
            type="phone",
            status="active"
        )

    def test_unauthenticated_call_initiation_fails(self):
        response = self.client.post('/api/telephony/call/', {
            'phone': '+8801712345678'
        })
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    # 5. Unauthorized user cannot initiate or terminate consultation call
    def test_unauthorized_user_cannot_call_for_consultation(self):
        other_user = User.objects.create_user(
            username="otheruser",
            password="OtherPass123!",
            role="patient",
            phone="+8801933333333"
        )
        self.client.force_authenticate(user=other_user)
        response = self.client.post('/api/telephony/call/', {
            'phone': '+8801822222222',
            'consultation_id': self.consultation.id
        })
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    # 6. Invalid consultation returns 404
    def test_invalid_consultation_returns_404(self):
        self.client.force_authenticate(user=self.doctor)
        response = self.client.post('/api/telephony/call/', {
            'phone': '+8801822222222',
            'consultation_id': 99999
        })
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    # 7. Invalid phone number rejected
    def test_call_initiation_with_invalid_phone_fails(self):
        self.client.force_authenticate(user=self.doctor)
        response = self.client.post('/api/telephony/call/', {
            'phone': 'invalid_phone_number_123',
            'consultation_id': self.consultation.id
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        data = response.json()
        self.assertFalse(data["success"])
        self.assertEqual(data["code"], "INVALID_PHONE_NUMBER")

        # Verify failed audit log
        audit = AuditLog.objects.filter(action="TELEPHONY_CALL_FAILED").first()
        self.assertIsNotNone(audit)

    # 8. Successful call initiation
    def test_authenticated_doctor_initiates_call_in_mock_mode(self):
        self.client.force_authenticate(user=self.doctor)
        response = self.client.post('/api/telephony/call/', {
            'phone': '+8801822222222',
            'consultation_id': self.consultation.id
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.json()
        self.assertTrue(data["success"])
        self.assertEqual(data["mode"], "mock")
        self.assertTrue(data["call_sid"].startswith("CA_MOCK_"))
        self.assertEqual(data["to"], "+8801822222222")

        # Verify TelephonyCall DB record
        call_record = TelephonyCall.objects.filter(twilio_call_sid=data["call_sid"]).first()
        self.assertIsNotNone(call_record)
        self.assertEqual(call_record.caller, self.doctor)
        self.assertEqual(call_record.consultation, self.consultation)
        self.assertEqual(call_record.mode, "mock")

    # 9. Call termination
    # 10. Call status retrieval
    def test_call_status_and_termination_flow(self):
        self.client.force_authenticate(user=self.doctor)

        # 1. Initiate
        init_res = self.client.post('/api/telephony/call/', {
            'phone': '+8801822222222',
            'consultation_id': self.consultation.id
        })
        call_sid = init_res.json()["call_sid"]

        # 2. Get Status
        status_res = self.client.get(f'/api/telephony/call/{call_sid}/status/')
        self.assertEqual(status_res.status_code, status.HTTP_200_OK)
        self.assertTrue(status_res.json()["success"])
        self.assertEqual(status_res.json()["call_sid"], call_sid)

        # 3. Terminate Call
        term_res = self.client.post(f'/api/telephony/call/{call_sid}/terminate/')
        self.assertEqual(term_res.status_code, status.HTTP_200_OK)
        self.assertTrue(term_res.json()["success"])

        # Check DB update
        call_record = TelephonyCall.objects.get(twilio_call_sid=call_sid)
        self.assertEqual(call_record.status, "completed")
        self.assertIsNotNone(call_record.ended_at)

        # Check Termination Audit Log
        term_audit = AuditLog.objects.filter(action="TELEPHONY_CALL_TERMINATED").first()
        self.assertIsNotNone(term_audit)

    # 12. Webhook / TwiML generation
    def test_twiml_webhook_returns_valid_xml(self):
        # TwiML endpoint should be publicly accessible for Twilio servers (AllowAny)
        response = self.client.get('/api/telephony/twiml/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("application/xml", response["Content-Type"])
        self.assertIn("<Response>", response.content.decode('utf-8'))
        self.assertIn("HealNSight", response.content.decode('utf-8'))

        # Also test with consultation_id
        response_consultation = self.client.post(f'/api/telephony/twiml/{self.consultation.id}/')
        self.assertEqual(response_consultation.status_code, status.HTTP_200_OK)
        self.assertIn(f"consultation #{self.consultation.id}", response_consultation.content.decode('utf-8'))

    # 14. Audit logging
    def test_audit_logging_events_recorded_securely(self):
        self.client.force_authenticate(user=self.doctor)

        # Trigger call initiation
        init_res = self.client.post('/api/telephony/call/', {
            'phone': '+8801822222222',
            'consultation_id': self.consultation.id
        })
        call_sid = init_res.json()["call_sid"]

        # Terminate call
        self.client.post(f'/api/telephony/call/{call_sid}/terminate/')

        # Check AuditLog
        init_log = AuditLog.objects.filter(action="TELEPHONY_CALL_INITIATED").first()
        term_log = AuditLog.objects.filter(action="TELEPHONY_CALL_TERMINATED").first()

        self.assertIsNotNone(init_log)
        self.assertIsNotNone(term_log)
        self.assertEqual(init_log.user, self.doctor)

        # Confirm no secret token is stored in audit logs
        for log in AuditLog.objects.all():
            self.assertNotIn("TWILIO_AUTH_TOKEN", log.details)
            self.assertNotIn("your_twilio_auth_token", log.details)
