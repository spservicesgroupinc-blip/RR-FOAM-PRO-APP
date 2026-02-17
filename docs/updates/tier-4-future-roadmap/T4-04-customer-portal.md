# T4-04: Customer Portal

## Priority: Future Roadmap
## Effort: High
## Status: Not Started
## Files Affected: New: `components/CustomerPortal.tsx`, Supabase Edge Functions, new routes

---

## Problem

Customers currently receive PDFs via email or manual hand-delivery. They can't:
- View their estimate history online
- Approve or sign estimates digitally
- Track job progress in real-time
- Make online payments
- Request new quotes

## Solution

### Token-Based Read-Only Portal

Generate a unique, expiring link per customer. No account/password required.

```typescript
// services/customerPortalService.ts
export const generatePortalLink = async (customerId: string, organizationId: string) => {
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
  
  await supabase.from('portal_tokens').insert({
    token,
    customer_id: customerId,
    organization_id: organizationId,
    expires_at: expiresAt.toISOString(),
  });
  
  return `${window.location.origin}/portal/${token}`;
};
```

### Portal Features

1. **Estimate Review** — Customer sees their estimates with full line-item detail
2. **Digital Approval** — "Approve" button with e-signature capture (canvas-based)
3. **Job Progress** — Real-time status: Draft → Approved → Scheduled → In Progress → Complete
4. **Invoice View** — See invoices and payment status
5. **Online Payment** — Stripe Checkout link or payment request
6. **Quote Request** — Simple form to request a new estimate

### Customer Portal UI

```tsx
export const CustomerPortal: React.FC<{ token: string }> = ({ token }) => {
  // Fetch customer data via Supabase Edge Function (validates token)
  // Show clean, branded read-only view
  
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b p-6">
        <img src={companyLogo} alt="" className="h-12" />
        <h1 className="font-black text-xl mt-2">Welcome, {customer.name}</h1>
      </header>
      
      <main className="max-w-2xl mx-auto p-6 space-y-6">
        {/* Active Estimates */}
        {estimates.filter(e => e.status !== 'Complete').map(est => (
          <EstimateCard key={est.id} estimate={est} onApprove={handleApprove} />
        ))}
        
        {/* Invoices */}
        <InvoiceSection invoices={invoices} onPayNow={handlePayment} />
        
        {/* Request New Quote */}
        <QuoteRequestForm onSubmit={handleQuoteRequest} />
      </main>
    </div>
  );
};
```

### E-Signature Capture

```tsx
// Canvas-based signature pad
<canvas ref={sigCanvasRef} width={400} height={150} 
  onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing}
  className="border-2 border-dashed border-slate-300 rounded-xl" />
<div className="flex gap-2 mt-2">
  <button onClick={clearSignature} className="text-sm text-slate-500">Clear</button>
  <button onClick={submitApproval} className="bg-brand text-white px-6 py-2 rounded-xl font-bold">
    Sign & Approve
  </button>
</div>
```

## Impact
- Professional customer experience
- Faster estimate approvals (no email back-and-forth)
- Online payment collection
- Reduced admin communication overhead
- Competitive advantage — most contractors don't offer this

## Complexity Notes
- Security: Token expiration, rate limiting, RLS policies
- Payment integration: Stripe Connect for contractor payouts
- E-signature legal compliance (ESIGN Act / UETA)
- Custom branding per organization
- Mobile-responsive portal
