import React, { useState, useEffect, useRef } from 'react';
import {
  Bot, Send, AlertTriangle, RefreshCw,
  ShieldCheck, HelpCircle, User,
  CheckCircle2, Stethoscope, AlertOctagon
} from 'lucide-react';
import { useLanguage } from './LanguageContext';

const API_BASE = import.meta.env.VITE_API_BASE || window.location.origin;

const SUGGESTED_PROMPTS = [
  "What can cause a headache?",
  "When should I see a doctor for a fever?",
  "How can I prepare for my consultation?",
  "What information should I tell my doctor?"
];

export const AIHealthAssistant = ({ token, user, onNavigateBooking }) => {
  const { t } = useLanguage();
  const [messages, setMessages] = useState([
    {
      id: 'welcome-1',
      sender: 'assistant',
      text: "How can I help with your health today? I can provide general health information, explore possible explanations for symptoms, and help you prepare for a consultation with a certified doctor.",
      safety_level: 'normal',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [conversationId, setConversationId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastQuery, setLastQuery] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const sendMessage = async (textToSend) => {
    const query = (textToSend || inputValue).trim();
    if (!query || loading) return;

    setError(null);
    setLastQuery(query);

    const userMsg = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setLoading(true);

    try {
      const authToken = token || localStorage.getItem('tv_token');
      const response = await fetch(`${API_BASE}/api/ai/health-assistant/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          message: query,
          conversation_id: conversationId || undefined
        })
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error("You have sent too many requests. Please wait a moment before trying again.");
        }
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "The AI health assistant is temporarily unavailable. Please try again later.");
      }

      const data = await response.json();

      if (data.conversation_id && !conversationId) {
        setConversationId(data.conversation_id);
      }

      const assistantMsg = {
        id: `ai-${Date.now()}`,
        sender: 'assistant',
        text: data.response,
        safety_level: data.safety_level || 'normal',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      console.error("AI Health Assistant error:", err);
      setError(err.message || "Sorry, I couldn't connect to the health assistant right now. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    if (lastQuery) {
      sendMessage(lastQuery);
    }
  };

  const handlePromptClick = (prompt) => {
    sendMessage(prompt);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8.5rem)] max-w-5xl mx-auto rounded-2xl border border-[#BDDDFA] bg-white shadow-sm overflow-hidden">
      
      {/* 1. Header Toolbar */}
      <div className="px-6 py-4 border-b border-[#BDDDFA]/60 bg-[#F4F6F9] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-[10px] bg-[#059669] flex items-center justify-center text-white">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-[#0F172A] tracking-tight">
                AI Health Assistant
              </h2>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#E7F0FC] text-[#059669] border border-[#BDDDFA]">
                Care Guidance
              </span>
            </div>
            <p className="text-xs text-[#55647C]">
              Health information and care navigation
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs text-[#55647C] bg-white px-3 py-1.5 rounded-[10px] border border-[#BDDDFA]">
          <ShieldCheck className="w-4 h-4 text-[#059669]" />
          <span>Server-Side Isolated • Safe Healthcare Guardrails</span>
        </div>
      </div>

      {/* 2. Medical Disclaimer Banner */}
      <div className="px-6 py-2 bg-amber-50 border-b border-amber-200 text-xs text-amber-900 flex items-center gap-2">
        <HelpCircle className="w-4 h-4 shrink-0 text-amber-600" />
        <span>
          <strong>Medical Disclaimer:</strong> AI health information is for educational guidance only. It does not replace professional medical diagnosis or treatment by a licensed physician.
        </span>
      </div>

      {/* 3. Messages Chat Viewport */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-white">
        
        {/* Welcome State Card */}
        {messages.length === 1 && (
          <div className="p-5 rounded-2xl bg-[#E7F0FC]/50 border border-[#BDDDFA] mb-4 space-y-3">
            <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#059669]" />
              Suggested Health Topics
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SUGGESTED_PROMPTS.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => handlePromptClick(prompt)}
                  className="p-3 rounded-xl bg-white border border-[#BDDDFA] text-left text-xs font-semibold text-[#0F172A] hover:bg-[#E7F0FC] cursor-pointer"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages List */}
        {messages.map((msg) => {
          const isUser = msg.sender === 'user';
          const isEmergency = msg.safety_level === 'emergency';
          const isUrgent = msg.safety_level === 'urgent';

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
            >
              <div className="flex items-center gap-1.5 mb-1 px-1 text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider">
                {isUser ? (
                  <span>You • {msg.timestamp}</span>
                ) : (
                  <span>HealNSight AI • {msg.timestamp}</span>
                )}
              </div>

              <div
                className={`p-4 rounded-2xl text-xs sm:text-sm leading-relaxed max-w-[85%] whitespace-pre-line ${
                  isUser
                    ? 'bg-[#059669] text-white rounded-br-none'
                    : isEmergency
                    ? 'bg-red-50 text-red-950 border border-red-300 rounded-bl-none'
                    : isUrgent
                    ? 'bg-amber-50 text-amber-950 border border-amber-300 rounded-bl-none'
                    : 'bg-[#E7F0FC] text-[#0F172A] border border-[#BDDDFA] rounded-bl-none'
                }`}
              >
                {/* Emergency Banner Alert */}
                {isEmergency && (
                  <div className="mb-3 p-3 bg-red-100 border border-red-300 rounded-xl text-xs font-bold text-red-900 flex items-center gap-2">
                    <AlertOctagon className="w-4 h-4 text-red-600 shrink-0" />
                    <span>Potential Emergency Alert: Please contact emergency services (Dial 999 or 16263) immediately.</span>
                  </div>
                )}

                {msg.text}

                {/* Consult Doctor Link for non-user responses */}
                {!isUser && onNavigateBooking && (
                  <div className="mt-3 pt-2.5 border-t border-[#BDDDFA]/60 flex items-center justify-between">
                    <span className="text-[11px] text-[#55647C]">Need a personalized medical opinion?</span>
                    <button
                      onClick={onNavigateBooking}
                      className="text-[11px] font-bold text-[#059669] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Stethoscope className="w-3.5 h-3.5" />
                      Find a Doctor
                    </button>
                  </div>
                )}
              </div>

              {!isUser && (
                <span className="text-[9px] text-[#94A3B8] mt-1 px-1">
                  AI-generated health guidance • Always verify with a licensed physician
                </span>
              )}
            </div>
          );
        })}

        {/* Loading Indicator */}
        {loading && (
          <div className="flex flex-col items-start">
            <div className="p-4 rounded-2xl rounded-bl-none bg-[#E7F0FC] border border-[#BDDDFA] text-[#0F172A] text-xs">
              <span className="font-semibold text-xs">Analyzing medical guidelines...</span>
            </div>
          </div>
        )}

        {/* Error State with Retry */}
        {error && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={handleRetry}
              className="px-3 py-1 rounded-[8px] bg-[#DC2626] hover:bg-[#B91C1C] text-white font-bold text-xs flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Try again
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 4. Input Bar */}
      <div className="p-4 border-t border-[#BDDDFA]/60 bg-[#F4F6F9] shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage();
          }}
          className="flex items-center gap-3"
        >
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={loading}
            placeholder={loading ? "AI Assistant is analyzing..." : "Describe symptoms or ask about general health..."}
            maxLength={2000}
            className="flex-1"
          />

          <button
            type="submit"
            disabled={!inputValue.trim() || loading}
            className="px-5 min-h-[52px] rounded-[10px] bg-[#059669] hover:bg-[#047857] disabled:opacity-50 text-white font-bold text-xs sm:text-sm flex items-center gap-2 cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">Send</span>
          </button>
        </form>

        <div className="flex items-center justify-between mt-2 px-1 text-[10px] text-[#55647C]">
          <span>Confidential teleconsultation aid • Max 2,000 characters</span>
          <span>Emergency? Dial Bangladesh 999 or 16263</span>
        </div>
      </div>

    </div>
  );
};

export default AIHealthAssistant;
