import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildBulkCourierBookingCsv,
  buildSupplierStatementLedger,
  computeProductProfitAndDeadStock,
  getInvoiceItemTotalQty,
  validateBackupPayload,
} from './erpFeatureUtils';
import {
  Invoice,
  PurchaseBill,
  PurchaseReturn,
  StockItem,
  Supplier,
  SupplierPayment,
  Wholesaler,
} from '../data/mockData';

test('getInvoiceItemTotalQty adds paid quantity and bonus free quantity cleanly', () => {
  assert.equal(getInvoiceItemTotalQty({ quantity: 20 }), 20);
  assert.equal(getInvoiceItemTotalQty({ quantity: 20, bonusQty: 2 }), 22);
  assert.equal(getInvoiceItemTotalQty({ quantity: 10, bonusQty: -5 }), 10);
});

test('computeProductProfitAndDeadStock accounts for bonus qty in COGS and detects slow/dead stock', () => {
  const items: StockItem[] = [
    {
      id: 'ITM-1',
      name: 'Hair Tonic',
      category: 'Hair Care',
      sku: 'HT-01',
      batchNo: 'B1',
      quantity: 50,
      unit: 'pcs',
      price: 250,
      costPrice: 120,
      supplier: 'Dhaka Herbs',
      expiryDate: '2027-12-31',
      reorderThreshold: 10,
      location: 'Main',
      status: 'In Stock',
    },
    {
      id: 'ITM-2',
      name: 'Slow Cream',
      category: 'Skin Care',
      sku: 'SC-02',
      batchNo: 'B2',
      quantity: 30,
      unit: 'pcs',
      price: 300,
      costPrice: 150,
      supplier: 'Dhaka Herbs',
      expiryDate: '2027-12-31',
      reorderThreshold: 5,
      location: 'Main',
      status: 'In Stock',
    },
  ];

  const invoices: Invoice[] = [
    {
      id: 'INV-1',
      chalanNo: '250001',
      wholesalerId: 'W-1',
      wholesalerName: 'ABC Pharma',
      items: [
        {
          itemId: 'ITM-1',
          itemName: 'Hair Tonic',
          unitPrice: 250,
          quantity: 10,
          bonusQty: 2, // 12 units leave inventory, 10 billed
          total: 2500,
        },
        {
          itemId: 'ITM-2',
          itemName: 'Slow Cream',
          unitPrice: 300,
          quantity: 1,
          bonusQty: 0,
          total: 300,
        },
      ],
      totalAmount: 2800,
      paidAmount: 2800,
      dueAmount: 0,
      date: '2026-10-10',
      deliveryDate: '2026-10-10',
      status: 'Paid',
    },
    {
      id: 'INV-2',
      chalanNo: '250002',
      wholesalerId: 'W-1',
      wholesalerName: 'ABC Pharma',
      items: [
        {
          itemId: 'ITM-1',
          itemName: 'Hair Tonic',
          unitPrice: 250,
          quantity: 4,
          bonusQty: 0,
          total: 1000,
        },
      ],
      totalAmount: 1000,
      paidAmount: 1000,
      dueAmount: 0,
      date: '2026-11-15',
      deliveryDate: '2026-11-15',
      status: 'Paid',
    },
  ];

  const report = computeProductProfitAndDeadStock({
    items,
    invoices,
    referenceDateYYYYMMDD: '2026-11-19',
    deadStockThresholdDays: 30,
  });

  const hairTonic = report.rows.find((r) => r.itemId === 'ITM-1')!;
  // Revenue: 2500 + 1000 = 3500; Units out: (10+2)+4 = 16; COGS: 16 * 120 = 1920; Profit: 1580
  assert.equal(hairTonic.grossRevenue, 3500);
  assert.equal(hairTonic.bonusFreeUnits, 2);
  assert.equal(hairTonic.totalUnitsOut, 16);
  assert.equal(hairTonic.cogs, 1920);
  assert.equal(hairTonic.grossProfit, 1580);
  assert.equal(hairTonic.isDeadStock, false);

  const slowCream = report.rows.find((r) => r.itemId === 'ITM-2')!;
  // Last sold 2026-10-10 -> 40 days before 2026-11-19 (>= 30 days)
  assert.equal(slowCream.daysSinceLastSold, 40);
  assert.equal(slowCream.isDeadStock, true);
  assert.equal(slowCream.lockedCapitalValue, 4500);
  assert.equal(report.deadStockCount, 1);
  assert.equal(report.deadStockCapitalValue, 4500);
});

