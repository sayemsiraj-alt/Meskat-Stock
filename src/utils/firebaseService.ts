import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  onSnapshot,
  Firestore,
  getDocs,
  limit,
  query,
} from 'firebase/firestore';
import { SystemSettings, SystemUser } from '../data/mockData';
import {
  mapFirebaseAuthErrorMessage,
  normalizeAuthDomain,
} from './firebaseConfigHelpers';
import {
  PendingFirestoreOp,
  removePendingFirestoreOp,
  upsertPendingFirestoreOp,
} from './firebaseSyncHelpers';

const PENDING_OPS_STORAGE_KEY = 'stock_erp_firestore_pending_ops';

const isBrowserOffline = (): boolean =>
  typeof navigator !== 'undefined' && navigator.onLine === false;

const loadPendingOps = (): PendingFirestoreOp[] => {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PENDING_OPS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const savePendingOps = (ops: PendingFirestoreOp[]) => {
  if (typeof localStorage === 'undefined') return;
  try {
    if (ops.length === 0) {
      localStorage.removeItem(PENDING_OPS_STORAGE_KEY);
    } else {
      localStorage.setItem(PENDING_OPS_STORAGE_KEY, JSON.stringify(ops));
    }
  } catch {
    // ignore storage quota errors
  }
};

export const clearPendingFirestoreOps = () => {
  savePendingOps([]);
};

let appInstance: FirebaseApp | null = null;
let dbInstance: Firestore | null = null;

const sanitizeFirestoreData = (value: any): any => {
  if (Array.isArray(value)) {
    return value
      .filter((v) => v !== undefined)
      .map((v) => sanitizeFirestoreData(v));
  }
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const out: Record<string, any> = {};
    Object.entries(value).forEach(([k, v]) => {
      if (v !== undefined) {
        out[k] = sanitizeFirestoreData(v);
      }
    });
    return out;
  }
  return value;
};

export const ERP_FIRESTORE_COLLECTIONS = [
  'items',
  'transactions',
  'wholesalers',
  'invoices',
  'accountTxns',
  'expenses',
  'purchase_orders',
  'purchase_bills',
  'purchase_returns',
  'supplier_payments',
  'damaged_stock',
  'suppliers',
  'categories',
  'customer_orders',
  'customer_returns',
  'payment_claims',
  'sales_reps',
  'stock_transfers',
  'audit_logs',
  'users',
] as const;

export type ErpFirestoreCollectionName = (typeof ERP_FIRESTORE_COLLECTIONS)[number];

export const initFirebase = (settings: SystemSettings): Firestore | null => {
  const apiKey = (settings.firebaseApiKey || '').trim();
  const projectId = (settings.firebaseProjectId || '').trim();
  if (!apiKey || !projectId) {
    dbInstance = null;
    return null;
  }

  const firebaseConfig = {
    apiKey,
    authDomain: normalizeAuthDomain(settings.firebaseAuthDomain, projectId),
    projectId,
    storageBucket: (settings.firebaseStorageBucket || '').trim() || `${projectId}.appspot.com`,
    messagingSenderId: (settings.firebaseMessagingSenderId || '').trim(),
    appId: (settings.firebaseAppId || '').trim(),
  };

  // Scope the FirebaseApp name to projectId + apiKey prefix so switching projects works without stale app reuse
  const appName = `stock-erp-${projectId}-${apiKey.slice(-6)}`;

  try {
    const existing = getApps().find((a) => a.name === appName);
    appInstance = existing || initializeApp(firebaseConfig, appName);
    dbInstance = getFirestore(appInstance);
    return dbInstance;
  } catch (error) {
    console.error('Firebase initialization failed:', error);
    dbInstance = null;
    return null;
  }
};

export interface GoogleAuthSignInOutcome {
  success: boolean;
  redirected?: boolean;
  email?: string;
  displayName?: string;
  photoURL?: string;
  message?: string;
}

const GOOGLE_REDIRECT_PENDING_KEY = 'stock_erp_google_redirect_pending';
const GOOGLE_REDIRECT_REMEMBER_KEY = 'stock_erp_google_redirect_remember';

