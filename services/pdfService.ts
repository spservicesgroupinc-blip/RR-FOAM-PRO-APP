import jsPDF from 'jspdf';
import {
  CalculatorState,
  CalculationResults,
  EstimateRecord,
  CustomerProfile,
  DocumentType,
  FoamType,
  statusToDocumentType,
  formatDocumentNumber,
} from '../types';

// ============================================================
// Types for editable PDF sections
// ============================================================
export interface PDFLineItem {
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  total: string;
}

export interface PDFDocumentData {
  // Header
  documentType: DocumentType;
  documentTitle: string;
  documentNumber: string;
  documentDate: string;

  // Company info
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  logoDataUrl: string | null;

  // Customer / Bill-To
  customerName: string;
  customerCompany: string;
  customerAddress: string;
  customerCityStateZip: string;
  customerPhone: string;
  customerEmail: string;

  // Job info
  jobName: string;
  jobAddress: string;

  // Line items
  lineItems: PDFLineItem[];

  // Totals
  subtotal: string;
  taxLabel: string;
  taxAmount: string;
  total: string;

  // Footer
  notes: string;
  termsAndConditions: string;
  thankYouMessage: string;

  // Type-specific fields
  validUntil: string;
  poNumber: string;
  paymentTerms: string;
  workScope: string;
  scheduledDate: string;
}

// ============================================================
// Terms & color config per document type
// ============================================================
export const TERMS_MAP: Record<DocumentType, string> = {
  [DocumentType.ESTIMATE]:
    'This estimate is valid for 30 days from the date above. Prices are subject to change after expiration. A signed acceptance is required to proceed.',
  [DocumentType.WORK_ORDER]:
    'Work will be performed according to the specifications outlined above. Any changes to scope must be approved in writing and may affect pricing.',
  [DocumentType.INVOICE]:
    'Payment is due within 30 days of invoice date. Late payments may be subject to a 1.5% monthly finance charge.',
};

export const DOC_TYPE_COLORS: Record<
  DocumentType,
  { brand: [number, number, number]; label: string }
> = {
  [DocumentType.ESTIMATE]: { brand: [30, 64, 175], label: 'blue' },
  [DocumentType.WORK_ORDER]: { brand: [180, 83, 9], label: 'amber' },
  [DocumentType.INVOICE]: { brand: [22, 163, 74], label: 'green' },
};

// ============================================================
// Build default document data from Foam Pro's types
// ============================================================
export const buildPDFDocumentData = (
  state: CalculatorState,
  results: CalculationResults,
  record: EstimateRecord | undefined,
  overrideType?: DocumentType
): PDFDocumentData => {
  const customer = record ? record.customer : state.customerProfile;
  const status = record?.status || 'Draft';
  const docType = overrideType ?? statusToDocumentType(status as EstimateRecord['status']);

  // Build line items from custom lines or auto-generate
  const lineItems = buildLineItems(state, results, record, docType);

  // Compute subtotal from items
  const subtotal = lineItems.reduce((sum, li) => sum + (parseFloat(li.total) || 0), 0);
  const taxRate = 0; // Foam Pro doesn't have tax on estimates — keep at 0 or make configurable
  const tax = subtotal * (taxRate / 100);
  const total = subtotal + tax;

  const displayDate = docType === DocumentType.INVOICE && record?.invoiceDate
    ? new Date(record.invoiceDate)
    : new Date(record?.date || Date.now());

  const validDate = new Date(displayDate);
  validDate.setDate(validDate.getDate() + 30);

  const baseNumber = record?.invoiceNumber || record?.id?.substring(0, 8).toUpperCase() || String(Math.floor(Math.random() * 10000 + 1000));

  const company = state.companyProfile;
  const companyAddr = [company.addressLine1, company.addressLine2]
    .filter(Boolean)
    .join(', ');
  const fullAddr = [companyAddr, `${company.city} ${company.state} ${company.zip}`.trim()]
    .filter(Boolean)
    .join(', ');

  return {
    documentType: docType,
    documentTitle: docType,
    documentNumber: formatDocumentNumber(baseNumber, docType),
    documentDate: displayDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
    companyName: company.companyName,
    companyAddress: fullAddr,
    companyPhone: company.phone,
    companyEmail: company.email,
    logoDataUrl: null,
    customerName: customer?.name || 'N/A',
    customerCompany: '',
    customerAddress: customer?.address || '',
    customerCityStateZip: customer
      ? `${customer.city}, ${customer.state} ${customer.zip}`.trim()
      : '',
    customerPhone: customer?.phone || '',
    customerEmail: customer?.email || '',
    jobName: 'Spray Foam Insulation',
    jobAddress: customer?.address || '',
    lineItems,
    subtotal: subtotal.toFixed(2),
    taxLabel: `Tax (${taxRate}%)`,
    taxAmount: tax.toFixed(2),
    total: total.toFixed(2),
    notes: record?.notes || state.jobNotes || '',
    termsAndConditions: TERMS_MAP[docType],
    thankYouMessage: 'Thank you for your business!',
    validUntil: validDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
    poNumber: '',
    paymentTerms: record?.paymentTerms || state.paymentTerms || 'Net 30',
    workScope: `Spray foam insulation per specifications`,
    scheduledDate: record?.scheduledDate || state.scheduledDate || '',
  };
};

