import React, { useState, useEffect } from 'react';
import { useLanguage } from './LanguageContext';
import { useNotifications } from './NotificationCenter';
import {
  Heart, Droplet, Moon, Calendar, FileHeart, ShieldCheck, ShoppingBag,
  Search, Bot, Send, AlertTriangle, ArrowRight, User, PlusCircle, CheckCircle, Trash2, Clock, Upload
} from 'lucide-react';

const API_BASE = "http://127.0.0.1:8000";

const downloadPrescriptionPDF = (p) => {
  const docName = p.doctor_details ? `Dr. ${p.doctor_details.first_name} ${p.doctor_details.last_name}` : "Certified Doctor";
  const docSpecialty = p.doctor_details ? p.doctor_details.specialty : "";
  const docReg = p.doctor_details ? p.doctor_details.bmdc_reg : "";

  const patName = p.patient_details ? `${p.patient_details.first_name} ${p.patient_details.last_name}` : "Patient";
  const patPhone = p.patient_details ? p.patient_details.phone : "";

  let medsHtml = "";
  try {
    const medsList = JSON.parse(p.medicines);
    if (Array.isArray(medsList)) {
      medsHtml = medsList.map((m, idx) => `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: left; font-weight: bold;">${idx + 1}. ${m.name}</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center; color: #555;">${m.dosage}</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right; color: #555;">${m.timing}</td>
        </tr>
      `).join("");
    } else {
      medsHtml = `<tr><td colspan="3" style="padding: 10px;">${p.medicines}</td></tr>`;
    }
  } catch (e) {
    medsHtml = `<tr><td colspan="3" style="padding: 10px;">${p.medicines}</td></tr>`;
  }

  const element = document.createElement('div');
  element.style.padding = '40px';
  element.style.fontFamily = "'Inter', 'Nunito', sans-serif";
  element.style.color = '#333';
  element.style.background = '#fff';

  element.innerHTML = `
    <div style="border: 2px solid #14b8a6; padding: 25px; border-radius: 12px; position: relative;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #14b8a6; padding-bottom: 15px; margin-bottom: 20px;">
        <div>
          <h1 style="margin: 0; color: #14b8a6; font-size: 28px; font-weight: 800;">HealNSight</h1>
          <p style="margin: 3px 0 0 0; color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: 700; letter-spacing: 1.5px;">Secure E2EE Telemedicine Ledger</p>
        </div>
        <div style="text-align: right;">
          <h3 style="margin: 0; font-size: 16px; font-weight: 700; color: #1e293b;">${docName}</h3>
          <p style="margin: 2px 0; font-size: 13px; color: #14b8a6; font-weight: 600;">${docSpecialty}</p>
          <p style="margin: 0; font-size: 11px; color: #64748b;">BMDC Reg: ${docReg}</p>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; background: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 25px; font-size: 13px;">
        <div>
          <p style="margin: 3px 0;"><strong style="color: #475569;">Patient Name:</strong> ${patName}</p>
          <p style="margin: 3px 0;"><strong style="color: #475569;">Contact:</strong> ${patPhone}</p>
        </div>
        <div style="text-align: right;">
          <p style="margin: 3px 0;"><strong style="color: #475569;">Date:</strong> ${new Date(p.created_at || Date.now()).toLocaleDateString()}</p>
          <p style="margin: 3px 0;"><strong style="color: #475569;">Prescription ID:</strong> #${p.id || 'Pending'}</p>
        </div>
      </div>

      <div style="margin-bottom: 25px; font-size: 14px;">
        <p style="margin: 6px 0;"><strong style="color: #1e293b; font-size: 15px;">Chief Complaints:</strong> ${p.symptoms}</p>
        <p style="margin: 6px 0;"><strong style="color: #1e293b; font-size: 15px;">Diagnosis:</strong> ${p.diagnosis}</p>
      </div>

      <div style="font-size: 24px; font-weight: 800; color: #14b8a6; margin-bottom: 10px; font-style: italic;">Rx</div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 14px;">
        <thead>
          <tr style="background: #14b8a6; color: #fff;">
            <th style="padding: 10px; text-align: left; font-weight: bold; border-top-left-radius: 6px; border-bottom-left-radius: 6px;">Medicine</th>
            <th style="padding: 10px; text-align: center; font-weight: bold;">Dosage</th>
            <th style="padding: 10px; text-align: right; font-weight: bold; border-top-right-radius: 6px; border-bottom-right-radius: 6px;">Timing / Duration</th>
          </tr>
        </thead>
        <tbody>
          ${medsHtml}
        </tbody>
      </table>

      <div style="background: #f0fdfa; border-left: 4px solid #14b8a6; padding: 15px; border-radius: 6px; margin-bottom: 30px; font-size: 13.5px; color: #0f766e;">
        <strong style="display: block; margin-bottom: 4px; font-size: 14px; color: #0f766e;">Doctor's Instructions:</strong>
        ${p.instructions || "No special instructions provided."}
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed #cbd5e1; padding-top: 15px; font-size: 11px; color: #64748b;">
        <div>
          <p style="margin: 2px 0;">This document is issued securely via <strong>HealNSight</strong>.</p>
          <p style="margin: 2px 0; color: #14b8a6; font-weight: 600;">E2EE Digital Telemedicine Record Verified</p>
        </div>
        <div style="text-align: right; border: 1.5px solid #14b8a6; padding: 8px 12px; border-radius: 6px; background: #f0fdfa;">
          <strong style="color: #0f766e; font-size: 10px; text-transform: uppercase; tracking-wider: 0.5px;">BMDC Cryptographically Signed</strong>
          <p style="margin: 2px 0 0 0; color: #475569; font-size: 9px;">Secure Handshake ID: SN-2026-${p.id || 'MOCK'}</p>
        </div>
      </div>
    </div>
  `;

  const opt = {
    margin: 10,
    filename: `Prescription_${p.id || 'new'}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  if (window.html2pdf) {
    window.html2pdf().set(opt).from(element).save();
  } else {
    const printWin = window.open("", "_blank");
    printWin.document.write(element.innerHTML);
    printWin.document.close();
    printWin.print();
  }
};

export const PatientDashboard = ({ token, user, appointments, onSelectConsultation, onTabChange, activeTab }) => {
  const { t } = useLanguage();
  const { triggerNotification } = useNotifications();
  const [doctors, setDoctors] = useState([]);
  const [selectedDocId, setSelectedDocId] = useState(null);
  const [specialtyFilter, setSpecialtyFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [apptForm, setApptForm] = useState({ date: "", time: "09:00 AM", reason: "", consultation_type: "chat" });

  // Consent state
  const [consents, setConsents] = useState([]);
  const [consentForm, setConsentForm] = useState({ doctorId: "", hours: 24 });

  // Health Records state
  const [records, setRecords] = useState([]);
  const [recordForm, setRecordForm] = useState({ record_type: "Blood report", content: "" });

  // Medicine Orders state
  const [prescriptions, setPrescriptions] = useState([]);
  const [orders, setOrders] = useState([]);
  const [deliveryAddress, setDeliveryAddress] = useState(user.patient_profile?.address || "");
  const [selectedPrescId, setSelectedPrescId] = useState("");

  // AI Assistant Chat state
  const [aiMessages, setAiMessages] = useState([
    { sender: 'ai', text: "Hello! I am your AI Health Assistant. Ask me about your symptoms or medical concerns." }
  ]);
  const [aiInput, setAiInput] = useState("");

  const [sosActive, setSosActive] = useState(false);

  // Legacy image state
  const [legacyImages, setLegacyImages] = useState([]);
  const [legacyImageName, setLegacyImageName] = useState("");
  const [legacyFile, setLegacyFile] = useState(null);
  const [legacyLoading, setLegacyLoading] = useState(false);

  // Active view section
  const [subView, setSubView] = useState("overview");

  // Interactive Vitals state
  const [vitals, setVitals] = useState({
    heartRate: 74,
    waterIntake: 1.8,
    sleepHrs: 7.5
  });

  // Record drag-drop state
  const [recordDragOver, setRecordDragOver] = useState(false);
  const [recordProgress, setRecordProgress] = useState(0);
  const [recordSuccess, setRecordSuccess] = useState(false);

  // Sync subView with activeTab if activeTab changes from parent sidebar
  useEffect(() => {
    if (activeTab && activeTab !== 'dashboard') {
      setSubView(activeTab);
    } else {
      setSubView('overview');
    }
  }, [activeTab]);

  useEffect(() => {
    fetchDoctors();
    fetchConsents();
    fetchRecords();
    fetchPrescriptionsAndOrders();
    fetchLegacyImages();
  }, [token]);

  const fetchDoctors = async () => {
    try {
      const r = await fetch(`${API_BASE}/api/doctors/`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await r.json();
      setDoctors(data);
    } catch (err) { console.error(err); }
  };

  const fetchConsents = async () => {
    try {
      const r = await fetch(`${API_BASE}/api/consent/`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await r.json();
      setConsents(data);
    } catch (err) { console.error(err); }
  };

  const fetchRecords = async () => {
    try {
      const r = await fetch(`${API_BASE}/api/records/`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await r.json();
      setRecords(data);
    } catch (err) { console.error(err); }
  };

  const fetchPrescriptionsAndOrders = async () => {
    try {
      const rPresc = await fetch(`${API_BASE}/api/prescriptions/`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const prescData = await rPresc.json();
      setPrescriptions(prescData);

      const rOrders = await fetch(`${API_BASE}/api/orders/`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const ordersData = await rOrders.json();
      setOrders(ordersData);
    } catch (err) { console.error(err); }
  };

  const fetchLegacyImages = async () => {
    try {
      const r = await fetch(`${API_BASE}/api/image-profiles/`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (r.status === 200) {
        const data = await r.json();
        setLegacyImages(data);
      }
    } catch (err) { console.error(err); }
  };

  const handleLegacyFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setLegacyFile(e.target.files[0]);
    }
  };

  const handleUploadLegacyImage = async () => {
    if (!legacyFile || !legacyImageName) return;
    setLegacyLoading(true);

    const reader = new FileReader();
    reader.readAsDataURL(legacyFile);
    reader.onload = async () => {
      const base64Data = reader.result;

      try {
        const resp = await fetch("http://localhost:6000/api/vision/analyze", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            patient: user.id,
            image_name: legacyImageName,
            image_file: base64Data
          })
        });

        if (resp.ok) {
          triggerNotification("Vision Summary Ready", "Legacy image scan parsed by multimodal Vision model.", "medical");
          setLegacyImageName("");
          setLegacyFile(null);
          fetchLegacyImages();
        } else {
          triggerNotification("Upload Error", "Failed to parse legacy image via upstream worker.", "security");
        }
      } catch (err) {
        console.error(err);
        triggerNotification("Upload Error", "Unable to establish connection with upstream Vision worker.", "security");
      } finally {
        setLegacyLoading(false);
      }
    };
  };

  // Actions
  const handleBookAppointment = async (e) => {
    e.preventDefault();
    if (!selectedDocId) return;

    try {
      const resp = await fetch(`${API_BASE}/api/appointments/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          doctor: selectedDocId,
          date: apptForm.date,
          time: apptForm.time,
          reason: apptForm.reason,
          consultation_type: apptForm.consultation_type
        })
      });

      if (resp.status === 201) {
        triggerNotification("Appointment Requested", "Consultation slot has been queued for doctor approval.", "appointment");
        setApptForm({ date: "", time: "09:00 AM", reason: "", consultation_type: "chat" });
        setSelectedDocId(null);
        setSubView("overview");
        if (onTabChange) onTabChange("dashboard");
      }
    } catch (err) { console.error(err); }
  };

  const handleGrantConsent = async (e) => {
    e.preventDefault();
    if (!consentForm.doctorId) return;

    try {
      const resp = await fetch(`${API_BASE}/api/consent/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          doctor_id: consentForm.doctorId,
          expires_hours: consentForm.hours
        })
      });

      if (resp.status === 201) {
        triggerNotification("Consent Granted", "Clinical data access keys authorized for the physician.", "security");
        setConsentForm({ doctorId: "", hours: 24 });
        fetchConsents();
      }
    } catch (err) { console.error(err); }
  };

  const handleRevokeConsent = async (id) => {
    try {
      const resp = await fetch(`${API_BASE}/api/consent/${id}/`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        }
      });
      if (resp.status === 200) {
        triggerNotification("Consent Revoked", "Physician symmetric keys terminated instantly.", "security");
        fetchConsents();
      }
    } catch (err) { console.error(err); }
  };

  const handleCreateRecord = async (e) => {
    if (e) e.preventDefault();
    try {
      const resp = await fetch(`${API_BASE}/api/records/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          record_type: recordForm.record_type,
          content: recordForm.content
        })
      });
      if (resp.status === 201) {
        triggerNotification("Report Encrypted", "Clinical document hashed and saved in ledger.", "medical");
        setRecordForm({ record_type: "Blood report", content: "" });
        setRecordSuccess(false);
        setRecordProgress(0);
        fetchRecords();
      }
    } catch (err) { console.error(err); }
  };

  // Simulated drag and drop report ledger upload
  const simulateRecordUpload = (e) => {
    e.preventDefault();
    setRecordProgress(10);
    const interval = setInterval(() => {
      setRecordProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setRecordSuccess(true);
          // Automatically save document in database
          setRecordForm(prevForm => {
            const mockContent = `Blood parameters verified. Glucose: 5.6 mmol/L, HbA1c: 5.8%. Uploaded: medical_ledger_signed.pdf`;
            const recordData = { record_type: "Blood report", content: mockContent };
            // Trigger save after update
            setTimeout(() => {
              handleCreateRecordDirect(recordData);
            }, 500);
            return recordData;
          });
          return 100;
        }
        return prev + 30;
      });
    }, 150);
  };

  const handleCreateRecordDirect = async (recData) => {
    try {
      const resp = await fetch(`${API_BASE}/api/records/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(recData)
      });
      if (resp.status === 201) {
        triggerNotification("File Saved in Ledger", "Drag-and-Drop medical report compiled and encrypted.", "medical");
        setRecordSuccess(false);
        setRecordProgress(0);
        fetchRecords();
      }
    } catch (err) { console.error(err); }
  };

  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    try {
      const resp = await fetch(`${API_BASE}/api/orders/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          prescription_id: selectedPrescId ? parseInt(selectedPrescId) : null,
          delivery_address: deliveryAddress,
          total_price: 350
        })
      });
      if (resp.status === 201) {
        triggerNotification("Order Confirmed", "Pharmacy courier dispatch requested.", "billing");
        setDeliveryAddress(user.patient_profile?.address || "");
        setSelectedPrescId("");
        fetchPrescriptionsAndOrders();
      }
    } catch (err) { console.error(err); }
  };

  const handleTriggerSOS = () => {
    setSosActive(true);
    triggerNotification("EMERGENCY CRITICAL: SOS ALERT FIRED", "Broadcasting coordinates to emergency contact and nearest hospital.", "security");

    // Emergency audio signal chime simulation
    const alarm = document.getElementById("audioRingtone");
    if (alarm) {
      alarm.play().catch(e => { });
      setTimeout(() => {
        alarm.pause();
      }, 5000);
    }

    setTimeout(() => {
      setSosActive(false);
    }, 8000);
  };

  const handleSendAiMessage = (e) => {
    e.preventDefault();
    const query = aiInput.trim();
    if (!query) return;

    const userMsg = { sender: 'user', text: query };
    setAiMessages(prev => [...prev, userMsg]);
    setAiInput("");

    // AI diagnostic simulation logic
    setTimeout(() => {
      let response = "I understand you are experiencing symptoms. To stay safe, I recommend checking with our certified physicians. Could you search for a specialist under 'Schedule Doctor'?";

      const lowercaseQuery = query.toLowerCase();
      if (lowercaseQuery.includes("fever") || lowercaseQuery.includes("temperature")) {
        response = "High temperature or fever detected. Tips: Stay hydrated, rest, and keep a cool damp cloth on your forehead. If it exceeds 102°F, consult a general practice doctor. I recommend Booking Dr. Sarah Jenkins (Cardiology/General checkup).";
      } else if (lowercaseQuery.includes("chest pain") || lowercaseQuery.includes("heart")) {
        response = "WARNING: Chest pain can be an indicator of cardiovascular distress. If severe, press the SOS Emergency button immediately. Otherwise, please schedule a priority E2EE consultation with Cardiologist Dr. Sarah Jenkins.";
      } else if (lowercaseQuery.includes("child") || lowercaseQuery.includes("baby") || lowercaseQuery.includes("cough")) {
        response = "Pediatric cough or fever observed. Keep warm, avoid cold drinks, and check child vitals. Schedule a review with our Pediatricians.";
      }

      setAiMessages(prev => [...prev, { sender: 'ai', text: response }]);
    }, 800);
  };

  const filteredDoctors = doctors.filter(doc => {
    const matchesSpecialty = specialtyFilter === 'all' ||
      doc.specialty.toLowerCase() === specialtyFilter.toLowerCase() ||
      (specialtyFilter.toLowerCase() === 'general practice' && doc.specialty.toLowerCase() === 'general medicine');
    const matchesSearch = doc.user.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.user.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.specialty.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSpecialty && matchesSearch;
  });

  return (
    <div className="space-y-8 text-base">

      {/* Vitals summary bar & tabs */}
      <div className="flex gap-3 border-b border-medical-borderBg pb-4 overflow-x-auto">
        <button onClick={() => { setSubView("overview"); if (onTabChange) onTabChange("dashboard"); }} className={`px-5 py-3 rounded-xl font-bold transition-all ${subView === 'overview' ? 'bg-medical-teal text-medical-darkBg shadow-md shadow-medical-teal/15' : 'text-medical-textMuted hover:text-white bg-medical-darkBg/40'}`}>
          {t('vitalsOverview')}
        </button>
        <button onClick={() => { setSubView("booking"); if (onTabChange) onTabChange("booking"); }} className={`px-5 py-3 rounded-xl font-bold transition-all ${subView === 'booking' ? 'bg-medical-teal text-medical-darkBg shadow-md shadow-medical-teal/15' : 'text-medical-textMuted hover:text-white bg-medical-darkBg/40'}`}>
          {t('bookNewAppt')}
        </button>
        <button onClick={() => { setSubView("records"); if (onTabChange) onTabChange("records"); }} className={`px-5 py-3 rounded-xl font-bold transition-all ${subView === 'records' ? 'bg-medical-teal text-medical-darkBg shadow-md shadow-medical-teal/15' : 'text-medical-textMuted hover:text-white bg-medical-darkBg/40'}`}>
          {t('encryptedRecords')}
        </button>
        <button onClick={() => { setSubView("consent"); if (onTabChange) onTabChange("consent"); }} className={`px-5 py-3 rounded-xl font-bold transition-all ${subView === 'consent' ? 'bg-medical-teal text-medical-darkBg shadow-md shadow-medical-teal/15' : 'text-medical-textMuted hover:text-white bg-medical-darkBg/40'}`}>
          {t('consentManager')}
        </button>
        <button onClick={() => { setSubView("pharmacy"); if (onTabChange) onTabChange("pharmacy"); }} className={`px-5 py-3 rounded-xl font-bold transition-all ${subView === 'pharmacy' ? 'bg-medical-teal text-medical-darkBg shadow-md shadow-medical-teal/15' : 'text-medical-textMuted hover:text-white bg-medical-darkBg/40'}`}>
          {t('medicineDelivery')}
        </button>
        <button onClick={() => { setSubView("ai"); if (onTabChange) onTabChange("ai"); }} className={`px-5 py-3 rounded-xl font-bold transition-all ${subView === 'ai' ? 'bg-medical-teal text-medical-darkBg shadow-md shadow-medical-teal/15' : 'text-medical-textMuted hover:text-white bg-medical-darkBg/40'}`}>
          {t('aiAssistant')}
        </button>
      </div>

      {/* SUB-VIEW PANELS */}

      {/* 1. HEALTH OVERVIEW & QUICK ACTIONS */}
      {subView === 'overview' && (
        <div className="space-y-6 animate-fade relative overflow-hidden">
          {/* Floating Parallax Healthcare Shapes */}
          <div className="absolute top-10 left-[15%] opacity-[0.03] dark:opacity-[0.06] animate-float-slow pointer-events-none z-0">
            <Heart className="w-24 h-24 text-medical-rose" />
          </div>
          <div className="absolute top-80 right-[10%] opacity-[0.03] dark:opacity-[0.06] animate-float-medium pointer-events-none z-0">
            <PlusCircle className="w-16 h-16 text-medical-teal" />
          </div>
          <div className="absolute bottom-[30%] left-[5%] opacity-[0.03] dark:opacity-[0.06] animate-float-fast pointer-events-none z-0">
            <FileHeart className="w-20 h-20 text-medical-indigo" />
          </div>
          <div className="absolute bottom-[10%] right-[25%] opacity-[0.03] dark:opacity-[0.05] animate-float-slow pointer-events-none z-0">
            <ShieldCheck className="w-28 h-28 text-medical-emerald" />
          </div>

          {/* Welcome and SOS Panel */}
          <div className="glass-panel p-8 rounded-2xl flex flex-col md:flex-row justify-between items-center gap-6 bg-gradient-to-r from-medical-indigo/10 via-medical-cardBg to-medical-teal/10 border-medical-indigo/20 relative z-10 spotlight-card tilt-card">
            <div>
              <h2 className="text-2xl font-bold text-white">Good day, <span className="text-medical-teal font-extrabold">{user.first_name || user.username}</span>!</h2>
              <p className="text-base text-medical-textMuted mt-1">Your secure telemedicine workspace is fully encrypted and clinical keys are active.</p>
            </div>
            <button onClick={handleTriggerSOS} className="magnetic-target font-extrabold px-6 py-3.5 rounded-xl flex items-center gap-2 shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98] bg-medical-rose/20 text-medical-rose border border-medical-rose/40 hover:bg-medical-rose hover:text-white text-base">
              <AlertTriangle className="w-5 h-5" />
              <span>{t('emergencyAlertBtn')}</span>
            </button>
          </div>

          {/* Vitals Grid with SVG Progress Rings & 3D Tilt */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">

            {/* Vitals Card 1: Heart Rate */}
            <div className="glass-panel p-8 rounded-2xl space-y-4 relative overflow-hidden group spotlight-card tilt-card">
              <div className="flex justify-between items-center gap-4">
                <div className="space-y-2 flex-grow">
                  <div className="flex items-center gap-2 text-medical-textMuted">
                    <Heart className="w-5 h-5 text-medical-rose animate-pulse" />
                    <span className="text-sm font-bold uppercase tracking-wider">{t('heartRate')}</span>
                  </div>
                  <h3 className="text-3xl font-extrabold text-white flex items-baseline gap-1">
                    <span>{vitals.heartRate}</span>
                    <span className="text-sm text-medical-textMuted font-semibold">bpm</span>
                  </h3>
                  <p className="text-xs text-medical-textMuted mt-1">Steady rhythm • Synced 3m ago</p>
                </div>

                {/* SVG Progress Circle */}
                <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
                  <svg className="w-full h-full -rotate-90">
                    <circle cx="32" cy="32" r="26" stroke="rgba(255,255,255,0.05)" strokeWidth="4" fill="transparent" />
                    <circle cx="32" cy="32" r="26" stroke="var(--color-error)" strokeWidth="4" fill="transparent"
                      strokeDasharray="163.3" strokeDashoffset={163.3 - (163.3 * Math.min(vitals.heartRate, 150)) / 150} strokeLinecap="round"
                      className="transition-all duration-500 ease-out" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center text-sm font-extrabold text-medical-textBody">
                    {Math.round((Math.min(vitals.heartRate, 150) / 150) * 100)}%
                  </div>
                </div>
              </div>

              <div className="flex gap-2 border-t border-medical-borderBg pt-3">
                <button onClick={() => setVitals(v => ({ ...v, heartRate: Math.max(50, v.heartRate - 2) }))} className="magnetic-target bg-medical-darkBg border border-medical-borderBg px-3 py-1.5 rounded-lg text-sm text-medical-textMuted hover:text-white transition-colors">- 2</button>
                <button onClick={() => setVitals(v => ({ ...v, heartRate: Math.min(150, v.heartRate + 2) }))} className="magnetic-target bg-medical-darkBg border border-medical-borderBg px-3 py-1.5 rounded-lg text-sm text-medical-textMuted hover:text-white transition-colors">+ 2</button>
              </div>
            </div>

            {/* Vitals Card 2: Water Intake */}
            <div className="glass-panel p-8 rounded-2xl space-y-4 relative overflow-hidden group spotlight-card tilt-card">
              <div className="flex justify-between items-center gap-4">
                <div className="space-y-2 flex-grow">
                  <div className="flex items-center gap-2 text-medical-textMuted">
                    <Droplet className="w-5 h-5 text-medical-teal" />
                    <span className="text-sm font-bold uppercase tracking-wider">{t('waterIntake')}</span>
                  </div>
                  <h3 className="text-3xl font-extrabold text-white flex items-baseline gap-1">
                    <span>{vitals.waterIntake.toFixed(1)}</span>
                    <span className="text-sm text-medical-textMuted font-semibold">/ 2.5 L</span>
                  </h3>
                  <p className="text-xs text-medical-textMuted mt-1">Daily hydration target status</p>
                </div>

                {/* SVG Progress Circle */}
                <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
                  <svg className="w-full h-full -rotate-90">
                    <circle cx="32" cy="32" r="26" stroke="rgba(255,255,255,0.05)" strokeWidth="4" fill="transparent" />
                    <circle cx="32" cy="32" r="26" stroke="var(--color-secondary)" strokeWidth="4" fill="transparent"
                      strokeDasharray="163.3" strokeDashoffset={163.3 - (163.3 * Math.min(vitals.waterIntake, 2.5)) / 2.5} strokeLinecap="round"
                      className="transition-all duration-500 ease-out" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center text-sm font-extrabold text-medical-textBody">
                    {Math.round((Math.min(vitals.waterIntake, 2.5) / 2.5) * 100)}%
                  </div>
                </div>
              </div>

              <div className="flex gap-2 border-t border-medical-borderBg pt-3">
                <button onClick={() => setVitals(v => ({ ...v, waterIntake: Math.max(0, v.waterIntake - 0.25) }))} className="magnetic-target bg-medical-darkBg border border-medical-borderBg px-3 py-1.5 rounded-lg text-sm text-medical-textMuted hover:text-white transition-colors">- 250ml</button>
                <button onClick={() => setVitals(v => ({ ...v, waterIntake: Math.min(5, v.waterIntake + 0.25) }))} className="magnetic-target bg-medical-darkBg border border-medical-borderBg px-3 py-1.5 rounded-lg text-sm text-medical-textMuted hover:text-white transition-colors">+ 250ml</button>
              </div>
            </div>

            {/* Vitals Card 3: Sleep Tracker */}
            <div className="glass-panel p-8 rounded-2xl space-y-4 relative overflow-hidden group spotlight-card tilt-card">
              <div className="flex justify-between items-center gap-4">
                <div className="space-y-2 flex-grow">
                  <div className="flex items-center gap-2 text-medical-textMuted">
                    <Moon className="w-5 h-5 text-medical-indigo" />
                    <span className="text-sm font-bold uppercase tracking-wider">{t('sleepTracker')}</span>
                  </div>
                  <h3 className="text-3xl font-extrabold text-white flex items-baseline gap-1">
                    <span>{vitals.sleepHrs.toFixed(1)}</span>
                    <span className="text-sm text-medical-textMuted font-semibold">hrs</span>
                  </h3>
                  <p className="text-xs text-medical-textMuted mt-1">Restful sleep quality • 92% efficiency</p>
                </div>

                {/* SVG Progress Circle */}
                <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
                  <svg className="w-full h-full -rotate-90">
                    <circle cx="32" cy="32" r="26" stroke="rgba(255,255,255,0.05)" strokeWidth="4" fill="transparent" />
                    <circle cx="32" cy="32" r="26" stroke="var(--color-primary)" strokeWidth="4" fill="transparent"
                      strokeDasharray="163.3" strokeDashoffset={163.3 - (163.3 * Math.min(vitals.sleepHrs, 8.0)) / 8.0} strokeLinecap="round"
                      className="transition-all duration-500 ease-out" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center text-sm font-extrabold text-medical-textBody">
                    {Math.round((Math.min(vitals.sleepHrs, 8.0) / 8.0) * 100)}%
                  </div>
                </div>
              </div>

              <div className="flex gap-2 border-t border-medical-borderBg pt-3">
                <button onClick={() => setVitals(v => ({ ...v, sleepHrs: Math.max(0, v.sleepHrs - 0.5) }))} className="magnetic-target bg-medical-darkBg border border-medical-borderBg px-3 py-1.5 rounded-lg text-sm text-medical-textMuted hover:text-white transition-colors">- 0.5h</button>
                <button onClick={() => setVitals(v => ({ ...v, sleepHrs: Math.min(24, v.sleepHrs + 0.5) }))} className="magnetic-target bg-medical-darkBg border border-medical-borderBg px-3 py-1.5 rounded-lg text-sm text-medical-textMuted hover:text-white transition-colors">+ 0.5h</button>
              </div>
            </div>

          </div>

          {/* Grid of Sugar Levels Chart & Vertical Activity Timeline */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 relative z-10">

            {/* Graphical Health Statistics (Responsive SVG Chart) */}
            <div className="glass-panel p-8 rounded-2xl space-y-6 spotlight-card tilt-card">
              <div className="flex justify-between items-center border-b border-medical-borderBg border-medical-borderBg pb-3">
                <h3 className="text-xl font-bold text-medical-textMain text-medical-textMain uppercase tracking-wider">Health Stats Trends (Daily Blood Sugar Logs)</h3>
                <span className="text-sm text-medical-textMuted font-medium">Symmetric encrypted key active</span>
              </div>

              {/* Render SVG Line Chart */}
              <div className="w-full h-44">
                <svg className="w-full h-full" viewBox="0 0 500 120" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="gradient-sugar" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {/* Grid lines */}
                  <line x1="0" y1="30" x2="500" y2="30" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />
                  <line x1="0" y1="60" x2="500" y2="60" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />
                  <line x1="0" y1="90" x2="500" y2="90" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />

                  {/* Area path */}
                  <path d="M 0 100 L 0 60 Q 80 30 160 70 T 320 40 T 480 80 L 500 80 L 500 120 L 0 120 Z" fill="url(#gradient-sugar)" />

                  {/* Line path */}
                  <path d="M 0 60 Q 80 30 160 70 T 320 40 T 500 80" fill="transparent" stroke="var(--color-primary)" strokeWidth="2.5" strokeLinecap="round" />

                  {/* Highlight circles */}
                  <circle cx="160" cy="70" r="5" fill="var(--color-secondary)" stroke="var(--bg-card)" strokeWidth="1.5" />
                  <circle cx="320" cy="40" r="5" fill="var(--color-secondary)" stroke="var(--bg-card)" strokeWidth="1.5" />
                </svg>
              </div>
              <div className="flex justify-between text-xs text-medical-textMuted font-mono">
                <span>MONDAY (5.4)</span>
                <span>TUESDAY (6.8)</span>
                <span>WEDNESDAY (4.9)</span>
                <span>THURSDAY (5.7)</span>
                <span>FRIDAY (5.8)</span>
              </div>
            </div>

            {/* Health Activity Timeline */}
            <div className="glass-panel p-8 rounded-2xl space-y-6 spotlight-card tilt-card">
              <div className="flex justify-between items-center border-b border-medical-borderBg border-medical-borderBg pb-3">
                <h3 className="text-xl font-bold text-medical-textMain text-medical-textMain uppercase tracking-wider">Interactive Health Timeline</h3>
                <span className="text-sm text-medical-textMuted font-medium">Real-time ledger events</span>
              </div>

              <div className="relative pl-6 space-y-6 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-[2px] before:bg-gradient-to-b before:from-medical-teal before:via-medical-indigo before:to-transparent">
                {/* Timeline Item 1 */}
                <div className="relative group">
                  <span className="absolute -left-6 top-1.5 w-4.5 h-4.5 rounded-full bg-medical-darkBg border-2 border-medical-teal flex items-center justify-center group-hover:scale-125 transition-transform z-10">
                    <span className="w-2 h-2 rounded-full bg-medical-teal security-indicator animate-ping" />
                  </span>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-extrabold text-slate-850 text-medical-textMain">Sugar Level Synced</span>
                      <span className="text-xs bg-medical-teal/15 text-medical-teal px-2 py-0.5 rounded font-mono font-bold">5.8 mmol/L</span>
                    </div>
                    <p className="text-sm text-slate-650 text-medical-textMuted leading-normal">Decrypted metrics logs recorded via local Bluetooth health monitor sync.</p>
                    <span className="text-xs text-medical-textMuted block font-mono font-semibold">Today, 02:40 PM</span>
                  </div>
                </div>

                {/* Timeline Item 2 */}
                <div className="relative group">
                  <span className="absolute -left-6 top-1.5 w-4.5 h-4.5 rounded-full bg-medical-darkBg border-2 border-medical-indigo flex items-center justify-center group-hover:scale-125 transition-transform z-10">
                    <span className="w-2 h-2 rounded-full bg-medical-indigo" />
                  </span>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-extrabold text-slate-850 text-medical-textMain">Encryption Keys Rotated</span>
                      <span className="text-xs bg-medical-indigo/15 text-medical-indigo px-2 py-0.5 rounded font-mono font-bold">256-bit AES</span>
                    </div>
                    <p className="text-sm text-slate-650 text-medical-textMuted leading-normal">Security vault rotated symmetric tokens for the active consultation session with Dr. Jenkins.</p>
                    <span className="text-xs text-medical-textMuted block font-mono font-semibold">Yesterday, 10:15 AM</span>
                  </div>
                </div>

                {/* Timeline Item 3 */}
                <div className="relative group">
                  <span className="absolute -left-6 top-1.5 w-4.5 h-4.5 rounded-full bg-medical-darkBg border-2 border-medical-emerald flex items-center justify-center group-hover:scale-125 transition-transform z-10">
                    <span className="w-2 h-2 rounded-full bg-medical-emerald" />
                  </span>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-extrabold text-slate-850 text-medical-textMain">Medical Consent Granted</span>
                      <span className="text-xs bg-medical-emerald/15 text-medical-emerald px-2 py-0.5 rounded font-mono font-bold">Dr. Jenkins</span>
                    </div>
                    <p className="text-sm text-slate-650 text-medical-textMuted leading-normal">Authorized medical records access permission set to active for Dr. Sarah Jenkins (Cardiology).</p>
                    <span className="text-xs text-medical-textMuted block font-mono font-semibold">05 Jun 2026, 03:00 PM</span>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Signed Prescriptions Center */}
          <div className="glass-panel p-8 rounded-2xl space-y-6">
            <h3 className="text-xl font-bold text-slate-850 dark:text-slate-200 border-b border-medical-borderBg border-medical-borderBg pb-3 uppercase tracking-wider">E-Prescription Records</h3>
            {prescriptions.length === 0 ? (
              <p className="text-base text-medical-textMuted py-6 text-center">No prescriptions found.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {prescriptions.map(p => (
                  <div key={p.id} className="bg-medical-cardBg bg-medical-darkBg/40 p-6 border border-medical-borderBg border-medical-borderBg rounded-xl space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs bg-medical-teal/15 text-medical-teal py-1 px-2.5 rounded font-bold">Prescription #{p.id}</span>
                      <span className="text-xs text-medical-textMuted font-mono">{new Date(p.created_at).toLocaleDateString()}</span>
                    </div>

                    <div className="text-base text-medical-textBody text-medical-textMuted space-y-2 mt-1">
                      <p><strong className="text-medical-textBody text-medical-textBody">Symptoms:</strong> {p.symptoms}</p>
                      <p><strong className="text-medical-textBody text-medical-textBody">Diagnosis:</strong> {p.diagnosis}</p>
                      <div className="mt-2">
                        <strong className="text-medical-textBody text-medical-textBody">Medications (Rx):</strong>
                        <ul className="list-disc pl-5 mt-1 text-sm space-y-1">
                          {(() => {
                            try {
                              const meds = JSON.parse(p.medicines);
                              return Array.isArray(meds) ? meds.map((m, idx) => (
                                <li key={idx} className="text-slate-650 text-medical-textMuted">
                                  <span className="font-semibold text-medical-textMain dark:text-slate-200">{m.name}</span> - {m.dosage} ({m.timing})
                                </li>
                              )) : <li>{p.medicines}</li>;
                            } catch (e) {
                              return <li>{p.medicines}</li>;
                            }
                          })()}
                        </ul>
                      </div>
                    </div>

                    <div className="flex gap-2 mt-4">
                      <button
                        onClick={() => downloadPrescriptionPDF(p)}
                        className="w-1/2 bg-medical-teal/10 hover:bg-medical-teal text-medical-teal hover:text-white border border-medical-teal/25 text-xs font-extrabold py-2.5 rounded-lg transition-all"
                      >
                        Download PDF
                      </button>
                      <button
                        onClick={() => { setSelectedPrescId(p.id.toString()); setSubView("pharmacy"); if (onTabChange) onTabChange("pharmacy"); }}
                        className="w-1/2 bg-medical-indigo/10 hover:bg-medical-indigo text-medical-indigo hover:text-white border border-medical-indigo/25 text-xs font-extrabold py-2.5 rounded-lg transition-all"
                      >
                        Order Medicines
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Appointments queue */}
          <div className="glass-panel p-8 rounded-2xl">
            <div className="flex justify-between items-center mb-6 border-b border-medical-borderBg border-medical-borderBg pb-3">
              <h3 className="text-xl font-bold text-medical-textMain dark:text-slate-200 uppercase tracking-wider">{t('upcomingAppt')}</h3>
              <button onClick={() => { setSubView("booking"); if (onTabChange) onTabChange("booking"); }} className="text-sm text-medical-teal hover:underline flex items-center gap-1 font-bold">
                <span>{t('bookNewAppt')}</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>

            {appointments.length === 0 ? (
              <div className="text-center py-8 text-medical-textMuted">
                <Calendar className="w-8 h-8 text-medical-textBody mx-auto mb-2" />
                <p>{t('emptyAppt')}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-medical-textMuted">
                  <thead>
                    <tr className="border-b border-medical-borderBg text-medical-textBody font-semibold">
                      <th className="py-2.5">Doctor</th>
                      <th>Specialty</th>
                      <th>Date</th>
                      <th>Time</th>
                      <th>Mode</th>
                      <th>Status</th>
                      <th>Consultation Room</th>
                    </tr>
                  </thead>
                  <tbody>
                    {appointments.map(appt => (
                      <tr key={appt.id} className="border-b border-medical-borderBg hover:bg-white/2">
                        <td className="py-4 font-bold text-slate-200">
                          Dr. {appt.doctor_details.first_name} {appt.doctor_details.last_name}
                        </td>
                        <td>{appt.doctor_details.specialty || "General"}</td>
                        <td>{appt.date}</td>
                        <td>{appt.time}</td>
                        <td className="capitalize">{appt.consultation?.type || 'chat'}</td>
                        <td>
                          <span className={`px-3 py-1 rounded-full text-xs font-bold capitalize ${appt.status === 'approved' ? 'bg-medical-emerald/10 text-medical-emerald' : appt.status === 'pending' ? 'bg-medical-amber/10 text-medical-amber' : 'bg-medical-rose/10 text-medical-rose'}`}>
                            {appt.status}
                          </span>
                        </td>
                        <td>
                          {appt.status === 'approved' && appt.consultation && (
                            <button onClick={() => onSelectConsultation({ id: appt.consultation.id, mode: appt.consultation.type })} className="bg-medical-teal text-medical-darkBg font-extrabold px-4 py-2 rounded-lg text-sm hover:bg-medical-teal/90 transition-all">
                              {t('enterClinicalRoom')}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. BOOK NEW APPOINTMENT */}
      {subView === 'booking' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade">

          {/* Doctor List (Left) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <h3 className="text-xl font-bold text-slate-250 uppercase tracking-wider">{t('chooseSpecialist')}</h3>

              {/* Specialization Filter Tabs */}
              <div className="flex gap-2 overflow-x-auto w-full md:w-auto">
                <button onClick={() => setSpecialtyFilter("all")} className={`px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${specialtyFilter === 'all' ? 'bg-medical-teal text-medical-darkBg' : 'bg-medical-darkBg border border-medical-borderBg text-medical-textMuted'}`}>All</button>
                <button onClick={() => setSpecialtyFilter("Cardiology")} className={`px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${specialtyFilter === 'Cardiology' ? 'bg-medical-teal text-medical-darkBg' : 'bg-medical-darkBg border border-medical-borderBg text-medical-textMuted'}`}>Cardiology</button>
                <button onClick={() => setSpecialtyFilter("Pediatrics")} className={`px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${specialtyFilter === 'Pediatrics' ? 'bg-medical-teal text-medical-darkBg' : 'bg-medical-darkBg border border-medical-borderBg text-medical-textMuted'}`}>Pediatrics</button>
                <button onClick={() => setSpecialtyFilter("General Practice")} className={`px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${specialtyFilter === 'General Practice' ? 'bg-medical-teal text-medical-darkBg' : 'bg-medical-darkBg border border-medical-borderBg text-medical-textMuted'}`}>General</button>
              </div>
            </div>

            {/* Search Bar */}
            <div className="relative">
              <input type="text" placeholder={t('searchDocs')} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-medical-darkBg border border-medical-borderBg focus:border-medical-teal rounded-xl py-3 pl-11 pr-4 outline-none text-white placeholder-slate-500 text-base" />
              <Search className="absolute left-4 top-3.5 w-5 h-5 text-medical-textMuted" />
            </div>

            {/* Doctors Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[550px] overflow-y-auto pr-1">
              {filteredDoctors.map(doc => (
                <div key={doc.id} onClick={() => setSelectedDocId(doc.user.id)} className={`glass-panel p-6 rounded-xl cursor-pointer transition-all border ${selectedDocId === doc.user.id ? 'border-medical-teal bg-medical-teal/5 shadow-md shadow-medical-teal/5' : 'border-medical-borderBg'}`}>
                  <div className="flex gap-4 items-start">
                    <div className="w-12 h-12 rounded-full bg-medical-darkBg flex items-center justify-center font-bold text-medical-teal text-base">
                      {doc.user.first_name[0]}
                    </div>
                    <div className="flex-grow">
                      <h4 className="font-bold text-white text-base">Dr. {doc.user.first_name} {doc.user.last_name}</h4>
                      <p className="text-sm text-medical-teal mt-0.5 font-semibold">{doc.specialty}</p>
                      <p className="text-xs text-medical-textMuted mt-1">{doc.hospital || 'Private Clinic'}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs bg-medical-amber/10 text-medical-amber py-0.5 px-2.5 rounded-full font-bold">★ {doc.rating}</span>
                      <p className="text-base text-white font-extrabold mt-3">{doc.fees} BDT</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Booking Request Form (Right) */}
          <div className="glass-panel p-8 rounded-2xl border border-medical-borderBg h-fit">
            <h3 className="text-xl font-bold text-slate-200 mb-6 uppercase tracking-wider">{t('scheduleDetails')}</h3>

            {selectedDocId ? (
              <form onSubmit={handleBookAppointment} className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-medical-textMuted mb-1.5">{t('consultationMode')}</label>
                  <select value={apptForm.consultation_type} onChange={e => setApptForm({ ...apptForm, consultation_type: e.target.value })} className="w-full bg-medical-darkBg border border-medical-borderBg rounded-xl p-3 text-white outline-none focus:border-medical-teal text-base">
                    <option value="chat">Secure Text Chat (E2EE)</option>
                    <option value="video">E2EE Video Room</option>
                    <option value="phone">Cellular Callback (Twilio PBX)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-medical-textMuted mb-1.5">{t('selectDate')}</label>
                    <input required type="date" value={apptForm.date} min="2026-06-06" onChange={e => setApptForm({ ...apptForm, date: e.target.value })} className="w-full bg-medical-darkBg border border-medical-borderBg rounded-xl p-3 text-white outline-none focus:border-medical-teal text-base" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-medical-textMuted mb-1.5">{t('selectTime')}</label>
                    <select value={apptForm.time} onChange={e => setApptForm({ ...apptForm, time: e.target.value })} className="w-full bg-medical-darkBg border border-medical-borderBg rounded-xl p-3 text-white outline-none focus:border-medical-teal text-base">
                      <option value="09:00 AM">09:00 AM</option>
                      <option value="10:30 AM">10:30 AM</option>
                      <option value="02:30 PM">02:30 PM</option>
                      <option value="04:00 PM">04:00 PM</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-medical-textMuted mb-1.5">{t('symptomsReason')}</label>
                  <textarea required rows="3" placeholder="Briefly describe your symptoms..." value={apptForm.reason} onChange={e => setApptForm({ ...apptForm, reason: e.target.value })} className="w-full bg-medical-darkBg border border-medical-borderBg rounded-xl p-3 text-white outline-none focus:border-medical-teal text-base"></textarea>
                </div>

                <button type="submit" className="w-full bg-gradient-to-r from-medical-teal to-medical-indigo text-white dark:text-medical-darkBg font-extrabold py-3.5 rounded-xl transition-all shadow-md shadow-medical-teal/10 hover:scale-[1.01] active:scale-[0.99] text-base">
                  {t('submitRequest')}
                </button>
              </form>
            ) : (
              <div className="py-12 text-center text-medical-textMuted text-base">
                Please select a physician from the specialist list.
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. ENCRYPTED HEALTH RECORDS */}
      {subView === 'records' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade">
          {/* Uploader (Left) */}
          <div className="glass-panel p-8 rounded-2xl border border-medical-borderBg h-fit space-y-6">
            <h3 className="text-xl font-bold text-slate-200 uppercase tracking-wider">{t('addNewRecord')}</h3>

            {/* Drag and Drop area for reports uploader */}
            <div
              onDragOver={e => { e.preventDefault(); setRecordDragOver(true); }}
              onDragLeave={() => setRecordDragOver(false)}
              onDrop={simulateRecordUpload}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${recordDragOver ? 'border-medical-teal bg-medical-teal/5' : 'border-medical-borderBg hover:border-medical-teal/30 bg-medical-darkBg/30'}`}
            >
              {recordSuccess ? (
                <div className="flex flex-col items-center justify-center gap-2">
                  <CheckCircle className="w-10 h-10 text-medical-emerald" />
                  <span className="font-bold text-slate-200 text-sm">medical_ledger_signed.pdf</span>
                  <span className="text-xs text-medical-emerald font-semibold uppercase">Encrypted and Bound</span>
                </div>
              ) : recordProgress > 0 ? (
                <div className="w-full">
                  <p className="text-xs text-slate-405 mb-2 font-medium">Processing clinical scan: {recordProgress}%</p>
                  <div className="w-full bg-medical-darkBg h-2 rounded-full overflow-hidden">
                    <div className="bg-medical-teal h-full" style={{ width: `${recordProgress}%` }}></div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-2">
                  <Upload className="w-10 h-10 text-medical-textMuted animate-bounce" />
                  <span className="font-bold text-medical-textBody text-base">Drag &amp; Drop scans here</span>
                  <span className="text-xs text-medical-textMuted uppercase font-semibold">Or click upload PDF (Max 5MB)</span>
                </div>
              )}
            </div>

            <div className="border-t border-slate-100 border-medical-borderBg pt-5">
              <p className="text-xs text-medical-textMuted uppercase font-bold text-center mb-4">Or fill index parameters</p>

              <form onSubmit={handleCreateRecord} className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-medical-textMuted mb-1.5">{t('recordCategory')}</label>
                  <select value={recordForm.record_type} onChange={e => setRecordForm({ ...recordForm, record_type: e.target.value })} className="w-full bg-medical-darkBg border border-medical-borderBg rounded-xl p-3 text-white outline-none focus:border-medical-teal text-base">
                    <option value="Blood report">{t('bloodReport')}</option>
                    <option value="Lab result">{t('labResult')}</option>
                    <option value="Clinical notes">{t('clinicalNotes')}</option>
                    <option value="X-Ray / Scan">{t('diagnosticScan')}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-medical-textMuted mb-1.5">{t('recordData')}</label>
                  <textarea required rows="3" placeholder="Enter clinical vitals, values, or notes..." value={recordForm.content} onChange={e => setRecordForm({ ...recordForm, content: e.target.value })} className="w-full bg-medical-darkBg border border-medical-borderBg rounded-xl p-3 text-white outline-none focus:border-medical-teal text-base"></textarea>
                </div>

                <button type="submit" className="w-full bg-gradient-to-r from-medical-teal to-medical-indigo text-white dark:text-medical-darkBg font-extrabold py-3 rounded-xl transition-all shadow text-base">
                  {t('writeLedger')}
                </button>
              </form>
            </div>

            {/* Legacy Medical Graphic Upload & Vision Analysis Card */}
            <div className="border-t border-slate-100 border-medical-borderBg pt-5 space-y-4">
              <p className="text-xs text-medical-textMuted uppercase font-bold text-center">Legacy Medical Graphic Upload</p>
              <div className="space-y-3 bg-medical-darkBg/20 p-4 rounded-xl border border-medical-borderBg">
                <input required type="text" placeholder="Scan Label (e.g. My ECG Graph)" value={legacyImageName} onChange={e => setLegacyImageName(e.target.value)} className="w-full bg-medical-darkBg border border-medical-borderBg rounded-lg p-2.5 text-xs text-white outline-none focus:border-medical-teal" />

                <label className="block bg-medical-darkBg border border-medical-borderBg hover:border-medical-teal/30 cursor-pointer rounded-lg p-3 text-center text-xs text-medical-textMuted transition-colors">
                  <span>{legacyFile ? legacyFile.name : "Select Image (ECG/CBC)"}</span>
                  <input type="file" accept="image/*" onChange={handleLegacyFileChange} className="hidden" />
                </label>

                <button type="button" onClick={handleUploadLegacyImage} disabled={!legacyFile || !legacyImageName || legacyLoading} className="w-full bg-medical-teal hover:bg-medical-teal/90 disabled:opacity-50 text-medical-darkBg font-extrabold py-2 rounded-lg text-xs transition-all flex items-center justify-center gap-1.5">
                  {legacyLoading ? "Running Vision Model..." : "Extract & Save Summary"}
                </button>
              </div>
            </div>

          </div>

          {/* Records List (Right) */}
          <div className="lg:col-span-2 glass-panel p-8 rounded-2xl border border-medical-borderBg space-y-6">
            <h3 className="text-xl font-bold text-slate-200 border-b border-slate-100 border-medical-borderBg pb-3 uppercase tracking-wider">{t('clinicalIndex')}</h3>

            {/* Vision Analysed Legacy Summaries */}
            <div className="space-y-3 border-b border-slate-100 border-medical-borderBg pb-5">
              <h4 className="text-xs font-bold text-medical-indigo uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4.5 h-4.5 text-medical-indigo" />
                <span>Vision Analysed Legacy Scans</span>
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[220px] overflow-y-auto pr-1">
                {legacyImages.length === 0 ? (
                  <p className="text-medical-textMuted text-xs py-2">No legacy scans analyzed yet. Upload an image on the left to extract chart metrics.</p>
                ) : (
                  legacyImages.map(img => (
                    <div key={img.id} className="bg-medical-darkBg/60 p-3 rounded-lg border border-medical-borderBg space-y-1">
                      <div className="flex justify-between items-center text-[10px] font-bold text-medical-textBody">
                        <span>{img.image_name}</span>
                        <span className="text-[8px] text-medical-textMuted">{new Date(img.created_at).toLocaleDateString()}</span>
                      </div>
                      <p className="font-mono text-[9px] text-medical-textMuted bg-black/40 p-2 rounded border border-medical-borderBg whitespace-pre-wrap">
                        {img.previous_data?.images?.ecg_summary || "No summary extracted."}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="space-y-6 max-h-[350px] overflow-y-auto">
              {records.length === 0 ? (
                <p className="text-medical-textMuted text-center py-12 text-base">{t('emptyRecords')}</p>
              ) : (
                records.map(rec => (
                  <div key={rec.id} className="bg-medical-cardBg bg-medical-darkBg/40 border border-slate-250 border-medical-borderBg rounded-xl p-5 flex gap-4 items-start">
                    <div className="bg-medical-teal/10 p-3 rounded-xl text-medical-teal shrink-0">
                      <FileHeart className="w-6 h-6" />
                    </div>
                    <div className="flex-grow space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs bg-medical-teal/15 text-medical-teal px-2.5 py-0.5 rounded font-bold uppercase">{rec.record_type}</span>
                        <span className="text-xs text-medical-textMuted font-mono">{new Date(rec.updated_at).toLocaleDateString()}</span>
                      </div>
                      <p className="font-mono text-medical-textBody text-medical-textBody leading-relaxed bg-slate-200/50 dark:bg-black/40 p-4 rounded-lg border border-medical-borderBg border-medical-borderBg text-sm">
                        {rec.decrypted_content || rec.encrypted_data}
                      </p>
                      <div className="text-xs text-medical-teal flex items-center gap-1 font-bold uppercase tracking-wider">
                        <ShieldCheck className="w-4.5 h-4.5" />
                        <span>{t('aesProtected')}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 4. CONSENT MANAGEMENT CENTER */}
      {subView === 'consent' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade">
          {/* Delegate Form (Left) */}
          <div className="glass-panel p-8 rounded-2xl border border-medical-borderBg h-fit">
            <h3 className="text-xl font-bold text-slate-200 mb-2 uppercase tracking-wider">{t('delegateAccess')}</h3>
            <p className="text-sm text-medical-textMuted mb-6 leading-relaxed">{t('delegateDesc')}</p>

            <form onSubmit={handleGrantConsent} className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-medical-textMuted mb-1.5">{t('selectPhysician')}</label>
                <select required value={consentForm.doctorId} onChange={e => setConsentForm({ ...consentForm, doctorId: e.target.value })} className="w-full bg-medical-darkBg border border-medical-borderBg rounded-xl p-3 text-white outline-none focus:border-medical-teal text-base">
                  <option value="">-- Choose Doctor --</option>
                  {doctors.map(d => (
                    <option key={d.id} value={d.user.id}>Dr. {d.user.first_name} {d.user.last_name} ({d.specialty})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-medical-textMuted mb-1.5">{t('validityDuration')}</label>
                <select value={consentForm.hours} onChange={e => setConsentForm({ ...consentForm, hours: parseInt(e.target.value) })} className="w-full bg-medical-darkBg border border-medical-borderBg rounded-xl p-3 text-white outline-none focus:border-medical-teal text-base">
                  <option value="1">{t('oneHour')}</option>
                  <option value="12">{t('twelveHours')}</option>
                  <option value="24">{t('twentyFourHours')}</option>
                  <option value="48">{t('fortyEightHours')}</option>
                </select>
              </div>

              <button type="submit" className="w-full bg-gradient-to-r from-medical-teal to-medical-indigo text-white dark:text-medical-darkBg font-extrabold py-3.5 rounded-xl transition-all shadow text-base">
                {t('authorizeKey')}
              </button>
            </form>
          </div>

          {/* Consents List (Right) */}
          <div className="lg:col-span-2 glass-panel p-8 rounded-2xl border border-medical-borderBg space-y-6">
            <h3 className="text-xl font-bold text-slate-200 border-b border-slate-100 border-medical-borderBg pb-3 uppercase tracking-wider">{t('activeTokens')}</h3>

            <div className="space-y-4 max-h-[550px] overflow-y-auto pr-1">
              {consents.length === 0 ? (
                <p className="text-medical-textMuted text-center py-12 text-base">{t('emptyConsents')}</p>
              ) : (
                consents.map(con => (
                  <div key={con.id} className="bg-medical-cardBg bg-medical-darkBg/40 border border-slate-250 border-medical-borderBg rounded-xl p-5 flex justify-between items-center text-base">
                    <div>
                      <h4 className="font-bold text-white text-base">Dr. {con.doctor_details.first_name} {con.doctor_details.last_name}</h4>
                      <p className="text-xs text-medical-textMuted mt-1.5 flex items-center gap-1.5"><Clock className="w-4 h-4 text-medical-teal" /> Granted: {new Date(con.created_at).toLocaleString()}</p>
                      <p className="text-xs text-medical-textMuted mt-1 flex items-center gap-1.5"><Clock className="w-4 h-4 text-medical-rose" /> Expires: {new Date(con.expires_at).toLocaleString()}</p>
                    </div>
                    <div>
                      {con.granted ? (
                        <button onClick={() => handleRevokeConsent(con.id)} className="bg-medical-rose/10 text-medical-rose border border-medical-rose/20 hover:bg-medical-rose hover:text-white px-4 py-2 rounded-lg font-bold transition-all flex items-center gap-2 text-sm">
                          <Trash2 className="w-4.5 h-4.5" />
                          <span>{t('revokeAccess')}</span>
                        </button>
                      ) : (
                        <span className="text-xs bg-medical-darkBg border border-medical-borderBg px-3 py-1.5 rounded-lg text-medical-textMuted font-bold uppercase tracking-wider">{t('revoked')}</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 5. PHARMACY MEDICINE ORDERING */}
      {subView === 'pharmacy' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade">
          {/* Order Form (Left) */}
          <div className="glass-panel p-8 rounded-2xl border border-medical-borderBg h-fit">
            <h3 className="text-xl font-bold text-slate-200 mb-6 uppercase tracking-wider">{t('orderPrescription')}</h3>
            <form onSubmit={handlePlaceOrder} className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-medical-textMuted mb-1.5">Prescription Reference</label>
                <select value={selectedPrescId} onChange={e => setSelectedPrescId(e.target.value)} className="w-full bg-medical-darkBg border border-medical-borderBg rounded-xl p-3 text-white outline-none focus:border-medical-teal text-base">
                  <option value="">-- Over The Counter / Direct dispatch --</option>
                  {prescriptions.map(p => (
                    <option key={p.id} value={p.id}>Prescription #{p.id} (Diagnosis: {p.diagnosis})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-medical-textMuted mb-1.5">{t('deliveryAddress')}</label>
                <textarea required rows="3" placeholder="Enter delivery address in Bangladesh" value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)} className="w-full bg-medical-darkBg border border-medical-borderBg rounded-xl p-3 text-white outline-none focus:border-medical-teal text-base"></textarea>
              </div>

              <button type="submit" className="w-full bg-gradient-to-r from-medical-teal to-medical-indigo text-white dark:text-medical-darkBg font-extrabold py-3.5 rounded-xl transition-all shadow text-base">
                {t('confirmDispatch')}
              </button>
            </form>
          </div>

          {/* Orders log (Right) */}
          <div className="lg:col-span-2 glass-panel p-8 rounded-2xl border border-medical-borderBg space-y-6">
            <h3 className="text-xl font-bold text-slate-200 border-b border-slate-100 border-medical-borderBg pb-3 uppercase tracking-wider">{t('courierLogs')}</h3>

            <div className="space-y-4 max-h-[550px] overflow-y-auto pr-1">
              {orders.length === 0 ? (
                <p className="text-medical-textMuted text-center py-12 text-base">No orders placed in history.</p>
              ) : (
                orders.map(order => (
                  <div key={order.id} className="bg-medical-cardBg bg-medical-darkBg/40 border border-slate-250 border-medical-borderBg rounded-xl p-5 flex justify-between items-center text-base">
                    <div>
                      <h4 className="font-bold text-white text-base">Order #{order.id}</h4>
                      <p className="text-xs text-slate-450 mt-1.5 font-medium">Recipient: {order.patient_details?.first_name || user.username}</p>
                      <p className="text-xs text-slate-450 mt-1 font-medium">Address: {order.delivery_address}</p>
                      <p className="text-sm text-medical-textMain text-medical-textBody mt-2 font-bold">Estimated Cost: {order.total_price} BDT</p>
                    </div>
                    <span className={`px-3.5 py-1.5 rounded-full text-xs font-bold uppercase ${order.status === 'delivered' ? 'bg-medical-emerald/10 text-medical-emerald' : 'bg-medical-indigo/10 text-medical-indigo'}`}>
                      {order.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 6. AI POWERED HEALTH ASSISTANT */}
      {subView === 'ai' && (
        <div className="glass-panel p-8 rounded-2xl border border-medical-borderBg space-y-6 max-w-2xl mx-auto animate-fade">
          <div className="flex items-center gap-3 border-b border-slate-100 border-medical-borderBg pb-4">
            <div className="bg-medical-teal/15 p-2 rounded-xl text-medical-teal">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-medical-textMain dark:text-slate-200">{t('aiHeader')}</h3>
              <p className="text-xs text-medical-textMuted">{t('aiDisclaimer')}</p>
            </div>
          </div>

          {/* Chat message thread */}
          <div className="h-96 overflow-y-auto pr-1 space-y-4 flex flex-col">
            {aiMessages.map((msg, i) => (
              <div key={i} className={`p-4 rounded-xl max-w-[80%] leading-relaxed text-base ${msg.sender === 'ai' ? 'bg-medical-cardBg bg-medical-darkBg border border-medical-borderBg border-medical-borderBg self-start text-slate-750 dark:text-slate-350 font-medium' : 'bg-medical-teal/10 border border-medical-teal/15 text-teal-650 dark:text-medical-teal self-end font-medium'}`}>
                {msg.text}
              </div>
            ))}
          </div>

          {/* Message input */}
          <form onSubmit={handleSendAiMessage} className="flex gap-3 border-t border-slate-100 border-medical-borderBg pt-4">
            <input type="text" value={aiInput} onChange={e => setAiInput(e.target.value)} placeholder={t('aiPlaceholder')} className="flex-grow bg-medical-darkBg border border-medical-borderBg focus:border-medical-teal rounded-xl px-4 py-3 outline-none text-white text-base" />
            <button type="submit" className="bg-medical-teal text-white dark:text-medical-darkBg font-extrabold px-5 rounded-xl hover:bg-medical-teal/90 transition-all flex items-center justify-center">
              <Send className="w-5 h-5" />
            </button>
          </form>
        </div>
      )}

    </div>
  );
};
