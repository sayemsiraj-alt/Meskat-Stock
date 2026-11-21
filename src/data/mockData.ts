import { ThemeId } from '../utils/themeConfig';
import { readEnvFirebaseConfig } from '../utils/firebaseConfigHelpers';

export interface PriceTier {
  minQty: number;
  unitPrice: number;
}

export interface StockBatch {
  id: string;
  batchNo: string;
  mfgDate?: string;
  expiryDate: string;
  quantity: number;
}

export interface StockItem {
  id: string;
  name: string;
  category: string;
  sku: string;
  batchNo: string;
  quantity: number;
  unit: string;
  price: number;
  costPrice: number;
  supplier: string;
  expiryDate: string;
  mfgDate?: string;
  packSize?: string;
  retailPrice?: number;
  reorderThreshold: number;
  location: string;
  status: 'In Stock' | 'Low Stock' | 'Out of Stock' | 'Expiring Soon';
  imageUrl?: string;
  priceTiers?: PriceTier[];
  batches?: StockBatch[];
  warehouseStocks?: Record<string, number>;
}

export interface StockTransaction {
  id: string;
  itemId: string;
  itemName: string;
  type: 'IN' | 'OUT' | 'RETURN' | 'ADJUSTMENT';
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  date: string;
  user: string;
  reference: string;
  notes: string;
  supplierName?: string;
  category?: string;
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  activeItems: number;
  status: 'Active' | 'Inactive';
  totalDue?: number;
}

export interface Category {
  id: string;
  name: string;
  description: string;
  count: number;
}

export interface RolePermissions {
  canManageInventory: boolean; // Add, edit, delete inventory items
  canManageTransactions: boolean; // Log Stock IN, OUT, RETURN
  canManageRetailPOS: boolean; // Process Retail Counter POS Sales
  canManageWholesale: boolean; // Create & Edit Wholesale Chalans
  canManageAccounts: boolean; // View Cash Ledger & Collect Dues
  canViewReports: boolean; // View & Export Executive Reports
  canManageSuppliersCategories: boolean; // Add/Edit Suppliers & Categories
  canManageSettingsUsers: boolean; // Manage Settings, Users & Firebase
  canManageSalesReps?: boolean; // Manage SR / Commissions
  canViewAuditLog?: boolean; // View System Activity / Audit Log
}

export type RolePermissionMap = {
  admin: RolePermissions;
  manager: RolePermissions;
  staff: RolePermissions;
};

export const defaultRolePermissions: RolePermissionMap = {
  admin: {
    canManageInventory: true,
    canManageTransactions: true,
    canManageRetailPOS: true,
    canManageWholesale: true,
    canManageAccounts: true,
    canViewReports: true,
    canManageSuppliersCategories: true,
    canManageSettingsUsers: true,
    canManageSalesReps: true,
    canViewAuditLog: true,
  },
  manager: {
    canManageInventory: true,
    canManageTransactions: true,
    canManageRetailPOS: true,
    canManageWholesale: true,
    canManageAccounts: true,
    canViewReports: true,
    canManageSuppliersCategories: true,
    canManageSettingsUsers: false,
    canManageSalesReps: true,
    canViewAuditLog: true,
  },
  staff: {
    canManageInventory: false,
    canManageTransactions: true,
    canManageRetailPOS: true,
    canManageWholesale: false,
    canManageAccounts: false,
    canViewReports: false,
    canManageSuppliersCategories: false,
    canManageSettingsUsers: false,
    canManageSalesReps: false,
    canViewAuditLog: false,
  }
};

export const DEFAULT_WAREHOUSES = ['Main Warehouse', 'Dhaka Depot', 'Showroom'];

