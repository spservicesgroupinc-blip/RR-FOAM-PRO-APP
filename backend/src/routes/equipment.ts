import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { authRequired, adminOnly } from '../middleware/auth.js';
import { broadcastToOrg } from '../websocket/index.js';

const router = Router();
router.use(authRequired);

// ─── GET /api/equipment ─────────────────────────────────────────────────────

router.get('/', async (req: Request, res: Response) => {
  try {
    const equipment = await prisma.equipment.findMany({
      where: { organizationId: req.auth!.organizationId },
      orderBy: { name: 'asc' },
    });

    const statusMap: Record<string, string> = { 'InUse': 'In Use' };

    res.json(equipment.map(e => ({
      id: e.id,
      name: e.name,
      status: statusMap[e.status] || e.status,
      lastSeen: e.lastSeen || undefined,
    })));
  } catch (err) {
    console.error('Fetch equipment error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/equipment — Upsert ──────────────────────────────────────────

const equipmentSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  status: z.enum(['Available', 'In Use', 'Maintenance', 'Lost']).default('Available'),
  lastSeen: z.record(z.unknown()).optional(),
});

router.post('/', adminOnly, async (req: Request, res: Response) => {
  try {
    const parsed = equipmentSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
      return;
    }

    const { organizationId } = req.auth!;
    const { id, status, ...data } = parsed.data;

    const statusMap: Record<string, string> = { 'In Use': 'InUse' };
    const dbStatus = (statusMap[status] || status) as any;

    let item;
    if (id) {
      // Verify org ownership before updating — prevents cross-tenant writes
      const existing = await prisma.equipment.findFirst({
        where: { id, organizationId },
        select: { id: true },
      });

      if (existing) {
        item = await prisma.equipment.update({
          where: { id },
          data: { ...data, status: dbStatus, lastSeen: data.lastSeen || undefined },
        });
      } else {
        item = await prisma.equipment.create({
          data: { id, ...data, status: dbStatus, lastSeen: data.lastSeen || undefined, organizationId },
        });
      }
    } else {
      item = await prisma.equipment.create({
        data: { ...data, status: dbStatus, lastSeen: data.lastSeen || undefined, organizationId },
      });
    }

    broadcastToOrg(organizationId, 'equipment:updated', { id: item.id });

    const reverseMap: Record<string, string> = { 'InUse': 'In Use' };

    res.json({
      id: item.id,
      name: item.name,
      status: reverseMap[item.status] || item.status,
      lastSeen: item.lastSeen || undefined,
    });
  } catch (err) {
    console.error('Upsert equipment error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── PATCH /api/equipment/:id/status ────────────────────────────────────────

router.patch('/:id/status', async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.auth!;
    const { status, lastSeen } = req.body;

    const statusMap: Record<string, string> = { 'In Use': 'InUse' };
    const data: Record<string, unknown> = {};
    if (status) data.status = statusMap[status] || status;
    if (lastSeen) data.lastSeen = lastSeen;

    const result = await prisma.equipment.updateMany({
      where: { id: req.params.id, organizationId },
      data,
    });

    if (result.count === 0) {
      res.status(404).json({ error: 'Equipment not found' });
      return;
    }

    broadcastToOrg(organizationId, 'equipment:updated', { id: req.params.id });

    res.json({ success: true });
  } catch (err) {
    console.error('Update equipment status error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── DELETE /api/equipment/:id ──────────────────────────────────────────────

router.delete('/:id', adminOnly, async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.auth!;

    const item = await prisma.equipment.findFirst({
      where: { id: req.params.id, organizationId },
    });

    if (!item) {
      res.status(404).json({ error: 'Equipment not found' });
      return;
    }

    await prisma.equipment.delete({ where: { id: req.params.id } });
    broadcastToOrg(organizationId, 'equipment:updated', { id: req.params.id, deleted: true });

    res.json({ success: true });
  } catch (err) {
    console.error('Delete equipment error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
