import React, { useState, useEffect } from 'react';
import { useLanguage } from './LanguageContext';
import { useNotifications } from './NotificationCenter';
import {
  Activity, ShieldCheck, Lock, Upload, User, UserCheck, AlertCircle,
  FileText, CheckCircle2, Globe, Phone, Mail, Clock, ShieldAlert, Key, ArrowLeft
} from 'lucide-react';
import telemedicineHero from '../assets/telemedicine_hero.png';
import { Button } from './ui';

const API_BASE = import.meta.env.VITE_API_BASE || window.location.origin;
const AUTH_API_BASE = import.meta.env.VITE_AUTH_API_BASE || window.location.origin;

export const Auth = ({ onLoginSuccess, onBackToLanding }) => {
  const { lang, toggleLanguage, t } = useLanguage();
  const { triggerNotification } = useNotifications();

  const [isRegister, setIsRegister] = useState(false);
  const [pwdStrength, setPwdStrength] = useState({ score: 0, text: "Weak", color: "bg-red-500" });
  const [step, setStep] = useState(1);
  const [role, setRole] = useState("patient");
  const [loginRole, setLoginRole] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (window.location.pathname.startsWith('/admin') || params.get('portal') === 'admin' || params.get('role') === 'admin') {
        return 'admin';
      }
    }
    return 'patient';
  });

  // Forgot Password / Reset Password states
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [forgotStep, setForgotStep] = useState('request');
  const [forgotEmailOrPhone, setForgotEmailOrPhone] = useState("");
  const [forgotOtpCode, setForgotOtpCode] = useState("");
  const [forgotOtpTimer, setForgotOtpTimer] = useState(300);
  const [forgotOtpSent, setForgotOtpSent] = useState(false);
  const [forgotOtpAttempts, setForgotOtpAttempts] = useState(0);
  const [forgotResetToken, setForgotResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [resetToken, setResetToken] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token') || params.get('reset_token');
    if (token) {
      setResetToken(token);
    }
  }, []);

  useEffect(() => {
    let interval = null;
    if (forgotOtpSent && forgotOtpTimer > 0) {
      interval = setInterval(() => {
        setForgotOtpTimer(prev => prev - 1);
      }, 1000);
    } else if (forgotOtpTimer === 0) {
      setForgotOtpSent(false);
    }
    return () => clearInterval(interval);
  }, [forgotOtpSent, forgotOtpTimer]);

  const [formData, setFormData] = useState({
    username: "", password: "", email: "", first_name: "", last_name: "",
    phone: "", nid: "", bmdc_reg: "", specialty: "", hospital: "", fees: 500,
    address: "", emergency_contact: "", admin_code: "",
    date_of_birth: "", gender: "male", blood_group: "O+"
  });

  const [emailVerified, setEmailVerified] = useState(false);
  const [emailSending, setEmailSending] = useState(false);

  const [smsOtp, setSmsOtp] = useState('');
  const [smsVerified, setSmsVerified] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpTimer, setOtpTimer] = useState(60);
  const [otpRateLimit, setOtpRateLimit] = useState(false);

  const [fileUploaded, setFileUploaded] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [loginMfaRequired, setLoginMfaRequired] = useState(false);
  const [loginMfaType, setLoginMfaType] = useState(null);
  const [loginMfaCode, setLoginMfaCode] = useState('');
  const [loginMfaTimer, setLoginMfaTimer] = useState(60);
  const [tempTokenData, setTempTokenData] = useState(null);
  const [tempUsername, setTempUsername] = useState('');

  const [doctorKycGate, setDoctorKycGate] = useState(false);

  const [lockedOut, setLockedOut] = useState(false);
  const [lockRemaining, setLockRemaining] = useState(0);

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

  useEffect(() => {
    let interval = null;
    if (loginMfaRequired && loginMfaTimer > 0) {
      interval = setInterval(() => {
        setLoginMfaTimer(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [loginMfaRequired, loginMfaTimer]);

  useEffect(() => {
    let interval = null;
    if (lockedOut && lockRemaining > 0) {
      interval = setInterval(() => {
        setLockRemaining(prev => {
          if (prev <= 1) {
            setLockedOut(false);
            localStorage.removeItem(`lockout_${formData.username}`);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [lockedOut, lockRemaining, formData.username]);

  const handlePasswordChange = (pwd) => {
    let score = 0;
    if (pwd.length >= 6) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;

    let text = "Weak";
    let color = "bg-red-500";
    if (score === 2) { text = "Medium"; color = "bg-amber-500"; }
    else if (score >= 3) { text = "Strong"; color = "bg-emerald-600"; }

    setPwdStrength({ score, text, color });
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    if (name === 'password') {
      handlePasswordChange(value);
    }
  };

  const simulateUpload = () => {
    if (fileUploaded) return;
    setUploadProgress(100);
    setFileUploaded(true);
    triggerNotification("KYC Document Loaded", "Verification files ready for hashing.", "security");
  };

  const handleSendEmailLink = () => {
    setEmailSending(false);
    setEmailVerified(true);
    triggerNotification("Email Verified", "Email address successfully verified and bound.", "security");
  };

  const handleSendSmsOtp = () => {
    if (otpRateLimit) return;
    setOtpSent(true);
    setOtpTimer(60);
    triggerNotification("SMS OTP Sent", "Your 6-digit mobile verification code is: 123456 (Expires in 5 minutes).", "security");

    setOtpRateLimit(true);
    setTimeout(() => setOtpRateLimit(false), 60000);
  };

  const handleVerifySms = (e) => {
    e.preventDefault();
    if (smsOtp === '123456') {
      setSmsVerified(true);
      setOtpSent(false);
      triggerNotification("Mobile Verified", "Phone number validated via SMS OTP handshake.", "security");
      setStep(5);
    } else {
      alert("Invalid validation code. Enter 123456.");
    }
  };

  const handleForgotPasswordSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setForgotLoading(true);

    try {
      const resp = await fetch(`${AUTH_API_BASE}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email_or_phone: forgotEmailOrPhone })
      });

      const data = await resp.json();
      if (resp.status === 200) {
        triggerNotification("OTP Dispatched", "A 6-digit security code has been sent.", "security");
        setMessage("A verification code has been sent to your email or mobile number.");
        setForgotStep('otp');
        setForgotOtpSent(true);
        setForgotOtpTimer(300);
      } else {
        setError(data.error || "Failed to initiate recovery request.");
      }
    } catch (err) {
      console.error(err);
      setError("Unable to connect to security authentication service on port 5000.");
    } finally {
      setForgotLoading(false);
    }
  };

  const handleVerifyOtpSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setForgotLoading(true);

    try {
      const resp = await fetch(`${AUTH_API_BASE}/api/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email_or_phone: forgotEmailOrPhone, otp: forgotOtpCode })
      });

      const data = await resp.json();
      if (resp.status === 200) {
        triggerNotification("OTP Verified", "Validation challenge passed. Proceeding to reset.", "security");
        setForgotResetToken(data.reset_token);
        setForgotStep('reset');
        setError("");
        setMessage("");
      } else {
        setError(data.error || "OTP verification failed.");
      }
    } catch (err) {
      console.error(err);
      setError("Connection to verification server failed.");
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResendForgotPasswordOtp = async () => {
    if (forgotOtpTimer > 0) return;
    setError("");
    setMessage("");
    setForgotLoading(true);

    try {
      const resp = await fetch(`${AUTH_API_BASE}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email_or_phone: forgotEmailOrPhone })
      });

      const data = await resp.json();
      if (resp.status === 200) {
        triggerNotification("OTP Resent", "A new code has been dispatched.", "security");
        setMessage("A new verification code has been sent.");
        setForgotOtpCode("");
        setForgotOtpTimer(300);
        setForgotOtpSent(true);
      } else {
        setError(data.error || "Resend failed.");
      }
    } catch (err) {
      console.error(err);
      setError("Server connection failed.");
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setForgotLoading(true);

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      setForgotLoading(false);
      return;
    }

    const tokenToUse = resetToken || forgotResetToken;
    if (!tokenToUse) {
      setError("Authentication session token missing. Please restart the forgot password flow.");
      setForgotLoading(false);
      return;
    }

    try {
      const resp = await fetch(`${AUTH_API_BASE}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reset_token: tokenToUse,
          new_password: newPassword,
          confirm_password: confirmPassword
        })
      });

      const data = await resp.json();
      if (resp.status === 200) {
        triggerNotification("Credentials Updated", "Account password updated. All previous sessions terminated.", "security");
        setForgotStep('success');
        setResetToken(null);
        setForgotResetToken("");
        setNewPassword("");
        setConfirmPassword("");
        window.history.replaceState({}, document.title, window.location.pathname);
      } else {
        setError(data.error || "Reset password finalization failed.");
      }
    } catch (err) {
      console.error(err);
      setError("Security endpoint connection timed out.");
    } finally {
      setForgotLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    const lockoutKey = `lockout_${formData.username}`;
    const lockoutTime = localStorage.getItem(lockoutKey);
    if (lockoutTime && new Date(lockoutTime) > new Date()) {
      const rem = Math.ceil((new Date(lockoutTime) - new Date()) / 1000);
      setLockRemaining(rem);
      setLockedOut(true);
      setError(`Brute Force Lockout: Account locked for ${rem} seconds due to too many failed login .`);
      return;
    }

    try {
      const effectiveLoginRole = loginRole || 'patient';
      const loginPayload = {
        username: formData.username,
        password: formData.password,
        role: effectiveLoginRole
      };

      const resp = await fetch(`${API_BASE}/api/login/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loginPayload)
      });

      const data = await resp.json();
      if (resp.status === 200) {
        const profileResp = await fetch(`${API_BASE}/api/profile/`, {
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${data.access}`
          }
        });

        if (profileResp.status === 200) {
          const profileData = await profileResp.json();
          localStorage.removeItem(`attempts_${formData.username}`);

          if (profileData.role === 'admin') {
            setLoginRole('admin');
          } else if (profileData.role !== effectiveLoginRole) {
            const roleLabels = { doctor: 'Doctor Portal', patient: 'Citizen Portal', admin: 'Administration Portal' };
            const selectedLabel = roleLabels[effectiveLoginRole] || effectiveLoginRole;
            const actualLabel = roleLabels[profileData.role] || profileData.role;

            setError(`Access Restriction: This account is registered as ${actualLabel}. You cannot sign in via the ${selectedLabel} tab. Please select the "${profileData.role === 'doctor' ? 'Doctor' : 'Patient'}" tab above.`);
            return;
          }

          if (profileData.role === 'doctor' && profileData.doctor_profile?.verification_status === 'pending') {
            setDoctorKycGate(true);
            return;
          }
        }

        const secStateKey = `security_state_${formData.username}`;
        const secStateRaw = localStorage.getItem(secStateKey);
        let secState = null;
        if (secStateRaw) {
          try { secState = JSON.parse(secStateRaw); } catch (err) { }
        }

        if (secState && secState.mfaEnabled) {
          setTempTokenData(data);
          setTempUsername(formData.username);
          setLoginMfaType(secState.mfaType || 'totp');
          setLoginMfaRequired(true);
          setLoginMfaTimer(60);
          triggerNotification("2FA Authentication Challenge", `Enter your 6-digit ${secState.mfaType ? secState.mfaType.toUpperCase() : 'TOTP'} code to sign in.`, "security");
          return;
        }

        onLoginSuccess(data.access, data.refresh);
      } else {
        const attemptKey = `attempts_${formData.username}`;
        const currentAttempts = parseInt(localStorage.getItem(attemptKey) || '0', 10) + 1;
        localStorage.setItem(attemptKey, currentAttempts.toString());

        if (currentAttempts >= 5) {
          const lockUntil = new Date(Date.now() + 60000);
          localStorage.setItem(lockoutKey, lockUntil.toISOString());
          setLockedOut(true);
          setLockRemaining(60);
          setError("Too many failed . Account locked for 60 seconds.");
          triggerNotification("Security Lockout", "Brute force defense triggered for this identity.", "security");
        } else {
          setError(data.error || `Invalid username, password, or role selection (${5 - currentAttempts}  remaining).`);
        }
      }
    } catch (err) {
      setError("Failed to connect to authentication server.");
    }
  };

  const handleMfaVerify = (e) => {
    e.preventDefault();
    if (loginMfaCode === '123456') {
      triggerNotification("2FA Signature Passed", "MFA verification passed.", "security");
      onLoginSuccess(tempTokenData.access, tempTokenData.refresh);
    } else {
      setError("Invalid 2FA code. Please enter 123456.");
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    try {
      const registerData = {
        ...formData,
        role: 'patient',
      };

      const resp = await fetch(`${API_BASE}/api/register/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(registerData)
      });

      if (resp.status === 201) {
        const secKey = `security_state_${formData.username}`;
        const initialSecurity = {
          emailVerified: true,
          phoneVerified: true,
          mfaEnabled: false,
          mfaType: null,
          backupEmail: '',
          recoveryCodes: [],
          trustedDevices: [
            { id: 1, name: 'Chrome on Windows 11', ip: '103.145.152.12', location: 'Dhaka, Bangladesh', finger: 'fp_win_chr_938', current: true }
          ],
          activeSessions: [],
          alerts: [
            { id: Date.now(), title: 'Security Registry Seeded', message: 'Account validation initialized.', ip: '127.0.0.1', timestamp: new Date().toLocaleString() }
          ]
        };
        localStorage.setItem(secKey, JSON.stringify(initialSecurity));

        setMessage("Registration successful! Please sign in with your credentials.");
        triggerNotification("Account Created", "Registration completed successfully.", "security");
        setIsRegister(false);
        setStep(1);
        setLoginRole('patient');
        setFileUploaded(false);
        setUploadProgress(0);
        setEmailVerified(false);
        setSmsVerified(false);
      } else {
        const errData = await resp.json();
        let errorMsg = "";
        if (typeof errData === 'object' && errData !== null) {
          errorMsg = Object.entries(errData)
            .map(([field, msgs]) => {
              const fieldLabel = field.replace('_', ' ').toUpperCase();
              const msgText = Array.isArray(msgs) ? msgs.join(' ') : String(msgs);
              return `${fieldLabel}: ${msgText}`;
            })
            .join(' | ');
        } else {
          errorMsg = String(errData);
        }
        setError(errorMsg || "Failed to register. Connect to API server.");
      }
    } catch (err) {
      setError("Failed to register. Connect to API server.");
    }
  };

  return (
    <div className="flex min-h-screen bg-[#F4F6F9] text-[#0F172A]">

      {/* Left Column: visual hero pane */}
      <div className="hidden md:flex md:w-1/2 p-12 flex-col justify-between bg-[#0F172A] text-[#F8FAFC] border-r border-[#1E293B]">

        {/* Top brand header */}
        <div className="flex items-center gap-3">
          <div className="bg-[#059669] p-2.5 rounded-[10px] text-white">
            <Activity className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <span className="text-xl font-extrabold tracking-tight text-[#F8FAFC]">
              Heal<span className="text-[#34D399]">NSight</span>
            </span>
            <span className="block text-[10px] uppercase tracking-wider text-[#94A3B8] font-semibold">Telemedicine Platform</span>
          </div>
        </div>

        {/* Center illustration & info */}
        <div className="my-auto text-center flex flex-col items-center mt-6">
          <div className="w-full max-w-[380px] aspect-[4/3] rounded-2xl overflow-hidden mb-6 border border-[#334155] bg-[#1E293B]">
            <img
              src={telemedicineHero}
              alt="HealNSight Telemedicine Platform"
              className="w-full h-full object-cover"
            />
          </div>
          <h1 className="text-2xl font-bold mb-2 leading-snug tracking-tight text-[#F8FAFC]">
            Secure, Verified Telemedicine for <span className="text-[#34D399]">Bangladesh</span>
          </h1>
          <p className="text-xs max-w-sm mx-auto leading-relaxed text-[#CBD5E1]">

          </p>
        </div>

        {/* Bottom trust indicators */}
        <div className="flex items-center justify-center gap-3 pt-6 border-t border-[#1E293B]">
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-[10px] bg-[#1E293B] border border-[#334155] text-xs font-semibold text-[#CBD5E1]">
            <ShieldCheck className="w-4 h-4 text-[#34D399]" />
            <span>BMDC Verified</span>
          </div>
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-[10px] bg-[#1E293B] border border-[#334155] text-xs font-semibold text-[#CBD5E1]">
            <Lock className="w-4 h-4 text-[#38BDF8]" />
            <span>AES-256 Encrypted</span>
          </div>
        </div>
      </div>

      {/* Right Column: Authentication form */}
      <div className="w-full md:w-1/2 flex items-center justify-center p-6 md:p-12 overflow-y-auto max-h-screen bg-[#F4F6F9]">
        <div className="w-full max-w-[480px] p-8 md:p-10 rounded-2xl border bg-white border-[#BDDDFA] shadow-sm relative">

          {/* Homepage Button */}
          {onBackToLanding && (
            <button
              type="button"
              onClick={onBackToLanding}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#55647C] hover:text-[#0F172A] mb-5 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Homepage</span>
            </button>
          )}

          {/* Language Toggle in Card */}
          <div className="absolute top-6 right-6 hidden md:flex items-center gap-2">
            <button
              type="button"
              onClick={toggleLanguage}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-[10px] border border-[#BDDDFA] text-xs font-bold text-[#0F172A] hover:bg-[#E7F0FC] cursor-pointer"
            >
              <Globe className="w-3.5 h-3.5 text-[#059669]" />
              <span>{lang === 'en' ? 'বাংলা' : 'English'}</span>
            </button>
          </div>

          {/* Mobile Brand Header */}
          <div className="flex flex-col items-center mb-6 md:hidden">
            <div className="flex items-center gap-2.5">
              <div className="bg-[#059669] p-2 rounded-[10px] text-white">
                <Activity className="w-5 h-5 stroke-[2.5]" />
              </div>
              <span className="text-xl font-bold tracking-tight text-[#0F172A]">HealNSight</span>
            </div>
            <p className="text-xs text-[#55647C] font-semibold mt-1">Connected Telemedicine</p>
          </div>

          {/* Error & Message Alerts */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-[#DC2626] rounded-xl p-3.5 text-xs mb-4 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {message && (
            <div className="bg-emerald-50 border border-emerald-200 text-[#059669] rounded-xl p-3.5 text-xs mb-4 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{message}</span>
            </div>
          )}

          {/* --- CASE A: LOGIN MFA CHALLENGE --- */}
          {loginMfaRequired ? (
            <form onSubmit={handleMfaVerify} className="space-y-4">
              <div className="text-center space-y-2 py-2">
                <div className="w-12 h-12 rounded-full bg-[#E7F0FC] border border-[#BDDDFA] flex items-center justify-center mx-auto text-[#059669]">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-[#0F172A]">Multi-Factor Authentication</h3>
                <p className="text-xs text-[#55647C]">Enter the 6-digit security code from your authenticator app.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">6-Digit Code</label>
                <input
                  required
                  type="text"
                  maxLength="6"
                  value={loginMfaCode}
                  onChange={e => setLoginMfaCode(e.target.value.replace(/\D/g, ''))}
                  className="w-full text-center font-mono font-bold text-xl tracking-[6px]"
                  placeholder="123456"
                />
              </div>

              <div className="flex justify-between items-center text-xs text-[#55647C]">
                <span>Code expires in: <strong className="font-mono text-[#0F172A]">{loginMfaTimer}s</strong></span>
                <span className="text-[11px] text-[#55647C]">Demo Code: 123456</span>
              </div>

              <button
                type="submit"
                className="w-full bg-[#059669] hover:bg-[#047857] text-white font-bold py-3 rounded-[10px] text-xs cursor-pointer"
              >
                Verify &amp; Sign In
              </button>

              <button
                type="button"
                onClick={() => { setLoginMfaRequired(false); setLoginMfaCode(""); setError(""); }}
                className="w-full text-center text-xs text-[#55647C] hover:text-[#0F172A] mt-2 underline cursor-pointer"
              >
                Cancel
              </button>
            </form>
          ) : doctorKycGate ? (
            <div className="space-y-4 text-center py-6">
              <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto text-amber-600">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-[#0F172A]">BMDC License Audit Pending</h3>
              <p className="text-xs text-[#55647C] leading-relaxed max-w-sm mx-auto">
                Your medical registration credentials are being audited by administrators. Clinical workspace access will be unlocked upon verification.
              </p>
              <button
                onClick={() => setDoctorKycGate(false)}
                className="px-6 py-2.5 rounded-[10px] bg-white border border-[#BDDDFA] text-xs font-semibold text-[#0F172A] hover:bg-[#F4F6F9] cursor-pointer"
              >
                Back to Login
              </button>
            </div>
          ) : (resetToken || (isForgotPassword && forgotStep === 'reset')) ? (
            <div className="space-y-5">
              <div className="text-center space-y-1">
                <h2 className="text-lg font-bold text-[#0F172A]">Reset Password</h2>
                <p className="text-xs text-[#55647C]">Please enter a secure new password for your account.</p>
              </div>

              <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#0F172A] mb-1">New Password</label>
                  <input
                    required
                    type="password"
                    value={newPassword}
                    onChange={e => { setNewPassword(e.target.value); handlePasswordChange(e.target.value); }}
                    placeholder="••••••••"
                    className="w-full"
                  />

                  {newPassword && (
                    <div className="mt-2 text-xs bg-[#E7F0FC]/60 p-3 rounded-xl border border-[#BDDDFA]">
                      <div className="flex justify-between items-center text-[11px] mb-1">
                        <span className="text-[#55647C]">Strength:</span>
                        <span className={`font-bold ${pwdStrength.score >= 3 ? 'text-emerald-600' : 'text-amber-600'}`}>{pwdStrength.text}</span>
                      </div>
                      <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                        <div className={`h-full ${pwdStrength.color}`} style={{ width: `${(pwdStrength.score / 4) * 100}%` }}></div>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#0F172A] mb-1">Confirm New Password</label>
                  <input
                    required
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full"
                  />
                </div>

                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="w-full bg-[#059669] hover:bg-[#047857] text-white font-bold py-3 rounded-[10px] text-xs cursor-pointer"
                >
                  {forgotLoading ? 'Updating Password...' : 'Update Password'}
                </button>

                <button
                  type="button"
                  onClick={() => { setResetToken(null); setForgotResetToken(""); setForgotStep("request"); setIsForgotPassword(false); setError(""); setMessage(""); }}
                  className="w-full text-center text-xs text-[#55647C] hover:text-[#0F172A] underline cursor-pointer"
                >
                  Back to Login
                </button>
              </form>
            </div>
          ) : isForgotPassword ? (
            <div className="space-y-5">
              {forgotStep === 'request' && (
                <div className="space-y-4">
                  <div className="text-center space-y-1">
                    <h2 className="text-lg font-bold text-[#0F172A]">Forgot Password</h2>
                    <p className="text-xs text-[#55647C]">Enter your registered email or phone to receive a 6-digit OTP code.</p>
                  </div>

                  <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-[#0F172A] mb-1">Email or Phone Number</label>
                      <input
                        required
                        type="text"
                        value={forgotEmailOrPhone}
                        onChange={e => setForgotEmailOrPhone(e.target.value)}
                        placeholder="name@domain.com or +8801..."
                        className="w-full"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={forgotLoading}
                      className="w-full bg-[#059669] hover:bg-[#047857] text-white font-bold py-3 rounded-[10px] text-xs cursor-pointer"
                    >
                      {forgotLoading ? 'Processing request...' : 'Request Verification OTP'}
                    </button>

                    <button
                      type="button"
                      onClick={() => { setIsForgotPassword(false); setForgotStep('request'); setError(""); setMessage(""); }}
                      className="w-full text-center text-xs text-[#55647C] hover:text-[#0F172A] underline cursor-pointer"
                    >
                      Back to Login
                    </button>
                  </form>
                </div>
              )}

              {forgotStep === 'otp' && (
                <div className="space-y-4">
                  <div className="text-center space-y-1">
                    <h2 className="text-lg font-bold text-[#0F172A]">Verify Security OTP</h2>
                    <p className="text-xs text-[#55647C]">Enter the 6-digit code sent to <strong className="text-[#0F172A]">{forgotEmailOrPhone}</strong>.</p>
                  </div>

                  <form onSubmit={handleVerifyOtpSubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-[#0F172A] mb-1">6-Digit Verification Code</label>
                      <input
                        required
                        type="text"
                        maxLength="6"
                        value={forgotOtpCode}
                        onChange={e => setForgotOtpCode(e.target.value.replace(/\D/g, ''))}
                        className="w-full text-center font-mono font-bold text-xl tracking-[6px]"
                        placeholder="••••••"
                      />
                    </div>

                    <div className="flex justify-between items-center text-xs text-[#55647C]">
                      <span>Expires in: <strong className="font-mono text-[#0F172A]">{Math.floor(forgotOtpTimer / 60)}:{(forgotOtpTimer % 60).toString().padStart(2, '0')}</strong></span>
                      <button
                        type="button"
                        onClick={handleResendForgotPasswordOtp}
                        disabled={forgotOtpTimer > 0 || forgotLoading}
                        className={`font-semibold ${forgotOtpTimer === 0 ? 'text-[#059669] hover:underline cursor-pointer' : 'text-slate-400 cursor-not-allowed'}`}
                      >
                        Resend OTP
                      </button>
                    </div>

                    <button
                      type="submit"
                      disabled={forgotLoading || forgotOtpCode.length !== 6}
                      className="w-full bg-[#059669] hover:bg-[#047857] disabled:opacity-50 text-white font-bold py-3 rounded-[10px] text-xs cursor-pointer"
                    >
                      {forgotLoading ? 'Verifying...' : 'Verify OTP Code'}
                    </button>

                    <button
                      type="button"
                      onClick={() => { setForgotStep('request'); setForgotOtpCode(""); setError(""); setMessage(""); }}
                      className="w-full text-center text-xs text-[#55647C] hover:text-[#0F172A] underline cursor-pointer"
                    >
                      Back to Request OTP
                    </button>
                  </form>
                </div>
              )}

              {forgotStep === 'success' && (
                <div className="space-y-4 text-center py-4">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto text-[#059669]">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h2 className="text-base font-bold text-[#0F172A]">Password Reset Successful</h2>
                  <p className="text-xs text-[#55647C] max-w-sm mx-auto">
                    Your password has been updated. You can now log in with your new credentials.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setIsForgotPassword(false);
                      setForgotStep('request');
                      setForgotEmailOrPhone("");
                      setForgotOtpCode("");
                      setError("");
                      setMessage("");
                    }}
                    className="w-full bg-[#059669] hover:bg-[#047857] text-white font-bold py-3 rounded-[10px] text-xs cursor-pointer"
                  >
                    Proceed to Login
                  </button>
                </div>
              )}
            </div>
          ) : !isRegister ? (
            /* --- CASE B: STANDARD LOGIN VIEW --- */
            <div className="space-y-5">
              {/* Login Title */}
              <div className="text-center space-y-1 mb-4">
                <h2 className="text-xl font-bold text-[#0F172A] tracking-tight">
                  Sign In to Heal<span className="text-[#059669]">NSight</span>
                </h2>
                <p className="text-xs text-[#55647C]">Telemedicine Portal</p>
              </div>

              {/* Portal Role Selector */}
              <div className="space-y-1.5 mb-4">
                <label className="block text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider text-center">
                  Select your portal role
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setLoginRole("patient")}
                    className={`flex flex-col items-center p-3 rounded-xl border text-left cursor-pointer ${loginRole === 'patient'
                      ? 'border-[#059669] bg-[#E7F0FC] text-[#0F172A]'
                      : 'border-[#BDDDFA] bg-white text-[#55647C] hover:bg-[#F4F6F9]'
                      }`}
                  >
                    <div className={`w-8 h-8 rounded-[8px] flex items-center justify-center mb-1 ${loginRole === 'patient' ? 'bg-[#059669] text-white' : 'bg-[#E7F0FC] text-[#059669]'}`}>
                      <User className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold text-[#0F172A]">Patient</span>
                    <span className="text-[10px] text-[#55647C]">Citizen Portal</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLoginRole("doctor")}
                    className={`flex flex-col items-center p-3 rounded-xl border text-left cursor-pointer ${loginRole === 'doctor'
                      ? 'border-[#059669] bg-[#E7F0FC] text-[#0F172A]'
                      : 'border-[#BDDDFA] bg-white text-[#55647C] hover:bg-[#F4F6F9]'
                      }`}
                  >
                    <div className={`w-8 h-8 rounded-[8px] flex items-center justify-center mb-1 ${loginRole === 'doctor' ? 'bg-[#059669] text-white' : 'bg-[#E7F0FC] text-[#059669]'}`}>
                      <UserCheck className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold text-[#0F172A]">Doctor</span>
                    <span className="text-[10px] text-[#55647C]">BMDC Licensed</span>
                  </button>
                </div>
              </div>

              {/* Login Form */}
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">Username / Email</label>
                  <input
                    required
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={handleChange}
                    placeholder="e.g. niloy"
                    className="w-full"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-xs font-semibold text-[#0F172A]">Password</label>
                    <button
                      type="button"
                      onClick={() => { setIsForgotPassword(true); setForgotStep('request'); setForgotEmailOrPhone(""); setForgotOtpCode(""); setForgotOtpSent(false); setError(""); setMessage(""); }}
                      className="text-xs text-[#059669] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      Forgot Password?
                    </button>
                  </div>
                  <input
                    required
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="••••••••••"
                    className="w-full"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full font-bold py-3.5 rounded-[10px] text-xs bg-[#059669] hover:bg-[#047857] text-white flex items-center justify-center gap-2 cursor-pointer mt-2"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Sign In to HealNSight</span>
                </button>
              </form>

              <div className="text-center pt-2 border-t border-[#BDDDFA]/60 text-xs text-[#55647C]">
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => { setIsRegister(true); setError(""); setMessage(""); }}
                  className="font-bold text-[#059669] hover:underline cursor-pointer"
                >
                  Register as Citizen
                </button>
              </div>
            </div>
          ) : (
            /* --- CASE C: REGISTRATION FLOW --- */
            <form onSubmit={handleRegisterSubmit} className="space-y-4 text-xs">
              <div className="text-center space-y-1 mb-2">
                <h2 className="text-lg font-bold text-[#0F172A]">Registration</h2>
                <p className="text-xs text-[#55647C]">Create your patient account</p>
              </div>

              {step === 1 && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-[#0F172A] mb-1">First Name</label>
                      <input required type="text" name="first_name" value={formData.first_name} onChange={handleChange} placeholder="First name" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#0F172A] mb-1">Last Name</label>
                      <input required type="text" name="last_name" value={formData.last_name} onChange={handleChange} placeholder="Last name" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-[#0F172A] mb-1">Username</label>
                      <input required type="text" name="username" value={formData.username} onChange={handleChange} placeholder="Username" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#0F172A] mb-1">Phone Number</label>
                      <input required type="tel" name="phone" placeholder="+8801..." value={formData.phone} onChange={handleChange} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-[#0F172A] mb-1">Email</label>
                      <input required type="email" name="email" value={formData.email} onChange={handleChange} placeholder="name@domain.com" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#0F172A] mb-1">Password</label>
                      <input required type="password" name="password" value={formData.password} onChange={handleChange} placeholder="••••••••" />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="w-full bg-[#059669] hover:bg-[#047857] text-white font-bold py-3 rounded-[10px] text-xs cursor-pointer mt-2"
                  >
                    Next Step &rarr;
                  </button>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-[#0F172A] mb-1">Blood Group</label>
                      <select name="blood_group" value={formData.blood_group} onChange={handleChange}>
                        {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => (
                          <option key={bg} value={bg}>{bg}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#0F172A] mb-1">Gender</label>
                      <select name="gender" value={formData.gender} onChange={handleChange}>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#0F172A] mb-1">Date of Birth</label>
                    <input type="date" name="date_of_birth" value={formData.date_of_birth} onChange={handleChange} />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#0F172A] mb-1">Residential Address</label>
                    <input type="text" name="address" value={formData.address} onChange={handleChange} placeholder="Street, City, Division" />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="w-1/3 bg-white border border-[#BDDDFA] text-[#0F172A] font-semibold py-3 rounded-[10px] text-xs cursor-pointer"
                    >
                      &larr; Back
                    </button>
                    <button
                      type="submit"
                      className="w-2/3 bg-[#059669] hover:bg-[#047857] text-white font-bold py-3 rounded-[10px] text-xs cursor-pointer"
                    >
                      Complete Registration
                    </button>
                  </div>
                </div>
              )}

              <div className="text-center pt-2 border-t border-[#BDDDFA]/60 text-xs text-[#55647C]">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => { setIsRegister(false); setStep(1); setError(""); setMessage(""); }}
                  className="font-bold text-[#059669] hover:underline cursor-pointer"
                >
                  Sign In
                </button>
              </div>
            </form>
          )}

        </div>
      </div>
    </div>
  );
};
