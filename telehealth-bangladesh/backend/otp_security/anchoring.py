import hashlib
import logging
from typing import List, Optional
from django.conf import settings
from otp_security.models import MerkleAnchor

logger = logging.getLogger("otp_security.anchoring")

# Minimal ABI for on-chain Merkle root anchor contract
ANCHOR_CONTRACT_ABI = [
    {
        "inputs": [
            {"internalType": "string", "name": "dateStr", "type": "string"},
            {"internalType": "bytes32", "name": "merkleRoot", "type": "bytes32"},
        ],
        "name": "recordRoot",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    }
]


def build_merkle_tree(leaf_hashes: List[str]) -> str:
    """
    Constructs a cryptographic Merkle tree over a list of block hashes.
    Guarantees deterministic, reproducible Merkle root.
    """
    if not leaf_hashes:
        return "0" * 64

    # Convert hex strings to raw 32-byte arrays
    current_level = [bytes.fromhex(h) for h in leaf_hashes]

    while len(current_level) > 1:
        next_level = []
        # If odd number of elements, duplicate the last element
        if len(current_level) % 2 != 0:
            current_level.append(current_level[-1])

        for i in range(0, len(current_level), 2):
            combined = current_level[i] + current_level[i + 1]
            parent_hash = hashlib.sha256(combined).digest()
            next_level.append(parent_hash)

        current_level = next_level

    return current_level[0].hex()


def publish_anchor(anchor: MerkleAnchor) -> Optional[str]:
    """
    Publishes the Merkle root to a public blockchain (Polygon / Ethereum)
    using web3.py, guarded behind the ANCHOR_ENABLED feature flag.
    Does NOT store raw PII or OTP values on-chain.
    """
    is_enabled = getattr(settings, "ANCHOR_ENABLED", False)
    if not is_enabled:
        logger.info(
            "On-chain anchoring is disabled (ANCHOR_ENABLED=False). Root %s stored off-chain only.",
            anchor.root,
        )
        return None

    provider_uri = getattr(settings, "WEB3_PROVIDER_URI", None)
    contract_addr = getattr(settings, "ANCHOR_CONTRACT_ADDRESS", None)
    private_key = getattr(settings, "ANCHOR_SIGNER_PRIVATE_KEY", None)

    if not provider_uri or not contract_addr or not private_key:
        logger.error(
            "On-chain anchoring enabled but WEB3_PROVIDER_URI, ANCHOR_CONTRACT_ADDRESS, "
            "or ANCHOR_SIGNER_PRIVATE_KEY is missing."
        )
        return None

    try:
        from web3 import Web3

        w3 = Web3(Web3.HTTPProvider(provider_uri))
        if not w3.is_connected():
            logger.error("Failed to connect to Web3 provider at %s", provider_uri)
            return None

        account = w3.eth.account.from_key(private_key)
        contract = w3.eth.contract(
            address=w3.to_checksum_address(contract_addr),
            abi=ANCHOR_CONTRACT_ABI,
        )

        root_bytes32 = bytes.fromhex(anchor.root)
        nonce = w3.eth.get_transaction_count(account.address)

        tx = contract.functions.recordRoot(
            anchor.anchor_date.isoformat(),
            root_bytes32,
        ).build_transaction({
            "from": account.address,
            "nonce": nonce,
            "gas": 100000,
            "maxFeePerGas": w3.to_wei("35", "gwei"),
            "maxPriorityFeePerGas": w3.to_wei("2", "gwei"),
        })

        signed_tx = w3.eth.account.sign_transaction(tx, private_key=private_key)
        tx_hash_bytes = w3.eth.send_raw_transaction(signed_tx.rawTransaction)
        tx_hash = w3.to_hex(tx_hash_bytes)

        anchor.tx_hash = tx_hash
        anchor.save(update_fields=["tx_hash"])
        logger.info(
            "Successfully anchored Merkle root for %s on-chain. TxHash: %s",
            anchor.anchor_date,
            tx_hash,
        )
        return tx_hash

    except ImportError:
        logger.error("web3 library is not installed. Run 'pip install web3' to enable on-chain anchoring.")
        return None
    except Exception as exc:
        logger.exception("Failed to publish Merkle root to blockchain: %s", exc)
        return None
