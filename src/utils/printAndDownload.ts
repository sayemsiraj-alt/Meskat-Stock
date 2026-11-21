import { Invoice, Wholesaler } from '../data/mockData';
import { formatDDMMYY } from './dateUtils';
import { buildInvoiceWhatsAppText, getWhatsAppUrl } from './erpEnhancements';
import { formatTkAmount, numberToEnglishWords } from './numberToWords';
import { SupplierPurchaseReport } from './purchaseReportUtils';

export interface AuthorizedSignatureResolution {
  mode: 'auto' | 'manual';
  signerName: string;
  signerUserId?: string;
  signerTitle?: string;
  signatureDataUrl?: string;
  hasCustomSignature: boolean;
}

export const resolveAuthorizedSignatureInfo = (
  invoice: Pick<
    Invoice,
    | 'createdByUserId'
    | 'createdByName'
    | 'authorizedSignatureMode'
    | 'authorizedSignerName'
    | 'authorizedSignerTitle'
    | 'authorizedSignatureDataUrl'
  >,
  fallbackBrandName: string,
  fallbackUser?: { userId?: string; name?: string; signatureDataUrl?: string; signatureTitle?: string }
): AuthorizedSignatureResolution => {
  const mode: 'auto' | 'manual' =
    invoice.authorizedSignatureMode === 'manual' || !!invoice.authorizedSignatureDataUrl
      ? 'manual'
      : 'auto';

  const signerName = (
    invoice.authorizedSignerName ||
    invoice.createdByName ||
    fallbackUser?.name ||
    fallbackBrandName ||
    'Authorized Signatory'
  ).trim();

  const signerUserId = invoice.createdByUserId || fallbackUser?.userId;
  const signerTitle = invoice.authorizedSignerTitle || fallbackUser?.signatureTitle;
  const signatureDataUrl =
    invoice.authorizedSignatureMode === 'auto'
      ? undefined
      : invoice.authorizedSignatureDataUrl || fallbackUser?.signatureDataUrl;

  return {
    mode,
    signerName,
    signerUserId,
    signerTitle,
    signatureDataUrl,
    hasCustomSignature: !!signatureDataUrl,
  };
};

