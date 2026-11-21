import {
  PurchaseOrder,
  StockItem,
  StockTransaction,
  Supplier,
} from '../data/mockData';
import { extractYYYYMMDD } from './dateUtils';

export interface PurchaseEntryRow {
  id: string;
  date: string;
  dateYMD: string;
  reference: string;
  supplierName: string;
  category: string;
  itemId: string;
  itemName: string;
  sku: string;
  unit: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  notes: string;
  user: string;
  source: 'Stock IN' | 'Purchase Order';
}

export interface SupplierProductPurchase {
  itemId: string;
  itemName: string;
  sku: string;
  category: string;
  unit: string;
  entryCount: number;
  totalUnits: number;
  avgUnitCost: number;
  totalCost: number;
}

export interface SupplierPurchaseSummary {
  supplierName: string;
  entryCount: number;
  distinctProducts: number;
  categories: string[];
  totalUnits: number;
  totalCost: number;
  sharePct: number;
  products: SupplierProductPurchase[];
}

export interface CategoryProductPurchase {
  itemId: string;
  itemName: string;
  sku: string;
  category: string;
  unit: string;
  suppliers: string[];
  entryCount: number;
  totalUnits: number;
  avgUnitCost: number;
  totalCost: number;
}

export interface CategoryPurchaseSummary {
  category: string;
  supplierCount: number;
  suppliers: string[];
  distinctProducts: number;
  entryCount: number;
  totalUnits: number;
  totalCost: number;
  sharePct: number;
  products: CategoryProductPurchase[];
}

export interface SupplierPurchaseReport {
  entries: PurchaseEntryRow[];
  supplierSummaries: SupplierPurchaseSummary[];
  categorySummaries: CategoryPurchaseSummary[];
  productSummaries: CategoryProductPurchase[];
  availableSuppliers: string[];
  totals: {
    totalSuppliers: number;
    totalCategories: number;
    totalDistinctProducts: number;
    totalEntries: number;
    totalUnits: number;
    totalCost: number;
  };
}

export interface PurchaseReportParams {
  items: StockItem[];
  transactions: StockTransaction[];
  purchaseOrders?: PurchaseOrder[];
  suppliers?: Supplier[];
  startDate?: string;
  endDate?: string;
  supplierFilter?: string;
  categoryFilter?: string;
  searchQuery?: string;
}

const parseSupplierFromNotes = (notes?: string): string => {
  if (!notes) return '';
  const match = notes.match(/(?:PO Received from|Initial Stock Purchase from|Purchased from|From)\s+(.+)$/i);
  if (match && match[1]) {
    return match[1].trim();
  }
  return '';
};

/**
 * Aggregates Stock IN transactions and Received Purchase Orders (deduplicated by PO number)
 * into Supplier-wise, Category-wise, and Product-wise purchase reports.
 */
