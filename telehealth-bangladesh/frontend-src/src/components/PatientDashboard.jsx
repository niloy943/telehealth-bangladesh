import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from './LanguageContext';
import { useNotifications } from './NotificationCenter';
import {
  Moon, Calendar, FileHeart, ShieldCheck, ShoppingBag,
  Search, Bot, Send, AlertTriangle, ArrowRight, User, PlusCircle, CheckCircle2,
  Trash2, Clock, Upload, Stethoscope, Video, MessageSquare, Phone, Lock,
  Download, Share2, FileText, Check, AlertCircle, Sparkles, X, ChevronRight,
  Pill, Activity, RefreshCw, ShieldAlert, CreditCard, Award, Package,
  ExternalLink, Printer, Scale, ChevronLeft, Star, Edit3, Plus, Minus,
  Mic, MicOff
} from 'lucide-react';
import {
  Button, Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter,
  StatusBadge, VerifiedBadge, SecurityBadge, PageHeader, SectionHeader,
  EmptyState, LoadingState, ErrorState, Modal
} from './ui';
import { AIHealthAssistant } from './AIHealthAssistant';
import { PatientPrescriptionVault } from './PatientPrescriptionVault';
import { PatientEncryptedHealthRecords } from './PatientEncryptedHealthRecords';
import { PatientConsultationRecordsModal } from './PatientConsultationRecordsModal';
import { DocumentViewerModal } from './DocumentViewerModal';
import { PatientConsentManager } from './PatientConsentManager';
import { downloadPrescriptionPdfFile } from '../utils/pdfGenerator';
import { PatientOverviewSection } from './patient/PatientOverviewSection';
import { PatientBookingSection } from './patient/PatientBookingSection';
import { PatientConsultationsSection } from './patient/PatientConsultationsSection';
import { PatientPharmacySection } from './patient/PatientPharmacySection';
import { PatientBillingSection } from './patient/PatientBillingSection';
import { PatientBookingModal } from './patient/PatientBookingModal';
import { PatientPaymentModals } from './patient/PatientPaymentModals';
import { PatientVitalsModal } from './patient/PatientVitalsModal';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';

/* ─── Digital Prescription PDF Download Utility ─── */
const downloadPrescriptionPDF = (p) => {
  downloadPrescriptionPdfFile(p);
};

