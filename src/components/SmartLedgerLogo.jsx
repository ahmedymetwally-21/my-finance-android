import React, { useEffect, useId, useState } from 'react';
import { Download, Image as ImageIcon, ShieldCheck, Sparkles } from 'lucide-react';
import {
  renderIconPngBlob,
  renderSplashPngBlob,
  triggerBlobDownload
} from '../utils/logoAssetGenerator.js';

/**
 * Full-bleed #090d16 executive dark-mode SmartLedger logo featuring a minimalist
 * emerald-and-gold geometric wallet / upward ledger emblem centered within the inner 62% safe zone.
 */
export function SmartLedgerLogo({ size = 36, className = '', rounded = true }) {
  const uid = useId().replace(/:/g, '');
  const auraId = `slAura_${uid}`;
  const goldCardId = `slGoldCard_${uid}`;
  const walletFillId = `slWalletFill_${uid}`;
  const walletStrokeId = `slWalletStroke_${uid}`;
  const arrowGradId = `slArrow_${uid}`;
  const claspGradId = `slClasp_${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${rounded ? 'rounded-[22%]' : ''} overflow-hidden ${className}`.trim()}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={auraId} cx="50" cy="48" r="38" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#090d16" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={goldCardId} x1="31" y1="25.5" x2="69" y2="36" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="55%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#b45309" />
        </linearGradient>
        <linearGradient id={walletFillId} x1="24" y1="35" x2="76" y2="74" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0f3a31" />
          <stop offset="55%" stopColor="#0a2026" />
          <stop offset="100%" stopColor="#091521" />
        </linearGradient>
        <linearGradient id={walletStrokeId} x1="24" y1="35" x2="76" y2="74" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="50%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#047857" />
        </linearGradient>
        <linearGradient id={arrowGradId} x1="31" y1="53.5" x2="55" y2="40.5" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#fde68a" />
        </linearGradient>
        <linearGradient id={claspGradId} x1="59.3" y1="48.5" x2="76.6" y2="61.5" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>
      </defs>

      {/* 100% full-bleed #090d16 canvas (zero white borders or light framing) */}
      <rect x="0" y="0" width="100" height="100" fill="#090d16" />
      <circle cx="50" cy="48" r="38" fill={`url(#${auraId})`} />

      {/* Executive Champagne Gold Top Ledger Card */}
      <path
        d="M31 36V31C31 27.96 33.46 25.5 36.5 25.5H63.5C66.54 25.5 69 27.96 69 31V36H31Z"
        fill={`url(#${goldCardId})`}
      />
      <rect x="30" y="33.2" width="40" height="2.4" fill="#090d16" />

      {/* Geometric Wallet Chassis (strictly inside 62% safe zone) */}
      <rect
        x="24"
        y="35"
        width="52"
        height="39"
        rx="8"
        fill={`url(#${walletFillId})`}
        stroke={`url(#${walletStrokeId})`}
        strokeWidth="2.6"
      />

      {/* Ascending Emerald Ledger Pillars */}
      <path d="M32.6 60H34C34.88 60 35.6 60.72 35.6 61.6V67.5H31V61.6C31 60.72 31.72 60 32.6 60Z" fill="#059669" />
      <path d="M40.1 55H41.5C42.38 55 43.1 55.72 43.1 56.6V67.5H38.5V56.6C38.5 55.72 39.22 55 40.1 55Z" fill="#10b981" />
      <path d="M47.6 49.5H49C49.88 49.5 50.6 50.22 50.6 51.1V67.5H46V51.1C46 50.22 46.72 49.5 47.6 49.5Z" fill="#34d399" />

      {/* Gold Upward Ledger Trajectory & Chevron Arrowhead */}
      <path
        d="M31.2 53.5L39.4 47.2L44.4 50.4L54.6 40.8"
        stroke={`url(#${arrowGradId})`}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M49 40.6H55V46.6"
        stroke="#fde68a"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Minimalist Emerald Clasp Pill + Gold Fastener Stud */}
      <path
        d="M65.8 48.5H76.6V61.5H65.8C62.21 61.5 59.3 58.59 59.3 55C59.3 51.41 62.21 48.5 65.8 48.5Z"
        fill={`url(#${claspGradId})`}
      />
      <circle cx="66.2" cy="55" r="3.1" fill="#fde68a" />
    </svg>
  );
}

