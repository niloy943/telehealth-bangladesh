# HealNSight Telehealth Bangladesh — Complete 58 APIs Directory

This directory contains the complete API specifications, Postman collection, OpenAPI 3.0 definitions, and cURL test scripts for all **58 APIs** across the Telehealth Bangladesh monorepo.

---

## Files in this Directory

| File | Format | Description |
| :--- | :--- | :--- |
| **`telehealth_postman_collection.json`** | Postman 2.1.0 JSON | Complete ready-to-import Postman Collection organized into 16 logical folders with pre-filled bodies, variables, and headers. |
| **`telehealth_openapi_spec.json`** | OpenAPI 3.0.3 JSON | Standard OpenAPI (Swagger) specification defining schemas, request bodies, tags, and response codes for all 58 endpoints. |
| **`curl_commands.sh`** | Bash Script | Executable script for Linux / macOS to test primary endpoints with curl. |
| **`curl_commands.bat`** | Windows Batch | Double-clickable batch file for Windows terminal testing. |
| **`README.md`** | Markdown | Documentation, installation instructions, and environment variable configuration. |

---

## Service Endpoints & Ports

| Service | Protocol | Base URL | Responsibilities |
| :--- | :---: | :--- | :--- |
| **Django Core Backend** | HTTP / WS | `http://127.0.0.1:8000` | Core clinical logic, E2EE records, WebRTC signaling, appointments, e-prescriptions, payments, blockchain ledger, and DGHS integrations. |
| **Node.js Auth Microservice** | HTTP | `http://localhost:5000` | Rate-limited OTP challenges, SMS/email OTP generation, and password resets using Django PBKDF2 hashing. |
| **FastAPI Worker** | HTTP / WS | `http://localhost:6000` | Multimodal ECG/CBC chart analysis and real-time Speech-to-Text audio streaming. |

---

## How to Import into Postman

1. Open **Postman**.
2. Click **Import** (top left).
3. Drag and drop `telehealth_postman_collection.json`.
4. In Postman, go to the collection's **Variables** tab and verify the base URLs:
   - `django_base`: `http://127.0.0.1:8000`
   - `node_base`: `http://localhost:5000`
   - `fastapi_base`: `http://localhost:6000`
   - `auth_token`: *[Paste your JWT access token here after logging in]*
5. Start testing any of the 58 requests!

---

## How to View in Swagger UI / OpenAPI Viewer

