# T3-08: Role-Based Dashboard Widgets

## Priority: Polish & Delight
## Effort: Medium
## Status: Not Started
## Files Affected: `components/Dashboard.tsx`, `types.ts`

---

## Problem

All admin users see the same dashboard regardless of their subscription tier or team size. Trial users see the same complex financials view as Enterprise users. This leads to:
- Feature overwhelm for new/small users
- No upsell differentiation for paid tiers
- Missing team performance metrics for larger orgs

## Solution

### Dashboard Widget Configuration

```typescript
// types.ts
type DashboardWidget = 
  | 'pipeline_value' 
  | 'review_needed' 
  | 'inventory_health' 
  | 'financials_summary'
  | 'team_performance'
  | 'recent_activity'
  | 'job_calendar_preview'
  | 'upgrade_prompt';
  
const WIDGET_CONFIG: Record<SubscriptionPlan, DashboardWidget[]> = {
  trial: ['pipeline_value', 'review_needed', 'upgrade_prompt'],
  starter: ['pipeline_value', 'review_needed', 'inventory_health', 'financials_summary'],
  pro: ['pipeline_value', 'review_needed', 'inventory_health', 'financials_summary', 'team_performance', 'recent_activity'],
  enterprise: ['pipeline_value', 'review_needed', 'inventory_health', 'financials_summary', 'team_performance', 'recent_activity', 'job_calendar_preview'],
};
```

### Team Performance Widget (Pro+)

```tsx
const TeamPerformanceWidget: React.FC = () => {
  // Show per-crew metrics:
  // - Jobs completed this month
  // - Average labor hours per job
  // - On-time completion rate
  // - Material variance (estimated vs actual)
};
```

### Upgrade Prompt Widget (Trial)

```tsx
const UpgradeWidget: React.FC = () => (
  <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6 rounded-2xl">
    <Crown className="w-8 h-8 text-amber-400 mb-3" />
    <h3 className="font-black text-lg mb-2">Unlock Full Power</h3>
    <p className="text-slate-300 text-sm mb-4">
      Get financial reports, team management, and unlimited estimates.
    </p>
    <button className="bg-brand px-6 py-3 rounded-xl font-bold text-sm w-full">
      Upgrade Now — Starting at $49/mo
    </button>
  </div>
);
```

## Impact
- Tailored experience per subscription tier
- Cleaner UI for smaller accounts
- Built-in upsell for premium features
- Enterprise users get team insights

## Testing
1. Trial account → verify simplified dashboard with upgrade prompt
2. Starter account → verify standard dashboard without team metrics
3. Pro account → verify team performance widget appears
4. Enterprise account → verify all widgets including calendar preview
