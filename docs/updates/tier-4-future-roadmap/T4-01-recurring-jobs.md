# T4-01: Recurring Jobs & Maintenance Contracts

## Priority: Future Roadmap
## Effort: High
## Status: Not Started
## Files Affected: New: `components/RecurringJobs.tsx`, `types.ts`, DB schema additions

---

## Problem

Spray foam contractors often have repeat customers — commercial buildings needing annual inspections, property management companies with multiple units, or maintenance contracts. Currently, each job must be manually created from scratch.

## Solution

### Data Model

```typescript
export interface RecurringSchedule {
  id: string;
  organizationId: string;
  customerId: string;
  templateEstimateId: string; // Base estimate to clone
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'semi_annual' | 'annual';
  startDate: string;
  endDate?: string; // null = indefinite
  nextDue: string;
  autoCreate: boolean; // Auto-generate estimate X days before due
  leadDays: number; // Days before due to create estimate (default: 7)
  notes: string;
  isActive: boolean;
  createdAt: string;
}
```

### Features
1. **Schedule Manager** — Create recurring schedules from any completed estimate
2. **Auto-Generate** — X days before the next due date, auto-create a new estimate from the template
3. **Calendar Integration** — Show upcoming recurring jobs on the calendar view (T2-02)
4. **Contract Value Tracking** — Annual contract value calculation and forecasting
5. **Dashboard Widget** — "Upcoming recurring jobs" section with countdown

### Workflow
1. Admin completes a job → option: "Make this recurring"
2. Select frequency, start date, lead days
3. System auto-creates new estimates before each due date
4. Admin reviews, adjusts pricing if needed, assigns crew
5. Normal estimate → work order → invoice flow

### Revenue Forecasting

```tsx
const annualContractValue = recurringSchedules.reduce((sum, schedule) => {
  const estimate = estimates.find(e => e.id === schedule.templateEstimateId);
  const annualMultiplier = { weekly: 52, biweekly: 26, monthly: 12, quarterly: 4, semi_annual: 2, annual: 1 };
  return sum + (estimate?.totalPrice || 0) * annualMultiplier[schedule.frequency];
}, 0);
```

## Impact
- Predictable recurring revenue tracking
- Reduced admin work for repeat customers
- Never miss a scheduled job
- Professional contract management

## Complexity Notes
- Requires background job/scheduled function (Supabase Edge Function or cron)
- Need to handle price adjustments between recurring instances
- Should integrate with push notifications (T2-03) for reminders