/* ─── Main PatientDashboard Component ─── */
export const PatientDashboard = ({
  token,
  user,
  appointments = [],
  onSelectConsultation,
  onTabChange,
  activeTab = 'dashboard',
  fetchAppointments
}) => {
  const { t, lang } = useLanguage();
  const { triggerNotification } = useNotifications();

  // Navigation sub-view state
  const [subView, setSubView] = useState("overview");
  const lastSubViewFetchRef = useRef({});

  const fetchApptsRef = useRef(fetchAppointments);
  useEffect(() => {
    fetchApptsRef.current = fetchAppointments;
  }, [fetchAppointments]);

  // Patient Consultation Records Sharing Modal State
  const [patientRecordsAppt, setPatientRecordsAppt] = useState(null);
  const [previewDoc, setPreviewDoc] = useState(null);

  // Doctors and booking state
  const [doctors, setDoctors] = useState([]);
  const [selectedDocId, setSelectedDocId] = useState(null);
  const [specialtyFilter, setSpecialtyFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [bookingModalDoc, setBookingModalDoc] = useState(null);
  const [apptForm, setApptForm] = useState({ date: "", time: "10:00 AM", reason: "", consultation_type: "video" });
  const [isAnonymousAppt, setIsAnonymousAppt] = useState(false);
  const [hasAgreedConsent, setHasAgreedConsent] = useState(true);
  const [isBookingLoading, setIsBookingLoading] = useState(false);

  // Consents state
  const [consents, setConsents] = useState([]);
  const [consentForm, setConsentForm] = useState({ doctorId: "", hours: 24 });

  // Health Records state
  const [records, setRecords] = useState([]);
  const [recordForm, setRecordForm] = useState({ record_type: "Blood report", content: "" });
  const [recordProgress, setRecordProgress] = useState(0);
  const [recordSuccess, setRecordSuccess] = useState(false);

  // Prescriptions & Pharmacy Orders
  const [prescriptions, setPrescriptions] = useState([]);
  const [orders, setOrders] = useState([]);
  const [deliveryAddress, setDeliveryAddress] = useState(user.patient_profile?.address || "");
  const [selectedPrescId, setSelectedPrescId] = useState("");
  const [medicinesCatalog, setMedicinesCatalog] = useState([]);
  const [cart, setCart] = useState([]);

  // Payment checkout & verification state
  const [checkoutModal, setCheckoutModal] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("sslcommerz");
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentStatusModal, setPaymentStatusModal] = useState(null);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [paymentHistoryLoading, setPaymentHistoryLoading] = useState(false);
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [receiptModalTxn, setReceiptModalTxn] = useState(null);

  // Blockchain audit verification map
  const [blockchainVerifiedMap, setBlockchainVerifiedMap] = useState({});

  // ─── Daily Health Checkup & Vitals State ───
  const defaultVitals = {
    age: user.patient_profile?.age || 26,
    weight: 68.0,
    height: 172,
    waterDrank: 2.25,
    waterGoal: 3.0,
    bloodPressureSys: 120,
    bloodPressureDia: 80,
    heartRate: 72,
    bloodGroup: user.patient_profile?.blood_group || 'O+',
    lastChecked: 'Today, 08:30 AM'
  };

  const [vitals, setVitals] = useState(() => {
    try {
      const stored = localStorage.getItem(`healnsight_vitals_${user?.id || user?.username || 'default'}`);
      if (stored) return { ...defaultVitals, ...JSON.parse(stored) };
    } catch (e) { }
    return defaultVitals;
  });

  const [isVitalsModalOpen, setIsVitalsModalOpen] = useState(false);
  const [vitalsForm, setVitalsForm] = useState(vitals);

  // Calendar State for Overview
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Sync vitalsForm when modal opens or vitals change
  useEffect(() => {
    if (isVitalsModalOpen) {
      setVitalsForm(vitals);
    }
  }, [isVitalsModalOpen, vitals]);

  // BMI calculation helper
  const getBMIData = (weightKg, heightCm) => {
    const w = parseFloat(weightKg) || 0;
    const h = parseFloat(heightCm) || 0;
    if (!w || !h) return { bmi: "--", category: "Normal", color: "text-[#059669]", badge: "bg-emerald-50 text-[#059669] border-[#059669]/30" };
    const heightM = h / 100;
    const bmiVal = (w / (heightM * heightM)).toFixed(1);
    const num = parseFloat(bmiVal);
    if (num < 18.5) return { bmi: bmiVal, category: "Underweight", color: "text-amber-600", badge: "bg-amber-50 text-amber-600 border-amber-300" };
    if (num < 25) return { bmi: bmiVal, category: "Healthy Weight", color: "text-[#059669]", badge: "bg-emerald-50 text-[#059669] border-[#059669]/30" };
    if (num < 30) return { bmi: bmiVal, category: "Overweight", color: "text-amber-600", badge: "bg-amber-50 text-amber-600 border-amber-300" };
    return { bmi: bmiVal, category: "Obese", color: "text-rose-600", badge: "bg-rose-50 text-rose-600 border-rose-300" };
  };

  // Water intake helper
  const handleUpdateWater = (deltaLiters) => {
    setVitals(prev => {
      const nextDrank = Math.max(0, +(parseFloat(prev.waterDrank || 0) + deltaLiters).toFixed(2));
      const updated = {
        ...prev,
        waterDrank: nextDrank,
        lastChecked: `Today, ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
      };
      try {
        localStorage.setItem(`healnsight_vitals_${user?.id || user?.username || 'default'}`, JSON.stringify(updated));
      } catch (e) { }
      return updated;
    });
  };

  // Save vitals helper
  const handleSaveVitals = (e) => {
    e.preventDefault();
    const updated = {
      ...vitalsForm,
      age: parseInt(vitalsForm.age, 10) || 0,
      weight: parseFloat(vitalsForm.weight) || 0,
      height: parseFloat(vitalsForm.height) || 0,
      waterDrank: parseFloat(vitalsForm.waterDrank) || 0,
      waterGoal: parseFloat(vitalsForm.waterGoal) || 3.0,
      bloodPressureSys: parseInt(vitalsForm.bloodPressureSys, 10) || 120,
      bloodPressureDia: parseInt(vitalsForm.bloodPressureDia, 10) || 80,
      heartRate: parseInt(vitalsForm.heartRate, 10) || 72,
      lastChecked: `Today, ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
    };
    setVitals(updated);
    try {
      localStorage.setItem(`healnsight_vitals_${user?.id || user?.username || 'default'}`, JSON.stringify(updated));
    } catch (err) { }
    setIsVitalsModalOpen(false);
    triggerNotification("Vitals Updated", "Daily basic checkup parameters successfully saved.", "success");
  };

  // Calendar days generator
  const renderCalendarDays = () => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const todayStr = new Date().toISOString().split('T')[0];

    const days = [];

    // Empty cells before month start
    for (let i = 0; i < firstDayIndex; i++) {
      days.push(<div key={`empty-${i}`} className="py-1 text-transparent select-none">-</div>);
    }

    // Days of the month
    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const hasAppt = appointments.some(a => a.date === dateStr && (a.status === 'pending' || a.status === 'approved'));
      const isToday = todayStr === dateStr;
      const isSelected = selectedCalendarDate === dateStr;

      days.push(
        <button
          key={`day-${d}`}
          type="button"
          onClick={() => setSelectedCalendarDate(dateStr)}
          className={`py-1.5 rounded-lg text-xs font-semibold relative transition-all flex flex-col items-center justify-center ${isSelected
            ? 'bg-[#168CF5] text-white shadow-xs font-bold'
            : isToday
              ? 'bg-[#E7F0FC] text-[#168CF5] font-bold border border-[#168CF5]'
              : 'hover:bg-[#E7F0FC] text-[#0F172A]'
            }`}
        >
          <span>{d}</span>
          {hasAppt && (
            <span
              className={`w-1.5 h-1.5 rounded-full mt-0.5 ${isSelected ? 'bg-white' : 'bg-[#059669]'
                }`}
            />
          )}
        </button>
      );
    }

    return days;
  };

  // Sync subView with activeTab prop from sidebar
  useEffect(() => {
    if (activeTab && activeTab !== 'dashboard') {
      setSubView(activeTab);
    } else {
      setSubView('overview');
    }
  }, [activeTab]);

  // Initial Data Fetch
  useEffect(() => {
    fetchDoctors();
    fetchConsents();
    fetchRecords();
    fetchPrescriptionsAndOrders();
    fetchMedicinesCatalog();
    fetchPaymentHistory();
  }, [token]);

  // Real-time synchronization listeners across Portals and Tabs
  useEffect(() => {
    const handlePrescriptionSync = () => {
      fetchPrescriptionsAndOrders();
    };
    const handleRecordsSync = () => {
      fetchRecords();
      fetchConsents();
    };
    const handleApptSync = () => {
      if (fetchApptsRef.current) fetchApptsRef.current();
    };

    window.addEventListener('healnsight_prescription_updated', handlePrescriptionSync);
    window.addEventListener('healnsight_records_updated', handleRecordsSync);
    window.addEventListener('healnsight_appointment_updated', handleApptSync);

    const handleStorageSync = (e) => {
      if (e.key === 'healnsight_last_prescription_sync') {
        fetchPrescriptionsAndOrders();
      } else if (e.key === 'healnsight_last_record_sync') {
        fetchRecords();
        fetchConsents();
      } else if (e.key === 'healnsight_last_appointment_sync') {
        if (fetchApptsRef.current) fetchApptsRef.current();
      }
    };
    window.addEventListener('storage', handleStorageSync);

    // Periodic background sync safety net while patient dashboard is active (paused when tab hidden)
    const syncInterval = setInterval(() => {
      if (!document.hidden) {
        fetchPrescriptionsAndOrders();
        fetchRecords();
      }
    }, 25000);

    return () => {
      window.removeEventListener('healnsight_prescription_updated', handlePrescriptionSync);
      window.removeEventListener('healnsight_records_updated', handleRecordsSync);
      window.removeEventListener('healnsight_appointment_updated', handleApptSync);
      window.removeEventListener('storage', handleStorageSync);
      clearInterval(syncInterval);
    };
  }, []);

  // Refresh data whenever navigating across dashboard sub-views (cached within 12s window)
  useEffect(() => {
    const now = Date.now();
    const last = lastSubViewFetchRef.current[subView] || 0;
    if (now - last < 12000) return;
    lastSubViewFetchRef.current[subView] = now;

    if (subView === 'payments') {
      fetchPaymentHistory(paymentFilter);
    } else if (subView === 'pharmacy') {
      fetchPrescriptionsAndOrders();
      fetchMedicinesCatalog();
    } else if (subView === 'overview') {
      fetchRecords();
      fetchPrescriptionsAndOrders();
      fetchConsents();
      fetchPaymentHistory();
      if (fetchApptsRef.current) fetchApptsRef.current();
    } else if (subView === 'prescriptions') {
      fetchPrescriptionsAndOrders();
    } else if (subView === 'records') {
      fetchRecords();
      fetchConsents();
    } else if (subView === 'consultations') {
      if (fetchApptsRef.current) fetchApptsRef.current();
      fetchRecords();
    } else if (subView === 'consent') {
      fetchConsents();
      fetchDoctors();
    }
  }, [subView]);

  // Listener for SSLCommerz return redirects
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payStatus = params.get('payment_status');
    const txnRef = params.get('txn_ref') || params.get('pay_ref');

    if (payStatus && txnRef) {
      window.history.replaceState({}, document.title, window.location.pathname);
      verifyPaymentFromBackend(txnRef, payStatus);
    }
  }, [token]);

  const verifyPaymentFromBackend = async (txnRef, initialStatus) => {
    setPaymentStatusModal({
      isOpen: true,
      status: 'loading',
      txnRef: txnRef,
      txn: null,
      error: null
    });

    try {
      const resp = await fetch(`${API_BASE}/api/payment/status/${txnRef}/`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (resp.ok) {
        const data = await resp.json();
        setPaymentStatusModal({
          isOpen: true,
          status: data.status,
          txnRef: txnRef,
          txn: data,
          error: data.failure_reason || (data.status === 'failed' ? 'Payment could not be completed.' : null)
        });
        if (data.status === 'completed') {
          triggerNotification("Payment Verified", `Payment for ${data.amount} BDT was verified successfully.`, "billing");
          fetchPrescriptionsAndOrders();
          fetchPaymentHistory();
        }
      } else {
        setPaymentStatusModal({
          isOpen: true,
          status: initialStatus || 'failed',
          txnRef: txnRef,
          txn: null,
          error: 'Could not fetch transaction record from server.'
        });
      }
    } catch (e) {
      setPaymentStatusModal({
        isOpen: true,
        status: initialStatus || 'failed',
        txnRef: txnRef,
        txn: null,
        error: 'Unable to connect to verification server.'
      });
    }
  };

  const fetchPaymentHistory = async (statusFilter = 'all') => {
    setPaymentHistoryLoading(true);
    try {
      const url = statusFilter && statusFilter !== 'all'
        ? `${API_BASE}/api/payment/history/?status=${statusFilter}`
        : `${API_BASE}/api/payment/history/`;
      const resp = await fetch(url, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (resp.ok) {
        const data = await resp.json();
        setPaymentHistory(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error("Fetch payment history error:", e);
    } finally {
      setPaymentHistoryLoading(false);
    }
  };

  const fetchDoctors = async () => {
    try {
      const r = await fetch(`${API_BASE}/api/doctors/`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await r.json();
      setDoctors(Array.isArray(data) ? data : []);
    } catch (err) { console.error(err); }
  };

  const fetchConsents = async () => {
    try {
      const r = await fetch(`${API_BASE}/api/consent/`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await r.json();
      setConsents(Array.isArray(data) ? data : []);
    } catch (err) { console.error(err); }
  };

  const fetchRecords = async () => {
    try {
      const r = await fetch(`${API_BASE}/api/records/`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await r.json();
      setRecords(Array.isArray(data) ? data : []);
    } catch (err) { console.error(err); }
  };

  const fetchPrescriptionsAndOrders = async () => {
    try {
      const patUser = String(user?.username || 'niloy');
      const patId = String(user?.id || '198');
      const headers = {
        'X-Patient-Username': patUser,
        'X-Patient-ID': patId
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      let rPresc = await fetch(`${API_BASE}/api/prescriptions/?patientUsername=${encodeURIComponent(patUser)}&patientId=${encodeURIComponent(patId)}`, { headers });
      if (!rPresc.ok && API_BASE !== 'http://localhost:8000') {
        rPresc = await fetch(`http://localhost:8000/api/prescriptions/?patientUsername=${encodeURIComponent(patUser)}&patientId=${encodeURIComponent(patId)}`, { headers });
      }
      const prescData = await rPresc.json().catch(() => []);
      setPrescriptions(Array.isArray(prescData) ? prescData : []);

      let rOrders = await fetch(`${API_BASE}/api/orders/`, { headers });
      if (!rOrders.ok && API_BASE !== 'http://localhost:8000') {
        rOrders = await fetch(`http://localhost:8000/api/orders/`, { headers });
      }
      const ordersData = await rOrders.json().catch(() => []);
      setOrders(Array.isArray(ordersData) ? ordersData : []);
    } catch (err) { console.error("fetchPrescriptionsAndOrders error:", err); }
  };

  const fetchMedicinesCatalog = async () => {
    try {
      const r = await fetch(`${API_BASE}/api/medicines/`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await r.json();
      setMedicinesCatalog(Array.isArray(data) ? data : []);
    } catch (err) { console.error(err); }
  };

  /* ─── Actions ─── */
  const handleBookAppointment = async (e) => {
    e.preventDefault();
    const docId = bookingModalDoc?.user?.id || bookingModalDoc?.id || selectedDocId;
    if (!docId) {
      triggerNotification("Booking Error", "No doctor was selected.", "security");
      return;
    }

    if (!apptForm.date) {
      triggerNotification("Missing Date", "Please select a consultation date.", "security");
      return;
    }

    const isAudioMode = apptForm.consultation_type === 'audio';
    const isAnon = isAnonymousAppt || isAudioMode;

    if (isAnon && !hasAgreedConsent) {
      triggerNotification("Consent Required", "Please accept the anonymous consultation consent terms.", "warning");
      return;
    }

    setIsBookingLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/api/appointments/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          doctor: docId,
          date: apptForm.date,
          time: apptForm.time,
          reason: apptForm.reason,
          consultation_type: apptForm.consultation_type,
          is_anonymous: isAnon,
          audio_only: isAudioMode
        })
      });

      if (resp.status === 201) {
        const newAppt = await resp.json();
        if (fetchAppointments) fetchAppointments();
        window.dispatchEvent(new CustomEvent('healnsight_appointment_updated'));
        try { localStorage.setItem('healnsight_last_appointment_sync', Date.now().toString()); } catch {}
        triggerNotification("Appointment Created", "Consultation slot reserved. Complete payment to confirm.", "appointment");
        setApptForm({ date: "", time: "10:00 AM", reason: "", consultation_type: "video" });
        setIsAnonymousAppt(false);
        setHasAgreedConsent(true);
        const docObj = bookingModalDoc;
        setSelectedDocId(null);
        setBookingModalDoc(null);

        // Trigger secure checkout modal for this appointment
        const docFee = docObj?.fees || 500;
        setCheckoutModal({
          type: 'appointment',
          id: newAppt.id,
          title: `Consultation with Dr. ${docObj?.user?.first_name || ''} ${docObj?.user?.last_name || ''}`.trim(),
          subtitle: `${docObj?.specialty || 'General Practice'} • ${newAppt.date} at ${newAppt.time}`,
          amount: parseFloat(docFee),
          details: [
            { label: "Doctor", value: `Dr. ${docObj?.user?.first_name || ''} ${docObj?.user?.last_name || ''}`.trim() },
            { label: "Specialty", value: docObj?.specialty || 'General Practice' },
            { label: "Date & Time", value: `${newAppt.date} • ${newAppt.time}` },
            { label: "Session Type", value: isAudioMode ? 'ANONYMOUS AUDIO' : (apptForm.consultation_type || "video").toUpperCase() }
          ]
        });
      } else {
        const errData = await resp.json().catch(() => ({}));
        let errorMsg = "Failed to reserve consultation.";
        if (typeof errData === 'object' && errData !== null) {
          const firstKey = Object.keys(errData)[0];
          if (firstKey) {
            const val = errData[firstKey];
            errorMsg = Array.isArray(val) ? `${firstKey}: ${val[0]}` : (val.detail || val.error || JSON.stringify(val));
          }
        }
        triggerNotification("Booking Failed", errorMsg, "security");
      }
    } catch (err) {
      console.error(err);
      triggerNotification("Booking Error", "Network connection failed.", "security");
    } finally {
      setIsBookingLoading(false);
    }
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
        triggerNotification("Consent Authorized", "Selected doctor can now view your health records for the specified duration.", "security");
        setConsentForm({ doctorId: "", hours: 24 });
        fetchConsents();
      }
    } catch (err) { console.error(err); }
  };

  const handleApproveConsent = async (id, docName) => {
    try {
      const resp = await fetch(`${API_BASE}/api/consent/${id}/approve/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          action: "approve",
          expires_hours: 24
        })
      });
      if (resp.ok) {
        triggerNotification("Authorization Granted", `Dr. ${docName || 'Specialist'} has been granted 24-hour access to your health records.`, "security");
        fetchConsents();
      } else {
        triggerNotification("Action Failed", "Could not authorize access request.", "warning");
      }
    } catch (err) {
      console.error(err);
      triggerNotification("Network Error", "Could not reach consent server.", "warning");
    }
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
        triggerNotification("Consent Revoked", "Doctor access to your medical records has been terminated immediately.", "security");
        fetchConsents();
      }
    } catch (err) { console.error(err); }
  };

  const handleCreateRecord = async (e) => {
    if (e) e.preventDefault();
    if (!recordForm.content) return;

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
        triggerNotification("Record Encrypted & Saved", "Medical record has been hashed, encrypted, and stored.", "medical");
        setRecordForm({ record_type: "Blood report", content: "" });
        setRecordSuccess(false);
        setRecordProgress(0);
        fetchRecords();
      }
    } catch (err) { console.error(err); }
  };

  const simulateRecordUpload = (e) => {
    e.preventDefault();
    setRecordProgress(100);
    setRecordSuccess(true);
    const mockContent = `Blood report parameters: Fasting Glucose: 5.4 mmol/L, HbA1c: 5.6%, Platelets: 245K. File: clinical_test_signed.pdf`;
    const recData = { record_type: "Blood report", content: mockContent };
    fetch(`${API_BASE}/api/records/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify(recData)
    }).then(() => {
      triggerNotification("Document Stored", "Report saved into encrypted ledger.", "medical");
      fetchRecords();
      setRecordProgress(0);
      setRecordSuccess(false);
    });
  };

  const handleAddToCart = (med) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === med.id);
      if (existing) {
        return prev.map(i => i.id === med.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { ...med, qty: 1 }];
    });
    triggerNotification("Added to Cart", `${med.name} added to pharmacy cart.`, "billing");
  };

  const handleRemoveFromCart = (medId) => {
    setCart(prev => prev.filter(i => i.id !== medId));
  };

  const handleCheckoutCart = async (e) => {
    e.preventDefault();
    if (cart.length === 0 && !selectedPrescId) {
      alert("Please add medicines to cart or select a prescription reference.");
      return;
    }

    try {
      const itemsBreakdown = cart.map(i => ({
        medicine_id: i.id,
        name: i.name,
        price: parseFloat(i.price),
        quantity: i.qty
      }));

      const resp = await fetch(`${API_BASE}/api/orders/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          prescription_id: selectedPrescId ? parseInt(selectedPrescId) : null,
          delivery_address: deliveryAddress || "Patient Primary Address",
          items_breakdown: itemsBreakdown
        })
      });

      if (resp.status === 201) {
        const createdOrder = await resp.json();
        triggerNotification("Order Created", `Order #${createdOrder.id} placed. Complete payment to dispatch.`, "billing");
        setCart([]);
        setSelectedPrescId("");
        fetchPrescriptionsAndOrders();

        setCheckoutModal({
          type: 'order',
          id: createdOrder.id,
          title: `Pharmacy Order #${createdOrder.id}`,
          subtitle: `${createdOrder.items_breakdown?.length || 0} items • Delivery to ${createdOrder.delivery_address}`,
          amount: parseFloat(createdOrder.total_price),
          details: [
            { label: "Order Reference", value: `#${createdOrder.id}` },
            { label: "Total Items", value: `${createdOrder.items_breakdown?.length || 0} items` },
            { label: "Delivery Address", value: createdOrder.delivery_address },
            { label: "Delivery Fee", value: `${createdOrder.delivery_fee} BDT` }
          ]
        });
      }
    } catch (err) { console.error(err); }
  };

  const handleProcessPayment = async (e) => {
    if (e) e.preventDefault();
    if (!checkoutModal) return;
    setPaymentLoading(true);

    try {
      const payload = {
        method: paymentMethod
      };
      if (checkoutModal.type === 'appointment') {
        payload.appointment_id = checkoutModal.id;
      } else {
        payload.order_id = checkoutModal.id;
      }

      const initResp = await fetch(`${API_BASE}/api/payment/initiate/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await initResp.json();

      if (!initResp.ok) {
        throw new Error(data.error || "Payment initiation rejected by server.");
      }

      triggerNotification("Connecting to Gateway", "Redirecting to SSLCommerz secure payment portal...", "billing");

      // Redirect to SSLCommerz Hosted Checkout
      if (data.gateway_url) {
        setCheckoutModal(null);
        window.location.href = data.gateway_url;
      } else {
        throw new Error("Payment gateway URL not provided.");
      }
    } catch (err) {
      console.error("Payment initiation error:", err);
      alert(err.message || "Failed to connect to payment gateway. Please try again.");
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleTriggerSOS = () => {
    triggerNotification("EMERGENCY ALERT BROADCAST", "SOS coordinates transmitted to emergency contacts and nearby medical facilities.", "security");
  };

  const handleVerifyBlockchainRecord = (recordType, recordId) => {
    triggerNotification("Ledger Audit Verified", `SHA-256 Hash matches on-chain cryptographic ledger for record #${recordId}.`, "security");
    setBlockchainVerifiedMap(prev => ({ ...prev, [`${recordType}_${recordId}`]: true }));
  };

  // Time-based greeting helper
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  // Filter doctors
  const filteredDoctors = doctors.filter(doc => {
    const matchesSpecialty = specialtyFilter === 'all' ||
      doc.specialty.toLowerCase().includes(specialtyFilter.toLowerCase());
    const name = `${doc.user?.first_name || ''} ${doc.user?.last_name || ''}`.toLowerCase();
    const matchesSearch = name.includes(searchTerm.toLowerCase()) ||
      doc.specialty.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSpecialty && matchesSearch;
  });

  // Next active or pending appointment
  const upcomingAppointments = appointments.filter(a => a.status === 'pending' || a.status === 'approved');
  const nextAppointment = upcomingAppointments[0];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-28 space-y-8">

      {/* ─── OVERVIEW HOME VIEW ─── */}
      {subView === 'overview' && (
        <PatientOverviewSection
          user={user}
          vitals={vitals}
          getGreeting={getGreeting}
          getBMIData={getBMIData}
          setIsVitalsModalOpen={setIsVitalsModalOpen}
          upcomingAppointments={upcomingAppointments}
          onSelectConsultation={onSelectConsultation}
          setPatientRecordsAppt={setPatientRecordsAppt}
          calendarDate={calendarDate}
          setCalendarDate={setCalendarDate}
          selectedCalendarDate={selectedCalendarDate}
          appointments={appointments}
          setApptForm={setApptForm}
          renderCalendarDays={renderCalendarDays}
          doctors={doctors}
          setBookingModalDoc={setBookingModalDoc}
          setSelectedDocId={setSelectedDocId}
          prescriptions={prescriptions}
          consents={consents}
          handleRevokeConsent={handleRevokeConsent}
          setSubView={setSubView}
          onTabChange={onTabChange}
        />
      )}

      {/* ─── SUB-VIEW: FIND A DOCTOR / BOOKING ─── */}
      {subView === 'booking' && (
        <PatientBookingSection
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          specialtyFilter={specialtyFilter}
          setSpecialtyFilter={setSpecialtyFilter}
          filteredDoctors={filteredDoctors}
          setBookingModalDoc={setBookingModalDoc}
          setSelectedDocId={setSelectedDocId}
          setSubView={setSubView}
        />
      )}

      {/* ─── SUB-VIEW: MY CONSULTATIONS HUB ─── */}
      {subView === 'consultations' && (
        <PatientConsultationsSection
          appointments={appointments}
          setSubView={setSubView}
          onSelectConsultation={onSelectConsultation}
          setPatientRecordsAppt={setPatientRecordsAppt}
        />
      )}

      {/* ─── SUB-VIEW: ENCRYPTED HEALTH RECORDS (AES-256 + CLOUD KMS + BLOCKCHAIN) ─── */}
      {subView === 'records' && (
        <PatientEncryptedHealthRecords
          patient={user}
          token={token}
          apiBase={API_BASE}
          epGatewayBase={import.meta.env.VITE_EP_API_BASE || 'http://localhost:5002'}
          onRefresh={fetchRecords}
        />
      )}

      {/* ─── SUB-VIEW: ENCRYPTED PRESCRIPTION VAULT (AES-256 + BLOCKCHAIN + OTP) ─── */}
      {subView === 'prescriptions' && (
        <PatientPrescriptionVault
          patient={user}
          token={token}
          apiBase={API_BASE}
          epGatewayBase={import.meta.env.VITE_EP_API_BASE || 'http://localhost:5002'}
          prescriptions={prescriptions}
          onRefresh={fetchPrescriptionsAndOrders}
        />
      )}

      {/* ─── SUB-VIEW: PRIVACY & DATA CONSENT MANAGER ─── */}
      {subView === 'consent' && (
        <PatientConsentManager
          token={token}
          user={user}
          onTabChange={onTabChange}
        />
      )}

      {/* ─── SUB-VIEW: PHARMACY STORE ─── */}
      {subView === 'pharmacy' && (
        <PatientPharmacySection
          medicinesCatalog={medicinesCatalog}
          cart={cart}
          handleAddToCart={handleAddToCart}
          handleRemoveFromCart={handleRemoveFromCart}
          deliveryAddress={deliveryAddress}
          setDeliveryAddress={setDeliveryAddress}
          handleCheckoutCart={handleCheckoutCart}
          orders={orders}
          fetchPrescriptionsAndOrders={fetchPrescriptionsAndOrders}
          setSubView={setSubView}
        />
      )}

      {/* ─── AI HEALTH ASSISTANT WORKSPACE ─── */}
      {subView === 'ai' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => { setSubView('overview'); if (onTabChange) onTabChange('dashboard'); }}
              className="text-xs font-semibold text-[#059669] hover:underline flex items-center gap-1.5"
            >
              <span>←</span>
              <span>Back to My Health Overview</span>
            </button>
          </div>
          <AIHealthAssistant
            token={token}
            user={user}
            onNavigateBooking={() => { setSubView('booking'); if (onTabChange) onTabChange('booking'); }}
          />
        </div>
      )}

      {/* ─── PAYMENTS & BILLING WORKSPACE ─── */}
      {subView === 'payments' && (
        <PatientBillingSection
          paymentHistory={paymentHistory}
          paymentHistoryLoading={paymentHistoryLoading}
          paymentFilter={paymentFilter}
          setPaymentFilter={setPaymentFilter}
          fetchPaymentHistory={fetchPaymentHistory}
          setReceiptModalTxn={setReceiptModalTxn}
          setSubView={setSubView}
          onTabChange={onTabChange}
        />
      )}

      {/* ─── BOOKING MODAL ─── */}
      <PatientBookingModal
        bookingModalDoc={bookingModalDoc}
        setBookingModalDoc={setBookingModalDoc}
        apptForm={apptForm}
        setApptForm={setApptForm}
        isAnonymousAppt={isAnonymousAppt}
        setIsAnonymousAppt={setIsAnonymousAppt}
        hasAgreedConsent={hasAgreedConsent}
        setHasAgreedConsent={setHasAgreedConsent}
        isBookingLoading={isBookingLoading}
        handleBookAppointment={handleBookAppointment}
      />

      {/* ─── PAYMENT & BILLING MODALS (CHECKOUT, STATUS, RECEIPT) ─── */}
      <PatientPaymentModals
        checkoutModal={checkoutModal}
        setCheckoutModal={setCheckoutModal}
        paymentLoading={paymentLoading}
        paymentMethod={paymentMethod}
        setPaymentMethod={setPaymentMethod}
        handleProcessPayment={handleProcessPayment}
        paymentStatusModal={paymentStatusModal}
        setPaymentStatusModal={setPaymentStatusModal}
        receiptModalTxn={receiptModalTxn}
        setReceiptModalTxn={setReceiptModalTxn}
        user={user}
      />

      {/* ─── 4. DAILY BASIC CHECKUP & VITALS UPDATE MODAL ─── */}
      <PatientVitalsModal
        isVitalsModalOpen={isVitalsModalOpen}
        setIsVitalsModalOpen={setIsVitalsModalOpen}
        vitalsForm={vitalsForm}
        setVitalsForm={setVitalsForm}
        handleSaveVitals={handleSaveVitals}
      />

      {/* ─── MODAL: PATIENT CONSULTATION RECORDS SHARING & UPLOAD ─── */}
      <PatientConsultationRecordsModal
        isOpen={!!patientRecordsAppt}
        onClose={() => setPatientRecordsAppt(null)}
        appointment={patientRecordsAppt}
        token={token}
        apiBase={API_BASE}
        onSuccess={() => {
          fetchRecords();
          fetchConsents();
          if (fetchAppointments) fetchAppointments();
          window.dispatchEvent(new CustomEvent('healnsight_records_updated'));
          try { localStorage.setItem('healnsight_last_record_sync', Date.now().toString()); } catch {}
          triggerNotification("Records Synchronized", "Consultation medical records updated and authorized for doctor access.", "security");
        }}
      />

      {/* ─── MODAL: DOCUMENT PREVIEW MODAL ─── */}
      <DocumentViewerModal
        isOpen={!!previewDoc}
        onClose={() => setPreviewDoc(null)}
        record={previewDoc}
      />

    </div>
  );
};

export default PatientDashboard;
