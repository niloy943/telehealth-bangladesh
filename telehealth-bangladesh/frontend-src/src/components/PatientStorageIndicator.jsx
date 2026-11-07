import React from 'react';
import { HardDrive, AlertTriangle, CheckCircle2, ShieldCheck, FileCheck } from 'lucide-react';

export const PatientStorageIndicator = ({ storage, compact = false, className = '' }) => {
  const totalMb = storage?.total_mb ?? 250.0;
  const usedMb = storage?.used_mb ?? 0.0;
  const availableMb = storage?.available_mb ?? Math.max(0, totalMb - usedMb);
  const percentage = Math.min(100, Math.max(0, storage?.usage_percentage ?? (totalMb > 0 ? (usedMb / totalMb) * 100 : 0)));
  const filesCount = storage?.files_count ?? 0;

  const isNearLimit = percentage >= 85;
  const isFull = percentage >= 98;

  const barColor = isFull
    ? 'bg-rose-600'
    : isNearLimit
    ? 'bg-amber-500'
    : 'bg-[#059669]';

  if (compact) {
    return (
      <div className={`p-3 bg-[#E7F0FC]/70 border border-[#BDDDFA] rounded-xl space-y-1.5 ${className}`}>
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-[#0F172A] flex items-center gap-1.5">
            <HardDrive className="w-3.5 h-3.5 text-[#059669]" />
            <span>Storage Capacity</span>
          </span>
          <span className="font-mono text-[11px] text-[#55647C]">
            <strong className="text-[#0F172A]">{usedMb.toFixed(1)} MB</strong> / {totalMb} MB ({percentage.toFixed(1)}%)
          </span>
        </div>
        <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
          <div
            className={`h-full ${barColor} transition-all duration-300`}
            style={{ width: `${Math.max(2, percentage)}%` }}
          />
        </div>
        <div className="flex justify-between items-center text-[10px] text-[#55647C]">
          <span>Available: <strong className="text-emerald-700">{availableMb.toFixed(1)} MB</strong></span>
          <span className="text-slate-500">PDF, JPG, JPEG only</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white border border-[#BDDDFA] rounded-2xl p-5 shadow-sm space-y-3.5 ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#BDDDFA]/60 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#E7F0FC] border border-[#BDDDFA] flex items-center justify-center text-[#059669]">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#0F172A]">Encrypted Health Storage (250 MB Quota)</h3>
            <p className="text-xs text-[#55647C]">Dedicated cryptographic patient vault for medical documents and lab reports</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-[#059669] border border-emerald-200 flex items-center gap-1">
            <FileCheck className="w-3 h-3" />
            <span>PDF &bull; JPG &bull; JPEG</span>
          </span>
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
            {filesCount} File{filesCount !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="p-2.5 rounded-xl bg-[#E7F0FC]/60 border border-[#BDDDFA]">
          <span className="text-[10px] text-[#55647C] uppercase font-bold block">Total Quota</span>
          <span className="text-sm sm:text-base font-black text-[#0F172A]">{totalMb} MB</span>
        </div>
        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
          <span className="text-[10px] text-[#55647C] uppercase font-bold block">Used</span>
          <span className="text-sm sm:text-base font-black text-slate-800">{usedMb.toFixed(1)} MB</span>
        </div>
        <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200">
          <span className="text-[10px] text-emerald-800 uppercase font-bold block">Available</span>
          <span className="text-sm sm:text-base font-black text-emerald-700">{availableMb.toFixed(1)} MB</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center text-xs">
          <span className="text-[11px] font-semibold text-[#55647C]">Current Utilization</span>
          <span className="font-mono text-xs font-bold text-[#0F172A]">{percentage.toFixed(1)}%</span>
        </div>
        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200">
          <div
            className={`h-full rounded-full ${barColor} transition-all duration-300`}
            style={{ width: `${Math.max(2, percentage)}%` }}
          />
        </div>
      </div>

      {isNearLimit && (
        <div className="flex items-center gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>Storage quota is almost full ({percentage.toFixed(1)}%). Consider removing older reports to free up space.</span>
        </div>
      )}
    </div>
  );
};

