import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Bell, 
  Search, 
  Calendar, 
  ShieldCheck, 
  Menu, 
  LogOut, 
  Settings, 
  AlertTriangle, 
  CheckCircle2,
  Key,
  User,
  X,
  Lock,
  ShoppingBag,
  Receipt,
  Clock,
  Activity,
  PenTool,
  ArrowLeft
} from 'lucide-react';
import { CompanyLogo } from './CompanyLogo';
import { SignaturePadModal } from './SignaturePadModal';
import { PWAInstallButton } from './PWAComponents';
import {
  AuditLogEntry,
  CustomerOrder,
  CustomerReturn,
  PaymentClaim,
  PurchaseOrder,
  StockItem,
  SystemUser,
  Wholesaler,
} from '../data/mockData';
import { getThemeConfig, ThemeId } from '../utils/themeConfig';
import {
  buildSystemNotifications,
  NotificationCategory,
} from '../utils/erpNotifications';

interface HeaderProps {
  currentTab: string;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  userName: string;
  userRole: string;
  currentUser?: SystemUser;
  onUpdateProfile?: (updatedUser: SystemUser) => void;
  storeName: string;
  brandName?: string;
  brandShortName: string;
  logoUrl?: string;
  systemDate: string;
  onSystemDateChange: (newDate: string) => void;
  onToggleSidebar: () => void;
  onLogout: () => void;
  onSelectTab: (tab: string) => void;
  lowStockCount: number;
  items?: StockItem[];
  customerOrders?: CustomerOrder[];
  paymentClaims?: PaymentClaim[];
  customerReturns?: CustomerReturn[];
  wholesalers?: Wholesaler[];
  purchaseOrders?: PurchaseOrder[];
  auditLogs?: AuditLogEntry[];
  activeTheme?: ThemeId;
  canGoBack?: boolean;
  onGoBack?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  searchQuery,
  onSearchChange,
  userName,
  userRole,
  currentUser,
  onUpdateProfile,
  storeName,
  brandName,
  brandShortName,
  logoUrl,
  systemDate,
  onSystemDateChange,
  onToggleSidebar,
  onLogout,
  onSelectTab,
  lowStockCount,
  items = [],
  customerOrders = [],
  paymentClaims = [],
  customerReturns = [],
  wholesalers = [],
  purchaseOrders = [],
  auditLogs = [],
  activeTheme,
  canGoBack = false,
  onGoBack,
}) => {
  const theme = getThemeConfig(activeTheme);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifFilter, setNotifFilter] = useState<'all' | NotificationCategory>('all');
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const systemNotifications = useMemo(
    () =>
      buildSystemNotifications({
        items,
        customerOrders,
        paymentClaims,
        customerReturns,
        wholesalers,
        purchaseOrders,
        auditLogs,
        referenceDate: systemDate,
      }),
    [
      items,
      customerOrders,
      paymentClaims,
      customerReturns,
      wholesalers,
      purchaseOrders,
      auditLogs,
      systemDate,
    ]
  );

  const urgentAlertCount = useMemo(
    () =>
      systemNotifications.filter(
        (n) => n.severity === 'urgent' || n.severity === 'warning'
      ).length,
    [systemNotifications]
  );

  const badgeCount = Math.max(urgentAlertCount, lowStockCount);
  const filteredNotifications = useMemo(
    () =>
      notifFilter === 'all'
        ? systemNotifications
        : systemNotifications.filter((n) => n.category === notifFilter),
    [systemNotifications, notifFilter]
  );
  
  // Profile Modal State
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [editName, setEditName] = useState(currentUser?.name || userName);
  const [editUserId, setEditUserId] = useState(currentUser?.userId || '');
  const [editPassword, setEditPassword] = useState(currentUser?.passwordHash || '');
  const [editProfilePic, setEditProfilePic] = useState(currentUser?.profilePicUrl || '');
  const [editSignatureDataUrl, setEditSignatureDataUrl] = useState(currentUser?.signatureDataUrl || '');
  const [editSignatureTitle, setEditSignatureTitle] = useState(currentUser?.signatureTitle || '');
  const [isProfileSignModalOpen, setIsProfileSignModalOpen] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');

  const openProfileModal = () => {
    setEditName(currentUser?.name || userName);
    setEditUserId(currentUser?.userId || '');
    setEditPassword(currentUser?.passwordHash || '');
    setEditProfilePic(currentUser?.profilePicUrl || '');
    setEditSignatureDataUrl(currentUser?.signatureDataUrl || '');
    setEditSignatureTitle(currentUser?.signatureTitle || '');
    setProfileMsg('');
    setIsProfileModalOpen(true);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUserId.trim() || !editPassword.trim()) {
      setProfileMsg('User ID and Password cannot be empty.');
      return;
    }

    if (currentUser && onUpdateProfile) {
      onUpdateProfile({
        ...currentUser,
        name: editName.trim() || userName,
        userId: editUserId.trim(),
        passwordHash: editPassword.trim(),
        profilePicUrl: editProfilePic,
        signatureDataUrl: editSignatureDataUrl || undefined,
        signatureTitle: editSignatureTitle.trim() || undefined,
      });
      setProfileMsg('User Profile, ID, Password & Signature updated successfully!');
      setTimeout(() => {
        setProfileMsg('');
        setIsProfileModalOpen(false);
      }, 1500);
    } else {
      setIsProfileModalOpen(false);
    }
  };

  const notifRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdowns if clicked outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getTabTitle = () => {
    switch (currentTab) {
      case 'dashboard': return 'Central Stock Dashboard';
      case 'pos': return 'Retail POS Counter Sales (খুচরা বিক্রয়)';
      case 'sales': return 'Wholesale Sales & Chalans';
      case 'courier-dispatch': return 'Courier & Dispatch Management';
      case 'wholesalers': return 'Wholesale Customers';
      case 'accounts': return 'Accounts & Ledgers';
      case 'expenses': return 'Expense Management & Net Profit';
      case 'purchase-orders': return 'Automated Purchase Orders (PO)';
      case 'expiry-damage': return 'Expiry Tracker & Damaged Stock';
      case 'reports': return 'Stock Reports & Summary';
      case 'inventory': return 'Inventory Management';
      case 'transactions': return 'Stock Transactions & Logging';
      case 'suppliers': return 'Suppliers & Distributors';
      case 'categories': return 'Categories & Storage Aisles';
      case 'sales-reps': return 'Sales Representatives (SR) & Commissions';
      case 'audit-log': return 'System Activity & Audit Log';
      case 'settings': return 'System Settings & Config';
      default: return brandName || storeName || 'Stock Management System';
    }
  };

  return (
    <>
    <header className={`h-16 ${theme.headerBgClass} border-b px-3 sm:px-6 flex items-center justify-between gap-2 sticky top-0 z-20 shadow-xs`}>
      {/* Left side: Hamburger (Mobile) + Title */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="p-2 text-slate-600 hover:text-slate-900 lg:hidden rounded-xl hover:bg-slate-100 transition shrink-0"
          aria-label="Toggle Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {canGoBack && onGoBack && (
          <button
            type="button"
            onClick={onGoBack}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-950 text-xs font-bold transition cursor-pointer shrink-0"
            title="Go Back to Previous Page"
            aria-label="Go Back to Previous Page"
          >
            <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">Back</span>
          </button>
        )}

        <div className="min-w-0">
          <h2 className={`text-sm sm:text-lg font-black ${theme.headerTitleClass} tracking-tight truncate`}>
            {getTabTitle()}
          </h2>
          <div className="text-xs text-slate-500 font-semibold hidden sm:flex items-center gap-1.5">
            <CompanyLogo className="w-4.5 h-4.5 border-teal-200" shortName={brandShortName} logoUrl={logoUrl} />
            <span className="truncate max-w-[200px]">{storeName}</span>
          </div>
        </div>
      </div>

      {/* Right side controls */}
      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
        <PWAInstallButton
          variant="compact"
          brandName={brandName}
          brandShortName={brandShortName}
          storeName={storeName}
          logoUrl={logoUrl}
        />
        {/* Global Search bar (Desktop / Tablet) */}
        <div className="relative hidden sm:block sm:w-52 md:w-64">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-3 text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
            placeholder="Search items..."
          />
        </div>

        {/* Mobile Search Toggle Button */}
        <button
          type="button"
          onClick={() => setShowMobileSearch(prev => !prev)}
          aria-label="Toggle Search"
          className={`sm:hidden w-8 h-8 rounded-xl flex items-center justify-center transition ${
            showMobileSearch || searchQuery
              ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-400'
              : 'bg-slate-100 text-slate-600'
          }`}
        >
          <Search className="w-4 h-4" />
        </button>

        {/* Date capsule / System Date selector */}
        <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200/80 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 transition" title="Working System Date (Click to change)">
          <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <input
            type="date"
            value={systemDate}
            onChange={(e) => onSystemDateChange(e.target.value)}
            className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
          />
        </div>

        {/* Notification Bell Dropdown (Visible on all Mobile & Desktop screens) */}
        <div className="relative" ref={notifRef}>
          <button 
            type="button"
            onClick={() => {
              setShowNotifications(prev => !prev);
              setShowUserMenu(false);
            }}
            aria-label="View Notifications"
            className={`relative w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center transition cursor-pointer ${
              showNotifications 
                ? 'bg-emerald-50 text-emerald-600 ring-2 ring-emerald-500/20' 
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
            title="View Notifications"
          >
            <Bell className="w-4 h-4" />
            {badgeCount > 0 ? (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-rose-600 text-white text-[10px] font-black rounded-full ring-2 ring-white flex items-center justify-center">
                {badgeCount > 99 ? '99+' : badgeCount}
              </span>
            ) : (
              <span className="absolute top-1 right-1 w-2 h-2 bg-emerald-500 rounded-full ring-2 ring-white"></span>
            )}
          </button>

          {/* Popover notifications (Full-width responsive on Mobile, right-aligned on Desktop) */}
          {showNotifications && (
            <div className="fixed left-3 right-3 top-16 sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-50">
              <div className="p-3 bg-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-extrabold">All Notifications &amp; Alerts</span>
                </div>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                  badgeCount > 0 ? 'bg-rose-500 text-white' : 'bg-emerald-500/20 text-emerald-300'
                }`}>
                  {badgeCount > 0 ? `${badgeCount} Active Alerts` : `${systemNotifications.length} Total`}
                </span>
              </div>

              {/* Filter Chips */}
              <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-1 overflow-x-auto text-[11px] font-bold">
                {(
                  [
                    { id: 'all', label: `All (${systemNotifications.length})` },
                    { id: 'buyer', label: 'Buyers' },
                    { id: 'stock', label: 'Stock/Expiry' },
                    { id: 'finance', label: 'Finance' },
                    { id: 'activity', label: 'Activity' },
                  ] as const
                ).map((chip) => (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => setNotifFilter(chip.id)}
                    className={`px-2.5 py-1 rounded-lg whitespace-nowrap transition cursor-pointer ${
                      notifFilter === chip.id
                        ? 'bg-slate-900 text-white'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>

              <div className="max-h-[58vh] sm:max-h-80 overflow-y-auto divide-y divide-slate-100 text-xs">
                {filteredNotifications.length === 0 ? (
                  <div className="p-6 text-center text-slate-400">
                    <CheckCircle2 className="w-7 h-7 text-emerald-500 mx-auto mb-1.5" />
                    <p className="font-bold text-slate-700 text-xs">All Caught Up</p>
                    <p className="text-[11px] mt-0.5">No pending notifications in this filter.</p>
                  </div>
                ) : (
                  filteredNotifications.map((notif) => {
                    const iconEl =
                      notif.category === 'buyer' ? (
                        <ShoppingBag className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      ) : notif.category === 'finance' ? (
                        <Receipt className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      ) : notif.category === 'stock' ? (
                        notif.severity === 'urgent' ? (
                          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        ) : (
                          <Clock className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                        )
                      ) : (
                        <Activity className="w-4 h-4 text-cyan-600 shrink-0 mt-0.5" />
                      );

                    return (
                      <button
                        key={notif.id}
                        type="button"
                        onClick={() => {
                          onSelectTab(notif.targetTab);
                          setShowNotifications(false);
                        }}
                        className={`w-full text-left p-3 hover:bg-slate-50 cursor-pointer flex items-start gap-2.5 transition ${
                          notif.severity === 'urgent'
                            ? 'bg-rose-50/50'
                            : notif.severity === 'warning'
                            ? 'bg-amber-50/40'
                            : 'bg-white'
                        }`}
                      >
                        {iconEl}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-extrabold text-slate-900 text-xs truncate">
                              {notif.title}
                            </p>
                            {notif.badge && (
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase shrink-0 ${
                                notif.severity === 'urgent'
                                  ? 'bg-rose-100 text-rose-700'
                                  : notif.severity === 'warning'
                                  ? 'bg-amber-100 text-amber-800'
                                  : notif.severity === 'success'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-slate-100 text-slate-600'
                              }`}>
                                {notif.badge}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">
                            {notif.message}
                          </p>
                          <span className="text-[10px] text-slate-400 font-semibold block mt-1">
                            {notif.timestampLabel} • Tap to open
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              <div className="p-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    onSelectTab('audit-log');
                    setShowNotifications(false);
                  }}
                  className="text-[11px] text-emerald-700 hover:underline font-extrabold cursor-pointer"
                >
                  Open Full Audit Log →
                </button>
                <button 
                  type="button"
                  onClick={() => setShowNotifications(false)}
                  className="text-[11px] text-slate-500 hover:text-slate-800 font-bold cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="h-5 w-px bg-slate-200 hidden sm:block"></div>

        {/* User profile with 'A' Icon Dropdown Menu */}
        <div className="relative" ref={userMenuRef}>
          <button 
            onClick={() => {
              setShowUserMenu(prev => !prev);
              setShowNotifications(false);
            }}
            className="flex items-center gap-2 text-left rounded-xl hover:bg-slate-50 p-1 transition"
            title="User Options"
          >
            <div className="hidden md:block text-right">
              <span className="text-xs font-bold text-slate-800 block truncate max-w-[100px]">
                {userName.split(' ')[0]}
              </span>
              <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-0.5 justify-end uppercase">
                <ShieldCheck className="w-2.5 h-2.5 inline" /> {userRole}
              </span>
            </div>

            {/* Avatar block with letter or picture */}
            <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-cyan-600 text-white font-bold flex items-center justify-center text-xs shadow-xs ring-2 overflow-hidden ${
              showUserMenu ? 'ring-emerald-500' : 'ring-transparent'
            }`}>
              {currentUser?.profilePicUrl ? (
                <img src={currentUser.profilePicUrl} alt={userName} className="w-full h-full object-cover rounded-xl" />
              ) : (
                userName.charAt(0)
              )}
            </div>
          </button>

          {/* User Popover menu */}
          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden animate-fade-in z-30 py-1">
              {/* Profile Overview */}
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
                <p className="text-xs font-bold text-slate-900 truncate">{userName}</p>
                <p className="text-[10px] font-semibold text-slate-500 uppercase mt-0.5">Role: {userRole}</p>
              </div>

              {/* Menu items */}
              <div className="py-1">
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    openProfileModal();
                  }}
                  className="w-full px-4 py-2 text-left text-xs text-emerald-700 font-bold hover:bg-emerald-50 flex items-center gap-2 transition"
                >
                  <Key className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Change My User ID & Password</span>
                </button>

                <button
                  onClick={() => {
                    onSelectTab('settings');
                    setShowUserMenu(false);
                  }}
                  className="w-full px-4 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 hover:text-slate-900 font-medium flex items-center gap-2 transition"
                >
                  <Settings className="w-3.5 h-3.5 text-slate-400" />
                  <span>System Settings</span>
                </button>
              </div>

              <div className="border-t border-slate-100 py-1">
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    onLogout();
                  }}
                  className="w-full px-4 py-2 text-left text-xs text-rose-600 hover:bg-rose-50 font-bold flex items-center gap-2 transition"
                >
                  <LogOut className="w-3.5 h-3.5 text-rose-500" />
                  <span>Log Out Session</span>
                </button>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* --- USER CHANGE USER ID & PASSWORD MODAL --- */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-sm w-full p-6 space-y-4 text-slate-900">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 font-extrabold text-slate-800 text-base">
                <Lock className="w-4 h-4 text-emerald-600" />
                <span>Change User ID & Password</span>
              </div>
              <button
                type="button"
                onClick={() => setIsProfileModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {profileMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{profileMsg}</span>
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-4">
              {/* Profile Photo Upload */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center font-bold text-white text-base border border-slate-300 shrink-0 overflow-hidden">
                  {editProfilePic ? (
                    <img src={editProfilePic} alt="Profile Preview" className="w-full h-full object-cover rounded-full" />
                  ) : (
                    editName.charAt(0) || 'U'
                  )}
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <label className="block text-[10px] font-bold text-slate-700 uppercase">Profile Picture (Photo)</label>
                  <label className="cursor-pointer bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold transition inline-block">
                    <span>📁 Choose Image File</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (evt) => {
                            if (evt.target?.result) {
                              setEditProfilePic(evt.target.result as string);
                            }
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                  {editProfilePic && (
                    <button
                      type="button"
                      onClick={() => setEditProfilePic('')}
                      className="text-[10px] text-rose-600 font-bold ml-2 hover:underline inline"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Your Full Name</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <User className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-3 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Login User ID</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <User className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type="text"
                    required
                    value={editUserId}
                    onChange={(e) => setEditUserId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-3 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="Enter new User ID"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Login Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Key className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type="text"
                    required
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-3 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="Enter new Password"
                  />
                </div>
              </div>

              {/* Authorized Signature Preview & Setup */}
              <div className="bg-indigo-50/70 p-3 rounded-xl border border-indigo-200 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-extrabold text-indigo-900 uppercase">
                    Authorized Invoice Signature
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsProfileSignModalOpen(true)}
                    className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <PenTool className="w-3 h-3" />
                    <span>{editSignatureDataUrl ? 'Edit / Redraw' : 'Set / Draw Sign'}</span>
                  </button>
                </div>
                <div className="bg-white border border-indigo-100 rounded-lg p-2 flex items-center justify-between min-h-[44px]">
                  {editSignatureDataUrl ? (
                    <img src={editSignatureDataUrl} alt="Saved Signature" className="h-9 max-w-[140px] object-contain" />
                  ) : (
                    <span className="font-serif italic font-bold text-sm text-indigo-900">
                      {editName || userName}
                    </span>
                  )}
                  <span className="text-[10px] font-bold text-slate-500 truncate max-w-[130px]">
                    {editSignatureDataUrl ? 'Manual Ink Saved' : `Auto (@${editUserId || currentUser?.userId || 'user'})`}
                  </span>
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsProfileModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-extrabold text-xs rounded-xl shadow-xs transition"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isProfileSignModalOpen && (
        <SignaturePadModal
          title="My Default Authorized Signature"
          initialMode={editSignatureDataUrl ? 'manual' : 'auto'}
          defaultUserName={editName || userName}
          defaultUserId={editUserId || currentUser?.userId}
          initialSignerName={editName || userName}
          initialSignerTitle={editSignatureTitle}
          initialSignatureDataUrl={editSignatureDataUrl}
          onSave={(payload) => {
            setEditName(payload.signerName);
            setEditSignatureTitle(payload.signerTitle || '');
            setEditSignatureDataUrl(payload.mode === 'manual' ? payload.signatureDataUrl || '' : '');
            setIsProfileSignModalOpen(false);
          }}
          onClose={() => setIsProfileSignModalOpen(false)}
        />
      )}
    </header>

      {/* Collapsible Mobile Search Bar */}
      {showMobileSearch && (
        <div className="sm:hidden bg-white border-b border-slate-200 px-3 py-2.5 shadow-xs z-10">
          <div className="relative flex items-center gap-2">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Search className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                autoFocus
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-8 text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                placeholder="Search products, invoices, buyers..."
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => onSearchChange('')}
                  aria-label="Clear search"
                  className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-700"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowMobileSearch(false)}
              className="px-2.5 py-2 text-xs font-bold text-slate-600 bg-slate-100 rounded-xl shrink-0"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </>
  );
};
