# T4-02: QuickBooks / Xero Integration

## Priority: Future Roadmap
## Effort: Very High
## Status: Not Started
## Files Affected: New: `services/accountingIntegration.ts`, backend API routes

---

## Problem

Contractors currently manage finances in two systems — RFE Foam Pro for estimates/invoices and QuickBooks/Xero for accounting. This leads to:
- Double data entry
- Errors in revenue tracking
- Delayed bookkeeping
- No real-time profit visibility

## Solution

### Integration Approach: OAuth2 + REST API

**QuickBooks Online API:**
- OAuth 2.0 for authorization
- Invoice sync (RFE → QBO)
- Customer sync (bidirectional)
- Payment recording
- Account mapping

**Xero API:**
- Similar OAuth 2.0 flow
- Invoice, contact, and payment sync

### Sync Points

| RFE Foam Pro Event | Accounting Action |
|---------------------|-------------------|
| Invoice created | Create Invoice in QBO/Xero |
| Payment recorded | Record Payment against Invoice |
| New customer added | Create Customer/Contact |
| Customer updated | Update Customer/Contact |

### Settings UI

```tsx
// Accounting Integration Settings
<div className="space-y-4">
  <h3 className="font-black">Accounting Integration</h3>
  {!isConnected ? (
    <div className="space-y-3">
      <button onClick={connectQuickBooks} className="w-full py-3 bg-[#2CA01C] text-white rounded-xl font-bold">
        Connect QuickBooks Online
      </button>
      <button onClick={connectXero} className="w-full py-3 bg-[#13B5EA] text-white rounded-xl font-bold">
        Connect Xero
      </button>
    </div>
  ) : (
    <div>
      <div className="flex items-center gap-2 text-emerald-600 mb-4">
        <CheckCircle className="w-5 h-5" /> Connected to {provider}
      </div>
      {/* Account Mapping */}
      <h4 className="font-bold text-sm">Revenue Account</h4>
      <select>...</select>
      <h4 className="font-bold text-sm">Materials Expense Account</h4>
      <select>...</select>
    </div>
  )}
</div>
```

### Backend Architecture

```
Client → Supabase Edge Function (proxy) → QuickBooks/Xero API
         ↑
         Token refresh + storage in Supabase vault
```

Key considerations:
- OAuth tokens stored securely (Supabase Vault or encrypted column)
- Automatic token refresh
- Idempotent sync (prevent duplicate invoices)
- Error queue for failed syncs (retry with backoff)

## Impact
- Eliminates double data entry
- Real-time bookkeeping
- Professional financial management
- Tax-ready records at all times
- Huge competitive differentiator for SaaS

## Complexity Notes
- QuickBooks Developer account + app review required
- Xero partner program enrollment
- Need robust error handling for API rate limits
- Consider Tier 2+ subscription gating (premium feature)
- May need backend webhook endpoint for QBO callbacks
