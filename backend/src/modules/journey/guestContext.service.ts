import { prisma } from '../../config/database';
import { logger } from '../../shared/utils/logger';
import { computeSubStage } from './journey.service';

/**
 * The full guest context object sent to AI prompts.
 * Contains everything the AI agent needs to personalize the conversation.
 */
export interface GuestAIContext {
  // Guest identity
  guest: {
    id: string;
    firstName: string;
    lastName: string | null;
    language: string;
  };

  // Demographics & preferences (from GuestProfile)
  profile: {
    gender: string | null;
    ageRange: string | null;
    country: string | null;
    city: string | null;
    budget: string | null;
    travelStyle: string | null;
    interests: string[];
    dietaryNeeds: string[];
    guestSummary: string | null;
  } | null;

  // Current journey state
  journey: {
    stage: string;
    subStage: string;
    stayId: string | null;
    roomNumber: string | null;
    roomType: string | null;
    checkIn: string | null;
    checkOut: string | null;
    daysUntilCheckIn: number | null;
    daysUntilCheckOut: number | null;
    daysInHotel: number | null;
    totalNights: number | null;
    preCheckinCompleted: boolean;
  };

  // Hotel info
  hotel: {
    id: string;
    name: string;
    timezone: string;
    location: string | null;
    description: string | null;
    contactPhone: string | null;
  } | null;

  // Behavioral data
  behavior: {
    totalBookings: number;
    totalSpent: number;
    avgStayNights: number;
    lastVisitAt: string | null;
    favoriteRoomType: string | null;
    topOrderedItems: string[];
    loyaltyTier: string | null;
    loyaltyNightsThisYear: number;
    loyaltyTotalNights: number;
  };

  // Current stay spending & orders
  currentStay: {
    totalSpent: number;
    ordersCount: number;
    serviceRequestsCount: number;
    recentOrders: Array<{
      type: string;
      status: string;
      items: string[];
      createdAt: string;
    }>;
  };

  // Time context
  timeContext: {
    currentTime: string;
    timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
    dayOfWeek: string;
  };
}

const MS_IN_DAY = 86_400_000;

function getTimeOfDay(hour: number): 'morning' | 'afternoon' | 'evening' | 'night' {
  if (hour >= 6 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  if (hour >= 18 && hour < 23) return 'evening';
  return 'night';
}

function getDayOfWeek(date: Date): string {
  return ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][date.getDay()];
}

/**
 * Builds the full AI context for a guest at a specific hotel.
 * This is the single source of truth for all prompt personalization.
 */
