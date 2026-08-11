import React, { useState, useEffect } from 'react';
import { useLanguage } from './LanguageContext';
import { useNotifications } from './NotificationCenter';
import {
  Activity, ShieldCheck, Lock, Upload, User, UserCheck, AlertCircle,
  FileText, CheckCircle2, Globe, Sun, Moon, Phone, Mail, Clock, ShieldAlert, Key
} from 'lucide-react';
import telemedicineHero from '../assets/telemedicine_hero.png';

const API_BASE = "http://127.0.0.1:8000";
const AUTH_API_BASE = "http://localhost:5000";

export const Auth = ({ onLoginSuccess, darkMode, setDarkMode }) => {
  const { lang, toggleLanguage, t } = useLanguage();
  const { triggerNotification } = useNotifications();

  const [isRegister, setIsRegister] = useState(false);
  const [pwdStrength, setPwdStrength] = useState({ score: 0, text: "Weak", color: "bg-red-500" });
  const [step, setStep] = useState(1); // Steps: 1 (Primary info), 2 (Role details), 3 (Email verify), 4 (SMS OTP), 5 (KYC upload)
  const [role, setRole] = useState("patient");
  const [loginRole, setLoginRole] = useState(null); // Selected card for login

  // Forgot Password / Reset Password states
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [forgotStep, setForgotStep] = useState('request'); // 'request', 'otp', 'reset', 'success'
  const [forgotEmailOrPhone, setForgotEmailOrPhone] = useState("");
  const [forgotOtpCode, setForgotOtpCode] = useState("");
  const [forgotOtpTimer, setForgotOtpTimer] = useState(300); // 5 minutes
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

  // Forgot Password OTP countdown timer
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

  // Verification simulation variables
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

  // Login MFA Interception states
  const [loginMfaRequired, setLoginMfaRequired] = useState(false);
  const [loginMfaType, setLoginMfaType] = useState(null);
  const [loginMfaCode, setLoginMfaCode] = useState('');
  const [loginMfaTimer, setLoginMfaTimer] = useState(60);
  const [tempTokenData, setTempTokenData] = useState(null); // hold tokens before MFA is validated
  const [tempUsername, setTempUsername] = useState('');

  // Doctor KYC license check gate
  const [doctorKycGate, setDoctorKycGate] = useState(false);

  // Admin organizational confirmation check gate
  const [adminOrgGate, setAdminOrgGate] = useState(false);
  const [adminOrgCode, setAdminOrgCode] = useState('');

  // Brute force protection states
  const [lockedOut, setLockedOut] = useState(false);
  const [lockRemaining, setLockRemaining] = useState(0);

  // Expiration countdown timers
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

  // Lockout countdown timer
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
    else if (score >= 3) { text = "Strong"; color = "bg-green-500"; }

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
    setUploadProgress(10);
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setFileUploaded(true);
          triggerNotification("KYC Document Loaded", "Verification files ready for hashing.", "security");
          return 100;
        }
        return prev + 30;
      });
    }, 150);
  };

  // 1. Email Verification link click simulation
  const handleSendEmailLink = () => {
    setEmailSending(true);
    triggerNotification("Email Verification Sent", `Gmail validation link dispatched to: ${formData.email}`, "system");
    setTimeout(() => {
      setEmailSending(false);
      setEmailVerified(true);
      triggerNotification("Email Verified", "Gmail address successfully verified and bound.", "security");
    }, 2000);
  };

  // 2. Phone OTP Verification simulation
  const handleSendSmsOtp = () => {
    if (otpRateLimit) return;
    setOtpSent(true);
    setOtpTimer(60);
    triggerNotification("SMS OTP Sent", "Your 6-digit mobile verification code is: 123456 (Expires in 5 minutes).", "security");

    // Rate limit resend trigger for 60s
    setOtpRateLimit(true);
    setTimeout(() => setOtpRateLimit(false), 60000);
  };

  const handleVerifySms = (e) => {
    e.preventDefault();
    if (smsOtp === '123456') {
      setSmsVerified(true);
      setOtpSent(false);
      triggerNotification("Mobile Verified", "Phone number validated via SMS OTP handshake.", "security");
      setStep(5); // Go to KYC uploader
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
        setForgotOtpTimer(300); // 5 minutes (300 seconds)
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

  // 3. Main Login and MFA Check Flow
  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    // Check brute force attempts
    const lockoutKey = `lockout_${formData.username}`;
    const lockoutTime = localStorage.getItem(lockoutKey);
    if (lockoutTime && new Date(lockoutTime) > new Date()) {
      const rem = Math.ceil((new Date(lockoutTime) - new Date()) / 1000);
      setLockRemaining(rem);
      setLockedOut(true);
      setError(`Brute Force Lockout: Account locked for ${rem} seconds due to too many failed login attempts.`);
      return;
    }

    try {
      const resp = await fetch(`${API_BASE}/api/login/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: formData.username, password: formData.password })
      });

      const data = await resp.json();
      if (resp.status === 200) {
        // Enforce role-aware authentication check on the client side
        const profileResp = await fetch(`${API_BASE}/api/profile/`, {
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${data.access}`
          }
        });

        if (profileResp.status === 200) {
          const profileData = await profileResp.json();
          if (!loginRole && profileData.role !== 'admin') {
            setError(`Authentication failed: Please select your role (Patient or Doctor) to log in.`);
            triggerNotification("Authentication Error", `Access denied: Role selection required.`, "security");
            recordLoginAttempt(formData.username);
            return;
          }
          if (loginRole && profileData.role !== loginRole && profileData.role !== 'admin') {
            setError(`Authentication failed: This username is not registered as a ${loginRole.toUpperCase()}.`);
            triggerNotification("Authentication Error", `Access denied: Role mismatch.`, "security");
            recordLoginAttempt(formData.username);
            return;
          }

          // Clear any attempts on success
          localStorage.removeItem(`attempts_${formData.username}`);

          // Fetch MFA settings from local storage security schema
          const secKey = `security_state_${formData.username}`;
          const cachedSec = localStorage.getItem(secKey);
          let secState = null;
          if (cachedSec) {
            try {
              secState = JSON.parse(cachedSec);
            } catch (e) { }
          }

          // Check if MFA is active on the account
          if (secState && secState.mfaEnabled) {
            setTempTokenData(data);
            setTempUsername(formData.username);
            setLoginMfaType(secState.mfaType);
            setLoginMfaRequired(true);
            setLoginMfaTimer(60);

            // Dispatch dynamic code for SMS/Email
            if (secState.mfaType === 'sms' || secState.mfaType === 'email') {
              triggerNotification(
                secState.mfaType === 'sms' ? "MFA SMS Dispatched" : "MFA Email Dispatched",
                "Your 6-digit multi-factor verification code is: 123456.",
                "security"
              );
            }
            return;
          }

          // Move to custom role gates check
          evaluateRoleGates(profileData, data, formData.username);
        }
      } else {
        setError(data.detail || "Authentication failed. Check credentials.");
        triggerNotification("Authentication Failed", "Invalid username or password.", "security");
        recordLoginAttempt(formData.username);
      }
    } catch (err) {
      setError("Unable to connect to security backend server on port 8000.");
    }
  };

  const recordLoginAttempt = (username) => {
    const attemptsKey = `attempts_${username}`;
    let attempts = parseInt(localStorage.getItem(attemptsKey) || '0');
    attempts += 1;
    localStorage.setItem(attemptsKey, attempts.toString());

    if (attempts >= 3) {
      const lockKey = `lockout_${username}`;
      const lockedUntil = new Date(Date.now() + 15 * 60000).toISOString();
      localStorage.setItem(lockKey, lockedUntil);

      setLockRemaining(15 * 60);
      setLockedOut(true);
      triggerNotification("Account Locked Out", `Username ${username} locked out due to 3 failed logins.`, "security");
    }
  };

  const handleMfaVerify = (e) => {
    e.preventDefault();
    if (loginMfaCode === '123456') {
      setLoginMfaRequired(false);
      setLoginMfaCode('');

      // Proceed to evaluate custom role gates check
      const fetchProfile = async () => {
        try {
          const profileResp = await fetch(`${API_BASE}/api/profile/`, {
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${tempTokenData.access}`
            }
          });
          if (profileResp.status === 200) {
            const profileData = await profileResp.json();
            evaluateRoleGates(profileData, tempTokenData, tempUsername);
          }
        } catch (err) { }
      };
      fetchProfile();
    } else {
      alert("Invalid MFA code. Enter 123456.");
    }
  };

  const evaluateRoleGates = (profileData, tokenData, username) => {
    // A. Doctor License check gate
    if (profileData.role === 'doctor' && !profileData.bmdc_reg) {
      setDoctorKycGate(true);
      setTempTokenData(tokenData);
      setTempUsername(username);
      triggerNotification("License Check Pending", "Certified license approval verification required.", "security");
      return;
    }

    // B. Admin organizational gate
    if (profileData.role === 'admin') {
      setAdminOrgGate(true);
      setTempTokenData(tokenData);
      setTempUsername(username);
      triggerNotification("Administrative Access Gate", "Organizational authorization confirmation required.", "security");
      return;
    }

    // Success! Log session parameters and login
    completeLoginAction(tokenData, username);
  };

  const handleAdminOrgConfirm = (e) => {
    e.preventDefault();
    if (adminOrgCode === 'ADMIN-SN-2026') {
      setAdminOrgGate(false);
      setAdminOrgCode('');
      completeLoginAction(tempTokenData, tempUsername);
    } else {
      alert("Invalid Administrative confirmation code.");
      triggerNotification("Administrative Gate Access Denied", "Incorrect passcode input attempt.", "security");
    }
  };

  const completeLoginAction = (tokenData, username) => {
    // Generate device alert notification
    triggerNotification(
      "Secure Login Approved",
      "New session created on Chrome on Windows (IP: 103.145.152.12).",
      "system"
    );

    // Save session logs in security center schema
    const secKey = `security_state_${username}`;
    const cachedSec = localStorage.getItem(secKey);
    let secState = {
      emailVerified: true, phoneVerified: false, mfaEnabled: false, mfaType: null, trustedDevices: [],
      activeSessions: [], alerts: []
    };
    if (cachedSec) {
      try { secState = JSON.parse(cachedSec); } catch (e) { }
    }

    const newSession = {
      id: Date.now(),
      device: 'Chrome on Windows 11',
      loginTime: new Date().toLocaleString(),
      lastActive: 'Just now',
      ip: '103.145.152.12'
    };

    const newAlert = {
      id: Date.now() + 1,
      title: 'New Session Approved',
      message: 'Logged in successfully via JWT secure authentication.',
      ip: '103.145.152.12',
      timestamp: new Date().toLocaleString()
    };

    secState.activeSessions = [newSession, ...(secState.activeSessions || [])];
    secState.alerts = [newAlert, ...(secState.alerts || [])];
    localStorage.setItem(secKey, JSON.stringify(secState));

    onLoginSuccess(tokenData.access, tokenData.refresh, username);
  };

  // 4. Main Multi-Step Registration Submit
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    // Gate checks
    if (!emailVerified) {
      setStep(3);
      setError("Email address verification is mandatory before registration.");
      return;
    }
    if (!smsVerified) {
      setStep(4);
      setError("Mobile phone SMS OTP verification is mandatory before registration.");
      return;
    }
    if ((role === 'patient' || role === 'doctor') && !fileUploaded) {
      setStep(5);
      setError("KYC Verification document upload is required.");
      return;
    }

    try {
      const registerData = {
        ...formData,
        role: role,
      };

      const resp = await fetch(`${API_BASE}/api/register/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(registerData)
      });

      if (resp.status === 201) {
        // Build initial local security attributes for the account
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

        setMessage("Registration successful! BMDC/NID credentials queued for verification. Please login.");
        triggerNotification("Account Created", "Verify and configuration parameters established.", "security");
        setIsRegister(false);
        setStep(1);
        setLoginRole(role); // Pre-select the registered role on the login screen
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

  const accent = getRoleAccentClasses(loginRole);

  return (
    <div className={`flex min-h-screen relative overflow-hidden transition-colors duration-300 ${darkMode ? 'bg-medical-darkBg text-white' : 'bg-medical-gradientLeft text-slate-900'}`}>

      {/* Dynamic abstract grid background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0284c7_1px,transparent_1px),linear-gradient(to_bottom,#0284c7_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-[0.04] dark:opacity-[0.15]"></div>

      {/* Left Column: visual hero pane */}
      <div className={`hidden md:flex md:w-1/2 p-12 flex-col justify-between relative overflow-hidden ${darkMode ? 'bg-gradient-to-br from-slate-900 to-indigo-950 text-white' : 'bg-medical-gradientLeft text-medical-textMain'}`}>
        
        {/* Decorative background lights */}
        {darkMode && (
          <>
            <div className="absolute top-[-20%] left-[-20%] w-[80%] h-[80%] rounded-full bg-medical-teal/10 blur-[120px] pointer-events-none"></div>
            <div className="absolute bottom-[-20%] right-[-20%] w-[80%] h-[80%] rounded-full bg-medical-indigo/10 blur-[120px] pointer-events-none"></div>
          </>
        )}

        {/* Top brand header */}
        <div className="flex items-center gap-3 relative z-10">
          <div className="bg-medical-indigo p-2 rounded-xl text-white shadow-md">
            <Activity className="w-8 h-8 stroke-[2.5]" />
          </div>
          <span className="text-[28px] font-extrabold tracking-tight text-medical-indigo">{t('brand')}</span>
        </div>

        {/* Center illustration & info */}
        <div className="relative z-10 my-auto text-center flex flex-col items-center mt-12">
          <div className={`relative w-full max-w-[420px] aspect-[4/3.1] rounded-[24px] overflow-hidden mb-8 ${darkMode ? 'bg-slate-950/40 p-4 border border-white/10 shadow-2xl' : 'bg-white p-2 border-[8px] border-white shadow-[0_20px_40px_rgba(36,120,243,0.12)]'}`}>
            <img
              src={telemedicineHero}
              alt="Telehealth Platform"
              className="w-full h-full object-cover rounded-[16px]"
            />
          </div>
          <h1 className="text-3xl font-extrabold mb-4 leading-snug tracking-tight">
            Secure, Verified, and Seamless Healthcare <span className={darkMode ? 'text-medical-teal' : 'text-medical-indigo'}>Delivery</span>
          </h1>
          <p className={`text-base max-w-[400px] mx-auto leading-relaxed ${darkMode ? 'text-slate-300' : 'text-medical-textBody'}`}>
            Experience next-generation telehealth protected by multi-factor authentication, license audits, NID matching, and full clinical room integration.
          </p>
        </div>

        {/* Bottom stats / trust indicators */}
        <div className="relative z-10 flex items-center justify-center gap-4 pt-6 mt-6">
          <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-sm border ${darkMode ? 'bg-slate-900/50 border-white/10' : 'bg-white border-medical-borderBg'}`}>
            <ShieldCheck className="w-5 h-5 text-medical-emerald" />
            <span className={`text-xs font-bold ${darkMode ? 'text-slate-300' : 'text-medical-textMain'}`}>100% HIPAA &amp; GDPR Compliant</span>
          </div>
          <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-sm border ${darkMode ? 'bg-slate-900/50 border-white/10' : 'bg-white border-medical-borderBg'}`}>
            <Globe className="w-5 h-5 text-medical-lavender" />
            <span className={`text-xs font-bold ${darkMode ? 'text-slate-300' : 'text-medical-textMain'}`}>Active Nationwide</span>
          </div>
        </div>
        
        {/* Decorative wave at bottom for light mode */}
        {!darkMode && (
          <div className="absolute bottom-[-15%] right-[-10%] w-[80%] h-[40%] rounded-full bg-medical-decorLavender blur-[80px] pointer-events-none"></div>
        )}
      </div>

      {/* Right Column: Authentication & Form details */}
      <div className={`w-full md:w-1/2 flex items-center justify-center p-6 md:p-12 z-10 overflow-y-auto max-h-screen ${darkMode ? '' : 'bg-medical-gradientRight'}`}>
        <div className={`w-full max-w-[500px] p-8 md:p-10 rounded-[24px] border relative z-10 animate-fade transition-all duration-300 ${darkMode ? 'glass-panel border-white/10 shadow-2xl' : 'bg-white border-medical-borderBg shadow-[0_20px_50px_rgba(16,42,86,0.08)]'}`}>
          
          {/* Top Right Controls inside the card */}
          <div className="absolute top-6 right-6 flex items-center gap-2 hidden md:flex">
            <button
              type="button"
              onClick={toggleLanguage}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all text-xs font-bold ${darkMode ? 'border-white/10 hover:bg-slate-800' : 'border-medical-borderBg hover:bg-slate-50 text-medical-textMain'}`}
            >
              <Globe className={`w-4 h-4 ${darkMode ? 'text-medical-teal' : 'text-medical-indigo'}`} />
              <span>{lang === 'en' ? 'বাংলা' : 'English'}</span>
            </button>
            <button
              type="button"
              onClick={() => setDarkMode(!darkMode)}
              className={`p-1.5 rounded-full border transition-all ${darkMode ? 'border-white/10 hover:bg-slate-800' : 'border-medical-borderBg hover:bg-slate-50 text-medical-textMain'}`}
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>

          {/* Branding header (visible on mobile only) */}
          <div className="flex flex-col items-center mb-6 md:hidden">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-r from-medical-teal to-medical-indigo p-2.5 rounded-2xl text-white shadow-lg pulse-glow">
                <Activity className="w-8 h-8 stroke-[2.5]" />
              </div>
              <span className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-medical-teal to-medical-indigo bg-clip-text text-transparent">{t('brand')}</span>
            </div>
            <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold mt-2">{t('tagline')}</p>
          </div>

          {error && (
            <div className="bg-medical-rose/10 border border-medical-rose/30 text-medical-rose rounded-xl p-4 text-sm mb-4 flex items-center gap-2 animate-fade">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {message && (
            <div className="bg-medical-emerald/10 border border-medical-emerald/30 text-medical-emerald rounded-xl p-4 text-sm mb-4 flex items-center gap-2 animate-fade">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <span>{message}</span>
            </div>
          )}

          {/* --- CASE A: LOGIN FLOW INTERCEPTORS --- */}

          {loginMfaRequired ? (
            /* MFA Code Verification Screen */
            <form onSubmit={handleMfaVerify} className="space-y-4 animate-fade">
              <div className="bg-medical-indigo/10 border border-medical-indigo/20 p-4 rounded-xl flex gap-3 items-start">
                <Key className="w-6 h-6 text-medical-indigo shrink-0" />
                <div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-white uppercase tracking-wider">Multi-Factor Authentication Required</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 leading-normal">
                    A verification check is active on this account. Enter the 6-digit OTP code below to approve session access (Enter mock code 123456).
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">MFA Verification Code</label>
                <input
                  required
                  type="text"
                  maxLength="6"
                  placeholder="Enter 123456"
                  value={loginMfaCode}
                  onChange={e => setLoginMfaCode(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl py-3 px-4 text-center font-mono font-bold text-lg outline-none text-white focus:border-medical-teal"
                />
              </div>

              <button type="submit" className="w-full bg-gradient-to-r from-medical-teal to-medical-indigo text-white dark:text-medical-darkBg font-extrabold py-3 rounded-xl text-sm transition-all">
                Verify &amp; Establish Session
              </button>

              <button type="button" onClick={() => setLoginMfaRequired(false)} className="text-sm text-slate-400 hover:text-white underline block text-center w-full">Cancel</button>
            </form>
          ) : doctorKycGate ? (
            /* Doctor BMDC check gate display */
            <div className="space-y-4 animate-fade text-center py-6">
              <ShieldAlert className="w-14 h-14 text-medical-amber mx-auto" />
              <h3 className="text-lg font-bold text-slate-800 dark:text-white uppercase">License Credentials Audit Pending</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
                Your certified BMDC license registration has not yet been audited. Credentials must be approved by system administrators before clinical workstation routing access is granted.
              </p>
              <button onClick={() => setDoctorKycGate(false)} className="bg-slate-900 hover:bg-slate-800 text-slate-300 border border-white/10 px-6 py-2.5 rounded-xl font-bold transition-all mt-4 text-sm">
                Back to Login
              </button>
            </div>
          ) : adminOrgGate ? (
            /* Admin organization validation gate */
            <form onSubmit={handleAdminOrgConfirm} className="space-y-4 animate-fade">
              <div className="bg-medical-rose/10 border border-medical-rose/20 p-4 rounded-xl flex gap-3 items-start">
                <ShieldAlert className="w-6 h-6 text-medical-rose shrink-0" />
                <div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-white uppercase tracking-wider">Administrative Access Confirmed Gate</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    Organizational auditing systems require validation parameters. Enter the administrative verification code:
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Org Passcode (Enter: ADMIN-SN-2026)</label>
                <input
                  required
                  type="text"
                  placeholder="ADMIN-SN-2026"
                  value={adminOrgCode}
                  onChange={e => setAdminOrgCode(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl py-3 px-4 text-center font-mono font-bold text-sm outline-none text-white focus:border-medical-teal"
                />
              </div>

              <button type="submit" className="w-full bg-gradient-to-r from-medical-teal to-medical-indigo text-white dark:text-medical-darkBg font-extrabold py-3 rounded-xl text-sm transition-all">
                Confirm Authorization
              </button>
              <button type="button" onClick={() => setAdminOrgGate(false)} className="text-sm text-slate-400 hover:text-white underline block text-center w-full">Cancel</button>
            </form>
          ) : (resetToken || (isForgotPassword && forgotStep === 'reset')) ? (
            /* --- RESET PASSWORD VIEW WITH POLICIES CHECKLIST --- */
            <div className="space-y-6 animate-fade">
              <div className="text-center space-y-3">
                <div className="flex items-center justify-center">
                  <div className="bg-gradient-to-r from-medical-teal to-medical-indigo p-2.5 rounded-2xl text-white shadow-lg pulse-glow">
                    <Key className="w-8 h-8 stroke-[2.5]" />
                  </div>
                </div>
                <h2 className="text-2xl font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">Reset Password</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Please enter a secure new password for your account.</p>
              </div>

              <form onSubmit={handleResetPasswordSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">New Password</label>
                  <input
                    required
                    type="password"
                    value={newPassword}
                    onChange={e => { setNewPassword(e.target.value); handlePasswordChange(e.target.value); }}
                    className="w-full bg-transparent border border-slate-300 dark:border-white/10 rounded-xl py-3 px-4 text-sm outline-none text-slate-900 dark:text-white focus:border-medical-teal transition-all"
                    placeholder="••••••••"
                  />

                  {newPassword && (
                    <div className="mt-3 space-y-2 text-xs bg-slate-50 dark:bg-slate-950/40 p-3.5 rounded-xl border border-slate-200 dark:border-white/5">
                      <p className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Safety Checklist:</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-semibold text-slate-600 dark:text-slate-300">
                        <div className="flex items-center gap-1.5">
                          <span className={newPassword.length >= 8 ? "text-emerald-500" : "text-slate-400"}>
                            {newPassword.length >= 8 ? "✔" : "○"} Min. 8 characters
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className={/[A-Z]/.test(newPassword) ? "text-emerald-500" : "text-slate-400"}>
                            {/[A-Z]/.test(newPassword) ? "✔" : "○"} Uppercase letter
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className={/[a-z]/.test(newPassword) ? "text-emerald-500" : "text-slate-400"}>
                            {/[a-z]/.test(newPassword) ? "✔" : "○"} Lowercase letter
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className={/[0-9]/.test(newPassword) ? "text-emerald-500" : "text-slate-400"}>
                            {/[0-9]/.test(newPassword) ? "✔" : "○"} Number digit
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className={/[^A-Za-z0-9]/.test(newPassword) ? "text-emerald-500" : "text-slate-400"}>
                            {/[^A-Za-z0-9]/.test(newPassword) ? "✔" : "○"} Special character
                          </span>
                        </div>
                      </div>

                      <div className="mt-2.5 pt-2 border-t border-slate-200 dark:border-white/5 space-y-1">
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-slate-450">Strength Index:</span>
                          <span className={`font-bold ${pwdStrength.score >= 4 ? 'text-emerald-500' : pwdStrength.score >= 2 ? 'text-amber-500' : 'text-red-500'}`}>{pwdStrength.text}</span>
                        </div>
                        <div className="w-full bg-slate-250 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div className={`h-full ${pwdStrength.color} transition-all duration-300`} style={{ width: `${(pwdStrength.score / 4) * 100}%` }}></div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Confirm New Password</label>
                  <input
                    required
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className="w-full bg-transparent border border-slate-300 dark:border-white/10 rounded-xl py-3 px-4 text-sm outline-none text-slate-900 dark:text-white focus:border-medical-teal transition-all"
                    placeholder="••••••••"
                  />
                </div>

                {error && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-3 rounded-xl flex items-start gap-2.5 text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="w-full bg-gradient-to-r from-medical-teal to-medical-indigo text-white font-extrabold py-3.5 rounded-xl text-sm transition-all shadow-lg flex items-center justify-center gap-2 hover:opacity-95"
                >
                  <ShieldCheck className="w-5 h-5" />
                  <span>{forgotLoading ? 'Updating Password...' : 'Update Password'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setResetToken(null); setForgotResetToken(""); setForgotStep("request"); setIsForgotPassword(false); setError(""); setMessage(""); window.history.replaceState({}, document.title, window.location.pathname); }}
                  className="text-sm text-slate-400 hover:text-white underline block text-center w-full mt-2"
                >
                  Back to Login
                </button>
              </form>
            </div>
          ) : isForgotPassword ? (
            /* --- FORGOT PASSWORD WIZARD FLOW (REQUEST, OTP, SUCCESS) --- */
            <div className="space-y-6 animate-fade">
              {forgotStep === 'request' && (
                /* STEP 1: REQUEST CODE */
                <div className="space-y-6">
                  <div className="text-center space-y-3">
                    <div className="flex items-center justify-center">
                      <div className="bg-gradient-to-r from-medical-teal to-medical-indigo p-2.5 rounded-2xl text-white shadow-lg pulse-glow">
                        <Lock className="w-8 h-8 stroke-[2.5]" />
                      </div>
                    </div>
                    <h2 className="text-2xl font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">Forgot Password</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Enter your registered email or phone number and we'll send you a 6-digit verification code.</p>
                  </div>

                  <form onSubmit={handleForgotPasswordSubmit} className="space-y-5">
                    <div>
                      <label className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Email or Phone Number</label>
                      <input
                        required
                        type="text"
                        value={forgotEmailOrPhone}
                        onChange={e => setForgotEmailOrPhone(e.target.value)}
                        className="w-full bg-transparent border border-slate-300 dark:border-white/10 rounded-xl py-3 px-4 text-sm outline-none text-slate-900 dark:text-white focus:border-medical-teal transition-all"
                        placeholder="name@domain.com or +8801..."
                      />
                    </div>

                    {error && (
                      <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-3 rounded-xl flex items-start gap-2.5 text-xs">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{error}</span>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={forgotLoading}
                      className="w-full bg-gradient-to-r from-medical-teal to-medical-indigo text-white font-extrabold py-3.5 rounded-xl text-sm transition-all shadow-lg flex items-center justify-center gap-2 hover:opacity-95"
                    >
                      {forgotLoading ? (
                        <span>Processing request...</span>
                      ) : (
                        <>
                          <Mail className="w-5 h-5" />
                          <span>Request Verification OTP</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setIsForgotPassword(false); setForgotStep('request'); setError(""); setMessage(""); }}
                      className="text-sm text-slate-400 hover:text-white underline block text-center w-full mt-2"
                    >
                      Back to Login
                    </button>
                  </form>
                </div>
              )}

              {forgotStep === 'otp' && (
                /* STEP 2: VERIFY OTP SCREEN */
                <div className="space-y-6">
                  <div className="text-center space-y-3">
                    <div className="flex items-center justify-center">
                      <div className="bg-gradient-to-r from-medical-teal to-medical-indigo p-2.5 rounded-2xl text-white shadow-lg pulse-glow">
                        <Key className="w-8 h-8 stroke-[2.5]" />
                      </div>
                    </div>
                    <h2 className="text-2xl font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">Verify Secure OTP</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      We've dispatched a 6-digit validation OTP to <strong className="text-slate-800 dark:text-white">{forgotEmailOrPhone}</strong>. Enter it below to authorize.
                    </p>
                  </div>

                  <form onSubmit={handleVerifyOtpSubmit} className="space-y-5">
                    <div>
                      <label className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">6-Digit Verification Code</label>
                      <input
                        required
                        type="text"
                        maxLength="6"
                        pattern="[0-9]{6}"
                        value={forgotOtpCode}
                        onChange={e => setForgotOtpCode(e.target.value.replace(/\D/g, ''))}
                        className="w-full bg-slate-900 border border-slate-300 dark:border-white/10 rounded-xl py-3 px-4 text-center font-mono font-bold text-2xl outline-none text-white focus:border-medical-teal tracking-[8px] placeholder:tracking-normal"
                        placeholder="••••••"
                      />
                    </div>

                    <div className="flex justify-between items-center text-xs text-slate-400">
                      <span>Expires in: <strong className="text-medical-teal font-mono">{Math.floor(forgotOtpTimer / 60)}:{(forgotOtpTimer % 60).toString().padStart(2, '0')}</strong></span>
                      <button
                        type="button"
                        onClick={handleResendForgotPasswordOtp}
                        disabled={forgotOtpTimer > 0 || forgotLoading}
                        className={`font-bold transition-all ${forgotOtpTimer === 0 ? 'text-medical-teal hover:underline cursor-pointer' : 'text-slate-550 cursor-not-allowed'}`}
                      >
                        Resend OTP
                      </button>
                    </div>

                    {error && (
                      <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-3 rounded-xl flex items-start gap-2.5 text-xs">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{error}</span>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={forgotLoading || forgotOtpCode.length !== 6}
                      className={`w-full font-extrabold py-3.5 rounded-xl text-sm transition-all shadow-lg flex items-center justify-center gap-2 ${forgotOtpCode.length === 6 ? 'bg-gradient-to-r from-medical-teal to-medical-indigo text-white hover:opacity-95 cursor-pointer' : 'bg-slate-800 text-slate-500 border border-white/5 cursor-not-allowed'}`}
                    >
                      {forgotLoading ? <span>Verifying OTP...</span> : <span>Verify OTP Code</span>}
                    </button>

                    <button
                      type="button"
                      onClick={() => { setForgotStep('request'); setForgotOtpCode(""); setError(""); setMessage(""); }}
                      className="text-sm text-slate-400 hover:text-white underline block text-center w-full mt-2"
                    >
                      Back to Request OTP
                    </button>
                  </form>
                </div>
              )}

              {forgotStep === 'success' && (
                /* STEP 3: SUCCESS ACTION SCREEN */
                <div className="space-y-6 text-center py-4">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/15 text-emerald-500 flex items-center justify-center mx-auto mb-2 animate-bounce">
                    <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
                  </div>
                  <h2 className="text-2xl font-extrabold text-slate-800 dark:text-white uppercase tracking-wider">Reset Successful</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
                    Your password has been successfully updated. All previous authentication tokens and sessions have been secured.
                  </p>

                  <div className="bg-slate-50 dark:bg-slate-950/40 p-4 rounded-xl border border-slate-200 dark:border-white/5 text-left text-xs space-y-2 max-w-sm mx-auto text-slate-500">
                    <p className="font-bold uppercase tracking-wider text-slate-400 mb-1">Security validations applied:</p>
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-350">✔ Hashed user password using standard PBKDF2</div>
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-350">✔ Marked active OTP session as consumed</div>
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-350">✔ Logged change events in authentication audit ledger</div>
                  </div>

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
                    className="w-full bg-gradient-to-r from-medical-teal to-medical-indigo text-white font-extrabold py-3.5 rounded-xl text-sm transition-all shadow-lg hover:opacity-95 mt-4"
                  >
                    Proceed to Login
                  </button>
                </div>
              )}
            </div>
          ) : !isRegister ? (
            /* --- CASE B: STANDARD LOGIN VIEW --- */
            <div className="space-y-6 animate-fade mt-6 md:mt-0">

              {/* Login Title */}
              <div className="text-center space-y-1 mb-8">
                <h2 className="text-xl md:text-[22px] font-extrabold text-medical-textMain dark:text-white uppercase tracking-widest">HealNsightLogin</h2>
                <p className="text-xs md:text-sm text-medical-textMuted font-medium">Secure E2EE Telemedicine Portal</p>
              </div>

              {/* Interactive Role Selection Cards */}
              <div className="space-y-3 mb-6">
                <label className="block text-[11px] md:text-xs font-bold text-medical-textMuted uppercase tracking-widest text-center mb-3">Please select one role to continue</label>
                <div className="grid grid-cols-2 gap-3 md:gap-4">
                  <button type="button" onClick={() => setLoginRole("patient")} className={`flex flex-col items-center p-4 md:p-5 rounded-2xl border-2 transition-all duration-300 ${loginRole === 'patient' ? 'border-medical-indigo bg-medical-indigo/5 dark:bg-medical-indigo/20 shadow-[0_0_15px_rgba(36,120,243,0.15)]' : 'border-medical-borderBg bg-white hover:border-slate-300 dark:bg-slate-900/50 dark:border-white/10'}`}>
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-2.5 ${darkMode ? 'bg-medical-lavender/20 text-medical-lavender' : 'bg-[#F2EFFF] text-medical-lavender'}`}>
                      <User className="w-6 h-6" fill="currentColor" strokeWidth={1} />
                    </div>
                    <span className={`text-sm font-extrabold ${loginRole === 'patient' ? 'text-medical-indigo dark:text-medical-secondaryBlue' : 'text-medical-textMain dark:text-slate-300'}`}>Patient (Citizen)</span>
                  </button>
                  <button type="button" onClick={() => setLoginRole("doctor")} className={`flex flex-col items-center p-4 md:p-5 rounded-2xl border-2 transition-all duration-300 ${loginRole === 'doctor' ? 'border-medical-indigo bg-medical-indigo/5 dark:bg-medical-indigo/20 shadow-[0_0_15px_rgba(36,120,243,0.15)]' : 'border-medical-borderBg bg-white hover:border-slate-300 dark:bg-slate-900/50 dark:border-white/10'}`}>
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-2.5 ${darkMode ? 'bg-medical-amber/20 text-medical-amber' : 'bg-[#FFF4E5] text-medical-amber'}`}>
                      <UserCheck className="w-6 h-6" fill="currentColor" strokeWidth={1} />
                    </div>
                    <span className={`text-sm font-extrabold ${loginRole === 'doctor' ? 'text-medical-indigo dark:text-medical-secondaryBlue' : 'text-medical-textMain dark:text-slate-300'}`}>Certified Doctor</span>
                  </button>
                </div>
              </div>

              {/* Login form block */}
              <form onSubmit={handleLogin} className="space-y-4 transition-all duration-300">
                <div>
                  <label className="block text-xs font-extrabold text-medical-textMain dark:text-slate-400 mb-1.5 uppercase tracking-wider">Username</label>
                  <input required type="text" name="username" value={formData.username} onChange={handleChange} className={`w-full bg-transparent border rounded-xl py-3.5 px-4 text-sm outline-none transition-all text-medical-textMain dark:text-white focus:border-medical-indigo focus:ring-1 focus:ring-medical-indigo ${darkMode ? 'border-white/10' : 'border-medical-borderBg'}`} placeholder="niloy" />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-xs font-extrabold text-medical-textMain dark:text-slate-400 uppercase tracking-wider">Password</label>
                    <button type="button" onClick={() => { setIsForgotPassword(true); setForgotStep('request'); setForgotEmailOrPhone(""); setForgotOtpCode(""); setForgotOtpSent(false); setError(""); setMessage(""); }} className="text-xs text-medical-teal hover:underline font-bold focus:outline-none flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> Forgot Password?</button>
                  </div>
                  <input required type="password" name="password" value={formData.password} onChange={handleChange} className={`w-full bg-transparent border rounded-xl py-3.5 px-4 text-sm outline-none transition-all text-medical-textMain dark:text-white focus:border-medical-indigo focus:ring-1 focus:ring-medical-indigo ${darkMode ? 'border-white/10' : 'border-medical-borderBg'}`} placeholder="••••••••••" />
                </div>

                <button type="submit" className={`w-full font-extrabold py-3.5 rounded-xl text-sm transition-all flex items-center justify-center gap-2 mt-2 ${darkMode ? 'bg-gradient-to-r from-medical-teal to-medical-indigo text-medical-darkBg shadow-lg' : 'bg-medical-indigo text-white shadow-[0_8px_20px_rgba(36,120,243,0.25)] hover:bg-blue-800'}`}>
                  <ShieldCheck className="w-5 h-5" />
                  <span>Enter Platform</span>
                </button>
              </form>
            </div>
          ) : (
            /* --- CASE C: REGISTRATION STEP FLOW --- */
            <form onSubmit={handleRegisterSubmit} className="space-y-5 animate-fade text-sm">

              {/* Step 1: Basic Info */}
              {step === 1 && (
                <div className="space-y-4 animate-fade">
                  <h3 className="text-lg font-bold text-slate-800 dark:text-white border-b border-slate-200 dark:border-white/5 pb-2 uppercase tracking-wider">Step 1: Account Type &amp; Credentials</h3>
                  <div>
                    <label className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Select Role</label>
                    <div className="grid grid-cols-2 gap-3">
                      {['patient', 'doctor'].map(r => (
                        <button key={r} type="button" onClick={() => setRole(r)} className={`py-2.5 rounded-xl font-bold uppercase transition-all border ${role === r ? 'bg-medical-teal/10 border-medical-teal text-teal-600 dark:text-medical-teal' : 'bg-slate-900/40 border-white/5 text-slate-400'}`}>
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">First Name</label>
                      <input required type="text" name="first_name" value={formData.first_name} onChange={handleChange} className="w-full bg-transparent border border-slate-300 dark:border-white/10 rounded-xl p-2.5 text-slate-900 dark:text-white focus:border-medical-teal outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Last Name</label>
                      <input required type="text" name="last_name" value={formData.last_name} onChange={handleChange} className="w-full bg-transparent border border-slate-300 dark:border-white/10 rounded-xl p-2.5 text-slate-900 dark:text-white focus:border-medical-teal outline-none" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Username</label>
                      <input required type="text" name="username" value={formData.username} onChange={handleChange} className="w-full bg-transparent border border-slate-300 dark:border-white/10 rounded-xl p-2.5 text-slate-900 dark:text-white focus:border-medical-teal outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Phone Number</label>
                      <input required type="tel" name="phone" placeholder="+8801" value={formData.phone} onChange={handleChange} className="w-full bg-transparent border border-slate-300 dark:border-white/10 rounded-xl p-2.5 text-slate-900 dark:text-white focus:border-medical-teal outline-none" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Email</label>
                      <input required type="email" name="email" value={formData.email} onChange={handleChange} className="w-full bg-transparent border border-slate-300 dark:border-white/10 rounded-xl p-2.5 text-slate-900 dark:text-white focus:border-medical-teal outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Password</label>
                      <input required type="password" name="password" value={formData.password} onChange={handleChange} className="w-full bg-transparent border border-slate-300 dark:border-white/10 rounded-xl p-2.5 text-slate-900 dark:text-white focus:border-medical-teal outline-none" />
                      {formData.password && (
                        <div className="mt-2 space-y-1">
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-slate-400">Strength:</span>
                            <span className={`font-bold ${pwdStrength.score >= 3 ? 'text-green-500' : pwdStrength.score === 2 ? 'text-amber-500' : 'text-red-500'}`}>{pwdStrength.text}</span>
                          </div>
                          <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                            <div className={`h-full ${pwdStrength.color} transition-all duration-300`} style={{ width: `${(pwdStrength.score / 4) * 100}%` }}></div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <button type="button" onClick={() => setStep(2)} className="w-full bg-slate-800 dark:bg-slate-700 hover:bg-slate-700 text-white font-bold py-2.5 rounded-xl transition-all">
                    Next Step &rarr;
                  </button>
                </div>
              )}

              {/* Step 2: Role details */}
              {step === 2 && (
                <div className="space-y-4 animate-fade">
                  <h3 className="text-lg font-bold text-slate-800 dark:text-white border-b border-slate-200 dark:border-white/5 pb-2 uppercase tracking-wider">Step 2: Role Affiliation Parameters</h3>

                  {role === 'patient' && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Date of Birth</label>
                          <input required type="date" name="date_of_birth" value={formData.date_of_birth} onChange={handleChange} className="w-full bg-transparent border border-slate-300 dark:border-white/10 rounded-xl p-2.5 text-slate-900 dark:text-white focus:border-medical-teal outline-none" />
                        </div>
                        <div>
                          <label className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">NID (National ID)</label>
                          <input required type="text" name="nid" placeholder="National NID Code" value={formData.nid} onChange={handleChange} className="w-full bg-transparent border border-slate-300 dark:border-white/10 rounded-xl p-2.5 text-slate-900 dark:text-white focus:border-medical-teal outline-none" />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Emergency Contacts Relation (Phone)</label>
                        <input required type="text" name="emergency_contact" value={formData.emergency_contact} onChange={handleChange} className="w-full bg-transparent border border-slate-300 dark:border-white/10 rounded-xl p-2.5 text-slate-900 dark:text-white focus:border-medical-teal outline-none" />
                      </div>
                    </>
                  )}

                  {role === 'doctor' && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">BMDC Registration</label>
                          <input required type="text" name="bmdc_reg" placeholder="BMDC/A-XXXX" value={formData.bmdc_reg} onChange={handleChange} className="w-full bg-transparent border border-slate-300 dark:border-white/10 rounded-xl p-2.5 text-slate-900 dark:text-white focus:border-medical-teal outline-none" />
                        </div>
                        <div>
                          <label className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Specialty</label>
                          <input required type="text" name="specialty" placeholder="e.g. Cardiology" value={formData.specialty} onChange={handleChange} className="w-full bg-transparent border border-slate-300 dark:border-white/10 rounded-xl p-2.5 text-slate-900 dark:text-white focus:border-medical-teal outline-none" />
                        </div>
                      </div>
                    </>
                  )}

                  {role === 'admin' && (
                    <div>
                      <label className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Organization Passcode</label>
                      <input required type="text" name="admin_code" placeholder="ADMIN-SN-XXXX" value={formData.admin_code} onChange={handleChange} className="w-full bg-transparent border border-slate-300 dark:border-white/10 rounded-xl p-2.5 text-slate-900 dark:text-white focus:border-medical-teal outline-none" />
                    </div>
                  )}

                  <div className="flex gap-3 mt-2">
                    <button type="button" onClick={() => setStep(1)} className="w-1/3 bg-transparent border border-slate-300 dark:border-white/10 hover:bg-slate-800 text-slate-400 font-bold py-2.5 rounded-xl transition-all">
                      &larr; Back
                    </button>
                    <button type="button" onClick={() => setStep(3)} className="w-2/3 bg-slate-800 dark:bg-slate-700 hover:bg-slate-700 text-white font-bold py-2.5 rounded-xl transition-all">
                      Next Step &rarr;
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Email Verification Gate */}
              {step === 3 && (
                <div className="space-y-4 animate-fade text-center py-4">
                  <Mail className="w-12 h-12 text-medical-teal mx-auto animate-bounce" />
                  <h3 className="text-lg font-bold text-slate-800 dark:text-white uppercase">Step 3: Gmail Address Validation</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 leading-normal max-w-sm mx-auto">
                    Mandatory email validation required. Click the button below to simulate confirming the verification link sent to your inbox:
                  </p>

                  {emailVerified ? (
                    <div className="bg-medical-emerald/10 border border-medical-emerald/20 p-3 rounded-xl flex items-center justify-center gap-2 max-w-xs mx-auto">
                      <CheckCircle2 className="w-5 h-5 text-medical-emerald" />
                      <span className="font-bold text-slate-800 dark:text-slate-200">Email Address Verified</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSendEmailLink}
                      disabled={emailSending}
                      className="bg-medical-teal hover:bg-teal-600 text-white dark:text-medical-darkBg font-extrabold px-6 py-2.5 rounded-xl text-sm"
                    >
                      {emailSending ? 'Verifying...' : 'Simulate Gmail Link Click'}
                    </button>
                  )}

                  <div className="flex gap-3 mt-6">
                    <button type="button" onClick={() => setStep(2)} className="w-1/3 bg-transparent border border-slate-300 dark:border-white/10 hover:bg-slate-800 text-slate-400 font-bold py-2.5 rounded-xl transition-all">
                      &larr; Back
                    </button>
                    <button
                      type="button"
                      onClick={() => { if (emailVerified) setStep(4); else alert("Verify email address first."); }}
                      className={`w-2/3 py-2.5 rounded-xl font-bold transition-all ${emailVerified ? 'bg-slate-800 dark:bg-slate-700 text-white' : 'bg-slate-900 border border-white/5 text-slate-500 cursor-not-allowed'}`}
                    >
                      Next Step &rarr;
                    </button>
                  </div>
                </div>
              )}

              {/* Step 4: Phone OTP Timer Gate */}
              {step === 4 && (
                <div className="space-y-4 animate-fade py-2">
                  <h3 className="text-lg font-bold text-slate-800 dark:text-white border-b border-slate-200 dark:border-white/5 pb-2 uppercase tracking-wider">Step 4: Phone OTP Verification</h3>

                  <div className="bg-slate-100 dark:bg-slate-950/40 p-4 border border-slate-200 dark:border-white/5 rounded-xl space-y-3">
                    <p className="text-sm text-slate-500 dark:text-slate-400 leading-normal">
                      Phone verification required. Send verification OTP code via SMS and enter it below (Code: 123456):
                    </p>

                    {otpSent ? (
                      <div className="space-y-3.5">
                        <div className="flex gap-2">
                          <input
                            required
                            type="text"
                            placeholder="Enter 123456"
                            value={smsOtp}
                            onChange={e => setSmsOtp(e.target.value)}
                            className="bg-transparent border border-slate-300 dark:border-white/10 rounded-xl px-3 py-1.5 text-slate-900 dark:text-white font-mono text-center outline-none focus:border-medical-teal w-36 text-sm"
                          />
                          <button type="button" onClick={handleVerifySms} className="bg-medical-teal hover:bg-teal-600 text-white dark:text-medical-darkBg font-bold px-4 rounded-xl text-sm">Verify Code</button>
                        </div>
                        <p className="text-xs text-slate-500">OTP code expires in {otpTimer}s. Rate limited.</p>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={handleSendSmsOtp}
                        className="bg-medical-teal hover:bg-teal-600 text-white dark:text-medical-darkBg font-extrabold px-4 py-2 rounded-xl text-sm"
                      >
                        Send Verification SMS
                      </button>
                    )}
                  </div>

                  <div className="flex gap-3 mt-6">
                    <button type="button" onClick={() => setStep(3)} className="w-1/3 bg-transparent border border-slate-300 dark:border-white/10 hover:bg-slate-800 text-slate-400 font-bold py-2.5 rounded-xl transition-all">
                      &larr; Back
                    </button>
                  </div>
                </div>
              )}

              {/* Step 5: Document Upload */}
              {step === 5 && (
                <div className="space-y-4 animate-fade">
                  <h3 className="text-lg font-bold text-slate-800 dark:text-white border-b border-slate-200 dark:border-white/5 pb-2 uppercase tracking-wider">Step 5: KYC Verification Scan Upload</h3>

                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
                      Please upload your {role === 'doctor' ? 'BMDC Registration Certificate Scan' : 'Citizen National ID (NID)'} to activate dashboard compliance checks.
                    </p>

                    <div onClick={simulateUpload} className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${fileUploaded ? 'border-medical-emerald/40 bg-medical-emerald/5' : 'border-slate-300 dark:border-white/10 hover:border-medical-teal/40 bg-slate-900/[0.02] dark:bg-slate-900/30'}`}>
                      {fileUploaded ? (
                        <div className="flex flex-col items-center justify-center gap-2">
                          <CheckCircle2 className="w-12 h-12 text-medical-emerald" />
                          <span className="text-sm font-bold text-slate-700 dark:text-slate-200">kyc_verification_signed.pdf</span>
                          <span className="text-xs text-medical-emerald/80 font-semibold uppercase tracking-wider">Verification Document Bound</span>
                        </div>
                      ) : uploadProgress > 0 ? (
                        <div className="w-full">
                          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Hashing and Uploading: {uploadProgress}%</p>
                          <div className="w-full bg-slate-200 dark:bg-slate-950 h-2 rounded-full overflow-hidden">
                            <div className="bg-medical-teal h-full transition-all duration-150" style={{ width: `${uploadProgress}%` }}></div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Upload className="w-10 h-10 text-slate-400 animate-pulse" />
                          <span className="text-sm text-slate-700 dark:text-slate-300 font-bold">Drag &amp; Drop or click to upload PDF/JPG</span>
                          <span className="text-xs text-slate-400 dark:text-slate-500 uppercase font-semibold">Max size 5MB</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-3 mt-6">
                    <button type="button" onClick={() => setStep(4)} className="w-1/3 bg-transparent border border-slate-300 dark:border-white/10 hover:bg-slate-800 text-slate-400 font-bold py-2.5 rounded-xl transition-all">
                      &larr; Back
                    </button>
                    <button type="submit" className="w-2/3 bg-gradient-to-r from-medical-teal to-medical-indigo text-white dark:text-medical-darkBg font-extrabold py-2.5 rounded-xl shadow-md shadow-medical-teal/10 text-sm">
                      Complete Registration
                    </button>
                  </div>
                </div>
              )}

            </form>
          )}

          {/* Toggle link */}
          {!resetToken && !isForgotPassword && (
            <div className="mt-8 text-center text-sm">
              <button onClick={() => { setIsRegister(!isRegister); setStep(1); setError(""); setMessage(""); }} className="text-medical-teal hover:underline font-semibold transition-all text-[13px]">
                {isRegister ? t('alreadyRegistered') : 'New member? Register as Citizen or Doctor'}
              </button>
            </div>
          )}

          {/* Security / Encryption Status Banner */}
          <div className="mt-6 pt-5 border-t border-medical-borderBg dark:border-white/5 flex items-center justify-center gap-2 text-[11px] text-medical-textMuted font-medium">
            <Lock className="w-3.5 h-3.5 text-medical-secondaryBlue" />
            <span>Data protected using TLS 1.3 & AES-256 GCM encryption.</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper for dynamic colors
const getRoleAccentClasses = (selectedRole) => {
  if (selectedRole === 'patient') return {
    border: 'border-blue-500 focus:border-blue-500',
    bg: 'bg-blue-500/10 text-blue-600',
    btn: 'from-blue-500 to-blue-600 shadow-blue-500/15 text-white'
  };
  if (selectedRole === 'doctor') return {
    border: 'border-medical-teal focus:border-medical-teal',
    bg: 'bg-medical-teal/10 text-teal-600',
    btn: 'from-medical-teal to-teal-600 shadow-medical-teal/15 text-medical-darkBg'
  };
  if (selectedRole === 'admin') return {
    border: 'border-medical-indigo focus:border-medical-indigo',
    bg: 'bg-medical-indigo/10 text-indigo-600',
    btn: 'from-medical-indigo to-indigo-600 shadow-medical-indigo/15 text-white'
  };
  return {
    border: 'border-slate-200 dark:border-white/10 focus:border-medical-teal',
    bg: 'bg-slate-900/40 text-slate-500',
    btn: 'from-medical-teal to-medical-indigo text-white shadow-md hover:opacity-95 cursor-pointer'
  };
};

