import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSupplierPurchaseCsv,
  computeSupplierPurchaseReport,
} from './purchaseReportUtils';
import { PurchaseOrder, StockItem, StockTransaction, Supplier } from '../data/mockData';

const items: StockItem[] = [
  {
    id: 'ITM-1',
    name: 'Hair Tonic',
    category: 'Hair Care',
    sku: 'HT-200',
    batchNo: 'B-1',
    quantity: 50,
    unit: 'Bottles',
    price: 350,
    costPrice: 200,
    supplier: 'Square Pharma',
    expiryDate: '2027-12-31',
    reorderThreshold: 10,
    location: 'Shelf A',
    status: 'In Stock',
  },
  {
    id: 'ITM-2',
    name: 'Napa Extra',
    category: 'Tablets',
    sku: 'NP-500',
    batchNo: 'B-2',
    quantity: 120,
    unit: 'Boxes',
    price: 150,
    costPrice: 100,
    supplier: 'Beximco Pharma',
    expiryDate: '2027-10-31',
    reorderThreshold: 20,
    location: 'Shelf B',
    status: 'In Stock',
  },
];

const suppliers: Supplier[] = [
  {
    id: 'SUP-1',
    name: 'Square Pharma',
    contactPerson: 'Kamal',
    phone: '01711111111',
    email: 'sq@example.com',
    address: 'Dhaka',
    activeItems: 1,
    status: 'Active',
  },
  {
    id: 'SUP-2',
    name: 'Beximco Pharma',
    contactPerson: 'Jamal',
    phone: '01722222222',
    email: 'bx@example.com',
    address: 'Dhaka',
    activeItems: 1,
    status: 'Active',
  },
];

test('computeSupplierPurchaseReport aggregates Stock IN & non-duplicate POs by supplier and category', () => {
  const transactions: StockTransaction[] = [
    {
      id: 'TXN-1',
      itemId: 'ITM-1',
      itemName: 'Hair Tonic',
      type: 'IN',
      quantity: 30,
      unitPrice: 200,
      totalPrice: 6000,
      date: '2026-11-05 10:00:00',
      user: 'Admin',
      reference: 'REQ-101',
      notes: 'Restock',
      supplierName: 'Square Pharma',
      category: 'Hair Care',
    },
    {
      id: 'TXN-2',
      itemId: 'ITM-2',
      itemName: 'Napa Extra',
      type: 'IN',
      quantity: 40,
      unitPrice: 100,
      totalPrice: 4000,
      date: '2026-11-10 12:00:00',
      user: 'Admin',
      reference: 'PO-202611-1001',
      notes: 'PO Received from Beximco Pharma',
    },
    {
      id: 'TXN-OUT',
      itemId: 'ITM-1',
      itemName: 'Hair Tonic',
      type: 'OUT',
      quantity: 10,
      unitPrice: 350,
      totalPrice: 3500,
      date: '2026-11-12 15:00:00',
      user: 'Admin',
      reference: 'INV-1',
      notes: 'Sale',
    },
  ];

  const purchaseOrders: PurchaseOrder[] = [
    // Duplicate already covered by TXN-2 -> must NOT double count
    {
      id: 'PO-1',
      poNo: 'PO-202611-1001',
      supplierName: 'Beximco Pharma',
      items: [{ itemId: 'ITM-2', itemName: 'Napa Extra', quantity: 40, costPrice: 100, total: 4000 }],
      totalAmount: 4000,
      date: '2026-11-10 12:00:00',
      status: 'Received',
    },
    // Another Received PO without IN txn -> SHOULD be included
    {
      id: 'PO-2',
      poNo: 'PO-202611-1002',
      supplierName: 'Square Pharma',
      items: [{ itemId: 'ITM-2', itemName: 'Napa Extra', quantity: 20, costPrice: 95, total: 1900 }],
      totalAmount: 1900,
      date: '2026-11-15 09:00:00',
      status: 'Received',
    },
  ];

  const report = computeSupplierPurchaseReport({
    items,
    transactions,
    purchaseOrders,
    suppliers,
    startDate: '2026-11-01',
    endDate: '2026-11-30',
  });

  assert.equal(report.totals.totalSuppliers, 2);
  assert.equal(report.totals.totalCategories, 2);
  assert.equal(report.totals.totalUnits, 90); // 30 + 40 + 20 (NO double count on PO-1)
  assert.equal(report.totals.totalCost, 11900); // 6000 + 4000 + 1900

  assert.equal(report.supplierSummaries[0].supplierName, 'Square Pharma');
  assert.equal(report.supplierSummaries[0].totalUnits, 50);
  assert.equal(report.supplierSummaries[0].totalCost, 7900);
  assert.deepEqual(report.supplierSummaries[0].categories, ['Hair Care', 'Tablets']);

  assert.equal(report.categorySummaries.find((c) => c.category === 'Tablets')?.totalUnits, 60);
});

test('computeSupplierPurchaseReport filters by supplier and category and builds CSV', () => {
  const transactions: StockTransaction[] = [
    {
      id: 'TXN-1',
      itemId: 'ITM-1',
      itemName: 'Hair Tonic',
      type: 'IN',
      quantity: 25,
      unitPrice: 200,
      totalPrice: 5000,
      date: '2026-11-05 10:00:00',
      user: 'Admin',
      reference: 'REQ-1',
      notes: 'Stock replenishment',
      supplierName: 'Square Pharma',
      category: 'Hair Care',
    },
    {
      id: 'TXN-2',
      itemId: 'ITM-2',
      itemName: 'Napa Extra',
      type: 'IN',
      quantity: 10,
      unitPrice: 100,
      totalPrice: 1000,
      date: '2026-11-08 10:00:00',
      user: 'Admin',
      reference: 'REQ-2',
      notes: 'Stock replenishment',
      supplierName: 'Beximco Pharma',
      category: 'Tablets',
    },
  ];

  const filtered = computeSupplierPurchaseReport({
    items,
    transactions,
    suppliers,
    startDate: '2026-11-01',
    endDate: '2026-11-30',
    supplierFilter: 'Square Pharma',
    categoryFilter: 'Hair Care',
  });

  assert.equal(filtered.totals.totalSuppliers, 1);
  assert.equal(filtered.totals.totalUnits, 25);
  assert.equal(filtered.totals.totalCost, 5000);

  const csv = buildSupplierPurchaseCsv(filtered);
  assert.ok(csv.includes('SUPPLIER-WISE PURCHASE SUMMARY'));
  assert.ok(csv.includes('"Square Pharma"'));
  assert.ok(csv.includes('"Hair Tonic"'));
});
