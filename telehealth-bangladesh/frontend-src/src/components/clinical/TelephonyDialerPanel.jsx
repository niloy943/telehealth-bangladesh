import React from 'react';
import { Phone, PhoneOff, Terminal } from 'lucide-react';

export const TelephonyDialerPanel = ({
  t,
  activeCallMode,
  sipStatus,
  dialNumber,
  setDialNumber,
  pressDialKey,
  handleBackspace,
  onCellCall,
  hangupVoip,
  triggerCall,
  pbxLogs = [],
  triggerPBXCallbackSim,
  callLogs = []
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 min-h-[500px]">
      {/* Voice dialer keypad */}
      <div className="bg-white p-6 rounded-2xl border border-[#BDDDFA] flex flex-col justify-between">
        <div className="flex justify-between items-center border-b border-[#BDDDFA]/60 pb-2.5 mb-4">
          <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
            {t ? t('voiceDialpad') : 'Voice Dialpad'}
          </h3>
          <div className="flex items-center gap-1.5">
            {activeCallMode === 'live' ? (
              <span className="text-[9px] bg-emerald-50 text-[#059669] border border-emerald-300 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#059669]"></span>
                LIVE TWILIO
              </span>
            ) : (
              <span className="text-[9px] bg-amber-50 text-amber-700 border border-amber-300 px-2 py-0.5 rounded-full font-bold">
                DEV SANDBOX
              </span>
            )}
            <span className="text-[10px] bg-[#E7F0FC] border border-[#BDDDFA] px-2 py-0.5 rounded-full text-[#0F172A] font-bold uppercase">
              {sipStatus}
            </span>
          </div>
        </div>

        <div className="space-y-4">
          <input
            type="text"
            placeholder={t ? t('dialerPlaceholder') : 'Enter destination phone number...'}
            value={dialNumber}
            onChange={e => setDialNumber(e.target.value)}
            className="w-full text-center font-mono font-bold text-lg"
          />

          {/* Keypad */}
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, '*', 0, '#'].map(k => (
              <button
                key={k}
                onClick={() => pressDialKey(k.toString())}
                className="py-3 rounded-[10px] bg-[#E7F0FC] hover:bg-[#BDDDFA] border border-[#BDDDFA] text-sm font-bold text-[#0F172A] cursor-pointer"
              >
                {k}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2.5 mt-4 pt-3 border-t border-[#BDDDFA]/60">
          <button
            onClick={handleBackspace}
            className="w-1/3 bg-white hover:bg-[#F4F6F9] border border-[#BDDDFA] text-[#0F172A] font-bold py-3 rounded-[10px] text-xs cursor-pointer"
          >
            Clear
          </button>
          {onCellCall ? (
            <button
              onClick={hangupVoip}
              className="w-2/3 bg-[#DC2626] hover:bg-[#B91C1C] text-white font-bold py-3 rounded-[10px] text-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <PhoneOff className="w-4 h-4" />
              <span>Hang Up</span>
            </button>
          ) : (
            <button
              onClick={() => triggerCall()}
              className="w-2/3 bg-[#059669] hover:bg-[#047857] text-white font-bold py-3 rounded-[10px] text-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Phone className="w-4 h-4" />
              <span>Dial Specialist</span>
            </button>
          )}
        </div>
      </div>

      {/* Telephony Screen Log Terminal */}
      <div className="space-y-6 flex flex-col">
        <div className="bg-white p-6 rounded-2xl border border-[#BDDDFA] flex-grow flex flex-col justify-between">
          <div className="flex items-center gap-2 border-b border-[#BDDDFA]/60 pb-2.5 mb-3">
            <Terminal className="w-4 h-4 text-[#059669]" />
            <h4 className="text-xs font-bold text-[#0F172A]">
              {t ? t('pbxScreen') : 'PBX Screen Terminal'}
            </h4>
          </div>

          <div className="flex-grow font-mono text-[9px] text-[#34D399] space-y-1 bg-[#0F172A] p-3 rounded-xl border border-[#1E293B] max-h-[180px] overflow-y-auto">
            {pbxLogs.map((line, i) => (
              <p key={i} className="leading-relaxed">{line}</p>
            ))}
          </div>

          <div className="mt-4 border-t border-[#BDDDFA]/60 pt-3.5 space-y-2">
            <h4 className="text-[10px] font-bold text-[#55647C] uppercase tracking-widest">PBX Callback Bridge</h4>
            <p className="text-[11px] text-[#55647C] leading-relaxed">
              Request callback bridging: Twilio trunk rings your phone line, then dials the doctor's active voice endpoint automatically.
            </p>
            <button
              onClick={triggerPBXCallbackSim}
              className="w-full bg-[#E7F0FC] hover:bg-[#BDDDFA] text-[#0F172A] border border-[#BDDDFA] font-bold py-2 rounded-[10px] text-xs cursor-pointer"
            >
              {t ? t('triggerTwilio') : 'Trigger Callback Bridge'}
            </button>
          </div>
        </div>

        {/* History List */}
        <div className="bg-white p-6 rounded-2xl border border-[#BDDDFA] max-h-[180px] overflow-y-auto">
          <h4 className="text-xs font-bold text-[#0F172A] border-b border-[#BDDDFA]/60 pb-2 mb-3 uppercase tracking-wider">
            {t ? t('recentLogs') : 'Recent Call Logs'}
          </h4>
          {callLogs.length === 0 ? (
            <p className="text-[10px] text-[#94A3B8] text-center py-4">No voice call history indexed.</p>
          ) : (
            callLogs.map(log => (
              <div key={log.id} className="flex justify-between items-center text-[10px] border-b border-[#BDDDFA]/40 py-1.5">
                <span className="font-mono text-[#0F172A]">{log.number}</span>
                <span className="text-[#94A3B8]">{log.date}</span>
                <span className="text-[#059669] font-bold">{log.status}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default TelephonyDialerPanel;

