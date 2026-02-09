
import React from 'react';
import { 
  Building2, 
  Box, 
  Save, 
  CheckCircle2, 
  Receipt, 
  DollarSign,
  Plus,
  Trash2,
  HardHat,
  ArrowRight,
  Calculator as CalculatorIcon,
  ClipboardList,
  Calendar,
  Pencil,
  Wrench,
  FileCheck
} from 'lucide-react';
import { 
  CalculatorState, 
  CalculationMode, 
  FoamType, 
  CalculationResults,
  EstimateRecord,
  EquipmentItem,
  AreaType,
  AdditionalArea
} from '../types';
import { JobProgress } from './JobProgress';

interface CalculatorProps {
  state: CalculatorState;
  results: CalculationResults;
  editingEstimateId: string | null;
  onInputChange: (field: keyof CalculatorState, value: any) => void;
  onSettingsChange: (category: 'wallSettings' | 'roofSettings', field: string, value: any) => void;
  onCustomerSelect: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onInventoryUpdate: (id: string, field: string, value: any) => void;
  onAddInventory: () => void;
  onRemoveInventory: (id: string) => void;
  onSaveEstimate: (status?: EstimateRecord['status']) => void;
  onGeneratePDF: () => void;
  onStageWorkOrder: () => void;
  onStageInvoice: () => void;
  onStageEstimate: () => void; // New Handler
  onAddNewCustomer: () => void;
  onMarkPaid?: (id: string) => void; 
  onCreateWarehouseItem?: (name: string, unit: string, cost: number) => void;
}

