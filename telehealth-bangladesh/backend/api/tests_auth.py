from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth import get_user_model
from django.utils import timezone
from api.models import OTPCode, LoginAttempt
import hashlib

User = get_user_model()

class PasswordRecoveryTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="testuser", email="test@example.com", phone="01711111111", password="OldPassword123!")

    def test_forgot_password_generates_otp(self):
        response = self.client.post('/api/auth/forgot-password/', {'email_or_phone': 'test@example.com'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verify OTP is created
        otp_exists = OTPCode.objects.filter(user=self.user, purpose='password_reset', is_used=False).exists()
        self.assertTrue(otp_exists)

    def test_verify_otp_success(self):
        # Generate OTP
        self.client.post('/api/auth/forgot-password/', {'email_or_phone': 'test@example.com'})
        otp_record = OTPCode.objects.filter(user=self.user, purpose='password_reset', is_used=False).first()
        
        # Manually set a known OTP hash for testing
        otp_val = "123456"
        otp_hash = hashlib.sha256(otp_val.encode('utf-8')).hexdigest()
        otp_record.code_hash = otp_hash
        otp_record.save()
        
        response = self.client.post('/api/auth/verify-otp/', {'email_or_phone': 'test@example.com', 'otp': otp_val})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('reset_token', response.data)
        
        # Verify it was marked as used
        otp_record.refresh_from_db()
        self.assertTrue(otp_record.is_used)

    def test_verify_otp_invalid(self):
        # Generate OTP
        self.client.post('/api/auth/forgot-password/', {'email_or_phone': 'test@example.com'})
        
        response = self.client.post('/api/auth/verify-otp/', {'email_or_phone': 'test@example.com', 'otp': '000000'})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Incorrect verification code", response.data['error'])

    def test_reset_password_success(self):
        # 1. Setup a valid reset_token using the signer
        from django.core.signing import TimestampSigner
        signer = TimestampSigner(salt=self.user.password)
        reset_token = signer.sign(f"{self.user.id}:password_reset")
        
        new_password = "NewStrongPassword@2024!"
        
        response = self.client.post('/api/auth/reset-password/', {
            'reset_token': reset_token,
            'new_password': new_password,
            'confirm_password': new_password
        })
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verify password changed
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(new_password))

    def test_reset_password_weak(self):
        from django.core.signing import TimestampSigner
        signer = TimestampSigner(salt=self.user.password)
        reset_token = signer.sign(f"{self.user.id}:password_reset")
        
        # Weak password missing special character
        new_password = "WeakPassword123"
        
        response = self.client.post('/api/auth/reset-password/', {
            'reset_token': reset_token,
            'new_password': new_password,
            'confirm_password': new_password
        })
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Password does not meet safety policies", response.data['error'])
