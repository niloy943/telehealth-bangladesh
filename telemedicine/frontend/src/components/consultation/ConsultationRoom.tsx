import React, { useState } from 'react';
import { EPrescriptionPortal, ConsultationLayoutMode } from '../prescription/EPrescriptionPortal';
import { usePrescriptionDraftStore } from '../../store/usePrescriptionDraftStore';

interface ChatMessage {
  id: string;
  sender: 'doctor' | 'patient';
  text: string;
  timestamp: string;
}

interface ConsultationRoomProps {
  onClose?: () => void;
  sessionId?: string;
  patientName?: string;
}

export const ConsultationRoom: React.FC<ConsultationRoomProps> = ({
  onClose,
  sessionId = '19',
  patientName = 'Niloy Hasan'
}) => {
  // Default to split Video + E-Prescription
  const [layoutMode, setLayoutMode] = useState<ConsultationLayoutMode>('video-split');
  const [callType, setCallType] = useState<'VIDEO' | 'AUDIO'>('VIDEO');
  const [grantStatus, setGrantStatus] = useState<'ACTIVE' | 'REVOKED'>('ACTIVE');
  const [isRecordsModalOpen, setIsRecordsModalOpen] = useState(false);

  // Call media states
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  // Encrypted Chat State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'msg_1',
      sender: 'doctor',
      text: 'Good morning Niloy, how are you feeling today?',
      timestamp: '10:31 AM',
    },
    {
      id: 'msg_2',
      sender: 'patient',
      text: 'Good morning doctor. I have had a severe dry cough and sore throat for 3 days.',
      timestamp: '10:32 AM',
    },
  ]);
  const [newMessageText, setNewMessageText] = useState('');

  const patientData = {
    name: 'Niloy Hasan',
    id: 'niloy',
    bloodGroup: 'O+',
    height: '165cm',
    weight: '60Kg',
    vitals: {
      bp: '128/84 mmHg',
      hr: '76 bpm',
      temp: '98.4 °F',
      spo2: '99%',
    },
    allergies: ['Penicillin (Mild Urticaria)', 'NSAIDs (Gastric Irritation)'],
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessageText.trim()) return;

    setChatMessages((prev) => [
      ...prev,
      {
        id: `msg_${Date.now()}`,
        sender: 'doctor',
        text: newMessageText.trim(),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    setNewMessageText('');
  };

  const handleApproveWith2FA = async (_totpCode?: string) => {
    const draft = usePrescriptionDraftStore.getState();
    const token = typeof window !== 'undefined' ? localStorage.getItem('tv_token') : '';

    const payload = {
      consultationId: String(sessionId),
      doctorId: 'doc-sarah-101',
      patientId: 'niloy',
      patientUsername: 'niloy',
      patientName: patientName || 'Niloy Hasan',
      diagnosis: draft.clinicalDiagnosis || 'Clinical Assessment Finalized',
      symptoms: draft.chiefComplaints || 'Clinical Indications Evaluated',
      advice: draft.doctorAdvice || '',
      instructions: draft.doctorAdvice || '',
      medicines: JSON.stringify(draft.medications),
      items: draft.medications
    };

    // 1. Submit to Secure E-Prescription Gateway (Port 5002)
    try {
      await fetch('http://localhost:5002/api/prescriptions/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Doctor-ID': 'doc-sarah-101',
          'X-Patient-ID': 'niloy',
          'X-Patient-Username': 'niloy'
        },
        body: JSON.stringify(payload)
      });
    } catch (e) {
      console.warn('Gateway approve notice:', e);
    }

    // 2. Submit to Django Backend (Port 8000)
    try {
      await fetch('http://localhost:8000/api/prescriptions/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          consultation_id: sessionId,
          patient_id: 'niloy',
          patient_username: 'niloy',
          symptoms: draft.chiefComplaints || 'Clinical Indications Evaluated',
          diagnosis: draft.clinicalDiagnosis || 'Clinical Assessment Finalized',
          medicines: JSON.stringify(draft.medications),
          instructions: draft.doctorAdvice || ''
        })
      });
    } catch (e) {
      console.warn('Django approve notice:', e);
    }

    // 3. Dispatch vault synchronization events
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('healnsight_prescription_updated', {
        detail: { consultationId: sessionId, patientId: 'niloy' }
      }));
      try { localStorage.setItem('healnsight_last_prescription_sync', Date.now().toString()); } catch {}
    }

    setGrantStatus('REVOKED');
  };

  return (
    <div className="h-screen w-full flex flex-col bg-slate-950 overflow-hidden relative select-none">
      {/* 1. TOP CONSULTATION BAR */}
      <header className="h-14 px-5 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-3">
          <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>LIVE {callType} CONSULTATION</span>
          </span>
          <div className="text-xs text-slate-300 font-medium flex items-center gap-2">
            <span className="font-bold text-white">Patient: {patientData.name}</span>
            <span className="text-slate-500">•</span>
            <span>Session #19</span>
            <span className="text-slate-500">•</span>
            <span className="text-emerald-400 font-semibold">Grant: {grantStatus} (58:12)</span>
            <span className="text-slate-500">•</span>
            <span className="text-slate-400">Call Room</span>
          </div>
        </div>

        {/* Portal Mode Switcher and End Consultation Action */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              type="button"
              title="Video + E-Prescription Split Mode"
              onClick={() => {
                setCallType('VIDEO');
                setLayoutMode('video-split');
              }}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                layoutMode === 'video-split'
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>📹 Video + E-Prescription</span>
            </button>
            <button
              type="button"
              title="Audio + E-Prescription Mode"
              onClick={() => {
                setCallType('AUDIO');
                setLayoutMode('audio-full');
              }}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                layoutMode === 'audio-full'
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>🎧 Audio + E-Prescription</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              if (window.confirm("End active consultation session? This will complete the visit and generate the E-Prescription.")) {
                setGrantStatus('REVOKED');
                if (onClose) onClose();
              }
            }}
            className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <span>📞 End Consultation</span>
          </button>
        </div>
      </header>

      {/* 2. COMPACT TOP AUDIO BAR (Only shown when layoutMode === 'audio-full') */}
      {layoutMode === 'audio-full' && (
        <div className="h-12 px-6 bg-indigo-950/90 border-b border-indigo-500/30 flex items-center justify-between text-xs text-indigo-200 shrink-0">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-semibold text-white">
              Encrypted Audio Stream Active — {patientData.name} (08:42)
            </span>
            <div className="flex items-center gap-1 pl-3">
              <span className="w-1 h-3 bg-teal-400 rounded-full animate-bounce" />
              <span className="w-1 h-5 bg-teal-300 rounded-full animate-pulse" />
              <span className="w-1 h-2 bg-teal-400 rounded-full animate-bounce" />
              <span className="w-1 h-4 bg-teal-200 rounded-full animate-pulse" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsMuted(!isMuted)}
              className="px-2.5 py-1 rounded-lg bg-indigo-900/80 hover:bg-indigo-800 text-white text-[11px] font-medium"
            >
              {isMuted ? '🔇 Unmute Mic' : '🎙️ Mic Active'}
            </button>
            <span className="text-indigo-300">
              E-Prescription Desk Expanded to Full Width Below
            </span>
          </div>
        </div>
      )}

      {/* 3. MAIN WORKSPACE CONTAINER */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT PANE (5/12 width): Live Stream HUD + Encrypted Chat (Only in video-split) */}
        {layoutMode === 'video-split' && (
          <aside className="w-5/12 bg-slate-900 border-r border-slate-800 flex flex-col justify-between p-4 overflow-hidden gap-3">
            {/* TOP SECTION: LIVE VIDEO / AUDIO STREAM */}
            <div className="rounded-2xl bg-slate-950 border border-slate-800 p-3.5 flex flex-col justify-between relative shadow-inner">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-xs">
                <span className="text-teal-400 font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>{callType === 'VIDEO' ? 'LIVE VIDEO STREAM' : 'LIVE AUDIO STREAM'}</span>
                </span>
                <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                  AES-256 E2EE
                </span>
              </div>

              {/* Video Area */}
              <div className="relative h-44 rounded-xl overflow-hidden bg-slate-900 flex items-center justify-center border border-slate-800/80">
                {!isVideoOff && callType === 'VIDEO' ? (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-slate-950 text-center p-4">
                    <div className="w-16 h-16 rounded-full bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-300 text-xl font-bold mb-2 shadow-lg">
                      NH
                    </div>
                    <div className="text-xs font-bold text-white">{patientData.name}</div>
                    <div className="text-[10px] text-teal-400/90 mt-0.5">Encrypted Peer Video Feed (HD)</div>
                  </div>
                ) : (
                  <div className="text-center p-4">
                    <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-2 text-slate-400">
                      👤
                    </div>
                    <p className="text-xs font-bold text-white">{patientData.name}</p>
                    <p className="text-[10px] text-slate-400">Video paused • Audio Active</p>
                  </div>
                )}

                {/* Self-View PiP */}
                {callType === 'VIDEO' && (
                  <div className="absolute bottom-2 right-2 w-20 h-14 bg-black/80 rounded-lg border border-teal-500/40 overflow-hidden flex items-center justify-center text-[9px] text-slate-300">
                    <span>You (Doctor)</span>
                  </div>
                )}
              </div>

              {/* Live Stream Controls: [Mic] [Cam] [Switch to Audio] [Expand Rx Full Screen ⛶] */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 mt-2 border-t border-slate-800/80">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setIsMuted(!isMuted)}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer transition ${
                      isMuted ? 'bg-rose-900/80 text-rose-200' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                    }`}
                  >
                    {isMuted ? '🔇 Unmute' : '🎤 Mic'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsVideoOff(!isVideoOff)}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer transition ${
                      isVideoOff ? 'bg-rose-900/80 text-rose-200' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                    }`}
                  >
                    {isVideoOff ? '🚫 Cam Off' : '📹 Cam'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCallType(callType === 'VIDEO' ? 'AUDIO' : 'VIDEO');
                      if (callType === 'VIDEO') setLayoutMode('audio-full');
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-indigo-900/70 hover:bg-indigo-800 text-indigo-200 text-[11px] font-bold cursor-pointer transition"
                  >
                    🎧 Switch to Audio
                  </button>
                </div>
              </div>
            </div>

            {/* BOTTOM SECTION: ENCRYPTED CHAT (AES-256-GCM) */}
            <div className="flex-1 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col overflow-hidden shadow-inner min-h-[220px]">
              <div className="p-3 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between text-xs">
                <div className="font-bold text-slate-200 flex items-center gap-1.5">
                  <span>💬 ENCRYPTED CHAT</span>
                </div>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded">
                  AES-256-GCM
                </span>
              </div>

              {/* Messages Feed */}
              <div className="flex-1 p-3 overflow-y-auto space-y-2.5 text-xs">
                {chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${msg.sender === 'doctor' ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[85%] px-3 py-2 rounded-xl leading-relaxed ${
                        msg.sender === 'doctor'
                          ? 'bg-teal-600 text-white rounded-br-none'
                          : 'bg-slate-800 text-slate-200 rounded-bl-none'
                      }`}
                    >
                      {msg.text}
                    </div>
                    <span className="text-[9px] text-slate-500 mt-0.5 px-1">{msg.timestamp}</span>
                  </div>
                ))}
              </div>

              {/* Chat Input */}
              <form onSubmit={handleSendMessage} className="p-2.5 bg-slate-900/80 border-t border-slate-800 flex gap-2">
                <input
                  type="text"
                  value={newMessageText}
                  onChange={(e) => setNewMessageText(e.target.value)}
                  placeholder="Type encrypted message..."
                  className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
                />
                <button
                  type="submit"
                  className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition cursor-pointer"
                >
                  Send
                </button>
              </form>
            </div>

            {/* Consultation Records Access (Positioned directly below Encrypted Peer Chat) */}
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between shadow-xs">
              <div>
                <h4 className="text-xs font-bold text-white">Consultation Records</h4>
                <p className="text-[10px] text-slate-400">Patient-shared diagnostic reports (PDF / JPG)</p>
              </div>
              <button
                type="button"
                onClick={() => setIsRecordsModalOpen(true)}
                className="px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                <span>Records</span>
              </button>
            </div>
          </aside>
        )}

        {/* Modal: Consultation Records Viewer */}
        {isRecordsModalOpen && (
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl text-xs">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h3 className="font-bold text-white text-sm">Consultation Medical Records</h3>
                  <p className="text-[11px] text-slate-400">Patient: {patientName} • Authorized Session Reports</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsRecordsModalOpen(false)}
                  className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-2.5">
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-white">Complete Blood Count (CBC) Report</div>
                    <div className="text-[10px] text-teal-400">Diagnostic Findings • Verified • PDF</div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 text-[10px] font-bold">SHARED</span>
                </div>
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-white">Chest Radiograph Scan (PA View)</div>
                    <div className="text-[10px] text-slate-400">Normal bronchovascular markings • JPG</div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-bold">SHARED</span>
                </div>
              </div>

              <div className="flex justify-end pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsRecordsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

        {/* RIGHT PANE: SECURE DIGITAL E-PRESCRIPTION PORTAL (Takes 7/12 in split, 100% in audio/fullscreen) */}
        <main className={layoutMode === 'video-split' ? 'w-7/12 h-full overflow-hidden' : 'w-full h-full overflow-hidden'}>
          <EPrescriptionPortal
            sessionId="19"
            patient={patientData}
            grantStatus={grantStatus}
            layoutMode={layoutMode}
            onChangeLayoutMode={setLayoutMode}
            onApproveWith2FA={handleApproveWith2FA}
          />
        </main>
      </div>
    </div>
  );
};
