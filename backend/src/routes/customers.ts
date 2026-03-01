import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { authRequired, adminOnly } from '../middleware/auth.js';
import { broadcastToOrg } from '../websocket/index.js';

const router = Router();
router.use(authRequired);
router.use(adminOnly);

// ─── GET /api/customers ─────────────────────────────────────────────────────

router.get('/', async (req: Request, res: Response) => {
  try {
    const customers = await prisma.customer.findMany({
      where: { organizationId: req.auth!.organizationId },
      orderBy: { name: 'asc' },
    });

    res.json(customers.map(c => ({
      id: c.id,
      name: c.name,
      address: c.address,
      city: c.city,
      state: c.state,
      zip: c.zip,
      email: c.email,
      phone: c.phone,
      notes: c.notes,
      status: c.status,
    })));
  } catch (err) {
    console.error('Fetch customers error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/customers — Upsert single customer ──────────────────────────

const customerSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  address: z.string().default(''),
  city: z.string().default(''),
  state: z.string().default(''),
  zip: z.string().default(''),
  email: z.string().default(''),
  phone: z.string().default(''),
  notes: z.string().default(''),
  status: z.enum(['Active', 'Archived', 'Lead']).default('Active'),
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const parsed = customerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
      return;
    }

    const { organizationId } = req.auth!;
    const { id, ...data } = parsed.data;

    let customer;
    if (id) {
      // Verify org ownership before updating — prevents cross-tenant writes
      const existing = await prisma.customer.findFirst({
        where: { id, organizationId },
        select: { id: true },
      });

      if (existing) {
        customer = await prisma.customer.update({
          where: { id },
          data: { ...data },
        });
      } else {
        customer = await prisma.customer.create({
          data: { id, ...data, organizationId },
        });
      }
    } else {
      customer = await prisma.customer.create({
        data: { ...data, organizationId },
      });
    }

    broadcastToOrg(organizationId, 'customer:updated', { id: customer.id });

    res.json({
      id: customer.id,
      name: customer.name,
      address: customer.address,
      city: customer.city,
      state: customer.state,
      zip: customer.zip,
      email: customer.email,
      phone: customer.phone,
      notes: customer.notes,
      status: customer.status,
    });
  } catch (err) {
    console.error('Upsert customer error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/customers/batch — Bulk upsert ───────────────────────────────

router.post('/batch', async (req: Request, res: Response) => {
  try {
    const items = z.array(customerSchema).safeParse(req.body);
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
          const existing = await tx.customer.findFirst({
            where: { id, organizationId },
            select: { id: true },
          });

          if (existing) {
            out.push(await tx.customer.update({ where: { id }, data: { ...data } }));
          } else {
            out.push(await tx.customer.create({ data: { id, ...data, organizationId } }));
          }
        } else {
          out.push(await tx.customer.create({ data: { ...data, organizationId } }));
        }
      }
      return out;
    });

    broadcastToOrg(organizationId, 'customer:updated', { count: results.length });

    res.json(results.map(c => ({
      id: c.id,
      name: c.name,
      address: c.address,
      city: c.city,
      state: c.state,
      zip: c.zip,
      email: c.email,
      phone: c.phone,
      notes: c.notes,
      status: c.status,
    })));
  } catch (err) {
    console.error('Batch upsert customers error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── DELETE /api/customers/:id ──────────────────────────────────────────────

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.auth!;

    // Verify org ownership
    const customer = await prisma.customer.findFirst({
      where: { id: req.params.id, organizationId },
    });

    if (!customer) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }

    await prisma.customer.delete({ where: { id: req.params.id } });
    broadcastToOrg(organizationId, 'customer:updated', { id: req.params.id, deleted: true });

    res.json({ success: true });
  } catch (err) {
    console.error('Delete customer error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
