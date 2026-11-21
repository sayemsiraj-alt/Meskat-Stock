import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StockItem } from '../data/mockData';
import { encodeCode39Bars } from '../utils/erpEnhancements';
import { formatDDMMYY } from '../utils/dateUtils';
import { Barcode, Camera, Printer, Search, X } from 'lucide-react';

interface BarcodeLabelModalProps {
  items: StockItem[];
  initialSelectedIds?: string[];
  brandName: string;
  currency: string;
  onClose: () => void;
}

const Code39Svg: React.FC<{ value: string; height?: number }> = ({
  value,
  height = 38,
}) => {
  const { bars, totalWidth, encodedText } = useMemo(
    () => encodeCode39Bars(value),
    [value]
  );

  return (
    <div className="flex flex-col items-center">
      <svg
        viewBox={`0 0 ${totalWidth} ${height}`}
        className="w-full h-9 max-w-[180px]"
        preserveAspectRatio="none"
        aria-label={`Barcode ${encodedText}`}
      >
        <rect x={0} y={0} width={totalWidth} height={height} fill="#ffffff" />
        {bars.map((b, idx) => (
          <rect
            key={idx}
            x={b.x}
            y={0}
            width={b.width}
            height={height}
            fill="#0f172a"
          />
        ))}
      </svg>
      <span className="font-mono text-[10px] font-bold tracking-widest text-slate-900 mt-0.5">
        {encodedText}
      </span>
    </div>
  );
};

export const BarcodeLabelModal: React.FC<BarcodeLabelModalProps> = ({
  items,
  initialSelectedIds,
  brandName,
  currency,
  onClose,
}) => {
  const [copiesMap, setCopiesMap] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    if (initialSelectedIds && initialSelectedIds.length > 0) {
      initialSelectedIds.forEach((id) => {
        map[id] = 4;
      });
    } else {
      items.slice(0, 6).forEach((it) => {
        map[it.id] = 2;
      });
    }
    return map;
  });

  const formatSym =
    currency.includes('৳') || currency.toLowerCase().includes('bdt')
      ? '৳'
      : currency;

  const labelsToPrint = useMemo(() => {
    const list: Array<{ item: StockItem; copyIdx: number }> = [];
    for (const item of items) {
      const count = Math.max(0, Math.min(60, Number(copiesMap[item.id] || 0)));
      for (let i = 0; i < count; i++) {
        list.push({ item, copyIdx: i });
      }
    }
    return list;
  }, [items, copiesMap]);

  return (
    <div className="fixed inset-0 bg-slate-950/80 flex items-start justify-center p-3 sm:p-6 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-5xl w-full p-5 sm:p-6 space-y-5 my-auto text-slate-900">
        {/* Control Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4 no-print">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-900 text-emerald-400 flex items-center justify-center">
              <Barcode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-base">
                Barcode &amp; MRP Sticker Print Sheet
              </h3>
              <p className="text-xs text-slate-500">
                Set label copy counts per SKU and print cleanly onto A4 or thermal label stickers.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={labelsToPrint.length === 0}
              onClick={() => window.print()}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white font-extrabold rounded-xl text-xs flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print Labels ({labelsToPrint.length})</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Barcode Print Modal"
              className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Selector Controls */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2 no-print">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase text-slate-600">
              Select Quantities per SKU
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  const next: Record<string, number> = {};
                  items.forEach((it) => {
                    next[it.id] = 2;
                  });
                  setCopiesMap(next);
                }}
                className="text-[11px] font-bold text-emerald-700 hover:underline cursor-pointer"
              >
                2 Each All
              </button>
              <button
                type="button"
                onClick={() => setCopiesMap({})}
                className="text-[11px] font-bold text-slate-500 hover:underline cursor-pointer"
              >
                Clear All
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-44 overflow-y-auto pr-1">
            {items.map((it) => (
              <div
                key={it.id}
                className="flex items-center justify-between gap-2 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs"
              >
                <div className="min-w-0">
                  <div className="font-bold text-slate-900 truncate">
                    {it.name}
                  </div>
                  <div className="text-[10px] font-mono text-slate-400 truncate">
                    {it.sku} • Bth: {it.batchNo}
                  </div>
                </div>
                <input
                  type="number"
                  min="0"
                  max="60"
                  value={copiesMap[it.id] ?? 0}
                  onChange={(e) =>
                    setCopiesMap((prev) => ({
                      ...prev,
                      [it.id]: Math.max(0, Number(e.target.value) || 0),
                    }))
                  }
                  className="w-14 bg-slate-50 border border-slate-300 rounded-md px-2 py-1 text-center font-mono font-bold text-xs"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Printable Label Grid */}
        <div
          id="printable-barcode-sheet"
          className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-white"
        >
          {labelsToPrint.map(({ item, copyIdx }) => (
            <div
              key={`${item.id}-${copyIdx}`}
              className="border border-slate-400 rounded-lg p-3 flex flex-col justify-between text-center bg-white break-inside-avoid"
            >
              <div className="text-[9px] font-extrabold uppercase tracking-wider text-slate-500 truncate">
                {brandName}
              </div>
              <div className="font-extrabold text-xs text-slate-950 truncate mt-0.5">
                {item.name}
              </div>
              {item.packSize && (
                <div className="text-[10px] font-semibold text-slate-600">
                  {item.packSize}
                </div>
              )}

              <div className="my-1.5">
                <Code39Svg value={item.sku} />
              </div>

              <div className="flex items-center justify-between text-[10px] border-t border-slate-200 pt-1.5 mt-1 font-mono">
                <span className="text-slate-600">B:{item.batchNo}</span>
                <span className="text-slate-600">
                  Exp:{formatDDMMYY(item.expiryDate)}
                </span>
              </div>
              <div className="mt-1 font-mono font-black text-xs text-slate-950">
                MRP: {formatSym} {(item.retailPrice || item.price).toLocaleString()}/=
              </div>
            </div>
          ))}

          {labelsToPrint.length === 0 && (
            <div className="col-span-full py-10 text-center text-xs text-slate-400 border border-dashed border-slate-300 rounded-xl">
              Increase copy count above to preview and print barcode stickers.
            </div>
          )}
        </div>
      </div>

      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 8mm; }
          body * { visibility: hidden !important; }
          #printable-barcode-sheet, #printable-barcode-sheet * {
            visibility: visible !important;
          }
          #printable-barcode-sheet {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            padding: 6px !important;
            background: #ffffff !important;
          }
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  );
};

