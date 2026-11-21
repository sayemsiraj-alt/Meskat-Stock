import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  MonitorSmartphone,
  RefreshCw,
  Share,
  Smartphone,
  WifiOff,
  X,
} from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { usePWAInstall } from '../hooks/usePWAInstall';
import {
  buildCompanyPwaBranding,
  generateCompanyPwaIcons,
  syncDynamicPwaBranding,
} from '../utils/pwaManifestSync';
import { CompanyLogo } from './CompanyLogo';

const checkIsIframe = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 z-[95] bg-amber-950 text-amber-100 border border-amber-500/60 rounded-2xl shadow-2xl px-4 py-3 flex items-center gap-3 max-w-sm"
    >
      <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0">
        <WifiOff className="w-4 h-4" />
      </div>
      <div className="text-xs min-w-0">
        <p className="font-extrabold text-amber-200">অফলাইন মোড চালু (Offline Mode)</p>
        <p className="text-[11px] text-amber-300/90 leading-snug">
          কাজ চালিয়ে যান — ইন্টারনেট ফিরলে সব ডেটা স্বয়ংক্রিয়ভাবে সিঙ্ক হবে।
        </p>
      </div>
    </div>
  );
};

export const PWAUpdateBanner: React.FC = () => {
  const [status, setStatus] = useState<'idle' | 'updating' | 'offline-ready'>('idle');

  useEffect(() => {
    const onUpdating = () => setStatus('updating');
    const onOfflineReady = () => {
      setStatus((prev) => (prev === 'updating' ? prev : 'offline-ready'));
      window.setTimeout(() => {
        setStatus((prev) => (prev === 'offline-ready' ? 'idle' : prev));
      }, 4500);
    };

    window.addEventListener('erp:pwa-updating', onUpdating);
    window.addEventListener('erp:pwa-offline-ready', onOfflineReady);
    return () => {
      window.removeEventListener('erp:pwa-updating', onUpdating);
      window.removeEventListener('erp:pwa-offline-ready', onOfflineReady);
    };
  }, []);

  if (status === 'idle') return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-4 left-4 right-4 sm:right-auto z-[95] rounded-2xl shadow-2xl px-4 py-3 flex items-center gap-3 border max-w-sm ${
        status === 'updating'
          ? 'bg-slate-950 text-white border-emerald-500/60'
          : 'bg-emerald-950 text-emerald-50 border-emerald-400/50'
      }`}
    >
      {status === 'updating' ? (
        <RefreshCw className="w-4 h-4 text-emerald-400 animate-spin shrink-0" />
      ) : (
        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
      )}
      <div className="text-xs flex-1 min-w-0">
        <p className="font-extrabold">
          {status === 'updating'
            ? 'নতুন আপডেট পাওয়া গেছে — অটো ইনস্টল হচ্ছে...'
            : 'অফলাইন ব্যবহারের জন্য অ্যাপ প্রস্তুত!'}
        </p>
        <p className="text-[11px] opacity-80">
          {status === 'updating'
            ? 'নতুন ফিচার চালু করতে অ্যাপ স্বয়ংক্রিয়ভাবে রিফ্রেশ হবে।'
            : 'নেট ছাড়াও ড্যাশবোর্ড ও আগের ডেটা দেখতে পারবেন।'}
        </p>
      </div>
      {status === 'offline-ready' && (
        <button
          type="button"
          onClick={() => setStatus('idle')}
          className="p-1 text-emerald-300 hover:text-white cursor-pointer"
          aria-label="Dismiss offline ready notice"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

interface PWAInstallButtonProps {
  variant?: 'compact' | 'card' | 'dark-pill';
  brandName?: string;
  brandShortName?: string;
  storeName?: string;
  logoUrl?: string;
  activeTheme?: string;
  firebaseProjectId?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'compact',
  brandName,
  brandShortName,
  storeName,
  logoUrl,
  activeTheme,
  firebaseProjectId,
}) => {
  const { isInstallable, isInstalled, isIOS, isAndroid, isInAppBrowser, promptInstall } =
    usePWAInstall();
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [refreshingBrand, setRefreshingBrand] = useState(false);
  const [updateMsg, setUpdateMsg] = useState('');
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [previewIconUrl, setPreviewIconUrl] = useState<string>('');

  const inIframe = checkIsIframe();

  const branding = useMemo(
    () =>
      buildCompanyPwaBranding({
        brandName: brandName || '',
        brandShortName: brandShortName || '',
        storeName: storeName || '',
        logoUrl: logoUrl || '',
        activeTheme: activeTheme as any,
      }),
    [brandName, brandShortName, storeName, logoUrl, activeTheme]
  );

  useEffect(() => {
    let active = true;
    generateCompanyPwaIcons(branding)
      .then((icons) => {
        if (active && icons.icon192Url) {
          setPreviewIconUrl(icons.icon192Url);
        }
      })
      .catch(() => {
        // ignore preview failure
      });
    return () => {
      active = false;
    };
  }, [branding]);

  const handleInstallClick = async () => {
    if (isInstallable) {
      const outcome = await promptInstall();
      if (outcome !== 'unavailable') return;
    }
    setShowInstallModal(true);
  };

  const handleCopyUrl = () => {
    if (typeof window === 'undefined') return;
    navigator.clipboard?.writeText(window.location.href);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleApplyBrandingAndReload = async () => {
    setRefreshingBrand(true);
    try {
      await syncDynamicPwaBranding({
        brandName: brandName || '',
        brandShortName: brandShortName || '',
        storeName: storeName || '',
        logoUrl: logoUrl || '',
        activeTheme: activeTheme as any,
        firebaseProjectId,
      });
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    } finally {
      setRefreshingBrand(false);
    }
  };

  const handleManualUpdateCheck = async () => {
    setCheckingUpdate(true);
    setUpdateMsg('');
    try {
      if (window.__erpCheckForPwaUpdate) {
        const applied = await window.__erpCheckForPwaUpdate();
        setUpdateMsg(
          applied
            ? 'নতুন ভার্সন পাওয়া গেছে — আপডেট হচ্ছে...'
            : 'আপনার অ্যাপটি সর্বশেষ ভার্সনে আপডেট আছে।'
        );
      } else {
        setUpdateMsg('সার্ভিস ওয়ার্কার সক্রিয় রয়েছে (লাইভ প্রোডাকশন সাইটে অটো-আপডেট চলে)।');
      }
    } finally {
      setCheckingUpdate(false);
    }
  };

  const androidChromeIntentHref = useMemo(() => {
    if (typeof window === 'undefined') return '#';
    const { host, pathname, search, protocol } = window.location;
    if (protocol !== 'https:' && protocol !== 'http:') return window.location.href;
    const scheme = protocol.replace(':', '');
    return `intent://${host}${pathname}${search}#Intent;scheme=${scheme};package=com.android.chrome;end`;
  }, []);

  const renderAppBadgePreview = (darkBg = false) => (
    <div
      className={`flex items-center gap-3 p-3 rounded-xl border ${
        darkBg
          ? 'bg-slate-950/70 border-white/15 text-white'
          : 'bg-slate-900 text-white border-slate-800'
      }`}
    >
      <div className="w-12 h-12 rounded-2xl bg-white shadow-md overflow-hidden flex items-center justify-center shrink-0 border border-white/20">
        {previewIconUrl ? (
          <img
            src={previewIconUrl}
            alt={`${branding.shortName} App Icon`}
            className="w-full h-full object-contain"
          />
        ) : (
          <CompanyLogo
            className="w-11 h-11 border-0"
            shortName={branding.shortName}
            logoUrl={branding.logoUrl}
          />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-wider font-bold text-emerald-300">
          App Icon &amp; Launcher Name Preview
        </p>
        <p className="text-sm font-extrabold text-white truncate">
          {branding.shortName}
        </p>
        <p className="text-[11px] text-slate-300 truncate">{branding.appName}</p>
      </div>
    </div>
  );

  const installModal = showInstallModal ? (
    <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-[99]">
      <div className="bg-white text-slate-900 rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full max-h-[90dvh] overflow-y-auto p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 font-extrabold text-sm text-slate-900 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <MonitorSmartphone className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate">Download / Install {branding.shortName}</p>
              <p className="text-[11px] font-medium text-slate-500 truncate">
                Android Phone, Windows/Mac PC &amp; iPhone
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowInstallModal(false)}
            aria-label="Close Install Guide"
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {renderAppBadgePreview(false)}

        {isInstallable && (
          <button
            type="button"
            onClick={async () => {
              const res = await promptInstall();
              if (res !== 'unavailable') {
                setShowInstallModal(false);
              }
            }}
            className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-sm flex items-center justify-center gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Install {branding.shortName} Now (1-Tap)</span>
          </button>
        )}

        {(inIframe || isInAppBrowser) && (
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-950 space-y-2">
            <p className="font-extrabold">
              {isInAppBrowser
                ? 'ইন-অ্যাপ ব্রাউজার (WhatsApp/Facebook/Messenger) থেকে অ্যাপ ইনস্টল হয় না:'
                : 'প্রিভিউ ফ্রেম থেকে সরাসরি অ্যাপ ইনস্টল হয় না:'}
            </p>
            <p className="text-[11px] text-amber-800 leading-relaxed">
              {isInAppBrowser
                ? 'নিচের বাটনে চাপ দিয়ে লিংকটি Google Chrome ব্রাউজারে ওপেন করুন — তাহলেই সাথে সাথে Android অ্যাপ ইনস্টল অপশন চলে আসবে।'
                : 'অ্যাপটি ফোনে ইনস্টল করতে আপনার লাইভ সাইটটি সরাসরি Google Chrome ব্রাউজার ট্যাবে খুলুন।'}
            </p>
            {typeof window !== 'undefined' && (
              <div className="flex flex-wrap gap-2 pt-1">
                {isAndroid && isInAppBrowser && (
                  <a
                    href={androidChromeIntentHref}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-lg text-[11px]"
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>Open in Chrome</span>
                  </a>
                )}
                <a
                  href={window.location.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-extrabold rounded-lg text-[11px]"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open in New Tab</span>
                </a>
                <button
                  type="button"
                  onClick={handleCopyUrl}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-amber-300 text-amber-900 font-bold rounded-lg text-[11px] cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiedUrl ? 'Copied!' : 'Copy App Link'}</span>
                </button>
              </div>
            )}
          </div>
        )}

        <div className="space-y-2.5 text-xs text-slate-700">
          <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2">
            <p className="font-extrabold text-emerald-950">
              1. Android Phone (Google Chrome / Edge):
            </p>
            <p className="text-[11px] leading-relaxed text-emerald-950/90">
              উপরে ব্রাউজারের ডানদিকের <strong>⋮ (3-Dots Menu)</strong> তে ট্যাপ করে{' '}
              <strong>&ldquo;Install app&rdquo;</strong> বা{' '}
              <strong>&ldquo;Add to Home screen&rdquo;</strong> → <strong>Install</strong> চাপুন। আপনার{' '}
              <strong>{branding.shortName}</strong> কোম্পানির নাম ও লোগোসহ আসল Android App তৈরি হয়ে যাবে।
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleApplyBrandingAndReload}
                disabled={refreshingBrand}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold rounded-lg text-[11px] cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${refreshingBrand ? 'animate-spin' : ''}`} />
                <span>Apply Logo &amp; Reload Chrome</span>
              </button>
              {!inIframe && typeof window !== 'undefined' && (
                <button
                  type="button"
                  onClick={handleCopyUrl}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-lg text-[11px] cursor-pointer"
                >
                  <Copy className="w-3 h-3" />
                  <span>{copiedUrl ? 'Link Copied!' : 'Copy App Link'}</span>
                </button>
              )}
            </div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <p className="font-extrabold text-slate-900 mb-1">
              2. Computer / Laptop (Chrome / Edge):
            </p>
            <p className="text-[11px] leading-relaxed">
              URL বারের ডান পাশে <strong>Install App (⊕ / 💻↓)</strong> আইকনে ক্লিক করে{' '}
              <strong>Install</strong> চাপুন।
            </p>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <p className="font-extrabold text-slate-900 mb-1 flex items-center gap-1.5">
              <span>3. iPhone / iPad (Safari):</span>
              <Share className="w-3.5 h-3.5 text-blue-600" />
            </p>
            <p className="text-[11px] leading-relaxed">
              Safari-তে নিচের <strong>Share (□↑)</strong> বাটনে ট্যাপ করে{' '}
              <strong>&ldquo;Add to Home Screen&rdquo;</strong> সিলেক্ট করুন।
            </p>
          </div>

          <p className="text-[11px] text-emerald-700 font-semibold pt-1">
            একবার ইনস্টল করলে সব নতুন ডেটা রিয়েলটাইমে সিঙ্ক থাকবে এবং ভবিষ্যতের সব আপডেট অটো ইনস্টল হবে।
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setShowInstallModal(false)}
            className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl cursor-pointer"
          >
            Got it / ঠিক আছে
          </button>
        </div>
      </div>
    </div>
  ) : null;

  if (variant === 'card') {
    return (
      <>
        <div className="bg-gradient-to-br from-slate-900 to-emerald-950 text-white p-4 sm:p-6 rounded-2xl border border-emerald-500/30 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-white shadow-sm overflow-hidden flex items-center justify-center shrink-0 border border-emerald-400/50">
                {previewIconUrl ? (
                  <img
                    src={previewIconUrl}
                    alt={branding.shortName}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <CompanyLogo
                    className="w-10 h-10 border-0"
                    shortName={branding.shortName}
                    logoUrl={branding.logoUrl}
                  />
                )}
              </div>
              <div className="min-w-0">
                <h4 className="font-extrabold text-sm text-white">
                  {branding.shortName} — Android &amp; Desktop App
                </h4>
                <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                  Settings-এ যে কোম্পানির নাম ও লোগো সেট করা থাকবে, Android বা PC-তে ইনস্টল করলে সেই কোম্পানির নাম ও লোগো আইকনসহ ডাউনলোড হবে এবং সব ডিভাইসে ডেটা সিঙ্ক থাকবে।
                </p>
              </div>
            </div>

            <span
              className={`px-3 py-1 rounded-xl text-[11px] font-extrabold shrink-0 inline-flex items-center gap-1.5 self-start sm:self-auto ${
                isInstalled
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                  : 'bg-white/10 text-cyan-200 border border-white/15'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{isInstalled ? 'App Installed' : 'Auto-Update Ready'}</span>
            </span>
          </div>

          {renderAppBadgePreview(true)}

          <div className="flex flex-wrap items-center gap-2.5">
            {!isInstalled && (
              <button
                type="button"
                onClick={handleInstallClick}
                className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold rounded-xl text-xs flex items-center gap-2 cursor-pointer transition shadow-sm"
              >
                <Download className="w-4 h-4" />
                <span>
                  {isInstallable
                    ? `Install ${branding.shortName} App`
                    : isIOS
                    ? `Install ${branding.shortName} (iPhone)`
                    : isAndroid
                    ? `Download / Install ${branding.shortName} (Android)`
                    : `Download / Install ${branding.shortName}`}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={handleManualUpdateCheck}
              disabled={checkingUpdate}
              className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 font-bold rounded-xl text-xs flex items-center gap-2 cursor-pointer transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${checkingUpdate ? 'animate-spin' : ''}`} />
              <span>{checkingUpdate ? 'Checking...' : 'Check for App Updates Now'}</span>
            </button>
          </div>

          {updateMsg && (
            <div className="p-2.5 bg-emerald-500/15 border border-emerald-400/30 rounded-xl text-xs text-emerald-200 font-semibold">
              {updateMsg}
            </div>
          )}
        </div>
        {installModal}
      </>
    );
  }

  if (isInstalled) return null;

  const btnClass =
    variant === 'dark-pill'
      ? 'w-full py-2 px-3 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition cursor-pointer'
      : 'px-2 py-1.5 sm:px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] sm:text-xs font-extrabold flex items-center gap-1 sm:gap-1.5 transition cursor-pointer shrink-0 whitespace-nowrap shadow-xs';

  return (
    <>
      <button
        type="button"
        onClick={handleInstallClick}
        title={`Download / Install ${branding.shortName} App`}
        className={btnClass}
      >
        <Download className="w-3.5 h-3.5 shrink-0" />
        {variant === 'compact' ? (
          <>
            <span className="inline md:hidden">{isInstallable ? 'Install' : 'App'}</span>
            <span className="hidden md:inline">Install App</span>
          </>
        ) : (
          <span>Download / Install {branding.shortName} App</span>
        )}
      </button>
      {installModal}
    </>
  );
};
