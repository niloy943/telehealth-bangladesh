import React from 'react';
import {
  Calendar, Clock, Lock, Mic, Video, FileText, CheckCircle2
} from 'lucide-react';
import {
  Button, Card, StatusBadge, EmptyState, PageHeader
} from '../ui';

export const PatientConsultationsSection = ({
  appointments,
  setSubView,
  onSelectConsultation,
  setPatientRecordsAppt
}) => {
  return (
    <div className="space-y-6">
      <PageHeader
        title="My Consultations"
        subtitle="Manage your active consultation visits and share medical records with specialists"
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setSubView('overview')}>
              Back to Health Home
            </Button>
            <Button variant="primary" size="sm" onClick={() => setSubView('booking')}>
              + Book New
            </Button>
          </div>
        }
      />

      {appointments.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="No consultations scheduled"
          description="You don't have any appointments yet. Connect with verified physicians anytime."
          action={
            <Button size="sm" onClick={() => setSubView('booking')}>
              Schedule Consultation
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {appointments.map((appt) => {
            const isAudio = appt.consultation_type === 'audio';
            const isApproved = appt.status === 'approved' && appt.consultation;
            const isPending = appt.status === 'pending';
            const isCompleted = appt.status === 'completed';

            return (
              <Card key={appt.id} className="p-4 bg-[#E7F0FC] border-[#BDDDFA] hover:border-[#168CF5] transition">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-white border border-[#BDDDFA] text-[#0F172A] font-bold flex items-center justify-center text-base shrink-0 shadow-sm">
                      {appt.doctor_details?.first_name?.[0] || 'D'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-[#0F172A]">
                          Dr. {appt.doctor_details?.first_name} {appt.doctor_details?.last_name}
                        </h4>
                        <StatusBadge status={appt.status} size="sm" />
                      </div>
                      <p className="text-xs text-[#059669] font-semibold mt-0.5">
                        {appt.doctor_details?.specialty || 'General Practitioner'}
                      </p>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-[#55647C] mt-2">
                        <span className="flex items-center gap-1 font-medium bg-white px-2 py-0.5 rounded-md border border-[#BDDDFA]">
                          <Calendar className="w-3.5 h-3.5 text-[#168CF5]" />
                          {appt.date}
                        </span>
                        <span className="flex items-center gap-1 font-medium bg-white px-2 py-0.5 rounded-md border border-[#BDDDFA]">
                          <Clock className="w-3.5 h-3.5 text-[#168CF5]" />
                          {appt.time}
                        </span>
                        <span className="capitalize text-[11px] font-semibold text-[#168CF5]">
                          {isAudio ? '🎙️ Anonymous Audio' : '📹 Video Call'}
                        </span>
                        {appt.is_anonymous && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-800 border border-purple-200">
                            <Lock className="w-2.5 h-2.5" />
                            <span>Anonymous {appt.anonymous_session_id ? `#${appt.anonymous_session_id}` : ''}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 2 Primary Consultation Action Options: Open Room & Records */}
                  <div className="flex flex-wrap items-center gap-2 justify-end">
                    {isApproved && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => onSelectConsultation({ id: appt.consultation.id, mode: appt.consultation.type })}
                        icon={isAudio ? Mic : Video}
                        className="font-bold shadow-xs"
                      >
                        {isAudio ? 'Open Audio Room' : 'Open Room'}
                      </Button>
                    )}

                    {!isCompleted && (
                      <Button
                        variant="outline"
                        size="sm"
                        icon={FileText}
                        onClick={() => setPatientRecordsAppt(appt)}
                        className="font-bold text-xs"
                      >
                        Records
                      </Button>
                    )}

                    {isPending && (
                      <span className="text-xs text-[#55647C] bg-white px-3 py-1.5 rounded-lg border border-[#BDDDFA] text-center font-medium">
                        Awaiting Doctor Confirmation
                      </span>
                    )}

                    {isCompleted && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#059669]" />
                        <span>Consultation Completed</span>
                      </span>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

