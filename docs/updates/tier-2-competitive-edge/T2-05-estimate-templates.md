# T2-05: Estimate Templates

## Priority: Medium Impact — Competitive Edge
## Effort: Low-Medium
## Status: Not Started
## Files Affected: `types.ts`, `components/Calculator.tsx`, `context/CalculatorContext.tsx`, `services/supabaseService.ts`

---

## Problem

Spray foam contractors often do similar jobs repeatedly (e.g., "Standard 40×60 metal building", "2000sqft attic retrofit", "Crawlspace 1500sqft"). Currently, they must re-enter all dimensions, foam settings, and scope details from scratch each time.

## Solution

### Data Model

```typescript
// types.ts
export interface EstimateTemplate {
  id: string;
  name: string;
  description?: string;
  inputs: {
    mode: CalculationMode;
    length: number;
    width: number;
    wallHeight: number;
    roofPitch: string;
    includeGables: boolean;
    isMetalSurface: boolean;
    additionalAreas: AdditionalArea[];
  };
  wallSettings: FoamSettings;
  roofSettings: FoamSettings;
  inventory: InventoryItem[];
  equipment: EquipmentItem[];
  createdAt: string;
}
```

### Save as Template

Add a "Save as Template" button in the Calculator:

```tsx
// Calculator.tsx
const handleSaveAsTemplate = () => {
  const name = prompt("Template name (e.g., '40x60 Metal Building'):");
  if (!name) return;
  
  const template: EstimateTemplate = {
    id: crypto.randomUUID(),
    name,
    inputs: {
      mode: state.mode, length: state.length, width: state.width,
      wallHeight: state.wallHeight, roofPitch: state.roofPitch,
      includeGables: state.includeGables, isMetalSurface: state.isMetalSurface,
      additionalAreas: state.additionalAreas,
    },
    wallSettings: state.wallSettings,
    roofSettings: state.roofSettings,
    inventory: state.inventory,
    equipment: state.jobEquipment,
    createdAt: new Date().toISOString(),
  };
  
  dispatch({ type: 'ADD_TEMPLATE', payload: template });
};
```

### Load from Template

In the Calculator header or Quick Actions:

```tsx
<select onChange={(e) => loadTemplate(e.target.value)} className="...">
  <option value="">Load Template...</option>
  {templates.map(t => (
    <option key={t.id} value={t.id}>{t.name} — {t.description}</option>
  ))}
</select>
```

### Pre-Built Templates (Starter Pack)

Ship default templates for common scenarios:

```typescript
const DEFAULT_TEMPLATES: EstimateTemplate[] = [
  {
    name: '40×60 Metal Building',
    inputs: { mode: 'Building', length: 60, width: 40, wallHeight: 14, roofPitch: '3/12', includeGables: true, isMetalSurface: true },
    wallSettings: { type: 'Closed Cell', thickness: 2, wastePercentage: 15 },
    roofSettings: { type: 'Closed Cell', thickness: 3, wastePercentage: 15 },
  },
  {
    name: '2000sqft Attic Retrofit',
    inputs: { mode: 'Flat Area', length: 50, width: 40, ... },
    ...
  },
  {
    name: 'Crawlspace Standard',
    inputs: { mode: 'Walls Only', length: 30, width: 20, wallHeight: 3, ... },
    ...
  },
];
```

## Database

```sql
CREATE TABLE estimate_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  name TEXT NOT NULL,
  description TEXT,
  template_data JSONB NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

## Impact
- Speeds up estimate creation for repeat job types
- Reduces input errors (pre-validated configurations)
- Onboarding tool — starter templates teach new users what fields matter
- Crew consistency — everyone starts from the same baseline

## Testing
1. Fill out calculator → "Save as Template" → verify template saved
2. Create new estimate → "Load Template" → verify all fields populated
3. Verify customer data is NOT included in template (only job specs)
4. Edit a loaded template → verify changes don't affect the saved template
5. Delete a template → verify it's removed from the dropdown
