// Pure financial engine, dual-currency accounting, dynamic participant splits,
// default sharing resolution, upcoming recurring scheduler, and period cleanup.

export const STORAGE_KEY = 'pf_shared_ledger_v1';
export const LEGACY_STORAGE_KEY = 'fintrack_dual_shared_v1';

export const COLOR_PALETTE = [
  '#4f46e5', // Indigo
  '#0d9488', // Teal
  '#e11d48', // Rose
  '#d97706', // Amber
  '#2563eb', // Blue
  '#7c3aed', // Violet
  '#059669', // Emerald
  '#db2777', // Pink
  '#ea580c', // Orange
  '#475569'  // Slate
];

export const DEFAULT_PEOPLE = [
  { id: 'me', name: 'Me', color: '#4f46e5', archived: false },
  { id: 'p2', name: 'Omar (Person 2)', color: '#0d9488', archived: false },
  { id: 'p3', name: 'Sara (Person 3)', color: '#d97706', archived: false }
];

export const DEFAULT_SECTIONS = [
  { id: 'sec_housing', name: 'Housing & Bills', type: 'expense' },
  { id: 'sec_daily', name: 'Daily Living', type: 'expense' },
  { id: 'sec_lifestyle', name: 'Lifestyle & Personal', type: 'expense' },
  { id: 'sec_income', name: 'Income Sources', type: 'income' }
];

export const DEFAULT_CATEGORIES = [
  { id: 'cat_rent', sectionId: 'sec_housing', name: 'Rent', icon: 'Home', color: '#4f46e5', type: 'expense' },
  { id: 'cat_bills', sectionId: 'sec_housing', name: 'Bills & Utilities', icon: 'Receipt', color: '#2563eb', type: 'expense' },
  { id: 'cat_subs', sectionId: 'sec_housing', name: 'Subscriptions', icon: 'Repeat', color: '#7c3aed', type: 'expense' },
  { id: 'cat_groceries', sectionId: 'sec_daily', name: 'Groceries', icon: 'ShoppingCart', color: '#059669', type: 'expense' },
  { id: 'cat_restaurants', sectionId: 'sec_daily', name: 'Restaurants', icon: 'Utensils', color: '#ea580c', type: 'expense' },
  { id: 'cat_transport', sectionId: 'sec_daily', name: 'Transportation', icon: 'Car', color: '#0d9488', type: 'expense' },
  { id: 'cat_shopping', sectionId: 'sec_lifestyle', name: 'Shopping', icon: 'ShoppingBag', color: '#db2777', type: 'expense' },
  { id: 'cat_travel', sectionId: 'sec_lifestyle', name: 'Travel', icon: 'Plane', color: '#0284c7', type: 'expense' },
  { id: 'cat_family', sectionId: 'sec_lifestyle', name: 'Family', icon: 'Heart', color: '#e11d48', type: 'expense' },
  { id: 'cat_personal', sectionId: 'sec_lifestyle', name: 'Personal', icon: 'User', color: '#d97706', type: 'expense' },
  { id: 'cat_other', sectionId: 'sec_lifestyle', name: 'Other', icon: 'MoreHorizontal', color: '#475569', type: 'expense' },
  { id: 'cat_salary', sectionId: 'sec_income', name: 'Salary', icon: 'Briefcase', color: '#059669', type: 'income' },
  { id: 'cat_transfer', sectionId: 'sec_income', name: 'Transfers', icon: 'RefreshCw', color: '#2563eb', type: 'income' },
  { id: 'cat_refund', sectionId: 'sec_income', name: 'Refunds', icon: 'Gift', color: '#7c3aed', type: 'income' },
  { id: 'cat_inc_other', sectionId: 'sec_income', name: 'Bonus & Freelance', icon: 'Coins', color: '#d97706', type: 'income' }
];

export const DEFAULT_SHARING_PREFS = {
  scope: 'personal', // 'personal' | 'shared'
  paidBy: 'me',
  splitMode: 'equal', // 'equal' | 'custom' | 'percentage'
  participantIds: ['me', 'p2', 'p3'],
  customPercentages: {},
  categoryRules: {}
};

export const ACCOUNT_TYPES = [
  { id: 'cash', label: 'Cash' },
  { id: 'debit', label: 'Debit Card' },
  { id: 'credit', label: 'Credit Card' },
  { id: 'bank', label: 'Bank Account' }
];

export const DEFAULT_ACCOUNTS = [
  {
    id: 'acc_cash_aed',
    name: 'Cash AED',
    type: 'cash',
    currency: 'AED',
    last4: '',
    startingBalance: 0
  },
  {
    id: 'acc_cash_egp',
    name: 'Cash EGP',
    type: 'cash',
    currency: 'EGP',
    last4: '',
    startingBalance: 0
  }
];

export const DEFAULT_APPEARANCE_PREFS = {
  showLaunchSplash: true
};

export const pad2 = (n) => String(n).padStart(2, '0');

export const round2 = (num) => Math.round((Number(num) + Number.EPSILON) * 100) / 100;

export const getTodayStr = () => {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
};

export const getCurrentYearMonth = () => {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
};

export const formatMoney = (amount, currency = 'AED') => {
  const val = round2(amount || 0);
  return `${val.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })} ${currency}`;
};

export const formatCompact = (amount) => {
  const val = round2(amount || 0);
  return val.toLocaleString('en-US', {
    minimumFractionDigits: val % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  });
};

// ============================================================================
// DYNAMIC PARTICIPANT SHARE CALCULATIONS
// ============================================================================

