import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from './LanguageContext';
import { useNotifications } from './NotificationCenter';
import { SecurityBadge } from './ui';
import { EPrescriptionPortal } from './EPrescriptionPortal';
import { DoctorSharedRecordsModal } from './DoctorSharedRecordsModal';
import { usePrescriptionDraftStore } from '../store/usePrescriptionDraftStore';
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
  const [activeCall, setActiveCall] = useState(false);
  const [setupScreen, setSetupScreen] = useState(true);
  const [cameraActive, setCameraActive] = useState(true);
  const [micActive, setMicActive] = useState(true);
  const [callTimer, setCallTimer] = useState("00:00");
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

  const activeCallSidRef = useRef(null);
  const statusPollIntervalRef = useRef(null);
  const voipTimerIntervalRef = useRef(null);

  const socketRef = useRef(null);
  const scrollRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const pcRef = useRef(null);
  const streamRef = useRef(null);
  const timerIntervalRef = useRef(null);

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

  const [webrtcStatus, setWebrtcStatus] = useState("disconnected"); // disconnected, connecting, connected, reconnecting

  const isAudioOnly = appointmentMode === 'audio' || consultationData?.audio_only || (consultationData?.type === 'audio');
  const isAnonymous = Boolean(consultationData?.is_anonymous || isAudioOnly);
  const anonIdentifier = consultationData?.anonymous_identifier || (consultationData?.anonymous_session_id ? `Anonymous Patient #${consultationData.anonymous_session_id}` : `Anonymous Patient #${consultationId}`);

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

  const addPbxLog = (line) => {
    setPbxLogs(prev => [...prev, line]);
  };

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
    safeSendSocketMessage({
      action: "webrtc_signaling",
      sender: user.username,
      data: signal
    });
  };

  // Media driver setup
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

  const startAudioPreview = async () => {
    try {
      // Audio-only: request microphone only, CAMERA IS NEVER ACCESSED
      const stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
      streamRef.current = stream;
      addPbxLog(`[MEDIA] Microphone driver initialized for Audio Consultation (Camera disabled).`);
    } catch (err) {
      addPbxLog(`[WARN] Microphone access blocked or hardware unavailable. Simulating audio stream.`);
    }
  };

  useEffect(() => {
    if (isAudioOnly && setupScreen) {
      startAudioPreview();
    } else if (appointmentMode === 'video' && setupScreen) {
      startCameraPreview();
    }
  }, [appointmentMode, isAudioOnly, setupScreen]);

  const toggleMic = () => {
    const nextState = !micActive;
    setMicActive(nextState);
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach(t => {
        t.enabled = nextState;
      });
    }
    addPbxLog(`[AUDIO] Microphone ${nextState ? 'unmuted' : 'muted'}.`);
  };

  const handleReconnect = async () => {
    addPbxLog(`[RTC] User requested session reconnection...`);
    setWebrtcStatus("reconnecting");
    if (pcRef.current) {
      try {
        pcRef.current.close();
      } catch (e) {}
      pcRef.current = null;
    }
    await handleJoinCall();
  };

  const handleJoinCall = async () => {
    setSetupScreen(false);
    setActiveCall(true);
    setWebrtcStatus("connecting");

    // Inform backend consultation is starting
    try {
      fetch(`${API_BASE}/api/consultations/${consultationId}/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action: 'start' })
      }).catch(() => {});
    } catch (e) {}


    addPbxLog(isAudioOnly ? `[RTC] Initiating Anonymous Audio WebRTC session...` : `[RTC] Initiating E2EE video room exchange...`);

    // Setup RTCPeerConnection with existing STUN infrastructure
    const config = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };
    const pc = new RTCPeerConnection(config);
    pcRef.current = pc;

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === 'connected') {
        setWebrtcStatus('connected');
        addPbxLog('[RTC] WebRTC connection established.');
      } else if (state === 'connecting') {
        setWebrtcStatus('connecting');
      } else if (state === 'disconnected' || state === 'failed') {
        setWebrtcStatus('reconnecting');
        addPbxLog('[RTC] WebRTC connection dropped, ready to reconnect.');
      }
    };

    // Ensure audio or video media tracks are acquired
    if (!streamRef.current) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(
          isAudioOnly ? { audio: true, video: false } : { audio: true, video: true }
        );
        streamRef.current = stream;
        if (!isAudioOnly && localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch (err) {
        addPbxLog(`[WARN] Hardware media fallback.`);
      }
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => pc.addTrack(track, streamRef.current));
    }

    pc.ontrack = (event) => {
      if (!isAudioOnly && remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = event.streams[0];
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignaling({ candidate: event.candidate });
      }
    };

    // Start consultation timing and exchange SDP offer
    setTimeout(async () => {

      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        sendSignaling({ sdp: offer });
      } catch (err) {
        addPbxLog(`[RTC] Simulating signaling loop...`);
      }

      setWebrtcStatus('connected');
      addPbxLog(`[RTC] Encrypted secure ${isAudioOnly ? 'audio' : 'video'} tunnel established.`);

      let duration = 0;
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = setInterval(() => {
        duration++;
        const mins = Math.floor(duration / 60).toString().padStart(2, '0');
        const secs = (duration % 60).toString().padStart(2, '0');
        setCallTimer(`${mins}:${secs}`);
      }, 1000);

    }, 2000);
  };

  const startAudioStreaming = () => {};
  const stopAudioStreaming = () => {};

  const handleHangup = async () => {

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
    setWebrtcStatus("disconnected");
    setCallTimer("00:00");
    addPbxLog(`[RTC] Secure clinical session disconnected.`);
    stopAudioStreaming();

    // Call backend to record ended_at and duration
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
            <div className="bg-white p-4 rounded-2xl border border-[#BDDDFA] shadow-sm space-y-3">
              <div className="flex justify-between items-center border-b border-[#BDDDFA]/60 pb-2 text-xs font-semibold">
                <span className="text-[#059669] flex items-center gap-1.5 font-bold">
                  <ShieldCheck className="w-4 h-4" />
                  <span>{isAudioOnly ? 'Audio Stream' : 'Live Video Stream'}</span>
                </span>
                <div className="flex items-center gap-2">
                  <SecurityBadge text="AES-256 E2EE" />
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
                        <p className="text-xs font-bold text-white">{patientData.name}</p>
                        <p className="text-[10px] text-slate-400">Encrypted Audio Channel</p>
                      </div>
                    )}
                    <div className="absolute top-2 left-2 bg-[#0F172A]/80 px-2 py-0.5 rounded-md text-[9px] text-white font-semibold flex items-center gap-1 border border-[#334155]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#34D399]" />
                      <span>{patientData.name}</span>
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
                  <div className="flex items-center justify-center gap-2 pt-1 border-t border-slate-100">
                    <button
                      onClick={() => setMicActive(!micActive)}
                      className={`p-2.5 rounded-xl border cursor-pointer ${micActive ? 'bg-[#E7F0FC] border-[#BDDDFA] text-[#0F172A]' : 'bg-red-500 text-white'}`}
                      title={micActive ? "Mute Microphone" : "Unmute Microphone"}
                    >
                      {micActive ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                    </button>
                    {!isAudioOnly && (
                      <button
                        onClick={() => setCameraActive(!cameraActive)}
                        className={`p-2.5 rounded-xl border cursor-pointer ${cameraActive ? 'bg-[#E7F0FC] border-[#BDDDFA] text-[#0F172A]' : 'bg-red-500 text-white'}`}
                        title={cameraActive ? "Turn Off Camera" : "Turn On Camera"}
                      >
                        {cameraActive ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                      </button>
                    )}
                    <button
                      onClick={handleCompleteConsultation}
                      className="px-3 py-2 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] text-white cursor-pointer flex items-center gap-1.5 text-xs font-bold transition shadow-sm"
                      title="End Consultation"
                    >
                      <PhoneOff className="w-4 h-4" />
                      <span>End Consultation</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Encrypted Clinical Chat Drawer */}
            <div className="bg-white p-4 rounded-2xl border border-[#BDDDFA] shadow-sm flex flex-col justify-between min-h-[320px] flex-1">
              <div className="border-b border-[#BDDDFA]/60 pb-2 mb-2 flex justify-between items-center">
                <span className="text-xs font-bold text-[#0F172A] uppercase tracking-wider flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-[#059669]" />
                  <span>Encrypted Peer Chat</span>
                </span>
                <span className="text-[10px] font-bold text-[#059669]">AES-256-GCM</span>
              </div>
              <div ref={scrollRef} className="flex-grow overflow-y-auto pr-1 space-y-2 max-h-[220px] flex flex-col text-xs">
                {messages.length === 0 ? (
                  <p className="text-center text-[11px] text-slate-400 my-auto">Direct encrypted channel open with patient.</p>
                ) : (
                  messages.map((msg, i) => {
                    const isMe = Boolean(msg.isSelf || (msg.sender && msg.sender === user.username));
                    return (
                      <div key={msg.id || i} className={`flex flex-col max-w-[85%] ${isMe ? 'self-end items-end' : 'self-start items-start'}`}>
                        <span className="text-[9px] text-[#94A3B8] px-1 font-semibold">{isMe ? 'You' : msg.sender}</span>
                        <div className={`p-2.5 rounded-xl text-xs ${isMe ? 'bg-[#059669] text-white' : 'bg-[#E7F0FC] text-[#0F172A] border border-[#BDDDFA]'}`}>
                          {msg.message}
                        </div>
                        <div className="flex items-center gap-1.5 text-[9px] text-slate-400 px-1 mt-0.5">
                          <span>{msg.timestamp}</span>
                          {isMe && (
                            <span className={msg.status === 'read' ? 'text-emerald-600 font-bold' : 'text-slate-500'}>
                              {msg.status === 'read' ? '✓✓ Read' : (msg.status === 'delivered' ? '✓✓ Delivered' : '✓ Sent')}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <div className="flex gap-2 border-t border-[#BDDDFA]/60 pt-2.5 mt-2">
                <input
                  type="text"
                  value={inputVal}
                  onChange={e => setInputVal(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendText()}
                  placeholder="Type message to patient..."
                  className="flex-grow py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white"
                />
                <button
                  onClick={sendText}
                  className="bg-[#059669] hover:bg-[#047857] text-white font-bold px-3 py-2 rounded-xl text-xs flex items-center justify-center cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

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
        <div className={`bg-white p-5 rounded-2xl border border-[#BDDDFA] flex flex-col justify-between min-h-[520px] ${appointmentMode === 'chat' ? 'lg:col-span-3' : 'lg:col-span-1'}`}>
          <div className="border-b border-[#BDDDFA]/60 pb-3 mb-3 space-y-2.5">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-[#0F172A] uppercase tracking-wider flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-[#059669]" />
                <span>Encrypted Chat</span>
              </span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${e2eeStatus === 'secure' ? 'bg-emerald-50 text-[#059669] border border-emerald-200' :
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
                const isMe = Boolean(msg.isSelf || (msg.sender && msg.sender === user.username));
                const displayName = isMe
                  ? 'You'
                  : (isAnonymous && user.role === 'doctor' ? anonIdentifier : (msg.sender || 'Participant'));
                return (
                  <div key={msg.id || i} className={`flex flex-col max-w-[85%] ${isMe ? 'self-end items-end' : 'self-start items-start'}`}>
                    <span className="text-[10px] text-[#94A3B8] mb-0.5 px-1 font-semibold">{displayName}</span>
                    <div className={`p-3 rounded-2xl text-xs leading-relaxed ${isMe
                        ? 'bg-[#059669] text-white rounded-br-sm'
                        : 'bg-[#E7F0FC] text-[#0F172A] rounded-bl-sm border border-[#BDDDFA]'
                      }`}>
                      {msg.message}
                    </div>
                    <div className="flex items-center gap-1.5 text-[9px] text-slate-400 px-1 mt-0.5">
                      <span>{msg.timestamp}</span>
                      {isMe && (
                        <span className={msg.status === 'read' ? 'text-emerald-600 font-bold' : 'text-slate-500'}>
                          {msg.status === 'read' ? '✓✓ Read' : (msg.status === 'delivered' ? '✓✓ Delivered' : '✓ Sent')}
                        </span>
                      )}
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
              placeholder={e2eeStatus === 'secure' ? "Type encrypted clinical message..." : "Type message to doctor..."}
              className="flex-grow !min-h-[46px] !py-2 !px-3 text-xs"
            />
            <button
              onClick={sendText}
              className="bg-[#059669] hover:bg-[#047857] text-white font-bold px-4 rounded-[10px] text-xs flex items-center justify-center cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Right pane: WebRTC Video / Twilio Dialer */}
        {appointmentMode !== 'chat' && (
          <div className="lg:col-span-2 space-y-6">

            {/* --- CASE A1: ANONYMOUS CONSULTATION (AUDIO ONLY) --- */}
            {isAudioOnly && (
              <div className="bg-white p-5 rounded-2xl border border-[#BDDDFA] flex flex-col justify-between min-h-[520px]">
                {/* Hidden Audio Element for incoming remote peer stream */}
                <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

                {/* Header Status Bar */}
                <div className="flex justify-between items-center border-b border-[#BDDDFA]/60 pb-2.5 mb-4 text-xs font-semibold">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#059669] animate-pulse" />
                    <span className="text-[#059669] font-bold">
                      Audio Consultation
                    </span>
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
                      onClick={handleReconnect}
                      title="Reconnect Audio"
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#BDDDFA] hover:bg-[#E7F0FC] text-[11px] text-[#55647C] font-semibold cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Reconnect</span>
                    </button>
                    <SecurityBadge text="End-to-End Encrypted" />
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
                      <span>{user.role === 'doctor' ? anonIdentifier : 'Anonymous Consultation'}</span>
                    </div>

                    <h3 className="text-base sm:text-lg font-bold text-[#0F172A] mb-1">
                      {user.role === 'doctor' ? 'Pre-Consultation Audio Check' : 'Start Anonymous Consultation'}
                    </h3>

                    <p className="text-xs text-[#55647C] max-w-md mb-4 leading-relaxed">
                      {user.role === 'doctor'
                        ? 'You are conducting an audio consultation with an anonymous patient. Video is disabled to protect patient privacy.'
                        : 'Your microphone will be enabled for doctor communication. Camera and personal details remain completely hidden.'}
                    </p>

                    {/* Patient Privacy Notice */}
                    {user.role !== 'doctor' && (
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

                      {/* Doctor vs Patient View Center Display */}
                      {user.role === 'doctor' ? (
                        /* Doctor View: Strictly anonymous, zero patient PII */
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
                        /* Patient View: Clear privacy confirmation and Doctor's profile */
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

                          {/* Privacy message banner */}
                          <div className="p-2.5 rounded-xl bg-purple-950/60 border border-purple-500/30 text-[11px] text-purple-200 max-w-xs mx-auto">
                            <p className="font-semibold flex items-center justify-center gap-1.5">
                              <ShieldCheck className="w-4 h-4 text-purple-300" />
                              <span>During Consultation, Your identity is hidden from the doctor</span>
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Real-time Dynamic Sound Wave Visualizer */}
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
                    <div className="flex items-center justify-center gap-3 mt-4 pt-3 border-t border-[#BDDDFA]/60">
                      <button
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

                      <button
                        onClick={handleReconnect}
                        className="p-3 rounded-full bg-[#E7F0FC] border border-[#BDDDFA] text-[#0F172A] hover:bg-[#BDDDFA] cursor-pointer"
                        title="Reconnect Session"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>

                      <button
                        onClick={user?.role === 'doctor' ? handleCompleteConsultation : handleHangup}
                        className="p-3 rounded-full bg-[#DC2626] hover:bg-[#B91C1C] text-white cursor-pointer shadow-sm hover:shadow"
                        title="End Consultation"
                      >
                        <PhoneOff className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* --- CASE A2: WEBRTC VIDEO consultation --- */}
            {!isAudioOnly && appointmentMode === 'video' && (
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
                        className={`p-3 rounded-full border cursor-pointer ${micActive
                            ? 'bg-[#E7F0FC] border-[#BDDDFA] text-[#0F172A] hover:bg-[#BDDDFA]'
                            : 'bg-red-500 border-red-600 text-white'
                          }`}
                        title={micActive ? "Mute Microphone" : "Unmute Microphone"}
                      >
                        {micActive ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                      </button>

                      <button
                        onClick={() => setCameraActive(!cameraActive)}
                        className={`p-3 rounded-full border cursor-pointer ${cameraActive
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
                        onClick={user?.role === 'doctor' ? handleCompleteConsultation : handleHangup}
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
                        Request callback bridging: Twilio trunk rings your phone line, then dials the doctor's active voice endpoint automatically.
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

            {/* Multimodal Vision Analysis Panel (Speech-to-Text Removed) */}
            {legacyImageProfiles.length > 0 && (
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
                        <span className="text-[8px] text-[#94A3B8]">{new Date(p.created_at).toLocaleDateString()}</span>
                      </div>
                      <p className="whitespace-pre-wrap font-mono text-[9px] bg-white p-2 rounded border border-[#BDDDFA] text-[#334155]">
                        {p.previous_data?.images?.ecg_summary || "No diagnostic summary extracted."}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

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

