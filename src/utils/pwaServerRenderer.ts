import { PNG } from 'pngjs';
import jpeg from 'jpeg-js';

export interface ServerPwaBranding {
  appName: string;
  shortName: string;
  description: string;
  monogram: string;
  logoUrl: string;
  themeColor: string;
  backgroundColor: string;
}

export interface DecodedRgbaImage {
  width: number;
  height: number;
  data: Uint8Array;
}

const DEFAULT_APP_NAME = 'Stock ERP';
const DEFAULT_SHORT_NAME = 'Stock ERP';
const DEFAULT_THEME_HEX = '#10B981';

const THEME_HEX_BY_ID: Record<string, string> = {
  'emerald-enterprise': '#10B981',
  'royal-sapphire': '#2563EB',
  'crimson-velvet': '#E11D48',
  'midnight-indigo': '#4F46E5',
  'amber-gold': '#D97706',
  'obsidian-teal': '#0D9488',
  'slate-minimal': '#334155',
  'violet-aurora': '#7C3AED',
};

const GLYPH_WIDTH = 5;
const GLYPH_HEIGHT = 7;

const BITMAP_FONT_5X7: Record<string, string[]> = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01111', '10000', '10000', '10111', '10001', '10001', '01111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['01110', '00100', '00100', '00100', '00100', '00100', '01110'],
  J: ['00111', '00010', '00010', '00010', '10010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '11011', '10001'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  '0': ['01110', '10011', '10101', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00110', '01000', '10000', '11111'],
  '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['01110', '10000', '11110', '10001', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00001', '01110'],
};

const clampByte = (v: number): number => Math.max(0, Math.min(255, Math.round(v)));

const parseHexRgb = (hex: string): [number, number, number] => {
  const clean = hex.replace('#', '').trim();
  if (!/^[0-9a-f]{6}$/i.test(clean)) {
    return [16, 185, 129];
  }
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
};

export const normalizeThemeHex = (theme?: string, activeTheme?: string): string => {
  const raw = (theme || '').trim();
  if (/^#[0-9a-f]{6}$/i.test(raw)) {
    return raw.toUpperCase();
  }
  if (raw && /^[0-9a-f]{6}$/i.test(raw)) {
    return `#${raw.toUpperCase()}`;
  }
  if (activeTheme && THEME_HEX_BY_ID[activeTheme]) {
    return THEME_HEX_BY_ID[activeTheme];
  }
  return DEFAULT_THEME_HEX;
};

export const deriveServerShortName = (
  brandShortName?: string,
  brandName?: string,
  storeName?: string
): string => {
  const candidates = [brandShortName, brandName, storeName]
    .map((v) => (v || '').trim())
    .filter(Boolean);
  if (candidates.length === 0) return DEFAULT_SHORT_NAME;

  const primaryFull = (brandName || storeName || '').trim();
  if (primaryFull && primaryFull.length <= 12) return primaryFull;

  const preferredShort = (brandShortName || '').trim();
  if (preferredShort) {
    return preferredShort.length <= 12
      ? preferredShort
      : preferredShort.slice(0, 12).trim();
  }

  const firstWord = primaryFull.split(/\s+/)[0] || primaryFull;
  return (firstWord.length <= 12 ? firstWord : firstWord.slice(0, 12).trim()) || DEFAULT_SHORT_NAME;
};

export const deriveServerMonogram = (shortName: string, brandName?: string): string => {
  const source = (brandName || shortName || 'SE').trim();
  const words = source
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length >= 2) {
    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  }
  const cleanSingle = (words[0] || shortName || 'SE').replace(/[^a-zA-Z0-9]/g, '').trim();
  return cleanSingle.slice(0, 2).toUpperCase() || 'ER';
};

export interface FirestoreSettingsSnapshot {
  brandName?: string;
  brandShortName?: string;
  storeName?: string;
  logoUrl?: string;
  activeTheme?: string;
}

const getFirestoreString = (fields: any, key: string): string => {
  const val = fields?.[key]?.stringValue;
  return typeof val === 'string' ? val.trim() : '';
};

