import React, { useState, useMemo } from 'react';
import {
  DEFAULT_WAREHOUSES,
  StockItem,
  StockTransaction,
  StockTransfer,
  Supplier,
} from '../data/mockData';
import {
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Calendar,
  Tag,
  FileText,
  Edit,
  Trash2,
  Warehouse,
  ArrowLeftRight,
} from 'lucide-react';

import {
  getLocalYYYYMMDD,
  getFormattedLocalDateTime,
  extractYYYYMMDD,
  getDaysAgoYYYYMMDD,
  getFirstDayOfMonthYYYYMMDD,
} from '../utils/dateUtils';
import { BarcodeScannerInput } from './BarcodeLabelModal';

interface StockTransactionsViewProps {
  items: StockItem[];
  transactions: StockTransaction[];
  suppliers?: Supplier[];
  currency: string;
  userName: string;
  systemDate?: string;
  warehouses?: string[];
  stockTransfers?: StockTransfer[];
  onAddTransaction: (txn: Omit<StockTransaction, 'id' | 'totalPrice'>) => void;
  onUpdateTransaction: (txn: StockTransaction) => void;
  onDeleteTransaction: (id: string) => void;
  onTransferStock?: (params: {
    itemId: string;
    fromWarehouse: string;
    toWarehouse: string;
    quantity: number;
    date: string;
    notes: string;
  }) => { success: boolean; message?: string };
  searchQuery: string;
}

