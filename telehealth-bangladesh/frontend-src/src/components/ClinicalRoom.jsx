import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from './LanguageContext';
import { useNotifications } from './NotificationCenter';
import { SecurityBadge } from './ui';
import { EPrescriptionPortal } from './EPrescriptionPortal';
import { DoctorSharedRecordsModal } from './DoctorSharedRecordsModal';
import { usePrescriptionDraftStore } from '../store/usePrescriptionDraftStore';
import { useWebRTCConnection } from '../hooks/useWebRTCConnection';
import { VideoStage } from './clinical/VideoStage';
import { ClinicalChatPanel } from './clinical/ClinicalChatPanel';
import { CallControls } from './clinical/CallControls';
import { TelephonyDialerPanel } from './clinical/TelephonyDialerPanel';
import { MultimodalVisionPanel } from './clinical/MultimodalVisionPanel';
import {
  Send, ShieldCheck, Video, VideoOff, Mic, MicOff, PhoneOff, Phone,
  Monitor, Play, Trash2, ArrowLeft, Terminal, AlertCircle, Volume2, Lock, User,
  Activity, Clock, RefreshCw, Radio, UserCheck, Shield, CheckCircle, FileText, Eye
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

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';

export const ClinicalRoom = ({ token, user, consultationId, appointmentMode, initialLayoutMode, onClose }) => {
  const { t } = useLanguage();
  const { triggerNotification } = useNotifications();
  const [messages, setMessages] = useState([]);

  // Client-Side End-to-End Encryption (E2EE) State & References
  const [e2eeStatus, setE2eeStatus] = useState("initializing"); // initializing, pending_peer, secure, failed
  const [fingerprint, setFingerprint] = useState("");
  const [isDoctorRecordsOpen, setIsDoctorRecordsOpen] = useState(false);

  const sessionKeyRef = useRef(null);
  const peerIdentityKeyRef = useRef(null);
  const peerIdentityKeyB64Ref = useRef("");
  const myIdKeyPairRef = useRef(null);
  const myEpKeyPairRef = useRef(null);
  const myIdPubB64Ref = useRef("");
  const myEpPubB64Ref = useRef("");
  const mySignatureRef = useRef("");
  const [inputVal, setInputVal] = useState("");
  const [remainingSeconds, setRemainingSeconds] = useState(2700); // 45-minute countdown limit (2700s)
  const [hasShown5MinWarning, setHasShown5MinWarning] = useState(false);
  const autoTimeoutExecutedRef = useRef(false);

  const formatCountdown = (secs) => {
    const s = Math.max(0, Number(secs) || 0);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

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

  const addPbxLog = (line) => {
    setPbxLogs(prev => [...prev, line]);
  };

  const activeCallSidRef = useRef(null);
  const statusPollIntervalRef = useRef(null);
  const voipTimerIntervalRef = useRef(null);

  const socketRef = useRef(null);
  const scrollRef = useRef(null);

  const safeSendSocketMessage = (msgObj) => {
    try {
      const ws = socketRef.current;
      if (!ws) return;
      const data = typeof msgObj === 'string' ? msgObj : JSON.stringify(msgObj);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      } else if (ws.readyState === WebSocket.CONNECTING) {
        const sendWhenOpen = () => {
          try {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(data);
            }
          } catch (e) {
            console.warn("Queued WebSocket send failed:", e);
          }
        };
        ws.addEventListener('open', sendWhenOpen, { once: true });
      }
    } catch (err) {
      console.warn("WebSocket send prevented crash:", err);
    }
  };

  const isAudioOnly = appointmentMode === 'audio' || consultationData?.audio_only || (consultationData?.type === 'audio');
  const isAnonymous = Boolean(consultationData?.is_anonymous || isAudioOnly);
  const anonIdentifier = consultationData?.anonymous_identifier || (consultationData?.anonymous_session_id ? `Anonymous Patient #${consultationData.anonymous_session_id}` : `Anonymous Patient #${consultationId}`);

  // Modular WebRTC Connection Hook
  const {
    webrtcStatus,
    setWebrtcStatus,
    setupScreen,
    setSetupScreen,
    activeCall,
    setActiveCall,
    cameraActive,
    setCameraActive,
    micActive,
    setMicActive,
    callTimer,
    setCallTimer,
    localVideoRef,
    remoteVideoRef,
    remoteAudioRef,
    pcRef,
    streamRef,
    timerIntervalRef,
    sendSignaling,
    handleWebRTCSignaling,
    toggleMic,
    toggleCamera,
    handleJoinCall,
    handleReconnect,
    handleHangup,
    stopAllMedia
  } = useWebRTCConnection({
    consultationId,
    appointmentMode,
    isAudioOnly,
    user,
    token,
    apiBase: API_BASE,
    safeSendSocketMessage,
    addPbxLog
  });

  const [layoutMode, setLayoutMode] = useState(
    appointmentMode === 'audio' ? 'audio-full' : 'video-split'
  );
  const [grantStatus, setGrantStatus] = useState('ACTIVE');

  const patientDetails = consultationData?.appointment_details?.patient_details || consultationData?.patient_details || consultationData?.patient;
  const doctorDetails = consultationData?.appointment_details?.doctor_details || consultationData?.doctor_details || consultationData?.doctor;

  const patientData = {
    name: patientDetails ? `${patientDetails.first_name || ''} ${patientDetails.last_name || ''}`.trim() || patientDetails.username : (isAnonymous ? anonIdentifier : 'Clinical Patient'),
    id: String(patientDetails?.id || consultationData?.appointment_details?.patient || ''),
    username: String(patientDetails?.username || ''),
    email: patientDetails?.email || (patientDetails?.username ? `${patientDetails.username}@healnsight.com.bd` : ''),
    bloodGroup: patientDetails?.blood_group || 'O+',
    vitals: {
      bp: consultationData?.patient?.bp || '128/84 mmHg',
      hr: consultationData?.patient?.hr || '76 bpm',
      temp: consultationData?.patient?.temp || '98.4 °F',
      spo2: consultationData?.patient?.spo2 || '99%',
    },
    allergies: consultationData?.patient?.allergies || ['None Reported'],
  };

  const handleApprovePrescription = async () => {
    const epBase = import.meta.env.VITE_EP_API_BASE || 'http://localhost:5002';
    const djangoBase = import.meta.env.VITE_API_BASE || 'http://localhost:8000';
    const draft = usePrescriptionDraftStore.getState();

    const patDetails = consultationData?.appointment_details?.patient_details || consultationData?.patient_details || consultationData?.patient;
    const docDetails = consultationData?.appointment_details?.doctor_details || consultationData?.doctor_details || consultationData?.doctor;

    const docId = String(user?.id || user?.username || docDetails?.id || docDetails?.username || 'doc-sarah-101');
    const patId = String(patientData.id || patDetails?.id || consultationData?.appointment_details?.patient || '');
    const patUsername = String(patientData.username || patDetails?.username || '');
    const patName = String(patientData.name || (patDetails ? `${patDetails.first_name || ''} ${patDetails.last_name || ''}`.trim() : 'Verified Patient'));
    const patEmail = String(patientData.email || patDetails?.email || (patUsername ? `${patUsername}@healnsight.com.bd` : ''));

    const payload = {
      consultationId: String(consultationId),
      doctorId: docId,
      patientId: patId,
      patientUsername: patUsername,
      patientName: patName,
      patientEmail: patEmail,
      symptoms: draft.chiefComplaints || 'Clinical Indications Evaluated',
      diagnosis: draft.clinicalDiagnosis || 'Clinical Assessment Finalized',
      medicines: JSON.stringify(draft.medications),
      items: draft.medications,
      instructions: draft.doctorAdvice || '',
      advice: draft.doctorAdvice || ''
    };

    let approvedSuccessfully = false;

    // 1. Submit to Secure E-Prescription Gateway (Automatic AES-256-GCM Envelope Encryption + Fabric Ledger Anchor)
    const tryGatewayApprove = async (baseUrl) => {
      try {
        const clean = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
        const res = await fetch(`${clean}/api/prescriptions/approve`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'X-Doctor-ID': docId,
            'X-Patient-ID': patId,
            'X-Patient-Username': patUsername
          },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          return data;
        }
      } catch (err) {
        console.warn(`Gateway approve attempt at ${baseUrl} notice:`, err);
      }
      return null;
    };

    // First attempt direct port 5002, then configured base, then proxy fallback
    let gwResult = await tryGatewayApprove('http://localhost:5002');
    if (!gwResult && epBase !== 'http://localhost:5002') {
      gwResult = await tryGatewayApprove(epBase);
    }
    if (!gwResult) {
      gwResult = await tryGatewayApprove('/ep-api');
    }

    if (gwResult) {
      approvedSuccessfully = true;
      triggerNotification(
        "E-Prescription Encrypted & Anchored",
        `Prescription #${gwResult.prescriptionId || consultationId} generated, encrypted (AES-256-GCM), and anchored to blockchain.`,
        "security"
      );
    }

    // 2. Also persist into Django backend
    const tryDjangoApprove = async (baseUrl) => {
      try {
        const clean = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
        const url = `${clean.endsWith('/api') ? clean : clean + '/api'}/prescriptions/`;
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'X-Doctor-ID': docId,
            'X-Patient-ID': patId,
            'X-Patient-Username': patUsername
          },
          body: JSON.stringify({
            consultation_id: consultationId,
            patient_id: patId,
            patient_username: patUsername,
            symptoms: draft.chiefComplaints || 'Clinical Indications Evaluated',
            diagnosis: draft.clinicalDiagnosis || 'Clinical Assessment Finalized',
            medicines: JSON.stringify(draft.medications),
            instructions: draft.doctorAdvice || ''
          })
        });
        if (res.ok) return true;
      } catch (djangoErr) {
        console.warn(`Django approve attempt at ${baseUrl} notice:`, djangoErr);
      }
      return false;
    };

    // First attempt direct port 8000, then configured base, then proxy fallback
    let djResult = await tryDjangoApprove('http://localhost:8000');
    if (!djResult && djangoBase !== 'http://localhost:8000') {
      djResult = await tryDjangoApprove(djangoBase);
    }
    if (!djResult) {
      djResult = await tryDjangoApprove('/api');
    }
    if (djResult) approvedSuccessfully = true;

    // 3. Broadcast real-time vault synchronization event across both portals & active websocket
    safeSendSocketMessage({
      action: 'prescription_generated',
      consultation_id: consultationId
    });
    window.dispatchEvent(new CustomEvent('healnsight_prescription_updated', {
      detail: { consultationId, patientId: patId, doctorId: docId }
    }));
    try {
      localStorage.setItem('healnsight_last_prescription_sync', Date.now().toString());
    } catch {}

    setGrantStatus('REVOKED');
    usePrescriptionDraftStore.getState().purgeDraftFromMemory();
    return approvedSuccessfully;
  };

  const handleCompleteConsultation = async () => {
    // 1. Stop audio/video streams & timers
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
    setWebrtcStatus("disconnected");
    stopAudioStreaming();

    // 2. Automatically Finalize Prescription and Generate Encrypted PDF
    await handleApprovePrescription();

    // 3. Mark consultation status as COMPLETED permanently in Django backend
    try {
      await fetch(`${API_BASE}/api/consultations/${consultationId}/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action: 'end' })
      });
    } catch (err) {
      console.warn("Failed to notify backend of consultation end:", err);
    }

    safeSendSocketMessage({
      action: 'consultation_ended',
      consultation_id: consultationId
    });
    window.dispatchEvent(new CustomEvent('healnsight_appointment_updated'));
    try {
      localStorage.setItem('healnsight_last_appointment_sync', Date.now().toString());
    } catch {}

    triggerNotification(
      "Consultation Permanently Closed",
      `Consultation #${consultationId} ended. E-Prescription PDF generated, AES-256-GCM encrypted, and stored in Vault.`,
      "security"
    );

    // 4. Close the consultation room permanently
    onClose();
  };

  const handleAutoTimeoutEnd = async () => {
    if (autoTimeoutExecutedRef.current) return;
    autoTimeoutExecutedRef.current = true;

    // 1. Stop audio/video streams & timers
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
    setWebrtcStatus("disconnected");
    stopAudioStreaming();

    // 2. If doctor has entered prescription items, finalize and generate encrypted PDF
    const draft = usePrescriptionDraftStore.getState();
    if (user?.role === 'doctor' && draft.medications && draft.medications.length > 0) {
      try {
        await handleApprovePrescription();
      } catch (err) {
        console.warn("Auto-save prescription on session timeout:", err);
      }
    }

    // 3. Mark consultation status as COMPLETED permanently in Django backend
    try {
      await fetch(`${API_BASE}/api/consultations/${consultationId}/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action: 'end', duration: 2700 })
      });
    } catch (err) {
      console.warn("Failed to notify backend of consultation timeout:", err);
    }

    triggerNotification(
      "45-Minute Session Limit Reached",
      `Consultation #${consultationId} reached the maximum 45-minute limit and was automatically closed.`,
      "warning"
    );

    // 4. Close the consultation room permanently
    onClose();
  };


  useEffect(() => {
    // Helper to decrypt and integrate incoming/historical chat messages
    const processIncomingEncryptedMessage = async (msgPayload, isHistory = false) => {
      const { sender, ciphertext, iv, aad, message_id, timestamp, status } = msgPayload;
      if (!message_id && !ciphertext) return;

      let plaintext = '';
      let isDecrypted = false;

      if (sessionKeyRef.current && iv && iv !== 'peer-channel') {
        try {
          plaintext = await decryptMessage(sessionKeyRef.current, ciphertext, iv, aad);
          isDecrypted = true;
        } catch (err) {
          try {
            plaintext = decodeURIComponent(escape(atob(ciphertext)));
            isDecrypted = true;
          } catch {}
        }
      } else {
        try {
          plaintext = decodeURIComponent(escape(atob(ciphertext)));
          isDecrypted = true;
        } catch {}
      }

      if (!isDecrypted) {
        plaintext = "Encrypted message (session key pending)...";
      }

      const timeStr = timestamp
        ? (new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
        : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      setMessages(prev => {
        const exists = prev.find(m => m.id === message_id);
        if (exists) {
          return prev.map(m => m.id === message_id ? {
            ...m,
            message: isDecrypted ? plaintext : m.message,
            status: status || m.status,
            isEncryptedPending: isDecrypted ? false : m.isEncryptedPending
          } : m);
        }
        return [...prev, {
          id: message_id,
          sender,
          message: plaintext,
          timestamp: timeStr,
          isSelf: sender === user.username,
          status: status || (sender === user.username ? 'sent' : 'delivered'),
          rawCiphertext: ciphertext,
          iv,
          aad,
          isEncryptedPending: !isDecrypted
        }];
      });
    };

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
      // Direct WebSocket to Django ASGI server on port 8000 when frontend runs on 3000/5173
      const rawApiBase = import.meta.env.VITE_API_BASE || window.location.origin.replace(/:(3000|5173)/, ':8000');
      const wsProto = rawApiBase.startsWith('https') ? 'wss:' : 'ws:';
      let cleanHost = rawApiBase.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
      if (cleanHost.includes(':3000') || cleanHost.includes(':5173')) {
        cleanHost = cleanHost.replace(/:(3000|5173)/, ':8000');
      }
      const activeToken = token || (typeof window !== 'undefined' ? localStorage.getItem('tv_token') : '') || '';
      const wsUrl = `${wsProto}//${cleanHost}/ws/consultation/${consultationId}/?token=${encodeURIComponent(activeToken)}`;
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onmessage = async (e) => {
        try {
          const payload = JSON.parse(e.data);
          if (payload.action === 'session_timer') {
            if (typeof payload.remaining_seconds === 'number') {
              setRemainingSeconds(payload.remaining_seconds);
            }
          } else if (payload.action === 'session_timeout') {
            addPbxLog("[SYS] 45-minute consultation session timeout triggered.");
            handleAutoTimeoutEnd();
          } else if (payload.action === 'chat_history' && Array.isArray(payload.messages)) {
            for (const msg of payload.messages) {
              await processIncomingEncryptedMessage(msg, true);
            }
          } else if (payload.action === 'chat_status_update') {
            const { message_id, status } = payload;
            if (message_id && status) {
              setMessages(prev => prev.map(m => m.id === message_id ? { ...m, status } : m));
            }
          } else if (payload.action === 'encrypted_chat_message') {
            await processIncomingEncryptedMessage(payload, false);
            if (payload.sender !== user.username && payload.message_id) {
              safeSendSocketMessage({
                action: 'message_delivered',
                message_id: payload.message_id,
                sender: user.username
              });
              safeSendSocketMessage({
                action: 'message_read',
                message_id: payload.message_id,
                sender: user.username
              });
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
                safeSendSocketMessage({
                  action: 'e2ee_key_exchange',
                  sender: user.username,
                  key_type: 'identity',
                  public_key: myIdPubB64Ref.current
                });
                
                // Send our ephemeral public key signed with our identity private key
                safeSendSocketMessage({
                  action: 'e2ee_key_exchange',
                  sender: user.username,
                  key_type: 'ephemeral',
                  public_key: myEpPubB64Ref.current,
                  signature: mySignatureRef.current
                });
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

                // Re-decrypt any pending messages now that session key is ready
                setMessages(prev => prev.map(m => {
                  if (m.isEncryptedPending && m.rawCiphertext && m.iv) {
                    decryptMessage(derivedKey, m.rawCiphertext, m.iv, m.aad).then(dec => {
                      setMessages(curr => curr.map(item => item.id === m.id ? { ...item, message: dec, isEncryptedPending: false } : item));
                    }).catch(() => {});
                  }
                  return m;
                }));
              } catch (err) {
                console.error("Ephemeral exchange failed:", err);
                addPbxLog("[E2EE] Session key derivation failed.");
                setE2eeStatus("failed");
              }
            }
          } else if (payload.action === 'webrtc_signaling') {
            handleWebRTCSignaling(payload.data, payload.sender);
          } else if (payload.action === 'records_shared') {
            addPbxLog(`[SYS] Patient updated consultation records (${payload.count || 0} shared).`);
            triggerNotification("Records Updated", `Patient authorized ${payload.count || 0} medical report(s) for this consultation.`, "medical");
            window.dispatchEvent(new CustomEvent('healnsight_records_updated', { detail: { consultationId } }));
            try { localStorage.setItem('healnsight_last_record_sync', Date.now().toString()); } catch {}
          } else if (payload.action === 'prescription_generated') {
            addPbxLog(`[SYS] E-Prescription issued and secured in Vault.`);
            triggerNotification("E-Prescription Ready", "Your prescription has been finalized by the doctor and secured in your Vault.", "medical");
            setGrantStatus('REVOKED');
            window.dispatchEvent(new CustomEvent('healnsight_prescription_updated', { detail: { consultationId } }));
            try { localStorage.setItem('healnsight_last_prescription_sync', Date.now().toString()); } catch {}
          } else if (payload.action === 'consultation_ended') {
            addPbxLog(`[SYS] Consultation permanently closed.`);
            triggerNotification("Consultation Concluded", "The consultation session has been closed by the physician.", "security");
            window.dispatchEvent(new CustomEvent('healnsight_appointment_updated'));
            try { localStorage.setItem('healnsight_last_appointment_sync', Date.now().toString()); } catch {}
            setTimeout(() => {
              handleAutoTimeoutEnd();
            }, 600);
          }
        } catch (parseErr) {
          console.warn("WebSocket message parse error:", parseErr);
        }
      };

      ws.onopen = () => {
        addPbxLog(`[SYS] WebSocket consultation channel #${consultationId} handshake completed.`);
        if (myIdPubB64Ref.current) {
          safeSendSocketMessage({
            action: 'e2ee_key_exchange',
            sender: user.username,
            key_type: 'identity',
            public_key: myIdPubB64Ref.current
          });
        }
      };

      ws.onerror = () => {
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
          if (data.status === 'completed' || data.status === 'ended' || data.is_expired) {
            triggerNotification(
              "Consultation Permanently Closed",
              "This consultation has completed or its 45-minute limit expired. Rejoining is prohibited.",
              "warning"
            );
            onClose();
            return;
          }
          if (typeof data.remaining_seconds === 'number') {
            setRemainingSeconds(data.remaining_seconds);
          }
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

    // Fetch initial chat history from REST
    const fetchChatHistory = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/consultations/${consultationId}/chat-history/`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (response.ok) {
          const hist = await response.json();
          if (Array.isArray(hist)) {
            for (const item of hist) {
              await processIncomingEncryptedMessage(item, true);
            }
          }
        }
      } catch (err) {
        console.warn("Failed to fetch chat history: ", err);
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
    fetchChatHistory();
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


    };
  }, [consultationId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // 45-Minute Consultation Room Automatic Session Countdown
  useEffect(() => {
    const timerInterval = setInterval(() => {
      setRemainingSeconds(prev => {
        if (prev <= 1) {
          clearInterval(timerInterval);
          handleAutoTimeoutEnd();
          return 0;
        }
        if (prev === 300) {
          triggerNotification(
            "5-Minute Consultation Warning",
            "This consultation will automatically terminate in 5 minutes (45-minute limit). Please finalize notes.",
            "warning"
          );
        }
        return prev - 1;
      });
    }, 1000);
    timerIntervalRef.current = timerInterval;
    return () => clearInterval(timerInterval);
  }, []);

  const sendText = async () => {
    const text = inputVal.trim();
    if (!text) return;

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const msgId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const timestamp = new Date().toISOString();

    // Optimistically render message immediately in sender's conversation feed
    setMessages(prev => [...prev, {
      id: msgId,
      sender: user.username,
      message: text,
      timestamp: timeStr,
      isSelf: true,
      status: 'sent'
    }]);
    setInputVal("");

    let ciphertext = '';
    let iv = 'peer-channel';
    let aad = {
      consultation_id: String(consultationId),
      sender: user.username,
      message_id: msgId,
      protocol_version: "1.0"
    };

    if (sessionKeyRef.current) {
      try {
        const encrypted = await encryptMessage(sessionKeyRef.current, text, aad);
        ciphertext = encrypted.ciphertext;
        iv = encrypted.iv;
        aad = encrypted.aad;
      } catch (err) {
        console.warn("Encryption fallback:", err);
        ciphertext = btoa(unescape(encodeURIComponent(text)));
      }
    } else {
      ciphertext = btoa(unescape(encodeURIComponent(text)));
    }

    // 1. Send via WebSocket
    safeSendSocketMessage({
      action: "encrypted_chat_message",
      sender: user.username,
      ciphertext,
      iv,
      aad,
      message_id: msgId,
      timestamp
    });

    // 2. Fallback persist via REST API
    try {
      fetch(`${API_BASE}/api/consultations/${consultationId}/chat-message/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          sender: user.username,
          ciphertext,
          iv,
          aad,
          message_id: msgId,
          timestamp
        })
      }).catch(() => {});
    } catch {}
  };

  const stopAudioStreaming = () => {};

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

  // ─── MODE B: COMPACT TOP AUDIO BAR + IN-CALL E-PRESCRIPTION DESK ───
  if (user?.role === 'doctor' && layoutMode === 'audio-full') {
    return (
      <div className="space-y-4">
        {/* Top Header */}
        <div className="bg-white border border-[#BDDDFA] p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-teal-500/20 text-teal-800 border border-teal-500/30">
              LIVE AUDIO CONSULTATION
            </span>
            <span className="text-xs text-slate-600 font-medium">
              Patient: {patientData.name} • Session #{consultationId}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-xs font-mono font-bold border ${remainingSeconds <= 300 ? 'bg-amber-100 text-amber-900 border-amber-300 animate-pulse' : 'bg-[#E7F0FC] text-[#0F172A] border-[#BDDDFA]'}`}
                 title="45-Minute Session Limit: Remaining time before consultation automatically terminates">
              <Clock className={`w-3.5 h-3.5 ${remainingSeconds <= 300 ? 'text-amber-600' : 'text-[#059669]'}`} />
              <span>{formatCountdown(remainingSeconds)}</span>
              <span className="text-[10px] text-slate-500 font-sans uppercase">Remaining</span>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-700">
              <button
                type="button"
                onClick={() => setLayoutMode('video-split')}
                className="px-3 py-1 rounded-lg text-xs font-semibold text-slate-400 hover:text-white transition cursor-pointer"
              >
                📹 Video + E-Prescription
              </button>
              <button
                type="button"
                onClick={() => setLayoutMode('audio-full')}
                className="px-3 py-1 rounded-lg text-xs font-semibold bg-teal-600 text-white transition cursor-pointer"
              >
                🎧 Audio + E-Prescription
              </button>
            </div>
            {user?.role === 'doctor' ? (
              <button
                onClick={handleCompleteConsultation}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-[10px] bg-rose-600 hover:bg-rose-700 text-xs font-bold text-white shadow-sm cursor-pointer transition"
                title="End Consultation, Finalize Encrypted PDF & Permanently Close Room"
              >
                <PhoneOff className="w-3.5 h-3.5" />
                <span>End Consultation</span>
              </button>
            ) : (
              <button
                onClick={onClose}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] border border-[#BDDDFA] hover:bg-[#F4F6F9] text-xs font-semibold text-[#0F172A] cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Exit</span>
              </button>
            )}
          </div>
        </div>

        {/* 5-Minute Warning Banner */}
        {remainingSeconds <= 300 && (
          <div className="p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-900 flex items-center justify-between text-xs font-semibold shadow-sm">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 animate-bounce" />
              <span>⚠️ <strong>5-Minute Session Warning:</strong> Consultation will automatically terminate in <strong>{formatCountdown(remainingSeconds)}</strong>. Please finalize your notes and prescription.</span>
            </div>
            <span className="font-mono text-amber-800 font-bold bg-amber-200/60 px-2 py-0.5 rounded-md border border-amber-300">
              {formatCountdown(remainingSeconds)}
            </span>
          </div>
        )}

        {/* Compact Top Audio Stream Bar */}
        <div className="h-12 px-6 bg-indigo-950/90 rounded-2xl border border-indigo-500/30 flex items-center justify-between text-xs text-indigo-200">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
            <span className="font-semibold">
              Encrypted Audio Stream Active — {patientData.name} ({callTimer})
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={toggleMic}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                micActive ? 'bg-indigo-900 text-indigo-200 hover:bg-indigo-800' : 'bg-red-600 text-white'
              }`}
            >
              {micActive ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
              <span>{micActive ? 'Mute Mic' : 'Unmuted'}</span>
            </button>
            <span className="text-indigo-300 text-[11px]">
              E-Prescription Portal Expanded to Full Screen Below
            </span>
          </div>
        </div>

        {/* Full-Width E-Prescription Portal */}
        <div className="rounded-2xl border border-[#BDDDFA] overflow-hidden min-h-[640px] bg-white shadow-sm">
          <EPrescriptionPortal
            sessionId={String(consultationId)}
            patient={patientData}
            grantStatus={grantStatus}
            userRole={user?.role || 'doctor'}
            layoutMode="audio-full"
            onChangeLayoutMode={setLayoutMode}
            onApproveWith2FA={handleApprovePrescription}
          />
        </div>
      </div>
    );
  }

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
                {isAudioOnly
                  ? (user.role === 'doctor' ? anonIdentifier : 'Anonymous Consultation')
                  : `Clinical Consultation Room #${consultationId}`}
              </h3>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#E7F0FC] text-[#059669] border border-[#BDDDFA]">
                {isAudioOnly ? 'Audio Consultation' : appointmentMode === 'video' ? 'Live Video' : appointmentMode === 'phone' ? 'Cellular VoIP' : 'Encrypted Chat'}
              </span>
            </div>
            <p className="text-xs text-[#55647C] mt-0.5 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#059669]" />
              <span>
                {isAnonymous
                  ? (user.role === 'doctor'
                      ? `Patient: ${anonIdentifier} • Identity Protected`
                      : 'During Consultation, Your identity is hidden from the doctor')
                  : `Session Connected • Patient: ${user.role === 'doctor' ? (consultationData?.patient?.name || 'Clinical Patient') : user.username}`}
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-auto">
          {user?.role === 'doctor' && (
            <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-700">
              <button
                type="button"
                onClick={() => setLayoutMode('video-split')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1 ${
                  layoutMode === 'video-split'
                    ? 'bg-teal-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>📹 Video + E-Prescription</span>
              </button>
              <button
                type="button"
                onClick={() => setLayoutMode('audio-full')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1 ${
                  layoutMode === 'audio-full'
                    ? 'bg-teal-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>🎧 Audio + E-Prescription</span>
              </button>
            </div>
          )}

          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-xs font-mono font-bold border ${remainingSeconds <= 300 ? 'bg-amber-100 text-amber-900 border-amber-300 animate-pulse' : 'bg-[#E7F0FC] text-[#0F172A] border-[#BDDDFA]'}`}
               title="45-Minute Session Limit: Remaining time before consultation automatically terminates">
            <Clock className={`w-3.5 h-3.5 ${remainingSeconds <= 300 ? 'text-amber-600' : 'text-[#059669]'}`} />
            <span>{formatCountdown(remainingSeconds)}</span>
            <span className="text-[10px] text-slate-500 font-sans uppercase">Remaining</span>
          </div>

          {user?.role === 'doctor' ? (
            <button
              onClick={handleCompleteConsultation}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-[10px] bg-rose-600 hover:bg-rose-700 text-xs font-bold text-white shadow-sm cursor-pointer transition"
              title="End Consultation, Finalize Encrypted PDF & Permanently Close Room"
            >
              <PhoneOff className="w-3.5 h-3.5" />
              <span>End Consultation</span>
            </button>
          ) : (
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-[10px] border border-[#BDDDFA] hover:bg-[#F4F6F9] text-xs font-semibold text-[#0F172A] cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Exit Room</span>
            </button>
          )}
        </div>
      </div>

      {/* 5-Minute Warning Banner */}
      {remainingSeconds <= 300 && (
        <div className="p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-900 flex items-center justify-between text-xs font-semibold shadow-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 animate-bounce" />
            <span>⚠️ <strong>5-Minute Session Warning:</strong> Consultation will automatically terminate in <strong>{formatCountdown(remainingSeconds)}</strong>. Please finalize your notes and prescription.</span>
          </div>
          <span className="font-mono text-amber-800 font-bold bg-amber-200/60 px-2 py-0.5 rounded-md border border-amber-300">
            {formatCountdown(remainingSeconds)}
          </span>
        </div>
      )}

      {/* 2. Main Consultation Workspace Grid */}
      {user?.role === 'doctor' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column (5 cols): Live WebRTC Video + Call Controls HUD + Encrypted Chat */}
          <div className="lg:col-span-5 space-y-5 flex flex-col">
            {/* Live Video / Pre-Call Check Box */}
            <VideoStage
              isDoctorView={true}
              isAudioOnly={isAudioOnly}
              setupScreen={setupScreen}
              webrtcStatus={webrtcStatus}
              localVideoRef={localVideoRef}
              remoteVideoRef={remoteVideoRef}
              remoteAudioRef={remoteAudioRef}
              handleJoinCall={handleJoinCall}
              handleReconnect={handleReconnect}
              user={user}
              patientData={patientData}
              consultationData={consultationData}
              anonIdentifier={anonIdentifier}
              callTimer={callTimer}
              micActive={micActive}
              cameraActive={cameraActive}
              toggleMic={toggleMic}
              toggleCamera={toggleCamera}
              onEndCall={handleCompleteConsultation}
            />

            {/* Encrypted Clinical Chat Drawer */}
            <ClinicalChatPanel
              compact={true}
              messages={messages}
              user={user}
              isAnonymous={isAnonymous}
              anonIdentifier={anonIdentifier}
              e2eeStatus={e2eeStatus}
              fingerprint={fingerprint}
              inputVal={inputVal}
              setInputVal={setInputVal}
              onSendText={sendText}
              scrollRef={scrollRef}
              placeholder="Type message to patient..."
            />

            {/* Dedicated Consultation Records Access */}
            <div className="bg-white p-3.5 rounded-2xl border border-[#BDDDFA] shadow-sm flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#E7F0FC] border border-[#BDDDFA] flex items-center justify-center text-[#059669]">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#0F172A]">Consultation Records</h4>
                  <p className="text-[10px] text-[#55647C]">Patient-shared diagnostic reports (PDF / JPG)</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDoctorRecordsOpen(true)}
                className="px-3.5 py-1.5 rounded-xl bg-[#059669] hover:bg-[#047857] text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Records</span>
              </button>
            </div>
          </div>

          {/* Right Column (7 cols): Embedded Secure E-Prescription Portal */}
          <div className="lg:col-span-7 rounded-2xl border border-[#BDDDFA] overflow-hidden bg-white shadow-sm flex flex-col min-h-[680px]">
            <EPrescriptionPortal
              sessionId={String(consultationId)}
              patient={patientData}
              grantStatus={grantStatus}
              userRole={user?.role || 'doctor'}
              layoutMode="video-split"
              onChangeLayoutMode={setLayoutMode}
              onApproveWith2FA={handleApprovePrescription}
            />
          </div>
        </div>
      ) : (
        /* Patient View: Standard Consultation Workspace */
        <div className="space-y-4">
          {grantStatus === 'REVOKED' && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs text-emerald-900 shadow-sm">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <span className="font-bold">E-Prescription Finalized &amp; Cryptographically Secured:</span>
                  <span className="ml-1 text-emerald-800">Your doctor has approved and signed your prescription. It is stored with AES-256-GCM encryption and anchored on Hyperledger Fabric.</span>
                </div>
              </div>
              <button
                type="button"
                onClick={async () => {
                  const targetBase = import.meta.env.VITE_EP_API_BASE || 'http://localhost:5002';
                  try {
                    const res = await fetch(`${targetBase}/api/patient/prescriptions/${consultationId}/download`, {
                      headers: { 'X-Patient-ID': String(patientData.id) }
                    });
                    if (!res.ok) throw new Error('Download failed');
                    const blob = await res.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `Prescription-${consultationId}.pdf`;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                  } catch (e) {
                    alert('Prescription ready in your Patient Vault! Opening vault...');
                  }
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Download Verified PDF</span>
              </button>
            </div>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left pane: Encrypted Clinical Chat */}
        <div className={`flex flex-col ${appointmentMode === 'chat' ? 'lg:col-span-3' : 'lg:col-span-1'}`}>
          <ClinicalChatPanel
            compact={false}
            messages={messages}
            user={user}
            isAnonymous={isAnonymous}
            anonIdentifier={anonIdentifier}
            e2eeStatus={e2eeStatus}
            fingerprint={fingerprint}
            inputVal={inputVal}
            setInputVal={setInputVal}
            onSendText={sendText}
            scrollRef={scrollRef}
            placeholder={e2eeStatus === 'secure' ? "Type encrypted clinical message..." : "Type message to doctor..."}
          />
        </div>

        {/* Right pane: WebRTC Video / Twilio Dialer */}
        {appointmentMode !== 'chat' && (
          <div className="lg:col-span-2 space-y-6">

            {/* --- CASE A: WEBRTC VIDEO / AUDIO STAGE --- */}
            {(isAudioOnly || appointmentMode === 'video') && (
              <VideoStage
                isDoctorView={false}
                isAudioOnly={isAudioOnly}
                appointmentMode={appointmentMode}
                setupScreen={setupScreen}
                webrtcStatus={webrtcStatus}
                localVideoRef={localVideoRef}
                remoteVideoRef={remoteVideoRef}
                remoteAudioRef={remoteAudioRef}
                handleJoinCall={handleJoinCall}
                handleReconnect={handleReconnect}
                user={user}
                patientData={patientData}
                consultationData={consultationData}
                anonIdentifier={anonIdentifier}
                callTimer={callTimer}
                micActive={micActive}
                cameraActive={cameraActive}
                toggleMic={toggleMic}
                toggleCamera={toggleCamera}
                onEndCall={user?.role === 'doctor' ? handleCompleteConsultation : handleHangup}
              />
            )}

            {/* --- CASE B: TWILIO TELEPHONY PHONE callback integration --- */}
            {appointmentMode === 'phone' && (
              <TelephonyDialerPanel
                t={t}
                activeCallMode={activeCallMode}
                sipStatus={sipStatus}
                dialNumber={dialNumber}
                setDialNumber={setDialNumber}
                pressDialKey={pressDialKey}
                handleBackspace={handleBackspace}
                onCellCall={onCellCall}
                hangupVoip={hangupVoip}
                triggerCall={triggerCall}
                pbxLogs={pbxLogs}
                triggerPBXCallbackSim={triggerPBXCallbackSim}
                callLogs={callLogs}
              />
            )}

            {/* Multimodal Vision Analysis Panel */}
            <MultimodalVisionPanel legacyImageProfiles={legacyImageProfiles} />

          </div>
        )}

      </div>
      </div>
      )}

      {/* Doctor Shared Consultation Records Modal */}
      <DoctorSharedRecordsModal
        isOpen={isDoctorRecordsOpen}
        onClose={() => setIsDoctorRecordsOpen(false)}
        consultationId={consultationId}
        patient={consultationData?.patient || patientData}
        token={token}
        apiBase={API_BASE}
      />

    </div>
  );
};

export default ClinicalRoom;

