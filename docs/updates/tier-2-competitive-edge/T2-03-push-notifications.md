# T2-03: Push Notifications (Admin ↔ Crew)

## Priority: Medium Impact — Competitive Edge
## Effort: High
## Status: Not Started
## Files Affected: `sw.js`, `manifest.json`, New: `services/pushService.ts`, Supabase Edge Function

---

## Problem

There's no real-time communication between admin and crew. Currently:
- Crew must manually refresh to see new work orders
- Admin has no alert when crew completes a job
- Low stock warnings only appear when someone visits the dashboard
- Auto-sync polling every 45 seconds is a workaround, not a real-time solution

The app is already a PWA with `display: "standalone"` — it's perfectly set up for Web Push.

## Solution

### Step 1: Generate VAPID Keys

```bash
npx web-push generate-vapid-keys
```

Store keys as environment variables:
- `VITE_VAPID_PUBLIC_KEY` — client-side
- `VAPID_PRIVATE_KEY` — Supabase Edge Function secret

### Step 2: Client-Side Subscribe

```typescript
// services/pushService.ts
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

export async function subscribeToPush(userId: string, orgId: string): Promise<PushSubscription | null> {
  if (!('PushManager' in window)) return null;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return null;

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });

  // Store subscription on server
  await supabase.from('push_subscriptions').upsert({
    user_id: userId,
    organization_id: orgId,
    endpoint: subscription.endpoint,
    keys: JSON.stringify(subscription.toJSON().keys),
    created_at: new Date().toISOString(),
  });

  return subscription;
}
```

### Step 3: Service Worker Push Handler

```javascript
// sw.js — add to existing service worker
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? { title: 'RFE Foam Pro', body: 'You have a new notification' };
  
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192.svg',
      badge: '/icons/badge-72.png',
      data: { url: data.url || '/' },
      tag: data.tag || 'default',
      renotify: true,
      actions: data.actions || [],
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(url) && 'focus' in client) return client.focus();
      }
      return clients.openWindow(url);
    })
  );
});
```

### Step 4: Supabase Edge Function for Sending

```typescript
// supabase/functions/send-push/index.ts
import webPush from 'web-push';

webPush.setVapidDetails(
  'mailto:support@rfefoampro.com',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!
);

// Trigger on database changes via webhook or direct call
serve(async (req) => {
  const { orgId, title, body, url, targetRole } = await req.json();
  
  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('organization_id', orgId);
    
  // Filter by role if needed, then send to each subscription
  for (const sub of subscriptions) {
    await webPush.sendNotification(
      { endpoint: sub.endpoint, keys: JSON.parse(sub.keys) },
      JSON.stringify({ title, body, url })
    );
  }
});
```

### Notification Triggers

| Event | Recipient | Message |
|-------|-----------|---------|
| New work order created | Crew | "New job assigned: {customerName}" |
| Crew completes job | Admin | "Job completed: {customerName} — Review actuals" |
| Payment recorded | Admin | "Payment received: ${amount} from {customerName}" |
| Low stock alert | Admin | "Low stock: {item} at {quantity}" |
| Schedule change | Crew | "Schedule updated: {customerName} moved to {date}" |

## Database

```sql
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id),
  endpoint TEXT NOT NULL UNIQUE,
  keys JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

## iOS Considerations
- iOS 16.4+ supports Web Push for installed PWAs
- App must be added to Home Screen first
- Permission request requires user gesture
- Already have `display: "standalone"` in manifest ✓

## Impact
- Real-time crew ↔ admin communication
- Eliminates need for manual refresh / constant polling
- Critical workflow alerts (job done, payment received, low stock)
- Competitive advantage — most field service apps lack this

## Testing
1. Subscribe to push on admin device → verify subscription stored
2. Subscribe on crew device → verify separate subscription
3. Create work order → verify crew gets notification
4. Complete job as crew → verify admin gets notification
5. Click notification → verify it opens the correct view in the app
6. Test on iOS (installed PWA) → verify push works
7. Test notification with app closed → verify it still arrives
