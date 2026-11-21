import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyWarehouseTransfer,
  buildDueReminderWhatsAppText,
  buildInvoiceWhatsAppText,
  computeDueAgingReport,
  computeSalesRepMetrics,
  deductFromBatchesFEFO,
  encodeCode39Bars,
  evaluateCreditLimit,
  getCourierTrackingUrl,
  getWhatsAppUrl,
  resolveWholesaleUnitPrice,
} from './erpEnhancements';
import { Invoice, SalesRep, StockItem, Wholesaler } from '../data/mockData';

const sampleItem: StockItem = {
  id: 'ITM-1',
  name: 'Dear Hair Oil',
  category: 'Hair Care',
  sku: 'DHO-200',
  batchNo: 'B-OLD',
  quantity: 40,
  unit: 'Bottles',
  price: 200,
  costPrice: 130,
  supplier: 'In-House',
  expiryDate: '2026-12-01',
  mfgDate: '2025-12-01',
  reorderThreshold: 10,
  location: 'Aisle 1',
  status: 'In Stock',
  priceTiers: [
    { minQty: 10, unitPrice: 185 },
    { minQty: 50, unitPrice: 165 },
  ],
  batches: [
    { id: 'B2', batchNo: 'B-NEW', mfgDate: '2026-06-01', expiryDate: '2027-12-01', quantity: 25 },
    { id: 'B1', batchNo: 'B-OLD', mfgDate: '2025-12-01', expiryDate: '2026-12-01', quantity: 15 },
  ],
};

test('resolveWholesaleUnitPrice respects buyer approved rate first, then best matching tier, then base price', () => {
  const buyerWithCustom: Wholesaler = {
    id: 'W-1',
    name: 'Karim',
    phone: '01711000000',
    address: 'Dhaka',
    totalDue: 0,
    approvedPrices: { 'ITM-1': 175 },
  };
  const buyerStandard: Wholesaler = {
    id: 'W-2',
    name: 'Rahim',
    phone: '01722000000',
    address: 'Dhaka',
    totalDue: 0,
  };

  assert.deepEqual(resolveWholesaleUnitPrice(sampleItem, buyerWithCustom, 60), {
    unitPrice: 175,
    pricingSource: 'approved',
  });
  assert.deepEqual(resolveWholesaleUnitPrice(sampleItem, buyerStandard, 5), {
    unitPrice: 200,
    pricingSource: 'standard',
  });
  assert.deepEqual(resolveWholesaleUnitPrice(sampleItem, buyerStandard, 12), {
    unitPrice: 185,
    pricingSource: 'tier',
    appliedTierMinQty: 10,
  });
  assert.deepEqual(resolveWholesaleUnitPrice(sampleItem, buyerStandard, 50), {
    unitPrice: 165,
    pricingSource: 'tier',
    appliedTierMinQty: 50,
  });
});

test('evaluateCreditLimit detects projected excess cleanly', () => {
  const buyer: Wholesaler = {
    id: 'W-1',
    name: 'Karim',
    phone: '01711',
    address: 'Dhaka',
    totalDue: 4000,
    creditLimit: 5000,
  };
  const ok = evaluateCreditLimit(buyer, 800);
  assert.equal(ok.exceeds, false);
  assert.equal(ok.remainingCredit, 1000);

  const over = evaluateCreditLimit(buyer, 1500);
  assert.equal(over.exceeds, true);
  assert.equal(over.projectedDue, 5500);
  assert.equal(over.excessAmount, 500);
});

test('computeDueAgingReport allocates buyer due newest-first across age buckets', () => {
  const buyer: Wholesaler = {
    id: 'W-1',
    name: 'Meskat',
    phone: '01711',
    address: 'Dhaka',
    totalDue: 10000,
  };
  const invoices: Invoice[] = [
    {
      id: 'INV-1',
      chalanNo: '1001',
      wholesalerId: 'W-1',
      wholesalerName: 'Meskat',
      saleType: 'Wholesale',
      items: [{ itemId: 'ITM-1', itemName: 'Oil', unitPrice: 200, quantity: 30, total: 6000 }],
      subTotal: 6000,
      totalAmount: 6000,
      paidAmount: 0,
      dueAmount: 6000,
      date: '2026-11-10T10:00:00',
      status: 'Unpaid',
    },
    {
      id: 'INV-2',
      chalanNo: '1000',
      wholesalerId: 'W-1',
      wholesalerName: 'Meskat',
      saleType: 'Wholesale',
      items: [{ itemId: 'ITM-1', itemName: 'Oil', unitPrice: 200, quantity: 40, total: 8000 }],
      subTotal: 8000,
      totalAmount: 8000,
      paidAmount: 0,
      dueAmount: 8000,
      date: '2026-10-01T10:00:00',
      status: 'Unpaid',
    },
  ];

  const report = computeDueAgingReport([buyer], invoices, '2026-11-17T12:00:00');
  assert.equal(report.rows.length, 1);
  assert.equal(report.rows[0].bucket0_30, 6000);
  assert.equal(report.rows[0].bucket31_60, 4000);
  assert.equal(report.rows[0].bucket61_90, 0);
  assert.equal(report.totals.totalDue, 10000);
});

