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

from channels.testing import WebsocketCommunicator
from channels.routing import ProtocolTypeRouter, URLRouter
from django.urls import path
from api.consumers import TelehealthConsumer

class TestE2EEChatChannels(unittest.IsolatedAsyncioTestCase):
    """
    Test Suite: Verifies E2EE Django Channels message relaying and structural validation.
    """

    async def test_websocket_e2ee_handshake_and_ciphertext_relay(self):
        # Setup application router for testing
        application = ProtocolTypeRouter({
            "websocket": URLRouter([
                path("ws/consultation/<int:consultation_id>/", TelehealthConsumer.as_asgi()),
            ])
        })

        # 1. Connect two communicators to simulate Patient and Doctor in consultation 42
        patient_comm = WebsocketCommunicator(application, "ws/consultation/42/")
        doctor_comm = WebsocketCommunicator(application, "ws/consultation/42/")

        patient_connected, _ = await patient_comm.connect()
        doctor_connected, _ = await doctor_comm.connect()

        self.assertTrue(patient_connected)
        self.assertTrue(doctor_connected)

        # 2. Simulate Patient broadcasting ECDSA Identity Public Key
        patient_identity = {
            "action": "e2ee_key_exchange",
            "sender": "sadia",
            "key_type": "identity",
            "public_key": "M2M0dGVzdGlkZW50aXR5a2V5cGFpcg==",
            "signature": ""
        }
        await patient_comm.send_json_to(patient_identity)

        # Doctor receives the identity broadcast (since doctor didn't send it, it's patient's broadcast)
        doc_received = await doctor_comm.receive_json_from()
        self.assertEqual(doc_received["action"], "e2ee_key_exchange")
        self.assertEqual(doc_received["sender"], "sadia")

        # Patient receives their own identity broadcast first (self-broadcast)
        pat_received_self = await patient_comm.receive_json_from()
        self.assertEqual(pat_received_self["sender"], "sadia")

        # 3. Simulate Doctor replying with Identity Public Key
        doctor_identity = {
            "action": "e2ee_key_exchange",
            "sender": "sarah",
            "key_type": "identity",
            "public_key": "RG9jdG9yVGVzdElkZW50aXR5UHVibGljS2V5",
            "signature": ""
        }
        await doctor_comm.send_json_to(doctor_identity)

        # Patient receives the doctor's identity broadcast
        pat_received = await patient_comm.receive_json_from()
        self.assertEqual(pat_received["action"], "e2ee_key_exchange")
        self.assertEqual(pat_received["sender"], "sarah")
        self.assertEqual(pat_received["key_type"], "identity")

        # Doctor receives their own identity broadcast
        doc_received_self = await doctor_comm.receive_json_from()
        self.assertEqual(doc_received_self["sender"], "sarah")

        # 4. Simulate Patient sending ephemeral ECDH exchange key and signature
        patient_ephemeral = {
            "action": "e2ee_key_exchange",
            "sender": "sadia",
            "key_type": "ephemeral",
            "public_key": "UGF0aWVudEVwaGVtZXJhbEtleVBhdGg=",
            "signature": "c2lnbmF0dXJlX2Zvb2Jhcl9iYXo="
        }
        await patient_comm.send_json_to(patient_ephemeral)

        # Doctor receives ephemeral exchange
        doc_received_ep = await doctor_comm.receive_json_from()
        self.assertEqual(doc_received_ep["key_type"], "ephemeral")
        self.assertEqual(doc_received_ep["signature"], "c2lnbmF0dXJlX2Zvb2Jhcl9iYXo=")

        # Patient receives their own ephemeral broadcast
        pat_received_ep_self = await patient_comm.receive_json_from()
        self.assertEqual(pat_received_ep_self["sender"], "sadia")

        # 5. Simulate Patient sending ciphertext message (plain text must NOT be present!)
        encrypted_message = {
            "action": "encrypted_chat_message",
            "sender": "sadia",
            "ciphertext": "dGhpcyBpcyBhIHNlY3JldCBtZXNzYWdlIQ==",
            "iv": "MTIzNDU2Nzg5MDEy",
            "aad": '{"consultation_id":42,"sender":"sadia","message_id":"msg_99"}',
            "message_id": "msg_99",
            "timestamp": "2026-08-30T00:50:00Z"
        }
        await patient_comm.send_json_to(encrypted_message)

        # Doctor receives the encrypted payload
        msg_payload = await doctor_comm.receive_json_from()
        self.assertEqual(msg_payload["action"], "encrypted_chat_message")
        self.assertEqual(msg_payload["sender"], "sadia")
        self.assertEqual(msg_payload["ciphertext"], "dGhpcyBpcyBhIHNlY3JldCBtZXNzYWdlIQ==")
        self.assertEqual(msg_payload["iv"], "MTIzNDU2Nzg5MDEy")
        self.assertNotIn("message", msg_payload) # Verify plaintext "message" field is absent!

        # Patient receives their own encrypted chat message broadcast
        pat_received_msg_self = await patient_comm.receive_json_from()
        self.assertEqual(pat_received_msg_self["sender"], "sadia")

        # Clean up connections
        await patient_comm.disconnect()
        await doctor_comm.disconnect()

if __name__ == "__main__":
    unittest.main()
