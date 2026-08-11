import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, Shield, Lock, FileText, Activity, Settings, Upload, CheckCircle2, 
  AlertTriangle, Key, History, Eye, ArrowUp, RefreshCw, ZoomIn
} from 'lucide-react';
import { useLanguage } from './LanguageContext';
import { useNotifications } from './NotificationCenter';
import { SecurityCenter } from './SecurityCenter';

export const ProfileManagement = ({ user, onUpdateUser, token }) => {
  const { t } = useLanguage();
  const { triggerNotification } = useNotifications();
  const [activeTab, setActiveTab] = useState('personal'); // 'personal', 'security', 'kyc', 'clinical', 'activity', 'privacy'
  
  // Forms state
  const [personalForm, setPersonalForm] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    address: user?.address || user?.patient_profile?.address || '',
    emergency_contact: user?.emergency_contact || user?.patient_profile?.emergency_contact || '',
  });

  const [passwordForm, setPasswordForm] = useState({
    current: '',
    new: '',
    confirm: ''
  });
  const [pwSuccess, setPwSuccess] = useState(false);

  // Medical Info (Patient)
  const [medicalForm, setMedicalForm] = useState({
    blood_group: user?.patient_profile?.blood_group || 'O+',
    height: user?.patient_profile?.height || '',
    weight: user?.patient_profile?.weight || '',
    allergies: user?.patient_profile?.allergies || '',
    chronic_conditions: user?.patient_profile?.chronic_conditions || ''
  });

  // Professional Info (Doctor)
  const [professionalForm, setProfessionalForm] = useState({
    specialty: user?.doctor_profile?.specialty || '',
    hospital: user?.doctor_profile?.hospital || '',
    fees: user?.doctor_profile?.fees || 500
  });

  // Upload States
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarCropOpen, setAvatarCropOpen] = useState(false);
  const [avatarZoom, setAvatarZoom] = useState(1);
  const [avatarProgress, setAvatarProgress] = useState(0);
  const [avatarSuccess, setAvatarSuccess] = useState(false);

  const [docProgress, setDocProgress] = useState(0);
  const [docUploaded, setDocUploaded] = useState(false);
  const [docName, setDocName] = useState('');

  // Local Activity Log state
  const [activities, setActivities] = useState([
    { id: 1, action: 'User Session Initialized', ip: '127.0.0.1', date: 'Just now' },
    { id: 2, action: 'Security Node Handshake Verified', ip: '127.0.0.1', date: '5 minutes ago' },
    { id: 3, action: 'Authentication Token Signed', ip: '127.0.0.1', date: '15 minutes ago' }
  ]);

  // Privacy Settings state
  const [privacySettings, setPrivacySettings] = useState({
    visibleToDocs: true,
    alertsEnabled: true,
    shareDataForResearch: false,
    twoFactorEnabled: false
  });

  // Security score calculation (0 - 100)
  const calculateSecurityScore = () => {
    let score = 20; // Default base score for verified credentials
    if (personalForm.phone) score += 15;
    if (personalForm.emergency_contact) score += 15;
    if (docUploaded || user?.nid || user?.bmdc_reg) score += 25;
    if (privacySettings.twoFactorEnabled) score += 15;
    if (avatarSuccess || avatarPreview) score += 10;
    return score;
  };

  const securityScore = calculateSecurityScore();

  // Drag and Drop Profile Image triggers
  const handleAvatarSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert("Maximum size 2MB allowed.");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setAvatarPreview(reader.result);
        setAvatarCropOpen(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleConfirmCrop = () => {
    setAvatarProgress(10);
    const interval = setInterval(() => {
      setAvatarProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setAvatarSuccess(true);
          setAvatarCropOpen(false);
          triggerNotification("Profile Photo Updated", "Your new user avatar photo has been uploaded successfully.", "system");
          setActivities(prevAct => [
            { id: Date.now(), action: 'Profile Avatar Photo Uploaded', ip: '127.0.0.1', date: 'Just now' },
            ...prevAct
          ]);
          return 100;
        }
        return prev + 25;
      });
    }, 120);
  };

  // Drag and Drop KYC Documents triggers
  const handleDocSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("Maximum size 5MB allowed.");
        return;
      }
      setDocName(file.name);
      setDocProgress(10);
      const interval = setInterval(() => {
        setDocProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            setDocUploaded(true);
            triggerNotification("KYC Document Uploaded", `Verification file "${file.name}" has been queued for verification.`, "security");
            setActivities(prevAct => [
              { id: Date.now(), action: `KYC verification uploaded: ${file.name}`, ip: '127.0.0.1', date: 'Just now' },
              ...prevAct
            ]);
            return 100;
          }
          return prev + 20;
        });
      }, 150);
    }
  };

  // Save Forms
  const handleSavePersonal = (e) => {
    e.preventDefault();
    const updatedUser = {
      ...user,
      first_name: personalForm.first_name,
      last_name: personalForm.last_name,
      email: personalForm.email,
      phone: personalForm.phone,
      address: personalForm.address,
      emergency_contact: personalForm.emergency_contact
    };
    onUpdateUser(updatedUser);
    triggerNotification("Profile Updated", "Your primary demographic details have been saved.", "system");
    setActivities(prev => [
      { id: Date.now(), action: 'Personal demographic info updated', ip: '127.0.0.1', date: 'Just now' },
      ...prev
    ]);
  };

  const handleSaveMedical = (e) => {
    e.preventDefault();
    const updatedUser = {
      ...user,
      patient_profile: {
        ...user.patient_profile,
        ...medicalForm
      }
    };
    onUpdateUser(updatedUser);
    triggerNotification("Medical Records Modified", "Your clinical indicators database has been re-compiled.", "medical");
    setActivities(prev => [
      { id: Date.now(), action: 'Personal health profile variables updated', ip: '127.0.0.1', date: 'Just now' },
      ...prev
    ]);
  };

  const handleSaveProfessional = (e) => {
    e.preventDefault();
    const updatedUser = {
      ...user,
      doctor_profile: {
        ...user.doctor_profile,
        ...professionalForm
      }
    };
    onUpdateUser(updatedUser);
    triggerNotification("Professional Data Updated", "Specialist license affiliations and fees updated.", "system");
    setActivities(prev => [
      { id: Date.now(), action: 'Doctor specialist registration updated', ip: '127.0.0.1', date: 'Just now' },
      ...prev
    ]);
  };

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    if (passwordForm.new !== passwordForm.confirm) {
      alert("New password and confirmation must match.");
      return;
    }
    setPwSuccess(true);
    triggerNotification("Security Alert: Password Changed", "Your user entry cryptographic credentials have been rotated.", "security");
    setActivities(prev => [
      { id: Date.now(), action: 'User log-in password changed', ip: '127.0.0.1', date: 'Just now' },
      ...prev
    ]);
    setTimeout(() => {
      setPwSuccess(false);
      setPasswordForm({ current: '', new: '', confirm: '' });
    }, 3000);
  };

  const handleTogglePrivacy = (key) => {
    const updated = { ...privacySettings, [key]: !privacySettings[key] };
    setPrivacySettings(updated);
    
    let label = key === 'twoFactorEnabled' ? "Two-Factor Auth Status Updated" : "Privacy Policy Changed";
    let desc = key === 'twoFactorEnabled' 
      ? `Simulated 2FA ${updated[key] ? 'ENABLED' : 'DISABLED'}` 
      : `Sharing variables: ${updated[key] ? 'YES' : 'NO'}`;
      
    triggerNotification(label, desc, "security");
    setActivities(prev => [
      { id: Date.now(), action: `Privacy toggle modified: ${key} = ${updated[key]}`, ip: '127.0.0.1', date: 'Just now' },
      ...prev
    ]);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-fade text-xs">
      
      {/* LEFT COLUMN: Profile summary & Security Score */}
      <div className="lg:col-span-1 space-y-6">
        
        {/* Profile Card Summary */}
        <div className="glass-panel p-6 rounded-2xl text-center space-y-4">
          <div className="relative w-24 h-24 mx-auto">
            <div className="w-full h-full rounded-full border-2 border-medical-teal overflow-hidden bg-medical-darkBg flex items-center justify-center font-bold text-slate-100 text-3xl">
              {avatarPreview ? (
                <img src={avatarPreview} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <span>{user?.first_name ? user.first_name[0] : user?.username[0]}</span>
              )}
            </div>
            
            {/* Verified Badge */}
            {(user?.bmdc_reg || docUploaded) && (
              <span className="absolute bottom-0 right-0 bg-medical-teal text-medical-darkBg p-1 rounded-full border border-medical-cardBg" title="KYC Verified Specialist">
                <CheckCircle2 className="w-4 h-4 fill-current text-white stroke-teal-500" />
              </span>
            )}
          </div>

          <div>
            <h3 className="text-sm font-bold text-white">{user?.first_name} {user?.last_name}</h3>
            <p className="text-[10px] text-medical-textMuted mt-0.5">UID: {user?.id || '28394-D'}</p>
            <span className="mt-2 inline-block px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-medical-indigo/10 text-medical-indigo border border-medical-indigo/25">
              {user?.role} Member
            </span>
          </div>

          <div className="border-t border-medical-borderBg pt-3 text-left space-y-2 text-[10px] text-medical-textMuted">
            <div className="flex justify-between">
              <span>KYC Level:</span>
              <span className={`font-bold uppercase ${(user?.bmdc_reg || docUploaded) ? 'text-medical-teal' : 'text-medical-amber'}`}>
                {(user?.bmdc_reg || docUploaded) ? 'Verified Class A' : 'Pending Review'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Node State:</span>
              <span className="text-medical-emerald font-bold">SECURED</span>
            </div>
            <div className="flex justify-between">
              <span>Last Login:</span>
              <span className="font-mono text-medical-textMuted">2026-06-07 13:12</span>
            </div>
          </div>
        </div>

        {/* Radial Account Security Score Widget */}
        <div className="glass-panel p-6 rounded-2xl text-center space-y-4">
          <h4 className="text-[10px] font-bold text-medical-textBody uppercase tracking-widest">Account Security Score</h4>
          
          <div className="relative w-32 h-32 mx-auto flex items-center justify-center">
            {/* SVG Progress Circle */}
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" stroke="rgba(255,255,255,0.03)" strokeWidth="8" fill="transparent" />
              <motion.circle 
                cx="50" 
                cy="50" 
                r="40" 
                stroke="var(--color-primary)" 
                strokeWidth="8" 
                fill="transparent"
                strokeDasharray="251.2"
                animate={{ strokeDashoffset: 251.2 - (251.2 * securityScore) / 100 }}
                transition={{ duration: 1, ease: 'easeOut' }}
              />
            </svg>
            <div className="absolute text-center">
              <span className="text-2xl font-extrabold text-white">{securityScore}%</span>
              <p className="text-[8px] text-medical-textMuted uppercase font-semibold mt-0.5">Score Status</p>
            </div>
          </div>

          <p className="text-[10px] text-medical-textMuted leading-normal">
            {securityScore < 50 ? "⚠️ Critical vulnerabilities detected. Complete NID/BMDC verification." : "🛡️ Account security compliance is solid."}
          </p>
        </div>

      </div>

      {/* RIGHT COLUMN: Profile forms and tabs */}
      <div className="lg:col-span-3 space-y-6">
        
        {/* Sub-tabs header bar */}
        <div className="flex gap-1.5 border-b border-medical-borderBg pb-3 overflow-x-auto">
          <button onClick={() => setActiveTab('personal')} className={`px-3.5 py-2 rounded-xl font-bold transition-all ${activeTab === 'personal' ? 'bg-medical-teal text-medical-darkBg' : 'text-medical-textMuted hover:text-white bg-medical-darkBg/40'}`}>
            Details
          </button>
          <button onClick={() => setActiveTab('security')} className={`px-3.5 py-2 rounded-xl font-bold transition-all ${activeTab === 'security' ? 'bg-medical-teal text-medical-darkBg' : 'text-medical-textMuted hover:text-white bg-medical-darkBg/40'}`}>
            Security
          </button>
          <button onClick={() => setActiveTab('kyc')} className={`px-3.5 py-2 rounded-xl font-bold transition-all ${activeTab === 'kyc' ? 'bg-medical-teal text-medical-darkBg' : 'text-medical-textMuted hover:text-white bg-medical-darkBg/40'}`}>
            KYC Files
          </button>
          {user?.role === 'patient' && (
            <button onClick={() => setActiveTab('clinical')} className={`px-3.5 py-2 rounded-xl font-bold transition-all ${activeTab === 'clinical' ? 'bg-medical-teal text-medical-darkBg' : 'text-medical-textMuted hover:text-white bg-medical-darkBg/40'}`}>
              Medical Vitals
            </button>
          )}
          {user?.role === 'doctor' && (
            <button onClick={() => setActiveTab('clinical')} className={`px-3.5 py-2 rounded-xl font-bold transition-all ${activeTab === 'clinical' ? 'bg-medical-teal text-medical-darkBg' : 'text-medical-textMuted hover:text-white bg-medical-darkBg/40'}`}>
              Specialty Setup
            </button>
          )}
          <button onClick={() => setActiveTab('activity')} className={`px-3.5 py-2 rounded-xl font-bold transition-all ${activeTab === 'activity' ? 'bg-medical-teal text-medical-darkBg' : 'text-medical-textMuted hover:text-white bg-medical-darkBg/40'}`}>
            Logs History
          </button>
          <button onClick={() => setActiveTab('privacy')} className={`px-3.5 py-2 rounded-xl font-bold transition-all ${activeTab === 'privacy' ? 'bg-medical-teal text-medical-darkBg' : 'text-medical-textMuted hover:text-white bg-medical-darkBg/40'}`}>
            Privacy
          </button>
        </div>

        {/* Sub-panels display */}
        <div className="glass-panel p-6 rounded-2xl min-h-[360px]">
          
          {/* 1. PERSONAL DEMOGRAPHICS */}
          {activeTab === 'personal' && (
            <form onSubmit={handleSavePersonal} className="space-y-4 animate-fade">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider border-b border-medical-borderBg pb-2 mb-4">Edit Demographic Profile</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-medical-textMuted mb-1 font-semibold">First Name</label>
                  <input required type="text" value={personalForm.first_name} onChange={e => setPersonalForm({ ...personalForm, first_name: e.target.value })} className="w-full bg-medical-darkBg border border-medical-borderBg rounded-xl p-2.5 text-white focus:border-medical-teal outline-none" />
                </div>
                <div>
                  <label className="block text-medical-textMuted mb-1 font-semibold">Last Name</label>
                  <input required type="text" value={personalForm.last_name} onChange={e => setPersonalForm({ ...personalForm, last_name: e.target.value })} className="w-full bg-medical-darkBg border border-medical-borderBg rounded-xl p-2.5 text-white focus:border-medical-teal outline-none" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-medical-textMuted mb-1 font-semibold">Email Address</label>
                  <input required type="email" value={personalForm.email} onChange={e => setPersonalForm({ ...personalForm, email: e.target.value })} className="w-full bg-medical-darkBg border border-medical-borderBg rounded-xl p-2.5 text-white focus:border-medical-teal outline-none" />
                </div>
                <div>
                  <label className="block text-medical-textMuted mb-1 font-semibold">Phone Number</label>
                  <input required type="tel" value={personalForm.phone} onChange={e => setPersonalForm({ ...personalForm, phone: e.target.value })} className="w-full bg-medical-darkBg border border-medical-borderBg rounded-xl p-2.5 text-white focus:border-medical-teal outline-none" />
                </div>
              </div>

              <div>
                <label className="block text-medical-textMuted mb-1 font-semibold">Contact Address</label>
                <input required type="text" value={personalForm.address} onChange={e => setPersonalForm({ ...personalForm, address: e.target.value })} className="w-full bg-medical-darkBg border border-medical-borderBg rounded-xl p-2.5 text-white focus:border-medical-teal outline-none" />
              </div>

              <div>
                <label className="block text-medical-textMuted mb-1 font-semibold">Emergency Contacts Name &amp; Relation (Phone)</label>
                <input required type="text" value={personalForm.emergency_contact} onChange={e => setPersonalForm({ ...personalForm, emergency_contact: e.target.value })} className="w-full bg-medical-darkBg border border-medical-borderBg rounded-xl p-2.5 text-white focus:border-medical-teal outline-none" />
              </div>

              <button type="submit" className="bg-medical-teal text-medical-darkBg font-extrabold px-6 py-2.5 rounded-xl transition-all shadow-md">
                Save Demographic Data
              </button>
            </form>
          )}

          {/* 2. DEDICATED SECURITY CENTER DASHBOARD */}
          {activeTab === 'security' && (
            <SecurityCenter 
              user={user}
              onUpdateUser={onUpdateUser}
              token={token}
            />
          )}

          {/* 3. KYC UPLOAD CENTRE */}
          {activeTab === 'kyc' && (
            <div className="space-y-6 animate-fade">
              
              {/* Profile Photo Uploader with Visual Crop Preview */}
              <div className="space-y-3">
                <h4 className="font-bold text-slate-200">Update Profile Avatar</h4>
                
                {avatarCropOpen ? (
                  <div className="bg-medical-darkBg p-4 border border-medical-borderBg rounded-xl space-y-4">
                    <p className="text-[10px] text-medical-textMuted">Cropping visual mockup. Adjust zoom below:</p>
                    
                    <div className="relative w-36 h-36 rounded-full overflow-hidden border border-medical-teal mx-auto bg-medical-darkBg flex items-center justify-center">
                      {avatarPreview && (
                        <img 
                          src={avatarPreview} 
                          alt="Crop Preview" 
                          className="w-full h-full object-cover transition-transform" 
                          style={{ transform: `scale(${avatarZoom})` }} 
                        />
                      )}
                    </div>

                    <div className="flex items-center gap-2 max-w-xs mx-auto">
                      <ZoomIn className="w-4 h-4 text-medical-textMuted" />
                      <input 
                        type="range" 
                        min="1" 
                        max="2.5" 
                        step="0.1" 
                        value={avatarZoom} 
                        onChange={e => setAvatarZoom(parseFloat(e.target.value))}
                        className="flex-grow accent-medical-teal bg-medical-darkBg h-1 rounded"
                      />
                    </div>

                    <div className="flex gap-2 justify-center">
                      <button onClick={handleConfirmCrop} className="bg-medical-teal text-medical-darkBg font-bold px-4 py-1.5 rounded-lg">
                        Confirm Crop &amp; Upload
                      </button>
                      <button onClick={() => setAvatarCropOpen(false)} className="bg-medical-darkBg text-medical-textMuted font-bold border border-medical-borderBg px-4 py-1.5 rounded-lg">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-4 bg-medical-darkBg/40 p-4 rounded-xl border border-medical-borderBg">
                    <input 
                      type="file" 
                      id="avatarFile"
                      accept="image/*"
                      onChange={handleAvatarSelect}
                      className="hidden" 
                    />
                    <label 
                      htmlFor="avatarFile"
                      className="upload-zone border border-dashed border-white/15 bg-medical-darkBg/30 hover:border-medical-teal/40 rounded-xl px-5 py-4 cursor-pointer text-center flex-grow transition-all"
                    >
                      <Upload className="w-5 h-5 mx-auto text-medical-textMuted mb-1" />
                      <span className="font-bold block text-medical-textBody">Drag/Select Avatar image</span>
                      <span className="text-[9px] text-medical-textMuted block uppercase mt-0.5">JPEG or PNG (Max 2MB)</span>
                    </label>
                  </div>
                )}

                {avatarProgress > 0 && avatarProgress < 100 && (
                  <div className="w-full">
                    <p className="text-[10px] text-medical-textMuted mb-1">Processing image: {avatarProgress}%</p>
                    <div className="w-full bg-medical-darkBg h-1.5 rounded-full overflow-hidden">
                      <div className="bg-medical-teal h-full" style={{ width: `${avatarProgress}%` }}></div>
                    </div>
                  </div>
                )}
              </div>

              {/* KYC Document Uploader */}
              <div className="space-y-3">
                <h4 className="font-bold text-slate-200">{user?.role === 'doctor' ? 'BMDC Registration Certificate Scan' : 'Citizen National ID (NID) Scan'}</h4>
                
                <input 
                  type="file" 
                  id="kycDocFile"
                  accept=".pdf,image/*"
                  onChange={handleDocSelect}
                  className="hidden" 
                />
                
                <label 
                  htmlFor="kycDocFile"
                  className="upload-zone border-2 border-dashed border-medical-borderBg bg-medical-darkBg/30 hover:border-medical-teal/40 rounded-xl py-6 text-center cursor-pointer block transition-all"
                >
                  {docUploaded ? (
                    <div className="flex flex-col items-center justify-center gap-2">
                      <CheckCircle2 className="w-8 h-8 text-medical-emerald" />
                      <span className="font-bold text-slate-200">{docName || 'kyc_document_verified.pdf'}</span>
                      <span className="text-[10px] text-medical-teal font-semibold uppercase tracking-wider">KYC Verification Pending approval</span>
                    </div>
                  ) : docProgress > 0 ? (
                    <div className="w-full max-w-xs mx-auto">
                      <p className="text-[10px] text-medical-textMuted mb-1">Hashing and cryptographically signing file... {docProgress}%</p>
                      <div className="w-full bg-medical-darkBg h-1.5 rounded-full overflow-hidden">
                        <div className="bg-medical-teal h-full" style={{ width: `${docProgress}%` }}></div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Upload className="w-8 h-8 text-medical-textMuted" />
                      <span className="font-bold text-medical-textBody">Drag or Click to upload KYC document</span>
                      <span className="text-[9px] text-medical-textMuted uppercase font-semibold">PDF, JPEG or PNG (Max 5MB)</span>
                    </div>
                  )}
                </label>
              </div>

            </div>
          )}

          {/* 4. ROLE SPECIFIC DETAILS: CLINICAL / PROFESSIONAL */}
          {activeTab === 'clinical' && user?.role === 'patient' && (
            <form onSubmit={handleSaveMedical} className="space-y-4 animate-fade">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider border-b border-medical-borderBg pb-2 mb-4">Patient Medical Vitals Record</h3>
              
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-medical-textMuted mb-1 font-semibold">Blood Group</label>
                  <select value={medicalForm.blood_group} onChange={e => setMedicalForm({ ...medicalForm, blood_group: e.target.value })} className="w-full bg-medical-darkBg border border-medical-borderBg rounded-xl p-2.5 text-white outline-none">
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                  </select>
                </div>
                <div>
                  <label className="block text-medical-textMuted mb-1 font-semibold">Height (cm)</label>
                  <input type="text" placeholder="e.g. 175" value={medicalForm.height} onChange={e => setMedicalForm({ ...medicalForm, height: e.target.value })} className="w-full bg-medical-darkBg border border-medical-borderBg rounded-xl p-2.5 text-white focus:border-medical-teal outline-none" />
                </div>
                <div>
                  <label className="block text-medical-textMuted mb-1 font-semibold">Weight (kg)</label>
                  <input type="text" placeholder="e.g. 70" value={medicalForm.weight} onChange={e => setMedicalForm({ ...medicalForm, weight: e.target.value })} className="w-full bg-medical-darkBg border border-medical-borderBg rounded-xl p-2.5 text-white focus:border-medical-teal outline-none" />
                </div>
              </div>

              <div>
                <label className="block text-medical-textMuted mb-1 font-semibold">Known Allergies</label>
                <textarea rows="2" placeholder="e.g. Penicillin, Peanuts" value={medicalForm.allergies} onChange={e => setMedicalForm({ ...medicalForm, allergies: e.target.value })} className="w-full bg-medical-darkBg border border-medical-borderBg rounded-xl p-2.5 text-white focus:border-medical-teal outline-none"></textarea>
              </div>

              <div>
                <label className="block text-medical-textMuted mb-1 font-semibold">Chronic Conditions / Current Medications</label>
                <textarea rows="2" placeholder="e.g. Hypertension - Napa 500mg daily" value={medicalForm.chronic_conditions} onChange={e => setMedicalForm({ ...medicalForm, chronic_conditions: e.target.value })} className="w-full bg-medical-darkBg border border-medical-borderBg rounded-xl p-2.5 text-white focus:border-medical-teal outline-none"></textarea>
              </div>

              <button type="submit" className="bg-medical-teal text-medical-darkBg font-extrabold px-6 py-2.5 rounded-xl transition-all">
                Compile Medical Ledger
              </button>
            </form>
          )}

          {activeTab === 'clinical' && user?.role === 'doctor' && (
            <form onSubmit={handleSaveProfessional} className="space-y-4 animate-fade">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider border-b border-medical-borderBg pb-2 mb-4">Doctor Specialist Setup</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-medical-textMuted mb-1 font-semibold">Medical Specialty</label>
                  <input required type="text" placeholder="e.g. Cardiology" value={professionalForm.specialty} onChange={e => setProfessionalForm({ ...professionalForm, specialty: e.target.value })} className="w-full bg-medical-darkBg border border-medical-borderBg rounded-xl p-2.5 text-white focus:border-medical-teal outline-none" />
                </div>
                <div>
                  <label className="block text-medical-textMuted mb-1 font-semibold">Consultation Fees (BDT)</label>
                  <input required type="number" value={professionalForm.fees} onChange={e => setProfessionalForm({ ...professionalForm, fees: e.target.value })} className="w-full bg-medical-darkBg border border-medical-borderBg rounded-xl p-2.5 text-white focus:border-medical-teal outline-none" />
                </div>
              </div>

              <div>
                <label className="block text-medical-textMuted mb-1 font-semibold">Affiliated Hospital/Clinic</label>
                <input required type="text" placeholder="e.g. Dhaka Medical College Hospital" value={professionalForm.hospital} onChange={e => setProfessionalForm({ ...professionalForm, hospital: e.target.value })} className="w-full bg-medical-darkBg border border-medical-borderBg rounded-xl p-2.5 text-white focus:border-medical-teal outline-none" />
              </div>

              <button type="submit" className="bg-medical-teal text-medical-darkBg font-extrabold px-6 py-2.5 rounded-xl transition-all">
                Save Specialist Record
              </button>
            </form>
          )}

          {/* 5. USER ACTIVITY HISTORY */}
          {activeTab === 'activity' && (
            <div className="space-y-4 animate-fade">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider border-b border-medical-borderBg pb-2 mb-4">Demographic Action Logs</h3>
              
              <div className="space-y-3.5 max-h-[280px] overflow-y-auto pr-1">
                {activities.map(act => (
                  <div key={act.id} className="bg-medical-darkBg/40 p-3 rounded-xl border border-medical-borderBg flex justify-between items-center">
                    <div>
                      <h4 className="font-bold text-white leading-tight">{act.action}</h4>
                      <p className="text-[9px] text-medical-textMuted mt-1 font-mono">IP Access Node: {act.ip}</p>
                    </div>
                    <span className="text-[9px] text-medical-textMuted font-semibold">{act.date}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 6. PRIVACY & SECURITY SETTINGS */}
          {activeTab === 'privacy' && (
            <div className="space-y-6 animate-fade">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider border-b border-medical-borderBg pb-2 mb-4">Security Policy &amp; Privacy Configuration</h3>
              
              <div className="space-y-4">
                
                {/* Switch 1 */}
                <div className="flex items-center justify-between bg-medical-darkBg/30 p-3 rounded-xl border border-medical-borderBg">
                  <div>
                    <h4 className="font-bold text-white">Delegated Vitals Visibility</h4>
                    <p className="text-[9px] text-medical-textMuted mt-0.5">Explicitly allow certified clinic specialists to inspect clinical records.</p>
                  </div>
                  <button 
                    type="button"
                    onClick={() => handleTogglePrivacy('visibleToDocs')}
                    className={`w-10 h-5 rounded-full transition-all relative ${privacySettings.visibleToDocs ? 'bg-medical-teal' : 'bg-medical-darkBg'}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${privacySettings.visibleToDocs ? 'right-0.5' : 'left-0.5'}`} />
                  </button>
                </div>

                {/* Switch 2 */}
                <div className="flex items-center justify-between bg-medical-darkBg/30 p-3 rounded-xl border border-medical-borderBg">
                  <div>
                    <h4 className="font-bold text-white">Telephony Real-Time Alerts</h4>
                    <p className="text-[9px] text-medical-textMuted mt-0.5">Bridge cellular notifications via Twilio VoIP callback triggers.</p>
                  </div>
                  <button 
                    type="button"
                    onClick={() => handleTogglePrivacy('alertsEnabled')}
                    className={`w-10 h-5 rounded-full transition-all relative ${privacySettings.alertsEnabled ? 'bg-medical-teal' : 'bg-medical-darkBg'}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${privacySettings.alertsEnabled ? 'right-0.5' : 'left-0.5'}`} />
                  </button>
                </div>

                {/* Switch 3 */}
                <div className="flex items-center justify-between bg-medical-darkBg/30 p-3 rounded-xl border border-medical-borderBg">
                  <div>
                    <h4 className="font-bold text-white">Simulated Two-Factor Authentication</h4>
                    <p className="text-[9px] text-medical-textMuted mt-0.5">Require an organization passcode key check during authentication entry.</p>
                  </div>
                  <button 
                    type="button"
                    onClick={() => handleTogglePrivacy('twoFactorEnabled')}
                    className={`w-10 h-5 rounded-full transition-all relative ${privacySettings.twoFactorEnabled ? 'bg-medical-teal' : 'bg-medical-darkBg'}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${privacySettings.twoFactorEnabled ? 'right-0.5' : 'left-0.5'}`} />
                  </button>
                </div>

              </div>
            </div>
          )}

        </div>

      </div>

    </div>
  );
};