You can import `telehealth_openapi_spec.json` directly into:
- [Swagger Editor](https://editor.swagger.io/)
- [Postman](https://www.postman.com/)
- [Insomnia REST Client](https://insomnia.rest/)
- [Redocly](https://redocly.com/)

---

## Complete 58 APIs Index

### 1. Django Authentication & Security (7 APIs)
- `POST /api/register/` — Register New User
- `POST /api/login/` — Standard JWT Token Login
- `POST /api/auth/login-secure/` — Two-Factor Secure Login (MFA Stage 1)
- `POST /api/auth/mfa-verify/` — TOTP MFA Verification (MFA Stage 2)
- `POST /api/token/refresh/` — Refresh Access Token
- `POST /api/auth/forgot-password/` — Django Password Reset Request
- `POST /api/auth/reset-password/` — Django Password Reset Confirm

### 2. User Profiles & Doctor KYC (5 APIs)
- `GET /api/profile/` — Fetch User / Doctor / Patient Profile
- `PUT /api/profile/` — Update Demographics and Medical Indicators
- `GET /api/doctors/` — Public Directory of Verified Doctors
- `GET /api/admin/doctors/` — Admin Doctor KYC Review List
- `POST /api/admin/doctors/{id}/action/` — Approve / Reject Doctor Verification

### 3. Appointments & Consultations (6 APIs)
- `GET /api/appointments/` — List Appointments
- `POST /api/appointments/` — Book Telehealth Appointment
- `GET /api/appointments/{id}/` — Get Appointment Details
- `PUT /api/appointments/{id}/` — Reschedule / Update Status
- `DELETE /api/appointments/{id}/` — Cancel Appointment
- `GET /api/consultations/{id}/` — Retrieve Clinical Session
- `PUT /api/consultations/{id}/` — Save Diagnosis, Vitals, and Clinical Notes

### 4. E2EE Medical Records & Patient Consent (5 APIs)
- `GET /api/records/` — List Patient Encrypted Health Records
- `POST /api/records/` — Upload Encrypted Medical Record
- `GET /api/consent/` — List Active Doctor Access Grants
- `POST /api/consent/` — Grant Record Access to Doctor
- `POST /api/consent/{id}/` — Revoke Consent Access

### 5. Digital E-Prescriptions & Pharmacy Sharing (4 APIs)
- `GET /api/prescriptions/` — List E-Prescriptions
- `POST /api/prescriptions/` — Issue Digital E-Prescription
- `POST /api/prescriptions/{id}/share/` — Generate Secure Share Token
- `GET /api/prescriptions/shared/{token}/` — Public Verified Prescription View

### 6. Pharmacy Catalog & Medicine Orders (4 APIs)
- `GET /api/medicines/` — Search Medicine Inventory
- `GET /api/orders/` — List Medicine Orders
- `POST /api/orders/` — Place Medicine Delivery Order
- `PUT /api/orders/{id}/` — Update Order Tracking / Delivery Status

### 7. Payment Gateway (SSLCommerz V4) (5 APIs)
- `POST /api/payment/initiate/` — Initiate SSLCommerz Payment Session
- `POST /api/payment/callback/` — Payment Gateway Browser Return
- `POST /api/payment/ipn/` — Instant Payment Notification (IPN) Webhook
- `GET /api/payment/status/{transaction_ref}/` — Check Payment Transaction Status
- `GET /api/payment/history/` — Patient Billing and Transaction History

### 8. Telephony & Cellular Consultations (6 APIs)
- `POST /api/telephony/call/` — Initiate Cellular Bridge Voice Call
- `POST /api/telephony/call/{call_sid}/terminate/` — Hang Up Active Voice Call
- `GET /api/telephony/call/{call_sid}/status/` — Check Live Call State
- `GET /api/telephony/calls/` — List Consultation Voice Call Records
- `POST /api/telephony/twiml/` — Dynamic TwiML Audio Instructions
- `POST /api/telephony/twiml/{consultation_id}/` — Consultation Conference TwiML

### 9. Government DGHS / NID / BMDC Verification (2 APIs)
- `POST /api/gov/verify-nid/` — Bangladesh National ID (NID) DGHS Registry Check
- `POST /api/gov/verify-bmdc/` — BMDC Doctor Medical License Verification

### 10. Encrypted File Storage (2 APIs)
- `POST /api/storage/upload/` — Upload Encrypted Diagnostic Scan / File
- `GET /api/storage/file/{filename}/` — Download / Stream Encrypted Medical File

### 11. Blockchain & Cryptographic Audit Ledger (3 APIs)
- `GET /api/blockchain/records/` — Query Tamper-Evident SHA-256 Ledger
- `POST /api/blockchain/verify-record/` — Verify Cryptographic Hash Linkage
- `GET /api/blockchain/transaction/{tx_hash}/` — Get On-Chain Ethereum Receipt

### 12. Audit Logs & Diagnostic Image Profiles (3 APIs)
- `GET /api/audit-logs/` — Retrieve System Administrative Audit Logs
- `GET /api/image-profiles/` — List Patient Diagnostic Scans
- `POST /api/image-profiles/` — Create Diagnostic Image Profile Summary

### 13. AI Health Assistant & Symptom Triage (3 APIs)
- `POST /api/ai/health-assistant/` — Dual-Language Symptom Triage (Bengali/English)
- `GET /api/ai/health-assistant/conversations/` — List User AI Conversations
- `GET /api/ai/health-assistant/conversations/{conversation_id}/` — Get AI Chat Transcript

### 14. Django Channels Real-Time WebSockets (1 API)
- `WS /ws/consultation/{consultation_id}/` — WebRTC Audio/Video Signaling & Chat

### 15. Node.js Authentication & OTP Microservice (7 APIs)
- `GET /health` — Service Health Check
- `POST /api/auth/register` — Node Sandbox User Registration
- `POST /api/auth/login` — Node Authentication & Token Issuance
- `POST /api/auth/forgot-password` — Rate-Limited 6-Digit OTP Generation & Dispatch
- `POST /api/auth/verify-otp` — Rate-Limited OTP Validation (10-min window)
- `POST /api/auth/reset-password` — Password Reset with Django PBKDF2 Hashing
- `GET /api/auth/audit-logs` — Administrative OTP Challenge Audit Logs

### 16. FastAPI AI & Multimodal Worker (3 APIs)
- `GET /` — FastAPI Worker Status
- `POST /api/vision/analyze` — Multimodal ECG/CBC Chart Feature Extraction
- `WS /ws/audio` — Live Binary PCM Audio Streaming & Speech-to-Text Transcription
