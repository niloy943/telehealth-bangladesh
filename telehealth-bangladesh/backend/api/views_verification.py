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

class GovNIDVerifyView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        nid = request.data.get('nid')
        dob = request.data.get('dob')
        res = gov_service.verify_nid(nid, dob)
        return Response(res)

class GovBMDCVerifyView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        bmdc = request.data.get('bmdc_reg')
        name = request.data.get('name', '')
        res = gov_service.verify_bmdc_license(bmdc, name)
        return Response(res)


class BlockchainLedgerView(generics.ListAPIView):
    queryset = BlockchainRecord.objects.all().order_by('-block_number')
    serializer_class = BlockchainRecordSerializer
    permission_classes = [IsAdminUserRole]

    def get_queryset(self):
        user = self.request.user
        if not (getattr(user, 'role', None) == 'admin' or user.is_staff or user.is_superuser):
            raise PermissionDenied("Admin access required to view blockchain ledger records.")
        return super().get_queryset()

    def get_serializer_context(self):
        context = super().get_serializer_context()
        # Attach network connection info
        context['blockchain_connected'] = blockchain_service.is_connected()
        context['contract_address'] = blockchain_service.contract_address
        return context

class BlockchainVerifyView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        record_type = request.data.get('record_type')
        record_id = request.data.get('record_id')
        simulate_tampering = request.data.get('simulate_tampering', False)

        if record_type == 'prescription':
            try:
                rx = Prescription.objects.get(id=record_id)
                if simulate_tampering:
                    payload = {"doctor": rx.doctor.username, "patient": rx.patient.username, "diagnosis": "TAMPERED: Patient injected insulin 500U"}
                else:
                    payload = {"doctor": rx.doctor.username, "patient": rx.patient.username, "diagnosis": rx.diagnosis}
            except Prescription.DoesNotExist:
                return Response({"error": "Prescription record not found."}, status=status.HTTP_404_NOT_FOUND)
        else:
            try:
                hr = HealthRecord.objects.get(id=record_id)
                if simulate_tampering:
                    payload = {"patient_id": hr.patient_id, "type": "TAMPERED: HIV positive report"}
                else:
                    payload = {"patient_id": hr.patient_id, "type": hr.record_type}
            except HealthRecord.DoesNotExist:
                return Response({"error": "Health record not found."}, status=status.HTTP_404_NOT_FOUND)

        res = blockchain_service.verify_record_integrity(record_type, int(record_id), payload)
        return Response(res)

class BlockchainTransactionDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, tx_hash):
        if not blockchain_service.is_connected():
            return Response({
                "tx_hash": tx_hash,
                "status": "Sepolia Sim Mode",
                "receipt": {
                    "status": 1,
                    "blockNumber": 987654,
                    "gasUsed": 21000
                }
            })
        try:
            receipt = blockchain_service.w3.eth.get_transaction_receipt(tx_hash)
            return Response({
                "tx_hash": tx_hash,
                "status": "CONFIRMED" if receipt['status'] == 1 else "FAILED",
                "receipt": {
                    "status": receipt['status'],
                    "blockNumber": receipt['blockNumber'],
                    "gasUsed": receipt['gasUsed'],
                    "from": receipt['from'],
                    "to": receipt['to']
                }
            })
        except Exception as e:
            return Response({"error": f"Transaction receipt not found or pending: {str(e)}"}, status=status.HTTP_404_NOT_FOUND)


