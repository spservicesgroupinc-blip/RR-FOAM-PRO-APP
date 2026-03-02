/**
 * useEstimates — Estimate CRUD hook
 *
 * Replaces all supabaseService calls with Express API (apiClient).
 * Handles: save, delete, mark paid, confirm work order, customer upsert,
 * purchase order creation, and background work-order sync.
 */

import React, { useRef } from 'react';
import { useCalculator, DEFAULT_STATE } from '../context/CalculatorContext';
import {
  EstimateRecord,
  CalculationResults,
  CustomerProfile,
  PurchaseOrder,
  InvoiceLineItem,
  MaterialUsageLogEntry,
} from '../types';
import { checkPlanLimit } from '../services/subscriptionService';
import { api } from '../services/apiClient';
import { setInventorySyncLock } from './useSync';

export const useEstimates = () => {
  const { state, dispatch } = useCalculator();
  const { appData, ui, session } = state;

  // Tracks the in-flight estimate upsert promise so handleBackgroundWorkOrderSync
  // can await it before broadcasting to crew.
  const pendingEstimateUpsertRef = useRef<Promise<EstimateRecord | null> | null>(null);
  const cloudSaveSucceededRef = useRef<boolean>(false);
  const subscription = state.subscription;

  // ─── API helpers (replace supabaseService) ─────────────────────────────────

  async function upsertEstimateApi(
    estimate: EstimateRecord,
    _orgId: string,
  ): Promise<EstimateRecord | null> {
    const { data, error } = await api.post<EstimateRecord>('/api/estimates', estimate);
    if (error) throw new Error(error);
    return data;
  }

  async function deleteEstimateApi(id: string): Promise<boolean> {
    const { error } = await api.delete(`/api/estimates/${id}`);
    if (error) throw new Error(error);
    return true;
  }

  async function markEstimatePaidApi(
    id: string,
    financials: any,
  ): Promise<boolean> {
    const { error } = await api.patch(`/api/estimates/${id}/paid`, financials);
    if (error) throw new Error(error);
    return true;
  }

  async function upsertCustomerApi(
    customer: CustomerProfile,
    _orgId: string,
  ): Promise<CustomerProfile> {
    const { data, error } = await api.post<CustomerProfile>('/api/customers', customer);
    if (error) throw new Error(error);
    return data!;
  }

  async function updateWarehouseStockApi(
    _orgId: string,
    openCellSets: number,
    closedCellSets: number,
  ): Promise<boolean> {
    const { error } = await api.patch('/api/warehouse/stock', {
      openCellSets,
      closedCellSets,
    });
    if (error) throw new Error(error);
    return true;
  }

  async function upsertInventoryItemApi(item: any, _orgId: string): Promise<any> {
    const { data, error } = await api.post('/api/warehouse/items', item);
    if (error) throw new Error(error);
    return data;
  }

  async function upsertEquipmentApi(eq: any, _orgId: string): Promise<any> {
    const { data, error } = await api.post('/api/equipment', eq);
    if (error) throw new Error(error);
    return data;
  }

  async function updateEquipmentStatusApi(
    id: string,
    status: string,
    lastSeen?: any,
  ): Promise<boolean> {
    const { error } = await api.patch(`/api/equipment/${id}/status`, {
      status,
      lastSeen,
    });
    if (error) throw new Error(error);
    return true;
  }

  async function insertMaterialLogsApi(
    entries: MaterialUsageLogEntry[],
    _orgId: string,
  ): Promise<boolean> {
    const { error } = await api.post('/api/materials/logs', entries);
    if (error) throw new Error(error);
    return true;
  }

  async function insertPurchaseOrderApi(
    po: PurchaseOrder,
    _orgId: string,
  ): Promise<PurchaseOrder> {
    const { data, error } = await api.post<PurchaseOrder>(
      '/api/materials/purchase-orders',
      po,
    );
    if (error) throw new Error(error);
    return data!;
  }

  // ─── Load estimate for editing ────────────────────────────────────────────

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
        expenses: {
          ...record.expenses,
          laborRate: record.expenses?.laborRate ?? appData.costs.laborRate,
        },
        inventory: record.materials.inventory,
        customerProfile: record.customer,
        jobNotes: record.notes || '',
        scheduledDate: record.scheduledDate || '',
        invoiceDate: record.invoiceDate || '',
        invoiceNumber: record.invoiceNumber || '',
        paymentTerms: record.paymentTerms || 'Due on Receipt',
        pricingMode: record.pricingMode || 'level_pricing',
        sqFtRates: record.sqFtRates || { wall: 0, roof: 0 },
      },
    });
    dispatch({ type: 'SET_EDITING_ESTIMATE', payload: record.id });
    dispatch({ type: 'SET_VIEW', payload: 'estimate_detail' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ─── Save estimate ────────────────────────────────────────────────────────

  const saveEstimate = async (
    results: CalculationResults,
    targetStatus?: EstimateRecord['status'],
    extraData?: Partial<EstimateRecord>,
    shouldRedirect: boolean = true,
    awaitCloud: boolean = true,
  ) => {
    if (!appData.customerProfile.name) {
      dispatch({
        type: 'SET_NOTIFICATION',
        payload: { type: 'error', message: 'Customer Name Required to Save' },
      });
      return null;
    }

    // Check subscription limits for new estimates
    const isNewEstimate = !ui.editingEstimateId;
    if (isNewEstimate && subscription) {
      const limitCheck = checkPlanLimit(subscription, 'create_estimate');
      if (!limitCheck.allowed) {
        dispatch({
          type: 'SET_NOTIFICATION',
          payload: { type: 'error', message: limitCheck.message || 'Plan limit reached.' },
        });
        return null;
      }
    }

    const estimateId = ui.editingEstimateId || Math.random().toString(36).substr(2, 9);
    const existingRecord = appData.savedEstimates.find(
      (e: EstimateRecord) => e.id === estimateId,
    );

    let newStatus: EstimateRecord['status'] =
      targetStatus || (existingRecord?.status || 'Draft');

    let invoiceNumber = appData.invoiceNumber;
    if (!invoiceNumber) {
      invoiceNumber = existingRecord?.invoiceNumber;
      if (newStatus === 'Invoiced' && !invoiceNumber)
        invoiceNumber = `INV-${Math.floor(Math.random() * 100000)}`;
    }

    const newEstimate: EstimateRecord = {
      id: estimateId,
      customerId:
        appData.customerProfile.id ||
        Math.random().toString(36).substr(2, 9),
      date: existingRecord?.date || new Date().toISOString(),
      scheduledDate: appData.scheduledDate,
      invoiceDate: appData.invoiceDate,
      paymentTerms: appData.paymentTerms,
      status: newStatus,
      invoiceNumber: invoiceNumber,
      customer: { ...appData.customerProfile },
      inputs: {
        mode: appData.mode,
        length: appData.length,
        width: appData.width,
        wallHeight: appData.wallHeight,
        roofPitch: appData.roofPitch,
        includeGables: appData.includeGables,
        isMetalSurface: appData.isMetalSurface,
        additionalAreas: appData.additionalAreas,
      },
      results: { ...results },
      materials: {
        openCellSets: results.openCellSets,
        closedCellSets: results.closedCellSets,
        openCellStrokes: results.openCellStrokes,
        closedCellStrokes: results.closedCellStrokes,
        ocStrokesPerSet: appData.yields?.openCellStrokes || 6600,
        ccStrokesPerSet: appData.yields?.closedCellStrokes || 6600,
        inventory: [...appData.inventory],
        equipment: [...appData.jobEquipment],
      },
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
      lastModified: new Date().toISOString(),

      // Preserve custom lines if not provided in extraData
      invoiceLines: extraData?.invoiceLines || existingRecord?.invoiceLines,
      workOrderLines:
        extraData?.workOrderLines || existingRecord?.workOrderLines,
      estimateLines:
        extraData?.estimateLines || existingRecord?.estimateLines,

      ...extraData,
    };

    // Optimistic local update
    let updatedEstimates = [...appData.savedEstimates];
    const idx = updatedEstimates.findIndex(
      (e: EstimateRecord) => e.id === estimateId,
    );
    if (idx >= 0) updatedEstimates[idx] = newEstimate;
    else updatedEstimates.unshift(newEstimate);

    dispatch({
      type: 'UPDATE_DATA',
      payload: { savedEstimates: updatedEstimates },
    });
    dispatch({ type: 'SET_EDITING_ESTIMATE', payload: estimateId });

    // Ensure customer exists before saving estimate (foreign key)
    if (
      !appData.customers.find(
        (c: CustomerProfile) => c.id === appData.customerProfile.id,
      )
    ) {
      const newCustomer = {
        ...appData.customerProfile,
        id:
          appData.customerProfile.id ||
          Math.random().toString(36).substr(2, 9),
      };
      await saveCustomer(newCustomer);
    }

    // Redirect control
    if (shouldRedirect) {
      dispatch({ type: 'SET_VIEW', payload: 'estimate_detail' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    const actionLabel =
      targetStatus === 'Work Order'
        ? 'Job Sold! Moved to Work Order'
        : targetStatus === 'Invoiced'
          ? 'Invoice Generated'
          : targetStatus === 'Paid'
            ? 'Payment Recorded'
            : 'Estimate Saved';
    dispatch({
      type: 'SET_NOTIFICATION',
      payload: { type: 'success', message: actionLabel },
    });

    // Persist to server
    if (session?.organizationId) {
      const upsertPromise = upsertEstimateApi(
        newEstimate,
        session.organizationId,
      );
      pendingEstimateUpsertRef.current = upsertPromise;
      const localId = newEstimate.id;

      if (awaitCloud) {
        try {
          dispatch({ type: 'SET_SYNC_STATUS', payload: 'syncing' });
          const saved = await upsertPromise;
          if (pendingEstimateUpsertRef.current === upsertPromise) {
            pendingEstimateUpsertRef.current = null;
          }
          if (saved) {
            cloudSaveSucceededRef.current = true;
            if (saved.id !== localId) {
              dispatch({
                type: 'RENAME_ESTIMATE_ID',
                payload: {
                  oldId: localId,
                  newId: saved.id,
                  customerId: saved.customerId,
                },
              });
              newEstimate.id = saved.id;
              newEstimate.customerId = saved.customerId;
            }
            if (
              saved.customer?.id &&
              saved.customer.id !== appData.customerProfile.id
            ) {
              const savedCustomer = saved.customer;
              const alreadyInList = appData.customers.some(
                (c: CustomerProfile) => c.id === savedCustomer.id,
              );
              dispatch({
                type: 'UPDATE_DATA',
                payload: {
                  customerProfile: savedCustomer,
                  customers: alreadyInList
                    ? appData.customers.map((c: CustomerProfile) =>
                        c.id === savedCustomer.id ? savedCustomer : c,
                      )
                    : [...appData.customers, savedCustomer],
                },
              });
            }
          }
          dispatch({ type: 'SET_SYNC_STATUS', payload: 'success' });
          setTimeout(
            () => dispatch({ type: 'SET_SYNC_STATUS', payload: 'idle' }),
            2000,
          );
        } catch (err) {
          if (pendingEstimateUpsertRef.current === upsertPromise) {
            pendingEstimateUpsertRef.current = null;
          }
          console.error('Estimate save failed:', err);
          dispatch({ type: 'SET_SYNC_STATUS', payload: 'error' });
          dispatch({
            type: 'SET_NOTIFICATION',
            payload: {
              type: 'error',
              message:
                'Cloud save failed. Data saved locally — will retry automatically.',
            },
          });
        }
      } else {
        // Fire-and-forget for non-critical saves
        upsertPromise
          .then((saved) => {
            if (pendingEstimateUpsertRef.current === upsertPromise) {
              pendingEstimateUpsertRef.current = null;
            }
            if (saved) {
              if (saved.id !== localId) {
                dispatch({
                  type: 'RENAME_ESTIMATE_ID',
                  payload: {
                    oldId: localId,
                    newId: saved.id,
                    customerId: saved.customerId,
                  },
                });
              }
              if (
                saved.customer?.id &&
                saved.customer.id !== appData.customerProfile.id
              ) {
                const savedCustomer = saved.customer;
                const alreadyInList = appData.customers.some(
                  (c: CustomerProfile) => c.id === savedCustomer.id,
                );
                dispatch({
                  type: 'UPDATE_DATA',
                  payload: {
                    customerProfile: savedCustomer,
                    customers: alreadyInList
                      ? appData.customers.map((c: CustomerProfile) =>
                          c.id === savedCustomer.id ? savedCustomer : c,
                        )
                      : [...appData.customers, savedCustomer],
                  },
                });
              }
            }
          })
          .catch((err) => {
            if (pendingEstimateUpsertRef.current === upsertPromise) {
              pendingEstimateUpsertRef.current = null;
            }
            console.error('Estimate save failed:', err);
            dispatch({
              type: 'SET_NOTIFICATION',
              payload: {
                type: 'error',
                message:
                  'Cloud save failed. Data saved locally — will retry automatically.',
              },
            });
          });
      }
    }

    return newEstimate;
  };

  /**
   * Await the in-flight upsert started by saveEstimate().
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

  // ─── Delete estimate ──────────────────────────────────────────────────────

  const handleDeleteEstimate = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (confirm('Are you sure you want to delete this job?')) {
      dispatch({
        type: 'UPDATE_DATA',
        payload: {
          savedEstimates: appData.savedEstimates.filter(
            (e: EstimateRecord) => e.id !== id,
          ),
        },
      });
      if (ui.editingEstimateId === id) {
        dispatch({ type: 'SET_EDITING_ESTIMATE', payload: null });
        dispatch({ type: 'SET_VIEW', payload: 'dashboard' });
      }

      try {
        await deleteEstimateApi(id);
        dispatch({
          type: 'SET_NOTIFICATION',
          payload: { type: 'success', message: 'Job Deleted' },
        });
      } catch (err) {
        dispatch({
          type: 'SET_NOTIFICATION',
          payload: {
            type: 'error',
            message: 'Local delete success, but server failed.',
          },
        });
      }
    }
  };

  // ─── Mark paid ─────────────────────────────────────────────────────────────

  const handleMarkPaid = async (
    id: string,
    onPDFReady?: (record: EstimateRecord) => void,
  ) => {
    const estimate = appData.savedEstimates.find(
      (e: EstimateRecord) => e.id === id,
    );
    if (!estimate) return;

    dispatch({
      type: 'SET_NOTIFICATION',
      payload: { type: 'success', message: 'Processing Payment & P&L...' },
    });
    dispatch({ type: 'SET_SYNC_STATUS', payload: 'syncing' });

    const revenue = estimate.totalValue || 0;
    const chemicalCost =
      (estimate.materials?.openCellSets || 0) *
        (appData.costs.openCell || 0) +
      (estimate.materials?.closedCellSets || 0) *
        (appData.costs.closedCell || 0);
    const laborCost =
      (estimate.expenses?.manHours || 0) *
      (estimate.expenses?.laborRate || appData.costs.laborRate || 0);
    const inventoryCost = (estimate.materials?.inventory || []).reduce(
      (sum: number, i: any) => sum + (i.unitCost || 0) * (i.quantity || 0),
      0,
    );
    const miscCost =
      (estimate.expenses?.tripCharge || 0) +
      (estimate.expenses?.fuelSurcharge || 0) +
      (estimate.expenses?.other?.amount || 0);
    const totalCOGS = chemicalCost + laborCost + inventoryCost + miscCost;
    const netProfit = revenue - totalCOGS;
    const margin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

    const financials = {
      revenue,
      totalCOGS,
      chemicalCost,
      laborCost,
      inventoryCost,
      miscCost,
      netProfit,
      margin,
    };

    const paidEstimate: EstimateRecord = {
      ...estimate,
      status: 'Paid',
      financials,
      lastModified: new Date().toISOString(),
    };
    const updatedEstimates = appData.savedEstimates.map(
      (e: EstimateRecord) => (e.id === id ? paidEstimate : e),
    );
    dispatch({
      type: 'UPDATE_DATA',
      payload: { savedEstimates: updatedEstimates },
    });
    dispatch({
      type: 'SET_NOTIFICATION',
      payload: { type: 'success', message: 'Paid! Profit Calculated.' },
    });

    if (onPDFReady) {
      onPDFReady(paidEstimate);
    }

    try {
      await markEstimatePaidApi(id, financials);
    } catch (err) {
      console.error('markPaid error:', err);
      dispatch({
        type: 'SET_NOTIFICATION',
        payload: {
          type: 'error',
          message:
            'Payment saved locally but failed to sync to cloud. Use Force Sync to retry.',
        },
      });
    }

    dispatch({ type: 'SET_SYNC_STATUS', payload: 'idle' });
  };

  // ─── Save customer ────────────────────────────────────────────────────────

  const saveCustomer = async (customerData: CustomerProfile) => {
    const isNew = !appData.customers.find(
      (c: CustomerProfile) => c.id === customerData.id,
    );
    if (isNew && subscription) {
      const limitCheck = checkPlanLimit(subscription, 'create_customer');
      if (!limitCheck.allowed) {
        dispatch({
          type: 'SET_NOTIFICATION',
          payload: {
            type: 'error',
            message: limitCheck.message || 'Customer limit reached.',
          },
        });
        return;
      }
    }

    let updatedCustomers = [...appData.customers];
    const existingIndex = updatedCustomers.findIndex(
      (c: CustomerProfile) => c.id === customerData.id,
    );
    if (existingIndex >= 0) updatedCustomers[existingIndex] = customerData;
    else updatedCustomers.push(customerData);

    if (appData.customerProfile.id === customerData.id) {
      dispatch({
        type: 'UPDATE_DATA',
        payload: { customers: updatedCustomers, customerProfile: customerData },
      });
    } else {
      dispatch({
        type: 'UPDATE_DATA',
        payload: { customers: updatedCustomers },
      });
    }

    if (session?.organizationId) {
      try {
        dispatch({ type: 'SET_SYNC_STATUS', payload: 'syncing' });
        const saved = await upsertCustomerApi(
          customerData,
          session.organizationId,
        );
        if (saved.id !== customerData.id) {
          const fixed = updatedCustomers.map((c: CustomerProfile) =>
            c.id === customerData.id ? { ...customerData, id: saved.id } : c,
          );
          dispatch({ type: 'UPDATE_DATA', payload: { customers: fixed } });
        }
        dispatch({ type: 'SET_SYNC_STATUS', payload: 'success' });
        setTimeout(
          () => dispatch({ type: 'SET_SYNC_STATUS', payload: 'idle' }),
          2000,
        );
      } catch (err) {
        console.error('Customer save failed:', err);
        dispatch({ type: 'SET_SYNC_STATUS', payload: 'error' });
        dispatch({
          type: 'SET_NOTIFICATION',
          payload: {
            type: 'error',
            message:
              'Customer saved locally but failed to sync to cloud.',
          },
        });
      }
    }
  };

  // ─── Confirm Work Order ────────────────────────────────────────────────────

  const confirmWorkOrder = async (
    results: CalculationResults,
    workOrderLines?: InvoiceLineItem[],
  ) => {
    const existingRecord = ui.editingEstimateId
      ? appData.savedEstimates.find(
          (e: EstimateRecord) => e.id === ui.editingEstimateId,
        )
      : undefined;

    const alreadyDeducted = existingRecord?.inventoryProcessed === true;
    const previousMaterials = alreadyDeducted
      ? existingRecord?.materials || {
          openCellSets: 0,
          closedCellSets: 0,
          openCellStrokes: 0,
          closedCellStrokes: 0,
          ocStrokesPerSet: 6600,
          ccStrokesPerSet: 6600,
          inventory: [],
        }
      : {
          openCellSets: 0,
          closedCellSets: 0,
          openCellStrokes: 0,
          closedCellStrokes: 0,
          ocStrokesPerSet: 6600,
          ccStrokesPerSet: 6600,
          inventory: [],
        };

    const newWarehouse = {
      ...appData.warehouse,
      items: appData.warehouse.items.map((i: any) => ({ ...i })),
    };

    // 1) Foam deltas
    const requiredOpen = Number(results.openCellSets) || 0;
    const requiredClosed = Number(results.closedCellSets) || 0;
    const prevOpen = Number(previousMaterials.openCellSets) || 0;
    const prevClosed = Number(previousMaterials.closedCellSets) || 0;
    const deltaOpen = requiredOpen - prevOpen;
    const deltaClosed = requiredClosed - prevClosed;

    const deductionSummary: string[] = [];

    if (deltaOpen !== 0) {
      newWarehouse.openCellSets = newWarehouse.openCellSets - deltaOpen;
      deductionSummary.push(
        `OC: ${deltaOpen > 0 ? '-' : '+'}${Math.abs(deltaOpen).toFixed(2)} sets`,
      );
    }
    if (deltaClosed !== 0) {
      newWarehouse.closedCellSets = newWarehouse.closedCellSets - deltaClosed;
      deductionSummary.push(
        `CC: ${deltaClosed > 0 ? '-' : '+'}${Math.abs(deltaClosed).toFixed(2)} sets`,
      );
    }

    // 2) Non-chemical inventory deltas
    const normalizeName = (name?: string) =>
      (name || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const prevInventory = previousMaterials.inventory || [];

    if (appData.inventory.length > 0) {
      const resolvedInventory = appData.inventory.map((item: any) => {
        if (item.warehouseItemId) {
          const linked = newWarehouse.items.find(
            (w: any) => w.id === item.warehouseItemId,
          );
          if (linked) return item;
        }
        const match = newWarehouse.items.find(
          (w: any) => normalizeName(w.name) === normalizeName(item.name),
        );
        return match ? { ...item, warehouseItemId: match.id } : item;
      });

      const getUsageQty = (list: any[], whItem: any) => {
        const byId = list.find((i: any) => i.warehouseItemId === whItem.id);
        if (byId) return Number(byId.quantity) || 0;
        const byName = list.find(
          (i: any) => normalizeName(i.name) === normalizeName(whItem.name),
        );
        return byName ? Number(byName.quantity) || 0 : 0;
      };

      newWarehouse.items = newWarehouse.items.map((whItem: any) => {
        const currentUse = getUsageQty(resolvedInventory, whItem);
        const prevUse = getUsageQty(prevInventory as any, whItem);
        const deltaUse = currentUse - prevUse;

        if (deltaUse !== 0) {
          const newQty = whItem.quantity - deltaUse;
          deductionSummary.push(
            `${whItem.name}: ${deltaUse > 0 ? '-' : '+'}${Math.abs(deltaUse)}`,
          );
          return { ...whItem, quantity: newQty };
        }
        return whItem;
      });

      resolvedInventory.forEach((inv: any) => {
        const matchedById =
          inv.warehouseItemId &&
          newWarehouse.items.some((w: any) => w.id === inv.warehouseItemId);
        const matchedByName = newWarehouse.items.some(
          (w: any) => normalizeName(w.name) === normalizeName(inv.name),
        );
        if (!matchedById && !matchedByName && (inv.quantity || 0) > 0) {
          console.warn(
            `[WO Inventory] No warehouse match for "${inv.name}" (qty: ${inv.quantity}). Item not deducted.`,
          );
        }
      });

      dispatch({ type: 'UPDATE_DATA', payload: { inventory: resolvedInventory } });
    }

    if (deductionSummary.length > 0) {
      console.log(
        `[WO Inventory] Inventory delta applied: ${deductionSummary.join(', ')}`,
      );
    }

    // 3. Update Warehouse State Locally
    dispatch({ type: 'UPDATE_DATA', payload: { warehouse: newWarehouse } });

    const resolvedMaterials = {
      openCellSets: results.openCellSets,
      closedCellSets: results.closedCellSets,
      openCellStrokes: results.openCellStrokes,
      closedCellStrokes: results.closedCellStrokes,
      ocStrokesPerSet: appData.yields?.openCellStrokes || 6600,
      ccStrokesPerSet: appData.yields?.closedCellStrokes || 6600,
      inventory:
        appData.inventory.length > 0
          ? (() => {
              const normName = (n?: string) =>
                (n || '').trim().toLowerCase().replace(/\s+/g, ' ');
              return appData.inventory.map((item: any) => {
                if (item.warehouseItemId) {
                  const linked = newWarehouse.items.find(
                    (w: any) => w.id === item.warehouseItemId,
                  );
                  if (linked) return item;
                }
                const match = newWarehouse.items.find(
                  (w: any) => normName(w.name) === normName(item.name),
                );
                return match ? { ...item, warehouseItemId: match.id } : item;
              });
            })()
          : [...appData.inventory],
      equipment: [...appData.jobEquipment],
    };

    const record = await saveEstimate(
      results,
      'Work Order',
      { workOrderLines, materials: resolvedMaterials, inventoryProcessed: true },
      false,
      true,
    );

    if (record) {
      let updatedEquipment = appData.equipment;
      if (appData.jobEquipment.length > 0) {
        const assignedAt = new Date().toISOString();
        const lastSeen = {
          customerName: record.customer?.name || 'Unknown',
          date: assignedAt,
          crewMember: session?.username || 'Admin',
          jobId: record.id,
        };
        updatedEquipment = appData.equipment.map((eq: any) => {
          if (appData.jobEquipment.find((tool: any) => tool.id === eq.id)) {
            return { ...eq, status: 'In Use' as const, lastSeen };
          }
          return eq;
        });
        dispatch({
          type: 'UPDATE_DATA',
          payload: { equipment: updatedEquipment },
        });
      }

      // Navigate to Invoice Stage
      dispatch({ type: 'SET_VIEW', payload: 'invoice_stage' });

      const notifMsg = alreadyDeducted
        ? 'Work Order Updated! Now generate the Invoice.'
        : 'Work Order Created — Now generate the Invoice!';
      dispatch({
        type: 'SET_NOTIFICATION',
        payload: { type: 'success', message: notifMsg },
      });

      // Background persist
      handleBackgroundWorkOrderSync(
        record,
        newWarehouse,
        updatedEquipment,
        results,
      );
    }
  };

  // ─── Background Work Order Sync ────────────────────────────────────────────

  const handleBackgroundWorkOrderSync = async (
    record: EstimateRecord,
    currentWarehouse: any,
    currentEquipment: any[],
    results: CalculationResults,
  ) => {
    if (!session?.organizationId) return;

    dispatch({ type: 'SET_SYNC_STATUS', payload: 'syncing' });
    setInventorySyncLock(true);

    let persistedJobId = record.id;
    let estimatePersistedOk = cloudSaveSucceededRef.current;
    cloudSaveSucceededRef.current = false;

    // Drain pending upsert if still in flight
    if (!estimatePersistedOk && pendingEstimateUpsertRef.current) {
      try {
        const saved = await pendingEstimateUpsertRef.current;
        if (saved) {
          persistedJobId = saved.id;
          estimatePersistedOk = true;
        }
      } catch (upsertErr) {
        console.warn('[WO Sync] Pending estimate upsert failed:', upsertErr);
      } finally {
        pendingEstimateUpsertRef.current = null;
      }
    }

    // Safety-net upsert
    if (!estimatePersistedOk) {
      try {
        const saved = await upsertEstimateApi(record, session.organizationId);
        if (saved) {
          persistedJobId = saved.id;
          estimatePersistedOk = true;
          if (saved.id !== record.id) {
            dispatch({
              type: 'RENAME_ESTIMATE_ID',
              payload: {
                oldId: record.id,
                newId: saved.id,
                customerId: saved.customerId,
              },
            });
          }
        }
      } catch (retryErr) {
        console.error('[WO Sync] Estimate upsert failed:', retryErr);
      }
    }

    if (!estimatePersistedOk) {
      console.error(
        '[WO Sync] CRITICAL: Estimate NOT saved — cannot notify crew.',
      );
      dispatch({ type: 'SET_SYNC_STATUS', payload: 'error' });
      dispatch({
        type: 'SET_NOTIFICATION',
        payload: {
          type: 'error',
          message:
            'Work order failed to save to cloud. Crew will not see it. Tap Sync to retry.',
        },
      });
      setInventorySyncLock(false);
      return;
    }

    // Warehouse, inventory, equipment, material logs
    try {
      await updateWarehouseStockApi(
        session.organizationId,
        currentWarehouse.openCellSets,
        currentWarehouse.closedCellSets,
      );

      for (const item of currentWarehouse.items) {
        await upsertInventoryItemApi(item, session.organizationId);
      }

      for (const eq of currentEquipment) {
        if (eq.status === 'In Use') {
          await updateEquipmentStatusApi(eq.id, eq.status, eq.lastSeen);
        }
      }

      // Material usage log entries
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
        await insertMaterialLogsApi(logEntries, session.organizationId);
      }

      dispatch({ type: 'SET_SYNC_STATUS', payload: 'idle' });
      dispatch({
        type: 'SET_NOTIFICATION',
        payload: { type: 'success', message: 'Work Order Synced Successfully' },
      });
    } catch (e) {
      console.error(
        '[WO Sync] Warehouse/inventory sync error (work order IS saved):',
        e,
      );
      dispatch({ type: 'SET_SYNC_STATUS', payload: 'error' });
      dispatch({
        type: 'SET_NOTIFICATION',
        payload: {
          type: 'error',
          message:
            'Work order saved but inventory sync failed. Use Force Sync to retry.',
        },
      });
    } finally {
      setInventorySyncLock(false);
    }

    // Re-dispatch warehouse to override stale realtime events
    dispatch({
      type: 'UPDATE_DATA',
      payload: { warehouse: currentWarehouse },
    });
  };

  // ─── Create Purchase Order ─────────────────────────────────────────────────

  const createPurchaseOrder = async (po: PurchaseOrder) => {
    const newWarehouse = { ...appData.warehouse };
    po.items.forEach((item: any) => {
      if (item.type === 'open_cell') newWarehouse.openCellSets += item.quantity;
      if (item.type === 'closed_cell')
        newWarehouse.closedCellSets += item.quantity;
      if (item.type === 'inventory' && item.inventoryId) {
        const invItem = newWarehouse.items.find(
          (i: any) => i.id === item.inventoryId,
        );
        if (invItem) invItem.quantity += item.quantity;
      }
    });

    const updatedPOs = [...(appData.purchaseOrders || []), po];

    dispatch({
      type: 'UPDATE_DATA',
      payload: { warehouse: newWarehouse, purchaseOrders: updatedPOs },
    });
    dispatch({
      type: 'SET_NOTIFICATION',
      payload: { type: 'success', message: 'Order Saved & Stock Updated' },
    });
    dispatch({ type: 'SET_VIEW', payload: 'warehouse' });

    if (session?.organizationId) {
      dispatch({ type: 'SET_SYNC_STATUS', payload: 'syncing' });
      try {
        await insertPurchaseOrderApi(po, session.organizationId);
        await updateWarehouseStockApi(
          session.organizationId,
          newWarehouse.openCellSets,
          newWarehouse.closedCellSets,
        );
        for (const item of newWarehouse.items) {
          await upsertInventoryItemApi(item as any, session.organizationId);
        }
        dispatch({ type: 'SET_SYNC_STATUS', payload: 'idle' });
      } catch (err) {
        console.error('PO sync error:', err);
        dispatch({ type: 'SET_SYNC_STATUS', payload: 'error' });
        dispatch({
          type: 'SET_NOTIFICATION',
          payload: {
            type: 'error',
            message:
              'Purchase order saved locally but failed to sync to cloud.',
          },
        });
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
    createPurchaseOrder,
  };
};
