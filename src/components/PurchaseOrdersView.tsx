import React, { useMemo, useState } from 'react';
import {
  DEFAULT_WAREHOUSES,
  PurchaseBill,
  PurchaseBillItem,
  PurchaseOrder,
  PurchaseReturn,
  PurchaseReturnItem,
  StockItem,
  Supplier,
} from '../data/mockData';
import {
  Printer,
  Trash2,
  MessageSquare,
  AlertTriangle,
  Eye,
  Plus,
  FileText,
  RotateCcw,
  Receipt,
  X,
} from 'lucide-react';
import {
  formatDDMMYY,
  getFormattedLocalDateTime,
  getLocalYYYYMMDD,
} from '../utils/dateUtils';
import { BarcodeScannerInput } from './BarcodeLabelModal';
import { formatTkAmount } from '../utils/numberToWords';

interface PurchaseOrdersViewProps {
  purchaseOrders: PurchaseOrder[];
  purchaseBills?: PurchaseBill[];
  purchaseReturns?: PurchaseReturn[];
  warehouses?: string[];
  systemDate?: string;
  items: StockItem[];
  suppliers: Supplier[];
  currency: string;
  onAddPO: (po: Omit<PurchaseOrder, 'id'>) => void;
  onUpdatePO: (po: PurchaseOrder) => void;
  onDeletePO: (id: string) => void;
  onReceivePOItems: (po: PurchaseOrder) => void;
  onCreatePurchaseBill?: (
    bill: Omit<PurchaseBill, 'id' | 'createdByName'>
  ) => PurchaseBill;
  onDeletePurchaseBill?: (id: string) => void;
  onCreatePurchaseReturn?: (
    ret: Omit<PurchaseReturn, 'id' | 'createdByName'>
  ) => PurchaseReturn;
  searchQuery: string;
  brandName: string;
  storeName: string;
  phone: string;
}

interface DraftBillRow {
  rowKey: string;
  itemId: string;
  itemName: string;
  sku: string;
  category: string;
  batchNo: string;
  mfgDate: string;
  expiryDate: string;
  quantity: number | '';
  bonusQty: number | '';
  costPrice: number | '';
}

