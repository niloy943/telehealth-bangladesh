import React, { useState, useEffect } from 'react';
import {
  User, Shield, Lock, FileText, Activity, Settings, Upload, CheckCircle2,
  AlertTriangle, Key, History, Eye, ArrowUp, RefreshCw, ZoomIn,
  Calendar, Clock, Plus, Trash2
} from 'lucide-react';
import { useLanguage } from './LanguageContext';
import { useNotifications } from './NotificationCenter';
import { SecurityCenter } from './SecurityCenter';
import { Button } from './ui';

const API_BASE = import.meta.env.VITE_API_BASE || window.location.origin;

export const ProfileManagement = ({ user, onUpdateUser, token, activeSection = 'personal', onTabChange }) => {
  const { t } = useLanguage();
  const { triggerNotification } = useNotifications();
  const [activeTab, setActiveTab] = useState(activeSection); // 'personal', 'security', 'kyc', 'clinical', 'activity', 'privacy'

  useEffect(() => {
    if (activeSection) {
      setActiveTab(activeSection);
    }
  }, [activeSection]);

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

  // Default weekly consultation schedule
  const DEFAULT_DOCTOR_SCHEDULE = [
    { day: "Saturday", start_time: "10:00 AM", end_time: "01:00 PM" },
    { day: "Sunday", start_time: "04:00 PM", end_time: "08:00 PM" },
    { day: "Tuesday", start_time: "06:00 PM", end_time: "09:00 PM" },
  ];

  // Professional Info (Doctor)
  const [professionalForm, setProfessionalForm] = useState({
    specialty: user?.doctor_profile?.specialty || '',
    hospital: user?.doctor_profile?.hospital || '',
    fees: user?.doctor_profile?.fees !== undefined ? user.doctor_profile.fees : 500,
    schedule: Array.isArray(user?.doctor_profile?.schedule) && user?.doctor_profile?.schedule.length > 0
      ? user.doctor_profile.schedule
      : DEFAULT_DOCTOR_SCHEDULE
  });

  useEffect(() => {
    if (user?.doctor_profile) {
      setProfessionalForm(prev => ({
        ...prev,
        specialty: user.doctor_profile.specialty || '',
        hospital: user.doctor_profile.hospital || '',
        fees: user.doctor_profile.fees !== undefined ? user.doctor_profile.fees : 500,
        schedule: Array.isArray(user.doctor_profile.schedule) && user.doctor_profile.schedule.length > 0
          ? user.doctor_profile.schedule
          : prev.schedule
      }));
    }
  }, [user]);

  const handleAddScheduleSlot = () => {
    setProfessionalForm(prev => ({
      ...prev,
      schedule: [
        ...prev.schedule,
        { day: "Wednesday", start_time: "10:00 AM", end_time: "01:00 PM" }
      ]
    }));
  };

  const handleRemoveScheduleSlot = (idx) => {
    setProfessionalForm(prev => ({
      ...prev,
      schedule: prev.schedule.filter((_, i) => i !== idx)
    }));
  };

  const handleUpdateScheduleSlot = (idx, field, val) => {
    setProfessionalForm(prev => ({
      ...prev,
      schedule: prev.schedule.map((slot, i) => i === idx ? { ...slot, [field]: val } : slot)
    }));
  };

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
    setAvatarProgress(100);
    setAvatarSuccess(true);
    setAvatarCropOpen(false);
    triggerNotification("Profile Photo Updated", "Your new user avatar photo has been uploaded successfully.", "system");
    setActivities(prevAct => [
      { id: Date.now(), action: 'Profile Avatar Photo Uploaded', ip: '127.0.0.1', date: 'Just now' },
      ...prevAct
    ]);
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
      setDocProgress(100);
      setDocUploaded(true);
      triggerNotification("KYC Document Uploaded", `Verification file "${file.name}" has been queued for verification.`, "security");
      setActivities(prevAct => [
        { id: Date.now(), action: `KYC verification uploaded: ${file.name}`, ip: '127.0.0.1', date: 'Just now' },
        ...prevAct
      ]);
    }
  };

  // Save Forms
  const handleSavePersonal = async (e) => {
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

    if (token) {
      try {
        const resp = await fetch(`${API_BASE}/api/profile/`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            first_name: personalForm.first_name,
            last_name: personalForm.last_name,
            email: personalForm.email,
            phone: personalForm.phone,
            address: personalForm.address,
            emergency_contact: personalForm.emergency_contact
          })
        });
        if (resp.ok) {
          const savedData = await resp.json();
          onUpdateUser({ ...updatedUser, ...savedData });
          triggerNotification("Profile Updated", "Your demographic details have been saved.", "system");
        } else {
          onUpdateUser(updatedUser);
          triggerNotification("Notice", "Profile updated locally.", "system");
        }
      } catch (err) {
        console.error("Profile save error:", err);
        onUpdateUser(updatedUser);
      }
    } else {
      onUpdateUser(updatedUser);
      triggerNotification("Profile Updated", "Your demographic details have been saved.", "system");
    }

    setActivities(prev => [
      { id: Date.now(), action: 'Personal demographic info updated', ip: '127.0.0.1', date: 'Just now' },
      ...prev
    ]);
  };

  const handleSaveMedical = async (e) => {
    e.preventDefault();
    const updatedUser = {
      ...user,
      patient_profile: {
        ...user.patient_profile,
        ...medicalForm
      }
    };

    if (token) {
      try {
        const resp = await fetch(`${API_BASE}/api/profile/`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            blood_group: medicalForm.blood_group,
            address: personalForm.address || user?.patient_profile?.address || '',
            emergency_contact: personalForm.emergency_contact || user?.patient_profile?.emergency_contact || ''
          })
        });
        if (resp.ok) {
          const savedData = await resp.json();
          onUpdateUser({ ...updatedUser, ...savedData });
          triggerNotification("Medical Records Modified", "Your clinical indicators have been saved.", "medical");
        } else {
          onUpdateUser(updatedUser);
          triggerNotification("Notice", "Medical records updated locally.", "medical");
        }
      } catch (err) {
        console.error("Medical save error:", err);
        onUpdateUser(updatedUser);
      }
    } else {
      onUpdateUser(updatedUser);
      triggerNotification("Medical Records Modified", "Clinical indicators saved.", "medical");
    }

    setActivities(prev => [
      { id: Date.now(), action: 'Personal health profile variables updated', ip: '127.0.0.1', date: 'Just now' },
      ...prev
    ]);
  };

  const handleSaveProfessional = async (e) => {
    e.preventDefault();
    const updatedUser = {
      ...user,
      doctor_profile: {
        ...user.doctor_profile,
        ...professionalForm
      }
    };

    if (token) {
      try {
        const resp = await fetch(`${API_BASE}/api/profile/`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            specialty: professionalForm.specialty,
            hospital: professionalForm.hospital,
            fees: parseInt(professionalForm.fees) || 500,
            schedule: professionalForm.schedule
          })
        });
        if (resp.ok) {
          const savedData = await resp.json();
          onUpdateUser({ ...updatedUser, ...savedData });
          triggerNotification("Doctor Profile Updated", "Specialty, fee, and schedule saved to database.", "system");
        } else {
          onUpdateUser(updatedUser);
          triggerNotification("Notice", "Professional data updated locally.", "system");
        }
      } catch (err) {
        console.error("Professional save error:", err);
        onUpdateUser(updatedUser);
      }
    } else {
      onUpdateUser(updatedUser);
      triggerNotification("Professional Data Updated", "Specialist affiliations and fees updated.", "system");
    }

    setActivities(prev => [
      { id: Date.now(), action: 'Doctor specialist registration updated', ip: '127.0.0.1', date: 'Just now' },
      ...prev
    ]);
  };

  const handleTogglePrivacy = (key) => {
    const updated = { ...privacySettings, [key]: !privacySettings[key] };
    setPrivacySettings(updated);

    let label = key === 'twoFactorEnabled' ? "Two-Factor Auth Status Updated" : "Privacy Policy Changed";
    let desc = key === 'twoFactorEnabled'
      ? `2FA ${updated[key] ? 'ENABLED' : 'DISABLED'}`
      : `Sharing variables: ${updated[key] ? 'YES' : 'NO'}`;

    triggerNotification(label, desc, "security");
    setActivities(prev => [
      { id: Date.now(), action: `Privacy toggle modified: ${key} = ${updated[key]}`, ip: '127.0.0.1', date: 'Just now' },
      ...prev
    ]);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 text-xs">

      {/* LEFT COLUMN: Profile summary & Security Score */}
      <div className="lg:col-span-1 space-y-6">

        {/* Profile Card Summary */}
        <div className="bg-white border border-[#BDDDFA] p-6 rounded-2xl text-center space-y-4">
          <div className="relative w-24 h-24 mx-auto">
            <div className="w-full h-full rounded-full border-2 border-[#168CF5] overflow-hidden bg-[#E7F0FC] flex items-center justify-center font-bold text-[#0F172A] text-3xl">
              {avatarPreview ? (
                <img src={avatarPreview} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <span>{user?.first_name ? user.first_name[0] : (user?.username ? user.username[0] : 'U')}</span>
              )}
            </div>

            {/* Verified Badge */}
            {(user?.bmdc_reg || docUploaded) && (
              <span className="absolute bottom-0 right-0 bg-[#059669] text-white p-1 rounded-full border-2 border-white" title="KYC Verified Specialist">
                <CheckCircle2 className="w-4 h-4 fill-current text-white" />
              </span>
            )}
          </div>

          <div>
            <h3 className="text-base font-bold text-[#0F172A]">{user?.first_name} {user?.last_name}</h3>
            <p className="text-xs text-[#55647C] mt-0.5">UID: {user?.id || '28394-D'}</p>
            <span className="mt-2 inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-[#E7F0FC] text-[#059669] border border-[#059669]">
              {user?.role} Member
            </span>
          </div>

          <div className="border-t border-[#BDDDFA] pt-3 text-left space-y-2 text-xs text-[#55647C]">
            <div className="flex justify-between">
              <span>KYC :</span>
              <span className={`font-bold uppercase ${(user?.bmdc_reg || docUploaded) ? 'text-[#059669]' : 'text-amber-600'}`}>
                {(user?.bmdc_reg || docUploaded) ? 'Verified Class A' : 'Pending Review'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Security State:</span>
              <span className="text-[#059669] font-bold">SECURED</span>
            </div>
            <div className="flex justify-between">
              <span>Last Login:</span>
              <span className="font-mono text-[#55647C]">2026-09-29 01:30</span>
            </div>
          </div>
        </div>

        {/* Account Security Score Widget */}
        <div className="bg-white border border-[#BDDDFA] p-6 rounded-2xl text-center space-y-4">
          <h4 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">Account Security Score</h4>

          <div className="relative w-32 h-32 mx-auto flex items-center justify-center">
            {/* SVG Progress Circle */}
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" stroke="#E7F0FC" strokeWidth="8" fill="transparent" />
              <circle
                cx="50"
                cy="50"
                r="40"
                stroke="#059669"
                strokeWidth="8"
                fill="transparent"
                strokeDasharray="251.2"
                strokeDashoffset={251.2 - (251.2 * securityScore) / 100}
              />
            </svg>
            <div className="absolute text-center">
              <span className="text-2xl font-bold text-[#0F172A]">{securityScore}%</span>
              <p className="text-[10px] text-[#55647C] uppercase font-semibold mt-0.5">Score</p>
            </div>
          </div>

          <p className="text-xs text-[#55647C] leading-normal">
            {securityScore < 50 ? "Verification pending. Complete NID/BMDC verification." : "Account security."}
          </p>
        </div>

      </div>

      {/* RIGHT COLUMN: Profile forms and panels */}
      <div className="lg:col-span-3 space-y-6">

        {/* Sub-panels display */}
        <div className="bg-white border border-[#BDDDFA] p-6 rounded-2xl min-h-[360px]">

          {/* 1. PERSONAL DEMOGRAPHICS */}
          {activeTab === 'personal' && (
            <form onSubmit={handleSavePersonal} className="space-y-4">
              <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider border-b border-[#BDDDFA] pb-2 mb-4">Edit Profile</h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[#0F172A] mb-1 font-semibold">First Name</label>
                  <input required type="text" value={personalForm.first_name} onChange={e => setPersonalForm({ ...personalForm, first_name: e.target.value })} className="w-full bg-[#E7F0FC] rounded-[15px] p-2.5 text-[#111827] outline-none" />
                </div>
                <div>
                  <label className="block text-[#0F172A] mb-1 font-semibold">Last Name</label>
                  <input required type="text" value={personalForm.last_name} onChange={e => setPersonalForm({ ...personalForm, last_name: e.target.value })} className="w-full bg-[#E7F0FC] rounded-[15px] p-2.5 text-[#111827] outline-none" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[#0F172A] mb-1 font-semibold">Email Address</label>
                  <input required type="email" value={personalForm.email} onChange={e => setPersonalForm({ ...personalForm, email: e.target.value })} className="w-full bg-[#E7F0FC] rounded-[15px] p-2.5 text-[#111827] outline-none" />
                </div>
                <div>
                  <label className="block text-[#0F172A] mb-1 font-semibold">Phone Number</label>
                  <input required type="tel" value={personalForm.phone} onChange={e => setPersonalForm({ ...personalForm, phone: e.target.value })} className="w-full bg-[#E7F0FC] rounded-[15px] p-2.5 text-[#111827] outline-none" />
                </div>
              </div>

              <div>
                <label className="block text-[#0F172A] mb-1 font-semibold">Contact Address</label>
                <input required type="text" value={personalForm.address} onChange={e => setPersonalForm({ ...personalForm, address: e.target.value })} className="w-full bg-[#E7F0FC] rounded-[15px] p-2.5 text-[#111827] outline-none" />
              </div>

              <div>
                <label className="block text-[#0F172A] mb-1 font-semibold">Emergency Contact</label>
                <input required type="text" value={personalForm.emergency_contact} onChange={e => setPersonalForm({ ...personalForm, emergency_contact: e.target.value })} className="w-full bg-[#E7F0FC] rounded-[15px] p-2.5 text-[#111827] outline-none" />
              </div>

              <Button type="submit" variant="primary">
                Save  Data
              </Button>
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
            <div className="space-y-6">

              {/* Profile Photo Uploader */}
              <div className="space-y-3">
                <h4 className="font-bold text-[#0F172A]">Update Profile</h4>

                {avatarCropOpen ? (
                  <div className="bg-[#E7F0FC] p-4 border border-[#BDDDFA] rounded-xl space-y-4">
                    <p className="text-[10px] text-[#55647C]">Avatar image loaded. Click confirm to save:</p>

                    <div className="relative w-32 h-32 rounded-full overflow-hidden border-2 border-[#168CF5] mx-auto bg-white flex items-center justify-center">
                      {avatarPreview && (
                        <img
                          src={avatarPreview}
                          alt="Crop Preview"
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>

                    <div className="flex gap-2 justify-center">
                      <Button size="sm" variant="primary" onClick={handleConfirmCrop}>
                        Confirm Avatar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setAvatarCropOpen(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-4 bg-[#E7F0FC] p-4 rounded-xl border border-[#BDDDFA]">
                    <input
                      type="file"
                      id="avatarFile"
                      accept="image/*"
                      onChange={handleAvatarSelect}
                      className="hidden"
                    />
                    <label
                      htmlFor="avatarFile"
                      className="border border-dashed border-[#BDDDFA] bg-white rounded-xl px-5 py-4 cursor-pointer text-center flex-grow"
                    >
                      <Upload className="w-5 h-5 mx-auto text-[#55647C] mb-1" />
                      <span className="font-bold block text-[#0F172A]">Select Avatar image</span>
                      <span className="text-[10px] text-[#55647C] block uppercase mt-0.5">JPEG or PNG (Max 2MB)</span>
                    </label>
                  </div>
                )}
              </div>

              {/* KYC Document Uploader */}
              <div className="space-y-3">
                <h4 className="font-bold text-[#0F172A]">{user?.role === 'doctor' ? 'BMDC Registration Certificate Scan' : ' ID (NID) Scan'}</h4>

                <input
                  type="file"
                  id="kycDocFile"
                  accept=".pdf,image/*"
                  onChange={handleDocSelect}
                  className="hidden"
                />

                <label
                  htmlFor="kycDocFile"
                  className="border-2 border-dashed border-[#BDDDFA] bg-[#E7F0FC] rounded-xl py-6 text-center cursor-pointer block"
                >
                  {docUploaded ? (
                    <div className="flex flex-col items-center justify-center gap-2">
                      <CheckCircle2 className="w-8 h-8 text-[#059669]" />
                      <span className="font-bold text-[#0F172A]">{docName || 'kyc_document_verified.pdf'}</span>
                      <span className="text-[10px] text-[#059669] font-semibold uppercase tracking-wider">KYC Verification Queued</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Upload className="w-8 h-8 text-[#55647C]" />
                      <span className="font-bold text-[#0F172A]">Upload KYC document</span>
                      <span className="text-[10px] text-[#55647C] uppercase font-semibold">PDF, JPEG or PNG (Max 5MB)</span>
                    </div>
                  )}
                </label>
              </div>

            </div>
          )}

          {/* 4. ROLE SPECIFIC DETAILS: CLINICAL / PROFESSIONAL */}
          {activeTab === 'clinical' && user?.role === 'patient' && (
            <form onSubmit={handleSaveMedical} className="space-y-4">
              <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider border-b border-[#BDDDFA] pb-2 mb-4">Vitals Record</h3>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-[#0F172A] mb-1 font-semibold">Blood Group</label>
                  <select value={medicalForm.blood_group} onChange={e => setMedicalForm({ ...medicalForm, blood_group: e.target.value })} className="w-full bg-[#E7F0FC] rounded-[15px] p-2.5 text-[#111827] outline-none">
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
                  <label className="block text-[#0F172A] mb-1 font-semibold">Height (cm)</label>
                  <input type="text" placeholder="e.g. 175" value={medicalForm.height} onChange={e => setMedicalForm({ ...medicalForm, height: e.target.value })} className="w-full bg-[#E7F0FC] rounded-[15px] p-2.5 text-[#111827] outline-none" />
                </div>
                <div>
                  <label className="block text-[#0F172A] mb-1 font-semibold">Weight (kg)</label>
                  <input type="text" placeholder="e.g. 70" value={medicalForm.weight} onChange={e => setMedicalForm({ ...medicalForm, weight: e.target.value })} className="w-full bg-[#E7F0FC] rounded-[15px] p-2.5 text-[#111827] outline-none" />
                </div>
              </div>

              <div>
                <label className="block text-[#0F172A] mb-1 font-semibold">Known Allergies</label>
                <textarea rows="2" placeholder="e.g. Penicillin, Peanuts" value={medicalForm.allergies} onChange={e => setMedicalForm({ ...medicalForm, allergies: e.target.value })} className="w-full bg-[#E7F0FC] rounded-[15px] p-2.5 text-[#111827] outline-none"></textarea>
              </div>

              <div>
                <label className="block text-[#0F172A] mb-1 font-semibold">Current Medications</label>
                <textarea rows="2" placeholder="e.g. Hypertension - Napa 500mg daily" value={medicalForm.chronic_conditions} onChange={e => setMedicalForm({ ...medicalForm, chronic_conditions: e.target.value })} className="w-full bg-[#E7F0FC] rounded-[15px] p-2.5 text-[#111827] outline-none"></textarea>
              </div>

              <Button type="submit" variant="primary">
                Save Medical Records
              </Button>
            </form>
          )}

          {activeTab === 'clinical' && user?.role === 'doctor' && (
            <form onSubmit={handleSaveProfessional} className="space-y-6">
              <div className="border-b border-[#BDDDFA] pb-3">
                <h3 className="text-sm font-bold text-[#0F172A] uppercase tracking-wider">
                  Professional Profile &amp; Consultation Availability
                </h3>
                <p className="text-xs text-[#55647C] mt-1">
                  Configure your medical specialty, hospital affiliation, consultation fee, and weekly availability schedule.
                </p>
              </div>

              {/* Professional Credentials & Fee */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#0F172A] mb-1">Medical Specialty</label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. Cardiology"
                    value={professionalForm.specialty}
                    onChange={e => setProfessionalForm({ ...professionalForm, specialty: e.target.value })}
                    className="w-full bg-[#E7F0FC] rounded-[15px] p-2.5 text-xs text-[#111827] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#0F172A] mb-1">Affiliated Hospital / Clinic</label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. Dhaka Medical College Hospital"
                    value={professionalForm.hospital}
                    onChange={e => setProfessionalForm({ ...professionalForm, hospital: e.target.value })}
                    className="w-full bg-[#E7F0FC] rounded-[15px] p-2.5 text-xs text-[#111827] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                    Consultation Fee (BDT)
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <span className="text-sm font-bold text-[#55647C]">৳</span>
                    </div>
                    <input
                      required
                      type="number"
                      min="0"
                      step="50"
                      value={professionalForm.fees}
                      onChange={e => setProfessionalForm({ ...professionalForm, fees: e.target.value })}
                      className="w-full pl-9 bg-[#E7F0FC] rounded-[15px] p-2.5 text-xs text-[#111827] font-mono outline-none"
                      style={{ paddingLeft: '2.5rem' }}
                    />
                  </div>
                </div>
              </div>

              {/* Consultation Availability / Time Schedule */}
              <div className="space-y-4 pt-2 border-t border-[#BDDDFA]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-[#168CF5]" />
                      Weekly Consultation Availability / Schedule
                    </h4>
                    <p className="text-[11px] text-[#55647C]">
                      Define the days and consultation time windows when patients can book appointments.
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleAddScheduleSlot}
                    icon={Plus}
                  >
                    Add Time Slot
                  </Button>
                </div>

                {/* Slots List */}
                <div className="space-y-2.5">
                  {professionalForm.schedule.map((slot, sIdx) => (
                    <div
                      key={sIdx}
                      className="flex flex-col sm:flex-row items-center gap-3 p-3 rounded-xl bg-[#E7F0FC] border border-[#BDDDFA]"
                    >
                      {/* Day Selector */}
                      <div className="w-full sm:w-44">
                        <label className="block text-[10px] uppercase font-bold text-[#55647C] mb-1">Day</label>
                        <select
                          value={slot.day}
                          onChange={e => handleUpdateScheduleSlot(sIdx, 'day', e.target.value)}
                          className="w-full bg-white border border-[#BDDDFA] rounded-lg p-2 text-xs font-semibold text-[#0F172A] outline-none"
                        >
                          {['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(d => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                      </div>

                      {/* Start Time */}
                      <div className="w-full sm:flex-1">
                        <label className="block text-[10px] uppercase font-bold text-[#55647C] mb-1 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-[#55647C]" /> Start Time
                        </label>
                        <input
                          type="text"
                          value={slot.start_time}
                          placeholder="10:00 AM"
                          onChange={e => handleUpdateScheduleSlot(sIdx, 'start_time', e.target.value)}
                          className="w-full bg-white border border-[#BDDDFA] rounded-lg p-2 text-xs font-mono text-[#0F172A] outline-none"
                        />
                      </div>

                      {/* End Time */}
                      <div className="w-full sm:flex-1">
                        <label className="block text-[10px] uppercase font-bold text-[#55647C] mb-1 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-[#55647C]" /> End Time
                        </label>
                        <input
                          type="text"
                          value={slot.end_time}
                          placeholder="01:00 PM"
                          onChange={e => handleUpdateScheduleSlot(sIdx, 'end_time', e.target.value)}
                          className="w-full bg-white border border-[#BDDDFA] rounded-lg p-2 text-xs font-mono text-[#0F172A] outline-none"
                        />
                      </div>

                      {/* Remove Button */}
                      <div className="sm:self-end pt-2 sm:pt-0">
                        <button
                          type="button"
                          onClick={() => handleRemoveScheduleSlot(sIdx)}
                          disabled={professionalForm.schedule.length <= 1}
                          className="p-2 text-[#FF7A7A] hover:bg-red-50 rounded-lg disabled:opacity-30 transition-colors"
                          title="Remove time slot"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Patient-Facing Summary Preview Card */}
                <div className="p-4 rounded-xl bg-white border border-[#BDDDFA] space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[#0F172A]">Patient-Facing Profile Preview</span>
                    <span className="font-bold font-mono text-[#059669]">
                      Fee: ৳{professionalForm.fees || 500} BDT
                    </span>
                  </div>
                  <div className="text-xs text-[#55647C] space-y-1">
                    {professionalForm.schedule.map((s, idx) => (
                      <div key={idx} className="flex justify-between items-center py-0.5">
                        <span className="font-medium text-[#0F172A]">{s.day}</span>
                        <span className="font-mono text-[#168CF5]">{s.start_time} – {s.end_time}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-[#BDDDFA]">
                <Button type="submit" variant="primary">
                  Save Professional Information &amp; Schedule
                </Button>
              </div>
            </form>
          )}

          {/* 5. USER ACTIVITY HISTORY */}
          {activeTab === 'activity' && (
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider border-b border-[#BDDDFA] pb-2 mb-4">Action Logs</h3>

              <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
                {activities.map(act => (
                  <div key={act.id} className="bg-[#E7F0FC] p-3 rounded-xl border border-[#BDDDFA] flex justify-between items-center">
                    <div>
                      <h4 className="font-bold text-[#0F172A]">{act.action}</h4>
                      <p className="text-[10px] text-[#55647C] mt-0.5 font-mono">IP Access Node: {act.ip}</p>
                    </div>
                    <span className="text-[10px] text-[#55647C] font-semibold">{act.date}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 6. PRIVACY & SECURITY SETTINGS */}
          {activeTab === 'privacy' && (
            <div className="space-y-6">
              <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider border-b border-[#BDDDFA] pb-2 mb-4">Security Policy &amp; Privacy Configuration</h3>

              <div className="space-y-4">

                {/* Switch 1 */}
                <div className="flex items-center justify-between bg-[#E7F0FC] p-3.5 rounded-xl border border-[#BDDDFA]">
                  <div>
                    <h4 className="font-bold text-[#0F172A]">Clinical Records Visibility</h4>
                    <p className="text-[10px] text-[#55647C] mt-0.5"></p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleTogglePrivacy('visibleToDocs')}
                    className={`w-11 h-6 rounded-full relative border ${privacySettings.visibleToDocs ? 'bg-[#059669] border-[#059669]' : 'bg-slate-300 border-slate-300'}`}
                  >
                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white ${privacySettings.visibleToDocs ? 'right-0.5' : 'left-0.5'}`} />
                  </button>
                </div>

                {/* Switch 2 */}
                <div className="flex items-center justify-between bg-[#E7F0FC] p-3.5 rounded-xl border border-[#BDDDFA]">
                  <div>
                    <h4 className="font-bold text-[#0F172A]">SMS &amp; Real-Time Alerts</h4>
                    <p className="text-[10px] text-[#55647C] mt-0.5"></p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleTogglePrivacy('alertsEnabled')}
                    className={`w-11 h-6 rounded-full relative border ${privacySettings.alertsEnabled ? 'bg-[#059669] border-[#059669]' : 'bg-slate-300 border-slate-300'}`}
                  >
                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white ${privacySettings.alertsEnabled ? 'right-0.5' : 'left-0.5'}`} />
                  </button>
                </div>

                {/* Switch 3 */}
                <div className="flex items-center justify-between bg-[#E7F0FC] p-3.5 rounded-xl border border-[#BDDDFA]">
                  <div>
                    <h4 className="font-bold text-[#0F172A]">Two-Factor Authentication</h4>
                    <p className="text-[10px] text-[#55647C] mt-0.5"></p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleTogglePrivacy('twoFactorEnabled')}
                    className={`w-11 h-6 rounded-full relative border ${privacySettings.twoFactorEnabled ? 'bg-[#059669] border-[#059669]' : 'bg-slate-300 border-slate-300'}`}
                  >
                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white ${privacySettings.twoFactorEnabled ? 'right-0.5' : 'left-0.5'}`} />
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

export default ProfileManagement;
