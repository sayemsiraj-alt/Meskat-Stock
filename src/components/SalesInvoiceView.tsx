import React, { useState, useMemo, useEffect } from 'react';
import {
  CustomerOrder,
  CustomerReturn,
  DEFAULT_WAREHOUSES,
  Invoice,
  InvoiceItem,
  SalesRep,
  StockItem,
  SystemUser,
  Wholesaler,
} from '../data/mockData';
import { 
  Printer, 
  Plus, 
  Trash2, 
  ShoppingCart, 
  ArrowRight, 
  Receipt, 
  FileText, 
  Edit, 
  MessageSquare,
  Package,
  RotateCcw,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import { CompanyLogo } from './CompanyLogo';
import { InvoiceReceiptModal } from './InvoiceReceiptModal';
import { BarcodeScannerInput } from './BarcodeLabelModal';
import { getLocalYYYYMMDD, extractYYYYMMDD, formatDDMMYY } from '../utils/dateUtils';
import { numberToEnglishWords, formatTkAmount } from '../utils/numberToWords';
import {
  evaluateCreditLimit,
  getCourierTrackingUrl,
  resolveWholesaleUnitPrice,
} from '../utils/erpEnhancements';
import {
  formatCompanyContactSuffix,
  resolveAuthorizedSignatureInfo,
  sendInvoicePdfToWhatsApp,
} from '../utils/printAndDownload';

interface SalesInvoiceViewProps {
  items: StockItem[];
  wholesalers: Wholesaler[];
  invoices: Invoice[];
  customerOrders: CustomerOrder[];
  customerReturns: CustomerReturn[];
  salesReps?: SalesRep[];
  warehouses?: string[];
  enforceCreditLimit?: boolean;
  currency: string;
  systemDate?: string;
  onAddInvoice: (inv: Omit<Invoice, 'id'>) => Invoice;
  onUpdateInvoice: (inv: Invoice) => void;
  onDeleteInvoice: (id: string) => void;
  onUpdateCustomerOrder: (ord: CustomerOrder) => void;
  onResolveCustomerReturn: (retId: string, decision: 'Approved' | 'Rejected') => void;
  searchQuery: string;
  storeName: string;
  brandName: string;
  brandShortName: string;
  logoUrl?: string;
  address: string;
  phone: string;
  companyEmail?: string;
  companyWebsite?: string;
  pendingOrderToLoad?: CustomerOrder | null;
  onConsumeOrderToLoad?: () => void;
  currentUser?: SystemUser;
}

interface DraftInvoiceRow {
  rowKey: string;
  itemId: string;
  itemName: string;
  packSize: string;
  batchNo: string;
  mfgDate: string;
  expiryDate: string;
  retailPrice: number | '';
  unitPrice: number | '';
  quantity: number | '';
  bonusQty: number | '';
  priceOverridden?: boolean;
  pricingBadge?: string;
}

const createEmptyDraftRow = (): DraftInvoiceRow => ({
  rowKey: `ROW-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
  itemId: '',
  itemName: '',
  packSize: '',
  batchNo: '',
  mfgDate: '',
  expiryDate: '',
  retailPrice: '',
  unitPrice: '',
  quantity: '',
  bonusQty: 0,
  priceOverridden: false,
  pricingBadge: '',
});

export const SalesInvoiceView: React.FC<SalesInvoiceViewProps> = ({
  items,
  wholesalers,
  invoices,
  customerOrders,
  customerReturns,
  salesReps = [],
  warehouses = DEFAULT_WAREHOUSES,
  currency,
  systemDate,
  onAddInvoice,
  onUpdateInvoice,
  onDeleteInvoice,
  onUpdateCustomerOrder,
  onResolveCustomerReturn,
  searchQuery,
  storeName,
  brandName,
  brandShortName,
  logoUrl,
  address,
  phone,
  companyEmail,
  companyWebsite,
  pendingOrderToLoad,
  onConsumeOrderToLoad,
  currentUser
}) => {
  const companyContactSuffix = formatCompanyContactSuffix(companyEmail, companyWebsite);
  const warehouseList = warehouses && warehouses.length > 0 ? warehouses : DEFAULT_WAREHOUSES;
  const [view, setView] = useState<'create' | 'history' | 'buyer-orders' | 'returns'>('create');
  const [linkedOrderId, setLinkedOrderId] = useState<string>('');

  // Auto-generate next Invoice / Chalan Number
  const defaultInvoiceNumber = useMemo(() => {
    const nextSeq = 2500020 + invoices.length + 1;
    return String(nextSeq);
  }, [invoices.length]);

  // Create Chalan State (WYSIWYG Invoice Builder)
  const [customInvoiceNo, setCustomInvoiceNo] = useState<string>('');
  const [selectedWholesalerId, setSelectedWholesalerId] = useState<string>('');
  const [selectedSalesRepId, setSelectedSalesRepId] = useState<string>('');
  const [selectedWarehouseName, setSelectedWarehouseName] = useState<string>(warehouseList[0] || 'Main Warehouse');
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'bKash' | 'Nagad' | 'Card'>('Cash');
  const [orderDate, setOrderDate] = useState<string>(systemDate || getLocalYYYYMMDD());
  const [deliveryDate, setDeliveryDate] = useState<string>(systemDate || getLocalYYYYMMDD());
  const [draftRows, setDraftRows] = useState<DraftInvoiceRow[]>(() => [createEmptyDraftRow()]);
  const [paidAmount, setPaidAmount] = useState<number | ''>('');
  const [notes, setNotes] = useState<string>('');
  const [formError, setFormError] = useState<string>('');

  // Invoice Preview / Print Modal State
  const [activeInvoice, setActiveInvoice] = useState<Invoice | null>(null);
  const [activeInvoiceLayout, setActiveInvoiceLayout] = useState<'a4' | 'thermal'>('a4');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<'all' | 'Paid' | 'due'>('all');
  const [historyPrintLayout, setHistoryPrintLayout] = useState<'a4' | 'thermal'>('a4');
  const [sharingHistoryId, setSharingHistoryId] = useState<string | null>(null);

  const openInvoicePrintPreview = (inv: Invoice, layout: 'a4' | 'thermal' = historyPrintLayout) => {
    setActiveInvoiceLayout(layout);
    setActiveInvoice(inv);
  };

  const handleSendHistoryWhatsAppPdf = async (inv: Invoice) => {
    if (sharingHistoryId) return;
    setSharingHistoryId(inv.id);
    try {
      const buyer = wholesalers.find((w) => w.id === inv.wholesalerId) || null;
      await sendInvoicePdfToWhatsApp({
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
        paperLayout: historyPrintLayout,
      });
    } finally {
      setSharingHistoryId(null);
    }
  };

  // Edit Modal State
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [editWholesalerId, setEditWholesalerId] = useState<string>('');
  const [editOrderDate, setEditOrderDate] = useState<string>('');
  const [editDeliveryDate, setEditDeliveryDate] = useState<string>('');
  const [editCart, setEditCart] = useState<InvoiceItem[]>([]);
  const [editPaidAmount, setEditPaidAmount] = useState<number | ''>('');
  const [editCourierName, setEditCourierName] = useState<string>('');
  const [editCourierTrackingNo, setEditCourierTrackingNo] = useState<string>('');
  const [editTotalCartons, setEditTotalCartons] = useState<string>('');
  const [editPaymentNotes, setEditPaymentNotes] = useState<string>('');
  const [editDispatchNotes, setEditDispatchNotes] = useState<string>('');
  const [editSelectedItemId, setEditSelectedItemId] = useState<string>('');
  const [editItemSize, setEditItemSize] = useState<string>('');
  const [editItemBatchNo, setEditItemBatchNo] = useState<string>('');
  const [editItemMfgDate, setEditItemMfgDate] = useState<string>('');
  const [editItemExpDate, setEditItemExpDate] = useState<string>('');
  const [editItemMrp, setEditItemMrp] = useState<number | ''>('');
  const [editItemFlatRate, setEditItemFlatRate] = useState<number | ''>('');
  const [editQty, setEditQty] = useState<number | ''>('');
  const [editBonusQty, setEditBonusQty] = useState<number | ''>(0);
  const [editFormError, setEditFormError] = useState<string>('');

  // Copy share feedback
  const [copied, setCopied] = useState<boolean>(false);

  // Selected Wholesaler & previous due calculation
  const selectedBuyer = useMemo(() => {
    return wholesalers.find(w => w.id === selectedWholesalerId);
  }, [wholesalers, selectedWholesalerId]);

  useEffect(() => {
    if (selectedBuyer?.salesRepId) {
      setSelectedSalesRepId(selectedBuyer.salesRepId);
    }
  }, [selectedBuyer?.id]);

  // Re-evaluate buyer-specific approved or tiered prices whenever selected customer changes
  useEffect(() => {
    setDraftRows((prev) =>
      prev.map((row) => {
        if (!row.itemId || row.priceOverridden) return row;
        const found = items.find((i) => i.id === row.itemId);
        if (!found) return row;
        const qtyNum = Number(row.quantity) || 1;
        const resolved = resolveWholesaleUnitPrice(found, selectedBuyer, qtyNum);
        return {
          ...row,
          unitPrice: resolved.unitPrice,
          pricingBadge:
            resolved.pricingSource === 'approved'
              ? 'Buyer Approved Rate'
              : resolved.pricingSource === 'tier'
              ? `Tier (${resolved.appliedTierMinQty}+)`
              : '',
        };
      })
    );
  }, [selectedBuyer, items]);

  const buyerPreviousDue = selectedBuyer ? Number(selectedBuyer.totalDue || 0) : 0;

  const currentChalanSubTotal = useMemo(() => {
    return draftRows.reduce((sum, row) => {
      if (!row.itemId) return sum;
      const q = Number(row.quantity) || 0;
      const r = Number(row.unitPrice) || 0;
      return sum + q * r;
    }, 0);
  }, [draftRows]);

  const currentGrandTotal = currentChalanSubTotal + buyerPreviousDue;
  const currentPaid = Number(paidAmount) || 0;
  const currentNetDue = Math.max(0, currentGrandTotal - currentPaid);

  const creditLimitCheck = useMemo(() => {
    const netNewDue = Math.max(0, currentChalanSubTotal - currentPaid);
    return evaluateCreditLimit(selectedBuyer, netNewDue);
  }, [selectedBuyer, currentChalanSubTotal, currentPaid]);

  const previewSigInfo = useMemo(
    () =>
      resolveAuthorizedSignatureInfo(
        {
          createdByUserId: currentUser?.userId,
          createdByName: currentUser?.name,
          authorizedSignatureMode: currentUser?.signatureDataUrl ? 'manual' : 'auto',
          authorizedSignerName: currentUser?.name || brandName || storeName,
          authorizedSignerTitle: currentUser?.signatureTitle,
          authorizedSignatureDataUrl: currentUser?.signatureDataUrl,
        },
        brandName || storeName || 'Authorized Signatory',
        currentUser
      ),
    [currentUser, brandName, storeName]
  );

  // When a product is selected in any Invoice table row, auto-fill all product fields
  const handleRowProductChange = (rowKey: string, itemId: string) => {
    setFormError('');
    if (!itemId) {
      setDraftRows((prev) =>
        prev.map((row) =>
          row.rowKey === rowKey ? { ...createEmptyDraftRow(), rowKey } : row
        )
      );
      return;
    }

    const found = items.find((i) => i.id === itemId);
    if (!found) return;

    setDraftRows((prev) =>
      prev.map((row) => {
        if (row.rowKey !== rowKey) return row;
        const nextQty = Number(row.quantity) > 0 ? Number(row.quantity) : 1;
        const resolved = resolveWholesaleUnitPrice(found, selectedBuyer, nextQty);
        return {
          ...row,
          itemId: found.id,
          itemName: found.name,
          packSize: found.packSize || found.unit || '200 ml',
          batchNo: found.batchNo || 'B-01',
          mfgDate: found.mfgDate ? formatDDMMYY(found.mfgDate) : '01/26',
          expiryDate: found.expiryDate ? formatDDMMYY(found.expiryDate) : '01/28',
          retailPrice:
            found.retailPrice ||
            (found.costPrice ? Math.round(found.price * 1.25) : found.price),
          unitPrice: resolved.unitPrice,
          quantity: nextQty,
          priceOverridden: false,
          pricingBadge:
            resolved.pricingSource === 'approved'
              ? 'Buyer Approved Rate'
              : resolved.pricingSource === 'tier'
              ? `Tier (${resolved.appliedTierMinQty}+)`
              : '',
        };
      })
    );
  };

  const handleRowQtyChange = (rowKey: string, rawVal: string) => {
    setFormError('');
    const num = rawVal === '' ? '' : Math.max(0, Number(rawVal));
    setDraftRows((prev) =>
      prev.map((row) => {
        if (row.rowKey !== rowKey) return row;
        const found = row.itemId ? items.find((i) => i.id === row.itemId) : undefined;
        if (found && !row.priceOverridden && typeof num === 'number' && num > 0) {
          const res = resolveWholesaleUnitPrice(found, selectedBuyer, num);
          return {
            ...row,
            quantity: num,
            unitPrice: res.unitPrice,
            pricingBadge:
              res.pricingSource === 'approved'
                ? 'Buyer Approved Rate'
                : res.pricingSource === 'tier'
                ? `Tier (${res.appliedTierMinQty}+)`
                : '',
          };
        }
        return { ...row, quantity: num };
      })
    );
  };

  const handleRowFieldChange = <K extends keyof DraftInvoiceRow>(
    rowKey: string,
    field: K,
    value: DraftInvoiceRow[K]
  ) => {
    setFormError('');
    setDraftRows((prev) =>
      prev.map((row) =>
        row.rowKey === rowKey
          ? {
              ...row,
              [field]: value,
              ...(field === 'unitPrice' ? { priceOverridden: true } : {}),
            }
          : row
      )
    );
  };

  const handleAddDraftRow = () => {
    setDraftRows((prev) => [...prev, createEmptyDraftRow()]);
  };

  const handleRemoveDraftRow = (rowKey: string) => {
    setFormError('');
    setDraftRows((prev) => {
      if (prev.length <= 1) {
        return [createEmptyDraftRow()];
      }
      return prev.filter((r) => r.rowKey !== rowKey);
    });
  };

  const handleBarcodeMatch = (matchedItem: StockItem) => {
    setFormError('');
    const existingRow = draftRows.find((r) => r.itemId === matchedItem.id);
    if (existingRow) {
      const nextQty = (Number(existingRow.quantity) || 0) + 1;
      handleRowQtyChange(existingRow.rowKey, String(nextQty));
      return;
    }

    const emptyRow = draftRows.find((r) => !r.itemId);
    if (emptyRow) {
      handleRowProductChange(emptyRow.rowKey, matchedItem.id);
      return;
    }

    const newRow = createEmptyDraftRow();
    const resolved = resolveWholesaleUnitPrice(matchedItem, selectedBuyer, 1);
    setDraftRows((prev) => [
      ...prev,
      {
        ...newRow,
        itemId: matchedItem.id,
        itemName: matchedItem.name,
        packSize: matchedItem.packSize || matchedItem.unit || '200 ml',
        batchNo: matchedItem.batchNo || 'B-01',
        mfgDate: matchedItem.mfgDate ? formatDDMMYY(matchedItem.mfgDate) : '01/26',
        expiryDate: matchedItem.expiryDate ? formatDDMMYY(matchedItem.expiryDate) : '01/28',
        retailPrice:
          matchedItem.retailPrice ||
          (matchedItem.costPrice ? Math.round(matchedItem.price * 1.25) : matchedItem.price),
        unitPrice: resolved.unitPrice,
        quantity: 1,
        bonusQty: 0,
        priceOverridden: false,
        pricingBadge:
          resolved.pricingSource === 'approved'
            ? 'Buyer Approved Rate'
            : resolved.pricingSource === 'tier'
            ? `Tier (${resolved.appliedTierMinQty}+)`
            : '',
      },
    ]);
  };

  // Complete & Save Chalan
  const handleCheckout = () => {
    if (!selectedWholesalerId) {
      setFormError('অনুগ্রহ করে একজন পাইকারি ক্রেতা নির্বাচন করুন (Select Customer Name)!');
      return;
    }

    const filledRows = draftRows.filter((r) => r.itemId);
    if (filledRows.length === 0) {
      setFormError('চালানে অন্তত একটি পণ্য নির্বাচন করুন (Select Products in Invoice Table)!');
      return;
    }

    const invalidQtyRow = filledRows.find((r) => (Number(r.quantity) || 0) <= 0);
    if (invalidQtyRow) {
      setFormError(`"${invalidQtyRow.itemName}" এর পরিমাণ (Quantity) কমপক্ষে 1 দিন!`);
      return;
    }

    // Validate stock availability summing paid qty + free/bonus pcs across duplicate rows
    const qtyByItem = new Map<string, number>();
    for (const r of filledRows) {
      const totalPcs = (Number(r.quantity) || 0) + (Number(r.bonusQty) || 0);
      qtyByItem.set(r.itemId, (qtyByItem.get(r.itemId) || 0) + totalPcs);
    }
    for (const [itemId, totalRequested] of qtyByItem.entries()) {
      const stockItem = items.find((i) => i.id === itemId);
      if (stockItem && totalRequested > stockItem.quantity) {
        setFormError(
          `"${stockItem.name}" এর স্টকে মাত্র ${stockItem.quantity} টি আছে (আপনি Free সহ মোট ${totalRequested} টি দিয়েছেন)!`
        );
        return;
      }
    }

    setFormError('');

    const invoiceItems: InvoiceItem[] = filledRows.map((row) => {
      const stockItem = items.find((i) => i.id === row.itemId);
      const finalQty = Number(row.quantity) || 0;
      const bonusQty = Math.max(0, Number(row.bonusQty) || 0);
      const flatRate =
        row.unitPrice !== '' ? Number(row.unitPrice) : stockItem?.price || 0;
      const mrp =
        row.retailPrice !== ''
          ? Number(row.retailPrice)
          : stockItem?.retailPrice || flatRate;

      return {
        itemId: row.itemId,
        itemName: row.itemName || stockItem?.name || 'Product',
        packSize: row.packSize || stockItem?.packSize || stockItem?.unit || '200 ml',
        batchNo: row.batchNo || stockItem?.batchNo || 'B-01',
        mfgDate:
          row.mfgDate ||
          (stockItem?.mfgDate ? formatDDMMYY(stockItem.mfgDate) : '01/26'),
        expiryDate:
          row.expiryDate ||
          (stockItem?.expiryDate ? formatDDMMYY(stockItem.expiryDate) : '01/28'),
        retailPrice: mrp,
        unitPrice: flatRate,
        quantity: finalQty,
        ...(bonusQty > 0 ? { bonusQty } : {}),
        total: finalQty * flatRate,
      };
    });

    const buyer = wholesalers.find((w) => w.id === selectedWholesalerId);
    const assignedRep = salesReps.find((r) => r.id === selectedSalesRepId);
    const invoiceNumber = customInvoiceNo.trim() || defaultInvoiceNumber;

    const newInvoice: Omit<Invoice, 'id'> = {
      chalanNo: invoiceNumber,
      wholesalerId: selectedWholesalerId,
      wholesalerName: buyer ? buyer.name : 'Unknown Wholesaler',
      customerPhone: buyer ? buyer.phone : '',
      customerAddress: buyer ? buyer.address : '',
      saleType: 'Wholesale',
      items: invoiceItems,
      subTotal: currentChalanSubTotal,
      previousDue: buyerPreviousDue,
      previousDueDate: formatDDMMYY(orderDate),
      grandTotal: currentGrandTotal,
      totalAmount: currentGrandTotal,
      paidAmount: currentPaid,
      dueAmount: currentNetDue,
      paymentMethod,
      date: deliveryDate ? `${deliveryDate}T12:00:00` : new Date().toISOString(),
      orderDate: orderDate ? `${orderDate}T10:00:00` : new Date().toISOString(),
      deliveryDate: deliveryDate ? `${deliveryDate}T12:00:00` : new Date().toISOString(),
      status: currentNetDue <= 0 ? 'Paid' : currentPaid > 0 ? 'Partial' : 'Unpaid',
      courierName: '',
      courierTrackingNo: '',
      totalCartons: '',
      notes: notes.trim(),
      salesRepId: assignedRep?.id || buyer?.salesRepId,
      salesRepName: assignedRep?.name || buyer?.salesRepName,
      warehouseName: selectedWarehouseName,
      createdByUserId: currentUser?.userId,
      createdByName: currentUser?.name,
      authorizedSignatureMode: currentUser?.signatureDataUrl ? 'manual' : 'auto',
      authorizedSignerName: currentUser?.name || brandName || storeName,
      authorizedSignerTitle: currentUser?.signatureTitle,
      authorizedSignatureDataUrl: currentUser?.signatureDataUrl,
    };

    const createdInvoice = onAddInvoice(newInvoice);

    if (linkedOrderId) {
      const matchedOrder = customerOrders.find((o) => o.id === linkedOrderId);
      if (matchedOrder) {
        onUpdateCustomerOrder({
          ...matchedOrder,
          status: 'Dispatched',
          linkedInvoiceId: createdInvoice.id,
          linkedChalanNo: createdInvoice.chalanNo,
          updatedAt: new Date().toISOString(),
        });
      }
      setLinkedOrderId('');
    }

    setActiveInvoice(createdInvoice);

    // Reset Form for next invoice
    setDraftRows([createEmptyDraftRow()]);
    setPaidAmount('');
    setNotes('');
    setCustomInvoiceNo('');
  };

  const handleLoadOrderIntoCreateForm = (ord: CustomerOrder) => {
    setSelectedWholesalerId(ord.wholesalerId);
    setDraftRows(
      ord.items.length > 0
        ? ord.items.map((it, i) => ({
            rowKey: `ORD-ROW-${i}-${Date.now()}`,
            itemId: it.itemId,
            itemName: it.itemName,
            packSize: it.packSize || '200 ml',
            batchNo: it.batchNo || 'B-01',
            mfgDate: it.mfgDate || '01/26',
            expiryDate: it.expiryDate || '01/28',
            retailPrice: it.retailPrice ?? it.unitPrice,
            unitPrice: it.unitPrice,
            quantity: it.quantity,
            bonusQty: it.bonusQty || 0,
            priceOverridden: true,
          }))
        : [createEmptyDraftRow()]
    );
    setOrderDate(extractYYYYMMDD(ord.createdAt));
    setDeliveryDate(systemDate || getLocalYYYYMMDD());
    setPaidAmount(ord.advanceSubmitted || '');
    setNotes(ord.notes || `Converted from Portal Order ${ord.orderNo}`);
    setLinkedOrderId(ord.id);
    setView('create');
  };

  useEffect(() => {
    if (pendingOrderToLoad) {
      handleLoadOrderIntoCreateForm(pendingOrderToLoad);
      onConsumeOrderToLoad?.();
    }
  }, [pendingOrderToLoad]);

  // Open Edit Chalan Modal
  const handleOpenEditModal = (inv: Invoice) => {
    setEditingInvoice(inv);
    setEditWholesalerId(inv.wholesalerId);
    setEditOrderDate(inv.orderDate ? extractYYYYMMDD(inv.orderDate) : extractYYYYMMDD(inv.date));
    setEditDeliveryDate(inv.deliveryDate ? extractYYYYMMDD(inv.deliveryDate) : extractYYYYMMDD(inv.date));
    setEditCart([...inv.items]);
    setEditPaidAmount(inv.paidAmount || '');
    setEditCourierName(inv.courierName || '');
    setEditCourierTrackingNo(inv.courierTrackingNo || '');
    setEditTotalCartons(typeof inv.totalCartons === 'string' ? inv.totalCartons : (inv.totalCartons ? `${inv.totalCartons} টি` : ''));
    setEditPaymentNotes(inv.paymentBreakdownNotes || '');
    setEditDispatchNotes(inv.dispatchBreakdownNotes || '');
    setEditSelectedItemId('');
    setEditQty('');
    setEditBonusQty(0);
  };

  const handleEditProductSelectionChange = (itemId: string) => {
    setEditSelectedItemId(itemId);
    if (!itemId) {
      setEditItemSize('');
      setEditItemBatchNo('');
      setEditItemMfgDate('');
      setEditItemExpDate('');
      setEditItemMrp('');
      setEditItemFlatRate('');
      return;
    }
    const found = items.find(i => i.id === itemId);
    if (found) {
      setEditItemSize(found.packSize || found.unit || '200 ml');
      setEditItemBatchNo(found.batchNo || 'B-01');
      setEditItemMfgDate(found.mfgDate ? formatDDMMYY(found.mfgDate) : '01/26');
      setEditItemExpDate(found.expiryDate ? formatDDMMYY(found.expiryDate) : '01/28');
      setEditItemMrp(found.retailPrice || (found.costPrice ? Math.round(found.price * 1.25) : found.price));
      setEditItemFlatRate(found.price);
    }
  };

  const handleAddEditItem = (e: React.FormEvent) => {
    e.preventDefault();
    const finalQty = Number(editQty);
    const finalBonus = Math.max(0, Number(editBonusQty) || 0);
    if (!editSelectedItemId || finalQty <= 0) return;

    const item = items.find(i => i.id === editSelectedItemId);
    if (!item) return;

    const flatRate = editItemFlatRate !== '' ? Number(editItemFlatRate) : item.price;
    const mrp = editItemMrp !== '' ? Number(editItemMrp) : (item.retailPrice || flatRate);
    const size = editItemSize || item.packSize || item.unit || '200 ml';
    const batch = editItemBatchNo || item.batchNo || 'B-01';
    const mfg = editItemMfgDate || (item.mfgDate ? formatDDMMYY(item.mfgDate) : '01/26');
    const exp = editItemExpDate || (item.expiryDate ? formatDDMMYY(item.expiryDate) : '01/28');

    const existing = editCart.find(c => c.itemId === editSelectedItemId);
    if (existing) {
      const newQty = existing.quantity + finalQty;
      const newBonus = (existing.bonusQty || 0) + finalBonus;
      setEditCart(editCart.map(c => c.itemId === editSelectedItemId ? { 
        ...c, 
        quantity: newQty, 
        ...(newBonus > 0 ? { bonusQty: newBonus } : {}),
        total: newQty * c.unitPrice,
        retailPrice: mrp,
        packSize: size,
        batchNo: batch,
        mfgDate: mfg,
        expiryDate: exp
      } : c));
    } else {
      setEditCart([...editCart, {
        itemId: item.id,
        itemName: item.name,
        packSize: size,
        batchNo: batch,
        mfgDate: mfg,
        expiryDate: exp,
        retailPrice: mrp,
        unitPrice: flatRate,
        quantity: finalQty,
        ...(finalBonus > 0 ? { bonusQty: finalBonus } : {}),
        total: finalQty * flatRate
      }]);
    }

    setEditSelectedItemId('');
    setEditItemSize('');
    setEditItemBatchNo('');
    setEditItemMfgDate('');
    setEditItemExpDate('');
    setEditItemMrp('');
    setEditItemFlatRate('');
    setEditQty('');
    setEditBonusQty(0);
  };

  const handleSaveEditInvoice = () => {
    if (!editingInvoice) return;
    if (editCart.length === 0) {
      setEditFormError('Invoice must contain at least one product.');
      return;
    }
    setEditFormError('');

    const editSubTotal = editCart.reduce((sum, it) => sum + it.total, 0);
    const editPrevDue = editingInvoice.previousDue || 0;
    const editGrandTotal = editSubTotal + editPrevDue;
    const finalPaid = Number(editPaidAmount) || 0;
    const finalDue = Math.max(0, editGrandTotal - finalPaid);

    const updated: Invoice = {
      ...editingInvoice,
      wholesalerId: editWholesalerId || editingInvoice.wholesalerId,
      items: editCart,
      subTotal: editSubTotal,
      previousDue: editPrevDue,
      grandTotal: editGrandTotal,
      totalAmount: editGrandTotal,
      paidAmount: finalPaid,
      dueAmount: finalDue,
      orderDate: editOrderDate ? `${editOrderDate}T10:00:00` : editingInvoice.orderDate,
      deliveryDate: editDeliveryDate ? `${editDeliveryDate}T12:00:00` : editingInvoice.deliveryDate,
      date: editDeliveryDate ? `${editDeliveryDate}T12:00:00` : editingInvoice.date,
      courierName: editCourierName,
      courierTrackingNo: editCourierTrackingNo,
      totalCartons: editTotalCartons,
      paymentBreakdownNotes: editPaymentNotes,
      dispatchBreakdownNotes: editDispatchNotes,
      status: finalDue <= 0 ? 'Paid' : finalPaid > 0 ? 'Partial' : 'Unpaid'
    };

    onUpdateInvoice(updated);
    setEditingInvoice(null);
  };

  // Copy share summary
  const handleCopySummary = (inv: Invoice) => {
    const bill = inv.subTotal || inv.items.reduce((s, it) => s + it.total, 0);
    const companyTitle = (brandName || storeName || 'INVOICE').toUpperCase();
    const text = `*${companyTitle} - INVOICE*
Invoice No: ${inv.chalanNo}
Order Date: ${formatDDMMYY(inv.orderDate || inv.date)}
Delivery Date: ${formatDDMMYY(inv.deliveryDate || inv.date)}
Customer: ${inv.wholesalerName}
Phone: ${inv.customerPhone || 'N/A'}
Address: ${inv.customerAddress || 'N/A'}
Courier: ${inv.courierName || 'Sundarban Courier Service'} ${inv.courierTrackingNo ? `(Trk: ${inv.courierTrackingNo})` : ''} [${inv.totalCartons || '1 Carton'}]
-----------------------------
Items:
${inv.items.map((it, i) => `${String(i + 1).padStart(2, '0')}. ${it.itemName} (${it.packSize || '200 ml'}) x ${it.quantity} @ ${it.unitPrice}/= = ${it.total}/=`).join('\n')}
-----------------------------
Amount: ${formatTkAmount(bill)}
Previous Due: ${formatTkAmount(inv.previousDue || 0)}
Total Amount: ${formatTkAmount(inv.grandTotal || inv.totalAmount)}
Advance Payment: ${formatTkAmount(inv.paidAmount)}
Total Due: ${formatTkAmount(inv.dueAmount)}
-----------------------------
Address: ${address || 'Dhaka, Bangladesh'}${phone ? ` | Phone: ${phone}` : ''}`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Filtered Invoices for History
  const filteredInvoices = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return invoices.filter(inv => {
      const matchesStatus =
        historyStatusFilter === 'all'
          ? true
          : historyStatusFilter === 'Paid'
          ? inv.status === 'Paid'
          : inv.status !== 'Paid';
      if (!matchesStatus) return false;
      if (!q) return true;
      return (
        inv.chalanNo.toLowerCase().includes(q) ||
        inv.wholesalerName.toLowerCase().includes(q) ||
        (inv.courierName && inv.courierName.toLowerCase().includes(q)) ||
        (inv.courierTrackingNo && inv.courierTrackingNo.toLowerCase().includes(q)) ||
        (inv.customerPhone && inv.customerPhone.includes(q))
      );
    });
  }, [invoices, searchQuery, historyStatusFilter]);

  const activeCustomer = useMemo(() => {
    if (!activeInvoice) return null;
    return wholesalers.find(w => w.id === activeInvoice.wholesalerId);
  }, [activeInvoice, wholesalers]);

  const pendingOrdersCount = customerOrders.filter(o => o.status === 'Pending Approval').length;
  const pendingReturnsCount = customerReturns.filter(r => r.status === 'Requested').length;

  return (
    <div className="space-y-6">
      
      {/* View Switcher Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-2.5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setView('create')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition cursor-pointer ${
              view === 'create'
                ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 shadow-md font-extrabold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Create Invoice / Chalan (চালান তৈরি)</span>
          </button>

          <button
            onClick={() => setView('history')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition cursor-pointer ${
              view === 'history'
                ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 shadow-md font-extrabold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Invoice History & Records ({invoices.length})</span>
          </button>

          <button
            onClick={() => setView('buyer-orders')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition cursor-pointer ${
              view === 'buyer-orders'
                ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 shadow-md font-extrabold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Buyer Portal Orders ({customerOrders.length})</span>
            {pendingOrdersCount > 0 && (
              <span className="px-1.5 py-0.5 bg-amber-500 text-slate-950 rounded-md text-[10px] font-black">
                {pendingOrdersCount} New
              </span>
            )}
          </button>

          <button
            onClick={() => setView('returns')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition cursor-pointer ${
              view === 'returns'
                ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 shadow-md font-extrabold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <RotateCcw className="w-4 h-4" />
            <span>Return Requests ({customerReturns.length})</span>
            {pendingReturnsCount > 0 && (
              <span className="px-1.5 py-0.5 bg-rose-500 text-white rounded-md text-[10px] font-black">
                {pendingReturnsCount}
              </span>
            )}
          </button>
        </div>

        <div className="text-xs font-semibold text-slate-500 px-3 py-1 flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-emerald-600" />
          <span>Working Date: {formatDDMMYY(systemDate || orderDate)}</span>
        </div>
      </div>

      {/* --- WYSIWYG INVOICE-STYLE CREATE CHALAN SHEET --- */}
      {view === 'create' && (
        <div className="max-w-5xl mx-auto space-y-4">
          {/* Operational Controls Strip (Barcode, Warehouse, SR, Payment Method) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-3 sm:p-4 grid grid-cols-1 md:grid-cols-12 gap-3 items-end shadow-2xs">
            <div className="md:col-span-5">
              <BarcodeScannerInput
                items={items.filter((i) => i.quantity > 0)}
                onMatchItem={handleBarcodeMatch}
                compact
              />
            </div>
            <div className="md:col-span-3">
              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                Dispatch Warehouse
              </label>
              <select
                value={selectedWarehouseName}
                onChange={(e) => setSelectedWarehouseName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs text-slate-800 font-bold"
              >
                {warehouseList.map((wh) => (
                  <option key={wh} value={wh}>
                    {wh}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                Sales Rep (SR)
              </label>
              <select
                value={selectedSalesRepId}
                onChange={(e) => setSelectedSalesRepId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs text-slate-800 font-bold"
              >
                <option value="">Direct Sale</option>
                {salesReps
                  .filter((r) => r.status === 'Active')
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) =>
                  setPaymentMethod(
                    e.target.value as 'Cash' | 'bKash' | 'Nagad' | 'Card'
                  )
                }
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs text-slate-800 font-bold"
              >
                <option value="Cash">Cash</option>
                <option value="bKash">bKash</option>
                <option value="Nagad">Nagad</option>
                <option value="Card">Card / Bank</option>
              </select>
            </div>
          </div>

          {/* Interactive Invoice Sheet */}
          <div className="bg-white text-slate-900 p-3.5 sm:p-8 border-2 border-slate-400 rounded-lg shadow-sm relative overflow-hidden font-sans text-xs">
            {/* Watermark */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt=""
                  className="w-72 h-72 sm:w-80 sm:h-80 object-contain opacity-[0.08] rounded-full"
                />
              ) : (
                <div className="w-64 h-64 rounded-full border-[6px] border-emerald-700/15 flex items-center justify-center opacity-[0.1]">
                  <span className="text-5xl font-serif font-black text-emerald-800 tracking-wider">
                    {brandShortName || 'Dear'}
                  </span>
                </div>
              )}
            </div>

            <div className="relative z-10 space-y-4">
              {/* 1. Company Header Box */}
              <div className="border border-slate-400 p-3 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white/70">
                <div className="shrink-0 flex flex-col items-center sm:items-start pl-2">
                  <CompanyLogo
                    className="w-14 h-14"
                    shortName={brandShortName || 'ERP'}
                    logoUrl={logoUrl}
                  />
                  <span className="text-emerald-700 font-extrabold text-base tracking-wider mt-1">
                    {brandShortName || 'ERP'}
                  </span>
                </div>

                <div className="text-center sm:text-left flex-1 sm:pl-6 border-t sm:border-t-0 sm:border-l border-slate-300 pt-2 sm:pt-0">
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-emerald-700 tracking-wider font-serif uppercase">
                    {brandName || storeName || 'STOCK ERP'}
                  </h1>
                  <div className="mt-1 text-xs">
                    <span className="font-bold text-red-600">Head Office :-</span>
                    <span className="text-sky-600 font-semibold ml-1">
                      {address || 'Dhaka, Bangladesh'}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] text-sky-700 font-medium flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <span className="font-bold">
                      Phone :- {phone || '+880 1700-000000'}
                    </span>
                    {companyContactSuffix && (
                      <>
                        <span>|</span>
                        <span className="font-semibold">
                          {companyContactSuffix}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* 2. Invoice Meta & Interactive Customer Details */}
              <div className="space-y-2.5 text-xs text-slate-900">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center font-bold">
                  <div className="flex items-center gap-2">
                    <span className="shrink-0">Invoice No :-</span>
                    <input
                      type="text"
                      value={customInvoiceNo}
                      onChange={(e) => setCustomInvoiceNo(e.target.value)}
                      placeholder={defaultInvoiceNumber}
                      aria-label="Invoice Number"
                      className="w-32 bg-slate-50/90 border border-slate-300 rounded-md px-2 py-1 text-xs font-mono font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="flex items-center sm:justify-center gap-2">
                    <span className="shrink-0">Order date :-</span>
                    <input
                      type="date"
                      value={orderDate}
                      onChange={(e) => setOrderDate(e.target.value)}
                      aria-label="Order Date"
                      className="bg-slate-50/90 border border-slate-300 rounded-md px-2 py-1 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="flex items-center sm:justify-end gap-2">
                    <span className="shrink-0">Delivery date :-</span>
                    <input
                      type="date"
                      value={deliveryDate}
                      onChange={(e) => setDeliveryDate(e.target.value)}
                      aria-label="Delivery Date"
                      className="bg-slate-50/90 border border-slate-300 rounded-md px-2 py-1 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center font-bold pt-1">
                  <div className="sm:col-span-7 flex items-center gap-2">
                    <span className="shrink-0">Customer Name :-</span>
                    <select
                      value={selectedWholesalerId}
                      onChange={(e) => {
                        setFormError('');
                        setSelectedWholesalerId(e.target.value);
                      }}
                      aria-label="Customer Name"
                      className="flex-1 min-w-0 bg-emerald-50/60 border border-emerald-400 rounded-md px-2.5 py-1.5 text-xs font-extrabold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                    >
                      <option value="">-- Click to Select Customer (ক্রেতা নির্বাচন করুন) --</option>
                      {wholesalers.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                          {w.shopName ? ` (${w.shopName})` : ''} — Due: {currency}
                          {Number(w.totalDue || 0).toLocaleString()}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-5 flex items-center sm:justify-end gap-2">
                    <span className="shrink-0">Mobile Number :-</span>
                    <span className="font-mono font-bold text-slate-900 bg-slate-50/90 border border-slate-200 rounded-md px-2.5 py-1 min-w-[140px]">
                      {selectedBuyer?.phone || 'Auto-filled on select'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 font-bold">
                  <span className="shrink-0">Customer Address :-</span>
                  <span className="font-semibold text-slate-800 bg-slate-50/90 border border-slate-200 rounded-md px-2.5 py-1 flex-1">
                    {selectedBuyer?.address || 'Customer address appears automatically when selected'}
                  </span>
                </div>
              </div>

              {/* 3. Interactive Multi-Product 10-Column Invoice Table */}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse border border-slate-400 text-xs bg-white/80">
                  <thead>
                    <tr className="border-b border-slate-400 text-[11px] font-bold text-slate-800 bg-slate-50">
                      <th className="border-r border-slate-400 px-1.5 py-2 text-center w-9 whitespace-nowrap">
                        No
                      </th>
                      <th className="border-r border-slate-400 px-2 py-2 text-left min-w-[190px]">
                        Product Name
                      </th>
                      <th className="border-r border-slate-400 px-1.5 py-2 text-center w-20 whitespace-nowrap">
                        Size
                      </th>
                      <th className="border-r border-slate-400 px-1.5 py-2 text-center w-20 whitespace-nowrap">
                        Bth No
                      </th>
                      <th className="border-r border-slate-400 px-1.5 py-2 text-center w-20 whitespace-nowrap">
                        Mfg Date
                      </th>
                      <th className="border-r border-slate-400 px-1.5 py-2 text-center w-20 whitespace-nowrap">
                        Exp Date
                      </th>
                      <th className="border-r border-slate-400 px-1.5 py-2 text-right w-16 whitespace-nowrap">
                        M.R.P
                      </th>
                      <th className="border-r border-slate-400 px-1.5 py-2 text-right w-20 whitespace-nowrap">
                        Flat rate
                      </th>
                      <th className="border-r border-slate-400 px-1.5 py-2 text-center w-20 whitespace-nowrap">
                        P: quantity
                      </th>
                      <th className="border-r border-slate-400 px-1.5 py-2 text-center w-16 whitespace-nowrap text-emerald-800">
                        Free
                      </th>
                      <th className="border-r border-slate-400 px-2 py-2 text-right w-28 whitespace-nowrap">
                        Amount Tk
                      </th>
                      <th className="px-1.5 py-2 text-center w-10 whitespace-nowrap">
                        Del
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {draftRows.map((row, idx) => {
                      const matchedStock = row.itemId
                        ? items.find((i) => i.id === row.itemId)
                        : undefined;
                      const rowTotal =
                        (Number(row.quantity) || 0) * (Number(row.unitPrice) || 0);
                      const rowExceedsStock =
                        matchedStock &&
                        (Number(row.quantity) || 0) + (Number(row.bonusQty) || 0) >
                          matchedStock.quantity;

                      return (
                        <tr
                          key={row.rowKey}
                          className="border-b border-slate-400 hover:bg-emerald-50/30"
                        >
                          <td className="border-r border-slate-400 px-1.5 py-1.5 text-center font-mono font-bold text-slate-600 tabular-nums">
                            {String(idx + 1).padStart(2, '0')}
                          </td>
                          <td className="border-r border-slate-400 px-1.5 py-1.5">
                            <select
                              value={row.itemId}
                              onChange={(e) =>
                                handleRowProductChange(row.rowKey, e.target.value)
                              }
                              aria-label={`Row ${idx + 1} Product Name`}
                              className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                            >
                              <option value="">-- Click to Select Product --</option>
                              {items
                                .filter((i) => i.quantity > 0 || i.id === row.itemId)
                                .map((i) => (
                                  <option key={i.id} value={i.id}>
                                    {i.name} [{i.packSize || i.unit || '200 ml'}] (Stock:{' '}
                                    {i.quantity}) - {currency}
                                    {i.price}
                                  </option>
                                ))}
                            </select>
                            {row.pricingBadge && (
                              <span className="text-[10px] font-bold text-emerald-700 block mt-0.5">
                                {row.pricingBadge}
                              </span>
                            )}
                            {rowExceedsStock && (
                              <span className="text-[10px] font-bold text-rose-600 block mt-0.5">
                                Max stock: {matchedStock.quantity}
                              </span>
                            )}
                          </td>
                          <td className="border-r border-slate-400 px-1 py-1.5">
                            <input
                              type="text"
                              value={row.packSize}
                              onChange={(e) =>
                                handleRowFieldChange(row.rowKey, 'packSize', e.target.value)
                              }
                              placeholder="Size"
                              aria-label={`Row ${idx + 1} Size`}
                              className="w-full text-center bg-transparent border border-transparent focus:border-slate-300 focus:bg-white rounded px-1 py-1 text-xs text-slate-800 focus:outline-none"
                            />
                          </td>
                          <td className="border-r border-slate-400 px-1 py-1.5">
                            <input
                              type="text"
                              value={row.batchNo}
                              onChange={(e) =>
                                handleRowFieldChange(row.rowKey, 'batchNo', e.target.value)
                              }
                              placeholder="Batch"
                              aria-label={`Row ${idx + 1} Batch No`}
                              className="w-full text-center font-mono bg-transparent border border-transparent focus:border-slate-300 focus:bg-white rounded px-1 py-1 text-xs text-slate-800 focus:outline-none"
                            />
                          </td>
                          <td className="border-r border-slate-400 px-1 py-1.5">
                            <input
                              type="text"
                              value={row.mfgDate}
                              onChange={(e) =>
                                handleRowFieldChange(row.rowKey, 'mfgDate', e.target.value)
                              }
                              placeholder="01/26"
                              aria-label={`Row ${idx + 1} Mfg Date`}
                              className="w-full text-center font-mono bg-transparent border border-transparent focus:border-slate-300 focus:bg-white rounded px-1 py-1 text-xs text-slate-800 focus:outline-none"
                            />
                          </td>
                          <td className="border-r border-slate-400 px-1 py-1.5">
                            <input
                              type="text"
                              value={row.expiryDate}
                              onChange={(e) =>
                                handleRowFieldChange(row.rowKey, 'expiryDate', e.target.value)
                              }
                              placeholder="01/28"
                              aria-label={`Row ${idx + 1} Exp Date`}
                              className="w-full text-center font-mono bg-transparent border border-transparent focus:border-slate-300 focus:bg-white rounded px-1 py-1 text-xs text-slate-800 focus:outline-none"
                            />
                          </td>
                          <td className="border-r border-slate-400 px-1 py-1.5">
                            <input
                              type="number"
                              min="0"
                              value={row.retailPrice}
                              onChange={(e) =>
                                handleRowFieldChange(
                                  row.rowKey,
                                  'retailPrice',
                                  e.target.value === '' ? '' : Number(e.target.value)
                                )
                              }
                              placeholder="MRP"
                              aria-label={`Row ${idx + 1} MRP`}
                              className="w-full text-right font-mono tabular-nums bg-transparent border border-transparent focus:border-slate-300 focus:bg-white rounded px-1 py-1 text-xs text-slate-700 focus:outline-none"
                            />
                          </td>
                          <td className="border-r border-slate-400 px-1 py-1.5">
                            <input
                              type="number"
                              min="0"
                              value={row.unitPrice}
                              onChange={(e) =>
                                handleRowFieldChange(
                                  row.rowKey,
                                  'unitPrice',
                                  e.target.value === '' ? '' : Number(e.target.value)
                                )
                              }
                              placeholder="Rate"
                              aria-label={`Row ${idx + 1} Flat Rate`}
                              className="w-full text-right font-mono font-bold tabular-nums bg-slate-50 border border-slate-300 focus:bg-white rounded px-1.5 py-1 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                          </td>
                          <td className="border-r border-slate-400 px-1 py-1.5">
                            <input
                              type="number"
                              min="1"
                              value={row.quantity}
                              onChange={(e) =>
                                handleRowQtyChange(row.rowKey, e.target.value)
                              }
                              placeholder="Qty"
                              aria-label={`Row ${idx + 1} Quantity`}
                              className="w-full text-center font-mono font-black tabular-nums bg-slate-50 border border-slate-300 focus:bg-white rounded px-1.5 py-1 text-xs text-slate-950 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                          </td>
                          <td className="border-r border-slate-400 px-1 py-1.5">
                            <input
                              type="number"
                              min="0"
                              value={row.bonusQty}
                              onChange={(e) =>
                                handleRowFieldChange(
                                  row.rowKey,
                                  'bonusQty',
                                  e.target.value === '' ? '' : Number(e.target.value)
                                )
                              }
                              placeholder="0"
                              aria-label={`Row ${idx + 1} Free Bonus Qty`}
                              className="w-full text-center font-mono font-bold tabular-nums bg-emerald-50/70 border border-emerald-300 focus:bg-white rounded px-1 py-1 text-xs text-emerald-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                          </td>
                          <td className="border-r border-slate-400 px-2 py-1.5 text-right font-mono font-black tabular-nums text-slate-950 whitespace-nowrap">
                            {row.itemId ? formatTkAmount(rowTotal) : '0/='}
                          </td>
                          <td className="px-1.5 py-1.5 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveDraftRow(row.rowKey)}
                              aria-label={`Remove Row ${idx + 1}`}
                              className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}

                    {/* Add Product Row Button Row */}
                    <tr className="border-b border-slate-400 bg-emerald-50/40">
                      <td colSpan={12} className="p-2 text-left">
                        <button
                          type="button"
                          onClick={handleAddDraftRow}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-lg text-xs transition cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>+ Add Product Row ({draftRows.length} rows)</span>
                        </button>
                      </td>
                    </tr>

                    {/* Invoice Totals Footer Rows */}
                    <tr className="border-b border-slate-400 font-bold">
                      <td
                        colSpan={10}
                        className="border-r border-slate-400 p-1.5 text-right font-bold pr-3"
                      >
                        Amount
                      </td>
                      <td
                        colSpan={2}
                        className="p-1.5 text-right font-mono font-black tabular-nums text-slate-900"
                      >
                        {formatTkAmount(currentChalanSubTotal)}
                      </td>
                    </tr>

                    <tr className="border-b border-slate-400 font-bold">
                      <td
                        colSpan={10}
                        className="border-r border-slate-400 p-1.5 text-right font-bold pr-3"
                      >
                        {formatDDMMYY(orderDate)} Previous Due Amount
                      </td>
                      <td
                        colSpan={2}
                        className="p-1.5 text-right font-mono font-black tabular-nums text-amber-700"
                      >
                        {formatTkAmount(buyerPreviousDue)}
                      </td>
                    </tr>

                    <tr className="border-b border-slate-400 font-bold">
                      <td
                        colSpan={10}
                        className="border-r border-slate-400 p-1.5 text-right font-bold pr-3"
                      >
                        Total Amount
                      </td>
                      <td
                        colSpan={2}
                        className="p-1.5 text-right font-mono font-black tabular-nums text-slate-900"
                      >
                        {formatTkAmount(currentGrandTotal)}
                      </td>
                    </tr>

                    <tr className="border-b border-slate-400 font-bold">
                      <td
                        colSpan={10}
                        className="border-r border-slate-400 p-1.5 text-right font-bold pr-3"
                      >
                        Total Advance payment ({paymentMethod})
                      </td>
                      <td colSpan={2} className="p-1 text-right">
                        <input
                          type="number"
                          min="0"
                          value={paidAmount}
                          onChange={(e) =>
                            setPaidAmount(
                              e.target.value === '' ? '' : Number(e.target.value)
                            )
                          }
                          placeholder="0"
                          aria-label="Total Advance Payment"
                          className="w-full text-right font-mono font-black tabular-nums bg-emerald-50 border border-emerald-400 rounded px-2 py-1 text-xs text-emerald-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </td>
                    </tr>

                    <tr className="font-extrabold bg-slate-50">
                      <td
                        colSpan={10}
                        className="border-r border-slate-400 p-2 text-right font-extrabold pr-3"
                      >
                        {formatDDMMYY(deliveryDate)} Total Due
                      </td>
                      <td
                        colSpan={2}
                        className={`p-2 text-right font-mono font-black tabular-nums text-base ${
                          currentNetDue > 0 ? 'text-rose-700' : 'text-emerald-700'
                        }`}
                      >
                        {formatTkAmount(currentNetDue)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Amount In Words */}
              <div className="border border-slate-300 bg-slate-50 px-3 py-2 rounded text-[11px] font-bold text-slate-800">
                <span>In Words (Total Amount): </span>
                <span className="text-emerald-800">
                  {numberToEnglishWords(currentGrandTotal)}
                </span>
              </div>

              {/* Signatures Preview */}
              <div className="flex flex-col sm:flex-row justify-between items-center sm:items-end gap-8 sm:gap-4 pt-6 pb-2 text-xs font-bold text-slate-800">
                <div className="text-center sm:text-left w-full sm:w-auto">
                  <div className="h-10" />
                  <div className="w-44 max-w-full mx-auto sm:mx-0 border-b border-slate-400 mb-1"></div>
                  <span className="text-[11px] whitespace-nowrap">
                    Customer / Receiver Signature
                  </span>
                </div>

                <div className="text-center sm:text-right w-full sm:w-auto">
                  <div className="inline-block text-center">
                    <div className="h-10 flex items-end justify-center pb-1">
                      {previewSigInfo.signatureDataUrl ? (
                        <img
                          src={previewSigInfo.signatureDataUrl}
                          alt="Authorized Signature"
                          className="h-10 max-w-[160px] object-contain"
                        />
                      ) : (
                        <span className="font-serif italic font-bold text-xl text-indigo-900 tracking-wide px-2">
                          {previewSigInfo.signerName}
                        </span>
                      )}
                    </div>
                    <div className="w-48 max-w-full mx-auto border-b border-slate-400 mb-1"></div>
                    <div className="font-bold text-[11px]">
                      Authorized Signature
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Credit Limit Warning & Validation Errors + Save CTA */}
          {creditLimitCheck.hasLimit && creditLimitCheck.exceeds && (
            <div className="p-3 bg-amber-50 border border-amber-300 text-amber-900 rounded-xl text-xs font-bold flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                Credit Limit Warning: Projected balance (
                {formatTkAmount(creditLimitCheck.projectedDue)}) exceeds buyer&apos;s limit (
                {formatTkAmount(creditLimitCheck.creditLimit)}) by{' '}
                {formatTkAmount(creditLimitCheck.excessAmount)}.
              </div>
            </div>
          )}

          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-300 text-rose-800 rounded-xl font-bold text-xs">
              {formError}
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white border border-slate-200 rounded-2xl p-4">
            <div className="text-xs text-slate-600">
              Courier booking &amp; tracking can be managed anytime from the{' '}
              <strong className="text-slate-900">Courier &amp; Dispatch</strong> module.
            </div>
            <button
              type="button"
              onClick={handleCheckout}
              className="bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-slate-950 font-black px-6 py-3 rounded-xl text-sm shadow-md flex justify-center items-center gap-2 transition cursor-pointer whitespace-nowrap"
            >
              <span>Save Invoice &amp; View Print Preview</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* --- INVOICE HISTORY TABLE VIEW --- */}
      {view === 'history' && (
        <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 font-bold text-slate-800 text-sm">
                <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Sales Invoices &amp; Chalans History (চালান ও বিক্রয় হিস্ট্রি)</span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                Showing {filteredInvoices.length} of {invoices.length} invoices • Completed (Paid):{' '}
                {invoices.filter(i => i.status === 'Paid').length}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
              {/* Completion Status Filter */}
              <div className="flex items-center bg-white p-1 rounded-xl border border-slate-200 text-xs font-bold shadow-2xs">
                <button
                  type="button"
                  onClick={() => setHistoryStatusFilter('all')}
                  className={`px-2.5 py-1 rounded-lg transition cursor-pointer whitespace-nowrap ${
                    historyStatusFilter === 'all'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All ({invoices.length})
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryStatusFilter('Paid')}
                  className={`px-2.5 py-1 rounded-lg transition cursor-pointer whitespace-nowrap ${
                    historyStatusFilter === 'Paid'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Completed ({invoices.filter(i => i.status === 'Paid').length})
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryStatusFilter('due')}
                  className={`px-2.5 py-1 rounded-lg transition cursor-pointer whitespace-nowrap ${
                    historyStatusFilter === 'due'
                      ? 'bg-amber-500 text-slate-950'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Due / Partial ({invoices.filter(i => i.status !== 'Paid').length})
                </button>
              </div>

              {/* Printer Layout Selector */}
              <div className="flex items-center bg-white p-1 rounded-xl border border-slate-200 text-xs font-bold shadow-2xs">
                <span className="px-2 text-[10px] font-extrabold uppercase tracking-wide text-slate-400 hidden sm:inline">
                  Print Layout:
                </span>
                <button
                  type="button"
                  onClick={() => setHistoryPrintLayout('a4')}
                  className={`px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 whitespace-nowrap ${
                    historyPrintLayout === 'a4'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5 shrink-0" />
                  <span>A4 Sheet</span>
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryPrintLayout('thermal')}
                  className={`px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 whitespace-nowrap ${
                    historyPrintLayout === 'thermal'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Receipt className="w-3.5 h-3.5 shrink-0" />
                  <span>Thermal 80mm</span>
                </button>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-600 uppercase tracking-wider text-[10px] border-b border-slate-200">
                <tr>
                  <th className="p-4 font-bold">Invoice No</th>
                  <th className="p-4 font-bold">Customer Name</th>
                  <th className="p-4 font-bold">Courier & Tracking</th>
                  <th className="p-4 font-bold">Delivery Date</th>
                  <th className="p-4 font-bold text-right">Amount</th>
                  <th className="p-4 font-bold text-right">Previous Due</th>
                  <th className="p-4 font-bold text-right">Total Amount</th>
                  <th className="p-4 font-bold text-right">Advance Paid</th>
                  <th className="p-4 font-bold text-right">Total Due</th>
                  <th className="p-4 font-bold text-center">Status</th>
                  <th className="p-4 font-bold text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInvoices.map(inv => {
                  const runningBill = inv.subTotal || inv.items.reduce((s, it) => s + it.total, 0);
                  const prevDue = inv.previousDue || 0;
                  const gTotal = inv.grandTotal || inv.totalAmount;

                  return (
                    <tr key={inv.id} className="hover:bg-slate-50">
                      <td className="p-4 font-mono font-bold text-slate-900">{inv.chalanNo}</td>
                      <td className="p-4 font-bold text-blue-700">
                        <div>{inv.wholesalerName}</div>
                        {inv.customerPhone && <div className="text-[10px] text-slate-400 font-normal">{inv.customerPhone}</div>}
                      </td>
                      <td className="p-4 text-slate-700">
                        <div className="font-semibold">
                          {inv.courierName || <span className="text-slate-400 font-normal">Not Assigned</span>}
                        </div>
                        {inv.courierTrackingNo && (() => {
                          const trkUrl = getCourierTrackingUrl(inv.courierName, inv.courierTrackingNo);
                          return trkUrl ? (
                            <a
                              href={trkUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] text-emerald-700 hover:underline font-mono font-bold inline-flex items-center gap-1"
                            >
                              <span>🔖 {inv.courierTrackingNo}</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          ) : (
                            <div className="text-[10px] text-emerald-700 font-mono font-bold">
                              🔖 {inv.courierTrackingNo}
                            </div>
                          );
                        })()}
                        {inv.totalCartons && (
                          <div className="text-[10px] text-slate-500">
                            📦 {inv.totalCartons}
                          </div>
                        )}
                      </td>
                      <td className="p-4 text-slate-500 font-mono">{formatDDMMYY(inv.deliveryDate || inv.date)}</td>
                      <td className="p-4 font-mono font-bold text-slate-900 text-right">{formatTkAmount(runningBill)}</td>
                      <td className="p-4 font-mono font-bold text-amber-600 text-right">
                        {prevDue > 0 ? `+ ${formatTkAmount(prevDue)}` : '0/='}
                      </td>
                      <td className="p-4 font-mono font-bold text-cyan-700 text-right">{formatTkAmount(gTotal)}</td>
                      <td className="p-4 font-mono font-bold text-emerald-600 text-right">{formatTkAmount(inv.paidAmount)}</td>
                      <td className="p-4 font-mono font-bold text-rose-600 text-right">{formatTkAmount(inv.dueAmount)}</td>
                      <td className="p-4 text-center">
                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold inline-block ${
                          inv.status === 'Paid' ? 'bg-emerald-100 text-emerald-700' : 
                          inv.status === 'Partial' ? 'bg-amber-100 text-amber-700' : 
                          'bg-rose-100 text-rose-700'
                        }`}>
                          {inv.status}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button 
                            type="button"
                            onClick={() => openInvoicePrintPreview(inv, historyPrintLayout)} 
                            className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition inline-flex items-center gap-1 shadow-xs cursor-pointer whitespace-nowrap"
                            title={`Print ${inv.chalanNo} in ${historyPrintLayout === 'thermal' ? '80mm Thermal' : 'A4'} layout`}
                          >
                            <Printer className="w-3.5 h-3.5 shrink-0" /> Print
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              openInvoicePrintPreview(
                                inv,
                                historyPrintLayout === 'thermal' ? 'a4' : 'thermal'
                              )
                            }
                            className="px-2 py-1.5 bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200 font-bold rounded-xl text-[11px] transition inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                            title={
                              historyPrintLayout === 'thermal'
                                ? 'Open in A4 Sheet Print Layout'
                                : 'Open in 80mm Thermal Printer Layout'
                            }
                          >
                            {historyPrintLayout === 'thermal' ? (
                              <>
                                <FileText className="w-3 h-3 shrink-0" />
                                <span>A4</span>
                              </>
                            ) : (
                              <>
                                <Receipt className="w-3 h-3 shrink-0" />
                                <span>80mm</span>
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSendHistoryWhatsAppPdf(inv)}
                            disabled={sharingHistoryId === inv.id}
                            className="px-2 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-xl text-xs transition inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                            title="1-Click Send Invoice PDF to Customer on WhatsApp"
                          >
                            <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                            <span>{sharingHistoryId === inv.id ? '...' : 'PDF'}</span>
                          </button>

                          <button 
                            onClick={() => handleOpenEditModal(inv)} 
                            className="p-1.5 bg-slate-100 hover:bg-amber-50 text-slate-700 hover:text-amber-600 font-bold rounded-xl text-xs transition cursor-pointer"
                            title="Edit Invoice"
                          >
                            <Edit className="w-4 h-4" />
                          </button>

                          <button 
                            onClick={() => onDeleteInvoice(inv.id)} 
                            className="p-1.5 bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-600 font-bold rounded-xl text-xs transition cursor-pointer"
                            title="Delete Invoice"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredInvoices.length === 0 && (
                  <tr>
                    <td colSpan={11} className="p-10 text-center text-slate-400">
                      No invoices found matching your criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- BUYER PORTAL ORDERS QUEUE --- */}
      {view === 'buyer-orders' && (
        <div className="space-y-4">
          {customerOrders.map(ord => (
            <div key={ord.id} className="bg-white rounded-2xl shadow-xs border border-slate-200 p-5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-slate-900 text-sm">{ord.orderNo}</span>
                    <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold ${
                      ord.status === 'Dispatched' || ord.status === 'Delivered' ? 'bg-emerald-100 text-emerald-800' :
                      ord.status === 'Cancelled' ? 'bg-rose-100 text-rose-700' :
                      'bg-amber-100 text-amber-800'
                    }`}>
                      {ord.status}
                    </span>
                  </div>
                  <div className="text-xs font-bold text-blue-700 mt-0.5">
                    Buyer: {ord.wholesalerName} {ord.customerPhone ? `(${ord.customerPhone})` : ''} • {formatDDMMYY(ord.createdAt)}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono font-black text-slate-900 text-sm mr-2">{formatTkAmount(ord.totalAmount)}</span>
                  <select
                    value={ord.status}
                    onChange={e => onUpdateCustomerOrder({ ...ord, status: e.target.value as CustomerOrder['status'], updatedAt: new Date().toISOString() })}
                    className="bg-slate-100 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800"
                  >
                    <option value="Pending Approval">Pending Approval</option>
                    <option value="Approved">Approved</option>
                    <option value="Packed">Packed</option>
                    <option value="Dispatched">Dispatched</option>
                    <option value="Delivered">Delivered</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                  {!ord.linkedInvoiceId && ord.status !== 'Cancelled' && (
                    <button
                      type="button"
                      onClick={() => handleLoadOrderIntoCreateForm(ord)}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Approve &amp; Create Invoice
                    </button>
                  )}
                  {ord.linkedChalanNo && (
                    <span className="px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg font-mono text-[11px] font-bold">
                      Invoice #{ord.linkedChalanNo}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                {ord.items.map((it, i) => (
                  <span key={i} className="px-2.5 py-1 bg-slate-100 rounded-lg font-semibold text-slate-800">
                    {it.itemName} × {it.quantity} @ {it.unitPrice}/= = {formatTkAmount(it.total)}
                  </span>
                ))}
              </div>

              {(ord.advanceSubmitted || ord.notes) && (
                <div className="text-[11px] text-slate-600 flex flex-wrap gap-4 pt-1">
                  {ord.advanceSubmitted ? (
                    <span className="font-bold text-emerald-700">
                      Advance Reported: {formatTkAmount(ord.advanceSubmitted)} ({ord.paymentMethod || 'Transfer'}{ord.paymentRef ? `, Ref: ${ord.paymentRef}` : ''})
                    </span>
                  ) : null}
                  {ord.notes && <span>Notes: {ord.notes}</span>}
                </div>
              )}
            </div>
          ))}
          {customerOrders.length === 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 text-xs">
              No buyer portal orders received yet.
            </div>
          )}
        </div>
      )}

      {/* --- BUYER RETURN REQUESTS --- */}
      {view === 'returns' && (
        <div className="space-y-4">
          {customerReturns.map(ret => (
            <div key={ret.id} className="bg-white rounded-2xl shadow-xs border border-slate-200 p-5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-slate-900 text-sm">{ret.returnNo}</span>
                    <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold ${
                      ret.status === 'Credited' || ret.status === 'Approved' ? 'bg-emerald-100 text-emerald-800' :
                      ret.status === 'Rejected' ? 'bg-rose-100 text-rose-700' :
                      'bg-amber-100 text-amber-800'
                    }`}>
                      {ret.status}
                    </span>
                  </div>
                  <div className="text-xs font-bold text-blue-700 mt-0.5">
                    Buyer: {ret.wholesalerName} {ret.chalanNo ? `• Ref Invoice #${ret.chalanNo}` : ''} • Reason: {ret.reason}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-mono font-black text-emerald-700 text-sm mr-2">
                    Credit: {formatTkAmount(ret.totalCreditAmount)}
                  </span>
                  {ret.status === 'Requested' && (
                    <>
                      <button
                        type="button"
                        onClick={() => onResolveCustomerReturn(ret.id, 'Approved')}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs cursor-pointer"
                      >
                        Approve &amp; Credit Due
                      </button>
                      <button
                        type="button"
                        onClick={() => onResolveCustomerReturn(ret.id, 'Rejected')}
                        className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl text-xs cursor-pointer"
                      >
                        Reject
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                {ret.items.map((it, idx) => (
                  <span key={idx} className="px-2.5 py-1 bg-slate-100 rounded-lg font-semibold">
                    {it.itemName} × {it.quantity} = {formatTkAmount(it.total)}
                  </span>
                ))}
              </div>
            </div>
          ))}
          {customerReturns.length === 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 text-xs">
              No buyer return requests submitted yet.
            </div>
          )}
        </div>
      )}

      {/* --- INVOICE RECEIPT MODAL (SHARED WITH CUSTOMER PORTAL) --- */}
      {activeInvoice && (
        <InvoiceReceiptModal
          invoice={activeInvoice}
          customer={activeCustomer}
          currentUser={currentUser}
          brandName={brandName}
          brandShortName={brandShortName}
          storeName={storeName}
          logoUrl={logoUrl}
          address={address}
          phone={phone}
          companyEmail={companyEmail}
          companyWebsite={companyWebsite}
          initialPaperLayout={activeInvoiceLayout}
          onClose={() => setActiveInvoice(null)}
          onUpdateInvoiceSignature={(updatedInv) => {
            onUpdateInvoice(updatedInv);
            setActiveInvoice(updatedInv);
          }}
          onCopySummary={handleCopySummary}
          copied={copied}
        />
      )}

      {/* --- EDIT CHALAN MODAL --- */}
      {editingInvoice && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-start justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full p-6 space-y-4 my-auto">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-800 text-base">
                Edit Invoice #{editingInvoice.chalanNo}
              </h3>
              <button 
                type="button"
                onClick={() => setEditingInvoice(null)} 
                aria-label="Close Edit Invoice Modal"
                title="Close Edit Invoice Modal"
                className="text-slate-400 hover:text-slate-600 font-bold p-1 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Courier & Dates */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">Order Date</label>
                <input 
                  type="date" 
                  value={editOrderDate} 
                  onChange={e => setEditOrderDate(e.target.value)} 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono" 
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">Delivery Date</label>
                <input 
                  type="date" 
                  value={editDeliveryDate} 
                  onChange={e => setEditDeliveryDate(e.target.value)} 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono" 
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">Courier Service</label>
                <input 
                  type="text" 
                  value={editCourierName} 
                  onChange={e => setEditCourierName(e.target.value)} 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs" 
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">Booking / Tracking No</label>
                <input 
                  type="text" 
                  value={editCourierTrackingNo} 
                  onChange={e => setEditCourierTrackingNo(e.target.value)} 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono" 
                />
              </div>
            </div>

            {/* Add More Items to Edit Cart */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <form onSubmit={handleAddEditItem} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                <div className="sm:col-span-4">
                  <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">Product</label>
                  <select 
                    value={editSelectedItemId} 
                    onChange={e => handleEditProductSelectionChange(e.target.value)} 
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold"
                  >
                    <option value="">-- Add Product --</option>
                    {items.filter(i => i.quantity > 0).map(i => (
                      <option key={i.id} value={i.id}>{i.name} - {currency}{i.price}</option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">Size</label>
                  <input 
                    type="text" 
                    value={editItemSize} 
                    onChange={e => setEditItemSize(e.target.value)} 
                    className="w-full bg-white border border-slate-200 rounded-xl px-2 py-2 text-xs" 
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">Flat Rate</label>
                  <input 
                    type="number" 
                    value={editItemFlatRate} 
                    onChange={e => setEditItemFlatRate(e.target.value === '' ? '' : Number(e.target.value))} 
                    className="w-full bg-white border border-slate-200 rounded-xl px-2 py-2 text-xs font-mono font-bold" 
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">Qty</label>
                  <input 
                    type="number" 
                    min="1" 
                    value={editQty} 
                    onChange={e => setEditQty(e.target.value === '' ? '' : Number(e.target.value))} 
                    className="w-full bg-white border border-slate-200 rounded-xl px-2 py-2 text-xs font-mono font-bold" 
                  />
                </div>
                <div className="sm:col-span-1">
                  <label className="block text-[10px] font-bold text-emerald-700 uppercase mb-1">Free</label>
                  <input 
                    type="number" 
                    min="0" 
                    value={editBonusQty} 
                    onChange={e => setEditBonusQty(e.target.value === '' ? '' : Number(e.target.value))} 
                    className="w-full bg-emerald-50 border border-emerald-300 rounded-xl px-2 py-2 text-xs font-mono font-bold" 
                  />
                </div>
                <div className="sm:col-span-1">
                  <button type="submit" className="w-full bg-emerald-600 text-white font-bold p-2 rounded-xl text-xs">
                    +
                  </button>
                </div>
              </form>
            </div>

            {/* Edit Cart Items List */}
            <div className="max-h-48 overflow-y-auto overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full min-w-[480px] text-xs text-left">
                <thead className="bg-slate-100 text-[10px] font-bold">
                  <tr>
                    <th className="p-2">Item</th>
                    <th className="p-2">Size</th>
                    <th className="p-2 text-right">Flat Rate</th>
                    <th className="p-2 text-center">Qty (+Free)</th>
                    <th className="p-2 text-right">Total</th>
                    <th className="p-2 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {editCart.map((it, idx) => (
                    <tr key={idx}>
                      <td className="p-2 font-bold">{it.itemName}</td>
                      <td className="p-2 text-slate-600">{it.packSize}</td>
                      <td className="p-2 text-right font-mono">{it.unitPrice}</td>
                      <td className="p-2 text-center font-mono font-bold">
                        {it.quantity}
                        {(it.bonusQty || 0) > 0 && (
                          <span className="ml-1 text-[10px] text-emerald-700">(+{it.bonusQty} Free)</span>
                        )}
                      </td>
                      <td className="p-2 text-right font-mono font-bold">{it.total}</td>
                      <td className="p-2 text-center">
                        <button 
                          onClick={() => setEditCart(editCart.filter((_, i) => i !== idx))} 
                          className="text-rose-500 hover:text-rose-700"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Advance Payment in Edit */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                Advance Payment Received
              </label>
              <input 
                type="number" 
                min="0" 
                value={editPaidAmount} 
                onChange={e => setEditPaidAmount(e.target.value === '' ? '' : Number(e.target.value))} 
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold font-mono" 
              />
            </div>

            {editFormError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold">
                ⚠️ {editFormError}
              </div>
            )}

            {/* Actions */}
            <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
              <button 
                type="button" 
                onClick={() => setEditingInvoice(null)} 
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button 
                type="button" 
                onClick={handleSaveEditInvoice} 
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-sm"
              >
                Update Invoice
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
