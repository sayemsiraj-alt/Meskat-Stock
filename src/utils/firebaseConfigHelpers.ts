import { SystemSettings } from '../data/mockData';

export interface FirebaseWebConfig {
  firebaseApiKey: string;
  firebaseAuthDomain: string;
  firebaseProjectId: string;
  firebaseStorageBucket: string;
  firebaseMessagingSenderId: string;
  firebaseAppId: string;
}

export const normalizeAuthDomain = (
  authDomain: string | undefined,
  projectId: string | undefined
): string => {
  const cleanDomain = (authDomain || '')
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '');
  if (cleanDomain) return cleanDomain;
  const cleanProject = (projectId || '').trim();
  return cleanProject ? `${cleanProject}.firebaseapp.com` : '';
};

export const hasFirebaseCredentials = (
  settings: Partial<SystemSettings> | null | undefined
): boolean => {
  return Boolean(
    settings?.firebaseApiKey?.trim() && settings?.firebaseProjectId?.trim()
  );
};

export const readEnvFirebaseConfig = (
  env: Record<string, string | undefined> = typeof import.meta !== 'undefined' &&
  (import.meta as any).env
    ? ((import.meta as any).env as Record<string, string | undefined>)
    : {}
): Partial<SystemSettings> => {
  const apiKey = (env.VITE_FIREBASE_API_KEY || '').trim();
  const projectId = (env.VITE_FIREBASE_PROJECT_ID || '').trim();
  if (!apiKey || !projectId) return {};

  const authDomain = normalizeAuthDomain(env.VITE_FIREBASE_AUTH_DOMAIN, projectId);
  const storageBucket =
    (env.VITE_FIREBASE_STORAGE_BUCKET || '').trim() || `${projectId}.appspot.com`;
  const messagingSenderId = (env.VITE_FIREBASE_MESSAGING_SENDER_ID || '').trim();
  const appId = (env.VITE_FIREBASE_APP_ID || '').trim();

  return {
    firebaseApiKey: apiKey,
    firebaseAuthDomain: authDomain,
    firebaseProjectId: projectId,
    firebaseStorageBucket: storageBucket,
    firebaseMessagingSenderId: messagingSenderId,
    firebaseAppId: appId,
    firebaseConnected: true,
  };
};

export const parseFirebaseConfigSnippet = (
  text: string
): Partial<SystemSettings> | null => {
  const raw = (text || '').trim();
  if (!raw) return null;

  const extract = (key: string): string => {
    const regex = new RegExp(
      `["']?${key}["']?\\s*:\\s*["'\`]([^"'\`]+)["'\`]`
    );
    const m = raw.match(regex);
    return m ? m[1].trim() : '';
  };

  const apiKey = extract('apiKey');
  const projectId = extract('projectId');
  const authDomain = extract('authDomain');
  const storageBucket = extract('storageBucket');
  const messagingSenderId = extract('messagingSenderId');
  const appId = extract('appId');

  if (!apiKey && !projectId && !authDomain && !storageBucket && !messagingSenderId && !appId) {
    return null;
  }

  return {
    ...(apiKey ? { firebaseApiKey: apiKey } : {}),
    ...(projectId ? { firebaseProjectId: projectId } : {}),
    ...(authDomain || projectId
      ? { firebaseAuthDomain: normalizeAuthDomain(authDomain, projectId) }
      : {}),
    ...(storageBucket ? { firebaseStorageBucket: storageBucket } : {}),
    ...(messagingSenderId ? { firebaseMessagingSenderId: messagingSenderId } : {}),
    ...(appId ? { firebaseAppId: appId } : {}),
  };
};