const base64ToUint8Array = (base64: string): Uint8Array => {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

export interface PdfPageDimensions {
  widthPt?: number;
  heightPt?: number;
}

/**
 * Pure TypeScript PDF wrapper around JPEG image bytes (no external CDN dependencies).
 * Defaults to A4 (595.28 x 841.89 pt), or accepts custom dimensions (e.g. 80mm thermal roll).
 */
export const buildPdfBytesFromJpeg = (
  jpegBytes: Uint8Array,
  pixelWidth: number,
  pixelHeight: number,
  pageDimensions?: PdfPageDimensions
): Uint8Array => {
  const pageWidthPt = pageDimensions?.widthPt && pageDimensions.widthPt > 0 ? pageDimensions.widthPt : 595.28;
  const pageHeightPt =
    pageDimensions?.heightPt && pageDimensions.heightPt > 0 ? pageDimensions.heightPt : 841.89;
  const encoder = new TextEncoder();

  const chunks: Uint8Array[] = [];
  const offsets: number[] = [0]; // obj 0 free entry
  let currentOffset = 0;

  const pushBytes = (arr: Uint8Array) => {
    chunks.push(arr);
    currentOffset += arr.length;
  };
  const pushText = (str: string) => {
    pushBytes(encoder.encode(str));
  };

  pushText('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n');

  // Obj 1: Catalog
  offsets.push(currentOffset);
  pushText('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  // Obj 2: Pages
  offsets.push(currentOffset);
  pushText('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');

  // Obj 3: Page
  offsets.push(currentOffset);
  pushText(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidthPt.toFixed(2)} ${pageHeightPt.toFixed(2)}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`
  );

  // Obj 4: Image XObject (DCTDecode)
  offsets.push(currentOffset);
  pushText(
    `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${pixelWidth} /Height ${pixelHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`
  );
  pushBytes(jpegBytes);
  pushText('\nendstream\nendobj\n');

  // Obj 5: Content stream fitting image into page dimensions
  const contentStr = `q\n${pageWidthPt.toFixed(2)} 0 0 ${pageHeightPt.toFixed(2)} 0 0 cm\n/Im0 Do\nQ\n`;
  const contentBytes = encoder.encode(contentStr);
  offsets.push(currentOffset);
  pushText(`5 0 obj\n<< /Length ${contentBytes.length} >>\nstream\n`);
  pushBytes(contentBytes);
  pushText('endstream\nendobj\n');

  // Xref table
  const xrefOffset = currentOffset;
  pushText(`xref\n0 ${offsets.length}\n`);
  pushText('0000000000 65535 f \n');
  for (let i = 1; i < offsets.length; i++) {
    pushText(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
  }
  pushText(
    `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`
  );

  const totalLen = chunks.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(totalLen);
  let pos = 0;
  for (const c of chunks) {
    out.set(c, pos);
    pos += c.length;
  }
  return out;
};

const loadImageAsync = (src?: string): Promise<HTMLImageElement | null> => {
  if (!src) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
};

const triggerBlobDownload = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 1500);
};

export const formatCompanyContactSuffix = (
  companyEmail?: string,
  companyWebsite?: string
): string => {
  const cleanEmail = (companyEmail || '').trim();
  const cleanWebsite = (companyWebsite || '').trim();
  if (cleanEmail && cleanWebsite) return `${cleanEmail} / ${cleanWebsite}`;
  return cleanEmail || cleanWebsite || '';
};

export interface InvoicePdfParams {
  invoice: Invoice;
  customer?: Wholesaler | null;
  brandName: string;
  brandShortName: string;
  storeName: string;
  logoUrl?: string;
  address: string;
  phone: string;
  companyEmail?: string;
  companyWebsite?: string;
}

export const generateInvoiceA4PdfBlob = async (
  params: InvoicePdfParams
): Promise<{ blob: Blob; filename: string } | null> => {
  const {
    invoice,
    customer,
    brandName,
    brandShortName,
    storeName,
    logoUrl,
    address,
    phone,
    companyEmail,
    companyWebsite,
  } = params;
  const W = 1190;
  const H = 1684;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // White paper background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  const logoImg = await loadImageAsync(logoUrl);

  // Centered company logo watermark
  ctx.save();
  ctx.globalAlpha = 0.08;
  if (logoImg) {
    const wmSize = 440;
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, wmSize / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(logoImg, W / 2 - wmSize / 2, H / 2 - wmSize / 2, wmSize, wmSize);
  } else {
    ctx.strokeStyle = '#047857';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, 180, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#047857';
    ctx.font = 'bold 72px serif';
    ctx.textAlign = 'center';
    ctx.fillText(brandShortName || 'Dear', W / 2, H / 2 + 24);
  }
  ctx.restore();

  // Outer frame
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 3;
  ctx.strokeRect(42, 42, W - 84, H - 84);

  // Header box
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 2;
  ctx.strokeRect(66, 66, W - 132, 160);

  if (logoImg) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(146, 146, 48, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(logoImg, 98, 98, 96, 96);
    ctx.restore();
  } else {
    ctx.strokeStyle = '#0f766e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(146, 140, 44, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#0f766e';
    ctx.font = 'bold 26px serif';
    ctx.textAlign = 'center';
    ctx.fillText(brandShortName || 'ERP', 146, 148);
  }
  ctx.fillStyle = '#047857';
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(brandShortName || 'ERP', 146, 210);

  // Header vertical divider
  ctx.strokeStyle = '#cbd5e1';
  ctx.beginPath();
  ctx.moveTo(230, 82);
  ctx.lineTo(230, 210);
  ctx.stroke();

  // Brand title & details
  ctx.textAlign = 'left';
  ctx.fillStyle = '#047857';
  ctx.font = 'bold 38px serif';
  ctx.fillText((brandName || storeName || 'STOCK ERP').toUpperCase(), 260, 122);

  ctx.font = 'bold 18px sans-serif';
  ctx.fillStyle = '#dc2626';
  ctx.fillText('Head Office :-', 260, 160);
  ctx.fillStyle = '#0284c7';
  ctx.font = '600 18px sans-serif';
  ctx.fillText(address || 'Dhaka, Bangladesh', 392, 160);

  const contactSuffix = formatCompanyContactSuffix(companyEmail, companyWebsite);
  const contactLine = contactSuffix
    ? `Phone :- ${phone || '+880 1700-000000'}  |  ${contactSuffix}`
    : `Phone :- ${phone || '+880 1700-000000'}`;
  ctx.fillStyle = '#0369a1';
  ctx.font = 'bold 17px sans-serif';
  ctx.fillText(contactLine, 260, 192);

  // Meta Info (placed directly below Header box without "Invoice" title)
  ctx.textAlign = 'left';
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 19px sans-serif';
  ctx.fillText(`Invoice No :- ${invoice.chalanNo}`, 66, 280);
  ctx.fillText(`Order date:- ${formatDDMMYY(invoice.orderDate || invoice.date)}`, 440, 280);
  ctx.textAlign = 'right';
  ctx.fillText(`Delivery date:- ${formatDDMMYY(invoice.deliveryDate || invoice.date)}`, W - 66, 280);

  ctx.textAlign = 'left';
  ctx.fillText(`Customer Name :- ${invoice.wholesalerName}`, 66, 318);
  ctx.textAlign = 'right';
  ctx.fillText(`Mobile Number :- ${invoice.customerPhone || customer?.phone || 'N/A'}`, W - 66, 318);

  ctx.textAlign = 'left';
  ctx.font = '600 18px sans-serif';
  ctx.fillText(`Customer Address :- ${invoice.customerAddress || customer?.address || 'N/A'}`, 66, 354);

  if (invoice.courierName || invoice.courierTrackingNo || invoice.totalCartons) {
    ctx.fillStyle = '#334155';
    ctx.font = '600 16px sans-serif';
    const courierLine = [
      `Courier: ${invoice.courierName || 'Standard Courier'}`,
      invoice.courierTrackingNo ? `Tracking: ${invoice.courierTrackingNo}` : '',
      invoice.totalCartons ? `Cartons: ${invoice.totalCartons}` : '',
    ]
      .filter(Boolean)
      .join('   |   ');
    ctx.fillText(courierLine, 66, 386);
  }

  // Table
  let y = 414;
  const cols = [
    { label: 'No', w: 54, align: 'center' as const },
    { label: 'Product Name', w: 276, align: 'left' as const },
    { label: 'Size', w: 86, align: 'center' as const },
    { label: 'Batch', w: 94, align: 'center' as const },
    { label: 'Exp Date', w: 112, align: 'center' as const },
    { label: 'MRP', w: 84, align: 'right' as const },
    { label: 'Rate', w: 94, align: 'right' as const },
    { label: 'Qty', w: 108, align: 'center' as const },
    { label: 'Amount Tk', w: 150, align: 'right' as const },
  ];
  const tableX = 66;
  const tableW = cols.reduce((s, c) => s + c.w, 0);
  const rowH = 42;

  // Table header
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(tableX, y, tableW, rowH);
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(tableX, y, tableW, rowH);

  let cx = tableX;
  ctx.fillStyle = '#1e293b';
  ctx.font = 'bold 16px sans-serif';
  cols.forEach((col, i) => {
    if (i > 0) {
      ctx.beginPath();
      ctx.moveTo(cx, y);
      ctx.lineTo(cx, y + rowH);
      ctx.stroke();
    }
    ctx.textAlign = col.align;
    const tx =
      col.align === 'center' ? cx + col.w / 2 : col.align === 'right' ? cx + col.w - 10 : cx + 10;
    ctx.fillText(col.label, tx, y + 27);
    cx += col.w;
  });
  y += rowH;

  const displayRows = Math.max(6, invoice.items.length);
  for (let r = 0; r < Math.min(displayRows, 14); r++) {
    const it = invoice.items[r];
    ctx.strokeStyle = '#94a3b8';
    ctx.strokeRect(tableX, y, tableW, rowH);
    cx = tableX;
    cols.forEach((col, i) => {
      if (i > 0) {
        ctx.beginPath();
        ctx.moveTo(cx, y);
        ctx.lineTo(cx, y + rowH);
        ctx.stroke();
      }
      if (it) {
        let val = '';
        if (i === 0) val = String(r + 1).padStart(2, '0');
        else if (i === 1) val = it.itemName.slice(0, 28);
        else if (i === 2) val = it.packSize || '-';
        else if (i === 3) val = it.batchNo || '-';
        else if (i === 4) val = it.expiryDate || '-';
        else if (i === 5) val = String(it.retailPrice || it.unitPrice);
        else if (i === 6) val = String(it.unitPrice);
        else if (i === 7)
          val = (it.bonusQty || 0) > 0 ? `${it.quantity} (+${it.bonusQty} Free)` : String(it.quantity);
        else if (i === 8) val = formatTkAmount(it.total);

        ctx.fillStyle = '#0f172a';
        ctx.font = i === 1 || i === 8 ? 'bold 16px sans-serif' : '16px sans-serif';
        ctx.textAlign = col.align;
        const tx =
          col.align === 'center' ? cx + col.w / 2 : col.align === 'right' ? cx + col.w - 10 : cx + 10;
        ctx.fillText(val, tx, y + 27);
      } else if (i === 0) {
        ctx.fillStyle = '#94a3b8';
        ctx.font = '15px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(String(r + 1).padStart(2, '0'), cx + col.w / 2, y + 27);
      }
      cx += col.w;
    });
    y += rowH;
  }

  // Totals rows
  const subTotal = invoice.subTotal || invoice.items.reduce((s, it) => s + it.total, 0);
  const prevDue = invoice.previousDue || 0;
  const grandTotal = invoice.grandTotal || invoice.totalAmount;
  const paid = invoice.paidAmount || 0;
  const totalDue = invoice.dueAmount;
  const prevDateLabel = invoice.previousDueDate || formatDDMMYY(invoice.orderDate || invoice.date);
  const deliveryDateLabel = formatDDMMYY(invoice.deliveryDate || invoice.date);

  const summaryRows = [
    { label: 'Amount', val: formatTkAmount(subTotal), bold: false },
    { label: `${prevDateLabel} Previous Due Amount`, val: formatTkAmount(prevDue), bold: false },
    { label: 'Total Amount', val: formatTkAmount(grandTotal), bold: true },
    { label: 'Total Advance payment', val: formatTkAmount(paid), bold: false },
    { label: `${deliveryDateLabel} Total Due`, val: formatTkAmount(totalDue), bold: true },
  ];

  const labelColW = tableW - 234;
  summaryRows.forEach((sr) => {
    ctx.fillStyle = sr.bold ? '#f1f5f9' : '#ffffff';
    ctx.fillRect(tableX, y, tableW, 38);
    ctx.strokeStyle = '#64748b';
    ctx.strokeRect(tableX, y, tableW, 38);
    ctx.beginPath();
    ctx.moveTo(tableX + labelColW, y);
    ctx.lineTo(tableX + labelColW, y + 38);
    ctx.stroke();

    ctx.fillStyle = '#0f172a';
    ctx.font = sr.bold ? 'bold 18px sans-serif' : 'bold 16px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(sr.label, tableX + labelColW - 14, y + 25);
    ctx.font = sr.bold ? 'bold 20px monospace' : 'bold 17px monospace';
    ctx.fillText(sr.val, tableX + tableW - 12, y + 25);
    y += 38;
  });

  // Amount in words
  y += 18;
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(tableX, y, tableW, 42);
  ctx.strokeStyle = '#cbd5e1';
  ctx.strokeRect(tableX, y, tableW, 42);
  ctx.fillStyle = '#065f46';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(
    `In Words (Total Amount): ${numberToEnglishWords(grandTotal)}`,
    tableX + 14,
    y + 27
  );
  y += 60;

  // Signatures section anchored near bottom (without Payment/Dispatch split box)
  const sigY = Math.max(y + 70, H - 200);
  const sigInfo = resolveAuthorizedSignatureInfo(invoice, brandName || storeName);

  // Customer signature line (left)
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(80, sigY + 55);
  ctx.lineTo(350, sigY + 55);
  ctx.stroke();
  ctx.fillStyle = '#1e293b';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Customer / Receiver Signature', 215, sigY + 80);

  // Authorized signature (right)
  const rightCenter = W - 220;
  if (sigInfo.signatureDataUrl) {
    const sigImg = await loadImageAsync(sigInfo.signatureDataUrl);
    if (sigImg) {
      ctx.drawImage(sigImg, rightCenter - 110, sigY - 20, 220, 70);
    }
  } else {
    // Stylized auto-generated signature from user's name
    ctx.fillStyle = '#1e3a8a';
    ctx.font = 'italic bold 28px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(sigInfo.signerName, rightCenter, sigY + 42);
  }

  ctx.strokeStyle = '#475569';
  ctx.beginPath();
  ctx.moveTo(rightCenter - 140, sigY + 55);
  ctx.lineTo(rightCenter + 140, sigY + 55);
  ctx.stroke();

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Authorized Signature', rightCenter, sigY + 80);

  const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.92);
  const b64 = jpegDataUrl.split(',')[1];
  if (!b64) return null;
  const pdfBytes = buildPdfBytesFromJpeg(base64ToUint8Array(b64), W, H);
  const pdfBuffer = pdfBytes.buffer.slice(
    pdfBytes.byteOffset,
    pdfBytes.byteOffset + pdfBytes.byteLength
  ) as ArrayBuffer;
  const pdfBlob = new Blob([pdfBuffer], { type: 'application/pdf' });
  return { blob: pdfBlob, filename: `Invoice_${invoice.chalanNo}.pdf` };
};

export const downloadInvoiceA4Pdf = async (params: InvoicePdfParams): Promise<boolean> => {
  const result = await generateInvoiceA4PdfBlob(params);
  if (!result) return false;
  triggerBlobDownload(result.blob, result.filename);
  return true;
};

export const generateInvoiceThermalPdfBlob = async (params: {
  invoice: Invoice;
  customer?: Wholesaler | null;
  brandName: string;
  brandShortName: string;
  storeName: string;
  address: string;
  phone: string;
  companyEmail?: string;
  companyWebsite?: string;
}): Promise<{ blob: Blob; filename: string } | null> => {
  const { invoice, customer, brandName, storeName, address, phone, companyEmail, companyWebsite } = params;
  const contactSuffix = formatCompanyContactSuffix(companyEmail, companyWebsite);
  const W = 576; // 80mm thermal paper width (~226.77 pt)
  const itemRows = Math.max(1, invoice.items.length);
  const H = Math.max(920, 620 + itemRows * 52 + 280 + (contactSuffix ? 20 : 0));

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  const pad = 28;
  let y = 44;

  const drawDashedLine = (yPos: number) => {
    ctx.save();
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.moveTo(pad, yPos);
    ctx.lineTo(W - pad, yPos);
    ctx.stroke();
    ctx.restore();
  };

  // Header
  ctx.textAlign = 'center';
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText((brandName || storeName || 'STOCK ERP').toUpperCase(), W / 2, y);
  y += 26;

  if (storeName && storeName !== brandName) {
    ctx.font = 'bold 16px sans-serif';
    ctx.fillStyle = '#334155';
    ctx.fillText(storeName, W / 2, y);
    y += 22;
  }

  ctx.font = '14px sans-serif';
  ctx.fillStyle = '#475569';
  ctx.fillText((address || 'Dhaka, Bangladesh').slice(0, 48), W / 2, y);
  y += 20;
  ctx.fillText(`Tel: ${phone || '+880 1700-000000'}`, W / 2, y);
  if (contactSuffix) {
    y += 18;
    ctx.fillStyle = '#0369a1';
    ctx.fillText(contactSuffix.slice(0, 52), W / 2, y);
  }
  y += 26;

  // Title + status
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 18px monospace';
  ctx.fillText(`SALES INVOICE [${invoice.status.toUpperCase()}]`, W / 2, y);
  y += 16;
  drawDashedLine(y);
  y += 26;

  // Meta rows
  const drawMeta = (label: string, value: string) => {
    ctx.textAlign = 'left';
    ctx.fillStyle = '#475569';
    ctx.font = 'bold 15px monospace';
    ctx.fillText(label, pad, y);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 15px monospace';
    ctx.fillText(value.slice(0, 28), W - pad, y);
    y += 24;
  };

  drawMeta('Invoice No:', `#${invoice.chalanNo}`);
  drawMeta('Order Date:', formatDDMMYY(invoice.orderDate || invoice.date));
  drawMeta('Delivery Date:', formatDDMMYY(invoice.deliveryDate || invoice.date));
  drawMeta('Customer:', invoice.wholesalerName);
  drawMeta('Phone:', invoice.customerPhone || customer?.phone || 'N/A');
  if (invoice.courierName) {
    drawMeta('Courier:', invoice.courierName);
  }
  if (invoice.courierTrackingNo) {
    drawMeta('Tracking:', invoice.courierTrackingNo);
  }
  y += 4;
  drawDashedLine(y);
  y += 24;

  // Items header
  ctx.textAlign = 'left';
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 14px monospace';
  ctx.fillText('ITEM / QTY x RATE', pad, y);
  ctx.textAlign = 'right';
  ctx.fillText('AMOUNT', W - pad, y);
  y += 12;
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, y);
  ctx.lineTo(W - pad, y);
  ctx.stroke();
  y += 22;

  // Item lines
  invoice.items.forEach((it, idx) => {
    ctx.textAlign = 'left';
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 15px sans-serif';
    const itemTitle = `${idx + 1}. ${it.itemName}${it.packSize ? ` (${it.packSize})` : ''}`;
    ctx.fillText(itemTitle.slice(0, 38), pad, y);
    y += 20;

    ctx.fillStyle = '#475569';
    ctx.font = '14px monospace';
    const qtyText =
      (it.bonusQty || 0) > 0
        ? `   ${it.quantity} (+${it.bonusQty} Free) x ${it.unitPrice}/=`
        : `   ${it.quantity} x ${it.unitPrice}/=`;
    ctx.fillText(qtyText, pad, y);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 15px monospace';
    ctx.fillText(formatTkAmount(it.total), W - pad, y);
    y += 26;
  });

  drawDashedLine(y);
  y += 26;

  // Financial Totals
  const subTotal = invoice.subTotal || invoice.items.reduce((s, it) => s + it.total, 0);
  const prevDue = invoice.previousDue || 0;
  const grandTotal = invoice.grandTotal || invoice.totalAmount;
  const paid = invoice.paidAmount || 0;
  const totalDue = invoice.dueAmount;

  drawMeta('Subtotal Amount:', formatTkAmount(subTotal));
  if (prevDue > 0) {
    drawMeta('Previous Due:', `+ ${formatTkAmount(prevDue)}`);
  }
  drawMeta('Total Payable:', formatTkAmount(grandTotal));
  drawMeta('Advance / Paid:', formatTkAmount(paid));

  y += 4;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(pad, y - 18, W - pad * 2, 34);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px monospace';
  ctx.fillText('NET DUE BALANCE:', pad + 10, y + 4);
  ctx.textAlign = 'right';
  ctx.fillText(formatTkAmount(totalDue), W - pad - 10, y + 4);
  y += 34;

  // Amount in words
  ctx.textAlign = 'left';
  ctx.fillStyle = '#334155';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText(`In Words: ${numberToEnglishWords(grandTotal)}`.slice(0, 62), pad, y);
  y += 22;

  drawDashedLine(y);
  y += 30;

  // Authorized Signature
  const sigInfo = resolveAuthorizedSignatureInfo(invoice, brandName || storeName);
  if (sigInfo.signatureDataUrl) {
    const sigImg = await loadImageAsync(sigInfo.signatureDataUrl);
    if (sigImg) {
      ctx.drawImage(sigImg, W / 2 - 80, y - 12, 160, 48);
    }
    y += 44;
  } else {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#0f172a';
    ctx.font = 'italic bold 22px Georgia, serif';
    ctx.fillText(sigInfo.signerName, W / 2, y + 12);
    y += 28;
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText('------------------------------------', W / 2, y);
  y += 16;
  ctx.fillText('Authorized Signature', W / 2, y);
  y += 26;

  drawDashedLine(y);
  y += 24;
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText('Thank you for your business!', W / 2, y);
  y += 18;
  ctx.fillStyle = '#64748b';
  ctx.font = '12px monospace';
  ctx.fillText(`80mm Thermal Copy • #${invoice.chalanNo}`, W / 2, y);

  const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.92);
  const b64 = jpegDataUrl.split(',')[1];
  if (!b64) return null;

  const widthPt = 226.77; // 80mm in PostScript points
  const heightPt = Number(((H / W) * widthPt).toFixed(2));
  const pdfBytes = buildPdfBytesFromJpeg(base64ToUint8Array(b64), W, H, {
    widthPt,
    heightPt,
  });
  const pdfBuffer = pdfBytes.buffer.slice(
    pdfBytes.byteOffset,
    pdfBytes.byteOffset + pdfBytes.byteLength
  ) as ArrayBuffer;
  const pdfBlob = new Blob([pdfBuffer], { type: 'application/pdf' });
  return { blob: pdfBlob, filename: `Invoice_${invoice.chalanNo}_Thermal80mm.pdf` };
};

export const downloadInvoiceThermalPdf = async (params: {
  invoice: Invoice;
  customer?: Wholesaler | null;
  brandName: string;
  brandShortName: string;
  storeName: string;
  address: string;
  phone: string;
  companyEmail?: string;
  companyWebsite?: string;
}): Promise<boolean> => {
  const result = await generateInvoiceThermalPdfBlob(params);
  if (!result) return false;
  triggerBlobDownload(result.blob, result.filename);
  return true;
};

const openExternalLink = (url: string) => {
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => a.remove(), 800);
};

export type WhatsAppPdfShareOutcome =
  | { status: 'shared'; filename: string }
  | { status: 'downloaded-and-opened'; filename: string; hasPhone: boolean }
  | { status: 'cancelled' }
  | { status: 'error' };

export const sendInvoicePdfToWhatsApp = async (
  params: InvoicePdfParams & { paperLayout?: 'a4' | 'thermal' }
): Promise<WhatsAppPdfShareOutcome> => {
  const { invoice, customer, brandName, storeName, paperLayout = 'a4' } = params;
  const pdfResult =
    paperLayout === 'thermal'
      ? await generateInvoiceThermalPdfBlob(params)
      : await generateInvoiceA4PdfBlob(params);
  if (!pdfResult) return { status: 'error' };

  const messageText = buildInvoiceWhatsAppText(
    invoice,
    brandName || storeName || 'STOCK ERP'
  );
  const targetPhone = invoice.customerPhone || customer?.phone;
  const whatsappUrl = getWhatsAppUrl(targetPhone, messageText);

  const isMobileBrowser =
    typeof navigator !== 'undefined' &&
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');

  // On mobile devices with Web Share Level 2 file sharing, attach the PDF File directly into WhatsApp/Share sheet
  if (
    isMobileBrowser &&
    typeof File !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function'
  ) {
    try {
      const pdfFile = new File([pdfResult.blob], pdfResult.filename, {
        type: 'application/pdf',
      });
      if (navigator.canShare({ files: [pdfFile] })) {
        await navigator.share({
          files: [pdfFile],
          title: `Invoice #${invoice.chalanNo}`,
          text: messageText,
        });
        return { status: 'shared', filename: pdfResult.filename };
      }
    } catch (err) {
      if ((err as { name?: string })?.name === 'AbortError') {
        return { status: 'cancelled' };
      }
      // Fall through to universal download + WhatsApp chat flow
    }
  }

  // Universal 1-click flow: download updated PDF file immediately + copy summary + open customer's exact WhatsApp chat
  triggerBlobDownload(pdfResult.blob, pdfResult.filename);
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(messageText).catch(() => {});
  }
  openExternalLink(whatsappUrl);
  return {
    status: 'downloaded-and-opened',
    filename: pdfResult.filename,
    hasPhone: Boolean(targetPhone?.trim()),
  };
};

