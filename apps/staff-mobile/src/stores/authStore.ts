import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

interface StaffUser {
  id: string;
  hotelId: string;
  email: string;
  firstName: string;
  lastName?: string;
  role: string;
  department: string;
  avatarUrl?: string;
  assignedFloor?: string;
}

interface AuthState {
  staff: StaffUser | null;
  isLoading: boolean;
  setStaff: (staff: StaffUser, accessToken: string, refreshToken?: string) => Promise<void>;
  logout: () => Promise<void>;
  loadFromStorage: () => Promise<boolean>;
}

export const useAuthStore = create<AuthState>((set) => ({
  staff: null,
  isLoading: true,

  setStaff: async (staff, accessToken, refreshToken) => {
    await SecureStore.setItemAsync('staff_access_token', accessToken);
    if (refreshToken) await SecureStore.setItemAsync('staff_refresh_token', refreshToken);
    await SecureStore.setItemAsync('staff_user', JSON.stringify(staff));
    set({ staff });
  },

  logout: async () => {
    await SecureStore.deleteItemAsync('staff_access_token');
    await SecureStore.deleteItemAsync('staff_refresh_token');
    await SecureStore.deleteItemAsync('staff_user');
    set({ staff: null });
  },

  loadFromStorage: async () => {
    try {
      const token = await SecureStore.getItemAsync('staff_access_token');
      const userJson = await SecureStore.getItemAsync('staff_user');
      if (token && userJson) {
        set({ staff: JSON.parse(userJson), isLoading: false });
        return true;
      }
    } catch {}
    set({ isLoading: false });
    return false;
  },
}));