export async function buildGuestAIContext(
  guestId: string,
  hotelId: string,
): Promise<GuestAIContext> {
  const now = new Date();

  // Parallel queries for performance
  const [guest, guestProfile, stay, hotel, loyalty, stayOrders, stayServiceRequests, allStays] =
    await Promise.all([
      prisma.guestAccount.findUnique({
        where: { id: guestId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          language: true,
        },
      }),
      prisma.guestProfile.findUnique({
        where: { guestId },
      }),
      // Find active or upcoming stay at this hotel
      prisma.guestStay.findFirst({
        where: {
          guestId,
          hotelId,
          stage: { in: ['PRE_ARRIVAL', 'CHECKED_IN', 'IN_STAY', 'CHECKOUT', 'POST_STAY'] },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.hotel.findUnique({
        where: { id: hotelId },
        select: {
          id: true,
          name: true,
          timezone: true,
          location: true,
          description: true,
          contactPhone: true,
        },
      }),
      prisma.loyaltyAccount.findFirst({
        where: { guestId, hotelId },
        select: { tier: true, nightsThisYear: true, totalNights: true },
      }),
      // Orders during current/recent stays at this hotel
      prisma.order.findMany({
        where: { guestId, hotelId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          items: {
            include: { service: { select: { name: true } } },
          },
        },
      }),
      // Service requests during current stay
      prisma.serviceRequest.findMany({
        where: { guestId, hotelId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      // All stays for behavioral stats
      prisma.guestStay.findMany({
        where: { guestId },
        select: {
          checkIn: true,
          checkOut: true,
          roomType: true,
          totalSpentDuringStay: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

  if (!guest) {
    logger.warn({ guestId }, '[GuestContext] Guest not found');
    throw new Error('Guest not found');
  }

  // Compute journey context
  const daysUntilCheckIn = stay?.checkIn
    ? Math.ceil((stay.checkIn.getTime() - now.getTime()) / MS_IN_DAY)
    : null;
  const daysUntilCheckOut = stay?.checkOut
    ? Math.ceil((stay.checkOut.getTime() - now.getTime()) / MS_IN_DAY)
    : null;
  const daysInHotel = stay?.checkIn
    ? Math.max(0, Math.ceil((now.getTime() - stay.checkIn.getTime()) / MS_IN_DAY))
    : null;
  const totalNights =
    stay?.checkIn && stay?.checkOut
      ? Math.ceil((stay.checkOut.getTime() - stay.checkIn.getTime()) / MS_IN_DAY)
      : null;

  // Compute behavioral stats
  const totalBookings = allStays.length;
  const totalSpent = guestProfile?.totalSpent ?? allStays.reduce((sum, s) => sum + (s.totalSpentDuringStay || 0), 0);
  const staysWithDates = allStays.filter((s) => s.checkIn && s.checkOut);
  const avgStayNights =
    staysWithDates.length > 0
      ? staysWithDates.reduce((sum, s) => {
          return sum + Math.ceil((s.checkOut!.getTime() - s.checkIn!.getTime()) / MS_IN_DAY);
        }, 0) / staysWithDates.length
      : 0;
  const lastVisitAt = allStays.length > 0 ? allStays[0].updatedAt : null;
  const favoriteRoomType = (() => {
    const types = allStays.map((s) => s.roomType).filter(Boolean) as string[];
    if (types.length === 0) return null;
    const freq = types.reduce(
      (acc, t) => {
        acc[t] = (acc[t] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
    return Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];
  })();

  // Top ordered items (food/service names by frequency)
  const itemNames = stayOrders.flatMap((o) => o.items.map((i) => i.service.name));
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

  // Current stay stats
  const currentStayTotalSpent = stayOrders
    .filter((o) => o.status !== 'CANCELLED')
    .reduce((sum, o) => sum + Number(o.subtotal), 0);

  const recentOrders = stayOrders.slice(0, 5).map((o) => ({
    type: o.type,
    status: o.status,
    items: o.items.map((i) => i.service.name),
    createdAt: o.createdAt.toISOString(),
  }));

  const hour = now.getHours();

  const subStage = stay
    ? computeSubStage(stay.stage, stay.checkIn, stay.checkOut, now)
    : 'IDLE';

  return {
    guest: {
      id: guest.id,
      firstName: guest.firstName,
      lastName: guest.lastName,
      language: guest.language || 'uk',
    },
    profile: guestProfile
      ? {
          gender: guestProfile.gender,
          ageRange: guestProfile.ageRange,
          country: guestProfile.country,
          city: guestProfile.city,
          budget: guestProfile.budget,
          travelStyle: guestProfile.travelStyle,
          interests: guestProfile.interests,
          dietaryNeeds: guestProfile.dietaryNeeds,
          guestSummary: guestProfile.guestSummary,
        }
      : null,
    journey: {
      stage: stay?.stage || 'BETWEEN_STAYS',
      subStage,
      stayId: stay?.id || null,
      roomNumber: stay?.roomNumber || null,
      roomType: stay?.roomType || null,
      checkIn: stay?.checkIn?.toISOString() || null,
      checkOut: stay?.checkOut?.toISOString() || null,
      daysUntilCheckIn,
      daysUntilCheckOut,
      daysInHotel,
      totalNights,
      preCheckinCompleted: stay?.preCheckinCompleted || false,
    },
    hotel: hotel
      ? {
          id: hotel.id,
          name: hotel.name,
          timezone: hotel.timezone,
          location: hotel.location,
          description: hotel.description,
          contactPhone: hotel.contactPhone,
        }
      : null,
    behavior: {
      totalBookings,
      totalSpent,
      avgStayNights: Math.round(avgStayNights * 10) / 10,
      lastVisitAt: lastVisitAt?.toISOString() || null,
      favoriteRoomType,
      topOrderedItems,
      loyaltyTier: loyalty?.tier || null,
      loyaltyNightsThisYear: loyalty?.nightsThisYear || 0,
      loyaltyTotalNights: loyalty?.totalNights || 0,
    },
    currentStay: {
      totalSpent: currentStayTotalSpent,
      ordersCount: stayOrders.length,
      serviceRequestsCount: stayServiceRequests.length,
      recentOrders,
    },
    timeContext: {
      currentTime: now.toISOString(),
      timeOfDay: getTimeOfDay(hour),
      dayOfWeek: getDayOfWeek(now),
    },
  };
}
