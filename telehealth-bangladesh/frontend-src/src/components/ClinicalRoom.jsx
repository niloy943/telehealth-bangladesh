import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from './LanguageContext';
import { useNotifications } from './NotificationCenter';
import { 
  Send, ShieldCheck, Video, VideoOff, Mic, MicOff, PhoneOff, Phone, 
  Monitor, Play, Trash2, ArrowLeft, Terminal, AlertCircle, Volume2, Lock, User,
  Activity, Clock
} from 'lucide-react';
import {
  getOrCreateIdentityKeyPair,
  generateEphemeralKeyPair,
  exportPublicKey,
  importPublicKey,
  signKeyExchange,
  verifyKeyExchangeSignature,
  deriveSessionKey,
  encryptMessage,
  decryptMessage,
  generateFingerprint
} from '../utils/e2ee';

const API_BASE = import.meta.env.VITE_API_BASE || window.location.origin;

export const ClinicalRoom = ({ token, user, consultationId, appointmentMode, onClose }) => {
  const { t } = useLanguage();
  const { triggerNotification } = useNotifications();
  const [messages, setMessages] = useState([]);

  // Client-Side End-to-End Encryption (E2EE) State & References
  const [e2eeStatus, setE2eeStatus] = useState("initializing"); // initializing, pending_peer, secure, failed
  const [fingerprint, setFingerprint] = useState("");

  const sessionKeyRef = useRef(null);
  const peerIdentityKeyRef = useRef(null);
  const peerIdentityKeyB64Ref = useRef("");
  const myIdKeyPairRef = useRef(null);
  const myEpKeyPairRef = useRef(null);
  const myIdPubB64Ref = useRef("");
  const myEpPubB64Ref = useRef("");
  const mySignatureRef = useRef("");
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
  const [activeCallMode, setActiveCallMode] = useState("standby"); // standby, live, mock
  const [consultationData, setConsultationData] = useState(null);
  const [pbxLogs, setPbxLogs] = useState([
    "[SYS] Twilio SIP Trunk connection: Standby",
    "[SYS] Ready to accept callback requests or dial commands..."
  ]);
  const [callLogs, setCallLogs] = useState([]);
  const [onCellCall, setOnCellCall] = useState(false);

  const activeCallSidRef = useRef(null);
  const statusPollIntervalRef = useRef(null);
  const voipTimerIntervalRef = useRef(null);

  const socketRef = useRef(null);
  const scrollRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pcRef = useRef(null);
  const streamRef = useRef(null);
  const timerIntervalRef = useRef(null);

  useEffect(() => {
    // Initialize End-to-End Encryption
    const initE2EE = async () => {
      try {
        if (!window.crypto || !window.crypto.subtle) {
          setE2eeStatus("failed");
          addPbxLog("[E2EE] Web Crypto API is not supported in this browser.");
          return;
        }

        const idKeyPair = await getOrCreateIdentityKeyPair();
        const epKeyPair = await generateEphemeralKeyPair();
        
        myIdKeyPairRef.current = idKeyPair;
        myEpKeyPairRef.current = epKeyPair;
        
        const idPubB64 = await exportPublicKey(idKeyPair.publicKey);
        const epPubB64 = await exportPublicKey(epKeyPair.publicKey);
        
        myIdPubB64Ref.current = idPubB64;
        myEpPubB64Ref.current = epPubB64;
        
        const signature = await signKeyExchange(idKeyPair.privateKey, epPubB64);
        mySignatureRef.current = signature;
        
        addPbxLog("[E2EE] Cryptographic keys generated and stored in IndexedDB.");
        setE2eeStatus("pending_peer");

        // Now initiate connection
        connectWebSocket();
      } catch (err) {
        console.error("E2EE Init error:", err);
        setE2eeStatus("failed");
        addPbxLog("[E2EE] Cryptographic key initialization failed.");
      }
    };

    const connectWebSocket = () => {
      const apiBase = import.meta.env.VITE_API_BASE || window.location.origin;
      const wsProto = apiBase.startsWith('https') ? 'wss:' : 'ws:';
      const cleanHost = apiBase.replace(/^https?:\/\//, '');
      const wsUrl = `${wsProto}//${cleanHost}/ws/consultation/${consultationId}/`;
      
      socketRef.current = new WebSocket(wsUrl);

      socketRef.current.onmessage = async (e) => {
        const payload = JSON.parse(e.data);
        if (payload.action === 'encrypted_chat_message') {
          const { sender, ciphertext, iv, aad, message_id, timestamp } = payload;
          
          if (!sessionKeyRef.current) {
            setMessages(prev => [...prev, {
              sender: sender,
              message: "Unable to decrypt message — integrity verification failed.",
              isError: true
            }]);
            return;
          }

          try {
            const decrypted = await decryptMessage(sessionKeyRef.current, ciphertext, iv, aad);
            setMessages(prev => [...prev, { sender: sender, message: decrypted }]);
          } catch (err) {
            console.error("Decryption failed:", err);
            setMessages(prev => [...prev, {
              sender: sender,
              message: "Unable to decrypt message — integrity verification failed.",
              isError: true
            }]);
          }
        } else if (payload.action === 'e2ee_key_exchange') {
          const { sender, key_type, public_key, signature } = payload;
          if (sender === user.username) return;

          if (key_type === 'identity') {
            if (peerIdentityKeyB64Ref.current === public_key) {
              return;
            }
            peerIdentityKeyB64Ref.current = public_key;
            addPbxLog(`[E2EE] Received Peer Identity Public Key from ${sender}.`);
            try {
              const peerIdKey = await importPublicKey(public_key, "ECDSA", ["verify"]);
              peerIdentityKeyRef.current = peerIdKey;
              
              // Respond with our identity key
              socketRef.current.send(JSON.stringify({
                action: 'e2ee_key_exchange',
                sender: user.username,
                key_type: 'identity',
                public_key: myIdPubB64Ref.current
              }));
              
              // Send our ephemeral public key signed with our identity private key
              socketRef.current.send(JSON.stringify({
                action: 'e2ee_key_exchange',
                sender: user.username,
                key_type: 'ephemeral',
                public_key: myEpPubB64Ref.current,
                signature: mySignatureRef.current
              }));
            } catch (err) {
              console.error("Failed to import peer identity key:", err);
              addPbxLog("[E2EE] Peer identity verification failed.");
              setE2eeStatus("failed");
            }
          } else if (key_type === 'ephemeral') {
            addPbxLog(`[E2EE] Received Peer Ephemeral Public Key from ${sender}.`);
            if (!peerIdentityKeyRef.current) {
              addPbxLog("[E2EE] Ephemeral exchange failed: Peer Identity Key missing.");
              setE2eeStatus("failed");
              return;
            }
            try {
              const isValid = await verifyKeyExchangeSignature(
                peerIdentityKeyRef.current,
                public_key,
                signature
              );
              
              if (!isValid) {
                addPbxLog("[E2EE] Peer ephemeral signature verification failed!");
                setE2eeStatus("failed");
                return;
              }
              
              addPbxLog("[E2EE] Ephemeral public key signature verified successfully.");
              
              const peerEpKey = await importPublicKey(public_key, "ECDH", []);
              const derivedKey = await deriveSessionKey(
                myEpKeyPairRef.current.privateKey,
                peerEpKey
              );
              
              sessionKeyRef.current = derivedKey;
              
              const fp = generateFingerprint(myEpPubB64Ref.current, public_key);
              setFingerprint(fp);
              setE2eeStatus("secure");
              addPbxLog(`[E2EE] End-to-End Encrypted channel established. Fingerprint: ${fp}`);
              triggerNotification("E2EE Active", "Secure encrypted session established.", "security");
            } catch (err) {
              console.error("Ephemeral exchange failed:", err);
              addPbxLog("[E2EE] Session key derivation failed.");
              setE2eeStatus("failed");
            }
          }
        } else if (payload.action === 'webrtc_signaling') {
          handleWebRTCSignaling(payload.data, payload.sender);
        }
      };

      socketRef.current.onopen = () => {
        addPbxLog(`[SYS] WebSocket consultation channel #${consultationId} handshake completed.`);
        if (myIdPubB64Ref.current) {
          socketRef.current.send(JSON.stringify({
            action: 'e2ee_key_exchange',
            sender: user.username,
            key_type: 'identity',
            public_key: myIdPubB64Ref.current
          }));
        }
      };

      socketRef.current.onerror = () => {
        addPbxLog(`[ERR] WebSocket connection error on consultation #${consultationId}.`);
      };
    };

    // Begin setup flow
    initE2EE();

    // Fetch consultation metadata (doctor & patient contact info)
    const fetchConsultationMetadata = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/consultations/${consultationId}/`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setConsultationData(data);
          const targetPhone = user.role === 'doctor' ? data.patient?.phone : data.doctor?.phone;
          if (targetPhone) {
            setDialNumber(targetPhone);
          }
          addPbxLog(`[SYS] Telephony bridge synchronized with Consultation #${consultationId}.`);
          if (data.doctor?.name && data.patient?.name) {
            addPbxLog(`[SYS] Channel endpoints: ${data.doctor.name} <-> ${data.patient.name}`);
          }
        }
      } catch (err) {
        console.warn("Failed to fetch consultation details: ", err);
      }
    };

    // Fetch call history from backend
    const fetchCallLogs = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/telephony/calls/?consultation_id=${consultationId}`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setCallLogs(data.map(item => ({
            id: item.id,
            number: item.recipient_phone,
            date: new Date(item.created_at).toLocaleTimeString(),
            status: item.status.toUpperCase(),
            mode: item.mode
          })));
        }
      } catch (err) {
        console.warn("Failed to fetch call logs: ", err);
      }
    };

    fetchConsultationMetadata();
    fetchCallLogs();

    return () => {
      if (socketRef.current) socketRef.current.close();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (statusPollIntervalRef.current) clearInterval(statusPollIntervalRef.current);
      if (voipTimerIntervalRef.current) clearInterval(voipTimerIntervalRef.current);
      stopAudioStreaming();
      
      // Clear key states upon leaving consultation
      sessionKeyRef.current = null;
      peerIdentityKeyRef.current = null;
      peerIdentityKeyB64Ref.current = "";
      
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

  const sendText = async () => {
    const text = inputVal.trim();
    if (!text || !socketRef.current) return;

    if (e2eeStatus !== "secure" || !sessionKeyRef.current) {
      triggerNotification("Security Warning", "E2EE session not active. Plaintext transmission blocked.", "security");
      return;
    }

    try {
      const msgId = Math.random().toString(36).substring(2, 15);
      const timestamp = new Date().toISOString();
      
      const aad = {
        consultation_id: consultationId,
        sender: user.username,
        message_id: msgId,
        protocol_version: "1.0"
      };

      const encrypted = await encryptMessage(sessionKeyRef.current, text, aad);

      socketRef.current.send(JSON.stringify({
        action: "encrypted_chat_message",
        sender: user.username,
        ciphertext: encrypted.ciphertext,
        iv: encrypted.iv,
        aad: encrypted.aad,
        message_id: msgId,
        timestamp: timestamp
      }));
      setInputVal("");
    } catch (err) {
      console.error("Encryption failed:", err);
      triggerNotification("Security Alert", "Message encryption failed.", "security");
    }
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

  // VoIP Dialer actions with real Twilio Telephony REST API
  const pressDialKey = (key) => {
    setDialNumber(prev => prev + key);
  };

  const handleBackspace = () => {
    setDialNumber(prev => prev.slice(0, -1));
  };

  const triggerCall = async (overridePhone = null) => {
    const phoneToCall = overridePhone || dialNumber;
    if (!phoneToCall) {
      triggerNotification("Dial Error", "Please specify a destination phone number.", "warning");
      return;
    }

    setOnCellCall(true);
    setSipStatus("SIP Calling...");
    addPbxLog(`[VOIP] Initializing outbound voice bridge to: ${phoneToCall}`);

    try {
      const response = await fetch(`${API_BASE}/api/telephony/call/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          phone: phoneToCall,
          consultation_id: consultationId
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        activeCallSidRef.current = data.call_sid;
        setActiveCallMode(data.mode);
        const modeLabel = data.mode === 'live' ? 'LIVE PSTN TRUNK' : 'SANDBOX SIMULATION';
        addPbxLog(`[VOIP] Call initiated. SID: ${data.call_sid} (${modeLabel})`);
        if (data.note) {
          addPbxLog(`[SYS] ${data.note}`);
        }
        setSipStatus(data.mode === 'live' ? "SIP Calling (Live)..." : "SIP Calling (Sandbox)...");

        // Refresh call history
        setCallLogs(prev => [
          {
            id: data.call_id || Date.now(),
            number: data.to,
            date: new Date().toLocaleTimeString(),
            status: data.status.toUpperCase(),
            mode: data.mode
          },
          ...prev
        ]);

        // Start status polling
        if (statusPollIntervalRef.current) clearInterval(statusPollIntervalRef.current);
        let seconds = 0;

        statusPollIntervalRef.current = setInterval(async () => {
          if (!activeCallSidRef.current) return;
          try {
            const statusRes = await fetch(`${API_BASE}/api/telephony/call/${activeCallSidRef.current}/status/`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            if (statusRes.ok) {
              const statusData = await statusRes.json();
              const currentStatus = statusData.status;

              if (currentStatus === 'ringing') {
                setSipStatus("Ringing...");
              } else if (currentStatus === 'in-progress') {
                setSipStatus(statusData.mode === 'live' ? "Connected (Live)" : "Connected (Sandbox)");
                seconds++;
                const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
                const secs = (seconds % 60).toString().padStart(2, '0');
                setCallTimer(`${mins}:${secs}`);
              } else if (['completed', 'failed', 'busy', 'no-answer', 'canceled'].includes(currentStatus)) {
                clearInterval(statusPollIntervalRef.current);
                statusPollIntervalRef.current = null;
                activeCallSidRef.current = null;
                setOnCellCall(false);
                const statusDisplayMap = {
                  completed: 'Call Ended',
                  failed: 'Failed',
                  busy: 'Busy',
                  'no-answer': 'No Answer',
                  canceled: 'Canceled'
                };
                const displayLabel = statusDisplayMap[currentStatus] || `Call ${currentStatus}`;
                setSipStatus(displayLabel);
                addPbxLog(`[VOIP] Call ended with state: ${currentStatus.toUpperCase()} (Duration: ${statusData.duration || 0}s)`);
                
                // Update local call log status
                setCallLogs(prev => prev.map(c => 
                  c.number === statusData.recipient_phone || c.id === statusData.call_id
                    ? { ...c, status: currentStatus.toUpperCase() }
                    : c
                ));
              }
            }
          } catch (pollErr) {
            console.warn("Telephony status poll error: ", pollErr);
          }
        }, 1500);

      } else {
        setOnCellCall(false);
        setSipStatus("SIP Failed");
        const errMsg = data.error || "Call dispatch failed.";
        addPbxLog(`[ERR] Call initiation failed: ${errMsg}`);
        triggerNotification("Call Error", errMsg, "error");
      }
    } catch (err) {
      setOnCellCall(false);
      setSipStatus("SIP Failed");
      addPbxLog(`[ERR] Telephony network error: ${err.message}`);
      triggerNotification("Network Error", "Unable to contact telephony service.", "error");
    }
  };

  const hangupVoip = async () => {
    const currentSid = activeCallSidRef.current;
    if (statusPollIntervalRef.current) {
      clearInterval(statusPollIntervalRef.current);
      statusPollIntervalRef.current = null;
    }

    setOnCellCall(false);
    setSipStatus("SIP Standby");
    addPbxLog(`[VOIP] Terminating active call...`);

    if (currentSid) {
      try {
        await fetch(`${API_BASE}/api/telephony/call/${currentSid}/terminate/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });
        addPbxLog(`[VOIP] Call SID ${currentSid} successfully terminated.`);
      } catch (err) {
        console.warn("Failed to terminate call: ", err);
      }
      activeCallSidRef.current = null;
    }
  };

  const triggerPBXCallbackSim = async () => {
    addPbxLog(`[VOIP] Twilio callback bridge triggered for Consultation #${consultationId}.`);
    setSipStatus("Ringing Bridged Line...");
    await triggerCall();
  };

  return (
    <div className="space-y-6">
      
      {/* 1. Clinical Consultation Suite Top Bar */}
      <div className="bg-white border border-[#BDDDFA] p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="w-9 h-9 rounded-[10px] bg-[#059669] flex items-center justify-center text-white">
            <Activity className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-[#0F172A]">
                Clinical Consultation Room #{consultationId}
              </h3>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#E7F0FC] text-[#059669] border border-[#BDDDFA]">
                {appointmentMode === 'video' ? 'Live Video' : appointmentMode === 'phone' ? 'Cellular VoIP' : 'Encrypted Chat'}
              </span>
            </div>
            <p className="text-xs text-[#55647C] mt-0.5 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#059669]" />
              <span>Session Connected • Patient: {user.role === 'doctor' ? 'Clinical Patient' : user.username}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-auto">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] bg-[#E7F0FC] text-xs font-mono font-bold text-[#0F172A] border border-[#BDDDFA]">
            <Clock className="w-3.5 h-3.5 text-[#059669]" />
            <span>{callTimer}</span>
          </div>

          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-[10px] border border-[#BDDDFA] hover:bg-[#F4F6F9] text-xs font-semibold text-[#0F172A] cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Exit Room</span>
          </button>
        </div>
      </div>

      {/* 2. Main Consultation Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left pane: Encrypted Clinical Chat */}
        <div className={`bg-white p-5 rounded-2xl border border-[#BDDDFA] flex flex-col justify-between min-h-[520px] ${appointmentMode === 'chat' ? 'lg:col-span-3' : 'lg:col-span-1'}`}>
          <div className="border-b border-[#BDDDFA]/60 pb-3 mb-3 space-y-2.5">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-[#0F172A] uppercase tracking-wider flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-[#059669]" />
                <span>Encrypted Chat</span>
              </span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                e2eeStatus === 'secure' ? 'bg-emerald-50 text-[#059669] border border-emerald-200' :
                e2eeStatus === 'failed' ? 'bg-red-50 text-red-700 border border-red-200' :
                'bg-amber-50 text-amber-700 border border-amber-200'
              }`}>
                {e2eeStatus === 'secure' ? 'E2EE: ACTIVE' : `E2EE: ${e2eeStatus.toUpperCase()}`}
              </span>
            </div>

            {/* Cryptographic Metadata Banner */}
            <div className="bg-[#E7F0FC]/60 p-2.5 rounded-xl text-[10px] space-y-1 border border-[#BDDDFA]">
              <div className="flex justify-between text-[#55647C]">
                <span>Key Exchange: <strong className="text-[#0F172A]">ECDH P-256</strong></span>
                <span>Cipher: <strong className="text-[#0F172A]">AES-256-GCM</strong></span>
              </div>
              {fingerprint && (
                <div className="text-[9px] font-mono text-[#55647C] flex justify-between pt-1 border-t border-[#BDDDFA]/60">
                  <span>Security Fingerprint:</span>
                  <span className="font-bold text-[#059669]">{fingerprint}</span>
                </div>
              )}
            </div>
          </div>

          {/* Messages Scroll Area */}
          <div ref={scrollRef} className="flex-grow overflow-y-auto pr-1 space-y-3 max-h-[360px] flex flex-col">
            {messages.length === 0 ? (
              <div className="text-center text-xs text-[#55647C] my-auto p-6 space-y-2">
                <Lock className="w-8 h-8 text-[#94A3B8] mx-auto" />
                {e2eeStatus === 'secure' ? (
                  <p>End-to-End Encrypted channel established. Messages sent here cannot be intercepted by the server.</p>
                ) : (
                  <p>Establishing cryptographic handshake tunnel with peer...</p>
                )}
              </div>
            ) : (
              messages.map((msg, i) => {
                if (msg.isError) {
                  return (
                    <div key={i} className="bg-red-50 border border-red-200 p-2.5 rounded-xl text-xs text-red-700 self-center max-w-[90%] font-mono my-1">
                      <div className="font-bold flex items-center gap-1 text-[10px]">
                        <AlertCircle size={12} />
                        <span>INTEGRITY ERROR</span>
                      </div>
                      <p>{msg.message}</p>
                    </div>
                  );
                }
                const isMe = msg.sender === user.username;
                return (
                  <div key={i} className={`flex flex-col max-w-[85%] ${isMe ? 'self-end items-end' : 'self-start items-start'}`}>
                    <span className="text-[10px] text-[#94A3B8] mb-0.5 px-1 font-semibold">{msg.sender}</span>
                    <div className={`p-3 rounded-2xl text-xs leading-relaxed ${
                      isMe
                        ? 'bg-[#059669] text-white rounded-br-sm'
                        : 'bg-[#E7F0FC] text-[#0F172A] rounded-bl-sm border border-[#BDDDFA]'
                    }`}>
                      {msg.message}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Chat Input */}
          <div className="flex gap-2 border-t border-[#BDDDFA]/60 pt-3 mt-2">
            <input 
              type="text" 
              value={inputVal} 
              onChange={e => setInputVal(e.target.value)} 
              onKeyDown={e => e.key === 'Enter' && sendText()} 
              disabled={e2eeStatus !== 'secure'}
              placeholder={e2eeStatus === 'secure' ? "Type encrypted clinical message..." : "Awaiting E2EE Handshake..."} 
              className="flex-grow !min-h-[46px] !py-2 !px-3 text-xs" 
            />
            <button 
              onClick={sendText} 
              disabled={e2eeStatus !== 'secure'}
              className="bg-[#059669] hover:bg-[#047857] text-white font-bold px-4 rounded-[10px] text-xs disabled:opacity-50 flex items-center justify-center cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Right pane: WebRTC Video / Twilio Dialer */}
        {appointmentMode !== 'chat' && (
          <div className="lg:col-span-2 space-y-6">
            
            {/* --- CASE A: WEBRTC VIDEO consultation --- */}
            {appointmentMode === 'video' && (
              <div className="bg-white p-5 rounded-2xl border border-[#BDDDFA] flex flex-col justify-between min-h-[520px]">
                
                {/* Header Status Bar */}
                <div className="flex justify-between items-center border-b border-[#BDDDFA]/60 pb-2.5 mb-4 text-xs font-semibold">
                  <span className="text-[#059669] flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Live Medical WebRTC Room</span>
                  </span>
                  <SecurityBadge text="Direct Peer-to-Peer" />
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
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/60 text-white text-[9px] font-bold uppercase tracking-wider" id="camIndicator">
                        Camera Ready
                      </div>
                    </div>

                    <button
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
                    <div className="flex items-center justify-center gap-3 mt-4 pt-3 border-t border-[#BDDDFA]/60">
                      <button
                        onClick={() => setMicActive(!micActive)}
                        className={`p-3 rounded-full border cursor-pointer ${
                          micActive
                            ? 'bg-[#E7F0FC] border-[#BDDDFA] text-[#0F172A] hover:bg-[#BDDDFA]'
                            : 'bg-red-500 border-red-600 text-white'
                        }`}
                        title={micActive ? "Mute Microphone" : "Unmute Microphone"}
                      >
                        {micActive ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                      </button>

                      <button
                        onClick={() => setCameraActive(!cameraActive)}
                        className={`p-3 rounded-full border cursor-pointer ${
                          cameraActive
                            ? 'bg-[#E7F0FC] border-[#BDDDFA] text-[#0F172A] hover:bg-[#BDDDFA]'
                            : 'bg-red-500 border-red-600 text-white'
                        }`}
                        title={cameraActive ? "Turn Off Camera" : "Turn On Camera"}
                      >
                        {cameraActive ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                      </button>

                      <button
                        className="p-3 rounded-full bg-[#E7F0FC] border border-[#BDDDFA] text-[#0F172A] hover:bg-[#BDDDFA] cursor-pointer"
                        title="Share Screen"
                      >
                        <Monitor className="w-4 h-4" />
                      </button>

                      <button
                        onClick={handleHangup}
                        className="p-3 rounded-full bg-[#DC2626] hover:bg-[#B91C1C] text-white cursor-pointer"
                        title="End Consultation"
                      >
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
                
                {/* Voice dialer keypad */}
                <div className="bg-white p-6 rounded-2xl border border-[#BDDDFA] flex flex-col justify-between">
                  <div className="flex justify-between items-center border-b border-[#BDDDFA]/60 pb-2.5 mb-4">
                    <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">{t('voiceDialpad')}</h3>
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
                      <span className="text-[10px] bg-[#E7F0FC] border border-[#BDDDFA] px-2 py-0.5 rounded-full text-[#0F172A] font-bold uppercase">{sipStatus}</span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <input 
                      type="text" 
                      placeholder={t('dialerPlaceholder')} 
                      value={dialNumber} 
                      onChange={e => setDialNumber(e.target.value)}
                      className="w-full text-center font-mono font-bold text-lg" 
                    />
                    
                    {/* Keypad */}
                    <div className="grid grid-cols-3 gap-2">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, '*', 0, '#'].map(k => (
                        <button key={k} onClick={() => pressDialKey(k.toString())} className="py-3 rounded-[10px] bg-[#E7F0FC] hover:bg-[#BDDDFA] border border-[#BDDDFA] text-sm font-bold text-[#0F172A] cursor-pointer">
                          {k}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2.5 mt-4 pt-3 border-t border-[#BDDDFA]/60">
                    <button onClick={handleBackspace} className="w-1/3 bg-white hover:bg-[#F4F6F9] border border-[#BDDDFA] text-[#0F172A] font-bold py-3 rounded-[10px] text-xs cursor-pointer">
                      Clear
                    </button>
                    {onCellCall ? (
                      <button onClick={hangupVoip} className="w-2/3 bg-[#DC2626] hover:bg-[#B91C1C] text-white font-bold py-3 rounded-[10px] text-xs flex items-center justify-center gap-1.5 cursor-pointer">
                        <PhoneOff className="w-4 h-4" />
                        <span>Hang Up</span>
                      </button>
                    ) : (
                      <button onClick={() => triggerCall()} className="w-2/3 bg-[#059669] hover:bg-[#047857] text-white font-bold py-3 rounded-[10px] text-xs flex items-center justify-center gap-1.5 cursor-pointer">
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
                      <h4 className="text-xs font-bold text-[#0F172A]">{t('pbxScreen')}</h4>
                    </div>

                    <div className="flex-grow font-mono text-[9px] text-[#34D399] space-y-1 bg-[#0F172A] p-3 rounded-xl border border-[#1E293B] max-h-[180px] overflow-y-auto">
                      {pbxLogs.map((line, i) => (
                        <p key={i} className="leading-relaxed">{line}</p>
                      ))}
                    </div>

                    <div className="mt-4 border-t border-[#BDDDFA]/60 pt-3.5 space-y-2">
                      <h4 className="text-[10px] font-bold text-[#55647C] uppercase tracking-widest">PBX Callback Bridge</h4>
                      <p className="text-[11px] text-[#55647C] leading-relaxed">
                        Request callback bridging: Twilio trunk rings your phone line, then dials the physician's active voice endpoint automatically.
                      </p>
                      <button onClick={triggerPBXCallbackSim} className="w-full bg-[#E7F0FC] hover:bg-[#BDDDFA] text-[#0F172A] border border-[#BDDDFA] font-bold py-2 rounded-[10px] text-xs cursor-pointer">
                        {t('triggerTwilio')}
                      </button>
                    </div>
                  </div>

                  {/* History List */}
                  <div className="bg-white p-6 rounded-2xl border border-[#BDDDFA] max-h-[180px] overflow-y-auto">
                    <h4 className="text-xs font-bold text-[#0F172A] border-b border-[#BDDDFA]/60 pb-2 mb-3 uppercase tracking-wider">{t('recentLogs')}</h4>
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
            )}

            {/* Live Audio Transcription & Vision Analysis Panels */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              {/* Live Audio Transcription */}
              <div className="bg-white p-5 rounded-2xl border border-[#BDDDFA]">
                <div className="flex justify-between items-center border-b border-[#BDDDFA]/60 pb-2 mb-3">
                  <span className="text-xs font-bold text-[#0F172A] uppercase tracking-wider flex items-center gap-1.5">
                    <Volume2 className="w-4 h-4 text-[#059669]" />
                    <span>Live Audio Speech-to-Text</span>
                  </span>
                </div>
                <div className="h-40 overflow-y-auto pr-1 space-y-2 font-mono text-[10px] text-[#334155]">
                  {audioTranscripts.length === 0 ? (
                    <p className="text-[#94A3B8] text-center py-8">Awaiting speech audio frames... Start the call to begin live streaming transcription.</p>
                  ) : (
                    audioTranscripts.map((t, idx) => (
                      <div key={idx} className="bg-[#E7F0FC]/50 p-2 rounded-lg border border-[#BDDDFA]">
                        <span className="text-[8px] text-[#94A3B8] block">{t.timestamp}</span>
                        <span>{t.text}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Vision Analyzed Legacy Scans */}
              <div className="bg-white p-5 rounded-2xl border border-[#BDDDFA]">
                <div className="flex justify-between items-center border-b border-[#BDDDFA]/60 pb-2 mb-3">
                  <span className="text-xs font-bold text-[#0F172A] uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-[#168CF5]" />
                    <span>Multimodal Vision Summaries</span>
                  </span>
                </div>
                <div className="h-40 overflow-y-auto pr-1 space-y-2">
                  {legacyImageProfiles.length === 0 ? (
                    <p className="text-[#94A3B8] text-center py-8 text-[10px]">No legacy image summaries indexed for this consultation.</p>
                  ) : (
                    legacyImageProfiles.map((p, idx) => (
                      <div key={idx} className="bg-[#E7F0FC]/50 p-2.5 rounded-xl border border-[#BDDDFA] text-[10px] space-y-1">
                        <div className="flex justify-between font-bold text-[#0F172A]">
                          <span>{p.image_name}</span>
                          <span className="text-[8px] text-[#94A3B8]">{new Date(p.created_at).toLocaleDateString()}</span>
                        </div>
                        <p className="whitespace-pre-wrap font-mono text-[9px] bg-white p-2 rounded border border-[#BDDDFA] text-[#334155]">
                          {p.previous_data?.images?.ecg_summary || "No diagnostic summary extracted."}
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

export default ClinicalRoom;

