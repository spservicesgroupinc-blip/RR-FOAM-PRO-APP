# T3-03: Print-Optimized CSS

## Priority: Polish & Delight
## Effort: Low
## Status: Not Started
## Files Affected: `src/index.css`, `components/EstimateDetail.tsx`, `components/InvoiceStage.tsx`

---

## Problem

When users try to print an estimate or invoice directly from the browser (Ctrl+P), the output includes navigation, sidebars, and action buttons. The jsPDF generation works, but direct browser print is a faster workflow for quick hard copies.

## Solution

### Add Print Media Styles

```css
/* src/index.css */
@media print {
  /* Hide all navigation and UI chrome */
  aside,
  nav,
  .md\\:hidden,
  [class*="bottom-nav"],
  [class*="fixed"],
  button,
  .no-print {
    display: none !important;
  }

  /* Reset layout */
  main {
    padding: 0 !important;
    margin: 0 !important;
  }

  body {
    background: white !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* Optimize content width */
  .print-content {
    max-width: 100% !important;
    margin: 0 !important;
    padding: 20px !important;
  }

  /* Show print-only elements */
  .print-only {
    display: block !important;
  }

  /* Page break controls */
  .page-break-before {
    page-break-before: always;
  }

  .no-page-break {
    page-break-inside: avoid;
  }

  /* Improve readability */
  * {
    color: black !important;
    background: white !important;
    border-color: #e2e8f0 !important;
    box-shadow: none !important;
  }
}
```

### Print-Specific Header

```tsx
// Add to EstimateDetail / InvoiceStage
<div className="hidden print-only">
  <div className="flex justify-between items-start mb-8 pb-4 border-b-2">
    <div>
      <h1 className="text-2xl font-black">{state.companyProfile.companyName}</h1>
      <p className="text-sm">{state.companyProfile.addressLine1}</p>
      <p className="text-sm">{state.companyProfile.phone} | {state.companyProfile.email}</p>
    </div>
    <div className="text-right">
      <h2 className="text-xl font-black">ESTIMATE</h2>
      <p>Date: {record.date}</p>
      <p>#{record.id.substring(0, 8).toUpperCase()}</p>
    </div>
  </div>
</div>
```

### Quick Print Button

```tsx
<button onClick={() => window.print()} className="no-print px-4 py-2 border rounded-xl text-sm font-bold">
  <Printer className="w-4 h-4 mr-1.5 inline" /> Quick Print
</button>
```

## Impact
- Instant hard copies without PDF generation wait
- Works without internet (no Supabase storage needed)
- Professional printout directly from browser
- Useful for on-the-spot printing at customer meetings

## Testing
1. Open an estimate detail → press Ctrl+P → verify clean output
2. Verify sidebar and nav are hidden
3. Verify company header appears in print
4. Verify colors and borders print correctly
5. Test multi-page documents → verify page breaks
