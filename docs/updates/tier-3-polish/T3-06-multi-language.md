# T3-06: Multi-Language Support (i18n)

## Priority: Polish & Delight
## Effort: High
## Status: Not Started
## Files Affected: All components, New: `i18n/`, `hooks/useTranslation.ts`

---

## Problem

The spray foam insulation industry has a significant Spanish-speaking workforce. Crew members who primarily speak Spanish must use an English-only interface. This creates friction, errors, and slow adoption on the crew side.

## Solution

### Library: react-i18next

```bash
npm install react-i18next i18next
```

### Setup

```typescript
// i18n/index.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import es from './locales/es.json';

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, es: { translation: es } },
  lng: localStorage.getItem('language') || 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});
```

### Locale Files

```json
// i18n/locales/en.json
{
  "nav": {
    "dashboard": "Dashboard",
    "customers": "Customers",
    "warehouse": "Warehouse",
    "settings": "Settings",
    "profile": "Profile"
  },
  "dashboard": {
    "totalValue": "Total Pipeline Value",
    "reviewNeeded": "Review Needed",
    "newEstimate": "New Estimate"
  },
  "crew": {
    "startTimer": "Start Timer",
    "completeJob": "Complete Job",
    "openCellUsed": "Open Cell Sets Used",
    "closedCellUsed": "Closed Cell Sets Used"
  }
}

// i18n/locales/es.json
{
  "nav": {
    "dashboard": "Panel",
    "customers": "Clientes",
    "warehouse": "Almacén",
    "settings": "Configuración",
    "profile": "Perfil"
  },
  "crew": {
    "startTimer": "Iniciar Temporizador",
    "completeJob": "Completar Trabajo",
    "openCellUsed": "Juegos de Celda Abierta Usados",
    "closedCellUsed": "Juegos de Celda Cerrada Usados"
  }
}
```

### Usage

```tsx
import { useTranslation } from 'react-i18next';

const Dashboard = () => {
  const { t } = useTranslation();
  return <h2>{t('dashboard.totalValue')}</h2>;
};
```

### Language Selector in Settings

```tsx
<select value={language} onChange={(e) => { i18n.changeLanguage(e.target.value); localStorage.setItem('language', e.target.value); }}>
  <option value="en">English</option>
  <option value="es">Español</option>
</select>
```

### Priority Translation Order
1. **CrewDashboard** — Most critical (field workers)
2. **LoginPage** — First impression for crew
3. **Layout** (navigation labels)
4. **Warehouse** — Inventory management
5. **Calculator** — Admin use but still important
6. **All remaining components**

## Impact
- Accessible to Spanish-speaking crews
- Reduces errors from misunderstood English labels
- Faster adoption on field devices
- Expandable to other languages (Portuguese, French) later

## Testing
1. Switch to Spanish → verify all visible labels change
2. Switch back to English → verify revert is complete
3. Refresh page → verify language persists
4. Test all views in Spanish → verify no untranslated strings
5. Test with long Spanish text → verify layout doesn't break
