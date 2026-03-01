/**
 * Messaging Service
 *
 * Admin → Crew messaging with document sharing via InsForge.
 * Admin path: direct table queries (authenticated).
 * Crew path: SECURITY DEFINER RPCs (anon/PIN-based).
 */

import { insforge } from '../src/lib/insforge';
import { CrewMessage, CrewMessageType } from '../types';

// ─── MAPPERS ────────────────────────────────────────────────────────────────

const dbRowToCrewMessage = (row: any): CrewMessage => ({
  id: row.id,
  organizationId: row.organization_id,
  senderId: row.sender_id || null,
  senderName: row.sender_name || 'Admin',
  messageType: row.message_type || 'text',
  subject: row.subject || '',
  body: row.body || '',
  documentUrl: row.document_url || null,
  documentName: row.document_name || null,
  isRead: !!row.is_read,
  readAt: row.read_at || null,
  createdAt: row.created_at,
});

// ─── ADMIN: SEND MESSAGE ────────────────────────────────────────────────────

/**
 * Admin sends a message to crew. Optionally uploads a document first.
 */
export const sendCrewMessage = async (
  orgId: string,
  senderId: string,
  senderName: string,
  subject: string,
  body: string,
  messageType: CrewMessageType = 'text',
  documentFile?: File
): Promise<CrewMessage | null> => {
  let documentUrl: string | null = null;
  let documentName: string | null = null;

  // Upload document if provided
  if (documentFile && messageType === 'document') {
    const uploaded = await uploadMessageDocument(orgId, documentFile);
    if (uploaded) {
      documentUrl = uploaded.url;
      documentName = uploaded.name;
    } else {
      console.error('[Messaging] Document upload failed');
      return null;
    }
  }

  const { data, error } = await insforge.database
    .from('crew_messages')
    .insert({
      organization_id: orgId,
      sender_id: senderId,
      sender_name: senderName,
      message_type: messageType,
      subject,
      body,
      document_url: documentUrl,
      document_name: documentName,
    })
    .select()
    .single();

  if (error) {
    console.error('[Messaging] sendCrewMessage failed:', error.message);
    return null;
  }

  return dbRowToCrewMessage(data);
};

// ─── ADMIN: FETCH MESSAGES ─────────────────────────────────────────────────

/**
 * Admin fetches all sent messages for dashboard view.
 */
export const getAdminMessages = async (orgId: string): Promise<CrewMessage[]> => {
  const { data, error } = await insforge.database
    .from('crew_messages')
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('[Messaging] getAdminMessages failed:', error.message);
    return [];
  }

  return (data || []).map(dbRowToCrewMessage);
};

// ─── ADMIN: DELETE MESSAGE ─────────────────────────────────────────────────

export const deleteCrewMessage = async (orgId: string, messageId: string): Promise<boolean> => {
  const { error } = await insforge.database
    .from('crew_messages')
    .delete()
    .eq('id', messageId)
    .eq('organization_id', orgId);

  if (error) {
    console.error('[Messaging] deleteCrewMessage failed:', error.message);
    return false;
  }
  return true;
};

// ─── CREW: FETCH MESSAGES (RPC) ────────────────────────────────────────────

/**
 * Crew fetches messages via SECURITY DEFINER RPC (PIN-based auth).
 */
export const getCrewMessages = async (orgId: string): Promise<CrewMessage[]> => {
  const { data, error } = await insforge.database.rpc('get_crew_messages', {
    p_org_id: orgId,
  });

  if (error) {
    console.error('[Messaging] getCrewMessages RPC failed:', error.message);
    return [];
  }

  return (data as any[] || []).map(dbRowToCrewMessage);
};

// ─── CREW: MARK AS READ (RPC) ─────────────────────────────────────────────

export const markMessageRead = async (orgId: string, messageId: string): Promise<boolean> => {
  const { data, error } = await insforge.database.rpc('mark_crew_message_read', {
    p_org_id: orgId,
    p_message_id: messageId,
  });

  if (error) {
    console.error('[Messaging] markMessageRead RPC failed:', error.message);
    return false;
  }

  return data === true;
};

// ─── CREW: UNREAD COUNT (RPC) ──────────────────────────────────────────────

export const getCrewUnreadCount = async (orgId: string): Promise<number> => {
  const { data, error } = await insforge.database.rpc('get_crew_unread_count', {
    p_org_id: orgId,
  });

  if (error) {
    console.error('[Messaging] getCrewUnreadCount RPC failed:', error.message);
    return 0;
  }

  return typeof data === 'number' ? data : 0;
};

// ─── DOCUMENT UPLOAD ───────────────────────────────────────────────────────

/**
 * Upload a file to InsForge Storage for crew messaging.
 * Uses the existing 'documents' bucket.
 */
const uploadMessageDocument = async (
  orgId: string,
  file: File
): Promise<{ url: string; name: string } | null> => {
  const timestamp = Date.now();
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${orgId}/crew-messages/${timestamp}_${sanitizedName}`;

  const { data: uploadData, error: uploadError } = await insforge.storage
    .from('documents')
    .upload(storagePath, file);

  if (uploadError) {
    console.error('[Messaging] Storage upload error:', uploadError.message);
    return null;
  }

  return {
    url: uploadData?.url || '',
    name: file.name,
  };
};

// ─── REALTIME SUBSCRIPTION ─────────────────────────────────────────────────

/**
 * Subscribe to real-time crew message inserts for the org.
 * Returns an unsubscribe function.
 */
export const subscribeToCrewMessages = (
  orgId: string,
  onNewMessage: (message: CrewMessage) => void
): (() => void) => {
  const channelName = `crew-messages:${orgId}`;

  const messageHandler = (payload: any) => {
    if (payload) {
      onNewMessage(dbRowToCrewMessage(payload));
    }
  };

  (async () => {
    try {
      await insforge.realtime.connect();
      await insforge.realtime.subscribe(channelName);
      insforge.realtime.on('crew_message_insert', messageHandler);
      console.log('[Messaging] Subscribed to crew message updates');
    } catch (err) {
      console.error('[Messaging] Realtime subscription failed:', err);
    }
  })();

  return () => {
    insforge.realtime.off('crew_message_insert', messageHandler);
    insforge.realtime.unsubscribe(channelName);
  };
};