export const resolveGoogleAuthRedirectResult = async (
  settings: SystemSettings
): Promise<(GoogleAuthSignInOutcome & { rememberMe: boolean }) | null> => {
  try {
    const wasPending = sessionStorage.getItem(GOOGLE_REDIRECT_PENDING_KEY) === '1';
    const rememberMe = sessionStorage.getItem(GOOGLE_REDIRECT_REMEMBER_KEY) !== 'false';
    const db = initFirebase(settings);
    if (!db || !appInstance) return null;

    const auth = getAuth(appInstance);
    const result = await getRedirectResult(auth);
    sessionStorage.removeItem(GOOGLE_REDIRECT_PENDING_KEY);
    sessionStorage.removeItem(GOOGLE_REDIRECT_REMEMBER_KEY);

    if (result?.user?.email) {
      return {
        success: true,
        email: result.user.email,
        displayName: result.user.displayName || '',
        photoURL: result.user.photoURL || '',
        rememberMe,
      };
    }

    if (wasPending) {
      return {
        success: false,
        rememberMe,
        message: 'Google Sign-In redirect did not complete. Please try again.',
      };
    }
    return null;
  } catch (err: any) {
    sessionStorage.removeItem(GOOGLE_REDIRECT_PENDING_KEY);
    sessionStorage.removeItem(GOOGLE_REDIRECT_REMEMBER_KEY);
    const currentHost = typeof window !== 'undefined' ? window.location.hostname : '';
    const mapped = mapFirebaseAuthErrorMessage(err?.code, err?.message, currentHost);
    return {
      success: false,
      rememberMe: true,
      message: mapped.message,
    };
  }
};

export const signInWithGoogleFirebase = async (
  settings: SystemSettings,
  rememberMe = true
): Promise<GoogleAuthSignInOutcome> => {
  const currentHost = typeof window !== 'undefined' ? window.location.hostname : '';
  try {
    const db = initFirebase(settings);
    if (!db || !appInstance) {
      return {
        success: false,
        message: 'Firebase is not configured yet. Please connect Firebase in Admin System Settings.',
      };
    }
    const auth = getAuth(appInstance);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    const result = await signInWithPopup(auth, provider);
    if (!result.user?.email) {
      return {
        success: false,
        message: 'Google account did not return an email address.',
      };
    }
    return {
      success: true,
      email: result.user.email,
      displayName: result.user.displayName || '',
      photoURL: result.user.photoURL || '',
    };
  } catch (err: any) {
    const mapped = mapFirebaseAuthErrorMessage(err?.code, err?.message, currentHost);
    if (mapped.shouldFallbackToRedirect && appInstance) {
      try {
        const auth = getAuth(appInstance);
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        sessionStorage.setItem(GOOGLE_REDIRECT_PENDING_KEY, '1');
        sessionStorage.setItem(GOOGLE_REDIRECT_REMEMBER_KEY, rememberMe ? 'true' : 'false');
        await signInWithRedirect(auth, provider);
        return {
          success: false,
          redirected: true,
          message: mapped.message,
        };
      } catch (redirectErr: any) {
        sessionStorage.removeItem(GOOGLE_REDIRECT_PENDING_KEY);
        sessionStorage.removeItem(GOOGLE_REDIRECT_REMEMBER_KEY);
        const redirectMapped = mapFirebaseAuthErrorMessage(
          redirectErr?.code,
          redirectErr?.message,
          currentHost
        );
        return {
          success: false,
          message: redirectMapped.message,
        };
      }
    }
    return {
      success: false,
      message: mapped.message,
    };
  }
};

export const findRemoteCustomerByEmail = async (
  settings: SystemSettings,
  email: string
): Promise<SystemUser | null> => {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) return null;
  const db = initFirebase(settings);
  if (!db) return null;
  try {
    const snap = await getDocs(collection(db, 'users'));
    let matched: SystemUser | null = null;
    snap.forEach((docSnap) => {
      const data = docSnap.data() as SystemUser;
      if (
        data.role === 'customer' &&
        data.email &&
        data.email.trim().toLowerCase() === cleanEmail
      ) {
        matched = { ...data, id: docSnap.id };
      }
    });
    return matched;
  } catch (err) {
    console.warn('Remote customer lookup error:', err);
    return null;
  }
};

