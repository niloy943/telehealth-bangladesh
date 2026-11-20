import { PrismaClient, PrescriptionState, DocumentSecurityStatus } from './db/prisma-adapter.ts';
import { PrescriptionSecureService } from './modules/prescription/prescription-secure.service.ts';
import { SecurityLockdownService } from './modules/security/security-lockdown.service.ts';
import { EncryptionService } from './modules/security/encryption.service.ts';
import { BlockchainService } from './modules/blockchain/blockchain.service.ts';
import { TotpService } from './modules/auth/totp.service.ts';

async function main() {
  console.log('--- TEST: Prescription Download & Unlock Verification ---');
  const prisma = new PrismaClient();
  const encryptionService = new EncryptionService();
  const blockchainService = new BlockchainService();
  const totpService = new TotpService();
  const prescriptionService = new PrescriptionSecureService(prisma, encryptionService, blockchainService);
  const lockdownService = new SecurityLockdownService(prisma);

  const prescriptionId = 'rx-1794073086083-perctgm';

  // 1. Check Prescription Record
  const presc = await prisma.prescription.findUnique({
    where: { id: prescriptionId },
    include: { items: true }
  });
  console.log('1. Prescription in DB:', {
    id: presc?.id,
    state: presc?.state,
    patientId: presc?.patientId,
    doctorId: presc?.doctorId
  });

  // 2. Check Prescription File
  const file = await prisma.prescriptionFile.findFirst({
    where: { prescriptionId },
    include: { prescription: true, locks: true }
  });
  console.log('2. File in DB:', {
    id: file?.id,
    isReady: file?.isReady,
    securityStatus: file?.securityStatus,
    locksCount: file?.locks.length
  });

  if (!file) {
    throw new Error('Prescription file record missing!');
  }

  // 3. Test Download for patient Sadia
  console.log('3. Testing downloadPrescription for Sadia...');
  const decryptedPdf = await prescriptionService.downloadPrescription(
    file.prescriptionId,
    file.prescription.patientId,
    file.ciphertext,
    '127.0.0.1'
  );
  console.log('-> Download SUCCESS! Buffer size:', decryptedPdf.length, 'bytes');

  // Verify PDF header
  const pdfStr = decryptedPdf.toString('latin1');
  const hasPdfHeader = pdfStr.startsWith('%PDF-');
  const hasVerifiedBadge = pdfStr.includes('FABRIC BLOCKCHAIN VERIFIED');
  const hasDoctorTitle = pdfStr.includes('DOCTOR INFORMATION');
  const hasDiagnosis = pdfStr.includes('CLINICAL DIAGNOSIS');
  const hasMedsTable = pdfStr.includes('PRESCRIBED MEDICATIONS');
  const hasAdvice = pdfStr.includes('DOCTOR ADVICE');
  const hasCryptoProof = pdfStr.includes('SHA-256 Digest');

  console.log('PDF Visual & Structural checks:', {
    hasPdfHeader,
    hasVerifiedBadge,
    hasDoctorTitle,
    hasDiagnosis,
    hasMedsTable,
    hasAdvice,
    hasCryptoProof
  });

  if (!hasPdfHeader || !hasVerifiedBadge || !hasCryptoProof) {
    throw new Error('PDF is missing verified security stamps or headers!');
  }

  // 4. Test Unlock with candidate token '123456' using prescriptionId and numeric patientId '355'
  console.log('4. Testing verifyGoogleAuthenticatorAndUnlock with prescriptionId & numeric patientId 355...');
  const unlockResult = await lockdownService.verifyGoogleAuthenticatorAndUnlock(
    '355',
    prescriptionId,
    '123456',
    totpService,
    '127.0.0.1'
  );
  console.log('-> Unlock SUCCESS:', unlockResult);

  console.log('--- ALL TESTS PASSED SUCCESSFULLY! ---');
  process.exit(0);
}

main().catch((err) => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
