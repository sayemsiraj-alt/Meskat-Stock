import { StockItem } from '../data/mockData';

export interface CriticalStockAlert {
  id: string;
  itemId: string;
  itemName: string;
  sku: string;
  quantity: number;
  unit: string;
  initialReorderThreshold: number;
  criticalCutoff: number;
  percentOfThreshold: number;
}

export interface StockDropDetectionResult {
  alerts: CriticalStockAlert[];
  nextQuantities: Map<string, number>;
  nextInitialThresholds: Map<string, number>;
}

/**
 * Evaluates whether any stock item quantity has fallen below 20% of its initial reorderThreshold.
 * - On initial snapshot (`isInitialSnapshot = true`), records baseline quantities and thresholds without firing alerts.
 * - On subsequent snapshots, triggers an alert whenever:
 *   1) An existing item crosses from `prevQty >= 0.2 * initialReorderThreshold` to `qty < 0.2 * initialReorderThreshold`, OR
 *   2) A newly added item enters with `qty < 0.2 * initialReorderThreshold`.
 */
export function detectCriticalStockDrops(
  items: StockItem[],
  prevQuantities: Map<string, number>,
  initialThresholds: Map<string, number>,
  isInitialSnapshot: boolean
): StockDropDetectionResult {
  const nextQuantities = new Map<string, number>();
  const nextInitialThresholds = new Map<string, number>(initialThresholds);
  const alerts: CriticalStockAlert[] = [];

  for (const item of items) {
    if (!item || !item.id) continue;

    const existingInitial = nextInitialThresholds.get(item.id);
    const initialReorderThreshold =
      existingInitial !== undefined
        ? existingInitial
        : Number(item.reorderThreshold) || 0;

    if (existingInitial === undefined && initialReorderThreshold > 0) {
      nextInitialThresholds.set(item.id, initialReorderThreshold);
    }

    const currentQty = Math.max(0, Number(item.quantity) || 0);
    nextQuantities.set(item.id, currentQty);

    if (isInitialSnapshot || initialReorderThreshold <= 0) {
      continue;
    }

    const criticalCutoff = initialReorderThreshold * 0.2;
    const prevQty = prevQuantities.get(item.id);

    const crossedBelow =
      prevQty === undefined
        ? currentQty < criticalCutoff
        : prevQty >= criticalCutoff && currentQty < criticalCutoff;

    if (crossedBelow) {
      const percentOfThreshold = Math.round((currentQty / initialReorderThreshold) * 1000) / 10;
      alerts.push({
        id: `STK-ALERT-${item.id}-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
        itemId: item.id,
        itemName: item.name,
        sku: item.sku || 'N/A',
        quantity: currentQty,
        unit: item.unit || 'Pcs',
        initialReorderThreshold,
        criticalCutoff: Math.round(criticalCutoff * 100) / 100,
        percentOfThreshold,
      });
    }
  }

  return {
    alerts,
    nextQuantities,
    nextInitialThresholds,
  };
}
