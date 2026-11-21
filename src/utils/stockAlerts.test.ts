import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { detectCriticalStockDrops } from './stockAlerts';
import { StockItem } from '../data/mockData';

const makeStock = (overrides: Partial<StockItem>): StockItem => ({
  id: 'ITM-1',
  name: 'Paracetamol 500mg',
  category: 'Pharma',
  sku: 'PCM-500',
  batchNo: 'B-01',
  quantity: 10,
  unit: 'Box',
  price: 120,
  costPrice: 80,
  supplier: 'Apex Pharma',
  expiryDate: '2027-01-01',
  reorderThreshold: 50,
  location: 'Main Warehouse',
  status: 'In Stock',
  ...overrides,
});

describe('detectCriticalStockDrops', () => {
  it('captures baseline on initial snapshot without firing, then alerts when quantity crosses below 20% of initial reorderThreshold', () => {
    const initialItems = [
      makeStock({ id: 'A', name: 'Syrup A', quantity: 20, reorderThreshold: 50 }), // 20% = 10
      makeStock({ id: 'B', name: 'Tablet B', quantity: 10, reorderThreshold: 50 }), // exactly at 20% = 10
    ];

    const snap0 = detectCriticalStockDrops(
      initialItems,
      new Map(),
      new Map(),
      true
    );
    assert.equal(snap0.alerts.length, 0);
    assert.equal(snap0.nextInitialThresholds.get('A'), 50);

    // Drop A to 10 (exactly 20% -> not strictly below 20%) and B to 9 (< 10 -> triggers!)
    const snap1 = detectCriticalStockDrops(
      [
        makeStock({ id: 'A', name: 'Syrup A', quantity: 10, reorderThreshold: 50 }),
        makeStock({ id: 'B', name: 'Tablet B', quantity: 9, reorderThreshold: 50 }),
      ],
      snap0.nextQuantities,
      snap0.nextInitialThresholds,
      false
    );
    assert.equal(snap1.alerts.length, 1);
    assert.equal(snap1.alerts[0].itemId, 'B');
    assert.equal(snap1.alerts[0].criticalCutoff, 10);
    assert.equal(snap1.alerts[0].quantity, 9);

    // Even if item B's reorderThreshold is later edited down to 20, baseline initial threshold remains 50
    // and further drop from 9 to 5 does not spam repeatedly, while restock to 15 and re-drop to 8 alerts again.
    const snap2 = detectCriticalStockDrops(
      [
        makeStock({ id: 'A', name: 'Syrup A', quantity: 10, reorderThreshold: 10 }), // edited threshold down, still vs initial 50 -> 10 is NOT < 10
        makeStock({ id: 'B', name: 'Tablet B', quantity: 15, reorderThreshold: 20 }), // restocked above 10
      ],
      snap1.nextQuantities,
      snap1.nextInitialThresholds,
      false
    );
    assert.equal(snap2.alerts.length, 0);

    const snap3 = detectCriticalStockDrops(
      [
        makeStock({ id: 'A', name: 'Syrup A', quantity: 9, reorderThreshold: 10 }), // drops below 20% of initial 50!
        makeStock({ id: 'B', name: 'Tablet B', quantity: 8, reorderThreshold: 20 }), // drops again below 20% of initial 50!
      ],
      snap2.nextQuantities,
      snap2.nextInitialThresholds,
      false
    );
    assert.equal(snap3.alerts.length, 2);
    assert.deepEqual(
      snap3.alerts.map((a) => [a.itemId, a.initialReorderThreshold]),
      [
        ['A', 50],
        ['B', 50],
      ]
    );
  });

  it('triggers for newly added items inserted below 20% after initial mount', () => {
    const snap0 = detectCriticalStockDrops([], new Map(), new Map(), true);
    const snap1 = detectCriticalStockDrops(
      [makeStock({ id: 'NEW-1', name: 'Insulin Pen', quantity: 1, reorderThreshold: 20 })],
      snap0.nextQuantities,
      snap0.nextInitialThresholds,
      false
    );
    assert.equal(snap1.alerts.length, 1);
    assert.equal(snap1.alerts[0].itemName, 'Insulin Pen');
    assert.equal(snap1.alerts[0].criticalCutoff, 4);
  });
});
