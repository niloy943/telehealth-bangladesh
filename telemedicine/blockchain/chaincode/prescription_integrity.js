'use strict';

/**
 * Hyperledger Fabric Chaincode: PrescriptionIntegrityContract
 *
 * Provides cryptographic proof of document integrity for E-Prescriptions.
 * STRICT PRIVACY REQUIREMENT:
 * Zero PHI (Protected Health Information) stored on chain.
 * Only documentId, version, SHA-256 hash, and timestamp are recorded.
 */

const { Contract } = require('fabric-contract-api');

class PrescriptionIntegrityContract extends Contract {
  async initLedger(ctx) {
    console.info('============= START : Initialize Prescription Integrity Ledger ===========');
    console.info('============= END : Initialize Ledger ===========');
  }

  /**
   * Registers a document SHA-256 hash on the immutable blockchain ledger.
   */
  async registerPrescriptionHash(ctx, documentId, version, sha256Hash, timestamp) {
    if (!documentId || !version || !sha256Hash) {
      throw new Error('documentId, version, and sha256Hash are mandatory');
    }

    const key = ctx.stub.createCompositeKey('PrescriptionFile', [documentId, String(version)]);
    const exists = await ctx.stub.getState(key);
    if (exists && exists.length > 0) {
      throw new Error(`Integrity record for document ${documentId} version ${version} already exists. Immutability violation.`);
    }

    const record = {
      docType: 'prescription_integrity',
      documentId,
      version: parseInt(version, 10),
      sha256Hash: sha256Hash.toLowerCase(),
      registeredAt: timestamp || new Date().toISOString(),
      registeredByMsp: ctx.clientIdentity.getMSPID(),
      txId: ctx.stub.getTxID()
    };

    await ctx.stub.putState(key, Buffer.from(JSON.stringify(record)));
    ctx.stub.setEvent('PrescriptionHashRegistered', Buffer.from(JSON.stringify({ documentId, version, sha256Hash })));

    return JSON.stringify(record);
  }

  /**
   * Queries the immutable ledger to verify document integrity.
   */
  async verifyPrescriptionHash(ctx, documentId, version, candidateHash) {
    const key = ctx.stub.createCompositeKey('PrescriptionFile', [documentId, String(version)]);
    const recordBytes = await ctx.stub.getState(key);

    if (!recordBytes || recordBytes.length === 0) {
      return JSON.stringify({
        verified: false,
        reason: 'RECORD_NOT_FOUND',
        documentId,
        version
      });
    }

    const record = JSON.parse(recordBytes.toString());
    const match = record.sha256Hash.toLowerCase() === candidateHash.toLowerCase();

    return JSON.stringify({
      verified: match,
      recordedHash: record.sha256Hash,
      candidateHash: candidateHash.toLowerCase(),
      registeredAt: record.registeredAt,
      txId: record.txId,
      tampered: !match
    });
  }
}

module.exports = PrescriptionIntegrityContract;

