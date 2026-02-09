
import React, { useState, useEffect, useMemo } from 'react';
import { 
  ArrowLeft, 
  Receipt, 
  CheckCircle2, 
  BarChart3,
  Loader2,
  Save,
  MessageSquare,
  Plus,
  Trash2
} from 'lucide-react';
import { CalculatorState, CalculationResults, EstimateRecord, InvoiceLineItem, FoamType } from '../types';
import { useEstimates } from '../hooks/useEstimates';

interface InvoiceStageProps {
  state: CalculatorState;
  results: CalculationResults;
  currentRecord: EstimateRecord | undefined;
  onUpdateState: (field: keyof CalculatorState, value: any) => void;
  onUpdateExpense: (field: string, value: any) => void;
  onCancel: () => void;
  onConfirm: (record?: EstimateRecord) => Promise<void>;
  onMarkPaid?: (id: string) => Promise<void>;
  onSaveAndMarkPaid: (lines: InvoiceLineItem[]) => Promise<void>;
}

export const InvoiceStage: React.FC<InvoiceStageProps> = ({ 
  state, 
  results, 
  currentRecord,
  onUpdateState, 
  onCancel, 
  onConfirm,
  onSaveAndMarkPaid
}) => {
  const { saveEstimate } = useEstimates();
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingAction, setProcessingAction] = useState<'save' | 'pay' | null>(null);
  
  // Local state for editable lines
  const [invoiceLines, setInvoiceLines] = useState<InvoiceLineItem[]>([]);

  const formatCurrency = (val: number) => `$${val.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;

  // Initialize Invoice Data & Lines
  useEffect(() => {
    if (!state.invoiceDate) {
        onUpdateState('invoiceDate', new Date().toISOString().split('T')[0]);
    }
    if (!state.paymentTerms) {
        onUpdateState('paymentTerms', 'Due on Receipt');
    }
    if (currentRecord?.invoiceNumber && !state.invoiceNumber) {
        onUpdateState('invoiceNumber', currentRecord.invoiceNumber);
    }

    // Load or Generate Lines
    if (currentRecord?.invoiceLines && currentRecord.invoiceLines.length > 0) {
        setInvoiceLines(currentRecord.invoiceLines);
    } else {
        generateDefaultLines();
    }
  }, []);

  const generateDefaultLines = () => {
      const lines: InvoiceLineItem[] = [];
      const pricingMode = state.pricingMode;

      // 1. Wall Insulation
      if (results.wallBdFt > 0) {
          const type = state.wallSettings.type;
          let lineCost = 0;
          let descExtra = '';

          if (pricingMode === 'sqft_pricing') {
              lineCost = results.totalWallArea * (state.sqFtRates.wall || 0);
              descExtra = ` @ ${formatCurrency(state.sqFtRates.wall || 0)}/sqft`;
          } else {
              const costPerSet = type === FoamType.OPEN_CELL ? state.costs.openCell : state.costs.closedCell;
              const yieldPerSet = type === FoamType.OPEN_CELL ? state.yields.openCell : state.yields.closedCell;
              const setsNeeded = results.wallBdFt / yieldPerSet;
              lineCost = setsNeeded * costPerSet;
          }

          lines.push({
              id: 'wall',
              item: 'Wall Insulation',
              description: `Spray approximately ${state.wallSettings.thickness} inches of ${type} to walls.${descExtra}`,
              qty: `${Math.round(results.totalWallArea).toLocaleString()} sqft`,
              amount: parseFloat(lineCost.toFixed(2))
          });
      }

      // 2. Roof Insulation
      if (results.roofBdFt > 0) {
          const type = state.roofSettings.type;
          let lineCost = 0;
          let descExtra = '';

          if (pricingMode === 'sqft_pricing') {
              lineCost = results.totalRoofArea * (state.sqFtRates.roof || 0);
              descExtra = ` @ ${formatCurrency(state.sqFtRates.roof || 0)}/sqft`;
          } else {
              const costPerSet = type === FoamType.OPEN_CELL ? state.costs.openCell : state.costs.closedCell;
              const yieldPerSet = type === FoamType.OPEN_CELL ? state.yields.openCell : state.yields.closedCell;
              const setsNeeded = results.roofBdFt / yieldPerSet;
              lineCost = setsNeeded * costPerSet;
          }

          lines.push({
              id: 'roof',
              item: 'Roof Insulation',
              description: `Spray approximately ${state.roofSettings.thickness} inches of ${type} to ceiling/roof deck.${descExtra}`,
              qty: `${Math.round(results.totalRoofArea).toLocaleString()} sqft`,
              amount: parseFloat(lineCost.toFixed(2))
          });
      }

      // 3. Inventory
      state.inventory.forEach((item, idx) => {
          lines.push({
              id: `inv-${idx}`,
              item: item.name,
              description: `Material Supply`,
              qty: `${item.quantity} ${item.unit}`,
              amount: 0 
          });
      });

      // 4. Labor (If Level Pricing)
      if (pricingMode === 'level_pricing' && results.laborCost > 0) {
          lines.push({
              id: 'labor',
              item: 'Labor',
              description: `Application Labor (${state.expenses.manHours} hours)`,
              qty: `${state.expenses.manHours} hrs`,
              amount: parseFloat(results.laborCost.toFixed(2))
          });
      }

      // 5. Fees
      if (state.expenses.tripCharge > 0) {
          lines.push({ id: 'trip', item: 'Trip Charge', description: 'Standard Rate', qty: '1', amount: state.expenses.tripCharge });
      }
      if (state.expenses.fuelSurcharge > 0) {
          lines.push({ id: 'fuel', item: 'Fuel Surcharge', description: 'Distance Adjustment', qty: '1', amount: state.expenses.fuelSurcharge });
      }
      if (state.expenses.other.amount !== 0) {
          lines.push({ id: 'misc', item: state.expenses.other.description || 'Adjustment', description: 'Misc Fee', qty: '1', amount: state.expenses.other.amount });
      }

      setInvoiceLines(lines);
  };

  const updateLine = (index: number, field: keyof InvoiceLineItem, value: any) => {
      const newLines = [...invoiceLines];
      newLines[index] = { ...newLines[index], [field]: value };
      setInvoiceLines(newLines);
  };

  const removeLine = (index: number) => {
      setInvoiceLines(invoiceLines.filter((_, i) => i !== index));
  };

  const addLine = () => {
      setInvoiceLines([...invoiceLines, {
          id: Math.random().toString(36).substr(2,9),
          item: 'Custom Item',
          description: '',
          qty: '1',
          amount: 0
      }]);
  };

  const invoiceTotal = useMemo(() => {
      return invoiceLines.reduce((sum, line) => sum + (Number(line.amount) || 0), 0);
  }, [invoiceLines]);

  const handleMarkPaidClick = async () => {
      if (confirm("Confirm payment receipt? This will finalize the invoice.")) {
          setProcessingAction('pay');
          setIsProcessing(true);
          try {
              // Pass lines directly to parent to handle save and pay in one flow
              await onSaveAndMarkPaid(invoiceLines);
          } catch(e) {
              console.error(e);
              alert("Error processing payment.");
          } finally {
              setIsProcessing(false);
              setProcessingAction(null);
          }
      }
  };

  const handleUpdateClick = async () => {
      setProcessingAction('save');
      setIsProcessing(true);
      
      // Update record with lines first
      // We wait for the save to complete and return the fresh record
      const updatedRecord = await saveEstimate(results, 'Invoiced', {
          invoiceLines: invoiceLines,
          totalValue: invoiceTotal
      }, false);

      if (updatedRecord) {
          await onConfirm(updatedRecord); // Pass fresh record to parent for PDF gen
      }
      
      setIsProcessing(false);
      setProcessingAction(null);
  };

  const invoiceNum = state.invoiceNumber || currentRecord?.invoiceNumber || "DRAFT";
  const isPaid = currentRecord?.status === 'Paid';
  const statusLabel = currentRecord?.status || 'Draft';
  const actuals = currentRecord?.actuals;

  return (
    <div className="max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-300 pb-20">
      
      {/* HEADER ACTION BAR */}
      <div className="mb-8 bg-white border border-slate-200 rounded-3xl shadow-lg shadow-slate-200/50 overflow-hidden sticky top-4 z-30">
          <div className="p-4 md:p-6 flex flex-col md:flex-row justify-between items-center gap-6">
              
              <div className="flex items-center gap-4 w-full md:w-auto">
                  <button onClick={onCancel} className="p-3 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors">
                     <ArrowLeft className="w-5 h-5 text-slate-600" />
                  </button>
                  <div>
                      <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight">Invoice & Finalize</h1>
                      <div className="flex items-center gap-2 mt-1">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${
                              isPaid ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                          }`}>
                              Status: {statusLabel}
                          </span>
                      </div>
                  </div>
              </div>

              {/* ACTION BUTTONS */}
              <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
                  {isPaid ? (
                      <div className="px-8 py-4 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 w-full md:w-auto">
                          <CheckCircle2 className="w-5 h-5" /> Payment Recorded
                      </div>
                  ) : (
                      <>
                        <button 
                            onClick={handleUpdateClick}
                            disabled={isProcessing}
                            className="px-6 py-4 bg-white border-2 border-slate-100 hover:border-slate-300 text-slate-600 rounded-xl font-bold uppercase text-xs tracking-widest flex items-center justify-center gap-2 transition-all w-full md:w-auto"
                        >
                            {processingAction === 'save' ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4" />}
                            Save Invoice
                        </button>
                        <button 
                            onClick={handleMarkPaidClick}
                            disabled={isProcessing}
                            className="px-8 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-emerald-200 transition-all w-full md:w-auto"
                        >
                            {processingAction === 'pay' ? <Loader2 className="w-5 h-5 animate-spin"/> : <CheckCircle2 className="w-5 h-5" />}
                            Mark as Paid
                        </button>
                      </>
                  )}
              </div>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <div className="lg:col-span-2 space-y-6">
            
            {/* CREW REPORT (Reference Only) */}
            {actuals && (
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <h2 className="flex items-center gap-2 text-sm font-black text-slate-900 uppercase tracking-widest mb-4">
                       <BarChart3 className="w-5 h-5 text-brand" /> Crew Actuals (Reference)
                    </h2>
                    <div className="flex gap-4 text-xs font-bold text-slate-600 mb-4">
                        <div className="bg-slate-50 px-3 py-2 rounded-lg border border-slate-100">Labor: <span className="text-slate-900">{actuals.laborHours} hrs</span></div>
                        <div className="bg-slate-50 px-3 py-2 rounded-lg border border-slate-100">OC: <span className="text-slate-900">{actuals.openCellSets} sets</span></div>
                        <div className="bg-slate-50 px-3 py-2 rounded-lg border border-slate-100">CC: <span className="text-slate-900">{actuals.closedCellSets} sets</span></div>
                    </div>
                    {actuals.notes && (
                        <div className="text-sm bg-amber-50 text-amber-900 p-3 rounded-xl border border-amber-100 flex gap-2">
                            <MessageSquare className="w-4 h-4 shrink-0 mt-0.5" /> 
                            <p className="italic">"{actuals.notes}"</p>
                        </div>
                    )}
                </div>
            )}

            {/* INVOICE SETTINGS */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <h2 className="flex items-center gap-2 text-sm font-black text-sky-600 uppercase tracking-widest mb-4">
                   <Receipt className="w-5 h-5" /> Invoice Details
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Invoice #</label>
                        <input 
                            type="text"
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-sky-500"
                            value={invoiceNum}
                            onChange={(e) => onUpdateState('invoiceNumber', e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Date</label>
                        <input 
                            type="date" 
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-sky-500"
                            value={state.invoiceDate || ''}
                            onChange={(e) => onUpdateState('invoiceDate', e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Terms</label>
                        <select 
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-sky-500"
                            value={state.paymentTerms || 'Due on Receipt'}
                            onChange={(e) => onUpdateState('paymentTerms', e.target.value)}
                        >
                            <option value="Due on Receipt">Due on Receipt</option>
                            <option value="Net 15">Net 15</option>
                            <option value="Net 30">Net 30</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* EDITABLE LINE ITEMS TABLE */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-sm font-black text-sky-600 uppercase tracking-widest">Line Items (Editable)</h2>
                    <button onClick={addLine} className="text-xs bg-sky-50 hover:bg-sky-100 text-sky-700 font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
                        <Plus className="w-3 h-3"/> Add Item
                    </button>
                </div>

                <div className="space-y-4">
                    {invoiceLines.map((line, idx) => (
                        <div key={idx} className="p-4 bg-slate-50 rounded-xl border border-slate-200 group hover:border-sky-300 transition-colors">
                            <div className="flex justify-between items-start mb-2">
                                <input 
                                    type="text" 
                                    className="bg-transparent font-bold text-slate-800 text-sm w-full outline-none placeholder-slate-400"
                                    value={line.item}
                                    onChange={(e) => updateLine(idx, 'item', e.target.value)}
                                    placeholder="Item Name"
                                />
                                <button onClick={() => removeLine(idx)} className="text-slate-300 hover:text-red-500 transition-colors p-1 -mt-1 -mr-1">
                                    <Trash2 className="w-4 h-4"/>
                                </button>
                            </div>
                            
                            <textarea 
                                className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-600 mb-3 outline-none focus:border-sky-400 resize-none h-16 font-medium"
                                value={line.description}
                                onChange={(e) => updateLine(idx, 'description', e.target.value)}
                                placeholder="Description text for PDF..."
                            />

                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Qty / Area</label>
                                    <input 
                                        type="text" 
                                        className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-700 outline-none focus:border-sky-400"
                                        value={line.qty}
                                        onChange={(e) => updateLine(idx, 'qty', e.target.value)}
                                    />
                                </div>
                                <div className="w-32">
                                    <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Amount ($)</label>
                                    <input 
                                        type="number" 
                                        className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-900 text-right outline-none focus:border-sky-400"
                                        value={line.amount}
                                        onChange={(e) => updateLine(idx, 'amount', parseFloat(e.target.value))}
                                    />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

        </div>

        {/* SUMMARY COLUMN */}
        <div className="space-y-6">
            <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-lg sticky top-28">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Invoice Total</h3>
                <div className="space-y-2 mb-4">
                    {invoiceLines.map((line, i) => (
                        <div key={i} className="flex justify-between text-xs opacity-80">
                            <span className="truncate max-w-[150px]">{line.item}</span>
                            <span>${(line.amount || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                        </div>
                    ))}
                </div>
                <div className="border-t border-slate-700 pt-4 mt-2">
                    <div className="flex justify-between text-2xl">
                        <span className="font-bold">Total Due</span>
                        <span className="font-black text-sky-400">${invoiceTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                    </div>
                </div>
                <p className="text-[10px] text-slate-500 mt-4 text-center">
                    Editing line items above updates this total automatically.
                </p>
            </div>
        </div>

      </div>
    </div>
  );
};
