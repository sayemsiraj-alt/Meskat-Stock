import React, { useState, useMemo } from 'react';
import { Invoice, InvoiceItem, StockItem, Category, SystemUser } from '../data/mockData';
import { 
  ShoppingCart, 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  Printer, 
  Download,
  X, 
  CheckCircle2, 
  User, 
  Phone, 
  Sparkles,
  PackageCheck,
  Receipt
} from 'lucide-react';
import { CompanyLogo } from './CompanyLogo';
import { BarcodeScannerInput } from './BarcodeLabelModal';
import { getLocalYYYYMMDD, getFormattedLocalDateTime } from '../utils/dateUtils';
import {
  downloadPosReceiptPdf,
  isInsideIframeEnv,
  resolveAuthorizedSignatureInfo,
} from '../utils/printAndDownload';

interface RetailPosViewProps {
  items: StockItem[];
  categories: Category[];
  currency: string;
  systemDate?: string;
  onAddInvoice: (inv: Omit<Invoice, 'id'>) => void;
  storeName: string;
  brandName: string;
  brandShortName: string;
  logoUrl?: string;
  address: string;
  phone: string;
  currentUser?: SystemUser;
}

export const RetailPosView: React.FC<RetailPosViewProps> = ({
  items,
  categories,
  currency,
  systemDate,
  onAddInvoice,
  storeName,
  brandName,
  brandShortName,
  logoUrl,
  address,
  phone,
  currentUser
}) => {
  // Product Search & Category Filter
  const [posSearch, setPosSearch] = useState('');
  const [posCategory, setPosCategory] = useState('All');

  // Customer & Cart State
  const [customerName, setCustomerName] = useState('Walk-in Retail Customer');
  const [customerPhone, setCustomerPhone] = useState('');
  const [cart, setCart] = useState<InvoiceItem[]>([]);
  const [discount, setDiscount] = useState<number | ''>('');
  const [cashReceived, setCashReceived] = useState<number | ''>('');
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'bKash' | 'Nagad' | 'Card'>('Cash');

  // Active Completed Receipt Modal & Inline Notice
  const [activeReceipt, setActiveReceipt] = useState<Invoice | null>(null);
  const [changeReturned, setChangeReturned] = useState<number>(0);
  const [posNotice, setPosNotice] = useState<string>('');
  const notifyPos = (msg: string) => {
    setPosNotice(msg);
    setTimeout(() => setPosNotice(''), 3000);
  };

  // Format Currency Symbol
  const formatCurrSymbol = (curr: string) => {
    if (!curr) return '৳';
    if (curr.includes('৳') || curr.toLowerCase().includes('bdt')) return '৳';
    return curr;
  };

  // Filter Products Catalog
  const filteredProducts = useMemo(() => {
    return items.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(posSearch.toLowerCase()) ||
                            item.sku.toLowerCase().includes(posSearch.toLowerCase()) ||
                            item.batchNo.toLowerCase().includes(posSearch.toLowerCase());
      const matchesCat = posCategory === 'All' || item.category === posCategory;
      return matchesSearch && matchesCat;
    });
  }, [items, posSearch, posCategory]);

  // Cart Calculations
  const subTotal = useMemo(() => cart.reduce((sum, item) => sum + item.total, 0), [cart]);
  const finalDiscount = Number(discount) || 0;
  const netPayable = Math.max(0, subTotal - finalDiscount);
  const changeAmount = Number(cashReceived) > netPayable ? Number(cashReceived) - netPayable : 0;

  // Add Item to Cart (or increment qty)
  const handleAddToCart = (item: StockItem) => {
    if (item.quantity <= 0) {
      notifyPos(`"${item.name}" is currently Out of Stock!`);
      return;
    }

    const existing = cart.find(c => c.itemId === item.id);
    if (existing) {
      if (existing.quantity + (existing.bonusQty || 0) + 1 > item.quantity) {
        notifyPos(`Cannot add more than available stock (${item.quantity} ${item.unit}).`);
        return;
      }
      setCart(cart.map(c => c.itemId === item.id ? { 
        ...c, 
        quantity: c.quantity + 1, 
        total: (c.quantity + 1) * c.unitPrice 
      } : c));
    } else {
      setCart([...cart, {
        itemId: item.id,
        itemName: item.name,
        quantity: 1,
        bonusQty: 0,
        unitPrice: item.price,
        total: item.price
      }]);
    }
  };

  // Modify Cart Item Quantity
  const updateCartQuantity = (itemId: string, delta: number) => {
    const item = items.find(i => i.id === itemId);
    const existing = cart.find(c => c.itemId === itemId);
    if (!existing) return;

    const newQty = existing.quantity + delta;
    if (newQty <= 0) {
      setCart(cart.filter(c => c.itemId !== itemId));
      return;
    }

    if (item && newQty + (existing.bonusQty || 0) > item.quantity) {
      notifyPos(`Only ${item.quantity} available in stock (including Free pcs)!`);
      return;
    }

    setCart(cart.map(c => c.itemId === itemId ? {
      ...c,
      quantity: newQty,
      total: newQty * c.unitPrice
    } : c));
  };

  const updateCartBonusQty = (itemId: string, rawBonus: string) => {
    const item = items.find(i => i.id === itemId);
    const existing = cart.find(c => c.itemId === itemId);
    if (!existing) return;

    const nextBonus = Math.max(0, Number(rawBonus) || 0);
    if (item && existing.quantity + nextBonus > item.quantity) {
      notifyPos(`Only ${item.quantity} available in stock (Qty + Free)!`);
      return;
    }

    setCart(cart.map(c => c.itemId === itemId ? {
      ...c,
      bonusQty: nextBonus,
    } : c));
  };

  // Remove Item from Cart
  const removeFromCart = (itemId: string) => {
    setCart(cart.filter(c => c.itemId !== itemId));
  };

  // Clear Cart
  const handleClearCart = () => {
    if (cart.length === 0) return;
    setCart([]);
    setDiscount('');
    setCashReceived('');
  };

  // Checkout & Complete Retail Sale
  const handleCheckoutSale = () => {
    if (cart.length === 0) {
      notifyPos('POS Cart is empty! Please add products to sell.');
      return;
    }

    const formattedDate = getFormattedLocalDateTime(systemDate || getLocalYYYYMMDD());
    const receiptNo = `POS-${new Date().getFullYear()}${String(new Date().getMonth()+1).padStart(2,'0')}-${Math.floor(1000 + Math.random() * 9000)}`;

    const newRetailInvoice: Omit<Invoice, 'id'> = {
      chalanNo: receiptNo,
      wholesalerId: 'RETAIL-CUST',
      wholesalerName: customerName.trim() || 'Walk-in Retail Customer',
      customerPhone: customerPhone.trim() || 'N/A',
      saleType: 'Retail',
      items: cart,
      subTotal: subTotal,
      discount: finalDiscount,
      totalAmount: netPayable,
      paidAmount: netPayable, // Retail counter sales are paid in full
      dueAmount: 0,
      paymentMethod: paymentMethod,
      date: formattedDate,
      status: 'Paid',
      createdByUserId: currentUser?.userId,
      createdByName: currentUser?.name,
      authorizedSignatureMode: currentUser?.signatureDataUrl ? 'manual' : 'auto',
      authorizedSignerName: currentUser?.name || brandName || storeName,
      authorizedSignerTitle: currentUser?.signatureTitle,
      authorizedSignatureDataUrl: currentUser?.signatureDataUrl,
    };

    onAddInvoice(newRetailInvoice);

    // Save for receipt preview
    setActiveReceipt({ ...newRetailInvoice, id: 'POS-NEW' });
    setChangeReturned(changeAmount);

    // Reset Form
    setCart([]);
    setDiscount('');
    setCashReceived('');
    setCustomerName('Walk-in Retail Customer');
    setCustomerPhone('');
  };

  const handleDownloadPosPdf = async () => {
    if (!activeReceipt) return;
    await downloadPosReceiptPdf({
      invoice: activeReceipt,
      brandName,
      storeName,
      address,
      phone,
      changeReturned,
    });
  };

  const triggerPrint = async () => {
    if (isInsideIframeEnv()) {
      await handleDownloadPosPdf();
      return;
    }
    try {
      window.print();
    } catch {
      await handleDownloadPosPdf();
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1700px] mx-auto min-h-full">
      
      {/* Top Banner */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-xs border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center font-black shadow-xs">
              <ShoppingCart className="w-4 h-4" />
            </div>
            <h3 className="font-extrabold text-slate-900 text-base">Retail POS Counter Sales (খুচরা বিক্রয়)</h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">Fast counter sales terminal, instant receipt generation, & real-time stock deduction</p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span>Real-time Stock Auto-Deduct Active</span>
          </span>
        </div>
      </div>

      {/* POS MAIN GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT / CENTER: PRODUCT CATALOG (7 COLS) */}
        <div className="lg:col-span-7 space-y-4">
          
          {posNotice && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold">
              {posNotice}
            </div>
          )}

          {/* Barcode Scan & Search Bar */}
          <div className="bg-white p-4 rounded-2xl shadow-xs border border-slate-200 space-y-3">
            <BarcodeScannerInput
              items={items}
              onMatchItem={(it) => handleAddToCart(it)}
              placeholder="Scan Barcode or Type SKU + Enter to Add to Cart..."
              compact
            />

            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Search className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={posSearch}
                onChange={(e) => setPosSearch(e.target.value)}
                placeholder="Quick Search Product Name, SKU, Batch..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
              />
            </div>

            {/* Category Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              <button
                type="button"
                onClick={() => setPosCategory('All')}
                className={`px-3 py-1.5 rounded-xl font-bold transition shrink-0 ${
                  posCategory === 'All'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All Products ({items.length})
              </button>
              {categories.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setPosCategory(c.name)}
                  className={`px-3 py-1.5 rounded-xl font-bold transition shrink-0 ${
                    posCategory === c.name
                      ? 'bg-emerald-500 text-slate-950 shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          {/* Product Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[620px] overflow-y-auto pr-1">
            {filteredProducts.map(product => {
              const isOut = product.quantity <= 0;
              const isLow = product.quantity <= product.reorderThreshold && product.quantity > 0;
              const inCartItem = cart.find(c => c.itemId === product.id);

              return (
                <div
                  key={product.id}
                  onClick={() => !isOut && handleAddToCart(product)}
                  className={`bg-white rounded-2xl p-3.5 border transition cursor-pointer flex flex-col justify-between relative group ${
                    isOut 
                      ? 'opacity-60 border-slate-200 cursor-not-allowed bg-slate-50' 
                      : inCartItem
                      ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/20 shadow-xs'
                      : 'border-slate-200 hover:border-emerald-400 hover:shadow-md'
                  }`}
                >
                  {inCartItem && (
                    <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-emerald-500 text-slate-950 font-black text-xs flex items-center justify-center shadow-xs animate-bounce">
                      {inCartItem.quantity}
                    </span>
                  )}

                  <div className="flex items-start gap-2.5">
                    {product.imageUrl && (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block truncate mb-0.5">
                        {product.category}
                      </span>
                      <h4 className="font-extrabold text-slate-900 text-xs sm:text-sm line-clamp-2 leading-snug">
                        {product.name}
                      </h4>
                      <span className="text-[10px] font-mono text-slate-400 block mt-0.5">
                        SKU: {product.sku}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                    <div>
                      <span className="text-sm font-black text-slate-900">
                        {formatCurrSymbol(currency)} {product.price}
                      </span>
                      <span className="text-[10px] text-slate-400 block font-normal">per {product.unit.slice(0, -1)}</span>
                    </div>

                    <div>
                      {isOut ? (
                        <span className="px-2 py-0.5 bg-rose-100 text-rose-700 font-extrabold text-[9px] rounded-md">
                          OUT OF STOCK
                        </span>
                      ) : isLow ? (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-800 font-extrabold text-[9px] rounded-md">
                          {product.quantity} {product.unit} LEFT
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-bold text-[10px] rounded-md">
                          Stock: {product.quantity}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredProducts.length === 0 && (
              <div className="col-span-full bg-white p-12 text-center text-slate-400 rounded-2xl border border-slate-200">
                <PackageCheck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="font-bold text-slate-700 text-sm">No products found matching your search</p>
                <p className="text-xs text-slate-400 mt-1">Try clearing your search query or add items in Inventory.</p>
              </div>
            )}
          </div>

        </div>

        {/* RIGHT: RETAIL POS CART & CHECKOUT TERMINAL (5 COLS) */}
        <div className="lg:col-span-5 bg-slate-900 text-white rounded-2xl p-5 sm:p-6 shadow-xl border border-slate-800 flex flex-col justify-between min-h-[640px] space-y-4">
          
          <div className="space-y-4">
            
            {/* Cart Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-emerald-400" />
                <h4 className="font-black text-base text-white">Retail Sales Order Cart</h4>
              </div>

              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearCart}
                  className="text-xs text-rose-400 hover:text-rose-300 font-bold flex items-center gap-1 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Clear Cart
                </button>
              )}
            </div>

            {/* Customer Information Inputs */}
            <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700/80 space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1">
                  <User className="w-3 h-3 text-emerald-400" /> Customer Name / Customer
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Walk-in Retail Customer"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1">
                  <Phone className="w-3 h-3 text-cyan-400" /> Phone Number (Optional)
                </label>
                <input
                  type="text"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="01700000000"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Cart Items List */}
            <div className="max-h-[220px] overflow-y-auto space-y-2 pr-1 divide-y divide-slate-800">
              {cart.map(c => (
                <div key={c.itemId} className="pt-2 flex items-center justify-between text-xs gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-extrabold text-white truncate">{c.itemName}</p>
                    <p className="text-[10px] text-slate-400 font-mono">
                      {formatCurrSymbol(currency)} {c.unitPrice} each
                    </p>
                  </div>

                  {/* Quantity & Free Modifier */}
                  <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-lg p-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => updateCartQuantity(c.itemId, -1)}
                      className="w-5 h-5 rounded bg-slate-700 hover:bg-slate-600 text-white font-bold flex items-center justify-center transition"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-6 text-center font-extrabold text-emerald-400 text-xs">{c.quantity}</span>
                    <button
                      type="button"
                      onClick={() => updateCartQuantity(c.itemId, 1)}
                      className="w-5 h-5 rounded bg-slate-700 hover:bg-slate-600 text-white font-bold flex items-center justify-center transition"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="flex items-center gap-1 bg-slate-800 border border-emerald-700/60 rounded-lg px-1.5 py-0.5 shrink-0" title="Free / Bonus Pcs">
                    <span className="text-[9px] text-emerald-400 font-bold">+F</span>
                    <input
                      type="number"
                      min="0"
                      value={c.bonusQty || 0}
                      onChange={(e) => updateCartBonusQty(c.itemId, e.target.value)}
                      aria-label={`Free bonus pcs for ${c.itemName}`}
                      className="w-9 bg-transparent text-center font-mono font-bold text-emerald-300 text-[11px] focus:outline-none"
                    />
                  </div>

                  <div className="text-right shrink-0 w-16">
                    <span className="font-mono font-extrabold text-white text-xs block">
                      {formatCurrSymbol(currency)} {c.total.toLocaleString()}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeFromCart(c.itemId)}
                    className="p-1 text-slate-500 hover:text-rose-400 transition"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              {cart.length === 0 && (
                <div className="py-8 text-center text-slate-500 text-xs italic">
                  Shopping cart is empty. Click any product on the left to add.
                </div>
              )}
            </div>

          </div>

          {/* CHECKOUT & FINANCIAL CALCULATOR */}
          <div className="pt-3 border-t border-slate-800 space-y-3">
            
            {/* Payment Method Selector */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Select Payment Method</label>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { id: 'Cash', label: 'Cash 💵' },
                  { id: 'bKash', label: 'bKash 📱' },
                  { id: 'Nagad', label: 'Nagad 📲' },
                  { id: 'Card', label: 'Card 💳' },
                ].map(m => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPaymentMethod(m.id as any)}
                    className={`py-1.5 px-1 rounded-lg text-[10px] font-bold text-center transition ${
                      paymentMethod === m.id
                        ? 'bg-emerald-500 text-slate-950 font-black shadow-xs'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Calculations Breakdown */}
            <div className="bg-slate-800/90 p-3.5 rounded-xl border border-slate-700/80 space-y-2 text-xs">
              <div className="flex justify-between items-center text-slate-300">
                <span>Subtotal:</span>
                <span className="font-mono font-bold text-white text-sm">{formatCurrSymbol(currency)} {subTotal.toLocaleString()}</span>
              </div>

              <div className="flex justify-between items-center text-slate-300 gap-2">
                <span>Discount (ছাড়):</span>
                <input
                  type="number"
                  min="0"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="0"
                  className="w-24 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs font-bold text-emerald-400 text-right focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-slate-700/80 text-sm font-extrabold">
                <span className="text-white">Net Payable (সর্বমোট বিল):</span>
                <span className="font-mono text-base text-emerald-400">{formatCurrSymbol(currency)} {netPayable.toLocaleString()}</span>
              </div>

              {/* Cash Received & Change */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-700/80">
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Cash Received</label>
                  <input
                    type="number"
                    min="0"
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder={netPayable.toString()}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Change Return</label>
                  <div className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs font-mono font-extrabold text-cyan-400">
                    {formatCurrSymbol(currency)} {changeAmount.toLocaleString()}
                  </div>
                </div>
              </div>
            </div>

            {/* Complete Sale Action Button */}
            <button
              type="button"
              onClick={handleCheckoutSale}
              disabled={cart.length === 0}
              className={`w-full py-3.5 rounded-xl font-black text-xs uppercase tracking-wider shadow-lg transition flex items-center justify-center gap-2 ${
                cart.length === 0
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-slate-950 transform hover:-translate-y-0.5'
              }`}
            >
              <Receipt className="w-4 h-4" />
              <span>Complete Sale & Print Receipt</span>
            </button>

          </div>

        </div>

      </div>

      {/* --- RETAIL POS RECEIPT MODAL --- */}
      {activeReceipt && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-5 relative my-8 text-slate-900">
            
            {/* Control Header */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 no-print">
              <div className="flex items-center gap-2 font-black text-slate-800 text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                <span>Retail POS Receipt</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadPosPdf}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs transition shadow-xs flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" /> PDF
                </button>
                <button
                  type="button"
                  onClick={triggerPrint}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-xl text-xs transition shadow-xs flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" /> Print
                </button>
                <button
                  type="button"
                  onClick={() => setActiveReceipt(null)}
                  aria-label="Close POS Receipt"
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition font-bold cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* PRINTABLE RETAIL RECEIPT (80mm Thermal Friendly) */}
            <div id="printable-pos-receipt" className="bg-white p-4 border border-slate-300 rounded-xl space-y-4 font-sans text-xs text-slate-900">
              
              {/* Header */}
              <div className="text-center pb-3 border-b border-dashed border-slate-300">
                <CompanyLogo className="w-12 h-12 mx-auto mb-1.5" shortName={brandShortName} logoUrl={logoUrl} />
                <h3 className="font-black text-base uppercase tracking-tight text-slate-950">{brandName}</h3>
                <p className="text-[11px] font-bold text-slate-700">{storeName}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{address}</p>
                <p className="text-[10px] text-slate-500">Tel: {phone}</p>
              </div>

              {/* Receipt Info */}
              <div className="text-[11px] space-y-1 pb-2 border-b border-dashed border-slate-300 font-mono">
                <div className="flex justify-between">
                  <span className="font-bold">Receipt No:</span>
                  <span className="font-extrabold">{activeReceipt.chalanNo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold">Date:</span>
                  <span>{activeReceipt.date.replace('T', ' ')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold">Customer:</span>
                  <span className="font-bold">{activeReceipt.wholesalerName}</span>
                </div>
                {activeReceipt.customerPhone && activeReceipt.customerPhone !== 'N/A' && (
                  <div className="flex justify-between">
                    <span className="font-bold">Phone:</span>
                    <span>{activeReceipt.customerPhone}</span>
                  </div>
                )}
              </div>

              {/* Items List */}
              <div className="space-y-1.5 pb-3 border-b border-dashed border-slate-300">
                <div className="flex justify-between font-extrabold text-[10px] uppercase text-slate-700 pb-1 border-b border-slate-200">
                  <span>Item</span>
                  <span className="text-right">Qty x Rate = Amount</span>
                </div>
                {activeReceipt.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-xs">
                    <div className="font-bold text-slate-950 pr-2 max-w-[170px] truncate">{item.itemName}</div>
                    <div className="font-mono text-right shrink-0">
                      {item.quantity}
                      {(item.bonusQty || 0) > 0 && (
                        <span className="text-[10px] font-bold text-emerald-700"> (+{item.bonusQty} Free)</span>
                      )}{' '}
                      x {item.unitPrice} = <strong>{formatCurrSymbol(currency)}{item.total.toLocaleString()}</strong>
                    </div>
                  </div>
                ))}
              </div>

              {/* Financial Totals */}
              <div className="space-y-1 font-mono text-xs pt-1">
                <div className="flex justify-between text-slate-700">
                  <span>Subtotal:</span>
                  <span>{formatCurrSymbol(currency)} {(activeReceipt.subTotal || activeReceipt.totalAmount).toLocaleString()}</span>
                </div>

                {(activeReceipt.discount || 0) > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>Discount:</span>
                    <span>-{formatCurrSymbol(currency)} {activeReceipt.discount?.toLocaleString()}</span>
                  </div>
                )}

                <div className="flex justify-between font-black text-sm pt-1 border-t border-slate-300 text-slate-950">
                  <span>Net Paid ({activeReceipt.paymentMethod}):</span>
                  <span>{formatCurrSymbol(currency)} {activeReceipt.totalAmount.toLocaleString()}</span>
                </div>

                {changeReturned > 0 && (
                  <div className="flex justify-between text-[11px] text-slate-600">
                    <span>Change Returned:</span>
                    <span>{formatCurrSymbol(currency)} {changeReturned.toLocaleString()}</span>
                  </div>
                )}
              </div>

              {/* Authorized Signature & Footer */}
              {(() => {
                const posSig = resolveAuthorizedSignatureInfo(
                  activeReceipt,
                  brandName || storeName,
                  currentUser
                );
                return (
                  <div className="pt-3 border-t border-dashed border-slate-300 text-center space-y-1">
                    {posSig.signatureDataUrl ? (
                      <img src={posSig.signatureDataUrl} alt="Authorized Signature" className="h-9 max-w-[140px] object-contain mx-auto" />
                    ) : (
                      <div className="font-serif italic font-bold text-base text-slate-900">{posSig.signerName}</div>
                    )}
                    <div className="text-[10px] font-bold text-emerald-800">
                      Authorized: {posSig.signerName}
                      {posSig.signerUserId ? ` (@${posSig.signerUserId})` : ''}
                    </div>
                  </div>
                );
              })()}

              {/* Footer */}
              <div className="text-center pt-2 border-t border-dashed border-slate-300 text-[10px] text-slate-500 space-y-0.5">
                <p className="font-bold text-slate-800">Thank you for shopping with us!</p>
                <p>Goods once sold can be returned within 3 days with receipt.</p>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* PRINT STYLES FOR POS THERMAL RECEIPT */}
      <style>{`
        @media print {
          @page {
            size: 80mm auto;
            margin: 3mm;
          }
          html, body {
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          body * {
            visibility: hidden !important;
          }
          #printable-pos-receipt, #printable-pos-receipt * {
            visibility: visible !important;
          }
          #printable-pos-receipt {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 8px !important;
            border: none !important;
            box-shadow: none !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

    </div>
  );
};
