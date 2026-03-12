import { Response, NextFunction } from 'express';
import { journeyService } from './journey.service';
import { buildGuestAIContext } from './guestContext.service';
import { currentStayQuerySchema, updateStageSchema, profileContextQuerySchema } from './journey.validation';
import { AuthenticatedRequest } from '../../shared/types';

export const journeyController = {
  async getCurrentStay(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { hotelId } = currentStayQuerySchema.parse(req.query);
      const result = await journeyService.getCurrentStay(req.guest!.id, hotelId);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async updateStage(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { stayId, stage, roomNumber } = updateStageSchema.parse(req.body);
      const result = await journeyService.updateStage(stayId, req.guest!.id, stage, roomNumber);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/guest/profile-context?hotelId=UUID
   * Returns full AI context for the authenticated guest at a specific hotel.
   * Used by roomie-backend to build personalized prompts.
   */
  async getProfileContext(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { hotelId } = profileContextQuerySchema.parse(req.query);
      const context = await buildGuestAIContext(req.guest!.id, hotelId);
      res.status(200).json({ success: true, data: context });
    } catch (err) {
      next(err);
    }
  },
};