export interface SystemSettings {
  storeName: string;
  brandName: string;
  brandShortName: string;
  logoUrl?: string;
  activeTheme?: ThemeId;
  currency: string;
  taxPercentage: number;
  defaultLowStockThreshold: number;
  emailAlerts: boolean;
  autoBatchNumbering: boolean;
  address: string;
  phone: string;
  companyEmail?: string;
  companyWebsite?: string;
  themeMode: 'light' | 'dark';
  warehouses?: string[];
  enforceCreditLimit?: boolean;
  // Firebase Live Sync Properties
  firebaseApiKey?: string;
  firebaseAuthDomain?: string;
  firebaseProjectId?: string;
  firebaseStorageBucket?: string;
  firebaseMessagingSenderId?: string;
  firebaseAppId?: string;
  firebaseConnected?: boolean;
  firebaseLastSync?: string;
  // Dynamic Role Permissions
  rolePermissions?: RolePermissionMap;
}

export const initialSettings: SystemSettings = {
  storeName: 'Smart Stock & Inventory ERP',
  brandName: 'Stock ERP',
  brandShortName: 'ERP',
  logoUrl: '',
  activeTheme: 'emerald-enterprise',
  currency: '৳ (BDT)',
  taxPercentage: 15,
  defaultLowStockThreshold: 10,
  emailAlerts: true,
  autoBatchNumbering: true,
  address: 'Dhaka, Bangladesh',
  phone: '+880 1700-000000',
  companyEmail: '',
  companyWebsite: '',
  themeMode: 'light',
  warehouses: DEFAULT_WAREHOUSES,
  enforceCreditLimit: true,
  firebaseApiKey: '',
  firebaseAuthDomain: '',
  firebaseProjectId: '',
  firebaseStorageBucket: '',
  firebaseMessagingSenderId: '',
  firebaseAppId: '',
  firebaseConnected: false,
  firebaseLastSync: '',
  rolePermissions: defaultRolePermissions,
  ...readEnvFirebaseConfig(),
};

export const initialCategories: Category[] = [];

export const initialSuppliers: Supplier[] = [];

export const initialStockItems: StockItem[] = [];

export const initialTransactions: StockTransaction[] = [];

export interface SystemUser {
  id: string;
  userId: string;
  passwordHash: string;
  name: string;
  role: 'admin' | 'manager' | 'staff' | 'customer';
  status: 'Active' | 'Inactive';
  profilePicUrl?: string;
  wholesalerId?: string;
  email?: string;
  authProvider?: 'local' | 'google';
  signatureDataUrl?: string;
  signatureTitle?: string;
  dashboardWidgets?: {
    buyerRequests?: boolean;
    expiryWatchlist?: boolean;
    salesVsExpenses?: boolean;
    categoryNetProfit?: boolean;
  };
}

export const initialUsers: SystemUser[] = [
  { id: 'USR-1', userId: 'admin', passwordHash: 'admin123', name: 'System Administrator', role: 'admin', status: 'Active' },
  { id: 'USR-2', userId: 'manager', passwordHash: 'manager123', name: 'Branch Manager', role: 'manager', status: 'Active' },
  { id: 'USR-3', userId: 'staff', passwordHash: 'staff123', name: 'Sales Counter Staff', role: 'staff', status: 'Active' }
];

export interface Wholesaler {
  id: string;
  name: string;
  phone: string;
  address: string;
  totalDue: number;
  email?: string;
  shopName?: string;
  creditLimit?: number;
  approvedPrices?: Record<string, number>;
  portalUserId?: string;
  portalStatus?: 'Active' | 'Pending' | 'Inactive';
  salesRepId?: string;
  salesRepName?: string;
}

export type CourierStatus =
  | 'Pending Booking'
  | 'Booked'
  | 'In Transit'
  | 'Out for Delivery'
  | 'Delivered'
  | 'Returned'
  | 'Cancelled';

export interface InvoiceItem {
  itemId: string;
  itemName: string;
  packSize?: string;
  batchNo?: string;
  mfgDate?: string;
  expiryDate?: string;
  retailPrice?: number;
  unitPrice: number;
  quantity: number;
  bonusQty?: number;
  total: number;
}

