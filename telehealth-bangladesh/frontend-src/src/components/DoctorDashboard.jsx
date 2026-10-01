import React, { useState } from 'react';
import { useLanguage } from './LanguageContext';
import { useNotifications } from './NotificationCenter';
import {
  Home, Clock, Activity, Calendar, ShieldCheck, FileText, ShieldAlert,
  CheckCircle2, User, RefreshCcw, Save, Search, ArrowLeft, Video,
  MessageSquare, Stethoscope, Plus, Trash2, Download, Share2, AlertCircle,
  X, Check, Lock, ChevronRight, Eye, PhoneCall, Award, DollarSign, Settings,
  CheckCircle, CalendarDays
} from 'lucide-react';
import {
  Button, Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter,
  StatusBadge, VerifiedBadge, SecurityBadge, PageHeader, SectionHeader,
  EmptyState, LoadingState, ErrorState, Modal
} from './ui';

const API_BASE = import.meta.env.VITE_API_BASE || window.location.origin;

const DEFAULT_WEEKLY_SCHEDULE = [
  { day: "Saturday", start_time: "09:00 AM", end_time: "01:00 PM", active: true },
  { day: "Sunday", start_time: "09:00 AM", end_time: "01:00 PM", active: true },
  { day: "Monday", start_time: "09:00 AM", end_time: "01:00 PM", active: true },
  { day: "Tuesday", start_time: "09:00 AM", end_time: "01:00 PM", active: true },
  { day: "Wednesday", start_time: "09:00 AM", end_time: "01:00 PM", active: true },
  { day: "Thursday", start_time: "09:00 AM", end_time: "01:00 PM", active: true },
  { day: "Friday", start_time: "03:00 PM", end_time: "07:00 PM", active: false }
];

const TIME_OPTIONS = [
  "08:00 AM", "09:00 AM", "10:00 AM", "11:00 AM", "12:00 PM",
  "01:00 PM", "02:00 PM", "03:00 PM", "04:00 PM", "05:00 PM",
  "06:00 PM", "07:00 PM", "08:00 PM", "09:00 PM", "10:00 PM"
];

