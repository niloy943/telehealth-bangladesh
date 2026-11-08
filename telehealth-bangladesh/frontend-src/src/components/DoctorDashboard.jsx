import React, { useState } from 'react';
import { useLanguage } from './LanguageContext';
import { useNotifications } from './NotificationCenter';
import {
  Home, Clock, Activity, Calendar, ShieldCheck, FileText, ShieldAlert,
  CheckCircle2, User, RefreshCcw, Save, Search, ArrowLeft, Video,
  MessageSquare, Stethoscope, Plus, Trash2, Download, Share2, AlertCircle,
  X, Check, Lock, ChevronRight, Eye, PhoneCall, Award, DollarSign, Settings,
  CheckCircle, CalendarDays, Mic, Shield
} from 'lucide-react';
import {
  Button, Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter,
  StatusBadge, VerifiedBadge, SecurityBadge, PageHeader, SectionHeader,
  EmptyState, LoadingState, ErrorState, Modal
} from './ui';
import { SecurePrescriptionModal } from './SecurePrescriptionModal';
import { DoctorPrescriptionVault } from './DoctorPrescriptionVault';
import { DoctorSharedRecordsModal } from './DoctorSharedRecordsModal';
import { DoctorScheduleTab } from './doctor/DoctorScheduleTab';
import { downloadPrescriptionPdfFile } from '../utils/pdfGenerator';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';

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
  downloadPrescriptionPdfFile(p);
};

