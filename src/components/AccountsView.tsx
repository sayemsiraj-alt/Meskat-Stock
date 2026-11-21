import React, { useState, useMemo } from 'react';
import {
  AccountTxn,
  Invoice,
  PaymentClaim,
  PurchaseBill,
  PurchaseReturn,
  Supplier,
  SupplierPayment,
  Wholesaler,
} from '../data/mockData';
import {
  DollarSign,
  ArrowUpRight,
  CheckCircle2,
  FileText,
  Users,
  Phone,
  MapPin,
  Receipt,
  MessageSquare,
  ShieldCheck,
  Clock,
  X,
  Image as ImageIcon,
  Truck,
  Download,
  Copy,
  Check,
} from 'lucide-react';
import {
  buildDueReminderWhatsAppText,
  computeDueAgingReport,
  getWhatsAppUrl,
} from '../utils/erpEnhancements';
import { buildSupplierStatementLedger } from '../utils/erpFeatureUtils';
import { downloadSupplierStatementPdf } from '../utils/printAndDownload';
import { formatDDMMYY, getLocalYYYYMMDD } from '../utils/dateUtils';
import { formatTkAmount } from '../utils/numberToWords';

const DUE_REMINDED_STORAGE_KEY = 'stock_erp_due_reminded_map';

interface AccountsViewProps {
  accountTxns: AccountTxn[];
  wholesalers: Wholesaler[];
  invoices: Invoice[];
  suppliers?: Supplier[];
  purchaseBills?: PurchaseBill[];
  purchaseReturns?: PurchaseReturn[];
  supplierPayments?: SupplierPayment[];
  paymentClaims?: PaymentClaim[];
  brandName?: string;
  currency: string;
  systemDate?: string;
  onAddTransaction: (txn: Omit<AccountTxn, 'id'>) => void;
  onUpdateWholesalerDue: (id: string, amount: number) => void;
  onPaySupplierDue?: (params: {
    supplierId: string;
    amount: number;
    paymentMethod: SupplierPayment['paymentMethod'];
    date: string;
    reference?: string;
    notes?: string;
  }) => SupplierPayment | null;
  onResolvePaymentClaim?: (
    claimId: string,
    decision: 'Approved' | 'Rejected',
    adminNotes?: string
  ) => void;
  searchQuery: string;
}

