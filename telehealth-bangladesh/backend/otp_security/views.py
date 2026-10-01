import hashlib
import logging
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.throttling import SimpleRateThrottle
from rest_framework.views import APIView

from otp_security.serializers import OTPRequestSerializer, OTPVerifySerializer
from otp_security.services import (
    CooldownActiveError,
    request_otp,
    verify_otp,
)
from otp_security.tasks import send_otp_task

logger = logging.getLogger("otp_security.views")


class OtpIpRateThrottle(SimpleRateThrottle):
    """
    Limits OTP requests/verifications per IP address.
    Configured via REST_FRAMEWORK['DEFAULT_THROTTLE_RATES']['otp_ip'].
    """

    scope = "otp_ip"

    def get_cache_key(self, request: Request, view: APIView) -> str:
        ident = self.get_ident(request)
        return self.cache_format % {"scope": self.scope, "ident": ident}


class OtpIdentifierRateThrottle(SimpleRateThrottle):
    """
    Limits OTP requests per recipient destination (phone or email).
    Hashes the identifier before caching to avoid leaking PII into Redis/cache keys.
    """

    scope = "otp_identifier"

    def get_cache_key(self, request: Request, view: APIView) -> str | None:
        identifier = request.data.get("identifier")
        if not identifier:
            return None
        # Hash identifier to protect user privacy in cache storage
        hashed = hashlib.sha256(str(identifier).strip().lower().encode("utf-8")).hexdigest()
        return self.cache_format % {"scope": self.scope, "ident": hashed}


class OTPRequestView(APIView):
    """
    POST /api/otp/request
    Initiates an OTP generation request.
    Enforces IP/identifier rate limiting and 60s cooldown.
    Employs generic responses and async dispatch to prevent account enumeration and timing attacks.
    """

    permission_classes = [AllowAny]
    throttle_classes = [OtpIpRateThrottle, OtpIdentifierRateThrottle]

    def post(self, request: Request) -> Response:
        serializer = OTPRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"status": "error", "errors": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        identifier = serializer.validated_data["identifier"]
        channel = serializer.validated_data["channel"]
        purpose = serializer.validated_data.get("purpose", "login")

        try:
            _, plain_code = request_otp(
                identifier=identifier,
                channel=channel,
                purpose=purpose,
            )

            # Asynchronous dispatch via Celery to decouple network latency and timing leaks
            send_otp_task.delay(
                channel=channel,
                identifier=identifier,
                code=plain_code,
                purpose=purpose,
            )

            return Response(
                {
                    "status": "success",
                    "message": (
                        "If the provided destination is eligible, a one-time "
                        "verification code has been dispatched."
                    ),
                    "validity_seconds": 120,
                    "cooldown_seconds": 60,
                },
                status=status.HTTP_200_OK,
            )

        except CooldownActiveError as exc:
            return Response(
                {
                    "status": "error",
                    "message": str(exc),
                    "retry_after": exc.retry_after,
                },
                status=status.HTTP_429_TOO_MANY_REQUESTS,
                headers={"Retry-After": str(exc.retry_after)},
            )


class OTPVerifyView(APIView):
    """
    POST /api/otp/verify
    Verifies a user-submitted OTP with constant-time cryptographic comparison,
    single-use guarantee, and maximum 5-attempt lockout policy.
    """

    permission_classes = [AllowAny]
    throttle_classes = [OtpIpRateThrottle, OtpIdentifierRateThrottle]

    def post(self, request: Request) -> Response:
        serializer = OTPVerifySerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"status": "error", "errors": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        identifier = serializer.validated_data["identifier"]
        code = serializer.validated_data["code"]
        purpose = serializer.validated_data.get("purpose", "login")

        is_valid, message = verify_otp(
            identifier=identifier,
            code=code,
            purpose=purpose,
        )

        if is_valid:
            return Response(
                {
                    "status": "success",
                    "message": message,
                    "verified": True,
                },
                status=status.HTTP_200_OK,
            )
        else:
            return Response(
                {
                    "status": "error",
                    "message": message,
                    "verified": False,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
