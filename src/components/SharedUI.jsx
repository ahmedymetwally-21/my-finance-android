import React from 'react';
import {
  AlertCircle,
  Briefcase,
  Car,
  CheckCircle2,
  Coins,
  Gift,
  Heart,
  Home,
  MoreHorizontal,
  Plane,
  Receipt,
  RefreshCw,
  Repeat,
  ShoppingBag,
  ShoppingCart,
  User,
  Utensils,
  Wallet,
  X
} from 'lucide-react';

export const ICON_MAP = {
  Home,
  ShoppingCart,
  Utensils,
  Car,
  ShoppingBag,
  Receipt,
  Plane,
  Repeat,
  Heart,
  User,
  MoreHorizontal,
  Briefcase,
  RefreshCw,
  Gift,
  Wallet,
  Coins
};

export const ICON_NAMES = Object.keys(ICON_MAP);

export async function shareOrDownloadFile({
  content,
  fileName,
  mimeType,
  title,
  text,
  preferShare = false,
  onFeedback
}) {
  const blob = new Blob([content], { type: mimeType });
  const file = typeof File !== 'undefined' ? new File([blob], fileName, { type: mimeType }) : null;

  if (preferShare && navigator.share) {
    try {
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: title || fileName,
          text: text || 'Financial backup file',
          files: [file]
        });
        if (onFeedback) onFeedback('Shared via Android Share Sheet');
        return;
      } else {
        await navigator.share({
          title: title || fileName,
          text: `${text || fileName}\n\n${content.slice(0, 3500)}`
        });
        if (onFeedback) onFeedback('Shared summary via Android');
        return;
      }
    } catch (err) {
      if (err && err.name === 'AbortError') return;
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  if (onFeedback) onFeedback(`Saved ${fileName}`);
}

export async function shareTextSummary({ title, text, onFeedback }) {
  if (navigator.share) {
    try {
      await navigator.share({ title, text });
      if (onFeedback) onFeedback('Shared via Android');
      return;
    } catch (err) {
      if (err && err.name === 'AbortError') return;
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    if (onFeedback) onFeedback('Copied WhatsApp-ready summary to clipboard');
  } catch {
    if (onFeedback) onFeedback('Unable to copy summary', 'error');
  }
}

export const CategoryIcon = ({ iconName, color, size = 18 }) => {
  const IconComp = ICON_MAP[iconName] || Receipt;
  return (
    <div
      className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border"
      style={{
        backgroundColor: `${color}15`,
        borderColor: `${color}30`,
        color
      }}
    >
      <IconComp size={size} />
    </div>
  );
};

export const CurrencyFilterPills = ({ value, onChange }) => {
  const options = [
    { id: 'ALL', label: 'All (Separate)' },
    { id: 'AED', label: 'AED Only' },
    { id: 'EGP', label: 'EGP Only' }
  ];
  return (
    <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200/80 shrink-0 select-none">
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          className={`min-h-[40px] px-3.5 py-2 text-xs font-bold rounded-lg transition-all touch-manipulation active:scale-[0.97] ${
            value === opt.id
              ? 'bg-white text-indigo-700 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
};

export const ToastNotification = ({ toast, onClose }) => {
  if (!toast) return null;
  const isError = toast.type === 'error';
  return (
    <div className="fixed top-[calc(4.25rem+env(safe-area-inset-top))] left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-md pointer-events-auto">
      <div
        role="status"
        className={`flex items-center justify-between gap-3 px-4 py-3.5 rounded-2xl shadow-xl border ${
          isError
            ? 'bg-rose-950 text-rose-50 border-rose-800'
            : 'bg-slate-900 text-white border-slate-700'
        }`}
      >
        <div className="flex items-center gap-2.5 text-sm font-medium">
          {isError ? (
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss notification"
          className="text-slate-400 hover:text-white min-w-[36px] min-h-[36px] flex items-center justify-center touch-manipulation"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
};
