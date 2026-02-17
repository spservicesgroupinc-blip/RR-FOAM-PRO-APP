# T1-01: Client-Side Routing with React Router

## Priority: High Impact
## Effort: Medium
## Status: Not Started
## Files Affected: `App.tsx`, `components/SprayFoamCalculator.tsx`, `components/Layout.tsx`, `context/CalculatorContext.tsx`, `package.json`

---

## Problem

The app currently uses internal state (`dispatch({ type: 'SET_VIEW', payload: 'dashboard' })`) for all navigation. This means:

- **Browser back button** exits the PWA entirely instead of going to the previous view
- **No URL routing** — users can't bookmark or share links to specific pages
- **No deep linking** — PWA shortcuts work via query params (`?action=new_estimate`) but actual page URLs don't exist
- **No browser history** — pressing back always leaves the app

## Solution

Integrate `react-router-dom` to provide real URL-based routing while preserving the current state management.

### Step 1: Install

```bash
npm install react-router-dom
```

### Step 2: Define Routes

```tsx
// routes.ts
export const ROUTES = {
  dashboard: '/dashboard',
  calculator: '/calculator',
  customers: '/customers',
  customerDetail: '/customers/:id',
  warehouse: '/warehouse',
  settings: '/settings',
  profile: '/profile',
  estimateDetail: '/estimate/:id',
  workOrderStage: '/estimate/:id/work-order',
  invoiceStage: '/estimate/:id/invoice',
  estimateStage: '/estimate/:id/finalize',
  materialOrder: '/warehouse/order',
  materialReport: '/warehouse/report',
  equipmentTracker: '/warehouse/equipment',
  login: '/login',
} as const;
```

### Step 3: Wrap App with Router

```tsx
// App.tsx
import { BrowserRouter } from 'react-router-dom';

function App() {
  return (
    <BrowserRouter>
      <CalculatorProvider>
        <SprayFoamCalculator />
      </CalculatorProvider>
    </BrowserRouter>
  );
}
```

### Step 4: Replace SET_VIEW with Navigation

```tsx
// Before:
dispatch({ type: 'SET_VIEW', payload: 'dashboard' });

// After:
navigate('/dashboard');
```

### Step 5: Sync Router with State

Keep `ui.view` in sync with the current route so existing component logic still works:

```tsx
useEffect(() => {
  const path = location.pathname;
  if (path.startsWith('/dashboard')) dispatch({ type: 'SET_VIEW', payload: 'dashboard' });
  else if (path.startsWith('/calculator')) dispatch({ type: 'SET_VIEW', payload: 'calculator' });
  // ... etc
}, [location.pathname]);
```

## Benefits
- Browser back button works naturally within the app
- Users can bookmark specific pages
- Deep links work (share a URL to a specific estimate)
- PWA shortcuts become real routes instead of query param hacks
- Better analytics tracking (page views per route)

## Migration Strategy
- Phase 1: Add router wrapping, map existing views to URLs
- Phase 2: Replace `SET_VIEW` dispatches with `navigate()` calls
- Phase 3: Add route guards (auth check per route)
- Phase 4: Remove `ui.view` state entirely, derive from URL

## Risks
- Large refactor touching most components
- Need to handle auth guards per route
- Service worker may need updated cache strategy for new URL patterns
- Existing `?action=` deep links need redirect logic

## Testing
1. Navigate through all views and verify URL changes
2. Press browser back button — verify it returns to previous view
3. Copy a URL and paste in new tab — verify it loads correct view
4. Test PWA shortcuts still work
5. Test that auth guards redirect unauthenticated users to login
