import { SQLiteDatabase } from './sqlite-store.ts';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const UserRole = {
  PATIENT: 'PATIENT',
  DOCTOR: 'DOCTOR',
  ADMIN: 'ADMIN'
} as const;

export const ConsultationStatus = {
  SCHEDULED: 'SCHEDULED',
  ACTIVE: 'ACTIVE',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED'
} as const;

export const PrescriptionState = {
  DRAFT: 'DRAFT',
  APPROVED: 'APPROVED',
  GENERATING: 'GENERATING',
  READY: 'READY',
  LOCKED: 'LOCKED'
} as const;

export const DocumentSecurityStatus = {
  ACTIVE: 'ACTIVE',
  LOCKED: 'LOCKED',
  QUARANTINED: 'QUARANTINED'
} as const;

export const SecurityEventType = {
  SECURITY_LOCK: 'SECURITY_LOCK',
  INTEGRITY_FAILURE: 'INTEGRITY_FAILURE',
  FAILED_AUTH: 'FAILED_AUTH',
  UNAUTHORIZED_ACCESS_ATTEMPT: 'UNAUTHORIZED_ACCESS_ATTEMPT',
  LOCKDOWN_TRIGGERED: 'LOCKDOWN_TRIGGERED',
  OTP_RECOVERY_SUCCESS: 'OTP_RECOVERY_SUCCESS',
  OTP_RECOVERY_FAILED: 'OTP_RECOVERY_FAILED'
} as const;

export const LockReason = {
  INTEGRITY_HASH_MISMATCH: 'INTEGRITY_HASH_MISMATCH',
  SUSPICIOUS_DOWNLOAD_ACTIVITY: 'SUSPICIOUS_DOWNLOAD_ACTIVITY',
  REVOKED_SESSION_REUSE: 'REVOKED_SESSION_REUSE',
  FAILED_AUTHENTICATION_BURST: 'FAILED_AUTHENTICATION_BURST',
  ADMIN_MANUAL_LOCK: 'ADMIN_MANUAL_LOCK'
} as const;

const generateId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

export class PrismaClient {
  private db: SQLiteDatabase;

  constructor() {
    this.db = new SQLiteDatabase();
  }

  async init() {
    await this.db.initSchema();
  }

  get user() {
    return {
      findUnique: async ({ where }: any) => {
        if (where.id) return this.db.get('SELECT * FROM users WHERE id = ?', [where.id]);
        if (where.email) return this.db.get('SELECT * FROM users WHERE email = ?', [where.email]);
        return null;
      },
      create: async ({ data }: any) => {
        const id = data.id || generateId('user');
        await this.db.run(
          `INSERT INTO users (id, email, phone, name, role, passwordHash, doctorLicense, isVerified, mfaSecret, mfaEnabled, mfaBackupCodes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            data.email,
            data.phone || null,
            data.name,
            data.role || 'PATIENT',
            data.passwordHash,
            data.doctorLicense || null,
            data.isVerified ? 1 : 0,
            data.mfaSecret || null,
            data.mfaEnabled ? 1 : 0,
            data.mfaBackupCodes || null
          ]
        );
        return this.db.get('SELECT * FROM users WHERE id = ?', [id]);
      },
      update: async ({ where, data }: any) => {
        const updates: string[] = [];
        const values: any[] = [];
        for (const [key, val] of Object.entries(data)) {
          updates.push(`${key} = ?`);
          values.push(val);
        }
        values.push(where.id);
        await this.db.run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);
        return this.db.get('SELECT * FROM users WHERE id = ?', [where.id]);
      }
    };
  }

  get consultation() {
    return {
      create: async ({ data }: any) => {
        const id = data.id || generateId('cons');
        const roomName = data.roomName || `room-${id}`;
        await this.db.run(
          `INSERT INTO consultations (id, doctorId, patientId, roomName, status, scheduledAt, startedAt, endedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            data.doctorId,
            data.patientId,
            roomName,
            data.status || 'SCHEDULED',
            data.scheduledAt instanceof Date ? data.scheduledAt.toISOString() : (data.scheduledAt || null),
            data.startedAt instanceof Date ? data.startedAt.toISOString() : (data.startedAt || null),
            data.endedAt instanceof Date ? data.endedAt.toISOString() : (data.endedAt || null)
          ]
        );
        return this.db.get('SELECT * FROM consultations WHERE id = ?', [id]);
      },
      findUnique: async ({ where, include }: any) => {
        const c = await this.db.get('SELECT * FROM consultations WHERE id = ?', [where.id]);
        if (!c) return null;
        if (include?.grants) {
          const grants = await this.db.all(
            'SELECT * FROM consultation_grants WHERE consultationId = ? AND revokedAt IS NULL ORDER BY grantedAt DESC',
            [c.id]
          );
          c.grants = grants;
        }
        return c;
      },
      update: async ({ where, data }: any) => {
        const updates: string[] = [];
        const values: any[] = [];
        for (const [key, val] of Object.entries(data)) {
          updates.push(`${key} = ?`);
          values.push(val instanceof Date ? val.toISOString() : val);
        }
        values.push(where.id);
        await this.db.run(`UPDATE consultations SET ${updates.join(', ')} WHERE id = ?`, values);
        return this.db.get('SELECT * FROM consultations WHERE id = ?', [where.id]);
      }
    };
  }

