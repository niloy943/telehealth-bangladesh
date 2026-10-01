@echo off
REM ==============================================================================
REM HealNSight Telehealth Bangladesh — Complete 58 APIs cURL Runner (Windows Batch)
REM ==============================================================================

set DJANGO_URL=http://127.0.0.1:8000
set NODE_URL=http://localhost:5000
set FASTAPI_URL=http://localhost:6000
set TOKEN=YOUR_ACCESS_TOKEN_HERE

echo === 1. Node.js Health Check ===
curl -s -X GET %NODE_URL%/health
echo.

echo === 2. FastAPI Worker Root ===
curl -s -X GET %FASTAPI_URL%/
echo.

echo === 3. Public Doctor Directory ===
curl -s -X GET %DJANGO_URL%/api/doctors/
echo.

echo === 4. Medicine Catalog ===
curl -s -X GET %DJANGO_URL%/api/medicines/
echo.

echo === 5. AI Symptom Triage Assessment ===
curl -s -X POST %DJANGO_URL%/api/ai/health-assistant/ -H "Content-Type: application/json" -d "{\"message\": \"I have fever and persistent dry cough\", \"language\": \"en\"}"
echo.

echo === 6. Request Forgot Password OTP (Node) ===
curl -s -X POST %NODE_URL%/api/auth/forgot-password -H "Content-Type: application/json" -d "{\"email\": \"nasim.patient@healnsight.com.bd\"}"
echo.

echo === 7. User Profile (Authenticated) ===
curl -s -X GET %DJANGO_URL%/api/profile/ -H "Authorization: Bearer %TOKEN%"
echo.

echo === 8. Blockchain Ledger Records ===
curl -s -X GET %DJANGO_URL%/api/blockchain/records/ -H "Authorization: Bearer %TOKEN%"
echo.

echo === Done! ===
pause
