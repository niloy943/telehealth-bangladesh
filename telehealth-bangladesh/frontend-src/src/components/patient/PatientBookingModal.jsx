import React from 'react';
import {
  Calendar, Video, Mic, MessageSquare, ShieldCheck
} from 'lucide-react';
import { Modal, Button } from '../ui';

export const PatientBookingModal = ({
  bookingModalDoc,
  setBookingModalDoc,
  apptForm,
  setApptForm,
  isAnonymousAppt,
  setIsAnonymousAppt,
  hasAgreedConsent,
  setHasAgreedConsent,
  isBookingLoading,
  handleBookAppointment
}) => {
  if (!bookingModalDoc) return null;

  return (
    <Modal
      isOpen={!!bookingModalDoc}
      onClose={() => setBookingModalDoc(null)}
      title={`Book with Dr. ${bookingModalDoc?.user?.first_name || ''} ${bookingModalDoc?.user?.last_name || ''}`}
      subtitle={`${bookingModalDoc?.specialty || ''} • Consultation Fee: ৳${bookingModalDoc?.fees || 500} BDT`}
    >
      <form onSubmit={handleBookAppointment} className="space-y-4">
        {/* Doctor Available Schedule */}
        {Array.isArray(bookingModalDoc?.schedule) && bookingModalDoc.schedule.length > 0 && (
          <div className="p-3 rounded-xl bg-[#E7F0FC] border border-[#BDDDFA] text-xs">
            <span className="font-bold text-[#0F172A] block mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#168CF5]" /> Doctor's Consultation Schedule:
            </span>
            <div className="space-y-1">
              {bookingModalDoc.schedule.map((slot, sIdx) => (
                <div key={sIdx} className="flex justify-between items-center text-[#334155]">
                  <span className="font-medium text-[#0F172A]">{slot.day}</span>
                  <span className="font-mono text-[#059669] font-semibold">{slot.start_time} – {slot.end_time}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <div>
          <label className="block text-xs font-semibold text-[#0F172A] mb-1">Consultation Date</label>
          <input
            type="date"
            required
            value={apptForm.date}
            onChange={e => setApptForm({ ...apptForm, date: e.target.value })}
            className="w-full p-2.5 bg-[#E7F0FC] rounded-[15px] text-xs text-[#111827] outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#0F172A] mb-1">Preferred Time Slot</label>
          <select
            value={apptForm.time}
            onChange={e => setApptForm({ ...apptForm, time: e.target.value })}
            className="w-full p-2.5 bg-[#E7F0FC] rounded-[15px] text-xs text-[#111827] outline-none"
          >
            <option value="09:00 AM">09:00 AM</option>
            <option value="10:00 AM">10:00 AM</option>
            <option value="11:30 AM">11:30 AM</option>
            <option value="02:00 PM">02:00 PM</option>
            <option value="04:00 PM">04:00 PM</option>
            <option value="07:00 PM">07:00 PM</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#0F172A] mb-1">Consultation Mode</label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setApptForm({ ...apptForm, consultation_type: 'video' })}
              className={`p-2 rounded-[10px] border text-[11px] font-bold flex flex-col sm:flex-row items-center justify-center gap-1.5 transition-all ${apptForm.consultation_type === 'video'
                  ? 'bg-[#059669] border-[#059669] text-white shadow-sm'
                  : 'bg-white border-[#BDDDFA] text-[#55647C] hover:bg-[#F4F6F9]'
                }`}
            >
              <Video className="w-3.5 h-3.5" />
              <span>Video Call</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setApptForm({ ...apptForm, consultation_type: 'audio' });
                setIsAnonymousAppt(true);
              }}
              className={`p-2 rounded-[10px] border text-[11px] font-bold flex flex-col sm:flex-row items-center justify-center gap-1.5 transition-all ${apptForm.consultation_type === 'audio'
                  ? 'bg-purple-700 border-purple-700 text-white shadow-sm'
                  : 'bg-white border-[#BDDDFA] text-[#55647C] hover:bg-purple-50'
                }`}
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Audio (Anonymous)</span>
            </button>
            <button
              type="button"
              onClick={() => setApptForm({ ...apptForm, consultation_type: 'chat' })}
              className={`p-2 rounded-[10px] border text-[11px] font-bold flex flex-col sm:flex-row items-center justify-center gap-1.5 transition-all ${apptForm.consultation_type === 'chat'
                  ? 'bg-[#059669] border-[#059669] text-white shadow-sm'
                  : 'bg-white border-[#BDDDFA] text-[#55647C] hover:bg-[#F4F6F9]'
                }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Encrypted Chat</span>
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#0F172A] mb-1">Reason for Visit / Symptoms</label>
          <textarea
            rows={2}
            required
            value={apptForm.reason}
            onChange={e => setApptForm({ ...apptForm, reason: e.target.value })}
            placeholder="e.g. Mild chest pain, high fever for 2 days, prescription renewal..."
            className="w-full p-2.5 bg-[#E7F0FC] rounded-[15px] text-xs text-[#111827] placeholder-[#4B5563] outline-none"
          />
        </div>

        {/* Anonymous Consultation Consent & Confirmation */}
        {(isAnonymousAppt || apptForm.consultation_type === 'audio') && (
          <div className="p-3.5 rounded-xl bg-purple-50 border border-purple-200 text-xs space-y-2">
            <div className="flex items-center gap-2 font-bold text-purple-900">
              <ShieldCheck className="w-4 h-4 text-purple-700 shrink-0" />
              <span>Start Anonymous Consultation?</span>
            </div>
            <ul className="text-purple-800 space-y-1 pl-4 list-disc text-[11px] leading-relaxed">
              <li>The doctor will not see your real identity (real name, email, phone, and photo remain hidden).</li>
              <li>Audio communication is required for the consultation (microphone permission only, camera is disabled).</li>
              <li>Your consultation may still generate a medical record according to healthcare regulations.</li>
            </ul>
            <label className="flex items-center gap-2 pt-1 font-semibold text-purple-900 cursor-pointer text-[11px]">
              <input
                type="checkbox"
                checked={hasAgreedConsent}
                onChange={e => setHasAgreedConsent(e.target.checked)}
                className="rounded text-purple-600 focus:ring-purple-500"
              />
              <span>I confirm and consent to the anonymous consultation terms</span>
            </label>
          </div>
        )}

        {apptForm.consultation_type !== 'audio' && (
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="anonAppt"
              checked={isAnonymousAppt}
              onChange={e => setIsAnonymousAppt(e.target.checked)}
              className="rounded text-[#059669] focus:ring-[#059669]"
            />
            <label htmlFor="anonAppt" className="text-xs text-[#55647C]">
              Anonymous consultation (pseudonymize profile for this visit)
            </label>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-3">
          <Button variant="outline" size="sm" type="button" onClick={() => setBookingModalDoc(null)}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" type="submit" loading={isBookingLoading}>
            Confirm &amp; Request Visit
          </Button>
        </div>
      </form>
    </Modal>
  );
};

