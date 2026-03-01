-- ============================================================================
-- RR FOAM PRO — Row Level Security Migration
-- ============================================================================
-- Scope: HIGH-RISK tables (customers, estimates, warehouse_items, purchase_orders)
-- Pattern: auth.uid() → users table → organization_id tenant isolation
--
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ============================================================================

-- ─── HELPER FUNCTIONS ───────────────────────────────────────────────────────
-- DRY up RLS predicates: every policy just calls user_org_id() instead of
-- repeating a 5-line subquery. Marked STABLE + SECURITY DEFINER so they
-- execute with elevated privileges but are inlined by the query planner.

-- Returns the organization_id for the currently authenticated Supabase user.
CREATE OR REPLACE FUNCTION public.user_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id
  FROM users
  WHERE id = (SELECT auth.uid()::text)
  LIMIT 1;
$$;

-- Returns 'admin' or 'crew' for the currently authenticated user.
CREATE OR REPLACE FUNCTION public.user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text
  FROM users
  WHERE id = (SELECT auth.uid()::text)
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.user_org_id IS 'RLS helper: returns the callers organization_id from users table';
COMMENT ON FUNCTION public.user_role IS 'RLS helper: returns the callers role (admin/crew) from users table';


-- ─── COVERING INDEX FOR RLS PERFORMANCE ─────────────────────────────────────
-- Every RLS policy joins through the users table. This index covers all
-- three columns the subqueries need, preventing per-row index lookups.

CREATE INDEX IF NOT EXISTS idx_users_id_org_role
  ON users (id, organization_id, role);


-- ============================================================================
-- 1. CUSTOMERS — Admin full access, Crew read-only
-- ============================================================================

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers FORCE ROW LEVEL SECURITY;

-- Drop any existing policies (idempotent re-runs)
DROP POLICY IF EXISTS "rls_customers_admin_all" ON customers;
DROP POLICY IF EXISTS "rls_customers_crew_select" ON customers;

-- Admin: full CRUD scoped to their organization
CREATE POLICY "rls_customers_admin_all" ON customers
  FOR ALL
  TO authenticated
  USING (
    organization_id = public.user_org_id()
    AND public.user_role() = 'admin'
  )
  WITH CHECK (
    organization_id = public.user_org_id()
    AND public.user_role() = 'admin'
  );

-- Crew: read-only access to their org's customers (needed for work order display)
CREATE POLICY "rls_customers_crew_select" ON customers
  FOR SELECT
  TO authenticated
  USING (
    organization_id = public.user_org_id()
    AND public.user_role() IN ('admin', 'crew')
  );


-- ============================================================================
-- 2. ESTIMATES — Admin full access, Crew limited read + update
-- ============================================================================

ALTER TABLE estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimates FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rls_estimates_admin_all" ON estimates;
DROP POLICY IF EXISTS "rls_estimates_crew_select" ON estimates;
DROP POLICY IF EXISTS "rls_estimates_crew_update" ON estimates;

-- Admin: full CRUD on all org estimates
CREATE POLICY "rls_estimates_admin_all" ON estimates
  FOR ALL
  TO authenticated
  USING (
    organization_id = public.user_org_id()
    AND public.user_role() = 'admin'
  )
  WITH CHECK (
    organization_id = public.user_org_id()
    AND public.user_role() = 'admin'
  );

-- Crew: can only SELECT work orders (not Drafts, Invoiced, Paid, Archived)
CREATE POLICY "rls_estimates_crew_select" ON estimates
  FOR SELECT
  TO authenticated
  USING (
    organization_id = public.user_org_id()
    AND public.user_role() IN ('admin', 'crew')
    AND (
      public.user_role() = 'admin'
      OR status = 'Work Order'
    )
  );

-- Crew: can UPDATE work orders (actuals, execution_status) but not change org
CREATE POLICY "rls_estimates_crew_update" ON estimates
  FOR UPDATE
  TO authenticated
  USING (
    organization_id = public.user_org_id()
    AND public.user_role() = 'crew'
    AND status = 'Work Order'
  )
  WITH CHECK (
    organization_id = public.user_org_id()
  );


-- ============================================================================
-- 3. WAREHOUSE_ITEMS — Admin full access, Crew read-only
-- ============================================================================

ALTER TABLE warehouse_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_items FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rls_warehouse_items_admin_all" ON warehouse_items;
DROP POLICY IF EXISTS "rls_warehouse_items_crew_select" ON warehouse_items;

-- Admin: full CRUD
CREATE POLICY "rls_warehouse_items_admin_all" ON warehouse_items
  FOR ALL
  TO authenticated
  USING (
    organization_id = public.user_org_id()
    AND public.user_role() = 'admin'
  )
  WITH CHECK (
    organization_id = public.user_org_id()
    AND public.user_role() = 'admin'
  );

-- Crew: read-only (view inventory levels on tablet)
-- Crew inventory mutations route through SECURITY DEFINER RPCs (crew_update_job)
CREATE POLICY "rls_warehouse_items_crew_select" ON warehouse_items
  FOR SELECT
  TO authenticated
  USING (
    organization_id = public.user_org_id()
    AND public.user_role() IN ('admin', 'crew')
  );


-- ============================================================================
-- 4. PURCHASE_ORDERS — Admin only
-- ============================================================================

ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rls_purchase_orders_admin_all" ON purchase_orders;

-- Admin: full CRUD, no crew access
CREATE POLICY "rls_purchase_orders_admin_all" ON purchase_orders
  FOR ALL
  TO authenticated
  USING (
    organization_id = public.user_org_id()
    AND public.user_role() = 'admin'
  )
  WITH CHECK (
    organization_id = public.user_org_id()
    AND public.user_role() = 'admin'
  );


-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- After running this migration, verify RLS is active on all 4 tables:
--
--   SELECT tablename, rowsecurity, forcerowsecurity
--   FROM pg_tables
--   WHERE schemaname = 'public'
--     AND tablename IN ('customers', 'estimates', 'warehouse_items', 'purchase_orders');
--
-- Expected: rowsecurity = true, forcerowsecurity = true for all 4 rows.
--
-- Test isolation:
--   SET LOCAL role = 'authenticated';
--   SET LOCAL request.jwt.claims = '{"sub":"<user-uuid>"}';
--   SELECT * FROM customers;  -- Should only return that user's org rows
-- ============================================================================
