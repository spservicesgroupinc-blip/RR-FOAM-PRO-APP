
import React from 'react';
import { useCalculator, DEFAULT_STATE } from '../context/CalculatorContext';
import { EstimateRecord, CalculationResults, CustomerProfile, PurchaseOrder, InvoiceLineItem } from '../types';
import { deleteEstimate, markJobPaid, createWorkOrderSheet, syncUp } from '../services/api';
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
    // 1. Deduct Inventory (Allow negatives - No checks/warnings/blocks)
    const requiredOpen = Number(results.openCellSets) || 0;
    const requiredClosed = Number(results.closedCellSets) || 0;
    
    const newWarehouse = { ...appData.warehouse };
    newWarehouse.openCellSets = newWarehouse.openCellSets - requiredOpen;
    newWarehouse.closedCellSets = newWarehouse.closedCellSets - requiredClosed;
    
    if (appData.inventory.length > 0) {
        newWarehouse.items = newWarehouse.items.map(item => {
            const used = appData.inventory.find(i => i.name === item.name);
            if (used) {
                return { ...item, quantity: item.quantity - (Number(used.quantity) || 0) };
            }
            return item;
        });
    }

    // 2. Save Estimate as Work Order & Update Warehouse State (Local First)
    dispatch({ type: 'UPDATE_DATA', payload: { warehouse: newWarehouse } });
    
    // Pass false to suppress redirect to estimate_detail, so we can go to dashboard after generation
    // This updates the context with the new Work Order record
    const record = await saveEstimate(results, 'Work Order', { workOrderLines }, false);
    
    if (record) {
        // 3. OPTIMISTIC UPDATE: Navigate Immediately
        dispatch({ type: 'SET_VIEW', payload: 'dashboard' });
        dispatch({ type: 'SET_NOTIFICATION', payload: { type: 'success', message: 'Work Order Created. Processing in background...' } });
        
        // 4. Generate PDF Locally
        generateWorkOrderPDF(appData, record!);

        // 5. Background Sync & Sheet Creation
        // We do NOT await this here, allowing the UI to remain responsive.
        // We launch a fire-and-forget logic that updates state later.
        handleBackgroundWorkOrderGeneration(record, newWarehouse);
    }
  };

  const handleBackgroundWorkOrderGeneration = async (record: EstimateRecord, currentWarehouse: any) => {
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
          
          // Construct state snapshot for sync
          // Note: We use the captured warehouse and construct the estimate list based on current `appData` logic
          // Be aware: `appData` inside this closure refers to the state when `confirmWorkOrder` was called initially.
          // This is generally safe for this flow as user just navigated.
          
          let currentCustomers = [...appData.customers];
          if (!currentCustomers.find(c => c.id === record.customer.id)) {
              currentCustomers.push(record.customer);
          }

          let freshEstimates = [...appData.savedEstimates];
          const recIdx = freshEstimates.findIndex(e => e.id === record.id);
          if (recIdx >= 0) freshEstimates[recIdx] = finalRecord;
          else freshEstimates.unshift(finalRecord);

          const updatedState = { 
              ...appData, 
              customers: currentCustomers, 
              warehouse: currentWarehouse,
              savedEstimates: freshEstimates
          };

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
