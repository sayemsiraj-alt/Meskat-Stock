import { SystemSettings } from '../data/mockData';
import { getThemeConfig } from './themeConfig';

export interface CompanyPwaBranding {
  appName: string;
  shortName: string;
  description: string;
  monogram: string;
  logoUrl: string;
  themeColor: string;
  backgroundColor: string;
}

export interface GeneratedAppIcons {
  icon192Url: string;
  icon512Url: string;
  maskable512Url: string;
  appleTouchUrl: string;
}

export const ERP_DYNAMIC_BRANDING_CACHE = 'erp-dynamic-branding-v1';

const DEFAULT_APP_NAME = 'Stock ERP';
const DEFAULT_SHORT_NAME = 'Stock ERP';
const MAX_URL_LOGO_PARAM_LENGTH = 2200;

export const deriveShortAppName = (
  brandShortName?: string,
  brandName?: string,
  storeName?: string
): string => {
  const candidates = [brandShortName, brandName, storeName]
    .map((val) => (val || '').trim())
    .filter(Boolean);

  if (candidates.length === 0) {
    return DEFAULT_SHORT_NAME;
  }

  const primaryFull = (brandName || storeName || '').trim();
  if (primaryFull && primaryFull.length <= 12) {
    return primaryFull;
  }

  const preferredShort = (brandShortName || '').trim();
  if (preferredShort) {
    return preferredShort.length <= 12
      ? preferredShort
      : preferredShort.slice(0, 12).trim();
  }

  const firstWord = primaryFull.split(/\s+/)[0] || primaryFull;
  if (firstWord.length <= 12) {
    return firstWord;
  }

  return firstWord.slice(0, 12).trim() || DEFAULT_SHORT_NAME;
};

