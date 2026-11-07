import React, { useState } from 'react';

export interface PatientPrescriptionItem {
  id: string;
  doctorName: string;
  doctorSpecialty: string;
  date: string;
  diagnosis: string;
  securityStatus: 'ACTIVE' | 'LOCKED' | 'QUARANTINED';
  blockchainTxId?: string;
  sha256Hash?: string;
}

export const PatientPrescriptionViewer: React.FC<{
  patientId: string;
  prescriptions: PatientPrescriptionItem[];
}> = ({ patientId, prescriptions }) => {
  const [activePrescriptions, setActivePrescriptions] = useState(prescriptions);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Security Lockout / OTP Recovery Modal State
  const [lockedDocId, setLockedDocId] = useState<string | null>(null);
  const [lockStatus, setLockStatus] = useState<'LOCKED' | 'QUARANTINED'>('LOCKED');
  const [recoveryMethod, setRecoveryMethod] = useState<'TOTP' | 'OTP'>('TOTP');
  const [inputCode, setInputCode] = useState('');
  const [otpSentMessage, setOtpSentMessage] = useState<string | null>(null);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const handleDownload = async (prescriptionId: string) => {
    setDownloadingId(prescriptionId);
    try {
      const response = await fetch(`/api/patient/prescriptions/${prescriptionId}/download`, {
        method: 'GET',
        headers: {
          'X-Patient-ID': patientId
        }
      });

      if (response.status === 403 || response.status === 401) {
        const errJson = await response.json();
        const msg = errJson.error || '';
        const isQuarantined = msg.includes('Quarantined') || msg.includes('integrity');

        setLockedDocId(prescriptionId);
        setLockStatus(isQuarantined ? 'QUARANTINED' : 'LOCKED');
        setRecoveryError(msg);
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to retrieve prescription.');
      }

      // Stream decrypted PDF bytes directly to patient
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `prescription-${prescriptionId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || 'Download error');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleRequestEmailOtp = async () => {
    if (!lockedDocId) return;
    try {
      const res = await fetch(`/api/security/prescriptions/${lockedDocId}/request-otp`, {
        method: 'POST',
        headers: { 'X-Patient-ID': patientId }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setOtpSentMessage(`A single-use 6-digit code has been dispatched. Expires in 5 minutes.`);
      if (data.devCode) {
        setOtpSentMessage(`Code sent! (Dev simulation code: ${data.devCode})`);
      }
    } catch (err: any) {
      setRecoveryError(err.message);
    }
  };

  const handleVerifyUnlock = async () => {
    if (!lockedDocId || inputCode.length !== 6) return;
    setIsVerifying(true);
    setRecoveryError(null);

    const endpoint = recoveryMethod === 'TOTP'
      ? `/api/security/prescriptions/${lockedDocId}/verify-totp`
      : `/api/security/prescriptions/${lockedDocId}/verify-otp`;

    const bodyPayload = recoveryMethod === 'TOTP'
      ? { totpCode: inputCode }
      : { otpCode: inputCode };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Patient-ID': patientId
        },
        body: JSON.stringify(bodyPayload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Successfully unlocked! Update local state
      setActivePrescriptions((prev) =>
        prev.map((p) => (p.id === lockedDocId ? { ...p, securityStatus: 'ACTIVE' } : p))
      );
      setLockedDocId(null);
      setInputCode('');
      alert('Security verification passed. Document access restored! You may now download the prescription.');
    } catch (err: any) {
      setRecoveryError(err.message);
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <div style={{ borderBottom: '2px solid #0284c7', paddingBottom: '12px', marginBottom: '20px' }}>
        <h2 style={{ margin: 0, color: '#0f172a' }}>My Verified Prescriptions</h2>
        <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
          Protected by AES-256-GCM Envelope Encryption & Hyperledger Fabric Integrity Verification.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {activePrescriptions.map((p) => (
          <div
            key={p.id}
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '16px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ fontWeight: 700, fontSize: '15px', color: '#1e293b' }}>{p.doctorName}</span>
                <span style={{ fontSize: '12px', color: '#64748b' }}>({p.doctorSpecialty})</span>
                {p.securityStatus === 'ACTIVE' && (
                  <span style={{ background: '#ecfdf5', color: '#065f46', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                    🔒 SECURE
                  </span>
                )}
                {p.securityStatus === 'LOCKED' && (
                  <span style={{ background: '#fef3c7', color: '#92400e', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                    ⚠️ LOCKED
                  </span>
                )}
                {p.securityStatus === 'QUARANTINED' && (
                  <span style={{ background: '#fee2e2', color: '#991b1b', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                    🚫 QUARANTINED
                  </span>
                )}
              </div>

              <div style={{ fontSize: '13px', color: '#475569', marginBottom: '6px' }}>
                Diagnosis: <strong>{p.diagnosis}</strong> • Date: {p.date}
              </div>

              <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                Prescription ID: <code>{p.id}</code>
                {p.blockchainTxId && ` • Blockchain Tx: ${p.blockchainTxId.slice(0, 16)}...`}
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleDownload(p.id)}
              disabled={downloadingId === p.id}
              style={{
                background: p.securityStatus === 'QUARANTINED' ? '#94a3b8' : '#0284c7',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 16px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: p.securityStatus === 'QUARANTINED' ? 'not-allowed' : 'pointer'
              }}
            >
              {downloadingId === p.id ? 'Decrypting...' : 'Download PDF'}
            </button>
          </div>
        ))}
      </div>

      {/* SECURITY LOCKOUT / RECOVERY MODAL */}
      {lockedDocId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', width: '420px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 8px 0', color: lockStatus === 'QUARANTINED' ? '#991b1b' : '#0f172a' }}>
              {lockStatus === 'QUARANTINED' ? '🚫 Critical Integrity Quarantine' : '🔒 Access Temporarily Locked'}
            </h3>

            <p style={{ fontSize: '12px', color: '#475569', margin: '0 0 14px 0' }}>
              {lockStatus === 'QUARANTINED'
                ? 'This document failed blockchain cryptographic hash verification. For patient safety, it has been quarantined and cannot be unlocked via OTP. An administrator must investigate.'
                : 'Access to this prescription has been locked following unusual access activity. Please verify your identity to restore access.'}
            </p>

            {recoveryError && (
              <div style={{ background: '#fee2e2', color: '#991b1b', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', marginBottom: '14px' }}>
                {recoveryError}
              </div>
            )}

            {lockStatus !== 'QUARANTINED' && (
              <>
                {/* Method selector */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                  <button
                    type="button"
                    onClick={() => { setRecoveryMethod('TOTP'); setOtpSentMessage(null); }}
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 600,
                      border: recoveryMethod === 'TOTP' ? '2px solid #0284c7' : '1px solid #cbd5e1',
                      background: recoveryMethod === 'TOTP' ? '#e0f2fe' : '#fff',
                      cursor: 'pointer'
                    }}
                  >
                    Google Authenticator
                  </button>
                  <button
                    type="button"
                    onClick={() => { setRecoveryMethod('OTP'); handleRequestEmailOtp(); }}
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 600,
                      border: recoveryMethod === 'OTP' ? '2px solid #0284c7' : '1px solid #cbd5e1',
                      background: recoveryMethod === 'OTP' ? '#e0f2fe' : '#fff',
                      cursor: 'pointer'
                    }}
                  >
                    6-Digit Email/SMS Code
                  </button>
                </div>

                {otpSentMessage && (
                  <div style={{ background: '#ecfdf5', color: '#065f46', padding: '8px', borderRadius: '6px', fontSize: '11px', marginBottom: '12px' }}>
                    {otpSentMessage}
                  </div>
                )}

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                    {recoveryMethod === 'TOTP' ? 'ENTER 6-DIGIT GOOGLE AUTHENTICATOR CODE' : 'ENTER 6-DIGIT OTP CODE'}
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="123456"
                    value={inputCode}
                    onChange={(e) => setInputCode(e.target.value.replace(/\D/g, ''))}
                    style={{ width: '100%', fontSize: '20px', letterSpacing: '4px', textAlign: 'center', padding: '8px', border: '2px solid #0284c7', borderRadius: '8px', fontWeight: 700 }}
                  />
                </div>
              </>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setLockedDocId(null)}
                style={{ padding: '8px 14px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', cursor: 'pointer' }}
              >
                Close
              </button>
              {lockStatus !== 'QUARANTINED' && (
                <button
                  type="button"
                  onClick={handleVerifyUnlock}
                  disabled={inputCode.length !== 6 || isVerifying}
                  style={{
                    padding: '8px 16px',
                    background: '#0284c7',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: (inputCode.length !== 6 || isVerifying) ? 'not-allowed' : 'pointer'
                  }}
                >
                  {isVerifying ? 'Verifying...' : 'Verify & Unlock'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

