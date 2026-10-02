import hashlib
import hmac
import json
import logging
import os
import secrets
from datetime import timedelta
from typing import Tuple

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from otp_security.models import AuditBlock, OTPRequest

logger = logging.getLogger("otp_security.services")


class CooldownActiveError(Exception):
    """Raised when an OTP request is attempted within the 60-second cooldown window."""

    def __init__(self, retry_after: int) -> None:
        self.retry_after = retry_after
        super().__init__(f"Resend cooldown active. Please wait {retry_after} seconds.")


def get_otp_pepper() -> bytes:
    """
    Retrieves the cryptographic pepper from Django settings or environment variables.
    Fails fast if the pepper is not provided or lacks sufficient entropy.
    """
    pepper_str = getattr(settings, "OTP_PEPPER", None) or os.environ.get("OTP_PEPPER")
    if not pepper_str:
        raise RuntimeError("CRITICAL SECURITY ERROR: 'OTP_PEPPER' is not set.")
    pepper_bytes = pepper_str.encode("utf-8")
    if len(pepper_bytes) < 32:
        raise RuntimeError("CRITICAL SECURITY ERROR: 'OTP_PEPPER' must be at least 32 bytes.")
    return pepper_bytes


def compute_otp_hmac(salt: str, code: str, identifier: str, purpose: str) -> str:
    """
    Computes HMAC-SHA256(OTP_PEPPER, salt|code|identifier|purpose).
    Never stores or logs the plain OTP code.
    """
    pepper = get_otp_pepper()
    payload = f"{salt}|{code}|{identifier}|{purpose}".encode("utf-8")
    return hmac.new(pepper, payload, hashlib.sha256).hexdigest()


def compute_subject_hash(identifier: str) -> str:
    """
    Computes a cryptographic HMAC of the identifier using OTP_PEPPER.
    Prevents raw PII (emails, phone numbers) from ever being stored in the audit ledger.
    """
    pepper = get_otp_pepper()
    return hmac.new(pepper, identifier.encode("utf-8"), hashlib.sha256).hexdigest()


def calculate_block_hash(
    index: int,
    event: str,
    subject_hash: str,
    timestamp_iso: str,
    prev_hash: str,
) -> str:
    """
    Computes SHA256 over canonical JSON representation of block fields.
    Guarantees deterministic hashing across different platforms.
    """
    canonical_data = {
        "event": event,
        "index": index,
        "prev_hash": prev_hash,
        "subject_hash": subject_hash,
        "timestamp": timestamp_iso,
    }
    canonical_json = json.dumps(canonical_data, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical_json.encode("utf-8")).hexdigest()


def append_audit_block(event: str, identifier: str) -> AuditBlock:
    """
    Appends an immutable block to the audit hash chain inside an atomic transaction.
    Locks the latest block with select_for_update() to prevent chain forks under concurrency.
    """
    with transaction.atomic():
        # Lock latest block to serialize concurrent additions
        latest_block = (
            AuditBlock.objects.select_for_update().order_by("-index").first()
        )

        if latest_block is None:
            new_index = 1
            prev_hash = "0" * 64  # Genesis block previous hash
        else:
            new_index = latest_block.index + 1
            prev_hash = latest_block.block_hash

        ts = timezone.now()
        timestamp_iso = ts.isoformat()
        subject_hash = compute_subject_hash(identifier)
        block_hash = calculate_block_hash(
            index=new_index,
            event=event,
            subject_hash=subject_hash,
            timestamp_iso=timestamp_iso,
            prev_hash=prev_hash,
        )

        block = AuditBlock.objects.create(
            index=new_index,
            event=event,
            subject_hash=subject_hash,
            timestamp=ts,
            prev_hash=prev_hash,
            block_hash=block_hash,
        )
        return block


def verify_chain() -> Tuple[bool, str | None]:
    """
    Verifies the integrity of the entire AuditBlock hash chain from Genesis to tip.
    Re-hashes canonical JSON for each block and validates predecessor pointers.
    Returns (True, None) if valid, or (False, error_description) if tampering is detected.
    """
    blocks = AuditBlock.objects.order_by("index").all()
    if not blocks.exists():
        return True, None

    expected_prev_hash = "0" * 64
    expected_index = 1

    for block in blocks:
        if block.index != expected_index:
            return (
                False,
                f"Broken sequence at index {block.index}: expected index {expected_index}.",
            )

        if not hmac.compare_digest(block.prev_hash, expected_prev_hash):
            return (
                False,
                f"Chain fork detected at index {block.index}: prev_hash does not match preceding block.",
            )

        # Recompute block hash
        computed_hash = calculate_block_hash(
            index=block.index,
            event=block.event,
            subject_hash=block.subject_hash,
            timestamp_iso=block.timestamp.isoformat(),
            prev_hash=block.prev_hash,
        )

        if not hmac.compare_digest(computed_hash, block.block_hash):
            return (
                False,
                f"Tampering detected at index {block.index}: stored block_hash does not match recomputed hash.",
            )

        expected_prev_hash = block.block_hash
        expected_index += 1

    return True, None


