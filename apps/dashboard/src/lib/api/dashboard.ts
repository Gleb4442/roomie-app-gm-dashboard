import axios from 'axios';
import { getApiBase } from '../utils';
import type {
  OverviewData,
  GuestsResponse,
  OrdersResponse,
  QRCode,
  StatsData,
  SMSLogsResponse,
  HotelSettings,
  BookingsResponse,
  ServiceRequestsResponse,
  ServiceStatsData,
  ServiceRequestStatus,
} from '@/types/dashboard';

const api = axios.create({ baseURL: getApiBase() });

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export const dashboardApi = {
  login: async (username: string, password: string) => {
    const res = await api.post('/api/dashboard/auth/login', { username, password });
    return res.data.data as { token: string; manager: { id: string; username: string; role: string; hotels: Array<{ id: string; name: string; slug: string }> } };
  },

  deleteAccount: async (token: string) => {
    const res = await api.delete('/api/dashboard/me', { headers: authHeader(token) });
    return res.data;
  },

  getOverview: async (hotelId: string, token: string): Promise<OverviewData> => {
    const res = await api.get(`/api/dashboard/hotels/${hotelId}/overview`, {
      headers: authHeader(token),
    });
    return res.data.data;
  },

  getGuests: async (
    hotelId: string,
    token: string,
    params: { stage?: string; search?: string; page?: number; limit?: number }
  ): Promise<GuestsResponse> => {
    const res = await api.get(`/api/dashboard/hotels/${hotelId}/guests`, {
      headers: authHeader(token),
      params,
    });
    return res.data.data;
  },

  getOrders: async (
    hotelId: string,
    token: string,
    params: { status?: string; date?: string; page?: number; limit?: number }
  ): Promise<OrdersResponse> => {
    const res = await api.get(`/api/dashboard/hotels/${hotelId}/orders`, {
      headers: authHeader(token),
      params,
    });
    return res.data.data;
  },

  generateQR: async (hotelId: string, roomNumber: string, label: string | undefined, token: string): Promise<QRCode> => {
    const res = await api.post(`/api/dashboard/hotels/${hotelId}/qr/generate`, { roomNumber, label }, {
      headers: authHeader(token),
    });
    return res.data.data;
  },

  getQRCodes: async (hotelId: string, token: string): Promise<QRCode[]> => {
    const res = await api.get(`/api/dashboard/hotels/${hotelId}/qr`, {
      headers: authHeader(token),
    });
    return res.data.data;
  },

  getStats: async (
    hotelId: string,
    token: string,
    params: { from?: string; to?: string }
  ): Promise<StatsData> => {
    const res = await api.get(`/api/dashboard/hotels/${hotelId}/stats`, {
      headers: authHeader(token),
      params,
    });
    return res.data.data;
  },

  getSmsLogs: async (
    hotelId: string,
    token: string,
    params: { status?: string; page?: number; limit?: number }
  ): Promise<SMSLogsResponse> => {
    const res = await api.get(`/api/dashboard/hotels/${hotelId}/sms-logs`, {
      headers: authHeader(token),
      params,
    });
    return res.data.data;
  },

  getSettings: async (hotelId: string, token: string): Promise<HotelSettings> => {
    const res = await api.get(`/api/dashboard/hotels/${hotelId}/settings`, {
      headers: authHeader(token),
    });
    return res.data.data;
  },

  updateSettings: async (hotelId: string, token: string, data: Partial<HotelSettings>): Promise<HotelSettings> => {
    const res = await api.put(`/api/dashboard/hotels/${hotelId}/settings`, data, {
      headers: authHeader(token),
    });
    return res.data.data;
  },

  // ── Guest Detail ────────────────────────────────────────

  getGuestDetail: async (hotelId: string, guestId: string, token: string) => {
    const res = await api.get(`/api/dashboard/hotels/${hotelId}/guests/${guestId}`, {
      headers: authHeader(token),
    });
    return res.data.data;
  },

  addGuestTag: async (hotelId: string, guestId: string, tag: string, token: string) => {
    const res = await api.post(`/api/dashboard/hotels/${hotelId}/guests/${guestId}/tags`, { tag }, {
      headers: authHeader(token),
    });
    return res.data.data;
  },

  removeGuestTag: async (hotelId: string, guestId: string, tagId: string, token: string) => {
    const res = await api.delete(`/api/dashboard/hotels/${hotelId}/guests/${guestId}/tags/${tagId}`, {
      headers: authHeader(token),
    });
    return res.data;
  },

  // ── Reviews ────────────────────────────────────────────

  getReviews: async (hotelId: string, token: string, params: { rating?: number; page?: number; limit?: number }) => {
    const res = await api.get(`/api/dashboard/hotels/${hotelId}/reviews`, {
      headers: authHeader(token),
      params,
    });
    return res.data.data;
  },

  replyReview: async (hotelId: string, reviewId: string, managerReply: string, token: string) => {
    const res = await api.put(`/api/dashboard/hotels/${hotelId}/reviews/${reviewId}/reply`, { managerReply }, {
      headers: authHeader(token),
    });
    return res.data.data;
  },

  // ── Offers ─────────────────────────────────────────────

  getOffers: async (hotelId: string, token: string, params: { status?: string; page?: number; limit?: number }) => {
    const res = await api.get(`/api/dashboard/hotels/${hotelId}/offers`, {
      headers: authHeader(token),
      params,
    });
    return res.data.data;
  },

  createOffer: async (hotelId: string, token: string, data: Record<string, unknown>) => {
    const res = await api.post(`/api/dashboard/hotels/${hotelId}/offers`, data, {
      headers: authHeader(token),
    });
    return res.data.data;
  },

  updateOffer: async (hotelId: string, offerId: string, token: string, data: Record<string, unknown>) => {
    const res = await api.put(`/api/dashboard/hotels/${hotelId}/offers/${offerId}`, data, {
      headers: authHeader(token),
    });
    return res.data.data;
  },

  deleteOffer: async (hotelId: string, offerId: string, token: string) => {
    const res = await api.delete(`/api/dashboard/hotels/${hotelId}/offers/${offerId}`, {
      headers: authHeader(token),
    });
    return res.data;
  },

  // ── Push Notifications ────────────────────────────────────

  getNotificationHistory: async (hotelId: string, token: string, params: { page?: number; limit?: number }) => {
    const res = await api.get(`/api/dashboard/hotels/${hotelId}/notifications`, {
      headers: authHeader(token),
      params,
    });
    return res.data.data;
  },

  sendNotification: async (hotelId: string, token: string, data: { title: string; body: string; guestId: string }) => {
    const res = await api.post(`/api/dashboard/hotels/${hotelId}/notifications/send`, data, {
      headers: authHeader(token),
    });
    return res.data.data;
  },

  broadcastNotification: async (hotelId: string, token: string, data: { title: string; body: string; targetStage?: string }) => {
    const res = await api.post(`/api/dashboard/hotels/${hotelId}/notifications/broadcast`, data, {
      headers: authHeader(token),
    });
    return res.data.data;
  },

  // ── Service Catalog ──────────────────────────────────────

  getServiceCatalog: async (hotelId: string, token: string): Promise<ServiceCategoryFull[]> => {
    const res = await api.get(`/api/dashboard/hotels/${hotelId}/service-catalog`, {
      headers: authHeader(token),
    });
    return res.data.data;
  },

  createServiceCategory: async (hotelId: string, token: string, data: Partial<ServiceCategoryFull>): Promise<ServiceCategoryFull> => {
    const res = await api.post(`/api/dashboard/hotels/${hotelId}/service-catalog`, data, {
      headers: authHeader(token),
    });
    return res.data.data;
  },

  updateServiceCategory: async (hotelId: string, catId: string, token: string, data: Partial<ServiceCategoryFull>): Promise<ServiceCategoryFull> => {
    const res = await api.put(`/api/dashboard/hotels/${hotelId}/service-catalog/${catId}`, data, {
      headers: authHeader(token),
    });
    return res.data.data;
  },

  deleteServiceCategory: async (hotelId: string, catId: string, token: string) => {
    const res = await api.delete(`/api/dashboard/hotels/${hotelId}/service-catalog/${catId}`, {
      headers: authHeader(token),
    });
    return res.data;
  },

  createServiceItem: async (hotelId: string, catId: string, token: string, data: Partial<ServiceItemFull>): Promise<ServiceItemFull> => {
    const res = await api.post(`/api/dashboard/hotels/${hotelId}/service-catalog/${catId}/items`, data, {
      headers: authHeader(token),
    });
    return res.data.data;
  },

  updateServiceItem: async (hotelId: string, catId: string, itemId: string, token: string, data: Partial<ServiceItemFull>): Promise<ServiceItemFull> => {
    const res = await api.put(`/api/dashboard/hotels/${hotelId}/service-catalog/${catId}/items/${itemId}`, data, {
      headers: authHeader(token),
    });
    return res.data.data;
  },

  deleteServiceItem: async (hotelId: string, catId: string, itemId: string, token: string) => {
    const res = await api.delete(`/api/dashboard/hotels/${hotelId}/service-catalog/${catId}/items/${itemId}`, {
      headers: authHeader(token),
    });
    return res.data;
  },

  getBookings: async (
    hotelId: string,
    token: string,
    params: { stage?: string; search?: string; from?: string; to?: string; page?: number; limit?: number }
  ): Promise<BookingsResponse> => {
    const res = await api.get(`/api/dashboard/hotels/${hotelId}/bookings`, {
      headers: authHeader(token),
      params,
    });
    return res.data.data;
  },

  getServiceRequests: async (
    hotelId: string,
    token: string,
    params: { status?: string; page?: number; limit?: number }
  ): Promise<ServiceRequestsResponse> => {
    const res = await api.get(`/api/dashboard/hotels/${hotelId}/service-requests`, {
      headers: authHeader(token),
      params,
    });
    return res.data.data;
  },

  updateServiceRequestStatus: async (
    hotelId: string,
    requestId: string,
    status: ServiceRequestStatus,
    token: string,
    rejectionReason?: string
  ) => {
    const res = await api.put(
      `/api/dashboard/hotels/${hotelId}/service-requests/${requestId}/status`,
      { status, rejectionReason },
      { headers: authHeader(token) }
    );
    return res.data;
  },

  getServiceStats: async (hotelId: string, token: string): Promise<ServiceStatsData> => {
    const res = await api.get(`/api/dashboard/hotels/${hotelId}/service-stats`, {
      headers: authHeader(token),
    });
    return res.data.data;
  },

  getOrdersStreamUrl: (hotelId: string, token: string): string =>
    `${getApiBase()}/api/dashboard/hotels/${hotelId}/orders/stream?token=${token}`,

  getServiceRequestsStreamUrl: (hotelId: string, token: string): string =>
    `${getApiBase()}/api/dashboard/hotels/${hotelId}/service-requests/stream?token=${token}`,

  downloadQRPdf: (hotelId: string, qrId: string, token: string): string =>
    `${getApiBase()}/api/dashboard/hotels/${hotelId}/qr/${qrId}/pdf?token=${token}`,

  downloadAllQRZip: (hotelId: string, token: string): string =>
    `${getApiBase()}/api/dashboard/hotels/${hotelId}/qr/download-all?token=${token}`,

  // ── Staff TMS ──────────────────────────────────────────────

  getStaffList: async (hotelId: string, token: string): Promise<StaffMember[]> => {
    const res = await api.get(`/api/dashboard/staff/${hotelId}`, {
      headers: authHeader(token),
    });
    return res.data;
  },

  createStaff: async (hotelId: string, token: string, data: CreateStaffData): Promise<StaffMember> => {
    const res = await api.post(`/api/dashboard/staff/${hotelId}`, data, {
      headers: authHeader(token),
    });
    return res.data;
  },

  updateStaff: async (hotelId: string, staffId: string, token: string, data: UpdateStaffData): Promise<StaffMember> => {
    const res = await api.patch(`/api/dashboard/staff/${hotelId}/${staffId}`, data, {
      headers: authHeader(token),
    });
    return res.data;
  },

  deactivateStaff: async (hotelId: string, staffId: string, token: string) => {
    const res = await api.delete(`/api/dashboard/staff/${hotelId}/${staffId}`, {
      headers: authHeader(token),
    });
    return res.data;
  },

  resetStaffPin: async (hotelId: string, staffId: string, token: string, pin: string) => {
    const res = await api.post(
      `/api/dashboard/staff/${hotelId}/${staffId}/reset-pin`,
      { pin },
      { headers: authHeader(token) },
    );
    return res.data;
  },

  getTMSStats: async (hotelId: string, token: string): Promise<TMSStats> => {
    const res = await api.get(`/api/dashboard/staff/${hotelId}/stats`, {
      headers: authHeader(token),
    });
    return res.data;
  },

  // ── Templates ─────────────────────────────────────────────

  getTemplates: async (hotelId: string, token: string): Promise<TaskTemplate[]> => {
    const res = await api.get(`/api/dashboard/staff/${hotelId}/templates`, {
      headers: authHeader(token),
    });
    return res.data;
  },

  createTemplate: async (hotelId: string, token: string, data: TemplateFormData): Promise<TaskTemplate> => {
    const res = await api.post(`/api/dashboard/staff/${hotelId}/templates`, data, {
      headers: authHeader(token),
    });
    return res.data;
  },

  updateTemplate: async (
    hotelId: string,
    templateId: string,
    token: string,
    data: Partial<TemplateFormData>,
  ): Promise<TaskTemplate> => {
    const res = await api.patch(
      `/api/dashboard/staff/${hotelId}/templates/${templateId}`,
      data,
      { headers: authHeader(token) },
    );
    return res.data;
  },

  deleteTemplate: async (hotelId: string, templateId: string, token: string) => {
    const res = await api.delete(
      `/api/dashboard/staff/${hotelId}/templates/${templateId}`,
      { headers: authHeader(token) },
    );
    return res.data;
  },

  // ── Housekeeping ───────────────────────────────────────────

  getRoomsBoard: async (hotelId: string, token: string): Promise<RoomsBoardData> => {
    const res = await api.get(`/api/dashboard/housekeeping/${hotelId}/board`, {
      headers: authHeader(token),
    });
    return res.data;
  },

  listRooms: async (hotelId: string, token: string, params?: { floor?: number; status?: string }): Promise<{ rooms: Room[] }> => {
    const res = await api.get(`/api/dashboard/housekeeping/${hotelId}/rooms`, {
      headers: authHeader(token),
      params,
    });
    return res.data;
  },

  getRoomDetail: async (hotelId: string, roomId: string, token: string): Promise<{ room: Room }> => {
    const res = await api.get(`/api/dashboard/housekeeping/${hotelId}/rooms/${roomId}`, {
      headers: authHeader(token),
    });
    return res.data;
  },

  bulkCreateRooms: async (hotelId: string, token: string, rooms: BulkCreateRoomItem[]): Promise<{ created: number; rooms: Room[] }> => {
    const res = await api.post(`/api/dashboard/housekeeping/${hotelId}/rooms/bulk`, { rooms }, {
      headers: authHeader(token),
    });
    return res.data;
  },

  updateRoomHKStatus: async (hotelId: string, roomId: string, token: string, status: string, notes?: string) => {
    const res = await api.patch(`/api/dashboard/housekeeping/${hotelId}/rooms/${roomId}/status`, { status, notes }, {
      headers: authHeader(token),
    });
    return res.data;
  },

  assignRoomStaff: async (hotelId: string, roomId: string, token: string, data: { staffId?: string | null; inspectorId?: string | null }) => {
    const res = await api.patch(`/api/dashboard/housekeeping/${hotelId}/rooms/${roomId}/assign`, data, {
      headers: authHeader(token),
    });
    return res.data;
  },

  toggleRoomRush: async (hotelId: string, roomId: string, token: string) => {
    const res = await api.patch(`/api/dashboard/housekeeping/${hotelId}/rooms/${roomId}/rush`, {}, {
      headers: authHeader(token),
    });
    return res.data;
  },

  toggleRoomDND: async (hotelId: string, roomId: string, token: string, active: boolean) => {
    const res = await api.patch(`/api/dashboard/housekeeping/${hotelId}/rooms/${roomId}/dnd`, { active }, {
      headers: authHeader(token),
    });
    return res.data;
  },

  getRoomsSSEUrl: (hotelId: string, token: string): string =>
    `${getApiBase()}/api/v1/sse/tasks?channels=rooms:${hotelId}&token=${token}`,

  // ── Loyalty ────────────────────────────────────────────────

  getLoyaltySettings: async (hotelId: string, token: string): Promise<LoyaltySettings> => {
    const res = await api.get(`/api/dashboard/hotels/${hotelId}/loyalty/settings`, {
      headers: authHeader(token),
    });
    return res.data;
  },

  updateLoyaltySettings: async (hotelId: string, token: string, data: Partial<LoyaltySettings>): Promise<LoyaltySettings> => {
    const res = await api.put(`/api/dashboard/hotels/${hotelId}/loyalty/settings`, data, {
      headers: authHeader(token),
    });
    return res.data;
  },

  getLoyaltyMembers: async (hotelId: string, token: string, params?: { page?: number; limit?: number }): Promise<LoyaltyMembersResponse> => {
    const res = await api.get(`/api/dashboard/hotels/${hotelId}/loyalty/members`, {
      headers: authHeader(token),
      params,
    });
    return res.data;
  },

  getLoyaltyStats: async (hotelId: string, token: string): Promise<LoyaltyStats> => {
    const res = await api.get(`/api/dashboard/hotels/${hotelId}/loyalty/stats`, {
      headers: authHeader(token),
    });
    return res.data;
  },

  manualLoyaltyAdjust: async (hotelId: string, token: string, data: { guestId: string; nights: number; description: string }) => {
    const res = await api.post(`/api/dashboard/hotels/${hotelId}/loyalty/adjust`, data, {
      headers: authHeader(token),
    });
    return res.data;
  },
};

