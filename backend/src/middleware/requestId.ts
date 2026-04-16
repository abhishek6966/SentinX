import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

export const requestId = (req: Request, res: Response, next: NextFunction) => {
  const id = (req.get('X-Request-ID') as string) || randomUUID();
  req.headers['x-request-id'] = id;
  res.setHeader('X-Request-ID', id);
  next();
};