  get consultationGrant() {
    return {
      create: async ({ data }: any) => {
        const id = data.id || generateId('grant');
        await this.db.run(
          `INSERT INTO consultation_grants (id, consultationId, doctorId, patientId, expiresAt)
           VALUES (?, ?, ?, ?, ?)`,
          [
            id,
            data.consultationId,
            data.doctorId,
            data.patientId,
            data.expiresAt instanceof Date ? data.expiresAt.toISOString() : data.expiresAt
          ]
        );
        return this.db.get('SELECT * FROM consultation_grants WHERE id = ?', [id]);
      },
      updateMany: async ({ where, data }: any) => {
        const revokedAt = data.revokedAt instanceof Date ? data.revokedAt.toISOString() : data.revokedAt;
        return this.db.run(
          `UPDATE consultation_grants SET revokedAt = ?, revocationReason = ?
           WHERE consultationId = ? AND doctorId = ? AND revokedAt IS NULL`,
          [revokedAt, data.revocationReason, where.consultationId, where.doctorId]
        );
      }
    };
  }

  get prescription() {
    return {
      findUnique: async ({ where, include }: any) => {
        const p = await this.db.get('SELECT * FROM prescriptions WHERE id = ? OR consultationId = ?', [
          where.id || '',
          where.consultationId || ''
        ]);
        if (!p) return null;
        if (include?.items) {
          p.items = await this.db.all('SELECT * FROM prescription_items WHERE prescriptionId = ?', [p.id]);
        }
        if (include?.doctor) {
          p.doctor = await this.db.get('SELECT * FROM users WHERE id = ?', [p.doctorId]);
        }
        if (include?.patient) {
          p.patient = await this.db.get('SELECT * FROM users WHERE id = ?', [p.patientId]);
        }
        if (include?.files) {
          p.files = await this.db.all('SELECT * FROM prescription_files WHERE prescriptionId = ? ORDER BY version DESC', [p.id]);
        }
        return p;
      },
      findFirst: async ({ where = {}, include }: any) => {
        let sql = 'SELECT * FROM prescriptions WHERE 1=1';
        const params: any[] = [];
        if (where.id) {
          sql += ' AND id = ?';
          params.push(where.id);
        }
        if (where.consultationId) {
          sql += ' AND consultationId = ?';
          params.push(where.consultationId);
        }
        if (where.patientId) {
          if (Array.isArray(where.patientId)) {
            const placeholders = where.patientId.map(() => '?').join(', ');
            sql += ` AND (patientId IN (${placeholders}) OR ${where.patientId.map(() => 'patientId LIKE ?').join(' OR ')} OR patientId IN (SELECT id FROM users WHERE ${where.patientId.map(() => 'id LIKE ? OR name LIKE ? OR email LIKE ?').join(' OR ')}))`;
            params.push(...where.patientId);
            where.patientId.forEach((id: string) => params.push(`%${id}%`));
            where.patientId.forEach((id: string) => params.push(`%${id}%`, `%${id}%`, `%${id}%`));
          } else {
            sql += ' AND (patientId = ? OR patientId LIKE ? OR patientId IN (SELECT id FROM users WHERE id LIKE ? OR name LIKE ? OR email LIKE ?))';
            const wild = `%${where.patientId}%`;
            params.push(where.patientId, wild, wild, wild, wild);
          }
        }
        if (where.doctorId) {
          sql += ' AND (doctorId = ? OR doctorId LIKE ? OR doctorId IN (SELECT id FROM users WHERE id LIKE ? OR name LIKE ? OR email LIKE ?))';
          const wild = `%${where.doctorId}%`;
          params.push(where.doctorId, wild, wild, wild, wild);
        }
        if (where.state) {
          sql += ' AND state = ?';
          params.push(where.state);
        }
        sql += ' ORDER BY approvedAt DESC LIMIT 1';
        const p = await this.db.get(sql, params);
        if (!p) return null;
        if (include?.items) {
          p.items = await this.db.all('SELECT * FROM prescription_items WHERE prescriptionId = ?', [p.id]);
        }
        if (include?.doctor) {
          p.doctor = await this.db.get('SELECT * FROM users WHERE id = ?', [p.doctorId]);
        }
        if (include?.patient) {
          p.patient = await this.db.get('SELECT * FROM users WHERE id = ?', [p.patientId]);
        }
        if (include?.files) {
          p.files = await this.db.all('SELECT * FROM prescription_files WHERE prescriptionId = ? ORDER BY version DESC', [p.id]);
        }
        return p;
      },
      findMany: async ({ where = {}, include }: any = {}) => {
        let sql = 'SELECT * FROM prescriptions WHERE 1=1';
        const params: any[] = [];
        if (where.patientId) {
          if (Array.isArray(where.patientId)) {
            const placeholders = where.patientId.map(() => '?').join(', ');
            sql += ` AND (patientId IN (${placeholders}) OR ${where.patientId.map(() => 'patientId LIKE ?').join(' OR ')} OR patientId IN (SELECT id FROM users WHERE ${where.patientId.map(() => 'id LIKE ? OR name LIKE ? OR email LIKE ?').join(' OR ')}))`;
            params.push(...where.patientId);
            where.patientId.forEach((id: string) => params.push(`%${id}%`));
            where.patientId.forEach((id: string) => params.push(`%${id}%`, `%${id}%`, `%${id}%`));
          } else {
            sql += ' AND (patientId = ? OR patientId LIKE ? OR patientId IN (SELECT id FROM users WHERE id LIKE ? OR name LIKE ? OR email LIKE ?))';
            const wild = `%${where.patientId}%`;
            params.push(where.patientId, wild, wild, wild, wild);
          }
        }
        if (where.doctorId) {
          sql += ' AND (doctorId = ? OR doctorId LIKE ? OR doctorId IN (SELECT id FROM users WHERE id LIKE ? OR name LIKE ? OR email LIKE ?))';
          const wild = `%${where.doctorId}%`;
          params.push(where.doctorId, wild, wild, wild, wild);
        }
        if (where.state) {
          if (Array.isArray(where.state)) {
            sql += ` AND state IN (${where.state.map(() => '?').join(', ')})`;
            params.push(...where.state);
          } else {
            sql += ' AND state = ?';
            params.push(where.state);
          }
        }
        sql += ' ORDER BY approvedAt DESC';
        const rows = await this.db.all(sql, params);
        for (const p of rows) {
          if (include?.items) {
            p.items = await this.db.all('SELECT * FROM prescription_items WHERE prescriptionId = ?', [p.id]);
          }
          if (include?.doctor) {
            p.doctor = await this.db.get('SELECT * FROM users WHERE id = ?', [p.doctorId]);
          }
          if (include?.patient) {
            p.patient = await this.db.get('SELECT * FROM users WHERE id = ?', [p.patientId]);
          }
          if (include?.files) {
            p.files = await this.db.all('SELECT * FROM prescription_files WHERE prescriptionId = ? ORDER BY version DESC', [p.id]);
          }
        }
        return rows;
      },
      upsert: async ({ where, update, create, include }: any) => {
        let p = await this.db.get('SELECT * FROM prescriptions WHERE consultationId = ?', [where.consultationId]);
        const itemsToInsert = update.items?.create || create.items?.create || [];
        if (p) {
          await this.db.run(
            `UPDATE prescriptions SET state = ?, diagnosis = ?, symptoms = ?, advice = ?, approvedAt = datetime('now')
             WHERE id = ?`,
            [update.state, update.diagnosis, update.symptoms, update.advice, p.id]
          );
          if (itemsToInsert.length > 0) {
            await this.db.run('DELETE FROM prescription_items WHERE prescriptionId = ?', [p.id]);
            for (const item of itemsToInsert) {
              await this.db.run(
                `INSERT INTO prescription_items (id, prescriptionId, medicineName, dosage, frequency, duration, instructions)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                  `item-${Date.now()}-${Math.random().toString(36).substring(7)}`,
                  p.id,
                  item.medicineName,
                  item.dosage,
                  item.frequency,
                  item.duration,
                  item.instructions || ''
                ]
              );
            }
          }
          p = await this.db.get('SELECT * FROM prescriptions WHERE id = ?', [p.id]);
        } else {
          const id = generateId('rx');
          await this.db.run(
            `INSERT INTO prescriptions (id, consultationId, doctorId, patientId, state, diagnosis, symptoms, advice, approvedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
            [
              id,
              create.consultationId,
              create.doctorId,
              create.patientId,
              create.state,
              create.diagnosis,
              create.symptoms,
              create.advice
            ]
          );
          if (itemsToInsert.length > 0) {
            for (const item of itemsToInsert) {
              await this.db.run(
                `INSERT INTO prescription_items (id, prescriptionId, medicineName, dosage, frequency, duration, instructions)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                  `item-${Date.now()}-${Math.random().toString(36).substring(7)}`,
                  id,
                  item.medicineName,
                  item.dosage,
                  item.frequency,
                  item.duration,
                  item.instructions || ''
                ]
              );
            }
          }
          p = await this.db.get('SELECT * FROM prescriptions WHERE id = ?', [id]);
        }
        if (include?.items) {
          p.items = await this.db.all('SELECT * FROM prescription_items WHERE prescriptionId = ?', [p.id]);
        }
        if (include?.doctor) {
          p.doctor = await this.db.get('SELECT * FROM users WHERE id = ?', [p.doctorId]);
        }
        if (include?.patient) {
          p.patient = await this.db.get('SELECT * FROM users WHERE id = ?', [p.patientId]);
        }
        return p;
      },
      update: async ({ where, data }: any) => {
        await this.db.run('UPDATE prescriptions SET state = ? WHERE id = ?', [data.state, where.id]);
        return this.db.get('SELECT * FROM prescriptions WHERE id = ?', [where.id]);
      }
    };
  }

  get prescriptionFile() {
    return {
      findFirst: async ({ where, include }: any) => {
        let f: any = null;
        let idVal = where?.id;
        let pIdVal = where?.prescriptionId;
        if (Array.isArray(where?.OR)) {
          for (const item of where.OR) {
            if (item.id) idVal = item.id;
            if (item.prescriptionId) pIdVal = item.prescriptionId;
          }
        }
        const lookup = pIdVal || idVal;
        if (lookup) {
          f = await this.db.get(
            `SELECT pf.* FROM prescription_files pf
             LEFT JOIN prescriptions p ON pf.prescriptionId = p.id
             WHERE pf.prescriptionId = ? OR pf.id = ? OR p.consultationId = ?
             ORDER BY pf.version DESC LIMIT 1`,
            [lookup, lookup, lookup]
          );
        } else if (where?.id) {
          f = await this.db.get('SELECT * FROM prescription_files WHERE id = ?', [where.id]);
        }
        if (!f) return null;

        // Ensure ciphertext Buffer is populated
        if (f.ciphertext && typeof f.ciphertext === 'string') {
          f.ciphertext = Buffer.from(f.ciphertext, 'hex');
        } else if (!f.ciphertext && f.storageKey) {
          const diskPath = path.resolve(__dirname, '../../data/storage', f.storageKey);
          if (fs.existsSync(diskPath)) {
            f.ciphertext = fs.readFileSync(diskPath);
          }
        }

        if (include?.prescription) {
          f.prescription = await this.db.get('SELECT * FROM prescriptions WHERE id = ?', [f.prescriptionId]);
        }
        if (include?.locks) {
          f.locks = await this.db.all('SELECT * FROM document_locks WHERE documentId = ? AND unlockedAt IS NULL', [f.id]);
        }
        return f;
      },
      findUnique: async ({ where, include }: any) => {
        let lookup = where?.id || where?.prescriptionId;
        if (Array.isArray(where?.OR)) {
          for (const item of where.OR) {
            if (item.id) lookup = item.id;
            if (item.prescriptionId) lookup = item.prescriptionId;
          }
        }
        let f = null;
        if (lookup) {
          f = await this.db.get('SELECT * FROM prescription_files WHERE id = ? OR prescriptionId = ?', [lookup, lookup]);
        }
        if (!f) return null;

        if (f.ciphertext && typeof f.ciphertext === 'string') {
          f.ciphertext = Buffer.from(f.ciphertext, 'hex');
        } else if (!f.ciphertext && f.storageKey) {
          const diskPath = path.resolve(__dirname, '../../data/storage', f.storageKey);
          if (fs.existsSync(diskPath)) {
            f.ciphertext = fs.readFileSync(diskPath);
          }
        }

        if (include?.prescription) {
          f.prescription = await this.db.get('SELECT * FROM prescriptions WHERE id = ?', [f.prescriptionId]);
        }
        if (include?.locks) {
          f.locks = await this.db.all('SELECT * FROM document_locks WHERE documentId = ? AND unlockedAt IS NULL', [f.id]);
        }
        return f;
      },
      create: async ({ data }: any) => {
        const id = generateId('file');
        let ciphertextHex = null;
        if (data.ciphertext) {
          const buf = Buffer.isBuffer(data.ciphertext) ? data.ciphertext : Buffer.from(data.ciphertext);
          ciphertextHex = buf.toString('hex');

          // Persist directly to storage disk
          const diskPath = path.resolve(__dirname, '../../data/storage', data.storageKey);
          fs.mkdirSync(path.dirname(diskPath), { recursive: true });
          fs.writeFileSync(diskPath, buf);
        }

        await this.db.run(
          `INSERT INTO prescription_files (
            id, prescriptionId, version, storageKey, fileName, fileSizeBytes,
            ciphertext, iv, authTag, wrappedKey, keyId, encryptionAlgo, sha256Hash,
            blockchainTxId, blockchainTimestamp, securityStatus, isReady
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            data.prescriptionId,
            data.version || 1,
            data.storageKey,
            data.fileName,
            data.fileSizeBytes,
            ciphertextHex,
            data.iv,
            data.authTag,
            data.wrappedKey,
            data.keyId,
            data.encryptionAlgo || 'aes-256-gcm',
            data.sha256Hash,
            data.blockchainTxId || null,
            data.blockchainTimestamp instanceof Date ? data.blockchainTimestamp.toISOString() : null,
            data.securityStatus || 'ACTIVE',
            data.isReady ? 1 : 0
          ]
        );
        const created = await this.db.get('SELECT * FROM prescription_files WHERE id = ?', [id]);
        if (created && created.ciphertext) {
          created.ciphertext = Buffer.from(created.ciphertext, 'hex');
        }
        return created;
      },
      update: async ({ where, data }: any) => {
        const updates: string[] = [];
        const values: any[] = [];
        for (const [key, val] of Object.entries(data)) {
          updates.push(`${key} = ?`);
          values.push(val instanceof Date ? val.toISOString() : val);
        }
        values.push(where.id);
        await this.db.run(`UPDATE prescription_files SET ${updates.join(', ')} WHERE id = ?`, values);
        return this.db.get('SELECT * FROM prescription_files WHERE id = ?', [where.id]);
      }
    };
  }

  get securityEvent() {
    return {
      create: async ({ data }: any) => {
        const id = generateId('event');
        await this.db.run(
          `INSERT INTO security_events (id, documentId, userId, type, severity, reason, ipAddress, userAgent, metadata)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            data.documentId || null,
            data.userId || null,
            data.type,
            data.severity || 'HIGH',
            data.reason,
            data.ipAddress || null,
            data.userAgent || null,
            data.metadata ? JSON.stringify(data.metadata) : null
          ]
        );
        return this.db.get('SELECT * FROM security_events WHERE id = ?', [id]);
      }
    };
  }

  get documentLock() {
    return {
      create: async ({ data }: any) => {
        const id = generateId('lock');
        await this.db.run(
          `INSERT INTO document_locks (id, documentId, reason, description, isRecoverable)
           VALUES (?, ?, ?, ?, ?)`,
          [id, data.documentId, data.reason, data.description || '', data.isRecoverable ? 1 : 0]
        );
        return this.db.get('SELECT * FROM document_locks WHERE id = ?', [id]);
      },
      updateMany: async ({ where, data }: any) => {
        return this.db.run(
          `UPDATE document_locks SET unlockedAt = ?, unlockedByUserId = ?, unlockMethod = ?
           WHERE documentId = ? AND isRecoverable = 1 AND unlockedAt IS NULL`,
          [
            data.unlockedAt instanceof Date ? data.unlockedAt.toISOString() : data.unlockedAt,
            data.unlockedByUserId,
            data.unlockMethod,
            where.documentId
          ]
        );
      },
      count: async ({ where }: any) => {
        const res = await this.db.get(
          'SELECT COUNT(*) as count FROM document_locks WHERE documentId = ? AND unlockedAt IS NULL',
          [where.documentId]
        );
        return res ? res.count : 0;
      }
    };
  }

  get otpChallenge() {
    return {
      findFirst: async ({ where, orderBy }: any) => {
        return this.db.get(
          `SELECT * FROM otp_challenges
           WHERE userId = ? AND documentId = ? AND isUsed = 0 AND purpose = ?
           ORDER BY createdAt DESC LIMIT 1`,
          [where.userId, where.documentId, where.purpose]
        );
      },
      create: async ({ data }: any) => {
        const id = generateId('otp');
        await this.db.run(
          `INSERT INTO otp_challenges (id, userId, documentId, codeHash, purpose, expiresAt, maxAttempts)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            data.userId,
            data.documentId || null,
            data.codeHash,
            data.purpose || 'DOCUMENT_RECOVERY',
            data.expiresAt instanceof Date ? data.expiresAt.toISOString() : data.expiresAt,
            data.maxAttempts || 3
          ]
        );
        return this.db.get('SELECT * FROM otp_challenges WHERE id = ?', [id]);
      },
      update: async ({ where, data }: any) => {
        const updates: string[] = [];
        const values: any[] = [];
        for (const [key, val] of Object.entries(data)) {
          if (typeof val === 'object' && val !== null && 'increment' in val) {
            updates.push(`${key} = ${key} + ${(val as any).increment}`);
          } else {
            updates.push(`${key} = ?`);
            values.push(val instanceof Date ? val.toISOString() : val);
          }
        }
        values.push(where.id);
        await this.db.run(`UPDATE otp_challenges SET ${updates.join(', ')} WHERE id = ?`, values);
        return this.db.get('SELECT * FROM otp_challenges WHERE id = ?', [where.id]);
      },
      updateMany: async ({ where, data }: any) => {
        return this.db.run(
          `UPDATE otp_challenges SET isUsed = ? WHERE userId = ? AND documentId = ? AND isUsed = 0`,
          [data.isUsed ? 1 : 0, where.userId, where.documentId]
        );
      }
    };
  }

  get auditLog() {
    return {
      create: async ({ data }: any) => {
        const id = generateId('audit');
        await this.db.run(
          `INSERT INTO audit_logs (id, userId, action, resourceType, resourceId, ipAddress, status, details)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            data.userId || null,
            data.action,
            data.resourceType,
            data.resourceId || null,
            data.ipAddress || null,
            data.status || 'SUCCESS',
            data.details ? JSON.stringify(data.details) : null
          ]
        );
        return this.db.get('SELECT * FROM audit_logs WHERE id = ?', [id]);
      }
    };
  }

  async $transaction<T>(fn: (tx: PrismaClient) => Promise<T>): Promise<T> {
    // In SQLite, serialized operations execute safely within the single connection.
    return fn(this);
  }
}
