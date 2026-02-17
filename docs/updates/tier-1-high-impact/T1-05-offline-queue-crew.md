# T1-05: Offline Queue for Crew Job Completions

## Priority: High Impact
## Effort: High
## Status: Not Started
## Files Affected: `components/CrewDashboard.tsx`, `sw.js`, New: `services/offlineQueue.ts`

---

## Problem

When crew members complete a job in the field, the completion data (actuals, labor hours, notes) is submitted directly to the Supabase API. If the crew has **no internet connectivity** (common on job sites), the submission fails with an alert and `window.location.reload()` — losing all their input data.

This is the single biggest data loss risk in the app.

## Solution

Implement an IndexedDB-backed offline queue that stores pending submissions and replays them when connectivity returns.

### Step 1: Install idb Library

```bash
npm install idb
```

### Step 2: Create Offline Queue Service

```typescript
// services/offlineQueue.ts
import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface OfflineDB extends DBSchema {
  pendingActions: {
    key: string;
    value: {
      id: string;
      type: 'job_completion' | 'timer_start' | 'sync';
      payload: any;
      createdAt: string;
      retryCount: number;
    };
    indexes: { 'by-type': string };
  };
}

const DB_NAME = 'rfe-offline-queue';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<OfflineDB>>;

const getDB = () => {
  if (!dbPromise) {
    dbPromise = openDB<OfflineDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore('pendingActions', { keyPath: 'id' });
        store.createIndex('by-type', 'type');
      },
    });
  }
  return dbPromise;
};

export const queueAction = async (type: string, payload: any): Promise<string> => {
  const db = await getDB();
  const id = crypto.randomUUID();
  await db.add('pendingActions', {
    id,
    type,
    payload,
    createdAt: new Date().toISOString(),
    retryCount: 0,
  });
  return id;
};

export const getPendingActions = async () => {
  const db = await getDB();
  return db.getAll('pendingActions');
};

export const removeAction = async (id: string) => {
  const db = await getDB();
  await db.delete('pendingActions', id);
};

export const getPendingCount = async () => {
  const db = await getDB();
  return db.count('pendingActions');
};
```

### Step 3: Queue Job Completions When Offline

```typescript
// CrewDashboard.tsx - modified completion handler
const handleCompleteJobSubmit = async () => {
  const completionData = {
    estimateId: selectedJob.id,
    orgId: organizationId,
    actuals: { openCellSets, closedCellSets, laborHours, inventory, notes, strokes },
  };

  if (!navigator.onLine) {
    // Queue for later
    await queueAction('job_completion', completionData);
    showNotification('success', 'Job saved offline. Will sync when connected.');
    return;
  }

  try {
    await crewUpdateJob(completionData);
    showNotification('success', 'Job completed!');
  } catch (err) {
    // Network request failed — queue it
    await queueAction('job_completion', completionData);
    showNotification('warning', 'Saved offline. Will sync automatically.');
  }
};
```

### Step 4: Process Queue on Reconnect

```typescript
// services/offlineQueue.ts
export const processQueue = async (handlers: Record<string, (payload: any) => Promise<void>>) => {
  const actions = await getPendingActions();
  
  for (const action of actions) {
    const handler = handlers[action.type];
    if (!handler) continue;
    
    try {
      await handler(action.payload);
      await removeAction(action.id);
      console.log(`[OfflineQueue] Processed: ${action.type} (${action.id})`);
    } catch (err) {
      console.warn(`[OfflineQueue] Failed: ${action.type} (${action.id}), retry ${action.retryCount + 1}`);
      // Increment retry count
      const db = await getDB();
      await db.put('pendingActions', { ...action, retryCount: action.retryCount + 1 });
    }
  }
};
```

### Step 5: Listen for Connectivity Changes

```typescript
// CrewDashboard.tsx - useEffect
useEffect(() => {
  const handleOnline = async () => {
    const count = await getPendingCount();
    if (count > 0) {
      showNotification('info', `Syncing ${count} pending action(s)...`);
      await processQueue({
        job_completion: async (payload) => {
          await crewUpdateJob(payload);
        },
      });
      showNotification('success', 'All offline actions synced!');
    }
  };

  window.addEventListener('online', handleOnline);
  // Also try on mount in case we came online before the listener
  if (navigator.onLine) handleOnline();

  return () => window.removeEventListener('online', handleOnline);
}, []);
```

### Step 6: Pending Badge UI

Show a badge on the crew dashboard when there are queued items:

```tsx
{pendingCount > 0 && (
  <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl flex items-center gap-2">
    <CloudOff className="w-4 h-4 text-amber-600" />
    <span className="text-sm font-bold text-amber-700">
      {pendingCount} action(s) waiting to sync
    </span>
  </div>
)}
```

## Service Worker Enhancement

Add Background Sync registration for more reliable processing:

```javascript
// sw.js
self.addEventListener('sync', (event) => {
  if (event.tag === 'process-offline-queue') {
    event.waitUntil(processOfflineQueue());
  }
});
```

## Impact
- **Eliminates data loss** for crew members working in low-connectivity areas
- Jobs are never lost — worst case, they sync later
- Professional experience — crew confidence in the tool
- Critical for field operations (spray foam jobs are often in areas with poor signal)

## Testing
1. Complete a job while online → verify normal submission works
2. Disable network (airplane mode) → complete a job → verify "Saved offline" message
3. Verify IndexedDB contains the queued action
4. Re-enable network → verify automatic sync and success notification
5. Test with multiple queued actions
6. Test retry logic with simulated server errors
