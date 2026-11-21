import React, { useState } from 'react';
import {
  PurchaseBill,
  PurchaseReturn,
  Supplier,
  SupplierPayment,
} from '../data/mockData';
import {
  Plus,
  Users,
  Phone,
  Mail,
  MapPin,
  CheckCircle2,
  Edit,
  Trash2,
  DollarSign,
  Download,
} from 'lucide-react';
import { buildSupplierStatementLedger } from '../utils/erpFeatureUtils';
import { downloadSupplierStatementPdf } from '../utils/printAndDownload';
import { getLocalYYYYMMDD } from '../utils/dateUtils';
import { formatTkAmount } from '../utils/numberToWords';

interface SuppliersViewProps {
  suppliers: Supplier[];
  purchaseBills?: PurchaseBill[];
  purchaseReturns?: PurchaseReturn[];
  supplierPayments?: SupplierPayment[];
  brandName?: string;
  currency?: string;
  systemDate?: string;
  onAddSupplier: (supplier: Omit<Supplier, 'id' | 'activeItems' | 'status'>) => void;
  onUpdateSupplier: (supplier: Supplier, oldName: string) => void;
  onDeleteSupplier: (id: string) => void;
  onPaySupplierDue?: (params: {
    supplierId: string;
    amount: number;
    paymentMethod: SupplierPayment['paymentMethod'];
    date: string;
    reference?: string;
    notes?: string;
  }) => SupplierPayment | null;
  searchQuery: string;
}

