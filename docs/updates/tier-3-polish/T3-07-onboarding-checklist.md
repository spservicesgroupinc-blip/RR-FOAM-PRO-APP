# T3-07: Interactive Onboarding Checklist

## Priority: Polish & Delight
## Effort: Medium
## Status: Not Started
## Files Affected: `components/Walkthrough.tsx`, `context/WalkthroughContext.tsx`, New: `components/OnboardingChecklist.tsx`

---

## Problem

The current walkthrough (`Walkthrough.tsx`) is a fully modal, step-by-step tour that prevents interaction with the actual UI. Users can't practice while learning. It also can't be partially completed — if dismissed, progress is lost. 

Additionally, new users don't know what setup steps they need to complete (profile, warehouse, first customer, first estimate).

## Solution

### Replace Modal Tour with Floating Checklist Widget

```tsx
// components/OnboardingChecklist.tsx
const ONBOARDING_STEPS = [
  { id: 'profile', title: 'Set up company profile', description: 'Add logo, address, and contact info', view: 'profile', check: (state) => !!state.companyProfile.companyName },
  { id: 'settings', title: 'Configure material settings', description: 'Set yields, costs, and stroke counts', view: 'settings', check: (state) => state.costs.openCell > 0 },
  { id: 'warehouse', title: 'Set up warehouse inventory', description: 'Add foam stock and supply items', view: 'warehouse', check: (state) => state.warehouse.openCellSets > 0 || state.warehouse.closedCellSets > 0 },
  { id: 'customer', title: 'Add your first customer', description: 'Create a lead in the CRM', view: 'customers', check: (state) => state.customers.length > 0 },
  { id: 'estimate', title: 'Create your first estimate', description: 'Run a spray foam calculation', view: 'calculator', check: (state) => state.savedEstimates.length > 0 },
];

export const OnboardingChecklist: React.FC<{ state: CalculatorState; onNavigate: (view: string) => void }> = ({ state, onNavigate }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const completedCount = ONBOARDING_STEPS.filter(s => s.check(state)).length;
  const allDone = completedCount === ONBOARDING_STEPS.length;
  
  if (allDone) return null; // Hide when all steps complete

  return (
    <div className="fixed bottom-24 md:bottom-8 left-4 md:left-auto md:right-8 z-40 w-80">
      {/* Collapsed state: small pill */}
      {!isExpanded ? (
        <button onClick={() => setIsExpanded(true)} className="bg-slate-900 text-white px-4 py-3 rounded-full shadow-xl flex items-center gap-2">
          <span className="text-sm font-bold">Setup: {completedCount}/{ONBOARDING_STEPS.length}</span>
          <div className="w-16 h-2 bg-slate-700 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-400 rounded-full transition-all" style={{ width: `${(completedCount / ONBOARDING_STEPS.length) * 100}%` }} />
          </div>
        </button>
      ) : (
        /* Expanded state: checklist card */
        <div className="bg-white rounded-2xl shadow-2xl border p-5">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-black text-sm">Getting Started</h3>
            <button onClick={() => setIsExpanded(false)} className="text-slate-400 hover:text-slate-600">
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
          {/* Progress bar */}
          <div className="w-full h-2 bg-slate-100 rounded-full mb-4 overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" 
                 style={{ width: `${(completedCount / ONBOARDING_STEPS.length) * 100}%` }} />
          </div>
          {/* Steps */}
          {ONBOARDING_STEPS.map(step => {
            const done = step.check(state);
            return (
              <button key={step.id} onClick={() => !done && onNavigate(step.view)}
                className={`w-full flex items-start gap-3 p-3 rounded-xl mb-1 text-left transition-all ${done ? 'opacity-60' : 'hover:bg-slate-50'}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${done ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                  {done ? <Check className="w-3 h-3" /> : <Circle className="w-3 h-3" />}
                </div>
                <div>
                  <p className={`text-sm font-bold ${done ? 'line-through text-slate-400' : 'text-slate-900'}`}>{step.title}</p>
                  <p className="text-[10px] text-slate-400">{step.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
```

### Integration

Show for new accounts (first 7 days or until all steps complete):

```tsx
// SprayFoamCalculator.tsx
{!allOnboardingComplete && <OnboardingChecklist state={appData} onNavigate={(v) => dispatch({ type: 'SET_VIEW', payload: v })} />}
```

## Impact
- Interactive, non-blocking onboarding
- Users learn by doing, not by reading
- Persistent progress tracking
- Clear "what's next" guidance for new users
- Auto-hides when complete — doesn't annoy experienced users

## Testing
1. New account → verify checklist appears with 0/5 complete
2. Complete a step → verify checkmark appears and progress updates
3. Collapse checklist → verify small pill shows progress
4. Click an incomplete step → verify navigation to correct view
5. Complete all steps → verify checklist disappears permanently
