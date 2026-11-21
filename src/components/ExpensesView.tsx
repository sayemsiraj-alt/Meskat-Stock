import React, { useState, useMemo } from 'react';
import { Expense, Invoice, StockItem } from '../data/mockData';
import { 
  Plus, 
  Trash2, 
  Edit, 
  Calendar, 
  Receipt, 
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { getLocalYYYYMMDD, getFormattedLocalDateTime, extractYYYYMMDD, getFirstDayOfMonthYYYYMMDD } from '../utils/dateUtils';

interface ExpensesViewProps {
  expenses: Expense[];
  invoices: Invoice[];
  items: StockItem[];
  currency: string;
  userName: string;
  onAddExpense: (exp: Omit<Expense, 'id'>) => void;
  onUpdateExpense: (exp: Expense) => void;
  onDeleteExpense: (id: string) => void;
  searchQuery: string;
}

const defaultCategories = [
  'Shop Rent (দোকান ভাড়া)',
  'Staff Salaries (স্টাফ বেতন)',
  'Electricity & Utilities (বিদ্যুৎ/পানি)',
  'Transport & Delivery (যাতায়াত খরচ)',
  'Maintenance & Repair (মেরামত)',
  'Marketing & Ads (বিজ্ঞাপন)',
  'Refreshment & Snacks (আপ্যায়ন/নাস্তা)',
  'Courier & Freight (কুরিয়ার চার্জ)',
  'Govt Tax & Licenses (ট্যাক্স/লাইসেন্স)',
  'Miscellaneous (অন্যান্য)'
];

export const ExpensesView: React.FC<ExpensesViewProps> = ({
  expenses,
  invoices,
  items,
  currency,
  userName,
  onAddExpense,
  onUpdateExpense,
  onDeleteExpense,
  searchQuery
}) => {
  const [filterStart, setFilterStart] = useState<string>(getFirstDayOfMonthYYYYMMDD());
  const [filterEnd, setFilterEnd] = useState<string>(getLocalYYYYMMDD());

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExp, setEditingExp] = useState<Expense | null>(null);

  // Dynamic Expense Categories State with LocalStorage persistence
  const [customCategories, setCustomCategories] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('dh_exp_categories');
      return saved ? JSON.parse(saved) : defaultCategories;
    } catch {
      return defaultCategories;
    }
  });

  const [isAddingNewCategory, setIsAddingNewCategory] = useState(false);
  const [newCatInput, setNewCatInput] = useState('');

  const [category, setCategory] = useState<string>(customCategories[0] || 'Shop Rent (দোকান ভাড়া)');

  const handleAddNewCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCatInput.trim();
    if (!trimmed) return;

    if (!customCategories.includes(trimmed)) {
      const updated = [...customCategories, trimmed];
      setCustomCategories(updated);
      try {
        localStorage.setItem('dh_exp_categories', JSON.stringify(updated));
      } catch {}
    }
    setCategory(trimmed);
    setNewCatInput('');
    setIsAddingNewCategory(false);
  };
  const [amount, setAmount] = useState<number | ''>('');
  const [expDate, setExpDate] = useState<string>(getLocalYYYYMMDD());
  const [description, setDescription] = useState('');

  const formatCurr = (val: number) => {
    const sym = currency.includes('৳') || currency.toLowerCase().includes('bdt') ? '৳' : currency;
    return `${sym} ${val.toLocaleString()}`;
  };

  // Filtered Expenses
  const filteredExpenses = useMemo(() => {
    return expenses.filter(exp => {
      const d = extractYYYYMMDD(exp.date);
      const inDate = d >= filterStart && d <= filterEnd;
      const matchesSearch = exp.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            exp.category.toLowerCase().includes(searchQuery.toLowerCase());
      return inDate && matchesSearch;
    });
  }, [expenses, filterStart, filterEnd, searchQuery]);

  // Filtered Invoices in same date range
  const periodInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const d = extractYYYYMMDD(inv.date);
      return d >= filterStart && d <= filterEnd;
    });
  }, [invoices, filterStart, filterEnd]);

  // Net Profit & Loss Calculation
  const financialSummary = useMemo(() => {
    const totalSalesIncome = periodInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);

    // Calculate Cost of Goods Sold (COGS)
    let cogs = 0;
    periodInvoices.forEach(inv => {
      inv.items.forEach(soldItem => {
        const itemInfo = items.find(i => i.id === soldItem.itemId);
        const costPrice = itemInfo ? itemInfo.costPrice : (soldItem.unitPrice * 0.7); // fallback
        cogs += soldItem.quantity * costPrice;
      });
    });

    const totalOperatingExpenses = filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    const grossProfit = totalSalesIncome - cogs;
    const netProfit = grossProfit - totalOperatingExpenses;

    return {
      totalSalesIncome,
      cogs,
      grossProfit,
      totalOperatingExpenses,
      netProfit,
      isProfitable: netProfit >= 0
    };
  }, [periodInvoices, filteredExpenses, items]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalAmount = Number(amount);
    if (finalAmount <= 0) return;

    if (editingExp) {
      onUpdateExpense({
        ...editingExp,
        category,
        amount: finalAmount,
        date: getFormattedLocalDateTime(expDate),
        description
      });
    } else {
      onAddExpense({
        category,
        amount: finalAmount,
        date: getFormattedLocalDateTime(expDate),
        description: description.trim() || `${category} Expense`,
        user: userName
      });
    }

    setIsModalOpen(false);
    setEditingExp(null);
    setAmount('');
    setDescription('');
  };

  const openAddModal = () => {
    setEditingExp(null);
    setCategory('Rent');
    setAmount('');
    setExpDate(getLocalYYYYMMDD());
    setDescription('');
    setIsModalOpen(true);
  };

  const openEditModal = (exp: Expense) => {
    setEditingExp(exp);
    setCategory(exp.category);
    setAmount(exp.amount);
    setExpDate(extractYYYYMMDD(exp.date));
    setDescription(exp.description);
    setIsModalOpen(true);
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1600px] mx-auto min-h-full">
      {/* Top Action Header */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-xs border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-extrabold text-slate-800 text-base">Expense Management & Net Profit Calculator (খরচ ও নিট লাভ-ক্ষতি)</h3>
          <p className="text-xs text-slate-500 mt-0.5">Track office rent, staff salaries, electricity bills, transport, & auto-calculate Net Profit</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={openAddModal}
            className="bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 font-extrabold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-sm transition hover:from-emerald-600 hover:to-cyan-600"
          >
            <Plus className="w-4 h-4" />
            <span>Log New Expense (নতুন খরচ)</span>
          </button>
        </div>
      </div>

      {/* Date Range Selector Bar */}
      <div className="bg-white p-4 rounded-2xl shadow-xs border border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
          <Calendar className="w-4 h-4 text-emerald-600" />
          <span>Financial Period Filter:</span>
        </div>
        <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
          <input
            type="date"
            value={filterStart}
            onChange={(e) => setFilterStart(e.target.value)}
            className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 outline-none"
          />
          <span className="text-xs text-slate-400 font-bold">to</span>
          <input
            type="date"
            value={filterEnd}
            onChange={(e) => setFilterEnd(e.target.value)}
            className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 outline-none"
          />
        </div>
      </div>

      {/* NET PROFIT & LOSS DASHBOARD CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500"></div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Total Sales Revenue</span>
          <span className="text-2xl font-black text-slate-900">{formatCurr(financialSummary.totalSalesIncome)}</span>
          <p className="text-[11px] text-slate-400 mt-1">From {periodInvoices.length} Sales Chalans</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-slate-500"></div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Cost of Goods Sold (COGS)</span>
          <span className="text-2xl font-black text-slate-700">{formatCurr(financialSummary.cogs)}</span>
          <p className="text-[11px] text-slate-400 mt-1">Direct product buying cost</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-rose-500"></div>
          <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider block mb-1">Operating Expenses (মোট খরচ)</span>
          <span className="text-2xl font-black text-rose-600">{formatCurr(financialSummary.totalOperatingExpenses)}</span>
          <p className="text-[11px] text-slate-400 mt-1">{filteredExpenses.length} Expense Vouchers</p>
        </div>

        <div className={`p-5 rounded-2xl border shadow-md relative overflow-hidden ${
          financialSummary.isProfitable 
            ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-slate-950 border-emerald-400' 
            : 'bg-gradient-to-br from-rose-500 to-red-600 text-white border-rose-400'
        }`}>
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs font-black uppercase tracking-wider opacity-90">
              {financialSummary.isProfitable ? '💰 Net Profit (প্রকৃত লাভ)' : '🔻 Net Loss (প্রকৃত ক্ষতি)'}
            </span>
            {financialSummary.isProfitable ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
          </div>
          <span className="text-3xl font-black block my-1">
            {formatCurr(Math.abs(financialSummary.netProfit))}
          </span>
          <p className="text-[11px] font-bold opacity-80">
            {financialSummary.isProfitable ? 'Net Revenue after all expenses' : 'Expenses exceeded gross profit'}
          </p>
        </div>
      </div>

      {/* Expense Entries Table */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2 font-extrabold text-slate-800 text-sm">
            <Receipt className="w-4 h-4 text-rose-600" />
            <span>Expense Ledger ({filterStart} to {filterEnd})</span>
          </div>
          <span className="text-xs font-bold text-slate-600 bg-slate-200 px-2.5 py-1 rounded-lg">
            {filteredExpenses.length} Records
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 uppercase tracking-wider text-[10px] border-b border-slate-200">
              <tr>
                <th className="p-4 font-bold">Category</th>
                <th className="p-4 font-bold">Description</th>
                <th className="p-4 font-bold text-right">Amount ({currency})</th>
                <th className="p-4 font-bold">Date & Time</th>
                <th className="p-4 font-bold">Logged By</th>
                <th className="p-4 font-bold text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredExpenses.map(exp => (
                <tr key={exp.id} className="hover:bg-slate-50">
                  <td className="p-4 font-extrabold text-slate-900">
                    <span className="px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-[10px]">
                      {exp.category}
                    </span>
                  </td>
                  <td className="p-4 text-slate-800 font-medium">{exp.description}</td>
                  <td className="p-4 font-mono font-extrabold text-rose-600 text-right text-sm">
                    -{formatCurr(exp.amount)}
                  </td>
                  <td className="p-4 text-slate-500 font-mono">{exp.date.replace('T', ' ')}</td>
                  <td className="p-4 text-slate-700 font-bold">{exp.user}</td>
                  <td className="p-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => openEditModal(exp)} className="p-1 hover:text-emerald-600 transition" title="Edit Expense">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button onClick={() => onDeleteExpense(exp.id)} className="p-1 hover:text-rose-600 transition" title="Delete Expense">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredExpenses.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-slate-400">
                    No expense vouchers logged in this date range.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Expense Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 sm:p-8 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-800 text-lg">
                {editingExp ? 'Edit Expense Voucher' : 'Log New Operating Expense'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase">Expense Category *</label>
                  <button
                    type="button"
                    onClick={() => setIsAddingNewCategory(!isAddingNewCategory)}
                    className="text-[11px] font-extrabold text-emerald-600 hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{isAddingNewCategory ? 'Select Existing' : 'Add New Category'}</span>
                  </button>
                </div>

                {isAddingNewCategory ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      value={newCatInput}
                      onChange={(e) => setNewCatInput(e.target.value)}
                      placeholder="e.g. Courier Charge / Tea & Snacks"
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={handleAddNewCategory}
                      className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs rounded-xl shadow-xs shrink-0"
                    >
                      Add Category
                    </button>
                  </div>
                ) : (
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                  >
                    {customCategories.map((cat, idx) => (
                      <option key={idx} value={cat}>{cat}</option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Expense Amount ({currency}) *</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="0"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-rose-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Expense Date *</label>
                <input
                  type="date"
                  required
                  value={expDate}
                  onChange={(e) => setExpDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Description / Remarks</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. June month shop rent or Electric bill receipt #991"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50">Cancel</button>
                <button type="submit" className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 font-extrabold text-xs shadow-md">
                  {editingExp ? 'Update Expense' : 'Save Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
