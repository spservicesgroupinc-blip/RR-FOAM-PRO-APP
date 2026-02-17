# T3-04: Activity Feed / Audit Log

## Priority: Polish & Delight
## Effort: Medium
## Status: Not Started
## Files Affected: New: `components/ActivityFeed.tsx`, `services/supabaseService.ts`, `types.ts`

---

## Problem

In multi-user organizations (admin + multiple crew), there's no visibility into **who did what and when**. If a crew member completes a job, there's no log entry. If an admin edits an estimate, there's no audit trail. This becomes a trust and accountability issue as teams scale.

## Solution

### Data Model

```typescript
// types.ts
export interface AuditLogEntry {
  id: string;
  organizationId: string;
  userId: string;
  userName: string;
  action: string;
  entityType: 'estimate' | 'customer' | 'warehouse' | 'payment' | 'settings';
  entityId?: string;
  details?: string;
  createdAt: string;
}
```

### Auto-Log Key Actions

```typescript
// services/auditService.ts
export const logAction = async (
  orgId: string,
  userId: string,
  userName: string,
  action: string,
  entityType: string,
  entityId?: string,
  details?: string
) => {
  await supabase.from('audit_log').insert({
    organization_id: orgId,
    user_id: userId,
    user_name: userName,
    action,
    entity_type: entityType,
    entity_id: entityId,
    details,
  });
};
```

### Events to Track

| Event | Action Text | Entity |
|-------|-------------|--------|
| New estimate created | "Created estimate for {customer}" | estimate |
| Estimate edited | "Updated estimate #{id}" | estimate |
| Work order generated | "Generated work order for {customer}" | estimate |
| Invoice created | "Created invoice #{number}" | estimate |
| Payment recorded | "Recorded ${amount} payment" | payment |
| Job started (crew) | "Started job for {customer}" | estimate |
| Job completed (crew) | "Completed job — {hours}hrs, {sets} sets" | estimate |
| Customer added | "Added customer: {name}" | customer |
| Warehouse stock updated | "Updated stock: OC {±n}, CC {±n}" | warehouse |
| Settings changed | "Updated system settings" | settings |

### Activity Feed Component

```tsx
// components/ActivityFeed.tsx
export const ActivityFeed: React.FC<{ entries: AuditLogEntry[] }> = ({ entries }) => (
  <div className="space-y-3">
    {entries.map(entry => (
      <div key={entry.id} className="flex items-start gap-3 p-3 hover:bg-slate-50 rounded-xl">
        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-black text-slate-500">
          {entry.userName.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm">
            <span className="font-bold text-slate-900">{entry.userName}</span>
            {' '}<span className="text-slate-500">{entry.action}</span>
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">
            {formatRelativeTime(entry.createdAt)}
          </p>
        </div>
      </div>
    ))}
  </div>
);
```

### Dashboard Integration

Add an "Activity" section to the Dashboard sidebar or as a collapsible panel:

```tsx
<div className="bg-white rounded-2xl border p-6">
  <h3 className="font-black text-xs uppercase tracking-widest text-slate-400 mb-4">Recent Activity</h3>
  <ActivityFeed entries={recentActivity.slice(0, 10)} />
</div>
```

## Database

```sql
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  user_id UUID,
  user_name TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_audit_log_org ON audit_log(organization_id, created_at DESC);
```

## Impact
- Full accountability for all team actions
- Dispute resolution — "Who changed this estimate?"
- Compliance / record keeping
- Team performance visibility

## Testing
1. Create an estimate → verify audit log entry appears
2. Crew completes job → verify entry with crew name
3. View Dashboard → verify recent activity feed
4. Filter by entity type → verify correct filtering
5. Verify entries are in reverse chronological order
