
import React, { useRef } from 'react';
import { useCalculator, DEFAULT_STATE } from '../context/CalculatorContext';
import { EstimateRecord, CalculationResults, CustomerProfile, PurchaseOrder, InvoiceLineItem, MaterialUsageLogEntry } from '../types';
import { checkPlanLimit } from '../services/subscriptionService';
import {
  upsertEstimate,
  deleteEstimateDb,
  markEstimatePaid,
  upsertCustomer,
  updateWarehouseStock,
  upsertInventoryItem,
  upsertEquipment,
  updateEquipmentStatus,
  insertMaterialLogs,
  insertPurchaseOrder,
  updateEstimateActuals,
  broadcastWorkOrderUpdate,
} from '../services/supabaseService';
import { generateWorkOrderPDF, SaveToCloudOptions } from '../utils/pdfGenerator';
import { setInventorySyncLock } from './useSync';

export const useEstimates = () => {
  const { state, dispatch } = useCalculator();
  const { appData, ui, session } = state;

  // Tracks the in-flight upsertEstimate promise so handleBackgroundWorkOrderSync
  // can await it before broadcasting to crew (prevents race condition where
  // broadcast fires before the estimate row exists in the DB).
  const pendingEstimateUpsertRef = useRef<Promise<EstimateRecord | null> | null>(null);
  const subscription = state.subscription;

  const loadEstimateForEditing = (record: EstimateRecord) => {
    dispatch({
        type: 'UPDATE_DATA',
        payload: {
            mode: record.inputs.mode,
            length: record.inputs.length,
            width: record.inputs.width,
            wallHeight: record.inputs.wallHeight,
            roofPitch: record.inputs.roofPitch,
            includeGables: record.inputs.includeGables,
            isMetalSurface: record.inputs.isMetalSurface || false,
            additionalAreas: record.inputs.additionalAreas || [],
            wallSettings: record.wallSettings,
            roofSettings: record.roofSettings,
            expenses: { ...record.expenses, laborRate: record.expenses?.laborRate ?? appData.costs.laborRate },
            inventory: record.materials.inventory,
            customerProfile: record.customer,
            jobNotes: record.notes || '',
            scheduledDate: record.scheduledDate || '',
            invoiceDate: record.invoiceDate || '',
            invoiceNumber: record.invoiceNumber || '',
            paymentTerms: record.paymentTerms || 'Due on Receipt',
            pricingMode: record.pricingMode || 'level_pricing',
            sqFtRates: record.sqFtRates || { wall: 0, roof: 0 }
        }
    });
    dispatch({ type: 'SET_EDITING_ESTIMATE', payload: record.id });
    dispatch({ type: 'SET_VIEW', payload: 'estimate_detail' }); 
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const saveEstimate = async (results: CalculationResults, targetStatus?: EstimateRecord['status'], extraData?: Partial<EstimateRecord>, shouldRedirect: boolean = true) => {
    if (!appData.customerProfile.name) { 
        dispatch({ type: 'SET_NOTIFICATION', payload: { type: 'error', message: 'Customer Name Required to Save' } });
        return null; 
    }

    // Check subscription limits for new estimates (not existing edits)
    const isNewEstimate = !ui.editingEstimateId;
    if (isNewEstimate && subscription) {
      const limitCheck = checkPlanLimit(subscription, 'create_estimate');
      if (!limitCheck.allowed) {
        dispatch({ type: 'SET_NOTIFICATION', payload: { type: 'error', message: limitCheck.message || 'Plan limit reached.' } });
        return null;
      }
    }

    const estimateId = ui.editingEstimateId || Math.random().toString(36).substr(2, 9);
    const existingRecord = appData.savedEstimates.find(e => e.id === estimateId);
    
    let newStatus: EstimateRecord['status'] = targetStatus || (existingRecord?.status || 'Draft');
    
    let invoiceNumber = appData.invoiceNumber;
    if (!invoiceNumber) {
        invoiceNumber = existingRecord?.invoiceNumber;
        if (newStatus === 'Invoiced' && !invoiceNumber) invoiceNumber = `INV-${Math.floor(Math.random() * 100000)}`;
    }

    const newEstimate: EstimateRecord = {
      id: estimateId,
      customerId: appData.customerProfile.id || Math.random().toString(36).substr(2, 9),
      date: existingRecord?.date || new Date().toISOString(),
      scheduledDate: appData.scheduledDate,
      invoiceDate: appData.invoiceDate,
      paymentTerms: appData.paymentTerms,
      status: newStatus,
      invoiceNumber: invoiceNumber,
      customer: { ...appData.customerProfile },
      inputs: {
          mode: appData.mode, length: appData.length, width: appData.width, wallHeight: appData.wallHeight,
          roofPitch: appData.roofPitch, includeGables: appData.includeGables, 
          isMetalSurface: appData.isMetalSurface, 
          additionalAreas: appData.additionalAreas
      },
      results: { ...results },
      materials: { openCellSets: results.openCellSets, closedCellSets: results.closedCellSets, openCellStrokes: results.openCellStrokes, closedCellStrokes: results.closedCellStrokes, ocStrokesPerSet: appData.yields?.openCellStrokes || 6600, ccStrokesPerSet: appData.yields?.closedCellStrokes || 6600, inventory: [...appData.inventory], equipment: [...appData.jobEquipment] },
      totalValue: results.totalCost, 
      wallSettings: { ...appData.wallSettings },
      roofSettings: { ...appData.roofSettings },
      expenses: { ...appData.expenses },
      notes: appData.jobNotes,
      pricingMode: appData.pricingMode,
      sqFtRates: appData.sqFtRates,
      executionStatus: existingRecord?.executionStatus || 'Not Started',
      actuals: existingRecord?.actuals,
      financials: existingRecord?.financials,
      inventoryProcessed: existingRecord?.inventoryProcessed || false,
      workOrderSheetUrl: existingRecord?.workOrderSheetUrl,
      
      // Preserve custom lines if not provided in extraData
      invoiceLines: extraData?.invoiceLines || existingRecord?.invoiceLines,
      workOrderLines: extraData?.workOrderLines || existingRecord?.workOrderLines,
      estimateLines: extraData?.estimateLines || existingRecord?.estimateLines,

      ...extraData 
    };

    // Optimistic local update
    let updatedEstimates = [...appData.savedEstimates];
    const idx = updatedEstimates.findIndex(e => e.id === estimateId);
    if (idx >= 0) updatedEstimates[idx] = newEstimate;
    else updatedEstimates.unshift(newEstimate);

    dispatch({ type: 'UPDATE_DATA', payload: { savedEstimates: updatedEstimates } });
    dispatch({ type: 'SET_EDITING_ESTIMATE', payload: estimateId });
    
    // Check for implicit customer creation
    if (!appData.customers.find(c => c.id === appData.customerProfile.id)) {
        const newCustomer = { ...appData.customerProfile, id: appData.customerProfile.id || Math.random().toString(36).substr(2, 9) };
        saveCustomer(newCustomer);
    }

    // Redirect control
    if (shouldRedirect) {
        dispatch({ type: 'SET_VIEW', payload: 'estimate_detail' });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    const actionLabel = targetStatus === 'Work Order' ? 'Job Sold! Moved to Work Order' : 
                        targetStatus === 'Invoiced' ? 'Invoice Generated' : 
                        targetStatus === 'Paid' ? 'Payment Recorded' : 'Estimate Saved';
    dispatch({ type: 'SET_NOTIFICATION', payload: { type: 'success', message: actionLabel } });

    // Persist to Supabase in background (non-blocking).
    // Store the promise so handleBackgroundWorkOrderSync can await it
    // before broadcasting to crew (prevents race condition).
    if (session?.organizationId) {
      const upsertPromise = upsertEstimate(newEstimate, session.organizationId);
      pendingEstimateUpsertRef.current = upsertPromise;
      const localId = newEstimate.id; // Capture the ID at save time for the .then() handler
      upsertPromise.then(saved => {
        // Only clear the ref if it's still OUR promise (prevents race with a
        // subsequent saveEstimate call overwriting the ref).
        if (pendingEstimateUpsertRef.current === upsertPromise) {
          pendingEstimateUpsertRef.current = null;
        }
        if (saved && saved.id !== localId) {
          // DB assigned a new UUID — use RENAME_ESTIMATE_ID to safely update
          // the CURRENT state instead of overwriting with a stale closure array.
          dispatch({ type: 'RENAME_ESTIMATE_ID', payload: { oldId: localId, newId: saved.id, customerId: saved.customerId } });
        }
      }).catch(err => {
        if (pendingEstimateUpsertRef.current === upsertPromise) {
          pendingEstimateUpsertRef.current = null;
        }
        console.error('Supabase estimate save failed:', err);
        dispatch({ type: 'SET_NOTIFICATION', payload: { type: 'error', message: 'Cloud save failed. Data saved locally.' } });
      });
    }

    return newEstimate;
  };

  /**
   * Await the in-flight Supabase upsert started by saveEstimate().
   * Returns the persisted record ID (may differ from local ID if DB assigned a UUID).
   * Callers that need the estimate to exist in Supabase before performing
   * further DB operations (e.g., markEstimatePaid) should call this first.
   */
  const awaitPendingUpsert = async (): Promise<string | null> => {
    if (!pendingEstimateUpsertRef.current) return null;
    try {
      const saved = await pendingEstimateUpsertRef.current;
      return saved?.id || null;
    } catch {
      return null;
    } finally {
      pendingEstimateUpsertRef.current = null;
    }
  };

  const handleDeleteEstimate = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (confirm("Are you sure you want to delete this job?")) {
      // Optimistic local delete
      dispatch({ 
          type: 'UPDATE_DATA', 
          payload: { savedEstimates: appData.savedEstimates.filter(e => e.id !== id) } 
      });
      if (ui.editingEstimateId === id) { 
          dispatch({ type: 'SET_EDITING_ESTIMATE', payload: null }); 
          dispatch({ type: 'SET_VIEW', payload: 'dashboard' }); 
      }

      // Persist to Supabase
      try {
        const deleted = await deleteEstimateDb(id);
        if (!deleted) {
          throw new Error('Supabase deleteEstimateDb returned false');
        }
        dispatch({ type: 'SET_NOTIFICATION', payload: { type: 'success', message: 'Job Deleted' } });
      } catch (err) {
        dispatch({ type: 'SET_NOTIFICATION', payload: { type: 'error', message: 'Local delete success, but server failed.' } });
      }
    }
  };

  const handleMarkPaid = async (id: string, onPDFReady?: (record: EstimateRecord) => void) => {
      const estimate = appData.savedEstimates.find(e => e.id === id);
      if (!estimate) return;

      dispatch({ type: 'SET_NOTIFICATION', payload: { type: 'success', message: 'Processing Payment & P&L...' } });
      dispatch({ type: 'SET_SYNC_STATUS', payload: 'syncing' });

      // Calculate financials locally
      const revenue = estimate.totalValue || 0;
      const chemicalCost =
        ((estimate.materials?.openCellSets || 0) * (appData.costs.openCell || 0)) +
        ((estimate.materials?.closedCellSets || 0) * (appData.costs.closedCell || 0));
      const laborCost = (estimate.expenses?.manHours || 0) * (estimate.expenses?.laborRate || appData.costs.laborRate || 0);
      const inventoryCost = (estimate.materials?.inventory || []).reduce((sum: number, i: any) => sum + ((i.unitCost || 0) * (i.quantity || 0)), 0);
      const miscCost = (estimate.expenses?.tripCharge || 0) + (estimate.expenses?.fuelSurcharge || 0) + (estimate.expenses?.other?.amount || 0);
      const totalCOGS = chemicalCost + laborCost + inventoryCost + miscCost;
      const netProfit = revenue - totalCOGS;
      const margin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

      const financials = { revenue, totalCOGS, chemicalCost, laborCost, inventoryCost, miscCost, netProfit, margin };

      // Optimistic local update
      const paidEstimate: EstimateRecord = { ...estimate, status: 'Paid', financials };
      const updatedEstimates = appData.savedEstimates.map(e => e.id === id ? paidEstimate : e);
      dispatch({ type: 'UPDATE_DATA', payload: { savedEstimates: updatedEstimates } });
      dispatch({ type: 'SET_NOTIFICATION', payload: { type: 'success', message: 'Paid! Profit Calculated.' } });

      // Open PDF modal for receipt via callback
      if (onPDFReady) {
        onPDFReady(paidEstimate);
      }

      // Persist to Supabase
      try {
        const paid = await markEstimatePaid(id, financials);
        if (!paid) {
          throw new Error('Supabase markEstimatePaid returned false');
        }
      } catch (err) {
        console.error('markPaid Supabase error:', err);
        dispatch({ type: 'SET_NOTIFICATION', payload: { type: 'error', message: 'Payment saved locally but failed to sync to cloud. Use Force Sync to retry.' } });
      }

      dispatch({ type: 'SET_SYNC_STATUS', payload: 'idle' });
  };

  const saveCustomer = (customerData: CustomerProfile) => {
    // Check subscription limits for new customers
    const isNew = !appData.customers.find(c => c.id === customerData.id);
    if (isNew && subscription) {
      const limitCheck = checkPlanLimit(subscription, 'create_customer');
      if (!limitCheck.allowed) {
        dispatch({ type: 'SET_NOTIFICATION', payload: { type: 'error', message: limitCheck.message || 'Customer limit reached.' } });
        return;
      }
    }

    // Optimistic local update
    let updatedCustomers = [...appData.customers];
    const existingIndex = updatedCustomers.findIndex(c => c.id === customerData.id);
    if (existingIndex >= 0) updatedCustomers[existingIndex] = customerData;
    else updatedCustomers.push(customerData);
    
    if (appData.customerProfile.id === customerData.id) {
        dispatch({ type: 'UPDATE_DATA', payload: { customers: updatedCustomers, customerProfile: customerData } });
    } else {
        dispatch({ type: 'UPDATE_DATA', payload: { customers: updatedCustomers } });
    }

    // Persist to Supabase in background
    if (session?.organizationId) {
      upsertCustomer(customerData, session.organizationId).then(saved => {
        if (!saved) {
          throw new Error('Supabase upsertCustomer returned null');
        }
        if (saved && saved.id !== customerData.id) {
          // DB assigned a new UUID — update local list
          const fixed = updatedCustomers.map(c => c.id === customerData.id ? { ...customerData, id: saved.id } : c);
          dispatch({ type: 'UPDATE_DATA', payload: { customers: fixed } });
        }
      }).catch(err => {
        console.error('Supabase customer save failed:', err);
        dispatch({ type: 'SET_NOTIFICATION', payload: { type: 'error', message: 'Customer saved locally but failed to sync to cloud.' } });
      });
    }
  };

  const confirmWorkOrder = async (results: CalculationResults, workOrderLines?: InvoiceLineItem[]) => {
    const existingRecord = ui.editingEstimateId
      ? appData.savedEstimates.find(e => e.id === ui.editingEstimateId)
      : undefined;

    // Only treat previous materials as "already deducted" if the estimate
    // was already processed as a Work Order. Draft estimates store materials
    // but haven't deducted from warehouse yet, so we use zeroed-out
    // previous materials for the first Draft → Work Order transition.
    const alreadyDeducted = existingRecord?.inventoryProcessed === true;
    const previousMaterials = alreadyDeducted
      ? (existingRecord?.materials || { openCellSets: 0, closedCellSets: 0, openCellStrokes: 0, closedCellStrokes: 0, ocStrokesPerSet: 6600, ccStrokesPerSet: 6600, inventory: [] })
      : { openCellSets: 0, closedCellSets: 0, openCellStrokes: 0, closedCellStrokes: 0, ocStrokesPerSet: 6600, ccStrokesPerSet: 6600, inventory: [] };

    // Deep copy warehouse so mutations don't affect the original state
    const newWarehouse = {
      ...appData.warehouse,
      items: appData.warehouse.items.map(i => ({ ...i })),
    };

    // 1) Foam deltas — allow negatives so users can return stock if they reduce sets
    const requiredOpen = Number(results.openCellSets) || 0;
    const requiredClosed = Number(results.closedCellSets) || 0;
    const prevOpen = Number(previousMaterials.openCellSets) || 0;
    const prevClosed = Number(previousMaterials.closedCellSets) || 0;
    const deltaOpen = requiredOpen - prevOpen;
    const deltaClosed = requiredClosed - prevClosed;

    const deductionSummary: string[] = [];

    if (deltaOpen !== 0) {
      newWarehouse.openCellSets = newWarehouse.openCellSets - deltaOpen;
      deductionSummary.push(`OC: ${deltaOpen > 0 ? '-' : '+'}${Math.abs(deltaOpen).toFixed(2)} sets`);
    }
    if (deltaClosed !== 0) {
      newWarehouse.closedCellSets = newWarehouse.closedCellSets - deltaClosed;
      deductionSummary.push(`CC: ${deltaClosed > 0 ? '-' : '+'}${Math.abs(deltaClosed).toFixed(2)} sets`);
    }

    // 2) Non-chemical inventory deltas (deduct or restock based on changes)
    const normalizeName = (name?: string) => (name || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const prevInventory = previousMaterials.inventory || [];

    if (appData.inventory.length > 0) {
      // Resolve warehouseItemId for current job inventory to avoid temp IDs
      const resolvedInventory = appData.inventory.map(item => {
        if (item.warehouseItemId) {
          const linked = newWarehouse.items.find(w => w.id === item.warehouseItemId);
          if (linked) return item;
        }
        const match = newWarehouse.items.find(w => normalizeName(w.name) === normalizeName(item.name));
        return match ? { ...item, warehouseItemId: match.id } : item;
      });

      const getUsageQty = (list: typeof resolvedInventory, whItem: any) => {
        const byId = list.find(i => i.warehouseItemId === whItem.id);
        if (byId) return Number(byId.quantity) || 0;
        const byName = list.find(i => normalizeName(i.name) === normalizeName(whItem.name));
        return byName ? Number(byName.quantity) || 0 : 0;
      };

      newWarehouse.items = newWarehouse.items.map(whItem => {
        const currentUse = getUsageQty(resolvedInventory, whItem);
        const prevUse = getUsageQty(prevInventory as any, whItem);
        const deltaUse = currentUse - prevUse;

        if (deltaUse !== 0) {
          const newQty = whItem.quantity - deltaUse;
          deductionSummary.push(`${whItem.name}: ${deltaUse > 0 ? '-' : '+'}${Math.abs(deltaUse)}`);
          return { ...whItem, quantity: newQty };
        }
        return whItem;
      });

      // Warn about unmatched items so admins know nothing was deducted
      resolvedInventory.forEach(inv => {
        const matchedById = inv.warehouseItemId && newWarehouse.items.some(w => w.id === inv.warehouseItemId);
        const matchedByName = newWarehouse.items.some(w => normalizeName(w.name) === normalizeName(inv.name));
        if (!matchedById && !matchedByName && (inv.quantity || 0) > 0) {
          console.warn(`[WO Inventory] No warehouse match for "${inv.name}" (qty: ${inv.quantity}). Item not deducted from warehouse stock.`);
        }
      });

      // Persist the resolved IDs back into job inventory before saving
      dispatch({ type: 'UPDATE_DATA', payload: { inventory: resolvedInventory } });
    }

    if (deductionSummary.length > 0) {
      console.log(`[WO Inventory] Inventory delta applied: ${deductionSummary.join(', ')}`);
    } else {
      console.log('[WO Inventory] No inventory deltas detected; warehouse left unchanged.');
    }

    // 3. Update Warehouse State Locally
    dispatch({ type: 'UPDATE_DATA', payload: { warehouse: newWarehouse } });
    
    // Pass resolved inventory in extraData.materials so the persisted estimate
    // record contains real warehouse UUIDs, not temp IDs that crash ::uuid casts.
    const resolvedMaterials = {
      openCellSets: results.openCellSets,
      closedCellSets: results.closedCellSets,
      openCellStrokes: results.openCellStrokes,
      closedCellStrokes: results.closedCellStrokes,
      ocStrokesPerSet: appData.yields?.openCellStrokes || 6600,
      ccStrokesPerSet: appData.yields?.closedCellStrokes || 6600,
      inventory: appData.inventory.length > 0
        ? (() => {
            const normName = (n?: string) => (n || '').trim().toLowerCase().replace(/\s+/g, ' ');
            return appData.inventory.map(item => {
              if (item.warehouseItemId) {
                const linked = newWarehouse.items.find(w => w.id === item.warehouseItemId);
                if (linked) return item;
              }
              const match = newWarehouse.items.find(w => normName(w.name) === normName(item.name));
              return match ? { ...item, warehouseItemId: match.id } : item;
            });
          })()
        : [...appData.inventory],
      equipment: [...appData.jobEquipment]
    };

    const record = await saveEstimate(results, 'Work Order', { workOrderLines, materials: resolvedMaterials, inventoryProcessed: true }, false);
    
    if (record) {
        let updatedEquipment = appData.equipment;
        if (appData.jobEquipment.length > 0) {
            const assignedAt = new Date().toISOString();
            const lastSeen = {
                customerName: record.customer?.name || 'Unknown',
                date: assignedAt,
                crewMember: session?.username || 'Admin',
                jobId: record.id
            };
            updatedEquipment = appData.equipment.map(eq => {
                if (appData.jobEquipment.find(tool => tool.id === eq.id)) {
                    return { ...eq, status: 'In Use' as const, lastSeen };
                }
                return eq;
            });
            dispatch({ type: 'UPDATE_DATA', payload: { equipment: updatedEquipment } });
        }

        // 4. OPTIMISTIC UPDATE: Navigate to Invoice Stage to continue workflow
        dispatch({ type: 'SET_VIEW', payload: 'invoice_stage' });
        
        const notifMsg = alreadyDeducted
          ? 'Work Order Updated! Now generate the Invoice.'
          : 'Work Order Created — Now generate the Invoice!';
        dispatch({ type: 'SET_NOTIFICATION', payload: { type: 'success', message: notifMsg } });
        
        // 5. Generate PDF Locally + Save to Cloud
        const cloudOpts: SaveToCloudOptions = { orgId: session?.organizationId, customerId: record!.customerId, estimateId: record!.id };
        generateWorkOrderPDF(appData, record!, cloudOpts);

        // 6. Background persist to Supabase
        handleBackgroundWorkOrderSync(record, newWarehouse, updatedEquipment, results);
    }
  };

  const handleBackgroundWorkOrderSync = async (
    record: EstimateRecord,
    currentWarehouse: any,
    currentEquipment: any[],
    results: CalculationResults
  ) => {
    if (!session?.organizationId) return;
    
    dispatch({ type: 'SET_SYNC_STATUS', payload: 'syncing' });

    // Lock the inventory sync guard so realtime subscription events
    // from our own writes don't overwrite locally-deducted quantities.
    setInventorySyncLock(true);
    
    try {
      // 0. Ensure the estimate is persisted to Supabase BEFORE broadcasting.
      //    saveEstimate fires upsertEstimate as non-blocking; if the promise
      //    is still pending, await it here so the crew's fetchCrewWorkOrders
      //    call will find the new work order in the DB.
      let persistedJobId = record.id;
      if (pendingEstimateUpsertRef.current) {
        try {
          const saved = await pendingEstimateUpsertRef.current;
          if (saved) {
            persistedJobId = saved.id;
          }
        } catch (upsertErr) {
          // saveEstimate's .catch() already handled UI notification;
          // retry the upsert so the estimate reaches Supabase
          console.warn('[WO Sync] Initial estimate upsert failed, retrying:', upsertErr);
          try {
            const retried = await upsertEstimate(record, session.organizationId);
            if (retried) persistedJobId = retried.id;
          } catch (retryErr) {
            console.error('[WO Sync] Estimate upsert retry failed:', retryErr);
          }
        } finally {
          pendingEstimateUpsertRef.current = null;
        }
      }

      // 1. Update warehouse stock in Supabase (foam chemical sets)
      const warehouseUpdated = await updateWarehouseStock(
        session.organizationId,
        currentWarehouse.openCellSets,
        currentWarehouse.closedCellSets
      );
      if (!warehouseUpdated) {
        throw new Error('Supabase updateWarehouseStock returned false');
      }

      // 2. Update general inventory items (deducted quantities)
      for (const item of currentWarehouse.items) {
        const savedInventory = await upsertInventoryItem(item, session.organizationId);
        if (!savedInventory) {
          throw new Error(`Supabase upsertInventoryItem failed for ${item.id || item.name}`);
        }
      }

      // 3. Update equipment status
      for (const eq of currentEquipment) {
        if (eq.status === 'In Use') {
          const updated = await updateEquipmentStatus(eq.id, eq.status, eq.lastSeen);
          if (!updated) {
            throw new Error(`Supabase updateEquipmentStatus failed for ${eq.id || eq.name}`);
          }
        }
      }

      // 4. Create material usage log entries (estimated)
      //    Use persistedJobId (DB UUID) instead of local record.id
      const logEntries: MaterialUsageLogEntry[] = [];
      const now = new Date().toISOString();
      
      if (results.openCellSets > 0) {
        logEntries.push({
          date: now,
          jobId: persistedJobId,
          customerName: record.customer?.name || 'Unknown',
          materialName: 'Open Cell Foam',
          quantity: results.openCellSets,
          unit: 'sets',
          loggedBy: session.username || 'Admin',
          logType: 'estimated',
        });
      }
      if (results.closedCellSets > 0) {
        logEntries.push({
          date: now,
          jobId: persistedJobId,
          customerName: record.customer?.name || 'Unknown',
          materialName: 'Closed Cell Foam',
          quantity: results.closedCellSets,
          unit: 'sets',
          loggedBy: session.username || 'Admin',
          logType: 'estimated',
        });
      }
      for (const inv of appData.inventory || []) {
        if (inv.quantity > 0) {
          logEntries.push({
            date: now,
            jobId: persistedJobId,
            customerName: record.customer?.name || 'Unknown',
            materialName: inv.name,
            quantity: inv.quantity,
            unit: inv.unit || 'ea',
            loggedBy: session.username || 'Admin',
            logType: 'estimated',
          });
        }
      }
      
      if (logEntries.length > 0) {
        const logsInserted = await insertMaterialLogs(logEntries, session.organizationId);
        if (!logsInserted) {
          throw new Error('Supabase insertMaterialLogs returned false');
        }
      }
      
      dispatch({ type: 'SET_SYNC_STATUS', payload: 'idle' });
      dispatch({ type: 'SET_NOTIFICATION', payload: { type: 'success', message: 'Work Order Synced Successfully' } });

      // Notify crew members in real-time so they see the new work order immediately
      broadcastWorkOrderUpdate(session.organizationId);

    } catch (e) {
      console.error('Background WO Sync Error:', e);
      dispatch({ type: 'SET_SYNC_STATUS', payload: 'error' });
      dispatch({ type: 'SET_NOTIFICATION', payload: { type: 'error', message: 'Background Sync Failed. Check Connection.' } });
    } finally {
      setInventorySyncLock(false);
    }

    // Re-dispatch the correct warehouse state to override any stale data
    // that may have leaked in from realtime events during the sync window.
    dispatch({ type: 'UPDATE_DATA', payload: { warehouse: currentWarehouse } });
  };

  const createPurchaseOrder = async (po: PurchaseOrder) => {
      // Add stock to warehouse
      const newWarehouse = { ...appData.warehouse };
      po.items.forEach(item => {
          if (item.type === 'open_cell') newWarehouse.openCellSets += item.quantity;
          if (item.type === 'closed_cell') newWarehouse.closedCellSets += item.quantity;
          if (item.type === 'inventory' && item.inventoryId) {
              const invItem = newWarehouse.items.find(i => i.id === item.inventoryId);
              if (invItem) invItem.quantity += item.quantity;
          }
      });

      const updatedPOs = [...(appData.purchaseOrders || []), po];
      
      // Optimistic local update
      dispatch({ type: 'UPDATE_DATA', payload: { warehouse: newWarehouse, purchaseOrders: updatedPOs } });
      dispatch({ type: 'SET_NOTIFICATION', payload: { type: 'success', message: 'Order Saved & Stock Updated' } });
      dispatch({ type: 'SET_VIEW', payload: 'warehouse' });
      
      // Persist to Supabase in background
      if (session?.organizationId) {
        dispatch({ type: 'SET_SYNC_STATUS', payload: 'syncing' });
        try {
          const savedPo = await insertPurchaseOrder(po, session.organizationId);
          if (!savedPo) {
            throw new Error('Supabase insertPurchaseOrder returned null');
          }

          const stockUpdated = await updateWarehouseStock(
            session.organizationId,
            newWarehouse.openCellSets,
            newWarehouse.closedCellSets
          );
          if (!stockUpdated) {
            throw new Error('Supabase updateWarehouseStock returned false');
          }

          for (const item of newWarehouse.items) {
            const savedInventory = await upsertInventoryItem(item as any, session.organizationId);
            if (!savedInventory) {
              throw new Error(`Supabase upsertInventoryItem failed for ${item.id || item.name}`);
            }
          }

          dispatch({ type: 'SET_SYNC_STATUS', payload: 'idle' });
        } catch (err) {
          console.error('PO sync error:', err);
          dispatch({ type: 'SET_SYNC_STATUS', payload: 'error' });
          dispatch({ type: 'SET_NOTIFICATION', payload: { type: 'error', message: 'Purchase order saved locally but failed to sync to cloud.' } });
        }
      }
  };

  return {
    loadEstimateForEditing,
    saveEstimate,
    awaitPendingUpsert,
    handleDeleteEstimate,
    handleMarkPaid,
    saveCustomer,
    confirmWorkOrder,
    createPurchaseOrder
  };
};
