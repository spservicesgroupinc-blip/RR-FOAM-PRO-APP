
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
  DollarSign
} from 'lucide-react';
import { EstimateRecord, CalculationResults } from '../types';

interface EstimateDetailProps {
  record: EstimateRecord;
  results: CalculationResults;
  onBack: () => void;
  onEdit: () => void;
  onGeneratePDF: () => void;
  onSold: () => void;
  onInvoice: () => void; // New prop for correct routing
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

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in zoom-in duration-200 pb-24">
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 text-xs font-black uppercase tracking-widest transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to List
        </button>
        <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest ${
            record.status === 'Draft' ? 'bg-slate-100 text-slate-500' :
            record.status === 'Work Order' ? 'bg-amber-100 text-amber-700' :
            'bg-emerald-100 text-emerald-700'
        }`}>
            {record.status} #{record.invoiceNumber || record.id.substring(0,6).toUpperCase()}
        </span>
      </div>

      {/* Main Card */}
      <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100">
          
          {/* Header Section */}
          <div className="bg-slate-900 text-white p-8 md:p-12 relative overflow-hidden">
              <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
                  <div>
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                          <User className="w-3 h-3" /> Customer Profile
                      </div>
                      <h1 className="text-3xl md:text-4xl font-black text-white leading-tight mb-2">
                          {record.customer.name}
                      </h1>
                      <div className="text-slate-400 font-medium flex flex-col gap-1 text-sm">
                          <span className="flex items-center gap-2"><MapPin className="w-3 h-3"/> {record.customer.address}, {record.customer.city}</span>
                          <span className="flex items-center gap-2"><Phone className="w-3 h-3"/> {record.customer.phone}</span>
                      </div>
                  </div>

                  <div className="text-left md:text-right bg-white/5 p-6 rounded-2xl border border-white/10 backdrop-blur-sm">
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Estimate Value</div>
                      <div className="text-4xl font-black text-brand tracking-tight">
                          ${Math.round(results.totalCost).toLocaleString()}
                      </div>
                      <div className="flex items-center gap-2 mt-2 md:justify-end">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded ${margin > 30 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                              {margin.toFixed(1)}% Margin
                          </span>
                          <span className="text-xs text-slate-500 font-bold">Est. Profit: ${Math.round(results.totalCost - (results.materialCost + results.laborCost + results.miscExpenses)).toLocaleString()}</span>
                      </div>
                  </div>
              </div>
              
              {/* Background Decor */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-brand rounded-full filter blur-[100px] opacity-10 transform translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>
          </div>

          {/* Details Body */}
          <div className="p-8">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                  {/* Scope Summary */}
                  <div>
                      <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                          <HardHat className="w-4 h-4 text-slate-400" /> Installation Scope
                      </h3>
                      <div className="space-y-3">
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

                  {/* Financial Breakdown (Simplified) */}
                  <div>
                      <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-4 flex items-center gap-2">
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

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-4 pt-6 border-t border-slate-100">
                  <button onClick={onEdit} className="flex-1 min-w-[140px] flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-slate-100 font-bold text-slate-600 hover:bg-slate-50 hover:border-slate-200 transition-all uppercase text-xs tracking-widest">
                      <Pencil className="w-4 h-4" /> Edit Estimate
                  </button>
                  <button onClick={onGeneratePDF} className="flex-1 min-w-[140px] flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-slate-100 font-bold text-slate-600 hover:bg-slate-50 hover:border-slate-200 transition-all uppercase text-xs tracking-widest">
                      <FileText className="w-4 h-4" /> View PDF
                  </button>
                  
                  {/* Status-Based Actions */}
                  {record.status === 'Draft' && (
                      <button onClick={onSold} className="flex-[2] min-w-[200px] flex items-center justify-center gap-2 p-4 rounded-xl bg-brand text-white font-black hover:bg-brand-hover transition-all uppercase text-xs tracking-widest shadow-lg shadow-red-100">
                          <CheckCircle2 className="w-4 h-4" /> Mark Sold
                      </button>
                  )}
                  {record.status === 'Work Order' && (
                      <>
                        <button onClick={onSold} className="flex-1 min-w-[140px] flex items-center justify-center gap-2 p-4 rounded-xl bg-amber-500 text-white font-black hover:bg-amber-600 transition-all uppercase text-xs tracking-widest shadow-lg shadow-amber-100">
                            <Calendar className="w-4 h-4" /> Edit Work Order
                        </button>
                        <button onClick={onInvoice} className="flex-1 min-w-[140px] flex items-center justify-center gap-2 p-4 rounded-xl bg-emerald-600 text-white font-black hover:bg-emerald-700 transition-all uppercase text-xs tracking-widest shadow-lg shadow-emerald-200">
                            <DollarSign className="w-4 h-4" /> Generate Invoice
                        </button>
                      </>
                  )}
                  {(record.status === 'Invoiced' || record.status === 'Paid') && (
                      <button onClick={onInvoice} className="flex-[2] min-w-[200px] flex items-center justify-center gap-2 p-4 rounded-xl bg-sky-600 text-white font-black hover:bg-sky-700 transition-all uppercase text-xs tracking-widest shadow-lg shadow-sky-100">
                          <Receipt className="w-4 h-4" /> View Invoice
                      </button>
                  )}
              </div>

          </div>
      </div>
    </div>
  );
};
