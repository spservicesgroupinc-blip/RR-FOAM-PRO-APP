import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { authRequired, adminOnly } from '../middleware/auth.js';
import { broadcastToOrg } from '../websocket/index.js';

const router = Router();

// All routes require auth
router.use(authRequired);

// ─── GET /api/org — Full org data fetch (admin: everything, crew: limited) ──

router.get('/', async (req: Request, res: Response) => {
  try {
    const { organizationId, role } = req.auth!;

    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        profile: true,
        customers: role === 'admin' ? { orderBy: { name: 'asc' } } : false,
        warehouseItems: { orderBy: { name: 'asc' } },
        equipment: { orderBy: { name: 'asc' } },
        estimates: role === 'admin'
          ? { orderBy: { lastModified: 'desc' } }
          : {
              where: { status: 'WorkOrder' },
              orderBy: { lastModified: 'desc' },
            },
        purchaseOrders: role === 'admin' ? { orderBy: { date: 'desc' } } : false,
        materialLogs: role === 'admin' ? { orderBy: { date: 'desc' }, take: 500 } : false,
      },
    });

    if (!org) {
      res.status(404).json({ error: 'Organization not found' });
      return;
    }

    // Map DB records to frontend CalculatorState shape
    const response: Record<string, unknown> = {
      organizationId: org.id,
      companyName: org.companyName,
      yields: org.yields,
      costs: org.costs,
      pricingMode: org.pricingMode,
      sqFtRates: org.sqFtRates,
      lifetimeUsage: org.lifetimeUsage,
      warehouse: {
        openCellSets: org.openCellSets,
        closedCellSets: org.closedCellSets,
        items: org.warehouseItems.map(mapWarehouseItem),
      },
      equipment: org.equipment.map(mapEquipment),
      companyProfile: org.profile ? mapCompanyProfile(org.profile) : null,
      savedEstimates: org.estimates.map(mapEstimate),
    };

    if (role === 'admin') {
      response.customers = (org.customers as Array<Record<string, unknown>>).map(mapCustomer);
      response.purchaseOrders = (org.purchaseOrders as Array<Record<string, unknown>>).map(mapPurchaseOrder);
      response.materialLogs = (org.materialLogs as Array<Record<string, unknown>>).map(mapMaterialLog);
    }

    res.json(response);
  } catch (err) {
    console.error('Fetch org data error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── PATCH /api/org/settings — Update org-level settings ────────────────────

const settingsSchema = z.object({
  yields: z.record(z.unknown()).optional(),
  costs: z.record(z.unknown()).optional(),
  pricingMode: z.string().optional(),
  sqFtRates: z.record(z.unknown()).optional(),
  lifetimeUsage: z.record(z.unknown()).optional(),
}).passthrough();

router.patch('/settings', adminOnly, async (req: Request, res: Response) => {
  try {
    const parsed = settingsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input' });
      return;
    }

    const { organizationId } = req.auth!;
    const data: Record<string, unknown> = {};

    if (parsed.data.yields) data.yields = parsed.data.yields;
    if (parsed.data.costs) data.costs = parsed.data.costs;
    if (parsed.data.pricingMode) data.pricingMode = parsed.data.pricingMode;
    if (parsed.data.sqFtRates) data.sqFtRates = parsed.data.sqFtRates;
    if (parsed.data.lifetimeUsage) data.lifetimeUsage = parsed.data.lifetimeUsage;

    await prisma.organization.update({
      where: { id: organizationId },
      data,
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Update settings error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── PATCH /api/org/profile — Update company profile ────────────────────────

const profileSchema = z.object({
  companyName: z.string().optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  website: z.string().optional(),
  logoUrl: z.string().optional(),
}).passthrough();

router.patch('/profile', adminOnly, async (req: Request, res: Response) => {
  try {
    const parsed = profileSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input' });
      return;
    }

    const { organizationId } = req.auth!;

    await prisma.companyProfile.upsert({
      where: { organizationId },
      update: parsed.data,
      create: {
        organizationId,
        ...parsed.data,
      },
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── PATCH /api/org/crew-pin — Update crew access PIN ───────────────────────

const crewPinSchema = z.object({
  newPin: z.string().min(4).max(10),
});

router.patch('/crew-pin', adminOnly, async (req: Request, res: Response) => {
  try {
    const parsed = crewPinSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'PIN must be 4-10 characters' });
      return;
    }

    const { organizationId } = req.auth!;
    const crewPinHash = await bcrypt.hash(parsed.data.newPin, 12);

    await prisma.organization.update({
      where: { id: organizationId },
      data: { crewPinHash },
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Update crew PIN error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Helper mappers: DB → Frontend shape ────────────────────────────────────

function mapWarehouseItem(item: Record<string, unknown>) {
  return {
    id: item.id,
    name: item.name,
    quantity: item.quantity,
    unit: item.unit,
    unitCost: item.unitCost,
  };
}

function mapEquipment(item: Record<string, unknown>) {
  return {
    id: item.id,
    name: item.name,
    status: item.status === 'InUse' ? 'In Use' : item.status,
    lastSeen: item.lastSeen || undefined,
  };
}

function mapCompanyProfile(profile: Record<string, unknown>) {
  return {
    companyName: profile.companyName || '',
    addressLine1: profile.addressLine1 || '',
    addressLine2: profile.addressLine2 || '',
    city: profile.city || '',
    state: profile.state || '',
    zip: profile.zip || '',
    phone: profile.phone || '',
    email: profile.email || '',
    website: profile.website || '',
    logoUrl: profile.logoUrl || '',
    crewAccessPin: '', // Never expose PIN
  };
}

function mapCustomer(item: Record<string, unknown>) {
  return {
    id: item.id,
    name: item.name,
    address: item.address || '',
    city: item.city || '',
    state: item.state || '',
    zip: item.zip || '',
    email: item.email || '',
    phone: item.phone || '',
    notes: item.notes || '',
    status: item.status || 'Active',
  };
}

function mapEstimate(item: Record<string, unknown>) {
  const statusMap: Record<string, string> = {
    'WorkOrder': 'Work Order',
    'NotStarted': 'Not Started',
    'InProgress': 'In Progress',
  };
  return {
    id: item.id,
    customerId: item.customerId,
    date: item.date,
    status: statusMap[item.status as string] || item.status,
    executionStatus: statusMap[item.executionStatus as string] || item.executionStatus,
    inputs: item.inputs || {},
    results: item.results || {},
    materials: item.materials || {},
    wallSettings: item.wallSettings || {},
    roofSettings: item.roofSettings || {},
    expenses: item.expenses || {},
    totalValue: item.totalValue || 0,
    notes: item.notes || '',
    pricingMode: item.pricingMode,
    sqFtRates: item.sqFtRates,
    scheduledDate: item.scheduledDate,
    invoiceDate: item.invoiceDate,
    invoiceNumber: item.invoiceNumber,
    paymentTerms: item.paymentTerms,
    estimateLines: item.estimateLines,
    invoiceLines: item.invoiceLines,
    workOrderLines: item.workOrderLines,
    actuals: item.actuals,
    financials: item.financials,
    workOrderSheetUrl: item.workOrderSheetUrl,
    pdfLink: item.pdfLink,
    sitePhotos: item.sitePhotos,
    inventoryProcessed: item.inventoryProcessed || false,
    lastModified: item.lastModified ? (item.lastModified as Date).toISOString() : undefined,
    customer: undefined, // populated separately if needed
  };
}

function mapPurchaseOrder(item: Record<string, unknown>) {
  return {
    id: item.id,
    date: item.date,
    vendorName: item.vendorName,
    status: item.status,
    items: item.items || [],
    totalCost: item.totalCost || 0,
    notes: item.notes || '',
  };
}

function mapMaterialLog(item: Record<string, unknown>) {
  return {
    id: item.id,
    date: item.date,
    jobId: item.jobId,
    customerName: item.customerName,
    materialName: item.materialName,
    quantity: item.quantity,
    unit: item.unit,
    loggedBy: item.loggedBy,
    logType: item.logType,
  };
}

export default router;
