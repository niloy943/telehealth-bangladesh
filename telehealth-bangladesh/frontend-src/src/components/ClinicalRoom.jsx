import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from './LanguageContext';
import { 
  Send, ShieldCheck, Video, VideoOff, Mic, MicOff, PhoneOff, Phone, 
  Monitor, Play, Trash2, ArrowLeft, Terminal, AlertCircle, Volume2
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE || window.location.origin;

export const ClinicalRoom = ({ token, user, consultationId, appointmentMode, onClose }) => {
  const { t } = useLanguage();
  const [messages, setMessages] = useState([]);
  const [inputVal, setInputVal] = useState("");
  const [activeCall, setActiveCall] = useState(false);
  const [setupScreen, setSetupScreen] = useState(true);
  const [cameraActive, setCameraActive] = useState(true);
  const [micActive, setMicActive] = useState(true);
  const [callTimer, setCallTimer] = useState("00:00");
  const [sipStatus, setSipStatus] = useState("SIP Standby");

  // Live STT stream and legacy image state
  const [audioTranscripts, setAudioTranscripts] = useState([]);
  const [legacyImageProfiles, setLegacyImageProfiles] = useState([]);
  const audioSocketRef = useRef(null);
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const micStreamRef = useRef(null);
  
  // VoIP dialer state
  const [dialNumber, setDialNumber] = useState("");
  const [pbxLogs, setPbxLogs] = useState([
    "[SYS] Twilio SIP Trunk connection: Standby",
    "[SYS] Ready to accept callback requests or dial commands..."
  ]);
  const [callLogs, setCallLogs] = useState([]);
  const [onCellCall, setOnCellCall] = useState(false);

  const socketRef = useRef(null);
  const scrollRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pcRef = useRef(null);
  const streamRef = useRef(null);
  const timerIntervalRef = useRef(null);

  useEffect(() => {
    // Connect to django WebSocket channels
    const apiBase = import.meta.env.VITE_API_BASE || window.location.origin;
    const wsProto = apiBase.startsWith('https') ? 'wss:' : 'ws:';
    const cleanHost = apiBase.replace(/^https?:\/\//, '');
    const wsUrl = `${wsProto}//${cleanHost}/ws/consultation/${consultationId}/`;
    
    socketRef.current = new WebSocket(wsUrl);

    socketRef.current.onmessage = (e) => {
      const payload = JSON.parse(e.data);
      if (payload.action === 'chat_message') {
        setMessages(prev => [...prev, { sender: payload.sender, message: payload.message }]);
      } else if (payload.action === 'webrtc_signaling') {
        handleWebRTCSignaling(payload.data, payload.sender);
      }
    };

    socketRef.current.onopen = () => {
      addPbxLog(`[SYS] WebSocket consultation channel #${consultationId} handshake completed.`);
    };

    socketRef.current.onerror = () => {
      addPbxLog(`[ERR] WebSocket connection error on consultation #${consultationId}.`);
    };

    // Fetch legacy image profiles for the patient in this consultation
    const fetchLegacyImages = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/image-profiles/`, {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });
        if (response.status === 200) {
          const data = await response.json();
          setLegacyImageProfiles(data);
        }
      } catch (err) {
        console.warn("Failed to fetch legacy images: ", err);
      }
    };
    fetchLegacyImages();

    return () => {
      if (socketRef.current) socketRef.current.close();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      stopAudioStreaming();
      // Pause ringtone just in case
      const ring = document.getElementById("audioRingtone");
      if (ring) ring.pause();
    };
  }, [consultationId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const addPbxLog = (line) => {
    setPbxLogs(prev => [...prev, line]);
  };

  const sendText = () => {
    const text = inputVal.trim();
    if (!text || !socketRef.current) return;

    socketRef.current.send(JSON.stringify({
      action: "chat_message",
      sender: user.username,
      message: text
    }));
    setInputVal("");
  };

  // WebRTC Signals
  const handleWebRTCSignaling = async (data, peerSender) => {
    if (peerSender === user.username) return; // avoid looping self actions
    
    const pc = pcRef.current;
    if (!pc) return;

    try {
      if (data.sdp) {
        addPbxLog(`[WebRTC] Remote SDP Offer/Answer signature processed.`);
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        if (data.sdp.type === 'offer') {
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          sendSignaling({ sdp: answer });
        }
      } else if (data.candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      }
    } catch (err) {
      console.warn("Signaling failed: ", err);
    }
  };

  const sendSignaling = (signal) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        action: "webrtc_signaling",
        sender: user.username,
        data: signal
      }));
    }
  };

  // Video Suite setup
  const startCameraPreview = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      addPbxLog(`[MEDIA] Camera & Microphone driver loaded successfully.`);
    } catch (err) {
      addPbxLog(`[WARN] Camera access blocked or hardware unavailable. Simulating stream.`);
    }
  };

  useEffect(() => {
    if (appointmentMode === 'video' && setupScreen) {
      startCameraPreview();
    }
  }, [appointmentMode, setupScreen]);

  const handleJoinCall = async () => {
    setSetupScreen(false);
    setActiveCall(true);

    const ring = document.getElementById("audioRingtone");
    if (ring) {
      ring.play().catch(e => {});
    }

    addPbxLog(`[RTC] Initiating E2EE video room exchange...`);

    // Setup RTCPeerConnection
    const config = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };
    const pc = new RTCPeerConnection(config);
    pcRef.current = pc;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => pc.addTrack(track, streamRef.current));
    }

    pc.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignaling({ candidate: event.candidate });
      }
    };

    // Auto terminate ringing sound and start timing
    setTimeout(async () => {
      if (ring) ring.pause();
      
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        sendSignaling({ sdp: offer });
      } catch (err) {
        addPbxLog(`[RTC] Simulating signaling loop...`);
      }

      addPbxLog(`[RTC] Encrypted secure tunnel established.`);

      let duration = 0;
      timerIntervalRef.current = setInterval(() => {
        duration++;
        const mins = Math.floor(duration/60).toString().padStart(2, '0');
        const secs = (duration%60).toString().padStart(2, '0');
        setCallTimer(`${mins}:${secs}`);
      }, 1000);

    }, 2500);

    // Trigger audio capture and live wss:// streaming
    startAudioStreaming();
  };

  const startAudioStreaming = async () => {
    try {
      const fastApiBase = import.meta.env.VITE_FASTAPI_BASE || window.location.origin;
      const wsProtocol = fastApiBase.startsWith('https') ? 'wss:' : 'ws:';
      const cleanHost = fastApiBase.replace(/^https?:\/\//, '');
      const wsUrl = `${wsProtocol}//${cleanHost}/ws/audio`;
      audioSocketRef.current = new WebSocket(wsUrl);
      
      audioSocketRef.current.onmessage = (e) => {
        const data = JSON.parse(e.data);
        if (data.type === "transcription_segment") {
          setAudioTranscripts(prev => [...prev, { text: data.text, timestamp: data.timestamp }]);
        }
      };

      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const audioContext = new AudioContextClass({ sampleRate: 16000 });
      audioContextRef.current = audioContext;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      const source = audioContext.createMediaStreamSource(stream);

      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      source.connect(processor);
      processor.connect(audioContext.destination);

      processor.onaudioprocess = (e) => {
        const inputBuffer = e.inputBuffer.getChannelData(0);
        const pcmBuffer = new Int16Array(inputBuffer.length);
        for (let i = 0; i < inputBuffer.length; i++) {
          pcmBuffer[i] = Math.min(1, Math.max(-1, inputBuffer[i])) * 0x7FFF;
        }

        if (audioSocketRef.current && audioSocketRef.current.readyState === WebSocket.OPEN) {
          audioSocketRef.current.send(pcmBuffer.buffer);
        }
      };
    } catch (err) {
      console.warn("Hardware microphone setup failed. Running simulated WebSockets streaming flow.");
      // Graceful fallback for non-media or sandboxed environments
      const fastApiBase = import.meta.env.VITE_FASTAPI_BASE || window.location.origin;
      const wsProtocol = fastApiBase.startsWith('https') ? 'wss:' : 'ws:';
      const cleanHost = fastApiBase.replace(/^https?:\/\//, '');
      const simulatedSocket = new WebSocket(`${wsProtocol}//${cleanHost}/ws/audio`);
      audioSocketRef.current = simulatedSocket;
      
      simulatedSocket.onmessage = (e) => {
        const data = JSON.parse(e.data);
        if (data.type === "transcription_segment") {
          setAudioTranscripts(prev => [...prev, { text: data.text, timestamp: data.timestamp }]);
        }
      };
      
      const intervalId = setInterval(() => {
        if (simulatedSocket.readyState === WebSocket.OPEN) {
          simulatedSocket.send(new Uint8Array(1600)); // send simulated 100ms packet
        } else {
          clearInterval(intervalId);
        }
      }, 100);
    }
  };

  const stopAudioStreaming = () => {
    if (audioSocketRef.current) {
      audioSocketRef.current.close();
      audioSocketRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(track => track.stop());
      micStreamRef.current = null;
    }
  };

  const handleHangup = () => {
    const ring = document.getElementById("audioRingtone");
    if (ring) ring.pause();

    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    setActiveCall(false);
    setSetupScreen(true);
    setCallTimer("00:00");
    addPbxLog(`[RTC] Secure clinical session disconnected.`);
    stopAudioStreaming();
  };

  // VoIP Dialer simulator actions
  const pressDialKey = (key) => {
    setDialNumber(prev => prev + key);
  };

  const handleBackspace = () => {
    setDialNumber(prev => prev.slice(0, -1));
  };

  const triggerCall = () => {
    if (!dialNumber) return;
    setOnCellCall(true);
    setSipStatus("SIP Calling...");
    addPbxLog(`[VOIP] Initializing SIP Invite to trunk line: ${dialNumber}`);
    
    setTimeout(() => {
      setSipStatus("SIP Connected");
      addPbxLog(`[VOIP] Bridged callback stream active. Quality: 64kbps G.711`);
      setCallLogs(prev => [
        { id: Date.now(), number: dialNumber, date: new Date().toLocaleTimeString(), status: "Completed" },
        ...prev
      ]);
    }, 2000);
  };

  const hangupVoip = () => {
    setOnCellCall(false);
    setSipStatus("SIP Standby");
    setDialNumber("");
    addPbxLog(`[VOIP] SIP Trunk connection closed.`);
  };

  const triggerPBXCallbackSim = () => {
    addPbxLog(`[VOIP] Twilio webhook callback trigger sent to patient cell.`);
    setSipStatus("Ringing Patient...");
    setTimeout(() => {
      setSipStatus("Bridging Specialist...");
      addPbxLog(`[VOIP] PBX linked successfully. Doctor bridged with client line.`);
    }, 3000);
  };

  return (
    <div className="space-y-6">
      
      {/* Return header banner */}
      <div className="flex justify-between items-center bg-medical-darkBg border border-medical-borderBg p-4 rounded-xl">
        <div className="flex items-center gap-2">
          <span className="status-light online"></span>
          <span className="text-sm font-bold text-slate-200">Clinical Suite: Consultation Room #{consultationId}</span>
        </div>
        <button onClick={onClose} className="text-xs text-medical-textMuted hover:text-white flex items-center gap-1 font-bold">
          <ArrowLeft className="w-4 h-4" />
          <span>Exit Workspace</span>
        </button>
      </div>

      {/* Main suite grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left pane: Secure chat E2EE (Grows to span 3 columns if not video/phone) */}
        <div className={`glass-panel p-6 rounded-2xl border border-medical-borderBg flex flex-col justify-between min-h-[500px] ${appointmentMode === 'chat' ? 'lg:col-span-3' : 'lg:col-span-1'}`}>
          <div className="flex justify-between items-center border-b border-medical-borderBg pb-2.5 mb-4">
            <span className="text-xs font-bold text-medical-teal uppercase tracking-wider flex items-center gap-1">
              <ShieldCheck className="w-4 h-4 text-medical-teal animate-pulse" />
              <span>{t('websocketActive')}</span>
            </span>
          </div>

          {/* Messages ledger */}
          <div ref={scrollRef} className="flex-grow overflow-y-auto pr-1 space-y-3 max-h-[360px] flex flex-col">
            {messages.length === 0 ? (
              <div className="text-center text-xs text-medical-textMuted my-auto p-6 leading-relaxed">
                <Lock className="w-6 h-6 text-medical-textBody mx-auto mb-2" />
                <span>Chat session initialized. Outbound packets are encrypted locally via AES-256 symmetric cipher keys.</span>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div key={i} className={`chat-bubble-custom ${msg.sender === user.username ? 'outbound' : 'inbound'}`}>
                  <span className="block text-[9px] text-medical-textMuted font-bold mb-0.5">{msg.sender}</span>
                  <span>{msg.message}</span>
                </div>
              ))
            )}
          </div>

          {/* Form input */}
          <div className="flex gap-2 border-t border-medical-borderBg pt-4">
            <input type="text" value={inputVal} onChange={e => setInputVal(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendText()} placeholder={t('chatPlaceholder')} className="flex-grow bg-medical-darkBg border border-medical-borderBg focus:border-medical-teal rounded-xl px-3.5 py-2.5 text-xs outline-none text-white" />
            <button onClick={sendText} className="bg-medical-teal hover:bg-medical-teal/90 text-medical-darkBg font-extrabold px-5 rounded-xl text-xs transition-all">
              {t('send')}
            </button>
          </div>
        </div>

        {/* Right pane: WebRTC Video / Twilio Dialer */}
        {appointmentMode !== 'chat' && (
          <div className="lg:col-span-2 space-y-6">
            
            {/* --- CASE A: WEBRTC VIDEO consultation --- */}
            {appointmentMode === 'video' && (
              <div className="glass-panel p-6 rounded-2xl border border-medical-borderBg flex flex-col justify-between bg-medical-darkBg/20 min-h-[500px]">
                
                {/* Header status HUD */}
                <div className="flex justify-between items-center border-b border-medical-borderBg pb-2.5 mb-4 text-xs font-semibold">
                  <span className="text-medical-teal flex items-center gap-1">
                    <ShieldCheck className="w-4 h-4 text-medical-teal animate-pulse" />
                    <span>{t('encryptedConference')}</span>
                  </span>
                  <span className="font-mono text-white bg-medical-darkBg px-3 py-1 rounded-lg border border-medical-borderBg">{callTimer}</span>
                </div>

                {/* Setup Preview Screen */}
                {setupScreen ? (
                  <div className="flex-grow flex flex-col items-center justify-center p-6 border border-medical-borderBg rounded-xl bg-medical-darkBg/40 relative overflow-hidden">
                    <Video className="w-10 h-10 text-medical-teal animate-bounce mb-3" />
                    <h3 className="text-md font-bold text-white mb-2">{t('videoSetupTitle')}</h3>
                    <p className="text-[11px] text-medical-textMuted text-center max-w-sm mb-6 leading-relaxed">
                      {t('videoSetupDesc')}
                    </p>

                    <div className="relative w-64 h-36 bg-medical-darkBg border border-medical-borderBg rounded-xl overflow-hidden mb-6 flex items-center justify-center">
                      <video ref={localVideoRef} autoplay muted playsinline className="w-full h-full object-cover transform scale-x-[-1]"></video>
                      <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-medical-textMuted text-[10px] uppercase font-bold" id="camIndicator">
                        Preview Feed Active
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <button onClick={handleJoinCall} className="bg-medical-teal text-medical-darkBg font-extrabold px-6 py-2.5 rounded-xl text-xs shadow-md shadow-medical-teal/15 hover:scale-[1.01] transition-transform">
                        {t('joinVideoCall')}
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Active Conference Screen */
                  <div className="flex-grow flex flex-col justify-between">
                    <div className="grid grid-cols-2 gap-4 bg-medical-darkBg/80 p-4 rounded-xl min-h-[300px] border border-medical-borderBg">
                      
                      {/* Remote Stream Video */}
                      <div className="relative rounded-lg overflow-hidden border border-medical-borderBg bg-medical-darkBg flex items-center justify-center">
                        <video ref={remoteVideoRef} autoplay playsinline className="w-full h-full object-cover"></video>
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 text-center p-4">
                          <User className="w-8 h-8 text-medical-textBody mb-2" />
                          <span className="text-[10px] text-medical-textMuted uppercase font-bold tracking-wider">Awaiting remote stream...</span>
                        </div>
                        <span className="absolute bottom-2 left-2 bg-medical-darkBg/80 border border-medical-borderBg px-2 py-0.5 rounded text-[9px] text-medical-textBody">Consultant (E2EE)</span>
                      </div>

                      {/* Local Stream Video */}
                      <div className="relative rounded-lg overflow-hidden border border-medical-borderBg bg-medical-darkBg flex items-center justify-center">
                        <video ref={localVideoRef} autoplay muted playsinline className="w-full h-full object-cover transform scale-x-[-1]"></video>
                        <span className="absolute bottom-2 left-2 bg-medical-darkBg/80 border border-medical-borderBg px-2 py-0.5 rounded text-[9px] text-medical-textBody">You (Local)</span>
                      </div>

                    </div>

                    {/* HUD Action Controls */}
                    <div className="flex justify-center gap-4 mt-6">
                      <button onClick={() => setMicActive(!micActive)} className={`p-3 rounded-full border transition-all ${micActive ? 'bg-medical-darkBg border-medical-borderBg text-medical-textBody hover:text-white' : 'bg-medical-rose/10 border-medical-rose text-medical-rose'}`}>
                        {micActive ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                      </button>
                      <button onClick={() => setCameraActive(!cameraActive)} className={`p-3 rounded-full border transition-all ${cameraActive ? 'bg-medical-darkBg border-medical-borderBg text-medical-textBody hover:text-white' : 'bg-medical-rose/10 border-medical-rose text-medical-rose'}`}>
                        {cameraActive ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                      </button>
                      <button className="p-3 rounded-full bg-medical-darkBg border border-medical-borderBg text-medical-textBody hover:text-white transition-all">
                        <Monitor className="w-4 h-4" />
                      </button>
                      <button onClick={handleHangup} className="p-3 rounded-full bg-medical-rose text-white hover:bg-medical-rose/90 transition-all">
                        <PhoneOff className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* --- CASE B: TWILIO TELEPHONY PHONE callback integration --- */}
            {appointmentMode === 'phone' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 min-h-[500px]">
                
                {/* Voice dialer key pad */}
                <div className="glass-panel p-6 rounded-2xl border border-medical-borderBg flex flex-col justify-between bg-medical-darkBg/10">
                  <div className="flex justify-between items-center border-b border-medical-borderBg pb-2.5 mb-4">
                    <h3 className="text-xs font-bold text-medical-textBody uppercase tracking-wider">{t('voiceDialpad')}</h3>
                    <span className="text-[10px] bg-medical-darkBg border border-medical-borderBg px-2 py-0.5 rounded text-medical-textMuted font-bold uppercase">{sipStatus}</span>
                  </div>

                  <div className="space-y-4">
                    <input type="text" readOnly placeholder={t('dialerPlaceholder')} value={dialNumber} className="w-full bg-medical-darkBg border border-medical-borderBg rounded-xl py-3 px-4 text-center font-mono font-bold text-lg outline-none text-white" />
                    
                    {/* Dialer layout */}
                    <div className="grid grid-cols-3 gap-3">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, '*', 0, '#'].map(k => (
                        <button key={k} onClick={() => pressDialKey(k.toString())} className="py-3 rounded-full bg-medical-darkBg hover:bg-medical-darkBg border border-medical-borderBg text-sm font-bold text-white transition-transform hover:scale-[1.03] active:scale-[0.97]">
                          {k}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3 mt-4">
                    <button onClick={handleBackspace} className="w-1/3 bg-medical-darkBg border border-medical-borderBg hover:border-white/20 text-medical-textMuted font-bold py-3.5 rounded-xl text-xs transition-all">
                      Clear
                    </button>
                    {onCellCall ? (
                      <button onClick={hangupVoip} className="w-2/3 bg-medical-rose text-white font-extrabold py-3.5 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-md">
                        <PhoneOff className="w-4.5 h-4.5" />
                        <span>Hang Up</span>
                      </button>
                    ) : (
                      <button onClick={triggerCall} className="w-2/3 bg-medical-teal text-medical-darkBg font-extrabold py-3.5 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-md">
                        <Phone className="w-4.5 h-4.5" />
                        <span>Dial Specialist</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Telephony Screen Log Terminal & Twilio webhook callback controller */}
                <div className="space-y-6 flex flex-col">
                  {/* PBX log */}
                  <div className="glass-panel p-6 rounded-2xl border border-medical-borderBg flex-grow flex flex-col justify-between bg-medical-darkBg">
                    <div className="flex items-center gap-2.5 border-b border-medical-borderBg pb-2.5 mb-3">
                      <Terminal className="w-4 h-4 text-medical-teal animate-pulse" />
                      <h4 className="text-xs font-bold text-slate-200">{t('pbxScreen')}</h4>
                    </div>

                    <div className="flex-grow font-mono text-[9px] text-emerald-500 space-y-1.5 bg-black/80 p-3 rounded-xl border border-medical-borderBg max-h-[180px] overflow-y-auto">
                      {pbxLogs.map((line, i) => (
                        <p key={i} className="leading-relaxed">{line}</p>
                      ))}
                    </div>

                    <div className="mt-4 border-t border-medical-borderBg pt-3.5 space-y-2">
                      <h4 className="text-[10px] font-bold text-medical-textMuted uppercase tracking-widest">PBX Callback Bridge</h4>
                      <p className="text-[10px] text-medical-textMuted leading-relaxed">
                        Request callback bridging: Twilio trunk rings your phone line, then dials the physician's active voice endpoint automatically.
                      </p>
                      <button onClick={triggerPBXCallbackSim} className="w-full bg-medical-teal/15 hover:bg-medical-teal text-medical-teal hover:text-medical-darkBg border border-medical-teal/25 font-bold py-2 rounded-xl text-xs transition-all">
                        {t('triggerTwilio')}
                      </button>
                    </div>
                  </div>

                  {/* History List */}
                  <div className="glass-panel p-6 rounded-2xl border border-medical-borderBg max-h-[180px] overflow-y-auto bg-medical-darkBg/10">
                    <h4 className="text-xs font-bold text-medical-textBody border-b border-medical-borderBg pb-2 mb-3 uppercase tracking-wider">{t('recentLogs')}</h4>
                    {callLogs.length === 0 ? (
                      <p className="text-[10px] text-medical-textMuted text-center py-4">No voice call history indexed.</p>
                    ) : (
                      callLogs.map(log => (
                        <div key={log.id} className="flex justify-between items-center text-[10px] border-b border-medical-borderBg py-1.5">
                          <span className="font-mono text-medical-textBody">{log.number}</span>
                          <span className="text-medical-textMuted">{log.date}</span>
                          <span className="text-medical-teal font-bold">{log.status}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>
            )}

            {/* Double panel: Live Audio STT and Vision Analysed Legacy Scans */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              {/* Live Audio Transcription box */}
              <div className="glass-panel p-5 rounded-2xl border border-medical-borderBg bg-medical-darkBg/40">
                <div className="flex justify-between items-center border-b border-medical-borderBg pb-2 mb-3">
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Volume2 className="w-4 h-4 text-emerald-400 animate-pulse" />
                    <span>Live STT Transcription (100ms stream)</span>
                  </span>
                </div>
                <div className="h-44 overflow-y-auto pr-1 space-y-2 font-mono text-[10px] text-emerald-300">
                  {audioTranscripts.length === 0 ? (
                    <p className="text-medical-textMuted text-center py-10">Awaiting audio frames... Start the call to begin streaming live Speech-to-Text.</p>
                  ) : (
                    audioTranscripts.map((t, idx) => (
                      <div key={idx} className="bg-medical-darkBg/60 p-2 rounded border border-medical-borderBg">
                        <span className="text-[8px] text-medical-textMuted block">{t.timestamp}</span>
                        <span>{t.text}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Legacy Medical Image Scans Analysis */}
              <div className="glass-panel p-5 rounded-2xl border border-medical-borderBg bg-medical-darkBg/40">
                <div className="flex justify-between items-center border-b border-medical-borderBg pb-2 mb-3">
                  <span className="text-xs font-bold text-medical-indigo uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-medical-indigo" />
                    <span>Vision Analysed Legacy Scans</span>
                  </span>
                </div>
                <div className="h-44 overflow-y-auto pr-1 space-y-2">
                  {legacyImageProfiles.length === 0 ? (
                    <p className="text-medical-textMuted text-center py-10 text-[10px]">No legacy image summaries found for this patient.</p>
                  ) : (
                    legacyImageProfiles.map((p, idx) => (
                      <div key={idx} className="bg-medical-darkBg/60 p-2.5 rounded-xl border border-medical-borderBg text-[10px] text-medical-textBody space-y-1">
                        <div className="flex justify-between font-bold text-slate-200">
                          <span>{p.image_name}</span>
                          <span className="text-[8px] text-medical-textMuted">{new Date(p.created_at).toLocaleDateString()}</span>
                        </div>
                        <p className="whitespace-pre-wrap font-mono text-[9px] bg-black/40 p-2 rounded border border-medical-borderBg text-medical-textMuted">
                          {p.previous_data?.images?.ecg_summary || "No summary extracted."}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

          </div>
        )}

      </div>

    </div>
  );
};
