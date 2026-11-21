import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PNG } from 'pngjs';
import vercelPwaHandler from '../../api/pwa';
import vercelCourierHandler from '../../api/courier';
import {
  buildServerManifestPayload,
  decodeImageBuffer,
  deriveServerMonogram,
  deriveServerShortName,
  detectPwaAssetKind,
  generateDynamicPwaHttpResponse,
  normalizeThemeHex,
  renderCompanyPwaIconPng,
  resolveServerBranding,
} from './pwaServerRenderer';

const createSolidTestPngDataUrl = (
  w: number,
  h: number,
  rgba: [number, number, number, number]
): string => {
  const png = new PNG({ width: w, height: h });
  for (let i = 0; i < w * h * 4; i += 4) {
    png.data[i] = rgba[0];
    png.data[i + 1] = rgba[1];
    png.data[i + 2] = rgba[2];
    png.data[i + 3] = rgba[3];
  }
  const buf = PNG.sync.write(png);
  return `data:image/png;base64,${buf.toString('base64')}`;
};

describe('pwaServerRenderer dynamic manifest & PNG icons', () => {
  it('generates valid 192x192, 512x512, maskable 512x512, and 180x180 PNG binary assets from custom company logo', async () => {
    const redLogoDataUrl = createSolidTestPngDataUrl(64, 64, [220, 38, 38, 255]);
    const params = new URLSearchParams({
      name: 'Meskat Enterprise',
      short: 'Meskat ERP',
      theme: '#2563EB',
      logo: redLogoDataUrl,
      v: 'v123',
    });

    const branding = await resolveServerBranding(params);
    assert.equal(branding.appName, 'Meskat Enterprise');
    assert.equal(branding.shortName, 'Meskat ERP');
    assert.equal(branding.themeColor, '#2563EB');

    const icon192 = await renderCompanyPwaIconPng(192, branding, { isMaskable: false });
    const parsed192 = PNG.sync.read(icon192);
    assert.equal(parsed192.width, 192);
    assert.equal(parsed192.height, 192);

    // Center pixel must reflect the uploaded red logo rather than static green parcel box
    const centerIdx = (96 * 192 + 96) * 4;
    assert.ok(parsed192.data[centerIdx] > 200, 'Expected red channel at center of rendered logo icon');
    assert.ok(parsed192.data[centerIdx + 1] < 60, 'Expected low green channel at center');

    const maskable512 = await renderCompanyPwaIconPng(512, branding, { isMaskable: true });
    const parsedMask = PNG.sync.read(maskable512);
    assert.equal(parsedMask.width, 512);
    assert.equal(parsedMask.height, 512);
    // Corner pixel of maskable icon must be fully opaque (alpha 255) for Android adaptive icon safe-zone
    assert.equal(parsedMask.data[3], 255);

    const apple180 = await renderCompanyPwaIconPng(180, branding, { opaqueSquare: true });
    const parsedApple = PNG.sync.read(apple180);
    assert.equal(parsedApple.width, 180);
    assert.equal(parsedApple.height, 180);
    assert.equal(parsedApple.data[3], 255);
  });

  it('renders crisp company monogram icon in configured theme color when no logoUrl is uploaded', async () => {
    const params = new URLSearchParams({
      name: 'Dear Health Care',
      short: 'Dear Health',
      theme: '#7C3AED',
    });

    const branding = await resolveServerBranding(params);
    assert.equal(branding.monogram, 'DH');

    const buf = await renderCompanyPwaIconPng(192, branding, { isMaskable: true });
    const parsed = PNG.sync.read(buf);
    assert.equal(parsed.width, 192);
    assert.equal(parsed.height, 192);
    // Top-left maskable corner should match violet theme background (#7C3AED -> R=124, B=237)
    assert.ok(parsed.data[0] > 100 && parsed.data[2] > 200);
  });

  it('builds dynamic manifest JSON whose icon URLs carry the company query params over HTTPS', async () => {
    const params = new URLSearchParams({
      fbProj: 'meskat-prod-99',
      name: 'Meskat Traders',
      short: 'Meskat',
      theme: '#059669',
      v: 'sig1',
    });

    const res = await generateDynamicPwaHttpResponse(
      'manifest',
      params,
      'https://meskat.netlify.app'
    );
    assert.equal(res.statusCode, 200);
    assert.match(res.contentType, /application\/manifest\+json/);

    const manifest = JSON.parse(res.bodyBuffer.toString('utf-8'));
    assert.equal(manifest.name, 'Meskat Traders');
    assert.equal(manifest.short_name, 'Meskat');
    assert.equal(manifest.theme_color, '#059669');
    assert.equal(manifest.start_url, 'https://meskat.netlify.app/');
    assert.equal(manifest.icons.length, 3);
    assert.ok(manifest.icons[0].src.startsWith('https://meskat.netlify.app/app-icon-192.png?'));
    assert.ok(manifest.icons[0].src.includes('fbProj=meskat-prod-99'));
    assert.ok(manifest.icons[0].src.includes('name=Meskat+Traders'));
    assert.equal(manifest.icons[2].purpose, 'maskable');
  });

  it('detects dynamic PWA asset kinds from both Netlify rewrite query params and direct paths', () => {
    assert.equal(detectPwaAssetKind('/app-manifest.webmanifest', new URLSearchParams()), 'manifest');
    assert.equal(detectPwaAssetKind('/app-icon-192.png', new URLSearchParams()), 'icon-192');
    assert.equal(detectPwaAssetKind('/app-icon-512.png', new URLSearchParams()), 'icon-512');
    assert.equal(
      detectPwaAssetKind('/.netlify/functions/pwa', new URLSearchParams('asset=icon-maskable-512')),
      'icon-maskable-512'
    );
    assert.equal(
      detectPwaAssetKind('/.netlify/functions/pwa', new URLSearchParams('asset=apple-touch-icon')),
      'apple-touch-icon'
    );
  });

  it('decodes raw PNG buffer and handles invalid buffers safely', () => {
    const pngDataUrl = createSolidTestPngDataUrl(16, 16, [10, 20, 30, 255]);
    const rawBuf = Buffer.from(pngDataUrl.split(',')[1], 'base64');
    const decoded = decodeImageBuffer(rawBuf);
    assert.ok(decoded);
    assert.equal(decoded!.width, 16);
    assert.equal(decoded!.height, 16);

    assert.equal(decodeImageBuffer(Buffer.from('not-an-image')), null);
    assert.equal(normalizeThemeHex('', 'royal-sapphire'), '#2563EB');
    assert.equal(deriveServerShortName('', 'SuperLongCompanyNameHere', ''), 'SuperLongCom');
    assert.equal(deriveServerMonogram('Apex', 'Apex Pharma'), 'AP');

    const manifestPayload = buildServerManifestPayload(
      {
        appName: 'Apex',
        shortName: 'Apex',
        description: 'Apex ERP',
        monogram: 'AP',
        logoUrl: '',
        themeColor: '#10B981',
        backgroundColor: '#FFFFFF',
      },
      new URLSearchParams('name=Apex'),
      'https://apex.example.com'
    );
    assert.equal(manifestPayload.icons[1].sizes, '512x512');
  });

  it('runs Vercel /api/pwa and /api/courier handlers cleanly with exact headers and binary PNG output', async () => {
    const createMockRes = () => {
      const headers: Record<string, string> = {};
      let bodyChunks: Buffer[] = [];
      return {
        statusCode: 200,
        setHeader(k: string, v: string) {
          headers[k.toLowerCase()] = String(v);
        },
        end(chunk?: any) {
          if (chunk !== undefined) {
            bodyChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
          }
        },
        getHeaders: () => headers,
        getBody: () => Buffer.concat(bodyChunks),
      };
    };

    const manifestRes = createMockRes();
    await vercelPwaHandler(
      {
        method: 'GET',
        url: '/api/pwa?asset=manifest&name=Nova%20Pharma&short=Nova&theme=%232563EB',
        headers: { host: 'nova-erp.vercel.app', 'x-forwarded-proto': 'https' },
      } as any,
      manifestRes as any
    );
    assert.equal(manifestRes.statusCode, 200);
    assert.match(manifestRes.getHeaders()['content-type'], /application\/manifest\+json/);
    const manifestObj = JSON.parse(manifestRes.getBody().toString('utf-8'));
    assert.equal(manifestObj.name, 'Nova Pharma');
    assert.equal(manifestObj.start_url, 'https://nova-erp.vercel.app/');
    assert.ok(manifestObj.icons[0].src.startsWith('https://nova-erp.vercel.app/app-icon-192.png?'));

    const iconRes = createMockRes();
    await vercelPwaHandler(
      {
        method: 'GET',
        url: '/api/pwa?asset=icon-192&short=Nova&theme=%232563EB',
        headers: { host: 'nova-erp.vercel.app', 'x-forwarded-proto': 'https' },
      } as any,
      iconRes as any
    );
    assert.equal(iconRes.statusCode, 200);
    assert.equal(iconRes.getHeaders()['content-type'], 'image/png');
    const parsedPng = PNG.sync.read(iconRes.getBody());
    assert.equal(parsedPng.width, 192);
    assert.equal(parsedPng.height, 192);

    const courierRes = createMockRes();
    await vercelCourierHandler(
      {
        method: 'POST',
        body: { action: 'status', courierName: 'Steadfast', trackingNo: 'SF123' },
        headers: { 'content-type': 'application/json' },
      } as any,
      courierRes as any
    );
    assert.equal(courierRes.statusCode, 200);
    const courierJson = JSON.parse(courierRes.getBody().toString('utf-8'));
    assert.equal(courierJson.courier, 'Steadfast');
  });
});
