import React, { useMemo, useState } from 'react';
import { CalendarClock, Check, Edit3, Plus, Repeat, Trash2 } from 'lucide-react';
import { CategoryIcon } from './SharedUI.jsx';
import { formatMoney, getDueStatus, getEffectiveShares, round2 } from '../utils/financeEngine.js';

const FREQUENCY_LABELS = {
  once: 'One-time',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly'
};

export default function UpcomingSection({
  upcomingTransactions,
  getCategory,
  getPerson,
  onAddUpcoming,
  onEditUpcoming,
  onDeleteUpcoming,
  onConfirmUpcoming,
  compact = false
}) {
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const sorted = useMemo(() => {
    return (upcomingTransactions || [])
      .slice()
      .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
  }, [upcomingTransactions]);

  const plannedTotals = useMemo(() => {
    const calc = (cur) => {
      const items = sorted.filter((u) => u.currency === cur);
      return {
        income: round2(items.filter((u) => u.type === 'income').reduce((a, u) => a + u.amount, 0)),
        expense: round2(items.filter((u) => u.type === 'expense').reduce((a, u) => a + u.amount, 0))
      };
    };
    return { AED: calc('AED'), EGP: calc('EGP') };
  }, [sorted]);

  const visibleItems = compact ? sorted.slice(0, 4) : sorted;

  const badgeClass = (tone) => {
    if (tone === 'overdue') return 'bg-rose-100 text-rose-800 border-rose-200';
    if (tone === 'today') return 'bg-amber-100 text-amber-800 border-amber-200';
    if (tone === 'soon') return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    return 'bg-slate-100 text-slate-600 border-slate-200';
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs overflow-hidden">
      <div className="px-4 py-3.5 border-b border-slate-100 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 rounded-2xl bg-amber-50 text-amber-600 border border-amber-100 shrink-0">
            <CalendarClock size={18} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-extrabold text-slate-900 truncate">
                Upcoming / Planned
              </h3>
              <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                {sorted.length}
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Excluded from cash &amp; debt balances until confirmed &amp; posted
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onAddUpcoming}
          className="min-h-[40px] px-3 py-1.5 rounded-2xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 text-xs font-extrabold flex items-center gap-1 shrink-0 touch-manipulation active:scale-95"
        >
          <Plus size={15} />
          <span>Schedule</span>
        </button>
      </div>

      {sorted.length > 0 && (
        <div className="px-4 py-2.5 bg-slate-50/80 border-b border-slate-100 flex flex-wrap gap-2 text-[11px]">
          {(plannedTotals.AED.income > 0 || plannedTotals.AED.expense > 0) && (
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-white border border-slate-200/80">
              <span className="font-extrabold text-indigo-700">Planned AED:</span>
              {plannedTotals.AED.income > 0 && (
                <span className="font-bold text-emerald-700">
                  +{formatMoney(plannedTotals.AED.income, 'AED')}
                </span>
              )}
              {plannedTotals.AED.expense > 0 && (
                <span className="font-bold text-rose-700">
                  -{formatMoney(plannedTotals.AED.expense, 'AED')}
                </span>
              )}
            </div>
          )}
          {(plannedTotals.EGP.income > 0 || plannedTotals.EGP.expense > 0) && (
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-white border border-slate-200/80">
              <span className="font-extrabold text-teal-700">Planned EGP:</span>
              {plannedTotals.EGP.income > 0 && (
                <span className="font-bold text-emerald-700">
                  +{formatMoney(plannedTotals.EGP.income, 'EGP')}
                </span>
              )}
              {plannedTotals.EGP.expense > 0 && (
                <span className="font-bold text-rose-700">
                  -{formatMoney(plannedTotals.EGP.expense, 'EGP')}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {sorted.length === 0 ? (
        <div className="p-6 text-center space-y-2">
          <p className="text-xs font-medium text-slate-500">
            No upcoming bills or expected income scheduled.
          </p>
          <button
            type="button"
            onClick={onAddUpcoming}
            className="min-h-[40px] inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-slate-900 text-white text-xs font-extrabold touch-manipulation active:scale-95"
          >
            <Plus size={14} /> Schedule Income or Expense
          </button>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {visibleItems.map((item) => {
            const cat = getCategory(item.categoryId);
            const payer = getPerson(item.paidBy);
            const due = getDueStatus(item.dueDate);
            const isIncome = item.type === 'income';
            const shares = getEffectiveShares(item);

            return (
              <div key={item.id} className="p-4 space-y-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <CategoryIcon iconName={cat.icon} color={cat.color} size={18} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <h4 className="text-sm font-extrabold text-slate-900 truncate">
                          {item.description}
                        </h4>
                        <span
                          className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${badgeClass(
                            due.tone
                          )}`}
                        >
                          {due.label}
                        </span>
                        {item.frequency && item.frequency !== 'once' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200">
                            <Repeat size={10} />
                            {FREQUENCY_LABELS[item.frequency] || item.frequency}
                          </span>
                        )}
                        {item.isShared && (
                          <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/70">
                            Shared
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-500 mt-0.5">
                        Due: <strong className="text-slate-700">{item.dueDate}</strong> · {cat.name}
                        {!isIncome && ` · Paid by ${payer.name}`}
                      </p>

                      {!isIncome && item.isShared && Object.keys(shares).length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {Object.entries(shares).map(([pid, amt]) => (
                            <span
                              key={pid}
                              className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-slate-50 border border-slate-200/80 text-slate-600"
                            >
                              {getPerson(pid).name}: {formatMoney(amt, item.currency)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div
                      className={`text-sm sm:text-base font-extrabold ${
                        isIncome ? 'text-emerald-600' : 'text-slate-900'
                      }`}
                    >
                      {isIncome ? '+' : '-'}
                      {formatMoney(item.amount, item.currency)}
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onEditUpcoming(item)}
                      aria-label={`Edit upcoming ${item.description}`}
                      className="min-h-[38px] px-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 flex items-center gap-1 touch-manipulation"
                    >
                      <Edit3 size={14} />
                      <span>Edit</span>
                    </button>

                    {confirmDeleteId === item.id ? (
                      <div className="flex items-center gap-1 bg-rose-50 px-2 py-1 rounded-xl border border-rose-200">
                        <button
                          type="button"
                          onClick={() => {
                            onDeleteUpcoming(item.id);
                            setConfirmDeleteId(null);
                          }}
                          className="min-h-[30px] px-1.5 text-xs font-extrabold text-rose-700 touch-manipulation"
                        >
                          Delete
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="min-h-[30px] px-1 text-xs text-slate-600 touch-manipulation"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(item.id)}
                        aria-label={`Delete upcoming ${item.description}`}
                        className="min-h-[38px] px-2.5 rounded-xl text-xs font-bold text-slate-500 hover:text-rose-600 hover:bg-rose-50 flex items-center gap-1 touch-manipulation"
                      >
                        <Trash2 size={14} />
                        <span>Delete</span>
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => onConfirmUpcoming(item.id)}
                    aria-label={`Confirm and post ${item.description}`}
                    className="min-h-[40px] px-3.5 py-1.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-2xs touch-manipulation transition"
                  >
                    <Check size={15} />
                    <span>Mark as Paid &amp; Post</span>
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
