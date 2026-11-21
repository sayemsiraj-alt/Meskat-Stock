import React, { useState, useMemo } from 'react';
import { DamagedStock, StockItem } from '../data/mockData';
import { 
  AlertOctagon, 
  Trash2, 
  ShieldAlert, 
  Clock
} from 'lucide-react';
import { getFormattedLocalDateTime } from '../utils/dateUtils';

interface ExpiryDamageViewProps {
  items: StockItem[];
  damagedStockList: DamagedStock[];
  currency: string;
  userName: string;
  onAddDamagedStock: (dmg: Omit<DamagedStock, 'id'>) => void;
  onDeleteDamagedStock: (id: string) => void;
  searchQuery: string;
}

export const ExpiryDamageView: React.FC<ExpiryDamageViewProps> = ({
  items,
  damagedStockList,
  currency,
  userName,
  onAddDamagedStock,
  onDeleteDamagedStock,
  searchQuery
}) => {
  const [activeTab, setActiveTab] = useState<'expiry' | 'damaged'>('expiry');
  const [daysFilter, setDaysFilter] = useState<number>(60); // 30, 60, 90 days

  // Damaged modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string>(items[0]?.id || '');
  const [dmgQty, setDmgQty] = useState<number | ''>('');
  const [reason, setReason] = useState<DamagedStock['reason']>('Expired');
  const [notes, setNotes] = useState('');
  const [dmgError, setDmgError] = useState('');

  const formatCurr = (val: number) => {
    const sym = currency.includes('৳') || currency.toLowerCase().includes('bdt') ? '৳' : currency;
    return `${sym} ${val.toLocaleString()}`;
  };

  // Find expiring items (expanding multi-batch FEFO lots when present)
  const expiringItems = useMemo(() => {
    const today = new Date();
    const rows: Array<
      StockItem & { rowKey: string; daysLeft: number }
    > = [];

    items.forEach((item) => {
      const matchesSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.sku.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return;

      const activeBatches = (item.batches || []).filter((b) => b.quantity > 0 && b.expiryDate);
      if (activeBatches.length > 0) {
        activeBatches.forEach((b) => {
          const exp = new Date(b.expiryDate);
          const diffDays = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays <= daysFilter) {
            rows.push({
              ...item,
              rowKey: `${item.id}-${b.id}`,
              batchNo: b.batchNo,
              expiryDate: b.expiryDate,
              quantity: b.quantity,
              daysLeft: diffDays,
            });
          }
        });
      } else if (item.expiryDate) {
        const exp = new Date(item.expiryDate);
        const diffDays = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays <= daysFilter) {
          rows.push({
            ...item,
            rowKey: item.id,
            daysLeft: diffDays,
          });
        }
      }
    });

    return rows.sort((a, b) => a.daysLeft - b.daysLeft);
  }, [items, daysFilter, searchQuery]);

  // Total Damaged Stock Loss
  const totalDamagedCost = useMemo(() => {
    return damagedStockList.reduce((sum, d) => sum + d.costValue, 0);
  }, [damagedStockList]);

  const filteredDamagedList = damagedStockList.filter(d => 
    d.itemName.toLowerCase().includes(searchQuery.toLowerCase()) || 
    d.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.reason.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedItem = items.find(i => i.id === selectedItemId) || items[0];

  const handleLogDamaged = (e: React.FormEvent) => {
    e.preventDefault();
    setDmgError('');
    const finalQty = Number(dmgQty);
    if (!selectedItem || finalQty <= 0) return;

    if (finalQty > selectedItem.quantity) {
      setDmgError(`Cannot write off ${finalQty} ${selectedItem.unit}. Only ${selectedItem.quantity} available!`);
      return;
    }

    onAddDamagedStock({
      itemId: selectedItem.id,
      itemName: selectedItem.name,
      sku: selectedItem.sku,
      quantity: finalQty,
      unit: selectedItem.unit,
      reason,
      costValue: finalQty * selectedItem.costPrice,
      date: getFormattedLocalDateTime(),
      user: userName,
      notes
    });

    setIsModalOpen(false);
    setDmgQty('');
    setNotes('');
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1600px] mx-auto min-h-full">
      {/* Top Action Banner */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-xs border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-extrabold text-slate-800 text-base">Expiry Date Tracker & Damaged Stock Disposal</h3>
          <p className="text-xs text-slate-500 mt-0.5">Track items expiring soon & log damaged/expired goods disposal</p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-gradient-to-r from-rose-500 to-red-600 text-white font-extrabold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-sm transition hover:from-rose-600"
        >
          <AlertOctagon className="w-4 h-4" />
          <span>Write Off Damaged/Expired Stock</span>
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('expiry')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'expiry' ? 'bg-amber-500 text-slate-950 shadow-xs font-extrabold' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>⏳ Expiring Soon Products Alert</span>
        </button>
        <button
          onClick={() => setActiveTab('damaged')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'damaged' ? 'bg-rose-500 text-white shadow-xs font-extrabold' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>🗑️ Damaged / Expired Write-Off Ledger</span>
        </button>
      </div>

      {/* TAB 1: EXPIRING SOON PRODUCTS BOARD */}
      {activeTab === 'expiry' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl shadow-xs border border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-bold text-slate-700">Filter Expiring Within:</span>
            <div className="flex flex-wrap items-center gap-2 max-w-full">
              {[30, 60, 90, 180].map(days => (
                <button
                  key={days}
                  onClick={() => setDaysFilter(days)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    daysFilter === days ? 'bg-slate-900 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {days} Days ({days === 30 ? 'Critical' : days === 60 ? 'Warning' : 'Upcoming'})
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 font-extrabold text-slate-800 text-sm">
              Products Expiring within next {daysFilter} days ({expiringItems.length} Products Found)
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 uppercase tracking-wider text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="p-4 font-bold">Product Name & SKU</th>
                    <th className="p-4 font-bold">Batch Number</th>
                    <th className="p-4 font-bold text-center">In-Stock Quantity</th>
                    <th className="p-4 font-bold">Expiry Date</th>
                    <th className="p-4 font-bold text-center">Days Remaining</th>
                    <th className="p-4 font-bold text-center">Alert Urgency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {expiringItems.map(item => {
                    const isExpired = item.daysLeft <= 0;
                    const isUrgent = item.daysLeft > 0 && item.daysLeft <= 30;

                    return (
                      <tr key={item.rowKey} className="hover:bg-slate-50">
                        <td className="p-4 font-extrabold text-slate-900">
                          <div>{item.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">{item.sku} • {item.category}</div>
                        </td>
                        <td className="p-4 font-mono font-bold text-slate-700">{item.batchNo}</td>
                        <td className="p-4 text-center font-extrabold text-slate-900">{item.quantity} {item.unit}</td>
                        <td className="p-4 font-mono font-bold text-slate-800">{item.expiryDate}</td>
                        <td className="p-4 text-center font-extrabold font-mono">
                          {isExpired ? (
                            <span className="text-rose-600">EXPIRED ({Math.abs(item.daysLeft)} days ago)</span>
                          ) : (
                            <span className={isUrgent ? 'text-rose-600' : 'text-amber-600'}>{item.daysLeft} Days</span>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          <span className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold ${
                            isExpired ? 'bg-rose-500 text-white' : isUrgent ? 'bg-rose-100 text-rose-800 border border-rose-300' : 'bg-amber-100 text-amber-800 border border-amber-300'
                          }`}>
                            {isExpired ? '🔴 EXPIRED' : isUrgent ? '⚠️ CRITICAL (<30 Days)' : '🟡 WARNING (<60 Days)'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {expiringItems.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-10 text-center text-slate-400">
                        🎉 Great! No products expiring within the next {daysFilter} days.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DAMAGED / EXPIRED DISPOSAL LEDGER */}
      {activeTab === 'damaged' && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex justify-between items-center">
            <div>
              <span className="text-xs font-bold uppercase text-slate-500 block mb-0.5">Total Damaged & Expired Loss Value</span>
              <span className="text-2xl font-black text-rose-600">{formatCurr(totalDamagedCost)}</span>
            </div>
            <span className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-xl">
              {damagedStockList.length} Written-Off Vouchers
            </span>
          </div>

          <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 uppercase tracking-wider text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="p-4 font-bold">Product Name & SKU</th>
                    <th className="p-4 font-bold text-center">Quantity</th>
                    <th className="p-4 font-bold text-center">Reason</th>
                    <th className="p-4 font-bold text-right">Loss Cost Value</th>
                    <th className="p-4 font-bold">Disposal Date</th>
                    <th className="p-4 font-bold">Operator</th>
                    <th className="p-4 font-bold text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredDamagedList.map(dmg => (
                    <tr key={dmg.id} className="hover:bg-slate-50">
                      <td className="p-4 font-extrabold text-slate-900">
                        <div>{dmg.itemName}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">{dmg.sku}</div>
                      </td>
                      <td className="p-4 text-center font-extrabold text-rose-600">{dmg.quantity} {dmg.unit}</td>
                      <td className="p-4 text-center">
                        <span className="px-2.5 py-1 bg-rose-100 text-rose-800 border border-rose-200 rounded-lg text-[10px] font-extrabold">
                          {dmg.reason}
                        </span>
                      </td>
                      <td className="p-4 text-right font-mono font-extrabold text-rose-600">{formatCurr(dmg.costValue)}</td>
                      <td className="p-4 font-mono text-slate-500">{dmg.date.replace('T', ' ')}</td>
                      <td className="p-4 font-bold text-slate-800">{dmg.user}</td>
                      <td className="p-4 text-center">
                        <button onClick={() => onDeleteDamagedStock(dmg.id)} className="text-slate-400 hover:text-rose-600 transition" title="Delete Record">
                          <Trash2 className="w-4 h-4 mx-auto" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredDamagedList.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-10 text-center text-slate-400">No damaged or expired goods logged.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ADD DAMAGED STOCK MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 sm:p-8 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-800 text-lg">Write Off Damaged / Expired Stock</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            {dmgError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold">
                {dmgError}
              </div>
            )}
            <form onSubmit={handleLogDamaged} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Select Product *</label>
                <select
                  value={selectedItemId}
                  onChange={(e) => setSelectedItemId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500"
                >
                  {items.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.sku}) — Available: {item.quantity} {item.unit}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Write-Off Reason *</label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500"
                >
                  <option value="Expired">Expired Medicine/Product (মেয়াদ উত্তীর্ণ)</option>
                  <option value="Damaged">Damaged / Leaked Container (নষ্ট/ভাঙা)</option>
                  <option value="Broken">Broken Seal / Quality Issue</option>
                  <option value="Lost">Lost / Missing Stock</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Quantity to Dispose ({selectedItem?.unit}) *</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={dmgQty}
                  onChange={(e) => setDmgQty(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="0"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Notes / Remarks</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Broken bottle during transport..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50">Cancel</button>
                <button type="submit" className="px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs shadow-md">
                  Confirm Disposal & Deduct Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
