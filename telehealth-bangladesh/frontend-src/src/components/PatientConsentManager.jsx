import React, { useState, useEffect } from 'react';
import {
  ShieldCheck, Shield, Lock, Eye, AlertCircle, CheckCircle2,
  Clock, Calendar, User, FileText, RefreshCw, X, PlusCircle,
  AlertTriangle, History, Activity, Sliders, ChevronRight,
  Check, Phone, Info, Zap, Download, Database, ShieldAlert,
  Search
} from 'lucide-react';
import {
  Card, CardHeader, CardTitle, CardDescription, CardContent,
  Button, Modal, EmptyState, SecurityBadge
} from './ui';
import { useNotifications } from './NotificationCenter';

export const PatientConsentManager = ({ token, user, onTabChange }) => {
  const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';
  const { triggerNotification } = useNotifications();

  const [loading, setLoading] = useState(true);

  // Dashboard Data State
  const [activeConsents, setActiveConsents] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [recentHistory, setRecentHistory] = useState([]);
  const [recentAuditLogs, setRecentAuditLogs] = useState([]);
  const [emergencySettings, setEmergencySettings] = useState({
    allow_emergency_break_glass: true,
    require_immediate_sms: true,
    require_immediate_email: true,
    auto_revoke_hours: 2
  });
  const [availableDoctors, setAvailableDoctors] = useState([]);
  const [patientRecords, setPatientRecords] = useState([]);
  const [stats, setStats] = useState({
    active_count: 0,
    pending_count: 0,
    history_count: 0,
    audit_logs_count: 0,
    emergency_allowed: true
  });

  // Action Modals State
  const [approveModalReq, setApproveModalReq] = useState(null);
  const [approveForm, setApproveForm] = useState({
    duration_type: '24_hours',
    custom_hours: 24,
    can_view_lab_reports: true,
    can_view_prescriptions: true,
    can_view_clinical_notes: true,
    selected_record_ids: []
  });

  const [rejectModalReq, setRejectModalReq] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const [revokeModalConsent, setRevokeModalConsent] = useState(null);
  const [revokeReason, setRevokeReason] = useState('');

  const [modifyModalConsent, setModifyModalConsent] = useState(null);
  const [modifyForm, setModifyForm] = useState({
    duration_type: '24_hours',
    custom_hours: 24,
    can_view_lab_reports: true,
    can_view_prescriptions: true,
    can_view_clinical_notes: true,
    selected_record_ids: []
  });

  const [isGrantModalOpen, setIsGrantModalOpen] = useState(false);
  const [grantDoctorSearch, setGrantDoctorSearch] = useState('');
  const [grantForm, setGrantForm] = useState({
    doctor_id: '',
    duration_type: '24_hours',
    custom_hours: 24,
    can_view_lab_reports: true,
    can_view_prescriptions: true,
    can_view_clinical_notes: true,
    selected_record_ids: []
  });

  const [submittingAction, setSubmittingAction] = useState(false);

  // Load Dashboard Data
  const loadDashboard = async (isSilent = false) => {
    try {
      if (!isSilent && activeConsents.length === 0 && pendingRequests.length === 0) {
        setLoading(true);
      }
      const resp = await fetch(`${API_BASE}/api/consent/dashboard/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (resp.ok) {
        const data = await resp.json();
        setActiveConsents(data.active_consents || []);
        setPendingRequests(data.pending_requests || []);
        setRecentHistory(data.recent_history || []);
        setRecentAuditLogs(data.recent_access_logs || []);
        if (data.emergency_settings) setEmergencySettings(data.emergency_settings);
        setAvailableDoctors(data.available_doctors || []);
        setPatientRecords(data.patient_records || []);
        if (data.stats) setStats(data.stats);
      }
    } catch (err) {
      console.error("Failed to load consent dashboard:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();

    // Listen to real-time events across open tabs
    const handleSync = () => {
      loadDashboard(true);
    };
    window.addEventListener('healnsight_consent_updated', handleSync);
    const handleStorage = (e) => {
      if (e.key === 'healnsight_last_consent_sync') loadDashboard(true);
    };
    window.addEventListener('storage', handleStorage);

    const interval = setInterval(() => {
      if (!document.hidden) {
        loadDashboard(true);
      }
    }, 25000);
    return () => {
      window.removeEventListener('healnsight_consent_updated', handleSync);
      window.removeEventListener('storage', handleStorage);
      clearInterval(interval);
    };
  }, []);

  const notifySync = () => {
    window.dispatchEvent(new CustomEvent('healnsight_consent_updated'));
    try {
      localStorage.setItem('healnsight_last_consent_sync', Date.now().toString());
    } catch { }
  };

  // 1. Approve Request Handler
  const handleApproveRequest = async () => {
    if (!approveModalReq) return;
    setSubmittingAction(true);
    try {
      const resp = await fetch(`${API_BASE}/api/consent/requests/${approveModalReq.id}/approve/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          duration_type: approveForm.duration_type,
          custom_hours: approveForm.custom_hours,
          can_view_lab_reports: approveForm.can_view_lab_reports,
          can_view_prescriptions: approveForm.can_view_prescriptions,
          can_view_clinical_notes: approveForm.can_view_clinical_notes,
          allowed_record_ids: approveForm.selected_record_ids.length > 0 ? approveForm.selected_record_ids : undefined
        })
      });

      if (resp.ok) {
        triggerNotification(
          "Access Authorized",
          `Granted record access to Dr. ${approveModalReq.doctor_details?.first_name || approveModalReq.doctor_details?.username} (${approveForm.duration_type.replace('_', ' ')}).`,
          "security"
        );
        setApproveModalReq(null);
        loadDashboard();
        notifySync();
      } else {
        const err = await resp.json();
        triggerNotification("Authorization Error", err.error || "Could not approve request.", "warning");
      }
    } catch (e) {
      triggerNotification("Connection Error", "Failed to reach server.", "warning");
    } finally {
      setSubmittingAction(false);
    }
  };

  // 2. Reject Request Handler
  const handleRejectRequest = async () => {
    if (!rejectModalReq) return;
    setSubmittingAction(true);
    try {
      const resp = await fetch(`${API_BASE}/api/consent/requests/${rejectModalReq.id}/reject/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ rejection_reason: rejectReason })
      });

      if (resp.ok) {
        triggerNotification(
          "Request Declined",
          `Access request from Dr. ${rejectModalReq.doctor_details?.first_name || rejectModalReq.doctor_details?.username} was rejected.`,
          "security"
        );
        setRejectModalReq(null);
        setRejectReason('');
        loadDashboard();
        notifySync();
      } else {
        const err = await resp.json();
        triggerNotification("Error", err.error || "Could not reject request.", "warning");
      }
    } catch (e) {
      triggerNotification("Connection Error", "Failed to reach server.", "warning");
    } finally {
      setSubmittingAction(false);
    }
  };

  // 3. Revoke Consent Handler
  const handleRevokeConsent = async () => {
    if (!revokeModalConsent) return;
    setSubmittingAction(true);
    try {
      const resp = await fetch(`${API_BASE}/api/consent/${revokeModalConsent.id}/revoke/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ revocation_reason: revokeReason || "Revoked by patient." })
      });

      if (resp.ok) {
        triggerNotification(
          "Access Revoked Immediately",
          `Terminated access for Dr. ${revokeModalConsent.doctor_details?.first_name || revokeModalConsent.doctor_details?.username}. Doctor is locked out of your records.`,
          "security"
        );
        setRevokeModalConsent(null);
        setRevokeReason('');
        loadDashboard();
        notifySync();
      } else {
        const err = await resp.json();
        triggerNotification("Revocation Error", err.error || "Could not revoke consent.", "warning");
      }
    } catch (e) {
      triggerNotification("Connection Error", "Failed to reach server.", "warning");
    } finally {
      setSubmittingAction(false);
    }
  };

  // 4. Modify Duration Handler
  const handleModifyDuration = async () => {
    if (!modifyModalConsent) return;
    setSubmittingAction(true);
    try {
      const resp = await fetch(`${API_BASE}/api/consent/${modifyModalConsent.id}/duration/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          duration_type: modifyForm.duration_type,
          custom_hours: modifyForm.custom_hours,
          can_view_lab_reports: modifyForm.can_view_lab_reports,
          can_view_prescriptions: modifyForm.can_view_prescriptions,
          can_view_clinical_notes: modifyForm.can_view_clinical_notes,
          allowed_record_ids: modifyForm.selected_record_ids
        })
      });

      if (resp.ok) {
        triggerNotification(
          "Permissions Updated",
          "Consent duration and record category permissions updated.",
          "security"
        );
        setModifyModalConsent(null);
        await loadDashboard();
        notifySync();
      } else {
        const err = await resp.json();
        triggerNotification("Error", err.error || "Could not update duration.", "warning");
      }
    } catch (e) {
      triggerNotification("Connection Error", "Failed to reach server.", "warning");
    } finally {
      setSubmittingAction(false);
    }
  };

  // 5. Grant Direct Consent Handler
  const handleGrantDirect = async () => {
    if (!grantForm.doctor_id) {
      triggerNotification("Physician Required", "Please select a registered physician to grant access.", "warning");
      return;
    }
    if (!grantForm.can_view_lab_reports && !grantForm.can_view_prescriptions && !grantForm.can_view_clinical_notes) {
      triggerNotification("Permission Required", "Please select at least one record category permission.", "warning");
      return;
    }
    setSubmittingAction(true);
    try {
      const resp = await fetch(`${API_BASE}/api/consent/grant/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          doctor_id: grantForm.doctor_id,
          duration_type: grantForm.duration_type,
          custom_hours: grantForm.custom_hours,
          can_view_lab_reports: grantForm.can_view_lab_reports,
          can_view_prescriptions: grantForm.can_view_prescriptions,
          can_view_clinical_notes: grantForm.can_view_clinical_notes,
          allowed_record_ids: grantForm.selected_record_ids
        })
      });

      if (resp.ok) {
        const selectedDoc = availableDoctors.find(d => String(d.id) === String(grantForm.doctor_id));
        const docName = selectedDoc ? selectedDoc.name : `Doctor #${grantForm.doctor_id}`;
        triggerNotification(
          "Access Delegated",
          `Proactive consent successfully granted to ${docName}.`,
          "security"
        );
        setIsGrantModalOpen(false);
        setGrantDoctorSearch('');
        setGrantForm({
          doctor_id: '',
          duration_type: '24_hours',
          custom_hours: 24,
          can_view_lab_reports: true,
          can_view_prescriptions: true,
          can_view_clinical_notes: true,
          selected_record_ids: []
        });
        await loadDashboard();
        notifySync();
      } else {
        const err = await resp.json();
        triggerNotification("Error", err.error || "Could not grant consent.", "warning");
      }
    } catch (e) {
      triggerNotification("Connection Error", "Failed to reach server.", "warning");
    } finally {
      setSubmittingAction(false);
    }
  };

  // 6. Update Emergency Settings Handler
  const handleSaveEmergencySettings = async (newSettings) => {
    setSubmittingAction(true);
    try {
      const resp = await fetch(`${API_BASE}/api/consent/emergency-settings/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(newSettings)
      });

      if (resp.ok) {
        setEmergencySettings(newSettings);
        triggerNotification("Emergency Settings Saved", "Break-glass preferences successfully updated.", "security");
      } else {
        triggerNotification("Update Failed", "Could not save emergency settings.", "warning");
      }
    } catch (e) {
      triggerNotification("Connection Error", "Failed to reach server.", "warning");
    } finally {
      setSubmittingAction(false);
    }
  };

  // Format remaining time nicely
  const formatSeconds = (sec) => {
    if (!sec || sec <= 0) return "Expired";
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    if (h > 24) {
      const d = Math.floor(h / 24);
      return `${d}d ${h % 24}h remaining`;
    }
    return `${h}h ${m}m remaining`;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-2 sm:px-4">
      {/* ── Header Banner ── */}
      <div className="bg-gradient-to-r from-[#0F172A] via-[#1E293B] to-[#0F172A] text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-700 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Zero-Trust Patient Sovereignty</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Privacy &amp; Data Consent Manager
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Button
              variant="outline"
              size="sm"
              icon={RefreshCw}
              onClick={loadDashboard}
              loading={loading}
              className="bg-slate-800/80 text-white border-slate-600 hover:bg-slate-700"
            >
              Refresh
            </Button>
            <Button
              variant="primary"
              size="md"
              icon={PlusCircle}
              onClick={() => setIsGrantModalOpen(true)}
              className="bg-[#059669] hover:bg-[#047857] text-white font-bold shadow-lg"
            >
              Grant Access to Doctor
            </Button>
          </div>
        </div>

        {/* Decorative background glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
      </div>

      {/* ── Pending Doctor Access Requests (Rendered when requests are awaiting review) ── */}
      {pendingRequests.length > 0 && (
        <Card className="border-2 border-amber-300 bg-amber-50/20">
          <CardHeader>
            <div>
              <CardTitle>Doctor Access Requests</CardTitle>
              <CardDescription>
                Review clinical access requests from your doctors. No record can be decrypted until you approve.
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent>
            <div className="space-y-4">
              {pendingRequests.map((req) => (
                  <div
                    key={req.id}
                    className="p-5 rounded-2xl border-2 border-amber-200 bg-amber-50/40 hover:bg-amber-50/70 transition space-y-4 shadow-xs"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3.5">
                        <div className="w-12 h-12 rounded-2xl bg-white border border-amber-300 text-amber-800 flex items-center justify-center font-bold text-base shadow-xs">
                          {req.doctor_details?.first_name?.[0] || 'D'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-[#0F172A]">
                              Dr. {req.doctor_details?.first_name || ''} {req.doctor_details?.last_name || ''}
                            </h4>
                            <span className="text-xs text-[#55647C]">(@{req.doctor_details?.username})</span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-100 text-amber-900 border border-amber-300">
                              Pending
                            </span>
                          </div>
                          <p className="text-xs text-[#059669] font-semibold mt-0.5">
                            {req.doctor_specialty || 'Medical Specialist'}
                            {req.consultation && <span className="text-slate-500 font-normal ml-2">&bull; Consultation #{req.consultation}</span>}
                          </p>
                        </div>
                      </div>

                      <div className="text-right text-[11px] text-[#55647C]">
                        <span>Requested: {new Date(req.requested_at).toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Purpose Statement */}
                    <div className="p-3.5 bg-white rounded-xl border border-amber-200 space-y-1">
                      <p className="text-[11px] font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                        <Info className="w-3.5 h-3.5 text-amber-600" />
                        Clinical Purpose / Reason for Request
                      </p>
                      <p className="text-xs text-slate-800 italic leading-relaxed">
                        "{req.access_purpose}"
                      </p>
                    </div>

                    {/* Categories Requested */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-slate-600">Requested Categories:</span>
                      {(req.requested_categories || ['Prescriptions', 'Lab Reports', 'Clinical Notes']).map((cat, i) => (
                        <span key={i} className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white text-slate-700 border border-slate-200 shadow-2xs">
                          {cat}
                        </span>
                      ))}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2 border-t border-amber-200/80">
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => {
                          setRejectModalReq(req);
                          setRejectReason('');
                        }}
                      >
                        Reject Request
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        icon={ShieldCheck}
                        onClick={() => {
                          setApproveModalReq(req);
                          setApproveForm({
                            duration_type: '24_hours',
                            custom_hours: 24,
                            can_view_lab_reports: true,
                            can_view_prescriptions: true,
                            can_view_clinical_notes: true,
                            selected_record_ids: []
                          });
                        }}
                        className="bg-[#059669] hover:bg-[#047857] text-white font-bold"
                      >
                        Approve &amp; Configure Access
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Active Doctor Consents ── */}
      <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle>Active Doctor Consents</CardTitle>
                <CardDescription>
                  Physicians currently authorized to view your encrypted medical records. You can revoke access immediately at any moment.
                </CardDescription>
              </div>
              <SecurityBadge text="Active Grants" />
            </div>
          </CardHeader>

          <CardContent>
            {activeConsents.length === 0 ? (
              <EmptyState
                icon={Shield}
                title="No Active Consents Delegated"
                description="Your medical vault is 100% sealed. No doctors currently have access to decrypt your medical records."
              />
            ) : (
              <div className="space-y-4">
                {activeConsents.map((c) => (
                  <div
                    key={c.id}
                    className="p-5 rounded-2xl border border-emerald-200 bg-white hover:shadow-sm transition space-y-4 shadow-xs"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3.5">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-300 text-[#059669] flex items-center justify-center font-bold text-base">
                          {c.doctor_details?.first_name?.[0] || 'D'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-[#0F172A]">
                              Dr. {c.doctor_details?.first_name || ''} {c.doctor_details?.last_name || ''}
                            </h4>
                            <span className="text-xs text-[#55647C]">(@{c.doctor_details?.username})</span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-100 text-emerald-800 border border-emerald-300">
                              Active
                            </span>
                          </div>
                          <p className="text-xs text-[#059669] font-semibold mt-0.5">
                            {c.doctor_specialty || 'Physician'}
                            {c.consultation && <span className="text-slate-500 font-normal ml-2">&bull; Consultation #{c.consultation}</span>}
                          </p>
                        </div>
                      </div>

                      {/* Expiration Countdown Badge */}
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#E7F0FC] text-[#168CF5] border border-[#BDDDFA] text-xs font-bold">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{formatSeconds(c.time_remaining_seconds)}</span>
                      </div>
                    </div>

                    {/* Permissions Overview */}
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-700">Scope:</span>
                        <span className="capitalize px-2 py-0.5 rounded bg-white border border-slate-200 font-bold text-slate-800">
                          {c.duration_type?.replace('_', ' ') || '24 Hours'}
                        </span>
                        <span className="text-slate-500 text-[11px]">
                          &bull; Valid until {new Date(c.valid_until).toLocaleString()}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {c.can_view_lab_reports && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            Lab Reports
                          </span>
                        )}
                        {c.can_view_prescriptions && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                            Prescriptions
                          </span>
                        )}
                        {c.can_view_clinical_notes && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800">
                            Clinical Notes
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                      <Button
                        variant="outline"
                        size="sm"
                        icon={Sliders}
                        onClick={() => {
                          const existingIds = (c.permissions || [])
                            .filter(p => p.is_allowed && p.record)
                            .map(p => p.record);
                          setModifyModalConsent(c);
                          setModifyForm({
                            duration_type: c.duration_type || '24_hours',
                            custom_hours: 24,
                            can_view_lab_reports: c.can_view_lab_reports ?? true,
                            can_view_prescriptions: c.can_view_prescriptions ?? true,
                            can_view_clinical_notes: c.can_view_clinical_notes ?? true,
                            selected_record_ids: existingIds
                          });
                        }}
                      >
                        Modify Duration &amp; Scope
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        icon={Lock}
                        onClick={() => {
                          setRevokeModalConsent(c);
                          setRevokeReason('');
                        }}
                      >
                        Revoke Access
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

      {/* ── Consent Decision Audit Trail ── */}
      <Card>
          <CardHeader>
            <CardTitle>Consent Decision Audit Trail</CardTitle>
            <CardDescription>
              Permanent, tamper-evident timeline of all access requests, approvals, revocations, and expiry events.
            </CardDescription>
          </CardHeader>

          <CardContent>
            {recentHistory.length === 0 ? (
              <EmptyState
                icon={History}
                title="No History Logged"
                description="Consent actions will appear here once doctors request access or you delegate permissions."
              />
            ) : (
              <div className="space-y-3">
                {recentHistory.map((h) => {
                  const actionColors = {
                    REQUESTED: 'bg-amber-100 text-amber-900 border-amber-300',
                    APPROVED: 'bg-emerald-100 text-emerald-900 border-emerald-300',
                    REJECTED: 'bg-red-100 text-red-900 border-red-300',
                    REVOKED: 'bg-rose-100 text-rose-900 border-rose-300',
                    MODIFIED: 'bg-blue-100 text-blue-900 border-blue-300',
                    EXPIRED: 'bg-slate-200 text-slate-800 border-slate-300',
                    EMERGENCY_ACCESS: 'bg-purple-100 text-purple-900 border-purple-300'
                  };

                  return (
                    <div
                      key={h.id}
                      className="p-4 rounded-xl border border-[#BDDDFA] bg-[#E7F0FC]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${actionColors[h.action] || 'bg-slate-100'}`}>
                            {h.action}
                          </span>
                          <span className="font-bold text-[#0F172A]">{h.doctor_name}</span>
                        </div>
                        <p className="text-[#334155]">{h.details}</p>
                      </div>

                      <div className="text-right text-[11px] text-[#55647C] shrink-0">
                        <p className="font-semibold text-slate-700">{new Date(h.timestamp).toLocaleString()}</p>
                        <p className="text-[10px]">Actor: {h.performed_by_name} {h.ip_address ? `• ${h.ip_address}` : ''}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

      {/* ── Data Access Audit Logs ── */}
      <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle>Who Accessed What &amp; When</CardTitle>
                <CardDescription>
                  Detailed zero-trust audit log tracking every physician inspection, document preview, and download.
                </CardDescription>
              </div>
              <SecurityBadge text="Forensic Audit Trail" />
            </div>
          </CardHeader>

          <CardContent>
            {recentAuditLogs.length === 0 ? (
              <EmptyState
                icon={Activity}
                title="No Access Events Logged"
                description="When a physician inspects your health records, the exact timestamp, record ID, and IP address will be recorded here."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border border-slate-200 rounded-xl overflow-hidden">
                  <thead className="bg-[#0F172A] text-white uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="py-3 px-3.5">Timestamp</th>
                      <th className="py-3 px-3.5">Physician</th>
                      <th className="py-3 px-3.5">Record Inspected</th>
                      <th className="py-3 px-3.5">Action</th>
                      <th className="py-3 px-3.5">Status</th>
                      <th className="py-3 px-3.5">IP Address</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {recentAuditLogs.map((log) => {
                      const isAuth = log.permission_status === 'AUTHORIZED' || log.permission_status === 'EMERGENCY_OVERRIDE';
                      return (
                        <tr key={log.id} className="hover:bg-slate-50">
                          <td className="py-3 px-3.5 text-slate-700 font-medium whitespace-nowrap">
                            {new Date(log.timestamp).toLocaleString()}
                          </td>
                          <td className="py-3 px-3.5 font-bold text-[#0F172A] whitespace-nowrap">
                            {log.doctor_name}
                          </td>
                          <td className="py-3 px-3.5 text-slate-800">
                            <span className="font-semibold block">{log.record_title}</span>
                            <span className="text-[10px] text-slate-500 uppercase">{log.record_type}</span>
                          </td>
                          <td className="py-3 px-3.5">
                            <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-slate-100 text-slate-800">
                              {log.access_type}
                            </span>
                          </td>
                          <td className="py-3 px-3.5">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${log.permission_status === 'EMERGENCY_OVERRIDE'
                                ? 'bg-purple-100 text-purple-900 border border-purple-300'
                                : isAuth
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                  : 'bg-red-100 text-red-800 border border-red-300'
                              }`}>
                              {log.permission_status}
                            </span>
                          </td>
                          <td className="py-3 px-3.5 text-slate-500 font-mono text-[11px]">
                            {log.ip_address || '127.0.0.1'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

      {/* ── Emergency Break-Glass Protocols ── */}
      <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle>Emergency Break-Glass Protocols</CardTitle>
                <CardDescription>
                  Configure automated break-glass permissions for emergency room personnel in life-threatening medical events.
                </CardDescription>
              </div>
              <SecurityBadge text="Life-Safety Safeguard" />
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
              <h5 className="font-bold flex items-center gap-1.5 text-sm">
                <AlertTriangle className="w-4 h-4 text-amber-700" />
                How Break-Glass Emergency Access Operates
              </h5>
              <p className="leading-relaxed">
                If enabled, a verified physician in an acute trauma or emergency scenario can invoke emergency access.
                They must provide a sworn clinical medical justification. An immediate SMS and email notification will be dispatched to you,
                and access auto-revokes after your configured duration.
              </p>
            </div>

            <div className="space-y-4">
              {/* Setting 1: Allow Break-Glass */}
              <div className="flex items-center justify-between p-4 rounded-xl border border-[#BDDDFA] bg-white">
                <div className="space-y-0.5">
                  <h4 className="text-xs font-bold text-[#0F172A]">Allow Emergency Break-Glass Access</h4>
                  <p className="text-[11px] text-[#55647C]">Permit emergency physicians to view critical health records during life-threatening crises.</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleSaveEmergencySettings({
                    ...emergencySettings,
                    allow_emergency_break_glass: !emergencySettings.allow_emergency_break_glass
                  })}
                  className={`w-11 h-6 rounded-full relative transition ${emergencySettings.allow_emergency_break_glass ? 'bg-[#059669]' : 'bg-slate-300'
                    }`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${emergencySettings.allow_emergency_break_glass ? 'right-0.5' : 'left-0.5'
                    }`} />
                </button>
              </div>

              {/* Setting 2: SMS Notification */}
              <div className="flex items-center justify-between p-4 rounded-xl border border-[#BDDDFA] bg-white">
                <div className="space-y-0.5">
                  <h4 className="text-xs font-bold text-[#0F172A]">Require Immediate SMS Alert</h4>
                  <p className="text-[11px] text-[#55647C]">Instantly dispatch an SMS alert to your verified mobile number if emergency access is invoked.</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleSaveEmergencySettings({
                    ...emergencySettings,
                    require_immediate_sms: !emergencySettings.require_immediate_sms
                  })}
                  className={`w-11 h-6 rounded-full relative transition ${emergencySettings.require_immediate_sms ? 'bg-[#059669]' : 'bg-slate-300'
                    }`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${emergencySettings.require_immediate_sms ? 'right-0.5' : 'left-0.5'
                    }`} />
                </button>
              </div>

              {/* Setting 3: Auto-Revoke Duration */}
              <div className="p-4 rounded-xl border border-[#BDDDFA] bg-white space-y-2">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <h4 className="text-xs font-bold text-[#0F172A]">Emergency Auto-Revoke Duration</h4>
                    <p className="text-[11px] text-[#55647C]">Emergency access automatically expires and locks down after this period.</p>
                  </div>
                  <span className="font-bold text-xs text-[#059669] bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                    {emergencySettings.auto_revoke_hours} Hour{emergencySettings.auto_revoke_hours !== 1 ? 's' : ''}
                  </span>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  {[1, 2, 4, 12, 24].map((hours) => (
                    <button
                      key={hours}
                      type="button"
                      onClick={() => handleSaveEmergencySettings({
                        ...emergencySettings,
                        auto_revoke_hours: hours
                      })}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${emergencySettings.auto_revoke_hours === hours
                          ? 'bg-[#0F172A] text-white border-[#0F172A]'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                    >
                      {hours}h
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

      {/* ── MODAL 1: APPROVE REQUEST MODAL ── */}
      <Modal
        isOpen={!!approveModalReq}
        onClose={() => setApproveModalReq(null)}
        title="Approve Medical Record Access"
        subtitle={`Doctor: Dr. ${approveModalReq?.doctor_details?.first_name || approveModalReq?.doctor_details?.username}`}
        maxWidth="max-w-xl"
      >
        <div className="space-y-4">
          <div className="p-3 bg-[#E7F0FC] rounded-xl border border-[#BDDDFA] text-xs">
            <span className="font-bold text-[#0F172A] block mb-0.5">Physician Clinical Purpose:</span>
            <p className="text-[#334155] italic">"{approveModalReq?.access_purpose}"</p>
          </div>

          {/* 1. Duration Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#0F172A] block">Consent Validity Duration</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'consultation_only', label: 'Consultation Only' },
                { id: '24_hours', label: '24 Hours' },
                { id: '7_days', label: '7 Days' },
                { id: 'custom', label: 'Custom' }
              ].map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setApproveForm({ ...approveForm, duration_type: opt.id })}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition text-center ${approveForm.duration_type === opt.id
                      ? 'bg-[#059669] text-white border-[#059669]'
                      : 'bg-white text-slate-700 border-[#BDDDFA] hover:bg-slate-50'
                    }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {approveForm.duration_type === 'custom' && (
              <div className="pt-2 flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="720"
                  value={approveForm.custom_hours}
                  onChange={e => setApproveForm({ ...approveForm, custom_hours: parseInt(e.target.value) || 24 })}
                  className="w-24 p-2 text-xs border border-[#BDDDFA] rounded-lg"
                />
                <span className="text-xs text-slate-600">hours of access</span>
              </div>
            )}
          </div>

          {/* 2. Granular Record Category Permissions */}
          <div className="space-y-2 pt-2 border-t border-slate-200">
            <label className="text-xs font-bold text-[#0F172A] block">Record Category Permissions</label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={approveForm.can_view_lab_reports}
                  onChange={e => setApproveForm({ ...approveForm, can_view_lab_reports: e.target.checked })}
                  className="rounded text-[#059669]"
                />
                <span className="font-semibold">Lab Reports &amp; Diagnostic Tests</span>
              </label>

              <label className="flex items-center gap-2 text-xs text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={approveForm.can_view_prescriptions}
                  onChange={e => setApproveForm({ ...approveForm, can_view_prescriptions: e.target.checked })}
                  className="rounded text-[#059669]"
                />
                <span className="font-semibold">Prescriptions &amp; Medication History</span>
              </label>

              <label className="flex items-center gap-2 text-xs text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={approveForm.can_view_clinical_notes}
                  onChange={e => setApproveForm({ ...approveForm, can_view_clinical_notes: e.target.checked })}
                  className="rounded text-[#059669]"
                />
                <span className="font-semibold">Clinical Notes &amp; Consultation Summaries</span>
              </label>
            </div>
          </div>

          {/* 3. Selective Records (Optional) */}
          {patientRecords.length > 0 && (
            <div className="space-y-1.5 pt-2 border-t border-slate-200">
              <label className="text-xs font-bold text-[#0F172A] block">
                Restrict to Specific Records (Leave blank to share all in category)
              </label>
              <div className="max-h-36 overflow-y-auto space-y-1 pr-1 border border-slate-200 rounded-xl p-2 bg-slate-50">
                {patientRecords.map(r => (
                  <label key={r.id} className="flex items-center justify-between p-1.5 hover:bg-white rounded text-xs cursor-pointer">
                    <span className="font-medium text-slate-800 truncate max-w-xs">{r.title || r.file_name}</span>
                    <input
                      type="checkbox"
                      checked={approveForm.selected_record_ids.includes(r.id)}
                      onChange={e => {
                        const next = e.target.checked
                          ? [...approveForm.selected_record_ids, r.id]
                          : approveForm.selected_record_ids.filter(id => id !== r.id);
                        setApproveForm({ ...approveForm, selected_record_ids: next });
                      }}
                      className="rounded text-[#059669]"
                    />
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-200">
            <Button variant="outline" size="sm" onClick={() => setApproveModalReq(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              icon={ShieldCheck}
              loading={submittingAction}
              onClick={handleApproveRequest}
              className="bg-[#059669] hover:bg-[#047857] text-white font-bold"
            >
              Confirm &amp; Authorize Access
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── MODAL 2: REJECT REQUEST MODAL ── */}
      <Modal
        isOpen={!!rejectModalReq}
        onClose={() => setRejectModalReq(null)}
        title="Decline Access Request"
        subtitle={`Doctor: Dr. ${rejectModalReq?.doctor_details?.first_name || rejectModalReq?.doctor_details?.username}`}
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-xs text-[#55647C]">
            Provide an optional reason why you are declining access to your medical data.
          </p>

          <textarea
            rows={3}
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            placeholder="e.g., Record is unrelated to current consultation symptoms."
            className="w-full p-3 text-xs border border-[#BDDDFA] rounded-xl outline-none focus:border-red-400"
          />

          <div className="flex justify-end gap-2.5 pt-2">
            <Button variant="outline" size="sm" onClick={() => setRejectModalReq(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              loading={submittingAction}
              onClick={handleRejectRequest}
            >
              Confirm Rejection
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── MODAL 3: REVOKE CONSENT MODAL ── */}
      <Modal
        isOpen={!!revokeModalConsent}
        onClose={() => setRevokeModalConsent(null)}
        title="Immediate Access Revocation"
        subtitle={`Doctor: Dr. ${revokeModalConsent?.doctor_details?.first_name || revokeModalConsent?.doctor_details?.username}`}
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 space-y-1">
            <h5 className="font-bold flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              Immediate Lockout
            </h5>
            <p>
              Once confirmed, this physician will instantly be locked out of your encrypted health records.
              Zero records will be decrypted or viewable.
            </p>
          </div>

          <textarea
            rows={2}
            value={revokeReason}
            onChange={e => setRevokeReason(e.target.value)}
            placeholder="Reason for revocation (optional)..."
            className="w-full p-3 text-xs border border-[#BDDDFA] rounded-xl outline-none"
          />

          <div className="flex justify-end gap-2.5 pt-2">
            <Button variant="outline" size="sm" onClick={() => setRevokeModalConsent(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="md"
              loading={submittingAction}
              onClick={handleRevokeConsent}
              className="font-bold"
            >
              Revoke Access Now
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── MODAL 4: MODIFY DURATION MODAL ── */}
      <Modal
        isOpen={!!modifyModalConsent}
        onClose={() => setModifyModalConsent(null)}
        title="Modify Consent Duration & Scope"
        subtitle={`Doctor: Dr. ${modifyModalConsent?.doctor_details?.first_name || modifyModalConsent?.doctor_details?.username}`}
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#0F172A] block">Update Validity Duration</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'consultation_only', label: 'Consultation Only' },
                { id: '24_hours', label: '24 Hours' },
                { id: '7_days', label: '7 Days' },
                { id: 'custom', label: 'Custom Hours' }
              ].map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setModifyForm({ ...modifyForm, duration_type: opt.id })}
                  className={`p-2 rounded-xl border text-xs font-bold transition text-center ${modifyForm.duration_type === opt.id
                      ? 'bg-[#059669] text-white border-[#059669]'
                      : 'bg-white text-slate-700 border-[#BDDDFA] hover:bg-slate-50'
                    }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {modifyForm.duration_type === 'custom' && (
              <div className="pt-2 flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="720"
                  value={modifyForm.custom_hours}
                  onChange={e => setModifyForm({ ...modifyForm, custom_hours: parseInt(e.target.value) || 24 })}
                  className="w-24 p-2 text-xs border border-[#BDDDFA] rounded-lg"
                />
                <span className="text-xs text-slate-600">hours</span>
              </div>
            )}
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-200">
            <label className="text-xs font-bold text-[#0F172A] block">Category Permissions</label>
            <label className="flex items-center gap-2 text-xs text-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={modifyForm.can_view_lab_reports}
                onChange={e => setModifyForm({ ...modifyForm, can_view_lab_reports: e.target.checked })}
                className="rounded text-[#059669]"
              />
              <span>Lab Reports &amp; Diagnostic Tests</span>
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={modifyForm.can_view_prescriptions}
                onChange={e => setModifyForm({ ...modifyForm, can_view_prescriptions: e.target.checked })}
                className="rounded text-[#059669]"
              />
              <span>Prescriptions &amp; Rx</span>
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={modifyForm.can_view_clinical_notes}
                onChange={e => setModifyForm({ ...modifyForm, can_view_clinical_notes: e.target.checked })}
                className="rounded text-[#059669]"
              />
              <span>Clinical Notes</span>
            </label>
          </div>

          {/* Selective Medical Records */}
          {patientRecords.length > 0 && (
            <div className="space-y-1.5 pt-2 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-[#0F172A] block">
                  Select Specific Records (Optional)
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setModifyForm({ ...modifyForm, selected_record_ids: patientRecords.map(r => r.id) })}
                    className="text-[10px] text-[#059669] font-bold hover:underline"
                  >
                    Select All
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={() => setModifyForm({ ...modifyForm, selected_record_ids: [] })}
                    className="text-[10px] text-slate-500 font-medium hover:underline"
                  >
                    Clear
                  </button>
                </div>
              </div>
              <p className="text-[11px] text-slate-500">
                {modifyForm.selected_record_ids.length > 0
                  ? `${modifyForm.selected_record_ids.length} of ${patientRecords.length} records selected`
                  : 'All records in permitted categories are accessible.'}
              </p>
              <div className="max-h-36 overflow-y-auto space-y-1 pr-1 border border-slate-200 rounded-xl p-2 bg-slate-50">
                {patientRecords.map(r => (
                  <label key={r.id} className="flex items-center justify-between p-1.5 hover:bg-white rounded text-xs cursor-pointer">
                    <div className="truncate max-w-[280px]">
                      <span className="font-medium text-slate-800 block truncate">{r.title || r.file_name}</span>
                      <span className="text-[10px] text-slate-500">{r.record_type} &bull; {new Date(r.created_at).toLocaleDateString()}</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={modifyForm.selected_record_ids.includes(r.id)}
                      onChange={e => {
                        const next = e.target.checked
                          ? [...modifyForm.selected_record_ids, r.id]
                          : modifyForm.selected_record_ids.filter(id => id !== r.id);
                        setModifyForm({ ...modifyForm, selected_record_ids: next });
                      }}
                      className="rounded text-[#059669]"
                    />
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-200">
            <Button variant="outline" size="sm" onClick={() => setModifyModalConsent(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              loading={submittingAction}
              onClick={handleModifyDuration}
              className="bg-[#059669] hover:bg-[#047857] text-white font-bold"
            >
              Save Changes
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── MODAL 5: GRANT DIRECT ACCESS MODAL ── */}
      <Modal
        isOpen={isGrantModalOpen}
        onClose={() => {
          setIsGrantModalOpen(false);
          setGrantDoctorSearch('');
        }}
        title="Grant Medical Record Access to Doctor"
        subtitle="Authorize a verified physician to inspect your medical history."
        maxWidth="max-w-xl"
      >
        <div className="space-y-4">
          {/* 1. Doctor Selection & Search */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#0F172A] block">Select Physician</label>
              <span className="text-[11px] text-[#059669] font-semibold">
                {availableDoctors.length} Registered Doctor{availableDoctors.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* If doctor already selected, show verified doctor card */}
            {grantForm.doctor_id ? (
              (() => {
                const doc = availableDoctors.find(d => String(d.id) === String(grantForm.doctor_id));
                return (
                  <div className="p-3.5 rounded-2xl border-2 border-emerald-300 bg-emerald-50/40 flex items-center justify-between gap-3 shadow-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-white border border-emerald-300 text-[#059669] flex items-center justify-center font-bold text-base shadow-xs">
                        {doc?.name?.replace('Dr. ', '')?.[0] || 'D'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-[#0F172A]">{doc?.name || `Doctor #${grantForm.doctor_id}`}</h4>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            BMDC Verified
                          </span>
                        </div>
                        <p className="text-xs text-[#059669] font-semibold mt-0.5">
                          {doc?.specialty || 'General Practitioner'} &bull; <span className="text-slate-600 font-normal">{doc?.hospital || 'HealNSight Medical Center'}</span>
                        </p>
                        <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                          BMDC Reg: {doc?.bmdc_reg || 'BMDC-VERIFIED'} {doc?.has_appointment && <span className="text-emerald-700 font-bold ml-1.5">&bull; Prior Consultation</span>}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setGrantForm({ ...grantForm, doctor_id: '' })}
                      className="text-xs shrink-0 bg-white hover:bg-slate-50"
                    >
                      Change
                    </Button>
                  </div>
                );
              })()
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={grantDoctorSearch}
                    onChange={e => setGrantDoctorSearch(e.target.value)}
                    placeholder="Search doctor by name, specialty, hospital, or BMDC..."
                    className="w-full pl-9 pr-8 py-2 text-xs border border-[#BDDDFA] rounded-xl outline-none focus:border-[#059669]"
                  />
                  {grantDoctorSearch && (
                    <button
                      type="button"
                      onClick={() => setGrantDoctorSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 border border-slate-200 rounded-xl p-2 bg-slate-50/60">
                  {(() => {
                    const searchLower = grantDoctorSearch.toLowerCase().trim();
                    const filtered = availableDoctors.filter(d => {
                      if (!searchLower) return true;
                      return (
                        (d.name || '').toLowerCase().includes(searchLower) ||
                        (d.specialty || '').toLowerCase().includes(searchLower) ||
                        (d.hospital || '').toLowerCase().includes(searchLower) ||
                        (d.username || '').toLowerCase().includes(searchLower) ||
                        (d.bmdc_reg || '').toLowerCase().includes(searchLower)
                      );
                    });

                    if (filtered.length === 0) {
                      return (
                        <div className="text-center py-4 text-xs text-slate-500">
                          No registered doctors found matching "{grantDoctorSearch}".
                        </div>
                      );
                    }

                    return filtered.map(doc => (
                      <div
                        key={doc.id}
                        onClick={() => setGrantForm({ ...grantForm, doctor_id: doc.id })}
                        className="p-2.5 rounded-xl border border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/30 transition cursor-pointer flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 text-[#059669] flex items-center justify-center font-bold text-xs shrink-0">
                            {doc.name?.replace('Dr. ', '')?.[0] || 'D'}
                          </div>
                          <div className="truncate">
                            <div className="flex items-center gap-1.5 truncate">
                              <span className="font-bold text-xs text-[#0F172A] truncate">{doc.name}</span>
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 shrink-0">
                                Verified
                              </span>
                            </div>
                            <p className="text-[11px] text-[#059669] truncate">
                              {doc.specialty} &bull; <span className="text-slate-500">{doc.hospital}</span>
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-[11px] h-7 px-2.5 text-[#059669] border-emerald-300 hover:bg-emerald-50 shrink-0"
                        >
                          Select
                        </Button>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            )}
          </div>

          {/* 2. Duration Window */}
          <div className="space-y-1.5 pt-2 border-t border-slate-200">
            <label className="text-xs font-bold text-[#0F172A] block">Consent Duration Window</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'consultation_only', label: 'Consultation (2h)' },
                { id: '24_hours', label: '24 Hours' },
                { id: '7_days', label: '7 Days' },
                { id: 'custom', label: 'Custom Hours' }
              ].map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setGrantForm({ ...grantForm, duration_type: opt.id })}
                  className={`p-2 rounded-xl border text-xs font-bold transition text-center ${grantForm.duration_type === opt.id
                      ? 'bg-[#059669] text-white border-[#059669]'
                      : 'bg-white text-slate-700 border-[#BDDDFA] hover:bg-slate-50'
                    }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {grantForm.duration_type === 'custom' && (
              <div className="pt-2 flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="720"
                  value={grantForm.custom_hours}
                  onChange={e => setGrantForm({ ...grantForm, custom_hours: parseInt(e.target.value) || 24 })}
                  className="w-24 p-2 text-xs border border-[#BDDDFA] rounded-lg"
                />
                <span className="text-xs text-slate-600">hours of access</span>
              </div>
            )}
          </div>

          {/* 3. Category Permissions */}
          <div className="space-y-2 pt-2 border-t border-slate-200">
            <label className="text-xs font-bold text-[#0F172A] block">Record Category Permissions</label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={grantForm.can_view_lab_reports}
                  onChange={e => setGrantForm({ ...grantForm, can_view_lab_reports: e.target.checked })}
                  className="rounded text-[#059669]"
                />
                <span className="font-semibold">Lab Reports &amp; Diagnostic Records</span>
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={grantForm.can_view_prescriptions}
                  onChange={e => setGrantForm({ ...grantForm, can_view_prescriptions: e.target.checked })}
                  className="rounded text-[#059669]"
                />
                <span className="font-semibold">Prescriptions &amp; Medication Vault</span>
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={grantForm.can_view_clinical_notes}
                  onChange={e => setGrantForm({ ...grantForm, can_view_clinical_notes: e.target.checked })}
                  className="rounded text-[#059669]"
                />
                <span className="font-semibold">Clinical Notes &amp; Consultation Summaries</span>
              </label>
            </div>
          </div>

          {/* 4. Selective Medical Records */}
          {patientRecords.length > 0 && (
            <div className="space-y-1.5 pt-2 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-[#0F172A] block">
                  Select Specific Medical Records (Optional)
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setGrantForm({ ...grantForm, selected_record_ids: patientRecords.map(r => r.id) })}
                    className="text-[10px] text-[#059669] font-bold hover:underline"
                  >
                    Select All
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={() => setGrantForm({ ...grantForm, selected_record_ids: [] })}
                    className="text-[10px] text-slate-500 font-medium hover:underline"
                  >
                    Clear
                  </button>
                </div>
              </div>
              <p className="text-[11px] text-slate-500">
                {grantForm.selected_record_ids.length > 0
                  ? `${grantForm.selected_record_ids.length} of ${patientRecords.length} records selected`
                  : 'Leave empty to authorize all records in permitted categories.'}
              </p>
              <div className="max-h-36 overflow-y-auto space-y-1 pr-1 border border-slate-200 rounded-xl p-2 bg-slate-50">
                {patientRecords.map(r => (
                  <label key={r.id} className="flex items-center justify-between p-1.5 hover:bg-white rounded text-xs cursor-pointer">
                    <div className="truncate max-w-[280px]">
                      <span className="font-medium text-slate-800 block truncate">{r.title || r.file_name}</span>
                      <span className="text-[10px] text-slate-500">{r.record_type} &bull; {new Date(r.created_at).toLocaleDateString()}</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={grantForm.selected_record_ids.includes(r.id)}
                      onChange={e => {
                        const next = e.target.checked
                          ? [...grantForm.selected_record_ids, r.id]
                          : grantForm.selected_record_ids.filter(id => id !== r.id);
                        setGrantForm({ ...grantForm, selected_record_ids: next });
                      }}
                      className="rounded text-[#059669]"
                    />
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* 5. Modal Footer Actions */}
          <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-200">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsGrantModalOpen(false);
                setGrantDoctorSearch('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              icon={ShieldCheck}
              loading={submittingAction}
              disabled={!grantForm.doctor_id || (!grantForm.can_view_lab_reports && !grantForm.can_view_prescriptions && !grantForm.can_view_clinical_notes)}
              onClick={handleGrantDirect}
              className="bg-[#059669] hover:bg-[#047857] text-white font-bold"
            >
              Delegate Access Now
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

