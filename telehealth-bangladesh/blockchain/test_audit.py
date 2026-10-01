import os
import sys
import json
import unittest
import importlib.util

# Set up Django environment
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
backend_dir = os.path.join(base_dir, "backend")
blockchain_dir = os.path.join(base_dir, "blockchain")

for path_dir in [backend_dir, base_dir, blockchain_dir]:
    if path_dir not in sys.path:
        sys.path.insert(0, path_dir)

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "telehealth_project.settings")

import django
django.setup()

from django.contrib.auth import get_user_model
from django.test import Client
from api.models import BlockchainRecord, Prescription, HealthRecord
from blockchain.service import BlockchainIntegrityService, blockchain_service

User = get_user_model()


class TestBlockchainArchitectureAudit(unittest.TestCase):
    """
    Test Suite 1: Verifies Web3 / Smart Contract / Solidity artifacts.
    """

    def test_web3_dependencies_installed(self):
        """Verify web3 and eth_account packages are installed."""
        web3_spec = importlib.util.find_spec("web3")
        eth_account_spec = importlib.util.find_spec("eth_account")
        self.assertIsNotNone(web3_spec, "web3 should be installed.")
        self.assertIsNotNone(eth_account_spec, "eth_account should be installed.")
        print("  [AUDIT PASS] Web3 and eth_account libraries confirmed present.")

    def test_smart_contracts_solidity_files_present(self):
        """Verify Solidity contract file exists in blockchain/contracts/."""
        contract_path = os.path.join(blockchain_dir, "contracts", "HealNSightLedger.sol")
        abi_path = os.path.join(blockchain_dir, "contracts", "HealNSightLedgerABI.json")
        self.assertTrue(os.path.exists(contract_path), f"Solidity contract not found at {contract_path}")
        self.assertTrue(os.path.exists(abi_path), f"Contract ABI JSON not found at {abi_path}")
        print("  [AUDIT PASS] HealNSightLedger.sol and ABI confirmed in blockchain/contracts/.")

    def test_storage_is_relational_with_metadata(self):
        """Verify that BlockchainRecord table has necessary cryptographic columns."""
        from django.db import connection
        table_name = BlockchainRecord._meta.db_table
        with connection.cursor() as cursor:
            cursor.execute(f"PRAGMA table_info({table_name});")
            columns = [row[1] for row in cursor.fetchall()]

        expected_cols = [
            'id', 'record_type', 'record_id', 'data_hash', 'prev_hash',
            'block_number', 'timestamp', 'blockchain_network', 'blockchain_status'
        ]
        for col in expected_cols:
            self.assertIn(col, columns, f"Column {col} missing in {table_name}")
        print("  [AUDIT PASS] BlockchainRecord relational table structure verified.")


class TestLocalBlockchainService(unittest.TestCase):
    """
    Test Suite 2: Verifies SHA-256 hash chaining and tamper detection logic.
    """

    def setUp(self):
        self.service = BlockchainIntegrityService()

    def test_hash_calculation_deterministic(self):
        """Verify SHA-256 calculation produces deterministic 64-char hexadecimal hashes."""
        payload = {"patient_id": 42, "type": "Lipid Profile & Glucose"}
        prev_hash = "0000000000000000000000000000000000000000000000000000000000000000"

        hash_1 = self.service.calculate_hash("health_record", 42, payload, prev_hash)
        hash_2 = self.service.calculate_hash("health_record", 42, payload, prev_hash)

        self.assertEqual(hash_1, hash_2)
        self.assertEqual(len(hash_1), 64)
        print(f"  [LOGIC PASS] Hash calculation is deterministic SHA-256: {hash_1[:20]}...")

    def test_commit_and_verify_record_integrity(self):
        """Test committing a block and validating its cryptographic integrity."""
        test_payload = {"patient_id": 777, "type": "Cardiology Consultation Note"}
        block = self.service.commit_record("health_record", 77777, test_payload)

        self.assertIsNotNone(block.id)
        self.assertEqual(block.record_type, "health_record")
        self.assertEqual(block.record_id, 77777)
        self.assertEqual(len(block.data_hash), 64)

        res = self.service.verify_record_integrity("health_record", 77777, test_payload)
        self.assertTrue(res["verified"])
        self.assertEqual(res["status"], "VALID_IMMUTABLE")
        print(f"  [LOGIC PASS] Block #{block.block_number} verified as VALID_IMMUTABLE.")

    def test_tamper_detection(self):
        """Test that modifying record contents immediately flags TAMPERED_WARNING."""
        test_payload = {"doctor": "dr_rahman", "diagnosis": "Hypertension Stage 2"}
        block = self.service.commit_record("prescription", 66666, test_payload)

        # Alter payload
        tampered_payload = {"doctor": "dr_rahman", "diagnosis": "UNAUTHORIZED OVERRIDE: Low Blood Pressure"}
        res = self.service.verify_record_integrity("prescription", 66666, tampered_payload)

        self.assertFalse(res["verified"])
        self.assertEqual(res["status"], "TAMPERED_WARNING")
        self.assertIn("might be modified", res["message"])
        print("  [LOGIC PASS] Tamper detection triggered TAMPERED_WARNING alert.")

    def test_not_on_chain_status(self):
        """Test verification of a non-existent record."""
        res = self.service.verify_record_integrity("prescription", 99999999, {"test": "data"})
        self.assertFalse(res["verified"])
        self.assertEqual(res["status"], "NOT_ON_CHAIN")
        print("  [LOGIC PASS] Unanchored record correctly identified as NOT_ON_CHAIN.")


