import React, { useEffect, useMemo, useState } from 'react';
import {
  CourierStatus,
  CustomerOrder,
  Invoice,
  SystemUser,
  Wholesaler,
} from '../data/mockData';
import {
  CheckCircle2,
  Clock,
  Download,
  Edit,
  ExternalLink,
  FileText,
  MessageSquare,
  Package,
  RefreshCw,
  Search,
  Truck,
  X,
} from 'lucide-react';
import { extractYYYYMMDD, formatDDMMYY, getLocalYYYYMMDD } from '../utils/dateUtils';
import { formatTkAmount } from '../utils/numberToWords';
import { getCourierTrackingUrl } from '../utils/erpEnhancements';
import {
  buildBulkCourierBookingCsv,
  COURIER_STATUS_OPTIONS,
} from '../utils/erpFeatureUtils';
import {
  downloadInvoiceA4Pdf,
  sendInvoicePdfToWhatsApp,
} from '../utils/printAndDownload';
import { InvoiceReceiptModal } from './InvoiceReceiptModal';

const COMMON_COURIERS = [
  'Sundarban Courier Service',
  'SA Paribahan',
  'Korotoa Courier Service',
  'RedX',
  'Pathao Courier',
  'Steadfast Courier',
  'Janani Express',
  'USB Express',
  'AJR Parcel Service',
  'Own Delivery / Local Van',
];

interface CourierDispatchViewProps {
  invoices: Invoice[];
  wholesalers: Wholesaler[];
  customerOrders: CustomerOrder[];
  onUpdateInvoice: (inv: Invoice) => void;
  onUpdateCustomerOrder: (ord: CustomerOrder) => void;
  searchQuery: string;
  systemDate?: string;
  brandName: string;
  brandShortName: string;
  storeName: string;
  logoUrl?: string;
  address: string;
  phone: string;
  companyEmail?: string;
  companyWebsite?: string;
  currentUser?: SystemUser;
}

