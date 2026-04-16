// =============================================================================
// SentinX — Express Middleware Utilities
// =============================================================================
import { Request, Response, NextFunction } from 'express';
import rateLimit, { Options } from 'express-rate-limit';
import { v4 as uuidv4 } from 'uuid';
import { ZodError } from 'zod';
import { logger } from '../utils/logger';

// ─── Request ID ───────────────────────────────────────────────────────────────
export const requestId = (req: Request, res: Response, next: NextFunction) => {
  const id = (req.headers['x-request-id'] as string) || uuidv4();
  req.headers['x-request-id'] = id;
  res.setHeader('X-Request-ID', id);
  next();
};

// ─── Rate Limiter ─────────────────────────────────────────────────────────────
export const rateLimiter = (options: Partial<Options>) =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Too many requests, please try again later.' },
    ...options,
  });

// ─── Global Error Handler ─────────────────────────────────────────────────────
export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction,
) => {
  const requestId = req.headers['x-request-id'];

  if (err instanceof ZodError) {
    logger.warn(`Validation error [${requestId}]:`, err.flatten());
    return res.status(422).json({
      success: false,
      error: 'Validation failed',
      details: err.flatten().fieldErrors,
    });
  }

  if (err.status === 401 || err.message?.includes('Unauthorized')) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  if (err.code === '23505') {
    // PostgreSQL unique constraint
    return res.status(409).json({ success: false, error: 'Resource already exists' });
  }

  logger.error(`Unhandled error [${requestId}]:`, {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method,
  });

  res.status(err.statusCode || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    requestId,
  });
};
