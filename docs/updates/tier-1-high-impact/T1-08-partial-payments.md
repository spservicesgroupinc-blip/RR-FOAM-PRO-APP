# T1-08: Partial Payments & Payment Method Tracking

## Priority: High Impact
## Effort: Medium
## Status: Not Started
## Files Affected: `types.ts`, `components/InvoiceStage.tsx`, `components/Dashboard.tsx`, `hooks/useEstimates.ts`

---

## Problem

The app only supports "Mark as Paid in Full" — a binary toggle from Invoiced → Paid. Real-world spray foam contracting often involves:

- **Partial payments** (50% deposit, balance on completion)
- **Multiple payment methods** (check for deposit, card for balance)
- **Payment tracking** (which check number, which card, what date)

## Solution

### Step 1: Extend Data Model

```typescript
// types.ts
export interface PaymentRecord {
  id: string;
  date: string;
  amount: number;
  method: 'cash' | 'check' | 'card' | 'ach' | 'financing' | 'other';
  reference?: string; // Check #, last 4 card digits, etc.
  notes?: string;
}

export interface EstimateRecord {
  // ... existing fields
  payments?: PaymentRecord[];
  amountPaid?: number;
  balanceDue?: number;
}
```

### Step 2: Payment Recording UI

```tsx
// components/PaymentModal.tsx
export const PaymentModal: React.FC<{
  isOpen: boolean;
  totalDue: number;
  existingPayments: PaymentRecord[];
  onRecordPayment: (payment: PaymentRecord) => void;
  onClose: () => void;
}> = ({ isOpen, totalDue, existingPayments, onRecordPayment, onClose }) => {
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState<PaymentRecord['method']>('check');
  const [reference, setReference] = useState('');

  const totalPaid = existingPayments.reduce((sum, p) => sum + p.amount, 0);
  const remaining = totalDue - totalPaid;

  return (
    // Modal with:
    // - Payment amount input (pre-filled with remaining balance)
    // - Payment method dropdown (Cash, Check, Card, ACH, Financing)
    // - Reference field (Check #, last 4 digits, etc.)
    // - Payment history list showing previous payments
    // - Remaining balance display
    // - "Record Payment" button
    // - "Pay in Full" quick button
  );
};
```

### Step 3: Dashboard Status Updates

Replace binary Paid/Unpaid with:

```tsx
const getPaymentStatus = (record: EstimateRecord) => {
  if (!record.payments?.length) return { label: 'Unpaid', color: 'red' };
  const paid = record.payments.reduce((s, p) => s + p.amount, 0);
  const total = record.totalValue;
  if (paid >= total) return { label: 'Paid', color: 'emerald' };
  return { label: `Partial ($${paid.toLocaleString()})`, color: 'amber' };
};
```

### Step 4: Payment History on Invoice

```tsx
// In InvoiceStage or EstimateDetail
{record.payments?.length > 0 && (
  <div className="border-t pt-4 mt-4">
    <h4 className="font-black text-xs uppercase tracking-widest text-slate-400 mb-3">Payment History</h4>
    {record.payments.map(p => (
      <div key={p.id} className="flex justify-between items-center py-2 border-b border-slate-50">
        <span className="text-sm">{new Date(p.date).toLocaleDateString()} — {p.method} {p.reference && `(${p.reference})`}</span>
        <span className="font-bold text-emerald-600">${p.amount.toLocaleString()}</span>
      </div>
    ))}
    <div className="flex justify-between pt-2 font-black">
      <span>Balance Due</span>
      <span className="text-red-600">${(record.totalValue - (record.amountPaid || 0)).toLocaleString()}</span>
    </div>
  </div>
)}
```

## Database Changes

```sql
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id UUID REFERENCES estimates(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id),
  amount DECIMAL(10,2) NOT NULL,
  method TEXT NOT NULL,
  reference TEXT,
  notes TEXT,
  recorded_at TIMESTAMPTZ DEFAULT now(),
  recorded_by UUID REFERENCES profiles(id)
);
```

## Impact
- Supports real-world payment workflows (deposits, installments)
- Payment method tracking for bookkeeping
- Balance due visibility prevents over/under-collection
- Payment history provides audit trail

## Testing
1. Create an invoice for $5,000
2. Record a partial payment of $2,500 (check)
3. Verify dashboard shows "Partial ($2,500)"
4. Record remaining $2,500 (card)
5. Verify status changes to "Paid"
6. View payment history — verify both entries show correctly
7. Check financial statistics correctly aggregate partial payments
