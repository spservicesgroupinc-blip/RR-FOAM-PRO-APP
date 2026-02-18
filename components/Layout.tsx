
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
  Menu,
  Wrench,
  ClipboardList,
  FileText,
  Settings,
  ChevronDown,
  ChevronRight,
  Package,
  Truck,
  BarChart3,
  HardHat,
  MoreHorizontal,
  Cog
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
  onOpenPDFGenerator: () => void;
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
  onOpenPDFGenerator,
  installPrompt,
  onInstall
}) => {
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const [isMobileMoreOpen, setIsMobileMoreOpen] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  
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

  const toggleSection = (section: string) => {
    setCollapsedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // Navigation item component for desktop sidebar
  const SidebarItem = ({ target, icon: Icon, label, badge }: { target: string; icon: any; label: string; badge?: number }) => {
    const isActive = view === target || (target === 'customers' && view === 'customer_detail');
    return (
      <button 
        onClick={() => setView(target)} 
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all font-semibold text-[13px] group
          ${isActive 
            ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20' 
            : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`}
      >
        <Icon className={`w-[18px] h-[18px] shrink-0 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'}`} />
        <span className="truncate">{label}</span>
        {badge !== undefined && badge > 0 && (
          <span className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/20 text-white' : 'bg-red-100 text-red-600'}`}>
            {badge}
          </span>
        )}
      </button>
    );
  };

  // Section header for desktop sidebar
  const SectionHeader = ({ title, section }: { title: string; section: string }) => {
    const isCollapsed = collapsedSections[section];
    return (
      <button 
        onClick={() => toggleSection(section)}
        className="w-full flex items-center justify-between px-3 py-2 mt-3 mb-1 group"
      >
        <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400 group-hover:text-slate-600 transition-colors">{title}</span>
        {isCollapsed 
          ? <ChevronRight className="w-3 h-3 text-slate-300 group-hover:text-slate-500" />
          : <ChevronDown className="w-3 h-3 text-slate-300 group-hover:text-slate-500" />
        }
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

      {/* ==================== DESKTOP SIDEBAR ==================== */}
      <aside className="hidden md:flex flex-col w-[270px] bg-white border-r border-slate-200 h-screen sticky top-0 z-20">
        {/* Logo */}
        <div className="p-5 pb-4 border-b border-slate-100">
           <div className="cursor-pointer" onClick={() => setView('dashboard')}>
              <RFESmallLogo />
           </div>
        </div>

        {/* Quick Create Button */}
        <div className="px-3 pt-4 pb-1">
          <button 
            onClick={() => setIsActionMenuOpen(true)} 
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm bg-brand text-white hover:bg-red-700 transition-all shadow-lg shadow-red-200/50 active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>Create New</span>
          </button>
        </div>

        {/* Scrollable Navigation */}
        <nav className="flex-1 px-3 py-1 overflow-y-auto space-y-0.5 scrollbar-thin">
          
          {/* MAIN */}
          <SectionHeader title="Main" section="main" />
          {!collapsedSections.main && (
            <div className="space-y-0.5">
              <SidebarItem target="dashboard" icon={LayoutDashboard} label="Dashboard" />
              <SidebarItem target="calculator" icon={Calculator} label="Estimate Calculator" />
              <button 
                onClick={onOpenPDFGenerator}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all font-semibold text-[13px] group text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              >
                <FileText className="w-[18px] h-[18px] shrink-0 text-slate-400 group-hover:text-slate-600" />
                <span className="truncate">PDF Generator</span>
              </button>
            </div>
          )}

          {/* JOBS & CRM */}
          <SectionHeader title="Jobs & CRM" section="jobs" />
          {!collapsedSections.jobs && (
            <div className="space-y-0.5">
              <SidebarItem target="customers" icon={Users} label="Customers" />
            </div>
          )}

          {/* INVENTORY & EQUIPMENT */}
          <SectionHeader title="Inventory & Equipment" section="inventory" />
          {!collapsedSections.inventory && (
            <div className="space-y-0.5">
              <SidebarItem target="warehouse" icon={Warehouse} label="Warehouse" />
              <SidebarItem target="material_report" icon={BarChart3} label="Material Report" />
              <SidebarItem target="equipment_tracker" icon={Truck} label="Equipment Tracker" />
              <SidebarItem target="equipment_maintenance" icon={Wrench} label="Equipment Maintenance" />
            </div>
          )}

          {/* ACCOUNT */}
          <SectionHeader title="Account" section="account" />
          {!collapsedSections.account && (
            <div className="space-y-0.5">
              <SidebarItem target="settings" icon={Cog} label="Settings" />
              <SidebarItem target="profile" icon={User} label="Profile" />
            </div>
          )}

          {/* Install App Button Desktop */}
          {installPrompt && (
            <div className="mt-4">
              <button 
                onClick={onInstall}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all font-bold text-sm text-white bg-brand hover:bg-red-700 shadow-lg shadow-red-100 animate-pulse"
              >
                <Download className="w-[18px] h-[18px]" />
                <span>Install RFE Desktop</span>
              </button>
            </div>
          )}
        </nav>

        {/* User Footer */}
        <div className="p-3 border-t border-slate-100 bg-slate-50/80">
           <div className="flex items-center justify-between">
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-slate-900 truncate max-w-[160px]" title={userSession.companyName}>{userSession.companyName}</span>
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
              <button onClick={onLogout} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Sign Out">
                <LogOut className="w-4 h-4" />
              </button>
           </div>
        </div>
      </aside>

      {/* ==================== MAIN CONTENT ==================== */}
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

      {/* ==================== MOBILE "MORE" DRAWER ==================== */}
      {isMobileMoreOpen && (
        <div className="md:hidden fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-end" onClick={() => setIsMobileMoreOpen(false)}>
          <div className="bg-white rounded-t-3xl w-full shadow-2xl max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {/* Drag handle */}
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mt-3 mb-2" />
            <div className="flex justify-between items-center px-5 py-3 border-b border-slate-100">
              <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">All Features</h3>
              <button onClick={() => setIsMobileMoreOpen(false)} className="p-2 bg-slate-100 rounded-full text-slate-400 hover:bg-slate-200 active:scale-90 transition-all">
                <X className="w-5 h-5"/>
              </button>
            </div>
            
            <div className="px-4 py-3 space-y-1">
              {/* Main */}
              <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400 px-3 pt-2 pb-1">Main</div>
              <MobileMenuButton icon={LayoutDashboard} label="Dashboard" isActive={view === 'dashboard'} onClick={() => { setView('dashboard'); setIsMobileMoreOpen(false); }} />
              <MobileMenuButton icon={Calculator} label="Estimate Calculator" isActive={view === 'calculator'} onClick={() => { setView('calculator'); setIsMobileMoreOpen(false); }} />
              <MobileMenuButton icon={FileText} label="PDF Generator" isActive={false} onClick={() => { onOpenPDFGenerator(); setIsMobileMoreOpen(false); }} />
              
              {/* Jobs & CRM */}
              <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400 px-3 pt-3 pb-1">Jobs & CRM</div>
              <MobileMenuButton icon={Users} label="Customers" isActive={view === 'customers' || view === 'customer_detail'} onClick={() => { setView('customers'); setIsMobileMoreOpen(false); }} />
              
              {/* Inventory & Equipment */}
              <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400 px-3 pt-3 pb-1">Inventory & Equipment</div>
              <MobileMenuButton icon={Warehouse} label="Warehouse" isActive={view === 'warehouse'} onClick={() => { setView('warehouse'); setIsMobileMoreOpen(false); }} />
              <MobileMenuButton icon={BarChart3} label="Material Report" isActive={view === 'material_report'} onClick={() => { setView('material_report'); setIsMobileMoreOpen(false); }} />
              <MobileMenuButton icon={Truck} label="Equipment Tracker" isActive={view === 'equipment_tracker'} onClick={() => { setView('equipment_tracker'); setIsMobileMoreOpen(false); }} />
              <MobileMenuButton icon={Wrench} label="Equipment Maintenance" isActive={view === 'equipment_maintenance'} onClick={() => { setView('equipment_maintenance'); setIsMobileMoreOpen(false); }} />
              
              {/* Account */}
              <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400 px-3 pt-3 pb-1">Account</div>
              <MobileMenuButton icon={Cog} label="Settings" isActive={view === 'settings'} onClick={() => { setView('settings'); setIsMobileMoreOpen(false); }} />
              <MobileMenuButton icon={User} label="Profile" isActive={view === 'profile'} onClick={() => { setView('profile'); setIsMobileMoreOpen(false); }} />
            </div>
            
            {/* User Info */}
            <div className="px-5 py-4 mt-2 border-t border-slate-100 bg-slate-50">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-900">{userSession.companyName}</span>
                  <span className="text-[10px] text-slate-400 font-mono mt-0.5">ID: {userSession.username}</span>
                </div>
                <button onClick={() => { setIsMobileMoreOpen(false); onLogout(); }} className="flex items-center gap-2 px-3 py-2 text-red-500 bg-red-50 rounded-xl text-xs font-bold hover:bg-red-100 transition-colors">
                  <LogOut className="w-3.5 h-3.5" />
                  Sign Out
                </button>
              </div>
            </div>

            {/* Safe area padding on mobile */}
            <div className="h-[env(safe-area-inset-bottom)]" />
          </div>
        </div>
      )}

      {/* ==================== MOBILE BOTTOM NAV ==================== */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50">
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
                label="CRM" 
                isActive={view === 'customers' || view === 'customer_detail'} 
                onClick={() => setView('customers')} 
              />
              
              {/* Center spacer for FAB */}
              <div className="w-[72px] flex flex-col items-center pt-1 pb-0.5">
                <span className={`text-[9px] font-bold mt-5 transition-colors ${view === 'calculator' || isActionMenuOpen ? 'text-brand' : 'text-slate-400'}`}>Create</span>
              </div>

              {/* Right items */}
              <MobileNavItem 
                icon={Wrench} 
                label="Equip" 
                isActive={view === 'equipment_tracker' || view === 'equipment_maintenance' || view === 'warehouse'} 
                onClick={() => setView('warehouse')} 
              />
              <MobileNavItem 
                icon={MoreHorizontal} 
                label="More" 
                isActive={isMobileMoreOpen || view === 'settings' || view === 'profile' || view === 'material_report'} 
                onClick={() => setIsMobileMoreOpen(true)} 
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* Mobile Nav Item sub-component for bottom bar */
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

/* Mobile Menu Button for the "More" drawer */
const MobileMenuButton: React.FC<{ icon: any; label: string; isActive: boolean; onClick: () => void }> = ({ icon: Icon, label, isActive, onClick }) => (
  <button 
    onClick={onClick} 
    className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all active:scale-[0.98] ${
      isActive 
        ? 'bg-slate-900 text-white' 
        : 'text-slate-700 hover:bg-slate-100 active:bg-slate-200'
    }`}
  >
    <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
    <span className="font-semibold text-sm">{label}</span>
    {isActive && <div className="ml-auto w-2 h-2 rounded-full bg-brand" />}
  </button>
);
