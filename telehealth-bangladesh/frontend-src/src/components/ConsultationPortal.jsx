import React, { useState, useEffect, useRef } from 'react';
import {
  Video, Mic, MicOff, PhoneCall, Calendar, Clock, User, ShieldCheck,
  Lock, CheckCircle2, AlertCircle, FileText, Download, Play, Plus,
  Search, Filter, Activity, Stethoscope, ChevronRight, Volume2,
  RefreshCw, Check, X, Shield, Sparkles, MessageSquare, Headphones
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Button, StatusBadge, Modal, EmptyState, SecurityBadge, VerifiedBadge } from './ui';
import { useLanguage } from './LanguageContext';
import { useNotifications } from './NotificationCenter';

const API_BASE = import.meta.env.VITE_API_BASE || window.location.origin;

export const ConsultationPortal = ({
  token,
  user,
  appointments = [],
  onApptAction,
  onSelectConsultation,
  onTabChange,
  fetchAppointments
}) => {
  const { t } = useLanguage();
  const { triggerNotification } = useNotifications();

  // Filter & Search states
  const [activeFilter, setActiveFilter] = useState('all'); // all, audio, video, approved, pending, completed
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAppt, setSelectedAppt] = useState(null);

  // Diagnostics Modal State
  const [deviceModalOpen, setDeviceModalOpen] = useState(false);
  const [micTesting, setMicTesting] = useState(false);
  const [micVolume, setMicVolume] = useState(0);
  const [camTesting, setCamTesting] = useState(false);
  const videoRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const micStreamRef = useRef(null);

  // Doctor E-Prescription Modal State
  const [rxModalAppt, setRxModalAppt] = useState(null);
  const [rxForm, setRxForm] = useState({ symptoms: '', diagnosis: '', instructions: '' });
  const [medicines, setMedicines] = useState([{ name: '', dosage: '', timing: '' }]);
  const [rxSigned, setRxSigned] = useState(false);
  const [rxSubmitting, setRxSubmitting] = useState(false);
  const [rxSuccessMsg, setRxSuccessMsg] = useState('');

  // Doctor Clinical Record View State
  const [recordsModalPatient, setRecordsModalPatient] = useState(null);
  const [patientRecords, setPatientRecords] = useState([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [recordsError, setRecordsError] = useState('');

  // Patient Prescription Viewer State
  const [viewingRx, setViewingRx] = useState(null);

  // Doctor Online Status state
  const isDoctor = user?.role === 'doctor';
  const [isOnline, setIsOnline] = useState(user?.doctor_profile?.online ?? true);

  const toggleDoctorStatus = async () => {
    const nextState = !isOnline;
    setIsOnline(nextState);
    triggerNotification(
      nextState ? "Specialist Online" : "Specialist Offline",
      `Your consultation room is now ${nextState ? "open for patient visits" : "paused"}.`,
      "system"
    );
    try {
      await fetch(`${API_BASE}/api/profile/`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ online: nextState })
      });
    } catch (e) {
      console.error(e);
    }
  };

  // Pre-call Device Diagnostic Logic
  const startMicTest = async () => {
    try {
      setMicTesting(true);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      micStreamRef.current = stream;
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateVolume = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const avg = sum / bufferLength;
        setMicVolume(Math.min(100, Math.round((avg / 128) * 100)));
        if (micStreamRef.current) {
          requestAnimationFrame(updateVolume);
        }
      };
      updateVolume();
    } catch (err) {
      console.error("Microphone test error: ", err);
      triggerNotification("Audio Test Failed", "Microphone access blocked or not detected.", "warning");
      setMicTesting(false);
    }
  };

  const stopMicTest = () => {
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop());
      micStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => { });
      audioContextRef.current = null;
    }
    setMicTesting(false);
    setMicVolume(0);
  };

  const startCamTest = async () => {
    try {
      setCamTesting(true);
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => { });
      }
    } catch (err) {
      console.error("Camera test error: ", err);
      triggerNotification("Camera Test Failed", "Camera access blocked or not detected.", "warning");
      setCamTesting(false);
    }
  };

  const stopCamTest = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    setCamTesting(false);
  };

  const closeDeviceModal = () => {
    stopMicTest();
    stopCamTest();
    setDeviceModalOpen(false);
  };

  // E-Prescription Handler
  const handleAddMedicine = () => {
    setMedicines([...medicines, { name: '', dosage: '', timing: '' }]);
  };

  const handleRemoveMedicine = (idx) => {
    setMedicines(medicines.filter((_, i) => i !== idx));
  };

  const handleUpdateMedicine = (idx, field, val) => {
    setMedicines(medicines.map((m, i) => (i === idx ? { ...m, [field]: val } : m)));
  };

  const handleIssueRxSubmit = async (e) => {
    e.preventDefault();
    if (!rxModalAppt?.consultation?.id && !rxModalAppt?.id) {
      triggerNotification("Error", "No consultation session bound to this appointment.", "warning");
      return;
    }
    if (!rxSigned) {
      alert("Please confirm the BMDC digital signature certification check.");
      return;
    }
    setRxSubmitting(true);
    setRxSuccessMsg('');
    try {
      const consultationId = rxModalAppt.consultation?.id || rxModalAppt.id;
      const resp = await fetch(`${API_BASE}/api/prescriptions/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          consultation_id: consultationId,
          symptoms: rxForm.symptoms,
          diagnosis: rxForm.diagnosis,
          medicines: JSON.stringify(medicines),
          instructions: rxForm.instructions
        })
      });

      if (resp.status === 201) {
        const data = await resp.json();
        setRxSuccessMsg("E-Prescription successfully compiled, signed, and saved to national patient ledger!");
        triggerNotification("E-Prescription Issued", "Digital prescription is now visible to patient.", "medical");
        if (fetchAppointments) fetchAppointments();
        setTimeout(() => {
          setRxModalAppt(null);
          setRxSuccessMsg('');
          setRxForm({ symptoms: '', diagnosis: '', instructions: '' });
          setMedicines([{ name: '', dosage: '', timing: '' }]);
          setRxSigned(false);
        }, 1800);
      } else {
        const errData = await resp.json();
        triggerNotification("Prescription Error", errData.error || "Failed to create prescription.", "warning");
      }
    } catch (err) {
      console.error(err);
      triggerNotification("Network Error", "Could not reach prescription server.", "warning");
    } finally {
      setRxSubmitting(false);
    }
  };

  // Inspect Health Records (Doctor Only, non-anonymous)
  const handleInspectRecords = async (appt) => {
    if (appt.is_anonymous) {
      triggerNotification("Protected Session", "Anonymous patient medical records are sealed.", "warning");
      return;
    }
    const patientName = `${appt.patient_details?.first_name || ''} ${appt.patient_details?.last_name || ''}`.trim() || appt.patient_details?.username || "Patient";
    setRecordsModalPatient({ id: appt.patient, name: patientName });
    setPatientRecords([]);
    setRecordsError('');
    setLoadingRecords(true);

    try {
      const resp = await fetch(`${API_BASE}/api/records/?patient_id=${appt.patient}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (resp.status === 200) {
        const data = await resp.json();
        setPatientRecords(Array.isArray(data) ? data : []);
      } else {
        const err = await resp.json();
        setRecordsError(err.detail || "Patient has not authorized active clinical access consent.");
      }
    } catch (err) {
      setRecordsError("Could not retrieve clinical health records.");
    } finally {
      setLoadingRecords(false);
    }
  };

  // Filter & Search appointments
  const filteredAppointments = appointments.filter(appt => {
    const isAudio = appt.consultation_type === 'audio';
    const isVideo = appt.consultation_type === 'video' || (!appt.consultation_type && !isAudio);

    // Filter matching
    if (activeFilter === 'audio' && !isAudio) return false;
    if (activeFilter === 'video' && !isVideo) return false;
    if (activeFilter === 'approved' && appt.status !== 'approved') return false;
    if (activeFilter === 'pending' && appt.status !== 'pending') return false;
    if (activeFilter === 'completed' && appt.status !== 'completed') return false;

    // Search query matching
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const docName = `${appt.doctor_details?.first_name || ''} ${appt.doctor_details?.last_name || ''}`.toLowerCase();
    const patName = `${appt.patient_details?.first_name || ''} ${appt.patient_details?.last_name || ''} ${appt.patient_details?.username || ''}`.toLowerCase();
    const reason = (appt.reason || '').toLowerCase();
    const anonId = (appt.anonymous_session_id || '').toLowerCase();

    return docName.includes(q) || patName.includes(q) || reason.includes(q) || anonId.includes(q);
  });

  // Calculate Metrics
  const totalCount = appointments.length;
  const audioCount = appointments.filter(a => a.consultation_type === 'audio').length;
  const videoCount = appointments.filter(a => a.consultation_type === 'video' || !a.consultation_type).length;
  const pendingCount = appointments.filter(a => a.status === 'pending').length;
  const approvedCount = appointments.filter(a => a.status === 'approved').length;
  const completedCount = appointments.filter(a => a.status === 'completed').length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

      {/* TOP BANNER & ACTION HEADER */}
      <div className="bg-white border border-[#BDDDFA] rounded-2xl p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <h1 className="text-xl sm:text-2xl font-black text-[#0F172A] tracking-tight">
              {isDoctor ? "Clinical Consultations & Queue" : "My Consultations"}
            </h1>
            <p className="text-xs sm:text-sm text-[#55647C] max-w-2xl leading-relaxed">
              {isDoctor
                ? "Manage your patient visits, open encrypted video consultation rooms, connect to anonymous audio callers, inspect patient records, and digitally sign prescriptions."
                : ""}
            </p>
          </div>

          {/* Action Buttons Right Side */}
          <div className="flex flex-wrap items-center gap-3">
            {isDoctor && (
              <button
                onClick={toggleDoctorStatus}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-[12px] text-xs font-bold border transition-all cursor-pointer ${isOnline
                  ? "bg-[#E7F0FC] border-[#059669] text-[#059669] shadow-sm"
                  : "bg-[#F4F6F9] border-[#BDDDFA] text-[#55647C]"
                  }`}
                title="Toggle Online Consultation Availability"
              >
                <span className={`w-2.5 h-2.5 rounded-full ${isOnline ? "bg-[#059669] animate-pulse" : "bg-[#94A3B8]"}`} />
                <span>{isOnline ? "Online / Taking Calls" : "Paused / Offline"}</span>
              </button>
            )}

            <Button
              variant="outline"
              size="md"
              icon={Headphones}
              onClick={() => setDeviceModalOpen(true)}
              className="text-xs font-bold border-[#BDDDFA]"
            >
              Hardware &amp; Audio Test
            </Button>

            {!isDoctor && onTabChange && (
              <Button
                variant="primary"
                size="md"
                icon={Plus}
                onClick={() => onTabChange('booking')}
                className="text-xs font-bold shadow-sm"
              >
                Book Consultation
              </Button>
            )}
          </div>
        </div>

        {/* METRICS ROW */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 mt-6 pt-6 border-t border-[#BDDDFA]">
          <div className="p-3.5 rounded-xl bg-[#E7F0FC] border border-[#BDDDFA]">
            <span className="text-[10px] font-bold text-[#55647C] uppercase tracking-wider block">Total Sessions</span>
            <p className="text-xl font-black text-[#0F172A] mt-1">{totalCount}</p>
          </div>
          <div className="p-3.5 rounded-xl bg-purple-50 border border-purple-200">
            <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider block">Anonymous Audio</span>
            <p className="text-xl font-black text-purple-900 mt-1">{audioCount}</p>
          </div>
          <div className="p-3.5 rounded-xl bg-blue-50 border border-[#BDDDFA]">
            <span className="text-[10px] font-bold text-[#168CF5] uppercase tracking-wider block">Video Visits</span>
            <p className="text-xl font-black text-[#168CF5] mt-1">{videoCount}</p>
          </div>
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200">
            <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">Pending Review</span>
            <p className="text-xl font-black text-amber-900 mt-1">{pendingCount}</p>
          </div>
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200">
            <span className="text-[10px] font-bold text-[#059669] uppercase tracking-wider block">Confirmed Active</span>
            <p className="text-xl font-black text-[#059669] mt-1">{approvedCount}</p>
          </div>
          <div className="p-3.5 rounded-xl bg-[#F4F6F9] border border-[#BDDDFA]">
            <span className="text-[10px] font-bold text-[#55647C] uppercase tracking-wider block">Completed</span>
            <p className="text-xl font-black text-[#0F172A] mt-1">{completedCount}</p>
          </div>
        </div>
      </div>

      {/* FILTER & SEARCH CONTROLS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-white border border-[#BDDDFA] rounded-xl shadow-xs">
          {[
            { id: 'all', label: `All (${totalCount})` },
            { id: 'audio', label: `🎙️ Audio (${audioCount})` },
            { id: 'video', label: `📹 Video (${videoCount})` },
            { id: 'approved', label: `Approved (${approvedCount})` },
            { id: 'pending', label: `Pending (${pendingCount})` },
            { id: 'completed', label: `Completed (${completedCount})` },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setActiveFilter(f.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeFilter === f.id
                ? 'bg-[#059669] text-white shadow-xs'
                : 'text-[#55647C] hover:text-[#0F172A] hover:bg-[#E7F0FC]'
                }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative max-w-sm w-full">
          <Search className="w-4 h-4 text-[#55647C] absolute left-3.5 top-3 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={isDoctor ? "Search patient, anonymous ID, symptoms..." : "Search doctor, specialty, complaints..."}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#BDDDFA] rounded-[15px] text-xs font-medium text-[#0F172A] placeholder-[#94A3B8] outline-none focus:border-[#059669] shadow-xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-3 text-[#94A3B8] hover:text-[#0F172A]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* CONSULTATION SESSIONS LIST */}
      <div className="space-y-4">
        {filteredAppointments.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title="No consultations found"
            description={
              searchQuery
                ? "No appointments match your search keywords. Try adjusting your query."
                : activeFilter !== 'all'
                  ? `There are currently no consultations under the '${activeFilter}' filter.`
                  : isDoctor
                    ? "Your consultation schedule is clear. Newly booked patient sessions will appear here automatically."
                    : "You have no upcoming consultations scheduled. Book a certified specialist to get medical care."
            }
            action={
              !isDoctor && onTabChange ? (
                <Button size="sm" onClick={() => onTabChange('booking')}>
                  Book Consultation Now
                </Button>
              ) : null
            }
          />
        ) : (
          filteredAppointments.map(appt => {
            const isAudio = appt.consultation_type === 'audio';
            const isVideo = appt.consultation_type === 'video' || (!appt.consultation_type && !isAudio);
            const isAnonymous = appt.is_anonymous || isAudio;
            const isApproved = appt.status === 'approved';
            const isPending = appt.status === 'pending';
            const isCompleted = appt.status === 'completed';

            // Patient details (for doctor view)
            const patientName = isAnonymous
              ? `Anonymous Patient #${appt.anonymous_session_id || 'A7F3K2'}`
              : `${appt.patient_details?.first_name || ''} ${appt.patient_details?.last_name || ''}`.trim() || appt.patient_details?.username || "Patient";

            // Doctor details (for patient view)
            const doctorName = `Dr. ${appt.doctor_details?.first_name || ''} ${appt.doctor_details?.last_name || ''}`.trim();
            const doctorSpecialty = appt.doctor_details?.specialty || "";

            return (
              <Card key={appt.id} className="border border-[#BDDDFA] hover:border-[#168CF5] transition-all bg-white overflow-hidden shadow-xs">
                <div className="p-5 sm:p-6 space-y-4">

                  {/* Top Bar: Date/Time + Channel Mode + Status Badge */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#BDDDFA]/60 pb-3.5">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#E7F0FC] text-xs font-bold text-[#0F172A] border border-[#BDDDFA]">
                        <Calendar className="w-3.5 h-3.5 text-[#168CF5]" />
                        {appt.date}
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#E7F0FC] text-xs font-bold text-[#0F172A] border border-[#BDDDFA]">
                        <Clock className="w-3.5 h-3.5 text-[#168CF5]" />
                        {appt.time}
                      </span>

                      {/* Mode Badge */}
                      {isAudio ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-purple-100 text-purple-900 border border-purple-300">
                          <Mic className="w-3.5 h-3.5 text-purple-700" />
                          <span>Anonymous Consultation</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-[#E7F0FC] text-[#168CF5] border border-[#BDDDFA]">
                          <Video className="w-3.5 h-3.5 text-[#168CF5]" />
                          <span>Encrypted Video Call</span>
                        </span>
                      )}

                      {isAnonymous && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-800 border border-purple-200">
                          <Lock className="w-2.5 h-2.5" />
                          <span>Identity Protected</span>
                        </span>
                      )}
                    </div>

                    <StatusBadge status={appt.status} size="md" />
                  </div>

                  {/* Main Details Body */}
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                    <div className="flex items-start gap-4">
                      {/* Avatar / Icon Badge */}
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-base shrink-0 border ${isAnonymous
                        ? "bg-purple-100 text-purple-800 border-purple-300 shadow-xs"
                        : "bg-[#E7F0FC] text-[#059669] border-[#BDDDFA]"
                        }`}>
                        {isAnonymous ? (
                          <Lock className="w-6 h-6 text-purple-700" />
                        ) : isDoctor ? (
                          patientName[0]?.toUpperCase() || "P"
                        ) : (
                          <Stethoscope className="w-6 h-6 text-[#059669]" />
                        )}
                      </div>

                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-extrabold text-[#0F172A]">
                            {isDoctor ? patientName : doctorName}
                          </h3>
                          {!isDoctor && <VerifiedBadge text="BMDC Certified" />}
                        </div>

                        <p className="text-xs text-[#55647C]">
                          {isDoctor ? (
                            isAnonymous ? (
                              <span className="text-purple-700 font-semibold">
                                Real name, email, phone &amp; medical history sealed by anonymity protocol
                              </span>
                            ) : (
                              <span>Patient Username: @{appt.patient_details?.username}</span>
                            )
                          ) : (
                            <span>{[doctorSpecialty, appt.doctor_details?.hospital].filter(Boolean).join(' • ')}</span>
                          )}
                        </p>

                        {/* Symptoms / Complaints Box */}
                        {appt.reason && (
                          <div className="mt-2 p-3 bg-[#E7F0FC] rounded-xl border border-[#BDDDFA] max-w-2xl text-xs text-[#334155]">
                            <strong className="text-[#0F172A] block mb-0.5">Symptoms / Stated Reason:</strong>
                            <p>{appt.reason}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* ROLE-SPECIFIC JOBS / ACTION BUTTONS */}
                    <div className="flex flex-wrap items-center gap-2.5 lg:shrink-0 pt-3 lg:pt-0 border-t lg:border-t-0 border-[#BDDDFA]">

                      {/* --- DOCTOR JOBS --- */}
                      {isDoctor && (
                        <>
                          {/* Pending Confirmation Controls */}
                          {isPending && onApptAction && (
                            <>
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => onApptAction(appt.id, 'approve')}
                                icon={Check}
                                className="font-bold shadow-xs"
                              >
                                Accept &amp; Confirm
                              </Button>
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={() => onApptAction(appt.id, 'reject')}
                                icon={X}
                              >
                                Decline
                              </Button>
                            </>
                          )}

                          {/* Approved: Launch Room */}
                          {isApproved && (
                            <Button
                              variant="primary"
                              size="md"
                              icon={isAudio ? Mic : Video}
                              onClick={() => onSelectConsultation({
                                id: appt.consultation?.id || appt.id,
                                mode: isAudio ? 'audio' : 'video'
                              })}
                              className={`font-black shadow-sm ${isAudio ? 'bg-purple-700 hover:bg-purple-800 border-purple-700' : ''}`}
                            >
                              {isAudio ? "Open Audio Room" : "Open Video Room"}
                            </Button>
                          )}

                          {/* Inspect Records (Only for non-anonymous) */}
                          {!isAnonymous ? (
                            <Button
                              variant="outline"
                              size="sm"
                              icon={FileText}
                              onClick={() => handleInspectRecords(appt)}
                              className="text-xs font-semibold"
                            >
                              Inspect Records
                            </Button>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-xs font-semibold bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed"
                              title="Medical records are hidden to maintain patient anonymity"
                            >
                              <Lock className="w-3.5 h-3.5" />
                              Records Sealed
                            </span>
                          )}

                          {/* Issue E-Prescription */}
                          {(isApproved || isCompleted) && (
                            <Button
                              variant="secondary"
                              size="sm"
                              icon={FileText}
                              onClick={() => setRxModalAppt(appt)}
                              className="text-xs font-bold text-[#059669]"
                            >
                              Write Rx
                            </Button>
                          )}
                        </>
                      )}

                      {/* --- PATIENT JOBS --- */}
                      {!isDoctor && (
                        <>
                          {/* If Approved: Join Room */}
                          {isApproved && (
                            <Button
                              variant="primary"
                              size="md"
                              icon={isAudio ? Mic : Video}
                              onClick={() => onSelectConsultation({
                                id: appt.consultation?.id || appt.id,
                                mode: isAudio ? 'audio' : 'video'
                              })}
                              className={`font-black shadow-md ${isAudio ? 'bg-purple-700 hover:bg-purple-800 border-purple-700' : ''}`}
                            >
                              {isAudio ? "Join Audio Room (Anonymous)" : "Join Video Room"}
                            </Button>
                          )}

                          {/* If Pending: Friendly Status */}
                          {isPending && (
                            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 font-semibold">
                              <RefreshCw className="w-3.5 h-3.5 text-amber-700 animate-spin" />
                              <span>Awaiting Doctor Confirmation</span>
                            </div>
                          )}

                          {/* If Completed: View Prescription */}
                          {isCompleted && (
                            <Button
                              variant="outline"
                              size="sm"
                              icon={FileText}
                              onClick={() => setViewingRx(appt)}
                              className="text-xs font-bold text-[#059669]"
                            >
                              View Prescription (Rx)
                            </Button>
                          )}
                        </>
                      )}

                    </div>
                  </div>

                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* MODAL 1: PRE-CALL HARDWARE & AUDIO/VIDEO DIAGNOSTICS */}
      <Modal
        isOpen={deviceModalOpen}
        onClose={closeDeviceModal}
        title="Hardware & Pre-Call Diagnostics"
        subtitle="Verify your microphone, audio levels, and video camera before entering your consultation."
        maxWidth="max-w-xl"
      >
        <div className="space-y-6">
          {/* Audio / Mic Test */}
          <div className="p-4 rounded-2xl bg-[#E7F0FC] border border-[#BDDDFA] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mic className="w-4 h-4 text-[#168CF5]" />
                <h4 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">Microphone Test</h4>
              </div>
              <Button
                variant={micTesting ? "danger" : "primary"}
                size="sm"
                onClick={micTesting ? stopMicTest : startMicTest}
              >
                {micTesting ? "Stop Test" : "Test Microphone"}
              </Button>
            </div>

            {micTesting && (
              <div className="space-y-1.5 pt-2">
                <div className="flex justify-between text-[11px] font-bold text-[#55647C]">
                  <span>Live Input Volume</span>
                  <span>{micVolume}%</span>
                </div>
                <div className="w-full h-3 bg-white rounded-full overflow-hidden border border-[#BDDDFA]">
                  <div
                    className="h-full bg-[#059669] transition-all duration-75"
                    style={{ width: `${micVolume}%` }}
                  />
                </div>
                <p className="text-[11px] text-[#059669] font-semibold mt-1">
                  Speak into your microphone. The green bar indicates active voice transmission.
                </p>
              </div>
            )}
          </div>

          {/* Camera Video Test */}
          <div className="p-4 rounded-2xl bg-[#E7F0FC] border border-[#BDDDFA] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Video className="w-4 h-4 text-[#059669]" />
                <h4 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">Video Camera Preview</h4>
              </div>
              <Button
                variant={camTesting ? "danger" : "outline"}
                size="sm"
                onClick={camTesting ? stopCamTest : startCamTest}
              >
                {camTesting ? "Turn Off" : "Test Camera"}
              </Button>
            </div>

            {camTesting ? (
              <div className="relative w-full h-56 rounded-xl overflow-hidden bg-black border border-[#BDDDFA] flex items-center justify-center">
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/60 text-white text-[10px] font-mono">
                  Live Camera Feed
                </span>
              </div>
            ) : (
              <div className="h-28 rounded-xl bg-white border border-[#BDDDFA] flex items-center justify-center text-xs text-[#55647C]">
                Click "Test Camera" to preview your video framing before video visits.
              </div>
            )}
          </div>

          {/* Privacy & Security Notes */}
          <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 text-xs text-purple-900 flex items-start gap-2">
            <Lock className="w-4 h-4 text-purple-700 shrink-0 mt-0.5" />
            <div>
              <strong className="block font-bold">Anonymous Consultations:</strong>
              <span>If you selected Audio Mode, your camera remains disabled and your identity is masked from the doctor.</span>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button variant="primary" size="md" onClick={closeDeviceModal}>
              Complete &amp; Return
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL 2: DOCTOR WRITE E-PRESCRIPTION */}
      <Modal
        isOpen={!!rxModalAppt}
        onClose={() => setRxModalAppt(null)}
        title="Issue Digital E-Prescription (Rx)"
        subtitle={`Session #${rxModalAppt?.id || ''} • Patient: ${rxModalAppt?.is_anonymous ? 'Anonymous Patient' : rxModalAppt?.patient_details?.username
          }`}
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleIssueRxSubmit} className="space-y-4">
          {rxSuccessMsg && (
            <div className="p-3 rounded-xl bg-[#E7F0FC] border border-[#059669] text-xs font-bold text-[#059669]">
              {rxSuccessMsg}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#0F172A] mb-1">Chief Complaints</label>
              <input
                type="text"
                required
                value={rxForm.symptoms}
                onChange={e => setRxForm({ ...rxForm, symptoms: e.target.value })}
                placeholder="e.g. Fever for 3 days, mild dry cough..."
                className="w-full p-2.5 bg-[#E7F0FC] rounded-[12px] text-xs font-medium text-[#0F172A] outline-none border border-[#BDDDFA]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#0F172A] mb-1">Clinical Diagnosis</label>
              <input
                type="text"
                required
                value={rxForm.diagnosis}
                onChange={e => setRxForm({ ...rxForm, diagnosis: e.target.value })}
                placeholder="e.g. Acute Viral Bronchitis..."
                className="w-full p-2.5 bg-[#E7F0FC] rounded-[12px] text-xs font-medium text-[#0F172A] outline-none border border-[#BDDDFA]"
              />
            </div>
          </div>

          {/* Medicines */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-[#0F172A]">Prescribed Medications</label>
              <button
                type="button"
                onClick={handleAddMedicine}
                className="text-xs font-bold text-[#059669] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add Medicine
              </button>
            </div>

            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {medicines.map((m, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2 rounded-xl bg-[#E7F0FC] border border-[#BDDDFA]">
                  <input
                    type="text"
                    required
                    placeholder="Medicine (e.g. Paracetamol 500mg)"
                    value={m.name}
                    onChange={e => handleUpdateMedicine(idx, 'name', e.target.value)}
                    className="flex-1 p-2 bg-white rounded-lg text-xs font-medium text-[#0F172A] outline-none border border-[#BDDDFA]"
                  />
                  <input
                    type="text"
                    required
                    placeholder="Dosage (1 tab)"
                    value={m.dosage}
                    onChange={e => handleUpdateMedicine(idx, 'dosage', e.target.value)}
                    className="w-24 p-2 bg-white rounded-lg text-xs font-medium text-[#0F172A] outline-none border border-[#BDDDFA]"
                  />
                  <input
                    type="text"
                    required
                    placeholder="Timing (1+0+1)"
                    value={m.timing}
                    onChange={e => handleUpdateMedicine(idx, 'timing', e.target.value)}
                    className="w-32 p-2 bg-white rounded-lg text-xs font-medium text-[#0F172A] outline-none border border-[#BDDDFA]"
                  />
                  {medicines.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveMedicine(idx)}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#0F172A] mb-1">Doctor Advice &amp; Instructions</label>
            <textarea
              rows={2}
              value={rxForm.instructions}
              onChange={e => setRxForm({ ...rxForm, instructions: e.target.value })}
              placeholder="Drink plenty of fluids, rest, follow up in 5 days if fever persists..."
              className="w-full p-2.5 bg-[#E7F0FC] rounded-[12px] text-xs font-medium text-[#0F172A] outline-none border border-[#BDDDFA]"
            />
          </div>

          {/* Digital Signature Confirmation */}
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-[#E7F0FC] border border-[#BDDDFA]">
            <input
              type="checkbox"
              id="rxSignCheck"
              checked={rxSigned}
              onChange={e => setRxSigned(e.target.checked)}
              className="rounded text-[#059669] focus:ring-[#059669] w-4 h-4 cursor-pointer"
            />
            <label htmlFor="rxSignCheck" className="text-xs text-[#0F172A] font-semibold cursor-pointer">
              I certify under my BMDC registration that this digital prescription is medically indicated.
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setRxModalAppt(null)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" loading={rxSubmitting}>
              Issue &amp; Sign Prescription
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 3: DOCTOR INSPECT PATIENT RECORDS (AES-256) */}
      <Modal
        isOpen={!!recordsModalPatient}
        onClose={() => setRecordsModalPatient(null)}
        title={`Clinical Records: ${recordsModalPatient?.name || ''}`}
        subtitle="End-to-End Encrypted Patient Medical History"
        maxWidth="max-w-2xl"
      >
        {loadingRecords ? (
          <div className="p-8 text-center text-xs font-bold text-[#55647C]">
            <RefreshCw className="w-6 h-6 animate-spin text-[#168CF5] mx-auto mb-2" />
            Decrypting patient medical history (AES-256)...
          </div>
        ) : recordsError ? (
          <div className="p-6 text-center space-y-3 bg-red-50 rounded-2xl border border-red-200">
            <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
            <h4 className="text-sm font-bold text-[#0F172A]">Access Restricted</h4>
            <p className="text-xs text-[#55647C] max-w-sm mx-auto">{recordsError}</p>
          </div>
        ) : patientRecords.length === 0 ? (
          <div className="p-6 text-center text-xs text-[#55647C]">
            This patient has not uploaded any lab reports or diagnostic records yet.
          </div>
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

      {/* MODAL 4: PATIENT VIEW ISSUED PRESCRIPTION */}
      <Modal
        isOpen={!!viewingRx}
        onClose={() => setViewingRx(null)}
        title="Consultation Prescription (Rx)"
        subtitle={`Session with Dr. ${viewingRx?.doctor_details?.first_name || ''} ${viewingRx?.doctor_details?.last_name || ''}`}
        maxWidth="max-w-xl"
      >
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-[#E7F0FC] border border-[#BDDDFA] space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-[#0F172A]">Date of Visit: {viewingRx?.date}</span>
              <VerifiedBadge text="Digitally Signed" />
            </div>
            <p className="text-xs text-[#55647C]">
              Doctor: Dr. {viewingRx?.doctor_details?.first_name} {viewingRx?.doctor_details?.last_name} ({viewingRx?.doctor_details?.specialty || "Certified Physician"})
            </p>
          </div>

          <div className="p-4 bg-white rounded-2xl border border-[#BDDDFA] space-y-3">
            <h4 className="text-xs font-extrabold text-[#059669] uppercase tracking-wider">Clinical Summary</h4>
            <p className="text-xs text-[#334155]"><strong>Reported Symptoms:</strong> {viewingRx?.reason || "General clinical evaluation"}</p>
            <p className="text-xs text-[#334155]"><strong>Status:</strong> Completed Consultation</p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setViewingRx(null)}>
              Close
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={Download}
              onClick={() => {
                window.print();
              }}
            >
              Print / Save PDF
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  );
};

export default ConsultationPortal;
