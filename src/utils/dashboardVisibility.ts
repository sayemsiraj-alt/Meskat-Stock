export type DashboardModuleKey =
  | 'buyerRequests'
  | 'expiryWatchlist'
  | 'salesVsExpenses'
  | 'categoryNetProfit';

export type DashboardModuleVisibility = Record<DashboardModuleKey, boolean>;

export const DEFAULT_DASHBOARD_VISIBILITY: DashboardModuleVisibility = {
  buyerRequests: true,
  expiryWatchlist: true,
  salesVsExpenses: true,
  categoryNetProfit: true,
};

export const DASHBOARD_TOGGLEABLE_MODULES: ReadonlyArray<{
  key: DashboardModuleKey;
  label: string;
}> = [
  { key: 'buyerRequests', label: 'Wholesale Buyer Requests' },
  { key: 'expiryWatchlist', label: '30-Day Expiry Watchlist' },
  { key: 'salesVsExpenses', label: 'Sales vs. Expenses (12M)' },
  { key: 'categoryNetProfit', label: 'Net Profit by Category' },
];

export const getDashboardVisibilityStorageKey = (userKey?: string): string => {
  const clean = (userKey || 'default').trim().toLowerCase() || 'default';
  return `stock_erp_dashboard_widgets_${clean}`;
};

export const normalizeDashboardVisibility = (
  raw?: Partial<Record<DashboardModuleKey, boolean>> | null
): DashboardModuleVisibility => ({
  buyerRequests: raw?.buyerRequests !== false,
  expiryWatchlist: raw?.expiryWatchlist !== false,
  salesVsExpenses: raw?.salesVsExpenses !== false,
  categoryNetProfit: raw?.categoryNetProfit !== false,
});

export const loadUserDashboardVisibility = (
  userKey?: string,
  remoteFallback?: Partial<Record<DashboardModuleKey, boolean>> | null
): DashboardModuleVisibility => {
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(getDashboardVisibilityStorageKey(userKey));
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          return normalizeDashboardVisibility(parsed);
        }
      }
    }
  } catch {
    // ignore storage read/parse errors
  }
  return normalizeDashboardVisibility(remoteFallback);
};

export const saveUserDashboardVisibility = (
  userKey: string | undefined,
  visibility: Partial<Record<DashboardModuleKey, boolean>>
): DashboardModuleVisibility => {
  const normalized = normalizeDashboardVisibility(visibility);
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(
        getDashboardVisibilityStorageKey(userKey),
        JSON.stringify(normalized)
      );
    }
  } catch {
    // ignore storage quota errors
  }
  return normalized;
};
