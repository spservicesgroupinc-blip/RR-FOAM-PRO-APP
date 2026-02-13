
import { useEffect, useRef } from 'react';
import { useCalculator, DEFAULT_STATE } from '../context/CalculatorContext';
// Legacy syncUp/syncDown removed. Use Supabase hooks/services instead.

export const useSync = () => {
  const { state, dispatch } = useCalculator();
  const { session, appData, ui } = state;
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSyncedStateRef = useRef<string>("");

  // 1. SESSION RECOVERY (handled by SprayFoamCalculator via Supabase auth)
  // Legacy localStorage fallback removed — Supabase handles session persistence.
  useEffect(() => {
    if (!session) {
      // If no session is set yet, stop loading spinner
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [session, dispatch]);

  // 2. CLOUD-FIRST INITIALIZATION
  useEffect(() => {
    if (!session) return;

    const initializeApp = async () => {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_SYNC_STATUS', payload: 'syncing' });
      
      try {
          // Attempt Fetch from Cloud (Source of Truth)
            // TODO: Replace with Supabase data fetch/merge logic
            // dispatch({ type: 'LOAD_DATA', payload: ... });
            // dispatch({ type: 'SET_INITIALIZED', payload: true });
            // lastSyncedStateRef.current = ...;
            // dispatch({ type: 'SET_SYNC_STATUS', payload: 'success' });
      } catch (e) {
          console.error("Cloud sync failed:", e);
          
          // Fallback: If cloud fails (offline), try Local Storage
            // TODO: Add Supabase error fallback logic if needed
      } finally {
          dispatch({ type: 'SET_LOADING', payload: false });
      }
    };

    initializeApp();
  }, [session, dispatch]);

  // 3. AUTO-SYNC (Write to Cloud)
  useEffect(() => {
    if (ui.isLoading || !ui.isInitialized || !session) return;
    if (session.role === 'crew') return; // Crew doesn't auto-sync UP generally

    const currentStateStr = JSON.stringify(appData);
    
    // Always backup to local storage
    localStorage.setItem(`foamProState_${session.username}`, currentStateStr);

    // If state hasn't changed from what we last saw from/sent to cloud, do nothing
    if (currentStateStr === lastSyncedStateRef.current) return;

    // Debounce the Cloud Sync
    dispatch({ type: 'SET_SYNC_STATUS', payload: 'pending' });
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);

    syncTimerRef.current = setTimeout(async () => {
      dispatch({ type: 'SET_SYNC_STATUS', payload: 'syncing' });
      
      // TODO: Replace with Supabase sync logic
      // lastSyncedStateRef.current = currentStateStr;
      // dispatch({ type: 'SET_SYNC_STATUS', payload: 'success' });
    }, 3000); 

    return () => { if (syncTimerRef.current) clearTimeout(syncTimerRef.current); };
  }, [appData, ui.isLoading, ui.isInitialized, session, dispatch]);

  // 4. MANUAL FORCE SYNC (Push)
  const handleManualSync = async () => {
    if (!session) return;
    dispatch({ type: 'SET_SYNC_STATUS', payload: 'syncing' });
    
    const success = await syncUp(appData, session.spreadsheetId);
    
    if (success) {
      lastSyncedStateRef.current = JSON.stringify(appData);
      dispatch({ type: 'SET_SYNC_STATUS', payload: 'success' });
      dispatch({ type: 'SET_NOTIFICATION', payload: { type: 'success', message: 'Cloud Sync Complete' } });
      setTimeout(() => dispatch({ type: 'SET_SYNC_STATUS', payload: 'idle' }), 3000);
    } else {
      dispatch({ type: 'SET_SYNC_STATUS', payload: 'error' });
      dispatch({ type: 'SET_NOTIFICATION', payload: { type: 'error', message: 'Sync Failed. Check Internet.' } });
    }
  };

  // 5. FORCE REFRESH (Pull) - New for Crew Dashboard
  const forceRefresh = async () => {
      if (!session) return;
      dispatch({ type: 'SET_SYNC_STATUS', payload: 'syncing' });
      try {
          const cloudData = await syncDown(session.spreadsheetId);
          if (cloudData) {
              const mergedState = { ...state.appData, ...cloudData };
              dispatch({ type: 'LOAD_DATA', payload: mergedState });
              lastSyncedStateRef.current = JSON.stringify(mergedState);
              dispatch({ type: 'SET_SYNC_STATUS', payload: 'success' });
              setTimeout(() => dispatch({ type: 'SET_SYNC_STATUS', payload: 'idle' }), 3000);
          } else {
              throw new Error("Failed to fetch data");
          }
      } catch (e) {
          console.error(e);
          dispatch({ type: 'SET_SYNC_STATUS', payload: 'error' });
          dispatch({ type: 'SET_NOTIFICATION', payload: { type: 'error', message: 'Refresh Failed.' } });
      }
  };

  return { handleManualSync, forceRefresh };
};
