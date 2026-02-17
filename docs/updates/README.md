# RFE Foam Pro — Improvement Roadmap Index

## Overview

This directory contains detailed reference files for every proposed improvement to the RFE Foam Pro app, organized by priority tier. Each file includes the problem statement, proposed solution with code examples, affected files, effort estimate, and testing criteria.

---

## Quick Stats

| Category | Count | Status |
|----------|-------|--------|
| Bug Fixes | 6 | Ready to implement |
| Tier 1 — High Impact | 8 | Ready to implement |
| Tier 2 — Competitive Edge | 8 | Ready to implement |
| Tier 3 — Polish & Delight | 8 | Ready to implement |
| Tier 4 — Future Roadmap | 6 | Requires planning |
| UX Friction Points | 8 | Documented |
| **Total** | **44** | |

---

## Bug Fixes (Critical — Fix First)

| ID | Title | Effort | File |
|----|-------|--------|------|
| BF-01 | [Processing spinner never resets](bug-fixes/BF-01-processing-state-reset.md) | Low | `WorkOrderStage.tsx` |
| BF-02 | [Crew session key mismatch](bug-fixes/BF-02-crew-session-key.md) | Low | `auth.ts` |
| BF-03 | [Invoice inventory lines default $0](bug-fixes/BF-03-invoice-inventory-cost.md) | Low | `InvoiceStage.tsx` |
| BF-04 | [Error notifications dismiss too fast](bug-fixes/BF-04-error-notification-timing.md) | Low | `Layout.tsx` |
| BF-05 | [Labor rate not configurable](bug-fixes/BF-05-labor-rate-settings.md) | Low | `Settings.tsx` |
| BF-06 | [No warehouse quantity validation](bug-fixes/BF-06-warehouse-quantity-validation.md) | Low | `Warehouse.tsx` |

---

## Tier 1 — High Impact Features

| ID | Title | Effort | File |
|----|-------|--------|------|
| T1-01 | [Client-side routing](tier-1-high-impact/T1-01-client-side-routing.md) | Medium | New router setup |
| T1-02 | [Forgot password flow](tier-1-high-impact/T1-02-forgot-password.md) | Low | `LoginPage.tsx` |
| T1-03 | [Crew assignment per job](tier-1-high-impact/T1-03-crew-assignment.md) | Medium | `EstimateStage.tsx` |
| T1-04 | [Email documents directly](tier-1-high-impact/T1-04-email-documents.md) | Medium | Edge Functions |
| T1-05 | [Offline mutation queue](tier-1-high-impact/T1-05-offline-queue.md) | High | `sw.js`, new service |
| T1-06 | [Custom confirmation modals](tier-1-high-impact/T1-06-custom-confirmation-modals.md) | Low | New component |
| T1-07 | [Global search & filter](tier-1-high-impact/T1-07-search-and-filter.md) | Medium | `Dashboard.tsx` |
| T1-08 | [Partial payment tracking](tier-1-high-impact/T1-08-partial-payments.md) | Medium | `InvoiceStage.tsx` |

---

## Tier 2 — Competitive Edge Features

| ID | Title | Effort | File |
|----|-------|--------|------|
| T2-01 | [Photo attachments](tier-2-competitive-edge/T2-01-photo-attachments.md) | Medium | New component |
| T2-02 | [Calendar view](tier-2-competitive-edge/T2-02-calendar-view.md) | Medium | New component |
| T2-03 | [Push notifications](tier-2-competitive-edge/T2-03-push-notifications.md) | High | `sw.js`, new service |
| T2-04 | [Dashboard charts](tier-2-competitive-edge/T2-04-dashboard-charts.md) | Medium | `Dashboard.tsx` |
| T2-05 | [Estimate templates](tier-2-competitive-edge/T2-05-estimate-templates.md) | Medium | `Calculator.tsx` |
| T2-06 | [Customer communication log](tier-2-competitive-edge/T2-06-customer-communication-log.md) | Medium | `Customers.tsx` |
| T2-07 | [Duplicate estimate](tier-2-competitive-edge/T2-07-duplicate-estimate.md) | Low | `Dashboard.tsx` |
| T2-08 | [Bulk actions](tier-2-competitive-edge/T2-08-bulk-actions.md) | Medium | `Dashboard.tsx` |

---

## Tier 3 — Polish & Delight

| ID | Title | Effort | File |
|----|-------|--------|------|
| T3-01 | [Dark mode](tier-3-polish/T3-01-dark-mode.md) | Medium | All components |
| T3-02 | [Keyboard shortcuts](tier-3-polish/T3-02-keyboard-shortcuts.md) | Low | New hook |
| T3-03 | [Print-optimized CSS](tier-3-polish/T3-03-print-optimized-css.md) | Low | `index.css` |
| T3-04 | [Activity feed / audit log](tier-3-polish/T3-04-activity-audit-log.md) | Medium | New component, DB |
| T3-05 | [Reorder points & alerts](tier-3-polish/T3-05-reorder-points.md) | Medium | `Warehouse.tsx` |
| T3-06 | [Multi-language (i18n)](tier-3-polish/T3-06-multi-language.md) | High | All components |
| T3-07 | [Onboarding checklist](tier-3-polish/T3-07-onboarding-checklist.md) | Medium | New component |
| T3-08 | [Role-based dashboard widgets](tier-3-polish/T3-08-role-based-widgets.md) | Medium | `Dashboard.tsx` |

