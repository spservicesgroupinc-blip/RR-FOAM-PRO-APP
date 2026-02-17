# T1-04: Email Invoice/Estimate to Customers

## Priority: High Impact
## Effort: Medium-High
## Status: Not Started
## Files Affected: `components/EstimateStage.tsx`, `components/InvoiceStage.tsx`, `utils/pdfGenerator.ts`, New Supabase Edge Function

---

## Problem

Currently, PDFs (estimates, invoices, work orders) are only generated and downloaded locally. There's no way to email them directly to customers. Users must download the PDF, open their email client, attach it, and send manually.

## Solution

### Option A: Supabase Edge Function with Resend/SendGrid

```typescript
// supabase/functions/send-document-email/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

serve(async (req) => {
  const { to, subject, customerName, documentType, pdfBase64, companyName } = await req.json();
  
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `${companyName} <noreply@yourdomain.com>`,
      to: [to],
      subject,
      html: `
        <h2>Hi ${customerName},</h2>
        <p>Please find your ${documentType} attached.</p>
        <p>Thank you for choosing ${companyName}!</p>
      `,
      attachments: [{
        filename: `${documentType}.pdf`,
        content: pdfBase64,
      }],
    }),
  });
  
  return new Response(JSON.stringify({ success: true }), { status: 200 });
});
```

### Option B: Store PDF in Supabase Storage + Send Link

Instead of attaching the PDF, upload it to Supabase storage (already happening via `documentService.ts`) and email a download link:

```typescript
const emailDocumentLink = async (
  customerEmail: string,
  customerName: string,
  documentUrl: string,
  documentType: string,
  companyName: string
) => {
  const { error } = await supabase.functions.invoke('send-document-email', {
    body: {
      to: customerEmail,
      customerName,
      documentUrl,
      documentType,
      companyName,
    },
  });
  if (error) throw error;
};
```

### Step 3: Add "Send to Customer" Button

```tsx
// In EstimateStage.tsx and InvoiceStage.tsx
<button
  onClick={handleEmailToCustomer}
  disabled={!state.customerProfile.email}
  className="flex items-center gap-2 px-6 py-3 bg-sky-600 text-white rounded-xl font-bold hover:bg-sky-700 disabled:opacity-50"
>
  <Mail className="w-4 h-4" />
  Send to Customer
</button>

{!state.customerProfile.email && (
  <p className="text-xs text-amber-600 mt-1">Add customer email to enable sending</p>
)}
```

### Step 4: Email Tracking

```sql
-- Track sent emails
CREATE TABLE document_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  estimate_id UUID REFERENCES estimates(id),
  document_id UUID REFERENCES documents(id),
  recipient_email TEXT NOT NULL,
  document_type TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT now(),
  status TEXT DEFAULT 'sent'
);
```

## Implementation Notes
- Use Resend (simple API, generous free tier) or SendGrid
- Store API key as Supabase secret: `supabase secrets set RESEND_API_KEY=...`
- Option B (link) is simpler and avoids email attachment size limits
- Add email log to customer detail view for audit trail

## Impact
- Dramatically speeds up the estimate-to-close workflow
- Professional customer experience
- Trackable — know when documents were sent
- Removes friction from the most common post-estimate action

## Testing
1. Create an estimate for a customer with an email address
2. Generate the estimate → click "Send to Customer"
3. Verify customer receives email with PDF attachment or link
4. Check email log on customer detail page
5. Test with no customer email → verify button is disabled with helpful message
6. Test error handling (invalid email, edge function failure)
