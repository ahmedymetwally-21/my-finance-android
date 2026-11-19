import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRightLeft,
  Banknote,
  Building2,
  Check,
  CreditCard,
  Edit3,
  Plus,
  Trash2,
  Wallet,
  X
} from 'lucide-react';
import {
  ACCOUNT_TYPES,
  DEFAULT_CURRENCIES,
  computeStartingBalanceForTarget,
  formatMoney,
  getCurrencyAccent,
  getDefaultAccountIdForCurrency,
  getTodayStr,
  round2
} from '../utils/financeEngine.js';

function AccountTypeIcon({ type, size = 16 }) {
  if (type === 'cash') return <Banknote size={size} />;
  if (type === 'bank') return <Building2 size={size} />;
  return <CreditCard size={size} />;
}

export function AccountsManagerPanel({
  accounts,
  setAccounts,
  accountBalanceMap,
  transactions,
  setTransactions,
  settlements,
  setSettlements,
  setUpcomingTransactions,
  accountTransfers,
  setAccountTransfers,
  currencies = DEFAULT_CURRENCIES,
  primaryCurrency = 'AED',
  onOpenTransfer,
  showToast
}) {
  const validCurrencies = currencies.length > 0 ? currencies : DEFAULT_CURRENCIES;

  const [name, setName] = useState('');
  const [type, setType] = useState('debit');
  const [currency, setCurrency] = useState(() =>
    validCurrencies.some((c) => c.code === primaryCurrency)
      ? primaryCurrency
      : validCurrencies[0].code
  );
  const [last4, setLast4] = useState('');
  const [startingBalance, setStartingBalance] = useState('0');

  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState(null);

  const [adjustingId, setAdjustingId] = useState(null);
  const [targetBalanceInput, setTargetBalanceInput] = useState('');

  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const selectedCurrency = validCurrencies.some((c) => c.code === currency)
    ? currency
    : validCurrencies[0].code;

  const handleAddAccount = (e) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      showToast('Please enter an account or card name', 'error');
      return;
    }
    const cleanLast4 = last4.replace(/\D/g, '').slice(-4);
    if (last4.trim() && cleanLast4.length !== 4) {
      showToast('Last 4 digits must be 4 numbers (or leave blank)', 'error');
      return;
    }

    const newAcc = {
      id: `acc_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      name: cleanName,
      type,
      currency: selectedCurrency,
      last4: cleanLast4,
      startingBalance: round2(parseFloat(startingBalance) || 0)
    };

    setAccounts((prev) => [...prev, newAcc]);
    setName('');
    setLast4('');
    setStartingBalance('0');
    showToast(`Added "${cleanName}" (${selectedCurrency})`);
  };

  const startEdit = (acc) => {
    setAdjustingId(null);
    setConfirmDeleteId(null);
    setEditingId(acc.id);
    setEditDraft({
      name: acc.name,
      type: acc.type,
      currency: acc.currency,
      last4: acc.last4 || '',
      startingBalance: String(acc.startingBalance ?? 0)
    });
  };

  const saveEdit = (accId) => {
    if (!editDraft || !editDraft.name.trim()) {
      showToast('Account name cannot be empty', 'error');
      return;
    }
    const cleanLast4 = (editDraft.last4 || '').replace(/\D/g, '').slice(-4);
    if (editDraft.last4.trim() && cleanLast4.length !== 4) {
      showToast('Last 4 digits must be 4 numbers (or leave blank)', 'error');
      return;
    }
    setAccounts((prev) =>
      prev.map((a) =>
        a.id === accId
          ? {
              ...a,
              name: editDraft.name.trim(),
              type: editDraft.type,
              last4: cleanLast4,
              startingBalance: round2(parseFloat(editDraft.startingBalance) || 0)
            }
          : a
      )
    );
    setEditingId(null);
    setEditDraft(null);
    showToast('Account updated');
  };

  const startAdjustBalance = (acc) => {
    setEditingId(null);
    setConfirmDeleteId(null);
    setAdjustingId(acc.id);
    const liveBal = accountBalanceMap[acc.id]?.balance ?? acc.startingBalance ?? 0;
    setTargetBalanceInput(String(round2(liveBal)));
  };

  const applyAdjustBalance = (acc) => {
    const targetVal = round2(parseFloat(targetBalanceInput));
    if (!Number.isFinite(targetVal)) {
      showToast('Please enter a valid target balance', 'error');
      return;
    }
    const nextStart = computeStartingBalanceForTarget(acc, accountBalanceMap[acc.id], targetVal);
    setAccounts((prev) =>
      prev.map((a) => (a.id === acc.id ? { ...a, startingBalance: nextStart } : a))
    );
    setAdjustingId(null);
    showToast(`Set "${acc.name}" live balance to ${formatMoney(targetVal, acc.currency)}`);
  };

  const handleDeleteAccount = (acc) => {
    const sameCurrencyAccounts = accounts.filter((a) => a.currency === acc.currency);
    const isBuiltInCur = acc.currency === 'AED' || acc.currency === 'EGP';
    const linkedCount =
      transactions.filter((t) => t.accountId === acc.id).length +
      settlements.filter((s) => s.accountId === acc.id).length;

    if (sameCurrencyAccounts.length <= 1 && (isBuiltInCur || linkedCount > 0)) {
      showToast(`Keep at least one ${acc.currency} account while records exist`, 'error');
      return;
    }

    const fallbackId =
      sameCurrencyAccounts.length > 1
        ? getDefaultAccountIdForCurrency(
            sameCurrencyAccounts.filter((a) => a.id !== acc.id),
            acc.currency
          )
        : '';

    if (fallbackId) {
      setTransactions((prev) =>
        prev.map((t) => (t.accountId === acc.id ? { ...t, accountId: fallbackId } : t))
      );
      setSettlements((prev) =>
        prev.map((s) => (s.accountId === acc.id ? { ...s, accountId: fallbackId } : s))
      );
      setUpcomingTransactions((prev) =>
        prev.map((u) => (u.accountId === acc.id ? { ...u, accountId: fallbackId } : u))
      );
    }
    setAccountTransfers((prev) =>
      prev.filter((tr) => tr.fromAccountId !== acc.id && tr.toAccountId !== acc.id)
    );
    setAccounts((prev) => prev.filter((a) => a.id !== acc.id));
    setConfirmDeleteId(null);
    showToast(`Deleted "${acc.name}"`);
  };

  const handleDeleteTransfer = (trId) => {
    setAccountTransfers((prev) => prev.filter((tr) => tr.id !== trId));
    showToast('Account transfer removed');
  };

  return (
    <div className="space-y-4">
      {/* Add Account Form */}
      <form
        onSubmit={handleAddAccount}
        className="bg-white dark:bg-[#0f172a] p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-3"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
              <Wallet size={18} />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                Add Account or Card
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Include last 4 digits so Bank SMS alerts auto-match
              </p>
            </div>
          </div>

          {onOpenTransfer && (
            <button
              type="button"
              onClick={onOpenTransfer}
              className="min-h-[38px] px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-extrabold flex items-center gap-1.5 touch-manipulation active:scale-95 shrink-0"
            >
              <ArrowRightLeft size={14} />
              <span>Transfer</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input
            type="text"
            placeholder="Account Name (e.g., ENBD Card 1, USD Cash)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="min-h-[44px] px-3.5 py-2 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-950 focus:outline-none focus:border-indigo-500 dark:focus:border-emerald-500"
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              aria-label="Account type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="min-h-[44px] px-2.5 py-2 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-100"
            >
              {ACCOUNT_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
            <select
              aria-label="Account currency"
              value={selectedCurrency}
              onChange={(e) => setCurrency(e.target.value)}
              className="min-h-[44px] px-2.5 py-2 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-extrabold text-indigo-700 dark:text-emerald-400"
            >
              {validCurrencies.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} ({c.symbol})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <input
            type="text"
            inputMode="numeric"
            maxLength={4}
            placeholder="Last 4 digits (opt.)"
            value={last4}
            onChange={(e) => setLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
            className="min-h-[44px] px-3 py-2 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-100"
          />
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            placeholder="Opening Balance"
            aria-label="Opening balance"
            value={startingBalance}
            onChange={(e) => setStartingBalance(e.target.value)}
            className="min-h-[44px] px-3 py-2 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-100 tabular-nums"
          />
          <button
            type="submit"
            className="col-span-2 sm:col-span-1 min-h-[44px] px-4 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 touch-manipulation active:scale-95"
          >
            <Plus size={15} />
            <span>Add Account</span>
          </button>
        </div>
      </form>

      {/* Accounts Grouped Dynamically by Active Currencies */}
      {validCurrencies.map((curObj, idx) => {
        const cur = curObj.code;
        const curAccounts = accounts.filter((a) => a.currency === cur);
        const accent = getCurrencyAccent(cur, idx);
        const isBuiltIn = cur === 'AED' || cur === 'EGP';

        return (
          <div
            key={cur}
            className="bg-white dark:bg-[#0f172a] p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-3"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-extrabold px-2.5 py-1 rounded-xl ${accent.badgeClass}`}>
                  {cur} Accounts ({curAccounts.length})
                </span>
              </div>
              <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                All-time cumulative balances
              </span>
            </div>

            {curAccounts.length === 0 ? (
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-dashed border-slate-200 dark:border-slate-700 text-center space-y-2">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  No {cur} accounts created yet.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setAccounts((prev) => [
                      ...prev,
                      {
                        id: `acc_cash_${cur.toLowerCase()}_${Date.now()}`,
                        name: `Cash ${cur}`,
                        type: 'cash',
                        currency: cur,
                        last4: '',
                        startingBalance: 0
                      }
                    ]);
                    showToast(`Created Cash ${cur} account`);
                  }}
                  className="min-h-[36px] px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold inline-flex items-center gap-1"
                >
                  <Plus size={13} />
                  <span>Quick Create Cash {cur}</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {curAccounts.map((acc) => {
                  const balInfo = accountBalanceMap[acc.id] || {
                    balance: acc.startingBalance || 0
                  };
                  const isEditing = editingId === acc.id && editDraft;
                  const isAdjusting = adjustingId === acc.id;
                  const typeLabel =
                    ACCOUNT_TYPES.find((t) => t.id === acc.type)?.label || acc.type;
                  const linkedCount =
                    transactions.filter((t) => t.accountId === acc.id).length +
                    settlements.filter((s) => s.accountId === acc.id).length;
                  const cannotDelete =
                    curAccounts.length <= 1 && (isBuiltIn || linkedCount > 0);

                  return (
                    <div
                      key={acc.id}
                      className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 space-y-2.5"
                    >
                      {isEditing ? (
                        <div className="space-y-2">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <input
                              type="text"
                              aria-label="Edit account name"
                              value={editDraft.name}
                              onChange={(e) =>
                                setEditDraft({ ...editDraft, name: e.target.value })
                              }
                              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-white dark:bg-slate-950 border border-indigo-300 dark:border-indigo-600 text-xs font-bold text-slate-900 dark:text-white"
                            />
                            <select
                              aria-label="Edit account type"
                              value={editDraft.type}
                              onChange={(e) =>
                                setEditDraft({ ...editDraft, type: e.target.value })
                              }
                              className="min-h-[40px] px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white"
                            >
                              {ACCOUNT_TYPES.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="text"
                              maxLength={4}
                              placeholder="Last 4 digits"
                              value={editDraft.last4}
                              onChange={(e) =>
                                setEditDraft({
                                  ...editDraft,
                                  last4: e.target.value.replace(/\D/g, '').slice(0, 4)
                                })
                              }
                              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white"
                            />
                            <input
                              type="number"
                              step="0.01"
                              placeholder="Starting balance"
                              value={editDraft.startingBalance}
                              onChange={(e) =>
                                setEditDraft({
                                  ...editDraft,
                                  startingBalance: e.target.value
                                })
                              }
                              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white tabular-nums"
                            />
                          </div>
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="min-h-[36px] px-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => saveEdit(acc.id)}
                              className="min-h-[36px] px-3 rounded-xl bg-indigo-600 text-white text-xs font-extrabold flex items-center gap-1"
                            >
                              <Check size={14} />
                              <span>Save</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2.5 min-w-0">
                              <div
                                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${accent.badgeClass}`}
                              >
                                <AccountTypeIcon type={acc.type} size={17} />
                              </div>
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <h4 className="text-sm font-extrabold text-slate-900 dark:text-white truncate">
                                    {acc.name}
                                  </h4>
                                  {acc.last4 && (
                                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                      ••{acc.last4}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                                  {typeLabel} · Opening:{' '}
                                  {formatMoney(acc.startingBalance, acc.currency)}
                                </p>
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <div className="text-sm font-extrabold text-slate-900 dark:text-white tabular-nums">
                                {formatMoney(balInfo.balance, acc.currency)}
                              </div>
                              <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                                Live Balance
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/70 dark:border-slate-800">
                            <button
                              type="button"
                              onClick={() => startAdjustBalance(acc)}
                              className="min-h-[34px] px-2.5 py-1 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-extrabold text-indigo-700 dark:text-emerald-400 hover:bg-indigo-50 dark:hover:bg-slate-700 touch-manipulation"
                            >
                              Set Current Balance
                            </button>

                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                aria-label={`Edit ${acc.name}`}
                                onClick={() => startEdit(acc)}
                                className="min-h-[34px] px-2.5 py-1 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:text-indigo-700 dark:hover:text-white flex items-center gap-1"
                              >
                                <Edit3 size={13} />
                                <span>Edit</span>
                              </button>

                              {confirmDeleteId === acc.id ? (
                                <div className="flex items-center gap-1 bg-rose-50 dark:bg-rose-950/60 px-2 py-1 rounded-xl border border-rose-200 dark:border-rose-800">
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteAccount(acc)}
                                    className="text-[11px] font-extrabold text-rose-700 dark:text-rose-300 px-1"
                                  >
                                    Confirm
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteId(null)}
                                    className="text-[11px] text-slate-600 dark:text-slate-300 px-1"
                                  >
                                    No
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  aria-label={`Delete ${acc.name}`}
                                  disabled={cannotDelete}
                                  onClick={() => setConfirmDeleteId(acc.id)}
                                  className="min-h-[34px] px-2.5 py-1 rounded-xl bg-white dark:bg-slate-800 border border-rose-200 dark:border-rose-900/80 text-[11px] font-bold text-rose-600 dark:text-rose-400 disabled:opacity-40 flex items-center gap-1"
                                >
                                  <Trash2 size={13} />
                                  <span>Delete</span>
                                </button>
                              )}
                            </div>
                          </div>

                          {confirmDeleteId === acc.id && linkedCount > 0 && (
                            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-[11px] font-semibold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                              <AlertCircle size={13} className="shrink-0" />
                              <span>
                                {linkedCount} linked records will safely move to your fallback{' '}
                                {acc.currency} account.
                              </span>
                            </div>
                          )}

                          {isAdjusting && (
                            <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 flex flex-wrap items-center gap-2">
                              <label className="text-[11px] font-extrabold text-indigo-900 dark:text-indigo-200">
                                Exact Live Balance ({acc.currency}):
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                aria-label={`Target live balance for ${acc.name}`}
                                value={targetBalanceInput}
                                onChange={(e) => setTargetBalanceInput(e.target.value)}
                                className="w-28 min-h-[36px] px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-indigo-300 dark:border-indigo-700 text-xs font-extrabold text-slate-900 dark:text-white tabular-nums"
                              />
                              <button
                                type="button"
                                onClick={() => applyAdjustBalance(acc)}
                                className="min-h-[36px] px-3 py-1 rounded-lg bg-indigo-600 text-white text-xs font-extrabold"
                              >
                                Apply
                              </button>
                              <button
                                type="button"
                                onClick={() => setAdjustingId(null)}
                                className="min-h-[36px] px-2 text-xs text-slate-600 dark:text-slate-300 font-bold"
                              >
                                Cancel
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* Recent Account Transfers Log */}
      {accountTransfers.length > 0 && (
        <div className="bg-white dark:bg-[#0f172a] p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-2.5">
          <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Account-to-Account Transfers ({accountTransfers.length})
          </h4>
          <div className="space-y-2">
            {accountTransfers.slice(0, 8).map((tr) => {
              const fromAcc = accounts.find((a) => a.id === tr.fromAccountId);
              const toAcc = accounts.find((a) => a.id === tr.toAccountId);
              return (
                <div
                  key={tr.id}
                  className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-extrabold text-slate-900 dark:text-white truncate">
                      {fromAcc?.name || 'Deleted'} → {toAcc?.name || 'Deleted'}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {tr.date}
                      {tr.note ? ` · ${tr.note}` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-extrabold text-indigo-700 dark:text-emerald-400 tabular-nums">
                      {formatMoney(tr.amount, tr.currency)}
                    </span>
                    <button
                      type="button"
                      aria-label="Delete transfer"
                      onClick={() => handleDeleteTransfer(tr.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function AccountsManagerModal({
  accounts,
  setAccounts,
  accountBalanceMap,
  transactions,
  setTransactions,
  settlements,
  setSettlements,
  upcomingTransactions,
  setUpcomingTransactions,
  accountTransfers,
  setAccountTransfers,
  currencies = DEFAULT_CURRENCIES,
  primaryCurrency = 'AED',
  onOpenTransfer,
  onClose,
  showToast
}) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Manage Accounts and Cards"
        className="bg-slate-50 dark:bg-[#090d16] w-full max-w-xl rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden max-h-[92dvh] flex flex-col"
      >
        <div className="px-5 py-3.5 bg-white dark:bg-[#0f172a] border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
              Manage Accounts &amp; Cards
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Edit opening or live balances, last 4 card digits &amp; payment accounts
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="w-10 h-10 flex items-center justify-center rounded-2xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1">
          <AccountsManagerPanel
            accounts={accounts}
            setAccounts={setAccounts}
            accountBalanceMap={accountBalanceMap}
            transactions={transactions}
            setTransactions={setTransactions}
            settlements={settlements}
            setSettlements={setSettlements}
            upcomingTransactions={upcomingTransactions}
            setUpcomingTransactions={setUpcomingTransactions}
            accountTransfers={accountTransfers}
            setAccountTransfers={setAccountTransfers}
            currencies={currencies}
            primaryCurrency={primaryCurrency}
            onOpenTransfer={onOpenTransfer}
            showToast={showToast}
          />
        </div>
      </div>
    </div>
  );
}

export function TransferModal({
  accounts,
  currencies = DEFAULT_CURRENCIES,
  initialCurrency = 'AED',
  onClose,
  onSaveTransfer
}) {
  const validCurrencies = currencies.length > 0 ? currencies : DEFAULT_CURRENCIES;
  const [currency, setCurrency] = useState(() =>
    validCurrencies.some((c) => c.code === initialCurrency)
      ? initialCurrency
      : validCurrencies[0].code
  );
  const currencyAccounts = useMemo(
    () => accounts.filter((a) => a.currency === currency),
    [accounts, currency]
  );

  const [fromAccountId, setFromAccountId] = useState(() => currencyAccounts[0]?.id || '');
  const [toAccountId, setToAccountId] = useState(
    () => currencyAccounts[1]?.id || currencyAccounts[0]?.id || ''
  );
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => getTodayStr());
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const handleCurrencyChange = (nextCur) => {
    setCurrency(nextCur);
    const nextList = accounts.filter((a) => a.currency === nextCur);
    setFromAccountId(nextList[0]?.id || '');
    setToAccountId(nextList[1]?.id || nextList[0]?.id || '');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    const num = round2(parseFloat(amount) || 0);
    if (currencyAccounts.length < 2) {
      setError(`Add at least two ${currency} accounts to transfer funds between them.`);
      return;
    }
    if (!fromAccountId || !toAccountId || fromAccountId === toAccountId) {
      setError('Source and destination accounts must be different.');
      return;
    }
    if (num <= 0) {
      setError('Enter a transfer amount greater than 0.');
      return;
    }
    onSaveTransfer({
      fromAccountId,
      toAccountId,
      amount: num,
      currency,
      date,
      note: note.trim()
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Account-to-Account Transfer"
        className="bg-white dark:bg-[#0f172a] w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden max-h-[90dvh] flex flex-col"
      >
        <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
              Account Transfer
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              ATM withdrawals &amp; card payments without inflating expenses
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close transfer modal"
            className="w-10 h-10 flex items-center justify-center rounded-2xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
          <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl overflow-x-auto no-scrollbar select-none">
            {validCurrencies.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => handleCurrencyChange(c.code)}
                className={`flex-1 min-w-[74px] min-h-[40px] px-2.5 text-xs font-extrabold rounded-xl transition whitespace-nowrap ${
                  currency === c.code
                    ? 'bg-indigo-600 dark:bg-emerald-600 text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {c.code}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div>
              <label
                htmlFor="tr-from"
                className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1"
              >
                From Account
              </label>
              <select
                id="tr-from"
                value={fromAccountId}
                onChange={(e) => setFromAccountId(e.target.value)}
                className="w-full min-h-[46px] px-3 py-2 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white"
              >
                {currencyAccounts.length === 0 ? (
                  <option value="">No {currency} accounts available</option>
                ) : (
                  currencyAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                      {a.last4 ? ` (••${a.last4})` : ''}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label
                htmlFor="tr-to"
                className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1"
              >
                To Account
              </label>
              <select
                id="tr-to"
                value={toAccountId}
                onChange={(e) => setToAccountId(e.target.value)}
                className="w-full min-h-[46px] px-3 py-2 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white"
              >
                {currencyAccounts.length === 0 ? (
                  <option value="">No {currency} accounts available</option>
                ) : (
                  currencyAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                      {a.last4 ? ` (••${a.last4})` : ''}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label
                htmlFor="tr-amount"
                className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1"
              >
                Amount ({currency})
              </label>
              <input
                id="tr-amount"
                type="number"
                inputMode="decimal"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full min-h-[46px] px-3 py-2 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-base font-extrabold text-slate-900 dark:text-white tabular-nums"
              />
            </div>
            <div>
              <label
                htmlFor="tr-date"
                className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1"
              >
                Date
              </label>
              <input
                id="tr-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full min-h-[46px] px-3 py-2 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="tr-note"
              className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1"
            >
              Note (Optional)
            </label>
            <input
              id="tr-note"
              type="text"
              placeholder="e.g., ATM Cash Withdrawal, Credit Card Payment"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full min-h-[44px] px-3 py-2 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-white"
            />
          </div>

          {error && (
            <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-xs font-bold text-rose-700 dark:text-rose-300">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 min-h-[48px] rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-bold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-2 min-h-[48px] rounded-2xl bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-700 text-white text-sm font-extrabold"
            >
              Confirm Transfer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