export const CourierDispatchView: React.FC<CourierDispatchViewProps> = ({
  invoices,
  wholesalers,
  customerOrders,
  onUpdateInvoice,
  onUpdateCustomerOrder,
  searchQuery,
  systemDate,
  brandName,
  brandShortName,
  storeName,
  logoUrl,
  address,
  phone,
  companyEmail,
  companyWebsite,
  currentUser,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'invoices' | 'orders'>('invoices');
  const [dispatchFilter, setDispatchFilter] = useState<'all' | 'pending' | 'dispatched'>('all');
  const [invoiceSearchInput, setInvoiceSearchInput] = useState('');

  // Linked Quick Invoice Courier Form (search by Invoice No -> assign courier + tracking)
  const [linkedInvoiceId, setLinkedInvoiceId] = useState<string>('');
  const [quickCourierName, setQuickCourierName] = useState('Sundarban Courier Service');
  const [quickTrackingNo, setQuickTrackingNo] = useState('');
  const [quickCartons, setQuickCartons] = useState('1 Carton');
  const [quickDispatchDate, setQuickDispatchDate] = useState(systemDate || getLocalYYYYMMDD());
  const [quickCourierStatus, setQuickCourierStatus] = useState<CourierStatus>('Booked');

  // Edit Chalan Dispatch Modal
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [courierName, setCourierName] = useState('');
  const [courierTrackingNo, setCourierTrackingNo] = useState('');
  const [totalCartons, setTotalCartons] = useState('');
  const [deliveryDate, setDeliveryDate] = useState(systemDate || getLocalYYYYMMDD());
  const [dispatchNotes, setDispatchNotes] = useState('');
  const [editCourierStatus, setEditCourierStatus] = useState<CourierStatus>('Booked');
  const [syncingInvoiceId, setSyncingInvoiceId] = useState<string | null>(null);

  // Edit Portal Order Dispatch Modal
  const [editingOrder, setEditingOrder] = useState<CustomerOrder | null>(null);
  const [orderStatus, setOrderStatus] = useState<CustomerOrder['status']>('Dispatched');
  const [orderCourierName, setOrderCourierName] = useState('');
  const [orderTrackingNo, setOrderTrackingNo] = useState('');
  const [orderCartons, setOrderCartons] = useState('');

  // Updated Invoice Preview & WhatsApp PDF
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);
  const [lastUpdatedInvoice, setLastUpdatedInvoice] = useState<Invoice | null>(null);
  const [sharingInvoiceId, setSharingInvoiceId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

  const getCourierStatusBadgeClass = (st?: CourierStatus) => {
    switch (st) {
      case 'Delivered':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'Out for Delivery':
      case 'In Transit':
        return 'bg-cyan-100 text-cyan-800 border-cyan-200';
      case 'Booked':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'Returned':
      case 'Cancelled':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      default:
        return 'bg-amber-100 text-amber-800 border-amber-200';
    }
  };

  const wholesaleInvoices = useMemo(
    () => invoices.filter((inv) => inv.saleType !== 'Retail'),
    [invoices]
  );

  // Close open dispatch modal or preview modal on browser Back button
  useEffect(() => {
    if (!previewInvoice && !editingInvoice && !editingOrder) return;
    const handleBack = (evt: Event) => {
      if (previewInvoice) {
        // InvoiceReceiptModal registers its own listener too; only intercept here for dispatch modals
        return;
      }
      if (editingInvoice) {
        evt.preventDefault();
        setEditingInvoice(null);
        return;
      }
      if (editingOrder) {
        evt.preventDefault();
        setEditingOrder(null);
      }
    };
    window.addEventListener('erp:history-back', handleBack);
    return () => window.removeEventListener('erp:history-back', handleBack);
  }, [previewInvoice, editingInvoice, editingOrder]);

  const metrics = useMemo(() => {
    const totalDispatches = wholesaleInvoices.length;
    const assignedCount = wholesaleInvoices.filter(
      (inv) => Boolean(inv.courierName?.trim()) && Boolean(inv.courierTrackingNo?.trim())
    ).length;
    const pendingCount = wholesaleInvoices.filter(
      (inv) => !inv.courierName?.trim() || !inv.courierTrackingNo?.trim()
    ).length;
    const portalPending = customerOrders.filter(
      (o) => o.status === 'Approved' || o.status === 'Packed' || o.status === 'Pending Approval'
    ).length;

    return {
      totalDispatches,
      assignedCount,
      pendingCount,
      portalPending,
    };
  }, [wholesaleInvoices, customerOrders]);

  const combinedSearch = (invoiceSearchInput || searchQuery).trim().toLowerCase();

  // Matches when typing an Invoice Number in the Quick Courier Link search bar
  const quickLookupMatches = useMemo(() => {
    const q = invoiceSearchInput.trim().toLowerCase();
    if (!q) return [];
    return wholesaleInvoices
      .filter(
        (inv) =>
          inv.chalanNo.toLowerCase().includes(q) ||
          inv.wholesalerName.toLowerCase().includes(q) ||
          (inv.customerPhone && inv.customerPhone.toLowerCase().includes(q))
      )
      .slice(0, 6);
  }, [wholesaleInvoices, invoiceSearchInput]);

  const linkedInvoice = useMemo(
    () => wholesaleInvoices.find((inv) => inv.id === linkedInvoiceId) || null,
    [wholesaleInvoices, linkedInvoiceId]
  );

  const selectInvoiceForQuickLink = (inv: Invoice) => {
    setLinkedInvoiceId(inv.id);
    setInvoiceSearchInput(inv.chalanNo);
    setQuickCourierName(inv.courierName || 'Sundarban Courier Service');
    setQuickTrackingNo(inv.courierTrackingNo || '');
    setQuickCartons(
      typeof inv.totalCartons === 'string'
        ? inv.totalCartons
        : inv.totalCartons
        ? `${inv.totalCartons} Carton`
        : '1 Carton'
    );
    setQuickDispatchDate(
      inv.deliveryDate ? extractYYYYMMDD(inv.deliveryDate) : extractYYYYMMDD(inv.date)
    );
  };

  const handleQuickInvoiceSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = invoiceSearchInput.trim().toLowerCase();
    if (!q) return;
    const exact =
      wholesaleInvoices.find((inv) => inv.chalanNo.toLowerCase() === q) ||
      quickLookupMatches[0];
    if (exact) {
      selectInvoiceForQuickLink(exact);
    } else {
      setNotice(`No wholesale invoice found matching "${invoiceSearchInput.trim()}".`);
      setTimeout(() => setNotice(''), 3500);
    }
  };

  const buildUpdatedCourierInvoice = (
    baseInv: Invoice,
    courier: string,
    tracking: string,
    cartons: string,
    dispDate: string,
    notesText?: string,
    statusVal?: CourierStatus
  ): Invoice => {
    const cleanCourier = courier.trim();
    const cleanTracking = tracking.trim();
    const cleanCartons = cartons.trim();
    const isoDate = dispDate ? `${dispDate}T12:00:00` : baseInv.deliveryDate || baseInv.date;
    const resolvedStatus: CourierStatus =
      statusVal || baseInv.courierStatus || (cleanCourier && cleanTracking ? 'Booked' : 'Pending Booking');

    return {
      ...baseInv,
      courierName: cleanCourier,
      courierTrackingNo: cleanTracking,
      courierStatus: resolvedStatus,
      totalCartons: cleanCartons,
      deliveryDate: isoDate,
      date: dispDate ? isoDate : baseInv.date,
      dispatchBreakdownNotes:
        notesText?.trim() ||
        (cleanCourier
          ? `${baseInv.items.map((c) => `${c.itemName} (${c.quantity} pcs)`).join(', ')} • ${cleanCartons || '1 Carton'} dispatched via ${cleanCourier}${cleanTracking ? ` (Tracking: ${cleanTracking})` : ''} on ${formatDDMMYY(dispDate)}`
          : baseInv.dispatchBreakdownNotes),
    };
  };

  const handleSaveQuickLinkDispatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkedInvoice) return;
    const updated = buildUpdatedCourierInvoice(
      linkedInvoice,
      quickCourierName,
      quickTrackingNo,
      quickCartons,
      quickDispatchDate,
      undefined,
      quickCourierStatus
    );
    onUpdateInvoice(updated);
    setLastUpdatedInvoice(updated);
    setNotice(
      `Updated Invoice #${updated.chalanNo} with ${updated.courierName}${updated.courierTrackingNo ? ` (Tracking: ${updated.courierTrackingNo})` : ''} [${updated.courierStatus}].`
    );
  };

  const handleSyncLiveStatus = async (inv: Invoice) => {
    if (!inv.courierTrackingNo) {
      setNotice(`Invoice #${inv.chalanNo} needs a Tracking / Consignment ID before syncing.`);
      return;
    }
    setSyncingInvoiceId(inv.id);
    try {
      const reqPayload = JSON.stringify({
        action: 'status',
        courierName: inv.courierName || '',
        trackingNo: inv.courierTrackingNo,
      });
      let res = await fetch('/api/courier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: reqPayload,
      });
      if (res.status === 404) {
        res = await fetch('/.netlify/functions/courier', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: reqPayload,
        });
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.configured === false) {
        setNotice(
          data.message ||
            'Courier API credentials are not set on server env yet. Use the status selector manually or export Bulk CSV.'
        );
        return;
      }
      if (data.status) {
        onUpdateInvoice({
          ...inv,
          courierStatus: data.status as CourierStatus,
          courierLastSyncedAt: new Date().toISOString(),
        });
        setNotice(`Synced live status for #${inv.chalanNo}: ${data.status}`);
      } else {
        setNotice(`Live lookup checked for #${inv.chalanNo}: ${data.message || 'No status update returned.'}`);
      }
    } catch {
      setNotice(
        `Courier live sync unavailable in local preview mode; update status directly or export Bulk CSV.`
      );
    } finally {
      setSyncingInvoiceId(null);
    }
  };

  const handleDownloadBulkCsv = (format: 'steadfast' | 'redx' | 'generic') => {
    const csv = buildBulkCourierBookingCsv(filteredInvoices, wholesalers, format);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `courier-bulk-${format}-${getLocalYYYYMMDD()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setNotice(
      `Exported ${filteredInvoices.length} invoice(s) in ${format.toUpperCase()} bulk booking CSV format.`
    );
  };

  const filteredInvoices = useMemo(() => {
    return wholesaleInvoices.filter((inv) => {
      const hasCourierAndTracking =
        Boolean(inv.courierName?.trim()) && Boolean(inv.courierTrackingNo?.trim());
      if (dispatchFilter === 'pending' && hasCourierAndTracking) return false;
      if (dispatchFilter === 'dispatched' && !hasCourierAndTracking) return false;

      if (!combinedSearch) return true;
      return (
        inv.chalanNo.toLowerCase().includes(combinedSearch) ||
        inv.wholesalerName.toLowerCase().includes(combinedSearch) ||
        (inv.customerPhone && inv.customerPhone.toLowerCase().includes(combinedSearch)) ||
        (inv.courierName && inv.courierName.toLowerCase().includes(combinedSearch)) ||
        (inv.courierTrackingNo && inv.courierTrackingNo.toLowerCase().includes(combinedSearch))
      );
    });
  }, [wholesaleInvoices, dispatchFilter, combinedSearch]);

  const filteredOrders = useMemo(() => {
    const q = combinedSearch;
    return customerOrders.filter((ord) => {
      if (!q) return true;
      return (
        ord.orderNo.toLowerCase().includes(q) ||
        ord.wholesalerName.toLowerCase().includes(q) ||
        (ord.courierName && ord.courierName.toLowerCase().includes(q)) ||
        (ord.courierTrackingNo && ord.courierTrackingNo.toLowerCase().includes(q))
      );
    });
  }, [customerOrders, combinedSearch]);

  const openInvoiceDispatchModal = (inv: Invoice) => {
    setEditingInvoice(inv);
    setCourierName(inv.courierName || 'Sundarban Courier Service');
    setCourierTrackingNo(inv.courierTrackingNo || '');
    setEditCourierStatus(inv.courierStatus || (inv.courierTrackingNo ? 'Booked' : 'Pending Booking'));
    setTotalCartons(
      typeof inv.totalCartons === 'string'
        ? inv.totalCartons
        : inv.totalCartons
        ? `${inv.totalCartons} Carton`
        : '1 Carton'
    );
    setDeliveryDate(
      inv.deliveryDate ? extractYYYYMMDD(inv.deliveryDate) : extractYYYYMMDD(inv.date)
    );
    setDispatchNotes(inv.dispatchBreakdownNotes || '');
  };

  const saveModalInvoiceDispatch = (andPreviewInvoice = false) => {
    if (!editingInvoice) return;
    const updated = buildUpdatedCourierInvoice(
      editingInvoice,
      courierName,
      courierTrackingNo,
      totalCartons,
      deliveryDate,
      dispatchNotes,
      editCourierStatus
    );
    onUpdateInvoice(updated);
    setLastUpdatedInvoice(updated);
    setEditingInvoice(null);
    setNotice(
      `Updated Invoice #${updated.chalanNo} with ${updated.courierName}${updated.courierTrackingNo ? ` (Tracking: ${updated.courierTrackingNo})` : ''} [${updated.courierStatus}].`
    );
    if (andPreviewInvoice) {
      setPreviewInvoice(updated);
    }
  };

  const handleSaveInvoiceDispatch = (e: React.FormEvent) => {
    e.preventDefault();
    saveModalInvoiceDispatch(false);
  };

  const openOrderDispatchModal = (ord: CustomerOrder) => {
    setEditingOrder(ord);
    setOrderStatus(ord.status);
    setOrderCourierName(ord.courierName || 'Sundarban Courier Service');
    setOrderTrackingNo(ord.courierTrackingNo || '');
    setOrderCartons(ord.totalCartons || '1 Carton');
  };

  const handleSaveOrderDispatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrder) return;

    const updated: CustomerOrder = {
      ...editingOrder,
      status: orderStatus,
      courierName: orderCourierName.trim(),
      courierTrackingNo: orderTrackingNo.trim(),
      totalCartons: orderCartons.trim(),
      updatedAt: new Date().toISOString(),
    };

    onUpdateCustomerOrder(updated);
    setEditingOrder(null);
    setNotice(`Portal Order ${updated.orderNo} dispatch updated.`);
    setTimeout(() => setNotice(''), 3500);
  };

  const handleDownloadUpdatedPdf = async (inv: Invoice) => {
    const buyer = wholesalers.find((w) => w.id === inv.wholesalerId) || null;
    const ok = await downloadInvoiceA4Pdf({
      invoice: inv,
      customer: buyer,
      brandName,
      brandShortName,
      storeName,
      logoUrl,
      address,
      phone,
      companyEmail,
      companyWebsite,
    });
    if (ok) {
      setNotice(`Downloaded Updated Invoice PDF (Invoice_${inv.chalanNo}.pdf)!`);
      setTimeout(() => setNotice(''), 4000);
    }
  };

  const handleOneClickWhatsAppPdf = async (inv: Invoice) => {
    if (sharingInvoiceId) return;
    setSharingInvoiceId(inv.id);
    try {
      const buyer = wholesalers.find((w) => w.id === inv.wholesalerId) || null;
      const outcome = await sendInvoicePdfToWhatsApp({
        invoice: inv,
        customer: buyer,
        brandName,
        brandShortName,
        storeName,
        logoUrl,
        address,
        phone,
        companyEmail,
        companyWebsite,
        paperLayout: 'a4',
      });
      if (outcome.status === 'shared') {
        setNotice(`Sent ${outcome.filename} to WhatsApp!`);
      } else if (outcome.status === 'downloaded-and-opened') {
        setNotice(
          outcome.hasPhone
            ? `${outcome.filename} downloaded & customer's WhatsApp chat opened — attach the PDF file to send!`
            : `${outcome.filename} downloaded & WhatsApp opened — select customer & attach the PDF!`
        );
      }
    } finally {
      setSharingInvoiceId(null);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-[1600px] mx-auto min-h-full">
      {/* KPI Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500">Total Wholesale Chalans</p>
            <p className="text-2xl font-black text-slate-900 font-mono tabular-nums mt-1">
              {metrics.totalDispatches}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
            <Package className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500">Pending Booking / Tracking</p>
            <p className="text-2xl font-black text-amber-600 font-mono tabular-nums mt-1">
              {metrics.pendingCount}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500">Booked &amp; Dispatched</p>
            <p className="text-2xl font-black text-emerald-600 font-mono tabular-nums mt-1">
              {metrics.assignedCount}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500">Portal Orders Queue</p>
            <p className="text-2xl font-black text-cyan-700 font-mono tabular-nums mt-1">
              {metrics.portalPending}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-700 flex items-center justify-center shrink-0">
            <Truck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Invoice Number Search & Direct Courier Link Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <Search className="w-4 h-4 text-emerald-600" />
              <span>Link Courier &amp; Tracking to Invoice (ইনভয়েস নম্বর দিয়ে কুরিয়ার যুক্ত করুন)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Search by Invoice No after submitting parcel to courier — add Courier Name &amp; Tracking No to generate an Updated Invoice and send PDF to WhatsApp in 1 click.
            </p>
          </div>
          {linkedInvoice && (
            <button
              type="button"
              onClick={() => {
                setLinkedInvoiceId('');
                setInvoiceSearchInput('');
              }}
              className="text-xs font-bold text-slate-500 hover:text-slate-900 cursor-pointer self-start sm:self-center"
            >
              Clear Selection
            </button>
          )}
        </div>

        <form onSubmit={handleQuickInvoiceSearchSubmit} className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={invoiceSearchInput}
              onChange={(e) => {
                setInvoiceSearchInput(e.target.value);
                if (linkedInvoice && e.target.value.trim() !== linkedInvoice.chalanNo) {
                  setLinkedInvoiceId('');
                }
              }}
              aria-label="Search Invoice Number for Courier"
              placeholder="Enter Invoice No (e.g. 2500021), Customer Name, or Mobile..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-9 py-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            {invoiceSearchInput && (
              <button
                type="button"
                onClick={() => {
                  setInvoiceSearchInput('');
                  setLinkedInvoiceId('');
                }}
                aria-label="Clear invoice search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            type="submit"
            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-extrabold rounded-xl text-xs transition cursor-pointer whitespace-nowrap"
          >
            Find Invoice
          </button>
        </form>

        {/* Instant Invoice Search Suggestions */}
        {invoiceSearchInput.trim() && !linkedInvoice && quickLookupMatches.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {quickLookupMatches.map((inv) => (
              <button
                key={inv.id}
                type="button"
                onClick={() => selectInvoiceForQuickLink(inv)}
                className="px-3 py-1.5 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-xl text-xs font-bold text-slate-800 transition cursor-pointer flex items-center gap-2"
              >
                <span className="font-mono font-black text-emerald-700">#{inv.chalanNo}</span>
                <span>{inv.wholesalerName}</span>
                <span className="text-[11px] font-mono text-slate-500">
                  {formatTkAmount(inv.subTotal ?? inv.totalAmount)}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Inline Courier + Tracking Assignment Form once Invoice is selected */}
        {linkedInvoice && (
          <form
            onSubmit={handleSaveQuickLinkDispatch}
            className="bg-slate-50 border border-emerald-200 rounded-2xl p-4 space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200">
              <div className="text-xs">
                <span className="font-mono font-black text-emerald-700 text-sm mr-2">
                  Invoice #{linkedInvoice.chalanNo}
                </span>
                <span className="font-extrabold text-slate-900">
                  {linkedInvoice.wholesalerName}
                </span>
                {linkedInvoice.customerPhone && (
                  <span className="text-slate-500 font-mono ml-2">
                    ({linkedInvoice.customerPhone})
                  </span>
                )}
              </div>
              <div className="text-xs font-mono font-black text-slate-800">
                Bill: {formatTkAmount(linkedInvoice.subTotal ?? linkedInvoice.totalAmount)}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                  Courier Service *
                </label>
                <input
                  type="text"
                  list="dispatch-courier-suggestions"
                  required
                  value={quickCourierName}
                  onChange={(e) => setQuickCourierName(e.target.value)}
                  placeholder="Sundarban / Steadfast / RedX..."
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                  Tracking / Booking No *
                </label>
                <input
                  type="text"
                  required
                  value={quickTrackingNo}
                  onChange={(e) => setQuickTrackingNo(e.target.value)}
                  placeholder="e.g. SF-889911"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                  Cartons
                </label>
                <input
                  type="text"
                  value={quickCartons}
                  onChange={(e) => setQuickCartons(e.target.value)}
                  placeholder="e.g. 2 Cartons"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                  Dispatch Date
                </label>
                <input
                  type="date"
                  value={quickDispatchDate}
                  onChange={(e) => setQuickDispatchDate(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs transition cursor-pointer flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Update Invoice &amp; Save Courier</span>
              </button>
              <button
                type="button"
                onClick={() => setPreviewInvoice(linkedInvoice)}
                className="px-3.5 py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 font-bold rounded-xl text-xs transition cursor-pointer flex items-center gap-1.5"
              >
                <FileText className="w-3.5 h-3.5 shrink-0" />
                <span>View Invoice</span>
              </button>
              <button
                type="button"
                onClick={() => handleOneClickWhatsAppPdf(linkedInvoice)}
                disabled={sharingInvoiceId === linkedInvoice.id}
                className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-extrabold rounded-xl text-xs transition cursor-pointer flex items-center gap-1.5"
              >
                <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {sharingInvoiceId === linkedInvoice.id ? 'Preparing PDF...' : '1-Click WhatsApp PDF'}
                </span>
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Global Courier Suggestions Datalist */}
      <datalist id="dispatch-courier-suggestions">
        {COMMON_COURIERS.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      {/* Notice Banner with Updated Invoice Instant Actions */}
      {notice && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl text-xs font-bold flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <span>{notice}</span>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {lastUpdatedInvoice && (
              <>
                <button
                  type="button"
                  onClick={() => setPreviewInvoice(lastUpdatedInvoice)}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>View Updated Invoice</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadUpdatedPdf(lastUpdatedInvoice)}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-emerald-300 text-emerald-900 rounded-xl text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleOneClickWhatsAppPdf(lastUpdatedInvoice)}
                  disabled={sharingInvoiceId === lastUpdatedInvoice.id}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>
                    {sharingInvoiceId === lastUpdatedInvoice.id
                      ? 'Preparing PDF...'
                      : 'WhatsApp PDF'}
                  </span>
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => {
                setNotice('');
                setLastUpdatedInvoice(null);
              }}
              className="text-emerald-700 font-black cursor-pointer px-1"
              aria-label="Dismiss notice"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Control Toolbar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveSubTab('invoices')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              activeSubTab === 'invoices'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Chalan Courier &amp; Dispatch ({wholesaleInvoices.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('orders')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              activeSubTab === 'orders'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Buyer Portal Dispatch ({customerOrders.length})
          </button>
        </div>

        {activeSubTab === 'invoices' && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setDispatchFilter('all')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer whitespace-nowrap ${
                  dispatchFilter === 'all'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All ({wholesaleInvoices.length})
              </button>
              <button
                type="button"
                onClick={() => setDispatchFilter('pending')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer whitespace-nowrap ${
                  dispatchFilter === 'pending'
                    ? 'bg-amber-500 text-slate-950 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Pending Booking ({metrics.pendingCount})
              </button>
              <button
                type="button"
                onClick={() => setDispatchFilter('dispatched')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer whitespace-nowrap ${
                  dispatchFilter === 'dispatched'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tracked ({metrics.assignedCount})
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleDownloadBulkCsv('steadfast')}
                className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 rounded-xl text-[11px] font-extrabold cursor-pointer whitespace-nowrap"
              >
                Steadfast CSV
              </button>
              <button
                type="button"
                onClick={() => handleDownloadBulkCsv('redx')}
                className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-xl text-[11px] font-extrabold cursor-pointer whitespace-nowrap"
              >
                RedX CSV
              </button>
              <button
                type="button"
                onClick={() => handleDownloadBulkCsv('generic')}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 rounded-xl text-[11px] font-extrabold cursor-pointer whitespace-nowrap"
              >
                Bulk CSV
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Wholesale Chalans Dispatch Table */}
      {activeSubTab === 'invoices' && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider text-[10px] border-b border-slate-200">
                <tr>
                  <th className="p-3.5 font-bold">Invoice / Chalan</th>
                  <th className="p-3.5 font-bold">Customer &amp; Address</th>
                  <th className="p-3.5 font-bold">Items &amp; Value</th>
                  <th className="p-3.5 font-bold">Courier &amp; Live Status</th>
                  <th className="p-3.5 font-bold">Booking / Tracking No</th>
                  <th className="p-3.5 font-bold">Cartons</th>
                  <th className="p-3.5 font-bold">Dispatch Date</th>
                  <th className="p-3.5 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInvoices.map((inv) => {
                  const buyer = wholesalers.find((w) => w.id === inv.wholesalerId);
                  const buyerPhone = inv.customerPhone || buyer?.phone;
                  const buyerAddress = inv.customerAddress || buyer?.address;
                  const trackingUrl = getCourierTrackingUrl(
                    inv.courierName,
                    inv.courierTrackingNo
                  );
                  const hasDispatch = Boolean(inv.courierName?.trim());
                  const statusLabel: CourierStatus =
                    inv.courierStatus || (hasDispatch && inv.courierTrackingNo ? 'Booked' : 'Pending Booking');

                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-3.5">
                        <div className="font-mono font-black text-slate-900 tabular-nums">
                          #{inv.chalanNo}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {inv.status}
                        </div>
                      </td>
                      <td className="p-3.5">
                        <div className="font-bold text-slate-900">{inv.wholesalerName}</div>
                        <div className="text-[11px] text-slate-500 truncate max-w-[240px]">
                          {[buyerPhone, buyerAddress].filter(Boolean).join(' · ') || 'No address saved'}
                        </div>
                      </td>
                      <td className="p-3.5 font-mono tabular-nums">
                        <div className="font-bold text-slate-900">
                          {formatTkAmount(inv.subTotal ?? inv.totalAmount)}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {inv.items.length} item(s) ·{' '}
                          {inv.items.reduce((s, it) => s + it.quantity + (it.bonusQty || 0), 0)} pcs
                        </div>
                      </td>
                      <td className="p-3.5 space-y-1">
                        {hasDispatch ? (
                          <div className="font-bold text-slate-900">{inv.courierName}</div>
                        ) : (
                          <div className="text-amber-700 font-bold">Not Assigned</div>
                        )}
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-2 py-0.5 rounded border text-[10px] font-extrabold ${getCourierStatusBadgeClass(
                              statusLabel
                            )}`}
                          >
                            {statusLabel}
                          </span>
                          {inv.courierTrackingNo && (
                            <button
                              type="button"
                              onClick={() => handleSyncLiveStatus(inv)}
                              disabled={syncingInvoiceId === inv.id}
                              title="Sync Live Courier Status"
                              className="p-1 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 cursor-pointer"
                            >
                              <RefreshCw
                                className={`w-3 h-3 ${syncingInvoiceId === inv.id ? 'animate-spin' : ''}`}
                              />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="p-3.5 font-mono">
                        {inv.courierTrackingNo ? (
                          trackingUrl ? (
                            <a
                              href={trackingUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-emerald-700 font-bold hover:underline"
                            >
                              <span>{inv.courierTrackingNo}</span>
                              <ExternalLink className="w-3 h-3 shrink-0" />
                            </a>
                          ) : (
                            <span className="font-bold text-slate-800">
                              {inv.courierTrackingNo}
                            </span>
                          )
                        ) : (
                          <span className="text-slate-400">Pending</span>
                        )}
                      </td>
                      <td className="p-3.5 text-slate-700 font-semibold">
                        {inv.totalCartons || '-'}
                      </td>
                      <td className="p-3.5 font-mono tabular-nums text-slate-600">
                        {formatDDMMYY(inv.deliveryDate || inv.date)}
                      </td>
                      <td className="p-3.5 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openInvoiceDispatchModal(inv)}
                            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs inline-flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap"
                          >
                            <Edit className="w-3.5 h-3.5 shrink-0" />
                            <span>{hasDispatch ? 'Update' : 'Assign Courier'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setPreviewInvoice(inv)}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl transition cursor-pointer"
                            title="View Updated Invoice"
                            aria-label={`View Updated Invoice #${inv.chalanNo}`}
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownloadUpdatedPdf(inv)}
                            className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl transition cursor-pointer"
                            title="Download Updated Invoice PDF"
                            aria-label={`Download PDF for Invoice #${inv.chalanNo}`}
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOneClickWhatsAppPdf(inv)}
                            disabled={sharingInvoiceId === inv.id}
                            className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold rounded-xl text-xs inline-flex items-center gap-1 transition cursor-pointer whitespace-nowrap"
                            title="1-Click Send Updated Invoice PDF to Customer on WhatsApp"
                          >
                            <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                            <span>{sharingInvoiceId === inv.id ? '...' : 'PDF'}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredInvoices.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-12 text-center text-slate-400">
                      <Truck className="w-9 h-9 mx-auto text-slate-300 mb-2" />
                      No wholesale chalans matched this dispatch filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Buyer Portal Orders Dispatch Table */}
      {activeSubTab === 'orders' && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider text-[10px] border-b border-slate-200">
                <tr>
                  <th className="p-3.5 font-bold">Order No</th>
                  <th className="p-3.5 font-bold">Buyer</th>
                  <th className="p-3.5 font-bold">Status</th>
                  <th className="p-3.5 font-bold">Courier Service</th>
                  <th className="p-3.5 font-bold">Booking / Tracking</th>
                  <th className="p-3.5 font-bold">Cartons</th>
                  <th className="p-3.5 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOrders.map((ord) => (
                  <tr key={ord.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-3.5 font-mono font-black text-slate-900">
                      {ord.orderNo}
                      {ord.linkedChalanNo && (
                        <div className="text-[10px] text-emerald-700 font-semibold">
                          Chalan #{ord.linkedChalanNo}
                        </div>
                      )}
                    </td>
                    <td className="p-3.5">
                      <div className="font-bold text-slate-900">{ord.wholesalerName}</div>
                      <div className="text-[11px] text-slate-500">{ord.customerPhone || 'N/A'}</div>
                    </td>
                    <td className="p-3.5 font-bold text-slate-800">{ord.status}</td>
                    <td className="p-3.5 text-slate-700 font-semibold">
                      {ord.courierName || 'Not Assigned'}
                    </td>
                    <td className="p-3.5 font-mono text-slate-700">
                      {ord.courierTrackingNo || 'Pending'}
                    </td>
                    <td className="p-3.5 text-slate-700">{ord.totalCartons || '-'}</td>
                    <td className="p-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => openOrderDispatchModal(ord)}
                        className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs inline-flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap"
                      >
                        <Truck className="w-3.5 h-3.5 shrink-0" />
                        <span>Update Dispatch</span>
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredOrders.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-12 text-center text-slate-400">
                      No buyer portal orders found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Invoice Courier & Dispatch Edit Modal */}
      {editingInvoice && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">
                  Courier &amp; Dispatch Details — Invoice #{editingInvoice.chalanNo}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Buyer: {editingInvoice.wholesalerName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingInvoice(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
                aria-label="Close Dispatch Modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveInvoiceDispatch} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Courier Service (কুরিয়ার সার্ভিস) *
                </label>
                <input
                  type="text"
                  list="dispatch-courier-suggestions"
                  required
                  value={courierName}
                  onChange={(e) => setCourierName(e.target.value)}
                  placeholder="e.g. Sundarban Courier Service, SA Paribahan"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Booking / Tracking No (বুকিং নং)
                  </label>
                  <input
                    type="text"
                    value={courierTrackingNo}
                    onChange={(e) => setCourierTrackingNo(e.target.value)}
                    placeholder="e.g. SA-PAR-883921"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Carton Count (মোট কার্টুন)
                  </label>
                  <input
                    type="text"
                    value={totalCartons}
                    onChange={(e) => setTotalCartons(e.target.value)}
                    placeholder="e.g. 2 Cartons"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Dispatch / Delivery Date
                  </label>
                  <input
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Courier Status
                  </label>
                  <select
                    value={editCourierStatus}
                    onChange={(e) => setEditCourierStatus(e.target.value as CourierStatus)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {COURIER_STATUS_OPTIONS.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Dispatch &amp; Delivery Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={dispatchNotes}
                  onChange={(e) => setDispatchNotes(e.target.value)}
                  placeholder="Optional parcel notes, hub branch, or driver phone..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingInvoice(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs cursor-pointer"
                >
                  Save Dispatch Info
                </button>
                <button
                  type="button"
                  onClick={() => saveModalInvoiceDispatch(true)}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs cursor-pointer"
                >
                  Save &amp; View Updated Invoice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Portal Order Dispatch Modal */}
      {editingOrder && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">
                  Portal Order Dispatch — {editingOrder.orderNo}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Buyer: {editingOrder.wholesalerName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingOrder(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveOrderDispatch} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Order Status
                </label>
                <select
                  value={orderStatus}
                  onChange={(e) => setOrderStatus(e.target.value as CustomerOrder['status'])}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800"
                >
                  <option value="Pending Approval">Pending Approval</option>
                  <option value="Approved">Approved</option>
                  <option value="Packed">Packed</option>
                  <option value="Dispatched">Dispatched</option>
                  <option value="Delivered">Delivered</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Courier Service
                </label>
                <input
                  type="text"
                  list="dispatch-courier-suggestions"
                  value={orderCourierName}
                  onChange={(e) => setOrderCourierName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Booking / Tracking No
                  </label>
                  <input
                    type="text"
                    value={orderTrackingNo}
                    onChange={(e) => setOrderTrackingNo(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Cartons
                  </label>
                  <input
                    type="text"
                    value={orderCartons}
                    onChange={(e) => setOrderCartons(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingOrder(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs cursor-pointer"
                >
                  Save Order Dispatch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Updated Invoice Preview Modal */}
      {previewInvoice && (
        <InvoiceReceiptModal
          invoice={previewInvoice}
          customer={wholesalers.find((w) => w.id === previewInvoice.wholesalerId) || null}
          currentUser={currentUser}
          brandName={brandName}
          brandShortName={brandShortName}
          storeName={storeName}
          logoUrl={logoUrl}
          address={address}
          phone={phone}
          companyEmail={companyEmail}
          companyWebsite={companyWebsite}
          onClose={() => setPreviewInvoice(null)}
          onUpdateInvoiceSignature={(updated) => {
            onUpdateInvoice(updated);
            setPreviewInvoice(updated);
          }}
        />
      )}
    </div>
  );
};
