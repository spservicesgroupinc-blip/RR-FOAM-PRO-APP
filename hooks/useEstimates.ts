
import React from 'react';
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
} from '../services/supabaseService';
import { generateWorkOrderPDF, generateDocumentPDF } from '../utils/pdfGenerator';
import { setInventorySyncLock } from './useSync';

export const useEstimates = () => {
  const { state, dispatch } = useCalculator();
  const { appData, ui, session } = state;
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
      materials: { openCellSets: results.openCellSets, closedCellSets: results.closedCellSets, inventory: [...appData.inventory], equipment: [...appData.jobEquipment] },
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

    // Persist to Supabase in background (non-blocking)
    if (session?.organizationId) {
      upsertEstimate(newEstimate, session.organizationId).then(saved => {
        if (saved && saved.id !== newEstimate.id) {
          // DB assigned a new UUID — update local state
          const fixedEstimates = updatedEstimates.map(e => 
            e.id === newEstimate.id ? { ...newEstimate, id: saved.id, customerId: saved.customerId } : e
          );
          dispatch({ type: 'UPDATE_DATA', payload: { savedEstimates: fixedEstimates } });
          dispatch({ type: 'SET_EDITING_ESTIMATE', payload: saved.id });
        }
      }).catch(err => {
        console.error('Supabase estimate save failed:', err);
        dispatch({ type: 'SET_NOTIFICATION', payload: { type: 'error', message: 'Cloud save failed. Data saved locally.' } });
      });
    }

    return newEstimate;
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
        await deleteEstimateDb(id);
        dispatch({ type: 'SET_NOTIFICATION', payload: { type: 'success', message: 'Job Deleted' } });
      } catch (err) {
        dispatch({ type: 'SET_NOTIFICATION', payload: { type: 'error', message: 'Local delete success, but server failed.' } });
      }
    }
  };

  const handleMarkPaid = async (id: string) => {
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
      
      // Generate receipt PDF
      generateDocumentPDF(appData, estimate.results, 'RECEIPT', paidEstimate);

      // Persist to Supabase
      try {
        await markEstimatePaid(id, financials);
      } catch (err) {
        console.error('markPaid Supabase error:', err);
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
        if (saved && saved.id !== customerData.id) {
          // DB assigned a new UUID — update local list
          const fixed = updatedCustomers.map(c => c.id === customerData.id ? { ...customerData, id: saved.id } : c);
          dispatch({ type: 'UPDATE_DATA', payload: { customers: fixed } });
        }
      }).catch(err => console.error('Supabase customer save failed:', err));
    }
  };

  const confirmWorkOrder = async (results: CalculationResults, workOrderLines?: InvoiceLineItem[]) => {
    // ─── DOUBLE-DEDUCTION GUARD ────────────────────────────────────────
    // If this estimate already had inventory deducted (status was already
    // 'Work Order'), skip the deduction to prevent subtracting twice.
    const existingRecord = ui.editingEstimateId
      ? appData.savedEstimates.find(e => e.id === ui.editingEstimateId)
      : undefined;
    const alreadyDeducted = existingRecord?.status === 'Work Order';

    const newWarehouse = { ...appData.warehouse };

    if (!alreadyDeducted) {
      // 1. Deduct Foam Chemical Sets (Allow negatives)
      const requiredOpen = Number(results.openCellSets) || 0;
      const requiredClosed = Number(results.closedCellSets) || 0;
      
      newWarehouse.openCellSets = newWarehouse.openCellSets - requiredOpen;
      newWarehouse.closedCellSets = newWarehouse.closedCellSets - requiredClosed;

      console.log(`[WO Inventory] Deducting foam: OC -${requiredOpen.toFixed(2)}, CC -${requiredClosed.toFixed(2)}`);
      
      // 2. Deduct non-chemical inventory items from warehouse
      const deductionSummary: string[] = [];
      
      if (appData.inventory.length > 0) {
          const normalizeName = (name?: string) => (name || '').trim().toLowerCase();

          // Build lookup map: warehouseItemId (preferred) or inventory item id
          const usageById = new Map<string, typeof appData.inventory[number]>();
          appData.inventory.forEach(item => {
              const key = item.warehouseItemId || item.id;
              if (key) usageById.set(key, item);
          });

          newWarehouse.items = newWarehouse.items.map(whItem => {
              // Match by warehouseItemId first, then by name (case-insensitive)
              const used = usageById.get(whItem.id) 
                || appData.inventory.find(i => normalizeName(i.name) === normalizeName(whItem.name));

              if (used && (Number(used.quantity) || 0) > 0) {
                  const deductQty = Number(used.quantity) || 0;
                  const newQty = whItem.quantity - deductQty;
                  console.log(`[WO Inventory] Deducting "${whItem.name}": ${whItem.quantity} → ${newQty} (used ${deductQty})`);
                  deductionSummary.push(`${whItem.name}: -${deductQty}`);
                  return { ...whItem, quantity: newQty };
              }
              return whItem;
          });

          // Warn about unmatched inventory items (admin typed custom name not in warehouse)
          appData.inventory.forEach(inv => {
              const matchedByName = newWarehouse.items.some(
                w => normalizeName(w.name) === normalizeName(inv.name)
              );
              const matchedById = inv.warehouseItemId && newWarehouse.items.some(
                w => w.id === inv.warehouseItemId
              );
              if (!matchedById && !matchedByName && (inv.quantity || 0) > 0) {
                  console.warn(`[WO Inventory] No warehouse match for "${inv.name}" (qty: ${inv.quantity}). Item not deducted from warehouse stock.`);
              }
          });
      }

      // Build user notification
      const parts: string[] = [];
      if (requiredOpen > 0) parts.push(`OC: -${requiredOpen.toFixed(2)} sets`);
      if (requiredClosed > 0) parts.push(`CC: -${requiredClosed.toFixed(2)} sets`);
      parts.push(...deductionSummary);
      if (parts.length > 0) {
        console.log(`[WO Inventory] Deduction complete: ${parts.join(', ')}`);
      }
    } else {
      console.log(`[WO Inventory] Skipping deduction — estimate already has Work Order status (double-deduction guard).`);
    }

    // 3. Update Warehouse State Locally
    dispatch({ type: 'UPDATE_DATA', payload: { warehouse: newWarehouse } });
    
    const record = await saveEstimate(results, 'Work Order', { workOrderLines }, false);
    
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

        // 4. OPTIMISTIC UPDATE: Navigate Immediately
        dispatch({ type: 'SET_VIEW', payload: 'dashboard' });
        
        const notifMsg = alreadyDeducted
          ? 'Work Order Updated (inventory already deducted).'
          : 'Work Order Created — Warehouse Inventory Deducted!';
        dispatch({ type: 'SET_NOTIFICATION', payload: { type: 'success', message: notifMsg } });
        
        // 5. Generate PDF Locally
        generateWorkOrderPDF(appData, record!);

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
      // 1. Update warehouse stock in Supabase (foam chemical sets)
      await updateWarehouseStock(
        session.organizationId,
        currentWarehouse.openCellSets,
        currentWarehouse.closedCellSets
      );

      // 2. Update general inventory items (deducted quantities)
      for (const item of currentWarehouse.items) {
        await upsertInventoryItem(item, session.organizationId);
      }

      // 3. Update equipment status
      for (const eq of currentEquipment) {
        if (eq.status === 'In Use') {
          await updateEquipmentStatus(eq.id, eq.status, eq.lastSeen);
        }
      }

      // 4. Create material usage log entries (estimated)
      const logEntries: MaterialUsageLogEntry[] = [];
      const now = new Date().toISOString();
      
      if (results.openCellSets > 0) {
        logEntries.push({
          date: now,
          jobId: record.id,
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
          jobId: record.id,
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
            jobId: record.id,
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
        await insertMaterialLogs(logEntries, session.organizationId);
      }
      
      dispatch({ type: 'SET_SYNC_STATUS', payload: 'idle' });
      dispatch({ type: 'SET_NOTIFICATION', payload: { type: 'success', message: 'Work Order Synced Successfully' } });

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
          await Promise.all([
            insertPurchaseOrder(po, session.organizationId),
            updateWarehouseStock(session.organizationId, newWarehouse.openCellSets, newWarehouse.closedCellSets),
            ...newWarehouse.items.map((item: any) => upsertInventoryItem(item, session.organizationId)),
          ]);
          dispatch({ type: 'SET_SYNC_STATUS', payload: 'idle' });
        } catch (err) {
          console.error('PO sync error:', err);
          dispatch({ type: 'SET_SYNC_STATUS', payload: 'error' });
        }
      }
  };

  return {
    loadEstimateForEditing,
    saveEstimate,
    handleDeleteEstimate,
    handleMarkPaid,
    saveCustomer,
    confirmWorkOrder,
    createPurchaseOrder
  };
};
