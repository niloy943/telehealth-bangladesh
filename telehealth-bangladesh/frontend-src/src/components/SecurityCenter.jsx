import React, { useState, useEffect } from 'react';
import {
  Shield, Lock, Key, AlertTriangle, CheckCircle, Clock, Trash2, Cpu,
  Smartphone, ShieldCheck, Mail, Phone, RefreshCcw, Eye, QrCode
} from 'lucide-react';
import { useLanguage } from './LanguageContext';
import { useNotifications } from './NotificationCenter';
import { Button } from './ui';

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
    triggerNotification("Email Verification", "A verification link has been sent to your email address.", "system");
    setTimeout(() => {
      saveSecState({
        ...secState,
        emailVerified: true,
        alerts: [
          { id: Date.now(), title: 'Email Address Verified', message: 'Direct validation from Telehealth Security Center.', ip: '127.0.0.1', timestamp: new Date().toLocaleString() },
          ...secState.alerts
        ]
      });
      setVerifyingEmail(false);
      triggerNotification("Email Verified", "Email address successfully verified.", "security");
    }, 1500);
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
      const recovery = Array.from({ length: 8 }, () => 'TB-' + Math.floor(1000 + Math.random() * 9000) + '-' + Math.floor(1000 + Math.random() * 9000));
      saveSecState({
        ...secState,
        mfaEnabled: true,
        mfaType: 'totp',
        recoveryCodes: recovery,
        alerts: [
          { id: Date.now(), title: 'Authenticator Active', message: 'TOTP Authenticator configured successfully.', ip: '127.0.0.1', timestamp: new Date().toLocaleString() },
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
          { id: Date.now(), title: 'Email MFA Enabled', message: 'Email verification fallback active.', ip: '127.0.0.1', timestamp: new Date().toLocaleString() },
          ...secState.alerts
        ]
      });
      setSetupStep(null);
      triggerNotification("Email MFA Enabled", "Email confirmation OTP verified.", "security");
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
    triggerNotification("All Remote Sessions Terminated", "Forced logout completed across all alternative devices.", "security");
  };

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    if (passwordForm.new !== passwordForm.confirm) {
      alert("Passwords must match.");
      return;
    }
    setPwSuccess(true);
    triggerNotification("Security Credentials Updated", "Password updated successfully.", "security");
    saveSecState({
      ...secState,
      alerts: [
        { id: Date.now(), title: 'Credentials Changed', message: 'Account password reset successfully.', ip: '127.0.0.1', timestamp: new Date().toLocaleString() },
        ...secState.alerts
      ]
    });
    setTimeout(() => {
      setPwSuccess(false);
      setPasswordForm({ current: '', new: '', confirm: '' });
    }, 3000);
  };

  return (
    <div className="space-y-6 text-xs">

      {/* 1. VERIFICATION MATRIX & KYC PANELS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* Email verification card */}
        <div className="bg-white border border-[#BDDDFA] p-6 rounded-2xl flex flex-col justify-between space-y-4">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-[#55647C] uppercase tracking-wider">Email Verification</span>
              <h4 className="text-sm font-bold text-[#0F172A]">{user?.email || 'citizen@gov.bd'}</h4>
            </div>
            <Mail className={`w-5 h-5 ${secState.emailVerified ? 'text-[#059669]' : 'text-[#FF7A7A]'}`} />
          </div>

          <div className="flex justify-between items-center pt-2">
            <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase ${secState.emailVerified ? 'bg-[#E7F0FC] text-[#059669] border border-[#059669]' : 'bg-red-50 text-[#FF7A7A] border border-[#FF7A7A]/30'}`}>
              {secState.emailVerified ? 'Verified' : 'Unverified'}
            </span>
            {!secState.emailVerified && (
              <Button
                size="sm"
                variant="primary"
                onClick={handleVerifyEmail}
                disabled={verifyingEmail}
              >
                {verifyingEmail ? 'Sending...' : 'Verify Email'}
              </Button>
            )}
          </div>
        </div>

        {/* Mobile verification card */}
        <div className="bg-white border border-[#BDDDFA] p-6 rounded-2xl flex flex-col justify-between space-y-4">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-[#55647C] uppercase tracking-wider">Mobile OTP Verification</span>
              <h4 className="text-sm font-bold text-[#0F172A]">{user?.phone || '+880 1712 345678'}</h4>
            </div>
            <Phone className={`w-5 h-5 ${secState.phoneVerified ? 'text-[#059669]' : 'text-[#FF7A7A]'}`} />
          </div>

          {verifyingPhone ? (
            <form onSubmit={handleVerifyPhone} className="space-y-2.5 w-full">
              <div className="flex gap-2">
                <input
                  required
                  type="text"
                  maxLength="6"
                  placeholder="123456"
                  value={phoneOtp}
                  onChange={e => setPhoneOtp(e.target.value)}
                  className="w-1/2 bg-[#E7F0FC] rounded-[15px] p-2 text-center font-mono text-[#111827] text-xs outline-none"
                />
                <Button size="sm" variant="primary" type="submit" className="w-1/2">Confirm</Button>
              </div>
              <p className="text-[9px] text-[#55647C]">Code expires in {otpTimer}s. Enter OTP code 123456.</p>
            </form>
          ) : (
            <div className="flex justify-between items-center pt-2">
              <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase ${secState.phoneVerified ? 'bg-[#E7F0FC] text-[#059669] border border-[#059669]' : 'bg-red-50 text-[#FF7A7A] border border-[#FF7A7A]/30'}`}>
                {secState.phoneVerified ? 'OTP Verified' : 'OTP Pending'}
              </span>
              {!secState.phoneVerified && (
                <Button
                  size="sm"
                  variant="primary"
                  onClick={handleSendPhoneOtp}
                >
                  Request OTP
                </Button>
              )}
            </div>
          )}
        </div>

        {/* KYC Verification status card */}
        <div className="bg-white border border-[#BDDDFA] p-6 rounded-2xl flex flex-col justify-between space-y-4">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-[#55647C] uppercase tracking-wider">KYC Identity Level</span>
              <h4 className="text-sm font-bold text-[#0F172A]">
                {user?.role === 'doctor' ? 'BMDC License Verification' : 'National NID Document'}
              </h4>
            </div>
            <ShieldCheck className="w-5 h-5 text-[#059669]" />
          </div>

          <div className="flex justify-between items-center pt-2">
            <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase bg-[#E7F0FC] text-[#059669] border border-[#059669]">
              Verified Class A
            </span>
            <span className="text-[9px] text-[#55647C] font-semibold font-mono">Secure Node: #TB-9483</span>
          </div>
        </div>

      </div>

      {/* 2. MULTI-FACTOR AUTHENTICATION SETUP PANEL */}
      <div className="bg-white border border-[#BDDDFA] p-6 rounded-2xl space-y-4">
        <div className="flex justify-between items-center border-b border-[#BDDDFA] pb-2">
          <div>
            <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider flex items-center gap-1.5">
              <Key className="w-4 h-4 text-[#059669]" />
              <span>Multi-Factor Authentication (2FA) Setup</span>
            </h3>
            <p className="text-[10px] text-[#55647C] mt-0.5">Protect account from unauthorized access attempts</p>
          </div>
          {secState.mfaEnabled && (
            <button
              onClick={handleDisableMfa}
              className="bg-red-50 border border-[#FF7A7A] text-[#FF7A7A] px-3 py-1 rounded-[10px] font-bold text-[10px]"
            >
              Disable 2FA
            </button>
          )}
        </div>

        {/* Dynamic 2FA setup screens */}
        {setupStep === null ? (
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 py-2">
            <div>
              <p className="text-xs text-[#334155]">
                Current State: <strong className={secState.mfaEnabled ? 'text-[#059669]' : 'text-[#FF7A7A]'}>{secState.mfaEnabled ? `ENABLED (${secState.mfaType.toUpperCase()})` : 'DISABLED'}</strong>
              </p>
              <p className="text-[11px] text-[#55647C] mt-1">
              </p>
            </div>
            {!secState.mfaEnabled && (
              <Button
                variant="primary"
                onClick={() => setSetupStep('select')}
              >
                Configure MFA
              </Button>
            )}
          </div>
        ) : setupStep === 'select' ? (
          <div className="space-y-4 py-2">
            <h4 className="font-bold text-[#0F172A]">Select Authentication Method</h4>
            <div className="grid grid-cols-3 gap-4">

              {/* Option A: SMS OTP */}
              <button
                type="button"
                onClick={() => { setMfaSelectType('sms'); setSetupStep('sms'); setOtpSent(true); setOtpTimer(60); triggerNotification("SMS OTP Sent", "Your 6-digit OTP is: 123456 (Expires in 5 minutes).", "security"); }}
                className="p-4 rounded-xl border border-[#BDDDFA] bg-[#E7F0FC] text-center hover:bg-white"
              >
                <Smartphone className="w-6 h-6 mx-auto text-[#059669] mb-1" />
                <span className="font-bold block text-[#0F172A]">SMS OTP Code</span>
                <span className="text-[9px] text-[#55647C] mt-0.5">Cellular routing via SMS trunk</span>
              </button>

              {/* Option B: Email OTP */}
              <button
                type="button"
                onClick={() => { setMfaSelectType('email'); setSetupStep('email'); setOtpSent(true); setOtpTimer(60); triggerNotification("Email OTP Sent", "Your 6-digit OTP is: 123456 (Expires in 5 minutes).", "security"); }}
                className="p-4 rounded-xl border border-[#BDDDFA] bg-[#E7F0FC] text-center hover:bg-white"
              >
                <Mail className="w-6 h-6 mx-auto text-[#168CF5] mb-1" />
                <span className="font-bold block text-[#0F172A]">Email OTP Code</span>
                <span className="text-[9px] text-[#55647C] mt-0.5">Secure code sent to verified email inbox</span>
              </button>

              {/* Option C: Google Authenticator */}
              <button
                type="button"
                onClick={() => { setMfaSelectType('totp'); setSetupStep('totp'); }}
                className="p-4 rounded-xl border border-[#BDDDFA] bg-[#E7F0FC] text-center hover:bg-white"
              >
                <QrCode className="w-6 h-6 mx-auto text-[#0F172A] mb-1" />
                <span className="font-bold block text-[#0F172A]">Authenticator App</span>
                <span className="text-[9px] text-[#55647C] mt-0.5">Google Authenticator or compatible app</span>
              </button>

            </div>
            <button onClick={() => setSetupStep(null)} className="text-xs text-[#55647C] hover:underline">Cancel Setup</button>
          </div>
        ) : setupStep === 'totp' ? (
          <form onSubmit={handleMfaSubmit} className="space-y-4 py-2 max-w-md">
            <h4 className="font-bold text-[#0F172A]">Authenticator App Setup</h4>
            <div className="flex gap-4 items-start bg-[#E7F0FC] p-4 border border-[#BDDDFA] rounded-xl">

              {/* SVG QR Code Simulation */}
              <div className="bg-white p-2.5 rounded-lg shrink-0 border border-[#BDDDFA]">
                <svg className="w-24 h-24" viewBox="0 0 100 100">
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

                  <rect x="45" y="45" width="10" height="10" fill="#000" />
                  <rect x="55" y="55" width="10" height="10" fill="#000" />
                  <rect x="45" y="65" width="10" height="15" fill="#000" />
                  <rect x="65" y="45" width="15" height="10" fill="#000" />
                  <rect x="75" y="65" width="15" height="15" fill="#000" />
                </svg>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] text-[#55647C] leading-normal">
                  1. Scan this QR Code with your Authenticator app.<br />
                  2. Enter the 6-digit code below (Enter mock code 123456).
                </p>
                <div className="flex gap-2">
                  <input
                    required
                    type="text"
                    placeholder="123456"
                    value={totpCode}
                    onChange={e => setTotpCode(e.target.value)}
                    className="bg-white border border-[#BDDDFA] rounded-[15px] px-3 py-1.5 text-[#111827] font-mono text-center outline-none w-36"
                  />
                  <Button size="sm" variant="primary" type="submit">Verify</Button>
                </div>
              </div>

            </div>
            <button type="button" onClick={() => setSetupStep('select')} className="text-xs text-[#55647C] hover:underline">Back</button>
          </form>
        ) : setupStep === 'sms' || setupStep === 'email' ? (
          <form onSubmit={handleMfaSubmit} className="space-y-4 py-2 max-w-sm">
            <h4 className="font-bold text-[#0F172A] uppercase">{setupStep} OTP Validation</h4>
            <p className="text-[10px] text-[#55647C]">
              A 6-digit confirmation code has been dispatched to your {setupStep === 'sms' ? 'phone' : 'email address'}. Enter mock code 123456:
            </p>
            <div className="flex gap-2">
              <input
                required
                type="text"
                placeholder="123456"
                value={setupStep === 'sms' ? phoneCode : emailCode}
                onChange={e => setupStep === 'sms' ? setPhoneCode(e.target.value) : setEmailCode(e.target.value)}
                className="bg-[#E7F0FC] rounded-[15px] px-3 py-1.5 text-[#111827] font-mono text-center outline-none w-36"
              />
              <Button size="sm" variant="primary" type="submit">Verify Code</Button>
            </div>
            {otpSent && <p className="text-[9px] text-[#55647C]">Wait {otpTimer}s to request code resend.</p>}
            <button type="button" onClick={() => setSetupStep('select')} className="text-xs text-[#55647C] hover:underline block">Back</button>
          </form>
        ) : (
          /* MFA RECOVERY CODES DISPLAY SCREEN */
          <div className="space-y-4 py-2">
            <div className="bg-[#E7F0FC] border border-[#059669] p-4 rounded-xl flex gap-3 items-start">
              <CheckCircle className="w-5 h-5 text-[#059669] shrink-0" />
              <div>
                <h4 className="font-bold text-[#0F172A]">Two-Factor Authentication Confirmed Successfully</h4>
                <p className="text-[10px] text-[#55647C] leading-normal mt-0.5">
                  Save these backup recovery codes. They can be used to bypass MFA validation if you lose access to your device.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2 bg-[#E7F0FC] p-4 border border-[#BDDDFA] rounded-xl font-mono text-center font-bold text-[#0F172A]">
              {secState.recoveryCodes.map((code, index) => (
                <div key={index} className="bg-white border border-[#BDDDFA] py-1.5 px-2 rounded-lg text-[10px]">
                  {code}
                </div>
              ))}
            </div>

            <Button
              variant="primary"
              onClick={() => setSetupStep(null)}
            >
              Finish Setup
            </Button>
          </div>
        )}

      </div>

      {/* 3. DEVICE MANAGEMENT & ACTIVE SESSIONS */}
      <div className="bg-white border border-[#BDDDFA] p-6 rounded-2xl space-y-4">
        <div className="flex justify-between items-center border-b border-[#BDDDFA] pb-2">
          <div>
            <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider flex items-center gap-1.5">
              <Smartphone className="w-4 h-4 text-[#168CF5]" />
              <span>Device Management &amp; Session Registry</span>
            </h3>
            <p className="text-[10px] text-[#55647C] mt-0.5">Audits active hardware logins and session tokens</p>
          </div>
          {secState.activeSessions.length > 1 && (
            <button
              onClick={handleLogoutAll}
              className="text-[10px] text-[#FF7A7A] hover:underline font-bold bg-red-50 border border-[#FF7A7A]/30 px-2 py-0.5 rounded-[8px]"
            >
              Logout From All Other Devices
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-[#334155]">
            <thead>
              <tr className="border-b border-[#BDDDFA] text-[#0F172A] font-semibold">
                <th className="py-2.5">Access Device</th>
                <th>IP Address</th>
                <th>Approx. Location</th>
                <th>Login Timestamp</th>
                <th>Last Active</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#BDDDFA]/40">
              {secState.activeSessions.map((session) => (
                <tr key={session.id} className="hover:bg-[#E7F0FC]">
                  <td className="py-3 font-bold text-[#0F172A] flex items-center gap-1.5">
                    <Cpu className="w-4 h-4 text-[#55647C]" />
                    <span>{session.device}</span>
                    {session.ip === '103.145.152.12' && (
                      <span className="text-[8px] bg-[#E7F0FC] text-[#059669] border border-[#059669] px-1.5 py-0.5 rounded font-mono">CURRENT</span>
                    )}
                  </td>
                  <td className="font-mono text-[#55647C]">{session.ip}</td>
                  <td className="text-[#334155]">{session.location}</td>
                  <td className="font-mono text-[#55647C]">{session.loginTime}</td>
                  <td className="text-[#059669] font-semibold">{session.lastActive}</td>
                  <td className="text-right py-2">
                    {session.ip !== '103.145.152.12' ? (
                      <button
                        onClick={() => terminateSession(session.id)}
                        className="text-[#FF7A7A] hover:bg-red-50 p-1.5 rounded-lg"
                        title="Force disconnect"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <span className="text-[9px] text-[#55647C] font-semibold uppercase tracking-wider mr-2">Protected</span>
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
        <div className="md:col-span-2 bg-white border border-[#BDDDFA] p-6 rounded-2xl space-y-4">
          <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider border-b border-[#BDDDFA] pb-2 flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-[#FF7A7A]" />
            <span>Identity Alert Log Events</span>
          </h3>

          <div className="space-y-3 max-h-[200px] overflow-y-auto pr-1">
            {secState.alerts.map((alert) => (
              <div key={alert.id} className="bg-[#E7F0FC] p-3 rounded-xl border border-[#BDDDFA] flex justify-between items-start gap-4">
                <div className="space-y-1">
                  <h4 className="font-bold text-[#0F172A] flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                    <span>{alert.title}</span>
                  </h4>
                  <p className="text-[10px] text-[#334155]">{alert.message}</p>
                  <p className="text-[9px] text-[#55647C] font-mono">IP: {alert.ip}</p>
                </div>
                <span className="text-[9px] text-[#55647C] font-mono shrink-0">{alert.timestamp}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right col: Credential keys rotations */}
        <div className="bg-white border border-[#BDDDFA] p-6 rounded-2xl space-y-4">
          <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider border-b border-[#BDDDFA] pb-2">Change Password</h3>

          {pwSuccess && (
            <div className="bg-[#E7F0FC] border border-[#059669] text-[#059669] p-2 rounded-lg text-[10px] font-semibold">
              Credentials changed successfully.
            </div>
          )}

          <form onSubmit={handlePasswordSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">Current Password</label>
              <input
                required
                type="password"
                value={passwordForm.current}
                onChange={e => setPasswordForm({ ...passwordForm, current: e.target.value })}
                className="w-full bg-[#E7F0FC] rounded-[15px] p-2.5 text-xs text-[#111827] outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">New Password</label>
              <input
                required
                type="password"
                value={passwordForm.new}
                onChange={e => setPasswordForm({ ...passwordForm, new: e.target.value })}
                className="w-full bg-[#E7F0FC] rounded-[15px] p-2.5 text-xs text-[#111827] outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">Confirm New Password</label>
              <input
                required
                type="password"
                value={passwordForm.confirm}
                onChange={e => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                className="w-full bg-[#E7F0FC] rounded-[15px] p-2.5 text-xs text-[#111827] outline-none"
              />
            </div>
            <Button type="submit" variant="primary" className="w-full">
              Rotate Password
            </Button>
          </form>
        </div>

      </div>

    </div>
  );
};

export default SecurityCenter;
