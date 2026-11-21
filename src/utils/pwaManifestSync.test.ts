import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildCompanyPwaBranding,
  buildDynamicServerManifestPath,
  buildManifestJsonPayload,
  computeBrandingSignature,
  deriveMonogram,
  deriveShortAppName,
} from './pwaManifestSync';

describe('pwaManifestSync branding & manifest helpers', () => {
  it('uses company brandName when configured and avoids hardcoded Dear ERP default', () => {
    const branding = buildCompanyPwaBranding({
      brandName: 'Apex Pharma',
      brandShortName: 'Apex',
      storeName: 'Apex Pharma Ltd.',
      logoUrl: 'data:image/png;base64,AAA',
      activeTheme: 'emerald-enterprise',
    });

    assert.equal(branding.appName, 'Apex Pharma');
    assert.equal(branding.shortName, 'Apex Pharma');
    assert.equal(branding.monogram, 'AP');
    assert.equal(branding.logoUrl, 'data:image/png;base64,AAA');
    assert.equal(branding.themeColor, '#10B981');
  });

  it('keeps short_name <= 12 characters using brandShortName when brandName is long', () => {
    const shortName = deriveShortAppName(
      'MedCare',
      'MedCare International Healthcare Ltd.',
      'MedCare International'
    );
    assert.equal(shortName, 'MedCare');
    assert.ok(shortName.length <= 12);
  });

  it('truncates long single names cleanly to <= 12 characters', () => {
    const shortName = deriveShortAppName('', 'SuperLongCompanyNameHere', '');
    assert.equal(shortName.length, 12);
    assert.equal(shortName, 'SuperLongCom');
  });

  it('derives clean 2-letter monograms for single and multi-word company names', () => {
    assert.equal(deriveMonogram('GreenLeaf', 'GreenLeaf Traders'), 'GT');
    assert.equal(deriveMonogram('Orion', 'Orion'), 'OR');
  });

  it('produces deterministic branding signatures that change when logo or name changes', () => {
    const sig1 = computeBrandingSignature({
      appName: 'Dear Health Care',
      shortName: 'Dear Health',
      themeColor: '#10B981',
      logoUrl: 'data:image/png;base64,LOGO1',
    });
    const sig2 = computeBrandingSignature({
      appName: 'Dear Health Care',
      shortName: 'Dear Health',
      themeColor: '#10B981',
      logoUrl: 'data:image/png;base64,LOGO1',
    });
    const sig3 = computeBrandingSignature({
      appName: 'Apex Pharma',
      shortName: 'Apex Pharma',
      themeColor: '#10B981',
      logoUrl: 'data:image/png;base64,LOGO1',
    });
    assert.equal(sig1, sig2);
    assert.notEqual(sig1, sig3);
    assert.ok(sig1.length > 0);
  });

  it('builds complete Web App Manifest with separate any and maskable HTTP icons and origin URLs', () => {
    const branding = buildCompanyPwaBranding({
      brandName: 'Nova Medicos',
      brandShortName: 'Nova',
      storeName: 'Nova Medicos Ltd.',
      logoUrl: '',
      activeTheme: 'royal-sapphire',
    });

    const manifest = buildManifestJsonPayload(
      branding,
      {
        icon192Url: 'https://erp.novamedicos.com/app-icon-192.png?v=abc',
        icon512Url: 'https://erp.novamedicos.com/app-icon-512.png?v=abc',
        maskable512Url: 'https://erp.novamedicos.com/app-icon-maskable-512.png?v=abc',
        appleTouchUrl: 'https://erp.novamedicos.com/app-apple-touch-icon.png?v=abc',
      },
      'https://erp.novamedicos.com'
    );

    assert.equal(manifest.name, 'Nova Medicos');
    assert.equal(manifest.short_name, 'Nova Medicos');
    assert.equal(manifest.start_url, 'https://erp.novamedicos.com/');
    assert.equal(manifest.scope, 'https://erp.novamedicos.com/');
    assert.equal(manifest.id, 'https://erp.novamedicos.com/');
    assert.equal(manifest.display, 'standalone');
    assert.equal(manifest.theme_color, branding.themeColor);
    assert.equal(manifest.icons.length, 3);
    assert.equal(manifest.icons[0].purpose, 'any');
    assert.equal(manifest.icons[1].purpose, 'any');
    assert.equal(manifest.icons[2].purpose, 'maskable');
    assert.ok(manifest.icons[0].src.startsWith('https://'));
  });

  it('builds dynamic server manifest URL with fbProj, compact logo, and safe URL length guard', () => {
    const branding = buildCompanyPwaBranding({
      brandName: 'Meskat Enterprise',
      brandShortName: 'Meskat',
      storeName: 'Meskat Enterprise',
      logoUrl: 'data:image/png;base64,' + 'A'.repeat(5000),
      activeTheme: 'emerald-enterprise',
    });

    const path = buildDynamicServerManifestPath(branding, {
      firebaseProjectId: 'meskat-erp',
      compactLogoUrl: 'data:image/png;base64,SMALL',
      brandHash: 'h123',
    });

    assert.ok(path.startsWith('/app-manifest.webmanifest?'));
    const parsed = new URL(`https://example.com${path}`);
    assert.equal(parsed.searchParams.get('fbProj'), 'meskat-erp');
    assert.equal(parsed.searchParams.get('name'), 'Meskat Enterprise');
    assert.equal(parsed.searchParams.get('short'), 'Meskat');
    assert.equal(parsed.searchParams.get('logo'), 'data:image/png;base64,SMALL');
    assert.equal(parsed.searchParams.get('v'), 'h123');
  });
});
