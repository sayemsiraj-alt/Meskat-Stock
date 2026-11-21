import {
  DEFAULT_WAREHOUSES,
  Invoice,
  SalesRep,
  StockBatch,
  StockItem,
  Wholesaler,
} from '../data/mockData';
import { formatDDMMYY } from './dateUtils';
import { formatTkAmount } from './numberToWords';

export interface ResolvedUnitPrice {
  unitPrice: number;
  pricingSource: 'approved' | 'tier' | 'standard';
  appliedTierMinQty?: number;
}

/**
 * Resolves the effective unit price for a stock item considering:
 * 1. Buyer-specific custom approved rate (highest priority)
 * 2. Quantity-based tiered wholesale pricing (`item.priceTiers`)
 * 3. Standard item wholesale price (`item.price`)
 */
export const resolveWholesaleUnitPrice = (
  item: StockItem,
  buyer?: Wholesaler | null,
  quantity = 1
): ResolvedUnitPrice => {
  const custom = buyer?.approvedPrices?.[item.id];
  if (typeof custom === 'number' && !Number.isNaN(custom) && custom >= 0) {
    return { unitPrice: custom, pricingSource: 'approved' };
  }

  if (item.priceTiers && item.priceTiers.length > 0 && quantity > 0) {
    const sorted = [...item.priceTiers]
      .filter((t) => t.minQty > 0 && t.unitPrice >= 0)
      .sort((a, b) => b.minQty - a.minQty);
    const matched = sorted.find((t) => quantity >= t.minQty);
    if (matched) {
      return {
        unitPrice: matched.unitPrice,
        pricingSource: 'tier',
        appliedTierMinQty: matched.minQty,
      };
    }
  }

  return { unitPrice: item.price, pricingSource: 'standard' };
};

export interface CreditLimitCheckResult {
  hasLimit: boolean;
  creditLimit: number;
  currentDue: number;
  projectedDue: number;
  exceeds: boolean;
  remainingCredit: number;
  excessAmount: number;
}

/**
 * Evaluates whether an incoming bill or portal order pushes a buyer past their credit limit.
 */
export const evaluateCreditLimit = (
  buyer?: Wholesaler | null,
  incomingNetDue = 0
): CreditLimitCheckResult => {
  const creditLimit = Number(buyer?.creditLimit || 0);
  const currentDue = Number(buyer?.totalDue || 0);
  const projectedDue = Math.max(0, currentDue + Math.max(0, incomingNetDue));

  if (!buyer || creditLimit <= 0) {
    return {
      hasLimit: false,
      creditLimit: 0,
      currentDue,
      projectedDue,
      exceeds: false,
      remainingCredit: Infinity,
      excessAmount: 0,
    };
  }

  const remainingCredit = Math.max(0, creditLimit - currentDue);
  const exceeds = projectedDue > creditLimit;
  const excessAmount = exceeds ? projectedDue - creditLimit : 0;

  return {
    hasLimit: true,
    creditLimit,
    currentDue,
    projectedDue,
    exceeds,
    remainingCredit,
    excessAmount,
  };
};

export interface BuyerAgingRow {
  wholesalerId: string;
  wholesalerName: string;
  phone: string;
  totalDue: number;
  bucket0_30: number;
  bucket31_60: number;
  bucket61_90: number;
  bucket90Plus: number;
  oldestUnpaidDays: number;
}

/**
 * Computes Receivables Due Aging Report across 4 aging buckets (0-30, 31-60, 61-90, 90+ days).
 * Uses newest-first allocation of `buyer.totalDue` against the buyer's billed wholesale invoices.
 */
