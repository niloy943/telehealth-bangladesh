import sqlite3 from '/Users/mdniloy/Downloads/telehealth bangladesh/telehealth-bangladesh/node-backend/node_modules/sqlite3/lib/sqlite3.js';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE = path.resolve(__dirname, '../../data/telemedicine.db');

export class SQLiteDatabase {
  private db: any;

  constructor() {
    const dir = path.dirname(DB_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.db = new (sqlite3 as any).Database(DB_FILE);
  }

  async run(sql: string, params: any[] = []): Promise<any> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function (this: any, err: any) {
        if (err) return reject(err);
        resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }

  async get<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err: any, row: any) => {
        if (err) return reject(err);
        resolve(row || null);
      });
    });
  }

  async all<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err: any, rows: any) => {
        if (err) return reject(err);
        resolve(rows || []);
      });
    });
  }

  /**
   * Initializes all 10 security tables and seeds demo accounts
   */
  async initSchema() {
    await this.run(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        phone TEXT UNIQUE,
        name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'PATIENT',
        passwordHash TEXT NOT NULL,
        doctorLicense TEXT,
        isVerified INTEGER DEFAULT 0,
        mfaSecret TEXT,
        mfaEnabled INTEGER DEFAULT 0,
        mfaBackupCodes TEXT,
        lastTotpStep INTEGER,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await this.run(`
      CREATE TABLE IF NOT EXISTS consultations (
        id TEXT PRIMARY KEY,
        doctorId TEXT NOT NULL,
        patientId TEXT NOT NULL,
        roomName TEXT UNIQUE NOT NULL,
        status TEXT NOT NULL DEFAULT 'SCHEDULED',
        scheduledAt TEXT NOT NULL,
        startedAt TEXT,
        endedAt TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (doctorId) REFERENCES users(id),
        FOREIGN KEY (patientId) REFERENCES users(id)
      );
    `);

    await this.run(`
      CREATE TABLE IF NOT EXISTS consultation_grants (
        id TEXT PRIMARY KEY,
        consultationId TEXT NOT NULL,
        doctorId TEXT NOT NULL,
        patientId TEXT NOT NULL,
        grantedAt TEXT DEFAULT CURRENT_TIMESTAMP,
        expiresAt TEXT NOT NULL,
        revokedAt TEXT,
        revocationReason TEXT,
        FOREIGN KEY (consultationId) REFERENCES consultations(id),
        FOREIGN KEY (doctorId) REFERENCES users(id)
      );
    `);

    await this.run(`
      CREATE TABLE IF NOT EXISTS prescriptions (
        id TEXT PRIMARY KEY,
        consultationId TEXT UNIQUE NOT NULL,
        doctorId TEXT NOT NULL,
        patientId TEXT NOT NULL,
        state TEXT NOT NULL DEFAULT 'DRAFT',
        version INTEGER DEFAULT 1,
        diagnosis TEXT,
        symptoms TEXT,
        advice TEXT,
        approvedAt TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (consultationId) REFERENCES consultations(id),
        FOREIGN KEY (doctorId) REFERENCES users(id),
        FOREIGN KEY (patientId) REFERENCES users(id)
      );
    `);

    await this.run(`
      CREATE TABLE IF NOT EXISTS prescription_items (
        id TEXT PRIMARY KEY,
        prescriptionId TEXT NOT NULL,
        medicineName TEXT NOT NULL,
        dosage TEXT NOT NULL,
        frequency TEXT NOT NULL,
        duration TEXT NOT NULL,
        instructions TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (prescriptionId) REFERENCES prescriptions(id) ON DELETE CASCADE
      );
    `);

    await this.run(`
      CREATE TABLE IF NOT EXISTS prescription_files (
        id TEXT PRIMARY KEY,
        prescriptionId TEXT NOT NULL,
        version INTEGER DEFAULT 1,
        storageKey TEXT NOT NULL,
        fileName TEXT NOT NULL,
        fileSizeBytes INTEGER NOT NULL,
        mimeType TEXT DEFAULT 'application/pdf',
        ciphertext BLOB,
        iv TEXT NOT NULL,
        authTag TEXT NOT NULL,
        wrappedKey TEXT NOT NULL,
        keyId TEXT NOT NULL,
        encryptionAlgo TEXT DEFAULT 'aes-256-gcm',
        sha256Hash TEXT NOT NULL,
        blockchainTxId TEXT,
        blockchainTimestamp TEXT,
        securityStatus TEXT DEFAULT 'ACTIVE',
        isReady INTEGER DEFAULT 0,
        lockedAt TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (prescriptionId) REFERENCES prescriptions(id) ON DELETE CASCADE
      );
    `);

    await this.run(`
      CREATE TABLE IF NOT EXISTS security_events (
        id TEXT PRIMARY KEY,
        documentId TEXT,
        userId TEXT,
        type TEXT NOT NULL,
        severity TEXT DEFAULT 'HIGH',
        reason TEXT NOT NULL,
        ipAddress TEXT,
        userAgent TEXT,
        metadata TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await this.run(`
      CREATE TABLE IF NOT EXISTS document_locks (
        id TEXT PRIMARY KEY,
        documentId TEXT NOT NULL,
        reason TEXT NOT NULL,
        description TEXT,
        isRecoverable INTEGER DEFAULT 1,
        unlockedAt TEXT,
        unlockedByUserId TEXT,
        unlockMethod TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (documentId) REFERENCES prescription_files(id) ON DELETE CASCADE
      );
    `);

    await this.run(`
      CREATE TABLE IF NOT EXISTS otp_challenges (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        documentId TEXT,
        codeHash TEXT NOT NULL,
        purpose TEXT DEFAULT 'DOCUMENT_RECOVERY',
        expiresAt TEXT NOT NULL,
        attempts INTEGER DEFAULT 0,
        maxAttempts INTEGER DEFAULT 3,
        isUsed INTEGER DEFAULT 0,
        usedAt TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    await this.run(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        userId TEXT,
        action TEXT NOT NULL,
        resourceType TEXT NOT NULL,
        resourceId TEXT,
        ipAddress TEXT,
        status TEXT DEFAULT 'SUCCESS',
        details TEXT,
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Seed default verified Doctor and Patient accounts
    await this.seedDefaults();
  }

  private async seedDefaults() {
    const existing = await this.get('SELECT COUNT(*) as count FROM users');
    if (existing && existing.count > 0) return;

    // Doctor: Dr. Sarah Jenkins (General Medicine)
    await this.run(
      `INSERT INTO users (id, email, phone, name, role, passwordHash, doctorLicense, isVerified, mfaEnabled)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0)`,
      [
        'doc-sarah-101',
        'sarah@healnsight.com.bd',
        '+8801711000001',
        'Dr. Sarah Jenkins',
        'DOCTOR',
        'password123',
        'BMDC-A-94821'
      ]
    );

    // Doctor: Dr. Zara Ahmed (Cardiology)
    await this.run(
      `INSERT INTO users (id, email, phone, name, role, passwordHash, doctorLicense, isVerified, mfaEnabled)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0)`,
      [
        'doc-zara-102',
        'zara@healnsight.com.bd',
        '+8801711000002',
        'Dr. Zara Ahmed',
        'DOCTOR',
        'password123',
        'BMDC-A-81204'
      ]
    );

    // Patient: Niloy Hasan
    await this.run(
      `INSERT INTO users (id, email, phone, name, role, passwordHash, isVerified)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [
        'pat-niloy-201',
        'niloy@healnsight.com.bd',
        '+8801811000001',
        'Niloy Hasan',
        'PATIENT',
        'password123'
      ]
    );

    // Patient: Sadia Kader
    await this.run(
      `INSERT INTO users (id, email, phone, name, role, passwordHash, isVerified)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [
        'pat-sadia-202',
        'sadia@healnsight.com.bd',
        '+8801811000002',
        'Sadia Kader',
        'PATIENT',
        'password123'
      ]
    );

    // Create an initial Consultation
    await this.run(
      `INSERT INTO consultations (id, doctorId, patientId, roomName, status, scheduledAt)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`,
      [
        'cons-demo-301',
        'doc-sarah-101',
        'pat-niloy-201',
        'room-telehealth-niloy-sarah',
        'ACTIVE'
      ]
    );

    // Issue initial active Consultation Grant (60 min)
    await this.run(
      `INSERT INTO consultation_grants (id, consultationId, doctorId, patientId, expiresAt)
       VALUES (?, ?, ?, ?, datetime('now', '+60 minutes'))`,
      [
        'grant-demo-401',
        'cons-demo-301',
        'doc-sarah-101',
        'pat-niloy-201'
      ]
    );
  }
}

