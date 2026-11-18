// Pure UAE & Egyptian Bank SMS Parser, Last-4-Digit Card Matcher,
// OTP/Promo Filter, and Deduplication Engine.

import { pad2, resolveSharingDefaults, round2 } from './financeEngine.js';

const BANK_MATCHERS = [
  { pattern: /\b(emirates\s*nbd|enbd)\b/i, name: 'Emirates NBD' },
  { pattern: /\b(mashreq\s*neo|mashreq)\b/i, name: 'Mashreq' },
  { pattern: /\b(adcb|abu\s*dhabi\s*commercial)\b/i, name: 'ADCB' },
  { pattern: /\b(wio|wiobank)\b/i, name: 'Wio Bank' },
  { pattern: /\b(fab|first\s*abu\s*dhabi)\b/i, name: 'FAB' },
  { pattern: /\b(dib|dubai\s*islamic)\b/i, name: 'DIB' },
  { pattern: /\b(adib|abu\s*dhabi\s*islamic)\b/i, name: 'ADIB' },
  { pattern: /\b(cbd|commercial\s*bank\s*of\s*dubai)\b/i, name: 'CBD' },
  { pattern: /\b(rakbank|rak\s*bank)\b/i, name: 'RAKBank' },
  { pattern: /\b(cib|commercial\s*international)\b/i, name: 'CIB' },
  { pattern: /\b(nbe|national\s*bank\s*of\s*egypt|alahly)\b/i, name: 'NBE' },
  { pattern: /\b(qnb|qnb\s*alahli)\b/i, name: 'QNB' },
  { pattern: /\b(banque\s*misr|bm)\b/i, name: 'Banque Misr' },
  { pattern: /\b(alex\s*bank|bank\s*of\s*alexandria)\b/i, name: 'AlexBank' },
  { pattern: /\b(hsbc)\b/i, name: 'HSBC' },
  { pattern: /\b(instapay)\b/i, name: 'InstaPay' }
];

const OTP_OR_SECURITY_RE =
  /\b(otp|one[\s-]*time\s*(?:password|passcode|pin|code)|verification\s*code|security\s*code|auth(?:entication)?\s*code|login\s*code|3d\s*secure|do\s*not\s*share|never\s*share\s*this|passcode\s*is|pin\s*is|cvv|activation\s*code)\b/i;

const STRONG_PROMO_RE =
  /\b(pre[\s-]*approved|exclusive\s*offer|win\s*up\s*to|0%\s*(?:epp|easy\s*payment|interest|installment)|apply\s*now|click\s*here|bit\.ly|unsubscribe|cashback\s*offer|enjoy\s*\d+%\s*(?:off|discount)|limited\s*time\s*offer|minimum\s*payment\s*due|statement\s*(?:is\s*)?(?:ready|generated)|loan\s*offer)\b/i;

const EXPENSE_RE =
  /\b(purchase|purchased|debited|debit|spent|payment\s*(?:of|made|to|for)|paid|withdrawn|withdrawal|pos\b|online\s*(?:txn|transaction|purchase)|atm\s*(?:withdrawal|cash)|charged|deducted|transfer\s*to|sent\s*to|outgoing\s*transfer|bill\s*payment|apple\s*pay|samsung\s*pay)\b/i;

const INCOME_RE =
  /\b(credited|has\s+been\s+credited|credit\s+(?:of|alert|amount|from|to\s+your)|received|salary|payroll|refund|refunded|deposit|deposited|inward\s*transfer|incoming\s*transfer|transferred\s*to\s*your|cashback\s*credited|reversal|reversed)\b/i;

export function detectBankName(sender = '', body = '') {
  const combined = `${sender} ${body}`;
  for (const matcher of BANK_MATCHERS) {
    if (matcher.pattern.test(combined)) {
      return matcher.name;
    }
  }
  const cleanSender = String(sender || '').trim();
  return cleanSender || 'Bank Alert';
}

