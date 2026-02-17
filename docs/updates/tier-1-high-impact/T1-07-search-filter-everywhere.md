# T1-07: Search & Filter Everywhere

## Priority: High Impact
## Effort: Medium
## Status: Not Started
## Files Affected: `components/Dashboard.tsx`, `components/Customers.tsx`, `components/Warehouse.tsx`, `components/EquipmentTracker.tsx`, New: `components/SearchBar.tsx`

---

## Problem

As the app scales with more customers, estimates, and inventory items, there's no way to quickly find what you're looking for. Users must scroll through paginated lists to find a specific item. This becomes painful at:
- 50+ estimates on the Dashboard
- 20+ customers
- 30+ warehouse items

## Solution

### Step 1: Reusable SearchBar Component

```tsx
// components/SearchBar.tsx
import React from 'react';
import { Search, X } from 'lucide-react';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({ 
  value, onChange, placeholder = 'Search...', className = '' 
}) => (
  <div className={`relative ${className}`}>
    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full pl-10 pr-10 py-3 border border-slate-200 rounded-xl font-medium text-sm text-slate-800 
                 placeholder:text-slate-400 focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all"
    />
    {value && (
      <button onClick={() => onChange('')} 
        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-100 rounded-full transition-colors">
        <X className="w-3 h-3 text-slate-400" />
      </button>
    )}
  </div>
);
```

### Step 2: Dashboard — Search Estimates

```tsx
// Dashboard.tsx
const [searchQuery, setSearchQuery] = useState('');

const filteredEstimates = useMemo(() => {
  let filtered = (state.savedEstimates || []).filter(e => e && e.status !== 'Archived');
  
  // Apply search
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(e => 
      e.customer?.name?.toLowerCase().includes(q) ||
      e.id?.toLowerCase().includes(q) ||
      e.invoiceNumber?.toLowerCase().includes(q) ||
      e.status?.toLowerCase().includes(q) ||
      e.customer?.address?.toLowerCase().includes(q)
    );
  }
  
  // Apply tab filter
  if (dashboardFilter === 'review') return filtered.filter(e => ...);
  // ... existing filter logic
}, [state.savedEstimates, dashboardFilter, searchQuery]);

// In JSX:
<SearchBar 
  value={searchQuery} 
  onChange={setSearchQuery} 
  placeholder="Search by customer, address, or invoice #..." 
/>
```

### Step 3: Customers — Search Customer List

```tsx
// Customers.tsx
const [searchQuery, setSearchQuery] = useState('');

const activeCustomers = useMemo(() => {
  let customers = state.customers.filter(c => c.status !== 'Archived');
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    customers = customers.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.phone?.includes(q) ||
      c.address?.toLowerCase().includes(q) ||
      c.city?.toLowerCase().includes(q)
    );
  }
  return customers;
}, [state.customers, searchQuery]);
```

### Step 4: Warehouse — Search Inventory Items

```tsx
// Warehouse.tsx
const [searchQuery, setSearchQuery] = useState('');

const filteredItems = useMemo(() => {
  if (!searchQuery.trim()) return state.warehouse.items;
  const q = searchQuery.toLowerCase();
  return state.warehouse.items.filter(item =>
    item.name.toLowerCase().includes(q) ||
    item.unit?.toLowerCase().includes(q)
  );
}, [state.warehouse.items, searchQuery]);
```

### Step 5: Equipment Tracker — Search Equipment

```tsx
const filteredEquipment = useMemo(() => {
  if (!searchQuery.trim()) return sortedEquipment;
  const q = searchQuery.toLowerCase();
  return sortedEquipment.filter(eq =>
    eq.name.toLowerCase().includes(q) ||
    eq.lastSeen?.customerName?.toLowerCase().includes(q) ||
    eq.status.toLowerCase().includes(q)
  );
}, [sortedEquipment, searchQuery]);
```

## UX Enhancements
- Search bar appears at the top of each list view
- Debounce search input (300ms) for performance on large lists
- Show "No results found" message with clear button
- Auto-focus search on keyboard shortcut (Ctrl+F override)
- Highlight matching text in results (optional stretch goal)

## Impact
- Dramatically faster to find specific items
- Critical as data volume grows
- Expected standard feature in any business app
- Reduces frustration and improves daily usability

## Testing
1. Dashboard: Search by customer name → verify only matching estimates show
2. Dashboard: Search by invoice number → verify correct result
3. Customers: Search by phone number → verify match
4. Warehouse: Search by item name → verify filter works
5. Clear search → verify full list returns
6. Search with no results → verify "No results" message
