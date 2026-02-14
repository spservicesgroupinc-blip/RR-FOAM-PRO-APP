
import { useEffect, useRef, useCallback } from 'react';
import { useCalculator, DEFAULT_STATE } from '../context/CalculatorContext';
import {
  fetchOrgData,
  syncAppDataToSupabase,
  subscribeToOrgChanges,
  updateOrgSettings,
  updateWarehouseStock,
} from '../services/supabaseService';

export const useSync = () => {
  const { state, dispatch } = useCalculator();
  const { session, appData, ui } = state;
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSyncedHashRef = useRef<string>('');
  const unsubscribeRef = useRef<(() => void) | null>(null);

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
        const cloudData = await fetchOrgData(session.organizationId);

        if (cloudData) {
          // Merge cloud data with defaults (cloud wins for persisted fields)
          const merged = { ...DEFAULT_STATE };
          for (const key of Object.keys(cloudData) as (keyof typeof cloudData)[]) {
            if (cloudData[key] !== undefined && cloudData[key] !== null) {
              (merged as any)[key] = cloudData[key];
            }
          }
          dispatch({ type: 'LOAD_DATA', payload: merged });
          dispatch({ type: 'SET_INITIALIZED', payload: true });
          lastSyncedHashRef.current = computeHash(merged);
          dispatch({ type: 'SET_SYNC_STATUS', payload: 'success' });
          setTimeout(() => dispatch({ type: 'SET_SYNC_STATUS', payload: 'idle' }), 2000);
        } else {
          // No cloud data yet — first time or empty org. Use defaults.
          dispatch({ type: 'SET_INITIALIZED', payload: true });
          dispatch({ type: 'SET_SYNC_STATUS', payload: 'idle' });
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

    // Clean up previous subscription
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
    }

    unsubscribeRef.current = subscribeToOrgChanges(
      session.organizationId,
      // Estimate changes
      (payload) => {
        if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
          // Refresh data on remote changes to keep admin/crew in sync
          fetchOrgData(session.organizationId).then(data => {
            if (data?.savedEstimates) {
              dispatch({ type: 'UPDATE_DATA', payload: { savedEstimates: data.savedEstimates } });
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
        if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
          fetchOrgData(session.organizationId).then(data => {
            if (data?.warehouse) {
              dispatch({ type: 'UPDATE_DATA', payload: { warehouse: data.warehouse } });
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
        // Only sync settings & warehouse on auto-sync (estimates are saved individually)
        await Promise.all([
          updateOrgSettings(session.organizationId, {
            yields: appData.yields,
            costs: appData.costs,
            pricingMode: appData.pricingMode,
            sqFtRates: appData.sqFtRates,
            lifetimeUsage: appData.lifetimeUsage,
          }),
          updateWarehouseStock(
            session.organizationId,
            appData.warehouse.openCellSets,
            appData.warehouse.closedCellSets
          ),
        ]);
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
      const cloudData = await fetchOrgData(session.organizationId);
      if (cloudData) {
        const mergedState = { ...appData, ...cloudData };
        dispatch({ type: 'LOAD_DATA', payload: mergedState });
        lastSyncedHashRef.current = computeHash(mergedState);
        dispatch({ type: 'SET_SYNC_STATUS', payload: 'success' });
        setTimeout(() => dispatch({ type: 'SET_SYNC_STATUS', payload: 'idle' }), 3000);
      } else {
        throw new Error('Failed to fetch data');
      }
    } catch (e) {
      console.error(e);
      dispatch({ type: 'SET_SYNC_STATUS', payload: 'error' });
      dispatch({ type: 'SET_NOTIFICATION', payload: { type: 'error', message: 'Refresh Failed.' } });
    }
  };

  return { handleManualSync, forceRefresh };
};
