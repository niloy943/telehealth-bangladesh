import React from 'react';
import { ShieldCheck } from 'lucide-react';

export const MultimodalVisionPanel = ({ legacyImageProfiles = [] }) => {
  if (!legacyImageProfiles || legacyImageProfiles.length === 0) {
    return null;
  }

  return (
    <div className="mt-6 bg-white p-5 rounded-2xl border border-[#BDDDFA]">
      <div className="flex justify-between items-center border-b border-[#BDDDFA]/60 pb-2 mb-3">
        <span className="text-xs font-bold text-[#0F172A] uppercase tracking-wider flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-[#168CF5]" />
          <span>Multimodal Vision Summaries</span>
        </span>
      </div>
      <div className="h-40 overflow-y-auto pr-1 space-y-2">
        {legacyImageProfiles.map((p, idx) => (
          <div key={idx} className="bg-[#E7F0FC]/50 p-2.5 rounded-xl border border-[#BDDDFA] text-[10px] space-y-1">
            <div className="flex justify-between font-bold text-[#0F172A]">
              <span>{p.image_name}</span>
              <span className="text-[8px] text-[#94A3B8]">
                {p.created_at ? new Date(p.created_at).toLocaleDateString() : 'N/A'}
              </span>
            </div>
            <p className="whitespace-pre-wrap font-mono text-[9px] bg-white p-2 rounded border border-[#BDDDFA] text-[#334155]">
              {p.previous_data?.images?.ecg_summary || "No diagnostic summary extracted."}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MultimodalVisionPanel;
