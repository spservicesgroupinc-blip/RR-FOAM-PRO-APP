# Database Update - Crew Inventory Fix

## Issue
The crew inventory update feature was not functioning correctly. When crew members completed jobs and submitted actual material quantities, the warehouse inventory was not being updated.

## Root Cause
The `crew_update_job` PostgreSQL function in `supabase_functions.sql` had a logic flaw in the inventory item matching code. Specifically:

1. The function tries to match inventory items by UUID first, then falls back to name-based matching
2. When an item didn't have a valid UUID in `warehouseItemId`, the code would skip the UUID UPDATE
3. However, the `IF NOT FOUND` check would evaluate based on the `FOUND` variable from previous loop iterations
4. This caused the name-based fallback to be skipped for items without valid UUIDs

## Solution
The logic was restructured to use an `ELSIF` clause that explicitly handles non-UUID items:

```sql
-- Old broken logic:
IF v_wh_item_id IS NOT NULL THEN
  IF v_wh_item_id ~ 'uuid-regex' THEN
    UPDATE ... -- Only runs if UUID matches regex
  END IF;
  IF NOT FOUND THEN  -- Bug: FOUND retains value from previous iteration!
    UPDATE ... -- Name fallback
  END IF;
END IF;

-- New fixed logic:
IF v_wh_item_id IS NOT NULL AND v_wh_item_id ~ 'uuid-regex' THEN
  UPDATE ... -- Try UUID match
  IF NOT FOUND THEN
    UPDATE ... -- Fallback to name if UUID didn't match a row
  END IF;
ELSIF v_item_name IS NOT NULL THEN
  UPDATE ... -- No valid UUID, match by name only
END IF;
```

## Deployment Instructions

### Step 1: Deploy to Supabase
1. Open your Supabase project dashboard
2. Navigate to the SQL Editor
3. Copy the entire contents of `supabase_functions.sql`
4. Paste into the SQL Editor
5. Click "Run" to execute the updated function

### Step 2: Verify Deployment
1. Check that the function executed without errors
2. Test the crew inventory update:
   - Log in as crew
   - Select a work order
   - Complete the job with actual material quantities
   - Verify that the warehouse inventory is updated correctly

## Testing Checklist
- [ ] Database function deployed successfully
- [ ] Crew can complete jobs and submit actuals
- [ ] Warehouse inventory updates reflect actual quantities used
- [ ] Items matched by UUID update correctly
- [ ] Items matched by name update correctly
- [ ] Extra items used by crew (not in estimate) are deducted correctly

## Files Modified
- `supabase_functions.sql` - Fixed `crew_update_job` function logic (lines 205-275)

## Notes
- This fix applies to both:
  1. Standard inventory items in the work order (lines 205-227)
  2. Extra materials used by crew not in original estimate (lines 250-275)
- The fix ensures proper inventory tracking regardless of whether items have UUID or name-based matching
- No client-side code changes were needed
