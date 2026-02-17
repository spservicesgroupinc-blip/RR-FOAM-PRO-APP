# T1-03: Crew Assignment on Work Orders

## Priority: High Impact
## Effort: Medium
## Status: Not Started
## Files Affected: `components/WorkOrderStage.tsx`, `components/CrewDashboard.tsx`, `types.ts`, `services/supabaseService.ts`

---

## Problem

Work orders have a scheduled date but **no crew assignment field**. For companies with multiple crews, there's no way to assign a specific crew to a job. Crews see all work orders for the org, with no way to filter to "my jobs."

## Solution

### Step 1: Extend Data Model

```typescript
// types.ts - Add to EstimateRecord
export interface EstimateRecord {
  // ... existing fields
  assignedCrewId?: string;      // Profile ID of assigned crew member
  assignedCrewName?: string;    // Display name for convenience
}
```

### Step 2: Fetch Crew Members

```typescript
// services/supabaseService.ts
export const fetchCrewMembers = async (orgId: string) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .eq('organization_id', orgId)
    .eq('role', 'crew');
  
  if (error) throw error;
  return data || [];
};
```

### Step 3: Add Crew Dropdown to WorkOrderStage

```tsx
// WorkOrderStage.tsx
const [crewMembers, setCrewMembers] = useState<{id: string, full_name: string}[]>([]);
const [selectedCrew, setSelectedCrew] = useState(state.assignedCrewId || '');

useEffect(() => {
  fetchCrewMembers(orgId).then(setCrewMembers);
}, [orgId]);

// In the form:
<div>
  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
    Assign Crew
  </label>
  <select
    value={selectedCrew}
    onChange={(e) => setSelectedCrew(e.target.value)}
    className="w-full px-4 py-3 border border-slate-200 rounded-xl font-bold"
  >
    <option value="">All Crews (Unassigned)</option>
    {crewMembers.map(crew => (
      <option key={crew.id} value={crew.id}>{crew.full_name}</option>
    ))}
  </select>
</div>
```

### Step 4: Filter in CrewDashboard

```tsx
// CrewDashboard.tsx - filter work orders to assigned crew
const myJobs = workOrders.filter(wo => 
  !wo.assignedCrewId || wo.assignedCrewId === session.id
);
```

### Step 5: Show Assignment on Dashboard

Add crew name badge to estimate cards in the Dashboard:

```tsx
{est.assignedCrewName && (
  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-bold">
    {est.assignedCrewName}
  </span>
)}
```

## Database Changes

```sql
-- Add columns to estimates table
ALTER TABLE estimates 
  ADD COLUMN assigned_crew_id UUID REFERENCES profiles(id),
  ADD COLUMN assigned_crew_name TEXT;
```

## Impact
- Multi-crew organizations can dispatch jobs to specific crews
- Crews only see their assigned work
- Clear accountability — "Who is doing this job?"
- Foundation for crew performance tracking

## Testing
1. Create a work order → verify crew dropdown appears with crew members
2. Assign a crew member → verify name saved on the estimate record
3. Log in as that crew member → verify they see only their assigned jobs
4. Log in as a different crew member → verify they don't see the assigned job
5. Create an unassigned work order → verify all crews can see it