// Build line items from record custom lines or auto-generate from calc results
function buildLineItems(
  state: CalculatorState,
  results: CalculationResults,
  record: EstimateRecord | undefined,
  docType: DocumentType
): PDFLineItem[] {
  // Check for saved custom lines
  const customLines =
    docType === DocumentType.INVOICE
      ? record?.invoiceLines
      : docType === DocumentType.WORK_ORDER
      ? record?.workOrderLines
      : record?.estimateLines;

  if (customLines && customLines.length > 0) {
    return customLines.map((line) => ({
      description: `${line.item}${line.description ? ' — ' + line.description : ''}`,
      quantity: line.qty || '1',
      unit: 'ea',
      unitPrice: String(Number(line.amount) || 0),
      total: String(Number(line.amount) || 0),
    }));
  }

  // Auto-generate from calculation results
  const items: PDFLineItem[] = [];
  const wallSettings = record ? record.wallSettings : state.wallSettings;
  const roofSettings = record ? record.roofSettings : state.roofSettings;
  const pricingMode = record?.pricingMode || state.pricingMode;
  const sqFtRates = record?.sqFtRates || state.sqFtRates;

  if (results.wallBdFt > 0) {
    let lineCost = 0;
    if (pricingMode === 'sqft_pricing') {
      lineCost = results.totalWallArea * (sqFtRates.wall || 0);
    } else {
      const costPerSet =
        wallSettings.type === FoamType.OPEN_CELL
          ? state.costs.openCell
          : state.costs.closedCell;
      const yieldPerSet =
        wallSettings.type === FoamType.OPEN_CELL
          ? state.yields.openCell
          : state.yields.closedCell;
      lineCost = (results.wallBdFt / yieldPerSet) * costPerSet;
    }
    items.push({
      description: `Wall Insulation — ${wallSettings.thickness}" ${wallSettings.type}`,
      quantity: String(Math.round(results.totalWallArea)),
      unit: 'sqft',
      unitPrice: state.showPricing ? lineCost.toFixed(2) : '0.00',
      total: state.showPricing ? lineCost.toFixed(2) : '0.00',
    });
  }

  if (results.roofBdFt > 0) {
    let lineCost = 0;
    if (pricingMode === 'sqft_pricing') {
      lineCost = results.totalRoofArea * (sqFtRates.roof || 0);
    } else {
      const costPerSet =
        roofSettings.type === FoamType.OPEN_CELL
          ? state.costs.openCell
          : state.costs.closedCell;
      const yieldPerSet =
        roofSettings.type === FoamType.OPEN_CELL
          ? state.yields.openCell
          : state.yields.closedCell;
      lineCost = (results.roofBdFt / yieldPerSet) * costPerSet;
    }
    items.push({
      description: `Roof/Ceiling Insulation — ${roofSettings.thickness}" ${roofSettings.type}`,
      quantity: String(Math.round(results.totalRoofArea)),
      unit: 'sqft',
      unitPrice: state.showPricing ? lineCost.toFixed(2) : '0.00',
      total: state.showPricing ? lineCost.toFixed(2) : '0.00',
    });
  }

  // Inventory items
  const inventory = record ? record.materials.inventory : state.inventory;
  inventory.forEach((item) => {
    items.push({
      description: item.name,
      quantity: String(item.quantity),
      unit: item.unit,
      unitPrice: '0.00',
      total: '0.00',
    });
  });

  // Labor
  if (pricingMode === 'level_pricing' && results.laborCost > 0 && state.showPricing) {
    items.push({
      description: `Application Labor (${state.expenses.manHours} hours)`,
      quantity: '1',
      unit: 'job',
      unitPrice: results.laborCost.toFixed(2),
      total: results.laborCost.toFixed(2),
    });
  }

  // Trip & fuel & other
  if (state.expenses.tripCharge > 0 && state.showPricing) {
    items.push({
      description: 'Trip Charge',
      quantity: '1',
      unit: 'ea',
      unitPrice: state.expenses.tripCharge.toFixed(2),
      total: state.expenses.tripCharge.toFixed(2),
    });
  }
  if (state.expenses.fuelSurcharge > 0 && state.showPricing) {
    items.push({
      description: 'Fuel Surcharge',
      quantity: '1',
      unit: 'ea',
      unitPrice: state.expenses.fuelSurcharge.toFixed(2),
      total: state.expenses.fuelSurcharge.toFixed(2),
    });
  }
  if (state.expenses.other.amount !== 0 && state.showPricing) {
    items.push({
      description: state.expenses.other.description || 'Adjustment',
      quantity: '1',
      unit: 'ea',
      unitPrice: state.expenses.other.amount.toFixed(2),
      total: state.expenses.other.amount.toFixed(2),
    });
  }

  return items;
}

