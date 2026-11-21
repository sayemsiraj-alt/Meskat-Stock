import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getProductsExpiringWithinDays,
  buildLast12MonthsSalesVsExpenses,
  buildCurrentMonthCategoryNetProfit,
} from './dashboardAnalytics';
import { Expense, Invoice, StockItem } from '../data/mockData';

const makeItem = (overrides: Partial<StockItem>): StockItem => ({
  id: 'ITM-1',
  name: 'Sample Medicine',
  category: 'Pharma',
  sku: 'SKU-1',
  batchNo: 'B-001',
  quantity: 10,
  unit: 'Box',
  price: 100,
  costPrice: 80,
  supplier: 'Acme Labs',
  expiryDate: '2026-12-01',
  reorderThreshold: 5,
  location: 'Main Warehouse',
  status: 'In Stock',
  ...overrides,
});

const makeInvoice = (overrides: Partial<Invoice>): Invoice => ({
  id: 'INV-1',
  chalanNo: 'CH-100',
  wholesalerId: 'W-1',
  wholesalerName: 'Dhaka Traders',
  items: [],
  totalAmount: 1000,
  paidAmount: 1000,
  dueAmount: 0,
  date: '2026-11-10',
  status: 'Paid',
  ...overrides,
});

const makeExpense = (overrides: Partial<Expense>): Expense => ({
  id: 'EXP-1',
  category: 'Rent',
  amount: 400,
  date: '2026-11-05',
  description: 'Godown rent',
  user: 'admin',
  ...overrides,
});

describe('getProductsExpiringWithinDays', () => {
  const refDate = '2026-11-18';

  it('filters strictly within maxDays (30), assigns urgencies, excludes zero stock and >30d items', () => {
    const items: StockItem[] = [
      makeItem({ id: 'EXPIRED', name: 'Old Syrup', expiryDate: '2026-11-15', quantity: 5, price: 200 }),
      makeItem({ id: 'TODAY', name: 'Today Capsule', expiryDate: '2026-11-18', quantity: 10, price: 50 }),
      makeItem({ id: 'DAY_7', name: 'Week Cream', expiryDate: '2026-11-25', quantity: 4, price: 150 }),
      makeItem({ id: 'DAY_30', name: 'Boundary Tablet', expiryDate: '2026-12-18', quantity: 8, price: 100 }),
      makeItem({ id: 'DAY_31', name: 'Safe Tablet', expiryDate: '2026-12-19', quantity: 20, price: 100 }),
      makeItem({ id: 'ZERO_QTY', name: 'Out Stock Item', expiryDate: '2026-11-20', quantity: 0, price: 500 }),
      makeItem({ id: 'BAD_DATE', name: 'Corrupt Date Item', expiryDate: 'invalid', quantity: 10, price: 100 }),
    ];

    const results = getProductsExpiringWithinDays(items, refDate, 30, true);
    assert.deepEqual(
      results.map((r) => [r.item.id, r.daysRemaining, r.urgency]),
      [
        ['EXPIRED', -3, 'expired'],
        ['TODAY', 0, 'critical'],
        ['DAY_7', 7, 'critical'],
        ['DAY_30', 30, 'warning'],
      ]
    );
    assert.equal(results[0].stockValue, 1000);
    assert.equal(results[1].stockValue, 500);
  });

  it('excludes expired items when includeExpired is false and breaks day ties by stockValue desc', () => {
    const items: StockItem[] = [
      makeItem({ id: 'EXPIRED', expiryDate: '2026-11-10', quantity: 3 }),
      makeItem({ id: 'LOW_VAL', expiryDate: '2026-11-28', quantity: 2, price: 50 }),
      makeItem({ id: 'HIGH_VAL', expiryDate: '2026-11-28', quantity: 10, price: 250 }),
    ];

    const results = getProductsExpiringWithinDays(items, refDate, 30, false);
    assert.deepEqual(
      results.map((r) => r.item.id),
      ['HIGH_VAL', 'LOW_VAL']
    );
  });
});

