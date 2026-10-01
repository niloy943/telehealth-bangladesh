import datetime
import logging
from celery import shared_task
from django.utils import timezone

from otp_security.anchoring import build_merkle_tree, publish_anchor
from otp_security.models import AuditBlock, MerkleAnchor
from otp_security.senders import get_sender

logger = logging.getLogger("otp_security.tasks")


@shared_task(bind=True, max_retries=3, default_retry_delay=5)
def send_otp_task(
    self,
    channel: str,
    identifier: str,
    code: str,
    purpose: str = "login",
) -> bool:
    """
    Asynchronous Celery task for sending OTPs.
    Implements automatic retries with exponential backoff for network/SMTP/SMS gateway failures.
    Plain OTP is strictly confined to memory and never persisted in database or Celery logs.
    """
    masked = identifier[:3] + "***" + identifier[-3:] if len(identifier) > 6 else "***"
    try:
        sender = get_sender(channel)
        success = sender.send_otp(identifier=identifier, code=code, purpose=purpose)
        logger.info(
            "Task dispatch succeeded for channel '%s' to recipient %s (purpose: %s)",
            channel,
            masked,
            purpose,
        )
        return success
    except Exception as exc:
        retry_delay = 2 ** self.request.retries * 5
        logger.warning(
            "OTP dispatch failure for %s via %s. Retrying in %d seconds. Error: %s",
            masked,
            channel,
            retry_delay,
            exc,
        )
        raise self.retry(exc=exc, countdown=retry_delay)


@shared_task
def daily_merkle_anchor_task() -> None:
    """
    Celery Beat scheduled job executed daily at 00:05 UTC.
    Gathers all audit blocks created during the previous calendar day,
    computes an immutable Merkle root, saves MerkleAnchor, and optionally
    publishes the root on-chain (Polygon/Ethereum) if ANCHOR_ENABLED is True.
    """
    yesterday = timezone.now().date() - datetime.timedelta(days=1)

    # Prevent duplicate anchoring for the same calendar date
    if MerkleAnchor.objects.filter(anchor_date=yesterday).exists():
        logger.info("Merkle anchor for date %s already generated. Skipping.", yesterday)
        return

    day_start = timezone.make_aware(
        datetime.datetime.combine(yesterday, datetime.time.min)
    )
    day_end = timezone.make_aware(
        datetime.datetime.combine(yesterday, datetime.time.max)
    )

    blocks = (
        AuditBlock.objects.filter(timestamp__gte=day_start, timestamp__lte=day_end)
        .order_by("index")
        .all()
    )

    if not blocks.exists():
        logger.info("No audit blocks created on %s. Skipping Merkle anchoring.", yesterday)
        return

    block_hashes = [b.block_hash for b in blocks]
    root_hash = build_merkle_tree(block_hashes)

    anchor = MerkleAnchor.objects.create(
        anchor_date=yesterday,
        root=root_hash,
        first_index=blocks.first().index,
        last_index=blocks.last().index,
        block_count=blocks.count(),
    )

    logger.info(
        "Generated MerkleAnchor for %s covering blocks %d to %d (Total: %d). Root: %s",
        yesterday,
        anchor.first_index,
        anchor.last_index,
        anchor.block_count,
        anchor.root,
    )

    publish_anchor(anchor)
