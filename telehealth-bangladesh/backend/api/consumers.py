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
        - 'chat_message': text message distribution.
        - 'webrtc_signaling': WebRTC handshake SDP exchanges.
        """
        action = content.get('action')
        sender = content.get('sender')
        
        if action == 'chat_message':
            message = content.get('message')
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'chat_message_handler',
                    'sender': sender,
                    'message': message
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
    async def chat_message_handler(self, event):
        await self.send_json({
            'action': 'chat_message',
            'sender': event['sender'],
            'message': event['message']
        })

    async def webrtc_signaling_handler(self, event):
        await self.send_json({
            'action': 'webrtc_signaling',
            'sender': event['sender'],
            'data': event['data']
        })
