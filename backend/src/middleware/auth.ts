import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, type TokenPayload } from '../utils/jwt.js';
import { prisma } from '../utils/prisma.js';

// Extend Express Request to carry auth info
declare global {
  namespace Express {
    interface Request {
      auth?: TokenPayload;
    }
  }
}

/**
 * Middleware: requires a valid JWT. Attaches req.auth with
 * { userId, organizationId, role, crewName? } and sets the
 * 'app.current_organization_id' session variable for RLS.
 */
export async function authRequired(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  try {
    const token = header.slice(7);
    const payload = verifyAccessToken(token);
    req.auth = payload;

    // Set the organization_id for RLS policies for the duration of the request
    await prisma.$executeRaw`SELECT set_config('app.current_organization_id', ${payload.organizationId}, false)`;

    next();
  } catch (err) {
    // Catches both JWT errors and database errors
    res.status(401).json({ error: 'Invalid, expired, or malformed token' });
  }
}

/**
 * Middleware: requires admin role (rejects crew tokens)
 */
export function adminOnly(req: Request, res: Response, next: NextFunction): void {
  if (!req.auth) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  if (req.auth.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
}

/**
 * Middleware: requires either admin or crew role
 */
export function anyAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.auth) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  next();
}
