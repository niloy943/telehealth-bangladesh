import React, { useState, useEffect, useRef } from 'react';
import { Search, Compass, Shield, Eye, Settings, Keyboard, Activity, RefreshCw } from 'lucide-react';
import { useLanguage } from './LanguageContext';

export const CommandPalette = ({ isOpen, onClose, user, onAction, activeTab, toggleLanguage }) => {
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const overlayRef = useRef(null);
  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) onClose();
  };

  const getCommands = () => {
    const common = [
      { id: 'toggle-lang', title: 'Switch Language (EN / বাংলা)', icon: <Compass className="w-4 h-4 text-[#059669]" />, category: 'Settings', action: () => { toggleLanguage(); onClose(); } },
      { id: 'go-profile-personal', title: 'Navigate: Account Details & Demographics', icon: <Compass className="w-4 h-4 text-[#168CF5]" />, category: 'Profile', action: () => { onAction('profile_personal'); onClose(); } },
      { id: 'go-profile-security', title: 'Navigate: Security Center & 2FA', icon: <Shield className="w-4 h-4 text-[#059669]" />, category: 'Profile', action: () => { onAction('profile_security'); onClose(); } },
      { id: 'go-profile-kyc', title: 'Navigate: KYC Verification Files', icon: <Compass className="w-4 h-4 text-[#168CF5]" />, category: 'Profile', action: () => { onAction('profile_kyc'); onClose(); } },
      { id: 'go-profile-activity', title: 'Navigate: Activity & Access Logs', icon: <Compass className="w-4 h-4 text-[#55647C]" />, category: 'Profile', action: () => { onAction('profile_activity'); onClose(); } },
      { id: 'go-profile-privacy', title: 'Navigate: Privacy & Policy Settings', icon: <Shield className="w-4 h-4 text-[#059669]" />, category: 'Profile', action: () => { onAction('profile_privacy'); onClose(); } },
      { id: 'logout', title: 'Security: Terminate Session (Sign Out)', icon: <Shield className="w-4 h-4 text-[#DC2626]" />, category: 'Security', action: () => { onAction('logout'); onClose(); } }
    ];

    if (user?.role === 'patient') {
      return [
        { id: 'go-dash', title: 'Navigate: Citizen Health Dashboard', icon: <Compass className="w-4 h-4 text-[#059669]" />, category: 'Navigation', action: () => { onAction('dashboard'); onClose(); } },
        { id: 'go-book', title: 'Action: Book Specialist Consultation', icon: <Activity className="w-4 h-4 text-[#168CF5]" />, category: 'Consultation', action: () => { onAction('booking'); onClose(); } },
        { id: 'go-records', title: 'Navigate: Encrypted Medical Records', icon: <Eye className="w-4 h-4 text-[#059669]" />, category: 'Clinical Workspace', action: () => { onAction('records'); onClose(); } },
        { id: 'go-prescriptions', title: 'Navigate: Digital Prescriptions & Rx', icon: <Compass className="w-4 h-4 text-[#059669]" />, category: 'Clinical Workspace', action: () => { onAction('prescriptions'); onClose(); } },
        { id: 'go-consent', title: 'Navigate: Privacy & Consent Manager', icon: <Shield className="w-4 h-4 text-[#168CF5]" />, category: 'Security', action: () => { onAction('consent'); onClose(); } },
        { id: 'go-pharmacy', title: 'Navigate: Pharmacy Store & Orders', icon: <Compass className="w-4 h-4 text-amber-600" />, category: 'Pharmacy', action: () => { onAction('pharmacy'); onClose(); } },
        { id: 'go-payments', title: 'Navigate: Billing & Payment Receipts', icon: <Compass className="w-4 h-4 text-[#168CF5]" />, category: 'Billing', action: () => { onAction('payments'); onClose(); } },
        { id: 'go-ai', title: 'Action: Open AI Health Assistant', icon: <Compass className="w-4 h-4 text-[#168CF5]" />, category: 'AI Tools', action: () => { onAction('ai'); onClose(); } },
        { id: 'trigger-sos', title: 'Broadcast SOS Emergency Signal', icon: <Shield className="w-4 h-4 text-[#DC2626]" />, category: 'Emergency', action: () => { onAction('sos'); onClose(); } },
        ...common
      ];
    }

    if (user?.role === 'doctor') {
      return [
        { id: 'go-dash', title: 'Navigate: Clinical Workspace & Queue', icon: <Compass className="w-4 h-4 text-[#059669]" />, category: 'Navigation', action: () => { onAction('dashboard'); onClose(); } },
        { id: 'go-schedule', title: 'Navigate: Consultation Fee & Weekly Schedule', icon: <Compass className="w-4 h-4 text-[#059669]" />, category: 'Navigation', action: () => { onAction('schedule'); onClose(); } },
        { id: 'toggle-status', title: 'Action: Toggle Online Availability', icon: <Activity className="w-4 h-4 text-[#059669]" />, category: 'Availability', action: () => { onAction('toggle-availability'); onClose(); } },
        { id: 'rekey-node', title: 'Action: Rotate Cryptographic Session Keys', icon: <RefreshCw className="w-4 h-4 text-[#168CF5]" />, category: 'Security', action: () => { onAction('rekey'); onClose(); } },
        ...common
      ];
    }

    if (user?.role === 'admin') {
      return [
        { id: 'go-audit', title: 'Navigate: Security Audit Ledger', icon: <Eye className="w-4 h-4 text-[#DC2626]" />, category: 'Admin Center', action: () => { onAction('audit'); onClose(); } },
        { id: 'go-kyc', title: 'Navigate: Doctor Registry & KYC Verifications', icon: <Shield className="w-4 h-4 text-[#059669]" />, category: 'Admin Center', action: () => { onAction('kyc'); onClose(); } },
        { id: 'go-staff', title: 'Navigate: Admin & Staff Authority Directory', icon: <Shield className="w-4 h-4 text-[#168CF5]" />, category: 'Admin Center', action: () => { onAction('staff'); onClose(); } },
        { id: 'go-pharmacy', title: 'Navigate: Medicine Order Dispatch', icon: <Compass className="w-4 h-4 text-[#168CF5]" />, category: 'Admin Center', action: () => { onAction('pharmacy'); onClose(); } },
        ...common
      ];
    }

    return common;
  };

  const commands = getCommands();

  const filtered = commands.filter(cmd =>
    cmd.title.toLowerCase().includes(query.toLowerCase()) ||
    cmd.category.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % filtered.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filtered.length) % filtered.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered[selectedIndex]) {
          filtered[selectedIndex].action();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, filtered, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 bg-[#0F172A]/70 z-[9990] flex justify-center pt-24 px-4 overflow-y-auto"
    >
      <div className="w-full max-w-xl bg-white border border-[#BDDDFA] rounded-2xl shadow-2xl overflow-hidden h-fit flex flex-col">
        {/* Search Input Area */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[#BDDDFA]/60 bg-[#F4F6F9]">
          <Search className="w-5 h-5 text-[#94A3B8] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command or search options..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            className="flex-grow bg-transparent text-xs sm:text-sm text-[#0F172A] outline-none border-none placeholder-[#4B5563]"
          />
          <div className="flex items-center gap-1 bg-white border border-[#BDDDFA] rounded-md px-2 py-0.5 text-[10px] text-[#55647C] font-bold font-mono">
            <Keyboard className="w-3.5 h-3.5" />
            <span>ESC</span>
          </div>
        </div>

        {/* Commands List */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-1 bg-white">
          {filtered.length === 0 ? (
            <div className="text-center py-8 text-[#94A3B8] text-xs">
              No commands found matching "{query}"
            </div>
          ) : (
            filtered.map((cmd, index) => (
              <button
                key={cmd.id}
                onClick={cmd.action}
                onMouseEnter={() => setSelectedIndex(index)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-[10px] text-left cursor-pointer ${
                  selectedIndex === index ? 'bg-[#E7F0FC] text-[#0F172A]' : 'bg-transparent text-[#334155] hover:bg-[#F4F6F9]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-1.5 rounded-[8px] border ${selectedIndex === index ? 'bg-white border-[#BDDDFA]' : 'bg-[#F4F6F9] border-transparent'}`}>
                    {cmd.icon}
                  </div>
                  <div>
                    <span className="text-xs font-bold block text-[#0F172A]">{cmd.title}</span>
                    <span className="text-[10px] text-[#94A3B8] font-bold uppercase tracking-wider">{cmd.category}</span>
                  </div>
                </div>

                {selectedIndex === index && (
                  <span className="text-[10px] text-[#55647C] font-bold bg-white px-2 py-1 rounded-md border border-[#BDDDFA] font-mono">
                    ↵ ENTER
                  </span>
                )}
              </button>
            ))
          )}
        </div>

        {/* Bottom Keyboard Hint Bar */}
        <div className="bg-[#F4F6F9] border-t border-[#BDDDFA]/60 px-4 py-2.5 flex items-center justify-between text-[10px] text-[#55647C]">
          <span className="font-bold uppercase tracking-wider text-[#94A3B8]">HealNSight Command Center</span>
          <div className="flex gap-3">
            <span className="flex items-center gap-1 font-mono font-semibold">
              <span>↑↓</span> Navigate
            </span>
            <span className="flex items-center gap-1 font-mono font-semibold">
              <span>↵</span> Select
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
