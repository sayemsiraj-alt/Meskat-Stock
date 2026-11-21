import {
  CourierStatus,
  Invoice,
  InvoiceItem,
  PurchaseBill,
  PurchaseReturn,
  StockItem,
  Supplier,
  SupplierPayment,
  Wholesaler,
} from '../data/mockData';

/**
 * Total stock units leaving inventory for an invoice item (billed quantity + bonus/free units).
 */
export const getInvoiceItemTotalQty = (
  item: Pick<InvoiceItem, 'quantity' | 'bonusQty'>
): number => {
  const paid = Math.max(0, Number(item.quantity) || 0);
  const bonus = Math.max(0, Number(item.bonusQty) || 0);
  return paid + bonus;
};

export interface ProductProfitRow {
  itemId: string;
  itemName: string;
  sku: string;
  category: string;
  unit: string;
  currentStock: number;
  costPrice: number;
  sellingPrice: number;
  soldPaidUnits: number;
  bonusFreeUnits: number;
  totalUnitsOut: number;
  grossRevenue: number;
  cogs: number;
  grossProfit: number;
  marginPct: number;
  lastSoldDate: string | null;
  daysSinceLastSold: number | null;
  isDeadStock: boolean;
  lockedCapitalValue: number;
}

export interface ProfitDeadStockReport {
  rows: ProductProfitRow[];
  deadStockRows: ProductProfitRow[];
  totalRevenue: number;
  totalCogs: number;
  totalGrossProfit: number;
  overallMarginPct: number;
  totalUnitsOut: number;
  totalBonusUnits: number;
  deadStockCount: number;
  deadStockCapitalValue: number;
}

/**
 * Computes product-wise gross revenue, COGS (including bonus/free units given), net/gross profit,
 * profit margin %, and slow/dead-stock threshold analysis.
 */
