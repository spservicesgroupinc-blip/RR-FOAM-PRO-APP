# T4-06: Subcontractor Management

## Priority: Future Roadmap
## Effort: High
## Status: Not Started
## Files Affected: New: `components/Subcontractors.tsx`, `types.ts`, DB schema additions

---

## Problem

Larger spray foam operations hire subcontractors for overflow work. Currently:
- No way to track subcontractor assignments
- No visibility into subcontractor costs vs revenue earned
- No subcontractor payment tracking
- No subcontractor compliance tracking (insurance, certifications)

## Solution

### Data Model

```typescript
export interface Subcontractor {
  id: string;
  organizationId: string;
  name: string;
  companyName?: string;
  phone: string;
  email: string;
  specialties: ('open_cell' | 'closed_cell' | 'roofing' | 'commercial' | 'residential')[];
  rate: number; // per sqft or per job
  rateType: 'per_sqft' | 'per_job' | 'hourly';
  insuranceExpiry?: string;
  licenseNumber?: string;
  certifications?: string[];
  notes?: string;
  isActive: boolean;
  createdAt: string;
}

export interface SubcontractorAssignment {
  id: string;
  subcontractorId: string;
  estimateId: string;
  agreedRate: number;
  rateType: string;
  status: 'assigned' | 'accepted' | 'in_progress' | 'completed' | 'invoiced' | 'paid';
  completedAt?: string;
  paymentAmount?: number;
  paymentDate?: string;
  notes?: string;
}
```

### Features

1. **Subcontractor Registry** — Add/manage subcontractor profiles
2. **Job Assignment** — Assign a subcontractor to an estimate/workorder instead of crew
3. **Cost Tracking** — Track subcontractor cost vs job revenue (margin analysis)
4. **Payment Management** — Record payments to subcontractors
5. **Compliance Dashboard** — Track insurance expirations, certifications
6. **Sub Portal** — (Extension of T4-04) Subcontractors can view assigned jobs

### Margin Analysis

```tsx
const SubcontractorMarginCard: React.FC = ({ assignment, estimate }) => {
  const revenue = estimate.totalPrice;
  const subCost = assignment.agreedRate * (assignment.rateType === 'per_sqft' ? estimate.totalArea : 1);
  const materialCost = estimate.materialCost;
  const margin = revenue - subCost - materialCost;
  const marginPct = (margin / revenue * 100).toFixed(1);
  
  return (
    <div className="p-4 bg-white rounded-2xl border">
      <div className="text-sm text-slate-500">Sub Job Margin</div>
      <div className={`text-2xl font-black ${margin > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
        ${margin.toLocaleString()} ({marginPct}%)
      </div>
      <div className="text-xs text-slate-400 mt-1">
        Revenue: ${revenue} | Sub: ${subCost} | Materials: ${materialCost}
      </div>
    </div>
  );
};
```

### Insurance Expiration Alerts

```tsx
const expiringInsurance = subcontractors.filter(s => {
  if (!s.insuranceExpiry) return false;
  const daysUntilExpiry = Math.ceil((new Date(s.insuranceExpiry) - Date.now()) / 86400000);
  return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
});

// Show alert on dashboard when sub insurance is expiring within 30 days
```

## Impact
- Professional subcontractor management
- Accurate job profitability with sub costs included
- Compliance risk reduction (insurance tracking)
- Scalable operations (more jobs without more employees)
- Clear payment history and reconciliation

## Complexity Notes
- Subcontractor payment flows (separate from customer payments)
- 1099 tax reporting considerations
- Consider integration with T4-02 (QuickBooks) for sub payments
- Access control — subs should only see their assigned jobs
- Enterprise-tier feature