/**
 * Exact cent/fils-safe equal split across any number of participants.
 * Ensures the sum of shares strictly equals totalAmount.
 */
export function computeEqualShares(totalAmount, participantIds) {
  const result = {};
  const uniqueIds = Array.from(new Set(participantIds || []));
  const count = uniqueIds.length;
  if (count === 0 || totalAmount <= 0) return result;

  const totalCents = Math.round(totalAmount * 100);
  const baseCents = Math.floor(totalCents / count);
  let remainder = totalCents - baseCents * count;

  uniqueIds.forEach((pid) => {
    const extra = remainder > 0 ? 1 : 0;
    if (remainder > 0) remainder -= 1;
    result[pid] = (baseCents + extra) / 100;
  });
  return result;
}

/**
 * Compute equal percentage strings (e.g., 33.34, 33.33, 33.33 for 3 people)
 * summing strictly to 100.00.
 */
export function computeEqualPercentages(participantIds) {
  const result = {};
  const uniqueIds = Array.from(new Set(participantIds || []));
  const count = uniqueIds.length;
  if (count === 0) return result;

  const totalBp = 10000; // 100.00% in basis points
  const baseBp = Math.floor(totalBp / count);
  let remainder = totalBp - baseBp * count;

  uniqueIds.forEach((pid) => {
    const extra = remainder > 0 ? 1 : 0;
    if (remainder > 0) remainder -= 1;
    result[pid] = String((baseBp + extra) / 100);
  });
  return result;
}

/**
 * Compute currency shares from percentage inputs across dynamic participants.
 * Adjusts the final positive participant's share by residual cents so sum === totalAmount.
 */
export function computePercentageShares(totalAmount, participantIds, percentageMap) {
  const result = {};
  if (totalAmount <= 0 || !Array.isArray(participantIds) || participantIds.length === 0) {
    return result;
  }

  const positiveIds = participantIds.filter((pid) => (parseFloat(percentageMap?.[pid]) || 0) > 0);
  if (positiveIds.length === 0) return result;

  let runningSum = 0;
  positiveIds.forEach((pid, idx) => {
    if (idx === positiveIds.length - 1) {
      result[pid] = round2(Math.max(0, totalAmount - runningSum));
    } else {
      const pct = parseFloat(percentageMap?.[pid]) || 0;
      const share = round2((totalAmount * pct) / 100);
      result[pid] = share;
      runningSum = round2(runningSum + share);
    }
  });

  return result;
}

/**
 * Effective shares for any expense (Shared splits & Personal "On Behalf" expenses).
 * Supports unlimited participant IDs dynamically.
 */
export function getEffectiveShares(tx) {
  if (!tx || tx.type !== 'expense') return {};
  if (tx.isShared) {
    const shares = {};
    Object.entries(tx.shares || {}).forEach(([pid, amt]) => {
      const rounded = round2(amt || 0);
      if (rounded > 0) {
        shares[pid] = rounded;
      }
    });
    return shares;
  }
  const owner = tx.belongsTo || tx.paidBy || 'me';
  return {
    [owner]: round2(tx.amount || 0)
  };
}

// ============================================================================
// DYNAMIC DEBT & DUAL-CURRENCY SUMMARY ENGINE
// ============================================================================

export function computeDebtItems(transactions, settlements) {
  const receivables = [];
  const payables = [];

  (transactions || []).forEach((tx) => {
    if (tx.type !== 'expense') return;
    const shares = getEffectiveShares(tx);

    // Case A: Me paid -> Check all other participants who owe a share
    if (tx.paidBy === 'me') {
      Object.entries(shares).forEach(([pid, rawShare]) => {
        if (pid === 'me') return;
        const shareAmt = round2(rawShare || 0);
        if (shareAmt > 0) {
          const relatedSettlements = (settlements || []).filter(
            (s) => s.transactionId === tx.id && s.personId === pid && s.direction === 'receive'
          );
          const paidSoFar = round2(
            relatedSettlements.reduce((acc, s) => acc + Number(s.amount || 0), 0)
          );
          const outstanding = round2(Math.max(0, shareAmt - paidSoFar));
          const status = outstanding <= 0 ? 'Paid' : paidSoFar > 0 ? 'Partial' : 'Unpaid';

          receivables.push({
            key: `${tx.id}_${pid}`,
            transactionId: tx.id,
            personId: pid,
            direction: 'receive',
            description: tx.description,
            categoryId: tx.categoryId,
            date: tx.date,
            currency: tx.currency,
            totalExpenseAmount: tx.amount,
            isShared: tx.isShared,
            originalShare: shareAmt,
            paidSoFar,
            outstanding,
            status,
            settlementHistory: relatedSettlements
              .slice()
              .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
          });
        }
      });
    }

    // Case B: Any other participant paid -> Check if Me owes a share
    if (tx.paidBy && tx.paidBy !== 'me') {
      const myShare = round2(shares.me || 0);
      if (myShare > 0) {
        const creditorId = tx.paidBy;
        const relatedSettlements = (settlements || []).filter(
          (s) => s.transactionId === tx.id && s.personId === creditorId && s.direction === 'pay'
        );
        const paidSoFar = round2(
          relatedSettlements.reduce((acc, s) => acc + Number(s.amount || 0), 0)
        );
        const outstanding = round2(Math.max(0, myShare - paidSoFar));
        const status = outstanding <= 0 ? 'Paid' : paidSoFar > 0 ? 'Partial' : 'Unpaid';

        payables.push({
          key: `${tx.id}_${creditorId}`,
          transactionId: tx.id,
          personId: creditorId,
          direction: 'pay',
          description: tx.description,
          categoryId: tx.categoryId,
          date: tx.date,
          currency: tx.currency,
          totalExpenseAmount: tx.amount,
          isShared: tx.isShared,
          originalShare: myShare,
          paidSoFar,
          outstanding,
          status,
          settlementHistory: relatedSettlements
            .slice()
            .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
        });
      }
    }
  });

  receivables.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  payables.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return { receivables, payables };
}

