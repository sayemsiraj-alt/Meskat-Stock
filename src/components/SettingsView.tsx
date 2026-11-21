import React, { useEffect, useState } from 'react';
import { SystemSettings, SystemUser, RolePermissions, defaultRolePermissions, DEFAULT_WAREHOUSES } from '../data/mockData';
import { Save, Building, DollarSign, Percent, RefreshCw, Shield, UserPlus, Edit2, Flame, CheckCircle2, Wifi, WifiOff, AlertOctagon, Lock, Trash2, DownloadCloud, UploadCloud, FileJson, FileSpreadsheet, DatabaseBackup, Palette, Check, Sparkles, Warehouse, Plus, X, Copy, Link2, Globe } from 'lucide-react';
import { testFirebaseConnection } from '../utils/firebaseService';
import {
  buildFirebaseRuntimeConfigJson,
  buildNetlifyEnvSnippet,
  encodeFirebaseShareParam,
  extractFirebaseConfigFromInput,
  hasFirebaseCredentials,
  parseFirebaseConfigSnippet,
} from '../utils/firebaseConfigHelpers';
import { compressLogoDataUrl } from '../utils/imageHelpers';
import { SYSTEM_THEMES, ThemeId } from '../utils/themeConfig';
import { PWAInstallButton } from './PWAComponents';

