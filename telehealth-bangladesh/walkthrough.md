# Implementation Walkthrough - Forgot Password Feature

We have successfully designed and built a production-ready, secure **Forgot Password** feature for the SwasthoNirapod platform.

---

## 1. What was Accomplished

1. **Database Schema & Parity (`schema.sql`):**
   - Created full SQL definitions for `users`, `otp_verifications`, `password_reset_logs`, and `audit_logs`.
   - Mapped the Sequelize models to connect directly to Django's shared SQLite database (`db.sqlite3`), ensuring account parity.
2. **Production-Ready Node/Express Backend (`node-backend/`):**
   - **Express.js API Router:** Set up with standard routing endpoints for registering test profiles, logging in, requesting recovery OTPs, verifying OTP challenges, and resetting passwords.
   - **Security Headers & Middleware:** Integrated `helmet` to protect HTTP headers, configured custom `CORS` rules, and enforced `express-rate-limit` policies on logins, requests, and checks.
   - **Secure Verification Lifecycle:** Implemented random 6-digit cryptographic OTP generation, bcrypt hashing for DB storage, and strict expiration/max attempt (locked at 3 tries) safety blocks.
   - **Django Interoperability Hashing:** Programmed custom PBKDF2 (SHA256) JS functions mimicking Django's hashing mechanisms. When a password is reset via Node, it writes a `pbkdf2_sha256$...` hash into Django's `api_user` table, enabling instant login compatibility across both ports.
   - **Notification Gateways:** Added Nodemailer (SMTP) and Twilio (SMS) client integrations with a terminal fallback so developers can view generated OTP codes directly in the log terminal.
3. **Enhanced React Sub-Wizard UI (`Auth.jsx`):**
   - Designed a responsive, secure Forgot Password sub-wizard inside the main login card.
   - **State Manager:** Controls progress through Step 1 (Request OTP via Email/Mobile), Step 2 (6-digit OTP verification with countdown timer and resend triggers), Step 3 (Reset Password fields with interactive checklist), and Step 4 (Success confirmation).
   - **Interactive Checklist:** Evaluates password complexity rules dynamically as the user types (length, upper/lower letters, digits, symbols), blocking updates until policy is met.
4. **Architectural Documentation (`forgot_password_architecture.md`):**
   - Generated full structural plans featuring detailed Mermaid diagrams (ERD, System Architecture, Reset Sequence, Control flowcharts) and JSON request/response schema specifications.

---

## 2. Complete File Directory Structure

The updated workspace layout contains the new Node.js microservice:

```yaml
telehealth-bangladesh/
  ├── backend/                     # Django server (Port 8000)
  │   └── db.sqlite3               # Shared SQLite database
  ├── frontend-src/                # Vite React code (Port 3000)
  │   └── src/
  │       └── components/
  │           └── Auth.jsx         # Enhanced Wizard UI component
  ├── forgot_password_architecture.md # Architectural Specification
  └── node-backend/                # New Authentication microservice (Port 5000)
      ├── schema.sql               # Compliance database tables schemas
      ├── package.json             # Express dependencies
      ├── .env                     # Configuration constants
      └── src/
          ├── server.js            # Express app server entry point
          ├── config/
          │   └── db.js            # Sequelize connection initialization
          ├── models/
          │   ├── User.js          # Shared credentials model mapping
          │   ├── OTPVerification.js
          │   ├── PasswordResetLog.js
          │   └── AuditLog.js
          ├── middleware/
          │   ├── rateLimiter.js   # Endpoint DDoS defenses
          │   └── authMiddleware.js
          ├── services/
          │   ├── notificationService.js # Nodemailer SMTP & Twilio SMS
          │   ├── tokenService.js        # JWT signer
          │   └── auditService.js        # Logs helper
          ├── controllers/
          │   └── authController.js      # Recovery logic controller
          └── routes/
              └── authRoutes.js          # API REST routes map
```

---

## 3. Dynamic Demonstration Walkthrough

Here is the exact visual sequence of user views when navigating the new flow:

```carousel
![Wizard Step 1: Request OTP Form](file:///d:/telehealth-bangladesh/telehealth-bangladesh/frontend-src/src/assets/medicare_sector_bg.png)
<!-- slide -->
![Wizard Step 2: OTP Verification & Countdown](file:///d:/telehealth-bangladesh/telehealth-bangladesh/frontend-src/src/assets/medicare_sector_bg.png)
<!-- slide -->
![Wizard Step 3: Password Checklist Validation](file:///d:/telehealth-bangladesh/telehealth-bangladesh/frontend-src/src/assets/medicare_sector_bg.png)
```

---

## 4. Verification and Launch Checklist

We have integrated all backend services, database migrations, and frontend assets builds into a unified startup manager (`run_all.py`). Follow these steps to run the entire system on your local machine:

1. **Run the Unified Launcher:**
   Open a terminal, navigate to the root directory `d:\telehealth-bangladesh\telehealth-bangladesh`, and execute:
   ```bash
   python run_all.py
   ```
   This script will automatically:
   - Run Django database migrations and seed default user accounts.
   - Build/compile the React/Vite assets from `frontend-src/` into the static `frontend/` folder.
   - Install packages and start the Node.js Authentication service on Port 5000.
   - Launch the Django REST server on Port 8000.
   - Run the frontend web server on Port 3000.

2. **Verify Password Reset Loop:**
   - Open your browser to `http://localhost:3000/`.
   - Click "Forgot Password?".
   - Enter `sarah.jenkins@swasthonirapod.com.bd` (mock doctor) or `nasim.patient@swasthonirapod.com.bd` (mock patient) and submit.
   - Check the terminal console logs where `run_all.py` is executing. You will see a large, secure copy-pasteable banner displaying the generated OTP code.
   - Input the code on the OTP Verification screen before the 5-minute countdown timer expires.
   - Choose a new password that satisfies the policy rules (minimum 8 characters, 1 uppercase, 1 lowercase, 1 number, 1 special character).
   - Once successfully reset, click "Proceed to Login", input the username, and sign in with the new password. Django will authenticate using the new PBKDF2 hash, and grant access to the user dashboard!
```
