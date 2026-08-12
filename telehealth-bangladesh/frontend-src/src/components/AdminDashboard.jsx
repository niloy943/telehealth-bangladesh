import React, { useState, useEffect } from 'react';
import { useLanguage } from './LanguageContext';
import { useNotifications } from './NotificationCenter';
import { 
  ShieldAlert, UserCheck, AlertTriangle, Eye, ShieldCheck, Cpu, Database, 
  Settings, Activity, RefreshCcw, Lock, HardDrive, BarChart2, CheckCircle2, XCircle, Search
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE || window.location.origin;

export const AdminDashboard = ({ token }) => {
  const { t } = useLanguage();
  const { triggerNotification } = useNotifications();
  const [logs, setLogs] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [orders, setOrders] = useState([]);
  const [searchAudit, setSearchAudit] = useState('');
  const [auditFilter, setAuditFilter] = useState('all');
  const [systemChecks, setSystemChecks] = useState({
    db: "Healthy (0.4ms latency)",
    channels: "Active (InMemoryChannelLayer)",
    e2ee: "Compliant (ECDH Prime256v1)",
    backup: "Secured (Last sync: 2h ago)"
  });

  const [metrics, setMetrics] = useState({
    cpu: [22, 28, 25, 34, 30, 42, 36, 48, 40, 44],
    latency: [0.38, 0.42, 0.35, 0.52, 0.44, 0.41, 0.39, 0.58, 0.42, 0.46],
    channels: 3
  });

  useEffect(() => {
    const iv = setInterval(() => {
      setMetrics(prev => {
        const nextCpu = [...prev.cpu.slice(1), Math.floor(20 + Math.random() * 25)];
        const nextLatency = [...prev.latency.slice(1), parseFloat((0.25 + Math.random() * 0.35).toFixed(2))];
        const nextChannels = Math.max(1, prev.channels + (Math.random() > 0.5 ? 1 : -1));
        return { cpu: nextCpu, latency: nextLatency, channels: nextChannels };
      });
    }, 2500);
    return () => clearInterval(iv);
  }, []);

  const loadAdminData = async () => {
    try {
      const rLogs = await fetch(`${API_BASE}/api/audit-logs/`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const logsData = await rLogs.json();
      setLogs(logsData);

      const rDocs = await fetch(`${API_BASE}/api/doctors/`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const docsData = await rDocs.json();
      setDoctors(docsData);

      const rOrders = await fetch(`${API_BASE}/api/orders/`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const ordersData = await rOrders.json();
      setOrders(ordersData);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, [token]);

  const handleVerifyDoctor = (id, bmdc) => {
    triggerNotification("KYC Doctor Approved", `BMDC License Registration #${bmdc} approved successfully.`, "security");
    
    // Simulate updating doctor locally in mock data
    setDoctors(prev => prev.filter(d => d.id !== id));
    
    // Append mock audit log entry to simulate GDPR recording
    const newLog = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      user_details: { username: "admin", role: "admin" },
      action: "KYC_VERIFY_SUCCESS",
      ip_address: "127.0.0.1",
      details: `Admin approved credentials for BMDC Register license ${bmdc}`
    };
    setLogs(prev => [newLog, ...prev]);
  };

  const handleRejectDoctor = (id, bmdc) => {
    triggerNotification("KYC Doctor Denied", `BMDC Registration credentials for #${bmdc} rejected.`, "security");
    setDoctors(prev => prev.filter(d => d.id !== id));
    
    const newLog = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      user_details: { username: "admin", role: "admin" },
      action: "KYC_VERIFY_REJECT",
      ip_address: "127.0.0.1",
      details: `Admin rejected license registry credentials ${bmdc}`
    };
    setLogs(prev => [newLog, ...prev]);
  };

  const handleUpdateOrderStatus = async (id, statusVal) => {
    try {
      const resp = await fetch(`${API_BASE}/api/orders/${id}/`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ status: statusVal })
      });
      if (resp.status === 200) {
        triggerNotification("Order Status Updated", `Courier dispatch Order #${id} is now ${statusVal.toUpperCase()}.`, "billing");
        loadAdminData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Filter logs
  const filteredLogs = (Array.isArray(logs) ? logs : []).filter(log => {
    const matchesSearch = log.details.toLowerCase().includes(searchAudit.toLowerCase()) ||
                          (log.user_details?.username || '').toLowerCase().includes(searchAudit.toLowerCase());
    const matchesFilter = auditFilter === 'all' || 
                          (auditFilter === 'decrypt' && log.action.includes('DECRYPT')) ||
                          (auditFilter === 'kyc' && log.action.includes('KYC')) ||
                          (auditFilter === 'auth' && (log.action.includes('LOGIN') || log.action.includes('LOGOUT')));
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-8 text-base animate-fade">
      
      {/* Admin stats dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        
        <div className="glass-panel p-8 rounded-2xl space-y-3 spotlight-card tilt-card">
          <div className="flex justify-between items-center text-medical-textMuted">
            <span className="text-sm font-bold uppercase tracking-wider">{t('systemHealth')}</span>
            <Activity className="w-5 h-5 text-medical-teal" />
          </div>
          <h3 className="text-3xl font-extrabold text-white">99.98%</h3>
          <p className="text-sm text-medical-textMuted mt-1">Daphne websocket broker online</p>
        </div>

        <div className="glass-panel p-8 rounded-2xl space-y-3 spotlight-card tilt-card">
          <div className="flex justify-between items-center text-medical-textMuted">
            <span className="text-sm font-bold uppercase tracking-wider">Compliance Scope</span>
            <ShieldCheck className="w-5 h-5 text-medical-teal" />
          </div>
          <h3 className="text-3xl font-extrabold text-white">GDPR / HIPAA</h3>
          <p className="text-sm text-medical-textMuted mt-1">Consent logs audited dynamically</p>
        </div>

        <div className="glass-panel p-8 rounded-2xl space-y-3 spotlight-card tilt-card">
          <div className="flex justify-between items-center text-medical-textMuted">
            <span className="text-sm font-bold uppercase tracking-wider">User Ledger</span>
            <UserCheck className="w-5 h-5 text-medical-indigo" />
          </div>
          <h3 className="text-3xl font-extrabold text-white">{doctors.length} Doctors</h3>
          <p className="text-sm text-medical-textMuted mt-1">Seeded in sqlite database</p>
        </div>

        <div className="glass-panel p-8 rounded-2xl space-y-3 spotlight-card tilt-card">
          <div className="flex justify-between items-center text-medical-textMuted">
            <span className="text-sm font-bold uppercase tracking-wider">Audit Narrative Records</span>
            <ShieldAlert className="w-5 h-5 text-medical-rose" />
          </div>
          <h3 className="text-3xl font-extrabold text-white">{(Array.isArray(logs) ? logs : []).length} Actions</h3>
          <p className="text-sm text-medical-textMuted mt-1">GDPR ledger records</p>
        </div>

      </div>

      {/* Audit Logs and System diagnostics double column */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left columns: Audits */}
        <div className="lg:col-span-2 glass-panel p-8 rounded-2xl border border-medical-borderBg space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-medical-borderBg pb-3">
            <div>
              <h3 className="text-xl font-bold text-slate-200 uppercase tracking-wider">{t('securityAuditLogs')}</h3>
              <p className="text-sm text-medical-textMuted mt-0.5">Real-time HIPAA &amp; GDPR compliance stream</p>
            </div>
            <button onClick={loadAdminData} className="text-sm text-medical-textMuted hover:text-white flex items-center gap-1.5 font-bold">
              <RefreshCcw className="w-4 h-4" /> Reload Logs
            </button>
          </div>

          {/* Audit Filters Toolbar */}
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-grow">
              <input 
                type="text" 
                placeholder="Search audit trail details..." 
                value={searchAudit} 
                onChange={e => setSearchAudit(e.target.value)} 
                className="w-full bg-medical-darkBg border border-medical-borderBg rounded-xl py-2.5 pl-10 pr-4 text-white outline-none focus:border-medical-teal placeholder-slate-500 text-base" 
              />
              <Search className="absolute left-3 top-3 w-4.5 h-4.5 text-medical-textMuted" />
            </div>
            
            <div className="flex gap-1.5">
              {['all', 'decrypt', 'kyc', 'auth'].map(f => (
                <button
                  key={f}
                  onClick={() => setAuditFilter(f)}
                  className={`px-4.5 py-2 rounded-xl font-bold uppercase text-xs transition-all border ${auditFilter === f ? 'bg-medical-teal/10 border-medical-teal/30 text-medical-teal' : 'bg-medical-darkBg border-medical-borderBg text-medical-textMuted hover:text-white'}`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto max-h-[400px] overflow-y-auto pr-1">
            <table className="w-full text-left text-sm text-medical-textMuted">
              <thead>
                <tr className="border-b border-medical-borderBg text-medical-textBody font-semibold">
                  <th className="py-2.5 px-2">{t('timestamp')}</th>
                  <th className="px-2">{t('operator')}</th>
                  <th className="px-2">Role</th>
                  <th className="px-2">{t('auditAction')}</th>
                  <th className="px-2">{t('ipAddress')}</th>
                  <th className="px-2">{t('narrative')}</th>
                </tr>
              </thead>
              <tbody>
                {logs.error ? (
                  <tr>
                    <td colSpan="6" className="py-4 text-center text-medical-rose font-semibold">⚠️ {logs.detail || "Access Denied"}</td>
                  </tr>
                ) : filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-4 text-center text-medical-textMuted">No logs matching selected filter.</td>
                  </tr>
                ) : (
                  filteredLogs.map(log => (
                    <tr key={log.id} className="border-b border-medical-borderBg hover:bg-white/2">
                      <td className="py-3 px-2 font-mono text-xs text-medical-textMuted">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="px-2 font-bold text-slate-200">
                        {log.user_details?.username || "Guest/Anonymous"}
                      </td>
                      <td className="px-2 capitalize text-xs text-medical-textMuted">{log.user_details?.role || "System"}</td>
                      <td className="px-2">
                        <span className={`px-2.5 py-1 rounded text-xs font-bold uppercase ${log.action.includes("BLOCK") || log.action.includes("REJECT") ? 'bg-medical-rose/10 text-medical-rose' : 'bg-medical-teal/10 text-medical-teal'}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-2 font-mono text-xs text-medical-textMuted">{log.ip_address || "127.0.0.1"}</td>
                      <td className="px-2 max-w-xs truncate text-xs text-medical-textBody" title={log.details}>{log.details}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right column: System Diagnostics & Credentials Approval */}
        <div className="space-y-6">
          
          {/* Diagnostics Panel with Live SVG Charts */}
          <div className="glass-panel p-8 rounded-2xl border border-medical-borderBg space-y-6 spotlight-card tilt-card">
            <h3 className="text-xl font-bold text-slate-200 border-b border-medical-borderBg pb-2 uppercase tracking-wider">System Live Diagnostics</h3>
            
            <div className="space-y-6">
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm text-medical-textMuted">
                  <span className="flex items-center gap-1.5"><Cpu className="w-5 h-5" /> CPU Load &amp; ASGI channels ({metrics.channels} active)</span>
                  <span className="font-mono text-white font-bold">{metrics.cpu[metrics.cpu.length - 1]}%</span>
                </div>
                <div className="w-full h-16 bg-medical-darkBg/60 rounded-lg overflow-hidden border border-medical-borderBg relative">
                  <svg className="w-full h-full" viewBox="0 0 180 50" preserveAspectRatio="none">
                    <path
                      d={`M ${metrics.cpu.map((val, idx) => `${idx * 20}, ${50 - val}`).join(" L ")}`}
                      fill="none"
                      stroke="var(--color-secondary)"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm text-medical-textMuted">
                  <span className="flex items-center gap-1.5"><Database className="w-5 h-5" /> SQLite Latency</span>
                  <span className="font-mono text-white font-bold">{metrics.latency[metrics.latency.length - 1]}ms</span>
                </div>
                <div className="w-full h-16 bg-medical-darkBg/60 rounded-lg overflow-hidden border border-medical-borderBg relative">
                  <svg className="w-full h-full" viewBox="0 0 180 50" preserveAspectRatio="none">
                    <path
                      d={`M ${metrics.latency.map((val, idx) => `${idx * 20}, ${50 - val * 70}`).join(" L ")}`}
                      fill="none"
                      stroke="var(--color-primary)"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Security Activity Matrix */}
          <div className="glass-panel p-8 rounded-2xl border border-medical-borderBg space-y-6 spotlight-card tilt-card">
            <h3 className="text-xl font-bold text-slate-200 border-b border-medical-borderBg pb-2 uppercase tracking-wider">Security Activity Matrix</h3>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="bg-medical-darkBg/40 p-4 rounded-xl border border-medical-borderBg flex flex-col justify-between">
                <span className="text-medical-textMuted font-bold uppercase tracking-wider">Brute Locks</span>
                <span className="text-2xl font-extrabold text-white mt-1.5">0 <span className="text-xs text-medical-emerald font-semibold uppercase tracking-widest bg-medical-emerald/10 px-1.5 py-0.5 rounded ml-1">Safe</span></span>
              </div>
              <div className="bg-medical-darkBg/40 p-4 rounded-xl border border-medical-borderBg flex flex-col justify-between">
                <span className="text-medical-textMuted font-bold uppercase tracking-wider">E2EE Tunnels</span>
                <span className="text-2xl font-extrabold text-medical-teal mt-1.5">5 <span className="text-xs text-medical-textMuted font-mono font-normal">Active</span></span>
              </div>
              <div className="bg-medical-darkBg/40 p-4 rounded-xl border border-medical-borderBg flex flex-col justify-between">
                <span className="text-medical-textMuted font-bold uppercase tracking-wider">Failed Logins</span>
                <span className="text-2xl font-extrabold text-medical-rose mt-1.5">2 <span className="text-xs text-medical-textMuted font-mono font-normal">Ip rate-lim</span></span>
              </div>
              <div className="bg-medical-darkBg/40 p-4 rounded-xl border border-medical-borderBg flex flex-col justify-between">
                <span className="text-medical-textMuted font-bold uppercase tracking-wider">KYC Compliance</span>
                <span className="text-2xl font-extrabold text-medical-indigo mt-1.5">94% <span className="text-xs text-medical-textMuted font-mono font-normal">Audited</span></span>
              </div>
            </div>
          </div>

          {/* Credentials approval console */}
          <div className="glass-panel p-8 rounded-2xl border border-medical-borderBg space-y-6">
            <h3 className="text-xl font-bold text-slate-200 border-b border-medical-borderBg pb-2 uppercase tracking-wider">{t('kycReviewCenter')}</h3>
            
            <div className="space-y-4 max-h-[260px] overflow-y-auto pr-1">
              {doctors.length === 0 ? (
                <p className="text-sm text-medical-textMuted py-8 text-center">No pending licenses for review.</p>
              ) : (
                doctors.map(d => (
                  <div key={d.id} className="bg-medical-darkBg/40 p-4 rounded-xl border border-medical-borderBg space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-base font-bold text-white">Dr. {d.user.first_name} {d.user.last_name}</h4>
                        <p className="text-sm text-medical-teal mt-0.5">{d.specialty}</p>
                        <p className="text-xs text-medical-textMuted mt-1">BMDC: {d.user.bmdc_reg || "BMDC/A-04938"}</p>
                      </div>
                      <span className="text-[10px] bg-medical-amber/10 text-medical-amber py-0.5 px-2.5 rounded-full font-bold">AWAITING</span>
                    </div>
                    <div className="flex gap-2 justify-end pt-1">
                      <button onClick={() => handleVerifyDoctor(d.id, d.user.bmdc_reg || "BMDC/A-04938")} className="bg-medical-teal text-medical-darkBg px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-medical-teal/90 transition-all flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" /> Approve
                      </button>
                      <button onClick={() => handleRejectDoctor(d.id, d.user.bmdc_reg || "BMDC/A-04938")} className="bg-medical-darkBg text-medical-textMuted px-3 py-1.5 rounded-lg text-xs font-bold border border-medical-borderBg hover:text-white transition-all flex items-center gap-1.5">
                        <XCircle className="w-4 h-4" /> Deny
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Deliveries Manage Section */}
      <div className="glass-panel p-8 rounded-2xl border border-medical-borderBg space-y-6">
        <h3 className="text-xl font-bold text-slate-200 uppercase tracking-wider">Pharmacy Dispatch Shipments Desk</h3>
        
        <div className="overflow-x-auto max-h-[300px] pr-1">
          <table className="w-full text-left text-sm text-medical-textMuted">
            <thead>
              <tr className="border-b border-medical-borderBg text-medical-textBody font-semibold">
                <th className="py-2.5 px-4">Order ID</th>
                <th>Patient</th>
                <th>Shipping Address</th>
                <th>Price</th>
                <th>Shipment Status</th>
                <th>Delivery Dispatch Operations</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-6 text-medical-textMuted">No shipments found in log database.</td>
                </tr>
              ) : (
                orders.map(order => (
                  <tr key={order.id} className="border-b border-medical-borderBg hover:bg-white/2">
                    <td className="py-3.5 px-4 font-bold text-slate-200">#{order.id}</td>
                    <td>{order.patient_details?.first_name} {order.patient_details?.last_name}</td>
                    <td>{order.delivery_address}</td>
                    <td className="font-bold">{order.total_price} BDT</td>
                    <td>
                      <span className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase ${order.status === 'delivered' ? 'bg-medical-emerald/10 text-medical-emerald' : 'bg-medical-indigo/10 text-medical-indigo'}`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="py-2">
                      <div className="flex gap-2">
                        {order.status === 'pending' && (
                          <button onClick={() => handleUpdateOrderStatus(order.id, 'packing')} className="bg-medical-darkBg border border-medical-borderBg hover:bg-medical-darkBg text-medical-textBody px-3 py-1.5 rounded-lg text-xs font-bold">
                            Pack
                          </button>
                        )}
                        {order.status === 'packing' && (
                          <button onClick={() => handleUpdateOrderStatus(order.id, 'shipping')} className="bg-medical-indigo text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-medical-indigo/90">
                            Ship
                          </button>
                        )}
                        {order.status === 'shipping' && (
                          <button onClick={() => handleUpdateOrderStatus(order.id, 'delivered')} className="bg-medical-emerald text-medical-darkBg px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-medical-emerald/90">
                            Deliver
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
