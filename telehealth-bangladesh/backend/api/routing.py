from django.urls import re_path
from api import consumers

websocket_urlpatterns = [
    re_path(r'^ws/consultation/(?P<consultation_id>\d+)/$', consumers.TelehealthConsumer.as_asgi()),
]
