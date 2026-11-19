import React, { useMemo, useState } from 'react';
import { CalendarClock, Check, Edit3, Plus, Repeat, Trash2 } from 'lucide-react';
import { CategoryIcon } from './SharedUI.jsx';
import {
  DEFAULT_CURRENCIES,
  formatMoney,
  getCurrencyAccent,
  getCurrencyCodes,
  getDueStatus,
  getEffectiveShares,
  round2
} from '../utils/financeEngine.js';

const FREQUENCY_LABELS = {
  once: 'One-time',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly'
};

export default function UpcomingSection({
  upcomingTransactions,
  currencies = DEFAULT_CURRENCIES,
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
    const codes = getCurrencyCodes(currencies, sorted);
    return codes
      .map((cur, idx) => {
        const items = sorted.filter((u) => u.currency === cur);
        const income = round2(
          items.filter((u) => u.type === 'income').reduce((a, u) => a + u.amount, 0)
        );
        const expense = round2(
          items.filter((u) => u.type === 'expense').reduce((a, u) => a + u.amount, 0)
        );
        return { cur, income, expense, accent: getCurrencyAccent(cur, idx) };
      })
      .filter((row) => row.income > 0 || row.expense > 0);
  }, [sorted, currencies]);

  const visibleItems = compact ? sorted.slice(0, 4) : sorted;

  const badgeClass = (tone) => {
    if (tone === 'overdue')
      return 'bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800';
    if (tone === 'today')
      return 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800';
    if (tone === 'soon')
      return 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800';
    return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700';
  };

  return (
    <div className="bg-white dark:bg-[#0f172a] rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-2xs overflow-hidden">
      <div className="px-4 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/60 shrink-0">
            <CalendarClock size={18} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white truncate">
                Upcoming / Planned
              </h3>
              <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                {sorted.length}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Excluded from cash &amp; debt balances until confirmed &amp; posted
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onAddUpcoming}
          className="min-h-[40px] px-3 py-1.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800 text-xs font-extrabold flex items-center gap-1 shrink-0 touch-manipulation active:scale-95"
        >
          <Plus size={15} />
          <span>Schedule</span>
        </button>
      </div>

      {plannedTotals.length > 0 && (
        <div className="px-4 py-2.5 bg-slate-50/80 dark:bg-slate-900/60 border-b border-slate-100 dark:border-slate-800 flex flex-wrap gap-2 text-[11px]">
          {plannedTotals.map(({ cur, income, expense }) => (
            <div
              key={cur}
              className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 tabular-nums"
            >
              <span className="font-extrabold text-indigo-700 dark:text-emerald-400">
                Planned {cur}:
              </span>
              {income > 0 && (
                <span className="font-bold text-emerald-700 dark:text-emerald-400">
                  +{formatMoney(income, cur)}
                </span>
              )}
              {expense > 0 && (
                <span className="font-bold text-rose-700 dark:text-rose-400">
                  -{formatMoney(expense, cur)}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {sorted.length === 0 ? (
        <div className="p-6 text-center space-y-2">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            No upcoming bills or expected income scheduled.
          </p>
          <button
            type="button"
            onClick={onAddUpcoming}
            className="min-h-[40px] inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-slate-900 dark:bg-slate-800 text-white text-xs font-extrabold touch-manipulation active:scale-95"
          >
            <Plus size={14} /> Schedule Income or Expense
          </button>
        </div>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
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
                        <h4 className="text-sm font-extrabold text-slate-900 dark:text-white truncate">
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
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-50 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800">
                            <Repeat size={10} />
                            {FREQUENCY_LABELS[item.frequency] || item.frequency}
                          </span>
                        )}
                        {item.isShared && (
                          <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800">
                            Shared
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Due:{' '}
                        <strong className="text-slate-700 dark:text-slate-200">
                          {item.dueDate}
                        </strong>{' '}
                        · {cat.name}
                        {!isIncome && ` · Paid by ${payer.name}`}
                      </p>

                      {!isIncome && item.isShared && Object.keys(shares).length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {Object.entries(shares).map(([pid, amt]) => (
                            <span
                              key={pid}
                              className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 text-slate-600 dark:text-slate-300 tabular-nums"
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
                      className={`text-sm sm:text-base font-extrabold tabular-nums ${
                        isIncome
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-slate-900 dark:text-white'
                      }`}
                    >
                      {isIncome ? '+' : '-'}
                      {formatMoney(item.amount, item.currency)}
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onEditUpcoming(item)}
                      aria-label={`Edit upcoming ${item.description}`}
                      className="min-h-[38px] px-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1 touch-manipulation"
                    >
                      <Edit3 size={14} />
                      <span>Edit</span>
                    </button>

                    {confirmDeleteId === item.id ? (
                      <div className="flex items-center gap-1 bg-rose-50 dark:bg-rose-950/60 px-2 py-1 rounded-xl border border-rose-200 dark:border-rose-800">
                        <button
                          type="button"
                          onClick={() => {
                            onDeleteUpcoming(item.id);
                            setConfirmDeleteId(null);
                          }}
                          className="min-h-[30px] px-1.5 text-xs font-extrabold text-rose-700 dark:text-rose-300 touch-manipulation"
                        >
                          Delete
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="min-h-[30px] px-1 text-xs text-slate-600 dark:text-slate-300 touch-manipulation"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(item.id)}
                        aria-label={`Delete upcoming ${item.description}`}
                        className="min-h-[38px] px-2.5 rounded-xl text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 flex items-center gap-1 touch-manipulation"
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
