import { PdfRendererService, PrescriptionPdfData } from '../modules/prescription/pdf-renderer.service.ts';
import { EncryptionService } from '../modules/security/encryption.service.ts';
import { BlockchainService } from '../modules/blockchain/blockchain.service.ts';

export interface PrescriptionJobData {
  prescriptionId: string;
  consultationId: string;
  pdfData: PrescriptionPdfData;
}

export class PrescriptionWorker {
  private pdfRenderer: PdfRendererService;
  private encryptionService: EncryptionService;
  private blockchainService: BlockchainService;
  private jobQueue: PrescriptionJobData[] = [];
  private isProcessing = false;

  constructor(
    pdfRenderer?: PdfRendererService,
    encryptionService?: EncryptionService,
    blockchainService?: BlockchainService
  ) {
    this.pdfRenderer = pdfRenderer || new PdfRendererService();
    this.encryptionService = encryptionService || new EncryptionService();
    this.blockchainService = blockchainService || new BlockchainService();
  }

  /**
   * Enqueues an approved prescription for background processing
   */
  async enqueuePdfGeneration(jobData: PrescriptionJobData): Promise<void> {
    console.log(`[BullMQ Worker] Enqueued PDF generation for prescription: ${jobData.prescriptionId}`);
    this.jobQueue.push(jobData);
    this.processNextJob();
  }

  /**
   * Processes the generation, AES-256-GCM encryption, and blockchain anchoring
   */
  async processJob(jobData: PrescriptionJobData) {
    const { prescriptionId, pdfData } = jobData;
    console.log(`[Worker] Starting PDF generation for prescription ${prescriptionId}...`);

    // 1. Render PDF document
    const rawPdfBuffer = await this.pdfRenderer.renderPrescriptionPdf(pdfData);

    // 2. AES-256-GCM Envelope Encryption with Cloud KMS
    const encrypted = await this.encryptionService.encryptPdf(rawPdfBuffer);

    // 3. Hyperledger Fabric Blockchain Hash Anchoring
    const blockchainReceipt = await this.blockchainService.registerPrescriptionHash(
      prescriptionId,
      1,
      encrypted.sha256Hash
    );

    console.log(`[Worker] Successfully encrypted & anchored prescription ${prescriptionId}:`);
    console.log(`  - SHA-256 Digest: ${encrypted.sha256Hash}`);
    console.log(`  - Blockchain TxID: ${blockchainReceipt.txId}`);

    return {
      prescriptionId,
      fileSizeBytes: encrypted.ciphertext.length,
      sha256Hash: encrypted.sha256Hash,
      blockchainTxId: blockchainReceipt.txId,
      ciphertext: encrypted.ciphertext,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
      wrappedKey: encrypted.wrappedKey,
      keyId: encrypted.keyId
    };
  }

  private async processNextJob() {
    if (this.isProcessing || this.jobQueue.length === 0) return;

    this.isProcessing = true;
    const currentJob = this.jobQueue.shift();

    if (currentJob) {
      try {
        await this.processJob(currentJob);
      } catch (err) {
        console.error(`[Worker Error] Failed to process prescription ${currentJob.prescriptionId}:`, err);
      } finally {
        this.isProcessing = false;
        if (this.jobQueue.length > 0) {
          this.processNextJob();
        }
      }
    } else {
      this.isProcessing = false;
    }
  }
}

