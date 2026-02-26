-- ============================================================================
-- 002_backend_overhaul.sql
-- RR FOAM PRO — Backend Overhaul Migration
-- ============================================================================
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
--
-- What this does:
--   1. Adds missing columns to core tables
--   2. Creates critical indexes for RLS + query performance
--   3. Adds batch upsert RPCs (customers, inventory)
--   4. Adds missing tables (warehouse_stock, equipment, material_logs, etc.)
--   5. Creates server-side retry queue table
-- ============================================================================

-- ─── 1. MISSING COLUMNS ─────────────────────────────────────────────────────

-- Organizations: add address/contact fields (used by updateCompanyProfile)
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS address jsonb DEFAULT '{}'::jsonb;

-- Estimates: add actuals, execution tracking, and inventory processing
ALTER TABLE estimates
  ADD COLUMN IF NOT EXISTS actuals jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS execution_status text DEFAULT 'Not Started',
  ADD COLUMN IF NOT EXISTS inventory_processed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS payment_date timestamp with time zone,
  ADD COLUMN IF NOT EXISTS last_modified timestamp with time zone DEFAULT timezone('utc'::text, now());


-- ─── 2. MISSING TABLES ──────────────────────────────────────────────────────

-- Warehouse stock (foam sets per org)
CREATE TABLE IF NOT EXISTS warehouse_stock (
  organization_id uuid PRIMARY KEY REFERENCES organizations(id),
  open_cell_sets numeric DEFAULT 0,
  closed_cell_sets numeric DEFAULT 0,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- Equipment tracker
CREATE TABLE IF NOT EXISTS equipment (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid REFERENCES organizations(id),
  name text NOT NULL,
  status text DEFAULT 'Available',
  last_seen jsonb,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- Material usage logs
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
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- Purchase orders
CREATE TABLE IF NOT EXISTS purchase_orders (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid REFERENCES organizations(id),
  date text,
  vendor_name text,
  status text DEFAULT 'Draft',
  items jsonb DEFAULT '[]'::jsonb,
  total_cost numeric DEFAULT 0,
  notes text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- Server-side retry queue (for failed writes)
CREATE TABLE IF NOT EXISTS server_retry_queue (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid REFERENCES organizations(id) NOT NULL,
  target_table text NOT NULL,
  operation text NOT NULL CHECK (operation IN ('insert','update','upsert','delete')),
  payload jsonb NOT NULL,
  conflict_key text DEFAULT 'id',
  error_message text,
  retry_count integer DEFAULT 0,
  max_retries integer DEFAULT 5,
  status text DEFAULT 'pending' CHECK (status IN ('pending','processing','done','failed')),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  processed_at timestamp with time zone
);


-- ─── 3. ENABLE RLS ON NEW TABLES ────────────────────────────────────────────

ALTER TABLE warehouse_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE server_retry_queue ENABLE ROW LEVEL SECURITY;

-- RLS policies for new tables (admin-only for writes, org-scoped reads)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin access warehouse_stock') THEN
    CREATE POLICY "Admin access warehouse_stock" ON warehouse_stock
      FOR ALL TO authenticated USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = (SELECT auth.uid())
          AND profiles.organization_id = warehouse_stock.organization_id
          AND profiles.role = 'admin'
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin access equipment') THEN
    CREATE POLICY "Admin access equipment" ON equipment
      FOR ALL TO authenticated USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = (SELECT auth.uid())
          AND profiles.organization_id = equipment.organization_id
          AND profiles.role = 'admin'
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin access material_logs') THEN
    CREATE POLICY "Admin access material_logs" ON material_logs
      FOR ALL TO authenticated USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = (SELECT auth.uid())
          AND profiles.organization_id = material_logs.organization_id
          AND profiles.role = 'admin'
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin access purchase_orders') THEN
    CREATE POLICY "Admin access purchase_orders" ON purchase_orders
      FOR ALL TO authenticated USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = (SELECT auth.uid())
          AND profiles.organization_id = purchase_orders.organization_id
          AND profiles.role = 'admin'
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin access server_retry_queue') THEN
    CREATE POLICY "Admin access server_retry_queue" ON server_retry_queue
      FOR ALL TO authenticated USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = (SELECT auth.uid())
          AND profiles.organization_id = server_retry_queue.organization_id
          AND profiles.role = 'admin'
        )
      );
  END IF;
END $$;


-- ─── 4. CRITICAL INDEXES (Supabase best practices) ─────────────────────────
-- Every table filtered by organization_id needs an index for RLS subqueries.
-- Without these, every RLS policy check does a full table scan on profiles.

-- Profiles: RLS subqueries JOIN on (id, organization_id, role) constantly
CREATE INDEX IF NOT EXISTS idx_profiles_org_role
  ON profiles (organization_id, role);

-- Core tables: organization_id is in every WHERE clause
CREATE INDEX IF NOT EXISTS idx_customers_org
  ON customers (organization_id);

CREATE INDEX IF NOT EXISTS idx_estimates_org
  ON estimates (organization_id);

CREATE INDEX IF NOT EXISTS idx_estimates_org_status
  ON estimates (organization_id, status);

CREATE INDEX IF NOT EXISTS idx_estimates_customer
  ON estimates (customer_id);

CREATE INDEX IF NOT EXISTS idx_inventory_items_org
  ON inventory_items (organization_id);

CREATE INDEX IF NOT EXISTS idx_equipment_org
  ON equipment (organization_id);

CREATE INDEX IF NOT EXISTS idx_material_logs_org
  ON material_logs (organization_id);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_org
  ON purchase_orders (organization_id);

-- Server retry queue: filter by org + status during processing
CREATE INDEX IF NOT EXISTS idx_retry_queue_org_status
  ON server_retry_queue (organization_id, status)
  WHERE status = 'pending';

-- Maintenance tables (if not already indexed)
CREATE INDEX IF NOT EXISTS idx_maint_equipment_org
  ON maintenance_equipment (organization_id);

CREATE INDEX IF NOT EXISTS idx_maint_service_items_equipment
  ON maintenance_service_items (equipment_id);

CREATE INDEX IF NOT EXISTS idx_maint_service_items_org
  ON maintenance_service_items (organization_id);

CREATE INDEX IF NOT EXISTS idx_maint_service_logs_org
  ON maintenance_service_logs (organization_id);

CREATE INDEX IF NOT EXISTS idx_maint_service_logs_equipment
  ON maintenance_service_logs (equipment_id);

CREATE INDEX IF NOT EXISTS idx_maint_job_usage_org
  ON maintenance_job_usage (organization_id);

CREATE INDEX IF NOT EXISTS idx_maint_job_usage_estimate
  ON maintenance_job_usage (estimate_id);


-- ─── 5. BATCH UPSERT RPCs ──────────────────────────────────────────────────
-- These reduce N+1 round trips to single RPC calls for bulk sync.

-- Batch upsert customers
DROP FUNCTION IF EXISTS batch_upsert_customers(uuid, jsonb);
CREATE OR REPLACE FUNCTION batch_upsert_customers(p_org_id uuid, p_customers jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item jsonb;
  result jsonb := '[]'::jsonb;
  upserted record;
BEGIN
  FOR item IN SELECT jsonb_array_elements(p_customers)
  LOOP
    INSERT INTO customers (
      id, organization_id, name, address, city, state, zip, email, phone, status, notes
    ) VALUES (
      COALESCE((item->>'id')::uuid, uuid_generate_v4()),
      p_org_id,
      COALESCE(item->>'name', ''),
      item->>'address',
      item->>'city',
      item->>'state',
      item->>'zip',
      item->>'email',
      item->>'phone',
      COALESCE(item->>'status', 'Active'),
      item->>'notes'
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      address = EXCLUDED.address,
      city = EXCLUDED.city,
      state = EXCLUDED.state,
      zip = EXCLUDED.zip,
      email = EXCLUDED.email,
      phone = EXCLUDED.phone,
      status = EXCLUDED.status,
      notes = EXCLUDED.notes
    RETURNING * INTO upserted;

    result := result || jsonb_build_array(row_to_json(upserted)::jsonb);
  END LOOP;

  RETURN result;
END;
$$;


-- Batch upsert inventory items
DROP FUNCTION IF EXISTS batch_upsert_inventory(uuid, jsonb);
CREATE OR REPLACE FUNCTION batch_upsert_inventory(p_org_id uuid, p_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item jsonb;
  result jsonb := '[]'::jsonb;
  upserted record;
  item_id uuid;
BEGIN
  FOR item IN SELECT jsonb_array_elements(p_items)
  LOOP
    -- Use provided ID if valid UUID, otherwise generate new
    item_id := CASE
      WHEN item->>'id' IS NOT NULL
        AND item->>'id' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN (item->>'id')::uuid
      ELSE uuid_generate_v4()
    END;

    INSERT INTO inventory_items (
      id, organization_id, name, quantity, unit, unit_cost, category
    ) VALUES (
      item_id,
      p_org_id,
      COALESCE(item->>'name', ''),
      COALESCE((item->>'quantity')::numeric, 0),
      item->>'unit',
      COALESCE((item->>'unit_cost')::numeric, 0),
      COALESCE(item->>'category', 'material')
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      quantity = EXCLUDED.quantity,
      unit = EXCLUDED.unit,
      unit_cost = EXCLUDED.unit_cost,
      category = EXCLUDED.category
    RETURNING * INTO upserted;

    result := result || jsonb_build_array(row_to_json(upserted)::jsonb);
  END LOOP;

  RETURN result;
END;
$$;


-- ─── 6. ENQUEUE FAILED WRITE RPC ───────────────────────────────────────────
-- Called from client when a write fails after retries.
-- Stores it server-side for later processing.

DROP FUNCTION IF EXISTS enqueue_failed_write(uuid, text, text, jsonb, text, text);
CREATE OR REPLACE FUNCTION enqueue_failed_write(
  p_org_id uuid,
  p_table text,
  p_operation text,
  p_payload jsonb,
  p_conflict_key text DEFAULT 'id',
  p_error text DEFAULT ''
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid;
BEGIN
  INSERT INTO server_retry_queue (
    organization_id, target_table, operation, payload, conflict_key, error_message
  ) VALUES (
    p_org_id, p_table, p_operation, p_payload, p_conflict_key, p_error
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;


-- ─── 7. UPDATE get_org_data TO INCLUDE NEW TABLES ───────────────────────────
-- Overwrites the existing get_org_data RPC to also return equipment,
-- warehouse_stock, material_logs, and purchase_orders in a single call.

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
      SELECT jsonb_agg(row_to_json(c.*)::jsonb ORDER BY c.name)
      FROM customers c
      WHERE c.organization_id = org_id
    ), '[]'::jsonb),
    'estimates', COALESCE((
      SELECT jsonb_agg(row_to_json(e.*)::jsonb ORDER BY e.created_at DESC)
      FROM estimates e
      WHERE e.organization_id = org_id
    ), '[]'::jsonb),
    'inventory_items', COALESCE((
      SELECT jsonb_agg(row_to_json(i.*)::jsonb ORDER BY i.name)
      FROM inventory_items i
      WHERE i.organization_id = org_id
    ), '[]'::jsonb),
    'equipment', COALESCE((
      SELECT jsonb_agg(row_to_json(eq.*)::jsonb ORDER BY eq.name)
      FROM equipment eq
      WHERE eq.organization_id = org_id
    ), '[]'::jsonb),
    'warehouse_stock', (
      SELECT row_to_json(ws.*)::jsonb
      FROM warehouse_stock ws
      WHERE ws.organization_id = org_id
    ),
    'material_logs', COALESCE((
      SELECT jsonb_agg(row_to_json(ml.*)::jsonb ORDER BY ml.created_at DESC)
      FROM material_logs ml
      WHERE ml.organization_id = org_id
    ), '[]'::jsonb),
    'purchase_orders', COALESCE((
      SELECT jsonb_agg(row_to_json(po.*)::jsonb ORDER BY po.created_at DESC)
      FROM purchase_orders po
      WHERE po.organization_id = org_id
    ), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$;


-- ─── 8. GRANT EXECUTE TO anon + authenticated ──────────────────────────────
-- Required for crew (anon) and admin (authenticated) to call RPCs.

GRANT EXECUTE ON FUNCTION verify_crew_pin(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_crew_work_orders(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION crew_update_job(uuid, uuid, jsonb, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_org_data(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION batch_upsert_customers(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION batch_upsert_inventory(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION enqueue_failed_write(uuid, text, text, jsonb, text, text) TO anon, authenticated;