// ── Staff TMS Types ──────────────────────────────────────────

export interface StaffMember {
  id: string;
  email: string;
  phone?: string;
  firstName: string;
  lastName?: string;
  role: string;
  department: string;
  isActive: boolean;
  assignedFloor?: string;
  avatarUrl?: string;
  createdAt: string;
  shifts?: { startedAt: string }[];
}

export interface CreateStaffData {
  email: string;
  firstName: string;
  lastName?: string;
  phone?: string;
  role: string;
  department: string;
  password: string;
  assignedFloor?: string;
}

export interface UpdateStaffData {
  firstName?: string;
  lastName?: string;
  phone?: string;
  role?: string;
  department?: string;
  isActive?: boolean;
  assignedFloor?: string;
  password?: string;
}

export interface TMSStats {
  byStatus: { status: string; count: number }[];
  byDepartment: { department: string; count: number }[];
  slaCompliance: number | null;
  slaTotal: number;
  totalTasks: number;
}

export interface ChecklistItemData {
  id?: string;
  text: string;
  isRequired: boolean;
  sortOrder: number;
}

export interface TaskTemplate {
  id: string;
  hotelId: string;
  name: string;
  department: string;
  defaultPriority: string;
  slaMinutes?: number | null;
  isActive: boolean;
  createdAt: string;
  checklistItems: ChecklistItemData[];
}

