import React, { useCallback, useMemo, useState } from 'react';
import { AlertCircle, CalendarClock, Repeat, Sparkles, X } from 'lucide-react';
import {
  computeEqualPercentages,
  computeEqualShares,
  computePercentageShares,
  formatCompact,
  formatMoney,
  getDefaultAccountIdForCurrency,
  getTodayStr,
  resolveSharingDefaults,
  round2
} from '../utils/financeEngine.js';

export default function TransactionModal({
  editingTx,
  editingUpcoming,
  editingPending,
  defaults,
  people,
  sections,
  categories,
  accounts = [],
  defaultSharing,
  onClose,
  onSavePosted,
  onSaveUpcoming,
  onFinalizePending
}) {
  const editingItem = editingTx || editingUpcoming || editingPending || null;
  const isEditing = Boolean(editingTx || editingUpcoming);
  const isReviewingPending = Boolean(editingPending);

  const activePeople = useMemo(() => {
    const active = people.filter((p) => !p.archived);
    if (!editingItem) return active;
    // Ensure any archived participant referenced in the edited item remains visible
    const referencedIds = new Set([
      editingItem.paidBy,
      editingItem.belongsTo,
      ...Object.keys(editingItem.shares || {}).filter((k) => (editingItem.shares[k] || 0) > 0)
    ]);
    const extras = people.filter((p) => p.archived && referencedIds.has(p.id));
    return [...active, ...extras];
  }, [people, editingItem]);

  const initialType = editingItem?.type || defaults?.type || 'expense';

  const getCategoriesForType = useCallback(
    (t) => {
      const filtered = categories.filter((c) => c.type === t);
      return filtered.length > 0 ? filtered : categories;
    },
    [categories]
  );

  const initialCategoryId = useMemo(() => {
    if (editingItem?.categoryId) return editingItem.categoryId;
    const list = getCategoriesForType(initialType);
    return list[0]?.id || '';
  }, [editingItem, initialType, getCategoriesForType]);

  const initialResolved = useMemo(() => {
    if (editingItem) {
      const activeIds = activePeople.map((p) => p.id);
      const fromShares = Object.keys(editingItem.shares || {}).filter(
        (id) => (editingItem.shares[id] || 0) > 0 && activeIds.includes(id)
      );
      const fromParticipants = Array.isArray(editingItem.participantIds)
        ? editingItem.participantIds.filter((id) => activeIds.includes(id))
        : [];
      return {
        isShared: Boolean(editingItem.isShared),
        paidBy: editingItem.paidBy || 'me',
        splitMode: editingItem.splitMode || 'equal',
        participantIds:
          fromShares.length > 0
            ? fromShares
            : fromParticipants.length > 0
            ? fromParticipants
            : activeIds,
        appliedCategoryRule: false
      };
    }
    return resolveSharingDefaults(defaultSharing, initialCategoryId, activePeople, {
      forceShared: defaults?.forceShared
    });
  }, [editingItem, defaultSharing, initialCategoryId, activePeople, defaults]);

  const [entryMode, setEntryMode] = useState(() => {
    if (editingUpcoming) return 'upcoming';
    if (editingTx || editingPending) return 'posted';
    return defaults?.mode === 'upcoming' ? 'upcoming' : 'posted';
  });

  const [type, setType] = useState(initialType);
  const [amount, setAmount] = useState(editingItem ? String(editingItem.amount) : '');
  const [currency, setCurrency] = useState(editingItem?.currency || 'AED');
  const [accountId, setAccountId] = useState(() => {
    const initCur = editingItem?.currency || 'AED';
    if (editingPending) {
      return editingPending.accountId || '';
    }
    if (editingItem?.accountId) {
      const exists = accounts.some((a) => a.id === editingItem.accountId && a.currency === initCur);
      if (exists) return editingItem.accountId;
    }
    return getDefaultAccountIdForCurrency(accounts, initCur);
  });
  const [description, setDescription] = useState(editingItem?.description || '');
  const [date, setDate] = useState(
    () => editingItem?.date || editingItem?.dueDate || getTodayStr()
  );
  const [frequency, setFrequency] = useState(editingUpcoming?.frequency || 'once');
  const [notes, setNotes] = useState(
    () => editingItem?.notes || (editingPending ? `Imported from ${editingPending.bankName} SMS` : '')
  );
  const [categoryId, setCategoryId] = useState(initialCategoryId);

  const [isShared, setIsShared] = useState(initialResolved.isShared);
  const [paidBy, setPaidBy] = useState(initialResolved.paidBy);
  const [belongsTo, setBelongsTo] = useState(editingItem?.belongsTo || 'me');
  const [splitMode, setSplitMode] = useState(initialResolved.splitMode);
  const [includedIds, setIncludedIds] = useState(initialResolved.participantIds);

  const [appliedRuleLabel, setAppliedRuleLabel] = useState(() => {
    if (isEditing || isReviewingPending || defaults?.forceShared) return '';
    return initialResolved.appliedCategoryRule ? 'Category Default' : 'Global Default';
  });
  const [hasManualSharingOverride, setHasManualSharingOverride] = useState(
    Boolean(isEditing || isReviewingPending || defaults?.forceShared)
  );

  const [customAmounts, setCustomAmounts] = useState(() => {
    const map = {};
    activePeople.forEach((p) => {
      map[p.id] = editingItem?.shares?.[p.id] ? String(editingItem.shares[p.id]) : '';
    });
    return map;
  });

  const [customPercentages, setCustomPercentages] = useState(() => {
    if (editingItem?.isShared && editingItem.amount > 0 && editingItem.shares) {
      const map = {};
      activePeople.forEach((p) => {
        const share = Number(editingItem.shares[p.id] || 0);
        map[p.id] = share > 0 ? String(round2((share / editingItem.amount) * 100)) : '0';
      });
      return map;
    }
    const equalPcts = computeEqualPercentages(initialResolved.participantIds);
    const map = {};
    activePeople.forEach((p) => {
      map[p.id] = equalPcts[p.id] || '0';
    });
    return map;
  });

  const [formError, setFormError] = useState('');

  const availableCategories = useMemo(
    () => getCategoriesForType(type),
    [getCategoriesForType, type]
  );

  const currencyAccounts = useMemo(
    () => accounts.filter((a) => a.currency === currency),
    [accounts, currency]
  );

  const handleCurrencyChange = (nextCur) => {
    setCurrency(nextCur);
    if (isReviewingPending && !accountId) {
      setAccountId('');
      return;
    }
    setAccountId(getDefaultAccountIdForCurrency(accounts, nextCur));
  };

  const handleTypeSwitch = (nextType) => {
    setType(nextType);
    const nextCats = getCategoriesForType(nextType);
    const nextCatId = nextCats.some((c) => c.id === categoryId)
      ? categoryId
      : nextCats[0]?.id || '';
    setCategoryId(nextCatId);

    if (nextType === 'income') {
      setIsShared(false);
    } else if (!isEditing && !hasManualSharingOverride) {
      const resolved = resolveSharingDefaults(defaultSharing, nextCatId, activePeople, {
        forceShared: defaults?.forceShared
      });
      setIsShared(resolved.isShared);
      setPaidBy(resolved.paidBy);
      setSplitMode(resolved.splitMode);
      setIncludedIds(resolved.participantIds);
      setAppliedRuleLabel(resolved.appliedCategoryRule ? 'Category Default' : 'Global Default');
    }
  };

  const handleCategoryChange = (nextCatId) => {
    setCategoryId(nextCatId);
    if (!isEditing && type === 'expense' && !hasManualSharingOverride) {
      const resolved = resolveSharingDefaults(defaultSharing, nextCatId, activePeople, {
        forceShared: defaults?.forceShared
      });
      setIsShared(resolved.isShared);
      setPaidBy(resolved.paidBy);
      setSplitMode(resolved.splitMode);
      setIncludedIds(resolved.participantIds);
      const eqPcts = computeEqualPercentages(resolved.participantIds);
      const pctMap = {};
      activePeople.forEach((p) => {
        pctMap[p.id] = eqPcts[p.id] || '0';
      });
      setCustomPercentages(pctMap);
      setAppliedRuleLabel(resolved.appliedCategoryRule ? 'Category Default' : 'Global Default');
    }
  };

  const markManualOverride = () => {
    setHasManualSharingOverride(true);
    setAppliedRuleLabel('');
  };

  const numericAmount = round2(parseFloat(amount) || 0);

  const toggleParticipant = (pid) => {
    markManualOverride();
    setIncludedIds((prev) => {
      if (prev.includes(pid)) {
        if (prev.length === 1) return prev;
        return prev.filter((x) => x !== pid);
      }
      return [...prev, pid];
    });
  };

  const handleEqualizePercentages = () => {
    markManualOverride();
    const targetIds = includedIds.length > 0 ? includedIds : activePeople.map((p) => p.id);
    const eq = computeEqualPercentages(targetIds);
    const next = {};
    activePeople.forEach((p) => {
      next[p.id] = eq[p.id] || '0';
    });
    setCustomPercentages(next);
  };

  const computedShares = useMemo(() => {
    if (type !== 'expense' || numericAmount <= 0) {
      return {};
    }
    if (!isShared) {
      return { [belongsTo]: numericAmount };
    }
    if (splitMode === 'equal') {
      return computeEqualShares(numericAmount, includedIds);
    }
    if (splitMode === 'custom') {
      const map = {};
      activePeople.forEach((p) => {
        const val = round2(parseFloat(customAmounts[p.id]) || 0);
        if (val > 0) map[p.id] = val;
      });
      return map;
    }
    return computePercentageShares(
      numericAmount,
      activePeople.map((p) => p.id),
      customPercentages
    );
  }, [
    type,
    numericAmount,
    isShared,
    belongsTo,
    splitMode,
    includedIds,
    activePeople,
    customAmounts,
    customPercentages
  ]);

  const customSum = useMemo(
    () =>
      round2(
        activePeople.reduce((acc, p) => acc + (parseFloat(customAmounts[p.id]) || 0), 0)
      ),
    [activePeople, customAmounts]
  );

  const percentageSum = useMemo(
    () =>
      round2(
        activePeople.reduce((acc, p) => acc + (parseFloat(customPercentages[p.id]) || 0), 0)
      ),
    [activePeople, customPercentages]
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormError('');

    if (numericAmount <= 0) {
      setFormError('Please enter a valid amount greater than 0.');
      return;
    }
    if (!accountId) {
      setFormError(`Please select an Account or Card (${currency}).`);
      return;
    }
    if (!description.trim()) {
      setFormError('Please enter a short description.');
      return;
    }
    if (!date) {
      setFormError('Please choose a valid date.');
      return;
    }

    if (type === 'expense' && isShared) {
      if (splitMode === 'custom') {
        if (Math.abs(customSum - numericAmount) > 0.01) {
          setFormError(
            `Custom split amounts (${formatMoney(customSum, currency)}) must equal total (${formatMoney(
              numericAmount,
              currency
            )}).`
          );
          return;
        }
      }
      if (splitMode === 'percentage') {
        if (Math.abs(percentageSum - 100) > 0.1) {
          setFormError(`Percentages currently sum to ${percentageSum}%. They must equal 100%.`);
          return;
        }
      }
    }

    const basePayload = {
      type,
      amount: numericAmount,
      currency,
      accountId,
      description: description.trim(),
      categoryId,
      notes: notes.trim(),
      isShared: type === 'expense' ? isShared : false,
      paidBy: type === 'expense' ? paidBy : 'me',
      belongsTo: type === 'expense' ? (isShared ? 'shared' : belongsTo) : 'me',
      splitMode: type === 'expense' && isShared ? splitMode : 'equal',
      shares: type === 'expense' ? computedShares : {},
      isDemo: false
    };

    if (editingPending && onFinalizePending) {
      onFinalizePending(
        editingPending.id,
        entryMode === 'upcoming'
          ? { ...basePayload, dueDate: date, frequency }
          : { ...basePayload, date },
        entryMode
      );
      return;
    }

    if (entryMode === 'upcoming') {
      onSaveUpcoming({
        ...basePayload,
        dueDate: date,
        frequency
      });
    } else {
      onSavePosted({
        ...basePayload,
        date
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/65 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isEditing ? 'Edit Transaction' : 'Add Transaction'}
        className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden max-h-[92dvh] flex flex-col"
      >
        <div className="pt-2.5 pb-1 flex justify-center sm:hidden shrink-0">
          <div className="w-10 h-1.5 rounded-full bg-slate-300" />
        </div>

        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between shrink-0">
          <h3 className="text-base font-extrabold text-slate-900">
            {editingPending
              ? 'Review & Finalize Bank SMS'
              : editingUpcoming
              ? 'Edit Scheduled Transaction'
              : editingTx
              ? 'Edit Transaction'
              : entryMode === 'upcoming'
              ? 'Schedule Upcoming Transaction'
              : 'Quick Add Transaction'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="w-11 h-11 flex items-center justify-center rounded-2xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 active:scale-95 touch-manipulation"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-5 space-y-4 overflow-y-auto flex-1">
            {/* Post Now vs Schedule / Upcoming Switcher (when creating new) */}
            {!isEditing && (
              <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-2xl select-none">
                <button
                  type="button"
                  onClick={() => setEntryMode('posted')}
                  className={`min-h-[40px] py-1.5 text-xs font-extrabold rounded-xl transition touch-manipulation ${
                    entryMode === 'posted'
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Post Now (Actual)
                </button>
                <button
                  type="button"
                  onClick={() => setEntryMode('upcoming')}
                  className={`min-h-[40px] py-1.5 text-xs font-extrabold rounded-xl transition flex items-center justify-center gap-1.5 touch-manipulation ${
                    entryMode === 'upcoming'
                      ? 'bg-amber-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <CalendarClock size={14} />
                  <span>Upcoming / Planned</span>
                </button>
              </div>
            )}

            {/* Expense vs Income Switcher */}
            <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-2xl select-none">
              <button
                type="button"
                onClick={() => handleTypeSwitch('expense')}
                className={`min-h-[44px] py-2 text-xs sm:text-sm font-extrabold rounded-xl transition touch-manipulation active:scale-[0.98] ${
                  type === 'expense'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Expense
              </button>
              <button
                type="button"
                onClick={() => handleTypeSwitch('income')}
                className={`min-h-[44px] py-2 text-xs sm:text-sm font-extrabold rounded-xl transition touch-manipulation active:scale-[0.98] ${
                  type === 'income'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Income
              </button>
            </div>

            {/* Amount + Currency Row */}
            <div className="grid grid-cols-3 gap-2.5">
              <div className="col-span-2">
                <label htmlFor="tx-amount" className="text-xs font-bold text-slate-600 block mb-1">
                  Amount
                </label>
                <input
                  id="tx-amount"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  placeholder="0.00"
                  autoFocus
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full min-h-[50px] text-xl font-extrabold px-3.5 py-2.5 rounded-2xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <span className="text-xs font-bold text-slate-600 block mb-1">Currency</span>
                <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-2xl h-[50px] select-none">
                  {['AED', 'EGP'].map((cur) => (
                    <button
                      key={cur}
                      type="button"
                      onClick={() => handleCurrencyChange(cur)}
                      className={`text-xs font-extrabold rounded-xl transition touch-manipulation active:scale-95 ${
                        currency === cur
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {cur}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Account / Card Selector */}
            <div>
              <label htmlFor="tx-account" className="text-xs font-bold text-slate-600 block mb-1">
                Account / Card ({currency})
              </label>
              <select
                id="tx-account"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className={`w-full min-h-[46px] text-sm font-bold px-3 py-2 rounded-2xl border focus:outline-none ${
                  !accountId
                    ? 'bg-amber-50 border-amber-400 text-amber-950 focus:border-amber-600'
                    : 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white focus:border-indigo-500'
                }`}
              >
                <option value="">Select Account / Card...</option>
                {currencyAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name}
                    {acc.last4 ? ` (••${acc.last4})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div>
              <label htmlFor="tx-desc" className="text-xs font-bold text-slate-600 block mb-1">
                Description
              </label>
              <input
                id="tx-desc"
                type="text"
                placeholder={
                  type === 'income'
                    ? 'e.g., Monthly Salary, Client Transfer'
                    : 'e.g., Carrefour Groceries, Dinner, DEWA Bill'
                }
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full min-h-[48px] text-sm font-medium px-3.5 py-2.5 rounded-2xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Category & Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label htmlFor="tx-category" className="text-xs font-bold text-slate-600 block mb-1">
                  {type === 'income' ? 'Income Source / Category' : 'Category'}
                </label>
                <select
                  id="tx-category"
                  value={categoryId}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className="w-full min-h-[48px] text-sm font-semibold px-3 py-2.5 rounded-2xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-indigo-500"
                >
                  {sections.map((sec) => {
                    const secCats = availableCategories.filter((c) => c.sectionId === sec.id);
                    if (secCats.length === 0) return null;
                    return (
                      <optgroup key={sec.id} label={sec.name}>
                        {secCats.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </optgroup>
                    );
                  })}
                </select>
              </div>

              <div>
                <label htmlFor="tx-date" className="text-xs font-bold text-slate-600 block mb-1">
                  {entryMode === 'upcoming' ? 'Due Date' : 'Date'}
                </label>
                <input
                  id="tx-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full min-h-[48px] text-sm font-semibold px-3 py-2.5 rounded-2xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Recurring Frequency for Upcoming Items */}
            {entryMode === 'upcoming' && (
              <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="tx-frequency"
                    className="text-xs font-extrabold text-amber-900 flex items-center gap-1.5"
                  >
                    <Repeat size={14} />
                    <span>Repeat Frequency</span>
                  </label>
                  <span className="text-[11px] font-semibold text-amber-800">
                    Won&apos;t affect balances until posted
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1.5 select-none">
                  {[
                    { id: 'once', label: 'One-time' },
                    { id: 'weekly', label: 'Weekly' },
                    { id: 'monthly', label: 'Monthly' },
                    { id: 'yearly', label: 'Yearly' }
                  ].map((freq) => (
                    <button
                      key={freq.id}
                      type="button"
                      onClick={() => setFrequency(freq.id)}
                      className={`min-h-[40px] px-2 py-1.5 rounded-xl text-xs font-extrabold border transition touch-manipulation ${
                        frequency === freq.id
                          ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                          : 'bg-white text-slate-700 border-amber-200/80'
                      }`}
                    >
                      {freq.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* EXPENSE-ONLY: PERSONAL VS SHARED ENGINE */}
            {type === 'expense' && (
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                      Ownership
                    </span>
                    {appliedRuleLabel && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                        <Sparkles size={10} />
                        {appliedRuleLabel}
                      </span>
                    )}
                  </div>
                  <div className="inline-flex p-1 bg-slate-200/80 rounded-xl select-none">
                    <button
                      type="button"
                      onClick={() => {
                        markManualOverride();
                        setIsShared(false);
                      }}
                      className={`min-h-[40px] px-3 py-1.5 text-xs font-bold rounded-lg transition touch-manipulation ${
                        !isShared ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                      }`}
                    >
                      Personal
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        markManualOverride();
                        setIsShared(true);
                      }}
                      className={`min-h-[40px] px-3 py-1.5 text-xs font-bold rounded-lg transition touch-manipulation ${
                        isShared ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-600'
                      }`}
                    >
                      Shared Split
                    </button>
                  </div>
                </div>

                {/* Who Paid? */}
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1.5">
                    Who Paid for This Expense?
                  </label>
                  <div className="flex flex-wrap gap-2 select-none">
                    {activePeople.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          markManualOverride();
                          setPaidBy(p.id);
                        }}
                        className={`min-h-[44px] py-2 px-3 rounded-xl border text-xs font-extrabold transition touch-manipulation active:scale-95 flex items-center gap-1.5 ${
                          paidBy === p.id
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300'
                        }`}
                      >
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: paidBy === p.id ? '#ffffff' : p.color }}
                        />
                        <span>{p.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Personal: Who Does It Belong To? */}
                {!isShared && (
                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1.5">
                      Who Does This Personal Expense Belong To?
                    </label>
                    <div className="flex flex-wrap gap-2 select-none">
                      {activePeople.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            markManualOverride();
                            setBelongsTo(p.id);
                          }}
                          className={`min-h-[42px] py-2 px-3 rounded-xl border text-xs font-bold transition touch-manipulation active:scale-95 ${
                            belongsTo === p.id
                              ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                              : 'bg-white text-slate-700 border-slate-200'
                          }`}
                        >
                          {p.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Shared Split Controls */}
                {isShared && (
                  <div className="space-y-3 pt-2 border-t border-slate-200">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-600">
                        How Should It Be Divided?
                      </span>
                      {splitMode === 'percentage' && (
                        <button
                          type="button"
                          onClick={handleEqualizePercentages}
                          className="text-[11px] font-extrabold text-indigo-600 hover:underline touch-manipulation"
                        >
                          Split % Equally
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-3 p-1 bg-slate-200/80 rounded-xl select-none">
                      {[
                        { id: 'equal', label: 'Equal' },
                        { id: 'custom', label: 'Custom' },
                        { id: 'percentage', label: 'Percent %' }
                      ].map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            markManualOverride();
                            setSplitMode(m.id);
                          }}
                          className={`min-h-[40px] py-1.5 text-xs font-bold rounded-lg transition touch-manipulation ${
                            splitMode === m.id ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600'
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>

                    <div className="space-y-2">
                      {activePeople.map((p) => {
                        const isIncluded = includedIds.includes(p.id);
                        return (
                          <div
                            key={p.id}
                            className="min-h-[48px] flex items-center justify-between gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200/80"
                          >
                            <label className="flex items-center gap-2.5 cursor-pointer min-h-[36px] select-none min-w-0">
                              {splitMode === 'equal' && (
                                <input
                                  type="checkbox"
                                  checked={isIncluded}
                                  onChange={() => toggleParticipant(p.id)}
                                  className="w-5 h-5 rounded accent-indigo-600 shrink-0"
                                />
                              )}
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: p.color }}
                              />
                              <span className="text-xs font-bold text-slate-800 truncate">
                                {p.name}
                              </span>
                            </label>

                            {splitMode === 'equal' && (
                              <span className="text-xs font-extrabold text-slate-900 shrink-0">
                                {formatMoney(computedShares[p.id] || 0, currency)}
                              </span>
                            )}

                            {splitMode === 'custom' && (
                              <div className="flex items-center gap-1 shrink-0">
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  step="0.01"
                                  placeholder="0.00"
                                  aria-label={`Custom amount for ${p.name}`}
                                  value={customAmounts[p.id] ?? ''}
                                  onChange={(e) => {
                                    markManualOverride();
                                    setCustomAmounts({ ...customAmounts, [p.id]: e.target.value });
                                  }}
                                  className="w-24 min-h-[38px] text-right text-xs font-extrabold px-2.5 py-1.5 rounded-lg border border-slate-300"
                                />
                                <span className="text-[11px] font-bold text-slate-500">
                                  {currency}
                                </span>
                              </div>
                            )}

                            {splitMode === 'percentage' && (
                              <div className="flex items-center gap-1.5 shrink-0">
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  step="0.1"
                                  aria-label={`Percentage for ${p.name}`}
                                  value={customPercentages[p.id] ?? '0'}
                                  onChange={(e) => {
                                    markManualOverride();
                                    setCustomPercentages({
                                      ...customPercentages,
                                      [p.id]: e.target.value
                                    });
                                  }}
                                  className="w-16 min-h-[38px] text-right text-xs font-extrabold px-2 py-1.5 rounded-lg border border-slate-300"
                                />
                                <span className="text-xs font-bold text-slate-500">%</span>
                                <span className="text-[11px] font-bold text-indigo-700 w-20 text-right">
                                  ({formatCompact(computedShares[p.id] || 0)})
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {splitMode === 'custom' && numericAmount > 0 && (
                      <div className="flex justify-between text-[11px] font-bold px-1">
                        <span className="text-slate-500">Entered Sum:</span>
                        <span
                          className={
                            Math.abs(customSum - numericAmount) <= 0.01
                              ? 'text-emerald-700'
                              : 'text-rose-600'
                          }
                        >
                          {formatMoney(customSum, currency)} / {formatMoney(numericAmount, currency)}
                        </span>
                      </div>
                    )}

                    {splitMode === 'percentage' && (
                      <div className="flex justify-between text-[11px] font-bold px-1">
                        <span className="text-slate-500">Percentage Sum:</span>
                        <span
                          className={
                            Math.abs(percentageSum - 100) <= 0.1
                              ? 'text-emerald-700'
                              : 'text-rose-600'
                          }
                        >
                          {percentageSum}% / 100%
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Live Debt Impact Preview for Unlimited Dynamic Participants */}
                {numericAmount > 0 && (isShared || paidBy !== belongsTo) && (
                  <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-100 text-[11px] text-indigo-900 space-y-0.5">
                    <div className="font-bold">Automatic Debt Calculation Preview:</div>
                    {paidBy === 'me' ? (
                      Object.entries(computedShares)
                        .filter(([pid, s]) => pid !== 'me' && s > 0)
                        .map(([pid, s]) => {
                          const name = people.find((x) => x.id === pid)?.name || pid;
                          return (
                            <div key={pid}>
                              • <strong>{name}</strong> will owe you{' '}
                              <strong>{formatMoney(s, currency)}</strong>
                            </div>
                          );
                        })
                    ) : (
                      <div>
                        • You will owe{' '}
                        <strong>{people.find((x) => x.id === paidBy)?.name}</strong>{' '}
                        <strong>{formatMoney(computedShares.me || 0, currency)}</strong>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Optional Notes */}
            <div>
              <label htmlFor="tx-notes" className="text-xs font-bold text-slate-600 block mb-1">
                Notes (Optional)
              </label>
              <input
                id="tx-notes"
                type="text"
                placeholder="Receipt details, bank ref, or extra context..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full min-h-[46px] text-xs sm:text-sm px-3.5 py-2.5 rounded-2xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            {formError && (
              <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700 flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0" />
                <span>{formError}</span>
              </div>
            )}
          </div>

          <div className="px-5 pt-3 pb-[calc(0.85rem+env(safe-area-inset-bottom))] border-t border-slate-100 bg-white flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 min-h-[50px] py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 active:scale-[0.98] text-slate-700 text-sm font-bold touch-manipulation"
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`flex-2 min-h-[50px] py-3 px-6 rounded-2xl text-white text-sm font-extrabold shadow-md touch-manipulation transition active:scale-[0.98] ${
                entryMode === 'upcoming'
                  ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-200'
                  : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'
              }`}
            >
              {editingPending
                ? entryMode === 'upcoming'
                  ? 'Finalize as Upcoming'
                  : 'Finalize & Post'
                : editingUpcoming
                ? 'Save Scheduled Item'
                : editingTx
                ? 'Save Changes'
                : entryMode === 'upcoming'
                ? 'Save Upcoming'
                : 'Save Transaction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
