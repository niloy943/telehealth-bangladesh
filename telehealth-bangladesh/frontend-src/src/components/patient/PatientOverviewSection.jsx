import React from 'react';
import {
  Activity, Clock, User, Scale, Stethoscope, Calendar, Mic, Video,
  FileText, CheckCircle2, ChevronLeft, ChevronRight, Plus, Sparkles,
  ArrowRight, Star, Lock, Award, ShieldCheck, Edit3
} from 'lucide-react';
import {
  Button, Card, CardHeader, CardTitle, CardDescription, CardContent,
  StatusBadge, VerifiedBadge, SecurityBadge, EmptyState
} from '../ui';

export const PatientOverviewSection = ({
  user,
  vitals,
  getGreeting,
  getBMIData,
  setIsVitalsModalOpen,
  upcomingAppointments,
  onSelectConsultation,
  setPatientRecordsAppt,
  calendarDate,
  setCalendarDate,
  selectedCalendarDate,
  appointments,
  setApptForm,
  renderCalendarDays,
  doctors,
  setBookingModalDoc,
  setSelectedDocId,
  prescriptions,
  consents,
  handleRevokeConsent,
  setSubView,
  onTabChange
}) => {
  const bmiData = getBMIData(vitals.weight, vitals.height);

  return (
    <div className="space-y-8">
      {/* 1. Greeting & Daily Health Checkup Panel */}
      <div className="bg-white border border-[#BDDDFA] rounded-2xl p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-[#0F172A] tracking-tight">
              {getGreeting()}, {user.first_name || user.username}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsVitalsModalOpen(true)}
              icon={Edit3}
              className="bg-[#E7F0FC] hover:bg-white text-xs font-bold border-[#BDDDFA]"
            >
              Update Vitals
            </Button>
            <SecurityBadge text="Client-Side Encrypted" />
          </div>
        </div>

        {/* Daily Basic Checkup Cards */}
        <div className="mt-6 pt-6 border-t border-[#BDDDFA]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#059669]" />
              <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
                Daily Basic Checkup
              </h3>
            </div>
            <span className="text-[11px] text-[#55647C] flex items-center gap-1 font-medium">
              <Clock className="w-3 h-3 text-[#168CF5]" />
              {vitals.lastChecked || 'Today'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Age Card */}
            <div className="p-4 rounded-xl bg-[#E7F0FC] border border-[#BDDDFA] flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-[#55647C] uppercase tracking-wider block">Age</span>
                <div className="text-2xl font-extrabold text-[#0F172A]">
                  {vitals.age} <span className="text-xs font-normal text-[#55647C]">years</span>
                </div>
                <p className="text-[10px] text-[#059669] font-medium">Blood Group: {vitals.bloodGroup || 'O+'}</p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-white border border-[#BDDDFA] text-[#168CF5] flex items-center justify-center shrink-0 shadow-xs">
                <User className="w-5 h-5" />
              </div>
            </div>

            {/* Weight & BMI Card */}
            <div className="p-4 rounded-xl bg-[#E7F0FC] border border-[#BDDDFA] flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-[#55647C] uppercase tracking-wider block">Weight &amp; BMI</span>
                <div className="text-2xl font-extrabold text-[#0F172A]">
                  {vitals.weight} <span className="text-xs font-normal text-[#55647C]">kg</span>
                </div>
                <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${bmiData.badge}`}>
                  BMI {bmiData.bmi} • {bmiData.category}
                </span>
              </div>
              <div className="w-11 h-11 rounded-xl bg-white border border-[#BDDDFA] text-[#059669] flex items-center justify-center shrink-0 shadow-xs">
                <Scale className="w-5 h-5" />
              </div>
            </div>

            {/* Height Card */}
            <div className="p-4 rounded-xl bg-[#E7F0FC] border border-[#BDDDFA] flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-[#55647C] uppercase tracking-wider block">Height</span>
                <div className="text-2xl font-extrabold text-[#0F172A]">
                  {vitals.height} <span className="text-xs font-normal text-[#55647C]">cm</span>
                </div>
                <p className="text-[10px] text-[#55647C]">
                  ≈ {Math.floor(vitals.height / 30.48)} ft {Math.round((vitals.height % 30.48) / 2.54)} in
                </p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-white border border-[#BDDDFA] text-[#168CF5] flex items-center justify-center shrink-0 shadow-xs">
                <Activity className="w-5 h-5" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Upcoming Consultations & Interactive Calendar Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* My Consultations Card (Span 2) */}
        <Card className="lg:col-span-2 flex flex-col justify-between">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#E7F0FC] border border-[#BDDDFA] text-[#059669] flex items-center justify-center">
                  <Stethoscope className="w-4 h-4" />
                </div>
                <div>
                  <CardTitle>My Consultations</CardTitle>
                  <CardDescription>Join active consultation sessions and manage shared medical records</CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (onTabChange) {
                      onTabChange('consultation');
                    } else {
                      setSubView('consultations');
                    }
                  }}
                >
                  View All
                </Button>
                <Button variant="primary" size="sm" onClick={() => setSubView('booking')}>
                  + Book New
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-3">
            {upcomingAppointments.length > 0 ? (
              upcomingAppointments.slice(0, 5).map((appt) => (
                <div
                  key={appt.id}
                  className="bg-[#E7F0FC] border border-[#BDDDFA] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-[#168CF5] transition-colors"
                >
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
                          {appt.consultation_type === 'audio'
                            ? '🎙️ Anonymous Audio'
                            : appt.consultation_type === 'video'
                              ? '📹 Video Call'
                              : '💬 Encrypted Chat'}
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

                  {/* Action buttons: Open Room & Records */}
                  <div className="flex flex-wrap items-center gap-2 justify-end">
                    {appt.status === 'approved' && appt.consultation && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => onSelectConsultation({ id: appt.consultation.id, mode: appt.consultation.type })}
                        icon={appt.consultation_type === 'audio' ? Mic : Video}
                        className="font-bold shadow-xs"
                      >
                        {appt.consultation_type === 'audio' ? 'Open Audio Room' : 'Open Room'}
                      </Button>
                    )}

                    {appt.status !== 'completed' && (
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

                    {appt.status === 'pending' && (
                      <span className="text-xs text-[#55647C] bg-white px-3 py-1.5 rounded-lg border border-[#BDDDFA] text-center font-medium">
                        Awaiting Doctor Confirmation
                      </span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <EmptyState
                icon={Calendar}
                title="No consultations scheduled"
                description="You don't have any upcoming doctor appointments. Schedule a video visit with a certified doctor whenever you need care."
                action={
                  <Button size="sm" onClick={() => setSubView('booking')}>
                    Schedule Consultation
                  </Button>
                }
              />
            )}
          </CardContent>
        </Card>

        {/* Interactive Calendar Widget (Span 1) */}
        <Card className="flex flex-col justify-between">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#168CF5]" />
                <CardTitle className="text-sm">Calendar</CardTitle>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1))}
                  className="p-1 rounded-lg hover:bg-[#E7F0FC] text-[#55647C]"
                  title="Previous month"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-bold text-[#0F172A] px-1">
                  {calendarDate.toLocaleString('default', { month: 'short', year: 'numeric' })}
                </span>
                <button
                  type="button"
                  onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1))}
                  className="p-1 rounded-lg hover:bg-[#E7F0FC] text-[#55647C]"
                  title="Next month"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-0 space-y-3">
            {/* Calendar Days Header */}
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-[#94A3B8] uppercase">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                <div key={d} className="py-0.5">{d}</div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1 text-center text-xs">
              {renderCalendarDays()}
            </div>

            {/* Selected Date Summary & Quick Action */}
            <div className="pt-3 border-t border-[#BDDDFA] bg-[#E7F0FC] p-3 rounded-xl text-xs space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-[#0F172A]">
                  {new Date(selectedCalendarDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' })}
                </span>
                {appointments.some(a => a.date === selectedCalendarDate) ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#059669] text-white">
                    Visit Scheduled
                  </span>
                ) : (
                  <span className="text-[10px] text-[#55647C]">No visits</span>
                )}
              </div>

              {appointments.filter(a => a.date === selectedCalendarDate).map(a => (
                <div key={a.id} className="text-[11px] text-[#059669] font-medium flex items-center justify-between bg-white p-1.5 rounded-lg border border-[#BDDDFA]">
                  <span>Dr. {a.doctor_details?.last_name || 'Specialist'} ({a.time})</span>
                  <StatusBadge status={a.status} size="sm" />
                </div>
              ))}

              <button
                type="button"
                onClick={() => {
                  setApptForm(prev => ({ ...prev, date: selectedCalendarDate }));
                  setSubView('booking');
                }}
                className="w-full mt-1 py-1.5 px-2 rounded-lg bg-white hover:bg-[#168CF5] hover:text-white border border-[#BDDDFA] text-[11px] font-bold text-[#168CF5] transition-colors flex items-center justify-center gap-1"
              >
                <Plus className="w-3 h-3" /> Book Visit for This Date
              </button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3. Suggestions of Doctors */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#168CF5]" />
            <h3 className="text-base font-bold text-[#0F172A]">
              Suggestions of Doctors
            </h3>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSubView('booking')}
            icon={ArrowRight}
            className="text-xs font-bold text-[#168CF5]"
          >
            Browse All Directory ({doctors.length})
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(doctors.length > 0 ? doctors.slice(0, 3) : [
            {
              id: 1,
              user: { first_name: "Sarah", last_name: "Jenkins" },
              specialty: "General Medicine",
              bmdc_reg: "BMDC-A-48291",
              experience_years: 10,
              consultation_fee: 500,
              rating: 4.9,
              reviews: 142
            },
            {
              id: 2,
              user: { first_name: "Zara", last_name: "Ahmed" },
              specialty: "Cardiology",
              bmdc_reg: "BMDC-A-51920",
              experience_years: 12,
              consultation_fee: 800,
              rating: 4.95,
              reviews: 98
            },
            {
              id: 3,
              user: { first_name: "Kamal", last_name: "Islam" },
              specialty: "ENT & Head Neck",
              bmdc_reg: "BMDC-A-39182",
              experience_years: 8,
              consultation_fee: 600,
              rating: 4.85,
              reviews: 76
            }
          ]).map((doc) => {
            const docName = `Dr. ${doc.user?.first_name || ''} ${doc.user?.last_name || ''}`.trim() || "Specialist Doctor";
            return (
              <div
                key={doc.id}
                className="p-5 rounded-2xl bg-white border border-[#BDDDFA] hover:shadow-md hover:border-[#168CF5] transition-all flex flex-col justify-between space-y-4 group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="relative">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#E7F0FC] to-[#BDDDFA] border border-[#BDDDFA] text-[#0F172A] font-bold flex items-center justify-center text-base group-hover:scale-105 transition-transform">
                        {doc.user?.first_name?.[0] || 'D'}
                      </div>
                      <span className="w-3 h-3 rounded-full bg-[#059669] border-2 border-white absolute -bottom-0.5 -right-0.5" title="Available Online" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-[#0F172A] group-hover:text-[#168CF5] transition-colors">
                        {docName}
                      </h4>
                      <p className="text-xs text-[#059669] font-semibold mt-0.5">
                        {doc.specialty || 'General Practitioner'}
                      </p>
                      <div className="flex items-center gap-1.5 text-[11px] text-[#55647C] mt-1">
                        <span className="flex items-center text-amber-500 font-bold">
                          <Star className="w-3 h-3 fill-amber-400 mr-0.5" />
                          {doc.rating || '4.9'}
                        </span>
                        <span>•</span>
                        <span>{doc.experience_years || 10}+ yrs exp</span>
                      </div>
                    </div>
                  </div>

                  <VerifiedBadge text="BMDC" size="sm" />
                </div>

                <div className="pt-3 border-t border-[#BDDDFA] flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-[#55647C] uppercase font-bold block">Consultation Fee</span>
                    <span className="text-xs font-extrabold text-[#0F172A]">
                      ৳{doc.consultation_fee || 500} BDT
                    </span>
                  </div>

                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setBookingModalDoc(doc);
                      setSelectedDocId(doc.user?.id || doc.id);
                    }}
                    className="font-bold text-xs"
                  >
                    Book Visit
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Recent Prescriptions & Records Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Prescriptions Preview Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Prescriptions</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setSubView('prescriptions')}>
                View All ({prescriptions.length})
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {prescriptions.length === 0 ? (
              <EmptyState
                icon={Award}
                title="No prescriptions issued yet"
                description=""
              />
            ) : (
              <div className="space-y-3">
                {prescriptions.slice(0, 3).map((p) => (
                  <div key={p.id} className="p-3.5 rounded-xl border border-[#BDDDFA] bg-[#E7F0FC] flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-[#0F172A]">
                        Dr. {p.doctor_details?.first_name || 'Specialist'} {p.doctor_details?.last_name || ''}
                      </p>
                      <p className="text-[10px] text-[#55647C] mt-0.5">
                        {p.diagnosis || 'Clinical evaluation'} • {new Date(p.created_at || Date.now()).toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      icon={Lock}
                      onClick={() => setSubView('prescriptions')}
                    >
                      Open Vault
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Active Consented Doctors */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Privacy &amp; Doctor Consents</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setSubView('consent')}>
                Manage ({consents.length})
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {consents.length === 0 ? (
              <EmptyState
                icon={ShieldCheck}
                title="No active authorizations"
                description="You have not delegated clinical record access to any doctor yet."
              />
            ) : (
              <div className="space-y-3">
                {consents.slice(0, 3).map(c => (
                  <div key={c.id} className="p-3.5 rounded-xl border border-[#BDDDFA] bg-[#E7F0FC] flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-[#0F172A]">
                        Dr. {c.doctor_details?.first_name} {c.doctor_details?.last_name}
                      </p>
                      <p className="text-[10px] text-[#55647C] mt-0.5">
                        {c.doctor_details?.specialty} • Window: {c.expires_hours || 24}h
                      </p>
                    </div>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleRevokeConsent(c.id)}
                    >
                      Revoke
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