export const computeProductProfitAndDeadStock = (params: {
  items: StockItem[];
  invoices: Invoice[];
  referenceDateYYYYMMDD?: string;
  deadStockThresholdDays?: number;
  startDateYYYYMMDD?: string;
  endDateYYYYMMDD?: string;
}): ProfitDeadStockReport => {
  const {
    items,
    invoices,
    referenceDateYYYYMMDD,
    deadStockThresholdDays = 30,
    startDateYYYYMMDD,
    endDateYYYYMMDD,
  } = params;

  const refDateStr = referenceDateYYYYMMDD || new Date().toISOString().split('T')[0];
  const refMs = new Date(refDateStr).getTime();
  const msPerDay = 1000 * 60 * 60 * 24;

  const statsMap = new Map<
    string,
    {
      itemId: string;
      itemName: string;
      sku: string;
      category: string;
      unit: string;
      currentStock: number;
      costPrice: number;
      sellingPrice: number;
      soldPaidUnits: number;
      bonusFreeUnits: number;
      grossRevenue: number;
      cogs: number;
      lastSoldDate: string | null;
    }
  >();

  items.forEach((it) => {
    statsMap.set(it.id, {
      itemId: it.id,
      itemName: it.name,
      sku: it.sku,
      category: it.category || 'Uncategorized',
      unit: it.unit || 'pcs',
      currentStock: Number(it.quantity || 0),
      costPrice: Number(it.costPrice || 0),
      sellingPrice: Number(it.price || 0),
      soldPaidUnits: 0,
      bonusFreeUnits: 0,
      grossRevenue: 0,
      cogs: 0,
      lastSoldDate: null,
    });
  });

  // Track lastSoldDate across ALL invoices for accurate dead-stock aging even when date filter is set
  const allLastSoldMap = new Map<string, string>();
  invoices.forEach((inv) => {
    const d = (inv.deliveryDate || inv.date || '').slice(0, 10);
    if (!d) return;
    inv.items.forEach((line) => {
      const prev = allLastSoldMap.get(line.itemId);
      if (!prev || d > prev) {
        allLastSoldMap.set(line.itemId, d);
      }
    });
  });

  invoices.forEach((inv) => {
    const d = (inv.deliveryDate || inv.date || '').slice(0, 10);
    if (startDateYYYYMMDD && d && d < startDateYYYYMMDD) return;
    if (endDateYYYYMMDD && d && d > endDateYYYYMMDD) return;

    inv.items.forEach((line) => {
      const existing = statsMap.get(line.itemId);
      const stockItem = items.find((i) => i.id === line.itemId);
      const unitCost = Number(stockItem?.costPrice ?? existing?.costPrice ?? 0);
      const paidQty = Math.max(0, Number(line.quantity || 0));
      const bonusQty = Math.max(0, Number(line.bonusQty || 0));
      const totalOut = paidQty + bonusQty;
      const lineRev = Number(line.total ?? paidQty * Number(line.unitPrice || 0));
      const lineCogs = totalOut * unitCost;

      if (existing) {
        existing.soldPaidUnits += paidQty;
        existing.bonusFreeUnits += bonusQty;
        existing.grossRevenue += lineRev;
        existing.cogs += lineCogs;
        if (d && (!existing.lastSoldDate || d > existing.lastSoldDate)) {
          existing.lastSoldDate = d;
        }
      } else {
        statsMap.set(line.itemId, {
          itemId: line.itemId,
          itemName: line.itemName,
          sku: '-',
          category: 'Archived / Custom',
          unit: 'pcs',
          currentStock: 0,
          costPrice: unitCost,
          sellingPrice: Number(line.unitPrice || 0),
          soldPaidUnits: paidQty,
          bonusFreeUnits: bonusQty,
          grossRevenue: lineRev,
          cogs: lineCogs,
          lastSoldDate: d || null,
        });
      }
    });
  });

  const rows: ProductProfitRow[] = Array.from(statsMap.values())
    .map((entry) => {
      const overallLastSold = allLastSoldMap.get(entry.itemId) || entry.lastSoldDate;
      let daysSinceLastSold: number | null = null;
      if (overallLastSold) {
        const soldMs = new Date(overallLastSold).getTime();
        if (!Number.isNaN(soldMs) && !Number.isNaN(refMs)) {
          daysSinceLastSold = Math.max(0, Math.floor((refMs - soldMs) / msPerDay));
        }
      }
      const totalUnitsOut = entry.soldPaidUnits + entry.bonusFreeUnits;
      const grossProfit = entry.grossRevenue - entry.cogs;
      const marginPct =
        entry.grossRevenue > 0
          ? Number(((grossProfit / entry.grossRevenue) * 100).toFixed(1))
          : 0;
      const lockedCapitalValue = entry.currentStock * entry.costPrice;
      const isDeadStock =
        entry.currentStock > 0 &&
        (daysSinceLastSold === null || daysSinceLastSold >= deadStockThresholdDays);

      return {
        ...entry,
        totalUnitsOut,
        grossProfit,
        marginPct,
        lastSoldDate: overallLastSold,
        daysSinceLastSold,
        isDeadStock,
        lockedCapitalValue,
      };
    })
    .sort((a, b) => b.grossProfit - a.grossProfit || b.lockedCapitalValue - a.lockedCapitalValue);

  const deadStockRows = rows
    .filter((r) => r.isDeadStock)
    .sort((a, b) => b.lockedCapitalValue - a.lockedCapitalValue);

  const totalRevenue = rows.reduce((s, r) => s + r.grossRevenue, 0);
  const totalCogs = rows.reduce((s, r) => s + r.cogs, 0);
  const totalGrossProfit = totalRevenue - totalCogs;
  const overallMarginPct =
    totalRevenue > 0 ? Number(((totalGrossProfit / totalRevenue) * 100).toFixed(1)) : 0;

  return {
    rows,
    deadStockRows,
    totalRevenue,
    totalCogs,
    totalGrossProfit,
    overallMarginPct,
    totalUnitsOut: rows.reduce((s, r) => s + r.totalUnitsOut, 0),
    totalBonusUnits: rows.reduce((s, r) => s + r.bonusFreeUnits, 0),
    deadStockCount: deadStockRows.length,
    deadStockCapitalValue: deadStockRows.reduce((s, r) => s + r.lockedCapitalValue, 0),
  };
};

export interface SupplierLedgerEntry {
  id: string;
  date: string;
  reference: string;
  type: 'PURCHASE_BILL' | 'BILL_PAID' | 'PAYMENT' | 'PURCHASE_RETURN';
  description: string;
  debit: number; // Reduces payable due (Payment / Return)
  credit: number; // Increases payable due (Purchase Bill)
  runningBalance: number;
}

