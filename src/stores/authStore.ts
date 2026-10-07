import { create } from 'zustand';
import { User } from 'firebase/auth';
import { UserProfile } from '../types/auth';

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  isLoading: boolean;
  isInitialized: boolean;
  /** True cât timp profilul se încarcă din Firestore după autentificare. */
  isProfileLoading: boolean;
  profileMode: 'pregnancy' | 'child';
  /** True when user has an active Premium subscription (RevenueCat-verified). */
  isPremium: boolean;
  setUser: (user: User | null) => void;
  setProfile: (profile: UserProfile | null) => void;
  setProfileLoading: (loading: boolean) => void;
  setLoading: (loading: boolean) => void;
  setInitialized: (initialized: boolean) => void;
  setProfileMode: (mode: 'pregnancy' | 'child') => void;
  setIsPremium: (isPremium: boolean) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  profile: null,
  isLoading: true,
  isInitialized: false,
  isProfileLoading: false,
  profileMode: 'child',
  isPremium: false,
  setUser: (user) => set({ user }),
  setProfile: (profile) =>
    set({
      profile,
      isProfileLoading: false,
      profileMode: profile?.profileMode ?? 'child',
      isPremium: profile?.subscription?.plan === 'premium',
    }),
  setProfileLoading: (isProfileLoading) => set({ isProfileLoading }),
  setLoading: (isLoading) => set({ isLoading }),
  setInitialized: (isInitialized) => set({ isInitialized }),
  setProfileMode: (profileMode) => set({ profileMode }),
  setIsPremium: (isPremium) => set({ isPremium }),
  reset: () => set({ user: null, profile: null, isLoading: false, isProfileLoading: false, profileMode: 'child', isPremium: false }),
}));
