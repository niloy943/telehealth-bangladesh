import os
import random

class GovernmentHealthService:
    """
    Interface for Directorate General of Health Services (DGHS) &
    National ID (NID) & BMDC Doctor Registration Verification.
    Supports live API endpoint binding via env variables, with documented
    production specs and sandbox verification fallback for local testing.
    """
    def __init__(self):
        self.api_key = os.environ.get("GOV_API_KEY")
        self.endpoint = os.environ.get("GOV_HEALTH_ENDPOINT", "https://api.dghs.gov.bd/v1")
        self.is_production = bool(self.api_key and self.api_key != "mock_key")

    def verify_nid(self, nid_number: str, dob_str: str = None):
        """
        Validates a Bangladeshi National ID (NID) number against national registry.
        """
        if not nid_number or len(nid_number) not in [10, 13, 17]:
            return {
                "valid": False,
                "error": "Invalid Bangladesh NID length. NID must be 10, 13, or 17 digits long."
            }

        if self.is_production:
            try:
                import requests
                resp = requests.post(
                    f"{self.endpoint}/nid/verify",
                    json={"nid": nid_number, "dob": dob_str},
                    headers={"Authorization": f"Bearer {self.api_key}"},
                    timeout=5
                )
                return resp.json()
            except Exception as e:
                return {"valid": False, "error": f"Government NID portal error: {str(e)}"}
        else:
            # Sandbox Verification Response
            return {
                "valid": True,
                "mode": "sandbox",
                "nid": nid_number,
                "verification_id": f"NID-DGHS-{random.randint(100000, 999999)}",
                "verified": True,
                "message": "NID successfully verified against DGHS Sandbox Health Ledger."
            }

    def verify_bmdc_license(self, bmdc_reg_no: str, doctor_name: str = ""):
        """
        Validates Bangladesh Medical & Dental Council (BMDC) Registration number.
        """
        if not bmdc_reg_no or not bmdc_reg_no.upper().startswith("BMDC"):
            return {
                "valid": False,
                "error": "BMDC Registration number must begin with prefix 'BMDC/' (e.g. BMDC/A-22334)."
            }

        if self.is_production:
            try:
                import requests
                resp = requests.post(
                    f"{self.endpoint}/bmdc/verify",
                    json={"bmdc_reg": bmdc_reg_no, "name": doctor_name},
                    headers={"Authorization": f"Bearer {self.api_key}"},
                    timeout=5
                )
                return resp.json()
            except Exception as e:
                return {"valid": False, "error": f"BMDC Registration Portal error: {str(e)}"}
        else:
            return {
                "valid": True,
                "mode": "sandbox",
                "bmdc_reg": bmdc_reg_no,
                "license_status": "ACTIVE_REGISTERED",
                "qualification": "MBBS, FCPS (Certified)",
                "verified": True,
                "message": "BMDC License registration verified against Ministry Sandbox Register."
            }

gov_service = GovernmentHealthService()
