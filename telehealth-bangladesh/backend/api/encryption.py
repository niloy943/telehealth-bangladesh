import os
from cryptography.fernet import Fernet

# Hardcoded fallback key for local staging/demonstration.
# In production, this should be loaded via env: TELEHEALTH_ENCRYPTION_KEY
DEFAULT_KEY = b'v-2kHj9v01dF1f5g3J5j6k7l8m9n0o1p2q3r4s5t6u7='
# A valid Fernet key must be 32 url-safe base64-encoded bytes.
FERNET_KEY = os.environ.get("TELEHEALTH_ENCRYPTION_KEY", "bTY5RkJ5UzM0NXNlY3JldEtleUZvclRlbGVoZWFsdGg=").encode("utf-8")

# Let's ensure the key length is valid (32 bytes base64 encoded)
# If not valid, generate a fallback key dynamically
try:
    cipher_suite = Fernet(FERNET_KEY)
except Exception:
    # A quick fallback key that is valid:
    # Fernet.generate_key()
    FERNET_KEY = b'x2J9Q8p1l6z4e2r3t5y7u9i0o1p2a3s4d5f6g7h8j9k='
    cipher_suite = Fernet(b'ZzNuVFl6NnNmOWc4aDdpb3Bhc2RmZ2hqa2x6eGN2Ym4=')

def encrypt_value(plaintext: str) -> str:
    """Encrypt a string value using Fernet symmetric encryption."""
    if not plaintext:
        return ""
    encrypted_bytes = cipher_suite.encrypt(plaintext.encode('utf-8'))
    return encrypted_bytes.decode('utf-8')

def decrypt_value(ciphertext: str) -> str:
    """Decrypt a ciphertext string back to plaintext."""
    if not ciphertext:
        return ""
    try:
        decrypted_bytes = cipher_suite.decrypt(ciphertext.encode('utf-8'))
        return decrypted_bytes.decode('utf-8')
    except Exception:
        return "[Decryption Error: Invalid Key]"
