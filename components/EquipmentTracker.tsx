
import React, { useMemo } from 'react';
import { ArrowLeft, MapPin, Wrench, Calendar, User } from 'lucide-react';
import { CalculatorState } from '../types';

interface EquipmentTrackerProps {
  state: CalculatorState;
  onBack: () => void;
}

export const EquipmentTracker: React.FC<EquipmentTrackerProps> = ({ state, onBack }) => {
  
  const sortedEquipment = useMemo(() => {
      // Sort: Items logged most recently first, then undefined
      return [...(state.equipment || [])].sort((a, b) => {
          const dateA = a.lastSeen?.date ? new Date(a.lastSeen.date).getTime() : 0;
          const dateB = b.lastSeen?.date ? new Date(b.lastSeen.date).getTime() : 0;
          return dateB - dateA;
      });
  }, [state.equipment]);

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in zoom-in duration-200 pb-20">
        <div className="flex items-center gap-4 mb-6">
            <button onClick={onBack} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                <ArrowLeft className="w-6 h-6 text-slate-500" />
            </button>
            <div>
                <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Equipment Tracker</h1>
                <p className="text-slate-500 text-sm font-medium">Locate tools based on last known job usage.</p>
            </div>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">Tracked Items Database</h2>
                <span className="bg-white border border-slate-200 px-3 py-1 rounded-full text-[10px] font-bold text-slate-600">
                    {sortedEquipment.length} Items
                </span>
            </div>
            
            <div className="divide-y divide-slate-100">
                {sortedEquipment.length === 0 ? (
                    <div className="p-12 text-center text-slate-400 italic">No equipment currently tracked.</div>
                ) : (
                    sortedEquipment.map(item => (
                        <div key={item.id} className="p-6 hover:bg-slate-50 transition-colors flex flex-col md:flex-row gap-4">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <Wrench className="w-4 h-4 text-brand" />
                                    <span className="font-bold text-slate-900">{item.name}</span>
                                </div>
                                <div className="text-xs text-slate-400 font-medium ml-6">ID: {item.id.substring(0,8)}</div>
                            </div>
                            
                            <div className="flex-1 md:border-l md:border-slate-100 md:pl-6">
                                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Last Known Location</div>
                                {item.lastSeen ? (
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                                            <MapPin className="w-4 h-4 text-slate-400" /> 
                                            {item.lastSeen.customerName}
                                        </div>
                                        <div className="flex items-center gap-4 ml-6 text-xs text-slate-500">
                                            <span className="flex items-center gap-1"><Calendar className="w-3 h-3"/> {new Date(item.lastSeen.date).toLocaleDateString()}</span>
                                            <span className="flex items-center gap-1"><User className="w-3 h-3"/> {item.lastSeen.crewMember}</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-sm italic text-slate-400 flex items-center gap-2">
                                        <AlertCircle className="w-4 h-4" /> No usage history logged.
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    </div>
  );
};

// Import AlertCircle for fallback display
import { AlertCircle } from 'lucide-react';
