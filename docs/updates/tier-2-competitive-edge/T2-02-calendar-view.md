# T2-02: Calendar View for Job Scheduling

## Priority: Medium Impact — Competitive Edge
## Effort: Medium
## Status: Not Started
## Files Affected: New: `components/CalendarView.tsx`, `components/Dashboard.tsx`, `components/Layout.tsx`

---

## Problem

Scheduled work orders only show as dates in list format. There's no visual calendar showing when jobs are scheduled, which days are busy, and which have openings. Contractors need to see their week/month at a glance to schedule effectively.

## Solution

### Calendar Component

Build a month-view calendar displaying scheduled work orders as event blocks:

```tsx
// components/CalendarView.tsx
export const CalendarView: React.FC<{
  estimates: EstimateRecord[];
  onSelectDate: (date: string) => void;
  onSelectJob: (job: EstimateRecord) => void;
}> = ({ estimates, onSelectDate, onSelectJob }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  // Group jobs by date
  const jobsByDate = useMemo(() => {
    const map = new Map<string, EstimateRecord[]>();
    estimates.forEach(est => {
      if (est.scheduledDate) {
        const key = est.scheduledDate; // YYYY-MM-DD
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(est);
      }
    });
    return map;
  }, [estimates]);

  // Render calendar grid (7 cols × 5-6 rows)
  // Each day cell shows:
  //   - Day number
  //   - Color-coded job dots/cards
  //   - Click to expand day detail
};
```

### Color Coding
- **Amber** — Work orders (Not Started)
- **Blue** — Work orders (In Progress)
- **Green** — Completed jobs
- **Red** — Overdue (past scheduled date, not completed)

### Features
- Month navigation (prev/next arrows)
- Click a day → see full job details for that day
- Click a job → open estimate detail
- "Today" indicator
- Job count badges per day
- Optional: Week view for more detail

### Navigation Integration

Add "Calendar" as a new view option:

```tsx
// Layout.tsx sidebar
<NavButton target="calendar" icon={CalendarDays} label="Schedule" />
```

## Impact
- Visual overview of crew capacity and availability
- Prevents double-booking or overloading a single day
- Quick identification of scheduling gaps
- Professional look when reviewing schedule with customers

## Testing
1. Navigate to Calendar view → verify current month displays
2. Create work orders with various dates → verify they appear on correct days
3. Click a day with jobs → verify job details expand
4. Click a job → verify navigation to estimate detail
5. Navigate months → verify correct month displays
6. Verify "today" is highlighted
