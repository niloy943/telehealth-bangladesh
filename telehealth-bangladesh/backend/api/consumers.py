import json
from channels.generic.websocket import AsyncJsonWebsocketConsumer

class TelehealthConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.consultation_id = self.scope['url_route']['kwargs']['consultation_id']
        self.room_group_name = f'consultation_{self.consultation_id}'

        # Join room group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        await self.accept()

    async def disconnect(self, close_code):
        # Leave room group
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
        - 'webrtc_signaling': WebRTC handshake SDP exchanges.
        """
        action = content.get('action')
        sender = content.get('sender')
        
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
            data = content.get('data')
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'webrtc_signaling_handler',
                    'sender': sender,
                    'data': data
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
