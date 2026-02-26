
import { useEffect, useRef, useCallback } from 'react';
import { useCalculator, DEFAULT_STATE } from '../context/CalculatorContext';
import { EstimateRecord, MaterialUsageLogEntry } from '../types';
import { supabase } from '../src/lib/supabase';
import {
  fetchOrgData,
  fetchCrewWorkOrders,
  fetchWarehouseState,
  syncAppDataToSupabase,
  subscribeToOrgChanges,
  subscribeToWorkOrderUpdates,
  updateOrgSettings,
  updateCompanyProfile,
  updateWarehouseStock,
  upsertInventoryItem,
  upsertEquipment,
  upsertEstimate,
  upsertCustomer,
  deleteEquipmentItem,
  insertMaterialLogs,
  markEstimateInventoryProcessed,
  flushOfflineCrewQueue,
} from '../services/supabaseService';
import { fetchSubscriptionStatus } from '../services/subscriptionService';
import safeStorage from '../utils/safeStorage';

// Module-level guard: prevents the realtime subscription from overwriting
// locally-deducted warehouse inventory while a background work-order sync
// is writing updated quantities to Supabase one item at a time.
// Uses a counter so multiple concurrent sync operations (e.g. auto-sync +
// background work-order sync) don't prematurely release the lock.
let _inventorySyncLockCount = 0;
export const acquireInventorySyncLock = () => { _inventorySyncLockCount++; };
export const releaseInventorySyncLock = () => { _inventorySyncLockCount = Math.max(0, _inventorySyncLockCount - 1); };
export const isInventorySyncLocked = () => _inventorySyncLockCount > 0;
// Backward-compat shim used by useEstimates
export const setInventorySyncLock = (lock: boolean) => { 
  if (lock) acquireInventorySyncLock(); 
  else releaseInventorySyncLock(); 
};