export interface Invoice {
  id: string;
  chalanNo: string;
  wholesalerId: string;
  wholesalerName: string;
  customerPhone?: string;
  customerAddress?: string;
  saleType?: 'Retail' | 'Wholesale';
  items: InvoiceItem[];
  subTotal?: number;
  previousDue?: number;
  previousDueDate?: string;
  grandTotal?: number;
  discount?: number;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  paymentMethod?: 'Cash' | 'bKash' | 'Nagad' | 'Card';
  date: string;
  orderDate?: string;
  deliveryDate?: string;
  status: 'Paid' | 'Partial' | 'Unpaid';
  courierName?: string;
  courierTrackingNo?: string;
  courierStatus?: CourierStatus;
  courierConsignmentId?: string;
  courierLastSyncedAt?: string;
  totalCartons?: number | string;
  notes?: string;
  paymentBreakdownNotes?: string;
  dispatchBreakdownNotes?: string;
  salesRepId?: string;
  salesRepName?: string;
  warehouseName?: string;
  createdByUserId?: string;
  createdByName?: string;
  authorizedSignatureMode?: 'auto' | 'manual';
  authorizedSignerName?: string;
  authorizedSignerTitle?: string;
  authorizedSignatureDataUrl?: string;
}

export interface AccountTxn {
  id: string;
  date: string;
  type: 'IN' | 'OUT';
  amount: number;
  reference: string;
  description: string;
  wholesalerId?: string;
  supplierId?: string;
  receiptNo?: string;
  paymentMethod?: string;
}

export interface CustomerOrder {
  id: string;
  orderNo: string;
  wholesalerId: string;
  wholesalerName: string;
  customerPhone?: string;
  customerAddress?: string;
  items: InvoiceItem[];
  totalAmount: number;
  advanceSubmitted?: number;
  paymentMethod?: string;
  paymentRef?: string;
  status: 'Pending Approval' | 'Approved' | 'Packed' | 'Dispatched' | 'Delivered' | 'Cancelled';
  courierName?: string;
  courierTrackingNo?: string;
  courierStatus?: CourierStatus;
  courierConsignmentId?: string;
  courierLastSyncedAt?: string;
  totalCartons?: string;
  linkedInvoiceId?: string;
  linkedChalanNo?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
  deliveredAt?: string;
  salesRepId?: string;
  salesRepName?: string;
}

