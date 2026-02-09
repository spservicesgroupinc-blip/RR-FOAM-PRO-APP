
import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Calendar, 
  User, 
  MapPin, 
  FileText, 
  HardHat, 
  Loader2,
  Wrench,
  Plus,
  Trash2
} from 'lucide-react';
import { CalculatorState, CalculationResults, InvoiceLineItem } from '../types';

interface WorkOrderStageProps {
  state: CalculatorState;
  results: CalculationResults;
  onUpdateState: (field: keyof CalculatorState, value: any) => void;
  onCancel: () => void;
  onConfirm: (lines: InvoiceLineItem[]) => Promise<void>;
}

export const WorkOrderStage: React.FC<WorkOrderStageProps> = ({ 
  state, 
  results, 
  onUpdateState, 
  onCancel, 
  onConfirm 
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [lines, setLines] = useState<InvoiceLineItem[]>([]);

  // Initialize Default Lines on Mount
  useEffect(() => {
      const defaultLines: InvoiceLineItem[] = [];
      
      // 1. Scope Lines
      if (results.wallBdFt > 0) {
          defaultLines.push({
              id: 'wall',
              item: 'Wall Scope',
              description: `Install ${state.wallSettings.type} @ ${state.wallSettings.thickness}" depth.`,
              qty: `${Math.round(results.totalWallArea).toLocaleString()} sqft`,
              amount: 0
          });
      }
      if (results.roofBdFt > 0) {
          defaultLines.push({
              id: 'roof',
              item: 'Roof/Ceiling Scope',
              description: `Install ${state.roofSettings.type} @ ${state.roofSettings.thickness}" depth.`,
              qty: `${Math.round(results.totalRoofArea).toLocaleString()} sqft`,
              amount: 0
          });
      }

      // 2. Material Lines (With Stroke Counts)
      if (results.openCellSets > 0) {
          defaultLines.push({ 
              id: 'oc', 
              item: 'Open Cell Foam', 
              description: `Load Sets (Est. ${results.openCellStrokes.toLocaleString()} Strokes)`, 
              qty: `${results.openCellSets.toFixed(2)} Sets`, 
              amount: 0 
          });
      }
      if (results.closedCellSets > 0) {
          defaultLines.push({ 
              id: 'cc', 
              item: 'Closed Cell Foam', 
              description: `Load Sets (Est. ${results.closedCellStrokes.toLocaleString()} Strokes)`, 
              qty: `${results.closedCellSets.toFixed(2)} Sets`, 
              amount: 0 
          });
      }
      state.inventory.forEach((inv, i) => {
          defaultLines.push({ id: `inv-${i}`, item: inv.name, description: 'Warehouse Item', qty: `${inv.quantity} ${inv.unit}`, amount: 0 });
      });

      // 3. Equipment
      state.jobEquipment.forEach((eq, i) => {
          defaultLines.push({ id: `eq-${i}`, item: `EQUIPMENT: ${eq.name}`, description: 'Ensure Loaded', qty: '1', amount: 0 });
      });

      setLines(defaultLines);
  }, []);

  const updateLine = (index: number, field: keyof InvoiceLineItem, value: any) => {
      const newLines = [...lines];
      newLines[index] = { ...newLines[index], [field]: value };
      setLines(newLines);
  };

  const removeLine = (index: number) => setLines(lines.filter((_, i) => i !== index));
  
  const addLine = () => setLines([...lines, { id: Math.random().toString(), item: 'Custom Item', description: '', qty: '1', amount: 0 }]);

  const handleConfirm = async () => {
      setIsProcessing(true);
      await onConfirm(lines); // Pass updated lines to parent
  };

  return (
    <div className="max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-300 pb-20">
      
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onCancel} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
          <ArrowLeft className="w-6 h-6 text-slate-500" />
        </button>
        <div>
           <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Finalize Work Order</h1>
           <p className="text-slate-500 text-sm font-medium">Review details, customize scope text, and schedule crew.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Main Form Area */}
        <div className="md:col-span-2 space-y-6">
            
            {/* Scheduling Card */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <h2 className="flex items-center gap-2 text-sm font-black text-brand uppercase tracking-widest mb-4">
                   <Calendar className="w-5 h-5" /> Job Scheduling
                </h2>
                <div>
                   <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Scheduled Installation Date</label>
                   <input 
                      type="date" 
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-brand"
                      value={state.scheduledDate || ''}
                      onChange={(e) => onUpdateState('scheduledDate', e.target.value)}
                   />
                </div>
            </div>

            {/* Crew Instructions Card */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <h2 className="flex items-center gap-2 text-sm font-black text-brand uppercase tracking-widest mb-4">
                   <FileText className="w-5 h-5" /> Crew Instructions
                </h2>
                <div>
                   <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Job Notes / Gate Codes / Hazards</label>
                   <textarea 
                      className="w-full h-24 p-4 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 outline-none focus:ring-2 focus:ring-brand resize-none"
                      placeholder="Enter specific details for the crew here..."
                      value={state.jobNotes || ''}
                      onChange={(e) => onUpdateState('jobNotes', e.target.value)}
                   />
                </div>
            </div>

            {/* EDITABLE LINE ITEMS TABLE */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-sm font-black text-brand uppercase tracking-widest flex items-center gap-2">
                        <Wrench className="w-5 h-5" /> Job Scope & Load List (Editable)
                    </h2>
                    <button onClick={addLine} className="text-xs bg-red-50 hover:bg-red-100 text-brand font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
                        <Plus className="w-3 h-3"/> Add Item
                    </button>
                </div>

                <div className="space-y-4">
                    {lines.map((line, idx) => (
                        <div key={idx} className="p-4 bg-slate-50 rounded-xl border border-slate-200 group hover:border-red-200 transition-colors">
                            <div className="flex justify-between items-start mb-2">
                                <input 
                                    type="text" 
                                    className="bg-transparent font-bold text-slate-800 text-sm w-full outline-none placeholder-slate-400"
                                    value={line.item}
                                    onChange={(e) => updateLine(idx, 'item', e.target.value)}
                                    placeholder="Item / Task Name"
                                />
                                <button onClick={() => removeLine(idx)} className="text-slate-300 hover:text-red-500 transition-colors p-1 -mt-1 -mr-1">
                                    <Trash2 className="w-4 h-4"/>
                                </button>
                            </div>
                            
                            <textarea 
                                className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-600 mb-3 outline-none focus:border-brand resize-none h-16 font-medium"
                                value={line.description}
                                onChange={(e) => updateLine(idx, 'description', e.target.value)}
                                placeholder="Instructions for crew..."
                            />

                            <div>
                                <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Qty / Spec</label>
                                <input 
                                    type="text" 
                                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-700 outline-none focus:border-brand"
                                    value={line.qty}
                                    onChange={(e) => updateLine(idx, 'qty', e.target.value)}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

        </div>

        {/* Sidebar Summary */}
        <div className="space-y-6">
            <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-lg">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Customer Info</h3>
                <div className="space-y-4">
                    <div className="flex items-start gap-3">
                        <User className="w-5 h-5 text-brand mt-0.5" />
                        <div>
                            <div className="font-bold text-lg">{state.customerProfile.name || 'Unknown'}</div>
                            <div className="text-sm text-slate-400">{state.customerProfile.phone}</div>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <MapPin className="w-5 h-5 text-brand mt-0.5" />
                        <div className="text-sm font-medium text-slate-300 leading-relaxed">
                            {state.customerProfile.address || 'No Address'}<br/>
                            {state.customerProfile.city} {state.customerProfile.state} {state.customerProfile.zip}
                        </div>
                    </div>
                </div>
            </div>

            <button 
                onClick={handleConfirm}
                disabled={isProcessing}
                className="w-full bg-brand hover:bg-brand-hover text-white font-black py-4 rounded-xl shadow-lg shadow-red-200 transition-all active:scale-95 flex items-center justify-center gap-2 uppercase text-xs tracking-widest disabled:opacity-70 disabled:cursor-not-allowed"
            >
                {isProcessing ? (
                    <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Generating...
                    </>
                ) : (
                    <>
                        <HardHat className="w-5 h-5" /> Generate Work Order
                    </>
                )}
            </button>

            <button 
                onClick={onCancel}
                disabled={isProcessing}
                className="w-full bg-white hover:bg-slate-50 text-slate-500 font-bold py-3 rounded-xl border border-slate-200 transition-all active:scale-95 uppercase text-xs tracking-widest"
            >
                Continue Editing
            </button>
        </div>

      </div>
    </div>
  );
};
