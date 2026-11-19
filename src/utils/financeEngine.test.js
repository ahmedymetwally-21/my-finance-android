import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeEqualShares,
  computeEqualPercentages,
  computePercentageShares,
  computeDebtItems,
  computeFinancialSummary,
  computeAccountBalances,
  computeAllTimeWalletTotals,
  computeStartingBalanceForTarget,
  computeHierarchicalBudgets,
  splitSectionBudgetEqually,
  getBudgetHealthStatus,
  getCurrencyUsage,
  normalizeCurrenciesList,
  getDefaultAccountIdForCurrency,
  getParticipantDebtStatus,
  resolveSharingDefaults,
  advanceRecurringDate,
  getDueStatus,
  confirmUpcomingTransaction,
  previewPeriodDeletion,
  executePeriodDeletion,
  normalizeImportedBackup,
  getPeriodPresetDates,
  DEFAULT_ACCOUNTS,
  DEFAULT_CATEGORIES,
  DEFAULT_CURRENCIES,
  DEFAULT_PEOPLE,
  DEFAULT_SECTIONS,
  DEFAULT_SHARING_PREFS
} from './financeEngine.js';
import {
  parseBankSms,
  splitRawSmsInput,
  buildPendingFromParsedSms,
  computeSmsSignature
} from './bankSmsParser.js';

test('computeEqualShares distributes cents accurately across 4 and 5 participants', () => {
  const shares4 = computeEqualShares(100, ['me', 'p2', 'p3', 'p4']);
  assert.deepEqual(shares4, { me: 25, p2: 25, p3: 25, p4: 25 });

  const shares3 = computeEqualShares(100, ['me', 'p2', 'p3']);
  assert.equal(shares3.me + shares3.p2 + shares3.p3, 100);
  assert.deepEqual(shares3, { me: 33.34, p2: 33.33, p3: 33.33 });

  const shares5 = computeEqualShares(100.03, ['me', 'p2', 'p3', 'p4', 'p5']);
  const total5 = Object.values(shares5).reduce((a, b) => a + b, 0);
  assert.equal(Math.round(total5 * 100), 10003);
});

test('computePercentageShares and computeEqualPercentages sum strictly to total', () => {
  const pcts = computeEqualPercentages(['me', 'p2', 'p3', 'p4']);
  assert.deepEqual(pcts, { me: '25', p2: '25', p3: '25', p4: '25' });

  const shares = computePercentageShares(350, ['me', 'p2', 'p3', 'p4'], {
    me: '40',
    p2: '30',
    p3: '20',
    p4: '10'
  });
  assert.deepEqual(shares, { me: 140, p2: 105, p3: 70, p4: 35 });
});

test('computeDebtItems and getParticipantDebtStatus support unlimited dynamic participants', () => {
  const txs = [
    {
      id: 'tx_1',
      type: 'expense',
      amount: 400,
      currency: 'AED',
      date: '2026-11-10',
      categoryId: 'cat_groceries',
      description: 'Dinner for 4',
      isShared: true,
      paidBy: 'me',
      shares: { me: 100, p2: 100, p3: 100, p4_lina: 100 }
    },
    {
      id: 'tx_2',
      type: 'expense',
      amount: 300,
      currency: 'EGP',
      date: '2026-11-11',
      categoryId: 'cat_transport',
      description: 'Uber paid by Lina',
      isShared: true,
      paidBy: 'p4_lina',
      shares: { me: 150, p4_lina: 150 }
    }
  ];
  const settlements = [
    {
      id: 's_1',
      transactionId: 'tx_1',
      personId: 'p4_lina',
      direction: 'receive',
      amount: 40,
      currency: 'AED',
      date: '2026-11-12'
    }
  ];

  const debts = computeDebtItems(txs, settlements);
  assert.equal(debts.receivables.length, 3);
  assert.equal(debts.payables.length, 1);

  const linaDebt = getParticipantDebtStatus('p4_lina', debts);
  assert.equal(linaDebt.hasUnsettledBalance, true);
  assert.equal(linaDebt.receiveAED, 60);
  assert.equal(linaDebt.payEGP, 150);

  const p2Debt = getParticipantDebtStatus('p2', debts);
  assert.equal(p2Debt.receiveAED, 100);
});

