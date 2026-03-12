import { prisma } from '../../config/database';
import { logger } from '../../shared/utils/logger';

const MS_IN_DAY = 86_400_000;

/**
 * Recalculates behavioral fields on GuestProfile from actual data.
 * Called after checkout, order completion, or manually from admin.
 */
export async function refreshGuestProfileStats(guestId: string): Promise<void> {
  const [allStays, allOrders] = await Promise.all([
    prisma.guestStay.findMany({
      where: { guestId },
      select: {
        checkIn: true,
        checkOut: true,
        roomType: true,
        totalSpentDuringStay: true,
        hotelId: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.order.findMany({
      where: { guestId, status: { not: 'CANCELLED' } },
      select: {
        subtotal: true,
        items: {
          select: { service: { select: { name: true } } },
        },
      },
    }),
  ]);

  const totalBookings = allStays.length;
  const totalSpent = allStays.reduce((sum, s) => sum + (s.totalSpentDuringStay || 0), 0)
    + allOrders.reduce((sum, o) => sum + Number(o.subtotal), 0);

  const staysWithDates = allStays.filter((s) => s.checkIn && s.checkOut);
  const avgStayNights =
    staysWithDates.length > 0
      ? staysWithDates.reduce(
          (sum, s) => sum + Math.ceil((s.checkOut!.getTime() - s.checkIn!.getTime()) / MS_IN_DAY),
          0,
        ) / staysWithDates.length
      : 0;

  const lastVisitAt = allStays.length > 0 ? allStays[0].updatedAt : null;

  // Favorite room type
  const roomTypes = allStays.map((s) => s.roomType).filter(Boolean) as string[];
  const roomTypeFreq = roomTypes.reduce(
    (acc, t) => {
      acc[t] = (acc[t] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
  const favoriteRoomType =
    Object.entries(roomTypeFreq).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  // Top ordered items
  const itemNames = allOrders.flatMap((o) => o.items.map((i) => i.service.name));
  const itemFreq = itemNames.reduce(
    (acc, name) => {
      acc[name] = (acc[name] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
  const topOrderedItems = Object.entries(itemFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name]) => name);

  // Most visited hotel
  const hotelFreq = allStays.reduce(
    (acc, s) => {
      acc[s.hotelId] = (acc[s.hotelId] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
  const mostVisitedHotel =
    Object.entries(hotelFreq).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  await prisma.guestProfile.upsert({
    where: { guestId },
    update: {
      totalBookings,
      totalSpent,
      avgStayNights: Math.round(avgStayNights * 10) / 10,
      lastVisitAt,
      favoriteRoomType,
      topOrderedItems,
      mostVisitedHotel,
    },
    create: {
      guestId,
      totalBookings,
      totalSpent,
      avgStayNights: Math.round(avgStayNights * 10) / 10,
      lastVisitAt,
      favoriteRoomType,
      topOrderedItems,
      mostVisitedHotel,
    },
  });

  logger.info({ guestId, totalBookings, totalSpent }, '[GuestProfile] Stats refreshed');
}
