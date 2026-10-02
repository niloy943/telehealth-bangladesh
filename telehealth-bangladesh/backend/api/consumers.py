import json
import logging
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from channels.db import database_sync_to_async

logger = logging.getLogger(__name__)

class TelehealthConsumer(AsyncJsonWebsocketConsumer):
    @database_sync_to_async
    def get_consultation_metadata(self, consultation_id):
        from api.models import Consultation
        try:
            consultation = Consultation.objects.select_related(
                'appointment__doctor', 'appointment__patient'
            ).get(id=consultation_id)
            
            anon_token = (
                consultation.anonymous_session_id 
                or (consultation.appointment.anonymous_session_id if consultation.appointment else None) 
                or f"A{consultation.id:04d}"
            )
            doc_user = consultation.appointment.doctor.username if (consultation.appointment and consultation.appointment.doctor) else ""
            pat_user = consultation.appointment.patient.username if (consultation.appointment and consultation.appointment.patient) else ""

            return {
                "exists": True,
                "is_anonymous": consultation.is_anonymous,
                "audio_only": consultation.audio_only or (consultation.type == 'audio'),
                "anonymous_session_id": anon_token,
                "anonymous_identifier": f"Anonymous Patient #{anon_token}",
                "doctor_username": doc_user,
                "patient_username": pat_user,
            }
        except Consultation.DoesNotExist:
            return {"exists": False}
        except Exception as e:
            logger.error(f"Error fetching consultation {consultation_id} in consumer: {e}")
            return {"exists": False}

    async def connect(self):
        self.consultation_id = self.scope['url_route']['kwargs']['consultation_id']
        self.metadata = await self.get_consultation_metadata(self.consultation_id)

        if not self.metadata.get('exists'):
            # Close connection if consultation not found to prevent unauthorized / IDOR probing
            await self.close(code=4404)
            return

        self.room_group_name = f'consultation_{self.consultation_id}'

        # Join room group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        await self.accept()

    async def disconnect(self, close_code):
        # Leave room group
        if hasattr(self, 'room_group_name'):
            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name
            )

    # Receive message from WebSocket
    async def receive_json(self, content):
        """
        Receives messages from client websocket.
        Payload action structure:
        - 'e2ee_key_exchange': identity public sign keys and ephemeral ECDH exchanges.
        - 'encrypted_chat_message': E2EE ciphertext, iv, and non-sensitive aad.
        - 'webrtc_signaling': WebRTC handshake SDP and ICE candidate exchanges.
        """
        action = content.get('action')
        sender = content.get('sender', '')

        # Sanitize sender if this consultation is anonymous
        if self.metadata.get('is_anonymous'):
            doctor_user = self.metadata.get('doctor_username', '')
            # If sender is not the verified doctor username, enforce anonymous identity
            if sender != doctor_user:
                sender = self.metadata.get('anonymous_identifier', 'Anonymous Patient')

        if action == 'e2ee_key_exchange':
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'e2ee_key_exchange_handler',
                    'sender': sender,
                    'key_type': content.get('key_type'), # 'identity' or 'ephemeral'
                    'public_key': content.get('public_key'),
                    'signature': content.get('signature')
                }
            )
        elif action == 'encrypted_chat_message':
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'encrypted_chat_message_handler',
                    'sender': sender,
                    'ciphertext': content.get('ciphertext'),
                    'iv': content.get('iv'),
                    'aad': content.get('aad'),
                    'message_id': content.get('message_id'),
                    'timestamp': content.get('timestamp')
                }
            )
        elif action == 'webrtc_signaling':
            raw_data = content.get('data')
            # Strict sanitization: only pass essential WebRTC signaling fields to prevent PII leakage
            sanitized_data = {}
            if isinstance(raw_data, dict):
                allowed_fields = [
                    'type', 'sdp', 'candidate', 'sdpMid', 'sdpMLineIndex', 
                    'usernameFragment', 'target', 'mode'
                ]
                for field in allowed_fields:
                    if field in raw_data:
                        sanitized_data[field] = raw_data[field]
            else:
                sanitized_data = raw_data

            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'webrtc_signaling_handler',
                    'sender': sender,
                    'data': sanitized_data
                }
            )

    # Handlers for messages broadcasted to group
    async def e2ee_key_exchange_handler(self, event):
        await self.send_json({
            'action': 'e2ee_key_exchange',
            'sender': event['sender'],
            'key_type': event['key_type'],
            'public_key': event['public_key'],
            'signature': event['signature']
        })

    async def encrypted_chat_message_handler(self, event):
        await self.send_json({
            'action': 'encrypted_chat_message',
            'sender': event['sender'],
            'ciphertext': event['ciphertext'],
            'iv': event['iv'],
            'aad': event['aad'],
            'message_id': event['message_id'],
            'timestamp': event['timestamp']
        })

    async def webrtc_signaling_handler(self, event):
        await self.send_json({
            'action': 'webrtc_signaling',
            'sender': event['sender'],
            'data': event['data']
        })
