import {
  AuditLogEntry,
  CustomerOrder,
  CustomerReturn,
  PaymentClaim,
  PurchaseOrder,
  StockItem,
  Wholesaler,
} from '../data/mockData';
import { formatDDMMYY } from './dateUtils';

export type NotificationCategory = 'buyer' | 'stock' | 'finance' | 'activity';
export type NotificationSeverity = 'urgent' | 'warning' | 'info' | 'success';

export interface SystemNotification {
  id: string;
  category: NotificationCategory;
  severity: NotificationSeverity;
  title: string;
  message: string;
  timestampLabel: string;
  targetTab: string;
  badge?: string;
}

export interface BuildSystemNotificationsInput {
  items: StockItem[];
  customerOrders: CustomerOrder[];
  paymentClaims: PaymentClaim[];
  customerReturns: CustomerReturn[];
  wholesalers: Wholesaler[];
  purchaseOrders: PurchaseOrder[];
  auditLogs: AuditLogEntry[];
  referenceDate?: string;
}

const mapAuditModuleToTab = (moduleName: AuditLogEntry['module']): string => {
  switch (moduleName) {
    case 'Inventory':
      return 'inventory';
    case 'Sales':
      return 'sales';
    case 'Accounts':
      return 'accounts';
    case 'Buyers':
      return 'wholesalers';
    case 'Portal':
      return 'sales';
    case 'Transfers':
      return 'transactions';
    case 'SalesReps':
      return 'sales-reps';
    case 'Settings':
    case 'Users':
      return 'settings';
    default:
      return 'audit-log';
  }
};

