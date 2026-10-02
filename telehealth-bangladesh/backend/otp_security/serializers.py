import re
from django.core.validators import EmailValidator
from rest_framework import serializers

PHONE_E164_REGEX = re.compile(r"^\+[1-9]\d{6,14}$")
PURPOSE_REGEX = re.compile(r"^[a-zA-Z0-9_\-]+$")
CODE_REGEX = re.compile(r"^\d{6}$")


class OTPRequestSerializer(serializers.Serializer):
    """
    Serializer validating and normalizing OTP request payloads.
    Enforces E.164 telephone standards or normalized RFC 5322 email syntax.
    """

    channel = serializers.ChoiceField(
        choices=["sms", "email"],
        required=True,
        help_text="Delivery channel ('sms' or 'email').",
    )
    identifier = serializers.CharField(
        max_length=255,
        required=True,
        help_text="E.164 phone number (e.g. +8801712345678) or email address.",
    )
    purpose = serializers.CharField(
        max_length=50,
        required=False,
        default="login",
        help_text="Intended use case (e.g. 'login', 'password_reset', 'payment').",
    )

    def validate_purpose(self, value: str) -> str:
        clean_purpose = value.strip().lower()
        if not PURPOSE_REGEX.match(clean_purpose):
            raise serializers.ValidationError(
                "Purpose must contain only alphanumeric characters, underscores, and hyphens."
            )
        return clean_purpose

    def validate(self, attrs: dict) -> dict:
        channel = attrs["channel"]
        raw_identifier = attrs["identifier"].strip()

        if channel == "sms":
            # Normalize E.164: remove whitespaces, hyphens, and parentheses
            normalized = re.sub(r"[\s\-\(\)]", "", raw_identifier)
            if not PHONE_E164_REGEX.match(normalized):
                raise serializers.ValidationError({
                    "identifier": "Phone number must follow international E.164 format (e.g., +8801712345678)."
                })
            attrs["identifier"] = normalized

        elif channel == "email":
            normalized = raw_identifier.lower()
            validator = EmailValidator(message="Enter a valid email address.")
            try:
                validator(normalized)
            except serializers.ValidationError:
                raise serializers.ValidationError({
                    "identifier": "Please enter a valid email address."
                })
            attrs["identifier"] = normalized

        return attrs


class OTPVerifySerializer(serializers.Serializer):
    """
    Serializer validating OTP verification submissions.
    """

    channel = serializers.ChoiceField(
        choices=["sms", "email"],
        required=True,
    )
    identifier = serializers.CharField(
        max_length=255,
        required=True,
    )
    code = serializers.CharField(
        max_length=6,
        min_length=6,
        required=True,
        help_text="6-digit zero-padded numeric code.",
    )
    purpose = serializers.CharField(
        max_length=50,
        required=False,
        default="login",
    )

    def validate_code(self, value: str) -> str:
        clean_code = value.strip()
        if not CODE_REGEX.match(clean_code):
            raise serializers.ValidationError("Verification code must be exactly 6 digits.")
        return clean_code

    def validate_purpose(self, value: str) -> str:
        clean_purpose = value.strip().lower()
        if not PURPOSE_REGEX.match(clean_purpose):
            raise serializers.ValidationError(
                "Purpose must contain only alphanumeric characters, underscores, and hyphens."
            )
        return clean_purpose

    def validate(self, attrs: dict) -> dict:
        channel = attrs["channel"]
        raw_identifier = attrs["identifier"].strip()

        if channel == "sms":
            normalized = re.sub(r"[\s\-\(\)]", "", raw_identifier)
            if not PHONE_E164_REGEX.match(normalized):
                raise serializers.ValidationError({
                    "identifier": "Phone number must follow international E.164 format (e.g., +8801712345678)."
                })
            attrs["identifier"] = normalized

        elif channel == "email":
            normalized = raw_identifier.lower()
            validator = EmailValidator(message="Enter a valid email address.")
            try:
                validator(normalized)
            except serializers.ValidationError:
                raise serializers.ValidationError({
                    "identifier": "Please enter a valid email address."
                })
            attrs["identifier"] = normalized

        return attrs
