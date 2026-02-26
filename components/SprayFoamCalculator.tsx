
import React, { useMemo, useEffect, useState, useRef } from 'react';
import { Loader2, Download, X } from 'lucide-react';
import {
  CalculationMode,
  EstimateRecord,
  CustomerProfile,
  CalculatorState,
  EquipmentItem,
  InvoiceLineItem,
} from '../types';
import { useCalculator, DEFAULT_STATE } from '../context/CalculatorContext';
import { useSync } from '../hooks/useSync';
import { useEstimates } from '../hooks/useEstimates';
import { calculateResults } from '../utils/calculatorHelpers';
import { generateDocumentPDF, generateEstimatePDF, generateWorkOrderPDF } from '../utils/pdfGenerator';
import { upsertInventoryItem, upsertEquipment, deleteEquipmentItem, upsertCustomer, deleteInventoryItem, updateCompanyProfile } from '../services/supabaseService';
import { getCurrentSession, signOut } from '../services/auth';
import safeStorage from '../utils/safeStorage';

import LoginPage from './LoginPage';
import { Layout } from './Layout';
import { Calculator } from './Calculator';
import { Dashboard } from './Dashboard';
import { Warehouse } from './Warehouse';
import { Customers } from './Customers';
import { Settings } from './Settings';
import { Profile } from './Profile';
import { WorkOrderStage } from './WorkOrderStage';
import { InvoiceStage } from './InvoiceStage';
import { EstimateStage } from './EstimateStage';
import { CrewDashboard } from './CrewDashboard';
import { MaterialOrder } from './MaterialOrder';
import { MaterialReport } from './MaterialReport';
import { EstimateDetail } from './EstimateDetail';
import { EquipmentTracker } from './EquipmentTracker';
import { EquipmentMaintenance } from './EquipmentMaintenance';
import { WalkthroughProvider, useWalkthrough } from '../context/WalkthroughContext';
import { WalkthroughOverlay } from './Walkthrough';
import UserManual from './UserManual';