test('deductFromBatchesFEFO deducts earliest expiring batch first and rotates active batchNo', () => {
  const firstStep = deductFromBatchesFEFO(sampleItem, 10);
  assert.equal(firstStep.updatedItem.quantity, 30);
  assert.equal(firstStep.deductedBatches[0].batchNo, 'B-OLD');
  assert.equal(firstStep.deductedBatches[0].quantity, 10);
  assert.equal(firstStep.updatedItem.batchNo, 'B-OLD');

  const secondStep = deductFromBatchesFEFO(firstStep.updatedItem, 12);
  assert.equal(secondStep.updatedItem.quantity, 18);
  assert.equal(secondStep.deductedBatches.length, 2);
  assert.equal(secondStep.deductedBatches[0].batchNo, 'B-OLD');
  assert.equal(secondStep.deductedBatches[0].quantity, 5);
  assert.equal(secondStep.deductedBatches[1].batchNo, 'B-NEW');
  assert.equal(secondStep.deductedBatches[1].quantity, 7);
  assert.equal(secondStep.updatedItem.batchNo, 'B-NEW');
});

test('applyWarehouseTransfer preserves total quantity across warehouses and rejects overdraft', () => {
  const fail = applyWarehouseTransfer(sampleItem, 'Main Warehouse', 'Dhaka Depot', 50);
  assert.equal(fail.success, false);

  const ok = applyWarehouseTransfer(sampleItem, 'Main Warehouse', 'Dhaka Depot', 15);
  assert.equal(ok.success, true);
  assert.equal(ok.updatedItem?.quantity, 40);
  assert.deepEqual(ok.updatedItem?.warehouseStocks, {
    'Main Warehouse': 25,
    'Dhaka Depot': 15,
  });
});

test('computeSalesRepMetrics computes billed sales, collection, and commission accurately', () => {
  const reps: SalesRep[] = [
    { id: 'SR-1', name: 'Rafiq', phone: '017', area: 'Mirpur', commissionRate: 5, monthlyTarget: 50000, status: 'Active' },
  ];
  const buyers: Wholesaler[] = [
    { id: 'W-1', name: 'Buyer A', phone: '018', address: 'Mirpur', totalDue: 4000, salesRepId: 'SR-1', salesRepName: 'Rafiq' },
  ];
  const invs: Invoice[] = [
    {
      id: 'INV-1',
      chalanNo: '25001',
      wholesalerId: 'W-1',
      wholesalerName: 'Buyer A',
      items: [{ itemId: '1', itemName: 'Oil', unitPrice: 200, quantity: 50, total: 10000 }],
      subTotal: 10000,
      totalAmount: 10000,
      paidAmount: 6000,
      dueAmount: 4000,
      date: '2026-11-10T10:00:00',
      status: 'Partial',
      salesRepId: 'SR-1',
    },
  ];
  const res = computeSalesRepMetrics(reps, buyers, invs);
  assert.equal(res[0].totalSales, 10000);
  assert.equal(res[0].totalCollected, 6000);
  assert.equal(res[0].earnedCommission, 500);
  assert.equal(res[0].targetAchievementPct, 20);
});

test('WhatsApp, Courier Tracking URL, and Code39 Barcode generators return valid outputs', () => {
  const waUrl = getWhatsAppUrl('01717-788182', buildDueReminderWhatsAppText('Karim', 1500, 'Stock ERP'));
  assert.ok(waUrl.startsWith('https://wa.me/8801717788182?text='));

  const trk = getCourierTrackingUrl('RedX Courier', 'RDX-123');
  assert.equal(trk, 'https://redx.com.bd/track-parcel/?trackingId=RDX-123');

  const invTxt = buildInvoiceWhatsAppText(
    {
      id: '1',
      chalanNo: '2500022',
      wholesalerId: 'W1',
      wholesalerName: 'Meskat',
      items: [],
      subTotal: 1000,
      totalAmount: 1000,
      paidAmount: 400,
      dueAmount: 600,
      date: '2026-11-17',
      status: 'Partial',
    },
    'Stock ERP'
  );
  assert.ok(invTxt.includes('2500022'));

  const code39 = encodeCode39Bars('DHO-200');
  assert.ok(code39.bars.length > 20);
  assert.ok(code39.totalWidth > 60);
});