export function LaunchSplashScreen({ enabled, onComplete }) {
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (!enabled) return undefined;
    const fadeTimer = setTimeout(() => setFading(true), 950);
    const doneTimer = setTimeout(() => {
      if (onComplete) onComplete();
    }, 1250);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, [enabled, onComplete]);

  if (!enabled) return null;

  return (
    <div
      data-testid="launch-splash"
      className={`fixed inset-0 z-50 bg-[#090d16] flex flex-col items-center justify-center p-6 transition-opacity duration-300 ${
        fading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      <div className="relative flex flex-col items-center text-center">
        <div className="absolute -inset-10 rounded-full bg-emerald-500/15 blur-3xl pointer-events-none" />
        <SmartLedgerLogo size={108} className="relative drop-shadow-2xl ring-1 ring-emerald-500/20" />
        <h1 className="relative mt-5 text-2xl font-extrabold tracking-tight text-white">
          SmartLedger
        </h1>
        <p className="relative mt-1.5 text-[11px] font-bold uppercase tracking-widest text-amber-300">
          AED · EGP Executive Finance Ledger
        </p>
        <div className="relative mt-6 w-28 h-1 rounded-full bg-slate-800 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-emerald-400 to-amber-300 rounded-full animate-pulse w-2/3" />
        </div>
      </div>
    </div>
  );
}

export function AppAssetGeneratorCard({
  showLaunchSplash,
  onToggleLaunchSplash,
  showToast
}) {
  const [downloading, setDownloading] = useState('');

  const handleDownloadIcon = async () => {
    setDownloading('icon');
    try {
      const blob = await renderIconPngBlob(1024);
      triggerBlobDownload(blob, 'icon.png');
      showToast('Downloaded full-bleed #090d16 1024×1024 icon.png (zero white background)');
    } catch {
      showToast('Failed to generate icon PNG', 'error');
    } finally {
      setDownloading('');
    }
  };

  const handleDownloadSplash = async () => {
    setDownloading('splash');
    try {
      const blob = await renderSplashPngBlob(2732);
      triggerBlobDownload(blob, 'splash.png');
      showToast('Downloaded full-bleed #090d16 2732×2732 splash.png for Capacitor assets/');
    } catch {
      showToast('Failed to generate splash PNG', 'error');
    } finally {
      setDownloading('');
    }
  };

  return (
    <div className="space-y-4">
      {/* Startup Splash Toggle */}
      <div className="bg-white dark:bg-[#0f172a] p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-2xs flex items-center justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div className="p-2.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 shrink-0">
            <Sparkles size={18} />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
              In-App Launch Splash Screen
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Show the 1.2s executive #090d16 SmartLedger launch transition when opening the app
            </p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={showLaunchSplash}
          aria-label="Toggle launch splash screen"
          onClick={() => onToggleLaunchSplash(!showLaunchSplash)}
          className={`w-13 h-7 rounded-full p-1 transition-colors shrink-0 touch-manipulation ${
            showLaunchSplash ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'
          }`}
        >
          <div
            className={`w-5 h-5 rounded-full bg-white shadow-xs transition-transform ${
              showLaunchSplash ? 'translate-x-6' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {/* App Appearance & Full-Bleed Icon / Splash Exporter */}
      <div className="bg-white dark:bg-[#0f172a] p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-4">
        <div className="flex items-start gap-2.5">
          <div className="p-2.5 rounded-2xl bg-[#090d16] text-emerald-400 border border-slate-800 shrink-0">
            <ImageIcon size={18} />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
              App Icon &amp; Splash Exporter
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              100% full-bleed{' '}
              <code className="text-[11px] bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded font-mono text-slate-800 dark:text-slate-200">
                #090d16
              </code>{' '}
              dark-slate assets centered in the inner 62% Android adaptive safe zone — zero white background.
            </p>
          </div>
        </div>

        {/* Android Adaptive Mask Previews */}
        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 space-y-2.5">
          <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-slate-700 dark:text-slate-300">
            <ShieldCheck size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Android Launcher Mask Safe-Zone Check (62% Inner Zone)</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="flex flex-col items-center gap-1.5">
              <SmartLedgerLogo size={64} rounded={false} className="shadow-md" />
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                Full-Bleed 1024px
              </span>
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <SmartLedgerLogo size={64} rounded={false} className="rounded-[26%] shadow-md" />
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                Samsung Squircle
              </span>
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <SmartLedgerLogo size={64} rounded={false} className="rounded-full shadow-md" />
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                Android Circle
              </span>
            </div>
          </div>
        </div>

        {/* Live Previews & Export Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 flex flex-col items-center text-center gap-2.5">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Full-Bleed App Icon (1024×1024)
            </span>
            <SmartLedgerLogo size={88} rounded={false} className="shadow-md" />
            <button
              type="button"
              onClick={handleDownloadIcon}
              disabled={downloading === 'icon'}
              className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-[#090d16] dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 touch-manipulation active:scale-[0.98]"
            >
              <Download size={15} />
              <span>{downloading === 'icon' ? 'Rendering...' : 'Download icon.png'}</span>
            </button>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 flex flex-col items-center text-center gap-2.5">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Dark Splash Screen (2732×2732)
            </span>
            <div className="w-[88px] h-[88px] rounded-2xl bg-[#090d16] flex flex-col items-center justify-center p-2 shadow-md border border-emerald-500/20">
              <SmartLedgerLogo size={42} rounded={false} />
              <span className="text-[9px] font-extrabold text-white mt-1 leading-none">
                SmartLedger
              </span>
              <span className="text-[6px] font-bold text-amber-300 mt-0.5">SmartLedger</span>
            </div>
            <button
              type="button"
              onClick={handleDownloadSplash}
              disabled={downloading === 'splash'}
              className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 touch-manipulation active:scale-[0.98]"
            >
              <Download size={15} />
              <span>{downloading === 'splash' ? 'Rendering...' : 'Download splash.png'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
