import React from 'react';
import { Mic, MicOff, Video, VideoOff, Monitor, PhoneOff, RefreshCw } from 'lucide-react';

export const CallControls = ({
  micActive,
  toggleMic,
  cameraActive,
  toggleCamera,
  isAudioOnly = false,
  userRole = 'patient',
  onEndCall,
  onReconnect,
  variant = 'default' // 'default' (full pill), 'compact' (doctor video split), 'rounded'
}) => {
  if (variant === 'compact') {
    return (
      <div className="flex items-center justify-center gap-2 pt-1 border-t border-slate-100">
        <button
          type="button"
          onClick={toggleMic}
          className={`p-2.5 rounded-xl border cursor-pointer ${
            micActive ? 'bg-[#E7F0FC] border-[#BDDDFA] text-[#0F172A]' : 'bg-red-500 text-white'
          }`}
          title={micActive ? "Mute Microphone" : "Unmute Microphone"}
        >
          {micActive ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
        </button>
        {!isAudioOnly && (
          <button
            type="button"
            onClick={toggleCamera}
            className={`p-2.5 rounded-xl border cursor-pointer ${
              cameraActive ? 'bg-[#E7F0FC] border-[#BDDDFA] text-[#0F172A]' : 'bg-red-500 text-white'
            }`}
            title={cameraActive ? "Turn Off Camera" : "Turn On Camera"}
          >
            {cameraActive ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
          </button>
        )}
        <button
          type="button"
          onClick={onEndCall}
          className="px-3 py-2 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] text-white cursor-pointer flex items-center gap-1.5 text-xs font-bold transition shadow-sm"
          title="End Consultation"
        >
          <PhoneOff className="w-4 h-4" />
          <span>End Consultation</span>
        </button>
      </div>
    );
  }

  // Rounded circular controls for Patient/Full views
  return (
    <div className="flex items-center justify-center gap-3 mt-4 pt-3 border-t border-[#BDDDFA]/60">
      <button
        type="button"
        onClick={toggleMic}
        className={`p-3 rounded-full border cursor-pointer transition-colors ${
          micActive
            ? 'bg-[#E7F0FC] border-[#BDDDFA] text-[#0F172A] hover:bg-[#BDDDFA]'
            : 'bg-red-500 border-red-600 text-white'
        }`}
        title={micActive ? "Mute Microphone" : "Unmute Microphone"}
      >
        {micActive ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
      </button>

      {!isAudioOnly && (
        <button
          type="button"
          onClick={toggleCamera}
          className={`p-3 rounded-full border cursor-pointer transition-colors ${
            cameraActive
              ? 'bg-[#E7F0FC] border-[#BDDDFA] text-[#0F172A] hover:bg-[#BDDDFA]'
              : 'bg-red-500 border-red-600 text-white'
          }`}
          title={cameraActive ? "Turn Off Camera" : "Turn On Camera"}
        >
          {cameraActive ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
        </button>
      )}

      {onReconnect && (
        <button
          type="button"
          onClick={onReconnect}
          className="p-3 rounded-full bg-[#E7F0FC] border border-[#BDDDFA] text-[#0F172A] hover:bg-[#BDDDFA] cursor-pointer"
          title="Reconnect Session"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      )}

      {!isAudioOnly && variant !== 'compact' && (
        <button
          type="button"
          className="p-3 rounded-full bg-[#E7F0FC] border border-[#BDDDFA] text-[#0F172A] hover:bg-[#BDDDFA] cursor-pointer"
          title="Share Screen"
        >
          <Monitor className="w-4 h-4" />
        </button>
      )}

      <button
        type="button"
        onClick={onEndCall}
        className="p-3 rounded-full bg-[#DC2626] hover:bg-[#B91C1C] text-white cursor-pointer shadow-sm hover:shadow"
        title="End Consultation"
      >
        <PhoneOff className="w-4 h-4" />
      </button>
    </div>
  );
};

