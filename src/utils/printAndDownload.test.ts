import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPdfBytesFromJpeg,
  formatCompanyContactSuffix,
  resolveAuthorizedSignatureInfo,
} from './printAndDownload';

test('formatCompanyContactSuffix formats company email and website dynamically', () => {
  assert.equal(
    formatCompanyContactSuffix('info@meskat.com', 'meskat.com.bd'),
    'info@meskat.com / meskat.com.bd'
  );
  assert.equal(
    formatCompanyContactSuffix('  billing@apex.com  ', ''),
    'billing@apex.com'
  );
  assert.equal(
    formatCompanyContactSuffix('', '  apex.com.bd '),
    'apex.com.bd'
  );
  assert.equal(formatCompanyContactSuffix('', ''), '');
  assert.equal(formatCompanyContactSuffix(undefined, undefined), '');
});

test('resolveAuthorizedSignatureInfo uses logged-in creator automatically and honors manual override', () => {
  const autoSig = resolveAuthorizedSignatureInfo(
    {
      createdByUserId: 'manager1',
      createdByName: 'Tariqul Islam',
    },
    'Dear Health Care'
  );
  assert.equal(autoSig.mode, 'auto');
  assert.equal(autoSig.signerName, 'Tariqul Islam');
  assert.equal(autoSig.signerUserId, 'manager1');
  assert.equal(autoSig.hasCustomSignature, false);

  const manualSig = resolveAuthorizedSignatureInfo(
    {
      createdByUserId: 'manager1',
      createdByName: 'Tariqul Islam',
      authorizedSignatureMode: 'manual',
      authorizedSignerName: 'Md. Karim',
      authorizedSignerTitle: 'Managing Director',
      authorizedSignatureDataUrl: 'data:image/png;base64,iVBORw0KGgo=',
    },
    'Dear Health Care'
  );
  assert.equal(manualSig.mode, 'manual');
  assert.equal(manualSig.signerName, 'Md. Karim');
  assert.equal(manualSig.signerTitle, 'Managing Director');
  assert.equal(manualSig.hasCustomSignature, true);
});

test('buildPdfBytesFromJpeg creates valid PDF 1.4 header, xref, and EOF markers', () => {
  const dummyJpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0xff, 0xd9]);
  const pdf = buildPdfBytesFromJpeg(dummyJpeg, 1190, 1684);
  const text = new TextDecoder().decode(pdf);
  assert.ok(text.startsWith('%PDF-1.4'));
  assert.ok(text.includes('/MediaBox [0 0 595.28 841.89]'));
  assert.ok(text.includes('/Subtype /Image'));
  assert.ok(text.includes('xref'));
  assert.ok(text.trim().endsWith('%%EOF'));

  const thermalPdf = buildPdfBytesFromJpeg(dummyJpeg, 576, 960, {
    widthPt: 226.77,
    heightPt: 377.95,
  });
  const thermalText = new TextDecoder().decode(thermalPdf);
  assert.ok(thermalText.includes('/MediaBox [0 0 226.77 377.95]'));
});