export const findRemoteUserByLogin = async (
  settings: SystemSettings,
  userId: string,
  password: string
): Promise<{ user: SystemUser | null; remoteUsers: SystemUser[] }> => {
  const cleanUserId = userId.trim().toLowerCase();
  if (!cleanUserId || !password) return { user: null, remoteUsers: [] };
  const db = initFirebase(settings);
  if (!db) return { user: null, remoteUsers: [] };
  try {
    const snap = await getDocs(collection(db, 'users'));
    const remoteUsers: SystemUser[] = [];
    let matched: SystemUser | null = null;
    snap.forEach((docSnap) => {
      const userObj = { ...(docSnap.data() as SystemUser), id: docSnap.id };
      remoteUsers.push(userObj);
      if (
        userObj.userId &&
        userObj.userId.trim().toLowerCase() === cleanUserId &&
        userObj.passwordHash === password
      ) {
        matched = userObj;
      }
    });
    return { user: matched, remoteUsers };
  } catch (err) {
    console.warn('Remote user login lookup error:', err);
    return { user: null, remoteUsers: [] };
  }
};

export const testFirebaseConnection = async (
  settings: SystemSettings
): Promise<{ success: boolean; message: string }> => {
  try {
    const db = initFirebase(settings);
    if (!db) {
      return {
        success: false,
        message: 'Please provide at least Firebase API Key and Project ID.',
      };
    }

    const q = query(collection(db, '_connection_test'), limit(1));
    await getDocs(q);

    await setDoc(doc(db, '_connection_test', 'status'), {
      connectedAt: new Date().toISOString(),
      appName: settings.brandName || 'Stock ERP',
      status: 'Active',
    });

    return {
      success: true,
      message: `Successfully connected to Firebase Project "${settings.firebaseProjectId}"! Live Cloud Sync is Active.`,
    };
  } catch (err: any) {
    console.error('Firebase test error:', err);
    if (err?.message?.includes('permission') || err?.code?.includes('permission')) {
      return {
        success: false,
        message:
          '🔒 Firestore Security Rules Restriction: Go to Firebase Console -> Firestore Database -> Rules tab, and set: "allow read, write: if true;" to grant access.',
      };
    }
    return {
      success: false,
      message:
        err.message || 'Failed to connect to Firebase. Check API Key and Firestore rules.',
    };
  }
};

export interface FirestorePullResult {
  success: boolean;
  totalRecords: number;
  nonEmptyCollections: number;
  collections: Partial<Record<ErpFirestoreCollectionName, any[]>>;
  settingsDoc?: Partial<SystemSettings> | null;
  message: string;
}

export const pullAllFromFirestore = async (
  settings: SystemSettings
): Promise<FirestorePullResult> => {
  const db = initFirebase(settings);
  if (!db) {
    return {
      success: false,
      totalRecords: 0,
      nonEmptyCollections: 0,
      collections: {},
      message: 'Please enter valid Firebase API Key and Project ID before syncing.',
    };
  }

  // Push any offline-queued mutations first so local inputs sync before pulling remote snapshots
  await flushPendingFirestoreOps(settings);

  try {
    const [settingsSnap, ...colSnaps] = await Promise.all([
      getDoc(doc(db, 'settings', 'config')),
      ...ERP_FIRESTORE_COLLECTIONS.map((colName) => getDocs(collection(db, colName))),
    ]);

    const collections: Partial<Record<ErpFirestoreCollectionName, any[]>> = {};
    let totalRecords = 0;
    let nonEmptyCollections = 0;

    ERP_FIRESTORE_COLLECTIONS.forEach((colName, idx) => {
      const snap = colSnaps[idx];
      const rows: any[] = [];
      snap.forEach((d) => {
        rows.push({ ...d.data(), id: d.id });
      });
      collections[colName] = rows;
      totalRecords += rows.length;
      if (rows.length > 0) nonEmptyCollections += 1;
    });

    const settingsDoc = settingsSnap.exists()
      ? (settingsSnap.data() as Partial<SystemSettings>)
      : null;

    return {
      success: true,
      totalRecords,
      nonEmptyCollections,
      collections,
      settingsDoc,
      message:
        totalRecords > 0
          ? `Synced ${totalRecords} records across ${nonEmptyCollections} Firestore collections!`
          : 'Connected to Firestore (no remote records found yet — your local data is preserved).',
    };
  } catch (err: any) {
    console.warn('Firestore pullAll error:', err);
    if (err?.message?.includes('permission') || err?.code?.includes('permission')) {
      return {
        success: false,
        totalRecords: 0,
        nonEmptyCollections: 0,
        collections: {},
        message:
          '🔒 Permission denied reading Firestore. Set Firestore Rules to "allow read, write: if true;" and retry.',
      };
    }
    return {
      success: false,
      totalRecords: 0,
      nonEmptyCollections: 0,
      collections: {},
      message: err?.message || 'Failed to sync data from Firestore.',
    };
  }
};