export const downloadPaymentReceiptPdf = (params: {
  brandTitle: string;
  address: string;
  phone: string;
  buyerName: string;
  receiptNo: string;
  amount: number;
  method: string;
  date: string;
  remainingDue: number;
  receivedByName?: string;
}): boolean => {
  const W = 1190;
  const H = 1684;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#0f766e';
  ctx.lineWidth = 4;
  ctx.strokeRect(70, 70, W - 140, 820);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#047857';
  ctx.font = 'bold 38px serif';
  ctx.fillText(params.brandTitle.toUpperCase(), W / 2, 150);
  ctx.fillStyle = '#475569';
  ctx.font = '18px sans-serif';
  ctx.fillText(`${params.address} • ${params.phone}`, W / 2, 190);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 28px sans-serif';
  ctx.fillText('OFFICIAL PAYMENT RECEIPT', W / 2, 260);

  const rows: [string, string][] = [
    ['Receipt No:', params.receiptNo],
    ['Date:', params.date],
    ['Received From:', params.buyerName],
    ['Payment Method:', params.method],
    ['Amount Received:', formatTkAmount(params.amount)],
    ['Remaining Due:', formatTkAmount(params.remainingDue)],
  ];

  let ry = 330;
  rows.forEach(([k, v]) => {
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.strokeRect(120, ry, W - 240, 62);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#475569';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(k, 145, ry + 38);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 22px monospace';
    ctx.fillText(v, W - 145, ry + 38);
    ry += 62;
  });

  const sigY = 780;
  ctx.fillStyle = '#1e3a8a';
  ctx.font = 'italic bold 26px Georgia, serif';
  ctx.textAlign = 'right';
  ctx.fillText(params.receivedByName || params.brandTitle, W - 140, sigY);
  ctx.strokeStyle = '#475569';
  ctx.beginPath();
  ctx.moveTo(W - 380, sigY + 14);
  ctx.lineTo(W - 120, sigY + 14);
  ctx.stroke();
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('Authorized Signature', W - 165, sigY + 40);

  const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.92);
  const b64 = jpegDataUrl.split(',')[1];
  if (!b64) return false;
  const pdfBytes = buildPdfBytesFromJpeg(base64ToUint8Array(b64), W, H);
  const pdfBuffer = pdfBytes.buffer.slice(
    pdfBytes.byteOffset,
    pdfBytes.byteOffset + pdfBytes.byteLength
  ) as ArrayBuffer;
  const pdfBlob = new Blob([pdfBuffer], { type: 'application/pdf' });
  triggerBlobDownload(pdfBlob, `Receipt_${params.receiptNo}.pdf`);
  return true;
};