test('resolveSharingDefaults applies global and per-category override rules', () => {
  const activePeople = [
    { id: 'me', name: 'Me' },
    { id: 'p2', name: 'Omar' },
    { id: 'p4', name: 'Lina' }
  ];
  const prefs = {
    scope: 'personal',
    paidBy: 'me',
    splitMode: 'equal',
    participantIds: ['me', 'p2'],
    categoryRules: {
      cat_groceries: {
        scope: 'shared',
        paidBy: 'p2',
        splitMode: 'percentage',
        participantIds: ['me', 'p2', 'p4']
      }
    }
  };

  const general = resolveSharingDefaults(prefs, 'cat_transport', activePeople);
  assert.equal(general.isShared, false);
  assert.equal(general.paidBy, 'me');
  assert.equal(general.appliedCategoryRule, false);

  const groceries = resolveSharingDefaults(prefs, 'cat_groceries', activePeople);
  assert.equal(groceries.isShared, true);
  assert.equal(groceries.paidBy, 'p2');
  assert.equal(groceries.splitMode, 'percentage');
  assert.deepEqual(groceries.participantIds, ['me', 'p2', 'p4']);
  assert.equal(groceries.appliedCategoryRule, true);
});

test('upcoming scheduling math, due badges, and accounting isolation work correctly', () => {
  assert.equal(advanceRecurringDate('2026-01-31', 'monthly'), '2026-02-28');
  assert.equal(advanceRecurringDate('2026-11-18', 'weekly'), '2026-11-25');
  assert.equal(advanceRecurringDate('2024-02-29', 'yearly'), '2025-02-28');

  assert.equal(getDueStatus('2026-11-16', '2026-11-18').tone, 'overdue');
  assert.equal(getDueStatus('2026-11-18', '2026-11-18').label, 'Due Today');
  assert.equal(getDueStatus('2026-11-21', '2026-11-18').label, 'Due in 3 days');

  const upcoming = [
    {
      id: 'up_1',
      type: 'expense',
      amount: 500,
      currency: 'AED',
      dueDate: '2026-11-20',
      categoryId: 'cat_bills',
      accountId: 'acc_enbd',
      description: 'DEWA Bill',
      isShared: true,
      paidBy: 'me',
      splitMode: 'equal',
      shares: { me: 250, p2: 250 },
      frequency: 'monthly'
    }
  ];

  // Before confirmation: actual transactions = [] -> remainingBalance is 0
  const emptyDebts = computeDebtItems([], []);
  const beforeSummary = computeFinancialSummary([], [], emptyDebts);
  assert.equal(beforeSummary.AED.remainingBalance, 0);
  assert.equal(beforeSummary.AED.outstandingReceivable, 0);

  // Confirm & Post
  const { postedTransaction, nextUpcomingList } = confirmUpcomingTransaction(upcoming, 'up_1', 'test');
  assert.equal(postedTransaction.date, '2026-11-20');
  assert.equal(postedTransaction.amount, 500);
  assert.equal(postedTransaction.accountId, 'acc_enbd');
  assert.equal(nextUpcomingList.length, 1);
  assert.equal(nextUpcomingList[0].dueDate, '2026-12-20');

  const afterDebts = computeDebtItems([postedTransaction], []);
  const afterSummary = computeFinancialSummary([postedTransaction], [], afterDebts);
  assert.equal(afterSummary.AED.remainingBalance, -500);
  assert.equal(afterSummary.AED.outstandingReceivable, 250);
});