export const AccountsView: React.FC<AccountsViewProps> = ({
  accountTxns,
  wholesalers,
  invoices,
  suppliers = [],
  purchaseBills = [],
  purchaseReturns = [],
  supplierPayments = [],
  paymentClaims = [],
  brandName = 'Stock ERP',
  currency,
  systemDate,
  onAddTransaction,
  onUpdateWholesalerDue,
  onPaySupplierDue,
  onResolvePaymentClaim,
  searchQuery,
}) => {
  const [activeTab, setActiveTab] = useState<
    'wholesaler-due' | 'supplier-due' | 'claims' | 'aging' | 'ledger'
  >('wholesaler-due');
  const [isCollectModalOpen, setIsModalOpen] = useState(false);
  const [selectedWholesalerId, setSelectedWholesalerId] = useState<string>('');
  const [amount, setAmount] = useState<number | ''>('');
  const [reference, setReference] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [notes, setNotes] = useState('');
  const [previewSlipUrl, setPreviewSlipUrl] = useState<string | null>(null);

  // Pay Supplier Due modal state
  const [isPaySupModalOpen, setIsPaySupModalOpen] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [supPayAmount, setSupPayAmount] = useState<number | ''>('');
  const [supPayMethod, setSupPayMethod] = useState<SupplierPayment['paymentMethod']>('Cash');
  const [supPayRef, setSupPayRef] = useState('');
  const [supPayNotes, setSupPayNotes] = useState('');
  const [supPayDate, setSupPayDate] = useState(systemDate || getLocalYYYYMMDD());
  const [supPayNotice, setSupPayNotice] = useState('');

  // Overdue WhatsApp reminder queue state
  const [overdueMinDays, setOverdueMinDays] = useState<number>(0);
  const [onlyUnreminded, setOnlyUnreminded] = useState(false);
  const [summaryCopied, setSummaryCopied] = useState(false);
  const [remindedMap, setRemindedMap] = useState<Record<string, string>>(() => {
    try {
      const raw = localStorage.getItem(DUE_REMINDED_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  const persistRemindedMap = (next: Record<string, string>) => {
    setRemindedMap(next);
    try {
      localStorage.setItem(DUE_REMINDED_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore storage quota errors
    }
  };

  const markReminded = (wholesalerId: string) => {
    persistRemindedMap({
      ...remindedMap,
      [wholesalerId]: new Date().toISOString(),
    });
  };

  const toggleReminded = (wholesalerId: string) => {
    if (remindedMap[wholesalerId]) {
      const copy = { ...remindedMap };
      delete copy[wholesalerId];
      persistRemindedMap(copy);
    } else {
      markReminded(wholesalerId);
    }
  };

  const totalCashIn = useMemo(
    () =>
      accountTxns
        .filter((t) => t.type === 'IN')
        .reduce((sum, t) => sum + t.amount, 0),
    [accountTxns]
  );
  const totalCashOut = useMemo(
    () =>
      accountTxns
        .filter((t) => t.type === 'OUT')
        .reduce((sum, t) => sum + t.amount, 0),
    [accountTxns]
  );
  const currentBalance = totalCashIn - totalCashOut;
  const totalMarketDue = useMemo(
    () => wholesalers.reduce((sum, w) => sum + w.totalDue, 0),
    [wholesalers]
  );
  const totalSupplierPayable = useMemo(
    () => suppliers.reduce((sum, s) => sum + (s.totalDue || 0), 0),
    [suppliers]
  );

  const pendingClaimsCount = paymentClaims.filter(
    (c) => c.status === 'Pending'
  ).length;

  const agingReport = useMemo(
    () => computeDueAgingReport(wholesalers, invoices),
    [wholesalers, invoices]
  );

  const filteredAgingRows = useMemo(() => {
    return agingReport.rows.filter((r) => {
      if (overdueMinDays > 0 && r.oldestUnpaidDays < overdueMinDays) return false;
      if (onlyUnreminded && remindedMap[r.wholesalerId]) return false;
      return true;
    });
  }, [agingReport.rows, overdueMinDays, onlyUnreminded, remindedMap]);

  const supplierSummaryRows = useMemo(() => {
    return suppliers
      .map((s) => {
        const sBills = purchaseBills.filter(
          (b) => b.supplierId === s.id || b.supplierName.toLowerCase() === s.name.toLowerCase()
        );
        const sReturns = purchaseReturns.filter(
          (r) => r.supplierId === s.id || r.supplierName.toLowerCase() === s.name.toLowerCase()
        );
        const sPays = supplierPayments.filter(
          (p) => p.supplierId === s.id || p.supplierName.toLowerCase() === s.name.toLowerCase()
        );
        return {
          supplier: s,
          billsCount: sBills.length,
          totalPurchased: sBills.reduce((sum, b) => sum + b.totalAmount, 0),
          totalReturned: sReturns.reduce((sum, r) => sum + r.totalAmount, 0),
          totalPaid:
            sBills.reduce((sum, b) => sum + b.paidAmount, 0) +
            sPays.reduce((sum, p) => sum + p.amount, 0),
          currentDue: s.totalDue || 0,
        };
      })
      .filter(
        (row) =>
          row.supplier.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          row.supplier.phone.toLowerCase().includes(searchQuery.toLowerCase())
      );
  }, [suppliers, purchaseBills, purchaseReturns, supplierPayments, searchQuery]);

  // Wholesaler-wise summary calculations
  const wholesalerSummary = useMemo(() => {
    return wholesalers.map((w) => {
      const wInvoices = invoices.filter(
        (inv) => inv.wholesalerId === w.id || inv.wholesalerName === w.name
      );
      const totalBilled = wInvoices.reduce(
        (sum, inv) => sum + inv.totalAmount,
        0
      );
      const totalPaidAtSales = wInvoices.reduce(
        (sum, inv) => sum + inv.paidAmount,
        0
      );
      return {
        ...w,
        invoiceCount: wInvoices.length,
        totalBilled,
        totalPaidAtSales,
      };
    });
  }, [wholesalers, invoices]);

  // Filtered wholesalers
  const filteredWholesalers = wholesalerSummary.filter(
    (w) =>
      w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.phone.includes(searchQuery)
  );

  // Filtered transactions
  const filteredTxns = accountTxns.filter(
    (t) =>
      t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.reference.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const openCollectForWholesaler = (wholesalerId: string) => {
    setSelectedWholesalerId(wholesalerId);
    setAmount('');
    setReference('');
    setNotes('');
    setIsModalOpen(true);
  };

  const handleCollect = (e: React.FormEvent) => {
    e.preventDefault();
    const finalAmount = Number(amount);
    if (!selectedWholesalerId || finalAmount <= 0) return;

    const w = wholesalers.find((x) => x.id === selectedWholesalerId);

    // Reduce due
    onUpdateWholesalerDue(selectedWholesalerId, -finalAmount);

    // Log transaction
    const localDate = new Date();
    const offset = localDate.getTimezoneOffset() * 60000;
    const localISOTime = new Date(localDate.getTime() - offset)
      .toISOString()
      .slice(0, 19);

    const receiptNo =
      reference.trim() || `REC-${Date.now().toString().slice(-6)}`;
    onAddTransaction({
      date: localISOTime,
      type: 'IN',
      amount: finalAmount,
      reference: receiptNo,
      receiptNo,
      paymentMethod,
      wholesalerId: selectedWholesalerId,
      description: `Due collection from ${w?.name}${notes ? ` - ${notes}` : ''}`,
    });

    setIsModalOpen(false);
    setAmount('');
    setReference('');
    setNotes('');
  };

  const openPaySupplierModal = (supId = '') => {
    const sup = suppliers.find((s) => s.id === supId);
    setSelectedSupplierId(supId);
    setSupPayAmount(sup && sup.totalDue ? sup.totalDue : '');
    setSupPayMethod('Cash');
    setSupPayRef('');
    setSupPayNotes('');
    setSupPayDate(systemDate || getLocalYYYYMMDD());
    setIsPaySupModalOpen(true);
  };

  const handlePaySupplierSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onPaySupplierDue) return;
    const amt = Number(supPayAmount);
    if (!selectedSupplierId || amt <= 0) return;

    const res = onPaySupplierDue({
      supplierId: selectedSupplierId,
      amount: amt,
      paymentMethod: supPayMethod,
      reference: supPayRef.trim() || undefined,
      notes: supPayNotes.trim() || undefined,
      date: supPayDate,
    });

    if (res) {
      setIsPaySupModalOpen(false);
      setSupPayNotice(
        `Recorded payment ${res.receiptNo} (${formatTkAmount(res.amount)}) to ${res.supplierName}.`
      );
      setTimeout(() => setSupPayNotice(''), 4000);
    } else {
      setSupPayNotice('Could not record supplier payment. Please verify supplier and amount.');
    }
  };

  const handleCopyOverdueSummary = () => {
    const lines = filteredAgingRows.map(
      (r, idx) =>
        `${idx + 1}. ${r.wholesalerName} (${r.phone || 'N/A'}) — Due: ${formatTkAmount(
          r.totalDue
        )} (${r.oldestUnpaidDays}d oldest)`
    );
    const header = `*${brandName} — OVERDUE RECEIVABLES QUEUE*\nFilter: ${
      overdueMinDays > 0 ? `${overdueMinDays}+ Days` : 'All Overdue'
    } | Accounts: ${filteredAgingRows.length} | Total: ${formatTkAmount(
      filteredAgingRows.reduce((s, r) => s + r.totalDue, 0)
    )}\n-------------------------\n`;
    navigator.clipboard?.writeText(header + lines.join('\n'));
    setSummaryCopied(true);
    setTimeout(() => setSummaryCopied(false), 2000);
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto min-h-full">
      {supPayNotice && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-bold flex items-center justify-between">
          <span>{supPayNotice}</span>
          <button type="button" onClick={() => setSupPayNotice('')} className="font-black cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* Metrics Header */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500"></div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Net Cash Balance
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <span className="text-2xl font-extrabold text-slate-900">
            {currency} {currentBalance.toLocaleString()}
          </span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-rose-500"></div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Total Market Due (Receivable)
            </span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <span className="text-2xl font-extrabold text-rose-600">
            {currency} {totalMarketDue.toLocaleString()}
          </span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500"></div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Supplier Payable Due
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <span className="text-2xl font-extrabold text-amber-700">
            {currency} {totalSupplierPayable.toLocaleString()}
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-center gap-2">
          <button
            type="button"
            onClick={() => {
              setSelectedWholesalerId('');
              setIsModalOpen(true);
            }}
            className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-extrabold rounded-xl text-xs flex justify-center items-center gap-2 transition shadow-sm cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" /> Collect Customer Due
          </button>
          {onPaySupplierDue && (
            <button
              type="button"
              onClick={() => openPaySupplierModal('')}
              className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-extrabold rounded-xl text-xs flex justify-center items-center gap-2 transition cursor-pointer"
            >
              <Truck className="w-3.5 h-3.5 text-amber-400" /> Pay Supplier Due
            </button>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('wholesaler-due')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'wholesaler-due'
              ? 'bg-emerald-500 text-slate-950 shadow-xs font-extrabold'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Wholesaler Due Ledger</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('supplier-due')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'supplier-due'
              ? 'bg-amber-500 text-slate-950 shadow-xs font-extrabold'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>Supplier Due Ledger ({suppliers.filter((s) => (s.totalDue || 0) > 0).length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('claims')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'claims'
              ? 'bg-amber-500 text-slate-950 shadow-xs font-extrabold'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Payment Claims ({paymentClaims.length})</span>
          {pendingClaimsCount > 0 && (
            <span className="px-1.5 py-0.5 bg-rose-600 text-white rounded-md text-[10px] font-black">
              {pendingClaimsCount} Pending
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('aging')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'aging'
              ? 'bg-indigo-600 text-white shadow-xs font-extrabold'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Due Aging &amp; Reminder Queue</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('ledger')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'ledger'
              ? 'bg-cyan-500 text-slate-950 shadow-xs font-extrabold'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>Cash Ledger &amp; Transactions</span>
        </button>
      </div>

      {/* TAB 1: Wholesaler-Wise Due Breakdown */}
      {activeTab === 'wholesaler-due' && (
        <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h4 className="font-extrabold text-slate-800 text-sm">
                Customer / Wholesaler Due Receivables Ledger
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                কার কাছে কত টাকা পাওনা আছে তার সম্পূর্ণ হিসাব ও হোয়াটসঅ্যাপ রিমাইন্ডার
              </p>
            </div>
            <span className="text-xs font-bold text-slate-600 bg-slate-200/80 px-2.5 py-1 rounded-lg">
              {filteredWholesalers.length} Customers Listed
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 uppercase tracking-wider text-[10px] border-b border-slate-200">
                <tr>
                  <th className="p-4 font-bold">Wholesaler Name &amp; Phone</th>
                  <th className="p-4 font-bold">Address</th>
                  <th className="p-4 font-bold text-center">Total Chalans</th>
                  <th className="p-4 font-bold text-right">Total Billed</th>
                  <th className="p-4 font-bold text-right text-emerald-700">
                    Total Advance Paid
                  </th>
                  <th className="p-4 font-bold text-right text-rose-700">
                    Current Outstanding Due
                  </th>
                  <th className="p-4 font-bold text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredWholesalers.map((w) => (
                  <tr key={w.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-4">
                      <div className="font-extrabold text-slate-900 text-xs">
                        {w.name}
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3 text-slate-400" />{' '}
                        {w.phone || 'N/A'}
                      </div>
                    </td>
                    <td className="p-4 text-slate-600 max-w-xs truncate">
                      <div className="flex items-center gap-1 text-[11px]">
                        <MapPin className="w-3 h-3 text-slate-400 shrink-0" />{' '}
                        {w.address || 'N/A'}
                      </div>
                    </td>
                    <td className="p-4 text-center font-bold text-slate-800">
                      <span className="bg-slate-100 px-2 py-1 rounded text-slate-700">
                        {w.invoiceCount} Chalans
                      </span>
                    </td>
                    <td className="p-4 text-right font-mono font-bold text-slate-900">
                      {currency} {w.totalBilled.toLocaleString()}
                    </td>
                    <td className="p-4 text-right font-mono font-bold text-emerald-600">
                      {currency} {w.totalPaidAtSales.toLocaleString()}
                    </td>
                    <td className="p-4 text-right font-mono font-extrabold">
                      {w.totalDue > 0 ? (
                        <span className="px-2.5 py-1 bg-rose-100 text-rose-700 border border-rose-200 rounded-lg inline-block text-xs">
                          {currency} {w.totalDue.toLocaleString()}
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg inline-block text-xs">
                          Paid (0 Due)
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      {w.totalDue > 0 ? (
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openCollectForWholesaler(w.id)}
                            className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-xl text-xs transition shadow-xs flex items-center gap-1 cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Collect</span>
                          </button>
                          <a
                            href={getWhatsAppUrl(
                              w.phone,
                              buildDueReminderWhatsAppText(
                                w.name,
                                w.totalDue,
                                brandName
                              )
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl border border-emerald-200"
                            title="Send WhatsApp Due Reminder"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </a>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 font-semibold">
                          No Pending Due
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredWholesalers.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-10 text-center text-slate-400">
                      No wholesaler records found matching your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 1B: SUPPLIER PAYABLE LEDGER */}
      {activeTab === 'supplier-due' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="font-extrabold text-slate-800 text-sm">
                  Supplier / Vendor Payable Ledger (সাপ্লায়ার বাকি ও পেমেন্ট খাতা)
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Track purchase bills, purchase returns, vendor payments, and download statement PDFs
                </p>
              </div>
              {onPaySupplierDue && (
                <button
                  type="button"
                  onClick={() => openPaySupplierModal('')}
                  className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-extrabold rounded-xl text-xs cursor-pointer"
                >
                  + Pay Supplier Due
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 uppercase tracking-wider text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="p-4 font-bold">Supplier</th>
                    <th className="p-4 font-bold text-center">Purchase Bills</th>
                    <th className="p-4 font-bold text-right">Total Billed</th>
                    <th className="p-4 font-bold text-right">Returned Credit</th>
                    <th className="p-4 font-bold text-right text-emerald-700">Total Paid</th>
                    <th className="p-4 font-bold text-right text-rose-700">Payable Due</th>
                    <th className="p-4 font-bold text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {supplierSummaryRows.map((row) => (
                    <tr key={row.supplier.id} className="hover:bg-slate-50">
                      <td className="p-4">
                        <div className="font-extrabold text-slate-900">{row.supplier.name}</div>
                        <div className="text-[11px] text-slate-500">{row.supplier.phone}</div>
                      </td>
                      <td className="p-4 text-center font-bold">{row.billsCount} Bills</td>
                      <td className="p-4 text-right font-mono font-bold">
                        {formatTkAmount(row.totalPurchased)}
                      </td>
                      <td className="p-4 text-right font-mono text-indigo-700">
                        {formatTkAmount(row.totalReturned)}
                      </td>
                      <td className="p-4 text-right font-mono font-bold text-emerald-700">
                        {formatTkAmount(row.totalPaid)}
                      </td>
                      <td className="p-4 text-right font-mono font-black">
                        <span
                          className={`px-2.5 py-1 rounded-lg inline-block ${
                            row.currentDue > 0
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {formatTkAmount(row.currentDue)}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <div className="inline-flex items-center gap-1.5">
                          {onPaySupplierDue && (
                            <button
                              type="button"
                              onClick={() => openPaySupplierModal(row.supplier.id)}
                              className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-[11px] cursor-pointer"
                            >
                              Pay
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              const ledger = buildSupplierStatementLedger({
                                supplier: row.supplier,
                                purchaseBills,
                                purchaseReturns,
                                supplierPayments,
                              });
                              downloadSupplierStatementPdf({
                                brandTitle: brandName,
                                supplierName: row.supplier.name,
                                supplierPhone: row.supplier.phone,
                                supplierAddress: row.supplier.address,
                                entries: ledger.entries,
                                totalBilled: ledger.totalBilled,
                                totalPaidAndReturned: ledger.totalPaidAndReturned,
                                closingBalance: ledger.closingBalance,
                              });
                            }}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-lg text-[11px] inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Download className="w-3 h-3" /> PDF
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {supplierSummaryRows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-10 text-center text-slate-400">
                        No suppliers matched your search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {supplierPayments.length > 0 && (
            <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <h5 className="font-extrabold text-slate-800 text-xs uppercase tracking-wide">
                  Recent Supplier Payment Vouchers ({supplierPayments.length})
                </h5>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600 uppercase text-[10px]">
                    <tr>
                      <th className="p-3 font-bold">Ref / Voucher</th>
                      <th className="p-3 font-bold">Supplier</th>
                      <th className="p-3 font-bold">Method</th>
                      <th className="p-3 font-bold">Date</th>
                      <th className="p-3 font-bold text-right">Amount Paid</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {supplierPayments.slice(0, 15).map((p) => (
                      <tr key={p.id}>
                        <td className="p-3 font-mono font-bold text-slate-800">{p.reference}</td>
                        <td className="p-3 font-bold text-slate-900">{p.supplierName}</td>
                        <td className="p-3 text-slate-600">{p.paymentMethod}</td>
                        <td className="p-3 font-mono text-slate-500">{formatDDMMYY(p.date)}</td>
                        <td className="p-3 text-right font-mono font-black text-rose-700">
                          {formatTkAmount(p.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PAYMENT CLAIMS VERIFICATION */}
      {activeTab === 'claims' && (
        <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h4 className="font-extrabold text-slate-900 text-sm">
                Buyer Payment Claims &amp; Bank Slip Verification
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Review buyer bKash/Nagad/Bank slips. Approving deducts buyer due &amp; issues an official money receipt.
              </p>
            </div>
            <span className="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-lg text-xs font-extrabold">
              {pendingClaimsCount} Pending Review
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 uppercase text-[10px] border-b border-slate-200">
                <tr>
                  <th className="p-3.5 font-bold">Claim No &amp; Date</th>
                  <th className="p-3.5 font-bold">Buyer</th>
                  <th className="p-3.5 font-bold">Method &amp; TrxID</th>
                  <th className="p-3.5 font-bold text-right">Claimed Amount</th>
                  <th className="p-3.5 font-bold text-center">Bank Slip</th>
                  <th className="p-3.5 font-bold text-center">Status</th>
                  <th className="p-3.5 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paymentClaims.map((claim) => (
                  <tr key={claim.id} className="hover:bg-slate-50">
                    <td className="p-3.5">
                      <div className="font-mono font-bold text-slate-900">
                        {claim.claimNo}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Paid: {formatDDMMYY(claim.paymentDate)}
                      </div>
                    </td>
                    <td className="p-3.5 font-bold text-blue-700">
                      {claim.wholesalerName}
                    </td>
                    <td className="p-3.5">
                      <span className="font-bold text-slate-800">
                        {claim.paymentMethod}
                      </span>
                      <div className="text-[11px] font-mono text-slate-500">
                        Trx: {claim.trxId}
                      </div>
                    </td>
                    <td className="p-3.5 text-right font-mono font-black text-emerald-700">
                      {formatTkAmount(claim.amount)}
                    </td>
                    <td className="p-3.5 text-center">
                      {claim.slipImageUrl ? (
                        <button
                          type="button"
                          onClick={() => setPreviewSlipUrl(claim.slipImageUrl || null)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-[11px] font-bold text-slate-800 cursor-pointer"
                        >
                          <ImageIcon className="w-3.5 h-3.5 text-indigo-600" />
                          <span>View Slip</span>
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-400">No Slip</span>
                      )}
                    </td>
                    <td className="p-3.5 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                          claim.status === 'Approved'
                            ? 'bg-emerald-100 text-emerald-800'
                            : claim.status === 'Rejected'
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {claim.status}
                        {claim.receiptNo ? ` (${claim.receiptNo})` : ''}
                      </span>
                    </td>
                    <td className="p-3.5 text-right">
                      {claim.status === 'Pending' && onResolvePaymentClaim ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              onResolvePaymentClaim(claim.id, 'Approved')
                            }
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-lg text-[11px] cursor-pointer"
                          >
                            Approve &amp; Receipt
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              onResolvePaymentClaim(claim.id, 'Rejected', 'Verification failed')
                            }
                            className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-lg text-[11px] cursor-pointer"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-semibold">
                          Processed
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {paymentClaims.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-10 text-center text-slate-400">
                      No payment verification claims submitted by buyers yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: DUE AGING & OVERDUE WHATSAPP REMINDER QUEUE */}
      {activeTab === 'aging' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold uppercase text-emerald-600 block">
                0–30 Days Current
              </span>
              <span className="text-xl font-black text-slate-900 font-mono">
                {formatTkAmount(agingReport.totals.bucket0_30)}
              </span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold uppercase text-amber-600 block">
                31–60 Days Overdue
              </span>
              <span className="text-xl font-black text-amber-700 font-mono">
                {formatTkAmount(agingReport.totals.bucket31_60)}
              </span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold uppercase text-orange-600 block">
                61–90 Days Critical
              </span>
              <span className="text-xl font-black text-orange-700 font-mono">
                {formatTkAmount(agingReport.totals.bucket61_90)}
              </span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold uppercase text-rose-600 block">
                90+ Days High Risk
              </span>
              <span className="text-xl font-black text-rose-700 font-mono">
                {formatTkAmount(agingReport.totals.bucket90Plus)}
              </span>
            </div>
          </div>

          {/* Overdue Filter & Queue Controls */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold">
              {[
                { days: 0, label: 'All Overdue' },
                { days: 15, label: '15+ Days' },
                { days: 30, label: '30+ Days' },
                { days: 60, label: '60+ Days' },
                { days: 90, label: '90+ Days' },
              ].map((opt) => (
                <button
                  key={opt.days}
                  type="button"
                  onClick={() => setOverdueMinDays(opt.days)}
                  className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
                    overdueMinDays === opt.days
                      ? 'bg-indigo-600 text-white font-extrabold'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setOnlyUnreminded((p) => !p)}
                className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
                  onlyUnreminded
                    ? 'bg-amber-500 text-slate-950 font-extrabold'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Unreminded Only
              </button>
            </div>

            <div className="flex items-center gap-2">
              {Object.keys(remindedMap).length > 0 && (
                <button
                  type="button"
                  onClick={() => persistRemindedMap({})}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Clear Reminded Flags
                </button>
              )}
              <button
                type="button"
                onClick={handleCopyOverdueSummary}
                className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
              >
                {summaryCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{summaryCopied ? 'Copied!' : 'Copy Overdue Summary'}</span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h4 className="font-extrabold text-slate-900 text-sm">
                Receivables Due Aging &amp; WhatsApp Reminder Queue ({filteredAgingRows.length})
              </h4>
              <span className="text-xs font-extrabold text-rose-700">
                Queue Total: {formatTkAmount(filteredAgingRows.reduce((s, r) => s + r.totalDue, 0))}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 uppercase text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="p-3.5 font-bold">Customer</th>
                    <th className="p-3.5 font-bold text-right">0–30 Days</th>
                    <th className="p-3.5 font-bold text-right">31–60 Days</th>
                    <th className="p-3.5 font-bold text-right">61–90 Days</th>
                    <th className="p-3.5 font-bold text-right">90+ Days</th>
                    <th className="p-3.5 font-bold text-right">Total Due</th>
                    <th className="p-3.5 font-bold text-center">Reminder Queue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAgingRows.map((r) => {
                    const remindedAt = remindedMap[r.wholesalerId];
                    return (
                      <tr key={r.wholesalerId} className="hover:bg-slate-50">
                        <td className="p-3.5">
                          <div className="font-bold text-slate-900">{r.wholesalerName}</div>
                          <div className="text-[10px] text-slate-400">
                            Oldest unpaid: {r.oldestUnpaidDays}d
                            {remindedAt && (
                              <span className="ml-2 text-emerald-700 font-bold">
                                · Reminded {formatDDMMYY(remindedAt)}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3.5 text-right font-mono text-slate-700">
                          {formatTkAmount(r.bucket0_30)}
                        </td>
                        <td className="p-3.5 text-right font-mono text-amber-700">
                          {formatTkAmount(r.bucket31_60)}
                        </td>
                        <td className="p-3.5 text-right font-mono text-orange-700">
                          {formatTkAmount(r.bucket61_90)}
                        </td>
                        <td className="p-3.5 text-right font-mono font-bold text-rose-700">
                          {formatTkAmount(r.bucket90Plus)}
                        </td>
                        <td className="p-3.5 text-right font-mono font-black text-slate-950">
                          {formatTkAmount(r.totalDue)}
                        </td>
                        <td className="p-3.5 text-center">
                          <div className="inline-flex items-center gap-1.5">
                            <a
                              href={getWhatsAppUrl(
                                r.phone,
                                buildDueReminderWhatsAppText(
                                  r.wholesalerName,
                                  r.totalDue,
                                  brandName
                                )
                              )}
                              onClick={() => markReminded(r.wholesalerId)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-[11px] font-bold"
                            >
                              <MessageSquare className="w-3.5 h-3.5" /> Remind
                            </a>
                            <button
                              type="button"
                              onClick={() => toggleReminded(r.wholesalerId)}
                              className={`px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer ${
                                remindedAt
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              }`}
                            >
                              {remindedAt ? 'Reminded ✓' : 'Mark Sent'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredAgingRows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-10 text-center text-slate-400">
                        No overdue buyer accounts matched this filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Cash Ledger & Transactions */}
      {activeTab === 'ledger' && (
        <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-800">
              <FileText className="w-4 h-4" />
              <h4 className="font-bold text-sm">Account Cash Ledger History</h4>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-600 uppercase tracking-wider text-[10px] border-b border-slate-200">
                <tr>
                  <th className="p-4 font-bold">Ref No.</th>
                  <th className="p-4 font-bold">Type</th>
                  <th className="p-4 font-bold">Amount</th>
                  <th className="p-4 font-bold">Date & Time</th>
                  <th className="p-4 font-bold">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTxns.map(t => (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="p-4 font-mono font-bold text-slate-700">{t.reference}</td>
                    <td className="p-4 font-bold">
                      <span className={`px-2 py-0.5 rounded text-[10px] ${t.type === 'IN' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                        {t.type === 'IN' ? 'CASH IN' : 'CASH OUT'}
                      </span>
                    </td>
                    <td className={`p-4 font-extrabold font-mono ${t.type === 'IN' ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {t.type === 'IN' ? '+' : '-'}{currency} {t.amount.toLocaleString()}
                    </td>
                    <td className="p-4 text-slate-500 font-mono">{t.date.replace('T', ' ')}</td>
                    <td className="p-4 text-slate-700 max-w-xs truncate">{t.description}</td>
                  </tr>
                ))}
                {filteredTxns.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-10 text-center text-slate-400">No account transactions found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Collect Modal */}
      {isCollectModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 sm:p-8 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-800 text-lg">Collect Due Payment</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold text-base p-1">✕</button>
            </div>
            <form onSubmit={handleCollect} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 tracking-wide">Select Customer</label>
                <select 
                  value={selectedWholesalerId} 
                  onChange={e => setSelectedWholesalerId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                  required
                >
                  <option value="">-- Select Customer --</option>
                  {wholesalers.filter(w => w.totalDue > 0).map(w => (
                    <option key={w.id} value={w.id}>{w.name} (Due: {currency} {w.totalDue.toLocaleString()})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 tracking-wide">Received Amount ({currency})</label>
                <input
                  type="number" min="1" required
                  value={amount} onChange={e => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 tracking-wide">Payment Method</label>
                  <select
                    value={paymentMethod}
                    onChange={e => setPaymentMethod(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="bKash">bKash</option>
                    <option value="Nagad">Nagad</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 tracking-wide">Receipt / Ref No</label>
                  <input
                    type="text"
                    value={reference} onChange={e => setReference(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                    placeholder="e.g. REC-9901"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 tracking-wide">Notes</label>
                <input
                  type="text"
                  value={notes} onChange={e => setNotes(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                  placeholder="Cash/bKash/Bank Transfer..."
                />
              </div>
              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition">Cancel</button>
                <button type="submit" className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-extrabold px-6 py-2.5 rounded-xl text-xs shadow-md transition">Confirm Collection</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pay Supplier Due Modal */}
      {isPaySupModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-800 text-lg">Pay Supplier Due</h3>
              <button
                type="button"
                onClick={() => setIsPaySupModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-base p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handlePaySupplierSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 tracking-wide">
                  Select Supplier
                </label>
                <select
                  value={selectedSupplierId}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    setSelectedSupplierId(nextId);
                    const sup = suppliers.find((s) => s.id === nextId);
                    if (sup && (sup.totalDue || 0) > 0) {
                      setSupPayAmount(sup.totalDue || 0);
                    }
                  }}
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800"
                >
                  <option value="">-- Select Supplier --</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} (Due: {currency} {(s.totalDue || 0).toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                    Paid Amount ({currency})
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={supPayAmount}
                    onChange={(e) =>
                      setSupPayAmount(e.target.value === '' ? '' : Number(e.target.value))
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                    Date
                  </label>
                  <input
                    type="date"
                    value={supPayDate}
                    onChange={(e) => setSupPayDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                    Payment Method
                  </label>
                  <select
                    value={supPayMethod}
                    onChange={(e) =>
                      setSupPayMethod(e.target.value as SupplierPayment['paymentMethod'])
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Card">Card</option>
                    <option value="bKash">bKash</option>
                    <option value="Nagad">Nagad</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                    Voucher / Ref No
                  </label>
                  <input
                    type="text"
                    value={supPayRef}
                    onChange={(e) => setSupPayRef(e.target.value)}
                    placeholder="Auto if empty"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  Notes
                </label>
                <input
                  type="text"
                  value={supPayNotes}
                  onChange={(e) => setSupPayNotes(e.target.value)}
                  placeholder="Optional payment note..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900"
                />
              </div>
              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsPaySupModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-slate-900 hover:bg-slate-800 text-white font-extrabold px-5 py-2 rounded-xl text-xs cursor-pointer"
                >
                  Confirm Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bank Slip Image Preview Modal */}
      {previewSlipUrl && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-emerald-600" />
                Submitted Payment Slip / Proof
              </span>
              <button
                type="button"
                onClick={() => setPreviewSlipUrl(null)}
                aria-label="Close Slip Preview"
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-auto rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center p-2">
              <img
                src={previewSlipUrl}
                alt="Submitted Payment Slip"
                className="max-w-full max-h-[64vh] object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