export interface TemplateFormData {
  name: string;
  department: string;
  defaultPriority: string;
  slaMinutes?: number | null;
  isActive?: boolean;
  checklistItems: { text: string; isRequired: boolean; sortOrder: number }[];
}

// ── Housekeeping Types ────────────────────────────────────────

export type HousekeepingStatus = 'DIRTY' | 'CLEANING' | 'CLEANED' | 'INSPECTED' | 'READY' | 'OUT_OF_ORDER' | 'DO_NOT_DISTURB';
export type OccupancyStatus = 'VACANT' | 'OCCUPIED' | 'STAYOVER' | 'CHECKOUT' | 'CHECKIN';

export interface Room {
  id: string;
  hotelId: string;
  roomNumber: string;
  floor: number;
  roomType?: string;
  maxOccupancy?: number;
  isActive: boolean;
  housekeepingStatus: HousekeepingStatus;
  occupancyStatus: OccupancyStatus;
  assignedCleanerId?: string;
  assignedInspectorId?: string;
  assignedCleaner?: { id: string; firstName: string; lastName?: string; avatarUrl?: string } | null;
  assignedInspector?: { id: string; firstName: string; lastName?: string; avatarUrl?: string } | null;
  lastStatusChangedAt: string;
  lastCleanedAt?: string;
  lastInspectedAt?: string;
  estimatedReadyAt?: string;
  isRush: boolean;
  dndActive: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RoomsBoardData {
  floors: Record<number, Room[]>;
  stats: {
    total: number;
    dirty: number;
    cleaning: number;
    cleaned: number;
    inspected: number;
    ready: number;
    outOfOrder: number;
    dnd: number;
  };
}

export interface BulkCreateRoomItem {
  roomNumber: string;
  floor: number;
  roomType?: string;
  maxOccupancy?: number;
}

// ── Service Catalog Types ──────────────────────────────────────

export interface ServiceItemFull {
  id: string;
  categoryId: string;
  name: string;
  nameUk?: string;
  nameEn?: string;
  description?: string;
  icon?: string;
  photoUrl?: string;
  price: number;
  currency: string;
  isActive: boolean;
  sortOrder: number;
  maxQuantity: number;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceCategoryFull {
  id: string;
  hotelId: string;
  name: string;
  nameUk?: string;
  nameEn?: string;
  slug: string;
  icon?: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
  requiresRoom: boolean;
  requiresTimeSlot: boolean;
  autoAccept: boolean;
  estimatedMinutes?: number;
  items: ServiceItemFull[];
  _count: { requests: number };
}

// ── Loyalty Types ─────────────────────────────────────────────

export interface LoyaltySettings {
  id: string;
  hotelId: string;
  isEnabled: boolean;
  programName: string;
  silverNightsRequired: number;
  goldNightsRequired: number;
  platinumNightsRequired: number;
  createdAt: string;
  updatedAt: string;
}

export interface LoyaltyAccount {
  id: string;
  guestId: string;
  hotelId: string;
  nightsThisYear: number;
  totalNights: number;
  tier: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';
  guest: {
    id: string;
    firstName: string;
    lastName?: string;
    email?: string;
    phone?: string;
  };
}

export interface LoyaltyMembersResponse {
  accounts: LoyaltyAccount[];
  total: number;
}

export interface LoyaltyStats {
  totalMembers: number;
  totalNightsThisYear: number;
  totalLifetimeNights: number;
  byTier: Record<string, number>;
}