class TestBlockchainRESTEndpoints(unittest.TestCase):
    """
    Test Suite 3: Verifies DRF API endpoints for blockchain audit.
    """

    def setUp(self):
        self.client = Client()
        self.user, _ = User.objects.get_or_create(
            username="test_admin_auditor",
            defaults={"email": "auditor@telehealth.bd", "role": "admin"}
        )
        self.user.role = "admin"
        self.user.is_staff = True
        self.user.set_password("pass1234")
        self.user.save()

        from rest_framework_simplejwt.tokens import RefreshToken
        refresh = RefreshToken.for_user(self.user)
        self.token = str(refresh.access_token)
        self.auth_headers = {"HTTP_AUTHORIZATION": f"Bearer {self.token}"}

    def test_api_blockchain_records_list(self):
        """Verify GET /api/blockchain/records/ returns block ledger list."""
        response = self.client.get("/api/blockchain/records/", **self.auth_headers)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIsInstance(data, list)
        print(f"  [API PASS] GET /api/blockchain/records/ returned {len(data)} blocks.")

    def test_api_blockchain_verify_endpoint(self):
        """Verify POST /api/blockchain/verify-record/ validates prescription."""
        rx = Prescription.objects.first()
        if rx:
            blockchain_service.commit_record("prescription", rx.id, {
                "doctor": rx.doctor.username,
                "patient": rx.patient.username,
                "diagnosis": rx.diagnosis
            })

            payload = {"record_type": "prescription", "record_id": rx.id}
            response = self.client.post(
                "/api/blockchain/verify-record/",
                data=json.dumps(payload),
                content_type="application/json",
                **self.auth_headers
            )
            self.assertEqual(response.status_code, 200)
            res_data = response.json()
            self.assertIn("verified", res_data)
            print(f"  [API PASS] POST /api/blockchain/verify-record/ returned status: {res_data.get('status')}")


def run_all_tests():
    print("=" * 70)
    print("      BLOCKCHAIN STANDALONE PACKAGE - INTEGRITY & AUDIT SUITE        ")
    print("=" * 70)

    loader = unittest.TestLoader()
    suite = unittest.TestSuite()
    suite.addTests(loader.loadTestsFromTestCase(TestBlockchainArchitectureAudit))
    suite.addTests(loader.loadTestsFromTestCase(TestLocalBlockchainService))
    suite.addTests(loader.loadTestsFromTestCase(TestBlockchainRESTEndpoints))

    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)

    print("\n" + "=" * 70)
    print("                         AUDIT TEST RESULTS SUMMARY                   ")
    print("=" * 70)
    print(f" Total Tests Run  : {result.testsRun}")
    print(f" Failures         : {len(result.failures)}")
    print(f" Errors           : {len(result.errors)}")
    print(f" Status           : {'ALL TESTS PASSED' if result.wasSuccessful() else 'TESTS FAILED'}")
    print("=" * 70)

    return 0 if result.wasSuccessful() else 1


if __name__ == "__main__":
    sys.exit(run_all_tests())