export const Calculator: React.FC<CalculatorProps> = ({
  state,
  results,
  editingEstimateId,
  onInputChange,
  onSettingsChange,
  onCustomerSelect,
  onInventoryUpdate,
  onAddInventory,
  onRemoveInventory,
  onSaveEstimate,
  onGeneratePDF,
  onStageWorkOrder,
  onStageInvoice,
  onStageEstimate,
  onAddNewCustomer,
  onMarkPaid,
  onCreateWarehouseItem
}) => {

  const currentRecord = editingEstimateId ? state.savedEstimates.find(e => e.id === editingEstimateId) : null;
  const currentStatus = currentRecord?.status || 'Draft';
  const isJobCompleted = currentRecord?.executionStatus === 'Completed';
  
  const activeScheduledDate = currentRecord?.scheduledDate || state.scheduledDate;

  // Equipment Helpers
  const addEquipmentToJob = (eqId: string) => {
      const tool = state.equipment.find(e => e.id === eqId);
      if (tool) {
          // Avoid duplicates
          if (state.jobEquipment.find(j => j.id === tool.id)) return;
          onInputChange('jobEquipment', [...state.jobEquipment, tool]);
      }
  };

  const removeEquipmentFromJob = (eqId: string) => {
      onInputChange('jobEquipment', state.jobEquipment.filter(e => e.id !== eqId));
  };

  // Additional Area Helpers
  const addArea = () => {
      const newArea: AdditionalArea = { type: AreaType.WALL, length: 0, width: 0 };
      // Ensure additionalAreas exists
      const currentAreas = state.additionalAreas || [];
      onInputChange('additionalAreas', [...currentAreas, newArea]);
  };

  const removeArea = (index: number) => {
      const updated = state.additionalAreas.filter((_, i) => i !== index);
      onInputChange('additionalAreas', updated);
  };

  const updateArea = (index: number, field: keyof AdditionalArea, value: any) => {
      const updated = state.additionalAreas.map((area, i) => 
          i === index ? { ...area, [field]: value } : area
      );
      onInputChange('additionalAreas', updated);
  };

  // Helper to pre-fill inventory from warehouse OR Create New
  const handleWarehouseSelect = (itemId: string, warehouseItemId: string) => {
      if (warehouseItemId === 'create_new') {
          // Trigger Creation Flow
          const name = prompt("Enter new item name (e.g. Poly Plastic):");
          if (!name) return;
          const unit = prompt("Enter unit (e.g. Roll, Box):", "Unit") || "Unit";
          const costStr = prompt("Enter cost per unit:", "0.00");
          const cost = parseFloat(costStr || "0") || 0;

          if (onCreateWarehouseItem) {
              onCreateWarehouseItem(name, unit, cost);
              // We also want to update the current line item immediately to this new item
              // Since the new item is async added to state, we might need to manually set the fields on the current item
              onInventoryUpdate(itemId, 'name', name);
              onInventoryUpdate(itemId, 'unit', unit);
              onInventoryUpdate(itemId, 'unitCost', cost);
          }
      } else {
          const warehouseItem = state.warehouse.items.find(w => w.id === warehouseItemId);
          if (warehouseItem) {
              onInventoryUpdate(itemId, 'name', warehouseItem.name);
              onInventoryUpdate(itemId, 'unit', warehouseItem.unit);
              onInventoryUpdate(itemId, 'unitCost', warehouseItem.unitCost); 
          }
      }
  };

  const getNextStep = () => {
      if (currentStatus === 'Draft') return { label: 'Finalize & Send', icon: FileCheck, action: onStageEstimate, style: 'bg-brand text-white shadow-red-200' };
      if (currentStatus === 'Work Order' && !activeScheduledDate) return { label: 'Schedule Job', icon: Calendar, action: onStageWorkOrder, style: 'bg-amber-500 text-white shadow-amber-200' };
      if (currentStatus === 'Work Order' && activeScheduledDate) return { label: 'Generate Invoice', icon: Receipt, action: onStageInvoice, style: 'bg-emerald-600 text-white shadow-emerald-200' };
      if (currentStatus === 'Invoiced') return { label: 'Record Payment', icon: CheckCircle2, action: onStageInvoice, style: 'bg-slate-900 text-white shadow-slate-200' };
      return null;
  };

  const nextStep = getNextStep();

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in zoom-in duration-200 pb-24">
       
       {/* Workflow Stepper */}
       <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
              <div>
                <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                    <CalculatorIcon className="w-6 h-6 text-brand" /> 
                    {editingEstimateId ? 'Job Manager' : 'New Estimate'}
                </h2>
                <p className="text-slate-500 font-medium text-sm">Follow the workflow to manage this job.</p>
              </div>
              <div className="text-right hidden md:block">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Current Status</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest inline-block ${
                      currentStatus === 'Draft' ? 'bg-slate-100 text-slate-500' :
                      currentStatus === 'Work Order' ? 'bg-amber-100 text-amber-700' :
                      'bg-emerald-100 text-emerald-600'
                  }`}>
                      {currentStatus}
                  </span>
              </div>
          </div>

          <div className="mb-8 md:px-8">
              <JobProgress status={currentStatus} scheduledDate={activeScheduledDate} />
              
              {nextStep && (
                  <div className="mt-6 flex justify-center animate-in slide-in-from-top-2 duration-500">
                      <button 
                          onClick={nextStep.action}
                          className={`flex items-center gap-2 px-8 py-3 rounded-full font-black text-xs uppercase tracking-widest shadow-lg transition-all transform hover:scale-105 active:scale-95 ${nextStep.style} hover:opacity-90`}
                      >
                          {nextStep.label} <ArrowRight className="w-4 h-4" />
                      </button>
                  </div>
              )}
          </div>

          <div className="flex flex-col md:flex-row gap-4 border-t border-slate-100 pt-6">
              <div className="flex-1">
                 <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Customer / Lead</label>
                 <div className="flex gap-2">
                     <select 
                        className="flex-1 bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl p-3 font-bold outline-none focus:ring-2 focus:ring-brand"
                        value={state.customerProfile.id || 'new'}
                        onChange={onCustomerSelect}
                     >
                        <option value="new">+ Create New Customer</option>
                        {state.customers.filter(c => c.status !== 'Archived').map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                     </select>
                     {(!state.customerProfile.id || state.customerProfile.id === 'new') && (
                         <button onClick={onAddNewCustomer} className="bg-slate-900 text-white p-3 rounded-xl hover:bg-slate-800 transition-colors">
                            <Plus className="w-5 h-5" />
                         </button>
                     )}
                 </div>
              </div>
              <div className="flex-1">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Calculation Mode</label>
                  <select 
                    value={state.mode}
                    onChange={(e) => onInputChange('mode', e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl p-3 font-bold outline-none focus:ring-2 focus:ring-brand"
                  >
                      <option value={CalculationMode.BUILDING}>Full Building (Walls + Roof)</option>
                      <option value={CalculationMode.WALLS_ONLY}>Walls Only (Linear Ft)</option>
                      <option value={CalculationMode.FLAT_AREA}>Flat Area (Attic/Slab)</option>
                  </select>
              </div>
          </div>
       </div>

       {/* Crew Report Banner */}
       {isJobCompleted && currentRecord && currentStatus !== 'Paid' && (
          <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-3xl animate-in slide-in-from-top-4">
              <div className="flex items-start gap-4">
                  <div className="bg-white p-3 rounded-full shadow-sm text-emerald-600"><CheckCircle2 className="w-6 h-6" /></div>
                  <div className="flex-1">
                      <h3 className="text-emerald-900 font-black uppercase text-sm tracking-widest mb-1">Job Completed by Crew</h3>
                      <p className="text-emerald-700 text-sm font-medium mb-4">
                          The crew has finalized this work order. Review actual usage before generating the invoice.
                      </p>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                          <div className="bg-white/60 p-3 rounded-xl">
                              <span className="text-[10px] font-bold text-emerald-800 uppercase">Actual Labor</span>
                              <div className="text-xl font-black text-emerald-900">{currentRecord.actuals?.laborHours || 0} hrs</div>
                          </div>
                           <div className="bg-white/60 p-3 rounded-xl">
                              <span className="text-[10px] font-bold text-emerald-800 uppercase">Open Cell Used</span>
                              <div className="text-xl font-black text-emerald-900">{currentRecord.actuals?.openCellSets.toFixed(2) || 0} Sets</div>
                          </div>
                           <div className="bg-white/60 p-3 rounded-xl">
                              <span className="text-[10px] font-bold text-emerald-800 uppercase">Closed Cell Used</span>
                              <div className="text-xl font-black text-emerald-900">{currentRecord.actuals?.closedCellSets.toFixed(2) || 0} Sets</div>
                          </div>
                      </div>

                      <button onClick={onStageInvoice} className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-emerald-700 shadow-lg shadow-emerald-200 flex items-center gap-2">
                          <ClipboardList className="w-4 h-4" /> Review Actuals & Create Invoice
                      </button>
                  </div>
              </div>
          </div>
       )}

       {/* RESULTS CARD */}
       <div className="bg-slate-900 text-white p-6 md:p-8 rounded-3xl shadow-xl space-y-6">
           <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
               <div>
                   <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Total Spray Area</div>
                   <div className="text-3xl font-black">{Math.round(results.totalWallArea + results.totalRoofArea).toLocaleString()} <span className="text-sm text-slate-500 font-bold">sqft</span></div>
               </div>
               <div>
                   <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Total Volume</div>
                   <div className="text-3xl font-black">{Math.round(results.wallBdFt + results.roofBdFt).toLocaleString()} <span className="text-sm text-slate-500 font-bold">bdft</span></div>
               </div>
               <div>
                   <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Chemical Sets</div>
                   <div className="text-lg font-bold">
                       {results.openCellSets > 0 && (
                           <div className="text-brand-yellow">
                               {results.openCellSets.toFixed(2)} OC
                               <div className="text-[10px] text-slate-400 font-normal">~{results.openCellStrokes.toLocaleString()} Strokes</div>
                           </div>
                       )}
                       {results.closedCellSets > 0 && (
                           <div className={`text-white ${results.openCellSets > 0 ? 'mt-1' : ''}`}>
                               {results.closedCellSets.toFixed(2)} CC
                               <div className="text-[10px] text-slate-400 font-normal">~{results.closedCellStrokes.toLocaleString()} Strokes</div>
                           </div>
                       )}
                       {results.openCellSets === 0 && results.closedCellSets === 0 && <span className="text-slate-600">-</span>}
                   </div>
               </div>
               <div className="text-right">
                   <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
                       {state.pricingMode === 'sqft_pricing' ? 'SqFt Quote Total' : 'Total Estimate'}
                   </div>
                   <div className="text-3xl font-black text-brand">${Math.round(results.totalCost).toLocaleString()}</div>
                   {state.pricingMode === 'sqft_pricing' && (
                       <div className="text-[9px] text-slate-500 mt-1 uppercase tracking-wide">
                           Overrides Material+Labor
                       </div>
                   )}
               </div>
           </div>

           {/* COST BREAKDOWN SECTION */}
           <div className="pt-6 border-t border-slate-700 grid grid-cols-1 md:grid-cols-3 gap-6">
               <div>
                   <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">COGS: Material</div>
                   <div className="text-lg font-bold text-slate-300">
                       ${Math.round(results.materialCost).toLocaleString()}
                   </div>
               </div>
               <div>
                   <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">COGS: Labor & Misc</div>
                   <div className="text-lg font-bold text-slate-300">
                       ${Math.round(results.laborCost + results.miscExpenses).toLocaleString()}
                   </div>
               </div>
               <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Projected Margin</div>
                    <div className="text-lg font-bold text-white flex items-center gap-2">
                         {results.totalCost > 0 ? (
                             <>
                                ${Math.round(results.totalCost - (results.materialCost + results.laborCost + results.miscExpenses)).toLocaleString()}
                                <span className={`text-[10px] uppercase px-2 py-0.5 rounded ${
                                    (results.totalCost - (results.materialCost + results.laborCost + results.miscExpenses))/results.totalCost > 0.3 
                                    ? 'bg-emerald-900/50 text-emerald-400' 
                                    : 'bg-red-900/50 text-red-400'
                                }`}>
                                    {((1 - (results.materialCost + results.laborCost + results.miscExpenses)/results.totalCost) * 100).toFixed(1)}%
                                </span>
                             </>
                         ) : '-'}
                    </div>
               </div>
           </div>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           
           {/* DIMENSIONS */}
           <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
               <h3 className="font-black text-slate-900 mb-6 flex items-center gap-2 uppercase text-sm tracking-widest">
                  <Building2 className="w-5 h-5 text-brand"/> Building Dimensions
               </h3>
               
               <div className="grid grid-cols-2 gap-4">
                   {state.mode !== CalculationMode.FLAT_AREA && (
                       <div className="col-span-2 md:col-span-1">
                           <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Length (ft)</label>
                           <input type="number" value={state.length} onChange={(e) => onInputChange('length', parseFloat(e.target.value))} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-brand outline-none" />
                       </div>
                   )}
                   {state.mode === CalculationMode.BUILDING && (
                       <div className="col-span-2 md:col-span-1">
                           <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Width (ft)</label>
                           <input type="number" value={state.width} onChange={(e) => onInputChange('width', parseFloat(e.target.value))} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-brand outline-none" />
                       </div>
                   )}
                   {state.mode !== CalculationMode.FLAT_AREA && (
                       <div className="col-span-2 md:col-span-1">
                           <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Wall Height (ft)</label>
                           <input type="number" value={state.wallHeight} onChange={(e) => onInputChange('wallHeight', parseFloat(e.target.value))} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-brand outline-none" />
                       </div>
                   )}
                   {state.mode === CalculationMode.BUILDING && (
                       <div className="col-span-2 md:col-span-1">
                           <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Roof Pitch (X/12)</label>
                           <input type="text" value={state.roofPitch} onChange={(e) => onInputChange('roofPitch', e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-brand outline-none" />
                       </div>
                   )}
                   {state.mode === CalculationMode.FLAT_AREA && (
                        <>
                           <div className="col-span-2 md:col-span-1">
                               <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Length (ft)</label>
                               <input type="number" value={state.length} onChange={(e) => onInputChange('length', parseFloat(e.target.value))} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-brand outline-none" />
                           </div>
                           <div className="col-span-2 md:col-span-1">
                               <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Width (ft)</label>
                               <input type="number" value={state.width} onChange={(e) => onInputChange('width', parseFloat(e.target.value))} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-brand outline-none" />
                           </div>
                           <div className="col-span-2">
                               <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Pitch / Slope (Optional)</label>
                               <input type="text" placeholder="e.g. 4/12 or 0" value={state.roofPitch} onChange={(e) => onInputChange('roofPitch', e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-brand outline-none" />
                           </div>
                        </>
                   )}
               </div>
               
               <div className="mt-4 flex flex-col md:flex-row md:items-center justify-between gap-4 border-t border-slate-100 pt-4">
                   {state.mode === CalculationMode.BUILDING && (
                       <div className="flex items-center gap-2">
                            <input 
                                type="checkbox" 
                                id="gables" 
                                checked={state.includeGables} 
                                onChange={(e) => onInputChange('includeGables', e.target.checked)}
                                className="w-5 h-5 text-brand rounded focus:ring-brand border-slate-300"
                            />
                            <label htmlFor="gables" className="text-sm font-bold text-slate-700">Include Gable Ends?</label>
                       </div>
                   )}
                   
                   {/* Metal Surface Toggle */}
                   <div className="flex items-center gap-2">
                        <input 
                            type="checkbox" 
                            id="metalSurface" 
                            checked={state.isMetalSurface || false} 
                            onChange={(e) => onInputChange('isMetalSurface', e.target.checked)}
                            className="w-5 h-5 text-brand rounded focus:ring-brand border-slate-300"
                        />
                        <label htmlFor="metalSurface" className="text-sm font-bold text-slate-700 flex items-center gap-1">
                            Metal Surface? 
                            <span className="text-[9px] font-black text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">+15% Area</span>
                        </label>
                   </div>
               </div>
               
               {/* LIVE GABLE AREA DISPLAY */}
               {state.mode === CalculationMode.BUILDING && state.includeGables && (
                   <div className="mt-2 flex items-center gap-2">
                       <span className="text-[10px] font-black text-sky-600 bg-sky-50 border border-sky-100 px-3 py-1.5 rounded-lg flex items-center gap-1">
                           <ArrowRight className="w-3 h-3" /> {Math.round(results.gableArea).toLocaleString()} sqft (Gables)
                       </span>
                   </div>
               )}

               {/* ADDITIONAL AREAS */}
               <div className="mt-6 border-t border-slate-100 pt-4">
                   <div className="flex justify-between items-center mb-3">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                           <Plus className="w-3 h-3" /> Add Section
                       </label>
                       <button onClick={addArea} className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold px-2 py-1 rounded-lg transition-colors">
                           + Add
                       </button>
                   </div>
                   
                   <div className="space-y-2">
                       {state.additionalAreas && state.additionalAreas.map((area, index) => (
                           <div key={index} className="flex gap-2 items-center bg-slate-50 p-1.5 rounded-xl border border-slate-100">
                               <select 
                                   value={area.type}
                                   onChange={(e) => updateArea(index, 'type', e.target.value as AreaType)}
                                   className="bg-white border border-slate-200 text-[10px] font-bold rounded-lg p-1.5 outline-none focus:border-brand w-20"
                               >
                                   <option value={AreaType.WALL}>Wall</option>
                                   <option value={AreaType.ROOF}>Roof</option>
                               </select>
                               
                               <div className="flex-1 flex items-center gap-1">
                                   <input 
                                       type="number" 
                                       placeholder="L" 
                                       value={area.length || ''} 
                                       onChange={(e) => updateArea(index, 'length', parseFloat(e.target.value))}
                                       className="w-full bg-white border border-slate-200 text-[10px] font-bold rounded-lg p-1.5 outline-none focus:border-brand"
                                   />
                                   <span className="text-slate-300 font-black text-[10px]">x</span>
                                   <input 
                                       type="number" 
                                       placeholder="W" 
                                       value={area.width || ''} 
                                       onChange={(e) => updateArea(index, 'width', parseFloat(e.target.value))}
                                       className="w-full bg-white border border-slate-200 text-[10px] font-bold rounded-lg p-1.5 outline-none focus:border-brand"
                                   />
                               </div>

                               <div className="text-[10px] font-black text-slate-400 w-16 text-right">
                                   {Math.round((area.length || 0) * (area.width || 0))} sqft
                               </div>

                               <button onClick={() => removeArea(index)} className="p-1.5 text-slate-300 hover:text-red-500 transition-colors">
                                   <Trash2 className="w-3 h-3" />
                               </button>
                           </div>
                       ))}
                       {(!state.additionalAreas || state.additionalAreas.length === 0) && (
                           <div className="text-center py-2 text-[10px] text-slate-300 italic border border-dashed border-slate-100 rounded-lg">
                               No extra sections added.
                           </div>
                       )}
                   </div>
               </div>
           </div>

           {/* SPECS & PRICING */}
           <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
               <div className="flex justify-between items-center mb-6">
                   <h3 className="font-black text-slate-900 flex items-center gap-2 uppercase text-sm tracking-widest">
                      <HardHat className="w-5 h-5 text-brand"/> Insulation Specs
                   </h3>
                   
                   {/* PRICING MODE TOGGLE */}
                   <div className="bg-slate-100 p-1 rounded-lg flex items-center">
                       <button 
                         onClick={() => onInputChange('pricingMode', 'level_pricing')}
                         className={`px-3 py-1.5 rounded-md text-[9px] font-black uppercase tracking-wider transition-all ${
                             state.pricingMode === 'level_pricing' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400 hover:text-slate-600'
                         }`}
                       >
                           Cost Plus
                       </button>
                       <button 
                         onClick={() => onInputChange('pricingMode', 'sqft_pricing')}
                         className={`px-3 py-1.5 rounded-md text-[9px] font-black uppercase tracking-wider transition-all ${
                             state.pricingMode === 'sqft_pricing' ? 'bg-white shadow-sm text-brand' : 'text-slate-400 hover:text-slate-600'
                         }`}
                       >
                           SqFt Price
                       </button>
                   </div>
               </div>
               
               <div className="space-y-6">
                   {state.mode !== CalculationMode.FLAT_AREA && (
                       <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                           <div className="flex justify-between items-center mb-3">
                                <span className="text-xs font-black uppercase tracking-widest text-slate-500">Walls</span>
                                {/* LIVE WALL AREA DISPLAY */}
                                <span className="text-xs font-black text-sky-600 bg-white border border-sky-100 px-2 py-1 rounded shadow-sm">
                                    Total: {Math.round(results.totalWallArea).toLocaleString()} sqft
                                </span>
                           </div>
                           <div className="grid grid-cols-2 gap-3">
                               <select 
                                value={state.wallSettings.type} 
                                onChange={(e) => onSettingsChange('wallSettings', 'type', e.target.value)} 
                                className="col-span-2 bg-white border border-slate-200 p-2 rounded-lg font-bold text-sm"
                               >
                                   <option value={FoamType.OPEN_CELL}>Open Cell</option>
                                   <option value={FoamType.CLOSED_CELL}>Closed Cell</option>
                               </select>
                               <div>
                                   <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Depth (in)</label>
                                   <input type="number" value={state.wallSettings.thickness} onChange={(e) => onSettingsChange('wallSettings', 'thickness', parseFloat(e.target.value))} className="w-full p-2 bg-white border border-slate-200 rounded-lg font-bold text-sm" />
                               </div>
                               <div>
                                   <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Waste %</label>
                                   <input type="number" value={state.wallSettings.wastePercentage} onChange={(e) => onSettingsChange('wallSettings', 'wastePercentage', parseFloat(e.target.value))} className="w-full p-2 bg-white border border-slate-200 rounded-lg font-bold text-sm" />
                               </div>
                               {/* SQFT PRICING INPUT */}
                               {state.pricingMode === 'sqft_pricing' && (
                                   <div className="col-span-2 mt-2 pt-2 border-t border-slate-200">
                                       <label className="text-[9px] font-black text-brand uppercase block mb-1">Price Per Sq Ft ($)</label>
                                       <div className="relative">
                                           <span className="absolute left-3 top-2 text-slate-400 text-xs">$</span>
                                           <input 
                                                type="number" 
                                                value={state.sqFtRates.wall} 
                                                onChange={(e) => onInputChange('sqFtRates', { ...state.sqFtRates, wall: parseFloat(e.target.value) })} 
                                                className="w-full pl-6 p-2 bg-white border border-brand/20 rounded-lg font-bold text-sm focus:ring-1 focus:ring-brand outline-none text-brand" 
                                                placeholder="0.00"
                                           />
                                       </div>
                                   </div>
                               )}
                           </div>
                       </div>
                   )}

                   <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                       <div className="flex justify-between items-center mb-3">
                            <span className="text-xs font-black uppercase tracking-widest text-slate-500">Roof / Ceiling</span>
                            {/* LIVE ROOF AREA DISPLAY */}
                            <span className="text-xs font-black text-sky-600 bg-white border border-sky-100 px-2 py-1 rounded shadow-sm">
                                Total: {Math.round(results.totalRoofArea).toLocaleString()} sqft
                            </span>
                       </div>
                       <div className="grid grid-cols-2 gap-3">
                           <select 
                            value={state.roofSettings.type} 
                            onChange={(e) => onSettingsChange('roofSettings', 'type', e.target.value)} 
                            className="col-span-2 bg-white border border-slate-200 p-2 rounded-lg font-bold text-sm"
                           >
                               <option value={FoamType.OPEN_CELL}>Open Cell</option>
                               <option value={FoamType.CLOSED_CELL}>Closed Cell</option>
                           </select>
                           <div>
                               <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Depth (in)</label>
                               <input type="number" value={state.roofSettings.thickness} onChange={(e) => onSettingsChange('roofSettings', 'thickness', parseFloat(e.target.value))} className="w-full p-2 bg-white border border-slate-200 rounded-lg font-bold text-sm" />
                           </div>
                           <div>
                               <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Waste %</label>
                               <input type="number" value={state.roofSettings.wastePercentage} onChange={(e) => onSettingsChange('roofSettings', 'wastePercentage', parseFloat(e.target.value))} className="w-full p-2 bg-white border border-slate-200 rounded-lg font-bold text-sm" />
                           </div>
                           {/* SQFT PRICING INPUT */}
                           {state.pricingMode === 'sqft_pricing' && (
                               <div className="col-span-2 mt-2 pt-2 border-t border-slate-200">
                                   <label className="text-[9px] font-black text-brand uppercase block mb-1">Price Per Sq Ft ($)</label>
                                   <div className="relative">
                                       <span className="absolute left-3 top-2 text-slate-400 text-xs">$</span>
                                       <input 
                                            type="number" 
                                            value={state.sqFtRates.roof} 
                                            onChange={(e) => onInputChange('sqFtRates', { ...state.sqFtRates, roof: parseFloat(e.target.value) })} 
                                            className="w-full pl-6 p-2 bg-white border border-brand/20 rounded-lg font-bold text-sm focus:ring-1 focus:ring-brand outline-none text-brand" 
                                            placeholder="0.00"
                                       />
                                   </div>
                               </div>
                           )}
                       </div>
                   </div>
               </div>
           </div>

           {/* Inventory & Expenses */}
           <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Inventory/Prep */}
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-black text-slate-900 flex items-center gap-2 uppercase text-sm tracking-widest">
                            <Box className="w-5 h-5 text-brand"/> Prep & Inventory
                        </h3>
                        <button onClick={onAddInventory} className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
                            <Plus className="w-3 h-3"/> Add Item
                        </button>
                    </div>
                    
                    <div className="space-y-4">
                        {state.inventory.length === 0 ? (
                            <div className="text-center py-6 text-slate-300 text-xs italic border-2 border-dashed border-slate-100 rounded-xl">No extra inventory items added.</div>
                        ) : (
                            state.inventory.map(item => (
                                <div key={item.id} className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                    <div className="flex flex-col gap-2">
                                        <div className="flex gap-2 items-center">
                                            <div className="flex-1">
                                                <label className="text-[9px] font-black uppercase text-slate-400 mb-1 block">Quick Add from Warehouse</label>
                                                <select 
                                                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold outline-none focus:border-brand cursor-pointer"
                                                    onChange={(e) => handleWarehouseSelect(item.id, e.target.value)}
                                                    defaultValue=""
                                                >
                                                    <option value="" disabled>Select Item from Warehouse...</option>
                                                    <option value="create_new" className="text-brand font-black">+ Create New Item</option>
                                                    {state.warehouse.items.map(w => (
                                                        <option key={w.id} value={w.id}>{w.name} (Qty: {w.quantity} {w.unit})</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="w-20">
                                                 <label className="text-[9px] font-black uppercase text-slate-400 mb-1 block">Qty</label>
                                                 <input type="number" placeholder="Qty" value={item.quantity} onChange={(e) => onInventoryUpdate(item.id, 'quantity', parseFloat(e.target.value))} className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold text-center" />
                                            </div>
                                            <div className="w-20">
                                                 <label className="text-[9px] font-black uppercase text-slate-400 mb-1 block">Cost ($)</label>
                                                 <input type="number" placeholder="0.00" value={item.unitCost || ''} onChange={(e) => onInventoryUpdate(item.id, 'unitCost', parseFloat(e.target.value))} className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold text-center" />
                                            </div>
                                            <button onClick={() => onRemoveInventory(item.id)} className="mt-4 p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                                        </div>
                                        <input 
                                            type="text" 
                                            placeholder="Or type custom item name..." 
                                            value={item.name} 
                                            onChange={(e) => onInventoryUpdate(item.id, 'name', e.target.value)} 
                                            className="w-full bg-transparent border-b border-slate-200 p-1 text-xs text-slate-500 focus:border-brand focus:text-slate-900 outline-none" 
                                        />
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* NEW: Equipment / Tools Section */}
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-black text-slate-900 flex items-center gap-2 uppercase text-sm tracking-widest">
                            <Wrench className="w-5 h-5 text-brand"/> Equipment / Tools
                        </h3>
                    </div>
                    <div className="mb-4">
                        <select 
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-brand"
                            onChange={(e) => { 
                                if(e.target.value) { 
                                    addEquipmentToJob(e.target.value); 
                                    e.target.value = ''; 
                                } 
                            }}
                            defaultValue=""
                        >
                            <option value="" disabled>+ Add Tool from Inventory</option>
                            {state.equipment && state.equipment.map(eq => (
                                <option key={eq.id} value={eq.id}>{eq.name} (Last: {eq.lastSeen?.customerName || 'N/A'})</option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-2">
                        {state.jobEquipment.length === 0 ? (
                            <div className="text-center py-4 text-slate-300 text-xs italic">No tools assigned to this job.</div>
                        ) : (
                            state.jobEquipment.map(tool => (
                                <div key={tool.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                                    <span className="font-bold text-slate-700 text-sm">{tool.name}</span>
                                    <button onClick={() => removeEquipmentFromJob(tool.id)} className="text-slate-300 hover:text-red-500">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Labor & Misc */}
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 md:col-span-2">
                     <h3 className="font-black text-slate-900 mb-6 flex items-center gap-2 uppercase text-sm tracking-widest">
                        <DollarSign className="w-5 h-5 text-brand"/> Labor & Fees
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-1">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Est. Man Hours</label>
                            <input type="number" value={state.expenses.manHours} onChange={(e) => onInputChange('expenses', { ...state.expenses, manHours: parseFloat(e.target.value) })} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-brand outline-none" />
                        </div>
                         <div className="col-span-1">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Trip / Fuel ($)</label>
                            <input type="number" value={state.expenses.tripCharge} onChange={(e) => onInputChange('expenses', { ...state.expenses, tripCharge: parseFloat(e.target.value) })} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-brand outline-none" />
                        </div>
                    </div>
                </div>

           </div>
           
           {/* ACTION BAR - WORKFLOW LOGIC */}
           <div className="md:col-span-2 flex flex-col md:flex-row gap-4 pt-6 border-t border-slate-200 pb-12">
               <button onClick={() => onSaveEstimate()} className="flex-1 bg-slate-900 hover:bg-slate-800 text-white p-4 rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg">
                   <Save className="w-4 h-4" /> Save / Update
               </button>
               
               {/* NEW: Review & Finalize Estimate Button */}
               {currentStatus === 'Draft' && (
                   <button 
                       onClick={onStageEstimate}
                       className="flex-1 bg-white border-2 border-slate-200 hover:border-slate-300 text-slate-600 hover:text-slate-800 p-4 rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all"
                   >
                       <FileCheck className="w-4 h-4" /> Review & Finalize Estimate
                   </button>
               )}

               {/* Conditional Workflow Buttons */}
               
               {/* If Paid, show status */}
               {currentStatus === 'Paid' ? (
                   <div className="flex-1 bg-emerald-100 text-emerald-700 p-4 rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 border border-emerald-200">
                       <CheckCircle2 className="w-4 h-4" /> Paid in Full
                   </div>
               ) : currentStatus === 'Invoiced' ? (
                   // If Invoiced, show View Invoice button instead of "Mark Paid" (Moved to InvoiceStage)
                   <button 
                       onClick={onStageInvoice}
                       className="flex-1 bg-sky-600 hover:bg-sky-700 text-white p-4 rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-sky-200"
                   >
                       <Receipt className="w-4 h-4" /> View / Manage Invoice
                   </button>
               ) : currentStatus === 'Work Order' ? (
                   // Work Order Status: Split into "Schedule" or "Invoice" based on progress
                   <div className="flex-1 flex gap-2">
                       {/* If already scheduled, prioritize Invoice. If not, prioritize Scheduling */}
                       {!activeScheduledDate ? (
                           <button onClick={onStageWorkOrder} className="flex-1 bg-amber-500 hover:bg-amber-600 text-white p-4 rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-amber-200">
                               <Calendar className="w-4 h-4" /> Schedule Job
                           </button>
                       ) : (
                           <button onClick={onStageWorkOrder} className="flex-1 bg-white border-2 border-slate-100 hover:bg-slate-50 text-slate-500 p-4 rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2">
                               <Pencil className="w-4 h-4" /> Edit Work Order
                           </button>
                       )}
                       
                       <button onClick={onStageInvoice} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white p-4 rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-emerald-200">
                           <ClipboardList className="w-4 h-4" /> Finalize & Invoice
                       </button>
                   </div>
               ) : (
                   // Default: Move to Sold/Work Order
                   <button onClick={onStageWorkOrder} className="flex-1 bg-brand hover:bg-brand-hover text-white p-4 rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-red-200">
                       <HardHat className="w-4 h-4" /> Sold / Work Order <ArrowRight className="w-4 h-4"/>
                   </button>
               )}
           </div>
       </div>
    </div>
  );
};
