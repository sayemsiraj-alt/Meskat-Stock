import { useState, useEffect, useRef, useCallback } from 'react';
import {
  initFirebase,
  testFirebaseConnection,
  pullAllFromFirestore,
  pushAllToFirestore,
  saveRecordToFirestore,
  deleteRecordFromFirestore,
  flushPendingFirestoreOps,
  clearFirestoreCollection,
  listenToCollection,
  listenToDocument,
  clearAllFirestoreCollections,
  findRemoteCustomerByEmail,
  findRemoteUserByLogin,
  FirestorePullResult,
} from './utils/firebaseService';
import {
  decodeFirebaseShareParam,
  hasFirebaseCredentials,
  parseRuntimeFirebaseConfigJson,
  readEnvFirebaseConfig,
} from './utils/firebaseConfigHelpers';
import {
  mergeRemoteSettings,
  shouldApplyRemoteCollectionSnapshot,
} from './utils/firebaseSyncHelpers';
import { 
  initialStockItems, 
  initialTransactions, 
  initialCategories, 
  initialSuppliers, 
  initialSettings,
  initialUsers,
  initialWholesalers,
  initialInvoices,
  initialAccountTxns,
  initialExpenses,
  initialPurchaseOrders,
  initialPurchaseBills,
  initialPurchaseReturns,
  initialSupplierPayments,
  initialDamagedStock,
  initialCustomerOrders,
  initialCustomerReturns,
  initialPaymentClaims,
  initialSalesReps,
  initialStockTransfers,
  initialAuditLogs,
  defaultRolePermissions,
  DEFAULT_WAREHOUSES,
  StockItem,
  StockTransaction,
  Category,
  Supplier,
  SystemSettings,
  SystemUser,
  Wholesaler,
  Invoice,
  AccountTxn,
  Expense,
  PurchaseOrder,
  PurchaseBill,
  PurchaseReturn,
  SupplierPayment,
  DamagedStock,
  CustomerOrder,
  CustomerReturn,
  PaymentClaim,
  SalesRep,
  StockTransfer,
  AuditLogEntry
} from './data/mockData';
import { LoginScreen, CustomerRegistrationPayload } from './components/LoginScreen';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { InventoryView } from './components/InventoryView';
import { StockTransactionsView } from './components/StockTransactionsView';
import { ReportsView } from './components/ReportsView';
import { SuppliersView } from './components/SuppliersView';
import { CategoriesView } from './components/CategoriesView';
import { SettingsView } from './components/SettingsView';
import { WholesalersView } from './components/WholesalersView';
import { SalesInvoiceView } from './components/SalesInvoiceView';
import { RetailPosView } from './components/RetailPosView';
import { AccountsView } from './components/AccountsView';
import { ExpensesView } from './components/ExpensesView';
import { PurchaseOrdersView } from './components/PurchaseOrdersView';
import { CustomerPortalView } from './components/CustomerPortalView';
import { SalesRepsView } from './components/SalesRepsView';
import { AuditLogView } from './components/AuditLogView';
import { getThemeConfig } from './utils/themeConfig';
import { ExpiryDamageView } from './components/ExpiryDamageView';
import { CourierDispatchView } from './components/CourierDispatchView';
import { AiChatbot } from './components/AiChatbot';
import { OfflineIndicator, PWAUpdateBanner } from './components/PWAComponents';
import { getFormattedLocalDateTime, getLocalYYYYMMDD } from './utils/dateUtils';
import { applyWarehouseTransfer, deductFromBatchesFEFO } from './utils/erpEnhancements';
import { getInvoiceItemTotalQty, validateBackupPayload } from './utils/erpFeatureUtils';
import { CriticalStockAlert, detectCriticalStockDrops } from './utils/stockAlerts';
import {
  DashboardModuleKey,
  DashboardModuleVisibility,
  loadUserDashboardVisibility,
  saveUserDashboardVisibility,
} from './utils/dashboardVisibility';
import { syncDynamicPwaBranding } from './utils/pwaManifestSync';
import { AlertTriangle, Package, X } from 'lucide-react';

