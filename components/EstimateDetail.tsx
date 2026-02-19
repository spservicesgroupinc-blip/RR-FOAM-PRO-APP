
import React from 'react';
import { 
  ArrowLeft, 
  Pencil, 
  FileText, 
  HardHat, 
  MapPin, 
  Calendar, 
  CheckCircle2, 
  Receipt, 
  User, 
  Phone,
  DollarSign,
  ArrowRight
} from 'lucide-react';
import { EstimateRecord, CalculationResults } from '../types';
import { JobProgress } from './JobProgress';

interface EstimateDetailProps {
  record: EstimateRecord;
  results: CalculationResults;
  onBack: () => void;
  onEdit: () => void;
  onGeneratePDF: () => void;
  onSold: () => void;
  onInvoice: () => void;
}

export const EstimateDetail: React.FC<EstimateDetailProps> = ({ 
  record, 
  results, 
  onBack, 
  onEdit, 
  onGeneratePDF,
  onSold,
  onInvoice
}) => {
  const isPaid = record.status === 'Paid';
  const margin = results.totalCost > 0 
    ? ((results.totalCost - (results.materialCost + results.laborCost + results.miscExpenses)) / results.totalCost) * 100 
    : 0;

  // Single next-step logic matching the workflow
  const getNextStep = () => {
    if (record.status === 'Draft') return { label: 'Mark Sold', icon: CheckCircle2, action: onSold, style: 'bg-brand hover:bg-brand-hover text-white shadow-lg shadow-red-200' };
    if (record.status === 'Work Order' && !record.scheduledDate) return { label: 'Schedule Job', icon: Calendar, action: onSold, style: 'bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-200' };
    if (record.status === 'Work Order' && record.scheduledDate) return { label: 'Generate Invoice', icon: Receipt, action: onInvoice, style: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-200' };
    if (record.status === 'Invoiced') return { label: 'Record Payment', icon: CheckCircle2, action: onInvoice, style: 'bg-slate-900 hover:bg-slate-800 text-white shadow-lg shadow-slate-200' };
    return null;
  };

  const nextStep = getNextStep();

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in zoom-in duration-200 pb-24">
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 text-xs font-black uppercase tracking-widest transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to List
        </button>
        <button onClick={onEdit} className="flex items-center gap-2 text-slate-400 hover:text-slate-700 text-xs font-black uppercase tracking-widest transition-colors">
          <Pencil className="w-3 h-3" /> Edit
        </button>
      </div>

      {/* Workflow Stepper Card — same pattern as Calculator */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-3">
              <div>
                <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                    {record.customer.name}
                </h2>
                <p className="text-slate-400 font-medium text-sm flex items-center gap-2">
                    <MapPin className="w-3 h-3"/> {record.customer.address}, {record.customer.city}
                </p>
              </div>
              <div className="text-right">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Current Status</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest inline-block ${
                      record.status === 'Draft' ? 'bg-slate-100 text-slate-500' :
                      record.status === 'Work Order' ? 'bg-amber-100 text-amber-700' :
                      record.status === 'Invoiced' ? 'bg-sky-100 text-sky-700' :
                      record.status === 'Paid' ? 'bg-emerald-100 text-emerald-700' :
                      'bg-slate-100 text-slate-500'
                  }`}>
                      {record.status}
                  </span>
              </div>
          </div>

          <div className="md:px-8">
              <JobProgress status={record.status} scheduledDate={record.scheduledDate} />

              {isPaid ? (
                  <div className="mt-4 flex justify-center">
                      <div className="flex items-center gap-2 px-8 py-3 rounded-full bg-emerald-100 text-emerald-700 font-black text-xs uppercase tracking-widest border border-emerald-200">
                          <CheckCircle2 className="w-4 h-4" /> Paid in Full
                      </div>
                  </div>
              ) : nextStep && (
                  <div className="mt-4 flex justify-center">
                      <button 
                          onClick={nextStep.action}
                          className={`flex items-center gap-2 px-8 py-3 rounded-full font-black text-xs uppercase tracking-widest transition-all transform hover:scale-105 active:scale-95 ${nextStep.style}`}
                      >
                          {nextStep.label} <ArrowRight className="w-4 h-4" />
                      </button>
                  </div>
              )}
          </div>
      </div>

      {/* Job Details Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          
          {/* Value Header */}
          <div className="bg-slate-900 text-white p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Value</div>
                  <div className="text-3xl font-black text-brand tracking-tight">
                      ${Math.round(results.totalCost).toLocaleString()}
                  </div>
              </div>
              <div className="flex items-center gap-3">
                  <span className={`text-xs font-bold px-2.5 py-1 rounded ${margin > 30 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                      {margin.toFixed(1)}% Margin
                  </span>
                  <span className="text-xs text-slate-500 font-bold">Profit: ${Math.round(results.totalCost - (results.materialCost + results.laborCost + results.miscExpenses)).toLocaleString()}</span>
              </div>
          </div>

          {/* Details Body */}
          <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Scope Summary */}
                  <div>
                      <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-3 flex items-center gap-2">
                          <HardHat className="w-4 h-4 text-slate-400" /> Installation Scope
                      </h3>
                      <div className="space-y-2">
                          {results.totalWallArea > 0 && (
                              <div className="flex justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                                  <div>
                                      <span className="block text-sm font-bold text-slate-800">Walls</span>
                                      <span className="text-xs text-slate-500 font-medium">{record.wallSettings.type} @ {record.wallSettings.thickness}"</span>
                                  </div>
                                  <div className="text-right">
                                      <span className="block text-sm font-bold text-slate-800">{Math.round(results.totalWallArea).toLocaleString()} sqft</span>
                                      <span className="text-xs text-slate-500 font-medium">{Math.round(results.wallBdFt).toLocaleString()} bdft</span>
                                  </div>
                              </div>
                          )}
                          {results.totalRoofArea > 0 && (
                              <div className="flex justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                                  <div>
                                      <span className="block text-sm font-bold text-slate-800">Roof</span>
                                      <span className="text-xs text-slate-500 font-medium">{record.roofSettings.type} @ {record.roofSettings.thickness}"</span>
                                  </div>
                                  <div className="text-right">
                                      <span className="block text-sm font-bold text-slate-800">{Math.round(results.totalRoofArea).toLocaleString()} sqft</span>
                                      <span className="text-xs text-slate-500 font-medium">{Math.round(results.roofBdFt).toLocaleString()} bdft</span>
                                  </div>
                              </div>
                          )}
                      </div>
                  </div>

                  {/* Chemical Sets & Strokes */}
                  {(results.openCellSets > 0 || results.closedCellSets > 0) && (
                  <div>
                      <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-3 flex items-center gap-2">
                          <HardHat className="w-4 h-4 text-slate-400" /> Chemical Sets & Strokes
                      </h3>
                      <div className="space-y-2">
                          {results.openCellSets > 0 && (
                              <div className="flex justify-between p-3 bg-sky-50 rounded-xl border border-sky-100">
                                  <div>
                                      <span className="block text-sm font-bold text-slate-800">Open Cell</span>
                                      <span className="text-xs text-slate-500 font-medium">{record.materials?.ocStrokesPerSet || 6600} strokes/set</span>
                                  </div>
                                  <div className="text-right">
                                      <span className="block text-sm font-bold text-slate-800">{results.openCellSets.toFixed(2)} Sets</span>
                                      <span className="text-xs text-sky-600 font-medium">~{results.openCellStrokes.toLocaleString()} Strokes</span>
                                  </div>
                              </div>
                          )}
                          {results.closedCellSets > 0 && (
                              <div className="flex justify-between p-3 bg-sky-50 rounded-xl border border-sky-100">
                                  <div>
                                      <span className="block text-sm font-bold text-slate-800">Closed Cell</span>
                                      <span className="text-xs text-slate-500 font-medium">{record.materials?.ccStrokesPerSet || 6600} strokes/set</span>
                                  </div>
                                  <div className="text-right">
                                      <span className="block text-sm font-bold text-slate-800">{results.closedCellSets.toFixed(2)} Sets</span>
                                      <span className="text-xs text-sky-600 font-medium">~{results.closedCellStrokes.toLocaleString()} Strokes</span>
                                  </div>
                              </div>
                          )}
                          {record.actuals && (
                              <div className="mt-2 p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                                  <span className="block text-[10px] font-black text-emerald-700 uppercase tracking-widest mb-1">Actuals</span>
                                  {(record.actuals.openCellSets > 0 || (record.actuals.openCellStrokes || 0) > 0) && (
                                      <div className="flex justify-between text-sm">
                                          <span className="font-medium text-slate-600">OC</span>
                                          <span className="font-bold text-emerald-800">{record.actuals.openCellSets.toFixed(2)} Sets / {(record.actuals.openCellStrokes || 0).toLocaleString()} Strokes</span>
                                      </div>
                                  )}
                                  {(record.actuals.closedCellSets > 0 || (record.actuals.closedCellStrokes || 0) > 0) && (
                                      <div className="flex justify-between text-sm">
                                          <span className="font-medium text-slate-600">CC</span>
                                          <span className="font-bold text-emerald-800">{record.actuals.closedCellSets.toFixed(2)} Sets / {(record.actuals.closedCellStrokes || 0).toLocaleString()} Strokes</span>
                                      </div>
                                  )}
                              </div>
                          )}
                      </div>
                  </div>
                  )}

                  {/* Financial Breakdown */}
                  <div>
                      <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-3 flex items-center gap-2">
                          <Receipt className="w-4 h-4 text-slate-400" /> Cost Summary
                      </h3>
                      <div className="space-y-3">
                          <div className="flex justify-between items-center text-sm">
                              <span className="font-medium text-slate-500">Material Cost</span>
                              <span className="font-bold text-slate-800">${Math.round(results.materialCost).toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between items-center text-sm">
                              <span className="font-medium text-slate-500">Labor & Fees</span>
                              <span className="font-bold text-slate-800">${Math.round(results.laborCost + results.miscExpenses).toLocaleString()}</span>
                          </div>
                          <div className="border-t border-slate-100 my-2"></div>
                          <div className="flex justify-between items-center text-sm">
                              <span className="font-black text-slate-900">Total Estimate</span>
                              <span className="font-black text-brand text-lg">${Math.round(results.totalCost).toLocaleString()}</span>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      </div>
    </div>
  );
};