export const computeSupplierPurchaseReport = ({
  items,
  transactions,
  purchaseOrders = [],
  suppliers = [],
  startDate = '2000-01-01',
  endDate = '2100-12-31',
  supplierFilter = 'All',
  categoryFilter = 'All',
  searchQuery = '',
}: PurchaseReportParams): SupplierPurchaseReport => {
  const itemsById = new Map<string, StockItem>();
  items.forEach((it) => itemsById.set(it.id, it));

  const poByPoNo = new Map<string, PurchaseOrder>();
  purchaseOrders.forEach((po) => {
    if (po.poNo) poByPoNo.set(po.poNo.trim(), po);
  });

  const allRawEntries: PurchaseEntryRow[] = [];
  const coveredPoNos = new Set<string>();

  // 1. Collect all Stock IN transactions
  for (const txn of transactions) {
    if (txn.type !== 'IN' || Number(txn.quantity) <= 0) continue;
    const item = itemsById.get(txn.itemId);
    const refTrim = (txn.reference || '').trim();
    const matchedPo = refTrim ? poByPoNo.get(refTrim) : undefined;
    if (matchedPo && refTrim) {
      coveredPoNos.add(refTrim);
    }

    const resolvedSupplier = (
      txn.supplierName ||
      matchedPo?.supplierName ||
      parseSupplierFromNotes(txn.notes) ||
      item?.supplier ||
      'Unassigned Supplier'
    ).trim() || 'Unassigned Supplier';

    const resolvedCategory = (
      txn.category ||
      item?.category ||
      'Uncategorized'
    ).trim() || 'Uncategorized';

    const qty = Number(txn.quantity) || 0;
    const unitCost = Number(txn.unitPrice ?? item?.costPrice ?? 0);
    const totalCost =
      typeof txn.totalPrice === 'number' && !Number.isNaN(txn.totalPrice) && txn.totalPrice > 0
        ? txn.totalPrice
        : qty * unitCost;

    allRawEntries.push({
      id: txn.id,
      date: txn.date || '',
      dateYMD: extractYYYYMMDD(txn.date),
      reference: txn.reference || '-',
      supplierName: resolvedSupplier,
      category: resolvedCategory,
      itemId: txn.itemId,
      itemName: txn.itemName || item?.name || 'Unnamed Product',
      sku: item?.sku || '-',
      unit: item?.unit || 'Pcs',
      quantity: qty,
      unitCost,
      totalCost,
      notes: txn.notes || '',
      user: txn.user || 'Admin',
      source: matchedPo ? 'Purchase Order' : 'Stock IN',
    });
  }

  // 2. Include Received Purchase Orders that do not already have matching IN transactions
  for (const po of purchaseOrders) {
    if (po.status !== 'Received') continue;
    const poKey = (po.poNo || '').trim();
    if (poKey && coveredPoNos.has(poKey)) continue;

    const poDateYMD = extractYYYYMMDD(po.date);
    (po.items || []).forEach((poItem, idx) => {
      if (Number(poItem.quantity) <= 0) return;
      const item = itemsById.get(poItem.itemId);
      const qty = Number(poItem.quantity) || 0;
      const unitCost = Number(poItem.costPrice ?? item?.costPrice ?? 0);
      const totalCost = Number(poItem.total) || qty * unitCost;

      allRawEntries.push({
        id: `${po.id}-ITEM-${idx}`,
        date: po.date || '',
        dateYMD: poDateYMD,
        reference: po.poNo || po.id,
        supplierName: (po.supplierName || item?.supplier || 'Unassigned Supplier').trim(),
        category: (item?.category || 'Uncategorized').trim(),
        itemId: poItem.itemId,
        itemName: poItem.itemName || item?.name || 'Unnamed Product',
        sku: item?.sku || '-',
        unit: item?.unit || 'Pcs',
        quantity: qty,
        unitCost,
        totalCost,
        notes: po.notes || `Purchase Order ${po.poNo}`,
        user: 'PO System',
        source: 'Purchase Order',
      });
    });
  }

  // Collect full supplier dropdown list across suppliers master, items, and recorded entries
  const supplierSet = new Set<string>();
  suppliers.forEach((s) => s.name?.trim() && supplierSet.add(s.name.trim()));
  items.forEach((it) => it.supplier?.trim() && supplierSet.add(it.supplier.trim()));
  allRawEntries.forEach((e) => e.supplierName && supplierSet.add(e.supplierName));
  const availableSuppliers = Array.from(supplierSet).sort((a, b) => a.localeCompare(b));

  // Apply Date Range, Supplier, Category, Search filters
  const q = searchQuery.trim().toLowerCase();
  const entries = allRawEntries
    .filter((e) => {
      if (startDate && e.dateYMD < startDate) return false;
      if (endDate && e.dateYMD > endDate) return false;
      if (supplierFilter && supplierFilter !== 'All' && e.supplierName !== supplierFilter) {
        return false;
      }
      if (categoryFilter && categoryFilter !== 'All' && e.category !== categoryFilter) {
        return false;
      }
      if (q) {
        const hay = `${e.itemName} ${e.sku} ${e.supplierName} ${e.category} ${e.reference} ${e.notes}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  const grandTotalCost = entries.reduce((sum, e) => sum + e.totalCost, 0);
  const grandTotalUnits = entries.reduce((sum, e) => sum + e.quantity, 0);

  // Build Supplier-wise Summaries
  const supplierMap = new Map<
    string,
    {
      supplierName: string;
      entryCount: number;
      categories: Set<string>;
      totalUnits: number;
      totalCost: number;
      productsMap: Map<string, SupplierProductPurchase>;
    }
  >();

  // Build Category-wise Summaries
  const categoryMap = new Map<
    string,
    {
      category: string;
      suppliers: Set<string>;
      entryCount: number;
      totalUnits: number;
      totalCost: number;
      productsMap: Map<
        string,
        {
          itemId: string;
          itemName: string;
          sku: string;
          category: string;
          unit: string;
          suppliers: Set<string>;
          entryCount: number;
          totalUnits: number;
          totalCost: number;
        }
      >;
    }
  >();

  // Build Combined Product Summaries (grouped by itemId + category)
  const productGlobalMap = new Map<
    string,
    {
      itemId: string;
      itemName: string;
      sku: string;
      category: string;
      unit: string;
      suppliers: Set<string>;
      entryCount: number;
      totalUnits: number;
      totalCost: number;
    }
  >();

  for (const e of entries) {
    const productKey = `${e.itemId || e.itemName}__${e.category}`;

    // 1. Supplier bucket
    let supBucket = supplierMap.get(e.supplierName);
    if (!supBucket) {
      supBucket = {
        supplierName: e.supplierName,
        entryCount: 0,
        categories: new Set<string>(),
        totalUnits: 0,
        totalCost: 0,
        productsMap: new Map<string, SupplierProductPurchase>(),
      };
      supplierMap.set(e.supplierName, supBucket);
    }
    supBucket.entryCount += 1;
    supBucket.categories.add(e.category);
    supBucket.totalUnits += e.quantity;
    supBucket.totalCost += e.totalCost;

    const existingSupProd = supBucket.productsMap.get(productKey);
    if (existingSupProd) {
      existingSupProd.entryCount += 1;
      existingSupProd.totalUnits += e.quantity;
      existingSupProd.totalCost += e.totalCost;
      existingSupProd.avgUnitCost =
        existingSupProd.totalUnits > 0
          ? Math.round((existingSupProd.totalCost / existingSupProd.totalUnits) * 100) / 100
          : 0;
    } else {
      supBucket.productsMap.set(productKey, {
        itemId: e.itemId,
        itemName: e.itemName,
        sku: e.sku,
        category: e.category,
        unit: e.unit,
        entryCount: 1,
        totalUnits: e.quantity,
        avgUnitCost: e.unitCost,
        totalCost: e.totalCost,
      });
    }

    // 2. Category bucket
    let catBucket = categoryMap.get(e.category);
    if (!catBucket) {
      catBucket = {
        category: e.category,
        suppliers: new Set<string>(),
        entryCount: 0,
        totalUnits: 0,
        totalCost: 0,
        productsMap: new Map(),
      };
      categoryMap.set(e.category, catBucket);
    }
    catBucket.suppliers.add(e.supplierName);
    catBucket.entryCount += 1;
    catBucket.totalUnits += e.quantity;
    catBucket.totalCost += e.totalCost;

    const existingCatProd = catBucket.productsMap.get(productKey);
    if (existingCatProd) {
      existingCatProd.suppliers.add(e.supplierName);
      existingCatProd.entryCount += 1;
      existingCatProd.totalUnits += e.quantity;
      existingCatProd.totalCost += e.totalCost;
    } else {
      catBucket.productsMap.set(productKey, {
        itemId: e.itemId,
        itemName: e.itemName,
        sku: e.sku,
        category: e.category,
        unit: e.unit,
        suppliers: new Set([e.supplierName]),
        entryCount: 1,
        totalUnits: e.quantity,
        totalCost: e.totalCost,
      });
    }

    // 3. Global Product bucket
    const existingGlobalProd = productGlobalMap.get(productKey);
    if (existingGlobalProd) {
      existingGlobalProd.suppliers.add(e.supplierName);
      existingGlobalProd.entryCount += 1;
      existingGlobalProd.totalUnits += e.quantity;
      existingGlobalProd.totalCost += e.totalCost;
    } else {
      productGlobalMap.set(productKey, {
        itemId: e.itemId,
        itemName: e.itemName,
        sku: e.sku,
        category: e.category,
        unit: e.unit,
        suppliers: new Set([e.supplierName]),
        entryCount: 1,
        totalUnits: e.quantity,
        totalCost: e.totalCost,
      });
    }
  }

  const supplierSummaries: SupplierPurchaseSummary[] = Array.from(supplierMap.values())
    .map((s) => {
      const products = Array.from(s.productsMap.values()).sort(
        (a, b) => b.totalCost - a.totalCost || b.totalUnits - a.totalUnits
      );
      return {
        supplierName: s.supplierName,
        entryCount: s.entryCount,
        distinctProducts: products.length,
        categories: Array.from(s.categories).sort(),
        totalUnits: s.totalUnits,
        totalCost: s.totalCost,
        sharePct:
          grandTotalCost > 0
            ? Math.round((s.totalCost / grandTotalCost) * 1000) / 10
            : grandTotalUnits > 0
            ? Math.round((s.totalUnits / grandTotalUnits) * 1000) / 10
            : 0,
        products,
      };
    })
    .sort((a, b) => b.totalCost - a.totalCost || b.totalUnits - a.totalUnits);

  const categorySummaries: CategoryPurchaseSummary[] = Array.from(categoryMap.values())
    .map((c) => {
      const products: CategoryProductPurchase[] = Array.from(c.productsMap.values())
        .map((p) => ({
          itemId: p.itemId,
          itemName: p.itemName,
          sku: p.sku,
          category: p.category,
          unit: p.unit,
          suppliers: Array.from(p.suppliers).sort(),
          entryCount: p.entryCount,
          totalUnits: p.totalUnits,
          avgUnitCost:
            p.totalUnits > 0
              ? Math.round((p.totalCost / p.totalUnits) * 100) / 100
              : 0,
          totalCost: p.totalCost,
        }))
        .sort((a, b) => b.totalCost - a.totalCost || b.totalUnits - a.totalUnits);

      return {
        category: c.category,
        supplierCount: c.suppliers.size,
        suppliers: Array.from(c.suppliers).sort(),
        distinctProducts: products.length,
        entryCount: c.entryCount,
        totalUnits: c.totalUnits,
        totalCost: c.totalCost,
        sharePct:
          grandTotalCost > 0
            ? Math.round((c.totalCost / grandTotalCost) * 1000) / 10
            : grandTotalUnits > 0
            ? Math.round((c.totalUnits / grandTotalUnits) * 1000) / 10
            : 0,
        products,
      };
    })
    .sort((a, b) => b.totalCost - a.totalCost || b.totalUnits - a.totalUnits);

  const productSummaries: CategoryProductPurchase[] = Array.from(productGlobalMap.values())
    .map((p) => ({
      itemId: p.itemId,
      itemName: p.itemName,
      sku: p.sku,
      category: p.category,
      unit: p.unit,
      suppliers: Array.from(p.suppliers).sort(),
      entryCount: p.entryCount,
      totalUnits: p.totalUnits,
      avgUnitCost:
        p.totalUnits > 0 ? Math.round((p.totalCost / p.totalUnits) * 100) / 100 : 0,
      totalCost: p.totalCost,
    }))
    .sort((a, b) => a.category.localeCompare(b.category) || b.totalUnits - a.totalUnits);

  return {
    entries,
    supplierSummaries,
    categorySummaries,
    productSummaries,
    availableSuppliers,
    totals: {
      totalSuppliers: supplierSummaries.length,
      totalCategories: categorySummaries.length,
      totalDistinctProducts: productSummaries.length,
      totalEntries: entries.length,
      totalUnits: grandTotalUnits,
      totalCost: grandTotalCost,
    },
  };
};

const csvEscape = (val: unknown): string => {
  const s = String(val ?? '');
  return `"${s.replace(/"/g, '""')}"`;
};

export const buildSupplierPurchaseCsv = (report: SupplierPurchaseReport): string => {
  const lines: string[] = [];

  lines.push('SUPPLIER-WISE PURCHASE SUMMARY');
  lines.push('Supplier,Categories,Distinct Products,Purchase Entries,Total Units,Total Purchase Value,Share %');
  report.supplierSummaries.forEach((s) => {
    lines.push(
      [
        csvEscape(s.supplierName),
        csvEscape(s.categories.join(' | ')),
        s.distinctProducts,
        s.entryCount,
        s.totalUnits,
        s.totalCost,
        `${s.sharePct}%`,
      ].join(',')
    );
  });

  lines.push('');
  lines.push('CATEGORY & PRODUCT BREAKDOWN');
  lines.push('Category,Product Name,SKU,Suppliers,Unit,Entries,Total Units,Avg Unit Cost,Total Cost');
  report.productSummaries.forEach((p) => {
    lines.push(
      [
        csvEscape(p.category),
        csvEscape(p.itemName),
        csvEscape(p.sku),
        csvEscape(p.suppliers.join(' | ')),
        csvEscape(p.unit),
        p.entryCount,
        p.totalUnits,
        p.avgUnitCost,
        p.totalCost,
      ].join(',')
    );
  });

  lines.push('');
  lines.push('DETAILED STOCK IN / PURCHASE ENTRIES');
  lines.push('Date,Reference/PO,Source,Supplier,Category,Product Name,SKU,Quantity,Unit,Unit Cost,Total Cost,Notes');
  report.entries.forEach((e) => {
    lines.push(
      [
        csvEscape(e.date.replace('T', ' ')),
        csvEscape(e.reference),
        csvEscape(e.source),
        csvEscape(e.supplierName),
        csvEscape(e.category),
        csvEscape(e.itemName),
        csvEscape(e.sku),
        e.quantity,
        csvEscape(e.unit),
        e.unitCost,
        e.totalCost,
        csvEscape(e.notes),
      ].join(',')
    );
  });

  return lines.join('\n');
};
