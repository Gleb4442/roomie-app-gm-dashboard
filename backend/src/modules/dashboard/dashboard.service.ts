import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../config/database';
import { env } from '../../config/environment';
import { AppError } from '../../shared/middleware/errorHandler';

// ── Auth ──────────────────────────────────────────────────────────────────────

export const dashboardAuthService = {
  async login(username: string, password: string) {
    const manager = await prisma.dashboardManager.findUnique({
      where: { username },
      include: { hotels: { include: { hotel: { select: { id: true, name: true, slug: true } } } } },
    });

    if (!manager) throw new AppError(401, 'Invalid credentials');

    const valid = await bcrypt.compare(password, manager.passwordHash);
    if (!valid) throw new AppError(401, 'Invalid credentials');

    const token = jwt.sign(
      { managerId: manager.id, role: manager.role },
      env.dashboardJwtSecret,
      { expiresIn: '7d' },
    );

    return {
      token,
      manager: {
        id: manager.id,
        username: manager.username,
        role: manager.role,
        hotels: manager.hotels.map((h) => h.hotel),
      },
    };
  },

  async deleteAccount(managerId: string) {
    const manager = await prisma.dashboardManager.findUnique({ where: { id: managerId } });
    if (!manager) throw new AppError(404, 'Manager not found');

    // DashboardManagerHotel has onDelete: Cascade, so it's auto-cleaned
    await prisma.dashboardManager.delete({ where: { id: managerId } });
    return { deleted: true };
  },
};

// ── Overview ──────────────────────────────────────────────────────────────────

export const dashboardOverviewService = {
  async get(hotelId: string) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [
      todayGuests,
      todayOrders,
      todayQRScans,
      todaySMS,
      ordersRevenue,
      recentOrders,
      recentStageChanges,
    ] = await Promise.all([
      prisma.guestStay.count({ where: { hotelId, stage: 'IN_STAY' } }),
      prisma.order.count({ where: { hotelId, createdAt: { gte: todayStart } } }),
      prisma.qRScan.count({ where: { qrCode: { hotelId }, scannedAt: { gte: todayStart } } }),
      prisma.sMSLog.count({ where: { hotelId, status: 'sent', createdAt: { gte: todayStart } } }),
      prisma.order.aggregate({
        where: { hotelId, createdAt: { gte: todayStart } },
        _sum: { subtotal: true },
      }),
      prisma.order.findMany({
        where: { hotelId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          items: { include: { service: { select: { name: true } } } },
          guest: { select: { firstName: true, lastName: true } },
        },
      }),
      prisma.stageTransition.findMany({
        where: { guestStay: { hotelId } },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          guestStay: {
            select: {
              roomNumber: true,
              guest: { select: { firstName: true, lastName: true } },
            },
          },
        },
      }),
    ]);

    return {
      todayGuests,
      todayOrders,
      todayQRScans,
      todaySMS,
      todayRevenue: Number(ordersRevenue._sum.subtotal || 0),
      recentOrders: recentOrders.map((o) => ({
        id: o.id,
        roomNumber: o.roomNumber,
        guestName: `${o.guest.firstName} ${o.guest.lastName || ''}`.trim(),
        items: o.items.map((i) => `${i.service.name} x${i.quantity}`).join(', '),
        status: o.status,
        totalAmount: Number(o.subtotal),
        createdAt: o.createdAt,
      })),
      recentGuestChanges: recentStageChanges.map((t) => ({
        guestName: `${t.guestStay.guest.firstName} ${t.guestStay.guest.lastName || ''}`.trim(),
        fromStage: t.fromStage,
        toStage: t.toStage,
        roomNumber: t.guestStay.roomNumber,
        changedAt: t.createdAt,
      })),
    };
  },
};

// ── Guests ────────────────────────────────────────────────────────────────────

