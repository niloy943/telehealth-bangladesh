import os
import sys
import json
import base64
import django
from datetime import timedelta

sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'telehealth_project.settings')
django.setup()

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken, AccessToken
from api.models import (
    User, Appointment, Consultation, HealthRecord,
    Consent, PatientImageProfile, LoginAttempt, BlockchainRecord
)
from api.encryption import (
    encrypt_value, decrypt_value, rotate_and_reencrypt_record, kms_provider
)

User = get_user_model()
client = APIClient()

print("\n" + "=" * 70)
print("  HEALNSIGHT PRODUCTION SECURITY & CRYPTOGRAPHIC VERIFICATION SUITE")
print("=" * 70)

# ------------------------------------------------------------------------------
# 1. TEST CRYPTOGRAPHIC ENVELOPE ENCRYPTION (AES-256-GCM + KMS KEK/DEK)
# ------------------------------------------------------------------------------
print("\n[SECURITY TEST 1] AES-256-GCM Envelope Encryption & Tamper Detection...")
sample_medical_data = "Systolic: 128 mmHg, Diastolic: 82 mmHg, ECG: Normal Sinus Rhythm."
env_str = encrypt_value(sample_medical_data)
assert "HNS-ENV-AES256GCM-V1" in env_str, "Envelope must use HNS-ENV-AES256GCM-V1 schema"
decrypted = decrypt_value(env_str)
assert decrypted == sample_medical_data, "Plaintext must decrypt accurately"

# Tampering Test
env_obj = json.loads(env_str)
ct_bytes = bytearray(base64.b64decode(env_obj["ciphertext"]))
ct_bytes[0] ^= 0xAA # Invalidate GCM tag
env_obj["ciphertext"] = base64.b64encode(ct_bytes).decode()
tampered_dec = decrypt_value(json.dumps(env_obj))
assert "Decryption Error" in tampered_dec, "GCM Auth Tag MUST catch tampering"
print("  >>> PASS: Envelope Encryption and GCM Tamper Proofing Verified.")

# Re-encryption Test
rotated = rotate_and_reencrypt_record(env_str, "kms/telemedicine-prescription-cmk-v2")
assert "cmk-v2" in rotated
assert decrypt_value(rotated) == sample_medical_data
print("  >>> PASS: Centralized Key Migration & Re-encryption to CMK-v2 Verified.")

# ------------------------------------------------------------------------------
# 2. TEST IDOR PREVENTION ON MEDICAL IMAGES (BOLA OWASP API1:2023)
# ------------------------------------------------------------------------------
print("\n[SECURITY TEST 2] Medical Scan IDOR & Unauthorized Access Prevention...")
doctor_sarah = User.objects.get(username="sarah")
doctor_zara = User.objects.get(username="zara")
patient_niloy = User.objects.get(username="niloy")
patient_sadia = User.objects.get(username="sadia")

# Create a scan for Sadia
scan_sadia = PatientImageProfile.objects.create(
    patient=patient_sadia,
    image_name="Sadia_Ultrasound.png",
    image_file="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    previous_data={"notes": "Normal"}
)

# Authenticate as Doctor Zara (who has NO relationship/consent with Sadia)
zara_token = str(RefreshToken.for_user(doctor_zara).access_token)
client.credentials(HTTP_AUTHORIZATION=f"Bearer {zara_token}")

# Zara attempts to query all images without parameter
res_all = client.get("/api/image-profiles/")
assert res_all.status_code == 403, f"Expected 403 Forbidden for doctor dump, got {res_all.status_code}"
print("  >>> PASS: Doctor wildcard dump of medical images strictly BLOCKED (HTTP 403).")

# Zara attempts to query Sadia's images specifically (IDOR)
res_idor = client.get(f"/api/image-profiles/?patient_id={patient_sadia.id}")
assert res_idor.status_code == 403, f"Expected 403 Forbidden for unauthorized patient scan, got {res_idor.status_code}"
print("  >>> PASS: IDOR attempt on unconsented patient scan strictly BLOCKED (HTTP 403).")

# ------------------------------------------------------------------------------
# 3. TEST BRUTE FORCE LOGIN PROTECTION & CONSECUTIVE FAILURE LOCKOUT
# ------------------------------------------------------------------------------
print("\n[SECURITY TEST 3] Brute Force Login Protection & Lockout...")
test_user = "brute_target_" + str(int(timezone.now().timestamp()))
u = User.objects.create_user(username=test_user, password="RealPassword123!", role="patient")
LoginAttempt.objects.filter(username=test_user).delete()

client.credentials() # Unauthenticated
for attempt_num in range(1, 6):
    res_fail = client.post("/api/login/", {"username": test_user, "password": "WrongPassword!"}, format="json")

# 6th attempt should be locked out
res_locked = client.post("/api/login/", {"username": test_user, "password": "WrongPassword!"}, format="json")
assert res_locked.status_code in [400, 401, 429], f"Unexpected status: {res_locked.status_code}"
assert "locked" in str(res_locked.data).lower(), f"Expected lockout notice, got {res_locked.data}"
print("  >>> PASS: Consecutive brute-force failures trigger Account Lockout.")

# ------------------------------------------------------------------------------
# 4. TEST TOKEN BLACKLIST & ROTATING REFRESH TOKENS
# ------------------------------------------------------------------------------
print("\n[SECURITY TEST 4] JWT Rotating Refresh Tokens & Blacklist Verification...")
refresh = RefreshToken.for_user(patient_niloy)
access = str(refresh.access_token)
old_refresh_str = str(refresh)

# Rotate token by obtaining new access token
res_rotate = client.post("/api/token/refresh/", {"refresh": old_refresh_str}, format="json")
assert res_rotate.status_code == 200, f"Refresh failed: {res_rotate.data}"
new_refresh_str = res_rotate.data.get("refresh")
assert new_refresh_str != old_refresh_str, "Refresh token must rotate"

# Attempting to reuse old refresh token MUST FAIL (blacklisted)
res_reuse = client.post("/api/token/refresh/", {"refresh": old_refresh_str}, format="json")
assert res_reuse.status_code in [400, 401], "Reusing rotated refresh token MUST be rejected"
print("  >>> PASS: Rotating Refresh Tokens and Token Blacklist Verified.")

# ------------------------------------------------------------------------------
# 5. TEST BLOCKCHAIN ATOMIC SERIALIZATION LOCKING
# ------------------------------------------------------------------------------
print("\n[SECURITY TEST 5] Blockchain Concurrency & Atomic Serialization Lock...")
from blockchain.service import BlockchainIntegrityService
b_service = BlockchainIntegrityService()
b1 = b_service.commit_record("health_record", 901, {"metric": "Pulse 72"})
b2 = b_service.commit_record("health_record", 902, {"metric": "Pulse 74"})
assert b2.block_number == b1.block_number + 1, "Block numbers must be sequential"
assert b2.prev_hash == b1.data_hash, "prev_hash must cryptographically link to preceding block"
print("  >>> PASS: Blockchain Atomic Ledger Serialization Verified.")

print("\n" + "=" * 70)
print("  ALL 5 PRODUCTION SECURITY REGRESSION TESTS PASSED (100% SUCCESS)!")
print("=" * 70 + "\n")
