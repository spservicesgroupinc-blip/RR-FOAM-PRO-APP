-- ============================================================================
-- RR FOAM PRO - Required Supabase RPC Functions
-- ============================================================================
-- Run this ENTIRE FILE in the Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- These functions are SECURITY DEFINER, meaning they bypass RLS.
-- This is required because crew users login via PIN (no auth.uid()).
-- ============================================================================

-- ─── 1. VERIFY CREW PIN ─────────────────────────────────────────────────────
-- Used by crew login (PIN-based authentication)
-- Returns: { success, organization_id, company_name }

DROP FUNCTION IF EXISTS verify_crew_pin(text, text);
CREATE OR REPLACE FUNCTION verify_crew_pin(org_name text, pin text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  org_record record;
BEGIN
  SELECT id, name, crew_pin
  INTO org_record
  FROM organizations
  WHERE LOWER(TRIM(name)) = LOWER(TRIM(org_name));

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Company not found.');
  END IF;

  IF org_record.crew_pin IS NULL OR org_record.crew_pin = '' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Crew access not configured. Ask your admin to set a PIN.');
  END IF;

  IF org_record.crew_pin != pin THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid PIN.');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'organization_id', org_record.id,
    'company_name', org_record.name
  );
END;
$$;


-- ─── 2. GET CREW WORK ORDERS ────────────────────────────────────────────────
-- Fetches all Work Order estimates + related customers + org info for crew dashboard.
-- Returns a JSON object matching the shape expected by fetchCrewWorkOrders() in the app.