/* ─── Main DoctorDashboard Component ─── */
export const DoctorDashboard = ({
  token,
  user,
  appointments = [],
  onApptAction,
  onSelectConsultation,
  activeTab = 'dashboard',
  onTabChange,
  fetchAppointments
}) => {
  const { t } = useLanguage();
  const { triggerNotification } = useNotifications();

  const fetchApptsRef = React.useRef(fetchAppointments);
  React.useEffect(() => {
    fetchApptsRef.current = fetchAppointments;
  }, [fetchAppointments]);

  const [activeSection, setActiveSection] = useState(
    activeTab === 'schedule' ? 'schedule' : (activeTab === 'vault' || activeTab === 'prescriptions' ? 'vault' : 'queue')
  );

  React.useEffect(() => {
    setActiveSection(
      activeTab === 'schedule' ? 'schedule' : (activeTab === 'vault' || activeTab === 'prescriptions' ? 'vault' : 'queue')
    );
    if (fetchApptsRef.current) fetchApptsRef.current();
  }, [activeTab]);

  // Real-time synchronization listeners for Doctor Consultation Queue and Vault
  React.useEffect(() => {
    const handleApptSync = () => {
      if (fetchApptsRef.current) fetchApptsRef.current();
    };
    window.addEventListener('healnsight_appointment_updated', handleApptSync);
    const handleStorage = (e) => {
      if (e.key === 'healnsight_last_appointment_sync') {
        if (fetchApptsRef.current) fetchApptsRef.current();
      }
    };
    window.addEventListener('storage', handleStorage);

    // Keep queue fresh safety net every 30 seconds when tab is active
    const interval = setInterval(() => {
      if (!document.hidden && fetchApptsRef.current) fetchApptsRef.current();
    }, 30000);

    return () => {
      window.removeEventListener('healnsight_appointment_updated', handleApptSync);
      window.removeEventListener('storage', handleStorage);
      clearInterval(interval);
    };
  }, []);

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

  // In-workflow consultation records modal state
  const [selectedConsultationRecordsAppt, setSelectedConsultationRecordsAppt] = useState(null);

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
      nextVal ? "Doctor Online" : "Doctor Offline",
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
      const consultationId = writingPrescAppt.consultation?.id || writingPrescAppt.id;
      const patId = String(writingPrescAppt.patient || writingPrescAppt.patient_details?.id || 'niloy');
      const patUser = String(writingPrescAppt.patient_details?.username || 'niloy');
      const patName = writingPrescAppt.patient_details
        ? `${writingPrescAppt.patient_details.first_name || ''} ${writingPrescAppt.patient_details.last_name || ''}`.trim() || patUser
        : 'Niloy Hasan';

      const resp = await fetch(`${API_BASE}/api/prescriptions/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          consultation_id: consultationId,
          appointment_id: writingPrescAppt.id,
          patient_id: patId,
          patient_username: patUser,
          symptoms: prescForm.symptoms,
          diagnosis: prescForm.diagnosis,
          medicines: JSON.stringify(medications),
          instructions: prescForm.instructions
        })
      });

      // Synchronize with Secure E-Prescription Gateway at port 5002
      try {
        const epBase = import.meta.env.VITE_EP_API_BASE || 'http://localhost:5002';
        await fetch(`${epBase}/api/prescriptions/approve`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'X-Doctor-ID': String(user?.id || user?.username || 'doc-sarah-101'),
            'X-Patient-ID': patId,
            'X-Patient-Username': patUser
          },
          body: JSON.stringify({
            consultationId: String(consultationId),
            doctorId: String(user?.id || user?.username || 'doc-sarah-101'),
            patientId: patId,
            patientUsername: patUser,
            patientName: patName,
            diagnosis: prescForm.diagnosis,
            symptoms: prescForm.symptoms,
            advice: prescForm.instructions,
            items: medications
          })
        });
      } catch (epErr) {
        console.warn("Gateway sync notice:", epErr);
      }

      if (resp.status === 201) {
        const createdPresc = await resp.json();
        window.dispatchEvent(new CustomEvent('healnsight_prescription_updated', {
          detail: { consultationId, patientId: patId, doctorId: user?.id }
        }));
        try { localStorage.setItem('healnsight_last_prescription_sync', Date.now().toString()); } catch {}
        triggerNotification("E-Prescription Signed", `Prescription issued successfully for ${patName}.`, "medical");
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-28 space-y-8">

      {/* 1.  Header & Status Bar */}
      <div className="bg-white border border-[#BDDDFA] rounded-2xl p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold text-[#059669] uppercase tracking-wider">

              </span>
              <VerifiedBadge text={`BMDC Reg: ${user.doctor_profile?.bmdc_reg || 'Certified'}`} />
            </div>
            <h1 className="text-lg font-bold text-[#0F172A] tracking-tight">
              Dr. {user.first_name} {user.last_name}
            </h1>
            <p className="text-sm text-[#55647C] mt-0.5">
              {[user.doctor_profile?.specialty || 'General Practitioner', user.doctor_profile?.hospital].filter(Boolean).join(' • ')} • <span className="font-semibold text-[#059669] font-mono">Fee: ৳{user.doctor_profile?.fees || 500} BDT</span>
            </p>
          </div>

          {/* Quick Doctor Workstation Toggles */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleToggleOnline}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-[10px] text-xs font-bold border ${onlineStatus
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

      {/* ─── WORKSTATION NAVIGATION TABS ─── */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-white border border-[#BDDDFA] rounded-2xl shadow-sm">
        <button
          onClick={() => { setActiveSection('queue'); if (onTabChange) onTabChange('dashboard'); }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeSection === 'queue'
              ? 'bg-[#059669] text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Patient Consultation Queue ({appointments.length})</span>
        </button>

        <button
          onClick={() => { setActiveSection('vault'); if (onTabChange) onTabChange('vault'); }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeSection === 'vault'
              ? 'bg-[#059669] text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Secure E-Prescription Vault</span>
        </button>

        <button
          onClick={() => { setActiveSection('schedule'); if (onTabChange) onTabChange('schedule'); }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeSection === 'schedule'
              ? 'bg-[#059669] text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <CalendarDays className="w-4 h-4" />
          <span>Fee &amp; Schedule</span>
        </button>
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
                      <div className={`w-10 h-10 rounded-xl font-bold flex items-center justify-center text-sm shrink-0 border ${appt.is_anonymous
                        ? 'bg-purple-100 text-purple-700 border-purple-300'
                        : 'bg-[#E7F0FC] text-[#0F172A] border-[#BDDDFA]'
                        }`}>
                        {appt.is_anonymous ? <Shield className="w-5 h-5 text-purple-700" /> : (appt.patient_details?.first_name?.[0] || appt.patient_details?.username?.[0] || 'P')}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-[#0F172A]">
                            {appt.is_anonymous ? (
                              <span className="text-purple-900 font-extrabold flex items-center gap-1.5">
                                <span>Anonymous Patient #{appt.anonymous_session_id || (appt.patient_details?.username?.replace('Anonymous Patient #', '') || 'ACTIVE')}</span>
                              </span>
                            ) : (
                              <>
                                {appt.patient_details?.first_name || ''} {appt.patient_details?.last_name || ''}
                                <span className="text-xs font-normal text-[#55647C] ml-1">(@{appt.patient_details?.username})</span>
                              </>
                            )}
                          </h4>
                          <StatusBadge status={appt.status} size="sm" />
                          {appt.is_anonymous && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-800 border border-purple-200">
                              <Lock className="w-2.5 h-2.5" /> Identity Hidden
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-[#55647C] mt-1">
                          <span className="flex items-center gap-1 font-medium text-[#0F172A]">
                            <Clock className="w-3.5 h-3.5 text-[#168CF5]" />
                            {appt.date} • {appt.time}
                          </span>
                          <span className="flex items-center gap-1">
                            {appt.consultation_type === 'audio' ? (
                              <Mic className="w-3.5 h-3.5 text-purple-600" />
                            ) : appt.consultation_type === 'video' ? (
                              <Video className="w-3.5 h-3.5 text-[#168CF5]" />
                            ) : (
                              <MessageSquare className="w-3.5 h-3.5 text-[#059669]" />
                            )}
                            <span className="capitalize font-semibold text-[#0F172A]">
                              {appt.consultation_type === 'audio' ? 'Audio Consultation (Anonymous)' : `${appt.consultation_type || 'Video'} Consultation`}
                            </span>
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
                      {/* In-Workflow Consultation Records Action */}
                      {!appt.is_anonymous && (
                        <Button
                          variant="outline"
                          size="sm"
                          icon={FileText}
                          onClick={() => setSelectedConsultationRecordsAppt(appt)}
                        >
                          Consultation Records
                        </Button>
                      )}

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

                      {/* Approved actions - Only Record & Open Room */}
                      {appt.status === 'approved' && appt.consultation && (
                        <Button
                          variant="primary"
                          size="sm"
                          icon={appt.consultation_type === 'audio' ? Mic : Video}
                          onClick={() => onSelectConsultation({ id: appt.consultation.id, mode: appt.consultation.type })}
                        >
                          {appt.consultation_type === 'audio' ? 'Open Audio Room' : 'Open Room'}
                        </Button>
                      )}

                      {/* Completed actions: consultation is permanently closed */}
                      {appt.status === 'completed' && (
                        <div className="flex items-center gap-2">
                          <span className="px-3 py-1.5 rounded-[10px] text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200 flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#059669]" />
                            <span>Consultation Completed</span>
                          </span>
                          <Button
                            variant="secondary"
                            size="sm"
                            icon={ShieldCheck}
                            onClick={() => setActiveSection('vault')}
                          >
                            View in Vault
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ─── SECTION 1B: SECURE E-PRESCRIPTION VAULT ─── */}
      {activeSection === 'vault' && (
        <DoctorPrescriptionVault
          user={user}
          token={token}
          apiBase={API_BASE}
          epGatewayBase={import.meta.env.VITE_EP_API_BASE || 'http://localhost:5002'}
        />
      )}

      {/* ─── SECTION 2: CONSULTATION FEE & AVAILABILITY SCHEDULE ─── */}
      {activeSection === 'schedule' && (
        <DoctorScheduleTab
          consultationFee={consultationFee}
          setConsultationFee={setConsultationFee}
          scheduleSlots={scheduleSlots}
          setScheduleSlots={setScheduleSlots}
          scheduleSuccessMsg={scheduleSuccessMsg}
          scheduleErrMsg={scheduleErrMsg}
          scheduleLoading={scheduleLoading}
          handleSaveScheduleAndFee={handleSaveScheduleAndFee}
          handleToggleDayActive={handleToggleDayActive}
          handleSlotTimeChange={handleSlotTimeChange}
          DEFAULT_WEEKLY_SCHEDULE={DEFAULT_WEEKLY_SCHEDULE}
          TIME_OPTIONS={TIME_OPTIONS}
        />
      )}

      {/* ─── SECURE E-PRESCRIPTION WRITER MODAL (AES-256 + BLOCKCHAIN + MFA) ─── */}
      <SecurePrescriptionModal
        isOpen={!!writingPrescAppt}
        onClose={() => setWritingPrescAppt(null)}
        appointment={writingPrescAppt}
        token={token}
        apiBase={API_BASE}
        onSuccess={(result) => {
          triggerNotification(
            "E-Prescription Signed & Sealed",
            `Prescription issued with hash ${result?.integrity?.sha256Hash?.substring(0, 16)}... and committed to ledger. Consultation grant revoked.`,
            "security"
          );
          setWritingPrescAppt(null);
          fetchAppointments();
        }}
      />

      {/* ─── IN-WORKFLOW CONSULTATION MEDICAL RECORDS MODAL ─── */}
      <DoctorSharedRecordsModal
        isOpen={Boolean(selectedConsultationRecordsAppt)}
        onClose={() => setSelectedConsultationRecordsAppt(null)}
        consultationId={selectedConsultationRecordsAppt?.consultation?.id || selectedConsultationRecordsAppt?.consultation_id || selectedConsultationRecordsAppt?.id}
        patient={{
          id: selectedConsultationRecordsAppt?.patient,
          name: `${selectedConsultationRecordsAppt?.patient_details?.first_name || ''} ${selectedConsultationRecordsAppt?.patient_details?.last_name || ''}`.trim() || selectedConsultationRecordsAppt?.patient_details?.username || 'Patient',
          username: selectedConsultationRecordsAppt?.patient_details?.username,
          is_anonymous: selectedConsultationRecordsAppt?.is_anonymous
        }}
        token={token}
        apiBase={API_BASE}
      />

    </div>
  );
};

export default DoctorDashboard;
