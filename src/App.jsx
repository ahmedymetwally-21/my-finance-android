import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowRightLeft,
  ArrowUpRight,
  BarChart3,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Coins,
  Download,
  Edit3,
  LayoutDashboard,
  MessageSquareText,
  Plus,
  Scale,
  Search,
  Settings,
  Share2,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Users,
  X
} from 'lucide-react';
import {
  CategoryIcon,
  CurrencyFilterPills,
  ToastNotification,
  shareOrDownloadFile,
  shareTextSummary
} from './components/SharedUI.jsx';
import UpcomingSection from './components/UpcomingSection.jsx';
import TransactionModal from './components/TransactionModal.jsx';
import SettingsView from './components/SettingsView.jsx';
import PendingSection from './components/PendingSection.jsx';
import { AccountsManagerModal, TransferModal } from './components/AccountsManagerModal.jsx';
import { LaunchSplashScreen, SmartLedgerLogo } from './components/SmartLedgerLogo.jsx';
import {
  DEFAULT_APPEARANCE_PREFS,
  DEFAULT_CATEGORIES,
  DEFAULT_PEOPLE,
  DEFAULT_SECTIONS,
  DEFAULT_SHARING_PREFS,
  LEGACY_STORAGE_KEY,
  STORAGE_KEY,
  buildDemoData,
  computeAccountBalances,
  computeAllTimeWalletTotals,
  computeDebtItems,
  computeEqualShares,
  computeFinancialSummary,
  computePercentageShares,
  confirmUpcomingTransaction,
  formatCompact,
  formatMoney,
  getCurrentYearMonth,
  getDefaultAccountIdForCurrency,
  getEffectiveShares,
  getTodayStr,
  normalizeAccountsList,
  normalizeAppearancePrefs,
  normalizePeopleList,
  normalizeSharingPrefs,
  pad2,
  round2
} from './utils/financeEngine.js';
import { buildPendingFromParsedSms, splitRawSmsInput } from './utils/bankSmsParser.js';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function App() {
  // Inject Android PWA Manifest, Theme Color & Mobile Viewport Ergonomics on Mount
  useEffect(() => {
    const ensureMeta = (name, content) => {
      let el = document.querySelector(`meta[name="${name}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute('name', name);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    ensureMeta('theme-color', '#0f172a');
    ensureMeta('mobile-web-app-capable', 'yes');
    ensureMeta('apple-mobile-web-app-capable', 'yes');
    ensureMeta('apple-mobile-web-app-status-bar-style', 'black-translucent');

    const styleId = 'android-native-ergonomics';
    if (!document.getElementById(styleId)) {
      const styleEl = document.createElement('style');
      styleEl.id = styleId;
      styleEl.textContent = `
        * { -webkit-tap-highlight-color: transparent; }
        body { overscroll-behavior-y: contain; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `;
      document.head.appendChild(styleEl);
    }

    const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="24" fill="#0f172a"/><rect x="20" y="18" width="60" height="32" rx="9" fill="#10b981"/><rect x="16" y="33" width="68" height="48" rx="12" fill="#f8fafc"/><rect x="56" y="47" width="28" height="20" rx="10" fill="#059669"/><circle cx="66" cy="57" r="4.2" fill="#ecfdf5"/></svg>`;
    const iconUrl = `data:image/svg+xml;base64,${btoa(iconSvg)}`;
    const manifestObj = {
      name: 'SmartLedger — Personal & Shared Finance',
      short_name: 'SmartLedger',
      description: 'Dual-currency AED & EGP personal finance, multi-account cards, and Bank SMS ledger',
      start_url: '.',
      display: 'standalone',
      orientation: 'portrait',
      background_color: '#0f172a',
      theme_color: '#0f172a',
      icons: [
        { src: iconUrl, sizes: '192x192', type: 'image/svg+xml', purpose: 'any maskable' },
        { src: iconUrl, sizes: '512x512', type: 'image/svg+xml', purpose: 'any maskable' }
      ]
    };

    const manifestBlob = new Blob([JSON.stringify(manifestObj)], {
      type: 'application/manifest+json'
    });
    const manifestUrl = URL.createObjectURL(manifestBlob);
    let linkEl = document.querySelector('link[rel="manifest"]');
    if (!linkEl) {
      linkEl = document.createElement('link');
      linkEl.setAttribute('rel', 'manifest');
      document.head.appendChild(linkEl);
    }
    linkEl.setAttribute('href', manifestUrl);

    return () => {
      URL.revokeObjectURL(manifestUrl);
    };
  }, []);

  // Load persisted state (backward-compatible with v1, v2 & v3 schemas)
  const loadInitialState = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.transactions)) {
          let standalonePending = [];
          try {
            const pRaw = localStorage.getItem('pendingTransactions');
            if (pRaw) standalonePending = JSON.parse(pRaw);
          } catch {
            standalonePending = [];
          }
          const pendingList = Array.isArray(parsed.pendingTransactions)
            ? parsed.pendingTransactions
            : Array.isArray(standalonePending)
            ? standalonePending
            : [];

          return {
            people: normalizePeopleList(parsed.people),
            sections: parsed.sections || DEFAULT_SECTIONS,
            categories: parsed.categories || DEFAULT_CATEGORIES,
            accounts: normalizeAccountsList(parsed.accounts),
            accountTransfers: Array.isArray(parsed.accountTransfers) ? parsed.accountTransfers : [],
            transactions: parsed.transactions || [],
            settlements: parsed.settlements || [],
            upcomingTransactions: Array.isArray(parsed.upcomingTransactions)
              ? parsed.upcomingTransactions
              : [],
            pendingTransactions: pendingList,
            dismissedSmsSignatures: Array.isArray(parsed.dismissedSmsSignatures)
              ? parsed.dismissedSmsSignatures
              : [],
            defaultSharing: normalizeSharingPrefs(parsed.defaultSharing),
            appearancePrefs: normalizeAppearancePrefs(parsed.appearancePrefs),
            exchangeRate: parsed.exchangeRate || 13.55
          };
        }
      }
    } catch (e) {
      console.error('Failed to load state from localStorage:', e);
    }
    const demo = buildDemoData();
    return {
      people: DEFAULT_PEOPLE,
      sections: DEFAULT_SECTIONS,
      categories: DEFAULT_CATEGORIES,
      accounts: demo.accounts,
      accountTransfers: demo.accountTransfers,
      transactions: demo.transactions,
      settlements: demo.settlements,
      upcomingTransactions: demo.upcomingTransactions,
      pendingTransactions: demo.pendingTransactions,
      dismissedSmsSignatures: [],
      defaultSharing: { ...DEFAULT_SHARING_PREFS, categoryRules: {} },
      appearancePrefs: { ...DEFAULT_APPEARANCE_PREFS },
      exchangeRate: 13.55
    };
  };

  const initial = useMemo(() => loadInitialState(), []);

  // Core Persistent State
  const [people, setPeople] = useState(initial.people);
  const [sections, setSections] = useState(initial.sections);
  const [categories, setCategories] = useState(initial.categories);
  const [accounts, setAccounts] = useState(initial.accounts);
  const [accountTransfers, setAccountTransfers] = useState(initial.accountTransfers);
  const [transactions, setTransactions] = useState(initial.transactions);
  const [settlements, setSettlements] = useState(initial.settlements);
  const [upcomingTransactions, setUpcomingTransactions] = useState(initial.upcomingTransactions);
  const [pendingTransactions, setPendingTransactions] = useState(initial.pendingTransactions);
  const [dismissedSmsSignatures, setDismissedSmsSignatures] = useState(
    initial.dismissedSmsSignatures
  );
  const [defaultSharing, setDefaultSharing] = useState(initial.defaultSharing);
  const [appearancePrefs, setAppearancePrefs] = useState(initial.appearancePrefs);
  const [exchangeRate, setExchangeRate] = useState(initial.exchangeRate);

  // Launch Splash Screen (skips when ?autostart=1 or disabled in Branding settings)
  const [splashVisible, setSplashVisible] = useState(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('autostart=1')) {
      return false;
    }
    return initial.appearancePrefs?.showLaunchSplash !== false;
  });
  const handleSplashComplete = useCallback(() => setSplashVisible(false), []);

  // Navigation & Period State
  const [activeTab, setActiveTab] = useState('dashboard');
  const { year: curY, month: curM } = useMemo(() => getCurrentYearMonth(), []);
  const [selectedYear, setSelectedYear] = useState(curY);
  const [selectedMonth, setSelectedMonth] = useState(curM);
  const [periodMode, setPeriodMode] = useState('month'); // 'month' | 'year' | 'all'

  // Modals & Notifications
  const [txModalOpen, setTxModalOpen] = useState(false);
  const [txModalDefaults, setTxModalDefaults] = useState({
    type: 'expense',
    forceShared: false,
    mode: 'posted'
  });
  const [editingTx, setEditingTx] = useState(null);
  const [editingUpcoming, setEditingUpcoming] = useState(null);
  const [editingPending, setEditingPending] = useState(null);
  const [settlementModalItem, setSettlementModalItem] = useState(null);
  const [accountsModalOpen, setAccountsModalOpen] = useState(false);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferInitialCurrency, setTransferInitialCurrency] = useState('AED');
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // Auto-save to localStorage (including standalone pendingTransactions mirror)
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          schemaVersion: 3,
          updatedAt: new Date().toISOString(),
          people,
          sections,
          categories,
          accounts,
          accountTransfers,
          transactions,
          settlements,
          upcomingTransactions,
          pendingTransactions,
          dismissedSmsSignatures,
          defaultSharing,
          appearancePrefs,
          exchangeRate
        })
      );
      localStorage.setItem('pendingTransactions', JSON.stringify(pendingTransactions));
    } catch (e) {
      console.error('Failed to persist state:', e);
    }
  }, [
    people,
    sections,
    categories,
    accounts,
    accountTransfers,
    transactions,
    settlements,
    upcomingTransactions,
    pendingTransactions,
    dismissedSmsSignatures,
    defaultSharing,
    appearancePrefs,
    exchangeRate
  ]);

  // Lookup helpers
  const getPerson = useCallback(
    (id) => people.find((p) => p.id === id) || { id, name: id, color: '#64748b', archived: false },
    [people]
  );

  const getCategory = useCallback(
    (id) =>
      categories.find((c) => c.id === id) || {
        id,
        name: 'Uncategorized',
        icon: 'Receipt',
        color: '#64748b',
        sectionId: ''
      },
    [categories]
  );

  const getSection = useCallback(
    (id) => sections.find((s) => s.id === id) || { id, name: 'General' },
    [sections]
  );

  const getAccount = useCallback(
    (id, currency) => {
      if (id) {
        const found = accounts.find((a) => a.id === id);
        if (found) return found;
      }
      const fallbackId = getDefaultAccountIdForCurrency(accounts, currency || 'AED');
      return (
        accounts.find((a) => a.id === fallbackId) || {
          id: fallbackId,
          name: currency === 'EGP' ? 'Cash EGP' : 'Cash AED',
          last4: '',
          currency: currency || 'AED'
        }
      );
    },
    [accounts]
  );

  const hasDemoData = useMemo(
    () =>
      transactions.some((t) => t.isDemo) ||
      settlements.some((s) => s.isDemo) ||
      upcomingTransactions.some((u) => u.isDemo) ||
      pendingTransactions.some((p) => p.isDemo) ||
      accountTransfers.some((tr) => tr.isDemo),
    [transactions, settlements, upcomingTransactions, pendingTransactions, accountTransfers]
  );

  const handleClearDemoData = () => {
    setTransactions((prev) => prev.filter((t) => !t.isDemo));
    setSettlements((prev) => prev.filter((s) => !s.isDemo));
    setUpcomingTransactions((prev) => prev.filter((u) => !u.isDemo));
    setPendingTransactions((prev) => prev.filter((p) => !p.isDemo));
    setAccountTransfers((prev) => prev.filter((tr) => !tr.isDemo));
    showToast('Sample demo data cleared — ready for your real records!');
  };

  const periodLabel = useMemo(() => {
    if (periodMode === 'all') return 'All Time';
    if (periodMode === 'year') return `Year ${selectedYear}`;
    return `${MONTH_NAMES[selectedMonth - 1].slice(0, 3)} ${selectedYear}`;
  }, [periodMode, selectedYear, selectedMonth]);

  const handlePrevPeriod = () => {
    if (periodMode === 'all') {
      setPeriodMode('month');
      return;
    }
    if (periodMode === 'year') {
      setSelectedYear((y) => y - 1);
      return;
    }
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear((y) => y - 1);
    } else {
      setSelectedMonth((m) => m - 1);
    }
  };

  const handleNextPeriod = () => {
    if (periodMode === 'all') {
      setPeriodMode('month');
      return;
    }
    if (periodMode === 'year') {
      setSelectedYear((y) => y + 1);
      return;
    }
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear((y) => y + 1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
  };

  const matchesPeriod = useCallback(
    (dateStr) => {
      if (!dateStr || periodMode === 'all') return true;
      const [yStr, mStr] = dateStr.split('-');
      const y = Number(yStr);
      const m = Number(mStr);
      if (periodMode === 'year') return y === selectedYear;
      return y === selectedYear && m === selectedMonth;
    },
    [periodMode, selectedYear, selectedMonth]
  );

  const periodTransactions = useMemo(() => {
    return transactions
      .filter((t) => matchesPeriod(t.date))
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [transactions, matchesPeriod]);

  const periodSettlements = useMemo(() => {
    return settlements.filter((s) => matchesPeriod(s.date));
  }, [settlements, matchesPeriod]);

  // CORE DEBT, ALL-TIME ACCOUNT BALANCES & PERIOD CASHFLOW ENGINES
  // Strictly exclude upcomingTransactions and pendingTransactions!
  const allDebtItems = useMemo(
    () => computeDebtItems(transactions, settlements),
    [transactions, settlements]
  );

  const financialSummary = useMemo(
    () => computeFinancialSummary(periodTransactions, periodSettlements, allDebtItems),
    [periodTransactions, periodSettlements, allDebtItems]
  );

  const accountBalanceMap = useMemo(
    () => computeAccountBalances(accounts, transactions, settlements, accountTransfers),
    [accounts, transactions, settlements, accountTransfers]
  );

  const allTimeWalletTotals = useMemo(
    () => computeAllTimeWalletTotals(accounts, accountBalanceMap),
    [accounts, accountBalanceMap]
  );

  // ============================================================================
  // BANK SMS INGESTION, HOOKS & PENDING QUEUE HANDLERS
  // ============================================================================

  const smsStateRef = useRef({
    accounts,
    categories,
    defaultSharing,
    people,
    pendingTransactions,
    dismissedSmsSignatures,
    transactions
  });

  useEffect(() => {
    smsStateRef.current = {
      accounts,
      categories,
      defaultSharing,
      people,
      pendingTransactions,
      dismissedSmsSignatures,
      transactions
    };
  }, [
    accounts,
    categories,
    defaultSharing,
    people,
    pendingTransactions,
    dismissedSmsSignatures,
    transactions
  ]);

  const ingestRawSmsEntries = useCallback(
    (rawEntries, { silentIfEmpty = false } = {}) => {
      const ctx = smsStateRef.current;
      const knownSignatures = [
        ...(ctx.dismissedSmsSignatures || []),
        ...(ctx.transactions || []).map((t) => t.smsSignature).filter(Boolean)
      ];

      const { items, duplicateCount, ignoredCount } = buildPendingFromParsedSms({
        parsedSmsList: rawEntries,
        accounts: ctx.accounts,
        categories: ctx.categories,
        defaultSharing: ctx.defaultSharing,
        people: ctx.people,
        existingPending: ctx.pendingTransactions,
        knownSignatures
      });

      if (items.length > 0) {
        const mergedPending = [...items, ...(ctx.pendingTransactions || [])];
        smsStateRef.current = {
          ...ctx,
          pendingTransactions: mergedPending
        };
        setPendingTransactions((prev) => {
          const existingSigs = new Set(prev.map((p) => p.signature).filter(Boolean));
          const uniqueItems = items.filter((it) => !it.signature || !existingSigs.has(it.signature));
          return uniqueItems.length > 0 ? [...uniqueItems, ...prev] : prev;
        });
        showToast(
          `Queued ${items.length} bank alert${items.length > 1 ? 's' : ''} in Pending${
            duplicateCount > 0 ? ` (${duplicateCount} duplicate skipped)` : ''
          }`
        );
      } else if (!silentIfEmpty) {
        if (duplicateCount > 0) {
          showToast(`No new alerts (${duplicateCount} already scanned)`);
        } else if (ignoredCount > 0) {
          showToast('Ignored OTP / promotional or unrecognized SMS messages', 'error');
        } else {
          showToast('No valid bank SMS messages found');
        }
      }
      return items.length;
    },
    [showToast]
  );

  useEffect(() => {
    window.onBankSmsReceived = (smsObj) => {
      if (!smsObj || (!smsObj.body && !smsObj.sender)) return 0;
      return ingestRawSmsEntries([smsObj], { silentIfEmpty: true });
    };
    return () => {
      if (window.onBankSmsReceived) {
        delete window.onBankSmsReceived;
      }
    };
  }, [ingestRawSmsEntries]);

  const handleScanDeviceBankSms = async () => {
    if (typeof window.scanDeviceBankSms !== 'function') {
      showToast(
        'Device SMS bridge unavailable in browser — use "Paste SMS" to import bank alerts',
        'error'
      );
      return;
    }
    try {
      const rawList = await Promise.resolve(window.scanDeviceBankSms());
      if (!Array.isArray(rawList) || rawList.length === 0) {
        showToast('No recent bank SMS found on device');
        return;
      }
      ingestRawSmsEntries(rawList);
    } catch {
      showToast('Unable to read device SMS alerts', 'error');
    }
  };

  const handlePasteRawSms = (rawText) => {
    const entries = splitRawSmsInput(rawText);
    return ingestRawSmsEntries(entries);
  };

  const handleUpdatePendingItem = (pendingId, patch) => {
    setPendingTransactions((prev) =>
      prev.map((item) => (item.id === pendingId ? { ...item, ...patch } : item))
    );
  };

  const handleQuickFinalizePending = (pendingItem) => {
    if (!pendingItem.accountId) {
      showToast(
        `Select an Account or Card (${pendingItem.currency}) before finalizing "${pendingItem.description}"`,
        'error'
      );
      return;
    }

    const activeIds = people.filter((p) => !p.archived).map((p) => p.id);
    const participants =
      Array.isArray(pendingItem.participantIds) && pendingItem.participantIds.length > 0
        ? pendingItem.participantIds.filter((id) => activeIds.includes(id))
        : activeIds;

    let shares = {};
    if (pendingItem.type === 'expense') {
      if (pendingItem.isShared) {
        if (pendingItem.splitMode === 'percentage' && defaultSharing?.customPercentages) {
          shares = computePercentageShares(
            pendingItem.amount,
            participants,
            defaultSharing.customPercentages
          );
        } else {
          shares = computeEqualShares(pendingItem.amount, participants);
        }
      } else {
        shares = { [pendingItem.belongsTo || 'me']: round2(pendingItem.amount) };
      }
    }

    const postedTx = {
      id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: pendingItem.type,
      amount: round2(pendingItem.amount),
      currency: pendingItem.currency,
      accountId: pendingItem.accountId,
      date: pendingItem.date || getTodayStr(),
      categoryId: pendingItem.categoryId,
      description: pendingItem.description,
      isShared: pendingItem.type === 'expense' ? Boolean(pendingItem.isShared) : false,
      paidBy: pendingItem.type === 'expense' ? pendingItem.paidBy || 'me' : 'me',
      belongsTo:
        pendingItem.type === 'expense'
          ? pendingItem.isShared
            ? 'shared'
            : pendingItem.belongsTo || 'me'
          : 'me',
      splitMode: pendingItem.type === 'expense' && pendingItem.isShared ? 'equal' : 'equal',
      shares,
      notes: `Imported from ${pendingItem.bankName || pendingItem.sender} SMS`,
      smsSignature: pendingItem.signature || '',
      isDemo: false
    };

    setTransactions((prev) => [postedTx, ...prev]);
    setPendingTransactions((prev) => prev.filter((p) => p.id !== pendingItem.id));
    if (pendingItem.signature) {
      setDismissedSmsSignatures((prev) =>
        prev.includes(pendingItem.signature) ? prev : [...prev, pendingItem.signature]
      );
    }
    showToast(`Finalized "${postedTx.description}" into ${postedTx.currency} ledger`);
  };

  const handleEditAndFinalizePending = (pendingItem) => {
    setEditingTx(null);
    setEditingUpcoming(null);
    setEditingPending(pendingItem);
    setTxModalOpen(true);
  };

  const handleFinalizePendingFromModal = (pendingId, payload, entryMode) => {
    const target = pendingTransactions.find((p) => p.id === pendingId);
    if (entryMode === 'upcoming') {
      const newUp = {
        ...payload,
        id: `up_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
      };
      setUpcomingTransactions((prev) => [newUp, ...prev]);
      showToast(`Scheduled pending item for ${payload.dueDate}`);
    } else {
      const newTx = {
        ...payload,
        smsSignature: target?.signature || '',
        id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
      };
      setTransactions((prev) => [newTx, ...prev]);
      showToast(`Finalized "${newTx.description}"`);
    }

    setPendingTransactions((prev) => prev.filter((p) => p.id !== pendingId));
    if (target?.signature) {
      setDismissedSmsSignatures((prev) =>
        prev.includes(target.signature) ? prev : [...prev, target.signature]
      );
    }
    setTxModalOpen(false);
    setEditingPending(null);
  };

  const handleDismissPending = (pendingId) => {
    const target = pendingTransactions.find((p) => p.id === pendingId);
    if (target?.signature) {
      setDismissedSmsSignatures((prev) =>
        prev.includes(target.signature) ? prev : [...prev, target.signature]
      );
    }
    setPendingTransactions((prev) => prev.filter((p) => p.id !== pendingId));
    showToast('Pending SMS alert dismissed');
  };

  const handleSaveTransfer = (transferPayload) => {
    const newTransfer = {
      ...transferPayload,
      id: `tr_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      isDemo: false
    };
    setAccountTransfers((prev) => [newTransfer, ...prev]);
    setTransferModalOpen(false);
    showToast(`Transferred ${formatMoney(newTransfer.amount, newTransfer.currency)}`);
  };

  // ============================================================================
  // TRANSACTION, UPCOMING & SETTLEMENT HANDLERS
  // ============================================================================

  const openQuickAdd = (type = 'expense', forceShared = false, mode = 'posted') => {
    setEditingTx(null);
    setEditingUpcoming(null);
    setEditingPending(null);
    setTxModalDefaults({ type, forceShared, mode });
    setTxModalOpen(true);
  };

  const openEditTx = (tx) => {
    setEditingUpcoming(null);
    setEditingPending(null);
    setEditingTx(tx);
    setTxModalOpen(true);
  };

  const openEditUpcoming = (item) => {
    setEditingTx(null);
    setEditingPending(null);
    setEditingUpcoming(item);
    setTxModalOpen(true);
  };

  const handleSavePostedTransaction = (txPayload) => {
    if (editingTx) {
      setTransactions((prev) =>
        prev.map((t) => (t.id === editingTx.id ? { ...txPayload, id: editingTx.id } : t))
      );
      setSettlements((prev) =>
        prev.filter((s) => {
          if (s.transactionId !== editingTx.id) return true;
          if (txPayload.type !== 'expense') return false;
          const shares = getEffectiveShares(txPayload);
          if (txPayload.paidBy === 'me' && s.direction === 'receive') {
            return (shares[s.personId] || 0) > 0;
          }
          if (
            txPayload.paidBy !== 'me' &&
            s.direction === 'pay' &&
            s.personId === txPayload.paidBy
          ) {
            return (shares.me || 0) > 0;
          }
          return false;
        })
      );
      showToast('Transaction updated & balances recalculated');
    } else {
      const newTx = {
        ...txPayload,
        id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
      };
      setTransactions((prev) => [newTx, ...prev]);
      showToast(`${txPayload.type === 'income' ? 'Income' : 'Expense'} added`);
    }
    setTxModalOpen(false);
    setEditingTx(null);
    setEditingUpcoming(null);
  };

  const handleSaveUpcomingTransaction = (upPayload) => {
    if (editingUpcoming) {
      setUpcomingTransactions((prev) =>
        prev.map((u) => (u.id === editingUpcoming.id ? { ...upPayload, id: editingUpcoming.id } : u))
      );
      showToast('Scheduled item updated');
    } else {
      const newUpcoming = {
        ...upPayload,
        id: `up_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
      };
      setUpcomingTransactions((prev) => [newUpcoming, ...prev]);
      showToast(
        `Scheduled ${upPayload.type === 'income' ? 'income' : 'expense'} for ${upPayload.dueDate}`
      );
    }
    setTxModalOpen(false);
    setEditingTx(null);
    setEditingUpcoming(null);
  };

  const handleDeleteTransaction = (txId) => {
    setTransactions((prev) => prev.filter((t) => t.id !== txId));
    setSettlements((prev) => prev.filter((s) => s.transactionId !== txId));
    showToast('Transaction deleted & related balances updated');
  };

  const handleDeleteUpcoming = (upId) => {
    setUpcomingTransactions((prev) => prev.filter((u) => u.id !== upId));
    showToast('Scheduled item removed');
  };

  const handleConfirmUpcoming = (upId) => {
    const target = upcomingTransactions.find((u) => u.id === upId);
    if (!target) return;
    const { postedTransaction, nextUpcomingList } = confirmUpcomingTransaction(
      upcomingTransactions,
      upId
    );
    if (!postedTransaction) return;

    setTransactions((prev) => [postedTransaction, ...prev]);
    setUpcomingTransactions(nextUpcomingList);

    const updated = nextUpcomingList.find((u) => u.id === upId);
    if (updated) {
      showToast(
        `Posted "${postedTransaction.description}" & scheduled next (${updated.dueDate})`
      );
    } else {
      showToast(`Posted "${postedTransaction.description}" to actual transactions`);
    }
  };

  const handleRecordSettlement = ({
    transactionId,
    personId,
    direction,
    amount,
    currency,
    accountId,
    date,
    note
  }) => {
    const newSettlement = {
      id: `set_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      transactionId,
      personId,
      direction,
      amount: round2(amount),
      currency,
      accountId: accountId || getDefaultAccountIdForCurrency(accounts, currency),
      date,
      note
    };
    setSettlements((prev) => [newSettlement, ...prev]);
    setSettlementModalItem(null);
    showToast(
      direction === 'receive'
        ? `Recorded ${formatMoney(amount, currency)} received`
        : `Recorded ${formatMoney(amount, currency)} paid`
    );
  };

  const handleDeleteSettlement = (settlementId) => {
    setSettlements((prev) => prev.filter((s) => s.id !== settlementId));
    showToast('Settlement entry removed');
  };

  return (
    <div className="min-h-[100dvh] bg-slate-50 text-slate-900 pb-[calc(6.25rem+env(safe-area-inset-bottom))] font-sans selection:bg-emerald-100 selection:text-emerald-900">
      <LaunchSplashScreen enabled={splashVisible} onComplete={handleSplashComplete} />
      <ToastNotification toast={toast} onClose={() => setToast(null)} />

      {/* ANDROID TOP APP BAR WITH SAFE AREA TOP */}
      <header className="sticky top-0 z-30 bg-slate-900 text-white pt-[env(safe-area-inset-top)] shadow-md">
        <div className="max-w-lg md:max-w-3xl mx-auto px-3.5 h-15 flex items-center justify-between gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className="flex items-center gap-2 min-h-[48px] text-left touch-manipulation active:scale-[0.97] transition shrink-0"
          >
            <SmartLedgerLogo size={36} className="shrink-0 shadow-sm" />
            <div className="hidden sm:block">
              <h1 className="text-sm font-extrabold tracking-tight text-white leading-none">
                SmartLedger
              </h1>
              <p className="text-[10px] font-semibold text-emerald-400 mt-0.5">AED · EGP Ledger</p>
            </div>
          </button>

          <div className="flex items-center bg-slate-800 rounded-2xl p-0.5 border border-slate-700/80 select-none">
            <button
              type="button"
              onClick={handlePrevPeriod}
              aria-label="Previous Period"
              className="w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center rounded-xl text-slate-300 hover:bg-slate-700 hover:text-white active:scale-95 touch-manipulation transition"
            >
              <ChevronLeft size={19} />
            </button>
            <button
              type="button"
              onClick={() =>
                setPeriodMode((prev) =>
                  prev === 'month' ? 'year' : prev === 'year' ? 'all' : 'month'
                )
              }
              title="Tap to cycle: Month → Annual → All-Time"
              className="min-h-[40px] px-2 text-xs sm:text-sm font-extrabold text-white min-w-[92px] sm:min-w-[120px] text-center hover:text-emerald-300 active:scale-95 touch-manipulation transition"
            >
              {periodLabel}
            </button>
            <button
              type="button"
              onClick={handleNextPeriod}
              aria-label="Next Period"
              className="w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center rounded-xl text-slate-300 hover:bg-slate-700 hover:text-white active:scale-95 touch-manipulation transition"
            >
              <ChevronRight size={19} />
            </button>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('transactions')}
              aria-label={`Pending Bank SMS (${pendingTransactions.length})`}
              title="Pending Bank SMS Queue"
              className="relative w-11 h-11 rounded-2xl flex items-center justify-center bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700 transition touch-manipulation active:scale-95"
            >
              <MessageSquareText size={18} />
              {pendingTransactions.length > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-slate-950 text-[10px] font-extrabold flex items-center justify-center">
                  {pendingTransactions.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              aria-label="Settings & Backup"
              className={`w-11 h-11 rounded-2xl flex items-center justify-center border transition touch-manipulation active:scale-95 ${
                activeTab === 'settings'
                  ? 'bg-emerald-600 border-emerald-500 text-white'
                  : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
              }`}
            >
              <Settings size={19} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-lg md:max-w-3xl mx-auto px-3.5 pt-4">
        {hasDemoData && (
          <div className="mb-4 p-3.5 rounded-2xl bg-indigo-50 border border-indigo-200/90 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <Sparkles size={18} className="text-indigo-600 shrink-0" />
              <p className="text-xs font-semibold text-indigo-950 leading-snug">
                Sample AED &amp; EGP records are loaded so you can explore multi-account wallets, SMS queue &amp; splits.
              </p>
            </div>
            <button
              type="button"
              onClick={handleClearDemoData}
              className="shrink-0 min-h-[38px] px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-extrabold touch-manipulation"
            >
              Clear Sample
            </button>
          </div>
        )}

        {activeTab === 'dashboard' && (
          <DashboardView
            summary={financialSummary}
            allTimeWalletTotals={allTimeWalletTotals}
            accounts={accounts}
            accountBalanceMap={accountBalanceMap}
            pendingTransactions={pendingTransactions}
            periodLabel={periodLabel}
            periodMode={periodMode}
            setPeriodMode={setPeriodMode}
            recentTransactions={periodTransactions.slice(0, 6)}
            upcomingTransactions={upcomingTransactions}
            categories={categories}
            getPerson={getPerson}
            getCategory={getCategory}
            getAccount={getAccount}
            onQuickAdd={openQuickAdd}
            onEditTx={openEditTx}
            onEditUpcoming={openEditUpcoming}
            onDeleteUpcoming={handleDeleteUpcoming}
            onConfirmUpcoming={handleConfirmUpcoming}
            onOpenAccountsModal={() => setAccountsModalOpen(true)}
            onOpenTransferModal={(cur = 'AED') => {
              setTransferInitialCurrency(cur);
              setTransferModalOpen(true);
            }}
            onScanDeviceSms={handleScanDeviceBankSms}
            onPasteRawSms={handlePasteRawSms}
            onUpdatePendingItem={handleUpdatePendingItem}
            onQuickFinalizePending={handleQuickFinalizePending}
            onEditAndFinalizePending={handleEditAndFinalizePending}
            onDismissPending={handleDismissPending}
            onNavigate={setActiveTab}
            exchangeRate={exchangeRate}
            setExchangeRate={setExchangeRate}
          />
        )}

        {activeTab === 'transactions' && (
          <TransactionsView
            transactions={periodTransactions}
            upcomingTransactions={upcomingTransactions}
            pendingTransactions={pendingTransactions}
            accounts={accounts}
            allTransactionsCount={transactions.length}
            periodLabel={periodLabel}
            sections={sections}
            categories={categories}
            getPerson={getPerson}
            getCategory={getCategory}
            getSection={getSection}
            getAccount={getAccount}
            onQuickAdd={openQuickAdd}
            onEditTx={openEditTx}
            onDeleteTx={handleDeleteTransaction}
            onEditUpcoming={openEditUpcoming}
            onDeleteUpcoming={handleDeleteUpcoming}
            onConfirmUpcoming={handleConfirmUpcoming}
            onScanDeviceSms={handleScanDeviceBankSms}
            onPasteRawSms={handlePasteRawSms}
            onUpdatePendingItem={handleUpdatePendingItem}
            onQuickFinalizePending={handleQuickFinalizePending}
            onEditAndFinalizePending={handleEditAndFinalizePending}
            onDismissPending={handleDismissPending}
          />
        )}

        {activeTab === 'shared' && (
          <SharedExpensesView
            transactions={periodTransactions.filter(
              (t) =>
                t.type === 'expense' &&
                (t.isShared || t.paidBy !== 'me' || (t.belongsTo && t.belongsTo !== 'me'))
            )}
            allDebtItems={allDebtItems}
            periodLabel={periodLabel}
            people={people}
            getPerson={getPerson}
            getCategory={getCategory}
            onQuickAdd={() => openQuickAdd('expense', true, 'posted')}
            onEditTx={openEditTx}
            onDeleteTx={handleDeleteTransaction}
            onNavigate={setActiveTab}
          />
        )}

        {activeTab === 'balances' && (
          <BalancesView
            allDebtItems={allDebtItems}
            people={people}
            getPerson={getPerson}
            getCategory={getCategory}
            onOpenSettle={(item) => setSettlementModalItem(item)}
            onDeleteSettlement={handleDeleteSettlement}
            showToast={showToast}
          />
        )}

        {activeTab === 'reports' && (
          <ReportsView
            transactions={transactions}
            periodTransactions={periodTransactions}
            summary={financialSummary}
            selectedYear={selectedYear}
            selectedMonth={selectedMonth}
            periodLabel={periodLabel}
            people={people}
            getPerson={getPerson}
            getCategory={getCategory}
            getSection={getSection}
            showToast={showToast}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            people={people}
            setPeople={setPeople}
            sections={sections}
            setSections={setSections}
            categories={categories}
            setCategories={setCategories}
            accounts={accounts}
            setAccounts={setAccounts}
            accountBalanceMap={accountBalanceMap}
            accountTransfers={accountTransfers}
            setAccountTransfers={setAccountTransfers}
            transactions={transactions}
            setTransactions={setTransactions}
            settlements={settlements}
            setSettlements={setSettlements}
            upcomingTransactions={upcomingTransactions}
            setUpcomingTransactions={setUpcomingTransactions}
            pendingTransactions={pendingTransactions}
            setPendingTransactions={setPendingTransactions}
            dismissedSmsSignatures={dismissedSmsSignatures}
            setDismissedSmsSignatures={setDismissedSmsSignatures}
            defaultSharing={defaultSharing}
            setDefaultSharing={setDefaultSharing}
            appearancePrefs={appearancePrefs}
            setAppearancePrefs={setAppearancePrefs}
            allDebtItems={allDebtItems}
            selectedYear={selectedYear}
            selectedMonth={selectedMonth}
            exchangeRate={exchangeRate}
            setExchangeRate={setExchangeRate}
            onOpenTransfer={() => {
              setTransferInitialCurrency('AED');
              setTransferModalOpen(true);
            }}
            showToast={showToast}
          />
        )}
      </main>

      {/* THUMB-REACHABLE FLOATING ACTION BUTTON */}
      <button
        type="button"
        onClick={() => openQuickAdd('expense', activeTab === 'shared', 'posted')}
        aria-label="Quick Add Transaction"
        className="fixed z-30 right-4 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] h-14 px-5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-extrabold text-sm shadow-xl shadow-indigo-600/35 flex items-center gap-2 touch-manipulation select-none transition-transform"
      >
        <Plus size={22} strokeWidth={2.75} />
        <span>Quick Add</span>
      </button>

      {/* BOTTOM NAVIGATION BAR */}
      <nav
        aria-label="Main navigation"
        className="fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200/90 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_20px_rgba(0,0,0,0.05)] select-none"
      >
        <div className="max-w-lg md:max-w-3xl mx-auto px-1 h-17 flex items-center justify-around">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { id: 'transactions', label: 'Transactions', icon: ArrowLeftRight },
            { id: 'shared', label: 'Shared', icon: Users },
            { id: 'balances', label: 'Balances', icon: Scale },
            { id: 'reports', label: 'Reports', icon: BarChart3 }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const badgeCount = tab.id === 'transactions' ? pendingTransactions.length : 0;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center justify-center flex-1 min-h-[54px] py-1 rounded-2xl transition-all touch-manipulation active:scale-95 ${
                  isActive ? 'text-indigo-700' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <div
                  className={`relative px-3.5 py-1 rounded-full transition-all ${
                    isActive ? 'bg-indigo-100 text-indigo-700' : ''
                  }`}
                >
                  <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                  {badgeCount > 0 && (
                    <span className="absolute -top-0.5 right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-amber-500 text-slate-950 text-[9px] font-extrabold flex items-center justify-center">
                      {badgeCount}
                    </span>
                  )}
                </div>
                <span
                  className={`text-[10px] sm:text-[11px] mt-0.5 ${
                    isActive ? 'font-extrabold' : 'font-semibold'
                  }`}
                >
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* TRANSACTION ADD / EDIT / PENDING FINALIZE MODAL */}
      {txModalOpen && (
        <TransactionModal
          editingTx={editingTx}
          editingUpcoming={editingUpcoming}
          editingPending={editingPending}
          defaults={txModalDefaults}
          people={people}
          sections={sections}
          categories={categories}
          accounts={accounts}
          defaultSharing={defaultSharing}
          onClose={() => {
            setTxModalOpen(false);
            setEditingTx(null);
            setEditingUpcoming(null);
            setEditingPending(null);
          }}
          onSavePosted={handleSavePostedTransaction}
          onSaveUpcoming={handleSaveUpcomingTransaction}
          onFinalizePending={handleFinalizePendingFromModal}
        />
      )}

      {/* ACCOUNTS & CARDS MANAGER MODAL */}
      {accountsModalOpen && (
        <AccountsManagerModal
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
          onOpenTransfer={() => {
            setAccountsModalOpen(false);
            setTransferInitialCurrency('AED');
            setTransferModalOpen(true);
          }}
          onClose={() => setAccountsModalOpen(false)}
          showToast={showToast}
        />
      )}

      {/* ACCOUNT-TO-ACCOUNT TRANSFER MODAL */}
      {transferModalOpen && (
        <TransferModal
          accounts={accounts}
          initialCurrency={transferInitialCurrency}
          onClose={() => setTransferModalOpen(false)}
          onSaveTransfer={handleSaveTransfer}
        />
      )}

      {/* SETTLEMENT RECORDING MODAL */}
      {settlementModalItem && (
        <SettlementModal
          item={settlementModalItem}
          accounts={accounts}
          getPerson={getPerson}
          onClose={() => setSettlementModalItem(null)}
          onSubmit={handleRecordSettlement}
        />
      )}
    </div>
  );
}

// ============================================================================
// 1. DASHBOARD VIEW
// ============================================================================

function DashboardView({
  summary,
  allTimeWalletTotals,
  accounts,
  accountBalanceMap,
  pendingTransactions,
  periodLabel,
  periodMode,
  setPeriodMode,
  recentTransactions,
  upcomingTransactions,
  categories,
  getPerson,
  getCategory,
  getAccount,
  onQuickAdd,
  onEditTx,
  onEditUpcoming,
  onDeleteUpcoming,
  onConfirmUpcoming,
  onOpenAccountsModal,
  onOpenTransferModal,
  onScanDeviceSms,
  onPasteRawSms,
  onUpdatePendingItem,
  onQuickFinalizePending,
  onEditAndFinalizePending,
  onDismissPending,
  onNavigate,
  exchangeRate,
  setExchangeRate
}) {
  const [converterAmount, setConverterAmount] = useState('1000');
  const [converterDir, setConverterDir] = useState('AED_TO_EGP');

  const convertedPreview = useMemo(() => {
    const num = parseFloat(converterAmount) || 0;
    const rate = parseFloat(exchangeRate) || 1;
    if (converterDir === 'AED_TO_EGP') {
      return `${round2(num * rate).toLocaleString()} EGP`;
    }
    return `${round2(num / rate).toLocaleString()} AED`;
  }, [converterAmount, exchangeRate, converterDir]);

  return (
    <div className="space-y-4">
      {/* SECTION A: TRUE ALL-TIME WALLET & ACCOUNT BALANCES (PERIOD-INDEPENDENT) */}
      <section data-testid="all-time-wallets-section" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
              All-Time Wallet Balances
            </h2>
            <p className="text-[11px] text-slate-500">
              True cumulative Cash, Cards &amp; Banks across all time
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onOpenTransferModal('AED')}
              className="min-h-[38px] px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold flex items-center gap-1.5 touch-manipulation active:scale-95"
            >
              <ArrowRightLeft size={14} />
              <span>Transfer</span>
            </button>
            <button
              type="button"
              onClick={onOpenAccountsModal}
              className="min-h-[38px] px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 text-xs font-extrabold flex items-center gap-1.5 touch-manipulation active:scale-95"
            >
              <SlidersHorizontal size={14} />
              <span>Accounts</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {['AED', 'EGP'].map((cur) => {
            const isAED = cur === 'AED';
            const wallet = allTimeWalletTotals[cur];
            const curAccounts = accounts.filter((a) => a.currency === cur);

            return (
              <div
                key={cur}
                data-testid={`wallet-card-${cur}`}
                className="bg-white rounded-3xl border border-slate-200/90 shadow-2xs overflow-hidden flex flex-col"
              >
                <div
                  className={`px-5 py-4 flex items-center justify-between text-white ${
                    isAED
                      ? 'bg-gradient-to-r from-indigo-600 to-blue-600'
                      : 'bg-gradient-to-r from-emerald-600 to-teal-600'
                  }`}
                >
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider opacity-90">
                      {isAED ? 'UAE Dirham Wallet' : 'Egyptian Pound Wallet'}
                    </span>
                    <div
                      data-testid={`all-time-total-${cur}`}
                      className="text-2xl font-extrabold tracking-tight mt-0.5"
                    >
                      {formatMoney(wallet.totalBalance, cur)}
                    </div>
                    <span className="text-[11px] opacity-85">
                      True Cumulative Total · {wallet.accountCount} accounts
                    </span>
                  </div>
                  <div className="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur-xs flex items-center justify-center font-extrabold text-sm shrink-0">
                    {cur}
                  </div>
                </div>

                {/* Per-Account Mini-Cards */}
                <div className="p-3 bg-slate-50/70 space-y-1.5 flex-1">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                      Accounts &amp; Cards Breakdown
                    </span>
                    <button
                      type="button"
                      onClick={onOpenAccountsModal}
                      className="text-[11px] font-extrabold text-indigo-600 hover:underline"
                    >
                      Edit Balances
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-1.5">
                    {curAccounts.map((acc) => {
                      const bal = accountBalanceMap[acc.id]?.balance ?? acc.startingBalance ?? 0;
                      return (
                        <button
                          key={acc.id}
                          type="button"
                          onClick={onOpenAccountsModal}
                          className="w-full text-left px-3 py-2 rounded-2xl bg-white border border-slate-200/80 hover:border-indigo-300 flex items-center justify-between gap-2 transition touch-manipulation"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs font-bold text-slate-800 truncate">
                              {acc.name}
                            </span>
                            {acc.last4 && (
                              <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 shrink-0">
                                ••{acc.last4}
                              </span>
                            )}
                          </div>
                          <span className="text-xs font-extrabold text-slate-900 shrink-0">
                            {formatMoney(bal, cur)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* SECTION B: SELECTED PERIOD CASHFLOW ANALYSIS (INCOME VS SPEND) */}
      <section data-testid="period-cashflow-section" className="space-y-3">
        <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-2xs space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full">
                {periodLabel}
              </span>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 mt-1">
                Period Cashflow (Income vs. Spend)
              </h2>
            </div>

            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl select-none">
              {['month', 'year', 'all'].map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setPeriodMode(mode)}
                  className={`min-h-[38px] px-2.5 rounded-lg text-xs font-bold capitalize transition touch-manipulation active:scale-95 ${
                    periodMode === mode
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {mode === 'all' ? 'All' : mode}
                </button>
              ))}
            </div>
          </div>

          {/* Fast Touch Target Action Row */}
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => onQuickAdd('expense', false, 'posted')}
              className="min-h-[48px] flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-2xl bg-rose-50 hover:bg-rose-100 active:scale-[0.97] text-rose-700 font-extrabold text-xs border border-rose-200/80 touch-manipulation select-none transition"
            >
              <ArrowUpRight size={16} />
              <span>+ Expense</span>
            </button>
            <button
              type="button"
              onClick={() => onQuickAdd('expense', true, 'posted')}
              className="min-h-[48px] flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-2xl bg-indigo-50 hover:bg-indigo-100 active:scale-[0.97] text-indigo-700 font-extrabold text-xs border border-indigo-200/80 touch-manipulation select-none transition"
            >
              <Users size={16} />
              <span>+ Shared</span>
            </button>
            <button
              type="button"
              onClick={() => onQuickAdd('income', false, 'posted')}
              className="min-h-[48px] flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-2xl bg-emerald-50 hover:bg-emerald-100 active:scale-[0.97] text-emerald-700 font-extrabold text-xs border border-emerald-200/80 touch-manipulation select-none transition"
            >
              <ArrowDownLeft size={16} />
              <span>+ Income</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {['AED', 'EGP'].map((cur) => {
            const data = summary[cur];
            const flowTotal = data.totalMoneyReceived + data.totalMoneySpent;
            const incRatio =
              flowTotal > 0 ? Math.round((data.totalMoneyReceived / flowTotal) * 100) : 50;
            const netPositive = data.remainingBalance >= 0;

            return (
              <div
                key={cur}
                data-testid={`period-cashflow-${cur}`}
                className="bg-white rounded-3xl border border-slate-200/90 shadow-2xs p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                      {cur} · {periodLabel}
                    </span>
                    <div
                      className={`text-lg font-extrabold mt-0.5 ${
                        netPositive ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      Net: {netPositive ? '+' : ''}
                      {formatMoney(data.remainingBalance, cur)}
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-xl ${
                      netPositive
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}
                  >
                    {netPositive ? 'Savings' : 'Deficit'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 rounded-2xl bg-emerald-50/70 border border-emerald-100">
                    <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                      <ArrowDownLeft size={13} />
                      <span>Period Income</span>
                    </div>
                    <div className="text-xs sm:text-sm font-extrabold text-slate-900 mt-1">
                      {formatMoney(data.totalMoneyReceived, cur)}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      Inc: {formatCompact(data.personalIncome)} · Settled:{' '}
                      {formatCompact(data.settlementsReceived)}
                    </div>
                  </div>

                  <div className="p-2.5 rounded-2xl bg-rose-50/70 border border-rose-100">
                    <div className="flex items-center gap-1 text-[11px] font-bold text-rose-700">
                      <ArrowUpRight size={13} />
                      <span>Period Spend</span>
                    </div>
                    <div className="text-xs sm:text-sm font-extrabold text-slate-900 mt-1">
                      {formatMoney(data.totalMoneySpent, cur)}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      My Share: {formatCompact(data.totalMyExpenses)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 px-3 py-2 rounded-2xl bg-slate-50 border border-slate-200/70">
                    <div className="flex justify-between text-[10px] font-bold text-slate-600 mb-1">
                      <span>Income vs Spend ({incRatio}% In)</span>
                      <span>{100 - incRatio}% Out</span>
                    </div>
                    <div className="h-2 rounded-full bg-rose-200 overflow-hidden flex">
                      <div
                        className="bg-emerald-500 h-full transition-all duration-300"
                        style={{ width: `${incRatio}%` }}
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onNavigate('balances')}
                    className="px-3 py-2 rounded-2xl bg-amber-50/80 border border-amber-200 text-left hover:bg-amber-50 shrink-0 touch-manipulation"
                  >
                    <div className="text-[10px] font-extrabold text-amber-800">Shared Open</div>
                    <div className="text-[10px] font-extrabold text-emerald-700">
                      +{formatCompact(data.outstandingReceivable)} / -{formatCompact(data.outstandingPayable)}
                    </div>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* PENDING BANK SMS REVIEW QUEUE ON DASHBOARD */}
      <PendingSection
        pendingTransactions={pendingTransactions}
        accounts={accounts}
        categories={categories}
        onScanDeviceSms={onScanDeviceSms}
        onPasteRawSms={onPasteRawSms}
        onUpdatePendingItem={onUpdatePendingItem}
        onQuickFinalize={onQuickFinalizePending}
        onEditAndFinalize={onEditAndFinalizePending}
        onDismissPending={onDismissPending}
        compact
      />

      {/* DEDICATED UPCOMING / PLANNED SECTION ON DASHBOARD */}
      <UpcomingSection
        upcomingTransactions={upcomingTransactions}
        getCategory={getCategory}
        getPerson={getPerson}
        onAddUpcoming={() => onQuickAdd('expense', false, 'upcoming')}
        onEditUpcoming={onEditUpcoming}
        onDeleteUpcoming={onDeleteUpcoming}
        onConfirmUpcoming={onConfirmUpcoming}
        compact
      />

      {/* MANUAL EXCHANGE RATE REFERENCE CONVERTER */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-4 shadow-2xs space-y-3">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-2xl bg-amber-50 text-amber-600 border border-amber-100 shrink-0">
            <Coins size={20} />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">
              Manual Currency Reference Converter
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Preview conversions using your custom rate. Original AED &amp; EGP records stay strictly separate.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="flex items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2">
            <span className="text-xs font-bold text-slate-600">1 AED =</span>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                aria-label="Exchange rate AED to EGP"
                value={exchangeRate}
                onChange={(e) => setExchangeRate(e.target.value)}
                className="w-20 text-sm font-extrabold text-slate-900 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-indigo-500"
              />
              <span className="text-xs font-bold text-slate-500">EGP</span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 bg-indigo-50/70 border border-indigo-100 rounded-2xl px-3 py-2 flex-1">
            <input
              type="number"
              inputMode="decimal"
              aria-label="Converter amount"
              value={converterAmount}
              onChange={(e) => setConverterAmount(e.target.value)}
              className="w-24 text-sm font-extrabold text-slate-900 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-indigo-500"
            />
            <button
              type="button"
              onClick={() =>
                setConverterDir((d) => (d === 'AED_TO_EGP' ? 'EGP_TO_AED' : 'AED_TO_EGP'))
              }
              className="min-h-[40px] text-xs font-extrabold text-indigo-700 bg-white px-3 py-1.5 rounded-xl border border-indigo-200 active:scale-95 touch-manipulation"
            >
              {converterDir === 'AED_TO_EGP' ? 'AED → EGP' : 'EGP → AED'}
            </button>
            <span className="text-xs sm:text-sm font-extrabold text-indigo-950 text-right">
              = {convertedPreview}
            </span>
          </div>
        </div>
      </div>

      {/* RECENT TRANSACTIONS LIST */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="px-4 py-3.5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-extrabold text-slate-900">
              Recent Activity ({periodLabel})
            </h3>
            <p className="text-xs text-slate-500">Tap any row to edit details or split shares</p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('transactions')}
            className="min-h-[44px] px-2.5 text-xs font-extrabold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 touch-manipulation active:scale-95"
          >
            <span>View All</span>
            <ChevronRight size={16} />
          </button>
        </div>

        {recentTransactions.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm font-medium text-slate-500">
              No transactions recorded in {periodLabel}.
            </p>
            <button
              type="button"
              onClick={() => onQuickAdd('expense', false, 'posted')}
              className="mt-3 min-h-[48px] inline-flex items-center gap-1.5 px-5 py-2.5 rounded-2xl bg-indigo-600 text-white text-xs font-extrabold touch-manipulation active:scale-95"
            >
              <Plus size={16} /> Add First Transaction
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {recentTransactions.map((tx) => {
              const cat = getCategory(tx.categoryId);
              const payer = getPerson(tx.paidBy);
              const acc = getAccount(tx.accountId, tx.currency);
              const isIncome = tx.type === 'income';
              const shares = getEffectiveShares(tx);
              return (
                <button
                  key={tx.id}
                  type="button"
                  onClick={() => onEditTx(tx)}
                  className="w-full text-left px-4 py-3.5 min-h-[64px] flex items-center justify-between gap-3 hover:bg-slate-50/90 active:bg-slate-100 touch-manipulation transition"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <CategoryIcon iconName={cat.icon} color={cat.color} size={18} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-bold text-slate-900 truncate">
                          {tx.description}
                        </p>
                        {tx.isShared && (
                          <span className="shrink-0 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/70">
                            Shared
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5 truncate">
                        <span>{tx.date}</span>
                        <span>·</span>
                        <span>{acc.name}</span>
                        <span>·</span>
                        <span>{cat.name}</span>
                        {tx.type === 'expense' && (
                          <>
                            <span>·</span>
                            <span>Paid: {payer.name}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div
                      className={`text-sm font-extrabold ${
                        isIncome ? 'text-emerald-600' : 'text-slate-900'
                      }`}
                    >
                      {isIncome ? '+' : '-'}
                      {formatMoney(tx.amount, tx.currency)}
                    </div>
                    {tx.type === 'expense' &&
                      (tx.isShared || tx.paidBy !== 'me' || (tx.belongsTo && tx.belongsTo !== 'me')) && (
                        <div className="text-[11px] font-semibold text-slate-500">
                          My share: {formatMoney(shares.me || 0, tx.currency)}
                        </div>
                      )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// 2. TRANSACTIONS VIEW (POSTED + UPCOMING/PLANNED + FILTERS)
// ============================================================================

function TransactionsView({
  transactions,
  upcomingTransactions,
  pendingTransactions,
  accounts,
  allTransactionsCount,
  periodLabel,
  sections,
  categories,
  getPerson,
  getCategory,
  getSection,
  getAccount,
  onQuickAdd,
  onEditTx,
  onDeleteTx,
  onEditUpcoming,
  onDeleteUpcoming,
  onConfirmUpcoming,
  onScanDeviceSms,
  onPasteRawSms,
  onUpdatePendingItem,
  onQuickFinalizePending,
  onEditAndFinalizePending,
  onDismissPending
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [currencyFilter, setCurrencyFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [scopeFilter, setScopeFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const filtered = useMemo(() => {
    return transactions.filter((tx) => {
      if (currencyFilter !== 'ALL' && tx.currency !== currencyFilter) return false;
      if (typeFilter !== 'ALL' && tx.type !== typeFilter) return false;
      if (scopeFilter === 'shared' && !tx.isShared) return false;
      if (scopeFilter === 'personal' && tx.isShared) return false;
      if (categoryFilter !== 'ALL') {
        const cat = getCategory(tx.categoryId);
        if (tx.categoryId !== categoryFilter && cat.sectionId !== categoryFilter) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const cat = getCategory(tx.categoryId);
        const matchDesc = (tx.description || '').toLowerCase().includes(q);
        const matchCat = (cat.name || '').toLowerCase().includes(q);
        const matchNotes = (tx.notes || '').toLowerCase().includes(q);
        if (!matchDesc && !matchCat && !matchNotes) return false;
      }
      return true;
    });
  }, [transactions, currencyFilter, typeFilter, scopeFilter, categoryFilter, searchQuery, getCategory]);

  const listTotals = useMemo(() => {
    const calc = (cur) => {
      const items = filtered.filter((t) => t.currency === cur);
      return {
        income: round2(items.filter((t) => t.type === 'income').reduce((a, t) => a + t.amount, 0)),
        expense: round2(items.filter((t) => t.type === 'expense').reduce((a, t) => a + t.amount, 0))
      };
    };
    return { AED: calc('AED'), EGP: calc('EGP') };
  }, [filtered]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">Transactions</h2>
          <p className="text-xs text-slate-500">
            Showing {filtered.length} posted in {periodLabel} ({allTransactionsCount} total)
          </p>
        </div>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => onQuickAdd('income', false, 'posted')}
            className="min-h-[44px] px-3 rounded-2xl bg-emerald-600 text-white text-xs font-extrabold active:scale-95 touch-manipulation"
          >
            + Income
          </button>
          <button
            type="button"
            onClick={() => onQuickAdd('expense', false, 'posted')}
            className="min-h-[44px] px-3 rounded-2xl bg-rose-600 text-white text-xs font-extrabold active:scale-95 touch-manipulation"
          >
            + Expense
          </button>
        </div>
      </div>

      {/* PENDING BANK SMS QUEUE IN TRANSACTIONS TAB */}
      <PendingSection
        pendingTransactions={pendingTransactions}
        accounts={accounts}
        categories={categories}
        onScanDeviceSms={onScanDeviceSms}
        onPasteRawSms={onPasteRawSms}
        onUpdatePendingItem={onUpdatePendingItem}
        onQuickFinalize={onQuickFinalizePending}
        onEditAndFinalize={onEditAndFinalizePending}
        onDismissPending={onDismissPending}
      />

      {/* UPCOMING / PLANNED SECTION IN TRANSACTIONS TAB */}
      <UpcomingSection
        upcomingTransactions={upcomingTransactions}
        getCategory={getCategory}
        getPerson={getPerson}
        onAddUpcoming={() => onQuickAdd('expense', false, 'upcoming')}
        onEditUpcoming={onEditUpcoming}
        onDeleteUpcoming={onDeleteUpcoming}
        onConfirmUpcoming={onConfirmUpcoming}
      />

      {/* Filter Bar */}
      <div className="bg-white p-3.5 rounded-3xl border border-slate-200/80 shadow-2xs space-y-3">
        <div className="relative">
          <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search description, category, or notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full min-h-[46px] pl-10 pr-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:bg-white focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
          <CurrencyFilterPills value={currencyFilter} onChange={setCurrencyFilter} />

          <div className="inline-flex p-1 bg-slate-100 rounded-xl shrink-0 select-none">
            {[
              { id: 'ALL', label: 'All Types' },
              { id: 'income', label: 'Income' },
              { id: 'expense', label: 'Expenses' }
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTypeFilter(t.id)}
                className={`min-h-[40px] px-3 py-1.5 text-xs font-bold rounded-lg transition touch-manipulation active:scale-95 ${
                  typeFilter === t.id ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="inline-flex p-1 bg-slate-100 rounded-xl shrink-0 select-none">
            {[
              { id: 'ALL', label: 'All Scopes' },
              { id: 'personal', label: 'Personal' },
              { id: 'shared', label: 'Shared' }
            ].map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setScopeFilter(s.id)}
                className={`min-h-[40px] px-3 py-1.5 text-xs font-bold rounded-lg transition touch-manipulation active:scale-95 ${
                  scopeFilter === s.id ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <select
          aria-label="Filter by section or category"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="w-full min-h-[44px] text-xs font-bold bg-slate-100 border border-slate-200 rounded-2xl px-3.5 py-2 text-slate-700 focus:outline-none focus:border-indigo-500"
        >
          <option value="ALL">All Sections &amp; Categories</option>
          {sections.map((sec) => (
            <optgroup key={sec.id} label={`Section: ${sec.name}`}>
              <option value={sec.id}>All in {sec.name}</option>
              {categories
                .filter((c) => c.sectionId === sec.id)
                .map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>

        <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-2 text-xs">
          {(currencyFilter === 'ALL' || currencyFilter === 'AED') && (
            <div className="flex items-center gap-2.5 bg-indigo-50/70 px-3 py-2 rounded-xl border border-indigo-100">
              <span className="font-extrabold text-indigo-800">AED:</span>
              <span className="text-emerald-700 font-bold">
                +{formatMoney(listTotals.AED.income, 'AED')}
              </span>
              <span className="text-rose-700 font-bold">
                -{formatMoney(listTotals.AED.expense, 'AED')}
              </span>
            </div>
          )}
          {(currencyFilter === 'ALL' || currencyFilter === 'EGP') && (
            <div className="flex items-center gap-2.5 bg-teal-50/70 px-3 py-2 rounded-xl border border-teal-100">
              <span className="font-extrabold text-teal-800">EGP:</span>
              <span className="text-emerald-700 font-bold">
                +{formatMoney(listTotals.EGP.income, 'EGP')}
              </span>
              <span className="text-rose-700 font-bold">
                -{formatMoney(listTotals.EGP.expense, 'EGP')}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Transaction Cards */}
      <div className="space-y-2.5">
        {filtered.length === 0 ? (
          <div className="bg-white p-10 rounded-3xl border border-slate-200/80 text-center">
            <p className="text-sm font-semibold text-slate-600">No matching transactions found.</p>
          </div>
        ) : (
          filtered.map((tx) => {
            const cat = getCategory(tx.categoryId);
            const sec = getSection(cat.sectionId);
            const payer = getPerson(tx.paidBy);
            const acc = getAccount(tx.accountId, tx.currency);
            const isIncome = tx.type === 'income';
            const shares = getEffectiveShares(tx);
            const shareEntries = Object.entries(shares).filter(([, amt]) => amt > 0);

            return (
              <div
                key={tx.id}
                className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-2xs space-y-2.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <CategoryIcon iconName={cat.icon} color={cat.color} size={18} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <h4 className="text-sm font-extrabold text-slate-900 truncate">
                          {tx.description}
                        </h4>
                        <span
                          className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                            tx.isShared
                              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {tx.isShared ? 'Shared' : 'Personal'}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200/80">
                          {acc.name}
                          {acc.last4 ? ` ••${acc.last4}` : ''}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {tx.date} · {sec.name} / {cat.name}
                        {tx.type === 'expense' && ` · Paid by ${payer.name}`}
                      </p>
                      {tx.notes && (
                        <p className="text-xs text-slate-500 italic mt-1">“{tx.notes}”</p>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div
                      className={`text-base font-extrabold ${
                        isIncome ? 'text-emerald-600' : 'text-slate-900'
                      }`}
                    >
                      {isIncome ? '+' : '-'}
                      {formatMoney(tx.amount, tx.currency)}
                    </div>

                    <div className="flex items-center justify-end gap-1 mt-1">
                      <button
                        type="button"
                        onClick={() => onEditTx(tx)}
                        aria-label={`Edit ${tx.description}`}
                        title="Edit Transaction"
                        className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 active:scale-95 touch-manipulation transition"
                      >
                        <Edit3 size={16} />
                      </button>
                      {confirmDeleteId === tx.id ? (
                        <div className="flex items-center gap-1 bg-rose-50 px-2 py-1 rounded-xl border border-rose-200">
                          <button
                            type="button"
                            onClick={() => {
                              onDeleteTx(tx.id);
                              setConfirmDeleteId(null);
                            }}
                            className="min-h-[32px] px-1.5 text-xs font-extrabold text-rose-700 touch-manipulation"
                          >
                            Delete
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="min-h-[32px] px-1 text-xs text-slate-600 touch-manipulation"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(tx.id)}
                          aria-label={`Delete ${tx.description}`}
                          title="Delete Transaction"
                          className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 active:scale-95 touch-manipulation transition"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {tx.type === 'expense' &&
                  (tx.isShared || shareEntries.some(([pid]) => pid !== 'me')) && (
                    <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-2 text-[11px] font-bold">
                      {shareEntries.map(([pid, amt]) => (
                        <span
                          key={pid}
                          className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200/80 text-slate-700"
                        >
                          {getPerson(pid).name}: {formatMoney(amt, tx.currency)}
                        </span>
                      ))}
                    </div>
                  )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ============================================================================
// 3. SHARED EXPENSES VIEW (UNLIMITED DYNAMIC PARTICIPANTS)
// ============================================================================

function SharedExpensesView({
  transactions,
  allDebtItems,
  periodLabel,
  people,
  getPerson,
  getCategory,
  onQuickAdd,
  onEditTx,
  onDeleteTx,
  onNavigate
}) {
  const personSummaries = useMemo(() => {
    return people
      .filter((p) => {
        if (p.id === 'me') return false;
        if (!p.archived) return true;
        // Include archived person only if they still have open debt
        return (
          allDebtItems.receivables.some((r) => r.personId === p.id && r.outstanding > 0) ||
          allDebtItems.payables.some((pay) => pay.personId === p.id && pay.outstanding > 0)
        );
      })
      .map((person) => {
        const calcNet = (cur) => {
          const theyOweMe = round2(
            allDebtItems.receivables
              .filter((r) => r.personId === person.id && r.currency === cur)
              .reduce((a, r) => a + r.outstanding, 0)
          );
          const iOweThem = round2(
            allDebtItems.payables
              .filter((p) => p.personId === person.id && p.currency === cur)
              .reduce((a, p) => a + p.outstanding, 0)
          );
          return {
            theyOweMe,
            iOweThem,
            net: round2(theyOweMe - iOweThem)
          };
        };
        return {
          person,
          AED: calcNet('AED'),
          EGP: calcNet('EGP')
        };
      });
  }, [people, allDebtItems]);

  const activePeopleList = useMemo(() => people.filter((p) => !p.archived), [people]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">Shared Expenses</h2>
          <p className="text-xs text-slate-500">
            {activePeopleList.length}-person split tracker (
            {activePeopleList.map((p) => p.name).join(', ')})
          </p>
        </div>
        <button
          type="button"
          onClick={onQuickAdd}
          className="min-h-[46px] px-4 py-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-sm touch-manipulation"
        >
          <Plus size={16} />
          <span>Split Expense</span>
        </button>
      </div>

      {/* PARTICIPANTS & NET STANDING CARDS */}
      {personSummaries.length === 0 ? (
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 text-center space-y-2">
          <p className="text-xs text-slate-500">
            No other participants added yet. Add people in Settings to split expenses.
          </p>
          <button
            type="button"
            onClick={() => onNavigate('settings')}
            className="min-h-[40px] px-4 py-2 rounded-2xl bg-indigo-600 text-white text-xs font-extrabold"
          >
            Open Settings → People
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {personSummaries.map(({ person, AED, EGP }) => (
            <div
              key={person.id}
              className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-2xs space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className="w-9 h-9 rounded-2xl flex items-center justify-center text-white font-extrabold text-sm shrink-0"
                    style={{ backgroundColor: person.color }}
                  >
                    {person.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-extrabold text-slate-900 truncate">
                      {person.name}
                    </h3>
                    <p className="text-[11px] text-slate-500">All-time active balance</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('balances')}
                  className="min-h-[38px] px-3 rounded-xl bg-slate-100 text-xs font-extrabold text-indigo-700 touch-manipulation shrink-0"
                >
                  Settle
                </button>
              </div>

              <div className="space-y-2 text-xs">
                {[
                  { cur: 'AED', stats: AED },
                  { cur: 'EGP', stats: EGP }
                ].map(({ cur, stats }) => (
                  <div
                    key={cur}
                    className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200/70 flex items-center justify-between"
                  >
                    <span className="font-extrabold text-slate-700">{cur}</span>
                    {stats.net > 0 ? (
                      <span className="font-extrabold text-emerald-700">
                        Owes you {formatMoney(stats.net, cur)}
                      </span>
                    ) : stats.net < 0 ? (
                      <span className="font-extrabold text-rose-700">
                        You owe {formatMoney(Math.abs(stats.net), cur)}
                      </span>
                    ) : (
                      <span className="font-bold text-slate-400">Settled (0.00)</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* SHARED EXPENSES LOG FOR SELECTED PERIOD */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="px-4 py-3.5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-base font-extrabold text-slate-900">
            Shared &amp; On-Behalf Expenses ({periodLabel})
          </h3>
          <span className="text-xs font-bold text-slate-500">{transactions.length} items</span>
        </div>

        {transactions.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-slate-500">No shared expenses in {periodLabel}.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {transactions.map((tx) => {
              const cat = getCategory(tx.categoryId);
              const payer = getPerson(tx.paidBy);
              const shares = getEffectiveShares(tx);
              const involvedPeople = people.filter(
                (p) => (shares[p.id] || 0) > 0 || p.id === tx.paidBy
              );

              return (
                <div key={tx.id} className="p-4 space-y-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <CategoryIcon iconName={cat.icon} color={cat.color} size={18} />
                      <div className="min-w-0">
                        <h4 className="text-sm font-extrabold text-slate-900 truncate">
                          {tx.description}
                        </h4>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {tx.date} · Paid by{' '}
                          <strong className="text-slate-700">{payer.name}</strong>
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-sm font-extrabold text-slate-900">
                        {formatMoney(tx.amount, tx.currency)}
                      </div>
                      <div className="flex items-center justify-end gap-1 mt-1">
                        <button
                          type="button"
                          aria-label={`Edit ${tx.description}`}
                          onClick={() => onEditTx(tx)}
                          className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-500 hover:bg-indigo-50 hover:text-indigo-600"
                        >
                          <Edit3 size={15} />
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete ${tx.description}`}
                          onClick={() => onDeleteTx(tx.id)}
                          className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pt-1">
                    {involvedPeople.map((p) => (
                      <div
                        key={p.id}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200/70 text-[11px]"
                      >
                        <div className="text-slate-500 truncate">{p.name}</div>
                        <div className="font-extrabold text-slate-900">
                          {formatMoney(shares[p.id] || 0, tx.currency)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// 4. SEPARATE FINANCIAL BALANCES VIEW (A. RECEIVE vs B. PAY)
// ============================================================================

function BalancesView({
  allDebtItems,
  people,
  getPerson,
  getCategory,
  onOpenSettle,
  onDeleteSettlement,
  showToast
}) {
  const [activeSubTab, setActiveSubTab] = useState('receive');
  const [currencyFilter, setCurrencyFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('OPEN');
  const [personFilter, setPersonFilter] = useState('ALL');
  const [expandedKeys, setExpandedKeys] = useState({});

  const toggleExpand = (key) => {
    setExpandedKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const rawList = activeSubTab === 'receive' ? allDebtItems.receivables : allDebtItems.payables;

  const filteredList = useMemo(() => {
    return rawList.filter((item) => {
      if (currencyFilter !== 'ALL' && item.currency !== currencyFilter) return false;
      if (personFilter !== 'ALL' && item.personId !== personFilter) return false;
      if (statusFilter === 'OPEN' && item.status === 'Paid') return false;
      if (statusFilter === 'PAID' && item.status !== 'Paid') return false;
      return true;
    });
  }, [rawList, currencyFilter, personFilter, statusFilter]);

  const totals = useMemo(() => {
    const calc = (list, cur) =>
      round2(list.filter((i) => i.currency === cur).reduce((acc, i) => acc + i.outstanding, 0));
    return {
      receiveAED: calc(allDebtItems.receivables, 'AED'),
      receiveEGP: calc(allDebtItems.receivables, 'EGP'),
      payAED: calc(allDebtItems.payables, 'AED'),
      payEGP: calc(allDebtItems.payables, 'EGP')
    };
  }, [allDebtItems]);

  const handleShareDebtSummary = () => {
    const otherNames = people
      .filter((p) => p.id !== 'me' && !p.archived)
      .map((p) => p.name)
      .join(', ');

    const lines = [
      '📊 *Shared Expenses & Debt Summary*',
      `Date: ${getTodayStr()}`,
      '',
      '✅ *Money Owed To Me:*'
    ];

    const openReceivables = allDebtItems.receivables.filter((r) => r.outstanding > 0);
    if (openReceivables.length === 0) {
      lines.push('• All settled (0.00)');
    } else {
      openReceivables.forEach((r) => {
        const who = getPerson(r.personId).name;
        lines.push(`• ${who}: ${formatMoney(r.outstanding, r.currency)} (${r.description} - ${r.date})`);
      });
    }

    lines.push('', '💸 *Money I Should Pay:*');
    const openPayables = allDebtItems.payables.filter((p) => p.outstanding > 0);
    if (openPayables.length === 0) {
      lines.push('• All settled (0.00)');
    } else {
      openPayables.forEach((p) => {
        const who = getPerson(p.personId).name;
        lines.push(
          `• To ${who}: ${formatMoney(p.outstanding, p.currency)} (${p.description} - ${p.date})`
        );
      });
    }

    lines.push(
      '',
      `📌 *Totals (${otherNames || 'All Participants'}):*`,
      `• Receivable: ${formatMoney(totals.receiveAED, 'AED')} | ${formatMoney(totals.receiveEGP, 'EGP')}`,
      `• Payable: ${formatMoney(totals.payAED, 'AED')} | ${formatMoney(totals.payEGP, 'EGP')}`
    );

    shareTextSummary({
      title: 'Shared Expenses Debt Summary',
      text: lines.join('\n'),
      onFeedback: showToast
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">Financial Balances</h2>
          <p className="text-xs text-slate-500">
            Track receivables &amp; payables with partial settlement logs
          </p>
        </div>

        <button
          type="button"
          onClick={handleShareDebtSummary}
          className="min-h-[46px] px-3.5 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-sm touch-manipulation shrink-0"
        >
          <Share2 size={16} />
          <span>Share</span>
        </button>
      </div>

      {/* A vs B SUMMARY SELECTOR CARDS */}
      <div className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={() => setActiveSubTab('receive')}
          className={`p-3.5 rounded-3xl border text-left transition touch-manipulation active:scale-[0.98] ${
            activeSubTab === 'receive'
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20'
              : 'bg-white text-slate-900 border-slate-200'
          }`}
        >
          <div className="flex items-center gap-1.5 text-xs font-extrabold">
            <ArrowDownLeft size={16} />
            <span>A. Should Receive</span>
          </div>
          <div className="mt-2 space-y-0.5">
            <div className="text-sm font-extrabold">{formatMoney(totals.receiveAED, 'AED')}</div>
            <div
              className={`text-xs font-bold ${
                activeSubTab === 'receive' ? 'text-emerald-100' : 'text-slate-500'
              }`}
            >
              {formatMoney(totals.receiveEGP, 'EGP')}
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('pay')}
          className={`p-3.5 rounded-3xl border text-left transition touch-manipulation active:scale-[0.98] ${
            activeSubTab === 'pay'
              ? 'bg-rose-600 text-white border-rose-600 shadow-md shadow-rose-600/20'
              : 'bg-white text-slate-900 border-slate-200'
          }`}
        >
          <div className="flex items-center gap-1.5 text-xs font-extrabold">
            <ArrowUpRight size={16} />
            <span>B. Should Pay</span>
          </div>
          <div className="mt-2 space-y-0.5">
            <div className="text-sm font-extrabold">{formatMoney(totals.payAED, 'AED')}</div>
            <div
              className={`text-xs font-bold ${
                activeSubTab === 'pay' ? 'text-rose-100' : 'text-slate-500'
              }`}
            >
              {formatMoney(totals.payEGP, 'EGP')}
            </div>
          </div>
        </button>
      </div>

      {/* FILTERS */}
      <div className="bg-white p-3.5 rounded-3xl border border-slate-200/80 space-y-2.5">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          <div className="inline-flex p-1 bg-slate-100 rounded-xl shrink-0 select-none">
            {[
              { id: 'OPEN', label: 'Unpaid & Partial' },
              { id: 'ALL', label: 'All History' },
              { id: 'PAID', label: 'Fully Paid' }
            ].map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setStatusFilter(st.id)}
                className={`min-h-[40px] px-3 py-1.5 text-xs font-bold rounded-lg transition touch-manipulation active:scale-95 ${
                  statusFilter === st.id ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          <CurrencyFilterPills value={currencyFilter} onChange={setCurrencyFilter} />
        </div>

        <select
          aria-label="Filter balances by participant"
          value={personFilter}
          onChange={(e) => setPersonFilter(e.target.value)}
          className="w-full min-h-[44px] text-xs font-bold bg-slate-100 border border-slate-200 rounded-2xl px-3.5 py-2 text-slate-700"
        >
          <option value="ALL">All Participants</option>
          {people
            .filter((p) => p.id !== 'me')
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.archived ? ' (Archived)' : ''}
              </option>
            ))}
        </select>
      </div>

      {/* DEBT ITEMS LIST */}
      <div className="space-y-3">
        {filteredList.length === 0 ? (
          <div className="bg-white p-10 rounded-3xl border border-slate-200/80 text-center">
            <p className="text-sm font-semibold text-slate-600">
              No {activeSubTab === 'receive' ? 'receivables' : 'payables'} matching your filter.
            </p>
          </div>
        ) : (
          filteredList.map((item) => {
            const person = getPerson(item.personId);
            const cat = getCategory(item.categoryId);
            const isExpanded = Boolean(expandedKeys[item.key]);

            return (
              <div
                key={item.key}
                className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-2xs space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <CategoryIcon iconName={cat.icon} color={cat.color} size={18} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className="text-xs font-extrabold px-2 py-0.5 rounded-lg text-white"
                          style={{ backgroundColor: person.color }}
                        >
                          {activeSubTab === 'receive'
                            ? `From ${person.name}`
                            : `To ${person.name}`}
                        </span>
                        <span
                          className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                            item.status === 'Paid'
                              ? 'bg-emerald-100 text-emerald-800'
                              : item.status === 'Partial'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {item.status}
                        </span>
                      </div>

                      <h4 className="text-sm font-extrabold text-slate-900 mt-1.5">
                        {item.description}
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Date: {item.date} · Original Share:{' '}
                        {formatMoney(item.originalShare, item.currency)}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-[11px] font-bold text-slate-500">Outstanding</div>
                    <div
                      className={`text-base font-extrabold ${
                        item.outstanding > 0
                          ? activeSubTab === 'receive'
                            ? 'text-emerald-700'
                            : 'text-rose-700'
                          : 'text-slate-400'
                      }`}
                    >
                      {formatMoney(item.outstanding, item.currency)}
                    </div>
                    {item.paidSoFar > 0 && (
                      <div className="text-[11px] font-semibold text-slate-500">
                        Settled: {formatMoney(item.paidSoFar, item.currency)}
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-slate-500">
                    Total Bill: {formatMoney(item.totalExpenseAmount, item.currency)}
                  </span>

                  <div className="flex items-center gap-2">
                    {item.settlementHistory.length > 0 && (
                      <button
                        type="button"
                        onClick={() => toggleExpand(item.key)}
                        className="min-h-[42px] px-3 py-1.5 rounded-2xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 text-xs font-bold flex items-center gap-1 touch-manipulation"
                      >
                        <span>History ({item.settlementHistory.length})</span>
                        {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                      </button>
                    )}

                    {item.outstanding > 0 && (
                      <button
                        type="button"
                        onClick={() => onOpenSettle(item)}
                        className={`min-h-[42px] px-4 py-1.5 rounded-2xl text-white text-xs font-extrabold shadow-xs active:scale-95 touch-manipulation transition ${
                          activeSubTab === 'receive'
                            ? 'bg-emerald-600 hover:bg-emerald-700'
                            : 'bg-indigo-600 hover:bg-indigo-700'
                        }`}
                      >
                        {activeSubTab === 'receive' ? 'Record Receipt' : 'Record Payment'}
                      </button>
                    )}
                  </div>
                </div>

                {isExpanded && item.settlementHistory.length > 0 && (
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                    <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                      Settlement Log
                    </div>
                    {item.settlementHistory.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between gap-2 text-xs bg-white px-3 py-2 rounded-xl border border-slate-200/70"
                      >
                        <div>
                          <span className="font-extrabold text-emerald-700">
                            {formatMoney(s.amount, s.currency)}
                          </span>
                          <span className="text-slate-500 ml-2">{s.date}</span>
                          {s.note && <span className="text-slate-500 italic ml-2">({s.note})</span>}
                        </div>
                        <button
                          type="button"
                          onClick={() => onDeleteSettlement(s.id)}
                          aria-label="Delete settlement entry"
                          title="Delete Settlement Entry"
                          className="p-1.5 text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ============================================================================
// 5. REPORTS & ANALYTICS VIEW
// ============================================================================

function ReportsView({
  transactions,
  periodTransactions,
  summary,
  selectedYear,
  selectedMonth,
  periodLabel,
  people,
  getPerson,
  getCategory,
  getSection,
  showToast
}) {
  const [reportCurrency, setReportCurrency] = useState('AED');

  const curStats = summary[reportCurrency];

  const sixMonthSeries = useMemo(() => {
    const months = [];
    let y = selectedYear;
    let m = selectedMonth;
    for (let i = 0; i < 6; i++) {
      months.unshift({ year: y, month: m, key: `${y}-${pad2(m)}` });
      if (m === 1) {
        m = 12;
        y -= 1;
      } else {
        m -= 1;
      }
    }

    const shortNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];

    return months.map((slot) => {
      const mTxs = transactions.filter(
        (t) => t.currency === reportCurrency && (t.date || '').startsWith(slot.key)
      );
      const income = round2(
        mTxs.filter((t) => t.type === 'income').reduce((a, t) => a + Number(t.amount || 0), 0)
      );
      const expense = round2(
        mTxs
          .filter((t) => t.type === 'expense')
          .reduce((a, t) => a + (getEffectiveShares(t).me || 0), 0)
      );
      return {
        label: shortNames[slot.month - 1],
        key: slot.key,
        income,
        expense
      };
    });
  }, [transactions, reportCurrency, selectedYear, selectedMonth]);

  const momComparison = useMemo(() => {
    const current = sixMonthSeries[sixMonthSeries.length - 1] || { income: 0, expense: 0 };
    const previous = sixMonthSeries[sixMonthSeries.length - 2] || { income: 0, expense: 0 };
    const expDiff = round2(current.expense - previous.expense);
    const incDiff = round2(current.income - previous.income);
    return { current, previous, expDiff, incDiff };
  }, [sixMonthSeries]);

  const categoryBreakdown = useMemo(() => {
    const map = {};
    let total = 0;
    periodTransactions.forEach((tx) => {
      if (tx.type !== 'expense' || tx.currency !== reportCurrency) return;
      const myShare = getEffectiveShares(tx).me || 0;
      if (myShare <= 0) return;
      if (!map[tx.categoryId]) {
        map[tx.categoryId] = { categoryId: tx.categoryId, amount: 0, count: 0 };
      }
      map[tx.categoryId].amount = round2(map[tx.categoryId].amount + myShare);
      map[tx.categoryId].count += 1;
      total = round2(total + myShare);
    });
    const list = Object.values(map).sort((a, b) => b.amount - a.amount);
    return { list, total };
  }, [periodTransactions, reportCurrency]);

  const personBreakdown = useMemo(() => {
    return people
      .filter((person) => {
        if (!person.archived) return true;
        return periodTransactions.some(
          (tx) =>
            tx.type === 'expense' &&
            tx.currency === reportCurrency &&
            (tx.paidBy === person.id || (getEffectiveShares(tx)[person.id] || 0) > 0)
        );
      })
      .map((person) => {
        let paidOutOfPocket = 0;
        let responsibleShare = 0;
        periodTransactions.forEach((tx) => {
          if (tx.type !== 'expense' || tx.currency !== reportCurrency) return;
          if (tx.paidBy === person.id) {
            paidOutOfPocket = round2(paidOutOfPocket + Number(tx.amount || 0));
          }
          const shares = getEffectiveShares(tx);
          responsibleShare = round2(responsibleShare + (shares[person.id] || 0));
        });
        return { person, paidOutOfPocket, responsibleShare };
      });
  }, [people, periodTransactions, reportCurrency]);

  const handleDownloadPeriodReport = (preferShare = false) => {
    const lines = [
      ['Personal Finance & Shared Expenses Period Report'],
      ['Period', periodLabel],
      ['Currency Focus', reportCurrency],
      ['Generated At', new Date().toISOString()],
      [],
      ['SUMMARY METRICS', reportCurrency],
      ['Personal Income', curStats.personalIncome],
      ['Settlements Received from Others', curStats.settlementsReceived],
      ['Total Money Received', curStats.totalMoneyReceived],
      ['My Personal Expenses', curStats.myPersonalExpenses],
      ['My Shared Expense Share', curStats.mySharedExpenseShare],
      ['Total My Expenses', curStats.totalMyExpenses],
      ['Settlements Paid to Others', curStats.settlementsPaid],
      ['Remaining Cash Balance', curStats.remainingBalance],
      ['Active Receivables (Owed to Me)', curStats.outstandingReceivable],
      ['Active Payables (I Owe)', curStats.outstandingPayable],
      [],
      ['CATEGORY BREAKDOWN', 'Section', 'Transactions', `My Share (${reportCurrency})`],
      ...categoryBreakdown.list.map((c) => {
        const cat = getCategory(c.categoryId);
        const sec = getSection(cat.sectionId);
        return [cat.name, sec.name, c.count, c.amount];
      }),
      [],
      ['TRANSACTIONS IN PERIOD'],
      ['Date', 'Type', 'Currency', 'Amount', 'Category', 'Description', 'Shared', 'Paid By', 'My Share']
    ];

    periodTransactions.forEach((tx) => {
      const cat = getCategory(tx.categoryId);
      const payer = getPerson(tx.paidBy);
      const myShare = tx.type === 'income' ? tx.amount : getEffectiveShares(tx).me || 0;
      lines.push([
        tx.date,
        tx.type,
        tx.currency,
        tx.amount,
        cat.name,
        `"${(tx.description || '').replace(/"/g, '""')}"`,
        tx.isShared ? 'Yes' : 'No',
        payer.name,
        myShare
      ]);
    });

    const csvContent = '\uFEFF' + lines.map((r) => r.join(',')).join('\n');
    shareOrDownloadFile({
      content: csvContent,
      fileName: `Finance_Report_${periodLabel.replace(/\s+/g, '_')}_${reportCurrency}.csv`,
      mimeType: 'text/csv;charset=utf-8;',
      title: `Finance Report (${periodLabel} - ${reportCurrency})`,
      text: `Financial report for ${periodLabel} in ${reportCurrency}`,
      preferShare,
      onFeedback: showToast
    });
  };

  const maxBarValue = Math.max(
    100,
    ...sixMonthSeries.map((s) => Math.max(s.income, s.expense))
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">Reports &amp; Analytics</h2>
          <p className="text-xs text-slate-500">Period insights for {periodLabel}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200 select-none">
            {['AED', 'EGP'].map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setReportCurrency(c)}
                className={`min-h-[42px] px-4 py-1.5 text-xs font-extrabold rounded-lg transition touch-manipulation active:scale-95 ${
                  reportCurrency === c
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => handleDownloadPeriodReport(false)}
            className="min-h-[46px] flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-slate-900 hover:bg-slate-800 active:scale-95 text-white text-xs font-extrabold shadow-xs touch-manipulation transition"
          >
            <Download size={15} />
            <span>CSV</span>
          </button>

          <button
            type="button"
            onClick={() => handleDownloadPeriodReport(true)}
            className="min-h-[46px] flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-extrabold shadow-xs touch-manipulation transition"
          >
            <Share2 size={15} />
            <span>Share</span>
          </button>
        </div>
      </div>

      {/* KPI GRID */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-extrabold text-slate-900">
            {periodLabel} Overview ({reportCurrency})
          </h3>
          <span className="text-xs font-bold text-indigo-700">
            Net Balance: {formatMoney(curStats.remainingBalance, reportCurrency)}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
          <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-100">
            <div className="text-emerald-800 font-bold">Total Income</div>
            <div className="text-sm font-extrabold text-slate-900 mt-1">
              {formatMoney(curStats.personalIncome, reportCurrency)}
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-rose-50/70 border border-rose-100">
            <div className="text-rose-800 font-bold">My Total Expenses</div>
            <div className="text-sm font-extrabold text-slate-900 mt-1">
              {formatMoney(curStats.totalMyExpenses, reportCurrency)}
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/70">
            <div className="text-slate-600 font-bold">Personal Expenses</div>
            <div className="text-sm font-extrabold text-slate-900 mt-1">
              {formatMoney(curStats.myPersonalExpenses, reportCurrency)}
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-indigo-50/70 border border-indigo-100">
            <div className="text-indigo-800 font-bold">My Shared Share</div>
            <div className="text-sm font-extrabold text-slate-900 mt-1">
              {formatMoney(curStats.mySharedExpenseShare, reportCurrency)}
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/70">
            <div className="text-slate-600 font-bold">Settled In / Out</div>
            <div className="text-xs font-extrabold text-slate-900 mt-1">
              +{formatCompact(curStats.settlementsReceived)} / -
              {formatCompact(curStats.settlementsPaid)}
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-amber-50/70 border border-amber-100">
            <div className="text-amber-800 font-bold">Open Debts (All-Time)</div>
            <div className="text-xs font-extrabold text-slate-900 mt-1">
              +{formatCompact(curStats.outstandingReceivable)} / -
              {formatCompact(curStats.outstandingPayable)}
            </div>
          </div>
        </div>
      </div>

      {/* 6-MONTH INCOME VS EXPENSES SVG BAR CHART */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">
              6-Month Income vs Expenses ({reportCurrency})
            </h3>
            <p className="text-xs text-slate-500">
              MoM Expense Change:{' '}
              <strong className={momComparison.expDiff <= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                {momComparison.expDiff >= 0 ? '+' : ''}
                {formatMoney(momComparison.expDiff, reportCurrency)}
              </strong>
            </p>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-bold">
            <span className="flex items-center gap-1 text-emerald-700">
              <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500 inline-block" /> Income
            </span>
            <span className="flex items-center gap-1 text-rose-700">
              <span className="w-2.5 h-2.5 rounded-xs bg-rose-500 inline-block" /> Expenses
            </span>
          </div>
        </div>

        <div className="w-full overflow-x-auto">
          <svg viewBox="0 0 360 175" className="w-full h-44 select-none">
            {[0, 0.5, 1].map((ratio, idx) => {
              const yPos = 140 - ratio * 115;
              return (
                <g key={idx}>
                  <line
                    x1="12"
                    y1={yPos}
                    x2="348"
                    y2={yPos}
                    stroke="#e2e8f0"
                    strokeDasharray="3 3"
                    strokeWidth="1"
                  />
                </g>
              );
            })}

            {sixMonthSeries.map((bar, idx) => {
              const groupX = 24 + idx * 54;
              const incH = Math.max(2, (bar.income / maxBarValue) * 115);
              const expH = Math.max(2, (bar.expense / maxBarValue) * 115);
              return (
                <g key={bar.key}>
                  <rect
                    x={groupX}
                    y={140 - incH}
                    width="14"
                    height={incH}
                    rx="4"
                    fill="#10b981"
                  />
                  <rect
                    x={groupX + 17}
                    y={140 - expH}
                    width="14"
                    height={expH}
                    rx="4"
                    fill="#f43f5e"
                  />
                  <text
                    x={groupX + 15}
                    y="160"
                    textAnchor="middle"
                    fill="#475569"
                    fontSize="11"
                    fontWeight="700"
                  >
                    {bar.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* SPENDING BY CATEGORY */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-extrabold text-slate-900">
            Spending by Category ({reportCurrency})
          </h3>
          <span className="text-xs font-bold text-slate-500">
            Total: {formatMoney(categoryBreakdown.total, reportCurrency)}
          </span>
        </div>

        {categoryBreakdown.list.length === 0 ? (
          <p className="text-xs text-slate-500 py-4 text-center">
            No {reportCurrency} expenses recorded in {periodLabel}.
          </p>
        ) : (
          <div className="space-y-3">
            {categoryBreakdown.list.map((item) => {
              const cat = getCategory(item.categoryId);
              const pct =
                categoryBreakdown.total > 0
                  ? Math.round((item.amount / categoryBreakdown.total) * 100)
                  : 0;
              return (
                <div key={item.categoryId} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 font-bold text-slate-800">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: cat.color }}
                      />
                      <span>{cat.name}</span>
                      <span className="text-slate-400 font-normal">({pct}%)</span>
                    </div>
                    <span className="font-extrabold text-slate-900">
                      {formatMoney(item.amount, reportCurrency)}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{ width: `${pct}%`, backgroundColor: cat.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SPENDING BY PARTICIPANT (DYNAMIC GRID FOR UNLIMITED PARTICIPANTS) */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-2xs space-y-3">
        <h3 className="text-sm font-extrabold text-slate-900">
          Participant Breakdown ({periodLabel} · {reportCurrency})
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
          {personBreakdown.map(({ person, paidOutOfPocket, responsibleShare }) => (
            <div
              key={person.id}
              className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5"
            >
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: person.color }}
                />
                <span className="text-xs font-extrabold text-slate-900 truncate">
                  {person.name}
                </span>
              </div>
              <div className="text-[11px] text-slate-600 flex justify-between">
                <span>Paid Out-of-Pocket:</span>
                <strong className="text-slate-900">{formatCompact(paidOutOfPocket)}</strong>
              </div>
              <div className="text-[11px] text-slate-600 flex justify-between">
                <span>Responsible Share:</span>
                <strong className="text-indigo-700">{formatCompact(responsibleShare)}</strong>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AED VS EGP SIDE-BY-SIDE COMPARISON */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-2xs space-y-3">
        <h3 className="text-sm font-extrabold text-slate-900">AED vs EGP Period Comparison</h3>
        <div className="grid grid-cols-2 gap-3 text-xs">
          {['AED', 'EGP'].map((cur) => {
            const s = summary[cur];
            return (
              <div
                key={cur}
                className="p-3 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-1"
              >
                <div className="font-extrabold text-indigo-700 text-sm">{cur}</div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Income:</span>
                  <strong className="text-emerald-700">{formatCompact(s.personalIncome)}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">My Expenses:</span>
                  <strong className="text-rose-700">{formatCompact(s.totalMyExpenses)}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Owed to me:</span>
                  <strong>{formatCompact(s.outstandingReceivable)}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">I owe:</span>
                  <strong>{formatCompact(s.outstandingPayable)}</strong>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MODAL 2: RECORD PARTIAL OR FULL SETTLEMENT
// ============================================================================

function SettlementModal({ item, accounts = [], getPerson, onClose, onSubmit }) {
  const person = getPerson(item.personId);
  const currencyAccounts = useMemo(
    () => accounts.filter((a) => a.currency === item.currency),
    [accounts, item.currency]
  );
  const [accountId, setAccountId] = useState(() =>
    getDefaultAccountIdForCurrency(accounts, item.currency)
  );
  const [amount, setAmount] = useState(String(item.outstanding));
  const [date, setDate] = useState(() => getTodayStr());
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const handleConfirm = (e) => {
    e.preventDefault();
    const num = round2(parseFloat(amount) || 0);
    if (num <= 0) {
      setError('Settlement amount must be greater than 0.');
      return;
    }
    if (num > item.outstanding) {
      setError(
        `Amount cannot exceed remaining balance (${formatMoney(item.outstanding, item.currency)}).`
      );
      return;
    }
    onSubmit({
      transactionId: item.transactionId,
      personId: item.personId,
      direction: item.direction,
      amount: num,
      currency: item.currency,
      accountId,
      date,
      note: note.trim()
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/65 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Record Settlement"
        className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden max-h-[90dvh] flex flex-col"
      >
        <div className="pt-2.5 pb-1 flex justify-center sm:hidden shrink-0">
          <div className="w-10 h-1.5 rounded-full bg-slate-300" />
        </div>

        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between shrink-0">
          <h3 className="text-base font-extrabold text-slate-900">
            {item.direction === 'receive'
              ? `Receive Payment from ${person.name}`
              : `Pay Balance to ${person.name}`}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="w-11 h-11 flex items-center justify-center rounded-2xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 touch-manipulation"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleConfirm} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-5 space-y-4 overflow-y-auto flex-1">
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1 text-xs">
              <div className="font-bold text-slate-900 text-sm">{item.description}</div>
              <div className="flex justify-between text-slate-600">
                <span>Original Share:</span>
                <span className="font-bold">{formatMoney(item.originalShare, item.currency)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Already Settled:</span>
                <span className="font-bold text-emerald-700">
                  {formatMoney(item.paidSoFar, item.currency)}
                </span>
              </div>
              <div className="flex justify-between text-slate-900 pt-1 border-t border-slate-200 font-extrabold">
                <span>Remaining Due:</span>
                <span>{formatMoney(item.outstanding, item.currency)}</span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="settle-amount" className="text-xs font-bold text-slate-600">
                  Settlement Amount ({item.currency})
                </label>
                <button
                  type="button"
                  onClick={() => setAmount(String(item.outstanding))}
                  className="min-h-[36px] px-2 text-xs font-extrabold text-indigo-600 hover:underline touch-manipulation"
                >
                  Full Balance ({formatMoney(item.outstanding, item.currency)})
                </button>
              </div>
              <input
                id="settle-amount"
                type="number"
                inputMode="decimal"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full min-h-[50px] text-xl font-extrabold px-3.5 py-2.5 rounded-2xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label htmlFor="settle-account" className="text-xs font-bold text-slate-600 block mb-1">
                Account / Card ({item.currency})
              </label>
              <select
                id="settle-account"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full min-h-[46px] text-sm font-bold px-3.5 py-2 rounded-2xl border border-slate-200 bg-slate-50"
              >
                {currencyAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name}
                    {acc.last4 ? ` (••${acc.last4})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="settle-date" className="text-xs font-bold text-slate-600 block mb-1">
                Settlement Date
              </label>
              <input
                id="settle-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full min-h-[48px] text-sm font-semibold px-3.5 py-2.5 rounded-2xl border border-slate-200 bg-slate-50"
              />
            </div>

            <div>
              <label htmlFor="settle-note" className="text-xs font-bold text-slate-600 block mb-1">
                Note (Optional)
              </label>
              <input
                id="settle-note"
                type="text"
                placeholder="e.g., Bank transfer, Instapay, Cash"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full min-h-[48px] text-sm px-3.5 py-2.5 rounded-2xl border border-slate-200 bg-slate-50"
              />
            </div>

            {error && <p className="text-xs font-bold text-rose-600">{error}</p>}
          </div>

          <div className="px-5 pt-3 pb-[calc(0.85rem+env(safe-area-inset-bottom))] border-t border-slate-100 bg-white flex gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 min-h-[50px] py-3 rounded-2xl bg-slate-100 text-slate-700 text-sm font-bold touch-manipulation active:scale-[0.98]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-2 min-h-[50px] py-3 px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-extrabold shadow-sm touch-manipulation active:scale-[0.98]"
            >
              Confirm Settlement
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}