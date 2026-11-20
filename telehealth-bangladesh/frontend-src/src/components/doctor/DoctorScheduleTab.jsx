import React from 'react';
import { DollarSign, Clock, Save, ShieldCheck, CheckCircle, AlertCircle } from 'lucide-react';
import {
  Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Button
} from '../ui';

export const DoctorScheduleTab = ({
  consultationFee,
  setConsultationFee,
  scheduleSlots,
  setScheduleSlots,
  scheduleSuccessMsg,
  scheduleErrMsg,
  scheduleLoading,
  handleSaveScheduleAndFee,
  handleToggleDayActive,
  handleSlotTimeChange,
  DEFAULT_WEEKLY_SCHEDULE,
  TIME_OPTIONS
}) => {
  return (
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
                  Configure your standard consultation fee per appointment
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
                  Define your weekly consulting availability hours for patient bookings
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
  );
};

export default DoctorScheduleTab;

