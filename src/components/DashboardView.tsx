import React, { useState, useMemo } from 'react';
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  ReferenceLine
} from 'recharts';
import { 
  StockItem, 
  StockTransaction, 
  Invoice, 
  Wholesaler, 
  AccountTxn, 
  Expense, 
  DamagedStock, 
  PurchaseOrder, 
  Supplier,
  CustomerOrder,
  PaymentClaim,
  CustomerReturn
} from '../data/mockData';
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  Package, 
  AlertTriangle, 
  Calendar, 
  CheckCircle2, 
  ShoppingCart, 
  Zap, 
  Award, 
  Clock, 
  ChevronRight, 
  Coins,
  Activity,
  ShoppingBag,
  Receipt,
  RotateCcw,
  FileText,
  XCircle,
  Eye,
  EyeOff,
  Inbox,
  TrendingUp,
  BarChart3,
  SlidersHorizontal
} from 'lucide-react';
import { 
  getLocalYYYYMMDD, 
  getDaysAgoYYYYMMDD, 
  getFirstDayOfMonthYYYYMMDD, 
  extractYYYYMMDD 
} from '../utils/dateUtils';
import { ExpiringSoonCard } from './ExpiringSoonCard';
import {
  buildLast12MonthsSalesVsExpenses,
  buildCurrentMonthCategoryNetProfit
} from '../utils/dashboardAnalytics';
import {
  DASHBOARD_TOGGLEABLE_MODULES,
  DEFAULT_DASHBOARD_VISIBILITY,
  DashboardModuleKey,
  DashboardModuleVisibility,
} from '../utils/dashboardVisibility';

