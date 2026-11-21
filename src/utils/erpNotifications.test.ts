import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSystemNotifications } from './erpNotifications';
import {
  AuditLogEntry,
  CustomerOrder,
  CustomerReturn,
  PaymentClaim,
  PurchaseOrder,
  StockItem,
  Wholesaler,
} from '../data/mockData';

test('buildSystemNotifications surfaces buyer requests, stock/expiry alerts, credit warnings, and audit activity', () => {
  const items: StockItem[] = [
    {
      id: 'ITM-1',
      name: 'Face Wash 30ml',
      category: 'Skin',
      sku: 'FW-30',
      batchNo: 'B1',
      quantity: 0,
      unit: 'Pcs',
      price: 150,
      costPrice: 90,
      supplier: 'Dear',
      expiryDate: '2026-11-10',
      reorderThreshold: 10,
      location: 'A1',
      status: 'Out of Stock',
    },
    {
      id: 'ITM-2',
      name: 'Hair Tonic 200ml',
      category: 'Hair',
      sku: 'HT-200',
      batchNo: 'B2',
      quantity: 5,
      unit: 'Bottles',
      price: 400,
      costPrice: 250,
      supplier: 'Dear',
      expiryDate: '2026-12-01',
      reorderThreshold: 10,
      location: 'A2',
      status: 'Low Stock',
    },
  ];

  const orders: CustomerOrder[] = [
    {
      id: 'ORD-1',
      orderNo: 'ORD-1001',
      wholesalerId: 'W-1',
      wholesalerName: 'Meskat Store',
      items: [
        { itemId: 'ITM-2', itemName: 'Hair Tonic', quantity: 5, unitPrice: 400, total: 2000 },
      ],
      totalAmount: 2000,
      status: 'Pending Approval',
      createdAt: '2026-11-18T00:00:00Z',
      updatedAt: '2026-11-18T00:00:00Z',
    },
  ];

  const claims: PaymentClaim[] = [
    {
      id: 'CLM-1',
      claimNo: 'CLM-201',
      wholesalerId: 'W-1',
      wholesalerName: 'Meskat Store',
      amount: 1500,
      paymentMethod: 'bKash',
      trxId: 'TRX999',
      paymentDate: '2026-11-18',
      status: 'Pending',
      createdAt: '2026-11-18T00:00:00Z',
    },
  ];

  const returns: CustomerReturn[] = [
    {
      id: 'RET-1',
      returnNo: 'RET-301',
      wholesalerId: 'W-1',
      wholesalerName: 'Meskat Store',
      invoiceId: 'INV-1',
      chalanNo: '250001',
      items: [],
      totalCreditAmount: 300,
      reason: 'Damaged in Transit',
      status: 'Requested',
      createdAt: '2026-11-18T00:00:00Z',
    },
  ];

  const wholesalers: Wholesaler[] = [
    {
      id: 'W-1',
      name: 'Meskat Store',
      phone: '017',
      address: 'Dhaka',
      totalDue: 12000,
      creditLimit: 10000,
    },
  ];

  const purchaseOrders: PurchaseOrder[] = [
    {
      id: 'PO-1',
      poNo: 'PO-55',
      supplierName: 'Herbals BD',
      date: '2026-11-18',
      items: [],
      totalAmount: 5000,
      status: 'Sent',
    },
  ];

  const auditLogs: AuditLogEntry[] = [
    {
      id: 'AUD-1',
      timestamp: '2026-11-18T01:00:00Z',
      userId: 'admin',
      userName: 'Admin',
      userRole: 'admin',
      action: 'Create Chalan',
      module: 'Sales',
      details: 'Chalan 250002 created',
    },
  ];

  const list = buildSystemNotifications({
    items,
    customerOrders: orders,
    paymentClaims: claims,
    customerReturns: returns,
    wholesalers,
    purchaseOrders,
    auditLogs,
    referenceDate: '2026-11-18',
  });

  assert.ok(list.some((n) => n.badge === 'Order' && n.targetTab === 'sales'));
  assert.ok(list.some((n) => n.badge === 'Payment' && n.targetTab === 'accounts'));
  assert.ok(list.some((n) => n.badge === 'Return' && n.targetTab === 'sales'));
  assert.ok(list.some((n) => n.badge === 'Credit Alert' && n.targetTab === 'accounts'));
  assert.ok(list.some((n) => n.badge === '0 Stock' && n.targetTab === 'inventory'));
  assert.ok(list.some((n) => n.badge === 'Low Stock' && n.targetTab === 'inventory'));
  assert.ok(list.some((n) => n.badge === 'Expired' && n.targetTab === 'expiry-damage'));
  assert.ok(list.some((n) => n.badge === 'Expiry' && n.targetTab === 'expiry-damage'));
  assert.ok(list.some((n) => n.badge === 'PO' && n.targetTab === 'purchase-orders'));
  assert.ok(list.some((n) => n.category === 'activity' && n.targetTab === 'sales'));
});
