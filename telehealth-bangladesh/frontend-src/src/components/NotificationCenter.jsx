import React, { createContext, useContext, useState } from 'react';
import { Bell, ShieldAlert, Calendar, FileText, ShoppingBag, X } from 'lucide-react';

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

  const triggerNotification = (title, message, category = 'system') => {
    const newNotif = {
      id: Date.now() + Math.random().toString(36).substr(2, 9),
      title,
      message,
      category,
      timestamp: new Date(),
      read: false
    };

    setNotifications(prev => [newNotif, ...prev]);
    setToasts(prev => [...prev, newNotif]);

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
      
      {/* Toast Overlay Stack */}
      <div className="fixed bottom-6 right-6 z-[9995] flex flex-col gap-3 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="bg-white border border-[#BDDDFA] rounded-2xl shadow-xl p-4 flex gap-3 pointer-events-auto relative"
          >
            {/* Category indicator icon */}
            <div className="shrink-0">
              {toast.category === 'security' && (
                <div className="bg-red-50 p-2 rounded-xl text-[#DC2626] border border-red-200">
                  <ShieldAlert className="w-4 h-4" />
                </div>
              )}
              {toast.category === 'appointment' && (
                <div className="bg-[#E7F0FC] p-2 rounded-xl text-[#168CF5] border border-[#BDDDFA]">
                  <Calendar className="w-4 h-4" />
                </div>
              )}
              {toast.category === 'medical' && (
                <div className="bg-emerald-50 p-2 rounded-xl text-[#059669] border border-emerald-200">
                  <FileText className="w-4 h-4" />
                </div>
              )}
              {toast.category === 'billing' && (
                <div className="bg-amber-50 p-2 rounded-xl text-amber-600 border border-amber-200">
                  <ShoppingBag className="w-4 h-4" />
                </div>
              )}
              {toast.category === 'system' && (
                <div className="bg-slate-100 p-2 rounded-xl text-slate-600 border border-slate-200">
                  <Bell className="w-4 h-4" />
                </div>
              )}
            </div>

            {/* Message Details */}
            <div className="flex-grow pr-4">
              <h4 className="text-xs font-bold text-[#0F172A] leading-tight">{toast.title}</h4>
              <p className="text-[11px] text-[#334155] mt-0.5 leading-normal">{toast.message}</p>
              <span className="text-[9px] text-[#94A3B8] font-bold uppercase tracking-wider mt-1 block">
                {new Date(toast.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            {/* Close Button */}
            <button 
              onClick={() => removeToast(toast.id)}
              className="absolute top-3.5 right-3.5 text-[#94A3B8] hover:text-[#0F172A] cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
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
    <div className="absolute right-0 top-12 w-80 sm:w-96 bg-white border border-[#BDDDFA] rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col">
      {/* Title Header */}
      <div className="px-4 py-3.5 border-b border-[#BDDDFA]/60 flex justify-between items-center bg-[#F4F6F9]">
        <div>
          <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider flex items-center gap-1.5">
            <Bell className="w-4 h-4 text-[#059669]" />
            <span>Notifications</span>
          </h3>
          {unreadCount > 0 && (
            <p className="text-[10px] text-[#059669] font-bold mt-0.5">{unreadCount} unread alerts</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button 
              onClick={markAllRead} 
              className="text-[11px] text-[#059669] hover:underline font-semibold cursor-pointer"
            >
              Mark Read
            </button>
          )}
          {notifications.length > 0 && (
            <button 
              onClick={clearNotifications} 
              className="text-[11px] text-[#55647C] hover:text-[#0F172A] font-semibold cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex gap-1.5 px-3 py-2 border-b border-[#BDDDFA]/60 overflow-x-auto bg-[#F4F6F9]">
        {['all', 'system', 'appointment', 'medical', 'security'].map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`px-2.5 py-1 rounded-[8px] text-[10px] font-bold uppercase tracking-wider cursor-pointer border ${
              filter === cat 
                ? 'bg-[#059669] text-white border-[#059669]' 
                : 'bg-white border-[#BDDDFA] text-[#334155] hover:bg-[#E7F0FC]'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* List content */}
      <div className="max-h-80 overflow-y-auto divide-y divide-[#BDDDFA]/40 p-1 bg-white">
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-[#94A3B8] text-xs">
            No notifications on queue.
          </div>
        ) : (
          filtered.map((notif) => (
            <div 
              key={notif.id}
              onClick={() => markAsRead(notif.id)}
              className={`p-3 cursor-pointer hover:bg-[#E7F0FC]/60 flex gap-3 relative rounded-xl ${
                !notif.read ? 'bg-[#E7F0FC]/40 border-l-2 border-[#059669]' : ''
              }`}
            >
              {!notif.read && (
                <span className="absolute left-1.5 top-4 w-1.5 h-1.5 rounded-full bg-[#059669]" />
              )}
              
              <div className="flex-grow pl-2">
                <h4 className={`text-xs font-bold leading-tight ${!notif.read ? 'text-[#0F172A]' : 'text-[#334155]'}`}>
                  {notif.title}
                </h4>
                <p className="text-[11px] text-[#55647C] mt-0.5 leading-normal">{notif.message}</p>
                <span className="text-[9px] text-[#94A3B8] mt-1 block font-medium">
                  {new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="bg-[#F4F6F9] border-t border-[#BDDDFA]/60 px-4 py-2 text-center text-[9px] text-[#94A3B8] font-bold tracking-wider uppercase">
        End-to-End Encrypted Notification Feed
      </div>
    </div>
  );
};