export function computeFinancialSummary(periodTransactions, periodSettlements, allDebtItems) {
  const computeForCurrency = (cur) => {
    const txs = (periodTransactions || []).filter((t) => t.currency === cur);
    const sets = (periodSettlements || []).filter((s) => s.currency === cur);

    const personalIncome = round2(
      txs.filter((t) => t.type === 'income').reduce((acc, t) => acc + Number(t.amount || 0), 0)
    );

    const settlementsReceived = round2(
      sets.filter((s) => s.direction === 'receive').reduce((acc, s) => acc + Number(s.amount || 0), 0)
    );

    const settlementsPaid = round2(
      sets.filter((s) => s.direction === 'pay').reduce((acc, s) => acc + Number(s.amount || 0), 0)
    );

    const cashOutflowExpenses = round2(
      txs
        .filter((t) => t.type === 'expense' && t.paidBy === 'me')
        .reduce((acc, t) => acc + Number(t.amount || 0), 0)
    );

    let myPersonalExpenses = 0;
    let mySharedExpenseShare = 0;
    let totalSharedGroupVolume = 0;

    txs.forEach((t) => {
      if (t.type !== 'expense') return;
      const shares = getEffectiveShares(t);
      const myShare = shares.me || 0;
      if (t.isShared) {
        totalSharedGroupVolume += Number(t.amount || 0);
        mySharedExpenseShare += myShare;
      } else {
        myPersonalExpenses += myShare;
      }
    });

    myPersonalExpenses = round2(myPersonalExpenses);
    mySharedExpenseShare = round2(mySharedExpenseShare);
    totalSharedGroupVolume = round2(totalSharedGroupVolume);

    const totalMyExpenses = round2(myPersonalExpenses + mySharedExpenseShare);
    const totalMoneyReceived = round2(personalIncome + settlementsReceived);
    const totalMoneySpent = round2(cashOutflowExpenses + settlementsPaid);
    const remainingBalance = round2(totalMoneyReceived - totalMoneySpent);

    const outstandingReceivable = round2(
      (allDebtItems?.receivables || [])
        .filter((r) => r.currency === cur)
        .reduce((acc, r) => acc + r.outstanding, 0)
    );

    const outstandingPayable = round2(
      (allDebtItems?.payables || [])
        .filter((p) => p.currency === cur)
        .reduce((acc, p) => acc + p.outstanding, 0)
    );

    return {
      currency: cur,
      personalIncome,
      settlementsReceived,
      settlementsPaid,
      totalMoneyReceived,
      cashOutflowExpenses,
      totalMoneySpent,
      remainingBalance,
      myPersonalExpenses,
      mySharedExpenseShare,
      totalSharedGroupVolume,
      totalMyExpenses,
      outstandingReceivable,
      outstandingPayable
    };
  };

  return {
    AED: computeForCurrency('AED'),
    EGP: computeForCurrency('EGP')
  };
}

// ============================================================================
// MULTI-ACCOUNT & ALL-TIME WALLET BALANCE ENGINE
// ============================================================================

export function getDefaultAccountIdForCurrency(accounts, currency) {
  const list = (accounts || []).filter((a) => a.currency === currency);
  if (list.length === 0) return currency === 'EGP' ? 'acc_cash_egp' : 'acc_cash_aed';
  const cashAcc = list.find((a) => a.type === 'cash');
  return (cashAcc || list[0]).id;
}

/**
 * Computes true, all-time live balances per account (Cash, Debit, Credit, Bank).
 * Legacy transactions/settlements without accountId automatically map to that currency's default account.
 * Strictly ignores pendingTransactions and upcomingTransactions.
 */
export function computeAccountBalances(
  accounts = DEFAULT_ACCOUNTS,
  allTransactions = [],
  allSettlements = [],
  accountTransfers = []
) {
  const accList = Array.isArray(accounts) && accounts.length > 0 ? accounts : DEFAULT_ACCOUNTS;
  const accountIdSet = new Set(accList.map((a) => a.id));

  const map = {};
  accList.forEach((acc) => {
    map[acc.id] = {
      accountId: acc.id,
      startingBalance: round2(acc.startingBalance || 0),
      inflows: 0,
      outflows: 0,
      transfersIn: 0,
      transfersOut: 0,
      balance: round2(acc.startingBalance || 0)
    };
  });

  const resolveAccountId = (rawAccountId, currency) => {
    if (rawAccountId && accountIdSet.has(rawAccountId)) return rawAccountId;
    return getDefaultAccountIdForCurrency(accList, currency);
  };

  (allTransactions || []).forEach((tx) => {
    const amt = round2(tx.amount || 0);
    if (amt <= 0) return;
    const targetId = resolveAccountId(tx.accountId, tx.currency);
    if (!map[targetId]) return;

    if (tx.type === 'income') {
      map[targetId].inflows = round2(map[targetId].inflows + amt);
    } else if (tx.type === 'expense' && tx.paidBy === 'me') {
      map[targetId].outflows = round2(map[targetId].outflows + amt);
    }
  });

  (allSettlements || []).forEach((s) => {
    const amt = round2(s.amount || 0);
    if (amt <= 0) return;
    const targetId = resolveAccountId(s.accountId, s.currency);
    if (!map[targetId]) return;

    if (s.direction === 'receive') {
      map[targetId].inflows = round2(map[targetId].inflows + amt);
    } else if (s.direction === 'pay') {
      map[targetId].outflows = round2(map[targetId].outflows + amt);
    }
  });

  (accountTransfers || []).forEach((tr) => {
    const amt = round2(tr.amount || 0);
    if (amt <= 0) return;
    if (tr.fromAccountId && map[tr.fromAccountId]) {
      map[tr.fromAccountId].transfersOut = round2(map[tr.fromAccountId].transfersOut + amt);
    }
    if (tr.toAccountId && map[tr.toAccountId]) {
      map[tr.toAccountId].transfersIn = round2(map[tr.toAccountId].transfersIn + amt);
    }
  });

  Object.values(map).forEach((entry) => {
    entry.balance = round2(
      entry.startingBalance +
        entry.inflows +
        entry.transfersIn -
        entry.outflows -
        entry.transfersOut
    );
  });

  return map;
}

