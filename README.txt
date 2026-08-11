========================================================================
             SWASTHONIRAPOD - SECURE TELEMEDICINE PLATFORM
                       Project Setup & Run Manual
========================================================================

SwasthoNirapod is a highly secure, end-to-end encrypted telemedicine SaaS 
platform tailored for the Bangladesh context, connecting Patients, Certified 
Doctors, and System Administrators.

------------------------------------------------------------------------
1. PREREQUISITES
------------------------------------------------------------------------
Before running the application, ensure the following are installed:
* Python (Version 3.8 or above)
* Node.js & npm (Required to build the modern Vite+Tailwind React frontend)

------------------------------------------------------------------------
2. RUNNING THE SYSTEM (EASY START)
------------------------------------------------------------------------
The project provides automated orchestration scripts to run both the 
backend database migrations/seeds and startup servers.

Step A: Seed the Database
-------------------------
Run the following script to create migrations, generate the local SQLite database, 
and seed it with mock doctors, patients, records, and appointments:
> python run_migrations.py

Step B: Start all servers
-------------------------
Run this script to build the frontend assets via Vite and start both the 
Django Daphne (backend) and Python http.server (frontend) simultaneously:
> python run_all.py

Once started:
* FRONTEND is accessible at: http://localhost:3000/
* BACKEND REST API & WebSockets run on: http://localhost:8000/

------------------------------------------------------------------------
3. RUNNING MANUALLY (STEP-BY-STEP)
------------------------------------------------------------------------
If you prefer running the components in separate terminal windows:

Terminal 1 - Django Daphne Backend:
----------------------------------
> cd backend
> pip install -r requirements.txt   (Install dependencies including daphne)
> python manage.py migrate
> python manage.py seed_data        (Seed mock accounts and data logs)
> python run_backend.py             (Starts ASGI Daphne server on port 8000)

Terminal 2 - React Frontend Compiler & Server:
----------------------------------------------
> cd frontend-src
> npm install                       (Install React, Vite, and Tailwind dependencies)
> npm run build                     (Compiles optimized production static files)
> cd ..
> python run_frontend.py            (Spins up python web server on port 3000)

------------------------------------------------------------------------
4. TEST ACCOUNT CREDENTIALS (THE 3 ROLES)
------------------------------------------------------------------------
Use these credentials on the login screen. Note that you MUST select the 
matching role card (Patient, Doctor, or Admin) before entering credentials.

------------------------------------------------------------------------
------------------------------------------------------------------------
ROLE 1: PATIENT 
------------------------------------------------------------------------
* Usernames:        sadia, niloy, rakib, farhan, nasir
* Password:         password123

------------------------------------------------------------------------
ROLE 2: CERTIFIED DOCTOR
------------------------------------------------------------------------
* Usernames:        sarah, zara, kamal, sukarna
* Password:         password123

------------------------------------------------------------------------
ROLE 3: SYSTEM ADMINISTRATOR
------------------------------------------------------------------------
* Usernames:        admin1, admin2
* Password:         password123
* Security Gate:    Requires Administrative Org Passcode: ADMIN-SN-2026

------------------------------------------------------------------------
MOCK VERIFICATION & MFA BYPASS CODES
------------------------------------------------------------------------
* SMS/Email OTP Code:    123456
* Admin Org Passcode:    ADMIN-SN-2026
* Email Link Match:      Simulated Gmail link validation (resolves 
                         automatically 2 seconds after dispatch).

========================================================================
5. FRONTEND NAVIGATION & INTERACTION GUIDE
========================================================================
* Role Locks: Input fields and submit buttons are disabled on initial load 
  and are unlocked only after clicking one of the 👤/👨‍⚕️role cards.
* Switchers: Toggling the Globe icon (top right) translates all labels and 
  validation messages between English and Bangla. Toggling the Sun/Moon 
  icon switches themes.
* Audit trail logging: Logging in as Doctor and inspecting patient records 
  generates encrypted decryption access logs. Log out and sign in as 
  Admin to view these actions updated in real-time on the security ledger!
========================================================================
6. PASSWORD RESET WORKFLOW & API DOCUMENTATION
========================================================================
To request a password reset or change passwords:

A. Forgot Password Endpoint:
----------------------------
URL: POST http://localhost:8000/api/auth/forgot-password/
Request Body:
{
  "email_or_phone": "admin@swasthonirapod.com"
}
Response:
{
  "message": "If an account exists with this email/phone, a reset link has been sent."
}
* Note: In local development, the email with the reset token is output to the Django terminal console.

B. Reset Password Endpoint:
---------------------------
URL: POST http://localhost:8000/api/auth/reset-password/
Request Body:
{
  "token": "<uidb64>-<token>",
  "new_password": "NewPassword@12345",
  "confirm_password": "NewPassword@12345"
}
Response:
{
  "message": "Password has been successfully reset. You can now login with your new password."
}
* Note: Tokens are single-use and expire after 15 minutes. Password strength rules apply (minimum length, mixed characters).

C. Testing Forgot Password UI Flow:
-----------------------------------
1. Go to the login page (http://localhost:3000/).
2. Select any role card (Patient, Doctor, or Admin).
3. Click the "Forgot Password?" button (with a lock icon) next to the login inputs.
4. Enter a registered email (e.g. "sarah.jenkins@dmch.edu.bd" or "john.doe@gmail.com") and click submit.
5. In the backend terminal output, you will see the generated reset email. Copy the reset URL (which includes the token parameter, e.g., `http://localhost:3000/?token=<token>`).
6. Navigate to that copied URL in your browser. The page will load the Reset Password form directly.
7. Enter a new password matching security requirements and confirm it to successfully complete the password reset.

========================================================================
7. E-PRESCRIPTION GENERATION & PDF AUTO-DOWNLOAD
========================================================================
The prescription management desk is updated to ensure clean formatting and reliability:
* Circular DRF serialization has been resolved, making active consultations serializable.
* The complex JSON schema structure for prescribing has been replaced with a custom-built medication list form. Doctors can dynamically add, update, or remove list items through simple text fields (Medication name, Dosage, Duration, Instructions).
* When the doctor saves the prescription, the application automatically triggers a styled PDF compilation and downloads the generated PDF locally in the browser immediately.

========================================================================
8. BRANDING & PREMIUM UX AESTHETICS
========================================================================
* Global Rebranding: All instances of "TeleVital", "TeleVital BD", and the Bengali name "টেলিভাইটাল বিডি" have been renamed to "SwasthoNirapod" (and "স্বাস্থ্যনিরাপদ") across all files.
* Premium Theme: A high-end transparent medical sector visual theme has been applied globally as the application background, accented with beautiful CSS blur effects, soft gradients, and modern fonts (Inter, Noto Sans Bengali).
========================================================================

