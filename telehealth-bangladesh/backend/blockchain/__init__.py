"""
Backend Blockchain Integration Alias
-----------------------------------
Exposes the dedicated standalone blockchain services and views to the Django backend.
"""

from blockchain import BlockchainIntegrityService, blockchain_service
from blockchain.views import (
    BlockchainLedgerView,
    BlockchainVerifyView,
    BlockchainTransactionDetailView,
    BlockchainNetworkStatusView
)
from blockchain.serializers import (
    BlockchainRecordSerializer,
    BlockchainVerifyRequestSerializer,
    BlockchainStatusSerializer
)

__all__ = [
    'BlockchainIntegrityService',
    'blockchain_service',
    'BlockchainLedgerView',
    'BlockchainVerifyView',
    'BlockchainTransactionDetailView',
    'BlockchainNetworkStatusView',
    'BlockchainRecordSerializer',
    'BlockchainVerifyRequestSerializer',
    'BlockchainStatusSerializer'
]