export const buildSystemNotifications = (
  input: BuildSystemNotificationsInput
): SystemNotification[] => {
  const notifications: SystemNotification[] = [];
  const refDateMs = input.referenceDate
    ? new Date(`${input.referenceDate.slice(0, 10)}T00:00:00Z`).getTime()
    : Date.now();

  // 1. Wholesale Buyer Pending Orders (Urgent)
  const pendingOrders = input.customerOrders.filter((o) => o.status === 'Pending Approval');
  pendingOrders.forEach((ord) => {
    const qtyCount = ord.items.reduce((s, it) => s + it.quantity, 0);
    notifications.push({
      id: `notif-ord-${ord.id}`,
      category: 'buyer',
      severity: 'urgent',
      title: `New Buyer Order: ${ord.orderNo}`,
      message: `${ord.wholesalerName} ordered ${qtyCount} pcs (৳${ord.totalAmount.toLocaleString()}). Tap to review or create Chalan.`,
      timestampLabel: formatDDMMYY(ord.createdAt),
      targetTab: 'sales',
      badge: 'Order',
    });
  });

  // 2. Wholesale Buyer Pending Payment Claims (Urgent)
  const pendingClaims = input.paymentClaims.filter((c) => c.status === 'Pending');
  pendingClaims.forEach((clm) => {
    notifications.push({
      id: `notif-clm-${clm.id}`,
      category: 'buyer',
      severity: 'urgent',
      title: `Payment Claim: ${clm.claimNo} (৳${clm.amount.toLocaleString()})`,
      message: `${clm.wholesalerName} submitted ${clm.paymentMethod} Trx: ${clm.trxId}. Tap to verify & issue receipt.`,
      timestampLabel: formatDDMMYY(clm.paymentDate || clm.createdAt),
      targetTab: 'accounts',
      badge: 'Payment',
    });
  });

  // 3. Wholesale Buyer Pending Return Requests (Urgent)
  const pendingReturns = input.customerReturns.filter((r) => r.status === 'Requested');
  pendingReturns.forEach((ret) => {
    notifications.push({
      id: `notif-ret-${ret.id}`,
      category: 'buyer',
      severity: 'urgent',
      title: `Return Request: ${ret.returnNo}`,
      message: `${ret.wholesalerName} requested return for Chalan ${ret.chalanNo} (Credit ৳${ret.totalCreditAmount.toLocaleString()}).`,
      timestampLabel: formatDDMMYY(ret.createdAt),
      targetTab: 'sales',
      badge: 'Return',
    });
  });

  // 4. Buyer Delivery Confirmations
  input.customerOrders
    .filter((o) => o.status === 'Delivered' && o.deliveredAt)
    .slice(0, 3)
    .forEach((ord) => {
      notifications.push({
        id: `notif-deliv-${ord.id}`,
        category: 'buyer',
        severity: 'success',
        title: `Delivery Confirmed: ${ord.orderNo}`,
        message: `${ord.wholesalerName} confirmed delivery received.`,
        timestampLabel: formatDDMMYY(ord.deliveredAt || ord.updatedAt),
        targetTab: 'sales',
        badge: 'Delivered',
      });
    });

  // 5. Credit Limit Exceeded Buyers
  input.wholesalers
    .filter((w) => w.creditLimit && w.creditLimit > 0 && w.totalDue > w.creditLimit)
    .forEach((w) => {
      notifications.push({
        id: `notif-credit-${w.id}`,
        category: 'finance',
        severity: 'warning',
        title: `Credit Limit Exceeded: ${w.name}`,
        message: `Due ৳${w.totalDue.toLocaleString()} exceeds credit limit ৳${(w.creditLimit || 0).toLocaleString()}.`,
        timestampLabel: 'Active',
        targetTab: 'accounts',
        badge: 'Credit Alert',
      });
    });

  // 6. Out of Stock & Low Stock Items
  const outOfStock = input.items.filter((i) => i.quantity <= 0);
  if (outOfStock.length > 0) {
    notifications.push({
      id: 'notif-stock-out',
      category: 'stock',
      severity: 'urgent',
      title: `${outOfStock.length} Product${outOfStock.length > 1 ? 's' : ''} Out of Stock`,
      message: `${outOfStock.slice(0, 3).map((i) => i.name).join(', ')}${outOfStock.length > 3 ? '...' : ''}`,
      timestampLabel: 'Immediate',
      targetTab: 'inventory',
      badge: '0 Stock',
    });
  }

  const lowStock = input.items.filter(
    (i) => i.quantity > 0 && i.quantity <= i.reorderThreshold
  );
  if (lowStock.length > 0) {
    notifications.push({
      id: 'notif-stock-low',
      category: 'stock',
      severity: 'warning',
      title: `${lowStock.length} Low Stock Alert${lowStock.length > 1 ? 's' : ''}`,
      message: `${lowStock.slice(0, 3).map((i) => `${i.name} (${i.quantity})`).join(', ')}${lowStock.length > 3 ? '...' : ''}`,
      timestampLabel: 'Reorder',
      targetTab: 'inventory',
      badge: 'Low Stock',
    });
  }

  // 7. Expired & Near-Expiry Alerts (<= 60 days)
  let expiredCount = 0;
  let soonExpiryCount = 0;
  input.items.forEach((item) => {
    const datesToCheck =
      item.batches && item.batches.length > 0
        ? item.batches.filter((b) => b.quantity > 0).map((b) => b.expiryDate)
        : [item.expiryDate];
    for (const d of datesToCheck) {
      if (!d) continue;
      const expMs = new Date(`${d.slice(0, 10)}T00:00:00Z`).getTime();
      if (Number.isNaN(expMs)) continue;
      const diffDays = Math.ceil((expMs - refDateMs) / 86400000);
      if (diffDays <= 0) expiredCount += 1;
      else if (diffDays <= 60) soonExpiryCount += 1;
    }
  });

  if (expiredCount > 0) {
    notifications.push({
      id: 'notif-exp-expired',
      category: 'stock',
      severity: 'urgent',
      title: `${expiredCount} Expired Batch / Item${expiredCount > 1 ? 's' : ''}`,
      message: 'Expired stock detected. Review Expiry & Damaged module to write off or quarantine.',
      timestampLabel: 'Urgent',
      targetTab: 'expiry-damage',
      badge: 'Expired',
    });
  }

  if (soonExpiryCount > 0) {
    notifications.push({
      id: 'notif-exp-soon',
      category: 'stock',
      severity: 'warning',
      title: `${soonExpiryCount} Batch${soonExpiryCount > 1 ? 'es' : ''} Expiring Soon (≤ 60d)`,
      message: 'Monitor upcoming expiries under Expiry & Damaged to prioritize FEFO dispatch.',
      timestampLabel: 'Watchlist',
      targetTab: 'expiry-damage',
      badge: 'Expiry',
    });
  }

  // 8. Pending Purchase Orders (PO)
  const openPOs = input.purchaseOrders.filter(
    (po) => po.status !== 'Received' && po.status !== 'Cancelled'
  );
  if (openPOs.length > 0) {
    notifications.push({
      id: 'notif-open-pos',
      category: 'stock',
      severity: 'info',
      title: `${openPOs.length} Open Purchase Order${openPOs.length > 1 ? 's' : ''}`,
      message: `Awaiting supplier restock (${openPOs.map((p) => p.poNo).slice(0, 2).join(', ')})`,
      timestampLabel: 'PO Queue',
      targetTab: 'purchase-orders',
      badge: 'PO',
    });
  }

  // 9. Recent System Activity Feed from Audit Logs
  input.auditLogs.slice(0, 8).forEach((log) => {
    notifications.push({
      id: `notif-audit-${log.id}`,
      category: 'activity',
      severity: 'info',
      title: `${log.action} • ${log.module}`,
      message: `${log.details} (by ${log.userName})`,
      timestampLabel: formatDDMMYY(log.timestamp),
      targetTab: mapAuditModuleToTab(log.module),
      badge: log.module,
    });
  });

  return notifications;
};
