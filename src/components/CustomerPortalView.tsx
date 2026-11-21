import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccountTxn,
  CustomerOrder,
  CustomerReturn,
  CustomerReturnItem,
  Invoice,
  InvoiceItem,
  PaymentClaim,
  StockItem,
  SystemSettings,
  SystemUser,
  Wholesaler,
} from '../data/mockData';
import {
  LayoutDashboard,
  ShoppingBag,
  FileText,
  History,
  RotateCcw,
  Receipt,
  BookOpen,
  UserCheck,
  LogOut,
  Truck,
  Package,
  Printer,
  Download,
  Plus,
  Trash2,
  CheckCircle2,
  Search,
  Sparkles,
  Lock,
  Menu,
  X,
  ArrowRight,
  ExternalLink,
  MessageSquare,
  Upload,
  ShieldAlert,
  CreditCard,
} from 'lucide-react';
import { CompanyLogo } from './CompanyLogo';
import { InvoiceReceiptModal } from './InvoiceReceiptModal';
import { formatDDMMYY, getLocalYYYYMMDD } from '../utils/dateUtils';
import { formatTkAmount, numberToEnglishWords } from '../utils/numberToWords';
import {
  buildBuyerAccountStatement,
  buildRepeatOrderItems,
  getBuyerInvoices,
  getBuyerPaymentTxns,
} from '../utils/customerPortalUtils';
import {
  buildReceiptWhatsAppText,
  evaluateCreditLimit,
  getCourierTrackingUrl,
  getWhatsAppUrl,
  resolveWholesaleUnitPrice,
} from '../utils/erpEnhancements';
import {
  downloadCustomerStatementPdf,
  downloadPaymentReceiptPdf,
  isInsideIframeEnv,
} from '../utils/printAndDownload';

type CustomerTab =
  | 'dashboard'
  | 'catalog'
  | 'orders'
  | 'invoices'
  | 'history'
  | 'returns'
  | 'payments'
  | 'statement'
  | 'profile';

interface CustomerPortalViewProps {
  buyer: Wholesaler;
  currentUser: SystemUser;
  settings: SystemSettings;
  items: StockItem[];
  invoices: Invoice[];
  accountTxns: AccountTxn[];
  customerOrders: CustomerOrder[];
  customerReturns: CustomerReturn[];
  paymentClaims?: PaymentClaim[];
  enforceCreditLimit?: boolean;
  onPlaceOrder: (order: Omit<CustomerOrder, 'id'>) => void;
  onSubmitReturn: (ret: Omit<CustomerReturn, 'id'>) => void;
  onSubmitPaymentClaim?: (
    claim: Omit<PaymentClaim, 'id' | 'claimNo' | 'status' | 'createdAt'>
  ) => void;
  onConfirmDelivery?: (orderId: string) => void;
  onUpdateProfile: (
    updatedBuyer: Wholesaler,
    newPassword?: string
  ) => void;
  onLogout: () => void;
}

