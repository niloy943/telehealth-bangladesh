import { randomBytes, createCipheriv, createDecipheriv, createHash } from 'node:crypto';

export interface EncryptedDocumentResult {
  ciphertext: Buffer;
  iv: string; // Base64
  authTag: string; // Base64
  wrappedKey: string; // Base64-encoded KMS wrapped DEK
  keyId: string;
  encryptionAlgo: string;
  sha256Hash: string;
}

export interface KmsProvider {
  wrapKey(plaintextKey: Buffer, keyId: string): Promise<string>;
  unwrapKey(wrappedKeyBase64: string, keyId: string): Promise<Buffer>;
}

/**
 * Local Envelope Encryption KMS Provider (Dev/Academic fallback).
 * In production, this delegates to AWS KMS (kms:Encrypt / kms:Decrypt)
 * or Google Cloud KMS (projects.locations.keyRings.cryptoKeys.encrypt).
 */
export class LocalKmsProvider implements KmsProvider {
  private masterKey: Buffer;

  constructor(masterKeyHex?: string) {
    if (masterKeyHex && masterKeyHex.length === 64) {
      this.masterKey = Buffer.from(masterKeyHex, 'hex');
    } else {
      // Deterministic or environment-provided 256-bit CMK (Customer Master Key)
      const secret = process.env.KMS_MASTER_KEY || 'default-super-secure-master-key-32b!';
      this.masterKey = createHash('sha256').update(secret).digest();
    }
  }

  async wrapKey(plaintextKey: Buffer, keyId: string): Promise<string> {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.masterKey, iv);
    cipher.setAAD(Buffer.from(keyId, 'utf8')); // Bind key to keyId context
    const encryptedKey = Buffer.concat([cipher.update(plaintextKey), cipher.final()]);
    const tag = cipher.getAuthTag();
    // Return structured payload: iv + tag + encryptedKey
    return Buffer.concat([iv, tag, encryptedKey]).toString('base64');
  }

  async unwrapKey(wrappedKeyBase64: string, keyId: string): Promise<Buffer> {
    const raw = Buffer.from(wrappedKeyBase64, 'base64');
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const encryptedKey = raw.subarray(28);

    const decipher = createDecipheriv('aes-256-gcm', this.masterKey, iv);
    decipher.setAAD(Buffer.from(keyId, 'utf8'));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encryptedKey), decipher.final()]);
  }
}

export class EncryptionService {
  private kms: KmsProvider;
  private defaultKeyId: string;

  constructor(kms?: KmsProvider, defaultKeyId: string = 'kms/telemedicine-prescription-cmk-v1') {
    this.kms = kms || new LocalKmsProvider();
    this.defaultKeyId = process.env.KMS_KEY_ID || defaultKeyId;
  }

  /**
   * Security Layer 1: AES-256-GCM Envelope Encryption
   * Generates a unique 256-bit DEK per PDF document, wraps with KMS,
   * encrypts plaintext, and computes SHA-256 integrity digest.
   */
  async encryptPdf(pdfBuffer: Buffer, keyId: string = this.defaultKeyId): Promise<EncryptedDocumentResult> {
    // 1. Generate unique 256-bit ephemeral Data Encryption Key (DEK)
    const dek = randomBytes(32);

    // 2. 96-bit Initialization Vector
    const iv = randomBytes(12);

    // 3. AES-256-GCM Cipher
    const cipher = createCipheriv('aes-256-gcm', dek, iv);
    const ciphertext = Buffer.concat([cipher.update(pdfBuffer), cipher.final()]);
    const authTag = cipher.getAuthTag();

    // 4. Wrap DEK with KMS Master Key
    const wrappedKey = await this.kms.wrapKey(dek, keyId);

    // 5. Zero out plaintext DEK from memory
    dek.fill(0);

    // 6. Compute SHA-256 digest of ciphertext for Blockchain anchoring
    const sha256Hash = createHash('sha256').update(ciphertext).digest('hex');

    return {
      ciphertext,
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      wrappedKey,
      keyId,
      encryptionAlgo: 'aes-256-gcm',
      sha256Hash
    };
  }

  /**
   * Decrypts AES-256-GCM document after unwrapping DEK.
   * Throws Error if ciphertext or auth tag has been tampered with.
   */
  async decryptPdf(
    ciphertext: Buffer,
    wrappedKey: string,
    ivBase64: string,
    authTagBase64: string,
    keyId: string = this.defaultKeyId
  ): Promise<Buffer> {
    const iv = Buffer.from(ivBase64, 'base64');
    const authTag = Buffer.from(authTagBase64, 'base64');

    // 1. Unwrap DEK using KMS
    const dek = await this.kms.unwrapKey(wrappedKey, keyId);

    try {
      // 2. AES-256-GCM Decipher
      const decipher = createDecipheriv('aes-256-gcm', dek, iv);
      decipher.setAuthTag(authTag);
      const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      return plaintext;
    } finally {
      // Zero out memory
      dek.fill(0);
    }
  }

  /**
   * Computes SHA-256 of any buffer
   */
  computeHash(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
  }
}

