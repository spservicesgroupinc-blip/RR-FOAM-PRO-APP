
import React, { useMemo, useEffect, useState } from 'react';
import { Loader2, Download, X } from 'lucide-react';
import { 
  CalculationMode, 
  EstimateRecord,
  CustomerProfile,
  CalculatorState,
  EquipmentItem,
  InvoiceLineItem
} from '../types';
import { useCalculator, DEFAULT_STATE } from '../context/CalculatorContext';
import { useSync } from '../hooks/useSync';
import { useEstimates } from '../hooks/useEstimates';
import { calculateResults } from '../utils/calculatorHelpers';
import { generateEstimatePDF, generateDocumentPDF, generateWorkOrderPDF } from '../utils/pdfGenerator';
import { syncUp } from '../services/api';

import LoginPage from './LoginPage';
import { LandingPage } from './LandingPage';
import { Layout } from './Layout';
import { Calculator } from './Calculator';
import { Dashboard } from './Dashboard';
import { Warehouse } from './Warehouse';
import { Customers } from './Customers';
import { Settings } from './Settings';
import { Profile } from './Profile';
import { WorkOrderStage } from './WorkOrderStage';
import { InvoiceStage } from './InvoiceStage';
import { EstimateStage } from './EstimateStage'; // NEW IMPORT
import { CrewDashboard } from './CrewDashboard';
import { MaterialOrder } from './MaterialOrder';
import { MaterialReport } from './MaterialReport';
import { EstimateDetail } from './EstimateDetail';
import { EquipmentTracker } from './EquipmentTracker';