export const dashboardGuestsService = {
  async list(hotelId: string, params: {
    stage?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = params.page || 1;
    const limit = Math.min(params.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { hotelId };

    if (params.stage) {
      where.stage = params.stage.toUpperCase();
    }

    if (params.search) {
      where.guest = {
        OR: [
          { firstName: { contains: params.search, mode: 'insensitive' } },
          { lastName: { contains: params.search, mode: 'insensitive' } },
          { email: { contains: params.search, mode: 'insensitive' } },
          { phone: { contains: params.search } },
        ],
      };
    }

    const [stays, total] = await Promise.all([
      prisma.guestStay.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          guest: { select: { firstName: true, lastName: true, phone: true, email: true } },
        },
      }),
      prisma.guestStay.count({ where }),
    ]);

    return {
      guests: stays.map((s) => ({
        id: s.id,
        guestId: s.guestId,
        guestName: `${s.guest.firstName} ${s.guest.lastName || ''}`.trim(),
        phone: s.guest.phone || '',
        email: s.guest.email,
        roomNumber: s.roomNumber,
        stage: s.stage,
        checkIn: s.checkIn,
        checkOut: s.checkOut,
        source: s.source,
        preCheckinCompleted: s.preCheckinCompleted,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  },
};

// ── Orders ────────────────────────────────────────────────────────────────────

export const dashboardOrdersService = {
  async list(hotelId: string, params: {
    status?: string;
    date?: string;
    page?: number;
    limit?: number;
  }) {
    const page = params.page || 1;
    const limit = Math.min(params.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { hotelId };

    if (params.status === 'active') {
      where.status = { in: ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'IN_TRANSIT'] };
    } else if (params.status === 'completed') {
      where.status = { in: ['DELIVERED', 'COMPLETED'] };
    }

    if (params.date) {
      const dateStart = new Date(params.date);
      const dateEnd = new Date(params.date);
      dateEnd.setDate(dateEnd.getDate() + 1);
      where.createdAt = { gte: dateStart, lt: dateEnd };
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          items: { include: { service: { select: { name: true } } } },
          guest: { select: { firstName: true, lastName: true } },
        },
      }),
      prisma.order.count({ where }),
    ]);

    return {
      orders: orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        roomNumber: o.roomNumber,
        guestName: `${o.guest.firstName} ${o.guest.lastName || ''}`.trim(),
        items: o.items.map((i) => ({
          name: i.service.name,
          quantity: i.quantity,
          price: Number(i.price),
        })),
        totalAmount: Number(o.subtotal),
        status: o.status,
        createdAt: o.createdAt,
        updatedAt: o.updatedAt,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  },
};

// ── Stats ─────────────────────────────────────────────────────────────────────

