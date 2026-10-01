import os
import re
import time
import uuid
import logging

logger = logging.getLogger(__name__)

# E.164 standard regex: starts with +, followed by 1-9, then 6-14 digits (total 7-15 digits)
E164_REGEX = re.compile(r'^\+[1-9]\d{6,14}$')

# Bangladesh local mobile operator prefixes: 013, 014, 015, 016, 017, 018, 019
BD_MOBILE_PREFIX_REGEX = re.compile(r'^(?:\+?88)?01[3-9]\d{8}$')


class TwilioTelephonyService:
    """
    Twilio Telephony & Voice Bridge Service for HealNSight Telemedicine Platform.
    Supports real PSTN voice calls via official Twilio REST API when credentials are present,
    and provides a safe, realistic stateful Sandbox / Mock mode for local development.

    Strictly separates:
      - LIVE MODE (TWILIO_ENVIRONMENT='live'): Uses real Twilio REST API with strict validation.
      - SANDBOX / MOCK MODE (TWILIO_ENVIRONMENT='sandbox'): Simulates call progression safely.
    """

    def __init__(self):
        self.reload_config()
        # In-memory store for stateful simulation in sandbox mode
        self._mock_calls = {}

    def reload_config(self):
        """
        Reloads configuration from environment variables.
        Credentials are never hardcoded.
        """
        self.environment = os.environ.get("TWILIO_ENVIRONMENT", "sandbox").strip().lower()
        self.account_sid = os.environ.get("TWILIO_ACCOUNT_SID", "").strip()
        self.auth_token = os.environ.get("TWILIO_AUTH_TOKEN", "").strip()
        self.from_number = os.environ.get("TWILIO_PHONE_NUMBER", "+18005550199").strip()
        self.twiml_url = os.environ.get("TWILIO_TWIML_URL", "").strip()
        self.backend_base_url = os.environ.get("BACKEND_BASE_URL", "http://localhost:8000").strip().rstrip("/")

        # Check if production credentials are real (not placeholder or mock values)
        is_placeholder = (
            not self.account_sid or 
            not self.auth_token or
            self.account_sid.startswith("mock") or 
            self.account_sid == "AC00000000000000000000000000000000" or
            self.account_sid == "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" or
            self.auth_token == "your_twilio_auth_token_here" or
            len(self.account_sid) < 30 or
            len(self.auth_token) < 25
        )
        self.has_valid_credentials = not is_placeholder
        self.is_live = (self.environment == "live" and self.has_valid_credentials)
        self.is_production = self.is_live

    @staticmethod
    def validate_e164(phone: str):
        """
        Validates and sanitizes a phone number according to the international E.164 standard.
        Supports Bangladesh local formatting (e.g. 01712345678 -> +8801712345678).
        Returns: (is_valid: bool, formatted_phone: str, error_message: str)
        """
        if not phone or not isinstance(phone, str):
            return False, "", "Phone number is required."

        # Strip whitespace, hyphens, parenthesis, and periods
        cleaned = re.sub(r'[\s\-\(\)\.]', '', phone.strip())

        # Handle Bangladesh local mobile prefixes (013, 014, 015, 016, 017, 018, 019)
        if re.match(r'^01[3-9]\d{8}$', cleaned):
            cleaned = '+88' + cleaned
        elif re.match(r'^8801[3-9]\d{8}$', cleaned):
            cleaned = '+' + cleaned
        elif cleaned.startswith('00'):
            cleaned = '+' + cleaned[2:]
        elif not cleaned.startswith('+') and cleaned.isdigit():
            # Assume international without leading plus if 10-15 digits
            if 10 <= len(cleaned) <= 15:
                cleaned = '+' + cleaned

        if not E164_REGEX.match(cleaned):
            return (
                False, 
                cleaned, 
                "Invalid phone number format. Must conform to international E.164 standard (e.g. +8801700000000)."
            )

        return True, cleaned, ""

    def initiate_call(self, to_phone: str, from_number: str = None, consultation_id: int = None, twiml_url: str = None):
        """
        Initiates a voice call to the destination number.
        - LIVE MODE: Executes real PSTN voice call via official Twilio REST API.
          If live credentials are missing, fails safely without creating a fake call.
        - MOCK MODE: Executes safe Sandbox / Mock simulation with realistic state tracking.
        """
        self.reload_config()

        # Validate & sanitize destination phone to E.164 format
        is_valid, sanitized_to, err = self.validate_e164(to_phone)
        if not is_valid:
            return {
                "success": False,
                "error": err,
                "code": "INVALID_PHONE_NUMBER"
            }

        # Outbound caller ID is strictly server-enforced to prevent client spoofing
        outbound_from = self.from_number

        # ----------------------------------------------------------------------
        # LIVE TWILIO EXECUTION
        # ----------------------------------------------------------------------
        if self.environment == "live":
            if not self.has_valid_credentials:
                logger.error("Twilio LIVE mode requested, but valid credentials are not configured in environment.")
                return {
                    "success": False,
                    "mode": "live",
                    "error": "Twilio live telephony is active (TWILIO_ENVIRONMENT=live), but TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN is missing or invalid in environment configuration.",
                    "code": "TWILIO_CREDENTIALS_MISSING"
                }

            try:
                from twilio.rest import Client
                from twilio.base.exceptions import TwilioRestException

                client = Client(self.account_sid, self.auth_token)

                # Determine webhook URL or inline TwiML instructions
                call_kwargs = {
                    "to": sanitized_to,
                    "from_": outbound_from,
                }

                active_twiml_url = twiml_url or self.twiml_url
                is_public_backend = (
                    self.backend_base_url and 
                    not ("localhost" in self.backend_base_url or "127.0.0.1" in self.backend_base_url) and
                    self.backend_base_url.startswith("https://")
                )

                if active_twiml_url:
                    call_kwargs["url"] = active_twiml_url
                elif is_public_backend:
                    webhook_endpoint = f"{self.backend_base_url}/api/telephony/twiml/{consultation_id}/" if consultation_id else f"{self.backend_base_url}/api/telephony/twiml/"
                    call_kwargs["url"] = webhook_endpoint
                else:
                    # In local dev or environments where backend is not publicly reachable via HTTPS,
                    # provide valid inline TwiML directly to Twilio calls.create
                    consultation_msg = f" for consultation #{consultation_id}" if consultation_id else ""
                    call_kwargs["twiml"] = (
                        f'<Response>'
                        f'<Say voice="Polly.Aditi">You are being connected to your HealNSight telemedicine consultation{consultation_msg}. Please hold while we bridge your specialist.</Say>'
                        f'<Pause length="1"/>'
                        f'</Response>'
                    )

                call = client.calls.create(**call_kwargs)

                logger.info(f"Twilio live voice call created. SID: {call.sid}, Status: {call.status}")
                return {
                    "success": True,
                    "mode": "live",
                    "call_sid": call.sid,
                    "status": call.status or "queued",
                    "to": sanitized_to,
                    "from": outbound_from,
                    "message": "Live Twilio voice call initiated successfully."
                }
            except TwilioRestException as e:
                logger.error(f"Twilio REST Exception ({e.code}): {e.msg}")
                friendly_error = self._map_twilio_error(e.code, e.msg)
                return {
                    "success": False,
                    "mode": "live",
                    "error": friendly_error,
                    "code": f"TWILIO_ERR_{e.code}"
                }
            except Exception as e:
                logger.error(f"Twilio Live API unexpected error: {str(e)}")
                return {
                    "success": False,
                    "mode": "live",
                    "error": "Unable to initiate the phone call via Twilio at this time.",
                    "code": "TWILIO_ERROR"
                }

        # ----------------------------------------------------------------------
        # SANDBOX / MOCK EXECUTION (Local Development & CI Testing)
        # ----------------------------------------------------------------------
        else:
            call_sid = f"CA_MOCK_{uuid.uuid4().hex[:26]}"
            created_at = time.time()

            self._mock_calls[call_sid] = {
                "to": sanitized_to,
                "from": outbound_from,
                "consultation_id": consultation_id,
                "created_at": created_at,
                "status": "queued",
                "terminated": False,
                "terminated_at": None
            }

            logger.info(f"[SANDBOX MOCK] Call {call_sid} created for {sanitized_to}")
            return {
                "success": True,
                "mode": "mock",
                "call_sid": call_sid,
                "status": "queued",
                "to": sanitized_to,
                "from": outbound_from,
                "message": "Telemedicine call initiated in Sandbox/Mock mode (Development).",
                "note": "Sandbox mode active. Set TWILIO_ENVIRONMENT=live and provide TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN in .env for real PSTN calls."
            }

    def terminate_call(self, call_sid: str):
        """
        Terminates an active voice call via Twilio REST API or completes the simulated call.
        """
        self.reload_config()

        if not call_sid:
            return {"success": False, "error": "Call SID is required."}

        is_mock_sid = call_sid.startswith("CA_MOCK_") or call_sid in self._mock_calls

        if self.environment == "live" and not is_mock_sid:
            if not self.has_valid_credentials:
                return {
                    "success": False,
                    "mode": "live",
                    "error": "Twilio live credentials not configured."
                }

            try:
                from twilio.rest import Client
                client = Client(self.account_sid, self.auth_token)
                call = client.calls(call_sid).update(status='completed')
                logger.info(f"Twilio live voice call terminated. SID: {call_sid}")
                return {
                    "success": True,
                    "mode": "live",
                    "call_sid": call_sid,
                    "status": "completed",
                    "message": "Twilio live call terminated successfully."
                }
            except Exception as e:
                logger.error(f"Twilio Live API termination error: {str(e)}")
                return {
                    "success": False,
                    "mode": "live",
                    "error": "Unable to terminate the call on the Twilio network."
                }
        else:
            # Sandbox / Mock Mode
            if call_sid in self._mock_calls:
                self._mock_calls[call_sid]["status"] = "completed"
                self._mock_calls[call_sid]["terminated"] = True
                self._mock_calls[call_sid]["terminated_at"] = time.time()

            return {
                "success": True,
                "mode": "mock",
                "call_sid": call_sid,
                "status": "completed",
                "message": "Simulated call terminated successfully."
            }

    def get_call_status(self, call_sid: str):
        """
        Queries the current status of a voice call.
        In live mode: Queries Twilio REST API.
        In mock mode: Computes realistic progression (queued -> ringing -> in-progress -> completed).
        """
        self.reload_config()

        if not call_sid:
            return {"success": False, "error": "Call SID is required."}

        is_mock_sid = call_sid.startswith("CA_MOCK_") or call_sid in self._mock_calls

        if self.environment == "live" and not is_mock_sid:
            if not self.has_valid_credentials:
                return {
                    "success": False,
                    "mode": "live",
                    "error": "Twilio live credentials not configured."
                }

            try:
                from twilio.rest import Client
                client = Client(self.account_sid, self.auth_token)
                call = client.calls(call_sid).fetch()
                duration = int(call.duration or 0)
                
                # Normalize status to standard set
                raw_status = (call.status or "queued").lower()
                normalized_status = self._normalize_status(raw_status)

                return {
                    "success": True,
                    "mode": "live",
                    "call_sid": call.sid,
                    "status": normalized_status,
                    "raw_status": raw_status,
                    "duration": duration,
                    "to": call.to,
                    "from": call.from_,
                    "start_time": str(call.start_time) if call.start_time else None,
                    "end_time": str(call.end_time) if call.end_time else None
                }
            except Exception as e:
                logger.error(f"Twilio Live API status fetch error: {str(e)}")
                return {
                    "success": False,
                    "mode": "live",
                    "error": "Unable to retrieve call status from Twilio."
                }
        else:
            # Sandbox / Mock Mode progression simulation
            mock_call = self._mock_calls.get(call_sid, {})
            created_at = mock_call.get("created_at", time.time() - 10)
            terminated = mock_call.get("terminated", False)
            terminated_at = mock_call.get("terminated_at")

            if terminated:
                status = "completed"
                end_t = terminated_at or time.time()
                duration = max(0, int(end_t - (created_at + 4)))
            else:
                elapsed = time.time() - created_at
                if elapsed < 2.0:
                    status = "queued"
                    duration = 0
                elif elapsed < 4.5:
                    status = "ringing"
                    duration = 0
                else:
                    status = "in-progress"
                    duration = int(elapsed - 4.5)

            return {
                "success": True,
                "mode": "mock",
                "call_sid": call_sid,
                "status": status,
                "duration": duration,
                "to": mock_call.get("to", ""),
                "from": mock_call.get("from", self.from_number)
            }

    def validate_webhook_signature(self, url: str, params: dict, signature: str) -> bool:
        """
        Validates the incoming HTTP request signature from Twilio using RequestValidator.
        Returns True if valid or if in mock/sandbox mode.
        """
        self.reload_config()

        if not self.is_live:
            # In sandbox/mock mode or testing, allow requests
            return True

        if not signature:
            logger.warning("Twilio webhook request missing X-Twilio-Signature header.")
            return False

        try:
            from twilio.request_validator import RequestValidator
            validator = RequestValidator(self.auth_token)
            return validator.validate(url, params or {}, signature)
        except Exception as e:
            logger.error(f"Error validating Twilio webhook signature: {str(e)}")
            return False

    @staticmethod
    def _normalize_status(status: str) -> str:
        """Normalizes Twilio API status to platform standard choice."""
        status_map = {
            'queued': 'queued',
            'initiated': 'queued',
            'ringing': 'ringing',
            'in-progress': 'in-progress',
            'completed': 'completed',
            'busy': 'busy',
            'failed': 'failed',
            'no-answer': 'no-answer',
            'canceled': 'canceled'
        }
        return status_map.get(status, 'queued')

    @staticmethod
    def _map_twilio_error(code: int, msg: str) -> str:
        """Translates Twilio error codes into safe, helpful messages for clients."""
        error_map = {
            20003: "Authentication error with Twilio API. Verify TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.",
            21211: "The destination phone number is invalid or cannot be routed by the telecom carrier.",
            21408: "Permission to call this country or region is not enabled on the Twilio account.",
            21614: "The destination phone number is unverified. Trial Twilio accounts can only call verified numbers.",
            20005: "Twilio account balance is insufficient to initiate outbound voice calls.",
            30008: "Unknown error occurred while dispatching the voice call."
        }
        return error_map.get(code, "Unable to initiate the phone call at this time.")


twilio_service = TwilioTelephonyService()
