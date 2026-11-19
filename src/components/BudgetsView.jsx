import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Divide,
  PieChart,
  SlidersHorizontal,
  Sparkles,
  Wrench
} from 'lucide-react';
import { CategoryIcon } from './SharedUI.jsx';
import {
  DEFAULT_CURRENCIES,
  computeHierarchicalBudgets,
  formatMoney,
  getCurrencyAccent,
  round2,
  splitSectionBudgetEqually
} from '../utils/financeEngine.js';

function statusTone(status) {
  if (status === 'over') {
    return {
      bar: 'bg-rose-500',
      badge:
        'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/70 dark:text-rose-300 dark:border-rose-800/80',
      text: 'text-rose-600 dark:text-rose-400'
    };
  }
  if (status === 'warning') {
    return {
      bar: 'bg-amber-500',
      badge:
        'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800/80',
      text: 'text-amber-600 dark:text-amber-400'
    };
  }
  if (status === 'healthy') {
    return {
      bar: 'bg-emerald-500',
      badge:
        'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800/80',
      text: 'text-emerald-600 dark:text-emerald-400'
    };
  }
  return {
    bar: 'bg-slate-400 dark:bg-slate-600',
    badge:
      'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    text: 'text-slate-500 dark:text-slate-400'
  };
}

export default function BudgetsView({
  sections,
  categories,
  budgets,
  setBudgets,
  periodTransactions,
  periodLabel,
  currencies = DEFAULT_CURRENCIES,
  primaryCurrency = 'AED',
  showToast
}) {
  const validCurrencies = currencies.length > 0 ? currencies : DEFAULT_CURRENCIES;
  const [selectedCurrency, setSelectedCurrency] = useState(() =>
    validCurrencies.some((c) => c.code === primaryCurrency)
      ? primaryCurrency
      : validCurrencies[0].code
  );
  const [collapsedSections, setCollapsedSections] = useState({});

  const activeCurrency = validCurrencies.some((c) => c.code === selectedCurrency)
    ? selectedCurrency
    : validCurrencies[0].code;

  const budgetReport = useMemo(
    () =>
      computeHierarchicalBudgets({
        sections,
        categories,
        budgets,
        periodTransactions,
        currency: activeCurrency
      }),
    [sections, categories, budgets, periodTransactions, activeCurrency]
  );

  const toggleCollapse = (secId) => {
    setCollapsedSections((prev) => ({ ...prev, [secId]: !prev[secId] }));
  };

  const updateSectionBudget = (sectionId, rawValue) => {
    const val = round2(Math.max(0, parseFloat(rawValue) || 0));
    setBudgets((prev) => {
      const curMap = prev?.[activeCurrency] || {};
      const existing = curMap[sectionId] || { sectionBudget: 0, parts: {} };
      return {
        ...prev,
        [activeCurrency]: {
          ...curMap,
          [sectionId]: {
            ...existing,
            sectionBudget: val
          }
        }
      };
    });
  };

  const updatePartBudget = (sectionId, categoryId, rawValue) => {
    const val = round2(Math.max(0, parseFloat(rawValue) || 0));
    setBudgets((prev) => {
      const curMap = prev?.[activeCurrency] || {};
      const existing = curMap[sectionId] || { sectionBudget: 0, parts: {} };
      const nextParts = { ...(existing.parts || {}) };
      if (val > 0) {
        nextParts[categoryId] = val;
      } else {
        delete nextParts[categoryId];
      }
      return {
        ...prev,
        [activeCurrency]: {
          ...curMap,
          [sectionId]: {
            ...existing,
            parts: nextParts
          }
        }
      };
    });
  };

  const handleSplitEqually = (sectionItem) => {
    const catIds = sectionItem.parts.map((p) => p.category.id);
    if (catIds.length === 0) return;
    if (sectionItem.sectionBudget <= 0) {
      if (showToast) {
        showToast(
          `Set a monthly budget for "${sectionItem.section.name}" before splitting equally`,
          'error'
        );
      }
      return;
    }
    const equalParts = splitSectionBudgetEqually(sectionItem.sectionBudget, catIds);
    setBudgets((prev) => {
      const curMap = prev?.[activeCurrency] || {};
      const existing = curMap[sectionItem.section.id] || {
        sectionBudget: sectionItem.sectionBudget,
        parts: {}
      };
      return {
        ...prev,
        [activeCurrency]: {
          ...curMap,
          [sectionItem.section.id]: {
            ...existing,
            sectionBudget: sectionItem.sectionBudget,
            parts: equalParts
          }
        }
      };
    });
    if (showToast) {
      showToast(
        `Split ${formatMoney(sectionItem.sectionBudget, activeCurrency)} equally across ${catIds.length} parts`
      );
    }
  };

  const handleAutoAdjustSectionTotal = (sectionItem) => {
    const nextTotal = sectionItem.allocatedPartsTotal;
    updateSectionBudget(sectionItem.section.id, nextTotal);
    if (showToast) {
      showToast(
        `Updated "${sectionItem.section.name}" total budget to ${formatMoney(
          nextTotal,
          activeCurrency
        )}`
      );
    }
  };

  const overallTone = statusTone(budgetReport.overallStatus);
  const overallBarWidth = Math.min(100, Math.max(0, budgetReport.overallPercentUsed));
  const accent = getCurrencyAccent(activeCurrency);

  return (
    <div data-testid="budgets-view" className="space-y-4">
      {/* Header & Currency Selector */}
      <div className="flex flex-wrap items-start justify-between gap-2.5">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <PieChart size={20} className="text-emerald-600 dark:text-emerald-400" />
            <span>Hierarchical Budgets</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Assign budgets per Section &amp; spread across Parts · {periodLabel} posted spend
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/90 rounded-xl border border-slate-200 dark:border-slate-700 overflow-x-auto no-scrollbar max-w-full select-none">
          {validCurrencies.map((c) => (
            <button
              key={c.code}
              type="button"
              onClick={() => setSelectedCurrency(c.code)}
              className={`min-h-[38px] px-3.5 py-1.5 text-xs font-extrabold rounded-lg transition whitespace-nowrap touch-manipulation active:scale-95 ${
                activeCurrency === c.code
                  ? 'bg-indigo-600 dark:bg-emerald-600 text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {c.code}
            </button>
          ))}
        </div>
      </div>

      {/* Overall Currency Budget Summary Hero */}
      <div className="bg-white dark:bg-[#0f172a] rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-2xs overflow-hidden">
        <div
          className={`px-5 py-4 bg-gradient-to-r ${accent.gradient} text-white flex flex-wrap items-center justify-between gap-3`}
        >
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider opacity-90">
              {activeCurrency} Monthly Budget · {periodLabel}
            </span>
            <div
              data-testid="budgets-overall-summary"
              className="text-2xl font-extrabold tracking-tight tabular-nums mt-0.5"
            >
              {formatMoney(budgetReport.totalSpent, activeCurrency)}{' '}
              <span className="text-sm font-bold opacity-80">
                / {formatMoney(budgetReport.totalBudgeted, activeCurrency)}
              </span>
            </div>
            <p className="text-[11px] opacity-90 mt-0.5 tabular-nums">
              {budgetReport.totalBudgeted > 0
                ? budgetReport.totalRemaining >= 0
                  ? `${formatMoney(budgetReport.totalRemaining, activeCurrency)} remaining in budget`
                  : `Over budget by ${formatMoney(Math.abs(budgetReport.totalRemaining), activeCurrency)}`
                : 'Enter section budgets below to track spending limits'}
            </p>
          </div>

          <div className="flex flex-col items-end gap-1">
            <span className="px-2.5 py-1 rounded-xl bg-white/15 backdrop-blur-xs text-xs font-extrabold tabular-nums">
              {budgetReport.totalBudgeted > 0
                ? `${Math.round(budgetReport.overallPercentUsed)}% Used`
                : 'Not Set'}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-90">
              {budgetReport.overallStatusLabel}
            </span>
          </div>
        </div>

        <div className="p-4 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-600 dark:text-slate-300">
              Overall Spending Progress
            </span>
            <span
              className={`text-[11px] font-extrabold px-2 py-0.5 rounded-lg border ${overallTone.badge}`}
            >
              {budgetReport.overallStatusLabel}
            </span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${overallTone.bar}`}
              style={{ width: `${overallBarWidth}%` }}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
            <span>
              Tracks your share of posted {activeCurrency} expenses (Pending &amp; Upcoming excluded)
            </span>
            <span className="font-bold tabular-nums">
              Parts Allocated: {formatMoney(budgetReport.totalPartsAllocated, activeCurrency)}
            </span>
          </div>
        </div>
      </div>

      {/* Hierarchical Section Cards */}
      <div className="space-y-3.5">
        {budgetReport.sections.length === 0 ? (
          <div className="bg-white dark:bg-[#0f172a] p-8 rounded-3xl border border-slate-200/80 dark:border-slate-800 text-center">
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
              No expense sections available yet. Add sections in Settings to start budgeting.
            </p>
          </div>
        ) : (
          budgetReport.sections.map((secItem) => {
            const tone = statusTone(secItem.status);
            const barWidth = Math.min(100, Math.max(0, secItem.percentUsed));
            const isCollapsed = Boolean(collapsedSections[secItem.section.id]);

            return (
              <section
                key={secItem.section.id}
                data-testid={`budget-section-${secItem.section.id}`}
                className="bg-white dark:bg-[#0f172a] rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-2xs overflow-hidden"
              >
                {/* Section Header & Editable Total Budget */}
                <div className="p-4 space-y-3 border-b border-slate-100 dark:border-slate-800/90">
                  <div className="flex flex-wrap items-start justify-between gap-2.5">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                          {secItem.section.name}
                        </h3>
                        <span
                          className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-lg border ${tone.badge}`}
                        >
                          {secItem.sectionBudget > 0
                            ? `${Math.round(secItem.percentUsed)}% · ${secItem.statusLabel}`
                            : secItem.statusLabel}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                        Spent:{' '}
                        <strong className="text-slate-900 dark:text-slate-100">
                          {formatMoney(secItem.sectionSpent, activeCurrency)}
                        </strong>
                        {secItem.sectionBudget > 0 && (
                          <>
                            {' · '}
                            {secItem.sectionRemaining >= 0 ? (
                              <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                                {formatMoney(secItem.sectionRemaining, activeCurrency)} left
                              </span>
                            ) : (
                              <span className="text-rose-600 dark:text-rose-400 font-bold">
                                Over by {formatMoney(Math.abs(secItem.sectionRemaining), activeCurrency)}
                              </span>
                            )}
                          </>
                        )}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleCollapse(secItem.section.id)}
                      aria-label={`Toggle ${secItem.section.name} parts`}
                      className="min-w-[40px] min-h-[40px] rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center touch-manipulation"
                    >
                      {isCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
                    </button>
                  </div>

                  {/* Section Progress Bar */}
                  <div className="h-2.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${tone.bar}`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>

                  {/* Section Budget Input + Split Equally Action */}
                  <div className="flex flex-wrap items-center gap-2 pt-0.5">
                    <label
                      htmlFor={`sec-budget-${secItem.section.id}`}
                      className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5"
                    >
                      <SlidersHorizontal size={13} className="text-indigo-500 dark:text-emerald-400" />
                      <span>Section Budget ({activeCurrency}):</span>
                    </label>
                    <input
                      id={`sec-budget-${secItem.section.id}`}
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="10"
                      placeholder="0.00"
                      value={secItem.sectionBudget || ''}
                      onChange={(e) => updateSectionBudget(secItem.section.id, e.target.value)}
                      className="w-32 min-h-[40px] px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-extrabold text-slate-900 dark:text-white tabular-nums focus:outline-none focus:border-indigo-500 dark:focus:border-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => handleSplitEqually(secItem)}
                      className="min-h-[40px] px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/80 text-xs font-extrabold flex items-center gap-1.5 touch-manipulation active:scale-95"
                    >
                      <Divide size={13} />
                      <span>Split Equally</span>
                    </button>
                  </div>

                  {/* Allocation Status Strip: Unallocated vs Exact vs Over-Allocated Warning */}
                  {secItem.isOverAllocated ? (
                    <div
                      data-testid={`over-allocated-warning-${secItem.section.id}`}
                      className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/80 flex flex-wrap items-center justify-between gap-2"
                    >
                      <div className="flex items-start gap-2 text-xs text-rose-800 dark:text-rose-200">
                        <AlertTriangle size={15} className="shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
                        <span>
                          <strong>Over-Allocated:</strong> Parts sum to{' '}
                          <strong className="tabular-nums">
                            {formatMoney(secItem.allocatedPartsTotal, activeCurrency)}
                          </strong>{' '}
                          (exceeds section total by{' '}
                          <strong className="tabular-nums">
                            {formatMoney(secItem.overAllocatedBy, activeCurrency)}
                          </strong>
                          ).
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAutoAdjustSectionTotal(secItem)}
                        className="min-h-[36px] px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold flex items-center gap-1.5 touch-manipulation active:scale-95 shrink-0"
                      >
                        <Wrench size={13} />
                        <span>Auto-Adjust Section Total</span>
                      </button>
                    </div>
                  ) : secItem.sectionBudget > 0 && secItem.unallocated > 0.009 ? (
                    <div
                      data-testid={`unallocated-banner-${secItem.section.id}`}
                      className="px-3 py-2 rounded-xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 flex flex-wrap items-center justify-between gap-2 text-xs"
                    >
                      <span className="font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                        <Sparkles size={13} className="text-amber-600 dark:text-amber-400 shrink-0" />
                        <span>
                          Remaining Unallocated:{' '}
                          <strong className="tabular-nums">
                            {formatMoney(secItem.unallocated, activeCurrency)}
                          </strong>
                        </span>
                      </span>
                      <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 tabular-nums">
                        {formatMoney(secItem.allocatedPartsTotal, activeCurrency)} /{' '}
                        {formatMoney(secItem.sectionBudget, activeCurrency)} spread
                      </span>
                    </div>
                  ) : secItem.sectionBudget > 0 ? (
                    <div className="px-3 py-1.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 flex items-center justify-between gap-2 text-xs">
                      <span className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                        <CheckCircle2 size={13} className="shrink-0" />
                        <span>100% of Section Budget Allocated Across Parts</span>
                      </span>
                      <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                        {formatMoney(secItem.allocatedPartsTotal, activeCurrency)}
                      </span>
                    </div>
                  ) : null}
                </div>

                {/* Parts / Sub-categories Allocation Rows */}
                {!isCollapsed && (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800/80 bg-slate-50/40 dark:bg-slate-900/30">
                    {secItem.parts.length === 0 ? (
                      <div className="p-4 text-xs text-slate-500 dark:text-slate-400 text-center">
                        No categories inside this section yet.
                      </div>
                    ) : (
                      secItem.parts.map((part) => {
                        const partTone = statusTone(part.status);
                        const partBarWidth = Math.min(100, Math.max(0, part.percentUsed));

                        return (
                          <div key={part.category.id} className="p-3.5 sm:px-4 space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                <CategoryIcon
                                  iconName={part.category.icon}
                                  color={part.category.color}
                                  size={16}
                                />
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-slate-100 truncate">
                                      {part.category.name}
                                    </span>
                                    <span
                                      className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-md border ${partTone.badge}`}
                                    >
                                      {part.budget > 0
                                        ? `${Math.round(part.percentUsed)}% · ${part.statusLabel}`
                                        : part.statusLabel}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
                                    Spent: <strong>{formatMoney(part.spent, activeCurrency)}</strong>
                                    {part.budget > 0 && (
                                      <>
                                        {' · '}
                                        {part.remaining >= 0 ? (
                                          <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                                            {formatMoney(part.remaining, activeCurrency)} left
                                          </span>
                                        ) : (
                                          <span className="text-rose-600 dark:text-rose-400 font-bold">
                                            Over by {formatMoney(Math.abs(part.remaining), activeCurrency)}
                                          </span>
                                        )}
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  min="0"
                                  step="10"
                                  placeholder="0"
                                  aria-label={`Budget for ${part.category.name}`}
                                  value={part.budget || ''}
                                  onChange={(e) =>
                                    updatePartBudget(
                                      secItem.section.id,
                                      part.category.id,
                                      e.target.value
                                    )
                                  }
                                  className="w-24 min-h-[38px] text-right px-2.5 py-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-extrabold text-slate-900 dark:text-white tabular-nums focus:outline-none focus:border-indigo-500 dark:focus:border-emerald-500"
                                />
                                <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 w-7">
                                  {activeCurrency}
                                </span>
                              </div>
                            </div>

                            {/* Part Progress Bar */}
                            <div className="h-1.5 w-full rounded-full bg-slate-200/80 dark:bg-slate-800 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${partTone.bar}`}
                                style={{ width: `${partBarWidth}%` }}
                              />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}
