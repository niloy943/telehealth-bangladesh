import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, Lock, Key, AlertTriangle, CheckCircle, Clock, Trash2, Cpu,
  Smartphone, ShieldCheck, Mail, Phone, RefreshCcw, Eye, QrCode
} from 'lucide-react';
import { useLanguage } from './LanguageContext';
import { useNotifications } from './NotificationCenter';

export const SecurityCenter = ({ user, onUpdateUser, token }) => {
  const { t } = useLanguage();
  const { triggerNotification } = useNotifications();

  // Load account security states from local storage or set defaults
  const getSecurityStateKey = () => `security_state_${user?.username || 'guest'}`;

  const [secState, setSecState] = useState(() => {
    const key = `security_state_${user?.username || 'guest'}`;
    const cached = localStorage.getItem(key);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) { }
    }
    return {
      emailVerified: true,
      phoneVerified: false,
      mfaEnabled: false,
      mfaType: null, // 'sms', 'email', 'totp'
      backupEmail: '',
      recoveryCodes: [],
      trustedDevices: [
        { id: 1, name: 'Chrome on Windows 11', ip: '103.145.152.12', location: 'Dhaka, Bangladesh', finger: 'fp_win_chr_938', current: true },
        { id: 2, name: 'Chrome on iPhone 15', ip: '103.145.152.84', location: 'Dhaka, Bangladesh', finger: 'fp_ios_chr_382', current: false }
      ],
      activeSessions: [
        { id: 101, device: 'Chrome on Windows 11', loginTime: '2026-06-07 13:12', lastActive: 'Just now', ip: '103.145.152.12' },
        { id: 102, device: 'Chrome on iPhone 15', loginTime: '2026-06-07 12:44', lastActive: '12m ago', ip: '103.145.152.84' }
      ],
      alerts: [
        { id: 201, title: 'Session Initialized', message: 'New device login approved.', ip: '103.145.152.12', timestamp: '2026-06-07 13:12' },
        { id: 202, title: 'Security Passcode Verified', message: 'E2E clinical routing credentials signed.', ip: '127.0.0.1', timestamp: '2026-06-07 13:00' }
      ]
    };
  });

  // Save updates to localStorage
  const saveSecState = (newState) => {
    setSecState(newState);
    localStorage.setItem(getSecurityStateKey(), JSON.stringify(newState));
  };

  // MFA setups state
  const [setupStep, setSetupStep] = useState(null); // null, 'select', 'sms', 'email', 'totp', 'recovery'
  const [mfaSelectType, setMfaSelectType] = useState('totp');
  const [totpCode, setTotpCode] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpTimer, setOtpTimer] = useState(60);

  // Email/Phone verification simulation states
  const [verifyingEmail, setVerifyingEmail] = useState(false);
  const [verifyingPhone, setVerifyingPhone] = useState(false);
  const [phoneOtp, setPhoneOtp] = useState('');

  // Password rotation forms
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });
  const [pwSuccess, setPwSuccess] = useState(false);

  // Expiration countdown for OTP Setup
  useEffect(() => {
    let interval = null;
    if (otpSent && otpTimer > 0) {
      interval = setInterval(() => {
        setOtpTimer(prev => prev - 1);
      }, 1000);
    } else if (otpTimer === 0) {
      setOtpSent(false);
      setOtpTimer(60);
    }
    return () => clearInterval(interval);
  }, [otpSent, otpTimer]);

  // Handle Verify Email Link Click
  const handleVerifyEmail = () => {
    setVerifyingEmail(true);
    triggerNotification("Email Verification", "A mock verification link has been sent to your Gmail inbox.", "system");
    setTimeout(() => {
      saveSecState({
        ...secState,
        emailVerified: true,
        alerts: [
          { id: Date.now(), title: 'Email Address Verified', message: 'Direct validation from HealNsightSecurity Center.', ip: '127.0.0.1', timestamp: new Date().toLocaleString() },
          ...secState.alerts
        ]
      });
      setVerifyingEmail(false);
      triggerNotification("Email Verified", "Gmail address successfully verified and bound.", "security");
    }, 2000);
  };

  // Handle Send phone verification OTP
  const handleSendPhoneOtp = () => {
    setVerifyingPhone(true);
    setOtpSent(true);
    setOtpTimer(60);
    triggerNotification("SMS OTP Sent", "Your 6-digit OTP is: 123456 (Expires in 5 minutes).", "security");
  };

  const handleVerifyPhone = (e) => {
    e.preventDefault();
    if (phoneOtp === '123456') {
      saveSecState({
        ...secState,
        phoneVerified: true,
        alerts: [
          { id: Date.now(), title: 'Mobile Number Verified', message: 'SMS OTP verification handshake completed.', ip: '127.0.0.1', timestamp: new Date().toLocaleString() },
          ...secState.alerts
        ]
      });
      setVerifyingPhone(false);
      setOtpSent(false);
      setPhoneOtp('');
      triggerNotification("Mobile Verified", "Phone number verified and active for SMS MFA alerts.", "security");
    } else {
      alert("Invalid verification code. Enter 123456.");
    }
  };

  // MFA configurations
  const handleMfaSubmit = (e) => {
    e.preventDefault();
    if (mfaSelectType === 'totp' && totpCode === '123456') {
      const recovery = Array.from({ length: 8 }, () => 'SN-' + Math.floor(1000 + Math.random() * 9000) + '-' + Math.floor(1000 + Math.random() * 9000));
      saveSecState({
        ...secState,
        mfaEnabled: true,
        mfaType: 'totp',
        recoveryCodes: recovery,
        alerts: [
          { id: Date.now(), title: 'Google Authenticator Active', message: 'TOTP Google Authenticator configured successfully.', ip: '127.0.0.1', timestamp: new Date().toLocaleString() },
          ...secState.alerts
        ]
      });
      setSetupStep('recovery');
      triggerNotification("MFA Configured", "Authenticator App has been activated.", "security");
    } else if (mfaSelectType === 'sms' && phoneCode === '123456') {
      saveSecState({
        ...secState,
        mfaEnabled: true,
        mfaType: 'sms',
        alerts: [
          { id: Date.now(), title: 'SMS MFA Enabled', message: 'Mobile SMS authentication configured.', ip: '127.0.0.1', timestamp: new Date().toLocaleString() },
          ...secState.alerts
        ]
      });
      setSetupStep(null);
      triggerNotification("SMS MFA Enabled", "SMS OTP verified for multi-layer login.", "security");
    } else if (mfaSelectType === 'email' && emailCode === '123456') {
      saveSecState({
        ...secState,
        mfaEnabled: true,
        mfaType: 'email',
        alerts: [
          { id: Date.now(), title: 'Email MFA Enabled', message: 'Gmail verification fallback active.', ip: '127.0.0.1', timestamp: new Date().toLocaleString() },
          ...secState.alerts
        ]
      });
      setSetupStep(null);
      triggerNotification("Email MFA Enabled", "Gmail confirmation OTP verified.", "security");
    } else {
      alert("Invalid verification code. Enter 123456.");
    }
  };

  const handleDisableMfa = () => {
    saveSecState({
      ...secState,
      mfaEnabled: false,
      mfaType: null,
      recoveryCodes: [],
      alerts: [
        { id: Date.now(), title: 'MFA Disabled Alert', message: 'Primary multi-factor authentication was deactivated.', ip: '127.0.0.1', timestamp: new Date().toLocaleString() },
        ...secState.alerts
      ]
    });
    triggerNotification("MFA Deactivated", "Account security shifted back to password-only authentication.", "security");
  };

  // Device & session actions
  const terminateSession = (sessionId) => {
    const updatedSessions = secState.activeSessions.filter(s => s.id !== sessionId);
    saveSecState({
      ...secState,
      activeSessions: updatedSessions,
      alerts: [
        { id: Date.now(), title: 'Session Terminated', message: `Revoked session key ID #${sessionId}.`, ip: '127.0.0.1', timestamp: new Date().toLocaleString() },
        ...secState.alerts
      ]
    });
    triggerNotification("Session Terminated", "Remote login session invalidated.", "security");
  };

  const handleLogoutAll = () => {
    saveSecState({
      ...secState,
      activeSessions: secState.activeSessions.filter(s => s.ip === '103.145.152.12'), // keep current
      alerts: [
        { id: Date.now(), title: 'Bulk Session Terminated', message: 'Terminated all remote active tokens.', ip: '127.0.0.1', timestamp: new Date().toLocaleString() },
        ...secState.alerts
      ]
    });
    triggerNotification("All Remote Sessions Terminated", "Forced dynamic logout completed across all alternative platforms.", "security");
  };

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    if (passwordForm.new !== passwordForm.confirm) {
      alert("Passwords must match.");
      return;
    }
    setPwSuccess(true);
    triggerNotification("Security Credentials Updated", "Authentication keys rotated successfully.", "security");
    saveSecState({
      ...secState,
      alerts: [
        { id: Date.now(), title: 'Credentials Changed', message: 'Log-in account password reset successfully.', ip: '127.0.0.1', timestamp: new Date().toLocaleString() },
        ...secState.alerts
      ]
    });
    setTimeout(() => {
      setPwSuccess(false);
      setPasswordForm({ current: '', new: '', confirm: '' });
    }, 3000);
  };

  return (
    <div className="space-y-6 text-xs animate-fade">

      {/* 1. VERIFICATION MATRIX & KYC PANELS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* Email verification card */}
        <div className="glass-panel p-6 rounded-2xl flex flex-col justify-between space-y-4">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-medical-textMuted uppercase tracking-widest">Email Verification</span>
              <h4 className="text-sm font-extrabold text-white">{user?.email || 'john.doe@gmail.com'}</h4>
            </div>
            <Mail className={`w-5 h-5 ${secState.emailVerified ? 'text-medical-teal' : 'text-medical-rose'}`} />
          </div>

          <div className="flex justify-between items-center pt-2">
            <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase ${secState.emailVerified ? 'bg-medical-teal/10 text-medical-teal' : 'bg-medical-rose/10 text-medical-rose'}`}>
              {secState.emailVerified ? 'Gmail Verified' : 'Unverified'}
            </span>
            {!secState.emailVerified && (
              <button
                onClick={handleVerifyEmail}
                disabled={verifyingEmail}
                className="bg-medical-teal text-medical-darkBg font-extrabold px-3 py-1 rounded-lg hover:bg-medical-teal/90 transition-colors"
              >
                {verifyingEmail ? 'Sending Link...' : 'Verify Email'}
              </button>
            )}
          </div>
        </div>

        {/* Mobile verification card */}
        <div className="glass-panel p-6 rounded-2xl flex flex-col justify-between space-y-4">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-medical-textMuted uppercase tracking-widest">Mobile OTP Verification</span>
              <h4 className="text-sm font-extrabold text-white">{user?.phone || '+880 1712 345678'}</h4>
            </div>
            <Phone className={`w-5 h-5 ${secState.phoneVerified ? 'text-medical-teal' : 'text-medical-rose'}`} />
          </div>

          {verifyingPhone ? (
            <form onSubmit={handleVerifyPhone} className="space-y-2.5 w-full">
              <div className="flex gap-2">
                <input
                  required
                  type="text"
                  maxLength="6"
                  placeholder="Enter 123456"
                  value={phoneOtp}
                  onChange={e => setPhoneOtp(e.target.value)}
                  className="w-1/2 bg-medical-darkBg border border-medical-borderBg rounded-lg p-1 text-center font-mono text-white text-xs"
                />
                <button type="submit" className="w-1/2 bg-medical-teal text-medical-darkBg font-bold py-1 rounded-lg">Confirm</button>
              </div>
              <p className="text-[9px] text-medical-textMuted">Code expires in {otpTimer}s. Enter OTP code 123456.</p>
            </form>
          ) : (
            <div className="flex justify-between items-center pt-2">
              <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase ${secState.phoneVerified ? 'bg-medical-teal/10 text-medical-teal' : 'bg-medical-rose/10 text-medical-rose'}`}>
                {secState.phoneVerified ? 'OTP Verified' : 'OTP Pending'}
              </span>
              {!secState.phoneVerified && (
                <button
                  onClick={handleSendPhoneOtp}
                  className="bg-medical-teal text-medical-darkBg font-extrabold px-3 py-1 rounded-lg hover:bg-medical-teal/90 transition-colors"
                >
                  Request OTP
                </button>
              )}
            </div>
          )}
        </div>

        {/* KYC Verification status card */}
        <div className="glass-panel p-6 rounded-2xl flex flex-col justify-between space-y-4">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-medical-textMuted uppercase tracking-widest">KYC Identity Level</span>
              <h4 className="text-sm font-extrabold text-white">
                {user?.role === 'doctor' ? 'BMDC License Verification' : 'National NID Document'}
              </h4>
            </div>
            <ShieldCheck className="w-5 h-5 text-medical-teal" />
          </div>

          <div className="flex justify-between items-center pt-2">
            <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase bg-medical-teal/10 text-medical-teal border border-medical-teal/25">
              Verified Class A
            </span>
            <span className="text-[9px] text-medical-textMuted font-semibold font-mono">Secure Node: #SN-9483</span>
          </div>
        </div>

      </div>

      {/* 2. MULTI-FACTOR AUTHENTICATION SETUP PANEL */}
      <div className="glass-panel p-6 rounded-2xl space-y-4">
        <div className="flex justify-between items-center border-b border-medical-borderBg pb-2">
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Key className="w-4 h-4 text-medical-teal" />
              <span>Multi-Factor Authentication (2FA) Setup</span>
            </h3>
            <p className="text-[9px] text-medical-textMuted mt-0.5">Protect user profile from session hijack attempts</p>
          </div>
          {secState.mfaEnabled && (
            <button
              onClick={handleDisableMfa}
              className="bg-medical-rose/10 border border-medical-rose/20 hover:bg-medical-rose hover:text-white px-3 py-1 rounded-lg font-bold transition-all text-[10px]"
            >
              Disable 2FA
            </button>
          )}
        </div>

        {/* Dynamic 2FA setup screens */}
        {setupStep === null ? (
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 py-2">
            <div>
              <p className="text-[11px] text-medical-textBody">
                Current State: <strong className={secState.mfaEnabled ? 'text-medical-teal' : 'text-medical-rose'}>{secState.mfaEnabled ? `ENABLED (${secState.mfaType.toUpperCase()})` : 'DISABLED'}</strong>
              </p>
              <p className="text-[10px] text-medical-textMuted mt-1">
                Multi-factor validation requires entering a secure 6-digit verification credential every time you log in to HealNSight.
              </p>
            </div>
            {!secState.mfaEnabled && (
              <button
                onClick={() => setSetupStep('select')}
                className="bg-medical-teal text-medical-darkBg font-extrabold px-5 py-2.5 rounded-xl hover:bg-medical-teal/90 transition-all shadow"
              >
                Configure MFA
              </button>
            )}
          </div>
        ) : setupStep === 'select' ? (
          <div className="space-y-4 animate-fade py-2">
            <h4 className="font-bold text-white">Select Backup Authentication Type</h4>
            <div className="grid grid-cols-3 gap-4">

              {/* Option A: SMS OTP */}
              <button
                type="button"
                onClick={() => { setMfaSelectType('sms'); setSetupStep('sms'); setOtpSent(true); setOtpTimer(60); triggerNotification("SMS OTP Sent", "Your 6-digit OTP is: 123456 (Expires in 5 minutes).", "security"); }}
                className="p-4 rounded-xl border border-medical-borderBg hover:border-medical-teal/30 bg-medical-darkBg/40 text-center transition-all"
              >
                <Smartphone className="w-6 h-6 mx-auto text-medical-textMuted mb-1" />
                <span className="font-bold block text-slate-200">SMS OTP Code</span>
                <span className="text-[8px] text-medical-textMuted mt-0.5">Cellular routing via Twilio SMS trunk</span>
              </button>

              {/* Option B: Email OTP */}
              <button
                type="button"
                onClick={() => { setMfaSelectType('email'); setSetupStep('email'); setOtpSent(true); setOtpTimer(60); triggerNotification("Email OTP Sent", "Your 6-digit OTP is: 123456 (Expires in 5 minutes).", "security"); }}
                className="p-4 rounded-xl border border-medical-borderBg hover:border-medical-teal/30 bg-medical-darkBg/40 text-center transition-all"
              >
                <Mail className="w-6 h-6 mx-auto text-medical-textMuted mb-1" />
                <span className="font-bold block text-slate-200">Email OTP Code</span>
                <span className="text-[8px] text-medical-textMuted mt-0.5">Secure fallback code sent to Gmail inbox</span>
              </button>

              {/* Option C: Google Authenticator */}
              <button
                type="button"
                onClick={() => { setMfaSelectType('totp'); setSetupStep('totp'); }}
                className="p-4 rounded-xl border border-medical-borderBg hover:border-medical-teal/30 bg-medical-darkBg/40 text-center transition-all"
              >
                <QrCode className="w-6 h-6 mx-auto text-medical-textMuted mb-1" />
                <span className="font-bold block text-slate-200">Authenticator App</span>
                <span className="text-[8px] text-medical-textMuted mt-0.5">Google Authenticator or Microsoft Authenticator</span>
              </button>

            </div>
            <button onClick={() => setSetupStep(null)} className="text-[10px] text-medical-textMuted hover:text-white underline">Cancel Setup</button>
          </div>
        ) : setupStep === 'totp' ? (
          <form onSubmit={handleMfaSubmit} className="space-y-4 animate-fade py-2 max-w-md">
            <h4 className="font-bold text-white">Google Authenticator Setup</h4>
            <div className="flex gap-4 items-start bg-medical-darkBg/40 p-4 border border-medical-borderBg rounded-xl">

              {/* SVG QR Code Simulation */}
              <div className="bg-white p-2.5 rounded-lg shrink-0">
                <svg className="w-24 h-24" viewBox="0 0 100 100">
                  {/* Outer square border */}
                  <rect x="0" y="0" width="100" height="100" fill="#fff" />
                  <rect x="10" y="10" width="25" height="25" fill="#000" />
                  <rect x="15" y="15" width="15" height="15" fill="#fff" />
                  <rect x="18" y="18" width="9" height="9" fill="#000" />

                  <rect x="65" y="10" width="25" height="25" fill="#000" />
                  <rect x="70" y="15" width="15" height="15" fill="#fff" />
                  <rect x="73" y="18" width="9" height="9" fill="#000" />

                  <rect x="10" y="65" width="25" height="25" fill="#000" />
                  <rect x="15" y="70" width="15" height="15" fill="#fff" />
                  <rect x="18" y="73" width="9" height="9" fill="#000" />

                  {/* Inner QR patterns mock */}
                  <rect x="45" y="45" width="10" height="10" fill="#000" />
                  <rect x="55" y="55" width="10" height="10" fill="#000" />
                  <rect x="45" y="65" width="10" height="15" fill="#000" />
                  <rect x="65" y="45" width="15" height="10" fill="#000" />
                  <rect x="75" y="65" width="15" height="15" fill="#000" />
                </svg>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] text-medical-textMuted leading-normal">
                  1. Scan this QR Code with your Google Authenticator or Microsoft Authenticator app.<br />
                  2. Enter the 6-digit verification code below to verify binding (Enter mock code 123456).
                </p>
                <div className="flex gap-2">
                  <input
                    required
                    type="text"
                    placeholder="Enter 123456"
                    value={totpCode}
                    onChange={e => setTotpCode(e.target.value)}
                    className="bg-medical-darkBg border border-medical-borderBg rounded-xl px-3 py-1.5 text-white font-mono text-center outline-none focus:border-medical-teal w-36"
                  />
                  <button type="submit" className="bg-medical-teal text-medical-darkBg font-bold px-4 py-1.5 rounded-xl">Verify</button>
                </div>
              </div>

            </div>
            <button type="button" onClick={() => setSetupStep('select')} className="text-[10px] text-medical-textMuted hover:text-white underline">Back</button>
          </form>
        ) : setupStep === 'sms' || setupStep === 'email' ? (
          <form onSubmit={handleMfaSubmit} className="space-y-4 animate-fade py-2 max-w-sm">
            <h4 className="font-bold text-white uppercase">{setupStep} OTP Validation Verification</h4>
            <p className="text-[10px] text-medical-textMuted">
              A 6-digit confirmation code has been dispatched to your {setupStep === 'sms' ? 'phone' : 'Gmail address'}. Enter mock code 123456:
            </p>
            <div className="flex gap-2">
              <input
                required
                type="text"
                placeholder="Enter 123456"
                value={setupStep === 'sms' ? phoneCode : emailCode}
                onChange={e => setupStep === 'sms' ? setPhoneCode(e.target.value) : setEmailCode(e.target.value)}
                className="bg-medical-darkBg border border-medical-borderBg rounded-xl px-3 py-1.5 text-white font-mono text-center outline-none focus:border-medical-teal w-36"
              />
              <button type="submit" className="bg-medical-teal text-medical-darkBg font-bold px-4 py-1.5 rounded-xl">Verify Code</button>
            </div>
            {otpSent && <p className="text-[9px] text-medical-textMuted">Wait {otpTimer}s to request code resend.</p>}
            <button type="button" onClick={() => setSetupStep('select')} className="text-[10px] text-medical-textMuted hover:text-white underline block">Back</button>
          </form>
        ) : (
          /* MFA RECOVERY CODES DISPLAY SCREEN */
          <div className="space-y-4 animate-fade py-2">
            <div className="bg-medical-emerald/10 border border-medical-emerald/20 p-4 rounded-xl flex gap-3 items-start">
              <CheckCircle className="w-5 h-5 text-medical-teal shrink-0" />
              <div>
                <h4 className="font-bold text-white">Two-Factor Authentication Confirmed Successfully!</h4>
                <p className="text-[10px] text-medical-textMuted leading-normal mt-0.5">
                  Write down or save these backup authentication recovery codes. They can be used to bypass MFA validation if you lose access to your device.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2 bg-medical-darkBg/60 p-4 border border-medical-borderBg rounded-xl font-mono text-center font-bold text-slate-200">
              {secState.recoveryCodes.map((code, index) => (
                <div key={index} className="bg-medical-darkBg border border-medical-borderBg py-1.5 px-2 rounded-lg text-[10px]">
                  {code}
                </div>
              ))}
            </div>

            <button
              onClick={() => setSetupStep(null)}
              className="bg-medical-teal text-medical-darkBg font-extrabold px-4 py-2 rounded-xl"
            >
              Finish Setup
            </button>
          </div>
        )}

      </div>

      {/* 3. DEVICE MANAGEMENT & ACTIVE SESSIONS */}
      <div className="glass-panel p-6 rounded-2xl space-y-4">
        <div className="flex justify-between items-center border-b border-medical-borderBg pb-2">
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Smartphone className="w-4 h-4 text-medical-teal" />
              <span>Device Management &amp; Session Registry</span>
            </h3>
            <p className="text-[9px] text-medical-textMuted mt-0.5">Audits real-time hardware credentials and access parameters</p>
          </div>
          {secState.activeSessions.length > 1 && (
            <button
              onClick={handleLogoutAll}
              className="text-[9px] text-medical-rose hover:underline font-extrabold bg-medical-rose/10 border border-medical-rose/20 px-2 py-0.5 rounded"
            >
              Logout From All Alternative Devices
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px] text-medical-textMuted">
            <thead>
              <tr className="border-b border-medical-borderBg text-medical-textBody font-semibold">
                <th className="py-2.5">Access Device</th>
                <th>IP Address</th>
                <th>Approx. Location</th>
                <th>Login Timestamp</th>
                <th>Last Active</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {secState.activeSessions.map((session) => (
                <tr key={session.id} className="border-b border-medical-borderBg hover:bg-white/2">
                  <td className="py-3 font-bold text-slate-200 flex items-center gap-1.5">
                    <Cpu className="w-4 h-4 text-medical-textMuted" />
                    <span>{session.device}</span>
                    {session.ip === '103.145.152.12' && (
                      <span className="text-[7px] bg-medical-teal/10 text-medical-teal border border-medical-teal/30 px-1 py-0.5 rounded font-mono">CURRENT</span>
                    )}
                  </td>
                  <td className="font-mono">{session.ip}</td>
                  <td>{session.location}</td>
                  <td className="font-mono text-medical-textMuted">{session.loginTime}</td>
                  <td className="text-medical-teal font-semibold">{session.lastActive}</td>
                  <td className="text-right py-2">
                    {session.ip !== '103.145.152.12' ? (
                      <button
                        onClick={() => terminateSession(session.id)}
                        className="text-medical-textMuted hover:text-medical-rose p-1.5 transition-colors"
                        title="Force disconnect"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <span className="text-[8px] text-medical-textMuted font-semibold uppercase tracking-wider mr-2">Protected</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. SECURITY LOGS & ALERTS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* Left col: Security Alerts Stream */}
        <div className="md:col-span-2 glass-panel p-6 rounded-2xl space-y-4">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider border-b border-medical-borderBg pb-2 flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-medical-rose" />
            <span>Identity Alert Log Events</span>
          </h3>

          <div className="space-y-3 max-h-[200px] overflow-y-auto pr-1">
            {secState.alerts.map((alert) => (
              <div key={alert.id} className="bg-medical-darkBg/40 p-3 rounded-xl border border-medical-borderBg flex justify-between items-start gap-4">
                <div className="space-y-1">
                  <h4 className="font-bold text-white flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-medical-amber" />
                    <span>{alert.title}</span>
                  </h4>
                  <p className="text-[10px] text-medical-textMuted">{alert.message}</p>
                  <p className="text-[8px] text-medical-textMuted font-mono">IP: {alert.ip}</p>
                </div>
                <span className="text-[9px] text-medical-textMuted font-mono shrink-0">{alert.timestamp}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right col: Credential keys rotations */}
        <div className="glass-panel p-6 rounded-2xl space-y-4">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider border-b border-medical-borderBg pb-2">Change Password</h3>

          {pwSuccess && (
            <div className="bg-medical-emerald/10 border border-medical-emerald/30 text-medical-emerald p-2 rounded-lg text-[10px] font-semibold">
              Credentials changed successfully.
            </div>
          )}

          <form onSubmit={handlePasswordSubmit} className="space-y-3">
            <div>
              <label className="block text-medical-textMuted mb-0.5">Current Password</label>
              <input
                required
                type="password"
                value={passwordForm.current}
                onChange={e => setPasswordForm({ ...passwordForm, current: e.target.value })}
                className="w-full bg-medical-darkBg border border-medical-borderBg rounded-xl p-2.5 text-white outline-none focus:border-medical-teal"
              />
            </div>
            <div>
              <label className="block text-medical-textMuted mb-0.5">New Password</label>
              <input
                required
                type="password"
                value={passwordForm.new}
                onChange={e => setPasswordForm({ ...passwordForm, new: e.target.value })}
                className="w-full bg-medical-darkBg border border-medical-borderBg rounded-xl p-2.5 text-white outline-none focus:border-medical-teal"
              />
            </div>
            <div>
              <label className="block text-medical-textMuted mb-0.5">Confirm New Password</label>
              <input
                required
                type="password"
                value={passwordForm.confirm}
                onChange={e => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                className="w-full bg-medical-darkBg border border-medical-borderBg rounded-xl p-2.5 text-white outline-none focus:border-medical-teal"
              />
            </div>
            <button type="submit" className="w-full bg-medical-teal text-medical-darkBg font-extrabold py-2 rounded-xl shadow">
              Rotate Password
            </button>
          </form>
        </div>

      </div>

    </div>
  );
};