export const computeDueAgingReport = (
  wholesalers: Wholesaler[],
  invoices: Invoice[],
  referenceDateISO?: string
): {
  rows: BuyerAgingRow[];
  totals: {
    totalDue: number;
    bucket0_30: number;
    bucket31_60: number;
    bucket61_90: number;
    bucket90Plus: number;
  };
} => {
  const refTime = referenceDateISO
    ? new Date(referenceDateISO).getTime()
    : Date.now();
  const msPerDay = 1000 * 60 * 60 * 24;

  const rows: BuyerAgingRow[] = wholesalers
    .filter((w) => (w.totalDue || 0) > 0)
    .map((w) => {
      let remaining = Number(w.totalDue || 0);
      let bucket0_30 = 0;
      let bucket31_60 = 0;
      let bucket61_90 = 0;
      let bucket90Plus = 0;
      let oldestUnpaidDays = 0;

      const buyerInvs = invoices
        .filter((inv) => inv.wholesalerId === w.id && inv.saleType !== 'Retail')
        .sort(
          (a, b) =>
            new Date(b.deliveryDate || b.date).getTime() -
            new Date(a.deliveryDate || a.date).getTime()
        );

      for (const inv of buyerInvs) {
        if (remaining <= 0) break;
        const invBill =
          inv.subTotal ?? inv.items.reduce((s, it) => s + it.total, 0);
        const alloc = Math.min(remaining, Math.max(invBill, 0));
        if (alloc <= 0) continue;

        const invTime = new Date(inv.deliveryDate || inv.date).getTime();
        const ageDays = Number.isNaN(invTime)
          ? 0
          : Math.max(0, Math.floor((refTime - invTime) / msPerDay));
        if (ageDays > oldestUnpaidDays) oldestUnpaidDays = ageDays;

        if (ageDays <= 30) bucket0_30 += alloc;
        else if (ageDays <= 60) bucket31_60 += alloc;
        else if (ageDays <= 90) bucket61_90 += alloc;
        else bucket90Plus += alloc;

        remaining -= alloc;
      }

      // Any residual due older than tracked invoices falls into 90+ days bucket
      if (remaining > 0) {
        bucket90Plus += remaining;
        if (oldestUnpaidDays < 91) oldestUnpaidDays = 91;
      }

      return {
        wholesalerId: w.id,
        wholesalerName: w.name,
        phone: w.phone || '',
        totalDue: Number(w.totalDue || 0),
        bucket0_30,
        bucket31_60,
        bucket61_90,
        bucket90Plus,
        oldestUnpaidDays,
      };
    })
    .sort((a, b) => b.totalDue - a.totalDue);

  const totals = rows.reduce(
    (acc, r) => ({
      totalDue: acc.totalDue + r.totalDue,
      bucket0_30: acc.bucket0_30 + r.bucket0_30,
      bucket31_60: acc.bucket31_60 + r.bucket31_60,
      bucket61_90: acc.bucket61_90 + r.bucket61_90,
      bucket90Plus: acc.bucket90Plus + r.bucket90Plus,
    }),
    { totalDue: 0, bucket0_30: 0, bucket31_60: 0, bucket61_90: 0, bucket90Plus: 0 }
  );

  return { rows, totals };
};

/**
 * Normalizes Bangladeshi or international mobile numbers for WhatsApp wa.me links.
 */
export const formatBDPhoneForWhatsApp = (phone?: string): string => {
  const digits = (phone || '').replace(/[^0-9]/g, '');
  if (!digits) return '';
  if (digits.startsWith('880') && digits.length >= 13) return digits;
  if (digits.startsWith('01') && digits.length === 11) return `88${digits}`;
  return digits;
};

export const getWhatsAppUrl = (phone: string | undefined, text: string): string => {
  const clean = formatBDPhoneForWhatsApp(phone);
  return clean
    ? `https://wa.me/${clean}?text=${encodeURIComponent(text)}`
    : `https://wa.me/?text=${encodeURIComponent(text)}`;
};

export const buildInvoiceWhatsAppText = (
  inv: Invoice,
  brandTitle: string
): string => {
  const bill = inv.subTotal ?? inv.items.reduce((s, it) => s + it.total, 0);
  const totalBonus = inv.items.reduce((s, it) => s + (it.bonusQty || 0), 0);
  const itemsSummary = inv.items
    .map(
      (it) =>
        `• ${it.itemName}: ${it.quantity}${
          (it.bonusQty || 0) > 0 ? ` (+${it.bonusQty} Free)` : ''
        } x ${it.unitPrice}/=`
    )
    .join('\n');
  return `*${brandTitle.toUpperCase()} - INVOICE*
Invoice No: ${inv.chalanNo}
Delivery Date: ${formatDDMMYY(inv.deliveryDate || inv.date)}
Customer: ${inv.wholesalerName}${
    itemsSummary ? `\nItems:\n${itemsSummary}` : ''
  }${totalBonus > 0 ? `\nBonus / Free Units Included: ${totalBonus} pcs` : ''}
Amount: ${formatTkAmount(bill)}
Previous Due: ${formatTkAmount(inv.previousDue || 0)}
Total Amount: ${formatTkAmount(inv.grandTotal || inv.totalAmount)}
Advance Payment: ${formatTkAmount(inv.paidAmount)}
Total Due: ${formatTkAmount(inv.dueAmount)}
Courier: ${inv.courierName || 'Standard Courier'}${inv.courierTrackingNo ? ` (Tracking: ${inv.courierTrackingNo})` : ''}`;
};

