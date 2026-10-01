import React, { useEffect } from 'react';
import { CheckCircle2, ShieldCheck, AlertCircle, Loader2, X } from 'lucide-react';

/* ─── 1. Button Primitive ─── */
export const Button = ({
  children,
  variant = 'primary', // 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost' | 'blue'
  size = 'md', // 'sm' | 'md' | 'lg'
  loading = false,
  disabled = false,
  icon: Icon = null,
  iconPosition = 'left',
  className = '',
  onClick,
  type = 'button',
  ...props
}) => {
  const base = "inline-flex items-center justify-center font-semibold rounded-[10px] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed select-none cursor-pointer";

  const variants = {
    primary: "bg-[#059669] hover:bg-[#047857] active:bg-[#065F46] text-white border border-[#059669]",
    blue: "bg-[#168CF5] hover:bg-[#1270C4] active:bg-[#0E589B] text-white border border-[#168CF5]",
    secondary: "bg-[#E7F0FC] hover:bg-[#D3E5F9] text-[#0F172A] border border-[#BDDDFA]",
    outline: "bg-white hover:bg-[#F4F6F9] text-[#0F172A] border border-[#BDDDFA]",
    danger: "bg-[#DC2626] hover:bg-[#B91C1C] text-white border border-[#DC2626]",
    ghost: "bg-transparent hover:bg-[#E7F0FC] text-[#0F172A] border border-transparent"
  };

  const sizes = {
    sm: "text-xs px-3 py-1.5 gap-1.5 min-h-[36px]",
    md: "text-xs font-semibold px-4 py-2 gap-2 min-h-[42px]",
    lg: "text-sm font-semibold px-5 py-2.5 gap-2.5 min-h-[48px]"
  };

  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={`${base} ${variants[variant] || variants.primary} ${sizes[size] || sizes.md} ${className}`}
      {...props}
    >
      {loading && <Loader2 className="w-4 h-4 shrink-0" />}
      {!loading && Icon && iconPosition === 'left' && <Icon className="w-4 h-4 shrink-0" />}
      <span>{children}</span>
      {!loading && Icon && iconPosition === 'right' && <Icon className="w-4 h-4 shrink-0" />}
    </button>
  );
};

