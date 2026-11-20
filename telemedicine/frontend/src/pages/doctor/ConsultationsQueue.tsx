import React, { useState } from 'react';
import { ConsultationRoom } from '../../components/consultation/ConsultationRoom';

export interface ConsultationQueueItem {
  id: string;
  patientName: string;
  patientId: string;
  mode: 'VIDEO' | 'AUDIO';
  status: 'WAITING' | 'IN_PROGRESS' | 'COMPLETED';
  scheduledTime: string;
  chiefComplaint: string;
  vitals: {
    bp: string;
    hr: string;
    temp: string;
    spo2: string;
  };
}

const INITIAL_QUEUE: ConsultationQueueItem[] = [
  {
    id: '19',
    patientName: 'Niloy Hasan',
    patientId: 'niloy',
    mode: 'VIDEO',
    status: 'WAITING',
    scheduledTime: '10:30 AM',
    chiefComplaint: 'Dry cough for 3 days, mild sore throat',
    vitals: { bp: '128/84 mmHg', hr: '76 bpm', temp: '98.4 °F', spo2: '99%' },
  },
  {
    id: '20',
    patientName: 'Ayesha Rahman',
    patientId: 'ayesha',
    mode: 'AUDIO',
    status: 'WAITING',
    scheduledTime: '11:00 AM',
    chiefComplaint: 'Severe migraine headache and light sensitivity',
    vitals: { bp: '118/78 mmHg', hr: '72 bpm', temp: '98.6 °F', spo2: '98%' },
  },
];

export const ConsultationsQueue: React.FC = () => {
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [selectedRecordSession, setSelectedRecordSession] = useState<ConsultationQueueItem | null>(null);

  if (activeSessionId) {
    const activeSession = INITIAL_QUEUE.find(s => s.id === activeSessionId);
    return (
      <ConsultationRoom
        onClose={() => setActiveSessionId(null)}
        sessionId={activeSessionId}
        patientName={activeSession?.patientName || 'Niloy Hasan'}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Doctor Workstation: Consultations &amp; Queue
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Select a patient to enter the consultation room and write prescriptions in the full-screen portal.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold">
              Live Gateway Active
            </span>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {INITIAL_QUEUE.map((session) => (
            <div
              key={session.id}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between space-y-4 hover:border-slate-300 transition"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Session #{session.id} • {session.mode} CALL
                    </span>
                    <h2 className="text-lg font-bold text-slate-900 mt-0.5">
                      {session.patientName}
                    </h2>
                    <p className="text-xs text-slate-500">Scheduled: {session.scheduledTime}</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                    {session.status}
                  </span>
                </div>

                <div className="mt-4 p-3 bg-slate-50 rounded-xl text-xs space-y-1">
                  <div className="font-semibold text-slate-700">Chief Complaint:</div>
                  <div className="text-slate-600">{session.chiefComplaint}</div>
                </div>

                <div className="mt-3 grid grid-cols-4 gap-2 text-center text-[10px]">
                  <div className="p-2 bg-slate-50 rounded-lg">
                    <div className="text-slate-400">BP</div>
                    <div className="font-bold text-slate-700">{session.vitals.bp}</div>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-lg">
                    <div className="text-slate-400">HR</div>
                    <div className="font-bold text-slate-700">{session.vitals.hr}</div>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-lg">
                    <div className="text-slate-400">Temp</div>
                    <div className="font-bold text-slate-700">{session.vitals.temp}</div>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-lg">
                    <div className="text-slate-400">SpO2</div>
                    <div className="font-bold text-slate-700">{session.vitals.spo2}</div>
                  </div>
                </div>
              </div>

              {/* Action Buttons: Only 2 options (Record & Open Room) */}
              <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedRecordSession(session)}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-sm border border-slate-200"
                >
                  <span>📋 Record</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSessionId(session.id)}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                >
                  <span>🚪 Open Room</span>
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Modal: Patient Health Records Inspection */}
        {selectedRecordSession && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
              <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold">Medical Records: {selectedRecordSession.patientName}</h3>
                  <p className="text-[11px] text-slate-400">Consultation #{selectedRecordSession.id} • Authorized Records</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedRecordSession(null)}
                  className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center text-sm font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto text-xs">
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 flex items-center justify-between">
                  <div>
                    <div className="font-bold">Complete Blood Count (CBC)</div>
                    <div className="text-[10px] text-emerald-700">WBC: 6.8K, Hemoglobin: 14.8 g/dL, Platelets: 260K • PDF</div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-200 text-emerald-800 font-bold text-[10px]">VERIFIED</span>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 flex items-center justify-between">
                  <div>
                    <div className="font-bold">Chest X-Ray Digital Scan (PA View)</div>
                    <div className="text-[10px] text-slate-500">Normal bronchovascular markings • JPG • 1.2 MB</div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-bold text-[10px]">AUTHORIZED</span>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 flex items-center justify-between">
                  <div>
                    <div className="font-bold">Prior E-Prescription Reference (Rx-4091)</div>
                    <div className="text-[10px] text-slate-500">Issued by Dr. Sarah Khan • Verified on Blockchain</div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-bold text-[10px]">ENCRYPTED</span>
                </div>
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setSelectedRecordSession(null)}
                  className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const sid = selectedRecordSession.id;
                    setSelectedRecordSession(null);
                    setActiveSessionId(sid);
                  }}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
                >
                  Enter Room
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

