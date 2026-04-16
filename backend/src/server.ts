// =============================================================================
// SentinX Backend — Express Server Entry Point
// =============================================================================
import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import { createServer } from 'http';

import { logger } from './utils/logger';
import { connectDatabases } from './config/database';
import { connectRedis } from './config/redis';
import { errorHandler } from './middleware/errorHandler';
import { requestId } from './middleware/requestId';
import { rateLimiter } from './middleware/rateLimiter';
import { authMiddleware } from './middleware/auth';
import {
  authRouter,
  stockRouter,
  reportsRouter,
  signalsRouter,
  alertsRouter,
  webhooksRouter,
} from './routes/index';
import portfolioRouter from './routes/portfolio';
import adminRouter from './routes/admin';


const app = express();
const httpServer = createServer(app);

// ─── Security & Middleware ────────────────────────────────────────────────────

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
}));

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
}));

app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));
app.use(requestId);

// ─── Rate Limiting ────────────────────────────────────────────────────────────

app.use('/api/', rateLimiter({ windowMs: 15 * 60 * 1000, max: 300 }));
app.use('/api/admin/', rateLimiter({ windowMs: 15 * 60 * 1000, max: 60 }));

// ─── Health Check ─────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'sentinx-api',
    version: process.env.npm_package_version || '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// ─── Public Routes ────────────────────────────────────────────────────────────

app.use('/api/auth', authRouter);
app.use('/api/webhooks', webhooksRouter);

// ─── Protected Routes ─────────────────────────────────────────────────────────

app.use('/api/portfolio', authMiddleware, portfolioRouter);
app.use('/api/stocks', authMiddleware, stockRouter);
app.use('/api/reports', authMiddleware, reportsRouter);
app.use('/api/signals', authMiddleware, signalsRouter);
app.use('/api/alerts', authMiddleware, alertsRouter);
app.use('/api/admin', authMiddleware, adminRouter);

// ─── Error Handling ───────────────────────────────────────────────────────────

app.use(errorHandler);

// ─── Startup ──────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT || '8080', 10);

async function bootstrap() {
  try {
    logger.info('Connecting to databases...');
    await connectDatabases();
    await connectRedis();
    logger.info('All database connections established');

    httpServer.listen(PORT, '0.0.0.0', () => {
      logger.info(`SentinX API running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  httpServer.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...');
  process.exit(0);
});

bootstrap();

export default app;
