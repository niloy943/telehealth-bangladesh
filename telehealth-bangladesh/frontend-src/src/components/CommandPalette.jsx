import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Compass, Shield, Eye, Settings, Keyboard, Activity, RefreshCw } from 'lucide-react';
import { useLanguage } from './LanguageContext';

export const CommandPalette = ({ isOpen, onClose, user, onAction, activeTab, toggleTheme, toggleLanguage }) => {
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Handle outside click
  const overlayRef = useRef(null);
  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) onClose();
  };

  // Define commands list dynamically based on role
  const getCommands = () => {
    const common = [
      { id: 'toggle-theme', title: 'Toggle Light/Dark Theme', icon: <Settings className="w-4 h-4 text-amber-500" />, category: 'Settings', action: () => { toggleTheme(); onClose(); } },
      { id: 'toggle-lang', title: 'Switch Language (EN / বাংলা)', icon: <Compass className="w-4 h-4 text-medical-teal" />, category: 'Settings', action: () => { toggleLanguage(); onClose(); } },
      { id: 'go-profile', title: 'Navigate: View Profile Manager', icon: <Compass className="w-4 h-4 text-medical-indigo" />, category: 'Navigation', action: () => { onAction('profile'); onClose(); } },
      { id: 'logout', title: 'Security: Terminate Session (Log Out)', icon: <Shield className="w-4 h-4 text-medical-rose" />, category: 'Security', action: () => { onAction('logout'); onClose(); } }
    ];

    if (user?.role === 'patient') {
      return [
        { id: 'go-dash', title: 'Navigate: Citizen Health Dashboard', icon: <Compass className="w-4 h-4 text-medical-indigo" />, category: 'Navigation', action: () => { onAction('dashboard'); onClose(); } },
        { id: 'go-book', title: 'Action: Book Specialist Consultation', icon: <Activity className="w-4 h-4 text-blue-400" />, category: 'Consultation', action: () => { onAction('booking'); onClose(); } },
        { id: 'go-records', title: 'Navigate: Encrypted Medical Records', icon: <Eye className="w-4 h-4 text-medical-teal" />, category: 'Clinical Workspace', action: () => { onAction('records'); onClose(); } },
        { id: 'go-consent', title: 'Navigate: Delegated Consent Manager', icon: <Shield className="w-4 h-4 text-medical-indigo" />, category: 'Security', action: () => { onAction('consent'); onClose(); } },
        { id: 'go-pharmacy', title: 'Navigate: Medicine Dispatch & Order Logs', icon: <Compass className="w-4 h-4 text-amber-500" />, category: 'Pharmacy', action: () => { onAction('pharmacy'); onClose(); } },
        { id: 'go-ai', title: 'Action: Trigger AI Diagnostic Agent', icon: <Compass className="w-4 h-4 text-medical-teal" />, category: 'AI Tools', action: () => { onAction('ai'); onClose(); } },
        { id: 'trigger-sos', title: 'CRITICAL: Broadcast SOS Emergency Signal', icon: <Shield className="w-4 h-4 text-medical-rose animate-pulse" />, category: 'Emergency', action: () => { onAction('sos'); onClose(); } },
        ...common
      ];
    }

    if (user?.role === 'doctor') {
      return [
        { id: 'go-dash', title: 'Navigate: Physician Home Queue', icon: <Compass className="w-4 h-4 text-medical-teal" />, category: 'Navigation', action: () => { onAction('dashboard'); onClose(); } },
        { id: 'toggle-status', title: 'Action: Toggle Online Availability', icon: <Activity className="w-4 h-4 text-medical-emerald" />, category: 'Availability', action: () => { onAction('toggle-availability'); onClose(); } },
        { id: 'rekey-node', title: 'Action: Regenerate E2E Cryptography Keys', icon: <RefreshCw className="w-4 h-4 text-medical-indigo" />, category: 'Security', action: () => { onAction('rekey'); onClose(); } },
        ...common
      ];
    }

    if (user?.role === 'admin') {
      return [
        { id: 'go-audit', title: 'Navigate: Security Audit Logs Console', icon: <Eye className="w-4 h-4 text-medical-rose" />, category: 'Admin Center', action: () => { onAction('audit'); onClose(); } },
        { id: 'go-kyc', title: 'Navigate: KYC Doctor Verifications Center', icon: <Shield className="w-4 h-4 text-medical-teal" />, category: 'Admin Center', action: () => { onAction('kyc'); onClose(); } },
        { id: 'go-pharmacy', title: 'Navigate: Courier Dispatch Shipping Deck', icon: <Compass className="w-4 h-4 text-medical-indigo" />, category: 'Admin Center', action: () => { onAction('pharmacy'); onClose(); } },
        ...common
      ];
    }

    return common;
  };

  const commands = getCommands();

  // Filter commands by query
  const filtered = commands.filter(cmd =>
    cmd.title.toLowerCase().includes(query.toLowerCase()) ||
    cmd.category.toLowerCase().includes(query.toLowerCase())
  );

  // Key navigation in menu
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

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          ref={overlayRef}
          onClick={handleOverlayClick}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9990] flex justify-center pt-24 px-4 overflow-y-auto"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="w-full max-w-xl bg-medical-cardBg border border-medical-borderBg rounded-2xl shadow-2xl overflow-hidden h-fit glass-panel flex flex-col"
          >
            {/* Search Input Area */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-medical-borderBg">
              <Search className="w-5 h-5 text-medical-textMuted shrink-0" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Type a command or search options..."
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedIndex(0);
                }}
                className="flex-grow bg-transparent text-sm text-white outline-none border-none placeholder-slate-500"
              />
              <div className="flex items-center gap-1 bg-medical-darkBg border border-medical-borderBg rounded-lg px-2 py-0.5 text-[10px] text-medical-textMuted font-bold font-mono">
                <Keyboard className="w-3.5 h-3.5" />
                <span>ESC</span>
              </div>
            </div>

            {/* Commands List */}
            <div className="max-h-80 overflow-y-auto p-2 space-y-1.5">
              {filtered.length === 0 ? (
                <div className="text-center py-8 text-medical-textMuted text-xs">
                  No commands found matching "{query}"
                </div>
              ) : (
                filtered.map((cmd, index) => (
                  <button
                    key={cmd.id}
                    onClick={cmd.action}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all text-left ${selectedIndex === index ? 'bg-medical-indigo/10 border border-medical-indigo/20 text-white' : 'bg-transparent border border-transparent text-medical-textBody'}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-1.5 rounded-lg ${selectedIndex === index ? 'bg-medical-indigo/20 text-white' : 'bg-medical-darkBg/60 text-medical-textMuted'}`}>
                        {cmd.icon}
                      </div>
                      <div>
                        <span className="text-xs font-bold block">{cmd.title}</span>
                        <span className="text-[9px] text-medical-textMuted font-semibold uppercase tracking-wider">{cmd.category}</span>
                      </div>
                    </div>

                    {selectedIndex === index && (
                      <span className="text-[10px] text-medical-textMuted font-bold bg-medical-darkBg px-2 py-1 rounded-md border border-medical-borderBg font-mono">
                        &crarr; ENTER
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>

            {/* Bottom Keyboard Hint Bar */}
            <div className="bg-medical-darkBg/60 border-t border-medical-borderBg px-4 py-2 flex items-center justify-between text-[10px] text-medical-textMuted">
              <span className="font-semibold uppercase tracking-wider">HealNsightAI Assistant Command Center</span>
              <div className="flex gap-3">
                <span className="flex items-center gap-1 font-mono">
                  <span>&uarr;&darr;</span> Navigate
                </span>
                <span className="flex items-center gap-1 font-mono">
                  <span>&crarr;</span> Select
                </span>
              </div>
            </div>

          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
