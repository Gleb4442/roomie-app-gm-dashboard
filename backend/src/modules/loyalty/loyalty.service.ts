import { prisma } from '../../config/database';
import { AppError } from '../../shared/middleware/errorHandler';
import { logger } from '../../shared/utils/logger';
import { LoyaltyTier, LoyaltyTransactionType } from '@prisma/client';

// ── Tier calculation (based on nights this year) ─────────────────────────────

function calculateTier(
  nightsThisYear: number,
  settings: { silverNightsRequired: number; goldNightsRequired: number; platinumNightsRequired: number },
): LoyaltyTier {
  if (nightsThisYear >= settings.platinumNightsRequired) return LoyaltyTier.PLATINUM;
  if (nightsThisYear >= settings.goldNightsRequired) return LoyaltyTier.GOLD;
  if (nightsThisYear >= settings.silverNightsRequired) return LoyaltyTier.SILVER;
  return LoyaltyTier.BRONZE;
}

// ── Core helpers ──────────────────────────────────────────────────────────────

function currentYearStart(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), 0, 1);
}

async function getOrCreateAccount(guestId: string, hotelId: string) {
  const account = await prisma.loyaltyAccount.upsert({
    where: { guestId_hotelId: { guestId, hotelId } },
    update: {},
    create: { guestId, hotelId, yearStart: currentYearStart() },
  });

  // Reset nightsThisYear if year has rolled over
  const yearBoundary = currentYearStart();
  if (account.yearStart < yearBoundary) {
    return prisma.loyaltyAccount.update({
      where: { id: account.id },
      data: { nightsThisYear: 0, yearStart: yearBoundary },
    });
  }

  return account;
}

async function getSettings(hotelId: string) {
  return prisma.loyaltySettings.findUnique({ where: { hotelId } });
}

// ── Public API ────────────────────────────────────────────────────────────────

