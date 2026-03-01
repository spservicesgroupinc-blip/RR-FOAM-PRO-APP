import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { verifyAccessToken, type TokenPayload } from '../utils/jwt.js';

interface AuthenticatedSocket extends WebSocket {
  auth?: TokenPayload;
  isAlive?: boolean;
}

// Map of orgId -> Set of connected sockets
const orgRooms = new Map<string, Set<AuthenticatedSocket>>();

let wss: WebSocketServer;

export function initWebSocket(server: import('http').Server): WebSocketServer {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: AuthenticatedSocket, req: IncomingMessage) => {
    // Authenticate from query string: /ws?token=xxx
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const token = url.searchParams.get('token');

    if (!token) {
      ws.close(4001, 'Missing token');
      return;
    }

    try {
      ws.auth = verifyAccessToken(token);
    } catch {
      ws.close(4001, 'Invalid token');
      return;
    }

    ws.isAlive = true;

    // Join org room
    const orgId = ws.auth.organizationId;
    if (!orgRooms.has(orgId)) {
      orgRooms.set(orgId, new Set());
    }
    orgRooms.get(orgId)!.add(ws);

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
        }
      } catch {
        // Ignore malformed messages
      }
    });

    ws.on('close', () => {
      const room = orgRooms.get(orgId);
      if (room) {
        room.delete(ws);
        if (room.size === 0) {
          orgRooms.delete(orgId);
        }
      }
    });

    // Send confirmation
    ws.send(JSON.stringify({ type: 'connected', orgId }));
  });

  // Heartbeat interval — ping every 30s, terminate dead connections
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      const authWs = ws as AuthenticatedSocket;
      if (authWs.isAlive === false) {
        authWs.terminate();
        return;
      }
      authWs.isAlive = false;
      authWs.ping();
    });
  }, 30000);

  wss.on('close', () => clearInterval(interval));

  return wss;
}

/**
 * Broadcast an event to all connected clients in an organization
 */
export function broadcastToOrg(orgId: string, event: string, data?: unknown): void {
  const room = orgRooms.get(orgId);
  if (!room) return;

  const message = JSON.stringify({ type: event, data, timestamp: Date.now() });

  room.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  });
}

/**
 * Broadcast to org, excluding a specific role (e.g., don't echo back to admin)
 */
export function broadcastToOrgRole(orgId: string, event: string, role: 'admin' | 'crew', data?: unknown): void {
  const room = orgRooms.get(orgId);
  if (!room) return;

  const message = JSON.stringify({ type: event, data, timestamp: Date.now() });

  room.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN && ws.auth?.role === role) {
      ws.send(message);
    }
  });
}
