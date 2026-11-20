import React from 'react';
import { Lock, AlertCircle, Send } from 'lucide-react';

export const ClinicalChatPanel = ({
  messages = [],
  user,
  isAnonymous = false,
  anonIdentifier = '',
  e2eeStatus = 'secure',
  fingerprint = '',
  inputVal = '',
  setInputVal,
  onSendText,
  scrollRef,
  compact = false,
  placeholder
}) => {
  if (compact) {
    return (
      <div className="bg-white p-4 rounded-2xl border border-[#BDDDFA] shadow-sm flex flex-col justify-between min-h-[320px] flex-1">
        <div className="border-b border-[#BDDDFA]/60 pb-2 mb-2 flex justify-between items-center">
          <span className="text-xs font-bold text-[#0F172A] uppercase tracking-wider flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-[#059669]" />
            <span>Encrypted Peer Chat</span>
          </span>
          <span className="text-[10px] font-bold text-[#059669]">AES-256-GCM</span>
        </div>

        <div ref={scrollRef} className="flex-grow overflow-y-auto pr-1 space-y-2 max-h-[220px] flex flex-col text-xs">
          {messages.length === 0 ? (
            <p className="text-center text-[11px] text-slate-400 my-auto">Direct encrypted channel open with patient.</p>
          ) : (
            messages.map((msg, i) => {
              const isMe = Boolean(msg.isSelf || (msg.sender && msg.sender === user?.username));
              return (
                <div key={msg.id || i} className={`flex flex-col max-w-[85%] ${isMe ? 'self-end items-end' : 'self-start items-start'}`}>
                  <span className="text-[9px] text-[#94A3B8] px-1 font-semibold">{isMe ? 'You' : msg.sender}</span>
                  <div className={`p-2.5 rounded-xl text-xs ${isMe ? 'bg-[#059669] text-white' : 'bg-[#E7F0FC] text-[#0F172A] border border-[#BDDDFA]'}`}>
                    {msg.message}
                  </div>
                  <div className="flex items-center gap-1.5 text-[9px] text-slate-400 px-1 mt-0.5">
                    <span>{msg.timestamp}</span>
                    {isMe && (
                      <span className={msg.status === 'read' ? 'text-emerald-600 font-bold' : 'text-slate-500'}>
                        {msg.status === 'read' ? '✓✓ Read' : (msg.status === 'delivered' ? '✓✓ Delivered' : '✓ Sent')}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="flex gap-2 border-t border-[#BDDDFA]/60 pt-2.5 mt-2">
          <input
            type="text"
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && onSendText()}
            placeholder={placeholder || "Type message to patient..."}
            className="flex-grow py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white"
          />
          <button
            type="button"
            onClick={onSendText}
            className="bg-[#059669] hover:bg-[#047857] text-white font-bold px-3 py-2 rounded-xl text-xs flex items-center justify-center cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  // Full / Patient View
  return (
    <div className="bg-white p-5 rounded-2xl border border-[#BDDDFA] flex flex-col justify-between min-h-[520px]">
      <div className="border-b border-[#BDDDFA]/60 pb-3 mb-3 space-y-2.5">
        <div className="flex justify-between items-center">
          <span className="text-xs font-bold text-[#0F172A] uppercase tracking-wider flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-[#059669]" />
            <span>Encrypted Chat</span>
          </span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
            e2eeStatus === 'secure' ? 'bg-emerald-50 text-[#059669] border border-emerald-200' :
            e2eeStatus === 'failed' ? 'bg-red-50 text-red-700 border border-red-200' :
            'bg-amber-50 text-amber-700 border border-amber-200'
          }`}>
            {e2eeStatus === 'secure' ? 'E2EE: ACTIVE' : `E2EE: ${e2eeStatus.toUpperCase()}`}
          </span>
        </div>

        {/* Cryptographic Metadata Banner */}
        <div className="bg-[#E7F0FC]/60 p-2.5 rounded-xl text-[10px] space-y-1 border border-[#BDDDFA]">
          <div className="flex justify-between text-[#55647C]">
            <span>Key Exchange: <strong className="text-[#0F172A]">ECDH P-256</strong></span>
            <span>Cipher: <strong className="text-[#0F172A]">AES-256-GCM</strong></span>
          </div>
          {fingerprint && (
            <div className="text-[9px] font-mono text-[#55647C] flex justify-between pt-1 border-t border-[#BDDDFA]/60">
              <span>Security Fingerprint:</span>
              <span className="font-bold text-[#059669]">{fingerprint}</span>
            </div>
          )}
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div ref={scrollRef} className="flex-grow overflow-y-auto pr-1 space-y-3 max-h-[360px] flex flex-col">
        {messages.length === 0 ? (
          <div className="text-center text-xs text-[#55647C] my-auto p-6 space-y-2">
            <Lock className="w-8 h-8 text-[#94A3B8] mx-auto" />
            {e2eeStatus === 'secure' ? (
              <p>End-to-End Encrypted channel established. Messages sent here cannot be intercepted by the server.</p>
            ) : (
              <p>Establishing cryptographic handshake tunnel with peer...</p>
            )}
          </div>
        ) : (
          messages.map((msg, i) => {
            if (msg.isError) {
              return (
                <div key={i} className="bg-red-50 border border-red-200 p-2.5 rounded-xl text-xs text-red-700 self-center max-w-[90%] font-mono my-1">
                  <div className="font-bold flex items-center gap-1 text-[10px]">
                    <AlertCircle size={12} />
                    <span>INTEGRITY ERROR</span>
                  </div>
                  <p>{msg.message}</p>
                </div>
              );
            }
            const isMe = Boolean(msg.isSelf || (msg.sender && msg.sender === user?.username));
            const displayName = isMe
              ? 'You'
              : (isAnonymous && user?.role === 'doctor' ? anonIdentifier : (msg.sender || 'Participant'));
            return (
              <div key={msg.id || i} className={`flex flex-col max-w-[85%] ${isMe ? 'self-end items-end' : 'self-start items-start'}`}>
                <span className="text-[10px] text-[#94A3B8] mb-0.5 px-1 font-semibold">{displayName}</span>
                <div className={`p-3 rounded-2xl text-xs leading-relaxed ${isMe
                    ? 'bg-[#059669] text-white rounded-br-sm'
                    : 'bg-[#E7F0FC] text-[#0F172A] rounded-bl-sm border border-[#BDDDFA]'
                  }`}>
                  {msg.message}
                </div>
                <div className="flex items-center gap-1.5 text-[9px] text-slate-400 px-1 mt-0.5">
                  <span>{msg.timestamp}</span>
                  {isMe && (
                    <span className={msg.status === 'read' ? 'text-emerald-600 font-bold' : 'text-slate-500'}>
                      {msg.status === 'read' ? '✓✓ Read' : (msg.status === 'delivered' ? '✓✓ Delivered' : '✓ Sent')}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Chat Input */}
      <div className="flex gap-2 border-t border-[#BDDDFA]/60 pt-3 mt-2">
        <input
          type="text"
          value={inputVal}
          onChange={e => setInputVal(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onSendText()}
          placeholder={e2eeStatus === 'secure' ? "Type encrypted clinical message..." : "Type message to doctor..."}
          className="flex-grow !min-h-[46px] !py-2 !px-3 text-xs"
        />
        <button
          type="button"
          onClick={onSendText}
          className="bg-[#059669] hover:bg-[#047857] text-white font-bold px-4 rounded-[10px] text-xs flex items-center justify-center cursor-pointer"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