export const CustomerPortalView: React.FC<CustomerPortalViewProps> = ({
  buyer,
  currentUser,
  settings,
  items,
  invoices,
  accountTxns,
  customerOrders,
  customerReturns,
  paymentClaims = [],
  enforceCreditLimit: enforceCreditLimitProp,
  onPlaceOrder,
  onSubmitReturn,
  onSubmitPaymentClaim,
  onConfirmDelivery,
  onUpdateProfile,
  onLogout,
}) => {
  const enforceCreditLimit =
    enforceCreditLimitProp ?? settings.enforceCreditLimit ?? true;
  const [activeTab, setActiveTabState] = useState<CustomerTab>('dashboard');
  const portalStackRef = useRef<CustomerTab[]>(['dashboard']);
  const activeTabRef = useRef<CustomerTab>('dashboard');
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const isMobileNavRef = useRef(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    isMobileNavRef.current = isMobileNavOpen;
  }, [isMobileNavOpen]);

  const setActiveTab = useCallback((nextTab: CustomerTab) => {
    setIsMobileNavOpen(false);
    if (nextTab === activeTabRef.current) return;
    const nextStack = [...portalStackRef.current, nextTab].slice(-25);
    portalStackRef.current = nextStack;
    setActiveTabState(nextTab);
    if (typeof window !== 'undefined') {
      try {
        window.history.pushState(
          { erpScope: 'portal', portalTab: nextTab, depth: nextStack.length },
          ''
        );
      } catch {
        // ignore
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.history.replaceState(
        { erpScope: 'portal', portalTab: activeTabRef.current, depth: 0, portalRoot: true },
        ''
      );
      window.history.pushState(
        { erpScope: 'portal', portalTab: activeTabRef.current, depth: 1, portalGuard: true },
        ''
      );
    } catch {
      // ignore
    }

    const handlePopState = () => {
      if (isMobileNavRef.current) {
        setIsMobileNavOpen(false);
        try {
          window.history.pushState(
            { erpScope: 'portal', portalTab: activeTabRef.current, depth: portalStackRef.current.length },
            ''
          );
        } catch {
          // ignore
        }
        return;
      }

      const backEvt = new CustomEvent('erp:history-back', { cancelable: true });
      const notCancelled = window.dispatchEvent(backEvt);
      if (!notCancelled) {
        try {
          window.history.pushState(
            { erpScope: 'portal', portalTab: activeTabRef.current, depth: portalStackRef.current.length },
            ''
          );
        } catch {
          // ignore
        }
        return;
      }

      if (portalStackRef.current.length > 1) {
        const nextStack = portalStackRef.current.slice(0, -1);
        const target = nextStack[nextStack.length - 1] || 'dashboard';
        portalStackRef.current = nextStack;
        setActiveTabState(target);
        if (nextStack.length <= 1) {
          try {
            window.history.pushState(
              { erpScope: 'portal', portalTab: target, depth: 1, portalGuard: true },
              ''
            );
          } catch {
            // ignore
          }
        }
        return;
      }

      if (activeTabRef.current !== 'dashboard') {
        portalStackRef.current = ['dashboard'];
        setActiveTabState('dashboard');
      }
      try {
        window.history.pushState(
          { erpScope: 'portal', portalTab: 'dashboard', depth: 1, portalGuard: true },
          ''
        );
      } catch {
        // ignore
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Order placement cart state
  const [cart, setCart] = useState<InvoiceItem[]>([]);
  const [qtyInputs, setQtyInputs] = useState<Record<string, string>>({});
  const [advanceSubmitted, setAdvanceSubmitted] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('Bank Transfer');
  const [paymentRef, setPaymentRef] = useState<string>('');
  const [orderNotes, setOrderNotes] = useState<string>('');
  const [orderBanner, setOrderBanner] = useState<{
    type: 'success' | 'info' | 'error';
    text: string;
  } | null>(null);

  // Invoice Preview Modal
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);

  // Payment Receipt Modal
  const [previewReceipt, setPreviewReceipt] = useState<AccountTxn | null>(null);

  // Return Request Form State
  const [returnInvoiceId, setReturnInvoiceId] = useState<string>('');
  const [returnQtys, setReturnQtys] = useState<Record<string, string>>({});
  const [returnReason, setReturnReason] = useState<string>('Damaged in Transit');
  const [returnNotes, setReturnNotes] = useState<string>('');
  const [returnMsg, setReturnMsg] = useState<string>('');

  // Payment Claim Submission State
  const [claimAmount, setClaimAmount] = useState<string>('');
  const [claimMethod, setClaimMethod] = useState<
    'bKash' | 'Nagad' | 'Bank Transfer' | 'Cash'
  >('bKash');
  const [claimTrxId, setClaimTrxId] = useState<string>('');
  const [claimDate, setClaimDate] = useState<string>(getLocalYYYYMMDD());
  const [claimSlipUrl, setClaimSlipUrl] = useState<string>('');
  const [claimNotes, setClaimNotes] = useState<string>('');
  const [claimBanner, setClaimBanner] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Statement Date Filter
  const [stmtFrom, setStmtFrom] = useState<string>('');
  const [stmtTo, setStmtTo] = useState<string>('');

  // Profile Form State
  const [profName, setProfName] = useState(buyer.name);
  const [profShop, setProfShop] = useState(buyer.shopName || '');
  const [profPhone, setProfPhone] = useState(buyer.phone || '');
  const [profEmail, setProfEmail] = useState(buyer.email || currentUser.email || '');
  const [profAddress, setProfAddress] = useState(buyer.address || '');
  const [curPwd, setCurPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [profileMsg, setProfileMsg] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Scoped buyer data (strict isolation to buyer.id)
  const myInvoices = useMemo(
    () => getBuyerInvoices(invoices, buyer.id),
    [invoices, buyer.id]
  );

  const myOrders = useMemo(
    () =>
      customerOrders
        .filter((o) => o.wholesalerId === buyer.id)
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ),
    [customerOrders, buyer.id]
  );

  const myReturns = useMemo(
    () =>
      customerReturns
        .filter((r) => r.wholesalerId === buyer.id)
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ),
    [customerReturns, buyer.id]
  );

  const myPaymentTxns = useMemo(
    () =>
      getBuyerPaymentTxns(accountTxns, myInvoices, buyer.id, buyer.name).sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      ),
    [accountTxns, myInvoices, buyer.id, buyer.name]
  );

  const myPaymentClaims = useMemo(
    () =>
      paymentClaims
        .filter((c) => c.wholesalerId === buyer.id)
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ),
    [paymentClaims, buyer.id]
  );

  const statement = useMemo(
    () =>
      buildBuyerAccountStatement({
        buyer,
        invoices: myInvoices,
        accountTxns: myPaymentTxns,
        returns: myReturns,
      }),
    [buyer, myInvoices, myPaymentTxns, myReturns]
  );

  const filteredStatementEntries = useMemo(() => {
    return statement.entries.filter((e) => {
      const d = e.date.slice(0, 10);
      if (stmtFrom && d < stmtFrom) return false;
      if (stmtTo && d > stmtTo) return false;
      return true;
    });
  }, [statement.entries, stmtFrom, stmtTo]);

  // Purchase history flattened by item
  const purchaseHistoryRows = useMemo(() => {
    const rows: Array<{
      invoiceId: string;
      chalanNo: string;
      date: string;
      itemName: string;
      packSize: string;
      batchNo: string;
      unitPrice: number;
      quantity: number;
      total: number;
      courierName?: string;
    }> = [];
    for (const inv of myInvoices) {
      for (const it of inv.items) {
        rows.push({
          invoiceId: inv.id,
          chalanNo: inv.chalanNo,
          date: inv.deliveryDate || inv.date,
          itemName: it.itemName,
          packSize: it.packSize || '-',
          batchNo: it.batchNo || '-',
          unitPrice: it.unitPrice,
          quantity: it.quantity,
          total: it.total,
          courierName: inv.courierName,
        });
      }
    }
    if (!searchQuery.trim()) return rows;
    const q = searchQuery.toLowerCase();
    return rows.filter(
      (r) =>
        r.itemName.toLowerCase().includes(q) ||
        r.chalanNo.toLowerCase().includes(q) ||
        r.batchNo.toLowerCase().includes(q)
    );
  }, [myInvoices, searchQuery]);

  // KPI metrics
  const totalAdvancesAndPayments = useMemo(() => {
    if (myPaymentTxns.length > 0) {
      return myPaymentTxns.reduce((sum, t) => sum + t.amount, 0);
    }
    return myInvoices.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0);
  }, [myPaymentTxns, myInvoices]);

  const activeOrdersCount = useMemo(
    () =>
      myOrders.filter(
        (o) => o.status !== 'Delivered' && o.status !== 'Cancelled'
      ).length,
    [myOrders]
  );

  const courierShipments = useMemo(
    () =>
      myInvoices.filter(
        (inv) => inv.courierName || inv.courierTrackingNo || inv.totalCartons
      ),
    [myInvoices]
  );

  const filteredCatalog = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return items.filter(
      (i) =>
        !q ||
        i.name.toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q) ||
        i.sku.toLowerCase().includes(q)
    );
  }, [items, searchQuery]);

  const cartTotal = useMemo(
    () => cart.reduce((sum, c) => sum + c.total, 0),
    [cart]
  );

  const netOrderDue = useMemo(
    () => Math.max(0, cartTotal - (Number(advanceSubmitted) || 0)),
    [cartTotal, advanceSubmitted]
  );

  const creditCheck = useMemo(
    () => evaluateCreditLimit(buyer, netOrderDue),
    [buyer, netOrderDue]
  );
  const isBlockedByCreditLimit = enforceCreditLimit && creditCheck.exceeds;

  const handleAddToCart = (item: StockItem) => {
    const requestedQty = Number(qtyInputs[item.id] || 1);
    if (!requestedQty || requestedQty <= 0) return;

    if (requestedQty > item.quantity) {
      setOrderBanner({
        type: 'error',
        text: `Only ${item.quantity} units of ${item.name} are currently available.`,
      });
      return;
    }

    const existing = cart.find((c) => c.itemId === item.id);
    if (existing) {
      const nextQty = existing.quantity + requestedQty;
      if (nextQty > item.quantity) {
        setOrderBanner({
          type: 'error',
          text: `Total quantity exceeds available stock (${item.quantity}) for ${item.name}.`,
        });
        return;
      }
      const { unitPrice } = resolveWholesaleUnitPrice(item, buyer, nextQty);
      setCart(
        cart.map((c) =>
          c.itemId === item.id
            ? { ...c, quantity: nextQty, unitPrice, total: nextQty * unitPrice }
            : c
        )
      );
    } else {
      const { unitPrice } = resolveWholesaleUnitPrice(item, buyer, requestedQty);
      setCart([
        ...cart,
        {
          itemId: item.id,
          itemName: item.name,
          packSize: item.packSize || item.unit || 'Standard',
          batchNo: item.batchNo,
          mfgDate: item.mfgDate ? formatDDMMYY(item.mfgDate) : undefined,
          expiryDate: item.expiryDate ? formatDDMMYY(item.expiryDate) : undefined,
          retailPrice: item.retailPrice || unitPrice,
          unitPrice,
          quantity: requestedQty,
          total: requestedQty * unitPrice,
        },
      ]);
    }
    setQtyInputs((prev) => ({ ...prev, [item.id]: '' }));
    setOrderBanner(null);
  };

  const handleUpdateCartItemQty = (itemId: string, nextQtyRaw: number) => {
    const stock = items.find((i) => i.id === itemId);
    const nextQty = Math.max(1, Math.min(nextQtyRaw, stock?.quantity ?? nextQtyRaw));
    setCart((prev) =>
      prev.map((c) => {
        if (c.itemId !== itemId) return c;
        const unitPrice = stock
          ? resolveWholesaleUnitPrice(stock, buyer, nextQty).unitPrice
          : c.unitPrice;
        return { ...c, quantity: nextQty, unitPrice, total: nextQty * unitPrice };
      })
    );
  };

  const handleRepeatItems = (sourceItems: InvoiceItem[], label: string) => {
    const { items: rawRebuilt, skippedNames, adjustedNames } =
      buildRepeatOrderItems(sourceItems, items, buyer);

    const rebuilt = rawRebuilt.map((ri) => {
      const stock = items.find((i) => i.id === ri.itemId);
      if (!stock) return ri;
      const { unitPrice } = resolveWholesaleUnitPrice(stock, buyer, ri.quantity);
      return { ...ri, unitPrice, total: unitPrice * ri.quantity };
    });

    if (rebuilt.length === 0) {
      setOrderBanner({
        type: 'error',
        text: `Could not repeat ${label}: none of the items are currently in stock.`,
      });
      setActiveTab('catalog');
      return;
    }

    setCart(rebuilt);
    setPreviewInvoice(null);
    setActiveTab('catalog');

    const warnings: string[] = [];
    if (skippedNames.length) warnings.push(`Skipped out-of-stock: ${skippedNames.join(', ')}`);
    if (adjustedNames.length) warnings.push(`Adjusted qty to available stock: ${adjustedNames.join(', ')}`);

    setOrderBanner({
      type: 'info',
      text: `Loaded ${rebuilt.length} items from ${label} into your order cart at your current approved/tiered prices.${warnings.length ? ` (${warnings.join(' | ')})` : ''}`,
    });
  };

  const handleSubmitOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) {
      setOrderBanner({
        type: 'error',
        text: 'Add at least one product to your order cart first.',
      });
      return;
    }

    if (isBlockedByCreditLimit) {
      setOrderBanner({
        type: 'error',
        text: `Order blocked: projected balance (${formatTkAmount(
          creditCheck.projectedDue
        )}) exceeds your approved credit limit (${formatTkAmount(
          creditCheck.creditLimit
        )}). Increase your advance payment or clear existing dues.`,
      });
      return;
    }

    const orderNo = `ORD-${Date.now().toString().slice(-6)}`;
    onPlaceOrder({
      orderNo,
      wholesalerId: buyer.id,
      wholesalerName: buyer.name,
      customerPhone: buyer.phone,
      customerAddress: buyer.address,
      items: cart,
      totalAmount: cartTotal,
      advanceSubmitted: Number(advanceSubmitted) || 0,
      paymentMethod: Number(advanceSubmitted) > 0 ? paymentMethod : undefined,
      paymentRef: paymentRef.trim() || undefined,
      status: 'Pending Approval',
      notes: orderNotes.trim() || undefined,
      createdAt: new Date().toISOString(),
    });

    setCart([]);
    setAdvanceSubmitted('');
    setPaymentRef('');
    setOrderNotes('');
    setOrderBanner({
      type: 'success',
      text: `Order ${orderNo} submitted for Admin approval! Track its status under "My Orders & Courier".`,
    });
    setActiveTab('orders');
  };

  const selectedReturnInvoice = useMemo(
    () => myInvoices.find((i) => i.id === returnInvoiceId),
    [myInvoices, returnInvoiceId]
  );

  const handleSubmitReturn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReturnInvoice) return;

    const selectedItems: CustomerReturnItem[] = [];
    for (const it of selectedReturnInvoice.items) {
      const q = Number(returnQtys[it.itemId] || 0);
      if (q > 0) {
        const clamped = Math.min(q, it.quantity);
        selectedItems.push({
          itemId: it.itemId,
          itemName: it.itemName,
          packSize: it.packSize,
          quantity: clamped,
          unitPrice: it.unitPrice,
          total: clamped * it.unitPrice,
        });
      }
    }

    if (selectedItems.length === 0) {
      setReturnMsg('Please enter a return quantity for at least one product.');
      return;
    }

    const totalCredit = selectedItems.reduce((s, r) => s + r.total, 0);
    const returnNo = `RET-${Date.now().toString().slice(-6)}`;
    onSubmitReturn({
      returnNo,
      wholesalerId: buyer.id,
      wholesalerName: buyer.name,
      invoiceId: selectedReturnInvoice.id,
      chalanNo: selectedReturnInvoice.chalanNo,
      items: selectedItems,
      totalCreditAmount: totalCredit,
      reason: returnReason,
      notes: returnNotes.trim() || undefined,
      status: 'Requested',
      createdAt: new Date().toISOString(),
    });

    setReturnInvoiceId('');
    setReturnQtys({});
    setReturnNotes('');
    setReturnMsg(`Return request ${returnNo} submitted (${formatTkAmount(totalCredit)}). Pending Admin review.`);
  };

  const handleSubmitClaimForm = (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = Number(claimAmount);
    if (!numericAmount || numericAmount <= 0 || !claimTrxId.trim()) {
      setClaimBanner({
        type: 'error',
        text: 'Please enter a valid payment amount and Transaction / Slip Reference ID.',
      });
      return;
    }
    if (!onSubmitPaymentClaim) return;

    onSubmitPaymentClaim({
      wholesalerId: buyer.id,
      wholesalerName: buyer.name,
      amount: numericAmount,
      paymentMethod: claimMethod,
      trxId: claimTrxId.trim(),
      paymentDate: claimDate || getLocalYYYYMMDD(),
      slipImageUrl: claimSlipUrl || undefined,
      notes: claimNotes.trim() || undefined,
    });

    setClaimAmount('');
    setClaimTrxId('');
    setClaimSlipUrl('');
    setClaimNotes('');
    setClaimBanner({
      type: 'success',
      text: `Payment claim of ${formatTkAmount(numericAmount)} submitted for Admin verification. An official receipt will appear once approved.`,
    });
  };

  const handleExportStatementCSV = () => {
    const headers = ['Date', 'Type', 'Reference', 'Description', 'Debit', 'Credit', 'Balance'];
    const rows = filteredStatementEntries.map((e) => [
      formatDDMMYY(e.date),
      e.type,
      e.reference,
      `"${e.description.replace(/"/g, '""')}"`,
      e.debit,
      e.credit,
      e.runningBalance,
    ]);
    const csv =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const a = document.createElement('a');
    a.setAttribute('href', encodeURI(csv));
    a.setAttribute(
      'download',
      `${buyer.name.replace(/\s+/g, '_')}_Statement_${getLocalYYYYMMDD()}.csv`
    );
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profName.trim()) {
      setProfileMsg({ type: 'error', text: 'Customer / Contact name is required.' });
      return;
    }

    let passwordToSave: string | undefined;
    if (newPwd || confirmPwd || curPwd) {
      if (currentUser.authProvider !== 'google' && curPwd !== currentUser.passwordHash) {
        setProfileMsg({ type: 'error', text: 'Current password is incorrect.' });
        return;
      }
      if (newPwd.length < 4) {
        setProfileMsg({ type: 'error', text: 'New password must be at least 4 characters.' });
        return;
      }
      if (newPwd !== confirmPwd) {
        setProfileMsg({ type: 'error', text: 'New password and confirmation do not match.' });
        return;
      }
      passwordToSave = newPwd;
    }

    onUpdateProfile(
      {
        ...buyer,
        name: profName.trim(),
        shopName: profShop.trim() || undefined,
        phone: profPhone.trim(),
        email: profEmail.trim() || undefined,
        address: profAddress.trim(),
      },
      passwordToSave
    );

    setCurPwd('');
    setNewPwd('');
    setConfirmPwd('');
    setProfileMsg({
      type: 'success',
      text: passwordToSave
        ? 'Profile and portal password updated successfully!'
        : 'Profile details updated successfully!',
    });
  };

  const navItems: Array<{
    id: CustomerTab;
    label: string;
    icon: React.ReactNode;
    badge?: number;
  }> = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    {
      id: 'catalog',
      label: 'Approved Prices & Order',
      icon: <ShoppingBag className="w-4 h-4" />,
      badge: cart.length || undefined,
    },
    {
      id: 'orders',
      label: 'My Orders & Courier',
      icon: <Truck className="w-4 h-4" />,
      badge: activeOrdersCount || undefined,
    },
    {
      id: 'invoices',
      label: 'Invoices & PDF',
      icon: <FileText className="w-4 h-4" />,
      badge: myInvoices.length || undefined,
    },
    { id: 'history', label: 'Purchase History', icon: <History className="w-4 h-4" /> },
    {
      id: 'returns',
      label: 'Returns',
      icon: <RotateCcw className="w-4 h-4" />,
      badge: myReturns.filter((r) => r.status === 'Requested').length || undefined,
    },
    { id: 'payments', label: 'Payments & Receipts', icon: <Receipt className="w-4 h-4" /> },
    { id: 'statement', label: 'Account Statement', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'profile', label: 'My Profile', icon: <UserCheck className="w-4 h-4" /> },
  ];

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-slate-50 font-sans antialiased">
      {/* Mobile Sidebar Backdrop */}
      {isMobileNavOpen && (
        <div
          className="fixed inset-0 bg-slate-950/60 z-30 lg:hidden"
          onClick={() => setIsMobileNavOpen(false)}
        />
      )}

      {/* Customer Portal Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 w-64 bg-slate-950 text-slate-200 flex flex-col z-40 transform transition-transform duration-200 lg:translate-x-0 ${
          isMobileNavOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <CompanyLogo
              className="w-10 h-10"
              shortName={settings.brandShortName}
              logoUrl={settings.logoUrl}
            />
            <div className="min-w-0">
              <div className="font-extrabold text-white text-sm truncate">
                {settings.brandName || 'Buyer Portal'}
              </div>
              <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                Customer Portal
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsMobileNavOpen(false)}
            aria-label="Close Portal Menu"
            className="p-1.5 text-slate-400 hover:text-white lg:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Buyer Account Card */}
        <div className="m-3 p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
          <div className="font-extrabold text-white text-xs truncate">
            {buyer.shopName || buyer.name}
          </div>
          <div className="text-[11px] text-slate-400 truncate">
            ID: {currentUser.userId} • {buyer.phone || 'No Phone'}
          </div>
          <div className="pt-1.5 mt-1.5 border-t border-slate-800 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Balance Due:</span>
            <span
              className={`font-mono font-black ${
                buyer.totalDue > 0 ? 'text-rose-400' : 'text-emerald-400'
              }`}
            >
              {formatTkAmount(buyer.totalDue)}
            </span>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          {navItems.map((nav) => {
            const isActive = activeTab === nav.id;
            return (
              <button
                key={nav.id}
                type="button"
                onClick={() => {
                  setActiveTab(nav.id);
                  setIsMobileNavOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 font-extrabold shadow-md'
                    : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  {nav.icon}
                  <span>{nav.label}</span>
                </span>
                {nav.badge !== undefined && (
                  <span
                    className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${
                      isActive
                        ? 'bg-slate-950/20 text-slate-950'
                        : 'bg-emerald-500/20 text-emerald-300'
                    }`}
                  >
                    {nav.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-slate-900 hover:bg-rose-950/60 text-slate-300 hover:text-rose-300 border border-slate-800 text-xs font-bold transition cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Header */}
        <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between gap-3 shrink-0 no-print">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsMobileNavOpen(true)}
              aria-label="Open Portal Menu"
              className="p-2 rounded-xl border border-slate-200 text-slate-700 lg:hidden"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h1 className="font-black text-slate-900 text-sm sm:text-base">
                {navItems.find((n) => n.id === activeTab)?.label}
              </h1>
              <p className="text-[11px] text-slate-500">
                Welcome back, {buyer.name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden sm:flex items-center bg-slate-100 rounded-xl px-3 py-1.5 border border-slate-200">
              <Search className="w-3.5 h-3.5 text-slate-400 mr-2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products, invoice, tracking..."
                className="bg-transparent text-xs text-slate-800 focus:outline-none w-52"
              />
            </div>

            <button
              type="button"
              onClick={() => setActiveTab('catalog')}
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Place Order{cart.length ? ` (${cart.length})` : ''}</span>
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {orderBanner && (
            <div
              className={`p-3.5 rounded-xl border text-xs font-bold flex items-center justify-between gap-2 ${
                orderBanner.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : orderBanner.type === 'error'
                  ? 'bg-rose-50 border-rose-200 text-rose-800'
                  : 'bg-cyan-50 border-cyan-200 text-cyan-900'
              }`}
            >
              <span>{orderBanner.text}</span>
              <button
                type="button"
                onClick={() => setOrderBanner(null)}
                className="text-slate-500 hover:text-slate-800 font-black"
              >
                ✕
              </button>
            </div>
          )}

          {/* TAB 1: DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6 max-w-[1400px] mx-auto">
              {/* KPI Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                  <div className="text-[11px] font-bold uppercase text-slate-500">
                    Outstanding Balance
                  </div>
                  <div
                    className={`text-2xl font-black font-mono mt-2 ${
                      buyer.totalDue > 0 ? 'text-rose-600' : 'text-emerald-600'
                    }`}
                  >
                    {formatTkAmount(buyer.totalDue)}
                  </div>
                  {buyer.creditLimit ? (
                    <div className="text-[11px] text-slate-400 mt-1">
                      Credit Limit: {formatTkAmount(buyer.creditLimit)}
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-400 mt-1">
                      Live payable ledger due
                    </div>
                  )}
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                  <div className="text-[11px] font-bold uppercase text-slate-500">
                    Advances & Payments
                  </div>
                  <div className="text-2xl font-black font-mono text-emerald-700 mt-2">
                    {formatTkAmount(totalAdvancesAndPayments)}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    {myPaymentTxns.length} payment receipts recorded
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                  <div className="text-[11px] font-bold uppercase text-slate-500">
                    Active Orders
                  </div>
                  <div className="text-2xl font-black font-mono text-cyan-700 mt-2">
                    {activeOrdersCount}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    {myOrders.length} total portal orders
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                  <div className="text-[11px] font-bold uppercase text-slate-500">
                    Dispatched Invoices
                  </div>
                  <div className="text-2xl font-black font-mono text-slate-900 mt-2">
                    {myInvoices.length}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    {courierShipments.length} courier tracking records
                  </div>
                </div>
              </div>

              {/* Quick Actions Banner */}
              <div className="bg-slate-900 text-white p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h2 className="font-extrabold text-base flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    <span>Quick Wholesale Ordering & Statements</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Order using your approved flat rates, repeat a past chalan in one click, or download your PDF statement.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('catalog')}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-extrabold rounded-xl text-xs cursor-pointer"
                  >
                    + New Order
                  </button>
                  {myInvoices.length > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        handleRepeatItems(
                          myInvoices[0].items,
                          `Invoice #${myInvoices[0].chalanNo}`
                        )
                      }
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 font-bold rounded-xl text-xs cursor-pointer flex items-center gap-1.5"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Repeat Last Invoice
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setActiveTab('statement')}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 font-bold rounded-xl text-xs cursor-pointer"
                  >
                    Account Statement
                  </button>
                </div>
              </div>

              {/* Recent Invoices & Courier Shipments */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                  <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="font-extrabold text-slate-800 text-sm">
                      Recent Invoices
                    </h3>
                    <button
                      type="button"
                      onClick={() => setActiveTab('invoices')}
                      className="text-xs font-bold text-emerald-600 hover:underline cursor-pointer"
                    >
                      View All
                    </button>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {myInvoices.slice(0, 5).map((inv) => (
                      <div
                        key={inv.id}
                        className="p-4 flex items-center justify-between gap-3 hover:bg-slate-50"
                      >
                        <div>
                          <div className="font-mono font-black text-slate-900 text-xs">
                            Invoice #{inv.chalanNo}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {formatDDMMYY(inv.deliveryDate || inv.date)} •{' '}
                            {inv.items.length} items
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono font-bold text-slate-900 text-xs">
                            {formatTkAmount(inv.subTotal || inv.totalAmount)}
                          </div>
                          <button
                            type="button"
                            onClick={() => setPreviewInvoice(inv)}
                            className="text-[11px] font-bold text-emerald-600 hover:underline cursor-pointer"
                          >
                            PDF / Print
                          </button>
                        </div>
                      </div>
                    ))}
                    {myInvoices.length === 0 && (
                      <div className="p-8 text-center text-xs text-slate-400">
                        No invoices dispatched yet.
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                  <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="font-extrabold text-slate-800 text-sm">
                      Latest Courier Dispatch Status
                    </h3>
                    <button
                      type="button"
                      onClick={() => setActiveTab('orders')}
                      className="text-xs font-bold text-emerald-600 hover:underline cursor-pointer"
                    >
                      Track Orders
                    </button>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {courierShipments.slice(0, 5).map((inv) => (
                      <div
                        key={inv.id}
                        className="p-4 flex items-start justify-between gap-3 hover:bg-slate-50"
                      >
                        <div className="flex items-start gap-2.5">
                          <Truck className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                          <div>
                            <div className="font-bold text-slate-900 text-xs">
                              {inv.courierName || 'Courier Service'}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              Invoice #{inv.chalanNo} •{' '}
                              {formatDDMMYY(inv.deliveryDate || inv.date)}
                            </div>
                            {inv.courierTrackingNo && (
                              <div className="mt-1 inline-block px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded font-mono text-[10px] font-bold">
                                Tracking: {inv.courierTrackingNo}
                              </div>
                            )}
                          </div>
                        </div>
                        <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-lg">
                          {inv.totalCartons || '1 Carton'}
                        </span>
                      </div>
                    ))}
                    {courierShipments.length === 0 && (
                      <div className="p-8 text-center text-xs text-slate-400">
                        No courier dispatches recorded yet.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: APPROVED PRICES & PLACE ORDER */}
          {activeTab === 'catalog' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start max-w-[1500px] mx-auto">
              {/* Product Catalog (8 cols) */}
              <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="font-extrabold text-slate-800 text-sm">
                      Buyer-Approved Product Catalog
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Prices reflect your approved wholesale rates. Custom-approved rates are highlighted.
                    </p>
                  </div>
                  <span className="text-xs font-bold text-slate-600">
                    {filteredCatalog.length} Products
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-700 uppercase text-[10px] border-b border-slate-200">
                      <tr>
                        <th className="p-3 font-bold">Product</th>
                        <th className="p-3 font-bold text-center">Size</th>
                        <th className="p-3 font-bold text-right">M.R.P</th>
                        <th className="p-3 font-bold text-right">
                          Approved Rate
                        </th>
                        <th className="p-3 font-bold text-center">Stock</th>
                        <th className="p-3 font-bold text-center w-24">Qty</th>
                        <th className="p-3 font-bold text-center w-24">Add</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredCatalog.map((item) => {
                        const previewQty = Math.max(1, Number(qtyInputs[item.id] || 1));
                        const resolved = resolveWholesaleUnitPrice(item, buyer, previewQty);
                        const outOfStock = item.quantity <= 0;
                        return (
                          <tr key={item.id} className="hover:bg-slate-50">
                            <td className="p-3">
                              <div className="flex items-center gap-2.5">
                                {item.imageUrl ? (
                                  <img
                                    src={item.imageUrl}
                                    alt={item.name}
                                    className="w-10 h-10 rounded-xl object-cover border border-slate-200 shrink-0 bg-white"
                                  />
                                ) : (
                                  <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                                    <Package className="w-4 h-4" />
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <div className="font-bold text-slate-900">
                                    {item.name}
                                  </div>
                                  <div className="text-[10px] text-slate-400">
                                    {item.category} • {item.sku}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="p-3 text-center text-slate-600 whitespace-nowrap">
                              {item.packSize || item.unit}
                            </td>
                            <td className="p-3 text-right font-mono text-slate-500 whitespace-nowrap">
                              {formatTkAmount(item.retailPrice || item.price)}
                            </td>
                            <td className="p-3 text-right whitespace-nowrap">
                              <div className="font-mono font-black text-emerald-700">
                                {formatTkAmount(resolved.unitPrice)}
                              </div>
                              {resolved.pricingSource === 'approved' && (
                                <span className="inline-block text-[9px] font-extrabold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">
                                  Custom Approved
                                </span>
                              )}
                              {resolved.pricingSource === 'tier' && (
                                <span className="inline-block text-[9px] font-extrabold bg-cyan-100 text-cyan-800 px-1.5 py-0.5 rounded">
                                  Slab {resolved.appliedTierMinQty}+
                                </span>
                              )}
                              {item.priceTiers && item.priceTiers.length > 0 && resolved.pricingSource !== 'approved' && (
                                <div className="text-[9px] text-slate-500 mt-0.5">
                                  {item.priceTiers
                                    .slice()
                                    .sort((a, b) => a.minQty - b.minQty)
                                    .map((t) => `${t.minQty}+: ৳${t.unitPrice}`)
                                    .join(' | ')}
                                </div>
                              )}
                            </td>
                            <td className="p-3 text-center whitespace-nowrap">
                              {outOfStock ? (
                                <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-700 text-[10px] font-bold">
                                  Out of Stock
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                                  {item.quantity} avail.
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              <input
                                type="number"
                                min="1"
                                max={item.quantity}
                                disabled={outOfStock}
                                value={qtyInputs[item.id] || ''}
                                onChange={(e) =>
                                  setQtyInputs((prev) => ({
                                    ...prev,
                                    [item.id]: e.target.value,
                                  }))
                                }
                                placeholder="1"
                                className="w-16 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono text-center"
                              />
                            </td>
                            <td className="p-3 text-center">
                              <button
                                type="button"
                                disabled={outOfStock}
                                onClick={() => handleAddToCart(item)}
                                className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold rounded-lg text-[11px] cursor-pointer"
                              >
                                + Add
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {filteredCatalog.length === 0 && (
                        <tr>
                          <td
                            colSpan={7}
                            className="p-8 text-center text-slate-400"
                          >
                            No products available matching your search.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Order Cart (4 cols) */}
              <form
                onSubmit={handleSubmitOrder}
                className="lg:col-span-4 bg-slate-900 text-white rounded-2xl p-5 border border-slate-800 space-y-4 shadow-xl"
              >
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2 font-black text-emerald-400 text-sm">
                    <Package className="w-4 h-4" />
                    <span>Your Order Cart ({cart.length})</span>
                  </div>
                  {cart.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setCart([])}
                      className="text-[11px] text-rose-400 hover:underline cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {cart.map((c) => (
                    <div
                      key={c.itemId}
                      className="p-2.5 bg-slate-800/80 rounded-xl border border-slate-700 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-white truncate">
                          {c.itemName}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5 mt-1">
                          <input
                            type="number"
                            min="1"
                            value={c.quantity}
                            onChange={(e) =>
                              handleUpdateCartItemQty(
                                c.itemId,
                                Number(e.target.value) || 1
                              )
                            }
                            aria-label={`Quantity for ${c.itemName}`}
                            className="w-14 bg-slate-900 border border-slate-600 rounded px-1.5 py-0.5 text-center text-white font-mono text-[10px]"
                          />
                          <span>× {c.unitPrice}/= =</span>
                          <span className="text-emerald-300 font-bold">
                            {formatTkAmount(c.total)}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setCart(cart.filter((x) => x.itemId !== c.itemId))
                        }
                        aria-label={`Remove ${c.itemName}`}
                        className="p-1 text-rose-400 hover:text-rose-300 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  {cart.length === 0 && (
                    <div className="py-6 text-center text-xs text-slate-400">
                      Cart is empty. Add products from the catalog or use Repeat Order on a past invoice.
                    </div>
                  )}
                </div>

                {/* Credit Limit Status & Enforcement Indicator */}
                {creditCheck.hasLimit && (
                  <div
                    className={`p-3 rounded-xl border text-[11px] space-y-1.5 ${
                      creditCheck.exceeds
                        ? 'bg-rose-950/70 border-rose-500/60 text-rose-200'
                        : 'bg-slate-800/70 border-slate-700 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span className="flex items-center gap-1">
                        <CreditCard className="w-3.5 h-3.5 text-cyan-400" />
                        Credit Limit Status
                      </span>
                      <span className="font-mono">
                        {formatTkAmount(creditCheck.projectedDue)} /{' '}
                        {formatTkAmount(creditCheck.creditLimit)}
                      </span>
                    </div>
                    <div className="h-1.5 bg-slate-950 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          creditCheck.exceeds ? 'bg-rose-500' : 'bg-emerald-500'
                        }`}
                        style={{
                          width: `${Math.min(
                            100,
                            Math.round(
                              (creditCheck.projectedDue / creditCheck.creditLimit) *
                                100
                            )
                          )}%`,
                        }}
                      />
                    </div>
                    {creditCheck.exceeds && (
                      <div className="flex items-start gap-1.5 text-[10px] font-bold text-rose-300">
                        <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>
                          {enforceCreditLimit
                            ? `Credit limit exceeded by ${formatTkAmount(
                                creditCheck.excessAmount
                              )}. Add at least ${formatTkAmount(
                                creditCheck.excessAmount
                              )} in Advance Paid to submit.`
                            : `Warning: Exceeds approved credit limit by ${formatTkAmount(
                                creditCheck.excessAmount
                              )}.`}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                <div className="pt-3 border-t border-slate-800 space-y-3 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-bold">Order Total:</span>
                    <span className="font-mono font-black text-base text-cyan-300">
                      {formatTkAmount(cartTotal)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                        Advance Paid (Optional)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={advanceSubmitted}
                        onChange={(e) => setAdvanceSubmitted(e.target.value)}
                        placeholder="0"
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                        Method
                      </label>
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="Bank Transfer">Bank Transfer</option>
                        <option value="bKash">bKash</option>
                        <option value="Nagad">Nagad</option>
                        <option value="Cash">Cash</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                      Payment / Transaction Ref
                    </label>
                    <input
                      type="text"
                      value={paymentRef}
                      onChange={(e) => setPaymentRef(e.target.value)}
                      placeholder="e.g. BRAC-REF-2210"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                      Delivery / Courier Instructions
                    </label>
                    <textarea
                      rows={2}
                      value={orderNotes}
                      onChange={(e) => setOrderNotes(e.target.value)}
                      placeholder="Preferred courier or delivery note..."
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isBlockedByCreditLimit || cart.length === 0}
                  className="w-full py-3 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>
                    {isBlockedByCreditLimit
                      ? 'Blocked by Credit Limit'
                      : 'Submit Wholesale Order'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </div>
          )}

          {/* TAB 3: MY ORDERS & COURIER STATUS */}
          {activeTab === 'orders' && (
            <div className="space-y-4 max-w-[1300px] mx-auto">
              {myOrders.map((ord) => {
                const steps = [
                  'Pending Approval',
                  'Approved',
                  'Packed',
                  'Dispatched',
                  'Delivered',
                ];
                const curIdx = steps.indexOf(ord.status);
                const linkedInv = ord.linkedInvoiceId
                  ? myInvoices.find((i) => i.id === ord.linkedInvoiceId)
                  : undefined;

                return (
                  <div
                    key={ord.id}
                    className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-slate-900 text-sm">
                            {ord.orderNo}
                          </span>
                          <span
                            className={`px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold ${
                              ord.status === 'Delivered' ||
                              ord.status === 'Dispatched'
                                ? 'bg-emerald-100 text-emerald-800'
                                : ord.status === 'Cancelled'
                                ? 'bg-rose-100 text-rose-700'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {ord.status}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Placed on {formatDDMMYY(ord.createdAt)} •{' '}
                          {ord.items.length} products
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-black text-slate-900 text-sm mr-2">
                          {formatTkAmount(ord.totalAmount)}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            handleRepeatItems(ord.items, `Order ${ord.orderNo}`)
                          }
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs flex items-center gap-1 cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" /> Repeat Order
                        </button>
                        {linkedInv && (
                          <button
                            type="button"
                            onClick={() => setPreviewInvoice(linkedInv)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-1 cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5" /> Invoice #
                            {linkedInv.chalanNo}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Progress Steps */}
                    {ord.status !== 'Cancelled' && (
                      <div className="grid grid-cols-5 gap-2 text-[10px] font-bold">
                        {steps.map((s, i) => (
                          <div
                            key={s}
                            className={`p-2 rounded-lg text-center border ${
                              i <= curIdx
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                                : 'bg-slate-50 border-slate-200 text-slate-400'
                            }`}
                          >
                            {s}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Courier Tracking Details & Delivery Confirmation */}
                    {(ord.courierName ||
                      ord.courierTrackingNo ||
                      linkedInv?.courierTrackingNo ||
                      ord.status === 'Dispatched' ||
                      ord.deliveredAt) && (() => {
                      const cName = ord.courierName || linkedInv?.courierName;
                      const tNo = ord.courierTrackingNo || linkedInv?.courierTrackingNo;
                      const trackUrl = getCourierTrackingUrl(cName, tNo);
                      return (
                        <div className="p-3 rounded-xl bg-cyan-50 border border-cyan-200 text-xs flex flex-wrap items-center justify-between gap-3 text-cyan-950">
                          <div className="flex flex-wrap items-center gap-4">
                            <span className="font-extrabold flex items-center gap-1.5">
                              <Truck className="w-4 h-4 text-cyan-700" /> Courier:
                              <span>{cName || 'Assigned Courier'}</span>
                            </span>
                            {tNo && (
                              <span className="font-mono font-bold">
                                Tracking No: {tNo}
                              </span>
                            )}
                            {trackUrl && (
                              <a
                                href={trackUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-cyan-100 text-cyan-800 border border-cyan-300 rounded-lg font-extrabold text-[11px]"
                              >
                                <ExternalLink className="w-3 h-3" /> Track Parcel
                              </a>
                            )}
                            {(ord.totalCartons || linkedInv?.totalCartons) && (
                              <span>
                                Cartons: {ord.totalCartons || linkedInv?.totalCartons}
                              </span>
                            )}
                            {ord.deliveredAt && (
                              <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Confirmed on{' '}
                                {formatDDMMYY(ord.deliveredAt)}
                              </span>
                            )}
                          </div>

                          {ord.status === 'Dispatched' && onConfirmDelivery && (
                            <button
                              type="button"
                              onClick={() => onConfirmDelivery(ord.id)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-[11px] flex items-center gap-1.5 shadow-xs cursor-pointer"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" /> Confirm Delivery Received
                            </button>
                          )}
                        </div>
                      );
                    })()}

                    <div className="text-xs text-slate-600 flex flex-wrap gap-2">
                      {ord.items.map((it, idx) => (
                        <span
                          key={idx}
                          className="px-2.5 py-1 bg-slate-100 rounded-lg font-medium"
                        >
                          {it.itemName} × {it.quantity} ({formatTkAmount(it.total)})
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}

              {myOrders.length === 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-400 text-xs">
                  You have not placed any portal orders yet. Visit &ldquo;Approved Prices &amp; Order&rdquo; to place one.
                </div>
              )}
            </div>
          )}

          {/* TAB 4: OWN INVOICES & PDF DOWNLOAD */}
          {activeTab === 'invoices' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden max-w-[1400px] mx-auto">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <h3 className="font-extrabold text-slate-800 text-sm">
                  My Invoices &amp; Courier Chalans ({myInvoices.length})
                </h3>
                <span className="text-xs text-slate-500">
                  Click &ldquo;PDF / Print&rdquo; to download or print your invoice
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600 uppercase text-[10px] border-b border-slate-200">
                    <tr>
                      <th className="p-3.5 font-bold">Invoice No</th>
                      <th className="p-3.5 font-bold">Delivery Date</th>
                      <th className="p-3.5 font-bold">Courier &amp; Tracking</th>
                      <th className="p-3.5 font-bold text-right">Amount</th>
                      <th className="p-3.5 font-bold text-right">Previous Due</th>
                      <th className="p-3.5 font-bold text-right">Total Amount</th>
                      <th className="p-3.5 font-bold text-right">Advance Paid</th>
                      <th className="p-3.5 font-bold text-right">Total Due</th>
                      <th className="p-3.5 font-bold text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {myInvoices.map((inv) => {
                      const bill =
                        inv.subTotal ??
                        inv.items.reduce((s, it) => s + it.total, 0);
                      return (
                        <tr key={inv.id} className="hover:bg-slate-50">
                          <td className="p-3.5 font-mono font-black text-slate-900">
                            {inv.chalanNo}
                          </td>
                          <td className="p-3.5 font-mono text-slate-600">
                            {formatDDMMYY(inv.deliveryDate || inv.date)}
                          </td>
                          <td className="p-3.5 text-slate-700">
                            <div className="font-bold">
                              {inv.courierName || 'Standard'}
                            </div>
                            {inv.courierTrackingNo && (() => {
                              const trackUrl = getCourierTrackingUrl(
                                inv.courierName,
                                inv.courierTrackingNo
                              );
                              return (
                                <div className="text-[10px] font-mono text-emerald-700 font-bold flex items-center gap-1.5">
                                  <span>Tracking: {inv.courierTrackingNo}</span>
                                  {trackUrl && (
                                    <a
                                      href={trackUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-0.5 text-cyan-700 hover:underline font-sans"
                                    >
                                      <ExternalLink className="w-2.5 h-2.5" /> Track
                                    </a>
                                  )}
                                </div>
                              );
                            })()}
                          </td>
                          <td className="p-3.5 text-right font-mono font-bold whitespace-nowrap">
                            {formatTkAmount(bill)}
                          </td>
                          <td className="p-3.5 text-right font-mono text-amber-700 whitespace-nowrap">
                            {formatTkAmount(inv.previousDue || 0)}
                          </td>
                          <td className="p-3.5 text-right font-mono font-bold text-cyan-700 whitespace-nowrap">
                            {formatTkAmount(inv.grandTotal || inv.totalAmount)}
                          </td>
                          <td className="p-3.5 text-right font-mono font-bold text-emerald-700 whitespace-nowrap">
                            {formatTkAmount(inv.paidAmount)}
                          </td>
                          <td className="p-3.5 text-right font-mono font-black text-rose-700 whitespace-nowrap">
                            {formatTkAmount(inv.dueAmount)}
                          </td>
                          <td className="p-3.5 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setPreviewInvoice(inv)}
                                className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-[11px] inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                              >
                                <Printer className="w-3.5 h-3.5 shrink-0" /> PDF / Print
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleRepeatItems(
                                    inv.items,
                                    `Invoice #${inv.chalanNo}`
                                  )
                                }
                                className="px-2.5 py-1.5 bg-cyan-50 hover:bg-cyan-100 text-cyan-800 font-bold rounded-lg text-[11px] inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                              >
                                <RotateCcw className="w-3.5 h-3.5 shrink-0" /> Repeat
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {myInvoices.length === 0 && (
                      <tr>
                        <td
                          colSpan={9}
                          className="p-10 text-center text-slate-400"
                        >
                          No invoices found for your account yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: PURCHASE HISTORY */}
          {activeTab === 'history' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden max-w-[1400px] mx-auto">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <h3 className="font-extrabold text-slate-800 text-sm">
                  Item-Wise Purchase History ({purchaseHistoryRows.length} entries)
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600 uppercase text-[10px] border-b border-slate-200">
                    <tr>
                      <th className="p-3 font-bold">Date</th>
                      <th className="p-3 font-bold">Invoice No</th>
                      <th className="p-3 font-bold">Product Name</th>
                      <th className="p-3 font-bold text-center">Size</th>
                      <th className="p-3 font-bold text-center">Batch</th>
                      <th className="p-3 font-bold text-right">Flat Rate</th>
                      <th className="p-3 font-bold text-center">Qty</th>
                      <th className="p-3 font-bold text-right">Amount Tk</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {purchaseHistoryRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-3 font-mono text-slate-500">
                          {formatDDMMYY(row.date)}
                        </td>
                        <td className="p-3 font-mono font-bold text-slate-900">
                          {row.chalanNo}
                        </td>
                        <td className="p-3 font-bold text-slate-900">
                          {row.itemName}
                        </td>
                        <td className="p-3 text-center text-slate-600">
                          {row.packSize}
                        </td>
                        <td className="p-3 text-center font-mono text-slate-600">
                          {row.batchNo}
                        </td>
                        <td className="p-3 text-right font-mono">
                          {formatTkAmount(row.unitPrice)}
                        </td>
                        <td className="p-3 text-center font-mono font-black">
                          {row.quantity}
                        </td>
                        <td className="p-3 text-right font-mono font-black text-emerald-700">
                          {formatTkAmount(row.total)}
                        </td>
                      </tr>
                    ))}
                    {purchaseHistoryRows.length === 0 && (
                      <tr>
                        <td
                          colSpan={8}
                          className="p-10 text-center text-slate-400"
                        >
                          No purchase history recorded yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 6: RETURNS */}
          {activeTab === 'returns' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-[1400px] mx-auto">
              <form
                onSubmit={handleSubmitReturn}
                className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4"
              >
                <h3 className="font-extrabold text-slate-900 text-sm border-b border-slate-100 pb-3">
                  Request Product Return / Credit Note
                </h3>

                {returnMsg && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold">
                    {returnMsg}
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Select Invoice *
                  </label>
                  <select
                    required
                    value={returnInvoiceId}
                    onChange={(e) => {
                      setReturnInvoiceId(e.target.value);
                      setReturnQtys({});
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold"
                  >
                    <option value="">-- Choose Delivered Invoice --</option>
                    {myInvoices.map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        Invoice #{inv.chalanNo} ({formatDDMMYY(inv.date)})
                      </option>
                    ))}
                  </select>
                </div>

                {selectedReturnInvoice && (
                  <div className="space-y-2 border border-slate-200 rounded-xl p-3 bg-slate-50">
                    <div className="text-[11px] font-bold text-slate-700">
                      Select Return Quantities:
                    </div>
                    {selectedReturnInvoice.items.map((it) => (
                      <div
                        key={it.itemId}
                        className="flex items-center justify-between gap-2 text-xs bg-white p-2 rounded-lg border border-slate-200"
                      >
                        <div>
                          <div className="font-bold text-slate-900">
                            {it.itemName}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            Purchased: {it.quantity} @ {it.unitPrice}/=
                          </div>
                        </div>
                        <input
                          type="number"
                          min="0"
                          max={it.quantity}
                          value={returnQtys[it.itemId] || ''}
                          onChange={(e) =>
                            setReturnQtys((prev) => ({
                              ...prev,
                              [it.itemId]: e.target.value,
                            }))
                          }
                          placeholder="0"
                          className="w-20 border border-slate-200 rounded-lg px-2 py-1 text-center font-mono"
                        />
                      </div>
                    ))}
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Return Reason
                  </label>
                  <select
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold"
                  >
                    <option value="Damaged in Transit">Damaged in Transit</option>
                    <option value="Near Expiry / Expired">Near Expiry / Expired</option>
                    <option value="Wrong Product Delivered">Wrong Product Delivered</option>
                    <option value="Excess Stock Return">Excess Stock Return</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Notes / Details
                  </label>
                  <textarea
                    rows={2}
                    value={returnNotes}
                    onChange={(e) => setReturnNotes(e.target.value)}
                    placeholder="Describe batch or package issue..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-extrabold rounded-xl text-xs cursor-pointer"
                >
                  Submit Return Request
                </button>
              </form>

              <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-200">
                  <h3 className="font-extrabold text-slate-800 text-sm">
                    My Return History ({myReturns.length})
                  </h3>
                </div>
                <div className="divide-y divide-slate-100">
                  {myReturns.map((ret) => (
                    <div key={ret.id} className="p-4 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-black text-slate-900">
                          {ret.returnNo}{' '}
                          {ret.chalanNo ? `(Invoice #${ret.chalanNo})` : ''}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold ${
                            ret.status === 'Credited' ||
                            ret.status === 'Approved'
                              ? 'bg-emerald-100 text-emerald-800'
                              : ret.status === 'Rejected'
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {ret.status}
                        </span>
                      </div>
                      <div className="text-slate-600">
                        Reason: <strong>{ret.reason}</strong> • Credit:{' '}
                        <strong className="font-mono text-emerald-700">
                          {formatTkAmount(ret.totalCreditAmount)}
                        </strong>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {ret.items.map((ri, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 bg-slate-100 rounded text-[11px]"
                          >
                            {ri.itemName} × {ri.quantity}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                  {myReturns.length === 0 && (
                    <div className="p-10 text-center text-xs text-slate-400">
                      No return requests submitted yet.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: PAYMENTS & RECEIPTS */}
          {activeTab === 'payments' && (
            <div className="space-y-6 max-w-[1300px] mx-auto">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                  <div className="text-[11px] font-bold uppercase text-slate-500">
                    Total Advances &amp; Payments
                  </div>
                  <div className="text-2xl font-black font-mono text-emerald-700 mt-1">
                    {formatTkAmount(totalAdvancesAndPayments)}
                  </div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                  <div className="text-[11px] font-bold uppercase text-slate-500">
                    Total Return Credits
                  </div>
                  <div className="text-2xl font-black font-mono text-cyan-700 mt-1">
                    {formatTkAmount(
                      myReturns
                        .filter(
                          (r) =>
                            r.status === 'Approved' || r.status === 'Credited'
                        )
                        .reduce((s, r) => s + r.totalCreditAmount, 0)
                    )}
                  </div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                  <div className="text-[11px] font-bold uppercase text-slate-500">
                    Current Outstanding Balance
                  </div>
                  <div
                    className={`text-2xl font-black font-mono mt-1 ${
                      buyer.totalDue > 0 ? 'text-rose-600' : 'text-emerald-600'
                    }`}
                  >
                    {formatTkAmount(buyer.totalDue)}
                  </div>
                </div>
              </div>

              {/* Payment Claim Submission + Submitted Claims */}
              {onSubmitPaymentClaim && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  <form
                    onSubmit={handleSubmitClaimForm}
                    className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4"
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div>
                        <h3 className="font-extrabold text-slate-900 text-sm">
                          Submit Due Payment / Bank Slip
                        </h3>
                        <p className="text-[11px] text-slate-500">
                          Upload bKash/Nagad TrxID or Bank deposit slip for Admin verification
                        </p>
                      </div>
                    </div>

                    {claimBanner && (
                      <div
                        className={`p-3 rounded-xl border text-xs font-bold ${
                          claimBanner.type === 'success'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                            : 'bg-rose-50 border-rose-200 text-rose-800'
                        }`}
                      >
                        {claimBanner.text}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                          Paid Amount (৳) *
                        </label>
                        <input
                          type="number"
                          min="1"
                          required
                          value={claimAmount}
                          onChange={(e) => setClaimAmount(e.target.value)}
                          placeholder="e.g. 25000"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono font-bold text-slate-900"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                          Payment Method *
                        </label>
                        <select
                          value={claimMethod}
                          onChange={(e) => setClaimMethod(e.target.value as any)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-900"
                        >
                          <option value="bKash">bKash</option>
                          <option value="Nagad">Nagad</option>
                          <option value="Bank Transfer">Bank Transfer</option>
                          <option value="Cash">Cash</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                          TrxID / Slip Ref *
                        </label>
                        <input
                          type="text"
                          required
                          value={claimTrxId}
                          onChange={(e) => setClaimTrxId(e.target.value)}
                          placeholder="e.g. TRX99812"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono text-slate-900"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                          Payment Date
                        </label>
                        <input
                          type="date"
                          value={claimDate}
                          onChange={(e) => setClaimDate(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono text-slate-900"
                        />
                      </div>
                    </div>

                    <div className="text-xs">
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                        Upload Deposit Slip / Screenshot (Optional)
                      </label>
                      <div className="flex items-center gap-3">
                        <label className="cursor-pointer px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-[11px] inline-flex items-center gap-1.5 border border-slate-200">
                          <Upload className="w-3.5 h-3.5" />
                          <span>{claimSlipUrl ? 'Change Slip Image' : 'Upload Slip'}</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onload = (ev) => {
                                  if (ev.target?.result) {
                                    setClaimSlipUrl(ev.target.result as string);
                                  }
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                          />
                        </label>
                        {claimSlipUrl && (
                          <div className="flex items-center gap-2">
                            <img
                              src={claimSlipUrl}
                              alt="Slip preview"
                              className="w-10 h-10 rounded-lg object-cover border border-slate-200"
                            />
                            <button
                              type="button"
                              onClick={() => setClaimSlipUrl('')}
                              className="text-[11px] font-bold text-rose-600 hover:underline cursor-pointer"
                            >
                              Remove
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="text-xs">
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                        Notes (Optional)
                      </label>
                      <input
                        type="text"
                        value={claimNotes}
                        onChange={(e) => setClaimNotes(e.target.value)}
                        placeholder="Bank branch or invoice ref..."
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs cursor-pointer"
                    >
                      Submit Payment Claim for Verification
                    </button>
                  </form>

                  <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                    <div className="p-4 bg-slate-50 border-b border-slate-200">
                      <h3 className="font-extrabold text-slate-800 text-sm">
                        My Submitted Payment Claims ({myPaymentClaims.length})
                      </h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100 text-slate-600 uppercase text-[10px] border-b border-slate-200">
                          <tr>
                            <th className="p-3 font-bold">Claim No</th>
                            <th className="p-3 font-bold">Date</th>
                            <th className="p-3 font-bold">Method &amp; TrxID</th>
                            <th className="p-3 font-bold text-right">Amount</th>
                            <th className="p-3 font-bold text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {myPaymentClaims.map((clm) => (
                            <tr key={clm.id} className="hover:bg-slate-50">
                              <td className="p-3 font-mono font-bold text-slate-900">
                                {clm.claimNo}
                                {clm.receiptNo && (
                                  <div className="text-[10px] text-emerald-700">
                                    Receipt: {clm.receiptNo}
                                  </div>
                                )}
                              </td>
                              <td className="p-3 font-mono text-slate-500">
                                {formatDDMMYY(clm.paymentDate)}
                              </td>
                              <td className="p-3">
                                <span className="font-bold text-slate-800">
                                  {clm.paymentMethod}
                                </span>
                                <div className="font-mono text-[10px] text-slate-500">
                                  Trx: {clm.trxId}
                                </div>
                              </td>
                              <td className="p-3 text-right font-mono font-black text-emerald-700">
                                {formatTkAmount(clm.amount)}
                              </td>
                              <td className="p-3 text-center">
                                <span
                                  className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold ${
                                    clm.status === 'Approved'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : clm.status === 'Rejected'
                                      ? 'bg-rose-100 text-rose-700'
                                      : 'bg-amber-100 text-amber-800'
                                  }`}
                                >
                                  {clm.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                          {myPaymentClaims.length === 0 && (
                            <tr>
                              <td colSpan={5} className="p-8 text-center text-slate-400">
                                No payment claims submitted yet.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-200">
                  <h3 className="font-extrabold text-slate-800 text-sm">
                    Official Verified Payment &amp; Advance Receipts ({myPaymentTxns.length})
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-600 uppercase text-[10px] border-b border-slate-200">
                      <tr>
                        <th className="p-3.5 font-bold">Date</th>
                        <th className="p-3.5 font-bold">Receipt / Ref No</th>
                        <th className="p-3.5 font-bold">Method</th>
                        <th className="p-3.5 font-bold">Description</th>
                        <th className="p-3.5 font-bold text-right">Amount</th>
                        <th className="p-3.5 font-bold text-center">Receipt</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {myPaymentTxns.map((txn) => (
                        <tr key={txn.id} className="hover:bg-slate-50">
                          <td className="p-3.5 font-mono text-slate-500">
                            {formatDDMMYY(txn.date)}
                          </td>
                          <td className="p-3.5 font-mono font-bold text-slate-900">
                            {txn.receiptNo || txn.reference}
                          </td>
                          <td className="p-3.5 text-slate-600">
                            {txn.paymentMethod || 'Cash / Bank'}
                          </td>
                          <td className="p-3.5 text-slate-700">
                            {txn.description}
                          </td>
                          <td className="p-3.5 text-right font-mono font-black text-emerald-700">
                            {formatTkAmount(txn.amount)}
                          </td>
                          <td className="p-3.5 text-center">
                            <button
                              type="button"
                              onClick={() => setPreviewReceipt(txn)}
                              className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-[11px] inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Printer className="w-3 h-3" /> Receipt
                            </button>
                          </td>
                        </tr>
                      ))}
                      {myPaymentTxns.length === 0 && (
                        <tr>
                          <td
                            colSpan={6}
                            className="p-10 text-center text-slate-400"
                          >
                            No payment receipts recorded yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 8: ACCOUNT STATEMENT */}
          {activeTab === 'statement' && (
            <div className="space-y-4 max-w-[1400px] mx-auto">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-end justify-between gap-4 no-print">
                <div className="flex flex-wrap items-end gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                      From Date
                    </label>
                    <input
                      type="date"
                      value={stmtFrom}
                      onChange={(e) => setStmtFrom(e.target.value)}
                      className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                      To Date
                    </label>
                    <input
                      type="date"
                      value={stmtTo}
                      onChange={(e) => setStmtTo(e.target.value)}
                      className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-mono"
                    />
                  </div>
                  {(stmtFrom || stmtTo) && (
                    <button
                      type="button"
                      onClick={() => {
                        setStmtFrom('');
                        setStmtTo('');
                      }}
                      className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                    >
                      Reset
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleExportStatementCSV}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <Download className="w-3.5 h-3.5 shrink-0" /> Export CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const runPdf = () =>
                        downloadCustomerStatementPdf({
                          brandTitle: settings.brandName || settings.storeName,
                          buyerName: buyer.name,
                          buyerPhone: buyer.phone || 'N/A',
                          buyerAddress: buyer.address || 'N/A',
                          entries: filteredStatementEntries,
                          totalDebit: statement.totalDebit,
                          totalCredit: statement.totalCredit,
                          closingBalance: statement.closingBalance,
                        });
                      if (isInsideIframeEnv()) {
                        runPdf();
                      } else {
                        try {
                          window.print();
                        } catch {
                          runPdf();
                        }
                      }
                    }}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-extrabold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <Printer className="w-3.5 h-3.5 shrink-0" /> Print / PDF Statement
                  </button>
                </div>
              </div>

              <div
                id="printable-statement"
                className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
                  <div>
                    <h3 className="font-black text-slate-900 text-lg">
                      Customer Account Statement — {buyer.name}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {settings.brandName} • Phone: {buyer.phone || 'N/A'} •{' '}
                      {buyer.address || 'N/A'}
                    </p>
                  </div>
                  <div className="text-right text-xs">
                    <div className="text-slate-500">Closing Balance Due</div>
                    <div
                      className={`font-mono font-black text-lg ${
                        statement.closingBalance > 0
                          ? 'text-rose-600'
                          : 'text-emerald-600'
                      }`}
                    >
                      {formatTkAmount(statement.closingBalance)}
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 text-slate-700 uppercase text-[10px] border-b border-slate-300">
                      <tr>
                        <th className="p-3 font-bold">Date</th>
                        <th className="p-3 font-bold">Reference</th>
                        <th className="p-3 font-bold">Particulars</th>
                        <th className="p-3 font-bold text-right">Debit (Billed)</th>
                        <th className="p-3 font-bold text-right">Credit (Paid / Return)</th>
                        <th className="p-3 font-bold text-right">Running Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredStatementEntries.map((entry) => (
                        <tr key={entry.id} className="hover:bg-slate-50">
                          <td className="p-3 font-mono text-slate-500 whitespace-nowrap">
                            {formatDDMMYY(entry.date)}
                          </td>
                          <td className="p-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                            {entry.reference}
                          </td>
                          <td className="p-3 text-slate-700">
                            {entry.description}
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                            {entry.debit > 0 ? formatTkAmount(entry.debit) : '-'}
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-emerald-700 whitespace-nowrap">
                            {entry.credit > 0 ? formatTkAmount(entry.credit) : '-'}
                          </td>
                          <td className="p-3 text-right font-mono font-black text-slate-950 whitespace-nowrap">
                            {formatTkAmount(entry.runningBalance)}
                          </td>
                        </tr>
                      ))}
                      {filteredStatementEntries.length === 0 && (
                        <tr>
                          <td
                            colSpan={6}
                            className="p-10 text-center text-slate-400"
                          >
                            No ledger transactions in this period.
                          </td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot className="bg-slate-50 border-t-2 border-slate-300 font-black text-xs">
                      <tr>
                        <td colSpan={3} className="p-3 text-right">
                          Statement Totals:
                        </td>
                        <td className="p-3 text-right font-mono">
                          {formatTkAmount(statement.totalDebit)}
                        </td>
                        <td className="p-3 text-right font-mono text-emerald-700">
                          {formatTkAmount(statement.totalCredit)}
                        </td>
                        <td className="p-3 text-right font-mono text-rose-700">
                          {formatTkAmount(statement.closingBalance)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 9: CUSTOMER PROFILE */}
          {activeTab === 'profile' && (
            <form
              onSubmit={handleSaveProfile}
              className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 max-w-2xl mx-auto space-y-5"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">
                    Buyer Profile &amp; Security
                  </h3>
                  <p className="text-xs text-slate-500">
                    Customer ID: <span className="font-mono">{buyer.id}</span> • User ID:{' '}
                    <span className="font-mono">{currentUser.userId}</span>
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-extrabold">
                  {buyer.portalStatus || 'Active'}
                </span>
              </div>

              {profileMsg && (
                <div
                  className={`p-3 rounded-xl text-xs font-bold border ${
                    profileMsg.type === 'success'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}
                >
                  {profileMsg.text}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Contact / Buyer Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={profName}
                    onChange={(e) => setProfName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Shop / Business Name
                  </label>
                  <input
                    type="text"
                    value={profShop}
                    onChange={(e) => setProfShop(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Mobile Phone
                  </label>
                  <input
                    type="text"
                    value={profPhone}
                    onChange={(e) => setProfPhone(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={profEmail}
                    onChange={(e) => setProfEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Delivery Address
                </label>
                <textarea
                  rows={2}
                  value={profAddress}
                  onChange={(e) => setProfAddress(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 space-y-3">
                <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-slate-500" />
                  <span>Change Portal Password (Optional)</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {currentUser.authProvider !== 'google' && (
                    <input
                      type="password"
                      value={curPwd}
                      onChange={(e) => setCurPwd(e.target.value)}
                      placeholder="Current password"
                      className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs"
                    />
                  )}
                  <input
                    type="password"
                    value={newPwd}
                    onChange={(e) => setNewPwd(e.target.value)}
                    placeholder="New password"
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs"
                  />
                  <input
                    type="password"
                    value={confirmPwd}
                    onChange={(e) => setConfirmPwd(e.target.value)}
                    placeholder="Confirm password"
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs cursor-pointer"
                >
                  Save Profile Changes
                </button>
              </div>
            </form>
          )}
        </main>
      </div>

      {/* INVOICE PDF / PRINT MODAL */}
      {previewInvoice && (
        <InvoiceReceiptModal
          invoice={previewInvoice}
          customer={buyer}
          brandName={settings.brandName}
          brandShortName={settings.brandShortName}
          storeName={settings.storeName}
          logoUrl={settings.logoUrl}
          address={settings.address}
          phone={settings.phone}
          companyEmail={settings.companyEmail}
          companyWebsite={settings.companyWebsite}
          onClose={() => setPreviewInvoice(null)}
          onRepeatOrder={(inv) =>
            handleRepeatItems(inv.items, `Invoice #${inv.chalanNo}`)
          }
        />
      )}

      {/* PAYMENT RECEIPT PRINTABLE MODAL */}
      {previewReceipt && (
        <div className="fixed inset-0 bg-slate-950/75 flex items-start justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-300 max-w-lg w-full p-6 space-y-4 my-auto">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3 no-print">
              <span className="font-extrabold text-slate-900 text-sm">
                Official Payment Receipt
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={getWhatsAppUrl(
                    buyer.phone,
                    buildReceiptWhatsAppText({
                      brandTitle: settings.brandName || settings.storeName,
                      buyerName: buyer.name,
                      receiptNo: previewReceipt.receiptNo || previewReceipt.reference,
                      amount: previewReceipt.amount,
                      method: previewReceipt.paymentMethod || 'Cash / Bank',
                      date: previewReceipt.date,
                      remainingDue: buyer.totalDue,
                    })
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 whitespace-nowrap"
                >
                  <MessageSquare className="w-3.5 h-3.5 shrink-0" /> WhatsApp
                </a>
                <button
                  type="button"
                  onClick={() =>
                    downloadPaymentReceiptPdf({
                      brandTitle: settings.brandName || settings.storeName,
                      address: settings.address || '',
                      phone: settings.phone || '',
                      buyerName: buyer.name,
                      receiptNo: previewReceipt.receiptNo || previewReceipt.reference,
                      amount: previewReceipt.amount,
                      method: previewReceipt.paymentMethod || 'Cash / Bank',
                      date: formatDDMMYY(previewReceipt.date),
                      remainingDue: buyer.totalDue,
                    })
                  }
                  className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5 shrink-0" /> PDF
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const triggerReceiptPdf = () =>
                      downloadPaymentReceiptPdf({
                        brandTitle: settings.brandName || settings.storeName,
                        address: settings.address || '',
                        phone: settings.phone || '',
                        buyerName: buyer.name,
                        receiptNo: previewReceipt.receiptNo || previewReceipt.reference,
                        amount: previewReceipt.amount,
                        method: previewReceipt.paymentMethod || 'Cash / Bank',
                        date: formatDDMMYY(previewReceipt.date),
                        remainingDue: buyer.totalDue,
                      });
                    if (isInsideIframeEnv()) {
                      triggerReceiptPdf();
                    } else {
                      try {
                        window.print();
                      } catch {
                        triggerReceiptPdf();
                      }
                    }
                  }}
                  className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap"
                >
                  <Printer className="w-3.5 h-3.5 shrink-0" /> Print / PDF
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewReceipt(null)}
                  aria-label="Close Payment Receipt"
                  className="p-1.5 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div
              id="printable-receipt"
              className="border-2 border-slate-400 rounded-xl p-5 space-y-3 text-xs text-slate-900"
            >
              <div className="text-center border-b border-slate-300 pb-3">
                <h2 className="text-lg font-black text-emerald-700 uppercase">
                  {settings.brandName || settings.storeName}
                </h2>
                <p className="text-[11px] text-slate-500">
                  {settings.address} • {settings.phone}
                </p>
                <div className="mt-2 inline-block px-3 py-0.5 bg-emerald-50 border border-emerald-200 rounded font-extrabold text-emerald-800">
                  PAYMENT RECEIPT
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Receipt / Ref No:</span>
                  <span className="font-mono font-bold">
                    {previewReceipt.receiptNo || previewReceipt.reference}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Date:</span>
                  <span className="font-mono font-bold">
                    {formatDDMMYY(previewReceipt.date)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Received From:</span>
                  <span className="font-bold">{buyer.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Payment Method:</span>
                  <span className="font-bold">
                    {previewReceipt.paymentMethod || 'Cash / Bank'}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-200 text-sm">
                  <span className="font-bold">Amount Received:</span>
                  <span className="font-mono font-black text-emerald-700">
                    {formatTkAmount(previewReceipt.amount)}
                  </span>
                </div>
                <div className="bg-slate-50 p-2 rounded border border-slate-200 text-[11px]">
                  <strong>In Words:</strong>{' '}
                  {numberToEnglishWords(previewReceipt.amount)}
                </div>
                <div className="text-[11px] text-slate-600 pt-1">
                  <strong>Notes:</strong> {previewReceipt.description}
                </div>
              </div>

              <div className="pt-8 flex justify-between text-[11px] font-bold">
                <div className="border-t border-slate-400 pt-1 w-32 text-center">
                  Customer
                </div>
                <div className="border-t border-slate-400 pt-1 w-36 text-center">
                  Authorized Signature
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #printable-statement, #printable-statement *,
          #printable-receipt, #printable-receipt * {
            visibility: visible !important;
          }
          #printable-statement, #printable-receipt {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 16px !important;
            box-shadow: none !important;
            background: #ffffff !important;
          }
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  );
};
