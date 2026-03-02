import { Request, Response, NextFunction } from 'express';
import { verifyStaffToken } from './staff.service';
import { StaffRole } from '@prisma/client';

export interface StaffRequest extends Request {
  staff?: {
    staffId: string;
    hotelId: string;
    role: StaffRole;
  };
}

export function staffAuth(req: StaffRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    req.staff = verifyStaffToken(token);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

export function requireRole(...roles: StaffRole[]) {
  return (req: StaffRequest, res: Response, next: NextFunction) => {
    if (!req.staff || !roles.includes(req.staff.role)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    next();
  };
}

export function canManageTasks(req: StaffRequest, res: Response, next: NextFunction) {
  const role = req.staff?.role;
  if (!role || role === 'RECEPTIONIST') {
    res.status(403).json({ error: 'Cannot manage tasks' });
    return;
  }
  next();
}