/**
 * Computes true, cumulative all-time wallet totals across all accounts per currency
 * (including Cash, Debit Cards, Credit Cards, and Bank Accounts uniformly).
 * Independent of any date/month/year filter.
 */
export function computeAllTimeWalletTotals(accounts = DEFAULT_ACCOUNTS, accountBalanceMap = {}) {
  const sumCur = (cur) => {
    const curAccounts = (accounts || []).filter((a) => a.currency === cur);
    const totalBalance = round2(
      curAccounts.reduce((acc, a) => {
        const entry = accountBalanceMap[a.id];
        return acc + (entry ? entry.balance : round2(a.startingBalance || 0));
      }, 0)
    );
    const totalInflows = round2(
      curAccounts.reduce((acc, a) => acc + (accountBalanceMap[a.id]?.inflows || 0), 0)
    );
    const totalOutflows = round2(
      curAccounts.reduce((acc, a) => acc + (accountBalanceMap[a.id]?.outflows || 0), 0)
    );
    return {
      currency: cur,
      totalBalance,
      totalInflows,
      totalOutflows,
      accountCount: curAccounts.length
    };
  };

  return {
    AED: sumCur('AED'),
    EGP: sumCur('EGP')
  };
}

/**
 * Calculates the updated startingBalance needed so an account's live balance
 * equals targetCurrentBalance immediately.
 */
export function computeStartingBalanceForTarget(account, balanceEntry, targetCurrentBalance) {
  const currentStart = round2(account?.startingBalance || 0);
  const currentBal = balanceEntry ? round2(balanceEntry.balance) : currentStart;
  const txDelta = round2(currentBal - currentStart);
  return round2(Number(targetCurrentBalance || 0) - txDelta);
}

/**
 * Checks whether a participant has unsettled debt balances (AED or EGP).
 */
export function getParticipantDebtStatus(personId, allDebtItems) {
  const openReceivables = (allDebtItems?.receivables || []).filter(
    (r) => r.personId === personId && r.outstanding > 0
  );
  const openPayables = (allDebtItems?.payables || []).filter(
    (p) => p.personId === personId && p.outstanding > 0
  );

  const receiveAED = round2(
    openReceivables.filter((r) => r.currency === 'AED').reduce((a, r) => a + r.outstanding, 0)
  );
  const receiveEGP = round2(
    openReceivables.filter((r) => r.currency === 'EGP').reduce((a, r) => a + r.outstanding, 0)
  );
  const payAED = round2(
    openPayables.filter((p) => p.currency === 'AED').reduce((a, p) => a + p.outstanding, 0)
  );
  const payEGP = round2(
    openPayables.filter((p) => p.currency === 'EGP').reduce((a, p) => a + p.outstanding, 0)
  );

  const hasUnsettledBalance = receiveAED > 0 || receiveEGP > 0 || payAED > 0 || payEGP > 0;
  return { hasUnsettledBalance, receiveAED, receiveEGP, payAED, payEGP };
}

// ============================================================================
// DEFAULT SHARING PREFERENCES RESOLVER
// ============================================================================

export function resolveSharingDefaults(defaultSharing, categoryId, activePeople, options = {}) {
  const prefs = defaultSharing || DEFAULT_SHARING_PREFS;
  const activeIds = (activePeople || []).map((p) => p.id);
  const fallbackIds = activeIds.length > 0 ? activeIds : ['me'];

  const categoryRule =
    categoryId && prefs.categoryRules && prefs.categoryRules[categoryId]
      ? prefs.categoryRules[categoryId]
      : null;

  const source = categoryRule || prefs;

  let isShared = source.scope === 'shared';
  if (options.forceShared === true) {
    isShared = true;
  } else if (options.forcePersonal === true) {
    isShared = false;
  }

  const paidBy = activeIds.includes(source.paidBy) ? source.paidBy : 'me';
  const splitMode = ['equal', 'custom', 'percentage'].includes(source.splitMode)
    ? source.splitMode
    : 'equal';

  const rawParticipants = Array.isArray(source.participantIds)
    ? source.participantIds.filter((id) => activeIds.includes(id))
    : [];
  const participantIds = rawParticipants.length > 0 ? rawParticipants : fallbackIds;

  return {
    isShared,
    paidBy,
    splitMode,
    participantIds,
    appliedCategoryRule: Boolean(categoryRule)
  };
}

