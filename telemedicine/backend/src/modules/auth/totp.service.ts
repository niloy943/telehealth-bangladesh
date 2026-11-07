import { randomBytes, createHmac, timingSafeEqual, createHash } from 'node:crypto';

export interface TotpSetupResult {
  secret: string; // Base32 secret for Google Authenticator
  otpauthUri: string; // otpauth:// URI
  qrCodeUrl: string; // Data URI / Google Chart API compatible link
  backupCodes: string[]; // 8 one-time emergency recovery codes
  backupCodesHashed: string[];
}

export interface TotpVerifyResult {
  valid: boolean;
  step?: bigint;
  error?: string;
}

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export class TotpService {
  /**
   * Encodes a Buffer into RFC 4648 Base32 (used by Google Authenticator)
   */
  static base32Encode(buffer: Buffer): string {
    let bits = 0;
    let value = 0;
    let output = '';
    for (let i = 0; i < buffer.length; i++) {
      value = (value << 8) | buffer[i];
      bits += 8;
      while (bits >= 5) {
        output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
        bits -= 5;
      }
    }
    if (bits > 0) {
      output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
    }
    return output;
  }

  /**
   * Decodes an RFC 4648 Base32 string into a Buffer
   */
  static base32Decode(base32: string): Buffer {
    let bits = 0;
    let value = 0;
    const output: number[] = [];
    const clean = base32.toUpperCase().replace(/[\s=-]/g, '');

    for (let i = 0; i < clean.length; i++) {
      const idx = BASE32_ALPHABET.indexOf(clean[i]);
      if (idx === -1) {
        throw new Error(`Invalid Base32 character encountered: '${clean[i]}'`);
      }
      value = (value << 5) | idx;
      bits += 5;
      if (bits >= 8) {
        output.push((value >>> (bits - 8)) & 255);
        bits -= 8;
      }
    }
    return Buffer.from(output);
  }

  /**
   * Generates a new 20-byte (160-bit) TOTP Secret and QR setup for Google Authenticator.
   */
  generateSetup(userEmail: string, issuer: string = 'HealNSight'): TotpSetupResult {
    // 160-bit key recommended by RFC 4226 / RFC 6238
    const rawSecret = randomBytes(20);
    const secret = TotpService.base32Encode(rawSecret);

    const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(userEmail)}`;
    const otpauthUri = `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;

    // Standard QR code URL (or canvas/SVG generator)
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(otpauthUri)}`;

    // Generate 8 emergency backup codes (format: xxxx-xxxx)
    const backupCodes: string[] = [];
    const backupCodesHashed: string[] = [];
    for (let i = 0; i < 8; i++) {
      const code = `${randomBytes(2).toString('hex')}-${randomBytes(2).toString('hex')}`;
      backupCodes.push(code);
      backupCodesHashed.push(createHash('sha256').update(code).digest('hex'));
    }

    return {
      secret,
      otpauthUri,
      qrCodeUrl,
      backupCodes,
      backupCodesHashed
    };
  }

  /**
   * Computes RFC 6238 6-digit TOTP token for a given time step counter.
   */
  computeToken(secretBase32: string, timeStep: bigint | number): string {
    const key = TotpService.base32Decode(secretBase32);
    const counter = Buffer.alloc(8);
    counter.writeBigInt64BE(BigInt(timeStep));

    const hmac = createHmac('sha1', key).update(counter).digest();
    const offset = hmac[hmac.length - 1] & 0x0f;

    const binary =
      ((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff);

    const otp = (binary % 1000000).toString().padStart(6, '0');
    return otp;
  }

  /**
   * Verifies a 6-digit Google Authenticator TOTP token.
   * Includes:
   * - Strict 6-digit regex format validation
   * - ±1 time-step drift tolerance (prev/current/next 30s window)
   * - Constant-time comparison (timingSafeEqual)
   * - Replay attack prevention (verifies step > lastUsedStep)
   */
  verifyToken(
    secretBase32: string,
    candidateToken: string,
    lastUsedStep?: bigint | number,
    windowSteps: number = 1
  ): TotpVerifyResult {
    if (!candidateToken || !/^\d{6}$/.test(candidateToken.trim())) {
      return { valid: false, error: 'Token must be exactly 6 digits.' };
    }

    const trimmed = candidateToken.trim();
    const currentStep = BigInt(Math.floor(Date.now() / 1000 / 30));

    // Check window [-windowSteps, ..., +windowSteps]
    for (let i = -windowSteps; i <= windowSteps; i++) {
      const step = currentStep + BigInt(i);

      // Replay prevention: do not allow using the same token step again
      if (lastUsedStep !== undefined && lastUsedStep !== null && step <= BigInt(lastUsedStep)) {
        continue;
      }

      const expected = this.computeToken(secretBase32, step);

      // Constant-time comparison
      const bufExpected = Buffer.from(expected);
      const bufCandidate = Buffer.from(trimmed);
      if (bufExpected.length === bufCandidate.length && timingSafeEqual(bufExpected, bufCandidate)) {
        return {
          valid: true,
          step
        };
      }
    }

    return {
      valid: false,
      error: 'Invalid or expired Google Authenticator code.'
    };
  }

  /**
   * Verifies an emergency backup recovery code.
   */
  verifyBackupCode(
    backupCodesHashed: string[],
    candidateCode: string
  ): { valid: boolean; remainingHashedCodes: string[] } {
    const candidateHash = createHash('sha256').update(candidateCode.trim()).digest('hex');
    const index = backupCodesHashed.indexOf(candidateHash);

    if (index !== -1) {
      const remaining = [...backupCodesHashed];
      remaining.splice(index, 1);
      return { valid: true, remainingHashedCodes: remaining };
    }

    return { valid: false, remainingHashedCodes: backupCodesHashed };
  }
}

