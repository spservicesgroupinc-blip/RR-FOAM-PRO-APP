
import { useEffect, useRef, useCallback } from 'react';
import { useCalculator, DEFAULT_STATE } from '../context/CalculatorContext';
import { EstimateRecord, MaterialUsageLogEntry } from '../types';
import {
  fetchOrgData,
  fetchCrewWorkOrders,
  fetchWarehouseState,
  syncAppDataToSupabase,
  subscribeToOrgChanges,
  subscribeToWorkOrderUpdates,
  updateOrgSettings,
  updateWarehouseStock,
  upsertInventoryItem,
  insertMaterialLogs,
  markEstimateInventoryProcessed,
} from '../services/supabaseService';
import { fetchSubscriptionStatus } from '../services/subscriptionService';

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

    console.log(`[Inventory Reconcile] Found ${unprocessed.length} unprocessed completed job(s). Reconciling...`);

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
    if (!session?.organizationId) return;

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
          const localData = localStorage.getItem(`foamProState_${session.username}`);
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
  useEffect(() => {
    if (!session?.organizationId || !ui.isInitialized) return;

    // Crew: subscribe to broadcast work-order-update events so new jobs appear
    // immediately without waiting for the 45-second polling interval.
    // Supabase Realtime Broadcast works without Supabase auth, which is
    // required for PIN-based crew sessions that have no auth.uid().
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
      return () => {
        if (unsubscribeRef.current) {
          unsubscribeRef.current();
          unsubscribeRef.current = null;
        }
      };
    }

    // Clean up previous subscription
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
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
              // Always refresh warehouse when estimates change so that
              // crew_update_job stock adjustments are reflected locally
              // before the next auto-sync writes to Supabase.
              if (data.warehouse && !isInventorySyncLocked()) {
                updatePayload.warehouse = data.warehouse;
                // Mark this warehouse state as "from server" so auto-sync doesn't
                // treat it as a local admin change and blindly write it back.
                lastSyncedWarehouseRef.current = computeWarehouseHash(data.warehouse);
              } else if (data.warehouse) {
                // Lock is held — queue a deferred refresh after lock is released
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
        // Skip refetch if we are in the middle of our own background sync
        // (each upsertInventoryItem triggers a realtime event; refetching now
        //  would overwrite locally-deducted quantities with stale server data).
        if (isInventorySyncLocked()) {
          pendingWarehouseRefreshRef.current = true;
          return;
        }
        if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
          fetchOrgData(session.organizationId).then(data => {
            // Double-check the lock; the fetch is async and the lock may have
            // been acquired while the request was in flight.
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

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [session?.organizationId, ui.isInitialized, dispatch]);

  // 4. AUTO-SYNC (debounced write to Supabase) — admin only
  useEffect(() => {
    if (ui.isLoading || !ui.isInitialized || !session?.organizationId) return;
    if (session.role === 'crew') return;

    const currentHash = computeHash(appData);

    // Always backup to localStorage
    try {
      localStorage.setItem(`foamProState_${session.username}`, JSON.stringify(appData));
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
          // Always sync settings
          await updateOrgSettings(session.organizationId, {
            yields: appData.yields,
            costs: appData.costs,
            pricingMode: appData.pricingMode,
            sqFtRates: appData.sqFtRates,
            lifetimeUsage: appData.lifetimeUsage,
          });

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
        const mergedState = { ...appData, ...cloudData };
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

  return { handleManualSync, forceRefresh, refreshSubscription };
};
