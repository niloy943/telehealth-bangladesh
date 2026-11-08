"""
HealNSight API Views Gateway
Consolidated domain view gateway preserving 100% backward-compatibility for existing URL routes and imports.
Decomposed into domain-driven modules:
  - views_common.py: Core helpers, audit logging, common models & serializers
  - views_auth.py: Authentication, MFA, Staff & Doctor KYC, Profiles, Passwords
  - views_appointment.py: Appointments & Scheduling
  - views_record.py: Encrypted health records & storage quotas
  - views_consent.py: Patient consent delegation & emergency settings
  - views_prescription.py: E-Prescriptions & medicine catalog
  - views_payment.py: SSLCommerz payments, callbacks & IPN
  - views_telephony.py: Twilio audio/video calls & consultation chat
  - views_verification.py: Gov NID/BMDC & blockchain verification
  - views_ai.py: AI Health Assistant conversations
"""
from api.views_common import *
from api.views_auth import *
from api.views_appointment import *
from api.views_record import *
from api.views_consent import *
from api.views_prescription import *
from api.views_payment import *
from api.views_telephony import *
from api.views_verification import *
from api.views_ai import *