export const pushAllToFirestore = async (
  settings: SystemSettings,
  snapshot: Record<ErpFirestoreCollectionName, any[]>
): Promise<{ success: boolean; totalUploaded: number; message: string }> => {
  const db = initFirebase(settings);
  if (!db) {
    return {
      success: false,
      totalUploaded: 0,
      message: 'Firebase is not configured yet.',
    };
  }

  try {
    const syncedAt = new Date().toISOString();
    await setDoc(
      doc(db, 'settings', 'config'),
      sanitizeFirestoreData({
        ...settings,
        firebaseConnected: true,
        firebaseLastSync: syncedAt,
        updatedAt: syncedAt,
      }),
      { merge: true }
    );

    const writeTasks: Array<() => Promise<void>> = [];
    for (const colName of ERP_FIRESTORE_COLLECTIONS) {
      const records = snapshot[colName] || [];
      for (const rec of records) {
        if (!rec || !rec.id) continue;
        writeTasks.push(() =>
          setDoc(
            doc(db, colName, String(rec.id)),
            sanitizeFirestoreData({ ...rec, updatedAt: syncedAt }),
            { merge: true }
          )
        );
      }
    }

    // Execute in batches of 25 to avoid overwhelming concurrent Firestore connections
    const chunkSize = 25;
    for (let i = 0; i < writeTasks.length; i += chunkSize) {
      const chunk = writeTasks.slice(i, i + chunkSize);
      await Promise.all(chunk.map((fn) => fn()));
    }

    clearPendingFirestoreOps();

    return {
      success: true,
      totalUploaded: writeTasks.length,
      message: `Backed up ${writeTasks.length} records & settings to Firestore!`,
    };
  } catch (err: any) {
    console.warn('Firestore pushAll error:', err);
    return {
      success: false,
      totalUploaded: 0,
      message: err?.message || 'Failed to upload local records to Firestore.',
    };
  }
};

let activeFlushPromise: Promise<{ flushed: number; remaining: number }> | null = null;

export const flushPendingFirestoreOps = async (
  settings?: SystemSettings
): Promise<{ flushed: number; remaining: number }> => {
  if (activeFlushPromise) return activeFlushPromise;

  activeFlushPromise = (async () => {
    const initialQueue = loadPendingOps();
    if (initialQueue.length === 0) {
      return { flushed: 0, remaining: 0 };
    }
    if (isBrowserOffline()) {
      return { flushed: 0, remaining: initialQueue.length };
    }
    const db = dbInstance || (settings ? initFirebase(settings) : null);
    if (!db) {
      return { flushed: 0, remaining: initialQueue.length };
    }

    let flushed = 0;
    let currentQueue = [...initialQueue];

    for (const item of initialQueue) {
      try {
        if (item.op === 'set') {
          await setDoc(
            doc(db, item.collectionName, item.id),
            sanitizeFirestoreData({
              ...(item.data || {}),
              updatedAt: item.data?.updatedAt || new Date().toISOString(),
            }),
            { merge: true }
          );
        } else {
          await deleteDoc(doc(db, item.collectionName, item.id));
        }
        flushed += 1;
        currentQueue = removePendingFirestoreOp(currentQueue, item.collectionName, item.id);
        savePendingOps(currentQueue);
      } catch (err: any) {
        const code = String(err?.code || '').toLowerCase();
        if (code.includes('invalid-argument')) {
          currentQueue = removePendingFirestoreOp(currentQueue, item.collectionName, item.id);
          savePendingOps(currentQueue);
        } else {
          console.warn(`Retry queued op failed (${item.collectionName}/${item.id}):`, err);
        }
      }
    }

    return { flushed, remaining: currentQueue.length };
  })();

  try {
    return await activeFlushPromise;
  } finally {
    activeFlushPromise = null;
  }
};

