import test from 'node:test';
import assert from 'node:assert/strict';
import { formatTkAmount, numberToEnglishWords } from './numberToWords';
import { formatDDMMYY } from './dateUtils';

test('formatTkAmount formats South Asian comma grouping with trailing /=', () => {
  assert.equal(formatTkAmount(0), '0/=');
  assert.equal(formatTkAmount(1051326), '10,51,326/=');
  assert.equal(formatTkAmount(1136675), '11,36,675/=');
  assert.equal(formatTkAmount(2188001), '21,88,001/=');
  assert.equal(formatTkAmount(888001), '8,88,001/=');
  assert.equal(formatTkAmount(500, false), '500');
});

test('numberToEnglishWords converts wholesale invoice totals cleanly', () => {
  assert.equal(numberToEnglishWords(0), 'Zero Taka Only');
  assert.equal(
    numberToEnglishWords(2188001),
    'Twenty One Lakh Eighty Eight Thousand One Taka Only'
  );
  assert.equal(
    numberToEnglishWords(1300000),
    'Thirteen Lakh Taka Only'
  );
});

test('formatDDMMYY formats YYYY-MM-DD and ISO timestamps to DD/MM/YY', () => {
  assert.equal(formatDDMMYY('2026-01-27'), '27/01/26');
  assert.equal(formatDDMMYY('2026-01-27T12:00:00'), '27/01/26');
  assert.equal(formatDDMMYY(''), '00/00/26');
});
