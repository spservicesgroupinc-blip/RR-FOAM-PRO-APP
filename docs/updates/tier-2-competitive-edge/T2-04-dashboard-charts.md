# T2-04: Dashboard Charts & Analytics

## Priority: Medium Impact — Competitive Edge
## Effort: Medium
## Status: Not Started
## Files Affected: `components/Dashboard.tsx`, `package.json`, New: `components/charts/`

---

## Problem

The Dashboard's "Financials" tab shows only raw numbers (total revenue, COGS, margin, etc.) in text cards. There are no visual charts showing trends, comparisons, or breakdowns — making it hard to spot patterns like seasonal demand, margin erosion, or material usage spikes.

## Solution

### Library Choice

Use **recharts** (lightweight, React-native, no D3 dependency):

```bash
npm install recharts
```

### Charts to Add

#### 1. Revenue & Profit Trend (Line Chart)
Monthly revenue and net profit over the last 12 months:

```tsx
const monthlyData = useMemo(() => {
  const months = {};
  state.savedEstimates
    .filter(e => ['Work Order', 'Invoiced', 'Paid'].includes(e.status))
    .forEach(est => {
      const month = est.date?.substring(0, 7); // YYYY-MM
      if (!months[month]) months[month] = { revenue: 0, cost: 0, profit: 0 };
      months[month].revenue += est.totalValue || 0;
      months[month].cost += est.results?.totalCost || 0;
      months[month].profit += (est.totalValue || 0) - (est.results?.totalCost || 0);
    });
  return Object.entries(months).sort().slice(-12).map(([month, data]) => ({
    month: new Date(month + '-01').toLocaleDateString('en', { month: 'short' }),
    ...data,
  }));
}, [state.savedEstimates]);

<LineChart data={monthlyData}>
  <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} />
  <Line type="monotone" dataKey="profit" stroke="#3b82f6" strokeWidth={2} />
  <CartesianGrid strokeDasharray="3 3" />
  <XAxis dataKey="month" />
  <YAxis />
  <Tooltip />
</LineChart>
```

#### 2. Cost Breakdown (Pie Chart)
Chemical vs. labor vs. misc cost distribution:

```tsx
<PieChart>
  <Pie data={[
    { name: 'Chemicals', value: financialStats.chemCost, fill: '#ef4444' },
    { name: 'Labor', value: financialStats.laborCost, fill: '#3b82f6' },
    { name: 'Other', value: financialStats.otherCost, fill: '#f59e0b' },
  ]} />
  <Tooltip />
  <Legend />
</PieChart>
```

#### 3. Job Volume (Bar Chart)
Jobs per month by status:

```tsx
<BarChart data={monthlyJobCounts}>
  <Bar dataKey="completed" fill="#10b981" />
  <Bar dataKey="inProgress" fill="#f59e0b" />
  <Bar dataKey="draft" fill="#94a3b8" />
</BarChart>
```

#### 4. Material Usage Over Time (Area Chart)
Open cell vs. closed cell sets consumed per month:

```tsx
<AreaChart data={materialUsageByMonth}>
  <Area dataKey="openCell" fill="#8b5cf6" fillOpacity={0.3} stroke="#8b5cf6" />
  <Area dataKey="closedCell" fill="#ef4444" fillOpacity={0.3} stroke="#ef4444" />
</AreaChart>
```

### Dashboard Layout

Add a "Analytics" tab alongside existing "Overview" and "Financials" tabs:

```tsx
<TabButton id="analytics" label="Analytics" icon={BarChart3} />
```

## Responsive Design
- Desktop: 2-column chart grid
- Mobile: Single column, scrollable
- Charts resize with container (ResponsiveContainer)

## Impact
- Visual pattern recognition (seasonal trends, margin changes)
- Impressive to customers during presentations
- Data-driven decision making
- Competitive feature — most field service tools lack good analytics

## Testing
1. View Analytics tab with 10+ estimates → verify charts render
2. Resize window → verify charts are responsive
3. Filter by date range → verify charts update
4. Test with empty data → verify graceful empty states
5. Test on mobile → verify charts are scrollable and readable
