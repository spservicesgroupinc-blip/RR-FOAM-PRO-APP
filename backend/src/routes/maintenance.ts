import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { authRequired, adminOnly } from '../middleware/auth.js';
import { broadcastToOrg } from '../websocket/index.js';

const router = Router();
router.use(authRequired);
router.use(adminOnly);

// ─── GET /api/maintenance — Full maintenance data ───────────────────────────

router.get('/', async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.auth!;

    const [equipment, serviceItems, serviceLogs, jobUsage] = await Promise.all([
      prisma.maintenanceEquipment.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.maintenanceServiceItem.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.maintenanceServiceLog.findMany({
        where: { organizationId },
        orderBy: { serviceDate: 'desc' },
        take: 200,
      }),
      prisma.maintenanceJobUsage.findMany({
        where: { organizationId },
        orderBy: { jobDate: 'desc' },
      }),
    ]);

    // Nest service items under equipment
    const equipmentWithItems = equipment.map(e => ({
      id: e.id,
      organizationId: e.organizationId,
      name: e.name,
      description: e.description,
      category: e.category,
      totalSetsSprayed: e.totalSetsSprayed,
      totalHoursOperated: e.totalHoursOperated,
      lifetimeSets: e.lifetimeSets,
      lifetimeHours: e.lifetimeHours,
      status: e.status,
      lastServiceDate: e.lastServiceDate?.toISOString() ?? null,
      serviceItems: serviceItems
        .filter(si => si.equipmentId === e.id)
        .map(mapServiceItem),
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString(),
    }));

    const totalSetsSprayed = jobUsage.reduce((sum, j) => sum + j.totalSets, 0);

    res.json({
      equipment: equipmentWithItems,
      serviceItems: serviceItems.map(mapServiceItem),
      serviceLogs: serviceLogs.map(mapServiceLog),
      jobUsage: jobUsage.map(mapJobUsage),
      totalSetsSprayed,
    });
  } catch (err) {
    console.error('Fetch maintenance data error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/maintenance/equipment — Upsert equipment ────────────────────

const equipmentSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  description: z.string().default(''),
  category: z.string().default('general'),
  status: z.enum(['active', 'inactive', 'retired']).default('active'),
  totalSetsSprayed: z.number().default(0),
  totalHoursOperated: z.number().default(0),
  lifetimeSets: z.number().default(0),
  lifetimeHours: z.number().default(0),
});

