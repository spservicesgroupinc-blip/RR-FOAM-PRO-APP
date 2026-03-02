-- migrations/002_implement_rls_policies.sql

-- ─── HELPER FUNCTION ────────────────────────────────────────────────────────
-- Helper function to securely get the organization ID from the session variable.
CREATE OR REPLACE FUNCTION auth.get_current_organization_id()
RETURNS uuid AS $$
DECLARE
  org_id uuid;
BEGIN
  -- Use a try-catch block to handle cases where the setting is not set or is not a valid UUID.
  -- Return null in those cases so queries that don't rely on RLS can still function.
  SELECT (current_setting('app.current_organization_id', true))::uuid INTO org_id;
  RETURN org_id;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ─── RLS POLICIES ───────────────────────────────────────────────────────────
-- This script enables RLS and creates policies for all tables with an organization_id.
-- The policy ensures that users can only access data belonging to their own organization.

-- Macro to simplify policy creation
-- DO $$
-- DECLARE
--   table_name TEXT;
--   tables TEXT[] := ARRAY[
--     'company_profiles', 'users', 'customers', 'estimates', 'warehouse_items',
--     'equipment', 'material_usage_logs', 'purchase_orders', 'crew_messages',
--     'maintenance_equipment', 'maintenance_service_items', 'maintenance_service_logs',
--     'maintenance_job_usage'
--   ];
-- BEGIN
--   FOREACH table_name IN ARRAY tables
--   LOOP
--     EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', table_name);
--     EXECUTE format('DROP POLICY IF EXISTS "Allow full access based on organization_id" ON public.%I;', table_name);
--     EXECUTE format('
--       CREATE POLICY "Allow full access based on organization_id"
--       ON public.%I
--       FOR ALL
--       USING (organization_id = auth.get_current_organization_id())
--       WITH CHECK (organization_id = auth.get_current_organization_id());
--     ', table_name, table_name);
--     RAISE NOTICE 'Created RLS policy for %', table_name;
--   END LOOP;
-- END $$;

-- Explicit policy creation for each table for clarity and easier debugging.

-- Table: company_profiles
ALTER TABLE public.company_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow full access based on organization_id" ON public.company_profiles;
CREATE POLICY "Allow full access based on organization_id"
ON public.company_profiles FOR ALL
USING (organization_id = auth.get_current_organization_id())
WITH CHECK (organization_id = auth.get_current_organization_id());

-- Table: users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow full access based on organization_id" ON public.users;
CREATE POLICY "Allow full access based on organization_id"
ON public.users FOR ALL
USING (organization_id = auth.get_current_organization_id())
WITH CHECK (organization_id = auth.get_current_organization_id());

-- Table: customers
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow full access based on organization_id" ON public.customers;
CREATE POLICY "Allow full access based on organization_id"
ON public.customers FOR ALL
USING (organization_id = auth.get_current_organization_id())
WITH CHECK (organization_id = auth.get_current_organization_id());

-- Table: estimates
ALTER TABLE public.estimates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow full access based on organization_id" ON public.estimates;
CREATE POLICY "Allow full access based on organization_id"
ON public.estimates FOR ALL
USING (organization_id = auth.get_current_organization_id())
WITH CHECK (organization_id = auth.get_current_organization_id());

-- Table: warehouse_items
ALTER TABLE public.warehouse_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow full access based on organization_id" ON public.warehouse_items;
CREATE POLICY "Allow full access based on organization_id"
ON public.warehouse_items FOR ALL
USING (organization_id = auth.get_current_organization_id())
WITH CHECK (organization_id = auth.get_current_organization_id());

-- Table: equipment
ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow full access based on organization_id" ON public.equipment;
CREATE POLICY "Allow full access based on organization_id"
ON public.equipment FOR ALL
USING (organization_id = auth.get_current_organization_id())
WITH CHECK (organization_id = auth.get_current_organization_id());

-- Table: material_usage_logs
ALTER TABLE public.material_usage_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow full access based on organization_id" ON public.material_usage_logs;
CREATE POLICY "Allow full access based on organization_id"
ON public.material_usage_logs FOR ALL
USING (organization_id = auth.get_current_organization_id())
WITH CHECK (organization_id = auth.get_current_organization_id());

-- Table: purchase_orders
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow full access based on organization_id" ON public.purchase_orders;
CREATE POLICY "Allow full access based on organization_id"
ON public.purchase_orders FOR ALL
USING (organization_id = auth.get_current_organization_id())
WITH CHECK (organization_id = auth.get_current_organization_id());

-- Table: crew_messages
ALTER TABLE public.crew_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow full access based on organization_id" ON public.crew_messages;
CREATE POLICY "Allow full access based on organization_id"
ON public.crew_messages FOR ALL
USING (organization_id = auth.get_current_organization_id())
WITH CHECK (organization_id = auth.get_current_organization_id());

-- Table: maintenance_equipment
ALTER TABLE public.maintenance_equipment ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow full access based on organization_id" ON public.maintenance_equipment;
CREATE POLICY "Allow full access based on organization_id"
ON public.maintenance_equipment FOR ALL
USING (organization_id = auth.get_current_organization_id())
WITH CHECK (organization_id = auth.get_current_organization_id());

-- Table: maintenance_service_items
-- Note: This table joins through equipment, but for simplicity we assume a direct organization_id might be added
-- or the policy can be more complex. Assuming organization_id exists for this policy.
ALTER TABLE public.maintenance_service_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow full access based on organization_id" ON public.maintenance_service_items;
CREATE POLICY "Allow full access based on organization_id"
ON public.maintenance_service_items FOR ALL
USING (organization_id = auth.get_current_organization_id())
WITH CHECK (organization_id = auth.get_current_organization_id());

-- Table: maintenance_service_logs
ALTER TABLE public.maintenance_service_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow full access based on organization_id" ON public.maintenance_service_logs;
CREATE POLICY "Allow full access based on organization_id"
ON public.maintenance_service_logs FOR ALL
USING (organization_id = auth.get_current_organization_id())
WITH CHECK (organization_id = auth.get_current_organization_id());

-- Table: maintenance_job_usage
ALTER TABLE public.maintenance_job_usage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow full access based on organization_id" ON public.maintenance_job_usage;
CREATE POLICY "Allow full access based on organization_id"
ON public.maintenance_job_usage FOR ALL
USING (organization_id = auth.get_current_organization_id())
WITH CHECK (organization_id = auth.get_current_organization_id());

-- Note: The `organizations` table itself does not have an RLS policy applied in this script.
-- Access to the organizations table would typically be restricted to superusers or specific admin roles
-- in a more complex scenario. For now, we focus on isolating tenant data in the child tables.

-- Grant usage on the helper function to the authenticated role
-- Make sure this role aligns with your Supabase/Postgres setup (e.g., 'authenticated', 'service_role')
GRANT EXECUTE ON FUNCTION auth.get_current_organization_id() TO authenticated;
GRANT EXECUTE ON FUNCTION auth.get_current_organization_id() TO service_role;

-- Make sure the `authenticated` role can see the tables.
-- RLS policies will handle the row-level filtering.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public to authenticated;
