import React, { useState, useEffect } from 'react';
import {
  FileText, Shield, ShieldCheck, Lock, Eye, AlertCircle, CheckCircle2,
  Clock, AlertTriangle, RefreshCw, Send, Image as ImageIcon, X
} from 'lucide-react';
import { Modal, Button, SecurityBadge } from './ui';
import { DocumentViewerModal } from './DocumentViewerModal';
import { useNotifications } from './NotificationCenter';

export const DoctorSharedRecordsModal = ({
  isOpen,
  onClose,
  consultationId,
  patient,
  token,
  apiBase
}) => {
  const API_BASE = apiBase || import.meta.env.VITE_API_BASE || 'http://localhost:8000';
  const { triggerNotification } = useNotifications();

  const patientId = patient?.id || patient;
  const patientName = patient?.name || patient?.username || 'Patient';
  const isAnonymous = Boolean(patient?.is_anonymous);

  const [loading, setLoading] = useState(false);
  const [consentStatus, setConsentStatus] = useState(null);
  const [sharedRecords, setSharedRecords] = useState([]);
  const [lockedInfo, setLockedInfo] = useState(null);
  const [error, setError] = useState('');
  const [previewRecord, setPreviewRecord] = useState(null);

  // In-consultation access request form
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [accessPurpose, setAccessPurpose] = useState('');
  const [requestedCategories, setRequestedCategories] = useState(['Prescriptions', 'Lab Reports', 'Clinical Notes']);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    if (isOpen && patientId) {
      loadData();

      const handleSync = () => {
        loadData();
      };
      window.addEventListener('healnsight_consent_updated', handleSync);
      window.addEventListener('healnsight_records_updated', handleSync);
      const handleStorage = (e) => {
        if (e.key === 'healnsight_last_consent_sync' || e.key === 'healnsight_last_record_sync') {
          loadData();
        }
      };
      window.addEventListener('storage', handleStorage);

      const interval = setInterval(() => {
        if (!document.hidden) {
          loadData(true);
        }
      }, 15000);

      return () => {
        window.removeEventListener('healnsight_consent_updated', handleSync);
        window.removeEventListener('healnsight_records_updated', handleSync);
        window.removeEventListener('storage', handleStorage);
        clearInterval(interval);
      };
    }
  }, [isOpen, patientId, consultationId]);

  const loadData = async (isSilent = false) => {
    if (!patientId || isAnonymous) return;
    if (!isSilent) setLoading(true);
    setError('');
    try {
      // 1. View consent status when accessing records
      const statusResp = await fetch(
        `${API_BASE}/api/doctor/consent/status/?patientId=${patientId}&consultationId=${consultationId || ''}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      let isAuth = false;
      let statusInfo = null;
      if (statusResp.ok) {
        statusInfo = await statusResp.json();
        setConsentStatus(statusInfo);
        isAuth = Boolean(statusInfo.is_authorized);
      }

      // Automatically respect consent expiry and revocation:
      // If access is NOT authorized, revoked, or expired, immediately purge records from memory
      if (!isAuth) {
        setSharedRecords([]);
        try {
          const checkResp = await fetch(`${API_BASE}/api/records/?patient_id=${patientId}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (checkResp.ok) {
            const checkData = await checkResp.json();
            if (checkData?.status === 'LOCKED') {
              setLockedInfo(checkData);
            }
          }
        } catch {
          // ignore
        }
        return;
      }

      // 2. View patient-approved medical records
      let recordsList = [];
      const consentRecResp = await fetch(
        `${API_BASE}/api/doctor/consent/records/?patientId=${patientId}&consultationId=${consultationId || ''}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (consentRecResp.ok) {
        const cData = await consentRecResp.json();
        recordsList = cData.records || [];
      }

      // Include records explicitly shared for this active consultation session
      if (consultationId) {
        const consultRecResp = await fetch(
          `${API_BASE}/api/consultations/${consultationId}/shared-records/`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (consultRecResp.ok) {
          const sData = await consultRecResp.json();
          const sList = Array.isArray(sData) ? sData : (sData.shared_records || []);
          const existingIds = new Set(recordsList.map(r => r.id));
          for (const item of sList) {
            if (!existingIds.has(item.id)) {
              recordsList.push(item);
            }
          }
        }
      }

      setSharedRecords(recordsList);
      setLockedInfo(null);
    } catch (err) {
      setError("Network connection issue while verifying consent status.");
    } finally {
      setLoading(false);
    }
  };

  // Request access to medical records within the relevant consultation workflow
  const handleSendRequest = async (e) => {
    e?.preventDefault();
    if (!accessPurpose.trim() || accessPurpose.trim().length < 5) {
      triggerNotification("Clinical Justification Required", "Please specify a medical purpose of at least 5 characters.", "warning");
      return;
    }

    setRequesting(true);
    try {
      const resp = await fetch(`${API_BASE}/api/doctor/consent/request/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          patient_id: patientId,
          consultation_id: consultationId,
          access_purpose: accessPurpose.trim(),
          requested_categories: requestedCategories
        })
      });

      if (resp.ok) {
        triggerNotification(
          "Access Request Submitted",
          "Sent to patient's Privacy & Data Consent Manager. Records will unlock once approved.",
          "security"
        );
        setShowRequestForm(false);
        setAccessPurpose('');
        loadData();
        window.dispatchEvent(new CustomEvent('healnsight_consent_updated'));
        localStorage.setItem('healnsight_last_consent_sync', String(Date.now()));
      } else {
        const err = await resp.json().catch(() => ({}));
        triggerNotification("Request Failed", err.error || err.detail || "Could not submit access request.", "warning");
      }
    } catch {
      triggerNotification("Connection Error", "Failed to connect to consent gateway.", "warning");
    } finally {
      setRequesting(false);
    }
  };

  const formatSeconds = (sec) => {
    if (!sec || sec <= 0) return "Expired";
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    if (h > 0) return `${h}h ${m}m remaining`;
    if (m > 0) return `${m}m ${s}s remaining`;
    return `${s}s remaining`;
  };

  const toggleCategory = (cat) => {
    setRequestedCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  if (!isOpen) return null;

  const isAuthorized = Boolean(consentStatus?.is_authorized);
  const isPending = Boolean(consentStatus?.has_pending_request);
  const statusType = consentStatus?.status || (isAuthorized ? 'granted' : 'not_requested');
  const isRevoked = statusType === 'revoked';
  const isExpired = statusType === 'expired';

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Consultation Medical Records"
        subtitle={`Consultation #${consultationId || 'Active'} • Patient: ${patientName}`}
        maxWidth="max-w-3xl"
      >
        <div className="space-y-4">

          {/* ─── STATUS HEADER BANNER: VIEW CONSENT STATUS ─── */}
          {isAnonymous ? (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-3">
              <Shield className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <p className="font-bold">Anonymous Consultation Session</p>
                <p className="text-[11px] text-amber-700 mt-0.5">
                  Historical health records are sealed to preserve patient anonymity. Only records explicitly uploaded during this active session are accessible.
                </p>
              </div>
            </div>
          ) : isAuthorized ? (
            /* ACTIVE PATIENT CONSENT */
            <div className="bg-[#E7F0FC] border border-[#BDDDFA] rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white border border-[#BDDDFA] flex items-center justify-center text-[#059669] shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-[#0F172A] flex items-center gap-1.5">
                    <span>Patient Consent Active</span>
                    <SecurityBadge text="AES-256 Decrypted" />
                  </h4>
                  <p className="text-[11px] text-[#55647C] flex items-center gap-1.5 mt-0.5">
                    <Clock className="w-3.5 h-3.5 text-[#059669]" />
                    <span className="font-semibold text-[#059669]">
                      {formatSeconds(consentStatus?.time_remaining_seconds)}
                    </span>
                    <span>• Authorized categories: {Array.isArray(consentStatus?.permitted_categories) ? consentStatus.permitted_categories.join(', ') : 'All shared records'}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={loadData}
                  disabled={loading}
                  className="p-1.5 rounded-lg bg-white border border-[#BDDDFA] hover:bg-slate-50 text-slate-700 transition"
                  title="Re-verify consent status & sync records"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                </button>
                <span className="font-bold text-xs text-[#059669] bg-white px-3 py-1.5 rounded-xl border border-[#BDDDFA]">
                  {sharedRecords.length} Approved Report{sharedRecords.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          ) : isPending ? (
            /* PENDING APPROVAL */
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Clock className="w-5 h-5 text-amber-600 shrink-0" />
                <div>
                  <p className="font-bold text-amber-900">Record Access Request Pending</p>
                  <p className="text-[11px] text-amber-700 mt-0.5">
                    Your access request for this consultation was sent to the patient. Awaiting decision in Patient Portal $\rightarrow$ Privacy &amp; Data Consent Manager.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={loadData}
                disabled={loading}
                className="px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-amber-800 font-bold hover:bg-amber-100 transition flex items-center gap-1.5 shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                Check Status
              </button>
            </div>
          ) : isRevoked ? (
            /* REVOKED */
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Lock className="w-5 h-5 text-rose-600 shrink-0" />
                <div>
                  <p className="font-bold text-rose-900">Access Revoked by Patient</p>
                  <p className="text-[11px] text-rose-700 mt-0.5">
                    The patient revoked medical data consent in their Privacy &amp; Data Consent Manager. Decrypted records have been purged.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                icon={Send}
                onClick={() => setShowRequestForm(true)}
              >
                Request Access
              </Button>
            </div>
          ) : isExpired ? (
            /* EXPIRED */
            <div className="p-4 rounded-xl bg-slate-100 border border-slate-300 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Clock className="w-5 h-5 text-slate-600 shrink-0" />
                <div>
                  <p className="font-bold text-slate-900">Consent Window Expired</p>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    The previous access validity window has expired. You may submit an access renewal request for this consultation.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                icon={Send}
                onClick={() => setShowRequestForm(true)}
              >
                Request Renewal
              </Button>
            </div>
          ) : (
            /* NOT YET REQUESTED */
            <div className="p-4 rounded-xl bg-[#E7F0FC] border border-[#BDDDFA] text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Lock className="w-5 h-5 text-[#0066CC] shrink-0" />
                <div>
                  <p className="font-bold text-[#0F172A]">Patient Consent Required</p>
                  <p className="text-[11px] text-[#55647C] mt-0.5">
                    Under Patient Data Sovereignty, records are encrypted at rest and accessible only with patient authorization.
                  </p>
                </div>
              </div>
              {!showRequestForm && (
                <Button
                  variant="primary"
                  size="sm"
                  icon={Send}
                  onClick={() => setShowRequestForm(true)}
                  className="bg-[#0066CC] hover:bg-[#0052A3] text-white shrink-0"
                >
                  Request Record Access
                </Button>
              )}
            </div>
          )}

          {/* ─── IN-WORKFLOW REQUEST FORM ─── */}
          {showRequestForm && !isAuthorized && !isPending && (
            <form onSubmit={handleSendRequest} className="p-4 rounded-2xl bg-white border border-[#BDDDFA] shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-[#0F172A] flex items-center gap-1.5">
                  <Send className="w-3.5 h-3.5 text-[#0066CC]" />
                  <span>Request Record Access for Consultation #{consultationId || 'Session'}</span>
                </h4>
                <button
                  type="button"
                  onClick={() => setShowRequestForm(false)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Clinical Justification / Medical Purpose <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={2}
                  value={accessPurpose}
                  onChange={(e) => setAccessPurpose(e.target.value)}
                  placeholder="e.g. Evaluating baseline ECG and cardiac diagnostic history before finalizing beta blocker treatment..."
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0066CC] resize-none"
                  required
                />
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Visible to the patient in their Privacy &amp; Data Consent Manager to make an informed approval decision.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Requested Categories
                </label>
                <div className="flex flex-wrap gap-2">
                  {['Prescriptions', 'Lab Reports', 'Clinical Notes', 'Discharge Summaries'].map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => toggleCategory(cat)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
                        requestedCategories.includes(cat)
                          ? 'bg-[#E7F0FC] border-[#0066CC] text-[#0066CC]'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <Button variant="outline" size="sm" type="button" onClick={() => setShowRequestForm(false)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  type="submit"
                  loading={requesting}
                  icon={Send}
                  className="bg-[#0066CC] hover:bg-[#0052A3] text-white"
                >
                  Submit Request to Patient
                </Button>
              </div>
            </form>
          )}

          {/* ─── RECORDS LIST: VIEW PATIENT-APPROVED RECORDS ─── */}
          {loading ? (
            <div className="p-10 text-center text-xs text-slate-500">
              <RefreshCw className="w-6 h-6 animate-spin text-[#059669] mx-auto mb-2" />
              Verifying consent token &amp; loading patient-approved records...
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : isAuthorized && sharedRecords.length > 0 ? (
            <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
              {sharedRecords.map(rec => {
                const isPdf = (rec.file_name || '').toLowerCase().endsWith('.pdf') || (rec.mime_type || '').includes('pdf');
                const isImg = (rec.file_name || '').toLowerCase().endsWith('.jpg') || (rec.file_name || '').toLowerCase().endsWith('.jpeg') || (rec.mime_type || '').includes('image');

                return (
                  <div
                    key={rec.id}
                    className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/50 flex items-center justify-between gap-3 shadow-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                        {isImg ? <ImageIcon className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h5 className="font-bold text-xs text-[#0F172A]">{rec.title || rec.file_name || `Record #${rec.id}`}</h5>
                          <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                            {rec.record_type || 'Diagnostic Report'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 flex items-center gap-2 mt-0.5">
                          <span>{rec.file_name || 'Document'}</span>
                          {rec.file_size ? <span>&bull; {Math.round(rec.file_size / 1024)} KB</span> : null}
                          <span>&bull; {rec.date || (rec.created_at ? new Date(rec.created_at).toLocaleDateString() : '')}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="primary"
                        size="sm"
                        icon={Eye}
                        onClick={() => setPreviewRecord(rec)}
                        className="bg-[#059669] hover:bg-[#047857] text-white text-xs font-bold py-1 px-3"
                      >
                        Preview Document
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : isAuthorized && sharedRecords.length === 0 ? (
            <div className="p-8 text-center border-2 border-dashed border-[#BDDDFA] rounded-2xl space-y-2 bg-[#E7F0FC]/20">
              <CheckCircle2 className="w-8 h-8 text-[#059669] mx-auto" />
              <h4 className="text-sm font-bold text-[#0F172A]">Consent Active • No Files in Category</h4>
              <p className="text-xs text-[#55647C] max-w-md mx-auto">
                Patient has granted access, but no uploaded diagnostic documents currently match the permitted categories. Patients can upload files at any time during the consultation.
              </p>
            </div>
          ) : (
            /* SEALED STATE */
            <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-2xl space-y-3 bg-slate-50/50">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                <Lock className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-[#0F172A]">
                {isRevoked ? 'Records Sealed (Access Revoked)' : isExpired ? 'Records Sealed (Consent Expired)' : 'Records Sealed (Awaiting Patient Authorization)'}
              </h4>
              <p className="text-xs text-[#55647C] max-w-md mx-auto leading-relaxed">
                {lockedInfo?.total_records_on_file
                  ? `${lockedInfo.total_records_on_file} encrypted medical record(s) on file remain sealed at rest under zero-trust isolation.`
                  : 'Medical records are protected under Zero-Trust Patient Sovereignty. The patient controls all access permissions.'}
              </p>
            </div>
          )}

          {/* ─── PATIENT SOVEREIGNTY FOOTER NOTE ─── */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[11px]">
                Patient-Controlled Access: Permissions, duration, and revocations are strictly managed by the patient in their Privacy &amp; Data Consent Manager.
              </span>
            </div>
            <span className="text-[10px] uppercase font-bold text-slate-500 bg-slate-200 px-2 py-0.5 rounded shrink-0">
              Zero-Trust
            </span>
          </div>

          <div className="flex justify-end pt-2 border-t border-slate-200">
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </Modal>

      {/* Embedded Document Preview Modal */}
      <DocumentViewerModal
        isOpen={Boolean(previewRecord)}
        onClose={() => setPreviewRecord(null)}
        record={previewRecord}
      />
    </>
  );
};
