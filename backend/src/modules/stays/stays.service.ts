import { prisma } from '../../config/database';
import { AppError } from '../../shared/middleware/errorHandler';
import { PMSFactory } from '../pms/PMSFactory';
import { logger } from '../../shared/utils/logger';

/**
 * Find a system staff member to use as task creator when creating
 * InternalTask on behalf of a guest.
 */
async function findSystemStaff(hotelId: string) {
  return prisma.staffMember.findFirst({
    where: {
      hotelId,
      isActive: true,
      role: { in: ['GENERAL_MANAGER', 'HEAD_OF_DEPT', 'SUPERVISOR', 'RECEPTIONIST'] },
    },
  });
}

export const staysService = {
  /**
   * Request a late checkout for a stay.
   * Creates a LateCheckoutRequest record and an URGENT InternalTask for front office.
   */
  async requestLateCheckout(
    stayId: string,
    guestId: string,
    requestedTime: string,
    notes?: string,
  ) {
    const stay = await prisma.guestStay.findFirst({
      where: { id: stayId, guestId },
    });

    if (!stay) throw new AppError(404, 'Stay not found');
    if (stay.stage === 'POST_STAY' || stay.stage === 'BETWEEN_STAYS') {
      throw new AppError(400, 'Cannot request late checkout after checkout');
    }

    // Check for existing pending request
    const existing = await prisma.lateCheckoutRequest.findFirst({
      where: { stayId, status: 'PENDING' },
    });
    if (existing) return existing;

    const systemStaff = await findSystemStaff(stay.hotelId);

    let taskId: string | undefined;

    if (systemStaff) {
      const task = await prisma.internalTask.create({
        data: {
          hotelId: stay.hotelId,
          title: `Late Checkout — Room ${stay.roomNumber ?? 'unknown'}`,
          description: [
            `Guest requested late checkout until ${requestedTime}.`,
            notes ? `Note: ${notes}` : '',
            stay.checkOut ? `Scheduled checkout: ${stay.checkOut.toISOString().slice(0, 10)}` : '',
          ]
            .filter(Boolean)
            .join(' '),
          department: 'FRONT_OFFICE',
          locationLabel: stay.roomNumber ? `Room ${stay.roomNumber}` : undefined,
          roomNumber: stay.roomNumber ?? undefined,
          priority: 'URGENT',
          status: 'NEW',
          createdById: systemStaff.id,
          source: 'BUTTON',
        },
      });
      taskId = task.id;
    } else {
      logger.warn({ hotelId: stay.hotelId }, '[Stays] No staff to create late-checkout task');
    }

    const request = await prisma.lateCheckoutRequest.create({
      data: {
        stayId,
        requestedTime,
        notes,
        taskId,
      },
    });

    logger.info({ requestId: request.id, stayId, requestedTime }, '[Stays] Late checkout requested');
    return request;
  },

  /**
   * Get the current late checkout request for a stay.
   */
  async getLateCheckoutStatus(stayId: string, guestId: string) {
    const stay = await prisma.guestStay.findFirst({
      where: { id: stayId, guestId },
      select: { id: true },
    });
    if (!stay) throw new AppError(404, 'Stay not found');

    return prisma.lateCheckoutRequest.findFirst({
      where: { stayId },
      orderBy: { createdAt: 'desc' },
    });
  },

  /**
   * Approve or decline a late checkout request (dashboard / staff use).
   */
  async procesLateCheckoutRequest(
    requestId: string,
    decision: 'APPROVED' | 'DECLINED',
  ) {
    const request = await prisma.lateCheckoutRequest.findUnique({
      where: { id: requestId },
    });
    if (!request) throw new AppError(404, 'Late checkout request not found');

    return prisma.lateCheckoutRequest.update({
      where: { id: requestId },
      data: { status: decision },
    });
  },

  /**
   * Request a stay extension.
   * Checks PMS availability if adapter supports it, then records the request.
   */
  async requestExtension(
    stayId: string,
    guestId: string,
    newCheckOut: Date,
  ) {
    const stay = await prisma.guestStay.findFirst({
      where: { id: stayId, guestId },
      include: { hotel: { include: { pmsConfig: true } } },
    });

    if (!stay) throw new AppError(404, 'Stay not found');
    if (!stay.checkOut) throw new AppError(400, 'Stay has no checkout date');
    if (newCheckOut <= stay.checkOut) {
      throw new AppError(400, 'New checkout must be after current checkout');
    }

    // Check PMS availability if configured
    if (stay.hotel.pmsConfig?.isActive) {
      try {
        const adapter = PMSFactory.create(stay.hotel.pmsConfig);
        const checkFn = (adapter as unknown as { checkRoomAvailability?: (r: string, f: Date, t: Date) => Promise<boolean> }).checkRoomAvailability;

        if (typeof checkFn === 'function' && stay.roomNumber) {
          const available = await checkFn.call(adapter, stay.roomNumber, stay.checkOut, newCheckOut);
          if (!available) {
            throw new AppError(409, 'Room is not available for the requested dates. Please contact reception.');
          }
        }
      } catch (err) {
        if (err instanceof AppError) throw err;
        logger.warn({ err, stayId }, '[Stays] PMS availability check failed — proceeding with request');
      }
    }

    const systemStaff = await findSystemStaff(stay.hotelId);

    if (systemStaff) {
      await prisma.internalTask.create({
        data: {
          hotelId: stay.hotelId,
          title: `Stay Extension Request — Room ${stay.roomNumber ?? 'unknown'}`,
          description: `Guest requests extension until ${newCheckOut.toISOString().slice(0, 10)}. Current checkout: ${stay.checkOut.toISOString().slice(0, 10)}.`,
          department: 'FRONT_OFFICE',
          locationLabel: stay.roomNumber ? `Room ${stay.roomNumber}` : undefined,
          roomNumber: stay.roomNumber ?? undefined,
          priority: 'HIGH',
          status: 'NEW',
          createdById: systemStaff.id,
          source: 'BUTTON',
        },
      });
    }

    const updated = await prisma.guestStay.update({
      where: { id: stayId },
      data: {
        extensionRequestedUntil: newCheckOut,
        extensionStatus: 'PENDING',
      },
    });

    logger.info({ stayId, newCheckOut }, '[Stays] Extension requested');
    return { extensionRequestedUntil: updated.extensionRequestedUntil, extensionStatus: updated.extensionStatus };
  },
};
