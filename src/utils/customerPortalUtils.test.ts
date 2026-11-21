import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildBuyerAccountStatement,
  buildRepeatOrderItems,
  getApprovedUnitPrice,
} from './customerPortalUtils';
import { AccountTxn, CustomerReturn, Invoice, StockItem, Wholesaler } from '../data/mockData';

const sampleItems: StockItem[] = [
  {
    id: 'item_1',
    name: 'Dear Hair Tonic',
    category: 'Hair',
    sku: 'SKU-1',
    batchNo: 'B-01',
    quantity: 50,
    unit: '200 ml',
    packSize: '200 ml',
    price: 180,
    retailPrice: 280,
    costPrice: 110,
    supplier: 'ABC',
    expiryDate: '2028-01-01',
    reorderThreshold: 10,
    location: 'A1',
    status: 'In Stock',
  },
  {
    id: 'item_2',
    name: 'Dear Face Wash',
    category: 'Skin',
    sku: 'SKU-2',
    batchNo: 'B-02',
    quantity: 0,
    unit: '30 ml',
    packSize: '30 ml',
    price: 85,
    retailPrice: 120,
    costPrice: 50,
    supplier: 'ABC',
    expiryDate: '2028-01-01',
    reorderThreshold: 10,
    location: 'A2',
    status: 'Out of Stock',
  },
];

const buyer: Wholesaler = {
  id: 'CUST-1',
  name: 'Meskat Enterprise',
  phone: '01917-084746',
  address: 'Mirpur-2, Dhaka',
  totalDue: 3500,
  approvedPrices: {
    item_1: 165,
  },
};

test('getApprovedUnitPrice returns buyer-specific rate when configured and falls back otherwise', () => {
  assert.deepEqual(getApprovedUnitPrice(sampleItems[0], buyer), {
    unitPrice: 165,
    isCustomApproved: true,
  });
  assert.deepEqual(getApprovedUnitPrice(sampleItems[1], buyer), {
    unitPrice: 85,
    isCustomApproved: false,
  });
});

test('buildRepeatOrderItems applies approved price, clamps to stock, and skips out-of-stock items', () => {
  const result = buildRepeatOrderItems(
    [
      { itemId: 'item_1', itemName: 'Dear Hair Tonic', unitPrice: 180, quantity: 100, total: 18000 },
      { itemId: 'item_2', itemName: 'Dear Face Wash', unitPrice: 85, quantity: 10, total: 850 },
    ],
    sampleItems,
    buyer
  );

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].quantity, 50);
  assert.equal(result.items[0].unitPrice, 165);
  assert.equal(result.items[0].total, 8250);
  assert.deepEqual(result.skippedNames, ['Dear Face Wash']);
  assert.deepEqual(result.adjustedNames, ['Dear Hair Tonic (50/100)']);
});

test('buildBuyerAccountStatement computes chronological debit/credit and closing balance matching buyer totalDue', () => {
  const invoices: Invoice[] = [
    {
      id: 'INV-1',
      chalanNo: '2500022',
      wholesalerId: 'CUST-1',
      wholesalerName: 'Meskat Enterprise',
      items: [{ itemId: 'item_1', itemName: 'Dear Hair Tonic', unitPrice: 165, quantity: 40, total: 6600 }],
      subTotal: 6600,
      previousDue: 0,
      grandTotal: 6600,
      totalAmount: 6600,
      paidAmount: 2000,
      dueAmount: 4600,
      date: '2026-11-10T10:00:00',
      status: 'Partial',
    },
  ];

  const txns: AccountTxn[] = [
    {
      id: 'ACT-1',
      date: '2026-11-10T10:00:00',
      type: 'IN',
      amount: 2000,
      reference: '2500022',
      description: 'Advance/Cash paid for Sale 2500022',
      wholesalerId: 'CUST-1',
    },
    {
      id: 'ACT-2',
      date: '2026-11-12T12:00:00',
      type: 'IN',
      amount: 600,
      reference: 'REC-101',
      description: 'Due collection from Meskat Enterprise',
      wholesalerId: 'CUST-1',
    },
  ];

  const returns: CustomerReturn[] = [
    {
      id: 'RET-1',
      returnNo: 'RET-001',
      wholesalerId: 'CUST-1',
      wholesalerName: 'Meskat Enterprise',
      chalanNo: '2500022',
      items: [{ itemId: 'item_1', itemName: 'Dear Hair Tonic', quantity: 2, unitPrice: 250, total: 500 }],
      totalCreditAmount: 500,
      reason: 'Damaged in transit',
      status: 'Credited',
      createdAt: '2026-11-14T15:00:00',
      resolvedAt: '2026-11-14T16:00:00',
    },
  ];

  const statement = buildBuyerAccountStatement({
    buyer,
    invoices,
    accountTxns: txns,
    returns,
  });

  assert.equal(statement.totalDebit, 6600);
  assert.equal(statement.totalCredit, 3100);
  assert.equal(statement.closingBalance, 3500);
  assert.equal(statement.entries.length, 4);
});