export const downloadPosReceiptPdf = async (params: {
  invoice: Invoice;
  brandName: string;
  storeName: string;
  address: string;
  phone: string;
  changeReturned?: number;
}): Promise<boolean> => {
  const W = 1190;
  const H = 1684;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;

  const { invoice, brandName, storeName, address, phone, changeReturned = 0 } = params;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 3;
  ctx.strokeRect(140, 70, W - 280, H - 180);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 38px sans-serif';
  ctx.fillText((brandName || storeName || 'STOCK ERP').toUpperCase(), W / 2, 145);
  ctx.font = 'bold 20px sans-serif';
  ctx.fillStyle = '#334155';
  ctx.fillText(storeName, W / 2, 182);
  ctx.font = '17px sans-serif';
  ctx.fillStyle = '#64748b';
  ctx.fillText(`${address} | Tel: ${phone}`, W / 2, 214);

  ctx.fillStyle = '#047857';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText('RETAIL POS CASH RECEIPT', W / 2, 270);

  let y = 325;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 18px monospace';
  ctx.fillText(`Receipt No: ${invoice.chalanNo}`, 180, y);
  y += 32;
  ctx.fillText(`Date: ${invoice.date.replace('T', ' ').slice(0, 19)}`, 180, y);
  y += 32;
  ctx.fillText(`Customer: ${invoice.wholesalerName}`, 180, y);
  if (invoice.customerPhone && invoice.customerPhone !== 'N/A') {
    y += 32;
    ctx.fillText(`Phone: ${invoice.customerPhone}`, 180, y);
  }
  y += 34;

  // Table header
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(180, y, W - 360, 40);
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1;
  ctx.strokeRect(180, y, W - 360, 40);
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 17px sans-serif';
  ctx.fillText('Item', 200, y + 26);
  ctx.textAlign = 'right';
  ctx.fillText('Qty x Rate = Amount', W - 200, y + 26);
  y += 42;

  ctx.font = '17px sans-serif';
  invoice.items.slice(0, 18).forEach((it) => {
    ctx.textAlign = 'left';
    ctx.fillStyle = '#0f172a';
    ctx.fillText(it.itemName.slice(0, 40), 200, y + 28);
    ctx.textAlign = 'right';
    ctx.font = 'bold 17px monospace';
    const posQtyStr =
      (it.bonusQty || 0) > 0
        ? `${it.quantity}(+${it.bonusQty}F) x ${it.unitPrice} = ${formatTkAmount(it.total)}`
        : `${it.quantity} x ${it.unitPrice} = ${formatTkAmount(it.total)}`;
    ctx.fillText(posQtyStr, W - 200, y + 28);
    ctx.font = '17px sans-serif';
    y += 36;
  });

  y += 20;
  ctx.strokeStyle = '#cbd5e1';
  ctx.beginPath();
  ctx.moveTo(180, y);
  ctx.lineTo(W - 180, y);
  ctx.stroke();
  y += 36;

  ctx.textAlign = 'left';
  ctx.font = 'bold 19px monospace';
  ctx.fillText('Subtotal:', 180, y);
  ctx.textAlign = 'right';
  ctx.fillText(formatTkAmount(invoice.subTotal || invoice.totalAmount), W - 180, y);
  y += 34;

  if ((invoice.discount || 0) > 0) {
    ctx.textAlign = 'left';
    ctx.fillStyle = '#047857';
    ctx.fillText('Discount:', 180, y);
    ctx.textAlign = 'right';
    ctx.fillText(`-${formatTkAmount(invoice.discount || 0)}`, W - 180, y);
    y += 34;
  }

  ctx.textAlign = 'left';
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 24px monospace';
  ctx.fillText(`Net Paid (${invoice.paymentMethod}):`, 180, y);
  ctx.textAlign = 'right';
  ctx.fillText(formatTkAmount(invoice.totalAmount), W - 180, y);
  y += 34;

  if (changeReturned > 0) {
    ctx.textAlign = 'left';
    ctx.font = '17px monospace';
    ctx.fillStyle = '#475569';
    ctx.fillText('Change Returned:', 180, y);
    ctx.textAlign = 'right';
    ctx.fillText(formatTkAmount(changeReturned), W - 180, y);
    y += 34;
  }

  // Authorized Signature at bottom
  const sigInfo = resolveAuthorizedSignatureInfo(invoice, brandName || storeName);
  const sigY = Math.max(y + 90, H - 290);
  const sigX = W - 320;
  if (sigInfo.signatureDataUrl) {
    const img = await loadImageAsync(sigInfo.signatureDataUrl);
    if (img) ctx.drawImage(img, sigX - 100, sigY - 55, 200, 62);
  } else {
    ctx.fillStyle = '#1e3a8a';
    ctx.font = 'italic bold 26px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(sigInfo.signerName, sigX, sigY);
  }
  ctx.strokeStyle = '#475569';
  ctx.beginPath();
  ctx.moveTo(sigX - 120, sigY + 14);
  ctx.lineTo(sigX + 120, sigY + 14);
  ctx.stroke();
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Authorized Signature', sigX, sigY + 38);

  const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.92);
  const b64 = jpegDataUrl.split(',')[1];
  if (!b64) return false;
  const pdfBytes = buildPdfBytesFromJpeg(base64ToUint8Array(b64), W, H);
  const pdfBuffer = pdfBytes.buffer.slice(
    pdfBytes.byteOffset,
    pdfBytes.byteOffset + pdfBytes.byteLength
  ) as ArrayBuffer;
  const pdfBlob = new Blob([pdfBuffer], { type: 'application/pdf' });
  triggerBlobDownload(pdfBlob, `POS_Receipt_${invoice.chalanNo}.pdf`);
  return true;
};

