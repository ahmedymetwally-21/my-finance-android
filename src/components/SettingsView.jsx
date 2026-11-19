import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Archive,
  CalendarX2,
  Camera,
  Check,
  CloudOff,
  Coins,
  Copy,
  Download,
  Edit3,
  FileJson,
  FileSpreadsheet,
  HardDrive,
  Monitor,
  Moon,
  Palette,
  Plus,
  RotateCcw,
  Share2,
  Sliders,
  Smartphone,
  Star,
  Sun,
  Trash2,
  Upload,
  UserPlus,
  Users,
  Wallet
} from 'lucide-react';
import { CategoryIcon, ICON_MAP, ICON_NAMES, shareOrDownloadFile } from './SharedUI.jsx';
import { AccountsManagerPanel } from './AccountsManagerModal.jsx';
import { AppAssetGeneratorCard } from './SmartLedgerLogo.jsx';
import {
  COLOR_PALETTE,
  DEFAULT_ACCOUNTS,
  DEFAULT_CATEGORIES,
  DEFAULT_CURRENCIES,
  DEFAULT_PEOPLE,
  DEFAULT_SECTIONS,
  DEFAULT_SHARING_PREFS,
  DEFAULT_USER_PROFILE,
  PRESET_CURRENCIES,
  buildDemoData,
  executePeriodDeletion,
  formatMoney,
  getCurrencyAccent,
  getCurrencyUsage,
  getDefaultAccountIdForCurrency,
  getEffectiveShares,
  getParticipantDebtStatus,
  getPeriodPresetDates,
  getTodayStr,
  normalizeImportedBackup,
  previewPeriodDeletion
} from '../utils/financeEngine.js';

function getProfileInitials(name) {
  const cleaned = String(name || '').trim();
  if (!cleaned) return 'SL';
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function compressAvatarImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image'));
    reader.onload = (ev) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image file'));
      img.onload = () => {
        const size = 160;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas unavailable'));
          return;
        }
        const minDim = Math.min(img.width, img.height);
        const sx = (img.width - minDim) / 2;
        const sy = (img.height - minDim) / 2;
        ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);
        try {
          resolve(canvas.toDataURL('image/jpeg', 0.78));
        } catch {
          reject(new Error('Failed to encode image'));
        }
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });
}

