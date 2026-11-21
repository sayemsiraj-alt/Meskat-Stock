import React, { useEffect, useState } from 'react';
import {
  User,
  Key,
  ArrowRight,
  Sparkles,
  UserPlus,
  Phone,
  MapPin,
  Mail,
  Building2,
  RefreshCw,
} from 'lucide-react';
import { SystemUser, SystemSettings } from '../data/mockData';
import { CompanyLogo } from './CompanyLogo';
import {
  resolveGoogleAuthRedirectResult,
  signInWithGoogleFirebase,
} from '../utils/firebaseService';
import { hasFirebaseCredentials } from '../utils/firebaseConfigHelpers';

export interface CustomerRegistrationPayload {
  name: string;
  shopName?: string;
  phone: string;
  address: string;
  email?: string;
  userId: string;
  password: string;
  authProvider: 'local' | 'google';
}

interface LoginScreenProps {
  onLogin: (user: SystemUser, rememberMe: boolean) => void;
  onRegisterCustomer: (
    payload: CustomerRegistrationPayload,
    rememberMe: boolean
  ) => { success: boolean; message?: string };
  onGoogleCustomerLogin: (
    googleUser: { email: string; displayName?: string; photoURL?: string },
    rememberMe: boolean
  ) => Promise<{ needsProfileCompletion: boolean; error?: string }> | { needsProfileCompletion: boolean; error?: string };
  onVerifyRemoteLogin?: (
    userId: string,
    password: string
  ) => Promise<SystemUser | null>;
  isCloudSyncing?: boolean;
  users: SystemUser[];
  settings: SystemSettings;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onLogin,
  onRegisterCustomer,
  onGoogleCustomerLogin,
  onVerifyRemoteLogin,
  isCloudSyncing = false,
  users,
  settings,
}) => {
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

  // Customer Self-Registration State
  const [regName, setRegName] = useState('');
  const [regShop, setRegShop] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regAddress, setRegAddress] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regUserId, setRegUserId] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');

  // Google Auth State
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [pendingGoogleUser, setPendingGoogleUser] = useState<{
    email: string;
    displayName?: string;
  } | null>(null);

  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfoMsg('');
    if (!userId.trim() || !password) {
      setError('Please enter User ID and Password');
      return;
    }

    let user = users.find(
      (u) =>
        u.userId.toLowerCase() === userId.trim().toLowerCase() &&
        u.passwordHash === password
    );

    if (!user && hasFirebaseConfig && onVerifyRemoteLogin) {
      setIsAuthenticating(true);
      try {
        const remoteMatched = await onVerifyRemoteLogin(userId.trim(), password);
        if (remoteMatched) {
          user = remoteMatched;
        }
      } finally {
        setIsAuthenticating(false);
      }
    }

    if (!user) {
      setError('Invalid User ID or Password. Please try again.');
      return;
    }

    if (user.status === 'Inactive') {
      setError('This account has been deactivated. Contact Admin.');
      return;
    }

    onLogin(user, rememberMe);
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfoMsg('');

    if (!regName.trim() || !regPhone.trim()) {
      setError('Buyer Name and Mobile Number are required.');
      return;
    }

    if (!pendingGoogleUser) {
      if (!regUserId.trim() || regUserId.trim().length < 3) {
        setError('User ID must be at least 3 characters.');
        return;
      }
      if (regPassword.length < 4) {
        setError('Password must be at least 4 characters.');
        return;
      }
      if (regPassword !== regConfirmPassword) {
        setError('Passwords do not match.');
        return;
      }
    }

    const finalUserId = pendingGoogleUser
      ? regUserId.trim() ||
        pendingGoogleUser.email.split('@')[0] ||
        `cust_${Date.now().toString().slice(-4)}`
      : regUserId.trim();

    const result = onRegisterCustomer(
      {
        name: regName.trim(),
        shopName: regShop.trim() || undefined,
        phone: regPhone.trim(),
        address: regAddress.trim(),
        email: (pendingGoogleUser?.email || regEmail).trim() || undefined,
        userId: finalUserId,
        password: pendingGoogleUser ? `GOOGLE_${Date.now()}` : regPassword,
        authProvider: pendingGoogleUser ? 'google' : 'local',
      },
      rememberMe
    );

    if (!result.success) {
      setError(result.message || 'Registration failed.');
    }
  };

  const hasFirebaseConfig = Boolean(
    settings.firebaseConnected || hasFirebaseCredentials(settings)
  );

  const completeGoogleLoginFlow = async (
    googleUser: { email: string; displayName?: string; photoURL?: string },
    rememberSession: boolean
  ) => {
    const outcome = await onGoogleCustomerLogin(googleUser, rememberSession);
    if (outcome.error) {
      setError(outcome.error);
      return;
    }
    if (outcome.needsProfileCompletion) {
      setPendingGoogleUser({
        email: googleUser.email,
        displayName: googleUser.displayName,
      });
      setRegName(googleUser.displayName || '');
      setRegEmail(googleUser.email);
      setRegUserId(googleUser.email.split('@')[0]);
      setAuthTab('register');
      setInfoMsg(
        `Google verified (${googleUser.email}). Complete your buyer profile once to open your Customer Portal.`
      );
    }
  };

  useEffect(() => {
    if (!hasFirebaseConfig) return;
    let active = true;
    setIsGoogleLoading(true);
    resolveGoogleAuthRedirectResult(settings)
      .then(async (res) => {
        if (!active || !res) return;
        if (!res.success || !res.email) {
          if (res.message) setError(res.message);
          return;
        }
        await completeGoogleLoginFlow(
          {
            email: res.email,
            displayName: res.displayName,
            photoURL: res.photoURL,
          },
          res.rememberMe
        );
      })
      .finally(() => {
        if (active) setIsGoogleLoading(false);
      });
    return () => {
      active = false;
    };
    // Run once when firebase credentials are available on login screen mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasFirebaseConfig]);

  const handleContinueWithGoogle = async () => {
    setError('');
    setInfoMsg('');

    if (!hasFirebaseConfig) {
      setError(
        'Firebase Cloud is not connected yet. Please connect your Firebase configuration inside Admin Settings -> Firebase Cloud Sync.'
      );
      return;
    }

    setIsGoogleLoading(true);
    const res = await signInWithGoogleFirebase(settings, rememberMe);

    if (res.redirected) {
      setInfoMsg(res.message || 'Redirecting to Google Sign-In...');
      return;
    }

    if (!res.success || !res.email) {
      setIsGoogleLoading(false);
      setError(res.message || 'Google Sign-In could not be completed.');
      return;
    }

    try {
      await completeGoogleLoginFlow(
        {
          email: res.email,
          displayName: res.displayName,
          photoURL: res.photoURL,
        },
        rememberMe
      );
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center py-5 px-4 relative overflow-y-auto overflow-x-hidden">
      {/* Background Decorative Blobs */}
      <div className="absolute top-10 left-10 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-md bg-slate-800/90 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-700 p-5 sm:p-6 z-10 my-auto">
        {/* Header / Logo */}
        <div className="text-center mb-4">
          <CompanyLogo
            className="w-16 h-16 mx-auto mb-2.5 ring-4 ring-emerald-500/15"
            shortName={settings.brandShortName}
            logoUrl={settings.logoUrl}
          />
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            {settings.brandName}
          </h1>
          <p className="text-emerald-400 font-medium text-xs mt-0.5">
            Automatic Stock Management &amp; Buyer Portal
          </p>
          <div className="flex items-center justify-center gap-1 mt-1 text-[11px] text-slate-400">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Admin ERP + Wholesale Customer Portal</span>
          </div>
        </div>

        {/* Mode Tabs: Sign In vs Customer Self-Registration */}
        <div className="grid grid-cols-2 gap-1.5 bg-slate-900/90 p-1 rounded-xl border border-slate-700 mb-4">
          <button
            type="button"
            onClick={() => {
              setAuthTab('login');
              setPendingGoogleUser(null);
              setError('');
              setInfoMsg('');
            }}
            className={`py-2 rounded-lg text-xs font-extrabold transition cursor-pointer ${
              authTab === 'login'
                ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Sign In (Admin / Buyer)
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthTab('register');
              setError('');
              setInfoMsg('');
            }}
            className={`py-2 rounded-lg text-xs font-extrabold transition cursor-pointer flex items-center justify-center gap-1 ${
              authTab === 'register'
                ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Buyer Register</span>
          </button>
        </div>

        {isCloudSyncing && (
          <div className="mb-3 px-3 py-2 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-cyan-200 text-[11px] font-semibold flex items-center justify-center gap-2">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400 shrink-0" />
            <span>Syncing Store Profile &amp; Accounts from Cloud...</span>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-rose-500/20 border border-rose-500/50 rounded-lg text-rose-300 text-xs font-medium text-center">
            {error}
          </div>
        )}

        {infoMsg && (
          <div className="mb-4 p-3 bg-cyan-500/15 border border-cyan-500/40 rounded-lg text-cyan-200 text-xs font-medium text-center">
            {infoMsg}
          </div>
        )}

        {authTab === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1.5">
                User ID
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 pl-10 pr-4 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                  placeholder="Enter User ID"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Key className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 pl-10 pr-4 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                  placeholder="Enter Password"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-300 hover:text-white transition">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 text-emerald-500 bg-slate-900 border-slate-700 rounded focus:ring-emerald-500 cursor-pointer"
                />
                <span>Remember login on this device</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={isAuthenticating}
              className="w-full mt-2 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 disabled:opacity-60 text-slate-950 font-bold py-3 px-4 rounded-xl shadow-lg transition duration-200 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>
                {isAuthenticating
                  ? 'Verifying Cloud Account...'
                  : 'Login to Management System'}
              </span>
              {isAuthenticating ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <ArrowRight className="w-4 h-4" />
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegisterSubmit} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-300 uppercase mb-1">
                  Full / Contact Name *
                </label>
                <div className="relative">
                  <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="Your Name"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2 pl-8 pr-3 text-white text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-300 uppercase mb-1">
                  Shop / Business Name
                </label>
                <div className="relative">
                  <Building2 className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={regShop}
                    onChange={(e) => setRegShop(e.target.value)}
                    placeholder="e.g. Meskat Pharmacy"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2 pl-8 pr-3 text-white text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-300 uppercase mb-1">
                  Mobile Number *
                </label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    placeholder="017XX-XXXXXX"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2 pl-8 pr-3 text-white text-xs font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-300 uppercase mb-1">
                  Email (Optional)
                </label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    value={regEmail}
                    disabled={!!pendingGoogleUser}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="buyer@gmail.com"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2 pl-8 pr-3 text-white text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none disabled:opacity-60"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-300 uppercase mb-1">
                Delivery Address
              </label>
              <div className="relative">
                <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={regAddress}
                  onChange={(e) => setRegAddress(e.target.value)}
                  placeholder="Shop / Delivery Address"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2 pl-8 pr-3 text-white text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            {!pendingGoogleUser && (
              <>
                <div>
                  <label className="block text-[10px] font-bold text-slate-300 uppercase mb-1">
                    Choose Portal User ID *
                  </label>
                  <input
                    type="text"
                    required
                    value={regUserId}
                    onChange={(e) => setRegUserId(e.target.value)}
                    placeholder="e.g. meskat_buyer"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2 px-3 text-white text-xs font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-300 uppercase mb-1">
                      Password *
                    </label>
                    <input
                      type="password"
                      required
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Min 4 chars"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2 px-3 text-white text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-300 uppercase mb-1">
                      Confirm Password *
                    </label>
                    <input
                      type="password"
                      required
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      placeholder="Repeat password"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2 px-3 text-white text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
              </>
            )}

            <button
              type="submit"
              className="w-full mt-2 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-slate-950 font-extrabold py-2.5 px-4 rounded-xl shadow-lg transition flex items-center justify-center gap-2 text-xs cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>
                {pendingGoogleUser
                  ? 'Complete Buyer Portal Setup'
                  : 'Create Buyer Account & Sign In'}
              </span>
            </button>
          </form>
        )}

        {/* Optional Continue with Google for Customers */}
        <div className="mt-5 pt-4 border-t border-slate-700/60 space-y-3">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-slate-400">
            <div className="flex-1 h-px bg-slate-700" />
            <span>Wholesale Buyer Quick Access (Optional)</span>
            <div className="flex-1 h-px bg-slate-700" />
          </div>

          <button
            type="button"
            disabled={isGoogleLoading}
            onClick={handleContinueWithGoogle}
            className="w-full py-2.5 px-4 bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs rounded-xl border border-slate-300 flex items-center justify-center gap-2.5 transition cursor-pointer"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
              />
            </svg>
            <span>
              {isGoogleLoading
                ? 'Connecting Google...'
                : 'Continue with Google (Customer)'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
