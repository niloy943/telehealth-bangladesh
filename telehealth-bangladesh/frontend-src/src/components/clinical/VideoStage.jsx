import React from 'react';
import {
  Video, VideoOff, Mic, MicOff, User, Shield, ShieldCheck, Lock, Clock, RefreshCw
} from 'lucide-react';
import { CallControls } from './CallControls';

export const VideoStage = ({
  isAudioOnly = false,
  appointmentMode = 'video',
  setupScreen = true,
  webrtcStatus = 'disconnected',
  localVideoRef,
  remoteVideoRef,
  remoteAudioRef,
  handleJoinCall,
  handleReconnect,
  user,
  patientData,
  consultationData,
  anonIdentifier,
  callTimer = '00:00',
  micActive = true,
  cameraActive = true,
  toggleMic,
  toggleCamera,
  onEndCall,
  isDoctorView = false
}) => {
  // ─── 1. DOCTOR VIDEO SPLIT VIEW ───
  if (isDoctorView) {
    return (
      <div className="bg-white p-4 rounded-2xl border border-[#BDDDFA] shadow-sm space-y-3">
        <div className="flex justify-between items-center border-b border-[#BDDDFA]/60 pb-2 text-xs font-semibold">
          <span className="text-[#059669] flex items-center gap-1.5 font-bold">
            <ShieldCheck className="w-4 h-4" />
            <span>{isAudioOnly ? 'Audio Stream' : 'Live Video Stream'}</span>
          </span>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#E7F0FC] text-[#059669] border border-[#BDDDFA]">
              {webrtcStatus === 'connected' ? 'Connected' : webrtcStatus.toUpperCase()}
            </span>
            <span className="text-[10px] font-mono text-[#55647C] font-semibold">{callTimer}</span>
          </div>
        </div>

        {/* Pre-Call Setup Screen */}
        {setupScreen ? (
          <div className="flex flex-col items-center justify-center p-4 border border-[#BDDDFA] rounded-xl bg-[#F4F6F9] text-center">
            {!isAudioOnly ? (
              <div className="relative w-full h-44 bg-[#0F172A] rounded-xl overflow-hidden mb-3 border border-[#BDDDFA] flex items-center justify-center">
                <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover transform scale-x-[-1]"></video>
                <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/60 text-white text-[9px] font-bold uppercase tracking-wider">
                  Camera Ready
                </div>
              </div>
            ) : (
              <div className="w-16 h-16 rounded-full bg-emerald-50 text-[#059669] flex items-center justify-center mb-3">
                <Mic className="w-8 h-8" />
              </div>
            )}
            <button
              type="button"
              onClick={handleJoinCall}
              className="w-full py-2.5 rounded-xl bg-[#059669] hover:bg-[#047857] text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-sm"
            >
              {isAudioOnly ? <Mic className="w-4 h-4" /> : <Video className="w-4 h-4" />}
              <span>Join Consultation Call</span>
            </button>
          </div>
        ) : (
          /* Active Conference Stream */
          <div className="space-y-3">
            <div className="relative rounded-xl overflow-hidden bg-[#0F172A] border border-[#1E293B] h-60 flex items-center justify-center">
              {!isAudioOnly ? (
                <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover"></video>
              ) : (
                <div className="text-center p-4">
                  <User className="w-12 h-12 text-teal-400 mx-auto mb-2" />
                  <p className="text-xs font-bold text-white">{patientData?.name}</p>
                  <p className="text-[10px] text-slate-400">Encrypted Audio Channel</p>
                </div>
              )}
              <div className="absolute top-2 left-2 bg-[#0F172A]/80 px-2 py-0.5 rounded-md text-[9px] text-white font-semibold flex items-center gap-1 border border-[#334155]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#34D399]" />
                <span>{patientData?.name}</span>
              </div>
              {/* Floating Self-View for video */}
              {!isAudioOnly && (
                <div className="absolute bottom-2 right-2 w-28 h-18 rounded-lg overflow-hidden border border-white/20 bg-black">
                  <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover transform scale-x-[-1]"></video>
                  <span className="absolute bottom-1 left-1 px-1 py-0.2 rounded bg-black/70 text-[7px] text-white font-bold">You</span>
                </div>
              )}
            </div>

            {/* HUD Controls */}
            <CallControls
              micActive={micActive}
              toggleMic={toggleMic}
              cameraActive={cameraActive}
              toggleCamera={toggleCamera}
              isAudioOnly={isAudioOnly}
              userRole="doctor"
              onEndCall={onEndCall}
              variant="compact"
            />
          </div>
        )}
      </div>
    );
  }

  // ─── 2. PATIENT / FULL AUDIO-ONLY VIEW ───
  if (isAudioOnly) {
    return (
      <div className="bg-white p-5 rounded-2xl border border-[#BDDDFA] flex flex-col justify-between min-h-[520px]">
        {/* Hidden Audio Element for incoming remote peer stream */}
        <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

        {/* Header Status Bar */}
        <div className="flex justify-between items-center border-b border-[#BDDDFA]/60 pb-2.5 mb-4 text-xs font-semibold">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#059669] animate-pulse" />
            <span className="text-[#059669] font-bold">Audio Consultation</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
              webrtcStatus === 'connected' ? 'bg-emerald-50 text-[#059669] border border-emerald-200' :
              webrtcStatus === 'connecting' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
              webrtcStatus === 'reconnecting' ? 'bg-orange-50 text-orange-700 border border-orange-200' :
              'bg-slate-100 text-slate-600 border border-slate-200'
            }`}>
              {webrtcStatus === 'connected' ? 'Connected' : webrtcStatus.toUpperCase()}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReconnect}
              title="Reconnect Audio"
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#BDDDFA] hover:bg-[#E7F0FC] text-[11px] text-[#55647C] font-semibold cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Reconnect</span>
            </button>
            <span className="text-[10px] bg-[#E7F0FC] border border-[#BDDDFA] px-2 py-0.5 rounded-full text-[#0F172A] font-bold">
              End-to-End Encrypted
            </span>
          </div>
        </div>

        {/* Pre-Call Setup Screen */}
        {setupScreen ? (
          <div className="flex-grow flex flex-col items-center justify-center p-6 border border-[#BDDDFA] rounded-2xl bg-gradient-to-b from-[#F4F6F9] to-[#E7F0FC]/40 text-center">
            <div className="w-16 h-16 rounded-2xl bg-purple-100 text-purple-700 border border-purple-200 flex items-center justify-center mb-3.5 shadow-sm">
              <Mic className="w-8 h-8" />
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200 mb-2">
              <Lock className="w-3.5 h-3.5" />
              <span>{user?.role === 'doctor' ? anonIdentifier : 'Anonymous Consultation'}</span>
            </div>

            <h3 className="text-base sm:text-lg font-bold text-[#0F172A] mb-1">
              {user?.role === 'doctor' ? 'Pre-Consultation Audio Check' : 'Start Anonymous Consultation'}
            </h3>

            <p className="text-xs text-[#55647C] max-w-md mb-4 leading-relaxed">
              {user?.role === 'doctor'
                ? 'You are conducting an audio consultation with an anonymous patient. Video is disabled to protect patient privacy.'
                : 'Your microphone will be enabled for doctor communication. Camera and personal details remain completely hidden.'}
            </p>

            {/* Patient Privacy Notice */}
            {user?.role !== 'doctor' && (
              <div className="p-3 mb-4 rounded-xl bg-purple-50 border border-purple-200 text-xs text-purple-900 max-w-md flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-purple-600 shrink-0" />
                <span className="font-semibold text-[11px]">
                  During Consultation, Your identity is hidden from the doctor
                </span>
              </div>
            )}

            {/* Microphone Preview Box */}
            <div className="w-72 p-3.5 rounded-xl bg-white border border-[#BDDDFA] shadow-sm mb-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-50 text-[#059669] flex items-center justify-center">
                  <Mic className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <p className="text-xs font-bold text-[#0F172A]">Microphone Ready</p>
                  <p className="text-[10px] text-[#55647C]">Audio-only stream (No Camera)</p>
                </div>
              </div>
              <span className="w-2.5 h-2.5 rounded-full bg-[#059669] animate-pulse" />
            </div>

            <button
              type="button"
              onClick={handleJoinCall}
              className="px-6 py-2.5 rounded-xl bg-[#059669] hover:bg-[#047857] text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-sm cursor-pointer"
            >
              <Mic className="w-4 h-4" />
              <span>Join Audio Consultation</span>
            </button>
          </div>
        ) : (
          /* Active Audio Consultation Stage */
          <div className="flex-grow flex flex-col justify-between">
            <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0F172A] border border-[#1E293B] min-h-[380px] flex flex-col items-center justify-center p-6 text-center shadow-inner">
              {/* Top Overlay Badge */}
              <div className="absolute top-3 left-3 bg-[#0F172A]/90 px-3 py-1 rounded-lg text-[10px] text-white font-semibold flex items-center gap-1.5 border border-[#334155]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#34D399] animate-pulse" />
                <span>Anonymous Audio Stream • AES-256 E2EE</span>
              </div>

              {/* Call Duration Pill */}
              <div className="absolute top-3 right-3 bg-black/60 px-3 py-1 rounded-lg text-xs font-mono font-bold text-[#34D399] flex items-center gap-1.5 border border-white/10">
                <Clock className="w-3.5 h-3.5" />
                <span>{callTimer}</span>
              </div>

              {/* Center Display */}
              {user?.role === 'doctor' ? (
                <div className="space-y-3 max-w-sm">
                  <div className="w-24 h-24 rounded-full bg-purple-900/60 border-2 border-purple-400 text-purple-300 flex items-center justify-center mx-auto shadow-lg shadow-purple-900/30">
                    <Shield className="w-12 h-12" />
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-black text-white tracking-wide">
                      {anonIdentifier}
                    </h2>
                    <p className="text-xs sm:text-sm font-semibold text-purple-300 mt-0.5">
                      Audio Consultation
                    </p>
                    <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/30 text-emerald-400 text-xs font-bold mt-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span>Connected</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 max-w-md">
                  <div className="w-20 h-20 rounded-full bg-emerald-900/50 border-2 border-[#34D399] text-[#34D399] flex items-center justify-center mx-auto shadow-lg shadow-emerald-900/30">
                    <Mic className="w-10 h-10" />
                  </div>

                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-900/60 border border-purple-400/30 text-purple-200 text-xs font-bold">
                    <Lock className="w-3.5 h-3.5 text-purple-300" />
                    <span>Your Session: {anonIdentifier}</span>
                  </div>

                  <div>
                    <h2 className="text-lg sm:text-xl font-black text-white">
                      {consultationData?.doctor?.name ? `Dr. ${consultationData.doctor.name}` : 'Consulting Doctor'}
                    </h2>
                    <p className="text-xs text-slate-300">
                      {consultationData?.doctor?.specialty || 'General Telemedicine Specialist'}
                    </p>
                    <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/30 text-emerald-400 text-xs font-bold mt-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span>Connected</span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-purple-950/60 border border-purple-500/30 text-[11px] text-purple-200 max-w-xs mx-auto">
                    <p className="font-semibold flex items-center justify-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-purple-300" />
                      <span>During Consultation, Your identity is hidden from the doctor</span>
                    </p>
                  </div>
                </div>
              )}

              {/* Dynamic Sound Wave Visualizer */}
              <div className="flex items-center justify-center gap-1.5 h-10 mt-6 mb-2">
                {[35, 65, 40, 85, 55, 95, 75, 45, 90, 60, 100, 70, 50, 80, 30].map((h, i) => (
                  <div
                    key={i}
                    className={`w-1.5 rounded-full transition-all duration-300 ${
                      micActive
                        ? 'bg-gradient-to-t from-[#059669] to-[#34D399] animate-pulse'
                        : 'bg-slate-700'
                    }`}
                    style={{
                      height: micActive ? `${h}%` : '20%',
                      animationDelay: `${i * 60}ms`
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Bottom Controls HUD */}
            <CallControls
              micActive={micActive}
              toggleMic={toggleMic}
              cameraActive={cameraActive}
              toggleCamera={toggleCamera}
              isAudioOnly={true}
              userRole={user?.role}
              onEndCall={onEndCall}
              onReconnect={handleReconnect}
              variant="rounded"
            />
          </div>
        )}
      </div>
    );
  }

  // ─── 3. PATIENT / FULL VIDEO CONSULTATION VIEW ───
  return (
    <div className="bg-white p-5 rounded-2xl border border-[#BDDDFA] flex flex-col justify-between min-h-[520px]">
      {/* Header Status Bar */}
      <div className="flex justify-between items-center border-b border-[#BDDDFA]/60 pb-2.5 mb-4 text-xs font-semibold">
        <span className="text-[#059669] flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4" />
          <span>Live Medical WebRTC Room</span>
        </span>
        <span className="text-[10px] bg-[#E7F0FC] border border-[#BDDDFA] px-2 py-0.5 rounded-full text-[#0F172A] font-bold">
          Direct Peer-to-Peer
        </span>
      </div>

      {/* Pre-Call Setup Screen */}
      {setupScreen ? (
        <div className="flex-grow flex flex-col items-center justify-center p-6 border border-[#BDDDFA] rounded-2xl bg-[#F4F6F9] text-center">
          <div className="w-12 h-12 rounded-[10px] bg-[#E7F0FC] text-[#059669] border border-[#BDDDFA] flex items-center justify-center mb-3">
            <Video className="w-6 h-6" />
          </div>
          <h3 className="text-sm sm:text-base font-bold text-[#0F172A] mb-1">
            Pre-Consultation Device Check
          </h3>
          <p className="text-xs text-[#55647C] max-w-sm mb-5 leading-relaxed">
            Check your camera and microphone preview before joining the consultation room.
          </p>

          {/* Camera Preview Frame */}
          <div className="relative w-72 h-44 bg-[#0F172A] rounded-2xl overflow-hidden mb-5 border border-[#BDDDFA] flex items-center justify-center">
            <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover transform scale-x-[-1]"></video>
            <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/60 text-white text-[9px] font-bold uppercase tracking-wider">
              Camera Ready
            </div>
          </div>

          <button
            type="button"
            onClick={handleJoinCall}
            className="px-6 py-2.5 rounded-[10px] bg-[#059669] hover:bg-[#047857] text-white font-bold text-xs flex items-center gap-2 cursor-pointer"
          >
            <Video className="w-4 h-4" />
            <span>Join Consultation Call</span>
          </button>
        </div>
      ) : (
        /* Active Conference Screen with Floating Self View */
        <div className="flex-grow flex flex-col justify-between">
          <div className="relative rounded-2xl overflow-hidden bg-[#0F172A] border border-[#1E293B] min-h-[380px] flex items-center justify-center">
            {/* Remote Participant Stream */}
            <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover"></video>

            {/* Fallback Overlay if remote video is not streaming yet */}
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0F172A]/80 text-center p-4">
              <div className="w-16 h-16 rounded-full bg-[#1E293B] border border-[#334155] text-[#34D399] flex items-center justify-center mb-3">
                <User className="w-8 h-8" />
              </div>
              <p className="text-xs font-bold text-white uppercase tracking-wider">Awaiting remote participant...</p>
              <p className="text-[11px] text-[#CBD5E1] mt-1">Direct peer connection will begin automatically when peer joins.</p>
            </div>

            {/* Top Overlay Badge */}
            <div className="absolute top-3 left-3 bg-[#0F172A]/80 px-2.5 py-1 rounded-lg text-[10px] text-white font-semibold flex items-center gap-1.5 border border-[#334155]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#34D399]" />
              <span>Consultation Stream (AES-256 E2EE)</span>
            </div>

            {/* Floating Picture-in-Picture Local Self-View */}
            <div className="absolute bottom-3 right-3 w-36 sm:w-44 h-24 sm:h-28 rounded-xl overflow-hidden border-2 border-white/20 bg-black">
              <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover transform scale-x-[-1]"></video>
              <span className="absolute bottom-1 left-1.5 px-1.5 py-0.5 rounded bg-black/70 text-[8px] text-white font-bold">You (Local)</span>
            </div>
          </div>

          {/* Bottom Controls HUD */}
          <CallControls
            micActive={micActive}
            toggleMic={toggleMic}
            cameraActive={cameraActive}
            toggleCamera={toggleCamera}
            isAudioOnly={false}
            userRole={user?.role}
            onEndCall={onEndCall}
            variant="rounded"
          />
        </div>
      )}
    </div>
  );
};
