import assert from 'node:assert';
import http from 'node:http';
import { Duplex } from 'node:stream';
import { PrismaClient, UserRole, ConsultationStatus, PrescriptionState, DocumentSecurityStatus } from './db/prisma-adapter.ts';
import { EncryptionService } from './modules/security/encryption.service.ts';
import { BlockchainService } from './modules/blockchain/blockchain.service.ts';
import { SecurityLockdownService } from './modules/security/security-lockdown.service.ts';
import { ConsultationAccessService } from './modules/consultation/consultation-access.service.ts';
import { PrescriptionSecureService } from './modules/prescription/prescription-secure.service.ts';
import { TotpService } from './modules/auth/totp.service.ts';

class MockSocket extends Duplex {
  _read() {}
  _write(_chunk: any, _enc: any, cb: any) { cb(); }
}

async function dispatch(app: any, opts: { method?: string; path: string; headers?: Record<string, string>; body?: any }): Promise<{ status: number; headers: Record<string, any>; data: any; rawBody: Buffer }> {
  return new Promise((resolve) => {
    const socket = new MockSocket();
    const req: any = new http.IncomingMessage(socket as any);
    req.method = opts.method || 'GET';
    req.url = opts.path;
    req.headers = { host: '127.0.0.1:5002', 'content-type': 'application/json', ...(opts.headers || {}) };

    if (opts.body) {
      const payload = Buffer.from(JSON.stringify(opts.body));
      req.headers['content-length'] = String(payload.length);
      setTimeout(() => {
        req.push(payload);
        req.push(null);
      }, 5);
    } else {
      setTimeout(() => req.push(null), 5);
    }

    const res: any = new http.ServerResponse(req);
    res.assignSocket(socket as any);

    const chunks: Buffer[] = [];
    res.write = function (chunk: any) {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      return true;
    };

    res.end = function (chunk: any) {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      const raw = Buffer.concat(chunks);
      let parsed = null;
      try {
        parsed = JSON.parse(raw.toString('utf8'));
      } catch {
        parsed = raw.toString('utf8');
      }
      resolve({
        status: res.statusCode,
        headers: res.getHeaders ? res.getHeaders() : {},
        data: parsed,
        rawBody: raw
      });
    };

    app(req, res);
  });
}