export interface SupplierStatementSummary {
  entries: SupplierLedgerEntry[];
  totalBilled: number;
  totalPaidAndReturned: number;
  closingBalance: number;
}

export const buildSupplierStatementLedger = (params: {
  supplier: Supplier;
  purchaseBills: PurchaseBill[];
  purchaseReturns: PurchaseReturn[];
  supplierPayments: SupplierPayment[];
}): SupplierStatementSummary => {
  const { supplier, purchaseBills, purchaseReturns, supplierPayments } = params;
  const supNameNorm = supplier.name.trim().toLowerCase();

  const matchesSupplier = (sId?: string, sName?: string) => {
    if (sId && sId === supplier.id) return true;
    return (sName || '').trim().toLowerCase() === supNameNorm;
  };

  type RawEvent = {
    id: string;
    date: string;
    orderWeight: number;
    reference: string;
    type: SupplierLedgerEntry['type'];
    description: string;
    debit: number;
    credit: number;
  };

  const events: RawEvent[] = [];

  purchaseBills
    .filter((b) => matchesSupplier(b.supplierId, b.supplierName))
    .forEach((b) => {
      events.push({
        id: `${b.id}-bill`,
        date: b.date,
        orderWeight: 1,
        reference: b.billNo,
        type: 'PURCHASE_BILL',
        description: `Purchase Bill (${b.items.length} item${b.items.length === 1 ? '' : 's'})`,
        debit: 0,
        credit: b.totalAmount,
      });
      if ((b.paidAmount || 0) > 0) {
        events.push({
          id: `${b.id}-paid`,
          date: b.date,
          orderWeight: 2,
          reference: b.billNo,
          type: 'BILL_PAID',
          description: `Paid on Bill (${b.paymentMethod || 'Cash'})`,
          debit: b.paidAmount,
          credit: 0,
        });
      }
    });

  supplierPayments
    .filter((p) => matchesSupplier(p.supplierId, p.supplierName))
    .forEach((p) => {
      events.push({
        id: p.id,
        date: p.date,
        orderWeight: 3,
        reference: p.receiptNo || p.reference || p.id,
        type: 'PAYMENT',
        description: `Due Payment (${p.paymentMethod})${p.notes ? ` — ${p.notes}` : ''}`,
        debit: p.amount,
        credit: 0,
      });
    });

  purchaseReturns
    .filter((r) => matchesSupplier(r.supplierId, r.supplierName))
    .forEach((r) => {
      events.push({
        id: r.id,
        date: r.date,
        orderWeight: 4,
        reference: r.returnNo,
        type: 'PURCHASE_RETURN',
        description: `Purchase Return (${r.reason})`,
        debit: r.totalAmount,
        credit: 0,
      });
    });

  events.sort(
    (a, b) => a.date.localeCompare(b.date) || a.orderWeight - b.orderWeight
  );

  let running = 0;
  let totalBilled = 0;
  let totalPaidAndReturned = 0;

  const entries: SupplierLedgerEntry[] = events.map((ev) => {
    totalBilled += ev.credit;
    totalPaidAndReturned += ev.debit;
    running = Math.max(0, running + ev.credit - ev.debit);
    return {
      id: ev.id,
      date: ev.date,
      reference: ev.reference,
      type: ev.type,
      description: ev.description,
      debit: ev.debit,
      credit: ev.credit,
      runningBalance: running,
    };
  });

  const closingBalance =
    typeof supplier.totalDue === 'number' ? Math.max(0, supplier.totalDue) : running;

  return {
    entries,
    totalBilled,
    totalPaidAndReturned,
    closingBalance,
  };
};

