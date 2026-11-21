import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, Eraser, PenTool, Sparkles, X } from 'lucide-react';

export interface SignatureUpdatePayload {
  mode: 'auto' | 'manual';
  signerName: string;
  signerTitle?: string;
  signatureDataUrl?: string;
}

interface SignaturePadModalProps {
  title?: string;
  initialMode?: 'auto' | 'manual';
  defaultUserName: string;
  defaultUserId?: string;
  initialSignerName?: string;
  initialSignerTitle?: string;
  initialSignatureDataUrl?: string;
  onSave: (payload: SignatureUpdatePayload) => void;
  onClose: () => void;
}

export const SignaturePadModal: React.FC<SignaturePadModalProps> = ({
  title = 'Authorized Signature Setup',
  initialMode = 'auto',
  defaultUserName,
  defaultUserId,
  initialSignerName,
  initialSignerTitle,
  initialSignatureDataUrl,
  onSave,
  onClose,
}) => {
  const [mode, setMode] = useState<'auto' | 'manual'>(
    initialSignatureDataUrl ? 'manual' : initialMode
  );
  const [signerName, setSignerName] = useState(initialSignerName || defaultUserName);
  const [signerTitle, setSignerTitle] = useState(initialSignerTitle || '');
  const [inkColor, setInkColor] = useState<'#1e3a8a' | '#0f172a'>('#1e3a8a');
  const [hasStroke, setHasStroke] = useState(!!initialSignatureDataUrl);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);

  useEffect(() => {
    if (mode !== 'manual') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (initialSignatureDataUrl) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setHasStroke(true);
      };
      img.src = initialSignatureDataUrl;
    }
  }, [mode, initialSignatureDataUrl]);

  const getPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { x, y } = getPoint(e);
    ctx.strokeStyle = inkColor;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    isDrawingRef.current = true;
    setHasStroke(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { x, y } = getPoint(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handlePointerUp = () => {
    isDrawingRef.current = false;
  };

  const handleClearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasStroke(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = signerName.trim() || defaultUserName || 'Authorized Signatory';
    if (mode === 'auto') {
      onSave({
        mode: 'auto',
        signerName: cleanName,
        signerTitle: signerTitle.trim() || undefined,
        signatureDataUrl: undefined,
      });
      return;
    }

    const canvas = canvasRef.current;
    const dataUrl = canvas && hasStroke ? canvas.toDataURL('image/png') : undefined;
    onSave({
      mode: 'manual',
      signerName: cleanName,
      signerTitle: signerTitle.trim() || undefined,
      signatureDataUrl: dataUrl,
    });
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full max-h-[90dvh] overflow-y-auto p-5 space-y-4 text-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
              <PenTool className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">{title}</h3>
              <p className="text-[11px] text-slate-500">
                অটো ইউজার স্বাক্ষর অথবা হাতে এঁকে ম্যানুয়াল স্বাক্ষর সেট করুন
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Signature Pad"
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Mode Switcher */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl font-bold">
            <button
              type="button"
              onClick={() => setMode('auto')}
              className={`py-2 px-2 rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
                mode === 'auto'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span>Auto User Sign</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('manual')}
              className={`py-2 px-2 rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
                mode === 'manual'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <PenTool className="w-3.5 h-3.5 shrink-0" />
              <span>Draw Manual Sign</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                Signatory Name *
              </label>
              <input
                type="text"
                required
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                placeholder="e.g. Sirajul Islam"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                Designation (Optional)
              </label>
              <input
                type="text"
                value={signerTitle}
                onChange={(e) => setSignerTitle(e.target.value)}
                placeholder="e.g. Sales Manager / Admin"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {mode === 'auto' ? (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-center space-y-1.5">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">
                Auto Signature Preview ({defaultUserId ? `@${defaultUserId}` : 'Active User'})
              </span>
              <div className="font-serif italic font-bold text-2xl text-indigo-900 tracking-wide py-2">
                {signerName || defaultUserName}
              </div>
              <div className="w-44 mx-auto border-b border-slate-400" />
              <div className="text-[11px] font-bold text-slate-700">
                Authorized Signature
                {signerTitle ? ` • ${signerTitle}` : ''}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-600">
                  আঙুল বা মাউস দিয়ে নিচের বক্সে স্বাক্ষর আঁকুন:
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setInkColor('#1e3a8a')}
                    title="Blue Ink"
                    className={`w-5 h-5 rounded-full bg-blue-900 border-2 cursor-pointer ${
                      inkColor === '#1e3a8a' ? 'border-emerald-500 scale-110' : 'border-slate-300'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setInkColor('#0f172a')}
                    title="Black Ink"
                    className={`w-5 h-5 rounded-full bg-slate-900 border-2 cursor-pointer ${
                      inkColor === '#0f172a' ? 'border-emerald-500 scale-110' : 'border-slate-300'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={handleClearCanvas}
                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Eraser className="w-3 h-3" />
                    <span>Clear</span>
                  </button>
                </div>
              </div>

              <div className="border-2 border-dashed border-slate-300 rounded-2xl overflow-hidden bg-white">
                <canvas
                  ref={canvasRef}
                  width={420}
                  height={160}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                  className="w-full h-36 touch-none cursor-crosshair block bg-white"
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Save Signature</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
