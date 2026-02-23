-- ============================================================================
-- RLS Performance Fix: Wrap auth.uid() in SELECT subqueries
-- ============================================================================
-- Problem: Direct auth.uid() calls in USING/WITH CHECK expressions can be
-- re-evaluated per row. Wrapping in (SELECT auth.uid()) lets Postgres treat
-- the result as a stable constant for the entire statement.
--
-- Apply this migration in staging first, then production.
-- Run EXPLAIN ANALYZE on common queries before/after to verify improvement.
-- ============================================================================

BEGIN;

-- ─── 1. profiles: "Users can view own profile" ─────────────────────────────
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT TO authenticated USING ( (SELECT auth.uid()) = id );

-- ─── 2. organizations: "Admins can do everything" ──────────────────────────
DROP POLICY IF EXISTS "Admins can do everything" ON organizations;
CREATE POLICY "Admins can do everything" ON organizations
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.organization_id = organizations.id
      AND profiles.role = 'admin'
    )
  );

-- ─── 3. customers: Consolidate overlapping SELECT policies ─────────────────
-- Drop both old policies (they overlapped on SELECT for the same default role)
DROP POLICY IF EXISTS "Admins read/write customers" ON customers;
DROP POLICY IF EXISTS "Crew read customers" ON customers;

-- Single SELECT policy for authenticated (admin + crew)
CREATE POLICY "Authenticated read customers" ON customers
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.organization_id = customers.organization_id
      AND profiles.role IN ('admin', 'crew')
    )
  );

-- Write operations (INSERT/UPDATE/DELETE) remain admin-only
DROP POLICY IF EXISTS "Admins write customers" ON customers;
CREATE POLICY "Admins write customers" ON customers
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.organization_id = customers.organization_id
      AND profiles.role = 'admin'
    )
  );

-- ─── 5. documents: Consolidate overlapping SELECT policies ─────────────────
DROP POLICY IF EXISTS "Admins full access to documents" ON documents;
DROP POLICY IF EXISTS "Crew read documents" ON documents;

CREATE POLICY "Authenticated read documents" ON documents
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.organization_id = documents.organization_id
      AND profiles.role IN ('admin', 'crew')
    )
  );

DROP POLICY IF EXISTS "Admins write documents" ON documents;
CREATE POLICY "Admins write documents" ON documents
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.organization_id = documents.organization_id
      AND profiles.role = 'admin'
    )
  );

-- ─── 7. equipment: "Admin equipment access" ────────────────────────────────
DROP POLICY IF EXISTS "Admin equipment access" ON equipment;
CREATE POLICY "Admin equipment access" ON equipment
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.organization_id = equipment.organization_id
      AND profiles.role = 'admin'
    )
  );

-- ─── 8. warehouse_stock: "Admin warehouse_stock access" ────────────────────
DROP POLICY IF EXISTS "Admin warehouse_stock access" ON warehouse_stock;
CREATE POLICY "Admin warehouse_stock access" ON warehouse_stock
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.organization_id = warehouse_stock.organization_id
      AND profiles.role = 'admin'
    )
  );

-- ─── 9. material_logs: "Admin material_logs access" ────────────────────────
DROP POLICY IF EXISTS "Admin material_logs access" ON material_logs;
CREATE POLICY "Admin material_logs access" ON material_logs
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.organization_id = material_logs.organization_id
      AND profiles.role = 'admin'
    )
  );

-- ─── 10. purchase_orders: "Admin purchase_orders access" ───────────────────
DROP POLICY IF EXISTS "Admin purchase_orders access" ON purchase_orders;
CREATE POLICY "Admin purchase_orders access" ON purchase_orders
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.organization_id = purchase_orders.organization_id
      AND profiles.role = 'admin'
    )
  );

-- ─── 11. estimates: "Admin estimates access" ───────────────────────────────
DROP POLICY IF EXISTS "Admin estimates access" ON estimates;
CREATE POLICY "Admin estimates access" ON estimates
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.organization_id = estimates.organization_id
      AND profiles.role = 'admin'
    )
  );

-- ─── 12. maintenance_equipment: "Admin full access maintenance_equipment" ──
ALTER TABLE maintenance_equipment ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin full access maintenance_equipment" ON maintenance_equipment;
CREATE POLICY "Admin full access maintenance_equipment" ON maintenance_equipment
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.organization_id = maintenance_equipment.organization_id
      AND profiles.role = 'admin'
    )
  );

-- ─── 13. maintenance_service_items: "Admin full access maintenance_service_items"
ALTER TABLE maintenance_service_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin full access maintenance_service_items" ON maintenance_service_items;
CREATE POLICY "Admin full access maintenance_service_items" ON maintenance_service_items
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.organization_id = maintenance_service_items.organization_id
      AND profiles.role = 'admin'
    )
  );

-- ─── 14. maintenance_service_logs: "Admin full access maintenance_service_logs"
ALTER TABLE maintenance_service_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin full access maintenance_service_logs" ON maintenance_service_logs;
CREATE POLICY "Admin full access maintenance_service_logs" ON maintenance_service_logs
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.organization_id = maintenance_service_logs.organization_id
      AND profiles.role = 'admin'
    )
  );

-- ─── 15. maintenance_job_usage: "Admin full access maintenance_job_usage" ──
ALTER TABLE maintenance_job_usage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin full access maintenance_job_usage" ON maintenance_job_usage;
CREATE POLICY "Admin full access maintenance_job_usage" ON maintenance_job_usage
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.organization_id = maintenance_job_usage.organization_id
      AND profiles.role = 'admin'
    )
  );

COMMIT;

-- ============================================================================
-- Validation: Run these after applying the migration
-- ============================================================================
-- 1. Verify policies exist:
--    SELECT schemaname, tablename, policyname, cmd, qual
--    FROM pg_policies WHERE schemaname = 'public';
--
-- 2. Test admin can still query their own data:
--    SELECT * FROM customers LIMIT 5;
--    SELECT * FROM estimates LIMIT 5;
--
-- 3. Compare performance (run as authenticated user):
--    EXPLAIN ANALYZE SELECT * FROM customers;
--    EXPLAIN ANALYZE SELECT * FROM estimates;
--    EXPLAIN ANALYZE UPDATE profiles SET full_name = full_name WHERE id = auth.uid();
-- ============================================================================
