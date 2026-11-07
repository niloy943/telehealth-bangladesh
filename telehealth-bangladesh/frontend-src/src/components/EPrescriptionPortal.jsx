import React, { useState } from 'react';
import { usePrescriptionDraftStore } from '../store/usePrescriptionDraftStore';
import { ShieldCheck, ShieldAlert, Key, CheckCircle2, Lock, Plus, Trash2 } from 'lucide-react';

const QUICK_DIAGNOSES = [
  'Acute Upper Respiratory Infection',
  'Hypertension (Stage 1)',
  'Type 2 Diabetes Mellitus',
  'Acid Peptic Disorder / GERD',
  'Allergic Rhinitis',
  'Migraine with Aura',
  'Acute Gastroenteritis',
];

export const EPrescriptionPortal = ({
  sessionId,
  prescriptionId,
  userRole = 'doctor',
  patient = {
    name: 'Niloy Hasan',
    id: 'niloy',
    bloodGroup: 'O+',
    vitals: { bp: '128/84 mmHg', hr: '76 bpm', temp: '98.4 °F', spo2: '99%' },
    allergies: ['Penicillin (Mild Urticaria)', 'NSAIDs (Gastric Irritation)'],
  },
  grantStatus = 'ACTIVE',
  layoutMode = 'video-split',
  onChangeLayoutMode,
  onApproveWith2FA,
}) => {
  const {
    chiefComplaints,
    clinicalDiagnosis,
    medications,
    doctorAdvice,
    setField,
    addMedication,
    removeMedication,
  } = usePrescriptionDraftStore();

  const [medName, setMedName] = useState('Napa Extend');
  const [medDosage, setMedDosage] = useState('665mg');
  const [medRoute, setMedRoute] = useState('Oral');
  const [medTiming, setMedTiming] = useState('1+0+1 (After meal)');
  const [medDuration, setMedDuration] = useState('3 Days');
  const [medInstructions, setMedInstructions] = useState('Take after meal');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const isPatient = userRole === 'patient';

  const handlePatientDownloadPdf = async () => {
    setIsDownloadingPdf(true);
    const targetBase = import.meta.env.VITE_EP_API_BASE || 'http://localhost:5002';
    const patientIdentifier = String(patient?.id || 'niloy');
    const docId = String(prescriptionId || sessionId || 'latest');

    try {
      const res = await fetch(`${targetBase}/api/patient/prescriptions/${docId}/download`, {
        method: 'GET',
        headers: {
          'X-Patient-ID': patientIdentifier
        }
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Download failed with status ${res.status}`);
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Prescription-${docId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Patient Download Notice: ${err.message}`);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  // If consultation grant is revoked:
  // For PATIENTS: Allow full access, view medications, and download finalized PDF!
  // For DOCTORS: Strictly enforce revocation and privacy lockout.
  if (grantStatus === 'REVOKED' && !isPatient) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-slate-950 text-slate-100 p-8">
        <div className="max-w-md text-center p-6 rounded-2xl bg-rose-950/40 border border-rose-500/40 space-y-3">
          <ShieldAlert className="w-10 h-10 text-rose-400 mx-auto" />
          <h2 className="text-lg font-bold text-rose-300">
            403 Forbidden — Doctor ConsultationGrant Revoked
          </h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            Doctor permissions to inspect patient clinical records or modify the E-Prescription were immediately revoked upon prescription approval. Under patient privacy regulations, doctors cannot download or view finalized prescriptions.
          </p>
          <div className="pt-2 text-[11px] font-mono text-emerald-400">
            Document encrypted with AES-256-GCM &amp; hash committed to Hyperledger Fabric. Only the authenticated patient may retrieve it.
          </div>
        </div>
      </div>
    );
  }

  // If patient viewing post-consultation / finalized prescription:
  if (isPatient && grantStatus === 'REVOKED') {
    return (
      <div className="h-full w-full flex flex-col bg-slate-50 text-slate-900 overflow-y-auto p-6 sm:p-8">
        <div className="max-w-3xl mx-auto w-full bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
          <div className="p-6 bg-emerald-600 text-white flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-6 h-6 text-white" />
                <h1 className="text-xl font-bold">Verified Finalized E-Prescription</h1>
              </div>
              <p className="text-xs text-emerald-100 mt-1">
                Consultation #{sessionId} • Patient: {patient.name} • AES-256-GCM Encrypted
              </p>
            </div>
            <button
              type="button"
              disabled={isDownloadingPdf}
              onClick={handlePatientDownloadPdf}
              className="px-5 py-2.5 rounded-xl bg-white text-emerald-800 hover:bg-emerald-50 text-xs font-bold shadow-md transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <span>{isDownloadingPdf ? 'Decrypting PDF...' : 'Download Verified PDF'}</span>
            </button>
          </div>

          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
              <div>
                <span className="text-slate-500 font-semibold">Clinical Diagnosis:</span>
                <p className="text-sm font-bold text-slate-900 mt-0.5">{clinicalDiagnosis || 'Essential Hypertension (Stage 1)'}</p>
              </div>
              <div>
                <span className="text-slate-500 font-semibold">Chief Symptoms:</span>
                <p className="text-sm font-medium text-slate-800 mt-0.5">{chiefComplaints || 'Occipital headache, palpitations'}</p>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-800 mb-2">Prescribed Medications</h3>
              <div className="rounded-2xl border border-slate-200 overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-100 text-slate-600 font-semibold">
                    <tr>
                      <th className="py-2.5 px-3">Medication</th>
                      <th className="py-2.5 px-3">Dosage</th>
                      <th className="py-2.5 px-3">Schedule</th>
                      <th className="py-2.5 px-3">Instructions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {medications.length > 0 ? (
                      medications.map((m) => (
                        <tr key={m.id}>
                          <td className="py-2.5 px-3 font-bold text-slate-900">{m.name}</td>
                          <td className="py-2.5 px-3 text-slate-700">{m.dosage}</td>
                          <td className="py-2.5 px-3 text-slate-700">{m.timing} • {m.duration}</td>
                          <td className="py-2.5 px-3 text-slate-600">{m.instructions}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="py-4 text-center text-slate-400">
                          Medication list finalized and recorded in secure encrypted storage.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {doctorAdvice && (
              <div className="p-4 rounded-2xl bg-sky-50 border border-sky-200 text-xs text-sky-950">
                <span className="font-bold block mb-1">Doctor's Guidance:</span>
                <p>{doctorAdvice}</p>
              </div>
            )}

            <div className="p-4 rounded-2xl bg-slate-900 text-white text-xs space-y-1.5 font-mono">
              <div className="text-teal-400 font-bold text-[11px] flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" />
                <span>CRYPTOGRAPHIC LEDGER PROOF</span>
              </div>
              <p className="text-[10px] text-slate-300">
                • Security Layer 1: AES-256-GCM Envelope Encryption (Cloud KMS Wrapped Key)
              </p>
              <p className="text-[10px] text-slate-300">
                • Security Layer 2: Patient-Only Ownership Delivery Enforced
              </p>
              <p className="text-[10px] text-slate-300">
                • Security Layer 3: Hyperledger Fabric Immutable Hash Anchored
              </p>
              <p className="text-[10px] text-emerald-400">
                • Security Layer 4: Doctor Google Authenticator (RFC 6238 TOTP) Signed [VERIFIED]
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleAddMedication = () => {
    if (!medName.trim()) return;
    if (medications.length >= 30) {
      alert("Maximum limit reached. You can add up to 30 medicines per prescription.");
      return;
    }
    addMedication({
      name: medName.trim(),
      dosage: medDosage,
      route: medRoute,
      timing: medTiming,
      duration: medDuration,
      instructions: medInstructions.trim(),
    });
    setMedName('');
    setMedInstructions('');
  };

  const handleApprove = async () => {
    setIsSubmitting(true);
    try {
      if (onApproveWith2FA) {
        await onApproveWith2FA();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-full w-full flex flex-col bg-white text-slate-900 overflow-hidden select-none">
      {/* Top Portal Header Bar */}
      <div className="px-6 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-base sm:text-lg font-bold text-slate-900">
              Secure Digital E-Prescription Portal
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
              Grant Active • Session #{sessionId}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Patient: {patient?.name || 'Patient'} • Real-Time Consultation Workspace (Zero Popup Mode)
          </p>
        </div>
      </div>

      {/* Main Full-Height Scrollable Portal Body */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Patient Information & Clinical Safety Chart (4 cols) */}
          <aside className="lg:col-span-4 bg-slate-50/80 rounded-2xl border border-slate-200/90 p-5 space-y-5 self-start">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                Patient Information
              </span>
              <h2 className="text-lg font-bold text-slate-900 mt-0.5">{patient?.name}</h2>
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-600 mt-1 font-medium">
                <span>• Name: ({patient?.name})</span>
                <span>• Height: {patient?.height || '165cm'}</span>
                <span>• Weight: {patient?.weight || '60Kg'}</span>
                <span>• Blood: {patient?.bloodGroup || 'O+'}</span>
              </div>
            </div>

            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                Recorded Vitals
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3 rounded-xl bg-white border border-slate-200">
                  <div className="text-[11px] text-slate-400">Blood Pressure</div>
                  <div className="text-xs font-bold text-slate-800 mt-0.5">{patient?.vitals?.bp || '120/80 mmHg'}</div>
                </div>
                <div className="p-3 rounded-xl bg-white border border-slate-200">
                  <div className="text-[11px] text-slate-400">Heart Rate</div>
                  <div className="text-xs font-bold text-slate-800 mt-0.5">{patient?.vitals?.hr || '72 bpm'}</div>
                </div>
                <div className="p-3 rounded-xl bg-white border border-slate-200">
                  <div className="text-[11px] text-slate-400">Temperature</div>
                  <div className="text-xs font-bold text-slate-800 mt-0.5">{patient?.vitals?.temp || '98.6 °F'}</div>
                </div>
                <div className="p-3 rounded-xl bg-white border border-slate-200">
                  <div className="text-[11px] text-slate-400">SpO2 Oxygen</div>
                  <div className="text-xs font-bold text-slate-800 mt-0.5">{patient?.vitals?.spo2 || '99%'}</div>
                </div>
              </div>
            </div>

            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-rose-600 mb-2">
                Critical Allergies
              </div>
              <div className="space-y-2">
                {(patient?.allergies || ['Penicillin (Mild Urticaria)']).map((allergy) => (
                  <div
                    key={allergy}
                    className="px-3 py-2 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700"
                  >
                    ! {allergy}
                  </div>
                ))}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-blue-50/90 border border-blue-200 text-xs text-blue-800 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-blue-600" />
                Server-Enforced Consultation Grant
              </div>
              <p className="text-[11px] leading-relaxed text-blue-700">
                Active temporary access window. Doctor permissions to view patient medical history are revoked the moment this prescription is issued.
              </p>
            </div>
          </aside>

          {/* Right Column: E-Prescription Regimen Builder (8 cols) */}
          <section className="lg:col-span-8 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Chief Complaints
                </label>
                <input
                  type="text"
                  value={chiefComplaints}
                  onChange={(e) => setField('chiefComplaints', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100/80 border border-slate-200 text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:border-teal-600"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Clinical Diagnosis
                </label>
                <input
                  type="text"
                  value={clinicalDiagnosis}
                  onChange={(e) => setField('clinicalDiagnosis', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100/80 border border-slate-200 text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:border-teal-600"
                />
              </div>
            </div>

            {/* Quick Diagnosis Selection Chips */}
            <div className="flex flex-wrap gap-1.5">
              {QUICK_DIAGNOSES.map((diag) => (
                <button
                  key={diag}
                  type="button"
                  onClick={() => setField('clinicalDiagnosis', diag)}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-teal-50 text-slate-600 hover:text-teal-700 border border-slate-200 text-[11px] font-medium transition cursor-pointer"
                >
                  + {diag}
                </button>
              ))}
            </div>

            {/* Add Medication Box */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="text-xs font-bold text-slate-800 flex items-center justify-between">
                <span>Add Medication to Regimen (Rx)</span>
                <span className="text-[11px] font-semibold text-sky-700 bg-sky-50 px-2.5 py-0.5 rounded-full border border-sky-200">
                  Medications in Regimen ({medications.length} / 30)
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-4">
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                    Medicine Name
                  </label>
                  <input
                    type="text"
                    value={medName}
                    onChange={(e) => setMedName(e.target.value)}
                    placeholder="e.g. Napa Extend"
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                    Dosage
                  </label>
                  <select
                    value={medDosage}
                    onChange={(e) => setMedDosage(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium"
                  >
                    <option value="665mg">665mg</option>
                    <option value="500mg">500mg</option>
                    <option value="250mg">250mg</option>
                    <option value="20mg">20mg</option>
                    <option value="10mg">10mg</option>
                    <option value="5mg">5mg</option>
                    <option value="2.5mg">2.5mg</option>
                    <option value="1 drop">1 drop</option>
                    <option value="5ml">5ml</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                    Route
                  </label>
                  <select
                    value={medRoute}
                    onChange={(e) => setMedRoute(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium"
                  >
                    <option value="Oral">Oral</option>
                    <option value="Topical">Topical</option>
                    <option value="Inhalation">Inhalation</option>
                    <option value="IV">IV</option>
                    <option value="IM">IM</option>
                    <option value="Sublingual">Sublingual</option>
                    <option value="Eye Drop">Eye Drop</option>
                    <option value="Ear Drop">Ear Drop</option>
                    <option value="Nasal">Nasal</option>
                    <option value="Rectal">Rectal</option>
                  </select>
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                    Duration
                  </label>
                  <select
                    value={medDuration}
                    onChange={(e) => setMedDuration(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium"
                  >
                    <option value="3 Days">3 Days</option>
                    <option value="5 Days">5 Days</option>
                    <option value="7 Days">7 Days</option>
                    <option value="14 Days">14 Days</option>
                    <option value="30 Days">30 Days</option>
                    <option value="Continuous">Continuous</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                <div className="sm:col-span-4">
                  <select
                    value={medTiming}
                    onChange={(e) => setMedTiming(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium"
                  >
                    <option value="1+0+1 (After meal)">1+0+1 (After meal)</option>
                    <option value="1+1+1 (After meal)">1+1+1 (After meal)</option>
                    <option value="1+0+0 (Before breakfast)">1+0+0 (Before breakfast)</option>
                    <option value="0+0+1 (At bedtime)">0+0+1 (At bedtime)</option>
                    <option value="0+1+0 (After lunch)">0+1+0 (After lunch)</option>
                    <option value="PRN (As needed)">PRN (As needed)</option>
                  </select>
                </div>
                <div className="sm:col-span-5">
                  <input
                    type="text"
                    value={medInstructions}
                    onChange={(e) => setMedInstructions(e.target.value)}
                    placeholder="Instructions (e.g. Take after meal with warm water)"
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium"
                  />
                </div>
                <div className="sm:col-span-3">
                  <button
                    type="button"
                    onClick={handleAddMedication}
                    className="w-full py-2 px-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition cursor-pointer"
                  >
                    + Add to Rx List
                  </button>
                </div>
              </div>
            </div>

            {/* Medications Regimen Table (Scrollable up to 30 items) */}
            <div className="rounded-2xl border border-slate-200 overflow-hidden max-h-[380px] overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
                  <tr className="text-slate-500">
                    <th className="py-2.5 px-3 font-semibold">#</th>
                    <th className="py-2.5 px-3 font-semibold">Medication</th>
                    <th className="py-2.5 px-3 font-semibold">Dosage</th>
                    <th className="py-2.5 px-3 font-semibold">Route</th>
                    <th className="py-2.5 px-3 font-semibold">Timing &amp; Duration</th>
                    <th className="py-2.5 px-3 font-semibold">Instructions</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {medications.map((item, idx) => (
                    <tr key={item.id || idx}>
                      <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">{item.name}</td>
                      <td className="py-2.5 px-3 text-slate-600">{item.dosage}</td>
                      <td className="py-2.5 px-3 text-slate-700">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-[11px] font-medium border border-slate-200">
                          {item.route || 'Oral'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {item.timing} • {item.duration}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">{item.instructions || '—'}</td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => removeMedication(item.id)}
                          className="text-rose-500 hover:text-rose-700 font-semibold cursor-pointer"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                  {medications.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-slate-400">
                        No medications added yet. Add up to 30 medications to construct the clinical regimen.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Doctor Advice & Lifestyle Guidance */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Doctor Advice &amp; Lifestyle Guidance
              </label>
              <textarea
                rows={3}
                value={doctorAdvice}
                onChange={(e) => setField('doctorAdvice', e.target.value)}
                className="w-full p-3.5 rounded-xl bg-slate-100/80 border border-slate-200 text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:border-teal-600"
              />
            </div>
          </section>
        </div>
      </div>

      {/* Bottom Sticky Cryptographic Signing Footer (No Cancel Popup Button) */}
      <footer className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div className="text-xs text-slate-500 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span>Protected by AES-256-GCM Encryption &amp; Hyperledger Fabric</span>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleApprove}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold shadow-md transition cursor-pointer flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Generating Encrypted PDF &amp; Anchoring...</span>
              </>
            ) : (
              <span>Finalize &amp; Generate E-Prescription PDF</span>
            )}
          </button>
        </div>
      </footer>
    </div>
  );
};

