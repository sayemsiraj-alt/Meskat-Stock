import {
  AccountTxn,
  CustomerReturn,
  Invoice,
  InvoiceItem,
  StockItem,
  Wholesaler,
} from '../data/mockData';

export interface StatementEntry {
  id: string;
  date: string;
  type: 'INVOICE' | 'PAYMENT' | 'ADVANCE' | 'RETURN_CREDIT';
  reference: string;
  description: string;
  debit: number;
  credit: number;
  runningBalance: number;
}

/**
 * Resolves the buyer-specific approved flat rate for a stock item.
 * Falls back to the product's standard wholesale flat rate (`item.price`).
 */
export const getApprovedUnitPrice = (
  item: StockItem,
  buyer?: Wholesaler | null
): { unitPrice: number; isCustomApproved: boolean } => {
  const custom = buyer?.approvedPrices?.[item.id];
  if (typeof custom === 'number' && !Number.isNaN(custom) && custom >= 0) {
    return { unitPrice: custom, isCustomApproved: true };
  }
  return { unitPrice: item.price, isCustomApproved: false };
};

/**
 * Builds a repeat-order cart from an existing invoice or past order,
 * refreshing unit prices to current approved buyer rates and clamping quantities
 * to live available stock if needed.
 */
export const buildRepeatOrderItems = (
  sourceItems: InvoiceItem[],
  stockItems: StockItem[],
  buyer?: Wholesaler | null
): { items: InvoiceItem[]; skippedNames: string[]; adjustedNames: string[] } => {
  const result: InvoiceItem[] = [];
  const skippedNames: string[] = [];
  const adjustedNames: string[] = [];

  for (const src of sourceItems) {
    const liveItem = stockItems.find((s) => s.id === src.itemId);
    if (!liveItem || liveItem.quantity <= 0) {
      skippedNames.push(src.itemName);
      continue;
    }

    const { unitPrice } = getApprovedUnitPrice(liveItem, buyer);
    const finalQty = Math.min(src.quantity, liveItem.quantity);
    if (finalQty < src.quantity) {
      adjustedNames.push(`${src.itemName} (${finalQty}/${src.quantity})`);
    }

    result.push({
      itemId: liveItem.id,
      itemName: liveItem.name,
      packSize: liveItem.packSize || liveItem.unit || src.packSize,
      batchNo: liveItem.batchNo || src.batchNo,
      mfgDate: liveItem.mfgDate || src.mfgDate,
      expiryDate: liveItem.expiryDate || src.expiryDate,
      retailPrice: liveItem.retailPrice || src.retailPrice || unitPrice,
      unitPrice,
      quantity: finalQty,
      total: finalQty * unitPrice,
    });
  }

  return { items: result, skippedNames, adjustedNames };
};

/**
 * Filters invoices belonging strictly to a specific wholesale buyer.
 */
export const getBuyerInvoices = (
  invoices: Invoice[],
  buyerId: string
): Invoice[] => {
  if (!buyerId) return [];
  return invoices.filter((inv) => inv.wholesalerId === buyerId);
};

/**
 * Filters payment / due-collection account transactions belonging strictly to a buyer,
 * matching either direct `wholesalerId` or a reference matching one of their invoice chalanNos.
 */
export const getBuyerPaymentTxns = (
  accountTxns: AccountTxn[],
  buyerInvoices: Invoice[],
  buyerId: string,
  buyerName?: string
): AccountTxn[] => {
  if (!buyerId) return [];
  const chalanSet = new Set(buyerInvoices.map((i) => i.chalanNo));
  return accountTxns.filter((t) => {
    if (t.type !== 'IN') return false;
    if (t.wholesalerId) return t.wholesalerId === buyerId;
    if (t.reference && chalanSet.has(t.reference)) return true;
    if (buyerName && t.description?.toLowerCase().includes(`from ${buyerName.toLowerCase()}`)) {
      return true;
    }
    return false;
  });
};

/**
 * Generates a chronological Debit/Credit running-balance Account Statement for a wholesale buyer.
 * - Invoices increase Debit (`subTotal` of goods billed on that invoice).
 * - Payments / Advances (`AccountTxn` IN) and Credited Returns increase Credit.
 * - `openingBalance` covers any pre-existing due carried onto the buyer profile before tracked transactions.
 */
export const buildBuyerAccountStatement = (params: {
  buyer: Wholesaler;
  invoices: Invoice[];
  accountTxns: AccountTxn[];
  returns: CustomerReturn[];
}): {
  entries: StatementEntry[];
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
} => {
  const { buyer, invoices, accountTxns, returns } = params;
  const buyerInvoices = getBuyerInvoices(invoices, buyer.id);
  const buyerPayments = getBuyerPaymentTxns(accountTxns, buyerInvoices, buyer.id, buyer.name);
  const buyerCredits = returns.filter(
    (r) => r.wholesalerId === buyer.id && (r.status === 'Approved' || r.status === 'Credited')
  );

  const rawEvents: Array<Omit<StatementEntry, 'runningBalance'>> = [];

  for (const inv of buyerInvoices) {
    const bill = inv.subTotal ?? inv.items.reduce((sum, it) => sum + it.total, 0);
    rawEvents.push({
      id: `ST-INV-${inv.id}`,
      date: inv.deliveryDate || inv.date,
      type: 'INVOICE',
      reference: inv.chalanNo,
      description: `Wholesale Invoice #${inv.chalanNo} (${inv.items.length} items${inv.courierName ? `, ${inv.courierName}` : ''})`,
      debit: bill,
      credit: 0,
    });
  }

  for (const txn of buyerPayments) {
    const isAdvance = txn.description?.toLowerCase().includes('advance');
    rawEvents.push({
      id: `ST-PAY-${txn.id}`,
      date: txn.date,
      type: isAdvance ? 'ADVANCE' : 'PAYMENT',
      reference: txn.receiptNo || txn.reference || txn.id,
      description: txn.description || 'Payment received',
      debit: 0,
      credit: txn.amount,
    });
  }

  for (const ret of buyerCredits) {
    rawEvents.push({
      id: `ST-RET-${ret.id}`,
      date: ret.resolvedAt || ret.createdAt,
      type: 'RETURN_CREDIT',
      reference: ret.returnNo,
      description: `Return Credit (${ret.reason})${ret.chalanNo ? ` - Ref Invoice #${ret.chalanNo}` : ''}`,
      debit: 0,
      credit: ret.totalCreditAmount,
    });
  }

  // Sort chronologically ascending
  rawEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Compute implied opening balance if wholesaler had an initial due before tracked invoices/payments
  const trackedNet = rawEvents.reduce((acc, ev) => acc + ev.debit - ev.credit, 0);
  const impliedOpening = Math.max(0, Math.round((buyer.totalDue || 0) - trackedNet));

  const entries: StatementEntry[] = [];
  let running = 0;

  if (impliedOpening > 0) {
    running += impliedOpening;
    entries.push({
      id: 'ST-OPENING',
      date: rawEvents[0]?.date || new Date().toISOString(),
      type: 'INVOICE',
      reference: 'OPENING',
      description: 'Opening Previous Balance Brought Forward',
      debit: impliedOpening,
      credit: 0,
      runningBalance: running,
    });
  }

  for (const ev of rawEvents) {
    running = running + ev.debit - ev.credit;
    entries.push({
      ...ev,
      runningBalance: running,
    });
  }

  const totalDebit = entries.reduce((s, e) => s + e.debit, 0);
  const totalCredit = entries.reduce((s, e) => s + e.credit, 0);

  return {
    entries,
    totalDebit,
    totalCredit,
    closingBalance: running,
  };
};