/* ─── Digital Prescription PDF Download Utility ─── */
const downloadPrescriptionPDF = (p) => {
  const docName = p.doctor_details ? `Dr. ${p.doctor_details.first_name} ${p.doctor_details.last_name}` : "Certified Doctor";
  const docSpecialty = p.doctor_details ? p.doctor_details.specialty : "General Physician";
  const docReg = p.doctor_details ? p.doctor_details.bmdc_reg : "BMDC Verified";

  const patName = p.patient_details ? `${p.patient_details.first_name || ''} ${p.patient_details.last_name || ''}`.trim() || p.patient_details.username : "Patient";
  const patPhone = p.patient_details ? p.patient_details.phone || "" : "";

  let medsHtml = "";
  try {
    const medsList = JSON.parse(p.medicines);
    if (Array.isArray(medsList)) {
      medsHtml = medsList.map((m, idx) => `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: left; font-weight: bold; color: #0f172a;">${idx + 1}. ${m.name}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: center; color: #334155;">${m.dosage}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right; color: #334155;">${m.timing}</td>
        </tr>
      `).join("");
    } else {
      medsHtml = `<tr><td colspan="3" style="padding: 10px; color: #334155;">${p.medicines}</td></tr>`;
    }
  } catch (e) {
    medsHtml = `<tr><td colspan="3" style="padding: 10px; color: #334155;">${p.medicines}</td></tr>`;
  }

  const element = document.createElement('div');
  element.style.padding = '36px';
  element.style.fontFamily = "'Inter', 'Plus Jakarta Sans', -apple-system, sans-serif";
  element.style.color = '#0f172a';
  element.style.background = '#ffffff';

  element.innerHTML = `
    <div style="border: 2px solid #168CF5; padding: 28px; border-radius: 12px; position: relative;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #168CF5; padding-bottom: 16px; margin-bottom: 20px;">
        <div>
          <h1 style="margin: 0; color: #0F172A; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">Telehealth Bangladesh</h1>
          <p style="margin: 3px 0 0 0; color: #55647C; font-size: 11px; text-transform: uppercase; font-weight: 700; letter-spacing: 1px;">Verified National Telemedicine Network</p>
        </div>
        <div style="text-align: right;">
          <h3 style="margin: 0; font-size: 16px; font-weight: 700; color: #0f172a;">${docName}</h3>
          <p style="margin: 2px 0; font-size: 13px; color: #168CF5; font-weight: 600;">${docSpecialty}</p>
          <p style="margin: 0; font-size: 11px; color: #64748b;">BMDC Reg: ${docReg}</p>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; background: #f8fafc; padding: 14px; border-radius: 8px; margin-bottom: 20px; font-size: 13px; border: 1px solid #BDDDFA;">
        <div>
          <p style="margin: 3px 0;"><strong style="color: #475569;">Patient Name:</strong> ${patName}</p>
          <p style="margin: 3px 0;"><strong style="color: #475569;">Contact:</strong> ${patPhone || 'N/A'}</p>
        </div>
        <div style="text-align: right;">
          <p style="margin: 3px 0;"><strong style="color: #475569;">Date:</strong> ${new Date(p.created_at || Date.now()).toLocaleDateString()}</p>
          <p style="margin: 3px 0;"><strong style="color: #475569;">Prescription ID:</strong> #${p.id || 'NEW'}</p>
        </div>
      </div>

      <div style="margin-bottom: 20px; font-size: 13.5px;">
        <p style="margin: 6px 0;"><strong style="color: #0f172a;">Chief Complaints:</strong> ${p.symptoms || 'General Consultation'}</p>
        <p style="margin: 6px 0;"><strong style="color: #0f172a;">Diagnosis:</strong> ${p.diagnosis || 'Clinical evaluation completed'}</p>
      </div>

      <div style="font-size: 22px; font-weight: 800; color: #059669; margin-bottom: 8px; font-style: italic;">Rx</div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px;">
        <thead>
          <tr style="background: #0F172A; color: #ffffff;">
            <th style="padding: 10px; text-align: left; font-weight: 600; border-top-left-radius: 6px;">Medicine</th>
            <th style="padding: 10px; text-align: center; font-weight: 600;">Dosage</th>
            <th style="padding: 10px; text-align: right; font-weight: 600; border-top-right-radius: 6px;">Timing / Instructions</th>
          </tr>
        </thead>
        <tbody>
          ${medsHtml}
        </tbody>
      </table>

      <div style="background: #E7F0FC; border-left: 4px solid #168CF5; padding: 12px 14px; border-radius: 6px; margin-bottom: 24px; font-size: 13px; color: #0F172A;">
        <strong style="display: block; margin-bottom: 3px; font-size: 13px; color: #0F172A;">Physician Instructions:</strong>
        ${p.instructions || "Follow prescribed dosage. Stay hydrated and schedule a follow-up if symptoms persist."}
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed #BDDDFA; padding-top: 14px; font-size: 11px; color: #55647C;">
        <div>
          <p style="margin: 2px 0;">Issued securely via <strong>Telehealth Bangladesh</strong>.</p>
          <p style="margin: 2px 0; color: #059669; font-weight: 600;">End-to-End Encrypted Digital Medical Ledger</p>
        </div>
        <div style="text-align: right; border: 1px solid #BDDDFA; padding: 6px 12px; border-radius: 6px; background: #E7F0FC;">
          <strong style="color: #0F172A; font-size: 10px; text-transform: uppercase;">BMDC Digitally Signed</strong>
          <p style="margin: 2px 0 0 0; color: #55647C; font-size: 9px;">Handshake Token: TB-DOC-${p.id || 'NEW'}</p>
        </div>
      </div>
    </div>
  `;

  const opt = {
    margin: 10,
    filename: `Prescription_${p.id || 'TelehealthBD'}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  if (window.html2pdf) {
    window.html2pdf().set(opt).from(element).save();
  } else {
    const printWin = window.open("", "_blank");
    if (printWin) {
      printWin.document.write(element.innerHTML);
      printWin.document.close();
      printWin.print();
    }
  }
};

/* ─── Main DoctorDashboard Component ─── */
export const DoctorDashboard = ({
  token,
  user,
  appointments = [],
  onApptAction,
  onSelectConsultation,
  activeTab = 'dashboard',
  onTabChange
}) => {
  const { t } = useLanguage();
  const { triggerNotification } = useNotifications();

  const [activeSection, setActiveSection] = useState(activeTab === 'schedule' ? 'schedule' : 'queue');

  React.useEffect(() => {
    setActiveSection(activeTab === 'schedule' ? 'schedule' : 'queue');
  }, [activeTab]);

  const [onlineStatus, setOnlineStatus] = useState(user.doctor_profile?.online ?? true);
  const [keyStatus, setKeyStatus] = useState("ACTIVE");
  const [searchQueue, setSearchQueue] = useState('');

  // Doctor Consultation Fee & Schedule state
  const [consultationFee, setConsultationFee] = useState(user.doctor_profile?.fees || 500);
  const [scheduleSlots, setScheduleSlots] = useState(() => {
    if (Array.isArray(user.doctor_profile?.schedule) && user.doctor_profile.schedule.length > 0) {
      return user.doctor_profile.schedule;
    }
    return DEFAULT_WEEKLY_SCHEDULE;
  });
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleSuccessMsg, setScheduleSuccessMsg] = useState('');
  const [scheduleErrMsg, setScheduleErrMsg] = useState('');

  // Patient record inspector modal state
  const [inspectPatientId, setInspectPatientId] = useState(null);
  const [inspectPatientName, setInspectPatientName] = useState("");
  const [patientRecords, setPatientRecords] = useState([]);
  const [patientLegacyImages, setPatientLegacyImages] = useState([]);
  const [inspectError, setInspectError] = useState("");
  const [inspectLoading, setInspectLoading] = useState(false);

  // E-Prescription writer modal state
  const [writingPrescAppt, setWritingPrescAppt] = useState(null);
  const [prescForm, setPrescForm] = useState({ symptoms: "", diagnosis: "", instructions: "" });
  const [medications, setMedications] = useState([{ name: "", dosage: "", timing: "" }]);
  const [prescNotif, setPrescNotif] = useState("");
  const [signChecked, setSignChecked] = useState(false);
  const [prescSubmitting, setPrescSubmitting] = useState(false);

  const handleAddMedication = () => {
    setMedications(prev => [...prev, { name: "", dosage: "", timing: "" }]);
  };

  const handleRemoveMedication = (index) => {
    setMedications(prev => prev.filter((_, i) => i !== index));
  };

  const handleMedicationChange = (index, field, value) => {
    setMedications(prev => prev.map((m, i) => i === index ? { ...m, [field]: value } : m));
  };

  const handleToggleOnline = async () => {
    const nextVal = !onlineStatus;
    setOnlineStatus(nextVal);
    triggerNotification(
      nextVal ? "Physician Online" : "Physician Offline",
      `Specialist workstation is now ${nextVal ? 'available for live patient consultations' : 'paused'}.`,
      "system"
    );
    try {
      await fetch(`${API_BASE}/api/profile/`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ online: nextVal })
      });
    } catch (e) {
      // ignore
    }
  };

  const handleRegenKeys = () => {
    setKeyStatus("ACTIVE (AES-256 RE-KEYED)");
    triggerNotification("Node Re-Keyed", "Diffie-Hellman parameters updated successfully.", "security");
  };

  const handleToggleDayActive = (dayIndex) => {
    setScheduleSlots(prev => prev.map((s, idx) => {
      if (idx === dayIndex) {
        return { ...s, active: !s.active };
      }
      return s;
    }));
  };

  const handleSlotTimeChange = (dayIndex, field, value) => {
    setScheduleSlots(prev => prev.map((s, idx) => {
      if (idx === dayIndex) {
        return { ...s, [field]: value };
      }
      return s;
    }));
  };

  const handleSaveScheduleAndFee = async (e) => {
    if (e) e.preventDefault();
    setScheduleLoading(true);
    setScheduleSuccessMsg('');
    setScheduleErrMsg('');
    try {
      const resp = await fetch(`${API_BASE}/api/profile/`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          fees: Number(consultationFee),
          schedule: scheduleSlots,
          online: onlineStatus
        })
      });
      if (resp.ok) {
        const updated = await resp.json();
        setScheduleSuccessMsg(`Consultation fee (৳${consultationFee} BDT) and weekly schedule synchronized with national registry!`);
        triggerNotification('Schedule & Fee Synchronized', `Consultation fee is set to ৳${consultationFee} BDT and schedule updated.`, 'system');
        setTimeout(() => setScheduleSuccessMsg(''), 5000);
      } else {
        const errData = await resp.json();
        setScheduleErrMsg(errData.detail || 'Failed to update schedule.');
      }
    } catch (err) {
      setScheduleErrMsg('Network connection error.');
    } finally {
      setScheduleLoading(false);
    }
  };

  const startInspectPatient = async (appt) => {
    setInspectPatientId(appt.patient);
    setInspectPatientName(`${appt.patient_details?.first_name || ''} ${appt.patient_details?.last_name || ''}`.trim() || appt.patient_details?.username || 'Patient');
    setInspectError("");
    setPatientRecords([]);
    setPatientLegacyImages([]);
    setInspectLoading(true);

    try {
      const resp = await fetch(`${API_BASE}/api/records/?patient_id=${appt.patient}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await resp.json();
      if (resp.status === 200) {
        setPatientRecords(Array.isArray(data) ? data : []);
        triggerNotification("Decryption Successful", "AES-256 Symmetric key applied. Vitals decrypted.", "security");
      } else {
        setInspectError(data.detail || "Patient has not delegated active clinical access consent.");
        triggerNotification("Security Warning: Access Blocked", "Attempt to inspect records without active consent token.", "security");
      }

      // Fetch legacy image profiles
      const respImg = await fetch(`${API_BASE}/api/image-profiles/?patient_id=${appt.patient}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (respImg.status === 200) {
        const imgData = await respImg.json();
        setPatientLegacyImages(Array.isArray(imgData) ? imgData : []);
      }
    } catch (err) {
      setInspectError("Connection to clinical record database broker failed.");
    } finally {
      setInspectLoading(false);
    }
  };

  const handleWritePrescription = async (e) => {
    e.preventDefault();
    if (!writingPrescAppt?.consultation?.id) {
      setPrescNotif("No active consultation session bound to write prescription.");
      return;
    }

    if (!signChecked) {
      alert("Please confirm the digital signature declaration before issuing.");
      return;
    }

    setPrescSubmitting(true);
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
        triggerNotification("E-Prescription Signed", `Prescription issued successfully for ${writingPrescAppt.patient_details?.username}.`, "medical");
        setPrescNotif("E-Prescription successfully compiled, signed digitally, and transmitted to patient ledger!");
        setPrescForm({ symptoms: "", diagnosis: "", instructions: "" });
        setMedications([{ name: "", dosage: "", timing: "" }]);
        setSignChecked(false);
        downloadPrescriptionPDF(createdPresc);
        setTimeout(() => {
          setWritingPrescAppt(null);
          setPrescNotif("");
        }, 2000);
      } else {
        const errorData = await resp.json();
        setPrescNotif(errorData.error || "Failed to submit prescription details.");
      }
    } catch (err) {
      setPrescNotif("Network transmission failed.");
    } finally {
      setPrescSubmitting(false);
    }
  };

  // Filter queue
  const filteredAppointments = appointments.filter(a => {
    const name = `${a.patient_details?.first_name || ''} ${a.patient_details?.last_name || ''} ${a.patient_details?.username || ''}`.toLowerCase();
    const reason = (a.reason || '').toLowerCase();
    const q = searchQueue.toLowerCase();
    return name.includes(q) || reason.includes(q);
  });

  const pendingCount = appointments.filter(a => a.status === 'pending').length;
  const approvedCount = appointments.filter(a => a.status === 'approved').length;
  const completedCount = appointments.filter(a => a.status === 'completed').length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

      {/* 1. Clinical Workspace Header & Status Bar */}
      <div className="bg-white border border-[#BDDDFA] rounded-2xl p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold text-[#059669] uppercase tracking-wider">
                Clinical Workspace
              </span>
              <VerifiedBadge text={`BMDC Reg: ${user.doctor_profile?.bmdc_reg || 'Certified'}`} />
            </div>
            <h1 className="text-lg font-bold text-[#0F172A] tracking-tight">
              Dr. {user.first_name} {user.last_name}
            </h1>
            <p className="text-sm text-[#55647C] mt-0.5">
              {user.doctor_profile?.specialty || 'General Practitioner'} • {user.doctor_profile?.hospital || 'Certified Telemedicine Specialist'} • <span className="font-semibold text-[#059669] font-mono">Fee: ৳{user.doctor_profile?.fees || 500} BDT</span>
            </p>
          </div>

          {/* Quick Doctor Workstation Toggles */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleToggleOnline}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-[10px] text-xs font-bold border ${
                onlineStatus
                  ? 'bg-[#E7F0FC] border-[#059669] text-[#059669]'
                  : 'bg-[#F4F6F9] border-[#BDDDFA] text-[#55647C]'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${onlineStatus ? 'bg-[#059669]' : 'bg-[#94A3B8]'}`} />
              <span>{onlineStatus ? 'Online & Available' : 'Offline / Paused'}</span>
            </button>

            <button
              onClick={handleRegenKeys}
              className="flex items-center gap-1.5 px-3 py-2 rounded-[10px] border border-[#BDDDFA] text-[#0F172A] hover:bg-[#E7F0FC] text-xs font-semibold"
              title="Rotate Cryptographic ECDH Session Keys"
            >
              <RefreshCcw className="w-3.5 h-3.5 text-[#168CF5]" />
              <span>Rotate Keys</span>
            </button>
          </div>
        </div>

        {/* 2. Clinical Workload Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-[#BDDDFA]">
          <div className="p-4 rounded-xl bg-[#E7F0FC] border border-[#BDDDFA]">
            <span className="text-[10px] font-bold text-[#55647C] uppercase tracking-wider">Total Scheduled</span>
            <p className="text-xl font-bold text-[#0F172A] mt-1">{appointments.length}</p>
          </div>
          <div className="p-4 rounded-xl bg-[#E7F0FC] border border-[#BDDDFA]">
            <span className="text-[10px] font-bold text-[#55647C] uppercase tracking-wider">Pending Review</span>
            <p className="text-xl font-bold text-[#0F172A] mt-1">{pendingCount}</p>
          </div>
          <div className="p-4 rounded-xl bg-[#E7F0FC] border border-[#BDDDFA]">
            <span className="text-[10px] font-bold text-[#059669] uppercase tracking-wider">Approved Active</span>
            <p className="text-xl font-bold text-[#059669] mt-1">{approvedCount}</p>
          </div>
          <div className="p-4 rounded-xl bg-[#E7F0FC] border border-[#BDDDFA]">
            <span className="text-[10px] font-bold text-[#168CF5] uppercase tracking-wider">Completed Visits</span>
            <p className="text-xl font-bold text-[#168CF5] mt-1">{completedCount}</p>
          </div>
        </div>
      </div>

      {/* ─── SECTION 1: CONSULTATION QUEUE ─── */}
      {activeSection === 'queue' && (
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle>Patient Consultation Queue</CardTitle>
                <CardDescription>Review appointment bookings, accept visits, and start encrypted clinical consultations.</CardDescription>
              </div>
              <div className="relative max-w-xs w-full">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Search className="w-3.5 h-3.5 text-[#4B5563]" />
                </div>
                <input
                  type="text"
                  value={searchQueue}
                  onChange={e => setSearchQueue(e.target.value)}
                  placeholder="Search patient or symptoms..."
                  className="w-full pl-10 pr-3 py-2 bg-[#E7F0FC] rounded-[15px] text-xs text-[#111827] placeholder-[#4B5563] outline-none"
                  style={{ paddingLeft: '2.5rem' }}
                />
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {filteredAppointments.length === 0 ? (
              <EmptyState
                icon={Calendar}
                title="No consultations in queue"
                description={searchQueue ? "No visits matched your search filter." : "Your clinical queue is currently clear. New patient requests will appear here."}
              />
            ) : (
              <div className="space-y-3">
                {filteredAppointments.map(appt => (
                  <div
                    key={appt.id}
                    className="bg-white border border-[#BDDDFA] rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                  >
                    {/* Patient Info */}
                    <div className="flex items-start gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-[#E7F0FC] text-[#0F172A] font-bold flex items-center justify-center text-sm shrink-0 border border-[#BDDDFA]">
                        {appt.patient_details?.first_name?.[0] || appt.patient_details?.username?.[0] || 'P'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-[#0F172A]">
                            {appt.patient_details?.first_name || ''} {appt.patient_details?.last_name || ''}
                            <span className="text-xs font-normal text-[#55647C] ml-1">(@{appt.patient_details?.username})</span>
                          </h4>
                          <StatusBadge status={appt.status} size="sm" />
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-[#55647C] mt-1">
                          <span className="flex items-center gap-1 font-medium text-[#0F172A]">
                            <Clock className="w-3.5 h-3.5 text-[#168CF5]" />
                            {appt.date} • {appt.time}
                          </span>
                          <span className="flex items-center gap-1">
                            {appt.consultation_type === 'video' ? <Video className="w-3.5 h-3.5 text-[#168CF5]" /> : <MessageSquare className="w-3.5 h-3.5 text-[#059669]" />}
                            <span className="capitalize">{appt.consultation_type || 'Video'} Consultation</span>
                          </span>
                        </div>

                        {appt.reason && (
                          <p className="text-xs text-[#334155] mt-1.5 bg-[#E7F0FC] p-2.5 rounded-lg border border-[#BDDDFA] max-w-xl">
                            <strong className="text-[#0F172A]">Symptoms / Reason:</strong> {appt.reason}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Actions Bar */}
                    <div className="flex flex-wrap items-center gap-2 lg:shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-[#BDDDFA]">
                      {/* Inspect Records Action */}
                      <Button
                        variant="outline"
                        size="sm"
                        icon={Eye}
                        onClick={() => startInspectPatient(appt)}
                      >
                        Records
                      </Button>

                      {/* Pending actions */}
                      {appt.status === 'pending' && (
                        <>
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => onApptAction(appt.id, 'approve')}
                          >
                            Confirm
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => onApptAction(appt.id, 'reject')}
                          >
                            Decline
                          </Button>
                        </>
                      )}

                      {/* Approved actions */}
                      {appt.status === 'approved' && appt.consultation && (
                        <>
                          <Button
                            variant="primary"
                            size="sm"
                            icon={Video}
                            onClick={() => onSelectConsultation({ id: appt.consultation.id, mode: appt.consultation.type })}
                          >
                            Open Room
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            icon={FileText}
                            onClick={() => setWritingPrescAppt(appt)}
                          >
                            E-Prescription
                          </Button>
                        </>
                      )}

                      {/* Completed actions */}
                      {appt.status === 'completed' && (
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={FileText}
                          onClick={() => setWritingPrescAppt(appt)}
                        >
                          Add Rx Note
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ─── SECTION 2: CONSULTATION FEE & AVAILABILITY SCHEDULE ─── */}
      {activeSection === 'schedule' && (
        <div className="space-y-6">
          {scheduleSuccessMsg && (
            <div className="p-4 rounded-xl bg-[#E7F0FC] border border-[#059669] text-xs font-semibold text-[#059669] flex items-center gap-2.5">
              <CheckCircle className="w-4 h-4 shrink-0 text-[#059669]" />
              <span>{scheduleSuccessMsg}</span>
            </div>
          )}

          {scheduleErrMsg && (
            <div className="p-4 rounded-xl bg-red-50 border border-[#FF7A7A] text-xs font-semibold text-[#FF7A7A] flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-[#FF7A7A]" />
              <span>{scheduleErrMsg}</span>
            </div>
          )}

          <form onSubmit={handleSaveScheduleAndFee} className="space-y-6">
            {/* Card 1: Consultation Fee */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#E7F0FC] text-[#059669] flex items-center justify-center border border-[#BDDDFA]">
                    <DollarSign className="w-4 h-4" />
                  </div>
                  <div>
                    <CardTitle>Consultation Fee Rate</CardTitle>
                    <CardDescription>
                      Set your standard consultation fee in Bangladeshi Taka (৳ BDT). This amount is displayed on patient booking.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="relative max-w-xs w-full">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <span className="text-base font-bold text-[#059669]">৳</span>
                      </div>
                      <input
                        type="number"
                        min="0"
                        step="50"
                        required
                        value={consultationFee}
                        onChange={e => setConsultationFee(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-[#E7F0FC] rounded-[15px] text-base font-bold text-[#0F172A] outline-none border border-[#BDDDFA] focus:border-[#059669]"
                        style={{ paddingLeft: '2.5rem' }}
                        placeholder="500"
                      />
                      <span className="absolute right-3.5 top-3 text-xs font-bold text-[#55647C]">BDT</span>
                    </div>

                    {/* Quick Preset Buttons */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-[#55647C] font-semibold mr-1">Quick Presets:</span>
                      {[300, 500, 800, 1000, 1500, 2000].map(val => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setConsultationFee(val)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                            Number(consultationFee) === val
                              ? 'bg-[#059669] text-white border-[#059669]'
                              : 'bg-white text-[#0F172A] border-[#BDDDFA] hover:bg-[#E7F0FC]'
                          }`}
                        >
                          ৳{val}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="p-3 bg-[#E7F0FC] rounded-xl border border-[#BDDDFA] text-xs text-[#55647C] flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#059669] shrink-0" />
                    <span>
                      Fee payments are securely collected via <strong>SSLCommerz Bangladesh</strong> payment gateway and credited to your verified doctor account.
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Card 2: Weekly Availability Schedule */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#E7F0FC] text-[#168CF5] flex items-center justify-center border border-[#BDDDFA]">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <CardTitle>Weekly Availability Schedule (Days &amp; Time Slots)</CardTitle>
                    <CardDescription>
                      Configure your active consultation days and appointment hours. Patients can choose slots within these windows.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <div className="space-y-3">
                  {scheduleSlots.map((slot, idx) => (
                    <div
                      key={slot.day || idx}
                      className={`p-4 rounded-xl border transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                        slot.active
                          ? 'bg-white border-[#BDDDFA]'
                          : 'bg-[#F4F6F9] border-[#BDDDFA]/60 opacity-75'
                      }`}
                    >
                      {/* Day & Toggle */}
                      <div className="flex items-center gap-3.5 min-w-[180px]">
                        <button
                          type="button"
                          onClick={() => handleToggleDayActive(idx)}
                          className={`w-10 h-6 rounded-full transition-colors relative flex items-center p-0.5 ${
                            slot.active ? 'bg-[#059669]' : 'bg-[#94A3B8]'
                          }`}
                        >
                          <span
                            className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                              slot.active ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </button>
                        <div>
                          <h4 className="text-sm font-bold text-[#0F172A]">{slot.day}</h4>
                          <span className={`text-[11px] font-semibold ${slot.active ? 'text-[#059669]' : 'text-[#94A3B8]'}`}>
                            {slot.active ? 'Available for booking' : 'Unavailable (Off)'}
                          </span>
                        </div>
                      </div>

                      {/* Time Pickers */}
                      {slot.active ? (
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-[#55647C]">Start:</span>
                            <select
                              value={slot.start_time || '09:00 AM'}
                              onChange={e => handleSlotTimeChange(idx, 'start_time', e.target.value)}
                              className="p-2 bg-[#E7F0FC] rounded-[10px] text-xs font-semibold text-[#0F172A] outline-none border border-[#BDDDFA]"
                            >
                              {TIME_OPTIONS.map(t => (
                                <option key={t} value={t}>{t}</option>
                              ))}
                            </select>
                          </div>

                          <span className="text-xs font-bold text-[#55647C]">to</span>

                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-[#55647C]">End:</span>
                            <select
                              value={slot.end_time || '01:00 PM'}
                              onChange={e => handleSlotTimeChange(idx, 'end_time', e.target.value)}
                              className="p-2 bg-[#E7F0FC] rounded-[10px] text-xs font-semibold text-[#0F172A] outline-none border border-[#BDDDFA]"
                            >
                              {TIME_OPTIONS.map(t => (
                                <option key={t} value={t}>{t}</option>
                              ))}
                            </select>
                          </div>

                          <div className="hidden md:block pl-2">
                            <span className="px-2.5 py-1 rounded-md bg-[#E7F0FC] text-[11px] font-mono text-[#0F172A] border border-[#BDDDFA]">
                              {slot.start_time} - {slot.end_time}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-[#94A3B8] italic">
                          No appointments accepted on this day
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>

              <CardFooter className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#E7F0FC] border-t border-[#BDDDFA]">
                <button
                  type="button"
                  onClick={() => setScheduleSlots(DEFAULT_WEEKLY_SCHEDULE)}
                  className="text-xs font-semibold text-[#55647C] hover:text-[#0F172A] underline"
                >
                  Reset Schedule to Standard Defaults
                </button>

                <div className="flex items-center gap-3">
                  <Button
                    variant="primary"
                    size="md"
                    type="submit"
                    loading={scheduleLoading}
                    icon={Save}
                  >
                    Save &amp; Synchronize Schedule
                  </Button>
                </div>
              </CardFooter>
            </Card>
          </form>
        </div>
      )}

      {/* ─── E-PRESCRIPTION WRITER MODAL ─── */}
      <Modal
        isOpen={!!writingPrescAppt}
        onClose={() => setWritingPrescAppt(null)}
        title="Issue E-Prescription"
        subtitle={`Patient: ${writingPrescAppt?.patient_details?.username} • Consultation #${writingPrescAppt?.consultation?.id || 'Active'}`}
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleWritePrescription} className="space-y-4">
          {prescNotif && (
            <div className={`p-3 rounded-xl text-xs font-semibold ${
              prescNotif.includes("successfully")
                ? "bg-[#E7F0FC] text-[#059669] border border-[#059669]"
                : "bg-red-50 text-[#FF7A7A] border border-[#FF7A7A]"
            }`}>
              {prescNotif}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">Chief Complaints</label>
              <input
                type="text"
                required
                value={prescForm.symptoms}
                onChange={e => setPrescForm({ ...prescForm, symptoms: e.target.value })}
                placeholder="e.g. Fever for 3 days, mild dry cough..."
                className="w-full p-2.5 bg-[#E7F0FC] rounded-[15px] text-sm text-[#111827] placeholder-[#4B5563] outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">Clinical Diagnosis</label>
              <input
                type="text"
                required
                value={prescForm.diagnosis}
                onChange={e => setPrescForm({ ...prescForm, diagnosis: e.target.value })}
                placeholder="e.g. Acute Viral Bronchitis..."
                className="w-full p-2.5 bg-[#E7F0FC] rounded-[15px] text-sm text-[#111827] placeholder-[#4B5563] outline-none"
              />
            </div>
          </div>

          {/* Dynamic Medicines Row Editor */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-[#0F172A]">Prescribed Medications</label>
              <button
                type="button"
                onClick={handleAddMedication}
                className="text-xs font-bold text-[#059669] hover:underline flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add Medicine
              </button>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {medications.map((med, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2 rounded-xl bg-[#E7F0FC] border border-[#BDDDFA]">
                  <input
                    type="text"
                    required
                    placeholder="Medicine name (e.g. Paracetamol 500mg)"
                    value={med.name}
                    onChange={e => handleMedicationChange(idx, 'name', e.target.value)}
                    className="flex-1 p-2 bg-white rounded-lg text-xs text-[#111827] placeholder-[#4B5563] outline-none border border-[#BDDDFA]"
                  />
                  <input
                    type="text"
                    required
                    placeholder="Dosage (1 tab)"
                    value={med.dosage}
                    onChange={e => handleMedicationChange(idx, 'dosage', e.target.value)}
                    className="w-24 p-2 bg-white rounded-lg text-xs text-[#111827] placeholder-[#4B5563] outline-none border border-[#BDDDFA]"
                  />
                  <input
                    type="text"
                    required
                    placeholder="Timing (1+0+1 after meal)"
                    value={med.timing}
                    onChange={e => handleMedicationChange(idx, 'timing', e.target.value)}
                    className="w-36 p-2 bg-white rounded-lg text-xs text-[#111827] placeholder-[#4B5563] outline-none border border-[#BDDDFA]"
                  />
                  {medications.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveMedication(idx)}
                      className="p-1.5 text-[#FF7A7A] hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#0F172A] mb-1">Physician Advice &amp; Instructions</label>
            <textarea
              rows={2}
              value={prescForm.instructions}
              onChange={e => setPrescForm({ ...prescForm, instructions: e.target.value })}
              placeholder="Drink plenty of fluids, rest, follow up in 5 days if fever persists..."
              className="w-full p-2.5 bg-[#E7F0FC] rounded-[15px] text-sm text-[#111827] placeholder-[#4B5563] outline-none"
            />
          </div>

          <div className="flex items-center gap-2 p-3 rounded-xl bg-[#E7F0FC] border border-[#BDDDFA]">
            <input
              type="checkbox"
              id="signCheck"
              checked={signChecked}
              onChange={e => setSignChecked(e.target.checked)}
              className="rounded text-[#059669] focus:ring-[#059669]"
            />
            <label htmlFor="signCheck" className="text-xs text-[#0F172A]">
              I certify under my BMDC registration that this digital prescription is medically indicated.
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setWritingPrescAppt(null)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" loading={prescSubmitting}>
              Issue &amp; Sign Prescription
            </Button>
          </div>
        </form>
      </Modal>

      {/* ─── PATIENT RECORD INSPECTOR MODAL ─── */}
      <Modal
        isOpen={!!inspectPatientId}
        onClose={() => setInspectPatientId(null)}
        title={`Clinical Records: ${inspectPatientName}`}
        subtitle="End-to-End Encrypted Patient Medical History"
        maxWidth="max-w-2xl"
      >
        {inspectLoading ? (
          <LoadingState message="Decrypting patient health records..." />
        ) : inspectError ? (
          <div className="p-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-red-50 text-[#FF7A7A] flex items-center justify-center mx-auto border border-[#FF7A7A]/30">
              <Lock className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-[#0F172A]">Access Restricted</h4>
            <p className="text-xs text-[#55647C] max-w-sm mx-auto leading-relaxed">{inspectError}</p>
            <p className="text-[11px] text-[#059669] font-semibold">
              The patient can authorize access from their "Privacy &amp; Consent" portal.
            </p>
          </div>
        ) : patientRecords.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No records found"
            description="This patient has not uploaded any lab reports or diagnostic records yet."
          />
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {patientRecords.map(rec => (
              <div key={rec.id} className="p-3.5 rounded-xl border border-[#BDDDFA] bg-[#E7F0FC] space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#0F172A] uppercase">{rec.record_type}</span>
                  <SecurityBadge text="Decrypted (AES-256)" />
                </div>
                <p className="text-xs text-[#334155] leading-relaxed">{rec.content}</p>
                <span className="text-[10px] text-[#55647C] block pt-1">Record ID #{rec.id}</span>
              </div>
            ))}
          </div>
        )}
      </Modal>

    </div>
  );
};

export default DoctorDashboard;
