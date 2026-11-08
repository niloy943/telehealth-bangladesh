import React from 'react';
import { Modal, Button } from '../ui';

export const PatientVitalsModal = ({
  isVitalsModalOpen,
  setIsVitalsModalOpen,
  vitalsForm,
  setVitalsForm,
  handleSaveVitals
}) => {
  return (
    <Modal
      isOpen={isVitalsModalOpen}
      onClose={() => setIsVitalsModalOpen(false)}
      title="Update Daily Health Checkup"
      subtitle="Log today's biometric parameters and clinical vitals."
    >
      <form onSubmit={handleSaveVitals} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-[#0F172A] mb-1">Age (Years)</label>
            <input
              type="number"
              min="1"
              max="120"
              required
              value={vitalsForm.age}
              onChange={e => setVitalsForm({ ...vitalsForm, age: e.target.value })}
              className="w-full p-2.5 bg-[#E7F0FC] rounded-[12px] text-xs text-[#111827] outline-none border border-[#BDDDFA]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#0F172A] mb-1">Blood Group</label>
            <select
              value={vitalsForm.bloodGroup}
              onChange={e => setVitalsForm({ ...vitalsForm, bloodGroup: e.target.value })}
              className="w-full p-2.5 bg-[#E7F0FC] rounded-[12px] text-xs text-[#111827] outline-none border border-[#BDDDFA]"
            >
              {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map(bg => (
                <option key={bg} value={bg}>{bg}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-[#0F172A] mb-1">Weight (kg)</label>
            <input
              type="number"
              step="0.1"
              min="20"
              max="300"
              required
              value={vitalsForm.weight}
              onChange={e => setVitalsForm({ ...vitalsForm, weight: e.target.value })}
              className="w-full p-2.5 bg-[#E7F0FC] rounded-[12px] text-xs text-[#111827] outline-none border border-[#BDDDFA]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#0F172A] mb-1">Height (cm)</label>
            <input
              type="number"
              step="1"
              min="50"
              max="250"
              required
              value={vitalsForm.height}
              onChange={e => setVitalsForm({ ...vitalsForm, height: e.target.value })}
              className="w-full p-2.5 bg-[#E7F0FC] rounded-[12px] text-xs text-[#111827] outline-none border border-[#BDDDFA]"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-[11px] font-semibold text-[#0F172A] mb-1">Systolic BP</label>
            <input
              type="number"
              min="60"
              max="240"
              value={vitalsForm.bloodPressureSys}
              onChange={e => setVitalsForm({ ...vitalsForm, bloodPressureSys: e.target.value })}
              placeholder="120"
              className="w-full p-2 bg-[#E7F0FC] rounded-[12px] text-xs text-[#111827] outline-none border border-[#BDDDFA]"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#0F172A] mb-1">Diastolic BP</label>
            <input
              type="number"
              min="40"
              max="160"
              value={vitalsForm.bloodPressureDia}
              onChange={e => setVitalsForm({ ...vitalsForm, bloodPressureDia: e.target.value })}
              placeholder="80"
              className="w-full p-2 bg-[#E7F0FC] rounded-[12px] text-xs text-[#111827] outline-none border border-[#BDDDFA]"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#0F172A] mb-1">Heart Rate (bpm)</label>
            <input
              type="number"
              min="40"
              max="200"
              value={vitalsForm.heartRate}
              onChange={e => setVitalsForm({ ...vitalsForm, heartRate: e.target.value })}
              placeholder="72"
              className="w-full p-2 bg-[#E7F0FC] rounded-[12px] text-xs text-[#111827] outline-none border border-[#BDDDFA]"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-[#BDDDFA]">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsVitalsModalOpen(false)}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
          >
            Save Health Parameters
          </Button>
        </div>
      </form>
    </Modal>
  );
};
