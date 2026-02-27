-- Migration 003: Security & Performance Fixes
-- Applied: 2026-02-27
-- 
-- Fixes applied:
-- 1. CRITICAL: Removed insecure anon INSERT policy on write_retry_queue (WITH CHECK true)
-- 2. Added missing indexes on unindexed foreign keys
-- 3. Consolidated overlapping permissive RLS policies (admin ALL + crew SELECT → separate per-action)
-- 4. Dropped 8 unused indexes
--
-- Remaining items (require Supabase Dashboard changes):
-- - Enable leaked password protection (Auth > Settings)
-- - Consider disabling anonymous sign-ins if not needed (Auth > Settings)

BEGIN;

-- ============================================================
-- FIX 1: Remove insecure anon INSERT policy on write_retry_queue
-- ============================================================
DROP POLICY IF EXISTS "Anon retry_queue insert" ON public.write_retry_queue;

-- ============================================================
-- FIX 2: Add missing indexes on foreign keys
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_purchase_orders_organization_id 
  ON public.purchase_orders (organization_id);

CREATE INDEX IF NOT EXISTS idx_write_retry_queue_organization_id 
  ON public.write_retry_queue (organization_id);

CREATE INDEX IF NOT EXISTS idx_maint_service_items_equipment_id 
  ON public.maintenance_service_items (equipment_id);

CREATE INDEX IF NOT EXISTS idx_maint_service_logs_equipment_id 
  ON public.maintenance_service_logs (equipment_id);

CREATE INDEX IF NOT EXISTS idx_maint_service_logs_service_item_id 
  ON public.maintenance_service_logs (service_item_id);

-- ============================================================
-- FIX 3: Consolidate multiple permissive policies
-- Split admin ALL into per-action policies, merge SELECT for admin+crew
-- ============================================================

-- customers
DROP POLICY IF EXISTS "Admins write customers" ON public.customers;
DROP POLICY IF EXISTS "Authenticated read customers" ON public.customers;

CREATE POLICY "Authenticated read customers" ON public.customers
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (SELECT auth.uid())
      AND profiles.organization_id = customers.organization_id
      AND profiles.role IN ('admin', 'crew')
  ));

CREATE POLICY "Admin write customers" ON public.customers
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (SELECT auth.uid())
      AND profiles.organization_id = customers.organization_id
      AND profiles.role = 'admin'
  ));

CREATE POLICY "Admin update customers" ON public.customers
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (SELECT auth.uid())
      AND profiles.organization_id = customers.organization_id
      AND profiles.role = 'admin'
  ));

CREATE POLICY "Admin delete customers" ON public.customers
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (SELECT auth.uid())
      AND profiles.organization_id = customers.organization_id
      AND profiles.role = 'admin'
  ));

-- documents
DROP POLICY IF EXISTS "Admins write documents" ON public.documents;
DROP POLICY IF EXISTS "Authenticated read documents" ON public.documents;

CREATE POLICY "Authenticated read documents" ON public.documents
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (SELECT auth.uid())
      AND profiles.organization_id = documents.organization_id
      AND profiles.role IN ('admin', 'crew')
  ));

CREATE POLICY "Admin insert documents" ON public.documents
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (SELECT auth.uid())
      AND profiles.organization_id = documents.organization_id
      AND profiles.role = 'admin'
  ));

CREATE POLICY "Admin update documents" ON public.documents
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (SELECT auth.uid())
      AND profiles.organization_id = documents.organization_id
      AND profiles.role = 'admin'
  ));

CREATE POLICY "Admin delete documents" ON public.documents
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (SELECT auth.uid())
      AND profiles.organization_id = documents.organization_id
      AND profiles.role = 'admin'
  ));

-- equipment
DROP POLICY IF EXISTS "Admin equipment access" ON public.equipment;
DROP POLICY IF EXISTS "Crew read equipment" ON public.equipment;
DROP POLICY IF EXISTS "Crew update equipment status" ON public.equipment;

CREATE POLICY "Authenticated read equipment" ON public.equipment
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (SELECT auth.uid())
      AND profiles.organization_id = equipment.organization_id
      AND profiles.role IN ('admin', 'crew')
  ));

