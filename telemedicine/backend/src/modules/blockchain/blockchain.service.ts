import { SQLiteDatabase } from '../../db/sqlite-store.ts';

export interface BlockchainVerificationResult {
  verified: boolean;
  recordedHash: string;
  candidateHash: string;
  txId?: string;
  timestamp?: string;
  tampered: boolean;
}

export interface IBlockchainService {
  registerPrescriptionHash(
    documentId: string,
    version: number,
    sha256Hash: string,
    timestamp?: string
  ): Promise<{ txId: string; registeredAt: string }>;

  verifyPrescriptionHash(
    documentId: string,
    version: number,
    candidateHash: string
  ): Promise<BlockchainVerificationResult>;
}

/**
 * Local Cryptographic Ledger Provider.
 * Maintains an append-only, tamper-evident hash store simulating
 * Hyperledger Fabric chaincode state and events.
 * Can be swapped with FabricGatewayService in Docker/Production.
 */
export class LocalCryptographicLedger implements IBlockchainService {
  private ledger: Map<string, { sha256Hash: string; registeredAt: string; txId: string }> = new Map();

  private makeKey(documentId: string, version: number): string {
    return `${documentId}:v${version}`;
  }

  async registerPrescriptionHash(
    documentId: string,
    version: number,
    sha256Hash: string,
    timestamp: string = new Date().toISOString()
  ): Promise<{ txId: string; registeredAt: string }> {
    const key = this.makeKey(documentId, version);
    if (this.ledger.has(key)) {
      throw new Error(`Immutability Violation: Hash for document ${documentId} v${version} is already registered.`);
    }

    const txId = 'tx_fabric_' + Buffer.from(key + sha256Hash + Date.now()).toString('hex').slice(0, 32);
    this.ledger.set(key, {
      sha256Hash: sha256Hash.toLowerCase(),
      registeredAt: timestamp,
      txId
    });

    return { txId, registeredAt: timestamp };
  }

  async verifyPrescriptionHash(
    documentId: string,
    version: number,
    candidateHash: string
  ): Promise<BlockchainVerificationResult> {
    const key = this.makeKey(documentId, version);
    let entry = this.ledger.get(key);

    if (!entry) {
      try {
        const db = new SQLiteDatabase();
        const row = await db.get(
          'SELECT sha256Hash, blockchainTxId, blockchainTimestamp FROM prescription_files WHERE prescriptionId = ? OR id = ? ORDER BY version DESC LIMIT 1',
          [documentId, documentId]
        );
        if (row && row.sha256Hash) {
          entry = {
            sha256Hash: String(row.sha256Hash).toLowerCase(),
            registeredAt: row.blockchainTimestamp || new Date().toISOString(),
            txId: row.blockchainTxId || 'tx_fabric_persisted'
          };
          this.ledger.set(key, entry);
        }
      } catch (e) {
        // ignore
      }
    }

    if (!entry) {
      return {
        verified: false,
        recordedHash: '',
        candidateHash: candidateHash.toLowerCase(),
        tampered: true
      };
    }

    const match = entry.sha256Hash === candidateHash.toLowerCase();
    return {
      verified: match,
      recordedHash: entry.sha256Hash,
      candidateHash: candidateHash.toLowerCase(),
      txId: entry.txId,
      timestamp: entry.registeredAt,
      tampered: !match
    };
  }
}

export class BlockchainService {
  private driver: IBlockchainService;

  constructor(driver?: IBlockchainService) {
    this.driver = driver || new LocalCryptographicLedger();
  }

  async registerPrescriptionHash(documentId: string, version: number, sha256Hash: string) {
    return this.driver.registerPrescriptionHash(documentId, version, sha256Hash);
  }

  async verifyPrescriptionHash(documentId: string, version: number, candidateHash: string) {
    return this.driver.verifyPrescriptionHash(documentId, version, candidateHash);
  }
}

