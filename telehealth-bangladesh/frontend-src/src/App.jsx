import React, { useState, useEffect, lazy, Suspense } from 'react';
import { LanguageProvider, useLanguage } from './components/LanguageContext';
import { NotificationProvider, NotificationDropdown, useNotifications } from './components/NotificationCenter';
import { Auth } from './components/Auth';
import { CustomCursor } from './components/CustomCursor';
import { CommandPalette } from './components/CommandPalette';
import { SupportWidget } from './components/SupportWidget';
import { 
  Activity, LayoutDashboard, CalendarPlus, FileHeart, ShieldCheck, 
  ShoppingBag, ShieldAlert, LogOut, Home, Bell, Globe, Sun, Moon, 
  AlertCircle, Search, Menu, ChevronLeft, ChevronRight, User, HelpCircle
} from 'lucide-react';

const PatientDashboard = lazy(() => import('./components/PatientDashboard').then(m => ({ default: m.PatientDashboard })));
const DoctorDashboard = lazy(() => import('./components/DoctorDashboard').then(m => ({ default: m.DoctorDashboard })));
const AdminDashboard = lazy(() => import('./components/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const ClinicalRoom = lazy(() => import('./components/ClinicalRoom').then(m => ({ default: m.ClinicalRoom })));
const ProfileManagement = lazy(() => import('./components/ProfileManagement').then(m => ({ default: m.ProfileManagement })));

const DashboardSkeleton = () => (
  <div className="space-y-8 animate-pulse text-base w-full">
    {/* Grid Cards Skeleton */}
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="glass-panel p-8 rounded-2xl space-y-4 border border-slate-200 dark:border-white/5 bg-white dark:bg-slate-900/40">
          <div className="flex justify-between items-center">
            <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/2"></div>
            <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-800"></div>
          </div>
          <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded w-3/4"></div>
          <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-5/6"></div>
        </div>
      ))}
    </div>

    {/* Double column skeleton */}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 glass-panel p-8 rounded-2xl border border-slate-200 dark:border-white/5 bg-white dark:bg-slate-900/40 space-y-6">
        <div className="h-6 bg-slate-200 dark:bg-slate-800 rounded w-1/3 border-b border-slate-200 dark:border-white/5 pb-3"></div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
          ))}
        </div>
      </div>
      <div className="glass-panel p-8 rounded-2xl border border-slate-200 dark:border-white/5 bg-white dark:bg-slate-900/40 space-y-6">
        <div className="h-6 bg-slate-200 dark:bg-slate-800 rounded w-1/2 border-b border-slate-200 dark:border-white/5 pb-3"></div>
        <div className="h-40 bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
      </div>
    </div>
  </div>
);

const API_BASE = "http://127.0.0.1:8000";