// ============================================================
// Generate the actual PDF from PDFDocumentData
// ============================================================
export const generatePDFFromData = (data: PDFDocumentData): jsPDF => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 50;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const typeColors =
    DOC_TYPE_COLORS[data.documentType] || DOC_TYPE_COLORS[DocumentType.ESTIMATE];
  const brandColor: [number, number, number] = typeColors.brand;
  const darkText: [number, number, number] = [30, 41, 59];
  const medText: [number, number, number] = [100, 116, 139];
  const lightBg: [number, number, number] = [248, 250, 252];
  const borderColor: [number, number, number] = [226, 232, 240];

  const checkPageBreak = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - 60) {
      doc.addPage();
      y = margin;
    }
  };

  // ── HEADER ──
  doc.setFillColor(...brandColor);
  doc.rect(0, 0, pageWidth, 6, 'F');
  y = 30;

  if (data.logoDataUrl) {
    try {
      doc.addImage(data.logoDataUrl, 'PNG', margin, y, 120, 50);
      y += 60;
    } catch {
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...darkText);
      doc.text(data.companyName, margin, y + 18);
      y += 30;
    }
  } else {
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...darkText);
    doc.text(data.companyName, margin, y + 18);
    y += 30;
  }

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...medText);
  const contactLine = [data.companyAddress, data.companyPhone, data.companyEmail]
    .filter(Boolean)
    .join('  |  ');
  doc.text(contactLine, margin, y);
  y += 20;

  // Document type badge (right)
  const badgeWidth = 160;
  const badgeX = pageWidth - margin - badgeWidth;
  doc.setFillColor(...brandColor);
  doc.roundedRect(badgeX, 30, badgeWidth, 36, 3, 3, 'F');
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(data.documentTitle, badgeX + badgeWidth / 2, 54, { align: 'center' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...medText);
  doc.text(`#${data.documentNumber}`, badgeX + badgeWidth, 80, { align: 'right' });
  doc.text(data.documentDate, badgeX + badgeWidth, 92, { align: 'right' });

  y += 10;
  doc.setDrawColor(...borderColor);
  doc.setLineWidth(1);
  doc.line(margin, y, pageWidth - margin, y);
  y += 20;

  // ── BILL TO / JOB SITE ──
  const colWidth = contentWidth / 2 - 10;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...brandColor);
  doc.text('BILL TO', margin, y);
  doc.text('JOB SITE', margin + colWidth + 20, y);

  y += 14;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...darkText);
  doc.text(data.customerName, margin, y);
  doc.text(data.jobName, margin + colWidth + 20, y);

  y += 14;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...medText);

  if (data.customerCompany) {
    doc.text(data.customerCompany, margin, y);
    y += 12;
  }
  let leftY = y;
  if (data.customerAddress) {
    doc.text(data.customerAddress, margin, leftY);
    leftY += 12;
  }
  if (data.customerCityStateZip) {
    doc.text(data.customerCityStateZip, margin, leftY);
    leftY += 12;
  }
  if (data.customerPhone) {
    doc.text(data.customerPhone, margin, leftY);
    leftY += 12;
  }
  if (data.customerEmail) {
    doc.text(data.customerEmail, margin, leftY);
    leftY += 12;
  }

  let rightY = y;
  if (data.jobAddress) {
    doc.text(data.jobAddress, margin + colWidth + 20, rightY);
    rightY += 12;
  }

  y = Math.max(leftY, rightY) + 20;

  // ── LINE ITEMS TABLE ──
  checkPageBreak(80);

  const colDesc = margin;
  const colQty = margin + contentWidth * 0.5;
  const colUnit = margin + contentWidth * 0.6;
  const colPrice = margin + contentWidth * 0.73;
  const colTotal = margin + contentWidth * 0.87;

  doc.setFillColor(...lightBg);
  doc.rect(margin, y, contentWidth, 22, 'F');
  doc.setDrawColor(...borderColor);
  doc.rect(margin, y, contentWidth, 22, 'S');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...medText);
  doc.text('DESCRIPTION', colDesc + 8, y + 14);
  doc.text('QTY', colQty + 4, y + 14);
  doc.text('UNIT', colUnit + 4, y + 14);
  doc.text('PRICE', colPrice + 4, y + 14);
  doc.text('TOTAL', colTotal + 4, y + 14);

  y += 22;

  doc.setFontSize(9);
  data.lineItems.forEach((item, idx) => {
    checkPageBreak(30);
    const rowH = 24;

    if (idx % 2 === 0) {
      doc.setFillColor(255, 255, 255);
    } else {
      doc.setFillColor(252, 252, 253);
    }
    doc.rect(margin, y, contentWidth, rowH, 'F');
    doc.setDrawColor(...borderColor);
    doc.line(margin, y + rowH, pageWidth - margin, y + rowH);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...darkText);
    const maxDescWidth = colQty - colDesc - 16;
    const descText = doc.splitTextToSize(item.description, maxDescWidth);
    doc.text(descText[0] || '', colDesc + 8, y + 15);

    doc.setTextColor(...medText);
    doc.text(item.quantity, colQty + 4, y + 15);
    doc.text(item.unit, colUnit + 4, y + 15);

    doc.setTextColor(...darkText);
    doc.text(`$${item.unitPrice}`, colPrice + 4, y + 15);
    doc.setFont('helvetica', 'bold');
    doc.text(`$${item.total}`, colTotal + 4, y + 15);

    y += rowH;
  });

  // ── TOTALS ──
  y += 10;
  checkPageBreak(80);

  const totalsX = margin + contentWidth * 0.6;
  const totalsValueX = pageWidth - margin;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...medText);
  doc.text('Subtotal', totalsX, y + 14);
  doc.setTextColor(...darkText);
  doc.text(`$${data.subtotal}`, totalsValueX, y + 14, { align: 'right' });

  y += 20;
  doc.setTextColor(...medText);
  doc.text(data.taxLabel, totalsX, y + 14);
  doc.setTextColor(...darkText);
  doc.text(`$${data.taxAmount}`, totalsValueX, y + 14, { align: 'right' });

  y += 24;
  doc.setFillColor(...brandColor);
  doc.roundedRect(totalsX - 8, y, pageWidth - margin - totalsX + 8, 30, 3, 3, 'F');
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('TOTAL', totalsX + 4, y + 20);
  doc.text(`$${data.total}`, totalsValueX - 8, y + 20, { align: 'right' });

  y += 50;

  // ── NOTES ──
  if (data.notes) {
    checkPageBreak(60);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...brandColor);
    doc.text('NOTES', margin, y);
    y += 12;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...medText);
    const noteLines = doc.splitTextToSize(data.notes, contentWidth);
    doc.text(noteLines, margin, y);
    y += noteLines.length * 12 + 10;
  }

  // ── TERMS ──
  if (data.termsAndConditions) {
    checkPageBreak(60);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...brandColor);
    doc.text('TERMS & CONDITIONS', margin, y);
    y += 12;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...medText);
    const termLines = doc.splitTextToSize(data.termsAndConditions, contentWidth);
    doc.text(termLines, margin, y);
    y += termLines.length * 10 + 16;
  }

  // ── TYPE-SPECIFIC SECTIONS ──
  if (data.documentType === DocumentType.ESTIMATE && data.validUntil) {
    checkPageBreak(60);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...brandColor);
    doc.text('ESTIMATE VALIDITY', margin, y);
    y += 12;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...medText);
    doc.text(`This estimate is valid until ${data.validUntil}.`, margin, y);
    y += 20;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...brandColor);
    doc.text('ACCEPTANCE', margin, y);
    y += 14;
    doc.setDrawColor(...borderColor);
    doc.line(margin, y + 2, margin + contentWidth * 0.45, y + 2);
    doc.line(margin + contentWidth * 0.55, y + 2, pageWidth - margin, y + 2);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...medText);
    doc.text('Signature', margin, y + 14);
    doc.text('Date', margin + contentWidth * 0.55, y + 14);
    y += 30;
  }

  if (data.documentType === DocumentType.WORK_ORDER) {
    checkPageBreak(60);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...brandColor);
    doc.text('WORK SCOPE', margin, y);
    y += 12;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...medText);
    const scopeLines = doc.splitTextToSize(
      data.workScope || 'Per specifications above.',
      contentWidth
    );
    doc.text(scopeLines, margin, y);
    y += scopeLines.length * 12 + 6;
    if (data.scheduledDate) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...darkText);
      doc.text(`Scheduled: ${data.scheduledDate}`, margin, y);
      y += 16;
    }
    y += 6;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...brandColor);
    doc.text('AUTHORIZATION', margin, y);
    y += 14;
    doc.setDrawColor(...borderColor);
    doc.line(margin, y + 2, margin + contentWidth * 0.45, y + 2);
    doc.line(margin + contentWidth * 0.55, y + 2, pageWidth - margin, y + 2);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...medText);
    doc.text('Authorized By', margin, y + 14);
    doc.text('Date', margin + contentWidth * 0.55, y + 14);
    y += 30;
  }

  if (data.documentType === DocumentType.INVOICE) {
    checkPageBreak(50);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...brandColor);
    doc.text('PAYMENT INFORMATION', margin, y);
    y += 14;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...darkText);
    if (data.poNumber) {
      doc.text(`PO Number: ${data.poNumber}`, margin, y);
      y += 14;
    }
    doc.text(`Payment Terms: ${data.paymentTerms || 'Net 30'}`, margin, y);
    y += 14;
    doc.setTextColor(...medText);
    doc.text('Please reference the invoice number on all payments.', margin, y);
    y += 20;
  }

  // ── THANK YOU ──
  if (data.thankYouMessage) {
    checkPageBreak(40);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bolditalic');
    doc.setTextColor(...brandColor);
    doc.text(data.thankYouMessage, pageWidth / 2, y, { align: 'center' });
    y += 20;
  }

  // ── FOOTER BAR ──
  doc.setFillColor(...brandColor);
  doc.rect(0, pageHeight - 20, pageWidth, 20, 'F');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(255, 255, 255);
  doc.text(
    `${data.companyName}  •  ${data.companyPhone}  •  ${data.companyEmail}`,
    pageWidth / 2,
    pageHeight - 8,
    { align: 'center' }
  );

  return doc;
};

// ============================================================
// Convenience exports
// ============================================================
export const downloadPDF = (data: PDFDocumentData): void => {
  const doc = generatePDFFromData(data);
  const filename = `${data.documentTitle.replace(/\s+/g, '_')}_${data.documentNumber}.pdf`;
  doc.save(filename);
};

export const generatePDFBlob = (data: PDFDocumentData): Blob => {
  const doc = generatePDFFromData(data);
  return doc.output('blob');
};

export const getPDFFilename = (data: PDFDocumentData): string => {
  return `${data.documentTitle.replace(/\s+/g, '_')}_${data.documentNumber}.pdf`;
};

export const loadLogoAsDataUrl = (url: string): Promise<string | null> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
};