interface BarcodeScannerInputProps {
  items: StockItem[];
  onMatchItem: (item: StockItem) => void;
  placeholder?: string;
  compact?: boolean;
}

export const BarcodeScannerInput: React.FC<BarcodeScannerInputProps> = ({
  items,
  onMatchItem,
  placeholder = 'Scan Barcode or Type SKU / Name + Press Enter...',
  compact = false,
}) => {
  const [scanCode, setScanCode] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [scannerModalOpen, setScannerModalOpen] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [continuousMode, setContinuousMode] = useState(true);
  const [modalLookupQuery, setModalLookupQuery] = useState('');
  const [recentScans, setRecentScans] = useState<Array<{ sku: string; name: string; at: string }>>([]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastScannedRef = useRef<{ code: string; ts: number }>({ code: '', ts: 0 });
  const continuousModeRef = useRef<boolean>(continuousMode);
  continuousModeRef.current = continuousMode;

  const supportsBarcodeDetector =
    typeof window !== 'undefined' && 'BarcodeDetector' in window;

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const closeScannerModal = () => {
    stopCamera();
    setScannerModalOpen(false);
    setCameraError('');
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const recordMatch = (exact: StockItem) => {
    onMatchItem(exact);
    setScanCode('');
    setFeedback({ type: 'ok', text: `Matched: ${exact.name} (${exact.sku})` });
    setRecentScans((prev) => [
      { sku: exact.sku, name: exact.name, at: new Date().toLocaleTimeString() },
      ...prev.slice(0, 7),
    ]);
    setTimeout(() => setFeedback(null), 2500);
  };

  const handleLookup = (rawCode: string): boolean => {
    const clean = rawCode.trim().toLowerCase();
    if (!clean) return false;
    const exact =
      items.find((i) => i.sku.toLowerCase() === clean) ||
      items.find((i) => i.id.toLowerCase() === clean) ||
      items.find((i) => i.batchNo.toLowerCase() === clean) ||
      items.find((i) => i.name.toLowerCase() === clean) ||
      items.find(
        (i) =>
          i.sku.toLowerCase().includes(clean) ||
          i.name.toLowerCase().includes(clean)
      );

    if (!exact) {
      setFeedback({ type: 'err', text: `No SKU matched "${rawCode.trim()}"` });
      return false;
    }

    recordMatch(exact);
    return true;
  };

  const handleStartCamera = async () => {
    setCameraError('');
    if (!supportsBarcodeDetector || !navigator.mediaDevices?.getUserMedia) {
      setCameraError(
        'Live camera BarcodeDetector is not available in this browser. Use a USB/Bluetooth barcode scanner or click any product below.'
      );
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      setCameraActive(true);
      setTimeout(async () => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          const DetectorCtor = (window as unknown as { BarcodeDetector: new (opts: { formats: string[] }) => { detect: (el: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>> } }).BarcodeDetector;
          const detector = new DetectorCtor({
            formats: ['code_39', 'code_128', 'ean_13', 'ean_8', 'qr_code'],
          });
          const tick = async () => {
            if (!videoRef.current || !streamRef.current) return;
            try {
              const detected = await detector.detect(videoRef.current);
              if (detected && detected.length > 0 && detected[0].rawValue) {
                const rawVal = detected[0].rawValue;
                const now = Date.now();
                const isRepeatCooldown =
                  lastScannedRef.current.code === rawVal &&
                  now - lastScannedRef.current.ts < 1400;
                if (!isRepeatCooldown) {
                  lastScannedRef.current = { code: rawVal, ts: now };
                  const matched = handleLookup(rawVal);
                  if (matched && !continuousModeRef.current) {
                    closeScannerModal();
                    return;
                  }
                }
              }
            } catch {
              // ignore frame read error
            }
            if (streamRef.current) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      }, 100);
    } catch {
      setCameraError(
        'Camera permission denied or unavailable. Use USB barcode scanner input or click a product below.'
      );
      stopCamera();
    }
  };

  const filteredModalItems = useMemo(() => {
    const q = modalLookupQuery.trim().toLowerCase();
    const list = q
      ? items.filter(
          (it) =>
            it.sku.toLowerCase().includes(q) ||
            it.name.toLowerCase().includes(q) ||
            it.batchNo.toLowerCase().includes(q)
        )
      : items;
    return list.slice(0, 30);
  }, [items, modalLookupQuery]);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-emerald-600">
            <Barcode className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={scanCode}
            onChange={(e) => setScanCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleLookup(scanCode);
              }
            }}
            placeholder={placeholder}
            aria-label="Barcode or SKU quick scan input"
            className={`w-full bg-emerald-50/60 border border-emerald-200 rounded-xl pl-9 pr-3 font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
              compact ? 'py-2 text-xs' : 'py-2.5 text-xs'
            }`}
          />
        </div>
        <button
          type="button"
          onClick={() => handleLookup(scanCode)}
          className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer shrink-0"
        >
          <Search className="w-3.5 h-3.5" />
          <span>Match</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setScannerModalOpen(true);
            setModalLookupQuery('');
            if (supportsBarcodeDetector) {
              handleStartCamera();
            }
          }}
          title="Open Camera Scanner & Quick SKU Lookup"
          className="px-2.5 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border border-emerald-200 rounded-xl text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shrink-0"
        >
          <Camera className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Scan / Find</span>
        </button>
      </div>

      {feedback && (
        <div
          className={`text-[11px] font-bold px-2.5 py-1 rounded-lg ${
            feedback.type === 'ok'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-700 border border-rose-200'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {scannerModalOpen && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full p-5 space-y-4 text-slate-900 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Camera className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900">
                    Barcode Scanner &amp; Instant SKU Picker
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    USB/Bluetooth barcode gun, live camera scanner, or click any product to add
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeScannerModal}
                aria-label="Close Barcode Scanner Modal"
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Camera Controls & USB Wedge Box */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-slate-950 rounded-xl overflow-hidden border border-slate-300 relative min-h-[160px] flex flex-col items-center justify-center p-3 text-center">
                {cameraActive ? (
                  <>
                    <video ref={videoRef} className="w-full h-40 object-cover rounded-lg" muted />
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="mt-2 px-3 py-1 bg-rose-600 text-white rounded-lg text-[11px] font-bold cursor-pointer"
                    >
                      Stop Camera
                    </button>
                  </>
                ) : (
                  <div className="space-y-2 text-slate-300">
                    <Camera className="w-7 h-7 mx-auto text-emerald-400" />
                    <p className="text-[11px] leading-snug px-2">
                      {cameraError ||
                        (supportsBarcodeDetector
                          ? 'Point camera at Code39 / Code128 / EAN / QR barcode'
                          : 'Browser lacks BarcodeDetector API — use USB scanner or SKU list')}
                    </p>
                    {supportsBarcodeDetector && (
                      <button
                        type="button"
                        onClick={handleStartCamera}
                        className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 rounded-lg text-xs font-extrabold cursor-pointer"
                      >
                        Start Camera
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-3 bg-slate-50 border border-slate-200 rounded-xl p-3">
                <label className="flex items-center justify-between gap-2 text-xs font-bold text-slate-800 cursor-pointer">
                  <span>Continuous Multi-Scan Mode</span>
                  <input
                    type="checkbox"
                    checked={continuousMode}
                    onChange={(e) => setContinuousMode(e.target.checked)}
                    className="w-4 h-4 accent-emerald-600 cursor-pointer"
                  />
                </label>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-600 mb-1">
                    USB / Keyboard Barcode or Quick Filter
                  </label>
                  <input
                    type="text"
                    autoFocus
                    value={modalLookupQuery}
                    onChange={(e) => setModalLookupQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const ok = handleLookup(modalLookupQuery);
                        if (ok) {
                          setModalLookupQuery('');
                          if (!continuousMode) closeScannerModal();
                        }
                      }
                    }}
                    placeholder="Scan barcode or type SKU / Name..."
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {recentScans.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-[10px] font-bold uppercase text-emerald-700">
                      Session Scanned ({recentScans.length})
                    </div>
                    <div className="max-h-20 overflow-y-auto space-y-1">
                      {recentScans.map((s, idx) => (
                        <div
                          key={`${s.sku}-${idx}`}
                          className="flex items-center justify-between text-[11px] bg-emerald-50 border border-emerald-200 px-2 py-1 rounded"
                        >
                          <span className="font-bold text-emerald-950 truncate">{s.name}</span>
                          <span className="font-mono text-[10px] text-emerald-700 shrink-0 ml-2">
                            {s.sku} · {s.at}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Instant Searchable Product Fallback List */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="bg-slate-100 px-3 py-2 text-[10px] font-extrabold uppercase text-slate-600 flex justify-between">
                <span>Tap Product to Select / Add ({filteredModalItems.length} shown)</span>
                <span>SKU · Batch · Stock</span>
              </div>
              <div className="max-h-56 overflow-y-auto divide-y divide-slate-100">
                {filteredModalItems.map((it) => (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => {
                      recordMatch(it);
                      if (!continuousMode) closeScannerModal();
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-emerald-50 flex items-center justify-between gap-2 text-xs transition cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 truncate">{it.name}</div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {it.sku} · Batch {it.batchNo || '-'}
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-slate-100 font-mono font-bold text-[11px] text-slate-800 shrink-0">
                      Stock: {it.quantity}
                    </span>
                  </button>
                ))}
                {filteredModalItems.length === 0 && (
                  <div className="p-6 text-center text-xs text-slate-400">
                    No matching inventory SKUs found.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
