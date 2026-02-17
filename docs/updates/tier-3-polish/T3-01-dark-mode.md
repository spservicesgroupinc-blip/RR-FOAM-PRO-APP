# T3-01: Dark Mode Support

## Priority: Polish & Delight
## Effort: Medium
## Status: Not Started
## Files Affected: `tailwind.config.js`, `components/Layout.tsx`, `components/Settings.tsx`, all component files

---

## Problem

The app is light-theme only. Many users (especially field workers using the app at night or in dimly lit spaces) prefer dark mode. Additionally, dark mode reduces eye strain and saves battery on OLED screens (common on mobile devices).

## Solution

### Step 1: Enable Tailwind Dark Mode

```javascript
// tailwind.config.js
module.exports = {
  darkMode: 'class', // or 'media' for system-preference-only
  // ...
};
```

### Step 2: Theme Toggle in Settings

```tsx
// components/Settings.tsx
const [theme, setTheme] = useState(localStorage.getItem('theme') || 'system');

const applyTheme = (mode: string) => {
  localStorage.setItem('theme', mode);
  if (mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
};

// Three options: Light | Dark | System
<div className="flex gap-2">
  <button onClick={() => applyTheme('light')} className={...}>☀️ Light</button>
  <button onClick={() => applyTheme('dark')} className={...}>🌙 Dark</button>
  <button onClick={() => applyTheme('system')} className={...}>💻 System</button>
</div>
```

### Step 3: Add Dark Variants to Components

Pattern for converting existing classes:

```tsx
// Before:
className="bg-white text-slate-900 border-slate-200"

// After:
className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-700"
```

### Key Color Mappings

| Light | Dark |
|-------|------|
| `bg-white` | `dark:bg-slate-900` |
| `bg-slate-50` | `dark:bg-slate-950` |
| `bg-slate-100` | `dark:bg-slate-800` |
| `text-slate-900` | `dark:text-slate-100` |
| `text-slate-500` | `dark:text-slate-400` |
| `border-slate-200` | `dark:border-slate-700` |
| `bg-brand` (red) | `dark:bg-brand` (unchanged) |

### Priority Components to Convert
1. Layout (sidebar, header, bottom nav)
2. Dashboard (cards, tables)
3. Calculator (forms, inputs)
4. Modals and dialogs
5. All remaining components

## Impact
- Reduced eye strain for users working evenings/early mornings
- Battery savings on OLED mobile devices
- Modern, professional appearance
- User preference respected

## Testing
1. Toggle to Dark mode → verify all components switch
2. Toggle to System → verify follows OS preference
3. Refresh page → verify preference persists
4. Test all views in dark mode for contrast/readability issues
5. Test on mobile (iOS dark mode + Android)