export const deriveMonogram = (
  shortName: string,
  brandName?: string
): string => {
  const source = (brandName || shortName || 'SE').trim();
  const words = source
    .replace(/[^a-zA-Z0-9\u0980-\u09FF\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length >= 2) {
    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  }
  const cleanSingle = (words[0] || shortName || 'SE').trim();
  return cleanSingle.slice(0, 2).toUpperCase() || 'SE';
};

export const buildCompanyPwaBranding = (
  settings: Pick<
    SystemSettings,
    'brandName' | 'brandShortName' | 'storeName' | 'logoUrl' | 'activeTheme'
  >
): CompanyPwaBranding => {
  const brandClean = (settings.brandName || '').trim();
  const storeClean = (settings.storeName || '').trim();
  const appName = brandClean || storeClean || DEFAULT_APP_NAME;
  const shortName = deriveShortAppName(
    settings.brandShortName,
    settings.brandName,
    settings.storeName
  );
  const monogram = deriveMonogram(shortName, brandClean || storeClean);
  const theme = getThemeConfig(settings.activeTheme);
  const themeColor = theme.previewAccent || '#10B981';

  return {
    appName,
    shortName,
    description: `${appName} — Real-time Stock, POS, Wholesale Billing & Accounts ERP.`,
    monogram,
    logoUrl: (settings.logoUrl || '').trim(),
    themeColor,
    backgroundColor: '#ffffff',
  };
};

export const computeBrandingSignature = (
  branding: Pick<
    CompanyPwaBranding,
    'appName' | 'shortName' | 'themeColor' | 'logoUrl'
  >,
  firebaseProjectId?: string
): string => {
  const raw = `${branding.appName}|${branding.shortName}|${branding.themeColor}|${branding.logoUrl}|${(firebaseProjectId || '').trim()}`;
  let hash = 2166136261;
  for (let i = 0; i < raw.length; i += 1) {
    hash ^= raw.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};

export const buildDynamicServerManifestPath = (
  branding: CompanyPwaBranding,
  options: {
    firebaseProjectId?: string;
    compactLogoUrl?: string;
    brandHash?: string;
  } = {}
): string => {
  const params = new URLSearchParams();
  const fbProj = (options.firebaseProjectId || '').trim();
  if (fbProj) {
    params.set('fbProj', fbProj);
  }
  params.set('name', branding.appName);
  params.set('short', branding.shortName);
  params.set('theme', branding.themeColor);

  const candidateLogo = (options.compactLogoUrl || '').trim() || branding.logoUrl;
  if (
    candidateLogo &&
    candidateLogo.length <= MAX_URL_LOGO_PARAM_LENGTH &&
    (candidateLogo.startsWith('https://') ||
      candidateLogo.startsWith('http://') ||
      candidateLogo.startsWith('data:image/png') ||
      candidateLogo.startsWith('data:image/jpeg') ||
      candidateLogo.startsWith('data:image/jpg'))
  ) {
    params.set('logo', candidateLogo);
  }

  if (options.brandHash) {
    params.set('v', options.brandHash);
  }

  return `/app-manifest.webmanifest?${params.toString()}`;
};

export const buildManifestJsonPayload = (
  branding: CompanyPwaBranding,
  icons: GeneratedAppIcons,
  originUrl?: string
) => {
  const baseOrigin = originUrl
    ? originUrl.replace(/\/+$/, '') + '/'
    : '/';

  return {
    id: baseOrigin,
    name: branding.appName,
    short_name: branding.shortName,
    description: branding.description,
    theme_color: branding.themeColor,
    background_color: branding.backgroundColor,
    display: 'standalone' as const,
    orientation: 'any' as const,
    scope: baseOrigin,
    start_url: baseOrigin,
    icons: [
      {
        src: icons.icon192Url,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: icons.icon512Url,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: icons.maskable512Url,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
};

const drawRoundedRectPath = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) => {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
};

const loadImageElement = (src: string): Promise<HTMLImageElement | null> => {
  return new Promise((resolve) => {
    if (typeof Image === 'undefined' || !src) {
      resolve(null);
      return;
    }
    const img = new Image();
    if (!src.startsWith('data:') && !src.startsWith('blob:')) {
      img.crossOrigin = 'anonymous';
    }
    let settled = false;
    const finish = (result: HTMLImageElement | null) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    const timeout = window.setTimeout(() => finish(null), 4000);
    img.onload = () => {
      window.clearTimeout(timeout);
      finish(img.naturalWidth > 0 ? img : null);
    };
    img.onerror = () => {
      window.clearTimeout(timeout);
      finish(null);
    };
    img.src = src;
  });
};

const renderCompactTransportLogo = (
  loadedLogo: HTMLImageElement | null,
  rawLogoUrl: string
): string => {
  const cleanRaw = (rawLogoUrl || '').trim();
  if (!cleanRaw) return '';
  if (
    cleanRaw.length <= MAX_URL_LOGO_PARAM_LENGTH &&
    (cleanRaw.startsWith('https://') ||
      cleanRaw.startsWith('http://') ||
      cleanRaw.startsWith('data:image/png') ||
      cleanRaw.startsWith('data:image/jpeg') ||
      cleanRaw.startsWith('data:image/jpg'))
  ) {
    return cleanRaw;
  }

  if (!loadedLogo || typeof document === 'undefined') return '';

  const tryEncode = (dim: number, mime: 'image/png' | 'image/jpeg', quality?: number): string => {
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, dim / Math.max(loadedLogo.naturalWidth, loadedLogo.naturalHeight));
    const w = Math.max(1, Math.round(loadedLogo.naturalWidth * scale));
    const h = Math.max(1, Math.round(loadedLogo.naturalHeight * scale));
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    if (mime === 'image/jpeg') {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, w, h);
    } else {
      ctx.clearRect(0, 0, w, h);
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(loadedLogo, 0, 0, w, h);
    try {
      return quality !== undefined ? canvas.toDataURL(mime, quality) : canvas.toDataURL(mime);
    } catch {
      return '';
    }
  };

  const candidates = [
    tryEncode(48, 'image/png'),
    tryEncode(56, 'image/jpeg', 0.8),
    tryEncode(44, 'image/jpeg', 0.72),
    tryEncode(36, 'image/jpeg', 0.62),
  ];

  for (const dataUrl of candidates) {
    if (dataUrl && dataUrl.length <= MAX_URL_LOGO_PARAM_LENGTH) {
      return dataUrl;
    }
  }

  return '';
};

const renderSinglePngDataUrl = (
  size: number,
  branding: CompanyPwaBranding,
  loadedLogo: HTMLImageElement | null,
  isMaskable: boolean
): string | null => {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  if (loadedLogo) {
    if (isMaskable) {
      const grad = ctx.createLinearGradient(0, 0, size, size);
      grad.addColorStop(0, '#f8fafc');
      grad.addColorStop(1, '#ecfdf5');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);
    } else {
      ctx.clearRect(0, 0, size, size);
      ctx.fillStyle = '#ffffff';
      drawRoundedRectPath(ctx, 0, 0, size, size, size * 0.22);
      ctx.fill();

      ctx.strokeStyle = 'rgba(15, 23, 42, 0.08)';
      ctx.lineWidth = Math.max(2, size * 0.015);
      drawRoundedRectPath(
        ctx,
        ctx.lineWidth / 2,
        ctx.lineWidth / 2,
        size - ctx.lineWidth,
        size - ctx.lineWidth,
        size * 0.22
      );
      ctx.stroke();
    }

    const padRatio = isMaskable ? 0.2 : 0.12;
    const maxW = size * (1 - padRatio * 2);
    const maxH = size * (1 - padRatio * 2);
    const scale = Math.min(maxW / loadedLogo.naturalWidth, maxH / loadedLogo.naturalHeight);
    const drawW = loadedLogo.naturalWidth * scale;
    const drawH = loadedLogo.naturalHeight * scale;
    const drawX = (size - drawW) / 2;
    const drawY = (size - drawH) / 2;

    try {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(loadedLogo, drawX, drawY, drawW, drawH);
      return canvas.toDataURL('image/png');
    } catch {
      // Fall back to crisp monogram badge if remote URL tainted canvas
    }
  }

  const bgGrad = ctx.createLinearGradient(0, 0, size, size);
  bgGrad.addColorStop(0, branding.themeColor);
  bgGrad.addColorStop(1, '#0f766e');

  if (isMaskable) {
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, size, size);
  } else {
    ctx.fillStyle = bgGrad;
    drawRoundedRectPath(ctx, 0, 0, size, size, size * 0.22);
    ctx.fill();
  }

  const cardPad = isMaskable ? size * 0.18 : size * 0.14;
  const cardSize = size - cardPad * 2;
  ctx.fillStyle = '#ffffff';
  drawRoundedRectPath(ctx, cardPad, cardPad, cardSize, cardSize, cardSize * 0.24);
  ctx.fill();

  ctx.fillStyle = '#065f46';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const fontSize = Math.round(
    cardSize * (branding.monogram.length >= 3 ? 0.36 : 0.46)
  );
  ctx.font = `800 ${fontSize}px Inter, system-ui, -apple-system, sans-serif`;
  ctx.fillText(branding.monogram, size / 2, size / 2 + fontSize * 0.04);

  const dotR = cardSize * 0.085;
  ctx.beginPath();
  ctx.arc(cardPad + cardSize - dotR * 1.8, cardPad + cardSize - dotR * 1.8, dotR, 0, Math.PI * 2);
  ctx.fillStyle = '#10b981';
  ctx.fill();

  return canvas.toDataURL('image/png');
};

export const generateCompanyPwaIcons = async (
  branding: CompanyPwaBranding
): Promise<GeneratedAppIcons & { compactLogoUrl?: string }> => {
  const fallback: GeneratedAppIcons = {
    icon192Url: '/pwa-192x192.png',
    icon512Url: '/pwa-512x512.png',
    maskable512Url: '/pwa-maskable-512x512.png',
    appleTouchUrl: '/apple-touch-icon.png',
  };

  if (typeof document === 'undefined') {
    return fallback;
  }

  const loadedLogo = branding.logoUrl
    ? await loadImageElement(branding.logoUrl)
    : null;

  const icon192 = renderSinglePngDataUrl(192, branding, loadedLogo, false);
  const icon512 = renderSinglePngDataUrl(512, branding, loadedLogo, false);
  const maskable512 = renderSinglePngDataUrl(512, branding, loadedLogo, true);
  const apple180 = renderSinglePngDataUrl(180, branding, loadedLogo, false);
  const compactLogoUrl = renderCompactTransportLogo(loadedLogo, branding.logoUrl);

  return {
    icon192Url: icon192 || fallback.icon192Url,
    icon512Url: icon512 || fallback.icon512Url,
    maskable512Url: maskable512 || fallback.maskable512Url,
    appleTouchUrl: apple180 || fallback.appleTouchUrl,
    compactLogoUrl,
  };
};

const dataUrlToPngBlob = (dataUrl: string): Blob | null => {
  if (!dataUrl || !dataUrl.startsWith('data:image/')) return null;
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx === -1) return null;
  try {
    const header = dataUrl.slice(0, commaIdx);
    const mimeMatch = header.match(/data:([^;]+)/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
    const base64 = dataUrl.slice(commaIdx + 1);
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: mimeType });
  } catch {
    return null;
  }
};