CREATE POLICY "Authenticated update equipment" ON public.equipment
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (SELECT auth.uid())
      AND profiles.organization_id = equipment.organization_id
      AND profiles.role IN ('admin', 'crew')
  ));

CREATE POLICY "Admin insert equipment" ON public.equipment
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (SELECT auth.uid())
      AND profiles.organization_id = equipment.organization_id
      AND profiles.role = 'admin'
  ));

CREATE POLICY "Admin delete equipment" ON public.equipment
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (SELECT auth.uid())
      AND profiles.organization_id = equipment.organization_id
      AND profiles.role = 'admin'
  ));

-- estimates
DROP POLICY IF EXISTS "Admin estimates access" ON public.estimates;
DROP POLICY IF EXISTS "Crew read estimates" ON public.estimates;
DROP POLICY IF EXISTS "Crew update estimate actuals" ON public.estimates;

CREATE POLICY "Authenticated read estimates" ON public.estimates
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (SELECT auth.uid())
      AND profiles.organization_id = estimates.organization_id
      AND profiles.role IN ('admin', 'crew')
  ));

CREATE POLICY "Authenticated update estimates" ON public.estimates
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (SELECT auth.uid())
      AND profiles.organization_id = estimates.organization_id
      AND profiles.role IN ('admin', 'crew')
  ));

CREATE POLICY "Admin insert estimates" ON public.estimates
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (SELECT auth.uid())
      AND profiles.organization_id = estimates.organization_id
      AND profiles.role = 'admin'
  ));

CREATE POLICY "Admin delete estimates" ON public.estimates
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (SELECT auth.uid())
      AND profiles.organization_id = estimates.organization_id
      AND profiles.role = 'admin'
  ));

-- inventory_items
DROP POLICY IF EXISTS "Admins full access inventory" ON public.inventory_items;
DROP POLICY IF EXISTS "Crew read inventory" ON public.inventory_items;

CREATE POLICY "Authenticated read inventory" ON public.inventory_items
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (SELECT auth.uid())
      AND profiles.organization_id = inventory_items.organization_id
      AND profiles.role IN ('admin', 'crew')
  ));

CREATE POLICY "Admin insert inventory" ON public.inventory_items
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (SELECT auth.uid())
      AND profiles.organization_id = inventory_items.organization_id
      AND profiles.role = 'admin'
  ));

CREATE POLICY "Admin update inventory" ON public.inventory_items
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (SELECT auth.uid())
      AND profiles.organization_id = inventory_items.organization_id
      AND profiles.role = 'admin'
  ));

CREATE POLICY "Admin delete inventory" ON public.inventory_items
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (SELECT auth.uid())
      AND profiles.organization_id = inventory_items.organization_id
      AND profiles.role = 'admin'
  ));

-- maintenance_equipment
DROP POLICY IF EXISTS "Admin full access maintenance_equipment" ON public.maintenance_equipment;
DROP POLICY IF EXISTS "Crew read maintenance_equipment" ON public.maintenance_equipment;

CREATE POLICY "Authenticated read maintenance_equipment" ON public.maintenance_equipment
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (SELECT auth.uid())
      AND profiles.organization_id = maintenance_equipment.organization_id
      AND profiles.role IN ('admin', 'crew')
  ));

CREATE POLICY "Admin insert maintenance_equipment" ON public.maintenance_equipment
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (SELECT auth.uid())
      AND profiles.organization_id = maintenance_equipment.organization_id
      AND profiles.role = 'admin'
  ));

CREATE POLICY "Admin update maintenance_equipment" ON public.maintenance_equipment
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (SELECT auth.uid())
      AND profiles.organization_id = maintenance_equipment.organization_id
      AND profiles.role = 'admin'
  ));

CREATE POLICY "Admin delete maintenance_equipment" ON public.maintenance_equipment
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (SELECT auth.uid())
      AND profiles.organization_id = maintenance_equipment.organization_id
      AND profiles.role = 'admin'
  ));

