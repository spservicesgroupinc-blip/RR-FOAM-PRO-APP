# T2-08: Bulk Actions on Dashboard

## Priority: Medium Impact — Competitive Edge
## Effort: Medium
## Status: Not Started
## Files Affected: `components/Dashboard.tsx`

---

## Problem

The Dashboard only supports single-item actions (edit, delete, mark paid). When an admin has 50+ estimates and needs to archive old ones, delete test entries, or export data, they must do it one at a time.

## Solution

### Multi-Select UI

Add checkboxes to estimate list items with a floating action bar:

```tsx
// Dashboard.tsx
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
const [isSelectMode, setIsSelectMode] = useState(false);

const toggleSelect = (id: string) => {
  setSelectedIds(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
};

const selectAll = () => {
  setSelectedIds(new Set(filteredEstimates.map(e => e.id)));
};

const clearSelection = () => {
  setSelectedIds(new Set());
  setIsSelectMode(false);
};
```

### Floating Action Bar

```tsx
{selectedIds.size > 0 && (
  <div className="fixed bottom-20 md:bottom-8 left-1/2 -translate-x-1/2 z-50 
                  bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl
                  flex items-center gap-4 animate-in slide-in-from-bottom-4">
    <span className="font-bold text-sm">{selectedIds.size} selected</span>
    <div className="w-px h-8 bg-slate-700" />
    <button onClick={handleBulkArchive} className="flex items-center gap-2 px-4 py-2 bg-slate-800 rounded-xl hover:bg-slate-700 text-sm">
      <Archive className="w-4 h-4" /> Archive
    </button>
    <button onClick={handleBulkDelete} className="flex items-center gap-2 px-4 py-2 bg-red-600 rounded-xl hover:bg-red-700 text-sm">
      <Trash2 className="w-4 h-4" /> Delete
    </button>
    <button onClick={handleBulkExport} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 rounded-xl hover:bg-emerald-700 text-sm">
      <Download className="w-4 h-4" /> Export CSV
    </button>
    <button onClick={clearSelection} className="p-2 hover:bg-slate-800 rounded-lg">
      <X className="w-4 h-4" />
    </button>
  </div>
)}
```

### Bulk Operations

```typescript
const handleBulkArchive = () => {
  if (!confirm(`Archive ${selectedIds.size} estimates?`)) return;
  const updated = appData.savedEstimates.map(e => 
    selectedIds.has(e.id) ? { ...e, status: 'Archived' as const } : e
  );
  dispatch({ type: 'UPDATE_DATA', payload: { savedEstimates: updated } });
  clearSelection();
};

const handleBulkDelete = () => {
  if (!confirm(`Permanently delete ${selectedIds.size} estimates? This cannot be undone.`)) return;
  const updated = appData.savedEstimates.filter(e => !selectedIds.has(e.id));
  dispatch({ type: 'UPDATE_DATA', payload: { savedEstimates: updated } });
  clearSelection();
};

const handleBulkExport = () => {
  const selected = appData.savedEstimates.filter(e => selectedIds.has(e.id));
  const csv = generateCSV(selected);
  downloadFile(csv, 'estimates-export.csv', 'text/csv');
  clearSelection();
};
```

### CSV Export Format

```
Date,Customer,Status,Total,Materials,Labor,Margin
2026-01-15,John Smith,Paid,$5200,$2100,$850,43%
2026-01-22,Jane Doe,Invoiced,$3800,$1500,$680,42%
```

## Impact
- Dramatically speeds up data management at scale
- CSV export enables reporting in Excel/Google Sheets
- Bulk archive keeps dashboard clean without losing data
- Power-user feature that saves hours per month

## Testing
1. Enter select mode → verify checkboxes appear on all estimates
2. Select 3 estimates → verify floating action bar appears with count
3. "Select All" → verify all visible estimates checked
4. Bulk Archive → verify selected estimates moved to Archived
5. Bulk Export → verify CSV downloads with correct data
6. Bulk Delete → verify confirmation and permanent removal
7. Clear selection → verify action bar disappears
