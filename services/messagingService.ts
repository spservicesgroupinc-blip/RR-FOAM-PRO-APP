/**
 * Messaging Service
 *
 * Admin → Crew messaging via Express API (replaces InsForge SDK).
 * Both admin and crew paths use JWT-authenticated REST endpoints.
 */

import { api } from './apiClient';
import { CrewMessage, CrewMessageType } from '../types';

// ─── SEND MESSAGE ───────────────────────────────────────────────────────────

/**
 * Send a message to crew members.
 */
export const sendCrewMessage = async (
  _orgId: string,
  _senderId: string,
  senderName: string,
  subject: string,
  body: string,
  messageType: CrewMessageType = 'text',
  _documentFile?: File,
): Promise<CrewMessage | null> => {
  try {
    const { data, error } = await api.post<CrewMessage>('/api/messages', {
      senderName,
      subject,
      body,
      messageType,
    });
    if (error) {
      console.error('[Messaging] sendCrewMessage failed:', error);
      return null;
    }
    return data;
  } catch (err) {
    console.error('[Messaging] sendCrewMessage exception:', err);
    return null;
  }
};

// ─── FETCH MESSAGES ─────────────────────────────────────────────────────────

/**
 * Fetch all messages (admin: all sent, crew: all received).
 */
export const getAdminMessages = async (_orgId: string): Promise<CrewMessage[]> => {
  try {
    const { data, error } = await api.get<CrewMessage[]>('/api/messages');
    if (error) {
      console.error('[Messaging] getAdminMessages failed:', error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('[Messaging] getAdminMessages exception:', err);
    return [];
  }
};

/**
 * Crew fetches messages (same endpoint, JWT determines role filtering).
 */
export const getCrewMessages = async (_orgId: string): Promise<CrewMessage[]> => {
  try {
    const { data, error } = await api.get<CrewMessage[]>('/api/messages');
    if (error) {
      console.error('[Messaging] getCrewMessages failed:', error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('[Messaging] getCrewMessages exception:', err);
    return [];
  }
};

// ─── MARK AS READ ──────────────────────────────────────────────────────────

export const markMessageRead = async (
  _orgId: string,
  messageId: string,
): Promise<boolean> => {
  try {
    const { error } = await api.patch(`/api/messages/${messageId}/read`, {});
    if (error) {
      console.error('[Messaging] markMessageRead failed:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[Messaging] markMessageRead exception:', err);
    return false;
  }
};

// ─── UNREAD COUNT ──────────────────────────────────────────────────────────

export const getCrewUnreadCount = async (_orgId: string): Promise<number> => {
  try {
    const { data, error } = await api.get<{ count: number }>('/api/messages/unread-count');
    if (error) {
      console.error('[Messaging] getCrewUnreadCount failed:', error);
      return 0;
    }
    return (data as any)?.count || 0;
  } catch (err) {
    console.error('[Messaging] getCrewUnreadCount exception:', err);
    return 0;
  }
};

// ─── DELETE MESSAGE ────────────────────────────────────────────────────────

export const deleteCrewMessage = async (
  _orgId: string,
  messageId: string,
): Promise<boolean> => {
  try {
    const { error } = await api.delete(`/api/messages/${messageId}`);
    if (error) {
      console.error('[Messaging] deleteCrewMessage failed:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[Messaging] deleteCrewMessage exception:', err);
    return false;
  }
};

// ─── REALTIME SUBSCRIPTION ─────────────────────────────────────────────────

/**
 * Subscribe to real-time crew message events via WebSocket.
 * The useSync hook handles WebSocket connection; this is a convenience
 * wrapper that components can use to listen for message:new events.
 *
 * Returns an unsubscribe function.
 */
export const subscribeToCrewMessages = (
  _orgId: string,
  onMessage: (msg: CrewMessage) => void,
): (() => void) => {
  // WebSocket message events are handled by useSync hook.
  // Components can register their own listener via this function.
  // For now, return a no-op since the WS is managed centrally.
  console.log('[Messaging] Realtime subscription registered — events come via WebSocket');
  return () => {
    console.log('[Messaging] Realtime subscription unregistered');
  };
};