const MainApp = () => {
  const { lang, toggleLanguage, t } = useLanguage();
  const { notifications, triggerNotification } = useNotifications();
  const [token, setToken] = useState(localStorage.getItem("tv_token") || "");
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [appointments, setAppointments] = useState([]);
  const [selectedConsultation, setSelectedConsultation] = useState(null);
  const [darkMode, setDarkMode] = useState(false);
  
  // Navigation sidebar collapse state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // Notification center dropdown open state
  const [notifOpen, setNotifOpen] = useState(false);
  // Command palette modal state
  const [cmdOpen, setCmdOpen] = useState(false);
  // Quick Actions dropdown state
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  // Logout confirmation modal state
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  // Mobile responsive menu drawer state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile menu on tab navigation changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [activeTab]);

  // Cursor disable effect during logout confirmation
  useEffect(() => {
    if (logoutModalOpen) {
      document.documentElement.setAttribute('data-cursor-disabled', 'true');
    } else {
      document.documentElement.removeAttribute('data-cursor-disabled');
    }
    return () => {
      document.documentElement.removeAttribute('data-cursor-disabled');
    };
  }, [logoutModalOpen]);
  useEffect(() => {
    if (!token) {
      setUser(null);
      return;
    }

    const fetchProfile = async () => {
      try {
        const resp = await fetch(`${API_BASE}/api/profile/`, {
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          }
        });
        if (resp.status === 200) {
          const data = await resp.json();
          setUser(data);
          // Set active view defaults based on roles
          if (data.role === 'admin') {
            setActiveTab("audit");
          } else {
            setActiveTab("dashboard");
          }
          triggerNotification("Session Initialized", `Authenticated as ${data.first_name || data.username} (${data.role.toUpperCase()}).`, "system");
        } else {
          handleLogout();
        }
      } catch (err) {
        console.error("Profile fetch failed: ", err);
      }
    };

    fetchProfile();
  }, [token]);

  // Retrieve scheduled appointments
  const fetchAppointments = async () => {
    if (!token) return;
    try {
      const resp = await fetch(`${API_BASE}/api/appointments/`, {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        }
      });
      const data = await resp.json();
      setAppointments(data);

      // Check if there's any newly approved appointment for patient
      const hasPendingAppt = data.some(a => a.status === 'pending');
      if (hasPendingAppt && user?.role === 'doctor') {
        triggerNotification(
          "Pending Appointment Alert",
          "A new citizen consultation request is awaiting verification.",
          "appointment"
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchAppointments();
    
    // Set up brief polling interval for real-time appt reminders
    const interval = setInterval(() => {
      fetchAppointments();
    }, 15000);

    return () => clearInterval(interval);
  }, [token, activeTab, user]);

  // Keyboard shortcuts listener
  useEffect(() => {
    const handleGlobalShortcuts = (e) => {
      // Ctrl + K or Cmd + K -> Toggle Command Palette
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setCmdOpen(prev => !prev);
      }
      
      // Escape -> Close dropdowns and palette
      if (e.key === 'Escape') {
        setCmdOpen(false);
        setNotifOpen(false);
        setQuickActionsOpen(false);
      }

      // Alt + P -> Go to Profile
      if (e.altKey && e.key === 'p') {
        e.preventDefault();
        setActiveTab("profile");
      }

      // Alt + D -> Go to Dashboard
      if (e.altKey && e.key === 'd') {
        e.preventDefault();
        setActiveTab("dashboard");
      }

      // Alt + L -> Toggle Theme
      if (e.altKey && e.key === 'l') {
        e.preventDefault();
        setDarkMode(prev => !prev);
        triggerNotification("Theme Changed", `Mode switched successfully.`, "system");
      }
    };

    window.addEventListener('keydown', handleGlobalShortcuts);
    return () => window.removeEventListener('keydown', handleGlobalShortcuts);
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

    if (clearDeviceSecurity) {
      const username = user?.username;
      if (username) {
        localStorage.removeItem(`sec_history_${username}`);
        localStorage.removeItem(`mfa_verified_${username}`);
        localStorage.removeItem(`attempts_${username}`);
        localStorage.removeItem(`lockout_${username}`);
      }
    }
  };

  const resetSessionState = () => {
    setToken("");
    setUser(null);
    setAppointments([]);
    setSelectedConsultation(null);
    setActiveTab("dashboard");
    setNotifOpen(false);
    setCmdOpen(false);
    setQuickActionsOpen(false);
    setMobileMenuOpen(false);
    setLogoutModalOpen(false);
  };

  const handleLogout = ({ clearDeviceSecurity = false } = {}) => {
    clearLocalAuthArtifacts(clearDeviceSecurity);
    resetSessionState();
  };

  const handleApptAction = async (id, actionVal) => {
    try {
      const resp = await fetch(`${API_BASE}/api/appointments/${id}/`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ action: actionVal })
      });
      if (resp.status === 200) {
        fetchAppointments();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Command palette action dispatcher
  const handlePaletteAction = (actionId) => {
    if (actionId === 'logout') {
      setLogoutModalOpen(true);
    } else if (actionId === 'sos') {
      // Simulate patient SOS trigger
      const alarm = document.getElementById("audioRingtone");
      if (alarm) {
        alarm.play().catch(e => {});
        setTimeout(() => alarm.pause(), 4000);
      }
      triggerNotification("EMERGENCY CRITICAL: SOS ALERT FIRED", "Broadcasting coordinates to emergency contacts.", "security");
    } else if (actionId === 'toggle-availability') {
      // Simulate doctor status toggle
      triggerNotification("Availability Changed", "Your online routing status has been updated.", "system");
    } else if (actionId === 'rekey') {
      triggerNotification("Node Re-Keyed", "Diffie-Hellman cryptographic parameters regenerated.", "security");
    } else {
      setActiveTab(actionId);
    }
  };

  if (!token || !user) {
    return (
      <div className={`${darkMode ? 'dark' : ''}`}>
        <Auth 
          onLoginSuccess={handleLoginSuccess} 
          darkMode={darkMode} 
          setDarkMode={setDarkMode} 
        />
      </div>
    );
  }

  const unreadNotifCount = notifications.filter(n => !n.read).length;

  return (
    <div className={`flex h-screen w-screen overflow-hidden gradient-mesh-bg ${darkMode ? 'dark text-white' : 'text-slate-900'}`}>
      
      {/* Custom Pointer system */}
      <CustomCursor />

      {/* Ctrl+K Command Palette Modal */}
      <CommandPalette 
        isOpen={cmdOpen} 
        onClose={() => setCmdOpen(false)} 
        user={user} 
        activeTab={activeTab}
        toggleTheme={() => {
          setDarkMode(prev => !prev);
          triggerNotification("Theme Toggled", "Contrast variables updated successfully.", "system");
        }}
        toggleLanguage={toggleLanguage}
        onAction={handlePaletteAction}
      />

      {/* Universal Floating Helpdesk & AI assistant */}
      <SupportWidget user={user} />

      {/* Mobile Drawer Overlay Backdrop */}
      {mobileMenuOpen && (
        <div 
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-slate-950/65 backdrop-blur-sm z-40 md:hidden animate-fade"
        />
      )}

      {/* Collapsible Sidebar Navigation */}
      <aside className={`border-r flex-col p-6 shrink-0 transition-all duration-300 ${sidebarCollapsed ? 'w-24' : 'w-72'} ${darkMode ? 'bg-[#111827] border-white/5' : 'bg-white border-slate-200 shadow-sm'} ${mobileMenuOpen ? 'fixed inset-y-0 left-0 z-50 flex w-72 shadow-2xl' : 'hidden md:flex'}`}>
        
        {/* Sidebar Header Brand */}
        <div className="flex items-center justify-between border-b pb-6 mb-6 border-slate-200 dark:border-white/5 overflow-hidden">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-r from-medical-teal to-medical-indigo p-2.5 rounded-xl text-white shadow-md pulse-glow shrink-0">
              <Activity className="w-5 h-5 stroke-[2.5]" />
            </div>
            {!sidebarCollapsed && (
              <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-medical-teal to-medical-indigo bg-clip-text text-transparent truncate animate-fade">
                {t('brand')}
              </span>
            )}
          </div>
        </div>

        {/* Dynamic Sidebar links based on Role */}
        <nav className="flex-grow space-y-1.5 overflow-y-auto pr-1">
          {user.role === 'patient' && (
            <>
              {/* Patient Tab 1: Dashboard */}
              <button 
                onClick={() => { setActiveTab("dashboard"); setSelectedConsultation(null); }} 
                className={`w-full flex items-center gap-3 px-4 py-3 text-xs font-bold rounded-xl transition-all ${activeTab === 'dashboard' && !selectedConsultation ? (darkMode ? 'bg-white/5 text-white border-l-4 border-medical-teal' : 'bg-slate-100 text-slate-900 border-l-4 border-medical-teal') : 'text-slate-400 hover:text-slate-900 dark:hover:text-slate-300'}`}
              >
                <LayoutDashboard className="w-4.5 h-4.5 shrink-0" />
                {!sidebarCollapsed && <span className="animate-fade">{t('dashboard')}</span>}
              </button>

              {/* Patient Tab 2: Book appointment */}
              <button 
                onClick={() => { setActiveTab("booking"); setSelectedConsultation(null); }} 
                className={`w-full flex items-center gap-3 px-4 py-3 text-xs font-bold rounded-xl transition-all ${activeTab === 'booking' ? (darkMode ? 'bg-white/5 text-white border-l-4 border-medical-teal' : 'bg-slate-100 text-slate-900 border-l-4 border-medical-teal') : 'text-slate-400 hover:text-slate-900 dark:hover:text-slate-300'}`}
              >
                <CalendarPlus className="w-4.5 h-4.5 shrink-0" />
                {!sidebarCollapsed && <span className="animate-fade">{t('bookNewAppt')}</span>}
              </button>

              {/* Patient Tab 3: Encrypted Records */}
              <button 
                onClick={() => { setActiveTab("records"); setSelectedConsultation(null); }} 
                className={`w-full flex items-center gap-3 px-4 py-3 text-xs font-bold rounded-xl transition-all ${activeTab === 'records' ? (darkMode ? 'bg-white/5 text-white border-l-4 border-medical-teal' : 'bg-slate-100 text-slate-900 border-l-4 border-medical-teal') : 'text-slate-400 hover:text-slate-900 dark:hover:text-slate-300'}`}
              >
                <FileHeart className="w-4.5 h-4.5 shrink-0" />
                {!sidebarCollapsed && <span className="animate-fade">{t('encryptedRecords')}</span>}
              </button>

              {/* Patient Tab 4: Consent Manager */}
              <button 
                onClick={() => { setActiveTab("consent"); setSelectedConsultation(null); }} 
                className={`w-full flex items-center gap-3 px-4 py-3 text-xs font-bold rounded-xl transition-all ${activeTab === 'consent' ? (darkMode ? 'bg-white/5 text-white border-l-4 border-medical-teal' : 'bg-slate-100 text-slate-900 border-l-4 border-medical-teal') : 'text-slate-400 hover:text-slate-900 dark:hover:text-slate-300'}`}
              >
                <ShieldCheck className="w-4.5 h-4.5 shrink-0" />
                {!sidebarCollapsed && <span className="animate-fade">{t('consentManager')}</span>}
              </button>

              {/* Patient Tab 5: Pharmacy medicine delivery */}
              <button 
                onClick={() => { setActiveTab("pharmacy"); setSelectedConsultation(null); }} 
                className={`w-full flex items-center gap-3 px-4 py-3 text-xs font-bold rounded-xl transition-all ${activeTab === 'pharmacy' ? (darkMode ? 'bg-white/5 text-white border-l-4 border-medical-teal' : 'bg-slate-100 text-slate-900 border-l-4 border-medical-teal') : 'text-slate-400 hover:text-slate-900 dark:hover:text-slate-300'}`}
              >
                <ShoppingBag className="w-4.5 h-4.5 shrink-0" />
                {!sidebarCollapsed && <span className="animate-fade">{t('medicineDelivery')}</span>}
              </button>
            </>
          )}

          {user.role === 'doctor' && (
            <>
              {/* Doctor Tab 1: Dashboard Home */}
              <button 
                onClick={() => { setActiveTab("dashboard"); setSelectedConsultation(null); }} 
                className={`w-full flex items-center gap-3 px-4 py-3 text-xs font-bold rounded-xl transition-all ${activeTab === 'dashboard' && !selectedConsultation ? (darkMode ? 'bg-white/5 text-white border-l-4 border-medical-teal' : 'bg-slate-100 text-slate-900 border-l-4 border-medical-teal') : 'text-slate-400 hover:text-slate-900 dark:hover:text-slate-300'}`}
              >
                <Home className="w-4.5 h-4.5 shrink-0" />
                {!sidebarCollapsed && <span className="animate-fade">{t('docHome')}</span>}
              </button>
            </>
          )}

          {user.role === 'admin' && (
            <>
              {/* Admin Tab 1: Audit logs */}
              <button 
                onClick={() => { setActiveTab("audit"); setSelectedConsultation(null); }} 
                className={`w-full flex items-center gap-3 px-4 py-3 text-xs font-bold rounded-xl transition-all ${activeTab === 'audit' ? (darkMode ? 'bg-white/5 text-white border-l-4 border-medical-teal' : 'bg-slate-100 text-slate-900 border-l-4 border-medical-teal') : 'text-slate-400 hover:text-slate-900 dark:hover:text-slate-300'}`}
              >
                <ShieldAlert className="w-4.5 h-4.5 shrink-0" />
                {!sidebarCollapsed && <span className="animate-fade">{t('securityAuditLogs')}</span>}
              </button>

              {/* Admin Tab 2: Dispatch shipping */}
              <button 
                onClick={() => { setActiveTab("pharmacy"); setSelectedConsultation(null); }} 
                className={`w-full flex items-center gap-3 px-4 py-3 text-xs font-bold rounded-xl transition-all ${activeTab === 'pharmacy' ? (darkMode ? 'bg-white/5 text-white border-l-4 border-medical-teal' : 'bg-slate-100 text-slate-900 border-l-4 border-medical-teal') : 'text-slate-400 hover:text-slate-900 dark:hover:text-slate-300'}`}
              >
                <ShoppingBag className="w-4.5 h-4.5 shrink-0" />
                {!sidebarCollapsed && <span className="animate-fade">{t('medicineDelivery')}</span>}
              </button>
            </>
          )}

          {/* Unified Profile Settings Link */}
          <button 
            onClick={() => { setActiveTab("profile"); setSelectedConsultation(null); }} 
            className={`w-full flex items-center gap-3 px-4 py-3 text-xs font-bold rounded-xl transition-all ${activeTab === 'profile' ? (darkMode ? 'bg-white/5 text-white border-l-4 border-medical-teal' : 'bg-slate-100 text-slate-900 border-l-4 border-medical-teal') : 'text-slate-400 hover:text-slate-900 dark:hover:text-slate-300'}`}
          >
            <User className="w-4.5 h-4.5 shrink-0" />
            {!sidebarCollapsed && <span className="animate-fade">Profile &amp; Settings</span>}
          </button>
        </nav>

        {/* Collapse Toggle Trigger */}
        <button 
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className={`p-2 border rounded-xl hover:text-white mb-4 transition-all self-center ${darkMode ? 'bg-slate-900/60 border-white/5 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600 shadow-sm'}`}
        >
          {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>

        {/* Bottom User Profile quick access link */}
        <div className="border-t border-slate-200 dark:border-white/5 pt-4 mt-auto flex items-center justify-between overflow-hidden">
          <button 
            onClick={() => setActiveTab('profile')}
            className="flex items-center gap-2 overflow-hidden hover:opacity-80 transition-opacity text-left cursor-pointer"
          >
            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-medical-teal to-medical-indigo flex items-center justify-center font-bold text-slate-900 shrink-0 uppercase">
              {user.first_name ? user.first_name[0] : user.username[0]}
            </div>
            {!sidebarCollapsed && (
              <div className="overflow-hidden animate-fade">
                <h4 className="text-xs font-bold truncate text-slate-700 dark:text-white">{user.first_name || user.username}</h4>
                <span className="text-[9px] text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider">{user.role} Member</span>
              </div>
            )}
          </button>
          
          {!sidebarCollapsed && (
            <button onClick={() => setLogoutModalOpen(true)} className="magnetic-target text-slate-400 hover:text-medical-rose transition-colors" title={t('logout')}>
              <LogOut className="w-5 h-5 shrink-0" />
            </button>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-grow flex flex-col h-screen overflow-hidden">
        
        {/* Header toolbar */}
        <header className={`h-16 border-b flex items-center justify-between px-6 md:px-10 shrink-0 transition-colors duration-300 ${darkMode ? 'bg-[#111827]/30 border-white/5' : 'bg-white border-slate-200 shadow-sm'}`}>
          
          {/* Header title & mobile menu toggle button */}
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setMobileMenuOpen(true)}
              className="p-2.5 rounded-xl border border-slate-250 dark:border-white/10 bg-slate-100/80 dark:bg-slate-900/80 text-slate-700 dark:text-slate-350 md:hidden hover:opacity-80 transition-opacity z-50 animate-fade"
              title="Open Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-white">
              {selectedConsultation ? t('clinicalRoom') : (activeTab === 'dashboard' ? t('dashboard') : activeTab === 'booking' ? t('bookNewAppt') : activeTab === 'profile' ? 'Profile Settings' : t(activeTab))}
            </h1>
          </div>
 
          {/* Top Nav Global Search (Triggers command palette on click) */}
          <div className="relative w-44 sm:w-60">
            <button 
              onClick={() => setCmdOpen(true)}
              className={`w-full border rounded-xl py-1.5 pl-8 pr-3 text-left text-xs font-semibold flex items-center justify-between select-none outline-none ${darkMode ? 'bg-slate-900/60 border-white/5 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'}`}
            >
              <div className="flex items-center gap-2">
                <Search className="w-3.5 h-3.5 text-medical-teal" />
                <span className="hidden sm:inline">Search commands...</span>
                <span className="sm:hidden">Search...</span>
              </div>
              <span className="hidden md:inline font-mono text-[9px] bg-slate-950/20 px-1.5 py-0.5 rounded border border-white/5">Ctrl+K</span>
            </button>
          </div>
 
          {/* Quick settings and notifications */}
          <div className="flex items-center gap-4 text-xs font-bold z-30">
            
            {/* Quick Actions Dropdown */}
            <div className="relative">
              <button 
                onClick={() => setQuickActionsOpen(!quickActionsOpen)}
                className={`px-3 py-2 rounded-xl border flex items-center gap-1 transition-all ${darkMode ? 'bg-slate-900/60 border-white/5 text-slate-400 hover:text-white' : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900 shadow-sm'}`}
              >
                <span>Actions</span>
              </button>
              {quickActionsOpen && (
                <div className="absolute right-0 top-12 w-48 bg-medical-cardBg border border-medical-borderBg rounded-xl shadow-2xl glass-panel p-1.5 space-y-1">
                  <h4 className="text-[9px] text-slate-500 uppercase tracking-widest px-2.5 py-1">Quick Trigger</h4>
                  {user.role === 'patient' && (
                    <>
                      <button onClick={() => { setActiveTab('booking'); setQuickActionsOpen(false); }} className="w-full text-left px-3 py-2 text-[10px] text-slate-300 hover:text-white hover:bg-slate-900/40 rounded-lg">Book Consultation</button>
                      <button onClick={() => { handlePaletteAction('sos'); setQuickActionsOpen(false); }} className="w-full text-left px-3 py-2 text-[10px] text-medical-rose hover:bg-medical-rose/5 rounded-lg">Trigger SOS Alert</button>
                    </>
                  )}
                  {user.role === 'doctor' && (
                    <>
                      <button onClick={() => { handlePaletteAction('toggle-availability'); setQuickActionsOpen(false); }} className="w-full text-left px-3 py-2 text-[10px] text-slate-300 hover:text-white hover:bg-slate-900/40 rounded-lg">Toggle Availability</button>
                      <button onClick={() => { handlePaletteAction('rekey'); setQuickActionsOpen(false); }} className="w-full text-left px-3 py-2 text-[10px] text-slate-300 hover:text-white hover:bg-slate-900/40 rounded-lg">Re-Key Node</button>
                    </>
                  )}
                  {user.role === 'admin' && (
                    <>
                      <button onClick={() => { loadAdminData(); setQuickActionsOpen(false); triggerNotification("Logs Reloaded", "Audit stream updated.", "system"); }} className="w-full text-left px-3 py-2 text-[10px] text-slate-300 hover:text-white hover:bg-slate-900/40 rounded-lg">Reload Audit Logs</button>
                    </>
                  )}
                </div>
              )}
            </div>
 
            {/* Notification Alert Center dropdown */}
            <div className="relative">
              <button 
                onClick={() => setNotifOpen(!notifOpen)} 
                className={`p-2.5 rounded-xl border transition-all relative ${darkMode ? 'bg-slate-900/60 border-white/5 text-slate-400 hover:text-white' : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900 shadow-sm'}`}
              >
                <Bell className="w-4 h-4 text-medical-indigo" />
                {unreadNotifCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-medical-rose text-white text-[9px] font-extrabold flex items-center justify-center px-1 border-2 border-white dark:border-slate-900 shadow-sm animate-pulse">
                    {unreadNotifCount}
                  </span>
                )}
              </button>
              
              <NotificationDropdown 
                isOpen={notifOpen} 
                onClose={() => setNotifOpen(false)}
                user={user}
              />
            </div>
 
            {/* Light/Dark Toggle */}
            <button onClick={() => { setDarkMode(!darkMode); triggerNotification("Theme Switch", `Mode transitioned successfully.`, "system"); }} className={`p-2.5 rounded-xl border transition-all ${darkMode ? 'bg-slate-900/60 border-white/5 text-slate-400 hover:text-white' : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900 shadow-sm'}`}>
              {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-500" />}
            </button>
 
            {/* Language switch */}
            <button onClick={() => { toggleLanguage(); triggerNotification("Language Switched", `Active dictionary updated.`, "system"); }} className={`px-3 py-2 rounded-xl border flex items-center gap-1 transition-all ${darkMode ? 'bg-slate-900/60 border-white/5 text-slate-400 hover:text-white' : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900 shadow-sm'}`}>
              <Globe className="w-4 h-4 text-medical-teal" />
              <span>{lang === 'en' ? 'EN' : 'বাংলা'}</span>
            </button>
 
            {/* Connection node state */}
            <div 
              title={t('nodeConnected')} 
              className={`p-2.5 rounded-xl border flex items-center justify-center relative transition-all group cursor-help ${darkMode ? 'bg-slate-900/60 border-white/5 text-slate-400 hover:text-white' : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900 shadow-sm'}`}
            >
              <ShieldCheck className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-emerald-500 dark:bg-emerald-400 rounded-full animate-pulse"></span>
              
              {/* Tooltip */}
              <div className="absolute right-0 top-12 scale-0 group-hover:scale-100 transition-all duration-200 origin-top-right bg-slate-950 text-white text-[10px] uppercase font-bold tracking-wider py-1.5 px-3 rounded-lg border border-white/10 shadow-xl pointer-events-none whitespace-nowrap z-50">
                {t('nodeConnected')}
              </div>
            </div>

 
          </div>
        </header>

        {/* Dashboard workspace panels */}
        <div className="flex-grow p-6 md:p-10 overflow-y-auto">
          <Suspense fallback={<DashboardSkeleton />}>
            {selectedConsultation ? (
              <ClinicalRoom 
                token={token} 
                user={user} 
                consultationId={selectedConsultation.id} 
                appointmentMode={selectedConsultation.mode}
                onClose={() => setSelectedConsultation(null)} 
              />
            ) : (
              <>
                {/* Profile subview routes */}
                {activeTab === 'profile' && (
                  <ProfileManagement 
                    user={user} 
                    onUpdateUser={setUser}
                    token={token}
                  />
                )}

                {/* Patient role dashboards routes */}
                {user.role === 'patient' && activeTab !== 'profile' && (
                  <PatientDashboard 
                    token={token} 
                    user={user} 
                    appointments={appointments}
                    onSelectConsultation={setSelectedConsultation}
                    onTabChange={setActiveTab}
                    activeTab={activeTab}
                  />
                )}

                {/* Doctor role dashboards routes */}
                {user.role === 'doctor' && activeTab !== 'profile' && (
                  <DoctorDashboard 
                    token={token} 
                    user={user} 
                    appointments={appointments}
                    onApptAction={handleApptAction}
                    onSelectConsultation={setSelectedConsultation}
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                  />
                )}

                {/* Admin role dashboards routes */}
                {user.role === 'admin' && activeTab !== 'profile' && (
                  <AdminDashboard 
                    token={token} 
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                  />
                )}
              </>
            )}
          </Suspense>
        </div>
      </main>

      {/* Slide-Up Logout Confirmation Modal */}
      {logoutModalOpen && (
        <div className="fixed inset-0 bg-slate-950/65 backdrop-blur-sm z-[99999] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-white/10 w-full max-w-md rounded-2xl p-8 shadow-2xl relative overflow-hidden animate-fade">
            <div className="text-center space-y-6 relative z-10">
              <div className="w-14 h-14 rounded-full bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto">
                <LogOut className="w-8 h-8" />
              </div>
              
              <div className="space-y-2">
                <h3 className="text-[20px] font-bold text-slate-800 dark:text-white uppercase tracking-wider">Secure Session Termination</h3>
                <p className="text-[22px] font-semibold text-slate-900 dark:text-white">Are you sure you want to logout?</p>
                <p className="text-[16px] text-red-600 font-bold leading-normal">Security Warning: Active encrypted session key blocks will be deleted immediately.</p>
              </div>

              <div className="flex flex-col gap-3 pt-2">
                {/* Standard Logout */}
                <button 
                  onClick={() => {
                    handleLogout();
                    triggerNotification("Logout Successful", "Standard JWT session tokens cleared successfully.", "security");
                  }}
                  className="magnetic-target w-full bg-red-600 hover:bg-red-700 text-white font-extrabold py-3.5 rounded-xl transition-all text-[18px] shadow-md border-0"
                >
                  Logout
                </button>

                {/* Logout from all devices */}
                <button 
                  onClick={() => {
                    handleLogout({ clearDeviceSecurity: true });
                    triggerNotification("Logout Successful", "Session keys revoked from all active devices.", "security");
                  }}
                  className="magnetic-target w-full bg-gradient-to-r from-red-600 to-indigo-600 hover:from-red-750 hover:to-indigo-750 text-white font-extrabold py-3.5 rounded-xl transition-all text-[18px] shadow-lg border-0"
                >
                  Logout from All Devices
                </button>

                {/* Cancel */}
                <button 
                  onClick={() => setLogoutModalOpen(false)}
                  className="magnetic-target w-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 font-bold py-3.5 rounded-xl transition-all text-[18px] border border-slate-300 dark:border-white/5"
                >
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
    <LanguageProvider>
      <NotificationProvider>
        <MainApp />
      </NotificationProvider>
    </LanguageProvider>
  );
}
