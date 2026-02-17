# T3-05: Reorder Points & Auto-PO Alerts

## Priority: Polish & Delight
## Effort: Medium
## Status: Not Started
## Files Affected: `types.ts`, `components/Warehouse.tsx`, `components/Dashboard.tsx`, `components/MaterialOrder.tsx`

---

## Problem

Warehouse management only detects shortages (negative stock). There's no proactive reorder point system to alert admins **before** running out. By the time stock hits zero, it's too late — jobs may be delayed.

## Solution

### Extend Warehouse Item Model

```typescript
// types.ts - extend WarehouseItem
export interface WarehouseItem {
  // ... existing
  reorderPoint?: number;     // Alert when quantity drops below this
  reorderQuantity?: number;  // Suggested order quantity
  preferredVendor?: string;  // Default vendor for reorders
}

// Foam stock reorder points (separate from items)
export interface FoamReorderConfig {
  openCellReorderPoint: number;   // default: 5 sets
  closedCellReorderPoint: number; // default: 5 sets
  openCellReorderQty: number;     // default: 10 sets
  closedCellReorderQty: number;   // default: 10 sets
}
```

### Reorder Point Configuration in Warehouse

```tsx
// Warehouse.tsx - per-item reorder point
<div className="flex items-center gap-2">
  <label className="text-[10px] text-slate-400 font-bold">Reorder at:</label>
  <input
    type="number"
    value={item.reorderPoint || 0}
    onChange={(e) => onUpdateItem(item.id, 'reorderPoint', parseInt(e.target.value) || 0)}
    className="w-16 px-2 py-1 border rounded-lg text-sm"
    min="0"
  />
</div>
```

### Dashboard Alerts

```tsx
// Dashboard.tsx
const lowStockItems = useMemo(() => {
  const alerts = [];
  
  // Foam alerts
  if (state.warehouse.openCellSets <= (fuelConfig.openCellReorderPoint || 5)) {
    alerts.push({ name: 'Open Cell Foam', current: state.warehouse.openCellSets, reorderPoint: 5 });
  }
  if (state.warehouse.closedCellSets <= (fuelConfig.closedCellReorderPoint || 5)) {
    alerts.push({ name: 'Closed Cell Foam', current: state.warehouse.closedCellSets, reorderPoint: 5 });
  }
  
  // General inventory alerts
  state.warehouse.items.forEach(item => {
    if (item.reorderPoint && item.quantity <= item.reorderPoint) {
      alerts.push({ name: item.name, current: item.quantity, reorderPoint: item.reorderPoint });
    }
  });
  
  return alerts;
}, [state.warehouse]);

// Alert Banner
{lowStockItems.length > 0 && (
  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
    <div className="flex items-center gap-2 mb-2">
      <AlertTriangle className="w-5 h-5 text-amber-600" />
      <span className="font-black text-sm text-amber-800">Low Stock Alert</span>
    </div>
    {lowStockItems.map((item, i) => (
      <div key={i} className="text-sm text-amber-700">
        <strong>{item.name}</strong>: {item.current} remaining (reorder point: {item.reorderPoint})
      </div>
    ))}
    <button onClick={() => navigateToMaterialOrder()} className="mt-3 px-4 py-2 bg-amber-600 text-white rounded-xl text-xs font-bold">
      Create Purchase Order →
    </button>
  </div>
)}
```

### Auto-Populate Material Order

When creating a new PO, auto-suggest items that are at or below reorder point with their suggested reorder quantities.

## Impact
- Proactive inventory management (prevent stockouts)
- Configurable per-item thresholds
- Dashboard visibility of inventory health
- Streamlined PO creation from alerts

## Testing
1. Set reorder point for an item to 10 → set quantity to 8
2. Verify low stock alert appears on Dashboard
3. Click "Create Purchase Order" → verify item pre-populated in PO
4. Set foam reorder point to 3 → reduce stock to 2 → verify alert
5. Restock above reorder point → verify alert clears
