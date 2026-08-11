import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Bot, AlertTriangle, Send, PhoneCall, X, FileText, CheckCircle2 } from 'lucide-react';
import { useLanguage } from './LanguageContext';
import { useNotifications } from './NotificationCenter';

export const SupportWidget = ({ user }) => {
  const { t } = useLanguage();
  const { triggerNotification } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('ai'); // 'ai', 'tickets', 'hotlines'
  
  // AI assistant chat state
  const [messages, setMessages] = useState([
    { id: 1, sender: 'ai', text: "Hello! I am your AI Health Assistant. Ask me about symptoms, general checkup metrics, or medical queries." }
  ]);
  const [inputValue, setInputValue] = useState('');
  
  // Support Ticket Form State
  const [ticketForm, setTicketForm] = useState({ subject: '', details: '' });
  const [ticketSuccess, setTicketSuccess] = useState(false);

  const handleSend = (e) => {
    e.preventDefault();
    const query = inputValue.trim();
    if (!query) return;

    const userMsg = { id: Date.now(), sender: 'user', text: query };
    setMessages(prev => [...prev, userMsg]);
    setInputValue('');

    // AI diagnostic response simulation
    setTimeout(() => {
      let response = "I understand you are experiencing symptoms. To stay safe, I recommend checking with our certified physicians. Could you search for a specialist under 'Schedule Doctor'?";
      const lowercaseQuery = query.toLowerCase();

      if (lowercaseQuery.includes("fever") || lowercaseQuery.includes("temperature")) {
        response = "High temperature or fever detected. Tips: Stay hydrated, rest, and keep a cool damp cloth on your forehead. If it exceeds 102°F, consult a general practice doctor. I recommend Booking Dr. Sarah Jenkins (Cardiology/General checkup).";
      } else if (lowercaseQuery.includes("chest pain") || lowercaseQuery.includes("heart")) {
        response = "WARNING: Chest pain can be an indicator of cardiovascular distress. If severe, press the SOS Emergency button immediately. Otherwise, please schedule a priority E2EE consultation with Cardiologist Dr. Sarah Jenkins.";
      } else if (lowercaseQuery.includes("child") || lowercaseQuery.includes("baby") || lowercaseQuery.includes("cough")) {
        response = "Pediatric cough or fever observed. Keep warm, avoid cold drinks, and check child vitals. Schedule a review with our Pediatricians.";
      }

      setMessages(prev => [...prev, { id: Date.now() + 1, sender: 'ai', text: response }]);
    }, 700);
  };

  const handleTicketSubmit = (e) => {
    e.preventDefault();
    if (!ticketForm.subject || !ticketForm.details) return;

    // Simulate sending ticket
    setTicketSuccess(true);
    triggerNotification("Support Ticket Created", `Subject: ${ticketForm.subject} has been filed.`, "system");
    setTimeout(() => {
      setTicketSuccess(false);
      setTicketForm({ subject: '', details: '' });
    }, 3000);
  };

  return (
    <div className="fixed bottom-6 right-6 z-[9985] flex flex-col items-end">
      
      {/* Expanded Support Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 50 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="w-80 h-[420px] bg-medical-cardBg border border-medical-borderBg rounded-2xl shadow-2xl glass-panel mb-4 overflow-hidden flex flex-col"
          >
            {/* Header toolbar */}
            <div className="px-4 py-3.5 border-b border-medical-borderBg flex justify-between items-center bg-slate-950/20">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-medical-teal" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">Help Desk &amp; AI Center</span>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="text-slate-500 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tab switch buttons */}
            <div className="flex border-b border-medical-borderBg/50 text-[10px] font-bold uppercase tracking-wider bg-slate-950/30">
              <button 
                onClick={() => setActiveTab('ai')}
                className={`flex-1 py-2 text-center transition-colors border-b-2 ${activeTab === 'ai' ? 'border-medical-teal text-medical-teal bg-medical-teal/5' : 'border-transparent text-slate-400 hover:text-white'}`}
              >
                AI Diagnostics
              </button>
              <button 
                onClick={() => setActiveTab('tickets')}
                className={`flex-1 py-2 text-center transition-colors border-b-2 ${activeTab === 'tickets' ? 'border-medical-teal text-medical-teal bg-medical-teal/5' : 'border-transparent text-slate-400 hover:text-white'}`}
              >
                File Ticket
              </button>
              <button 
                onClick={() => setActiveTab('hotlines')}
                className={`flex-1 py-2 text-center transition-colors border-b-2 ${activeTab === 'hotlines' ? 'border-medical-teal text-medical-teal bg-medical-teal/5' : 'border-transparent text-slate-400 hover:text-white'}`}
              >
                Hotlines
              </button>
            </div>

            {/* View content panel */}
            <div className="flex-grow overflow-y-auto p-4 flex flex-col justify-between">
              
              {/* TAB 1: AI DIAGNOSTICS ASSISTANT */}
              {activeTab === 'ai' && (
                <div className="flex-grow flex flex-col justify-between h-full">
                  <div className="flex-grow overflow-y-auto pr-1 space-y-2.5 max-h-[240px] flex flex-col">
                    {messages.map(msg => (
                      <div 
                        key={msg.id}
                        className={`p-2.5 rounded-xl text-[11px] max-w-[80%] leading-relaxed ${msg.sender === 'ai' ? 'bg-slate-900 border border-white/5 self-start text-slate-300' : 'bg-medical-teal/10 border border-medical-teal/20 text-medical-teal self-end'}`}
                      >
                        {msg.text}
                      </div>
                    ))}
                  </div>

                  <form onSubmit={handleSend} className="flex gap-2 border-t border-medical-borderBg/50 pt-3 mt-3">
                    <input 
                      type="text" 
                      placeholder="Ask AI about symptoms..." 
                      value={inputValue}
                      onChange={e => setInputValue(e.target.value)}
                      className="flex-grow bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-[11px] outline-none text-white focus:border-medical-teal"
                    />
                    <button type="submit" className="bg-medical-teal text-medical-darkBg p-2 rounded-xl hover:bg-medical-teal/90 transition-colors shrink-0">
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </form>
                </div>
              )}

              {/* TAB 2: SUPPORT TICKET */}
              {activeTab === 'tickets' && (
                <div className="flex-grow flex flex-col justify-between h-full">
                  {ticketSuccess ? (
                    <div className="my-auto text-center space-y-3 animate-fade">
                      <CheckCircle2 className="w-10 h-10 text-medical-emerald mx-auto" />
                      <h4 className="text-xs font-bold text-white">Ticket Submitted Successfully</h4>
                      <p className="text-[10px] text-slate-400">Our administrators will review and respond to your query shortly.</p>
                    </div>
                  ) : (
                    <form onSubmit={handleTicketSubmit} className="space-y-3">
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-400 mb-1">Subject</label>
                        <input 
                          required
                          type="text" 
                          placeholder="What do you need help with?" 
                          value={ticketForm.subject}
                          onChange={e => setTicketForm({ ...ticketForm, subject: e.target.value })}
                          className="w-full bg-slate-900 border border-white/10 rounded-xl p-2.5 text-[11px] outline-none text-white focus:border-medical-teal"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-400 mb-1">Detailed Inquiry</label>
                        <textarea 
                          required
                          rows="4" 
                          placeholder="Describe your issue or feedback in detail..." 
                          value={ticketForm.details}
                          onChange={e => setTicketForm({ ...ticketForm, details: e.target.value })}
                          className="w-full bg-slate-900 border border-white/10 rounded-xl p-2.5 text-[11px] outline-none text-white focus:border-medical-teal"
                        />
                      </div>
                      <button type="submit" className="w-full bg-gradient-to-r from-medical-teal to-medical-indigo text-medical-darkBg font-extrabold py-2 rounded-xl text-xs hover:scale-[1.01] active:scale-[0.99] transition-transform shadow">
                        Submit Ticket
                      </button>
                    </form>
                  )}
                </div>
              )}

              {/* TAB 3: BANGLADESH HEALTH HOTLINES */}
              {activeTab === 'hotlines' && (
                <div className="flex-grow space-y-3.5 animate-fade overflow-y-auto max-h-[280px] pr-1">
                  <p className="text-[10px] text-slate-400 leading-normal">
                    Quick-dial national telemedicine and citizen support assistance hotlines directly inside Bangladesh.
                  </p>
                  
                  <div className="space-y-2.5">
                    <div className="bg-slate-900/60 border border-white/5 p-3 rounded-xl flex items-center justify-between">
                      <div>
                        <h4 className="text-[11px] font-bold text-white">999 National Emergency</h4>
                        <p className="text-[9px] text-slate-500">Ambulance, Police &amp; Fire Services</p>
                      </div>
                      <a href="tel:999" className="bg-medical-rose/10 hover:bg-medical-rose hover:text-white p-2 rounded-lg text-medical-rose transition-all">
                        <PhoneCall className="w-3.5 h-3.5" />
                      </a>
                    </div>

                    <div className="bg-slate-900/60 border border-white/5 p-3 rounded-xl flex items-center justify-between">
                      <div>
                        <h4 className="text-[11px] font-bold text-white">16263 Health Helpline</h4>
                        <p className="text-[9px] text-slate-500">Govt. Telehealth services (24/7)</p>
                      </div>
                      <a href="tel:16263" className="bg-medical-teal/10 hover:bg-medical-teal hover:text-medical-darkBg p-2 rounded-lg text-medical-teal transition-all">
                        <PhoneCall className="w-3.5 h-3.5" />
                      </a>
                    </div>

                    <div className="bg-slate-900/60 border border-white/5 p-3 rounded-xl flex items-center justify-between">
                      <div>
                        <h4 className="text-[11px] font-bold text-white">333 Citizens Service</h4>
                        <p className="text-[9px] text-slate-500">Government information &amp; social aid</p>
                      </div>
                      <a href="tel:333" className="bg-medical-indigo/10 hover:bg-medical-indigo hover:text-white p-2 rounded-lg text-medical-indigo transition-all">
                        <PhoneCall className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Action Button */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="bg-gradient-to-r from-medical-teal to-medical-indigo text-medical-darkBg p-3.5 rounded-full shadow-2xl flex items-center justify-center hover:shadow-[0_0_20px_rgba(20,184,166,0.3)] transition-shadow"
      >
        <MessageSquare className="w-5.5 h-5.5" />
      </motion.button>

    </div>
  );
};
