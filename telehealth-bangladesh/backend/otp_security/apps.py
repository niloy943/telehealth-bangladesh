import os
from django.apps import AppConfig
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured


class OtpSecurityConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "otp_security"
    verbose_name = "OTP Security & Cryptographic Audit Ledger"

    def ready(self) -> None:
        """
        Validate critical security parameters at Django startup.
        Fails fast if OTP_PEPPER is missing or has insufficient entropy.
        """
        pepper = getattr(settings, "OTP_PEPPER", None) or os.environ.get("OTP_PEPPER")
        if not pepper:
            raise ImproperlyConfigured(
                "CRITICAL SECURITY CONFIGURATION ERROR: 'OTP_PEPPER' environment "
                "variable is required and cannot be empty. Define OTP_PEPPER before starting."
            )
        if len(pepper.encode("utf-8")) < 32:
            raise ImproperlyConfigured(
                "CRITICAL SECURITY CONFIGURATION ERROR: 'OTP_PEPPER' must be at least "
                "32 bytes (256 bits) in length for cryptographically secure HMAC operation."
            )
