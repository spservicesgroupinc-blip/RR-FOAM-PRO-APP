-- ============================================
-- CREW MESSAGING SYSTEM
-- Admin → Crew messaging with document sharing
-- ============================================

-- Messages table
CREATE TABLE crew_messages (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid REFERENCES organizations(id) NOT NULL,
  sender_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  sender_name text NOT NULL DEFAULT 'Admin',
  message_type text NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'document', 'announcement')),
  subject text NOT NULL,
  body text NOT NULL DEFAULT '',
  document_url text,
  document_name text,
  is_read boolean NOT NULL DEFAULT false,
  read_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes
CREATE INDEX idx_crew_messages_org ON crew_messages(organization_id);
CREATE INDEX idx_crew_messages_created ON crew_messages(created_at DESC);
CREATE INDEX idx_crew_messages_unread ON crew_messages(organization_id, is_read) WHERE is_read = false;

-- RLS
ALTER TABLE crew_messages ENABLE ROW LEVEL SECURITY;

-- Policy: Admins full access for their org
CREATE POLICY "Admin full access crew_messages" ON crew_messages
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.organization_id = crew_messages.organization_id
      AND profiles.role = 'admin'
    )
  );

-- Policy: Authenticated crew can read messages for their org
CREATE POLICY "Crew read crew_messages" ON crew_messages
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.organization_id = crew_messages.organization_id
      AND profiles.role = 'crew'
    )
  );

-- ─── SECURITY DEFINER RPCs for crew PIN-based access ───────────────────────

-- RPC: Get crew messages (for PIN-based crew auth)
CREATE OR REPLACE FUNCTION get_crew_messages(p_org_id uuid)
RETURNS SETOF crew_messages
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM crew_messages
  WHERE organization_id = p_org_id
  ORDER BY created_at DESC
  LIMIT 50;
$$;

-- RPC: Mark a message as read (for PIN-based crew auth)
CREATE OR REPLACE FUNCTION mark_crew_message_read(p_org_id uuid, p_message_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE crew_messages
  SET is_read = true, read_at = now()
  WHERE id = p_message_id
    AND organization_id = p_org_id
    AND is_read = false;
  RETURN FOUND;
END;
$$;

-- RPC: Get unread count for crew badge
CREATE OR REPLACE FUNCTION get_crew_unread_count(p_org_id uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer FROM crew_messages
  WHERE organization_id = p_org_id
    AND is_read = false;
$$;

-- Grant execute to both anon (crew PIN) and authenticated (admin) roles
GRANT EXECUTE ON FUNCTION get_crew_messages(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION mark_crew_message_read(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_crew_unread_count(uuid) TO anon, authenticated;
