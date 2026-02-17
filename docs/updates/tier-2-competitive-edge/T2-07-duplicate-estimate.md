# T2-07: Duplicate/Clone Estimate

## Priority: Medium Impact — Competitive Edge
## Effort: Low
## Status: Not Started
## Files Affected: `components/Dashboard.tsx`, `components/EstimateDetail.tsx`, `hooks/useEstimates.ts`

---

## Problem

There's no way to duplicate an existing estimate. Common use cases:
- Customer wants a revised quote (change thickness or area)
- Similar job for a different customer
- Re-quoting after materials price change
- Creating multiple scope options for the same customer

## Solution

### Clone Logic

```typescript
// hooks/useEstimates.ts
const cloneEstimate = (sourceId: string): EstimateRecord | null => {
  const source = appData.savedEstimates.find(e => e.id === sourceId);
  if (!source) return null;

  const clone: EstimateRecord = {
    ...source,
    id: crypto.randomUUID(),
    date: new Date().toISOString().split('T')[0],
    status: 'Draft',
    executionStatus: 'Not Started',
    // Clear workflow-specific fields
    invoiceNumber: undefined,
    invoiceDate: undefined,
    scheduledDate: undefined,
    paymentTerms: undefined,
    actuals: undefined,
    financials: undefined,
    workOrderSheetUrl: undefined,
    pdfLink: undefined,
    sitePhotos: undefined,
    inventoryProcessed: false,
    lastModified: new Date().toISOString(),
    notes: `Cloned from estimate ${source.id.substring(0, 8)}`,
  };

  dispatch({ type: 'UPDATE_DATA', payload: {
    savedEstimates: [...appData.savedEstimates, clone],
  }});

  return clone;
};
```

### UI Integration

#### Dashboard — Context Menu

```tsx
// Dashboard.tsx - Add to estimate row actions
<button
  onClick={(e) => { e.stopPropagation(); handleClone(est.id); }}
  className="p-2 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg"
  title="Duplicate Estimate"
>
  <Copy className="w-4 h-4" />
</button>
```

#### EstimateDetail — Action Button

```tsx
// EstimateDetail.tsx - Add to action buttons
<button onClick={() => onClone(record.id)} className="px-4 py-2 border rounded-xl text-sm font-bold">
  <Copy className="w-4 h-4 mr-1.5 inline" /> Duplicate
</button>
```

### Post-Clone Workflow

After cloning:
1. Navigate to calculator view with cloned data loaded
2. Show notification: "Estimate duplicated. Edit and save when ready."
3. Auto-save as new Draft
4. User can change customer, dimensions, pricing, etc.

## Impact
- Saves significant time for repeat job types
- Enables "Option A / Option B" quoting for customers
- Easy way to re-quote when prices change
- Common workflow action — users expect this

## Testing
1. From Dashboard, duplicate an estimate → verify new Draft created
2. Verify cloned estimates gets a new ID and today's date
3. Verify status resets to Draft (not Work Order/Invoiced)
4. Verify workflow fields are cleared (no invoice number, schedule, actuals)
5. Edit the clone → verify original is unchanged
6. Clone a "Paid" estimate → verify the clone is Draft
