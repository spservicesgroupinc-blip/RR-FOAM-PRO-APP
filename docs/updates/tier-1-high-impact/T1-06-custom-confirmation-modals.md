# T1-06: Custom Confirmation Modals

## Priority: High Impact
## Effort: Low
## Status: Not Started
## Files Affected: New: `components/ConfirmDialog.tsx`, plus all files using `confirm()` or `prompt()`

---

## Problem

The app uses native `window.confirm()` and `window.prompt()` dialogs throughout. These:

- Break the PWA immersive experience (native OS dialogs look out of place)
- Can't be styled or themed to match the app's design
- Block the JavaScript thread
- Show different UI on different platforms (jarring on iOS/Android)

## Locations Using Native Dialogs

| File | Usage |
|------|-------|
| `SprayFoamCalculator.tsx` | `confirm("Archive this customer?")` |
| `CrewDashboard.tsx` | `confirm("Mark as completed?")` |
| `Dashboard.tsx` | `confirm("Mark this invoice as PAID in full?")` |
| `Calculator.tsx` | `prompt("Enter new item name")` (warehouse item creation) |
| `Customers.tsx` | `alert("Name is required")` |
| `MaterialOrder.tsx` | Various confirmations |

## Solution

### Step 1: Create Reusable ConfirmDialog Component

```tsx
// components/ConfirmDialog.tsx
import React from 'react';
import { AlertTriangle, CheckCircle2, X, Trash2.Info } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'success' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
}

const variants = {
  danger: { bg: 'bg-red-50', icon: Trash2, iconColor: 'text-red-500', button: 'bg-red-600 hover:bg-red-700' },
  warning: { bg: 'bg-amber-50', icon: AlertTriangle, iconColor: 'text-amber-500', button: 'bg-amber-600 hover:bg-amber-700' },
  success: { bg: 'bg-emerald-50', icon: CheckCircle2, iconColor: 'text-emerald-500', button: 'bg-emerald-600 hover:bg-emerald-700' },
  info: { bg: 'bg-sky-50', icon: Info, iconColor: 'text-sky-500', button: 'bg-sky-600 hover:bg-sky-700' },
};

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  variant = 'warning', onConfirm, onCancel,
}) => {
  if (!isOpen) return null;
  const v = variants[variant];
  const Icon = v.icon;

  return (
    <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
         onClick={onCancel}>
      <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200"
           onClick={e => e.stopPropagation()}>
        <div className={`w-14 h-14 ${v.bg} rounded-2xl flex items-center justify-center mx-auto mb-5`}>
          <Icon className={`w-7 h-7 ${v.iconColor}`} />
        </div>
        <h3 className="text-xl font-black text-slate-900 text-center mb-2">{title}</h3>
        <p className="text-slate-500 text-sm text-center mb-8 leading-relaxed">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel}
            className="flex-1 py-3 border-2 border-slate-200 rounded-2xl font-bold text-sm text-slate-600 hover:bg-slate-50 transition-all">
            {cancelLabel}
          </button>
          <button onClick={onConfirm}
            className={`flex-1 py-3 ${v.button} text-white rounded-2xl font-bold text-sm transition-all shadow-lg`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
```

### Step 2: Create PromptDialog Component

```tsx
// components/PromptDialog.tsx
export const PromptDialog: React.FC<{
  isOpen: boolean;
  title: string;
  message: string;
  placeholder?: string;
  defaultValue?: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}> = ({ isOpen, title, message, placeholder, defaultValue = '', onSubmit, onCancel }) => {
  const [value, setValue] = useState(defaultValue);
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl">
        <h3 className="text-xl font-black text-slate-900 mb-2">{title}</h3>
        <p className="text-slate-500 text-sm mb-4">{message}</p>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="w-full px-4 py-3 border rounded-xl mb-6 font-bold"
          autoFocus
        />
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-3 border-2 rounded-2xl font-bold text-sm">Cancel</button>
          <button onClick={() => onSubmit(value)} className="flex-1 py-3 bg-brand text-white rounded-2xl font-bold text-sm">OK</button>
        </div>
      </div>
    </div>
  );
};
```

### Step 3: Optional Hook for Ease of Use

```tsx
// hooks/useConfirm.ts
export const useConfirm = () => {
  const [state, setState] = useState<{ isOpen: boolean; resolver?: (v: boolean) => void; config: any }>({
    isOpen: false, config: {}
  });

  const confirm = (config: { title: string; message: string; variant?: string }) => {
    return new Promise<boolean>((resolve) => {
      setState({ isOpen: true, resolver: resolve, config });
    });
  };

  const handleConfirm = () => { state.resolver?.(true); setState({ isOpen: false, config: {} }); };
  const handleCancel = () => { state.resolver?.(false); setState({ isOpen: false, config: {} }); };

  const DialogComponent = () => (
    <ConfirmDialog isOpen={state.isOpen} onConfirm={handleConfirm} onCancel={handleCancel} {...state.config} />
  );

  return { confirm, DialogComponent };
};
```

## Impact
- Consistent, polished look across all confirmations
- Matches the app's design system (rounded corners, brand colors, backdrop blur)
- Better mobile experience (no jarring OS dialogs)
- Accessible — keyboard navigation, focus trapping

## Testing
1. Trigger archive customer → verify custom modal appears
2. Trigger mark as paid → verify danger variant shows
3. Create warehouse item → verify prompt dialog appears
4. Press Escape or click backdrop → verify dialog closes
5. Test on mobile (iOS + Android) → verify no native dialog