export interface CustomerReturnItem {
  itemId: string;
  itemName: string;
  packSize?: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface CustomerReturn {
  id: string;
  returnNo: string;
  wholesalerId: string;
  wholesalerName: string;
  invoiceId?: string;
  chalanNo?: string;
  items: CustomerReturnItem[];
  totalCreditAmount: number;
  reason: string;
  notes?: string;
  status: 'Requested' | 'Approved' | 'Credited' | 'Rejected';
  createdAt: string;
  resolvedAt?: string;
}

export interface PaymentClaim {
  id: string;
  claimNo: string;
  wholesalerId: string;
  wholesalerName: string;
  amount: number;
  paymentMethod: 'bKash' | 'Nagad' | 'Bank Transfer' | 'Cash';
  trxId: string;
  paymentDate: string;
  slipImageUrl?: string;
  notes?: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  receiptNo?: string;
  adminNotes?: string;
  createdAt: string;
  resolvedAt?: string;
}

export interface SalesRep {
  id: string;
  name: string;
  phone: string;
  area: string;
  commissionRate: number;
  monthlyTarget: number;
  status: 'Active' | 'Inactive';
}

export interface StockTransfer {
  id: string;
  transferNo: string;
  itemId: string;
  itemName: string;
  sku: string;
  fromWarehouse: string;
  toWarehouse: string;
  quantity: number;
  date: string;
  user: string;
  notes?: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: string;
  action: string;
  module:
    | 'Inventory'
    | 'Sales'
    | 'Accounts'
    | 'Buyers'
    | 'Portal'
    | 'Transfers'
    | 'SalesReps'
    | 'Settings'
    | 'Users';
  targetId?: string;
  details: string;
}

export interface Expense {
  id: string;
  category: string;
  amount: number;
  date: string;
  description: string;
  user: string;
}

export interface PurchaseOrderItem {
  itemId: string;
  itemName: string;
  quantity: number;
  costPrice: number;
  total: number;
}

export interface PurchaseOrder {
  id: string;
  poNo: string;
  supplierName: string;
  supplierPhone?: string;
  items: PurchaseOrderItem[];
  totalAmount: number;
  date: string;
  status: 'Draft' | 'Sent' | 'Received' | 'Cancelled';
  notes?: string;
}

export interface PurchaseBillItem {
  itemId: string;
  itemName: string;
  sku: string;
  category?: string;
  batchNo?: string;
  mfgDate?: string;
  expiryDate?: string;
  quantity: number;
  bonusQty?: number;
  costPrice: number;
  total: number;
}

export interface PurchaseBill {
  id: string;
  billNo: string;
  supplierId?: string;
  supplierName: string;
  supplierPhone?: string;
  warehouseName?: string;
  date: string;
  items: PurchaseBillItem[];
  subTotal: number;
  discount?: number;
  transportCost?: number;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  paymentMethod?: 'Cash' | 'bKash' | 'Nagad' | 'Bank Transfer' | 'Card';
  status: 'Paid' | 'Partial' | 'Unpaid';
  notes?: string;
  createdByName?: string;
}

export interface PurchaseReturnItem {
  itemId: string;
  itemName: string;
  sku?: string;
  quantity: number;
  costPrice: number;
  total: number;
}

export interface PurchaseReturn {
  id: string;
  returnNo: string;
  purchaseBillId?: string;
  billNo?: string;
  supplierId?: string;
  supplierName: string;
  warehouseName?: string;
  date: string;
  items: PurchaseReturnItem[];
  totalAmount: number;
  reason: string;
  notes?: string;
  createdByName?: string;
}

export interface SupplierPayment {
  id: string;
  receiptNo: string;
  supplierId: string;
  supplierName: string;
  date: string;
  amount: number;
  paymentMethod: 'Cash' | 'bKash' | 'Nagad' | 'Bank Transfer' | 'Card';
  reference?: string;
  notes?: string;
  createdByName?: string;
}

export interface DamagedStock {
  id: string;
  itemId: string;
  itemName: string;
  sku: string;
  quantity: number;
  unit: string;
  reason: 'Expired' | 'Damaged' | 'Broken' | 'Lost';
  costValue: number;
  date: string;
  user: string;
  notes?: string;
}

export interface LoyaltyCustomer {
  id: string;
  name: string;
  phone: string;
  points: number;
  totalSpent: number;
  lastVisit: string;
}

export const initialWholesalers: Wholesaler[] = [];
export const initialInvoices: Invoice[] = [];
export const initialAccountTxns: AccountTxn[] = [];
export const initialExpenses: Expense[] = [];
export const initialPurchaseOrders: PurchaseOrder[] = [];
export const initialPurchaseBills: PurchaseBill[] = [];
export const initialPurchaseReturns: PurchaseReturn[] = [];
export const initialSupplierPayments: SupplierPayment[] = [];
export const initialDamagedStock: DamagedStock[] = [];
export const initialLoyaltyCustomers: LoyaltyCustomer[] = [];
export const initialCustomerOrders: CustomerOrder[] = [];
export const initialCustomerReturns: CustomerReturn[] = [];
export const initialPaymentClaims: PaymentClaim[] = [];
export const initialSalesReps: SalesRep[] = [];
export const initialStockTransfers: StockTransfer[] = [];
export const initialAuditLogs: AuditLogEntry[] = [];
