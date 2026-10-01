import React, { useState, useEffect, lazy, Suspense } from 'react';
import { MotionConfig } from 'framer-motion';
import { LanguageProvider, useLanguage } from './components/LanguageContext';
import { NotificationProvider, NotificationDropdown, useNotifications } from './components/NotificationCenter';
import { Auth } from './components/Auth';
import { LandingPage } from './components/LandingPage';
import { CommandPalette } from './components/CommandPalette';
import { SupportWidget } from './components/SupportWidget';
import {
  Activity, LayoutDashboard, CalendarPlus, FileHeart, ShieldCheck,
  ShoppingBag, ShieldAlert, LogOut, Home, Bell, Globe,
  AlertCircle, Search, Menu, ChevronLeft, ChevronRight, User, HelpCircle,
  X, Heart, UserCheck, Bot, Sparkles, CreditCard, CalendarDays, Clock,
  FileText, Shield, History, Lock, Award, DollarSign, Stethoscope, Users
} from 'lucide-react';

const PatientDashboard = lazy(() => import('./components/PatientDashboard').then(m => ({ default: m.PatientDashboard })));
const DoctorDashboard = lazy(() => import('./components/DoctorDashboard').then(m => ({ default: m.DoctorDashboard })));
const AdminDashboard = lazy(() => import('./components/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const ClinicalRoom = lazy(() => import('./components/ClinicalRoom').then(m => ({ default: m.ClinicalRoom })));
const ProfileManagement = lazy(() => import('./components/ProfileManagement').then(m => ({ default: m.ProfileManagement })));

const DashboardSkeleton = () => (
  <div className="space-y-6 w-full p-6">
    <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="bg-white border border-[#BDDDFA] rounded-2xl p-6 space-y-3">
          <div className="flex justify-between items-center">
            <div className="h-3 bg-[#E7F0FC] rounded w-1/2"></div>
            <div className="w-8 h-8 rounded-lg bg-[#E7F0FC]"></div>
          </div>
          <div className="h-7 bg-[#E7F0FC] rounded w-3/4"></div>
          <div className="h-2.5 bg-[#E7F0FC] rounded w-5/6"></div>
        </div>
      ))}
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div className="lg:col-span-2 bg-white border border-[#BDDDFA] rounded-2xl p-6 space-y-4">
        <div className="h-5 bg-[#E7F0FC] rounded w-1/3 mb-2"></div>
        {[1, 2, 3].map(i => (
          <div key={i} className="h-14 bg-[#E7F0FC] rounded-lg"></div>
        ))}
      </div>
      <div className="bg-white border border-[#BDDDFA] rounded-2xl p-6 space-y-4">
        <div className="h-5 bg-[#E7F0FC] rounded w-1/2 mb-2"></div>
        <div className="h-36 bg-[#E7F0FC] rounded-lg"></div>
      </div>
    </div>
  </div>
);

const API_BASE = import.meta.env.VITE_API_BASE || window.location.origin;

