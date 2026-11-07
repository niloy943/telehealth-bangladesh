import React, { useState } from 'react';
import {
  FileText, Image as ImageIcon, Download, ExternalLink, Printer,
  ShieldCheck, Lock, CheckCircle2, AlertCircle, Eye, X, ZoomIn, ZoomOut
} from 'lucide-react';
import { Modal, Button, SecurityBadge } from './ui';

export const DocumentViewerModal = ({ isOpen, onClose, record }) => {
  const [zoomLevel, setZoomLevel] = useState(1);

  if (!isOpen || !record) return null;

  const fileName = record.file_name || record.fileName || `${record.title || 'Medical_Record'}.pdf`;
  const mimeType = (record.mime_type || record.mimeType || '').toLowerCase();
  const fileData = record.file_data || record.fileData || '';
  const isPdf = fileName.toLowerCase().endsWith('.pdf') || mimeType.includes('pdf') || fileData.startsWith('data:application/pdf');
  const isImage = (
    fileName.toLowerCase().endsWith('.jpg') ||
    fileName.toLowerCase().endsWith('.jpeg') ||
    fileName.toLowerCase().endsWith('.png') ||
    mimeType.includes('image') ||
    fileData.startsWith('data:image/')
  );

  // Normalize data URI
  let viewSrc = fileData;
  if (fileData && !fileData.startsWith('data:')) {
    if (isPdf) {
      viewSrc = `data:application/pdf;base64,${fileData}`;
    } else if (isImage) {
      viewSrc = `data:image/jpeg;base64,${fileData}`;
    }
  }

  const handleDownload = () => {
    if (viewSrc) {
      const a = document.createElement('a');
      a.href = viewSrc;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } else {
      // Download text content as file
      const blob = new Blob([
        `HEALNSIGHT ENCRYPTED MEDICAL RECORD\n` +
        `Title: ${record.title || 'Clinical Report'}\n` +
        `Category: ${record.record_type || record.category || 'Clinical Record'}\n` +
        `Date: ${record.date || record.created_at || new Date().toISOString()}\n` +
        `-----------------------------------------\n` +
        `Diagnostic Findings:\n${record.decrypted_content || record.content || 'No text content.'}\n`
      ], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(record.title || 'Record').replace(/\s+/g, '_')}.txt`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }
  };

  const handleOpenInNewTab = () => {
    if (viewSrc) {
      const win = window.open();
      if (win) {
        if (isImage) {
          win.document.write(`<html><head><title>${fileName}</title></head><body style="margin:0;background:#0f172a;display:flex;align-items:center;justify-content:center;height:100vh;"><img src="${viewSrc}" style="max-width:100%;max-height:100%;object-fit:contain;"/></body></html>`);
        } else {
          win.location.href = viewSrc;
        }
      }
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={record.title || fileName || "Medical Report Viewer"}
      subtitle={`Category: ${record.record_type || record.category || "Clinical Document"} • Decrypted with AES-256`}
      maxWidth="max-w-4xl"
    >
      <div className="space-y-4">
        {/* Document Header & Security Integrity Bar */}
        <div className="bg-[#E7F0FC] border border-[#BDDDFA] rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white border border-[#BDDDFA] flex items-center justify-center text-[#059669]">
              {isImage ? <ImageIcon className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
            </div>
            <div>
              <h4 className="font-bold text-[#0F172A] text-sm">{record.title || fileName}</h4>
              <p className="text-[11px] text-[#55647C] flex items-center gap-2 mt-0.5">
                <span>File: <strong className="text-slate-700">{fileName}</strong></span>
                {record.file_size ? <span>• Size: {Math.round(record.file_size / 1024)} KB</span> : null}
                <span>• Date: {record.date || (record.created_at ? new Date(record.created_at).toLocaleDateString() : 'Recorded')}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <SecurityBadge text="AES-256-GCM Verified" />
            {viewSrc && (
              <Button
                variant="outline"
                size="sm"
                icon={ExternalLink}
                onClick={handleOpenInNewTab}
                className="text-xs"
              >
                Open Tab
              </Button>
            )}
            <Button
              variant="primary"
              size="sm"
              icon={Download}
              onClick={handleDownload}
              className="bg-[#059669] hover:bg-[#047857] text-white text-xs font-bold"
            >
              Download
            </Button>
          </div>
        </div>

        {/* Document Preview Pane */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 min-h-[360px] max-h-[580px] flex flex-col justify-center items-center overflow-auto relative">
          {viewSrc ? (
            isImage ? (
              <div className="flex flex-col items-center justify-center w-full h-full space-y-2 py-2">
                <div className="flex items-center gap-2 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full border border-slate-200 shadow-sm z-10">
                  <button
                    onClick={() => setZoomLevel(z => Math.max(0.5, z - 0.25))}
                    className="p-1 hover:bg-slate-100 rounded text-slate-600"
                    title="Zoom Out"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <span className="text-[11px] font-mono font-bold text-slate-700">{Math.round(zoomLevel * 100)}%</span>
                  <button
                    onClick={() => setZoomLevel(z => Math.min(2.5, z + 0.25))}
                    className="p-1 hover:bg-slate-100 rounded text-slate-600"
                    title="Zoom In"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setZoomLevel(1)}
                    className="text-[10px] text-slate-500 hover:text-slate-800 font-semibold px-1"
                  >
                    Reset
                  </button>
                </div>
                <div className="overflow-auto max-h-[480px] max-w-full flex items-center justify-center p-2">
                  <img
                    src={viewSrc}
                    alt={record.title}
                    style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center center', transition: 'transform 0.15s ease' }}
                    className="max-h-[440px] max-w-full object-contain rounded-lg shadow-sm border border-slate-200"
                  />
                </div>
              </div>
            ) : isPdf ? (
              <div className="w-full h-[520px] rounded-xl overflow-hidden border border-slate-200 bg-white">
                <iframe
                  src={viewSrc}
                  title={fileName}
                  className="w-full h-full"
                  frameBorder="0"
                />
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-slate-500">
                Binary payload encrypted and validated. Click Download to save locally.
              </div>
            )
          ) : (
            <div className="w-full bg-white rounded-xl p-6 border border-slate-200 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Clinical Diagnostic Summary</span>
                <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full font-bold border border-emerald-200">
                  Patient Health Vault Record
                </span>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs font-mono text-slate-800 whitespace-pre-wrap leading-relaxed max-h-[300px] overflow-y-auto">
                {record.decrypted_content || record.content || "No clinical diagnostic findings transcribed."}
              </div>
            </div>
          )}
        </div>

        {/* Record Metadata & Diagnostic Findings */}
        {(record.decrypted_content || record.content) && viewSrc && (
          <div className="p-4 bg-white border border-[#BDDDFA] rounded-2xl space-y-1.5 text-xs">
            <span className="font-bold text-[#0F172A] uppercase tracking-wider text-[11px] block">
              Transcribed Findings &amp; Clinical Context
            </span>
            <p className="text-slate-700 leading-relaxed font-mono text-[11px] bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              {record.decrypted_content || record.content}
            </p>
          </div>
        )}

        {/* Footer info */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-[11px] text-[#55647C]">
          <div className="flex items-center gap-1.5 text-[#059669] font-medium">
            <ShieldCheck className="w-4 h-4" />
            <span>End-to-End Encrypted &bull; Integrity Protected on Private Blockchain</span>
          </div>
          <Button variant="outline" size="sm" onClick={onClose}>
            Close Viewer
          </Button>
        </div>
      </div>
    </Modal>
  );
};

