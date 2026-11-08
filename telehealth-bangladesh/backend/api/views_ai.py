from api.views_common import (
    User, write_audit_log, generate_anonymous_session_id,
    random, uuid, hashlib, json, secrets, datetime, Decimal, timezone,
    status, permissions, generics, throttling, APIView, Response,
    PermissionDenied, ValidationError, authenticate, Q, RefreshToken,
    TokenObtainPairView, HttpResponse, HttpResponseForbidden, redirect,
    DoctorProfile, PatientProfile, Appointment, Consultation, Prescription,
    HealthRecord, Consent, AuditLog, Medicine, MedicineOrder, PatientImageProfile,
    OTPCode, LoginAttempt, PaymentTransaction, BlockchainRecord, TelephonyCall,
    AIConversation, AIMessage, ConsentRequest, PatientConsent, ConsentPermission,
    ConsentHistory, RecordAccessLog, EmergencyAccessSetting, EmergencyAccessLog,
    UserRegistrationSerializer, UserSerializer, DoctorProfileSerializer,
    AppointmentSerializer, ConsultationSerializer, PrescriptionSerializer,
    HealthRecordSerializer, ConsentSerializer, AuditLogSerializer,
    MedicineSerializer, MedicineOrderSerializer, ForgotPasswordSerializer,
    ResetPasswordSerializer, PatientImageProfileSerializer,
    PaymentTransactionSerializer, BlockchainRecordSerializer,
    TelephonyCallSerializer, AIHealthAssistantRequestSerializer,
    AIConversationSerializer, AIMessageSerializer, CustomTokenObtainPairSerializer,
    IsAdminUserRole, IsDoctorRole, IsPatientRole,
    twilio_service, gov_service, payment_service, storage_service,
    blockchain_service, ai_health_assistant_service
)

class AIHealthAssistantRateThrottle(throttling.UserRateThrottle):
    """Protects OpenAI endpoint from abuse with 30 queries per minute per authenticated user."""
    rate = '30/minute'
    scope = 'ai_assistant'


class AIHealthAssistantView(APIView):
    """
    Authenticated endpoint for the AI Health Assistant.
    Securely communicates with the backend AI service (OpenAI SDK).
    The API key remains strictly server-side and is NEVER exposed to the frontend.
    """
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [AIHealthAssistantRateThrottle]

    def post(self, request):
        serializer = AIHealthAssistantRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        message = serializer.validated_data['message']
        conversation_id = serializer.validated_data.get('conversation_id') or None

        # Execute AI service processing
        result = ai_health_assistant_service.process_message(
            user=request.user,
            message=message,
            conversation_id=conversation_id
        )

        if result.get("status_code", 200) != 200:
            return Response(
                {"error": result.get("error", "Failed to process message.")},
                status=result.get("status_code", status.HTTP_500_INTERNAL_SERVER_ERROR)
            )

        # Audit logging (metadata only; never log private medical text into audit logs)
        write_audit_log(
            user=request.user,
            action="AI_HEALTH_ASSISTANT_QUERY",
            details=f"AI query processed. Conversation: {result.get('conversation_id')}, Safety: {result.get('safety_level')}, Provider: {result.get('provider')}",
            request=request
        )

        return Response({
            "response": result["response"],
            "conversation_id": result["conversation_id"],
            "safety_level": result["safety_level"],
            "created_at": result["created_at"]
        }, status=status.HTTP_200_OK)


class AIConversationListView(APIView):
    """
    Retrieves past AI conversation threads for the authenticated user only.
    Prevents cross-patient data access.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        conversations = AIConversation.objects.filter(user=request.user).order_by('-updated_at')
        serializer = AIConversationSerializer(conversations, many=True)
        return Response(serializer.data)


class AIConversationDetailView(APIView):
    """
    Retrieves or deletes a specific conversation and its message history.
    Strictly verifies ownership: one user can never inspect another's conversation.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, conversation_id):
        try:
            conversation = AIConversation.objects.get(
                conversation_id=conversation_id,
                user=request.user
            )
        except AIConversation.DoesNotExist:
            return Response(
                {"error": "Conversation not found or access denied."},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = AIConversationSerializer(conversation)
        return Response(serializer.data)

    def delete(self, request, conversation_id):
        try:
            conversation = AIConversation.objects.get(
                conversation_id=conversation_id,
                user=request.user
            )
            conversation.delete()
            return Response({"message": "Conversation deleted successfully."}, status=status.HTTP_200_OK)
        except AIConversation.DoesNotExist:
            return Response(
                {"error": "Conversation not found or access denied."},
                status=status.HTTP_404_NOT_FOUND
            )

