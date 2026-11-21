import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const escapePdfText = (value) => String(value ?? '')
    .replace(/[\u2014\u2013]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[^\x20-\x7e]/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');

const invoiceDate = (transaction) => {
    const date = new Date(transaction.PaidAt || transaction.CreatedAt || Date.now());
    return Number.isNaN(date.getTime())
        ? new Date().toLocaleDateString('en-GB')
        : date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
};

const pdfText = (text, x, y, size, color, font = 'F2', maxLength = 100) => {
    const cleanText = String(text ?? '').replace(/[\r\n]+/g, ' ').trim().slice(0, maxLength);
    return `BT /${font} ${size} Tf ${color} rg ${x.toFixed(2)} ${y.toFixed(2)} Td (${escapePdfText(cleanText)}) Tj ET\n`;
};

const pdfRect = (x, y, width, height, color) =>
    `${color} rg ${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re f\n`;

const pdfStrokeRect = (x, y, width, height, color, lineWidth = 0.8) =>
    `${color} RG ${lineWidth} w ${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re S\n`;

const pdfLine = (x1, y1, x2, y2, color, lineWidth = 0.7) =>
    `${color} RG ${lineWidth} w ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S\n`;

const pdfRoundedRect = (x, y, w, h, r, color) => {
    if (r <= 0) return `${color} rg ${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f\n`;
    const k = r * 0.55228475;
    return `${color} rg ` +
        `${(x + r).toFixed(2)} ${y.toFixed(2)} m ` +
        `${(x + w - r).toFixed(2)} ${y.toFixed(2)} l ` +
        `${(x + w - r + k).toFixed(2)} ${y.toFixed(2)} ${(x + w).toFixed(2)} ${(y + r - k).toFixed(2)} ${(x + w).toFixed(2)} ${(y + r).toFixed(2)} c ` +
        `${(x + w).toFixed(2)} ${(y + h - r).toFixed(2)} l ` +
        `${(x + w).toFixed(2)} ${(y + h - r + k).toFixed(2)} ${(x + w - r + k).toFixed(2)} ${(y + h).toFixed(2)} ${(x + w - r).toFixed(2)} ${(y + h).toFixed(2)} c ` +
        `${(x + r).toFixed(2)} ${(y + h).toFixed(2)} l ` +
        `${(x + r - k).toFixed(2)} ${(y + h).toFixed(2)} ${x.toFixed(2)} ${(y + h - r + k).toFixed(2)} ${x.toFixed(2)} ${(y + h - r).toFixed(2)} c ` +
        `${x.toFixed(2)} ${(y + r).toFixed(2)} l ` +
        `${x.toFixed(2)} ${(y + r - k).toFixed(2)} ${(x + r - k).toFixed(2)} ${y.toFixed(2)} ${(x + r).toFixed(2)} ${y.toFixed(2)} c ` +
        `f\n`;
};

const pdfStrokeRoundedRect = (x, y, w, h, r, color, lineWidth = 0.8) => {
    if (r <= 0) return `${color} RG ${lineWidth} w ${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re S\n`;
    const k = r * 0.55228475;
    return `${color} RG ${lineWidth} w ` +
        `${(x + r).toFixed(2)} ${y.toFixed(2)} m ` +
        `${(x + w - r).toFixed(2)} ${y.toFixed(2)} l ` +
        `${(x + w - r + k).toFixed(2)} ${y.toFixed(2)} ${(x + w).toFixed(2)} ${(y + r - k).toFixed(2)} ${(x + w).toFixed(2)} ${(y + r).toFixed(2)} c ` +
        `${(x + w).toFixed(2)} ${(y + h - r).toFixed(2)} l ` +
        `${(x + w).toFixed(2)} ${(y + h - r + k).toFixed(2)} ${(x + w - r + k).toFixed(2)} ${(y + h).toFixed(2)} ${(x + w - r).toFixed(2)} ${(y + h).toFixed(2)} c ` +
        `${(x + r).toFixed(2)} ${(y + h).toFixed(2)} l ` +
        `${(x + r - k).toFixed(2)} ${(y + h).toFixed(2)} ${x.toFixed(2)} ${(y + h - r + k).toFixed(2)} ${x.toFixed(2)} ${(y + h - r).toFixed(2)} c ` +
        `${x.toFixed(2)} ${(y + r).toFixed(2)} l ` +
        `${x.toFixed(2)} ${(y + r - k).toFixed(2)} ${(x + r - k).toFixed(2)} ${y.toFixed(2)} ${(x + r).toFixed(2)} ${y.toFixed(2)} c ` +
        `S\n`;
};

let cachedLogoData = null;

const getLogoData = () => {
    if (cachedLogoData) return cachedLogoData;
    try {
        const logoPath = path.join(__dirname, 'logo_b.png');
        if (!fs.existsSync(logoPath)) {
            return null;
        }

        const fileBuffer = fs.readFileSync(logoPath);
        if (fileBuffer.length < 8) {
            return null;
        }

        // Validate PNG signature: \x89PNG\r\n\x1a\n
        if (fileBuffer[0] !== 0x89 || fileBuffer[1] !== 0x50 || fileBuffer[2] !== 0x4e || fileBuffer[3] !== 0x47) {
            return null;
        }

        let pos = 8;
        let width = 0;
        let height = 0;
        let bitDepth = 8;
        let colorType = 6;
        let palette = null;
        let trns = null;
        const idatChunks = [];

        while (pos + 8 <= fileBuffer.length) {
            const length = fileBuffer.readUInt32BE(pos);
            const type = fileBuffer.toString('ascii', pos + 4, pos + 8);
            if (type === 'IHDR') {
                width = fileBuffer.readUInt32BE(pos + 8);
                height = fileBuffer.readUInt32BE(pos + 12);
                bitDepth = fileBuffer[pos + 16];
                colorType = fileBuffer[pos + 17];
            } else if (type === 'PLTE') {
                palette = fileBuffer.subarray(pos + 8, pos + 8 + length);
            } else if (type === 'tRNS') {
                trns = fileBuffer.subarray(pos + 8, pos + 8 + length);
            } else if (type === 'IDAT') {
                idatChunks.push(fileBuffer.subarray(pos + 8, pos + 8 + length));
            } else if (type === 'IEND') {
                break;
            }
            pos += 12 + length;
        }

        if (!width || !height || idatChunks.length === 0) {
            return null;
        }

        const decompressed = zlib.inflateSync(Buffer.concat(idatChunks));
        let stride;
        let bpp;

        if (colorType === 3) { // Indexed / palette
            stride = Math.ceil((width * bitDepth) / 8);
            bpp = 1;
        } else if (colorType === 6) { // RGBA
            bpp = 4;
            stride = width * 4;
        } else if (colorType === 2) { // RGB
            bpp = 3;
            stride = width * 3;
        } else { // Grayscale
            bpp = 1;
            stride = width;
        }

        const rowBytes = 1 + stride;
        const raw = Buffer.alloc(height * stride);

        for (let y = 0; y < height; y++) {
            const filterType = decompressed[y * rowBytes];
            const rowStart = y * rowBytes + 1;
            const outRowStart = y * stride;
            const prevOutRowStart = (y - 1) * stride;

            for (let x = 0; x < stride; x++) {
                const rawByte = decompressed[rowStart + x];
                const left = x >= bpp ? raw[outRowStart + x - bpp] : 0;
                const above = y > 0 ? raw[prevOutRowStart + x] : 0;
                const aboveLeft = (y > 0 && x >= bpp) ? raw[prevOutRowStart + x - bpp] : 0;

                let val = rawByte;
                if (filterType === 1) { // Sub
                    val = (rawByte + left) & 0xff;
                } else if (filterType === 2) { // Up
                    val = (rawByte + above) & 0xff;
                } else if (filterType === 3) { // Average
                    val = (rawByte + Math.floor((left + above) / 2)) & 0xff;
                } else if (filterType === 4) { // Paeth
                    const p = left + above - aboveLeft;
                    const pa = Math.abs(p - left);
                    const pb = Math.abs(p - above);
                    const pc = Math.abs(p - aboveLeft);
                    const pr = (pa <= pb && pa <= pc) ? left : (pb <= pc ? above : aboveLeft);
                    val = (rawByte + pr) & 0xff;
                }
                raw[outRowStart + x] = val;
            }
        }

        const rgb = Buffer.alloc(width * height * 3);

        if (colorType === 3 && palette) {
            // Palette decoding (supports 1, 2, 4, 8 bit depth)
            const mask = (1 << bitDepth) - 1;
            const pixelsPerByte = Math.floor(8 / bitDepth);
            let dst = 0;
            for (let y = 0; y < height; y++) {
                const rowOffset = y * stride;
                for (let x = 0; x < width; x++) {
                    const byteIndex = rowOffset + Math.floor(x / pixelsPerByte);
                    const bitShift = 8 - bitDepth - (x % pixelsPerByte) * bitDepth;
                    const idx = (raw[byteIndex] >> bitShift) & mask;
                    const palIndex = idx * 3;
                    const r = palette[palIndex] ?? 255;
                    const g = palette[palIndex + 1] ?? 255;
                    const b = palette[palIndex + 2] ?? 255;
                    const a = trns && idx < trns.length ? trns[idx] : 255;
                    if (a === 255) {
                        rgb[dst++] = r;
                        rgb[dst++] = g;
                        rgb[dst++] = b;
                    } else if (a === 0) {
                        rgb[dst++] = 255;
                        rgb[dst++] = 255;
                        rgb[dst++] = 255;
                    } else {
                        const factor = a / 255;
                        rgb[dst++] = Math.round(r * factor + 255 * (1 - factor));
                        rgb[dst++] = Math.round(g * factor + 255 * (1 - factor));
                        rgb[dst++] = Math.round(b * factor + 255 * (1 - factor));
                    }
                }
            }
        } else if (colorType === 6) { // RGBA
            let dst = 0;
            for (let i = 0; i < width * height; i++) {
                const src = i * 4;
                const r = raw[src];
                const g = raw[src + 1];
                const b = raw[src + 2];
                const a = raw[src + 3];
                if (a === 255) {
                    rgb[dst++] = r;
                    rgb[dst++] = g;
                    rgb[dst++] = b;
                } else if (a === 0) {
                    rgb[dst++] = 255;
                    rgb[dst++] = 255;
                    rgb[dst++] = 255;
                } else {
                    const factor = a / 255;
                    rgb[dst++] = Math.round(r * factor + 255 * (1 - factor));
                    rgb[dst++] = Math.round(g * factor + 255 * (1 - factor));
                    rgb[dst++] = Math.round(b * factor + 255 * (1 - factor));
                }
            }
        } else if (colorType === 2) { // RGB
            raw.copy(rgb);
        } else { // Grayscale
            let dst = 0;
            for (let i = 0; i < width * height; i++) {
                const gray = raw[i];
                rgb[dst++] = gray;
                rgb[dst++] = gray;
                rgb[dst++] = gray;
            }
        }

        const deflated = zlib.deflateSync(rgb);
        cachedLogoData = { width, height, deflated };
        return cachedLogoData;
    } catch (err) {
        console.error('[PaymentInvoiceService] Error decoding logo_b.png:', err);
        return null;
    }
};

export const createPaymentInvoicePdf = (transaction) => {
    const amount = Number(transaction.Amount);
    if (!Number.isFinite(amount) || amount < 0) {
        throw new Error('Cannot create an invoice for an invalid payment amount.');
    }
    const employees = Array.isArray(transaction.Employees) ? transaction.Employees : [];
    const requestedQuantity = Number(transaction.Quantity);
    const quantity = Number.isInteger(requestedQuantity) && requestedQuantity > 0
        ? requestedQuantity
        : employees.length || 1;
    if (employees.length && employees.length !== quantity) {
        throw new Error('Invoice quantity does not match the employee records.');
    }
    const employeeRowsPerPage = 32;
    const pageCount = 1 + Math.ceil(employees.length / employeeRowsPerPage);

    const rawCurrency = String(transaction.Currency || 'INR').trim().toUpperCase();
    const currency = /^[A-Z]{3}$/.test(rawCurrency) ? rawCurrency : 'INR';
    const invoiceNumber = `WT-${String(transaction.TransactionID || transaction.RazorpayOrderID || 'PAYMENT').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40) || 'PAYMENT'}`;
    const paidDate = invoiceDate(transaction);
    const candidateName = String(transaction.CandidateName || 'Client').trim();
    const clientEmail = String(transaction.Email || '').trim();
    const orderId = String(transaction.RazorpayOrderID || 'N/A').trim();
    const paymentId = String(transaction.RazorpayPaymentID || 'N/A').trim();
    const amountText = `${currency} ${amount.toFixed(2)}`;
    const unitAmountText = `${currency} ${(amount / quantity).toFixed(2)}`;

    // Brand color palette
    const securitasRed = '0.933 0.110 0.145';
    const securitasNavy = '0.000 0.145 0.243';
    const textDark = '0.07 0.11 0.18';
    const textMuted = '0.45 0.50 0.58';
    const borderSubtle = '0.88 0.91 0.94';
    const bgLight = '0.97 0.98 0.99';
    const paidGreen = '0.02 0.55 0.35';
    const paidBg = '0.92 0.99 0.96';
    const paidBorder = '0.65 0.95 0.82';

    const logoData = getLogoData();

    let content = '';

    // Clean background
    content += pdfRect(0, 0, 595.28, 841.89, '1 1 1');

    // Top corporate accent bar
    content += pdfRect(0, 836.89, 595.28, 5, securitasNavy);
    content += pdfRect(0, 836.89, 145, 5, securitasRed);

    // ==========================================
    // HEADER: Securitas Logo (Top-Left) & Invoice Info (Top-Right)
    // ==========================================
    if (logoData) {
        // Reduced logo size: width 70pt with proportional height
        const logoWidth = 70;
        const logoHeight = Math.round(logoWidth * (logoData.height / logoData.width));
        const logoX = 42;
        const logoY = 750;
        content += `q ${logoWidth} 0 0 ${logoHeight} ${logoX} ${logoY} cm /Logo Do Q\n`;
        content += pdfText('INTELLIGENT VERIFICATION PLATFORM', 42, 738, 6.2, textMuted, 'F1');
    } else {
        content += pdfText('SECURITAS', 42, 765, 16, securitasNavy, 'F1');
        content += pdfText('INTELLIGENT VERIFICATION PLATFORM', 42, 750, 6.5, textMuted, 'F1');
    }

    // Right header: Invoice Details & Paid Badge
    content += pdfText('PAYMENT INVOICE', 360, 792, 16, securitasNavy, 'F1', 30);
    content += pdfText(`INVOICE NO.  ${invoiceNumber}`, 360, 777, 8.5, textMuted, 'F2', 36);
    content += pdfText(`DATE ISSUED  ${paidDate}`, 360, 763, 8.5, textMuted, 'F2', 36);

    // Paid status pill badge
    content += pdfRoundedRect(485, 754, 70, 22, 11, paidBg);
    content += pdfStrokeRoundedRect(485, 754, 70, 22, 11, paidBorder, 0.8);
    content += pdfText('PAID', 505, 761, 8.5, paidGreen, 'F1');

    // Header divider line
    content += pdfLine(40, 726, 555, 726, borderSubtle, 0.8);

    // ==========================================
    // HERO STATUS BANNER
    // ==========================================
    content += pdfRoundedRect(40, 663, 515, 52, 6, bgLight);
    content += pdfStrokeRoundedRect(40, 663, 515, 52, 6, borderSubtle, 0.8);
    content += pdfRect(40, 663, 4, 52, securitasRed);

    content += pdfText('PAYMENT STATUS', 56, 697, 7, textMuted, 'F1');
    content += pdfText('Payment Completed Successfully', 56, 682, 11, securitasNavy, 'F1');
    content += pdfText('Official receipt confirming payment for candidate verification services.', 56, 671, 7.5, textMuted, 'F2');

    content += pdfText('TOTAL AMOUNT PAID', 410, 697, 7, textMuted, 'F1');
    content += pdfText(amountText, 410, 678, 16, paidGreen, 'F1');

    // ==========================================
    // BILLED TO & PAYMENT SUMMARY CARDS
    // ==========================================
    // Left Card: Billed To
    content += pdfRoundedRect(40, 560, 310, 90, 6, '1 1 1');
    content += pdfStrokeRoundedRect(40, 560, 310, 90, 6, borderSubtle, 0.8);
    content += pdfText('BILLED TO', 55, 632, 7.5, textMuted, 'F1');
    content += pdfText(candidateName, 55, 612, 12, textDark, 'F1', 38);
    content += pdfText(clientEmail || 'Client email not available', 55, 595, 8.5, '0.25 0.30 0.38', 'F2', 50);
    content += pdfText('Candidate Background Verification Service', 55, 577, 8, textMuted, 'F2');

    // Right Card: Invoice Metrics
    content += pdfRoundedRect(360, 560, 195, 90, 6, '1 1 1');
    content += pdfStrokeRoundedRect(360, 560, 195, 90, 6, borderSubtle, 0.8);
    content += pdfText('INVOICE DATE', 375, 632, 7, textMuted, 'F1');
    content += pdfText(paidDate, 375, 618, 9, textDark, 'F1');
    content += pdfText('PAYMENT STATUS', 375, 597, 7, textMuted, 'F1');
    content += pdfText('PAID IN FULL', 375, 583, 9, paidGreen, 'F1');
    content += pdfText('METHOD', 475, 597, 7, textMuted, 'F1');
    content += pdfText('Online', 475, 583, 9, textDark, 'F1');

    // ==========================================
    // ITEMIZED PAYMENT TABLE
    // ==========================================
    content += pdfText('ITEMIZED PAYMENT SUMMARY', 40, 536, 8.5, securitasNavy, 'F1');

    // Table Header
    content += pdfRoundedRect(40, 506, 515, 22, 4, securitasNavy);
    content += pdfText('DESCRIPTION', 52, 513, 7.5, '1 1 1', 'F1');
    content += pdfText('QTY', 365, 513, 7.5, '1 1 1', 'F1');
    content += pdfText('UNIT PRICE', 425, 513, 7.5, '1 1 1', 'F1');
    content += pdfText('AMOUNT', 500, 513, 7.5, '1 1 1', 'F1');

    // Table Row
    content += pdfRect(40, 470, 515, 36, '0.985 0.988 0.992');
    content += pdfText('Candidate background verification service', 52, 488, 8.5, textDark, 'F1');
    content += pdfText('Identity, background and credential verification', 52, 476, 7.5, textMuted, 'F2');
    content += pdfText(String(quantity), 372, 482, 8.5, textDark, 'F2');
    content += pdfText(unitAmountText, 425, 482, 8.5, textDark, 'F2');
    content += pdfText(amountText, 500, 482, 8.5, securitasNavy, 'F1');
    content += pdfLine(40, 470, 555, 470, borderSubtle, 0.8);

    // Totals Block
    content += pdfText('Subtotal:', 405, 452, 8, textMuted, 'F2');
    content += pdfText(amountText, 500, 452, 8, textDark, 'F2');

    content += pdfText('Taxes & Fees (Included):', 370, 438, 8, textMuted, 'F2');
    content += pdfText(`${currency} 0.00`, 500, 438, 8, textDark, 'F2');

    // Total Paid Card
    content += pdfRoundedRect(340, 408, 215, 24, 4, paidBg);
    content += pdfStrokeRoundedRect(340, 408, 215, 24, 4, paidBorder, 0.8);
    content += pdfText('Total Paid', 352, 416, 8.5, paidGreen, 'F1');
    content += pdfText(amountText, 470, 415, 11, paidGreen, 'F1');

    // ==========================================
    // TRANSACTION & GATEWAY REFERENCE
    // ==========================================
    content += pdfText('TRANSACTION & GATEWAY DETAILS', 40, 392, 8.5, securitasNavy, 'F1');

    content += pdfRoundedRect(40, 265, 515, 116, 6, bgLight);
    content += pdfStrokeRoundedRect(40, 265, 515, 116, 6, borderSubtle, 0.8);

    content += pdfText('RAZORPAY ORDER ID', 56, 360, 7, textMuted, 'F1');
    content += pdfText(orderId, 56, 347, 8.5, textDark, 'F2', 65);

    content += pdfText('RAZORPAY PAYMENT ID', 56, 325, 7, textMuted, 'F1');
    content += pdfText(paymentId, 56, 312, 8.5, textDark, 'F2', 65);

    content += pdfText('INVOICE REFERENCE', 56, 290, 7, textMuted, 'F1');
    content += pdfText(invoiceNumber, 56, 277, 8.5, textDark, 'F2', 65);

    // Security Verification Badge
    content += pdfRoundedRect(350, 275, 190, 96, 6, '1 1 1');
    content += pdfStrokeRoundedRect(350, 275, 190, 96, 6, borderSubtle, 0.8);
    content += pdfText('TRANSACTION SECURITY', 365, 352, 7.5, securitasNavy, 'F1');
    content += pdfText('Securitas Verified Gateway', 365, 340, 7, textMuted, 'F2');
    content += pdfLine(365, 332, 525, 332, borderSubtle, 0.7);
    content += pdfText('[OK] 256-Bit SSL Encrypted', 365, 318, 7.5, '0.15 0.20 0.28', 'F2');
    content += pdfText('[OK] Gateway Confirmed', 365, 302, 7.5, '0.15 0.20 0.28', 'F2');
    content += pdfText('[OK] Worktrail Platform Validated', 365, 286, 7.5, '0.15 0.20 0.28', 'F2');

    // ==========================================
    // TERMS & NOTICE BOX
    // ==========================================
    content += pdfRoundedRect(40, 175, 515, 65, 6, '0.95 0.96 0.98');
    content += pdfStrokeRoundedRect(40, 175, 515, 65, 6, '0.88 0.90 0.93', 0.8);
    content += pdfRect(40, 175, 4, 65, securitasRed);

    content += pdfText('TERMS & VERIFICATION NOTICE', 54, 224, 7.5, securitasNavy, 'F1');
    content += pdfText('This document confirms receipt of payment for candidate background verification services.', 54, 210, 7.5, '0.30 0.35 0.42', 'F2');
    content += pdfText('All background verification processes are carried out in strict accordance with data privacy regulations.', 54, 197, 7.5, '0.30 0.35 0.42', 'F2');
    content += pdfText('Please retain this invoice for your financial and audit records.', 54, 184, 7.5, '0.30 0.35 0.42', 'F2');

    // ==========================================
    // FOOTER
    // ==========================================
    content += pdfLine(40, 125, 555, 125, borderSubtle, 0.8);

    content += pdfText('Securitas  |  Worktrail Verification Platform', 40, 101, 8, securitasNavy, 'F1');
    content += pdfText('Generated electronically - valid without physical signature.', 40, 86, 7, textMuted, 'F2');

    content += pdfText(`Invoice Ref: ${invoiceNumber}`, 390, 101, 7.5, textMuted, 'F1');
    content += pdfText(`Page 1 of ${pageCount}`, 520, 86, 7, textMuted, 'F2');

    content += pdfRect(40, 60, 515, 2, securitasRed);

    const pages = [content];
    for (let pageIndex = 0; pageIndex < pageCount - 1; pageIndex += 1) {
        const pageEmployees = employees.slice(
            pageIndex * employeeRowsPerPage,
            (pageIndex + 1) * employeeRowsPerPage
        );
        let employeeContent = pdfRect(0, 0, 595.28, 841.89, '1 1 1');
        employeeContent += pdfRect(0, 836.89, 595.28, 5, securitasNavy);
        employeeContent += pdfRect(0, 836.89, 145, 5, securitasRed);
        if (logoData) {
            const logoWidth = 70;
            const logoHeight = Math.round(logoWidth * (logoData.height / logoData.width));
            employeeContent += `q ${logoWidth} 0 0 ${logoHeight} 42 750 cm /Logo Do Q\n`;
        } else {
            employeeContent += pdfText('SECURITAS', 42, 765, 16, securitasNavy, 'F1');
        }
        employeeContent += pdfText('EMPLOYEE DETAILS', 360, 792, 16, securitasNavy, 'F1', 30);
        employeeContent += pdfText(`ORDER ID  ${orderId}`, 360, 777, 8.5, textMuted, 'F2', 36);
        employeeContent += pdfText(`QUANTITY  ${quantity}`, 360, 763, 8.5, textMuted, 'F2', 36);
        employeeContent += pdfLine(40, 726, 555, 726, borderSubtle, 0.8);
        employeeContent += pdfText(
            `EMPLOYEES INCLUDED IN THIS PAYMENT (${employees.length} TOTAL)`,
            40,
            700,
            8.5,
            securitasNavy,
            'F1',
            70
        );
        employeeContent += pdfRoundedRect(40, 662, 515, 22, 4, securitasNavy);
        employeeContent += pdfText('NO.', 52, 669, 7.5, '1 1 1', 'F1');
        employeeContent += pdfText('EMPLOYEE NAME', 90, 669, 7.5, '1 1 1', 'F1');
        employeeContent += pdfText('EMPLOYEE CODE', 390, 669, 7.5, '1 1 1', 'F1');

        pageEmployees.forEach((employee, rowIndex) => {
            const rowY = 640 - rowIndex * 17;
            const fullName = [employee.FirstName, employee.MiddleName, employee.LastName]
                .filter((name) => typeof name === 'string' && name.trim())
                .map((name) => name.trim())
                .join(' ') || 'Name not provided';
            employeeContent += pdfText(String(pageIndex * employeeRowsPerPage + rowIndex + 1), 52, rowY, 8, textMuted, 'F2', 6);
            employeeContent += pdfText(fullName, 90, rowY, 8, textDark, 'F2', 48);
            employeeContent += pdfText(employee.EmployeeCode || '—', 390, rowY, 8, textDark, 'F2', 24);
            employeeContent += pdfLine(40, rowY - 5, 555, rowY - 5, borderSubtle, 0.4);
        });

        const pageNumber = pageIndex + 2;
        employeeContent += pdfLine(40, 80, 555, 80, borderSubtle, 0.8);
        employeeContent += pdfText('Securitas  |  Worktrail Verification Platform', 40, 58, 8, securitasNavy, 'F1');
        employeeContent += pdfText(`Page ${pageNumber} of ${pageCount}`, 500, 58, 7, textMuted, 'F2', 20);
        pages.push(employeeContent);
    }

    // ==========================================
    // PDF OBJECT ASSEMBLY
    // ==========================================
    const hasImage = Boolean(logoData && logoData.deflated);
    const pageObjectStart = 3;
    const contentObjectStart = pageObjectStart + pages.length;
    const fontBoldObject = contentObjectStart + pages.length;
    const fontRegularObject = fontBoldObject + 1;
    const logoObject = fontRegularObject + 1;
    const objects = [
        Buffer.from('<< /Type /Catalog /Pages 2 0 R >>'),
        Buffer.from(`<< /Type /Pages /Kids [${pages.map((_, index) => `${pageObjectStart + index} 0 R`).join(' ')}] /Count ${pages.length} >>`)
    ];

    pages.forEach((pageContent, index) => {
        const pageObject = pageObjectStart + index;
        const contentObject = contentObjectStart + index;
        objects.push(Buffer.from(
            `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /Font << /F1 ${fontBoldObject} 0 R /F2 ${fontRegularObject} 0 R >>${hasImage ? ` /XObject << /Logo ${logoObject} 0 R >>` : ''} >> /Contents ${contentObject} 0 R >>`
        ));
    });

    pages.forEach((pageContent) => {
        const streamBuffer = Buffer.from(pageContent, 'latin1');
        objects.push(Buffer.concat([
            Buffer.from(`<< /Length ${streamBuffer.length} >>\nstream\n`),
            streamBuffer,
            Buffer.from('\nendstream')
        ]));
    });
    objects.push(
        Buffer.from('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'),
        Buffer.from('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>')
    );

    if (hasImage) {
        const imageHeader = Buffer.from(
            `<< /Type /XObject /Subtype /Image /Width ${logoData.width} /Height ${logoData.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${logoData.deflated.length} >>\nstream\n`
        );
        objects.push(Buffer.concat([imageHeader, logoData.deflated, Buffer.from('\nendstream')]));
    }

    const parts = [Buffer.from('%PDF-1.4\n')];
    let currentOffset = parts[0].length;
    const offsets = [0];

    objects.forEach((objectBuffer, index) => {
        offsets.push(currentOffset);
        const header = Buffer.from(`${index + 1} 0 obj\n`);
        const footer = Buffer.from('\nendobj\n');
        parts.push(header, objectBuffer, footer);
        currentOffset += header.length + objectBuffer.length + footer.length;
    });

    const xrefOffset = currentOffset;
    let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (const offset of offsets.slice(1)) {
        xref += `${String(offset).padStart(10, '0')} 00000 n \n`;
    }
    xref += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    parts.push(Buffer.from(xref, 'ascii'));

    return Buffer.concat(parts);
};