router.post('/equipment', async (req: Request, res: Response) => {
  try {
    const parsed = equipmentSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
      return;
    }

    const { organizationId } = req.auth!;
    const { id, ...data } = parsed.data;

    let equip;
    if (id) {
      const existing = await prisma.maintenanceEquipment.findFirst({
        where: { id, organizationId },
        select: { id: true },
      });

      if (existing) {
        equip = await prisma.maintenanceEquipment.update({
          where: { id },
          data,
        });
      } else {
        equip = await prisma.maintenanceEquipment.create({
          data: { id, ...data, organizationId },
        });
      }
    } else {
      equip = await prisma.maintenanceEquipment.create({
        data: { ...data, organizationId },
      });
    }

    broadcastToOrg(organizationId, 'maintenance:updated', { id: equip.id });

    res.json({
      id: equip.id,
      organizationId: equip.organizationId,
      name: equip.name,
      description: equip.description,
      category: equip.category,
      totalSetsSprayed: equip.totalSetsSprayed,
      totalHoursOperated: equip.totalHoursOperated,
      lifetimeSets: equip.lifetimeSets,
      lifetimeHours: equip.lifetimeHours,
      status: equip.status,
      lastServiceDate: equip.lastServiceDate?.toISOString() ?? null,
      serviceItems: [],
      createdAt: equip.createdAt.toISOString(),
      updatedAt: equip.updatedAt.toISOString(),
    });
  } catch (err) {
    console.error('Upsert maintenance equipment error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── DELETE /api/maintenance/equipment/:id ──────────────────────────────────

router.delete('/equipment/:id', async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.auth!;

    const equip = await prisma.maintenanceEquipment.findFirst({
      where: { id: req.params.id, organizationId },
    });

    if (!equip) {
      res.status(404).json({ error: 'Equipment not found' });
      return;
    }

    await prisma.maintenanceEquipment.delete({ where: { id: req.params.id } });
    broadcastToOrg(organizationId, 'maintenance:updated', { id: req.params.id, deleted: true });

    res.json({ success: true });
  } catch (err) {
    console.error('Delete maintenance equipment error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/maintenance/service-items — Upsert service item ──────────────

const serviceItemSchema = z.object({
  id: z.string().optional(),
  equipmentId: z.string(),
  name: z.string().min(1),
  description: z.string().default(''),
  intervalSets: z.number().default(0),
  intervalHours: z.number().default(0),
  setsSinceLastService: z.number().default(0),
  hoursSinceLastService: z.number().default(0),
  lastServicedAt: z.string().optional(),
  lastServicedBy: z.string().default(''),
  isActive: z.boolean().default(true),
});

router.post('/service-items', async (req: Request, res: Response) => {
  try {
    const parsed = serviceItemSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
      return;
    }

    const { organizationId } = req.auth!;
    const { id, lastServicedAt, ...data } = parsed.data;

    const payload: Record<string, unknown> = {
      ...data,
      organizationId,
    };
    if (lastServicedAt) payload.lastServicedAt = new Date(lastServicedAt);

    let item;
    if (id) {
      const existing = await prisma.maintenanceServiceItem.findFirst({
        where: { id, organizationId },
        select: { id: true },
      });

      if (existing) {
        item = await prisma.maintenanceServiceItem.update({
          where: { id },
          data: payload,
        });
      } else {
        item = await prisma.maintenanceServiceItem.create({
          data: { id, ...payload } as any,
        });
      }
    } else {
      item = await prisma.maintenanceServiceItem.create({
        data: payload as any,
      });
    }

    broadcastToOrg(organizationId, 'maintenance:updated', { serviceItemId: item.id });

    res.json(mapServiceItem(item));
  } catch (err) {
    console.error('Upsert service item error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── DELETE /api/maintenance/service-items/:id ──────────────────────────────

router.delete('/service-items/:id', async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.auth!;

    const item = await prisma.maintenanceServiceItem.findFirst({
      where: { id: req.params.id, organizationId },
    });

    if (!item) {
      res.status(404).json({ error: 'Service item not found' });
      return;
    }

    await prisma.maintenanceServiceItem.delete({ where: { id: req.params.id } });
    broadcastToOrg(organizationId, 'maintenance:updated', { serviceItemId: req.params.id, deleted: true });

    res.json({ success: true });
  } catch (err) {
    console.error('Delete service item error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/maintenance/service-logs — Log a service event ───────────────

const serviceLogSchema = z.object({
  equipmentId: z.string(),
  serviceItemId: z.string().optional(),
  serviceDate: z.string().optional(),
  performedBy: z.string().default(''),
  notes: z.string().default(''),
  setsAtService: z.number().default(0),
  hoursAtService: z.number().default(0),
});

router.post('/service-logs', async (req: Request, res: Response) => {
  try {
    const parsed = serviceLogSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
      return;
    }

    const { organizationId } = req.auth!;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create the log entry
      const log = await tx.maintenanceServiceLog.create({
        data: {
          organizationId,
          equipmentId: parsed.data.equipmentId,
          serviceItemId: parsed.data.serviceItemId || null,
          serviceDate: parsed.data.serviceDate
            ? new Date(parsed.data.serviceDate)
            : new Date(),
          performedBy: parsed.data.performedBy,
          notes: parsed.data.notes,
          setsAtService: parsed.data.setsAtService,
          hoursAtService: parsed.data.hoursAtService,
        },
      });

      // 2. Reset the service item's counters
      if (parsed.data.serviceItemId) {
        await tx.maintenanceServiceItem.update({
          where: { id: parsed.data.serviceItemId },
          data: {
            setsSinceLastService: 0,
            hoursSinceLastService: 0,
            lastServicedAt: new Date(),
            lastServicedBy: parsed.data.performedBy,
          },
        });
      }

      // 3. Update equipment's last service date
      await tx.maintenanceEquipment.update({
        where: { id: parsed.data.equipmentId },
        data: { lastServiceDate: new Date() },
      });

      return log;
    });

    broadcastToOrg(organizationId, 'maintenance:updated', { logId: result.id });

    res.json(mapServiceLog(result));
  } catch (err) {
    console.error('Log service error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/maintenance/job-usage — Record job usage ─────────────────────

const jobUsageSchema = z.object({
  id: z.string().optional(),
  estimateId: z.string().optional(),
  openCellSets: z.number().default(0),
  closedCellSets: z.number().default(0),
  totalSets: z.number().default(0),
  operatingHours: z.number().default(0),
  jobDate: z.string(),
  customerName: z.string().default(''),
  notes: z.string().default(''),
  applied: z.boolean().default(false),
});

router.post('/job-usage', async (req: Request, res: Response) => {
  try {
    const parsed = jobUsageSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
      return;
    }

    const { organizationId } = req.auth!;
    const { id, ...data } = parsed.data;

    let usage;
    if (id) {
      const existing = await prisma.maintenanceJobUsage.findFirst({
        where: { id, organizationId },
        select: { id: true },
      });

      if (existing) {
        usage = await prisma.maintenanceJobUsage.update({
          where: { id },
          data,
        });
      } else {
        usage = await prisma.maintenanceJobUsage.create({
          data: { id, ...data, organizationId },
        });
      }
    } else {
      usage = await prisma.maintenanceJobUsage.create({
        data: { ...data, organizationId },
      });
    }

    broadcastToOrg(organizationId, 'maintenance:updated', { jobUsageId: usage.id });

    res.json(mapJobUsage(usage));
  } catch (err) {
    console.error('Record job usage error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/maintenance/apply-usage — Apply job usage to all equipment ───

router.post('/apply-usage', async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.auth!;
    const { jobUsageId } = req.body;

    const usage = await prisma.maintenanceJobUsage.findFirst({
      where: { id: jobUsageId, organizationId },
    });

    if (!usage) {
      res.status(404).json({ error: 'Job usage not found' });
      return;
    }

    if (usage.applied) {
      res.status(400).json({ error: 'Usage already applied' });
      return;
    }

    await prisma.$transaction(async (tx) => {
      // Update all active equipment totals
      await tx.maintenanceEquipment.updateMany({
        where: { organizationId, status: 'active' },
        data: {
          totalSetsSprayed: { increment: usage.totalSets },
          totalHoursOperated: { increment: usage.operatingHours },
          lifetimeSets: { increment: usage.totalSets },
          lifetimeHours: { increment: usage.operatingHours },
        },
      });

      // Increment all active service items' counters
      await tx.maintenanceServiceItem.updateMany({
        where: { organizationId, isActive: true },
        data: {
          setsSinceLastService: { increment: usage.totalSets },
          hoursSinceLastService: { increment: usage.operatingHours },
        },
      });

      // Mark usage as applied
      await tx.maintenanceJobUsage.update({
        where: { id: jobUsageId },
        data: { applied: true },
      });
    });

    broadcastToOrg(organizationId, 'maintenance:updated', {});

    res.json({ success: true });
  } catch (err) {
    console.error('Apply usage error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Helper mappers ─────────────────────────────────────────────────────────

function mapServiceItem(item: Record<string, any>) {
  return {
    id: item.id,
    equipmentId: item.equipmentId,
    organizationId: item.organizationId,
    name: item.name,
    description: item.description || '',
    intervalSets: item.intervalSets,
    intervalHours: item.intervalHours,
    setsSinceLastService: item.setsSinceLastService,
    hoursSinceLastService: item.hoursSinceLastService,
    lastServicedAt: item.lastServicedAt?.toISOString?.() ?? item.lastServicedAt ?? null,
    lastServicedBy: item.lastServicedBy || '',
    isActive: item.isActive !== false,
    createdAt: item.createdAt?.toISOString?.() ?? item.createdAt,
    updatedAt: item.updatedAt?.toISOString?.() ?? item.updatedAt,
  };
}

function mapServiceLog(item: Record<string, any>) {
  return {
    id: item.id,
    organizationId: item.organizationId,
    equipmentId: item.equipmentId,
    serviceItemId: item.serviceItemId || null,
    serviceDate: item.serviceDate?.toISOString?.() ?? item.serviceDate,
    performedBy: item.performedBy || '',
    notes: item.notes || '',
    setsAtService: item.setsAtService,
    hoursAtService: item.hoursAtService,
    createdAt: item.createdAt?.toISOString?.() ?? item.createdAt,
  };
}

function mapJobUsage(item: Record<string, any>) {
  return {
    id: item.id,
    organizationId: item.organizationId,
    estimateId: item.estimateId || null,
    openCellSets: item.openCellSets,
    closedCellSets: item.closedCellSets,
    totalSets: item.totalSets,
    operatingHours: item.operatingHours,
    jobDate: item.jobDate,
    customerName: item.customerName || '',
    notes: item.notes || '',
    applied: item.applied || false,
    createdAt: item.createdAt?.toISOString?.() ?? item.createdAt,
  };
}

export default router;
