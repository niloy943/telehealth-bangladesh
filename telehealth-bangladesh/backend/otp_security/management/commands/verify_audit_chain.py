import sys
from django.core.management.base import BaseCommand
from otp_security.models import AuditBlock
from otp_security.services import verify_chain


class Command(BaseCommand):
    help = "Verifies the cryptographic integrity of the append-only AuditBlock hash chain."

    def handle(self, *args, **options) -> None:
        self.stdout.write(self.style.NOTICE("Initiating audit chain cryptographic verification..."))

        total_blocks = AuditBlock.objects.count()
        if total_blocks == 0:
            self.stdout.write(self.style.WARNING("Audit ledger is currently empty. No blocks to verify."))
            sys.exit(0)

        first_block = AuditBlock.objects.order_by("index").first()
        latest_block = AuditBlock.objects.order_by("-index").first()

        self.stdout.write(
            f"Ledger spans {total_blocks} block(s) (Index {first_block.index} -> Index {latest_block.index})."
        )
        self.stdout.write(f"Genesis Block Hash: {first_block.block_hash}")
        self.stdout.write(f"Tip Block Hash:     {latest_block.block_hash}")

        is_valid, error_msg = verify_chain()

        if is_valid:
            self.stdout.write(
                self.style.SUCCESS(
                    f"Chain Integrity Verified: ALL {total_blocks} BLOCKS ARE CRYPTOGRAPHICALLY VALID."
                )
            )
            sys.exit(0)
        else:
            self.stderr.write(
                self.style.ERROR(
                    f"CRITICAL SECURITY ALERT: CHAIN TAMPERING DETECTED!\nDetails: {error_msg}"
                )
            )
            sys.exit(1)