DROP FUNCTION IF EXISTS get_crew_work_orders(uuid);
CREATE OR REPLACE FUNCTION get_crew_work_orders(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'organization', (
      SELECT row_to_json(o.*)::jsonb
      FROM organizations o
      WHERE o.id = p_org_id
    ),
    'customers', COALESCE((
      SELECT jsonb_agg(row_to_json(c.*)::jsonb)
      FROM customers c
      WHERE c.organization_id = p_org_id
    ), '[]'::jsonb),
    'estimates', COALESCE((
      SELECT jsonb_agg(row_to_json(e.*)::jsonb)
      FROM estimates e
      WHERE e.organization_id = p_org_id
        AND e.status = 'Work Order'
    ), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$;


-- ─── 3. CREW UPDATE JOB ─────────────────────────────────────────────────────
-- Allows crew to update job actuals and execution status without auth.uid().
-- Used when crew starts/stops timer or completes a job.
-- When status = 'Completed', automatically adjusts warehouse inventory based on
-- the difference between estimated and actual material usage.

DROP FUNCTION IF EXISTS crew_update_job(uuid, uuid, jsonb, text);
CREATE OR REPLACE FUNCTION crew_update_job(
  p_org_id uuid,
  p_estimate_id uuid,
  p_actuals jsonb,
  p_execution_status text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_estimate record;
  v_ref_oc numeric;
  v_ref_cc numeric;
  v_act_oc numeric;
  v_act_cc numeric;
  v_oc_adj numeric;
  v_cc_adj numeric;
  v_ref_inv jsonb;
  v_act_inv jsonb;
  v_est_item jsonb;
  v_act_item jsonb;
  v_item_diff numeric;
  v_wh_item_id text;
  v_item_name text;
  i int;
  j int;
BEGIN
  -- 1. Read old state BEFORE updating
  SELECT * INTO v_old_estimate
  FROM estimates
  WHERE id = p_estimate_id AND organization_id = p_org_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- 2. Update the estimate with new actuals and status
  UPDATE estimates
  SET
    actuals = p_actuals,
    execution_status = p_execution_status,
    last_modified = now()
  WHERE id = p_estimate_id
    AND organization_id = p_org_id;

  -- 3. Adjust warehouse inventory when completing a job
  IF p_execution_status = 'Completed' THEN

    -- Determine reference amounts:
    -- First completion: compare actual vs estimated (materials)
    -- Re-edit after completion: compare new actual vs previous actual
    -- NOTE: Use execution_status (NOT inventory_processed) to detect re-edits.
    -- inventory_processed is set to true when the admin creates the Work Order
    -- (to track that estimated materials were deducted). Using it here would
    -- incorrectly take the re-edit branch on the FIRST crew completion,
    -- reading NULL actuals as the reference (0) and causing wrong adjustments.
    IF v_old_estimate.execution_status = 'Completed' THEN
      -- Re-edit: job was already completed, reference is the PREVIOUS actuals
      v_ref_oc := COALESCE((v_old_estimate.actuals->>'openCellSets')::numeric, 0);
      v_ref_cc := COALESCE((v_old_estimate.actuals->>'closedCellSets')::numeric, 0);
      v_ref_inv := COALESCE(v_old_estimate.actuals->'inventory', '[]'::jsonb);
    ELSE
      -- First completion: reference is the ESTIMATED amounts (already deducted from warehouse)
      v_ref_oc := COALESCE((v_old_estimate.materials->>'openCellSets')::numeric, 0);
      v_ref_cc := COALESCE((v_old_estimate.materials->>'closedCellSets')::numeric, 0);
      v_ref_inv := COALESCE(v_old_estimate.materials->'inventory', '[]'::jsonb);
    END IF;

    -- New actual amounts from crew submission
    v_act_oc := COALESCE((p_actuals->>'openCellSets')::numeric, 0);
    v_act_cc := COALESCE((p_actuals->>'closedCellSets')::numeric, 0);
    v_act_inv := COALESCE(p_actuals->'inventory', '[]'::jsonb);

    -- Calculate foam adjustment: positive = crew used less (return to stock), negative = used more (deduct more)
    v_oc_adj := v_ref_oc - v_act_oc;
    v_cc_adj := v_ref_cc - v_act_cc;

    -- Apply foam stock adjustment
    IF v_oc_adj != 0 OR v_cc_adj != 0 THEN
      UPDATE warehouse_stock
      SET
        open_cell_sets = COALESCE(open_cell_sets, 0) + v_oc_adj,
        closed_cell_sets = COALESCE(closed_cell_sets, 0) + v_cc_adj
      WHERE organization_id = p_org_id;
    END IF;

    -- Adjust non-chemical inventory items
    IF jsonb_array_length(v_ref_inv) > 0 THEN
      FOR i IN 0..jsonb_array_length(v_ref_inv) - 1 LOOP
        v_est_item := v_ref_inv->i;
        v_wh_item_id := COALESCE(v_est_item->>'warehouseItemId', v_est_item->>'id');
        v_item_name := v_est_item->>'name';

        -- Find matching actual item by ID or name
        v_act_item := NULL;
        IF jsonb_array_length(v_act_inv) > 0 THEN
          FOR j IN 0..jsonb_array_length(v_act_inv) - 1 LOOP
            IF (COALESCE((v_act_inv->j)->>'warehouseItemId', (v_act_inv->j)->>'id') = v_wh_item_id)
               OR (LOWER(TRIM((v_act_inv->j)->>'name')) = LOWER(TRIM(v_item_name))) THEN
              v_act_item := v_act_inv->j;
              EXIT;
            END IF;
          END LOOP;
        END IF;

        -- Calculate diff: reference qty - actual qty
        v_item_diff := COALESCE((v_est_item->>'quantity')::numeric, 0) 
                     - COALESCE((v_act_item->>'quantity')::numeric, 0);

        IF v_item_diff != 0 THEN
          -- Try matching by UUID first (only if the ID is a valid UUID format)
          IF v_wh_item_id IS NOT NULL AND v_wh_item_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
            UPDATE inventory_items
            SET quantity = COALESCE(quantity, 0) + v_item_diff
            WHERE id = v_wh_item_id::uuid
              AND organization_id = p_org_id;
          
            -- If UUID match failed, fallback to name matching
            IF NOT FOUND AND v_item_name IS NOT NULL THEN
              UPDATE inventory_items
              SET quantity = COALESCE(quantity, 0) + v_item_diff
              WHERE LOWER(TRIM(name)) = LOWER(TRIM(v_item_name))
                AND organization_id = p_org_id;
            END IF;
          ELSIF v_item_name IS NOT NULL THEN
            -- No valid UUID provided, match by name only
            UPDATE inventory_items
            SET quantity = COALESCE(quantity, 0) + v_item_diff
            WHERE LOWER(TRIM(name)) = LOWER(TRIM(v_item_name))
              AND organization_id = p_org_id;
          END IF;
        END IF;
      END LOOP;
    END IF;

    -- Handle items in actuals that were NOT in the reference (extra materials crew used)
    IF jsonb_array_length(v_act_inv) > 0 THEN
      FOR j IN 0..jsonb_array_length(v_act_inv) - 1 LOOP
        v_act_item := v_act_inv->j;
        v_wh_item_id := COALESCE(v_act_item->>'warehouseItemId', v_act_item->>'id');
        v_item_name := v_act_item->>'name';

        -- Check if this item was already in the reference set (already handled above)
        v_est_item := NULL;
        IF jsonb_array_length(v_ref_inv) > 0 THEN
          FOR i IN 0..jsonb_array_length(v_ref_inv) - 1 LOOP
            IF (COALESCE((v_ref_inv->i)->>'warehouseItemId', (v_ref_inv->i)->>'id') = v_wh_item_id)
               OR (LOWER(TRIM((v_ref_inv->i)->>'name')) = LOWER(TRIM(v_item_name))) THEN
              v_est_item := v_ref_inv->i;
              EXIT;
            END IF;
          END LOOP;
        END IF;

        -- If NOT found in reference, this is extra usage — deduct it
        IF v_est_item IS NULL AND COALESCE((v_act_item->>'quantity')::numeric, 0) > 0 THEN
          v_item_diff := -1 * COALESCE((v_act_item->>'quantity')::numeric, 0);
          
          -- Try matching by UUID first (only if the ID is a valid UUID format)
          IF v_wh_item_id IS NOT NULL AND v_wh_item_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
            UPDATE inventory_items
            SET quantity = COALESCE(quantity, 0) + v_item_diff
            WHERE id = v_wh_item_id::uuid
              AND organization_id = p_org_id;
          
            -- If UUID match failed, fallback to name matching
            IF NOT FOUND AND v_item_name IS NOT NULL THEN
              UPDATE inventory_items
              SET quantity = COALESCE(quantity, 0) + v_item_diff
              WHERE LOWER(TRIM(name)) = LOWER(TRIM(v_item_name))
                AND organization_id = p_org_id;
            END IF;
          ELSIF v_item_name IS NOT NULL THEN
            -- No valid UUID provided, match by name only
            UPDATE inventory_items
            SET quantity = COALESCE(quantity, 0) + v_item_diff
            WHERE LOWER(TRIM(name)) = LOWER(TRIM(v_item_name))
              AND organization_id = p_org_id;
          END IF;
        END IF;
      END LOOP;
    END IF;

    -- Mark as inventory processed
    UPDATE estimates
    SET inventory_processed = true
    WHERE id = p_estimate_id
      AND organization_id = p_org_id;

  END IF;

  RETURN true;
END;
$$;


-- ─── 4. GET ORG DATA (Admin) ────────────────────────────────────────────────
-- Fetches ALL organization data in a single call for admin dashboard.
-- Returns: { organization, customers, estimates, inventory_items, equipment, warehouse_stock, material_logs, purchase_orders }

DROP FUNCTION IF EXISTS get_org_data(uuid);
CREATE OR REPLACE FUNCTION get_org_data(org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'organization', (
      SELECT row_to_json(o.*)::jsonb
      FROM organizations o
      WHERE o.id = org_id
    ),
    'customers', COALESCE((
      SELECT jsonb_agg(row_to_json(c.*)::jsonb)
      FROM customers c
      WHERE c.organization_id = org_id
    ), '[]'::jsonb),
    'estimates', COALESCE((
      SELECT jsonb_agg(row_to_json(e.*)::jsonb ORDER BY e.created_at DESC)
      FROM estimates e
      WHERE e.organization_id = org_id
    ), '[]'::jsonb),
    'inventory_items', COALESCE((
      SELECT jsonb_agg(row_to_json(i.*)::jsonb)
      FROM inventory_items i
      WHERE i.organization_id = org_id
    ), '[]'::jsonb),
    'equipment', COALESCE((
      SELECT jsonb_agg(row_to_json(eq.*)::jsonb)
      FROM equipment eq
      WHERE eq.organization_id = org_id
    ), '[]'::jsonb),
    'warehouse_stock', COALESCE((
      SELECT row_to_json(ws.*)::jsonb
      FROM warehouse_stock ws
      WHERE ws.organization_id = org_id
    ), '{}'::jsonb),
    'material_logs', COALESCE((
      SELECT jsonb_agg(row_to_json(ml.*)::jsonb ORDER BY ml.date DESC)
      FROM material_logs ml
      WHERE ml.organization_id = org_id
    ), '[]'::jsonb),
    'purchase_orders', COALESCE((
      SELECT jsonb_agg(row_to_json(po.*)::jsonb ORDER BY po.date DESC)
      FROM purchase_orders po
      WHERE po.organization_id = org_id
    ), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$;


-- ─── 5. HANDLE NEW USER TRIGGER ──────────────────────────────────────────────
-- Automatically creates an organization and profile when a new user signs up.
-- This is REQUIRED for the admin-crew link to function properly.
-- Without this trigger, admin signup creates the auth user but not the
-- profile/organization, causing organizationId to be empty and preventing
-- work orders from reaching the crew dashboard.

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org_id uuid;
  v_company_name text;
  v_role text;
  v_full_name text;
BEGIN
  v_company_name := COALESCE(NEW.raw_user_meta_data->>'company_name', NEW.email);
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'admin');
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');

  -- Create a new organization for this user
  INSERT INTO organizations (name, crew_pin)
  VALUES (v_company_name, '')
  RETURNING id INTO new_org_id;

  -- Create the profile linking user to organization
  INSERT INTO profiles (id, organization_id, role, full_name)
  VALUES (NEW.id, new_org_id, v_role, v_full_name);

  -- Create an empty warehouse_stock row for the organization
  INSERT INTO warehouse_stock (organization_id, open_cell_sets, closed_cell_sets)
  VALUES (new_org_id, 0, 0)
  ON CONFLICT (organization_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Create the trigger (drop first to be idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- ─── 6. GRANT EXECUTE TO ANON + AUTHENTICATED ──────────────────────────────
-- Required so the Supabase JS client can call these RPCs.
-- Crew uses anon key (no auth session), admin uses authenticated.

GRANT EXECUTE ON FUNCTION verify_crew_pin(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_crew_work_orders(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION crew_update_job(uuid, uuid, jsonb, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_org_data(uuid) TO anon, authenticated;


-- ─── 6. ADDITIONAL COLUMNS (if missing) ─────────────────────────────────────
-- The app writes these columns but the original schema may not have them.
-- These are safe to run even if columns already exist (uses IF NOT EXISTS).

DO $$
BEGIN
  -- estimates table extended columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='estimates' AND column_name='execution_status') THEN
    ALTER TABLE estimates ADD COLUMN execution_status text DEFAULT 'Not Started';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='estimates' AND column_name='date') THEN
    ALTER TABLE estimates ADD COLUMN date text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='estimates' AND column_name='total_value') THEN
    ALTER TABLE estimates ADD COLUMN total_value numeric DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='estimates' AND column_name='notes') THEN
    ALTER TABLE estimates ADD COLUMN notes text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='estimates' AND column_name='pricing_mode') THEN
    ALTER TABLE estimates ADD COLUMN pricing_mode text DEFAULT 'level_pricing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='estimates' AND column_name='scheduled_date') THEN
    ALTER TABLE estimates ADD COLUMN scheduled_date text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='estimates' AND column_name='invoice_date') THEN
    ALTER TABLE estimates ADD COLUMN invoice_date text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='estimates' AND column_name='invoice_number') THEN
    ALTER TABLE estimates ADD COLUMN invoice_number text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='estimates' AND column_name='payment_terms') THEN
    ALTER TABLE estimates ADD COLUMN payment_terms text DEFAULT 'Due on Receipt';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='estimates' AND column_name='wall_settings') THEN
    ALTER TABLE estimates ADD COLUMN wall_settings jsonb DEFAULT '{}'::jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='estimates' AND column_name='roof_settings') THEN
    ALTER TABLE estimates ADD COLUMN roof_settings jsonb DEFAULT '{}'::jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='estimates' AND column_name='expenses') THEN
    ALTER TABLE estimates ADD COLUMN expenses jsonb DEFAULT '{}'::jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='estimates' AND column_name='actuals') THEN
    ALTER TABLE estimates ADD COLUMN actuals jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='estimates' AND column_name='sq_ft_rates') THEN
    ALTER TABLE estimates ADD COLUMN sq_ft_rates jsonb DEFAULT '{"wall":0,"roof":0}'::jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='estimates' AND column_name='estimate_lines') THEN
    ALTER TABLE estimates ADD COLUMN estimate_lines jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='estimates' AND column_name='invoice_lines') THEN
    ALTER TABLE estimates ADD COLUMN invoice_lines jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='estimates' AND column_name='work_order_lines') THEN
    ALTER TABLE estimates ADD COLUMN work_order_lines jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='estimates' AND column_name='work_order_sheet_url') THEN
    ALTER TABLE estimates ADD COLUMN work_order_sheet_url text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='estimates' AND column_name='pdf_link') THEN
    ALTER TABLE estimates ADD COLUMN pdf_link text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='estimates' AND column_name='site_photos') THEN
    ALTER TABLE estimates ADD COLUMN site_photos jsonb DEFAULT '[]'::jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='estimates' AND column_name='inventory_processed') THEN
    ALTER TABLE estimates ADD COLUMN inventory_processed boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='estimates' AND column_name='last_modified') THEN
    ALTER TABLE estimates ADD COLUMN last_modified text;
  END IF;
