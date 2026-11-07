import React, { useState, useEffect } from 'react';
import {
  FileText, Shield, Lock, Upload, Check, X, Eye, HardDrive,
  AlertCircle, CheckCircle2, RefreshCw, FileCheck, Image as ImageIcon,
  PlusCircle, FolderLock, ShieldCheck
} from 'lucide-react';
import { Modal, Button, SecurityBadge } from './ui';
import { PatientStorageIndicator } from './PatientStorageIndicator';
import { DocumentViewerModal } from './DocumentViewerModal';

export const PatientConsultationRecordsModal = ({
  isOpen,
  onClose,
  appointment,
  token,
  apiBase,
  onSuccess
}) => {
  const API_BASE = apiBase || import.meta.env.VITE_API_BASE || 'http://localhost:8000';
  const consultId = appointment?.consultation?.id || appointment?.id;
  const doctorName = appointment?.doctor_details
    ? `Dr. ${appointment.doctor_details.first_name || ''} ${appointment.doctor_details.last_name || ''}`.trim()
    : 'Consulting Doctor';

  const [activeTab, setActiveTab] = useState('previous'); // 'previous' | 'upload'
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [records, setRecords] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [storage, setStorage] = useState(null);
  const [statusMessage, setStatusMessage] = useState(null);
  const [previewRecord, setPreviewRecord] = useState(null);

  // Upload Form State
  const [uploadCategory, setUploadCategory] = useState('Lab Report');
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDate, setUploadDate] = useState(new Date().toISOString().split('T')[0]);
  const [uploadFindings, setUploadFindings] = useState('');
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadFileData, setUploadFileData] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [autoShareNew, setAutoShareNew] = useState(true);

  useEffect(() => {
    if (isOpen && consultId) {
      loadConsultationRecords();
    }
  }, [isOpen, consultId]);

  const loadConsultationRecords = async () => {
    setLoading(true);
    setStatusMessage(null);
    try {
      // 1. Fetch shared records and full patient records from consultation endpoint
      const resp = await fetch(`${API_BASE}/api/consultations/${consultId}/shared-records/`, {
        headers: { 
          Authorization: `Bearer ${token}`
        }
      });

      if (resp.ok) {
        const data = await resp.json();
        const sharedIdsList = data.shared_record_ids || (Array.isArray(data) ? data.map(r => r.id) : (data.shared_records?.map(r => r.id) || []));
        setSelectedIds(new Set(sharedIdsList));

        if (data.all_patient_records && Array.isArray(data.all_patient_records)) {
          setRecords(data.all_patient_records);
        } else {
          // Fallback fetch all records
          const allResp = await fetch(`${API_BASE}/api/records/`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (allResp.ok) {
            const allData = await allResp.json();
            setRecords(Array.isArray(allData) ? allData : []);
          }
        }

        if (data.storage) {
          setStorage(data.storage);
        } else {
          // Fallback fetch storage
          const sResp = await fetch(`${API_BASE}/api/records/storage/`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (sResp.ok) {
            setStorage(await sResp.json());
          }
        }
      } else {
        // Fallback: fetch records and storage directly
        const [rRes, sRes] = await Promise.all([
          fetch(`${API_BASE}/api/records/`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_BASE}/api/records/storage/`, { headers: { Authorization: `Bearer ${token}` } })
        ]);
        if (rRes.ok) setRecords(await rRes.json());
        if (sRes.ok) setStorage(await sRes.json());
      }
    } catch (err) {
      console.warn("Failed to load consultation shared records:", err);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelectRecord = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === records.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(records.map(r => r.id)));
    }
  };

  // Handle File Input Selection
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    setUploadError('');
    if (!file) return;

    // Validate format (PDF, JPG, JPEG only)
    const nameLower = file.name.toLowerCase();
    const isValidFormat = nameLower.endsWith('.pdf') || nameLower.endsWith('.jpg') || nameLower.endsWith('.jpeg') ||
      file.type === 'application/pdf' || file.type === 'image/jpeg' || file.type === 'image/jpg';

    if (!isValidFormat) {
      setUploadError("Invalid file type. Only PDF, JPG, and JPEG documents are supported.");
      e.target.value = '';
      return;
    }

    // Validate size against remaining 250 MB quota
    const availableBytes = storage?.available_bytes ?? (250 * 1024 * 1024);
    if (file.size > availableBytes) {
      const availMb = (availableBytes / (1024 * 1024)).toFixed(1);
      const fileMb = (file.size / (1024 * 1024)).toFixed(1);
      setUploadError(`File size (${fileMb} MB) exceeds available storage quota (${availMb} MB).`);
      e.target.value = '';
      return;
    }

    setUploadFile(file);
    if (!uploadTitle) {
      setUploadTitle(file.name.replace(/\.[^/.]+$/, ""));
    }

    // Read file as Base64 data URL
    const reader = new FileReader();
    reader.onload = () => {
      setUploadFileData(reader.result);
    };
    reader.onerror = () => {
      setUploadError("Failed to read file.");
    };
    reader.readAsDataURL(file);
  };

  // Handle New Report Upload
  const handleUploadReport = async (e) => {
    e.preventDefault();
    if (!uploadFile && !uploadFindings.trim()) {
      setUploadError("Please attach a document or enter clinical findings.");
      return;
    }

    setSaving(true);
    setUploadError('');

    const newRecordPayload = {
      title: uploadTitle.trim() || `${uploadCategory} Report`,
      record_type: uploadCategory,
      content: uploadFindings.trim() || `Uploaded document: ${uploadFile?.name || 'Report'}`,
      file_name: uploadFile?.name || `${uploadCategory.replace(/\s+/g, '_')}_${Date.now()}.pdf`,
      file_size: uploadFile?.size || 35000,
      mime_type: uploadFile?.type || (uploadFile?.name?.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'),
      file_data: uploadFileData || ''
    };

    try {
      const resp = await fetch(`${API_BASE}/api/consultations/${consultId}/share-records/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          record_ids: Array.from(selectedIds),
          new_record: autoShareNew ? newRecordPayload : null
        })
      });

      if (resp.ok) {
        setStatusMessage({
          type: 'success',
          text: `Report "${newRecordPayload.title}" encrypted, saved, and ${autoShareNew ? 'shared with ' + doctorName : 'stored in your vault'}.`
        });
        // Reset upload form
        setUploadFile(null);
        setUploadFileData('');
        setUploadTitle('');
        setUploadFindings('');
        setActiveTab('previous');
        await loadConsultationRecords();
        window.dispatchEvent(new CustomEvent('healnsight_records_updated', { detail: { consultationId: consultId } }));
        try { localStorage.setItem('healnsight_last_record_sync', Date.now().toString()); } catch {}
        if (onSuccess) onSuccess();
      } else {
        const err = await resp.json();
        setUploadError(err.error || "Failed to upload and share medical report.");
      }
    } catch (err) {
      setUploadError("Network connection error. Could not upload record.");
    } finally {
      setSaving(false);
    }
  };

  // Save Record Selection for Consultation
  const handleSaveSelection = async () => {
    setSaving(true);
    setStatusMessage(null);
    try {
      const resp = await fetch(`${API_BASE}/api/consultations/${consultId}/share-records/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          record_ids: Array.from(selectedIds)
        })
      });

      if (resp.ok) {
        setStatusMessage({
          type: 'success',
          text: `Successfully updated consultation records. ${selectedIds.size} record${selectedIds.size === 1 ? '' : 's'} shared with ${doctorName}.`
        });
        window.dispatchEvent(new CustomEvent('healnsight_records_updated', { detail: { consultationId: consultId } }));
        try { localStorage.setItem('healnsight_last_record_sync', Date.now().toString()); } catch {}
        setTimeout(() => {
          onClose();
        }, 1200);
        if (onSuccess) onSuccess();
      } else {
        const err = await resp.json();
        setStatusMessage({ type: 'error', text: err.error || "Failed to update record permissions." });
      }
    } catch (err) {
      setStatusMessage({ type: 'error', text: "Network error saving consultation records." });
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Consultation Medical Records"
        subtitle={`Session with ${doctorName} • Only patient-authorized records are accessible`}
        maxWidth="max-w-3xl"
      >
        <div className="space-y-4">

          {/* Privacy Scope Banner */}
          <div className="bg-[#E7F0FC] border border-[#BDDDFA] rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-white border border-[#BDDDFA] flex items-center justify-center text-[#059669] shrink-0">
                <FolderLock className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-[#0F172A] flex items-center gap-1.5">
                  <span>Patient-Controlled Record Privacy</span>
                  <SecurityBadge text="Zero-Knowledge" />
                </h4>
                <p className="text-[11px] text-[#55647C]">
                  {doctorName} only has access to the specific reports you select below during this active session.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs text-[#059669] bg-white px-3 py-1.5 rounded-xl border border-[#BDDDFA]">
                {selectedIds.size} of {records.length} Shared
              </span>
            </div>
          </div>

          {/* 250 MB Storage Capacity Indicator */}
          {storage && (
            <PatientStorageIndicator storage={storage} compact={true} />
          )}

          {/* Tab Selection */}
          <div className="flex border-b border-slate-200 gap-4 text-xs font-bold">
            <button
              onClick={() => setActiveTab('previous')}
              className={`pb-2.5 flex items-center gap-2 border-b-2 transition cursor-pointer ${
                activeTab === 'previous'
                  ? 'border-[#059669] text-[#059669]'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <FileCheck className="w-4 h-4" />
              <span>Previous Medical Records ({records.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('upload')}
              className={`pb-2.5 flex items-center gap-2 border-b-2 transition cursor-pointer ${
                activeTab === 'upload'
                  ? 'border-[#059669] text-[#059669]'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <PlusCircle className="w-4 h-4" />
              <span>Upload New Medical Report</span>
            </button>
          </div>

          {/* Notification status */}
          {statusMessage && (
            <div className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}>
              {statusMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-red-600" />}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {/* ─── TAB A: PREVIOUS MEDICAL RECORDS ─── */}
          {activeTab === 'previous' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-slate-500 font-medium">
                  Check the reports you authorize for this consultation:
                </span>
                {records.length > 0 && (
                  <button
                    onClick={handleSelectAll}
                    className="text-xs font-bold text-[#059669] hover:underline cursor-pointer"
                  >
                    {selectedIds.size === records.length ? "Deselect All" : "Select All"}
                  </button>
                )}
              </div>

              {loading ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  <RefreshCw className="w-6 h-6 animate-spin text-[#059669] mx-auto mb-2" />
                  Loading your encrypted records...
                </div>
              ) : records.length === 0 ? (
                <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-2xl space-y-3">
                  <FileText className="w-8 h-8 text-slate-400 mx-auto" />
                  <p className="text-xs font-bold text-slate-700">No medical records on file yet</p>
                  <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                    You can upload diagnostic reports (PDF, JPG, JPEG) to share them directly with your doctor.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    icon={Upload}
                    onClick={() => setActiveTab('upload')}
                  >
                    Upload Report Now
                  </Button>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
                  {records.map(rec => {
                    const isShared = selectedIds.has(rec.id);
                    const isPdf = (rec.file_name || '').toLowerCase().endsWith('.pdf') || (rec.mime_type || '').includes('pdf');
                    const isImg = (rec.file_name || '').toLowerCase().endsWith('.jpg') || (rec.file_name || '').toLowerCase().endsWith('.jpeg') || (rec.mime_type || '').includes('image');

                    return (
                      <div
                        key={rec.id}
                        className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                          isShared
                            ? 'bg-emerald-50/70 border-emerald-300 ring-1 ring-emerald-300/40'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isShared}
                            onChange={() => toggleSelectRecord(rec.id)}
                            className="w-4 h-4 rounded text-[#059669] focus:ring-[#059669] cursor-pointer"
                          />
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            isShared ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {isImg ? <ImageIcon className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h5 className="font-bold text-xs text-[#0F172A]">{rec.title || rec.file_name || `Record #${rec.id}`}</h5>
                              <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                                {rec.record_type || 'Report'}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                              <span>{rec.file_name || 'Document'}</span>
                              {rec.file_size ? <span>&bull; {Math.round(rec.file_size / 1024)} KB</span> : null}
                              <span>&bull; {rec.date || (rec.created_at ? new Date(rec.created_at).toLocaleDateString() : '')}</span>
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            icon={Eye}
                            onClick={() => setPreviewRecord(rec)}
                            className="text-xs py-1 px-2.5"
                          >
                            Preview
                          </Button>
                          <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                            isShared
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-500'
                          }`}>
                            {isShared ? 'Shared' : 'Not Shared'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ─── TAB B: UPLOAD NEW MEDICAL REPORT ─── */}
          {activeTab === 'upload' && (
            <form onSubmit={handleUploadReport} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#0F172A] mb-1">Document Category</label>
                  <select
                    value={uploadCategory}
                    onChange={e => setUploadCategory(e.target.value)}
                    className="w-full p-2.5 bg-[#E7F0FC] rounded-xl text-xs text-[#111827] outline-none"
                  >
                    <option value="Lab Report">Lab Report (Blood / Urine / Pathology)</option>
                    <option value="Radiology">Radiology Scan (X-Ray / MRI / Ultrasound)</option>
                    <option value="Cardiology">Cardiology Diagnostic (ECG / Echo)</option>
                    <option value="Vaccination">Vaccination / Immunization Record</option>
                    <option value="Clinical Note">Clinical Prescription / Discharge Note</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#0F172A] mb-1">Document Title</label>
                  <input
                    type="text"
                    value={uploadTitle}
                    onChange={e => setUploadTitle(e.target.value)}
                    placeholder="e.g. Chest X-Ray or Lipid Profile"
                    required
                    className="w-full p-2.5 bg-[#E7F0FC] rounded-xl text-xs text-[#111827] outline-none placeholder-[#64748B]"
                  />
                </div>
              </div>

              {/* File Picker with format & quota enforcement */}
              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                  Select File (PDF, JPG, JPEG only &bull; Max 250 MB)
                </label>
                <div className="border-2 border-dashed border-[#BDDDFA] bg-[#E7F0FC]/60 rounded-xl p-4 text-center hover:bg-white transition cursor-pointer relative">
                  <input
                    type="file"
                    accept=".pdf, .jpg, .jpeg, image/jpeg, application/pdf"
                    onChange={handleFileChange}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <div className="flex flex-col items-center justify-center gap-1.5 text-slate-600">
                    <Upload className="w-5 h-5 text-[#059669]" />
                    <span className="font-bold text-xs text-[#0F172A]">
                      {uploadFile ? `Attached: ${uploadFile.name} (${(uploadFile.size / 1024).toFixed(1)} KB)` : "Choose or drag PDF / JPG / JPEG file"}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Standard healthcare formats supported. Strict 250 MB quota enforced.
                    </span>
                  </div>
                </div>
              </div>

              {/* Clinical findings text */}
              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                  Clinical Findings &amp; Summary Notes (Optional)
                </label>
                <textarea
                  rows={3}
                  value={uploadFindings}
                  onChange={e => setUploadFindings(e.target.value)}
                  placeholder="Key diagnostic findings, measurements, or observations for the doctor..."
                  className="w-full p-2.5 bg-[#E7F0FC] rounded-xl text-xs text-[#111827] outline-none font-mono"
                />
              </div>

              {/* Auto-share toggle */}
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-700" />
                  <span className="text-xs font-semibold text-emerald-950">
                    Immediately share with {doctorName} for this consultation
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={autoShareNew}
                  onChange={e => setAutoShareNew(e.target.checked)}
                  className="w-4 h-4 rounded text-[#059669] focus:ring-[#059669] cursor-pointer"
                />
              </div>

              {uploadError && (
                <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{uploadError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveTab('previous')}
                >
                  Back to List
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  icon={Lock}
                  disabled={saving}
                  className="bg-[#059669] hover:bg-[#047857] text-white font-bold"
                >
                  {saving ? 'Encrypting & Saving...' : 'Save & Authorize Report'}
                </Button>
              </div>
            </form>
          )}

          {/* Modal Actions Footer */}
          {activeTab === 'previous' && (
            <div className="flex items-center justify-between pt-3 border-t border-slate-200">
              <span className="text-xs text-slate-500">
                <strong className="text-slate-800">{selectedIds.size}</strong> records will be accessible to doctor
              </span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  icon={Check}
                  disabled={saving}
                  onClick={handleSaveSelection}
                  className="bg-[#059669] hover:bg-[#047857] text-white font-bold"
                >
                  {saving ? 'Saving Permissions...' : 'Save & Share with Doctor'}
                </Button>
              </div>
            </div>
          )}

        </div>
      </Modal>

      {/* Embedded Document Preview Modal */}
      <DocumentViewerModal
        isOpen={!!previewRecord}
        onClose={() => setPreviewRecord(null)}
        record={previewRecord}
      />
    </>
  );
};

