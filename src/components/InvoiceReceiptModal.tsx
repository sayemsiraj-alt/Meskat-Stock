import React, { useEffect, useState } from 'react';
import { Invoice, SystemUser, Wholesaler } from '../data/mockData';
import {
  CheckCircle2,
  Printer,
  Download,
  MessageSquare,
  Copy,
  Check,
  X,
  RotateCcw,
  ExternalLink,
  PenTool,
  FileText,
  Receipt,
} from 'lucide-react';
import { CompanyLogo } from './CompanyLogo';
import { SignaturePadModal, SignatureUpdatePayload } from './SignaturePadModal';
import { formatDDMMYY } from '../utils/dateUtils';
import {
  numberToBengaliWords,
  toBengaliDigits,
  numberToEnglishWords,
  formatTkAmount,
} from '../utils/numberToWords';
import {
  buildInvoiceWhatsAppText,
  getCourierTrackingUrl,
  getWhatsAppUrl,
} from '../utils/erpEnhancements';
import {
  downloadInvoiceA4Pdf,
  downloadInvoiceThermalPdf,
  formatCompanyContactSuffix,
  isInsideIframeEnv,
  resolveAuthorizedSignatureInfo,
  sendInvoicePdfToWhatsApp,
} from '../utils/printAndDownload';

interface InvoiceReceiptModalProps {
  invoice: Invoice;
  customer?: Wholesaler | null;
  currentUser?: SystemUser;
  brandName: string;
  brandShortName: string;
  storeName: string;
  logoUrl?: string;
  address: string;
  phone: string;
  companyEmail?: string;
  companyWebsite?: string;
  initialPaperLayout?: 'a4' | 'thermal';
  onClose: () => void;
  onUpdateInvoiceSignature?: (updatedInv: Invoice) => void;
  onCopySummary?: (inv: Invoice) => void;
  onShareWhatsApp?: (inv: Invoice) => void;
  onRepeatOrder?: (inv: Invoice) => void;
  copied?: boolean;
}