const cacheDynamicBrandingAssets = async (
  icons: GeneratedAppIcons,
  manifestPayload: ReturnType<typeof buildManifestJsonPayload>,
  serverManifestPath: string
): Promise<boolean> => {
  if (typeof caches === 'undefined') return false;
  try {
    const cache = await caches.open(ERP_DYNAMIC_BRANDING_CACHE);
    const pngHeaders = {
      'Content-Type': 'image/png',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    };

    const assetPairs: Array<[string, string]> = [
      ['/pwa-192x192.png', icons.icon192Url],
      ['/pwa-512x512.png', icons.icon512Url],
      ['/pwa-maskable-512x512.png', icons.maskable512Url],
      ['/apple-touch-icon.png', icons.appleTouchUrl],
    ];

    for (const [path, dataUrl] of assetPairs) {
      const blob = dataUrlToPngBlob(dataUrl);
      if (blob) {
        await cache.put(path, new Response(blob, { status: 200, headers: pngHeaders }));
      }
    }

    const manifestHeaders = {
      'Content-Type': 'application/manifest+json; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    };
    const manifestJson = JSON.stringify(manifestPayload);

    await cache.put(
      '/manifest.webmanifest',
      new Response(manifestJson, { status: 200, headers: manifestHeaders })
    );
    await cache.put(
      serverManifestPath,
      new Response(manifestJson, { status: 200, headers: manifestHeaders })
    );
    return true;
  } catch {
    return false;
  }
};

const upsertHeadLink = (
  selector: string,
  attrs: Record<string, string>
) => {
  let link = document.querySelector<HTMLLinkElement>(selector);
  if (!link) {
    link = document.createElement('link');
    document.head.appendChild(link);
  }
  Object.entries(attrs).forEach(([k, v]) => {
    link!.setAttribute(k, v);
  });
};

const upsertHeadMeta = (name: string, content: string) => {
  let meta = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = name;
    document.head.appendChild(meta);
  }
  meta.content = content;
};

