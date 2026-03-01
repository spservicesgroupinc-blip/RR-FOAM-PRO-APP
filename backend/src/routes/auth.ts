import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();

// ─── Validation Schemas ─────────────────────────────────────────────────────

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  companyName: z.string().min(1),
  username: z.string().min(1),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const crewLoginSchema = z.object({
  companyName: z.string().min(1),
  pin: z.string().min(1),
  crewName: z.string().min(1),
});

const changePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(6),
});

// ─── POST /api/auth/signup ──────────────────────────────────────────────────

router.post('/signup', async (req: Request, res: Response) => {
  try {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
      return;
    }

    const { email, password, companyName, username } = parsed.data;

    // Check for existing email
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    // Check for existing company name
    const existingOrg = await prisma.organization.findUnique({ where: { companyName } });
    if (existingOrg) {
      res.status(409).json({ error: 'Company name already taken' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const crewPinHash = await bcrypt.hash('0000', 12); // Default crew PIN

    // Create org + user + profile in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          companyName,
          crewPinHash,
        },
      });

      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          username,
          organizationId: org.id,
          role: 'admin',
        },
      });

      await tx.companyProfile.create({
        data: {
          organizationId: org.id,
          companyName,
        },
      });

      return { org, user };
    });

    const tokenPayload = {
      userId: result.user.id,
      organizationId: result.org.id,
      role: 'admin' as const,
    };

    const accessToken = signAccessToken(tokenPayload);
    const refreshToken = signRefreshToken(tokenPayload);

    res.status(201).json({
      session: {
        id: result.user.id,
        email: result.user.email,
        username: result.user.username,
        companyName: result.org.companyName,
        organizationId: result.org.id,
        role: 'admin',
      },
      accessToken,
      refreshToken,
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/auth/login ───────────────────────────────────────────────────

router.post('/login', async (req: Request, res: Response) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input' });
      return;
    }

    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { email },
      include: { organization: true },
    });

    if (!user || user.role !== 'admin') {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const tokenPayload = {
      userId: user.id,
      organizationId: user.organizationId,
      role: 'admin' as const,
    };

    const accessToken = signAccessToken(tokenPayload);
    const refreshToken = signRefreshToken(tokenPayload);

    res.json({
      session: {
        id: user.id,
        email: user.email,
        username: user.username,
        companyName: user.organization.companyName,
        organizationId: user.organizationId,
        role: 'admin',
      },
      accessToken,
      refreshToken,
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/auth/crew-login ──────────────────────────────────────────────

router.post('/crew-login', async (req: Request, res: Response) => {
  try {
    const parsed = crewLoginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input' });
      return;
    }

    const { companyName, pin, crewName } = parsed.data;

    const org = await prisma.organization.findUnique({
      where: { companyName },
    });

    if (!org) {
      res.status(401).json({ error: 'Invalid company name or PIN' });
      return;
    }

    const validPin = await bcrypt.compare(pin, org.crewPinHash);
    if (!validPin) {
      res.status(401).json({ error: 'Invalid company name or PIN' });
      return;
    }

    const tokenPayload = {
      userId: `crew-${org.id}`,
      organizationId: org.id,
      role: 'crew' as const,
      crewName,
    };

    const accessToken = signAccessToken(tokenPayload);
    const refreshToken = signRefreshToken(tokenPayload);

    res.json({
      session: {
        id: `crew-${org.id}`,
        username: crewName,
        companyName: org.companyName,
        organizationId: org.id,
        role: 'crew',
      },
      accessToken,
      refreshToken,
    });
  } catch (err) {
    console.error('Crew login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/auth/refresh ─────────────────────────────────────────────────

router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken: token } = req.body;
    if (!token) {
      res.status(400).json({ error: 'Refresh token required' });
      return;
    }

    const payload = verifyRefreshToken(token);
    const newPayload = {
      userId: payload.userId,
      organizationId: payload.organizationId,
      role: payload.role,
      crewName: payload.crewName,
    };

    const accessToken = signAccessToken(newPayload);
    const refreshToken = signRefreshToken(newPayload);

    res.json({ accessToken, refreshToken });
  } catch {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// ─── GET /api/auth/me ───────────────────────────────────────────────────────

router.get('/me', authRequired, async (req: Request, res: Response) => {
  try {
    const { userId, organizationId, role } = req.auth!;

    if (role === 'crew') {
      const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { companyName: true },
      });
      res.json({
        session: {
          id: userId,
          username: req.auth!.crewName || 'Crew',
          companyName: org?.companyName || '',
          organizationId,
          role: 'crew',
        },
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { organization: true },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({
      session: {
        id: user.id,
        email: user.email,
        username: user.username,
        companyName: user.organization.companyName,
        organizationId: user.organizationId,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('Get session error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/auth/change-password ─────────────────────────────────────────

router.post('/change-password', authRequired, async (req: Request, res: Response) => {
  try {
    if (req.auth!.role !== 'admin') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const validCurrent = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
    if (!validCurrent) {
      res.status(401).json({ error: 'Current password is incorrect' });
      return;
    }

    const newHash = await bcrypt.hash(parsed.data.newPassword, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash },
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
