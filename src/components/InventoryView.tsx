import React, { useState } from 'react';
import {
  StockItem,
  Category,
  Supplier,
  PriceTier,
  StockBatch,
  DEFAULT_WAREHOUSES,
} from '../data/mockData';
import { sortBatchesFEFO } from '../utils/erpEnhancements';
import { BarcodeLabelModal } from './BarcodeLabelModal';
import {
  Plus,
  Filter,
  Trash2,
  Edit,
  AlertCircle,
  CheckCircle,
  Package,
  Barcode,
  Image as ImageIcon,
  Layers,
  Warehouse,
  Tag,
} from 'lucide-react';

interface InventoryViewProps {
  items: StockItem[];
  categories: Category[];
  suppliers: Supplier[];
  currency: string;
  warehouses?: string[];
  brandName?: string;
  onAddItem: (item: Omit<StockItem, 'id' | 'status'>) => void;
  onUpdateItem: (item: StockItem) => void;
  onDeleteItem: (id: string) => void;
  searchQuery: string;
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  items,
  categories,
  suppliers,
  currency,
  warehouses = DEFAULT_WAREHOUSES,
  brandName = 'Stock ERP',
  onAddItem,
  onUpdateItem,
  onDeleteItem,
  searchQuery,
}) => {
  const [selectedCat, setSelectedCat] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');

  // Modal State for Add / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<StockItem | null>(null);

  // Barcode Print Modal State
  const [barcodeModalItemIds, setBarcodeModalItemIds] = useState<string[] | null>(
    null
  );

  // Form State
  const [name, setName] = useState('');
  const [category, setCategory] = useState(
    categories[0]?.name || 'Tablets & Capsules'
  );
  const [sku, setSku] = useState('');
  const [batchNo, setBatchNo] = useState('');
  const [mfgDate, setMfgDate] = useState('');
  const [packSize, setPackSize] = useState('');
  const [retailPrice, setRetailPrice] = useState<number | ''>('');
  const [quantity, setQuantity] = useState<number | ''>('');
  const [unit, setUnit] = useState('Boxes');
  const [price, setPrice] = useState<number | ''>('');
  const [costPrice, setCostPrice] = useState<number | ''>('');
  const [supplier, setSupplier] = useState(
    suppliers[0]?.name || 'Square Pharmaceuticals Ltd'
  );
  const [expiryDate, setExpiryDate] = useState('2027-12-31');
  const [reorderThreshold, setReorderThreshold] = useState<number | ''>('');
  const [location, setLocation] = useState('Aisle 1 - Shelf A');
  const [imageUrl, setImageUrl] = useState('');
  const [priceTiers, setPriceTiers] = useState<PriceTier[]>([]);
  const [batches, setBatches] = useState<StockBatch[]>([]);
  const [warehouseStocks, setWarehouseStocks] = useState<Record<string, number>>(
    {}
  );

  const warehouseList =
    warehouses && warehouses.length > 0 ? warehouses : DEFAULT_WAREHOUSES;

  // Filter items
  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.batchNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.supplier.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCat = selectedCat === 'All' || item.category === selectedCat;

    const matchesStatus =
      statusFilter === 'All' ||
      (statusFilter === 'Low Stock' &&
        item.quantity <= item.reorderThreshold &&
        item.quantity > 0) ||
      (statusFilter === 'Out of Stock' && item.quantity === 0) ||
      (statusFilter === 'In Stock' && item.quantity > item.reorderThreshold);

    return matchesSearch && matchesCat && matchesStatus;
  });

  const openAddModal = () => {
    setEditingItem(null);
    setName('');
    if (categories.length > 0 && !categories.some((c) => c.name === category)) {
      setCategory(categories[0].name);
    }
    if (suppliers.length > 0 && !suppliers.some((s) => s.name === supplier)) {
      setSupplier(suppliers[0].name);
    }
    setSku(`SKU-${Math.floor(1000 + Math.random() * 9000)}`);
    setBatchNo(`B-2026${Math.floor(10 + Math.random() * 90)}`);
    setMfgDate('');
    setPackSize('');
    setRetailPrice('');
    setQuantity(100);
    setPrice(250);
    setCostPrice(200);
    setReorderThreshold(50);
    setLocation('Aisle 1 - Shelf A');
    setImageUrl('');
    setPriceTiers([]);
    setBatches([]);
    const initWh: Record<string, number> = {};
    warehouseList.forEach((wh, idx) => {
      initWh[wh] = idx === 0 ? 100 : 0;
    });
    setWarehouseStocks(initWh);
    setIsModalOpen(true);
  };

  const openEditModal = (item: StockItem) => {
    setEditingItem(item);
    setName(item.name);
    setCategory(item.category);
    setSku(item.sku);
    setBatchNo(item.batchNo);
    setMfgDate(item.mfgDate || '');
    setPackSize(item.packSize || '');
    setRetailPrice(item.retailPrice ?? '');
    setQuantity(item.quantity);
    setUnit(item.unit);
    setPrice(item.price);
    setCostPrice(item.costPrice);
    setSupplier(item.supplier);
    setExpiryDate(item.expiryDate);
    setReorderThreshold(item.reorderThreshold);
    setLocation(item.location);
    setImageUrl(item.imageUrl || '');
    setPriceTiers(item.priceTiers ? [...item.priceTiers] : []);
    setBatches(item.batches ? [...item.batches] : []);

    const initWh: Record<string, number> = {};
    const hasExistingWh =
      item.warehouseStocks && Object.keys(item.warehouseStocks).length > 0;
    warehouseList.forEach((wh, idx) => {
      initWh[wh] = hasExistingWh
        ? Number(item.warehouseStocks?.[wh] || 0)
        : idx === 0
        ? item.quantity
        : 0;
    });
    setWarehouseStocks(initWh);
    setIsModalOpen(true);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setImageUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAddTier = () => {
    setPriceTiers((prev) => [
      ...prev,
      { minQty: 10, unitPrice: Number(price) || 0 },
    ]);
  };

  const handleAddBatchRow = () => {
    setBatches((prev) => [
      ...prev,
      {
        id: `BTH-${Date.now()}-${Math.floor(Math.random() * 100)}`,
        batchNo: `B-${Math.floor(1000 + Math.random() * 9000)}`,
        mfgDate: mfgDate || undefined,
        expiryDate: expiryDate || '2027-12-31',
        quantity: 0,
      },
    ]);
  };

  const batchTotalQty = batches.reduce(
    (s, b) => s + Math.max(0, Number(b.quantity) || 0),
    0
  );

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const cleanBatches = batches
      .filter((b) => b.batchNo.trim())
      .map((b) => ({
        ...b,
        batchNo: b.batchNo.trim(),
        quantity: Math.max(0, Number(b.quantity) || 0),
      }));

    const orderedBatches =
      cleanBatches.length > 0 ? sortBatchesFEFO(cleanBatches) : [];
    const activeHead =
      orderedBatches.find((b) => b.quantity > 0) || orderedBatches[0];

    const finalQuantity =
      orderedBatches.length > 0
        ? orderedBatches.reduce((s, b) => s + b.quantity, 0)
        : Number(quantity) || 0;

    const finalBatchNo = activeHead ? activeHead.batchNo : batchNo;
    const finalExpiryDate = activeHead ? activeHead.expiryDate : expiryDate;
    const finalMfgDate = activeHead?.mfgDate || mfgDate || undefined;

    const finalThreshold = Number(reorderThreshold) || 0;
    const finalPrice = Number(price) || 0;
    const finalCostPrice = Number(costPrice) || 0;
    const cleanTiers = priceTiers
      .filter((t) => Number(t.minQty) > 0 && Number(t.unitPrice) >= 0)
      .map((t) => ({ minQty: Number(t.minQty), unitPrice: Number(t.unitPrice) }))
      .sort((a, b) => a.minQty - b.minQty);

    const whSum = Object.values(warehouseStocks).reduce(
      (s, v) => s + Math.max(0, Number(v) || 0),
      0
    );
    const finalWarehouseStocks: Record<string, number> =
      whSum > 0
        ? Object.fromEntries(
            warehouseList.map((w) => [w, Math.max(0, Number(warehouseStocks[w] || 0))])
          )
        : { [warehouseList[0]]: finalQuantity };

    if (editingItem) {
      const updatedStatus =
        finalQuantity === 0
          ? 'Out of Stock'
          : finalQuantity <= finalThreshold
          ? 'Low Stock'
          : 'In Stock';
      onUpdateItem({
        ...editingItem,
        name,
        category,
        sku,
        batchNo: finalBatchNo,
        mfgDate: finalMfgDate,
        packSize: packSize.trim() || undefined,
        retailPrice: retailPrice !== '' ? Number(retailPrice) : undefined,
        quantity: finalQuantity,
        unit,
        price: finalPrice,
        costPrice: finalCostPrice,
        supplier,
        expiryDate: finalExpiryDate,
        reorderThreshold: finalThreshold,
        location,
        imageUrl: imageUrl.trim() || undefined,
        priceTiers: cleanTiers.length > 0 ? cleanTiers : undefined,
        batches: orderedBatches.length > 0 ? orderedBatches : undefined,
        warehouseStocks: finalWarehouseStocks,
        status: updatedStatus,
      });
    } else {
      onAddItem({
        name,
        category,
        sku,
        batchNo: finalBatchNo,
        mfgDate: finalMfgDate,
        packSize: packSize.trim() || undefined,
        retailPrice: retailPrice !== '' ? Number(retailPrice) : undefined,
        quantity: finalQuantity,
        unit,
        price: finalPrice,
        costPrice: finalCostPrice,
        supplier,
        expiryDate: finalExpiryDate,
        reorderThreshold: finalThreshold,
        location,
        imageUrl: imageUrl.trim() || undefined,
        priceTiers: cleanTiers.length > 0 ? cleanTiers : undefined,
        batches: orderedBatches.length > 0 ? orderedBatches : undefined,
        warehouseStocks: finalWarehouseStocks,
      });
    }
    setIsModalOpen(false);
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto min-h-full">
      {/* Top action bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl shadow-xs border border-slate-200">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-bold uppercase tracking-wider">
            <Filter className="w-3.5 h-3.5 text-emerald-600" />
            <span>Category:</span>
          </div>
          <select
            value={selectedCat}
            onChange={(e) => setSelectedCat(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-700 font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
          >
            <option value="All">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-bold uppercase tracking-wider ml-2">
            <span>Status:</span>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-700 font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
          >
            <option value="All">All Stock Status</option>
            <option value="In Stock">In Stock</option>
            <option value="Low Stock">Low Stock Alert</option>
            <option value="Out of Stock">Out of Stock</option>
          </select>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            disabled={items.length === 0}
            onClick={() =>
              setBarcodeModalItemIds(filteredItems.slice(0, 8).map((i) => i.id))
            }
            className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer"
          >
            <Barcode className="w-4 h-4 text-emerald-400" />
            <span>Print Barcodes</span>
          </button>

          <button
            type="button"
            onClick={openAddModal}
            className="bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Stock Item</span>
          </button>
        </div>
      </div>

      {/* Item List Table */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] border-b border-slate-200">
              <tr>
                <th className="p-4 font-bold">Item Name &amp; SKU</th>
                <th className="p-4 font-bold">Category</th>
                <th className="p-4 font-bold">Batch &amp; FEFO Expiry</th>
                <th className="p-4 font-bold">Supplier</th>
                <th className="p-4 font-bold">Available Stock</th>
                <th className="p-4 font-bold">Unit Price &amp; Tiers</th>
                <th className="p-4 font-bold">Status</th>
                <th className="p-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.map((item) => {
                const isOut = item.quantity === 0;
                const isLow =
                  item.quantity <= item.reorderThreshold && item.quantity > 0;
                const activeBatchCount = item.batches
                  ? item.batches.filter((b) => b.quantity > 0).length
                  : 0;
                const whEntries = item.warehouseStocks
                  ? Object.entries(item.warehouseStocks).filter(([, q]) => q > 0)
                  : [];

                return (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                            <Package className="w-4 h-4" />
                          </div>
                        )}
                        <div>
                          <div className="font-bold text-slate-900 text-xs">
                            {item.name}
                            {item.packSize && (
                              <span className="ml-1.5 text-[10px] font-semibold text-slate-500">
                                ({item.packSize})
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                            {item.sku} • {item.location}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 font-medium text-slate-600">
                      {item.category}
                    </td>
                    <td className="p-4">
                      <div className="font-mono text-slate-700 font-semibold flex items-center gap-1.5">
                        <span>{item.batchNo}</span>
                        {activeBatchCount > 1 && (
                          <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[9px] font-extrabold border border-indigo-200">
                            {activeBatchCount} Batches FEFO
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {item.mfgDate ? `Mfg: ${item.mfgDate} · ` : ''}Exp: {item.expiryDate}
                      </div>
                    </td>
                    <td className="p-4 text-slate-600 text-[11px]">
                      {item.supplier}
                    </td>
                    <td className="p-4 font-bold text-slate-900">
                      <span
                        className={`text-sm ${
                          isOut
                            ? 'text-rose-600 font-extrabold'
                            : isLow
                            ? 'text-amber-600'
                            : 'text-slate-800'
                        }`}
                      >
                        {item.quantity}
                      </span>
                      <span className="text-[10px] text-slate-400 font-normal ml-1">
                        {item.unit}
                      </span>
                      <div className="text-[10px] text-slate-400">
                        Min: {item.reorderThreshold}
                      </div>
                      {whEntries.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {whEntries.slice(0, 2).map(([wh, q]) => (
                            <span
                              key={wh}
                              className="px-1.5 py-0.5 bg-slate-100 rounded text-[9px] font-semibold text-slate-600"
                            >
                              {wh.split(' ')[0]}: {q}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="p-4 font-bold text-slate-900">
                      <div>
                        {currency} {item.price}
                      </div>
                      <div className="text-[10px] text-slate-400 font-normal">
                        Cost: {currency} {item.costPrice}
                      </div>
                      {item.priceTiers && item.priceTiers.length > 0 && (
                        <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-extrabold">
                          {item.priceTiers.length} Tier Rates
                        </span>
                      )}
                    </td>
                    <td className="p-4">
                      {isOut && (
                        <span className="px-2 py-1 bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[10px] font-bold inline-flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> Out of Stock
                        </span>
                      )}
                      {isLow && (
                        <span className="px-2 py-1 bg-amber-100 text-amber-700 border border-amber-200 rounded-lg text-[10px] font-bold inline-flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> Low Stock
                        </span>
                      )}
                      {!isOut && !isLow && (
                        <span className="px-2 py-1 bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-[10px] font-bold inline-flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> In Stock
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-right space-x-1.5 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setBarcodeModalItemIds([item.id])}
                        className="p-1.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 rounded-lg text-slate-600 transition cursor-pointer"
                        title="Print Barcode Sticker"
                      >
                        <Barcode className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditModal(item)}
                        className="p-1.5 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-600 rounded-lg text-slate-600 transition cursor-pointer"
                        title="Edit Item"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteItem(item.id)}
                        className="p-1.5 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 rounded-lg text-slate-600 transition cursor-pointer"
                        title="Delete Item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400">
                    <Package className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                    No inventory items matched your search or filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-3xl w-full p-6 sm:p-8 space-y-5 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-800 text-lg">
                {editingItem ? 'Edit Stock Item' : 'Add New Inventory Item'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-base font-bold p-1 rounded-lg hover:bg-slate-100 transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-5">
              {/* Product Photo + Identity */}
              <div className="flex flex-col sm:flex-row gap-4 items-start bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="w-20 h-20 rounded-xl bg-white border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt="Product preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ImageIcon className="w-7 h-7 text-slate-300" />
                  )}
                </div>
                <div className="flex-1 space-y-2 w-full">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase">
                    Product Photo (Optional)
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={imageUrl.startsWith('data:') ? '' : imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      placeholder="Paste image URL or upload file..."
                      className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800"
                    />
                    <label className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-bold cursor-pointer hover:bg-slate-800 text-center">
                      Upload Photo
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                    </label>
                    {imageUrl && (
                      <button
                        type="button"
                        onClick={() => setImageUrl('')}
                        className="px-2.5 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-lg"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 tracking-wide">
                    Item / Product Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                    placeholder="e.g. Dear Face Wash 30ml"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 tracking-wide">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 tracking-wide">
                    SKU / Barcode Code
                  </label>
                  <input
                    type="text"
                    required
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-mono font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 tracking-wide">
                    Pack Size (e.g. 200 ml / 30g)
                  </label>
                  <input
                    type="text"
                    value={packSize}
                    onChange={(e) => setPackSize(e.target.value)}
                    placeholder="Optional"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 tracking-wide">
                    M.R.P ({currency})
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={retailPrice}
                    onChange={(e) =>
                      setRetailPrice(
                        e.target.value === '' ? '' : Number(e.target.value)
                      )
                    }
                    placeholder="Optional MRP"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 tracking-wide">
                    Primary Batch Number
                  </label>
                  <input
                    type="text"
                    required={batches.length === 0}
                    value={batchNo}
                    onChange={(e) => setBatchNo(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-mono font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 tracking-wide">
                    Manufacturing Date (Mfg Date)
                  </label>
                  <input
                    type="date"
                    value={mfgDate}
                    onChange={(e) => setMfgDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 tracking-wide">
                    Primary Expiry Date
                  </label>
                  <input
                    type="date"
                    required={batches.length === 0}
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 tracking-wide">
                    Total Quantity{' '}
                    {batches.length > 0 && (
                      <span className="text-emerald-600">(Auto from Batches)</span>
                    )}
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    readOnly={batches.length > 0}
                    value={batches.length > 0 ? batchTotalQty : quantity}
                    onChange={(e) =>
                      setQuantity(
                        e.target.value === '' ? '' : Number(e.target.value)
                      )
                    }
                    className={`w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition ${
                      batches.length > 0 ? 'bg-emerald-50/70' : 'bg-slate-50'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 tracking-wide">
                    Unit Type
                  </label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                  >
                    <option value="Boxes">Boxes</option>
                    <option value="Bottles">Bottles</option>
                    <option value="Bags">Bags</option>
                    <option value="Packs">Packs</option>
                    <option value="Tubes">Tubes</option>
                    <option value="Kg">Kg</option>
                    <option value="Pieces">Pieces</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 tracking-wide">
                    Wholesale Price ({currency})
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={price}
                    onChange={(e) =>
                      setPrice(
                        e.target.value === '' ? '' : Number(e.target.value)
                      )
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 tracking-wide">
                    Cost Price ({currency})
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={costPrice}
                    onChange={(e) =>
                      setCostPrice(
                        e.target.value === '' ? '' : Number(e.target.value)
                      )
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 tracking-wide">
                    Supplier / Vendor
                  </label>
                  <select
                    value={supplier}
                    onChange={(e) => setSupplier(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                  >
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 tracking-wide">
                    Reorder Alert Threshold
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={reorderThreshold}
                    onChange={(e) =>
                      setReorderThreshold(
                        e.target.value === '' ? '' : Number(e.target.value)
                      )
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 tracking-wide">
                    Storage Location / Shelf
                  </label>
                  <input
                    type="text"
                    required
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                    placeholder="e.g. Aisle 1 - Shelf A"
                  />
                </div>
              </div>

              {/* Tiered Wholesale Pricing Section */}
              <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-extrabold text-emerald-900">
                    <Tag className="w-4 h-4 text-emerald-600" />
                    <span>Tiered Wholesale Pricing (Qty Slab Discounts)</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddTier}
                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold cursor-pointer"
                  >
                    + Add Price Tier
                  </button>
                </div>
                {priceTiers.length === 0 ? (
                  <p className="text-[11px] text-slate-500">
                    Optional: Set lower unit rates for bulk quantities (e.g., 50+ pcs = ৳110, 100+ pcs = ৳102).
                  </p>
                ) : (
                  <div className="space-y-2">
                    {priceTiers.map((tier, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-slate-600">
                          Min Qty:
                        </span>
                        <input
                          type="number"
                          min="1"
                          value={tier.minQty}
                          onChange={(e) =>
                            setPriceTiers((prev) =>
                              prev.map((t, i) =>
                                i === idx
                                  ? { ...t, minQty: Number(e.target.value) || 1 }
                                  : t
                              )
                            )
                          }
                          className="w-24 bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-mono font-bold"
                        />
                        <span className="text-[11px] font-bold text-slate-600">
                          Unit Price ({currency}):
                        </span>
                        <input
                          type="number"
                          min="0"
                          value={tier.unitPrice}
                          onChange={(e) =>
                            setPriceTiers((prev) =>
                              prev.map((t, i) =>
                                i === idx
                                  ? {
                                      ...t,
                                      unitPrice: Number(e.target.value) || 0,
                                    }
                                  : t
                              )
                            )
                          }
                          className="w-28 bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-mono font-bold text-emerald-700"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setPriceTiers((prev) =>
                              prev.filter((_, i) => i !== idx)
                            )
                          }
                          className="p-1 text-rose-500 hover:bg-rose-50 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Multi-Batch FEFO Manager */}
              <div className="p-4 rounded-xl bg-indigo-50/50 border border-indigo-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-extrabold text-indigo-950">
                    <Layers className="w-4 h-4 text-indigo-600" />
                    <span>Multi-Batch FEFO Lots (Earliest Expiry First-Out)</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddBatchRow}
                    className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-bold cursor-pointer"
                  >
                    + Add Batch Lot
                  </button>
                </div>
                {batches.length === 0 ? (
                  <p className="text-[11px] text-slate-500">
                    Add multiple production batches to automatically deduct earliest-expiring stock first during sales.
                  </p>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-12 gap-2 px-2 text-[10px] font-bold text-slate-500 uppercase">
                      <span className="col-span-3">Batch No</span>
                      <span className="col-span-3">Mfg Date</span>
                      <span className="col-span-3">Exp Date</span>
                      <span className="col-span-2">Qty</span>
                      <span className="col-span-1"></span>
                    </div>
                    {batches.map((b, idx) => (
                      <div
                        key={b.id}
                        className="grid grid-cols-12 gap-2 items-center bg-white p-2 rounded-lg border border-indigo-100"
                      >
                        <input
                          type="text"
                          value={b.batchNo}
                          onChange={(e) =>
                            setBatches((prev) =>
                              prev.map((x, i) =>
                                i === idx ? { ...x, batchNo: e.target.value } : x
                              )
                            )
                          }
                          placeholder="Batch No"
                          className="col-span-3 bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs font-mono font-bold"
                        />
                        <input
                          type="date"
                          value={b.mfgDate || ''}
                          onChange={(e) =>
                            setBatches((prev) =>
                              prev.map((x, i) =>
                                i === idx
                                  ? { ...x, mfgDate: e.target.value || undefined }
                                  : x
                              )
                            )
                          }
                          aria-label={`Batch ${idx + 1} Manufacturing Date`}
                          className="col-span-3 bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs"
                        />
                        <input
                          type="date"
                          value={b.expiryDate}
                          onChange={(e) =>
                            setBatches((prev) =>
                              prev.map((x, i) =>
                                i === idx
                                  ? { ...x, expiryDate: e.target.value }
                                  : x
                              )
                            )
                          }
                          aria-label={`Batch ${idx + 1} Expiry Date`}
                          className="col-span-3 bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs"
                        />
                        <input
                          type="number"
                          min="0"
                          value={b.quantity}
                          onChange={(e) =>
                            setBatches((prev) =>
                              prev.map((x, i) =>
                                i === idx
                                  ? { ...x, quantity: Number(e.target.value) || 0 }
                                  : x
                              )
                            )
                          }
                          placeholder="Qty"
                          className="col-span-2 bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs font-mono font-bold"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setBatches((prev) =>
                              prev.filter((_, i) => i !== idx)
                            )
                          }
                          className="col-span-1 text-rose-500 hover:text-rose-700 flex justify-center"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Warehouse / Godown Stock Allocation */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-800">
                  <Warehouse className="w-4 h-4 text-slate-600" />
                  <span>Warehouse / Godown Stock Allocation</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {warehouseList.map((wh) => (
                    <div
                      key={wh}
                      className="bg-white border border-slate-200 rounded-lg px-3 py-2"
                    >
                      <label className="block text-[10px] font-bold text-slate-500 uppercase truncate mb-1">
                        {wh}
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={warehouseStocks[wh] ?? 0}
                        onChange={(e) =>
                          setWarehouseStocks((prev) => ({
                            ...prev,
                            [wh]: Math.max(0, Number(e.target.value) || 0),
                          }))
                        }
                        className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs font-mono font-bold text-slate-900"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 text-xs font-extrabold text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 font-extrabold text-xs shadow-md hover:from-emerald-600 hover:to-cyan-600 transition transform hover:-translate-y-0.5 cursor-pointer"
                >
                  {editingItem ? 'Save Updates' : 'Add Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Barcode Sticker Sheet Modal */}
      {barcodeModalItemIds && (
        <BarcodeLabelModal
          items={items}
          initialSelectedIds={barcodeModalItemIds}
          brandName={brandName}
          currency={currency}
          onClose={() => setBarcodeModalItemIds(null)}
        />
      )}
    </div>
  );
};
