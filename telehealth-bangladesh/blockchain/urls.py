from django.urls import path
from blockchain.views import (
    BlockchainLedgerView,
    BlockchainVerifyView,
    BlockchainTransactionDetailView,
    BlockchainNetworkStatusView
)

app_name = 'blockchain'

urlpatterns = [
    path('records/', BlockchainLedgerView.as_view(), name='blockchain_records'),
    path('verify-record/', BlockchainVerifyView.as_view(), name='blockchain_verify'),
    path('transaction/<str:tx_hash>/', BlockchainTransactionDetailView.as_view(), name='blockchain_tx_detail'),
    path('status/', BlockchainNetworkStatusView.as_view(), name='blockchain_status'),
]