interface DashboardViewProps {
  items: StockItem[];
  transactions: StockTransaction[];
  invoices?: Invoice[];
  wholesalers?: Wholesaler[];
  accountTxns?: AccountTxn[];
  expenses?: Expense[];
  damageStocks?: DamagedStock[];
  purchaseOrders?: PurchaseOrder[];
  suppliers?: Supplier[];
  customerOrders?: CustomerOrder[];
  paymentClaims?: PaymentClaim[];
  customerReturns?: CustomerReturn[];
  onApprovePortalOrder?: (ord: CustomerOrder) => void;
  onRejectPortalOrder?: (ord: CustomerOrder) => void;
  onConvertOrderToChalan?: (ord: CustomerOrder) => void;
  onResolvePaymentClaim?: (claimId: string, decision: 'Approved' | 'Rejected') => void;
  onResolveCustomerReturn?: (retId: string, decision: 'Approved' | 'Rejected') => void;
  currency: string;
  onNavigateTab?: (tab: string) => void;
  moduleVisibility?: DashboardModuleVisibility;
  onToggleModule?: (key: DashboardModuleKey) => void;
  onSetAllModules?: (visible: boolean) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  items,
  transactions,
  invoices = [],
  wholesalers = [],
  accountTxns: _accountTxns = [],
  expenses = [],
  damageStocks: _damageStocks = [],
  purchaseOrders: _purchaseOrders = [],
  suppliers: _suppliers = [],
  customerOrders = [],
  paymentClaims = [],
  customerReturns = [],
  onApprovePortalOrder,
  onRejectPortalOrder,
  onConvertOrderToChalan,
  onResolvePaymentClaim,
  onResolveCustomerReturn,
  currency,
  onNavigateTab,
  moduleVisibility,
  onToggleModule,
  onSetAllModules,
}) => {
  const [startDate, setStartDate] = useState<string>(getFirstDayOfMonthYYYYMMDD());
  const [endDate, setEndDate] = useState<string>(getLocalYYYYMMDD());
  const [activeDatePreset, setActiveDatePreset] = useState<string>('This Month');
  const [recentTab, setRecentTab] = useState<'txns' | 'invoices' | 'reorder'>('txns');
  const [buyerReqFilter, setBuyerReqFilter] = useState<'all' | 'orders' | 'payments' | 'returns'>('all');
  const [buyerReqStatusScope, setBuyerReqStatusScope] = useState<'pending' | 'all'>('pending');
  const [previewSlipUrl, setPreviewSlipUrl] = useState<string | null>(null);
  const [localVisibility, setLocalVisibility] = useState<DashboardModuleVisibility>(
    DEFAULT_DASHBOARD_VISIBILITY
  );

  const effectiveVisibility = moduleVisibility || localVisibility;
  const visibleCount = DASHBOARD_TOGGLEABLE_MODULES.filter(
    (m) => effectiveVisibility[m.key]
  ).length;

  const handleToggleModule = (key: DashboardModuleKey) => {
    if (onToggleModule) {
      onToggleModule(key);
    } else {
      setLocalVisibility((prev) => ({ ...prev, [key]: !prev[key] }));
    }
  };

  const handleSetAll = (visible: boolean) => {
    if (onSetAllModules) {
      onSetAllModules(visible);
    } else {
      setLocalVisibility({
        buyerRequests: visible,
        expiryWatchlist: visible,
        salesVsExpenses: visible,
        categoryNetProfit: visible,
      });
    }
  };

  // Unified Charts Hub Active View State ('grid' | 'line' | 'bar' | 'pie' | 'doughnut')
  const [chartHubView, setChartHubView] = useState<'grid' | 'line' | 'bar' | 'pie' | 'doughnut'>('grid');

  const formatCurr = (val: number) => {
    const sym = currency.includes('৳') || currency.toLowerCase().includes('bdt') ? '৳' : currency;
    return `${sym} ${val.toLocaleString()}`;
  };

  // Filter transactions based on date range
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const tDate = extractYYYYMMDD(t.date);
      return tDate >= startDate && tDate <= endDate;
    });
  }, [transactions, startDate, endDate]);

  // Filter invoices based on date range
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const d = extractYYYYMMDD(inv.date);
      return d >= startDate && d <= endDate;
    });
  }, [invoices, startDate, endDate]);

  // Filter expenses based on date range
  const filteredExpenses = useMemo(() => {
    return expenses.filter(exp => {
      const d = extractYYYYMMDD(exp.date);
      return d >= startDate && d <= endDate;
    });
  }, [expenses, startDate, endDate]);

  // 1. Calculate Stock In & Out Summaries
  const stockInSummary = useMemo(() => {
    const inTxns = filteredTransactions.filter(t => t.type === 'IN' || t.type === 'RETURN');
    const totalQty = inTxns.reduce((acc, curr) => acc + curr.quantity, 0);
    const totalVal = inTxns.reduce((acc, curr) => acc + curr.totalPrice, 0);
    return { count: inTxns.length, totalQty, totalVal };
  }, [filteredTransactions]);

  const stockOutSummary = useMemo(() => {
    const outTxns = filteredTransactions.filter(t => t.type === 'OUT');
    const totalQty = outTxns.reduce((acc, curr) => acc + curr.quantity, 0);
    const totalVal = outTxns.reduce((acc, curr) => acc + curr.totalPrice, 0);
    return { count: outTxns.length, totalQty, totalVal };
  }, [filteredTransactions]);

  // 2. Financial Sales & Revenue Summaries
  const salesSummary = useMemo(() => {
    const totalBilled = filteredInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
    const totalPaid = filteredInvoices.reduce((sum, inv) => sum + inv.paidAmount, 0);
    const totalDue = filteredInvoices.reduce((sum, inv) => sum + inv.dueAmount, 0);
    return { totalBilled, totalPaid, totalDue, count: filteredInvoices.length };
  }, [filteredInvoices]);

  // 3. Profitability & COGS Estimate
  const financialProfitSummary = useMemo(() => {
    let cogs = 0;
    filteredInvoices.forEach(inv => {
      inv.items.forEach(soldItem => {
        const product = items.find(i => i.id === soldItem.itemId || i.name === soldItem.itemName);
        const costPrice = product ? product.costPrice : (soldItem.unitPrice * 0.8);
        cogs += soldItem.quantity * costPrice;
      });
    });

    const totalExpenseAmt = filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    const grossProfit = salesSummary.totalBilled - cogs;
    const netProfit = grossProfit - totalExpenseAmt;
    const margin = salesSummary.totalBilled > 0 ? ((netProfit / salesSummary.totalBilled) * 100).toFixed(1) : '0';

    return { cogs, totalExpenseAmt, grossProfit, netProfit, margin };
  }, [filteredInvoices, filteredExpenses, salesSummary.totalBilled, items]);

  // 4. Current Inventory Metrics
  const totalInventoryCount = useMemo(() => items.reduce((acc, item) => acc + item.quantity, 0), [items]);
  const totalInventoryValue = useMemo(() => items.reduce((acc, item) => acc + (item.quantity * item.price), 0), [items]);
  const lowStockItems = useMemo(() => items.filter(i => i.quantity <= i.reorderThreshold && i.quantity > 0), [items]);
  const outOfStockItems = useMemo(() => items.filter(i => i.quantity === 0), [items]);
  const totalMarketDue = useMemo(() => wholesalers.reduce((sum, w) => sum + w.totalDue, 0), [wholesalers]);

  // 5. Today's Live Pulse
  const todayPulse = useMemo(() => {
    const todayStr = getLocalYYYYMMDD();
    const todayInvoices = invoices.filter(inv => extractYYYYMMDD(inv.date) === todayStr);
    const todaySales = todayInvoices.reduce((sum, i) => sum + i.totalAmount, 0);
    const todayCash = todayInvoices.reduce((sum, i) => sum + i.paidAmount, 0);

    const todayTxns = transactions.filter(t => extractYYYYMMDD(t.date) === todayStr);
    const todayOutUnits = todayTxns.filter(t => t.type === 'OUT').reduce((sum, t) => sum + t.quantity, 0);
    const todayInUnits = todayTxns.filter(t => t.type === 'IN' || t.type === 'RETURN').reduce((sum, t) => sum + t.quantity, 0);

    const todayExp = expenses.filter(e => extractYYYYMMDD(e.date) === todayStr).reduce((sum, e) => sum + e.amount, 0);

    return { todayStr, todaySales, todayCash, todayOutUnits, todayInUnits, todayExp };
  }, [invoices, transactions, expenses]);

  // 6. Top 5 Fastest Selling Products
  const topSellers = useMemo(() => {
    const map: Record<string, { name: string; category: string; unit: string; totalQty: number; totalRevenue: number }> = {};
    invoices.forEach(inv => {
      inv.items.forEach(sold => {
        if (!map[sold.itemId]) {
          const product = items.find(i => i.id === sold.itemId);
          map[sold.itemId] = {
            name: sold.itemName,
            category: product?.category || 'General',
            unit: product?.unit || 'Pcs',
            totalQty: 0,
            totalRevenue: 0
          };
        }
        map[sold.itemId].totalQty += sold.quantity;
        map[sold.itemId].totalRevenue += sold.total;
      });
    });

    return Object.values(map).sort((a, b) => b.totalQty - a.totalQty).slice(0, 5);
  }, [invoices, items]);

  // 7. Rolling 12-Month Sales vs. Expenses Series (from invoice dates & expense dates)
  const monthlySalesVsExpenses = useMemo(
    () => buildLast12MonthsSalesVsExpenses(invoices, expenses, getLocalYYYYMMDD()),
    [invoices, expenses]
  );

  const twelveMonthTotals = useMemo(() => {
    const totalSales = monthlySalesVsExpenses.reduce((sum, p) => sum + p.Sales, 0);
    const totalExpenses = monthlySalesVsExpenses.reduce((sum, p) => sum + p.Expenses, 0);
    return {
      totalSales,
      totalExpenses,
      net: totalSales - totalExpenses,
    };
  }, [monthlySalesVsExpenses]);

  // 8. Current Month Net Profit by Product Category
  const currentMonthLabel = useMemo(() => {
    const [y, m] = getLocalYYYYMMDD().split('-').map(Number);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[(m || 1) - 1]} ${y}`;
  }, []);

  const categoryNetProfitData = useMemo(
    () => buildCurrentMonthCategoryNetProfit(items, invoices, expenses, getLocalYYYYMMDD()),
    [items, invoices, expenses]
  );

  const currentMonthCategoryTotals = useMemo(() => {
    const revenue = categoryNetProfitData.reduce((sum, d) => sum + d.revenue, 0);
    const expensesAndCogs = categoryNetProfitData.reduce(
      (sum, d) => sum + d.cogs + d.allocatedExpense,
      0
    );
    const netProfit = categoryNetProfitData.reduce((sum, d) => sum + d.netProfit, 0);
    return { revenue, expensesAndCogs, netProfit };
  }, [categoryNetProfitData]);

  // Quick Preset Handlers
  const handlePreset = (preset: string) => {
    setActiveDatePreset(preset);
    const today = getLocalYYYYMMDD();
    if (preset === 'Today') {
      setStartDate(today);
      setEndDate(today);
    } else if (preset === 'Last 7 Days') {
      setStartDate(getDaysAgoYYYYMMDD(7));
      setEndDate(today);
    } else if (preset === 'This Month') {
      setStartDate(getFirstDayOfMonthYYYYMMDD());
      setEndDate(today);
    } else if (preset === 'All Time') {
      setStartDate('2000-01-01');
      setEndDate('2100-12-31');
    }
  };

  // --- CHART 1: Pie Chart (Category Distribution) ---
  const pieCategoryData = useMemo(() => {
    const map: Record<string, number> = {};
    items.forEach(item => {
      map[item.category] = (map[item.category] || 0) + item.quantity;
    });
    return Object.keys(map).map(category => ({
      name: category,
      value: map[category]
    })).filter(x => x.value > 0);
  }, [items]);
  const pieColors = ['#10B981', '#06B6D4', '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899'];

  // --- CHART 2: Doughnut Chart (Stock Status Breakdown) ---
  const doughnutStatusData = useMemo(() => {
    const inStock = items.filter(i => i.quantity > i.reorderThreshold).length;
    const lowStock = items.filter(i => i.quantity <= i.reorderThreshold && i.quantity > 0).length;
    const outStock = items.filter(i => i.quantity === 0).length;
    return [
      { name: 'In Stock', value: inStock, color: '#10B981' },
      { name: 'Low Stock', value: lowStock, color: '#F59E0B' },
      { name: 'Out of Stock', value: outStock, color: '#EF4444' },
    ];
  }, [items]);

  // --- CHART 3: Line Chart (Daily Stock In vs Out Trend) ---
  const lineTrendData = useMemo(() => {
    const daysMap: Record<string, { date: string; displayDate: string; StockIn: number; StockOut: number }> = {};
    
    if (startDate && endDate && startDate <= endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      let curr = new Date(start);
      let limit = 0;

      while (curr <= end && limit < 90) {
        const dStr = curr.toISOString().split('T')[0];
        const displayDate = curr.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
        daysMap[dStr] = { date: dStr, displayDate, StockIn: 0, StockOut: 0 };
        curr.setDate(curr.getDate() + 1);
        limit++;
      }
    }

    filteredTransactions.forEach(t => {
      const dStr = extractYYYYMMDD(t.date);
      if (!daysMap[dStr]) {
        const d = new Date(dStr);
        const displayDate = isNaN(d.getTime()) ? dStr : d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
        daysMap[dStr] = { date: dStr, displayDate, StockIn: 0, StockOut: 0 };
      }
      if (t.type === 'IN' || t.type === 'RETURN') daysMap[dStr].StockIn += t.quantity;
      if (t.type === 'OUT') daysMap[dStr].StockOut += t.quantity;
    });

    return Object.values(daysMap).sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredTransactions, startDate, endDate]);

  // --- CHART 4: Bar Chart (Top Item Quantities) ---
  const barTopItemsData = useMemo(() => {
    return [...items].sort((a, b) => b.quantity - a.quantity).slice(0, 6).map(item => {
      let cleanName = item.name.replace(/^(Dear\s+Health\s+Care\s*|Dear\s*)/i, '');
      if (!cleanName.trim()) cleanName = item.name;
      const shortName = cleanName.length > 12 ? `${cleanName.substring(0, 10)}..` : cleanName;

      return {
        name: shortName,
        fullName: item.name,
        quantity: item.quantity,
        threshold: item.reorderThreshold,
        unit: item.unit
      };
    });
  }, [items]);

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1700px] mx-auto min-h-full">
      
      {/* --- EXECUTIVE DATE FILTER CONTROL BAR --- */}
      <div className="bg-white p-4.5 rounded-2xl shadow-xs border border-slate-200/90 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-teal-500/10 text-teal-600 flex items-center justify-center font-black">
              <Calendar className="w-4.5 h-4.5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm sm:text-base">Executive Analytics & Date Filter</h3>
              <p className="text-xs text-slate-500">Real-time stock flow, revenue, and profit analytics for chosen period</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto max-w-full">
          <div className="flex flex-wrap items-center gap-1 bg-slate-100/90 p-1 rounded-xl text-xs font-semibold max-w-full">
            {['Today', 'Last 7 Days', 'This Month', 'All Time'].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => handlePreset(preset)}
                className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap ${
                  activeDatePreset === preset 
                    ? 'bg-white text-teal-700 shadow-xs font-extrabold' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {preset}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 max-w-full">
            <input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setActiveDatePreset('Custom'); }}
              className="bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 font-bold focus:ring-2 focus:ring-teal-500 outline-none cursor-pointer min-w-0"
            />
            <span className="text-xs text-slate-400 font-bold">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setActiveDatePreset('Custom'); }}
              className="bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 font-bold focus:ring-2 focus:ring-teal-500 outline-none cursor-pointer min-w-0"
            />
          </div>
        </div>
      </div>

      {/* --- USER DASHBOARD MODULES SHOW / HIDE PANEL --- */}
      <div className="bg-white px-4 py-3 rounded-2xl shadow-xs border border-slate-200/90 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
            <SlidersHorizontal className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="text-xs font-extrabold text-slate-900">
              Dashboard Modules (Show / Hide)
            </span>
            <span className="ml-2 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold">
              {visibleCount}/{DASHBOARD_TOGGLEABLE_MODULES.length} Shown
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {DASHBOARD_TOGGLEABLE_MODULES.map((mod) => {
            const isShown = effectiveVisibility[mod.key];
            return (
              <button
                key={mod.key}
                type="button"
                aria-pressed={isShown}
                onClick={() => handleToggleModule(mod.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border inline-flex items-center gap-1.5 transition cursor-pointer ${
                  isShown
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                    : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100 hover:text-slate-700'
                }`}
              >
                {isShown ? (
                  <Eye className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                ) : (
                  <EyeOff className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                )}
                <span>{mod.label}</span>
              </button>
            );
          })}

          <div className="flex items-center gap-1.5 pl-1 border-l border-slate-200">
            <button
              type="button"
              onClick={() => handleSetAll(true)}
              className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold bg-slate-900 hover:bg-slate-800 text-white transition cursor-pointer"
            >
              Show All
            </button>
            <button
              type="button"
              onClick={() => handleSetAll(false)}
              className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
            >
              Hide All
            </button>
          </div>
        </div>
      </div>

      {/* --- TODAY'S LIVE BUSINESS PULSE BANNER --- */}
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 p-4 sm:p-5 rounded-2xl border border-slate-800 text-white shadow-xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-teal-500/20 border border-teal-500/30 text-teal-400 flex items-center justify-center font-black shrink-0">
            <Zap className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm sm:text-base text-white">Today's Live Business Pulse</span>
              <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-extrabold rounded-md uppercase">
                {todayPulse.todayStr}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">Instant counter sales, cash collections & stock dispatches today</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full lg:w-auto text-xs font-mono">
          <div className="bg-slate-800/80 px-3.5 py-2 rounded-xl border border-slate-700/80">
            <span className="text-[10px] text-slate-400 font-sans block">Today's Sales</span>
            <span className="font-extrabold text-emerald-400 text-sm sm:text-base">{formatCurr(todayPulse.todaySales)}</span>
          </div>

          <div className="bg-slate-800/80 px-3.5 py-2 rounded-xl border border-slate-700/80">
            <span className="text-[10px] text-slate-400 font-sans block">Cash Received</span>
            <span className="font-extrabold text-blue-400 text-sm sm:text-base">{formatCurr(todayPulse.todayCash)}</span>
          </div>

          <div className="bg-slate-800/80 px-3.5 py-2 rounded-xl border border-slate-700/80">
            <span className="text-[10px] text-slate-400 font-sans block">Dispatched Pcs</span>
            <span className="font-extrabold text-cyan-400 text-sm sm:text-base">-{todayPulse.todayOutUnits.toLocaleString()} Pcs</span>
          </div>

          <div className="bg-slate-800/80 px-3.5 py-2 rounded-xl border border-slate-700/80">
            <span className="text-[10px] text-slate-400 font-sans block">Today's Expenses</span>
            <span className="font-extrabold text-rose-400 text-sm sm:text-base">{formatCurr(todayPulse.todayExp)}</span>
          </div>
        </div>
      </div>

      {/* --- WHOLESALE BUYER LIVE REQUESTS & ACTION CENTER --- */}
      {effectiveVisibility.buyerRequests && (() => {
        const pendingOrders = customerOrders.filter(o => o.status === 'Pending Approval');
        const pendingClaims = paymentClaims.filter(c => c.status === 'Pending');
        const pendingReturns = customerReturns.filter(r => r.status === 'Requested');
        const totalPendingBuyerReqs = pendingOrders.length + pendingClaims.length + pendingReturns.length;

        const visibleOrders = buyerReqStatusScope === 'pending' ? pendingOrders : customerOrders;
        const visibleClaims = buyerReqStatusScope === 'pending' ? pendingClaims : paymentClaims;
        const visibleReturns = buyerReqStatusScope === 'pending' ? pendingReturns : customerReturns;

        type UnifiedBuyerRequest =
          | { kind: 'order'; id: string; sortDate: string; isPending: boolean; data: CustomerOrder }
          | { kind: 'payment'; id: string; sortDate: string; isPending: boolean; data: PaymentClaim }
          | { kind: 'return'; id: string; sortDate: string; isPending: boolean; data: CustomerReturn };

        const unifiedList: UnifiedBuyerRequest[] = [
          ...(buyerReqFilter === 'all' || buyerReqFilter === 'orders'
            ? visibleOrders.map(o => ({
                kind: 'order' as const,
                id: `ord-${o.id}`,
                sortDate: o.updatedAt || o.createdAt,
                isPending: o.status === 'Pending Approval',
                data: o,
              }))
            : []),
          ...(buyerReqFilter === 'all' || buyerReqFilter === 'payments'
            ? visibleClaims.map(c => ({
                kind: 'payment' as const,
                id: `clm-${c.id}`,
                sortDate: c.resolvedAt || c.createdAt,
                isPending: c.status === 'Pending',
                data: c,
              }))
            : []),
          ...(buyerReqFilter === 'all' || buyerReqFilter === 'returns'
            ? visibleReturns.map(r => ({
                kind: 'return' as const,
                id: `ret-${r.id}`,
                sortDate: r.resolvedAt || r.createdAt,
                isPending: r.status === 'Requested',
                data: r,
              }))
            : []),
        ].sort((a, b) => {
          if (a.isPending !== b.isPending) return a.isPending ? -1 : 1;
          return (b.sortDate || '').localeCompare(a.sortDate || '');
        });

        return (
          <div className="corporate-card p-5 rounded-2xl border border-slate-200/90 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                  totalPendingBuyerReqs > 0
                    ? 'bg-rose-500/15 text-rose-600 border border-rose-200'
                    : 'bg-emerald-500/10 text-emerald-600 border border-emerald-200'
                }`}>
                  <Inbox className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-extrabold text-slate-900 text-sm sm:text-base">
                      Wholesale Buyer Live Requests Center (পাইকারি ক্রেতাদের অনুরোধ)
                    </h3>
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black ${
                      totalPendingBuyerReqs > 0
                        ? 'bg-rose-600 text-white'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {totalPendingBuyerReqs > 0 ? `${totalPendingBuyerReqs} Pending Approval` : 'All Clear'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Every portal order, payment slip submission, and return request appears here immediately for instant action.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setBuyerReqStatusScope('pending')}
                    className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                      buyerReqStatusScope === 'pending' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Pending ({totalPendingBuyerReqs})
                  </button>
                  <button
                    type="button"
                    onClick={() => setBuyerReqStatusScope('all')}
                    className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                      buyerReqStatusScope === 'all' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    All History ({customerOrders.length + paymentClaims.length + customerReturns.length})
                  </button>
                </div>

                {onNavigateTab && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onNavigateTab('sales')}
                      className="px-2.5 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 rounded-xl text-[11px] font-extrabold border border-teal-200 transition cursor-pointer"
                    >
                      Sales Module
                    </button>
                    <button
                      type="button"
                      onClick={() => onNavigateTab('accounts')}
                      className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-xl text-[11px] font-extrabold border border-amber-200 transition cursor-pointer"
                    >
                      Accounts Module
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => handleToggleModule('buyerRequests')}
                  aria-label="Hide Wholesale Buyer Live Requests Center"
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-200 hover:border-rose-200 rounded-xl text-[11px] font-bold inline-flex items-center gap-1 transition cursor-pointer"
                >
                  <EyeOff className="w-3.5 h-3.5" />
                  <span>Hide</span>
                </button>
              </div>
            </div>

            {/* Category Filter Strip */}
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
              {(
                [
                  { id: 'all', label: `All Requests (${visibleOrders.length + visibleClaims.length + visibleReturns.length})` },
                  { id: 'orders', label: `Portal Orders (${visibleOrders.length})` },
                  { id: 'payments', label: `Payment Claims (${visibleClaims.length})` },
                  { id: 'returns', label: `Return Requests (${visibleReturns.length})` },
                ] as const
              ).map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setBuyerReqFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-xl border transition cursor-pointer ${
                    buyerReqFilter === tab.id
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Unified Requests List */}
            {unifiedList.length === 0 ? (
              <div className="py-8 px-4 bg-slate-50/80 rounded-2xl border border-dashed border-slate-200 text-center text-xs text-slate-500">
                <CheckCircle2 className="w-7 h-7 text-emerald-500 mx-auto mb-1.5" />
                <p className="font-extrabold text-slate-700">
                  {buyerReqStatusScope === 'pending'
                    ? 'No pending wholesale buyer requests right now'
                    : 'No wholesale buyer portal requests recorded yet'}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  New orders, payment slips, and return claims submitted by buyers will appear here automatically.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 max-h-[420px] overflow-y-auto pr-1">
                {unifiedList.map(entry => {
                  if (entry.kind === 'order') {
                    const ord = entry.data;
                    const itemNamesPreview = ord.items.map(i => `${i.itemName} (${i.quantity})`).join(', ');
                    return (
                      <div
                        key={entry.id}
                        className={`p-3.5 rounded-2xl border flex flex-col justify-between gap-3 ${
                          ord.status === 'Pending Approval'
                            ? 'bg-rose-50/60 border-rose-200'
                            : 'bg-slate-50 border-slate-200/80'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 mt-0.5">
                              <ShoppingBag className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-rose-600 text-white">
                                  Portal Order
                                </span>
                                <span className="font-mono font-extrabold text-xs text-slate-900">{ord.orderNo}</span>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                  ord.status === 'Pending Approval' ? 'bg-amber-200 text-amber-950' :
                                  ord.status === 'Approved' ? 'bg-blue-100 text-blue-800' :
                                  ord.status === 'Delivered' || ord.linkedChalanNo ? 'bg-emerald-100 text-emerald-800' :
                                  'bg-slate-200 text-slate-700'
                                }`}>
                                  {ord.linkedChalanNo ? `Chalan ${ord.linkedChalanNo}` : ord.status}
                                </span>
                              </div>
                              <p className="font-extrabold text-slate-900 text-xs mt-1 truncate">
                                {ord.wholesalerName} {ord.customerPhone ? `(${ord.customerPhone})` : ''}
                              </p>
                              <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-2">{itemNamesPreview}</p>
                              {ord.advanceSubmitted ? (
                                <p className="text-[11px] text-emerald-700 font-bold mt-1">
                                  Advance: {formatCurr(ord.advanceSubmitted)} via {ord.paymentMethod || 'Transfer'}
                                  {ord.paymentRef ? ` (Ref: ${ord.paymentRef})` : ''}
                                </p>
                              ) : null}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-mono font-black text-sm text-slate-900">{formatCurr(ord.totalAmount)}</p>
                            <p className="text-[10px] text-slate-400 font-mono">{extractYYYYMMDD(ord.createdAt)}</p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-end gap-1.5 pt-2 border-t border-slate-200/70">
                          {ord.status === 'Pending Approval' && onApprovePortalOrder && (
                            <button
                              type="button"
                              onClick={() => onApprovePortalOrder(ord)}
                              className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-extrabold flex items-center gap-1 cursor-pointer transition"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Approve Order</span>
                            </button>
                          )}
                          {(ord.status === 'Pending Approval' || ord.status === 'Approved') && !ord.linkedInvoiceId && onConvertOrderToChalan && (
                            <button
                              type="button"
                              onClick={() => onConvertOrderToChalan(ord)}
                              className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[11px] font-extrabold flex items-center gap-1 cursor-pointer transition"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>Make Chalan</span>
                            </button>
                          )}
                          {ord.status === 'Pending Approval' && onRejectPortalOrder && (
                            <button
                              type="button"
                              onClick={() => onRejectPortalOrder(ord)}
                              className="px-2.5 py-1.5 bg-white hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer transition"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Reject</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  }

                  if (entry.kind === 'payment') {
                    const clm = entry.data;
                    return (
                      <div
                        key={entry.id}
                        className={`p-3.5 rounded-2xl border flex flex-col justify-between gap-3 ${
                          clm.status === 'Pending'
                            ? 'bg-amber-50/70 border-amber-200'
                            : 'bg-slate-50 border-slate-200/80'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
                              <Receipt className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-amber-600 text-white">
                                  Payment Claim
                                </span>
                                <span className="font-mono font-extrabold text-xs text-slate-900">{clm.claimNo}</span>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                  clm.status === 'Pending' ? 'bg-amber-200 text-amber-950' :
                                  clm.status === 'Approved' ? 'bg-emerald-100 text-emerald-800' :
                                  'bg-rose-100 text-rose-800'
                                }`}>
                                  {clm.status}
                                </span>
                              </div>
                              <p className="font-extrabold text-slate-900 text-xs mt-1 truncate">
                                {clm.wholesalerName} • {clm.paymentMethod}
                              </p>
                              <p className="text-[11px] text-slate-600 mt-0.5 font-mono">
                                Trx/Ref: <strong>{clm.trxId || 'N/A'}</strong> • Date: {clm.paymentDate}
                              </p>
                              {clm.notes && <p className="text-[11px] text-slate-500 mt-0.5 truncate">{clm.notes}</p>}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-mono font-black text-sm text-emerald-700">{formatCurr(clm.amount)}</p>
                            <p className="text-[10px] text-slate-400 font-mono">{extractYYYYMMDD(clm.createdAt)}</p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-end gap-1.5 pt-2 border-t border-slate-200/70">
                          {clm.slipImageUrl && (
                            <button
                              type="button"
                              onClick={() => setPreviewSlipUrl(clm.slipImageUrl!)}
                              className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer transition"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>View Slip</span>
                            </button>
                          )}
                          {clm.status === 'Pending' && onResolvePaymentClaim && (
                            <>
                              <button
                                type="button"
                                onClick={() => onResolvePaymentClaim(clm.id, 'Approved')}
                                className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-extrabold flex items-center gap-1 cursor-pointer transition"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Approve &amp; Deduct Due</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => onResolvePaymentClaim(clm.id, 'Rejected')}
                                className="px-2.5 py-1.5 bg-white hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer transition"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                <span>Reject</span>
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  }

                  const ret = entry.data;
                  const retItemsPreview = ret.items.map(i => `${i.itemName} (${i.quantity})`).join(', ');
                  return (
                    <div
                      key={entry.id}
                      className={`p-3.5 rounded-2xl border flex flex-col justify-between gap-3 ${
                        ret.status === 'Requested'
                          ? 'bg-orange-50/70 border-orange-200'
                          : 'bg-slate-50 border-slate-200/80'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center shrink-0 mt-0.5">
                            <RotateCcw className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-orange-600 text-white">
                                Return Request
                              </span>
                              <span className="font-mono font-extrabold text-xs text-slate-900">{ret.returnNo}</span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                ret.status === 'Requested' ? 'bg-amber-200 text-amber-950' :
                                ret.status === 'Credited' ? 'bg-emerald-100 text-emerald-800' :
                                'bg-rose-100 text-rose-800'
                              }`}>
                                {ret.status}
                              </span>
                            </div>
                            <p className="font-extrabold text-slate-900 text-xs mt-1 truncate">
                              {ret.wholesalerName} • Chalan #{ret.chalanNo}
                            </p>
                            <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-2">
                              {ret.reason} — {retItemsPreview}
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-mono font-black text-sm text-orange-700">{formatCurr(ret.totalCreditAmount)}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{extractYYYYMMDD(ret.createdAt)}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-end gap-1.5 pt-2 border-t border-slate-200/70">
                        {ret.status === 'Requested' && onResolveCustomerReturn && (
                          <>
                            <button
                              type="button"
                              onClick={() => onResolveCustomerReturn(ret.id, 'Approved')}
                              className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-extrabold flex items-center gap-1 cursor-pointer transition"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Approve Return Credit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onResolveCustomerReturn(ret.id, 'Rejected')}
                              className="px-2.5 py-1.5 bg-white hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer transition"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Reject</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Slip Preview Modal */}
            {previewSlipUrl && (
              <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
                  <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between">
                    <span className="text-xs font-extrabold">Uploaded Payment Deposit Slip</span>
                    <button
                      type="button"
                      onClick={() => setPreviewSlipUrl(null)}
                      className="text-xs font-bold text-slate-300 hover:text-white cursor-pointer"
                    >
                      Close ✕
                    </button>
                  </div>
                  <div className="p-4 bg-slate-100 flex items-center justify-center max-h-[70vh] overflow-auto">
                    <img src={previewSlipUrl} alt="Payment slip preview" className="max-w-full max-h-[60vh] rounded-xl object-contain" />
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* --- WOW LEVEL LUXURY EXECUTIVE 6 KPI METRICS CARDS GRID --- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        
        {/* KPI 1: Stock Intake & Returns */}
        <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/90 text-white p-4.5 sm:p-5 rounded-2xl border border-emerald-500/40 shadow-xl hover:shadow-2xl hover:border-emerald-400 transition-all duration-300 transform hover:-translate-y-1 relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-500"></div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Stock Intake + Returns</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center justify-center font-black shadow-md group-hover:scale-110 transition">
              <ArrowUpRight className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight">+{stockInSummary.totalQty.toLocaleString()}</span>
            <span className="text-[10px] font-extrabold text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded-md border border-emerald-500/30">
              +{stockInSummary.count} logs
            </span>
          </div>
          <div className="mt-3.5 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
            <span className="text-slate-400 font-medium">Cost Val:</span>
            <strong className="text-emerald-300 font-extrabold font-mono">{formatCurr(stockInSummary.totalVal)}</strong>
          </div>
        </div>

        {/* KPI 2: Stock Dispatched / Sold Qty */}
        <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950/90 text-white p-4.5 sm:p-5 rounded-2xl border border-cyan-500/40 shadow-xl hover:shadow-2xl hover:border-cyan-400 transition-all duration-300 transform hover:-translate-y-1 relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-400 via-sky-300 to-blue-500"></div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-black uppercase tracking-widest text-cyan-400">Dispatched Stock</span>
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center justify-center font-black shadow-md group-hover:scale-110 transition">
              <ArrowDownRight className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight">-{stockOutSummary.totalQty.toLocaleString()}</span>
            <span className="text-[10px] font-extrabold text-cyan-300 bg-cyan-500/20 px-2 py-0.5 rounded-md border border-cyan-500/30">
              -{stockOutSummary.count} logs
            </span>
          </div>
          <div className="mt-3.5 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
            <span className="text-slate-400 font-medium">Out Val:</span>
            <strong className="text-cyan-300 font-extrabold font-mono">{formatCurr(stockOutSummary.totalVal)}</strong>
          </div>
        </div>

        {/* KPI 3: Sales Revenue & Billed */}
        <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950/90 text-white p-4.5 sm:p-5 rounded-2xl border border-blue-500/40 shadow-xl hover:shadow-2xl hover:border-blue-400 transition-all duration-300 transform hover:-translate-y-1 relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-indigo-400 to-blue-600"></div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-black uppercase tracking-widest text-blue-400">Sales Billed</span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-300 border border-blue-500/40 flex items-center justify-center font-black shadow-md group-hover:scale-110 transition">
              <ShoppingCart className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl sm:text-2xl font-black text-white font-mono tracking-tight">{formatCurr(salesSummary.totalBilled)}</span>
          </div>
          <div className="mt-3.5 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
            <span className="text-slate-400 font-medium">Cash Paid:</span>
            <strong className="text-emerald-400 font-extrabold font-mono">{formatCurr(salesSummary.totalPaid)}</strong>
          </div>
        </div>

        {/* KPI 4: Total Available Stock */}
        <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/90 text-white p-4.5 sm:p-5 rounded-2xl border border-indigo-500/40 shadow-xl hover:shadow-2xl hover:border-indigo-400 transition-all duration-300 transform hover:-translate-y-1 relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-400 to-indigo-600"></div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300">Available Stock</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 flex items-center justify-center font-black shadow-md group-hover:scale-110 transition">
              <Package className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight">{totalInventoryCount.toLocaleString()}</span>
            <span className="text-[10px] font-extrabold text-indigo-300 bg-indigo-500/20 px-2 py-0.5 rounded-md border border-indigo-500/30">
              {items.length} SKUs
            </span>
          </div>
          <div className="mt-3.5 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
            <span className="text-slate-400 font-medium">Asset Worth:</span>
            <strong className="text-indigo-300 font-extrabold font-mono">{formatCurr(totalInventoryValue)}</strong>
          </div>
        </div>

        {/* KPI 5: Net Profit & Margin */}
        <div className={`p-4.5 sm:p-5 rounded-2xl border shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 relative overflow-hidden group ${
          financialProfitSummary.netProfit >= 0 
            ? 'bg-gradient-to-br from-slate-950 via-emerald-950 to-slate-950 text-white border-emerald-400/50 hover:border-emerald-300' 
            : 'bg-gradient-to-br from-slate-950 via-rose-950 to-slate-950 text-white border-rose-500/50 hover:border-rose-400'
        }`}>
          <div className={`absolute top-0 left-0 w-full h-1 ${
            financialProfitSummary.netProfit >= 0 
              ? 'bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-500' 
              : 'bg-gradient-to-r from-rose-500 via-pink-400 to-rose-600'
          }`}></div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Net Profit (নিট লাভ)</span>
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500 to-cyan-500 text-slate-950 flex items-center justify-center font-black shadow-md group-hover:scale-110 transition">
              <Coins className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className={`text-xl sm:text-2xl font-black font-mono tracking-tight ${
              financialProfitSummary.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}>
              {formatCurr(financialProfitSummary.netProfit)}
            </span>
          </div>
          <div className="mt-3.5 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
            <span className="text-slate-400 font-medium">Profit Margin:</span>
            <span className="font-extrabold text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded-md border border-emerald-500/30 font-mono">
              {financialProfitSummary.margin}%
            </span>
          </div>
        </div>

        {/* KPI 6: Critical Alerts & Dues */}
        <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-amber-950/90 text-white p-4.5 sm:p-5 rounded-2xl border border-amber-500/40 shadow-xl hover:shadow-2xl hover:border-amber-400 transition-all duration-300 transform hover:-translate-y-1 relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 via-orange-400 to-rose-500"></div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">Alerts & Market Due</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center justify-center font-black shadow-md group-hover:scale-110 transition">
              <AlertTriangle className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-black text-amber-400 font-mono tracking-tight">{lowStockItems.length + outOfStockItems.length}</span>
            <span className="text-[10px] font-extrabold text-rose-300 bg-rose-500/20 px-2 py-0.5 rounded-md border border-rose-500/30">
              {outOfStockItems.length} Zero
            </span>
          </div>
          <div className="mt-3.5 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
            <span className="text-slate-400 font-medium">Market Due:</span>
            <strong className="text-rose-400 font-extrabold font-mono">{formatCurr(totalMarketDue)}</strong>
          </div>
        </div>

      </div>

      {/* --- 30-DAY EXPIRY PRIORITY WATCHLIST --- */}
      {effectiveVisibility.expiryWatchlist && (
        <ExpiringSoonCard
          items={items}
          currency={currency}
          onNavigateTab={onNavigateTab}
          onHide={() => handleToggleModule('expiryWatchlist')}
        />
      )}

      {/* --- 12-MONTH SALES VS. EXPENSES LINE CHART (RECHARTS) --- */}
      {effectiveVisibility.salesVsExpenses && (
      <section
        aria-label="Sales vs Expenses Last 12 Months"
        className="corporate-card p-5 sm:p-6 rounded-2xl border border-slate-200/90 space-y-5"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base">
                Sales vs. Expenses — Last 12 Months
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Monthly revenue from invoice dates compared against operating costs from expense dates
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-xs">
            <div>
              <span className="text-slate-500 block text-[11px]">12M Sales</span>
              <strong className="font-mono tabular-nums text-sm font-extrabold text-emerald-700">
                {formatCurr(twelveMonthTotals.totalSales)}
              </strong>
            </div>
            <div className="h-7 w-px bg-slate-200" aria-hidden="true" />
            <div>
              <span className="text-slate-500 block text-[11px]">12M Expenses</span>
              <strong className="font-mono tabular-nums text-sm font-extrabold text-rose-600">
                {formatCurr(twelveMonthTotals.totalExpenses)}
              </strong>
            </div>
            <div className="h-7 w-px bg-slate-200" aria-hidden="true" />
            <div>
              <span className="text-slate-500 block text-[11px]">12M Net</span>
              <strong
                className={`font-mono tabular-nums text-sm font-extrabold ${
                  twelveMonthTotals.net >= 0 ? 'text-slate-900' : 'text-rose-700'
                }`}
              >
                {formatCurr(twelveMonthTotals.net)}
              </strong>
            </div>
            <button
              type="button"
              onClick={() => handleToggleModule('salesVsExpenses')}
              aria-label="Hide Sales vs Expenses Last 12 Months"
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-200 hover:border-rose-200 rounded-xl text-[11px] font-bold inline-flex items-center gap-1 transition cursor-pointer"
            >
              <EyeOff className="w-3.5 h-3.5" />
              <span>Hide</span>
            </button>
          </div>
        </div>

        <div className="h-72 sm:h-80 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={monthlySalesVsExpenses}
              margin={{ top: 12, right: 20, left: 4, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis
                dataKey="monthLabel"
                fontSize={11}
                stroke="#64748b"
                tickMargin={6}
              />
              <YAxis
                fontSize={11}
                stroke="#64748b"
                width={56}
                tickFormatter={(val: number) =>
                  Math.abs(val) >= 1000 ? `${(val / 1000).toFixed(0)}k` : String(val)
                }
              />
              <Tooltip
                labelFormatter={(_, payloadItems) => {
                  const pt = payloadItems?.[0]?.payload;
                  if (!pt) return '';
                  return `${pt.monthLabel} (${pt.monthKey}) · ${pt.invoiceCount} invoices, ${pt.expenseCount} expenses`;
                }}
                formatter={(val: any, name: any) => [
                  formatCurr(Number(val) || 0),
                  String(name),
                ]}
                wrapperStyle={{ fontSize: '12px' }}
              />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
              <Line
                type="monotone"
                dataKey="Sales"
                name="Sales"
                stroke="#10B981"
                strokeWidth={3}
                dot={{ r: 3.5 }}
                activeDot={{ r: 6 }}
              />
              <Line
                type="monotone"
                dataKey="Expenses"
                name="Expenses"
                stroke="#EF4444"
                strokeWidth={3}
                dot={{ r: 3.5 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {twelveMonthTotals.totalSales === 0 && twelveMonthTotals.totalExpenses === 0 && (
          <p className="text-xs text-slate-500 text-center">
            No sales invoices or expenses recorded within the last 12 months yet — values default to 0.
          </p>
        )}
      </section>
      )}

      {/* --- CURRENT MONTH NET PROFIT BY PRODUCT CATEGORY (RECHARTS BAR CHART) --- */}
      {effectiveVisibility.categoryNetProfit && (
      <section
        aria-label="Net Profit by Product Category Current Month"
        className="corporate-card p-5 sm:p-6 rounded-2xl border border-slate-200/90 space-y-5"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 border border-teal-200 flex items-center justify-center shrink-0">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base">
                Net Profit by Product Category — {currentMonthLabel}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Current month category revenue less cost of goods sold and revenue-weighted operating expenses
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-xs">
            <div>
              <span className="text-slate-500 block text-[11px]">Month Sales</span>
              <strong className="font-mono tabular-nums text-sm font-extrabold text-slate-900">
                {formatCurr(currentMonthCategoryTotals.revenue)}
              </strong>
            </div>
            <div className="h-7 w-px bg-slate-200" aria-hidden="true" />
            <div>
              <span className="text-slate-500 block text-[11px]">COGS &amp; Expenses</span>
              <strong className="font-mono tabular-nums text-sm font-extrabold text-amber-700">
                {formatCurr(currentMonthCategoryTotals.expensesAndCogs)}
              </strong>
            </div>
            <div className="h-7 w-px bg-slate-200" aria-hidden="true" />
            <div>
              <span className="text-slate-500 block text-[11px]">Net Profit</span>
              <strong
                className={`font-mono tabular-nums text-sm font-extrabold ${
                  currentMonthCategoryTotals.netProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'
                }`}
              >
                {formatCurr(currentMonthCategoryTotals.netProfit)}
              </strong>
            </div>
            <button
              type="button"
              onClick={() => handleToggleModule('categoryNetProfit')}
              aria-label="Hide Net Profit by Product Category"
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-200 hover:border-rose-200 rounded-xl text-[11px] font-bold inline-flex items-center gap-1 transition cursor-pointer"
            >
              <EyeOff className="w-3.5 h-3.5" />
              <span>Hide</span>
            </button>
          </div>
        </div>

        <div className="h-72 sm:h-80 w-full min-w-0">
          {categoryNetProfitData.length === 0 ? (
            <div className="h-full bg-slate-50/80 rounded-2xl border border-dashed border-slate-200 flex flex-col items-center justify-center p-6 text-center">
              <BarChart3 className="w-8 h-8 text-slate-400 mb-2" />
              <p className="text-sm font-extrabold text-slate-800">
                No product category sales recorded in {currentMonthLabel} yet
              </p>
              <p className="text-xs text-slate-500 mt-1 max-w-md">
                Create a retail POS or wholesale invoice this month to see category-level net profit performance.
              </p>
              {onNavigateTab && (
                <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => onNavigateTab('pos')}
                    className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    Open Retail POS
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigateTab('sales')}
                    className="px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-800 rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    Create Wholesale Chalan
                  </button>
                </div>
              )}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={categoryNetProfitData}
                margin={{ top: 14, right: 20, left: 6, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis
                  dataKey="category"
                  fontSize={11}
                  stroke="#64748b"
                  tickMargin={6}
                />
                <YAxis
                  fontSize={11}
                  stroke="#64748b"
                  width={60}
                  tickFormatter={(val: number) =>
                    Math.abs(val) >= 1000 ? `${(val / 1000).toFixed(0)}k` : String(val)
                  }
                />
                <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" />
                <Tooltip
                  formatter={(val: any, _name: any, item: any) => {
                    const p = item?.payload;
                    if (!p) return [formatCurr(Number(val) || 0), 'Net Profit'];
                    return [
                      `${formatCurr(p.netProfit)} · Margin ${p.marginPct}% (Rev ${formatCurr(p.revenue)} / COGS ${formatCurr(p.cogs)} / Exp ${formatCurr(p.allocatedExpense)})`,
                      'Net Profit',
                    ];
                  }}
                  labelFormatter={(label) => `Category: ${label} (${currentMonthLabel})`}
                  wrapperStyle={{ fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                <Bar
                  dataKey="netProfit"
                  name={`Net Profit (${currentMonthLabel})`}
                  fill="#10B981"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={64}
                >
                  {categoryNetProfitData.map((entry) => (
                    <Cell
                      key={`cat-net-${entry.category}`}
                      fill={entry.netProfit >= 0 ? '#10B981' : '#EF4444'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>
      )}

      {/* --- MASTER UNIFIED CHARTS HUB (একক সমন্বিত চার্ট হাব) --- */}
      <div className="corporate-card p-5 sm:p-6 rounded-2xl space-y-6">
        
        {/* Hub Header & View Mode Switcher */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-teal-500/10 text-teal-600 flex items-center justify-center font-black">
                <Activity className="w-4.5 h-4.5 text-teal-600" />
              </div>
              <h3 className="font-extrabold text-slate-900 text-base">Unified Visual Analytics Hub (একক সমন্বিত চার্ট হাব)</h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              All 4 interactive charts (Line, Bar, Pie, & Doughnut) unified in one central view
            </p>
          </div>

          {/* Mode Switcher Buttons */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold w-full md:w-auto overflow-x-auto">
            <button
              type="button"
              onClick={() => setChartHubView('grid')}
              className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap ${
                chartHubView === 'grid' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              📊 All Charts (Grid)
            </button>
            <button
              type="button"
              onClick={() => setChartHubView('line')}
              className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap ${
                chartHubView === 'line' ? 'bg-teal-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              📈 Line Flow
            </button>
            <button
              type="button"
              onClick={() => setChartHubView('bar')}
              className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap ${
                chartHubView === 'bar' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              📊 Bar Levels
            </button>
            <button
              type="button"
              onClick={() => setChartHubView('pie')}
              className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap ${
                chartHubView === 'pie' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🥧 Pie Share
            </button>
            <button
              type="button"
              onClick={() => setChartHubView('doughnut')}
              className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap ${
                chartHubView === 'doughnut' ? 'bg-cyan-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🍩 Doughnut Health
            </button>
          </div>
        </div>

        {/* --- GRID VIEW OR INDIVIDUAL EXPANDED VIEW --- */}
        {chartHubView === 'grid' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* CHART 1: Line Chart */}
            <div className="bg-slate-50/70 p-4 sm:p-5 rounded-2xl border border-slate-200/80 flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-extrabold text-slate-900 text-xs sm:text-sm">Stock Intake vs Dispatch Flow</h4>
                <span className="px-2 py-0.5 bg-teal-100 text-teal-800 rounded-md text-[10px] font-extrabold uppercase">Line Chart</span>
              </div>
              <div className="h-60 w-full">
                {lineTrendData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400 font-bold">No transaction logs in timeframe</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={lineTrendData} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="displayDate" fontSize={10} stroke="#64748b" tickMargin={4} />
                      <YAxis fontSize={10} stroke="#94a3b8" />
                      <Tooltip 
                        labelFormatter={(_, payloadItems) => {
                          if (payloadItems && payloadItems.length > 0 && payloadItems[0].payload) {
                            return `Date: ${payloadItems[0].payload.date}`;
                          }
                          return '';
                        }}
                        formatter={(val: any, name: any) => [`${val} units`, name]}
                        wrapperStyle={{ fontSize: '11px' }} 
                      />
                      <Legend wrapperStyle={{ fontSize: '10px' }} />
                      <Line type="monotone" dataKey="StockIn" stroke="#10B981" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 6 }} name="Stock In + Return" />
                      <Line type="monotone" dataKey="StockOut" stroke="#06B6D4" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 6 }} name="Stock Out" />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* CHART 2: Bar Chart */}
            <div className="bg-slate-50/70 p-4 sm:p-5 rounded-2xl border border-slate-200/80 flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-extrabold text-slate-900 text-xs sm:text-sm">Top Inventory Stock Levels</h4>
                <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-md text-[10px] font-extrabold uppercase">Bar Chart</span>
              </div>
              <div className="h-60 w-full">
                {barTopItemsData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400 font-bold">No inventory products found</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barTopItemsData} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" fontSize={10} stroke="#64748b" tickMargin={4} />
                      <YAxis fontSize={10} stroke="#94a3b8" />
                      <Tooltip 
                        labelFormatter={(_, payloadItems) => {
                          if (payloadItems && payloadItems.length > 0 && payloadItems[0].payload) {
                            return `Product: ${payloadItems[0].payload.fullName}`;
                          }
                          return '';
                        }}
                        formatter={(val: any, name: any, item: any) => [
                          `${val} ${item?.payload?.unit || 'units'}`, 
                          name === 'quantity' ? 'Current Available Stock' : 'Reorder Alert Limit'
                        ]}
                        wrapperStyle={{ fontSize: '11px' }} 
                      />
                      <Legend wrapperStyle={{ fontSize: '10px' }} />
                      <Bar dataKey="quantity" fill="#3B82F6" radius={[4, 4, 0, 0]} name="Current Stock" />
                      <Bar dataKey="threshold" fill="#CBD5E1" radius={[4, 4, 0, 0]} name="Reorder Alert" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* CHART 3: Pie Chart */}
            <div className="bg-slate-50/70 p-4 sm:p-5 rounded-2xl border border-slate-200/80 flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-extrabold text-slate-900 text-xs sm:text-sm">Category Volume Share</h4>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md text-[10px] font-extrabold uppercase">Pie Chart</span>
              </div>
              <div className="h-60 w-full">
                {pieCategoryData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400 font-bold">No product data registered</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieCategoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={0}
                        outerRadius={80}
                        fill="#8884d8"
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, percent }: any) => `${name ? name.split(' ')[0] : ''} (${percent ? (percent * 100).toFixed(0) : 0}%)`}
                        labelLine={false}
                      >
                        {pieCategoryData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(val) => [`${val} units`, 'Quantity']} />
                      <Legend wrapperStyle={{ fontSize: '10px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* CHART 4: Doughnut Chart */}
            <div className="bg-slate-50/70 p-4 sm:p-5 rounded-2xl border border-slate-200/80 flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-extrabold text-slate-900 text-xs sm:text-sm">Inventory Health Breakdown</h4>
                <span className="px-2 py-0.5 bg-cyan-100 text-cyan-800 rounded-md text-[10px] font-extrabold uppercase">Doughnut Chart</span>
              </div>
              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={doughnutStatusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      fill="#8884d8"
                      paddingAngle={4}
                      dataKey="value"
                      label={({ name, value }) => value > 0 ? `${name}: ${value}` : ''}
                      labelLine={false}
                    >
                      {doughnutStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(val) => [`${val} SKUs`, 'Count']} />
                    <Legend wrapperStyle={{ fontSize: '10px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>
        )}

        {/* INDIVIDUAL EXPANDED CHART VIEWS */}
        {chartHubView === 'line' && (
          <div className="bg-slate-50/70 p-5 rounded-2xl border border-slate-200/80 space-y-3">
            <h4 className="font-extrabold text-slate-900 text-base">📈 Daily Stock Intake vs Dispatch Flow Trendline</h4>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={lineTrendData} margin={{ top: 15, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="displayDate" fontSize={11} stroke="#64748b" />
                  <YAxis fontSize={11} stroke="#94a3b8" />
                  <Tooltip 
                    labelFormatter={(_, payloadItems) => payloadItems?.[0]?.payload ? `Date: ${payloadItems[0].payload.date}` : ''}
                    formatter={(val: any, name: any) => [`${val} units`, name]}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="StockIn" stroke="#10B981" strokeWidth={3} dot={{ r: 5 }} activeDot={{ r: 8 }} name="Stock In + Return (Qty)" />
                  <Line type="monotone" dataKey="StockOut" stroke="#06B6D4" strokeWidth={3} dot={{ r: 5 }} activeDot={{ r: 8 }} name="Stock Out (Qty)" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {chartHubView === 'bar' && (
          <div className="bg-slate-50/70 p-5 rounded-2xl border border-slate-200/80 space-y-3">
            <h4 className="font-extrabold text-slate-900 text-base">📊 Top Available Inventory Quantity vs Reorder Threshold</h4>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barTopItemsData} margin={{ top: 15, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" fontSize={11} stroke="#64748b" />
                  <YAxis fontSize={11} stroke="#94a3b8" />
                  <Tooltip 
                    labelFormatter={(_, payloadItems) => payloadItems?.[0]?.payload ? `Product: ${payloadItems[0].payload.fullName}` : ''}
                    formatter={(val: any, name: any, item: any) => [`${val} ${item?.payload?.unit || 'units'}`, name === 'quantity' ? 'Available Stock' : 'Reorder Limit']}
                  />
                  <Legend />
                  <Bar dataKey="quantity" fill="#3B82F6" radius={[6, 6, 0, 0]} name="Current Stock" />
                  <Bar dataKey="threshold" fill="#CBD5E1" radius={[6, 6, 0, 0]} name="Reorder Alert Level" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {chartHubView === 'pie' && (
          <div className="bg-slate-50/70 p-5 rounded-2xl border border-slate-200/80 space-y-3">
            <h4 className="font-extrabold text-slate-900 text-base">🥧 Stock Quantity Distribution Across Categories</h4>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieCategoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={0}
                    outerRadius={105}
                    fill="#8884d8"
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, percent }: any) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  >
                    {pieCategoryData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(val) => [`${val} units`, 'Quantity']} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {chartHubView === 'doughnut' && (
          <div className="bg-slate-50/70 p-5 rounded-2xl border border-slate-200/80 space-y-3">
            <h4 className="font-extrabold text-slate-900 text-base">🍩 Overall Inventory Health & Stock Status Breakdown</h4>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={doughnutStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={75}
                    outerRadius={105}
                    fill="#8884d8"
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, value }) => value > 0 ? `${name}: ${value}` : ''}
                  >
                    {doughnutStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(val) => [`${val} SKUs`, 'Count']} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

      </div>

      {/* --- TWO NEW DYNAMIC OPERATIONAL INSIGHT CARDS --- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* WIDGET A: TOP 5 FASTEST MOVING PRODUCTS */}
        <div className="corporate-card p-5 rounded-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                  <Award className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-900 text-sm">Top 5 Fastest Selling Products (সেরা বিক্রিত পণ্য)</h4>
                  <p className="text-[11px] text-slate-500">Ranked by total dispatched volume in sales chalans</p>
                </div>
              </div>
              {onNavigateTab && (
                <button
                  type="button"
                  onClick={() => onNavigateTab('sales')}
                  className="text-xs font-bold text-teal-600 hover:underline flex items-center gap-0.5"
                >
                  <span>POS Sales</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="space-y-2.5">
              {topSellers.map((item, idx) => (
                <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <span className={`w-6 h-6 rounded-lg font-black text-xs flex items-center justify-center ${
                      idx === 0 ? 'bg-amber-400 text-slate-950' : idx === 1 ? 'bg-slate-300 text-slate-900' : idx === 2 ? 'bg-amber-600/30 text-amber-900' : 'bg-slate-200 text-slate-700'
                    }`}>
                      #{idx + 1}
                    </span>
                    <div>
                      <p className="font-extrabold text-slate-900">{item.name}</p>
                      <p className="text-[10px] text-slate-500">{item.category}</p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="font-black text-emerald-700 block">{item.totalQty.toLocaleString()} {item.unit} Sold</span>
                    <span className="text-[10px] font-mono text-slate-500">{formatCurr(item.totalRevenue)} Billed</span>
                  </div>
                </div>
              ))}

              {topSellers.length === 0 && (
                <div className="text-center py-8 text-xs text-slate-400 font-semibold">
                  No sales order records logged yet. Process sales in POS or Wholesale.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* WIDGET B: CRITICAL REORDER & LOW STOCK ACTION LIST */}
        <div className="corporate-card p-5 rounded-2xl flex flex-col">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <h4 className="font-extrabold text-slate-900 text-sm">Critical Reorder List</h4>
            </div>
            <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-xl border border-amber-200 font-mono tabular-nums">
              {lowStockItems.length + outOfStockItems.length} Items
            </span>
          </div>

          <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[340px] pr-1">
            {outOfStockItems.map(item => (
              <div key={item.id} className="p-3 bg-rose-50 border border-rose-200/80 rounded-xl flex items-center justify-between text-xs">
                <div>
                  <p className="font-extrabold text-slate-900">{item.name}</p>
                  <p className="text-[10px] text-slate-500">{item.supplier} • <span className="text-rose-600 font-extrabold font-mono tabular-nums">0 {item.unit}</span></p>
                </div>
                <span className="px-2 py-0.5 bg-rose-500 text-white font-extrabold rounded-md text-[10px] whitespace-nowrap">ZERO STOCK</span>
              </div>
            ))}
            {lowStockItems.map(item => (
              <div key={item.id} className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl flex items-center justify-between text-xs">
                <div>
                  <p className="font-extrabold text-slate-900">{item.name}</p>
                  <p className="text-[10px] text-slate-600">Stock: <strong className="text-amber-800 font-extrabold font-mono tabular-nums">{item.quantity} {item.unit}</strong> (Limit: {item.reorderThreshold})</p>
                </div>
                <span className="px-2 py-0.5 bg-amber-500 text-slate-950 font-extrabold rounded-md text-[10px] whitespace-nowrap">LOW STOCK</span>
              </div>
            ))}
            {lowStockItems.length === 0 && outOfStockItems.length === 0 && (
              <div className="text-center py-12 text-xs text-slate-400 font-semibold">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                All stock items are sufficiently above threshold limits!
              </div>
            )}
          </div>
        </div>

      </div>

      {/* --- BOTTOM SECTION: OPERATIONAL ACTIVITY AUDIT LOG --- */}
      <div>
        <div className="corporate-card p-5 rounded-2xl flex flex-col">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-teal-600" />
              <h4 className="font-extrabold text-slate-900 text-sm">Operational Activity Audit Log</h4>
            </div>

            <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setRecentTab('txns')}
                className={`px-3 py-1 rounded-lg transition ${
                  recentTab === 'txns' ? 'bg-white text-teal-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Stock Movements
              </button>
              <button
                type="button"
                onClick={() => setRecentTab('invoices')}
                className={`px-3 py-1 rounded-lg transition ${
                  recentTab === 'invoices' ? 'bg-white text-teal-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Sales Orders / Chalans
              </button>
            </div>
          </div>

          <div className="overflow-x-auto flex-1">
            {recentTab === 'txns' && (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 uppercase tracking-wider text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="p-3 font-bold">Type</th>
                    <th className="p-3 font-bold">Item Name</th>
                    <th className="p-3 font-bold">Quantity</th>
                    <th className="p-3 font-bold">Total Val</th>
                    <th className="p-3 font-bold">Date & Time</th>
                    <th className="p-3 font-bold">Operator</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTransactions.slice(0, 6).map(t => (
                    <tr key={t.id} className="hover:bg-slate-50 transition">
                      <td className="p-3 font-medium">
                        <span className={`whitespace-nowrap inline-block px-2 py-0.5 rounded text-[10px] font-extrabold ${
                          t.type === 'IN' ? 'bg-emerald-100 text-emerald-700' : t.type === 'RETURN' ? 'bg-amber-100 text-amber-700' : 'bg-cyan-100 text-cyan-700'
                        }`}>
                          {t.type === 'IN' ? 'STOCK IN' : t.type === 'RETURN' ? 'RETURN' : 'STOCK OUT'}
                        </span>
                      </td>
                      <td className="p-3 font-extrabold text-slate-900">{t.itemName}</td>
                      <td className="p-3 text-slate-800 font-bold">{t.quantity}</td>
                      <td className="p-3 text-slate-900 font-mono font-bold">{formatCurr(t.totalPrice)}</td>
                      <td className="p-3 text-slate-500 font-mono">{t.date.replace('T', ' ')}</td>
                      <td className="p-3 text-slate-600 font-semibold">{t.user}</td>
                    </tr>
                  ))}
                  {filteredTransactions.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-10 text-slate-400 font-semibold">
                        No stock transaction records in selected date filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            {recentTab === 'invoices' && (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 uppercase tracking-wider text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="p-3 font-bold">Chalan No</th>
                    <th className="p-3 font-bold">Customer Name</th>
                    <th className="p-3 font-bold text-right">Grand Total</th>
                    <th className="p-3 font-bold text-right">Cash Paid</th>
                    <th className="p-3 font-bold text-right">Due Left</th>
                    <th className="p-3 font-bold text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredInvoices.slice(0, 6).map(inv => (
                    <tr key={inv.id} className="hover:bg-slate-50 transition">
                      <td className="p-3 font-mono font-extrabold text-slate-900">{inv.chalanNo}</td>
                      <td className="p-3 font-bold text-blue-700">{inv.wholesalerName}</td>
                      <td className="p-3 text-right font-mono font-bold text-slate-900">{formatCurr(inv.totalAmount)}</td>
                      <td className="p-3 text-right font-mono font-bold text-emerald-600">{formatCurr(inv.paidAmount)}</td>
                      <td className="p-3 text-right font-mono font-extrabold text-rose-600">{formatCurr(inv.dueAmount)}</td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                          inv.status === 'Paid' ? 'bg-emerald-100 text-emerald-800' :
                          inv.status === 'Partial' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {inv.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {filteredInvoices.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-10 text-slate-400 font-semibold">
                        No sales chalan records in selected date filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </div>

    </div>
  );
};