const toBase64Url = (input: string): string => {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromBase64Url = (encoded: string): string => {
  let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

export const encodeFirebaseShareParam = (
  settings: Partial<SystemSettings>
): string => {
  if (!hasFirebaseCredentials(settings)) return '';
  const compact = {
    k: settings.firebaseApiKey!.trim(),
    p: settings.firebaseProjectId!.trim(),
    d: normalizeAuthDomain(settings.firebaseAuthDomain, settings.firebaseProjectId),
    b:
      (settings.firebaseStorageBucket || '').trim() ||
      `${settings.firebaseProjectId!.trim()}.appspot.com`,
    m: (settings.firebaseMessagingSenderId || '').trim(),
    a: (settings.firebaseAppId || '').trim(),
  };
  return toBase64Url(JSON.stringify(compact));
};

export const decodeFirebaseShareParam = (
  rawParamOrSearch: string
): Partial<SystemSettings> | null => {
  try {
    let token = (rawParamOrSearch || '').trim();
    if (!token) return null;
    if (token.includes('://')) {
      const urlObj = new URL(token);
      token = urlObj.searchParams.get('fb') || '';
      if (!token && urlObj.hash.includes('fb=')) {
        const hashParams = new URLSearchParams(
          urlObj.hash.replace(/^#/, '').replace(/^\?/, '')
        );
        token = hashParams.get('fb') || '';
      }
    } else if (token.startsWith('?') || token.startsWith('#') || token.includes('fb=')) {
      const idx = token.indexOf('fb=');
      const queryPart =
        token.startsWith('?') || token.startsWith('#')
          ? `?${token.slice(1)}`
          : `?${token.slice(idx)}`;
      const params = new URLSearchParams(queryPart);
      token = params.get('fb') || '';
    }
    if (!token) return null;

    const parsed = JSON.parse(fromBase64Url(token));
    const apiKey = typeof parsed?.k === 'string' ? parsed.k.trim() : '';
    const projectId = typeof parsed?.p === 'string' ? parsed.p.trim() : '';
    if (!apiKey || !projectId) return null;

    return {
      firebaseApiKey: apiKey,
      firebaseProjectId: projectId,
      firebaseAuthDomain: normalizeAuthDomain(parsed.d, projectId),
      firebaseStorageBucket:
        typeof parsed.b === 'string' && parsed.b.trim()
          ? parsed.b.trim()
          : `${projectId}.appspot.com`,
      firebaseMessagingSenderId:
        typeof parsed.m === 'string' ? parsed.m.trim() : '',
      firebaseAppId: typeof parsed.a === 'string' ? parsed.a.trim() : '',
      firebaseConnected: true,
    };
  } catch {
    return null;
  }
};

export const extractFirebaseConfigFromInput = (
  input: string
): Partial<SystemSettings> | null => {
  const fromShare = decodeFirebaseShareParam(input);
  if (fromShare && hasFirebaseCredentials(fromShare)) {
    return fromShare;
  }
  const fromSnippet = parseFirebaseConfigSnippet(input);
  if (fromSnippet && hasFirebaseCredentials(fromSnippet)) {
    return {
      ...fromSnippet,
      firebaseConnected: true,
    };
  }
  return null;
};

export const parseRuntimeFirebaseConfigJson = (
  data: unknown
): Partial<SystemSettings> | null => {
  if (!data || typeof data !== 'object') return null;
  const obj = data as Record<string, unknown>;
  const apiKey =
    typeof obj.apiKey === 'string'
      ? obj.apiKey.trim()
      : typeof obj.firebaseApiKey === 'string'
        ? obj.firebaseApiKey.trim()
        : '';
  const projectId =
    typeof obj.projectId === 'string'
      ? obj.projectId.trim()
      : typeof obj.firebaseProjectId === 'string'
        ? obj.firebaseProjectId.trim()
        : '';
  if (!apiKey || !projectId) return null;

  const rawAuthDomain =
    typeof obj.authDomain === 'string'
      ? obj.authDomain
      : typeof obj.firebaseAuthDomain === 'string'
        ? obj.firebaseAuthDomain
        : '';
  const rawStorageBucket =
    typeof obj.storageBucket === 'string'
      ? obj.storageBucket.trim()
      : typeof obj.firebaseStorageBucket === 'string'
        ? obj.firebaseStorageBucket.trim()
        : '';
  const rawMessagingSenderId =
    typeof obj.messagingSenderId === 'string'
      ? obj.messagingSenderId.trim()
      : typeof obj.firebaseMessagingSenderId === 'string'
        ? obj.firebaseMessagingSenderId.trim()
        : '';
  const rawAppId =
    typeof obj.appId === 'string'
      ? obj.appId.trim()
      : typeof obj.firebaseAppId === 'string'
        ? obj.firebaseAppId.trim()
        : '';

  return {
    firebaseApiKey: apiKey,
    firebaseProjectId: projectId,
    firebaseAuthDomain: normalizeAuthDomain(rawAuthDomain, projectId),
    firebaseStorageBucket: rawStorageBucket || `${projectId}.appspot.com`,
    firebaseMessagingSenderId: rawMessagingSenderId,
    firebaseAppId: rawAppId,
    firebaseConnected: true,
  };
};

export const buildNetlifyEnvSnippet = (
  settings: Partial<SystemSettings>
): string => {
  const projectId = (settings.firebaseProjectId || '').trim();
  const lines = [
    `VITE_FIREBASE_API_KEY=${(settings.firebaseApiKey || '').trim()}`,
    `VITE_FIREBASE_AUTH_DOMAIN=${normalizeAuthDomain(settings.firebaseAuthDomain, projectId)}`,
    `VITE_FIREBASE_PROJECT_ID=${projectId}`,
    `VITE_FIREBASE_STORAGE_BUCKET=${(settings.firebaseStorageBucket || '').trim() || (projectId ? `${projectId}.appspot.com` : '')}`,
    `VITE_FIREBASE_MESSAGING_SENDER_ID=${(settings.firebaseMessagingSenderId || '').trim()}`,
    `VITE_FIREBASE_APP_ID=${(settings.firebaseAppId || '').trim()}`,
  ];
  return lines.join('\n');
};

export const buildFirebaseRuntimeConfigJson = (
  settings: Partial<SystemSettings>
): string => {
  const projectId = (settings.firebaseProjectId || '').trim();
  return JSON.stringify(
    {
      apiKey: (settings.firebaseApiKey || '').trim(),
      authDomain: normalizeAuthDomain(settings.firebaseAuthDomain, projectId),
      projectId,
      storageBucket:
        (settings.firebaseStorageBucket || '').trim() ||
        (projectId ? `${projectId}.appspot.com` : ''),
      messagingSenderId: (settings.firebaseMessagingSenderId || '').trim(),
      appId: (settings.firebaseAppId || '').trim(),
    },
    null,
    2
  );
};

export const mapFirebaseAuthErrorMessage = (
  errorCode: string | undefined,
  rawMessage: string | undefined,
  currentHostname: string
): { message: string; shouldFallbackToRedirect: boolean } => {
  const code = (errorCode || '').toLowerCase();
  const host = currentHostname || 'this domain';

  if (
    code === 'auth/popup-blocked' ||
    code === 'auth/operation-not-supported-in-this-environment' ||
    code === 'auth/cancelled-popup-request'
  ) {
    return {
      message: 'Popup was blocked by browser. Redirecting to Google Sign-In...',
      shouldFallbackToRedirect: true,
    };
  }

  if (code === 'auth/unauthorized-domain') {
    return {
      message: `Domain "${host}" is not authorized in your Firebase project. Open Firebase Console -> Authentication -> Settings -> Authorized domains and add "${host}".`,
      shouldFallbackToRedirect: false,
    };
  }

  if (code === 'auth/operation-not-allowed') {
    return {
      message:
        'Google Sign-In is not enabled in your Firebase project. Open Authentication -> Sign-in method -> Enable Google.',
      shouldFallbackToRedirect: false,
    };
  }

  if (code === 'auth/configuration-not-found') {
    return {
      message:
        'Firebase Authentication is not activated yet in this Firebase project. Open Firebase Console -> Authentication -> Get Started, then enable Google Sign-In.',
      shouldFallbackToRedirect: false,
    };
  }

  if (code === 'auth/invalid-api-key') {
    return {
      message:
        'Firebase API Key is invalid. Please check System Settings -> Firebase Cloud Sync.',
      shouldFallbackToRedirect: false,
    };
  }

  if (code === 'auth/popup-closed-by-user') {
    return {
      message: 'Google Sign-In window was closed before completing login.',
      shouldFallbackToRedirect: false,
    };
  }

  if (code === 'auth/network-request-failed') {
    return {
      message:
        'Network error while contacting Google Auth. Check your internet connection and retry.',
      shouldFallbackToRedirect: false,
    };
  }

  return {
    message:
      rawMessage ||
      'Google Sign-In failed. Ensure Google Auth is enabled and this domain is added to Authorized Domains in Firebase Console.',
    shouldFallbackToRedirect: false,
  };
};