END $$;


-- ─── 7. MISSING TABLES (if not created yet) ─────────────────────────────────

-- Equipment table
CREATE TABLE IF NOT EXISTS equipment (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid REFERENCES organizations(id),
  name text NOT NULL,
  status text DEFAULT 'Available',
  last_seen jsonb,
  created_at timestamptz DEFAULT now()
);

-- Warehouse stock table
CREATE TABLE IF NOT EXISTS warehouse_stock (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid REFERENCES organizations(id) UNIQUE,
  open_cell_sets numeric DEFAULT 0,
  closed_cell_sets numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Material logs table
CREATE TABLE IF NOT EXISTS material_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid REFERENCES organizations(id),
  date text,
  job_id text,
  customer_name text,
  material_name text NOT NULL,
  quantity numeric DEFAULT 0,
  unit text,
  logged_by text,
  log_type text DEFAULT 'estimated',
  created_at timestamptz DEFAULT now()
);

-- Purchase orders table
CREATE TABLE IF NOT EXISTS purchase_orders (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid REFERENCES organizations(id),
  date text,
  vendor_name text,
  status text DEFAULT 'Draft',
  items jsonb DEFAULT '[]'::jsonb,
  total_cost numeric DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Organizations extended columns
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='organizations' AND column_name='phone') THEN
    ALTER TABLE organizations ADD COLUMN phone text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='organizations' AND column_name='email') THEN
    ALTER TABLE organizations ADD COLUMN email text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='organizations' AND column_name='logo_url') THEN
    ALTER TABLE organizations ADD COLUMN logo_url text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='organizations' AND column_name='address') THEN
    ALTER TABLE organizations ADD COLUMN address jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;


-- ─── 8. RLS POLICIES FOR NEW TABLES ─────────────────────────────────────────

ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;

-- Admin full access policies (drop + recreate to be idempotent)
DROP POLICY IF EXISTS "Admin equipment access" ON equipment;
CREATE POLICY "Admin equipment access" ON equipment
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = equipment.organization_id
      AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admin warehouse_stock access" ON warehouse_stock;
CREATE POLICY "Admin warehouse_stock access" ON warehouse_stock
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = warehouse_stock.organization_id
      AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admin material_logs access" ON material_logs;
CREATE POLICY "Admin material_logs access" ON material_logs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = material_logs.organization_id
      AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admin purchase_orders access" ON purchase_orders;
CREATE POLICY "Admin purchase_orders access" ON purchase_orders
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = purchase_orders.organization_id
      AND profiles.role = 'admin'
    )
  );

-- Admin full access for estimates
DROP POLICY IF EXISTS "Admin estimates access" ON estimates;
CREATE POLICY "Admin estimates access" ON estimates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = estimates.organization_id
      AND profiles.role = 'admin'
    )
  );


-- ============================================================================
-- DONE! All RPC functions and supporting tables/columns are now in place.
-- The crew dashboard should now display work orders after refreshing the app.
-- ============================================================================
