# BF-02: Crew Session Key Mismatch in CrewDashboard

## Priority: High
## Status: Not Started
## File: `components/CrewDashboard.tsx`

---

## Problem

In `CrewDashboard.tsx`, there is a session key mismatch between different functions:

- `handleCompleteJobSubmit` reads from `localStorage.getItem('foamProCrewSession')`
- `handleStartTimer` reads from `localStorage.getItem('foamProSession')`

Since crew users store their session under `foamProCrewSession` (set in `LoginPage.tsx`), the timer start function reads from the wrong key and may get `null` or an admin session instead.

## Current Code

```tsx
// In handleStartTimer:
const sessionStr = localStorage.getItem('foamProSession'); // ← WRONG KEY for crew

// In handleCompleteJobSubmit:
const sessionStr = localStorage.getItem('foamProCrewSession'); // ← Correct key
```

## Fix

Standardize all crew localStorage reads to use `foamProCrewSession`:

```tsx
// In handleStartTimer:
const sessionStr = localStorage.getItem('foamProCrewSession'); // ← Fixed
```

Alternatively, define a constant for the key:

```tsx
const CREW_SESSION_KEY = 'foamProCrewSession';
// Use CREW_SESSION_KEY everywhere in CrewDashboard
```

## Impact
- Fixes potential null session when crew starts a timer
- Prevents crew accidentally reading an admin session
- Prevents timer from failing silently on crew devices

## Testing
1. Log in as a crew member (company name + PIN)
2. Select a work order and start the timer
3. Verify the timer starts and persists correctly
4. Complete the job and verify actuals are submitted with correct crew identity
5. Check that `foamProCrewSession` is used consistently in both code paths
