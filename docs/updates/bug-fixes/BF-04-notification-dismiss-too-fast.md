# BF-04: Error Notifications Dismiss Too Fast

## Priority: Medium
## Status: Not Started
## File: `components/Layout.tsx`

---

## Problem

In `Layout.tsx`, the notification auto-dismiss timer is set to 2000ms (2 seconds) for **all** notification types. Error messages need more reading time since they contain actionable information. Success messages can be brief, but errors should persist longer.

## Current Code

```tsx
// Layout.tsx line ~61
useEffect(() => {
  if (notification) {
    const timer = setTimeout(() => {
      clearNotification();
    }, 2000); // ← Same for both success and error
    return () => clearTimeout(timer);
  }
}, [notification, clearNotification]);
```

## Fix

Use different durations based on notification type:

```tsx
useEffect(() => {
  if (notification) {
    const duration = notification.type === 'error' ? 5000 : 2500;
    const timer = setTimeout(() => {
      clearNotification();
    }, duration);
    return () => clearTimeout(timer);
  }
}, [notification, clearNotification]);
```

**Durations:**
- Success: 2500ms (slightly longer than current for readability)
- Error: 5000ms (enough time to read and understand the problem)

## Impact
- Users can actually read error messages before they disappear
- Success confirmations remain brief and non-intrusive
- Reduces frustration when users miss critical error information

## Testing
1. Trigger a success notification (e.g., save an estimate)
2. Verify it auto-dismisses after ~2.5 seconds
3. Trigger an error notification (e.g., try to stage estimate without customer)
4. Verify it stays visible for ~5 seconds
5. Verify manual dismiss (X button) still works immediately