interface SettingsViewProps {
  settings: SystemSettings;
  onUpdateSettings: (
    newSettings: SystemSettings
  ) => Promise<{ success: boolean; error?: string }> | void;
  onConnectFirebase?: (
    targetSettings: SystemSettings
  ) => Promise<{ success: boolean; message: string; syncedSettings?: SystemSettings }>;
  onPullFromFirestore?: (
    targetSettings?: SystemSettings
  ) => Promise<{ success: boolean; totalRecords: number; message: string }>;
  onPushToFirestore?: (
    targetSettings?: SystemSettings
  ) => Promise<{ success: boolean; totalUploaded: number; message: string }>;
  users: SystemUser[];
  onAddUser: (user: Omit<SystemUser, 'id'>) => void;
  onUpdateUser: (user: SystemUser) => void;
  onDeleteUser: (id: string) => void;
  currentUserRole: 'admin' | 'manager' | 'staff';
  onResetAllData: () => Promise<void>;
  onExportBackupJSON: () => void;
  onExportBackupCSV: () => void;
  onImportBackupJSON: (backupData: any) => Promise<{ success: boolean; message: string }>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onUpdateSettings,
  onConnectFirebase,
  onPullFromFirestore,
  onPushToFirestore,
  users,
  onAddUser,
  onUpdateUser,
  onDeleteUser,
  currentUserRole,
  onResetAllData,
  onExportBackupJSON,
  onExportBackupCSV,
  onImportBackupJSON
}) => {
  const [formState, setFormState] = useState<SystemSettings>({
    ...settings,
    rolePermissions: settings.rolePermissions || defaultRolePermissions
  });
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    setFormState((prev) => ({
      ...prev,
      ...settings,
      firebaseApiKey: prev.firebaseApiKey || settings.firebaseApiKey,
      firebaseProjectId: prev.firebaseProjectId || settings.firebaseProjectId,
      firebaseAuthDomain: prev.firebaseAuthDomain || settings.firebaseAuthDomain,
      firebaseStorageBucket: prev.firebaseStorageBucket || settings.firebaseStorageBucket,
      firebaseMessagingSenderId:
        prev.firebaseMessagingSenderId || settings.firebaseMessagingSenderId,
      firebaseAppId: prev.firebaseAppId || settings.firebaseAppId,
      rolePermissions: settings.rolePermissions || prev.rolePermissions || defaultRolePermissions,
    }));
  }, [settings]);
  
  // Wipe Reset Confirmation Modal State
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [resetErrorMsg, setResetErrorMsg] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  // Warehouse Manager State
  const [newWarehouseName, setNewWarehouseName] = useState('');

  // Backup & Restore State
  const [isImporting, setIsImporting] = useState(false);
  const [importStatusMsg, setImportStatusMsg] = useState<{ success: boolean; message: string } | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportStatusMsg(null);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const text = evt.target?.result as string;
        const parsed = JSON.parse(text);
        const res = await onImportBackupJSON(parsed);
        setIsImporting(false);
        setImportStatusMsg(res);
      } catch (err: any) {
        setIsImporting(false);
        setImportStatusMsg({
          success: false,
          message: 'Error reading file. Please make sure it is a valid JSON backup file.'
        });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };
  
  // User Modal State
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null);
  
  // User Form
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'admin' | 'manager' | 'staff'>('staff');
  const [status, setStatus] = useState<'Active' | 'Inactive'>('Active');

  // Firebase State
  const [isTestingFirebase, setIsTestingFirebase] = useState(false);
  const [isSyncingFirebase, setIsSyncingFirebase] = useState<'pull' | 'push' | null>(null);
  const [firebaseTestResult, setFirebaseTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [rawConfigSnippet, setRawConfigSnippet] = useState('');

  // Handle Quick Auto-Fill from pasted Firebase SDK Snippet, JSON, Portal Link, or Store Cloud Code
  const handleParseFirebaseSnippet = (text: string) => {
    setRawConfigSnippet(text);
    const parsed =
      extractFirebaseConfigFromInput(text) || parseFirebaseConfigSnippet(text);
    if (!parsed) return;

    setFormState(prev => ({
      ...prev,
      ...parsed,
    }));
  };

  const handleTestAndConnectFirebase = async () => {
    setIsTestingFirebase(true);
    setFirebaseTestResult(null);

    try {
      if (onConnectFirebase) {
        const outcome = await onConnectFirebase(formState);
        setFirebaseTestResult({
          success: outcome.success,
          message: outcome.message,
        });
        if (outcome.success && outcome.syncedSettings) {
          setFormState({
            ...outcome.syncedSettings,
            rolePermissions:
              outcome.syncedSettings.rolePermissions ||
              formState.rolePermissions ||
              defaultRolePermissions,
          });
        } else if (!outcome.success) {
          setFormState((prev) => ({ ...prev, firebaseConnected: false }));
        }
        return;
      }

      const result = await testFirebaseConnection(formState);
      if (!result.success) {
        setFirebaseTestResult(result);
        setFormState((prev) => ({
          ...prev,
          firebaseConnected: false,
        }));
        return;
      }

      const connectedSettings: SystemSettings = {
        ...formState,
        firebaseConnected: true,
        firebaseLastSync: new Date().toISOString(),
      };
      setFormState(connectedSettings);
      await onUpdateSettings(connectedSettings);

      if (onPullFromFirestore) {
        const pullRes = await onPullFromFirestore(connectedSettings);
        setFirebaseTestResult({
          success: true,
          message: `${result.message} ${pullRes.message}`,
        });
      } else {
        setFirebaseTestResult(result);
      }
    } finally {
      setIsTestingFirebase(false);
    }
  };

  const handleManualPullSync = async () => {
    if (!onPullFromFirestore) return;
    setIsSyncingFirebase('pull');
    setFirebaseTestResult(null);
    const targetSettings: SystemSettings = {
      ...formState,
      firebaseConnected: true,
    };
    try {
      const res = await onPullFromFirestore(targetSettings);
      if (res.success) {
        onUpdateSettings({
          ...targetSettings,
          firebaseLastSync: new Date().toISOString(),
        });
      }
      setFirebaseTestResult({
        success: res.success,
        message: res.message,
      });
    } finally {
      setIsSyncingFirebase(null);
    }
  };

  const handleManualPushSync = async () => {
    if (!onPushToFirestore) return;
    setIsSyncingFirebase('push');
    setFirebaseTestResult(null);
    const targetSettings: SystemSettings = {
      ...formState,
      firebaseConnected: true,
    };
    try {
      const res = await onPushToFirestore(targetSettings);
      setFirebaseTestResult({
        success: res.success,
        message: res.message,
      });
    } finally {
      setIsSyncingFirebase(null);
    }
  };

  const handleDisconnectFirebase = () => {
    const disconnected: SystemSettings = {
      ...formState,
      firebaseConnected: false,
    };
    setFormState(disconnected);
    onUpdateSettings(disconnected);
    setFirebaseTestResult({
      success: true,
      message: 'Disconnected from Cloud Live Sync (saved local data remains intact).',
    });
  };

  // Toggle Permission Helper
  const handleTogglePermission = (targetRole: 'manager' | 'staff', permKey: keyof RolePermissions) => {
    setFormState(prev => {
      const currentMap = prev.rolePermissions || defaultRolePermissions;
      const updatedRoleObj = {
        ...currentMap[targetRole],
        [permKey]: !currentMap[targetRole][permKey]
      };
      return {
        ...prev,
        rolePermissions: {
          ...currentMap,
          [targetRole]: updatedRoleObj
        }
      };
    });
  };

  const handleConfirmReset = async () => {
    if (confirmText.trim().toUpperCase() !== 'RESET') {
      setResetErrorMsg('Please type "RESET" in capital letters to confirm.');
      return;
    }

    setResetErrorMsg('');
    setIsResetting(true);
    await onResetAllData();
    setIsResetting(false);
    setIsResetModalOpen(false);
    setConfirmText('');
    setSuccessMsg('All system and cloud data wiped successfully! Software is now fresh and blank.');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => setSuccessMsg(''), 5000);
  };

  const activeWarehouses =
    formState.warehouses && formState.warehouses.length > 0
      ? formState.warehouses
      : DEFAULT_WAREHOUSES;

  const handleAddWarehouse = () => {
    const clean = newWarehouseName.trim();
    if (!clean) return;
    if (activeWarehouses.some(w => w.toLowerCase() === clean.toLowerCase())) {
      setNewWarehouseName('');
      return;
    }
    setFormState(prev => ({
      ...prev,
      warehouses: [...activeWarehouses, clean]
    }));
    setNewWarehouseName('');
  };

  const handleRemoveWarehouse = (whName: string) => {
    if (activeWarehouses.length <= 1) return;
    setFormState(prev => ({
      ...prev,
      warehouses: activeWarehouses.filter(w => w !== whName)
    }));
  };

  const handleChange = (field: keyof SystemSettings, value: string | number | boolean) => {
    setFormState(prev => {
      const updated = {
        ...prev,
        [field]: value
      };
      if (field === 'brandName' && typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed) {
          updated.storeName = `${trimmed} Ltd.`;
          updated.brandShortName = trimmed.split(' ')[0] || trimmed;
        }
      }
      return updated;
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await onUpdateSettings(formState);
    if (res && !res.success && res.error) {
      setSuccessMsg(`Saved locally, but Cloud Sync reported an issue: ${res.error}`);
    } else {
      setSuccessMsg(
        formState.firebaseConnected
          ? 'System Settings, Logo & Brand Name saved and synced to Firebase Cloud!'
          : 'System Settings and Brand Name updated successfully!'
      );
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => {
      setSuccessMsg('');
    }, 4500);
  };

  return (
    <div className="p-6 space-y-6 max-w-[1200px] mx-auto min-h-full">
      
      <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200">
        <h3 className="font-extrabold text-slate-800 text-base">Central Stock Management Configuration</h3>
        <p className="text-xs text-slate-500 mt-0.5">Customize reorder alert levels, billing currency, taxation rates, and automated alerts</p>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-bold animate-fade-in flex items-center gap-2">
          <span>✅ {successMsg}</span>
        </div>
      )}

      <PWAInstallButton
        variant="card"
        brandName={formState.brandName}
        brandShortName={formState.brandShortName}
        storeName={formState.storeName}
        logoUrl={formState.logoUrl}
        activeTheme={formState.activeTheme}
        firebaseProjectId={formState.firebaseProjectId}
      />

      <form onSubmit={handleSave} className="space-y-6">
        
        {/* SECTION 0: SYSTEM UI THEME & EXECUTIVE DESIGN GALLERY */}
        <div className="bg-white p-6 rounded-2xl shadow-xs border border-slate-200 space-y-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-teal-500 to-cyan-500 text-slate-950 flex items-center justify-center font-black shadow-xs">
                <Palette className="w-4.5 h-4.5" />
              </div>
              <div>
                <h4 className="font-extrabold text-slate-900 text-base">System UI Theme & Design Gallery (প্রিমিয়াম থিম গ্যালারি)</h4>
                <p className="text-xs text-slate-500 mt-0.5">Select a luxury theme to instantly change the entire software UI, sidebar, cards & accents</p>
              </div>
            </div>

            <span className="px-3 py-1 bg-teal-50 text-teal-800 border border-teal-200 rounded-xl font-extrabold text-xs flex items-center gap-1.5 shrink-0">
              <Sparkles className="w-3.5 h-3.5 text-teal-600" />
              <span>Live Instant Preview</span>
            </span>
          </div>

          {/* Theme Options Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.values(SYSTEM_THEMES).map((theme) => {
              const isSelected = (formState.activeTheme || 'emerald-enterprise') === theme.id;

              return (
                <div
                  key={theme.id}
                  onClick={() => {
                    const newConfig = { ...formState, activeTheme: theme.id as ThemeId };
                    setFormState(newConfig);
                    onUpdateSettings(newConfig);
                  }}
                  className={`p-4 rounded-2xl border-2 transition-all duration-300 cursor-pointer flex flex-col justify-between space-y-3 relative overflow-hidden group ${
                    isSelected 
                      ? 'border-teal-500 bg-teal-50/20 ring-4 ring-teal-500/10 shadow-md' 
                      : 'border-slate-200 hover:border-slate-300 bg-white hover:shadow-xs'
                  }`}
                >
                  {isSelected && (
                    <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-teal-500 text-slate-950 flex items-center justify-center font-black shadow-xs animate-bounce">
                      <Check className="w-4 h-4" />
                    </div>
                  )}

                  <div className="space-y-1.5 pr-6">
                    <h5 className="font-extrabold text-slate-900 text-sm leading-snug">{theme.name}</h5>
                    <p className="text-[11px] text-slate-500 font-medium leading-relaxed">{theme.tagline}</p>
                  </div>

                  {/* Palette Color Preview Bar */}
                  <div className="bg-slate-100 p-2.5 rounded-xl border border-slate-200/80 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Colors:</span>
                      <div className="flex items-center -space-x-1">
                        <span className="w-5 h-5 rounded-full border border-white shadow-xs inline-block" style={{ backgroundColor: theme.previewSidebar }} title="Sidebar Background"></span>
                        <span className="w-5 h-5 rounded-full border border-white shadow-xs inline-block" style={{ backgroundColor: theme.previewBg }} title="App Background"></span>
                        <span className="w-5 h-5 rounded-full border border-white shadow-xs inline-block" style={{ backgroundColor: theme.previewAccent }} title="Accent Color"></span>
                      </div>
                    </div>

                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md ${
                      isSelected ? 'bg-teal-500 text-slate-950' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {isSelected ? 'ACTIVE' : 'SELECT'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* SECTION 1: Core Stock Rules */}
        <div className="bg-white p-6 rounded-2xl shadow-xs border border-slate-200 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <RefreshCw className="w-4 h-4 text-emerald-600" />
            <h4 className="font-bold text-slate-800 text-sm">Stock Management Features & Alerts</h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Default Low Stock Reorder Threshold (Units)</label>
              <input
                type="number"
                min="1"
                value={formState.defaultLowStockThreshold}
                onChange={(e) => handleChange('defaultLowStockThreshold', parseInt(e.target.value) || 0)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">Triggers low stock warnings across all medicines by default</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Billing Currency Symbol</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <DollarSign className="w-3.5 h-3.5" />
                </div>
                <input
                  type="text"
                  value={formState.currency}
                  onChange={(e) => handleChange('currency', e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-3 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Used in dashboards, intake valuations, and reports</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Default VAT / Tax Rate (%)</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Percent className="w-3.5 h-3.5" />
                </div>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={formState.taxPercentage}
                  onChange={(e) => handleChange('taxPercentage', parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-3 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>
            </div>

            <div className="flex flex-col justify-center space-y-3 pt-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formState.autoBatchNumbering}
                  onChange={(e) => handleChange('autoBatchNumbering', e.target.checked)}
                  className="w-4 h-4 text-emerald-600 bg-slate-100 border-slate-300 rounded focus:ring-emerald-500"
                />
                <span className="text-xs font-bold text-slate-700">Enable Auto Batch & SKU Numbering</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formState.emailAlerts}
                  onChange={(e) => handleChange('emailAlerts', e.target.checked)}
                  className="w-4 h-4 text-emerald-600 bg-slate-100 border-slate-300 rounded focus:ring-emerald-500"
                />
                <span className="text-xs font-bold text-slate-700">Send Email Notifications on Low Stock</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formState.enforceCreditLimit !== false}
                  onChange={(e) => handleChange('enforceCreditLimit', e.target.checked)}
                  className="w-4 h-4 text-emerald-600 bg-slate-100 border-slate-300 rounded focus:ring-emerald-500"
                />
                <span className="text-xs font-bold text-slate-700">Enforce Buyer Credit Limit in Customer Portal</span>
              </label>
            </div>
          </div>

          {/* Multi-Warehouse / Godowns Manager */}
          <div className="pt-4 border-t border-slate-100 space-y-3">
            <div className="flex items-center gap-2">
              <Warehouse className="w-4 h-4 text-cyan-600" />
              <h5 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                Godowns &amp; Warehouse Locations ({activeWarehouses.length})
              </h5>
            </div>

            <div className="flex flex-wrap gap-2">
              {activeWarehouses.map((wh) => (
                <span
                  key={wh}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                >
                  <Warehouse className="w-3 h-3 text-emerald-600" />
                  <span>{wh}</span>
                  {activeWarehouses.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveWarehouse(wh)}
                      aria-label={`Remove ${wh}`}
                      className="text-slate-400 hover:text-rose-600 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </span>
              ))}
            </div>

            <div className="flex items-center gap-2 max-w-md">
              <input
                type="text"
                value={newWarehouseName}
                onChange={(e) => setNewWarehouseName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddWarehouse();
                  }
                }}
                placeholder="Add new godown / depot (e.g. Chittagong Depot)"
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="button"
                onClick={handleAddWarehouse}
                className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>
          </div>
        </div>

        {/* SECTION 2: Organization Info */}
        <div className="bg-white p-6 rounded-2xl shadow-xs border border-slate-200 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Building className="w-4 h-4 text-cyan-600" />
            <h4 className="font-bold text-slate-800 text-sm">Healthcare Organization Information</h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Software / Institution Name</label>
              <input
                type="text"
                value={formState.storeName}
                onChange={(e) => handleChange('storeName', e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">Appears at the header and print reports</p>
            </div>
            
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Brand Name</label>
              <input
                type="text"
                value={formState.brandName}
                onChange={(e) => handleChange('brandName', e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">Global brand name (Login screen, Sidebar)</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Brand Short Text</label>
              <input
                type="text"
                value={formState.brandShortName}
                onChange={(e) => handleChange('brandShortName', e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">Short text for circle logo (e.g. 'Dear')</p>
            </div>

            <div className="md:col-span-2 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Company Custom Logo Image (Upload / URL)</label>
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <input
                  type="text"
                  value={formState.logoUrl || ''}
                  onChange={(e) => handleChange('logoUrl', e.target.value)}
                  placeholder="Paste Image URL (e.g. https://domain.com/logo.png)"
                  className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <span className="text-xs text-slate-400 font-bold uppercase">OR</span>
                <label className="cursor-pointer bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2">
                  <span>📁 Choose Image File</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (!file) return;
                      try {
                        const compressed = await compressLogoDataUrl(file, 256);
                        handleChange('logoUrl', compressed);
                      } catch {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          if (typeof event.target?.result === 'string') {
                            handleChange('logoUrl', event.target.result);
                          }
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                </label>
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5">
                Upload your company logo image from your phone/computer. It will automatically update in the circle across the app, memos, and print copies!
              </p>
              {formState.logoUrl && (
                <div className="mt-3 flex items-center gap-3 pt-3 border-t border-slate-200">
                  <span className="text-xs font-bold text-slate-600">Logo Preview:</span>
                  <div className="w-12 h-12 rounded-full border border-slate-300 p-0.5 bg-white overflow-hidden flex items-center justify-center">
                    <img src={formState.logoUrl} alt="Preview" className="w-full h-full object-contain rounded-full" />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleChange('logoUrl', '')}
                    className="text-xs text-rose-600 font-bold hover:underline"
                  >
                    Reset to Default Calligraphy Logo
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Headquarters / Pharmacy Address</label>
              <input
                type="text"
                value={formState.address}
                onChange={(e) => handleChange('address', e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Central Contact Phone</label>
              <input
                type="text"
                value={formState.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Company Email</label>
              <input
                type="email"
                value={formState.companyEmail || ''}
                onChange={(e) => handleChange('companyEmail', e.target.value)}
                placeholder="e.g. info@yourcompany.com"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">Shown beside phone number on wholesale chalans &amp; invoices</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Company Website</label>
              <input
                type="text"
                value={formState.companyWebsite || ''}
                onChange={(e) => handleChange('companyWebsite', e.target.value)}
                placeholder="e.g. www.yourcompany.com"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">Displayed alongside Company Email on memos &amp; PDFs</p>
            </div>
          </div>
        </div>

        {/* SECTION 3: GOOGLE FIREBASE STORE & LIVE CLOUD SYNC */}
        <div className="bg-white p-6 rounded-2xl shadow-xs border border-slate-200 space-y-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-black">
                <Flame className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <h4 className="font-extrabold text-slate-800 text-sm">Google Firebase Store & Live Cloud Sync (গুগল ফায়ারবেস রিয়েলটাইম সিঙ্ক)</h4>
                <p className="text-xs text-slate-500 mt-0.5">Connect Firebase Firestore database to enable real-time cloud data synchronization</p>
              </div>
            </div>

            <div>
              {formState.firebaseConnected ? (
                <span className="px-3 py-1 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl font-bold text-xs inline-flex items-center gap-1.5">
                  <Wifi className="w-3.5 h-3.5 text-emerald-600" /> Cloud Live Connected
                </span>
              ) : (
                <span className="px-3 py-1 bg-slate-100 text-slate-600 border border-slate-300 rounded-xl font-bold text-xs inline-flex items-center gap-1.5">
                  <WifiOff className="w-3.5 h-3.5 text-slate-400" /> Local Mode (Disconnected)
                </span>
              )}
            </div>
          </div>

          {/* Quick Paste Snippet Box */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
            <label className="block text-xs font-bold text-slate-700 uppercase flex items-center justify-between">
              <span>⚡ Quick Auto-Fill: Paste Firebase SDK Snippet</span>
              <span className="text-[10px] text-amber-600 font-bold lowercase">from Firebase Console -&gt; Project Settings</span>
            </label>
            <textarea
              rows={2}
              value={rawConfigSnippet}
              onChange={(e) => handleParseFirebaseSnippet(e.target.value)}
              placeholder="Paste your const firebaseConfig = { apiKey: '...', projectId: '...' } snippet here..."
              className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
            ></textarea>
            <p className="text-[11px] text-slate-400">
              Pasting your Firebase SDK config code above will automatically populate all fields below!
            </p>
          </div>

          {/* Credentials Inputs Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">API Key (apiKey) *</label>
              <input
                type="text"
                value={formState.firebaseApiKey || ''}
                onChange={(e) => handleChange('firebaseApiKey', e.target.value)}
                placeholder="AIzaSy..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Project ID (projectId) *</label>
              <input
                type="text"
                value={formState.firebaseProjectId || ''}
                onChange={(e) => handleChange('firebaseProjectId', e.target.value)}
                placeholder="my-stock-app-123"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Auth Domain (authDomain)</label>
              <input
                type="text"
                value={formState.firebaseAuthDomain || ''}
                onChange={(e) => handleChange('firebaseAuthDomain', e.target.value)}
                placeholder="my-stock-app-123.firebaseapp.com"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Storage Bucket (storageBucket)</label>
              <input
                type="text"
                value={formState.firebaseStorageBucket || ''}
                onChange={(e) => handleChange('firebaseStorageBucket', e.target.value)}
                placeholder="my-stock-app-123.appspot.com"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Messaging Sender ID (messagingSenderId)</label>
              <input
                type="text"
                value={formState.firebaseMessagingSenderId || ''}
                onChange={(e) => handleChange('firebaseMessagingSenderId', e.target.value)}
                placeholder="1029384756"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">App ID (appId)</label>
              <input
                type="text"
                value={formState.firebaseAppId || ''}
                onChange={(e) => handleChange('firebaseAppId', e.target.value)}
                placeholder="1:1029384756:web:abcd1234"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* Firestore Rules Fix Helper Box */}
          <div className="bg-amber-50/80 p-4 rounded-xl border border-amber-200 space-y-2 text-xs text-amber-900">
            <div className="font-extrabold flex items-center gap-1.5 text-amber-900 text-sm">
              <span>🛠️ "Missing or insufficient permissions" এর সমাধান (Firestore Rules Config)</span>
            </div>
            <p className="text-[11px] text-amber-800 leading-relaxed font-medium">
              ফায়ারবেস কনসোলে বাই ডিফল্ট সিকিউরিটি রুলস প্রাইভেট করা থাকে। এটি ঠিক করার ৩টি সহজ ধাপ:
            </p>
            <ol className="list-decimal pl-5 space-y-1 text-[11px] text-amber-900 font-bold">
              <li>Firebase Console (console.firebase.google.com) ➔ আপনার Firebase Project-এ প্রবেশ করুন।</li>
              <li>বাম দিকের মেনু থেকে <strong>Firestore Database</strong> ➔ অপশনে ক্লিক করে <strong>Rules</strong> ট্যাবে ক্লিক করুন।</li>
              <li>সেখানে নিয়মটি পরিবর্তন করে দিন: <code className="bg-amber-200/80 px-1.5 py-0.5 rounded font-mono text-slate-900">allow read, write: if true;</code> এবং <strong>Publish</strong> বাটনে প্রেস করুন!</li>
            </ol>
          </div>

          {/* Test Result Message Box */}
          {firebaseTestResult && (
            <div className={`p-4 rounded-xl text-xs font-bold border flex items-center gap-2 ${
              firebaseTestResult.success 
                ? 'bg-emerald-50 text-emerald-900 border-emerald-200' 
                : 'bg-rose-50 text-rose-900 border-rose-200'
            }`}>
              {firebaseTestResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <WifiOff className="w-4 h-4 text-rose-600 shrink-0" />}
              <span>{firebaseTestResult.message}</span>
            </div>
          )}

          {/* Action Bar */}
          <div className="pt-2 flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <p className="text-[11px] text-slate-500">
                {formState.firebaseLastSync
                  ? `Last Successful Sync: ${formState.firebaseLastSync.replace('T', ' ').slice(0, 19)}`
                  : 'Not yet synced.'}
              </p>

              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleTestAndConnectFirebase}
                  disabled={isTestingFirebase || isSyncingFirebase !== null}
                  className="w-full sm:w-auto bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-extrabold px-5 py-2.5 rounded-xl text-xs shadow-sm flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  {isTestingFirebase ? (
                    <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
                  ) : (
                    <Flame className="w-4 h-4 shrink-0" />
                  )}
                  <span>
                    {isTestingFirebase
                      ? 'Connecting & Auto-Syncing...'
                      : 'Test & Connect Firebase Cloud'}
                  </span>
                </button>

                {formState.firebaseConnected && (
                  <button
                    type="button"
                    onClick={handleDisconnectFirebase}
                    className="px-3.5 py-2.5 bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200 font-bold rounded-xl text-xs transition cursor-pointer whitespace-nowrap"
                  >
                    Disconnect
                  </button>
                )}
              </div>
            </div>

            {/* Manual Cloud Pull & Push Sync Bar */}
            {(formState.firebaseConnected || hasFirebaseCredentials(formState)) && (
              <div className="space-y-3">
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="text-[11px] text-slate-600 font-medium">
                    <strong className="text-slate-900 block text-xs">
                      Manual Firestore Data Sync (পূর্বের ক্লাউড ডেটা রিস্টোর / ব্যাকআপ)
                    </strong>
                    Pull existing products, invoices &amp; buyers from Firestore or push local records up to the cloud.
                  </div>
                  <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto shrink-0">
                    <button
                      type="button"
                      onClick={handleManualPullSync}
                      disabled={isSyncingFirebase !== null || isTestingFirebase}
                      className="flex-1 sm:flex-none px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs shadow-xs flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap"
                    >
                      {isSyncingFirebase === 'pull' ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
                      ) : (
                        <DownloadCloud className="w-3.5 h-3.5 shrink-0" />
                      )}
                      <span>
                        {isSyncingFirebase === 'pull'
                          ? 'Syncing From Cloud...'
                          : 'Sync Data From Firestore'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={handleManualPushSync}
                      disabled={isSyncingFirebase !== null || isTestingFirebase}
                      className="flex-1 sm:flex-none px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-extrabold rounded-xl text-xs shadow-xs flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap"
                    >
                      {isSyncingFirebase === 'push' ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
                      ) : (
                        <UploadCloud className="w-3.5 h-3.5 shrink-0" />
                      )}
                      <span>
                        {isSyncingFirebase === 'push'
                          ? 'Uploading...'
                          : 'Push Local Data to Firestore'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Multi-Browser, Live Store Link & Vercel / Netlify Deployment Sharing */}
                <div className="p-4 bg-cyan-50/70 border border-cyan-200 rounded-xl space-y-3 text-xs text-cyan-950">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <strong className="font-extrabold text-xs flex items-center gap-1.5 text-cyan-900">
                        <Globe className="w-4 h-4 text-cyan-700 shrink-0" />
                        <span>Multi-Browser &amp; Live Hosting Access (Vercel / Netlify)</span>
                      </strong>
                      <p className="text-[11px] text-cyan-900/85 mt-1 leading-relaxed">
                        অন্য ব্রাউজারে শুধু সাইটের সাধারণ লিংক খুললে নতুন ব্রাউজার জানে না আপনার কোন Firebase প্রজেক্ট কানেক্ট করতে হবে (তাই পুরনো ডেমো দেখায়)। সব ব্রাউজারে আপনার আসল কোম্পানির লোগো, নাম, ডেটা ও ইউজার লগইন পেতে নিচের যেকোনো <b>একটি</b> পদ্ধতি ব্যবহার করুন:
                        <br />
                        <b>১) ইনস্ট্যান্ট লাইভ লিংক (রিবিল্ড ছাড়াই):</b> নিচের <b>Copy Live Store Link</b> কপি করে অন্য যেকোনো ব্রাউজারে পেস্ট করুন — সাথে সাথেই আপনার কোম্পানির লোগো, নাম, প্রোডাক্ট ও আসল ইউজার অ্যাকাউন্ট লোড হবে।
                        <br />
                        <b>২) স্থায়ী সাধারণ ডোমেইন ({typeof window !== 'undefined' ? window.location.hostname : 'your-app.vercel.app'}):</b> সাধারণ লিংক সব ব্রাউজারে কাজ করাতে Vercel (<b>Project Settings → Environment Variables</b>) অথবা Netlify-তে নিচের <b>Copy Hosting .env Vars</b> পেস্ট করে সাইট একবার Redeploy করুন অথবা <b>Download firebase-config.json</b> ফাইলটি <code className="px-1 py-0.5 bg-white border border-cyan-300 rounded font-mono">public/</code> ফোল্ডারে দিয়ে ডিপ্লয় করুন।
                        <br />
                        <b>৩) Google Login চালু রাখতে:</b> Firebase Console → <b>Authentication → Settings → Authorized domains</b>-এ{' '}
                        <code className="px-1.5 py-0.5 bg-white border border-cyan-300 rounded font-mono text-[11px]">
                          {typeof window !== 'undefined' ? window.location.hostname : 'your-app.vercel.app'}
                        </code>{' '}
                        ডোমেইনটি যোগ করুন।
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={async () => {
                        const encoded = encodeFirebaseShareParam(formState);
                        const origin = typeof window !== 'undefined' ? window.location.origin : '';
                        const shareUrl = `${origin}/?fb=${encoded}`;
                        try {
                          await navigator.clipboard.writeText(shareUrl);
                          setFirebaseTestResult({
                            success: true,
                            message:
                              'Live Store Link copied! Paste this link in any other browser or device to open your real company logo, data & user accounts immediately.',
                          });
                        } catch {
                          setFirebaseTestResult({
                            success: false,
                            message: `Copy this Live Store Link manually: ${shareUrl}`,
                          });
                        }
                      }}
                      className="px-3.5 py-2 bg-cyan-700 hover:bg-cyan-800 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition"
                    >
                      <Link2 className="w-3.5 h-3.5" />
                      <span>Copy Live Store Link</span>
                    </button>

                    <button
                      type="button"
                      onClick={async () => {
                        const envSnippet = buildNetlifyEnvSnippet(formState);
                        try {
                          await navigator.clipboard.writeText(envSnippet);
                          setFirebaseTestResult({
                            success: true,
                            message:
                              'Hosting Environment Variables (VITE_FIREBASE_*) copied! Paste them into Vercel -> Settings -> Environment Variables (or Netlify) and redeploy so the plain domain works in every browser.',
                          });
                        } catch {
                          setFirebaseTestResult({
                            success: false,
                            message: envSnippet,
                          });
                        }
                      }}
                      className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Hosting .env Vars</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const jsonContent = buildFirebaseRuntimeConfigJson(formState);
                        const blob = new Blob([jsonContent], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'firebase-config.json';
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                        URL.revokeObjectURL(url);
                        setFirebaseTestResult({
                          success: true,
                          message:
                            'Downloaded firebase-config.json! Place it inside public/ (or your Vercel/Netlify publish folder) so any browser opening your domain auto-connects to Firestore.',
                        });
                      }}
                      className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition"
                    >
                      <DownloadCloud className="w-3.5 h-3.5" />
                      <span>Download firebase-config.json</span>
                    </button>

                    <button
                      type="button"
                      onClick={async () => {
                        const code = encodeFirebaseShareParam(formState);
                        try {
                          await navigator.clipboard.writeText(code);
                          setFirebaseTestResult({
                            success: true,
                            message:
                              'Store Cloud Code copied! Paste it into System Settings -> Firebase Cloud Sync -> Quick Auto-Fill on any device.',
                          });
                        } catch {
                          setFirebaseTestResult({
                            success: false,
                            message: code,
                          });
                        }
                      }}
                      className="px-3.5 py-2 bg-white hover:bg-cyan-100 text-cyan-900 border border-cyan-300 font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Store Cloud Code</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* SECTION: DATA BACKUP, EXPORT & RESTORE */}
        <div className="bg-white p-6 rounded-2xl shadow-xs border border-slate-200 space-y-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-cyan-500/10 text-cyan-600 flex items-center justify-center font-black">
                <DatabaseBackup className="w-5 h-5 text-cyan-600" />
              </div>
              <div>
                <h4 className="font-extrabold text-slate-800 text-sm">Data Backup, Export & Restore (ডেটা ব্যাকআপ, এক্সপোর্ট ও রিস্টোর)</h4>
                <p className="text-xs text-slate-500 mt-0.5">Download JSON/Excel backups or restore database records from a backup file</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* EXPORT BACKUP BOX */}
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex items-center gap-2 font-extrabold text-slate-800 text-xs uppercase">
                <DownloadCloud className="w-4 h-4 text-emerald-600" />
                <span>Export System Data Backup</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Download a complete backup file containing all products, chalans, accounts, customers, categories, and settings.
              </p>
              
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={onExportBackupJSON}
                  className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-extrabold rounded-xl text-xs transition shadow-xs flex items-center gap-2"
                >
                  <FileJson className="w-4 h-4" />
                  <span>Download JSON Backup</span>
                </button>

                <button
                  type="button"
                  onClick={onExportBackupCSV}
                  className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-extrabold rounded-xl text-xs transition shadow-xs flex items-center gap-2"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                  <span>Export Products Excel (CSV)</span>
                </button>
              </div>
            </div>

            {/* IMPORT RESTORE BOX */}
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex items-center gap-2 font-extrabold text-slate-800 text-xs uppercase">
                <UploadCloud className="w-4 h-4 text-cyan-600" />
                <span>Restore / Import Data from Backup</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Select a previously downloaded JSON backup file from your computer/phone to restore all database records.
              </p>

              <div className="pt-1">
                <label className="cursor-pointer bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-slate-950 font-extrabold px-5 py-2.5 rounded-xl text-xs shadow-md transition inline-flex items-center gap-2">
                  {isImporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                  <span>{isImporting ? 'Reading & Restoring File...' : '📁 Select JSON Backup File to Restore'}</span>
                  <input
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={handleFileUpload}
                    disabled={isImporting}
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Import Status Notification */}
          {importStatusMsg && (
            <div className={`p-4 rounded-xl text-xs font-bold border flex items-center gap-2 ${
              importStatusMsg.success 
                ? 'bg-emerald-50 text-emerald-900 border-emerald-200' 
                : 'bg-rose-50 text-rose-900 border-rose-200'
            }`}>
              {importStatusMsg.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <WifiOff className="w-4 h-4 text-rose-600 shrink-0" />}
              <span>{importStatusMsg.message}</span>
            </div>
          )}
        </div>

        {/* SECTION 4: System Users & Security Roles */}
        <div className="bg-white p-6 rounded-2xl shadow-xs border border-slate-200 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-600" />
              <h4 className="font-bold text-slate-800 text-sm">System Users & Security Access</h4>
            </div>
            
            {currentUserRole === 'admin' && (
              <button
                type="button"
                onClick={() => {
                  setEditingUser(null);
                  setUserId('');
                  setPassword('');
                  setName('');
                  setRole('staff');
                  setStatus('Active');
                  setIsUserModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Add New User
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            {users.filter(u => u.role !== 'customer').map(u => (
              <div key={u.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between mb-1">
                    <div className="font-bold text-slate-900 text-sm">
                      {u.role === 'admin' ? '👑' : u.role === 'manager' ? '📊' : '🧑‍⚕️'} {u.name}
                    </div>
                    {currentUserRole === 'admin' && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingUser(u);
                            setUserId(u.userId);
                            setPassword(u.passwordHash);
                            setName(u.name);
                            setRole(u.role === 'customer' ? 'staff' : u.role);
                            setStatus(u.status);
                            setIsUserModalOpen(true);
                          }}
                          className="p-1 text-slate-400 hover:text-emerald-600 bg-white border border-slate-200 rounded shadow-xs"
                          title="Edit User"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteUser(u.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 bg-white border border-slate-200 rounded shadow-xs"
                          title="Delete User"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                  
                  <p className="text-[11px] text-slate-500 mt-1 mb-2">Login ID: <strong className="text-slate-700">{u.userId}</strong></p>
                  
                  <p className="text-[10px] text-slate-400">
                    {u.role === 'admin' ? 'Full access to settings, inventory, approvals.' : 
                     u.role === 'manager' ? 'Access to inventory, transactions, reports.' : 
                     'Can log Stock Out and view inventory availability.'}
                  </p>
                </div>
                
                <div className="mt-4 flex items-center justify-between">
                  <span className={`inline-block px-2 py-0.5 rounded font-bold text-[10px] ${
                    u.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                  }`}>
                    {u.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SECTION 5: GRANULAR USER ROLE PERMISSIONS MATRIX */}
        <div className="bg-white p-6 rounded-2xl shadow-xs border border-slate-200 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Lock className="w-4 h-4 text-emerald-600" />
            <div>
              <h4 className="font-bold text-slate-800 text-sm">Granular Role Permissions Control (ম্যানুয়ালি ইউজার পারমিশন কন্ট্রোল)</h4>
              <p className="text-xs text-slate-500 mt-0.5">Configure what feature operations Manager & Staff accounts can perform in the app</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[540px] text-left text-xs">
              <thead className="bg-slate-100 text-slate-800 font-extrabold uppercase tracking-wider text-[10px] border-b border-slate-200">
                <tr>
                  <th className="p-3 min-w-[220px]">Feature Operation / Module Permission</th>
                  <th className="p-3 text-center w-28 whitespace-nowrap">👑 Admin</th>
                  <th className="p-3 text-center w-28 whitespace-nowrap">📊 Manager</th>
                  <th className="p-3 text-center w-28 whitespace-nowrap">🧑‍⚕️ Staff</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {[
                  { key: 'canManageInventory', title: 'Manage Inventory (Add / Edit / Delete Products)' },
                  { key: 'canManageTransactions', title: 'Stock Transactions (Log IN, OUT, & RETURN)' },
                  { key: 'canManageRetailPOS', title: 'Process Retail POS Counter Sales' },
                  { key: 'canManageWholesale', title: 'Create & Edit Wholesale Chalans' },
                  { key: 'canManageAccounts', title: 'View Accounts Ledger & Collect Dues' },
                  { key: 'canViewReports', title: 'View & Export Executive Analytics Reports' },
                  { key: 'canManageSuppliersCategories', title: 'Manage Suppliers & Categories' },
                  { key: 'canManageSalesReps', title: 'Manage Sales Reps (SR) & Commissions' },
                  { key: 'canViewAuditLog', title: 'View System Activity & Audit Trail Log' },
                  { key: 'canManageSettingsUsers', title: 'Access System Settings, Users & Firebase Config' },
                ].map(perm => {
                  const currentPerms = formState.rolePermissions || defaultRolePermissions;
                  const key = perm.key as keyof RolePermissions;

                  return (
                    <tr key={perm.key} className="hover:bg-slate-50">
                      <td className="p-3 font-bold text-slate-800">{perm.title}</td>
                      <td className="p-3 text-center whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 whitespace-nowrap px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded font-extrabold text-[10px]">
                          <span>✓</span>
                          <span>FULL</span>
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          disabled={currentUserRole !== 'admin'}
                          checked={Boolean(currentPerms.manager[key])}
                          onChange={() => handleTogglePermission('manager', key)}
                          className="w-4 h-4 text-emerald-600 bg-slate-100 border-slate-300 rounded focus:ring-emerald-500 cursor-pointer"
                        />
                      </td>
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          disabled={currentUserRole !== 'admin'}
                          checked={Boolean(currentPerms.staff[key])}
                          onChange={() => handleTogglePermission('staff', key)}
                          className="w-4 h-4 text-emerald-600 bg-slate-100 border-slate-300 rounded focus:ring-emerald-500 cursor-pointer"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* SECTION 6: DANGER ZONE - WIPE & RESET SYSTEM DATA */}
        {currentUserRole === 'admin' && (
          <div className="bg-rose-50/50 p-6 rounded-2xl border-2 border-rose-200 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-rose-200">
              <AlertOctagon className="w-5 h-5 text-rose-600" />
              <div>
                <h4 className="font-extrabold text-rose-900 text-sm">Danger Zone: Complete System Data Reset (সিস্টেমের সমস্ত ডেটা রিসেট)</h4>
                <p className="text-xs text-rose-700 mt-0.5">Wipe all inventory products, sales chalans, ledgers & transactions completely</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="text-xs text-rose-800 space-y-1">
                <p className="font-bold">⚠️ Warning: This action will permanently erase:</p>
                <p className="text-[11px] font-medium">• All Stock Products, Categories & Suppliers</p>
                <p className="text-[11px] font-medium">• All Wholesale Chalans, POS Orders, Accounts Ledgers & Customer Dues</p>
                <p className="text-[11px] font-medium">• Automatically wipes records from both Local Browser Storage and Connected Firebase Cloud!</p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setConfirmText('');
                  setIsResetModalOpen(true);
                }}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold rounded-xl text-xs shadow-md transition flex items-center gap-2 shrink-0"
              >
                <Trash2 className="w-4 h-4" />
                <span>Reset Software & Delete All Data</span>
              </button>
            </div>
          </div>
        )}

        <div className="pt-4 flex justify-end">
          <button
            type="submit"
            className="bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-slate-950 font-extrabold px-6 py-3 rounded-xl text-xs shadow-sm flex items-center gap-2 transition"
          >
            <Save className="w-4 h-4" />
            <span>Save All Configuration Changes</span>
          </button>
        </div>

      </form>

      {/* RESET CONFIRMATION MODAL */}
      {isResetModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl border border-rose-200 max-w-md w-full p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-rose-100">
              <div className="flex items-center gap-2 font-extrabold text-rose-600 text-base">
                <AlertOctagon className="w-5 h-5" />
                <span>Confirm Full System Data Wipe</span>
              </div>
              <button 
                type="button" 
                onClick={() => setIsResetModalOpen(false)} 
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-700">
              <p className="font-bold text-slate-900">Are you absolutely sure you want to make this software completely blank?</p>
              <p className="text-slate-600">
                This will delete every product, transaction, chalan, customer due, and account ledger record from both local browser storage and Firebase cloud!
              </p>
              
              <div className="bg-rose-50 p-3 rounded-xl border border-rose-200 text-rose-900">
                <label className="block font-extrabold uppercase mb-1">To confirm, type <span className="bg-rose-200 px-1.5 py-0.5 rounded font-mono">RESET</span> below:</label>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => {
                    setConfirmText(e.target.value);
                    if (resetErrorMsg) setResetErrorMsg('');
                  }}
                  placeholder="RESET"
                  className="w-full bg-white border border-rose-300 rounded-lg px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
                {resetErrorMsg && (
                  <p className="text-[11px] font-bold text-rose-700 mt-1.5">{resetErrorMsg}</p>
                )}
              </div>
            </div>

            <div className="pt-3 flex justify-end gap-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsResetModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReset}
                disabled={isResetting || confirmText.trim().toUpperCase() !== 'RESET'}
                className={`px-5 py-2 rounded-xl text-xs font-extrabold shadow-sm transition flex items-center gap-2 ${
                  confirmText.trim().toUpperCase() === 'RESET' && !isResetting
                    ? 'bg-rose-600 hover:bg-rose-700 text-white'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                {isResetting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>{isResetting ? 'Wiping Cloud & Local Data...' : 'Confirm Data Wipe'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Modal */}
      {isUserModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-base">
                {editingUser ? 'Edit System User' : 'Add New User'}
              </h3>
              <button 
                type="button"
                onClick={() => setIsUserModalOpen(false)} 
                className="text-slate-400 hover:text-slate-600 font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={(e) => {
              e.preventDefault();
              if (editingUser) {
                onUpdateUser({
                  ...editingUser,
                  userId,
                  passwordHash: password,
                  name,
                  role,
                  status
                });
                setSuccessMsg(`User account for ${name} updated successfully!`);
              } else {
                onAddUser({
                  userId,
                  passwordHash: password,
                  name,
                  role,
                  status
                });
                setSuccessMsg(`New user account for ${name} created successfully!`);
              }
              setIsUserModalOpen(false);
              window.scrollTo({ top: 0, behavior: 'smooth' });
              setTimeout(() => {
                setSuccessMsg('');
              }, 4000);
            }} className="space-y-4">
              
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Login User ID</label>
                <input
                  type="text"
                  required
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Password</label>
                <input
                  type="text"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Role / Access Level</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="admin">Admin (Full Access)</option>
                  <option value="manager">Manager (Manage Data)</option>
                  <option value="staff">Staff (Log & View)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Account Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="Active">Active (Can Login)</option>
                  <option value="Inactive">Inactive (Access Revoked)</option>
                </select>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-4 py-2 rounded-xl text-xs transition shadow-sm"
                >
                  {editingUser ? 'Update User' : 'Create User'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};
