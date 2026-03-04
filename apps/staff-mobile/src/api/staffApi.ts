import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://172.20.10.5:3001';

export const staffApi = axios.create({
  baseURL: `${BASE_URL}/api/staff`,
  timeout: 10000,
});

staffApi.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('staff_access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

staffApi.interceptors.response.use(
  res => res,
  async (err) => {
    if (err.response?.status === 401) {
      await SecureStore.deleteItemAsync('staff_access_token');
      await SecureStore.deleteItemAsync('staff_refresh_token');
    }
    return Promise.reject(err);
  },
);

// Auth
export const loginStaff = (hotelId: string, email: string, password: string) =>
  staffApi.post('/login', { hotelId, email, password });

export const loginByPin = (hotelId: string, pin: string) =>
  staffApi.post('/login/pin', { hotelId, pin });

export const getMe = () => staffApi.get('/me');

// Shifts
export const getShiftStatus = () => staffApi.get('/shift/status');
export const startShift = () => staffApi.post('/shift/start');
export const endShift = () => staffApi.post('/shift/end');

// Templates
export const getTemplates = () => staffApi.get('/templates');

// Tasks
export const getTasks = (params?: {
  status?: string;
  onlyMine?: boolean;
  roomNumber?: string;
  priority?: string;
}) => staffApi.get('/tasks', { params });

export const updateTaskStatus = (taskType: string, taskId: string, status: string, holdReason?: string) =>
  staffApi.patch(`/tasks/${taskType}/${taskId}/status`, { status, holdReason });

export const assignTaskToMe = (taskType: string, taskId: string) =>
  staffApi.patch(`/tasks/${taskType}/${taskId}/assign`, {});

export const assignTask = (taskType: string, taskId: string, assignedToId: string) =>
  staffApi.patch(`/tasks/${taskType}/${taskId}/assign`, { assignedToId });

export const updateChecklist = (taskId: string, itemId: string, checked: boolean) =>
  staffApi.patch(`/tasks/${taskId}/checklist`, { itemId, checked });

export const addComment = (taskType: string, taskId: string, text: string) =>
  staffApi.post(`/tasks/${taskType}/${taskId}/comments`, { text });

export const getComments = (taskType: string, taskId: string) =>
  staffApi.get(`/tasks/${taskType}/${taskId}/comments`);

export const getOnlineStaff = () =>
  staffApi.get('/online');

export const savePushToken = (expoPushToken: string) =>
  staffApi.patch('/push-token', { expoPushToken });

export const createTask = (data: {
  title: string;
  description?: string;
  department: string;
  roomNumber?: string;
  priority?: string;
  templateId?: string;
  assignedToId?: string;
  autoAssign?: boolean;
}) => staffApi.post('/tasks', data);

// Housekeeping — Rooms
export const getMyRooms = () => staffApi.get('/rooms');
export const updateRoomStatus = (roomId: string, status: string, notes?: string) =>
  staffApi.patch(`/rooms/${roomId}/status`, { status, notes });
