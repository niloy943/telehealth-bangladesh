import os
import sys
import json
import unittest

# Set up Django environment
base_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.join(base_dir, "backend")
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "telehealth_project.settings")

import django
django.setup()

from django.contrib.auth import get_user_model
from django.test import Client
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()

class TestRoleBasedAccessControl(unittest.TestCase):
    def setUp(self):
        self.client = Client()

        # 1. Ensure Patient exists
        self.patient, _ = User.objects.get_or_create(
            username="test_patient_rbac",
            defaults={"email": "patient_rbac@test.com", "role": "patient"}
        )
        self.patient.role = "patient"
        self.patient.set_password("PatientPass123!")
        self.patient.save()

        # 2. Ensure Doctor exists
        self.doctor, _ = User.objects.get_or_create(
            username="test_doctor_rbac",
            defaults={"email": "doctor_rbac@test.com", "role": "doctor", "bmdc_reg": "BMDC-RBAC-123"}
        )
        self.doctor.role = "doctor"
        self.doctor.set_password("DoctorPass123!")
        self.doctor.save()

        # 3. Ensure Admin exists
        self.admin, _ = User.objects.get_or_create(
            username="test_admin_rbac",
            defaults={"email": "admin_rbac@test.com", "role": "admin", "is_staff": True, "is_superuser": True}
        )
        self.admin.role = "admin"
        self.admin.is_staff = True
        self.admin.is_superuser = True
        self.admin.set_password("AdminPass123!")
        self.admin.save()

        # JWT tokens
        self.patient_token = str(RefreshToken.for_user(self.patient).access_token)
        self.doctor_token = str(RefreshToken.for_user(self.doctor).access_token)
        self.admin_token = str(RefreshToken.for_user(self.admin).access_token)

        self.patient_headers = {"HTTP_AUTHORIZATION": f"Bearer {self.patient_token}"}
        self.doctor_headers = {"HTTP_AUTHORIZATION": f"Bearer {self.doctor_token}"}
        self.admin_headers = {"HTTP_AUTHORIZATION": f"Bearer {self.admin_token}"}

    def test_01_patient_login(self):
        """TEST 1: Patient login returns authoritative patient role"""
        resp = self.client.post("/api/login/", data=json.dumps({
            "username": "test_patient_rbac",
            "password": "PatientPass123!"
        }), content_type="application/json")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("access", data)
        self.assertEqual(data.get("user", {}).get("role"), "patient")
        print("  [PASS] TEST 1: Patient login authenticates and yields role=patient.")

    def test_02_patient_profile_enforces_patient_role(self):
        """TEST 2: Patient profile endpoint strictly returns patient role"""
        resp = self.client.get("/api/profile/", **self.patient_headers)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data.get("role"), "patient")
        print("  [PASS] TEST 2: Patient profile returns role=patient strictly.")

    def test_03_patient_calls_admin_api_blocked(self):
        """TEST 3: Patient calls admin API -> HTTP 403 Forbidden"""
        admin_endpoints = [
            "/api/audit-logs/",
            "/api/admin/doctors/",
            "/api/blockchain/records/"
        ]
        for ep in admin_endpoints:
            resp = self.client.get(ep, **self.patient_headers)
            self.assertEqual(resp.status_code, 403, f"Expected 403 for patient on {ep}, got {resp.status_code}")
        print("  [PASS] TEST 3: Patient calling admin endpoints (audit-logs, admin/doctors, blockchain/records) -> 403 Forbidden.")

    def test_04_doctor_login(self):
        """TEST 4: Doctor login returns authoritative doctor role"""
        resp = self.client.post("/api/login/", data=json.dumps({
            "username": "test_doctor_rbac",
            "password": "DoctorPass123!"
        }), content_type="application/json")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("access", data)
        self.assertEqual(data.get("user", {}).get("role"), "doctor")
        print("  [PASS] TEST 4: Doctor login authenticates and yields role=doctor.")

    def test_05_doctor_profile_enforces_doctor_role(self):
        """TEST 5: Doctor profile endpoint strictly returns doctor role"""
        resp = self.client.get("/api/profile/", **self.doctor_headers)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data.get("role"), "doctor")
        print("  [PASS] TEST 5: Doctor profile returns role=doctor strictly.")

    def test_06_doctor_calls_admin_api_blocked(self):
        """TEST 6: Doctor calls admin API -> HTTP 403 Forbidden"""
        admin_endpoints = [
            "/api/audit-logs/",
            "/api/admin/doctors/",
            "/api/blockchain/records/"
        ]
        for ep in admin_endpoints:
            resp = self.client.get(ep, **self.doctor_headers)
            self.assertEqual(resp.status_code, 403, f"Expected 403 for doctor on {ep}, got {resp.status_code}")
        print("  [PASS] TEST 6: Doctor calling admin endpoints -> 403 Forbidden.")

    def test_07_admin_login(self):
        """TEST 7: Admin login using legitimate admin credentials -> Admin role"""
        resp = self.client.post("/api/login/", data=json.dumps({
            "username": "test_admin_rbac",
            "password": "AdminPass123!"
        }), content_type="application/json")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("access", data)
        self.assertEqual(data.get("user", {}).get("role"), "admin")
        print("  [PASS] TEST 7: Legitimate admin credentials successfully authenticate with role=admin.")

    def test_08_admin_accesses_admin_apis_allowed(self):
        """TEST 8: Admin accesses admin APIs -> 200 OK allowed"""
        resp_logs = self.client.get("/api/audit-logs/", **self.admin_headers)
        self.assertEqual(resp_logs.status_code, 200)

        resp_docs = self.client.get("/api/admin/doctors/", **self.admin_headers)
        self.assertEqual(resp_docs.status_code, 200)

        resp_bc = self.client.get("/api/blockchain/records/", **self.admin_headers)
        self.assertEqual(resp_bc.status_code, 200)
        print("  [PASS] TEST 8: Admin successfully accesses all admin endpoints (audit-logs, admin/doctors, blockchain/records).")

    def test_09_public_login_page_admin_invisible(self):
        """TEST 9: Public login UI has Patient + Doctor visible, Admin invisible"""
        auth_jsx_path = os.path.join(base_dir, "frontend-src", "src", "components", "Auth.jsx")
        with open(auth_jsx_path, "r", encoding="utf-8") as f:
            content = f.read()

        # Check role selection grid
        self.assertIn("grid grid-cols-2", content)
        self.assertIn('setLoginRole("patient")', content)
        self.assertIn('setLoginRole("doctor")', content)
        self.assertNotIn('setLoginRole("admin")', content)
        print("  [PASS] TEST 9: Verified Auth.jsx UI contains 2-column Patient/Doctor selector; Admin role card is completely removed.")

    def test_10_registration_attempting_admin_rejected(self):
        """TEST 10: Normal registration request attempting role=admin -> rejected / admin account NOT created"""
        payload = {
            "username": "malicious_admin_candidate",
            "password": "Password123!",
            "email": "malicious@test.com",
            "role": "admin",
            "nid": "19901234567890123"
        }
        resp = self.client.post("/api/register/", data=json.dumps(payload), content_type="application/json")
        self.assertIn(resp.status_code, [400, 403])
        self.assertFalse(User.objects.filter(username="malicious_admin_candidate").exists())
        print("  [PASS] TEST 10: Registration attempting role=admin is rejected (403/400) and account NOT created.")

    def test_11_manipulating_profile_role_rejected(self):
        """TEST 11: Manipulating frontend role via profile update does not grant admin access"""
        payload = {"role": "admin", "is_staff": True, "is_superuser": True}
        resp = self.client.put("/api/profile/", data=json.dumps(payload), content_type="application/json", **self.patient_headers)
        self.assertEqual(resp.status_code, 200)
        self.patient.refresh_from_db()
        self.assertEqual(self.patient.role, "patient")
        self.assertFalse(self.patient.is_staff)
        self.assertFalse(self.patient.is_superuser)
        print("  [PASS] TEST 11: Attempting to escalate role via PUT /api/profile/ is stripped server-side; role remains 'patient'.")

    def test_12_frontend_route_guards_present(self):
        """TEST 12: Frontend App.jsx contains route guards blocking non-admins from /admin"""
        app_jsx_path = os.path.join(base_dir, "frontend-src", "src", "App.jsx")
        with open(app_jsx_path, "r", encoding="utf-8") as f:
            app_content = f.read()

        self.assertIn("path.startsWith('/admin') && user.role !== 'admin'", app_content)
        self.assertIn("user?.role !== 'admin' && (newTab === 'audit' || newTab === 'kyc')", app_content)
        print("  [PASS] TEST 12: Verified App.jsx contains URL route guards and tab guards redirecting unauthorized access to /admin.")

    def test_13_direct_api_request_with_patient_jwt_to_admin_endpoint(self):
        """TEST 13: Direct API request with patient JWT to admin endpoint returns 403 Forbidden"""
        resp = self.client.get("/api/admin/doctors/", **self.patient_headers)
        self.assertEqual(resp.status_code, 403)
        resp_post = self.client.post("/api/admin/doctors/1/action/", data=json.dumps({"action": "approve"}), content_type="application/json", **self.patient_headers)
        self.assertEqual(resp_post.status_code, 403)
        print("  [PASS] TEST 13: Direct API calls with patient JWT to /api/admin/doctors/ and action endpoint return 403 Forbidden.")

if __name__ == '__main__':
    unittest.main()
