# T3-02: Keyboard Shortcuts

## Priority: Polish & Delight
## Effort: Low
## Status: Not Started
## Files Affected: New: `hooks/useKeyboardShortcuts.ts`, `components/Layout.tsx`

---

## Problem

Power users (admins creating many estimates daily) would benefit from keyboard shortcuts to speed up common workflows. Currently everything requires mouse/touch interaction.

## Solution

### Hook Implementation

```typescript
// hooks/useKeyboardShortcuts.ts
import { useEffect } from 'react';

type ShortcutMap = Record<string, () => void>;

export const useKeyboardShortcuts = (shortcuts: ShortcutMap) => {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't trigger when typing in inputs
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) return;

      const key = [
        e.ctrlKey || e.metaKey ? 'Ctrl' : '',
        e.shiftKey ? 'Shift' : '',
        e.altKey ? 'Alt' : '',
        e.key.toUpperCase(),
      ].filter(Boolean).join('+');

      if (shortcuts[key]) {
        e.preventDefault();
        shortcuts[key]();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [shortcuts]);
};
```

### Shortcut Map

```typescript
// In SprayFoamCalculator.tsx
useKeyboardShortcuts({
  'Ctrl+N': () => { resetCalculator(); dispatch({ type: 'SET_VIEW', payload: 'calculator' }); },
  'Ctrl+S': () => saveEstimate(results, 'Draft'),
  'Ctrl+D': () => dispatch({ type: 'SET_VIEW', payload: 'dashboard' }),
  'Ctrl+K': () => dispatch({ type: 'SET_VIEW', payload: 'customers' }),
  'Ctrl+W': () => dispatch({ type: 'SET_VIEW', payload: 'warehouse' }),
  'ESCAPE': () => closeCurrentModal(),
  'Shift+?': () => setShowShortcutsHelp(true),
});
```

### Shortcuts Reference

| Shortcut | Action |
|----------|--------|
| `Ctrl+N` | New Estimate |
| `Ctrl+S` | Save Current |
| `Ctrl+D` | Go to Dashboard |
| `Ctrl+K` | Go to Customers |
| `Ctrl+W` | Go to Warehouse |
| `Ctrl+P` | Generate PDF |
| `Escape` | Close Modal / Go Back |
| `Shift+?` | Show Shortcuts Help |

### Help Overlay

```tsx
// Keyboard shortcuts help modal
{showShortcutsHelp && (
  <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
    <div className="bg-white rounded-3xl p-8 max-w-md w-full">
      <h3 className="text-xl font-black mb-6">Keyboard Shortcuts</h3>
      <div className="space-y-3">
        {Object.entries(shortcutDescriptions).map(([key, desc]) => (
          <div key={key} className="flex justify-between">
            <span className="text-slate-600">{desc}</span>
            <kbd className="bg-slate-100 px-2 py-1 rounded text-xs font-mono font-bold">{key}</kbd>
          </div>
        ))}
      </div>
    </div>
  </div>
)}
```

## Impact
- Speed boost for power users (admin creating 5+ estimates/day)
- Professional feel — matches desktop-class applications
- Reduces mouse dependency for repetitive tasks
- Desktop PWA feels native with keyboard support

## Testing
1. Press `Ctrl+N` → verify new estimate view opens
2. Press `Ctrl+S` in calculator → verify estimate saves
3. Press `Escape` with modal open → verify modal closes
4. Press `Shift+?` → verify shortcuts help overlay appears
5. Type in a text input → verify shortcuts don't fire
6. Test on Mac → verify Cmd works instead of Ctrl
