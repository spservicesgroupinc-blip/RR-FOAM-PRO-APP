import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { authRequired, adminOnly } from '../middleware/auth.js';
import { broadcastToOrg } from '../websocket/index.js';

const router = Router();
router.use(authRequired);

// ─── GET /api/estimates ─────────────────────────────────────────────────────

router.get('/', async (req: Request, res: Response) => {
  try {
    const { organizationId, role } = req.auth!;

    const where: Record<string, unknown> = { organizationId };

    // Crew can only see Work Orders
    if (role === 'crew') {
      where.status = 'WorkOrder';
    }

    const estimates = await prisma.estimate.findMany({
      where,
      include: { customer: true },
      orderBy: { lastModified: 'desc' },
    });

    const statusMap: Record<string, string> = {
      'WorkOrder': 'Work Order',
    };
    const execMap: Record<string, string> = {
      'NotStarted': 'Not Started',
      'InProgress': 'In Progress',
    };

    res.json(estimates.map(e => ({
      id: e.id,
      customerId: e.customerId,
      date: e.date,
      status: statusMap[e.status] || e.status,
      executionStatus: execMap[e.executionStatus] || e.executionStatus,
      inputs: e.inputs,
      results: e.results,
      materials: e.materials,
      wallSettings: e.wallSettings,
      roofSettings: e.roofSettings,
      expenses: e.expenses,
      totalValue: e.totalValue,
      notes: e.notes || '',
      pricingMode: e.pricingMode,
      sqFtRates: e.sqFtRates,
      scheduledDate: e.scheduledDate,
      invoiceDate: e.invoiceDate,
      invoiceNumber: e.invoiceNumber,
      paymentTerms: e.paymentTerms,
      estimateLines: e.estimateLines,
      invoiceLines: e.invoiceLines,
      workOrderLines: e.workOrderLines,
      actuals: e.actuals,
      financials: e.financials,
      workOrderSheetUrl: e.workOrderSheetUrl,
      pdfLink: e.pdfLink,
      sitePhotos: e.sitePhotos,
      inventoryProcessed: e.inventoryProcessed,
      lastModified: e.lastModified.toISOString(),
      customer: {
        id: e.customer.id,
        name: e.customer.name,
        address: e.customer.address,
        city: e.customer.city,
        state: e.customer.state,
        zip: e.customer.zip,
        email: e.customer.email,
        phone: e.customer.phone,
        notes: e.customer.notes,
        status: e.customer.status,
      },
    })));
  } catch (err) {
    console.error('Fetch estimates error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/estimates — Create or update ─────────────────────────────────

const estimateSchema = z.object({
  id: z.string().optional(),
  customerId: z.string(),
  date: z.string(),
  status: z.enum(['Draft', 'Work Order', 'Invoiced', 'Paid', 'Archived']).default('Draft'),
  executionStatus: z.enum(['Not Started', 'In Progress', 'Completed']).default('Not Started'),
  inputs: z.record(z.unknown()).default({}),
  results: z.record(z.unknown()).default({}),
  materials: z.record(z.unknown()).default({}),
  wallSettings: z.record(z.unknown()).default({}),
  roofSettings: z.record(z.unknown()).default({}),
  expenses: z.record(z.unknown()).default({}),
  totalValue: z.number().default(0),
  notes: z.string().optional(),
  pricingMode: z.string().optional(),
  sqFtRates: z.record(z.unknown()).optional(),
  scheduledDate: z.string().optional(),
  invoiceDate: z.string().optional(),
  invoiceNumber: z.string().optional(),
  paymentTerms: z.string().optional(),
  estimateLines: z.array(z.unknown()).optional(),
  invoiceLines: z.array(z.unknown()).optional(),
  workOrderLines: z.array(z.unknown()).optional(),
  actuals: z.record(z.unknown()).optional(),
  financials: z.record(z.unknown()).optional(),
  workOrderSheetUrl: z.string().optional(),
  pdfLink: z.string().optional(),
  sitePhotos: z.array(z.string()).optional(),
  inventoryProcessed: z.boolean().optional(),
}).passthrough();

router.post('/', adminOnly, async (req: Request, res: Response) => {
  try {
    const parsed = estimateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
      return;
    }

    const { organizationId } = req.auth!;
    const { id, status, executionStatus, ...rest } = parsed.data;

    // Map frontend status strings to Prisma enum values
    const statusMap: Record<string, string> = {
      'Work Order': 'WorkOrder',
      'Not Started': 'NotStarted',
      'In Progress': 'InProgress',
    };

    const dbData = {
      ...rest,
      status: (statusMap[status] || status) as any,
      executionStatus: (statusMap[executionStatus] || executionStatus) as any,
      lastModified: new Date(),
      estimateLines: rest.estimateLines ? rest.estimateLines as any : undefined,
      invoiceLines: rest.invoiceLines ? rest.invoiceLines as any : undefined,
      workOrderLines: rest.workOrderLines ? rest.workOrderLines as any : undefined,
      sitePhotos: rest.sitePhotos ? rest.sitePhotos as any : undefined,
    };

    let estimate;
    if (id) {
      estimate = await prisma.estimate.upsert({
        where: { id },
        update: dbData,
        create: { id, ...dbData, organizationId },
        include: { customer: true },
      });
    } else {
      estimate = await prisma.estimate.create({
        data: { ...dbData, organizationId },
        include: { customer: true },
      });
    }

    broadcastToOrg(organizationId, 'estimate:updated', { id: estimate.id });

    const reverseStatusMap: Record<string, string> = {
      'WorkOrder': 'Work Order',
      'NotStarted': 'Not Started',
      'InProgress': 'In Progress',
    };

    res.json({
      id: estimate.id,
      customerId: estimate.customerId,
      date: estimate.date,
      status: reverseStatusMap[estimate.status] || estimate.status,
      executionStatus: reverseStatusMap[estimate.executionStatus] || estimate.executionStatus,
      inputs: estimate.inputs,
      results: estimate.results,
      materials: estimate.materials,
      wallSettings: estimate.wallSettings,
      roofSettings: estimate.roofSettings,
      expenses: estimate.expenses,
      totalValue: estimate.totalValue,
      notes: estimate.notes || '',
      pricingMode: estimate.pricingMode,
      sqFtRates: estimate.sqFtRates,
      scheduledDate: estimate.scheduledDate,
      invoiceDate: estimate.invoiceDate,
      invoiceNumber: estimate.invoiceNumber,
      paymentTerms: estimate.paymentTerms,
      estimateLines: estimate.estimateLines,
      invoiceLines: estimate.invoiceLines,
      workOrderLines: estimate.workOrderLines,
      actuals: estimate.actuals,
      financials: estimate.financials,
      inventoryProcessed: estimate.inventoryProcessed,
      lastModified: estimate.lastModified.toISOString(),
      customer: {
        id: estimate.customer.id,
        name: estimate.customer.name,
        address: estimate.customer.address,
        city: estimate.customer.city,
        state: estimate.customer.state,
        zip: estimate.customer.zip,
        email: estimate.customer.email,
        phone: estimate.customer.phone,
        notes: estimate.customer.notes,
        status: estimate.customer.status,
      },
    });
  } catch (err) {
    console.error('Upsert estimate error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── PATCH /api/estimates/:id/status — Workflow transition ──────────────────

router.patch('/:id/status', adminOnly, async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.auth!;
    const { status, executionStatus, ...extra } = req.body;

    const statusMap: Record<string, string> = {
      'Work Order': 'WorkOrder',
      'Not Started': 'NotStarted',
      'In Progress': 'InProgress',
    };

    const data: Record<string, unknown> = { lastModified: new Date() };
    if (status) data.status = statusMap[status] || status;
    if (executionStatus) data.executionStatus = statusMap[executionStatus] || executionStatus;
    // Allow extra fields (scheduledDate, invoiceDate, invoiceNumber, etc.)
    Object.assign(data, extra);

    const estimate = await prisma.estimate.updateMany({
      where: { id: req.params.id, organizationId },
      data,
    });

    if (estimate.count === 0) {
      res.status(404).json({ error: 'Estimate not found' });
      return;
    }

    broadcastToOrg(organizationId, 'estimate:updated', { id: req.params.id });

    // If converting to Work Order, also broadcast to crew channel
    if (status === 'Work Order' || status === 'WorkOrder') {
      broadcastToOrg(organizationId, 'workorder:broadcast', { id: req.params.id });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Update estimate status error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── PATCH /api/estimates/:id/actuals — Crew job update (TRANSACTIONAL) ─────

router.patch('/:id/actuals', async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.auth!;
    const {
      actuals,
      executionStatus,
      openCellSetsUsed,
      closedCellSetsUsed,
    } = req.body;

    const statusMap: Record<string, string> = {
      'Not Started': 'NotStarted',
      'In Progress': 'InProgress',
    };

    await prisma.$transaction(async (tx) => {
      // 1. Update estimate with actuals
      const data: Record<string, unknown> = {
        lastModified: new Date(),
      };
      if (actuals) data.actuals = actuals;
      if (executionStatus) {
        data.executionStatus = statusMap[executionStatus] || executionStatus;
      }

      await tx.estimate.updateMany({
        where: { id: req.params.id, organizationId },
        data,
      });

      // 2. If job completed, atomically adjust warehouse stock
      if (executionStatus === 'Completed' && (openCellSetsUsed || closedCellSetsUsed)) {
        const org = await tx.organization.findUnique({
          where: { id: organizationId },
          select: { openCellSets: true, closedCellSets: true },
        });

        if (org) {
          await tx.organization.update({
            where: { id: organizationId },
            data: {
              openCellSets: Math.max(0, org.openCellSets - (openCellSetsUsed || 0)),
              closedCellSets: Math.max(0, org.closedCellSets - (closedCellSetsUsed || 0)),
            },
          });
        }
      }
    });

    broadcastToOrg(organizationId, 'estimate:updated', { id: req.params.id });
    broadcastToOrg(organizationId, 'warehouse:updated', {});

    res.json({ success: true });
  } catch (err) {
    console.error('Crew update job error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── PATCH /api/estimates/:id/paid — Mark as paid ───────────────────────────

router.patch('/:id/paid', adminOnly, async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.auth!;
    const { financials } = req.body;

    await prisma.estimate.updateMany({
      where: { id: req.params.id, organizationId },
      data: {
        status: 'Paid',
        financials: financials || {},
        lastModified: new Date(),
      },
    });

    broadcastToOrg(organizationId, 'estimate:updated', { id: req.params.id });

    res.json({ success: true });
  } catch (err) {
    console.error('Mark paid error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── PATCH /api/estimates/:id/inventory-processed ───────────────────────────

router.patch('/:id/inventory-processed', adminOnly, async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.auth!;

    await prisma.estimate.updateMany({
      where: { id: req.params.id, organizationId },
      data: { inventoryProcessed: true },
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Mark inventory processed error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── DELETE /api/estimates/:id ──────────────────────────────────────────────

router.delete('/:id', adminOnly, async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.auth!;

    const result = await prisma.estimate.deleteMany({
      where: { id: req.params.id, organizationId },
    });

    if (result.count === 0) {
      res.status(404).json({ error: 'Estimate not found' });
      return;
    }

    broadcastToOrg(organizationId, 'estimate:updated', { id: req.params.id, deleted: true });

    res.json({ success: true });
  } catch (err) {
    console.error('Delete estimate error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
