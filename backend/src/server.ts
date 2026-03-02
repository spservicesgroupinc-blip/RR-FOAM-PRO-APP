import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { prisma } from './utils/prisma.js';
import { initWebSocket } from './websocket/index.js';

// Route imports
import authRoutes from './routes/auth.js';
import orgRoutes from './routes/org.js';
import customerRoutes from './routes/customers.js';
import estimateRoutes from './routes/estimates.js';
import warehouseRoutes from './routes/warehouse.js';
import equipmentRoutes from './routes/equipment.js';
import materialRoutes from './routes/materials.js';
import maintenanceRoutes from './routes/maintenance.js';
import messageRoutes from './routes/messages.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

// ─── Global Middleware ──────────────────────────────────────────────────────

app.use(helmet({
  contentSecurityPolicy: false, // frontend handles CSP
}));

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));

// Rate limit auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { error: 'Too many requests, try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── Routes ─────────────────────────────────────────────────────────────────

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/org', orgRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/estimates', estimateRoutes);
app.use('/api/warehouse', warehouseRoutes);
app.use('/api/equipment', equipmentRoutes);
app.use('/api/materials', materialRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/messages', messageRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ─── Start Server ───────────────────────────────────────────────────────────

const server = createServer(app);

// Initialize WebSocket on the same HTTP server
initWebSocket(server);

async function start() {
  try {
    // Verify database connection
    await prisma.$connect();
    console.log('✓ Database connected');

    server.listen(PORT, () => {
      console.log(`✓ API server running on port ${PORT}`);
      console.log(`✓ WebSocket server running on ws://localhost:${PORT}/ws`);
      console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down...');
  server.close();
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down...');
  server.close();
  await prisma.$disconnect();
  process.exit(0);
});

start();
