import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Clock,
  EyeOff,
  PackageCheck,
  ShoppingCart,
  Tag,
} from 'lucide-react';
import { StockItem } from '../data/mockData';
import {
  ExpiringProductPriority,
  getProductsExpiringWithinDays,
} from '../utils/dashboardAnalytics';
import { getLocalYYYYMMDD } from '../utils/dateUtils';

interface ExpiringSoonCardProps {
  items: StockItem[];
  currency: string;
  referenceDate?: string;
  maxDays?: number;
  onNavigateTab?: (tab: string) => void;
  onHide?: () => void;
}

type ExpiryFilterTab = 'all' | 'expired' | 'critical' | 'warning';

export const ExpiringSoonCard: React.FC<ExpiringSoonCardProps> = ({
  items,
  currency,
  referenceDate,
  maxDays = 30,
  onNavigateTab,
  onHide,
}) => {
  const [filterTab, setFilterTab] = useState<ExpiryFilterTab>('all');
  const [showAllRows, setShowAllRows] = useState(false);

  const effectiveRefDate = referenceDate || getLocalYYYYMMDD();

  const formatCurr = (val: number) => {
    const sym = currency.includes('৳') || currency.toLowerCase().includes('bdt') ? '৳' : currency;
    return `${sym} ${val.toLocaleString()}`;
  };

  const allWithinWindow = useMemo(
    () => getProductsExpiringWithinDays(items, effectiveRefDate, maxDays, true),
    [items, effectiveRefDate, maxDays]
  );

  const counts = useMemo(() => {
    let expired = 0;
    let critical = 0;
    let warning = 0;
    let totalUnits = 0;
    let totalValue = 0;

    for (const entry of allWithinWindow) {
      if (entry.urgency === 'expired') expired += 1;
      else if (entry.urgency === 'critical') critical += 1;
      else warning += 1;

      totalUnits += entry.item.quantity;
      totalValue += entry.stockValue;
    }

    return {
      total: allWithinWindow.length,
      expired,
      critical,
      warning,
      totalUnits,
      totalValue,
    };
  }, [allWithinWindow]);

  const filteredEntries = useMemo(() => {
    if (filterTab === 'all') return allWithinWindow;
    return allWithinWindow.filter((e) => e.urgency === filterTab);
  }, [allWithinWindow, filterTab]);

  const visibleEntries = showAllRows ? filteredEntries : filteredEntries.slice(0, 8);

  const renderUrgencyLabel = (entry: ExpiringProductPriority) => {
    if (entry.daysRemaining < 0) {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-700 whitespace-nowrap">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>Expired {Math.abs(entry.daysRemaining)}d ago</span>
        </span>
      );
    }
    if (entry.daysRemaining === 0) {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-700 whitespace-nowrap">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          <span>Expires Today</span>
        </span>
      );
    }
    if (entry.daysRemaining <= 7) {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-600 whitespace-nowrap">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          <span>{entry.daysRemaining}d left (Critical)</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 whitespace-nowrap">
        <CalendarClock className="w-3.5 h-3.5 shrink-0" />
        <span>{entry.daysRemaining}d left</span>
      </span>
    );
  };

  return (
    <section
      aria-label="30-Day Expiry Priority Watchlist"
      className="corporate-card p-5 sm:p-6 rounded-2xl border border-slate-200/90 space-y-5"
    >
      {/* Header Row */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
              counts.expired + counts.critical > 0
                ? 'bg-rose-50 text-rose-600 border-rose-200'
                : counts.total > 0
                  ? 'bg-amber-50 text-amber-600 border-amber-200'
                  : 'bg-emerald-50 text-emerald-600 border-emerald-200'
            }`}
          >
            <CalendarClock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-slate-900 text-base">
              {maxDays}-Day Expiry Priority Watchlist
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Products within {maxDays} days of their <code className="font-mono text-slate-700">expiryDate</code> — ordered soonest-first to prioritize stock movement
            </p>
          </div>
        </div>

        {/* Summary Numbers + Quick Module Actions */}
        <div className="flex flex-wrap items-center gap-3 sm:gap-5">
          <div className="flex items-center gap-4 text-xs">
            <div>
              <span className="text-slate-500 block text-[11px]">Flagged SKUs</span>
              <strong className="font-mono tabular-nums text-sm font-extrabold text-slate-900">
                {counts.total}
              </strong>
            </div>
            <div className="h-7 w-px bg-slate-200" aria-hidden="true" />
            <div>
              <span className="text-slate-500 block text-[11px]">Units at Risk</span>
              <strong className="font-mono tabular-nums text-sm font-extrabold text-amber-700">
                {counts.totalUnits.toLocaleString()}
              </strong>
            </div>
            <div className="h-7 w-px bg-slate-200" aria-hidden="true" />
            <div>
              <span className="text-slate-500 block text-[11px]">Stock Value</span>
              <strong className="font-mono tabular-nums text-sm font-extrabold text-rose-700">
                {formatCurr(counts.totalValue)}
              </strong>
            </div>
          </div>

          {onNavigateTab && (
            <button
              type="button"
              onClick={() => onNavigateTab('expiry-damage')}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <span>Manage Expiry</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
          {onHide && (
            <button
              type="button"
              onClick={onHide}
              aria-label="Hide 30-Day Expiry Priority Watchlist"
              className="px-2.5 py-2 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-200 hover:border-rose-200 rounded-xl text-xs font-bold transition whitespace-nowrap shrink-0 inline-flex items-center gap-1 cursor-pointer"
            >
              <EyeOff className="w-3.5 h-3.5" />
              <span>Hide</span>
            </button>
          )}
        </div>
      </div>

      {/* Interactive Filter Segmented Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold overflow-x-auto">
          {(
            [
              { id: 'all', label: `All ≤ ${maxDays}d (${counts.total})` },
              { id: 'expired', label: `Expired (${counts.expired})` },
              { id: 'critical', label: `Critical 0–7d (${counts.critical})` },
              { id: 'warning', label: `Watch 8–${maxDays}d (${counts.warning})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setFilterTab(tab.id);
                setShowAllRows(false);
              }}
              className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap shrink-0 cursor-pointer ${
                filterTab === tab.id
                  ? 'bg-white text-slate-900 shadow-xs font-extrabold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="text-xs text-slate-500 font-medium">
          FEFO Priority · Reference date:{' '}
          <span className="font-mono tabular-nums font-bold text-slate-700">
            {effectiveRefDate}
          </span>
        </div>
      </div>

      {/* Prioritized Product Table or Empty State */}
      {filteredEntries.length === 0 ? (
        <div className="py-8 px-4 bg-slate-50/80 rounded-2xl border border-dashed border-slate-200 text-center">
          <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
          <p className="text-sm font-extrabold text-slate-800">
            {allWithinWindow.length === 0
              ? `No active stock expires within ${maxDays} days`
              : 'No products match this urgency filter'}
          </p>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            {allWithinWindow.length === 0
              ? `All in-stock items have an expiryDate beyond ${maxDays} days from ${effectiveRefDate}.`
              : 'Switch to "All" above to view every product within the 30-day window.'}
          </p>
          {filterTab !== 'all' ? (
            <button
              type="button"
              onClick={() => setFilterTab('all')}
              className="mt-3 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition cursor-pointer"
            >
              Show All ≤ {maxDays} Days
            </button>
          ) : onNavigateTab ? (
            <button
              type="button"
              onClick={() => onNavigateTab('inventory')}
              className="mt-3 px-4 py-2 bg-white border border-slate-200 text-slate-800 rounded-xl text-xs font-bold hover:bg-slate-100 transition cursor-pointer inline-flex items-center gap-1.5"
            >
              <PackageCheck className="w-3.5 h-3.5" />
              <span>Review Inventory Stock</span>
            </button>
          ) : null}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/90 text-slate-700 uppercase tracking-wider text-[10px] border-b border-slate-200">
                <tr>
                  <th className="p-3 font-bold">Product &amp; Batch</th>
                  <th className="p-3 font-bold">Expiry Date</th>
                  <th className="p-3 font-bold">Urgency</th>
                  <th className="p-3 font-bold text-right">Available Stock</th>
                  <th className="p-3 font-bold text-right">At-Risk Value</th>
                  {onNavigateTab && <th className="p-3 font-bold text-right">Prioritize Movement</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleEntries.map((entry) => {
                  const { item } = entry;
                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-50/90 transition ${
                        entry.urgency === 'expired' ? 'bg-rose-50/35' : ''
                      }`}
                    >
                      <td className="p-3">
                        <div className="font-extrabold text-slate-900">{item.name}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          <span>SKU {item.sku || 'N/A'}</span>
                          <span aria-hidden="true"> · </span>
                          <span>Batch {item.batchNo || 'N/A'}</span>
                          <span aria-hidden="true"> · </span>
                          <span>{item.location || 'Main Warehouse'}</span>
                        </div>
                      </td>
                      <td className="p-3 font-mono tabular-nums font-bold text-slate-700 whitespace-nowrap">
                        {entry.expiryDateYMD}
                      </td>
                      <td className="p-3">{renderUrgencyLabel(entry)}</td>
                      <td className="p-3 text-right font-mono tabular-nums font-bold text-slate-900 whitespace-nowrap">
                        {item.quantity.toLocaleString()} {item.unit}
                      </td>
                      <td className="p-3 text-right font-mono tabular-nums font-extrabold text-slate-900 whitespace-nowrap">
                        {formatCurr(entry.stockValue)}
                      </td>
                      {onNavigateTab && (
                        <td className="p-3 text-right">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            {entry.urgency === 'expired' ? (
                              <button
                                type="button"
                                onClick={() => onNavigateTab('expiry-damage')}
                                className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[11px] font-bold transition whitespace-nowrap cursor-pointer inline-flex items-center gap-1"
                              >
                                <AlertTriangle className="w-3 h-3" />
                                <span>Write Off</span>
                              </button>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => onNavigateTab('pos')}
                                  className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold transition whitespace-nowrap cursor-pointer inline-flex items-center gap-1"
                                >
                                  <Tag className="w-3 h-3" />
                                  <span>POS Push</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onNavigateTab('sales')}
                                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-[11px] font-bold transition whitespace-nowrap cursor-pointer inline-flex items-center gap-1 border border-slate-200"
                                >
                                  <ShoppingCart className="w-3 h-3" />
                                  <span>Wholesale</span>
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredEntries.length > 8 && (
            <div className="pt-2 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100">
              <span>
                Showing {visibleEntries.length} of {filteredEntries.length} prioritized products
              </span>
              <button
                type="button"
                onClick={() => setShowAllRows((prev) => !prev)}
                className="font-bold text-teal-700 hover:text-teal-800 hover:underline cursor-pointer"
              >
                {showAllRows ? 'Show Top 8 Only' : `View All ${filteredEntries.length} Products`}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
};