def generate_unique_otp(identifier: str, purpose: str) -> str:
    """
    Generates a 6-digit zero-padded OTP using secrets.randbelow (CSPRNG).
    Guarantees the code is never equal to the immediate previous code for that (identifier, purpose).
    """
    last_otp = (
        OTPRequest.objects.filter(identifier=identifier, purpose=purpose)
        .order_by("-created_at")
        .first()
    )

    while True:
        candidate_code = f"{secrets.randbelow(1_000_000):06d}"
        if last_otp is not None:
            # Test candidate against the previous OTP's stored HMAC using its salt
            test_hmac = compute_otp_hmac(
                last_otp.salt, candidate_code, identifier, purpose
            )
            if hmac.compare_digest(test_hmac, last_otp.otp_hash):
                # Candidate equals the previous code; regenerate
                continue
        return candidate_code


def request_otp(
    identifier: str,
    channel: str,
    purpose: str = "login",
) -> Tuple[OTPRequest, str]:
    """
    Executes the OTP request protocol:
    1. Enforces 60-second resend cooldown.
    2. Invalidates all previous active OTPs for (identifier, purpose).
    3. Generates 6-digit CSPRNG OTP (guaranteed != previous).
    4. Computes HMAC-SHA256 with per-OTP salt.
    5. Sets strict 120-second validity.
    6. Appends 'requested' event to tamper-evident audit ledger.
    Returns (OTPRequest, plain_code) so caller can dispatch to queue.
    """
    with transaction.atomic():
        # Check 60-second cooldown
        latest_request = (
            OTPRequest.objects.select_for_update()
            .filter(identifier=identifier, purpose=purpose)
            .order_by("-created_at")
            .first()
        )

        now = timezone.now()
        if latest_request is not None:
            elapsed_seconds = (now - latest_request.created_at).total_seconds()
            if elapsed_seconds < 60:
                retry_after = int(60 - elapsed_seconds) + 1
                raise CooldownActiveError(retry_after=retry_after)

        # Invalidate all prior unconsumed OTPs for this (identifier, purpose)
        OTPRequest.objects.filter(
            identifier=identifier,
            purpose=purpose,
            is_used=False,
            is_locked=False,
            is_revoked=False,
        ).update(is_revoked=True)

        # Generate CSPRNG code and random per-OTP salt
        plain_code = generate_unique_otp(identifier=identifier, purpose=purpose)
        salt = secrets.token_hex(16)  # 32-character secure random hex salt
        otp_hash = compute_otp_hmac(
            salt=salt,
            code=plain_code,
            identifier=identifier,
            purpose=purpose,
        )

        expires_at = now + timedelta(seconds=120)

        otp_record = OTPRequest.objects.create(
            identifier=identifier,
            channel=channel,
            purpose=purpose,
            salt=salt,
            otp_hash=otp_hash,
            created_at=now,
            expires_at=expires_at,
            failed_attempts=0,
            is_used=False,
            is_locked=False,
            is_revoked=False,
        )

        # Append to audit ledger
        append_audit_block(event="requested", identifier=identifier)

        return otp_record, plain_code


def verify_otp(
    identifier: str,
    code: str,
    purpose: str = "login",
) -> Tuple[bool, str]:
    """
    Verifies an OTP with atomic concurrency locks and strict security bounds:
    - select_for_update prevents race conditions and double-spending.
    - Max 5 failed attempts locks the OTP permanently.
    - Strict 120-second server-side expiration.
    - Constant-time comparison using hmac.compare_digest.
    - Records 'verified', 'failed', or 'locked' to audit ledger.
    """
    with transaction.atomic():
        otp_record = (
            OTPRequest.objects.select_for_update()
            .filter(
                identifier=identifier,
                purpose=purpose,
                is_revoked=False,
                is_used=False,
            )
            .order_by("-created_at")
            .first()
        )

        if otp_record is None:
            append_audit_block(event="failed", identifier=identifier)
            return False, "Invalid or expired verification code."

        if otp_record.is_locked:
            append_audit_block(event="locked", identifier=identifier)
            return False, "Maximum verification attempts exceeded. Code is locked."

        now = timezone.now()
        if now > otp_record.expires_at:
            append_audit_block(event="failed", identifier=identifier)
            return False, "Verification code has expired."

        # Compute candidate HMAC
        candidate_hmac = compute_otp_hmac(
            salt=otp_record.salt,
            code=code,
            identifier=identifier,
            purpose=purpose,
        )

        if hmac.compare_digest(candidate_hmac, otp_record.otp_hash):
            otp_record.is_used = True
            otp_record.save(update_fields=["is_used"])
            append_audit_block(event="verified", identifier=identifier)
            return True, "Code verified successfully."
        else:
            otp_record.failed_attempts += 1
            if otp_record.failed_attempts >= 5:
                otp_record.is_locked = True
                otp_record.save(update_fields=["failed_attempts", "is_locked"])
                append_audit_block(event="locked", identifier=identifier)
                return False, "Maximum verification attempts exceeded. Code is locked."
            else:
                otp_record.save(update_fields=["failed_attempts"])
                append_audit_block(event="failed", identifier=identifier)
                return False, "Invalid verification code."