export const useSync = () => {
  const { state, dispatch } = useCalculator();
  const { session, appData, ui } = state;
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSyncedHashRef = useRef<string>('');
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // ── Warehouse sync tracking ──────────────────────────────────────────────
  // Tracks the last warehouse state synced from/to the server. This prevents
  // the auto-sync from blindly overwriting crew_update_job warehouse adjustments
  // when only non-warehouse data (estimates, settings, etc.) triggered the sync.
  const lastSyncedWarehouseRef = useRef<string>('');
  // Set when a realtime warehouse update was blocked by the inventory sync lock.
  // After the lock is released, a deferred warehouse refresh is performed.
  const pendingWarehouseRefreshRef = useRef(false);

  const computeWarehouseHash = useCallback((warehouse: any): string => {
    if (!warehouse) return '';
    try {
      return JSON.stringify({
        oc: warehouse.openCellSets,
        cc: warehouse.closedCellSets,
        items: (warehouse.items || []).map((i: any) => ({ id: i.id, name: i.name, qty: i.quantity })),
      });
    } catch { return ''; }
  }, []);

  // ─── INVENTORY RECONCILIATION (Client-side safety net) ───────────────────
  // When crew completes a job, the updated crew_update_job SQL function adjusts
  // warehouse inventory atomically in Supabase. This client-side function is a
  // safety net that catches any completed jobs where inventoryProcessed is still
  // false (e.g., if the SQL function hasn't been re-deployed yet).
  const reconcileCompletedJobs = useCallback(async (
    estimates: EstimateRecord[],
    warehouse: any,
    orgId: string
  ) => {
    const unprocessed = estimates.filter(e =>
      e.executionStatus === 'Completed' &&
      e.actuals &&
      !e.inventoryProcessed
    );

    if (unprocessed.length === 0) return null;

    // SAFETY CHECK: Verify these jobs weren't already processed server-side
    // by crew_update_job. If the DB has inventory_processed = true but the
    // local state lost it (e.g., stale cache), re-fetch to confirm.
    // This prevents double-adjusting warehouse inventory.
    console.log(`[Inventory Reconcile] Found ${unprocessed.length} potentially unprocessed completed job(s). Verifying against server...`);
    
    // Quick DB check: fetch inventory_processed status for these estimates
    try {
      const { data: dbEstimates } = await supabase
        .from('estimates')
        .select('id, inventory_processed')
        .in('id', unprocessed.map(e => e.id));
      
      if (dbEstimates) {
        const alreadyProcessedIds = new Set(
          dbEstimates.filter(e => e.inventory_processed === true).map(e => e.id)
        );
        
        if (alreadyProcessedIds.size > 0) {
          console.log(`[Inventory Reconcile] ${alreadyProcessedIds.size} job(s) already processed server-side (crew_update_job). Skipping those and updating local state.`);
          // Fix local state for already-processed estimates
          const fixedEstimates = estimates.map(e =>
            alreadyProcessedIds.has(e.id) ? { ...e, inventoryProcessed: true } : e
          );
          dispatch({ type: 'UPDATE_DATA', payload: { savedEstimates: fixedEstimates } });
          
          // Remove already-processed from unprocessed list
          const reallyUnprocessed = unprocessed.filter(e => !alreadyProcessedIds.has(e.id));
          if (reallyUnprocessed.length === 0) {
            console.log('[Inventory Reconcile] All jobs were already processed server-side. No reconciliation needed.');
            return null;
          }
          // Continue with only truly unprocessed jobs
          unprocessed.length = 0;
          unprocessed.push(...reallyUnprocessed);
        }
      }
    } catch (err) {
      console.warn('[Inventory Reconcile] Could not verify server state, proceeding with caution:', err);
    }

    console.log(`[Inventory Reconcile] Reconciling ${unprocessed.length} unprocessed completed job(s)...`);

    const newWarehouse = {
      ...warehouse,
      items: warehouse.items ? [...warehouse.items.map((i: any) => ({ ...i }))] : [],
    };
    const updatedEstimateIds: string[] = [];
    const allLogEntries: MaterialUsageLogEntry[] = [];
    const normalizeName = (name?: string) => (name || '').trim().toLowerCase();

    for (const job of unprocessed) {
      const estOC = job.materials?.openCellSets || 0;
      const estCC = job.materials?.closedCellSets || 0;
      const actOC = job.actuals!.openCellSets || 0;
      const actCC = job.actuals!.closedCellSets || 0;

      // Foam adjustment: estimated was already deducted at work-order time.
      // Positive diff = crew used less → return stock; negative = used more → deduct more.
      newWarehouse.openCellSets = (newWarehouse.openCellSets || 0) + (estOC - actOC);
      newWarehouse.closedCellSets = (newWarehouse.closedCellSets || 0) + (estCC - actCC);

      // Non-chemical inventory item adjustments
      const estInv = job.materials?.inventory || [];
      const actInv = job.actuals!.inventory || [];

      for (const estItem of estInv) {
        const matchKey = estItem.warehouseItemId || estItem.id;
        const matchActual = actInv.find((a: any) =>
          (a.warehouseItemId || a.id) === matchKey ||
          normalizeName(a.name) === normalizeName(estItem.name)
        );
        const diff = (estItem.quantity || 0) - (matchActual?.quantity || 0);
        if (diff !== 0) {
          newWarehouse.items = newWarehouse.items.map((wh: any) => {
            if (wh.id === matchKey || normalizeName(wh.name) === normalizeName(estItem.name)) {
              return { ...wh, quantity: (wh.quantity || 0) + diff };
            }
            return wh;
          });
        }
      }

      // Handle extra items crew used that weren't in the estimate
      for (const actItem of actInv) {
        const wasEstimated = estInv.find((e: any) =>
          (e.warehouseItemId || e.id) === (actItem.warehouseItemId || actItem.id) ||
          normalizeName(e.name) === normalizeName(actItem.name)
        );
        if (!wasEstimated && (actItem.quantity || 0) > 0) {
          const whKey = actItem.warehouseItemId || actItem.id;
          newWarehouse.items = newWarehouse.items.map((wh: any) => {
            if (wh.id === whKey || normalizeName(wh.name) === normalizeName(actItem.name)) {
              return { ...wh, quantity: (wh.quantity || 0) - actItem.quantity };
            }
            return wh;
          });
        }
      }

      // Create actual material usage log entries
      const logDate = job.actuals!.completionDate || new Date().toISOString();
      const loggedBy = job.actuals!.completedBy || 'Crew';
      if (actOC > 0) allLogEntries.push({ date: logDate, jobId: job.id, customerName: job.customer?.name || '', materialName: 'Open Cell Foam', quantity: actOC, unit: 'sets', loggedBy, logType: 'actual' });
      if (actCC > 0) allLogEntries.push({ date: logDate, jobId: job.id, customerName: job.customer?.name || '', materialName: 'Closed Cell Foam', quantity: actCC, unit: 'sets', loggedBy, logType: 'actual' });
      for (const item of actInv) {
        if ((item.quantity || 0) > 0) {
          allLogEntries.push({ date: logDate, jobId: job.id, customerName: job.customer?.name || '', materialName: item.name, quantity: item.quantity, unit: item.unit || 'ea', loggedBy, logType: 'actual' });
        }
      }

      updatedEstimateIds.push(job.id);
    }

    // Apply locally
    const reconciledEstimates = estimates.map(e =>
      updatedEstimateIds.includes(e.id) ? { ...e, inventoryProcessed: true } : e
    );
    dispatch({ type: 'UPDATE_DATA', payload: { warehouse: newWarehouse, savedEstimates: reconciledEstimates } });

    // Persist to Supabase in background (lock to prevent realtime overwrite)
    acquireInventorySyncLock();
    try {
      await updateWarehouseStock(orgId, newWarehouse.openCellSets, newWarehouse.closedCellSets);
      for (const item of newWarehouse.items) {
        await upsertInventoryItem(item, orgId);
      }
      if (allLogEntries.length > 0) {
        await insertMaterialLogs(allLogEntries, orgId);
      }
      for (const id of updatedEstimateIds) {
        await markEstimateInventoryProcessed(id);
      }
      console.log(`[Inventory Reconcile] Successfully processed ${unprocessed.length} job(s).`);
      dispatch({ type: 'SET_NOTIFICATION', payload: { type: 'success', message: `Inventory updated for ${unprocessed.length} completed job(s)` } });
    } catch (err) {
      console.error('[Inventory Reconcile] Supabase persist error:', err);
    } finally {
      releaseInventorySyncLock();
    }
    // Re-apply the correct warehouse state after unlock
    dispatch({ type: 'UPDATE_DATA', payload: { warehouse: newWarehouse, savedEstimates: reconciledEstimates } });
    lastSyncedWarehouseRef.current = computeWarehouseHash(newWarehouse);
  }, [dispatch, computeWarehouseHash]);

  // Simple hash to detect changes without deep comparison
  const computeHash = useCallback((data: any): string => {
    try {
      return JSON.stringify({
        estimates: data.savedEstimates?.length,
        customers: data.customers?.length,
        warehouse: data.warehouse,
        equipment: data.equipment?.length,
        yields: data.yields,
        costs: data.costs,
        companyProfile: data.companyProfile,
        _ts: data.savedEstimates?.map((e: any) => e.lastModified || e.date).join(','),
      });
    } catch {
      return '';
    }
  }, []);

  // 1. SESSION RECOVERY
  useEffect(() => {
    if (!session) {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [session, dispatch]);

  // 2. CLOUD-FIRST INITIALIZATION — fetch all org data from Supabase
  useEffect(() => {
    if (!session) return;

    // Validate organizationId — empty/missing means the admin-crew link is broken
    if (!session.organizationId) {
      console.error('[Sync] CRITICAL: session.organizationId is empty. Work orders will NOT sync to Supabase.');
      dispatch({ type: 'SET_LOADING', payload: false });
      dispatch({ type: 'SET_INITIALIZED', payload: true });
      dispatch({ type: 'SET_NOTIFICATION', payload: {
        type: 'error',
        message: session.role === 'admin'
          ? 'Account not linked to a company. Please log out, then log back in to fix this automatically.'
          : 'Crew session invalid. Please log out and re-enter your company name and PIN.'
      }});
      return;
    }

    const initializeApp = async () => {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_SYNC_STATUS', payload: 'syncing' });

      try {
        // Use crew-specific RPC if crew role (no auth.uid() available)
        console.log(`[Sync] Initializing for role=${session.role}, org=${session.organizationId}`);
        const cloudData = session.role === 'crew'
          ? await fetchCrewWorkOrders(session.organizationId)
          : await fetchOrgData(session.organizationId);

        // Fetch subscription status for admin users
        if (session.role === 'admin') {
          fetchSubscriptionStatus(session.organizationId).then(sub => {
            if (sub) dispatch({ type: 'SET_SUBSCRIPTION', payload: sub });
          }).catch(err => console.warn('[Sync] Subscription fetch failed:', err));
        }

        if (cloudData) {
          // Merge cloud data with defaults (cloud wins for persisted fields)
          const merged = { ...DEFAULT_STATE };
          for (const key of Object.keys(cloudData) as (keyof typeof cloudData)[]) {
            if (cloudData[key] !== undefined && cloudData[key] !== null) {
              (merged as any)[key] = cloudData[key];
            }
          }
          const estimateCount = merged.savedEstimates?.length || 0;
          console.log(`[Sync] Loaded ${estimateCount} estimates from cloud`);
          
          dispatch({ type: 'LOAD_DATA', payload: merged });
          dispatch({ type: 'SET_INITIALIZED', payload: true });
          lastSyncedHashRef.current = computeHash(merged);
          lastSyncedWarehouseRef.current = computeWarehouseHash(merged.warehouse);
          dispatch({ type: 'SET_SYNC_STATUS', payload: 'success' });
          setTimeout(() => dispatch({ type: 'SET_SYNC_STATUS', payload: 'idle' }), 2000);

          // Admin: reconcile completed jobs that haven't had inventory processed
          if (session.role === 'admin' && merged.savedEstimates && merged.warehouse) {
            reconcileCompletedJobs(merged.savedEstimates, merged.warehouse, session.organizationId);
          }

          // Warn crew if zero work orders came back
          if (session.role === 'crew' && estimateCount === 0) {
            dispatch({ type: 'SET_NOTIFICATION', payload: { type: 'error', message: 'No work orders found. If jobs exist, ask admin to check Supabase RPC setup.' } });
          }
        } else {
          // No cloud data — either first time, empty org, or RPC missing
          console.warn('[Sync] Cloud data returned null');
          dispatch({ type: 'SET_INITIALIZED', payload: true });
          dispatch({ type: 'SET_SYNC_STATUS', payload: session.role === 'crew' ? 'error' : 'idle' });
          if (session.role === 'crew') {
            dispatch({ type: 'SET_NOTIFICATION', payload: { type: 'error', message: 'Failed to load work orders. Check connection or ask admin to run database setup.' } });
          }
        }
      } catch (e) {
        console.error('Cloud sync failed:', e);
        // Fallback: try localStorage
        try {
          const localData = safeStorage.getItem(`foamProState_${session.username}`);
          if (localData) {
            dispatch({ type: 'LOAD_DATA', payload: JSON.parse(localData) });
          }
        } catch { /* ignore parse errors */ }
        dispatch({ type: 'SET_INITIALIZED', payload: true });
        dispatch({ type: 'SET_SYNC_STATUS', payload: 'error' });
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    };

    initializeApp();
  }, [session?.organizationId, session?.username, dispatch, computeHash]);

  // 3. REALTIME SUBSCRIPTIONS — live updates from admin↔crew
  // Extracted into a callable function so visibility-change handler can
  // re-establish the connection after iOS kills the WebSocket in background.
  const setupRealtimeSubscription = useCallback(() => {
    if (!session?.organizationId || !ui.isInitialized) return;

    // Tear down any existing subscription first
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    if (session.role === 'crew') {
      const unsubscribe = subscribeToWorkOrderUpdates(
        session.organizationId,
        async () => {
          console.log('[Crew Realtime] Work order update received — refreshing...');
          try {
            const cloudData = await fetchCrewWorkOrders(session.organizationId);
            if (cloudData?.savedEstimates !== undefined) {
              dispatch({ type: 'UPDATE_DATA', payload: { savedEstimates: cloudData.savedEstimates } });
            }
          } catch (e) {
            console.error('[Crew Realtime] Refresh failed:', e);
          }
        }
      );
      unsubscribeRef.current = unsubscribe;
      return;
    }

    unsubscribeRef.current = subscribeToOrgChanges(
      session.organizationId,
      // Estimate changes — also refresh warehouse since crew_update_job adjusts
      // warehouse_stock atomically in the same transaction as the estimate update.
      (payload) => {
        if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
          fetchOrgData(session.organizationId).then(data => {
            if (data) {
              const updatePayload: any = {};
              if (data.savedEstimates) updatePayload.savedEstimates = data.savedEstimates;
              if (data.warehouse && !isInventorySyncLocked()) {
                updatePayload.warehouse = data.warehouse;
                lastSyncedWarehouseRef.current = computeWarehouseHash(data.warehouse);
              } else if (data.warehouse) {
                pendingWarehouseRefreshRef.current = true;
              }
              if (Object.keys(updatePayload).length > 0) {
                dispatch({ type: 'UPDATE_DATA', payload: updatePayload });
              }
            }
          });
        }
      },
      // Customer changes
      (payload) => {
        if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
          fetchOrgData(session.organizationId).then(data => {
            if (data?.customers) {
              dispatch({ type: 'UPDATE_DATA', payload: { customers: data.customers } });
            }
          });
        }
      },
      // Inventory changes
      (payload) => {
        if (isInventorySyncLocked()) {
          pendingWarehouseRefreshRef.current = true;
          return;
        }
        if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
          fetchOrgData(session.organizationId).then(data => {
            if (isInventorySyncLocked()) {
              pendingWarehouseRefreshRef.current = true;
              return;
            }
            if (data?.warehouse) {
              dispatch({ type: 'UPDATE_DATA', payload: { warehouse: data.warehouse } });
              lastSyncedWarehouseRef.current = computeWarehouseHash(data.warehouse);
            }
          });
        }
      }
    );
  }, [session?.organizationId, session?.role, ui.isInitialized, dispatch, computeWarehouseHash]);

  // Initial realtime subscription setup
  useEffect(() => {
    if (!session?.organizationId || !ui.isInitialized) return;
    setupRealtimeSubscription();
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [session?.organizationId, ui.isInitialized, setupRealtimeSubscription]);

  // 4. AUTO-SYNC (debounced write to Supabase) — admin only
  useEffect(() => {
    if (ui.isLoading || !ui.isInitialized || !session?.organizationId) return;
    if (session.role === 'crew') return;

    const currentHash = computeHash(appData);

    // Always backup to localStorage
    try {
      safeStorage.setItem(`foamProState_${session.username}`, JSON.stringify(appData));
    } catch { /* quota exceeded — ignore */ }

    if (currentHash === lastSyncedHashRef.current) return;

    dispatch({ type: 'SET_SYNC_STATUS', payload: 'pending' });
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);

    syncTimerRef.current = setTimeout(async () => {
      dispatch({ type: 'SET_SYNC_STATUS', payload: 'syncing' });
      try {
        // Determine if warehouse actually changed locally (admin action) vs
        // just being carried along by an unrelated data change (estimate
        // timestamp update, settings tweak, etc.).  Only write warehouse
        // when it was the admin who changed it — this prevents the auto-sync
        // from blindly overwriting crew_update_job warehouse adjustments.
        const warehouseNeedsSync = computeWarehouseHash(appData.warehouse) !== lastSyncedWarehouseRef.current;

        acquireInventorySyncLock();
        try {
          // Always sync settings (website lives here too, not in updateCompanyProfile)
          await updateOrgSettings(session.organizationId, {
            yields: appData.yields,
            costs: appData.costs,
            pricingMode: appData.pricingMode,
            sqFtRates: appData.sqFtRates,
            lifetimeUsage: appData.lifetimeUsage,
            website: appData.companyProfile?.website || '',
          });

          // Always sync company profile (name, address, logo, etc.)
          await updateCompanyProfile(session.organizationId, appData.companyProfile);

          // Always sync equipment items
          if (appData.equipment?.length > 0) {
            await Promise.all(
              appData.equipment.map(item =>
                upsertEquipment(item, session.organizationId)
              )
            );
          }

          // Sync estimates — ensures any failed background upserts are retried.
          // Each estimate is upserted individually so one bad record doesn't
          // block the rest. Errors are logged but don't abort the sync.
          if (appData.savedEstimates?.length > 0) {
            await Promise.allSettled(
              appData.savedEstimates.map(estimate =>
                upsertEstimate(estimate, session.organizationId).catch(err => {
                  console.warn(`[Auto-Sync] Estimate ${estimate.id} sync failed:`, err?.message || err);
                })
              )
            );
          }

          // Sync customers — ensures any failed background upserts are retried.
          if (appData.customers?.length > 0) {
            await Promise.allSettled(
              appData.customers.map(customer =>
                upsertCustomer(customer, session.organizationId).catch(err => {
                  console.warn(`[Auto-Sync] Customer ${customer.id} sync failed:`, err?.message || err);
                })
              )
            );
          }

          // Only sync warehouse when it actually changed locally
          if (warehouseNeedsSync) {
            console.log('[Auto-Sync] Warehouse changed locally — syncing to server');
            const warehouseResults = await Promise.all([
              updateWarehouseStock(
                session.organizationId,
                appData.warehouse.openCellSets,
                appData.warehouse.closedCellSets
              ),
              ...appData.warehouse.items.map(item =>
                upsertInventoryItem(item, session.organizationId)
              ),
            ]);

            // Backfill Supabase UUIDs for any warehouse items that had local IDs.
            // The first result is warehouse stock; the rest are inventory items.
            const inventorySaved = warehouseResults.slice(1);
            let needsIdUpdate = false;
            const updatedItems = appData.warehouse.items.map((item, idx) => {
              const saved = inventorySaved[idx] as any;
              if (saved && saved.id && saved.id !== item.id) {
                needsIdUpdate = true;
                return { ...item, id: saved.id };
              }
              return item;
            });
            if (needsIdUpdate) {
              const newWarehouse = { ...appData.warehouse, items: updatedItems };
              dispatch({ type: 'UPDATE_DATA', payload: { warehouse: newWarehouse } });
              lastSyncedWarehouseRef.current = computeWarehouseHash(newWarehouse);
            } else {
              lastSyncedWarehouseRef.current = computeWarehouseHash(appData.warehouse);
            }
          }
        } finally {
          releaseInventorySyncLock();
        }

        // After releasing the lock, check if any warehouse updates were
        // deferred during the sync window (realtime events blocked by lock).
        // Fetch fresh warehouse from server to pick up crew_update_job adjustments.
        if (pendingWarehouseRefreshRef.current) {
          pendingWarehouseRefreshRef.current = false;
          try {
            const freshWarehouse = await fetchWarehouseState(session.organizationId);
            if (freshWarehouse) {
              console.log('[Auto-Sync] Deferred warehouse refresh — applying server state');
              dispatch({ type: 'UPDATE_DATA', payload: { warehouse: freshWarehouse } });
              lastSyncedWarehouseRef.current = computeWarehouseHash(freshWarehouse);
            }
          } catch (e) {
            console.error('[Auto-Sync] Deferred warehouse refresh failed:', e);
          }
        }

        lastSyncedHashRef.current = currentHash;
        dispatch({ type: 'SET_SYNC_STATUS', payload: 'success' });
        setTimeout(() => dispatch({ type: 'SET_SYNC_STATUS', payload: 'idle' }), 2000);
      } catch (err) {
        console.error('Auto-sync error:', err);
        dispatch({ type: 'SET_SYNC_STATUS', payload: 'error' });
      }
    }, 3000);

    return () => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
  }, [appData, ui.isLoading, ui.isInitialized, session, dispatch, computeHash]);

  // 5. MANUAL FORCE SYNC (Push entire state)
  const handleManualSync = async () => {
    if (!session?.organizationId) return;
    dispatch({ type: 'SET_SYNC_STATUS', payload: 'syncing' });

    try {
      const success = await syncAppDataToSupabase(appData, session.organizationId);

      if (success) {
        lastSyncedHashRef.current = computeHash(appData);
        dispatch({ type: 'SET_SYNC_STATUS', payload: 'success' });
        dispatch({ type: 'SET_NOTIFICATION', payload: { type: 'success', message: 'Cloud Sync Complete' } });
        setTimeout(() => dispatch({ type: 'SET_SYNC_STATUS', payload: 'idle' }), 3000);
      } else {
        throw new Error('Sync returned false');
      }
    } catch {
      dispatch({ type: 'SET_SYNC_STATUS', payload: 'error' });
      dispatch({ type: 'SET_NOTIFICATION', payload: { type: 'error', message: 'Sync Failed. Check Internet.' } });
    }
  };

  // 6. FORCE REFRESH (Pull from Supabase) — for crew dashboard & manual refresh
  const forceRefresh = async () => {
    if (!session?.organizationId) return;
    dispatch({ type: 'SET_SYNC_STATUS', payload: 'syncing' });

    try {
      // Use crew-specific RPC if crew role
      console.log(`[Refresh] Pulling data for role=${session.role}...`);
      const cloudData = session.role === 'crew'
        ? await fetchCrewWorkOrders(session.organizationId)
        : await fetchOrgData(session.organizationId);
      if (cloudData) {
        // Merge cloudData into appData, but skip undefined/null values so that
        // default state (yields, costs, etc.) is never overwritten with undefined
        // when settings were previously corrupted or not yet saved.
        const mergedState = { ...appData };
        for (const key of Object.keys(cloudData) as (keyof typeof cloudData)[]) {
          if ((cloudData as any)[key] !== undefined && (cloudData as any)[key] !== null) {
            (mergedState as any)[key] = (cloudData as any)[key];
          }
        }
        const estimateCount = mergedState.savedEstimates?.length || 0;
        console.log(`[Refresh] Got ${estimateCount} estimates`);
        dispatch({ type: 'LOAD_DATA', payload: mergedState });
        lastSyncedHashRef.current = computeHash(mergedState);
        lastSyncedWarehouseRef.current = computeWarehouseHash(mergedState.warehouse);
        dispatch({ type: 'SET_SYNC_STATUS', payload: 'success' });
        setTimeout(() => dispatch({ type: 'SET_SYNC_STATUS', payload: 'idle' }), 3000);

        // Admin: reconcile any newly completed jobs
        if (session?.role === 'admin' && mergedState.savedEstimates && mergedState.warehouse) {
          reconcileCompletedJobs(mergedState.savedEstimates, mergedState.warehouse, session.organizationId);
        }
      } else {
        console.warn('[Refresh] No data returned');
        dispatch({ type: 'SET_SYNC_STATUS', payload: 'error' });
        dispatch({ type: 'SET_NOTIFICATION', payload: { type: 'error', message: 'Refresh failed — no data returned. Check Supabase connection.' } });
      }
    } catch (e) {
      console.error('[Refresh] Error:', e);
      dispatch({ type: 'SET_SYNC_STATUS', payload: 'error' });
      dispatch({ type: 'SET_NOTIFICATION', payload: { type: 'error', message: 'Refresh Failed.' } });
    }
  };

  // 7. REFRESH SUBSCRIPTION STATUS
  const refreshSubscription = async () => {
    if (!session?.organizationId || session.role !== 'admin') return;
    const sub = await fetchSubscriptionStatus(session.organizationId);
    if (sub) dispatch({ type: 'SET_SUBSCRIPTION', payload: sub });
  };

  // 8. iOS VISIBILITY CHANGE — re-fetch data when app comes back to foreground
  // iOS Safari/WebKit freezes JS execution when the app is backgrounded.
  // When the user returns, stale data is displayed. This listener re-syncs
  // immediately on resume, and also flushes any queued offline crew updates.
  useEffect(() => {
    if (!session?.organizationId || !ui.isInitialized) return;

    const handleVisibilityChange = async () => {
      if (document.visibilityState !== 'visible') return;

      console.log('[iOS Resume] App became visible — re-syncing...');

      // For admin users: proactively refresh the Supabase JWT before any data fetch.
      // iOS can suspend the app for hours, allowing the access token to expire.
      // autoRefreshToken only fires on a timer which doesn't run while suspended.
      if (session.role === 'admin') {
        try {
          const { error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError) {
            console.warn('[iOS Resume] Session refresh failed:', refreshError.message);
            // Token is unrecoverable — surface a re-login prompt
            dispatch({ type: 'SET_NOTIFICATION', payload: { type: 'error', message: 'Session expired. Please log in again.' } });
            safeStorage.removeItem('foamProSession');
            dispatch({ type: 'LOGOUT' });
            return; // Skip data re-fetch — user must re-authenticate
          } else {
            console.log('[iOS Resume] Auth session refreshed successfully');
          }
        } catch (e) {
          console.warn('[iOS Resume] Session refresh error:', e);
          dispatch({ type: 'SET_NOTIFICATION', payload: { type: 'error', message: 'Session expired. Please log in again.' } });
          safeStorage.removeItem('foamProSession');
          dispatch({ type: 'LOGOUT' });
          return;
        }
      }

      // Flush any queued offline crew updates first
      try {
        const flushed = await flushOfflineCrewQueue();
        if (flushed > 0) {
          dispatch({ type: 'SET_NOTIFICATION', payload: { type: 'success', message: `Synced ${flushed} queued update(s)` } });
        }
      } catch (e) {
        console.warn('[iOS Resume] Offline queue flush error:', e);
      }

      // Re-fetch fresh data from server
      try {
        dispatch({ type: 'SET_SYNC_STATUS', payload: 'syncing' });
        const cloudData = session.role === 'crew'
          ? await fetchCrewWorkOrders(session.organizationId)
          : await fetchOrgData(session.organizationId);

        if (cloudData) {
          const updatePayload: any = {};
          if (cloudData.savedEstimates) updatePayload.savedEstimates = cloudData.savedEstimates;
          if (cloudData.customers) updatePayload.customers = cloudData.customers;
          if (cloudData.warehouse && !isInventorySyncLocked()) {
            updatePayload.warehouse = cloudData.warehouse;
            lastSyncedWarehouseRef.current = computeWarehouseHash(cloudData.warehouse);
          }
          if (Object.keys(updatePayload).length > 0) {
            dispatch({ type: 'UPDATE_DATA', payload: updatePayload });
            lastSyncedHashRef.current = computeHash({ ...appData, ...updatePayload });
          }
          dispatch({ type: 'SET_SYNC_STATUS', payload: 'success' });
          setTimeout(() => dispatch({ type: 'SET_SYNC_STATUS', payload: 'idle' }), 2000);
          console.log('[iOS Resume] Data refreshed successfully');
        } else {
          dispatch({ type: 'SET_SYNC_STATUS', payload: 'idle' });
        }
      } catch (e) {
        console.warn('[iOS Resume] Re-sync failed:', e);
        dispatch({ type: 'SET_SYNC_STATUS', payload: 'error' });
      }

      // Re-establish Realtime subscription — iOS kills WebSockets when
      // the app is backgrounded, so the existing channel is dead.
      console.log('[iOS Resume] Re-establishing Realtime subscription...');
      setupRealtimeSubscription();
    };

    // Also handle the iOS-specific pageshow event (fires on back/forward cache restore)
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        console.log('[iOS Resume] Page restored from bfcache — re-syncing...');
        handleVisibilityChange();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pageshow', handlePageShow);

    // Also listen for online events — iOS can lose connectivity silently
    const handleOnline = () => {
      console.log('[iOS Resume] Device came online — flushing queue...');
      flushOfflineCrewQueue().then(flushed => {
        if (flushed > 0) {
          dispatch({ type: 'SET_NOTIFICATION', payload: { type: 'success', message: `Synced ${flushed} queued update(s)` } });
          // Also pull fresh data
          handleVisibilityChange();
        }
      });
    };
    window.addEventListener('online', handleOnline);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pageshow', handlePageShow);
      window.removeEventListener('online', handleOnline);
    };
  }, [session?.organizationId, session?.role, ui.isInitialized, dispatch, computeHash, computeWarehouseHash, setupRealtimeSubscription]);

  return { handleManualSync, forceRefresh, refreshSubscription };
};
