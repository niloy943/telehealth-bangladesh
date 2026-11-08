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

class PaymentInitiateView(APIView):
    """
    POST /api/payment/initiate/
    Initiates an authoritative payment transaction for an Appointment or MedicineOrder.
    Calculates the exact amount server-side (never trusts client amount values).
    Dispatches to SSLCommerz V4 API and returns the official gateway hosted checkout URL.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        appointment_id = request.data.get('appointment_id')
        order_id = request.data.get('order_id')
        payment_method = request.data.get('method') or request.data.get('payment_method') or 'sslcommerz'

        if not appointment_id and not order_id:
            return Response(
                {"error": "Either appointment_id or order_id must be provided to initiate payment."},
                status=status.HTTP_400_BAD_REQUEST
            )

        appointment = None
        order = None
        authoritative_amount = Decimal("0.00")
        service_type = "consultation"
        reference_id = None

        if appointment_id:
            try:
                appointment = Appointment.objects.select_related('doctor', 'doctor__doctor_profile').get(
                    id=appointment_id, patient=user
                )
            except Appointment.DoesNotExist:
                return Response({"error": "Appointment not found or unauthorized."}, status=status.HTTP_404_NOT_FOUND)

            # Prevent duplicate payment for already paid appointments
            if appointment.payment_status == 'paid':
                return Response(
                    {"error": "This appointment has already been paid and confirmed."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Authoritative doctor consultation fee
            doc_prof = getattr(appointment.doctor, 'doctor_profile', None)
            authoritative_amount = doc_prof.fees if (doc_prof and doc_prof.fees) else Decimal("500.00")
            service_type = "consultation"
            reference_id = str(appointment.id)

        elif order_id:
            try:
                order = MedicineOrder.objects.get(id=order_id, patient=user)
            except MedicineOrder.DoesNotExist:
                return Response({"error": "Medicine order not found or unauthorized."}, status=status.HTTP_404_NOT_FOUND)

            if order.status in ('confirmed', 'shipping', 'delivered'):
                return Response(
                    {"error": "This order has already been paid and confirmed."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            authoritative_amount = Decimal(str(order.total_price))
            service_type = "pharmacy"
            reference_id = str(order.id)

        # Generate unique transaction reference
        txn_ref = payment_service.generate_transaction_ref(prefix="SSL")

        # Pre-create transaction in database with pending status
        txn = PaymentTransaction.objects.create(
            user=user,
            appointment=appointment,
            order=order,
            transaction_ref=txn_ref,
            payment_method=payment_method,
            gateway='sslcommerz',
            amount=authoritative_amount,
            currency='BDT',
            status='pending'
        )

        if appointment:
            appointment.payment_status = 'pending'
            appointment.save()

        # Customer information payload
        customer_info = {
            "name": f"{user.first_name} {user.last_name}".strip() or user.username,
            "email": user.email or f"{user.username}@healnsight.com.bd",
            "phone": user.phone or "+8801700000000",
            "address": getattr(user, 'patient_profile', None).address if hasattr(user, 'patient_profile') and user.patient_profile.address else "Dhaka, Bangladesh"
        }

        # Dispatch initiation to SSLCommerz service
        gateway_res = payment_service.initiate_transaction(
            amount=float(authoritative_amount),
            transaction_ref=txn_ref,
            customer_info=customer_info,
            service_type=service_type,
            reference_id=reference_id
        )

        if not gateway_res.get("success"):
            txn.status = 'failed'
            txn.failure_reason = gateway_res.get("error", "Gateway initiation rejected.")
            txn.save()
            return Response({"success": False, "error": txn.failure_reason}, status=status.HTTP_400_BAD_REQUEST)

        write_audit_log(
            user,
            "PAYMENT_INITIATED",
            f"Payment initiated for {service_type.upper()} #{reference_id}. Txn Ref: {txn_ref} ({authoritative_amount} BDT)",
            request
        )

        return Response({
            "success": True,
            "mode": gateway_res.get("mode", "sandbox"),
            "transaction_ref": txn_ref,
            "amount": float(authoritative_amount),
            "currency": "BDT",
            "gateway_url": gateway_res.get("gateway_url"),
            "session_key": gateway_res.get("session_key"),
            "is_simulated": gateway_res.get("is_simulated", False),
            "message": gateway_res.get("message", "Payment session generated.")
        })


class PaymentCallbackView(APIView):
    """
    POST/GET /api/payment/callback/
    Receives user browser redirects and POST callbacks from SSLCommerz.
    Executes authoritative server-side Order Validation API check.
    Guarantees idempotency and redirects user back to frontend with verified state.
    """
    permission_classes = [permissions.AllowAny]

    def _process_callback(self, request):
        data = request.data if request.data else request.POST
        tran_id = (
            data.get('tran_id') or 
            request.query_params.get('tran_id') or 
            data.get('transaction_ref') or
            request.query_params.get('transaction_ref')
        )
        val_id = data.get('val_id') or request.query_params.get('val_id')
        callback_status = (
            request.query_params.get('status') or 
            data.get('status', '')
        ).lower()

        frontend_base = payment_service.frontend_base_url

        if not tran_id:
            redirect_url = f"{frontend_base}/?payment_status=failed&error=missing_transaction_ref"
            if request.accepted_renderer.format == 'json' or request.headers.get('Accept') == 'application/json':
                return Response({"error": "Missing transaction reference in callback."}, status=status.HTTP_400_BAD_REQUEST)
            return redirect(redirect_url)

        try:
            txn = PaymentTransaction.objects.select_related('appointment', 'order', 'user').get(transaction_ref=tran_id)
        except PaymentTransaction.DoesNotExist:
            redirect_url = f"{frontend_base}/?payment_status=failed&error=transaction_not_found&txn_ref={tran_id}"
            if request.accepted_renderer.format == 'json' or request.headers.get('Accept') == 'application/json':
                return Response({"error": f"Transaction '{tran_id}' not found."}, status=status.HTTP_404_NOT_FOUND)
            return redirect(redirect_url)

        # 1. User Cancelled Payment
        if callback_status in ('cancel', 'cancelled'):
            if txn.status not in ('completed', 'cancelled'):
                txn.status = 'cancelled'
                txn.failure_reason = 'Payment was cancelled by the customer on the gateway.'
                txn.save()
                write_audit_log(txn.user, "PAYMENT_CANCELLED", f"Txn {tran_id} cancelled by user.", request)
            
            redirect_url = f"{frontend_base}/?payment_status=cancelled&txn_ref={tran_id}"
            if request.accepted_renderer.format == 'json' or request.headers.get('Accept') == 'application/json':
                return Response({"status": "cancelled", "transaction_ref": tran_id})
            return redirect(redirect_url)

        # 2. Gateway Reported Failure
        if callback_status in ('fail', 'failed'):
            if txn.status not in ('completed', 'failed'):
                txn.status = 'failed'
                txn.failure_reason = data.get('error') or data.get('failedreason') or 'Gateway reported transaction failure.'
                txn.save()
                write_audit_log(txn.user, "PAYMENT_FAILED", f"Txn {tran_id} failed: {txn.failure_reason}", request)

            redirect_url = f"{frontend_base}/?payment_status=failed&txn_ref={tran_id}"
            if request.accepted_renderer.format == 'json' or request.headers.get('Accept') == 'application/json':
                return Response({"status": "failed", "transaction_ref": tran_id})
            return redirect(redirect_url)

        # 3. Gateway Reported Success - Must Validate Server-to-Server!
        # Idempotency check: If already marked completed, do not duplicate actions
        if txn.status == 'completed':
            redirect_url = f"{frontend_base}/?payment_status=success&txn_ref={tran_id}"
            if request.accepted_renderer.format == 'json' or request.headers.get('Accept') == 'application/json':
                return Response({"status": "completed", "transaction_ref": tran_id, "idempotent": True})
            return redirect(redirect_url)

        if not val_id:
            val_id = data.get('val_id')

        # Execute Order Validation API check
        val_res = payment_service.validate_transaction(
            val_id=val_id,
            expected_txn_ref=txn.transaction_ref,
            expected_amount=float(txn.amount)
        )

        if val_res.get("is_valid"):
            txn.status = 'completed'
            txn.val_id = val_res.get("val_id") or val_id
            txn.bank_tran_id = val_res.get("bank_tran_id")
            txn.card_type = val_res.get("card_type")
            txn.card_brand = val_res.get("card_brand")
            txn.gateway_response = val_res.get("gateway_response", {})
            txn.failure_reason = None
            txn.save()

            # Update linked Appointment
            if txn.appointment:
                txn.appointment.payment_status = 'paid'
                txn.appointment.status = 'approved'
                txn.appointment.save()

            # Update linked MedicineOrder
            if txn.order:
                txn.order.status = 'confirmed'
                txn.order.save()

            write_audit_log(
                txn.user,
                "PAYMENT_SUCCESS",
                f"Payment verified for Txn {tran_id}. Amount: {txn.amount} BDT. Val ID: {txn.val_id}",
                request
            )

            redirect_url = f"{frontend_base}/?payment_status=success&txn_ref={tran_id}"
            if request.accepted_renderer.format == 'json' or request.headers.get('Accept') == 'application/json':
                return Response({"status": "completed", "transaction_ref": tran_id, "verified": True})
            return redirect(redirect_url)
        else:
            txn.status = 'failed'
            txn.failure_reason = val_res.get("message", "Server-side order validation failed.")
            txn.save()

            write_audit_log(
                txn.user,
                "PAYMENT_FAILED",
                f"Validation failed for Txn {tran_id}: {txn.failure_reason}",
                request
            )

            redirect_url = f"{frontend_base}/?payment_status=failed&txn_ref={tran_id}&reason=validation_failed"
            if request.accepted_renderer.format == 'json' or request.headers.get('Accept') == 'application/json':
                return Response({"status": "failed", "transaction_ref": tran_id, "error": txn.failure_reason}, status=status.HTTP_400_BAD_REQUEST)
            return redirect(redirect_url)

    def post(self, request):
        return self._process_callback(request)

    def get(self, request):
        return self._process_callback(request)


class PaymentIPNView(APIView):
    """
    POST /api/payment/ipn/
    Official SSLCommerz Instant Payment Notification (IPN) server-to-server webhook.
    Validates transaction asynchronously and idempotently updates database state.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        data = request.data if request.data else request.POST
        tran_id = data.get('tran_id') or request.query_params.get('tran_id')
        val_id = data.get('val_id') or request.query_params.get('val_id')

        if not tran_id or not val_id:
            return Response({"error": "IPN requires tran_id and val_id."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            txn = PaymentTransaction.objects.select_related('appointment', 'order', 'user').get(transaction_ref=tran_id)
        except PaymentTransaction.DoesNotExist:
            return Response({"error": f"Transaction '{tran_id}' not found."}, status=status.HTTP_404_NOT_FOUND)

        # Idempotency check: if already completed, acknowledge IPN without duplicating actions
        if txn.status == 'completed':
            return Response({"status": "IPN_ACKNOWLEDGED", "message": "Transaction is already completed."})

        # Validate with SSLCommerz Order Validation API
        val_res = payment_service.validate_transaction(
            val_id=val_id,
            expected_txn_ref=txn.transaction_ref,
            expected_amount=float(txn.amount)
        )

        if val_res.get("is_valid"):
            txn.status = 'completed'
            txn.val_id = val_res.get("val_id") or val_id
            txn.bank_tran_id = val_res.get("bank_tran_id")
            txn.card_type = val_res.get("card_type")
            txn.card_brand = val_res.get("card_brand")
            txn.gateway_response = val_res.get("gateway_response", {})
            txn.save()

            if txn.appointment:
                txn.appointment.payment_status = 'paid'
                txn.appointment.status = 'approved'
                txn.appointment.save()

            if txn.order:
                txn.order.status = 'confirmed'
                txn.order.save()

            write_audit_log(txn.user, "PAYMENT_IPN_PROCESSED", f"IPN validated Txn {tran_id}", request)
            return Response({"status": "IPN_SUCCESS", "transaction_ref": tran_id})
        else:
            txn.status = 'failed'
            txn.failure_reason = val_res.get("message", "IPN validation failed.")
            txn.save()
            write_audit_log(txn.user, "PAYMENT_IPN_FAILED", f"IPN failed for Txn {tran_id}", request)
            return Response({"status": "IPN_FAILED", "error": txn.failure_reason}, status=status.HTTP_400_BAD_REQUEST)


class PaymentStatusView(APIView):
    """
    GET /api/payment/status/<str:transaction_ref>/
    Returns verified payment transaction state.
    Enforces authorization: only the transaction owner or an administrator may view.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, transaction_ref):
        user = request.user
        try:
            txn = PaymentTransaction.objects.select_related('appointment', 'order', 'user').get(transaction_ref=transaction_ref)
        except PaymentTransaction.DoesNotExist:
            return Response({"error": "Payment transaction not found."}, status=status.HTTP_404_NOT_FOUND)

        # Enforce strict user isolation
        if txn.user and txn.user != user and user.role != 'admin' and not user.is_staff:
            raise PermissionDenied("You do not have permission to inspect this payment transaction.")

        serializer = PaymentTransactionSerializer(txn)
        return Response(serializer.data)


class PaymentHistoryView(APIView):
    """
    GET /api/payment/history/
    Lists payment transactions for the authenticated user with optional status filter.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        status_filter = request.query_params.get('status', 'all').strip().lower()

        # Synchronize any legacy/existing transactions linked to confirmed or delivered orders
        PaymentTransaction.objects.filter(
            status='pending',
            order__status__in=['confirmed', 'packing', 'shipping', 'out_for_delivery', 'delivered']
        ).update(status='completed')

        PaymentTransaction.objects.filter(
            status__in=['pending', 'processing'],
            order__status='cancelled'
        ).update(status='cancelled')

        if user.role == 'admin':
            queryset = PaymentTransaction.objects.all()
        else:
            queryset = PaymentTransaction.objects.filter(user=user)

        if status_filter != 'all':
            queryset = queryset.filter(status=status_filter)

        queryset = queryset.order_by('-created_at')[:50]
        serializer = PaymentTransactionSerializer(queryset, many=True)
        return Response(serializer.data)

