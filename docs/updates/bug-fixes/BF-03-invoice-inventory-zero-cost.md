# BF-03: Invoice Inventory Lines Default to $0

## Priority: High
## Status: Not Started
## File: `components/InvoiceStage.tsx`

---

## Problem

In `InvoiceStage.tsx`, when auto-generating invoice line items from calculator data, inventory items default to `amount: 0`. This differs from `EstimateStage.tsx` which correctly computes `(item.unitCost || 0) * item.quantity`.

This means invoices generated from work orders with inventory materials will show $0 for those line items, potentially undercharging customers.

## Current Code (InvoiceStage)

```tsx
// Inventory lines in InvoiceStage
state.inventory.filter(i => i.name).forEach(item => {
  lines.push({
    id: `inv-${item.id}`,
    item: item.name,
    description: `${item.quantity} ${item.unit}`,
    qty: String(item.quantity),
    amount: 0, // ← BUG: Should compute cost
  });
});
```

## Correct Code (from EstimateStage)

```tsx
// Inventory lines in EstimateStage
state.inventory.filter(i => i.name).forEach(item => {
  lines.push({
    id: `inv-${item.id}`,
    item: item.name,
    description: `${item.quantity} ${item.unit}`,
    qty: String(item.quantity),
    amount: (item.unitCost || 0) * item.quantity, // ← Correct
  });
});
```

## Fix

Update `InvoiceStage.tsx` to compute inventory line costs the same way `EstimateStage.tsx` does:

```tsx
amount: (item.unitCost || 0) * item.quantity,
```

## Impact
- Prevents $0 invoices for inventory materials
- Ensures invoices match estimates for material costs
- Avoids revenue loss from undercharged materials

## Testing
1. Create an estimate with inventory items that have unit costs
2. Convert to work order, then generate an invoice
3. Verify each inventory line shows the correct cost (unitCost × quantity)
4. Compare invoice total to estimate total — materials should match
