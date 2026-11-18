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
  DEFAULT_PEOPLE,
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
});