export default function SettingsView({
  currencies = DEFAULT_CURRENCIES,
  setCurrencies,
  primaryCurrency = 'AED',
  setPrimaryCurrency,
  budgets = {},
  setBudgets,
  userProfile = DEFAULT_USER_PROFILE,
  setUserProfile,
  people,
  setPeople,
  sections,
  setSections,
  categories,
  setCategories,
  accounts,
  setAccounts,
  accountBalanceMap,
  accountTransfers,
  setAccountTransfers,
  transactions,
  setTransactions,
  settlements,
  setSettlements,
  upcomingTransactions,
  setUpcomingTransactions,
  pendingTransactions,
  setPendingTransactions,
  dismissedSmsSignatures,
  setDismissedSmsSignatures,
  defaultSharing,
  setDefaultSharing,
  appearancePrefs,
  setAppearancePrefs,
  allDebtItems,
  selectedYear,
  selectedMonth,
  exchangeRate,
  setExchangeRate,
  onOpenTransfer,
  showToast
}) {
  // 4 Organized Settings Sections:
  // 'appearance' | 'currencies_accounts' | 'sharing_people' | 'data'
  const [settingsTab, setSettingsTab] = useState('currencies_accounts');

  // Currencies Manager State
  const [customCode, setCustomCode] = useState('');
  const [customSymbol, setCustomSymbol] = useState('');
  const [customName, setCustomName] = useState('');
  const [currencyWarning, setCurrencyWarning] = useState('');

  // Dynamic Participants State
  const [newPersonName, setNewPersonName] = useState('');
  const [newPersonColor, setNewPersonColor] = useState(COLOR_PALETTE[4]);
  const [confirmDeletePersonId, setConfirmDeletePersonId] = useState(null);
  const [showArchivedPeople, setShowArchivedPeople] = useState(false);

  // Per-Category Rule Creation State
  const expenseCategories = useMemo(
    () => categories.filter((c) => c.type === 'expense'),
    [categories]
  );
  const [ruleCategoryId, setRuleCategoryId] = useState(() => {
    const firstUnconfigured = expenseCategories.find(
      (c) => !(defaultSharing.categoryRules || {})[c.id]
    );
    return firstUnconfigured?.id || expenseCategories[0]?.id || '';
  });

  // Custom Sections & Categories State
  const [newSectionName, setNewSectionName] = useState('');
  const [newSectionType, setNewSectionType] = useState('expense');
  const [newCatName, setNewCatName] = useState('');
  const [newCatSectionId, setNewCatSectionId] = useState(sections[0]?.id || 'sec_daily');
  const [newCatColor, setNewCatColor] = useState(COLOR_PALETTE[0]);
  const [newCatIcon, setNewCatIcon] = useState('Receipt');
  const [editingCatId, setEditingCatId] = useState(null);
  const [editingCatName, setEditingCatName] = useState('');

  // Backup Import Preview State
  const [pendingImport, setPendingImport] = useState(null);

  // Bulk Period Cleanup State
  const initialMonthDates = useMemo(
    () => getPeriodPresetDates('selected_month', selectedYear, selectedMonth),
    [selectedYear, selectedMonth]
  );
  const [cleanupStart, setCleanupStart] = useState(initialMonthDates.startDate);
  const [cleanupEnd, setCleanupEnd] = useState(initialMonthDates.endDate);
  const [cleanupScope, setCleanupScope] = useState('transactions_only');
  const [confirmCleanupOpen, setConfirmCleanupOpen] = useState(false);

  const activePeople = useMemo(() => people.filter((p) => !p.archived), [people]);
  const archivedPeople = useMemo(() => people.filter((p) => p.archived), [people]);

  const activeCurrencyCodes = useMemo(() => new Set(currencies.map((c) => c.code)), [currencies]);
  const availablePresets = useMemo(
    () => PRESET_CURRENCIES.filter((p) => !activeCurrencyCodes.has(p.code)),
    [activeCurrencyCodes]
  );

  const currencyUsageState = useMemo(
    () => ({
      accounts,
      transactions,
      settlements,
      upcomingTransactions,
      pendingTransactions,
      accountTransfers
    }),
    [accounts, transactions, settlements, upcomingTransactions, pendingTransactions, accountTransfers]
  );

  // ============================================================================
  // USER PROFILE HANDLERS
  // ============================================================================

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('Please select a valid image file (PNG, JPG, WebP)', 'error');
      return;
    }
    try {
      const dataUrl = await compressAvatarImage(file);
      setUserProfile((prev) => ({ ...prev, avatarDataUrl: dataUrl }));
      showToast('Profile photo updated');
    } catch {
      showToast('Could not process selected image', 'error');
    }
  };

  const handleRemoveAvatar = () => {
    setUserProfile((prev) => ({ ...prev, avatarDataUrl: '' }));
    showToast('Profile photo removed');
  };

  // ============================================================================
  // MULTI-CURRENCY MANAGER HANDLERS
  // ============================================================================

  const handleAddPresetCurrency = (preset) => {
    if (activeCurrencyCodes.has(preset.code)) return;
    setCurrencies((prev) => [
      ...prev,
      { code: preset.code, name: preset.name, symbol: preset.symbol, builtIn: false }
    ]);
    setCurrencyWarning('');
    showToast(`Added ${preset.code} (${preset.name})`);
  };

  const handleAddCustomCurrency = (e) => {
    e.preventDefault();
    const cleanedCode = customCode.trim().toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
    if (cleanedCode.length !== 3) {
      setCurrencyWarning('Currency code must be exactly 3 letters (e.g., USD, SAR, JOD).');
      return;
    }
    if (activeCurrencyCodes.has(cleanedCode)) {
      setCurrencyWarning(`${cleanedCode} is already active in your currencies list.`);
      return;
    }
    const symbol = customSymbol.trim() || cleanedCode;
    const name = customName.trim() || `${cleanedCode} Currency`;

    setCurrencies((prev) => [
      ...prev,
      { code: cleanedCode, name, symbol, builtIn: false }
    ]);
    setCustomCode('');
    setCustomSymbol('');
    setCustomName('');
    setCurrencyWarning('');
    showToast(`Added custom currency ${cleanedCode}`);
  };

  const handleRemoveCurrency = (cur) => {
    if (cur.builtIn || cur.code === 'AED' || cur.code === 'EGP') {
      setCurrencyWarning(`${cur.code} is a built-in core currency and cannot be removed.`);
      return;
    }
    const usage = getCurrencyUsage(cur.code, currencyUsageState);
    if (usage.inUse) {
      const parts = [];
      if (usage.accountCount > 0) parts.push(`${usage.accountCount} account${usage.accountCount > 1 ? 's' : ''}`);
      if (usage.txCount > 0) parts.push(`${usage.txCount} transaction${usage.txCount > 1 ? 's' : ''}`);
      if (usage.settlementCount > 0) parts.push(`${usage.settlementCount} settlement${usage.settlementCount > 1 ? 's' : ''}`);
      if (usage.upcomingCount > 0) parts.push(`${usage.upcomingCount} upcoming`);
      if (usage.pendingCount > 0) parts.push(`${usage.pendingCount} pending`);
      if (usage.transferCount > 0) parts.push(`${usage.transferCount} transfer${usage.transferCount > 1 ? 's' : ''}`);

      const msg = `Cannot delete ${cur.code} while in use (${parts.join(', ')}). Remove or migrate those records first.`;
      setCurrencyWarning(msg);
      showToast(msg, 'error');
      return;
    }

    setCurrencies((prev) => prev.filter((c) => c.code !== cur.code));
    if (primaryCurrency === cur.code) {
      setPrimaryCurrency('AED');
    }
    setBudgets((prev) => {
      if (!prev[cur.code]) return prev;
      const next = { ...prev };
      delete next[cur.code];
      return next;
    });
    setCurrencyWarning('');
    showToast(`Removed currency ${cur.code}`);
  };

  // ============================================================================
  // UNLIMITED PARTICIPANTS HANDLERS
  // ============================================================================

  const handleAddPerson = (e) => {
    e.preventDefault();
    const trimmed = newPersonName.trim();
    if (!trimmed) {
      showToast('Please enter a participant name', 'error');
      return;
    }
    const newPerson = {
      id: `p_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      name: trimmed,
      color: newPersonColor,
      archived: false
    };
    setPeople((prev) => [...prev, newPerson]);
    setNewPersonName('');
    setNewPersonColor(COLOR_PALETTE[(people.length + 1) % COLOR_PALETTE.length]);
    showToast(`Added participant "${trimmed}"`);
  };

  const handleUpdatePerson = (id, field, value) => {
    setPeople((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
  };

  const handleArchiveToggle = (person) => {
    if (person.id === 'me') return;
    const nextArchived = !person.archived;
    setPeople((prev) =>
      prev.map((p) => (p.id === person.id ? { ...p, archived: nextArchived } : p))
    );
    if (nextArchived) {
      setDefaultSharing((prev) => {
        const nextIds = (prev.participantIds || []).filter((id) => id !== person.id);
        return {
          ...prev,
          paidBy: prev.paidBy === person.id ? 'me' : prev.paidBy,
          participantIds: nextIds.length > 0 ? nextIds : ['me']
        };
      });
      showToast(`Archived "${person.name}" — historical balances preserved`);
    } else {
      showToast(`Restored "${person.name}" to active participants`);
    }
  };

  const handleDeletePerson = (person) => {
    if (person.id === 'me') return;
    const debtStatus = getParticipantDebtStatus(person.id, allDebtItems, currencies);
    if (debtStatus.hasUnsettledBalance) {
      showToast(
        `Cannot delete "${person.name}" while they have an unsettled balance. Settle or archive instead.`,
        'error'
      );
      return;
    }

    setPeople((prev) => prev.filter((p) => p.id !== person.id));
    setDefaultSharing((prev) => {
      const nextRules = { ...(prev.categoryRules || {}) };
      Object.keys(nextRules).forEach((catId) => {
        const rule = nextRules[catId];
        const filteredIds = (rule.participantIds || []).filter((id) => id !== person.id);
        nextRules[catId] = {
          ...rule,
          paidBy: rule.paidBy === person.id ? 'me' : rule.paidBy,
          participantIds: filteredIds.length > 0 ? filteredIds : ['me']
        };
      });
      const filteredGlobalIds = (prev.participantIds || []).filter((id) => id !== person.id);
      return {
        ...prev,
        paidBy: prev.paidBy === person.id ? 'me' : prev.paidBy,
        participantIds: filteredGlobalIds.length > 0 ? filteredGlobalIds : ['me'],
        categoryRules: nextRules
      };
    });
    setConfirmDeletePersonId(null);
    showToast(`Removed participant "${person.name}"`);
  };

  // ============================================================================
  // GLOBAL & PER-CATEGORY SHARING DEFAULTS
  // ============================================================================

  const updateGlobalDefault = (patch) => {
    setDefaultSharing((prev) => ({ ...prev, ...patch }));
  };

  const toggleGlobalDefaultParticipant = (pid) => {
    setDefaultSharing((prev) => {
      const current = prev.participantIds || [];
      if (current.includes(pid)) {
        if (current.length <= 1) return prev;
        return { ...prev, participantIds: current.filter((x) => x !== pid) };
      }
      return { ...prev, participantIds: [...current, pid] };
    });
  };

  const handleAddCategoryRule = () => {
    if (!ruleCategoryId) return;
    setDefaultSharing((prev) => ({
      ...prev,
      categoryRules: {
        ...(prev.categoryRules || {}),
        [ruleCategoryId]: {
          scope: 'shared',
          paidBy: prev.paidBy || 'me',
          splitMode: prev.splitMode || 'equal',
          participantIds:
            prev.participantIds && prev.participantIds.length > 0
              ? prev.participantIds
              : activePeople.map((p) => p.id)
        }
      }
    }));
    const catName = categories.find((c) => c.id === ruleCategoryId)?.name || 'Category';
    showToast(`Added default rule for "${catName}"`);
  };

  const updateCategoryRule = (catId, patch) => {
    setDefaultSharing((prev) => ({
      ...prev,
      categoryRules: {
        ...(prev.categoryRules || {}),
        [catId]: {
          ...(prev.categoryRules?.[catId] || {}),
          ...patch
        }
      }
    }));
  };

  const toggleCategoryRuleParticipant = (catId, pid) => {
    const rule = defaultSharing.categoryRules?.[catId];
    if (!rule) return;
    const current = rule.participantIds || [];
    if (current.includes(pid) && current.length <= 1) return;
    const next = current.includes(pid)
      ? current.filter((x) => x !== pid)
      : [...current, pid];
    updateCategoryRule(catId, { participantIds: next });
  };

  const removeCategoryRule = (catId) => {
    setDefaultSharing((prev) => {
      const nextRules = { ...(prev.categoryRules || {}) };
      delete nextRules[catId];
      return { ...prev, categoryRules: nextRules };
    });
    showToast('Removed category rule (will use global defaults)');
  };

  // ============================================================================
  // CATEGORIES & SECTIONS HANDLERS
  // ============================================================================

  const handleAddSection = (e) => {
    e.preventDefault();
    if (!newSectionName.trim()) return;
    const sec = {
      id: `sec_${Date.now()}`,
      name: newSectionName.trim(),
      type: newSectionType
    };
    setSections((prev) => [...prev, sec]);
    setNewCatSectionId(sec.id);
    setNewSectionName('');
    showToast(`Created section "${sec.name}"`);
  };

  const handleDeleteSection = (secId) => {
    if (sections.length <= 1) {
      showToast('At least one section must remain', 'error');
      return;
    }
    const fallbackSec = sections.find((s) => s.id !== secId);
    setCategories((prev) =>
      prev.map((c) => (c.sectionId === secId ? { ...c, sectionId: fallbackSec.id } : c))
    );
    setSections((prev) => prev.filter((s) => s.id !== secId));
    showToast('Section removed (categories moved)');
  };

  const handleAddCategory = (e) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    const parentSec = sections.find((s) => s.id === newCatSectionId);
    const newCat = {
      id: `cat_${Date.now()}`,
      sectionId: newCatSectionId,
      name: newCatName.trim(),
      icon: newCatIcon,
      color: newCatColor,
      type: parentSec?.type || 'expense'
    };
    setCategories((prev) => [...prev, newCat]);
    setNewCatName('');
    showToast(`Added category "${newCat.name}"`);
  };

  const handleRenameCategory = (catId) => {
    if (!editingCatName.trim()) return;
    setCategories((prev) =>
      prev.map((c) => (c.id === catId ? { ...c, name: editingCatName.trim() } : c))
    );
    setEditingCatId(null);
    showToast('Category renamed');
  };

  const handleDeleteCategory = (catId) => {
    const inUse =
      transactions.some((t) => t.categoryId === catId) ||
      upcomingTransactions.some((u) => u.categoryId === catId);
    if (inUse) {
      showToast(
        'Cannot delete a category currently used by posted or upcoming transactions',
        'error'
      );
      return;
    }
    setCategories((prev) => prev.filter((c) => c.id !== catId));
    showToast('Category deleted');
  };

  // ============================================================================
  // BACKUP (v4), EXPORT, RESTORE & BULK PERIOD CLEANUP
  // ============================================================================

  const buildJSONBackupString = () => {
    const backupPayload = {
      appIdentifier: 'SmartLedgerFinance',
      schemaVersion: 4,
      exportedAt: new Date().toISOString(),
      data: {
        currencies,
        primaryCurrency,
        budgets,
        userProfile,
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
      }
    };
    return JSON.stringify(backupPayload, null, 2);
  };

  const handleExportJSON = (preferShare = false) => {
    shareOrDownloadFile({
      content: buildJSONBackupString(),
      fileName: `SmartLedger_Backup_${getTodayStr()}.json`,
      mimeType: 'application/json',
      title: 'SmartLedger Full JSON Backup',
      text: `Full backup (${currencies.length} currencies, ${accounts.length} accounts, ${transactions.length} transactions, ${pendingTransactions.length} pending, ${upcomingTransactions.length} upcoming, ${settlements.length} settlements)`,
      preferShare,
      onFeedback: showToast
    });
  };

  const handleCopyJSONClipboard = async () => {
    try {
      await navigator.clipboard.writeText(buildJSONBackupString());
      showToast('Full JSON backup copied to clipboard');
    } catch {
      showToast('Unable to copy JSON to clipboard', 'error');
    }
  };

  const handleExportCSV = (preferShare = false) => {
    const headers = [
      'ID',
      'Date',
      'Type',
      'Currency',
      'Account',
      'Total Amount',
      'Section',
      'Category',
      'Description',
      'Shared',
      'Paid By',
      ...people.map((p) => `${p.name} Share`),
      'Notes'
    ];

    const rows = transactions.map((tx) => {
      const cat = categories.find((c) => c.id === tx.categoryId);
      const sec = sections.find((s) => s.id === cat?.sectionId);
      const payer = people.find((p) => p.id === tx.paidBy);
      const accId = tx.accountId || getDefaultAccountIdForCurrency(accounts, tx.currency);
      const acc = accounts.find((a) => a.id === accId);
      const shares = getEffectiveShares(tx);
      return [
        tx.id,
        tx.date,
        tx.type,
        tx.currency,
        `"${(acc?.name || tx.currency).replace(/"/g, '""')}"`,
        tx.amount,
        `"${(sec?.name || '').replace(/"/g, '""')}"`,
        `"${(cat?.name || '').replace(/"/g, '""')}"`,
        `"${(tx.description || '').replace(/"/g, '""')}"`,
        tx.isShared ? 'Yes' : 'No',
        `"${(payer?.name || tx.paidBy).replace(/"/g, '""')}"`,
        ...people.map((p) => shares[p.id] || 0),
        `"${(tx.notes || '').replace(/"/g, '""')}"`
      ];
    });

    const csv = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    shareOrDownloadFile({
      content: csv,
      fileName: `SmartLedger_Transactions_${getTodayStr()}.csv`,
      mimeType: 'text/csv;charset=utf-8;',
      title: 'SmartLedger Transactions CSV',
      text: `Transactions spreadsheet (${transactions.length} records)`,
      preferShare,
      onFeedback: showToast
    });
  };

  const handleSelectBackupFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        const normalized = normalizeImportedBackup(parsed);
        if (!normalized) {
          showToast('Invalid backup file: missing transactions list', 'error');
          return;
        }
        const existingTxIds = new Set(transactions.map((t) => t.id));
        const duplicateCount = normalized.transactions.filter((t) =>
          existingTxIds.has(t.id)
        ).length;
        const newCount = normalized.transactions.length - duplicateCount;

        const existingUpIds = new Set(upcomingTransactions.map((u) => u.id));
        const newUpcomingCount = normalized.upcomingTransactions.filter(
          (u) => !existingUpIds.has(u.id)
        ).length;

        const budgetSectionCount = Object.values(normalized.budgets || {}).reduce(
          (sum, curMap) => sum + Object.keys(curMap || {}).length,
          0
        );

        setPendingImport({
          fileName: file.name,
          exportedAt: parsed.exportedAt || 'Unknown date',
          normalized,
          currencyCount: normalized.currencies.length,
          budgetSectionCount,
          totalTx: normalized.transactions.length,
          accountCount: normalized.accounts.length,
          duplicateCount,
          newCount,
          settlementCount: normalized.settlements.length,
          upcomingCount: normalized.upcomingTransactions.length,
          pendingCount: normalized.pendingTransactions.length,
          newUpcomingCount
        });
      } catch {
        showToast('Could not parse JSON backup file', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const applyImport = (mode) => {
    if (!pendingImport) return;
    const { normalized } = pendingImport;

    if (mode === 'replace') {
      setCurrencies(normalized.currencies);
      setPrimaryCurrency(normalized.primaryCurrency);
      setBudgets(normalized.budgets);
      setUserProfile(normalized.userProfile);
      setPeople(normalized.people);
      setSections(normalized.sections);
      setCategories(normalized.categories);
      setAccounts(normalized.accounts);
      setAccountTransfers(normalized.accountTransfers);
      setTransactions(normalized.transactions);
      setSettlements(normalized.settlements);
      setUpcomingTransactions(normalized.upcomingTransactions);
      setPendingTransactions(normalized.pendingTransactions);
      setDismissedSmsSignatures(normalized.dismissedSmsSignatures);
      setDefaultSharing(normalized.defaultSharing);
      setAppearancePrefs(normalized.appearancePrefs);
      setExchangeRate(normalized.exchangeRate);
      showToast(
        `Restored ${normalized.currencies.length} currencies, ${normalized.accounts.length} accounts & ${normalized.transactions.length} transactions`
      );
    } else {
      const existingCurCodes = new Set(currencies.map((c) => c.code));
      const newCurrencies = normalized.currencies.filter((c) => !existingCurCodes.has(c.code));

      const existingAccIds = new Set(accounts.map((a) => a.id));
      const newAccounts = normalized.accounts.filter((a) => !existingAccIds.has(a.id));

      const existingTrIds = new Set(accountTransfers.map((tr) => tr.id));
      const newTransfers = normalized.accountTransfers.filter((tr) => !existingTrIds.has(tr.id));

      const existingTxIds = new Set(transactions.map((t) => t.id));
      const newTxs = normalized.transactions.filter((t) => !existingTxIds.has(t.id));

      const existingSetIds = new Set(settlements.map((s) => s.id));
      const newSets = normalized.settlements.filter((s) => !existingSetIds.has(s.id));

      const existingUpIds = new Set(upcomingTransactions.map((u) => u.id));
      const newUps = normalized.upcomingTransactions.filter((u) => !existingUpIds.has(u.id));

      const existingPendIds = new Set(pendingTransactions.map((p) => p.id));
      const newPending = normalized.pendingTransactions.filter((p) => !existingPendIds.has(p.id));

      const existingSecIds = new Set(sections.map((s) => s.id));
      const newSecs = normalized.sections.filter((s) => !existingSecIds.has(s.id));

      const existingCatIds = new Set(categories.map((c) => c.id));
      const newCats = normalized.categories.filter((c) => !existingCatIds.has(c.id));

      const existingPeopleIds = new Set(people.map((p) => p.id));
      const newPeople = normalized.people.filter((p) => !existingPeopleIds.has(p.id));

      if (newCurrencies.length > 0) setCurrencies((prev) => [...prev, ...newCurrencies]);
      if (newPeople.length > 0) setPeople((prev) => [...prev, ...newPeople]);
      if (newSecs.length > 0) setSections((prev) => [...prev, ...newSecs]);
      if (newCats.length > 0) setCategories((prev) => [...prev, ...newCats]);
      if (newAccounts.length > 0) setAccounts((prev) => [...prev, ...newAccounts]);
      if (newTransfers.length > 0) setAccountTransfers((prev) => [...newTransfers, ...prev]);
      setTransactions((prev) => [...newTxs, ...prev]);
      setSettlements((prev) => [...newSets, ...prev]);
      if (newUps.length > 0) setUpcomingTransactions((prev) => [...newUps, ...prev]);
      if (newPending.length > 0) setPendingTransactions((prev) => [...newPending, ...prev]);
      if (normalized.dismissedSmsSignatures.length > 0) {
        setDismissedSmsSignatures((prev) =>
          Array.from(new Set([...prev, ...normalized.dismissedSmsSignatures]))
        );
      }
      if (Object.keys(normalized.budgets || {}).length > 0) {
        setBudgets((prev) => {
          const merged = { ...prev };
          Object.entries(normalized.budgets).forEach(([cur, secMap]) => {
            merged[cur] = { ...(secMap || {}), ...(prev[cur] || {}) };
          });
          return merged;
        });
      }
      showToast(
        `Merged ${newTxs.length} transactions & ${newAccounts.length} accounts (${pendingImport.duplicateCount} duplicates skipped)`
      );
    }
    setPendingImport(null);
  };

  // Bulk Period Cleanup Preview & Execution
  const cleanupPreview = useMemo(
    () =>
      previewPeriodDeletion(
        transactions,
        settlements,
        cleanupStart,
        cleanupEnd,
        cleanupScope,
        currencies
      ),
    [transactions, settlements, cleanupStart, cleanupEnd, cleanupScope, currencies]
  );

  const applyCleanupPreset = (preset) => {
    const { startDate, endDate } = getPeriodPresetDates(preset, selectedYear, selectedMonth);
    setCleanupStart(startDate);
    setCleanupEnd(endDate);
    setConfirmCleanupOpen(false);
  };

  const handleConfirmPeriodDelete = () => {
    if (!cleanupPreview.valid) return;
    const result = executePeriodDeletion(
      transactions,
      settlements,
      cleanupStart,
      cleanupEnd,
      cleanupScope
    );
    setTransactions(result.remainingTransactions);
    setSettlements(result.remainingSettlements);
    setConfirmCleanupOpen(false);
    showToast(
      `Deleted ${result.deletedTxCount} transactions${
        result.deletedSetCount > 0 ? ` and ${result.deletedSetCount} settlements` : ''
      } — balances recalculated`
    );
  };

  const handleResetDemo = () => {
    const demo = buildDemoData();
    setCurrencies(DEFAULT_CURRENCIES.map((c) => ({ ...c })));
    setPrimaryCurrency('AED');
    setBudgets(demo.budgets || {});
    setPeople(DEFAULT_PEOPLE);
    setSections(DEFAULT_SECTIONS);
    setCategories(DEFAULT_CATEGORIES);
    setAccounts(demo.accounts);
    setAccountTransfers(demo.accountTransfers);
    setTransactions(demo.transactions);
    setSettlements(demo.settlements);
    setUpcomingTransactions(demo.upcomingTransactions);
    setPendingTransactions(demo.pendingTransactions);
    setDismissedSmsSignatures([]);
    setDefaultSharing({ ...DEFAULT_SHARING_PREFS, categoryRules: {} });
    showToast('Reset to sample demo dataset');
  };

  const handleClearAll = () => {
    setAccounts(DEFAULT_ACCOUNTS.map((a) => ({ ...a })));
    setAccountTransfers([]);
    setTransactions([]);
    setSettlements([]);
    setUpcomingTransactions([]);
    setPendingTransactions([]);
    setDismissedSmsSignatures([]);
    setBudgets({});
    showToast('All transactions, transfers, pending, upcoming & budgets cleared');
  };

  const configuredRuleCatIds = Object.keys(defaultSharing.categoryRules || {});
  const activeTheme = appearancePrefs?.theme || 'dark';
  const initials = getProfileInitials(userProfile?.displayName);

  return (
    <div className="space-y-4">
      {/* ==================================================================== */}
      {/* USER PROFILE HEADER CARD                                             */}
      {/* ==================================================================== */}
      <div
        data-testid="user-profile-header"
        className="bg-white dark:bg-[#111827] p-4 sm:p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          {/* Avatar + Upload */}
          <div className="flex items-center gap-3.5 shrink-0">
            <div className="relative">
              {userProfile?.avatarDataUrl ? (
                <img
                  src={userProfile.avatarDataUrl}
                  alt={userProfile.displayName || 'User Avatar'}
                  className="w-16 h-16 rounded-2xl object-cover ring-2 ring-emerald-500/40 shadow-sm"
                />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white font-extrabold text-xl flex items-center justify-center ring-2 ring-emerald-500/30 shadow-sm select-none">
                  {initials}
                </div>
              )}
              <label
                htmlFor="profile-avatar-upload"
                title="Upload profile photo"
                className="absolute -bottom-1.5 -right-1.5 w-8 h-8 rounded-xl bg-slate-900 dark:bg-emerald-600 text-white border-2 border-white dark:border-[#111827] flex items-center justify-center cursor-pointer hover:opacity-90 active:scale-95 transition touch-manipulation"
              >
                <Camera size={14} />
                <input
                  id="profile-avatar-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
              </label>
            </div>

            <div className="sm:hidden min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/70">
                  <HardDrive size={11} />
                  <span>Offline Local Mode</span>
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Stored privately on this device
              </p>
            </div>
          </div>

          {/* Display Name & Photo Controls */}
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="profile-display-name"
                className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400"
              >
                Profile Display Name
              </label>
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/70">
                <HardDrive size={11} />
                <span>Offline Local Mode</span>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="profile-display-name"
                type="text"
                value={userProfile?.displayName || ''}
                onChange={(e) =>
                  setUserProfile((prev) => ({ ...prev, displayName: e.target.value }))
                }
                placeholder="Your display name"
                className="flex-1 min-h-[44px] px-3.5 py-2 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-sm font-extrabold text-slate-900 dark:text-slate-100 focus:outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-emerald-500"
              />
              {userProfile?.avatarDataUrl && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  className="min-h-[44px] px-3 py-2 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 border border-slate-200 dark:border-slate-700 text-xs font-bold shrink-0 touch-manipulation transition"
                >
                  Remove Photo
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Cloud Sync — Coming Soon Card */}
        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0">
              <CloudOff size={17} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-extrabold text-slate-900 dark:text-slate-100">
                  Cloud Sync
                </span>
                <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/60">
                  Coming Soon
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                All ledgers, budgets &amp; SMS drafts are stored locally on-device. Use JSON Backup for transfers.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 4 ORGANIZED SETTINGS SECTIONS NAVIGATION                             */}
      {/* ==================================================================== */}
      <div className="grid grid-cols-2 sm:grid-cols-4 p-1.5 bg-slate-200/80 dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800 select-none gap-1">
        {[
          { id: 'appearance', label: 'Appearance', icon: Palette },
          { id: 'currencies_accounts', label: 'Currencies & Accounts', icon: Wallet },
          { id: 'sharing_people', label: 'Sharing & People', icon: Users },
          { id: 'data', label: 'Data Management', icon: HardDrive }
        ].map((tab) => {
          const Icon = tab.icon;
          const active = settingsTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              data-testid={`settings-tab-${tab.id}`}
              onClick={() => setSettingsTab(tab.id)}
              className={`min-h-[44px] py-2 px-2 text-[11px] sm:text-xs font-extrabold rounded-xl flex items-center justify-center gap-1.5 transition touch-manipulation whitespace-nowrap ${
                active
                  ? 'bg-white dark:bg-slate-800 text-indigo-700 dark:text-emerald-400 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Icon size={14} className="shrink-0" />
              <span className="truncate">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ==================================================================== */}
      {/* SECTION 1: APPEARANCE (THEME SWITCHER + SPLASH + ICON EXPORTER)      */}
      {/* ==================================================================== */}
      {settingsTab === 'appearance' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-[#111827] p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 shrink-0">
                <Palette size={19} />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                  Theme Preference
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Switch seamlessly between Dark Mode, Light Mode, or match your device system setting.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'dark', label: 'Dark Mode', icon: Moon },
                { id: 'light', label: 'Light Mode', icon: Sun },
                { id: 'system', label: 'System', icon: Monitor }
              ].map((opt) => {
                const Icon = opt.icon;
                const isSelected = activeTheme === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    data-testid={`theme-option-${opt.id}`}
                    onClick={() => {
                      setAppearancePrefs((prev) => ({ ...prev, theme: opt.id }));
                      showToast(`Theme set to ${opt.label}`);
                    }}
                    className={`min-h-[68px] p-3 rounded-2xl border flex flex-col items-center justify-center gap-1.5 transition touch-manipulation active:scale-[0.98] ${
                      isSelected
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-emerald-400'
                    }`}
                  >
                    <Icon size={18} />
                    <span className="text-xs font-extrabold whitespace-nowrap">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <AppAssetGeneratorCard
            showLaunchSplash={appearancePrefs?.showLaunchSplash !== false}
            onToggleLaunchSplash={(val) =>
              setAppearancePrefs((prev) => ({ ...prev, showLaunchSplash: val }))
            }
            showToast={showToast}
          />
        </div>
      )}

      {/* ==================================================================== */}
      {/* SECTION 2: CURRENCIES & ACCOUNTS (+ SECTIONS & CATEGORIES)           */}
      {/* ==================================================================== */}
      {settingsTab === 'currencies_accounts' && (
        <div className="space-y-4">
          {/* CURRENCIES MANAGER */}
          <div
            data-testid="currencies-manager-card"
            className="bg-white dark:bg-[#111827] p-4 sm:p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-4"
          >
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 shrink-0">
                <Coins size={19} />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                  Currencies Manager
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  AED &amp; EGP are built-in defaults. Add extra currencies (USD, EUR, SAR, etc.) — every currency stays strictly separate.
                </p>
              </div>
            </div>

            {currencyWarning && (
              <div
                data-testid="currency-warning-banner"
                className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/70 text-xs font-bold text-amber-900 dark:text-amber-200 flex items-start gap-2"
              >
                <AlertCircle size={15} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                <span>{currencyWarning}</span>
              </div>
            )}

            {/* Active Currencies List */}
            <div className="space-y-2">
              {currencies.map((cur, idx) => {
                const isPrimary = primaryCurrency === cur.code;
                const usage = getCurrencyUsage(cur.code, currencyUsageState);
                const accent = getCurrencyAccent(cur.code, idx);
                return (
                  <div
                    key={cur.code}
                    data-testid={`currency-row-${cur.code}`}
                    className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`px-2.5 py-1 rounded-xl text-xs font-extrabold shrink-0 ${accent.badgeClass}`}
                      >
                        {cur.code}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-extrabold text-slate-900 dark:text-slate-100 truncate">
                            {cur.name}
                          </span>
                          <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500">
                            ({cur.symbol})
                          </span>
                          {isPrimary && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300">
                              <Star size={10} />
                              Primary
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {usage.accountCount} account{usage.accountCount === 1 ? '' : 's'} ·{' '}
                          {usage.txCount} transaction{usage.txCount === 1 ? '' : 's'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {!isPrimary && (
                        <button
                          type="button"
                          onClick={() => {
                            setPrimaryCurrency(cur.code);
                            showToast(`Primary currency set to ${cur.code}`);
                          }}
                          className="min-h-[36px] px-2.5 py-1 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-extrabold text-slate-700 dark:text-slate-200 hover:border-indigo-400 touch-manipulation whitespace-nowrap"
                        >
                          Set Primary
                        </button>
                      )}
                      {cur.builtIn || cur.code === 'AED' || cur.code === 'EGP' ? (
                        <span className="text-[10px] font-bold uppercase px-2 py-1 rounded-lg bg-slate-200/70 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                          Built-in
                        </span>
                      ) : (
                        <button
                          type="button"
                          aria-label={`Delete currency ${cur.code}`}
                          onClick={() => handleRemoveCurrency(cur)}
                          className={`min-h-[36px] px-2.5 py-1 rounded-xl border text-[11px] font-bold flex items-center gap-1 touch-manipulation ${
                            usage.inUse
                              ? 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500'
                              : 'bg-white dark:bg-slate-800 border-rose-200 dark:border-rose-800/60 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                          }`}
                        >
                          <Trash2 size={13} />
                          <span>Delete</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Quick-Add Presets */}
            {availablePresets.length > 0 && (
              <div className="space-y-2">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                  Quick-Add Popular Currencies
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {availablePresets.map((preset) => (
                    <button
                      key={preset.code}
                      type="button"
                      data-testid={`add-preset-${preset.code}`}
                      onClick={() => handleAddPresetCurrency(preset)}
                      className="min-h-[38px] px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 border border-slate-200 dark:border-slate-700 hover:border-emerald-400 text-xs font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-1 transition touch-manipulation active:scale-95"
                    >
                      <Plus size={13} />
                      <span>{preset.code}</span>
                      <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                        ({preset.symbol})
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Add Custom Currency Form */}
            <form
              onSubmit={handleAddCustomCurrency}
              className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2.5"
            >
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                Add Custom Currency
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                <input
                  type="text"
                  maxLength={3}
                  placeholder="Code (e.g. JOD)"
                  aria-label="Custom currency code"
                  value={customCode}
                  onChange={(e) => setCustomCode(e.target.value.toUpperCase())}
                  className="min-h-[44px] px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-extrabold text-slate-900 dark:text-slate-100 uppercase"
                />
                <input
                  type="text"
                  maxLength={5}
                  placeholder="Symbol (e.g. JD)"
                  aria-label="Custom currency symbol"
                  value={customSymbol}
                  onChange={(e) => setCustomSymbol(e.target.value)}
                  className="min-h-[44px] px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-slate-100"
                />
                <input
                  type="text"
                  placeholder="Name (e.g. Jordanian Dinar)"
                  aria-label="Custom currency name"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="min-h-[44px] px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-slate-100"
                />
                <button
                  type="submit"
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold flex items-center justify-center gap-1 touch-manipulation active:scale-95"
                >
                  <Plus size={14} />
                  <span>Add</span>
                </button>
              </div>
            </form>
          </div>

          {/* ACCOUNTS & CARDS MANAGER */}
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

          {/* CUSTOM SECTIONS & CATEGORIES */}
          <div className="space-y-3 pt-2">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                Sections &amp; Categories
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Organize main budget sections and individual spending/income parts.
              </p>
            </div>

            <form
              onSubmit={handleAddSection}
              className="bg-white dark:bg-[#111827] p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-3"
            >
              <h4 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                Create Custom Section
              </h4>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  placeholder="e.g., Medical, Investments, Car..."
                  value={newSectionName}
                  onChange={(e) => setNewSectionName(e.target.value)}
                  className="flex-1 min-h-[46px] px-3.5 py-2 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-900 dark:text-slate-100"
                />
                <select
                  value={newSectionType}
                  onChange={(e) => setNewSectionType(e.target.value)}
                  className="min-h-[46px] px-3 py-2 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-slate-100"
                >
                  <option value="expense">Expense Section</option>
                  <option value="income">Income Section</option>
                </select>
                <button
                  type="submit"
                  className="min-h-[46px] px-4 py-2 rounded-2xl bg-slate-900 dark:bg-indigo-600 text-white text-xs font-extrabold touch-manipulation"
                >
                  Add Section
                </button>
              </div>
            </form>

            <form
              onSubmit={handleAddCategory}
              className="bg-white dark:bg-[#111827] p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-3"
            >
              <h4 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                Create New Category (Part)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Category name (e.g., Gym, Coffee)"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="min-h-[46px] px-3.5 py-2 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-900 dark:text-slate-100"
                />
                <select
                  value={newCatSectionId}
                  onChange={(e) => setNewCatSectionId(e.target.value)}
                  className="min-h-[46px] px-3 py-2 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-slate-100"
                >
                  {sections.map((s) => (
                    <option key={s.id} value={s.id}>
                      Section: {s.name} ({s.type})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {COLOR_PALETTE.map((col) => (
                    <button
                      key={col}
                      type="button"
                      aria-label={`Category color ${col}`}
                      onClick={() => setNewCatColor(col)}
                      className={`w-7 h-7 rounded-lg border-2 ${
                        newCatColor === col
                          ? 'border-slate-900 dark:border-white scale-110'
                          : 'border-transparent'
                      }`}
                      style={{ backgroundColor: col }}
                    />
                  ))}
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {ICON_NAMES.map((iconName) => {
                    const Ic = ICON_MAP[iconName];
                    return (
                      <button
                        key={iconName}
                        type="button"
                        aria-label={`Select icon ${iconName}`}
                        onClick={() => setNewCatIcon(iconName)}
                        className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
                          newCatIcon === iconName
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        <Ic size={16} />
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="submit"
                className="w-full min-h-[48px] py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold touch-manipulation"
              >
                + Add Category
              </button>
            </form>

            <div className="space-y-3">
              {sections.map((sec) => {
                const secCats = categories.filter((c) => c.sectionId === sec.id);
                return (
                  <div
                    key={sec.id}
                    className="bg-white dark:bg-[#111827] p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                          {sec.name}
                        </h4>
                        <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500">
                          {sec.type} section · {secCats.length} categories
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteSection(sec.id)}
                        aria-label={`Delete section ${sec.name}`}
                        className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400"
                        title="Delete Section"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>

                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {secCats.map((cat) => (
                        <div key={cat.id} className="py-2 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <CategoryIcon iconName={cat.icon} color={cat.color} size={15} />
                            {editingCatId === cat.id ? (
                              <input
                                type="text"
                                value={editingCatName}
                                onChange={(e) => setEditingCatName(e.target.value)}
                                className="flex-1 min-h-[38px] px-2.5 py-1 rounded-xl border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-slate-100"
                              />
                            ) : (
                              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                                {cat.name}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            {editingCatId === cat.id ? (
                              <button
                                type="button"
                                aria-label={`Save category name ${cat.name}`}
                                onClick={() => handleRenameCategory(cat.id)}
                                className="p-2 text-emerald-600 dark:text-emerald-400"
                              >
                                <Check size={16} />
                              </button>
                            ) : (
                              <button
                                type="button"
                                aria-label={`Rename ${cat.name}`}
                                onClick={() => {
                                  setEditingCatId(cat.id);
                                  setEditingCatName(cat.name);
                                }}
                                className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400"
                              >
                                <Edit3 size={15} />
                              </button>
                            )}
                            <button
                              type="button"
                              aria-label={`Delete ${cat.name}`}
                              onClick={() => handleDeleteCategory(cat.id)}
                              className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* SECTION 3: SHARING & PEOPLE (DEFAULTS + DYNAMIC PARTICIPANTS)        */}
      {/* ==================================================================== */}
      {settingsTab === 'sharing_people' && (
        <div className="space-y-4">
          {/* DEFAULT SHARING PREFERENCES */}
          <div className="bg-white dark:bg-[#111827] p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-4">
            <div className="flex items-start gap-2.5">
              <div className="p-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 shrink-0">
                <Sliders size={18} />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                  Default Sharing Settings
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Pre-fill new transactions automatically. You can always override any single transaction.
                </p>
              </div>
            </div>

            <div>
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1.5">
                Default Transaction Scope
              </span>
              <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl select-none">
                {[
                  { id: 'personal', label: 'Personal' },
                  { id: 'shared', label: 'Shared Split' }
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => updateGlobalDefault({ scope: opt.id })}
                    className={`min-h-[42px] py-1.5 text-xs font-extrabold rounded-xl transition touch-manipulation ${
                      defaultSharing.scope === opt.id
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1.5">
                Default Payer
              </span>
              <div className="flex flex-wrap gap-2">
                {activePeople.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => updateGlobalDefault({ paidBy: p.id })}
                    className={`min-h-[40px] px-3 py-1.5 rounded-xl border text-xs font-extrabold flex items-center gap-1.5 transition touch-manipulation ${
                      defaultSharing.paidBy === p.id
                        ? 'bg-slate-900 dark:bg-emerald-600 text-white border-slate-900 dark:border-emerald-600'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{
                        backgroundColor: defaultSharing.paidBy === p.id ? '#fff' : p.color
                      }}
                    />
                    <span>{p.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1.5">
                Default Split Method
              </span>
              <div className="grid grid-cols-3 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl select-none">
                {[
                  { id: 'equal', label: 'Equal' },
                  { id: 'custom', label: 'Custom Amounts' },
                  { id: 'percentage', label: 'Percentages %' }
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => updateGlobalDefault({ splitMode: m.id })}
                    className={`min-h-[40px] py-1.5 text-xs font-extrabold rounded-xl transition touch-manipulation ${
                      defaultSharing.splitMode === m.id
                        ? 'bg-white dark:bg-slate-700 text-indigo-700 dark:text-white shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1.5">
                Default Participants in Shared Expenses
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {activePeople.map((p) => {
                  const checked = (defaultSharing.participantIds || []).includes(p.id);
                  return (
                    <label
                      key={p.id}
                      className="min-h-[44px] flex items-center gap-2.5 px-3 py-2 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 cursor-pointer select-none"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleGlobalDefaultParticipant(p.id)}
                        className="w-4 h-4 rounded accent-indigo-600"
                      />
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: p.color }}
                      />
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                        {p.name}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          {/* PER-CATEGORY DEFAULT SPLIT RULES */}
          <div className="bg-white dark:bg-[#111827] p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-3.5">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                Per-Category Default Split Rules
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Override global defaults for specific categories (e.g., Groceries or Rent always Shared).
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <select
                aria-label="Select category to add default rule"
                value={ruleCategoryId}
                onChange={(e) => setRuleCategoryId(e.target.value)}
                className="flex-1 min-h-[44px] px-3 py-2 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-100"
              >
                {expenseCategories.map((cat) => (
                  <option
                    key={cat.id}
                    value={cat.id}
                    disabled={Boolean(defaultSharing.categoryRules?.[cat.id])}
                  >
                    {cat.name}
                    {defaultSharing.categoryRules?.[cat.id] ? ' (Rule Active)' : ''}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleAddCategoryRule}
                disabled={Boolean(defaultSharing.categoryRules?.[ruleCategoryId])}
                className="min-h-[44px] px-4 py-2 rounded-2xl bg-slate-900 dark:bg-indigo-600 disabled:opacity-40 text-white text-xs font-extrabold touch-manipulation"
              >
                + Add Category Rule
              </button>
            </div>

            {configuredRuleCatIds.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-3">
                No per-category overrides configured yet — all categories use Global Defaults above.
              </p>
            ) : (
              <div className="space-y-3">
                {configuredRuleCatIds.map((catId) => {
                  const cat = categories.find((c) => c.id === catId);
                  const rule = defaultSharing.categoryRules[catId];
                  if (!cat || !rule) return null;

                  return (
                    <div
                      key={catId}
                      className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 space-y-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <CategoryIcon iconName={cat.icon} color={cat.color} size={15} />
                          <span className="text-xs font-extrabold text-slate-900 dark:text-slate-100">
                            {cat.name}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeCategoryRule(catId)}
                          aria-label={`Remove rule for ${cat.name}`}
                          className="min-h-[32px] px-2 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl flex items-center gap-1"
                        >
                          <Trash2 size={13} />
                          <span>Remove</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                        <select
                          aria-label={`Scope for ${cat.name}`}
                          value={rule.scope}
                          onChange={(e) => updateCategoryRule(catId, { scope: e.target.value })}
                          className="min-h-[40px] px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-slate-900 dark:text-slate-100"
                        >
                          <option value="shared">Scope: Shared</option>
                          <option value="personal">Scope: Personal</option>
                        </select>

                        <select
                          aria-label={`Default payer for ${cat.name}`}
                          value={rule.paidBy}
                          onChange={(e) => updateCategoryRule(catId, { paidBy: e.target.value })}
                          className="min-h-[40px] px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-slate-900 dark:text-slate-100"
                        >
                          {activePeople.map((p) => (
                            <option key={p.id} value={p.id}>
                              Payer: {p.name}
                            </option>
                          ))}
                        </select>

                        <select
                          aria-label={`Split method for ${cat.name}`}
                          value={rule.splitMode}
                          onChange={(e) =>
                            updateCategoryRule(catId, { splitMode: e.target.value })
                          }
                          className="min-h-[40px] px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-slate-900 dark:text-slate-100"
                        >
                          <option value="equal">Split: Equal</option>
                          <option value="custom">Split: Custom</option>
                          <option value="percentage">Split: Percent %</option>
                        </select>
                      </div>

                      {rule.scope === 'shared' && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {activePeople.map((p) => {
                            const checked = (rule.participantIds || []).includes(p.id);
                            return (
                              <label
                                key={p.id}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[11px] font-bold cursor-pointer select-none ${
                                  checked
                                    ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-800 text-indigo-800 dark:text-indigo-200'
                                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleCategoryRuleParticipant(catId, p.id)}
                                  className="w-3.5 h-3.5 accent-indigo-600"
                                />
                                <span>{p.name}</span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ADD NEW PARTICIPANT FORM */}
          <form
            onSubmit={handleAddPerson}
            className="bg-white dark:bg-[#111827] p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-3"
          >
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                <UserPlus size={18} />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                  Add New Participant
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Add as many people as you share expenses with
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                placeholder="Name (e.g., Lina, Ahmed, Roommate)"
                value={newPersonName}
                onChange={(e) => setNewPersonName(e.target.value)}
                className="flex-1 min-h-[46px] px-3.5 py-2 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                className="min-h-[46px] px-5 py-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 touch-manipulation active:scale-95"
              >
                <Plus size={16} />
                <span>Add Person</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mr-1">
                Badge Color:
              </span>
              {COLOR_PALETTE.map((col) => (
                <button
                  key={col}
                  type="button"
                  aria-label={`Select color ${col}`}
                  onClick={() => setNewPersonColor(col)}
                  className={`w-7 h-7 rounded-xl border-2 transition ${
                    newPersonColor === col
                      ? 'border-slate-900 dark:border-white scale-110'
                      : 'border-transparent'
                  }`}
                  style={{ backgroundColor: col }}
                />
              ))}
            </div>
          </form>

          {/* ACTIVE PARTICIPANTS LIST */}
          <div className="bg-white dark:bg-[#111827] p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                Active Participants ({activePeople.length})
              </h3>
              {archivedPeople.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowArchivedPeople((v) => !v)}
                  className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  {showArchivedPeople ? 'Hide' : 'Show'} Archived ({archivedPeople.length})
                </button>
              )}
            </div>

            <div className="space-y-3">
              {activePeople.map((person, idx) => {
                const isPrimary = person.id === 'me';
                const debtStatus = !isPrimary
                  ? getParticipantDebtStatus(person.id, allDebtItems, currencies)
                  : { hasUnsettledBalance: false, byCurrency: {} };
                const txCount = transactions.filter(
                  (t) =>
                    t.paidBy === person.id ||
                    t.belongsTo === person.id ||
                    (t.shares && (t.shares[person.id] || 0) > 0)
                ).length;

                const debtSummaryParts = [];
                if (!isPrimary && debtStatus.byCurrency) {
                  Object.entries(debtStatus.byCurrency).forEach(([curCode, vals]) => {
                    if (vals.receive > 0) debtSummaryParts.push(`Owes ${formatMoney(vals.receive, curCode)}`);
                    if (vals.pay > 0) debtSummaryParts.push(`You owe ${formatMoney(vals.pay, curCode)}`);
                  });
                }

                return (
                  <div
                    key={person.id}
                    className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3.5 h-3.5 rounded-full shrink-0"
                          style={{ backgroundColor: person.color }}
                        />
                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          {isPrimary ? 'Primary Account Holder (Me)' : `Participant ${idx + 1}`}
                        </span>
                      </div>

                      {!isPrimary && (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleArchiveToggle(person)}
                            title="Archive participant (keeps historical ledger)"
                            aria-label={`Archive ${person.name}`}
                            className="min-h-[34px] px-2.5 py-1 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:text-indigo-700 dark:hover:text-indigo-400 flex items-center gap-1 touch-manipulation"
                          >
                            <Archive size={13} />
                            <span>Archive</span>
                          </button>

                          {confirmDeletePersonId === person.id ? (
                            <div className="flex items-center gap-1 bg-rose-50 dark:bg-rose-950/60 px-2 py-1 rounded-xl border border-rose-200 dark:border-rose-800">
                              <button
                                type="button"
                                onClick={() => handleDeletePerson(person)}
                                className="min-h-[28px] px-1.5 text-[11px] font-extrabold text-rose-700 dark:text-rose-300"
                              >
                                Confirm
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeletePersonId(null)}
                                className="min-h-[28px] px-1 text-[11px] text-slate-600 dark:text-slate-400"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                if (debtStatus.hasUnsettledBalance) {
                                  showToast(
                                    `Cannot delete ${person.name}: unsettled balance exists. Settle or Archive instead.`,
                                    'error'
                                  );
                                  return;
                                }
                                setConfirmDeletePersonId(person.id);
                              }}
                              aria-label={`Delete ${person.name}`}
                              className={`min-h-[34px] px-2.5 py-1 rounded-xl border text-[11px] font-bold flex items-center gap-1 touch-manipulation ${
                                debtStatus.hasUnsettledBalance
                                  ? 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                                  : 'bg-white dark:bg-slate-800 border-rose-200 dark:border-rose-800/60 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                              }`}
                            >
                              <Trash2 size={13} />
                              <span>Delete</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    <input
                      type="text"
                      aria-label={`Name for ${person.name}`}
                      value={person.name}
                      onChange={(e) => handleUpdatePerson(person.id, 'name', e.target.value)}
                      className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-slate-100"
                    />

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {COLOR_PALETTE.map((col) => (
                        <button
                          key={col}
                          type="button"
                          aria-label={`Color ${col} for ${person.name}`}
                          onClick={() => handleUpdatePerson(person.id, 'color', col)}
                          className={`w-7 h-7 rounded-xl border-2 transition ${
                            person.color === col
                              ? 'border-slate-900 dark:border-white scale-110'
                              : 'border-transparent'
                          }`}
                          style={{ backgroundColor: col }}
                        />
                      ))}
                    </div>

                    {!isPrimary && debtStatus.hasUnsettledBalance && (
                      <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/70 text-[11px] font-semibold text-amber-900 dark:text-amber-200 flex items-start gap-2">
                        <AlertCircle size={14} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                        <span>
                          Unsettled balance active ({debtSummaryParts.join(' · ')}) — settle debts first to delete, or use Archive.
                        </span>
                      </div>
                    )}

                    {!isPrimary && !debtStatus.hasUnsettledBalance && txCount > 0 && confirmDeletePersonId === person.id && (
                      <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-[11px] font-semibold text-rose-800 dark:text-rose-200">
                        Warning: {person.name} appears in {txCount} historical settled transactions.
                        Archive keeps their name &amp; color intact; Delete removes them permanently.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {showArchivedPeople && archivedPeople.length > 0 && (
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Archived Participants
                </h4>
                {archivedPeople.map((person) => (
                  <div
                    key={person.id}
                    className="p-3 rounded-2xl bg-slate-100/80 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-3 h-3 rounded-full shrink-0 opacity-70"
                        style={{ backgroundColor: person.color }}
                      />
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">
                        {person.name}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleArchiveToggle(person)}
                      className="min-h-[34px] px-3 py-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-extrabold text-indigo-700 dark:text-indigo-400 flex items-center gap-1 touch-manipulation"
                    >
                      <RotateCcw size={13} />
                      <span>Restore</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* SECTION 4: DATA MANAGEMENT (BACKUP v4, RESTORE, PERIOD CLEANUP)      */}
      {/* ==================================================================== */}
      {settingsTab === 'data' && (
        <div className="space-y-4">
          {/* Android Home Screen PWA Installation Guide */}
          <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-4 rounded-3xl border border-indigo-800/60 shadow-sm flex items-start gap-3.5">
            <div className="p-2.5 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 shrink-0 mt-0.5">
              <Smartphone size={22} />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-extrabold text-white">
                  Install on Android Home Screen
                </h3>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  PWA Ready
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Open in <strong className="text-white">Google Chrome</strong>, tap{' '}
                <strong className="text-indigo-300">⋮ Menu</strong>, and select{' '}
                <strong className="text-white">“Add to Home screen”</strong> or{' '}
                <strong className="text-white">“Install app”</strong> for a full-screen offline experience.
              </p>
            </div>
          </div>

          {/* Export Card */}
          <div className="bg-white dark:bg-[#111827] p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                <Download size={20} />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                  Export &amp; Backup (v4)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Includes {currencies.length} currencies, {accounts.length} accounts,{' '}
                  {transactions.length} transactions, budgets, profile, {pendingTransactions.length} pending,{' '}
                  {upcomingTransactions.length} upcoming &amp; {settlements.length} settlements.
                </p>
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleExportJSON(true)}
                  className="min-h-[50px] py-3 px-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.97] text-white text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 shadow-sm touch-manipulation transition"
                >
                  <Share2 size={17} />
                  <span>Share JSON</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleExportJSON(false)}
                  className="min-h-[50px] py-3 px-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-950 active:scale-[0.97] text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/70 text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 touch-manipulation transition"
                >
                  <FileJson size={17} />
                  <span>Download JSON</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleExportCSV(true)}
                  className="min-h-[50px] py-3 px-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.97] text-white text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 shadow-sm touch-manipulation transition"
                >
                  <Share2 size={17} />
                  <span>Share CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleExportCSV(false)}
                  className="min-h-[50px] py-3 px-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-950 active:scale-[0.97] text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/70 text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 touch-manipulation transition"
                >
                  <FileSpreadsheet size={17} />
                  <span>Download CSV</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleCopyJSONClipboard}
                className="w-full min-h-[46px] py-2.5 px-4 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-[0.98] text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-2 touch-manipulation transition"
              >
                <Copy size={15} />
                <span>Copy Raw JSON Backup to Clipboard</span>
              </button>
            </div>
          </div>

          {/* Import / Restore Card */}
          <div className="bg-white dark:bg-[#111827] p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
                <Upload size={20} />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                  Import &amp; Restore Backup
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Backward compatible with v1, v2, v3 &amp; v4 JSON backups. Duplicate records are skipped on merge.
                </p>
              </div>
            </div>

            <label className="w-full min-h-[54px] flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border-2 border-dashed border-indigo-300 dark:border-indigo-700 bg-indigo-50/40 dark:bg-indigo-950/30 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 text-xs sm:text-sm font-extrabold cursor-pointer touch-manipulation">
              <Upload size={18} />
              <span>Select JSON Backup File</span>
              <input
                type="file"
                accept=".json,application/json"
                onChange={handleSelectBackupFile}
                className="hidden"
              />
            </label>

            {pendingImport && (
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 space-y-3 text-xs">
                <div className="font-extrabold text-slate-900 dark:text-slate-100">
                  Ready to Import: {pendingImport.fileName}
                </div>
                <div className="space-y-1 text-slate-600 dark:text-slate-300">
                  <div>
                    • Currencies in file: <strong>{pendingImport.currencyCount}</strong>
                  </div>
                  <div>
                    • Budgeted sections in file: <strong>{pendingImport.budgetSectionCount}</strong>
                  </div>
                  <div>
                    • Accounts in file: <strong>{pendingImport.accountCount}</strong>
                  </div>
                  <div>
                    • Transactions in file: <strong>{pendingImport.totalTx}</strong>
                  </div>
                  <div>
                    • New unique records:{' '}
                    <strong className="text-emerald-700 dark:text-emerald-400">
                      {pendingImport.newCount}
                    </strong>
                  </div>
                  <div>
                    • Duplicates skipped on merge: <strong>{pendingImport.duplicateCount}</strong>
                  </div>
                  <div>
                    • Settlements in file: <strong>{pendingImport.settlementCount}</strong>
                  </div>
                  <div>
                    • Upcoming items in file: <strong>{pendingImport.upcomingCount}</strong> (
                    {pendingImport.newUpcomingCount} new)
                  </div>
                  <div>
                    • Pending Bank SMS in file: <strong>{pendingImport.pendingCount}</strong>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => applyImport('merge')}
                    className="min-h-[46px] py-2.5 px-3 rounded-xl bg-indigo-600 text-white font-extrabold"
                  >
                    Merge (Skip Duplicates)
                  </button>
                  <button
                    type="button"
                    onClick={() => applyImport('replace')}
                    className="min-h-[46px] py-2.5 px-3 rounded-xl bg-rose-600 text-white font-extrabold"
                  >
                    Replace All Data
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Delete Data by Date Period (Bulk Period Cleanup) */}
          <div className="bg-white dark:bg-[#111827] p-5 rounded-3xl border border-rose-200/80 dark:border-rose-900/60 shadow-2xs space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 shrink-0">
                <CalendarX2 size={20} />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                  Delete Data by Date Period
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Bulk remove older or specific-period records. Remaining balances &amp; reports recalculate automatically.
                </p>
              </div>
            </div>

            <div>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1.5">
                Quick Presets
              </span>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'selected_month', label: 'Selected Month' },
                  { id: 'older_3m', label: 'Older than 3 Months' },
                  { id: 'older_6m', label: 'Older than 6 Months' },
                  { id: 'older_1y', label: 'Older than 1 Year' }
                ].map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyCleanupPreset(preset.id)}
                    className="min-h-[40px] px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 touch-manipulation active:scale-[0.98]"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label
                  htmlFor="cleanup-start"
                  className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1"
                >
                  Start Date
                </label>
                <input
                  id="cleanup-start"
                  type="date"
                  value={cleanupStart}
                  onChange={(e) => {
                    setCleanupStart(e.target.value);
                    setConfirmCleanupOpen(false);
                  }}
                  className="w-full min-h-[44px] text-xs font-bold px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label
                  htmlFor="cleanup-end"
                  className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1"
                >
                  End Date
                </label>
                <input
                  id="cleanup-end"
                  type="date"
                  value={cleanupEnd}
                  onChange={(e) => {
                    setCleanupEnd(e.target.value);
                    setConfirmCleanupOpen(false);
                  }}
                  className="w-full min-h-[44px] text-xs font-bold px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <div>
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1.5">
                What to Delete
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  { id: 'transactions_only', label: 'Transactions Only' },
                  { id: 'transactions_and_settlements', label: 'Transactions + Settlements in Period' }
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setCleanupScope(opt.id);
                      setConfirmCleanupOpen(false);
                    }}
                    className={`min-h-[42px] px-3 py-2 rounded-xl border text-xs font-extrabold transition touch-manipulation ${
                      cleanupScope === opt.id
                        ? 'bg-rose-600 text-white border-rose-600'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 space-y-1.5 text-xs">
              <div className="font-extrabold text-slate-900 dark:text-slate-100">
                Exact Preview ({cleanupStart} to {cleanupEnd})
              </div>
              {!cleanupPreview.valid ? (
                <p className="text-rose-600 dark:text-rose-400 font-bold">
                  Start Date must be on or before End Date.
                </p>
              ) : (
                <div className="space-y-1 text-slate-700 dark:text-slate-300">
                  {Object.entries(cleanupPreview.byCurrency || {}).map(([curCode, stats]) => (
                    <div key={curCode}>
                      • {curCode} matching:{' '}
                      <strong className="text-indigo-700 dark:text-indigo-300">
                        {stats.txCount} txns
                      </strong>
                      {cleanupScope === 'transactions_and_settlements' && (
                        <span> · {stats.setCount} settlements</span>
                      )}
                    </div>
                  ))}
                  <div className="pt-1 border-t border-slate-200 dark:border-slate-800 font-extrabold text-slate-900 dark:text-slate-100">
                    Total to delete: {cleanupPreview.totalTxCount} transactions
                    {cleanupScope === 'transactions_and_settlements'
                      ? ` + ${cleanupPreview.totalSetCount} settlements`
                      : ''}
                  </div>
                </div>
              )}
            </div>

            {!confirmCleanupOpen ? (
              <button
                type="button"
                disabled={
                  !cleanupPreview.valid ||
                  (cleanupPreview.totalTxCount === 0 && cleanupPreview.totalSetCount === 0)
                }
                onClick={() => setConfirmCleanupOpen(true)}
                className="w-full min-h-[48px] py-2.5 px-4 rounded-2xl bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white text-xs font-extrabold touch-manipulation active:scale-[0.98]"
              >
                Delete Matching Period Data
              </button>
            ) : (
              <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 space-y-2.5">
                <p className="text-xs font-extrabold text-rose-900 dark:text-rose-200">
                  Confirm permanent deletion of {cleanupPreview.totalTxCount} transactions
                  {cleanupScope === 'transactions_and_settlements'
                    ? ` and ${cleanupPreview.totalSetCount} settlements`
                    : ''}
                  ? This cannot be undone.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmCleanupOpen(false)}
                    className="min-h-[44px] py-2 px-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmPeriodDelete}
                    className="min-h-[44px] py-2 px-3 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-extrabold"
                  >
                    Confirm Permanent Delete
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Data Management Reset Utilities */}
          <div className="bg-white dark:bg-[#111827] p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-2xs flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleResetDemo}
              className="flex-1 min-h-[46px] py-2.5 px-3 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-extrabold touch-manipulation"
            >
              Load Sample Data
            </button>
            <button
              type="button"
              onClick={handleClearAll}
              className="flex-1 min-h-[46px] py-2.5 px-3 rounded-2xl bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/70 text-xs font-extrabold touch-manipulation"
            >
              Clear All Transactions
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
