import { Response, NextFunction } from 'express';
import { loyaltyService } from './loyalty.service';
import { AuthenticatedRequest } from '../../shared/types';

export const loyaltyController = {
  // ── Guest endpoints ──────────────────────────────────────────────

  async getBalance(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const guestId = req.guest!.id;
      const hotelId = req.params.hotelId as string;
      const data = await loyaltyService.getBalance(guestId, hotelId);
      res.json(data);
    } catch (err) { next(err); }
  },

  async getHistory(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const guestId = req.guest!.id;
      const hotelId = req.params.hotelId as string;
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      const data = await loyaltyService.getHistory(guestId, hotelId, page, limit);
      res.json(data);
    } catch (err) { next(err); }
  },

  // ── Dashboard endpoints ──────────────────────────────────────────

  async getSettings(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const hotelId = req.params.hotelId as string;
      const settings = await loyaltyService.getOrCreateSettings(hotelId);
      res.json(settings);
    } catch (err) { next(err); }
  },

  async updateSettings(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const hotelId = req.params.hotelId as string;
      const settings = await loyaltyService.updateSettings(hotelId, req.body);
      res.json(settings);
    } catch (err) { next(err); }
  },

  async getMembers(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const hotelId = req.params.hotelId as string;
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 50;
      const data = await loyaltyService.getMembers(hotelId, page, limit);
      res.json(data);
    } catch (err) { next(err); }
  },

  async manualAdjust(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const hotelId = req.params.hotelId as string;
      const { guestId, nights, description } = req.body;
      const account = await loyaltyService.manualAdjust(hotelId, guestId as string, Number(nights), description as string);
      res.json(account);
    } catch (err) { next(err); }
  },

  async getStats(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const hotelId = req.params.hotelId as string;
      const stats = await loyaltyService.getStats(hotelId);
      res.json(stats);
    } catch (err) { next(err); }
  },
};
