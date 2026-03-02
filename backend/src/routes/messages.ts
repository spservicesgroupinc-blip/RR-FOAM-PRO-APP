import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { authRequired } from '../middleware/auth.js';
import { broadcastToOrg } from '../websocket/index.js';

const router = Router();
router.use(authRequired);

// ─── GET /api/messages — Fetch messages for org ─────────────────────────────

router.get('/', async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.auth!;
    const { limit, unreadOnly } = req.query;

    const where: Record<string, unknown> = { organizationId };
    if (unreadOnly === 'true') {
      where.isRead = false;
    }

    const messages = await prisma.crewMessage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit ? parseInt(limit as string, 10) : 100,
    });

    res.json(messages.map(mapMessage));
  } catch (err) {
    console.error('Fetch messages error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/messages/unread-count ─────────────────────────────────────────

router.get('/unread-count', async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.auth!;

    const count = await prisma.crewMessage.count({
      where: { organizationId, isRead: false },
    });

    res.json({ count });
  } catch (err) {
    console.error('Unread count error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/messages — Send a message ────────────────────────────────────

const messageSchema = z.object({
  messageType: z.enum(['text', 'document', 'announcement']).default('text'),
  subject: z.string().default(''),
  body: z.string().default(''),
  documentUrl: z.string().optional(),
  documentName: z.string().optional(),
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const parsed = messageSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
      return;
    }

    const { organizationId, userId, crewName, role } = req.auth!;
    const senderName = role === 'crew' ? (crewName || 'Crew') : 'Admin';

    const message = await prisma.crewMessage.create({
      data: {
        organizationId,
        senderId: userId,
        senderName,
        messageType: parsed.data.messageType,
        subject: parsed.data.subject,
        body: parsed.data.body,
        documentUrl: parsed.data.documentUrl || null,
        documentName: parsed.data.documentName || null,
      },
    });

    broadcastToOrg(organizationId, 'message:new', mapMessage(message));

    res.status(201).json(mapMessage(message));
  } catch (err) {
    console.error('Send message error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── PATCH /api/messages/:id/read — Mark as read ────────────────────────────

router.patch('/:id/read', async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.auth!;

    const result = await prisma.crewMessage.updateMany({
      where: { id: req.params.id, organizationId },
      data: { isRead: true, readAt: new Date() },
    });

    if (result.count === 0) {
      res.status(404).json({ error: 'Message not found' });
      return;
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Mark message read error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/messages/mark-all-read ───────────────────────────────────────

router.post('/mark-all-read', async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.auth!;

    await prisma.crewMessage.updateMany({
      where: { organizationId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Mark all read error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── DELETE /api/messages/:id ───────────────────────────────────────────────

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.auth!;

    const message = await prisma.crewMessage.findFirst({
      where: { id: req.params.id, organizationId },
    });

    if (!message) {
      res.status(404).json({ error: 'Message not found' });
      return;
    }

    await prisma.crewMessage.delete({ where: { id: req.params.id } });

    res.json({ success: true });
  } catch (err) {
    console.error('Delete message error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Helper ─────────────────────────────────────────────────────────────────

function mapMessage(m: Record<string, any>) {
  return {
    id: m.id,
    organizationId: m.organizationId,
    senderId: m.senderId || null,
    senderName: m.senderName,
    messageType: m.messageType,
    subject: m.subject || '',
    body: m.body || '',
    documentUrl: m.documentUrl || null,
    documentName: m.documentName || null,
    isRead: m.isRead,
    readAt: m.readAt?.toISOString?.() ?? m.readAt ?? null,
    createdAt: m.createdAt?.toISOString?.() ?? m.createdAt,
  };
}

export default router;