export function isIgnoredSms(sender = '', body = '') {
  const text = `${sender} ${body}`.trim();
  if (!text) return true;
  if (OTP_OR_SECURITY_RE.test(text)) return true;

  // Reject promo alerts if they do not explicitly indicate an executed debit/credit
  if (STRONG_PROMO_RE.test(text) && !/\b(debited|credited|purchased|withdrawn|spent|pos\b)\b/i.test(text)) {
    return true;
  }
  return false;
}

export function extractAmountAndCurrency(body = '') {
  const text = String(body || '');
  // Patterns supporting "AED 1,250.50", "1,250.50 AED", "EGP 450", "LE 320.00", "DHS 85.5"
  const patterns = [
    /\b(AED|DHS?|EGP|L\.?E\.?)\s*[:.]?\s*([\d,]+(?:\.\d{1,2})?)/i,
    /([\d,]+(?:\.\d{1,2})?)\s*(AED|DHS?|EGP|L\.?E\.?)\b/i
  ];

  for (const re of patterns) {
    const match = text.match(re);
    if (match) {
      const rawCur = (match[1].match(/[A-Za-z]/) ? match[1] : match[2]).toUpperCase();
      const rawNum = (match[1].match(/[A-Za-z]/) ? match[2] : match[1]).replace(/,/g, '');
      const amount = round2(parseFloat(rawNum));
      if (!Number.isFinite(amount) || amount <= 0) continue;

      const currency =
        rawCur.startsWith('EGP') || rawCur.startsWith('L') ? 'EGP' : 'AED';
      return { amount, currency };
    }
  }
  return null;
}