const csvEscape = (value: unknown): string => {
  const str = String(value ?? '');
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

export type CourierCsvFormat = 'steadfast' | 'redx' | 'generic';

/**
 * Builds RFC-4180 compliant bulk courier booking CSV tailored for Steadfast, RedX, or Generic couriers.
 */
export const buildBulkCourierBookingCsv = (
  invoices: Invoice[],
  wholesalers: Wholesaler[],
  format: CourierCsvFormat = 'generic'
): string => {
  const wholesalerMap = new Map(wholesalers.map((w) => [w.id, w]));

  if (format === 'steadfast') {
    const headers = [
      'Invoice',
      'Name',
      'Address',
      'Phone',
      'Amount',
      'Note',
    ];
    const rows = invoices.map((inv) => {
      const buyer = wholesalerMap.get(inv.wholesalerId);
      const phone = inv.customerPhone || buyer?.phone || '';
      const addr = inv.customerAddress || buyer?.address || '';
      const noteParts = [
        inv.totalCartons ? `Cartons: ${inv.totalCartons}` : '',
        inv.notes || '',
      ].filter(Boolean);
      return [
        inv.chalanNo,
        inv.wholesalerName,
        addr,
        phone,
        Math.max(0, Math.round(inv.dueAmount || 0)),
        noteParts.join(' | '),
      ]
        .map(csvEscape)
        .join(',');
    });
    return [headers.join(','), ...rows].join('\n');
  }

  if (format === 'redx') {
    const headers = [
      'Customer Name',
      'Customer Phone',
      'Customer Address',
      'Merchant Invoice ID',
      'Cash Collection Amount',
      'Parcel Weight (kg)',
      'Instruction',
    ];
    const rows = invoices.map((inv) => {
      const buyer = wholesalerMap.get(inv.wholesalerId);
      const phone = inv.customerPhone || buyer?.phone || '';
      const addr = inv.customerAddress || buyer?.address || '';
      return [
        inv.wholesalerName,
        phone,
        addr,
        inv.chalanNo,
        Math.max(0, Math.round(inv.dueAmount || 0)),
        1,
        inv.totalCartons ? `${inv.totalCartons} Carton(s)` : 'Wholesale Goods',
      ]
        .map(csvEscape)
        .join(',');
    });
    return [headers.join(','), ...rows].join('\n');
  }

  const headers = [
    'Invoice No',
    'Date',
    'Recipient Name',
    'Phone',
    'Address',
    'Courier Service',
    'Courier Status',
    'Tracking No',
    'Cartons',
    'COD / Due Amount',
    'Note',
  ];
  const rows = invoices.map((inv) => {
    const buyer = wholesalerMap.get(inv.wholesalerId);
    const phone = inv.customerPhone || buyer?.phone || '';
    const addr = inv.customerAddress || buyer?.address || '';
    return [
      inv.chalanNo,
      inv.deliveryDate || inv.date,
      inv.wholesalerName,
      phone,
      addr,
      inv.courierName || '',
      inv.courierStatus || 'Pending Booking',
      inv.courierTrackingNo || '',
      inv.totalCartons || '',
      Math.max(0, Math.round(inv.dueAmount || 0)),
      inv.notes || '',
    ]
      .map(csvEscape)
      .join(',');
  });
  return [headers.join(','), ...rows].join('\n');
};

export const COURIER_STATUS_OPTIONS: CourierStatus[] = [
  'Pending Booking',
  'Booked',
  'In Transit',
  'Out for Delivery',
  'Delivered',
  'Returned',
  'Cancelled',
];

export interface ValidatedBackupPayload {
  valid: boolean;
  error?: string;
  data?: Record<string, any>;
}

/**
 * Validates and normalizes JSON backup payloads prior to restoring ERP state.
 */
export const validateBackupPayload = (raw: unknown): ValidatedBackupPayload => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { valid: false, error: 'Backup file must be a JSON object.' };
  }
  const obj = raw as Record<string, any>;
  const hasCoreCollection =
    Array.isArray(obj.items) ||
    Array.isArray(obj.invoices) ||
    Array.isArray(obj.wholesalers) ||
    Array.isArray(obj.transactions);

  if (!hasCoreCollection) {
    return {
      valid: false,
      error: 'Invalid backup structure: missing core inventory or invoice arrays.',
    };
  }

  const arrayKeys = [
    'items',
    'transactions',
    'suppliers',
    'categories',
    'wholesalers',
    'invoices',
    'accountTxns',
    'expenses',
    'purchaseOrders',
    'purchaseBills',
    'purchaseReturns',
    'supplierPayments',
    'damagedStock',
    'customerOrders',
    'customerReturns',
    'paymentClaims',
    'salesReps',
    'stockTransfers',
    'auditLogs',
    'users',
  ];

  const normalized: Record<string, any> = { ...obj };
  for (const k of arrayKeys) {
    if (normalized[k] !== undefined && !Array.isArray(normalized[k])) {
      return {
        valid: false,
        error: `Backup field "${k}" is corrupted (expected an array).`,
      };
    }
  }

  return { valid: true, data: normalized };
};