test('bulk period deletion previews AED/EGP counts and executes accurately', () => {
  const txs = [
    { id: 't1', date: '2026-09-05', currency: 'AED', type: 'expense', amount: 100 },
    { id: 't2', date: '2026-09-12', currency: 'EGP', type: 'expense', amount: 500 },
    { id: 't3', date: '2026-11-01', currency: 'AED', type: 'income', amount: 5000 }
  ];
  const sets = [
    { id: 's1', transactionId: 't1', date: '2026-09-10', currency: 'AED', amount: 50 },
    { id: 's2', transactionId: 't3', date: '2026-11-05', currency: 'AED', amount: 20 }
  ];

  const monthRange = getPeriodPresetDates('selected_month', 2026, 9, '2026-11-18');
  assert.deepEqual(monthRange, { startDate: '2026-09-01', endDate: '2026-09-30' });

  const preview = previewPeriodDeletion(
    txs,
    sets,
    monthRange.startDate,
    monthRange.endDate,
    'transactions_and_settlements'
  );
  assert.equal(preview.aedTxCount, 1);
  assert.equal(preview.egpTxCount, 1);
  assert.equal(preview.aedSetCount, 1);

  const execOnlyTx = executePeriodDeletion(
    txs,
    sets,
    monthRange.startDate,
    monthRange.endDate,
    'transactions_only'
  );
  assert.equal(execOnlyTx.remainingTransactions.length, 1);
  assert.equal(execOnlyTx.remainingSettlements.length, 2);

  const execBoth = executePeriodDeletion(
    txs,
    sets,
    monthRange.startDate,
    monthRange.endDate,
    'transactions_and_settlements'
  );
  assert.equal(execBoth.remainingTransactions.length, 1);
  assert.equal(execBoth.remainingSettlements.length, 1);
});

test('multi-account all-time wallet totals include credit cards, fallback legacy accounts, and handle transfers & direct adjustment', () => {
  const accounts = [
    { id: 'acc_cash_aed', name: 'Cash AED', type: 'cash', currency: 'AED', last4: '', startingBalance: 1000 },
    { id: 'acc_enbd', name: 'ENBD Card 1', type: 'debit', currency: 'AED', last4: '1234', startingBalance: 2000 },
    { id: 'acc_wio', name: 'Wio Credit', type: 'credit', currency: 'AED', last4: '5678', startingBalance: 0 },
    { id: 'acc_cash_egp', name: 'Cash EGP', type: 'cash', currency: 'EGP', last4: '', startingBalance: 500 }
  ];

  const transactions = [
    // Legacy tx without accountId -> goes to Cash AED
    { id: 't_old', type: 'income', amount: 500, currency: 'AED', date: '2026-09-01', paidBy: 'me' },
    // Salary into ENBD
    { id: 't_sal', type: 'income', amount: 10000, currency: 'AED', accountId: 'acc_enbd', date: '2026-10-01', paidBy: 'me' },
    // Credit card purchase
    { id: 't_cc', type: 'expense', amount: 400, currency: 'AED', accountId: 'acc_wio', date: '2026-11-05', paidBy: 'me' },
    // Paid by someone else (must not deduct my account balance!)
    { id: 't_other', type: 'expense', amount: 600, currency: 'AED', accountId: 'acc_cash_aed', date: '2026-11-06', paidBy: 'p2' },
    // EGP cash spend
    { id: 't_egp', type: 'expense', amount: 200, currency: 'EGP', accountId: 'acc_cash_egp', date: '2026-11-07', paidBy: 'me' }
  ];

  const settlements = [
    { id: 's1', transactionId: 't_cc', personId: 'p2', direction: 'receive', amount: 150, currency: 'AED', accountId: 'acc_cash_aed', date: '2026-11-08' }
  ];

  const transfers = [
    // ATM withdrawal or card payoff: ENBD -> Wio Credit 400 AED
    { id: 'tr1', fromAccountId: 'acc_enbd', toAccountId: 'acc_wio', amount: 400, currency: 'AED', date: '2026-11-09' }
  ];

  const balMap = computeAccountBalances(accounts, transactions, settlements, transfers);
  // Cash AED: 1000 + 500 (t_old) + 150 (s1) = 1650
  assert.equal(balMap.acc_cash_aed.balance, 1650);
  // ENBD: 2000 + 10000 - 400 (transfer out) = 11600
  assert.equal(balMap.acc_enbd.balance, 11600);
  // Wio Credit: 0 - 400 (t_cc) + 400 (transfer in) = 0
  assert.equal(balMap.acc_wio.balance, 0);
  // Cash EGP: 500 - 200 = 300
  assert.equal(balMap.acc_cash_egp.balance, 300);

  const walletTotals = computeAllTimeWalletTotals(accounts, balMap);
  assert.equal(walletTotals.AED.totalBalance, 13250);
  assert.equal(walletTotals.EGP.totalBalance, 300);

  // Period summary for Nov 2026 only should NOT include Oct salary or transfers as expenses
  const novTxs = transactions.filter((t) => t.date.startsWith('2026-11'));
  const novSets = settlements.filter((s) => s.date.startsWith('2026-11'));
  const debts = computeDebtItems(transactions, settlements);
  const novSummary = computeFinancialSummary(novTxs, novSets, debts);
  assert.equal(novSummary.AED.personalIncome, 0);
  assert.equal(novSummary.AED.cashOutflowExpenses, 400);

  // Direct balance adjustment helper: make ENBD live balance 12000
  const newStart = computeStartingBalanceForTarget(accounts[1], balMap.acc_enbd, 12000);
  assert.equal(newStart, 2400);

  const adjustedAccounts = accounts.map((a) =>
    a.id === 'acc_enbd' ? { ...a, startingBalance: newStart } : a
  );
  const balMapAfter = computeAccountBalances(adjustedAccounts, transactions, settlements, transfers);
  assert.equal(balMapAfter.acc_enbd.balance, 12000);
  assert.equal(getDefaultAccountIdForCurrency(accounts, 'AED'), 'acc_cash_aed');
});