const MainApp = () => {
  const { lang, toggleLanguage, t } = useLanguage();
  const { notifications, triggerNotification } = useNotifications();
  const [token, setToken] = useState(localStorage.getItem("tv_token") || "");
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [appointments, setAppointments] = useState([]);
  const [selectedConsultation, setSelectedConsultation] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showLanding, setShowLanding] = useState(!localStorage.getItem("tv_token"));

  useEffect(() => {
    document.documentElement.classList.remove('dark');
    try {
      localStorage.removeItem('theme');
      localStorage.removeItem('darkMode');
    } catch (e) {}
  }, []);

  useEffect(() => { setMobileMenuOpen(false); }, [activeTab]);

  useEffect(() => {
    if (!token) { setUser(null); return; }
    const fetchProfile = async () => {
      try {
        const resp = await fetch(`${API_BASE}/api/profile/`, {
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
        });
        if (resp.status === 200) {
          const data = await resp.json();
          setUser(data);

          // Route Guard: Sync initial URL path based on authoritative backend role
          const path = window.location.pathname.toLowerCase();
          if (data.role === 'admin') {
            if (!path.startsWith('/admin')) {
              window.history.replaceState({}, document.title, '/admin');
            }
            setActiveTab("audit");
          } else if (data.role === 'doctor') {
            if (path.startsWith('/admin') || !path.startsWith('/doctor')) {
              window.history.replaceState({}, document.title, '/doctor');
            }
            setActiveTab("dashboard");
          } else {
            // Patient role
            if (path.startsWith('/admin') || path.startsWith('/doctor') || !path.startsWith('/patient')) {
              window.history.replaceState({}, document.title, '/patient');
            }
            setActiveTab("dashboard");
          }

          triggerNotification("Welcome back", `Signed in as ${data.first_name || data.username}`, "system");
        } else { handleLogout(); }
      } catch (err) { console.error("Profile fetch failed: ", err); }
    };
    fetchProfile();
  }, [token]);

  // Strict URL Route Guard
  useEffect(() => {
    const enforceRouteGuard = () => {
      if (!user) return;
      const path = window.location.pathname.toLowerCase();

      if (path.startsWith('/admin') && user.role !== 'admin') {
        triggerNotification("Security Alert", "Access Denied: You do not have permission to access the Administrative area (403 Forbidden).", "security");
        const target = user.role === 'doctor' ? '/doctor' : '/patient';
        window.history.replaceState({}, document.title, target);
        setActiveTab('dashboard');
      } else if (path.startsWith('/doctor') && user.role !== 'doctor') {
        triggerNotification("Security Alert", "Access Denied: Doctor workspace is restricted to licensed physicians.", "security");
        const target = user.role === 'admin' ? '/admin' : '/patient';
        window.history.replaceState({}, document.title, target);
        setActiveTab(user.role === 'admin' ? 'audit' : 'dashboard');
      } else if (path.startsWith('/patient') && user.role !== 'patient') {
        triggerNotification("Security Alert", "Access Denied: Citizen health portal is restricted to patient accounts.", "security");
        const target = user.role === 'admin' ? '/admin' : '/doctor';
        window.history.replaceState({}, document.title, target);
        setActiveTab(user.role === 'admin' ? 'audit' : 'dashboard');
      }
    };

    enforceRouteGuard();
    window.addEventListener('popstate', enforceRouteGuard);
    return () => window.removeEventListener('popstate', enforceRouteGuard);
  }, [user]);

  const handleTabChange = (newTab) => {
    if (user?.role !== 'admin' && (newTab === 'audit' || newTab === 'kyc')) {
      triggerNotification("Security Alert", "Access Denied: Administrative views are strictly restricted to Administrators.", "security");
      return;
    }
    setActiveTab(newTab);
  };

  const fetchAppointments = async () => {
    if (!token) return;
    try {
      const resp = await fetch(`${API_BASE}/api/appointments/`, {
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
      });
      const data = await resp.json();
      setAppointments(data);
      if (data.some(a => a.status === 'pending') && user?.role === 'doctor') {
        triggerNotification("New Appointment Request", "A patient is awaiting your confirmation.", "appointment");
      }
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    fetchAppointments();
    const interval = setInterval(fetchAppointments, 15000);
    return () => clearInterval(interval);
  }, [token, activeTab, user]);

  useEffect(() => {
    const handleKeys = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); setCmdOpen(p => !p); }
      if (e.key === 'Escape') { setCmdOpen(false); setNotifOpen(false); setQuickActionsOpen(false); }
      if (e.altKey && e.key === 'p') { e.preventDefault(); setActiveTab("profile"); }
      if (e.altKey && e.key === 'd') { e.preventDefault(); setActiveTab("dashboard"); }
    };
    window.addEventListener('keydown', handleKeys);
    return () => window.removeEventListener('keydown', handleKeys);
  }, []);

  const handleLoginSuccess = (accessToken, refreshToken) => {
    localStorage.setItem("tv_token", accessToken);
    localStorage.setItem("tv_refresh", refreshToken);
    setToken(accessToken);
  };

  const clearLocalAuthArtifacts = (clearDeviceSecurity = false) => {
    localStorage.removeItem("tv_token");
    localStorage.removeItem("tv_refresh");
    sessionStorage.clear();
    if (clearDeviceSecurity && user?.username) {
      ['sec_history_', 'mfa_verified_', 'attempts_', 'lockout_'].forEach(k =>
        localStorage.removeItem(`${k}${user.username}`)
      );
    }
  };

  const resetSessionState = () => {
    setToken(""); setUser(null); setAppointments([]); setSelectedConsultation(null);
    setActiveTab("dashboard"); setNotifOpen(false); setCmdOpen(false);
    setQuickActionsOpen(false); setMobileMenuOpen(false); setLogoutModalOpen(false);
    setShowLanding(true);
  };

  const handleLogout = ({ clearDeviceSecurity = false } = {}) => {
    clearLocalAuthArtifacts(clearDeviceSecurity);
    resetSessionState();
  };

  const handleApptAction = async (id, actionVal) => {
    try {
      const resp = await fetch(`${API_BASE}/api/appointments/${id}/`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ action: actionVal })
      });
      if (resp.status === 200) fetchAppointments();
    } catch (err) { console.error(err); }
  };

  const handlePaletteAction = (actionId) => {
    if (actionId === 'logout') { setLogoutModalOpen(true); }
    else if (actionId === 'sos') {
      const alarm = document.getElementById("audioRingtone");
      if (alarm) { alarm.play().catch(() => {}); setTimeout(() => alarm.pause(), 4000); }
      triggerNotification("Emergency SOS Alert", "Broadcasting location to emergency contacts.", "security");
    } else if (actionId === 'toggle-availability') {
      triggerNotification("Availability Updated", "Your status has been updated.", "system");
    } else if (actionId === 'rekey') {
      triggerNotification("Security Key Rotated", "Cryptographic parameters regenerated.", "security");
    } else { setActiveTab(actionId); }
  };

  if (!token || !user) {
    if (showLanding) {
      return (
        <LandingPage
          onLogin={() => setShowLanding(false)}
          onGetStarted={() => setShowLanding(false)}
        />
      );
    }
    return <Auth onLoginSuccess={handleLoginSuccess} onBackToLanding={() => setShowLanding(true)} />;
  }

  const unreadNotifCount = notifications.filter(n => !n.read).length;

  const navBtn = (tab, isActive, isSubItem = false) =>
    `w-full flex items-center gap-3 px-4 ${isSubItem ? 'py-2 pl-6 text-[11px]' : 'py-3 text-xs'} rounded-[10px] font-semibold select-none cursor-pointer transition-colors ${
      isActive
        ? 'bg-[#059669] text-white'
        : 'text-[#CBD5E1] hover:bg-[#1E293B] hover:text-white'
    }`;

  const getPageTitle = () => {
    if (selectedConsultation) return 'Consultation Room';
    const titles = {
      dashboard: user.role === 'doctor' ? 'Clinical Workspace & Queue' : user.role === 'admin' ? 'Security & Executive Console' : 'My Health Home',
      ai: 'AI Health Assistant',
      booking: 'Find a Doctor & Specialty Directory',
      records: 'Encrypted Health Records',
      prescriptions: 'Digital Prescriptions & Rx',
      consent: 'Privacy & Data Consent Manager',
      pharmacy: user.role === 'admin' ? 'Medicine Order Management' : 'Pharmacy Store & Prescription Delivery',
      payments: 'Billing & Payment Ledger',
      schedule: 'Physician Consultation Fee & Weekly Schedule',
      audit: 'Security & Audit Ledger',
      kyc: 'Doctor Registry & License Verification',
      staff: 'Admin & Staff Authority Directory',
      profile: 'Account Details & Demographics',
      profile_personal: 'Account Details & Demographics',
      profile_security: 'Security Center & Multi-Factor Auth',
      profile_kyc: user.role === 'doctor' ? 'BMDC License & KYC Verification' : 'Citizen National ID (NID) KYC',
      profile_clinical: user.role === 'doctor' ? 'Specialist Affiliation & Credentials' : 'Medical Vitals & Clinical History',
      profile_activity: 'Security & User Activity Logs',
      profile_privacy: 'Privacy Policy & Data Sharing Settings'
    };
    return titles[activeTab] || 'Dashboard';
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#F4F6F9] text-[#0F172A]">
      <CommandPalette isOpen={cmdOpen} onClose={() => setCmdOpen(false)} user={user}
        activeTab={activeTab}
        toggleLanguage={toggleLanguage} onAction={handlePaletteAction} />

      <SupportWidget user={user} token={token} />

      {mobileMenuOpen && (
        <div onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-[#0F172A]/70 z-40 md:hidden" />
      )}

      {/* Sidebar - Solid Dark Navy */}
      <aside className={`
        flex flex-col shrink-0 border-r border-[#1E293B] bg-[#0F172A] text-[#F8FAFC]
        ${sidebarCollapsed ? 'w-[72px]' : 'w-64'}
        ${mobileMenuOpen ? 'fixed inset-y-0 left-0 z-50 flex !w-64 shadow-2xl' : 'hidden md:flex'}
      `}>

        {/* Brand Header */}
        <div className="flex items-center border-b border-[#1E293B] bg-[#0F172A] h-16 px-4 gap-3 shrink-0">
          <div className="w-8 h-8 rounded-[10px] bg-[#059669] flex items-center justify-center shrink-0 text-white">
            <Activity className="w-4 h-4 text-white stroke-[2.5]" />
          </div>
          {!sidebarCollapsed && (
            <div className="overflow-hidden">
              <p className="text-sm font-extrabold text-[#F8FAFC] tracking-tight leading-none">
                Heal<span className="text-[#34D399]">NSight</span>
              </p>
              <p className="text-[10px] text-[#94A3B8] mt-0.5 font-medium uppercase tracking-wider">Telemedicine Platform</p>
            </div>
          )}
          {mobileMenuOpen && (
            <button onClick={() => setMobileMenuOpen(false)}
              className="ml-auto p-1.5 text-[#94A3B8] hover:text-[#F8FAFC] rounded-lg">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {/* PATIENT NAVIGATION */}
          {user.role === 'patient' && (<>
            <div className="px-3 py-1 text-[10px] font-bold text-[#64748B] uppercase tracking-wider">
              {!sidebarCollapsed && <span>Health Services</span>}
            </div>
            <button onClick={() => { setActiveTab("dashboard"); setSelectedConsultation(null); }}
              className={navBtn('dashboard', activeTab === 'dashboard' && !selectedConsultation)}>
              <LayoutDashboard className="w-4.5 h-4.5 shrink-0" />
              {!sidebarCollapsed && <span>My Health Home</span>}
            </button>
            <button onClick={() => { setActiveTab("ai"); setSelectedConsultation(null); }}
              className={navBtn('ai', activeTab === 'ai')}>
              <Bot className="w-4.5 h-4.5 shrink-0" />
              {!sidebarCollapsed && <span>AI Health Assistant</span>}
            </button>
            <button onClick={() => { setActiveTab("booking"); setSelectedConsultation(null); }}
              className={navBtn('booking', activeTab === 'booking')}>
              <CalendarPlus className="w-4.5 h-4.5 shrink-0" />
              {!sidebarCollapsed && <span>Find a Doctor</span>}
            </button>
            <button onClick={() => { setActiveTab("records"); setSelectedConsultation(null); }}
              className={navBtn('records', activeTab === 'records')}>
              <FileHeart className="w-4.5 h-4.5 shrink-0" />
              {!sidebarCollapsed && <span>Health Records</span>}
            </button>
            <button onClick={() => { setActiveTab("prescriptions"); setSelectedConsultation(null); }}
              className={navBtn('prescriptions', activeTab === 'prescriptions')}>
              <Award className="w-4.5 h-4.5 shrink-0" />
              {!sidebarCollapsed && <span>Prescriptions &amp; Rx</span>}
            </button>
            <button onClick={() => { setActiveTab("consent"); setSelectedConsultation(null); }}
              className={navBtn('consent', activeTab === 'consent')}>
              <ShieldCheck className="w-4.5 h-4.5 shrink-0" />
              {!sidebarCollapsed && <span>Privacy &amp; Consent</span>}
            </button>
            <button onClick={() => { setActiveTab("pharmacy"); setSelectedConsultation(null); }}
              className={navBtn('pharmacy', activeTab === 'pharmacy')}>
              <ShoppingBag className="w-4.5 h-4.5 shrink-0" />
              {!sidebarCollapsed && <span>Pharmacy Store</span>}
            </button>
            <button onClick={() => { setActiveTab("payments"); setSelectedConsultation(null); }}
              className={navBtn('payments', activeTab === 'payments')}>
              <CreditCard className="w-4.5 h-4.5 shrink-0" />
              {!sidebarCollapsed && <span>Billing &amp; Payments</span>}
            </button>
          </>)}

          {/* DOCTOR NAVIGATION */}
          {user.role === 'doctor' && (<>
            <div className="px-3 py-1 text-[10px] font-bold text-[#64748B] uppercase tracking-wider">
              {!sidebarCollapsed && <span>Doctor Workstation</span>}
            </div>
            <button onClick={() => { setActiveTab("dashboard"); setSelectedConsultation(null); }}
              className={navBtn('dashboard', activeTab === 'dashboard' && !selectedConsultation)}>
              <Home className="w-4.5 h-4.5 shrink-0" />
              {!sidebarCollapsed && <span>Clinical Queue</span>}
            </button>
            <button onClick={() => { setActiveTab("schedule"); setSelectedConsultation(null); }}
              className={navBtn('schedule', activeTab === 'schedule')}>
              <CalendarDays className="w-4.5 h-4.5 shrink-0" />
              {!sidebarCollapsed && <span>Fee &amp; Schedule</span>}
            </button>
          </>)}

          {/* ADMIN NAVIGATION */}
          {user.role === 'admin' && (<>
            <div className="px-3 py-1 text-[10px] font-bold text-[#64748B] uppercase tracking-wider">
              {!sidebarCollapsed && <span>Administration</span>}
            </div>
            <button onClick={() => { setActiveTab("audit"); setSelectedConsultation(null); }}
              className={navBtn('audit', activeTab === 'audit')}>
              <ShieldAlert className="w-4.5 h-4.5 shrink-0" />
              {!sidebarCollapsed && <span>Security &amp; Audit</span>}
            </button>
            <button onClick={() => { setActiveTab("kyc"); setSelectedConsultation(null); }}
              className={navBtn('kyc', activeTab === 'kyc')}>
              <UserCheck className="w-4.5 h-4.5 shrink-0" />
              {!sidebarCollapsed && <span>Doctor Management</span>}
            </button>
            <button onClick={() => { setActiveTab("staff"); setSelectedConsultation(null); }}
              className={navBtn('staff', activeTab === 'staff')}>
              <Users className="w-4.5 h-4.5 shrink-0" />
              {!sidebarCollapsed && <span>Admin &amp; Staff</span>}
            </button>
            <button onClick={() => { setActiveTab("pharmacy"); setSelectedConsultation(null); }}
              className={navBtn('pharmacy', activeTab === 'pharmacy')}>
              <ShoppingBag className="w-4.5 h-4.5 shrink-0" />
              {!sidebarCollapsed && <span>Medicine Orders</span>}
            </button>
          </>)}

          {/* ACCOUNT & PROFILE SECTIONS IN SIDEBAR */}
          <div className="pt-2.5 mt-2.5 border-t border-[#1E293B]">
            <div className="px-3 py-1 text-[10px] font-bold text-[#64748B] uppercase tracking-wider">
              {!sidebarCollapsed && <span>Profile &amp; Settings</span>}
            </div>

            <button onClick={() => { setActiveTab("profile_personal"); setSelectedConsultation(null); }}
              className={navBtn('profile_personal', (activeTab === 'profile' || activeTab === 'profile_personal') && !selectedConsultation, !sidebarCollapsed)}>
              <User className="w-4.5 h-4.5 shrink-0" />
              {!sidebarCollapsed && <span>Personal Details</span>}
            </button>

            <button onClick={() => { setActiveTab("profile_security"); setSelectedConsultation(null); }}
              className={navBtn('profile_security', activeTab === 'profile_security', !sidebarCollapsed)}>
              <Shield className="w-4.5 h-4.5 shrink-0" />
              {!sidebarCollapsed && <span>Security &amp; 2FA</span>}
            </button>

            <button onClick={() => { setActiveTab("profile_kyc"); setSelectedConsultation(null); }}
              className={navBtn('profile_kyc', activeTab === 'profile_kyc', !sidebarCollapsed)}>
              <FileText className="w-4.5 h-4.5 shrink-0" />
              {!sidebarCollapsed && <span>{user.role === 'doctor' ? 'BMDC License & KYC' : 'Identity KYC Files'}</span>}
            </button>

            {user.role === 'patient' && (
              <button onClick={() => { setActiveTab("profile_clinical"); setSelectedConsultation(null); }}
                className={navBtn('profile_clinical', activeTab === 'profile_clinical', !sidebarCollapsed)}>
                <Activity className="w-4.5 h-4.5 shrink-0" />
                {!sidebarCollapsed && <span>Medical Vitals</span>}
              </button>
            )}

            {user.role === 'doctor' && (
              <button onClick={() => { setActiveTab("profile_clinical"); setSelectedConsultation(null); }}
                className={navBtn('profile_clinical', activeTab === 'profile_clinical', !sidebarCollapsed)}>
                <Stethoscope className="w-4.5 h-4.5 shrink-0" />
                {!sidebarCollapsed && <span>Specialist Profile</span>}
              </button>
            )}

            <button onClick={() => { setActiveTab("profile_activity"); setSelectedConsultation(null); }}
              className={navBtn('profile_activity', activeTab === 'profile_activity', !sidebarCollapsed)}>
              <History className="w-4.5 h-4.5 shrink-0" />
              {!sidebarCollapsed && <span>Activity &amp; Logs</span>}
            </button>

            <button onClick={() => { setActiveTab("profile_privacy"); setSelectedConsultation(null); }}
              className={navBtn('profile_privacy', activeTab === 'profile_privacy', !sidebarCollapsed)}>
              <Lock className="w-4.5 h-4.5 shrink-0" />
              {!sidebarCollapsed && <span>Privacy Settings</span>}
            </button>
          </div>
        </nav>

        {/* User Footer Profile & Sign Out */}
        <div className="border-t border-[#1E293B] bg-[#0F172A] p-3.5 shrink-0">
          {!sidebarCollapsed ? (
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-[10px] bg-[#1E293B] border border-[#334155] flex items-center justify-center text-[#F8FAFC] font-bold text-xs shrink-0 uppercase">
                {(user.first_name || user.username)[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-[#F8FAFC] truncate">{user.first_name || user.username}</p>
                <p className="text-[10px] text-[#94A3B8] capitalize font-semibold">{user.role}</p>
              </div>
              <button onClick={() => setLogoutModalOpen(true)}
                className="p-2 text-[#FF7A7A] hover:bg-[#FF7A7A]/10 rounded-[10px] cursor-pointer"
                title="Sign Out">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 rounded-[10px] bg-[#1E293B] border border-[#334155] flex items-center justify-center text-[#F8FAFC] font-bold text-xs uppercase">
                {(user.first_name || user.username)[0]}
              </div>
              <button onClick={() => setLogoutModalOpen(true)}
                className="p-1.5 text-[#FF7A7A] hover:bg-[#FF7A7A]/10 rounded-lg cursor-pointer"
                title="Sign Out">
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Sidebar Collapse Toggle */}
        <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="hidden md:flex items-center justify-center h-8 border-t border-[#1E293B] text-[#94A3B8] hover:bg-[#1E293B] hover:text-[#F8FAFC] shrink-0 cursor-pointer">
          {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </aside>

      {/* Main Container */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden bg-[#F4F6F9]">

        {/* Top Header Bar - Solid Dark Navy */}
        <header className="h-16 bg-[#0F172A] border-b border-[#1E293B] flex items-center justify-between px-4 md:px-6 shrink-0 gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 rounded-lg text-[#CBD5E1] hover:bg-[#1E293B]">
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-[#F8FAFC] truncate">{getPageTitle()}</h1>
          </div>

          <button onClick={() => setCmdOpen(true)}
            className="hidden sm:flex flex-1 max-w-sm items-center gap-2.5 px-3.5 py-2 rounded-[10px] border border-[#1E293B] bg-[#1E293B] text-[#CBD5E1] hover:bg-[#1E293B]/80 text-xs">
            <Search className="w-4 h-4 text-[#94A3B8]" />
            <span className="flex-1 text-left text-xs">Search actions, doctors, records...</span>
            <span className="text-[10px] bg-[#0F172A] text-[#94A3B8] px-1.5 py-0.5 rounded font-mono font-medium border border-[#334155]">⌘K</span>
          </button>

          <div className="flex items-center gap-2.5">
            <div className="relative hidden sm:block">
              <button onClick={() => setQuickActionsOpen(!quickActionsOpen)}
                className="px-3.5 py-2 rounded-[10px] border border-[#1E293B] bg-[#1E293B] text-[#CBD5E1] hover:bg-[#334155] text-xs font-semibold">
                Actions
              </button>
              {quickActionsOpen && (
                <div className="absolute right-0 top-11 w-52 bg-white border border-[#BDDDFA] rounded-2xl py-2 z-30 shadow-xl">
                  <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider px-3.5 py-1">Quick Shortcuts</p>
                  {user.role === 'patient' && (<>
                    <button onClick={() => { setActiveTab('booking'); setQuickActionsOpen(false); }}
                      className="w-full text-left px-3.5 py-2 text-xs text-[#0F172A] hover:bg-[#E7F0FC]">Find a Doctor</button>
                    <button onClick={() => { handlePaletteAction('sos'); setQuickActionsOpen(false); }}
                      className="w-full text-left px-3.5 py-2 text-xs text-[#DC2626] font-semibold hover:bg-red-50">Emergency Alert</button>
                  </>)}
                  {user.role === 'doctor' && (<>
                    <button onClick={() => { handlePaletteAction('toggle-availability'); setQuickActionsOpen(false); }}
                      className="w-full text-left px-3.5 py-2 text-xs text-[#0F172A] hover:bg-[#E7F0FC]">Toggle Availability</button>
                    <button onClick={() => { setActiveTab('schedule'); setQuickActionsOpen(false); }}
                      className="w-full text-left px-3.5 py-2 text-xs text-[#0F172A] hover:bg-[#E7F0FC]">Fee &amp; Schedule</button>
                    <button onClick={() => { handlePaletteAction('rekey'); setQuickActionsOpen(false); }}
                      className="w-full text-left px-3.5 py-2 text-xs text-[#0F172A] hover:bg-[#E7F0FC]">Rotate Security Key</button>
                  </>)}
                </div>
              )}
            </div>

            <div className="relative">
              <button onClick={() => setNotifOpen(!notifOpen)}
                className="relative p-2.5 rounded-[10px] border border-[#1E293B] bg-[#1E293B] text-[#CBD5E1] hover:bg-[#334155]"
                aria-label="Notifications">
                <Bell className="w-4 h-4" />
                {unreadNotifCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#DC2626] text-white text-[9px] font-bold flex items-center justify-center">
                    {unreadNotifCount}
                  </span>
                )}
              </button>
              <NotificationDropdown isOpen={notifOpen} onClose={() => setNotifOpen(false)} user={user} />
            </div>

            {/* Language Toggle */}
            <button onClick={() => toggleLanguage()}
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-[10px] border border-[#1E293B] bg-[#1E293B] text-[#CBD5E1] hover:bg-[#334155] text-xs font-bold">
              <Globe className="w-3.5 h-3.5 text-[#34D399]" />{lang === 'en' ? 'EN' : 'BN'}
            </button>

            <div className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-[10px] bg-[#059669]/20 border border-[#059669]/50 text-[#34D399] text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5 text-[#34D399]" />Secure
            </div>
          </div>
        </header>

        {/* Content Workspace */}
        <div className="flex-1 overflow-y-auto bg-[#F4F6F9] text-[#0F172A]">
          <Suspense fallback={<DashboardSkeleton />}>
            {selectedConsultation ? (
              <ClinicalRoom token={token} user={user} consultationId={selectedConsultation.id}
                appointmentMode={selectedConsultation.mode} onClose={() => setSelectedConsultation(null)} />
            ) : (<>
              {activeTab.startsWith('profile') && (
                <ProfileManagement
                  user={user}
                  onUpdateUser={setUser}
                  token={token}
                  activeSection={
                    activeTab === 'profile'
                      ? 'personal'
                      : activeTab.replace('profile_', '')
                  }
                  onTabChange={handleTabChange}
                />
              )}
              {user.role === 'patient' && !activeTab.startsWith('profile') && (
                <PatientDashboard token={token} user={user} appointments={appointments}
                  onSelectConsultation={setSelectedConsultation} onTabChange={handleTabChange} activeTab={activeTab} />
              )}
              {user.role === 'doctor' && !activeTab.startsWith('profile') && (
                <DoctorDashboard token={token} user={user} appointments={appointments}
                  onApptAction={handleApptAction} onSelectConsultation={setSelectedConsultation}
                  activeTab={activeTab} onTabChange={handleTabChange} />
              )}
              {user.role === 'admin' && !activeTab.startsWith('profile') && (
                <AdminDashboard token={token} activeTab={activeTab} onTabChange={handleTabChange} />
              )}
            </>)}
          </Suspense>
        </div>
      </main>

      {/* Logout Modal */}
      {logoutModalOpen && (
        <div className="fixed inset-0 bg-[#0F172A]/70 z-[99999] flex items-center justify-center p-4">
          <div className="bg-white border border-[#BDDDFA] w-full max-w-sm rounded-2xl p-6 shadow-xl">
            <div className="text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-red-50 border border-red-200 flex items-center justify-center mx-auto text-[#DC2626]">
                <LogOut className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#0F172A]">Sign out of your account?</h3>
                <p className="text-xs text-[#55647C] mt-1">Your active session will be ended securely.</p>
              </div>
              <div className="flex flex-col gap-2 pt-2">
                <button onClick={() => { handleLogout(); triggerNotification("Signed out", "Session ended successfully.", "security"); }}
                  className="w-full bg-[#DC2626] hover:bg-[#B91C1C] text-white font-semibold py-2.5 rounded-[10px] text-xs cursor-pointer">
                  Sign Out
                </button>
                <button onClick={() => { handleLogout({ clearDeviceSecurity: true }); triggerNotification("Signed out all devices", "All sessions revoked.", "security"); }}
                  className="w-full bg-[#0F172A] hover:bg-[#1E293B] text-white font-semibold py-2.5 rounded-[10px] text-xs cursor-pointer">
                  Sign Out All Devices
                </button>
                <button onClick={() => setLogoutModalOpen(false)}
                  className="w-full border border-[#BDDDFA] bg-white hover:bg-[#F4F6F9] text-[#0F172A] font-semibold py-2.5 rounded-[10px] text-xs cursor-pointer">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default function App() {
  return (
    <MotionConfig reducedMotion="always" transition={{ duration: 0 }}>
      <LanguageProvider>
        <NotificationProvider>
          <MainApp />
        </NotificationProvider>
      </LanguageProvider>
    </MotionConfig>
  );
}
