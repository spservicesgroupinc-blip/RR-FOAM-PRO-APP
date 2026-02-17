# T4-05: AI Estimate Assistant

## Priority: Future Roadmap
## Effort: Very High
## Status: Not Started
## Files Affected: New: `services/aiAssistant.ts`, `components/AIEstimateHelper.tsx`

---

## Problem

Creating an accurate spray foam estimate requires expertise:
- Choosing wrong foam type for an application
- Incorrect R-value targets for climate zone
- Overlooking building code requirements
- Under/over-estimating surface areas for complex shapes
- Not accounting for waste factors in specific scenarios

New contractors or new employees make costly estimation mistakes.

## Solution

### AI-Powered Estimation Copilot

Integrate an LLM (OpenAI GPT-4 / Claude) to assist with estimate creation.

### Features

#### 1. Smart Suggestions

```tsx
// When user enters building details, AI suggests:
const suggestions = await getAISuggestions({
  buildingType: 'residential',
  area: 2500,
  location: 'Dallas, TX',
  application: 'attic',
});

// Returns:
{
  recommendedFoamType: 'open_cell',
  recommendedThickness: '5.5"',
  reasoning: 'Open cell is ideal for attic applications in Climate Zone 3 (Dallas). 5.5" provides R-20 which meets IRC 2021 code minimum.',
  rValueTarget: 'R-20 (attic minimum per IRC N1102.1.2)',
  wasteFactor: '15% (open attic, minimal obstructions)',
  cautionNotes: ['Ensure soffit baffles installed for ventilation', 'Check for aluminum wiring before spraying']
}
```

#### 2. Photo-Based Area Estimation

Combined with T2-01 (photo attachments):

```typescript
// Upload a job site photo → AI estimates surface area
const areaEstimate = await analyzePhoto(photoBase64, {
  prompt: 'Estimate the sprayable surface area of this attic. Include dimensions and any obstructions visible.',
});
```

#### 3. Estimate Review / Sanity Check

Before sending an estimate to a customer, AI reviews for common issues:

```tsx
const review = await reviewEstimate(estimateData);
// Returns:
{
  issues: [
    { severity: 'warning', message: 'Foam cost per sqft ($1.85) is 20% below market average for closed cell in this region' },
    { severity: 'info', message: 'Consider adding sound attenuation as a value-add for this residential project' },
  ],
  marketComparison: { low: '$3,200', average: '$4,100', high: '$5,500', yourPrice: '$3,750' }
}
```

#### 4. Natural Language Input

```
User: "2000 sqft ranch house in Denver, spray the attic and crawl space with closed cell"

AI parses → Creates two building entries:
1. Attic: 2000 sqft, R-49 target (Climate Zone 5), Closed Cell, 7" thickness
2. Crawl Space: 750 sqft (estimated 37.5% of floor area), R-25, Closed Cell, 4" thickness
```

### Architecture

```
User Input → Supabase Edge Function → OpenAI API → Parsed Response → UI
                                           ↑
                              System prompt with spray foam domain knowledge
```

### System Prompt (Domain Knowledge)

Include comprehensive spray foam knowledge:
- Foam types, yields, R-values per inch
- Climate zone requirements (IECC/IRC)
- Application best practices
- Regional pricing data (anonymized from platform)
- Waste factor guidelines
- Safety considerations

## Impact
- Dramatically reduced estimation errors
- Faster estimate creation for complex jobs
- Built-in code compliance checking
- Competitive pricing intelligence
- Lower barrier to entry for new estimators

## Complexity Notes
- LLM API costs ($0.01-0.10 per estimate)
- Need robust prompt engineering and guardrails
- Accuracy depends on training data quality
- Feature-gate to Pro/Enterprise tiers
- Privacy: Don't send customer PII to LLM
- Fallback when AI is unavailable (network/quota)