export function extractLast4Digits(body = '') {
  const text = String(body || '');
  const patterns = [
    /\bcard\s*(?:no\.?|number)?\s*(?:ending\s*(?:with|in)?\s*)?[*xX#•-]*(\d{4})\b/i,
    /\bending\s*(?:with|in)?\s*[*xX#•-]*(\d{4})\b/i,
    /\b(?:visa|mastercard|mc|debit|credit)\s*[*xX#•-]+(\d{4})\b/i,
    /(?:XX+|xx+|\*{2,}|••)\s*(\d{4})\b/,
    /\b(?:a\/c|acct|account)\s*(?:no\.?)?\s*(?:ending\s*(?:with|in)?\s*)?[*xX#•-]*(\d{4})\b/i
  ];

  for (const re of patterns) {
    const match = text.match(re);
    if (match && match[1]) {
      return match[1];
    }
  }
  return '';
}

export function matchAccountByLast4(last4, currency, accounts = []) {
  if (!last4 || !Array.isArray(accounts) || accounts.length === 0) return null;
  const cleanLast4 = String(last4).trim();
  if (!cleanLast4) return null;

  // Prefer strict match on both last4 and currency
  const exact = accounts.find(
    (acc) => String(acc.last4 || '').trim() === cleanLast4 && acc.currency === currency
  );
  if (exact) return exact;

  // Fallback only if exactly one account shares those last4 digits
  const byDigits = accounts.filter((acc) => String(acc.last4 || '').trim() === cleanLast4);
  if (byDigits.length === 1) return byDigits[0];

  return null;
}

export function extractMerchant(body = '', bankName = 'Bank Alert', type = 'expense') {
  const text = String(body || '');
  // Clean out balance suffixes first so "at Carrefour. Avl Bal AED 5,000" stops at Carrefour
  const preCleaned = text
    .replace(/\b(?:avl|available|curr(?:ent)?|rem(?:aining)?)\s*(?:bal(?:ance)?|limit)\b[\s\S]*/i, '')
    .replace(/\bref(?:erence)?\s*(?:no\.?|#)?\s*[:#]?\s*[A-Z0-9-]+/gi, '');

  const merchantPatterns = [
    /\b(?:at|@)\s+([A-Za-z0-9&'.,\-/\s]{2,42}?)(?=\s+(?:on|dated|for|AED|EGP|via|using|card|with|\d{2}[/-]\d{2})|[.\n,;]|$)/i,
    /\b(?:merchant|to|from)\s*[:-]?\s*([A-Za-z0-9&'.,\-\s]{2,38}?)(?=\s+(?:on|AED|EGP|via|card|\d{2}[/-]\d{2})|[.\n,;]|$)/i
  ];

  for (const re of merchantPatterns) {
    const m = preCleaned.match(re);
    if (m && m[1]) {
      const candidate = m[1].replace(/^[:\-\s]+|[:\-\s.]+$/g, '').trim();
      if (
        candidate.length >= 2 &&
        !/^(your|card|account|a\/c|ending|aed|egp|bank)$/i.test(candidate)
      ) {
        return candidate;
      }
    }
  }

  if (/\bsalary\b/i.test(text)) return `${bankName} Salary Credit`;
  if (/\brefund\b/i.test(text)) return `${bankName} Refund`;
  if (/\batm\b|\bwithdrawn\b/i.test(text)) return `${bankName} Cash Withdrawal`;
  return type === 'income' ? `${bankName} Credit` : `${bankName} Card Purchase`;
}

export function normalizeSmsTimestamp(timestamp, body = '') {
  // Try supplied timestamp first
  if (timestamp) {
    const num = Number(timestamp);
    const dt =
      Number.isFinite(num) && String(timestamp).trim().length >= 10
        ? new Date(num)
        : new Date(timestamp);
    if (!Number.isNaN(dt.getTime())) {
      const date = `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
      const time = `${pad2(dt.getHours())}:${pad2(dt.getMinutes())}`;
      return {
        isoTimestamp: dt.toISOString(),
        date,
        dateTimeLabel: `${date} ${time}`
      };
    }
  }

  // Try extracting YYYY-MM-DD or DD/MM/YYYY or DD-MMM-YY from SMS body
  const isoMatch = String(body || '').match(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/);
  if (isoMatch) {
    const date = `${isoMatch[1]}-${pad2(Number(isoMatch[2]))}-${pad2(Number(isoMatch[3]))}`;
    return { isoTimestamp: `${date}T12:00:00`, date, dateTimeLabel: date };
  }

  const dmyMatch = String(body || '').match(/\b(\d{1,2})[/-](\d{1,2})[/-](20\d{2}|\d{2})\b/);
  if (dmyMatch) {
    const d = Number(dmyMatch[1]);
    const m = Number(dmyMatch[2]);
    let y = Number(dmyMatch[3]);
    if (y < 100) y += 2000;
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      const date = `${y}-${pad2(m)}-${pad2(d)}`;
      return { isoTimestamp: `${date}T12:00:00`, date, dateTimeLabel: date };
    }
  }

  const now = new Date();
  const date = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
  const time = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
  return {
    isoTimestamp: now.toISOString(),
    date,
    dateTimeLabel: `${date} ${time}`
  };
}

/**
 * Deterministic deduplication signature of (sender + amount + timestamp).
 */
export function computeSmsSignature(sender = '', amount = 0, timestamp = '') {
  const normSender = String(sender || 'bank')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
  const normAmount = round2(amount || 0).toFixed(2);
  const normTs = String(timestamp || '').trim().toLowerCase();
  const raw = `${normSender}|${normAmount}|${normTs}`;

  // Simple fast FNV-1a 32-bit hash + readable key
  let hash = 2166136261;
  for (let i = 0; i < raw.length; i++) {
    hash ^= raw.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `sms_${(hash >>> 0).toString(36)}_${normAmount}`;
}

/**
 * Parses a single bank SMS into a structured pending record, or returns null if ignored / non-transaction.
 */
export function parseBankSms(sender, body, timestamp = '') {
  const rawBody = String(body || '').trim();
  const rawSender = String(sender || '').trim();
  if (!rawBody) return null;
  if (isIgnoredSms(rawSender, rawBody)) return null;

  const amountInfo = extractAmountAndCurrency(rawBody);
  if (!amountInfo) return null;

  const isExpenseHit = EXPENSE_RE.test(rawBody);
  const isIncomeHit = INCOME_RE.test(rawBody);

  // Require at least a clear transaction keyword if neither expense nor income matched
  if (!isExpenseHit && !isIncomeHit) {
    return null;
  }

  // Note: "credited" / "received" wins for income unless it's clearly a card purchase message mentioning credit card
  let type = 'expense';
  if (isIncomeHit && !/\b(purchase|purchased|debited|spent|withdrawn|pos\b|online\s*txn)\b/i.test(rawBody)) {
    type = 'income';
  }

  const bankName = detectBankName(rawSender, rawBody);
  const detectedLast4 = extractLast4Digits(rawBody);
  const description = extractMerchant(rawBody, bankName, type);
  const timeInfo = normalizeSmsTimestamp(timestamp, rawBody);
  const signature = computeSmsSignature(
    rawSender || bankName,
    amountInfo.amount,
    timestamp || timeInfo.date
  );

  return {
    signature,
    sender: rawSender || bankName,
    bankName,
    rawBody,
    timestamp: timestamp || timeInfo.isoTimestamp,
    date: timeInfo.date,
    dateTimeLabel: timeInfo.dateTimeLabel,
    amount: amountInfo.amount,
    currency: amountInfo.currency,
    type,
    description,
    detectedLast4
  };
}

/**
 * Splits a multi-SMS pasted block into individual { sender, body, timestamp } entries.
 */
export function splitRawSmsInput(rawText = '') {
  const text = String(rawText || '').trim();
  if (!text) return [];

  const blocks = text
    .split(/\n\s*\n+|\n?-{3,}\n?/)
    .map((b) => b.trim())
    .filter(Boolean);

  const entries = [];
  const standaloneLineRe =
    /\b(otp|verification\s*code|aed|egp|purchase|purchased|debited|credited|spent|withdrawn|payment|received|salary|refund)\b/i;

  blocks.forEach((block) => {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return;

    if (lines.length > 1 && /^(from|sender)\s*:/i.test(lines[0])) {
      entries.push({
        sender: lines[0].replace(/^(from|sender)\s*:/i, '').trim(),
        body: lines.slice(1).join(' '),
        timestamp: ''
      });
      return;
    }

    if (lines.length > 1 && lines[0].length <= 24 && !/\d{2,}/.test(lines[0]) && !standaloneLineRe.test(lines[0])) {
      entries.push({
        sender: lines[0],
        body: lines.slice(1).join(' '),
        timestamp: ''
      });
      return;
    }

    const standaloneMatches = lines.filter((line) => standaloneLineRe.test(line));
    if (lines.length > 1 && standaloneMatches.length >= 2) {
      lines.forEach((line) => {
        entries.push({ sender: '', body: line, timestamp: '' });
      });
      return;
    }

    entries.push({
      sender: '',
      body: lines.join(' '),
      timestamp: ''
    });
  });

  return entries;
}

/**
 * Converts parsed SMS records into Pending Transaction objects with matched Account/Card
 * (leaving accountId blank if unmatched) and pre-applied Default Sharing rules.
 */
export function buildPendingFromParsedSms({
  parsedSmsList = [],
  accounts = [],
  categories = [],
  defaultSharing,
  people = [],
  existingPending = [],
  knownSignatures = []
}) {
  const activePeople = (people || []).filter((p) => !p.archived);
  const seenSignatures = new Set([
    ...(existingPending || []).map((p) => p.signature).filter(Boolean),
    ...(knownSignatures || []).filter(Boolean)
  ]);

  const defaultExpenseCat =
    categories.find((c) => c.type === 'expense' && c.id === 'cat_other')?.id ||
    categories.find((c) => c.type === 'expense')?.id ||
    '';
  const defaultIncomeCat =
    categories.find((c) => c.type === 'income' && c.id === 'cat_transfer')?.id ||
    categories.find((c) => c.type === 'income')?.id ||
    '';

  const created = [];
  let duplicateCount = 0;
  let ignoredCount = 0;

  parsedSmsList.forEach((rawOrParsed) => {
    const parsed = rawOrParsed?.signature
      ? rawOrParsed
      : parseBankSms(rawOrParsed?.sender, rawOrParsed?.body, rawOrParsed?.timestamp);

    if (!parsed) {
      ignoredCount += 1;
      return;
    }
    if (seenSignatures.has(parsed.signature)) {
      duplicateCount += 1;
      return;
    }
    seenSignatures.add(parsed.signature);

    // Heuristic category guess
    let categoryId = parsed.type === 'income' ? defaultIncomeCat : defaultExpenseCat;
    const descLower = `${parsed.description} ${parsed.rawBody}`.toLowerCase();
    if (parsed.type === 'income') {
      if (/\bsalary|payroll\b/.test(descLower)) {
        categoryId = categories.find((c) => c.id === 'cat_salary')?.id || defaultIncomeCat;
      } else if (/\brefund|reversal\b/.test(descLower)) {
        categoryId = categories.find((c) => c.id === 'cat_refund')?.id || defaultIncomeCat;
      }
    } else {
      if (/carrefour|lulu|spinneys|waitrose|grocery|supermarket|hypermarket|union coop/.test(descLower)) {
        categoryId = categories.find((c) => c.id === 'cat_groceries')?.id || defaultExpenseCat;
      } else if (/starbucks|cafe|coffee|restaurant|mcdonald|kfc|talabat|deliveroo|careem food|zomato|zamalek|dining/.test(descLower)) {
        categoryId = categories.find((c) => c.id === 'cat_restaurants')?.id || defaultExpenseCat;
      } else if (/uber|careem|rta|salik|enoc|adnoc|eppco|fuel|petrol|metro|taxi/.test(descLower)) {
        categoryId = categories.find((c) => c.id === 'cat_transport')?.id || defaultExpenseCat;
      } else if (/dewa|etisalat|du\b|vodafone|orange|telecom|electricity|utility|bill/.test(descLower)) {
        categoryId = categories.find((c) => c.id === 'cat_bills')?.id || defaultExpenseCat;
      } else if (/amazon|noon|ikea|mall|zara|h&m|apple store/.test(descLower)) {
        categoryId = categories.find((c) => c.id === 'cat_shopping')?.id || defaultExpenseCat;
      }
    }

    // Match last-4 digits to saved account, else strictly leave blank ('') per user preference
    const matchedAccount = matchAccountByLast4(parsed.detectedLast4, parsed.currency, accounts);
    const accountId = matchedAccount ? matchedAccount.id : '';

    // Pre-apply Global/Category sharing defaults
    const sharing =
      parsed.type === 'expense'
        ? resolveSharingDefaults(defaultSharing, categoryId, activePeople)
        : { isShared: false, paidBy: 'me', splitMode: 'equal', participantIds: ['me'] };

    created.push({
      id: `pend_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      ...parsed,
      accountId,
      matchedAccountName: matchedAccount ? matchedAccount.name : '',
      categoryId,
      isShared: sharing.isShared,
      paidBy: sharing.paidBy,
      belongsTo: sharing.isShared ? 'shared' : 'me',
      splitMode: sharing.splitMode,
      participantIds: sharing.participantIds,
      shares: {},
      isDemo: false
    });
  });

  return {
    items: created,
    duplicateCount,
    ignoredCount
  };
}

export const SAMPLE_BANK_SMS_TEMPLATES = [
  {
    label: 'Emirates NBD (AED ••1234)',
    sender: 'EmiratesNBD',
    body: 'Purchase of AED 185.50 at CARREFOUR MALL OF EMIRATES using Debit Card ending 1234 on 18/11/2026. Avl Bal AED 4,210.50.'
  },
  {
    label: 'Wio Bank (AED ••5678)',
    sender: 'Wio',
    body: 'AED 42.00 spent at STARBUCKS DUBAI MARINA via Wio Card XX5678 on 18-11-2026.'
  },
  {
    label: 'CIB Egypt (EGP ••8890)',
    sender: 'CIB',
    body: 'Your CIB credit card *8890 was charged EGP 1,250.00 at TALABAT EGYPT on 18/11/2026.'
  },
  {
    label: 'NBE Credit Alert (No Digits)',
    sender: 'NBE',
    body: 'Inward transfer credited with EGP 5,000.00 from Ahmed Hassan via InstaPay on 18/11/2026.'
  },
  {
    label: 'OTP Ignored Test',
    sender: 'ADCB',
    body: 'Your OTP is 849201 for an online purchase of AED 950.00. Do not share this verification code with anyone.'
  }
];
