import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { authRequired, adminOnly } from '../middleware/auth.js';
import { broadcastToOrg } from '../websocket/index.js';

const router = Router();
router.use(authRequired);
router.use(adminOnly);

// ─── POST /api/materials/logs — Insert batch of usage logs ──────────────────

const logEntrySchema = z.object({
  id: z.string().optional(),
  date: z.string(),
  jobId: z.string().optional(),
  customerName: z.string().default(''),
  materialName: z.string(),
  quantity: z.number(),
  unit: z.string(),
  loggedBy: z.string().default(''),
  logType: z.enum(['estimated', 'actual']).default('estimated'),
});

router.post('/logs', async (req: Request, res: Response) => {
  try {
    const items = z.array(logEntrySchema).safeParse(req.body);
    if (!items.success) {
      res.status(400).json({ error: 'Invalid input' });
      return;
    }

    const { organizationId } = req.auth!;

    await prisma.materialUsageLog.createMany({
      data: items.data.map(entry => ({
        ...entry,
        organizationId,
      })),
    });

    res.json({ success: true, count: items.data.length });
  } catch (err) {
    console.error('Insert material logs error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/materials/logs — Query with filters ───────────────────────────

router.get('/logs', async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.auth!;
    const { jobId, from, to, limit } = req.query;

    const where: Record<string, unknown> = { organizationId };
    if (jobId) where.jobId = jobId;
    // Date range filtering (dates stored as strings in YYYY-MM-DD format)
    if (from || to) {
      where.date = {};
      if (from) (where.date as Record<string, unknown>).gte = from;
      if (to) (where.date as Record<string, unknown>).lte = to;
    }

    const logs = await prisma.materialUsageLog.findMany({
      where,
      orderBy: { date: 'desc' },
      take: limit ? parseInt(limit as string, 10) : 500,
    });

    res.json(logs.map(l => ({
      id: l.id,
      date: l.date,
      jobId: l.jobId,
      customerName: l.customerName,
      materialName: l.materialName,
      quantity: l.quantity,
      unit: l.unit,
      loggedBy: l.loggedBy,
      logType: l.logType,
    })));
  } catch (err) {
    console.error('Fetch material logs error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── PURCHASE ORDERS ────────────────────────────────────────────────────────

// ─── POST /api/materials/purchase-orders — Create PO (adjusts warehouse) ────

const poSchema = z.object({
  id: z.string().optional(),
  date: z.string(),
  vendorName: z.string().min(1),
  status: z.enum(['Draft', 'Sent', 'Received', 'Cancelled']).default('Draft'),
  items: z.array(z.object({
    description: z.string(),
    quantity: z.number(),
    unitCost: z.number(),
    total: z.number(),
    type: z.enum(['open_cell', 'closed_cell', 'inventory']),
    inventoryId: z.string().optional(),
  })),
  totalCost: z.number().default(0),
  notes: z.string().optional(),
});

router.post('/purchase-orders', async (req: Request, res: Response) => {
  try {
    const parsed = poSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
      return;
    }

    const { organizationId } = req.auth!;
    const { id, ...data } = parsed.data;

    // Create PO and adjust warehouse stock in a transaction if status is Received
    const result = await prisma.$transaction(async (tx) => {
      const po = id
        ? await tx.purchaseOrder.upsert({
            where: { id },
            update: { ...data, items: data.items as any },
            create: { id, ...data, items: data.items as any, organizationId },
          })
        : await tx.purchaseOrder.create({
            data: { ...data, items: data.items as any, organizationId },
          });

      // If PO is "Received", add quantities to warehouse
      if (data.status === 'Received') {
        let addOpenCellSets = 0;
        let addClosedCellSets = 0;

        for (const item of data.items) {
          if (item.type === 'open_cell') {
            addOpenCellSets += item.quantity;
          } else if (item.type === 'closed_cell') {
            addClosedCellSets += item.quantity;
          } else if (item.type === 'inventory' && item.inventoryId) {
            await tx.warehouseItem.update({
              where: { id: item.inventoryId },
              data: { quantity: { increment: item.quantity } },
            });
          }
        }

        if (addOpenCellSets > 0 || addClosedCellSets > 0) {
          await tx.organization.update({
            where: { id: organizationId },
            data: {
              openCellSets: { increment: addOpenCellSets },
              closedCellSets: { increment: addClosedCellSets },
            },
          });
        }
      }

      return po;
    });

    broadcastToOrg(organizationId, 'warehouse:updated', {});

    res.json({
      id: result.id,
      date: result.date,
      vendorName: result.vendorName,
      status: result.status,
      items: result.items,
      totalCost: result.totalCost,
      notes: result.notes || '',
    });
  } catch (err) {
    console.error('Create purchase order error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/materials/purchase-orders ─────────────────────────────────────

router.get('/purchase-orders', async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.auth!;

    const orders = await prisma.purchaseOrder.findMany({
      where: { organizationId },
      orderBy: { date: 'desc' },
    });

    res.json(orders.map(po => ({
      id: po.id,
      date: po.date,
      vendorName: po.vendorName,
      status: po.status,
      items: po.items,
      totalCost: po.totalCost,
      notes: po.notes || '',
    })));
  } catch (err) {
    console.error('Fetch purchase orders error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── PATCH /api/materials/purchase-orders/:id/status ────────────────────────

router.patch('/purchase-orders/:id/status', async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.auth!;
    const { status } = req.body;

    const result = await prisma.purchaseOrder.updateMany({
      where: { id: req.params.id, organizationId },
      data: { status },
    });

    if (result.count === 0) {
      res.status(404).json({ error: 'Purchase order not found' });
      return;
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Update PO status error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
