import { useCallback, useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export interface PWAInstallState {
  isInstallable: boolean;
  isInstalled: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  isInAppBrowser: boolean;
  promptInstall: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
}

export const detectMobilePlatform = (userAgentInput?: string) => {
  const ua =
    typeof userAgentInput === 'string'
      ? userAgentInput
      : typeof navigator !== 'undefined'
        ? navigator.userAgent || ''
        : '';
  const isIOS = /iPad|iPhone|iPod/i.test(ua);
  const isAndroid = /Android/i.test(ua);
  const isInAppBrowser =
    /; wv\)|\bwv\b|FBAN|FBAV|Instagram|Line\/|MicroMessenger|WhatsApp/i.test(ua);
  return { isIOS, isAndroid, isInAppBrowser };
};

const checkIsStandaloneMode = (): boolean => {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
};

// Module-level store so `beforeinstallprompt` fired on LoginScreen is NEVER lost
// before Header & SettingsView mount after login.
let globalDeferredPrompt: BeforeInstallPromptEvent | null = null;
let globalIsInstalled = false;
let listenersInitialized = false;
const subscribers = new Set<() => void>();

const notifySubscribers = () => {
  subscribers.forEach((cb) => cb());
};

const initGlobalPwaInstallListeners = () => {
  if (listenersInitialized || typeof window === 'undefined') return;
  listenersInitialized = true;

  globalIsInstalled = checkIsStandaloneMode();

  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    globalDeferredPrompt = e as BeforeInstallPromptEvent;
    notifySubscribers();
  });

  window.addEventListener('appinstalled', () => {
    globalIsInstalled = true;
    globalDeferredPrompt = null;
    notifySubscribers();
  });

  try {
    const standaloneMedia = window.matchMedia('(display-mode: standalone)');
    standaloneMedia.addEventListener?.('change', (evt) => {
      if (evt.matches) {
        globalIsInstalled = true;
        globalDeferredPrompt = null;
        notifySubscribers();
      }
    });
  } catch {
    // ignore older matchMedia implementations
  }
};

if (typeof window !== 'undefined') {
  initGlobalPwaInstallListeners();
}

export function usePWAInstall(): PWAInstallState {
  const [, setVersion] = useState(0);

  useEffect(() => {
    initGlobalPwaInstallListeners();
    const forceSync = () => setVersion((v) => v + 1);
    subscribers.add(forceSync);
    if (checkIsStandaloneMode() && !globalIsInstalled) {
      globalIsInstalled = true;
      forceSync();
    }
    return () => {
      subscribers.delete(forceSync);
    };
  }, []);

  const { isIOS, isAndroid, isInAppBrowser } = detectMobilePlatform();

  const promptInstall = useCallback(async () => {
    if (!globalDeferredPrompt) return 'unavailable';
    await globalDeferredPrompt.prompt();
    const { outcome } = await globalDeferredPrompt.userChoice;
    globalDeferredPrompt = null;
    if (outcome === 'accepted') {
      globalIsInstalled = true;
    }
    notifySubscribers();
    return outcome;
  }, []);

  return {
    isInstallable: Boolean(globalDeferredPrompt),
    isInstalled: globalIsInstalled,
    isIOS,
    isAndroid,
    isInAppBrowser,
    promptInstall,
  };
}
