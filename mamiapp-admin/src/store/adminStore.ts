// src/store/adminStore.ts
import { create } from 'zustand';
import type { AdminUser } from '../types';

interface AdminStore {
  adminUser: AdminUser | null;
  isLoading: boolean;
  isInitialized: boolean;
  setAdminUser: (u: AdminUser | null) => void;
  setLoading: (v: boolean) => void;
  setInitialized: (v: boolean) => void;
}

export const useAdminStore = create<AdminStore>((set) => ({
  adminUser: null,
  isLoading: true,
  isInitialized: false,
  setAdminUser: (u) => set({ adminUser: u }),
  setLoading: (v) => set({ isLoading: v }),
  setInitialized: (v) => set({ isInitialized: v }),
}));
