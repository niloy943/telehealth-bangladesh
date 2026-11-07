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

            from django.utils import timezone
            now = timezone.now()
            st = consultation.effective_start_time
            if not st and consultation.status == 'active':
                consultation.started_at = now
                consultation.start_time = now
                consultation.save(update_fields=['started_at', 'start_time'])
                st = now

            is_timeout = False
            remaining_seconds = 2700
            if st:
                elapsed = (now - st).total_seconds()
                if elapsed >= 2700:
                    is_timeout = True
                    remaining_seconds = 0
                    consultation.status = 'completed'
                    consultation.ended_at = now
                    consultation.duration = 2700
                    consultation.save(update_fields=['status', 'ended_at', 'duration'])
                    if consultation.appointment and consultation.appointment.status != 'completed':
                        consultation.appointment.status = 'completed'
                        consultation.appointment.save(update_fields=['status'])
                else:
                    remaining_seconds = max(0, int(2700 - elapsed))

            is_closed = is_timeout or consultation.status in ['ended', 'completed'] or (consultation.appointment and consultation.appointment.status == 'completed')
            return {
                "exists": True,
                "is_closed": is_closed,
                "is_timeout": is_timeout,
                "remaining_seconds": remaining_seconds,
                "started_at": st.isoformat() if st else None,
                "expires_at": consultation.expires_at.isoformat() if consultation.expires_at else None,
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

    @database_sync_to_async
    def authenticate_token(self, token_str):
        if not token_str:
            return None
        try:
            from rest_framework_simplejwt.tokens import AccessToken
            from django.contrib.auth import get_user_model
            token = AccessToken(token_str)
            user_id = token['user_id']
            User = get_user_model()
            return User.objects.get(id=user_id)
        except Exception as e:
            logger.warning(f"WebSocket auth token validation notice: {e}")
            return None

    async def connect(self):
        self.consultation_id = self.scope['url_route']['kwargs']['consultation_id']
        self.metadata = await self.get_consultation_metadata(self.consultation_id)

        # 1. Enforce Consultation Existence
        if not self.metadata.get('exists'):
            logger.warning(f"WebSocket rejected: Consultation {self.consultation_id} does not exist.")
            await self.close(code=4404)
            return

        # 2. Enforce Consultation Closure / 45-Minute Timeout
        if self.metadata.get('is_closed'):
            await self.accept()
            await self.send_json({
                'action': 'session_timeout',
                'reason': 'Consultation is permanently completed or 45-minute limit expired.'
            })
            await self.close(code=4403)
            return

        # 3. Authenticate WebSocket User via Query Token or Scope
        query_string = self.scope.get('query_string', b'').decode('utf-8')
        import urllib.parse
        params = urllib.parse.parse_qs(query_string)
        token_list = params.get('token', [])
        token_str = token_list[0] if token_list else None

        user = await self.authenticate_token(token_str)
        if not user and self.scope.get('user') and self.scope['user'].is_authenticated:
            user = self.scope['user']

        if not user or not user.is_authenticated:
            logger.warning(f"WebSocket rejected: Unauthenticated connection attempt to consultation {self.consultation_id}")
            await self.close(code=4401)
            return

        # 4. Enforce Participant Authorization (IDOR Prevention)
        doc_user = self.metadata.get('doctor_username')
        pat_user = self.metadata.get('patient_username')
        is_participant = (
            user.username == doc_user or 
            user.username == pat_user or 
            getattr(user, 'role', '') == 'admin' or 
            getattr(user, 'is_staff', False)
        )
        if not is_participant:
            logger.warning(f"WebSocket rejected: User '{user.username}' is not a participant in consultation {self.consultation_id}")
            await self.close(code=4403)
            return

        self.current_user = user
        self.room_group_name = f'consultation_{self.consultation_id}'

        # Join room group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        await self.accept()

        # Send authoritative session timer remaining from 45-minute limit
        await self.send_json({
            'action': 'session_timer',
            'remaining_seconds': self.metadata.get('remaining_seconds', 2700),
            'started_at': self.metadata.get('started_at'),
            'expires_at': self.metadata.get('expires_at')
        })

        # Send existing encrypted conversation history on connect / reconnect
        try:
            history = await self.get_chat_history(self.consultation_id)
            if history:
                await self.send_json({
                    'action': 'chat_history',
                    'messages': history
                })
        except Exception as err:
            logger.error(f"Error dispatching chat history on connect: {err}")

    async def disconnect(self, close_code):
        # Leave room group
        if hasattr(self, 'room_group_name'):
            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name
            )

    @database_sync_to_async
    def save_chat_message(self, consultation_id, sender, ciphertext, iv, aad, message_id, timestamp):
        from api.models import ConsultationChatMessage, Consultation
        try:
            consultation = Consultation.objects.get(id=consultation_id)
            msg, created = ConsultationChatMessage.objects.get_or_create(
                message_id=message_id,
                defaults={
                    'consultation': consultation,
                    'sender_username': sender,
                    'ciphertext': ciphertext,
                    'iv': iv,
                    'aad': aad if isinstance(aad, dict) else {},
                    'timestamp': timestamp or '',
                    'status': 'sent'
                }
            )
            return {
                'message_id': msg.message_id,
                'status': msg.status,
                'created': created
            }
        except Exception as e:
            logger.error(f"Error saving chat message {message_id}: {e}")
            return None

    @database_sync_to_async
    def update_message_status(self, consultation_id, message_id, new_status):
        from api.models import ConsultationChatMessage
        try:
            ConsultationChatMessage.objects.filter(
                consultation_id=consultation_id,
                message_id=message_id
            ).update(status=new_status)
        except Exception as e:
            logger.error(f"Error updating message status for {message_id}: {e}")

    @database_sync_to_async
    def get_chat_history(self, consultation_id):
        from api.models import ConsultationChatMessage
        try:
            msgs = ConsultationChatMessage.objects.filter(
                consultation_id=consultation_id
            ).order_by('created_at')
            return [
                {
                    'message_id': m.message_id,
                    'sender': m.sender_username,
                    'ciphertext': m.ciphertext,
                    'iv': m.iv,
                    'aad': m.aad,
                    'timestamp': m.timestamp,
                    'status': m.status,
                    'created_at': m.created_at.isoformat()
                }
                for m in msgs
            ]
        except Exception as e:
            logger.error(f"Error fetching chat history for {consultation_id}: {e}")
            return []

    # Receive message from WebSocket
    async def receive_json(self, content):
        """
        Receives messages from client websocket.
        Payload action structure:
        - 'e2ee_key_exchange': identity public sign keys and ephemeral ECDH exchanges.
        - 'encrypted_chat_message': E2EE ciphertext, iv, and non-sensitive aad.
        - 'webrtc_signaling': WebRTC handshake SDP and ICE candidate exchanges.
        - 'message_delivered': delivery receipt acknowledgment.
        - 'message_read': read receipt acknowledgment.
        - 'request_chat_history': explicit history sync request.
        """
        action = content.get('action')
        sender = content.get('sender', '')

        # Server-side 45-minute session timeout enforcement on incoming actions
        curr_meta = await self.get_consultation_metadata(self.consultation_id)
        if curr_meta.get('is_closed'):
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'session_timeout_handler',
                    'message': 'The 45-minute consultation time limit has been reached. The session is now permanently closed.'
                }
            )
            return

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
            ciphertext = content.get('ciphertext')
            iv = content.get('iv')
            aad = content.get('aad')
            message_id = content.get('message_id')
            timestamp = content.get('timestamp')

            # Persist message into consultation database
            await self.save_chat_message(
                self.consultation_id, sender, ciphertext, iv, aad, message_id, timestamp
            )

            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'encrypted_chat_message_handler',
                    'sender': sender,
                    'ciphertext': ciphertext,
                    'iv': iv,
                    'aad': aad,
                    'message_id': message_id,
                    'timestamp': timestamp,
                    'status': 'sent'
                }
            )
        elif action in ['message_delivered', 'message_read']:
            message_id = content.get('message_id')
            new_status = 'delivered' if action == 'message_delivered' else 'read'
            if message_id:
                await self.update_message_status(self.consultation_id, message_id, new_status)
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'chat_status_update_handler',
                        'sender': sender,
                        'message_id': message_id,
                        'status': new_status
                    }
                )
        elif action == 'request_chat_history':
            history = await self.get_chat_history(self.consultation_id)
            await self.send_json({
                'action': 'chat_history',
                'messages': history
            })
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
        elif action == 'records_shared':
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'records_shared_handler',
                    'sender': sender,
                    'consultation_id': self.consultation_id,
                    'count': content.get('count', 0)
                }
            )
        elif action == 'prescription_generated':
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'prescription_generated_handler',
                    'sender': sender,
                    'consultation_id': self.consultation_id,
                    'prescription_id': content.get('prescription_id')
                }
            )
        elif action == 'consultation_ended':
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'consultation_ended_handler',
                    'sender': sender,
                    'consultation_id': self.consultation_id,
                    'message': content.get('message', 'Consultation closed by doctor.')
                }
            )

    # Handlers for messages broadcasted to group
    async def records_shared_handler(self, event):
        await self.send_json({
            'action': 'records_shared',
            'sender': event['sender'],
            'consultation_id': event['consultation_id'],
            'count': event.get('count', 0)
        })

    async def prescription_generated_handler(self, event):
        await self.send_json({
            'action': 'prescription_generated',
            'sender': event['sender'],
            'consultation_id': event['consultation_id'],
            'prescription_id': event.get('prescription_id')
        })

    async def consultation_ended_handler(self, event):
        await self.send_json({
            'action': 'consultation_ended',
            'sender': event['sender'],
            'consultation_id': event['consultation_id'],
            'message': event.get('message', 'Consultation closed.')
        })

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
            'timestamp': event['timestamp'],
            'status': event.get('status', 'sent')
        })

    async def chat_status_update_handler(self, event):
        await self.send_json({
            'action': 'chat_status_update',
            'sender': event['sender'],
            'message_id': event['message_id'],
            'status': event['status']
        })

    async def webrtc_signaling_handler(self, event):
        await self.send_json({
            'action': 'webrtc_signaling',
            'sender': event['sender'],
            'data': event['data']
        })

    async def session_timeout_handler(self, event):
        await self.send_json({
            'action': 'session_timeout',
            'message': event.get('message', 'The 45-minute consultation time limit has been reached.')
        })
        await self.close(code=4403)