export const buildDueReminderWhatsAppText = (
  buyerName: string,
  dueAmount: number,
  brandTitle: string,
  phone?: string
): string => {
  return `Assalamu Alaikum ${buyerName},
This is a gentle payment reminder from *${brandTitle}*.
Your current outstanding due balance is *${formatTkAmount(dueAmount)}*.
Kindly remit payment at your earliest convenience or submit your TrxID/bank slip in your Buyer Portal.${phone ? `\nContact: ${phone}` : ''}`;
};

export const buildReceiptWhatsAppText = (params: {
  brandTitle: string;
  buyerName: string;
  receiptNo: string;
  amount: number;
  method: string;
  date: string;
  remainingDue: number;
}): string => {
  return `*${params.brandTitle.toUpperCase()} - PAYMENT RECEIPT*
Receipt No: ${params.receiptNo}
Date: ${formatDDMMYY(params.date)}
Received From: ${params.buyerName}
Amount Paid: ${formatTkAmount(params.amount)} (${params.method})
Remaining Balance Due: ${formatTkAmount(Math.max(0, params.remainingDue))}`;
};

/**
 * Returns a public tracking URL for major Bangladesh couriers when tracking number is present.
 */
export const getCourierTrackingUrl = (
  courierName?: string,
  trackingNo?: string
): string | null => {
  const code = (trackingNo || '').trim();
  if (!code) return null;
  const name = (courierName || '').toLowerCase();
  const encoded = encodeURIComponent(code);

  if (name.includes('redx')) return `https://redx.com.bd/track-parcel/?trackingId=${encoded}`;
  if (name.includes('steadfast')) return `https://steadfast.com.bd/t/${encoded}`;
  if (name.includes('pathao')) return `https://merchant.pathao.com/tracking?consignment_id=${encoded}`;
  if (name.includes('sundarban')) return `https://tracking.sundarbancourierltd.com/?search=${encoded}`;
  if (name.includes('ecourier')) return `https://ecourier.com.bd/tracking/?tracking_id=${encoded}`;
  if (name.includes('paperfly')) return `https://go.paperfly.com.bd/track?order=${encoded}`;
  if (name.includes('sa paribahan') || name.includes('korotoa')) {
    return `https://www.google.com/search?q=${encodeURIComponent(`${courierName} tracking ${code}`)}`;
  }
  return `https://www.google.com/search?q=${encodeURIComponent(`${courierName || 'courier'} tracking ${code}`)}`;
};

/**
 * Sorts product batches by earliest expiry date ascending (FEFO: First-Expired, First-Out).
 */
export const sortBatchesFEFO = (batches: StockBatch[]): StockBatch[] => {
  return [...batches].sort((a, b) => {
    const ta = a.expiryDate ? new Date(a.expiryDate).getTime() : Number.MAX_SAFE_INTEGER;
    const tb = b.expiryDate ? new Date(b.expiryDate).getTime() : Number.MAX_SAFE_INTEGER;
    return ta - tb;
  });
};

export interface DeductedBatchSlice {
  batchNo: string;
  mfgDate?: string;
  expiryDate: string;
  quantity: number;
}

/**
 * Deducts `qty` from a StockItem following FEFO (earliest-expiring non-empty batch first)
 * and syncs total quantity and active batch/expiry fields on the returned StockItem.
 */