export const InvoiceReceiptModal: React.FC<InvoiceReceiptModalProps> = ({
  invoice,
  customer,
  currentUser,
  brandName,
  brandShortName,
  storeName,
  logoUrl,
  address,
  phone,
  companyEmail,
  companyWebsite,
  initialPaperLayout = 'a4',
  onClose,
  onUpdateInvoiceSignature,
  onCopySummary,
  onShareWhatsApp,
  onRepeatOrder,
  copied = false,
}) => {
  const companyContactSuffix = formatCompanyContactSuffix(companyEmail, companyWebsite);
  const [receiptStyle, setReceiptStyle] = useState<'english' | 'bengali'>('english');
  const [paperLayout, setPaperLayout] = useState<'a4' | 'thermal'>(initialPaperLayout);
  const [localSigOverride, setLocalSigOverride] = useState<Partial<Invoice> | null>(null);
  const [isSignModalOpen, setIsSignModalOpen] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);
  const [actionBanner, setActionBanner] = useState<string>('');

  useEffect(() => {
    setPaperLayout(initialPaperLayout || 'a4');
    setLocalSigOverride(null);
  }, [invoice.id, initialPaperLayout]);

  useEffect(() => {
    const handleBack = (evt: Event) => {
      evt.preventDefault();
      if (isSignModalOpen) {
        setIsSignModalOpen(false);
      } else {
        onClose();
      }
    };
    window.addEventListener('erp:history-back', handleBack);
    return () => window.removeEventListener('erp:history-back', handleBack);
  }, [isSignModalOpen, onClose]);

  const effectiveInvoice: Invoice = localSigOverride
    ? { ...invoice, ...localSigOverride }
    : invoice;

  const sigInfo = resolveAuthorizedSignatureInfo(
    effectiveInvoice,
    brandName || storeName || 'Management',
    currentUser
  );

  const canEditSig = !!onUpdateInvoiceSignature || (!!currentUser && currentUser.role !== 'customer');

  const whatsappUrl = getWhatsAppUrl(
    effectiveInvoice.customerPhone || customer?.phone,
    buildInvoiceWhatsAppText(effectiveInvoice, brandName || storeName || 'STOCK ERP')
  );
  const trackingUrl = getCourierTrackingUrl(
    effectiveInvoice.courierName,
    effectiveInvoice.courierTrackingNo
  );

  const handleDownloadPdf = async () => {
    setIsGeneratingPdf(true);
    try {
      const ok =
        paperLayout === 'thermal'
          ? await downloadInvoiceThermalPdf({
              invoice: effectiveInvoice,
              customer,
              brandName,
              brandShortName,
              storeName,
              address,
              phone,
              companyEmail,
              companyWebsite,
            })
          : await downloadInvoiceA4Pdf({
              invoice: effectiveInvoice,
              customer,
              brandName,
              brandShortName,
              storeName,
              logoUrl,
              address,
              phone,
              companyEmail,
              companyWebsite,
            });
      const fileLabel =
        paperLayout === 'thermal'
          ? `Invoice_${effectiveInvoice.chalanNo}_Thermal80mm.pdf`
          : `Invoice_${effectiveInvoice.chalanNo}.pdf`;
      setActionBanner(
        ok
          ? `Saved ${fileLabel}! Check your Downloads folder to view or print.`
          : 'Unable to generate PDF on this device.'
      );
      setTimeout(() => setActionBanner(''), 4500);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleSendWhatsAppPdf = async () => {
    if (isSendingWhatsApp) return;
    setIsSendingWhatsApp(true);
    try {
      if (onShareWhatsApp) {
        onShareWhatsApp(effectiveInvoice);
      }
      const outcome = await sendInvoicePdfToWhatsApp({
        invoice: effectiveInvoice,
        customer,
        brandName,
        brandShortName,
        storeName,
        logoUrl,
        address,
        phone,
        companyEmail,
        companyWebsite,
        paperLayout,
      });
      if (outcome.status === 'shared') {
        setActionBanner(`Shared ${outcome.filename} directly via WhatsApp / Share Sheet!`);
      } else if (outcome.status === 'downloaded-and-opened') {
        setActionBanner(
          outcome.hasPhone
            ? `${outcome.filename} downloaded & customer's WhatsApp chat opened — attach/drop the PDF file in chat to send!`
            : `${outcome.filename} downloaded & WhatsApp opened — select customer & attach the PDF file!`
        );
      } else if (outcome.status === 'error') {
        setActionBanner('Could not generate PDF for WhatsApp sharing on this device.');
      }
      if (outcome.status !== 'cancelled') {
        setTimeout(() => setActionBanner(''), 5500);
      }
    } finally {
      setIsSendingWhatsApp(false);
    }
  };

  const handlePrintOrPdf = async () => {
    if (isInsideIframeEnv()) {
      await handleDownloadPdf();
      return;
    }
    try {
      window.print();
    } catch {
      await handleDownloadPdf();
    }
  };

  const handleSaveSignature = (payload: SignatureUpdatePayload) => {
    const patch: Partial<Invoice> = {
      authorizedSignatureMode: payload.mode,
      authorizedSignerName: payload.signerName,
      authorizedSignerTitle: payload.signerTitle,
      authorizedSignatureDataUrl: payload.signatureDataUrl,
    };
    const updated: Invoice = { ...effectiveInvoice, ...patch };
    setLocalSigOverride(patch);
    if (onUpdateInvoiceSignature) {
      onUpdateInvoiceSignature(updated);
    }
    setIsSignModalOpen(false);
    setActionBanner(
      payload.mode === 'manual'
        ? 'Manual Authorized Signature applied to invoice!'
        : `Auto User Signature updated (${payload.signerName}).`
    );
    setTimeout(() => setActionBanner(''), 3500);
  };

  return (
    <div id="invoice-modal-backdrop" className="fixed inset-0 bg-slate-950/80 flex items-start justify-center p-2 sm:p-6 z-50 overflow-y-auto">
      <div id="invoice-modal-shell" className="max-w-4xl w-full space-y-3 relative my-auto">
        {/* Modal Control Header (Hidden when printing) */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-300 p-3 sm:px-5 sm:py-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 no-print print:hidden">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <span className="text-slate-900 font-black text-base">
                Invoice Preview #{invoice.chalanNo}
              </span>
              <div className="text-[11px] text-slate-500 font-medium">
                {paperLayout === 'thermal'
                  ? '80mm Thermal Printer-Ready Layout'
                  : 'A4 Sheet Printer-Ready Layout'}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {/* Paper layout toggle: A4 Sheet vs 80mm Thermal */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
              <button
                type="button"
                onClick={() => setPaperLayout('a4')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 whitespace-nowrap ${
                  paperLayout === 'a4'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileText className="w-3.5 h-3.5 shrink-0" />
                <span>A4 Sheet</span>
              </button>
              <button
                type="button"
                onClick={() => setPaperLayout('thermal')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 whitespace-nowrap ${
                  paperLayout === 'thermal'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Receipt className="w-3.5 h-3.5 shrink-0" />
                <span>Thermal 80mm</span>
              </button>
            </div>

            {/* Format toggle: English vs Bengali Memo */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
              <button
                type="button"
                onClick={() => setReceiptStyle('english')}
                className={`px-3 py-1 rounded-lg transition cursor-pointer whitespace-nowrap ${
                  receiptStyle === 'english'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                English Invoice
              </button>
              <button
                type="button"
                onClick={() => setReceiptStyle('bengali')}
                className={`px-3 py-1 rounded-lg transition cursor-pointer whitespace-nowrap ${
                  receiptStyle === 'bengali'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                বাংলা মেমো
              </button>
            </div>

            {onRepeatOrder && (
              <button
                type="button"
                onClick={() => onRepeatOrder(invoice)}
                className="px-3.5 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-extrabold rounded-xl text-xs transition shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Repeat Order
              </button>
            )}

            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs transition shadow-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5 shrink-0" />
              <span>{isGeneratingPdf ? 'Saving PDF...' : 'Download PDF'}</span>
            </button>

            <button
              type="button"
              onClick={handlePrintOrPdf}
              className="px-3.5 py-2 bg-slate-950 hover:bg-slate-800 text-white font-extrabold rounded-xl text-xs transition shadow-md flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Printer className="w-4 h-4 shrink-0" /> Print
            </button>

            {canEditSig && (
              <button
                type="button"
                onClick={() => setIsSignModalOpen(true)}
                className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 font-extrabold rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                title="Customize or Draw Authorized Signature"
              >
                <PenTool className="w-3.5 h-3.5 shrink-0" />
                <span>Signature</span>
              </button>
            )}

            {trackingUrl && (
              <a
                href={trackingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 font-extrabold rounded-xl text-xs transition flex items-center gap-1.5 whitespace-nowrap"
                title="Track Courier Parcel"
              >
                <ExternalLink className="w-3.5 h-3.5 shrink-0" /> Track Parcel
              </a>
            )}

            <button
              type="button"
              onClick={handleSendWhatsAppPdf}
              disabled={isSendingWhatsApp}
              data-whatsapp-url={whatsappUrl}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-extrabold rounded-xl text-xs transition shadow-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              title="1-Click Send Invoice PDF to Customer on WhatsApp"
            >
              <MessageSquare className="w-4 h-4 shrink-0" />
              <span>{isSendingWhatsApp ? 'Preparing PDF...' : 'WhatsApp PDF'}</span>
            </button>

            {onCopySummary && (
              <button
                type="button"
                onClick={() => onCopySummary(effectiveInvoice)}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <Copy className="w-4 h-4 text-slate-600 shrink-0" />
                )}
                <span>{copied ? 'Copied!' : 'Copy Text'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              aria-label="Close Invoice Preview"
              title="Close Invoice Preview"
              className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition font-bold cursor-pointer ml-auto sm:ml-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {actionBanner && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-bold no-print flex items-center justify-between gap-2">
            <span>{actionBanner}</span>
            <button
              type="button"
              onClick={() => setActionBanner('')}
              className="font-black text-emerald-700 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* --- 80MM THERMAL PRINTER-READY LAYOUT OR A4 CHALAN LAYOUT --- */}
        {paperLayout === 'thermal' ? (
          <div className="py-1">
            <div
              id="printable-chalan"
              data-print-layout="thermal"
              className="max-w-[350px] mx-auto bg-white text-slate-950 p-4 border-2 border-dashed border-slate-400 rounded-xl shadow-xs space-y-3 font-sans text-xs"
            >
              {/* Brand Header */}
              <div className="text-center pb-2.5 border-b border-dashed border-slate-400">
                <CompanyLogo
                  className="w-11 h-11 mx-auto mb-1.5"
                  shortName={brandShortName || 'ERP'}
                  logoUrl={logoUrl}
                />
                <h1 className="font-black text-base uppercase tracking-tight text-slate-950">
                  {brandName || storeName || 'STOCK ERP'}
                </h1>
                {storeName && storeName !== brandName && (
                  <p className="text-[11px] font-bold text-slate-700">{storeName}</p>
                )}
                <p className="text-[10px] text-slate-600 mt-0.5">
                  {address || 'Dhaka, Bangladesh'}
                </p>
                <p className="text-[10px] text-slate-600 font-mono">
                  Tel: {phone || '+880 1700-000000'}
                </p>
                {companyContactSuffix && (
                  <p className="text-[10px] text-sky-700 font-semibold">
                    {companyContactSuffix}
                  </p>
                )}
                <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 border border-slate-900 rounded text-[10px] font-black uppercase tracking-wide text-slate-950">
                  <span>
                    {receiptStyle === 'bengali'
                      ? 'বিক্রয় ক্যাশ মেমো (৮০মিমি)'
                      : 'SALES INVOICE (80mm)'}
                  </span>
                  <span>•</span>
                  <span>{effectiveInvoice.status}</span>
                </div>
              </div>

              {/* Invoice & Customer Meta */}
              <div className="text-[11px] space-y-1 pb-2.5 border-b border-dashed border-slate-400 font-mono">
                <div className="flex justify-between gap-2">
                  <span className="font-bold text-slate-600">
                    {receiptStyle === 'bengali' ? 'চালান নং:' : 'Invoice No:'}
                  </span>
                  <span className="font-black text-slate-950">#{effectiveInvoice.chalanNo}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="font-bold text-slate-600">
                    {receiptStyle === 'bengali' ? 'অর্ডার তারিখ:' : 'Order Date:'}
                  </span>
                  <span>{formatDDMMYY(effectiveInvoice.orderDate || effectiveInvoice.date)}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="font-bold text-slate-600">
                    {receiptStyle === 'bengali' ? 'ডেলিভারি:' : 'Delivery:'}
                  </span>
                  <span>{formatDDMMYY(effectiveInvoice.deliveryDate || effectiveInvoice.date)}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="font-bold text-slate-600 shrink-0">
                    {receiptStyle === 'bengali' ? 'ক্রেতা:' : 'Customer:'}
                  </span>
                  <span className="font-sans font-extrabold text-right text-slate-950 truncate">
                    {effectiveInvoice.wholesalerName}
                  </span>
                </div>
                {(effectiveInvoice.customerPhone || customer?.phone) && (
                  <div className="flex justify-between gap-2">
                    <span className="font-bold text-slate-600">
                      {receiptStyle === 'bengali' ? 'মোবাইল:' : 'Phone:'}
                    </span>
                    <span>{effectiveInvoice.customerPhone || customer?.phone}</span>
                  </div>
                )}
                {effectiveInvoice.courierName && (
                  <div className="flex justify-between gap-2">
                    <span className="font-bold text-slate-600 shrink-0">
                      {receiptStyle === 'bengali' ? 'কুরিয়ার:' : 'Courier:'}
                    </span>
                    <span className="font-sans font-bold text-right truncate">
                      {effectiveInvoice.courierName}
                    </span>
                  </div>
                )}
                {effectiveInvoice.courierTrackingNo && (
                  <div className="flex justify-between gap-2">
                    <span className="font-bold text-slate-600">Tracking:</span>
                    <span className="font-bold">{effectiveInvoice.courierTrackingNo}</span>
                  </div>
                )}
              </div>

              {/* Items List */}
              <div className="space-y-1.5 pb-2.5 border-b border-dashed border-slate-400">
                <div className="flex justify-between text-[10px] font-black uppercase text-slate-700 pb-1 border-b border-slate-300">
                  <span>{receiptStyle === 'bengali' ? 'পণ্য ও পরিমাণ' : 'Item / Qty x Rate'}</span>
                  <span className="text-right">
                    {receiptStyle === 'bengali' ? 'মোট টাকা' : 'Amount'}
                  </span>
                </div>
                {effectiveInvoice.items.map((it, idx) => (
                  <div key={idx} className="space-y-0.5 py-0.5 border-b border-dotted border-slate-200 last:border-b-0">
                    <div className="font-bold text-slate-950 text-[11px] leading-snug">
                      {receiptStyle === 'bengali' ? toBengaliDigits(idx + 1) : idx + 1}. {it.itemName}
                      {it.packSize ? (
                        <span className="text-[10px] font-medium text-slate-600">
                          {' '}
                          ({it.packSize})
                        </span>
                      ) : null}
                    </div>
                    <div className="flex justify-between items-center font-mono text-[11px] text-slate-700 pl-3">
                      <span>
                        {receiptStyle === 'bengali'
                          ? `${toBengaliDigits(it.quantity)}${
                              (it.bonusQty || 0) > 0
                                ? ` (+${toBengaliDigits(it.bonusQty || 0)} ফ্রি)`
                                : ''
                            } × ${toBengaliDigits(it.unitPrice)}/-`
                          : `${it.quantity}${
                              (it.bonusQty || 0) > 0 ? ` (+${it.bonusQty} Free)` : ''
                            } × ${it.unitPrice}/=`}
                      </span>
                      <span className="font-black text-slate-950">
                        {receiptStyle === 'bengali'
                          ? `${toBengaliDigits(it.total.toLocaleString())}/-`
                          : formatTkAmount(it.total)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Financial Totals */}
              {(() => {
                const subTotal =
                  effectiveInvoice.subTotal ||
                  effectiveInvoice.items.reduce((s, it) => s + it.total, 0);
                const prevDue = effectiveInvoice.previousDue || 0;
                const grandTotal = effectiveInvoice.grandTotal || effectiveInvoice.totalAmount;
                const paid = effectiveInvoice.paidAmount || 0;
                const totalDue = effectiveInvoice.dueAmount;

                return (
                  <div className="space-y-1 font-mono text-[11px]">
                    <div className="flex justify-between text-slate-700">
                      <span>{receiptStyle === 'bengali' ? 'চলতি বিল:' : 'Subtotal:'}</span>
                      <span className="font-bold">
                        {receiptStyle === 'bengali'
                          ? `${toBengaliDigits(subTotal.toLocaleString())}/-`
                          : formatTkAmount(subTotal)}
                      </span>
                    </div>
                    {prevDue > 0 && (
                      <div className="flex justify-between text-slate-700">
                        <span>{receiptStyle === 'bengali' ? 'পূর্বের বকেয়া:' : 'Previous Due:'}</span>
                        <span className="font-bold">
                          +{' '}
                          {receiptStyle === 'bengali'
                            ? `${toBengaliDigits(prevDue.toLocaleString())}/-`
                            : formatTkAmount(prevDue)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-slate-900 pt-1 border-t border-slate-300">
                      <span>{receiptStyle === 'bengali' ? 'মোট বিল:' : 'Total Amount:'}</span>
                      <span>
                        {receiptStyle === 'bengali'
                          ? `${toBengaliDigits(grandTotal.toLocaleString())}/-`
                          : formatTkAmount(grandTotal)}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-800">
                      <span>{receiptStyle === 'bengali' ? 'অগ্রিম/জমা:' : 'Paid / Advance:'}</span>
                      <span className="font-bold">
                        {receiptStyle === 'bengali'
                          ? `${toBengaliDigits(paid.toLocaleString())}/-`
                          : formatTkAmount(paid)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center bg-slate-950 text-white px-2.5 py-1.5 rounded font-black text-xs mt-1.5">
                      <span>{receiptStyle === 'bengali' ? 'বর্তমান বাকী:' : 'NET DUE BALANCE:'}</span>
                      <span>
                        {receiptStyle === 'bengali'
                          ? `${toBengaliDigits(totalDue.toLocaleString())}/-`
                          : formatTkAmount(totalDue)}
                      </span>
                    </div>
                    <div className="pt-1 text-[10px] font-sans font-semibold text-slate-700 leading-snug">
                      {receiptStyle === 'bengali'
                        ? `কথায়: ${numberToBengaliWords(grandTotal)}`
                        : `In Words: ${numberToEnglishWords(grandTotal)}`}
                    </div>
                  </div>
                );
              })()}

              {/* Authorized Signature */}
              <div className="pt-2.5 border-t border-dashed border-slate-400 text-center space-y-1">
                <div
                  onClick={() => canEditSig && setIsSignModalOpen(true)}
                  title={canEditSig ? 'Click to change signature' : undefined}
                  className={`inline-block ${canEditSig ? 'cursor-pointer' : ''}`}
                >
                  {sigInfo.signatureDataUrl ? (
                    <img
                      src={sigInfo.signatureDataUrl}
                      alt="Authorized Signature"
                      className="h-9 max-w-[140px] object-contain mx-auto"
                    />
                  ) : (
                    <div className="font-serif italic font-bold text-base text-slate-900">
                      {sigInfo.signerName}
                    </div>
                  )}
                  <div className="w-40 border-b border-slate-500 mx-auto my-1" />
                  <div className="text-[10px] font-extrabold text-slate-900">
                    {receiptStyle === 'bengali' ? 'কর্তৃপক্ষের স্বাক্ষর' : 'Authorized Signature'}
                  </div>
                </div>
              </div>

              {/* Tear-off Footer */}
              <div className="pt-2 border-t border-dashed border-slate-400 text-center text-[10px] text-slate-600 space-y-0.5">
                <p className="font-bold text-slate-900">
                  {receiptStyle === 'bengali'
                    ? 'আমাদের সাথে ব্যবসা করার জন্য ধন্যবাদ!'
                    : 'Thank you for your business!'}
                </p>
                <p className="font-mono">
                  80mm Thermal Printer Copy • #{effectiveInvoice.chalanNo}
                </p>
              </div>
            </div>
          </div>
        ) : receiptStyle === 'english' ? (
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-300 p-3 sm:p-6">
          <div
            id="printable-chalan"
            data-print-layout="a4"
            className="bg-white text-slate-900 p-3.5 sm:p-8 border-2 border-slate-400 rounded-lg shadow-xs relative overflow-hidden font-sans text-xs"
          >
            {/* Company Logo Watermark */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt=""
                  className="w-72 h-72 sm:w-80 sm:h-80 object-contain opacity-[0.09] rounded-full"
                />
              ) : (
                <div className="w-64 h-64 rounded-full border-[6px] border-emerald-700/15 flex items-center justify-center opacity-[0.11]">
                  <span className="text-5xl font-serif font-black text-emerald-800 tracking-wider">
                    {brandShortName || 'Dear'}
                  </span>
                </div>
              )}
            </div>

            <div className="relative z-10">
            {/* 1. Header Box */}
            <div className="border border-slate-400 p-3 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="shrink-0 flex flex-col items-center sm:items-start pl-2">
                <div className="flex items-center gap-2">
                  <CompanyLogo
                    className="w-14 h-14"
                    shortName={brandShortName || 'ERP'}
                    logoUrl={logoUrl}
                  />
                </div>
                <span className="text-emerald-700 font-extrabold text-base tracking-wider mt-1">
                  {brandShortName || 'ERP'}
                </span>
              </div>

              <div className="text-center sm:text-left flex-1 sm:pl-6 border-t sm:border-t-0 sm:border-l border-slate-300 pt-2 sm:pt-0">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-emerald-700 tracking-wider font-serif uppercase">
                  {brandName || storeName || 'STOCK ERP'}
                </h1>
                <div className="mt-1 text-xs">
                  <span className="font-bold text-red-600">Head Office :-</span>
                  <span className="text-sky-600 font-semibold ml-1">
                    {address || 'Dhaka, Bangladesh'}
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-sky-700 font-medium flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <span className="font-bold">
                    Phone :- {phone || '+880 1700-000000'}
                  </span>
                  {companyContactSuffix && (
                    <>
                      <span>|</span>
                      <span className="font-semibold">
                        {companyContactSuffix}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* 2. Invoice Meta Grid */}
            <div className="space-y-1.5 text-xs text-slate-900 pt-4 pb-2">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 font-bold">
                <div>
                  <span>Invoice No :- </span>
                  <span className="font-mono">{effectiveInvoice.chalanNo}</span>
                </div>
                <div>
                  <span>Order date:- </span>
                  <span className="font-mono">
                    {formatDDMMYY(effectiveInvoice.orderDate || effectiveInvoice.date)}
                  </span>
                </div>
                <div>
                  <span>Delivery date:- </span>
                  <span className="font-mono">
                    {formatDDMMYY(effectiveInvoice.deliveryDate || effectiveInvoice.date)}
                  </span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 font-bold pt-1">
                <div>
                  <span>Customer Name :- </span>
                  <span className="font-extrabold text-sm">
                    {effectiveInvoice.wholesalerName}
                  </span>
                </div>
                <div>
                  <span>Mobile Number :- </span>
                  <span className="font-mono">
                    {effectiveInvoice.customerPhone || customer?.phone || 'N/A'}
                  </span>
                </div>
              </div>

              <div className="font-bold pt-1">
                <span>Customer Address :- </span>
                <span className="font-semibold">
                  {effectiveInvoice.customerAddress || customer?.address || 'N/A'}
                </span>
              </div>

              {(effectiveInvoice.courierName ||
                effectiveInvoice.courierTrackingNo ||
                effectiveInvoice.totalCartons) && (
                <div className="font-semibold text-slate-700 text-[11px] pt-0.5 flex flex-wrap gap-4">
                  <span>
                    <strong className="text-slate-900">Courier :-</strong>{' '}
                    {effectiveInvoice.courierName || 'Sundarban Courier Service'}
                  </span>
                  {effectiveInvoice.courierTrackingNo && (
                    <span>
                      <strong className="text-slate-900">
                        Booking / Tracking No :-
                      </strong>{' '}
                      {effectiveInvoice.courierTrackingNo}
                    </span>
                  )}
                  {effectiveInvoice.totalCartons && (
                    <span>
                      <strong className="text-slate-900">Cartons :-</strong>{' '}
                      {effectiveInvoice.totalCartons}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* 4. 10-Column Table */}
            <div className="overflow-x-auto my-3">
              <table className="w-full min-w-[660px] border-collapse border border-slate-400 text-xs">
                <thead>
                  <tr className="border-b border-slate-400 text-[11px] font-bold text-slate-800 bg-slate-50">
                    <th className="border-r border-slate-400 px-1.5 py-2 text-center w-9 whitespace-nowrap">
                      No
                    </th>
                    <th className="border-r border-slate-400 px-2 py-2 text-left min-w-[140px]">
                      Product Name
                    </th>
                    <th className="border-r border-slate-400 px-1.5 py-2 text-center w-16 whitespace-nowrap">
                      Size
                    </th>
                    <th className="border-r border-slate-400 px-1.5 py-2 text-center w-16 whitespace-nowrap">
                      Bth No
                    </th>
                    <th className="border-r border-slate-400 px-1.5 py-2 text-center w-16 whitespace-nowrap">
                      Mfg Date
                    </th>
                    <th className="border-r border-slate-400 px-1.5 py-2 text-center w-16 whitespace-nowrap">
                      Exp Date
                    </th>
                    <th className="border-r border-slate-400 px-1.5 py-2 text-right w-14 whitespace-nowrap">
                      M.R.P
                    </th>
                    <th className="border-r border-slate-400 px-1.5 py-2 text-right w-16 whitespace-nowrap">
                      Flat rate
                    </th>
                    <th className="border-r border-slate-400 px-1.5 py-2 text-center w-20 whitespace-nowrap">
                      P: quantity
                    </th>
                    <th className="px-2 py-2 text-right w-24 whitespace-nowrap">
                      Amount Tk
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map((it, idx) => (
                    <tr
                      key={idx}
                      className="border-b border-slate-400 hover:bg-slate-50/50"
                    >
                      <td className="border-r border-slate-400 px-1.5 py-1.5 text-center font-mono font-medium whitespace-nowrap">
                        {String(idx + 1).padStart(2, '0')}
                      </td>
                      <td className="border-r border-slate-400 px-2 py-1.5 font-bold text-slate-900">
                        {it.itemName}
                      </td>
                      <td className="border-r border-slate-400 px-1.5 py-1.5 text-center text-slate-700 whitespace-nowrap">
                        {it.packSize || '200 ml'}
                      </td>
                      <td className="border-r border-slate-400 px-1.5 py-1.5 text-center font-mono text-slate-700 whitespace-nowrap">
                        {it.batchNo || '-'}
                      </td>
                      <td className="border-r border-slate-400 px-1.5 py-1.5 text-center font-mono text-slate-700 whitespace-nowrap">
                        {it.mfgDate || '-'}
                      </td>
                      <td className="border-r border-slate-400 px-1.5 py-1.5 text-center font-mono text-slate-700 whitespace-nowrap">
                        {it.expiryDate || '-'}
                      </td>
                      <td className="border-r border-slate-400 px-1.5 py-1.5 text-right font-mono text-slate-600 whitespace-nowrap">
                        {it.retailPrice || it.unitPrice}
                      </td>
                      <td className="border-r border-slate-400 px-1.5 py-1.5 text-right font-mono font-bold text-slate-800 whitespace-nowrap">
                        {it.unitPrice}
                      </td>
                      <td className="border-r border-slate-400 px-1.5 py-1.5 text-center font-mono font-black text-slate-900 whitespace-nowrap">
                        {it.quantity}
                        {(it.bonusQty || 0) > 0 && (
                          <span className="block text-[9px] font-bold text-emerald-700">
                            +{it.bonusQty} Free
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono font-black text-slate-950 whitespace-nowrap">
                        {formatTkAmount(it.total)}
                      </td>
                    </tr>
                  ))}

                  {Array.from({
                    length: Math.max(0, 6 - invoice.items.length),
                  }).map((_, padIdx) => (
                    <tr
                      key={`pad-${padIdx}`}
                      className="border-b border-slate-400 h-7"
                    >
                      <td className="border-r border-slate-400 text-center font-mono text-slate-400">
                        {String(invoice.items.length + padIdx + 1).padStart(
                          2,
                          '0'
                        )}
                      </td>
                      <td className="border-r border-slate-400"></td>
                      <td className="border-r border-slate-400"></td>
                      <td className="border-r border-slate-400"></td>
                      <td className="border-r border-slate-400"></td>
                      <td className="border-r border-slate-400"></td>
                      <td className="border-r border-slate-400"></td>
                      <td className="border-r border-slate-400"></td>
                      <td className="border-r border-slate-400"></td>
                      <td></td>
                    </tr>
                  ))}

                  {(() => {
                    const subTotal =
                      invoice.subTotal ||
                      invoice.items.reduce((s, it) => s + it.total, 0);
                    const prevDue = invoice.previousDue || 0;
                    const grandTotal = invoice.grandTotal || invoice.totalAmount;
                    const paid = invoice.paidAmount || 0;
                    const totalDue = invoice.dueAmount;
                    const prevDateLabel =
                      invoice.previousDueDate ||
                      formatDDMMYY(invoice.orderDate || invoice.date);
                    const deliveryDateLabel = formatDDMMYY(
                      invoice.deliveryDate || invoice.date
                    );

                    return (
                      <>
                        <tr className="border-b border-slate-400 font-bold">
                          <td
                            colSpan={8}
                            className="border-r border-slate-400 p-1.5 text-right font-bold pr-3"
                          >
                            Amount
                          </td>
                          <td
                            colSpan={2}
                            className="p-1.5 text-right font-mono font-black text-slate-900"
                          >
                            {formatTkAmount(subTotal)}
                          </td>
                        </tr>

                        <tr className="border-b border-slate-400 font-bold">
                          <td
                            colSpan={8}
                            className="border-r border-slate-400 p-1.5 text-right font-bold pr-3"
                          >
                            {prevDateLabel} Previous Due Amount
                          </td>
                          <td
                            colSpan={2}
                            className="p-1.5 text-right font-mono font-black text-slate-900"
                          >
                            {formatTkAmount(prevDue)}
                          </td>
                        </tr>

                        <tr className="border-b border-slate-400 font-bold">
                          <td
                            colSpan={8}
                            className="border-r border-slate-400 p-1.5 text-right font-bold pr-3"
                          >
                            Total Amount
                          </td>
                          <td
                            colSpan={2}
                            className="p-1.5 text-right font-mono font-black text-slate-900"
                          >
                            {formatTkAmount(grandTotal)}
                          </td>
                        </tr>

                        <tr className="border-b border-slate-400 font-bold">
                          <td
                            colSpan={8}
                            className="border-r border-slate-400 p-1.5 text-right font-bold pr-3"
                          >
                            Total Advance payment
                          </td>
                          <td
                            colSpan={2}
                            className="p-1.5 text-right font-mono font-black text-slate-900"
                          >
                            {formatTkAmount(paid)}
                          </td>
                        </tr>

                        <tr className="font-extrabold bg-slate-50">
                          <td
                            colSpan={8}
                            className="border-r border-slate-400 p-2 text-right font-extrabold pr-3"
                          >
                            {deliveryDateLabel} Total Due
                          </td>
                          <td
                            colSpan={2}
                            className="p-2 text-right font-mono font-black text-base text-slate-950"
                          >
                            {formatTkAmount(totalDue)}
                          </td>
                        </tr>
                      </>
                    );
                  })()}
                </tbody>
              </table>
            </div>

            {/* Amount In Words */}
            <div className="border border-slate-300 bg-slate-50 px-3 py-1.5 rounded text-[11px] font-bold text-slate-800 mb-3">
              <span>In Words (Total Amount): </span>
              <span className="text-emerald-800">
                {numberToEnglishWords(invoice.grandTotal || invoice.totalAmount)}
              </span>
            </div>

            {/* Signatures */}
            <div className="flex flex-col sm:flex-row justify-between items-center sm:items-end gap-8 sm:gap-4 pt-10 pb-4 text-xs font-bold text-slate-800">
              <div className="text-center sm:text-left w-full sm:w-auto">
                <div className="h-12 flex items-end justify-center sm:justify-start" />
                <div className="w-44 max-w-full mx-auto sm:mx-0 border-b border-slate-400 mb-1"></div>
                <span className="text-[11px] whitespace-nowrap">
                  Customer / Receiver Signature
                </span>
              </div>

              <div className="text-center sm:text-right w-full sm:w-auto">
                <div
                  onClick={() => canEditSig && setIsSignModalOpen(true)}
                  title={canEditSig ? 'Click to draw or change signature' : undefined}
                  className={`inline-block text-center ${
                    canEditSig ? 'cursor-pointer' : ''
                  }`}
                >
                  <div className="h-12 flex items-end justify-center pb-1">
                    {sigInfo.signatureDataUrl ? (
                      <img
                        src={sigInfo.signatureDataUrl}
                        alt="Authorized Signature"
                        className="h-11 max-w-[170px] object-contain"
                      />
                    ) : (
                      <span className="font-serif italic font-bold text-xl text-indigo-900 tracking-wide px-2">
                        {sigInfo.signerName}
                      </span>
                    )}
                  </div>
                  <div className="w-48 max-w-full mx-auto border-b border-slate-400 mb-1"></div>
                  <div className="font-bold text-[11px]">
                    Authorized Signature
                  </div>
                </div>
              </div>
            </div>
            </div>
          </div>
          </div>
        ) : (
          /* --- BENGALI CASH MEMO STYLE --- */
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-300 p-3 sm:p-6">
          <div
            id="printable-chalan"
            data-print-layout="a4"
            className="bg-[#FCFCFE] text-[#1e1b4b] p-3.5 sm:p-8 border-2 border-[#312e81] rounded-xl shadow-xs relative overflow-hidden font-sans text-xs"
          >
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0">
              {logoUrl ? (
                <img src={logoUrl} alt="" className="w-72 h-72 object-contain opacity-[0.09] rounded-full" />
              ) : (
                <span className="text-[120px] font-black tracking-widest text-[#312e81] opacity-[0.06] rotate-[-20deg]">
                  {brandShortName || 'ERP'}™
                </span>
              )}
            </div>

            <div className="relative z-10">
            <div className="text-center relative pb-3 border-b-2 border-[#312e81]">
              <div className="inline-block px-4 py-0.5 mb-1.5 border border-[#312e81] rounded-full text-[11px] font-extrabold bg-[#e0e7ff] text-[#312e81]">
                ক্যাশ মেমো/চালান বই
              </div>

              <div className="flex items-center justify-between">
                <div className="text-left shrink-0">
                  <CompanyLogo
                    className="w-14 h-14 border-[#312e81]"
                    shortName={brandShortName || 'ERP'}
                    logoUrl={logoUrl}
                  />
                  <span className="text-[9px] font-bold text-[#312e81] block mt-0.5 tracking-wider">
                    {brandShortName || 'ERP'}™
                  </span>
                </div>

                <div className="flex-1 px-2">
                  <h1 className="text-2xl sm:text-3xl font-black text-[#1e1b4b] tracking-tight">
                    {brandName || storeName || 'Stock ERP'}
                  </h1>
                  <p className="text-[9.5px] sm:text-[10px] text-[#3730a3] font-semibold mt-0.5">
                    {address || 'Dhaka, Bangladesh'}
                  </p>
                  <p className="text-[9px] text-[#4338ca] font-medium mt-0.5">
                    Mob: {phone || '+880 1700-000000'}{companyContactSuffix ? ` | ${companyContactSuffix}` : ''}
                  </p>
                </div>

                <div className="w-14 shrink-0 hidden sm:block"></div>
              </div>

              <div className="flex justify-between items-center text-xs pt-2 mt-2 border-t border-[#312e81]/30 font-bold">
                <div>
                  <span>ক্রমিক নং- </span>
                  <span className="font-mono text-sm font-black text-[#1e1b4b] bg-amber-50 px-2 py-0.5 border border-amber-300 rounded">
                    {invoice.chalanNo}
                  </span>
                </div>
                <div>
                  <span>তারিখ: </span>
                  <span className="font-mono text-xs font-bold underline decoration-[#312e81]">
                    {invoice.date.slice(0, 10)} খ্রিঃ
                  </span>
                </div>
              </div>
            </div>

            <div className="my-3 border-2 border-[#312e81] text-xs font-semibold">
              <div className="grid grid-cols-1 sm:grid-cols-12 border-b border-[#312e81]">
                <div className="sm:col-span-2 bg-[#312e81] text-white px-3 py-1.5 font-bold flex items-center">
                  নাম
                </div>
                <div className="sm:col-span-5 px-3 py-1.5 font-extrabold text-sm text-[#1e1b4b] border-r border-[#312e81] flex items-center">
                  {invoice.wholesalerName}
                </div>
                <div className="sm:col-span-2 bg-[#e0e7ff] text-[#312e81] px-2 py-1.5 font-bold flex items-center">
                  মোবাঃ
                </div>
                <div className="sm:col-span-3 px-3 py-1.5 font-mono font-bold text-sm flex items-center">
                  {invoice.customerPhone || customer?.phone || 'N/A'}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12">
                <div className="sm:col-span-2 bg-[#312e81] text-white px-3 py-1.5 font-bold flex items-center">
                  ঠিকানা
                </div>
                <div className="sm:col-span-4 px-3 py-1.5 text-xs text-[#1e1b4b] border-r border-[#312e81] flex items-center">
                  {invoice.customerAddress || customer?.address || 'N/A'}
                </div>
                <div className="sm:col-span-2 bg-[#e0e7ff] text-[#312e81] px-2 py-1.5 font-bold flex items-center text-[11px]">
                  কুরিয়ার
                </div>
                <div className="sm:col-span-4 px-3 py-1.5 text-xs font-bold flex items-center justify-between">
                  <span>{invoice.courierName || 'সুন্দরবন কুরিয়ার'}</span>
                  {invoice.courierTrackingNo && (
                    <span className="font-mono text-[11px] bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded text-indigo-900">
                      ট্র্যাকিং: {invoice.courierTrackingNo}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto my-2">
              <table className="w-full min-w-[600px] border-collapse border-2 border-[#312e81] text-xs">
                <thead>
                  <tr className="bg-[#312e81] text-white text-[11px] font-bold text-center">
                    <th className="border border-[#4338ca] p-2 w-12">ক্রঃ নং</th>
                    <th className="border border-[#4338ca] p-2 text-left">বিবরণ</th>
                    <th className="border border-[#4338ca] p-2 w-24">প্যাক সাইজ</th>
                    <th className="border border-[#4338ca] p-2 w-28">
                      খুচরা বিক্রয় মূল্য
                    </th>
                    <th className="border border-[#4338ca] p-2 w-28">
                      পাইকারী বিক্রয় মূল্য
                    </th>
                    <th className="border border-[#4338ca] p-2 w-20">পরিমাণ</th>
                    <th className="border border-[#4338ca] p-2 w-28">টাকা</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map((it, idx) => (
                    <tr
                      key={idx}
                      className="border-b border-[#312e81]/30 hover:bg-indigo-50/40"
                    >
                      <td className="border-r border-[#312e81] p-2 text-center font-bold text-[#312e81]">
                        {toBengaliDigits(idx + 1)}
                      </td>
                      <td className="border-r border-[#312e81] p-2 font-bold text-[#1e1b4b]">
                        {it.itemName}
                      </td>
                      <td className="border-r border-[#312e81] p-2 text-center font-medium">
                        {it.packSize || '১০০ মি.লি.'}
                      </td>
                      <td className="border-r border-[#312e81] p-2 text-right font-mono font-medium">
                        {toBengaliDigits(
                          (it.retailPrice || it.unitPrice).toLocaleString()
                        )}
                        /-
                      </td>
                      <td className="border-r border-[#312e81] p-2 text-right font-mono font-bold text-[#1e1b4b]">
                        {toBengaliDigits(it.unitPrice.toLocaleString())}/-
                      </td>
                      <td className="border-r border-[#312e81] p-2 text-center font-mono font-black text-sm">
                        {toBengaliDigits(it.quantity)}
                        {(it.bonusQty || 0) > 0 && (
                          <span className="block text-[10px] font-bold text-emerald-700">
                            +{toBengaliDigits(it.bonusQty || 0)} ফ্রি
                          </span>
                        )}
                      </td>
                      <td className="p-2 text-right font-mono font-extrabold text-[#1e1b4b]">
                        {toBengaliDigits(it.total.toLocaleString())}/-
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 pt-3 items-end">
              <div className="sm:col-span-7 space-y-3">
                <div className="border-b-2 border-dotted border-[#312e81] pb-1 text-xs">
                  <span className="font-extrabold text-[#312e81]">কথায় : </span>
                  <span className="font-bold text-[#1e1b4b]">
                    {numberToBengaliWords(
                      invoice.grandTotal || invoice.totalAmount
                    )}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs font-bold">
                  <span className="text-[#312e81]">মোট কার্টুন :</span>
                  <span className="border-b-2 border-dotted border-[#312e81] px-4 py-0.5 font-black text-sm text-[#1e1b4b]">
                    {invoice.totalCartons || '১ টি'}
                  </span>
                </div>

                <div className="pt-8 text-left">
                  <div className="w-36 border-b border-[#312e81] mb-1"></div>
                  <span className="font-extrabold text-[#312e81] text-[11px]">
                    গ্রহীতার স্বাক্ষর
                  </span>
                </div>
              </div>

              <div className="sm:col-span-5">
                <div className="border-2 border-[#312e81] text-xs font-bold">
                  <div className="flex border-b border-[#312e81]">
                    <div className="w-28 bg-[#e0e7ff] p-1.5 text-[#312e81] border-r border-[#312e81]">
                      চলতি বিল-
                    </div>
                    <div className="flex-1 p-1.5 text-right font-mono font-bold">
                      {toBengaliDigits(
                        (
                          invoice.subTotal ||
                          invoice.items.reduce((s, it) => s + it.total, 0)
                        ).toLocaleString()
                      )}
                      /-
                    </div>
                  </div>

                  <div className="flex border-b border-[#312e81] bg-amber-50">
                    <div className="w-28 bg-[#fef3c7] p-1.5 text-amber-900 border-r border-[#312e81]">
                      পূর্বের বকেয়া-
                    </div>
                    <div className="flex-1 p-1.5 text-right font-mono font-black text-amber-900">
                      +{' '}
                      {toBengaliDigits(
                        (invoice.previousDue || 0).toLocaleString()
                      )}
                      /-
                    </div>
                  </div>

                  <div className="flex border-b border-[#312e81] bg-[#e0e7ff]">
                    <div className="w-28 p-1.5 text-[#312e81] border-r border-[#312e81] font-black">
                      মোট-
                    </div>
                    <div className="flex-1 p-1.5 text-right font-mono font-black text-sm text-[#1e1b4b]">
                      {toBengaliDigits(
                        (
                          invoice.grandTotal || invoice.totalAmount
                        ).toLocaleString()
                      )}
                      /-
                    </div>
                  </div>

                  <div className="flex border-b border-[#312e81] bg-emerald-50">
                    <div className="w-28 bg-[#d1fae5] p-1.5 text-emerald-900 border-r border-[#312e81]">
                      অগ্রিম/জমা-
                    </div>
                    <div className="flex-1 p-1.5 text-right font-mono font-black text-emerald-800">
                      {toBengaliDigits(
                        (invoice.paidAmount || 0).toLocaleString()
                      )}
                      /-
                    </div>
                  </div>

                  <div className="flex bg-[#1e1b4b] text-white">
                    <div className="w-28 p-2 text-rose-300 border-r border-indigo-900 font-black">
                      বাকী-
                    </div>
                    <div className="flex-1 p-2 text-right font-mono font-black text-base text-cyan-300">
                      {toBengaliDigits(invoice.dueAmount.toLocaleString())}/-
                    </div>
                  </div>
                </div>

                <div className="pt-6 text-center sm:text-right">
                  <div
                    onClick={() => canEditSig && setIsSignModalOpen(true)}
                    title={canEditSig ? 'স্বাক্ষর পরিবর্তন / আঁকুন' : undefined}
                    className={`inline-block text-center ${
                      canEditSig ? 'cursor-pointer' : ''
                    }`}
                  >
                    <div className="h-12 flex items-end justify-center pb-1">
                      {sigInfo.signatureDataUrl ? (
                        <img
                          src={sigInfo.signatureDataUrl}
                          alt="কর্তৃপক্ষের স্বাক্ষর"
                          className="h-11 max-w-[160px] object-contain"
                        />
                      ) : (
                        <span className="font-serif italic font-bold text-lg text-[#1e1b4b] px-2">
                          {sigInfo.signerName}
                        </span>
                      )}
                    </div>
                    <div className="w-44 border-b border-[#312e81] mb-1"></div>
                    <span className="font-extrabold text-[#312e81] text-[11px] block">
                      কর্তৃপক্ষের স্বাক্ষর
                    </span>
                  </div>
                </div>
              </div>
            </div>
            </div>
          </div>
          </div>
        )}

        {isSignModalOpen && (
          <SignaturePadModal
            title={`Authorized Signature • Chalan #${effectiveInvoice.chalanNo}`}
            initialMode={sigInfo.mode}
            defaultUserName={currentUser?.name || sigInfo.signerName}
            defaultUserId={effectiveInvoice.createdByUserId || currentUser?.userId}
            initialSignerName={sigInfo.signerName}
            initialSignerTitle={sigInfo.signerTitle}
            initialSignatureDataUrl={sigInfo.signatureDataUrl}
            onSave={handleSaveSignature}
            onClose={() => setIsSignModalOpen(false)}
          />
        )}

        {/* Dynamic @media print rules for A4 Portrait vs 80mm Thermal Roll */}
        <style>{`
          @media print {
            @page {
              size: ${paperLayout === 'thermal' ? '80mm auto' : 'A4 portrait'};
              margin: ${paperLayout === 'thermal' ? '3mm' : '10mm'};
            }
            html, body {
              background: #ffffff !important;
              margin: 0 !important;
              padding: 0 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            body * {
              visibility: hidden !important;
            }
            #printable-chalan, #printable-chalan * {
              visibility: visible !important;
            }
            #invoice-modal-backdrop, #invoice-modal-shell {
              position: static !important;
              background: transparent !important;
              padding: 0 !important;
              margin: 0 !important;
              border: none !important;
              box-shadow: none !important;
              overflow: visible !important;
            }
            #printable-chalan[data-print-layout="thermal"] {
              position: fixed !important;
              left: 0 !important;
              top: 0 !important;
              width: 74mm !important;
              max-width: 74mm !important;
              margin: 0 auto !important;
              padding: 2mm !important;
              border: none !important;
              box-shadow: none !important;
            }
            #printable-chalan[data-print-layout="a4"] {
              position: fixed !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              max-width: 100% !important;
              margin: 0 !important;
              padding: 14px !important;
              box-shadow: none !important;
            }
            .no-print {
              display: none !important;
            }
          }
        `}</style>
      </div>
    </div>
  );
};