-- maintenance_job_usage
DROP POLICY IF EXISTS "Admin full access maintenance_job_usage" ON public.maintenance_job_usage;
DROP POLICY IF EXISTS "Crew read maintenance_job_usage" ON public.maintenance_job_usage;

CREATE POLICY "Authenticated read maintenance_job_usage" ON public.maintenance_job_usage
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (SELECT auth.uid())
      AND profiles.organization_id = maintenance_job_usage.organization_id
      AND profiles.role IN ('admin', 'crew')
  ));

CREATE POLICY "Admin insert maintenance_job_usage" ON public.maintenance_job_usage
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (SELECT auth.uid())
      AND profiles.organization_id = maintenance_job_usage.organization_id
      AND profiles.role = 'admin'
  ));

CREATE POLICY "Admin update maintenance_job_usage" ON public.maintenance_job_usage
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (SELECT auth.uid())
      AND profiles.organization_id = maintenance_job_usage.organization_id
      AND profiles.role = 'admin'
  ));

CREATE POLICY "Admin delete maintenance_job_usage" ON public.maintenance_job_usage
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (SELECT auth.uid())
      AND profiles.organization_id = maintenance_job_usage.organization_id
      AND profiles.role = 'admin'
  ));

-- maintenance_service_items
DROP POLICY IF EXISTS "Admin full access maintenance_service_items" ON public.maintenance_service_items;
DROP POLICY IF EXISTS "Crew read maintenance_service_items" ON public.maintenance_service_items;

CREATE POLICY "Authenticated read maintenance_service_items" ON public.maintenance_service_items
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (SELECT auth.uid())
      AND profiles.organization_id = maintenance_service_items.organization_id
      AND profiles.role IN ('admin', 'crew')
  ));

CREATE POLICY "Admin insert maintenance_service_items" ON public.maintenance_service_items
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (SELECT auth.uid())
      AND profiles.organization_id = maintenance_service_items.organization_id
      AND profiles.role = 'admin'
  ));

CREATE POLICY "Admin update maintenance_service_items" ON public.maintenance_service_items
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (SELECT auth.uid())
      AND profiles.organization_id = maintenance_service_items.organization_id
      AND profiles.role = 'admin'
  ));

CREATE POLICY "Admin delete maintenance_service_items" ON public.maintenance_service_items
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (SELECT auth.uid())
      AND profiles.organization_id = maintenance_service_items.organization_id
      AND profiles.role = 'admin'
  ));

-- maintenance_service_logs
DROP POLICY IF EXISTS "Admin full access maintenance_service_logs" ON public.maintenance_service_logs;
DROP POLICY IF EXISTS "Crew read maintenance_service_logs" ON public.maintenance_service_logs;

CREATE POLICY "Authenticated read maintenance_service_logs" ON public.maintenance_service_logs
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (SELECT auth.uid())
      AND profiles.organization_id = maintenance_service_logs.organization_id
      AND profiles.role IN ('admin', 'crew')
  ));

CREATE POLICY "Admin insert maintenance_service_logs" ON public.maintenance_service_logs
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (SELECT auth.uid())
      AND profiles.organization_id = maintenance_service_logs.organization_id
      AND profiles.role = 'admin'
  ));

CREATE POLICY "Admin update maintenance_service_logs" ON public.maintenance_service_logs
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (SELECT auth.uid())
      AND profiles.organization_id = maintenance_service_logs.organization_id
      AND profiles.role = 'admin'
  ));

CREATE POLICY "Admin delete maintenance_service_logs" ON public.maintenance_service_logs
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (SELECT auth.uid())
      AND profiles.organization_id = maintenance_service_logs.organization_id
      AND profiles.role = 'admin'
  ));

-- material_logs
DROP POLICY IF EXISTS "Admin material_logs access" ON public.material_logs;
DROP POLICY IF EXISTS "Crew read material_logs" ON public.material_logs;
DROP POLICY IF EXISTS "Crew insert material_logs" ON public.material_logs;

CREATE POLICY "Authenticated read material_logs" ON public.material_logs
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (SELECT auth.uid())
      AND profiles.organization_id = material_logs.organization_id
      AND profiles.role IN ('admin', 'crew')
  ));

