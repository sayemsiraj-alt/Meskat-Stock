import React from 'react';
import { 
  LayoutDashboard, 
  FileBarChart2, 
  PackageSearch, 
  ArrowLeftRight, 
  Users, 
  FolderTree, 
  Settings, 
  LogOut,
  BadgeAlert,
  X,
  Briefcase,
  ShoppingCart,
  Wallet,
  Store,
  Receipt,
  FileCheck2,
  Clock,
  ChevronRight,
  ShieldCheck,
  Award,
  ShieldAlert,
  Truck
} from 'lucide-react';
import { CompanyLogo } from './CompanyLogo';
import { RolePermissions, SystemUser } from '../data/mockData';
import { getThemeConfig, ThemeId } from '../utils/themeConfig';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  onLogout: () => void;
  userName: string;
  userRole: string;
  currentUser?: SystemUser;
  lowStockCount: number;
  isOpen: boolean;
  onClose: () => void;
  brandName: string;
  brandShortName: string;
  logoUrl?: string;
  permissions?: RolePermissions;
  activeTheme?: ThemeId;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  onLogout,
  userName,
  userRole,
  currentUser,
  lowStockCount,
  isOpen,
  onClose,
  brandName,
  brandShortName,
  logoUrl,
  permissions,
  activeTheme
}) => {
  const theme = getThemeConfig(activeTheme);
  const sections = [
    {
      title: "Overview & Terminal",
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, perm: true },
        { id: 'pos', label: 'Retail POS Counter', icon: Store, perm: permissions ? permissions.canManageRetailPOS : true },
        { id: 'sales', label: 'Wholesale Chalans', icon: ShoppingCart, perm: permissions ? permissions.canManageWholesale : true },
        { id: 'courier-dispatch', label: 'Courier & Dispatch', icon: Truck, perm: permissions ? permissions.canManageWholesale : true },
        { id: 'wholesalers', label: 'Wholesale Buyers', icon: Briefcase, perm: permissions ? permissions.canManageWholesale : true },
      ]
    },
    {
      title: "Finance & Reports",
      items: [
        { id: 'accounts', label: 'Accounts & Ledger', icon: Wallet, perm: permissions ? permissions.canManageAccounts : true },
        { id: 'expenses', label: 'Expenses & Profit', icon: Receipt, perm: permissions ? permissions.canManageAccounts : true },
        { id: 'sales-reps', label: 'SR & Commissions', icon: Award, perm: permissions ? (permissions.canManageSalesReps ?? permissions.canManageWholesale) : true },
        { id: 'reports', label: 'Executive Reports', icon: FileBarChart2, perm: permissions ? permissions.canViewReports : true },
      ]
    },
    {
      title: "Stock & Logistics",
      items: [
        { id: 'inventory', label: 'Inventory Items', icon: PackageSearch, badge: lowStockCount > 0 ? lowStockCount : undefined, perm: true },
        { id: 'transactions', label: 'Stock Transactions', icon: ArrowLeftRight, perm: permissions ? permissions.canManageTransactions : true },
        { id: 'purchase-orders', label: 'Purchase Orders (PO)', icon: FileCheck2, perm: permissions ? permissions.canManageInventory : true },
        { id: 'expiry-damage', label: 'Expiry & Damaged', icon: Clock, perm: permissions ? permissions.canManageInventory : true },
        { id: 'suppliers', label: 'Suppliers & Vendors', icon: Users, perm: permissions ? permissions.canManageSuppliersCategories : true },
        { id: 'categories', label: 'Categories & Aisles', icon: FolderTree, perm: permissions ? permissions.canManageSuppliersCategories : true },
      ]
    },
    {
      title: "System Config",
      items: [
        { id: 'audit-log', label: 'Audit Log', icon: ShieldAlert, perm: permissions ? (permissions.canViewAuditLog ?? permissions.canManageSettingsUsers) : true },
        { id: 'settings', label: 'System Settings', icon: Settings, perm: permissions ? permissions.canManageSettingsUsers : true },
      ]
    }
  ];

  const handleTabClick = (tabId: string) => {
    onSelectTab(tabId);
    onClose();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-30 lg:hidden animate-fade-in"
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container */}
      <aside className={`w-64 ${theme.sidebarBgClass} flex flex-col h-[100dvh] fixed left-0 top-0 border-r shadow-2xl z-40 transition-transform duration-300 ease-in-out ${
        isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
        
        {/* Brand / Logo Header */}
        <div className={`p-4 sm:p-5 border-b ${theme.sidebarHeaderBgClass} flex items-center justify-between shrink-0`}>
          <div className="flex items-center gap-3 min-w-0">
            <CompanyLogo className="w-11 h-11 shadow-lg shadow-teal-500/10 border-slate-700" shortName={brandShortName} logoUrl={logoUrl} />
            <div className="min-w-0 flex-1">
              <h1 className="font-extrabold text-base tracking-tight text-white leading-tight truncate">{brandName}</h1>
              <span className="text-[10px] text-teal-400 font-extrabold uppercase tracking-widest block mt-0.5">Enterprise ERP</span>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 lg:hidden transition"
            aria-label="Close Sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Info Capsule */}
        <div className="mx-3.5 my-3 p-3 bg-slate-900/90 rounded-2xl border border-slate-800 flex items-center gap-3 shrink-0 shadow-inner">
          <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center font-black text-teal-400 text-xs border border-slate-700 shrink-0 overflow-hidden shadow-xs">
            {currentUser?.profilePicUrl ? (
              <img src={currentUser.profilePicUrl} alt={userName} className="w-full h-full object-cover rounded-xl" />
            ) : (
              userName.charAt(0)
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-white truncate">{userName}</p>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 mt-0.5 text-[9px] uppercase font-bold bg-teal-500/10 text-teal-400 border border-teal-500/20 rounded-md">
              <ShieldCheck className="w-2.5 h-2.5" />
              {userRole}
            </span>
          </div>
        </div>

        {/* Navigation Sections */}
        <nav
          className="flex-1 px-3 py-1 space-y-4 overflow-y-auto sidebar-scroll"
          style={
            {
              '--sb-track': theme.previewSidebar,
              '--sb-thumb': `${theme.previewAccent}45`,
              '--sb-thumb-hover': `${theme.previewAccent}85`,
            } as React.CSSProperties
          }
        >
          {sections.map((sec, secIdx) => {
            const validItems = sec.items.filter(i => i.perm !== false);
            if (validItems.length === 0) return null;

            return (
              <div key={secIdx} className="space-y-1">
                <div className="text-[9px] font-extrabold uppercase tracking-widest text-slate-500 px-3 py-1">
                  {sec.title}
                </div>
                {validItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleTabClick(item.id)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 group ${
                        isActive 
                          ? theme.sidebarActivePillClass 
                          : theme.sidebarHoverClass
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`w-4 h-4 transition-transform group-hover:scale-110 ${
                          isActive ? theme.sidebarActiveTextClass : 'opacity-70 group-hover:opacity-100'
                        }`} />
                        <span className="truncate">{item.label}</span>
                      </div>

                      {item.badge ? (
                        <span className="px-2 py-0.5 bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-full text-[10px] font-extrabold animate-pulse flex items-center gap-1 shrink-0">
                          <BadgeAlert className="w-2.5 h-2.5" />
                          {item.badge}
                        </span>
                      ) : isActive ? (
                        <ChevronRight className={`w-3.5 h-3.5 opacity-80 ${theme.sidebarActiveTextClass}`} />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* Low Stock Quick Warning Pill */}
        {lowStockCount > 0 && (
          <div className="mx-3.5 my-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-200 text-xs shrink-0">
            <p className="font-extrabold flex items-center gap-1.5 text-amber-300 text-[11px] mb-0.5">
              <BadgeAlert className="w-3.5 h-3.5 shrink-0" /> Reorder Alert
            </p>
            <p className="text-[10px] text-slate-300 font-medium leading-normal">
              {lowStockCount} items below threshold limits
            </p>
          </div>
        )}

        {/* Logout Footer */}
        <div className="p-3.5 border-t border-slate-800/80 bg-slate-950 shrink-0">
          <button
            onClick={() => {
              onClose();
              onLogout();
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-rose-500/20 hover:text-rose-300 hover:border-rose-500/30 rounded-xl text-xs font-bold text-slate-300 border border-slate-800 transition duration-200"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout Session</span>
          </button>
        </div>

      </aside>
    </>
  );
};
