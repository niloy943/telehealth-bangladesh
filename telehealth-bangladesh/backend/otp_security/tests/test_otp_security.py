import datetime
import hashlib
import logging
from unittest.mock import patch

import pytest
from django.db import connection
from django.utils import timezone

from otp_security.anchoring import build_merkle_tree
from otp_security.models import AuditBlock, OTPRequest
from otp_security.services import (
    CooldownActiveError,
    append_audit_block,
    generate_unique_otp,
    request_otp,
    verify_chain,
    verify_otp,
)

logger = logging.getLogger(__name__)


@pytest.fixture(autouse=True)
def set_test_pepper(settings):
    """Ensure a cryptographically strong OTP_PEPPER is available in settings."""
    settings.OTP_PEPPER = "test-cryptographic-pepper-at-least-32-bytes-long-2026"


@pytest.mark.django_db
class TestOTPSecuritySuite:
    """Comprehensive test suite covering all functional and cryptographic requirements."""

    def test_01_otp_expiry_at_120s_fails_at_121s(self):
        """Requirement 1: OTP valid for exactly 120s, fails at 121s."""
        base_time = timezone.now()
        identifier = "+8801700000001"
        purpose = "login"

        with patch("django.utils.timezone.now", return_value=base_time):
            otp_record, code = request_otp(identifier=identifier, channel="sms", purpose=purpose)

        # At t0 + 119 seconds -> Should succeed
        at_119s = base_time + datetime.timedelta(seconds=119)
        with patch("django.utils.timezone.now", return_value=at_119s):
            success, msg = verify_otp(identifier=identifier, code=code, purpose=purpose)
            assert success is True
            assert "verified successfully" in msg.lower()

        # New OTP to test exact 121s boundary
        later_base = base_time + datetime.timedelta(seconds=200)
        with patch("django.utils.timezone.now", return_value=later_base):
            otp_record2, code2 = request_otp(identifier=identifier, channel="sms", purpose=purpose)

        # At t0 + 121 seconds -> Must fail due to expiration
        at_121s = later_base + datetime.timedelta(seconds=121)
        with patch("django.utils.timezone.now", return_value=at_121s):
            success2, msg2 = verify_otp(identifier=identifier, code=code2, purpose=purpose)
            assert success2 is False
            assert "expired" in msg2.lower()

    def test_02_otp_single_use(self):
        """Requirement 2: Verified OTP cannot be reused (single-use guarantee)."""
        identifier = "user1@telehealth.bd"
        purpose = "login"

        otp_record, code = request_otp(identifier=identifier, channel="email", purpose=purpose)

        # First verification must succeed
        success_first, _ = verify_otp(identifier=identifier, code=code, purpose=purpose)
        assert success_first is True

        # Second verification with identical code must immediately fail
        success_second, msg = verify_otp(identifier=identifier, code=code, purpose=purpose)
        assert success_second is False
        assert "invalid or expired" in msg.lower()

    def test_03_five_attempt_lock_then_correct_code_fails(self):
        """Requirement 3: 5 failed attempts locks OTP permanently; subsequent correct code fails."""
        identifier = "+8801700000003"
        purpose = "password_reset"

        otp_record, correct_code = request_otp(identifier=identifier, channel="sms", purpose=purpose)
        wrong_code = "999999" if correct_code != "999999" else "888888"

        # Submit 4 failed attempts
        for attempt in range(1, 5):
            success, msg = verify_otp(identifier=identifier, code=wrong_code, purpose=purpose)
            assert success is False
            assert "invalid" in msg.lower()

        # 5th failed attempt triggers account lock
        success_5, msg_5 = verify_otp(identifier=identifier, code=wrong_code, purpose=purpose)
        assert success_5 is False
        assert "locked" in msg_5.lower()

        otp_record.refresh_from_db()
        assert otp_record.is_locked is True
        assert otp_record.failed_attempts == 5

        # 6th attempt: Even with the CORRECT code, verification must be rejected
        success_6, msg_6 = verify_otp(identifier=identifier, code=correct_code, purpose=purpose)
        assert success_6 is False
        assert "locked" in msg_6.lower()

    def test_04_resend_cooldown(self):
        """Requirement 4: Enforce 60-second cooldown between requests."""
        identifier = "+8801700000004"
        purpose = "login"
        t0 = timezone.now()

        with patch("django.utils.timezone.now", return_value=t0):
            request_otp(identifier=identifier, channel="sms", purpose=purpose)

        # Request at t0 + 30 seconds -> Must raise CooldownActiveError
        with patch("django.utils.timezone.now", return_value=t0 + datetime.timedelta(seconds=30)):
            with pytest.raises(CooldownActiveError) as exc_info:
                request_otp(identifier=identifier, channel="sms", purpose=purpose)
            assert exc_info.value.retry_after > 0

        # Request at t0 + 61 seconds -> Cooldown cleared, request succeeds
        with patch("django.utils.timezone.now", return_value=t0 + datetime.timedelta(seconds=61)):
            new_record, new_code = request_otp(identifier=identifier, channel="sms", purpose=purpose)
            assert new_record is not None
            assert len(new_code) == 6

    def test_05_new_request_invalidates_old_code(self):
        """Requirement 5: A new request invalidates all previous active OTPs for (identifier, purpose)."""
        identifier = "patient@hospital.gov.bd"
        purpose = "login"
        t0 = timezone.now()

        with patch("django.utils.timezone.now", return_value=t0):
            otp1, code1 = request_otp(identifier=identifier, channel="email", purpose=purpose)

        # Advance past cooldown to request new code
        t1 = t0 + datetime.timedelta(seconds=65)
        with patch("django.utils.timezone.now", return_value=t1):
            otp2, code2 = request_otp(identifier=identifier, channel="email", purpose=purpose)

        # Old code1 must now fail
        with patch("django.utils.timezone.now", return_value=t1 + datetime.timedelta(seconds=5)):
            success1, _ = verify_otp(identifier=identifier, code=code1, purpose=purpose)
            assert success1 is False

            # New code2 must succeed
            success2, _ = verify_otp(identifier=identifier, code=code2, purpose=purpose)
            assert success2 is True

    def test_06_code_never_equals_previous_code(self):
        """Requirement 6: Code is unique per (identifier, purpose) and never equals previous code."""
        identifier = "+8801700000006"
        purpose = "mfa"

        _, code1 = request_otp(identifier=identifier, channel="sms", purpose=purpose)

        # Mock randbelow to first return collision (code1 as int), then a different code
        target_collision = int(code1)
        fallback_value = (target_collision + 1) % 1_000_000

        with patch("secrets.randbelow", side_effect=[target_collision, fallback_value]):
            next_code = generate_unique_otp(identifier=identifier, purpose=purpose)
            assert next_code != code1
            assert next_code == f"{fallback_value:06d}"

    def test_07_no_plain_otp_in_db_or_logs(self, caplog):
        """Requirement 7: Never store or log the plain OTP code."""
        identifier = "secure.user@telehealth.bd"
        purpose = "login"

        with caplog.at_level(logging.DEBUG):
            otp_record, plain_code = request_otp(
                identifier=identifier, channel="email", purpose=purpose
            )

        # 1. Assert plain OTP is not in any database column of the record
        record_from_db = OTPRequest.objects.get(id=otp_record.id)
        assert plain_code != record_from_db.otp_hash
        assert plain_code != record_from_db.salt
        assert plain_code not in record_from_db.identifier
        assert plain_code not in record_from_db.purpose

        # 2. Check full raw database representation
        db_columns_str = f"{record_from_db.id} {record_from_db.salt} {record_from_db.otp_hash} {record_from_db.identifier}"
        assert plain_code not in db_columns_str

        # 3. Assert plain code is absent from all log outputs
        assert plain_code not in caplog.text

    def test_08_verify_chain_returns_false_after_manual_edit(self):
        """Requirement 8: verify_chain() returns False when a block in the DB is tampered with."""
        AuditBlock.objects.all().delete = lambda *args, **kwargs: super(AuditBlock, AuditBlock.objects.all()).delete() # bypass for test setup
        # Ensure fresh chain
        with connection.cursor() as cursor:
            cursor.execute("DELETE FROM otp_security_auditblock;")

        block1 = append_audit_block(event="requested", identifier="+8801700000008")
        block2 = append_audit_block(event="verified", identifier="+8801700000008")
        block3 = append_audit_block(event="requested", identifier="+8801700000008")

        # Initial chain must be valid
        is_valid, err = verify_chain()
        assert is_valid is True
        assert err is None

        # Execute direct low-level SQL update to simulate out-of-band database tampering
        with connection.cursor() as cursor:
            cursor.execute(
                "UPDATE otp_security_auditblock SET event = 'failed' WHERE index = %s;",
                [block2.index],
            )

        # Verification must now fail
        tampered_valid, tampered_err = verify_chain()
        assert tampered_valid is False
        assert "tampering detected" in tampered_err.lower()

    def test_09_merkle_root_reproducibility(self):
        """Requirement 9: Merkle tree calculation is deterministic and reproducible."""
        sample_hashes = [
            hashlib.sha256(b"block_1_hash").hexdigest(),
            hashlib.sha256(b"block_2_hash").hexdigest(),
            hashlib.sha256(b"block_3_hash").hexdigest(),
            hashlib.sha256(b"block_4_hash").hexdigest(),
            hashlib.sha256(b"block_5_hash").hexdigest(),
        ]

        root_a = build_merkle_tree(sample_hashes)
        root_b = build_merkle_tree(sample_hashes)

        # Reproducibility check
        assert root_a == root_b
        assert len(root_a) == 64

        # Tampering with a single bit in one leaf must alter the Merkle root
        altered_hashes = list(sample_hashes)
        altered_hashes[2] = hashlib.sha256(b"block_3_tampered").hexdigest()
        root_tampered = build_merkle_tree(altered_hashes)

        assert root_a != root_tampered
