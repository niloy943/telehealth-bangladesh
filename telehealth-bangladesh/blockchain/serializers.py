from rest_framework import serializers
from api.models import BlockchainRecord


class BlockchainRecordSerializer(serializers.ModelSerializer):
    """
    Serializer for public & administrative view of immutable blockchain ledger entries.
    """
    class Meta:
        model = BlockchainRecord
        fields = [
            'id',
            'record_type',
            'record_id',
            'data_hash',
            'prev_hash',
            'block_number',
            'timestamp',
            'blockchain_network',
            'contract_address',
            'transaction_hash',
            'blockchain_block',
            'blockchain_record_id',
            'blockchain_status',
            'anchored_at'
        ]
        read_only_fields = fields


class BlockchainVerifyRequestSerializer(serializers.Serializer):
    """
    Validates payload for cryptographic on-chain integrity check.
    """
    record_type = serializers.ChoiceField(choices=['prescription', 'health_record', 'consent'])
    record_id = serializers.IntegerField(min_value=1)
    simulate_tampering = serializers.BooleanField(required=False, default=False)


class BlockchainStatusSerializer(serializers.Serializer):
    """
    Returns live Ethereum Sepolia node connection status and diagnostics.
    """
    connected = serializers.BooleanField()
    network_name = serializers.CharField()
    rpc_url_configured = serializers.BooleanField()
    contract_address = serializers.CharField()
    account_configured = serializers.BooleanField()
    account_address = serializers.CharField(allow_null=True)
    latest_block = serializers.IntegerField(allow_null=True)
    gas_price_gwei = serializers.FloatField(allow_null=True)
