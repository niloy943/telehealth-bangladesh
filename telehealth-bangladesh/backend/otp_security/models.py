import uuid
from datetime import timedelta
from django.db import models
from django.utils import timezone
from django.core.exceptions import PermissionDenied


class AuditBlockQuerySet(models.QuerySet):
    """
    Append-only QuerySet preventing bulk update and bulk delete operations.
    """

    def update(self, **kwargs) -> int:
        raise PermissionDenied("AuditBlock records are append-only. Bulk updates are rejected.")

    def delete(self) -> tuple[int, dict[str, int]]:
        raise PermissionDenied("AuditBlock records are append-only. Bulk deletions are rejected.")


class AuditBlockManager(models.Manager.from_queryset(AuditBlockQuerySet)):
    pass


class OTPRequest(models.Model):
    """
    Tracks one-time password requests, expiration, and verification attempts.
    Never stores or logs the plain OTP code.
    """

    CHANNEL_CHOICES = (
        ("sms", "SMS"),
        ("email", "Email"),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    identifier = models.CharField(
        max_length=255,
        db_index=True,
        help_text="Normalized E.164 phone number or normalized email address.",
    )
    channel = models.CharField(max_length=10, choices=CHANNEL_CHOICES)
    purpose = models.CharField(max_length=50, default="login", db_index=True)
    salt = models.CharField(max_length=64, help_text="Per-OTP random hex salt.")
    otp_hash = models.CharField(
        max_length=64,
        db_index=True,
        help_text="HMAC-SHA256(OTP_PEPPER, salt|code|identifier|purpose).",
    )
    created_at = models.DateTimeField(default=timezone.now, db_index=True)
    expires_at = models.DateTimeField(db_index=True)
    failed_attempts = models.PositiveSmallIntegerField(default=0)
    is_used = models.BooleanField(default=False, db_index=True)
    is_locked = models.BooleanField(default=False, db_index=True)
    is_revoked = models.BooleanField(default=False, db_index=True)

    class Meta:
        db_table = "otp_security_otprequest"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["identifier", "purpose", "is_used", "is_locked", "is_revoked"]),
            models.Index(fields=["identifier", "purpose", "created_at"]),
        ]

    def __str__(self) -> str:
        return f"OTPRequest({self.id}, {self.channel}, purpose={self.purpose}, used={self.is_used})"

    @property
    def is_expired(self) -> bool:
        return timezone.now() > self.expires_at

    @property
    def is_active(self) -> bool:
        return (
            not self.is_used
            and not self.is_locked
            and not self.is_revoked
            and not self.is_expired
        )


class AuditBlock(models.Model):
    """
    Tamper-evident append-only cryptographic audit ledger forming a hash chain.
    Protected at both application level (save/delete) and PostgreSQL DB trigger level.
    """

    EVENT_CHOICES = (
        ("requested", "Requested"),
        ("verified", "Verified"),
        ("failed", "Failed"),
        ("locked", "Locked"),
    )

    index = models.BigIntegerField(unique=True, db_index=True)
    event = models.CharField(max_length=20, choices=EVENT_CHOICES)
    subject_hash = models.CharField(
        max_length=64,
        db_index=True,
        help_text="HMAC-SHA256 of identifier; zero raw PII is written to the ledger.",
    )
    timestamp = models.DateTimeField(default=timezone.now, db_index=True)
    prev_hash = models.CharField(max_length=64)
    block_hash = models.CharField(max_length=64, unique=True, db_index=True)

    objects = AuditBlockManager()

    class Meta:
        db_table = "otp_security_auditblock"
        ordering = ["index"]

    def __str__(self) -> str:
        return f"AuditBlock(idx={self.index}, event={self.event}, hash={self.block_hash[:12]}...)"

    def save(self, *args, **kwargs) -> None:
        """
        Enforce strict append-only policy at the application/ORM level.
        Prevents updates to already-created blocks.
        """
        if self.pk is not None and AuditBlock.objects.filter(pk=self.pk).exists():
            raise PermissionDenied("AuditBlock records are append-only. Modification is strictly forbidden.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs) -> None:
        """
        Enforce strict append-only policy at the application/ORM level.
        Prevents deletion of blocks.
        """
        raise PermissionDenied("AuditBlock records are append-only. Deletion is strictly forbidden.")


class MerkleAnchor(models.Model):
    """
    Stores periodic/daily Merkle roots computed over AuditBlock entries,
    with an optional on-chain transaction hash reference.
    """

    anchor_date = models.DateField(unique=True, db_index=True)
    root = models.CharField(max_length=64, help_text="Merkle root SHA-256 hex string.")
    first_index = models.BigIntegerField()
    last_index = models.BigIntegerField()
    block_count = models.PositiveIntegerField()
    tx_hash = models.CharField(max_length=66, null=True, blank=True, db_index=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "otp_security_merkleanchor"
        ordering = ["-anchor_date"]

    def __str__(self) -> str:
        return f"MerkleAnchor({self.anchor_date}, count={self.block_count}, root={self.root[:12]}...)"