const SprayFoamCalculator: React.FC = () => {
  const { state, dispatch } = useCalculator();
  const { appData, ui, session } = state;
  const { handleManualSync, forceRefresh } = useSync(); 
  const { loadEstimateForEditing, saveEstimate, handleDeleteEstimate, handleMarkPaid, saveCustomer, confirmWorkOrder, createPurchaseOrder } = useEstimates();

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [autoTriggerCustomerModal, setAutoTriggerCustomerModal] = useState(false);
  const [initialDashboardFilter, setInitialDashboardFilter] = useState<'all' | 'work_orders'>('all');
  const [authChecked, setAuthChecked] = useState(false);

  // Track pending warehouse item UUID resolutions so we can await them
  // before saving estimates that reference temp IDs.
  const pendingWarehouseUUIDs = useRef<Map<string, Promise<string>>>(new Map());

  // Helper to generate PDFs using the original pdfGenerator
  const cloudOpts = () => ({
    orgId: session?.organizationId,
    customerId: appData.customerProfile?.id,
    estimateId: ui.editingEstimateId || undefined,
  });

  const generatePDF = async (type: 'ESTIMATE' | 'INVOICE' | 'RECEIPT', record?: EstimateRecord) => {
    const rec = record || appData.savedEstimates.find(e => e.id === ui.editingEstimateId);
    await generateDocumentPDF(appData, rec?.results || results, type, rec, cloudOpts());
  };

  // Restore Supabase session on mount
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const existingSession = await getCurrentSession();
        if (existingSession) {
          dispatch({ type: 'SET_SESSION', payload: existingSession });
        }
      } catch (err) {
        console.error('Session restore failed:', err);
      } finally {
        setAuthChecked(true);
      }
    };
    restoreSession();
  }, [dispatch]);

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

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (err) {
      console.error('Sign out error:', err);
    }
    safeStorage.removeItem('foamProSession');
    safeStorage.removeItem('foamProCrewSession');
    dispatch({ type: 'LOGOUT' });
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
      const tempId = Math.random().toString(36).substr(2, 9);
      const newItem = {
          id: tempId,
          name, unit, unitCost: cost, quantity: 0
      };
      // Optimistic local add
      dispatch({ type: 'UPDATE_DATA', payload: { warehouse: { ...appData.warehouse, items: [...appData.warehouse.items, newItem] } } });

      // Immediately persist to Supabase to get a real UUID back.
      // This prevents duplicate rows and ensures the warehouseItemId
      // on job inventory items matches the UUID used for deduction.
      if (session?.organizationId) {
        const uuidPromise = upsertInventoryItem(newItem, session.organizationId).then(saved => {
          pendingWarehouseUUIDs.current.delete(tempId);
          if (saved && saved.id !== tempId) {
            // Replace the temporary local ID with the Supabase UUID
            const fixedItems = appData.warehouse.items.map(i =>
              i.id === tempId ? { ...i, id: saved.id } : i
            );
            // Also include the new item in case the map didn't find it
            // (the local dispatch above may not have been processed yet)
            const hasItem = fixedItems.some(i => i.id === saved.id);
            const finalItems = hasItem ? fixedItems : [...fixedItems, { ...newItem, id: saved.id }];

            // Also update any job inventory items that reference the old temp ID
            // so the warehouseItemId stays valid for deduction matching
            const fixedInventory = appData.inventory.map(inv =>
              inv.warehouseItemId === tempId ? { ...inv, warehouseItemId: saved.id } : inv
            );

            dispatch({ type: 'UPDATE_DATA', payload: {
              warehouse: { ...appData.warehouse, items: finalItems },
              inventory: fixedInventory
            } });
            return saved.id;
          }
          return tempId;
        }).catch(err => {
          console.error('Immediate warehouse item sync failed:', err);
          pendingWarehouseUUIDs.current.delete(tempId);
          return tempId;
        });

        pendingWarehouseUUIDs.current.set(tempId, uuidPromise);
      }

      return tempId;
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
        const archivedCustomer = appData.customers.find(c => c.id === id);
        const updated = appData.customers.map(c => c.id === id ? { ...c, status: 'Archived' as const } : c);
        dispatch({ type: 'UPDATE_DATA', payload: { customers: updated } });

        // Persist archive status to Supabase
        if (session?.organizationId && archivedCustomer) {
          upsertCustomer({ ...archivedCustomer, status: 'Archived' }, session.organizationId)
            .then(saved => {
              if (saved) console.log('[Archive] Customer archived in Supabase:', id);
            })
            .catch(err => {
              console.error('Failed to archive customer in Supabase:', err);
              dispatch({ type: 'SET_NOTIFICATION', payload: { type: 'error', message: 'Failed to save archive status to cloud. Change may revert on refresh.' } });
            });
        }
    }
  };

  const updateInventoryItem = (id: string, field: string, value: any) => { 
    const updatedInv = appData.inventory.map(i => i.id === id ? { ...i, [field]: value } : i);
    dispatch({ type: 'UPDATE_DATA', payload: { inventory: updatedInv } });
  };

  const batchUpdateInventoryItem = (id: string, updates: Record<string, any>) => {
    const updatedInv = appData.inventory.map(i => i.id === id ? { ...i, ...updates } : i);
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
      const tempId = Math.random().toString(36).substr(2,9);
      const newEq: EquipmentItem = { id: tempId, name: '', status: 'Available' };
      dispatch({ type: 'UPDATE_DATA', payload: { equipment: [...(appData.equipment || []), newEq] } });

      // Persist to Supabase immediately to get a real UUID
      if (session?.organizationId) {
        upsertEquipment(newEq, session.organizationId).then(saved => {
          if (saved && saved.id !== tempId) {
            const fixedEquipment = (appData.equipment || []).map(e =>
              e.id === tempId ? { ...e, id: saved.id } : e
            );
            const hasItem = fixedEquipment.some(e => e.id === saved.id);
            const finalEquipment = hasItem ? fixedEquipment : [...fixedEquipment, { ...newEq, id: saved.id }];
            dispatch({ type: 'UPDATE_DATA', payload: { equipment: finalEquipment } });
          }
        }).catch(err => {
          console.error('Failed to save new equipment to Supabase:', err);
          dispatch({ type: 'SET_NOTIFICATION', payload: { type: 'error', message: 'Failed to save equipment to cloud.' } });
        });
      }
  };
  const removeEquipment = (id: string) => {
      dispatch({ type: 'UPDATE_DATA', payload: { equipment: appData.equipment.filter(e => e.id !== id) } });

      // Persist deletion to Supabase
      if (session?.organizationId && id.includes('-') && id.length > 20) {
        deleteEquipmentItem(id).catch(err => {
          console.error('Failed to delete equipment from Supabase:', err);
          dispatch({ type: 'SET_NOTIFICATION', payload: { type: 'error', message: 'Failed to delete equipment from cloud. It may reappear on refresh.' } });
        });
      }
  };
  const updateEquipment = (id: string, field: keyof EquipmentItem, value: any) => {
      const updated = appData.equipment.map(e => e.id === id ? { ...e, [field]: value } : e);
      dispatch({ type: 'UPDATE_DATA', payload: { equipment: updated } });

      // Persist update to Supabase (debounced via the equipment item itself)
      if (session?.organizationId) {
        const updatedItem = updated.find(e => e.id === id);
        if (updatedItem) {
          upsertEquipment(updatedItem, session.organizationId).catch(err => {
            console.error('Failed to update equipment in Supabase:', err);
          });
        }
      }
  };

  const handleSaveAndMarkPaid = async (lines: InvoiceLineItem[]) => {
      // Pass lines here to ensure they are saved.
      const totalFromLines = lines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0);

      // awaitCloud=true ensures the invoice is persisted in Supabase before
      // marking paid, preventing the race condition where markEstimatePaid
      // targets a record that doesn't exist in the DB yet.
      const savedRecord = await saveEstimate(results, 'Invoiced', {
          invoiceLines: lines,
          totalValue: totalFromLines
      }, false, true); // awaitCloud=true

      if (savedRecord) {
          const targetId = savedRecord.id;
          await handleMarkPaid(targetId);
      }
  };

  // Wrapper for mark paid — just marks paid, no auto-PDF
  const handleMarkPaidWithPDF = async (id: string) => {
    await handleMarkPaid(id);
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

  // Called after InvoiceStage saves its lines to the record.
  // The InvoiceStage already awaited the Supabase write (awaitCloud=true)
  // before calling this, so we just need to navigate.
  const handleConfirmInvoice = async (record?: EstimateRecord) => {
    const finalRecord = record || appData.savedEstimates.find(e => e.id === ui.editingEstimateId);

    if (finalRecord) {
        // If the record doesn't have 'Invoiced' status yet (edge case: the
        // InvoiceStage save failed silently), do an explicit cloud save now.
        if (finalRecord.status !== 'Invoiced') {
            await saveEstimate(results, 'Invoiced', {}, false, true);
        }
        dispatch({ type: 'SET_NOTIFICATION', payload: { type: 'success', message: 'Invoice saved successfully.' } });
        dispatch({ type: 'SET_VIEW', payload: 'dashboard' });
    } else {
        const newRec = await saveEstimate(results, 'Invoiced', {}, true, true);
        if (newRec) {
            dispatch({ type: 'SET_NOTIFICATION', payload: { type: 'success', message: 'Invoice saved successfully.' } });
            dispatch({ type: 'SET_VIEW', payload: 'dashboard' });
        }
    }
  };

  // Called after EstimateStage saves its lines (already cloud-synced via awaitCloud=true)
  const handleConfirmEstimate = async (record: EstimateRecord, shouldPrint: boolean) => {
      // Data is already saved and synced to Supabase — advance to Work Order stage.
      dispatch({ type: 'SET_NOTIFICATION', payload: { type: 'success', message: 'Estimate saved! Now generate the Work Order.' } });
      dispatch({ type: 'SET_EDITING_ESTIMATE', payload: record.id });
      dispatch({ type: 'SET_VIEW', payload: 'work_order_stage' });
  };

  // Called when WorkOrderStage confirms
  const handleConfirmWorkOrder = async (customLines: InvoiceLineItem[]) => {
      // Await all pending warehouse item UUID resolutions before saving.
      // This prevents temp IDs (e.g. "k3j9xm7a2") from being persisted
      // in the estimate record, which would crash the SQL ::uuid cast.
      if (pendingWarehouseUUIDs.current.size > 0) {
        const entries = [...pendingWarehouseUUIDs.current.entries()];
        const resolved = await Promise.all(
          entries.map(async ([tempId, promise]) => {
            const realId = await promise;
            return { tempId, realId };
          })
        );

        // Patch inventory items that still reference temp IDs
        let needsUpdate = false;
        const patchedInventory = appData.inventory.map(item => {
          for (const { tempId, realId } of resolved) {
            if (tempId !== realId && item.warehouseItemId === tempId) {
              needsUpdate = true;
              return { ...item, warehouseItemId: realId };
            }
          }
          return item;
        });
        if (needsUpdate) {
          dispatch({ type: 'UPDATE_DATA', payload: { inventory: patchedInventory } });
        }
      }

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

  // Stage-specific navigation handlers for Customer CRM
  const handleOpenEstimateStage = (rec: EstimateRecord) => {
      loadEstimateForEditing(rec);
      dispatch({ type: 'SET_EDITING_ESTIMATE', payload: rec.id });
      dispatch({ type: 'SET_VIEW', payload: 'estimate_stage' });
  };

  const handleOpenWorkOrderStage = (rec: EstimateRecord) => {
      loadEstimateForEditing(rec);
      dispatch({ type: 'SET_EDITING_ESTIMATE', payload: rec.id });
      dispatch({ type: 'SET_VIEW', payload: 'work_order_stage' });
  };

  const handleOpenInvoiceStage = (rec: EstimateRecord) => {
      loadEstimateForEditing(rec);
      dispatch({ type: 'SET_EDITING_ESTIMATE', payload: rec.id });
      dispatch({ type: 'SET_VIEW', payload: 'invoice_stage' });
  };

  // Show loading while checking existing auth
  if (!authChecked) {
    return (
      <div className="flex h-screen items-center justify-center text-slate-400 bg-slate-900">
        <Loader2 className="animate-spin mr-2" /> Checking authentication...
      </div>
    );
  }

  if (!session) {
      return <LoginPage 
          onLoginSuccess={(s) => { 
              dispatch({ type: 'SET_SESSION', payload: s }); 
              safeStorage.setItem('foamProSession', JSON.stringify(s)); 
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
            organizationId={session.organizationId}
            onLogout={handleLogout} 
            syncStatus={ui.syncStatus}
            onSync={forceRefresh} 
            installPrompt={deferredPrompt}
            onInstall={handleInstallApp}
          />
      );
  }

  return (
    <WalkthroughProvider>
    <WalkthroughAutoTrigger />
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
        <WalkthroughOverlay onNavigate={(v) => dispatch({ type: 'SET_VIEW', payload: v as any })} />
        {/* Persistent Floating Install Icon - positioned above bottom nav on mobile */}
        {deferredPrompt && (
          <div className="fixed bottom-24 md:bottom-6 right-4 md:right-6 z-[60]">
             <button 
                onClick={handleInstallApp}
                className="group flex items-center gap-2.5 bg-slate-900 text-white pl-3.5 pr-5 py-3 md:pl-4 md:pr-6 md:py-4 rounded-full shadow-2xl border-2 border-slate-700 hover:bg-brand hover:border-brand transition-all hover:scale-105 active:scale-95"
                title="Install Desktop App"
             >
                <div className="bg-white/10 p-1.5 rounded-full group-hover:bg-white/20 transition-colors">
                    <Download className="w-4 h-4 md:w-5 md:h-5 animate-pulse" />
                </div>
                <div className="flex flex-col items-start">
                    <span className="text-[8px] md:text-[9px] font-black uppercase tracking-widest text-slate-400 group-hover:text-white/80 transition-colors leading-none mb-0.5">Get the App</span>
                    <span className="font-bold text-xs md:text-sm leading-none">Install Now</span>
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
                onMarkPaid={handleMarkPaidWithPDF}
                initialFilter={initialDashboardFilter}
                onGoToWarehouse={() => dispatch({ type: 'SET_VIEW', payload: 'warehouse' })}
                onViewInvoice={(rec) => {
                    dispatch({ type: 'SET_EDITING_ESTIMATE', payload: rec.id });
                    loadEstimateForEditing(rec);
                    dispatch({ type: 'SET_VIEW', payload: 'invoice_stage' });
                }}
                onDownloadPDF={(rec, type) => generatePDF(type, rec)}
                onSync={forceRefresh}
                subscription={state.subscription}
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
                onBatchInventoryUpdate={batchUpdateInventoryItem}
                onAddInventory={addInventoryItem}
                onRemoveInventory={removeInventoryItem}
                onSaveEstimate={(status) => saveEstimate(results, status, undefined, true, true)}
                onStageWorkOrder={handleStageWorkOrder}
                onStageInvoice={handleStageInvoice}
                onStageEstimate={handleStageEstimate} // Pass new handler
                onAddNewCustomer={() => { dispatch({ type: 'SET_VIEW', payload: 'customers' }); setAutoTriggerCustomerModal(true); }}
                onMarkPaid={handleMarkPaidWithPDF}
                onCreateWarehouseItem={handleCreateWarehouseItem}
            />
        )}

        {ui.view === 'estimate_detail' && ui.editingEstimateId && (
            <EstimateDetail 
                record={appData.savedEstimates.find(e => e.id === ui.editingEstimateId) || ({} as EstimateRecord)}
                results={results} 
                onBack={() => dispatch({ type: 'SET_VIEW', payload: 'dashboard' })}
                onEdit={() => dispatch({ type: 'SET_VIEW', payload: 'calculator' })}
                onDownloadPDF={(type) => generatePDF(type)}
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
                onDownloadPDF={() => {
                  const rec = appData.savedEstimates.find(e => e.id === ui.editingEstimateId);
                  if (rec) generateWorkOrderPDF(appData, rec, cloudOpts());
                }}
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
                onMarkPaid={handleMarkPaidWithPDF}
                onSaveAndMarkPaid={handleSaveAndMarkPaid}
                onDownloadPDF={(type) => generatePDF(type)}
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
                onDownloadPDF={() => generatePDF('ESTIMATE')}
            />
        )}

        {ui.view === 'warehouse' && (
            <Warehouse 
                state={appData}
                onStockChange={handleWarehouseStockChange}
                onAddItem={() => dispatch({ type: 'UPDATE_DATA', payload: { warehouse: { ...appData.warehouse, items: [...appData.warehouse.items, { id: Math.random().toString(36).substr(2,9), name: '', quantity: 0, unit: 'pcs', unitCost: 0 }] } } })}
                onRemoveItem={(id) => {
                  dispatch({ type: 'UPDATE_DATA', payload: { warehouse: { ...appData.warehouse, items: appData.warehouse.items.filter(i => i.id !== id) } } });
                  // Persist deletion to Supabase so item doesn't reappear on refresh
                  if (id.includes('-') && id.length > 20) {
                    deleteInventoryItem(id).catch(err => {
                      console.error('Failed to delete inventory item from Supabase:', err);
                      dispatch({ type: 'SET_NOTIFICATION', payload: { type: 'error', message: 'Failed to remove item from cloud. It may reappear on refresh.' } });
                    });
                  }
                }}
                onUpdateItem={updateWarehouseItem}
                onFinishSetup={() => dispatch({ type: 'SET_VIEW', payload: 'dashboard' })}
                onViewReport={() => dispatch({ type: 'SET_VIEW', payload: 'material_report' })}
                onViewEquipmentTracker={() => dispatch({ type: 'SET_VIEW', payload: 'equipment_tracker' })}
                onViewEquipmentMaintenance={() => dispatch({ type: 'SET_VIEW', payload: 'equipment_maintenance' })}
                onAddEquipment={addEquipment}
                onRemoveEquipment={removeEquipment}
                onUpdateEquipment={updateEquipment}
            />
        )}

        {ui.view === 'material_order' && (
            <MaterialOrder 
                state={appData}
                orgId={session?.organizationId}
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

        {ui.view === 'equipment_maintenance' && session?.organizationId && (
            <EquipmentMaintenance 
                state={appData}
                organizationId={session.organizationId}
                onBack={() => dispatch({ type: 'SET_VIEW', payload: 'warehouse' })}
                onNotify={(n) => dispatch({ type: 'SET_NOTIFICATION', payload: n })}
            />
        )}

        {(ui.view === 'customers' || ui.view === 'customer_detail') && (
            <Customers 
                state={appData}
                orgId={session?.organizationId}
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
                onOpenEstimateStage={handleOpenEstimateStage}
                onOpenWorkOrderStage={handleOpenWorkOrderStage}
                onOpenInvoiceStage={handleOpenInvoiceStage}
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

        {ui.view === 'user_manual' && (
            <UserManual />
        )}


    </Layout>
    </WalkthroughProvider>
  );
};

/** Auto-trigger walkthrough for first-time users */
const WalkthroughAutoTrigger: React.FC = () => {
  const { startWalkthrough, hasCompletedWalkthrough, isActive } = useWalkthrough();

  useEffect(() => {
    if (!hasCompletedWalkthrough && !isActive) {
      // Small delay to let the dashboard render first
      const timer = setTimeout(() => {
        startWalkthrough();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [hasCompletedWalkthrough, isActive, startWalkthrough]);

  return null;
};

export default SprayFoamCalculator;
