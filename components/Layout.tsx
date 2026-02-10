
import React, { useEffect, useState } from 'react';
import { 
  LayoutDashboard, 
  Plus, 
  Warehouse, 
  Users, 
  User, 
  LogOut, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  X,
  Calculator,
  UserPlus,
  Receipt,
  Copy,
  Download,
  Menu
} from 'lucide-react';
import { UserSession } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  userSession: UserSession;
  view: string;
  setView: (view: any) => void;
  syncStatus: 'idle' | 'syncing' | 'error' | 'success' | 'pending';
  onLogout: () => void;
  onReset: () => void;
  notification: { type: 'success' | 'error', message: string } | null;
  clearNotification: () => void;
  onQuickAction: (action: 'new_estimate' | 'new_customer' | 'new_invoice') => void;
  installPrompt: any;
  onInstall: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ 
  children, 
  userSession, 
  view, 
  setView, 
  syncStatus, 
  onLogout,
  onReset,
  notification,
  clearNotification,
  onQuickAction,
  installPrompt,
  onInstall
}) => {
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  
  // Auto-clear notification - Reduced to 2000ms
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        clearNotification();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [notification, clearNotification]);

  const handleAction = (action: 'new_estimate' | 'new_customer' | 'new_invoice') => {
    setIsActionMenuOpen(false);
    onQuickAction(action);
  };

  const copyUsername = () => {
      navigator.clipboard.writeText(userSession.username);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
  };

  const NavButton = ({ target, icon: Icon, label, isAction = false }: any) => {
    const isActive = view === target || (target === 'customers' && view === 'customer_detail');
    
    if (isAction) {
      return (
        <button 
          onClick={() => setIsActionMenuOpen(true)} 
          className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-bold text-sm mb-1
            ${view === 'calculator' 
              ? 'bg-brand text-white shadow-lg shadow-red-200' 
              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'}`}
        >
          <Icon className="w-5 h-5" />
          <span className="md:inline">{label}</span>
        </button>
      );
    }

    return (
      <button 
        onClick={() => setView(target)} 
        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-bold text-sm mb-1
          ${isActive 
            ? 'bg-slate-900 text-white shadow-lg' 
            : 'text-slate-500 hover:bg-slate-100'}`}
      >
        <Icon className="w-5 h-5" />
        <span className="hidden md:inline">{label}</span>
        {/* Mobile Label */}
        <span className="md:hidden text-[10px]">{label}</span> 
      </button>
    );
  };

  const RFESmallLogo = () => (
    <div className="flex items-center gap-2 select-none">
        <div className="bg-brand text-white px-1.5 py-0.5 -skew-x-12 transform origin-bottom-left shadow-sm flex items-center justify-center">
            <span className="skew-x-12 font-black text-lg tracking-tighter">RFE</span>
        </div>
        <div className="flex flex-col justify-center -space-y-0.5">
            <span className="text-xl font-black italic tracking-tighter text-slate-900 leading-none">RFE</span>
            <span className="text-[0.4rem] font-bold tracking-[0.2em] text-brand-yellow bg-black px-1 py-0.5 leading-none">FOAM EQUIPMENT</span>
        </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 font-sans md:pb-0">
      
      {/* Toast Notification */}
      {notification && (
        <div className={`fixed top-16 right-4 md:top-8 md:right-8 z-[60] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl border animate-in slide-in-from-top-5 duration-300 ${
          notification.type === 'success' 
            ? 'bg-slate-900 border-slate-800 text-white' 
            : 'bg-red-50 border-red-100 text-red-600'
        }`}>
           {notification.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <AlertCircle className="w-5 h-5" />}
           <span className="font-bold text-sm">{notification.message}</span>
           <button onClick={clearNotification} className="ml-2 hover:opacity-70"><X className="w-4 h-4"/></button>
        </div>
      )}

      {/* QUICK ACTION MODAL - slides up from bottom on mobile */}
      {isActionMenuOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex md:items-center items-end justify-center md:p-4" onClick={() => setIsActionMenuOpen(false)}>
            <div className="bg-white md:rounded-3xl rounded-t-3xl p-6 w-full md:max-w-sm shadow-2xl scale-100" onClick={e => e.stopPropagation()}>
                {/* Drag handle on mobile */}
                <div className="md:hidden w-10 h-1 bg-slate-200 rounded-full mx-auto mb-4" />
                <div className="flex justify-between items-center mb-5">
                    <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Create New</h3>
                    <button onClick={() => setIsActionMenuOpen(false)} className="p-2 bg-slate-100 rounded-full text-slate-400 hover:bg-slate-200 active:scale-90 transition-all"><X className="w-5 h-5"/></button>
                </div>
                <div className="space-y-2">
                    <button onClick={() => handleAction('new_customer')} className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-slate-50 active:bg-slate-100 border border-slate-100 group transition-all active:scale-[0.98]">
                        <div className="w-12 h-12 rounded-2xl bg-red-50 text-brand flex items-center justify-center group-active:bg-brand group-active:text-white transition-colors">
                            <UserPlus className="w-5 h-5" />
                        </div>
                        <div className="text-left">
                            <div className="font-bold text-slate-900 text-[15px]">New Customer</div>
                            <div className="text-xs text-slate-400 font-medium">Add a new lead to CRM</div>
                        </div>
                    </button>
                    <button onClick={() => handleAction('new_estimate')} className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-slate-50 active:bg-slate-100 border border-slate-100 group transition-all active:scale-[0.98]">
                        <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center group-active:bg-sky-600 group-active:text-white transition-colors">
                            <Calculator className="w-5 h-5" />
                        </div>
                        <div className="text-left">
                            <div className="font-bold text-slate-900 text-[15px]">New Estimate</div>
                            <div className="text-xs text-slate-400 font-medium">Start a blank calculation</div>
                        </div>
                    </button>
                    <button onClick={() => handleAction('new_invoice')} className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-slate-50 active:bg-slate-100 border border-slate-100 group transition-all active:scale-[0.98]">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-active:bg-emerald-600 group-active:text-white transition-colors">
                            <Receipt className="w-5 h-5" />
                        </div>
                        <div className="text-left">
                            <div className="font-bold text-slate-900 text-[15px]">Generate Invoice</div>
                            <div className="text-xs text-slate-400 font-medium">Convert a sold job to invoice</div>
                        </div>
                    </button>
                </div>
                {/* Safe area padding on mobile */}
                <div className="md:hidden h-[env(safe-area-inset-bottom)]" />
            </div>
        </div>
      )}

      {/* Sidebar (Desktop) */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-slate-200 h-screen sticky top-0 z-20">
        <div className="p-6 border-b border-slate-100">
           <div className="cursor-pointer" onClick={() => setView('dashboard')}>
              <RFESmallLogo />
           </div>
        </div>

        <nav className="flex-1 p-4 overflow-y-auto">
          <NavButton target="dashboard" icon={LayoutDashboard} label="Dashboard" />
          <NavButton target="calculator" icon={Plus} label="Create New..." isAction />
          <NavButton target="customers" icon={Users} label="Customers" />
          <NavButton target="warehouse" icon={Warehouse} label="Warehouse" />
          
          <div className="my-4 border-t border-slate-100"></div>
          
          <NavButton target="settings" icon={RefreshCw} label="Settings" />
          <NavButton target="profile" icon={User} label="Profile" />

          {/* Install App Button Desktop */}
          {installPrompt && (
            <button 
              onClick={onInstall}
              className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-bold text-sm mb-1 text-white bg-brand hover:bg-brand-hover mt-4 shadow-lg shadow-red-100 animate-pulse"
            >
              <Download className="w-5 h-5" />
              <span>Install RFE Desktop</span>
            </button>
          )}
        </nav>

        <div className="p-4 border-t border-slate-100 bg-slate-50">
           <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-900 truncate max-w-[120px]" title={userSession.companyName}>{userSession.companyName}</span>
                <button 
                    onClick={copyUsername}
                    className="flex items-center gap-1.5 text-[10px] text-slate-500 font-medium bg-white border border-slate-200 px-2 py-1 rounded-md my-1 w-fit hover:border-red-200 hover:text-brand transition-colors group"
                    title="Click to copy Company ID"
                >
                    <span className="uppercase tracking-wider text-slate-400 group-hover:text-red-400">ID:</span>
                    <span className="font-bold font-mono">{userSession.username}</span>
                    {copiedId ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />}
                </button>
                <span className="text-[10px] text-slate-400">
                  {syncStatus === 'syncing' && 'Syncing...'}
                  {syncStatus === 'success' && 'Synced'}
                  {syncStatus === 'error' && 'Offline'}
                  {syncStatus === 'idle' && 'Active'}
                </span>
              </div>
              <button onClick={onLogout} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                <LogOut className="w-4 h-4" />
              </button>
           </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 md:p-8 p-3 sm:p-4 overflow-x-hidden pt-0 md:pt-8 pb-28 md:pb-8">
        {/* Mobile Header - sticky, glassmorphism */}
        <div className="md:hidden sticky top-0 z-30 -mx-3 sm:-mx-4 px-3 sm:px-4 pt-[env(safe-area-inset-top)] mb-4">
          <div className="flex items-center justify-between py-3 bg-white/80 backdrop-blur-xl border-b border-slate-100">
            <div className="flex items-center gap-2 min-w-0" onClick={() => setView('dashboard')}>
              <div className="shrink-0">
                <RFESmallLogo />
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {installPrompt && (
                <button onClick={onInstall} className="p-2 text-brand bg-red-50 rounded-xl border border-red-100 transition-all active:scale-90">
                  <Download className="w-4 h-4" />
                </button>
              )}
              <div className="p-2">
                {syncStatus === 'syncing' && <RefreshCw className="w-4 h-4 text-brand animate-spin"/>}
                {syncStatus === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-500"/>}
                {syncStatus === 'error' && <AlertCircle className="w-4 h-4 text-amber-500"/>}
                {syncStatus === 'idle' && <div className="w-2 h-2 rounded-full bg-emerald-400" />}
              </div>
              <button onClick={onLogout} className="p-2 text-slate-400 hover:text-red-500 rounded-xl transition-all active:scale-90">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {children}
      </main>

      {/* Mobile Bottom Nav - Modern with raised center FAB */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50">
        {/* Curved background with notch effect */}
        <div className="relative">
          {/* Center FAB Button - raised above the bar */}
          <div className="absolute left-1/2 -translate-x-1/2 -top-7 z-10">
            <button 
              onClick={() => setIsActionMenuOpen(true)}
              className={`w-[60px] h-[60px] rounded-full flex items-center justify-center shadow-xl transition-all duration-300 active:scale-90 ${
                view === 'calculator' || isActionMenuOpen
                  ? 'bg-brand shadow-red-300/50 scale-105' 
                  : 'bg-slate-900 shadow-slate-900/30 hover:bg-brand'
              }`}
              style={{ boxShadow: '0 4px 24px rgba(227,6,19,0.35)' }}
            >
              <Plus className={`w-7 h-7 text-white transition-transform duration-300 ${isActionMenuOpen ? 'rotate-45' : ''}`} />
            </button>
          </div>

          {/* Nav bar body */}
          <div className="bg-white/95 backdrop-blur-xl border-t border-slate-100 px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]" 
               style={{ boxShadow: '0 -8px 32px rgba(0,0,0,0.06)' }}>
            <div className="flex items-end justify-around max-w-md mx-auto">
              {/* Left items */}
              <MobileNavItem 
                icon={LayoutDashboard} 
                label="Home" 
                isActive={view === 'dashboard'} 
                onClick={() => setView('dashboard')} 
              />
              <MobileNavItem 
                icon={Users} 
                label="Leads" 
                isActive={view === 'customers' || view === 'customer_detail'} 
                onClick={() => setView('customers')} 
              />
              
              {/* Center spacer for FAB */}
              <div className="w-[72px] flex flex-col items-center pt-1 pb-0.5">
                <span className={`text-[9px] font-bold mt-5 transition-colors ${view === 'calculator' || isActionMenuOpen ? 'text-brand' : 'text-slate-400'}`}>Create</span>
              </div>

              {/* Right items */}
              <MobileNavItem 
                icon={Warehouse} 
                label="Stock" 
                isActive={view === 'warehouse'} 
                onClick={() => setView('warehouse')} 
              />
              <MobileNavItem 
                icon={User} 
                label="Profile" 
                isActive={view === 'profile' || view === 'settings'} 
                onClick={() => setView('profile')} 
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* Mobile Nav Item sub-component */
const MobileNavItem: React.FC<{ icon: any; label: string; isActive: boolean; onClick: () => void }> = ({ icon: Icon, label, isActive, onClick }) => (
  <button 
    onClick={onClick} 
    className={`flex flex-col items-center justify-end min-w-[56px] py-1.5 px-1 rounded-xl transition-all duration-200 active:scale-90 ${
      isActive 
        ? 'text-brand' 
        : 'text-slate-400 active:text-slate-600'
    }`}
  >
    <div className={`p-1.5 rounded-xl transition-all duration-200 ${isActive ? 'bg-red-50' : ''}`}>
      <Icon className={`w-5 h-5 transition-all duration-200 ${isActive ? 'scale-110' : ''}`} />
    </div>
    <span className={`text-[9px] font-bold mt-0.5 transition-colors ${isActive ? 'text-brand' : 'text-slate-400'}`}>{label}</span>
    {/* Active indicator dot */}
    {isActive && <div className="w-1 h-1 rounded-full bg-brand mt-0.5" />}
  </button>
);