CREATE POLICY "Authenticated insert material_logs" ON public.material_logs
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (SELECT auth.uid())
      AND profiles.organization_id = material_logs.organization_id
      AND profiles.role IN ('admin', 'crew')
  ));

CREATE POLICY "Admin update material_logs" ON public.material_logs
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (SELECT auth.uid())
      AND profiles.organization_id = material_logs.organization_id
      AND profiles.role = 'admin'
  ));

CREATE POLICY "Admin delete material_logs" ON public.material_logs
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (SELECT auth.uid())
      AND profiles.organization_id = material_logs.organization_id
      AND profiles.role = 'admin'
  ));

-- organizations
DROP POLICY IF EXISTS "Admins can do everything" ON public.organizations;
DROP POLICY IF EXISTS "Authenticated read own organization" ON public.organizations;

CREATE POLICY "Authenticated read own organization" ON public.organizations
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (SELECT auth.uid())
      AND profiles.organization_id = organizations.id
  ));

CREATE POLICY "Admin insert organization" ON public.organizations
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (SELECT auth.uid())
      AND profiles.organization_id = organizations.id
      AND profiles.role = 'admin'
  ));

CREATE POLICY "Admin update organization" ON public.organizations
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (SELECT auth.uid())
      AND profiles.organization_id = organizations.id
      AND profiles.role = 'admin'
  ));

CREATE POLICY "Admin delete organization" ON public.organizations
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (SELECT auth.uid())
      AND profiles.organization_id = organizations.id
      AND profiles.role = 'admin'
  ));

-- profiles
DROP POLICY IF EXISTS "Admins manage org profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Authenticated read profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    (SELECT auth.uid()) = id 
    OR is_org_admin(organization_id)
  );

CREATE POLICY "Authenticated update profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    (SELECT auth.uid()) = id 
    OR is_org_admin(organization_id)
  )
  WITH CHECK (
    (SELECT auth.uid()) = id 
    OR is_org_admin(organization_id)
  );

CREATE POLICY "Admin insert profiles" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = id 
    OR is_org_admin(organization_id)
  );

CREATE POLICY "Admin delete profiles" ON public.profiles
  FOR DELETE TO authenticated
  USING (is_org_admin(organization_id));

-- warehouse_stock
DROP POLICY IF EXISTS "Admin warehouse_stock access" ON public.warehouse_stock;
DROP POLICY IF EXISTS "Crew read warehouse_stock" ON public.warehouse_stock;

CREATE POLICY "Authenticated read warehouse_stock" ON public.warehouse_stock
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (SELECT auth.uid())
      AND profiles.organization_id = warehouse_stock.organization_id
      AND profiles.role IN ('admin', 'crew')
  ));

CREATE POLICY "Admin insert warehouse_stock" ON public.warehouse_stock
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (SELECT auth.uid())
      AND profiles.organization_id = warehouse_stock.organization_id
      AND profiles.role = 'admin'
  ));

CREATE POLICY "Admin update warehouse_stock" ON public.warehouse_stock
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (SELECT auth.uid())
      AND profiles.organization_id = warehouse_stock.organization_id
      AND profiles.role = 'admin'
  ));

CREATE POLICY "Admin delete warehouse_stock" ON public.warehouse_stock
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (SELECT auth.uid())
      AND profiles.organization_id = warehouse_stock.organization_id
      AND profiles.role = 'admin'
  ));

-- ============================================================
-- FIX 4: Drop unused indexes
-- ============================================================
DROP INDEX IF EXISTS public.idx_maint_logs_service_item;
DROP INDEX IF EXISTS public.idx_subscriptions_status;
DROP INDEX IF EXISTS public.idx_retry_queue_pending;
DROP INDEX IF EXISTS public.idx_retry_queue_completed;
DROP INDEX IF EXISTS public.idx_documents_type;
DROP INDEX IF EXISTS public.idx_documents_created;
DROP INDEX IF EXISTS public.idx_maint_items_equip;
DROP INDEX IF EXISTS public.idx_maint_logs_equip;

COMMIT;