describe('buildLast12MonthsSalesVsExpenses', () => {
  const refDate = '2026-11-18';

  it('produces exactly 12 chronological months ending in anchor month and aggregates invoice/expense dates', () => {
    const invoices: Invoice[] = [
      makeInvoice({ id: 'I1', date: '2025-12-01', totalAmount: 5000 }),
      makeInvoice({ id: 'I2', date: '2025-12-29T18:30:00', totalAmount: 2500 }),
      makeInvoice({ id: 'I3', date: '2026-11-18 09:15:00', totalAmount: 12000 }),
      makeInvoice({ id: 'OUT_OLD', date: '2025-11-30', totalAmount: 99999 }),
      makeInvoice({ id: 'OUT_FUTURE', date: '2026-12-01', totalAmount: 88888 }),
    ];

    const expenses: Expense[] = [
      makeExpense({ id: 'E1', date: '2025-12-15', amount: 1800 }),
      makeExpense({ id: 'E2', date: '2026-06-10', amount: 3400 }),
      makeExpense({ id: 'E3', date: '2026-11-02', amount: 4500 }),
      makeExpense({ id: 'E_OLD', date: '2025-10-01', amount: 7777 }),
    ];

    const series = buildLast12MonthsSalesVsExpenses(invoices, expenses, refDate);
    assert.equal(series.length, 12);
    assert.equal(series[0].monthKey, '2025-12');
    assert.equal(series[0].monthLabel, 'Dec 25');
    assert.equal(series[11].monthKey, '2026-11');
    assert.equal(series[11].monthLabel, 'Nov 26');

    assert.equal(series[0].Sales, 7500);
    assert.equal(series[0].Expenses, 1800);
    assert.equal(series[0].Net, 5700);
    assert.equal(series[0].invoiceCount, 2);

    const june = series.find((p) => p.monthKey === '2026-06');
    assert.ok(june);
    assert.equal(june.Sales, 0);
    assert.equal(june.Expenses, 3400);
    assert.equal(june.Net, -3400);

    assert.equal(series[11].Sales, 12000);
    assert.equal(series[11].Expenses, 4500);
    assert.equal(series[11].Net, 7500);
  });
});

describe('buildCurrentMonthCategoryNetProfit', () => {
  const refDate = '2026-11-18';

  it('computes net profit per product category for the current month only, allocating expenses by revenue share', () => {
    const items: StockItem[] = [
      makeItem({ id: 'P1', name: 'Amoxicillin', category: 'Antibiotics', costPrice: 60 }),
      makeItem({ id: 'P2', name: 'Vitamin D3', category: 'Supplements', costPrice: 150 }),
    ];

    const invoices: Invoice[] = [
      makeInvoice({
        id: 'CUR-1',
        date: '2026-11-05',
        items: [
          { itemId: 'P1', itemName: 'Amoxicillin', unitPrice: 100, quantity: 10, total: 1000 },
          { itemId: 'P2', itemName: 'Vitamin D3', unitPrice: 200, quantity: 10, total: 2000 },
        ],
        totalAmount: 3000,
      }),
      makeInvoice({
        id: 'PREV-MONTH',
        date: '2026-10-28',
        items: [
          { itemId: 'P1', itemName: 'Amoxicillin', unitPrice: 100, quantity: 50, total: 5000 },
        ],
        totalAmount: 5000,
      }),
    ];

    const expenses: Expense[] = [
      makeExpense({ id: 'EXP-NOV', date: '2026-11-12', amount: 300 }),
      makeExpense({ id: 'EXP-OCT', date: '2026-10-12', amount: 900 }),
    ];

    const result = buildCurrentMonthCategoryNetProfit(items, invoices, expenses, refDate);
    assert.equal(result.length, 2);

    // Antibiotics: Rev 1000 (1/3 of 3000), COGS 600, Gross 400, Exp 100 -> Net 300
    // Supplements: Rev 2000 (2/3 of 3000), COGS 1500, Gross 500, Exp 200 -> Net 300
    const antibiotics = result.find((r) => r.category === 'Antibiotics');
    const supplements = result.find((r) => r.category === 'Supplements');
    assert.ok(antibiotics);
    assert.ok(supplements);

    assert.equal(antibiotics.revenue, 1000);
    assert.equal(antibiotics.cogs, 600);
    assert.equal(antibiotics.grossProfit, 400);
    assert.equal(antibiotics.allocatedExpense, 100);
    assert.equal(antibiotics.netProfit, 300);

    assert.equal(supplements.revenue, 2000);
    assert.equal(supplements.cogs, 1500);
    assert.equal(supplements.grossProfit, 500);
    assert.equal(supplements.allocatedExpense, 200);
    assert.equal(supplements.netProfit, 300);
  });

  it('returns negative net profit when allocated expenses/COGS exceed revenue', () => {
    const items: StockItem[] = [
      makeItem({ id: 'P1', name: 'Loss Leader', category: 'Beverages', costPrice: 95 }),
    ];
    const invoices: Invoice[] = [
      makeInvoice({
        id: 'CUR-2',
        date: '2026-11-18',
        items: [{ itemId: 'P1', itemName: 'Loss Leader', unitPrice: 100, quantity: 10, total: 1000 }],
        totalAmount: 1000,
      }),
    ];
    const expenses: Expense[] = [
      makeExpense({ id: 'EXP-BIG', date: '2026-11-18', amount: 250 }),
    ];

    const result = buildCurrentMonthCategoryNetProfit(items, invoices, expenses, refDate);
    assert.equal(result.length, 1);
    assert.equal(result[0].grossProfit, 50);
    assert.equal(result[0].netProfit, -200);
  });
});

