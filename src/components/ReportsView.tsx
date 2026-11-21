import React, { useState, useMemo } from 'react';
import { 
  StockItem, 
  StockTransaction, 
  Invoice, 
  Wholesaler, 
  AccountTxn, 
  Supplier, 
  Category,
  SalesRep,
  PurchaseOrder
} from '../data/mockData';
import { 
  Calendar, 
  Download, 
  Printer, 
  Search, 
  Layers, 
  FileSpreadsheet,
  RefreshCw,
  PackageX,
  AlertTriangle,
  DollarSign,
  ShoppingCart,
  Sparkles,
  Clock,
  Award,
  Truck,
  PackageCheck
} from 'lucide-react';
import { 
  getLocalYYYYMMDD, 
  getDaysAgoYYYYMMDD,
  getFirstDayOfMonthYYYYMMDD, 
  getLastMonthRangeYYYYMMDD,
  extractYYYYMMDD 
} from '../utils/dateUtils';
import { computeDueAgingReport, computeSalesRepMetrics } from '../utils/erpEnhancements';
import {
  buildSupplierPurchaseCsv,
  computeSupplierPurchaseReport,
} from '../utils/purchaseReportUtils';
import { computeProductProfitAndDeadStock } from '../utils/erpFeatureUtils';
import {
  downloadProfitDeadStockPdf,
  downloadSupplierPurchaseReportPdf,
} from '../utils/printAndDownload';

