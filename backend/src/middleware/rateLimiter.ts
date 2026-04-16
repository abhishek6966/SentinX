import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { logger } from '../utils/logger';

export const rateLimiter = (options: { windowMs: number; max: number }) => {
  return rateLimit({
    ...options,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
      logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
      res.status(429).json({
        success: false,
        error: 'Too many requests, please try again later.',
      });
    },
  });
};
