import { Expense, Invoice, StockItem } from '../data/mockData';
import { getLocalYYYYMMDD } from './dateUtils';

export type ExpiryUrgency = 'expired' | 'critical' | 'warning';

export interface ExpiringProductPriority {
  item: StockItem;
  expiryDateYMD: string;
  daysRemaining: number;
  urgency: ExpiryUrgency;
  stockValue: number;
  costValue: number;
}

export interface MonthlySalesExpensePoint {
  monthKey: string;
  monthLabel: string;
  Sales: number;
  Expenses: number;
  Net: number;
  invoiceCount: number;
  expenseCount: number;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Parses a YYYY-MM-DD (or ISO timestamp starting with YYYY-MM-DD) into UTC midnight ms.
 * Returns null if the string cannot be resolved to a valid calendar date.
 */
export function parseYYYYMMDDToUtcMs(dateInput?: string | null): number | null {
  if (!dateInput) return null;
  const trimmed = String(dateInput).trim();
  const ymdMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  let year: number;
  let month: number;
  let day: number;

  if (ymdMatch) {
    year = Number(ymdMatch[1]);
    month = Number(ymdMatch[2]);
    day = Number(ymdMatch[3]);
  } else {
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) return null;
    year = parsed.getFullYear();
    month = parsed.getMonth() + 1;
    day = parsed.getDate();
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const utcMs = Date.UTC(year, month - 1, day);
  const verify = new Date(utcMs);
  if (
    verify.getUTCFullYear() !== year ||
    verify.getUTCMonth() !== month - 1 ||
    verify.getUTCDate() !== day
  ) {
    return null;
  }
  return utcMs;
}

export function formatUtcMsToYYYYMMDD(utcMs: number): string {
  const d = new Date(utcMs);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function extractMonthKey(dateInput?: string | null): string | null {
  const utcMs = parseYYYYMMDDToUtcMs(dateInput);
  if (utcMs === null) return null;
  const d = new Date(utcMs);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/**
 * Finds all stocked products whose `expiryDate` is within `maxDays` days of `referenceDate`
 * (including already expired items when `includeExpired` is true).
 * Sorted soonest/most expired first, then highest stock value first.
 */
export function getProductsExpiringWithinDays(
  items: StockItem[],
  referenceDate: string = getLocalYYYYMMDD(),
  maxDays = 30,
  includeExpired = true
): ExpiringProductPriority[] {
  const refMs = parseYYYYMMDDToUtcMs(referenceDate) ?? parseYYYYMMDDToUtcMs(getLocalYYYYMMDD())!;
  const MS_PER_DAY = 86_400_000;

  const results: ExpiringProductPriority[] = [];

  for (const item of items) {
    if (!item || item.quantity <= 0 || !item.expiryDate) continue;
    const expMs = parseYYYYMMDDToUtcMs(item.expiryDate);
    if (expMs === null) continue;

    const daysRemaining = Math.round((expMs - refMs) / MS_PER_DAY);
    if (daysRemaining > maxDays) continue;
    if (!includeExpired && daysRemaining < 0) continue;

    let urgency: ExpiryUrgency;
    if (daysRemaining < 0) {
      urgency = 'expired';
    } else if (daysRemaining <= 7) {
      urgency = 'critical';
    } else {
      urgency = 'warning';
    }

    const qty = Number(item.quantity) || 0;
    const price = Number(item.price) || 0;
    const costPrice = Number(item.costPrice) || 0;

    results.push({
      item,
      expiryDateYMD: formatUtcMsToYYYYMMDD(expMs),
      daysRemaining,
      urgency,
      stockValue: qty * price,
      costValue: qty * costPrice,
    });
  }

  return results.sort((a, b) => {
    if (a.daysRemaining !== b.daysRemaining) {
      return a.daysRemaining - b.daysRemaining;
    }
    return b.stockValue - a.stockValue;
  });
}

/**
 * Builds an ordered 12-month series (ending in the month of `referenceDate`)
 * comparing total invoice Sales vs total Expense amounts per month.
 */
export function buildLast12MonthsSalesVsExpenses(
  invoices: Invoice[],
  expenses: Expense[],
  referenceDate: string = getLocalYYYYMMDD()
): MonthlySalesExpensePoint[] {
  const refMs = parseYYYYMMDDToUtcMs(referenceDate) ?? parseYYYYMMDDToUtcMs(getLocalYYYYMMDD())!;
  const refDateObj = new Date(refMs);
  const anchorYear = refDateObj.getUTCFullYear();
  const anchorMonthIndex = refDateObj.getUTCMonth(); // 0-11

  const series: MonthlySalesExpensePoint[] = [];
  const monthLookup = new Map<string, MonthlySalesExpensePoint>();

  for (let offset = 11; offset >= 0; offset--) {
    const d = new Date(Date.UTC(anchorYear, anchorMonthIndex - offset, 1));
    const y = d.getUTCFullYear();
    const mIdx = d.getUTCMonth();
    const monthKey = `${y}-${String(mIdx + 1).padStart(2, '0')}`;
    const monthLabel = `${MONTH_NAMES[mIdx]} ${String(y).slice(-2)}`;

    const point: MonthlySalesExpensePoint = {
      monthKey,
      monthLabel,
      Sales: 0,
      Expenses: 0,
      Net: 0,
      invoiceCount: 0,
      expenseCount: 0,
    };

    series.push(point);
    monthLookup.set(monthKey, point);
  }

  for (const inv of invoices) {
    if (!inv) continue;
    const key = extractMonthKey(inv.date);
    if (!key) continue;
    const bucket = monthLookup.get(key);
    if (!bucket) continue;
    bucket.Sales += Number(inv.totalAmount) || 0;
    bucket.invoiceCount += 1;
  }

  for (const exp of expenses) {
    if (!exp) continue;
    const key = extractMonthKey(exp.date);
    if (!key) continue;
    const bucket = monthLookup.get(key);
    if (!bucket) continue;
    bucket.Expenses += Number(exp.amount) || 0;
    bucket.expenseCount += 1;
  }

  for (const point of series) {
    point.Net = point.Sales - point.Expenses;
  }

  return series;
}

export interface CategoryNetProfitPoint {
  category: string;
  revenue: number;
  cogs: number;
  grossProfit: number;
  allocatedExpense: number;
  netProfit: number;
  unitsSold: number;
  marginPct: number;
}

/**
 * Computes net profit per product category for the calendar month of `referenceDate`.
 * - Resolves each sold invoice line item to its product's category & costPrice (80% of unitPrice fallback).
 * - Respects invoice-level discounts proportionally while excluding carried-over previousDue.
 * - Allocates current-month operating expenses proportionally by category revenue share so category
 *   net profits reconcile with total monthly net profit.
 */
export function buildCurrentMonthCategoryNetProfit(
  items: StockItem[],
  invoices: Invoice[],
  expenses: Expense[],
  referenceDate: string = getLocalYYYYMMDD()
): CategoryNetProfitPoint[] {
  const refMonthKey = extractMonthKey(referenceDate) || getLocalYYYYMMDD().slice(0, 7);

  const itemById = new Map<string, StockItem>();
  const itemByName = new Map<string, StockItem>();
  for (const item of items) {
    if (!item) continue;
    if (item.id) itemById.set(item.id, item);
    if (item.name) itemByName.set(item.name.trim().toLowerCase(), item);
  }

  const categoryAgg = new Map<
    string,
    { revenue: number; cogs: number; unitsSold: number }
  >();

  for (const inv of invoices) {
    if (!inv) continue;
    if (extractMonthKey(inv.date) !== refMonthKey) continue;
    if (!Array.isArray(inv.items) || inv.items.length === 0) continue;

    const rawLineSum = inv.items.reduce(
      (sum, li) => sum + (Number(li.total) || (Number(li.unitPrice) || 0) * (Number(li.quantity) || 0)),
      0
    );
    const invDiscount = Math.max(0, Number(inv.discount) || 0);
    const discountFactor =
      rawLineSum > 0 && invDiscount > 0
        ? Math.max(0, (rawLineSum - invDiscount) / rawLineSum)
        : 1;

    for (const line of inv.items) {
      const qty = Number(line.quantity) || 0;
      if (qty <= 0) continue;

      const matched =
        (line.itemId && itemById.get(line.itemId)) ||
        (line.itemName && itemByName.get(line.itemName.trim().toLowerCase())) ||
        undefined;

      const category = (matched?.category || 'General').trim() || 'General';
      const rawLineTotal =
        Number(line.total) || (Number(line.unitPrice) || 0) * qty;
      const netRevenue = rawLineTotal * discountFactor;
      const unitCost =
        matched && Number.isFinite(matched.costPrice)
          ? Number(matched.costPrice)
          : (Number(line.unitPrice) || 0) * 0.8;
      const lineCogs = qty * unitCost;

      const existing = categoryAgg.get(category) || {
        revenue: 0,
        cogs: 0,
        unitsSold: 0,
      };
      existing.revenue += netRevenue;
      existing.cogs += lineCogs;
      existing.unitsSold += qty;
      categoryAgg.set(category, existing);
    }
  }

  if (categoryAgg.size === 0) {
    return [];
  }

  let totalMonthRevenue = 0;
  for (const entry of categoryAgg.values()) {
    totalMonthRevenue += entry.revenue;
  }

  const totalMonthExpenses = expenses.reduce((sum, exp) => {
    if (!exp || extractMonthKey(exp.date) !== refMonthKey) return sum;
    return sum + (Number(exp.amount) || 0);
  }, 0);

  const categoryCount = categoryAgg.size;
  const rows: CategoryNetProfitPoint[] = [];

  for (const [category, agg] of categoryAgg.entries()) {
    const grossProfit = agg.revenue - agg.cogs;
    const allocatedExpense =
      totalMonthRevenue > 0
        ? totalMonthExpenses * (agg.revenue / totalMonthRevenue)
        : totalMonthExpenses / categoryCount;
    const netProfit = grossProfit - allocatedExpense;
    const marginPct =
      agg.revenue > 0 ? Math.round((netProfit / agg.revenue) * 1000) / 10 : 0;

    rows.push({
      category,
      revenue: Math.round(agg.revenue * 100) / 100,
      cogs: Math.round(agg.cogs * 100) / 100,
      grossProfit: Math.round(grossProfit * 100) / 100,
      allocatedExpense: Math.round(allocatedExpense * 100) / 100,
      netProfit: Math.round(netProfit * 100) / 100,
      unitsSold: agg.unitsSold,
      marginPct,
    });
  }

  return rows.sort((a, b) => b.netProfit - a.netProfit);
}

