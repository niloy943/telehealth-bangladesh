import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from './LanguageContext';
import { useNotifications } from './NotificationCenter';
import { 
  ShieldAlert, UserCheck, AlertTriangle, Eye, ShieldCheck,
  Activity, RefreshCcw, Lock, HardDrive, BarChart2, CheckCircle2, XCircle, Search,
  FileText, Check, Clock, Truck, ShoppingBag, ExternalLink, Users, UserPlus,
  Edit3, Trash2, Key, Shield, UserX, AlertCircle, MoreVertical, LayoutGrid, List,
  ArrowUpDown, Filter, RotateCcw, SlidersHorizontal
} from 'lucide-react';
import {
  Button, Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter,
  StatusBadge, VerifiedBadge, SecurityBadge, PageHeader, SectionHeader,
  EmptyState, LoadingState, ErrorState, Modal
} from './ui';

const API_BASE = import.meta.env.VITE_API_BASE || window.location.origin;

export const AdminDashboard = ({ token, activeTab = 'audit', onTabChange }) => {
  const { t } = useLanguage();
  const { triggerNotification } = useNotifications();

  // Core data states
  const [logs, setLogs] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [orders, setOrders] = useState([]);
  const [blockchainRecords, setBlockchainRecords] = useState([]);

  // Audit tab search & filter
  const [searchAudit, setSearchAudit] = useState('');
  const [auditFilter, setAuditFilter] = useState('all');

  // Doctor tab search, sort, filter & layout state
  const [searchDoctor, setSearchDoctor] = useState('');
  const [doctorViewMode, setDoctorViewMode] = useState('grid'); // 'grid' | 'list'
  const [doctorSortBy, setDoctorSortBy] = useState('newest'); // 'newest' | 'oldest' | 'name_asc' | 'name_desc' | 'fee_asc' | 'fee_desc' | 'experience'
  const [doctorFilterStatus, setDoctorFilterStatus] = useState('all'); // 'all' | 'pending' | 'approved' | 'rejected' | 'deactivated'
  const [doctorFilterSpecialty, setDoctorFilterSpecialty] = useState('all');
  const [docMenuOpen, setDocMenuOpen] = useState(false);
  const docMenuRef = useRef(null);

  const [rejectionReasonMap, setRejectionReasonMap] = useState({});
  const [rejectModalDoc, setRejectModalDoc] = useState(null);

  // Doctor Onboarding (Create)
  const [showOnboardModal, setShowOnboardModal] = useState(false);
  const [onboardForm, setOnboardForm] = useState({
    username: '', password: '', email: '', first_name: '', last_name: '',
    phone: '', bmdc_reg: '', specialty: 'General Physician', hospital: '',
    experience: 1, bio: ''
  });
  const [onboardLoading, setOnboardLoading] = useState(false);
  const [onboardError, setOnboardError] = useState('');

  // Doctor Edit
  const [editModalDoc, setEditModalDoc] = useState(null);
  const [editDocForm, setEditDocForm] = useState({
    first_name: '', last_name: '', email: '', phone: '', bmdc_reg: '',
    specialty: '', hospital: '', experience: 1, bio: '',
    verification_status: 'approved', is_active: true
  });
  const [editDocLoading, setEditDocLoading] = useState(false);
  const [editDocError, setEditDocError] = useState('');
  const [toggleActiveLoadingId, setToggleActiveLoadingId] = useState(null);

  // Doctor Delete
  const [deleteModalDoc, setDeleteModalDoc] = useState(null);
  const [deleteDocLoading, setDeleteDocLoading] = useState(false);

  // Admin / Staff Management search & state
  const [searchStaff, setSearchStaff] = useState('');

  // Admin Create (Super Admin)
  const [showAddAdminModal, setShowAddAdminModal] = useState(false);
  const [addAdminForm, setAddAdminForm] = useState({
    username: '', password: '', email: '', first_name: '', last_name: '',
    phone: '', is_superuser: false, is_staff: true
  });
  const [addAdminLoading, setAddAdminLoading] = useState(false);
  const [addAdminError, setAddAdminError] = useState('');

  // Admin Edit
  const [editModalAdmin, setEditModalAdmin] = useState(null);
  const [editAdminForm, setEditAdminForm] = useState({
    first_name: '', last_name: '', email: '', phone: '',
    is_superuser: false, is_staff: true, is_active: true, password: ''
  });
  const [editAdminLoading, setEditAdminLoading] = useState(false);
  const [editAdminError, setEditAdminError] = useState('');

  // Admin Reset Password
  const [resetPassModalAdmin, setResetPassModalAdmin] = useState(null);
  const [resetPassVal, setResetPassVal] = useState('');
  const [resetPassLoading, setResetPassLoading] = useState(false);
  const [resetPassError, setResetPassError] = useState('');

  // Admin Delete
  const [deleteModalAdmin, setDeleteModalAdmin] = useState(null);
  const [deleteAdminLoading, setDeleteAdminLoading] = useState(false);

  // Local tab sync
  const [adminTab, setAdminTab] = useState(activeTab || 'audit');

  useEffect(() => {
    if (activeTab) setAdminTab(activeTab);
  }, [activeTab]);

  const handleTabSwitch = (tab) => {
    setAdminTab(tab);
    if (onTabChange) onTabChange(tab);
  };

  // Close 3-dot menu on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (docMenuRef.current && !docMenuRef.current.contains(event.target)) {
        setDocMenuOpen(false);
      }
    };
    if (docMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [docMenuOpen]);

  const loadAdminData = async () => {
    try {
      // 1. Audit logs
      const rLogs = await fetch(`${API_BASE}/api/audit-logs/`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const logsData = await rLogs.json();
      setLogs(Array.isArray(logsData) ? logsData : []);

      // 2. Doctors
      const rDocs = await fetch(`${API_BASE}/api/admin/doctors/`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const docsData = await rDocs.json();
      setDoctors(Array.isArray(docsData) ? docsData : []);

      // 3. Admins / Staff
      const rStaff = await fetch(`${API_BASE}/api/admin/staff/`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const staffData = await rStaff.json();
      setStaffList(Array.isArray(staffData) ? staffData : []);

      // 4. Pharmacy Orders
      const rOrders = await fetch(`${API_BASE}/api/orders/`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const ordersData = await rOrders.json();
      setOrders(Array.isArray(ordersData) ? ordersData : []);

      // 5. Blockchain Records
      const rBc = await fetch(`${API_BASE}/api/blockchain/records/`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const bcData = await rBc.json();
      setBlockchainRecords(Array.isArray(bcData) ? bcData : []);
    } catch (err) {
      console.error("Admin data fetch failed: ", err);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, [token]);

  // ==========================================
  // DOCTOR ACTIONS
  // ==========================================

  const handleVerifyDoctor = async (id, bmdc) => {
    try {
      const resp = await fetch(`${API_BASE}/api/admin/doctors/${id}/action/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ action: "approve" })
      });
      if (resp.status === 200) {
        triggerNotification("Doctor KYC Approved", `BMDC Registration #${bmdc} approved successfully.`, "security");
        loadAdminData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRejectDoctorSubmit = async (e) => {
    e.preventDefault();
    if (!rejectModalDoc) return;
    const reason = rejectionReasonMap[rejectModalDoc.id] || "BMDC credentials unverified or documentation mismatch";

    try {
      const resp = await fetch(`${API_BASE}/api/admin/doctors/${rejectModalDoc.id}/action/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ action: "reject", reason })
      });
      if (resp.status === 200) {
        triggerNotification("Doctor KYC Rejected", `BMDC Registration #${rejectModalDoc.user?.bmdc_reg || 'ID'} denied.`, "security");
        setRejectModalDoc(null);
        loadAdminData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleDoctorActive = async (doc) => {
    const isCurrentlyActive = doc.user?.is_active !== false;
    const action = isCurrentlyActive ? 'deactivate' : 'activate';
    setToggleActiveLoadingId(doc.id);
    try {
      const resp = await fetch(`${API_BASE}/api/admin/doctors/${doc.id}/action/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ action })
      });
      const data = await resp.json().catch(() => ({}));
      if (resp.ok) {
        triggerNotification(
          isCurrentlyActive ? "Doctor Suspended" : "Doctor Activated",
          `Dr. ${doc.user?.first_name || doc.user?.username} is now ${isCurrentlyActive ? 'suspended' : 'active'}.`,
          "security"
        );
        // Optimistic update
        setDoctors(prev => prev.map(d => {
          if (d.id === doc.id || d.user?.id === doc.user?.id) {
            return {
              ...d,
              user: {
                ...(d.user || {}),
                is_active: !isCurrentlyActive
              }
            };
          }
          return d;
        }));
        await loadAdminData();
      } else {
        triggerNotification("Action Failed", data.error || "Failed to update doctor status.", "danger");
      }
    } catch (err) {
      console.error(err);
      triggerNotification("Network Error", "Unable to communicate with server.", "danger");
    } finally {
      setToggleActiveLoadingId(null);
    }
  };

  const handleOnboardDoctorSubmit = async (e) => {
    e.preventDefault();
    setOnboardLoading(true);
    setOnboardError('');
    try {
      const resp = await fetch(`${API_BASE}/api/admin/doctors/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(onboardForm)
      });
      const data = await resp.json();
      if (resp.status === 201) {
        triggerNotification("Doctor Account Created", `Dr. ${onboardForm.first_name || onboardForm.username} successfully onboarded.`, "security");
        setShowOnboardModal(false);
        setOnboardForm({
          username: '', password: '', email: '', first_name: '', last_name: '',
          phone: '', bmdc_reg: '', specialty: 'General Physician', hospital: '',
          experience: 1, bio: ''
        });
        loadAdminData();
      } else {
        setOnboardError(data.error || "Failed to onboard doctor.");
      }
    } catch (err) {
      setOnboardError("Network error while creating doctor account.");
    } finally {
      setOnboardLoading(false);
    }
  };

  const openEditDoctor = (doc) => {
    setEditModalDoc(doc);
    setEditDocForm({
      first_name: doc.user?.first_name || '',
      last_name: doc.user?.last_name || '',
      email: doc.user?.email || '',
      phone: doc.user?.phone || '',
      bmdc_reg: doc.user?.bmdc_reg || doc.bmdc_reg || '',
      specialty: doc.specialty || '',
      hospital: doc.hospital || '',
      experience: doc.experience || 1,
      bio: doc.bio || '',
      verification_status: doc.verification_status || 'approved',
      is_active: doc.user?.is_active !== false
    });
    setEditDocError('');
  };

  const handleEditDoctorSubmit = async (e) => {
    e.preventDefault();
    if (!editModalDoc) return;
    setEditDocLoading(true);
    setEditDocError('');
    try {
      const resp = await fetch(`${API_BASE}/api/admin/doctors/${editModalDoc.id}/`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(editDocForm)
      });
      const data = await resp.json();
      if (resp.status === 200) {
        triggerNotification("Doctor Profile Updated", `Dr. ${editDocForm.first_name || editModalDoc.user?.username} updated successfully.`, "security");
        setEditModalDoc(null);
        loadAdminData();
      } else {
        setEditDocError(data.error || "Failed to update doctor profile.");
      }
    } catch (err) {
      setEditDocError("Network error while updating doctor.");
    } finally {
      setEditDocLoading(false);
    }
  };

  const handleDeleteDoctorConfirm = async () => {
    if (!deleteModalDoc) return;
    setDeleteDocLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/api/admin/doctors/${deleteModalDoc.id}/`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (resp.status === 200 || resp.status === 204) {
        triggerNotification("Doctor Account Removed", `Dr. ${deleteModalDoc.user?.first_name || deleteModalDoc.user?.username} deleted.`, "security");
        setDeleteModalDoc(null);
        loadAdminData();
      } else {
        const data = await resp.json();
        alert(data.error || "Failed to delete doctor.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDeleteDocLoading(false);
    }
  };

  // ==========================================
  // ADMIN / STAFF ACTIONS (Super Admin)
  // ==========================================

  const handleAddAdminSubmit = async (e) => {
    e.preventDefault();
    setAddAdminLoading(true);
    setAddAdminError('');
    try {
      const resp = await fetch(`${API_BASE}/api/admin/staff/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(addAdminForm)
      });
      const data = await resp.json();
      if (resp.status === 201) {
        triggerNotification(
          "Admin Account Created",
          `${addAdminForm.is_superuser ? 'Super Admin' : 'Admin'} '${addAdminForm.username}' created successfully.`,
          "security"
        );
        setShowAddAdminModal(false);
        setAddAdminForm({
          username: '', password: '', email: '', first_name: '', last_name: '',
          phone: '', is_superuser: false, is_staff: true
        });
        loadAdminData();
      } else {
        setAddAdminError(data.error || "Failed to create administrator.");
      }
    } catch (err) {
      setAddAdminError("Network error while creating admin account.");
    } finally {
      setAddAdminLoading(false);
    }
  };

  const openEditAdmin = (admin) => {
    setEditModalAdmin(admin);
    setEditAdminForm({
      first_name: admin.first_name || '',
      last_name: admin.last_name || '',
      email: admin.email || '',
      phone: admin.phone || '',
      is_superuser: !!admin.is_superuser,
      is_staff: !!admin.is_staff,
      is_active: admin.is_active !== false,
      password: ''
    });
    setEditAdminError('');
  };

  const handleEditAdminSubmit = async (e) => {
    e.preventDefault();
    if (!editModalAdmin) return;
    setEditAdminLoading(true);
    setEditAdminError('');
    try {
      const resp = await fetch(`${API_BASE}/api/admin/staff/${editModalAdmin.id}/`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(editAdminForm)
      });
      const data = await resp.json();
      if (resp.status === 200) {
        triggerNotification("Admin Profile Updated", `Account '${editModalAdmin.username}' updated.`, "security");
        setEditModalAdmin(null);
        loadAdminData();
      } else {
        setEditAdminError(data.error || "Failed to update administrator profile.");
      }
    } catch (err) {
      setEditAdminError("Network error while updating administrator.");
    } finally {
      setEditAdminLoading(false);
    }
  };

  const handleToggleAdminActive = async (admin) => {
    const isCurrentlyActive = admin.is_active !== false;
    const action = isCurrentlyActive ? 'deactivate' : 'activate';
    try {
      const resp = await fetch(`${API_BASE}/api/admin/staff/${admin.id}/action/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ action })
      });
      const data = await resp.json();
      if (resp.status === 200) {
        triggerNotification(
          isCurrentlyActive ? "Admin Deactivated" : "Admin Activated",
          `Admin '${admin.username}' is now ${isCurrentlyActive ? 'deactivated' : 'active'}.`,
          "security"
        );
        loadAdminData();
      } else {
        alert(data.error || "Failed to toggle admin status.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleResetAdminPasswordSubmit = async (e) => {
    e.preventDefault();
    if (!resetPassModalAdmin || !resetPassVal) return;
    setResetPassLoading(true);
    setResetPassError('');
    try {
      const resp = await fetch(`${API_BASE}/api/admin/staff/${resetPassModalAdmin.id}/action/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ action: "reset_password", new_password: resetPassVal })
      });
      const data = await resp.json();
      if (resp.status === 200) {
        triggerNotification("Password Reset Successful", `Password updated for '${resetPassModalAdmin.username}'.`, "security");
        setResetPassModalAdmin(null);
        setResetPassVal('');
      } else {
        setResetPassError(data.error || "Failed to reset password.");
      }
    } catch (err) {
      setResetPassError("Network error while resetting password.");
    } finally {
      setResetPassLoading(false);
    }
  };

  const handleDeleteAdminConfirm = async () => {
    if (!deleteModalAdmin) return;
    setDeleteAdminLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/api/admin/staff/${deleteModalAdmin.id}/`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      const data = await resp.json();
      if (resp.status === 200 || resp.status === 204) {
        triggerNotification("Administrator Removed", `Admin account '${deleteModalAdmin.username}' deleted.`, "security");
        setDeleteModalAdmin(null);
        loadAdminData();
      } else {
        alert(data.error || "Failed to delete administrator.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDeleteAdminLoading(false);
    }
  };

  // ==========================================
  // PHARMACY ORDERS ACTION
  // ==========================================
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
        triggerNotification("Courier Status Updated", `Order #${id} marked as ${statusVal.toUpperCase()}.`, "billing");
        loadAdminData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // ==========================================
  // FILTERING & SORTING LOGIC
  // ==========================================

  const filteredLogs = (Array.isArray(logs) ? logs : []).filter(log => {
    const matchesSearch = (log.details || '').toLowerCase().includes(searchAudit.toLowerCase()) ||
                          (log.user_details?.username || '').toLowerCase().includes(searchAudit.toLowerCase());
    const matchesFilter = auditFilter === 'all' || 
                          (auditFilter === 'decrypt' && (log.action || '').includes('DECRYPT')) ||
                          (auditFilter === 'kyc' && (log.action || '').includes('KYC')) ||
                          (auditFilter === 'admin' && (log.action || '').includes('ADMIN')) ||
                          (auditFilter === 'auth' && ((log.action || '').includes('LOGIN') || (log.action || '').includes('LOGOUT')));
    return matchesSearch && matchesFilter;
  });

  // Extract unique specialties from doctors
  const uniqueSpecialties = Array.from(
    new Set((Array.isArray(doctors) ? doctors : []).map(d => d.specialty).filter(Boolean))
  );

  const filteredAndSortedDoctors = (Array.isArray(doctors) ? doctors : [])
    .filter(doc => {
      const q = searchDoctor.toLowerCase().trim();
      const matchesSearch = !q ||
        (doc.user?.first_name || '').toLowerCase().includes(q) ||
        (doc.user?.last_name || '').toLowerCase().includes(q) ||
        (doc.user?.username || '').toLowerCase().includes(q) ||
        (doc.user?.email || '').toLowerCase().includes(q) ||
        (doc.user?.phone || '').toLowerCase().includes(q) ||
        (doc.user?.bmdc_reg || doc.bmdc_reg || '').toLowerCase().includes(q) ||
        (doc.specialty || '').toLowerCase().includes(q) ||
        (doc.hospital || '').toLowerCase().includes(q);

      let matchesStatus = true;
      if (doctorFilterStatus === 'pending') matchesStatus = doc.verification_status === 'pending';
      else if (doctorFilterStatus === 'approved') matchesStatus = doc.verification_status === 'approved' && doc.user?.is_active !== false;
      else if (doctorFilterStatus === 'rejected') matchesStatus = doc.verification_status === 'rejected';
      else if (doctorFilterStatus === 'deactivated') matchesStatus = doc.user?.is_active === false;

      let matchesSpecialty = true;
      if (doctorFilterSpecialty !== 'all') {
        matchesSpecialty = doc.specialty === doctorFilterSpecialty;
      }

      return matchesSearch && matchesStatus && matchesSpecialty;
    })
    .sort((a, b) => {
      if (doctorSortBy === 'newest') {
        return (new Date(b.user?.date_joined || b.id) - new Date(a.user?.date_joined || a.id)) || (b.id - a.id);
      }
      if (doctorSortBy === 'oldest') {
        return (new Date(a.user?.date_joined || a.id) - new Date(b.user?.date_joined || b.id)) || (a.id - b.id);
      }
      if (doctorSortBy === 'name_asc') {
        const nameA = `${a.user?.first_name || a.user?.username || ''}`.toLowerCase();
        const nameB = `${b.user?.first_name || b.user?.username || ''}`.toLowerCase();
        return nameA.localeCompare(nameB);
      }
      if (doctorSortBy === 'name_desc') {
        const nameA = `${a.user?.first_name || a.user?.username || ''}`.toLowerCase();
        const nameB = `${b.user?.first_name || b.user?.username || ''}`.toLowerCase();
        return nameB.localeCompare(nameA);
      }
      if (doctorSortBy === 'experience') {
        return (parseInt(b.experience) || 0) - (parseInt(a.experience) || 0);
      }
      return 0;
    });

  const filteredStaff = (Array.isArray(staffList) ? staffList : []).filter(staff => {
    const q = searchStaff.toLowerCase().trim();
    if (!q) return true;
    return (
      (staff.username || '').toLowerCase().includes(q) ||
      (staff.first_name || '').toLowerCase().includes(q) ||
      (staff.last_name || '').toLowerCase().includes(q) ||
      (staff.email || '').toLowerCase().includes(q) ||
      (staff.phone || '').toLowerCase().includes(q)
    );
  });

  const pendingDocCount = doctors.filter(d => d.verification_status === 'pending').length;

  const isDoctorFilterActive = doctorSortBy !== 'newest' || doctorFilterStatus !== 'all' || doctorFilterSpecialty !== 'all';

  const resetDoctorFilters = () => {
    setDoctorSortBy('newest');
    setDoctorFilterStatus('all');
    setDoctorFilterSpecialty('all');
    setSearchDoctor('');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

      {/* 1. Header & Navigation Pills */}
      <div className="bg-white border border-[#BDDDFA] rounded-2xl p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider block mb-1">
              National Medical Administration &amp; Governance
            </span>
            <h1 className="text-lg font-bold text-[#0F172A] tracking-tight">
              Security &amp; Executive Console
            </h1>
            <p className="text-sm text-[#55647C] mt-0.5">
              Comprehensive role administration, physician KYC license verification, audit trail, and dispatch.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadAdminData} icon={RefreshCcw}>
              Refresh Data
            </Button>
          </div>
        </div>
      </div>

      {/* 2. Top Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#E7F0FC] border border-[#BDDDFA] p-4 rounded-xl">
          <span className="text-[10px] font-bold text-[#55647C] uppercase tracking-wider">Audited Records</span>
          <p className="text-xl font-bold text-[#0F172A] mt-1">{logs.length}</p>
          <span className="text-[10px] text-[#168CF5] font-semibold mt-1 block">National Ledger Tracked</span>
        </div>
        <div className="bg-[#E7F0FC] border border-[#BDDDFA] p-4 rounded-xl">
          <span className="text-[10px] font-bold text-[#55647C] uppercase tracking-wider">Registered Doctors</span>
          <p className="text-xl font-bold text-[#0F172A] mt-1">{doctors.length}</p>
          <span className="text-[10px] text-[#059669] font-semibold mt-1 block">Physician Directory</span>
        </div>
        <div className="bg-[#E7F0FC] border border-[#BDDDFA] p-4 rounded-xl">
          <span className="text-[10px] font-bold text-[#55647C] uppercase tracking-wider">Pending KYC Approvals</span>
          <p className="text-xl font-bold text-[#0F172A] mt-1">{pendingDocCount}</p>
          <span className="text-[10px] text-[#55647C] font-semibold mt-1 block">License Verification</span>
        </div>
        <div className="bg-[#E7F0FC] border border-[#BDDDFA] p-4 rounded-xl">
          <span className="text-[10px] font-bold text-[#55647C] uppercase tracking-wider">System Administrators</span>
          <p className="text-xl font-bold text-[#0F172A] mt-1">{staffList.length}</p>
          <span className="text-[10px] text-[#059669] font-semibold mt-1 block">Super Admin Active</span>
        </div>
      </div>

      {/* ─── TAB 1: SECURITY & AUDIT ─── */}
      {adminTab === 'audit' && (
        <div className="space-y-6">
          {/* Audit Logs Table (Full Width) */}
          <Card className="w-full">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle>Cryptographic Audit Trail</CardTitle>
                  <CardDescription>Real-time security log of authentication, role updates, KYC, and clinical room events.</CardDescription>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {['all', 'admin', 'kyc', 'decrypt', 'auth'].map(f => (
                    <button
                      key={f}
                      onClick={() => setAuditFilter(f)}
                      className={`px-3 py-1 rounded-[10px] text-xs font-semibold uppercase border ${
                        auditFilter === f
                          ? 'bg-[#E7F0FC] border-[#059669] text-[#059669]'
                          : 'bg-white border-[#BDDDFA] text-[#55647C] hover:text-[#0F172A]'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-3">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Search className="w-3.5 h-3.5 text-[#4B5563]" />
                </div>
                <input
                  type="text"
                  value={searchAudit}
                  onChange={e => setSearchAudit(e.target.value)}
                  placeholder="Search audit trail by username or detail narrative..."
                  className="w-full pl-10 pr-3 py-2 bg-[#E7F0FC] rounded-[15px] text-xs text-[#111827] placeholder-[#4B5563] outline-none"
                  style={{ paddingLeft: '2.5rem' }}
                />
              </div>

              <div className="overflow-x-auto max-h-96 overflow-y-auto pr-1">
                <table className="w-full text-left text-xs text-[#334155]">
                  <thead>
                    <tr className="border-b border-[#BDDDFA] text-[#0F172A] font-bold">
                      <th className="py-2.5 px-2">Timestamp</th>
                      <th className="px-2">User</th>
                      <th className="px-2">Action</th>
                      <th className="px-2">IP Address</th>
                      <th className="px-2">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#BDDDFA]/40">
                    {filteredLogs.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="py-8 text-center text-[#55647C]">No logs found matching filter.</td>
                      </tr>
                    ) : (
                      filteredLogs.map(log => (
                        <tr key={log.id} className="hover:bg-[#E7F0FC]">
                          <td className="py-2.5 px-2 font-mono text-[11px] text-[#55647C]">
                            {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </td>
                          <td className="px-2 font-bold text-[#0F172A]">
                            {log.user_details?.username || "System"}
                          </td>
                          <td className="px-2">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              log.action?.includes("DELETE") || log.action?.includes("BLOCK") || log.action?.includes("REJECT")
                                ? "bg-red-50 text-[#FF7A7A] border border-[#FF7A7A]/30"
                                : log.action?.includes("SUPERADMIN") || log.action?.includes("CREATE")
                                ? "bg-emerald-50 text-[#059669] border border-[#059669]/30"
                                : "bg-[#E7F0FC] text-[#168CF5] border border-[#BDDDFA]"
                            }`}>
                              {log.action}
                            </span>
                          </td>
                          <td className="px-2 font-mono text-[11px] text-[#55647C]">{log.ip_address || "127.0.0.1"}</td>
                          <td className="px-2 max-w-xs truncate text-[#334155]" title={log.details}>{log.details}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Blockchain Record Integrity Ledger */}
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle>Ethereum Blockchain Record Integrity Ledger</CardTitle>
                  <CardDescription>Anchored cryptographic SHA-256 validation on Ethereum Sepolia testnet.</CardDescription>
                </div>
                <VerifiedBadge text="Ethereum Sepolia: Active" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto max-h-72 overflow-y-auto pr-1">
                <table className="w-full text-left text-xs text-[#334155]">
                  <thead>
                    <tr className="border-b border-[#BDDDFA] text-[#0F172A] font-bold">
                      <th className="py-2.5 px-3">Block #</th>
                      <th>Record Type</th>
                      <th>Target ID</th>
                      <th>Data Hash (SHA-256)</th>
                      <th>On-Chain Status</th>
                      <th>Transaction</th>
                      <th>Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#BDDDFA]/40">
                    {blockchainRecords.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="py-8 text-center text-[#55647C]">No blockchain records anchored yet.</td>
                      </tr>
                    ) : (
                      blockchainRecords.map(b => (
                        <tr key={b.id} className="hover:bg-[#E7F0FC]">
                          <td className="py-3 px-3 font-mono font-bold text-[#168CF5]">#{b.block_number}</td>
                          <td className="font-bold text-[#0F172A] capitalize">{b.record_type}</td>
                          <td>Record #{b.record_id}</td>
                          <td className="font-mono text-[11px] text-[#55647C] max-w-xs truncate" title={b.data_hash}>
                            {b.data_hash}
                          </td>
                          <td>
                            <StatusBadge status={b.blockchain_status === 'BLOCKCHAIN_CONFIRMED' ? 'approved' : 'pending'} text={b.blockchain_status} size="sm" />
                          </td>
                          <td className="font-mono text-[11px]">
                            {b.transaction_hash ? (
                              <a
                                href={`https://sepolia.etherscan.io/tx/${b.transaction_hash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[#168CF5] hover:underline flex items-center gap-1"
                              >
                                {b.transaction_hash.substring(0, 8)}... <ExternalLink className="w-3 h-3" />
                              </a>
                            ) : "Local Ledger"}
                          </td>
                          <td className="font-mono text-[11px] text-[#55647C]">{new Date(b.timestamp).toLocaleDateString()}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─── TAB 2: DOCTOR MANAGEMENT & KYC ONBOARDING ─── */}
      {adminTab === 'kyc' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle>Doctor Registry &amp; Verification Center</CardTitle>
                  <CardDescription>
                    Onboard new physicians, audit BMDC medical licenses, update doctor profiles, or manage active access.
                  </CardDescription>
                </div>
                <Button
                  variant="primary"
                  onClick={() => { setOnboardError(''); setShowOnboardModal(true); }}
                  icon={UserPlus}
                >
                  + Add New Doctor
                </Button>
              </div>

              {/* Search Bar with 3-Dot Controls Dropdown beside Search */}
              <div className="flex items-center gap-3 mt-4 pt-4 border-t border-[#BDDDFA]">
                {/* Search input */}
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Search className="w-3.5 h-3.5 text-[#4B5563]" />
                  </div>
                  <input
                    type="text"
                    value={searchDoctor}
                    onChange={e => setSearchDoctor(e.target.value)}
                    placeholder="Search doctors by name, BMDC reg, specialty, hospital, phone, email..."
                    className="w-full pl-10 pr-3 py-2 bg-[#E7F0FC] rounded-[15px] text-xs text-[#111827] placeholder-[#4B5563] outline-none"
                    style={{ paddingLeft: '2.5rem' }}
                  />
                </div>

                {/* Quick Grid / List View Switcher */}
                <div className="flex items-center bg-[#E7F0FC] p-1 rounded-[12px] border border-[#BDDDFA] shrink-0">
                  <button
                    onClick={() => setDoctorViewMode('grid')}
                    className={`p-1.5 rounded-[8px] transition-colors ${
                      doctorViewMode === 'grid'
                        ? 'bg-[#059669] text-white'
                        : 'text-[#55647C] hover:text-[#0F172A]'
                    }`}
                    title="Grid Card View"
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDoctorViewMode('list')}
                    className={`p-1.5 rounded-[8px] transition-colors ${
                      doctorViewMode === 'list'
                        ? 'bg-[#059669] text-white'
                        : 'text-[#55647C] hover:text-[#0F172A]'
                    }`}
                    title="Compact Table / List View"
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>

                {/* 3-Dot Icon & Menu Popover */}
                <div className="relative shrink-0" ref={docMenuRef}>
                  <button
                    onClick={() => setDocMenuOpen(prev => !prev)}
                    className={`p-2.5 rounded-[12px] border transition-colors flex items-center justify-center ${
                      docMenuOpen || isDoctorFilterActive
                        ? 'bg-[#059669] border-[#059669] text-white'
                        : 'bg-[#E7F0FC] border-[#BDDDFA] text-[#0F172A] hover:bg-[#BDDDFA]/60'
                    }`}
                    title="Sort, Filter & Layout Options"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>

                  {/* Dropdown Popover */}
                  {docMenuOpen && (
                    <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl border border-[#BDDDFA] shadow-xl p-4 z-50 space-y-4 text-xs">
                      <div className="flex items-center justify-between pb-2 border-b border-[#BDDDFA]">
                        <span className="font-bold text-[#0F172A] flex items-center gap-1.5">
                          <SlidersHorizontal className="w-3.5 h-3.5 text-[#059669]" />
                          View &amp; Filter Options
                        </span>
                        {isDoctorFilterActive && (
                          <button
                            onClick={resetDoctorFilters}
                            className="text-[11px] font-semibold text-[#FF7A7A] hover:underline flex items-center gap-1"
                          >
                            <RotateCcw className="w-3 h-3" /> Reset
                          </button>
                        )}
                      </div>

                      {/* 1. Layout Selection */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-[#55647C] uppercase tracking-wider block">
                          Display Layout
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => { setDoctorViewMode('grid'); setDocMenuOpen(false); }}
                            className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl border text-xs font-semibold ${
                              doctorViewMode === 'grid'
                                ? 'bg-[#E7F0FC] border-[#059669] text-[#059669]'
                                : 'bg-white border-[#BDDDFA] text-[#55647C] hover:bg-[#E7F0FC]'
                            }`}
                          >
                            <LayoutGrid className="w-3.5 h-3.5" /> Grid Cards
                          </button>
                          <button
                            type="button"
                            onClick={() => { setDoctorViewMode('list'); setDocMenuOpen(false); }}
                            className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl border text-xs font-semibold ${
                              doctorViewMode === 'list'
                                ? 'bg-[#E7F0FC] border-[#059669] text-[#059669]'
                                : 'bg-white border-[#BDDDFA] text-[#55647C] hover:bg-[#E7F0FC]'
                            }`}
                          >
                            <List className="w-3.5 h-3.5" /> Table List
                          </button>
                        </div>
                      </div>

                      {/* 2. Sort Options */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-[#55647C] uppercase tracking-wider block">
                          Sort Physicians By
                        </label>
                        <select
                          value={doctorSortBy}
                          onChange={e => setDoctorSortBy(e.target.value)}
                          className="w-full p-2 bg-[#E7F0FC] rounded-[10px] text-xs text-[#0F172A] border border-[#BDDDFA] outline-none"
                        >
                          <option value="newest">Date Joined (Newest First)</option>
                          <option value="oldest">Date Joined (Oldest First)</option>
                          <option value="name_asc">Doctor Name (A to Z)</option>
                          <option value="name_desc">Doctor Name (Z to A)</option>
                          <option value="experience">Experience (Highest First)</option>
                        </select>
                      </div>

                      {/* 3. Filter by KYC Status */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-[#55647C] uppercase tracking-wider block">
                          Filter by License Status
                        </label>
                        <select
                          value={doctorFilterStatus}
                          onChange={e => setDoctorFilterStatus(e.target.value)}
                          className="w-full p-2 bg-[#E7F0FC] rounded-[10px] text-xs text-[#0F172A] border border-[#BDDDFA] outline-none"
                        >
                          <option value="all">All Verification Statuses ({doctors.length})</option>
                          <option value="pending">Pending KYC Approval ({doctors.filter(d => d.verification_status === 'pending').length})</option>
                          <option value="approved">Approved &amp; Active ({doctors.filter(d => d.verification_status === 'approved' && d.user?.is_active !== false).length})</option>
                          <option value="rejected">Rejected ({doctors.filter(d => d.verification_status === 'rejected').length})</option>
                          <option value="deactivated">Deactivated / Suspended ({doctors.filter(d => d.user?.is_active === false).length})</option>
                        </select>
                      </div>

                      {/* 4. Filter by Specialty */}
                      {uniqueSpecialties.length > 0 && (
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-bold text-[#55647C] uppercase tracking-wider block">
                            Filter by Clinical Specialty
                          </label>
                          <select
                            value={doctorFilterSpecialty}
                            onChange={e => setDoctorFilterSpecialty(e.target.value)}
                            className="w-full p-2 bg-[#E7F0FC] rounded-[10px] text-xs text-[#0F172A] border border-[#BDDDFA] outline-none"
                          >
                            <option value="all">All Specialties</option>
                            {uniqueSpecialties.map(spec => (
                              <option key={spec} value={spec}>{spec}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div className="pt-2 border-t border-[#BDDDFA] flex justify-end">
                        <Button
                          size="sm"
                          variant="primary"
                          className="w-full"
                          onClick={() => setDocMenuOpen(false)}
                        >
                          Apply Options
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Active Filter Indicator Tag */}
              {isDoctorFilterActive && (
                <div className="flex items-center gap-2 mt-2 pt-2">
                  <span className="text-[11px] text-[#55647C]">Active Filter:</span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#E7F0FC] border border-[#BDDDFA] text-[#059669]">
                    Status: {doctorFilterStatus.toUpperCase()} | Sort: {doctorSortBy}
                  </span>
                  <button
                    onClick={resetDoctorFilters}
                    className="text-[11px] text-[#FF7A7A] hover:underline"
                  >
                    Clear Filter
                  </button>
                </div>
              )}
            </CardHeader>

            <CardContent>
              {filteredAndSortedDoctors.length === 0 ? (
                <EmptyState
                  icon={UserCheck}
                  title="No doctors match search or filter"
                  description="Try adjusting your search query, sort order, or verification filters."
                />
              ) : doctorViewMode === 'grid' ? (
                /* ─── GRID CARDS VIEW ─── */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {filteredAndSortedDoctors.map(d => {
                    const status = d.verification_status || 'pending';
                    const isActive = d.user?.is_active !== false;
                    return (
                      <div key={d.id} className="p-5 rounded-2xl border border-[#BDDDFA] bg-white flex flex-col justify-between space-y-4 shadow-sm">
                        <div className="space-y-3">
                          {/* Header with Avatar, Name, Status */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className="w-11 h-11 rounded-full bg-[#E7F0FC] border border-[#BDDDFA] flex items-center justify-center text-[#059669] font-bold text-sm">
                                {d.user?.first_name ? d.user.first_name[0].toUpperCase() : 'Dr'}
                              </div>
                              <div>
                                <h4 className="text-sm font-bold text-[#0F172A] leading-tight">
                                  Dr. {d.user?.first_name || d.user?.username} {d.user?.last_name || ''}
                                </h4>
                                <p className="text-xs text-[#059669] font-semibold mt-0.5">{d.specialty || 'General Practitioner'}</p>
                                <span className="text-[11px] text-[#55647C]">@{d.user?.username}</span>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <StatusBadge status={status} size="sm" />
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                isActive ? 'bg-emerald-50 text-[#059669] border border-[#059669]/20' : 'bg-red-50 text-[#FF7A7A] border border-[#FF7A7A]/30'
                              }`}>
                                {isActive ? 'Active' : 'Deactivated'}
                              </span>
                            </div>
                          </div>

                          {/* Info Card */}
                          <div className="p-3 rounded-xl bg-[#E7F0FC] border border-[#BDDDFA] text-xs space-y-1.5 text-[#334155]">
                            <div className="flex justify-between">
                              <span className="font-semibold text-[#0F172A]">BMDC Reg:</span>
                              <span className="font-mono font-bold text-[#168CF5]">{d.user?.bmdc_reg || d.bmdc_reg || "BMDC/A-00000"}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="font-semibold text-[#0F172A]">Hospital:</span>
                              <span className="truncate max-w-[170px]" title={d.hospital}>{d.hospital || "General Medical College"}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="font-semibold text-[#0F172A]">Experience:</span>
                              <span>{d.experience || 1} Years Experience</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="font-semibold text-[#0F172A]">Registered:</span>
                              <span className="font-mono text-[#55647C]">{d.user?.date_joined ? new Date(d.user.date_joined).toLocaleDateString() : 'Active'}</span>
                            </div>
                            {d.user?.phone && (
                              <div className="flex justify-between">
                                <span className="font-semibold text-[#0F172A]">Phone:</span>
                                <span className="font-mono">{d.user.phone}</span>
                              </div>
                            )}
                            {d.user?.email && (
                              <div className="flex justify-between">
                                <span className="font-semibold text-[#0F172A]">Email:</span>
                                <span className="truncate max-w-[170px]" title={d.user.email}>{d.user.email}</span>
                              </div>
                            )}

                            {d.rejection_reason && (
                              <div className="mt-2 p-2 rounded bg-red-50 border border-[#FF7A7A]/30 text-[11px] text-[#FF7A7A]">
                                <strong>Denial Reason:</strong> {d.rejection_reason}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Action Buttons Toolbar */}
                        <div className="space-y-2 pt-3 border-t border-[#BDDDFA]">
                          {/* Approval Row if pending/rejected */}
                          {status !== 'approved' && (
                            <div className="flex gap-2">
                              <Button
                                variant="danger"
                                size="sm"
                                className="flex-1"
                                onClick={() => setRejectModalDoc(d)}
                              >
                                Deny KYC
                              </Button>
                              <Button
                                variant="primary"
                                size="sm"
                                className="flex-1"
                                onClick={() => handleVerifyDoctor(d.id, d.user?.bmdc_reg || "BMDC/A-00000")}
                                icon={CheckCircle2}
                              >
                                Approve License
                              </Button>
                            </div>
                          )}

                          {/* Secondary Management Row */}
                          <div className="flex items-center justify-between gap-1.5 pt-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditDoctor(d)}
                              icon={Edit3}
                            >
                              Edit Profile
                            </Button>

                            <Button
                              variant={isActive ? "secondary" : "primary"}
                              size="sm"
                              onClick={() => handleToggleDoctorActive(d)}
                              disabled={toggleActiveLoadingId === d.id}
                              className={!isActive ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "border-red-200 text-red-600 hover:bg-red-50"}
                            >
                              {toggleActiveLoadingId === d.id ? 'Updating...' : (isActive ? 'Suspend' : 'Activate')}
                            </Button>

                            <button
                              onClick={() => setDeleteModalDoc(d)}
                              title="Delete doctor permanently"
                              className="p-2 rounded-[10px] text-[#FF7A7A] hover:bg-red-50 border border-transparent hover:border-[#FF7A7A]/30 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* ─── TABLE / LIST VIEW ─── */
                <div className="overflow-x-auto max-h-[600px] overflow-y-auto pr-1">
                  <table className="w-full text-left text-xs text-[#334155]">
                    <thead>
                      <tr className="border-b border-[#BDDDFA] text-[#0F172A] font-bold">
                        <th className="py-3 px-3">Physician</th>
                        <th>BMDC Reg</th>
                        <th>Specialty &amp; Hospital</th>
                        <th>Experience &amp; Joined</th>
                        <th>KYC &amp; Status</th>
                        <th className="text-right px-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#BDDDFA]/40">
                      {filteredAndSortedDoctors.map(d => {
                        const status = d.verification_status || 'pending';
                        const isActive = d.user?.is_active !== false;
                        return (
                          <tr key={d.id} className="hover:bg-[#E7F0FC]">
                            {/* Doctor identity */}
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-[#E7F0FC] border border-[#BDDDFA] flex items-center justify-center text-[#059669] font-bold text-xs">
                                  {d.user?.first_name ? d.user.first_name[0].toUpperCase() : 'Dr'}
                                </div>
                                <div>
                                  <p className="font-bold text-[#0F172A]">
                                    Dr. {d.user?.first_name || d.user?.username} {d.user?.last_name || ''}
                                  </p>
                                  <p className="text-[11px] text-[#55647C]">@{d.user?.username}</p>
                                </div>
                              </div>
                            </td>

                            {/* BMDC Reg */}
                            <td className="font-mono font-bold text-[#168CF5]">
                              {d.user?.bmdc_reg || d.bmdc_reg || "BMDC/A-00000"}
                            </td>

                            {/* Specialty & Hospital */}
                            <td>
                              <p className="font-semibold text-[#059669]">{d.specialty || 'General Practitioner'}</p>
                              <p className="text-[11px] text-[#55647C] truncate max-w-[160px]" title={d.hospital}>
                                {d.hospital || "General Medical College"}
                              </p>
                            </td>

                            {/* Experience & Joined */}
                            <td>
                              <p className="font-bold text-[#0F172A]">{d.experience || 1} Yrs Exp</p>
                              <p className="text-[11px] text-[#55647C] font-mono">
                                {d.user?.date_joined ? new Date(d.user.date_joined).toLocaleDateString() : 'Active'}
                              </p>
                            </td>

                            {/* Status badges */}
                            <td>
                              <div className="flex flex-col items-start gap-1">
                                <StatusBadge status={status} size="sm" />
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                  isActive ? 'bg-emerald-50 text-[#059669] border border-[#059669]/20' : 'bg-red-50 text-[#FF7A7A] border border-[#FF7A7A]/30'
                                }`}>
                                  {isActive ? 'Active' : 'Suspended'}
                                </span>
                              </div>
                            </td>

                            {/* Action Toolbar */}
                            <td className="text-right px-3 py-2">
                              <div className="flex items-center justify-end gap-1.5">
                                {status !== 'approved' && (
                                  <>
                                    <Button
                                      variant="primary"
                                      size="sm"
                                      onClick={() => handleVerifyDoctor(d.id, d.user?.bmdc_reg || "BMDC/A-00000")}
                                      icon={CheckCircle2}
                                    >
                                      Approve
                                    </Button>
                                    <Button
                                      variant="danger"
                                      size="sm"
                                      onClick={() => setRejectModalDoc(d)}
                                    >
                                      Deny
                                    </Button>
                                  </>
                                )}

                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openEditDoctor(d)}
                                  icon={Edit3}
                                >
                                  Edit
                                </Button>

                                <Button
                                  variant={isActive ? "secondary" : "primary"}
                                  size="sm"
                                  onClick={() => handleToggleDoctorActive(d)}
                                  disabled={toggleActiveLoadingId === d.id}
                                  className={!isActive ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "border-red-200 text-red-600 hover:bg-red-50"}
                                >
                                  {toggleActiveLoadingId === d.id ? 'Updating...' : (isActive ? 'Suspend' : 'Activate')}
                                </Button>

                                <button
                                  onClick={() => setDeleteModalDoc(d)}
                                  title="Delete doctor account"
                                  className="p-2 rounded-[10px] text-[#FF7A7A] hover:bg-red-50 border border-transparent hover:border-[#FF7A7A]/30 transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─── TAB 3: ADMIN & STAFF AUTHORITY MANAGEMENT (Super Admin) ─── */}
      {adminTab === 'staff' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle>Administrator &amp; Executive Authority Directory</CardTitle>
                  <CardDescription>
                    Super Admin privilege control: Create administrators, edit staff roles, reset credentials, or revoke privileges.
                  </CardDescription>
                </div>
                <Button
                  variant="primary"
                  onClick={() => { setAddAdminError(''); setShowAddAdminModal(true); }}
                  icon={ShieldCheck}
                >
                  + Add New Administrator
                </Button>
              </div>

              {/* Clean Search Bar */}
              <div className="mt-4 pt-4 border-t border-[#BDDDFA]">
                <div className="relative w-full">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Search className="w-3.5 h-3.5 text-[#4B5563]" />
                  </div>
                  <input
                    type="text"
                    value={searchStaff}
                    onChange={e => setSearchStaff(e.target.value)}
                    placeholder="Search administrators by username, name, email, phone..."
                    className="w-full pl-10 pr-3 py-2 bg-[#E7F0FC] rounded-[15px] text-xs text-[#111827] placeholder-[#4B5563] outline-none"
                    style={{ paddingLeft: '2.5rem' }}
                  />
                </div>
              </div>
            </CardHeader>

            <CardContent>
              {filteredStaff.length === 0 ? (
                <EmptyState
                  icon={Shield}
                  title="No administrators found"
                  description="Adjust search parameters or provision a new administrator."
                />
              ) : (
                <div className="overflow-x-auto max-h-[600px] overflow-y-auto pr-1">
                  <table className="w-full text-left text-xs text-[#334155]">
                    <thead>
                      <tr className="border-b border-[#BDDDFA] text-[#0F172A] font-bold">
                        <th className="py-3 px-3">Administrator</th>
                        <th>Email &amp; Contact</th>
                        <th>Role / Authority</th>
                        <th>Status</th>
                        <th>Created Date</th>
                        <th className="text-right px-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#BDDDFA]/40">
                      {filteredStaff.map(admin => {
                        const isSuper = !!admin.is_superuser;
                        const isActive = admin.is_active !== false;
                        return (
                          <tr key={admin.id} className="hover:bg-[#E7F0FC]">
                            {/* User details */}
                            <td className="py-3.5 px-3">
                              <div className="flex items-center gap-3">
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                                  isSuper ? 'bg-[#0F172A] text-white' : 'bg-[#E7F0FC] border border-[#BDDDFA] text-[#059669]'
                                }`}>
                                  {admin.first_name ? admin.first_name[0].toUpperCase() : admin.username[0].toUpperCase()}
                                </div>
                                <div>
                                  <p className="font-bold text-[#0F172A]">
                                    {admin.first_name || admin.last_name ? `${admin.first_name} ${admin.last_name}`.trim() : admin.username}
                                  </p>
                                  <p className="text-[11px] text-[#55647C] font-mono">@{admin.username}</p>
                                </div>
                              </div>
                            </td>

                            {/* Contact info */}
                            <td>
                              <p className="text-[#0F172A]">{admin.email || "No email"}</p>
                              {admin.phone && <p className="text-[11px] text-[#55647C] font-mono">{admin.phone}</p>}
                            </td>

                            {/* Role Badge */}
                            <td>
                              {isSuper ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#0F172A] text-white">
                                  <Shield className="w-3 h-3 text-[#34D399]" /> Super Admin
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#E7F0FC] text-[#168CF5] border border-[#BDDDFA]">
                                  <ShieldCheck className="w-3 h-3" /> Administrator
                                </span>
                              )}
                            </td>

                            {/* Status */}
                            <td>
                              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                isActive ? 'bg-emerald-50 text-[#059669] border border-[#059669]/30' : 'bg-red-50 text-[#FF7A7A] border border-[#FF7A7A]/30'
                              }`}>
                                {isActive ? 'Active' : 'Deactivated'}
                              </span>
                            </td>

                            {/* Date */}
                            <td className="font-mono text-[11px] text-[#55647C]">
                              {admin.date_joined ? new Date(admin.date_joined).toLocaleDateString() : 'N/A'}
                            </td>

                            {/* Action Buttons */}
                            <td className="text-right px-3 py-2">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openEditAdmin(admin)}
                                  icon={Edit3}
                                >
                                  Edit
                                </Button>

                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => {
                                    setResetPassModalAdmin(admin);
                                    setResetPassVal('');
                                    setResetPassError('');
                                  }}
                                  icon={Key}
                                >
                                  Reset Pass
                                </Button>

                                <Button
                                  variant={isActive ? "secondary" : "primary"}
                                  size="sm"
                                  onClick={() => handleToggleAdminActive(admin)}
                                >
                                  {isActive ? 'Suspend' : 'Activate'}
                                </Button>

                                <button
                                  onClick={() => setDeleteModalAdmin(admin)}
                                  title="Delete administrator account"
                                  className="p-2 rounded-[10px] text-[#FF7A7A] hover:bg-red-50 border border-transparent hover:border-[#FF7A7A]/30 transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─── TAB 4: MEDICINE ORDERS FULFILLMENT ─── */}
      {adminTab === 'pharmacy' && (
        <Card>
          <CardHeader>
            <CardTitle>Pharmacy Courier &amp; Fulfillment Dispatch</CardTitle>
            <CardDescription>Update delivery states for patient prescription orders.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto max-h-96 overflow-y-auto pr-1">
              <table className="w-full text-left text-xs text-[#334155]">
                <thead>
                  <tr className="border-b border-[#BDDDFA] text-[#0F172A] font-bold">
                    <th className="py-2.5 px-3">Order #</th>
                    <th>Patient</th>
                    <th>Delivery Address</th>
                    <th>Payable Amount</th>
                    <th>Transit Status</th>
                    <th>Update Dispatch</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#BDDDFA]/40">
                  {orders.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="py-8 text-center text-[#55647C]">No pharmacy orders on queue.</td>
                    </tr>
                  ) : (
                    orders.map(order => (
                      <tr key={order.id} className="hover:bg-[#E7F0FC]">
                        <td className="py-3 px-3 font-bold text-[#0F172A]">#{order.id}</td>
                        <td>{order.patient_details?.first_name || order.patient_details?.username}</td>
                        <td className="max-w-xs truncate">{order.delivery_address}</td>
                        <td className="font-bold text-[#059669]">৳{order.total_price} BDT</td>
                        <td>
                          <StatusBadge status={order.status === 'delivered' ? 'approved' : order.status === 'cancelled' ? 'rejected' : 'pending'} text={order.status} size="sm" />
                        </td>
                        <td className="py-2">
                          <div className="flex gap-1.5">
                            {order.status === 'pending' && (
                              <Button size="sm" variant="outline" onClick={() => handleUpdateOrderStatus(order.id, 'confirmed')}>
                                Confirm
                              </Button>
                            )}
                            {(order.status === 'confirmed' || order.status === 'pending') && (
                              <Button size="sm" variant="secondary" onClick={() => handleUpdateOrderStatus(order.id, 'packing')}>
                                Pack
                              </Button>
                            )}
                            {order.status === 'packing' && (
                              <Button size="sm" variant="primary" onClick={() => handleUpdateOrderStatus(order.id, 'shipping')}>
                                Ship
                              </Button>
                            )}
                            {order.status === 'shipping' && (
                              <Button size="sm" variant="primary" onClick={() => handleUpdateOrderStatus(order.id, 'out_for_delivery')}>
                                Dispatch
                              </Button>
                            )}
                            {order.status === 'out_for_delivery' && (
                              <Button size="sm" variant="primary" onClick={() => handleUpdateOrderStatus(order.id, 'delivered')}>
                                Delivered
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── MODAL 1: REJECT DOCTOR KYC ─── */}
      <Modal
        isOpen={!!rejectModalDoc}
        onClose={() => setRejectModalDoc(null)}
        title="Reject Doctor KYC Application"
        subtitle={`Dr. ${rejectModalDoc?.user?.first_name || rejectModalDoc?.user?.username}`}
      >
        <form onSubmit={handleRejectDoctorSubmit} className="space-y-4">
          <p className="text-xs text-[#55647C]">
            Specify the audit deficiency for denying this physician's BMDC registration:
          </p>
          <textarea
            rows={3}
            required
            value={rejectionReasonMap[rejectModalDoc?.id] || ''}
            onChange={e => setRejectionReasonMap({ ...rejectionReasonMap, [rejectModalDoc.id]: e.target.value })}
            placeholder="e.g. BMDC Registration number could not be authenticated against the national registry..."
            className="w-full p-3 bg-[#E7F0FC] rounded-[15px] text-xs text-[#111827] placeholder-[#4B5563] outline-none"
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setRejectModalDoc(null)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" type="submit">
              Confirm Rejection
            </Button>
          </div>
        </form>
      </Modal>

      {/* ─── MODAL 2: ONBOARD NEW DOCTOR (CREATE) ─── */}
      <Modal
        isOpen={showOnboardModal}
        onClose={() => setShowOnboardModal(false)}
        title="Onboard Doctor Account"
        subtitle="Provision a verified physician account directly into Telehealth Bangladesh"
      >
        <form onSubmit={handleOnboardDoctorSubmit} className="space-y-4">
          {onboardError && (
            <div className="p-3 rounded-xl bg-red-50 border border-[#FF7A7A] text-xs text-[#FF7A7A] font-semibold">
              {onboardError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">First Name</label>
              <input
                required
                type="text"
                placeholder="Dr. Sarah"
                value={onboardForm.first_name}
                onChange={e => setOnboardForm({ ...onboardForm, first_name: e.target.value })}
                className="w-full p-2.5 bg-[#E7F0FC] rounded-[15px] text-xs text-[#111827] placeholder-[#4B5563] outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">Last Name</label>
              <input
                required
                type="text"
                placeholder="Jenkins"
                value={onboardForm.last_name}
                onChange={e => setOnboardForm({ ...onboardForm, last_name: e.target.value })}
                className="w-full p-2.5 bg-[#E7F0FC] rounded-[15px] text-xs text-[#111827] placeholder-[#4B5563] outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">Username</label>
              <input
                required
                type="text"
                placeholder="sarah_doctor"
                value={onboardForm.username}
                onChange={e => setOnboardForm({ ...onboardForm, username: e.target.value })}
                className="w-full p-2.5 bg-[#E7F0FC] rounded-[15px] text-xs text-[#111827] placeholder-[#4B5563] outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">Initial Password</label>
              <input
                required
                type="password"
                placeholder="SecurePassword123!"
                value={onboardForm.password}
                onChange={e => setOnboardForm({ ...onboardForm, password: e.target.value })}
                className="w-full p-2.5 bg-[#E7F0FC] rounded-[15px] text-xs text-[#111827] placeholder-[#4B5563] outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">Email Address</label>
              <input
                required
                type="email"
                placeholder="doctor@hospital.gov.bd"
                value={onboardForm.email}
                onChange={e => setOnboardForm({ ...onboardForm, email: e.target.value })}
                className="w-full p-2.5 bg-[#E7F0FC] rounded-[15px] text-xs text-[#111827] placeholder-[#4B5563] outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">Phone Number</label>
              <input
                required
                type="tel"
                placeholder="+8801700000002"
                value={onboardForm.phone}
                onChange={e => setOnboardForm({ ...onboardForm, phone: e.target.value })}
                className="w-full p-2.5 bg-[#E7F0FC] rounded-[15px] text-xs text-[#111827] placeholder-[#4B5563] outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">BMDC Registration No.</label>
              <input
                required
                type="text"
                placeholder="BMDC/A-48921"
                value={onboardForm.bmdc_reg}
                onChange={e => setOnboardForm({ ...onboardForm, bmdc_reg: e.target.value })}
                className="w-full p-2.5 bg-[#E7F0FC] rounded-[15px] text-xs text-[#111827] placeholder-[#4B5563] outline-none font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">Clinical Specialty</label>
              <input
                required
                type="text"
                placeholder="Cardiology / Internal Medicine"
                value={onboardForm.specialty}
                onChange={e => setOnboardForm({ ...onboardForm, specialty: e.target.value })}
                className="w-full p-2.5 bg-[#E7F0FC] rounded-[15px] text-xs text-[#111827] placeholder-[#4B5563] outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">Hospital / Affiliation</label>
              <input
                type="text"
                placeholder="Dhaka Medical College Hospital"
                value={onboardForm.hospital}
                onChange={e => setOnboardForm({ ...onboardForm, hospital: e.target.value })}
                className="w-full p-2.5 bg-[#E7F0FC] rounded-[15px] text-xs text-[#111827] placeholder-[#4B5563] outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">Clinical Experience (Years)</label>
              <input
                type="number"
                min="0"
                placeholder="e.g. 8"
                value={onboardForm.experience || ''}
                onChange={e => setOnboardForm({ ...onboardForm, experience: e.target.value })}
                className="w-full p-2.5 bg-[#E7F0FC] rounded-[15px] text-xs text-[#111827] placeholder-[#4B5563] outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#0F172A] mb-1">Professional Bio</label>
            <textarea
              rows={2}
              placeholder="Summary of clinical experience, medical specialties, and academic qualifications..."
              value={onboardForm.bio}
              onChange={e => setOnboardForm({ ...onboardForm, bio: e.target.value })}
              className="w-full p-2.5 bg-[#E7F0FC] rounded-[15px] text-xs text-[#111827] placeholder-[#4B5563] outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#BDDDFA]">
            <Button variant="outline" size="sm" type="button" onClick={() => setShowOnboardModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" disabled={onboardLoading}>
              {onboardLoading ? 'Provisioning...' : 'Provision Doctor Account'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ─── MODAL 3: EDIT DOCTOR PROFILE ─── */}
      <Modal
        isOpen={!!editModalDoc}
        onClose={() => setEditModalDoc(null)}
        title="Edit Doctor Profile"
        subtitle={`Update Dr. ${editModalDoc?.user?.first_name || editModalDoc?.user?.username}'s credentials and details`}
      >
        <form onSubmit={handleEditDoctorSubmit} className="space-y-4">
          {editDocError && (
            <div className="p-3 rounded-xl bg-red-50 border border-[#FF7A7A] text-xs text-[#FF7A7A] font-semibold">
              {editDocError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">First Name</label>
              <input
                required
                type="text"
                value={editDocForm.first_name}
                onChange={e => setEditDocForm({ ...editDocForm, first_name: e.target.value })}
                className="w-full p-2.5 bg-[#E7F0FC] rounded-[15px] text-xs text-[#111827] placeholder-[#4B5563] outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">Last Name</label>
              <input
                required
                type="text"
                value={editDocForm.last_name}
                onChange={e => setEditDocForm({ ...editDocForm, last_name: e.target.value })}
                className="w-full p-2.5 bg-[#E7F0FC] rounded-[15px] text-xs text-[#111827] placeholder-[#4B5563] outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">Email Address</label>
              <input
                required
                type="email"
                value={editDocForm.email}
                onChange={e => setEditDocForm({ ...editDocForm, email: e.target.value })}
                className="w-full p-2.5 bg-[#E7F0FC] rounded-[15px] text-xs text-[#111827] placeholder-[#4B5563] outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">Phone Number</label>
              <input
                type="tel"
                value={editDocForm.phone}
                onChange={e => setEditDocForm({ ...editDocForm, phone: e.target.value })}
                className="w-full p-2.5 bg-[#E7F0FC] rounded-[15px] text-xs text-[#111827] placeholder-[#4B5563] outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">BMDC Registration No.</label>
              <input
                required
                type="text"
                value={editDocForm.bmdc_reg}
                onChange={e => setEditDocForm({ ...editDocForm, bmdc_reg: e.target.value })}
                className="w-full p-2.5 bg-[#E7F0FC] rounded-[15px] text-xs text-[#111827] placeholder-[#4B5563] outline-none font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">Clinical Specialty</label>
              <input
                required
                type="text"
                value={editDocForm.specialty}
                onChange={e => setEditDocForm({ ...editDocForm, specialty: e.target.value })}
                className="w-full p-2.5 bg-[#E7F0FC] rounded-[15px] text-xs text-[#111827] placeholder-[#4B5563] outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">Hospital / Clinic</label>
              <input
                type="text"
                value={editDocForm.hospital}
                onChange={e => setEditDocForm({ ...editDocForm, hospital: e.target.value })}
                className="w-full p-2.5 bg-[#E7F0FC] rounded-[15px] text-xs text-[#111827] placeholder-[#4B5563] outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">Clinical Experience (Years)</label>
              <input
                type="number"
                min="0"
                value={editDocForm.experience || ''}
                onChange={e => setEditDocForm({ ...editDocForm, experience: e.target.value })}
                className="w-full p-2.5 bg-[#E7F0FC] rounded-[15px] text-xs text-[#111827] placeholder-[#4B5563] outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">Verification Status</label>
              <select
                value={editDocForm.verification_status}
                onChange={e => setEditDocForm({ ...editDocForm, verification_status: e.target.value })}
                className="w-full p-2.5 bg-[#E7F0FC] rounded-[15px] text-xs text-[#111827] outline-none"
              >
                <option value="approved">Approved</option>
                <option value="pending">Pending</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">Account State</label>
              <select
                value={editDocForm.is_active ? 'true' : 'false'}
                onChange={e => setEditDocForm({ ...editDocForm, is_active: e.target.value === 'true' })}
                className="w-full p-2.5 bg-[#E7F0FC] rounded-[15px] text-xs text-[#111827] outline-none"
              >
                <option value="true">Active (Can log in)</option>
                <option value="false">Suspended / Inactive</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#0F172A] mb-1">Bio / Qualifications</label>
            <textarea
              rows={2}
              value={editDocForm.bio}
              onChange={e => setEditDocForm({ ...editDocForm, bio: e.target.value })}
              className="w-full p-2.5 bg-[#E7F0FC] rounded-[15px] text-xs text-[#111827] placeholder-[#4B5563] outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#BDDDFA]">
            <Button variant="outline" size="sm" type="button" onClick={() => setEditModalDoc(null)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" disabled={editDocLoading}>
              {editDocLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ─── MODAL 4: DELETE DOCTOR CONFIRMATION ─── */}
      <Modal
        isOpen={!!deleteModalDoc}
        onClose={() => setDeleteModalDoc(null)}
        title="Remove Doctor Account"
        subtitle={`Dr. ${deleteModalDoc?.user?.first_name || deleteModalDoc?.user?.username} (${deleteModalDoc?.user?.bmdc_reg || deleteModalDoc?.bmdc_reg || 'ID'})`}
      >
        <div className="space-y-4">
          <div className="p-3 rounded-xl bg-red-50 border border-[#FF7A7A]/40 flex items-start gap-3 text-xs text-[#FF7A7A]">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Permanent Deletion Warning</p>
              <p className="mt-0.5 text-[#334155]">
                Deleting this doctor will permanently purge their account credentials, clinical profile, and access permissions.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#BDDDFA]">
            <Button variant="outline" size="sm" onClick={() => setDeleteModalDoc(null)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={handleDeleteDoctorConfirm} disabled={deleteDocLoading}>
              {deleteDocLoading ? 'Deleting...' : 'Confirm Delete Doctor'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ─── MODAL 5: CREATE ADMINISTRATOR (SUPER ADMIN) ─── */}
      <Modal
        isOpen={showAddAdminModal}
        onClose={() => setShowAddAdminModal(false)}
        title="Provision Administrator Account"
        subtitle="Create an executive or administrative management profile"
      >
        <form onSubmit={handleAddAdminSubmit} className="space-y-4">
          {addAdminError && (
            <div className="p-3 rounded-xl bg-red-50 border border-[#FF7A7A] text-xs text-[#FF7A7A] font-semibold">
              {addAdminError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">First Name</label>
              <input
                required
                type="text"
                placeholder="Rahim"
                value={addAdminForm.first_name}
                onChange={e => setAddAdminForm({ ...addAdminForm, first_name: e.target.value })}
                className="w-full p-2.5 bg-[#E7F0FC] rounded-[15px] text-xs text-[#111827] placeholder-[#4B5563] outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">Last Name</label>
              <input
                required
                type="text"
                placeholder="Chowdhury"
                value={addAdminForm.last_name}
                onChange={e => setAddAdminForm({ ...addAdminForm, last_name: e.target.value })}
                className="w-full p-2.5 bg-[#E7F0FC] rounded-[15px] text-xs text-[#111827] placeholder-[#4B5563] outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">Username</label>
              <input
                required
                type="text"
                placeholder="admin_rahim"
                value={addAdminForm.username}
                onChange={e => setAddAdminForm({ ...addAdminForm, username: e.target.value })}
                className="w-full p-2.5 bg-[#E7F0FC] rounded-[15px] text-xs text-[#111827] placeholder-[#4B5563] outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">Password</label>
              <input
                required
                type="password"
                placeholder="Min 6 characters"
                value={addAdminForm.password}
                onChange={e => setAddAdminForm({ ...addAdminForm, password: e.target.value })}
                className="w-full p-2.5 bg-[#E7F0FC] rounded-[15px] text-xs text-[#111827] placeholder-[#4B5563] outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">Email Address</label>
              <input
                required
                type="email"
                placeholder="admin@healnsight.com.bd"
                value={addAdminForm.email}
                onChange={e => setAddAdminForm({ ...addAdminForm, email: e.target.value })}
                className="w-full p-2.5 bg-[#E7F0FC] rounded-[15px] text-xs text-[#111827] placeholder-[#4B5563] outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">Phone Number</label>
              <input
                type="tel"
                placeholder="+8801700000000"
                value={addAdminForm.phone}
                onChange={e => setAddAdminForm({ ...addAdminForm, phone: e.target.value })}
                className="w-full p-2.5 bg-[#E7F0FC] rounded-[15px] text-xs text-[#111827] placeholder-[#4B5563] outline-none"
              />
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#E7F0FC] border border-[#BDDDFA] space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-[#0F172A]">Super Administrator Privileges</p>
                <p className="text-[11px] text-[#55647C]">Grant full governance to manage other admins, audit trails, and server keys.</p>
              </div>
              <input
                type="checkbox"
                checked={addAdminForm.is_superuser}
                onChange={e => setAddAdminForm({ ...addAdminForm, is_superuser: e.target.checked })}
                className="w-4 h-4 accent-[#059669] cursor-pointer"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#BDDDFA]">
            <Button variant="outline" size="sm" type="button" onClick={() => setShowAddAdminModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" disabled={addAdminLoading}>
              {addAdminLoading ? 'Creating...' : 'Create Admin Account'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ─── MODAL 6: EDIT ADMINISTRATOR PROFILE ─── */}
      <Modal
        isOpen={!!editModalAdmin}
        onClose={() => setEditModalAdmin(null)}
        title="Edit Administrator Profile"
        subtitle={`Managing administrative account: @${editModalAdmin?.username}`}
      >
        <form onSubmit={handleEditAdminSubmit} className="space-y-4">
          {editAdminError && (
            <div className="p-3 rounded-xl bg-red-50 border border-[#FF7A7A] text-xs text-[#FF7A7A] font-semibold">
              {editAdminError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">First Name</label>
              <input
                required
                type="text"
                value={editAdminForm.first_name}
                onChange={e => setEditAdminForm({ ...editAdminForm, first_name: e.target.value })}
                className="w-full p-2.5 bg-[#E7F0FC] rounded-[15px] text-xs text-[#111827] placeholder-[#4B5563] outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">Last Name</label>
              <input
                required
                type="text"
                value={editAdminForm.last_name}
                onChange={e => setEditAdminForm({ ...editAdminForm, last_name: e.target.value })}
                className="w-full p-2.5 bg-[#E7F0FC] rounded-[15px] text-xs text-[#111827] placeholder-[#4B5563] outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">Email Address</label>
              <input
                required
                type="email"
                value={editAdminForm.email}
                onChange={e => setEditAdminForm({ ...editAdminForm, email: e.target.value })}
                className="w-full p-2.5 bg-[#E7F0FC] rounded-[15px] text-xs text-[#111827] placeholder-[#4B5563] outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">Phone Number</label>
              <input
                type="tel"
                value={editAdminForm.phone}
                onChange={e => setEditAdminForm({ ...editAdminForm, phone: e.target.value })}
                className="w-full p-2.5 bg-[#E7F0FC] rounded-[15px] text-xs text-[#111827] placeholder-[#4B5563] outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">Role Authority</label>
              <select
                value={editAdminForm.is_superuser ? 'true' : 'false'}
                onChange={e => setEditAdminForm({ ...editAdminForm, is_superuser: e.target.value === 'true' })}
                className="w-full p-2.5 bg-[#E7F0FC] rounded-[15px] text-xs text-[#111827] outline-none"
              >
                <option value="true">Super Administrator</option>
                <option value="false">Standard Administrator</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">Account State</label>
              <select
                value={editAdminForm.is_active ? 'true' : 'false'}
                onChange={e => setEditAdminForm({ ...editAdminForm, is_active: e.target.value === 'true' })}
                className="w-full p-2.5 bg-[#E7F0FC] rounded-[15px] text-xs text-[#111827] outline-none"
              >
                <option value="true">Active (Can log in)</option>
                <option value="false">Deactivated / Suspended</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#0F172A] mb-1">Change Password (Leave blank to keep current)</label>
            <input
              type="password"
              placeholder="Enter new password (optional)"
              value={editAdminForm.password}
              onChange={e => setEditAdminForm({ ...editAdminForm, password: e.target.value })}
              className="w-full p-2.5 bg-[#E7F0FC] rounded-[15px] text-xs text-[#111827] placeholder-[#4B5563] outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#BDDDFA]">
            <Button variant="outline" size="sm" type="button" onClick={() => setEditModalAdmin(null)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" disabled={editAdminLoading}>
              {editAdminLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ─── MODAL 7: RESET ADMIN PASSWORD ─── */}
      <Modal
        isOpen={!!resetPassModalAdmin}
        onClose={() => setResetPassModalAdmin(null)}
        title="Reset Administrator Password"
        subtitle={`Account: @${resetPassModalAdmin?.username}`}
      >
        <form onSubmit={handleResetAdminPasswordSubmit} className="space-y-4">
          {resetPassError && (
            <div className="p-3 rounded-xl bg-red-50 border border-[#FF7A7A] text-xs text-[#FF7A7A] font-semibold">
              {resetPassError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#0F172A] mb-1">New Secure Password</label>
            <input
              required
              type="password"
              placeholder="Min 6 characters"
              value={resetPassVal}
              onChange={e => setResetPassVal(e.target.value)}
              className="w-full p-2.5 bg-[#E7F0FC] rounded-[15px] text-xs text-[#111827] placeholder-[#4B5563] outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#BDDDFA]">
            <Button variant="outline" size="sm" type="button" onClick={() => setResetPassModalAdmin(null)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" disabled={resetPassLoading}>
              {resetPassLoading ? 'Updating...' : 'Update Password'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ─── MODAL 8: DELETE ADMIN CONFIRMATION ─── */}
      <Modal
        isOpen={!!deleteModalAdmin}
        onClose={() => setDeleteModalAdmin(null)}
        title="Delete Administrator Account"
        subtitle={`Account: @${deleteModalAdmin?.username}`}
      >
        <div className="space-y-4">
          <div className="p-3 rounded-xl bg-red-50 border border-[#FF7A7A]/40 flex items-start gap-3 text-xs text-[#FF7A7A]">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Permanent Removal Warning</p>
              <p className="mt-0.5 text-[#334155]">
                Are you sure you want to permanently delete administrator <strong>@{deleteModalAdmin?.username}</strong>? This action is irreversibly logged in the security audit trail.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#BDDDFA]">
            <Button variant="outline" size="sm" onClick={() => setDeleteModalAdmin(null)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={handleDeleteAdminConfirm} disabled={deleteAdminLoading}>
              {deleteAdminLoading ? 'Deleting...' : 'Confirm Delete Admin'}
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  );
};

export default AdminDashboard;