// ============================================================================
// UPCOMING / SCHEDULED RECURRING TRANSACTIONS ENGINE
// ============================================================================

/**
 * Parse YYYY-MM-DD in UTC-safe integer components and compute calendar day diff.
 */
export function parseDateParts(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return null;
  return { y, m, d };
}

export function getDaysDifference(targetDateStr, fromDateStr = getTodayStr()) {
  const t = parseDateParts(targetDateStr);
  const f = parseDateParts(fromDateStr);
  if (!t || !f) return 0;
  const utcTarget = Date.UTC(t.y, t.m - 1, t.d);
  const utcFrom = Date.UTC(f.y, f.m - 1, f.d);
  return Math.round((utcTarget - utcFrom) / 86400000);
}

export function getDueStatus(dueDateStr, todayStr = getTodayStr()) {
  const diff = getDaysDifference(dueDateStr, todayStr);
  if (diff < 0) {
    const abs = Math.abs(diff);
    return {
      diff,
      label: abs === 1 ? 'Overdue 1 day' : `Overdue ${abs} days`,
      tone: 'overdue'
    };
  }
  if (diff === 0) {
    return { diff: 0, label: 'Due Today', tone: 'today' };
  }
  if (diff === 1) {
    return { diff: 1, label: 'Due Tomorrow', tone: 'soon' };
  }
  if (diff <= 7) {
    return { diff, label: `Due in ${diff} days`, tone: 'soon' };
  }
  return { diff, label: `Due in ${diff} days`, tone: 'upcoming' };
}

/**
 * Advance a YYYY-MM-DD date by 'once' | 'weekly' | 'monthly' | 'yearly'.
 * Clamps end-of-month days safely (e.g., Jan 31 -> Feb 28/29).
 */
export function advanceRecurringDate(dateStr, frequency) {
  const parts = parseDateParts(dateStr);
  if (!parts || !frequency || frequency === 'once') return dateStr;

  const { y, m, d } = parts;
  if (frequency === 'weekly') {
    const dt = new Date(Date.UTC(y, m - 1, d + 7));
    return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
  }
  if (frequency === 'monthly') {
    const targetMonthIndex = m; // 0-indexed next month (m is 1..12, so m is next month in 0-indexed)
    const nextYear = y + Math.floor(targetMonthIndex / 12);
    const nextMonth1Based = (targetMonthIndex % 12) + 1;
    const daysInNextMonth = new Date(Date.UTC(nextYear, nextMonth1Based, 0)).getUTCDate();
    const clampedDay = Math.min(d, daysInNextMonth);
    return `${nextYear}-${pad2(nextMonth1Based)}-${pad2(clampedDay)}`;
  }
  if (frequency === 'yearly') {
    const nextYear = y + 1;
    const daysInNextMonth = new Date(Date.UTC(nextYear, m, 0)).getUTCDate();
    const clampedDay = Math.min(d, daysInNextMonth);
    return `${nextYear}-${pad2(m)}-${pad2(clampedDay)}`;
  }
  return dateStr;
}

/**
 * Converts an upcoming item into a posted transaction on its dueDate,
 * and returns the updated upcomingTransactions list (removing one-time or advancing recurring).
 */
export function confirmUpcomingTransaction(upcomingList, upcomingId, idSuffix = '') {
  const item = (upcomingList || []).find((u) => u.id === upcomingId);
  if (!item) return { postedTransaction: null, nextUpcomingList: upcomingList || [] };

  const postedTransaction = {
    id: `tx_${Date.now()}_${idSuffix || Math.random().toString(36).slice(2, 6)}`,
    type: item.type,
    amount: round2(item.amount),
    currency: item.currency,
    date: item.dueDate,
    categoryId: item.categoryId,
    accountId: item.accountId || '',
    description: item.description,
    isShared: item.type === 'expense' ? Boolean(item.isShared) : false,
    paidBy: item.type === 'expense' ? item.paidBy || 'me' : 'me',
    belongsTo: item.type === 'expense' ? (item.isShared ? 'shared' : item.belongsTo || 'me') : 'me',
    splitMode: item.type === 'expense' && item.isShared ? item.splitMode || 'equal' : 'equal',
    shares: item.type === 'expense' ? item.shares || {} : {},
    notes: item.notes || '',
    isDemo: false
  };

  let nextUpcomingList;
  if (!item.frequency || item.frequency === 'once') {
    nextUpcomingList = (upcomingList || []).filter((u) => u.id !== upcomingId);
  } else {
    const nextDueDate = advanceRecurringDate(item.dueDate, item.frequency);
    nextUpcomingList = (upcomingList || []).map((u) =>
      u.id === upcomingId ? { ...u, dueDate: nextDueDate } : u
    );
  }

  return { postedTransaction, nextUpcomingList };
}

// ============================================================================
// BULK PERIOD DELETION ENGINE
// ============================================================================

