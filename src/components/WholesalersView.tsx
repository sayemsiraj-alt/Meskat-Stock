import React, { useState } from 'react';
import { SalesRep, StockItem, SystemUser, Wholesaler } from '../data/mockData';
import {
  Plus,
  Users,
  Phone,
  MapPin,
  Edit,
  Trash2,
  KeyRound,
  Tag,
  Mail,
  X,
  Briefcase,
} from 'lucide-react';

interface WholesalersViewProps {
  wholesalers: Wholesaler[];
  items: StockItem[];
  users: SystemUser[];
  salesReps?: SalesRep[];
  currency: string;
  onAddWholesaler: (w: Omit<Wholesaler, 'id' | 'totalDue'>) => Wholesaler;
  onUpdateWholesaler: (w: Wholesaler) => void;
  onDeleteWholesaler: (id: string) => void;
  onSaveBuyerPortalCredentials: (params: {
    wholesalerId: string;
    buyerName: string;
    userId: string;
    password: string;
    status: 'Active' | 'Inactive';
    email?: string;
  }) => { success: boolean; message?: string };
  searchQuery: string;
}

export const WholesalersView: React.FC<WholesalersViewProps> = ({
  wholesalers,
  items,
  users,
  salesReps = [],
  currency,
  onAddWholesaler,
  onUpdateWholesaler,
  onDeleteWholesaler,
  onSaveBuyerPortalCredentials,
  searchQuery,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWholesaler, setEditingWholesaler] = useState<Wholesaler | null>(
    null
  );

  // Basic Buyer Form
  const [name, setName] = useState('');
  const [shopName, setShopName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [creditLimit, setCreditLimit] = useState<string>('');
  const [salesRepId, setSalesRepId] = useState<string>('');

  // Optional inline Portal Credentials when creating/editing
  const [portalUserId, setPortalUserId] = useState('');
  const [portalPassword, setPortalPassword] = useState('');
  const [portalStatus, setPortalStatus] = useState<'Active' | 'Inactive'>(
    'Active'
  );
  const [modalError, setModalError] = useState('');

  // Approved Prices Modal State
  const [pricingBuyer, setPricingBuyer] = useState<Wholesaler | null>(null);
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});
  const [pricingSavedMsg, setPricingSavedMsg] = useState('');

  const filtered = wholesalers.filter(
    (w) =>
      w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.phone.includes(searchQuery) ||
      (w.shopName && w.shopName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const openAddModal = () => {
    setEditingWholesaler(null);
    setName('');
    setShopName('');
    setPhone('');
    setEmail('');
    setAddress('');
    setCreditLimit('');
    setSalesRepId('');
    setPortalUserId('');
    setPortalPassword('');
    setPortalStatus('Active');
    setModalError('');
    setIsModalOpen(true);
  };

  const openEditModal = (w: Wholesaler) => {
    setEditingWholesaler(w);
    setName(w.name);
    setShopName(w.shopName || '');
    setPhone(w.phone);
    setEmail(w.email || '');
    setAddress(w.address);
    setCreditLimit(w.creditLimit ? String(w.creditLimit) : '');
    setSalesRepId(w.salesRepId || '');
    const linkedUser = users.find(
      (u) => u.role === 'customer' && u.wholesalerId === w.id
    );
    setPortalUserId(linkedUser?.userId || w.portalUserId || '');
    setPortalPassword(linkedUser?.passwordHash || '');
    setPortalStatus(linkedUser?.status === 'Inactive' ? 'Inactive' : 'Active');
    setModalError('');
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');
    if (!name.trim()) return;

    if (portalUserId.trim() && !portalPassword.trim()) {
      setModalError('Please enter a Portal Password for the User ID.');
      return;
    }

    const assignedRep = salesReps.find((r) => r.id === salesRepId);

    let targetId = editingWholesaler?.id || '';

    if (editingWholesaler) {
      onUpdateWholesaler({
        ...editingWholesaler,
        name: name.trim(),
        shopName: shopName.trim() || undefined,
        phone: phone.trim(),
        email: email.trim() || undefined,
        address: address.trim(),
        creditLimit: creditLimit ? Number(creditLimit) : undefined,
        salesRepId: assignedRep?.id || undefined,
        salesRepName: assignedRep?.name || undefined,
        portalUserId: portalUserId.trim() || editingWholesaler.portalUserId,
        portalStatus: portalUserId.trim() ? portalStatus : editingWholesaler.portalStatus,
      });
    } else {
      const created = onAddWholesaler({
        name: name.trim(),
        shopName: shopName.trim() || undefined,
        phone: phone.trim(),
        email: email.trim() || undefined,
        address: address.trim(),
        creditLimit: creditLimit ? Number(creditLimit) : undefined,
        salesRepId: assignedRep?.id || undefined,
        salesRepName: assignedRep?.name || undefined,
        portalUserId: portalUserId.trim() || undefined,
        portalStatus: portalUserId.trim() ? portalStatus : undefined,
      });
      targetId = created.id;
    }

    if (portalUserId.trim() && targetId) {
      const res = onSaveBuyerPortalCredentials({
        wholesalerId: targetId,
        buyerName: name.trim(),
        userId: portalUserId.trim(),
        password: portalPassword.trim(),
        status: portalStatus,
        email: email.trim() || undefined,
      });
      if (!res.success) {
        setModalError(res.message || 'Could not assign portal credentials.');
        return;
      }
    }

    setIsModalOpen(false);
    setEditingWholesaler(null);
  };

  const openPricingModal = (w: Wholesaler) => {
    setPricingBuyer(w);
    const initial: Record<string, string> = {};
    items.forEach((it) => {
      const custom = w.approvedPrices?.[it.id];
      initial[it.id] =
        typeof custom === 'number' && !Number.isNaN(custom)
          ? String(custom)
          : '';
    });
    setPriceDrafts(initial);
    setPricingSavedMsg('');
  };

  const handleSaveApprovedPrices = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pricingBuyer) return;
    const nextPrices: Record<string, number> = {};
    Object.entries(priceDrafts).forEach(([itemId, val]) => {
      const num = Number(val);
      if (val.trim() !== '' && !Number.isNaN(num) && num >= 0) {
        nextPrices[itemId] = num;
      }
    });

    onUpdateWholesaler({
      ...pricingBuyer,
      approvedPrices: nextPrices,
    });
    setPricingSavedMsg('Approved customer prices saved!');
    setTimeout(() => {
      setPricingBuyer(null);
      setPricingSavedMsg('');
    }, 800);
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto min-h-full">
      <div className="bg-white p-4 rounded-2xl shadow-xs border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-extrabold text-slate-800 text-base">
            Wholesale Customers, Portal Credentials &amp; Approved Prices
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage buyers, issue Customer Portal User ID/Passwords, assign SRs, credit limits &amp; approved rates.
          </p>
        </div>
        <button
          type="button"
          onClick={openAddModal}
          className="bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-2 shadow-sm transition hover:from-emerald-600 hover:to-cyan-600 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Customer</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((w) => {
          const portalUser = users.find(
            (u) => u.role === 'customer' && u.wholesalerId === w.id
          );
          const customPriceCount = w.approvedPrices
            ? Object.keys(w.approvedPrices).length
            : 0;
          const limit = w.creditLimit || 0;
          const utilPct =
            limit > 0 ? Math.min(100, Math.round((w.totalDue / limit) * 100)) : 0;
          const isOverLimit = limit > 0 && w.totalDue >= limit;

          return (
            <div
              key={w.id}
              className="bg-white rounded-2xl shadow-xs border border-slate-200 p-6 flex flex-col justify-between hover:shadow-md transition"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-sm border border-blue-100">
                    <Users className="w-5 h-5" />
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div
                      className={`px-2.5 py-1 text-xs font-bold rounded-lg border ${
                        w.totalDue > 0
                          ? 'bg-rose-50 text-rose-600 border-rose-200'
                          : 'bg-emerald-50 text-emerald-600 border-emerald-200'
                      }`}
                    >
                      Due: {currency} {w.totalDue.toLocaleString()}
                    </div>
                    {portalUser ? (
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                          portalUser.status === 'Active'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        Portal: {portalUser.userId} ({portalUser.status})
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-500 text-[10px] font-bold">
                        No Portal ID Yet
                      </span>
                    )}
                  </div>
                </div>

                <h4 className="font-extrabold text-slate-900 text-base">
                  {w.name}
                </h4>
                {w.shopName && (
                  <p className="text-xs text-emerald-700 font-bold mb-1">
                    {w.shopName}
                  </p>
                )}
                {w.salesRepName && (
                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold mb-2">
                    <Briefcase className="w-3 h-3" />
                    <span>SR: {w.salesRepName}</span>
                  </div>
                )}

                <div className="space-y-2 text-xs text-slate-500 border-t border-slate-100 pt-3 mt-2">
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{w.phone || 'No phone'}</span>
                  </div>
                  {w.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{w.email}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{w.address || 'No address'}</span>
                  </div>
                </div>

                {limit > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-slate-100">
                    <div className="flex items-center justify-between text-[10px] font-bold mb-1">
                      <span className="text-slate-500 uppercase">
                        Credit Limit Utilization
                      </span>
                      <span
                        className={
                          isOverLimit ? 'text-rose-600' : 'text-slate-700'
                        }
                      >
                        {currency} {w.totalDue.toLocaleString()} / {limit.toLocaleString()} ({utilPct}%)
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          isOverLimit
                            ? 'bg-rose-500'
                            : utilPct >= 80
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${utilPct}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs gap-2">
                <button
                  type="button"
                  onClick={() => openPricingModal(w)}
                  className="px-2.5 py-1.5 bg-cyan-50 hover:bg-cyan-100 text-cyan-800 font-bold rounded-lg text-[11px] flex items-center gap-1 cursor-pointer"
                >
                  <Tag className="w-3.5 h-3.5" />
                  <span>
                    Approved Prices
                    {customPriceCount > 0 ? ` (${customPriceCount})` : ''}
                  </span>
                </button>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => openEditModal(w)}
                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 font-bold rounded-lg text-[11px] flex items-center gap-1 cursor-pointer"
                    title="Edit Customer & Portal Credentials"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span>Edit / Portal</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteWholesaler(w.id)}
                    aria-label={`Delete ${w.name}`}
                    className="p-1.5 hover:text-rose-600 transition cursor-pointer"
                    title="Delete Customer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="col-span-full bg-white p-12 text-center text-slate-400 rounded-2xl border border-slate-200">
            No customers match your search.
          </div>
        )}
      </div>

      {/* Add / Edit Customer & Portal Credentials Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-start justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-xl w-full p-6 sm:p-7 space-y-5 my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-800 text-lg">
                {editingWholesaler
                  ? 'Edit Customer & Portal Login'
                  : 'Add New Customer & Portal Login'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                aria-label="Close Customer Modal"
                className="text-slate-400 hover:text-slate-600 font-bold text-base p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {modalError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold">
                {modalError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Customer / Contact Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Shop / Business Name
                  </label>
                  <input
                    type="text"
                    value={shopName}
                    onChange={(e) => setShopName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Email (Optional / Google Sign-In)
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Address
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Credit Limit
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={creditLimit}
                    onChange={(e) => setCreditLimit(e.target.value)}
                    placeholder="Optional"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {salesReps.length > 0 && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Assigned Sales Rep (SR / DSR)
                  </label>
                  <select
                    value={salesRepId}
                    onChange={(e) => setSalesRepId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800"
                  >
                    <option value="">-- Direct / No SR Assigned --</option>
                    {salesReps
                      .filter((r) => r.status === 'Active')
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name} ({r.area}) — {r.commissionRate}% Comm.
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {/* Buyer Portal Login Credentials Box */}
              <div className="p-4 rounded-xl bg-slate-900 text-white space-y-3 border border-slate-800">
                <div className="flex items-center gap-2 text-emerald-400 font-extrabold text-xs">
                  <KeyRound className="w-4 h-4" />
                  <span>Customer Portal Credentials (Admin Issued)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                      Portal User ID
                    </label>
                    <input
                      type="text"
                      value={portalUserId}
                      onChange={(e) => setPortalUserId(e.target.value)}
                      placeholder="e.g. meskat01"
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-cyan-300"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                      Portal Password
                    </label>
                    <input
                      type="text"
                      value={portalPassword}
                      onChange={(e) => setPortalPassword(e.target.value)}
                      placeholder="Set password"
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                      Portal Status
                    </label>
                    <select
                      value={portalStatus}
                      onChange={(e) =>
                        setPortalStatus(e.target.value as 'Active' | 'Inactive')
                      }
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-bold text-white"
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                </div>
                <p className="text-[10px] text-slate-400">
                  Leave Portal User ID empty if this buyer does not need portal login yet.
                </p>
              </div>

              <div className="pt-3 flex justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 font-extrabold text-xs shadow-md hover:from-emerald-600 transition cursor-pointer"
                >
                  {editingWholesaler ? 'Update' : 'Save'} Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Buyer-Specific Approved Prices Modal */}
      {pricingBuyer && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-start justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full p-6 space-y-4 my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">
                  Approved Wholesale Prices — {pricingBuyer.name}
                </h3>
                <p className="text-xs text-slate-500">
                  Enter custom approved flat rate per product (leave blank to use default wholesale rate).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPricingBuyer(null)}
                aria-label="Close Approved Prices Modal"
                className="p-1.5 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {pricingSavedMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-bold">
                {pricingSavedMsg}
              </div>
            )}

            <form onSubmit={handleSaveApprovedPrices} className="space-y-4">
              <div className="max-h-80 overflow-y-auto overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full min-w-[440px] text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600 uppercase text-[10px] sticky top-0">
                    <tr>
                      <th className="p-3 font-bold">Product</th>
                      <th className="p-3 font-bold text-right">
                        Default Flat Rate
                      </th>
                      <th className="p-3 font-bold text-right w-40">
                        Approved Rate ({currency})
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((it) => (
                      <tr key={it.id} className="hover:bg-slate-50">
                        <td className="p-3">
                          <div className="font-bold text-slate-900">
                            {it.name}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {it.packSize || it.unit} • {it.sku}
                          </div>
                        </td>
                        <td className="p-3 text-right font-mono text-slate-500">
                          {it.price}
                        </td>
                        <td className="p-3 text-right">
                          <input
                            type="number"
                            min="0"
                            value={priceDrafts[it.id] || ''}
                            onChange={(e) =>
                              setPriceDrafts((prev) => ({
                                ...prev,
                                [it.id]: e.target.value,
                              }))
                            }
                            placeholder={`Default (${it.price})`}
                            className="w-32 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-right text-emerald-700"
                          />
                        </td>
                      </tr>
                    ))}
                    {items.length === 0 && (
                      <tr>
                        <td
                          colSpan={3}
                          className="p-8 text-center text-slate-400"
                        >
                          Add products in Inventory Items first to assign approved rates.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPricingBuyer(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs cursor-pointer"
                >
                  Save Approved Prices
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};