export const downloadCustomerStatementPdf = (params: {
  brandTitle: string;
  buyerName: string;
  buyerPhone: string;
  buyerAddress: string;
  entries: { date: string; reference: string; description: string; debit: number; credit: number; runningBalance: number }[];
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
}): boolean => {
  const W = 1190;
  const H = 1684;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#047857';
  ctx.font = 'bold 34px serif';
  ctx.textAlign = 'left';
  ctx.fillText(params.brandTitle.toUpperCase(), 70, 95);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText(`ACCOUNT STATEMENT — ${params.buyerName}`, 70, 140);
  ctx.font = '16px sans-serif';
  ctx.fillStyle = '#475569';
  ctx.fillText(`Phone: ${params.buyerPhone || 'N/A'} • ${params.buyerAddress || 'N/A'}`, 70, 170);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('Closing Balance Due', W - 70, 130);
  ctx.fillStyle = params.closingBalance > 0 ? '#be123c' : '#047857';
  ctx.font = 'bold 28px monospace';
  ctx.fillText(formatTkAmount(params.closingBalance), W - 70, 166);

  let y = 215;
  const cols = [
    { label: 'Date', w: 120 },
    { label: 'Reference', w: 170 },
    { label: 'Particulars', w: 340 },
    { label: 'Debit', w: 140 },
    { label: 'Credit', w: 140 },
    { label: 'Balance', w: 140 },
  ];

  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(70, y, W - 140, 42);
  ctx.strokeStyle = '#64748b';
  ctx.strokeRect(70, y, W - 140, 42);
  let cx = 70;
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 15px sans-serif';
  cols.forEach((c, idx) => {
    ctx.textAlign = idx >= 3 ? 'right' : 'left';
    ctx.fillText(c.label, idx >= 3 ? cx + c.w - 10 : cx + 10, y + 27);
    cx += c.w;
  });
  y += 42;

  params.entries.slice(0, 28).forEach((e) => {
    ctx.strokeStyle = '#cbd5e1';
    ctx.strokeRect(70, y, W - 140, 38);
    let x = 70;
    const vals = [
      formatDDMMYY(e.date),
      e.reference.slice(0, 16),
      e.description.slice(0, 34),
      e.debit > 0 ? formatTkAmount(e.debit) : '-',
      e.credit > 0 ? formatTkAmount(e.credit) : '-',
      formatTkAmount(e.runningBalance),
    ];
    cols.forEach((c, idx) => {
      ctx.fillStyle = idx === 4 ? '#047857' : '#0f172a';
      ctx.font = idx === 5 ? 'bold 15px monospace' : '14px sans-serif';
      ctx.textAlign = idx >= 3 ? 'right' : 'left';
      ctx.fillText(vals[idx], idx >= 3 ? x + c.w - 10 : x + 10, y + 25);
      x += c.w;
    });
    y += 38;
  });

  y += 20;
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(70, y, W - 140, 46);
  ctx.strokeStyle = '#475569';
  ctx.strokeRect(70, y, W - 140, 46);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText(
    `Totals — Billed: ${formatTkAmount(params.totalDebit)} | Paid/Returned: ${formatTkAmount(params.totalCredit)} | Closing Due: ${formatTkAmount(params.closingBalance)}`,
    90,
    y + 29
  );

  const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.92);
  const b64 = jpegDataUrl.split(',')[1];
  if (!b64) return false;
  const pdfBytes = buildPdfBytesFromJpeg(base64ToUint8Array(b64), W, H);
  const pdfBuffer = pdfBytes.buffer.slice(
    pdfBytes.byteOffset,
    pdfBytes.byteOffset + pdfBytes.byteLength
  ) as ArrayBuffer;
  const pdfBlob = new Blob([pdfBuffer], { type: 'application/pdf' });
  triggerBlobDownload(pdfBlob, `Statement_${params.buyerName.replace(/\s+/g, '_')}.pdf`);
  return true;
};

export interface PdfJpegPageInput {
  jpegBytes: Uint8Array;
  pixelWidth: number;
  pixelHeight: number;
  pageDimensions?: PdfPageDimensions;
}

/**
 * Pure TypeScript multi-page PDF builder from JPEG pages (A4 portrait default).
 */