test('parseBankSms parses UAE & Egyptian bank alerts, matches last 4 digits, ignores OTP/promo, and leaves unknown blank', () => {
  // 1. Emirates NBD AED Purchase with comma amount and last 4
  const enbd = parseBankSms(
    'EmiratesNBD',
    'Purchase of AED 1,250.50 at CARREFOUR MALL OF EMIRATES using Card ending 1234 on 18/11/2026. Avl Bal AED 4,000.00.',
    '2026-11-18T10:30:00Z'
  );
  assert.ok(enbd);
  assert.equal(enbd.bankName, 'Emirates NBD');
  assert.equal(enbd.currency, 'AED');
  assert.equal(enbd.amount, 1250.5);
  assert.equal(enbd.type, 'expense');
  assert.equal(enbd.detectedLast4, '1234');
  assert.match(enbd.description, /CARREFOUR/i);

  // 2. Wio XX5678
  const wio = parseBankSms('Wio', 'AED 42.00 spent at STARBUCKS DUBAI via Wio Card XX5678 on 18-11-2026.');
  assert.ok(wio);
  assert.equal(wio.bankName, 'Wio Bank');
  assert.equal(wio.detectedLast4, '5678');
  assert.equal(wio.type, 'expense');

  // 3. CIB Egypt EGP *8890
  const cib = parseBankSms('CIB', 'Your CIB credit card *8890 was charged EGP 3,400.00 at TALABAT EGYPT on 18/11/2026.');
  assert.ok(cib);
  assert.equal(cib.currency, 'EGP');
  assert.equal(cib.amount, 3400);
  assert.equal(cib.detectedLast4, '8890');
  assert.equal(cib.type, 'expense');

  // 4. NBE Income without card digits -> accountId must stay blank ''
  const nbe = parseBankSms('NBE', 'Inward transfer credited with EGP 5,000.00 from Ahmed Hassan via InstaPay on 18/11/2026.');
  assert.ok(nbe);
  assert.equal(nbe.type, 'income');
  assert.equal(nbe.currency, 'EGP');
  assert.equal(nbe.amount, 5000);
  assert.equal(nbe.detectedLast4, '');

  // 5. OTP and Promo rejection
  assert.equal(
    parseBankSms('ADCB', 'Your OTP is 849201 for an online purchase of AED 950.00. Do not share this code.'),
    null
  );
  assert.equal(
    parseBankSms('Mashreq', 'Pre-approved Cashback Offer! Enjoy 10% discount up to AED 500. Click here bit.ly/promo'),
    null
  );

  // 6. Signature determinism & pending builder dedup + blank fallback
  assert.equal(
    computeSmsSignature('EmiratesNBD', 1250.5, '2026-11-18T10:30:00Z'),
    computeSmsSignature('emiratesnbd', '1250.50', '2026-11-18t10:30:00z')
  );

  const accounts = [
    ...DEFAULT_ACCOUNTS,
    { id: 'acc_enbd_1234', name: 'ENBD Card 1', type: 'debit', currency: 'AED', last4: '1234', startingBalance: 0 }
  ];

  const batch = splitRawSmsInput(
    [
      'EmiratesNBD\nPurchase of AED 120.00 at SPINNEYS DUBAI using Card ending 1234 on 18/11/2026.',
      'NBE\nInward transfer credited with EGP 5,000.00 from Ahmed via InstaPay on 18/11/2026.',
      'ADCB\nYour OTP is 123456 for AED 99.00 purchase. Never share this OTP.'
    ].join('\n\n')
  );

  const built = buildPendingFromParsedSms({
    parsedSmsList: batch,
    accounts,
    categories: DEFAULT_CATEGORIES,
    defaultSharing: DEFAULT_SHARING_PREFS,
    people: DEFAULT_PEOPLE,
    existingPending: [],
    knownSignatures: []
  });

  assert.equal(built.items.length, 2);
  assert.equal(built.ignoredCount, 1);
  assert.equal(built.items[0].accountId, 'acc_enbd_1234');
  assert.equal(built.items[1].accountId, '');

  // Re-scanning same batch deduplicates both
  const builtDup = buildPendingFromParsedSms({
    parsedSmsList: batch,
    accounts,
    categories: DEFAULT_CATEGORIES,
    defaultSharing: DEFAULT_SHARING_PREFS,
    people: DEFAULT_PEOPLE,
    existingPending: built.items,
    knownSignatures: []
  });
  assert.equal(builtDup.items.length, 0);
  assert.equal(builtDup.duplicateCount, 2);

  // 7. Single-newline separated standalone SMS (OTP + valid Mashreq alert)
  const singleNewlineBatch = splitRawSmsInput(
    'Your OTP verification code is 849201.\nMashreq: Purchase of AED 120.00 at ADNOC STATION on 18/11/2026 using Card XX1234.'
  );
  assert.equal(singleNewlineBatch.length, 2);
  const builtSingle = buildPendingFromParsedSms({
    parsedSmsList: singleNewlineBatch,
    accounts,
    categories: DEFAULT_CATEGORIES,
    defaultSharing: DEFAULT_SHARING_PREFS,
    people: DEFAULT_PEOPLE,
    existingPending: [],
    knownSignatures: []
  });
  assert.equal(builtSingle.items.length, 1);
  assert.equal(builtSingle.ignoredCount, 1);
  assert.equal(builtSingle.items[0].bankName, 'Mashreq');
  assert.equal(builtSingle.items[0].accountId, 'acc_enbd_1234');
});

