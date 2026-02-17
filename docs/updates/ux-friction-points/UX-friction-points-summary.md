# UX Friction Points Analysis

## App: RFE Foam Pro — Enterprise Spray Foam Estimation & Rig Management Suite
## Date: Analysis Report
## Status: Reference Document

---

## Overview

This document catalogs all user experience friction points identified in the current codebase. Each friction point includes the affected component, severity, and a brief description of the issue and recommended fix.

---

## FP-01: Hash-Based Navigation Without Browser History

**Severity:** High  
**Affected Files:** `SprayFoamCalculator.tsx`, `context/CalculatorContext.tsx`  
**User Impact:** Back button doesn't work, no deep links, no URL-based sharing

### Issue
All 15 views are managed via `state.currentView` in React Context. The URL never changes — always `/`. Users cannot:
- Press Back to return to previous view
- Bookmark or share a specific view
- Use browser Forward/Back gestures on mobile

### Recommendation
Implement React Router or a hash-based routing system. See [T1-01](../tier-1-high-impact/T1-01-client-side-routing.md).

---

## FP-02: No Loading States or Skeleton Screens

**Severity:** Medium  
**Affected Files:** `Dashboard.tsx`, `Customers.tsx`, `Warehouse.tsx`

### Issue
When data is loading from Supabase, components either show empty states or flash content. There are no skeleton loaders, spinners (except the full-page spinner in SprayFoamCalculator), or shimmer effects during data fetch.

### Recommendation
- Add skeleton screens for list views (estimates, customers, inventory)
- Show inline loading spinners for individual card updates
- Use React Suspense boundaries where applicable

---

## FP-03: Toast Notifications Disappear Too Quickly

**Severity:** Medium  
**Affected Files:** `components/Layout.tsx`

### Issue
All toast notifications (success AND error) auto-dismiss after 2 seconds (`setTimeout(() => setShowToast(false), 2000)`). Error messages need more time to read, especially on mobile where the toast may be partially obscured.

### Recommendation
- Success toasts: 2-3 seconds (current)
- Error toasts: 5-8 seconds
- Add manual dismiss button (X)
- Consider stacking multiple toasts

See [BF-04](../bug-fixes/BF-04-error-notification-timing.md).

---

## FP-04: Calculator Form is a Single Long Page

**Severity:** Medium  
**Affected Files:** `components/Calculator.tsx`

### Issue
The calculator (761 lines) presents all fields on a single scrollable page with a step indicator at top. While there's a visual stepper (Job Info → Foam Settings → Pricing → Summary), all sections are always visible. On mobile, this requires extensive scrolling.

### Recommendation
- True multi-step wizard: show only the active step
- Add Previous/Next buttons between steps
- Validate each step before advancing
- Show progress indicator

---

## FP-05: No Confirmation Before Destructive Actions

**Severity:** High  
**Affected Files:** `SprayFoamCalculator.tsx`, `Customers.tsx`, `Warehouse.tsx`

### Issue
The app uses `window.confirm()` for destructive actions (deleting estimates, removing customers), which:
- Looks unprofessional (browser-native dialog)
- Breaks the PWA immersive feel
- Doesn't match the app's design language
- Can't be styled or customized

### Recommendation
Custom confirmation modal component. See [T1-06](../tier-1-high-impact/T1-06-custom-confirmation-modals.md).

---

## FP-06: Crew Session Key Mismatch

**Severity:** High  
**Affected Files:** `services/auth.ts`, `components/CrewDashboard.tsx`

### Issue
`auth.ts` stores crew session under key `foamProCrewSession` but some components may look for `foamProSession`. This can cause:
- Crew appearing logged out after refresh
- Session not properly restored
- Incorrect user type detection

### Recommendation
Standardize all session key references to a single constant. See [BF-02](../bug-fixes/BF-02-crew-session-key.md).

---

## FP-07: Mobile Bottom Nav Overlap with Content

**Severity:** Low  
**Affected Files:** `components/Layout.tsx`

### Issue
The mobile bottom nav is fixed at the bottom with padding applied to the main content area. However, some components (especially modals and long lists) don't properly account for this, causing the last items to be hidden behind the nav bar.

### Recommendation
- Add `pb-24` (padding-bottom: 6rem) to all scrollable content containers
- Use `env(safe-area-inset-bottom)` for iOS home indicator
- Test all views on various mobile screen sizes

---

## FP-08: No Empty State Illustrations

**Severity:** Low  
**Affected Files:** `Dashboard.tsx`, `Customers.tsx`, `Warehouse.tsx`

### Issue
When there are no estimates, customers, or warehouse items, the views show minimal text ("No estimates found"). This is a missed opportunity to guide users toward taking action.

### Recommendation
- Add illustrated empty states with call-to-action buttons
- Example: Empty customers list → illustration + "Add your first customer" button
- Use the onboarding checklist (T3-07) to complement this

---

## Priority Summary

| ID | Friction Point | Severity | Related Fix |
|----|----------------|----------|-------------|
| FP-01 | No browser history/routing | High | T1-01 |
| FP-02 | No loading/skeleton states | Medium | — |
| FP-03 | Toast auto-dismiss too fast | Medium | BF-04 |
| FP-04 | Calculator single-page form | Medium | — |
| FP-05 | Browser-native confirm dialogs | High | T1-06 |
| FP-06 | Crew session key mismatch | High | BF-02 |
| FP-07 | Mobile nav content overlap | Low | — |
| FP-08 | Missing empty state illustrations | Low | T3-07 |
