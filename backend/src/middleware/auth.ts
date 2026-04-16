// =============================================================================
// SentinX — Auth Middleware (Clerk JWT)
// =============================================================================
import { Request, Response, NextFunction } from 'express';
import { ClerkExpressRequireAuth, RequireAuthProp } from '@clerk/clerk-sdk-node';
import { db } from '../config/database';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../utils/logger';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      clerkUserId?: string;
      isAdmin?: boolean;
    }
  }
}

export const authMiddleware = [
  ClerkExpressRequireAuth(),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const clerkId = (req as any).auth?.userId;
      if (!clerkId) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
      }

      // Find or create user in our DB
      let user = await db.query.users.findFirst({
        where: eq(users.clerkId, clerkId),
      });

      if (!user) {
        // Auto-provision on first authenticated request
        const clerkUser = (await fetch(`https://api.clerk.com/v1/users/${clerkId}`, {
          headers: { Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}` },
        }).then((r) => r.json())) as any;

        [user] = await db
          .insert(users)
          .values({
            clerkId,
            email: clerkUser.email_addresses?.[0]?.email_address || '',
            firstName: clerkUser.first_name,
            lastName: clerkUser.last_name,
            avatarUrl: clerkUser.image_url,
          })
          .returning();

        logger.info(`New user provisioned: ${user.email}`);
      }

      req.userId = user.id;
      req.clerkUserId = clerkId;
      req.isAdmin = user.isAdmin;
      next();
    } catch (err) {
      logger.error('Auth middleware error:', err);
      res.status(401).json({ success: false, error: 'Authentication failed' });
    }
  },
];

export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAdmin) {
    return res.status(403).json({ success: false, error: 'Admin access required' });
  }
  next();
};
