# BF-01: WorkOrderStage isProcessing Never Reset

## Priority: Critical
## Status: Not Started
## File: `components/WorkOrderStage.tsx`

---

## Problem

In `WorkOrderStage.tsx`, the `isProcessing` state is set to `true` when the user clicks "Generate Work Order", but it is **never set back to `false`** after `onConfirm()` completes. This means if the operation fails or the user navigates back, the button stays in a loading/disabled state permanently.

## Current Code (Approximate)

```tsx
const handleConfirm = async () => {
  setIsProcessing(true);
  await onConfirm(lines);
  // ← isProcessing is never reset
};
```

## Fix

Add `.finally()` to reset the processing state regardless of success or failure:

```tsx
const handleConfirm = async () => {
  setIsProcessing(true);
  try {
    await onConfirm(lines);
  } catch (err) {
    console.error('Work order confirmation failed:', err);
  } finally {
    setIsProcessing(false);
  }
};
```

## Impact
- Prevents infinite spinner on the "Generate Work Order" button
- Allows retry if the operation fails
- Improves reliability of the work order creation flow

## Testing
1. Create a new estimate with a customer
2. Navigate to Work Order Stage
3. Click "Generate Work Order"
4. Verify button returns to normal state after completion
5. Simulate a network failure and verify the button is re-enabled