const readStoredFirebaseProjectId = (): string => {
  if (typeof localStorage === 'undefined') return '';
  try {
    const raw = localStorage.getItem('stock_erp_settings');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed?.firebaseProjectId === 'string' && parsed.firebaseProjectId.trim()) {
        return parsed.firebaseProjectId.trim();
      }
    }
    const backup = localStorage.getItem('stock_erp_firebase_backup');
    if (backup) {
      const parsed = JSON.parse(backup);
      if (typeof parsed?.firebaseProjectId === 'string' && parsed.firebaseProjectId.trim()) {
        return parsed.firebaseProjectId.trim();
      }
    }
  } catch {
    // ignore storage read errors
  }
  return '';
};

export const SW_BRANDING_VERSION_STORAGE_KEY = 'stock_erp_sw_branding_version';

const BRANDING_SW_RELOAD_SUPPRESS_WINDOW_MS = 10000;
let suppressNextBrandingSwReloadUntil = 0;

export const markSuppressBrandingSwReload = (windowMs = BRANDING_SW_RELOAD_SUPPRESS_WINDOW_MS) => {
  suppressNextBrandingSwReloadUntil = Date.now() + windowMs;
};

export const isBrandingSwReloadSuppressed = (): boolean => {
  return Date.now() <= suppressNextBrandingSwReloadUntil;
};

export const consumeBrandingSwReloadSuppression = (): boolean => {
  if (isBrandingSwReloadSuppressed()) {
    suppressNextBrandingSwReloadUntil = 0;
    return true;
  }
  return false;
};

