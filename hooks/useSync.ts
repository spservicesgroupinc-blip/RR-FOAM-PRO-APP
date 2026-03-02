/**
 * useSync — Master data synchronization hook
 *
 * Replaces the old Supabase-based sync with Express API + WebSocket.
 * Handles:
 *  - Cloud-first initialization via GET /api/org
 *  - WebSocket realtime subscriptions
 *  - Crew polling fallback (every 10s for work orders)
 *  - Auto-sync (debounced 3s) for settings/profile (admin only)
 *  - Inventory reconciliation for completed jobs
 *  - Manual sync & force refresh
 *  - iOS/visibility-change resume handling
 *  - Warehouse hash tracking to prevent overwriting crew job adjustments
 */

import { useRef, useEffect, useCallback } from 'react';
import { useCalculator } from '../context/CalculatorContext';
import { api, getWsUrl, getAccessToken } from '../services/apiClient';
import { EstimateRecord } from '../types';

// ─── Inventory Sync Lock ─────────────────────────────────────────────────────
// Prevents realtime/polling overwrites during in-flight writes

let _inventorySyncLock = false;

export function acquireInventorySyncLock(): boolean {
  if (_inventorySyncLock) return false;
  _inventorySyncLock = true;
  return true;
}

export function releaseInventorySyncLock(): void {
  _inventorySyncLock = false;
}

export function isInventorySyncLocked(): boolean {
  return _inventorySyncLock;
}

export function setInventorySyncLock(locked: boolean): void {
  _inventorySyncLock = locked;
}

// ─── Warehouse hash for change detection ─────────────────────────────────────

function hashWarehouse(warehouse: any): string {
  if (!warehouse) return '';
  try {
    const canonical = {
      oc: warehouse.openCellSets,
      cc: warehouse.closedCellSets,
      items: (warehouse.items || [])
        .map((i: any) => ({ id: i.id, n: i.name, q: i.quantity }))
        .sort((a: any, b: any) => (a.id || a.n || '').localeCompare(b.id || b.n || '')),
    };
    return JSON.stringify(canonical);
  } catch {
    return '';
  }
}

function buildSyncHash(appData: any): string {
  try {
    return JSON.stringify({
      y: appData.yields,
      c: appData.costs,
      pm: appData.pricingMode,
      sr: appData.sqFtRates,
      lu: appData.lifetimeUsage,
      cp: appData.companyProfile,
    });
  } catch {
    return '';
  }
}

// ─── useSync hook ────────────────────────────────────────────────────────────

