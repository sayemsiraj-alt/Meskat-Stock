import React, { useMemo, useState } from 'react';
import { Invoice, SalesRep, Wholesaler } from '../data/mockData';
import { computeSalesRepMetrics } from '../utils/erpEnhancements';
import { formatTkAmount } from '../utils/numberToWords';
import { getFirstDayOfMonthYYYYMMDD, getLocalYYYYMMDD } from '../utils/dateUtils';
import {
  Award,
  Download,
  Edit,
  MapPin,
  Phone,
  Plus,
  Trash2,
  TrendingUp,
  UserCheck,
  X,
} from 'lucide-react';

interface SalesRepsViewProps {
  salesReps: SalesRep[];
  wholesalers: Wholesaler[];
  invoices: Invoice[];
  currency: string;
  onAddSalesRep: (rep: Omit<SalesRep, 'id'>) => void;
  onUpdateSalesRep: (rep: SalesRep) => void;
  onDeleteSalesRep: (id: string) => void;
  searchQuery: string;
}

export const SalesRepsView: React.FC<SalesRepsViewProps> = ({
  salesReps,
  wholesalers,
  invoices,
  currency,
  onAddSalesRep,
  onUpdateSalesRep,
  onDeleteSalesRep,
  searchQuery,
}) => {
  const [startDate, setStartDate] = useState(getFirstDayOfMonthYYYYMMDD());
  const [endDate, setEndDate] = useState(getLocalYYYYMMDD());
  const [showAllTime, setShowAllTime] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRep, setEditingRep] = useState<SalesRep | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [area, setArea] = useState('');
  const [commissionRate, setCommissionRate] = useState('2');
  const [monthlyTarget, setMonthlyTarget] = useState('100000');
  const [status, setStatus] = useState<'Active' | 'Inactive'>('Active');

  const formatSym =
    currency.includes('৳') || currency.toLowerCase().includes('bdt')
      ? '৳'
      : currency;

  const metrics = useMemo(
    () =>
      computeSalesRepMetrics(
        salesReps,
        wholesalers,
        invoices,
        showAllTime ? undefined : startDate,
        showAllTime ? undefined : endDate
      ).filter(
        (m) =>
          !searchQuery.trim() ||
          m.rep.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.rep.area.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.rep.phone.includes(searchQuery)
      ),
    [salesReps, wholesalers, invoices, showAllTime, startDate, endDate, searchQuery]
  );

  const totals = useMemo(
    () =>
      metrics.reduce(
        (acc, m) => ({
          sales: acc.sales + m.totalSales,
          collected: acc.collected + m.totalCollected,
          commission: acc.commission + m.earnedCommission,
        }),
        { sales: 0, collected: 0, commission: 0 }
      ),
    [metrics]
  );

  const openAddModal = () => {
    setEditingRep(null);
    setName('');
    setPhone('');
    setArea('');
    setCommissionRate('2');
    setMonthlyTarget('100000');
    setStatus('Active');
    setIsModalOpen(true);
  };

  const openEditModal = (rep: SalesRep) => {
    setEditingRep(rep);
    setName(rep.name);
    setPhone(rep.phone);
    setArea(rep.area);
    setCommissionRate(String(rep.commissionRate));
    setMonthlyTarget(String(rep.monthlyTarget));
    setStatus(rep.status);
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const payload = {
      name: name.trim(),
      phone: phone.trim(),
      area: area.trim() || 'General Territory',
      commissionRate: Math.max(0, Number(commissionRate) || 0),
      monthlyTarget: Math.max(0, Number(monthlyTarget) || 0),
      status,
    };

    if (editingRep) {
      onUpdateSalesRep({ ...editingRep, ...payload });
    } else {
      onAddSalesRep(payload);
    }
    setIsModalOpen(false);
  };

  const handleExportCSV = () => {
    const headers = [
      'SR Name',
      'Phone',
      'Territory',
      'Status',
      'Assigned Buyers',
      'Chalans',
      'Total Sales',
      'Total Collected',
      'Commission %',
      'Earned Commission',
      'Target',
      'Target %',
    ];
    const rows = metrics.map((m) => [
      `"${m.rep.name.replace(/"/g, '""')}"`,
      m.rep.phone,
      `"${m.rep.area.replace(/"/g, '""')}"`,
      m.rep.status,
      m.buyerCount,
      m.invoiceCount,
      m.totalSales,
      m.totalCollected,
      m.rep.commissionRate,
      m.earnedCommission,
      m.rep.monthlyTarget,
      m.targetAchievementPct,
    ]);
    const csv =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const a = document.createElement('a');
    a.setAttribute('href', encodeURI(csv));
    a.setAttribute('download', `SR_Commissions_${getLocalYYYYMMDD()}.csv`);
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto min-h-full">
      {/* Header Controls */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-xs border border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
            <Award className="w-5 h-5 text-emerald-600" />
            <span>Sales Representatives (SR / DSR) &amp; Commission Tracker</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Track field sales reps, assigned territories, monthly targets, and earned wholesale commissions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-bold">
            <button
              type="button"
              onClick={() => setShowAllTime(true)}
              className={`px-3 py-1.5 rounded-lg cursor-pointer ${
                showAllTime ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600'
              }`}
            >
              All Time
            </button>
            <button
              type="button"
              onClick={() => setShowAllTime(false)}
              className={`px-3 py-1.5 rounded-lg cursor-pointer ${
                !showAllTime ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600'
              }`}
            >
              Date Range
            </button>
          </div>

          {!showAllTime && (
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl p-1 text-xs">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent font-mono font-bold px-1.5 py-1"
              />
              <span className="text-slate-400">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent font-mono font-bold px-1.5 py-1"
              />
            </div>
          )}

          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" /> CSV
          </button>

          <button
            type="button"
            onClick={openAddModal}
            className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-slate-950 font-extrabold rounded-xl text-xs flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Add Sales Rep (SR)
          </button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-[11px] font-bold uppercase text-slate-500">
            SR-Attributed Sales Billed
          </div>
          <div className="text-2xl font-black font-mono text-slate-900 mt-1">
            {formatSym} {totals.sales.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Across {salesReps.length} registered SRs
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-[11px] font-bold uppercase text-emerald-600">
            Collections Attributed
          </div>
          <div className="text-2xl font-black font-mono text-emerald-700 mt-1">
            {formatSym} {totals.collected.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Advances paid on SR chalans
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-[11px] font-bold uppercase text-cyan-700">
            Total Earned Commissions
          </div>
          <div className="text-2xl font-black font-mono text-cyan-700 mt-1">
            {formatSym} {totals.commission.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Calculated by individual SR % rates
          </div>
        </div>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {metrics.map((m) => (
          <div
            key={m.rep.id}
            className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 flex flex-col justify-between space-y-4 hover:shadow-md transition"
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center font-black">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-slate-900 text-sm">
                      {m.rep.name}
                    </h4>
                    <div className="text-[11px] text-slate-500 flex items-center gap-2">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {m.rep.area}
                      </span>
                      {m.rep.phone && (
                        <span className="flex items-center gap-1 font-mono">
                          <Phone className="w-3 h-3" /> {m.rep.phone}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold ${
                    m.rep.status === 'Active'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {m.rep.status}
                </span>
              </div>

              {/* Performance Grid */}
              <div className="grid grid-cols-2 gap-2.5 bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">
                    Total Sales
                  </span>
                  <span className="font-mono font-black text-slate-900">
                    {formatTkAmount(m.totalSales)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">
                    Commission ({m.rep.commissionRate}%)
                  </span>
                  <span className="font-mono font-black text-emerald-700">
                    {formatTkAmount(m.earnedCommission)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">
                    Assigned Buyers
                  </span>
                  <span className="font-bold text-slate-800">
                    {m.buyerCount} Buyers ({m.invoiceCount} Invoices)
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">
                    Buyer Due Portfolio
                  </span>
                  <span className="font-mono font-bold text-rose-600">
                    {formatTkAmount(m.totalDue)}
                  </span>
                </div>
              </div>

              {/* Monthly Target Bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-bold">
                  <span className="text-slate-600 flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                    Monthly Target ({formatTkAmount(m.rep.monthlyTarget)})
                  </span>
                  <span className="font-mono text-emerald-700">
                    {m.targetAchievementPct}%
                  </span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full transition-all"
                    style={{ width: `${Math.min(100, m.targetAchievementPct)}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => openEditModal(m.rep)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <Edit className="w-3.5 h-3.5" /> Edit
              </button>
              <button
                type="button"
                onClick={() => onDeleteSalesRep(m.rep.id)}
                className="p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                title="Delete Sales Rep"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}

        {metrics.length === 0 && (
          <div className="col-span-full bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 text-xs">
            No Sales Representatives added yet. Click &ldquo;Add Sales Rep (SR)&rdquo; to create your first SR and track commissions.
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-900 text-base">
                {editingRep ? 'Edit Sales Representative' : 'Add Sales Representative (SR)'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  SR / DSR Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Tariqul Islam"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">
                    Mobile Phone
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="017..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">
                    Territory / Area
                  </label>
                  <input
                    type="text"
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    placeholder="e.g. Dhaka North"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">
                    Commission Rate (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.25"
                    value={commissionRate}
                    onChange={(e) => setCommissionRate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">
                    Monthly Target ({formatSym})
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={monthlyTarget}
                    onChange={(e) => setMonthlyTarget(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as 'Active' | 'Inactive')}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-slate-600 font-bold rounded-xl hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl cursor-pointer"
                >
                  {editingRep ? 'Save Updates' : 'Create SR'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