export const buildVersionedSwUrl = (
  baseSwUrl: string,
  versionId: string
): string => {
  const cleanBase = (baseSwUrl || '/sw.js').trim() || '/sw.js';
  const cleanVersion = (versionId || '').trim();
  try {
    const parsed = new URL(cleanBase, 'https://localhost');
    if (cleanVersion) {
      parsed.searchParams.set('v', cleanVersion);
    } else {
      parsed.searchParams.delete('v');
    }
    const query = parsed.searchParams.toString();
    return query ? `${parsed.pathname}?${query}` : parsed.pathname;
  } catch {
    const pathOnly = cleanBase.split('?')[0] || '/sw.js';
    return cleanVersion ? `${pathOnly}?v=${encodeURIComponent(cleanVersion)}` : pathOnly;
  }
};

export const extractSwVersionIdentifier = (scriptUrl?: string | null): string => {
  const raw = (scriptUrl || '').trim();
  if (!raw) return '';
  try {
    const parsed = new URL(raw, 'https://localhost');
    return (parsed.searchParams.get('v') || '').trim();
  } catch {
    return '';
  }
};

export const readStoredSwBrandingVersion = (
  storage?: Pick<Storage, 'getItem'> | null
): string => {
  const target = storage !== undefined ? storage : typeof localStorage !== 'undefined' ? localStorage : null;
  if (!target) return '';
  try {
    return (target.getItem(SW_BRANDING_VERSION_STORAGE_KEY) || '').trim();
  } catch {
    return '';
  }
};

export interface ServiceWorkerRegistrationLike {
  active?: { scriptURL?: string; postMessage?: (msg: unknown) => void } | null;
  waiting?: { scriptURL?: string; postMessage?: (msg: unknown) => void } | null;
  installing?: { scriptURL?: string; postMessage?: (msg: unknown) => void } | null;
  update?: () => Promise<unknown>;
}

export interface ServiceWorkerContainerLike {
  controller?: { scriptURL?: string; postMessage?: (msg: unknown) => void } | null;
  getRegistration?: (clientURL?: string) => Promise<ServiceWorkerRegistrationLike | undefined>;
  register: (
    scriptURL: string,
    options?: { scope?: string; updateViaCache?: ServiceWorkerUpdateViaCache }
  ) => Promise<ServiceWorkerRegistrationLike>;
}

export interface ServiceWorkerBrandingSyncResult {
  updated: boolean;
  previousVersion: string;
  version: string;
  swUrl: string;
  refetchedUrls: string[];
}

