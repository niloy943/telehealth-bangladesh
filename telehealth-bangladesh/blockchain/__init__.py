"""
Telehealth Bangladesh - Blockchain Ledger Module
------------------------------------------------
Provides cryptographic SHA-256 Merkle chain anchoring and Ethereum Sepolia smart contract
integration for health records, prescriptions, and patient consent verification.
"""

from blockchain.service import BlockchainIntegrityService, blockchain_service

__all__ = [
    'BlockchainIntegrityService',
    'blockchain_service',
]
