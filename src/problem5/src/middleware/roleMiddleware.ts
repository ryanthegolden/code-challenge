import { Response, NextFunction } from 'express';
import { AuthRequest } from './authMiddleware';

export function roleMiddleware(requiredRole: string) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ message: 'No user' });
    if (req.user.role !== requiredRole)
      return res.status(403).json({ message: 'Forbidden' });
    next();
  };
}
