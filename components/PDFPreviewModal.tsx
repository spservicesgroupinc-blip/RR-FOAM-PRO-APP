import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  FileDown,
  Plus,
  Trash2,
  Pencil,
  FileText,
  ClipboardList,
  Receipt,
} from 'lucide-react';
import {
  CalculatorState,
  CalculationResults,
  EstimateRecord,
  DocumentType,
  formatDocumentNumber,
} from '../types';
import {
  PDFDocumentData,
  PDFLineItem,
  buildPDFDocumentData,
  downloadPDF,
  loadLogoAsDataUrl,
  TERMS_MAP,
  DOC_TYPE_COLORS,
} from '../services/pdfService';

interface PDFPreviewModalProps {
  state: CalculatorState;
  results: CalculationResults;
  record?: EstimateRecord;
  initialDocumentType?: DocumentType;
  onClose: () => void;
}

const PDFPreviewModal: React.FC<PDFPreviewModalProps> = ({
  state,
  results,
  record,
  initialDocumentType,
  onClose,
}) => {
  const [docData, setDocData] = useState<PDFDocumentData | null>(null);
  const [activeTab, setActiveTab] = useState<'header' | 'customer' | 'items' | 'footer'>('items');
  const [isGenerating, setIsGenerating] = useState(false);

  // Build initial data and load logo
  useEffect(() => {
    const init = async () => {
      const data = buildPDFDocumentData(state, results, record, initialDocumentType);
      if (state.companyProfile.logoUrl) {
        const logoData = await loadLogoAsDataUrl(state.companyProfile.logoUrl);
        data.logoDataUrl = logoData;
      }
      setDocData(data);
    };
    init();
  }, [state, results, record, initialDocumentType]);

  const switchDocumentType = useCallback((newType: DocumentType) => {
    setDocData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        documentType: newType,
        documentTitle: newType,
        documentNumber: formatDocumentNumber(prev.documentNumber, newType),
        termsAndConditions: TERMS_MAP[newType],
      };
    });
  }, []);

  const updateField = useCallback(
    (field: keyof PDFDocumentData, value: string) => {
      setDocData((prev) => (prev ? { ...prev, [field]: value } : prev));
    },
    []
  );

  const updateLineItem = useCallback(
    (index: number, field: keyof PDFLineItem, value: string) => {
      setDocData((prev) => {
        if (!prev) return prev;
        const items = [...prev.lineItems];
        items[index] = { ...items[index], [field]: value };
        if (field === 'quantity' || field === 'unitPrice') {
          const qty = parseFloat(field === 'quantity' ? value : items[index].quantity) || 0;
          const price = parseFloat(field === 'unitPrice' ? value : items[index].unitPrice) || 0;
          items[index].total = (qty * price).toFixed(2);
        }
        return { ...prev, lineItems: items };
      });
    },
    []
  );

  const addLineItem = useCallback(() => {
    setDocData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        lineItems: [
          ...prev.lineItems,
          { description: 'New Item', quantity: '1', unit: 'ea', unitPrice: '0.00', total: '0.00' },
        ],
      };
    });
  }, []);

  const removeLineItem = useCallback((index: number) => {
    setDocData((prev) => {
      if (!prev) return prev;
      const items = prev.lineItems.filter((_, i) => i !== index);
      return { ...prev, lineItems: items };
    });
  }, []);

  const recalculateTotals = useCallback(() => {
    setDocData((prev) => {
      if (!prev) return prev;
      const subtotal = prev.lineItems.reduce(
        (sum, item) => sum + (parseFloat(item.total) || 0),
        0
      );
      const taxMatch = prev.taxLabel.match(/([\d.]+)%/);
      const taxRate = taxMatch ? parseFloat(taxMatch[1]) : 0;
      const tax = subtotal * (taxRate / 100);
      const total = subtotal + tax;
      return {
        ...prev,
        subtotal: subtotal.toFixed(2),
        taxAmount: tax.toFixed(2),
        total: total.toFixed(2),
      };
    });
  }, []);

  const getFinalDocData = useCallback((): PDFDocumentData | null => {
    if (!docData) return null;
    const subtotal = docData.lineItems.reduce(
      (sum, item) => sum + (parseFloat(item.total) || 0),
      0
    );
    const taxMatch = docData.taxLabel.match(/([\d.]+)%/);
    const taxRate = taxMatch ? parseFloat(taxMatch[1]) : 0;
    const tax = subtotal * (taxRate / 100);
    const total = subtotal + tax;
    return {
      ...docData,
      subtotal: subtotal.toFixed(2),
      taxAmount: tax.toFixed(2),
      total: total.toFixed(2),
    };
  }, [docData]);

  const handleDownload = async () => {
    const finalData = getFinalDocData();
    if (!finalData) return;
    setIsGenerating(true);
    try {
      downloadPDF(finalData);
    } catch (err) {
      console.error('PDF generation error:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  if (!docData) {
    return (
      <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
        <div className="bg-white rounded-xl p-8 text-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-slate-600">Preparing document...</p>
        </div>
      </div>
    );
  }

  const inputClass =
    'w-full p-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none transition-colors';
  const labelClass = 'block text-xs font-medium text-slate-500 mb-1';
  const sectionClass = 'space-y-3';

  const typeUIConfig: Record<
    DocumentType,
    { bg: string; ring: string; text: string; icon: React.ReactNode; label: string }
  > = {
    [DocumentType.ESTIMATE]: {
      bg: 'bg-blue-50',
      ring: 'ring-blue-400',
      text: 'text-blue-700',
      icon: <FileText className="w-4 h-4" />,
      label: 'Estimate',
    },
    [DocumentType.WORK_ORDER]: {
      bg: 'bg-amber-50',
      ring: 'ring-amber-400',
      text: 'text-amber-700',
      icon: <ClipboardList className="w-4 h-4" />,
      label: 'Work Order',
    },
    [DocumentType.INVOICE]: {
      bg: 'bg-green-50',
      ring: 'ring-green-400',
      text: 'text-green-700',
      icon: <Receipt className="w-4 h-4" />,
      label: 'Invoice',
    },
  };
  const currentTypeUI = typeUIConfig[docData.documentType] || typeUIConfig[DocumentType.ESTIMATE];

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[95vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${currentTypeUI.bg}`}>{currentTypeUI.icon}</div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">PDF Builder</h2>
              <p className="text-xs text-slate-500">
                Creating{' '}
                <span className={`font-semibold ${currentTypeUI.text}`}>
                  {currentTypeUI.label}
                </span>{' '}
                for {docData.customerName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Document Type Selector */}
        <div className="px-6 py-3 border-b border-slate-200 bg-white shrink-0">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
            Document Type
          </p>
          <div className="flex gap-2">
            {(
              [DocumentType.ESTIMATE, DocumentType.WORK_ORDER, DocumentType.INVOICE] as const
            ).map((dt) => {
              const cfg = typeUIConfig[dt];
              const isActive = docData.documentType === dt;
              return (
                <button
                  key={dt}
                  onClick={() => switchDocumentType(dt)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border-2 ${
                    isActive
                      ? `${cfg.bg} ${cfg.text} border-current ring-2 ${cfg.ring} shadow-sm`
                      : 'bg-slate-50 text-slate-400 border-transparent hover:bg-slate-100 hover:text-slate-600'
                  }`}
                >
                  {cfg.icon}
                  {cfg.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 px-6 shrink-0 overflow-x-auto">
          {(['header', 'customer', 'items', 'footer'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab === 'header' && 'Document Info'}
              {tab === 'customer' && 'Customer / Job'}
              {tab === 'items' && 'Line Items'}
              {tab === 'footer' && 'Notes & Terms'}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* HEADER TAB */}
          {activeTab === 'header' && (
            <div className={sectionClass}>
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <Pencil className="w-4 h-4 text-blue-500" /> Document Header
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Document Number</label>
                  <input
                    className={inputClass}
                    value={docData.documentNumber}
                    onChange={(e) => updateField('documentNumber', e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClass}>Date</label>
                  <input
                    className={inputClass}
                    value={docData.documentDate}
                    onChange={(e) => updateField('documentDate', e.target.value)}
                  />
                </div>
              </div>

              {docData.documentType === DocumentType.ESTIMATE && (
                <div>
                  <label className={labelClass}>Valid Until</label>
                  <input
                    className={inputClass}
                    value={docData.validUntil}
                    onChange={(e) => updateField('validUntil', e.target.value)}
                    placeholder="e.g. March 15, 2026"
                  />
                </div>
              )}
              {docData.documentType === DocumentType.WORK_ORDER && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Scheduled Date</label>
                    <input
                      className={inputClass}
                      value={docData.scheduledDate}
                      onChange={(e) => updateField('scheduledDate', e.target.value)}
                      placeholder="e.g. February 20, 2026"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelClass}>Work Scope</label>
                    <textarea
                      className={`${inputClass} min-h-[60px] resize-y`}
                      value={docData.workScope}
                      onChange={(e) => updateField('workScope', e.target.value)}
                      placeholder="Describe the scope of work..."
                    />
                  </div>
                </div>
              )}
              {docData.documentType === DocumentType.INVOICE && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>PO Number</label>
                    <input
                      className={inputClass}
                      value={docData.poNumber}
                      onChange={(e) => updateField('poNumber', e.target.value)}
                      placeholder="Customer PO# (optional)"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Payment Terms</label>
                    <select
                      className={inputClass}
                      value={docData.paymentTerms}
                      onChange={(e) => updateField('paymentTerms', e.target.value)}
                    >
                      <option value="Net 30">Net 30</option>
                      <option value="Net 15">Net 15</option>
                      <option value="Net 60">Net 60</option>
                      <option value="Due on Receipt">Due on Receipt</option>
                      <option value="50/50">50% Deposit / 50% on Completion</option>
                    </select>
                  </div>
                </div>
              )}

              <h4 className="font-medium text-slate-700 mt-4 pt-3 border-t border-slate-100">
                Company Details
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className={labelClass}>Company Name</label>
                  <input
                    className={inputClass}
                    value={docData.companyName}
                    onChange={(e) => updateField('companyName', e.target.value)}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass}>Address</label>
                  <input
                    className={inputClass}
                    value={docData.companyAddress}
                    onChange={(e) => updateField('companyAddress', e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClass}>Phone</label>
                  <input
                    className={inputClass}
                    value={docData.companyPhone}
                    onChange={(e) => updateField('companyPhone', e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClass}>Email</label>
                  <input
                    className={inputClass}
                    value={docData.companyEmail}
                    onChange={(e) => updateField('companyEmail', e.target.value)}
                  />
                </div>
              </div>

              {docData.logoDataUrl && (
                <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <p className="text-xs text-slate-500 mb-2">Company Logo (from Settings)</p>
                  <img src={docData.logoDataUrl} alt="Logo" className="h-12 object-contain" />
                </div>
              )}
            </div>
          )}

          {/* CUSTOMER TAB */}
          {activeTab === 'customer' && (
            <div className={sectionClass}>
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <Pencil className="w-4 h-4 text-blue-500" /> Bill To
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Customer Name</label>
                  <input
                    className={inputClass}
                    value={docData.customerName}
                    onChange={(e) => updateField('customerName', e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClass}>Company</label>
                  <input
                    className={inputClass}
                    value={docData.customerCompany}
                    onChange={(e) => updateField('customerCompany', e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClass}>Address</label>
                  <input
                    className={inputClass}
                    value={docData.customerAddress}
                    onChange={(e) => updateField('customerAddress', e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClass}>City, State ZIP</label>
                  <input
                    className={inputClass}
                    value={docData.customerCityStateZip}
                    onChange={(e) => updateField('customerCityStateZip', e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClass}>Phone</label>
                  <input
                    className={inputClass}
                    value={docData.customerPhone}
                    onChange={(e) => updateField('customerPhone', e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClass}>Email</label>
                  <input
                    className={inputClass}
                    value={docData.customerEmail}
                    onChange={(e) => updateField('customerEmail', e.target.value)}
                  />
                </div>
              </div>

              <h4 className="font-medium text-slate-700 mt-4 pt-3 border-t border-slate-100">
                Job Site
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Job Name</label>
                  <input
                    className={inputClass}
                    value={docData.jobName}
                    onChange={(e) => updateField('jobName', e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClass}>Job Address</label>
                  <input
                    className={inputClass}
                    value={docData.jobAddress}
                    onChange={(e) => updateField('jobAddress', e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* LINE ITEMS TAB */}
          {activeTab === 'items' && (
            <div className={sectionClass}>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                  <Pencil className="w-4 h-4 text-blue-500" /> Line Items
                </h3>
                <button
                  onClick={addLineItem}
                  className="flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" /> Add Item
                </button>
              </div>

              {/* Header Row (desktop) */}
              <div className="hidden sm:grid grid-cols-12 gap-2 text-xs font-medium text-slate-500 uppercase px-1">
                <div className="col-span-4">Description</div>
                <div className="col-span-2">Qty</div>
                <div className="col-span-2">Unit</div>
                <div className="col-span-2">Price</div>
                <div className="col-span-1">Total</div>
                <div className="col-span-1"></div>
              </div>

              {/* Items */}
              <div className="space-y-2">
                {docData.lineItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-12 gap-2 items-center bg-slate-50 rounded-lg p-2 border border-slate-100"
                  >
                    <div className="col-span-12 sm:col-span-4">
                      <input
                        className={`${inputClass} bg-white`}
                        placeholder="Description"
                        value={item.description}
                        onChange={(e) => updateLineItem(idx, 'description', e.target.value)}
                      />
                    </div>
                    <div className="col-span-3 sm:col-span-2">
                      <input
                        className={`${inputClass} bg-white text-center`}
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={(e) => updateLineItem(idx, 'quantity', e.target.value)}
                        onBlur={recalculateTotals}
                      />
                    </div>
                    <div className="col-span-3 sm:col-span-2">
                      <input
                        className={`${inputClass} bg-white text-center`}
                        placeholder="Unit"
                        value={item.unit}
                        onChange={(e) => updateLineItem(idx, 'unit', e.target.value)}
                      />
                    </div>
                    <div className="col-span-3 sm:col-span-2">
                      <input
                        className={`${inputClass} bg-white text-right`}
                        placeholder="Price"
                        value={item.unitPrice}
                        onChange={(e) => updateLineItem(idx, 'unitPrice', e.target.value)}
                        onBlur={recalculateTotals}
                      />
                    </div>
                    <div className="col-span-2 sm:col-span-1 text-right">
                      <span className="text-sm font-medium text-slate-700">${item.total}</span>
                    </div>
                    <div className="col-span-1 text-center">
                      <button
                        onClick={() => {
                          removeLineItem(idx);
                          setTimeout(recalculateTotals, 0);
                        }}
                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Totals Summary */}
              <div className="mt-4 pt-4 border-t border-slate-200 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Subtotal</span>
                  <span className="text-slate-700 font-medium">${docData.subtotal}</span>
                </div>
                <div className="flex justify-between text-sm items-center gap-2">
                  <input
                    className="w-40 p-1.5 border border-slate-200 rounded text-sm text-slate-500"
                    value={docData.taxLabel}
                    onChange={(e) => {
                      updateField('taxLabel', e.target.value);
                      setTimeout(recalculateTotals, 0);
                    }}
                  />
                  <span className="text-slate-700 font-medium">${docData.taxAmount}</span>
                </div>
                <div className="flex justify-between text-base font-bold pt-2 border-t border-slate-200">
                  <span className="text-slate-900">Total</span>
                  <span className="text-blue-700">${docData.total}</span>
                </div>
              </div>
            </div>
          )}

          {/* FOOTER TAB */}
          {activeTab === 'footer' && (
            <div className={sectionClass}>
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <Pencil className="w-4 h-4 text-blue-500" /> Notes & Terms
              </h3>

              <div>
                <label className={labelClass}>Notes</label>
                <textarea
                  className={`${inputClass} min-h-[80px] resize-y`}
                  value={docData.notes}
                  onChange={(e) => updateField('notes', e.target.value)}
                  placeholder="Additional notes for the customer..."
                />
              </div>

              <div>
                <label className={labelClass}>Terms & Conditions</label>
                <textarea
                  className={`${inputClass} min-h-[100px] resize-y`}
                  value={docData.termsAndConditions}
                  onChange={(e) => updateField('termsAndConditions', e.target.value)}
                  placeholder="Payment terms, warranty info, etc."
                />
              </div>

              <div>
                <label className={labelClass}>Thank You Message</label>
                <input
                  className={inputClass}
                  value={docData.thankYouMessage}
                  onChange={(e) => updateField('thankYouMessage', e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <p className="text-xs text-slate-400 text-center sm:text-left">
            Edit any field above, then export to download.
          </p>
          <div className="flex gap-2 sm:gap-3 flex-wrap justify-center">
            <button
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDownload}
              disabled={isGenerating}
              className={`flex items-center gap-2 px-5 py-2.5 text-white text-sm font-bold rounded-lg shadow-lg transition-all disabled:opacity-50 ${
                docData.documentType === DocumentType.ESTIMATE
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : docData.documentType === DocumentType.WORK_ORDER
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              <FileDown className="w-4 h-4" />
              {isGenerating ? 'Generating...' : `Export ${currentTypeUI.label}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PDFPreviewModal;