test('buildSupplierStatementLedger reconciles bills, bill payments, returns, and due payments chronologically', () => {
  const supplier: Supplier = {
    id: 'SUP-1',
    name: 'Dhaka Herbs',
    contactPerson: 'Kamal',
    phone: '01700000000',
    email: 'sup@test.com',
    address: 'Dhaka',
    activeItems: 2,
    status: 'Active',
    totalDue: 4000,
  };

  const purchaseBills: PurchaseBill[] = [
    {
      id: 'PB-1',
      billNo: 'PB-101',
      supplierId: 'SUP-1',
      supplierName: 'Dhaka Herbs',
      date: '2026-11-01',
      items: [
        { itemId: 'ITM-1', itemName: 'Hair Tonic', sku: 'HT-01', quantity: 100, costPrice: 100, total: 10000 },
      ],
      subTotal: 10000,
      totalAmount: 10000,
      paidAmount: 4000,
      dueAmount: 6000,
      status: 'Partial',
    },
  ];

  const purchaseReturns: PurchaseReturn[] = [
    {
      id: 'PR-1',
      returnNo: 'PR-001',
      supplierId: 'SUP-1',
      supplierName: 'Dhaka Herbs',
      date: '2026-11-05',
      items: [{ itemId: 'ITM-1', itemName: 'Hair Tonic', quantity: 5, costPrice: 100, total: 500 }],
      totalAmount: 500,
      reason: 'Damaged bottle',
    },
  ];

  const supplierPayments: SupplierPayment[] = [
    {
      id: 'SP-1',
      receiptNo: 'SP-001',
      supplierId: 'SUP-1',
      supplierName: 'Dhaka Herbs',
      date: '2026-11-10',
      amount: 1500,
      paymentMethod: 'Bank Transfer',
    },
  ];

  const summary = buildSupplierStatementLedger({
    supplier,
    purchaseBills,
    purchaseReturns,
    supplierPayments,
  });

  assert.equal(summary.totalBilled, 10000);
  assert.equal(summary.totalPaidAndReturned, 6000);
  assert.equal(summary.closingBalance, 4000);
  assert.equal(summary.entries.length, 4);
  assert.equal(summary.entries[summary.entries.length - 1].runningBalance, 4000);
});

test('buildBulkCourierBookingCsv exports properly formatted Steadfast CSV with quoted commas', () => {
  const wholesalers: Wholesaler[] = [
    {
      id: 'W-1',
      name: 'Hasan Pharmacy',
      phone: '01711111111',
      address: 'House 12, Road 4, Mirpur, Dhaka',
      totalDue: 2500,
    },
  ];
  const invoices: Invoice[] = [
    {
      id: 'INV-1',
      chalanNo: '250099',
      wholesalerId: 'W-1',
      wholesalerName: 'Hasan Pharmacy',
      items: [],
      totalAmount: 3000,
      paidAmount: 500,
      dueAmount: 2500,
      date: '2026-11-19',
      status: 'Partial',
      totalCartons: 2,
      notes: 'Fragile, handle carefully',
    },
  ];

  const csv = buildBulkCourierBookingCsv(invoices, wholesalers, 'steadfast');
  const lines = csv.split('\n');
  assert.equal(lines.length, 2);
  assert.equal(lines[0], 'Invoice,Name,Address,Phone,Amount,Note');
  assert.ok(lines[1].includes('"House 12, Road 4, Mirpur, Dhaka"'));
  assert.ok(lines[1].includes('2500'));
});

test('validateBackupPayload rejects malformed JSON and accepts valid ERP backup with new modules', () => {
  assert.equal(validateBackupPayload(null).valid, false);
  assert.equal(validateBackupPayload({ items: 'bad' }).valid, false);
  const ok = validateBackupPayload({
    items: [],
    invoices: [],
    purchaseBills: [],
    purchaseReturns: [],
    supplierPayments: [],
  });
  assert.equal(ok.valid, true);
});
