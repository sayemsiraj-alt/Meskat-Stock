import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_DASHBOARD_VISIBILITY,
  getDashboardVisibilityStorageKey,
  loadUserDashboardVisibility,
  normalizeDashboardVisibility,
  saveUserDashboardVisibility,
} from './dashboardVisibility.ts';

test('normalizeDashboardVisibility preserves explicit false toggles and defaults missing keys to true', () => {
  assert.deepEqual(normalizeDashboardVisibility(undefined), DEFAULT_DASHBOARD_VISIBILITY);
  assert.deepEqual(
    normalizeDashboardVisibility({ buyerRequests: false, categoryNetProfit: false }),
    {
      buyerRequests: false,
      expiryWatchlist: true,
      salesVsExpenses: true,
      categoryNetProfit: false,
    }
  );
});

test('saveUserDashboardVisibility and loadUserDashboardVisibility isolate and persist preferences per user', () => {
  const store = new Map<string, string>();
  const prevStorage = (globalThis as any).localStorage;
  (globalThis as any).localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
  };

  try {
    assert.equal(getDashboardVisibilityStorageKey('Admin'), 'stock_erp_dashboard_widgets_admin');
    saveUserDashboardVisibility('admin', {
      buyerRequests: false,
      expiryWatchlist: true,
      salesVsExpenses: false,
      categoryNetProfit: true,
    });
    saveUserDashboardVisibility('manager', {
      buyerRequests: true,
      expiryWatchlist: false,
      salesVsExpenses: true,
      categoryNetProfit: false,
    });

    assert.deepEqual(loadUserDashboardVisibility('admin'), {
      buyerRequests: false,
      expiryWatchlist: true,
      salesVsExpenses: false,
      categoryNetProfit: true,
    });
    assert.deepEqual(loadUserDashboardVisibility('manager'), {
      buyerRequests: true,
      expiryWatchlist: false,
      salesVsExpenses: true,
      categoryNetProfit: false,
    });
  } finally {
    (globalThis as any).localStorage = prevStorage;
  }
});
