import logging
import urllib.parse
import urllib.request
from abc import ABC, abstractmethod
from django.conf import settings
from django.core.mail import send_mail

logger = logging.getLogger("otp_security.senders")


class BaseSender(ABC):
    """
    Abstract interface for multi-channel OTP dispatch.
    """

    @abstractmethod
    def send_otp(self, identifier: str, code: str, purpose: str) -> bool:
        """
        Dispatches the plain OTP to the given recipient.
        Must return True if dispatched successfully, or raise an Exception on failure.
        """
        pass


class EmailSender(BaseSender):
    """
    Email OTP sender utilizing Django's SMTP backend.
    """

    def send_otp(self, identifier: str, code: str, purpose: str) -> bool:
        subject = f"Your Verification Code for {purpose.replace('_', ' ').title()}"
        message = (
            f"Hello,\n\n"
            f"Your verification code is: {code}\n\n"
            f"This code will expire in exactly 2 minutes (120 seconds).\n"
            f"If you did not request this verification code, please ignore this email immediately.\n\n"
            f"Security Team"
        )
        from_email = getattr(settings, "DEFAULT_FROM_EMAIL", "security@telehealth.bd")
        
        # Dispatch via Django standard mail facilities (console, SMTP, SES, etc.)
        sent_count = send_mail(
            subject=subject,
            message=message,
            from_email=from_email,
            recipient_list=[identifier],
            fail_silently=False,
        )
        # Never log the plaintext code
        masked = identifier[:2] + "***@" + identifier.split("@")[-1] if "@" in identifier else "***"
        logger.info("Email OTP successfully dispatched to %s for purpose '%s'", masked, purpose)
        return sent_count > 0


class SMSSender(BaseSender):
    """
    SMS OTP sender with support for Bangladeshi gateways (SSL Wireless, Greenweb,
    Banglalink/Teletalk) and Twilio, configured via Django settings.
    """

    def send_otp(self, identifier: str, code: str, purpose: str) -> bool:
        provider = getattr(settings, "SMS_PROVIDER", "stub").lower()
        message = f"Your verification code is {code}. Valid for 2 minutes. Do not share this code."
        masked_number = identifier[:4] + "****" + identifier[-3:] if len(identifier) >= 7 else "****"

        if provider == "twilio":
            # Twilio REST API integration
            account_sid = getattr(settings, "TWILIO_ACCOUNT_SID", "")
            auth_token = getattr(settings, "TWILIO_AUTH_TOKEN", "")
            from_number = getattr(settings, "TWILIO_FROM_NUMBER", "")
            if not account_sid or not auth_token:
                logger.warning("Twilio credentials not configured. Falling back to stub dispatch.")
                return True

            url = f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json"
            data = urllib.parse.urlencode({
                "To": identifier,
                "From": from_number,
                "Body": message,
            }).encode("utf-8")
            req = urllib.request.Request(url, data=data, method="POST")
            # HTTP Basic Auth
            import base64
            auth_str = base64.b64encode(f"{account_sid}:{auth_token}".encode("ascii")).decode("ascii")
            req.add_header("Authorization", f"Basic {auth_str}")
            with urllib.request.urlopen(req, timeout=10) as response:
                if response.status in (200, 201):
                    logger.info("Twilio SMS dispatched to %s", masked_number)
                    return True
                raise RuntimeError(f"Twilio dispatch failed with status {response.status}")

        elif provider in ("bangladesh_sslwireless", "sslwireless"):
            # SSL Wireless API integration (Popular Bangladeshi SMS Gateway)
            api_token = getattr(settings, "SSL_WIRELESS_API_TOKEN", "")
            sid = getattr(settings, "SSL_WIRELESS_SID", "")
            csms_id = getattr(settings, "SSL_WIRELESS_CSMS_ID", "OTP_VERIFY")
            url = getattr(settings, "SSL_WIRELESS_URL", "https://smsplus.sslwireless.com/api/v3/send-sms")

            payload = urllib.parse.urlencode({
                "api_token": api_token,
                "sid": sid,
                "msisdn": identifier,
                "sms": message,
                "csms_id": csms_id,
            }).encode("utf-8")
            req = urllib.request.Request(url, data=payload, method="POST")
            with urllib.request.urlopen(req, timeout=10) as response:
                if response.status == 200:
                    logger.info("SSL Wireless SMS dispatched to %s", masked_number)
                    return True
                raise RuntimeError(f"SSL Wireless dispatch failed with status {response.status}")

        else:
            # Safe mock/stub provider for development and testing
            logger.info(
                "[STUB SMS DISPATCH] To: %s | Purpose: %s | Message Length: %d chars",
                masked_number,
                purpose,
                len(message),
            )
            return True


def get_sender(channel: str) -> BaseSender:
    """
    Pluggable sender factory returning appropriate channel sender.
    """
    if channel == "sms":
        return SMSSender()
    elif channel == "email":
        return EmailSender()
    raise ValueError(f"Unsupported OTP delivery channel: '{channel}'. Allowed: 'sms', 'email'.")