export const StockTransactionsView: React.FC<StockTransactionsViewProps> = ({
  items,
  transactions,
  suppliers = [],
  currency,
  userName,
  systemDate,
  warehouses = DEFAULT_WAREHOUSES,
  stockTransfers = [],
  onAddTransaction,
  onUpdateTransaction,
  onDeleteTransaction,
  onTransferStock,
  searchQuery,
}) => {
  const warehouseList =
    warehouses && warehouses.length > 0 ? warehouses : DEFAULT_WAREHOUSES;

  const [entryMode, setEntryMode] = useState<'stock' | 'transfer'>('stock');
  const [selectedItemId, setSelectedItemId] = useState<string>(
    items[0]?.id || ''
  );
  const [type, setType] = useState<'IN' | 'OUT' | 'RETURN'>('IN');
  const [txnDate, setTxnDate] = useState<string>(
    systemDate || getLocalYYYYMMDD()
  );
  const [quantity, setQuantity] = useState<number | ''>('');
  const [reference, setReference] = useState('REQ-2026-0518');
  const [supplierName, setSupplierName] = useState<string>(items[0]?.supplier || '');
  const [notes, setNotes] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [editingTxn, setEditingTxn] = useState<StockTransaction | null>(null);

  const supplierOptions = useMemo(() => {
    const set = new Set<string>();
    suppliers.forEach((s) => s.name?.trim() && set.add(s.name.trim()));
    items.forEach((it) => it.supplier?.trim() && set.add(it.supplier.trim()));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [suppliers, items]);

  // Warehouse transfer form state
  const [fromWh, setFromWh] = useState<string>(warehouseList[0] || '');
  const [toWh, setToWh] = useState<string>(
    warehouseList[1] || warehouseList[0] || ''
  );
  const [transferQty, setTransferQty] = useState<number | ''>('');
  const [transferNotes, setTransferNotes] = useState('');

  // History Table Date Filtering State (Default to All Time so all existing logs show initially)
  const [historyStart, setHistoryStart] = useState<string>('2000-01-01');
  const [historyEnd, setHistoryEnd] = useState<string>('2100-12-31');
  const [activeHistoryPreset, setActiveHistoryPreset] =
    useState<string>('All Time');

  const handleHistoryPreset = (preset: string) => {
    setActiveHistoryPreset(preset);
    const today = getLocalYYYYMMDD();
    if (preset === 'Today') {
      setHistoryStart(today);
      setHistoryEnd(today);
    } else if (preset === 'Yesterday') {
      const yesterday = getDaysAgoYYYYMMDD(1);
      setHistoryStart(yesterday);
      setHistoryEnd(yesterday);
    } else if (preset === 'Last 7 Days') {
      setHistoryStart(getDaysAgoYYYYMMDD(7));
      setHistoryEnd(today);
    } else if (preset === 'This Month') {
      setHistoryStart(getFirstDayOfMonthYYYYMMDD());
      setHistoryEnd(today);
    } else if (preset === 'All Time') {
      setHistoryStart('2000-01-01');
      setHistoryEnd('2100-12-31');
    }
  };

  const selectedItem = items.find((i) => i.id === selectedItemId) || items[0];

  const handleLogTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    const finalQuantity = Number(quantity);
    if (!selectedItem || finalQuantity <= 0) return;

    let availableQty = selectedItem.quantity;
    if (editingTxn && editingTxn.type === 'OUT') {
      availableQty += editingTxn.quantity;
    } else if (
      editingTxn &&
      (editingTxn.type === 'IN' || editingTxn.type === 'RETURN')
    ) {
      availableQty -= editingTxn.quantity;
    }

    if (type === 'OUT' && finalQuantity > availableQty) {
      setErrorMsg(
        `Cannot dispatch ${finalQuantity} ${selectedItem.unit}. Only ${availableQty} available!`
      );
      return;
    }

    const formattedDate = getFormattedLocalDateTime(txnDate);

    if (editingTxn) {
      const resolvedSupplier =
        type === 'IN'
          ? supplierName.trim() || selectedItem.supplier || undefined
          : undefined;
      onUpdateTransaction({
        ...editingTxn,
        itemId: selectedItem.id,
        itemName: selectedItem.name,
        type,
        quantity: finalQuantity,
        unitPrice:
          type === 'IN' || type === 'RETURN'
            ? selectedItem.costPrice
            : selectedItem.price,
        date: formattedDate,
        reference,
        supplierName: resolvedSupplier,
        category: selectedItem.category,
        notes:
          notes.trim() ||
          (type === 'IN'
            ? resolvedSupplier
              ? `Stock replenishment from ${resolvedSupplier}`
              : 'Stock replenishment'
            : type === 'RETURN'
            ? 'Customer/Ward Return'
            : 'Dispatched / Issued'),
      });
      setSuccessMsg(`Successfully updated transaction ${editingTxn.id}`);
    } else {
      const resolvedSupplier =
        type === 'IN'
          ? supplierName.trim() || selectedItem.supplier || undefined
          : undefined;
      onAddTransaction({
        itemId: selectedItem.id,
        itemName: selectedItem.name,
        type,
        quantity: finalQuantity,
        unitPrice:
          type === 'IN' || type === 'RETURN'
            ? selectedItem.costPrice
            : selectedItem.price,
        date: formattedDate,
        user: userName,
        reference,
        supplierName: resolvedSupplier,
        category: selectedItem.category,
        notes:
          notes.trim() ||
          (type === 'IN'
            ? resolvedSupplier
              ? `Stock replenishment from ${resolvedSupplier}`
              : 'Stock replenishment'
            : type === 'RETURN'
            ? 'Customer/Ward Return'
            : 'Dispatched / Issued'),
      });
      setSuccessMsg(
        `Successfully logged ${
          type === 'IN'
            ? 'Stock Intake'
            : type === 'RETURN'
            ? 'Stock Return'
            : 'Stock Dispatch'
        } of ${finalQuantity} ${selectedItem.unit} for ${selectedItem.name}!`
      );
    }

    setEditingTxn(null);
    setQuantity('');
    setNotes('');
    setReference(`REQ-2026-${Math.floor(1000 + Math.random() * 9000)}`);

    setTimeout(() => {
      setSuccessMsg('');
    }, 4000);
  };

  const handleSubmitTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!selectedItem || !onTransferStock) return;
    const qty = Number(transferQty);
    const res = onTransferStock({
      itemId: selectedItem.id,
      fromWarehouse: fromWh,
      toWarehouse: toWh,
      quantity: qty,
      date: txnDate,
      notes: transferNotes.trim(),
    });
    if (!res.success) {
      setErrorMsg(res.message || 'Transfer failed.');
      return;
    }
    setSuccessMsg(
      `Transferred ${qty} ${selectedItem.unit} of ${selectedItem.name} from ${fromWh} to ${toWh}.`
    );
    setTransferQty('');
    setTransferNotes('');
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const handleEditClick = (txn: StockTransaction) => {
    setEntryMode('stock');
    setEditingTxn(txn);
    setSelectedItemId(txn.itemId);
    if (txn.type === 'IN' || txn.type === 'OUT' || txn.type === 'RETURN')
      setType(txn.type);
    setTxnDate(extractYYYYMMDD(txn.date));
    setQuantity(txn.quantity);
    setReference(txn.reference);
    const matchedItem = items.find((i) => i.id === txn.itemId);
    setSupplierName(txn.supplierName || matchedItem?.supplier || '');
    setNotes(txn.notes);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const filteredTxns = useMemo(() => {
    return transactions.filter((t) => {
      const d = extractYYYYMMDD(t.date);
      const inDateRange = d >= historyStart && d <= historyEnd;
      const matchesSearch =
        t.itemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.reference.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.user.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.supplierName || '').toLowerCase().includes(searchQuery.toLowerCase());
      return inDateRange && matchesSearch;
    });
  }, [transactions, historyStart, historyEnd, searchQuery]);

  const itemWhMap: Record<string, number> = useMemo(() => {
    if (!selectedItem) return {};
    if (
      selectedItem.warehouseStocks &&
      Object.keys(selectedItem.warehouseStocks).length > 0
    ) {
      return selectedItem.warehouseStocks;
    }
    return { [warehouseList[0] || 'Main Warehouse']: selectedItem.quantity };
  }, [selectedItem, warehouseList]);

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto min-h-full">
      {/* Log Transaction Form & Quick Guide */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-xs border border-slate-200 col-span-1 lg:col-span-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-emerald-600" />
              <div>
                <h3 className="font-bold text-slate-800 text-base">
                  Stock Entry, Dispatch &amp; Godown Transfer
                </h3>
                <p className="text-xs text-slate-500">
                  Inventory &amp; warehouse stocks update in real-time
                </p>
              </div>
            </div>

            {onTransferStock && (
              <div className="inline-flex bg-slate-100 p-1 rounded-xl text-xs font-bold">
                <button
                  type="button"
                  onClick={() => {
                    setEntryMode('stock');
                    setErrorMsg('');
                  }}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                    entryMode === 'stock'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600'
                  }`}
                >
                  Stock IN / OUT / RETURN
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEntryMode('transfer');
                    setErrorMsg('');
                  }}
                  className={`px-3 py-1.5 rounded-lg flex items-center gap-1 transition cursor-pointer ${
                    entryMode === 'transfer'
                      ? 'bg-slate-900 text-emerald-400 shadow-xs'
                      : 'text-slate-600'
                  }`}
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                  <span>Warehouse Transfer</span>
                </button>
              </div>
            )}
          </div>

          {successMsg && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2">
              <span>{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold">
              {errorMsg}
            </div>
          )}

          {entryMode === 'stock' ? (
            <form onSubmit={handleLogTransaction} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2 space-y-2">
                  <BarcodeScannerInput
                    items={items}
                    onMatchItem={(matched) => {
                      setSelectedItemId(matched.id);
                      if (matched.supplier) {
                        setSupplierName(matched.supplier);
                      }
                    }}
                    placeholder="Scan Barcode / Camera / Type SKU to quick-select product..."
                    compact
                  />
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 tracking-wide">
                    Select Product / Inventory SKU *
                  </label>
                  <select
                    value={selectedItemId}
                    onChange={(e) => {
                      const nextId = e.target.value;
                      setSelectedItemId(nextId);
                      const nextItem = items.find((i) => i.id === nextId);
                      if (nextItem?.supplier) {
                        setSupplierName(nextItem.supplier);
                      }
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                  >
                    {items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} ({item.sku}) — Available: {item.quantity}{' '}
                        {item.unit}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 tracking-wide">
                    Transaction Type
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setType('IN')}
                      className={`py-2.5 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition cursor-pointer ${
                        type === 'IN'
                          ? 'bg-emerald-500 text-slate-950 shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <ArrowUpRight className="w-3.5 h-3.5" />
                      <span>IN (+)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setType('OUT')}
                      className={`py-2.5 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition cursor-pointer ${
                        type === 'OUT'
                          ? 'bg-cyan-500 text-slate-950 shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <ArrowDownRight className="w-3.5 h-3.5" />
                      <span>OUT (-)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setType('RETURN')}
                      className={`py-2.5 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition cursor-pointer ${
                        type === 'RETURN'
                          ? 'bg-amber-400 text-slate-950 shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>RETURN (+)</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 tracking-wide">
                    Transaction Date *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Calendar className="w-4 h-4 text-emerald-600" />
                    </div>
                    <input
                      type="date"
                      required
                      value={txnDate}
                      onChange={(e) => setTxnDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-3 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition cursor-pointer"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 tracking-wide">
                    Quantity ({selectedItem?.unit})
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={quantity}
                    onChange={(e) =>
                      setQuantity(
                        e.target.value === '' ? '' : Number(e.target.value)
                      )
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 tracking-wide">
                    Requisition / PO Reference
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Tag className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      required
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono focus:bg-white transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 tracking-wide">
                    Calculated Unit Price
                  </label>
                  <div className="w-full bg-slate-100 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 font-mono font-bold">
                    {currency}{' '}
                    {type === 'IN' || type === 'RETURN'
                      ? selectedItem?.costPrice
                      : selectedItem?.price}{' '}
                    / {selectedItem?.unit.slice(0, -1)}
                  </div>
                </div>

                {type === 'IN' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 tracking-wide">
                      Bought From (Supplier / Vendor)
                    </label>
                    <input
                      type="text"
                      list="stock-in-suppliers-list"
                      value={supplierName}
                      onChange={(e) => setSupplierName(e.target.value)}
                      placeholder={selectedItem?.supplier || 'Select or type supplier name...'}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                    />
                    <datalist id="stock-in-suppliers-list">
                      {supplierOptions.map((s) => (
                        <option key={s} value={s} />
                      ))}
                    </datalist>
                  </div>
                )}

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 tracking-wide">
                    Notes / Remarks
                  </label>
                  <div className="relative">
                    <div className="absolute top-3 left-3 pointer-events-none text-slate-400">
                      <FileText className="w-4 h-4" />
                    </div>
                    <textarea
                      rows={2}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Enter dispatch details, supplier invoice details, or staff requisition IDs..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                    ></textarea>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <div className="text-xs text-slate-500">
                  Total Transaction Val:{' '}
                  <strong className="text-slate-900 font-bold">
                    {currency}{' '}
                    {selectedItem
                      ? (
                          (Number(quantity) || 0) *
                          (type === 'IN' || type === 'RETURN'
                            ? selectedItem.costPrice
                            : selectedItem.price)
                        ).toLocaleString()
                      : 0}
                  </strong>
                </div>
                <div className="flex gap-2">
                  {editingTxn && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingTxn(null);
                        setQuantity(50);
                        setNotes('');
                        setReference(
                          `REQ-2026-${Math.floor(1000 + Math.random() * 9000)}`
                        );
                      }}
                      className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                    >
                      Cancel Edit
                    </button>
                  )}
                  <button
                    type="submit"
                    className="bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-slate-950 font-bold px-6 py-2.5 rounded-xl text-xs shadow-sm transition cursor-pointer"
                  >
                    {editingTxn ? 'Save Changes' : 'Confirm & Log Transaction'}
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSubmitTransfer} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 tracking-wide">
                    Select Product to Transfer *
                  </label>
                  <select
                    value={selectedItemId}
                    onChange={(e) => setSelectedItemId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800"
                  >
                    {items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} ({item.sku}) — Total: {item.quantity}{' '}
                        {item.unit}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 tracking-wide">
                    From Source Warehouse *
                  </label>
                  <select
                    value={fromWh}
                    onChange={(e) => setFromWh(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800"
                  >
                    {warehouseList.map((wh) => (
                      <option key={wh} value={wh}>
                        {wh} (Avail: {itemWhMap[wh] ?? 0} {selectedItem?.unit})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 tracking-wide">
                    To Destination Warehouse *
                  </label>
                  <select
                    value={toWh}
                    onChange={(e) => setToWh(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800"
                  >
                    {warehouseList.map((wh) => (
                      <option key={wh} value={wh}>
                        {wh}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 tracking-wide">
                    Transfer Quantity ({selectedItem?.unit}) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={transferQty}
                    onChange={(e) =>
                      setTransferQty(
                        e.target.value === '' ? '' : Number(e.target.value)
                      )
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 tracking-wide">
                    Transfer Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={txnDate}
                    onChange={(e) => setTxnDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 tracking-wide">
                    Transfer Notes
                  </label>
                  <input
                    type="text"
                    value={transferNotes}
                    onChange={(e) => setTransferNotes(e.target.value)}
                    placeholder="e.g. Dhaka depot replenishment..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex justify-end">
                <button
                  type="submit"
                  className="bg-slate-900 hover:bg-slate-800 text-emerald-400 font-extrabold px-6 py-2.5 rounded-xl text-xs shadow-sm flex items-center gap-2 cursor-pointer"
                >
                  <ArrowLeftRight className="w-4 h-4" />
                  <span>Execute Warehouse Transfer</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Selected Item Quick Profile */}
        <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xs border border-slate-800 flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest block mb-1">
              Selected Item Overview
            </span>
            <h4 className="text-xl font-extrabold text-white">
              {selectedItem?.name}
            </h4>
            <p className="text-xs text-slate-400 font-mono mt-1">
              SKU: {selectedItem?.sku} • {selectedItem?.location}
            </p>

            <div className="my-5 space-y-2.5 bg-slate-800/80 p-4 rounded-xl border border-slate-700">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Total Available:</span>
                <span className="font-extrabold text-white">
                  {selectedItem?.quantity} {selectedItem?.unit}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Reorder Alert At:</span>
                <span className="font-semibold text-amber-400">
                  {selectedItem?.reorderThreshold} {selectedItem?.unit}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Category:</span>
                <span className="text-slate-200">{selectedItem?.category}</span>
              </div>
              <div className="flex justify-between text-xs pt-2 border-t border-slate-700">
                <span className="text-slate-400">Selling Price:</span>
                <span className="font-bold text-cyan-400">
                  {currency} {selectedItem?.price}
                </span>
              </div>
            </div>

            {selectedItem && (
              <div className="space-y-1.5 mb-4">
                <div className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1">
                  <Warehouse className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Stock By Warehouse</span>
                </div>
                <div className="grid grid-cols-1 gap-1.5">
                  {warehouseList.map((wh) => (
                    <div
                      key={wh}
                      className="flex items-center justify-between bg-slate-800/60 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs"
                    >
                      <span className="text-slate-300 truncate">{wh}</span>
                      <span className="font-mono font-extrabold text-emerald-400">
                        {itemWhMap[wh] ?? 0} {selectedItem.unit}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-300">
            <strong>Smart Restock Note:</strong> FEFO deducts earliest-expiry batches first during Stock OUT. Transfers move quantities between godowns without altering total stock.
          </div>
        </div>
      </div>

      {stockTransfers.length > 0 && (
        <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ArrowLeftRight className="w-4 h-4 text-indigo-600" />
              <h4 className="font-extrabold text-slate-900 text-sm">
                Warehouse / Godown Transfer History
              </h4>
            </div>
            <span className="px-2.5 py-1 bg-indigo-100 text-indigo-800 rounded-xl text-xs font-extrabold">
              {stockTransfers.length} Transfers
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-600 uppercase text-[10px] border-b border-slate-200">
                <tr>
                  <th className="p-3 font-bold">Transfer No</th>
                  <th className="p-3 font-bold">Product</th>
                  <th className="p-3 font-bold">Route</th>
                  <th className="p-3 font-bold text-right">Qty</th>
                  <th className="p-3 font-bold">Date</th>
                  <th className="p-3 font-bold">Operator</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stockTransfers.map((tr) => (
                  <tr key={tr.id} className="hover:bg-slate-50">
                    <td className="p-3 font-mono font-bold text-indigo-700">
                      {tr.transferNo}
                    </td>
                    <td className="p-3 font-bold text-slate-900">
                      {tr.itemName}{' '}
                      <span className="text-[10px] font-mono text-slate-400">
                        ({tr.sku})
                      </span>
                    </td>
                    <td className="p-3 font-semibold text-slate-700">
                      {tr.fromWarehouse} → {tr.toWarehouse}
                    </td>
                    <td className="p-3 text-right font-mono font-extrabold text-slate-900">
                      {tr.quantity}
                    </td>
                    <td className="p-3 font-mono text-slate-500">{tr.date}</td>
                    <td className="p-3 text-slate-600">{tr.user}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Transaction History Log Table */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
        {/* Table Filter Header Bar */}
        <div className="p-4 bg-slate-50/80 border-b border-slate-200/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-teal-600" />
              <h4 className="font-extrabold text-slate-900 text-sm">All Logged Transactions History (ট্রানজেকশন খাতা)</h4>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">Filter transaction audit history by date presets or custom range</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Presets */}
            <div className="flex flex-wrap items-center gap-1 bg-slate-200/70 p-1 rounded-xl text-xs font-bold max-w-full">
              {['Today', 'Yesterday', 'Last 7 Days', 'This Month', 'All Time'].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handleHistoryPreset(preset)}
                  className={`px-2.5 py-1 rounded-lg transition whitespace-nowrap ${
                    activeHistoryPreset === preset 
                      ? 'bg-white text-teal-700 shadow-xs font-extrabold' 
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>

            {/* Custom Date Pickers */}
            <div className="flex flex-wrap items-center gap-1.5 bg-white border border-slate-200 rounded-xl p-1 max-w-full">
              <input
                type="date"
                value={historyStart}
                onChange={(e) => {
                  setHistoryStart(e.target.value);
                  setActiveHistoryPreset('Custom');
                }}
                className="text-xs font-bold text-slate-800 bg-transparent outline-none px-1 cursor-pointer min-w-0"
              />
              <span className="text-xs font-bold text-slate-400">to</span>
              <input
                type="date"
                value={historyEnd}
                onChange={(e) => {
                  setHistoryEnd(e.target.value);
                  setActiveHistoryPreset('Custom');
                }}
                className="text-xs font-bold text-slate-800 bg-transparent outline-none px-1 cursor-pointer min-w-0"
              />
            </div>

            <span className="px-2.5 py-1 bg-teal-100 text-teal-800 font-extrabold text-xs rounded-xl ml-auto md:ml-0">
              {filteredTxns.length} Records
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-600 uppercase tracking-wider text-[10px] border-b border-slate-200">
              <tr>
                <th className="p-4 font-bold">Transaction ID & Ref</th>
                <th className="p-4 font-bold">Type</th>
                <th className="p-4 font-bold">Medicine / Item</th>
                <th className="p-4 font-bold">Quantity</th>
                <th className="p-4 font-bold">Unit Price</th>
                <th className="p-4 font-bold">Total Amount</th>
                <th className="p-4 font-bold">Date & Time</th>
                <th className="p-4 font-bold">Operator</th>
                <th className="p-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTxns.map(t => (
                <tr key={t.id} className={`hover:bg-slate-50/80 transition ${editingTxn?.id === t.id ? 'bg-emerald-50/50' : ''}`}>
                  <td className="p-4">
                    <div className="font-mono font-bold text-slate-900 text-xs">{t.id}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{t.reference}</div>
                  </td>
                  <td className="p-4 font-medium">
                    <span className={`whitespace-nowrap inline-block px-2 py-1 rounded-lg text-[10px] font-bold ${
                      t.type === 'IN' ? 'bg-emerald-100 text-emerald-700' : t.type === 'RETURN' ? 'bg-amber-100 text-amber-700' : 'bg-cyan-100 text-cyan-700'
                    }`}>
                      {t.type === 'IN' ? 'STOCK IN' : t.type === 'RETURN' ? 'RETURN' : 'STOCK OUT'}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="font-bold text-slate-800">{t.itemName}</div>
                    {t.type === 'IN' && (t.supplierName || t.category) && (
                      <div className="text-[10px] font-semibold text-emerald-700 mt-0.5">
                        {t.supplierName ? `From: ${t.supplierName}` : ''}
                        {t.supplierName && t.category ? ' • ' : ''}
                        {t.category || ''}
                      </div>
                    )}
                  </td>
                  <td className="p-4 font-extrabold text-slate-900">{t.quantity}</td>
                  <td className="p-4 text-slate-600 font-mono">{currency} {t.unitPrice}</td>
                  <td className="p-4 font-bold text-slate-900 font-mono">{currency} {t.totalPrice.toLocaleString()}</td>
                  <td className="p-4 text-slate-500">{t.date.replace('T', ' ')}</td>
                  <td className="p-4 text-slate-600 font-medium">{t.user}</td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => handleEditClick(t)} className="p-1 hover:text-emerald-600 transition" title="Edit Transaction">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button onClick={() => onDeleteTransaction(t.id)} className="p-1 hover:text-rose-600 transition" title="Delete Transaction">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredTxns.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-10 text-slate-400">
                    No transactions match the search term.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
