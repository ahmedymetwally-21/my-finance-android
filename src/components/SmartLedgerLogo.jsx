import React, { useEffect, useState } from 'react';
import { Download, Image as ImageIcon, Sparkles } from 'lucide-react';
import {
  renderIconPngBlob,
  renderSplashPngBlob,
  triggerBlobDownload
} from '../utils/logoAssetGenerator.js';

export function SmartLedgerLogo({ size = 36, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="slSlateGrad" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0f172a" />
          <stop offset="100%" stopColor="#1e293b" />
        </linearGradient>
        <linearGradient id="slEmeraldGrad" x1="20" y1="18" x2="80" y2="50" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>
      </defs>

      <rect x="1.5" y="1.5" width="97" height="97" rx="24" fill="url(#slSlateGrad)" stroke="#10b981" strokeOpacity="0.4" strokeWidth="3" />
      <rect x="20" y="18" width="60" height="32" rx="9" fill="url(#slEmeraldGrad)" />
      <rect x="16" y="33" width="68" height="48" rx="12" fill="#f8fafc" />
      <line x1="26" y1="48" x2="52" y2="48" stroke="#cbd5e1" strokeWidth="4" strokeLinecap="round" />
      <line x1="26" y1="59" x2="45" y2="59" stroke="#10b981" strokeWidth="4" strokeLinecap="round" />
      <rect x="56" y="47" width="28" height="20" rx="10" fill="#059669" />
      <circle cx="66" cy="57" r="4.2" fill="#ecfdf5" />
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
      className={`fixed inset-0 z-50 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 flex flex-col items-center justify-center p-6 transition-opacity duration-300 ${
        fading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      <div className="relative flex flex-col items-center text-center">
        <div className="absolute -inset-8 rounded-full bg-emerald-500/20 blur-2xl pointer-events-none" />
        <SmartLedgerLogo size={92} className="relative drop-shadow-2xl" />
        <h1 className="relative mt-5 text-2xl font-extrabold tracking-tight text-white">
          SmartLedger
        </h1>
        <p className="relative mt-1.5 text-xs font-bold uppercase tracking-widest text-emerald-300">
          AED · EGP Dual-Currency Ledger
        </p>
        <div className="relative mt-6 w-28 h-1 rounded-full bg-slate-800 overflow-hidden">
          <div className="h-full bg-emerald-400 rounded-full animate-pulse w-2/3" />
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
      showToast('Downloaded 1024×1024 PNG icon.png for Capacitor assets/');
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
      showToast('Downloaded 2732×2732 PNG splash.png for Capacitor assets/');
    } catch {
      showToast('Failed to generate splash PNG', 'error');
    } finally {
      setDownloading('');
    }
  };

  return (
    <div className="space-y-4">
      {/* Startup Splash Toggle */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-2xs flex items-center justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div className="p-2.5 rounded-2xl bg-emerald-50 text-emerald-700 shrink-0">
            <Sparkles size={18} />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">In-App Launch Splash Screen</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Show the 1.2s SmartLedger branded launch transition when opening the app
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
            showLaunchSplash ? 'bg-emerald-600' : 'bg-slate-300'
          }`}
        >
          <div
            className={`w-5 h-5 rounded-full bg-white shadow-xs transition-transform ${
              showLaunchSplash ? 'translate-x-6' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {/* App Icon & Splash Generator Card */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-2xs space-y-4">
        <div className="flex items-start gap-2.5">
          <div className="p-2.5 rounded-2xl bg-slate-900 text-emerald-400 shrink-0">
            <ImageIcon size={18} />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-900">
              App Icon &amp; Splash Generator
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Live preview &amp; 1-tap Canvas PNG exports sized for Capacitor&apos;s{' '}
              <code className="text-[11px] bg-slate-100 px-1 py-0.5 rounded font-mono">
                assets/
              </code>{' '}
              folder
            </p>
          </div>
        </div>

        {/* Live Previews */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col items-center text-center gap-2.5">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
              App Icon Preview (1024×1024)
            </span>
            <div className="p-2 rounded-3xl bg-slate-900 shadow-md">
              <SmartLedgerLogo size={76} />
            </div>
            <button
              type="button"
              onClick={handleDownloadIcon}
              disabled={downloading === 'icon'}
              className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 touch-manipulation active:scale-[0.98]"
            >
              <Download size={15} />
              <span>{downloading === 'icon' ? 'Rendering...' : 'Download icon.png'}</span>
            </button>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col items-center text-center gap-2.5">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
              Splash Preview (2732×2732)
            </span>
            <div className="w-[92px] h-[92px] rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 flex flex-col items-center justify-center p-2 shadow-md border border-emerald-500/20">
              <SmartLedgerLogo size={38} />
              <span className="text-[9px] font-extrabold text-white mt-1.5 leading-none">
                SmartLedger
              </span>
              <span className="text-[6px] font-bold text-emerald-300 mt-0.5">AED · EGP</span>
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
