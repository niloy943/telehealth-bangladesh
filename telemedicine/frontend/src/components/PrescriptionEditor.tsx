import React, { useState } from 'react';

export interface MedicineItem {
  id: string;
  medicineName: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
}

export interface PatientVitals {
  bp: string;
  pulse: string;
  temp: string;
  spO2: string;
  weight: string;
}

const COMMON_DIAGNOSES = [
  'Acute Upper Respiratory Infection',
  'Hypertension (Stage 1)',
  'Type 2 Diabetes Mellitus',
  'Acid Peptic Disorder / GERD',
  'Allergic Rhinitis',
  'Migraine with Aura',
  'Acute Gastroenteritis'
];

const MEDICINE_CATALOG = [
  { name: 'Napa Extend', defaultDose: '665mg' },
  { name: 'Seclo', defaultDose: '20mg' },
  { name: 'Fexo', defaultDose: '120mg' },
  { name: 'Metformin', defaultDose: '500mg' },
  { name: 'Amodis', defaultDose: '400mg' },
  { name: 'Azithrocin', defaultDose: '500mg' },
  { name: 'Montene', defaultDose: '10mg' },
  { name: 'Ciprocin', defaultDose: '500mg' }
];

export const PrescriptionEditor: React.FC<{
  consultationId: string;
  doctorId: string;
  patientId: string;
  patientName: string;
  onApproveSuccess?: (result: any) => void;
}> = ({ consultationId, doctorId, patientId, patientName, onApproveSuccess }) => {
  // Patient details state
  const [allergies] = useState<string[]>(['Penicillin (Mild Rash)', 'NSAIDs']);
  const [medicalHistory] = useState<string[]>(['Essential Hypertension (since 2021)', 'Occasional Acid Reflux']);
  const [vitals] = useState<PatientVitals>({
    bp: '128/84 mmHg',
    pulse: '76 bpm',
    temp: '98.4 °F',
    spO2: '99%',
    weight: '68 kg'
  });

  // Clinical formulation state
  const [symptoms, setSymptoms] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [advice, setAdvice] = useState('Drink plenty of warm water. Avoid dust exposure. Follow up in 7 days if symptoms persist.');

  // Medication items
  const [items, setItems] = useState<MedicineItem[]>([
    {
      id: '1',
      medicineName: 'Napa Extend',
      dosage: '665mg',
      frequency: '1+0+1 (After meal)',
      duration: '5 Days',
      instructions: 'Take after meal with warm water'
    }
  ]);

  // Current item builder form
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMed, setSelectedMed] = useState('');
  const [selectedDose, setSelectedDose] = useState('500mg');
  const [selectedFreq, setSelectedFreq] = useState('1+0+1 (After meal)');
  const [selectedDuration, setSelectedDuration] = useState('5 Days');
  const [selectedInstructions, setSelectedInstructions] = useState('Take after meal');

  // Security & Approval Modal
  const [showMfaModal, setShowMfaModal] = useState(false);
  const [totpCode, setTotpCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const [approvalResult, setApprovalResult] = useState<any>(null);

  const handleAddMedicine = () => {
    const medName = selectedMed || searchQuery.trim();
    if (!medName) return;

    const newItem: MedicineItem = {
      id: String(Date.now()),
      medicineName: medName,
      dosage: selectedDose,
      frequency: selectedFreq,
      duration: selectedDuration,
      instructions: selectedInstructions
    };

    setItems([...items, newItem]);
    setSearchQuery('');
    setSelectedMed('');
  };

  const handleRemoveMedicine = (id: string) => {
    setItems(items.filter((i) => i.id !== id));
  };

  const handleExecuteApproval = async () => {
    setIsSubmitting(true);
    setApprovalError(null);

    try {
      const response = await fetch('/api/doctor/prescriptions/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Doctor-ID': doctorId,
          'X-MFA-Code': totpCode
        },
        body: JSON.stringify({
          consultationId,
          patientId,
          diagnosis,
          symptoms,
          advice,
          mfaCode: totpCode,
          items: items.map(({ medicineName, dosage, frequency, duration, instructions }) => ({
            medicineName,
            dosage,
            frequency,
            duration,
            instructions
          }))
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Prescription approval rejected by server.');
      }

      setApprovalResult(data);
      setShowMfaModal(false);
      if (onApproveSuccess) onApproveSuccess(data);
    } catch (err: any) {
      setApprovalError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '20px', fontFamily: 'sans-serif' }}>
      {/* LEFT PANEL: Patient Information, Allergies & Vitals */}
      <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
        <div style={{ borderBottom: '2px solid #0284c7', paddingBottom: '8px', marginBottom: '14px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', color: '#0369a1' }}>Patient Chart</h3>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>{patientName}</div>
          <div style={{ fontSize: '11px', color: '#64748b' }}>ID: {patientId}</div>
        </div>

        {/* Vitals */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>CLINICAL VITALS</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px' }}>
            <div style={{ background: '#fff', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
              <div style={{ color: '#64748b', fontSize: '10px' }}>Blood Pressure</div>
              <strong>{vitals.bp}</strong>
            </div>
            <div style={{ background: '#fff', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
              <div style={{ color: '#64748b', fontSize: '10px' }}>Heart Rate</div>
              <strong>{vitals.pulse}</strong>
            </div>
            <div style={{ background: '#fff', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
              <div style={{ color: '#64748b', fontSize: '10px' }}>Temperature</div>
              <strong>{vitals.temp}</strong>
            </div>
            <div style={{ background: '#fff', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
              <div style={{ color: '#64748b', fontSize: '10px' }}>SpO2</div>
              <strong>{vitals.spO2}</strong>
            </div>
          </div>
        </div>

        {/* Known Allergies */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#b91c1c', marginBottom: '6px' }}>KNOWN ALLERGIES</div>
          {allergies.map((allg, idx) => (
            <div key={idx} style={{ background: '#fee2e2', color: '#991b1b', fontSize: '11px', padding: '4px 8px', borderRadius: '4px', marginBottom: '4px', fontWeight: 600 }}>
              ⚠️ {allg}
            </div>
          ))}
        </div>

        {/* Medical History */}
        <div>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>CHRONIC CONDITIONS</div>
          {medicalHistory.map((hist, idx) => (
            <div key={idx} style={{ fontSize: '12px', color: '#334155', padding: '3px 0' }}>
              • {hist}
            </div>
          ))}
        </div>

        {/* Security Access Badge */}
        <div style={{ marginTop: '24px', padding: '10px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '8px', fontSize: '11px', color: '#065f46' }}>
          🛡️ <strong>Server-Enforced Access Grant:</strong> Active consultation window. Revokes immediately upon prescription approval.
        </div>
      </div>

      {/* RIGHT PANEL: Prescription Formulation Desk */}
      <div style={{ background: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', marginBottom: '16px' }}>
          <h2 style={{ margin: 0, fontSize: '18px', color: '#0f172a' }}>Digital E-Prescription Desk</h2>
          <span style={{ fontSize: '12px', background: '#e0f2fe', color: '#0369a1', padding: '4px 8px', borderRadius: '6px', fontWeight: 600 }}>
            Session: {consultationId}
          </span>
        </div>

        {/* Symptoms & Diagnosis */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
              Presenting Symptoms
            </label>
            <input
              type="text"
              placeholder="e.g. Dry cough, fever for 3 days, sore throat"
              value={symptoms}
              onChange={(e) => setSymptoms(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
              Clinical Diagnosis
            </label>
            <input
              type="text"
              placeholder="Type or select diagnosis below"
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }}
            />
          </div>
        </div>

        {/* Quick Diagnosis Templates */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' }}>
          {COMMON_DIAGNOSES.map((d, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setDiagnosis(d)}
              style={{ fontSize: '11px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '3px 8px', cursor: 'pointer' }}
            >
              + {d}
            </button>
          ))}
        </div>

        {/* Medication Formulation Form */}
        <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>Add Medication (Rx)</div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.5fr 1fr', gap: '10px', marginBottom: '10px' }}>
            <div>
              <label style={{ fontSize: '11px', color: '#475569' }}>Medicine Name</label>
              <input
                type="text"
                placeholder="Search catalog..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: '100%', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px' }}
              />
              {searchQuery && (
                <div style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', marginTop: '4px', maxHeight: '100px', overflowY: 'auto' }}>
                  {MEDICINE_CATALOG.filter((m) => m.name.toLowerCase().includes(searchQuery.toLowerCase())).map((m, idx) => (
                    <div
                      key={idx}
                      onClick={() => {
                        setSelectedMed(m.name);
                        setSelectedDose(m.defaultDose);
                        setSearchQuery(m.name);
                      }}
                      style={{ padding: '4px 8px', fontSize: '12px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }}
                    >
                      {m.name} ({m.defaultDose})
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label style={{ fontSize: '11px', color: '#475569' }}>Dosage</label>
              <select
                value={selectedDose}
                onChange={(e) => setSelectedDose(e.target.value)}
                style={{ width: '100%', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px' }}
              >
                <option value="500mg">500mg</option>
                <option value="665mg">665mg</option>
                <option value="20mg">20mg</option>
                <option value="120mg">120mg</option>
                <option value="10mg">10mg</option>
                <option value="1 drop">1 drop</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '11px', color: '#475569' }}>Frequency</label>
              <select
                value={selectedFreq}
                onChange={(e) => setSelectedFreq(e.target.value)}
                style={{ width: '100%', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px' }}
              >
                <option value="1+0+1 (After meal)">1+0+1 (After meal)</option>
                <option value="1+1+1 (After meal)">1+1+1 (After meal)</option>
                <option value="0+0+1 (At bedtime)">0+0+1 (At bedtime)</option>
                <option value="1+0+0 (Before breakfast)">1+0+0 (Before breakfast)</option>
                <option value="As needed (SOS)">As needed (SOS)</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '11px', color: '#475569' }}>Duration</label>
              <select
                value={selectedDuration}
                onChange={(e) => setSelectedDuration(e.target.value)}
                style={{ width: '100%', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px' }}
              >
                <option value="3 Days">3 Days</option>
                <option value="5 Days">5 Days</option>
                <option value="7 Days">7 Days</option>
                <option value="14 Days">14 Days</option>
                <option value="1 Month">1 Month</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <input
              type="text"
              placeholder="Instructions (e.g. Swallow with water, do not crush)"
              value={selectedInstructions}
              onChange={(e) => setSelectedInstructions(e.target.value)}
              style={{ flex: 1, padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px' }}
            />
            <button
              type="button"
              onClick={handleAddMedicine}
              style={{ background: '#0284c7', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 14px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
            >
              + Add to Rx
            </button>
          </div>
        </div>

        {/* Formulated Medication Table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px' }}>
          <thead>
            <tr style={{ background: '#f1f5f9', textAlign: 'left', fontSize: '12px', color: '#475569' }}>
              <th style={{ padding: '8px' }}>Medication</th>
              <th style={{ padding: '8px' }}>Dosage</th>
              <th style={{ padding: '8px' }}>Frequency</th>
              <th style={{ padding: '8px' }}>Duration</th>
              <th style={{ padding: '8px' }}>Instructions</th>
              <th style={{ padding: '8px', textAlign: 'center' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((m) => (
              <tr key={m.id} style={{ borderBottom: '1px solid #e2e8f0', fontSize: '13px' }}>
                <td style={{ padding: '8px', fontWeight: 600 }}>{m.medicineName}</td>
                <td style={{ padding: '8px' }}>{m.dosage}</td>
                <td style={{ padding: '8px' }}>{m.frequency}</td>
                <td style={{ padding: '8px' }}>{m.duration}</td>
                <td style={{ padding: '8px', color: '#64748b' }}>{m.instructions}</td>
                <td style={{ padding: '8px', textAlign: 'center' }}>
                  <button
                    onClick={() => handleRemoveMedicine(m.id)}
                    style={{ background: '#fee2e2', color: '#b91c1c', border: 'none', borderRadius: '4px', padding: '2px 6px', fontSize: '11px', cursor: 'pointer' }}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Doctor's Advice */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
            Doctor's Advice & Lifestyle Guidelines
          </label>
          <textarea
            rows={2}
            value={advice}
            onChange={(e) => setAdvice(e.target.value)}
            style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }}
          />
        </div>

        {/* Action Button: Trigger Google Authenticator Signature Modal */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '12px', color: '#64748b' }}>
            🔒 Approving triggers AES-256-GCM encryption, Hyperledger Fabric hash anchoring, and revokes doctor access.
          </div>
          <button
            type="button"
            onClick={() => setShowMfaModal(true)}
            disabled={!diagnosis || items.length === 0}
            style={{
              background: '#059669',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 20px',
              fontSize: '14px',
              fontWeight: 700,
              cursor: (!diagnosis || items.length === 0) ? 'not-allowed' : 'pointer',
              opacity: (!diagnosis || items.length === 0) ? 0.6 : 1
            }}
          >
            Approve & Sign Prescription (Google 2FA)
          </button>
        </div>

        {/* SUCCESS SUMMARY */}
        {approvalResult && (
          <div style={{ marginTop: '20px', padding: '16px', background: '#ecfdf5', border: '1px solid #10b981', borderRadius: '8px' }}>
            <h4 style={{ margin: '0 0 8px 0', color: '#065f46' }}>✅ Prescription Approved, Encrypted & Anchored!</h4>
            <div style={{ fontSize: '12px', color: '#047857' }}>
              <div>Prescription ID: <strong>{approvalResult.prescriptionId}</strong></div>
              <div>Blockchain SHA-256 Digest: <code>{approvalResult.sha256Hash}</code></div>
              <div>Fabric Anchor TxID: <code>{approvalResult.blockchainTxId}</code></div>
              <div style={{ marginTop: '8px', fontWeight: 600 }}>Doctor Consultation Grant Status: REVOKED (Access terminated)</div>
            </div>
          </div>
        )}
      </div>

      {/* GOOGLE AUTHENTICATOR MFA MODAL */}
      {showMfaModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', width: '380px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 8px 0', color: '#0f172a' }}>Google Authenticator Signature</h3>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 16px 0' }}>
              To finalize and cryptographically sign this prescription, enter the 6-digit verification code from your Google Authenticator app.
            </p>

            {approvalError && (
              <div style={{ background: '#fee2e2', color: '#991b1b', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', marginBottom: '12px' }}>
                {approvalError}
              </div>
            )}

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                6-DIGIT CODE
              </label>
              <input
                type="text"
                maxLength={6}
                placeholder="123456"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                style={{ width: '100%', fontSize: '20px', letterSpacing: '4px', textAlign: 'center', padding: '10px', border: '2px solid #0284c7', borderRadius: '8px', fontWeight: 700 }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setShowMfaModal(false)}
                style={{ padding: '8px 14px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteApproval}
                disabled={totpCode.length !== 6 || isSubmitting}
                style={{
                  padding: '8px 16px',
                  background: '#0284c7',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: (totpCode.length !== 6 || isSubmitting) ? 'not-allowed' : 'pointer'
                }}
              >
                {isSubmitting ? 'Signing & Anchoring...' : 'Confirm & Sign'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