/* ─── 2. Card Components ─── */
export const Card = ({ children, className = '', surface = 'white', ...props }) => {
  const bg = surface === 'sky' ? 'bg-[#E7F0FC]' : 'bg-white';
  return (
    <div
      className={`${bg} border border-[#BDDDFA] rounded-2xl ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader = ({ children, className = '' }) => (
  <div className={`p-5 pb-3 border-b border-[#BDDDFA]/60 ${className}`}>
    {children}
  </div>
);

export const CardTitle = ({ children, className = '' }) => (
  <h3 className={`text-base font-bold text-[#0F172A] tracking-tight ${className}`}>
    {children}
  </h3>
);

export const CardDescription = ({ children, className = '' }) => (
  <p className={`text-xs text-[#55647C] mt-0.5 leading-normal ${className}`}>
    {children}
  </p>
);

export const CardContent = ({ children, className = '' }) => (
  <div className={`p-5 text-sm text-[#334155] ${className}`}>
    {children}
  </div>
);

export const CardFooter = ({ children, className = '' }) => (
  <div className={`p-4 px-5 bg-[#F4F6F9] border-t border-[#BDDDFA]/60 rounded-b-2xl ${className}`}>
    {children}
  </div>
);

/* ─── 3. Status & Verified Badges ─── */
export const StatusBadge = ({
  status = 'active',
  label = null,
  size = 'md',
  className = ''
}) => {
  const map = {
    active: { bg: 'bg-[#059669]/10 text-[#059669] border-[#059669]/30', dot: 'bg-[#059669]' },
    approved: { bg: 'bg-[#059669]/10 text-[#059669] border-[#059669]/30', dot: 'bg-[#059669]' },
    completed: { bg: 'bg-[#168CF5]/10 text-[#168CF5] border-[#168CF5]/30', dot: 'bg-[#168CF5]' },
    pending: { bg: 'bg-[#D97706]/10 text-[#D97706] border-[#D97706]/30', dot: 'bg-[#D97706]' },
    cancelled: { bg: 'bg-[#55647C]/10 text-[#55647C] border-[#BDDDFA]', dot: 'bg-[#55647C]' },
    rejected: { bg: 'bg-[#DC2626]/10 text-[#DC2626] border-[#DC2626]/30', dot: 'bg-[#DC2626]' },
    urgent: { bg: 'bg-[#DC2626]/10 text-[#DC2626] border-[#DC2626]/30', dot: 'bg-[#DC2626]' }
  };

  const current = map[status.toLowerCase()] || map.active;
  const displayLabel = label || status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <span className={`inline-flex items-center gap-1.5 font-bold uppercase tracking-wider border rounded-full ${size === 'sm' ? 'text-[9px] px-2 py-0.5' : 'text-[10px] px-2.5 py-1'} ${current.bg} ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${current.dot}`} />
      <span>{displayLabel}</span>
    </span>
  );
};

export const VerifiedBadge = ({ text = "BMDC Verified", className = "" }) => (
  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#059669]/10 text-[#059669] border border-[#059669]/30 text-[10px] font-bold uppercase tracking-wider ${className}`}>
    <CheckCircle2 className="w-3.5 h-3.5 text-[#059669] shrink-0" />
    <span>{text}</span>
  </span>
);

export const SecurityBadge = ({ text = "End-to-End Encrypted", className = "" }) => (
  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#168CF5]/10 text-[#168CF5] border border-[#168CF5]/30 text-[10px] font-bold uppercase tracking-wider ${className}`}>
    <ShieldCheck className="w-3.5 h-3.5 text-[#168CF5] shrink-0" />
    <span>{text}</span>
  </span>
);

/* ─── 4. Header Primitives ─── */
export const PageHeader = ({
  title,
  subtitle = null,
  action = null,
  breadcrumbs = null,
  className = ''
}) => (
  <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#BDDDFA] ${className}`}>
    <div>
      {breadcrumbs && <div className="text-[10px] text-[#94A3B8] uppercase tracking-wider font-semibold mb-1">{breadcrumbs}</div>}
      <h1 className="text-base sm:text-lg font-bold tracking-tight text-[#0F172A]">{title}</h1>
      {subtitle && <p className="text-xs text-[#55647C] mt-0.5">{subtitle}</p>}
    </div>
    {action && <div className="flex items-center gap-2 shrink-0">{action}</div>}
  </div>
);

export const SectionHeader = ({
  title,
  subtitle = null,
  action = null,
  className = ''
}) => (
  <div className={`flex items-center justify-between gap-4 mb-3 ${className}`}>
    <div>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">{title}</h2>
      {subtitle && <p className="text-[11px] text-[#55647C] mt-0.5">{subtitle}</p>}
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);

/* ─── 5. Empty, Loading & Error States ─── */
export const EmptyState = ({
  icon: Icon = AlertCircle,
  title = "No records found",
  description = "There are currently no items to display.",
  action = null,
  className = ''
}) => (
  <div className={`text-center py-10 px-4 rounded-2xl border border-dashed border-[#BDDDFA] bg-[#E7F0FC]/30 max-w-lg mx-auto ${className}`}>
    <div className="w-10 h-10 rounded-full bg-[#E7F0FC] text-[#55647C] flex items-center justify-center mx-auto mb-3 border border-[#BDDDFA]">
      <Icon className="w-5 h-5" />
    </div>
    <h4 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider mb-1">{title}</h4>
    <p className="text-xs text-[#55647C] max-w-sm mx-auto mb-4">{description}</p>
    {action && <div className="inline-flex justify-center">{action}</div>}
  </div>
);

export const LoadingState = ({ count = 3, className = '' }) => (
  <div className={`space-y-3 ${className}`}>
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="h-16 bg-[#E7F0FC] border border-[#BDDDFA] rounded-xl w-full" />
    ))}
  </div>
);

export const ErrorState = ({
  title = "Unable to load data",
  description = "A network error occurred while reaching the server. Please try again.",
  onRetry = null,
  className = ''
}) => (
  <div className={`p-6 rounded-2xl bg-red-50 border border-red-200 text-center max-w-md mx-auto ${className}`}>
    <AlertCircle className="w-7 h-7 text-[#DC2626] mx-auto mb-2" />
    <h4 className="text-xs font-bold text-[#DC2626] uppercase tracking-wider">{title}</h4>
    <p className="text-xs text-[#334155] mt-1 mb-4 leading-relaxed">{description}</p>
    {onRetry && (
      <Button variant="outline" size="sm" onClick={onRetry} className="bg-white text-[#DC2626] border-red-300 hover:bg-red-50">
        Try Again
      </Button>
    )}
  </div>
);

/* ─── 6. Accessible Modal ─── */
export const Modal = ({
  isOpen,
  onClose,
  title,
  subtitle = null,
  children,
  maxWidth = 'max-w-lg',
  className = ''
}) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0F172A]/70">
      <div
        className={`w-full ${maxWidth} bg-white border border-[#BDDDFA] rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh] ${className}`}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-[#BDDDFA]/60 shrink-0 bg-[#F4F6F9]">
          <div>
            <h3 className="text-base font-bold text-[#0F172A]">{title}</h3>
            {subtitle && <p className="text-xs text-[#55647C] mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#94A3B8] hover:text-[#0F172A] rounded-lg hover:bg-[#E7F0FC] cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 bg-white">
          {children}
        </div>
      </div>
    </div>
  );
};
