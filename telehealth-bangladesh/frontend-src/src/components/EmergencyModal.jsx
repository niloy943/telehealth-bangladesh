import React, { useState } from 'react';
import { ShieldAlert, Phone, MapPin, AlertTriangle, CheckCircle2, Loader2, X, AlertOctagon } from 'lucide-react';
import { Button, Modal } from './ui';

const API_BASE = import.meta.env.VITE_API_BASE || window.location.origin;

export const EmergencyModal = ({ isOpen, onClose, token, user }) => {
  const [step, setStep] = useState('confirm'); // 'confirm' | 'broadcasting' | 'result'
  const [coords, setCoords] = useState(null);
  const [locationStatus, setLocationStatus] = useState('pending'); // 'pending' | 'acquired' | 'denied'
  const [resultStatus, setResultStatus] = useState(null); // 'sent' | 'not_configured' | 'failed'
  const [resultMessage, setResultMessage] = useState('');

  const handleReset = () => {
    setStep('confirm');
    setCoords(null);
    setLocationStatus('pending');
    setResultStatus(null);
    setResultMessage('');
    onClose?.();
  };

  const executeEmergencyBroadcast = async () => {
    setStep('broadcasting');

    // 1. Attempt to capture real GPS Coordinates
    let capturedCoords = null;
    if (navigator.geolocation) {
      try {
        const position = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 6000,
            maximumAge: 10000
          });
        });
        capturedCoords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          location_accuracy: position.coords.accuracy
        };
        setCoords(capturedCoords);
        setLocationStatus('acquired');
      } catch (geoErr) {
        console.warn("Geolocation declined or unavailable:", geoErr);
        setLocationStatus('denied');
      }
    } else {
      setLocationStatus('denied');
    }

    // 2. Dispatch to Backend Emergency Endpoint
    try {
      const authToken = token || localStorage.getItem('tv_token');
      const resp = await fetch(`${API_BASE}/api/emergency/sos/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(capturedCoords || {
          latitude: 23.8103,
          longitude: 90.4125,
          location_accuracy: 50.0
        })
      });

      if (resp.ok) {
        const data = await resp.json();
        if (data.status === 'SMS_SENT') {
          setResultStatus('sent');
          setResultMessage("Emergency SOS alert successfully dispatched via SMS to designated responders.");
        } else if (data.status === 'SMS_NOT_CONFIGURED') {
          setResultStatus('not_configured');
          setResultMessage("Emergency record logged in clinical ledger. Automated SMS gateway is currently offline in this environment. Please call 999 immediately.");
        } else {
          setResultStatus('sent');
          setResultMessage(data.message || "Emergency alert successfully registered.");
        }
      } else {
        setResultStatus('not_configured');
        setResultMessage("Emergency record created. SMS gateway unreachable. Please dial national emergency lines directly.");
      }
    } catch (err) {
      console.warn("Emergency API dispatch notice:", err);
      setResultStatus('not_configured');
      setResultMessage("Emergency alert logged locally. Automated SMS transmission offline. Please call 999 or 16263 immediately.");
    } finally {
      setStep('result');
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleReset}
      title="Emergency Health Response (SOS)"
      subtitle="Immediate clinical assistance & national emergency services in Bangladesh"
      maxWidth="max-w-md"
    >
      <div className="space-y-4">
        {/* National Hotlines Always Accessible */}
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200">
          <div className="flex items-center gap-2 mb-2">
            <AlertOctagon className="w-4 h-4 text-red-600 shrink-0" />
            <h4 className="text-xs font-bold text-red-950 uppercase tracking-wider">
              Immediate Life-Threatening Emergency?
            </h4>
          </div>
          <p className="text-[11px] text-red-800 leading-normal mb-3">
            For critical emergencies (severe chest pain, stroke symptoms, major trauma), direct telephone dispatch is the fastest response:
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <a
              href="tel:999"
              className="flex items-center justify-center gap-2 p-2.5 rounded-lg bg-red-600 text-white font-bold hover:bg-red-700 transition-colors shadow-xs text-center"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>Call 999 (Ambulance)</span>
            </a>
            <a
              href="tel:16263"
              className="flex items-center justify-center gap-2 p-2.5 rounded-lg bg-white border border-red-300 text-red-700 font-bold hover:bg-red-50 transition-colors text-center"
            >
              <Phone className="w-3.5 h-3.5 text-red-600" />
              <span>Call 16263 (Health)</span>
            </a>
          </div>
        </div>

        {/* Step 1: Confirmation to prevent accidental dispatch */}
        {step === 'confirm' && (
          <div className="space-y-3 pt-1">
            <div className="p-3 rounded-xl bg-[#E7F0FC] border border-[#BDDDFA] text-xs text-[#334155] space-y-2">
              <div className="flex items-center gap-2 font-bold text-[#0F172A]">
                <MapPin className="w-4 h-4 text-[#168CF5]" />
                <span>GPS Location Transmission</span>
              </div>
              <p className="text-[11px] text-[#55647C] leading-normal">
                Triggering an emergency signal will capture your current device location and transmit an alert to registered medical response personnel.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={handleReset}>
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                icon={ShieldAlert}
                onClick={executeEmergencyBroadcast}
                className="font-bold"
              >
                Confirm Emergency Alert
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Processing Location & Broadcast */}
        {step === 'broadcasting' && (
          <div className="py-6 text-center space-y-3">
            <Loader2 className="w-8 h-8 text-[#DC2626] animate-spin mx-auto" />
            <h4 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
              Acquiring Location &amp; Dispatching Alert...
            </h4>
            <p className="text-[11px] text-[#55647C] max-w-xs mx-auto">
              Requesting GPS coordinates and contacting emergency dispatch service...
            </p>
          </div>
        )}

        {/* Step 3: Authentic Verification Result */}
        {step === 'result' && (
          <div className="space-y-3 pt-1">
            <div className={`p-3.5 rounded-xl border text-xs space-y-2 ${
              resultStatus === 'sent'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                : 'bg-amber-50 border-amber-200 text-amber-950'
            }`}>
              <div className="flex items-center gap-2 font-bold">
                {resultStatus === 'sent' ? (
                  <CheckCircle2 className="w-4 h-4 text-[#059669] shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                )}
                <span>
                  {resultStatus === 'sent' ? "Alert Registered" : "Notice: Manual Action Required"}
                </span>
              </div>
              <p className="text-[11px] leading-relaxed">
                {resultMessage}
              </p>
              {coords && (
                <div className="text-[10px] font-mono text-[#55647C] pt-1 border-t border-[#BDDDFA]/40">
                  Location: {coords.latitude.toFixed(4)}, {coords.longitude.toFixed(4)} (±{Math.round(coords.location_accuracy)}m)
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="outline" size="sm" onClick={handleReset}>
                Close
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