export const dashboardStatsService = {
  async get(hotelId: string, from: string, to: string) {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    toDate.setDate(toDate.getDate() + 1); // inclusive

    // Use $queryRaw for daily aggregations
    const [
      appOpensByDay,
      ordersByDay,
      qrScansByDay,
      qrScansByRoom,
      smsStat,
      guestStages,
      topItems,
      reservationsByDay,
      reservationsBySource,
      ordersAggregate,
    ] = await Promise.all([
      // App opens daily
      prisma.$queryRaw<Array<{ date: string; unique_guests: bigint; total_opens: bigint }>>`
        SELECT
          DATE_TRUNC('day', "createdAt")::date::text as date,
          COUNT(DISTINCT "guestId") as unique_guests,
          COUNT(*) as total_opens
        FROM app_opens
        WHERE "hotelId" = ${hotelId}
          AND "createdAt" >= ${fromDate}
          AND "createdAt" < ${toDate}
        GROUP BY DATE_TRUNC('day', "createdAt")
        ORDER BY date
      `,
      // Orders daily
      prisma.$queryRaw<Array<{ date: string; count: bigint; revenue: number }>>`
        SELECT
          DATE_TRUNC('day', "createdAt")::date::text as date,
          COUNT(*) as count,
          COALESCE(SUM(subtotal), 0)::float as revenue
        FROM orders
        WHERE "hotelId" = ${hotelId}
          AND "createdAt" >= ${fromDate}
          AND "createdAt" < ${toDate}
        GROUP BY DATE_TRUNC('day', "createdAt")
        ORDER BY date
      `,
      // QR scans daily
      prisma.$queryRaw<Array<{ date: string; count: bigint }>>`
        SELECT
          DATE_TRUNC('day', qs."scannedAt")::date::text as date,
          COUNT(*) as count
        FROM qr_scans qs
        JOIN qr_codes qc ON qs."qrCodeId" = qc.id
        WHERE qc."hotelId" = ${hotelId}
          AND qs."scannedAt" >= ${fromDate}
          AND qs."scannedAt" < ${toDate}
        GROUP BY DATE_TRUNC('day', qs."scannedAt")
        ORDER BY date
      `,
      // QR scans by room
      prisma.$queryRaw<Array<{ room_number: string; count: bigint }>>`
        SELECT
          qc."roomNumber" as room_number,
          COUNT(*) as count
        FROM qr_scans qs
        JOIN qr_codes qc ON qs."qrCodeId" = qc.id
        WHERE qc."hotelId" = ${hotelId}
          AND qs."scannedAt" >= ${fromDate}
          AND qs."scannedAt" < ${toDate}
        GROUP BY qc."roomNumber"
        ORDER BY count DESC
        LIMIT 20
      `,
      // SMS stats
      prisma.sMSLog.groupBy({
        by: ['template', 'status'],
        where: { hotelId, createdAt: { gte: fromDate, lt: toDate } },
        _count: true,
      }),
      // Guest stages
      prisma.guestStay.groupBy({
        by: ['stage'],
        where: { hotelId },
        _count: true,
      }),
      // Top order items
      prisma.$queryRaw<Array<{ name: string; count: bigint; revenue: number }>>`
        SELECT
          hs.name,
          SUM(oi.quantity) as count,
          SUM(oi.quantity * oi.price)::float as revenue
        FROM order_items oi
        JOIN hotel_services hs ON oi."serviceId" = hs.id
        JOIN orders o ON oi."orderId" = o.id
        WHERE o."hotelId" = ${hotelId}
          AND o."createdAt" >= ${fromDate}
          AND o."createdAt" < ${toDate}
        GROUP BY hs.name
        ORDER BY count DESC
        LIMIT 10
      `,
      // Reservations daily
      prisma.$queryRaw<Array<{ date: string; count: bigint }>>`
        SELECT
          DATE_TRUNC('day', "createdAt")::date::text as date,
          COUNT(*) as count
        FROM guest_stays
        WHERE "hotelId" = ${hotelId}
          AND "createdAt" >= ${fromDate}
          AND "createdAt" < ${toDate}
        GROUP BY DATE_TRUNC('day', "createdAt")
        ORDER BY date
      `,
      // Reservations by source
      prisma.guestStay.groupBy({
        by: ['source'],
        where: { hotelId, createdAt: { gte: fromDate, lt: toDate } },
        _count: true,
      }),
      // Orders aggregate
      prisma.order.aggregate({
        where: { hotelId, createdAt: { gte: fromDate, lt: toDate } },
        _count: true,
        _sum: { subtotal: true },
      }),
    ]);

    // Process SMS stats
    const smsTotal = smsStat.reduce((acc, s) => acc + s._count, 0);
    const smsDelivered = smsStat.filter((s) => s.status === 'sent').reduce((acc, s) => acc + s._count, 0);
    const smsFailed = smsStat.filter((s) => s.status === 'failed').reduce((acc, s) => acc + s._count, 0);
    const smsByTemplate = Object.entries(
      smsStat.reduce((acc: Record<string, number>, s) => {
        acc[s.template] = (acc[s.template] || 0) + s._count;
        return acc;
      }, {}),
    ).map(([template, count]) => ({ template, count }));

    // Pre-checkin conversion
    const totalGuests = guestStages.reduce((acc, s) => acc + s._count, 0);
    const [preCheckinCompleted] = await Promise.all([
      prisma.guestStay.count({
        where: { hotelId, preCheckinCompleted: true, createdAt: { gte: fromDate, lt: toDate } },
      }),
    ]);
    const totalInPeriod = await prisma.guestStay.count({
      where: { hotelId, createdAt: { gte: fromDate, lt: toDate } },
    });
    const preCheckinConversion = totalInPeriod > 0
      ? Math.round((preCheckinCompleted / totalInPeriod) * 100)
      : 0;

    const totalOrderCount = ordersAggregate._count;
    const totalRevenue = Number(ordersAggregate._sum.subtotal || 0);

    return {
      appOpens: {
        daily: appOpensByDay.map((r) => ({
          date: r.date,
          uniqueGuests: Number(r.unique_guests),
          totalOpens: Number(r.total_opens),
        })),
        totalUnique: appOpensByDay.reduce((acc, r) => acc + Number(r.unique_guests), 0),
      },
      orders: {
        daily: ordersByDay.map((r) => ({
          date: r.date,
          count: Number(r.count),
          revenue: r.revenue,
        })),
        totalCount: totalOrderCount,
        totalRevenue,
        averageCheck: totalOrderCount > 0 ? Math.round(totalRevenue / totalOrderCount * 100) / 100 : 0,
        topItems: topItems.map((r) => ({
          name: r.name,
          count: Number(r.count),
          revenue: r.revenue,
        })),
      },
      sms: {
        total: smsTotal,
        delivered: smsDelivered,
        failed: smsFailed,
        byTemplate: smsByTemplate,
      },
      qrScans: {
        daily: qrScansByDay.map((r) => ({ date: r.date, count: Number(r.count) })),
        byRoom: qrScansByRoom.map((r) => ({ roomNumber: r.room_number, count: Number(r.count) })),
        total: qrScansByDay.reduce((acc, r) => acc + Number(r.count), 0),
      },
      guestJourney: {
        preArrival: guestStages.find((s) => s.stage === 'PRE_ARRIVAL')?._count || 0,
        inStay: guestStages.find((s) => s.stage === 'IN_STAY')?._count || 0,
        postStay: guestStages.find((s) => s.stage === 'POST_STAY')?._count || 0,
        preCheckinConversion,
        totalGuestsInPeriod: totalInPeriod,
      },
      reservations: {
        daily: reservationsByDay.map((r) => ({ date: r.date, count: Number(r.count) })),
        bySource: reservationsBySource.map((s) => ({ source: s.source || 'unknown', count: s._count })),
        total: reservationsByDay.reduce((acc, r) => acc + Number(r.count), 0),
      },
    };
  },
};

