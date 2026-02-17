# BF-06: No Input Validation on Warehouse Quantities

## Priority: Medium
## Status: Not Started
## File: `components/Warehouse.tsx`

---

## Problem

The Warehouse component allows general inventory items to accept **negative quantities** without any warning or validation. While foam chemical sets use `Math.max(0, value)` via `handleWarehouseStockChange` in the parent, the general inventory item quantity inputs have no such guard.

Negative quantities could result in:
- Incorrect material order calculations
- Confusing dashboard inventory health indicators
- Inaccurate cost calculations

## Current Code

```tsx
// In Warehouse.tsx - general inventory item quantity input
<input
  type="number"
  value={item.quantity}
  onChange={(e) => onUpdateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
  className="..."
/>
```

## Fix

Add `Math.max(0, ...)` guard and optional visual warning:

```tsx
<input
  type="number"
  value={item.quantity}
  onChange={(e) => onUpdateItem(item.id, 'quantity', Math.max(0, parseFloat(e.target.value) || 0))}
  min="0"
  className="..."
/>
```

Additionally, add validation in `updateWarehouseItem` in `SprayFoamCalculator.tsx`:

```tsx
const updateWarehouseItem = (id: string, field: string, value: any) => {
  const safeValue = field === 'quantity' ? Math.max(0, Number(value) || 0) : value;
  const updatedItems = appData.warehouse.items.map(i => 
    i.id === id ? { ...i, [field]: safeValue } : i
  );
  dispatch({ type: 'UPDATE_DATA', payload: { warehouse: { ...appData.warehouse, items: updatedItems } } });
};
```

## Impact
- Prevents invalid warehouse data
- Ensures material order shortage detection works correctly
- Improves data integrity across the system

## Testing
1. Go to Warehouse → Consumables tab
2. Add a general inventory item
3. Try entering a negative quantity
4. Verify it clamps to 0
5. Verify the `min="0"` attribute prevents negative values via stepper arrows