---

## Tier 4 — Future Roadmap

| ID | Title | Effort | File |
|----|-------|--------|------|
| T4-01 | [Recurring jobs & contracts](tier-4-future-roadmap/T4-01-recurring-jobs.md) | High | New component, DB |
| T4-02 | [QuickBooks / Xero integration](tier-4-future-roadmap/T4-02-quickbooks-integration.md) | Very High | Backend, OAuth |
| T4-03 | [GPS fleet tracking](tier-4-future-roadmap/T4-03-gps-fleet-tracking.md) | Very High | New component |
| T4-04 | [Customer portal](tier-4-future-roadmap/T4-04-customer-portal.md) | High | New routes |
| T4-05 | [AI estimate assistant](tier-4-future-roadmap/T4-05-ai-estimate-assistant.md) | Very High | New service |
| T4-06 | [Subcontractor management](tier-4-future-roadmap/T4-06-subcontractor-management.md) | High | New component |

---

## UX Friction Points

See [UX Friction Points Summary](ux-friction-points/UX-friction-points-summary.md) for 8 documented friction points with severity ratings and cross-references to relevant fixes.

---

## Recommended Implementation Order

### Phase 1: Foundation (Week 1-2)
1. All 6 bug fixes (BF-01 through BF-06)
2. T1-06: Custom confirmation modals
3. T1-02: Forgot password flow
4. T2-07: Duplicate estimate

### Phase 2: Core UX (Week 3-4)
5. T1-01: Client-side routing
6. T1-07: Global search & filter
7. T1-08: Partial payment tracking
8. T1-03: Crew assignment per job

### Phase 3: Competitive Features (Week 5-8)
9. T1-04: Email documents
10. T2-01: Photo attachments
11. T2-04: Dashboard charts
12. T2-05: Estimate templates
13. T2-02: Calendar view

### Phase 4: Advanced (Month 3+)
14. T1-05: Offline mutation queue
15. T2-03: Push notifications
16. T3-01: Dark mode
17. T3-04: Activity log
18. T3-07: Onboarding checklist

### Phase 5: Enterprise (Month 4+)
19. T4-01: Recurring jobs
20. T4-04: Customer portal
21. T4-02: QuickBooks integration
22. T4-05: AI estimate assistant

---

## Directory Structure

```
docs/updates/
├── README.md                          ← You are here
├── bug-fixes/
│   ├── BF-01-processing-state-reset.md
│   ├── BF-02-crew-session-key.md
│   ├── BF-03-invoice-inventory-cost.md
│   ├── BF-04-error-notification-timing.md
│   ├── BF-05-labor-rate-settings.md
│   └── BF-06-warehouse-quantity-validation.md
├── tier-1-high-impact/
│   ├── T1-01-client-side-routing.md
│   ├── T1-02-forgot-password.md
│   ├── T1-03-crew-assignment.md
│   ├── T1-04-email-documents.md
│   ├── T1-05-offline-queue.md
│   ├── T1-06-custom-confirmation-modals.md
│   ├── T1-07-search-and-filter.md
│   └── T1-08-partial-payments.md
├── tier-2-competitive-edge/
│   ├── T2-01-photo-attachments.md
│   ├── T2-02-calendar-view.md
│   ├── T2-03-push-notifications.md
│   ├── T2-04-dashboard-charts.md
│   ├── T2-05-estimate-templates.md
│   ├── T2-06-customer-communication-log.md
│   ├── T2-07-duplicate-estimate.md
│   └── T2-08-bulk-actions.md
├── tier-3-polish/
│   ├── T3-01-dark-mode.md
│   ├── T3-02-keyboard-shortcuts.md
│   ├── T3-03-print-optimized-css.md
│   ├── T3-04-activity-audit-log.md
│   ├── T3-05-reorder-points.md
│   ├── T3-06-multi-language.md
│   ├── T3-07-onboarding-checklist.md
│   └── T3-08-role-based-widgets.md
├── tier-4-future-roadmap/
│   ├── T4-01-recurring-jobs.md
│   ├── T4-02-quickbooks-integration.md
│   ├── T4-03-gps-fleet-tracking.md
│   ├── T4-04-customer-portal.md
│   ├── T4-05-ai-estimate-assistant.md
│   └── T4-06-subcontractor-management.md
└── ux-friction-points/
    └── UX-friction-points-summary.md
```