interface ReportsViewProps {
  items: StockItem[];
  transactions: StockTransaction[];
  invoices: Invoice[];
  wholesalers: Wholesaler[];
  accountTxns: AccountTxn[];
  suppliers: Supplier[];
  categories: Category[];
  salesReps?: SalesRep[];
  purchaseOrders?: PurchaseOrder[];
  currency: string;
  storeName: string;
  brandName: string;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  items,
  transactions,
  invoices,
  wholesalers,
  accountTxns,
  suppliers,
  categories,
  salesReps = [],
  purchaseOrders = [],
  currency,
  storeName,
  brandName
}) => {
  // UI Date State
  const [filterStart, setFilterStart] = useState<string>(getFirstDayOfMonthYYYYMMDD());
  const [filterEnd, setFilterEnd] = useState<string>(getLocalYYYYMMDD());
  const [activePreset, setActivePreset] = useState<string>('This Month');
  
  // Applied Filter State (Updates when "Search Report" is clicked)
  const [appliedStart, setAppliedStart] = useState<string>(getFirstDayOfMonthYYYYMMDD());
  const [appliedEnd, setAppliedEnd] = useState<string>(getLocalYYYYMMDD());

  // Additional Filter Controls
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedSupplier, setSelectedSupplier] = useState<string>('All');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => getLocalYYYYMMDD().slice(0, 7));
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [reportType, setReportType] = useState<
    'inventory' | 'purchases' | 'profit-deadstock' | 'sales' | 'accounts' | 'valuation' | 'reorder' | 'aging' | 'salesreps'
  >('inventory');
  const [purchaseSubView, setPurchaseSubView] = useState<'summary' | 'by-supplier' | 'entries'>('summary');
  const [deadStockThresholdDays, setDeadStockThresholdDays] = useState<number>(60);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [exportMsg, setExportMsg] = useState<string>('');

  // Handle Quick Date Presets
  const handlePreset = (preset: string) => {
    setActivePreset(preset);
    const today = getLocalYYYYMMDD();
    let start = filterStart;
    let end = filterEnd;

    if (preset === 'Today') {
      start = today;
      end = today;
    } else if (preset === 'Yesterday') {
      const yesterday = getDaysAgoYYYYMMDD(1);
      start = yesterday;
      end = yesterday;
    } else if (preset === 'Last 7 Days') {
      start = getDaysAgoYYYYMMDD(7);
      end = today;
    } else if (preset === 'This Month') {
      start = getFirstDayOfMonthYYYYMMDD();
      end = today;
      setSelectedMonth(today.slice(0, 7));
    } else if (preset === 'Last Month') {
      const lastM = getLastMonthRangeYYYYMMDD();
      start = lastM.start;
      end = lastM.end;
      setSelectedMonth(lastM.start.slice(0, 7));
    } else if (preset === 'All Time') {
      start = '2000-01-01';
      end = '2100-12-31';
    }

    setFilterStart(start);
    setFilterEnd(end);
    setAppliedStart(start);
    setAppliedEnd(end);
  };

  const handleMonthSelect = (ym: string) => {
    setSelectedMonth(ym);
    if (!/^\d{4}-\d{2}$/.test(ym)) return;
    const [yStr, mStr] = ym.split('-');
    const year = Number(yStr);
    const monthIdx = Number(mStr) - 1;
    const start = getLocalYYYYMMDD(new Date(year, monthIdx, 1));
    const end = getLocalYYYYMMDD(new Date(year, monthIdx + 1, 0));
    setFilterStart(start);
    setFilterEnd(end);
    setAppliedStart(start);
    setAppliedEnd(end);
    setActivePreset(`Month: ${ym}`);
  };

  // Trigger Report Generation
  const handleGenerateReport = () => {
    setIsGenerating(true);
    setAppliedStart(filterStart);
    setAppliedEnd(filterEnd);
    setTimeout(() => {
      setIsGenerating(false);
    }, 300);
  };

  // --- DYNAMIC DATA CALCULATIONS ---

  // 1. Inventory Report Items Calculation
  const inventoryReportData = useMemo(() => {
    return items.map(item => {
      // Transactions in the current applied period
      const periodTxns = transactions.filter(t => {
        const d = extractYYYYMMDD(t.date);
        return t.itemId === item.id && d >= appliedStart && d <= appliedEnd;
      });

      const stockIn = periodTxns.filter(t => t.type === 'IN').reduce((sum, t) => sum + t.quantity, 0);
      const stockOut = periodTxns.filter(t => t.type === 'OUT').reduce((sum, t) => sum + t.quantity, 0);
      const stockReturn = periodTxns.filter(t => t.type === 'RETURN').reduce((sum, t) => sum + t.quantity, 0);

      // Transactions AFTER the applied end date (to reverse-calculate stock at end date)
      const futureTxns = transactions.filter(t => {
        const d = extractYYYYMMDD(t.date);
        return t.itemId === item.id && d > appliedEnd;
      });
      const futureIn = futureTxns.filter(t => t.type === 'IN' || t.type === 'RETURN').reduce((sum, t) => sum + t.quantity, 0);
      const futureOut = futureTxns.filter(t => t.type === 'OUT').reduce((sum, t) => sum + t.quantity, 0);

      const closingStock = item.quantity - futureIn + futureOut;
      const openingStock = closingStock - stockIn - stockReturn + stockOut;
      const totalValuation = closingStock * item.price;

      return {
        ...item,
        openingStock,
        stockIn,
        stockReturn,
        stockOut,
        closingStock,
        totalValuation
      };
    }).filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            item.sku.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [items, transactions, appliedStart, appliedEnd, searchQuery, selectedCategory]);

  // Inventory Totals Summary
  const inventoryTotals = useMemo(() => {
    const totalOpening = inventoryReportData.reduce((acc, i) => acc + i.openingStock, 0);
    const totalIn = inventoryReportData.reduce((acc, i) => acc + i.stockIn, 0);
    const totalReturn = inventoryReportData.reduce((acc, i) => acc + i.stockReturn, 0);
    const totalOut = inventoryReportData.reduce((acc, i) => acc + i.stockOut, 0);
    const totalClosing = inventoryReportData.reduce((acc, i) => acc + i.closingStock, 0);
    const totalValue = inventoryReportData.reduce((acc, i) => acc + i.totalValuation, 0);

    return { totalOpening, totalIn, totalReturn, totalOut, totalClosing, totalValue };
  }, [inventoryReportData]);

  // 2. Sales Report Data Calculation
  const filteredSalesInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const d = extractYYYYMMDD(inv.date);
      const inDateRange = d >= appliedStart && d <= appliedEnd;
      const matchesSearch = inv.chalanNo.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            inv.wholesalerName.toLowerCase().includes(searchQuery.toLowerCase());
      return inDateRange && matchesSearch;
    });
  }, [invoices, appliedStart, appliedEnd, searchQuery]);

  const salesTotals = useMemo(() => {
    const totalBilled = filteredSalesInvoices.reduce((sum, i) => sum + i.totalAmount, 0);
    const totalPaid = filteredSalesInvoices.reduce((sum, i) => sum + i.paidAmount, 0);
    const totalDue = filteredSalesInvoices.reduce((sum, i) => sum + i.dueAmount, 0);
    return { totalBilled, totalPaid, totalDue };
  }, [filteredSalesInvoices]);

  // 3. Accounts Ledger Data Calculation
  const filteredAccountTxns = useMemo(() => {
    return accountTxns.filter(t => {
      const d = extractYYYYMMDD(t.date);
      const inRange = d >= appliedStart && d <= appliedEnd;
      const matchesSearch = t.description.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            t.reference.toLowerCase().includes(searchQuery.toLowerCase());
      return inRange && matchesSearch;
    });
  }, [accountTxns, appliedStart, appliedEnd, searchQuery]);

  const accountTotals = useMemo(() => {
    const totalIn = filteredAccountTxns.filter(t => t.type === 'IN').reduce((sum, t) => sum + t.amount, 0);
    const totalOut = filteredAccountTxns.filter(t => t.type === 'OUT').reduce((sum, t) => sum + t.amount, 0);
    return { totalIn, totalOut, netBalance: totalIn - totalOut };
  }, [filteredAccountTxns]);

  // 4. Due Aging & 5. Sales Reps Metrics
  const agingData = useMemo(
    () => computeDueAgingReport(wholesalers, invoices),
    [wholesalers, invoices]
  );

  const salesRepData = useMemo(
    () => computeSalesRepMetrics(salesReps, wholesalers, invoices, appliedStart, appliedEnd),
    [salesReps, wholesalers, invoices, appliedStart, appliedEnd]
  );

  // 6. Supplier & Category Purchase Report
  const purchaseReport = useMemo(
    () =>
      computeSupplierPurchaseReport({
        items,
        transactions,
        purchaseOrders,
        suppliers,
        startDate: appliedStart,
        endDate: appliedEnd,
        supplierFilter: selectedSupplier,
        categoryFilter: selectedCategory,
        searchQuery,
      }),
    [
      items,
      transactions,
      purchaseOrders,
      suppliers,
      appliedStart,
      appliedEnd,
      selectedSupplier,
      selectedCategory,
      searchQuery,
    ]
  );

  const profitDeadStockData = useMemo(() => {
    const raw = computeProductProfitAndDeadStock({
      items,
      invoices,
      startDateYYYYMMDD: appliedStart,
      endDateYYYYMMDD: appliedEnd,
      deadStockThresholdDays,
    });
    const q = searchQuery.trim().toLowerCase();
    const matchesFilter = (row: { itemName: string; sku: string; category: string }) => {
      const catOk = selectedCategory === 'All' || row.category === selectedCategory;
      const searchOk =
        !q ||
        row.itemName.toLowerCase().includes(q) ||
        row.sku.toLowerCase().includes(q) ||
        row.category.toLowerCase().includes(q);
      return catOk && searchOk;
    };
    const filteredRows = raw.rows.filter(matchesFilter);
    const soldRows = filteredRows.filter((r) => r.soldPaidUnits > 0 || r.bonusFreeUnits > 0);
    const filteredDeadStock = raw.deadStockRows.filter(matchesFilter);
    const totalRevenue = filteredRows.reduce((s, r) => s + r.grossRevenue, 0);
    const totalCogs = filteredRows.reduce((s, r) => s + r.cogs, 0);
    const totalGrossProfit = totalRevenue - totalCogs;
    const overallMarginPct =
      totalRevenue > 0 ? Number(((totalGrossProfit / totalRevenue) * 100).toFixed(1)) : 0;
    return {
      ...raw,
      rows: filteredRows,
      soldRows,
      deadStockRows: filteredDeadStock,
      totalRevenue,
      totalCogs,
      totalGrossProfit,
      overallMarginPct,
      totalBonusUnits: filteredRows.reduce((s, r) => s + r.bonusFreeUnits, 0),
      deadStockCount: filteredDeadStock.length,
      deadStockCapitalValue: filteredDeadStock.reduce((s, r) => s + r.lockedCapitalValue, 0),
    };
  }, [items, invoices, appliedStart, appliedEnd, deadStockThresholdDays, selectedCategory, searchQuery]);

  // Format Currency Helper
  const formatCurr = (currStr: string) => {
    if (!currStr) return '৳';
    if (currStr.includes('৳') || currStr.toLowerCase().includes('bdt')) return '৳';
    return currStr;
  };

  const handleExport = (format: string) => {
    if (format === 'PDF') {
      if (reportType === 'purchases') {
        downloadSupplierPurchaseReportPdf({
          report: purchaseReport,
          brandName,
          storeName,
          startDate: appliedStart,
          endDate: appliedEnd,
          supplierFilter: selectedSupplier,
          categoryFilter: selectedCategory,
        });
        setExportMsg(
          `Downloaded Supplier & Category Purchase PDF (${appliedStart} to ${appliedEnd}).`
        );
        setTimeout(() => setExportMsg(''), 4000);
        return;
      }
      if (reportType === 'profit-deadstock') {
        downloadProfitDeadStockPdf({
          brandName,
          storeName,
          startDate: appliedStart,
          endDate: appliedEnd,
          deadStockThresholdDays,
          totalRevenue: profitDeadStockData.totalRevenue,
          totalCogs: profitDeadStockData.totalCogs,
          totalGrossProfit: profitDeadStockData.totalGrossProfit,
          overallMarginPct: profitDeadStockData.overallMarginPct,
          deadStockCapitalValue: profitDeadStockData.deadStockCapitalValue,
          rows: profitDeadStockData.rows,
          deadStockRows: profitDeadStockData.deadStockRows,
        });
        setExportMsg(
          `Downloaded Net Profit & Dead-Stock PDF (${appliedStart} to ${appliedEnd}).`
        );
        setTimeout(() => setExportMsg(''), 4000);
        return;
      }
      window.print();
    } else {
      let csv = '';
      if (reportType === 'purchases') {
        csv = buildSupplierPurchaseCsv(purchaseReport);
      } else if (reportType === 'profit-deadstock') {
        csv = [
          'SKU,Product,Category,Sold Qty,Free Qty,Revenue,COGS (incl Free),Gross Profit,Margin %',
        ]
          .concat(
            profitDeadStockData.soldRows.map(
              (r) =>
                `"${r.sku}","${r.itemName}","${r.category}",${r.soldPaidUnits},${r.bonusFreeUnits},${r.grossRevenue},${r.cogs},${r.grossProfit},${r.marginPct}`
            )
          )
          .join('\n');
      } else if (reportType === 'sales') {
        csv = ['Chalan No,Wholesaler,Date,Items Count,Grand Total,Paid Advance,Due Remaining,Status']
          .concat(
            filteredSalesInvoices.map(
              (inv) =>
                `"${inv.chalanNo}","${inv.wholesalerName}","${inv.date}",${inv.items.length},${inv.totalAmount},${inv.paidAmount},${inv.dueAmount},"${inv.status}"`
            )
          )
          .join('\n');
      } else if (reportType === 'accounts') {
        csv = ['Ref No,Type,Amount,Date,Description']
          .concat(
            filteredAccountTxns.map(
              (t) =>
                `"${t.reference}","${t.type}",${t.amount},"${t.date}","${t.description.replace(/"/g, '""')}"`
            )
          )
          .join('\n');
      } else if (reportType === 'valuation') {
        csv = ['SKU,Product Name,Category,In-Stock Qty,Selling Price,Cost Price,Total Asset Value']
          .concat(
            items
              .filter((i) => selectedCategory === 'All' || i.category === selectedCategory)
              .map(
                (i) =>
                  `"${i.sku}","${i.name}","${i.category}",${i.quantity},${i.price},${i.costPrice},${i.quantity * i.price}`
              )
          )
          .join('\n');
      } else if (reportType === 'reorder') {
        csv = ['SKU,Product Name,Supplier,Available Stock,Alert Limit']
          .concat(
            items
              .filter((i) => i.quantity <= i.reorderThreshold)
              .map(
                (i) =>
                  `"${i.sku}","${i.name}","${i.supplier}",${i.quantity},${i.reorderThreshold}`
              )
          )
          .join('\n');
      } else if (reportType === 'aging') {
        csv = ['Buyer,0-30 Days,31-60 Days,61-90 Days,90+ Days,Total Due']
          .concat(agingData.rows.map(r => `"${r.wholesalerName}",${r.bucket0_30},${r.bucket31_60},${r.bucket61_90},${r.bucket90Plus},${r.totalDue}`))
          .join('\n');
      } else if (reportType === 'salesreps') {
        csv = ['Name,Area,Invoices,Sales,Commission Rate %,Commission Earned']
          .concat(salesRepData.map(m => `"${m.rep.name}","${m.rep.area}",${m.invoiceCount},${m.totalSales},${m.rep.commissionRate},${m.earnedCommission}`))
          .join('\n');
      } else {
        csv = ['Product,SKU,Category,Opening,In,Return,Out,Closing,Valuation']
          .concat(inventoryReportData.map(r => `"${r.name}",${r.sku},"${r.category}",${r.openingStock},${r.stockIn},${r.stockReturn},${r.stockOut},${r.closingStock},${r.totalValuation}`))
          .join('\n');
      }
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `report-${reportType}-${appliedStart}-to-${appliedEnd}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    }
    setExportMsg(`Exported ${reportType.toUpperCase()} Report (${format}) for ${appliedStart} to ${appliedEnd}.`);
    setTimeout(() => setExportMsg(''), 4000);
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1600px] mx-auto min-h-full">
      
      {/* --- TOP CONTROL BAR: ULTRA MODERN REPORT GENERATOR (HIDDEN WHEN PRINTING) --- */}
      <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200 space-y-4 no-print">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500 to-cyan-500 text-slate-950 flex items-center justify-center font-black">
                <Sparkles className="w-4 h-4" />
              </div>
              <h3 className="font-extrabold text-slate-900 text-lg tracking-tight">Ultra-Modern Analytics & Report Generator</h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              <strong>{brandName}</strong> ({storeName}) • Generate dynamic inventory, sales, cash ledger, and asset valuation reports
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleExport('CSV')}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center gap-1.5 transition"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={() => handleExport('PDF')}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center gap-1.5 transition"
            >
              <Download className="w-4 h-4 text-cyan-600" />
              <span>Download PDF</span>
            </button>
            <button
              onClick={() => window.print()}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition shadow-xs"
            >
              <Printer className="w-4 h-4" />
              <span>Print View</span>
            </button>
          </div>
        </div>

        {/* Filters Controls Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 pt-1">
          {/* Date Range Selector */}
          <div className="lg:col-span-2 space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center justify-between">
              <span>Date Filter Range *</span>
              <span className="text-[10px] text-emerald-600 font-bold uppercase">{activePreset}</span>
            </label>
            <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
              <Calendar className="w-4 h-4 text-emerald-600 shrink-0 ml-1" />
              <input
                type="date"
                value={filterStart}
                onChange={(e) => { 
                  const v = e.target.value;
                  setFilterStart(v); 
                  setAppliedStart(v);
                  setActivePreset('Custom'); 
                }}
                className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-800 outline-none w-full min-w-0"
              />
              <span className="text-xs text-slate-400 font-bold">to</span>
              <input
                type="date"
                value={filterEnd}
                onChange={(e) => { 
                  const v = e.target.value;
                  setFilterEnd(v); 
                  setAppliedEnd(v);
                  setActivePreset('Custom'); 
                }}
                className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-800 outline-none w-full min-w-0"
              />
            </div>
          </div>

          {/* Quick Month Selector */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">Quick Month</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => handleMonthSelect(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Supplier Dropdown Filter */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">Supplier / Vendor</label>
            <select
              value={selectedSupplier}
              onChange={(e) => setSelectedSupplier(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="All">All Suppliers</option>
              {purchaseReport.availableSuppliers.map((sup) => (
                <option key={sup} value={sup}>{sup}</option>
              ))}
            </select>
          </div>

          {/* Category Dropdown Filter */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">Category Filter</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="All">All Categories</option>
              {categories.map(c => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Search Query Filter */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">Search Keyword</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Search className="w-3.5 h-3.5" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Product, SKU, Supplier..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-9 pr-3 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Presets & Generate Action Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-bold w-full sm:w-auto overflow-x-auto">
            {['Today', 'Yesterday', 'Last 7 Days', 'This Month', 'Last Month', 'All Time'].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => handlePreset(preset)}
                className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap cursor-pointer ${
                  activePreset === preset 
                    ? 'bg-white text-emerald-600 shadow-xs font-extrabold' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {preset}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleGenerateReport}
            disabled={isGenerating}
            className="w-full sm:w-auto bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-slate-950 font-extrabold px-6 py-2.5 rounded-xl text-xs shadow-md transition flex items-center justify-center gap-2 shrink-0 cursor-pointer"
          >
            {isGenerating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            <span>Search & Generate Report</span>
          </button>
        </div>
      </div>

      {exportMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-bold animate-fade-in flex items-center gap-2 no-print">
          <span>✅ {exportMsg}</span>
        </div>
      )}

      {/* --- REPORT MODULE TABS (HIDDEN WHEN PRINTING) --- */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2 no-print">
        <button
          onClick={() => setReportType('inventory')}
          className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition flex items-center gap-2 cursor-pointer ${
            reportType === 'inventory' 
              ? 'bg-emerald-500 text-slate-950 shadow-xs' 
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>📋 Daily Inventory Report</span>
        </button>

        <button
          onClick={() => setReportType('purchases')}
          className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition flex items-center gap-2 cursor-pointer ${
            reportType === 'purchases' 
              ? 'bg-teal-600 text-white shadow-xs' 
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>📥 Supplier &amp; Category Purchases</span>
        </button>

        <button
          onClick={() => setReportType('sales')}
          className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition flex items-center gap-2 cursor-pointer ${
            reportType === 'sales' 
              ? 'bg-blue-500 text-slate-950 shadow-xs' 
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <ShoppingCart className="w-4 h-4" />
          <span>🛒 Sales &amp; Chalans Report</span>
        </button>

        <button
          onClick={() => setReportType('accounts')}
          className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition flex items-center gap-2 cursor-pointer ${
            reportType === 'accounts' 
              ? 'bg-cyan-500 text-slate-950 shadow-xs' 
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          <span>💰 Cash Ledger &amp; Accounts</span>
        </button>

        <button
          onClick={() => setReportType('valuation')}
          className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition flex items-center gap-2 cursor-pointer ${
            reportType === 'valuation' 
              ? 'bg-indigo-500 text-slate-950 shadow-xs' 
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>📦 Category Stock Valuation</span>
        </button>

        <button
          onClick={() => setReportType('reorder')}
          className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition flex items-center gap-2 cursor-pointer ${
            reportType === 'reorder' 
              ? 'bg-amber-500 text-slate-950 shadow-xs' 
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>⚠️ Reorder Action List</span>
        </button>

        <button
          onClick={() => setReportType('aging')}
          className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition flex items-center gap-2 cursor-pointer ${
            reportType === 'aging'
              ? 'bg-rose-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>📊 Due Aging Report</span>
        </button>

        <button
          onClick={() => setReportType('salesreps')}
          className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition flex items-center gap-2 cursor-pointer ${
            reportType === 'salesreps'
              ? 'bg-violet-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Award className="w-4 h-4" />
          <span>🏆 SR &amp; Commissions</span>
        </button>

        <button
          onClick={() => setReportType('profit-deadstock')}
          className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition flex items-center gap-2 cursor-pointer ${
            reportType === 'profit-deadstock'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          <span>💹 Net Profit &amp; Dead Stock</span>
        </button>
      </div>

      {/* --- REPORT CONTENT AREA (PRINTABLE) --- */}
      <div id="printable-report" className="space-y-6">
        
        {/* Printable Executive Report Header (Only shows in print) */}
        <div className="hidden print:block pb-4 mb-2 border-b-2 border-slate-900">
          <div className="flex justify-between items-end">
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tight text-slate-950">{brandName}</h1>
              <p className="text-xs font-bold text-slate-900">{storeName}</p>
            </div>
            <div className="text-right">
              <span className="inline-block px-3 py-1 bg-slate-950 text-white text-xs font-extrabold uppercase tracking-widest rounded-md mb-1">
                EXECUTIVE REPORT
              </span>
              <p className="text-xs font-bold text-slate-950 uppercase">
                {reportType === 'inventory' ? 'Daily Inventory Balance Report' :
                 reportType === 'purchases' ? 'Supplier & Category Purchase Report' :
                 reportType === 'sales' ? 'Wholesale Sales Orders Report' :
                 reportType === 'accounts' ? 'Financial Cash Ledger Report' :
                 reportType === 'valuation' ? 'Stock Asset Valuation Matrix' :
                 reportType === 'aging' ? 'Customer Receivables Due Aging Report' :
                 reportType === 'salesreps' ? 'Sales Representative Commission Report' :
                 'Urgent Reorder Action List'}
              </p>
              <p className="text-[11px] font-mono text-slate-800 mt-0.5">
                Period: {appliedStart} to {appliedEnd}
                {reportType === 'purchases' && ` • Supplier: ${selectedSupplier} • Category: ${selectedCategory}`}
              </p>
            </div>
          </div>
        </div>

      {/* REPORT TYPE 1: DAILY INVENTORY REPORT */}
      {reportType === 'inventory' && (
        <div className="space-y-6">
          {/* Dynamic KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Opening Stock</span>
              <span className="text-xl font-extrabold text-slate-800">{inventoryTotals.totalOpening.toLocaleString()}</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Units</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[10px] font-bold text-emerald-600 uppercase block mb-1">Stock In (+)</span>
              <span className="text-xl font-extrabold text-emerald-600">+{inventoryTotals.totalIn.toLocaleString()}</span>
              <span className="text-[10px] text-emerald-500 block mt-0.5">Intake</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[10px] font-bold text-amber-600 uppercase block mb-1">Returns (+)</span>
              <span className="text-xl font-extrabold text-amber-600">+{inventoryTotals.totalReturn.toLocaleString()}</span>
              <span className="text-[10px] text-amber-500 block mt-0.5">Returned</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[10px] font-bold text-cyan-600 uppercase block mb-1">Stock Out (-)</span>
              <span className="text-xl font-extrabold text-cyan-600">-{inventoryTotals.totalOut.toLocaleString()}</span>
              <span className="text-[10px] text-cyan-500 block mt-0.5">Dispatched</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[10px] font-bold text-blue-600 uppercase block mb-1">Current Stock</span>
              <span className="text-xl font-extrabold text-blue-700">{inventoryTotals.totalClosing.toLocaleString()}</span>
              <span className="text-[10px] text-blue-500 block mt-0.5">Available</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Total Valuation</span>
              <span className="text-lg font-extrabold text-slate-900">{formatCurr(currency)} {inventoryTotals.totalValue.toLocaleString()}</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Asset Worth</span>
            </div>
          </div>

          {/* Ultra Modern Data Table */}
          <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div>
                <h4 className="font-extrabold text-slate-900 text-sm">Daily Inventory Balance Report</h4>
                <p className="text-xs text-slate-500">Period: <strong className="text-slate-800">{appliedStart} to {appliedEnd}</strong></p>
              </div>
              <span className="px-3 py-1 bg-blue-100 text-blue-800 font-bold text-xs rounded-xl">
                {inventoryReportData.length} Products Listed
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-800 font-extrabold uppercase tracking-wider text-[11px] border-b border-slate-200">
                  <tr>
                    <th className="p-4 border-r border-slate-200 text-center w-12">SL</th>
                    <th className="p-4 border-r border-slate-200">Product Name & SKU</th>
                    <th className="p-4 border-r border-slate-200">Category</th>
                    <th className="p-4 border-r border-slate-200 text-center">Opening Stock</th>
                    <th className="p-4 border-r border-slate-200 text-center text-emerald-700 bg-emerald-50/50">Stock In (+)</th>
                    <th className="p-4 border-r border-slate-200 text-center text-amber-700 bg-amber-50/50">Return (+)</th>
                    <th className="p-4 border-r border-slate-200 text-center text-cyan-700 bg-cyan-50/50">Stock Out (-)</th>
                    <th className="p-4 border-r border-slate-200 text-center text-blue-700 bg-blue-50/50">Current Stock</th>
                    <th className="p-4 text-right">Unit Valuation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                    {inventoryReportData.map((row, index) => (
                      <tr key={row.id} className="hover:bg-slate-50/80 transition">
                        <td className="p-3.5 text-center font-extrabold text-slate-800 border-r border-slate-200 text-xs">{index + 1}</td>
                        <td className="p-3.5 border-r border-slate-200">
                          <div className="font-extrabold text-slate-950 text-xs sm:text-sm">{row.name}</div>
                          <div className="text-xs font-mono font-bold text-slate-700 mt-0.5">{row.sku} • <span className="text-slate-800">{row.unit}</span></div>
                        </td>
                        <td className="p-3.5 font-bold text-slate-800 border-r border-slate-200 text-xs">{row.category}</td>
                        <td className="p-3.5 text-center font-extrabold text-slate-900 border-r border-slate-200 text-xs sm:text-sm">{row.openingStock}</td>
                        <td className="p-3.5 text-center font-extrabold text-emerald-700 border-r border-slate-200 bg-emerald-50/30 text-xs sm:text-sm">+{row.stockIn}</td>
                        <td className="p-3.5 text-center font-extrabold text-amber-700 border-r border-slate-200 bg-amber-50/30 text-xs sm:text-sm">+{row.stockReturn}</td>
                        <td className="p-3.5 text-center font-extrabold text-cyan-700 border-r border-slate-200 bg-cyan-50/30 text-xs sm:text-sm">-{row.stockOut}</td>
                        <td className="p-3.5 text-center font-black text-blue-800 border-r border-slate-200 bg-blue-50/40 text-sm sm:text-base">{row.closingStock}</td>
                        <td className="p-3.5 text-right font-mono font-extrabold text-slate-950">
                          <div className="text-xs sm:text-sm">{formatCurr(currency)} {row.totalValuation.toLocaleString()}</div>
                          <div className="text-xs font-semibold text-slate-800 mt-0.5">Per {row.unit.slice(0, -1) || 'Unit'}: <strong className="text-slate-950">{formatCurr(currency)}{row.price}</strong></div>
                        </td>
                      </tr>
                    ))}

                  {/* Footer Totals Row */}
                  {inventoryReportData.length > 0 && (
                    <tr className="bg-slate-100 font-extrabold text-slate-900 text-xs border-t-2 border-slate-300">
                      <td colSpan={3} className="p-4 text-right uppercase tracking-wider border-r border-slate-300">Summary Totals:</td>
                      <td className="p-4 text-center border-r border-slate-300">{inventoryTotals.totalOpening.toLocaleString()}</td>
                      <td className="p-4 text-center text-emerald-700 border-r border-slate-300 bg-emerald-100/50">+{inventoryTotals.totalIn.toLocaleString()}</td>
                      <td className="p-4 text-center text-amber-700 border-r border-slate-300 bg-amber-100/50">+{inventoryTotals.totalReturn.toLocaleString()}</td>
                      <td className="p-4 text-center text-cyan-700 border-r border-slate-300 bg-cyan-100/50">-{inventoryTotals.totalOut.toLocaleString()}</td>
                      <td className="p-4 text-center text-blue-800 border-r border-slate-300 bg-blue-100/50 text-sm">{inventoryTotals.totalClosing.toLocaleString()}</td>
                      <td className="p-4 text-right font-mono text-emerald-800 text-sm">{formatCurr(currency)} {inventoryTotals.totalValue.toLocaleString()}</td>
                    </tr>
                  )}

                  {/* Empty State */}
                  {inventoryReportData.length === 0 && (
                    <tr>
                      <td colSpan={9} className="p-12 text-center text-slate-400">
                        <PackageX className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                        <p className="font-extrabold text-slate-700 text-sm">No inventory items matched your search filter.</p>
                        <p className="text-xs text-slate-400 mt-1">Try resetting the search query or adding products in the Inventory module.</p>
                        <button
                          type="button"
                          onClick={() => { setSearchQuery(''); setSelectedCategory('All'); }}
                          className="mt-4 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition inline-flex items-center gap-2"
                        >
                          <RefreshCw className="w-3.5 h-3.5" /> Reset Filters
                        </button>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* REPORT TYPE: SUPPLIER & CATEGORY PURCHASE REPORT */}
      {reportType === 'purchases' && (
        <div className="space-y-6">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Suppliers Purchased From</span>
              <span className="text-2xl font-extrabold text-slate-900">{purchaseReport.totals.totalSuppliers}</span>
              <span className="text-[11px] text-slate-500 block mt-0.5">{purchaseReport.totals.totalEntries} Stock IN Entries</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[10px] font-bold text-teal-700 uppercase block mb-1">Total Units Purchased (IN)</span>
              <span className="text-2xl font-extrabold text-teal-700">{purchaseReport.totals.totalUnits.toLocaleString()}</span>
              <span className="text-[11px] text-teal-600 block mt-0.5">{purchaseReport.totals.totalDistinctProducts} Distinct Products</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[10px] font-bold text-indigo-600 uppercase block mb-1">Categories Restocked</span>
              <span className="text-2xl font-extrabold text-indigo-700">{purchaseReport.totals.totalCategories}</span>
              <span className="text-[11px] text-indigo-500 block mt-0.5">Filter: {selectedCategory}</span>
            </div>

            <div className="bg-emerald-50/60 p-4 rounded-xl border border-emerald-200 shadow-xs">
              <span className="text-[10px] font-bold text-emerald-700 uppercase block mb-1">Total Purchase Cost</span>
              <span className="text-2xl font-extrabold text-emerald-800">{formatCurr(currency)} {purchaseReport.totals.totalCost.toLocaleString()}</span>
              <span className="text-[11px] text-emerald-700 block mt-0.5">Period: {appliedStart} to {appliedEnd}</span>
            </div>
          </div>

          {/* Sub-view & Direct Report Generation Toolbar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 no-print">
            <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setPurchaseSubView('summary')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  purchaseSubView === 'summary' ? 'bg-white text-teal-700 shadow-xs font-extrabold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Supplier &amp; Category Summary
              </button>
              <button
                type="button"
                onClick={() => setPurchaseSubView('by-supplier')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  purchaseSubView === 'by-supplier' ? 'bg-white text-teal-700 shadow-xs font-extrabold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Supplier-Wise Product Cards ({purchaseReport.supplierSummaries.length})
              </button>
              <button
                type="button"
                onClick={() => setPurchaseSubView('entries')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  purchaseSubView === 'entries' ? 'bg-white text-teal-700 shadow-xs font-extrabold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Stock IN Purchase Log ({purchaseReport.entries.length})
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {(selectedSupplier !== 'All' || selectedCategory !== 'All' || searchQuery) && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSupplier('All');
                    setSelectedCategory('All');
                    setSearchQuery('');
                  }}
                  className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 font-bold rounded-xl text-xs transition cursor-pointer"
                >
                  Clear Filters
                </button>
              )}
              <button
                type="button"
                onClick={() => handleExport('CSV')}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>Export Purchase CSV</span>
              </button>
              <button
                type="button"
                onClick={() => handleExport('PDF')}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-extrabold rounded-xl text-xs flex items-center gap-1.5 transition shadow-xs cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Generate Purchase PDF</span>
              </button>
            </div>
          </div>

          {purchaseReport.entries.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
              <PackageCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="font-extrabold text-slate-700 text-sm">No Stock IN / Purchase entries matched this filter.</p>
              <p className="text-xs text-slate-500 mt-1">
                Try switching the date range (e.g. &quot;This Month&quot; / &quot;Last Month&quot; / &quot;All Time&quot;) or log purchases via Stock Transactions (IN), Purchase Orders, or Inventory.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSelectedSupplier('All');
                  setSelectedCategory('All');
                  setSearchQuery('');
                  handlePreset('All Time');
                }}
                className="mt-4 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition inline-flex items-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Show All Time Purchases
              </button>
            </div>
          ) : (
            <>
              {/* VIEW 1: SUPPLIER SUMMARY + CATEGORY SUMMARY + PRODUCT BREAKDOWN */}
              {purchaseSubView === 'summary' && (
                <div className="space-y-6">
                  {/* Section 1: Supplier-Wise Purchase Summary */}
                  <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
                    <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h4 className="font-extrabold text-slate-900 text-sm">
                          1. Supplier-Wise Purchase Summary (কার কাছ থেকে কতগুলো প্রোডাক্ট কিনেছেন)
                        </h4>
                        <p className="text-xs text-slate-500">
                          Click any supplier row to filter and inspect only products purchased from that supplier
                        </p>
                      </div>
                      <span className="px-3 py-1 bg-teal-100 text-teal-800 font-bold text-xs rounded-xl">
                        {purchaseReport.supplierSummaries.length} Suppliers
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100 text-slate-700 uppercase tracking-wider text-[10px] border-b border-slate-200">
                          <tr>
                            <th className="p-3.5 font-bold text-center w-12">SL</th>
                            <th className="p-3.5 font-bold">Supplier / Vendor Name</th>
                            <th className="p-3.5 font-bold">Categories Bought</th>
                            <th className="p-3.5 font-bold text-center">Products</th>
                            <th className="p-3.5 font-bold text-center">Entries</th>
                            <th className="p-3.5 font-bold text-right">Total Qty Bought</th>
                            <th className="p-3.5 font-bold text-right">Total Purchase Cost</th>
                            <th className="p-3.5 font-bold text-right">Share</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {purchaseReport.supplierSummaries.map((sup, idx) => {
                            const isSelected = selectedSupplier === sup.supplierName;
                            return (
                              <tr
                                key={sup.supplierName}
                                onClick={() =>
                                  setSelectedSupplier(isSelected ? 'All' : sup.supplierName)
                                }
                                className={`cursor-pointer transition ${
                                  isSelected ? 'bg-teal-50/70' : 'hover:bg-slate-50'
                                }`}
                              >
                                <td className="p-3.5 text-center font-bold text-slate-500">{idx + 1}</td>
                                <td className="p-3.5 font-extrabold text-slate-900">
                                  <div className="flex items-center gap-2">
                                    <span>{sup.supplierName}</span>
                                    {isSelected && (
                                      <span className="px-2 py-0.5 bg-teal-600 text-white rounded-md text-[10px] font-bold">
                                        Filtered
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="p-3.5">
                                  <div className="flex flex-wrap gap-1">
                                    {sup.categories.map((cat) => (
                                      <span
                                        key={cat}
                                        className="px-2 py-0.5 bg-slate-100 text-slate-700 font-semibold rounded-md text-[10px]"
                                      >
                                        {cat}
                                      </span>
                                    ))}
                                  </div>
                                </td>
                                <td className="p-3.5 text-center font-bold text-slate-800">{sup.distinctProducts}</td>
                                <td className="p-3.5 text-center font-mono text-slate-600">{sup.entryCount}</td>
                                <td className="p-3.5 text-right font-mono font-extrabold text-teal-700">
                                  {sup.totalUnits.toLocaleString()}
                                </td>
                                <td className="p-3.5 text-right font-mono font-extrabold text-slate-900">
                                  {formatCurr(currency)} {sup.totalCost.toLocaleString()}
                                </td>
                                <td className="p-3.5 text-right font-mono font-bold text-slate-600">{sup.sharePct}%</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Section 2: Category-Wise Summary */}
                  <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
                    <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h4 className="font-extrabold text-slate-900 text-sm">
                          2. Category-Wise Purchase Summary (কোন ক্যাটাগরির কতগুলো প্রোডাক্ট কেনা হয়েছে)
                        </h4>
                        <p className="text-xs text-slate-500">Click any category row to filter product breakdown below</p>
                      </div>
                      <span className="px-3 py-1 bg-indigo-100 text-indigo-800 font-bold text-xs rounded-xl">
                        {purchaseReport.categorySummaries.length} Categories
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100 text-slate-700 uppercase tracking-wider text-[10px] border-b border-slate-200">
                          <tr>
                            <th className="p-3.5 font-bold text-center w-12">SL</th>
                            <th className="p-3.5 font-bold">Category</th>
                            <th className="p-3.5 font-bold">Suppliers</th>
                            <th className="p-3.5 font-bold text-center">Products</th>
                            <th className="p-3.5 font-bold text-right">Total Qty Bought</th>
                            <th className="p-3.5 font-bold text-right">Total Cost</th>
                            <th className="p-3.5 font-bold text-right">Share</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {purchaseReport.categorySummaries.map((cat, idx) => {
                            const isSelected = selectedCategory === cat.category;
                            return (
                              <tr
                                key={cat.category}
                                onClick={() =>
                                  setSelectedCategory(isSelected ? 'All' : cat.category)
                                }
                                className={`cursor-pointer transition ${
                                  isSelected ? 'bg-indigo-50/70' : 'hover:bg-slate-50'
                                }`}
                              >
                                <td className="p-3.5 text-center font-bold text-slate-500">{idx + 1}</td>
                                <td className="p-3.5 font-extrabold text-indigo-800">{cat.category}</td>
                                <td className="p-3.5 text-slate-700 font-medium">{cat.suppliers.join(', ')}</td>
                                <td className="p-3.5 text-center font-bold text-slate-800">{cat.distinctProducts}</td>
                                <td className="p-3.5 text-right font-mono font-extrabold text-teal-700">
                                  {cat.totalUnits.toLocaleString()}
                                </td>
                                <td className="p-3.5 text-right font-mono font-extrabold text-slate-900">
                                  {formatCurr(currency)} {cat.totalCost.toLocaleString()}
                                </td>
                                <td className="p-3.5 text-right font-mono font-bold text-slate-600">{cat.sharePct}%</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Section 3: Product-Wise Breakdown by Category & Supplier */}
                  <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
                    <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h4 className="font-extrabold text-slate-900 text-sm">
                          3. Product-Wise Purchase Breakdown (কোন ক্যাটাগরির কোন প্রোডাক্ট কেনা হয়েছে)
                        </h4>
                        <p className="text-xs text-slate-500">
                          Aggregated quantity &amp; cost per product across {selectedSupplier === 'All' ? 'all suppliers' : selectedSupplier}
                        </p>
                      </div>
                      <span className="px-3 py-1 bg-emerald-100 text-emerald-800 font-bold text-xs rounded-xl">
                        {purchaseReport.productSummaries.length} Products
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100 text-slate-700 uppercase tracking-wider text-[10px] border-b border-slate-200">
                          <tr>
                            <th className="p-3.5 font-bold text-center w-12">SL</th>
                            <th className="p-3.5 font-bold">Category</th>
                            <th className="p-3.5 font-bold">Product Name &amp; SKU</th>
                            <th className="p-3.5 font-bold">Bought From (Supplier)</th>
                            <th className="p-3.5 font-bold text-center">Entries</th>
                            <th className="p-3.5 font-bold text-right">Qty Bought</th>
                            <th className="p-3.5 font-bold text-right">Avg Unit Cost</th>
                            <th className="p-3.5 font-bold text-right">Total Cost</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {purchaseReport.productSummaries.map((prod, idx) => (
                            <tr key={`${prod.itemId}-${prod.category}`} className="hover:bg-slate-50">
                              <td className="p-3.5 text-center font-bold text-slate-500">{idx + 1}</td>
                              <td className="p-3.5">
                                <span className="px-2 py-0.5 bg-indigo-50 text-indigo-800 font-bold rounded-md text-[10px]">
                                  {prod.category}
                                </span>
                              </td>
                              <td className="p-3.5">
                                <div className="font-extrabold text-slate-900">{prod.itemName}</div>
                                <div className="text-[10px] font-mono text-slate-500">{prod.sku}</div>
                              </td>
                              <td className="p-3.5 font-bold text-teal-700">{prod.suppliers.join(', ')}</td>
                              <td className="p-3.5 text-center font-mono text-slate-600">{prod.entryCount}</td>
                              <td className="p-3.5 text-right font-mono font-extrabold text-slate-900">
                                {prod.totalUnits.toLocaleString()} {prod.unit}
                              </td>
                              <td className="p-3.5 text-right font-mono text-slate-600">
                                {formatCurr(currency)} {prod.avgUnitCost.toLocaleString()}
                              </td>
                              <td className="p-3.5 text-right font-mono font-extrabold text-emerald-700">
                                {formatCurr(currency)} {prod.totalCost.toLocaleString()}
                              </td>
                            </tr>
                          ))}
                          <tr className="bg-slate-100 font-extrabold text-slate-900 border-t-2 border-slate-300">
                            <td colSpan={5} className="p-3.5 text-right uppercase tracking-wider">Totals:</td>
                            <td className="p-3.5 text-right font-mono text-teal-800">
                              {purchaseReport.totals.totalUnits.toLocaleString()} Units
                            </td>
                            <td className="p-3.5 text-right">—</td>
                            <td className="p-3.5 text-right font-mono text-emerald-800">
                              {formatCurr(currency)} {purchaseReport.totals.totalCost.toLocaleString()}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* VIEW 2: SUPPLIER-WISE PRODUCT CARDS */}
              {purchaseSubView === 'by-supplier' && (
                <div className="space-y-5">
                  {purchaseReport.supplierSummaries.map((sup) => (
                    <div key={sup.supplierName} className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
                      <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <h4 className="font-extrabold text-slate-900 text-base">{sup.supplierName}</h4>
                          <p className="text-xs text-slate-500">
                            Categories: <strong className="text-slate-700">{sup.categories.join(', ')}</strong> • {sup.entryCount} Stock IN Entries
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="px-3 py-1 bg-teal-100 text-teal-900 font-extrabold text-xs rounded-xl">
                            {sup.totalUnits.toLocaleString()} Units
                          </span>
                          <span className="px-3 py-1 bg-emerald-100 text-emerald-900 font-extrabold text-xs rounded-xl font-mono">
                            {formatCurr(currency)} {sup.totalCost.toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-100/70 text-slate-600 uppercase text-[10px] border-b border-slate-200">
                            <tr>
                              <th className="p-3 font-bold">Category</th>
                              <th className="p-3 font-bold">Product &amp; SKU</th>
                              <th className="p-3 font-bold text-center">Entries</th>
                              <th className="p-3 font-bold text-right">Qty Purchased</th>
                              <th className="p-3 font-bold text-right">Avg Unit Cost</th>
                              <th className="p-3 font-bold text-right">Total Cost</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {sup.products.map((prod) => (
                              <tr key={`${sup.supplierName}-${prod.itemId}-${prod.category}`} className="hover:bg-slate-50">
                                <td className="p-3 font-bold text-indigo-700">{prod.category}</td>
                                <td className="p-3">
                                  <div className="font-extrabold text-slate-900">{prod.itemName}</div>
                                  <div className="text-[10px] font-mono text-slate-400">{prod.sku}</div>
                                </td>
                                <td className="p-3 text-center font-mono">{prod.entryCount}</td>
                                <td className="p-3 text-right font-mono font-extrabold text-slate-900">
                                  {prod.totalUnits.toLocaleString()} {prod.unit}
                                </td>
                                <td className="p-3 text-right font-mono text-slate-600">
                                  {formatCurr(currency)} {prod.avgUnitCost.toLocaleString()}
                                </td>
                                <td className="p-3 text-right font-mono font-extrabold text-emerald-700">
                                  {formatCurr(currency)} {prod.totalCost.toLocaleString()}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* VIEW 3: ALL STOCK IN PURCHASE ENTRIES LOG */}
              {purchaseSubView === 'entries' && (
                <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
                  <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <span className="font-extrabold text-slate-900 text-sm">
                      Chronological Stock IN / Purchase Ledger ({appliedStart} to {appliedEnd})
                    </span>
                    <span className="px-3 py-1 bg-slate-200 text-slate-800 font-bold text-xs rounded-xl">
                      {purchaseReport.entries.length} Entries
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-700 uppercase text-[10px] border-b border-slate-200">
                        <tr>
                          <th className="p-3.5 font-bold">Date</th>
                          <th className="p-3.5 font-bold">Ref / PO No</th>
                          <th className="p-3.5 font-bold">Source</th>
                          <th className="p-3.5 font-bold">Supplier / Vendor</th>
                          <th className="p-3.5 font-bold">Category</th>
                          <th className="p-3.5 font-bold">Product &amp; SKU</th>
                          <th className="p-3.5 font-bold text-right">Qty</th>
                          <th className="p-3.5 font-bold text-right">Unit Cost</th>
                          <th className="p-3.5 font-bold text-right">Total Cost</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {purchaseReport.entries.map((entry) => (
                          <tr key={entry.id} className="hover:bg-slate-50">
                            <td className="p-3.5 font-mono text-slate-600">{entry.date.replace('T', ' ')}</td>
                            <td className="p-3.5 font-mono font-bold text-slate-800">{entry.reference}</td>
                            <td className="p-3.5">
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                  entry.source === 'Purchase Order'
                                    ? 'bg-indigo-100 text-indigo-800'
                                    : 'bg-emerald-100 text-emerald-800'
                                }`}
                              >
                                {entry.source}
                              </span>
                            </td>
                            <td className="p-3.5 font-bold text-teal-800">{entry.supplierName}</td>
                            <td className="p-3.5 font-semibold text-slate-700">{entry.category}</td>
                            <td className="p-3.5">
                              <div className="font-extrabold text-slate-900">{entry.itemName}</div>
                              <div className="text-[10px] font-mono text-slate-400">{entry.sku}</div>
                            </td>
                            <td className="p-3.5 text-right font-mono font-extrabold text-slate-900">
                              +{entry.quantity.toLocaleString()} {entry.unit}
                            </td>
                            <td className="p-3.5 text-right font-mono text-slate-600">
                              {formatCurr(currency)} {entry.unitCost.toLocaleString()}
                            </td>
                            <td className="p-3.5 text-right font-mono font-extrabold text-emerald-700">
                              {formatCurr(currency)} {entry.totalCost.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* REPORT TYPE 2: SALES & CHALANS REPORT */}
      {reportType === 'sales' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs font-bold text-slate-500 uppercase block mb-1">Total Sales Billed</span>
              <span className="text-2xl font-extrabold text-slate-900">{formatCurr(currency)} {salesTotals.totalBilled.toLocaleString()}</span>
              <p className="text-[11px] text-slate-400 mt-1">{filteredSalesInvoices.length} Chalans • {wholesalers.length} Registered Buyers</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs font-bold text-emerald-600 uppercase block mb-1">Cash Advance Received</span>
              <span className="text-2xl font-extrabold text-emerald-600">{formatCurr(currency)} {salesTotals.totalPaid.toLocaleString()}</span>
              <p className="text-[11px] text-slate-400 mt-1">Paid at checkout</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs font-bold text-rose-600 uppercase block mb-1">Total Outstanding Dues</span>
              <span className="text-2xl font-extrabold text-rose-600">{formatCurr(currency)} {salesTotals.totalDue.toLocaleString()}</span>
              <p className="text-[11px] text-slate-400 mt-1">Uncollected receivables</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 font-bold text-slate-800 text-sm">
              Wholesale Sales Orders Ledger ({appliedStart} to {appliedEnd})
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 uppercase tracking-wider text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="p-4 font-bold">Chalan No.</th>
                    <th className="p-4 font-bold">Wholesaler Name</th>
                    <th className="p-4 font-bold">Date & Time</th>
                    <th className="p-4 font-bold text-center">Items Count</th>
                    <th className="p-4 font-bold text-right">Grand Total</th>
                    <th className="p-4 font-bold text-right text-emerald-700">Paid Advance</th>
                    <th className="p-4 font-bold text-right text-rose-700">Due Remaining</th>
                    <th className="p-4 font-bold text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSalesInvoices.map(inv => (
                    <tr key={inv.id} className="hover:bg-slate-50">
                      <td className="p-4 font-mono font-extrabold text-slate-900">{inv.chalanNo}</td>
                      <td className="p-4 font-bold text-blue-700">{inv.wholesalerName}</td>
                      <td className="p-4 text-slate-500 font-mono">{inv.date.replace('T', ' ')}</td>
                      <td className="p-4 text-center font-bold text-slate-800">{inv.items.length} Products</td>
                      <td className="p-4 text-right font-mono font-bold text-slate-900">{formatCurr(currency)} {inv.totalAmount.toLocaleString()}</td>
                      <td className="p-4 text-right font-mono font-bold text-emerald-600">{formatCurr(currency)} {inv.paidAmount.toLocaleString()}</td>
                      <td className="p-4 text-right font-mono font-extrabold text-rose-600">{formatCurr(currency)} {inv.dueAmount.toLocaleString()}</td>
                      <td className="p-4 text-center">
                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold ${
                          inv.status === 'Paid' ? 'bg-emerald-100 text-emerald-700' : inv.status === 'Partial' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'
                        }`}>
                          {inv.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {filteredSalesInvoices.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-10 text-center text-slate-400">No sales orders generated in this date filter.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* REPORT TYPE 3: CASH LEDGER & ACCOUNTS */}
      {reportType === 'accounts' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs font-bold text-emerald-600 uppercase block mb-1">Total Cash Received (+)</span>
              <span className="text-2xl font-extrabold text-emerald-600">{formatCurr(currency)} {accountTotals.totalIn.toLocaleString()}</span>
              <p className="text-[11px] text-slate-400 mt-1">Inflow in timeframe</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs font-bold text-rose-600 uppercase block mb-1">Total Cash Dispatched (-)</span>
              <span className="text-2xl font-extrabold text-rose-600">{formatCurr(currency)} {accountTotals.totalOut.toLocaleString()}</span>
              <p className="text-[11px] text-slate-400 mt-1">Outflow in timeframe</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs font-bold text-blue-600 uppercase block mb-1">Period Net Cash Flow</span>
              <span className="text-2xl font-extrabold text-blue-700">{formatCurr(currency)} {accountTotals.netBalance.toLocaleString()}</span>
              <p className="text-[11px] text-slate-400 mt-1">Net Period Revenue</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 font-bold text-slate-800 text-sm">
              Period Financial Ledger Transactions ({appliedStart} to {appliedEnd})
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 uppercase tracking-wider text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="p-4 font-bold">Ref No.</th>
                    <th className="p-4 font-bold">Type</th>
                    <th className="p-4 font-bold">Amount</th>
                    <th className="p-4 font-bold">Date & Time</th>
                    <th className="p-4 font-bold">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAccountTxns.map(t => (
                    <tr key={t.id} className="hover:bg-slate-50">
                      <td className="p-4 font-mono font-bold text-slate-800">{t.reference}</td>
                      <td className="p-4 font-bold">
                        <span className={`px-2.5 py-1 rounded-lg text-[10px] ${t.type === 'IN' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                          {t.type === 'IN' ? 'CASH IN' : 'CASH OUT'}
                        </span>
                      </td>
                      <td className={`p-4 font-extrabold font-mono text-sm ${t.type === 'IN' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {t.type === 'IN' ? '+' : '-'}{formatCurr(currency)} {t.amount.toLocaleString()}
                      </td>
                      <td className="p-4 text-slate-500 font-mono">{t.date.replace('T', ' ')}</td>
                      <td className="p-4 text-slate-800 font-medium">{t.description}</td>
                    </tr>
                  ))}
                  {filteredAccountTxns.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-10 text-center text-slate-400">No account ledger entries found in this timeframe.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* REPORT TYPE 4: CATEGORY STOCK VALUATION */}
      {reportType === 'valuation' && (
        <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="font-extrabold text-slate-800 text-sm">Category Stock Asset Valuation Matrix</div>
            <span className="text-xs font-extrabold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-xl border border-emerald-200">
              Total Stock Value: {formatCurr(currency)} {inventoryTotals.totalValue.toLocaleString()}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 uppercase tracking-wider text-[10px] border-b border-slate-200">
                <tr>
                  <th className="p-4 font-bold">SKU / Code</th>
                  <th className="p-4 font-bold">Product Name</th>
                  <th className="p-4 font-bold">Category</th>
                  <th className="p-4 font-bold text-center">In-Stock Quantity</th>
                  <th className="p-4 font-bold text-right">Selling Price</th>
                  <th className="p-4 font-bold text-right">Cost Price</th>
                  <th className="p-4 font-bold text-right text-emerald-800">Total Asset Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items
                  .filter((i) => selectedCategory === 'All' || i.category === selectedCategory)
                  .map(item => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="p-4 font-mono font-bold text-slate-500">{item.sku}</td>
                    <td className="p-4 font-extrabold text-slate-900">{item.name}</td>
                    <td className="p-4 font-semibold text-slate-600">{item.category}</td>
                    <td className="p-4 text-center font-extrabold text-slate-900">{item.quantity} {item.unit}</td>
                    <td className="p-4 text-right font-mono font-bold text-slate-800">{formatCurr(currency)} {item.price}</td>
                    <td className="p-4 text-right font-mono text-slate-500">{formatCurr(currency)} {item.costPrice}</td>
                    <td className="p-4 text-right font-mono font-extrabold text-emerald-700">{formatCurr(currency)} {(item.quantity * item.price).toLocaleString()}</td>
                  </tr>
                ))}
                {items.filter((i) => selectedCategory === 'All' || i.category === selectedCategory).length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-10 text-center text-slate-400">No inventory products registered.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* REPORT TYPE 5: REORDER ACTION LIST */}
      {reportType === 'reorder' && (
        <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
          <div className="p-4 bg-amber-50 border-b border-amber-200 flex justify-between items-center">
            <span className="font-extrabold text-amber-900 text-sm">⚠️ Urgent Restock & Reorder Action List</span>
            <span className="font-bold text-amber-800 text-xs bg-amber-100 px-3 py-1 rounded-xl">
              {items.filter(i => i.quantity <= i.reorderThreshold).length} Items Need Reorder ({suppliers.length} Vendors Registered)
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 uppercase tracking-wider text-[10px] border-b border-slate-200">
                <tr>
                  <th className="p-4 font-bold">SKU</th>
                  <th className="p-4 font-bold">Product Name</th>
                  <th className="p-4 font-bold">Supplier / Vendor</th>
                  <th className="p-4 font-bold text-center">Available Stock</th>
                  <th className="p-4 font-bold text-center">Alert Limit</th>
                  <th className="p-4 font-bold text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.filter(i => i.quantity <= i.reorderThreshold).map(item => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="p-4 font-mono font-bold text-slate-500">{item.sku}</td>
                    <td className="p-4 font-extrabold text-slate-900">{item.name}</td>
                    <td className="p-4 font-bold text-blue-700">{item.supplier}</td>
                    <td className="p-4 text-center font-extrabold text-rose-600">{item.quantity} {item.unit}</td>
                    <td className="p-4 text-center font-bold text-slate-700">{item.reorderThreshold} {item.unit}</td>
                    <td className="p-4 text-center">
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold ${
                        item.quantity === 0 ? 'bg-rose-500 text-white' : 'bg-amber-500 text-white'
                      }`}>
                        {item.quantity === 0 ? 'OUT OF STOCK' : 'LOW STOCK'}
                      </span>
                    </td>
                  </tr>
                ))}
                  {items.filter(i => i.quantity <= i.reorderThreshold).length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-10 text-center text-slate-400">All inventory items are sufficiently stocked above alert limits!</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* REPORT TYPE 6: DUE AGING REPORT */}
      {reportType === 'aging' && (
        <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <span className="font-extrabold text-slate-900 text-sm">Customer Due Aging Report (0–30 / 31–60 / 61–90 / 90+ Days)</span>
            <span className="text-xs font-extrabold text-rose-700 bg-rose-50 px-3 py-1 rounded-xl border border-rose-200">
              Total Due: {formatCurr(currency)} {agingData.totals.totalDue.toLocaleString()}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 uppercase text-[10px] border-b border-slate-200">
                <tr>
                  <th className="p-4 font-bold">Buyer Name</th>
                  <th className="p-4 font-bold text-right">0–30 Days</th>
                  <th className="p-4 font-bold text-right">31–60 Days</th>
                  <th className="p-4 font-bold text-right">61–90 Days</th>
                  <th className="p-4 font-bold text-right">90+ Days</th>
                  <th className="p-4 font-bold text-right">Total Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {agingData.rows.map(r => (
                  <tr key={r.wholesalerId} className="hover:bg-slate-50">
                    <td className="p-4 font-bold text-slate-900">{r.wholesalerName}</td>
                    <td className="p-4 text-right font-mono">{formatCurr(currency)} {r.bucket0_30.toLocaleString()}</td>
                    <td className="p-4 text-right font-mono text-amber-700">{formatCurr(currency)} {r.bucket31_60.toLocaleString()}</td>
                    <td className="p-4 text-right font-mono text-orange-700">{formatCurr(currency)} {r.bucket61_90.toLocaleString()}</td>
                    <td className="p-4 text-right font-mono font-bold text-rose-700">{formatCurr(currency)} {r.bucket90Plus.toLocaleString()}</td>
                    <td className="p-4 text-right font-mono font-black text-slate-950">{formatCurr(currency)} {r.totalDue.toLocaleString()}</td>
                  </tr>
                ))}
                {agingData.rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-10 text-center text-slate-400">No outstanding buyer dues.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* REPORT TYPE 7: SR & COMMISSIONS REPORT */}
      {reportType === 'salesreps' && (
        <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <span className="font-extrabold text-slate-900 text-sm">Sales Representative (SR / DSR) Performance &amp; Commission Report</span>
            <span className="text-xs font-extrabold text-violet-700 bg-violet-50 px-3 py-1 rounded-xl border border-violet-200">
              {salesRepData.length} Sales Reps
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 uppercase text-[10px] border-b border-slate-200">
                <tr>
                  <th className="p-4 font-bold">SR Name &amp; Area</th>
                  <th className="p-4 font-bold text-center">Buyers</th>
                  <th className="p-4 font-bold text-center">Invoices</th>
                  <th className="p-4 font-bold text-right">Total Sales</th>
                  <th className="p-4 font-bold text-center">Target Achv</th>
                  <th className="p-4 font-bold text-right">Comm. %</th>
                  <th className="p-4 font-bold text-right">Earned Comm.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {salesRepData.map(m => (
                  <tr key={m.rep.id} className="hover:bg-slate-50">
                    <td className="p-4">
                      <div className="font-bold text-slate-900">{m.rep.name}</div>
                      <div className="text-[10px] text-slate-400">{m.rep.area}</div>
                    </td>
                    <td className="p-4 text-center font-bold">{m.buyerCount}</td>
                    <td className="p-4 text-center font-bold">{m.invoiceCount}</td>
                    <td className="p-4 text-right font-mono font-bold text-slate-900">{formatCurr(currency)} {m.totalSales.toLocaleString()}</td>
                    <td className="p-4 text-center font-mono font-bold text-emerald-700">{m.targetAchievementPct}%</td>
                    <td className="p-4 text-right font-mono">{m.rep.commissionRate}%</td>
                    <td className="p-4 text-right font-mono font-black text-violet-700">{formatCurr(currency)} {m.earnedCommission.toLocaleString()}</td>
                  </tr>
                ))}
                {salesRepData.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-10 text-center text-slate-400">No Sales Representatives configured yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* REPORT TYPE 8: NET PROFIT & DEAD-STOCK ANALYTICS */}
      {reportType === 'profit-deadstock' && (
        <div className="space-y-5">
          {/* KPI Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-bold uppercase text-slate-500 block">
                Gross Sales Revenue
              </span>
              <span className="text-xl font-black text-slate-900 font-mono">
                {formatCurr(currency)} {profitDeadStockData.totalRevenue.toLocaleString()}
              </span>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-bold uppercase text-amber-600 block">
                COGS (Incl. {profitDeadStockData.totalBonusUnits} Free Pcs)
              </span>
              <span className="text-xl font-black text-amber-700 font-mono">
                {formatCurr(currency)} {profitDeadStockData.totalCogs.toLocaleString()}
              </span>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-bold uppercase text-emerald-700 block">
                Gross Net Profit ({profitDeadStockData.overallMarginPct}% Margin)
              </span>
              <span className="text-xl font-black text-emerald-700 font-mono">
                {formatCurr(currency)} {profitDeadStockData.totalGrossProfit.toLocaleString()}
              </span>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-bold uppercase text-rose-600 block">
                Dead Stock ({profitDeadStockData.deadStockRows.length} SKUs · {deadStockThresholdDays}d+)
              </span>
              <span className="text-xl font-black text-rose-700 font-mono">
                {formatCurr(currency)} {profitDeadStockData.deadStockCapitalValue.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Product-Wise Net Profit Table */}
          <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="font-extrabold text-slate-900 text-sm">
                Product-Wise Net Profit &amp; Margin Analysis
              </span>
              <span className="text-xs font-bold text-slate-600">
                {profitDeadStockData.soldRows.length} Products Sold
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 uppercase text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="p-3.5 font-bold">Product &amp; SKU</th>
                    <th className="p-3.5 font-bold">Category</th>
                    <th className="p-3.5 font-bold text-center">Billed Qty (+Free)</th>
                    <th className="p-3.5 font-bold text-right">Sales Revenue</th>
                    <th className="p-3.5 font-bold text-right">COGS Cost</th>
                    <th className="p-3.5 font-bold text-right">Gross Profit</th>
                    <th className="p-3.5 font-bold text-right">Margin %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {profitDeadStockData.soldRows.map((row) => (
                    <tr key={row.itemId} className="hover:bg-slate-50">
                      <td className="p-3.5">
                        <div className="font-bold text-slate-900">{row.itemName}</div>
                        <div className="text-[10px] font-mono text-slate-400">{row.sku}</div>
                      </td>
                      <td className="p-3.5 text-slate-600">{row.category}</td>
                      <td className="p-3.5 text-center font-mono font-bold">
                        {row.soldPaidUnits}
                        {row.bonusFreeUnits > 0 && (
                          <span className="text-emerald-700"> (+{row.bonusFreeUnits} Free)</span>
                        )}
                      </td>
                      <td className="p-3.5 text-right font-mono font-bold">
                        {formatCurr(currency)} {row.grossRevenue.toLocaleString()}
                      </td>
                      <td className="p-3.5 text-right font-mono text-amber-700">
                        {formatCurr(currency)} {row.cogs.toLocaleString()}
                      </td>
                      <td className="p-3.5 text-right font-mono font-black text-emerald-700">
                        {formatCurr(currency)} {row.grossProfit.toLocaleString()}
                      </td>
                      <td className="p-3.5 text-right font-mono font-bold">
                        {row.marginPct}%
                      </td>
                    </tr>
                  ))}
                  {profitDeadStockData.soldRows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-10 text-center text-slate-400">
                        No sales recorded for the selected date range and filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Slow & Dead-Stock Alert Table */}
          <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="font-extrabold text-slate-900 text-sm">
                  Slow-Moving &amp; Dead-Stock Alert
                </h4>
                <p className="text-xs text-slate-500">
                  In-stock SKUs with zero sales in the last {deadStockThresholdDays}+ days
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-bold no-print">
                {[30, 60, 90].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDeadStockThresholdDays(d)}
                    className={`px-3 py-1 rounded-lg cursor-pointer ${
                      deadStockThresholdDays === d
                        ? 'bg-rose-600 text-white font-extrabold'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {d}+ Days
                  </button>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 uppercase text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="p-3.5 font-bold">Product &amp; SKU</th>
                    <th className="p-3.5 font-bold">Category</th>
                    <th className="p-3.5 font-bold text-center">In-Stock Qty</th>
                    <th className="p-3.5 font-bold">Last Sold</th>
                    <th className="p-3.5 font-bold text-center">Days Idle</th>
                    <th className="p-3.5 font-bold text-right">Locked Cost Capital</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {profitDeadStockData.deadStockRows.map((d) => {
                    const matchedStock = items.find((it) => it.id === d.itemId);
                    return (
                    <tr key={d.itemId} className="hover:bg-slate-50">
                      <td className="p-3.5">
                        <div className="font-bold text-slate-900">{d.itemName}</div>
                        <div className="text-[10px] font-mono text-slate-400">
                          {d.sku} {matchedStock?.expiryDate ? `· Exp ${matchedStock.expiryDate}` : ''}
                        </div>
                      </td>
                      <td className="p-3.5 text-slate-600">{d.category}</td>
                      <td className="p-3.5 text-center font-mono font-bold">{d.currentStock}</td>
                      <td className="p-3.5 font-mono text-slate-500">
                        {d.lastSoldDate ? extractYYYYMMDD(d.lastSoldDate) : 'Never'}
                      </td>
                      <td className="p-3.5 text-center">
                        <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-700 font-mono font-extrabold text-[11px]">
                          {d.daysSinceLastSold === null ? '90+d' : `${d.daysSinceLastSold}d`}
                        </span>
                      </td>
                      <td className="p-3.5 text-right font-mono font-black text-rose-700">
                        {formatCurr(currency)} {d.lockedCapitalValue.toLocaleString()}
                      </td>
                    </tr>
                  );
                  })}
                  {profitDeadStockData.deadStockRows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-10 text-center text-slate-400">
                        No slow/dead-stock items found for {deadStockThresholdDays}+ days idle!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      </div>

      {/* PRINT CSS STYLES FOR EXECUTIVE REPORTS - PERFECT A4 PAGE FIT */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm 8mm 8mm 8mm;
          }
          html, body {
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body * {
            visibility: hidden !important;
          }
          #printable-report, #printable-report * {
            visibility: visible !important;
          }
          #printable-report {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            background: #ffffff !important;
            color: #020617 !important;
          }
          /* Ensure table fits A4 width without side clipping */
          table {
            width: 100% !important;
            table-layout: auto !important;
            font-size: 11px !important;
          }
          th, td {
            padding: 6px 8px !important;
            color: #000000 !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

    </div>
  );
};
