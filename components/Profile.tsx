
import React, { useState } from 'react';
import { Upload, Save, Loader2, Users, KeyRound, ShieldCheck, Copy } from 'lucide-react';
import { CalculatorState } from '../types';
import { uploadImage } from '../services/api';

interface ProfileProps {
  state: CalculatorState;
  onUpdateProfile: (field: string, value: string) => void;
  onManualSync: () => void;
  syncStatus: string;
  username?: string; // Passed from session to display Company ID
  spreadsheetId?: string; // Needed for upload auth
}

export const Profile: React.FC<ProfileProps> = ({ state, onUpdateProfile, onManualSync, syncStatus, username, spreadsheetId }) => {
  const [isUploading, setIsUploading] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Check size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
        alert("File too large. Max 5MB.");
        return;
    }

    setIsUploading(true);
    try {
        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64 = reader.result as string;
            
            if (spreadsheetId) {
                const url = await uploadImage(base64, spreadsheetId, "company_logo.jpg");
                if (url) {
                    onUpdateProfile('logoUrl', url);
                } else {
                    alert("Upload failed. Please try again.");
                }
            } else {
                alert("Online session required to upload logo.");
            }
            setIsUploading(false);
        };
        reader.readAsDataURL(file);
    } catch (err) {
        console.error(err);
        alert("Error reading file.");
        setIsUploading(false);
    }
  };

  return (
     <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in zoom-in duration-200 pb-20">
         <div className="flex justify-between items-end mb-2">
             <div>
                <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Organization Profile</h2>
                <p className="text-slate-500 font-medium text-sm">Manage company branding and crew access credentials.</p>
             </div>
         </div>

         {/* MAIN PROFILE CARD */}
         <div className="bg-white p-8 md:p-10 rounded-3xl border shadow-sm space-y-10">
             
             {/* 1. BRANDING SECTION */}
             <div className="flex flex-col md:flex-row gap-12">
                 <div className="flex flex-col items-center gap-6">
                     <div className="w-40 h-40 bg-slate-50 rounded-3xl flex items-center justify-center border-4 border-dashed border-slate-100 overflow-hidden relative group shadow-inner">
                         {isUploading ? (
                             <Loader2 className="w-10 h-10 text-brand animate-spin" />
                         ) : state.companyProfile.logoUrl ? (
                             <img src={state.companyProfile.logoUrl} alt="Logo" className="w-full h-full object-contain p-4" />
                         ) : (
                             <Upload className="w-10 h-10 text-slate-200" />
                         )}
                         <input 
                            type="file" 
                            accept="image/*" 
                            onChange={handleLogoUpload} 
                            disabled={isUploading}
                            className="absolute inset-0 opacity-0 cursor-pointer z-20 disabled:cursor-not-allowed" 
                         />
                         {!isUploading && (
                             <div className="absolute inset-0 bg-slate-900/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-black uppercase tracking-widest z-10 pointer-events-none">Upload Logo</div>
                         )}
                     </div>
                     <div className="text-center"> <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Branding</p> <p className="text-xs font-medium text-slate-400 mt-1 italic">Used on PDF Estimates</p> </div>
                 </div>
                 <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6">
                     <div className="md:col-span-2"> <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Company Name</label> <input type="text" value={state.companyProfile.companyName} onChange={(e) => onUpdateProfile('companyName', e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:ring-2 focus:ring-brand outline-none" /> </div>
                     <div className="md:col-span-2"> <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Business Address</label> <input type="text" value={state.companyProfile.addressLine1} onChange={(e) => onUpdateProfile('addressLine1', e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:ring-2 focus:ring-brand outline-none" /> </div>
                     <div> <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Phone</label> <input type="text" value={state.companyProfile.phone} onChange={(e) => onUpdateProfile('phone', e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:ring-2 focus:ring-brand outline-none" /> </div>
                     <div> <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Email</label> <input type="email" value={state.companyProfile.email} onChange={(e) => onUpdateProfile('email', e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:ring-2 focus:ring-brand outline-none" /> </div>
                 </div>
             </div>

             {/* 2. CREW ACCESS SECTION (Moved from Settings) */}
             <div className="border-t border-slate-100 pt-8">
                <div className="flex items-center gap-2 mb-6">
                    <div className="p-2 bg-slate-100 rounded-lg text-slate-600">
                        <Users className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Crew Login Credentials</h3>
                        <p className="text-xs text-slate-500 font-medium">Share these details with your crew to allow app access.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Read Only Username */}
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 relative group">
                        <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                            <ShieldCheck className="w-3 h-3"/> Company ID (Username)
                        </label>
                        <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-xl text-slate-700">{username || "Loading..."}</span>
                            <button onClick={() => username && copyToClipboard(username)} className="p-2 hover:bg-white rounded-lg text-slate-400 hover:text-brand transition-colors" title="Copy ID">
                                <Copy className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Editable PIN */}
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 focus-within:ring-2 focus-within:ring-brand focus-within:border-brand transition-all">
                        <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                            <KeyRound className="w-3 h-3"/> Crew Access PIN
                        </label>
                        <input 
                            type="text" 
                            value={state.companyProfile.crewAccessPin || ''} 
                            onChange={(e) => onUpdateProfile('crewAccessPin', e.target.value)}
                            className="w-full bg-transparent font-mono font-bold text-xl text-slate-900 outline-none placeholder-slate-300"
                            placeholder="Create 4-Digit PIN"
                        />
                    </div>
                </div>
                <p className="mt-3 text-[10px] text-slate-400 font-medium italic">
                    * Updating the PIN requires a "Save & Sync" to take effect on crew devices.
                </p>
             </div>
             
             {/* SAVE BUTTON */}
             <div className="mt-8 pt-8 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
                <p className="text-xs text-slate-400 font-medium italic">Changes are saved automatically locally, but you must sync to update the cloud.</p>
                <button 
                    onClick={onManualSync}
                    className="w-full md:w-auto bg-slate-900 hover:bg-slate-800 text-white font-black py-4 px-10 rounded-2xl flex items-center justify-center gap-2 uppercase text-xs tracking-widest transition-all active:scale-95 shadow-xl shadow-slate-200"
                >
                    {syncStatus === 'syncing' ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4" />}
                    Save & Sync Profile
                </button>
             </div>
         </div>
     </div>
  );
};