export const saveRecordToFirestore = async (
  collectionName: string,
  id: string,
  data: any
): Promise<{ success: boolean; queued?: boolean; error?: string }> => {
  const sanitized = sanitizeFirestoreData({
    ...data,
    updatedAt: new Date().toISOString(),
  });

  savePendingOps(
    upsertPendingFirestoreOp(loadPendingOps(), {
      op: 'set',
      collectionName,
      id,
      data: sanitized,
      queuedAt: new Date().toISOString(),
    })
  );

  if (!dbInstance || isBrowserOffline()) {
    return {
      success: false,
      queued: true,
      error: !dbInstance
        ? 'Firebase is not initialized yet — saved locally and queued for sync.'
        : 'Device offline — saved locally and queued for auto-sync.',
    };
  }

  try {
    await setDoc(doc(dbInstance, collectionName, id), sanitized, { merge: true });
    savePendingOps(removePendingFirestoreOp(loadPendingOps(), collectionName, id));
    return { success: true };
  } catch (err: any) {
    const code = String(err?.code || '').toLowerCase();
    if (code.includes('invalid-argument')) {
      savePendingOps(removePendingFirestoreOp(loadPendingOps(), collectionName, id));
    }
    console.warn(`Firestore save error on ${collectionName}/${id}:`, err);
    return {
      success: false,
      queued: !code.includes('invalid-argument'),
      error: err?.message || `Failed to save ${collectionName}/${id} to Firestore.`,
    };
  }
};

export const deleteRecordFromFirestore = async (collectionName: string, id: string) => {
  savePendingOps(
    upsertPendingFirestoreOp(loadPendingOps(), {
      op: 'delete',
      collectionName,
      id,
      queuedAt: new Date().toISOString(),
    })
  );

  if (!dbInstance || isBrowserOffline()) return;
  try {
    await deleteDoc(doc(dbInstance, collectionName, id));
    savePendingOps(removePendingFirestoreOp(loadPendingOps(), collectionName, id));
  } catch (err) {
    console.warn(`Firestore delete error on ${collectionName}/${id}:`, err);
  }
};

export const clearFirestoreCollection = async (collectionName: string) => {
  if (!dbInstance || isBrowserOffline()) return;
  try {
    const snapshot = await getDocs(collection(dbInstance, collectionName));
    const deletePromises = snapshot.docs.map((docSnap) =>
      deleteDoc(doc(dbInstance!, collectionName, docSnap.id))
    );
    await Promise.all(deletePromises);
  } catch (err) {
    console.warn(`Error clearing Firestore collection ${collectionName}:`, err);
  }
};

export const clearAllFirestoreCollections = async () => {
  clearPendingFirestoreOps();
  if (!dbInstance) return;
  const db = dbInstance;
  const collectionsToClear = [
    'items',
    'transactions',
    'wholesalers',
    'invoices',
    'accountTxns',
    'expenses',
    'purchase_orders',
    'purchase_bills',
    'purchase_returns',
    'supplier_payments',
    'damaged_stock',
    'suppliers',
    'categories',
    'customer_orders',
    'customer_returns',
    'payment_claims',
    'sales_reps',
    'stock_transfers',
    'audit_logs',
  ];
  for (const colName of collectionsToClear) {
    try {
      const snapshot = await getDocs(collection(db, colName));
      const deletePromises = snapshot.docs.map((docSnap) =>
        deleteDoc(doc(db, colName, docSnap.id))
      );
      await Promise.all(deletePromises);
    } catch (err) {
      console.warn(`Error clearing Firestore collection ${colName}:`, err);
    }
  }
};

export const listenToCollection = (
  collectionName: string,
  onData: (data: any[]) => void
) => {
  if (!dbInstance) return () => {};
  try {
    const colRef = collection(dbInstance, collectionName);
    return onSnapshot(
      colRef,
      (snapshot) => {
        const list: any[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ ...docSnap.data(), id: docSnap.id });
        });
        onData(list);
      },
      (error) => {
        console.warn(`Snapshot error on ${collectionName}:`, error);
      }
    );
  } catch (err) {
    console.warn(`Error setting up listener for ${collectionName}:`, err);
    return () => {};
  }
};

export const listenToDocument = (
  collectionName: string,
  docId: string,
  onData: (data: any) => void
) => {
  if (!dbInstance) return () => {};
  try {
    const docRef = doc(dbInstance, collectionName, docId);
    return onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          onData(docSnap.data());
        }
      },
      (error) => {
        console.warn(`Snapshot error on doc ${collectionName}/${docId}:`, error);
      }
    );
  } catch (err) {
    console.warn(`Error setting up listener for doc ${collectionName}/${docId}:`, err);
    return () => {};
  }
};