// ── Bookings ─────────────────────────────────────────────────────────────────

export const dashboardBookingsService = {
  async list(hotelId: string, params: {
    stage?: string;
    search?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  }) {
    const page = params.page || 1;
    const limit = Math.min(params.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { hotelId };

    if (params.stage && params.stage !== 'all') {
      where.stage = params.stage.toUpperCase();
    }

    if (params.search) {
      where.OR = [
        { bookingRef: { contains: params.search, mode: 'insensitive' } },
        { roomNumber: { contains: params.search, mode: 'insensitive' } },
        { guest: { OR: [
          { firstName: { contains: params.search, mode: 'insensitive' } },
          { lastName: { contains: params.search, mode: 'insensitive' } },
          { email: { contains: params.search, mode: 'insensitive' } },
          { phone: { contains: params.search } },
        ] } },
      ];
    }

    if (params.from) {
      where.checkIn = { ...(where.checkIn as Record<string, unknown> || {}), gte: new Date(params.from) };
    }
    if (params.to) {
      where.checkOut = { ...(where.checkOut as Record<string, unknown> || {}), lte: new Date(params.to) };
    }

    const [stays, total, stats] = await Promise.all([
      prisma.guestStay.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          guest: { select: { firstName: true, lastName: true, phone: true, email: true } },
        },
      }),
      prisma.guestStay.count({ where }),
      prisma.guestStay.groupBy({
        by: ['stage'],
        where: { hotelId },
        _count: true,
      }),
    ]);

    return {
      bookings: stays.map((s) => ({
        id: s.id,
        bookingRef: s.bookingRef,
        guestName: `${s.guest.firstName} ${s.guest.lastName || ''}`.trim(),
        guestEmail: s.guest.email,
        guestPhone: s.guest.phone || '',
        roomNumber: s.roomNumber,
        stage: s.stage,
        subStage: s.subStage,
        checkIn: s.checkIn,
        checkOut: s.checkOut,
        source: s.source,
        preCheckinCompleted: s.preCheckinCompleted,
        totalSpentDuringStay: Number(s.totalSpentDuringStay),
        createdAt: s.createdAt,
      })),
      stats: {
        total: stats.reduce((a, s) => a + s._count, 0),
        preArrival: stats.find((s) => s.stage === 'PRE_ARRIVAL')?._count || 0,
        inStay: stats.find((s) => s.stage === 'IN_STAY')?._count || 0,
        checkout: stats.find((s) => s.stage === 'CHECKOUT')?._count || 0,
        postStay: stats.find((s) => s.stage === 'POST_STAY')?._count || 0,
      },
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  },
};

// ── SMS Logs ──────────────────────────────────────────────────────────────────