export const SuppliersView: React.FC<SuppliersViewProps> = ({
  suppliers,
  purchaseBills = [],
  purchaseReturns = [],
  supplierPayments = [],
  brandName = 'Stock ERP',
  currency = 'BDT',
  systemDate,
  onAddSupplier,
  onUpdateSupplier,
  onDeleteSupplier,
  onPaySupplierDue,
  searchQuery,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');

  // Pay Supplier Due modal state
  const [payingSupplier, setPayingSupplier] = useState<Supplier | null>(null);
  const [payAmount, setPayAmount] = useState<number | ''>('');
  const [payMethod, setPayMethod] = useState<SupplierPayment['paymentMethod']>('Cash');
  const [payRef, setPayRef] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [payDate, setPayDate] = useState(systemDate || getLocalYYYYMMDD());
  const [notice, setNotice] = useState('');

  const filteredSuppliers = suppliers.filter((s) => {
    return (
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.contactPerson.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.address.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (editingSupplier) {
      onUpdateSupplier(
        {
          ...editingSupplier,
          name,
          contactPerson: contactPerson || 'General Manager',
          phone: phone || '+880 2 000000',
          email: email || 'contact@supplier.com',
          address: address || 'Dhaka, Bangladesh',
        },
        editingSupplier.name
      );
    } else {
      onAddSupplier({
        name,
        contactPerson: contactPerson || 'General Manager',
        phone: phone || '+880 2 000000',
        email: email || 'contact@supplier.com',
        address: address || 'Dhaka, Bangladesh',
      });
    }

    setName('');
    setContactPerson('');
    setPhone('');
    setEmail('');
    setAddress('');
    setIsModalOpen(false);
    setEditingSupplier(null);
  };

  const openAddModal = () => {
    setEditingSupplier(null);
    setName('');
    setContactPerson('');
    setPhone('');
    setEmail('');
    setAddress('');
    setIsModalOpen(true);
  };

  const openEditModal = (sup: Supplier) => {
    setEditingSupplier(sup);
    setName(sup.name);
    setContactPerson(sup.contactPerson);
    setPhone(sup.phone);
    setEmail(sup.email);
    setAddress(sup.address);
    setIsModalOpen(true);
  };

  const openPayDueModal = (sup: Supplier) => {
    setPayingSupplier(sup);
    setPayAmount(sup.totalDue && sup.totalDue > 0 ? sup.totalDue : '');
    setPayMethod('Cash');
    setPayRef('');
    setPayNotes('');
    setPayDate(systemDate || getLocalYYYYMMDD());
  };

  const handleSubmitPayDue = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingSupplier || !onPaySupplierDue) return;
    const amt = Number(payAmount);
    if (amt <= 0) return;

    const res = onPaySupplierDue({
      supplierId: payingSupplier.id,
      amount: amt,
      paymentMethod: payMethod,
      reference: payRef.trim() || undefined,
      notes: payNotes.trim() || undefined,
      date: payDate,
    });

    if (res) {
      setNotice(`Recorded payment ${res.receiptNo} (${formatTkAmount(amt)}) to ${payingSupplier.name}.`);
      setPayingSupplier(null);
      setTimeout(() => setNotice(''), 4000);
    } else {
      setNotice('Could not record supplier payment. Please check amount.');
    }
  };

  const handleDownloadStatement = (sup: Supplier) => {
    const ledger = buildSupplierStatementLedger({
      supplier: sup,
      purchaseBills,
      purchaseReturns,
      supplierPayments,
    });
    downloadSupplierStatementPdf({
      brandTitle: brandName,
      supplierName: sup.name,
      supplierPhone: sup.phone,
      supplierAddress: sup.address,
      entries: ledger.entries,
      totalBilled: ledger.totalBilled,
      totalPaidAndReturned: ledger.totalPaidAndReturned,
      closingBalance: ledger.closingBalance,
    });
  };

  const totalSupplierPayable = suppliers.reduce(
    (sum, s) => sum + (s.totalDue || 0),
    0
  );

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto min-h-full">
      {/* Top Header & Add action */}
      <div className="bg-white p-4 rounded-2xl shadow-xs border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-extrabold text-slate-800 text-base">
            Pharmaceutical Suppliers &amp; Distributors
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage vendors, procurement contacts, payable dues ({formatTkAmount(totalSupplierPayable)}), and statement PDFs
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-2 shadow-sm transition hover:from-emerald-600 hover:to-cyan-600 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Supplier</span>
        </button>
      </div>

      {notice && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-bold flex items-center justify-between">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice('')} className="font-black ml-3 cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* Grid List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredSuppliers.map((s) => {
          const supDue = s.totalDue || 0;
          return (
            <div
              key={s.id}
              className="bg-white rounded-2xl shadow-xs border border-slate-200 p-6 flex flex-col justify-between hover:shadow-md transition"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 font-bold text-sm">
                    <Users className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`px-2 py-0.5 font-extrabold text-[10px] rounded-lg border ${
                        supDue > 0
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}
                    >
                      Due: {formatTkAmount(supDue)}
                    </span>
                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-bold text-[10px] rounded-full border border-emerald-200 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" /> {s.status}
                    </span>
                  </div>
                </div>

                <h4 className="font-extrabold text-slate-900 text-base mb-1">{s.name}</h4>
                <p className="text-xs font-semibold text-slate-600 mb-4">Rep: {s.contactPerson}</p>

                <div className="space-y-2 text-xs text-slate-500 border-t border-slate-100 pt-3">
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{s.phone}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{s.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{s.address}</span>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 space-y-2.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-400">
                    Supplied Inventory:{' '}
                    <strong className="text-slate-800 bg-slate-100 px-2 py-0.5 rounded ml-1">
                      {s.activeItems} SKUs
                    </strong>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEditModal(s)}
                      className="p-1 hover:text-emerald-600 transition cursor-pointer"
                      title="Edit Supplier"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDeleteSupplier(s.id)}
                      className="p-1 hover:text-rose-600 transition cursor-pointer"
                      title="Delete Supplier"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {onPaySupplierDue && (
                    <button
                      type="button"
                      onClick={() => openPayDueModal(s)}
                      className="flex-1 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-[11px] flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Pay Due</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDownloadStatement(s)}
                    className="flex-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-[11px] flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-cyan-700" />
                    <span>Statement PDF</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {filteredSuppliers.length === 0 && (
          <div className="col-span-full bg-white p-12 text-center text-slate-400 rounded-2xl border border-slate-200">
            No suppliers matched your search.
          </div>
        )}
      </div>

      {/* Add/Edit Supplier Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 sm:p-8 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-800 text-lg">
                {editingSupplier ? 'Edit Pharmaceutical Distributor' : 'Add New Pharmaceutical Distributor'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-base p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 tracking-wide">
                  Company / Supplier Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Incepta Pharmaceuticals"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 tracking-wide">
                  Contact Representative
                </label>
                <input
                  type="text"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  placeholder="e.g. Tariqul Islam"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 tracking-wide">
                  Phone Number
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +880 2 8891681"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 tracking-wide">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. orders@inceptapharma.com"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 tracking-wide">
                  Physical Address
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. Tejgaon Industrial Area, Dhaka"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 font-extrabold text-xs shadow-md hover:from-emerald-600 hover:to-cyan-600 transition cursor-pointer"
                >
                  {editingSupplier ? 'Update Supplier' : 'Register Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pay Supplier Due Modal */}
      {payingSupplier && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">
                  Pay Supplier Due (সাপ্লায়ার পেমেন্ট)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {payingSupplier.name} · Current Due: {formatTkAmount(payingSupplier.totalDue || 0)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPayingSupplier(null)}
                className="text-slate-400 hover:text-slate-600 font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitPayDue} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Amount ({currency}) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Method
                  </label>
                  <select
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value as SupplierPayment['paymentMethod'])}
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
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Voucher / Ref No
                  </label>
                  <input
                    type="text"
                    value={payRef}
                    onChange={(e) => setPayRef(e.target.value)}
                    placeholder="Auto if empty"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Notes
                </label>
                <input
                  type="text"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  placeholder="Optional payment note..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPayingSupplier(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs cursor-pointer"
                >
                  Confirm Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