export const fetchFirestoreSettingsConfig = async (
  projectId: string,
  timeoutMs = 3500
): Promise<FirestoreSettingsSnapshot | null> => {
  const cleanProject = (projectId || '').trim();
  if (!cleanProject || !/^[a-z0-9-]+$/i.test(cleanProject)) {
    return null;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const endpoint = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
      cleanProject
    )}/databases/(default)/documents/settings/config`;
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const json: any = await res.json();
    const fields = json?.fields;
    if (!fields || typeof fields !== 'object') return null;

    return {
      brandName: getFirestoreString(fields, 'brandName'),
      brandShortName: getFirestoreString(fields, 'brandShortName'),
      storeName: getFirestoreString(fields, 'storeName'),
      logoUrl: getFirestoreString(fields, 'logoUrl'),
      activeTheme: getFirestoreString(fields, 'activeTheme'),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
};

export const resolveServerBranding = async (
  params: URLSearchParams
): Promise<ServerPwaBranding> => {
  const fbProj = (params.get('fbProj') || '').trim();
  const queryName = (params.get('name') || '').trim();
  const queryShort = (params.get('short') || '').trim();
  const queryTheme = (params.get('theme') || '').trim();
  const queryLogo = (params.get('logo') || '').trim();

  const remote = fbProj ? await fetchFirestoreSettingsConfig(fbProj) : null;

  const brandName = queryName || remote?.brandName || remote?.storeName || DEFAULT_APP_NAME;
  const shortName = deriveServerShortName(
    queryShort || remote?.brandShortName,
    brandName,
    remote?.storeName
  );
  const themeColor = normalizeThemeHex(queryTheme, remote?.activeTheme);
  const logoUrl = (remote?.logoUrl || queryLogo || '').trim();
  const monogram = deriveServerMonogram(shortName, brandName);

  return {
    appName: brandName,
    shortName,
    description: `${brandName} — Real-time Stock, POS, Wholesale Billing & Accounts ERP.`,
    monogram,
    logoUrl,
    themeColor,
    backgroundColor: '#FFFFFF',
  };
};

export const decodeImageBuffer = (buf: Uint8Array | Buffer): DecodedRgbaImage | null => {
  if (!buf || buf.length < 12) return null;

  // PNG signature: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    try {
      const parsed = PNG.sync.read(Buffer.from(buf));
      if (parsed.width > 0 && parsed.height > 0 && parsed.data?.length === parsed.width * parsed.height * 4) {
        return {
          width: parsed.width,
          height: parsed.height,
          data: new Uint8Array(parsed.data),
        };
      }
    } catch {
      return null;
    }
  }

  // JPEG signature: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    try {
      const parsed = jpeg.decode(buf, { useTArray: true, formatAsRGBA: true });
      if (parsed.width > 0 && parsed.height > 0 && parsed.data?.length === parsed.width * parsed.height * 4) {
        return {
          width: parsed.width,
          height: parsed.height,
          data: parsed.data,
        };
      }
    } catch {
      return null;
    }
  }

  return null;
};

export const fetchOrDecodeLogo = async (
  logoUrl: string,
  timeoutMs = 3500
): Promise<DecodedRgbaImage | null> => {
  const clean = (logoUrl || '').trim();
  if (!clean) return null;

  if (clean.startsWith('data:image/')) {
    const commaIdx = clean.indexOf(',');
    if (commaIdx === -1) return null;
    const header = clean.slice(0, commaIdx).toLowerCase();
    if (!header.includes('image/png') && !header.includes('image/jpeg') && !header.includes('image/jpg')) {
      return null;
    }
    const base64Part = clean.slice(commaIdx + 1);
    try {
      const buf = Buffer.from(base64Part, 'base64');
      return decodeImageBuffer(buf);
    } catch {
      return null;
    }
  }

  if (clean.startsWith('https://') || clean.startsWith('http://')) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(clean, {
        method: 'GET',
        signal: controller.signal,
      });
      if (!res.ok) return null;
      const contentLen = Number(res.headers.get('content-length') || '0');
      if (contentLen > 4 * 1024 * 1024) return null;
      const ab = await res.arrayBuffer();
      if (ab.byteLength > 4 * 1024 * 1024) return null;
      return decodeImageBuffer(new Uint8Array(ab));
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  return null;
};

// Signed Distance Function for rounded rectangle centered at canvas
const roundedRectAlpha = (
  x: number,
  y: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
  radius: number
): number => {
  const cx = rx + rw / 2;
  const cy = ry + rh / 2;
  const hx = rw / 2 - radius;
  const hy = rh / 2 - radius;
  const dx = Math.max(Math.abs(x - cx) - hx, 0);
  const dy = Math.max(Math.abs(y - cy) - hy, 0);
  const dist = Math.hypot(dx, dy) - radius;
  // 1px anti-aliased edge transition
  return Math.max(0, Math.min(1, 0.5 - dist));
};

const blendPixel = (
  buf: Uint8Array,
  idx: number,
  sr: number,
  sg: number,
  sb: number,
  sa: number
) => {
  if (sa <= 0) return;
  if (sa >= 0.999 && buf[idx + 3] === 0) {
    buf[idx] = clampByte(sr);
    buf[idx + 1] = clampByte(sg);
    buf[idx + 2] = clampByte(sb);
    buf[idx + 3] = 255;
    return;
  }

  const da = buf[idx + 3] / 255;
  const outA = sa + da * (1 - sa);
  if (outA <= 0) return;

  buf[idx] = clampByte((sr * sa + buf[idx] * da * (1 - sa)) / outA);
  buf[idx + 1] = clampByte((sg * sa + buf[idx + 1] * da * (1 - sa)) / outA);
  buf[idx + 2] = clampByte((sb * sa + buf[idx + 2] * da * (1 - sa)) / outA);
  buf[idx + 3] = clampByte(outA * 255);
};

const sampleBilinear = (
  img: DecodedRgbaImage,
  u: number,
  v: number
): [number, number, number, number] => {
  const x = Math.max(0, Math.min(img.width - 1, u));
  const y = Math.max(0, Math.min(img.height - 1, v));
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(img.width - 1, x0 + 1);
  const y1 = Math.min(img.height - 1, y0 + 1);
  const fx = x - x0;
  const fy = y - y0;

  const i00 = (y0 * img.width + x0) * 4;
  const i10 = (y0 * img.width + x1) * 4;
  const i01 = (y1 * img.width + x0) * 4;
  const i11 = (y1 * img.width + x1) * 4;

  const w00 = (1 - fx) * (1 - fy);
  const w10 = fx * (1 - fy);
  const w01 = (1 - fx) * fy;
  const w11 = fx * fy;

  const a =
    (img.data[i00 + 3] * w00 +
      img.data[i10 + 3] * w10 +
      img.data[i01 + 3] * w01 +
      img.data[i11 + 3] * w11) /
    255;

  if (a <= 0.001) return [0, 0, 0, 0];

  // Premultiplied alpha interpolation avoids dark fringes around transparent edges
  const a00 = (img.data[i00 + 3] / 255) * w00;
  const a10 = (img.data[i10 + 3] / 255) * w10;
  const a01 = (img.data[i01 + 3] / 255) * w01;
  const a11 = (img.data[i11 + 3] / 255) * w11;

  const r = (img.data[i00] * a00 + img.data[i10] * a10 + img.data[i01] * a01 + img.data[i11] * a11) / a;
  const g = (img.data[i00 + 1] * a00 + img.data[i10 + 1] * a10 + img.data[i01 + 1] * a01 + img.data[i11 + 1] * a11) / a;
  const b = (img.data[i00 + 2] * a00 + img.data[i10 + 2] * a10 + img.data[i01 + 2] * a01 + img.data[i11 + 2] * a11) / a;

  return [r, g, b, a];
};

const drawMonogramIntoBuffer = (
  buf: Uint8Array,
  size: number,
  monogram: string,
  centerX: number,
  centerY: number,
  cardSize: number,
  colorRgb: [number, number, number]
) => {
  const chars = (monogram || 'ER')
    .toUpperCase()
    .split('')
    .map((ch) => (BITMAP_FONT_5X7[ch] ? ch : 'E'))
    .slice(0, 2);

  const count = chars.length;
  const unit = Math.max(2, (cardSize * 0.42) / GLYPH_HEIGHT);
  const charW = GLYPH_WIDTH * unit;
  const gap = count > 1 ? unit * 1.15 : 0;
  const totalW = charW * count + gap * (count - 1);
  const totalH = GLYPH_HEIGHT * unit;
  const startX = centerX - totalW / 2;
  const startY = centerY - totalH / 2;

  chars.forEach((ch, charIdx) => {
    const grid = BITMAP_FONT_5X7[ch];
    if (!grid) return;
    const ox = startX + charIdx * (charW + gap);

    for (let row = 0; row < GLYPH_HEIGHT; row += 1) {
      for (let col = 0; col < GLYPH_WIDTH; col += 1) {
        if (grid[row][col] !== '1') continue;
        const bx = ox + col * unit;
        const by = startY + row * unit;
        const xMin = Math.max(0, Math.floor(bx - 1));
        const xMax = Math.min(size - 1, Math.ceil(bx + unit + 1));
        const yMin = Math.max(0, Math.floor(by - 1));
        const yMax = Math.min(size - 1, Math.ceil(by + unit + 1));

        for (let py = yMin; py <= yMax; py += 1) {
          for (let px = xMin; px <= xMax; px += 1) {
            const alpha = roundedRectAlpha(px + 0.5, py + 0.5, bx, by, unit * 1.04, unit * 1.04, unit * 0.28);
            if (alpha > 0.01) {
              blendPixel(buf, (py * size + px) * 4, colorRgb[0], colorRgb[1], colorRgb[2], alpha);
            }
          }
        }
      }
    }
  });
};

export const renderCompanyPwaIconPng = async (
  size: number,
  branding: ServerPwaBranding,
  options: { isMaskable?: boolean; opaqueSquare?: boolean } = {}
): Promise<Buffer> => {
  const isMaskable = Boolean(options.isMaskable);
  const opaqueSquare = Boolean(options.opaqueSquare);
  const png = new PNG({ width: size, height: size });
  const buf = new Uint8Array(size * size * 4);
  const [tr, tg, tb] = parseHexRgb(branding.themeColor);

  const decodedLogo = branding.logoUrl
    ? await fetchOrDecodeLogo(branding.logoUrl)
    : null;

  if (decodedLogo) {
    const cornerRadius = size * 0.22;
    for (let y = 0; y < size; y += 1) {
      const ty = y / Math.max(1, size - 1);
      for (let x = 0; x < size; x += 1) {
        const idx = (y * size + x) * 4;
        if (isMaskable) {
          // Full-bleed crisp light gradient background for maskable safe-zone
          const t = (x / Math.max(1, size - 1) + ty) * 0.5;
          buf[idx] = clampByte(248 - t * 8);
          buf[idx + 1] = clampByte(250 - t * 4);
          buf[idx + 2] = clampByte(252 - t * 6);
          buf[idx + 3] = 255;
        } else if (opaqueSquare) {
          buf[idx] = 255;
          buf[idx + 1] = 255;
          buf[idx + 2] = 255;
          buf[idx + 3] = 255;
        } else {
          const shapeA = roundedRectAlpha(x + 0.5, y + 0.5, 0, 0, size, size, cornerRadius);
          if (shapeA > 0) {
            const innerA = roundedRectAlpha(x + 0.5, y + 0.5, 2, 2, size - 4, size - 4, Math.max(1, cornerRadius - 2));
            const isBorder = shapeA > 0.1 && innerA < 0.85;
            const r = isBorder ? 226 : 255;
            const g = isBorder ? 232 : 255;
            const b = isBorder ? 240 : 255;
            blendPixel(buf, idx, r, g, b, shapeA);
          }
        }
      }
    }

    const padRatio = isMaskable ? 0.2 : 0.12;
    const maxW = size * (1 - padRatio * 2);
    const maxH = size * (1 - padRatio * 2);
    const scale = Math.min(maxW / decodedLogo.width, maxH / decodedLogo.height);
    const drawW = Math.max(1, decodedLogo.width * scale);
    const drawH = Math.max(1, decodedLogo.height * scale);
    const drawX = (size - drawW) / 2;
    const drawY = (size - drawH) / 2;

    // Supersampled 2x2 box filter per output pixel avoids moire when downscaling crisp logos
    const xStart = Math.max(0, Math.floor(drawX));
    const xEnd = Math.min(size - 1, Math.ceil(drawX + drawW));
    const yStart = Math.max(0, Math.floor(drawY));
    const yEnd = Math.min(size - 1, Math.ceil(drawY + drawH));

    for (let y = yStart; y <= yEnd; y += 1) {
      for (let x = xStart; x <= xEnd; x += 1) {
        if (
          x + 0.5 < drawX ||
          x + 0.5 > drawX + drawW ||
          y + 0.5 < drawY ||
          y + 0.5 > drawY + drawH
        ) {
          continue;
        }

        let accR = 0;
        let accG = 0;
        let accB = 0;
        let accA = 0;
        const subOffsets = [0.25, 0.75];
        for (const oy of subOffsets) {
          for (const ox of subOffsets) {
            const u = ((x + ox - drawX) / drawW) * (decodedLogo.width - 1);
            const v = ((y + oy - drawY) / drawH) * (decodedLogo.height - 1);
            const [sr, sg, sb, sa] = sampleBilinear(decodedLogo, u, v);
            accR += sr * sa;
            accG += sg * sa;
            accB += sb * sa;
            accA += sa;
          }
        }

        const avgA = accA / 4;
        if (avgA > 0.005) {
          blendPixel(
            buf,
            (y * size + x) * 4,
            accR / accA,
            accG / accA,
            accB / accA,
            avgA
          );
        }
      }
    }
  } else {
    // Rich gradient badge + white inner card + company monogram
    const outerRadius = size * 0.22;
    const cardPad = isMaskable ? size * 0.18 : size * 0.14;
    const cardSize = size - cardPad * 2;
    const cardRadius = cardSize * 0.24;

    const darkR = Math.round(tr * 0.55);
    const darkG = Math.round(tg * 0.55);
    const darkB = Math.round(tb * 0.55);

    for (let y = 0; y < size; y += 1) {
      const ny = y / Math.max(1, size - 1);
      for (let x = 0; x < size; x += 1) {
        const idx = (y * size + x) * 4;
        const t = (x / Math.max(1, size - 1) + ny) * 0.5;
        const gradR = tr + (darkR - tr) * t;
        const gradG = tg + (darkG - tg) * t;
        const gradB = tb + (darkB - tb) * t;

        const bgAlpha =
          isMaskable || opaqueSquare
            ? 1
            : roundedRectAlpha(x + 0.5, y + 0.5, 0, 0, size, size, outerRadius);

        if (bgAlpha > 0) {
          blendPixel(buf, idx, gradR, gradG, gradB, bgAlpha);
          const cardA = roundedRectAlpha(
            x + 0.5,
            y + 0.5,
            cardPad,
            cardPad,
            cardSize,
            cardSize,
            cardRadius
          );
          if (cardA > 0) {
            blendPixel(buf, idx, 255, 255, 255, cardA * bgAlpha);
          }
        }
      }
    }

    // Company monogram in darker theme color
    drawMonogramIntoBuffer(buf, size, branding.monogram, size / 2, size / 2, cardSize, [
      Math.max(12, Math.round(tr * 0.5)),
      Math.max(24, Math.round(tg * 0.5)),
      Math.max(24, Math.round(tb * 0.5)),
    ]);

    // Accent status dot at bottom-right of white inner card
    const dotR = cardSize * 0.08;
    const dotCx = cardPad + cardSize - dotR * 1.9;
    const dotCy = cardPad + cardSize - dotR * 1.9;
    const dMinX = Math.max(0, Math.floor(dotCx - dotR - 2));
    const dMaxX = Math.min(size - 1, Math.ceil(dotCx + dotR + 2));
    const dMinY = Math.max(0, Math.floor(dotCy - dotR - 2));
    const dMaxY = Math.min(size - 1, Math.ceil(dotCy + dotR + 2));
    for (let py = dMinY; py <= dMaxY; py += 1) {
      for (let px = dMinX; px <= dMaxX; px += 1) {
        const dist = Math.hypot(px + 0.5 - dotCx, py + 0.5 - dotCy) - dotR;
        const a = Math.max(0, Math.min(1, 0.5 - dist));
        if (a > 0) {
          blendPixel(buf, (py * size + px) * 4, tr, tg, tb, a);
        }
      }
    }
  }

  png.data = Buffer.from(buf);
  return PNG.sync.write(png);
};

export const buildServerManifestPayload = (
  branding: ServerPwaBranding,
  rawSearchParams: URLSearchParams,
  originUrl: string
) => {
  const cleanOrigin = originUrl.replace(/\/+$/, '');
  const iconParams = new URLSearchParams();
  ['fbProj', 'name', 'short', 'theme', 'logo', 'v'].forEach((key) => {
    const val = rawSearchParams.get(key);
    if (val) iconParams.set(key, val);
  });
  const suffix = iconParams.toString() ? `?${iconParams.toString()}` : '';

  return {
    id: `${cleanOrigin}/`,
    name: branding.appName,
    short_name: branding.shortName,
    description: branding.description,
    theme_color: branding.themeColor,
    background_color: branding.backgroundColor,
    display: 'standalone' as const,
    orientation: 'any' as const,
    scope: `${cleanOrigin}/`,
    start_url: `${cleanOrigin}/`,
    icons: [
      {
        src: `${cleanOrigin}/app-icon-192.png${suffix}`,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: `${cleanOrigin}/app-icon-512.png${suffix}`,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: `${cleanOrigin}/app-icon-maskable-512.png${suffix}`,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
};

export type DynamicPwaAssetKind =
  | 'manifest'
  | 'icon-192'
  | 'icon-512'
  | 'icon-maskable-512'
  | 'apple-touch-icon';

export const detectPwaAssetKind = (
  pathname: string,
  params: URLSearchParams
): DynamicPwaAssetKind | null => {
  const assetParam = (params.get('asset') || '').trim();
  if (
    assetParam === 'manifest' ||
    assetParam === 'icon-192' ||
    assetParam === 'icon-512' ||
    assetParam === 'icon-maskable-512' ||
    assetParam === 'apple-touch-icon'
  ) {
    return assetParam;
  }

  const p = (pathname || '').split('?')[0];
  if (p.endsWith('/app-manifest.webmanifest')) return 'manifest';
  if (p.endsWith('/app-icon-192.png')) return 'icon-192';
  if (p.endsWith('/app-icon-512.png')) return 'icon-512';
  if (p.endsWith('/app-icon-maskable-512.png')) return 'icon-maskable-512';
  if (p.endsWith('/app-apple-touch-icon.png')) return 'apple-touch-icon';
  return null;
};

export const generateDynamicPwaHttpResponse = async (
  kind: DynamicPwaAssetKind,
  params: URLSearchParams,
  originUrl: string
): Promise<{
  statusCode: number;
  contentType: string;
  bodyBuffer: Buffer;
}> => {
  const branding = await resolveServerBranding(params);

  if (kind === 'manifest') {
    const manifestObj = buildServerManifestPayload(branding, params, originUrl);
    return {
      statusCode: 200,
      contentType: 'application/manifest+json; charset=utf-8',
      bodyBuffer: Buffer.from(JSON.stringify(manifestObj), 'utf-8'),
    };
  }

  if (kind === 'icon-192') {
    const pngBuf = await renderCompanyPwaIconPng(192, branding, { isMaskable: false });
    return { statusCode: 200, contentType: 'image/png', bodyBuffer: pngBuf };
  }

  if (kind === 'icon-512') {
    const pngBuf = await renderCompanyPwaIconPng(512, branding, { isMaskable: false });
    return { statusCode: 200, contentType: 'image/png', bodyBuffer: pngBuf };
  }

  if (kind === 'icon-maskable-512') {
    const pngBuf = await renderCompanyPwaIconPng(512, branding, { isMaskable: true });
    return { statusCode: 200, contentType: 'image/png', bodyBuffer: pngBuf };
  }

  const appleBuf = await renderCompanyPwaIconPng(180, branding, {
    isMaskable: false,
    opaqueSquare: true,
  });
  return { statusCode: 200, contentType: 'image/png', bodyBuffer: appleBuf };
};
