from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied
from api.models import BlockchainRecord, Prescription, HealthRecord
from api.permissions import IsAdminUserRole
from blockchain.service import blockchain_service
from blockchain.serializers import (
    BlockchainRecordSerializer,
    BlockchainVerifyRequestSerializer,
    BlockchainStatusSerializer
)


class BlockchainLedgerView(generics.ListAPIView):
    """
    Returns paginated list of all cryptographic blocks anchored to the ledger.
    Restricted to verified administrators for health data audit compliance.
    """
    queryset = BlockchainRecord.objects.all().order_by('-block_number')
    serializer_class = BlockchainRecordSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if not (getattr(user, 'role', None) == 'admin' or user.is_staff or user.is_superuser):
            raise PermissionDenied("Administrative privileges required to inspect national blockchain audit ledger.")
        return super().get_queryset()

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['blockchain_connected'] = blockchain_service.is_connected()
        context['contract_address'] = blockchain_service.contract_address
        return context


class BlockchainVerifyView(APIView):
    """
    Verifies the cryptographic integrity of a prescription or health record against the on-chain hash.
    Detects any unauthorized modification or database tampering.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = BlockchainVerifyRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        record_type = serializer.validated_data['record_type']
        record_id = serializer.validated_data['record_id']
        simulate_tampering = serializer.validated_data.get('simulate_tampering', False)

        if record_type == 'prescription':
            try:
                rx = Prescription.objects.get(id=record_id)
                if simulate_tampering:
                    payload = {
                        "doctor": rx.doctor.username,
                        "patient": rx.patient.username,
                        "diagnosis": "TAMPERED: Injected Unauthorized Medication Dosage"
                    }
                else:
                    payload = {
                        "doctor": rx.doctor.username,
                        "patient": rx.patient.username,
                        "diagnosis": rx.diagnosis
                    }
            except Prescription.DoesNotExist:
                return Response({"error": "Prescription record not found."}, status=status.HTTP_404_NOT_FOUND)
        elif record_type == 'health_record':
            try:
                hr = HealthRecord.objects.get(id=record_id)
                if simulate_tampering:
                    payload = {"patient_id": hr.patient_id, "type": "TAMPERED: Modified Diagnostic Lab Result"}
                else:
                    payload = {"patient_id": hr.patient_id, "type": hr.record_type}
            except HealthRecord.DoesNotExist:
                return Response({"error": "Health record not found."}, status=status.HTTP_404_NOT_FOUND)
        else:
            payload = {"reference_id": record_id, "type": record_type}

        res = blockchain_service.verify_record_integrity(record_type, int(record_id), payload)
        return Response(res, status=status.HTTP_200_OK)


class BlockchainTransactionDetailView(APIView):
    """
    Retrieves full Ethereum on-chain transaction receipt and block confirmation metadata.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, tx_hash):
        if not blockchain_service.is_connected():
            return Response({
                "tx_hash": tx_hash,
                "status": "Sepolia Sim Mode",
                "receipt": {
                    "status": 1,
                    "blockNumber": 987654,
                    "gasUsed": 21000,
                    "network": "Ethereum Sepolia (Simulated)"
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
                    "to": receipt['to'],
                    "network": "Ethereum Sepolia Testnet"
                }
            })
        except Exception as e:
            return Response(
                {"error": f"Transaction receipt not found or pending: {str(e)}"},
                status=status.HTTP_404_NOT_FOUND
            )


class BlockchainNetworkStatusView(APIView):
    """
    Returns live connection metrics, gas prices, and contract address for Ethereum Sepolia.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        status_info = blockchain_service.get_network_status()
        return Response(status_info, status=status.HTTP_200_OK)