export const dashboardSmsLogsService = {
  async list(hotelId: string, params: { page?: number; limit?: number; status?: string }) {
    const page = params.page || 1;
    const limit = Math.min(params.limit || 20, 100);
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = { hotelId };
    if (params.status) where.status = params.status;

    const [logs, total] = await Promise.all([
      prisma.sMSLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, phone: true, template: true, provider: true,
          status: true, errorMsg: true, sentAt: true, createdAt: true,
        },
      }),
      prisma.sMSLog.count({ where }),
    ]);

    return { logs, total, page, totalPages: Math.ceil(total / limit) };
  },
};

// ── Hotel Settings ───────────────────────────────────────────────────────────

export const dashboardSettingsService = {
  async get(hotelId: string) {
    const hotel = await prisma.hotel.findUniqueOrThrow({
      where: { id: hotelId },
      select: {
        id: true,
        name: true,
        slug: true,
        location: true,
        description: true,
        accentColor: true,
        imageUrl: true,
        contactEmail: true,
        contactPhone: true,
        timezone: true,
        settings: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return hotel;
  },

  async update(hotelId: string, data: Partial<{
    name: string;
    location: string;
    description: string;
    accentColor: string;
    imageUrl: string;
    contactEmail: string;
    contactPhone: string;
    timezone: string;
    settings: object;
  }>) {
    // Don't allow slug changes from dashboard (admin only)
    const { ...safeData } = data;
    return prisma.hotel.update({
      where: { id: hotelId },
      data: safeData,
      select: {
        id: true,
        name: true,
        slug: true,
        location: true,
        description: true,
        accentColor: true,
        imageUrl: true,
        contactEmail: true,
        contactPhone: true,
        timezone: true,
        settings: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  },
};

// ── Service Catalog ──────────────────────────────────────────────────────────

export const dashboardServiceCatalogService = {
  async list(hotelId: string) {
    return prisma.serviceCategory.findMany({
      where: { hotelId },
      orderBy: { sortOrder: 'asc' },
      include: {
        items: { orderBy: { sortOrder: 'asc' } },
        _count: { select: { requests: true } },
      },
    });
  },

  async createCategory(hotelId: string, data: {
    name: string;
    nameUk?: string;
    nameEn?: string;
    slug: string;
    icon?: string;
    description?: string;
    sortOrder?: number;
    requiresRoom?: boolean;
    requiresTimeSlot?: boolean;
    autoAccept?: boolean;
    estimatedMinutes?: number;
  }) {
    return prisma.serviceCategory.create({
      data: { hotelId, ...data },
      include: { items: true },
    });
  },

  async updateCategory(categoryId: string, data: Partial<{
    name: string;
    nameUk: string;
    nameEn: string;
    icon: string;
    description: string;
    sortOrder: number;
    isActive: boolean;
    requiresRoom: boolean;
    requiresTimeSlot: boolean;
    autoAccept: boolean;
    estimatedMinutes: number;
  }>) {
    return prisma.serviceCategory.update({
      where: { id: categoryId },
      data,
      include: { items: true },
    });
  },

  async deleteCategory(categoryId: string) {
    return prisma.serviceCategory.delete({ where: { id: categoryId } });
  },

  async createItem(categoryId: string, data: {
    name: string;
    nameUk?: string;
    nameEn?: string;
    description?: string;
    icon?: string;
    photoUrl?: string;
    price?: number;
    currency?: string;
    maxQuantity?: number;
    sortOrder?: number;
  }) {
    return prisma.serviceItem.create({ data: { categoryId, ...data } });
  },

  async updateItem(itemId: string, data: Partial<{
    name: string;
    nameUk: string;
    nameEn: string;
    description: string;
    icon: string;
    photoUrl: string;
    price: number;
    currency: string;
    isActive: boolean;
    maxQuantity: number;
    sortOrder: number;
  }>) {
    return prisma.serviceItem.update({ where: { id: itemId }, data });
  },

  async deleteItem(itemId: string) {
    return prisma.serviceItem.delete({ where: { id: itemId } });
  },
};

// ── Guest Detail ─────────────────────────────────────────────────────────────

export const dashboardGuestDetailService = {
  async get(hotelId: string, guestId: string) {
    const guest = await prisma.guestAccount.findUniqueOrThrow({
      where: { id: guestId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        language: true,
        createdVia: true,
        createdAt: true,
        guestProfile: true,
        tags: { where: { hotelId }, select: { id: true, tag: true, source: true, createdAt: true } },
        loyaltyAccounts: { where: { hotelId }, select: { nightsThisYear: true, totalNights: true, tier: true } },
      },
    });

    // Stays for this hotel only
    const stays = await prisma.guestStay.findMany({
      where: { guestId, hotelId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, bookingRef: true, roomNumber: true, roomType: true,
        stage: true, subStage: true, checkIn: true, checkOut: true,
        source: true, preCheckinCompleted: true, totalSpentDuringStay: true,
        createdAt: true,
      },
    });

    // Recent orders for this hotel
    const orders = await prisma.order.findMany({
      where: { guestId, hotelId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true, orderNumber: true, type: true, status: true,
        subtotal: true, currency: true, roomNumber: true,
        rating: true, ratingComment: true,
        createdAt: true,
        items: { select: { serviceId: true, quantity: true, price: true, service: { select: { name: true } } } },
      },
    });

    // Recent service requests for this hotel
    const serviceRequests = await prisma.serviceRequest.findMany({
      where: { guestId, hotelId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true, roomNumber: true, status: true, comment: true,
        totalAmount: true, rating: true, ratingComment: true,
        createdAt: true, completedAt: true,
        category: { select: { name: true, icon: true } },
      },
    });

    // Reviews for this hotel
    const reviews = await prisma.guestReview.findMany({
      where: { guestId, hotelId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    // Active offers
    const offers = await prisma.guestOffer.findMany({
      where: { guestId, hotelId, status: { in: ['ACTIVE', 'SENT', 'VIEWED'] } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    const currentStay = stays.find(s => s.stage !== 'BETWEEN_STAYS' && s.stage !== 'POST_STAY');

    return {
      guest,
      stays,
      currentStay: currentStay ?? null,
      orders,
      serviceRequests,
      reviews,
      offers,
    };
  },

  async addTag(hotelId: string, guestId: string, tag: string, source = 'manual') {
    return prisma.guestTag.upsert({
      where: { guestId_hotelId_tag: { guestId, hotelId, tag } },
      create: { guestId, hotelId, tag, source },
      update: {},
    });
  },

  async removeTag(tagId: string) {
    return prisma.guestTag.delete({ where: { id: tagId } });
  },
};

// ── Reviews ──────────────────────────────────────────────────────────────────

export const dashboardReviewsService = {
  async list(hotelId: string, params: {
    rating?: number;
    page?: number;
    limit?: number;
  }) {
    const page = params.page || 1;
    const limit = Math.min(params.limit || 20, 100);
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = { hotelId };
    if (params.rating) where.rating = params.rating;

    const [reviews, total, stats] = await Promise.all([
      prisma.guestReview.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          guest: { select: { firstName: true, lastName: true, email: true } },
        },
      }),
      prisma.guestReview.count({ where }),
      prisma.guestReview.aggregate({
        where: { hotelId },
        _avg: { rating: true },
        _count: true,
      }),
    ]);

    // Rating distribution
    const distribution = await prisma.guestReview.groupBy({
      by: ['rating'],
      where: { hotelId },
      _count: true,
    });

    return {
      reviews: reviews.map(r => ({
        ...r,
        guestName: `${r.guest.firstName} ${r.guest.lastName || ''}`.trim(),
        guestEmail: r.guest.email,
      })),
      stats: {
        avgRating: Math.round((stats._avg.rating ?? 0) * 10) / 10,
        totalReviews: stats._count,
        distribution: Object.fromEntries(
          [1, 2, 3, 4, 5].map(r => [r, distribution.find(d => d.rating === r)?._count || 0]),
        ),
      },
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  },

  async reply(reviewId: string, managerReply: string) {
    return prisma.guestReview.update({
      where: { id: reviewId },
      data: { managerReply, repliedAt: new Date() },
    });
  },
};

// ── Offers ────────────────────────────────────────────────────────────────────

export const dashboardOffersService = {
  async list(hotelId: string, params: {
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const page = params.page || 1;
    const limit = Math.min(params.limit || 20, 100);
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = { hotelId };
    if (params.status && params.status !== 'all') where.status = params.status;

    const [offers, total] = await Promise.all([
      prisma.guestOffer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          guest: { select: { firstName: true, lastName: true, email: true } },
        },
      }),
      prisma.guestOffer.count({ where }),
    ]);

    return {
      offers: offers.map(o => ({
        ...o,
        guestName: o.guest ? `${o.guest.firstName} ${o.guest.lastName || ''}`.trim() : null,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  },

  async create(hotelId: string, data: {
    guestId?: string;
    title: string;
    description: string;
    discountType?: string;
    discountValue?: number;
    code?: string;
    validFrom?: string;
    validUntil: string;
    triggerRule?: string;
    status?: string;
  }) {
    return prisma.guestOffer.create({
      data: {
        hotelId,
        guestId: data.guestId || null,
        title: data.title,
        description: data.description,
        discountType: data.discountType || 'percent',
        discountValue: data.discountValue || 0,
        code: data.code,
        validFrom: data.validFrom ? new Date(data.validFrom) : new Date(),
        validUntil: new Date(data.validUntil),
        triggerRule: data.triggerRule,
        status: (data.status as 'DRAFT' | 'ACTIVE') || 'DRAFT',
      },
    });
  },

  async update(offerId: string, data: Partial<{
    title: string;
    description: string;
    discountType: string;
    discountValue: number;
    code: string;
    validUntil: string;
    status: string;
  }>) {
    const updateData: Record<string, unknown> = { ...data };
    if (data.validUntil) updateData.validUntil = new Date(data.validUntil);
    return prisma.guestOffer.update({ where: { id: offerId }, data: updateData });
  },

  async delete(offerId: string) {
    return prisma.guestOffer.delete({ where: { id: offerId } });
  },
};

// ── Push Notifications ───────────────────────────────────────────────────────

async function sendExpoPush(tokens: string[], title: string, body: string, data?: Record<string, unknown>) {
  const messages = tokens
    .filter(t => t.startsWith('ExponentPushToken[') || t.startsWith('ExpoPushToken['))
    .map(to => ({ to, title, body, sound: 'default' as const, priority: 'high' as const, data }));

  if (messages.length === 0) return 0;

  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages),
    });
    return messages.length;
  } catch {
    return 0;
  }
}

export const dashboardNotificationsService = {
  async sendToGuest(hotelId: string, guestId: string, title: string, body: string, sentBy: string) {
    const guest = await prisma.guestAccount.findUnique({
      where: { id: guestId },
      select: { expoPushToken: true },
    });

    const tokens = guest?.expoPushToken ? [guest.expoPushToken] : [];
    const sentCount = await sendExpoPush(tokens, title, body, { screen: 'notifications' });

    return prisma.pushNotificationLog.create({
      data: { hotelId, title, body, targetType: 'individual', targetGuestId: guestId, sentCount, sentBy },
    });
  },

  async broadcast(hotelId: string, title: string, body: string, sentBy: string, targetStage?: string) {
    // Find all guests with push tokens linked to this hotel
    const stayWhere: Record<string, unknown> = { hotelId };
    if (targetStage) stayWhere.stage = targetStage;

    const stays = await prisma.guestStay.findMany({
      where: stayWhere,
      select: { guest: { select: { expoPushToken: true } } },
      distinct: ['guestId'],
    });

    const tokens = stays
      .map(s => s.guest.expoPushToken)
      .filter((t): t is string => !!t);

    const sentCount = await sendExpoPush(tokens, title, body, { screen: 'notifications' });

    return prisma.pushNotificationLog.create({
      data: {
        hotelId,
        title,
        body,
        targetType: targetStage ? 'stage' : 'all',
        targetStage: targetStage || null,
        sentCount,
        sentBy,
      },
    });
  },

  async history(hotelId: string, params: { page?: number; limit?: number }) {
    const page = params.page || 1;
    const limit = Math.min(params.limit || 20, 100);
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      prisma.pushNotificationLog.findMany({
        where: { hotelId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          guest: { select: { firstName: true, lastName: true } },
        },
      }),
      prisma.pushNotificationLog.count({ where: { hotelId } }),
    ]);

    return {
      logs: logs.map(l => ({
        ...l,
        guestName: l.guest ? `${l.guest.firstName} ${l.guest.lastName || ''}`.trim() : null,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  },
};
