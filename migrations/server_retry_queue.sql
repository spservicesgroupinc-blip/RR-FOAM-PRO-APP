-- ============================================================================
-- SERVER-SIDE RETRY QUEUE  –  Durable write-failure recovery
-- ============================================================================
-- Run this file in the Supabase SQL Editor.
--
-- Purpose:
--   When a client write exhausts its in-memory retries (network drop, 5xx,
--   timeout), it inserts a row into `write_retry_queue` via the
--   `enqueue_failed_write` RPC.  A scheduled job (`process_retry_queue`)
--   replays the operations with back-off.  Completed / permanently-failed
--   rows are cleaned up by `cleanup_retry_queue`.
--
-- The table stores the raw operation + payload so the server can replay
-- any supported write without client involvement.
-- ============================================================================

-- ─── 1. TABLE ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS write_retry_queue (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  table_name    text    NOT NULL,            -- 'estimates', 'customers', etc.
  operation     text    NOT NULL DEFAULT 'upsert',  -- 'upsert','update','insert','delete'
  payload       jsonb   NOT NULL DEFAULT '{}'::jsonb,
  conflict_key  text,                        -- onConflict column (e.g. 'id', 'organization_id')
  error_message text,                        -- last error from processing attempt
  status        text    NOT NULL DEFAULT 'pending',  -- pending | processing | completed | failed
  attempts      int     NOT NULL DEFAULT 0,
  max_attempts  int     NOT NULL DEFAULT 5,
  created_at    timestamptz NOT NULL DEFAULT now(),
  next_retry_at timestamptz NOT NULL DEFAULT now(),
  completed_at  timestamptz
);

-- Index for the processor to find pending work quickly
CREATE INDEX IF NOT EXISTS idx_retry_queue_pending
  ON write_retry_queue (status, next_retry_at)
  WHERE status IN ('pending', 'processing');

-- Index for retention cleanup
CREATE INDEX IF NOT EXISTS idx_retry_queue_completed
  ON write_retry_queue (status, completed_at)
  WHERE status IN ('completed', 'failed');

-- RLS: admin can read their own org's queue; RPCs use SECURITY DEFINER
ALTER TABLE write_retry_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin retry_queue access" ON write_retry_queue;
CREATE POLICY "Admin retry_queue access" ON write_retry_queue
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.organization_id = write_retry_queue.organization_id
      AND profiles.role = 'admin'
    )
  );

-- Allow anon inserts so crew (PIN-based, no auth.uid) can enqueue too
DROP POLICY IF EXISTS "Anon retry_queue insert" ON write_retry_queue;
CREATE POLICY "Anon retry_queue insert" ON write_retry_queue
  FOR INSERT TO anon WITH CHECK (true);


-- ─── 2. ENQUEUE RPC ────────────────────────────────────────────────────────
-- Called from client when retryWrite exhausts local retries.
-- SECURITY DEFINER so both anon (crew) and authenticated (admin) can enqueue.