const SprayFoamCalculator: React.FC = () => {
  const { state, dispatch } = useCalculator();
  const { appData, ui, session } = state;
  const { handleManualSync, forceRefresh } = useSync(); 
  const { loadEstimateForEditing, saveEstimate, handleDeleteEstimate, handleMarkPaid, saveCustomer, confirmWorkOrder, createPurchaseOrder } = useEstimates();

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [autoTriggerCustomerModal, setAutoTriggerCustomerModal] = useState(false);
  const [initialDashboardFilter, setInitialDashboardFilter] = useState<'all' | 'work_orders'>('all');

  // Handle PWA Installation Logic
  useEffect(() => {
    // Check if already in standalone mode
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    if (isStandalone) return;

    const handler = (e: any) => {
      // Prevent Chrome from showing its own prompt immediately
      e.preventDefault();
      // Stash the event
      setDeferredPrompt(e);
      console.log('PWA: Install prompt detected.');
    };
    
    window.addEventListener('beforeinstallprompt', handler);
    
    const installedHandler = () => {
      setDeferredPrompt(null);
      console.log('PWA: Installed.');
      dispatch({ type: 'SET_NOTIFICATION', payload: { type: 'success', message: 'App Installed Successfully' } });
    };
    window.addEventListener('appinstalled', installedHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, [dispatch]);

  // Handle PWA Shortcuts and Deep Links
  useEffect(() => {
    if (session && ui.isInitialized) {
        const params = new URLSearchParams(window.location.search);
        const action = params.get('action');
        if (action === 'new_estimate') {
            resetCalculator();
            dispatch({ type: 'SET_VIEW', payload: 'calculator' });
            window.history.replaceState({}, document.title, window.location.pathname);
        } else if (action === 'warehouse') {
            dispatch({ type: 'SET_VIEW', payload: 'warehouse' });
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }
  }, [session, ui.isInitialized]);

  const handleInstallApp = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const results = useMemo(() => calculateResults(appData), [appData]);

  const handleLogout = () => {
    dispatch({ type: 'LOGOUT' });
    localStorage.removeItem('foamProSession');
  };

  const resetCalculator = () => {
    dispatch({ type: 'RESET_CALCULATOR' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleInputChange = (field: keyof CalculatorState, value: any) => {
    dispatch({ type: 'UPDATE_DATA', payload: { [field]: value } });
  };

  const handleSettingsChange = (category: 'wallSettings' | 'roofSettings', field: string, value: any) => {
    dispatch({ type: 'UPDATE_NESTED_DATA', category, field, value });
  };

  const handleProfileChange = (field: keyof typeof appData.companyProfile, value: string) => {
    dispatch({ 
        type: 'UPDATE_DATA', 
        payload: { companyProfile: { ...appData.companyProfile, [field]: value } } 
    });
  };

  const handleWarehouseStockChange = (field: 'openCellSets' | 'closedCellSets', value: number) => {
    dispatch({ 
        type: 'UPDATE_DATA', 
        payload: { warehouse: { ...appData.warehouse, [field]: Math.max(0, value) } } 
    });
  };

  const handleCreateWarehouseItem = (name: string, unit: string, cost: number) => {
      const newItem = {
          id: Math.random().toString(36).substr(2, 9),
          name, unit, unitCost: cost, quantity: 0
      };
      dispatch({ type: 'UPDATE_DATA', payload: { warehouse: { ...appData.warehouse, items: [...appData.warehouse.items, newItem] } } });
  };

  const handleCustomerSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const custId = e.target.value;
    if (custId === 'new') {
        dispatch({ type: 'UPDATE_DATA', payload: { customerProfile: { ...DEFAULT_STATE.customerProfile } } });
    } else {
        const selected = appData.customers.find(c => c.id === custId);
        if (selected) dispatch({ type: 'UPDATE_DATA', payload: { customerProfile: { ...selected } } });
    }
  };

  const archiveCustomer = (id: string) => {
    if (confirm("Archive this customer?")) {
        const updated = appData.customers.map(c => c.id === id ? { ...c, status: 'Archived' as const } : c);
        dispatch({ type: 'UPDATE_DATA', payload: { customers: updated } });
    }
  };

  const updateInventoryItem = (id: string, field: string, value: any) => { 
    const updatedInv = appData.inventory.map(i => i.id === id ? { ...i, [field]: value } : i);
    dispatch({ type: 'UPDATE_DATA', payload: { inventory: updatedInv } });
  };

  const addInventoryItem = () => {
      const newItem = { id: Math.random().toString(36).substr(2,9), name: '', quantity: 1, unit: 'pcs' };
      dispatch({ type: 'UPDATE_DATA', payload: { inventory: [...appData.inventory, newItem] } });
  };

  const removeInventoryItem = (id: string) => {
      dispatch({ type: 'UPDATE_DATA', payload: { inventory: appData.inventory.filter(i => i.id !== id) } });
  };

  const updateWarehouseItem = (id: string, field: string, value: any) => {
     const updatedItems = appData.warehouse.items.map(i => i.id === id ? { ...i, [field]: value } : i);
     dispatch({ type: 'UPDATE_DATA', payload: { warehouse: { ...appData.warehouse, items: updatedItems } } });
  };

  const addEquipment = () => {
      const newEq: EquipmentItem = { id: Math.random().toString(36).substr(2,9), name: '', status: 'Available' };
      dispatch({ type: 'UPDATE_DATA', payload: { equipment: [...(appData.equipment || []), newEq] } });
  };
  const removeEquipment = (id: string) => {
      dispatch({ type: 'UPDATE_DATA', payload: { equipment: appData.equipment.filter(e => e.id !== id) } });
  };
  const updateEquipment = (id: string, field: keyof EquipmentItem, value: any) => {
      const updated = appData.equipment.map(e => e.id === id ? { ...e, [field]: value } : e);
      dispatch({ type: 'UPDATE_DATA', payload: { equipment: updated } });
  };

  const handleSaveAndMarkPaid = async (lines: InvoiceLineItem[]) => {
      // Pass lines here to ensure they are saved.
      const totalFromLines = lines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0);

      const savedRecord = await saveEstimate(results, 'Invoiced', {
          invoiceLines: lines,
          totalValue: totalFromLines
      });

      if (savedRecord) {
          if (session?.spreadsheetId) {
             dispatch({ type: 'SET_SYNC_STATUS', payload: 'syncing' });
             const stateSnapshot = {
                 ...appData,
                 savedEstimates: appData.savedEstimates.map(e => e.id === savedRecord.id ? savedRecord : e)
             };
             await syncUp(stateSnapshot, session.spreadsheetId);
          }
          await handleMarkPaid(savedRecord.id);
      }
  };

  const handleStageWorkOrder = () => {
    if (!appData.customerProfile.name) { 
        dispatch({ type: 'SET_NOTIFICATION', payload: { type: 'error', message: 'Customer Name Required' } });
        return; 
    }
    dispatch({ type: 'SET_VIEW', payload: 'work_order_stage' });
  };

  const handleStageInvoice = () => {
    if (!appData.customerProfile.name) { 
        dispatch({ type: 'SET_NOTIFICATION', payload: { type: 'error', message: 'Customer Name Required' } });
        return; 
    }
    if (!appData.invoiceDate) {
        dispatch({ type: 'UPDATE_DATA', payload: { invoiceDate: new Date().toISOString().split('T')[0] } });
    }
    dispatch({ type: 'SET_VIEW', payload: 'invoice_stage' });
  };

  const handleStageEstimate = () => {
    if (!appData.customerProfile.name) { 
        dispatch({ type: 'SET_NOTIFICATION', payload: { type: 'error', message: 'Customer Name Required' } });
        return; 
    }
    dispatch({ type: 'SET_VIEW', payload: 'estimate_stage' });
  };

  // Called after InvoiceStage saves its lines to the record
  const handleConfirmInvoice = async (record?: EstimateRecord) => {
    const finalRecord = record || appData.savedEstimates.find(e => e.id === ui.editingEstimateId);
    
    if (finalRecord) {
        await generateDocumentPDF(appData, finalRecord.results, 'INVOICE', finalRecord);
        dispatch({ type: 'SET_VIEW', payload: 'dashboard' });
    } else {
        const newRec = await saveEstimate(results, 'Invoiced');
        if (newRec) {
            await generateDocumentPDF(appData, results, 'INVOICE', newRec);
            dispatch({ type: 'SET_VIEW', payload: 'dashboard' });
        }
    }
  };

  // Called after EstimateStage saves its lines
  const handleConfirmEstimate = async (record: EstimateRecord, shouldPrint: boolean) => {
      if (shouldPrint) {
          await generateEstimatePDF(appData, record.results, record);
      }
      dispatch({ type: 'SET_VIEW', payload: 'dashboard' });
  };

  // Called when WorkOrderStage confirms
  const handleConfirmWorkOrder = async (customLines: InvoiceLineItem[]) => {
      await confirmWorkOrder(results, customLines);
  };

  const handleQuickAction = (action: 'new_estimate' | 'new_customer' | 'new_invoice') => {
    switch(action) {
      case 'new_customer':
        dispatch({ type: 'SET_VIEW', payload: 'customers' });
        setAutoTriggerCustomerModal(true);
        break;
      case 'new_estimate':
        resetCalculator();
        dispatch({ type: 'SET_VIEW', payload: 'calculator' });
        break;
      case 'new_invoice':
        setInitialDashboardFilter('work_orders');
        dispatch({ type: 'SET_VIEW', payload: 'dashboard' });
        dispatch({ type: 'SET_NOTIFICATION', payload: { type: 'success', message: 'Select a sold job to invoice' } });
        break;
    }
  };

  // Helper logic for Dashboard Routing
  const handleEditFromDashboard = (rec: EstimateRecord) => {
      dispatch({ type: 'SET_EDITING_ESTIMATE', payload: rec.id });
      loadEstimateForEditing(rec);
      
      // SMART ROUTING: 
      if (rec.status === 'Work Order' && rec.executionStatus === 'Completed') {
          dispatch({ type: 'SET_VIEW', payload: 'invoice_stage' });
      }
  };

  if (!ui.hasTrialAccess && !session) {
      return <LandingPage onEnterApp={() => dispatch({ type: 'SET_TRIAL_ACCESS', payload: true })} />;
  }

  if (!session) {
      return <LoginPage 
          onLoginSuccess={(s) => { 
              dispatch({ type: 'SET_SESSION', payload: s }); 
              localStorage.setItem('foamProSession', JSON.stringify(s)); 
              localStorage.setItem('foamProTrialAccess', 'true');
          }} 
          installPrompt={deferredPrompt}
          onInstall={handleInstallApp}
      />;
  }

  if (ui.isLoading) return <div className="flex h-screen items-center justify-center text-slate-400 bg-slate-900"><Loader2 className="animate-spin mr-2"/> Initializing Enterprise Workspace...</div>;

  if (session.role === 'crew') {
      return (
          <CrewDashboard 
            state={appData} 
            onLogout={handleLogout} 
            syncStatus={ui.syncStatus}
            onSync={forceRefresh} 
            installPrompt={deferredPrompt}
            onInstall={handleInstallApp}
          />
      );
  }

  return (
    <Layout 
      userSession={session} 
      view={ui.view} 
      setView={(v) => dispatch({ type: 'SET_VIEW', payload: v })} 
      syncStatus={ui.syncStatus}
      onLogout={handleLogout}
      onReset={resetCalculator}
      notification={ui.notification}
      clearNotification={() => dispatch({ type: 'SET_NOTIFICATION', payload: null })}
      onQuickAction={handleQuickAction}
      installPrompt={deferredPrompt}
      onInstall={handleInstallApp}
    >
        {/* Persistent Floating Install Icon */}
        {deferredPrompt && (
          <div className="fixed bottom-6 right-6 z-[100] animate-in slide-in-from-bottom-10 fade-in duration-500">
             <button 
                onClick={handleInstallApp}
                className="group flex items-center gap-3 bg-slate-900 text-white pl-4 pr-6 py-4 rounded-full shadow-2xl border-2 border-slate-700 hover:bg-brand hover:border-brand transition-all hover:scale-105 active:scale-95"
                title="Install Desktop App"
             >
                <div className="bg-white/10 p-1.5 rounded-full group-hover:bg-white/20 transition-colors">
                    <Download className="w-5 h-5 animate-pulse" />
                </div>
                <div className="flex flex-col items-start">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 group-hover:text-white/80 transition-colors leading-none mb-0.5">Desktop App</span>
                    <span className="font-bold text-sm leading-none">Install Now</span>
                </div>
             </button>
          </div>
        )}

        {ui.view === 'dashboard' && (
            <Dashboard 
                state={appData} 
                onEditEstimate={handleEditFromDashboard}
                onDeleteEstimate={handleDeleteEstimate}
                onNewEstimate={() => { resetCalculator(); dispatch({ type: 'SET_VIEW', payload: 'calculator' }); }}
                onMarkPaid={handleMarkPaid}
                initialFilter={initialDashboardFilter}
                onGoToWarehouse={() => dispatch({ type: 'SET_VIEW', payload: 'warehouse' })}
                onViewInvoice={async (rec) => await generateDocumentPDF(appData, rec.results, 'INVOICE', rec)}
                onSync={forceRefresh}
            />
        )}

        {ui.view === 'calculator' && (
            <Calculator 
                state={appData}
                results={results}
                editingEstimateId={ui.editingEstimateId}
                onInputChange={handleInputChange}
                onSettingsChange={handleSettingsChange}
                onCustomerSelect={handleCustomerSelect}
                onInventoryUpdate={updateInventoryItem}
                onAddInventory={addInventoryItem}
                onRemoveInventory={removeInventoryItem}
                onSaveEstimate={(status) => saveEstimate(results, status)}
                onGeneratePDF={async () => await generateEstimatePDF(appData, results)}
                onStageWorkOrder={handleStageWorkOrder}
                onStageInvoice={handleStageInvoice}
                onStageEstimate={handleStageEstimate} // Pass new handler
                onAddNewCustomer={() => { dispatch({ type: 'SET_VIEW', payload: 'customers' }); setAutoTriggerCustomerModal(true); }}
                onMarkPaid={handleMarkPaid}
                onCreateWarehouseItem={handleCreateWarehouseItem}
            />
        )}

        {ui.view === 'estimate_detail' && ui.editingEstimateId && (
            <EstimateDetail 
                record={appData.savedEstimates.find(e => e.id === ui.editingEstimateId) || ({} as EstimateRecord)}
                results={results} 
                onBack={() => dispatch({ type: 'SET_VIEW', payload: 'dashboard' })}
                onEdit={() => dispatch({ type: 'SET_VIEW', payload: 'calculator' })}
                onGeneratePDF={async () => await generateEstimatePDF(appData, results, appData.savedEstimates.find(e => e.id === ui.editingEstimateId))}
                onSold={handleStageWorkOrder}
                onInvoice={handleStageInvoice}
            />
        )}

        {ui.view === 'work_order_stage' && (
            <WorkOrderStage 
                state={appData}
                results={results}
                onUpdateState={handleInputChange}
                onCancel={() => dispatch({ type: 'SET_VIEW', payload: 'calculator' })}
                onConfirm={handleConfirmWorkOrder} 
            />
        )}

        {ui.view === 'invoice_stage' && (
            <InvoiceStage 
                state={appData}
                results={results}
                currentRecord={appData.savedEstimates.find(e => e.id === ui.editingEstimateId)}
                onUpdateState={handleInputChange}
                onUpdateExpense={(field, val) => dispatch({ type: 'UPDATE_DATA', payload: { expenses: { ...appData.expenses, [field]: val } } })}
                onCancel={() => dispatch({ type: 'SET_VIEW', payload: 'dashboard' })}
                onConfirm={handleConfirmInvoice}
                onMarkPaid={handleMarkPaid}
                onSaveAndMarkPaid={handleSaveAndMarkPaid}
            />
        )}

        {/* NEW: Estimate Stage View */}
        {ui.view === 'estimate_stage' && (
            <EstimateStage 
                state={appData}
                results={results}
                currentRecord={appData.savedEstimates.find(e => e.id === ui.editingEstimateId)}
                onUpdateState={handleInputChange}
                onCancel={() => dispatch({ type: 'SET_VIEW', payload: 'calculator' })}
                onConfirm={handleConfirmEstimate}
            />
        )}

        {ui.view === 'warehouse' && (
            <Warehouse 
                state={appData}
                onStockChange={handleWarehouseStockChange}
                onAddItem={() => dispatch({ type: 'UPDATE_DATA', payload: { warehouse: { ...appData.warehouse, items: [...appData.warehouse.items, { id: Math.random().toString(36).substr(2,9), name: '', quantity: 0, unit: 'pcs', unitCost: 0 }] } } })}
                onRemoveItem={(id) => dispatch({ type: 'UPDATE_DATA', payload: { warehouse: { ...appData.warehouse, items: appData.warehouse.items.filter(i => i.id !== id) } } })}
                onUpdateItem={updateWarehouseItem}
                onFinishSetup={() => dispatch({ type: 'SET_VIEW', payload: 'dashboard' })}
                onViewReport={() => dispatch({ type: 'SET_VIEW', payload: 'material_report' })}
                onViewEquipmentTracker={() => dispatch({ type: 'SET_VIEW', payload: 'equipment_tracker' })}
                onAddEquipment={addEquipment}
                onRemoveEquipment={removeEquipment}
                onUpdateEquipment={updateEquipment}
            />
        )}

        {ui.view === 'material_order' && (
            <MaterialOrder 
                state={appData}
                onCancel={() => dispatch({ type: 'SET_VIEW', payload: 'warehouse' })}
                onSavePO={createPurchaseOrder}
            />
        )}

        {ui.view === 'material_report' && (
            <MaterialReport 
                state={appData}
                onBack={() => dispatch({ type: 'SET_VIEW', payload: 'warehouse' })}
            />
        )}

        {ui.view === 'equipment_tracker' && (
            <EquipmentTracker 
                state={appData}
                onBack={() => dispatch({ type: 'SET_VIEW', payload: 'warehouse' })}
            />
        )}

        {(ui.view === 'customers' || ui.view === 'customer_detail') && (
            <Customers 
                state={appData}
                viewingCustomerId={ui.view === 'customer_detail' ? ui.viewingCustomerId : null}
                onSelectCustomer={(id) => { 
                    dispatch({ type: 'SET_VIEWING_CUSTOMER', payload: id }); 
                    dispatch({ type: 'SET_VIEW', payload: id ? 'customer_detail' : 'customers' }); 
                }}
                onSaveCustomer={saveCustomer}
                onArchiveCustomer={archiveCustomer}
                onStartEstimate={(customer) => { 
                    resetCalculator(); 
                    dispatch({ type: 'UPDATE_DATA', payload: { customerProfile: customer } }); 
                    dispatch({ type: 'SET_VIEW', payload: 'calculator' }); 
                }}
                onLoadEstimate={loadEstimateForEditing}
                autoOpen={autoTriggerCustomerModal}
                onAutoOpenComplete={() => setAutoTriggerCustomerModal(false)}
            />
        )}

        {ui.view === 'settings' && (
            <Settings 
                state={appData}
                onUpdateState={(partial) => dispatch({ type: 'UPDATE_DATA', payload: partial })}
                onManualSync={handleManualSync}
                syncStatus={ui.syncStatus}
                onNext={() => {
                   dispatch({ type: 'SET_VIEW', payload: 'warehouse' });
                   dispatch({ type: 'SET_NOTIFICATION', payload: { type: 'success', message: 'Settings Saved. Now update your inventory.' } });
                }}
                username={session?.username}
            />
        )}

        {ui.view === 'profile' && (
            <Profile 
                state={appData}
                onUpdateProfile={handleProfileChange}
                onManualSync={handleManualSync}
                syncStatus={ui.syncStatus}
                username={session?.username} 
                spreadsheetId={session?.spreadsheetId} 
            />
        )}
    </Layout>
  );
};

export default SprayFoamCalculator;