export default function App() {
  // Authentication state (Defaults to FALSE on any new computer/browser unless remembered)
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    const permActive = localStorage.getItem('stock_erp_session_active');
    const tempActive = sessionStorage.getItem('stock_erp_session_active');
    return permActive === 'true' || tempActive === 'true';
  });

  const [currentUserId, setCurrentUserId] = useState<string>(() => {
    return localStorage.getItem('stock_erp_current_user_id') || sessionStorage.getItem('stock_erp_current_user_id') || '';
  });

  const [userRole, setUserRole] = useState<'admin' | 'manager' | 'staff' | 'customer'>(() => {
    return (localStorage.getItem('stock_erp_user_role') as any) || (sessionStorage.getItem('stock_erp_user_role') as any) || 'admin';
  });

  const [userName, setUserName] = useState<string>(() => {
    return localStorage.getItem('stock_erp_user_name') || sessionStorage.getItem('stock_erp_user_name') || 'System Administrator';
  });

  // Navigation tab & Browser History stack (prevents Back button from exiting the app)
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [tabHistory, setTabHistory] = useState<string[]>(['dashboard']);
  const tabHistoryRef = useRef<string[]>(['dashboard']);
  const currentTabRef = useRef<string>('dashboard');
  const isSidebarOpenRef = useRef<boolean>(false);
  const historyGuardReadyRef = useRef<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [systemDate, setSystemDate] = useState<string>(getLocalYYYYMMDD());

  useEffect(() => {
    currentTabRef.current = currentTab;
  }, [currentTab]);

  useEffect(() => {
    isSidebarOpenRef.current = isSidebarOpen;
  }, [isSidebarOpen]);

  const navigateToTab = useCallback((nextTab: string) => {
    if (!nextTab) return;
    setIsSidebarOpen(false);
    if (nextTab === currentTabRef.current) return;
    const nextStack = [...tabHistoryRef.current, nextTab].slice(-30);
    tabHistoryRef.current = nextStack;
    setTabHistory(nextStack);
    setCurrentTab(nextTab);
    if (typeof window !== 'undefined') {
      try {
        window.history.pushState(
          { erpScope: 'staff', erpTab: nextTab, erpDepth: nextStack.length },
          ''
        );
      } catch {
        // ignore restricted history environments
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !isLoggedIn || userRole === 'customer') {
      historyGuardReadyRef.current = false;
      return;
    }

    if (!historyGuardReadyRef.current) {
      historyGuardReadyRef.current = true;
      try {
        window.history.replaceState(
          { erpScope: 'staff', erpTab: currentTabRef.current, erpDepth: 0, erpRoot: true },
          ''
        );
        window.history.pushState(
          { erpScope: 'staff', erpTab: currentTabRef.current, erpDepth: 1, erpGuard: true },
          ''
        );
      } catch {
        // ignore restricted history environments
      }
    }

    const handlePopState = (event: PopStateEvent) => {
      // 1. Close mobile sidebar drawer first if open
      if (isSidebarOpenRef.current) {
        setIsSidebarOpen(false);
        try {
          window.history.pushState(
            {
              erpScope: 'staff',
              erpTab: currentTabRef.current,
              erpDepth: tabHistoryRef.current.length,
            },
            ''
          );
        } catch {
          // ignore
        }
        return;
      }

      // 2. Allow open modals (e.g., Invoice Preview / Dispatch Modal) to close cleanly first
      const backEvt = new CustomEvent('erp:history-back', { cancelable: true });
      const notCancelled = window.dispatchEvent(backEvt);
      if (!notCancelled) {
        try {
          window.history.pushState(
            {
              erpScope: 'staff',
              erpTab: currentTabRef.current,
              erpDepth: tabHistoryRef.current.length,
            },
            ''
          );
        } catch {
          // ignore
        }
        return;
      }

      // 3. Step back to previous in-app tab instead of exiting the software
      const stateTab =
        event.state && event.state.erpScope === 'staff' && typeof event.state.erpTab === 'string'
          ? event.state.erpTab
          : null;

      if (tabHistoryRef.current.length > 1) {
        const nextStack = tabHistoryRef.current.slice(0, -1);
        const targetTab = nextStack[nextStack.length - 1] || stateTab || 'dashboard';
        tabHistoryRef.current = nextStack;
        setTabHistory(nextStack);
        setCurrentTab(targetTab);
        // If we stepped back to root depth 0, immediately keep a guard entry ahead so another Back stays inside app
        if (nextStack.length <= 1) {
          try {
            window.history.pushState(
              { erpScope: 'staff', erpTab: targetTab, erpDepth: 1, erpGuard: true },
              ''
            );
          } catch {
            // ignore
          }
        }
        return;
      }

      // 4. At root tab: return to dashboard if not there, and maintain root guard so software never exits on Back
      if (currentTabRef.current !== 'dashboard') {
        tabHistoryRef.current = ['dashboard'];
        setTabHistory(['dashboard']);
        setCurrentTab('dashboard');
      }
      try {
        window.history.pushState(
          { erpScope: 'staff', erpTab: 'dashboard', erpDepth: 1, erpGuard: true },
          ''
        );
      } catch {
        // ignore
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isLoggedIn, userRole]);

  // LocalStorage Helpers
  const loadLocal = <T,>(key: string, fallback: T): T => {
    try {
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : fallback;
    } catch (e) {
      return fallback;
    }
  };

  // Application Data States (Persisted in LocalStorage & Firebase Cloud)
  const [items, setItems] = useState<StockItem[]>(() => loadLocal('stock_erp_items', initialStockItems));
  const [transactions, setTransactions] = useState<StockTransaction[]>(() => loadLocal('stock_erp_txns', initialTransactions));
  const [categories, setCategories] = useState<Category[]>(() => loadLocal('stock_erp_categories', initialCategories));
  const [suppliers, setSuppliers] = useState<Supplier[]>(() => loadLocal('stock_erp_suppliers', initialSuppliers));
  const [settings, setSettings] = useState<SystemSettings>(() => {
    const saved = loadLocal<Partial<SystemSettings> | null>('stock_erp_settings', null);
    const firebaseBackup = loadLocal<Partial<SystemSettings> | null>('stock_erp_firebase_backup', null);
    const envConfig = readEnvFirebaseConfig();
    const sharedFromUrl =
      typeof window !== 'undefined'
        ? decodeFirebaseShareParam(window.location.search || window.location.hash)
        : null;
    const merged: SystemSettings = {
      ...initialSettings,
      ...(saved || {}),
      ...(sharedFromUrl || {}),
    };
    if (!merged.firebaseApiKey && envConfig.firebaseApiKey) {
      merged.firebaseApiKey = envConfig.firebaseApiKey;
    }
    if (!merged.firebaseProjectId && envConfig.firebaseProjectId) {
      merged.firebaseProjectId = envConfig.firebaseProjectId;
    }
    if (!merged.firebaseAuthDomain && envConfig.firebaseAuthDomain) {
      merged.firebaseAuthDomain = envConfig.firebaseAuthDomain;
    }
    if (!merged.firebaseStorageBucket && envConfig.firebaseStorageBucket) {
      merged.firebaseStorageBucket = envConfig.firebaseStorageBucket;
    }
    if (!merged.firebaseMessagingSenderId && envConfig.firebaseMessagingSenderId) {
      merged.firebaseMessagingSenderId = envConfig.firebaseMessagingSenderId;
    }
    if (!merged.firebaseAppId && envConfig.firebaseAppId) {
      merged.firebaseAppId = envConfig.firebaseAppId;
    }
    if (!merged.firebaseApiKey && firebaseBackup?.firebaseApiKey) {
      merged.firebaseApiKey = firebaseBackup.firebaseApiKey;
    }
    if (!merged.firebaseProjectId && firebaseBackup?.firebaseProjectId) {
      merged.firebaseProjectId = firebaseBackup.firebaseProjectId;
    }
    if (!merged.firebaseAuthDomain && firebaseBackup?.firebaseAuthDomain) {
      merged.firebaseAuthDomain = firebaseBackup.firebaseAuthDomain;
    }
    if (!merged.firebaseStorageBucket && firebaseBackup?.firebaseStorageBucket) {
      merged.firebaseStorageBucket = firebaseBackup.firebaseStorageBucket;
    }
    if (!merged.firebaseMessagingSenderId && firebaseBackup?.firebaseMessagingSenderId) {
      merged.firebaseMessagingSenderId = firebaseBackup.firebaseMessagingSenderId;
    }
    if (!merged.firebaseAppId && firebaseBackup?.firebaseAppId) {
      merged.firebaseAppId = firebaseBackup.firebaseAppId;
    }
    if (
      !merged.firebaseConnected &&
      (sharedFromUrl?.firebaseConnected ||
        envConfig.firebaseConnected ||
        firebaseBackup?.firebaseConnected ||
        initialSettings.firebaseConnected) &&
      hasFirebaseCredentials(merged)
    ) {
      merged.firebaseConnected = true;
    }
    return merged;
  });

  const [isCloudBootstrapping, setIsCloudBootstrapping] = useState<boolean>(() =>
    Boolean(
      typeof window !== 'undefined' &&
        (hasFirebaseCredentials(readEnvFirebaseConfig()) ||
          Boolean(decodeFirebaseShareParam(window.location.search || window.location.hash)) ||
          Boolean(loadLocal<Partial<SystemSettings> | null>('stock_erp_firebase_backup', null)?.firebaseConnected))
    )
  );

  // Optional static /firebase-config.json auto-loader for zero-rebuild Netlify deploys
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (hasFirebaseCredentials(settings) && settings.firebaseConnected) return;

    let active = true;
    fetch('/firebase-config.json', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) return null;
        const text = await res.text();
        if (!text || text.trim().startsWith('<')) return null;
        return parseRuntimeFirebaseConfigJson(JSON.parse(text));
      })
      .then((runtimeConfig) => {
        if (!active || !runtimeConfig || !hasFirebaseCredentials(runtimeConfig)) return;
        setIsCloudBootstrapping(true);
        setSettings((prev) => {
          const next: SystemSettings = {
            ...prev,
            ...runtimeConfig,
            firebaseConnected: true,
          };
          try {
            localStorage.setItem('stock_erp_settings', JSON.stringify(next));
          } catch {
            // ignore storage errors
          }
          return next;
        });
      })
      .catch(() => {
        // /firebase-config.json is optional; ignore when absent
      });

    return () => {
      active = false;
    };
    // Run once on startup
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [users, setUsers] = useState<SystemUser[]>(() => {
    const saved = loadLocal<SystemUser[]>('stock_erp_users', initialUsers);
    if (!Array.isArray(saved) || saved.length === 0) {
      return initialUsers;
    }
    return saved;
  });
  
  const [wholesalers, setWholesalers] = useState<Wholesaler[]>(() => loadLocal('stock_erp_wholesalers', initialWholesalers));
  const [invoices, setInvoices] = useState<Invoice[]>(() => loadLocal('stock_erp_invoices', initialInvoices));
  const [accountTxns, setAccountTxns] = useState<AccountTxn[]>(() => loadLocal('stock_erp_accountTxns', initialAccountTxns));
  const [expenses, setExpenses] = useState<Expense[]>(() => loadLocal('stock_erp_expenses', initialExpenses));
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>(() => loadLocal('stock_erp_purchase_orders', initialPurchaseOrders));
  const [purchaseBills, setPurchaseBills] = useState<PurchaseBill[]>(() => loadLocal('stock_erp_purchase_bills', initialPurchaseBills));
  const [purchaseReturns, setPurchaseReturns] = useState<PurchaseReturn[]>(() => loadLocal('stock_erp_purchase_returns', initialPurchaseReturns));
  const [supplierPayments, setSupplierPayments] = useState<SupplierPayment[]>(() => loadLocal('stock_erp_supplier_payments', initialSupplierPayments));
  const [damagedStockList, setDamagedStockList] = useState<DamagedStock[]>(() => loadLocal('stock_erp_damaged_stock', initialDamagedStock));
  const [customerOrders, setCustomerOrders] = useState<CustomerOrder[]>(() => loadLocal('stock_erp_customer_orders', initialCustomerOrders));
  const [customerReturns, setCustomerReturns] = useState<CustomerReturn[]>(() => loadLocal('stock_erp_customer_returns', initialCustomerReturns));
  const [paymentClaims, setPaymentClaims] = useState<PaymentClaim[]>(() => loadLocal('stock_erp_payment_claims', initialPaymentClaims));
  const [salesReps, setSalesReps] = useState<SalesRep[]>(() => loadLocal('stock_erp_sales_reps', initialSalesReps));
  const [stockTransfers, setStockTransfers] = useState<StockTransfer[]>(() => loadLocal('stock_erp_stock_transfers', initialStockTransfers));
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(() => loadLocal('stock_erp_audit_logs', initialAuditLogs));
  const [appNotice, setAppNotice] = useState<{ type: 'info' | 'error'; text: string } | null>(null);
  const [stockToasts, setStockToasts] = useState<CriticalStockAlert[]>([]);
  const prevStockQuantitiesRef = useRef<Map<string, number>>(new Map());
  const initialReorderThresholdsRef = useRef<Map<string, number>>(new Map());
  const stockWatchInitializedRef = useRef<boolean>(false);
  const toastTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismissStockToast = useCallback((toastId: string) => {
    const existingTimer = toastTimersRef.current.get(toastId);
    if (existingTimer) {
      clearTimeout(existingTimer);
      toastTimersRef.current.delete(toastId);
    }
    setStockToasts((prev) => prev.filter((t) => t.id !== toastId));
  }, []);

  useEffect(() => {
    const { alerts, nextQuantities, nextInitialThresholds } = detectCriticalStockDrops(
      items,
      prevStockQuantitiesRef.current,
      initialReorderThresholdsRef.current,
      !stockWatchInitializedRef.current
    );

    prevStockQuantitiesRef.current = nextQuantities;
    initialReorderThresholdsRef.current = nextInitialThresholds;
    stockWatchInitializedRef.current = true;

    if (alerts.length > 0 && isLoggedIn && userRole !== 'customer') {
      setStockToasts((prev) => [...alerts, ...prev].slice(0, 5));
      alerts.forEach((alert) => {
        const timer = setTimeout(() => {
          toastTimersRef.current.delete(alert.id);
          setStockToasts((prev) => prev.filter((t) => t.id !== alert.id));
        }, 8000);
        toastTimersRef.current.set(alert.id, timer);
      });
    }
  }, [items, isLoggedIn, userRole]);

  useEffect(() => {
    return () => {
      toastTimersRef.current.forEach((timer) => clearTimeout(timer));
      toastTimersRef.current.clear();
    };
  }, []);

  // Sync to LocalStorage
  useEffect(() => { localStorage.setItem('stock_erp_items', JSON.stringify(items)); }, [items]);
  useEffect(() => { localStorage.setItem('stock_erp_txns', JSON.stringify(transactions)); }, [transactions]);
  useEffect(() => { localStorage.setItem('stock_erp_categories', JSON.stringify(categories)); }, [categories]);
  useEffect(() => { localStorage.setItem('stock_erp_suppliers', JSON.stringify(suppliers)); }, [suppliers]);
  useEffect(() => { localStorage.setItem('stock_erp_settings', JSON.stringify(settings)); }, [settings]);
  useEffect(() => { localStorage.setItem('stock_erp_users', JSON.stringify(users)); }, [users]);
  useEffect(() => { localStorage.setItem('stock_erp_wholesalers', JSON.stringify(wholesalers)); }, [wholesalers]);
  useEffect(() => { localStorage.setItem('stock_erp_invoices', JSON.stringify(invoices)); }, [invoices]);
  useEffect(() => { localStorage.setItem('stock_erp_accountTxns', JSON.stringify(accountTxns)); }, [accountTxns]);
  useEffect(() => { localStorage.setItem('stock_erp_expenses', JSON.stringify(expenses)); }, [expenses]);
  useEffect(() => { localStorage.setItem('stock_erp_purchase_orders', JSON.stringify(purchaseOrders)); }, [purchaseOrders]);
  useEffect(() => { localStorage.setItem('stock_erp_purchase_bills', JSON.stringify(purchaseBills)); }, [purchaseBills]);
  useEffect(() => { localStorage.setItem('stock_erp_purchase_returns', JSON.stringify(purchaseReturns)); }, [purchaseReturns]);
  useEffect(() => { localStorage.setItem('stock_erp_supplier_payments', JSON.stringify(supplierPayments)); }, [supplierPayments]);
  useEffect(() => { localStorage.setItem('stock_erp_damaged_stock', JSON.stringify(damagedStockList)); }, [damagedStockList]);
  useEffect(() => { localStorage.setItem('stock_erp_customer_orders', JSON.stringify(customerOrders)); }, [customerOrders]);
  useEffect(() => { localStorage.setItem('stock_erp_customer_returns', JSON.stringify(customerReturns)); }, [customerReturns]);
  useEffect(() => { localStorage.setItem('stock_erp_payment_claims', JSON.stringify(paymentClaims)); }, [paymentClaims]);
  useEffect(() => { localStorage.setItem('stock_erp_sales_reps', JSON.stringify(salesReps)); }, [salesReps]);
  useEffect(() => { localStorage.setItem('stock_erp_stock_transfers', JSON.stringify(stockTransfers)); }, [stockTransfers]);
  useEffect(() => { localStorage.setItem('stock_erp_audit_logs', JSON.stringify(auditLogs)); }, [auditLogs]);

  // Dynamic Per-Company Browser Title, App Icon & Web App Manifest Sync
  useEffect(() => {
    let active = true;
    syncDynamicPwaBranding({
      brandName: settings.brandName,
      brandShortName: settings.brandShortName,
      storeName: settings.storeName,
      logoUrl: settings.logoUrl,
      activeTheme: settings.activeTheme,
      firebaseProjectId: settings.firebaseProjectId,
    }).catch(() => {
      if (!active) return;
      const titleName = settings.brandName || settings.storeName || 'Stock ERP';
      document.title = `${titleName} — Stock ERP`;
    });
    return () => {
      active = false;
    };
  }, [
    settings.brandName,
    settings.brandShortName,
    settings.storeName,
    settings.logoUrl,
    settings.activeTheme,
    settings.firebaseProjectId,
  ]);

  const persistSettingsLocally = useCallback((nextSettings: SystemSettings) => {
    try {
      localStorage.setItem('stock_erp_settings', JSON.stringify(nextSettings));
      if (nextSettings.firebaseApiKey && nextSettings.firebaseProjectId) {
        localStorage.setItem(
          'stock_erp_firebase_backup',
          JSON.stringify({
            firebaseApiKey: nextSettings.firebaseApiKey,
            firebaseAuthDomain: nextSettings.firebaseAuthDomain || '',
            firebaseProjectId: nextSettings.firebaseProjectId,
            firebaseStorageBucket: nextSettings.firebaseStorageBucket || '',
            firebaseMessagingSenderId: nextSettings.firebaseMessagingSenderId || '',
            firebaseAppId: nextSettings.firebaseAppId || '',
            firebaseConnected: Boolean(nextSettings.firebaseConnected),
            firebaseLastSync: nextSettings.firebaseLastSync || '',
          })
        );
      } else {
        localStorage.removeItem('stock_erp_firebase_backup');
      }
    } catch {
      // ignore storage quota errors
    }
  }, []);

  const applyRemoteCollections = useCallback(
    (result: FirestorePullResult, forceOverwriteEmpty = false) => {
      if (!result.success) return;
      const c = result.collections;

      if (c.items && (c.items.length > 0 || forceOverwriteEmpty)) setItems(c.items);
      if (c.transactions && (c.transactions.length > 0 || forceOverwriteEmpty)) setTransactions(c.transactions);
      if (c.wholesalers && (c.wholesalers.length > 0 || forceOverwriteEmpty)) setWholesalers(c.wholesalers);
      if (c.invoices && (c.invoices.length > 0 || forceOverwriteEmpty)) setInvoices(c.invoices);
      if (c.accountTxns && (c.accountTxns.length > 0 || forceOverwriteEmpty)) setAccountTxns(c.accountTxns);
      if (c.expenses && (c.expenses.length > 0 || forceOverwriteEmpty)) setExpenses(c.expenses);
      if (c.purchase_orders && (c.purchase_orders.length > 0 || forceOverwriteEmpty)) setPurchaseOrders(c.purchase_orders);
      if (c.purchase_bills && (c.purchase_bills.length > 0 || forceOverwriteEmpty)) setPurchaseBills(c.purchase_bills);
      if (c.purchase_returns && (c.purchase_returns.length > 0 || forceOverwriteEmpty)) setPurchaseReturns(c.purchase_returns);
      if (c.supplier_payments && (c.supplier_payments.length > 0 || forceOverwriteEmpty)) setSupplierPayments(c.supplier_payments);
      if (c.damaged_stock && (c.damaged_stock.length > 0 || forceOverwriteEmpty)) setDamagedStockList(c.damaged_stock);
      if (c.suppliers && (c.suppliers.length > 0 || forceOverwriteEmpty)) setSuppliers(c.suppliers);
      if (c.categories && (c.categories.length > 0 || forceOverwriteEmpty)) setCategories(c.categories);
      if (c.customer_orders && (c.customer_orders.length > 0 || forceOverwriteEmpty)) setCustomerOrders(c.customer_orders);
      if (c.customer_returns && (c.customer_returns.length > 0 || forceOverwriteEmpty)) setCustomerReturns(c.customer_returns);
      if (c.payment_claims && (c.payment_claims.length > 0 || forceOverwriteEmpty)) setPaymentClaims(c.payment_claims);
      if (c.sales_reps && (c.sales_reps.length > 0 || forceOverwriteEmpty)) setSalesReps(c.sales_reps);
      if (c.stock_transfers && (c.stock_transfers.length > 0 || forceOverwriteEmpty)) setStockTransfers(c.stock_transfers);
      if (c.audit_logs && (c.audit_logs.length > 0 || forceOverwriteEmpty)) setAuditLogs(c.audit_logs);
      if (c.users && c.users.length > 0) setUsers(c.users);

      const syncedAt = new Date().toISOString();
      setSettings((prev) => {
        const merged = mergeRemoteSettings(prev, {
          ...(result.settingsDoc || {}),
          firebaseConnected: true,
          firebaseLastSync: syncedAt,
        });
        persistSettingsLocally(merged);
        return merged;
      });
    },
    [persistSettingsLocally]
  );

  // --- FIREBASE LIVE CLOUD SYNC & LISTENERS ---
  useEffect(() => {
    if (!settings.firebaseConnected || !settings.firebaseApiKey || !settings.firebaseProjectId) {
      setIsCloudBootstrapping(false);
      return;
    }

    const db = initFirebase(settings);
    if (!db) {
      setIsCloudBootstrapping(false);
      return;
    }

    let cancelled = false;
    const observedNonEmpty = new Set<string>();
    const bootstrapTimeout = setTimeout(() => {
      if (!cancelled) setIsCloudBootstrapping(false);
    }, 5000);

    // Initial automatic flush (offline writes first) + pull so existing & pending records sync cleanly
    flushPendingFirestoreOps(settings)
      .then(() => pullAllFromFirestore(settings))
      .then((res) => {
        if (cancelled) return;
        if (res.success && (res.totalRecords > 0 || Boolean(res.settingsDoc))) {
          Object.entries(res.collections).forEach(([k, rows]) => {
            if (Array.isArray(rows) && rows.length > 0) observedNonEmpty.add(k);
          });
          applyRemoteCollections(res, false);
        }
      })
      .finally(() => {
        clearTimeout(bootstrapTimeout);
        if (!cancelled) setIsCloudBootstrapping(false);
      });

    const handleOnlineFlush = () => {
      flushPendingFirestoreOps(settings)
        .then((res) => {
          if (res.flushed > 0) {
            return pullAllFromFirestore(settings);
          }
          return null;
        })
        .then((pullRes) => {
          if (!cancelled && pullRes?.success && (pullRes.totalRecords > 0 || Boolean(pullRes.settingsDoc))) {
            applyRemoteCollections(pullRes, false);
          }
        })
        .catch(() => {
          // keep queued ops for next retry
        });
    };
    window.addEventListener('online', handleOnlineFlush);

    const guardSet = <T,>(
      colName: string,
      setter: React.Dispatch<React.SetStateAction<T[]>>,
      remoteList: T[]
    ) => {
      if (remoteList.length > 0) observedNonEmpty.add(colName);
      setter((prev) =>
        shouldApplyRemoteCollectionSnapshot(remoteList, prev, observedNonEmpty.has(colName))
          ? remoteList
          : prev
      );
    };

    // Set up Live Cloud Firestore Listeners for ALL collections and settings
    const unsubItems = listenToCollection('items', (remote) => guardSet('items', setItems, remote || []));
    const unsubTxns = listenToCollection('transactions', (remote) => guardSet('transactions', setTransactions, remote || []));
    const unsubWholesalers = listenToCollection('wholesalers', (remote) => guardSet('wholesalers', setWholesalers, remote || []));
    const unsubInvoices = listenToCollection('invoices', (remote) => guardSet('invoices', setInvoices, remote || []));
    const unsubAccountTxns = listenToCollection('accountTxns', (remote) => guardSet('accountTxns', setAccountTxns, remote || []));
    const unsubExpenses = listenToCollection('expenses', (remote) => guardSet('expenses', setExpenses, remote || []));
    const unsubPOs = listenToCollection('purchase_orders', (remote) => guardSet('purchase_orders', setPurchaseOrders, remote || []));
    const unsubPurchaseBills = listenToCollection('purchase_bills', (remote) => guardSet('purchase_bills', setPurchaseBills, remote || []));
    const unsubPurchaseReturns = listenToCollection('purchase_returns', (remote) => guardSet('purchase_returns', setPurchaseReturns, remote || []));
    const unsubSupplierPayments = listenToCollection('supplier_payments', (remote) => guardSet('supplier_payments', setSupplierPayments, remote || []));
    const unsubDamaged = listenToCollection('damaged_stock', (remote) => guardSet('damaged_stock', setDamagedStockList, remote || []));
    const unsubSuppliers = listenToCollection('suppliers', (remote) => guardSet('suppliers', setSuppliers, remote || []));
    const unsubCategories = listenToCollection('categories', (remote) => guardSet('categories', setCategories, remote || []));
    const unsubCustomerOrders = listenToCollection('customer_orders', (remote) => guardSet('customer_orders', setCustomerOrders, remote || []));
    const unsubCustomerReturns = listenToCollection('customer_returns', (remote) => guardSet('customer_returns', setCustomerReturns, remote || []));
    const unsubPaymentClaims = listenToCollection('payment_claims', (remote) => guardSet('payment_claims', setPaymentClaims, remote || []));
    const unsubSalesReps = listenToCollection('sales_reps', (remote) => guardSet('sales_reps', setSalesReps, remote || []));
    const unsubStockTransfers = listenToCollection('stock_transfers', (remote) => guardSet('stock_transfers', setStockTransfers, remote || []));
    const unsubAuditLogs = listenToCollection('audit_logs', (remote) => guardSet('audit_logs', setAuditLogs, remote || []));
    const unsubUsers = listenToCollection('users', (remoteUsers) => {
      if (remoteUsers?.length) setUsers(remoteUsers);
    });
    const unsubSettings = listenToDocument('settings', 'config', (remoteSettings) => {
      if (remoteSettings && typeof remoteSettings === 'object') {
        setSettings((prev) => {
          const merged = mergeRemoteSettings(prev, remoteSettings);
          persistSettingsLocally(merged);
          return merged;
        });
      }
    });

    return () => {
      cancelled = true;
      clearTimeout(bootstrapTimeout);
      window.removeEventListener('online', handleOnlineFlush);
      unsubItems();
      unsubTxns();
      unsubWholesalers();
      unsubInvoices();
      unsubAccountTxns();
      unsubExpenses();
      unsubPOs();
      unsubPurchaseBills();
      unsubPurchaseReturns();
      unsubSupplierPayments();
      unsubDamaged();
      unsubSuppliers();
      unsubCategories();
      unsubCustomerOrders();
      unsubCustomerReturns();
      unsubPaymentClaims();
      unsubSalesReps();
      unsubStockTransfers();
      unsubAuditLogs();
      unsubUsers();
      unsubSettings();
    };
  }, [settings.firebaseConnected, settings.firebaseApiKey, settings.firebaseProjectId, applyRemoteCollections, persistSettingsLocally]);

  const handleLogin = (user: SystemUser, rememberMe: boolean) => {
    setUserRole(user.role);
    setUserName(user.name);
    setCurrentUserId(user.userId);
    setIsLoggedIn(true);
    setCurrentTab('dashboard');

    const storage = rememberMe ? localStorage : sessionStorage;
    storage.setItem('stock_erp_session_active', 'true');
    storage.setItem('stock_erp_user_role', user.role);
    storage.setItem('stock_erp_user_name', user.name);
    storage.setItem('stock_erp_current_user_id', user.userId);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    historyGuardReadyRef.current = false;
    tabHistoryRef.current = ['dashboard'];
    setTabHistory(['dashboard']);
    setCurrentTab('dashboard');
    localStorage.removeItem('stock_erp_session_active');
    localStorage.removeItem('stock_erp_user_role');
    localStorage.removeItem('stock_erp_user_name');
    localStorage.removeItem('stock_erp_current_user_id');

    sessionStorage.removeItem('stock_erp_session_active');
    sessionStorage.removeItem('stock_erp_user_role');
    sessionStorage.removeItem('stock_erp_user_name');
    sessionStorage.removeItem('stock_erp_current_user_id');
  };

  const activeWarehouses =
    settings.warehouses && settings.warehouses.length > 0
      ? settings.warehouses
      : DEFAULT_WAREHOUSES;

  const logAudit = (
    action: string,
    module: AuditLogEntry['module'],
    details: string,
    targetId?: string
  ) => {
    const entry: AuditLogEntry = {
      id: `AUD-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`,
      timestamp: new Date().toISOString(),
      userId: currentUserId || 'system',
      userName: userName || 'System',
      userRole: userRole || 'admin',
      action,
      module,
      targetId,
      details,
    };
    setAuditLogs((prev) => [entry, ...prev].slice(0, 500));
    if (settings.firebaseConnected) saveRecordToFirestore('audit_logs', entry.id, entry);
  };

  // --- AUTOMATIC STOCK MANAGEMENT HANDLERS ---
  const handleAddItem = (newItem: Omit<StockItem, 'id' | 'status'>) => {
    const id = `ITEM-${Date.now().toString().slice(-6)}-${Math.floor(10 + Math.random() * 90)}`;
    const status = newItem.quantity === 0 ? 'Out of Stock' : (newItem.quantity <= newItem.reorderThreshold ? 'Low Stock' : 'In Stock');
    const completeItem: StockItem = {
      ...newItem,
      id,
      status
    };
    setItems(prev => [completeItem, ...prev]);
    if (settings.firebaseConnected) saveRecordToFirestore('items', completeItem.id, completeItem);
    logAudit('Add Product', 'Inventory', `Added product ${completeItem.name} (${completeItem.quantity} ${completeItem.unit})`, id);

    // Log initial Stock IN purchase transaction when opening stock quantity > 0
    if (completeItem.quantity > 0) {
      const initTxn: StockTransaction = {
        id: `TXN-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`,
        itemId: completeItem.id,
        itemName: completeItem.name,
        type: 'IN',
        quantity: completeItem.quantity,
        unitPrice: completeItem.costPrice,
        totalPrice: completeItem.quantity * completeItem.costPrice,
        date: getFormattedLocalDateTime(systemDate),
        user: userName,
        reference: 'INIT-STOCK',
        supplierName: completeItem.supplier || 'Unassigned Supplier',
        category: completeItem.category || 'Uncategorized',
        notes: `Initial Stock Purchase from ${completeItem.supplier || 'Unassigned Supplier'}`,
      };
      setTransactions(prev => [initTxn, ...prev]);
      if (settings.firebaseConnected) saveRecordToFirestore('transactions', initTxn.id, initTxn);
    }

    // Also update category count and sync to Firestore
    setCategories(prev => prev.map(c => {
      if (c.name === newItem.category) {
        const updatedCat = { ...c, count: c.count + 1 };
        if (settings.firebaseConnected) saveRecordToFirestore('categories', updatedCat.id, updatedCat);
        return updatedCat;
      }
      return c;
    }));
  };

  const handleUpdateItem = (updatedItem: StockItem) => {
    setItems(prev => prev.map(i => i.id === updatedItem.id ? updatedItem : i));
    if (settings.firebaseConnected) saveRecordToFirestore('items', updatedItem.id, updatedItem);
    logAudit('Update Product', 'Inventory', `Updated product ${updatedItem.name} (Qty: ${updatedItem.quantity})`, updatedItem.id);
  };

  const handleDeleteItem = (id: string) => {
    const target = items.find(i => i.id === id);
    setItems(prev => prev.filter(i => i.id !== id));
    if (settings.firebaseConnected) deleteRecordFromFirestore('items', id);
    logAudit('Delete Product', 'Inventory', `Deleted product ${target?.name || id}`, id);
  };

  // Adding a transaction automatically adjusts stock item quantities (using FEFO & Warehouse allocation)
  const handleAddTransaction = (txn: Omit<StockTransaction, 'id' | 'totalPrice'>, warehouseName?: string) => {
    const id = `TXN-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
    const totalPrice = txn.quantity * txn.unitPrice;
    const completeTxn: StockTransaction = {
      ...txn,
      id,
      totalPrice
    };

    // Update transactions list
    setTransactions(prev => [completeTxn, ...prev]);
    if (settings.firebaseConnected) saveRecordToFirestore('transactions', completeTxn.id, completeTxn);

    const primaryWh = activeWarehouses[0] || 'Main Warehouse';
    const targetWh = warehouseName || primaryWh;

    // Automatically recalculate item quantity (including FEFO batches & warehouse stock)
    setItems(prev => prev.map(item => {
      if (item.id === txn.itemId) {
        let updatedItem: StockItem;
        if (txn.type === 'OUT') {
          const { updatedItem: fefoUpdated } = deductFromBatchesFEFO(item, txn.quantity);
          updatedItem = fefoUpdated;
          if (item.warehouseStocks && Object.keys(item.warehouseStocks).length > 0) {
            const nextWhMap = { ...item.warehouseStocks };
            const curWhQty = Number(nextWhMap[targetWh] || 0);
            nextWhMap[targetWh] = Math.max(0, curWhQty - txn.quantity);
            updatedItem = { ...updatedItem, warehouseStocks: nextWhMap };
          }
        } else {
          let newQty = item.quantity;
          if (txn.type === 'IN' || txn.type === 'RETURN') {
            newQty += txn.quantity;
          }
          const updatedStatus: StockItem['status'] = newQty === 0 ? 'Out of Stock' : (newQty <= item.reorderThreshold ? 'Low Stock' : 'In Stock');
          updatedItem = {
            ...item,
            quantity: newQty,
            status: updatedStatus
          };
          if (item.warehouseStocks && Object.keys(item.warehouseStocks).length > 0) {
            const nextWhMap = { ...item.warehouseStocks };
            nextWhMap[targetWh] = Number(nextWhMap[targetWh] || 0) + txn.quantity;
            updatedItem = { ...updatedItem, warehouseStocks: nextWhMap };
          }
        }
        if (settings.firebaseConnected) saveRecordToFirestore('items', updatedItem.id, updatedItem);
        return updatedItem;
      }
      return item;
    }));
  };

  const handleAddSupplier = (newSup: Omit<Supplier, 'id' | 'activeItems' | 'status'>) => {
    const id = `SUP-${Date.now().toString().slice(-6)}-${Math.floor(10 + Math.random() * 90)}`;
    const completeSup: Supplier = {
      ...newSup,
      id,
      activeItems: 0,
      status: 'Active'
    };
    setSuppliers(prev => [...prev, completeSup]);
    if (settings.firebaseConnected) saveRecordToFirestore('suppliers', completeSup.id, completeSup);
  };

  const handleAddCategory = (newCat: Omit<Category, 'id' | 'count'>) => {
    const id = `CAT-${Date.now().toString().slice(-6)}-${Math.floor(10 + Math.random() * 90)}`;
    const completeCat: Category = {
      ...newCat,
      id,
      count: 0
    };
    setCategories(prev => [...prev, completeCat]);
    if (settings.firebaseConnected) saveRecordToFirestore('categories', completeCat.id, completeCat);
  };

  const handleUpdateCategory = (updatedCat: Category, oldName: string) => {
    setCategories(prev => prev.map(c => c.id === updatedCat.id ? updatedCat : c));
    if (settings.firebaseConnected) saveRecordToFirestore('categories', updatedCat.id, updatedCat);
    if (updatedCat.name !== oldName) {
      setItems(prev => prev.map(item => {
        if (item.category === oldName) {
          const updatedItem = { ...item, category: updatedCat.name };
          if (settings.firebaseConnected) saveRecordToFirestore('items', updatedItem.id, updatedItem);
          return updatedItem;
        }
        return item;
      }));
    }
  };

  const handleDeleteCategory = (id: string) => {
    setCategories(prev => prev.filter(c => c.id !== id));
    if (settings.firebaseConnected) deleteRecordFromFirestore('categories', id);
  };

  const handleUpdateSupplier = (updatedSup: Supplier, oldName: string) => {
    setSuppliers(prev => prev.map(s => s.id === updatedSup.id ? updatedSup : s));
    if (settings.firebaseConnected) saveRecordToFirestore('suppliers', updatedSup.id, updatedSup);
    if (updatedSup.name !== oldName) {
      setItems(prev => prev.map(item => {
        if (item.supplier === oldName) {
          const updatedItem = { ...item, supplier: updatedSup.name };
          if (settings.firebaseConnected) saveRecordToFirestore('items', updatedItem.id, updatedItem);
          return updatedItem;
        }
        return item;
      }));
    }
  };

  const handleDeleteSupplier = (id: string) => {
    setSuppliers(prev => prev.filter(s => s.id !== id));
    if (settings.firebaseConnected) deleteRecordFromFirestore('suppliers', id);
  };

  const handleUpdateTransaction = (updatedTxn: StockTransaction) => {
    const oldTxn = transactions.find(t => t.id === updatedTxn.id);
    if (!oldTxn) return;
    
    // Reverse old transaction effect
    let itemEffects: Record<string, number> = { [oldTxn.itemId]: 0 };
    if (oldTxn.type === 'IN' || oldTxn.type === 'RETURN') itemEffects[oldTxn.itemId] -= oldTxn.quantity;
    if (oldTxn.type === 'OUT') itemEffects[oldTxn.itemId] += oldTxn.quantity;

    // Apply new transaction effect
    if (updatedTxn.type === 'IN' || updatedTxn.type === 'RETURN') itemEffects[updatedTxn.itemId] = (itemEffects[updatedTxn.itemId] || 0) + updatedTxn.quantity;
    if (updatedTxn.type === 'OUT') itemEffects[updatedTxn.itemId] = (itemEffects[updatedTxn.itemId] || 0) - updatedTxn.quantity;

    const completeUpdatedTxn: StockTransaction = {
      ...updatedTxn,
      totalPrice: updatedTxn.quantity * updatedTxn.unitPrice
    };
    setTransactions(prev => prev.map(t => t.id === updatedTxn.id ? completeUpdatedTxn : t));
    if (settings.firebaseConnected) saveRecordToFirestore('transactions', completeUpdatedTxn.id, completeUpdatedTxn);

    // Update items quantities and sync modified items to Firestore
    setItems(prev => prev.map(item => {
      if (itemEffects[item.id] !== undefined && itemEffects[item.id] !== 0) {
        const newQty = Math.max(0, item.quantity + itemEffects[item.id]);
        const updatedStatus: StockItem['status'] = newQty === 0 ? 'Out of Stock' : (newQty <= item.reorderThreshold ? 'Low Stock' : 'In Stock');
        const updatedItem: StockItem = { ...item, quantity: newQty, status: updatedStatus };
        if (settings.firebaseConnected) saveRecordToFirestore('items', updatedItem.id, updatedItem);
        return updatedItem;
      }
      return item;
    }));
  };

  const handleDeleteTransaction = (id: string) => {
    const oldTxn = transactions.find(t => t.id === id);
    if (!oldTxn) return;

    setTransactions(prev => prev.filter(t => t.id !== id));
    if (settings.firebaseConnected) deleteRecordFromFirestore('transactions', id);
    
    // Reverse transaction effect
    setItems(prev => prev.map(item => {
      if (item.id === oldTxn.itemId) {
        let newQty = item.quantity;
        if (oldTxn.type === 'IN' || oldTxn.type === 'RETURN') newQty = Math.max(0, newQty - oldTxn.quantity);
        if (oldTxn.type === 'OUT') newQty += oldTxn.quantity;
        const updatedStatus: StockItem['status'] = newQty === 0 ? 'Out of Stock' : (newQty <= item.reorderThreshold ? 'Low Stock' : 'In Stock');
        const updatedItem: StockItem = { ...item, quantity: newQty, status: updatedStatus };
        if (settings.firebaseConnected) saveRecordToFirestore('items', updatedItem.id, updatedItem);
        return updatedItem;
      }
      return item;
    }));
  };

  const handleAddWholesaler = (w: Omit<Wholesaler, 'id' | 'totalDue'>): Wholesaler => {
    const id = `CUST-${Date.now().toString().slice(-6)}-${Math.floor(10 + Math.random() * 90)}`;
    const newW: Wholesaler = { ...w, id, totalDue: 0 };
    setWholesalers(prev => [...prev, newW]);
    if (settings.firebaseConnected) saveRecordToFirestore('wholesalers', id, newW);
    logAudit('Add Buyer', 'Buyers', `Added wholesale buyer ${newW.name}`, id);
    return newW;
  };

  const handleUpdateWholesaler = (w: Wholesaler) => {
    setWholesalers(prev => prev.map(x => x.id === w.id ? w : x));
    if (settings.firebaseConnected) saveRecordToFirestore('wholesalers', w.id, w);
    logAudit('Update Buyer', 'Buyers', `Updated buyer profile ${w.name}`, w.id);
  };

  const handleDeleteWholesaler = (id: string) => {
    const target = wholesalers.find(w => w.id === id);
    setWholesalers(prev => prev.filter(w => w.id !== id));
    if (settings.firebaseConnected) deleteRecordFromFirestore('wholesalers', id);
    const linkedUsers = users.filter(u => u.role === 'customer' && u.wholesalerId === id);
    if (linkedUsers.length) {
      setUsers(prev => prev.filter(u => !(u.role === 'customer' && u.wholesalerId === id)));
      if (settings.firebaseConnected) {
        linkedUsers.forEach(u => deleteRecordFromFirestore('users', u.id));
      }
    }
    logAudit('Delete Buyer', 'Buyers', `Deleted wholesale buyer ${target?.name || id}`, id);
  };

  const handleUpdateWholesalerDue = (id: string, amount: number) => {
    setWholesalers(prev => prev.map(w => {
      if (w.id === id) {
        const updatedW = { ...w, totalDue: w.totalDue + amount };
        if (settings.firebaseConnected) saveRecordToFirestore('wholesalers', id, updatedW);
        return updatedW;
      }
      return w;
    }));
  };

  const handleAddAccountTxn = (txn: Omit<AccountTxn, 'id'>) => {
    const id = `ACT-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
    const newTxn = { ...txn, id };
    setAccountTxns(prev => [newTxn, ...prev]);
    if (settings.firebaseConnected) saveRecordToFirestore('accountTxns', id, newTxn);
  };

  const handleAddInvoice = (inv: Omit<Invoice, 'id'>): Invoice => {
    const id = `INV-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
    const newInv: Invoice = {
      ...inv,
      id,
      createdByUserId: inv.createdByUserId || currentUser?.userId || currentUserId || undefined,
      createdByName: inv.createdByName || currentUser?.name || userName || undefined,
      authorizedSignatureMode:
        inv.authorizedSignatureMode || (currentUser?.signatureDataUrl ? 'manual' : 'auto'),
      authorizedSignerName:
        inv.authorizedSignerName || currentUser?.name || userName || undefined,
      authorizedSignerTitle:
        inv.authorizedSignerTitle || currentUser?.signatureTitle || undefined,
      authorizedSignatureDataUrl:
        inv.authorizedSignatureDataUrl ?? currentUser?.signatureDataUrl,
    };
    
    // Update due: net change is (current invoice bill - paidAmount)
    const currentBill = inv.subTotal || inv.items.reduce((s, it) => s + it.total, 0);
    const netDueChange = currentBill - inv.paidAmount;
    if (netDueChange !== 0 && inv.wholesalerId) {
      handleUpdateWholesalerDue(inv.wholesalerId, netDueChange);
    }
    
    // Save invoice
    setInvoices(prev => [newInv, ...prev]);
    if (settings.firebaseConnected) saveRecordToFirestore('invoices', id, newInv);

    // Handle initial payment received at checkout
    if (inv.paidAmount > 0) {
      handleAddAccountTxn({
        date: inv.date,
        type: 'IN',
        amount: inv.paidAmount,
        reference: inv.chalanNo,
        description: `Advance/Cash paid for Sale ${inv.chalanNo}`,
        wholesalerId: inv.wholesalerId || undefined,
        receiptNo: `RCPT-${inv.chalanNo}`,
        paymentMethod: inv.paymentMethod || 'Cash'
      });
    }

    // Deduct stock for each item sold (paid qty + bonus free qty) & Log OUT transaction
    inv.items.forEach(soldItem => {
      const totalUnitsOut = getInvoiceItemTotalQty(soldItem);
      const bonusNote = (soldItem.bonusQty || 0) > 0 ? ` [+${soldItem.bonusQty} Free]` : '';
      handleAddTransaction({
        itemId: soldItem.itemId,
        itemName: soldItem.itemName,
        type: 'OUT',
        quantity: totalUnitsOut,
        unitPrice: soldItem.unitPrice,
        date: inv.date,
        user: userName,
        reference: inv.chalanNo,
        notes: `${inv.saleType === 'Retail' ? 'Retail POS Sale' : 'Wholesale Sale'}${bonusNote}${inv.warehouseName ? ` (${inv.warehouseName})` : ''}`
      }, inv.warehouseName);
    });

    logAudit('Create Invoice', 'Sales', `Created Chalan ${newInv.chalanNo} for ${newInv.wholesalerName} (${newInv.items.length} items)`, id);
    return newInv;
  };

  const handleUpdateInvoice = (updatedInv: Invoice) => {
    const oldInv = invoices.find(i => i.id === updatedInv.id);
    if (!oldInv) return;

    // 1. Calculate net due difference and update wholesaler due
    const oldBill = oldInv.subTotal || oldInv.items.reduce((s, it) => s + it.total, 0);
    const oldNetDue = oldBill - oldInv.paidAmount;
    const newBill = updatedInv.subTotal || updatedInv.items.reduce((s, it) => s + it.total, 0);
    const newNetDue = newBill - updatedInv.paidAmount;
    const diff = newNetDue - oldNetDue;
    if (diff !== 0 && updatedInv.wholesalerId) {
      handleUpdateWholesalerDue(updatedInv.wholesalerId, diff);
    }

    // 2. Revert old stock items and apply new stock items only when items actually changed
    const itemsChanged = JSON.stringify(oldInv.items) !== JSON.stringify(updatedInv.items);
    if (itemsChanged) {
      const affectedIds = new Set<string>([
        ...oldInv.items.map(i => i.itemId),
        ...updatedInv.items.map(i => i.itemId),
      ]);
      setItems(prev => {
        let updatedItems = [...prev];
        // Restore old items (including bonus/free qty)
        oldInv.items.forEach(oldItem => {
          const restoreQty = getInvoiceItemTotalQty(oldItem);
          updatedItems = updatedItems.map(item => {
            if (item.id === oldItem.itemId) {
              const newQty = item.quantity + restoreQty;
              const updatedStatus = newQty === 0 ? 'Out of Stock' : (newQty <= item.reorderThreshold ? 'Low Stock' : 'In Stock');
              return { ...item, quantity: newQty, status: updatedStatus };
            }
            return item;
          });
        });
        // Deduct new items (including bonus/free qty)
        updatedInv.items.forEach(newItem => {
          const deductQty = getInvoiceItemTotalQty(newItem);
          updatedItems = updatedItems.map(item => {
            if (item.id === newItem.itemId) {
              const newQty = Math.max(0, item.quantity - deductQty);
              const updatedStatus = newQty === 0 ? 'Out of Stock' : (newQty <= item.reorderThreshold ? 'Low Stock' : 'In Stock');
              return { ...item, quantity: newQty, status: updatedStatus };
            }
            return item;
          });
        });
        if (settings.firebaseConnected) {
          updatedItems.forEach(it => {
            if (affectedIds.has(it.id)) {
              saveRecordToFirestore('items', it.id, it);
            }
          });
        }
        return updatedItems;
      });
    }

    // 3. Update Invoice in state
    setInvoices(prev => prev.map(inv => inv.id === updatedInv.id ? updatedInv : inv));
    if (settings.firebaseConnected) saveRecordToFirestore('invoices', updatedInv.id, updatedInv);

    // 4. Update account transaction ledger for cash advance and sync to Firestore
    if (oldInv.paidAmount !== updatedInv.paidAmount) {
      const existingTxn = accountTxns.find(t => t.reference === oldInv.chalanNo);
      if (existingTxn) {
        if (updatedInv.paidAmount <= 0) {
          setAccountTxns(prev => prev.filter(t => t.reference !== oldInv.chalanNo));
          if (settings.firebaseConnected) {
            deleteRecordFromFirestore('accountTxns', existingTxn.id);
          }
        } else {
          const updatedActTxn: AccountTxn = { ...existingTxn, amount: updatedInv.paidAmount };
          setAccountTxns(prev => prev.map(t => (t.id === existingTxn.id ? updatedActTxn : t)));
          if (settings.firebaseConnected) {
            saveRecordToFirestore('accountTxns', existingTxn.id, updatedActTxn);
          }
        }
      } else if (updatedInv.paidAmount > 0) {
        const newActTxn: AccountTxn = {
          id: `ACT-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`,
          date: updatedInv.date,
          type: 'IN',
          amount: updatedInv.paidAmount,
          reference: updatedInv.chalanNo,
          wholesalerId: updatedInv.wholesalerId || undefined,
          receiptNo: `RCPT-${updatedInv.chalanNo}`,
          paymentMethod: updatedInv.paymentMethod || 'Cash',
          description: `Advance/Cash paid for Sale ${updatedInv.chalanNo}`
        };
        setAccountTxns(prev => [newActTxn, ...prev]);
        if (settings.firebaseConnected) {
          saveRecordToFirestore('accountTxns', newActTxn.id, newActTxn);
        }
      }
    }
  };

  const handleDeleteInvoice = (id: string) => {
    const oldInv = invoices.find(i => i.id === id);
    if (!oldInv) return;

    // 1. Reverse net due change generated by this chalan
    const oldBill = oldInv.subTotal || oldInv.items.reduce((s, it) => s + it.total, 0);
    const oldNetDue = oldBill - oldInv.paidAmount;
    if (oldNetDue !== 0 && oldInv.wholesalerId) {
      handleUpdateWholesalerDue(oldInv.wholesalerId, -oldNetDue);
    }

    // 2. Restore stock items (paid qty + bonus free qty) & sync to Firestore
    const restoredItemIds = new Set(oldInv.items.map(i => i.itemId));
    setItems(prev => {
      let updatedItems = [...prev];
      oldInv.items.forEach(oldItem => {
        const restoreQty = getInvoiceItemTotalQty(oldItem);
        updatedItems = updatedItems.map(item => {
          if (item.id === oldItem.itemId) {
            const newQty = item.quantity + restoreQty;
            const updatedStatus = newQty === 0 ? 'Out of Stock' : (newQty <= item.reorderThreshold ? 'Low Stock' : 'In Stock');
            return { ...item, quantity: newQty, status: updatedStatus };
          }
          return item;
        });
      });
      if (settings.firebaseConnected) {
        updatedItems.forEach(it => {
          if (restoredItemIds.has(it.id)) {
            saveRecordToFirestore('items', it.id, it);
          }
        });
      }
      return updatedItems;
    });

    // 3. Remove cash ledger entry if any & delete from Firestore
    const matchingActTxns = accountTxns.filter(t => t.reference === oldInv.chalanNo);
    setAccountTxns(prev => prev.filter(t => t.reference !== oldInv.chalanNo));
    if (settings.firebaseConnected) {
      matchingActTxns.forEach(t => deleteRecordFromFirestore('accountTxns', t.id));
    }

    // 4. Remove invoice
    setInvoices(prev => prev.filter(inv => inv.id !== id));
    if (settings.firebaseConnected) deleteRecordFromFirestore('invoices', id);
    logAudit('Delete Invoice', 'Sales', `Deleted Chalan ${oldInv.chalanNo} (${oldInv.wholesalerName})`, id);
  };

  // --- EXPENSE HANDLERS ---
  const handleAddExpense = (exp: Omit<Expense, 'id'>) => {
    const id = `EXP-${Date.now().toString().slice(-6)}-${Math.floor(10 + Math.random() * 90)}`;
    const newExp = { ...exp, id };
    setExpenses(prev => [newExp, ...prev]);
    if (settings.firebaseConnected) saveRecordToFirestore('expenses', id, newExp);

    // Auto log expense to cash ledger as CASH OUT
    handleAddAccountTxn({
      date: exp.date,
      type: 'OUT',
      amount: exp.amount,
      reference: id,
      description: `Expense: ${exp.category} - ${exp.description}`
    });
  };

  const handleUpdateExpense = (exp: Expense) => {
    setExpenses(prev => prev.map(x => x.id === exp.id ? exp : x));
    if (settings.firebaseConnected) saveRecordToFirestore('expenses', exp.id, exp);
  };

  const handleDeleteExpense = (id: string) => {
    setExpenses(prev => prev.filter(x => x.id !== id));
    if (settings.firebaseConnected) deleteRecordFromFirestore('expenses', id);
  };

  // --- PURCHASE ORDER HANDLERS ---
  const handleAddPO = (po: Omit<PurchaseOrder, 'id'>) => {
    const id = `PO-${Date.now().toString().slice(-6)}-${Math.floor(10 + Math.random() * 90)}`;
    const newPO = { ...po, id };
    setPurchaseOrders(prev => [newPO, ...prev]);
    if (settings.firebaseConnected) saveRecordToFirestore('purchase_orders', id, newPO);
  };

  const handleUpdatePO = (po: PurchaseOrder) => {
    setPurchaseOrders(prev => prev.map(x => x.id === po.id ? po : x));
    if (settings.firebaseConnected) saveRecordToFirestore('purchase_orders', po.id, po);
  };

  const handleDeletePO = (id: string) => {
    setPurchaseOrders(prev => prev.filter(x => x.id !== id));
    if (settings.firebaseConnected) deleteRecordFromFirestore('purchase_orders', id);
  };

  const handleReceivePOItems = (po: PurchaseOrder) => {
    // Restock each product in the PO
    po.items.forEach(poItem => {
      const matchedItem = items.find(i => i.id === poItem.itemId);
      handleAddTransaction({
        itemId: poItem.itemId,
        itemName: poItem.itemName,
        type: 'IN',
        quantity: poItem.quantity,
        unitPrice: poItem.costPrice,
        date: new Date().toISOString(),
        user: userName,
        reference: po.poNo,
        supplierName: po.supplierName,
        category: matchedItem?.category,
        notes: `PO Received from ${po.supplierName}`
      });
    });

    // Mark PO status as Received
    const updatedPO: PurchaseOrder = { ...po, status: 'Received' };
    handleUpdatePO(updatedPO);
    logAudit('Receive PO', 'Inventory', `Received PO ${po.poNo} from ${po.supplierName}`, po.id);
  };

  // --- SUPPLIER DUE PAYMENT, MULTI-ITEM PURCHASE BILL & RETURN HANDLERS ---
  const handlePaySupplierDue = (params: {
    supplierId: string;
    amount: number;
    paymentMethod: SupplierPayment['paymentMethod'];
    date: string;
    reference?: string;
    notes?: string;
  }): SupplierPayment | null => {
    const targetSupplier = suppliers.find((s) => s.id === params.supplierId);
    const payAmt = Math.max(0, Number(params.amount || 0));
    if (!targetSupplier || payAmt <= 0) return null;

    const id = `SP-${Date.now().toString().slice(-6)}-${Math.floor(10 + Math.random() * 90)}`;
    const receiptNo = `SP-${Date.now().toString().slice(-6)}`;
    const payment: SupplierPayment = {
      id,
      receiptNo,
      supplierId: targetSupplier.id,
      supplierName: targetSupplier.name,
      date: params.date || getLocalYYYYMMDD(),
      amount: payAmt,
      paymentMethod: params.paymentMethod,
      reference: params.reference || undefined,
      notes: params.notes || undefined,
      createdByName: userName,
    };

    setSupplierPayments((prev) => [payment, ...prev]);
    if (settings.firebaseConnected) saveRecordToFirestore('supplier_payments', id, payment);

    setSuppliers((prev) =>
      prev.map((s) => {
        if (s.id !== targetSupplier.id) return s;
        const updatedSup: Supplier = {
          ...s,
          totalDue: Math.max(0, Number(s.totalDue || 0) - payAmt),
        };
        if (settings.firebaseConnected) saveRecordToFirestore('suppliers', s.id, updatedSup);
        return updatedSup;
      })
    );

    handleAddAccountTxn({
      date: payment.date,
      type: 'OUT',
      amount: payAmt,
      reference: params.reference || receiptNo,
      supplierId: targetSupplier.id,
      receiptNo,
      paymentMethod: params.paymentMethod,
      description: `Supplier Payment to ${targetSupplier.name} (${receiptNo})`,
    });

    logAudit(
      'Supplier Due Payment',
      'Accounts',
      `Paid ${settings.currency.split(' ')[0]} ${payAmt} to ${targetSupplier.name} (${receiptNo})`,
      id
    );
    return payment;
  };

  const handleCreatePurchaseBill = (
    billInput: Omit<PurchaseBill, 'id' | 'createdByName'>
  ): PurchaseBill => {
    const id = `PB-${Date.now().toString().slice(-6)}-${Math.floor(10 + Math.random() * 90)}`;
    const targetWh = billInput.warehouseName || activeWarehouses[0] || 'Main Warehouse';
    const newBill: PurchaseBill = {
      ...billInput,
      id,
      warehouseName: targetWh,
      createdByName: userName,
    };

    // 1. Save bill
    setPurchaseBills((prev) => [newBill, ...prev]);
    if (settings.firebaseConnected) saveRecordToFirestore('purchase_bills', id, newBill);

    // 2. Atomically restock all purchased items (including bonus units), batches, and warehouses
    const generatedTxns: StockTransaction[] = [];
    setItems((prevItems) => {
      const nextMap = new Map(prevItems.map((it) => [it.id, { ...it }]));
      newBill.items.forEach((line, idx) => {
        const existing = nextMap.get(line.itemId);
        if (!existing) return;
        const addedUnits = Math.max(0, Number(line.quantity || 0)) + Math.max(0, Number(line.bonusQty || 0));
        if (addedUnits <= 0) return;

        const prevQty = Number(existing.quantity || 0);
        const newQty = prevQty + addedUnits;
        const nextBatches = [...(existing.batches || [])];
        const lineBatch = (line.batchNo || existing.batchNo || `B-${newBill.billNo}`).trim();
        const lineExp = line.expiryDate || existing.expiryDate;
        const lineMfg = line.mfgDate || existing.mfgDate;
        const matchedBatchIdx = nextBatches.findIndex(
          (b) => b.batchNo === lineBatch && (b.expiryDate || '') === (lineExp || '')
        );
        if (matchedBatchIdx >= 0) {
          nextBatches[matchedBatchIdx] = {
            ...nextBatches[matchedBatchIdx],
            quantity: nextBatches[matchedBatchIdx].quantity + addedUnits,
            mfgDate: lineMfg || nextBatches[matchedBatchIdx].mfgDate,
          };
        } else {
          nextBatches.push({
            id: `BTH-${Date.now().toString().slice(-6)}-${idx}`,
            batchNo: lineBatch,
            mfgDate: lineMfg,
            expiryDate: lineExp,
            quantity: addedUnits,
          });
        }

        const primaryWh = activeWarehouses[0] || 'Main Warehouse';
        const nextWhMap: Record<string, number> = {
          ...(existing.warehouseStocks && Object.keys(existing.warehouseStocks).length > 0
            ? existing.warehouseStocks
            : { [primaryWh]: prevQty }),
        };
        nextWhMap[targetWh] = Number(nextWhMap[targetWh] || 0) + addedUnits;

        const nextStatus: StockItem['status'] =
          newQty === 0
            ? 'Out of Stock'
            : newQty <= existing.reorderThreshold
            ? 'Low Stock'
            : 'In Stock';

        const updatedItem: StockItem = {
          ...existing,
          quantity: newQty,
          costPrice: line.costPrice > 0 ? line.costPrice : existing.costPrice,
          supplier: newBill.supplierName || existing.supplier,
          batchNo: line.batchNo || existing.batchNo,
          mfgDate: line.mfgDate || existing.mfgDate,
          expiryDate: line.expiryDate || existing.expiryDate,
          batches: nextBatches,
          warehouseStocks: nextWhMap,
          status: nextStatus,
        };
        nextMap.set(existing.id, updatedItem);
        if (settings.firebaseConnected) {
          saveRecordToFirestore('items', existing.id, updatedItem);
        }

        const txn: StockTransaction = {
          id: `TXN-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}-${idx}`,
          itemId: existing.id,
          itemName: existing.name,
          type: 'IN',
          quantity: addedUnits,
          unitPrice: line.costPrice,
          totalPrice: line.total,
          date: getFormattedLocalDateTime(newBill.date),
          user: userName,
          reference: newBill.billNo,
          supplierName: newBill.supplierName,
          category: line.category || existing.category,
          notes: `Purchase Bill ${newBill.billNo}${
            (line.bonusQty || 0) > 0 ? ` (+${line.bonusQty} Free)` : ''
          } (${targetWh})`,
        };
        generatedTxns.push(txn);
      });
      return Array.from(nextMap.values());
    });

    if (generatedTxns.length > 0) {
      setTransactions((prev) => [...generatedTxns, ...prev]);
      if (settings.firebaseConnected) {
        generatedTxns.forEach((t) => saveRecordToFirestore('transactions', t.id, t));
      }
    }

    // 3. Increment Supplier payable due if bill has unpaid balance
    if (newBill.dueAmount > 0 && newBill.supplierId) {
      setSuppliers((prev) =>
        prev.map((s) => {
          if (s.id !== newBill.supplierId) return s;
          const updatedSup: Supplier = {
            ...s,
            totalDue: Number(s.totalDue || 0) + newBill.dueAmount,
          };
          if (settings.firebaseConnected) saveRecordToFirestore('suppliers', s.id, updatedSup);
          return updatedSup;
        })
      );
    }

    // 4. Record cash outflow if any upfront payment made
    if (newBill.paidAmount > 0) {
      handleAddAccountTxn({
        date: newBill.date,
        type: 'OUT',
        amount: newBill.paidAmount,
        reference: newBill.billNo,
        supplierId: newBill.supplierId,
        receiptNo: `PAY-${newBill.billNo}`,
        paymentMethod: newBill.paymentMethod || 'Cash',
        description: `Purchase Bill Paid to ${newBill.supplierName} (${newBill.billNo})`,
      });
    }

    logAudit(
      'Create Purchase Bill',
      'Inventory',
      `Created Purchase Bill ${newBill.billNo} from ${newBill.supplierName} (${newBill.items.length} items, Total ৳${newBill.totalAmount})`,
      id
    );
    return newBill;
  };

  const handleDeletePurchaseBill = (billId: string) => {
    const target = purchaseBills.find((b) => b.id === billId);
    if (!target) return;

    setPurchaseBills((prev) => prev.filter((b) => b.id !== billId));
    if (settings.firebaseConnected) deleteRecordFromFirestore('purchase_bills', billId);

    // Rollback supplier due created by this bill
    if (target.dueAmount > 0 && target.supplierId) {
      setSuppliers((prev) =>
        prev.map((s) => {
          if (s.id !== target.supplierId) return s;
          const updatedSup: Supplier = {
            ...s,
            totalDue: Math.max(0, Number(s.totalDue || 0) - target.dueAmount),
          };
          if (settings.firebaseConnected) saveRecordToFirestore('suppliers', s.id, updatedSup);
          return updatedSup;
        })
      );
    }

    // Rollback stock added by bill
    setItems((prev) =>
      prev.map((item) => {
        const matchedLines = target.items.filter((l) => l.itemId === item.id);
        if (matchedLines.length === 0) return item;
        const removeQty = matchedLines.reduce(
          (sum, l) => sum + Number(l.quantity || 0) + Number(l.bonusQty || 0),
          0
        );
        const res = deductFromBatchesFEFO(item, removeQty);
        if (settings.firebaseConnected) saveRecordToFirestore('items', item.id, res.updatedItem);
        return res.updatedItem;
      })
    );

    const matchingBillActTxns = accountTxns.filter((t) => t.reference === target.billNo);
    setAccountTxns((prev) => prev.filter((t) => t.reference !== target.billNo));
    if (settings.firebaseConnected) {
      matchingBillActTxns.forEach((t) => deleteRecordFromFirestore('accountTxns', t.id));
    }
    logAudit('Delete Purchase Bill', 'Inventory', `Deleted Purchase Bill ${target.billNo}`, billId);
  };

  const handleCreatePurchaseReturn = (
    retInput: Omit<PurchaseReturn, 'id' | 'createdByName'>
  ): PurchaseReturn => {
    const id = `PRET-${Date.now().toString().slice(-6)}-${Math.floor(10 + Math.random() * 90)}`;
    const targetWh = retInput.warehouseName || activeWarehouses[0] || 'Main Warehouse';
    const newRet: PurchaseReturn = {
      ...retInput,
      id,
      warehouseName: targetWh,
      createdByName: userName,
    };

    setPurchaseReturns((prev) => [newRet, ...prev]);
    if (settings.firebaseConnected) saveRecordToFirestore('purchase_returns', id, newRet);

    const outTxns: StockTransaction[] = [];
    setItems((prev) => {
      const nextMap = new Map(prev.map((it) => [it.id, { ...it }]));
      newRet.items.forEach((line, idx) => {
        const existing = nextMap.get(line.itemId);
        if (!existing || line.quantity <= 0) return;

        const fefo = deductFromBatchesFEFO(existing, line.quantity);
        let updatedItem = fefo.updatedItem;
        if (updatedItem.warehouseStocks && Object.keys(updatedItem.warehouseStocks).length > 0) {
          const whStocks = { ...updatedItem.warehouseStocks };
          whStocks[targetWh] = Math.max(0, Number(whStocks[targetWh] || 0) - line.quantity);
          updatedItem = { ...updatedItem, warehouseStocks: whStocks };
        }
        nextMap.set(existing.id, updatedItem);
        if (settings.firebaseConnected) saveRecordToFirestore('items', existing.id, updatedItem);

        outTxns.push({
          id: `TXN-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}-${idx}`,
          itemId: existing.id,
          itemName: existing.name,
          type: 'OUT',
          quantity: line.quantity,
          unitPrice: line.costPrice,
          totalPrice: line.total,
          date: getFormattedLocalDateTime(newRet.date),
          user: userName,
          reference: newRet.returnNo,
          supplierName: newRet.supplierName,
          category: existing.category,
          notes: `Purchase Return to ${newRet.supplierName}: ${newRet.reason}`,
        });
      });
      return Array.from(nextMap.values());
    });

    if (outTxns.length > 0) {
      setTransactions((prev) => [...outTxns, ...prev]);
      if (settings.firebaseConnected) {
        outTxns.forEach((t) => saveRecordToFirestore('transactions', t.id, t));
      }
    }

    if (newRet.totalAmount > 0 && newRet.supplierId) {
      setSuppliers((prev) =>
        prev.map((s) => {
          if (s.id !== newRet.supplierId) return s;
          const updatedSup: Supplier = {
            ...s,
            totalDue: Math.max(0, Number(s.totalDue || 0) - newRet.totalAmount),
          };
          if (settings.firebaseConnected) saveRecordToFirestore('suppliers', s.id, updatedSup);
          return updatedSup;
        })
      );
    }

    logAudit(
      'Purchase Return',
      'Inventory',
      `Returned ${newRet.items.length} item(s) to ${newRet.supplierName} (${newRet.returnNo}, ৳${newRet.totalAmount})`,
      id
    );
    return newRet;
  };

  // --- DAMAGED / EXPIRED STOCK HANDLERS ---
  const handleAddDamagedStock = (dmg: Omit<DamagedStock, 'id'>) => {
    const id = `DMG-${Date.now().toString().slice(-6)}-${Math.floor(10 + Math.random() * 90)}`;
    const newDmg = { ...dmg, id };
    setDamagedStockList(prev => [newDmg, ...prev]);
    if (settings.firebaseConnected) saveRecordToFirestore('damaged_stock', id, newDmg);

    // Auto-deduct stock from inventory & log transaction
    handleAddTransaction({
      itemId: dmg.itemId,
      itemName: dmg.itemName,
      type: 'OUT',
      quantity: dmg.quantity,
      unitPrice: dmg.costValue / (dmg.quantity || 1),
      date: dmg.date,
      user: userName,
      reference: id,
      notes: `Write-Off: ${dmg.reason} (${dmg.notes || ''})`
    });
  };

  const handleDeleteDamagedStock = (id: string) => {
    setDamagedStockList(prev => prev.filter(x => x.id !== id));
    if (settings.firebaseConnected) deleteRecordFromFirestore('damaged_stock', id);
  };

  // --- MULTI-WAREHOUSE TRANSFER HANDLER ---
  const handleTransferWarehouseStock = (params: {
    itemId: string;
    fromWarehouse: string;
    toWarehouse: string;
    quantity: number;
    date: string;
    notes: string;
  }): { success: boolean; message?: string } => {
    const targetItem = items.find(i => i.id === params.itemId);
    if (!targetItem) {
      return { success: false, message: 'Selected product was not found.' };
    }
    const res = applyWarehouseTransfer(
      targetItem,
      params.fromWarehouse,
      params.toWarehouse,
      params.quantity,
      activeWarehouses
    );
    if (!res.success || !res.updatedItem) {
      return { success: false, message: res.message || 'Transfer failed.' };
    }

    setItems(prev => prev.map(i => (i.id === targetItem.id ? res.updatedItem! : i)));
    if (settings.firebaseConnected) {
      saveRecordToFirestore('items', targetItem.id, res.updatedItem);
    }

    const id = `TRF-${Date.now().toString().slice(-6)}-${Math.floor(10 + Math.random() * 90)}`;
    const transferNo = `TRF-${Date.now().toString().slice(-6)}`;
    const record: StockTransfer = {
      id,
      transferNo,
      itemId: targetItem.id,
      itemName: targetItem.name,
      sku: targetItem.sku,
      fromWarehouse: params.fromWarehouse,
      toWarehouse: params.toWarehouse,
      quantity: params.quantity,
      date: params.date,
      user: userName,
      notes: params.notes || undefined,
    };
    setStockTransfers(prev => [record, ...prev]);
    if (settings.firebaseConnected) saveRecordToFirestore('stock_transfers', id, record);
    logAudit('Warehouse Transfer', 'Transfers', `Moved ${params.quantity} ${targetItem.unit} of ${targetItem.name} (${params.fromWarehouse} -> ${params.toWarehouse})`, id);
    return { success: true };
  };

  // --- SALES REPRESENTATIVE (SR / DSR) HANDLERS ---
  const handleAddSalesRep = (rep: Omit<SalesRep, 'id'>) => {
    const id = `SR-${Date.now().toString().slice(-6)}-${Math.floor(10 + Math.random() * 90)}`;
    const newRep: SalesRep = { ...rep, id };
    setSalesReps(prev => [newRep, ...prev]);
    if (settings.firebaseConnected) saveRecordToFirestore('sales_reps', id, newRep);
    logAudit('Add Sales Rep', 'SalesReps', `Added SR ${newRep.name} (${newRep.area}, ${newRep.commissionRate}%)`, id);
  };

  const handleUpdateSalesRep = (rep: SalesRep) => {
    setSalesReps(prev => prev.map(r => (r.id === rep.id ? rep : r)));
    if (settings.firebaseConnected) saveRecordToFirestore('sales_reps', rep.id, rep);
    logAudit('Update Sales Rep', 'SalesReps', `Updated SR ${rep.name}`, rep.id);
  };

  const handleDeleteSalesRep = (id: string) => {
    const target = salesReps.find(r => r.id === id);
    setSalesReps(prev => prev.filter(r => r.id !== id));
    if (settings.firebaseConnected) deleteRecordFromFirestore('sales_reps', id);
    logAudit('Delete Sales Rep', 'SalesReps', `Removed SR ${target?.name || id}`, id);
  };

  const handleClearAuditLogs = () => {
    setAuditLogs([]);
    localStorage.removeItem('stock_erp_audit_logs');
    if (settings.firebaseConnected) {
      clearFirestoreCollection('audit_logs');
    }
  };

  const handleUpdateSettings = async (
    newSettings: SystemSettings
  ): Promise<{ success: boolean; error?: string }> => {
    setSettings(newSettings);
    persistSettingsLocally(newSettings);
    logAudit('Update Settings', 'Settings', `Updated system configuration & brand settings`, 'config');
    if (newSettings.firebaseConnected) {
      initFirebase(newSettings);
      const saveRes = await saveRecordToFirestore('settings', 'config', newSettings);
      if (!saveRes.success) {
        setAppNotice({
          type: 'error',
          text: `Saved locally, but Firebase Cloud sync failed: ${saveRes.error || 'Check Firestore rules or image size.'}`,
        });
      }
      return saveRes;
    }
    return { success: true };
  };

  const handleConnectFirebase = async (
    targetSettings: SystemSettings
  ): Promise<{ success: boolean; message: string; syncedSettings?: SystemSettings }> => {
    const testRes = await testFirebaseConnection(targetSettings);
    if (!testRes.success) {
      return { success: false, message: testRes.message };
    }

    const pullRes = await pullAllFromFirestore(targetSettings);
    if (!pullRes.success) {
      return { success: false, message: pullRes.message };
    }

    const syncedAt = new Date().toISOString();
    let finalSettings: SystemSettings;

    if (pullRes.settingsDoc) {
      // Pull-first merge: preserve existing remote store branding/logo/phone/users on any new browser!
      finalSettings = mergeRemoteSettings(targetSettings, {
        ...pullRes.settingsDoc,
        firebaseConnected: true,
        firebaseLastSync: syncedAt,
      });
      applyRemoteCollections(pullRes, false);
    } else {
      // Fresh Firestore project with no config yet: upload current local branding & settings cleanly
      finalSettings = {
        ...targetSettings,
        firebaseConnected: true,
        firebaseLastSync: syncedAt,
      };
      if (pullRes.totalRecords > 0) {
        applyRemoteCollections(pullRes, false);
      }
      await saveRecordToFirestore('settings', 'config', finalSettings);
    }

    // Ensure remote users collection is populated if empty so other browsers use the real accounts
    const remoteUsers = pullRes.collections.users || [];
    if (remoteUsers.length === 0 && users.length > 0) {
      await Promise.all(users.map((u) => saveRecordToFirestore('users', u.id, u)));
    }

    // If Firestore was completely blank on first connect, seed any local records already entered
    let pushedNote = '';
    if (pullRes.totalRecords === 0 && !pullRes.settingsDoc) {
      const pushRes = await pushAllToFirestore(finalSettings, {
        items,
        transactions,
        wholesalers,
        invoices,
        accountTxns,
        expenses,
        purchase_orders: purchaseOrders,
        purchase_bills: purchaseBills,
        purchase_returns: purchaseReturns,
        supplier_payments: supplierPayments,
        damaged_stock: damagedStockList,
        suppliers,
        categories,
        customer_orders: customerOrders,
        customer_returns: customerReturns,
        payment_claims: paymentClaims,
        sales_reps: salesReps,
        stock_transfers: stockTransfers,
        audit_logs: auditLogs,
        users,
      });
      if (pushRes.success && pushRes.totalUploaded > 0) {
        pushedNote = ` Uploaded ${pushRes.totalUploaded} local records & accounts to Firestore.`;
      }
    }

    setSettings(finalSettings);
    persistSettingsLocally(finalSettings);

    return {
      success: true,
      syncedSettings: finalSettings,
      message: `${testRes.message} ${pullRes.message}${pushedNote}`,
    };
  };

  const handleVerifyRemoteLogin = async (
    loginId: string,
    loginPassword: string
  ): Promise<SystemUser | null> => {
    if (!hasFirebaseCredentials(settings)) return null;
    const { user, remoteUsers } = await findRemoteUserByLogin(
      settings,
      loginId,
      loginPassword
    );
    if (remoteUsers.length > 0) {
      setUsers(remoteUsers);
    }
    return user;
  };

  const handlePullFromFirestore = async (
    targetSettings?: SystemSettings
  ): Promise<{ success: boolean; totalRecords: number; message: string }> => {
    const activeSettings = targetSettings || settings;
    const res = await pullAllFromFirestore(activeSettings);
    if (res.success) {
      applyRemoteCollections(res, false);
    }
    return {
      success: res.success,
      totalRecords: res.totalRecords,
      message: res.message,
    };
  };

  const handlePushToFirestore = async (
    targetSettings?: SystemSettings
  ): Promise<{ success: boolean; totalUploaded: number; message: string }> => {
    const activeSettings = targetSettings || settings;
    const res = await pushAllToFirestore(activeSettings, {
      items,
      transactions,
      wholesalers,
      invoices,
      accountTxns,
      expenses,
      purchase_orders: purchaseOrders,
      purchase_bills: purchaseBills,
      purchase_returns: purchaseReturns,
      supplier_payments: supplierPayments,
      damaged_stock: damagedStockList,
      suppliers,
      categories,
      customer_orders: customerOrders,
      customer_returns: customerReturns,
      payment_claims: paymentClaims,
      sales_reps: salesReps,
      stock_transfers: stockTransfers,
      audit_logs: auditLogs,
      users,
    });
    if (res.success) {
      const updated: SystemSettings = {
        ...activeSettings,
        firebaseConnected: true,
        firebaseLastSync: new Date().toISOString(),
      };
      setSettings(updated);
      persistSettingsLocally(updated);
    }
    return res;
  };

  const handleResetAllData = async () => {
    // 1. Wipe local state
    setItems([]);
    setTransactions([]);
    setWholesalers([]);
    setInvoices([]);
    setAccountTxns([]);
    setExpenses([]);
    setPurchaseOrders([]);
    setPurchaseBills([]);
    setPurchaseReturns([]);
    setSupplierPayments([]);
    setDamagedStockList([]);
    setSuppliers([]);
    setCategories([]);
    setCustomerOrders([]);
    setCustomerReturns([]);
    setPaymentClaims([]);
    setSalesReps([]);
    setStockTransfers([]);
    setAuditLogs([]);
    setUsers(prev => prev.filter(u => u.role !== 'customer'));
    initialReorderThresholdsRef.current.clear();
    prevStockQuantitiesRef.current.clear();
    setStockToasts([]);

    // 2. Clear LocalStorage
    localStorage.removeItem('stock_erp_items');
    localStorage.removeItem('stock_erp_txns');
    localStorage.removeItem('stock_erp_wholesalers');
    localStorage.removeItem('stock_erp_invoices');
    localStorage.removeItem('stock_erp_accountTxns');
    localStorage.removeItem('stock_erp_expenses');
    localStorage.removeItem('stock_erp_purchase_orders');
    localStorage.removeItem('stock_erp_purchase_bills');
    localStorage.removeItem('stock_erp_purchase_returns');
    localStorage.removeItem('stock_erp_supplier_payments');
    localStorage.removeItem('stock_erp_damaged_stock');
    localStorage.removeItem('stock_erp_suppliers');
    localStorage.removeItem('stock_erp_categories');
    localStorage.removeItem('stock_erp_customer_orders');
    localStorage.removeItem('stock_erp_customer_returns');
    localStorage.removeItem('stock_erp_payment_claims');
    localStorage.removeItem('stock_erp_sales_reps');
    localStorage.removeItem('stock_erp_stock_transfers');
    localStorage.removeItem('stock_erp_audit_logs');

    // 3. Clear Firebase Firestore collections if connected
    if (settings.firebaseConnected) {
      await clearAllFirestoreCollections();
    }
  };

  const handleExportBackupJSON = () => {
    const backupObj = {
      appName: settings.brandName || settings.storeName || 'Stock Management',
      exportDate: new Date().toISOString(),
      version: '3.1.0',
      data: {
        items,
        transactions,
        categories,
        suppliers,
        wholesalers,
        invoices,
        accountTxns,
        expenses,
        purchaseOrders,
        purchaseBills,
        purchaseReturns,
        supplierPayments,
        damagedStockList,
        customerOrders,
        customerReturns,
        paymentClaims,
        salesReps,
        stockTransfers,
        auditLogs,
        users,
        settings
      }
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupObj, null, 2));
    const downloadAnchor = document.createElement('a');
    const dateTag = getLocalYYYYMMDD();
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${(settings.brandName || 'StockApp').replace(/\s+/g, '_')}_Backup_${dateTag}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleExportBackupCSV = () => {
    if (items.length === 0) {
      setAppNotice({ type: 'error', text: 'No inventory items available to export.' });
      return;
    }
    const headers = ['ID', 'Name', 'Category', 'SKU', 'BatchNo', 'Quantity', 'Unit', 'Price', 'CostPrice', 'Supplier', 'ExpiryDate', 'Location', 'Status'];
    const rows = items.map(i => [
      i.id,
      `"${i.name.replace(/"/g, '""')}"`,
      `"${i.category.replace(/"/g, '""')}"`,
      i.sku,
      i.batchNo,
      i.quantity,
      i.unit,
      i.price,
      i.costPrice,
      `"${i.supplier.replace(/"/g, '""')}"`,
      i.expiryDate,
      `"${i.location.replace(/"/g, '""')}"`,
      i.status
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", encodeURI(csvContent));
    downloadAnchor.setAttribute("download", `${(settings.brandName || 'StockApp').replace(/\s+/g, '_')}_Products_${getLocalYYYYMMDD()}.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportBackupJSON = async (backupPayload: any): Promise<{ success: boolean; message: string }> => {
    try {
      const rawData = backupPayload?.data || backupPayload;
      const validation = validateBackupPayload(rawData);
      if (!validation.valid || !validation.data) {
        return { success: false, message: validation.error || 'Invalid backup file structure.' };
      }
      const data = validation.data;

      let restoredProductsCount = 0;

      if (Array.isArray(data.items)) {
        setItems(data.items);
        restoredProductsCount = data.items.length;
        if (settings.firebaseConnected) {
          data.items.forEach((item: any) => saveRecordToFirestore('items', item.id, item));
        }
      }
      if (Array.isArray(data.transactions)) {
        setTransactions(data.transactions);
        if (settings.firebaseConnected) {
          data.transactions.forEach((txn: any) => saveRecordToFirestore('transactions', txn.id, txn));
        }
      }
      if (Array.isArray(data.categories)) {
        setCategories(data.categories);
        if (settings.firebaseConnected) {
          data.categories.forEach((cat: any) => saveRecordToFirestore('categories', cat.id, cat));
        }
      }
      if (Array.isArray(data.suppliers)) {
        setSuppliers(data.suppliers);
        if (settings.firebaseConnected) {
          data.suppliers.forEach((sup: any) => saveRecordToFirestore('suppliers', sup.id, sup));
        }
      }
      if (Array.isArray(data.wholesalers)) {
        setWholesalers(data.wholesalers);
        if (settings.firebaseConnected) {
          data.wholesalers.forEach((w: any) => saveRecordToFirestore('wholesalers', w.id, w));
        }
      }
      if (Array.isArray(data.invoices)) {
        setInvoices(data.invoices);
        if (settings.firebaseConnected) {
          data.invoices.forEach((inv: any) => saveRecordToFirestore('invoices', inv.id, inv));
        }
      }
      if (Array.isArray(data.accountTxns)) {
        setAccountTxns(data.accountTxns);
        if (settings.firebaseConnected) {
          data.accountTxns.forEach((act: any) => saveRecordToFirestore('accountTxns', act.id, act));
        }
      }
      if (Array.isArray(data.expenses)) {
        setExpenses(data.expenses);
        if (settings.firebaseConnected) {
          data.expenses.forEach((exp: any) => saveRecordToFirestore('expenses', exp.id, exp));
        }
      }
      if (Array.isArray(data.purchaseOrders)) {
        setPurchaseOrders(data.purchaseOrders);
        if (settings.firebaseConnected) {
          data.purchaseOrders.forEach((po: any) => saveRecordToFirestore('purchase_orders', po.id, po));
        }
      }
      if (Array.isArray(data.purchaseBills)) {
        setPurchaseBills(data.purchaseBills);
        if (settings.firebaseConnected) {
          data.purchaseBills.forEach((pb: any) => saveRecordToFirestore('purchase_bills', pb.id, pb));
        }
      }
      if (Array.isArray(data.purchaseReturns)) {
        setPurchaseReturns(data.purchaseReturns);
        if (settings.firebaseConnected) {
          data.purchaseReturns.forEach((pr: any) => saveRecordToFirestore('purchase_returns', pr.id, pr));
        }
      }
      if (Array.isArray(data.supplierPayments)) {
        setSupplierPayments(data.supplierPayments);
        if (settings.firebaseConnected) {
          data.supplierPayments.forEach((sp: any) => saveRecordToFirestore('supplier_payments', sp.id, sp));
        }
      }
      if (Array.isArray(data.damagedStockList)) {
        setDamagedStockList(data.damagedStockList);
        if (settings.firebaseConnected) {
          data.damagedStockList.forEach((dmg: any) => saveRecordToFirestore('damaged_stock', dmg.id, dmg));
        }
      }
      if (Array.isArray(data.customerOrders)) {
        setCustomerOrders(data.customerOrders);
        if (settings.firebaseConnected) {
          data.customerOrders.forEach((ord: any) => saveRecordToFirestore('customer_orders', ord.id, ord));
        }
      }
      if (Array.isArray(data.customerReturns)) {
        setCustomerReturns(data.customerReturns);
        if (settings.firebaseConnected) {
          data.customerReturns.forEach((ret: any) => saveRecordToFirestore('customer_returns', ret.id, ret));
        }
      }
      if (Array.isArray(data.paymentClaims)) {
        setPaymentClaims(data.paymentClaims);
        if (settings.firebaseConnected) {
          data.paymentClaims.forEach((clm: any) => saveRecordToFirestore('payment_claims', clm.id, clm));
        }
      }
      if (Array.isArray(data.salesReps)) {
        setSalesReps(data.salesReps);
        if (settings.firebaseConnected) {
          data.salesReps.forEach((sr: any) => saveRecordToFirestore('sales_reps', sr.id, sr));
        }
      }
      if (Array.isArray(data.stockTransfers)) {
        setStockTransfers(data.stockTransfers);
        if (settings.firebaseConnected) {
          data.stockTransfers.forEach((trf: any) => saveRecordToFirestore('stock_transfers', trf.id, trf));
        }
      }
      if (Array.isArray(data.auditLogs)) {
        setAuditLogs(data.auditLogs);
        if (settings.firebaseConnected) {
          data.auditLogs.forEach((aud: any) => saveRecordToFirestore('audit_logs', aud.id, aud));
        }
      }
      if (Array.isArray(data.users) && data.users.length) {
        setUsers(data.users);
        if (settings.firebaseConnected) {
          data.users.forEach((usr: any) => saveRecordToFirestore('users', usr.id, usr));
        }
      }
      if (data.settings && typeof data.settings === 'object') {
        setSettings(prev => ({ ...prev, ...data.settings }));
        if (settings.firebaseConnected) {
          saveRecordToFirestore('settings', 'config', data.settings);
        }
      }

      return { 
        success: true, 
        message: `Backup restored successfully! Restored ${restoredProductsCount} products, chalans, and ledgers. Synced to Cloud & LocalStorage.` 
      };
    } catch (err: any) {
      return { success: false, message: `Failed to import backup: ${err.message || 'Unknown error'}` };
    }
  };

  // --- CUSTOMER / BUYER PORTAL HANDLERS ---
  const handleSaveBuyerPortalCredentials = (params: {
    wholesalerId: string;
    buyerName: string;
    userId: string;
    password: string;
    status: 'Active' | 'Inactive';
    email?: string;
  }): { success: boolean; message?: string } => {
    const cleanUserId = params.userId.trim();
    if (!cleanUserId || !params.password) {
      return { success: false, message: 'Portal User ID and Password are required.' };
    }

    const existingForBuyer = users.find(
      u => u.role === 'customer' && u.wholesalerId === params.wholesalerId
    );
    const collision = users.find(
      u =>
        u.userId.toLowerCase() === cleanUserId.toLowerCase() &&
        u.id !== existingForBuyer?.id
    );
    if (collision) {
      return { success: false, message: `User ID "${cleanUserId}" is already in use.` };
    }

    if (existingForBuyer) {
      const updatedUser: SystemUser = {
        ...existingForBuyer,
        userId: cleanUserId,
        passwordHash: params.password,
        name: params.buyerName,
        status: params.status,
        email: params.email ?? existingForBuyer.email
      };
      setUsers(prev => prev.map(u => (u.id === updatedUser.id ? updatedUser : u)));
      if (settings.firebaseConnected) saveRecordToFirestore('users', updatedUser.id, updatedUser);
    } else {
      const id = `USR-CUST-${Date.now().toString().slice(-6)}-${Math.floor(10 + Math.random() * 90)}`;
      const createdUser: SystemUser = {
        id,
        userId: cleanUserId,
        passwordHash: params.password,
        name: params.buyerName,
        role: 'customer',
        status: params.status,
        wholesalerId: params.wholesalerId,
        email: params.email,
        authProvider: 'local'
      };
      setUsers(prev => [...prev, createdUser]);
      if (settings.firebaseConnected) saveRecordToFirestore('users', id, createdUser);
    }

    setWholesalers(prev =>
      prev.map(w => {
        if (w.id === params.wholesalerId) {
          const updatedBuyer: Wholesaler = {
            ...w,
            portalUserId: cleanUserId,
            portalStatus: params.status,
            email: params.email ?? w.email
          };
          if (settings.firebaseConnected) saveRecordToFirestore('wholesalers', w.id, updatedBuyer);
          return updatedBuyer;
        }
        return w;
      })
    );

    return { success: true };
  };

  const handleRegisterCustomer = (
    payload: CustomerRegistrationPayload,
    rememberMe: boolean
  ): { success: boolean; message?: string } => {
    let cleanUserId = payload.userId.trim();
    if (!cleanUserId || !payload.password || !payload.name.trim() || !payload.phone.trim()) {
      return { success: false, message: 'Name, Phone, User ID, and Password are required.' };
    }

    const duplicateUser = users.find(
      u => u.userId.toLowerCase() === cleanUserId.toLowerCase()
    );
    if (duplicateUser) {
      if (payload.authProvider === 'google') {
        let suffix = 2;
        while (users.some(u => u.userId.toLowerCase() === `${cleanUserId}_${suffix}`.toLowerCase())) {
          suffix += 1;
        }
        cleanUserId = `${cleanUserId}_${suffix}`;
      } else {
        return { success: false, message: `User ID "${cleanUserId}" is already registered. Please choose another.` };
      }
    }

    const canSyncCloud = Boolean(settings.firebaseConnected || hasFirebaseCredentials(settings));
    if (canSyncCloud) {
      initFirebase(settings);
    }

    // Reuse unlinked existing wholesaler matching exact phone number or Google email, otherwise create a new buyer profile
    const normalizedPhone = payload.phone.replace(/\s+/g, '');
    const normalizedEmail = (payload.email || '').trim().toLowerCase();
    const existingBuyer = wholesalers.find(
      w =>
        !w.portalUserId &&
        ((normalizedPhone && w.phone.replace(/\s+/g, '') === normalizedPhone) ||
          (normalizedEmail && w.email && w.email.trim().toLowerCase() === normalizedEmail))
    );

    let targetBuyerId: string;
    if (existingBuyer) {
      targetBuyerId = existingBuyer.id;
      const updatedBuyer: Wholesaler = {
        ...existingBuyer,
        name: payload.name.trim(),
        shopName: payload.shopName?.trim() || existingBuyer.shopName,
        email: payload.email?.trim() || existingBuyer.email,
        address: payload.address.trim() || existingBuyer.address,
        portalUserId: cleanUserId,
        portalStatus: 'Active'
      };
      setWholesalers(prev => prev.map(w => (w.id === existingBuyer.id ? updatedBuyer : w)));
      if (canSyncCloud) saveRecordToFirestore('wholesalers', updatedBuyer.id, updatedBuyer);
    } else {
      targetBuyerId = `CUST-${Date.now().toString().slice(-6)}-${Math.floor(10 + Math.random() * 90)}`;
      const newBuyer: Wholesaler = {
        id: targetBuyerId,
        name: payload.name.trim(),
        shopName: payload.shopName?.trim() || undefined,
        phone: payload.phone.trim(),
        email: payload.email?.trim() || undefined,
        address: payload.address.trim(),
        totalDue: 0,
        portalUserId: cleanUserId,
        portalStatus: 'Active'
      };
      setWholesalers(prev => [...prev, newBuyer]);
      if (canSyncCloud) saveRecordToFirestore('wholesalers', targetBuyerId, newBuyer);
    }

    const userRecordId = `USR-CUST-${Date.now().toString().slice(-6)}-${Math.floor(10 + Math.random() * 90)}`;
    const newUser: SystemUser = {
      id: userRecordId,
      userId: cleanUserId,
      passwordHash: payload.password,
      name: payload.name.trim(),
      role: 'customer',
      status: 'Active',
      wholesalerId: targetBuyerId,
      email: payload.email?.trim() || undefined,
      authProvider: payload.authProvider
    };
    setUsers(prev => [...prev, newUser]);
    if (canSyncCloud) saveRecordToFirestore('users', userRecordId, newUser);

    handleLogin(newUser, rememberMe);
    return { success: true };
  };

  const handleGoogleCustomerLogin = async (
    googleUser: { email: string; displayName?: string; photoURL?: string },
    rememberMe: boolean
  ): Promise<{ needsProfileCompletion: boolean; error?: string }> => {
    const cleanEmail = googleUser.email.trim().toLowerCase();
    let matchedCustomer = users.find(
      u => u.role === 'customer' && u.email && u.email.trim().toLowerCase() === cleanEmail
    );

    if (!matchedCustomer && (settings.firebaseConnected || hasFirebaseCredentials(settings))) {
      const remoteCustomer = await findRemoteCustomerByEmail(settings, cleanEmail);
      if (remoteCustomer) {
        matchedCustomer = remoteCustomer;
        setUsers(prev =>
          prev.some(u => u.id === remoteCustomer.id) ? prev : [...prev, remoteCustomer]
        );
      }
    }

    if (matchedCustomer) {
      if (matchedCustomer.status !== 'Active') {
        return {
          needsProfileCompletion: false,
          error: 'This customer portal account is deactivated. Please contact Admin.',
        };
      }
      handleLogin(matchedCustomer, rememberMe);
      return { needsProfileCompletion: false };
    }
    return { needsProfileCompletion: true };
  };

  const handlePlaceCustomerOrder = (order: Omit<CustomerOrder, 'id'>) => {
    const id = `ORD-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
    const newOrder: CustomerOrder = { ...order, id };
    setCustomerOrders(prev => [newOrder, ...prev]);
    if (settings.firebaseConnected) saveRecordToFirestore('customer_orders', id, newOrder);
    logAudit('Place Portal Order', 'Portal', `Buyer ${order.wholesalerName} placed order ${order.orderNo} (${order.items.length} items)`, id);
  };

  const handleUpdateCustomerOrder = (updatedOrder: CustomerOrder) => {
    setCustomerOrders(prev => prev.map(o => (o.id === updatedOrder.id ? updatedOrder : o)));
    if (settings.firebaseConnected) saveRecordToFirestore('customer_orders', updatedOrder.id, updatedOrder);
    logAudit('Update Portal Order', 'Portal', `Order ${updatedOrder.orderNo} status updated to ${updatedOrder.status}`, updatedOrder.id);
  };

  const handleConfirmOrderDelivery = (orderId: string) => {
    const target = customerOrders.find(o => o.id === orderId);
    if (!target) return;
    const deliveredAt = new Date().toISOString();
    const updatedOrder: CustomerOrder = { ...target, status: 'Delivered', deliveredAt, updatedAt: deliveredAt };
    setCustomerOrders(prev => prev.map(o => (o.id === orderId ? updatedOrder : o)));
    if (settings.firebaseConnected) saveRecordToFirestore('customer_orders', orderId, updatedOrder);
    logAudit('Confirm Delivery', 'Portal', `Buyer confirmed delivery received for order ${target.orderNo}`, orderId);
  };

  const handleSubmitPaymentClaim = (
    claim: Omit<PaymentClaim, 'id' | 'claimNo' | 'status' | 'createdAt'>
  ) => {
    const id = `CLM-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
    const claimNo = `CLM-${Date.now().toString().slice(-6)}`;
    const newClaim: PaymentClaim = {
      ...claim,
      id,
      claimNo,
      status: 'Pending',
      createdAt: new Date().toISOString(),
    };
    setPaymentClaims(prev => [newClaim, ...prev]);
    if (settings.firebaseConnected) saveRecordToFirestore('payment_claims', id, newClaim);
    logAudit('Submit Payment Claim', 'Portal', `${claim.wholesalerName} claimed ৳${claim.amount} via ${claim.paymentMethod} (Trx: ${claim.trxId})`, id);
  };

  const handleResolvePaymentClaim = (
    claimId: string,
    decision: 'Approved' | 'Rejected',
    adminNotes?: string
  ) => {
    const target = paymentClaims.find(c => c.id === claimId);
    if (!target || target.status !== 'Pending') return;

    const resolvedAt = new Date().toISOString();
    const receiptNo =
      decision === 'Approved'
        ? `RCPT-CLM-${target.claimNo.replace(/^CLM-/, '')}`
        : undefined;

    const updatedClaim: PaymentClaim = {
      ...target,
      status: decision,
      receiptNo,
      adminNotes: adminNotes || undefined,
      resolvedAt,
    };

    setPaymentClaims(prev => prev.map(c => (c.id === claimId ? updatedClaim : c)));
    if (settings.firebaseConnected) saveRecordToFirestore('payment_claims', claimId, updatedClaim);

    if (decision === 'Approved') {
      if (target.wholesalerId && target.amount > 0) {
        handleUpdateWholesalerDue(target.wholesalerId, -target.amount);
      }
      handleAddAccountTxn({
        date: resolvedAt.slice(0, 19),
        type: 'IN',
        amount: target.amount,
        reference: receiptNo || target.claimNo,
        receiptNo,
        paymentMethod: target.paymentMethod,
        wholesalerId: target.wholesalerId,
        description: `Verified Payment Claim ${target.claimNo} from ${target.wholesalerName} (Trx: ${target.trxId})`,
      });
    }

    logAudit(`${decision} Payment Claim`, 'Accounts', `${decision} claim ${target.claimNo} for ${target.wholesalerName} (৳${target.amount})`, claimId);
  };

  const handleSubmitCustomerReturn = (ret: Omit<CustomerReturn, 'id'>) => {
    const id = `RET-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
    const newRet: CustomerReturn = { ...ret, id };
    setCustomerReturns(prev => [newRet, ...prev]);
    if (settings.firebaseConnected) saveRecordToFirestore('customer_returns', id, newRet);
    logAudit('Submit Return', 'Portal', `Buyer ${ret.wholesalerName} requested return ${ret.returnNo}`, id);
  };

  const handleResolveCustomerReturn = (retId: string, decision: 'Approved' | 'Rejected') => {
    const target = customerReturns.find(r => r.id === retId);
    if (!target || target.status === 'Credited' || target.status === 'Rejected') return;

    const resolvedAt = new Date().toISOString();
    const nextStatus: CustomerReturn['status'] = decision === 'Approved' ? 'Credited' : 'Rejected';
    const updatedRet: CustomerReturn = { ...target, status: nextStatus, resolvedAt };

    setCustomerReturns(prev => prev.map(r => (r.id === retId ? updatedRet : r)));
    if (settings.firebaseConnected) saveRecordToFirestore('customer_returns', retId, updatedRet);

    if (decision === 'Approved') {
      if (target.wholesalerId && target.totalCreditAmount > 0) {
        handleUpdateWholesalerDue(target.wholesalerId, -target.totalCreditAmount);
      }
      target.items.forEach(retItem => {
        if (retItem.itemId && retItem.quantity > 0) {
          handleAddTransaction({
            itemId: retItem.itemId,
            itemName: retItem.itemName,
            type: 'RETURN',
            quantity: retItem.quantity,
            unitPrice: retItem.unitPrice,
            date: resolvedAt,
            user: userName,
            reference: target.returnNo,
            notes: `Buyer Return Credit (${target.reason})`
          });
        }
      });
    }
    logAudit(`Resolve Return (${nextStatus})`, 'Sales', `Return ${target.returnNo} marked ${nextStatus}`, retId);
  };

  const handleUpdateCustomerProfile = (updatedBuyer: Wholesaler, newPassword?: string) => {
    setWholesalers(prev => prev.map(w => (w.id === updatedBuyer.id ? updatedBuyer : w)));
    if (settings.firebaseConnected) saveRecordToFirestore('wholesalers', updatedBuyer.id, updatedBuyer);

    const linkedUser = users.find(
      u => u.role === 'customer' && (u.wholesalerId === updatedBuyer.id || u.userId === currentUserId)
    );
    if (linkedUser) {
      const updatedUser: SystemUser = {
        ...linkedUser,
        name: updatedBuyer.name,
        email: updatedBuyer.email ?? linkedUser.email,
        passwordHash: newPassword && newPassword.trim() ? newPassword.trim() : linkedUser.passwordHash
      };
      setUsers(prev => prev.map(u => (u.id === updatedUser.id ? updatedUser : u)));
      if (settings.firebaseConnected) saveRecordToFirestore('users', updatedUser.id, updatedUser);
      setUserName(updatedBuyer.name);
      if (localStorage.getItem('stock_erp_session_active') === 'true') {
        localStorage.setItem('stock_erp_user_name', updatedBuyer.name);
      } else if (sessionStorage.getItem('stock_erp_session_active') === 'true') {
        sessionStorage.setItem('stock_erp_user_name', updatedBuyer.name);
      }
    }
  };

  const staffRoleForPermissions: 'admin' | 'manager' | 'staff' =
    userRole === 'customer' ? 'staff' : userRole;
  const currentRolePermissions = (settings.rolePermissions || defaultRolePermissions)[staffRoleForPermissions];

  const handleAddUser = (newUser: Omit<SystemUser, 'id'>) => {
    const id = `USR-${users.length + 1}-${Date.now().toString().slice(-4)}`;
    const completeUser = { ...newUser, id };
    setUsers(prev => [...prev, completeUser]);
    if (settings.firebaseConnected) saveRecordToFirestore('users', id, completeUser);
    logAudit('Add User', 'Users', `Created user ${completeUser.userId} (${completeUser.role})`, id);
  };

  const handleUpdateUser = (updatedUser: SystemUser) => {
    setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
    if (settings.firebaseConnected) saveRecordToFirestore('users', updatedUser.id, updatedUser);
    logAudit('Update User', 'Users', `Updated user ${updatedUser.userId}`, updatedUser.id);
    
    // If updating currently logged in user, reflect changes in session
    if (currentUserId && updatedUser.userId.toLowerCase() === currentUserId.toLowerCase()) {
      setUserName(updatedUser.name);
      setUserRole(updatedUser.role);
    }
  };

  const handleDeleteUser = (id: string) => {
    const target = users.find(u => u.id === id);
    if (!target) return;
    if (target.role === 'admin' && users.filter(u => u.role === 'admin').length <= 1) {
      setAppNotice({ type: 'error', text: 'At least one Admin user account must remain in the system.' });
      return;
    }
    setUsers(prev => prev.filter(u => u.id !== id));
    if (settings.firebaseConnected) deleteRecordFromFirestore('users', id);
    logAudit('Delete User', 'Users', `Deleted user ${target.name} (${target.userId})`, id);
  };

  const currentUser =
    users.find(u => currentUserId && u.userId.toLowerCase() === currentUserId.toLowerCase()) ||
    users.find(u => u.name === userName && u.role === userRole) ||
    users.find(u => u.role === userRole) ||
    users[0];

  const dashboardUserKey = currentUser?.userId || currentUserId || 'admin';
  const [dashboardVisibility, setDashboardVisibility] = useState<DashboardModuleVisibility>(() =>
    loadUserDashboardVisibility(dashboardUserKey, currentUser?.dashboardWidgets)
  );

  useEffect(() => {
    setDashboardVisibility(
      loadUserDashboardVisibility(dashboardUserKey, currentUser?.dashboardWidgets)
    );
  }, [dashboardUserKey, currentUser?.dashboardWidgets]);

  const applyUserDashboardVisibility = (nextPrefs: DashboardModuleVisibility) => {
    const saved = saveUserDashboardVisibility(dashboardUserKey, nextPrefs);
    setDashboardVisibility(saved);
    if (currentUser) {
      const updatedUser: SystemUser = {
        ...currentUser,
        dashboardWidgets: saved,
      };
      setUsers(prev => prev.map(u => (u.id === currentUser.id ? updatedUser : u)));
      if (settings.firebaseConnected) {
        saveRecordToFirestore('users', currentUser.id, updatedUser);
      }
    }
  };

  const handleToggleDashboardModule = (moduleKey: DashboardModuleKey) => {
    applyUserDashboardVisibility({
      ...dashboardVisibility,
      [moduleKey]: !dashboardVisibility[moduleKey],
    });
  };

  const handleSetAllDashboardModules = (visible: boolean) => {
    applyUserDashboardVisibility({
      buyerRequests: visible,
      expiryWatchlist: visible,
      salesVsExpenses: visible,
      categoryNetProfit: visible,
    });
  };

  // Calculate low stock items count for sidebar warning badge
  const lowStockCount = items.filter(i => i.quantity <= i.reorderThreshold).length;
  const activeThemeConfig = getThemeConfig(settings.activeTheme);
  const [pendingOrderToLoad, setPendingOrderToLoad] = useState<CustomerOrder | null>(null);

  const handleApprovePortalOrder = (ord: CustomerOrder) => {
    handleUpdateCustomerOrder({
      ...ord,
      status: 'Approved',
      updatedAt: new Date().toISOString()
    });
  };

  const handleRejectPortalOrder = (ord: CustomerOrder) => {
    handleUpdateCustomerOrder({
      ...ord,
      status: 'Cancelled',
      updatedAt: new Date().toISOString()
    });
  };

  const handleConvertOrderToChalan = (ord: CustomerOrder) => {
    setPendingOrderToLoad(ord);
    navigateToTab('sales');
  };

  if (!isLoggedIn) {
    return (
      <>
        <OfflineIndicator />
        <PWAUpdateBanner />
        <LoginScreen
          onLogin={handleLogin}
          onRegisterCustomer={handleRegisterCustomer}
          onGoogleCustomerLogin={handleGoogleCustomerLogin}
          onVerifyRemoteLogin={handleVerifyRemoteLogin}
          isCloudSyncing={isCloudBootstrapping}
          users={users}
          settings={settings}
        />
      </>
    );
  }

  if (userRole === 'customer') {
    const activeBuyer: Wholesaler = wholesalers.find(
      w =>
        (currentUser?.wholesalerId && w.id === currentUser.wholesalerId) ||
        (w.portalUserId && w.portalUserId.toLowerCase() === currentUserId.toLowerCase())
    ) || {
      id: currentUser?.wholesalerId || `CUST-TEMP-${currentUserId}`,
      name: currentUser?.name || userName,
      phone: '',
      address: '',
      totalDue: 0,
      email: currentUser?.email,
      portalUserId: currentUser?.userId || currentUserId,
      portalStatus: 'Active'
    };

    return (
      <>
        <OfflineIndicator />
        <PWAUpdateBanner />
        <CustomerPortalView
          buyer={activeBuyer}
          currentUser={currentUser}
          settings={settings}
          items={items}
          invoices={invoices}
          accountTxns={accountTxns}
          customerOrders={customerOrders}
          customerReturns={customerReturns}
          paymentClaims={paymentClaims}
          enforceCreditLimit={settings.enforceCreditLimit !== false}
          onPlaceOrder={handlePlaceCustomerOrder}
          onSubmitReturn={handleSubmitCustomerReturn}
          onSubmitPaymentClaim={handleSubmitPaymentClaim}
          onConfirmDelivery={handleConfirmOrderDelivery}
          onUpdateProfile={handleUpdateCustomerProfile}
          onLogout={handleLogout}
        />
      </>
    );
  }

  return (
    <div className={`flex h-[100dvh] w-full overflow-hidden ${activeThemeConfig.appBgClass} font-sans antialiased transition-colors duration-300`}>
      <OfflineIndicator />
      <PWAUpdateBanner />
      {/* Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={navigateToTab}
        onLogout={handleLogout}
        userName={userName}
        userRole={userRole}
        currentUser={currentUser}
        lowStockCount={lowStockCount}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        brandName={settings.brandName}
        brandShortName={settings.brandShortName}
        logoUrl={settings.logoUrl}
        permissions={currentRolePermissions}
        activeTheme={settings.activeTheme}
      />

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0 h-full overflow-hidden">
        <Header
          currentTab={currentTab}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          userName={userName}
          userRole={userRole}
          currentUser={currentUser}
          onUpdateProfile={handleUpdateUser}
          storeName={settings.storeName}
          brandName={settings.brandName}
          brandShortName={settings.brandShortName}
          logoUrl={settings.logoUrl}
          systemDate={systemDate}
          onSystemDateChange={setSystemDate}
          onToggleSidebar={() => setIsSidebarOpen(prev => !prev)}
          onLogout={handleLogout}
          onSelectTab={navigateToTab}
          canGoBack={tabHistory.length > 1 || currentTab !== 'dashboard'}
          onGoBack={() => window.history.back()}
          lowStockCount={lowStockCount}
          items={items}
          customerOrders={customerOrders}
          paymentClaims={paymentClaims}
          customerReturns={customerReturns}
          wholesalers={wholesalers}
          purchaseOrders={purchaseOrders}
          auditLogs={auditLogs}
          activeTheme={settings.activeTheme}
        />

        <main className="flex-1 overflow-y-auto relative pb-20">
          {appNotice && (
            <div className={`mx-6 mt-4 p-3 rounded-xl border text-xs font-bold flex items-center justify-between ${
              appNotice.type === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : 'bg-emerald-50 border-emerald-200 text-emerald-900'
            }`}>
              <span>{appNotice.text}</span>
              <button type="button" onClick={() => setAppNotice(null)} className="font-black ml-3 cursor-pointer">✕</button>
            </div>
          )}

          {currentTab === 'dashboard' && (
            <DashboardView
              items={items}
              transactions={transactions}
              invoices={invoices}
              wholesalers={wholesalers}
              accountTxns={accountTxns}
              expenses={expenses}
              damageStocks={damagedStockList}
              purchaseOrders={purchaseOrders}
              suppliers={suppliers}
              customerOrders={customerOrders}
              paymentClaims={paymentClaims}
              customerReturns={customerReturns}
              onApprovePortalOrder={handleApprovePortalOrder}
              onRejectPortalOrder={handleRejectPortalOrder}
              onConvertOrderToChalan={handleConvertOrderToChalan}
              onResolvePaymentClaim={handleResolvePaymentClaim}
              onResolveCustomerReturn={handleResolveCustomerReturn}
              currency={settings.currency}
              onNavigateTab={navigateToTab}
              moduleVisibility={dashboardVisibility}
              onToggleModule={handleToggleDashboardModule}
              onSetAllModules={handleSetAllDashboardModules}
            />
          )}

          {currentTab === 'pos' && (
            <RetailPosView
              items={items}
              categories={categories}
              currency={settings.currency}
              systemDate={systemDate}
              onAddInvoice={handleAddInvoice}
              storeName={settings.storeName}
              brandName={settings.brandName}
              brandShortName={settings.brandShortName}
              logoUrl={settings.logoUrl}
              address={settings.address}
              phone={settings.phone}
              currentUser={currentUser}
            />
          )}

          {currentTab === 'sales' && (
            <SalesInvoiceView
              items={items}
              wholesalers={wholesalers}
              invoices={invoices}
              customerOrders={customerOrders}
              customerReturns={customerReturns}
              salesReps={salesReps}
              warehouses={activeWarehouses}
              enforceCreditLimit={settings.enforceCreditLimit !== false}
              currency={settings.currency}
              systemDate={systemDate}
              onAddInvoice={handleAddInvoice}
              onUpdateInvoice={handleUpdateInvoice}
              onDeleteInvoice={handleDeleteInvoice}
              onUpdateCustomerOrder={handleUpdateCustomerOrder}
              onResolveCustomerReturn={handleResolveCustomerReturn}
              searchQuery={searchQuery}
              storeName={settings.storeName}
              brandName={settings.brandName}
              brandShortName={settings.brandShortName}
              logoUrl={settings.logoUrl}
              address={settings.address}
              phone={settings.phone}
              companyEmail={settings.companyEmail}
              companyWebsite={settings.companyWebsite}
              pendingOrderToLoad={pendingOrderToLoad}
              onConsumeOrderToLoad={() => setPendingOrderToLoad(null)}
              currentUser={currentUser}
            />
          )}

          {currentTab === 'courier-dispatch' && (
            <CourierDispatchView
              invoices={invoices}
              wholesalers={wholesalers}
              customerOrders={customerOrders}
              onUpdateInvoice={handleUpdateInvoice}
              onUpdateCustomerOrder={handleUpdateCustomerOrder}
              searchQuery={searchQuery}
              systemDate={systemDate}
              brandName={settings.brandName}
              brandShortName={settings.brandShortName}
              storeName={settings.storeName}
              logoUrl={settings.logoUrl}
              address={settings.address}
              phone={settings.phone}
              companyEmail={settings.companyEmail}
              companyWebsite={settings.companyWebsite}
              currentUser={currentUser}
            />
          )}

          {currentTab === 'wholesalers' && (
            <WholesalersView
              wholesalers={wholesalers}
              items={items}
              users={users}
              salesReps={salesReps}
              currency={settings.currency}
              onAddWholesaler={handleAddWholesaler}
              onUpdateWholesaler={handleUpdateWholesaler}
              onDeleteWholesaler={handleDeleteWholesaler}
              onSaveBuyerPortalCredentials={handleSaveBuyerPortalCredentials}
              searchQuery={searchQuery}
            />
          )}

          {currentTab === 'accounts' && (
            <AccountsView
              accountTxns={accountTxns}
              wholesalers={wholesalers}
              invoices={invoices}
              paymentClaims={paymentClaims}
              suppliers={suppliers}
              purchaseBills={purchaseBills}
              purchaseReturns={purchaseReturns}
              supplierPayments={supplierPayments}
              brandName={settings.brandName}
              currency={settings.currency}
              systemDate={systemDate}
              onAddTransaction={handleAddAccountTxn}
              onUpdateWholesalerDue={handleUpdateWholesalerDue}
              onResolvePaymentClaim={handleResolvePaymentClaim}
              onPaySupplierDue={handlePaySupplierDue}
              searchQuery={searchQuery}
            />
          )}

          {currentTab === 'expenses' && (
            <ExpensesView
              expenses={expenses}
              invoices={invoices}
              items={items}
              currency={settings.currency}
              userName={userName}
              onAddExpense={handleAddExpense}
              onUpdateExpense={handleUpdateExpense}
              onDeleteExpense={handleDeleteExpense}
              searchQuery={searchQuery}
            />
          )}

          {currentTab === 'sales-reps' && (
            <SalesRepsView
              salesReps={salesReps}
              wholesalers={wholesalers}
              invoices={invoices}
              currency={settings.currency}
              onAddSalesRep={handleAddSalesRep}
              onUpdateSalesRep={handleUpdateSalesRep}
              onDeleteSalesRep={handleDeleteSalesRep}
              searchQuery={searchQuery}
            />
          )}

          {currentTab === 'purchase-orders' && (
            <PurchaseOrdersView
              purchaseOrders={purchaseOrders}
              purchaseBills={purchaseBills}
              purchaseReturns={purchaseReturns}
              items={items}
              suppliers={suppliers}
              warehouses={activeWarehouses}
              currency={settings.currency}
              systemDate={systemDate}
              onAddPO={handleAddPO}
              onUpdatePO={handleUpdatePO}
              onDeletePO={handleDeletePO}
              onReceivePOItems={handleReceivePOItems}
              onCreatePurchaseBill={handleCreatePurchaseBill}
              onDeletePurchaseBill={handleDeletePurchaseBill}
              onCreatePurchaseReturn={handleCreatePurchaseReturn}
              searchQuery={searchQuery}
              brandName={settings.brandName}
              storeName={settings.storeName}
              phone={settings.phone}
            />
          )}

          {currentTab === 'expiry-damage' && (
            <ExpiryDamageView
              items={items}
              damagedStockList={damagedStockList}
              currency={settings.currency}
              userName={userName}
              onAddDamagedStock={handleAddDamagedStock}
              onDeleteDamagedStock={handleDeleteDamagedStock}
              searchQuery={searchQuery}
            />
          )}

          {currentTab === 'reports' && (
            <ReportsView
              items={items}
              transactions={transactions}
              invoices={invoices}
              wholesalers={wholesalers}
              accountTxns={accountTxns}
              suppliers={suppliers}
              categories={categories}
              salesReps={salesReps}
              purchaseOrders={purchaseOrders}
              currency={settings.currency}
              storeName={settings.storeName}
              brandName={settings.brandName}
            />
          )}

          {currentTab === 'inventory' && (
            <InventoryView
              items={items}
              categories={categories}
              suppliers={suppliers}
              currency={settings.currency}
              warehouses={activeWarehouses}
              brandName={settings.brandName}
              onAddItem={handleAddItem}
              onUpdateItem={handleUpdateItem}
              onDeleteItem={handleDeleteItem}
              searchQuery={searchQuery}
            />
          )}

          {currentTab === 'transactions' && (
            <StockTransactionsView
              items={items}
              transactions={transactions}
              suppliers={suppliers}
              currency={settings.currency}
              userName={userName}
              systemDate={systemDate}
              warehouses={activeWarehouses}
              stockTransfers={stockTransfers}
              onAddTransaction={handleAddTransaction}
              onUpdateTransaction={handleUpdateTransaction}
              onDeleteTransaction={handleDeleteTransaction}
              onTransferStock={handleTransferWarehouseStock}
              searchQuery={searchQuery}
            />
          )}

          {currentTab === 'suppliers' && (
            <SuppliersView
              suppliers={suppliers}
              purchaseBills={purchaseBills}
              purchaseReturns={purchaseReturns}
              supplierPayments={supplierPayments}
              brandName={settings.brandName}
              currency={settings.currency}
              systemDate={systemDate}
              onAddSupplier={handleAddSupplier}
              onUpdateSupplier={handleUpdateSupplier}
              onDeleteSupplier={handleDeleteSupplier}
              onPaySupplierDue={handlePaySupplierDue}
              searchQuery={searchQuery}
            />
          )}

          {currentTab === 'categories' && (
            <CategoriesView
              categories={categories}
              onAddCategory={handleAddCategory}
              onUpdateCategory={handleUpdateCategory}
              onDeleteCategory={handleDeleteCategory}
            />
          )}

          {currentTab === 'audit-log' && (
            <AuditLogView
              logs={auditLogs}
              isAdmin={userRole === 'admin'}
              onClearLogs={handleClearAuditLogs}
              searchQuery={searchQuery}
            />
          )}

          {currentTab === 'settings' && (
            <SettingsView
              settings={settings}
              onUpdateSettings={handleUpdateSettings}
              onConnectFirebase={handleConnectFirebase}
              onPullFromFirestore={handlePullFromFirestore}
              onPushToFirestore={handlePushToFirestore}
              users={users}
              onAddUser={handleAddUser}
              onUpdateUser={handleUpdateUser}
              onDeleteUser={handleDeleteUser}
              currentUserRole={staffRoleForPermissions}
              onResetAllData={handleResetAllData}
              onExportBackupJSON={handleExportBackupJSON}
              onExportBackupCSV={handleExportBackupCSV}
              onImportBackupJSON={handleImportBackupJSON}
            />
          )}
        </main>

        {/* Floating AI Chatbot Assistant */}
        <AiChatbot
          items={items}
          transactions={transactions}
          invoices={invoices}
          wholesalers={wholesalers}
          categories={categories}
          currency={settings.currency}
          brandName={settings.brandName}
          brandShortName={settings.brandShortName}
          logoUrl={settings.logoUrl}
          onNavigateTab={navigateToTab}
        />
      </div>

      {stockToasts.length > 0 && (
        <div
          aria-live="assertive"
          aria-label="Critical Low Stock Toast Notifications"
          className="fixed top-20 right-4 sm:right-6 z-[90] flex flex-col gap-2.5 w-[calc(100vw-2rem)] max-w-sm pointer-events-none"
        >
          {stockToasts.map((toast) => (
            <div
              key={toast.id}
              role="status"
              className="pointer-events-auto bg-slate-950 text-white border border-rose-500/60 rounded-2xl shadow-2xl p-4 flex items-start gap-3 transition-all duration-200"
            >
              <div className="w-9 h-9 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center shrink-0 mt-0.5">
                <AlertTriangle className="w-4.5 h-4.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-rose-400">
                      Critical Stock Alert (&lt;20%)
                    </p>
                    <p className="text-sm font-extrabold text-white truncate">
                      {toast.itemName}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label={`Dismiss alert for ${toast.itemName}`}
                    onClick={() => dismissStockToast(toast.id)}
                    className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-slate-300 mt-1">
                  Remaining:{' '}
                  <strong className="font-mono tabular-nums text-rose-300">
                    {toast.quantity} {toast.unit}
                  </strong>{' '}
                  (below 20% of initial reorder limit{' '}
                  <span className="font-mono tabular-nums">{toast.initialReorderThreshold}</span>)
                </p>
                <div className="mt-2.5 flex items-center justify-between gap-2 text-[11px]">
                  <span className="font-mono tabular-nums text-slate-400">
                    SKU {toast.sku} · {toast.percentOfThreshold}% left
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigateToTab('inventory');
                      dismissStockToast(toast.id);
                    }}
                    className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg transition cursor-pointer inline-flex items-center gap-1 whitespace-nowrap"
                  >
                    <Package className="w-3 h-3" />
                    <span>Restock</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