test('normalizeImportedBackup maintains backward compatibility with v1, v2 & v3 JSON backups', () => {
  const legacyBackup = {
    appIdentifier: 'DirhamAndPoundFinance',
    schemaVersion: 1,
    data: {
      people: [
        { id: 'me', name: 'Me', color: '#4f46e5' },
        { id: 'p2', name: 'Omar', color: '#0d9488' }
      ],
      transactions: [{ id: 'tx_old', type: 'income', amount: 1000, currency: 'AED', date: '2026-01-01' }]
    }
  };
  const normalized = normalizeImportedBackup(legacyBackup);
  assert.ok(normalized);
  assert.equal(normalized.upcomingTransactions.length, 0);
  assert.equal(normalized.pendingTransactions.length, 0);
  assert.equal(normalized.accounts.length, 2);
  assert.equal(normalized.accounts[0].name, 'Cash AED');
  assert.equal(normalized.accounts[1].name, 'Cash EGP');
  assert.equal(normalized.defaultSharing.scope, 'personal');
  assert.equal(normalized.people[1].archived, false);
  assert.equal(normalized.currencies.length, 2);
  assert.equal(normalized.primaryCurrency, 'AED');
  assert.equal(normalized.appearancePrefs.theme, 'dark');
  assert.deepEqual(normalized.budgets, {});
  assert.equal(normalized.userProfile.displayName, 'SmartLedger User');
});