async function runVerification() {
  console.log('\n================================================================');
  console.log(' 🧪 VERIFYING POST-CONSULTATION PATIENT PDF ACCESS & PERSISTENCE ');
  console.log('================================================================\n');

  const prisma = new PrismaClient();
  await prisma.init();

  const totp = new TotpService();
  const encryption = new EncryptionService();
  const blockchain = new BlockchainService();
  const lockdown = new SecurityLockdownService(prisma);
  const accessService = new ConsultationAccessService(prisma);
  const prescriptionService = new PrescriptionSecureService(prisma, encryption, blockchain, lockdown);

  // Setup Test Fixtures
  const doctorId = `doc-post-${Date.now()}`;
  const patientId = `pat-post-${Date.now()}`;
  const attackerId = `attacker-${Date.now()}`;
  const consultationId = `cons-post-${Date.now()}`;

  await prisma.user.create({ data: { id: doctorId, email: `dr.${Date.now()}@telehealth.bd`, name: 'Dr. Test', role: UserRole.DOCTOR, passwordHash: 'pwd' } });
  await prisma.user.create({ data: { id: patientId, email: `pat.${Date.now()}@telehealth.bd`, name: 'Patient Niloy', role: UserRole.PATIENT, passwordHash: 'pwd' } });
  await prisma.user.create({ data: { id: attackerId, email: `att.${Date.now()}@telehealth.bd`, name: 'Unauthorized Person', role: UserRole.PATIENT, passwordHash: 'pwd' } });

  await prisma.consultation.create({
    data: {
      id: consultationId,
      doctorId,
      patientId,
      status: ConsultationStatus.SCHEDULED,
      scheduledAt: new Date()
    }
  });

  // Import Express app from index.ts or create instance with routes
  const express = (await import('express')).default;
  const app = express();
  app.use(express.json());

  // Bind routes matching index.ts
  app.post('/api/doctor/prescriptions/approve', async (req, res) => {
    const dId = (req.headers['x-doctor-id'] || req.body.doctorId) as string;
    const { consultationId: cId, patientId: pId, diagnosis, symptoms, advice, items } = req.body;

    const access = await accessService.canDoctorAccessPatient(dId, pId, cId);
    if (!access.allowed) {
      return res.status(403).json({ error: 'Cannot approve prescription without active consultation grant.' });
    }

    const result = await prescriptionService.approveAndGeneratePrescription({
      consultationId: cId,
      doctorId: dId,
      patientId: pId,
      diagnosis,
      symptoms,
      advice,
      items: items || []
    });

    await accessService.revokeDoctorAccess(cId, dId, 'Prescription approved and consultation finalized.');
    return res.status(201).json(result);
  });

  app.get('/api/prescriptions/patient/list', async (req, res) => {
    const pId = (req.headers['x-patient-id'] || req.query.patientId) as string;
    if (!pId) return res.status(401).json({ error: 'Authentication required' });

    const prescriptions = await prisma.prescription.findMany({
      where: { patientId: pId, state: 'READY' },
      include: { doctor: true, items: true, files: true }
    });
    return res.json(prescriptions.map((p: any) => ({
      id: p.id,
      consultationId: p.consultationId,
      doctorName: p.doctor?.name,
      patientId: p.patientId,
      diagnosis: p.diagnosis,
      items: p.items,
      state: p.state,
      isReady: true
    })));
  });

  app.get('/api/patient/prescriptions/:id/download', async (req, res) => {
    const pId = req.headers['x-patient-id'] as string;
    const prescriptionId = req.params.id;
    if (!pId) return res.status(401).json({ error: 'Authentication required: Patient identity not provided.' });

    try {
      const file = await prisma.prescriptionFile.findFirst({
        where: { prescriptionId },
        include: { prescription: true }
      });
      if (!file) return res.status(404).json({ error: 'Prescription document not found.' });

      // Ownership verification
      if (file.prescription.patientId !== pId) {
        return res.status(403).json({ error: 'Access Denied: You are not authorized to access this prescription.' });
      }

      // Download genuine ciphertext
      const decryptedBuffer = await prescriptionService.downloadPrescription(
        file.prescriptionId,
        pId,
        file.ciphertext,
        req.ip
      );
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="prescription-${file.prescriptionId}.pdf"`);
      return res.send(decryptedBuffer);
    } catch (err: any) {
      return res.status(403).json({ error: err.message });
    }
  });

  // Stage 1: Patient joins call -> Doctor granted temporary access
  await accessService.grantTemporaryAccess(consultationId, doctorId, patientId, 30);
  const activeCheck = await accessService.canDoctorAccessPatient(doctorId, patientId, consultationId);
  assert.strictEqual(activeCheck.allowed, true, 'Doctor should have active grant during consultation');
  console.log('✅ REQ 1: Doctor temporary ConsultationGrant verified active during call.');

  // Stage 2: Doctor approves prescription
  const approveRes = await dispatch(app, {
    method: 'POST',
    path: '/api/doctor/prescriptions/approve',
    headers: { 'x-doctor-id': doctorId },
    body: {
      consultationId,
      patientId,
      diagnosis: 'Hypertension (Stage 1)',
      symptoms: 'Headache and palpitations',
      advice: 'Low salt diet',
      items: [{ medicineName: 'Telmisartan', dosage: '40mg', frequency: '1-0-0', duration: '30 Days' }]
    }
  });

  assert.strictEqual(approveRes.status, 201);
  const prescriptionId = approveRes.data.prescriptionId;
  assert.ok(prescriptionId, 'Prescription ID generated');
  console.log(`✅ REQ 1 & 5: Prescription approved & anchored to blockchain. ID: ${prescriptionId}`);

  // Stage 3: Doctor access is REVOKED
  const postApproveCheck = await accessService.canDoctorAccessPatient(doctorId, patientId, consultationId);
  assert.strictEqual(postApproveCheck.allowed, false, 'Doctor access must be revoked');
  console.log('✅ REQ 1: Doctor ConsultationGrant revoked immediately post-approval (Doctor Access Terminated).');

  // Verify doctor cannot download the finalized prescription
  const doctorDownload = await dispatch(app, {
    path: `/api/patient/prescriptions/${prescriptionId}/download`,
    headers: { 'x-patient-id': doctorId }
  });
  assert.strictEqual(doctorDownload.status, 403, 'Doctor must be blocked from downloading patient prescription');
  console.log('✅ REQ 1 & 7: Doctor attempting download strictly blocked with 403 Forbidden.');

  // Stage 4: Verify approved prescription appears in patient list (E-Prescription Portal)
  const listRes = await dispatch(app, {
    path: '/api/prescriptions/patient/list',
    headers: { 'x-patient-id': patientId }
  });
  assert.strictEqual(listRes.status, 200);
  assert.strictEqual(Array.isArray(listRes.data), true);
  assert.ok(listRes.data.some((p: any) => p.id === prescriptionId), 'Prescription must appear in patient portal list');
  console.log('✅ REQ 5: Approved prescription permanently persisted and appears in patient E-Prescription Portal.');

  // Stage 5: Authenticated patient downloads finalized PDF after consultation ended
  const patientDownload = await dispatch(app, {
    path: `/api/patient/prescriptions/${prescriptionId}/download`,
    headers: { 'x-patient-id': patientId }
  });
  assert.strictEqual(patientDownload.status, 200, 'Patient must be allowed to download PDF after consultation ends');
  assert.ok(patientDownload.rawBody.toString().includes('%PDF-1.4'), 'Must return valid decrypted PDF bytes');
  console.log('✅ REQ 2, 3, 4: Patient successfully retrieved & decrypted finalized PDF post-consultation (HTTP 200).');

  // Stage 6: Verify unauthorized patient is blocked (Ownership Check)
  const attackerDownload = await dispatch(app, {
    path: `/api/patient/prescriptions/${prescriptionId}/download`,
    headers: { 'x-patient-id': attackerId }
  });
  assert.strictEqual(attackerDownload.status, 403, 'Attacker must be blocked');
  console.log('✅ REQ 3 & 7: Unauthorized user attempting download strictly blocked with 403 Forbidden.');

  // Stage 7: Verify blockchain tamper detection halts delivery and enforces quarantine
  const fileRecord = await prisma.prescriptionFile.findFirst({ where: { prescriptionId } });
  assert.ok(fileRecord, 'File record found');
  const tamperedCiphertext = Buffer.from(fileRecord.ciphertext);
  tamperedCiphertext[0] = tamperedCiphertext[0] ^ 0xff; // Invert first byte

  try {
    await prescriptionService.downloadPrescription(prescriptionId, patientId, tamperedCiphertext);
    assert.fail('Tampered ciphertext must fail blockchain integrity verification');
  } catch (err: any) {
    assert.ok(err.message.includes('quarantine') || err.message.includes('cryptographic'), 'Must flag quarantine');
  }

  // Verify file is now quarantined in database
  const quarantinedFile = await prisma.prescriptionFile.findFirst({ where: { prescriptionId } });
  assert.ok(
    quarantinedFile.securityStatus === DocumentSecurityStatus.QUARANTINED ||
    quarantinedFile.securityStatus === DocumentSecurityStatus.LOCKED,
    'File must be quarantined/locked'
  );
  console.log('✅ REQ 6: Tampered ciphertext failed blockchain check, quarantined document, and blocked delivery.');

  console.log('\n================================================================');
  console.log(' 🎯 ALL 7 POST-CONSULTATION PATIENT PDF ACCESS REQUIREMENTS MET ');
  console.log('================================================================\n');
}

runVerification().catch((e) => {
  console.error('Test execution failed:', e);
  process.exit(1);
});