export const deductFromBatchesFEFO = (
  item: StockItem,
  qty: number
): { updatedItem: StockItem; deductedBatches: DeductedBatchSlice[] } => {
  const take = Math.max(0, qty);
  if (!item.batches || item.batches.length === 0) {
    const nextQty = Math.max(0, item.quantity - take);
    const status: StockItem['status'] =
      nextQty === 0 ? 'Out of Stock' : nextQty <= item.reorderThreshold ? 'Low Stock' : 'In Stock';
    return {
      updatedItem: { ...item, quantity: nextQty, status },
      deductedBatches: [
        {
          batchNo: item.batchNo,
          mfgDate: item.mfgDate,
          expiryDate: item.expiryDate,
          quantity: Math.min(item.quantity, take),
        },
      ],
    };
  }

  const ordered = sortBatchesFEFO(item.batches);
  let remainingToDeduct = take;
  const deductedBatches: DeductedBatchSlice[] = [];

  const nextBatches = ordered.map((batch) => {
    if (remainingToDeduct <= 0 || batch.quantity <= 0) return batch;
    const used = Math.min(batch.quantity, remainingToDeduct);
    remainingToDeduct -= used;
    deductedBatches.push({
      batchNo: batch.batchNo,
      mfgDate: batch.mfgDate,
      expiryDate: batch.expiryDate,
      quantity: used,
    });
    return { ...batch, quantity: batch.quantity - used };
  });

  const nonZeroRemaining = nextBatches.filter((b) => b.quantity > 0);
  const activeHead = nonZeroRemaining[0] || nextBatches[0];
  const nextTotal = Math.max(0, nextBatches.reduce((sum, b) => sum + b.quantity, 0));
  const status: StockItem['status'] =
    nextTotal === 0 ? 'Out of Stock' : nextTotal <= item.reorderThreshold ? 'Low Stock' : 'In Stock';

  return {
    updatedItem: {
      ...item,
      quantity: nextTotal,
      batches: nextBatches,
      batchNo: activeHead?.batchNo || item.batchNo,
      mfgDate: activeHead?.mfgDate ?? item.mfgDate,
      expiryDate: activeHead?.expiryDate || item.expiryDate,
      status,
    },
    deductedBatches,
  };
};

/**
 * Ensures `warehouseStocks` covers the item's quantity (defaults unallocated stock to primary warehouse)
 * and moves `qty` cleanly between `fromWarehouse` and `toWarehouse` without changing total quantity.
 */
export const applyWarehouseTransfer = (
  item: StockItem,
  fromWarehouse: string,
  toWarehouse: string,
  qty: number,
  warehouses: string[] = DEFAULT_WAREHOUSES
): { success: boolean; message?: string; updatedItem?: StockItem } => {
  if (!fromWarehouse || !toWarehouse) {
    return { success: false, message: 'Select both source and destination warehouses.' };
  }
  if (fromWarehouse === toWarehouse) {
    return { success: false, message: 'Source and destination warehouses must be different.' };
  }
  if (!qty || qty <= 0) {
    return { success: false, message: 'Transfer quantity must be greater than zero.' };
  }

  const primaryWh = warehouses[0] || 'Main Warehouse';
  const currentMap: Record<string, number> = {
    ...(item.warehouseStocks && Object.keys(item.warehouseStocks).length > 0
      ? item.warehouseStocks
      : { [primaryWh]: item.quantity }),
  };

  const fromAvailable = Number(currentMap[fromWarehouse] || 0);
  if (qty > fromAvailable) {
    return {
      success: false,
      message: `Insufficient stock in "${fromWarehouse}" (${fromAvailable} ${item.unit} available).`,
    };
  }

  currentMap[fromWarehouse] = fromAvailable - qty;
  currentMap[toWarehouse] = Number(currentMap[toWarehouse] || 0) + qty;

  return {
    success: true,
    updatedItem: {
      ...item,
      warehouseStocks: currentMap,
    },
  };
};

export interface SalesRepMetrics {
  rep: SalesRep;
  buyerCount: number;
  invoiceCount: number;
  totalSales: number;
  totalCollected: number;
  totalDue: number;
  earnedCommission: number;
  targetAchievementPct: number;
}

/**
 * Calculates Sales Representative (SR/DSR) sales, collection, and commission performance.
 */