export const buildMultiPagePdfBytesFromJpegs = (pages: PdfJpegPageInput[]): Uint8Array => {
  if (pages.length === 0) return new Uint8Array(0);
  if (pages.length === 1) {
    return buildPdfBytesFromJpeg(
      pages[0].jpegBytes,
      pages[0].pixelWidth,
      pages[0].pixelHeight,
      pages[0].pageDimensions
    );
  }

  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [0];
  let currentOffset = 0;

  const pushBytes = (arr: Uint8Array) => {
    chunks.push(arr);
    currentOffset += arr.length;
  };
  const pushText = (str: string) => {
    pushBytes(encoder.encode(str));
  };

  pushText('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n');

  // Obj 1: Catalog, Obj 2: Pages
  offsets.push(currentOffset);
  pushText('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  const pageObjIds = pages.map((_, idx) => 3 + idx * 3);
  offsets.push(currentOffset);
  pushText(
    `2 0 obj\n<< /Type /Pages /Kids [${pageObjIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>\nendobj\n`
  );

  pages.forEach((p, idx) => {
    const pageId = 3 + idx * 3;
    const imgId = pageId + 1;
    const contentId = pageId + 2;
    const pageWidthPt =
      p.pageDimensions?.widthPt && p.pageDimensions.widthPt > 0 ? p.pageDimensions.widthPt : 595.28;
    const pageHeightPt =
      p.pageDimensions?.heightPt && p.pageDimensions.heightPt > 0 ? p.pageDimensions.heightPt : 841.89;

    offsets.push(currentOffset);
    pushText(
      `${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidthPt.toFixed(2)} ${pageHeightPt.toFixed(2)}] /Resources << /XObject << /Im${idx} ${imgId} 0 R >> >> /Contents ${contentId} 0 R >>\nendobj\n`
    );

    offsets.push(currentOffset);
    pushText(
      `${imgId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${p.pixelWidth} /Height ${p.pixelHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpegBytes.length} >>\nstream\n`
    );
    pushBytes(p.jpegBytes);
    pushText('\nendstream\nendobj\n');

    const contentStr = `q\n${pageWidthPt.toFixed(2)} 0 0 ${pageHeightPt.toFixed(2)} 0 0 cm\n/Im${idx} Do\nQ\n`;
    const contentBytes = encoder.encode(contentStr);
    offsets.push(currentOffset);
    pushText(`${contentId} 0 obj\n<< /Length ${contentBytes.length} >>\nstream\n`);
    pushBytes(contentBytes);
    pushText('endstream\nendobj\n');
  });

  const xrefOffset = currentOffset;
  pushText(`xref\n0 ${offsets.length}\n`);
  pushText('0000000000 65535 f \n');
  for (let i = 1; i < offsets.length; i++) {
    pushText(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
  }
  pushText(
    `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`
  );

  const totalLen = chunks.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(totalLen);
  let pos = 0;
  for (const c of chunks) {
    out.set(c, pos);
    pos += c.length;
  }
  return out;
};

export interface SupplierPurchasePdfParams {
  report: SupplierPurchaseReport;
  brandName: string;
  storeName: string;
  startDate: string;
  endDate: string;
  supplierFilter: string;
  categoryFilter: string;
}

/**
 * Generates and downloads a multi-page A4 PDF summarizing Supplier-wise, Category-wise,
 * and Product-wise Stock IN / Purchase quantities & amounts.
 */
export const downloadSupplierPurchaseReportPdf = (
  params: SupplierPurchasePdfParams
): boolean => {
  const { report, brandName, storeName, startDate, endDate, supplierFilter, categoryFilter } =
    params;
  const W = 1240;
  const H = 1754;
  const MARGIN_X = 64;
  const BOTTOM_LIMIT = H - 85;

  const canvases: HTMLCanvasElement[] = [];

  const createPageCanvas = (pageNum: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; startY: number } => {
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    // Top Header
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(MARGIN_X, 50, W - MARGIN_X * 2, pageNum === 1 ? 110 : 66);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText((brandName || 'STOCK ERP').toUpperCase(), MARGIN_X + 24, pageNum === 1 ? 92 : 90);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '15px sans-serif';
    if (pageNum === 1) {
      ctx.fillText(`${storeName || 'Enterprise ERP'} • Supplier & Category Purchase Report`, MARGIN_X + 24, 122);
      ctx.fillText(
        `Period: ${startDate} to ${endDate}   |   Supplier: ${supplierFilter}   |   Category: ${categoryFilter}`,
        MARGIN_X + 24,
        146
      );
    }

    ctx.textAlign = 'right';
    ctx.fillStyle = '#34d399';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(
      pageNum === 1 ? 'EXECUTIVE PURCHASE REPORT' : `PURCHASE REPORT (PAGE ${pageNum})`,
      W - MARGIN_X - 24,
      90
    );

    if (pageNum === 1) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '13px monospace';
      ctx.fillText(`Generated: ${new Date().toLocaleDateString()}`, W - MARGIN_X - 24, 122);
    }

    canvases.push(canvas);
    return { canvas, ctx, startY: pageNum === 1 ? 182 : 140 };
  };

  let pageNum = 1;
  let page = createPageCanvas(pageNum);
  let y = page.startY;
  const ctxRef = () => page.ctx;

  const ensureSpace = (needed: number, repeatHeader?: () => void) => {
    if (y + needed <= BOTTOM_LIMIT) return;
    pageNum += 1;
    page = createPageCanvas(pageNum);
    y = page.startY;
    if (repeatHeader) repeatHeader();
  };

  // KPI Strip on Page 1
  const kpis = [
    { label: 'SUPPLIERS', value: `${report.totals.totalSuppliers}` },
    { label: 'CATEGORIES', value: `${report.totals.totalCategories}` },
    { label: 'DISTINCT PRODUCTS', value: `${report.totals.totalDistinctProducts}` },
    { label: 'TOTAL UNITS BOUGHT', value: report.totals.totalUnits.toLocaleString() },
    { label: 'TOTAL PURCHASE COST', value: formatTkAmount(report.totals.totalCost) },
  ];
  const gap = 12;
  const cardW = (W - MARGIN_X * 2 - gap * (kpis.length - 1)) / kpis.length;
  kpis.forEach((k, idx) => {
    const cx = MARGIN_X + idx * (cardW + gap);
    const ctx = ctxRef();
    ctx.fillStyle = idx === 4 ? '#ecfdf5' : '#f8fafc';
    ctx.fillRect(cx, y, cardW, 74);
    ctx.strokeStyle = idx === 4 ? '#10b981' : '#cbd5e1';
    ctx.strokeRect(cx, y, cardW, 74);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(k.label, cx + 14, y + 25);
    ctx.fillStyle = idx === 4 ? '#047857' : '#0f172a';
    ctx.font = 'bold 21px sans-serif';
    ctx.fillText(k.value, cx + 14, y + 56);
  });
  y += 96;

  const drawSectionTitle = (title: string) => {
    ensureSpace(80);
    const ctx = ctxRef();
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(title, MARGIN_X, y + 20);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(MARGIN_X, y + 28, W - MARGIN_X * 2, 2);
    y += 38;
  };

  const drawTableHeader = (cols: { label: string; w: number; align?: 'left' | 'center' | 'right' }[]) => {
    const ctx = ctxRef();
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(MARGIN_X, y, W - MARGIN_X * 2, 36);
    ctx.strokeStyle = '#94a3b8';
    ctx.strokeRect(MARGIN_X, y, W - MARGIN_X * 2, 36);
    let x = MARGIN_X;
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 13px sans-serif';
    cols.forEach((c) => {
      ctx.textAlign = c.align || 'left';
      const tx =
        c.align === 'right' ? x + c.w - 10 : c.align === 'center' ? x + c.w / 2 : x + 10;
      ctx.fillText(c.label, tx, y + 23);
      x += c.w;
    });
    y += 36;
  };

  const drawTableRow = (
    cols: { label: string; w: number; align?: 'left' | 'center' | 'right' }[],
    vals: string[],
    repeatHeader: () => void,
    boldLast = false
  ) => {
    ensureSpace(34, repeatHeader);
    const ctx = ctxRef();
    ctx.strokeStyle = '#e2e8f0';
    ctx.strokeRect(MARGIN_X, y, W - MARGIN_X * 2, 32);
    let x = MARGIN_X;
    cols.forEach((c, idx) => {
      ctx.fillStyle = boldLast && idx === cols.length - 1 ? '#047857' : '#0f172a';
      ctx.font = boldLast && idx >= cols.length - 2 ? 'bold 13px sans-serif' : '13px sans-serif';
      ctx.textAlign = c.align || 'left';
      const tx =
        c.align === 'right' ? x + c.w - 10 : c.align === 'center' ? x + c.w / 2 : x + 10;
      const maxChars = Math.max(4, Math.floor(c.w / 7.5));
      const str = vals[idx].length > maxChars ? `${vals[idx].slice(0, maxChars - 1)}…` : vals[idx];
      ctx.fillText(str, tx, y + 21);
      x += c.w;
    });
    y += 32;
  };

  // Section 1: Supplier Summary
  drawSectionTitle('1. Supplier-Wise Purchase Summary');
  const supCols: { label: string; w: number; align?: 'left' | 'center' | 'right' }[] = [
    { label: 'SL', w: 50, align: 'center' },
    { label: 'Supplier / Vendor', w: 300 },
    { label: 'Categories Bought', w: 280 },
    { label: 'Products', w: 100, align: 'center' },
    { label: 'Qty Bought', w: 130, align: 'right' },
    { label: 'Total Cost', w: 162, align: 'right' },
    { label: 'Share', w: 90, align: 'right' },
  ];
  const drawSupHdr = () => drawTableHeader(supCols);
  drawSupHdr();
  report.supplierSummaries.forEach((s, idx) => {
    drawTableRow(
      supCols,
      [
        String(idx + 1),
        s.supplierName,
        s.categories.join(', '),
        String(s.distinctProducts),
        s.totalUnits.toLocaleString(),
        formatTkAmount(s.totalCost),
        `${s.sharePct}%`,
      ],
      drawSupHdr,
      true
    );
  });
  y += 22;

  // Section 2: Category Summary
  drawSectionTitle('2. Category-Wise Purchase Summary');
  const catCols: { label: string; w: number; align?: 'left' | 'center' | 'right' }[] = [
    { label: 'SL', w: 50, align: 'center' },
    { label: 'Category', w: 280 },
    { label: 'Suppliers', w: 300 },
    { label: 'Products', w: 100, align: 'center' },
    { label: 'Qty Bought', w: 130, align: 'right' },
    { label: 'Total Cost', w: 162, align: 'right' },
    { label: 'Share', w: 90, align: 'right' },
  ];
  const drawCatHdr = () => drawTableHeader(catCols);
  drawCatHdr();
  report.categorySummaries.forEach((c, idx) => {
    drawTableRow(
      catCols,
      [
        String(idx + 1),
        c.category,
        c.suppliers.join(', '),
        String(c.distinctProducts),
        c.totalUnits.toLocaleString(),
        formatTkAmount(c.totalCost),
        `${c.sharePct}%`,
      ],
      drawCatHdr,
      true
    );
  });
  y += 22;

  // Section 3: Product-Wise Breakdown
  drawSectionTitle('3. Product-Wise Purchase Breakdown (By Category & Supplier)');
  const prodCols: { label: string; w: number; align?: 'left' | 'center' | 'right' }[] = [
    { label: 'SL', w: 46, align: 'center' },
    { label: 'Category', w: 180 },
    { label: 'Product Name (SKU)', w: 290 },
    { label: 'Bought From (Supplier)', w: 256 },
    { label: 'Qty Bought', w: 120, align: 'right' },
    { label: 'Avg Cost', w: 100, align: 'right' },
    { label: 'Total Cost', w: 120, align: 'right' },
  ];
  const drawProdHdr = () => drawTableHeader(prodCols);
  drawProdHdr();
  report.productSummaries.forEach((p, idx) => {
    drawTableRow(
      prodCols,
      [
        String(idx + 1),
        p.category,
        `${p.itemName} (${p.sku})`,
        p.suppliers.join(', '),
        `${p.totalUnits.toLocaleString()} ${p.unit}`,
        formatTkAmount(p.avgUnitCost),
        formatTkAmount(p.totalCost),
      ],
      drawProdHdr,
      true
    );
  });

  // Footer page stamp on each page
  canvases.forEach((canvas, idx) => {
    const c = canvas.getContext('2d')!;
    c.fillStyle = '#64748b';
    c.font = '12px sans-serif';
    c.textAlign = 'center';
    c.fillText(
      `${brandName} • Executive Purchase Report (${startDate} to ${endDate}) • Page ${idx + 1} of ${canvases.length}`,
      W / 2,
      H - 36
    );
  });

  const jpegPages: PdfJpegPageInput[] = [];
  for (const canvas of canvases) {
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    const b64 = dataUrl.split(',')[1];
    if (!b64) continue;
    jpegPages.push({
      jpegBytes: base64ToUint8Array(b64),
      pixelWidth: W,
      pixelHeight: H,
    });
  }
  if (jpegPages.length === 0) return false;

  const pdfBytes = buildMultiPagePdfBytesFromJpegs(jpegPages);
  const pdfBuffer = pdfBytes.buffer.slice(
    pdfBytes.byteOffset,
    pdfBytes.byteOffset + pdfBytes.byteLength
  ) as ArrayBuffer;
  const pdfBlob = new Blob([pdfBuffer], { type: 'application/pdf' });
  triggerBlobDownload(pdfBlob, `Supplier_Purchase_Report_${startDate}_to_${endDate}.pdf`);
  return true;
};

export const downloadSupplierStatementPdf = (params: {
  brandTitle: string;
  supplierName: string;
  supplierPhone: string;
  supplierAddress: string;
  entries: {
    date: string;
    reference: string;
    description: string;
    debit: number;
    credit: number;
    runningBalance: number;
  }[];
  totalBilled: number;
  totalPaidAndReturned: number;
  closingBalance: number;
}): boolean => {
  const W = 1190;
  const H = 1684;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#047857';
  ctx.font = 'bold 34px serif';
  ctx.textAlign = 'left';
  ctx.fillText(params.brandTitle.toUpperCase(), 70, 95);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText(`SUPPLIER PAYABLE LEDGER — ${params.supplierName}`, 70, 140);
  ctx.font = '16px sans-serif';
  ctx.fillStyle = '#475569';
  ctx.fillText(
    `Phone: ${params.supplierPhone || 'N/A'} • ${params.supplierAddress || 'N/A'}`,
    70,
    170
  );

  ctx.textAlign = 'right';
  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('Payable Due Balance', W - 70, 130);
  ctx.fillStyle = params.closingBalance > 0 ? '#be123c' : '#047857';
  ctx.font = 'bold 28px monospace';
  ctx.fillText(formatTkAmount(params.closingBalance), W - 70, 166);

  let y = 215;
  const cols = [
    { label: 'Date', w: 120 },
    { label: 'Ref / Bill', w: 165 },
    { label: 'Particulars', w: 345 },
    { label: 'Billed (+)', w: 140 },
    { label: 'Paid / Ret (-)', w: 140 },
    { label: 'Due Bal', w: 140 },
  ];

  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(70, y, W - 140, 42);
  ctx.strokeStyle = '#64748b';
  ctx.strokeRect(70, y, W - 140, 42);
  let cx = 70;
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 15px sans-serif';
  cols.forEach((c, idx) => {
    ctx.textAlign = idx >= 3 ? 'right' : 'left';
    ctx.fillText(c.label, idx >= 3 ? cx + c.w - 10 : cx + 10, y + 27);
    cx += c.w;
  });
  y += 42;

  params.entries.slice(0, 28).forEach((e) => {
    ctx.strokeStyle = '#cbd5e1';
    ctx.strokeRect(70, y, W - 140, 38);
    let x = 70;
    const vals = [
      formatDDMMYY(e.date),
      e.reference.slice(0, 16),
      e.description.slice(0, 34),
      e.credit > 0 ? formatTkAmount(e.credit) : '-',
      e.debit > 0 ? formatTkAmount(e.debit) : '-',
      formatTkAmount(e.runningBalance),
    ];
    cols.forEach((c, idx) => {
      ctx.fillStyle = idx === 4 ? '#047857' : '#0f172a';
      ctx.font = idx === 5 ? 'bold 15px monospace' : '14px sans-serif';
      ctx.textAlign = idx >= 3 ? 'right' : 'left';
      ctx.fillText(vals[idx], idx >= 3 ? x + c.w - 10 : x + 10, y + 25);
      x += c.w;
    });
    y += 38;
  });

  y += 20;
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(70, y, W - 140, 46);
  ctx.strokeStyle = '#475569';
  ctx.strokeRect(70, y, W - 140, 46);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText(
    `Totals — Billed: ${formatTkAmount(params.totalBilled)} | Paid/Returned: ${formatTkAmount(params.totalPaidAndReturned)} | Closing Payable: ${formatTkAmount(params.closingBalance)}`,
    90,
    y + 29
  );

  const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.92);
  const b64 = jpegDataUrl.split(',')[1];
  if (!b64) return false;
  const pdfBytes = buildPdfBytesFromJpeg(base64ToUint8Array(b64), W, H);
  const pdfBuffer = pdfBytes.buffer.slice(
    pdfBytes.byteOffset,
    pdfBytes.byteOffset + pdfBytes.byteLength
  ) as ArrayBuffer;
  const pdfBlob = new Blob([pdfBuffer], { type: 'application/pdf' });
  triggerBlobDownload(
    pdfBlob,
    `Supplier_Statement_${params.supplierName.replace(/\s+/g, '_')}.pdf`
  );
  return true;
};