export function getPeriodPresetDates(preset, selectedYear, selectedMonth, todayStr = getTodayStr()) {
  if (preset === 'selected_month') {
    const daysInMonth = new Date(Date.UTC(selectedYear, selectedMonth, 0)).getUTCDate();
    return {
      startDate: `${selectedYear}-${pad2(selectedMonth)}-01`,
      endDate: `${selectedYear}-${pad2(selectedMonth)}-${pad2(daysInMonth)}`
    };
  }
  const parts = parseDateParts(todayStr) || { y: 2026, m: 1, d: 1 };
  const dt = new Date(Date.UTC(parts.y, parts.m - 1, parts.d));
  if (preset === 'older_3m') {
    dt.setUTCMonth(dt.getUTCMonth() - 3);
  } else if (preset === 'older_6m') {
    dt.setUTCMonth(dt.getUTCMonth() - 6);
  } else if (preset === 'older_1y') {
    dt.setUTCFullYear(dt.getUTCFullYear() - 1);
  }
  const endDate = `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
  return {
    startDate: '1970-01-01',
    endDate
  };
}

export function isDateInRange(dateStr, startDate, endDate) {
  if (!dateStr || !startDate || !endDate) return false;
  return dateStr >= startDate && dateStr <= endDate;
}

export function previewPeriodDeletion(
  transactions,
  settlements,
  startDate,
  endDate,
  deletionScope = 'transactions_only'
) {
  if (!startDate || !endDate || startDate > endDate) {
    return {
      valid: false,
      aedTxCount: 0,
      egpTxCount: 0,
      totalTxCount: 0,
      aedSetCount: 0,
      egpSetCount: 0,
      totalSetCount: 0
    };
  }

  const matchingTxs = (transactions || []).filter((t) =>
    isDateInRange(t.date, startDate, endDate)
  );
  const matchingSets =
    deletionScope === 'transactions_and_settlements'
      ? (settlements || []).filter((s) => isDateInRange(s.date, startDate, endDate))
      : [];

  const aedTxCount = matchingTxs.filter((t) => t.currency === 'AED').length;
  const egpTxCount = matchingTxs.filter((t) => t.currency === 'EGP').length;
  const aedSetCount = matchingSets.filter((s) => s.currency === 'AED').length;
  const egpSetCount = matchingSets.filter((s) => s.currency === 'EGP').length;

  return {
    valid: true,
    aedTxCount,
    egpTxCount,
    totalTxCount: matchingTxs.length,
    aedSetCount,
    egpSetCount,
    totalSetCount: matchingSets.length
  };
}

export function executePeriodDeletion(
  transactions,
  settlements,
  startDate,
  endDate,
  deletionScope = 'transactions_only'
) {
  const remainingTransactions = (transactions || []).filter(
    (t) => !isDateInRange(t.date, startDate, endDate)
  );
  const remainingTxIds = new Set(remainingTransactions.map((t) => t.id));

  let remainingSettlements = settlements || [];
  if (deletionScope === 'transactions_and_settlements') {
    remainingSettlements = remainingSettlements.filter(
      (s) => !isDateInRange(s.date, startDate, endDate) && remainingTxIds.has(s.transactionId)
    );
  } else {
    remainingSettlements = settlements || [];
  }

  return {
    remainingTransactions,
    remainingSettlements,
    deletedTxCount: (transactions || []).length - remainingTransactions.length,
    deletedSetCount: (settlements || []).length - remainingSettlements.length
  };
}

// ============================================================================
// BACKWARD-COMPATIBLE BACKUP NORMALIZATION & DEMO DATA
// ============================================================================

export function normalizePeopleList(rawPeople) {
  if (!Array.isArray(rawPeople) || rawPeople.length === 0) return DEFAULT_PEOPLE;
  const normalized = rawPeople.map((p, idx) => ({
    id: p.id || (idx === 0 ? 'me' : `p_${idx}`),
    name: p.name || `Person ${idx + 1}`,
    color: p.color || COLOR_PALETTE[idx % COLOR_PALETTE.length],
    archived: p.id === 'me' ? false : Boolean(p.archived)
  }));
  if (!normalized.some((p) => p.id === 'me')) {
    normalized.unshift(DEFAULT_PEOPLE[0]);
  }
  return normalized;
}

export function normalizeSharingPrefs(rawPrefs) {
  if (!rawPrefs || typeof rawPrefs !== 'object') {
    return { ...DEFAULT_SHARING_PREFS, categoryRules: {} };
  }
  return {
    scope: rawPrefs.scope === 'shared' ? 'shared' : 'personal',
    paidBy: rawPrefs.paidBy || 'me',
    splitMode: ['equal', 'custom', 'percentage'].includes(rawPrefs.splitMode)
      ? rawPrefs.splitMode
      : 'equal',
    participantIds:
      Array.isArray(rawPrefs.participantIds) && rawPrefs.participantIds.length > 0
        ? rawPrefs.participantIds
        : ['me', 'p2', 'p3'],
    customPercentages: rawPrefs.customPercentages || {},
    categoryRules:
      rawPrefs.categoryRules && typeof rawPrefs.categoryRules === 'object'
        ? rawPrefs.categoryRules
        : {}
  };
}

export function normalizeAccountsList(rawAccounts) {
  if (!Array.isArray(rawAccounts) || rawAccounts.length === 0) {
    return DEFAULT_ACCOUNTS.map((a) => ({ ...a }));
  }
  const normalized = rawAccounts.map((acc, idx) => ({
    id: acc.id || `acc_${idx}_${Date.now()}`,
    name: String(acc.name || `Account ${idx + 1}`).trim(),
    type: ['cash', 'debit', 'credit', 'bank'].includes(acc.type) ? acc.type : 'cash',
    currency: acc.currency === 'EGP' ? 'EGP' : 'AED',
    last4: String(acc.last4 || '').replace(/\D/g, '').slice(-4),
    startingBalance: round2(acc.startingBalance || 0)
  }));

  if (!normalized.some((a) => a.currency === 'AED')) {
    normalized.unshift({ ...DEFAULT_ACCOUNTS[0] });
  }
  if (!normalized.some((a) => a.currency === 'EGP')) {
    normalized.push({ ...DEFAULT_ACCOUNTS[1] });
  }
  return normalized;
}

export function normalizeAppearancePrefs(rawPrefs) {
  if (!rawPrefs || typeof rawPrefs !== 'object') {
    return { ...DEFAULT_APPEARANCE_PREFS };
  }
  return {
    showLaunchSplash:
      typeof rawPrefs.showLaunchSplash === 'boolean' ? rawPrefs.showLaunchSplash : true
  };
}

export function normalizeImportedBackup(parsed) {
  const payload = parsed?.data ? parsed.data : parsed;
  if (!payload || !Array.isArray(payload.transactions)) {
    return null;
  }
  const accounts = normalizeAccountsList(payload.accounts);
  return {
    people: normalizePeopleList(payload.people),
    sections: Array.isArray(payload.sections) ? payload.sections : DEFAULT_SECTIONS,
    categories: Array.isArray(payload.categories) ? payload.categories : DEFAULT_CATEGORIES,
    accounts,
    accountTransfers: Array.isArray(payload.accountTransfers) ? payload.accountTransfers : [],
    transactions: payload.transactions || [],
    settlements: Array.isArray(payload.settlements) ? payload.settlements : [],
    upcomingTransactions: Array.isArray(payload.upcomingTransactions)
      ? payload.upcomingTransactions
      : [],
    pendingTransactions: Array.isArray(payload.pendingTransactions)
      ? payload.pendingTransactions
      : [],
    dismissedSmsSignatures: Array.isArray(payload.dismissedSmsSignatures)
      ? payload.dismissedSmsSignatures
      : [],
    defaultSharing: normalizeSharingPrefs(payload.defaultSharing),
    appearancePrefs: normalizeAppearancePrefs(payload.appearancePrefs),
    exchangeRate: payload.exchangeRate || 13.55
  };
}

export function buildDemoData() {
  const { year, month } = getCurrentYearMonth();
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const curYM = `${year}-${pad2(month)}`;
  const prevYM = `${prevYear}-${pad2(prevMonth)}`;

  const today = new Date();
  const addDaysStr = (offset) => {
    const dt = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate() + offset));
    return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
  };

  const accounts = [
    {
      id: 'acc_cash_aed',
      name: 'Cash AED',
      type: 'cash',
      currency: 'AED',
      last4: '',
      startingBalance: 1200
    },
    {
      id: 'acc_enbd_1234',
      name: 'Emirates NBD Card 1',
      type: 'debit',
      currency: 'AED',
      last4: '1234',
      startingBalance: 2500
    },
    {
      id: 'acc_wio_5678',
      name: 'Wio Card 2',
      type: 'credit',
      currency: 'AED',
      last4: '5678',
      startingBalance: 0
    },
    {
      id: 'acc_cash_egp',
      name: 'Cash EGP',
      type: 'cash',
      currency: 'EGP',
      last4: '',
      startingBalance: 1500
    },
    {
      id: 'acc_cib_8890',
      name: 'CIB Card',
      type: 'debit',
      currency: 'EGP',
      last4: '8890',
      startingBalance: 4500
    }
  ];

  const transactions = [
    {
      id: 'tx_demo_1',
      type: 'income',
      amount: 14500,
      currency: 'AED',
      date: `${curYM}-01`,
      categoryId: 'cat_salary',
      accountId: 'acc_enbd_1234',
      description: 'Monthly Tech Salary (Dubai)',
      isShared: false,
      paidBy: 'me',
      belongsTo: 'me',
      splitMode: 'equal',
      shares: {},
      notes: 'Direct bank deposit',
      isDemo: true
    },
    {
      id: 'tx_demo_2',
      type: 'expense',
      amount: 900,
      currency: 'AED',
      date: `${curYM}-04`,
      categoryId: 'cat_groceries',
      accountId: 'acc_wio_5678',
      description: 'Carrefour Monthly Household Stock',
      isShared: true,
      paidBy: 'me',
      belongsTo: 'shared',
      splitMode: 'equal',
      shares: { me: 300, p2: 300, p3: 300 },
      notes: 'Split 3 ways equally (300 AED each)',
      isDemo: true
    },
    {
      id: 'tx_demo_3',
      type: 'expense',
      amount: 600,
      currency: 'AED',
      date: `${curYM}-07`,
      categoryId: 'cat_bills',
      accountId: 'acc_enbd_1234',
      description: 'DEWA & High-Speed Fiber Internet',
      isShared: true,
      paidBy: 'p2',
      belongsTo: 'shared',
      splitMode: 'equal',
      shares: { me: 200, p2: 200, p3: 200 },
      notes: 'Paid by Omar, my share is 200 AED',
      isDemo: true
    },
    {
      id: 'tx_demo_4',
      type: 'expense',
      amount: 245,
      currency: 'AED',
      date: `${curYM}-10`,
      categoryId: 'cat_transport',
      accountId: 'acc_cash_aed',
      description: 'RTA Metro & Fuel Top-up',
      isShared: false,
      paidBy: 'me',
      belongsTo: 'me',
      splitMode: 'equal',
      shares: { me: 245 },
      notes: '',
      isDemo: true
    },
    {
      id: 'tx_demo_5',
      type: 'income',
      amount: 22000,
      currency: 'EGP',
      date: `${curYM}-02`,
      categoryId: 'cat_transfer',
      accountId: 'acc_cib_8890',
      description: 'Cairo Bank Account Transfer',
      isShared: false,
      paidBy: 'me',
      belongsTo: 'me',
      splitMode: 'equal',
      shares: {},
      notes: 'Family & local Egypt expenses fund',
      isDemo: true
    },
    {
      id: 'tx_demo_6',
      type: 'expense',
      amount: 3000,
      currency: 'EGP',
      date: `${curYM}-08`,
      categoryId: 'cat_restaurants',
      accountId: 'acc_cib_8890',
      description: 'Group Dinner in Zamalek',
      isShared: true,
      paidBy: 'me',
      belongsTo: 'shared',
      splitMode: 'custom',
      shares: { me: 1000, p2: 1200, p3: 800 },
      notes: 'Custom split based on orders',
      isDemo: true
    },
    {
      id: 'tx_demo_7',
      type: 'expense',
      amount: 4200,
      currency: 'AED',
      date: `${prevYM}-15`,
      categoryId: 'cat_rent',
      accountId: 'acc_enbd_1234',
      description: 'Apartment Rent Contribution',
      isShared: false,
      paidBy: 'me',
      belongsTo: 'me',
      splitMode: 'equal',
      shares: { me: 4200 },
      notes: 'Previous month housing',
      isDemo: true
    },
    {
      id: 'tx_demo_8',
      type: 'income',
      amount: 14500,
      currency: 'AED',
      date: `${prevYM}-01`,
      categoryId: 'cat_salary',
      accountId: 'acc_enbd_1234',
      description: 'Previous Month Salary',
      isShared: false,
      paidBy: 'me',
      belongsTo: 'me',
      splitMode: 'equal',
      shares: {},
      notes: '',
      isDemo: true
    }
  ];

  const settlements = [
    {
      id: 'set_demo_1',
      transactionId: 'tx_demo_2',
      personId: 'p2',
      direction: 'receive',
      amount: 150,
      currency: 'AED',
      accountId: 'acc_cash_aed',
      date: `${curYM}-06`,
      note: 'Partial cash repayment from Omar',
      isDemo: true
    }
  ];

  const accountTransfers = [
    {
      id: 'tr_demo_1',
      fromAccountId: 'acc_enbd_1234',
      toAccountId: 'acc_wio_5678',
      amount: 900,
      currency: 'AED',
      date: `${curYM}-05`,
      note: 'Cleared Wio Card 2 bill',
      isDemo: true
    }
  ];

  const upcomingTransactions = [
    {
      id: 'up_demo_1',
      type: 'expense',
      amount: 450,
      currency: 'AED',
      dueDate: addDaysStr(3),
      categoryId: 'cat_bills',
      accountId: 'acc_enbd_1234',
      description: 'Etisalat Fiber & Mobile Plan',
      isShared: true,
      paidBy: 'me',
      belongsTo: 'shared',
      splitMode: 'equal',
      shares: { me: 150, p2: 150, p3: 150 },
      frequency: 'monthly',
      notes: 'Recurring monthly bill',
      isDemo: true
    },
    {
      id: 'up_demo_2',
      type: 'income',
      amount: 14500,
      currency: 'AED',
      dueDate: addDaysStr(12),
      categoryId: 'cat_salary',
      accountId: 'acc_enbd_1234',
      description: 'Next Monthly Salary',
      isShared: false,
      paidBy: 'me',
      belongsTo: 'me',
      splitMode: 'equal',
      shares: {},
      frequency: 'monthly',
      notes: 'Expected payroll deposit',
      isDemo: true
    }
  ];

  const pendingTransactions = [
    {
      id: 'pend_demo_1',
      signature: 'sms_demo_enbd_68.50',
      sender: 'EmiratesNBD',
      bankName: 'Emirates NBD',
      rawBody:
        'Purchase of AED 68.50 at SPINNEYS DUBAI MARINA using Card ending 1234 on 18/11/2026.',
      timestamp: `${curYM}-18T09:15:00`,
      date: `${curYM}-18`,
      dateTimeLabel: `${curYM}-18 09:15`,
      amount: 68.5,
      currency: 'AED',
      type: 'expense',
      description: 'SPINNEYS DUBAI MARINA',
      detectedLast4: '1234',
      accountId: 'acc_enbd_1234',
      matchedAccountName: 'Emirates NBD Card 1',
      categoryId: 'cat_groceries',
      isShared: false,
      paidBy: 'me',
      belongsTo: 'me',
      splitMode: 'equal',
      participantIds: ['me', 'p2', 'p3'],
      shares: {},
      isDemo: true
    },
    {
      id: 'pend_demo_2',
      signature: 'sms_demo_nbe_450.00',
      sender: 'NBE',
      bankName: 'NBE',
      rawBody: 'Payment of EGP 450.00 at UBER EGYPT via InstaPay.',
      timestamp: `${curYM}-18T11:05:00`,
      date: `${curYM}-18`,
      dateTimeLabel: `${curYM}-18 11:05`,
      amount: 450,
      currency: 'EGP',
      type: 'expense',
      description: 'UBER EGYPT',
      detectedLast4: '',
      accountId: '',
      matchedAccountName: '',
      categoryId: 'cat_transport',
      isShared: false,
      paidBy: 'me',
      belongsTo: 'me',
      splitMode: 'equal',
      participantIds: ['me', 'p2', 'p3'],
      shares: {},
      isDemo: true
    }
  ];

  return {
    accounts,
    accountTransfers,
    transactions,
    settlements,
    upcomingTransactions,
    pendingTransactions
  };
}
