import React, { useState, useRef, useEffect } from 'react';
import {
  Bot, Send, AlertTriangle, PhoneCall, X,
  FileText, CheckCircle2, HelpCircle
} from 'lucide-react';
import { useLanguage } from './LanguageContext';
import { useNotifications } from './NotificationCenter';

const API_BASE = import.meta.env.VITE_API_BASE || window.location.origin;

const SUGGESTED_CHIPS = [
  "Causes of headache?",
  "When to see doctor for fever?",
  "Prepare for consultation?"
];

export const SupportWidget = ({ user, token }) => {
  const { t } = useLanguage();
  const { triggerNotification } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('ai');
  
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'ai',
      text: "Hello! I am your AI Health Assistant. How can I assist you with general health questions or preparing for your doctor consultation today?",
      safety_level: 'normal'
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [conversationId, setConversationId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastQuery, setLastQuery] = useState('');
  const chatScrollRef = useRef(null);

  useEffect(() => {
    chatScrollRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [messages, loading]);
  
  const [ticketForm, setTicketForm] = useState({ subject: '', details: '' });
  const [ticketSuccess, setTicketSuccess] = useState(false);

  const handleSend = async (customQuery) => {
    const query = (customQuery || inputValue).trim();
    if (!query || loading) return;

    setError(null);
    setLastQuery(query);

    const userMsg = { id: Date.now(), sender: 'user', text: query, safety_level: 'normal' };
    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setLoading(true);

    try {
      const authToken = token || localStorage.getItem("tv_token");
      const resp = await fetch(`${API_BASE}/api/ai/health-assistant/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authToken}`
        },
        body: JSON.stringify({
          message: query,
          conversation_id: conversationId || undefined
        })
      });

      if (!resp.ok) {
        if (resp.status === 429) {
          throw new Error("Too many queries. Please wait a moment before asking again.");
        }
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || "The AI health assistant is temporarily unavailable. Please try again later.");
      }

      const data = await resp.json();
      if (data.conversation_id && !conversationId) {
        setConversationId(data.conversation_id);
      }

      setMessages(prev => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'ai',
          text: data.response,
          safety_level: data.safety_level || 'normal'
        }
      ]);
    } catch (err) {
      console.error("Health Assistant API request error:", err);
      setError(err.message || "Sorry, I couldn't connect to the health assistant right now. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleTicketSubmit = (e) => {
    e.preventDefault();
    if (!ticketForm.subject || !ticketForm.details) return;

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
      {isOpen && (
        <div className="w-88 sm:w-96 h-[490px] bg-white border border-[#BDDDFA] rounded-2xl shadow-2xl mb-4 overflow-hidden flex flex-col">
          {/* Header toolbar */}
          <div className="px-4 py-3 border-b border-[#BDDDFA]/60 flex justify-between items-center bg-[#F4F6F9]">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-[8px] bg-[#059669] flex items-center justify-center text-white">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-[#0F172A]">AI Health Assistant</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#E7F0FC] text-[#059669] font-bold border border-[#BDDDFA]">
                    Care Aid
                  </span>
                </div>
                <p className="text-[10px] text-[#55647C]">Health guidance &amp; navigation</p>
              </div>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              className="text-[#94A3B8] hover:text-[#0F172A] p-1 rounded-lg cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Segmented Slider Tab Switcher */}
          <div className="p-2 bg-[#F4F6F9] border-b border-[#BDDDFA]/60 shrink-0">
            <div className="bg-[#E7F0FC] p-1 rounded-xl flex items-center gap-1 border border-[#BDDDFA]">
              <button 
                onClick={() => setActiveTab('ai')}
                className={`flex-1 py-1.5 rounded-lg text-center cursor-pointer text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${activeTab === 'ai' ? 'bg-[#0F172A] text-white shadow-sm' : 'text-[#55647C] hover:text-[#0F172A]'}`}
              >
                <span>AI Chat</span>
              </button>
              <button 
                onClick={() => setActiveTab('tickets')}
                className={`flex-1 py-1.5 rounded-lg text-center cursor-pointer text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${activeTab === 'tickets' ? 'bg-[#0F172A] text-white shadow-sm' : 'text-[#55647C] hover:text-[#0F172A]'}`}
              >
                <FileText className="w-3 h-3" />
                <span>Ticket</span>
              </button>
              <button 
                onClick={() => setActiveTab('hotlines')}
                className={`flex-1 py-1.5 rounded-lg text-center cursor-pointer text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${activeTab === 'hotlines' ? 'bg-[#0F172A] text-white shadow-sm' : 'text-[#55647C] hover:text-[#0F172A]'}`}
              >
                <PhoneCall className="w-3 h-3" />
                <span>Hotlines</span>
              </button>
            </div>
          </div>

          {/* Tab Content Viewport */}
          <div className="flex-grow p-3.5 overflow-hidden flex flex-col bg-white">
            
            {/* 1. AI CHAT TAB */}
            {activeTab === 'ai' && (
              <div className="flex-grow flex flex-col justify-between overflow-hidden">
                {/* Messages list */}
                <div className="flex-grow overflow-y-auto pr-1 space-y-2.5 max-h-[280px]">
                  {messages.map((m) => {
                    const isUser = m.sender === 'user';
                    return (
                      <div key={m.id} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                        <div className={`p-2.5 rounded-xl text-xs max-w-[85%] leading-relaxed ${isUser ? 'bg-[#059669] text-white' : 'bg-[#E7F0FC] text-[#0F172A] border border-[#BDDDFA]'}`}>
                          {m.text}
                        </div>
                      </div>
                    );
                  })}
                  {loading && (
                    <div className="text-[11px] text-[#55647C] italic p-2 bg-[#E7F0FC] rounded-xl inline-block border border-[#BDDDFA]">
                      Analyzing medical guidance...
                    </div>
                  )}
                  {error && (
                    <div className="text-[11px] text-[#DC2626] p-2 bg-red-50 border border-red-200 rounded-xl flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}
                  <div ref={chatScrollRef} />
                </div>

                {/* Suggested prompt chips */}
                <div className="flex gap-1.5 overflow-x-auto py-2 border-t border-[#BDDDFA]/60 mt-2">
                  {SUGGESTED_CHIPS.map((chip, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSend(chip)}
                      className="px-2.5 py-1 rounded-[8px] bg-[#E7F0FC] border border-[#BDDDFA] text-[10px] font-semibold text-[#0F172A] whitespace-nowrap hover:bg-[#BDDDFA]/50 cursor-pointer"
                    >
                      {chip}
                    </button>
                  ))}
                </div>

                {/* Send query input */}
                <form
                  onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                  className="flex gap-2 pt-1"
                >
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="Ask about health..."
                    className="flex-grow text-xs !min-h-[42px] !py-2 !px-3"
                  />
                  <button
                    type="submit"
                    disabled={!inputValue.trim() || loading}
                    className="bg-[#059669] hover:bg-[#047857] disabled:opacity-50 text-white px-3.5 rounded-[10px] flex items-center justify-center cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>
            )}

            {/* 2. SUPPORT TICKET TAB */}
            {activeTab === 'tickets' && (
              <form onSubmit={handleTicketSubmit} className="flex-grow flex flex-col justify-between space-y-3">
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-[#0F172A] mb-1 uppercase tracking-wider">Subject</label>
                    <input
                      required
                      type="text"
                      placeholder="e.g. Issue with video consultation"
                      value={ticketForm.subject}
                      onChange={e => setTicketForm({ ...ticketForm, subject: e.target.value })}
                      className="w-full text-xs !min-h-[42px] !py-2 !px-3"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#0F172A] mb-1 uppercase tracking-wider">Details</label>
                    <textarea
                      required
                      rows={3}
                      placeholder="Describe what occurred in detail..."
                      value={ticketForm.details}
                      onChange={e => setTicketForm({ ...ticketForm, details: e.target.value })}
                      className="w-full text-xs !min-h-[70px] !py-2 !px-3"
                    />
                  </div>
                </div>

                {ticketSuccess && (
                  <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-[#059669] flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Ticket filed successfully!</span>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full bg-[#059669] hover:bg-[#047857] text-white font-bold py-2.5 rounded-[10px] text-xs cursor-pointer"
                >
                  Submit Ticket
                </button>
              </form>
            )}

            {/* 3. HOTLINES TAB */}
            {activeTab === 'hotlines' && (
              <div className="space-y-3 overflow-y-auto max-h-[360px] pr-1">
                <div className="bg-[#E7F0FC]/60 border border-[#BDDDFA] p-3 rounded-xl flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-[#0F172A]">999 National Emergency</h4>
                    <p className="text-[10px] text-[#55647C]">Ambulance, Police &amp; Fire Services</p>
                  </div>
                  <a href="tel:999" className="bg-red-50 hover:bg-[#DC2626] hover:text-white p-2 rounded-[8px] text-[#DC2626] border border-red-200 cursor-pointer">
                    <PhoneCall className="w-3.5 h-3.5" />
                  </a>
                </div>

                <div className="bg-[#E7F0FC]/60 border border-[#BDDDFA] p-3 rounded-xl flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-[#0F172A]">16263 DGHS Health Helpline</h4>
                    <p className="text-[10px] text-[#55647C]">Govt. Telehealth services (24/7)</p>
                  </div>
                  <a href="tel:16263" className="bg-[#059669]/10 hover:bg-[#059669] hover:text-white p-2 rounded-[8px] text-[#059669] border border-[#059669]/30 cursor-pointer">
                    <PhoneCall className="w-3.5 h-3.5" />
                  </a>
                </div>

                <div className="bg-[#E7F0FC]/60 border border-[#BDDDFA] p-3 rounded-xl flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-[#0F172A]">333 Citizens Service</h4>
                    <p className="text-[10px] text-[#55647C]">Government assistance &amp; social aid</p>
                  </div>
                  <a href="tel:333" className="bg-[#168CF5]/10 hover:bg-[#168CF5] hover:text-white p-2 rounded-[8px] text-[#168CF5] border border-[#168CF5]/30 cursor-pointer">
                    <PhoneCall className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-[#059669] hover:bg-[#047857] text-white p-3.5 rounded-full shadow-lg flex items-center justify-center cursor-pointer"
        aria-label="Toggle Support Chat"
      >
        <Bot className="w-5 h-5" />
      </button>

    </div>
  );
};

export default SupportWidget;
