
import React from 'react';
import { useCalculator, DEFAULT_STATE } from '../context/CalculatorContext';
import { EstimateRecord, CalculationResults, CustomerProfile, PurchaseOrder, InvoiceLineItem } from '../types';
import { deleteEstimate, markJobPaid, createWorkOrderSheet, syncUp, logMaterialUsage } from '../services/api';
import { generateWorkOrderPDF, generateDocumentPDF } from '../utils/pdfGenerator';

export const useEstimates = () => {
  const { state, dispatch } = useCalculator();
  const { appData, ui, session } = state;

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

    return newEstimate;
  };

  const handleDeleteEstimate = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (confirm("Are you sure you want to delete this job?")) {
      dispatch({ 
          type: 'UPDATE_DATA', 
          payload: { savedEstimates: appData.savedEstimates.filter(e => e.id !== id) } 
      });
      if (ui.editingEstimateId === id) { 
          dispatch({ type: 'SET_EDITING_ESTIMATE', payload: null }); 
          dispatch({ type: 'SET_VIEW', payload: 'dashboard' }); 
      }
      if (session?.spreadsheetId) {
          try {
              await deleteEstimate(id, session.spreadsheetId);
              dispatch({ type: 'SET_NOTIFICATION', payload: { type: 'success', message: 'Job Deleted' } });
          } catch (err) {
              dispatch({ type: 'SET_NOTIFICATION', payload: { type: 'error', message: 'Local delete success, but server failed.' } });
          }
      }
    }
  };

  const handleMarkPaid = async (id: string) => {
      const estimate = appData.savedEstimates.find(e => e.id === id);
      if (estimate) {
         dispatch({ type: 'SET_NOTIFICATION', payload: { type: 'success', message: 'Processing Payment & P&L...' } });
         dispatch({ type: 'SET_SYNC_STATUS', payload: 'syncing' });
         const result = await markJobPaid(id, session?.spreadsheetId || '');
         if (result.success && result.estimate) {
             const updatedEstimates = appData.savedEstimates.map(e => e.id === id ? result.estimate! : e);
             dispatch({ type: 'UPDATE_DATA', payload: { savedEstimates: updatedEstimates } });
             dispatch({ type: 'SET_NOTIFICATION', payload: { type: 'success', message: 'Paid! Profit Calculated.' } });
             generateDocumentPDF(appData, estimate.results, 'RECEIPT', result.estimate);
         } else {
             dispatch({ type: 'SET_NOTIFICATION', payload: { type: 'error', message: 'Failed to update P&L.' } });
         }
         dispatch({ type: 'SET_SYNC_STATUS', payload: 'idle' });
      }
  };

  const saveCustomer = (customerData: CustomerProfile) => {
    let updatedCustomers = [...appData.customers];
    const existingIndex = updatedCustomers.findIndex(c => c.id === customerData.id);
    if (existingIndex >= 0) updatedCustomers[existingIndex] = customerData;
    else updatedCustomers.push(customerData);
    
    if (appData.customerProfile.id === customerData.id) {
        dispatch({ type: 'UPDATE_DATA', payload: { customers: updatedCustomers, customerProfile: customerData } });
    } else {
        dispatch({ type: 'UPDATE_DATA', payload: { customers: updatedCustomers } });
    }
  };

  const confirmWorkOrder = async (results: CalculationResults, workOrderLines?: InvoiceLineItem[]) => {
    // Check if inventory was already deducted for this estimate (prevents double-deduction on re-confirm)
    const existingRecord = ui.editingEstimateId
        ? appData.savedEstimates.find(e => e.id === ui.editingEstimateId)
        : null;
    const alreadyProcessed = existingRecord?.inventoryProcessed === true;

    let newWarehouse = { ...appData.warehouse };

    if (!alreadyProcessed) {
        // 1. Deduct Inventory (Allow negatives - No checks/warnings/blocks)
        const requiredOpen = Number(results.openCellSets) || 0;
        const requiredClosed = Number(results.closedCellSets) || 0;

        newWarehouse.openCellSets = newWarehouse.openCellSets - requiredOpen;
        newWarehouse.closedCellSets = newWarehouse.closedCellSets - requiredClosed;

        // Deduct non-chemical inventory items from warehouse (warehouseItemId-first, name fallback)
        if (appData.inventory.length > 0) {
            const normalizeName = (name?: string) => (name || '').trim().toLowerCase();

            // Build a lookup keyed by warehouseItemId for items that have one
            const usageByWarehouseId = new Map<string, typeof appData.inventory[number]>();
            appData.inventory.forEach(item => {
                if (item.warehouseItemId) {
                    usageByWarehouseId.set(item.warehouseItemId, item);
                }
            });

            newWarehouse.items = newWarehouse.items.map(item => {
                // First try exact warehouseItemId match, then fall back to name match
                const used = usageByWarehouseId.get(item.id)
                    || appData.inventory.find(i => !i.warehouseItemId && normalizeName(i.name) === normalizeName(item.name));
                if (used) {
                    return { ...item, quantity: item.quantity - (Number(used.quantity) || 0) };
                }
                return item;
            });
        }

        // 2. Update Warehouse State (Local First)
        dispatch({ type: 'UPDATE_DATA', payload: { warehouse: newWarehouse } });
    }

    // Save Estimate as Work Order with inventoryProcessed flag
    // Pass false to suppress redirect to estimate_detail, so we can go to dashboard after generation
    const record = await saveEstimate(results, 'Work Order', { workOrderLines, inventoryProcessed: true }, false);
    
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
                    return { ...eq, status: 'In Use', lastSeen };
                }
                return eq;
            });
            dispatch({ type: 'UPDATE_DATA', payload: { equipment: updatedEquipment } });
        }

        // 3. OPTIMISTIC UPDATE: Navigate Immediately
        dispatch({ type: 'SET_VIEW', payload: 'dashboard' });
        dispatch({ type: 'SET_NOTIFICATION', payload: { type: 'success', message: 'Work Order Created. Processing in background...' } });
        
        // 3a. Create preliminary usage log entries (estimated)
        if (session?.spreadsheetId) {
            try {
                await logMaterialUsage(
                    record.id,
                    record.customer?.name || 'Unknown',
                    {
                        openCellSets: results.openCellSets || 0,
                        closedCellSets: results.closedCellSets || 0,
                        inventory: appData.inventory || []
                    },
                    session.username || 'Admin',
                    session.spreadsheetId,
                    'estimated'
                );
            } catch (e) {
                console.warn('Failed to create preliminary usage logs:', e);
            }
        }

        // 4. Generate PDF Locally
        generateWorkOrderPDF(appData, record!);

        // 5. Background Sync & Sheet Creation
        // Build a complete state snapshot NOW (before async gap) to avoid stale closure issues
        let snapshotCustomers = [...appData.customers];
        if (!snapshotCustomers.find(c => c.id === record.customer.id)) {
            snapshotCustomers.push(record.customer);
        }
        let snapshotEstimates = [...appData.savedEstimates];
        const snapshotIdx = snapshotEstimates.findIndex(e => e.id === record.id);
        if (snapshotIdx >= 0) snapshotEstimates[snapshotIdx] = record;
        else snapshotEstimates.unshift(record);

        const stateSnapshot = {
            ...appData,
            customers: snapshotCustomers,
            warehouse: newWarehouse,
            equipment: updatedEquipment,
            savedEstimates: snapshotEstimates
        };

        // We do NOT await this here, allowing the UI to remain responsive.
        handleBackgroundWorkOrderGeneration(record, stateSnapshot);
    }
  };

    const handleBackgroundWorkOrderGeneration = async (record: EstimateRecord, stateSnapshot: typeof appData) => {
      if (!session?.spreadsheetId) return;

      dispatch({ type: 'SET_SYNC_STATUS', payload: 'syncing' });

      try {
          // Create Standalone Sheet for Crew Log (Slow API Call)
          const woUrl = await createWorkOrderSheet(record, session.folderId, session.spreadsheetId);

          let finalRecord = record;
          if (woUrl) {
              finalRecord = { ...record, workOrderSheetUrl: woUrl };
              // Update local state with the new URL
              dispatch({ type: 'UPDATE_SAVED_ESTIMATE', payload: finalRecord });
          }

          // Update the snapshot with the final record (which may have the workOrderSheetUrl)
          const syncEstimates = stateSnapshot.savedEstimates.map(e => e.id === finalRecord.id ? finalRecord : e);
          const updatedState = { ...stateSnapshot, savedEstimates: syncEstimates };

          await syncUp(updatedState, session.spreadsheetId);

          dispatch({ type: 'SET_SYNC_STATUS', payload: 'idle' });
          dispatch({ type: 'SET_NOTIFICATION', payload: { type: 'success', message: 'Work Order & Sheet Synced Successfully' } });

      } catch (e) {
          console.error("Background WO Sync Error", e);
          dispatch({ type: 'SET_SYNC_STATUS', payload: 'error' });
          dispatch({ type: 'SET_NOTIFICATION', payload: { type: 'error', message: 'Background Sync Failed. Check Connection.' } });
      }
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
      
      dispatch({ type: 'UPDATE_DATA', payload: { warehouse: newWarehouse, purchaseOrders: updatedPOs } });
      dispatch({ type: 'SET_NOTIFICATION', payload: { type: 'success', message: 'Order Saved & Stock Updated' } });
      dispatch({ type: 'SET_VIEW', payload: 'warehouse' });
      
      if (session?.spreadsheetId) {
          dispatch({ type: 'SET_SYNC_STATUS', payload: 'syncing' });
          const updatedState = { ...appData, warehouse: newWarehouse, purchaseOrders: updatedPOs };
          await syncUp(updatedState, session.spreadsheetId);
          dispatch({ type: 'SET_SYNC_STATUS', payload: 'idle' });
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