DROP FUNCTION IF EXISTS enqueue_failed_write(uuid, text, text, jsonb, text, text);
CREATE OR REPLACE FUNCTION enqueue_failed_write(
  p_org_id       uuid,
  p_table_name   text,
  p_operation    text,
  p_payload      jsonb,
  p_conflict_key text DEFAULT 'id',
  p_error_msg    text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO write_retry_queue (
    organization_id, table_name, operation, payload,
    conflict_key, error_message, status, next_retry_at
  ) VALUES (
    p_org_id, p_table_name, p_operation, p_payload,
    p_conflict_key, p_error_msg, 'pending', now() + interval '10 seconds'
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;


-- ─── 3. PROCESS RETRY QUEUE ────────────────────────────────────────────────
-- Picks up pending items whose next_retry_at has passed, replays the write,
-- and marks the outcome.  Call on a schedule (pg_cron) or manually.
--
-- Supports: upsert, update, insert, delete on any table listed in the
-- CASE block.  Unknown tables/ops are marked 'failed' immediately.

DROP FUNCTION IF EXISTS process_retry_queue(int);
CREATE OR REPLACE FUNCTION process_retry_queue(p_batch_size int DEFAULT 20)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item   record;
  v_ok     int := 0;
  v_fail   int := 0;
  v_skip   int := 0;
  v_err    text;
BEGIN
  -- Claim a batch (atomically set status = 'processing')
  FOR v_item IN
    UPDATE write_retry_queue
    SET status = 'processing', attempts = attempts + 1
    WHERE id IN (
      SELECT id FROM write_retry_queue
      WHERE status = 'pending' AND next_retry_at <= now()
      ORDER BY next_retry_at
      LIMIT p_batch_size
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *
  LOOP
    BEGIN
      -- Replay the write
      CASE v_item.table_name
        -- ── ESTIMATES ────────────────────────────────────────
        WHEN 'estimates' THEN
          IF v_item.operation = 'upsert' THEN
            INSERT INTO estimates
              SELECT * FROM jsonb_populate_record(null::estimates, v_item.payload)
            ON CONFLICT (id) DO UPDATE SET
              customer_id       = EXCLUDED.customer_id,
              status            = EXCLUDED.status,
              execution_status  = EXCLUDED.execution_status,
              date              = EXCLUDED.date,
              total_value       = EXCLUDED.total_value,
              notes             = EXCLUDED.notes,
              pricing_mode      = EXCLUDED.pricing_mode,
              scheduled_date    = EXCLUDED.scheduled_date,
              invoice_date      = EXCLUDED.invoice_date,
              invoice_number    = EXCLUDED.invoice_number,
              payment_terms     = EXCLUDED.payment_terms,
              inputs            = EXCLUDED.inputs,
              results           = EXCLUDED.results,
              materials         = EXCLUDED.materials,
              financials        = EXCLUDED.financials,
              settings_snapshot = EXCLUDED.settings_snapshot,
              wall_settings     = EXCLUDED.wall_settings,
              roof_settings     = EXCLUDED.roof_settings,
              expenses          = EXCLUDED.expenses,
              actuals           = EXCLUDED.actuals,
              sq_ft_rates       = EXCLUDED.sq_ft_rates,
              estimate_lines    = EXCLUDED.estimate_lines,
              invoice_lines     = EXCLUDED.invoice_lines,
              work_order_lines  = EXCLUDED.work_order_lines,
              work_order_sheet_url = EXCLUDED.work_order_sheet_url,
              pdf_link          = EXCLUDED.pdf_link,
              site_photos       = EXCLUDED.site_photos,
              inventory_processed = EXCLUDED.inventory_processed,
              last_modified     = EXCLUDED.last_modified,
              updated_at        = now();
          ELSIF v_item.operation = 'update' THEN
            UPDATE estimates SET
              actuals          = COALESCE((v_item.payload->>'actuals')::jsonb, actuals),
              execution_status = COALESCE(v_item.payload->>'execution_status', execution_status),
              status           = COALESCE(v_item.payload->>'status', status),
              last_modified    = now()
            WHERE id = (v_item.payload->>'id')::uuid;
          ELSIF v_item.operation = 'delete' THEN
            DELETE FROM estimates WHERE id = (v_item.payload->>'id')::uuid;
          ELSE
            RAISE EXCEPTION 'Unsupported operation % for table %', v_item.operation, v_item.table_name;
          END IF;

        -- ── CUSTOMERS ────────────────────────────────────────
        WHEN 'customers' THEN
          IF v_item.operation IN ('upsert', 'insert') THEN
            INSERT INTO customers
              SELECT * FROM jsonb_populate_record(null::customers, v_item.payload)
            ON CONFLICT (id) DO UPDATE SET
              name    = EXCLUDED.name,
              address = EXCLUDED.address,
              city    = EXCLUDED.city,
              state   = EXCLUDED.state,
              zip     = EXCLUDED.zip,
              email   = EXCLUDED.email,
              phone   = EXCLUDED.phone,
              status  = EXCLUDED.status,
              notes   = EXCLUDED.notes;
          ELSIF v_item.operation = 'delete' THEN
            DELETE FROM customers WHERE id = (v_item.payload->>'id')::uuid;
          ELSE
            RAISE EXCEPTION 'Unsupported operation % for table %', v_item.operation, v_item.table_name;
          END IF;

        -- ── INVENTORY ITEMS ──────────────────────────────────
        WHEN 'inventory_items' THEN
          IF v_item.operation IN ('upsert', 'insert') THEN
            INSERT INTO inventory_items
              SELECT * FROM jsonb_populate_record(null::inventory_items, v_item.payload)
            ON CONFLICT (id) DO UPDATE SET
              name      = EXCLUDED.name,
              quantity  = EXCLUDED.quantity,
              unit      = EXCLUDED.unit,
              unit_cost = EXCLUDED.unit_cost,
              category  = EXCLUDED.category;
          ELSIF v_item.operation = 'delete' THEN
            DELETE FROM inventory_items WHERE id = (v_item.payload->>'id')::uuid;
          ELSE
            RAISE EXCEPTION 'Unsupported operation % for table %', v_item.operation, v_item.table_name;
          END IF;

        -- ── EQUIPMENT ────────────────────────────────────────
        WHEN 'equipment' THEN
          IF v_item.operation IN ('upsert', 'insert') THEN
            INSERT INTO equipment
              SELECT * FROM jsonb_populate_record(null::equipment, v_item.payload)
            ON CONFLICT (id) DO UPDATE SET
              name      = EXCLUDED.name,
              status    = EXCLUDED.status,
              last_seen = EXCLUDED.last_seen;
          ELSIF v_item.operation = 'delete' THEN
            DELETE FROM equipment WHERE id = (v_item.payload->>'id')::uuid;
          ELSE
            RAISE EXCEPTION 'Unsupported operation % for table %', v_item.operation, v_item.table_name;
          END IF;

        -- ── WAREHOUSE STOCK ──────────────────────────────────
        WHEN 'warehouse_stock' THEN
          IF v_item.operation IN ('upsert', 'update') THEN
            INSERT INTO warehouse_stock (organization_id, open_cell_sets, closed_cell_sets)
            VALUES (
              (v_item.payload->>'organization_id')::uuid,
              COALESCE((v_item.payload->>'open_cell_sets')::numeric, 0),
              COALESCE((v_item.payload->>'closed_cell_sets')::numeric, 0)
            )
            ON CONFLICT (organization_id) DO UPDATE SET
              open_cell_sets  = EXCLUDED.open_cell_sets,
              closed_cell_sets = EXCLUDED.closed_cell_sets;
          ELSE
            RAISE EXCEPTION 'Unsupported operation % for table %', v_item.operation, v_item.table_name;
          END IF;

        -- ── MATERIAL LOGS ────────────────────────────────────
        WHEN 'material_logs' THEN
          IF v_item.operation IN ('insert', 'upsert') THEN
            INSERT INTO material_logs
              SELECT * FROM jsonb_populate_record(null::material_logs, v_item.payload)
            ON CONFLICT (id) DO NOTHING;
          ELSE
            RAISE EXCEPTION 'Unsupported operation % for table %', v_item.operation, v_item.table_name;
          END IF;

        -- ── ORGANIZATIONS (settings only) ────────────────────
        WHEN 'organizations' THEN
          IF v_item.operation = 'update' THEN
            UPDATE organizations SET
              settings = COALESCE((v_item.payload->'settings')::jsonb, settings),
              name     = COALESCE(v_item.payload->>'name', name),
              phone    = COALESCE(v_item.payload->>'phone', phone),
              email    = COALESCE(v_item.payload->>'email', email),
              logo_url = COALESCE(v_item.payload->>'logo_url', logo_url),
              crew_pin = COALESCE(v_item.payload->>'crew_pin', crew_pin),
              address  = COALESCE((v_item.payload->'address')::jsonb, address)
            WHERE id = (v_item.payload->>'id')::uuid;
          ELSE
            RAISE EXCEPTION 'Unsupported operation % for table %', v_item.operation, v_item.table_name;
          END IF;

        ELSE
          RAISE EXCEPTION 'Unknown table: %', v_item.table_name;
      END CASE;

      -- Success
      UPDATE write_retry_queue
      SET status = 'completed', completed_at = now(), error_message = NULL
      WHERE id = v_item.id;
      v_ok := v_ok + 1;

    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;

      IF v_item.attempts >= v_item.max_attempts THEN
        -- Permanently failed
        UPDATE write_retry_queue
        SET status = 'failed', error_message = v_err, completed_at = now()
        WHERE id = v_item.id;
        v_fail := v_fail + 1;
      ELSE
        -- Schedule next retry with exponential back-off (10s, 20s, 40s, 80s, 160s)
        UPDATE write_retry_queue
        SET status = 'pending',
            error_message = v_err,
            next_retry_at = now() + (power(2, v_item.attempts) * interval '10 seconds')
        WHERE id = v_item.id;
        v_skip := v_skip + 1;
      END IF;
  END;
  END LOOP;

  RETURN jsonb_build_object(
    'processed', v_ok + v_fail + v_skip,
    'succeeded', v_ok,
    'failed',    v_fail,
    'retrying',  v_skip
  );
END;
$$;


-- ─── 4. CLEANUP / RETENTION ────────────────────────────────────────────────
-- Removes completed items older than `p_retention_days` (default 7) and
-- failed items older than `p_failed_retention_days` (default 30).
-- Call on a schedule (e.g. daily via pg_cron) or manually.

DROP FUNCTION IF EXISTS cleanup_retry_queue(int, int);
CREATE OR REPLACE FUNCTION cleanup_retry_queue(
  p_retention_days        int DEFAULT 7,
  p_failed_retention_days int DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_completed int;
  v_failed    int;
BEGIN
  DELETE FROM write_retry_queue
  WHERE status = 'completed'
    AND completed_at < now() - (p_retention_days || ' days')::interval;
  GET DIAGNOSTICS v_completed = ROW_COUNT;

  DELETE FROM write_retry_queue
  WHERE status = 'failed'
    AND completed_at < now() - (p_failed_retention_days || ' days')::interval;
  GET DIAGNOSTICS v_failed = ROW_COUNT;

  RETURN jsonb_build_object(
    'purged_completed', v_completed,
    'purged_failed',    v_failed
  );
END;
$$;


-- ─── 5. GRANTS ──────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION enqueue_failed_write(uuid, text, text, jsonb, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION process_retry_queue(int) TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_retry_queue(int, int) TO authenticated;


-- ─── 6. OPTIONAL: pg_cron SCHEDULING ───────────────────────────────────────
-- Uncomment the lines below if the pg_cron extension is enabled in your
-- Supabase project (Dashboard → Database → Extensions → pg_cron).
--
-- Process queue every 30 seconds:
--   SELECT cron.schedule('process-retry-queue', '30 seconds', $$SELECT process_retry_queue(20);$$);
--
-- Daily cleanup at 3 AM UTC:
--   SELECT cron.schedule('cleanup-retry-queue', '0 3 * * *', $$SELECT cleanup_retry_queue(7, 30);$$);

-- ============================================================================
-- DONE!  Apply this migration in the Supabase SQL Editor.
-- Then enable pg_cron scheduling above, or call process_retry_queue()
-- periodically from your admin dashboard / backend cron.
-- ============================================================================
