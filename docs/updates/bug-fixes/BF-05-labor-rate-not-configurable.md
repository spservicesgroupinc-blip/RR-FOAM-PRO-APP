# BF-05: Labor Rate Not Configurable in UI

## Priority: High
## Status: Not Started
## File: `components/Settings.tsx`

---

## Problem

The labor rate is defined in `DEFAULT_STATE.costs.laborRate` at `$85/hr` in `CalculatorContext.tsx`, but there is **no input field** in the Settings UI to change it. Users are stuck with the default rate unless they manually modify code.

This affects every estimate's labor cost calculation across the entire app.

## Current Settings Fields

The Settings component currently has 6 inputs:
1. Open Cell Yield (bdft/set)
2. Closed Cell Yield (bdft/set)
3. Open Cell Strokes/Set
4. Closed Cell Strokes/Set
5. Open Cell Cost/Set
6. Closed Cell Cost/Set

**Missing:** Labor Rate ($/hr)

## Fix

Add a labor rate input field to `Settings.tsx`:

```tsx
{/* Labor Rate */}
<div>
  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
    Labor Rate ($/hr)
  </label>
  <input
    type="number"
    value={state.costs.laborRate}
    onChange={(e) => onUpdateState({ costs: { ...state.costs, laborRate: parseFloat(e.target.value) || 0 } })}
    className="w-full px-4 py-3 border border-slate-200 rounded-xl font-bold text-slate-800 focus:ring-2 focus:ring-brand focus:border-brand"
    min="0"
    step="5"
  />
</div>
```

## Where It's Used
- `Calculator.tsx` — Labor cost = manHours × laborRate
- `Dashboard.tsx` — Financial stats use laborRate for COGS calculations
- `InvoiceStage.tsx` — Labor line item generation
- `EstimateStage.tsx` — Labor line item generation

## Impact
- Allows businesses with different labor rates to configure correctly
- Fixes underestimated or overestimated labor costs on every job
- Critical for accurate profit/loss reporting

## Testing
1. Go to Settings
2. Verify new "Labor Rate" field appears with current value ($85)
3. Change to $100/hr and save
4. Create a new estimate with labor hours
5. Verify labor cost calculation uses $100/hr
6. Check Dashboard financials reflect updated rate
