
import React, { useState, useEffect, useMemo } from 'react';
import { 
  ArrowLeft, 
  FileText, 
  Loader2,
  Save,
  Plus,
  Trash2,
  Download
} from 'lucide-react';
import { CalculatorState, CalculationResults, EstimateRecord, InvoiceLineItem, FoamType } from '../types';
import { useEstimates } from '../hooks/useEstimates';

interface EstimateStageProps {
  state: CalculatorState;
  results: CalculationResults;
  currentRecord: EstimateRecord | undefined;
  onUpdateState: (field: keyof CalculatorState, value: any) => void;
  onCancel: () => void;
  onConfirm: (record: EstimateRecord, shouldPrint: boolean) => Promise<void>;
}

export const EstimateStage: React.FC<EstimateStageProps> = ({ 
  state, 
  results, 
  currentRecord,
  onUpdateState, 
  onCancel, 
  onConfirm
}) => {
  const { saveEstimate } = useEstimates();
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionType, setActionType] = useState<'save' | 'print' | null>(null);
  
  // Local state for editable lines
  const [estimateLines, setEstimateLines] = useState<InvoiceLineItem[]>([]);

  const formatCurrency = (val: number) => `$${val.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;

  // Initialize Data & Lines
  useEffect(() => {
    // Load or Generate Lines
    if (currentRecord?.estimateLines && currentRecord.estimateLines.length > 0) {
        setEstimateLines(currentRecord.estimateLines);
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

      setEstimateLines(lines);
  };

  const updateLine = (index: number, field: keyof InvoiceLineItem, value: any) => {
      const newLines = [...estimateLines];
      newLines[index] = { ...newLines[index], [field]: value };
      setEstimateLines(newLines);
  };

  const removeLine = (index: number) => {
      setEstimateLines(estimateLines.filter((_, i) => i !== index));
  };

  const addLine = () => {
      setEstimateLines([...estimateLines, {
          id: Math.random().toString(36).substr(2,9),
          item: 'Custom Item',
          description: '',
          qty: '1',
          amount: 0
      }]);
  };

  const estimateTotal = useMemo(() => {
      return estimateLines.reduce((sum, line) => sum + (Number(line.amount) || 0), 0);
  }, [estimateLines]);

  const handleAction = async (type: 'save' | 'print') => {
      setActionType(type);
      setIsProcessing(true);
      
      // Update record with lines first
      const updatedRecord = await saveEstimate(results, undefined, {
          estimateLines: estimateLines,
          totalValue: estimateTotal
      }, false);

      if (updatedRecord) {
          await onConfirm(updatedRecord, type === 'print');
      }
      
      setIsProcessing(false);
      setActionType(null);
  };

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
                      <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight">Finalize Estimate</h1>
                      <p className="text-slate-500 text-sm font-medium">Review and edit the customer-facing proposal.</p>
                  </div>
              </div>

              {/* ACTION BUTTONS */}
              <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
                  <button 
                      onClick={() => handleAction('save')}
                      disabled={isProcessing}
                      className="px-6 py-4 bg-white border-2 border-slate-100 hover:border-slate-300 text-slate-600 rounded-xl font-bold uppercase text-xs tracking-widest flex items-center justify-center gap-2 transition-all w-full md:w-auto"
                  >
                      {actionType === 'save' ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4" />}
                      Save Estimate
                  </button>
                  <button 
                      onClick={() => handleAction('print')}
                      disabled={isProcessing}
                      className="px-8 py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-slate-200 transition-all w-full md:w-auto"
                  >
                      {actionType === 'print' ? <Loader2 className="w-5 h-5 animate-spin"/> : <Download className="w-5 h-5" />}
                      Save & PDF
                  </button>
              </div>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <div className="lg:col-span-2 space-y-6">
            
            {/* EDITABLE LINE ITEMS TABLE */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                        <FileText className="w-4 h-4" /> Estimate Line Items
                    </h2>
                    <button onClick={addLine} className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
                        <Plus className="w-3 h-3"/> Add Item
                    </button>
                </div>

                <div className="space-y-4">
                    {estimateLines.map((line, idx) => (
                        <div key={idx} className="p-4 bg-slate-50 rounded-xl border border-slate-200 group hover:border-slate-300 transition-colors">
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
                                className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-600 mb-3 outline-none focus:border-brand resize-none h-16 font-medium"
                                value={line.description}
                                onChange={(e) => updateLine(idx, 'description', e.target.value)}
                                placeholder="Description text for PDF..."
                            />

                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Qty / Area</label>
                                    <input 
                                        type="text" 
                                        className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-700 outline-none focus:border-brand"
                                        value={line.qty}
                                        onChange={(e) => updateLine(idx, 'qty', e.target.value)}
                                    />
                                </div>
                                <div className="w-32">
                                    <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Amount ($)</label>
                                    <input 
                                        type="number" 
                                        className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-900 text-right outline-none focus:border-brand"
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
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Estimate Total</h3>
                <div className="space-y-2 mb-4">
                    {estimateLines.map((line, i) => (
                        <div key={i} className="flex justify-between text-xs opacity-80">
                            <span className="truncate max-w-[150px]">{line.item}</span>
                            <span>${(line.amount || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                        </div>
                    ))}
                </div>
                <div className="border-t border-slate-700 pt-4 mt-2">
                    <div className="flex justify-between text-2xl">
                        <span className="font-bold">Total</span>
                        <span className="font-black text-brand">${estimateTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
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
