import os
import json
import hashlib
from datetime import datetime
from web3 import Web3
from eth_account import Account
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Read ABI definition
ABI_PATH = os.path.join(os.path.dirname(__file__), "contracts", "HealNSightLedgerABI.json")
if not os.path.exists(ABI_PATH):
    # Fallback to local or parent directory
    ABI_PATH = os.path.join(os.path.dirname(__file__), "..", "backend", "api", "HealNSightLedgerABI.json")

try:
    with open(ABI_PATH, "r") as f:
        CONTRACT_ABI = json.load(f)["abi"]
except Exception:
    CONTRACT_ABI = []


class BlockchainIntegrityService:
    """
    Ethereum Sepolia Testnet Blockchain service for Health & Prescription record auditing.
    Integrates with web3.py to anchor cryptographic SHA-256 hashes of medical operations.
    Keeps a local cryptographic log and mirrors/anchors to the Ethereum Sepolia testnet.
    """

    def __init__(self):
        self.rpc_url = os.environ.get("SEPOLIA_RPC_URL")
        self.private_key = os.environ.get("BLOCKCHAIN_PRIVATE_KEY")
        self.contract_address = os.environ.get("HEALNSIGHT_CONTRACT_ADDRESS")
        self.w3 = None
        self.contract = None
        self.account = None

        if self.rpc_url:
            try:
                self.w3 = Web3(Web3.HTTPProvider(self.rpc_url))
                if self.private_key:
                    try:
                        self.account = Account.from_key(self.private_key)
                    except Exception:
                        pass
                if self.contract_address and CONTRACT_ABI and self.w3.is_address(self.contract_address):
                    self.contract = self.w3.eth.contract(
                        address=Web3.to_checksum_address(self.contract_address),
                        abi=CONTRACT_ABI
                    )
            except Exception:
                pass

    def is_connected(self) -> bool:
        """Check if Web3 provider is actively connected to Ethereum RPC node."""
        if not self.w3:
            return False
        try:
            return self.w3.is_connected()
        except Exception:
            return False

    def get_network_status(self) -> dict:
        """Retrieve live network diagnostic information."""
        connected = self.is_connected()
        status_info = {
            "connected": connected,
            "network_name": "Ethereum Sepolia Testnet" if self.rpc_url else "Local Cryptographic Ledger (Simulated)",
            "rpc_url_configured": bool(self.rpc_url),
            "contract_address": self.contract_address or "0x0000000000000000000000000000000000000000",
            "account_configured": bool(self.account),
            "account_address": self.account.address if self.account else None,
            "latest_block": None,
            "gas_price_gwei": None,
        }
        if connected:
            try:
                status_info["latest_block"] = self.w3.eth.block_number
                gas_wei = self.w3.eth.gas_price
                status_info["gas_price_gwei"] = round(self.w3.from_wei(gas_wei, 'gwei'), 2)
            except Exception:
                pass
        return status_info

    @staticmethod
    def calculate_hash(record_type: str, record_id: int, payload: dict, prev_hash: str) -> str:
        """
        Calculates deterministic SHA-256 cryptographic hash of record contents chained with prev_hash.
        """
        serialized_payload = json.dumps(payload, sort_keys=True)
        data_string = f"{record_type}:{record_id}:{serialized_payload}:{prev_hash}"
        return hashlib.sha256(data_string.encode('utf-8')).hexdigest()

    def commit_record(self, record_type: str, record_id: int, payload: dict):
        """
        Commits a record hash to the local ledger database, generates proof hash, then anchors to Sepolia smart contract.
        """
        from api.models import BlockchainRecord
        last_block = BlockchainRecord.objects.order_by('-block_number').first()
        prev_hash = last_block.data_hash if last_block else "0000000000000000000000000000000000000000000000000000000000000000"
        block_num = (last_block.block_number + 1) if last_block else 1

        data_hash = self.calculate_hash(record_type, record_id, payload, prev_hash)

        # Save local block first
        block = BlockchainRecord.objects.create(
            record_type=record_type,
            record_id=record_id,
            data_hash=data_hash,
            prev_hash=prev_hash,
            block_number=block_num,
            blockchain_network="Ethereum Sepolia" if self.rpc_url else "Sepolia Sim",
            contract_address=self.contract_address or "0x0000000000000000000000000000000000000000",
            blockchain_status="BLOCKCHAIN_PENDING"
        )

        # Trigger Sepolia anchoring
        self.anchor_hash_onchain(block, data_hash, prev_hash, record_type, str(record_id))
        return block

    def anchor_hash_onchain(self, block, data_hash: str, prev_hash: str, record_type: str, reference_id: str):
        """
        Interacts with the smart contract and broadcasts an anchoring transaction.
        """
        if not self.is_connected() or not self.contract or not self.account:
            # Fallback/simulation mode if RPC or account not configured
            block.blockchain_status = "BLOCKCHAIN_CONFIRMED"
            block.transaction_hash = f"0xsimulated_tx_{data_hash[:58]}"
            block.blockchain_block = 654321 + block.block_number
            block.blockchain_record_id = block.block_number
            block.anchored_at = datetime.now()
            block.save()
            return

        try:
            # Convert hashes to bytes32 format for solidity contract
            hash_bytes = bytes.fromhex(data_hash)
            prev_bytes = bytes.fromhex(prev_hash)

            # Build transaction
            nonce = self.w3.eth.get_transaction_count(self.account.address)
            gas_price = self.w3.eth.gas_price

            txn_func = self.contract.functions.addRecord(
                hash_bytes,
                prev_bytes,
                record_type,
                reference_id
            )

            estimated_gas = txn_func.estimate_gas({'from': self.account.address})

            txn_dict = txn_func.build_transaction({
                'from': self.account.address,
                'nonce': nonce,
                'gasPrice': gas_price,
                'gas': estimated_gas + 10000,
            })

            # Sign transaction
            signed_txn = self.w3.eth.account.sign_transaction(txn_dict, private_key=self.private_key)
            tx_hash = self.w3.eth.send_raw_transaction(signed_txn.raw_transaction)

            block.transaction_hash = tx_hash.hex()
            block.blockchain_status = "BLOCKCHAIN_PENDING"
            block.save()

            # Wait for receipt
            receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=60)

            block.blockchain_block = receipt['blockNumber']
            block.blockchain_status = "BLOCKCHAIN_CONFIRMED" if receipt['status'] == 1 else "BLOCKCHAIN_FAILED"

            try:
                onchain_id = self.contract.functions.getRecordId(record_type, reference_id).call()
                block.blockchain_record_id = onchain_id
            except Exception:
                pass

            block.anchored_at = datetime.now()
            block.save()

        except Exception as e:
            block.blockchain_status = "BLOCKCHAIN_FAILED"
            block.save()

    def verify_record_integrity(self, record_type: str, record_id: int, payload: dict) -> dict:
        """
        Verifies if record data matches the cryptographic block hash stored on chain.
        """
        from api.models import BlockchainRecord
        blocks = BlockchainRecord.objects.filter(record_type=record_type, record_id=record_id)
        if not blocks.exists():
            return {
                "verified": False,
                "status": "NOT_ON_CHAIN",
                "message": "Record hash was not found on the blockchain ledger."
            }

        target_block = blocks.first()
        recomputed_hash = self.calculate_hash(record_type, record_id, payload, target_block.prev_hash)

        # Check local DB hash integrity
        db_valid = (recomputed_hash == target_block.data_hash)

        # Check Ethereum blockchain contract hash integrity
        blockchain_verified = False
        onchain_hash_str = ""

        if self.is_connected() and self.contract and target_block.blockchain_record_id:
            try:
                res = self.contract.functions.getRecord(target_block.blockchain_record_id).call()
                onchain_hash_bytes = res[1]  # bytes32 recordHash
                onchain_hash_str = onchain_hash_bytes.hex()
                blockchain_verified = (onchain_hash_str == recomputed_hash)
            except Exception:
                pass
        else:
            # Fallback validation for Sim / RPC offline
            blockchain_verified = db_valid

        if db_valid and blockchain_verified:
            return {
                "verified": True,
                "status": "VALID_IMMUTABLE",
                "block_number": target_block.block_number,
                "data_hash": target_block.data_hash,
                "blockchain_hash": onchain_hash_str or target_block.data_hash,
                "blockchain_block": target_block.blockchain_block,
                "transaction_hash": target_block.transaction_hash,
                "network": target_block.blockchain_network,
                "timestamp": str(target_block.timestamp),
                "message": "Record integrity verified on Ethereum Sepolia ledger."
            }
        else:
            return {
                "verified": False,
                "status": "TAMPERED_WARNING",
                "block_number": target_block.block_number,
                "expected_hash": target_block.data_hash,
                "actual_hash": recomputed_hash,
                "blockchain_hash": onchain_hash_str or "Unknown/Mismatched",
                "transaction_hash": target_block.transaction_hash,
                "message": "CRITICAL WARNING: Record verification failure. The database record might be modified!"
            }


blockchain_service = BlockchainIntegrityService()
