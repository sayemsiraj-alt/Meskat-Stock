import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';
import {
  extractSwVersionIdentifier,
  isBrandingSwReloadSuppressed,
  readStoredSwBrandingVersion,
  syncServiceWorkerBrandingVersion,
} from './utils/pwaManifestSync';

declare global {
  interface Window {
    __erpCheckForPwaUpdate?: () => Promise<boolean>;
    __erpApplyPwaUpdate?: () => Promise<void>;
    __erpSyncSwBrandingVersion?: (versionId: string) => Promise<void>;
  }
}

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  let refreshing = false;
  const hadControllerAtBoot = Boolean(navigator.serviceWorker.controller);

  window.__erpSyncSwBrandingVersion = async (versionId: string) => {
    await syncServiceWorkerBrandingVersion(versionId);
  };

  const updateSW = registerSW({
    immediate: true,
    onNeedReload() {
      if (isBrandingSwReloadSuppressed()) return;
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    },
    onNeedRefresh() {
      if (isBrandingSwReloadSuppressed()) return;
      window.dispatchEvent(new CustomEvent('erp:pwa-updating'));
      updateSW(true).catch(() => {});
    },
    onOfflineReady() {
      window.dispatchEvent(new CustomEvent('erp:pwa-offline-ready'));
    },
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;

      const storedBrandingVer = readStoredSwBrandingVersion();
      const activeSwUrl =
        registration.active?.scriptURL ||
        registration.waiting?.scriptURL ||
        registration.installing?.scriptURL ||
        '';
      if (storedBrandingVer && extractSwVersionIdentifier(activeSwUrl) !== storedBrandingVer) {
        syncServiceWorkerBrandingVersion(storedBrandingVer).catch(() => {});
      }

      const checkUpdate = async () => {
        try {
          await registration.update();
          if (registration.waiting) {
            window.dispatchEvent(new CustomEvent('erp:pwa-updating'));
            await updateSW(true);
            return true;
          }
          return false;
        } catch {
          return false;
        }
      };

      window.__erpCheckForPwaUpdate = checkUpdate;
      window.__erpApplyPwaUpdate = async () => {
        await updateSW(true);
      };

      // Poll every 15 minutes for new deployments while open
      window.setInterval(() => {
        checkUpdate();
      }, 15 * 60 * 1000);

      // Check immediately whenever user returns to app or comes back online
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          checkUpdate();
        }
      });
      window.addEventListener('online', () => {
        checkUpdate();
      });
    },
  });

  // Automatically reload page when a new Service Worker takes control after a real deployment update
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (isBrandingSwReloadSuppressed()) return;
    if (!hadControllerAtBoot) return;
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
}

createRoot(document.getElementById('root')!).render(<App />);
