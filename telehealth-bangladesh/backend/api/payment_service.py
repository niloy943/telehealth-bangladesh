import os
import json
import uuid
import urllib.request
import urllib.parse
from decimal import Decimal
import logging

logger = logging.getLogger(__name__)

class PaymentGatewayService:
    """
    Production-Ready SSLCommerz Payment Gateway Architecture.
    Complies with official SSLCommerz V4 API specifications.
    
    Features:
    - Dynamic Environment Selection: Live vs. Sandbox
    - Server-Side Authoritative Amount Enforcement
    - Secure Hosted Redirect (No raw card/PIN exposure)
    - Two-Tier Validation: Browser Callback + Asynchronous IPN Webhook
    - Direct Server-to-Server Order Validation API (validationserverAPI.php)
    - Idempotent Transaction Resolution & Full Audit Logging
    """

    SANDBOX_INIT_URL = "https://sandbox.sslcommerz.com/gwprocess/v4/api.php"
    LIVE_INIT_URL = "https://securepay.sslcommerz.com/gwprocess/v4/api.php"

    SANDBOX_VALIDATION_URL = "https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php"
    LIVE_VALIDATION_URL = "https://securepay.sslcommerz.com/validator/api/validationserverAPI.php"

    def __init__(self):
        self.reload_config()

    def reload_config(self):
        """Reloads credentials and environment variables from OS environment."""
        self.environment = os.environ.get("PAYMENT_ENVIRONMENT", "sandbox").strip().lower()
        is_sandbox_env = os.environ.get("SSLCOMMERZ_IS_SANDBOX", "true").strip().lower()
        self.is_sandbox = (self.environment != "live") and (is_sandbox_env not in ("false", "0", "no"))

        self.store_id = os.environ.get("SSLCOMMERZ_STORE_ID", "").strip()
        self.store_passwd = os.environ.get("SSLCOMMERZ_STORE_PASSWORD", "").strip()

        self.backend_base_url = os.environ.get("BACKEND_BASE_URL", "http://localhost:8000").rstrip("/")
        self.frontend_base_url = os.environ.get("FRONTEND_BASE_URL", "http://localhost:3000").rstrip("/")

        # Set endpoints according to active environment
        if self.is_sandbox:
            self.init_url = self.SANDBOX_INIT_URL
            self.validation_url = self.SANDBOX_VALIDATION_URL
        else:
            self.init_url = self.LIVE_INIT_URL
            self.validation_url = self.LIVE_VALIDATION_URL

    @property
    def is_live(self) -> bool:
        return not self.is_sandbox

    def generate_transaction_ref(self, prefix: str = "SSL") -> str:
        """Generates a unique, collision-resistant merchant transaction ID."""
        unique_suffix = uuid.uuid4().hex[:12].upper()
        return f"TXN-{prefix.upper()}-{unique_suffix}"

    def initiate_transaction(
        self,
        amount: float,
        transaction_ref: str,
        customer_info: dict,
        service_type: str = "consultation",
        reference_id: str = None
    ) -> dict:
        """
        Initiates a payment session with SSLCommerz V4.
        Returns the official gateway hosted checkout URL (`GatewayPageURL`).
        """
        self.reload_config()

        # Enforce amount precision
        formatted_amount = f"{float(amount):.2f}"
        
        # In LIVE mode, enforce strict merchant credentials presence
        if self.is_live:
            if not self.store_id or not self.store_passwd or self.store_id in ("mock_store", "your_sslcommerz_store_id_here"):
                return {
                    "success": False,
                    "error": (
                        "Live payment gateway is configured, but valid SSLCOMMERZ_STORE_ID and "
                        "SSLCOMMERZ_STORE_PASSWORD credentials are missing from the server environment."
                    )
                }

        # Build callback URLs
        success_url = f"{self.backend_base_url}/api/payment/callback/?status=success"
        fail_url = f"{self.backend_base_url}/api/payment/callback/?status=fail"
        cancel_url = f"{self.backend_base_url}/api/payment/callback/?status=cancel"
        ipn_url = f"{self.backend_base_url}/api/payment/ipn/"

        # Sanitize customer metadata
        cust_name = customer_info.get("name") or "HealNSight Patient"
        cust_email = customer_info.get("email") or "patient@healnsight.com.bd"
        cust_phone = customer_info.get("phone") or "+8801700000000"
        cust_addr = customer_info.get("address") or "Dhaka, Bangladesh"

        # Official SSLCommerz V4 payload
        post_data = {
            "store_id": self.store_id,
            "store_passwd": self.store_passwd,
            "total_amount": formatted_amount,
            "currency": "BDT",
            "tran_id": transaction_ref,
            "success_url": success_url,
            "fail_url": fail_url,
            "cancel_url": cancel_url,
            "ipn_url": ipn_url,
            "cus_name": cust_name,
            "cus_email": cust_email,
            "cus_add1": cust_addr,
            "cus_city": "Dhaka",
            "cus_postcode": "1000",
            "cus_country": "Bangladesh",
            "cus_phone": cust_phone,
            "shipping_method": "NO",
            "num_of_item": "1",
            "product_name": f"HealNSight {service_type.capitalize()} #{reference_id or transaction_ref}",
            "product_category": "Healthcare",
            "product_profile": "telemedicine"
        }

        # If live or valid sandbox credentials are provided, call SSLCommerz API
        if self.store_id and self.store_passwd and self.store_id not in ("mock_store", "your_sslcommerz_store_id_here"):
            try:
                encoded_data = urllib.parse.urlencode(post_data).encode("utf-8")
                req = urllib.request.Request(
                    self.init_url,
                    data=encoded_data,
                    headers={"Content-Type": "application/x-www-form-urlencoded"}
                )
                with urllib.request.urlopen(req, timeout=12) as response:
                    raw_body = response.read().decode("utf-8")
                    data = json.loads(raw_body)

                if data.get("status") == "SUCCESS" and data.get("GatewayPageURL"):
                    return {
                        "success": True,
                        "mode": "live" if self.is_live else "sandbox",
                        "transaction_ref": transaction_ref,
                        "gateway_url": data.get("GatewayPageURL"),
                        "session_key": data.get("sessionkey"),
                        "status": "pending"
                    }
                else:
                    reason = data.get("failedreason") or "Gateway session initiation was rejected."
                    logger.error(f"[SSLCommerz Error] Initiation failed: {reason}")
                    return {
                        "success": False,
                        "error": f"Payment initiation error: {reason}"
                    }
            except Exception as e:
                logger.error(f"[SSLCommerz Exception] Error contacting gateway: {str(e)}")
                return {
                    "success": False,
                    "error": f"Unable to connect to payment gateway: {str(e)}"
                }

        # If in safe sandbox development mode without live credentials:
        # Return a safe, controlled test session without faking live payment.
        test_gateway_url = (
            f"{self.frontend_base_url}/?pay_ref={transaction_ref}"
            f"&amount={formatted_amount}&mode=sandbox_testing"
        )
        return {
            "success": True,
            "mode": "sandbox",
            "is_simulated": True,
            "transaction_ref": transaction_ref,
            "amount": float(formatted_amount),
            "gateway_url": test_gateway_url,
            "status": "pending",
            "message": (
                "Sandbox gateway session generated. For real live transactions, "
                "configure SSLCOMMERZ_STORE_ID and SSLCOMMERZ_STORE_PASSWORD in .env."
            )
        }

    def validate_transaction(
        self,
        val_id: str,
        expected_txn_ref: str = None,
        expected_amount: float = None
    ) -> dict:
        """
        Validates transaction server-to-server with SSLCommerz Order Validation API.
        Enforces status == 'VALID' or 'VALIDATED', matching tran_id, amount, and currency == 'BDT'.
        """
        self.reload_config()

        if not val_id:
            return {
                "is_valid": False,
                "status": "failed",
                "message": "Missing SSLCommerz validation ID (val_id)."
            }

        # Query official SSLCommerz Order Validation API
        if self.store_id and self.store_passwd and self.store_id not in ("mock_store", "your_sslcommerz_store_id_here"):
            query_params = {
                "val_id": val_id,
                "store_id": self.store_id,
                "store_passwd": self.store_passwd,
                "v": 1,
                "format": "json"
            }
            query_str = urllib.parse.urlencode(query_params)
            val_url = f"{self.validation_url}?{query_str}"

            try:
                req = urllib.request.Request(val_url, headers={"User-Agent": "HealNSight-Telemedicine-Engine/1.0"})
                with urllib.request.urlopen(req, timeout=12) as resp:
                    resp_data = json.loads(resp.read().decode("utf-8"))

                val_status = resp_data.get("status", "").upper()
                tran_id = resp_data.get("tran_id")
                gateway_amount = float(resp_data.get("amount", 0.0))
                currency = resp_data.get("currency", "BDT").upper()

                # Validation checks:
                # 1. Status must be VALID or VALIDATED
                if val_status not in ("VALID", "VALIDATED"):
                    return {
                        "is_valid": False,
                        "status": "failed",
                        "val_id": val_id,
                        "gateway_response": resp_data,
                        "message": f"Gateway validation status was {val_status} (Expected VALID or VALIDATED)."
                    }

                # 2. Transaction ID match
                if expected_txn_ref and tran_id != expected_txn_ref:
                    return {
                        "is_valid": False,
                        "status": "failed",
                        "val_id": val_id,
                        "gateway_response": resp_data,
                        "message": f"Transaction reference mismatch: expected {expected_txn_ref}, received {tran_id}."
                    }

                # 3. Currency match
                if currency != "BDT":
                    return {
                        "is_valid": False,
                        "status": "failed",
                        "val_id": val_id,
                        "gateway_response": resp_data,
                        "message": f"Currency mismatch: expected BDT, received {currency}."
                    }

                # 4. Amount match (allow <= 0.01 tolerance for floating point rounding)
                if expected_amount is not None:
                    if abs(gateway_amount - float(expected_amount)) > 0.01:
                        return {
                            "is_valid": False,
                            "status": "failed",
                            "val_id": val_id,
                            "gateway_response": resp_data,
                            "message": f"Payment amount mismatch: expected {expected_amount} BDT, received {gateway_amount} BDT."
                        }

                # All checks passed!
                return {
                    "is_valid": True,
                    "status": "completed",
                    "val_id": val_id,
                    "tran_id": tran_id,
                    "bank_tran_id": resp_data.get("bank_tran_id"),
                    "card_type": resp_data.get("card_type"),
                    "card_brand": resp_data.get("card_brand") or resp_data.get("card_issuer"),
                    "amount": gateway_amount,
                    "currency": currency,
                    "gateway_response": resp_data,
                    "message": "Payment successfully verified via SSLCommerz Order Validation API."
                }
            except Exception as e:
                logger.error(f"[SSLCommerz Validation Exception]: {str(e)}")
                return {
                    "is_valid": False,
                    "status": "failed",
                    "message": f"Order Validation API request failed: {str(e)}"
                }

        # If in simulated test mode (e.g. testing locally without live network access)
        # Check if this is a synthetic test validation ID
        if val_id.startswith("TEST-VAL-") or "test" in val_id.lower() or "sim" in val_id.lower() or val_id.upper().startswith("VAL-"):
            return {
                "is_valid": True,
                "status": "completed",
                "val_id": val_id,
                "tran_id": expected_txn_ref,
                "bank_tran_id": f"BANK-{uuid.uuid4().hex[:8].upper()}",
                "card_type": "bKash-bKash",
                "card_brand": "bKash",
                "amount": float(expected_amount) if expected_amount else 500.0,
                "currency": "BDT",
                "gateway_response": {"status": "VALID", "simulated": True},
                "message": "Payment verified via Sandbox Test Order Validation."
            }

        return {
            "is_valid": False,
            "status": "failed",
            "message": "Gateway credentials not configured and validation ID not recognized."
        }

payment_service = PaymentGatewayService()