export const loyaltyService = {
  // ── Guest-facing ─────────────────────────────────────────────────

  async getBalance(guestId: string, hotelId: string) {
    const [settings, account] = await Promise.all([
      getSettings(hotelId),
      getOrCreateAccount(guestId, hotelId),
    ]);

    if (!settings?.isEnabled) {
      return { enabled: false };
    }

    return {
      enabled: true,
      programName: settings.programName,
      nightsThisYear: account.nightsThisYear,
      totalNights: account.totalNights,
      tier: account.tier,
      tiers: {
        silver: settings.silverNightsRequired,
        gold: settings.goldNightsRequired,
        platinum: settings.platinumNightsRequired,
      },
    };
  },

  async getHistory(guestId: string, hotelId: string, page = 1, limit = 20) {
    const account = await prisma.loyaltyAccount.findUnique({
      where: { guestId_hotelId: { guestId, hotelId } },
    });
    if (!account) return { transactions: [], total: 0 };

    const skip = (page - 1) * limit;
    const [transactions, total] = await Promise.all([
      prisma.loyaltyTransaction.findMany({
        where: { accountId: account.id },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.loyaltyTransaction.count({ where: { accountId: account.id } }),
    ]);

    return { transactions, total };
  },

  // ── Night recording (called when stay completes) ───────────────────

  async recordNights(guestId: string, hotelId: string, nights: number, stayId: string) {
    const settings = await getSettings(hotelId);
    if (!settings?.isEnabled || nights <= 0) return null;

    const account = await getOrCreateAccount(guestId, hotelId);

    const newNightsThisYear = account.nightsThisYear + nights;
    const newTotalNights = account.totalNights + nights;
    const oldTier = account.tier;
    const newTier = calculateTier(newNightsThisYear, settings);

    await prisma.$transaction(async (tx) => {
      await tx.loyaltyTransaction.create({
        data: {
          accountId: account.id,
          type: LoyaltyTransactionType.STAY_NIGHTS,
          nights,
          description: `${nights} night${nights > 1 ? 's' : ''} stay`,
          stayId,
        },
      });

      if (oldTier !== newTier) {
        await tx.loyaltyTransaction.create({
          data: {
            accountId: account.id,
            type: LoyaltyTransactionType.TIER_CHANGE,
            nights: 0,
            description: `Tier upgraded: ${oldTier} → ${newTier}`,
          },
        });
      }

      await tx.loyaltyAccount.update({
        where: { id: account.id },
        data: {
          nightsThisYear: newNightsThisYear,
          totalNights: newTotalNights,
          tier: newTier,
        },
      });
    });

    logger.info({ guestId, hotelId, nights, newTier }, '[Loyalty] Nights recorded');
    return { nights, newTier, nightsThisYear: newNightsThisYear };
  },

  // ── Dashboard ────────────────────────────────────────────────────

  async getOrCreateSettings(hotelId: string) {
    return prisma.loyaltySettings.upsert({
      where: { hotelId },
      update: {},
      create: { hotelId },
    });
  },

  async updateSettings(hotelId: string, data: Partial<{
    isEnabled: boolean;
    programName: string;
    silverNightsRequired: number;
    goldNightsRequired: number;
    platinumNightsRequired: number;
  }>) {
    return prisma.loyaltySettings.upsert({
      where: { hotelId },
      update: data,
      create: { hotelId, ...data },
    });
  },

  async getMembers(hotelId: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [accounts, total] = await Promise.all([
      prisma.loyaltyAccount.findMany({
        where: { hotelId },
        include: {
          guest: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        },
        orderBy: { nightsThisYear: 'desc' },
        skip,
        take: limit,
      }),
      prisma.loyaltyAccount.count({ where: { hotelId } }),
    ]);
    return { accounts, total };
  },

  async manualAdjust(
    hotelId: string,
    guestId: string,
    nights: number,
    description: string,
  ) {
    const settings = await getSettings(hotelId);
    if (!settings) throw new AppError(404, 'Loyalty program not configured');

    const account = await getOrCreateAccount(guestId, hotelId);

    if (nights < 0 && account.nightsThisYear < Math.abs(nights)) {
      throw new AppError(400, 'Cannot reduce below 0');
    }

    const newNightsThisYear = account.nightsThisYear + nights;
    const newTotalNights = Math.max(0, account.totalNights + nights);
    const newTier = calculateTier(newNightsThisYear, settings);

    await prisma.$transaction(async (tx) => {
      await tx.loyaltyTransaction.create({
        data: {
          accountId: account.id,
          type: LoyaltyTransactionType.MANUAL_ADJUST,
          nights,
          description: description || 'Manual adjustment by hotel',
        },
      });

      await tx.loyaltyAccount.update({
        where: { id: account.id },
        data: {
          nightsThisYear: newNightsThisYear,
          totalNights: newTotalNights,
          tier: newTier,
        },
      });
    });

    logger.info({ hotelId, guestId, nights }, '[Loyalty] Manual adjustment');
    return prisma.loyaltyAccount.findUnique({
      where: { guestId_hotelId: { guestId, hotelId } },
    });
  },

  async getStats(hotelId: string) {
    const [totalMembers, totals, byTier] = await Promise.all([
      prisma.loyaltyAccount.count({ where: { hotelId } }),
      prisma.loyaltyAccount.aggregate({
        where: { hotelId },
        _sum: { nightsThisYear: true, totalNights: true },
      }),
      prisma.loyaltyAccount.groupBy({
        by: ['tier'],
        where: { hotelId },
        _count: { id: true },
      }),
    ]);

    return {
      totalMembers,
      totalNightsThisYear: totals._sum.nightsThisYear ?? 0,
      totalLifetimeNights: totals._sum.totalNights ?? 0,
      byTier: byTier.reduce(
        (acc, row) => ({ ...acc, [row.tier]: row._count.id }),
        {} as Record<string, number>,
      ),
    };
  },
};
