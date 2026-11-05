import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Check, Clock, Minus, Search, X } from 'lucide-react';

// Shared building blocks for the admin dashboard. Fixed colors on purpose: the admin
// screens don't follow the public site's theme.
//   page bg #f6f3ee · card #fff · border #e8e2d8 · ink #2b2830 · muted #6f6a75 · brand #6c5d84

export const cx = (...c) => c.filter(Boolean).join(' ');

// RSVP status: color is never the only cue — every use pairs it with an icon + label.
// Attending/Declined colors were checked for color-blind separation and contrast.
export const STATUS = {
  yes: { label: 'Attending', short: 'Yes', icon: Check, fg: '#11704f', bg: '#e2f3ec', bar: '#168a6a' },
  no: { label: 'Declined', short: 'No', icon: X, fg: '#a3401f', bg: '#fbe8e1', bar: '#d4583a' },
  pending: { label: 'Awaiting reply', short: 'Waiting', icon: Clock, fg: '#6b6459', bg: '#eeeae3', bar: '#cbc3b6' },
  not_invited: { label: 'Not invited', short: '—', icon: Minus, fg: '#a39d94', bg: 'transparent', bar: 'transparent' },
};

export function Card({ className, children, ...props }) {
  return <div className={cx('bg-white rounded-xl border border-[#e8e2d8] shadow-[0_1px_2px_rgba(43,40,48,0.04)]', className)} {...props}>{children}</div>;
}

export function Button({ variant = 'secondary', size = 'md', className, children, ...props }) {
  const v = {
    primary: 'bg-[#6c5d84] text-white hover:bg-[#5b4e71] shadow-sm',
    secondary: 'bg-white text-[#2b2830] border border-[#e0d9cd] hover:bg-[#f6f3ee]',
    ghost: 'text-[#4b4652] hover:bg-[#efeae2]',
    danger: 'bg-white text-[#a3401f] border border-[#efcfc4] hover:bg-[#fbe8e1]',
  }[variant];
  const s = size === 'sm' ? 'h-8 px-2.5 text-xs gap-1.5' : 'h-9 px-3.5 text-sm gap-2';
  return (
    <button type="button" className={cx('inline-flex items-center justify-center rounded-lg font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap', v, s, className)} {...props}>
      {children}
    </button>
  );
}

export function IconButton({ label, className, children, ...props }) {
  return (
    <button type="button" title={label} aria-label={label}
      className={cx('inline-flex items-center justify-center w-8 h-8 rounded-lg text-[#6f6a75] hover:bg-[#efeae2] hover:text-[#2b2830] disabled:opacity-30 disabled:pointer-events-none', className)} {...props}>
      {children}
    </button>
  );
}

export const inputCls = 'w-full h-9 rounded-lg border border-[#e0d9cd] bg-white px-3 text-sm text-[#2b2830] placeholder:text-[#a39d94] outline-none focus:border-[#6c5d84] focus:ring-2 focus:ring-[#6c5d84]/15';

export function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-[#4b4652] mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-[#8b8590] mt-1">{hint}</span>}
    </label>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Search…', className }) {
  return (
    <div className={cx('relative', className)}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#a39d94]" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={cx(inputCls, 'pl-9 pr-8')} />
      {value && (
        <button type="button" onClick={() => onChange('')} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[#a39d94] hover:text-[#2b2830]">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

export function StatusPill({ status, compact = false }) {
  const s = STATUS[status];
  const Icon = s.icon;
  if (status === 'not_invited') return <span className="text-xs text-[#a39d94]">{compact ? '—' : s.label}</span>;
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap" style={{ color: s.fg, background: s.bg }}>
      <Icon className="w-3 h-3" strokeWidth={2.5} /> {compact ? s.short : s.label}
    </span>
  );
}

// A status pill that is also a dropdown for changing the status.
export function StatusSelect({ status, onChange, disabled }) {
  const s = STATUS[status];
  const Icon = s.icon;
  return (
    <label className={cx('relative inline-flex items-center gap-1 rounded-full pl-2 pr-2 py-0.5 text-xs font-medium cursor-pointer whitespace-nowrap',
      status === 'not_invited' ? 'border border-dashed border-[#ddd6ca] hover:border-[#bdb5a8]' : 'hover:brightness-95')}
      style={{ color: s.fg, background: s.bg }}>
      <Icon className="w-3 h-3" strokeWidth={2.5} /> {s.short === '—' ? 'Not invited' : s.short}
      <select value={status} disabled={disabled} onChange={(e) => onChange(e.target.value)} aria-label="RSVP status"
        className="absolute inset-0 opacity-0 cursor-pointer">
        <option value="yes">Attending</option>
        <option value="no">Declined</option>
        <option value="pending">Awaiting reply</option>
        <option value="not_invited">Not invited</option>
      </select>
    </label>
  );
}

export function Modal({ title, description, onClose, children, footer, wide = false }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[300] bg-[#2b2830]/40 backdrop-blur-[2px] flex items-end sm:items-center justify-center sm:p-4" onMouseDown={onClose}>
      <div className={cx('bg-white w-full sm:rounded-2xl rounded-t-2xl shadow-2xl max-h-[92vh] flex flex-col', wide ? 'sm:max-w-2xl' : 'sm:max-w-md')} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-3">
          <div>
            <h2 className="text-base font-semibold text-[#2b2830]">{title}</h2>
            {description && <p className="text-sm text-[#6f6a75] mt-0.5">{description}</p>}
          </div>
          <IconButton label="Close" onClick={onClose}><X className="w-4 h-4" /></IconButton>
        </div>
        <div className="px-5 pb-5 overflow-y-auto">{children}</div>
        {footer && <div className="px-5 py-3.5 border-t border-[#efeae2] flex items-center justify-end gap-2 bg-[#fbfaf7] sm:rounded-b-2xl">{footer}</div>}
      </div>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, children }) {
  return (
    <div className="text-center py-14 px-6">
      {Icon && <Icon className="w-8 h-8 mx-auto text-[#cbc3b6] mb-3" />}
      <p className="text-sm font-medium text-[#2b2830]">{title}</p>
      {children && <div className="text-sm text-[#6f6a75] mt-1">{children}</div>}
    </div>
  );
}

export function PageHeader({ title, description, actions }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-6">
      <div>
        <h1 className="text-xl font-semibold text-[#2b2830] tracking-tight">{title}</h1>
        {description && <p className="text-sm text-[#6f6a75] mt-1">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

// ---- toasts: short confirmations / errors in the corner
const ToastContext = createContext(() => {});
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((message, tone = 'success') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'error' ? 7000 : 3500);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="fixed bottom-4 right-4 left-4 sm:left-auto z-[400] flex flex-col gap-2 items-end pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} role="status" className={cx('pointer-events-auto max-w-sm rounded-lg px-4 py-2.5 text-sm shadow-lg whitespace-pre-line',
            t.tone === 'error' ? 'bg-[#fbe8e1] text-[#7d3018] border border-[#efcfc4]' : 'bg-[#2b2830] text-white')}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
