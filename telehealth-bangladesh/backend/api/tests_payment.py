import unittest
from unittest.mock import patch, MagicMock
from decimal import Decimal
import json

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status

from api.models import (
    User, DoctorProfile, Appointment, MedicineOrder,
    PaymentTransaction, AuditLog
)
from api.payment_service import payment_service


class PaymentGatewayTests(TestCase):
    """
    Comprehensive Test Suite for Live & Sandbox SSLCommerz Payment Gateway.
    Verifies all 20 security, business logic, and gateway interaction scenarios.
    """

    def setUp(self):
        self.client = APIClient()

        # Create Patient User
        self.patient = User.objects.create_user(
            username='patient_tahsin',
            email='tahsin@example.com',
            password='password123',
            role='patient',
            first_name='Tahsin',
            last_name='Ahmed'
        )

        # Create Another Patient for Cross-User Isolation Tests
        self.patient_other = User.objects.create_user(
            username='patient_other',
            email='other@example.com',
            password='password123',
            role='patient',
            first_name='Other',
            last_name='User'
        )

        # Create Doctor User & Profile
        self.doctor = User.objects.create_user(
            username='doctor_sarah',
            email='sarah@example.com',
            password='password123',
            role='doctor',
            first_name='Sarah',
            last_name='Jenkins'
        )
        self.doctor_profile = DoctorProfile.objects.create(
            user=self.doctor,
            specialty='Cardiology',
            fees=Decimal('750.00'),
            verification_status='approved'
        )

        # Create Sample Appointment
        self.appointment = Appointment.objects.create(
            patient=self.patient,
            doctor=self.doctor,
            date=timezone.now().date(),
            time='10:30 AM',
            reason='Heart consultation',
            status='pending',
            payment_status='unpaid'
        )

        # Create Sample Medicine Order
        self.order = MedicineOrder.objects.create(
            patient=self.patient,
            delivery_address='Dhanmondi, Dhaka',
            items_breakdown=[{'medicine_id': 1, 'name': 'Napa Extra', 'price': 25.0, 'quantity': 2}],
            delivery_fee=Decimal('50.00'),
            total_price=Decimal('100.00'),
            status='pending'
        )

        # Authenticate as patient_tahsin
        login_resp = self.client.post('/api/login/', {'username': 'patient_tahsin', 'password': 'password123'})
        self.token = login_resp.data['access']
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')

    # Scenario 1: Payment initiation for appointment
    def test_payment_initiation_appointment(self):
        resp = self.client.post('/api/payment/initiate/', {
            'appointment_id': self.appointment.id,
            'payment_method': 'sslcommerz'
        })
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertTrue(resp.data.get('success'))
        self.assertIn('gateway_url', resp.data)
        self.assertIn('transaction_ref', resp.data)
        self.assertEqual(resp.data.get('amount'), 750.0)

        # Verify DB transaction record
        txn = PaymentTransaction.objects.get(transaction_ref=resp.data['transaction_ref'])
        self.assertEqual(txn.appointment, self.appointment)
        self.assertEqual(txn.amount, Decimal('750.00'))
        self.assertEqual(txn.status, 'pending')

    # Scenario 2: Payment initiation for pharmacy order
    def test_payment_initiation_order(self):
        resp = self.client.post('/api/payment/initiate/', {
            'order_id': self.order.id,
            'payment_method': 'bkash'
        })
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertTrue(resp.data.get('success'))
        self.assertEqual(resp.data.get('amount'), 100.0)

        txn = PaymentTransaction.objects.get(transaction_ref=resp.data['transaction_ref'])
        self.assertEqual(txn.order, self.order)
        self.assertEqual(txn.amount, Decimal('100.00'))

    # Scenario 3: Authentication requirement (401 for unauthenticated)
    def test_authentication_required(self):
        anon_client = APIClient()
        resp = anon_client.post('/api/payment/initiate/', {'appointment_id': self.appointment.id})
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    # Scenario 4: Correct server-side amount enforcement (ignores fraudulent client amount)
    def test_server_side_amount_enforced(self):
        # Client attempts to pay 10 BDT instead of doctor fee 750 BDT
        resp = self.client.post('/api/payment/initiate/', {
            'appointment_id': self.appointment.id,
            'amount': 10.0,
            'total_price': 10.0
        })
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        # Authoritative amount must be 750.0 BDT
        self.assertEqual(resp.data.get('amount'), 750.0)
        txn = PaymentTransaction.objects.get(transaction_ref=resp.data['transaction_ref'])
        self.assertEqual(txn.amount, Decimal('750.00'))

    # Scenario 5: Transaction created in DB with status pending
    def test_transaction_created_in_db_pending(self):
        init_resp = self.client.post('/api/payment/initiate/', {'appointment_id': self.appointment.id})
        txn_ref = init_resp.data['transaction_ref']
        txn = PaymentTransaction.objects.get(transaction_ref=txn_ref)
        self.assertEqual(txn.status, 'pending')
        self.assertEqual(txn.currency, 'BDT')

    # Scenario 6: Successful validation marks transaction completed
    def test_successful_validation_marks_completed(self):
        init_resp = self.client.post('/api/payment/initiate/', {'appointment_id': self.appointment.id})
        txn_ref = init_resp.data['transaction_ref']

        with patch.object(payment_service, 'validate_transaction') as mock_val:
            mock_val.return_value = {
                'is_valid': True,
                'status': 'completed',
                'val_id': 'VAL-TEST-12345',
                'bank_tran_id': 'BANK-998877',
                'card_type': 'BKASH-BKash',
                'card_brand': 'bKash',
                'amount': 750.0,
                'currency': 'BDT',
                'gateway_response': {'status': 'VALID'}
            }

            cb_resp = self.client.post(
                f'/api/payment/callback/?status=success',
                {'tran_id': txn_ref, 'val_id': 'VAL-TEST-12345'},
                HTTP_ACCEPT='application/json'
            )
            self.assertEqual(cb_resp.status_code, status.HTTP_200_OK)
            self.assertEqual(cb_resp.data.get('status'), 'completed')

            txn = PaymentTransaction.objects.get(transaction_ref=txn_ref)
            self.assertEqual(txn.status, 'completed')
            self.assertEqual(txn.val_id, 'VAL-TEST-12345')

            # Linked appointment should be marked paid & approved
            self.appointment.refresh_from_db()
            self.assertEqual(self.appointment.payment_status, 'paid')
            self.assertEqual(self.appointment.status, 'approved')

    # Scenario 7: Failed validation marks transaction failed
    def test_failed_validation_marks_failed(self):
        init_resp = self.client.post('/api/payment/initiate/', {'appointment_id': self.appointment.id})
        txn_ref = init_resp.data['transaction_ref']

        with patch.object(payment_service, 'validate_transaction') as mock_val:
            mock_val.return_value = {
                'is_valid': False,
                'status': 'failed',
                'message': 'Gateway verification failed: Invalid transaction hash'
            }

            cb_resp = self.client.post(
                f'/api/payment/callback/?status=success',
                {'tran_id': txn_ref, 'val_id': 'BAD-VAL'},
                HTTP_ACCEPT='application/json'
            )
            self.assertEqual(cb_resp.status_code, status.HTTP_400_BAD_REQUEST)
            txn = PaymentTransaction.objects.get(transaction_ref=txn_ref)
            self.assertEqual(txn.status, 'failed')
            self.assertIn('Gateway verification failed', txn.failure_reason)

    # Scenario 8: Amount mismatch detected and marked failed
    def test_amount_mismatch_fails_transaction(self):
        init_resp = self.client.post('/api/payment/initiate/', {'appointment_id': self.appointment.id})
        txn_ref = init_resp.data['transaction_ref']

        with patch.object(payment_service, 'validate_transaction') as mock_val:
            mock_val.return_value = {
                'is_valid': False,
                'status': 'failed',
                'message': 'Payment amount mismatch: expected 750.0 BDT, received 100.0 BDT.'
            }

            cb_resp = self.client.post(
                f'/api/payment/callback/?status=success',
                {'tran_id': txn_ref, 'val_id': 'VAL-UNDERPAID'},
                HTTP_ACCEPT='application/json'
            )
            self.assertEqual(cb_resp.status_code, status.HTTP_400_BAD_REQUEST)
            txn = PaymentTransaction.objects.get(transaction_ref=txn_ref)
            self.assertEqual(txn.status, 'failed')
            self.assertIn('Payment amount mismatch', txn.failure_reason)

    # Scenario 9: Currency mismatch detected and marked failed
    def test_currency_mismatch_fails_transaction(self):
        init_resp = self.client.post('/api/payment/initiate/', {'appointment_id': self.appointment.id})
        txn_ref = init_resp.data['transaction_ref']

        with patch.object(payment_service, 'validate_transaction') as mock_val:
            mock_val.return_value = {
                'is_valid': False,
                'status': 'failed',
                'message': 'Currency mismatch: expected BDT, received USD.'
            }

            cb_resp = self.client.post(
                f'/api/payment/callback/?status=success',
                {'tran_id': txn_ref, 'val_id': 'VAL-USD'},
                HTTP_ACCEPT='application/json'
            )
            self.assertEqual(cb_resp.status_code, status.HTTP_400_BAD_REQUEST)
            txn = PaymentTransaction.objects.get(transaction_ref=txn_ref)
            self.assertEqual(txn.status, 'failed')

    # Scenario 10: Unknown transaction reference returns 404
    def test_unknown_transaction_reference_returns_404(self):
        cb_resp = self.client.post(
            f'/api/payment/callback/?status=success',
            {'tran_id': 'NON_EXISTENT_TXN_REF'},
            HTTP_ACCEPT='application/json'
        )
        self.assertEqual(cb_resp.status_code, status.HTTP_404_NOT_FOUND)

    # Scenario 11: Cross-user transaction privacy (403 PermissionDenied)
    def test_cross_user_transaction_privacy(self):
        init_resp = self.client.post('/api/payment/initiate/', {'appointment_id': self.appointment.id})
        txn_ref = init_resp.data['transaction_ref']

        # Log in as patient_other
        login_other = self.client.post('/api/login/', {'username': 'patient_other', 'password': 'password123'})
        token_other = login_other.data['access']
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token_other}')

        # Attempt to view patient_tahsin's transaction status
        status_resp = self.client.get(f'/api/payment/status/{txn_ref}/')
        self.assertEqual(status_resp.status_code, status.HTTP_403_FORBIDDEN)

    # Scenario 12: Duplicate callback / Idempotency check
    def test_idempotent_duplicate_callbacks(self):
        init_resp = self.client.post('/api/payment/initiate/', {'appointment_id': self.appointment.id})
        txn_ref = init_resp.data['transaction_ref']

        with patch.object(payment_service, 'validate_transaction') as mock_val:
            mock_val.return_value = {
                'is_valid': True,
                'status': 'completed',
                'val_id': 'VAL-IDEMPOTENT-1',
                'bank_tran_id': 'BANK-11',
                'card_type': 'VISA',
                'amount': 750.0,
                'currency': 'BDT'
            }

            # First callback
            resp1 = self.client.post(
                f'/api/payment/callback/?status=success',
                {'tran_id': txn_ref, 'val_id': 'VAL-IDEMPOTENT-1'},
                HTTP_ACCEPT='application/json'
            )
            self.assertEqual(resp1.status_code, status.HTTP_200_OK)

            # Second identical callback
            resp2 = self.client.post(
                f'/api/payment/callback/?status=success',
                {'tran_id': txn_ref, 'val_id': 'VAL-IDEMPOTENT-1'},
                HTTP_ACCEPT='application/json'
            )
            self.assertEqual(resp2.status_code, status.HTTP_200_OK)
            self.assertTrue(resp2.data.get('idempotent'))

            # Ensure only 1 transaction exists
            self.assertEqual(PaymentTransaction.objects.filter(transaction_ref=txn_ref).count(), 1)

    # Scenario 13: Duplicate payment attempt on already paid appointment blocked
    def test_duplicate_payment_attempt_blocked(self):
        self.appointment.payment_status = 'paid'
        self.appointment.save()

        resp = self.client.post('/api/payment/initiate/', {'appointment_id': self.appointment.id})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('already been paid', resp.data.get('error'))

    # Scenario 14: IPN webhook handling updates transaction idempotently
    def test_ipn_webhook_handling(self):
        init_resp = self.client.post('/api/payment/initiate/', {'appointment_id': self.appointment.id})
        txn_ref = init_resp.data['transaction_ref']

        anon_client = APIClient()
        with patch.object(payment_service, 'validate_transaction') as mock_val:
            mock_val.return_value = {
                'is_valid': True,
                'status': 'completed',
                'val_id': 'VAL-IPN-7788',
                'bank_tran_id': 'BANK-IPN-99',
                'card_type': 'NAGAD-Nagad',
                'amount': 750.0,
                'currency': 'BDT'
            }

            ipn_resp = anon_client.post('/api/payment/ipn/', {
                'tran_id': txn_ref,
                'val_id': 'VAL-IPN-7788'
            })
            self.assertEqual(ipn_resp.status_code, status.HTTP_200_OK)
            self.assertEqual(ipn_resp.data.get('status'), 'IPN_SUCCESS')

            txn = PaymentTransaction.objects.get(transaction_ref=txn_ref)
            self.assertEqual(txn.status, 'completed')
            self.assertEqual(txn.val_id, 'VAL-IPN-7788')

    # Scenario 15: Payment cancellation records cancelled
    def test_payment_cancellation_flow(self):
        init_resp = self.client.post('/api/payment/initiate/', {'appointment_id': self.appointment.id})
        txn_ref = init_resp.data['transaction_ref']

        cb_resp = self.client.post(
            f'/api/payment/callback/?status=cancel',
            {'tran_id': txn_ref},
            HTTP_ACCEPT='application/json'
        )
        self.assertEqual(cb_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(cb_resp.data.get('status'), 'cancelled')

        txn = PaymentTransaction.objects.get(transaction_ref=txn_ref)
        self.assertEqual(txn.status, 'cancelled')

    # Scenario 16: Payment failure records failed
    def test_payment_failure_flow(self):
        init_resp = self.client.post('/api/payment/initiate/', {'appointment_id': self.appointment.id})
        txn_ref = init_resp.data['transaction_ref']

        cb_resp = self.client.post(
            f'/api/payment/callback/?status=fail',
            {'tran_id': txn_ref, 'error': 'Insufficient funds on bKash account'},
            HTTP_ACCEPT='application/json'
        )
        self.assertEqual(cb_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(cb_resp.data.get('status'), 'failed')

        txn = PaymentTransaction.objects.get(transaction_ref=txn_ref)
        self.assertEqual(txn.status, 'failed')
        self.assertIn('Insufficient funds', txn.failure_reason)

    # Scenario 17: Pending state query via status endpoint
    def test_pending_state_query(self):
        init_resp = self.client.post('/api/payment/initiate/', {'appointment_id': self.appointment.id})
        txn_ref = init_resp.data['transaction_ref']

        status_resp = self.client.get(f'/api/payment/status/{txn_ref}/')
        self.assertEqual(status_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(status_resp.data.get('status'), 'pending')
        self.assertEqual(status_resp.data.get('amount'), '750.00')
        self.assertIn('appointment_details', status_resp.data)

    # Scenario 18: Live vs Sandbox endpoint routing configuration
    def test_live_vs_sandbox_endpoint_routing(self):
        # Test Sandbox Mode
        with patch.dict('os.environ', {'PAYMENT_ENVIRONMENT': 'sandbox', 'SSLCOMMERZ_IS_SANDBOX': 'true'}):
            payment_service.reload_config()
            self.assertTrue(payment_service.is_sandbox)
            self.assertIn('sandbox.sslcommerz.com', payment_service.init_url)
            self.assertIn('sandbox.sslcommerz.com', payment_service.validation_url)

        # Test Live Mode
        with patch.dict('os.environ', {'PAYMENT_ENVIRONMENT': 'live', 'SSLCOMMERZ_IS_SANDBOX': 'false'}):
            payment_service.reload_config()
            self.assertFalse(payment_service.is_sandbox)
            self.assertIn('securepay.sslcommerz.com', payment_service.init_url)
            self.assertIn('securepay.sslcommerz.com', payment_service.validation_url)

        # Restore original settings
        payment_service.reload_config()

    # Scenario 19: Gateway timeout / API failure handled gracefully without crash
    def test_gateway_timeout_handled_gracefully(self):
        with patch.object(payment_service, 'initiate_transaction') as mock_init:
            mock_init.return_value = {
                'success': False,
                'error': 'Connection to payment gateway timed out (12s limit).'
            }

            resp = self.client.post('/api/payment/initiate/', {'appointment_id': self.appointment.id})
            self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
            self.assertIn('timed out', resp.data.get('error'))

    # Scenario 20: Audit logging records payment events
    def test_audit_logging_payment_events(self):
        init_resp = self.client.post('/api/payment/initiate/', {'appointment_id': self.appointment.id})
        txn_ref = init_resp.data['transaction_ref']

        # Verify PAYMENT_INITIATED was logged
        init_audit = AuditLog.objects.filter(action='PAYMENT_INITIATED', details__contains=txn_ref).first()
        self.assertIsNotNone(init_audit)
        self.assertEqual(init_audit.user, self.patient)