test('hierarchical budgeting computes section/part spend, cent-safe equal splits, over-allocation, and health thresholds', () => {
  // Cent-safe equal split
  const equal3 = splitSectionBudgetEqually(2000, ['cat_groceries', 'cat_restaurants', 'cat_transport']);
  assert.equal(
    Math.round((equal3.cat_groceries + equal3.cat_restaurants + equal3.cat_transport) * 100),
    200000
  );
  assert.equal(equal3.cat_groceries, 666.67);
  assert.equal(equal3.cat_restaurants, 666.67);
  assert.equal(equal3.cat_transport, 666.66);

  // Health thresholds: <75% healthy, 75-99% warning, >=100% over
  assert.equal(getBudgetHealthStatus(500, 1000).status, 'healthy');
  assert.equal(getBudgetHealthStatus(750, 1000).status, 'warning');
  assert.equal(getBudgetHealthStatus(990, 1000).status, 'warning');
  assert.equal(getBudgetHealthStatus(1000, 1000).status, 'over');
  assert.equal(getBudgetHealthStatus(1200, 1000).status, 'over');

  const budgets = {
    AED: {
      sec_daily: {
        sectionBudget: 2000,
        parts: {
          cat_groceries: 1200,
          cat_restaurants: 500,
          cat_transport: 200 // Total allocated = 1900 -> 100 unallocated
        }
      },
      sec_housing: {
        sectionBudget: 1000,
        parts: {
          cat_rent: 800,
          cat_bills: 400 // Total allocated = 1200 -> 200 over-allocated!
        }
      }
    }
  };

  const periodTransactions = [
    // Shared groceries: total 1200, my share 400
    {
      id: 't1',
      type: 'expense',
      amount: 1200,
      currency: 'AED',
      categoryId: 'cat_groceries',
      isShared: true,
      paidBy: 'me',
      shares: { me: 400, p2: 400, p3: 400 }
    },
    // Restaurants personal: 450 (90% of 500 -> warning)
    {
      id: 't2',
      type: 'expense',
      amount: 450,
      currency: 'AED',
      categoryId: 'cat_restaurants',
      isShared: false,
      paidBy: 'me',
      shares: { me: 450 }
    },
    // Transport personal: 250 (125% of 200 -> over)
    {
      id: 't3',
      type: 'expense',
      amount: 250,
      currency: 'AED',
      categoryId: 'cat_transport',
      isShared: false,
      paidBy: 'me',
      shares: { me: 250 }
    },
    // EGP expense must NOT affect AED budget
    {
      id: 't4',
      type: 'expense',
      amount: 5000,
      currency: 'EGP',
      categoryId: 'cat_groceries',
      isShared: false,
      paidBy: 'me',
      shares: { me: 5000 }
    }
  ];

  const report = computeHierarchicalBudgets({
    sections: DEFAULT_SECTIONS,
    categories: DEFAULT_CATEGORIES,
    budgets,
    periodTransactions,
    currency: 'AED'
  });

  const daily = report.sections.find((s) => s.section.id === 'sec_daily');
  assert.ok(daily);
  assert.equal(daily.sectionBudget, 2000);
  assert.equal(daily.allocatedPartsTotal, 1900);
  assert.equal(daily.unallocated, 100);
  assert.equal(daily.overAllocatedBy, 0);
  assert.equal(daily.isOverAllocated, false);
  assert.equal(daily.sectionSpent, 1100); // 400 + 450 + 250
  assert.equal(daily.sectionRemaining, 900);
  assert.equal(daily.status, 'healthy');

  const restPart = daily.parts.find((p) => p.category.id === 'cat_restaurants');
  const transPart = daily.parts.find((p) => p.category.id === 'cat_transport');
  assert.equal(restPart.status, 'warning');
  assert.equal(transPart.status, 'over');
  assert.equal(transPart.remaining, -50);

  const housing = report.sections.find((s) => s.section.id === 'sec_housing');
  assert.equal(housing.isOverAllocated, true);
  assert.equal(housing.overAllocatedBy, 200);
});

