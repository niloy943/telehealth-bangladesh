# Telehealth Bangladesh - Blockchain Ledger Module

## 1. Overview
The **Blockchain Ledger Module** provides a decentralized, tamper-evident audit infrastructure for the Telehealth Bangladesh telemedicine network. It ensures that digital prescriptions, patient electronic health records (EHR), and privacy consent delegations cannot be altered, forged, or repudiated by any party—including database administrators.

---

## 2. Architecture & Hybrid Design

The system implements a **hybrid dual-layer cryptographic architecture**:

```
 [Doctor Issues Prescription] / [Patient Uploads Health Record]
                                 │
                                 ▼
   ┌─────────────────────────────────────────────────────────────┐
   │ 1. Deterministic SHA-256 Merkle Chain Computation          │
   │    hash = SHA-256( record_type : record_id : payload : prev )│
   └─────────────────────────────┬───────────────────────────────┘
                                 │
                 ┌───────────────┴───────────────┐
                 ▼                               ▼
    ┌───────────────────────────┐  ┌───────────────────────────┐
    │ 2. Local Database Ledger  │  │ 3. Ethereum Sepolia       │
    │    (Fast audit & queries) │  │    Smart Contract Anchor  │
    │    Table: BlockchainRecord│  │    Contract: HealNSight   │
    └───────────────────────────┘  └───────────────────────────┘
```

1. **Layer 1 — Local Cryptographic Ledger (Fast OLTP queries):**
   - Stores block number, data hash, previous block hash, timestamp, and transaction metadata in the `BlockchainRecord` relational table.
2. **Layer 2 — Public Ethereum Sepolia Testnet (Immutable Proof of Existence):**
   - Transmits a Web3 transaction anchoring `bytes32 _recordHash` and `bytes32 _previousHash` to the deployed `HealNSightLedger` Solidity smart contract.
   - Generates an immutable Ethereum transaction receipt with block number and gas receipt.

---

## 3. Directory & File Structure

```
blockchain/
├── __init__.py                     # Package init exporting BlockchainIntegrityService
├── service.py                      # Core Python Web3.py & SHA-256 hash chaining service
├── serializers.py                  # Django REST Framework serializers
├── views.py                        # Dedicated API views for audit & verification
├── urls.py                         # Django URL routing for /api/blockchain/
├── test_audit.py                   # Automated test suite for blockchain validation
├── README.md                       # Architecture & technical documentation
└── contracts/
    ├── HealNSightLedger.sol        # Ethereum Solidity smart contract
    └── HealNSightLedgerABI.json    # Standard JSON ABI contract interface
```

---

## 4. Solidity Smart Contract (`HealNSightLedger.sol`)

### Contract Specification
- **Compiler Version:** Solidity `^0.8.0`
- **Network Support:** Ethereum Sepolia, Ethereum Mainnet, Polygon, Arbitrum, Local Hardhat/Anvil.

### Key Functions
| Function | Parameters | Description |
| :--- | :--- | :--- |
| `addRecord` | `(bytes32 _recordHash, bytes32 _previousHash, string _recordType, string _referenceId)` | Commits a record hash on-chain, emits `RecordAnchored` event, and assigns an ID. |
| `getRecord` | `(uint256 _id)` | Retrieves the full on-chain record by sequential ID. |
| `verifyRecord` | `(uint256 _id, bytes32 _recordHash)` | Returns `true` if the provided hash matches the immutable on-chain record hash. |
| `getRecordId` | `(string _recordType, string _referenceId)` | Looks up the on-chain ID for a given local database reference ID. |

---

## 5. Cryptographic Hashing Formula

The block hash is computed deterministically as:
$$\text{Data Hash} = \text{SHA-256}(\text{record\_type} \parallel \text{":"} \parallel \text{record\_id} \parallel \text{":"} \parallel \text{JSON}_{\text{sorted}}(\text{payload}) \parallel \text{":"} \parallel \text{prev\_hash})$$

If any field inside the database record is altered, recomputing the hash produces a mismatch with the block hash stored on Ethereum, immediately flagging a `TAMPERED_WARNING` alert.

---

## 6. REST API Endpoints

### A. List Blockchain Blocks
- **Endpoint:** `GET /api/blockchain/records/`
- **Authorization:** `Bearer <Admin JWT Token>`
- **Response:**
```json
[
  {
    "id": 1,
    "record_type": "prescription",
    "record_id": 12,
    "data_hash": "a4f9b2c3d4e5f678...",
    "prev_hash": "0000000000000000...",
    "block_number": 1,
    "blockchain_network": "Ethereum Sepolia",
    "contract_address": "0x71C...32B",
    "transaction_hash": "0x8f3c...11a",
    "blockchain_status": "BLOCKCHAIN_CONFIRMED"
  }
]
```

### B. Verify Record Integrity
- **Endpoint:** `POST /api/blockchain/verify-record/`
- **Authorization:** `Bearer <JWT Token>`
- **Request Body:**
```json
{
  "record_type": "prescription",
  "record_id": 12,
  "simulate_tampering": false
}
```
- **Response (Valid):**
```json
{
  "verified": true,
  "status": "VALID_IMMUTABLE",
  "block_number": 1,
  "data_hash": "a4f9b2c3d4e5f678...",
  "blockchain_hash": "a4f9b2c3d4e5f678...",
  "message": "Record integrity verified on Ethereum Sepolia ledger."
}
```

### C. Live Network Status
- **Endpoint:** `GET /api/blockchain/status/`
- **Response:**
```json
{
  "connected": true,
  "network_name": "Ethereum Sepolia Testnet",
  "contract_address": "0x71C...32B",
  "latest_block": 5642918,
  "gas_price_gwei": 14.5
}
```

---

## 7. Environment Configuration

To connect to a live Sepolia RPC node, configure the following variables in `.env`:

```env
# Ethereum Sepolia RPC Configuration
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_PROJECT_ID
BLOCKCHAIN_PRIVATE_KEY=0xYOUR_SEPOLIA_WALLET_PRIVATE_KEY
HEALNSIGHT_CONTRACT_ADDRESS=0xYOUR_DEPLOYED_CONTRACT_ADDRESS
```

*Note: If no RPC URL is provided, the service seamlessly falls back to high-performance local cryptographic ledger mode.*

---

## 8. Running the Audit Test Suite

Execute the standalone verification test suite:

```bash
python blockchain/test_audit.py
```