export const useSync = () => {
  const { state, dispatch } = useCalculator();
  const { appData, session } = state;

  const wsRef = useRef<WebSocket | null>(null);
  const crewPollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSyncHashRef = useRef<string>('');
  const warehouseHashRef = useRef<string>('');
  const initializedRef = useRef(false);
  const mountedRef = useRef(true);

  // ─── Cloud initialization ──────────────────────────────────────────────────

  const loadOrgData = useCallback(async () => {
    if (!session?.organizationId) return;

    try {
      dispatch({ type: 'SET_SYNC_STATUS', payload: 'syncing' });

      const { data, error } = await api.get<any>('/api/org');
      if (error || !data) {
        console.error('[Sync] Org data fetch failed:', error);
        dispatch({ type: 'SET_SYNC_STATUS', payload: 'error' });
        return;
      }

      const payload: Record<string, any> = {
        yields: data.yields || {},
        costs: data.costs || {},
        pricingMode: data.pricingMode || 'level_pricing',
        sqFtRates: data.sqFtRates || {},
        lifetimeUsage: data.lifetimeUsage || {},
        warehouse: data.warehouse || { openCellSets: 0, closedCellSets: 0, items: [] },
        equipment: data.equipment || [],
        companyProfile: data.companyProfile || {},
        savedEstimates: data.savedEstimates || [],
      };

      if (data.customers) payload.customers = data.customers;
      if (data.purchaseOrders) payload.purchaseOrders = data.purchaseOrders;
      if (data.materialLogs) payload.materialLogs = data.materialLogs;

      dispatch({ type: 'UPDATE_DATA', payload });

      // Track warehouse hash for change detection
      warehouseHashRef.current = hashWarehouse(payload.warehouse);
      lastSyncHashRef.current = buildSyncHash(payload);

      dispatch({ type: 'SET_SYNC_STATUS', payload: 'success' });
      setTimeout(() => {
        if (mountedRef.current) dispatch({ type: 'SET_SYNC_STATUS', payload: 'idle' });
      }, 2000);

      if (!initializedRef.current) {
        initializedRef.current = true;
        dispatch({ type: 'SET_INITIALIZED', payload: true });
      }
    } catch (err) {
      console.error('[Sync] loadOrgData exception:', err);
      dispatch({ type: 'SET_SYNC_STATUS', payload: 'error' });
    }
  }, [session?.organizationId, dispatch]);

  // ─── Partial refresh helpers ───────────────────────────────────────────────

  const refreshEstimates = useCallback(async () => {
    const { data } = await api.get<any[]>('/api/estimates');
    if (data && mountedRef.current) {
      dispatch({ type: 'UPDATE_DATA', payload: { savedEstimates: data } });
    }
  }, [dispatch]);

  const refreshCustomers = useCallback(async () => {
    if (session?.role !== 'admin') return;
    const { data } = await api.get<any[]>('/api/customers');
    if (data && mountedRef.current) {
      dispatch({ type: 'UPDATE_DATA', payload: { customers: data } });
    }
  }, [dispatch, session?.role]);

  const refreshWarehouse = useCallback(async () => {
    if (isInventorySyncLocked()) return;
    const { data } = await api.get<any>('/api/warehouse');
    if (data && mountedRef.current) {
      dispatch({ type: 'UPDATE_DATA', payload: { warehouse: data } });
      warehouseHashRef.current = hashWarehouse(data);
    }
  }, [dispatch]);

  const refreshEquipment = useCallback(async () => {
    const { data } = await api.get<any[]>('/api/equipment');
    if (data && mountedRef.current) {
      dispatch({ type: 'UPDATE_DATA', payload: { equipment: data } });
    }
  }, [dispatch]);

  // ─── WebSocket event handler ───────────────────────────────────────────────

  const handleWsEvent = useCallback(
    (msg: { type: string; data?: any }) => {
      if (isInventorySyncLocked()) {
        if (['warehouse:updated', 'estimate:updated', 'equipment:updated'].includes(msg.type)) {
          console.log('[WS] Skipping event during sync lock:', msg.type);
          return;
        }
      }

      switch (msg.type) {
        case 'connected':
          console.log('[WS] Authenticated for org:', msg.data);
          break;
        case 'estimate:updated':
        case 'workorder:broadcast':
          refreshEstimates();
          break;
        case 'customer:updated':
          refreshCustomers();
          break;
        case 'warehouse:updated':
          refreshWarehouse();
          break;
        case 'equipment:updated':
          refreshEquipment();
          break;
        case 'message:new':
        case 'maintenance:updated':
        case 'pong':
          // Handled by their respective components or ignored
          break;
        default:
          console.log('[WS] Unknown event:', msg.type);
      }
    },
    [refreshEstimates, refreshCustomers, refreshWarehouse, refreshEquipment],
  );

  // ─── WebSocket connection ──────────────────────────────────────────────────

  const connectWebSocket = useCallback(() => {
    if (!session?.organizationId || !getAccessToken()) return;

    // Close existing connection
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    try {
      const ws = new WebSocket(getWsUrl());
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[WS] Connected');
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string);
          handleWsEvent(msg);
        } catch {
          // Ignore malformed messages
        }
      };

      ws.onclose = (event) => {
        console.log('[WS] Disconnected:', event.code, event.reason);
        wsRef.current = null;

        // Auto-reconnect after 5s unless intentionally closed
        if (mountedRef.current && event.code !== 1000) {
          setTimeout(() => {
            if (mountedRef.current && session?.organizationId) {
              connectWebSocket();
            }
          }, 5000);
        }
      };

      ws.onerror = (err) => {
        console.error('[WS] Error:', err);
      };
    } catch (err) {
      console.error('[WS] Failed to connect:', err);
    }
  }, [session?.organizationId, handleWsEvent]);

  // ─── Crew polling fallback ─────────────────────────────────────────────────
  // Polls every 10s for work order updates (critical for crew on mobile)

  const startCrewPolling = useCallback(() => {
    if (crewPollTimerRef.current) return;
    if (session?.role !== 'crew') return;

    crewPollTimerRef.current = setInterval(async () => {
      if (!mountedRef.current) return;
      try {
        const { data } = await api.get<any[]>('/api/estimates');
        if (data && mountedRef.current) {
          dispatch({ type: 'UPDATE_DATA', payload: { savedEstimates: data } });
        }
      } catch (err) {
        console.warn('[Crew Poll] Failed:', err);
      }
    }, 10000);
  }, [session?.role, dispatch]);

  const stopCrewPolling = useCallback(() => {
    if (crewPollTimerRef.current) {
      clearInterval(crewPollTimerRef.current);
      crewPollTimerRef.current = null;
    }
  }, []);

  // ─── Auto-sync (debounced 3s, admin only) ─────────────────────────────────
  // Detects changes in settings/profile via hash comparison, pushes to server

  const scheduleAutoSync = useCallback(() => {
    if (!session?.organizationId || session.role !== 'admin') return;

    if (autoSyncTimerRef.current) {
      clearTimeout(autoSyncTimerRef.current);
    }

    autoSyncTimerRef.current = setTimeout(async () => {
      if (!mountedRef.current || !session?.organizationId) return;

      const currentHash = buildSyncHash(appData);
      if (currentHash === lastSyncHashRef.current) return;

      try {
        dispatch({ type: 'SET_SYNC_STATUS', payload: 'syncing' });

        // Sync settings
        await api.patch('/api/org/settings', {
          yields: appData.yields,
          costs: appData.costs,
          pricingMode: appData.pricingMode,
          sqFtRates: appData.sqFtRates,
          lifetimeUsage: appData.lifetimeUsage,
        });

        // Sync profile
        if (appData.companyProfile) {
          await api.patch('/api/org/profile', appData.companyProfile);
        }

        // Sync warehouse stock only if changed and not locked
        const currentWarehouseHash = hashWarehouse(appData.warehouse);
        if (currentWarehouseHash !== warehouseHashRef.current && !isInventorySyncLocked()) {
          await api.patch('/api/warehouse/stock', {
            openCellSets: appData.warehouse?.openCellSets || 0,
            closedCellSets: appData.warehouse?.closedCellSets || 0,
          });
          warehouseHashRef.current = currentWarehouseHash;
        }

        lastSyncHashRef.current = currentHash;
        dispatch({ type: 'SET_SYNC_STATUS', payload: 'success' });
        setTimeout(() => {
          if (mountedRef.current) dispatch({ type: 'SET_SYNC_STATUS', payload: 'idle' });
        }, 2000);
      } catch (err) {
        console.error('[AutoSync] Failed:', err);
        dispatch({ type: 'SET_SYNC_STATUS', payload: 'error' });
      }
    }, 3000);
  }, [session?.organizationId, session?.role, appData, dispatch]);

  // ─── Inventory reconciliation ──────────────────────────────────────────────
  // Client-side safety net: mark completed jobs where inventoryProcessed=false

  const reconcileInventory = useCallback(async () => {
    if (!session?.organizationId || session.role !== 'admin') return;

    const unprocessed = (appData.savedEstimates || []).filter(
      (e: EstimateRecord) =>
        (e.status === 'Work Order' || e.status === 'Invoiced' || e.status === 'Paid') &&
        !e.inventoryProcessed,
    );

    for (const estimate of unprocessed) {
      try {
        await api.patch(`/api/estimates/${estimate.id}/inventory-processed`, {});
        console.log(`[Reconcile] Marked ${estimate.id} as inventoryProcessed`);
      } catch (err) {
        console.warn(`[Reconcile] Failed for ${estimate.id}:`, err);
      }
    }
  }, [session?.organizationId, session?.role, appData.savedEstimates]);

  // ─── Manual Sync (user-triggered) ─────────────────────────────────────────

  const handleManualSync = useCallback(async () => {
    if (!session?.organizationId) return;
    dispatch({ type: 'SET_SYNC_STATUS', payload: 'syncing' });

    try {
      // Push local settings first (admin only)
      if (session.role === 'admin') {
        await api.patch('/api/org/settings', {
          yields: appData.yields,
          costs: appData.costs,
          pricingMode: appData.pricingMode,
          sqFtRates: appData.sqFtRates,
          lifetimeUsage: appData.lifetimeUsage,
        });

        if (appData.companyProfile) {
          await api.patch('/api/org/profile', appData.companyProfile);
        }
      }

      // Then pull fresh data from server
      await loadOrgData();

      dispatch({
        type: 'SET_NOTIFICATION',
        payload: { type: 'success', message: 'Sync Complete!' },
      });
    } catch (err) {
      console.error('[ManualSync] Failed:', err);
      dispatch({ type: 'SET_SYNC_STATUS', payload: 'error' });
      dispatch({
        type: 'SET_NOTIFICATION',
        payload: { type: 'error', message: 'Sync failed. Please try again.' },
      });
    }
  }, [session, appData, dispatch, loadOrgData]);

  // ─── Force Refresh (pull-only, used by crew and iOS resume) ────────────────

  const forceRefresh = useCallback(async () => {
    await loadOrgData();
  }, [loadOrgData]);

  // ─── Refresh subscription (reconnect WS) ──────────────────────────────────

  const refreshSubscription = useCallback(() => {
    connectWebSocket();
  }, [connectWebSocket]);

  // ─── iOS / Visibility change handler ───────────────────────────────────────

  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState !== 'visible') return;
      if (!session?.organizationId || !mountedRef.current) return;

      console.log('[Visibility] App resumed — refreshing...');

      // Re-fetch data
      await forceRefresh();

      // Reconnect WebSocket if disconnected
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        connectWebSocket();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [session?.organizationId, forceRefresh, connectWebSocket]);

  // ─── Init effect: load data, connect WS, start polling ────────────────────

  useEffect(() => {
    mountedRef.current = true;

    if (!session?.organizationId) return;

    // Load initial data
    loadOrgData();

    // Connect WebSocket
    connectWebSocket();

    // Start crew polling if crew role
    if (session.role === 'crew') {
      startCrewPolling();
    }

    return () => {
      mountedRef.current = false;

      // Close WebSocket
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmount');
        wsRef.current = null;
      }

      // Stop crew polling
      stopCrewPolling();

      // Clear auto-sync timer
      if (autoSyncTimerRef.current) {
        clearTimeout(autoSyncTimerRef.current);
        autoSyncTimerRef.current = null;
      }
    };
  }, [session?.organizationId, session?.role]);

  // ─── Auto-sync trigger on appData changes (admin only, debounced) ──────────

  useEffect(() => {
    if (session?.role === 'admin' && initializedRef.current) {
      scheduleAutoSync();
    }
  }, [
    appData.yields,
    appData.costs,
    appData.pricingMode,
    appData.sqFtRates,
    appData.lifetimeUsage,
    appData.companyProfile,
  ]);

  // ─── Run inventory reconciliation after initial load ───────────────────────

  useEffect(() => {
    if (initializedRef.current && session?.role === 'admin') {
      reconcileInventory();
    }
  }, [initializedRef.current, session?.role]);

  return {
    handleManualSync,
    forceRefresh,
    refreshSubscription,
  };
};