test('dynamic multi-currency isolation, deletion protection, and custom SMS currency detection work cleanly', () => {
  const currencies = normalizeCurrenciesList([
    ...DEFAULT_CURRENCIES,
    { code: 'USD', name: 'US Dollar', symbol: '$' },
    { code: 'SAR', name: 'Saudi Riyal', symbol: 'SAR' }
  ]);
  assert.equal(currencies.length, 4);

  const accounts = [
    ...DEFAULT_ACCOUNTS,
    { id: 'acc_usd_1', name: 'US Checking', type: 'bank', currency: 'USD', last4: '4321', startingBalance: 1000 }
  ];
  const txs = [
    {
      id: 'tx_usd_1',
      type: 'expense',
      amount: 200,
      currency: 'USD',
      accountId: 'acc_usd_1',
      date: '2026-11-10',
      isShared: true,
      paidBy: 'me',
      shares: { me: 100, p2: 100 }
    }
  ];

  // USD is in use; SAR is unused and safe to delete
  const usdUsage = getCurrencyUsage('USD', { accounts, transactions: txs });
  const sarUsage = getCurrencyUsage('SAR', { accounts, transactions: txs });
  assert.equal(usdUsage.inUse, true);
  assert.equal(usdUsage.accountCount, 1);
  assert.equal(usdUsage.txCount, 1);
  assert.equal(sarUsage.inUse, false);

  // Strict multi-currency isolation in Wallet, Cashflow & Participant Debt
  const balMap = computeAccountBalances(accounts, txs, [], []);
  const walletTotals = computeAllTimeWalletTotals(accounts, balMap, currencies);
  assert.equal(walletTotals.USD.totalBalance, 800);
  assert.equal(walletTotals.AED.totalBalance, 0);
  assert.equal(walletTotals.SAR.totalBalance, 0);

  const debts = computeDebtItems(txs, []);
  const summary = computeFinancialSummary(txs, [], debts, currencies);
  assert.equal(summary.USD.totalMyExpenses, 100);
  assert.equal(summary.USD.outstandingReceivable, 100);
  assert.equal(summary.AED.totalMyExpenses, 0);

  const p2Debt = getParticipantDebtStatus('p2', debts, currencies);
  assert.equal(p2Debt.hasUnsettledBalance, true);
  assert.equal(p2Debt.byCurrency.USD.receive, 100);
  assert.equal(p2Debt.byCurrency.AED.receive, 0);

  // Multi-currency Bank SMS parsing (USD & SAR)
  const usdSms = parseBankSms(
    'Wio',
    'Purchase of USD 149.99 at AMAZON.COM using Card ending 4321 on 18/11/2026.',
    '2026-11-18T14:00:00Z',
    currencies
  );
  assert.ok(usdSms);
  assert.equal(usdSms.currency, 'USD');
  assert.equal(usdSms.amount, 149.99);
  assert.equal(usdSms.detectedLast4, '4321');

  const sarSms = parseBankSms(
    'AlRajhi',
    'Purchase of SAR 85.00 at ALBAIK RIYADH on 18/11/2026.',
    '2026-11-18T16:00:00Z',
    currencies
  );
  assert.ok(sarSms);
  assert.equal(sarSms.currency, 'SAR');
  assert.equal(sarSms.amount, 85);

  const built = buildPendingFromParsedSms({
    parsedSmsList: [{ sender: 'Wio', body: 'Purchase of $45.50 at OPENAI using Card *4321 on 18/11/2026.' }],
    accounts,
    categories: DEFAULT_CATEGORIES,
    defaultSharing: DEFAULT_SHARING_PREFS,
    people: DEFAULT_PEOPLE,
    currencies,
    existingPending: [],
    knownSignatures: []
  });
  assert.equal(built.items.length, 1);
  assert.equal(built.items[0].currency, 'USD');
  assert.equal(built.items[0].accountId, 'acc_usd_1');
});

test('normalizeImportedBackup roundtrips v4 schema with custom currencies, budgets, profile, and light theme', () => {
  const v4Backup = {
    appIdentifier: 'SmartLedgerFinance',
    schemaVersion: 4,
    data: {
      currencies: [
        ...DEFAULT_CURRENCIES,
        { code: 'EUR', name: 'Euro', symbol: '€', builtIn: false }
      ],
      primaryCurrency: 'EUR',
      budgets: {
        EUR: {
          sec_daily: { sectionBudget: 900, parts: { cat_groceries: 500, cat_restaurants: 400 } }
        }
      },
      userProfile: {
        displayName: 'Karim Mansour',
        avatarDataUrl: 'data:image/jpeg;base64,/9j/4AAQ'
      },
      appearancePrefs: {
        showLaunchSplash: false,
        theme: 'light'
      },
      transactions: []
    }
  };

  const restored = normalizeImportedBackup(v4Backup);
  assert.ok(restored);
  assert.equal(restored.currencies.length, 3);
  assert.equal(restored.primaryCurrency, 'EUR');
  assert.equal(restored.budgets.EUR.sec_daily.sectionBudget, 900);
  assert.equal(restored.userProfile.displayName, 'Karim Mansour');
  assert.equal(restored.appearancePrefs.theme, 'light');
  assert.equal(restored.appearancePrefs.showLaunchSplash, false);
});


