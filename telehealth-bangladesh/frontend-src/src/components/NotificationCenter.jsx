import React, { createContext, useContext, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, CheckCircle, ShieldAlert, Calendar, FileText, ShoppingBag, X } from 'lucide-react';

const NotificationContext = createContext();

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [toasts, setToasts] = useState([]);

  // Seed initial notifications on login based on general logs
  const triggerNotification = (title, message, category = 'system') => {
    const newNotif = {
      id: Date.now() + Math.random().toString(36).substr(2, 9),
      title,
      message,
      category, // 'system', 'security', 'appointment', 'medical', 'billing'
      timestamp: new Date(),
      read: false
    };

    setNotifications(prev => [newNotif, ...prev]);
    
    // Add to active toast stack
    setToasts(prev => [...prev, newNotif]);

    // Play visual notification chime (optional or micro-interaction)
    // Auto-remove toast after 4.5 seconds
    setTimeout(() => {
      removeToast(newNotif.id);
    }, 4500);
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const markAsRead = (id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  return (
    <NotificationContext.Provider value={{
      notifications,
      toasts,
      triggerNotification,
      markAsRead,
      markAllRead,
      clearNotifications,
      removeToast
    }}>
      {children}
      
      {/* Toast Overlay Stack Container */}
      <div className="fixed bottom-6 right-6 z-[9995] flex flex-col gap-3.5 max-w-sm w-full pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 30, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.2 } }}
              className="bg-medical-cardBg border border-medical-borderBg rounded-2xl shadow-xl p-4 flex gap-3.5 pointer-events-auto glass-panel relative overflow-hidden"
            >
              {/* Category-based visual indicators */}
              <div className="shrink-0">
                {toast.category === 'security' && (
                  <div className="bg-medical-rose/10 p-2 rounded-xl text-medical-rose">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                )}
                {toast.category === 'appointment' && (
                  <div className="bg-medical-indigo/10 p-2 rounded-xl text-medical-indigo">
                    <Calendar className="w-5 h-5" />
                  </div>
                )}
                {toast.category === 'medical' && (
                  <div className="bg-medical-teal/10 p-2 rounded-xl text-medical-teal">
                    <FileText className="w-5 h-5" />
                  </div>
                )}
                {toast.category === 'billing' && (
                  <div className="bg-medical-emerald/10 p-2 rounded-xl text-medical-emerald">
                    <ShoppingBag className="w-5 h-5" />
                  </div>
                )}
                {toast.category === 'system' && (
                  <div className="bg-slate-500/10 p-2 rounded-xl text-slate-400">
                    <Bell className="w-5 h-5" />
                  </div>
                )}
              </div>

              {/* Message Details */}
              <div className="flex-grow pr-4">
                <h4 className="text-xs font-bold text-white leading-tight">{toast.title}</h4>
                <p className="text-[10px] text-slate-400 mt-1 leading-normal">{toast.message}</p>
                <span className="text-[8px] text-slate-500 font-semibold uppercase tracking-wider mt-1.5 block">
                  {new Date(toast.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              {/* Manual Close Action */}
              <button 
                onClick={() => removeToast(toast.id)}
                className="absolute top-3.5 right-3.5 text-slate-500 hover:text-white transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>

              {/* Loading progress slider at bottom */}
              <motion.div 
                initial={{ width: '100%' }}
                animate={{ width: '0%' }}
                transition={{ duration: 4.5, ease: 'linear' }}
                className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-medical-teal to-medical-indigo"
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </NotificationContext.Provider>
  );
};

// Dropdown Notification Panel Component
export const NotificationDropdown = ({ isOpen, onClose, user }) => {
  const { notifications, markAsRead, markAllRead, clearNotifications } = useNotifications();
  const [filter, setFilter] = useState('all');

  const filtered = notifications.filter(n => filter === 'all' || n.category === filter);
  const unreadCount = notifications.filter(n => !n.read).length;

  if (!isOpen) return null;

  return (
    <div className="absolute right-0 top-12 w-80 bg-medical-cardBg border border-medical-borderBg rounded-2xl shadow-2xl glass-panel z-50 overflow-hidden flex flex-col">
      {/* Title Header */}
      <div className="px-4 py-3.5 border-b border-medical-borderBg flex justify-between items-center bg-slate-950/20">
        <div>
          <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
            <Bell className="w-4 h-4 text-medical-teal" />
            <span>Notification Feed</span>
          </h3>
          {unreadCount > 0 && (
            <p className="text-[9px] text-medical-teal font-semibold mt-0.5">{unreadCount} unread alert packets</p>
          )}
        </div>
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <button 
              onClick={markAllRead} 
              className="text-[9px] text-medical-teal hover:underline font-extrabold"
            >
              Mark Read
            </button>
          )}
          {notifications.length > 0 && (
            <button 
              onClick={clearNotifications} 
              className="text-[9px] text-slate-500 hover:text-white hover:underline font-extrabold"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex gap-1.5 px-3 py-2 border-b border-medical-borderBg overflow-x-auto bg-slate-950/40">
        {['all', 'system', 'appointment', 'medical', 'security'].map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase transition-all shrink-0 border ${filter === cat ? 'bg-medical-teal/10 border-medical-teal/30 text-medical-teal' : 'bg-transparent border-white/5 text-slate-500 hover:text-slate-300'}`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* List content */}
      <div className="max-h-72 overflow-y-auto divide-y divide-medical-borderBg/50 p-1">
        {filtered.length === 0 ? (
          <div className="text-center py-10 text-slate-500 text-xs">
            No notifications on queue.
          </div>
        ) : (
          filtered.map((notif) => (
            <div 
              key={notif.id}
              onClick={() => markAsRead(notif.id)}
              className={`p-3 transition-colors cursor-pointer hover:bg-slate-900/40 flex gap-3 relative ${!notif.read ? 'bg-medical-indigo/2' : ''}`}
            >
              {/* Unread circle badge */}
              {!notif.read && (
                <span className="absolute left-2.5 top-4 w-1.5 h-1.5 rounded-full bg-medical-indigo" />
              )}
              
              <div className="flex-grow pl-2.5">
                <h4 className={`text-[11px] font-bold leading-tight ${!notif.read ? 'text-white font-extrabold' : 'text-slate-300 font-semibold'}`}>
                  {notif.title}
                </h4>
                <p className="text-[10px] text-slate-400 mt-1 leading-normal">{notif.message}</p>
                <span className="text-[8px] text-slate-500 mt-1 block">
                  {new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer view-all link */}
      <div className="bg-slate-950/30 border-t border-medical-borderBg/60 px-4 py-2 text-center text-[9px] text-slate-500 font-bold">
        END-TO-END CRYPTOGRAPHICALLY AUDITED
      </div>
    </div>
  );
};
