import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../../shared/types';
import { staysService } from './stays.service';
import { AppError } from '../../shared/middleware/errorHandler';

const lateCheckoutSchema = z.object({
  requestedTime: z.string().regex(/^\d{1,2}:\d{2}$/, 'Must be HH:MM format'),
  notes: z.string().max(500).optional(),
});

const extensionSchema = z.object({
  newCheckOut: z.string().transform(v => new Date(v)),
});

const processSchema = z.object({
  decision: z.enum(['APPROVED', 'DECLINED']),
});

export const staysController = {
  async requestLateCheckout(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.guest) throw new AppError(401, 'Unauthorized');
      const stayId = req.params.stayId as string;
      const body = lateCheckoutSchema.parse(req.body);

      const request = await staysService.requestLateCheckout(
        stayId,
        req.guest.id,
        body.requestedTime,
        body.notes,
      );

      res.status(201).json({ success: true, data: request });
    } catch (err) {
      next(err);
    }
  },

  async getLateCheckoutStatus(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.guest) throw new AppError(401, 'Unauthorized');
      const stayId = req.params.stayId as string;

      const request = await staysService.getLateCheckoutStatus(stayId, req.guest.id);
      res.json({ success: true, data: request });
    } catch (err) {
      next(err);
    }
  },

  async requestExtension(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.guest) throw new AppError(401, 'Unauthorized');
      const stayId = req.params.stayId as string;
      const body = extensionSchema.parse(req.body);

      const result = await staysService.requestExtension(stayId, req.guest.id, body.newCheckOut);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async processLateCheckout(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const requestId = req.params.requestId as string;
      const { decision } = processSchema.parse(req.body);

      const updated = await staysService.procesLateCheckoutRequest(requestId, decision);
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  },
};
