import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { authRequired, adminOnly } from '../middleware/auth.js';
import { broadcastToOrg } from '../websocket/index.js';

const router = Router();
router.use(authRequired);

// ─── GET /api/warehouse — Full warehouse state ─────────────────────────────

router.get('/', async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.auth!;

    const [org, items] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: organizationId },
        select: { openCellSets: true, closedCellSets: true },
      }),
      prisma.warehouseItem.findMany({
        where: { organizationId },
        orderBy: { name: 'asc' },
      }),
    ]);

    res.json({
      openCellSets: org?.openCellSets ?? 0,
      closedCellSets: org?.closedCellSets ?? 0,
      items: items.map(i => ({
        id: i.id,
        name: i.name,
        quantity: i.quantity,
        unit: i.unit,
        unitCost: i.unitCost,
      })),
    });
  } catch (err) {
    console.error('Fetch warehouse error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── PATCH /api/warehouse/stock — Update foam chemical set counts ───────────

const stockSchema = z.object({
  openCellSets: z.number().min(0),
  closedCellSets: z.number().min(0),
});

router.patch('/stock', adminOnly, async (req: Request, res: Response) => {
  try {
    const parsed = stockSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input' });
      return;
    }

    const { organizationId } = req.auth!;

    await prisma.organization.update({
      where: { id: organizationId },
      data: {
        openCellSets: parsed.data.openCellSets,
        closedCellSets: parsed.data.closedCellSets,
      },
    });

    broadcastToOrg(organizationId, 'warehouse:updated', {});

    res.json({ success: true });
  } catch (err) {
    console.error('Update warehouse stock error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/warehouse/items — Upsert single item ────────────────────────

const itemSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  quantity: z.number().default(0),
  unit: z.string().default('units'),
  unitCost: z.number().default(0),
});

router.post('/items', adminOnly, async (req: Request, res: Response) => {
  try {
    const parsed = itemSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
      return;
    }

    const { organizationId } = req.auth!;
    const { id, ...data } = parsed.data;

    let item;
    if (id) {
      // Verify org ownership before updating — prevents cross-tenant writes
      const existing = await prisma.warehouseItem.findFirst({
        where: { id, organizationId },
        select: { id: true },
      });

      if (existing) {
        item = await prisma.warehouseItem.update({
          where: { id },
          data: { ...data },
        });
      } else {
        item = await prisma.warehouseItem.create({
          data: { id, ...data, organizationId },
        });
      }
    } else {
      item = await prisma.warehouseItem.create({
        data: { ...data, organizationId },
      });
    }

    broadcastToOrg(organizationId, 'warehouse:updated', {});

    res.json({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      unitCost: item.unitCost,
    });
  } catch (err) {
    console.error('Upsert warehouse item error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/warehouse/items/batch — Bulk upsert ─────────────────────────

router.post('/items/batch', adminOnly, async (req: Request, res: Response) => {
  try {
    const items = z.array(itemSchema).safeParse(req.body);
    if (!items.success) {
      res.status(400).json({ error: 'Invalid input' });
      return;
    }

    const { organizationId } = req.auth!;

    const results = await prisma.$transaction(async (tx) => {
      const out = [];
      for (const { id, ...data } of items.data) {
        if (id) {
          // Verify org ownership before updating — prevents cross-tenant writes
          const existing = await tx.warehouseItem.findFirst({
            where: { id, organizationId },
            select: { id: true },
          });

          if (existing) {
            out.push(await tx.warehouseItem.update({ where: { id }, data: { ...data } }));
          } else {
            out.push(await tx.warehouseItem.create({ data: { id, ...data, organizationId } }));
          }
        } else {
          out.push(await tx.warehouseItem.create({ data: { ...data, organizationId } }));
        }
      }
      return out;
    });

    broadcastToOrg(organizationId, 'warehouse:updated', {});

    res.json(results.map(i => ({
      id: i.id,
      name: i.name,
      quantity: i.quantity,
      unit: i.unit,
      unitCost: i.unitCost,
    })));
  } catch (err) {
    console.error('Batch upsert warehouse items error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── DELETE /api/warehouse/items/:id ────────────────────────────────────────

router.delete('/items/:id', adminOnly, async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.auth!;

    const item = await prisma.warehouseItem.findFirst({
      where: { id: req.params.id, organizationId },
    });

    if (!item) {
      res.status(404).json({ error: 'Item not found' });
      return;
    }

    await prisma.warehouseItem.delete({ where: { id: req.params.id } });
    broadcastToOrg(organizationId, 'warehouse:updated', {});

    res.json({ success: true });
  } catch (err) {
    console.error('Delete warehouse item error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