export interface ProfitDeadStockPdfRow {
  itemName: string;
  sku: string;
  category: string;
  soldPaidUnits: number;
  bonusFreeUnits: number;
  grossRevenue: number;
  cogs: number;
  grossProfit: number;
  marginPct: number;
  currentStock: number;
  daysSinceLastSold: number | null;
  lockedCapitalValue: number;
  isDeadStock: boolean;
}

export const downloadProfitDeadStockPdf = (params: {
  brandName: string;
  storeName: string;
  startDate: string;
  endDate: string;
  deadStockThresholdDays: number;
  totalRevenue: number;
  totalCogs: number;
  totalGrossProfit: number;
  overallMarginPct: number;
  deadStockCapitalValue: number;
  rows: ProfitDeadStockPdfRow[];
  deadStockRows: ProfitDeadStockPdfRow[];
}): boolean => {
  const W = 1240;
  const H = 1754;
  const MARGIN_X = 64;
  const BOTTOM_LIMIT = H - 80;

  const canvases: HTMLCanvasElement[] = [];
  const createPage = (): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } => {
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    canvases.push(canvas);
    return { canvas, ctx };
  };

  let page = createPage();
  let y = 64;

  const ensureSpace = (neededHeight: number, onNewPageHeader?: () => void) => {
    if (y + neededHeight <= BOTTOM_LIMIT) return;
    page = createPage();
    y = 64;
    if (onNewPageHeader) onNewPageHeader();
  };

  const ctx0 = page.ctx;
  ctx0.fillStyle = '#0f172a';
  ctx0.font = 'bold 30px serif';
  ctx0.fillText((params.brandName || params.storeName || 'STOCK ERP').toUpperCase(), MARGIN_X, y + 26);

  ctx0.fillStyle = '#047857';
  ctx0.font = 'bold 20px sans-serif';
  ctx0.fillText('PRODUCT PROFIT MARGIN & DEAD-STOCK ANALYTICS REPORT', MARGIN_X, y + 58);

  ctx0.fillStyle = '#475569';
  ctx0.font = '15px sans-serif';
  ctx0.fillText(
    `Sales Period: ${params.startDate || 'All'} to ${params.endDate || 'All'} • Dead-Stock Threshold: ${params.deadStockThresholdDays}+ Days`,
    MARGIN_X,
    y + 84
  );

  y += 108;

  const kpis = [
    { label: 'Gross Revenue', val: formatTkAmount(params.totalRevenue) },
    { label: 'COGS (Incl. Bonus)', val: formatTkAmount(params.totalCogs) },
    { label: 'Gross Profit', val: formatTkAmount(params.totalGrossProfit) },
    { label: 'Avg Margin %', val: `${params.overallMarginPct}%` },
    { label: 'Dead-Stock Capital', val: formatTkAmount(params.deadStockCapitalValue) },
  ];
  const cardW = (W - MARGIN_X * 2 - 48) / 5;
  kpis.forEach((k, idx) => {
    const cx = MARGIN_X + idx * (cardW + 12);
    ctx0.fillStyle = '#f8fafc';
    ctx0.fillRect(cx, y, cardW, 74);
    ctx0.strokeStyle = '#cbd5e1';
    ctx0.strokeRect(cx, y, cardW, 74);
    ctx0.fillStyle = '#64748b';
    ctx0.font = 'bold 12px sans-serif';
    ctx0.fillText(k.label, cx + 10, y + 24);
    ctx0.fillStyle = idx === 2 ? '#047857' : idx === 4 ? '#be123c' : '#0f172a';
    ctx0.font = 'bold 18px sans-serif';
    ctx0.fillText(k.val, cx + 10, y + 52);
  });
  y += 96;

  const drawTableHeader = (cols: { label: string; w: number; align?: 'left' | 'center' | 'right' }[]) => {
    const ctx = page.ctx;
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(MARGIN_X, y, W - MARGIN_X * 2, 36);
    ctx.strokeStyle = '#94a3b8';
    ctx.strokeRect(MARGIN_X, y, W - MARGIN_X * 2, 36);
    let x = MARGIN_X;
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 13px sans-serif';
    cols.forEach((c) => {
      ctx.textAlign = c.align || 'left';
      const tx =
        c.align === 'right' ? x + c.w - 10 : c.align === 'center' ? x + c.w / 2 : x + 10;
      ctx.fillText(c.label, tx, y + 23);
      x += c.w;
    });
    y += 36;
  };

  const drawRow = (
    cols: { label: string; w: number; align?: 'left' | 'center' | 'right' }[],
    vals: string[],
    repeatHeader: () => void
  ) => {
    ensureSpace(34, repeatHeader);
    const ctx = page.ctx;
    ctx.strokeStyle = '#e2e8f0';
    ctx.strokeRect(MARGIN_X, y, W - MARGIN_X * 2, 32);
    let x = MARGIN_X;
    cols.forEach((c, idx) => {
      ctx.fillStyle = '#0f172a';
      ctx.font = idx === vals.length - 1 ? 'bold 13px sans-serif' : '13px sans-serif';
      ctx.textAlign = c.align || 'left';
      const tx =
        c.align === 'right' ? x + c.w - 10 : c.align === 'center' ? x + c.w / 2 : x + 10;
      const maxChars = Math.max(4, Math.floor(c.w / 7.5));
      const str = vals[idx].length > maxChars ? `${vals[idx].slice(0, maxChars - 1)}…` : vals[idx];
      ctx.fillText(str, tx, y + 21);
      x += c.w;
    });
    y += 32;
  };

  const profitCols: { label: string; w: number; align?: 'left' | 'center' | 'right' }[] = [
    { label: 'SL', w: 46, align: 'center' },
    { label: 'Product Name', w: 280 },
    { label: 'Category', w: 150 },
    { label: 'Sold / Free', w: 110, align: 'center' },
    { label: 'Revenue', w: 136, align: 'right' },
    { label: 'COGS', w: 136, align: 'right' },
    { label: 'Gross Profit', w: 154, align: 'right' },
    { label: 'Margin', w: 100, align: 'right' },
  ];
  const drawProfitHdr = () => drawTableHeader(profitCols);
  page.ctx.fillStyle = '#0f172a';
  page.ctx.font = 'bold 17px sans-serif';
  page.ctx.fillText('1. Product-Wise Profit & Margin Performance', MARGIN_X, y + 18);
  y += 28;
  drawProfitHdr();
  params.rows.slice(0, 120).forEach((r, idx) => {
    drawRow(
      profitCols,
      [
        String(idx + 1),
        `${r.itemName} (${r.sku})`,
        r.category,
        `${r.soldPaidUnits}${r.bonusFreeUnits > 0 ? `+${r.bonusFreeUnits}F` : ''}`,
        formatTkAmount(r.grossRevenue),
        formatTkAmount(r.cogs),
        formatTkAmount(r.grossProfit),
        `${r.marginPct}%`,
      ],
      drawProfitHdr
    );
  });

  y += 24;
  ensureSpace(90);
  page.ctx.fillStyle = '#be123c';
  page.ctx.font = 'bold 17px sans-serif';
  page.ctx.fillText(
    `2. Slow & Dead-Stock Inventory (${params.deadStockThresholdDays}+ Days Unsold)`,
    MARGIN_X,
    y + 18
  );
  y += 28;

  const deadCols: { label: string; w: number; align?: 'left' | 'center' | 'right' }[] = [
    { label: 'SL', w: 50, align: 'center' },
    { label: 'Product Name (SKU)', w: 360 },
    { label: 'Category', w: 180 },
    { label: 'Current Stock', w: 140, align: 'right' },
    { label: 'Days Unsold', w: 150, align: 'center' },
    { label: 'Locked Capital Value', w: 232, align: 'right' },
  ];
  const drawDeadHdr = () => drawTableHeader(deadCols);
  drawDeadHdr();
  params.deadStockRows.forEach((d, idx) => {
    drawRow(
      deadCols,
      [
        String(idx + 1),
        `${d.itemName} (${d.sku})`,
        d.category,
        String(d.currentStock),
        d.daysSinceLastSold === null ? 'Never Sold' : `${d.daysSinceLastSold} days`,
        formatTkAmount(d.lockedCapitalValue),
      ],
      drawDeadHdr
    );
  });

  const jpegPages: PdfJpegPageInput[] = [];
  for (const canvas of canvases) {
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    const b64 = dataUrl.split(',')[1];
    if (!b64) continue;
    jpegPages.push({
      jpegBytes: base64ToUint8Array(b64),
      pixelWidth: W,
      pixelHeight: H,
    });
  }
  if (jpegPages.length === 0) return false;

  const pdfBytes = buildMultiPagePdfBytesFromJpegs(jpegPages);
  const pdfBuffer = pdfBytes.buffer.slice(
    pdfBytes.byteOffset,
    pdfBytes.byteOffset + pdfBytes.byteLength
  ) as ArrayBuffer;
  const pdfBlob = new Blob([pdfBuffer], { type: 'application/pdf' });
  triggerBlobDownload(
    pdfBlob,
    `Profit_and_DeadStock_Report_${params.startDate || 'All'}_to_${params.endDate || 'All'}.pdf`
  );
  return true;
};

export const isInsideIframeEnv = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
};
