import React, { useState } from 'react';
import {
  AlertTriangle,
  Check,
  ClipboardPaste,
  Edit3,
  Inbox,
  MessageSquareText,
  ScanSearch,
  Trash2,
  Users
} from 'lucide-react';
import { SAMPLE_BANK_SMS_TEMPLATES } from '../utils/bankSmsParser.js';
import { formatMoney } from '../utils/financeEngine.js';

export default function PendingSection({
  pendingTransactions,
  accounts,
  categories,
  onScanDeviceSms,
  onPasteRawSms,
  onUpdatePendingItem,
  onQuickFinalize,
  onEditAndFinalize,
  onDismissPending,
  compact = false
}) {
  const [pasteOpen, setPasteOpen] = useState(false);
  const [rawSmsText, setRawSmsText] = useState('');
  const [isScanning, setIsScanning] = useState(false);

  const handleScanClick = async () => {
    setIsScanning(true);
    try {
      await onScanDeviceSms();
    } finally {
      setIsScanning(false);
    }
  };

  const handlePasteSubmit = (e) => {
    e.preventDefault();
    if (!rawSmsText.trim()) return;
    const addedCount = onPasteRawSms(rawSmsText);
    if (addedCount > 0) {
      setRawSmsText('');
      setPasteOpen(false);
    }
  };

  const handleInsertSample = (tpl) => {
    const block = `${tpl.sender}\n${tpl.body}`;
    setRawSmsText((prev) => (prev.trim() ? `${prev.trim()}\n\n${block}` : block));
  };

  const visibleItems = compact ? pendingTransactions.slice(0, 4) : pendingTransactions;

  return (
    <div
      data-testid="pending-sms-section"
      className="bg-white rounded-3xl border border-amber-200/90 shadow-2xs overflow-hidden"
    >
      {/* Header */}
      <div className="px-4 py-3.5 bg-gradient-to-r from-amber-50/90 to-orange-50/60 border-b border-amber-200/70 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
            <MessageSquareText size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                Pending Bank SMS Queue
              </h3>
              <span
                data-testid="pending-count-badge"
                className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-amber-600 text-white"
              >
                {pendingTransactions.length}
              </span>
            </div>
            <p className="text-[11px] text-amber-900/80">
              Excluded from Wallet &amp; Monthly Balances until finalized
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleScanClick}
            disabled={isScanning}
            className="min-h-[38px] px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold flex items-center gap-1.5 touch-manipulation active:scale-95"
          >
            <ScanSearch size={14} />
            <span>{isScanning ? 'Scanning...' : 'Scan Recent Bank SMS'}</span>
          </button>
          <button
            type="button"
            onClick={() => setPasteOpen((v) => !v)}
            className={`min-h-[38px] px-3 py-1.5 rounded-xl border text-xs font-extrabold flex items-center gap-1.5 touch-manipulation active:scale-95 ${
              pasteOpen
                ? 'bg-amber-600 text-white border-amber-600'
                : 'bg-white text-slate-700 border-amber-200 hover:bg-amber-50'
            }`}
          >
            <ClipboardPaste size={14} />
            <span>Paste SMS</span>
          </button>
        </div>
      </div>

      {/* Paste Bank SMS Drawer */}
      {pasteOpen && (
        <form
          onSubmit={handlePasteSubmit}
          className="p-4 bg-slate-50 border-b border-slate-200 space-y-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label htmlFor="paste-sms-input" className="text-xs font-extrabold text-slate-800">
              Paste 1 or multiple UAE / Egyptian Bank SMS messages
            </label>
            <span className="text-[11px] font-semibold text-slate-500">
              Separate multiple SMS with a blank line
            </span>
          </div>

          <textarea
            id="paste-sms-input"
            rows={4}
            placeholder={
              'EmiratesNBD\nPurchase of AED 185.50 at CARREFOUR using Card ending 1234 on 18/11/2026.'
            }
            value={rawSmsText}
            onChange={(e) => setRawSmsText(e.target.value)}
            className="w-full p-3 rounded-2xl bg-white border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none focus:border-amber-500"
          />

          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-slate-500 block">
              Quick Test Bank SMS Samples (including OTP rejection &amp; unmatched fallback):
            </span>
            <div className="flex flex-wrap gap-1.5">
              {SAMPLE_BANK_SMS_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.label}
                  type="button"
                  onClick={() => handleInsertSample(tpl)}
                  className="min-h-[32px] px-2.5 py-1 rounded-xl bg-white border border-slate-200 hover:border-amber-400 text-[11px] font-bold text-slate-700"
                >
                  + {tpl.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setPasteOpen(false)}
              className="min-h-[40px] px-3.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-600"
            >
              Close
            </button>
            <button
              type="submit"
              className="min-h-[40px] px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-extrabold"
            >
              Parse &amp; Queue SMS
            </button>
          </div>
        </form>
      )}

      {/* Pending Queue Items */}
      {pendingTransactions.length === 0 ? (
        <div className="p-6 text-center space-y-1.5">
          <Inbox size={26} className="mx-auto text-slate-300" />
          <p className="text-xs font-bold text-slate-600">No pending bank alerts waiting for review.</p>
          <p className="text-[11px] text-slate-400">
            Tap &ldquo;Paste SMS&rdquo; or &ldquo;Scan Recent Bank SMS&rdquo; to import UAE &amp; Egyptian bank alerts.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {visibleItems.map((item) => {
            const curAccounts = accounts.filter((a) => a.currency === item.currency);
            const curCategories = categories.filter((c) => c.type === item.type);
            const isMissingAccount = !item.accountId;
            const isIncome = item.type === 'income';

            return (
              <div key={item.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-slate-900 text-white">
                        {item.bankName || item.sender}
                      </span>
                      <span
                        className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md ${
                          isIncome
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {item.type}
                      </span>
                      {item.detectedLast4 ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                          Card ••{item.detectedLast4}
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
                          No Card Digits
                        </span>
                      )}
                      {item.type === 'expense' && (
                        <button
                          type="button"
                          onClick={() =>
                            onUpdatePendingItem(item.id, { isShared: !item.isShared })
                          }
                          className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border flex items-center gap-1 ${
                            item.isShared
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          <Users size={10} />
                          <span>{item.isShared ? 'Shared' : 'Personal'}</span>
                        </button>
                      )}
                    </div>

                    <h4 className="text-sm font-extrabold text-slate-900 truncate">
                      {item.description}
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      {item.dateTimeLabel || item.date}
                    </p>
                    {item.rawBody && (
                      <p className="text-[11px] text-slate-500 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200/70 line-clamp-2">
                        {item.rawBody}
                      </p>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    <div
                      className={`text-base font-extrabold ${
                        isIncome ? 'text-emerald-700' : 'text-slate-900'
                      }`}
                    >
                      {isIncome ? '+' : '-'}
                      {formatMoney(item.amount, item.currency)}
                    </div>
                  </div>
                </div>

                {/* Account Matcher & Category Controls */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <select
                      aria-label={`Select account for ${item.description}`}
                      value={item.accountId || ''}
                      onChange={(e) =>
                        onUpdatePendingItem(item.id, { accountId: e.target.value })
                      }
                      className={`w-full min-h-[40px] px-3 py-1.5 rounded-xl border text-xs font-extrabold ${
                        isMissingAccount
                          ? 'bg-amber-50 border-amber-400 text-amber-950'
                          : 'bg-slate-50 border-slate-200 text-slate-800'
                      }`}
                    >
                      <option value="">Select Account / Card ({item.currency})...</option>
                      {curAccounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                          {a.last4 ? ` (••${a.last4})` : ''}
                        </option>
                      ))}
                    </select>
                    {isMissingAccount && (
                      <p className="text-[10px] font-bold text-amber-700 mt-1 flex items-center gap-1">
                        <AlertTriangle size={11} />
                        <span>Pick an account manually before finalizing</span>
                      </p>
                    )}
                  </div>

                  <select
                    aria-label={`Select category for ${item.description}`}
                    value={item.categoryId || ''}
                    onChange={(e) =>
                      onUpdatePendingItem(item.id, { categoryId: e.target.value })
                    }
                    className="w-full min-h-[40px] px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800"
                  >
                    {curCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        Category: {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Action Buttons: Quick Finalize | Edit & Finalize | Dismiss */}
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => onQuickFinalize(item)}
                    className="min-h-[40px] px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold flex items-center justify-center gap-1 touch-manipulation active:scale-95"
                  >
                    <Check size={14} />
                    <span>Quick Finalize</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onEditAndFinalize(item)}
                    className="min-h-[40px] px-2.5 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 text-xs font-extrabold flex items-center justify-center gap-1 touch-manipulation active:scale-95"
                  >
                    <Edit3 size={13} />
                    <span>Edit &amp; Finalize</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDismissPending(item.id)}
                    className="min-h-[40px] px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 text-xs font-bold flex items-center justify-center gap-1 touch-manipulation active:scale-95"
                  >
                    <Trash2 size={13} />
                    <span>Dismiss</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
