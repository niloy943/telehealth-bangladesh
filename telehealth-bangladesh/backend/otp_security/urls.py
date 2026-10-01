from django.urls import path
from otp_security.views import OTPRequestView, OTPVerifyView

app_name = "otp_security"

urlpatterns = [
    path("request", OTPRequestView.as_view(), name="otp_request"),
    path("verify", OTPVerifyView.as_view(), name="otp_verify"),
]
