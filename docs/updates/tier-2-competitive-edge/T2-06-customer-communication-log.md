# T2-06: Customer Communication Log

## Priority: Medium Impact — Competitive Edge
## Effort: Medium
## Status: Not Started
## Files Affected: `components/Customers.tsx`, `types.ts`, New: `components/ActivityTimeline.tsx`

---

## Problem

The customer detail page shows job history and documents but has no record of communications (calls, emails, site visits, status notes). Salespeople and project managers need a CRM-style activity log to track customer interactions.

## Solution

### Data Model

```typescript
// types.ts
export interface ActivityLogEntry {
  id: string;
  customerId: string;
  type: 'call' | 'email' | 'site_visit' | 'note' | 'status_change' | 'estimate_created' | 'payment_received';
  title: string;
  description?: string;
  createdAt: string;
  createdBy?: string;
}
```

### Activity Timeline Component

```tsx
// components/ActivityTimeline.tsx
const typeConfig = {
  call: { icon: Phone, color: 'bg-blue-100 text-blue-600', label: 'Phone Call' },
  email: { icon: Mail, color: 'bg-purple-100 text-purple-600', label: 'Email' },
  site_visit: { icon: MapPin, color: 'bg-amber-100 text-amber-600', label: 'Site Visit' },
  note: { icon: FileText, color: 'bg-slate-100 text-slate-600', label: 'Note' },
  status_change: { icon: ArrowRight, color: 'bg-emerald-100 text-emerald-600', label: 'Status Change' },
  estimate_created: { icon: Calculator, color: 'bg-sky-100 text-sky-600', label: 'Estimate' },
  payment_received: { icon: DollarSign, color: 'bg-green-100 text-green-600', label: 'Payment' },
};

export const ActivityTimeline: React.FC<{ entries: ActivityLogEntry[] }> = ({ entries }) => (
  <div className="relative">
    {/* Vertical line */}
    <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-slate-100" />
    
    {entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(entry => {
      const config = typeConfig[entry.type];
      const Icon = config.icon;
      return (
        <div key={entry.id} className="relative flex gap-4 pb-6">
          <div className={`w-12 h-12 rounded-full ${config.color} flex items-center justify-center z-10`}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="flex-1 pt-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-slate-900">{entry.title}</span>
              <span className="text-[10px] text-slate-400">{new Date(entry.createdAt).toLocaleDateString()}</span>
            </div>
            {entry.description && <p className="text-sm text-slate-500 mt-1">{entry.description}</p>}
          </div>
        </div>
      );
    })}
  </div>
);
```

### Quick Log Entry Form

```tsx
// Add to customer detail view
<div className="flex gap-2 mb-4">
  <input placeholder="Add a note..." value={newNote} onChange={...} className="flex-1 ..." />
  <select value={logType} onChange={...}>
    <option value="note">Note</option>
    <option value="call">Call</option>
    <option value="email">Email</option>
    <option value="site_visit">Site Visit</option>
  </select>
  <button onClick={handleAddLog} className="bg-brand text-white px-4 rounded-xl">Add</button>
</div>
```

### Auto-Logged Events

Automatically log certain events to the customer timeline:
- Estimate created / updated
- Work order generated
- Invoice sent
- Payment recorded
- Status changes (Lead → Active, Active → Archived)

## Database

```sql
CREATE TABLE activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

## Impact
- Full CRM-style customer interaction history
- Accountability — who said what and when
- Follow-up reminders based on last contact date
- Contextual info before calling a customer ("Last spoke 3 weeks ago about...")

## Testing
1. View customer detail → verify activity timeline section appears
2. Add a manual note → verify it appears in the timeline
3. Create an estimate for the customer → verify auto-logged entry
4. Record a payment → verify auto-logged entry
5. Sort by date → verify most recent on top