export const refetchDynamicPwaAssets = async (
  urls: string[],
  options: {
    cacheName?: string;
    cacheStorage?: Pick<CacheStorage, 'open'> | null;
    fetchFn?: typeof fetch;
  } = {}
): Promise<string[]> => {
  const uniqueUrls = Array.from(
    new Set(urls.map((u) => (u || '').trim()).filter(Boolean))
  );
  if (uniqueUrls.length === 0) return [];

  const fetchImpl =
    options.fetchFn || (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
  if (!fetchImpl) return [];

  const cacheTarget =
    options.cacheStorage !== undefined
      ? options.cacheStorage
      : typeof caches !== 'undefined'
        ? caches
        : null;

  let cache: Cache | null = null;
  if (cacheTarget) {
    try {
      cache = await cacheTarget.open(options.cacheName || ERP_DYNAMIC_BRANDING_CACHE);
    } catch {
      cache = null;
    }
  }

  const refetchedUrls: string[] = [];
  await Promise.all(
    uniqueUrls.map(async (url) => {
      try {
        const res = await fetchImpl(url, { cache: 'reload' });
        if (res && res.ok) {
          refetchedUrls.push(url);
          if (cache) {
            await cache.put(url, res.clone());
          }
        }
      } catch {
        // Ignore offline/network failures; runtime fallback cache remains intact
      }
    })
  );

  return refetchedUrls;
};

let lastSyncedRuntimeBrandingVersion = '';

export const resetBrandingSyncMemoForTests = () => {
  lastSyncedRuntimeBrandingVersion = '';
  suppressNextBrandingSwReloadUntil = 0;
};

export const syncServiceWorkerBrandingVersion = async (
  versionId: string,
  options: {
    swContainer?: ServiceWorkerContainerLike | null;
    baseSwUrl?: string;
    scope?: string;
    storage?: Pick<Storage, 'getItem' | 'setItem'> | null;
    cacheStorage?: Pick<CacheStorage, 'open'> | null;
    fetchFn?: typeof fetch;
    manifestUrl?: string;
    iconUrls?: string[];
    forceRefetch?: boolean;
  } = {}
): Promise<ServiceWorkerBrandingSyncResult> => {
  const cleanVersion = (versionId || '').trim();
  const baseUrl = (options.baseSwUrl || '/sw.js').trim() || '/sw.js';
  const scope = options.scope || '/';
  const storageTarget =
    options.storage !== undefined
      ? options.storage
      : typeof localStorage !== 'undefined'
        ? localStorage
        : null;

  const storedVersion = readStoredSwBrandingVersion(storageTarget);
  const swContainer =
    options.swContainer !== undefined
      ? options.swContainer
      : typeof navigator !== 'undefined' && 'serviceWorker' in navigator
        ? (navigator.serviceWorker as unknown as ServiceWorkerContainerLike)
        : null;

  let existingReg: ServiceWorkerRegistrationLike | undefined;
  let existingScriptUrl = '';
  if (swContainer?.getRegistration) {
    try {
      existingReg = await swContainer.getRegistration(scope);
      existingScriptUrl =
        existingReg?.active?.scriptURL ||
        existingReg?.waiting?.scriptURL ||
        existingReg?.installing?.scriptURL ||
        swContainer.controller?.scriptURL ||
        '';
    } catch {
      existingReg = undefined;
    }
  }

  const activeSwVersion = extractSwVersionIdentifier(existingScriptUrl);
  const previousVersion = activeSwVersion || storedVersion;

  const isViteDev = Boolean((import.meta as { env?: { DEV?: boolean } })?.env?.DEV);
  const isDevSw = isViteDev || existingScriptUrl.includes('dev-sw') || baseUrl.includes('dev-sw');
  const effectiveBaseUrl =
    existingScriptUrl && existingScriptUrl.includes('dev-sw')
      ? (() => {
          try {
            const u = new URL(existingScriptUrl);
            return `${u.pathname}${u.search}`;
          } catch {
            return baseUrl;
          }
        })()
      : isDevSw
        ? '/dev-sw.js?dev-sw'
        : baseUrl;

  const versionedSwUrl = isDevSw
    ? effectiveBaseUrl
    : buildVersionedSwUrl(effectiveBaseUrl, cleanVersion);
  const versionChanged =
    Boolean(cleanVersion) &&
    (activeSwVersion !== cleanVersion || storedVersion !== cleanVersion);

  let updated = false;

  if (swContainer && cleanVersion && (versionChanged || !existingReg)) {
    try {
      markSuppressBrandingSwReload();
      const nextReg = isDevSw
        ? existingReg
        : await swContainer.register(versionedSwUrl, {
            scope,
            updateViaCache: 'none',
          });
      updated = Boolean(nextReg) || !isDevSw;

      try {
        await nextReg?.update?.();
      } catch {
        // Ignore transient update check failure
      }

      const workerTarget =
        nextReg?.active ||
        nextReg?.waiting ||
        nextReg?.installing ||
        swContainer.controller;
      workerTarget?.postMessage?.({
        type: 'ERP_SYNC_BRANDING',
        version: cleanVersion,
        manifestUrl: options.manifestUrl || '',
        iconUrls: options.iconUrls || [],
      });
    } catch {
      // Ignore SW registration failure in restricted environments (e.g. non-HTTPS / tests)
    }
  }

  if (storageTarget && cleanVersion) {
    try {
      storageTarget.setItem(SW_BRANDING_VERSION_STORAGE_KEY, cleanVersion);
    } catch {
      // ignore storage quota errors
    }
  }

  const shouldRefetch =
    Boolean(options.forceRefetch) ||
    updated ||
    (Boolean(cleanVersion) &&
      (lastSyncedRuntimeBrandingVersion !== cleanVersion || storedVersion !== cleanVersion));

  let refetchedUrls: string[] = [];
  if (shouldRefetch) {
    const assetUrls = [
      ...(options.manifestUrl ? [options.manifestUrl] : []),
      ...(options.iconUrls || []),
    ];
    refetchedUrls = await refetchDynamicPwaAssets(assetUrls, {
      cacheStorage: options.cacheStorage,
      fetchFn: options.fetchFn,
    });
    if (cleanVersion) {
      lastSyncedRuntimeBrandingVersion = cleanVersion;
    }
  }

  return {
    updated,
    previousVersion,
    version: cleanVersion,
    swUrl: versionedSwUrl,
    refetchedUrls,
  };
};

export const syncDynamicPwaBranding = async (
  settings: Pick<
    SystemSettings,
    'brandName' | 'brandShortName' | 'storeName' | 'logoUrl' | 'activeTheme' | 'firebaseProjectId'
  >,
  options: { forceRefetch?: boolean } = {}
): Promise<{
  branding: CompanyPwaBranding;
  icons: GeneratedAppIcons;
  manifestHref: string;
  brandHash: string;
  swSync?: ServiceWorkerBrandingSyncResult;
}> => {
  const branding = buildCompanyPwaBranding(settings);
  const firebaseProjectId =
    (settings.firebaseProjectId || '').trim() || readStoredFirebaseProjectId();
  const brandHash = computeBrandingSignature(branding, firebaseProjectId);

  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return {
      branding,
      icons: {
        icon192Url: '/app-icon-192.png',
        icon512Url: '/app-icon-512.png',
        maskable512Url: '/app-icon-maskable-512.png',
        appleTouchUrl: '/app-apple-touch-icon.png',
      },
      manifestHref: buildDynamicServerManifestPath(branding, { firebaseProjectId, brandHash }),
      brandHash,
    };
  }

  document.title = `${branding.appName} — Stock ERP`;
  upsertHeadMeta('apple-mobile-web-app-title', branding.shortName);
  upsertHeadMeta('application-name', branding.shortName);
  upsertHeadMeta('theme-color', branding.themeColor);
  upsertHeadMeta('description', branding.description);

  const generated = await generateCompanyPwaIcons(branding);

  const serverManifestPath = buildDynamicServerManifestPath(branding, {
    firebaseProjectId,
    compactLogoUrl: generated.compactLogoUrl,
    brandHash,
  });

  const manifestQuery = serverManifestPath.includes('?')
    ? serverManifestPath.slice(serverManifestPath.indexOf('?'))
    : '';
  const origin = window.location.origin.replace(/\/+$/, '');
  const httpIcons: GeneratedAppIcons = {
    icon192Url: `${origin}/app-icon-192.png${manifestQuery}`,
    icon512Url: `${origin}/app-icon-512.png${manifestQuery}`,
    maskable512Url: `${origin}/app-icon-maskable-512.png${manifestQuery}`,
    appleTouchUrl: `${origin}/app-apple-touch-icon.png${manifestQuery}`,
  };

  upsertHeadLink('link[rel="icon"]', {
    rel: 'icon',
    type: 'image/png',
    href: generated.icon192Url,
  });

  upsertHeadLink('link[rel="apple-touch-icon"]', {
    rel: 'apple-touch-icon',
    sizes: '180x180',
    href: httpIcons.appleTouchUrl,
  });

  const manifestPayload = buildManifestJsonPayload(branding, httpIcons, origin);
  await cacheDynamicBrandingAssets(generated, manifestPayload, serverManifestPath);

  const currentManifestEl = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  const currentHref = currentManifestEl?.getAttribute('href') || '';
  if (!currentManifestEl || currentHref !== serverManifestPath) {
    currentManifestEl?.remove();
    const manifestLink = document.createElement('link');
    manifestLink.rel = 'manifest';
    manifestLink.href = serverManifestPath;
    document.head.appendChild(manifestLink);
  }

  const fullManifestUrl = `${origin}${serverManifestPath}`;
  const swSync = await syncServiceWorkerBrandingVersion(brandHash, {
    manifestUrl: fullManifestUrl,
    iconUrls: [
      httpIcons.icon192Url,
      httpIcons.icon512Url,
      httpIcons.maskable512Url,
      httpIcons.appleTouchUrl,
    ],
    forceRefetch: options.forceRefetch,
  });

  return { branding, icons: generated, manifestHref: serverManifestPath, brandHash, swSync };
};

