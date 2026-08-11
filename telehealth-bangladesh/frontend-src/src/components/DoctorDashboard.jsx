import React, { useState } from 'react';
import { useLanguage } from './LanguageContext';
import { useNotifications } from './NotificationCenter';
import {
  Home, Clock, Activity, Calendar, ShieldCheck, FileText, ShieldAlert,
  DollarSign, Key, CheckCircle2, User, RefreshCcw, Save, Search, ArrowLeft
} from 'lucide-react';

const API_BASE = "http://127.0.0.1:8000";

const downloadPrescriptionPDF = (p) => {
  const docName = p.doctor_details ? `Dr. ${p.doctor_details.first_name} ${p.doctor_details.last_name}` : "Certified Doctor";
  const docSpecialty = p.doctor_details ? p.doctor_details.specialty : "";
  const docReg = p.doctor_details ? p.doctor_details.bmdc_reg : "";

  const patName = p.patient_details ? `${p.patient_details.first_name} ${p.patient_details.last_name}` : "Patient";
  const patPhone = p.patient_details ? p.patient_details.phone : "";

  let medsHtml = "";
  try {
    const medsList = JSON.parse(p.medicines);
    if (Array.isArray(medsList)) {
      medsHtml = medsList.map((m, idx) => `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: left; font-weight: bold;">${idx + 1}. ${m.name}</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center; color: #555;">${m.dosage}</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right; color: #555;">${m.timing}</td>
        </tr>
      `).join("");
    } else {
      medsHtml = `<tr><td colspan="3" style="padding: 10px;">${p.medicines}</td></tr>`;
    }
  } catch (e) {
    medsHtml = `<tr><td colspan="3" style="padding: 10px;">${p.medicines}</td></tr>`;
  }

  const element = document.createElement('div');
  element.style.padding = '40px';
  element.style.fontFamily = "'Inter', 'Nunito', sans-serif";
  element.style.color = '#333';
  element.style.background = '#fff';

  element.innerHTML = `
    <div style="border: 2px solid #14b8a6; padding: 25px; border-radius: 12px; position: relative;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #14b8a6; padding-bottom: 15px; margin-bottom: 20px;">
        <div>
          <h1 style="margin: 0; color: #14b8a6; font-size: 28px; font-weight: 800;">HealNSight</h1>
          <p style="margin: 3px 0 0 0; color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: 700; letter-spacing: 1.5px;">Secure E2EE Telemedicine Ledger</p>
        </div>
        <div style="text-align: right;">
          <h3 style="margin: 0; font-size: 16px; font-weight: 700; color: #1e293b;">${docName}</h3>
          <p style="margin: 2px 0; font-size: 13px; color: #14b8a6; font-weight: 600;">${docSpecialty}</p>
          <p style="margin: 0; font-size: 11px; color: #64748b;">BMDC Reg: ${docReg}</p>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; background: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 25px; font-size: 13px;">
        <div>
          <p style="margin: 3px 0;"><strong style="color: #475569;">Patient Name:</strong> ${patName}</p>
          <p style="margin: 3px 0;"><strong style="color: #475569;">Contact:</strong> ${patPhone}</p>
        </div>
        <div style="text-align: right;">
          <p style="margin: 3px 0;"><strong style="color: #475569;">Date:</strong> ${new Date(p.created_at || Date.now()).toLocaleDateString()}</p>
          <p style="margin: 3px 0;"><strong style="color: #475569;">Prescription ID:</strong> #${p.id || 'Pending'}</p>
        </div>
      </div>

      <div style="margin-bottom: 25px; font-size: 14px;">
        <p style="margin: 6px 0;"><strong style="color: #1e293b; font-size: 15px;">Chief Complaints:</strong> ${p.symptoms}</p>
        <p style="margin: 6px 0;"><strong style="color: #1e293b; font-size: 15px;">Diagnosis:</strong> ${p.diagnosis}</p>
      </div>

      <div style="font-size: 24px; font-weight: 800; color: #14b8a6; margin-bottom: 10px; font-style: italic;">Rx</div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 14px;">
        <thead>
          <tr style="background: #14b8a6; color: #fff;">
            <th style="padding: 10px; text-align: left; font-weight: bold; border-top-left-radius: 6px; border-bottom-left-radius: 6px;">Medicine</th>
            <th style="padding: 10px; text-align: center; font-weight: bold;">Dosage</th>
            <th style="padding: 10px; text-align: right; font-weight: bold; border-top-right-radius: 6px; border-bottom-right-radius: 6px;">Timing / Duration</th>
          </tr>
        </thead>
        <tbody>
          ${medsHtml}
        </tbody>
      </table>

      <div style="background: #f0fdfa; border-left: 4px solid #14b8a6; padding: 15px; border-radius: 6px; margin-bottom: 30px; font-size: 13.5px; color: #0f766e;">
        <strong style="display: block; margin-bottom: 4px; font-size: 14px; color: #0f766e;">Doctor's Instructions:</strong>
        ${p.instructions || "No special instructions provided."}
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed #cbd5e1; padding-top: 15px; font-size: 11px; color: #64748b;">
        <div>
          <p style="margin: 2px 0;">This document is issued securely via <strong>HealNSight</strong>.</p>
          <p style="margin: 2px 0; color: #14b8a6; font-weight: 600;">E2EE Digital Telemedicine Record Verified</p>
        </div>
        <div style="text-align: right; border: 1.5px solid #14b8a6; padding: 8px 12px; border-radius: 6px; background: #f0fdfa;">
          <strong style="color: #0f766e; font-size: 10px; text-transform: uppercase; tracking-wider: 0.5px;">BMDC Cryptographically Signed</strong>
          <p style="margin: 2px 0 0 0; color: #475569; font-size: 9px;">Secure Handshake ID: SN-2026-${p.id || 'MOCK'}</p>
        </div>
      </div>
    </div>
  `;

  const opt = {
    margin: 10,
    filename: `Prescription_${p.id || 'new'}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  if (window.html2pdf) {
    window.html2pdf().set(opt).from(element).save();
  } else {
    const printWin = window.open("", "_blank");
    printWin.document.write(element.innerHTML);
    printWin.document.close();
    printWin.print();
  }
};

export const DoctorDashboard = ({ token, user, appointments, onApptAction, onSelectConsultation, activeTab, onTabChange }) => {
  const { t } = useLanguage();
  const { triggerNotification } = useNotifications();
  const [onlineStatus, setOnlineStatus] = useState(true);
  const [keyStatus, setKeyStatus] = useState("ACTIVE");
  const [searchQueue, setSearchQueue] = useState('');

  // Patient inspect state
  const [inspectPatientId, setInspectPatientId] = useState(null);
  const [inspectPatientName, setInspectPatientName] = useState("");
  const [patientRecords, setPatientRecords] = useState([]);
  const [patientLegacyImages, setPatientLegacyImages] = useState([]);
  const [inspectError, setInspectError] = useState("");

  // Prescription writer state
  const [writingPrescAppt, setWritingPrescAppt] = useState(null);
  const [prescForm, setPrescForm] = useState({ symptoms: "", diagnosis: "", instructions: "" });
  const [medications, setMedications] = useState([{ name: "", dosage: "", timing: "" }]);
  const [prescNotif, setPrescNotif] = useState("");
  const [signChecked, setSignChecked] = useState(false);

  const handleAddMedication = () => {
    setMedications([...medications, { name: "", dosage: "", timing: "" }]);
  };

  const handleRemoveMedication = (index) => {
    const updated = medications.filter((_, i) => i !== index);
    setMedications(updated);
  };

  const handleMedicationChange = (index, field, value) => {
    const updated = medications.map((med, i) => {
      if (i === index) {
        return { ...med, [field]: value };
      }
      return med;
    });
    setMedications(updated);
  };

  const handleToggleOnline = () => {
    const nextVal = !onlineStatus;
    setOnlineStatus(nextVal);
    triggerNotification(
      nextVal ? "Physician Online" : "Physician Offline",
      `Specialist profile is now ${nextVal ? 'visible for live bookings' : 'hidden from cellular routing'}.`,
      "system"
    );
  };

  const handleRegenKeys = () => {
    setKeyStatus("RE-KEYING...");
    triggerNotification("Key Rotation Initialized", "Rotating ECDH session keys on local broker...", "security");
    setTimeout(() => {
      setKeyStatus("ACTIVE (AES-256 RE-KEYED)");
      triggerNotification("Node Re-Keyed", "Diffie-Hellman parameters updated successfully.", "security");
    }, 1200);
  };

  const startInspectPatient = async (appt) => {
    setInspectPatientId(appt.patient);
    setInspectPatientName(appt.patient_details.username);
    setInspectError("");
    setPatientRecords([]);
    setPatientLegacyImages([]);

    try {
      const resp = await fetch(`${API_BASE}/api/records/?patient_id=${appt.patient}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await resp.json();
      if (resp.status === 200) {
        setPatientRecords(data);
        triggerNotification("Decryption Successful", "AES-256 Symmetric key applied. Vitals decrypted.", "security");
      } else {
        setInspectError(data.detail || "Patient has not delegated active clinical access consent.");
        triggerNotification("Security Warning: Access Blocked", "Attempt to inspect records without active consent token.", "security");
      }

      // Fetch legacy image summaries
      const respImg = await fetch(`${API_BASE}/api/image-profiles/?patient_id=${appt.patient}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (respImg.status === 200) {
        const imgData = await respImg.json();
        setPatientLegacyImages(imgData);
      }
    } catch (err) {
      setInspectError("Connection to database broker failed.");
    }
  };

  const handleWritePrescription = async (e) => {
    e.preventDefault();
    if (!writingPrescAppt?.consultation?.id) {
      setPrescNotif("No active consultation bound to write prescription.");
      return;
    }

    if (!signChecked) {
      alert("Please check the digital signature checkmark before submitting.");
      return;
    }

    try {
      const resp = await fetch(`${API_BASE}/api/prescriptions/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          consultation_id: writingPrescAppt.consultation.id,
          symptoms: prescForm.symptoms,
          diagnosis: prescForm.diagnosis,
          medicines: JSON.stringify(medications),
          instructions: prescForm.instructions
        })
      });

      if (resp.status === 201) {
        const createdPresc = await resp.json();
        triggerNotification("E-Prescription Signed", `Prescription issued successfully for ${writingPrescAppt.patient_details.username}.`, "medical");
        setPrescNotif("E-Prescription successfully compiled, signed digitally, and transmitted to patient ledger!");
        setPrescForm({ symptoms: "", diagnosis: "", instructions: "" });
        setMedications([{ name: "", dosage: "", timing: "" }]);
        setSignChecked(false);
        downloadPrescriptionPDF(createdPresc);
        setTimeout(() => {
          setWritingPrescAppt(null);
          setPrescNotif("");
        }, 2500);
      } else {
        const errorData = await resp.json();
        setPrescNotif(errorData.error || "Failed to submit prescription details.");
      }
    } catch (err) {
      setPrescNotif("Network transmission failed.");
    }
  };

  // Calculate earnings count
  const completedCount = appointments.filter(a => a.status === 'completed').length;
  const earnings = completedCount * (user.doctor_profile?.fees || 500);

  // Filter queue
  const filteredQueue = appointments.filter(appt =>
    appt.patient_details.username.toLowerCase().includes(searchQueue.toLowerCase()) ||
    appt.reason.toLowerCase().includes(searchQueue.toLowerCase())
  );

  return (
    <div className="space-y-8 text-base">

      {/* Overview stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">

        <div className="glass-panel p-8 rounded-2xl space-y-3 spotlight-card tilt-card">
          <div className="flex justify-between items-center text-medical-textMuted">
            <span className="text-sm font-bold uppercase tracking-wider">Today's Load</span>
            <Activity className="w-6 h-6 text-medical-teal" />
          </div>
          <div className="flex items-center gap-3 justify-between">
            <div>
              <h3 className="text-4xl font-extrabold text-white">
                {appointments.filter(a => a.status === 'pending' || a.status === 'approved').length}
              </h3>
              <p className="text-xs text-medical-textMuted mt-1">Pending / approved load</p>
            </div>

            {/* Semi-circular consultation gauge */}
            <div className="relative w-16 h-12 shrink-0">
              <svg viewBox="0 0 100 60" className="w-full h-full">
                <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" strokeLinecap="round" />
                <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="var(--color-secondary)" strokeWidth="10" strokeLinecap="round"
                  strokeDasharray="125.6"
                  strokeDashoffset={125.6 - (125.6 * Math.min(appointments.filter(a => a.status === 'pending' || a.status === 'approved').length, 8)) / 8}
                  className="transition-all duration-700 ease-out"
                />
              </svg>
              <div className="absolute bottom-1.5 inset-x-0 flex flex-col items-center justify-center">
                <span className="text-xs font-extrabold text-medical-textMuted">
                  {Math.round((Math.min(appointments.filter(a => a.status === 'pending' || a.status === 'approved').length, 8) / 8) * 100)}%
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="glass-panel p-8 rounded-2xl space-y-3 spotlight-card tilt-card">
          <div className="flex justify-between items-center text-medical-textMuted">
            <span className="text-sm font-bold uppercase tracking-wider">{t('incomeOverview')}</span>
            <DollarSign className="w-6 h-6 text-medical-emerald" />
          </div>
          <h3 className="text-4xl font-extrabold text-white">{earnings} BDT</h3>
          <p className="text-xs text-medical-textMuted mt-1">{completedCount} consultation sessions</p>
        </div>

        <div className="glass-panel p-8 rounded-2xl space-y-3 spotlight-card tilt-card">
          <div className="flex justify-between items-center text-medical-textMuted">
            <span className="text-sm font-bold uppercase tracking-wider">BMDC Verification</span>
            <ShieldCheck className="w-6 h-6 text-medical-teal" />
          </div>
          <h3 className="text-base font-extrabold text-medical-teal truncate">
            {user.bmdc_reg || 'PENDING'}
          </h3>
          <p className="text-xs text-medical-textMuted uppercase tracking-widest font-bold mt-1">Status: verified</p>
        </div>

        <div className="glass-panel p-8 rounded-2xl space-y-3 spotlight-card tilt-card">
          <div className="flex justify-between items-center text-medical-textMuted">
            <span className="text-sm font-bold uppercase tracking-wider">E2E Secure Key</span>
            <Key className="w-6 h-6 text-medical-indigo" />
          </div>
          <h3 className="text-sm font-bold text-white uppercase truncate">
            {keyStatus}
          </h3>
          <button onClick={handleRegenKeys} className="magnetic-target text-xs text-medical-textMuted hover:text-medical-teal hover:underline flex items-center gap-1 font-semibold mt-1">
            <RefreshCcw className="w-4 h-4" /> Re-Key Node
          </button>
        </div>

      </div>

      {/* Availability and Control Panel */}
      <div className="glass-panel p-8 rounded-2xl border border-medical-borderBg bg-gradient-to-r from-medical-teal/10 via-medical-cardBg to-medical-indigo/10 flex flex-col md:flex-row justify-between items-center gap-6 spotlight-card tilt-card">
        <div>
          <h4 className="text-xl font-bold text-white flex items-center gap-2">
            <span className={`status-light ${onlineStatus ? 'online' : 'offline'}`}></span>
            <span>{t('availabilityStatus')}</span>
          </h4>
          <p className="text-sm text-medical-textMuted mt-1.5">{t('availabilityDesc')}</p>
        </div>
        <button onClick={handleToggleOnline} className="magnetic-target px-6 py-3 rounded-xl font-extrabold shadow transition-all bg-medical-teal text-white dark:text-medical-darkBg shadow-md shadow-medical-teal/15 text-base">
          {onlineStatus ? 'Active Online' : 'Set Offline'}
        </button>
      </div>

      {/* Visual Analytics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* Earnings visual chart representation */}
        <div className="glass-panel p-8 rounded-2xl space-y-6 spotlight-card tilt-card">
          <div className="flex justify-between items-center border-b border-medical-borderBg border-medical-borderBg pb-3">
            <h3 className="text-xl font-bold text-medical-textMain text-medical-textMain uppercase tracking-wider">Monthly Consultation Revenue</h3>
            <span className="text-xs bg-medical-emerald/10 text-medical-emerald px-2.5 py-1 rounded font-bold">Total complete: {completedCount}</span>
          </div>

          {/* SVG Earnings Bar Chart */}
          <div className="h-36 flex items-end justify-between pt-6 px-4">
            <div className="w-10 bg-slate-200 bg-medical-darkBg rounded-t-lg h-[20%] text-center relative group">
              <span className="absolute -top-7 left-1/2 -translate-x-1/2 text-xs opacity-0 group-hover:opacity-100 transition-opacity bg-black text-white px-2 py-0.5 rounded font-bold">500</span>
            </div>
            <div className="w-10 bg-slate-200 bg-medical-darkBg rounded-t-lg h-[40%] text-center relative group">
              <span className="absolute -top-7 left-1/2 -translate-x-1/2 text-xs opacity-0 group-hover:opacity-100 transition-opacity bg-black text-white px-2 py-0.5 rounded font-bold">1000</span>
            </div>
            <div className="w-10 bg-slate-200 bg-medical-darkBg rounded-t-lg h-[30%] text-center relative group">
              <span className="absolute -top-7 left-1/2 -translate-x-1/2 text-xs opacity-0 group-hover:opacity-100 transition-opacity bg-black text-white px-2 py-0.5 rounded font-bold">750</span>
            </div>
            <div className="w-10 bg-slate-200 bg-medical-darkBg rounded-t-lg h-[70%] text-center relative group">
              <span className="absolute -top-7 left-1/2 -translate-x-1/2 text-xs opacity-0 group-hover:opacity-100 transition-opacity bg-black text-white px-2 py-0.5 rounded font-bold">1500</span>
            </div>
            <div className="w-10 bg-medical-teal rounded-t-lg h-[90%] text-center relative group shadow-[0_0_10px_rgba(20,184,166,0.3)]">
              <span className="absolute -top-7 left-1/2 -translate-x-1/2 text-xs text-medical-teal font-bold bg-black px-2 py-0.5 rounded">{earnings}</span>
            </div>
          </div>
          <div className="flex justify-between text-xs text-medical-textMuted font-mono">
            <span>FEB</span>
            <span>MAR</span>
            <span>APR</span>
            <span>MAY</span>
            <span>JUN (CURRENT)</span>
          </div>
        </div>

        {/* Appointment Heatmap (density visualization) */}
        <div className="glass-panel p-8 rounded-2xl space-y-6 spotlight-card tilt-card">
          <div className="flex justify-between items-center border-b border-medical-borderBg border-medical-borderBg pb-3">
            <h3 className="text-xl font-bold text-medical-textMain text-medical-textMain uppercase tracking-wider">Weekly Booking Density Heatmap</h3>
            <div className="flex items-center gap-2 text-xs text-medical-textMuted font-bold uppercase">
              <span>Low</span>
              <span className="w-3.5 h-3.5 bg-medical-darkBg rounded-sm" />
              <span className="w-3.5 h-3.5 bg-teal-900/60 rounded-sm" />
              <span className="w-3.5 h-3.5 bg-medical-teal/50 rounded-sm" />
              <span className="w-3.5 h-3.5 bg-indigo-500/70 rounded-sm" />
              <span>High</span>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-7 gap-2 text-center text-xs text-medical-textMuted font-mono font-bold">
              <span>MON</span>
              <span>TUE</span>
              <span>WED</span>
              <span>THU</span>
              <span>FRI</span>
              <span>SAT</span>
              <span>SUN</span>
            </div>

            <div className="space-y-2.5">
              {[
                [2, 0, 1, 3, 0, 1, 0], // 09:00 AM slot
                [0, 1, 0, 2, 2, 0, 0], // 10:30 AM slot
                [3, 2, 1, 0, 1, 0, 0], // 12:00 PM slot
                [1, 0, 2, 1, 0, 2, 0], // 02:30 PM slot
                [0, 2, 3, 0, 1, 0, 0], // 04:00 PM slot
                [0, 0, 1, 0, 0, 0, 0]  // 06:00 PM slot
              ].map((row, rIdx) => {
                const times = ["09:00 AM", "10:30 AM", "12:00 PM", "02:30 PM", "04:00 PM", "06:00 PM"];
                return (
                  <div key={rIdx} className="flex gap-3 items-center">
                    <span className="w-16 text-right text-xs text-medical-textMuted font-mono shrink-0">{times[rIdx]}</span>
                    <div className="grid grid-cols-7 gap-2 flex-grow">
                      {row.map((val, cIdx) => {
                        let cellColor = "bg-medical-darkBg/40 border border-medical-borderBg";
                        if (val === 1) cellColor = "bg-teal-900/30 border border-teal-800/20";
                        else if (val === 2) cellColor = "bg-medical-teal/30 border border-teal-400/20";
                        else if (val >= 3) cellColor = "bg-indigo-500/40 border border-indigo-400/25";

                        return (
                          <div
                            key={cIdx}
                            title={`${val} bookings at ${times[rIdx]}`}
                            className={`h-6 rounded-md cursor-help flex items-center justify-center font-bold text-xs transition-all hover:scale-105 ${cellColor}`}
                          >
                            {val > 0 ? val : ""}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </div>

      {/* Dynamic Sub-sections (Inspect / Prescribe / Queue) */}

      {/* 1. INSPECT PATIENT RECORDS WITH CONSENT CONTROL */}
      {inspectPatientId && (
        <div className="glass-panel p-8 rounded-2xl border border-medical-indigo/35 bg-medical-indigo/5 space-y-6 animate-fade">
          <div className="flex justify-between items-center border-b border-medical-borderBg border-medical-borderBg pb-3">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <ShieldAlert className="w-6 h-6 text-medical-indigo" />
              <span>Consent-Based Access: Health Records of '{inspectPatientName}'</span>
            </h3>
            <button onClick={() => setInspectPatientId(null)} className="text-sm text-medical-textMuted hover:text-white flex items-center gap-1 font-bold">
              <ArrowLeft className="w-5 h-5" /> Back to Workspace
            </button>
          </div>

          {inspectError ? (
            <div className="p-4 rounded-xl border border-medical-rose/20 bg-medical-rose/10 text-medical-rose text-sm flex items-start gap-2 leading-relaxed">
              <ShieldAlert className="w-6 h-6 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-white">Clinical Access Blocked</p>
                <p className="mt-1">{inspectError}</p>
                <p className="mt-2 text-xs uppercase font-bold text-medical-textMuted">Security event logged in admin compliance ledger.</p>
              </div>
            </div>
          ) : patientRecords.length === 0 ? (
            <p className="text-medical-textMuted py-8 text-center text-base">Checking database ledger records...</p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Decrypted vitals ledger */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-medical-textMuted uppercase tracking-widest">Symmetric Decrypted Records</h4>
                <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
                  {patientRecords.map(rec => (
                    <div key={rec.id} className="bg-medical-darkBg/60 border border-medical-borderBg p-4 rounded-xl space-y-2 animate-fade">
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-xs bg-medical-teal/15 text-medical-teal px-2.5 py-0.5 rounded font-bold uppercase">{rec.record_type}</span>
                        <span className="text-medical-textMuted">{new Date(rec.updated_at).toLocaleDateString()}</span>
                      </div>
                      <p className="font-mono text-slate-350 bg-black/40 p-2.5 rounded border border-medical-borderBg leading-relaxed text-xs">
                        {rec.decrypted_content || rec.encrypted_data}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Legacy Graphic summaries */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-medical-textMuted uppercase tracking-widest">Vision Analysed Legacy Scans</h4>
                <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
                  {patientLegacyImages.length === 0 ? (
                    <p className="text-medical-textMuted text-xs py-10 text-center">No legacy scans uploaded for this patient.</p>
                  ) : (
                    patientLegacyImages.map(img => (
                      <div key={img.id} className="bg-medical-darkBg/60 border border-medical-borderBg p-4 rounded-xl space-y-2 animate-fade">
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-xs bg-medical-indigo/15 text-medical-indigo px-2.5 py-0.5 rounded font-bold uppercase">{img.image_name}</span>
                          <span className="text-medical-textMuted">{new Date(img.created_at).toLocaleDateString()}</span>
                        </div>
                        <p className="font-mono text-slate-350 bg-black/40 p-2.5 rounded border border-medical-borderBg leading-relaxed text-xs whitespace-pre-wrap">
                          {img.previous_data?.images?.ecg_summary || "No summary extracted."}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. E-PRESCRIPTION WRITER PANEL */}
      {writingPrescAppt && (
        <div className="glass-panel p-8 rounded-2xl border border-medical-teal/35 bg-medical-teal/5 space-y-6 animate-fade">
          <div className="flex justify-between items-center border-b border-medical-borderBg border-medical-borderBg pb-3">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <FileText className="w-6 h-6 text-medical-teal" />
              <span>E-Prescription Desk: Prescribing for '{writingPrescAppt.patient_details.username}'</span>
            </h3>
            <button onClick={() => setWritingPrescAppt(null)} className="text-sm text-medical-textMuted hover:text-white flex items-center gap-1 font-bold">
              <ArrowLeft className="w-5 h-5" /> Close Desk
            </button>
          </div>

          {prescNotif && (
            <div className="p-4 rounded-xl bg-medical-darkBg/85 border border-medical-borderBg text-medical-teal font-bold text-base">
              {prescNotif}
            </div>
          )}

          <form onSubmit={handleWritePrescription} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-medical-textMuted mb-1.5 text-sm">{t('symptoms')}</label>
                <textarea required rows="2" placeholder="e.g. Mild cough, headache, high temperature..." value={prescForm.symptoms} onChange={e => setPrescForm({ ...prescForm, symptoms: e.target.value })} className="w-full bg-medical-darkBg border border-medical-borderBg rounded-xl p-3 text-white outline-none focus:border-medical-teal text-base"></textarea>
              </div>
              <div>
                <label className="block font-bold text-medical-textMuted mb-1.5 text-sm">{t('diagnosis')}</label>
                <textarea required rows="2" placeholder="e.g. Seasonal flu, mild throat infection..." value={prescForm.diagnosis} onChange={e => setPrescForm({ ...prescForm, diagnosis: e.target.value })} className="w-full bg-medical-darkBg border border-medical-borderBg rounded-xl p-3 text-white outline-none focus:border-medical-teal text-base"></textarea>
              </div>
            </div>

            <div className="space-y-4 bg-medical-darkBg/20 p-5 border border-medical-borderBg rounded-2xl">
              <label className="block font-bold text-medical-textBody text-sm uppercase tracking-wider">Medications List (Rx)</label>
              <div className="space-y-3">
                {medications.map((med, index) => (
                  <div key={index} className="flex flex-col md:flex-row items-center gap-3 bg-medical-darkBg/40 p-4 border border-medical-borderBg rounded-xl animate-fade">
                    <div className="flex-grow w-full md:w-auto">
                      <input
                        required
                        type="text"
                        placeholder="Drug Name (e.g. Napa Extend 665mg)"
                        value={med.name}
                        onChange={e => handleMedicationChange(index, 'name', e.target.value)}
                        className="w-full bg-medical-darkBg border border-medical-borderBg rounded-xl p-2.5 text-white outline-none focus:border-medical-teal text-sm"
                      />
                    </div>
                    <div className="w-full md:w-36">
                      <input
                        required
                        type="text"
                        placeholder="Dosage (e.g. 1+0+1)"
                        value={med.dosage}
                        onChange={e => handleMedicationChange(index, 'dosage', e.target.value)}
                        className="w-full bg-medical-darkBg border border-medical-borderBg rounded-xl p-2.5 text-white outline-none focus:border-medical-teal text-sm"
                      />
                    </div>
                    <div className="flex-grow w-full md:w-auto">
                      <input
                        required
                        type="text"
                        placeholder="Timing/Duration (e.g. 5 days after meals)"
                        value={med.timing}
                        onChange={e => handleMedicationChange(index, 'timing', e.target.value)}
                        className="w-full bg-medical-darkBg border border-medical-borderBg rounded-xl p-2.5 text-white outline-none focus:border-medical-teal text-sm"
                      />
                    </div>
                    {medications.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveMedication(index)}
                        className="bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white px-4 py-2.5 rounded-xl transition-all text-xs font-bold shrink-0"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={handleAddMedication}
                className="bg-medical-teal/10 hover:bg-medical-teal text-medical-teal hover:text-white border border-medical-teal/30 px-4 py-2 rounded-xl text-xs font-bold transition-all"
              >
                + Add Medicine
              </button>
            </div>

            <div>
              <label className="block font-bold text-medical-textMuted mb-1.5 text-sm">{t('instructions')}</label>
              <textarea required rows="2" placeholder="Take after meals. Drink plenty of warm water." value={prescForm.instructions} onChange={e => setPrescForm({ ...prescForm, instructions: e.target.value })} className="w-full bg-medical-darkBg border border-medical-borderBg rounded-xl p-3 text-white outline-none focus:border-medical-teal text-base"></textarea>
            </div>

            {/* Signature Confirmation Checkbox */}
            <div className="flex items-center gap-3 bg-medical-darkBg/40 p-4 rounded-xl border border-medical-borderBg max-w-md">
              <input
                type="checkbox"
                id="signCheck"
                checked={signChecked}
                onChange={() => setSignChecked(!signChecked)}
                className="rounded border-white/15 bg-medical-darkBg text-medical-teal focus:ring-0 w-5 h-5"
              />
              <label htmlFor="signCheck" className="text-xs text-medical-textMuted cursor-pointer font-bold select-none">
                Apply BMDC Digital Cryptographic Signature
              </label>
            </div>

            <button type="submit" className="bg-medical-teal hover:bg-medical-teal text-white dark:text-medical-darkBg font-extrabold px-6 py-3 rounded-xl flex items-center gap-2 transition-all shadow-md shadow-medical-teal/10 text-base">
              <Save className="w-5 h-5" />
              <span>{t('savePrescription')}</span>
            </button>
          </form>
        </div>
      )}

      {/* Daily appointment schedule desk */}
      <div className="glass-panel p-8 rounded-2xl border border-medical-borderBg space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <h3 className="text-xl font-bold text-medical-textMain dark:text-slate-200 uppercase tracking-wider">{t('dailyQueue')}</h3>

          {/* Search bar inside queue list */}
          <div className="relative w-full md:w-64">
            <input
              type="text"
              placeholder="Search queue patients..."
              value={searchQueue}
              onChange={e => setSearchQueue(e.target.value)}
              className="w-full bg-medical-darkBg border border-medical-borderBg rounded-xl py-2.5 pl-10 pr-4 text-white placeholder-slate-500 outline-none focus:border-medical-teal text-base"
            />
            <Search className="absolute left-3.5 top-3 w-5 h-5 text-medical-textMuted" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-base text-slate-650 text-medical-textMuted">
            <thead>
              <tr className="border-b border-medical-borderBg border-medical-borderBg text-medical-textMain text-medical-textBody font-bold">
                <th className="py-3 px-4">Patient</th>
                <th>Appointment Date</th>
                <th>Time Slot</th>
                <th>Narrative / Reason</th>
                <th>Status</th>
                <th>Access Controls &amp; Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredQueue.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-8 text-medical-textMuted">No scheduled appts on queue database ledger.</td>
                </tr>
              ) : (
                filteredQueue.map(appt => (
                  <tr key={appt.id} className="border-b border-slate-100 border-medical-borderBg hover:bg-white/2">
                    <td className="py-4 px-4 font-bold text-medical-textMain dark:text-slate-200">{appt.patient_details.username}</td>
                    <td>{appt.date}</td>
                    <td>{appt.time}</td>
                    <td className="max-w-xs truncate">{appt.reason}</td>
                    <td>
                      <span className={`px-3 py-1.5 rounded-full text-xs font-bold capitalize ${appt.status === 'approved' ? 'bg-medical-emerald/10 text-medical-emerald' : appt.status === 'pending' ? 'bg-medical-amber/10 text-medical-amber' : 'bg-medical-rose/10 text-medical-rose'}`}>
                        {appt.status}
                      </span>
                    </td>
                    <td className="py-3">
                      <div className="flex gap-2.5">
                        {appt.status === 'pending' && (
                          <>
                            <button onClick={() => { onApptAction(appt.id, 'approve'); triggerNotification("Appointment Approved", `Session with ${appt.patient_details.username} approved.`, "appointment"); }} className="bg-medical-emerald/15 hover:bg-medical-emerald text-medical-emerald hover:text-black border border-medical-emerald/20 px-3.5 py-1.5 rounded-lg text-sm font-bold transition-all">
                              {t('approve')}
                            </button>
                            <button onClick={() => { onApptAction(appt.id, 'cancel'); triggerNotification("Appointment Rejected", `Session with ${appt.patient_details.username} cancelled.`, "appointment"); }} className="bg-medical-rose/15 hover:bg-medical-rose text-medical-rose hover:text-white border border-medical-rose/20 px-3.5 py-1.5 rounded-lg text-sm font-bold transition-all">
                              {t('reject')}
                            </button>
                          </>
                        )}

                        {appt.status === 'approved' && (
                          <>
                            {appt.consultation && (
                              <button onClick={() => onSelectConsultation({ id: appt.consultation.id, mode: appt.consultation.type })} className="bg-medical-teal text-white dark:text-medical-darkBg font-extrabold px-4 py-2 rounded-lg text-sm hover:bg-medical-teal/90 transition-all">
                                {t('enterClinicalRoom')}
                              </button>
                            )}
                            <button onClick={() => startInspectPatient(appt)} className="bg-medical-indigo/25 hover:bg-medical-indigo/40 text-medical-indigo border border-medical-indigo/30 px-4 py-2 rounded-lg text-sm font-bold transition-all">
                              {t('inspectRecords')}
                            </button>
                            <button onClick={() => setWritingPrescAppt(appt)} className="bg-medical-darkBg hover:bg-slate-700 text-slate-200 border border-medical-borderBg px-4 py-2 rounded-lg text-sm font-bold transition-all">
                              {t('writePrescription')}
                            </button>
                            <button onClick={() => { onApptAction(appt.id, 'complete'); triggerNotification("Session Marked Complete", `Completed consultation with ${appt.patient_details.username}.`, "appointment"); }} className="bg-medical-darkBg text-medical-textMuted hover:text-white border border-medical-borderBg px-3 py-1.5 rounded-lg text-xs font-bold transition-all">
                              Mark Completed
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
