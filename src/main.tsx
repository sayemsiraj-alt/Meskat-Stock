import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

declare global {
  interface Window {
    __erpCheckForPwaUpdate?: () => Promise<boolean>;
    __erpApplyPwaUpdate?: () => Promise<void>;
  }
}

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  let refreshing = false;
  const hadControllerAtBoot = Boolean(navigator.serviceWorker.controller);

  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      window.dispatchEvent(new CustomEvent('erp:pwa-updating'));
      updateSW(true).catch(() => {});
    },
    onOfflineReady() {
      window.dispatchEvent(new CustomEvent('erp:pwa-offline-ready'));
    },
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;

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

  // Automatically reload page when a new Service Worker takes control after an update
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadControllerAtBoot) return;
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
}

createRoot(document.getElementById('root')!).render(<App />);