export const computeSalesRepMetrics = (
  reps: SalesRep[],
  wholesalers: Wholesaler[],
  invoices: Invoice[],
  startDateYYYYMMDD?: string,
  endDateYYYYMMDD?: string
): SalesRepMetrics[] => {
  return reps.map((rep) => {
    const assignedBuyers = wholesalers.filter((w) => w.salesRepId === rep.id);
    const buyerIds = new Set(assignedBuyers.map((b) => b.id));

    const repInvoices = invoices.filter((inv) => {
      const matchesRep =
        inv.salesRepId === rep.id ||
        (!inv.salesRepId && buyerIds.has(inv.wholesalerId));
      if (!matchesRep) return false;
      const d = (inv.deliveryDate || inv.date || '').slice(0, 10);
      if (startDateYYYYMMDD && d < startDateYYYYMMDD) return false;
      if (endDateYYYYMMDD && d > endDateYYYYMMDD) return false;
      return true;
    });

    const totalSales = repInvoices.reduce(
      (sum, inv) => sum + (inv.subTotal ?? inv.items.reduce((s, it) => s + it.total, 0)),
      0
    );
    const totalCollected = repInvoices.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0);
    const totalDue = assignedBuyers.reduce((sum, b) => sum + (b.totalDue || 0), 0);
    const earnedCommission = Math.round((totalSales * (rep.commissionRate || 0)) / 100);
    const targetAchievementPct =
      rep.monthlyTarget > 0 ? Math.min(999, Math.round((totalSales / rep.monthlyTarget) * 100)) : 0;

    return {
      rep,
      buyerCount: assignedBuyers.length,
      invoiceCount: repInvoices.length,
      totalSales,
      totalCollected,
      totalDue,
      earnedCommission,
      targetAchievementPct,
    };
  });
};

// Standard Code 39 character table (9 elements alternating bar/space: 'n' = 1, 'w' = 3)
const CODE39_TABLE: Record<string, string> = {
  '0': 'nnnwwnwnn', '1': 'wnnwnnnnw', '2': 'nnwwnnnnw', '3': 'wnwwnnnnn',
  '4': 'nnnwwnnnw', '5': 'wnnwwnnnn', '6': 'nnwwwnnnn', '7': 'nnnwnnwnw',
  '8': 'wnnwnnwnn', '9': 'nnwwnnwnn', 'A': 'wnnnnwnnw', 'B': 'nnwnnwnnw',
  'C': 'wnwnnwnnn', 'D': 'nnnnwwnnw', 'E': 'wnnnwwnnn', 'F': 'nnwnwwnnn',
  'G': 'nnnnnwwnw', 'H': 'wnnnnwwnn', 'I': 'nnwnnwwnn', 'J': 'nnnnwwwnn',
  'K': 'wnnnnnnww', 'L': 'nnwnnnnww', 'M': 'wnwnnnnwn', 'N': 'nnnnwnnww',
  'O': 'wnnnwnnwn', 'P': 'nnwnwnnwn', 'Q': 'nnnnnnwww', 'R': 'wnnnnnwwn',
  'S': 'nnwnnnwwn', 'T': 'nnnnwnwwn', 'U': 'wwnnnnnnw', 'V': 'nwwnnnnnw',
  'W': 'wwwnnnnnn', 'X': 'nwnnwnnnw', 'Y': 'wwnnwnnnn', 'Z': 'nwwnwnnnn',
  '-': 'nwnnnnwnw', '.': 'wwnnnnwnn', ' ': 'nwwnnnwnn', '$': 'nwnwnwnnn',
  '/': 'nwnwnnnwn', '+': 'nwnnnwnwn', '%': 'nnnwnwnwn', '*': 'nwnnwnwnn',
};

export interface BarcodeRect {
  x: number;
  width: number;
}

/**
 * Generates deterministic Code 39 SVG bar rectangles (`x`, `width`) + `totalWidth`.
 * Any invalid characters are sanitized to '-' so SKU strings always encode safely.
 */
export const encodeCode39Bars = (
  rawText: string
): { bars: BarcodeRect[]; totalWidth: number; encodedText: string } => {
  const clean = (rawText || 'SKU-000')
    .toUpperCase()
    .split('')
    .map((ch) => (CODE39_TABLE[ch] && ch !== '*' ? ch : '-'))
    .join('');

  const full = `*${clean}*`;
  const bars: BarcodeRect[] = [];
  let cursor = 0;

  for (let i = 0; i < full.length; i++) {
    const pattern = CODE39_TABLE[full[i]] || CODE39_TABLE['-'];
    for (let j = 0; j < pattern.length; j++) {
      const w = pattern[j] === 'w' ? 3 : 1;
      if (j % 2 === 0) {
        bars.push({ x: cursor, width: w });
      }
      cursor += w;
    }
    // Inter-character narrow gap
    cursor += 1;
  }

  return { bars, totalWidth: Math.max(1, cursor), encodedText: clean };
};