const createEmptyBillRow = (): DraftBillRow => ({
  rowKey: `PB-ROW-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
  itemId: '',
  itemName: '',
  sku: '',
  category: 'General',
  batchNo: '',
  mfgDate: '2026-01-01',
  expiryDate: '2028-01-01',
  quantity: '',
  bonusQty: 0,
  costPrice: '',
});

export const PurchaseOrdersView: React.FC<PurchaseOrdersViewProps> = ({
  purchaseOrders,
  purchaseBills = [],
  purchaseReturns = [],
  warehouses = DEFAULT_WAREHOUSES,
  systemDate,
  items,
  suppliers,
  currency,
  onAddPO,
  onDeletePO,
  onReceivePOItems,
  onCreatePurchaseBill,
  onDeletePurchaseBill,
  onCreatePurchaseReturn,
  searchQuery,
  brandName,
  storeName,
  phone,
}) => {
  const warehouseList =
    warehouses && warehouses.length > 0 ? warehouses : DEFAULT_WAREHOUSES;

  const [subModule, setSubModule] = useState<'bills' | 'returns' | 'orders'>('bills');
  const [activePO, setActivePO] = useState<PurchaseOrder | null>(null);
  const [activeBill, setActiveBill] = useState<PurchaseBill | null>(null);
  const [poNotice, setPoNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [confirmReceiveId, setConfirmReceiveId] = useState<string | null>(null);
  const [confirmDeleteBillId, setConfirmDeleteBillId] = useState<string | null>(null);

  // Create Purchase Bill modal state
  const [isBillModalOpen, setIsBillModalOpen] = useState(false);
  const [billNo, setBillNo] = useState('');
  const [billDate, setBillDate] = useState(systemDate || getLocalYYYYMMDD());
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [customSupplierName, setCustomSupplierName] = useState('');
  const [billWarehouse, setBillWarehouse] = useState(warehouseList[0] || 'Main Warehouse');
  const [billDiscount, setBillDiscount] = useState<number | ''>(0);
  const [billTransportCost, setBillTransportCost] = useState<number | ''>(0);
  const [billPaidAmount, setBillPaidAmount] = useState<number | ''>('');
  const [billPaymentMethod, setBillPaymentMethod] = useState<'Cash' | 'Bank Transfer' | 'bKash' | 'Nagad' | 'Card'>('Cash');
  const [billNotes, setBillNotes] = useState('');
  const [billRows, setBillRows] = useState<DraftBillRow[]>(() => [createEmptyBillRow()]);

  // Purchase Return modal state
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [retSupplierId, setRetSupplierId] = useState('');
  const [retCustomSupplierName, setRetCustomSupplierName] = useState('');
  const [retRefBillNo, setRetRefBillNo] = useState('');
  const [retDate, setRetDate] = useState(systemDate || getLocalYYYYMMDD());
  const [retReason, setRetReason] = useState('Damaged / Near-Expiry');
  const [retItemId, setRetItemId] = useState('');
  const [retQty, setRetQty] = useState<number | ''>('');
  const [retUnitCost, setRetUnitCost] = useState<number | ''>('');

  const formatCurr = (val: number) => {
    const sym = currency.includes('৳') || currency.toLowerCase().includes('bdt') ? '৳' : currency;
    return `${sym} ${val.toLocaleString()}`;
  };

  const nextBillNoDefault = useMemo(() => {
    const seq = 1001 + purchaseBills.length;
    return `PB-${new Date().getFullYear()}-${String(seq)}`;
  }, [purchaseBills.length]);

  const openNewBillModal = () => {
    setBillNo(nextBillNoDefault);
    setBillDate(systemDate || getLocalYYYYMMDD());
    setSelectedSupplierId(suppliers[0]?.id || '');
    setCustomSupplierName('');
    setBillWarehouse(warehouseList[0] || 'Main Warehouse');
    setBillDiscount(0);
    setBillTransportCost(0);
    setBillPaidAmount('');
    setBillPaymentMethod('Cash');
    setBillNotes('');
    setBillRows([createEmptyBillRow()]);
    setIsBillModalOpen(true);
  };

  const billSubTotal = useMemo(() => {
    return billRows.reduce((sum, r) => {
      if (!r.itemId) return sum;
      return sum + (Number(r.quantity) || 0) * (Number(r.costPrice) || 0);
    }, 0);
  }, [billRows]);

  const billGrandTotal = Math.max(
    0,
    billSubTotal - (Number(billDiscount) || 0) + (Number(billTransportCost) || 0)
  );
  const billDuePreview = Math.max(0, billGrandTotal - (Number(billPaidAmount) || 0));

  const handleBillRowProductChange = (rowKey: string, itemId: string) => {
    const item = items.find((i) => i.id === itemId);
    setBillRows((prev) =>
      prev.map((r) => {
        if (r.rowKey !== rowKey) return r;
        if (!item) return { ...r, itemId: '', itemName: '', sku: '' };
        return {
          ...r,
          itemId: item.id,
          itemName: item.name,
          sku: item.sku,
          category: item.category,
          batchNo: item.batchNo || `B-${Math.floor(100 + Math.random() * 900)}`,
          mfgDate: item.mfgDate || '2026-01-01',
          expiryDate: item.expiryDate || '2028-01-01',
          quantity: r.quantity || 10,
          costPrice: item.costPrice,
        };
      })
    );
  };

  const handleBarcodeAddToBill = (matched: StockItem) => {
    setBillRows((prev) => {
      const existing = prev.find((r) => r.itemId === matched.id);
      if (existing) {
        return prev.map((r) =>
          r.rowKey === existing.rowKey
            ? { ...r, quantity: (Number(r.quantity) || 0) + 1 }
            : r
        );
      }
      const empty = prev.find((r) => !r.itemId);
      const populated: DraftBillRow = {
        rowKey: empty?.rowKey || createEmptyBillRow().rowKey,
        itemId: matched.id,
        itemName: matched.name,
        sku: matched.sku,
        category: matched.category,
        batchNo: matched.batchNo || 'B-NEW',
        mfgDate: matched.mfgDate || '2026-01-01',
        expiryDate: matched.expiryDate || '2028-01-01',
        quantity: 1,
        bonusQty: 0,
        costPrice: matched.costPrice,
      };
      if (empty) {
        return prev.map((r) => (r.rowKey === empty.rowKey ? populated : r));
      }
      return [...prev, populated];
    });
  };

  const handleSubmitPurchaseBill = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onCreatePurchaseBill) return;

    const supObj = suppliers.find((s) => s.id === selectedSupplierId);
    const resolvedSupName = supObj?.name || customSupplierName.trim();
    if (!resolvedSupName) {
      setPoNotice({ type: 'error', text: 'Please select or enter a Supplier Name.' });
      return;
    }

    const validRows = billRows.filter((r) => r.itemId && (Number(r.quantity) || 0) > 0);
    if (validRows.length === 0) {
      setPoNotice({ type: 'error', text: 'Add at least 1 product row with quantity > 0.' });
      return;
    }

    const billItems: PurchaseBillItem[] = validRows.map((r) => {
      const qty = Number(r.quantity) || 0;
      const bonus = Number(r.bonusQty) || 0;
      const cost = Number(r.costPrice) || 0;
      const matchedItem = items.find((i) => i.id === r.itemId);
      return {
        itemId: r.itemId,
        itemName: r.itemName,
        sku: r.sku || matchedItem?.sku || 'N/A',
        category: r.category,
        batchNo: r.batchNo || 'B-NEW',
        mfgDate: r.mfgDate || undefined,
        expiryDate: r.expiryDate || '2028-01-01',
        quantity: qty,
        bonusQty: bonus,
        costPrice: cost,
        total: qty * cost,
      };
    });

    const paid = Number(billPaidAmount) || 0;
    const due = Math.max(0, billGrandTotal - paid);

    const savedBill = onCreatePurchaseBill({
      billNo: billNo.trim() || nextBillNoDefault,
      supplierId: supObj?.id || 'CUSTOM-SUP',
      supplierName: resolvedSupName,
      supplierPhone: supObj?.phone || '',
      warehouseName: billWarehouse,
      items: billItems,
      subTotal: billSubTotal,
      discount: Number(billDiscount) || 0,
      transportCost: Number(billTransportCost) || 0,
      totalAmount: billGrandTotal,
      paidAmount: paid,
      dueAmount: due,
      paymentMethod: billPaymentMethod,
      date: getFormattedLocalDateTime(billDate),
      notes: billNotes.trim() || undefined,
      status: due <= 0 ? 'Paid' : paid > 0 ? 'Partial' : 'Unpaid',
    });

    setIsBillModalOpen(false);
    setActiveBill(savedBill);
    setPoNotice({
      type: 'success',
      text: `Purchase Bill ${savedBill.billNo} saved & stock restocked across ${billItems.length} item(s).`,
    });
  };

  const handleSubmitPurchaseReturn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onCreatePurchaseReturn) return;
    const supObj = suppliers.find((s) => s.id === retSupplierId);
    const supName = supObj?.name || retCustomSupplierName.trim();
    const item = items.find((i) => i.id === retItemId);
    const qty = Number(retQty) || 0;
    const unitCost = Number(retUnitCost) || item?.costPrice || 0;

    if (!supName || !item || qty <= 0) {
      setPoNotice({ type: 'error', text: 'Select supplier, product, and valid return quantity.' });
      return;
    }

    const retItems: PurchaseReturnItem[] = [
      {
        itemId: item.id,
        itemName: item.name,
        sku: item.sku,
        quantity: qty,
        costPrice: unitCost,
        total: qty * unitCost,
      },
    ];

    onCreatePurchaseReturn({
      returnNo: `PRET-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      purchaseBillId: purchaseBills.find((b) => b.billNo === retRefBillNo)?.id,
      billNo: retRefBillNo.trim() || undefined,
      supplierId: supObj?.id || 'CUSTOM-SUP',
      supplierName: supName,
      warehouseName: warehouseList[0] || 'Main Warehouse',
      items: retItems,
      totalAmount: qty * unitCost,
      reason: retReason.trim() || 'Supplier Return',
      date: getFormattedLocalDateTime(retDate),
    });

    setIsReturnModalOpen(false);
    setRetQty('');
    setPoNotice({
      type: 'success',
      text: `Purchase Return logged for ${item.name} (-${qty} pcs). Supplier payable due reduced.`,
    });
  };

  // Find items running low in stock
  const lowStockItems = items.filter((i) => i.quantity <= i.reorderThreshold);

  // Group low stock items by supplier for auto PO generation
  const handleAutoGeneratePOs = () => {
    if (lowStockItems.length === 0) {
      setPoNotice({ type: 'error', text: 'No items are currently below the reorder threshold!' });
      return;
    }

    const supplierMap: Record<string, StockItem[]> = {};
    lowStockItems.forEach((item) => {
      const sup = item.supplier || 'Unassigned Supplier';
      if (!supplierMap[sup]) supplierMap[sup] = [];
      supplierMap[sup].push(item);
    });

    let generatedCount = 0;
    Object.keys(supplierMap).forEach((supName) => {
      const supItems = supplierMap[supName];
      const poItems = supItems.map((i) => {
        const reorderQty = Math.max(i.reorderThreshold * 2, 50);
        return {
          itemId: i.id,
          itemName: i.name,
          quantity: reorderQty,
          costPrice: i.costPrice,
          total: reorderQty * i.costPrice,
        };
      });

      const totalAmount = poItems.reduce((sum, x) => sum + x.total, 0);
      const supplierObj = suppliers.find((s) => s.name === supName);
      const poNo = `PO-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;

      onAddPO({
        poNo,
        supplierName: supName,
        supplierPhone: supplierObj?.phone || '',
        items: poItems,
        totalAmount,
        date: getFormattedLocalDateTime(),
        status: 'Draft',
        notes: `Automated reorder PO for ${poItems.length} low-stock items.`,
      });
      generatedCount++;
    });

    setPoNotice({
      type: 'success',
      text: `Successfully auto-generated ${generatedCount} Purchase Orders for low-stock items!`,
    });
  };

  const filteredBills = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return purchaseBills.filter(
      (b) =>
        b.billNo.toLowerCase().includes(q) ||
        b.supplierName.toLowerCase().includes(q) ||
        b.items.some((it) => it.itemName.toLowerCase().includes(q))
    );
  }, [purchaseBills, searchQuery]);

  const filteredReturns = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return purchaseReturns.filter(
      (r) =>
        r.returnNo.toLowerCase().includes(q) ||
        r.supplierName.toLowerCase().includes(q) ||
        (r.billNo && r.billNo.toLowerCase().includes(q))
    );
  }, [purchaseReturns, searchQuery]);

  const filteredPOs = purchaseOrders.filter(
    (po) =>
      po.poNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      po.supplierName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getWhatsAppPOUrl = (po: PurchaseOrder) => {
    const itemsText = po.items
      .map((i) => `• ${i.itemName}: ${i.quantity} Pcs @ ${formatCurr(i.costPrice)} = ${formatCurr(i.total)}`)
      .join('\n');
    const msg = `📋 *PURCHASE REQUISITION ORDER*
🏢 *${brandName}* (${storeName})
------------------------------
PO No: *${po.poNo}*
Date: *${po.date.replace('T', ' ')}*
Supplier: *${po.supplierName}*

*Requested Items:*
${itemsText}

------------------------------
Total Estimated Amount: *${formatCurr(po.totalAmount)}*

Please confirm delivery availability and dispatch timeline. Contact: ${phone}`;

    let cleanPhone = (po.supplierPhone || '').replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('0')) cleanPhone = '88' + cleanPhone;

    return cleanPhone
      ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(msg)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
  };

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-[1600px] mx-auto min-h-full">
      {/* Top Banner & Sub-module Tabs */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-xs border border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h3 className="font-extrabold text-slate-900 text-base">
            Purchases, Multi-Item Purchase Bills &amp; Supplier Returns (ক্রয় ও রিটার্ন)
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Create multi-item supplier bills (auto-updates stock &amp; payable due), log returns, and auto-draft low-stock POs
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onCreatePurchaseBill && (
            <button
              type="button"
              onClick={openNewBillModal}
              className="bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-slate-950 font-extrabold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>New Purchase Bill</span>
            </button>
          )}
          {onCreatePurchaseReturn && (
            <button
              type="button"
              onClick={() => {
                setRetSupplierId(suppliers[0]?.id || '');
                setRetItemId(items[0]?.id || '');
                setRetUnitCost(items[0]?.costPrice || '');
                setRetDate(systemDate || getLocalYYYYMMDD());
                setIsReturnModalOpen(true);
              }}
              className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-extrabold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Log Purchase Return</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleAutoGeneratePOs}
            className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Auto-Draft Low Stock POs ({lowStockItems.length})</span>
          </button>
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setSubModule('bills')}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 cursor-pointer transition ${
            subModule === 'bills'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Receipt className="w-4 h-4 text-emerald-400" />
          <span>Multi-Item Purchase Bills ({purchaseBills.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setSubModule('returns')}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 cursor-pointer transition ${
            subModule === 'returns'
              ? 'bg-rose-600 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <RotateCcw className="w-4 h-4" />
          <span>Supplier Purchase Returns ({purchaseReturns.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setSubModule('orders')}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 cursor-pointer transition ${
            subModule === 'orders'
              ? 'bg-amber-500 text-slate-950 shadow-xs'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Auto-Draft Requisition POs ({purchaseOrders.length})</span>
        </button>
      </div>

      {/* Inline Notice Banner */}
      {poNotice && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-bold flex items-center justify-between ${
            poNotice.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <span>{poNotice.text}</span>
          <button
            type="button"
            onClick={() => setPoNotice(null)}
            className="font-black ml-3 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* TAB 1: MULTI-ITEM PURCHASE BILLS */}
      {subModule === 'bills' && (
        <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center text-xs">
            <span className="font-extrabold text-slate-800 text-sm">
              Supplier Purchase Bills / Stock Inward Invoices
            </span>
            <span className="font-bold text-slate-600 bg-slate-200 px-2.5 py-1 rounded-lg">
              {filteredBills.length} Bills
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 uppercase tracking-wider text-[10px] border-b border-slate-200">
                <tr>
                  <th className="p-3.5 font-bold">Bill No</th>
                  <th className="p-3.5 font-bold">Supplier &amp; Godown</th>
                  <th className="p-3.5 font-bold text-center">Items / Pcs</th>
                  <th className="p-3.5 font-bold text-right">Grand Total</th>
                  <th className="p-3.5 font-bold text-right">Paid</th>
                  <th className="p-3.5 font-bold text-right">Supplier Due</th>
                  <th className="p-3.5 font-bold">Date</th>
                  <th className="p-3.5 font-bold text-center">Status</th>
                  <th className="p-3.5 font-bold text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBills.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="p-3.5 font-mono font-extrabold text-slate-900">{b.billNo}</td>
                    <td className="p-3.5">
                      <div className="font-bold text-blue-700">{b.supplierName}</div>
                      <div className="text-[10px] text-slate-400">{b.warehouseName || 'Main Warehouse'}</div>
                    </td>
                    <td className="p-3.5 text-center font-bold text-slate-800">
                      {b.items.length} SKUs ·{' '}
                      {b.items.reduce((s, it) => s + it.quantity + (it.bonusQty || 0), 0)} pcs
                    </td>
                    <td className="p-3.5 text-right font-mono font-bold text-slate-900">
                      {formatTkAmount(b.totalAmount)}
                    </td>
                    <td className="p-3.5 text-right font-mono font-bold text-emerald-700">
                      {formatTkAmount(b.paidAmount)}
                    </td>
                    <td className="p-3.5 text-right font-mono font-black text-rose-700">
                      {formatTkAmount(b.dueAmount)}
                    </td>
                    <td className="p-3.5 font-mono text-slate-500">{formatDDMMYY(b.date)}</td>
                    <td className="p-3.5 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold ${
                          b.status === 'Paid'
                            ? 'bg-emerald-100 text-emerald-800'
                            : b.status === 'Partial'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {b.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-center">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setActiveBill(b)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-800 font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" /> View / Print
                        </button>
                        {onDeletePurchaseBill &&
                          (confirmDeleteBillId === b.id ? (
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  onDeletePurchaseBill(b.id);
                                  setConfirmDeleteBillId(null);
                                  setPoNotice({ type: 'success', text: `Deleted Purchase Bill ${b.billNo}.` });
                                }}
                                className="px-2 py-1 bg-rose-600 text-white rounded text-[10px] font-bold cursor-pointer"
                              >
                                Confirm
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteBillId(null)}
                                className="px-2 py-1 bg-slate-200 text-slate-700 rounded text-[10px] font-bold cursor-pointer"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteBillId(b.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                              title="Delete Bill"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          ))}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredBills.length === 0 && (
                  <tr>
                    <td colSpan={9} className="p-10 text-center text-slate-400">
                      No Purchase Bills recorded yet. Click &quot;New Purchase Bill&quot; to log multi-item supplier stock intake.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: SUPPLIER PURCHASE RETURNS */}
      {subModule === 'returns' && (
        <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center text-xs">
            <span className="font-extrabold text-slate-800 text-sm">
              Supplier Purchase Return &amp; Debit Notes
            </span>
            <span className="font-bold text-slate-600 bg-slate-200 px-2.5 py-1 rounded-lg">
              {filteredReturns.length} Returns
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 uppercase tracking-wider text-[10px] border-b border-slate-200">
                <tr>
                  <th className="p-3.5 font-bold">Return No</th>
                  <th className="p-3.5 font-bold">Supplier &amp; Ref Bill</th>
                  <th className="p-3.5 font-bold">Returned Items</th>
                  <th className="p-3.5 font-bold">Reason</th>
                  <th className="p-3.5 font-bold text-right">Credit Amount</th>
                  <th className="p-3.5 font-bold">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredReturns.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="p-3.5 font-mono font-extrabold text-rose-700">{r.returnNo}</td>
                    <td className="p-3.5">
                      <div className="font-bold text-slate-900">{r.supplierName}</div>
                      {r.billNo && <div className="text-[10px] font-mono text-slate-500">Ref: {r.billNo}</div>}
                    </td>
                    <td className="p-3.5">
                      {r.items.map((it, idx) => (
                        <span
                          key={idx}
                          className="inline-block mr-1.5 mb-1 px-2 py-0.5 bg-slate-100 rounded text-[11px] font-semibold"
                        >
                          {it.itemName} × {it.quantity}
                        </span>
                      ))}
                    </td>
                    <td className="p-3.5 text-slate-600">{r.reason}</td>
                    <td className="p-3.5 text-right font-mono font-black text-emerald-700">
                      {formatTkAmount(r.totalAmount)}
                    </td>
                    <td className="p-3.5 font-mono text-slate-500">{formatDDMMYY(r.date)}</td>
                  </tr>
                ))}
                {filteredReturns.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-10 text-center text-slate-400">
                      No Purchase Returns recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: AUTO-DRAFT PO REQUISITIONS */}
      {subModule === 'orders' && (
        <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center text-xs">
            <span className="font-extrabold text-slate-800 text-sm">
              Purchase Order Requisitions History
            </span>
            <span className="font-bold text-slate-600 bg-slate-200 px-2.5 py-1 rounded-lg">
              {filteredPOs.length} Orders
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 uppercase tracking-wider text-[10px] border-b border-slate-200">
                <tr>
                  <th className="p-4 font-bold">PO No.</th>
                  <th className="p-4 font-bold">Supplier / Vendor</th>
                  <th className="p-4 font-bold text-center">Items Count</th>
                  <th className="p-4 font-bold text-right">Total Est. Amount</th>
                  <th className="p-4 font-bold">Date</th>
                  <th className="p-4 font-bold text-center">Status</th>
                  <th className="p-4 font-bold text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPOs.map((po) => (
                  <tr key={po.id} className="hover:bg-slate-50">
                    <td className="p-4 font-mono font-extrabold text-slate-900">{po.poNo}</td>
                    <td className="p-4 font-bold text-blue-700">{po.supplierName}</td>
                    <td className="p-4 text-center font-bold text-slate-800">
                      {po.items.length} Products
                    </td>
                    <td className="p-4 text-right font-mono font-bold text-slate-900">
                      {formatCurr(po.totalAmount)}
                    </td>
                    <td className="p-4 text-slate-500 font-mono">{po.date.replace('T', ' ')}</td>
                    <td className="p-4 text-center">
                      <span
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold ${
                          po.status === 'Received'
                            ? 'bg-emerald-100 text-emerald-800'
                            : po.status === 'Sent'
                            ? 'bg-blue-100 text-blue-800'
                            : po.status === 'Cancelled'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {po.status}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => setActivePO(po)}
                          className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 font-bold transition flex items-center gap-1 cursor-pointer"
                          title="View & Print PO"
                        >
                          <Eye className="w-3.5 h-3.5" /> View
                        </button>

                        <a
                          href={getWhatsAppPOUrl(po)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 bg-emerald-50 hover:bg-emerald-100 rounded-lg text-emerald-700 font-bold transition inline-flex items-center"
                          title="Send Requisition to Supplier WhatsApp"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </a>

                        {po.status !== 'Received' &&
                          (confirmReceiveId === po.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  onReceivePOItems(po);
                                  setConfirmReceiveId(null);
                                  setPoNotice({
                                    type: 'success',
                                    text: `PO ${po.poNo} marked Received and restocked into inventory.`,
                                  });
                                }}
                                className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-lg text-[10px] cursor-pointer"
                              >
                                Confirm
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmReceiveId(null)}
                                className="px-2 py-1 bg-slate-200 text-slate-700 font-bold rounded-lg text-[10px] cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmReceiveId(po.id)}
                              className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-extrabold rounded-lg text-[10px] transition cursor-pointer"
                            >
                              Receive &amp; Restock
                            </button>
                          ))}

                        <button
                          onClick={() => onDeletePO(po.id)}
                          className="p-1.5 hover:text-rose-600 transition cursor-pointer"
                          title="Delete PO"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredPOs.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-10 text-center text-slate-400">
                      No Purchase Orders found. Click &quot;Auto-Draft Low Stock POs&quot; to generate.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE MULTI-ITEM PURCHASE BILL MODAL */}
      {isBillModalOpen && (
        <div className="fixed inset-0 bg-slate-900/75 backdrop-blur-xs flex items-start justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-5xl w-full p-5 sm:p-6 space-y-4 my-auto text-slate-900">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h4 className="font-extrabold text-base text-slate-900">
                  Create Multi-Item Purchase Bill (ক্রয় ইনভয়েস / স্টক ইন)
                </h4>
                <p className="text-xs text-slate-500">
                  Adds batch + warehouse stock, logs supplier purchase report entries, and updates supplier payable due
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsBillModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitPurchaseBill} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">
                    Supplier *
                  </label>
                  <select
                    value={selectedSupplierId}
                    onChange={(e) => setSelectedSupplierId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900"
                  >
                    <option value="">-- Custom / Type Below --</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  {!selectedSupplierId && (
                    <input
                      type="text"
                      value={customSupplierName}
                      onChange={(e) => setCustomSupplierName(e.target.value)}
                      placeholder="Enter Supplier Name..."
                      className="mt-1.5 w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">
                    Bill / Chalan No *
                  </label>
                  <input
                    type="text"
                    required
                    value={billNo}
                    onChange={(e) => setBillNo(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">
                    Purchase Date
                  </label>
                  <input
                    type="date"
                    value={billDate}
                    onChange={(e) => setBillDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">
                    Receive into Godown
                  </label>
                  <select
                    value={billWarehouse}
                    onChange={(e) => setBillWarehouse(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900"
                  >
                    {warehouseList.map((w) => (
                      <option key={w} value={w}>
                        {w}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Barcode Quick Add */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                <BarcodeScannerInput
                  items={items}
                  onMatchItem={handleBarcodeAddToBill}
                  placeholder="Scan Barcode / Camera / Type SKU to add row to Purchase Bill..."
                  compact
                />
              </div>

              {/* Multi-Row Items Table */}
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full min-w-[780px] text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-[10px] uppercase font-bold text-slate-700 border-b border-slate-200">
                    <tr>
                      <th className="p-2">Product SKU *</th>
                      <th className="p-2 w-24">Batch No</th>
                      <th className="p-2 w-28">Mfg Date</th>
                      <th className="p-2 w-28">Exp Date</th>
                      <th className="p-2 w-20 text-center">Qty</th>
                      <th className="p-2 w-16 text-center">Free</th>
                      <th className="p-2 w-24 text-right">Cost Rate</th>
                      <th className="p-2 w-24 text-right">Line Total</th>
                      <th className="p-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {billRows.map((row) => {
                      const lineTotal =
                        (Number(row.quantity) || 0) * (Number(row.costPrice) || 0);
                      return (
                        <tr key={row.rowKey}>
                          <td className="p-1.5">
                            <select
                              value={row.itemId}
                              onChange={(e) =>
                                handleBillRowProductChange(row.rowKey, e.target.value)
                              }
                              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-bold"
                            >
                              <option value="">-- Select Product --</option>
                              {items.map((it) => (
                                <option key={it.id} value={it.id}>
                                  {it.name} ({it.sku})
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="p-1.5">
                            <input
                              type="text"
                              value={row.batchNo}
                              onChange={(e) =>
                                setBillRows((prev) =>
                                  prev.map((r) =>
                                    r.rowKey === row.rowKey ? { ...r, batchNo: e.target.value } : r
                                  )
                                )
                              }
                              className="w-full border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono"
                            />
                          </td>
                          <td className="p-1.5">
                            <input
                              type="date"
                              value={row.mfgDate}
                              onChange={(e) =>
                                setBillRows((prev) =>
                                  prev.map((r) =>
                                    r.rowKey === row.rowKey ? { ...r, mfgDate: e.target.value } : r
                                  )
                                )
                              }
                              className="w-full border border-slate-200 rounded-lg px-1.5 py-1 text-[11px] font-mono"
                            />
                          </td>
                          <td className="p-1.5">
                            <input
                              type="date"
                              value={row.expiryDate}
                              onChange={(e) =>
                                setBillRows((prev) =>
                                  prev.map((r) =>
                                    r.rowKey === row.rowKey ? { ...r, expiryDate: e.target.value } : r
                                  )
                                )
                              }
                              className="w-full border border-slate-200 rounded-lg px-1.5 py-1 text-[11px] font-mono"
                            />
                          </td>
                          <td className="p-1.5">
                            <input
                              type="number"
                              min="1"
                              value={row.quantity}
                              onChange={(e) =>
                                setBillRows((prev) =>
                                  prev.map((r) =>
                                    r.rowKey === row.rowKey
                                      ? {
                                          ...r,
                                          quantity: e.target.value === '' ? '' : Number(e.target.value),
                                        }
                                      : r
                                  )
                                )
                              }
                              className="w-full text-center border border-slate-300 rounded-lg px-1.5 py-1 text-xs font-mono font-bold"
                            />
                          </td>
                          <td className="p-1.5">
                            <input
                              type="number"
                              min="0"
                              value={row.bonusQty}
                              onChange={(e) =>
                                setBillRows((prev) =>
                                  prev.map((r) =>
                                    r.rowKey === row.rowKey
                                      ? {
                                          ...r,
                                          bonusQty: e.target.value === '' ? '' : Number(e.target.value),
                                        }
                                      : r
                                  )
                                )
                              }
                              className="w-full text-center border border-emerald-300 bg-emerald-50/40 rounded-lg px-1.5 py-1 text-xs font-mono font-bold"
                            />
                          </td>
                          <td className="p-1.5">
                            <input
                              type="number"
                              min="0"
                              value={row.costPrice}
                              onChange={(e) =>
                                setBillRows((prev) =>
                                  prev.map((r) =>
                                    r.rowKey === row.rowKey
                                      ? {
                                          ...r,
                                          costPrice: e.target.value === '' ? '' : Number(e.target.value),
                                        }
                                      : r
                                  )
                                )
                              }
                              className="w-full text-right border border-slate-300 rounded-lg px-1.5 py-1 text-xs font-mono font-bold"
                            />
                          </td>
                          <td className="p-1.5 text-right font-mono font-black text-slate-900">
                            {formatTkAmount(lineTotal)}
                          </td>
                          <td className="p-1.5 text-center">
                            <button
                              type="button"
                              onClick={() =>
                                setBillRows((prev) =>
                                  prev.length <= 1
                                    ? [createEmptyBillRow()]
                                    : prev.filter((r) => r.rowKey !== row.rowKey)
                                )
                              }
                              className="text-rose-500 hover:text-rose-700 p-1 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="p-2 bg-slate-50 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setBillRows((prev) => [...prev, createEmptyBillRow()])}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-extrabold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Product Row
                  </button>
                </div>
              </div>

              {/* Financial Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">
                    Discount ({currency})
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={billDiscount}
                    onChange={(e) =>
                      setBillDiscount(e.target.value === '' ? '' : Number(e.target.value))
                    }
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">
                    Transport Cost
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={billTransportCost}
                    onChange={(e) =>
                      setBillTransportCost(e.target.value === '' ? '' : Number(e.target.value))
                    }
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">
                    Upfront Paid ({currency})
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={billPaidAmount}
                    onChange={(e) =>
                      setBillPaidAmount(e.target.value === '' ? '' : Number(e.target.value))
                    }
                    placeholder="0"
                    className="w-full bg-white border border-emerald-300 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-emerald-800"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">
                    Payment Mode
                  </label>
                  <select
                    value={billPaymentMethod}
                    onChange={(e) => setBillPaymentMethod(e.target.value as any)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold"
                  >
                    <option value="Cash">Cash (Unpaid = Credit)</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="bKash">bKash</option>
                    <option value="Nagad">Nagad</option>
                    <option value="Card">Card</option>
                  </select>
                </div>
                <div className="flex flex-col justify-center text-right">
                  <span className="text-[10px] font-bold uppercase text-slate-500">
                    Grand Total: {formatTkAmount(billGrandTotal)}
                  </span>
                  <span className="text-sm font-black font-mono text-rose-700">
                    Auto Due: {formatTkAmount(billDuePreview)}
                  </span>
                </div>
              </div>

              <div>
                <input
                  type="text"
                  value={billNotes}
                  onChange={(e) => setBillNotes(e.target.value)}
                  placeholder="Optional invoice notes / challan reference..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsBillModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs cursor-pointer"
                >
                  Save Purchase Bill &amp; Restock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LOG PURCHASE RETURN MODAL */}
      {isReturnModalOpen && (
        <div className="fixed inset-0 bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4 text-slate-900">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h4 className="font-extrabold text-base text-slate-900">
                Supplier Purchase Return (ক্রয় ফেরত)
              </h4>
              <button
                type="button"
                onClick={() => setIsReturnModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmitPurchaseReturn} className="space-y-3">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Supplier *
                </label>
                <select
                  value={retSupplierId}
                  onChange={(e) => setRetSupplierId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold"
                >
                  <option value="">-- Custom / Type Below --</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                {!retSupplierId && (
                  <input
                    type="text"
                    value={retCustomSupplierName}
                    onChange={(e) => setRetCustomSupplierName(e.target.value)}
                    placeholder="Supplier Name..."
                    className="mt-1.5 w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold"
                  />
                )}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Returned Product *
                </label>
                <select
                  value={retItemId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setRetItemId(id);
                    const found = items.find((i) => i.id === id);
                    if (found) setRetUnitCost(found.costPrice);
                  }}
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold"
                >
                  <option value="">-- Select Product --</option>
                  {items.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.name} (Stock: {it.quantity})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">
                    Return Qty *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={retQty}
                    onChange={(e) => setRetQty(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">
                    Unit Cost
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={retUnitCost}
                    onChange={(e) =>
                      setRetUnitCost(e.target.value === '' ? '' : Number(e.target.value))
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={retDate}
                    onChange={(e) => setRetDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 text-[11px] font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">
                    Ref Bill No (Optional)
                  </label>
                  <input
                    type="text"
                    value={retRefBillNo}
                    onChange={(e) => setRetRefBillNo(e.target.value)}
                    placeholder="e.g. PB-2026-1001"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">
                    Return Reason
                  </label>
                  <input
                    type="text"
                    value={retReason}
                    onChange={(e) => setRetReason(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsReturnModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs cursor-pointer"
                >
                  Confirm Return &amp; Credit Due
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRINTABLE PURCHASE BILL MODAL */}
      {activeBill && (
        <div className="fixed inset-0 bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full p-6 sm:p-8 space-y-5 relative my-8 text-slate-900">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 no-print">
              <h4 className="font-extrabold text-base text-slate-800">Purchase Bill Voucher</h4>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" /> Print Bill
                </button>
                <button
                  type="button"
                  onClick={() => setActiveBill(null)}
                  className="text-slate-400 hover:text-slate-600 font-bold p-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 border border-slate-300 rounded-2xl space-y-4 bg-white text-slate-900">
              <div className="flex justify-between items-start pb-3 border-b-2 border-slate-900">
                <div>
                  <h3 className="text-xl font-black uppercase text-slate-950">{brandName}</h3>
                  <p className="text-xs font-bold text-slate-700">{storeName}</p>
                  <p className="text-[11px] text-slate-600">Tel: {phone}</p>
                </div>
                <div className="text-right">
                  <span className="px-3 py-1 bg-slate-900 text-white font-extrabold text-xs uppercase rounded">
                    PURCHASE BILL
                  </span>
                  <p className="text-xs font-mono font-bold mt-1">
                    Bill No: <strong>{activeBill.billNo}</strong>
                  </p>
                  <p className="text-[11px] font-mono text-slate-600">
                    Date: {formatDDMMYY(activeBill.date)}
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs flex justify-between">
                <div>
                  <span className="font-bold uppercase text-[10px] text-slate-500 block">
                    Supplier:
                  </span>
                  <strong className="text-sm text-slate-950">{activeBill.supplierName}</strong>
                </div>
                <div className="text-right">
                  <span className="font-bold uppercase text-[10px] text-slate-500 block">
                    Godown:
                  </span>
                  <span className="font-bold">{activeBill.warehouseName || 'Main Warehouse'}</span>
                </div>
              </div>

              <table className="w-full text-left text-xs border border-slate-300">
                <thead className="bg-slate-100 font-extrabold text-slate-900 uppercase text-[10px]">
                  <tr>
                    <th className="p-2.5 border-r border-slate-300">Product</th>
                    <th className="p-2.5 border-r border-slate-300">Batch</th>
                    <th className="p-2.5 text-center border-r border-slate-300">Qty (+Free)</th>
                    <th className="p-2.5 text-right border-r border-slate-300">Cost</th>
                    <th className="p-2.5 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {activeBill.items.map((it, idx) => (
                    <tr key={idx}>
                      <td className="p-2.5 border-r border-slate-200 font-bold">{it.itemName}</td>
                      <td className="p-2.5 border-r border-slate-200 font-mono">{it.batchNo || '-'}</td>
                      <td className="p-2.5 text-center border-r border-slate-200 font-mono font-bold">
                        {it.quantity}
                        {(it.bonusQty || 0) > 0 ? ` (+${it.bonusQty} Free)` : ''}
                      </td>
                      <td className="p-2.5 text-right border-r border-slate-200 font-mono">
                        {it.costPrice}
                      </td>
                      <td className="p-2.5 text-right font-mono font-bold">
                        {formatTkAmount(it.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex justify-end">
                <div className="w-64 bg-slate-50 border border-slate-300 rounded-xl p-3 space-y-1 text-xs font-bold">
                  <div className="flex justify-between">
                    <span>Grand Total:</span>
                    <span className="font-mono">{formatTkAmount(activeBill.totalAmount)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-700">
                    <span>Paid ({activeBill.paymentMethod || 'Cash'}):</span>
                    <span className="font-mono">{formatTkAmount(activeBill.paidAmount)}</span>
                  </div>
                  <div className="flex justify-between text-rose-700 border-t border-slate-200 pt-1 font-black">
                    <span>Balance Due:</span>
                    <span className="font-mono">{formatTkAmount(activeBill.dueAmount)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PRINTABLE PO MODAL */}
      {activePO && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full p-6 sm:p-8 space-y-5 relative my-8 text-slate-900">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 no-print">
              <h4 className="font-extrabold text-base text-slate-800">
                Purchase Order Requisition Memo
              </h4>
              <div className="flex gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" /> Print PO
                </button>
                <button
                  onClick={() => setActivePO(null)}
                  className="text-slate-400 hover:text-slate-600 font-bold p-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            <div
              id="printable-po-memo"
              className="p-6 border border-slate-300 rounded-2xl space-y-5 bg-white text-slate-900"
            >
              <div className="flex justify-between items-start pb-4 border-b-2 border-slate-900">
                <div>
                  <h3 className="text-xl font-black uppercase text-slate-950">{brandName}</h3>
                  <p className="text-xs font-bold text-slate-700">{storeName}</p>
                  <p className="text-[11px] text-slate-600">Tel: {phone}</p>
                </div>
                <div className="text-right">
                  <span className="px-3 py-1 bg-slate-900 text-white font-extrabold text-xs uppercase rounded">
                    PURCHASE ORDER
                  </span>
                  <p className="text-xs font-mono font-bold mt-1">
                    PO No: <strong>{activePO.poNo}</strong>
                  </p>
                  <p className="text-[11px] font-mono text-slate-600">
                    Date: {activePO.date.replace('T', ' ')}
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                <span className="font-extrabold uppercase text-slate-500 block mb-1">
                  Supplier / Vendor:
                </span>
                <p className="font-extrabold text-sm text-slate-950">{activePO.supplierName}</p>
                <p className="text-slate-600">Phone: {activePO.supplierPhone || 'N/A'}</p>
              </div>

              <table className="w-full text-left text-xs border border-slate-300 rounded-xl overflow-hidden">
                <thead className="bg-slate-100 font-extrabold text-slate-900 uppercase">
                  <tr>
                    <th className="p-3 border-r border-slate-300">Product Description</th>
                    <th className="p-3 text-center border-r border-slate-300">Qty</th>
                    <th className="p-3 text-right border-r border-slate-300">
                      Unit Cost ({currency})
                    </th>
                    <th className="p-3 text-right">Est. Total ({currency})</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-medium">
                  {activePO.items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="p-3 border-r border-slate-200 font-bold">{item.itemName}</td>
                      <td className="p-3 text-center border-r border-slate-200 font-bold">
                        {item.quantity}
                      </td>
                      <td className="p-3 text-right border-r border-slate-200 font-mono">
                        {item.costPrice}
                      </td>
                      <td className="p-3 text-right font-mono font-bold">
                        {item.total.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex justify-end pt-2">
                <div className="w-60 bg-slate-50 border border-slate-300 p-3 rounded-xl text-xs flex justify-between font-extrabold text-slate-950">
                  <span>Grand Total Est.:</span>
                  <span className="font-mono">{formatCurr(activePO.totalAmount)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
