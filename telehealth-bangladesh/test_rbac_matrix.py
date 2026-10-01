import os
import sys
import json
import unittest

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

class TestExactRBACMatrix(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        # Ensure test accounts exist with deterministic passwords
        cls.patient, _ = User.objects.get_or_create(
            username="matrix_patient",
            defaults={"email": "matrix_patient@test.com", "role": "patient"}
        )
        cls.patient.role = "patient"
        cls.patient.set_password("PatientSecret123!")
        cls.patient.save()

        cls.doctor, _ = User.objects.get_or_create(
            username="matrix_doctor",
            defaults={"email": "matrix_doctor@test.com", "role": "doctor", "bmdc_reg": "BMDC-MATRIX-99"}
        )
        cls.doctor.role = "doctor"
        cls.doctor.set_password("DoctorSecret123!")
        cls.doctor.save()

        cls.admin, _ = User.objects.get_or_create(
            username="matrix_admin",
            defaults={"email": "matrix_admin@test.com", "role": "admin", "is_staff": True, "is_superuser": True}
        )
        cls.admin.role = "admin"
        cls.admin.is_staff = True
        cls.admin.is_superuser = True
        cls.admin.set_password("AdminSecret123!")
        cls.admin.save()

    def setUp(self):
        self.client = Client()

    def test_A_patient_credentials_patient_role_success(self):
        """TEST A: Patient credentials + Patient role -> SUCCESS -> Patient"""
        resp = self.client.post("/api/login/", data=json.dumps({
            "username": "matrix_patient",
            "password": "PatientSecret123!",
            "role": "patient"
        }), content_type="application/json")
        self.assertEqual(resp.status_code, 200, f"Expected 200, got {resp.status_code}")
        data = resp.json()
        self.assertIn("access", data)
        self.assertEqual(data.get("user", {}).get("role"), "patient")
        print("\n  [PASS] TEST A: Patient credentials + Patient role -> SUCCESS (role=patient)")

    def test_B_patient_credentials_doctor_role_fail(self):
        """TEST B: Patient credentials + Doctor role -> FAIL"""
        resp = self.client.post("/api/login/", data=json.dumps({
            "username": "matrix_patient",
            "password": "PatientSecret123!",
            "role": "doctor"
        }), content_type="application/json")
        self.assertIn(resp.status_code, [401, 403], f"Expected 401/403, got {resp.status_code}")
        data = resp.json()
        self.assertNotIn("access", data)
        print(f"  [PASS] TEST B: Patient credentials + Doctor role -> FAIL ({resp.status_code})")

    def test_C_patient_credentials_admin_role_fail(self):
        """TEST C: Patient credentials + Admin role -> FAIL"""
        resp = self.client.post("/api/login/", data=json.dumps({
            "username": "matrix_patient",
            "password": "PatientSecret123!",
            "role": "admin"
        }), content_type="application/json")
        self.assertIn(resp.status_code, [401, 403], f"Expected 401/403, got {resp.status_code}")
        data = resp.json()
        self.assertNotIn("access", data)
        print(f"  [PASS] TEST C: Patient credentials + Admin role -> FAIL ({resp.status_code}) - No JWT issued!")

    def test_D_doctor_credentials_doctor_role_success(self):
        """TEST D: Doctor credentials + Doctor role -> SUCCESS -> Doctor"""
        resp = self.client.post("/api/login/", data=json.dumps({
            "username": "matrix_doctor",
            "password": "DoctorSecret123!",
            "role": "doctor"
        }), content_type="application/json")
        self.assertEqual(resp.status_code, 200, f"Expected 200, got {resp.status_code}")
        data = resp.json()
        self.assertIn("access", data)
        self.assertEqual(data.get("user", {}).get("role"), "doctor")
        print(f"  [PASS] TEST D: Doctor credentials + Doctor role -> SUCCESS (role=doctor)")

    def test_E_doctor_credentials_patient_role_fail(self):
        """TEST E: Doctor credentials + Patient role -> FAIL"""
        resp = self.client.post("/api/login/", data=json.dumps({
            "username": "matrix_doctor",
            "password": "DoctorSecret123!",
            "role": "patient"
        }), content_type="application/json")
        self.assertIn(resp.status_code, [401, 403], f"Expected 401/403, got {resp.status_code}")
        data = resp.json()
        self.assertNotIn("access", data)
        print(f"  [PASS] TEST E: Doctor credentials + Patient role -> FAIL ({resp.status_code})")

    def test_F_doctor_credentials_admin_role_fail(self):
        """TEST F: Doctor credentials + Admin role -> FAIL"""
        resp = self.client.post("/api/login/", data=json.dumps({
            "username": "matrix_doctor",
            "password": "DoctorSecret123!",
            "role": "admin"
        }), content_type="application/json")
        self.assertIn(resp.status_code, [401, 403], f"Expected 401/403, got {resp.status_code}")
        data = resp.json()
        self.assertNotIn("access", data)
        print(f"  [PASS] TEST F: Doctor credentials + Admin role -> FAIL ({resp.status_code}) - No JWT issued!")

    def test_G_admin_credentials_admin_auth_success(self):
        """TEST G: Admin credentials + Admin authentication -> SUCCESS -> Admin"""
        # Testing with explicit role='admin'
        resp = self.client.post("/api/login/", data=json.dumps({
            "username": "matrix_admin",
            "password": "AdminSecret123!",
            "role": "admin"
        }), content_type="application/json")
        self.assertEqual(resp.status_code, 200, f"Expected 200, got {resp.status_code}")
        data = resp.json()
        self.assertIn("access", data)
        self.assertEqual(data.get("user", {}).get("role"), "admin")

        # Testing with standard unprompted admin auth
        resp_unprompted = self.client.post("/api/login/", data=json.dumps({
            "username": "matrix_admin",
            "password": "AdminSecret123!"
        }), content_type="application/json")
        self.assertEqual(resp_unprompted.status_code, 200)
        self.assertEqual(resp_unprompted.json().get("user", {}).get("role"), "admin")
        print(f"  [PASS] TEST G: Admin credentials + Admin auth -> SUCCESS (role=admin)")

    def test_H_patient_jwt_admin_api_blocked(self):
        """TEST H: Patient JWT -> Admin API -> 403 Forbidden"""
        patient_token = str(RefreshToken.for_user(self.patient).access_token)
        headers = {"HTTP_AUTHORIZATION": f"Bearer {patient_token}"}

        admin_endpoints = [
            "/api/admin/doctors/",
            "/api/audit-logs/",
            "/api/blockchain/records/"
        ]
        for ep in admin_endpoints:
            resp = self.client.get(ep, **headers)
            self.assertEqual(resp.status_code, 403, f"Expected 403 on {ep}, got {resp.status_code}")
        print(f"  [PASS] TEST H: Patient JWT calling Admin APIs -> 403 Forbidden on all admin endpoints.")

    def test_I_doctor_jwt_admin_api_blocked(self):
        """TEST I: Doctor JWT -> Admin API -> 403 Forbidden"""
        doctor_token = str(RefreshToken.for_user(self.doctor).access_token)
        headers = {"HTTP_AUTHORIZATION": f"Bearer {doctor_token}"}

        admin_endpoints = [
            "/api/admin/doctors/",
            "/api/audit-logs/",
            "/api/blockchain/records/"
        ]
        for ep in admin_endpoints:
            resp = self.client.get(ep, **headers)
            self.assertEqual(resp.status_code, 403, f"Expected 403 on {ep}, got {resp.status_code}")
        print(f"  [PASS] TEST I: Doctor JWT calling Admin APIs -> 403 Forbidden on all admin endpoints.")

    def test_J_admin_jwt_admin_api_success(self):
        """TEST J: Admin JWT -> Admin API -> SUCCESS (200 OK)"""
        admin_token = str(RefreshToken.for_user(self.admin).access_token)
        headers = {"HTTP_AUTHORIZATION": f"Bearer {admin_token}"}

        admin_endpoints = [
            "/api/admin/doctors/",
            "/api/audit-logs/",
            "/api/blockchain/records/"
        ]
        for ep in admin_endpoints:
            resp = self.client.get(ep, **headers)
            self.assertEqual(resp.status_code, 200, f"Expected 200 on {ep}, got {resp.status_code}")
        print(f"  [PASS] TEST J: Admin JWT calling Admin APIs -> SUCCESS (200 OK) on all admin endpoints.")

if __name__ == '__main__':
    unittest.main()
