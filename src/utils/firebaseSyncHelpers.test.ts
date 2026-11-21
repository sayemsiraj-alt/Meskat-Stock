import test from 'node:test';
import assert from 'node:assert/strict';
import { initialSettings } from '../data/mockData';
import {
  mergeRemoteSettings,
  PendingFirestoreOp,
  removePendingFirestoreOp,
  shouldApplyRemoteCollectionSnapshot,
  upsertPendingFirestoreOp,
} from './firebaseSyncHelpers';

test('mergeRemoteSettings preserves local Firebase credentials and connection flag when missing remotely', () => {
  const local = {
    ...initialSettings,
    firebaseApiKey: 'AIzaSyTestKey',
    firebaseProjectId: 'my-erp-prod',
    firebaseConnected: true,
    brandName: 'Old Brand',
  };

  const merged = mergeRemoteSettings(local, {
    brandName: 'Dear Health Care',
    firebaseConnected: false,
    firebaseApiKey: '',
    firebaseProjectId: '',
  });

  assert.equal(merged.brandName, 'Dear Health Care');
  assert.equal(merged.firebaseApiKey, 'AIzaSyTestKey');
  assert.equal(merged.firebaseProjectId, 'my-erp-prod');
  assert.equal(merged.firebaseConnected, true);
});

test('shouldApplyRemoteCollectionSnapshot avoids wiping local records when remote collection starts empty', () => {
  assert.equal(
    shouldApplyRemoteCollectionSnapshot([], [{ id: '1' }], false),
    false
  );
  assert.equal(
    shouldApplyRemoteCollectionSnapshot([{ id: 'r1' }], [{ id: '1' }], false),
    true
  );
  assert.equal(
    shouldApplyRemoteCollectionSnapshot([], [{ id: '1' }], true),
    true
  );
});

test('upsertPendingFirestoreOp deduplicates repeated offline mutations on same doc', () => {
  const q1 = upsertPendingFirestoreOp([], {
    op: 'set',
    collectionName: 'invoices',
    id: 'INV-1',
    data: { paidAmount: 500 },
    queuedAt: '2026-11-20T01:00:00Z',
  });
  const q2 = upsertPendingFirestoreOp(q1, {
    op: 'set',
    collectionName: 'items',
    id: 'ITEM-1',
    data: { quantity: 10 },
    queuedAt: '2026-11-20T01:00:05Z',
  });
  const q3 = upsertPendingFirestoreOp(q2, {
    op: 'delete',
    collectionName: 'invoices',
    id: 'INV-1',
    queuedAt: '2026-11-20T01:01:00Z',
  });

  assert.equal(q3.length, 2);
  assert.equal(q3[0].collectionName, 'items');
  assert.equal(q3[1].collectionName, 'invoices');
  assert.equal(q3[1].op, 'delete');

  const q4: PendingFirestoreOp[] = removePendingFirestoreOp(q3, 'items', 'ITEM-1');
  assert.equal(q4.length, 1);
  assert.equal(q4[0].id, 'INV-1');
});
