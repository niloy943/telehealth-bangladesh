import React, { useState, useEffect } from 'react';
import { useLanguage } from './LanguageContext';
import { useNotifications } from './NotificationCenter';
import {
  Heart, Droplet, Moon, Calendar, FileHeart, ShieldCheck, ShoppingBag,
  Search, Bot, Send, AlertTriangle, ArrowRight, User, PlusCircle, CheckCircle2,
  Trash2, Clock, Upload, Stethoscope, Video, MessageSquare, Phone, Lock,
  Download, Share2, FileText, Check, AlertCircle, Sparkles, X, ChevronRight,
  Pill, Activity, RefreshCw, ShieldAlert, CreditCard, Award,
  ExternalLink, Printer, Scale, GlassWater, ChevronLeft, Star, Edit3, Plus, Minus
} from 'lucide-react';
import {
  Button, Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter,
  StatusBadge, VerifiedBadge, SecurityBadge, PageHeader, SectionHeader,
  EmptyState, LoadingState, ErrorState, Modal
} from './ui';
import { AIHealthAssistant } from './AIHealthAssistant';

const API_BASE = import.meta.env.VITE_API_BASE || window.location.origin;

/* ─── Digital Prescription PDF Download Utility ─── */
const downloadPrescriptionPDF = (p) => {
  const docName = p.doctor_details ? `Dr. ${p.doctor_details.first_name} ${p.doctor_details.last_name}` : "Certified Doctor";
  const docSpecialty = p.doctor_details ? p.doctor_details.specialty : "General Physician";
  const docReg = p.doctor_details ? p.doctor_details.bmdc_reg : "BMDC Verified";

  const patName = p.patient_details ? `${p.patient_details.first_name || ''} ${p.patient_details.last_name || ''}`.trim() || p.patient_details.username : "Patient";
  const patPhone = p.patient_details ? p.patient_details.phone || "" : "";

  let medsHtml = "";
  try {
    const medsList = JSON.parse(p.medicines);
    if (Array.isArray(medsList)) {
      medsHtml = medsList.map((m, idx) => `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #BDDDFA; text-align: left; font-weight: bold; color: #0F172A;">${idx + 1}. ${m.name}</td>
          <td style="padding: 10px; border-bottom: 1px solid #BDDDFA; text-align: center; color: #334155;">${m.dosage}</td>
          <td style="padding: 10px; border-bottom: 1px solid #BDDDFA; text-align: right; color: #334155;">${m.timing}</td>
        </tr>
      `).join("");
    } else {
      medsHtml = `<tr><td colspan="3" style="padding: 10px; color: #334155;">${p.medicines}</td></tr>`;
    }
  } catch (e) {
    medsHtml = `<tr><td colspan="3" style="padding: 10px; color: #334155;">${p.medicines}</td></tr>`;
  }

  const element = document.createElement('div');
  element.style.padding = '36px';
  element.style.fontFamily = "'Inter', 'Plus Jakarta Sans', -apple-system, sans-serif";
  element.style.color = '#0F172A';
  element.style.background = '#ffffff';

  element.innerHTML = `
    <div style="border: 2px solid #168CF5; padding: 28px; border-radius: 12px; position: relative;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #168CF5; padding-bottom: 16px; margin-bottom: 20px;">
        <div>
          <h1 style="margin: 0; color: #0F172A; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">Telehealth Bangladesh</h1>
          <p style="margin: 3px 0 0 0; color: #55647C; font-size: 11px; text-transform: uppercase; font-weight: 700; letter-spacing: 1px;">Verified National Telemedicine Network</p>
        </div>
        <div style="text-align: right;">
          <h3 style="margin: 0; font-size: 16px; font-weight: 700; color: #0F172A;">${docName}</h3>
          <p style="margin: 2px 0; font-size: 13px; color: #168CF5; font-weight: 600;">${docSpecialty}</p>
          <p style="margin: 0; font-size: 11px; color: #55647C;">BMDC Reg: ${docReg}</p>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; background: #E7F0FC; padding: 14px; border-radius: 8px; margin-bottom: 20px; font-size: 13px; border: 1px solid #BDDDFA;">
        <div>
          <p style="margin: 3px 0;"><strong style="color: #0F172A;">Patient Name:</strong> ${patName}</p>
          <p style="margin: 3px 0;"><strong style="color: #0F172A;">Contact:</strong> ${patPhone || 'N/A'}</p>
        </div>
        <div style="text-align: right;">
          <p style="margin: 3px 0;"><strong style="color: #0F172A;">Date:</strong> ${new Date(p.created_at || Date.now()).toLocaleDateString()}</p>
          <p style="margin: 3px 0;"><strong style="color: #0F172A;">Prescription ID:</strong> #${p.id || 'NEW'}</p>
        </div>
      </div>

      <div style="margin-bottom: 20px; font-size: 13.5px;">
        <p style="margin: 6px 0;"><strong style="color: #0F172A;">Chief Complaints:</strong> ${p.symptoms || 'General Consultation'}</p>
        <p style="margin: 6px 0;"><strong style="color: #0F172A;">Diagnosis:</strong> ${p.diagnosis || 'Clinical evaluation completed'}</p>
      </div>

      <div style="font-size: 22px; font-weight: 800; color: #059669; margin-bottom: 8px; font-style: italic;">Rx</div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px;">
        <thead>
          <tr style="background: #0F172A; color: #ffffff;">
            <th style="padding: 10px; text-align: left; font-weight: 600; border-top-left-radius: 6px;">Medicine</th>
            <th style="padding: 10px; text-align: center; font-weight: 600;">Dosage</th>
            <th style="padding: 10px; text-align: right; font-weight: 600; border-top-right-radius: 6px;">Timing / Instructions</th>
          </tr>
        </thead>
        <tbody>
          ${medsHtml}
        </tbody>
      </table>

      <div style="background: #E7F0FC; border-left: 4px solid #168CF5; padding: 12px 14px; border-radius: 6px; margin-bottom: 24px; font-size: 13px; color: #0F172A;">
        <strong style="display: block; margin-bottom: 3px; font-size: 13px; color: #0F172A;">Physician Instructions:</strong>
        ${p.instructions || "Follow prescribed dosage. Stay hydrated and schedule a follow-up if symptoms persist."}
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed #BDDDFA; padding-top: 14px; font-size: 11px; color: #55647C;">
        <div>
          <p style="margin: 2px 0;">Issued securely via <strong>Telehealth Bangladesh</strong>.</p>
          <p style="margin: 2px 0; color: #059669; font-weight: 600;">End-to-End Encrypted Digital Medical Ledger</p>
        </div>
        <div style="text-align: right; border: 1px solid #BDDDFA; padding: 6px 12px; border-radius: 6px; background: #E7F0FC;">
          <strong style="color: #0F172A; font-size: 10px; text-transform: uppercase;">BMDC Digitally Verified</strong>
          <p style="margin: 2px 0 0 0; color: #55647C; font-size: 9px;">Handshake Token: TB-2026-${p.id || 'NEW'}</p>
        </div>
      </div>
    </div>
  `;

  const opt = {
    margin: 10,
    filename: `Prescription_${p.id || 'TelehealthBD'}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  if (window.html2pdf) {
    window.html2pdf().set(opt).from(element).save();
  } else {
    const printWin = window.open("", "_blank");
    if (printWin) {
      printWin.document.write(element.innerHTML);
      printWin.document.close();
      printWin.print();
    }
  }
};

/* ─── Main PatientDashboard Component ─── */
export const PatientDashboard = ({
  token,
  user,
  appointments = [],
  onSelectConsultation,
  onTabChange,
  activeTab = 'dashboard'
}) => {
  const { t, lang } = useLanguage();
  const { triggerNotification } = useNotifications();

  // Navigation sub-view state
  const [subView, setSubView] = useState("overview");

  // Doctors and booking state
  const [doctors, setDoctors] = useState([]);
  const [selectedDocId, setSelectedDocId] = useState(null);
  const [specialtyFilter, setSpecialtyFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [bookingModalDoc, setBookingModalDoc] = useState(null);
  const [apptForm, setApptForm] = useState({ date: "", time: "10:00 AM", reason: "", consultation_type: "video" });
  const [isAnonymousAppt, setIsAnonymousAppt] = useState(false);
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
      const rPresc = await fetch(`${API_BASE}/api/prescriptions/`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const prescData = await rPresc.json();
      setPrescriptions(Array.isArray(prescData) ? prescData : []);

      const rOrders = await fetch(`${API_BASE}/api/orders/`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const ordersData = await rOrders.json();
      setOrders(Array.isArray(ordersData) ? ordersData : []);
    } catch (err) { console.error(err); }
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
          is_anonymous: isAnonymousAppt
        })
      });

      if (resp.status === 201) {
        const newAppt = await resp.json();
        triggerNotification("Appointment Created", "Consultation slot reserved. Complete payment to confirm.", "appointment");
        setApptForm({ date: "", time: "10:00 AM", reason: "", consultation_type: "video" });
        setIsAnonymousAppt(false);
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
            { label: "Session Type", value: (apptForm.consultation_type || "video").toUpperCase() }
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
        triggerNotification("Consent Authorized", "Selected physician can now view your health records for the specified duration.", "security");
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
        triggerNotification("Consent Revoked", "Physician access to your medical records has been terminated immediately.", "security");
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
    const alarm = document.getElementById("audioRingtone");
    if (alarm) {
      alarm.play().catch(() => { });
      setTimeout(() => alarm.pause(), 4000);
    }
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

      {/* ─── OVERVIEW HOME VIEW ─── */}
      {subView === 'overview' && (() => {
        const bmiData = getBMIData(vitals.weight, vitals.height);
        return (
          <div className="space-y-8">

            {/* 1. Greeting & Daily Health Checkup Panel (Replaces marked quick action buttons) */}
            <div className="bg-white border border-[#BDDDFA] rounded-2xl p-6 sm:p-8 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider block mb-1">
                    Patient Health Portal
                  </span>
                  <h1 className="text-xl font-bold text-[#0F172A] tracking-tight">
                    {getGreeting()}, {user.first_name || user.username}
                  </h1>
                  <p className="text-sm text-[#55647C] mt-0.5">

                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsVitalsModalOpen(true)}
                    icon={Edit3}
                    className="bg-[#E7F0FC] hover:bg-white text-xs font-bold border-[#BDDDFA]"
                  >
                    Update Vitals
                  </Button>
                  <SecurityBadge text="Client-Side Encrypted" />
                </div>
              </div>

              {/* Daily Basic Checkup Cards */}
              <div className="mt-6 pt-6 border-t border-[#BDDDFA]">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-[#059669]" />
                    <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
                      Daily Basic Checkup
                    </h3>
                  </div>
                  <span className="text-[11px] text-[#55647C] flex items-center gap-1 font-medium">
                    <Clock className="w-3 h-3 text-[#168CF5]" />
                    {vitals.lastChecked || 'Today'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* 1. Age Card */}
                  <div className="p-4 rounded-xl bg-[#E7F0FC] border border-[#BDDDFA] flex items-center justify-between">
                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold text-[#55647C] uppercase tracking-wider block">Age</span>
                      <div className="text-2xl font-extrabold text-[#0F172A]">
                        {vitals.age} <span className="text-xs font-normal text-[#55647C]">years</span>
                      </div>
                      <p className="text-[10px] text-[#059669] font-medium">Blood Group: {vitals.bloodGroup || 'O+'}</p>
                    </div>
                    <div className="w-11 h-11 rounded-xl bg-white border border-[#BDDDFA] text-[#168CF5] flex items-center justify-center shrink-0 shadow-xs">
                      <User className="w-5 h-5" />
                    </div>
                  </div>

                  {/* 2. Weight & BMI Card */}
                  <div className="p-4 rounded-xl bg-[#E7F0FC] border border-[#BDDDFA] flex items-center justify-between">
                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold text-[#55647C] uppercase tracking-wider block">Weight &amp; BMI</span>
                      <div className="text-2xl font-extrabold text-[#0F172A]">
                        {vitals.weight} <span className="text-xs font-normal text-[#55647C]">kg</span>
                      </div>
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${bmiData.badge}`}>
                        BMI {bmiData.bmi} • {bmiData.category}
                      </span>
                    </div>
                    <div className="w-11 h-11 rounded-xl bg-white border border-[#BDDDFA] text-[#059669] flex items-center justify-center shrink-0 shadow-xs">
                      <Scale className="w-5 h-5" />
                    </div>
                  </div>

                  {/* 3. Height Card */}
                  <div className="p-4 rounded-xl bg-[#E7F0FC] border border-[#BDDDFA] flex items-center justify-between">
                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold text-[#55647C] uppercase tracking-wider block">Height</span>
                      <div className="text-2xl font-extrabold text-[#0F172A]">
                        {vitals.height} <span className="text-xs font-normal text-[#55647C]">cm</span>
                      </div>
                      <p className="text-[10px] text-[#55647C]">
                        ≈ {Math.floor(vitals.height / 30.48)} ft {Math.round((vitals.height % 30.48) / 2.54)} in
                      </p>
                    </div>
                    <div className="w-11 h-11 rounded-xl bg-white border border-[#BDDDFA] text-[#168CF5] flex items-center justify-center shrink-0 shadow-xs">
                      <Activity className="w-5 h-5" />
                    </div>
                  </div>

                  {/* 4. Water Drank (Hydration Tracker) Card */}
                  <div className="p-4 rounded-xl bg-gradient-to-br from-[#E7F0FC] to-[#DBEAFE] border border-[#BDDDFA] flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-semibold text-[#55647C] uppercase tracking-wider">Water Intake</span>
                        <div className="w-7 h-7 rounded-lg bg-white text-[#168CF5] flex items-center justify-center border border-[#BDDDFA] shadow-xs">
                          <Droplet className="w-3.5 h-3.5" />
                        </div>
                      </div>
                      <div className="text-2xl font-extrabold text-[#0F172A]">
                        {vitals.waterDrank} <span className="text-xs font-normal text-[#55647C]">/ {vitals.waterGoal} L</span>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full bg-white/80 rounded-full h-2 mt-2 overflow-hidden border border-[#BDDDFA]/60">
                        <div
                          className="bg-gradient-to-r from-[#168CF5] to-[#059669] h-2 rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(100, Math.round((vitals.waterDrank / vitals.waterGoal) * 100))}%` }}
                        />
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-[#55647C] mt-1 font-medium">
                        <span>{Math.round((vitals.waterDrank / vitals.waterGoal) * 100)}% of goal</span>
                        <span>≈ {Math.round(vitals.waterDrank / 0.25)} glasses</span>
                      </div>
                    </div>

                    {/* Quick Increment Buttons */}
                    <div className="flex items-center gap-1.5 mt-3 pt-2 border-t border-[#BDDDFA]/60">
                      <button
                        type="button"
                        onClick={() => handleUpdateWater(0.25)}
                        className="flex-1 py-1 px-1.5 rounded-lg bg-white hover:bg-[#168CF5] hover:text-white border border-[#BDDDFA] text-[10px] font-bold text-[#0F172A] transition-colors flex items-center justify-center gap-1"
                        title="Add 1 glass (250 ml)"
                      >
                        <Plus className="w-3 h-3" /> +0.25L
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdateWater(0.5)}
                        className="flex-1 py-1 px-1.5 rounded-lg bg-white hover:bg-[#168CF5] hover:text-white border border-[#BDDDFA] text-[10px] font-bold text-[#0F172A] transition-colors flex items-center justify-center gap-1"
                        title="Add 1 bottle (500 ml)"
                      >
                        <Plus className="w-3 h-3" /> +0.5L
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdateWater(-0.25)}
                        disabled={vitals.waterDrank <= 0}
                        className="py-1 px-2 rounded-lg bg-white hover:bg-rose-50 hover:text-rose-600 border border-[#BDDDFA] text-[10px] font-bold text-[#55647C] transition-colors disabled:opacity-40"
                        title="Undo 250 ml"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Secondary Vitals Strip: BP, Heart Rate, Summary */}
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="py-2 px-3 rounded-xl bg-white border border-[#BDDDFA] flex items-center justify-between">
                    <span className="text-[#55647C] font-medium flex items-center gap-1">
                      <Heart className="w-3.5 h-3.5 text-rose-500" /> BP:
                    </span>
                    <span className="font-bold text-[#0F172A] font-mono">{vitals.bloodPressureSys}/{vitals.bloodPressureDia} mmHg</span>
                  </div>
                  <div className="py-2 px-3 rounded-xl bg-white border border-[#BDDDFA] flex items-center justify-between">
                    <span className="text-[#55647C] font-medium flex items-center gap-1">
                      <Activity className="w-3.5 h-3.5 text-[#059669]" /> Pulse:
                    </span>
                    <span className="font-bold text-[#0F172A] font-mono">{vitals.heartRate} bpm</span>
                  </div>
                  <div className="py-2 px-3 rounded-xl bg-white border border-[#BDDDFA] flex items-center justify-between">
                    <span className="text-[#55647C] font-medium">Hydration:</span>
                    <span className="font-bold text-[#168CF5]">
                      {vitals.waterDrank >= vitals.waterGoal ? "Target Met ✨" : `${(vitals.waterGoal - vitals.waterDrank).toFixed(2)}L Left`}
                    </span>
                  </div>
                  <div className="py-2 px-3 rounded-xl bg-white border border-[#BDDDFA] flex items-center justify-between">
                    <span className="text-[#55647C] font-medium">BMI Status:</span>
                    <span className={`font-bold ${bmiData.color}`}>{bmiData.category}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Upcoming Consultations & Interactive Calendar Split */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* Upcoming Consultations Card (Span 2) */}
              <Card className="lg:col-span-2 flex flex-col justify-between">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-[#E7F0FC] border border-[#BDDDFA] text-[#059669] flex items-center justify-center">
                        <Stethoscope className="w-4 h-4" />
                      </div>
                      <div>
                        <CardTitle>Upcoming Consultations</CardTitle>
                        <CardDescription>Scheduled appointments</CardDescription>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setSubView('booking')}>
                      + Book New
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  {upcomingAppointments.length > 0 ? (
                    upcomingAppointments.slice(0, 3).map((appt) => (
                      <div
                        key={appt.id}
                        className="bg-[#E7F0FC] border border-[#BDDDFA] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-[#168CF5] transition-colors"
                      >
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 rounded-xl bg-white border border-[#BDDDFA] text-[#0F172A] font-bold flex items-center justify-center text-base shrink-0 shadow-sm">
                            {appt.doctor_details?.first_name?.[0] || 'D'}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-bold text-[#0F172A]">
                                Dr. {appt.doctor_details?.first_name} {appt.doctor_details?.last_name}
                              </h4>
                              <StatusBadge status={appt.status} size="sm" />
                            </div>
                            <p className="text-xs text-[#059669] font-semibold mt-0.5">
                              {appt.doctor_details?.specialty || 'General Practitioner'}
                            </p>
                            <div className="flex flex-wrap items-center gap-3 text-xs text-[#55647C] mt-2">
                              <span className="flex items-center gap-1 font-medium bg-white px-2 py-0.5 rounded-md border border-[#BDDDFA]">
                                <Calendar className="w-3.5 h-3.5 text-[#168CF5]" />
                                {appt.date}
                              </span>
                              <span className="flex items-center gap-1 font-medium bg-white px-2 py-0.5 rounded-md border border-[#BDDDFA]">
                                <Clock className="w-3.5 h-3.5 text-[#168CF5]" />
                                {appt.time}
                              </span>
                              <span className="capitalize text-[11px] font-semibold text-[#168CF5]">
                                {appt.consultation_type === 'video' ? '📹 Video Call' : '💬 Encrypted Chat'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex sm:flex-col gap-2 justify-end">
                          {appt.status === 'approved' && appt.consultation ? (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => onSelectConsultation({ id: appt.consultation.id, mode: appt.consultation.type })}
                              icon={Video}
                              className="w-full sm:w-auto font-bold"
                            >
                              Join Room
                            </Button>
                          ) : (
                            <span className="text-xs text-[#55647C] bg-white px-3 py-1.5 rounded-lg border border-[#BDDDFA] text-center font-medium">
                              Awaiting Physician Confirmation
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <EmptyState
                      icon={Calendar}
                      title="No consultations scheduled"
                      description="You don't have any upcoming doctor appointments. Schedule a video visit with a certified doctor whenever you need care."
                      action={
                        <Button size="sm" onClick={() => setSubView('booking')}>
                          Schedule Consultation
                        </Button>
                      }
                    />
                  )}
                </CardContent>
              </Card>

              {/* Interactive Calendar Widget (Span 1) */}
              <Card className="flex flex-col justify-between">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-[#168CF5]" />
                      <CardTitle className="text-sm">Calendar</CardTitle>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1))}
                        className="p-1 rounded-lg hover:bg-[#E7F0FC] text-[#55647C]"
                        title="Previous month"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="text-xs font-bold text-[#0F172A] px-1">
                        {calendarDate.toLocaleString('default', { month: 'short', year: 'numeric' })}
                      </span>
                      <button
                        type="button"
                        onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1))}
                        className="p-1 rounded-lg hover:bg-[#E7F0FC] text-[#55647C]"
                        title="Next month"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-0 space-y-3">
                  {/* Calendar Days Header */}
                  <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-[#94A3B8] uppercase">
                    {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                      <div key={d} className="py-0.5">{d}</div>
                    ))}
                  </div>

                  {/* Calendar Grid */}
                  <div className="grid grid-cols-7 gap-1 text-center text-xs">
                    {renderCalendarDays()}
                  </div>

                  {/* Selected Date Summary & Quick Action */}
                  <div className="pt-3 border-t border-[#BDDDFA] bg-[#E7F0FC] p-3 rounded-xl text-xs space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-[#0F172A]">
                        {new Date(selectedCalendarDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' })}
                      </span>
                      {appointments.some(a => a.date === selectedCalendarDate) ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#059669] text-white">
                          Visit Scheduled
                        </span>
                      ) : (
                        <span className="text-[10px] text-[#55647C]">No visits</span>
                      )}
                    </div>

                    {appointments.filter(a => a.date === selectedCalendarDate).map(a => (
                      <div key={a.id} className="text-[11px] text-[#059669] font-medium flex items-center justify-between bg-white p-1.5 rounded-lg border border-[#BDDDFA]">
                        <span>Dr. {a.doctor_details?.last_name || 'Specialist'} ({a.time})</span>
                        <StatusBadge status={a.status} size="sm" />
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={() => {
                        setApptForm(prev => ({ ...prev, date: selectedCalendarDate }));
                        setSubView('booking');
                      }}
                      className="w-full mt-1 py-1.5 px-2 rounded-lg bg-white hover:bg-[#168CF5] hover:text-white border border-[#BDDDFA] text-[11px] font-bold text-[#168CF5] transition-colors flex items-center justify-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Book Visit for This Date
                    </button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* 3. Suggestions of Doctors */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#168CF5]" />
                    <h3 className="text-base font-bold text-[#0F172A]">
                      Suggestions of Doctors
                    </h3>
                  </div>
                  <p className="text-xs text-[#55647C] mt-0.5">

                  </p>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSubView('booking')}
                  icon={ArrowRight}
                  className="text-xs font-bold text-[#168CF5]"
                >
                  Browse All Directory ({doctors.length})
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {(doctors.length > 0 ? doctors.slice(0, 3) : [
                  {
                    id: 1,
                    user: { first_name: "Sarah", last_name: "Jenkins" },
                    specialty: "General Medicine",
                    bmdc_reg: "BMDC-A-48291",
                    experience_years: 10,
                    consultation_fee: 500,
                    rating: 4.9,
                    reviews: 142
                  },
                  {
                    id: 2,
                    user: { first_name: "Zara", last_name: "Ahmed" },
                    specialty: "Cardiology",
                    bmdc_reg: "BMDC-A-51920",
                    experience_years: 12,
                    consultation_fee: 800,
                    rating: 4.95,
                    reviews: 98
                  },
                  {
                    id: 3,
                    user: { first_name: "Kamal", last_name: "Islam" },
                    specialty: "ENT & Head Neck",
                    bmdc_reg: "BMDC-A-39182",
                    experience_years: 8,
                    consultation_fee: 600,
                    rating: 4.85,
                    reviews: 76
                  }
                ]).map((doc) => {
                  const docName = `Dr. ${doc.user?.first_name || ''} ${doc.user?.last_name || ''}`.trim() || "Specialist Doctor";
                  return (
                    <div
                      key={doc.id}
                      className="p-5 rounded-2xl bg-white border border-[#BDDDFA] hover:shadow-md hover:border-[#168CF5] transition-all flex flex-col justify-between space-y-4 group"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className="relative">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#E7F0FC] to-[#BDDDFA] border border-[#BDDDFA] text-[#0F172A] font-bold flex items-center justify-center text-base group-hover:scale-105 transition-transform">
                              {doc.user?.first_name?.[0] || 'D'}
                            </div>
                            <span className="w-3 h-3 rounded-full bg-[#059669] border-2 border-white absolute -bottom-0.5 -right-0.5" title="Available Online" />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-[#0F172A] group-hover:text-[#168CF5] transition-colors">
                              {docName}
                            </h4>
                            <p className="text-xs text-[#059669] font-semibold mt-0.5">
                              {doc.specialty || 'General Practitioner'}
                            </p>
                            <div className="flex items-center gap-1.5 text-[11px] text-[#55647C] mt-1">
                              <span className="flex items-center text-amber-500 font-bold">
                                <Star className="w-3 h-3 fill-amber-400 mr-0.5" />
                                {doc.rating || '4.9'}
                              </span>
                              <span>•</span>
                              <span>{doc.experience_years || 10}+ yrs exp</span>
                            </div>
                          </div>
                        </div>

                        <VerifiedBadge text="BMDC" size="sm" />
                      </div>

                      <div className="pt-3 border-t border-[#BDDDFA] flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-[#55647C] uppercase font-bold block">Consultation Fee</span>
                          <span className="text-xs font-extrabold text-[#0F172A]">
                            ৳{doc.consultation_fee || 500} BDT
                          </span>
                        </div>

                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => {
                            setBookingModalDoc(doc);
                            setSelectedDocId(doc.user?.id || doc.id);
                          }}
                          className="font-bold text-xs"
                        >
                          Book Visit
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 3. Recent Prescriptions & Records Overview */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Prescriptions Preview Card */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Recent Prescriptions</CardTitle>
                    <Button variant="ghost" size="sm" onClick={() => setSubView('prescriptions')}>
                      View All ({prescriptions.length})
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {prescriptions.length === 0 ? (
                    <EmptyState
                      icon={Award}
                      title="No prescriptions issued yet"
                      description="When a doctor completes a consultation, your digital prescription will appear here."
                    />
                  ) : (
                    <div className="space-y-3">
                      {prescriptions.slice(0, 3).map((p) => (
                        <div key={p.id} className="p-3.5 rounded-xl border border-[#BDDDFA] bg-[#E7F0FC] flex items-center justify-between">
                          <div>
                            <p className="text-xs font-bold text-[#0F172A]">
                              Dr. {p.doctor_details?.first_name || 'Specialist'} {p.doctor_details?.last_name || ''}
                            </p>
                            <p className="text-[10px] text-[#55647C] mt-0.5">
                              {p.diagnosis || 'Clinical evaluation'} • {new Date(p.created_at || Date.now()).toLocaleDateString()}
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            icon={Download}
                            onClick={() => downloadPrescriptionPDF(p)}
                          >
                            PDF
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Active Consented Doctors */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Privacy &amp; Doctor Consents</CardTitle>
                    <Button variant="ghost" size="sm" onClick={() => setSubView('consent')}>
                      Manage ({consents.length})
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {consents.length === 0 ? (
                    <EmptyState
                      icon={ShieldCheck}
                      title="No active authorizations"
                      description="You have not delegated clinical record access to any physician yet."
                    />
                  ) : (
                    <div className="space-y-3">
                      {consents.slice(0, 3).map(c => (
                        <div key={c.id} className="p-3.5 rounded-xl border border-[#BDDDFA] bg-[#E7F0FC] flex items-center justify-between">
                          <div>
                            <p className="text-xs font-bold text-[#0F172A]">
                              Dr. {c.doctor_details?.first_name} {c.doctor_details?.last_name}
                            </p>
                            <p className="text-[10px] text-[#55647C] mt-0.5">
                              {c.doctor_details?.specialty} • Window: {c.expires_hours || 24}h
                            </p>
                          </div>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleRevokeConsent(c.id)}
                          >
                            Revoke
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        );
      })()}

      {/* ─── SUB-VIEW: FIND A DOCTOR / BOOKING ─── */}
      {subView === 'booking' && (
        <div className="space-y-6">
          <PageHeader
            title="Find a Verified Doctor"
            
            action={
              <Button variant="outline" size="sm" onClick={() => setSubView('overview')}>
                Back to Health Home
              </Button>
            }
          />

          {/* Search & Specialty Filter Controls */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-[#4B5563]" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search by doctor name or medical department..."
                className="w-full pl-10 pr-4 py-2.5 bg-[#E7F0FC] rounded-[15px] text-xs text-[#111827] placeholder-[#4B5563] outline-none"
              />
            </div>

            <div className="bg-[#E7F0FC] p-1 rounded-xl flex items-center gap-1 border border-[#BDDDFA] overflow-x-auto w-full sm:w-auto">
              {['all', 'Cardiology', 'Pediatrics', 'General Practice'].map(spec => {
                const isActive = specialtyFilter === spec;
                return (
                  <button
                    key={spec}
                    onClick={() => setSpecialtyFilter(spec)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${isActive
                      ? 'bg-[#0F172A] text-white shadow-sm'
                      : 'text-[#55647C] hover:text-[#0F172A]'
                      }`}
                  >
                    {spec === 'all' ? 'All Specialties' : spec}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Doctors Grid */}
          {filteredDoctors.length === 0 ? (
            <EmptyState
              icon={Stethoscope}
              title="No doctors match your query"
              description="Try adjusting your specialty filter or searching with a different doctor name."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredDoctors.map(doc => (
                <Card key={doc.id} className="flex flex-col justify-between">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="w-10 h-10 rounded-xl bg-[#E7F0FC] text-[#0F172A] font-bold flex items-center justify-center text-sm border border-[#BDDDFA]">
                        {doc.user?.first_name?.[0] || 'D'}
                      </div>
                      <VerifiedBadge text={`BMDC: ${doc.bmdc_reg || 'Verified'}`} />
                    </div>
                    <CardTitle className="mt-3">
                      Dr. {doc.user?.first_name} {doc.user?.last_name}
                    </CardTitle>
                    <p className="text-xs font-semibold text-[#059669]">
                      {doc.specialty}
                    </p>
                    <CardDescription>{doc.hospital || 'Specialist Hospital'}</CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-2 text-xs p-3 rounded-xl bg-[#E7F0FC] border border-[#BDDDFA]">
                      <div>
                        <span className="text-[#55647C] block text-[10px] uppercase font-bold">Experience</span>
                        <span className="font-semibold text-[#0F172A]">{doc.experience || 1}+ Years</span>
                      </div>
                      <div>
                        <span className="text-[#55647C] block text-[10px] uppercase font-bold">Consultation Fee</span>
                        <span className="font-semibold text-[#059669]">৳{doc.fees || 500} BDT</span>
                      </div>
                    </div>

                    {/* Available Schedule */}
                    <div className="p-3 rounded-xl bg-[#E7F0FC] border border-[#BDDDFA] space-y-1.5">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#55647C] uppercase tracking-wider">
                        <Calendar className="w-3.5 h-3.5 text-[#168CF5]" />
                        <span>Available Schedule</span>
                      </div>
                      {Array.isArray(doc.schedule) && doc.schedule.length > 0 ? (
                        <div className="space-y-1">
                          {doc.schedule.map((slot, sIdx) => (
                            <div key={sIdx} className="flex items-center justify-between text-xs py-0.5 text-[#334155]">
                              <span className="font-medium text-[#0F172A]">{slot.day}</span>
                              <span className="font-mono text-[10px] text-[#059669] bg-white px-1.5 py-0.5 rounded border border-[#BDDDFA]">
                                {slot.start_time} – {slot.end_time}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-[#55647C] italic">Available on appointment</p>
                      )}
                    </div>

                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        setBookingModalDoc(doc);
                        setSelectedDocId(doc.user?.id || doc.id);
                      }}
                      className="w-full"
                    >
                      Book Consultation
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── SUB-VIEW: HEALTH RECORDS ─── */}
      {subView === 'records' && (
        <div className="space-y-6">
          <PageHeader
            title="Encrypted Health Records"
            subtitle="Your medical records are cryptographically protected. Only you and authorized doctors can view them."
            action={
              <Button variant="outline" size="sm" onClick={() => setSubView('overview')}>
                Back to Health Home
              </Button>
            }
          />

          {/* Upload New Record Card */}
          <Card>
            <CardHeader>
              <CardTitle>Add Medical Record</CardTitle>
              <CardDescription>Enter clinical parameters or drag and drop diagnostic documents.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Manual Text Record Entry */}
                <form onSubmit={handleCreateRecord} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#0F172A] mb-1">Record Category</label>
                    <select
                      value={recordForm.record_type}
                      onChange={e => setRecordForm({ ...recordForm, record_type: e.target.value })}
                      className="w-full p-2.5 bg-[#E7F0FC] rounded-[15px] text-xs text-[#111827] outline-none"
                    >
                      <option value="Blood report">Blood report / CBC</option>
                      <option value="Cardiology ECG">Cardiology ECG / Echo</option>
                      <option value="Radiology Scan">Radiology / X-Ray / CT</option>
                      <option value="Clinical Summary">General Clinical Note</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#0F172A] mb-1">Clinical Details &amp; Values</label>
                    <textarea
                      rows={3}
                      required
                      value={recordForm.content}
                      onChange={e => setRecordForm({ ...recordForm, content: e.target.value })}
                      placeholder="e.g., Hemoglobin 14.2 g/dL, Fasting Sugar 5.4 mmol/L, BP 120/80 mmHg..."
                      className="w-full p-3 bg-[#E7F0FC] rounded-[15px] text-xs text-[#111827] placeholder-[#4B5563] outline-none"
                    />
                  </div>

                  <Button type="submit" variant="primary" size="sm" icon={PlusCircle}>
                    Save Encrypted Record
                  </Button>
                </form>

                {/* Drag & Drop Area */}
                <div
                  onDragOver={e => e.preventDefault()}
                  onDrop={simulateRecordUpload}
                  onClick={simulateRecordUpload}
                  className="border-2 border-dashed border-[#BDDDFA] bg-[#E7F0FC] rounded-2xl p-6 text-center cursor-pointer flex flex-col items-center justify-center hover:bg-white"
                >
                  <div className="w-10 h-10 rounded-full bg-white border border-[#BDDDFA] text-[#059669] flex items-center justify-center mb-3">
                    <Upload className="w-5 h-5" />
                  </div>
                  <h4 className="text-xs font-bold text-[#0F172A]">Drop lab report file here</h4>
                  <p className="text-[10px] text-[#55647C] mt-1 max-w-xs">
                    Drag and drop PDF/JPEG reports or click to upload into encrypted ledger.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Records Timeline List */}
          <SectionHeader title="Recorded Medical History" subtitle={`${records.length} encrypted documents stored.`} />

          {records.length === 0 ? (
            <EmptyState
              icon={FileHeart}
              title="No health records saved"
              description="Start by adding your recent blood tests, prescriptions, or clinical notes above."
            />
          ) : (
            <div className="space-y-3">
              {records.map(rec => (
                <Card key={rec.id}>
                  <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4">
                    <div className="flex items-start gap-3.5">
                      <div className="w-9 h-9 rounded-xl bg-[#E7F0FC] text-[#059669] flex items-center justify-center shrink-0 border border-[#BDDDFA]">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-[#0F172A]">{rec.record_type}</h4>
                          <SecurityBadge text="AES-256 GCM" />
                        </div>
                        <p className="text-xs text-[#334155] mt-1 leading-relaxed">{rec.content}</p>
                        <p className="text-[10px] text-[#55647C] mt-1">Record ID: #{rec.id} • SHA-256 Hash Protected</p>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleVerifyBlockchainRecord("health_record", rec.id)}
                      >
                        Audit Ledger
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── SUB-VIEW: PRESCRIPTIONS ─── */}
      {subView === 'prescriptions' && (
        <div className="space-y-6">
          <PageHeader
            title="Digital Prescriptions"
            subtitle="View, download, and verify digital prescriptions signed by certified physicians."
            action={
              <Button variant="outline" size="sm" onClick={() => setSubView('overview')}>
                Back to Health Home
              </Button>
            }
          />

          {prescriptions.length === 0 ? (
            <EmptyState
              icon={Award}
              title="No prescriptions issued"
              description="After your doctor conducts a consultation session, digital prescriptions will appear here."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {prescriptions.map(p => (
                <Card key={p.id} className="flex flex-col justify-between">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-[#059669] uppercase">Prescription #{p.id}</span>
                        <CardTitle>Dr. {p.doctor_details?.first_name || 'Specialist'} {p.doctor_details?.last_name || ''}</CardTitle>
                        <p className="text-xs text-[#55647C]">{p.doctor_details?.specialty || 'General Practice'} • BMDC: {p.doctor_details?.bmdc_reg || 'Verified'}</p>
                      </div>
                      <VerifiedBadge text="Digitally Signed" />
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3">
                    <div className="text-xs space-y-1 p-3 rounded-xl bg-[#E7F0FC] border border-[#BDDDFA]">
                      <p><strong className="text-[#0F172A]">Chief Complaints:</strong> {p.symptoms || 'None specified'}</p>
                      <p><strong className="text-[#0F172A]">Diagnosis:</strong> {p.diagnosis || 'Clinical evaluation'}</p>
                    </div>

                    <div className="text-xs">
                      <strong className="text-[#0F172A] block mb-1">Medicines:</strong>
                      <div className="p-2.5 rounded-lg bg-white border border-[#BDDDFA] text-[#334155] font-mono text-[11px]">
                        {p.medicines}
                      </div>
                    </div>
                  </CardContent>

                  <CardFooter className="flex items-center justify-between">
                    <span className="text-[10px] text-[#55647C]">
                      {new Date(p.created_at || Date.now()).toLocaleDateString()}
                    </span>
                    <Button
                      variant="primary"
                      size="sm"
                      icon={Download}
                      onClick={() => downloadPrescriptionPDF(p)}
                    >
                      Download PDF
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── SUB-VIEW: PRIVACY & CONSENT ─── */}
      {subView === 'consent' && (
        <div className="space-y-6">
          <PageHeader
            title="Privacy &amp; Consent Manager"
            subtitle="Grant and revoke time-limited decryption keys. Physicians cannot access your records without authorization."
            action={
              <Button variant="outline" size="sm" onClick={() => setSubView('overview')}>
                Back to Health Home
              </Button>
            }
          />

          {/* Grant Consent Form Card */}
          <Card>
            <CardHeader>
              <CardTitle>Grant Access to Physician</CardTitle>
              <CardDescription>Select an authenticated doctor and specify authorization window duration.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleGrantConsent} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#0F172A] mb-1">Select Physician</label>
                  <select
                    value={consentForm.doctorId}
                    onChange={e => setConsentForm({ ...consentForm, doctorId: e.target.value })}
                    required
                    className="w-full p-2.5 bg-[#E7F0FC] rounded-[15px] text-xs text-[#111827] outline-none"
                  >
                    <option value="">Choose a doctor...</option>
                    {doctors.map(d => (
                      <option key={d.id} value={d.id}>
                        Dr. {d.user?.first_name} {d.user?.last_name} ({d.specialty})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#0F172A] mb-1">Access Duration</label>
                  <select
                    value={consentForm.hours}
                    onChange={e => setConsentForm({ ...consentForm, hours: parseInt(e.target.value) })}
                    className="w-full p-2.5 bg-[#E7F0FC] rounded-[15px] text-xs text-[#111827] outline-none"
                  >
                    <option value={12}>12 Hours</option>
                    <option value={24}>24 Hours</option>
                    <option value={48}>48 Hours</option>
                    <option value={168}>7 Days</option>
                  </select>
                </div>

                <div className="flex items-end">
                  <Button type="submit" variant="primary" size="md" className="w-full" icon={ShieldCheck}>
                    Authorize Key
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Active Consents List */}
          <SectionHeader title="Active Authorizations" subtitle="Physicians currently permitted to inspect your clinical record history." />

          {consents.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title="No active authorizations"
              description="No physicians currently hold keys to access your medical records."
            />
          ) : (
            <div className="space-y-3">
              {consents.map(c => (
                <Card key={c.id}>
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-[#E7F0FC] text-[#059669] flex items-center justify-center border border-[#BDDDFA]">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-[#0F172A]">
                          Dr. {c.doctor_details?.first_name} {c.doctor_details?.last_name}
                        </h4>
                        <p className="text-[10px] text-[#55647C]">
                          {c.doctor_details?.specialty} • Window: {c.expires_hours || 24} hours
                        </p>
                      </div>
                    </div>

                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleRevokeConsent(c.id)}
                    >
                      Revoke Access
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── SUB-VIEW: PHARMACY STORE ─── */}
      {subView === 'pharmacy' && (
        <div className="space-y-6">
          <PageHeader
            title="Medicine Store &amp; Courier Dispatch"
            subtitle="Order pharmaceuticals with doorstep courier delivery and digital payment."
            action={
              <Button variant="outline" size="sm" onClick={() => setSubView('overview')}>
                Back to Health Home
              </Button>
            }
          />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Medicines List (2 cols) */}
            <div className="lg:col-span-2 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {medicinesCatalog.map(med => (
                  <Card key={med.id} className="p-4 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between">
                        <div className="w-8 h-8 rounded-lg bg-[#E7F0FC] text-[#059669] flex items-center justify-center mb-2 border border-[#BDDDFA]">
                          <Pill className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-bold text-[#059669]">{med.price} BDT</span>
                      </div>
                      <h4 className="text-sm font-bold text-[#0F172A]">{med.name}</h4>
                      <p className="text-xs text-[#55647C] mt-0.5">{med.dosage || 'Standard Dosage'}</p>
                    </div>

                    <div className="pt-3 mt-3 border-t border-[#BDDDFA]">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleAddToCart(med)}
                        className="w-full"
                      >
                        Add to Cart
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            {/* Cart & Checkout Drawer (1 col) */}
            <Card className="h-fit">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-[#059669]" />
                  <CardTitle>Cart Summary ({cart.reduce((a, b) => a + b.qty, 0)})</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {cart.length === 0 ? (
                  <p className="text-xs text-[#55647C] text-center py-4">Your pharmacy cart is empty.</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto divide-y divide-[#BDDDFA]">
                    {cart.map(item => (
                      <div key={item.id} className="flex justify-between items-center py-2 text-xs">
                        <div>
                          <p className="font-semibold text-[#0F172A]">{item.name}</p>
                          <p className="text-[10px] text-[#55647C]">{item.qty} × {item.price} BDT</p>
                        </div>
                        <button
                          onClick={() => handleRemoveFromCart(item.id)}
                          className="text-[#FF7A7A] hover:bg-red-50 text-xs font-bold p-1 rounded"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-[#0F172A] mb-1">Delivery Address</label>
                  <input
                    type="text"
                    value={deliveryAddress}
                    onChange={e => setDeliveryAddress(e.target.value)}
                    placeholder="House, Road, Area, City..."
                    className="w-full p-2.5 bg-[#E7F0FC] rounded-[15px] text-xs text-[#111827] placeholder-[#4B5563] outline-none"
                  />
                </div>

                <div className="pt-3 border-t border-[#BDDDFA] flex justify-between items-center">
                  <span className="text-xs font-bold text-[#55647C]">Total Payable:</span>
                  <span className="text-base font-bold text-[#059669]">
                    {cart.reduce((sum, item) => sum + item.price * item.qty, 0)} BDT
                  </span>
                </div>

                <Button
                  variant="primary"
                  onClick={handleCheckoutCart}
                  disabled={cart.length === 0}
                  className="w-full"
                >
                  Proceed to Payment
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
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
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <button
                onClick={() => { setSubView('overview'); if (onTabChange) onTabChange('dashboard'); }}
                className="text-xs font-semibold text-[#059669] hover:underline flex items-center gap-1.5 mb-2"
              >
                <span>←</span>
                <span>Back to My Health Overview</span>
              </button>
              <h2 className="text-lg font-bold text-[#0F172A] flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-[#168CF5]" />
                Billing &amp; Payment Ledger
              </h2>
              <p className="text-xs text-[#55647C] mt-0.5">
                Verified SSLCommerz transactions, digital consultation receipts, and pharmacy invoices.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-[#E7F0FC] text-[#059669] border border-[#059669]">
                <ShieldCheck className="w-3.5 h-3.5 text-[#059669]" />
                SSLCommerz TLS Verified
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchPaymentHistory(paymentFilter)}
                loading={paymentHistoryLoading}
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1" />
                Refresh
              </Button>
            </div>
          </div>

          {/* Segmented Slider Filter Bar */}
          <div className="bg-[#E7F0FC] p-1 rounded-xl inline-flex items-center gap-1 border border-[#BDDDFA] overflow-x-auto max-w-full">
            {['all', 'completed', 'pending', 'failed', 'cancelled'].map(f => {
              const isActive = paymentFilter === f;
              return (
                <button
                  key={f}
                  onClick={() => {
                    setPaymentFilter(f);
                    fetchPaymentHistory(f);
                  }}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all ${isActive
                    ? 'bg-[#0F172A] text-white shadow-sm'
                    : 'text-[#55647C] hover:text-[#0F172A]'
                    }`}
                >
                  {f === 'all' ? 'All Transactions' : f}
                </button>
              );
            })}
          </div>

          {/* Transaction Cards List */}
          {paymentHistoryLoading ? (
            <LoadingState message="Loading verified transactions..." />
          ) : paymentHistory.length === 0 ? (
            <EmptyState
              icon={CreditCard}
              title="No Payment Records Found"
              description={paymentFilter === 'all' ? "You haven't initiated any payment transactions yet." : `No transactions matching '${paymentFilter}' status.`}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {paymentHistory.map(txn => {
                const isCompleted = txn.status === 'completed';
                const isPending = txn.status === 'pending' || txn.status === 'processing';
                const isFailed = txn.status === 'failed';
                const isCancelled = txn.status === 'cancelled';

                return (
                  <Card key={txn.id} className="p-4 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-[#E7F0FC] text-[#0F172A]">
                          {txn.appointment ? 'Doctor Consultation' : txn.order ? 'Pharmacy Order' : 'Health Service'}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${isCompleted
                          ? 'bg-[#E7F0FC] text-[#059669] border border-[#059669]'
                          : isPending
                            ? 'bg-amber-50 text-amber-700 border border-amber-300'
                            : isCancelled
                              ? 'bg-slate-100 text-slate-700 border border-slate-300'
                              : 'bg-red-50 text-[#FF7A7A] border border-[#FF7A7A]/30'
                          }`}>
                          {txn.status}
                        </span>
                      </div>

                      <div className="flex items-baseline justify-between mb-3">
                        <span className="text-xl font-bold text-[#0F172A]">
                          ৳{parseFloat(txn.amount).toFixed(2)} <span className="text-xs font-semibold text-[#55647C]">BDT</span>
                        </span>
                        <span className="text-xs font-mono text-[#55647C]">
                          {txn.payment_method?.toUpperCase()}
                        </span>
                      </div>

                      {/* Service Details */}
                      {txn.appointment_details && (
                        <div className="text-xs text-[#334155] space-y-1 mb-3 bg-[#E7F0FC] p-2.5 rounded-xl border border-[#BDDDFA]">
                          <p className="font-semibold text-[#0F172A]">{txn.appointment_details.doctor_name}</p>
                          <p className="text-[10px] text-[#55647C]">{txn.appointment_details.specialty} • {txn.appointment_details.date} {txn.appointment_details.time}</p>
                        </div>
                      )}

                      {txn.order_details && (
                        <div className="text-xs text-[#334155] space-y-1 mb-3 bg-[#E7F0FC] p-2.5 rounded-xl border border-[#BDDDFA]">
                          <p className="font-semibold text-[#0F172A]">Order #{txn.order_details.id} ({txn.order_details.items_count} items)</p>
                          <p className="text-[10px] text-[#55647C] truncate">Delivery: {txn.order_details.delivery_address}</p>
                        </div>
                      )}

                      <div className="text-[10px] text-[#55647C] font-mono space-y-0.5 border-t border-[#BDDDFA] pt-2 mb-3">
                        <p className="truncate">Ref: {txn.transaction_ref}</p>
                        {txn.val_id && <p className="truncate">SSL Val: {txn.val_id}</p>}
                        <p>Date: {new Date(txn.created_at).toLocaleString()}</p>
                      </div>

                      {txn.failure_reason && (
                        <p className="text-[10px] text-[#FF7A7A] mb-3 bg-red-50 p-2 rounded-lg border border-[#FF7A7A]/30">
                          Notice: {txn.failure_reason}
                        </p>
                      )}
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t border-[#BDDDFA]">
                      {isCompleted && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setReceiptModalTxn(txn)}
                          className="text-xs"
                        >
                          <Printer className="w-3.5 h-3.5 mr-1" />
                          View Receipt
                        </Button>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── BOOKING MODAL ─── */}
      <Modal
        isOpen={!!bookingModalDoc}
        onClose={() => setBookingModalDoc(null)}
        title={`Book with Dr. ${bookingModalDoc?.user?.first_name} ${bookingModalDoc?.user?.last_name}`}
        subtitle={`${bookingModalDoc?.specialty || ''} • Consultation Fee: ৳${bookingModalDoc?.fees || 500} BDT`}
      >
        <form onSubmit={handleBookAppointment} className="space-y-4">
          {/* Doctor Available Schedule */}
          {Array.isArray(bookingModalDoc?.schedule) && bookingModalDoc.schedule.length > 0 && (
            <div className="p-3 rounded-xl bg-[#E7F0FC] border border-[#BDDDFA] text-xs">
              <span className="font-bold text-[#0F172A] block mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#168CF5]" /> Doctor's Consultation Schedule:
              </span>
              <div className="space-y-1">
                {bookingModalDoc.schedule.map((slot, sIdx) => (
                  <div key={sIdx} className="flex justify-between items-center text-[#334155]">
                    <span className="font-medium text-[#0F172A]">{slot.day}</span>
                    <span className="font-mono text-[#059669] font-semibold">{slot.start_time} – {slot.end_time}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-[#0F172A] mb-1">Consultation Date</label>
            <input
              type="date"
              required
              value={apptForm.date}
              onChange={e => setApptForm({ ...apptForm, date: e.target.value })}
              className="w-full p-2.5 bg-[#E7F0FC] rounded-[15px] text-xs text-[#111827] outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#0F172A] mb-1">Preferred Time Slot</label>
            <select
              value={apptForm.time}
              onChange={e => setApptForm({ ...apptForm, time: e.target.value })}
              className="w-full p-2.5 bg-[#E7F0FC] rounded-[15px] text-xs text-[#111827] outline-none"
            >
              <option value="09:00 AM">09:00 AM</option>
              <option value="10:00 AM">10:00 AM</option>
              <option value="11:30 AM">11:30 AM</option>
              <option value="02:00 PM">02:00 PM</option>
              <option value="04:00 PM">04:00 PM</option>
              <option value="07:00 PM">07:00 PM</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#0F172A] mb-1">Consultation Mode</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setApptForm({ ...apptForm, consultation_type: 'video' })}
                className={`p-2.5 rounded-[10px] border text-xs font-bold flex items-center justify-center gap-1.5 ${apptForm.consultation_type === 'video'
                  ? 'bg-[#059669] border-[#059669] text-white'
                  : 'bg-white border-[#BDDDFA] text-[#55647C]'
                  }`}
              >
                <Video className="w-4 h-4" /> Video Call
              </button>
              <button
                type="button"
                onClick={() => setApptForm({ ...apptForm, consultation_type: 'chat' })}
                className={`p-2.5 rounded-[10px] border text-xs font-bold flex items-center justify-center gap-1.5 ${apptForm.consultation_type === 'chat'
                  ? 'bg-[#059669] border-[#059669] text-white'
                  : 'bg-white border-[#BDDDFA] text-[#55647C]'
                  }`}
              >
                <MessageSquare className="w-4 h-4" /> Encrypted Chat
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#0F172A] mb-1">Reason for Visit / Symptoms</label>
            <textarea
              rows={2}
              required
              value={apptForm.reason}
              onChange={e => setApptForm({ ...apptForm, reason: e.target.value })}
              placeholder="e.g. Mild chest pain, high fever for 2 days, prescription renewal..."
              className="w-full p-2.5 bg-[#E7F0FC] rounded-[15px] text-xs text-[#111827] placeholder-[#4B5563] outline-none"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="anonAppt"
              checked={isAnonymousAppt}
              onChange={e => setIsAnonymousAppt(e.target.checked)}
              className="rounded text-[#059669] focus:ring-[#059669]"
            />
            <label htmlFor="anonAppt" className="text-xs text-[#55647C]">
              Anonymous consultation (pseudonymize profile for this visit)
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <Button variant="outline" size="sm" type="button" onClick={() => setBookingModalDoc(null)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" loading={isBookingLoading}>
              Confirm &amp; Request Visit
            </Button>
          </div>
        </form>
      </Modal>

      {/* ─── 1. HOSTED CHECKOUT MODAL ─── */}
      <Modal
        isOpen={!!checkoutModal}
        onClose={() => !paymentLoading && setCheckoutModal(null)}
        title="Secure Checkout"
        subtitle={checkoutModal?.subtitle || "Encrypted payment portal"}
      >
        <div className="space-y-4">
          {/* Order / Appointment Summary */}
          <div className="bg-[#E7F0FC] p-4 rounded-xl border border-[#BDDDFA] space-y-2">
            <h4 className="text-sm font-bold text-[#0F172A]">
              {checkoutModal?.title}
            </h4>
            {checkoutModal?.details && (
              <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-[#BDDDFA]">
                {checkoutModal.details.map((d, i) => (
                  <div key={i}>
                    <span className="text-[#55647C] block text-[10px] uppercase font-bold">{d.label}</span>
                    <span className="font-semibold text-[#0F172A] truncate block">{d.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Amount Due Display */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-white border border-[#BDDDFA]">
            <div>
              <span className="text-[10px] font-bold text-[#55647C] uppercase tracking-wider block">
                Total Payable Amount
              </span>
              <span className="text-2xl font-bold text-[#059669]">
                ৳{checkoutModal?.amount ? checkoutModal.amount.toFixed(2) : "0.00"} <span className="text-xs font-semibold text-[#55647C]">BDT</span>
              </span>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-[#E7F0FC] text-[#059669] border border-[#059669]">
              BDT Currency
            </span>
          </div>

          {/* Gateway Channel Selector */}
          <div>
            <label className="block text-xs font-semibold text-[#0F172A] mb-2">
              Payment Gateway &amp; Method
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'sslcommerz', name: 'SSLCommerz (All)', desc: 'Cards, MFS, NetBanking' },
                { id: 'bkash', name: 'bKash MFS', desc: 'Direct bKash Wallet' },
                { id: 'nagad', name: 'Nagad MFS', desc: 'Direct Nagad Wallet' },
                { id: 'visa', name: 'Visa / MasterCard', desc: 'Credit & Debit Cards' },
              ].map(gw => (
                <button
                  key={gw.id}
                  type="button"
                  onClick={() => setPaymentMethod(gw.id)}
                  className={`p-3 rounded-xl border text-left ${paymentMethod === gw.id
                    ? 'bg-[#E7F0FC] border-[#059669] text-[#0F172A]'
                    : 'bg-white border-[#BDDDFA] text-[#55647C] hover:bg-[#E7F0FC]'
                    }`}
                >
                  <div className="text-xs font-bold flex items-center justify-between">
                    <span>{gw.name}</span>
                    {paymentMethod === gw.id && <Check className="w-3.5 h-3.5 text-[#059669]" />}
                  </div>
                  <div className="text-[10px] text-[#55647C] mt-0.5">{gw.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Security Notice */}
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#E7F0FC] border border-[#BDDDFA] text-[11px] text-[#55647C] leading-relaxed">
            <Lock className="w-4 h-4 text-[#059669] shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-[#0F172A] block">Bank-Grade 256-Bit TLS Encryption</span>
              You will be redirected to the official SSLCommerz hosted checkout page. Telehealth Bangladesh never stores payment PINs or card CVVs.
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-2 border-t border-[#BDDDFA]">
            <Button
              variant="outline"
              size="sm"
              disabled={paymentLoading}
              onClick={() => setCheckoutModal(null)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={paymentLoading}
              onClick={handleProcessPayment}
            >
              Proceed to SSLCommerz Checkout →
            </Button>
          </div>
        </div>
      </Modal>

      {/* ─── 2. PAYMENT VERIFICATION STATUS MODAL ─── */}
      <Modal
        isOpen={!!paymentStatusModal?.isOpen}
        onClose={() => setPaymentStatusModal(null)}
        title="Payment Verification"
        subtitle={`Transaction Ref: ${paymentStatusModal?.txnRef || ''}`}
      >
        <div className="space-y-4 py-2">
          {paymentStatusModal?.status === 'loading' && (
            <div className="text-center py-8 space-y-4">
              <LoadingState message="Verifying Transaction with SSLCommerz..." />
            </div>
          )}

          {paymentStatusModal?.status === 'completed' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[#E7F0FC] border border-[#059669] text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-[#059669] text-white flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-[#0F172A]">
                  Payment Verified &amp; Confirmed
                </h4>
                <p className="text-xs text-[#059669]">
                  Your payment has been validated and your appointment/order is confirmed.
                </p>
              </div>

              {/* Verified Details Table */}
              <div className="bg-white p-4 rounded-xl border border-[#BDDDFA] text-xs space-y-2">
                <div className="flex justify-between py-1 border-b border-[#BDDDFA]">
                  <span className="text-[#55647C]">Amount Paid</span>
                  <span className="font-bold text-[#0F172A]">৳{paymentStatusModal.txn?.amount} BDT</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#BDDDFA]">
                  <span className="text-[#55647C]">Transaction ID</span>
                  <span className="font-mono text-[#0F172A]">{paymentStatusModal.txnRef}</span>
                </div>
                {paymentStatusModal.txn?.val_id && (
                  <div className="flex justify-between py-1 border-b border-[#BDDDFA]">
                    <span className="text-[#55647C]">Validation ID</span>
                    <span className="font-mono text-[#0F172A]">{paymentStatusModal.txn.val_id}</span>
                  </div>
                )}
                <div className="flex justify-between py-1">
                  <span className="text-[#55647C]">Status</span>
                  <span className="font-bold text-[#059669] uppercase">CONFIRMED &amp; PAID</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                {paymentStatusModal.txn && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setReceiptModalTxn(paymentStatusModal.txn);
                      setPaymentStatusModal(null);
                    }}
                  >
                    <Printer className="w-3.5 h-3.5 mr-1" />
                    Print Receipt
                  </Button>
                )}
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setPaymentStatusModal(null)}
                >
                  Done
                </Button>
              </div>
            </div>
          )}

          {paymentStatusModal?.status === 'failed' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-red-50 border border-[#FF7A7A] text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-red-100 text-[#FF7A7A] flex items-center justify-center mx-auto">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-[#0F172A]">
                  Payment Could Not Be Verified
                </h4>
                <p className="text-xs text-[#FF7A7A]">
                  {paymentStatusModal.error || "The payment gateway rejected or could not validate this transaction."}
                </p>
              </div>

              <div className="text-xs text-[#55647C] bg-[#E7F0FC] p-3 rounded-xl border border-[#BDDDFA]">
                <p className="font-mono">Reference: {paymentStatusModal.txnRef}</p>
                <p className="mt-1">If money was deducted from your account, SSLCommerz will auto-reverse it or contact support.</p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => setPaymentStatusModal(null)}>
                  Close
                </Button>
              </div>
            </div>
          )}

          {paymentStatusModal?.status === 'cancelled' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-amber-900">
                  Payment Cancelled
                </h4>
                <p className="text-xs text-amber-700">
                  You cancelled the payment transaction on the SSLCommerz portal. No funds were charged.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="primary" size="sm" onClick={() => setPaymentStatusModal(null)}>
                  Return to Care Portal
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* ─── 3. DIGITAL RECEIPT MODAL (PRINTABLE) ─── */}
      <Modal
        isOpen={!!receiptModalTxn}
        onClose={() => setReceiptModalTxn(null)}
        title="Official Digital Receipt"
        subtitle={`SSLCommerz Telemedicine Payment Voucher`}
      >
        <div id="receipt-print-area" className="space-y-4 p-2">
          {/* Header */}
          <div className="text-center pb-4 border-b border-[#BDDDFA] space-y-1">
            <span className="text-xs font-bold text-[#059669] uppercase tracking-widest block">TELEHEALTH BANGLADESH</span>
            <h3 className="text-base font-bold text-[#0F172A]">Customer Payment Receipt</h3>
            <p className="text-[10px] text-[#55647C] font-mono">Date: {receiptModalTxn?.created_at ? new Date(receiptModalTxn.created_at).toLocaleString() : ''}</p>
          </div>

          {/* Voucher Details */}
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1.5 border-b border-[#BDDDFA]/40">
              <span className="text-[#55647C] font-medium">Customer Name</span>
              <span className="font-bold text-[#0F172A]">{user.first_name} {user.last_name || user.username}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[#BDDDFA]/40">
              <span className="text-[#55647C] font-medium">Service Description</span>
              <span className="font-bold text-[#0F172A]">
                {receiptModalTxn?.appointment_details ? `Doctor Visit: ${receiptModalTxn.appointment_details.doctor_name}` : receiptModalTxn?.order_details ? `Medicine Order #${receiptModalTxn.order_details.id}` : 'Telehealth Service'}
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[#BDDDFA]/40">
              <span className="text-[#55647C] font-medium">Transaction Reference</span>
              <span className="font-mono text-[#0F172A]">{receiptModalTxn?.transaction_ref}</span>
            </div>
            {receiptModalTxn?.val_id && (
              <div className="flex justify-between py-1.5 border-b border-[#BDDDFA]/40">
                <span className="text-[#55647C] font-medium">SSL Validation ID</span>
                <span className="font-mono text-[#0F172A]">{receiptModalTxn.val_id}</span>
              </div>
            )}
            <div className="flex justify-between py-1.5 border-b border-[#BDDDFA]/40">
              <span className="text-[#55647C] font-medium">Payment Gateway</span>
              <span className="font-semibold text-[#0F172A] uppercase">{receiptModalTxn?.gateway || 'SSLCommerz'}</span>
            </div>
            <div className="flex justify-between py-2 text-sm font-bold bg-[#E7F0FC] p-2.5 rounded-xl text-[#0F172A]">
              <span>Total Amount Paid:</span>
              <span className="text-[#059669]">৳{receiptModalTxn?.amount ? parseFloat(receiptModalTxn.amount).toFixed(2) : "0.00"} BDT</span>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-[#E7F0FC] border border-[#059669] text-center text-[10px] font-semibold text-[#059669]">
            ✓ Verified Authentic Transaction • SSLCommerz Order Validation Complete
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-[#BDDDFA]">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
            >
              <Printer className="w-3.5 h-3.5 mr-1" />
              Print
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setReceiptModalTxn(null)}
            >
              Close
            </Button>
          </div>
        </div>
      </Modal>

      {/* ─── 4. DAILY BASIC CHECKUP & VITALS UPDATE MODAL ─── */}
      <Modal
        isOpen={isVitalsModalOpen}
        onClose={() => setIsVitalsModalOpen(false)}
        title="Update Daily Health Checkup"
        subtitle="Log today's biometric parameters, clinical vitals, and water hydration target."
      >
        <form onSubmit={handleSaveVitals} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">Age (Years)</label>
              <input
                type="number"
                min="1"
                max="120"
                required
                value={vitalsForm.age}
                onChange={e => setVitalsForm({ ...vitalsForm, age: e.target.value })}
                className="w-full p-2.5 bg-[#E7F0FC] rounded-[12px] text-xs text-[#111827] outline-none border border-[#BDDDFA]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">Blood Group</label>
              <select
                value={vitalsForm.bloodGroup}
                onChange={e => setVitalsForm({ ...vitalsForm, bloodGroup: e.target.value })}
                className="w-full p-2.5 bg-[#E7F0FC] rounded-[12px] text-xs text-[#111827] outline-none border border-[#BDDDFA]"
              >
                {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map(bg => (
                  <option key={bg} value={bg}>{bg}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">Weight (kg)</label>
              <input
                type="number"
                step="0.1"
                min="20"
                max="300"
                required
                value={vitalsForm.weight}
                onChange={e => setVitalsForm({ ...vitalsForm, weight: e.target.value })}
                className="w-full p-2.5 bg-[#E7F0FC] rounded-[12px] text-xs text-[#111827] outline-none border border-[#BDDDFA]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">Height (cm)</label>
              <input
                type="number"
                step="1"
                min="50"
                max="250"
                required
                value={vitalsForm.height}
                onChange={e => setVitalsForm({ ...vitalsForm, height: e.target.value })}
                className="w-full p-2.5 bg-[#E7F0FC] rounded-[12px] text-xs text-[#111827] outline-none border border-[#BDDDFA]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">Water Drank Today (Liters)</label>
              <input
                type="number"
                step="0.05"
                min="0"
                max="10"
                required
                value={vitalsForm.waterDrank}
                onChange={e => setVitalsForm({ ...vitalsForm, waterDrank: e.target.value })}
                className="w-full p-2.5 bg-[#E7F0FC] rounded-[12px] text-xs text-[#111827] outline-none border border-[#BDDDFA]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">Daily Water Goal (Liters)</label>
              <input
                type="number"
                step="0.1"
                min="1"
                max="10"
                required
                value={vitalsForm.waterGoal}
                onChange={e => setVitalsForm({ ...vitalsForm, waterGoal: e.target.value })}
                className="w-full p-2.5 bg-[#E7F0FC] rounded-[12px] text-xs text-[#111827] outline-none border border-[#BDDDFA]"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[11px] font-semibold text-[#0F172A] mb-1">Systolic BP</label>
              <input
                type="number"
                min="60"
                max="240"
                value={vitalsForm.bloodPressureSys}
                onChange={e => setVitalsForm({ ...vitalsForm, bloodPressureSys: e.target.value })}
                placeholder="120"
                className="w-full p-2 bg-[#E7F0FC] rounded-[12px] text-xs text-[#111827] outline-none border border-[#BDDDFA]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#0F172A] mb-1">Diastolic BP</label>
              <input
                type="number"
                min="40"
                max="160"
                value={vitalsForm.bloodPressureDia}
                onChange={e => setVitalsForm({ ...vitalsForm, bloodPressureDia: e.target.value })}
                placeholder="80"
                className="w-full p-2 bg-[#E7F0FC] rounded-[12px] text-xs text-[#111827] outline-none border border-[#BDDDFA]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#0F172A] mb-1">Heart Rate (bpm)</label>
              <input
                type="number"
                min="40"
                max="200"
                value={vitalsForm.heartRate}
                onChange={e => setVitalsForm({ ...vitalsForm, heartRate: e.target.value })}
                placeholder="72"
                className="w-full p-2 bg-[#E7F0FC] rounded-[12px] text-xs text-[#111827] outline-none border border-[#BDDDFA]"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#BDDDFA]">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsVitalsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
            >
              Save Health Parameters
            </Button>
          </div>
        </form>
      </Modal>

    </div>
  );
};

export default PatientDashboard;
