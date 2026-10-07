import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { authService, isVerificationAuthBypassActive } from '../services/authService';
import { useAuthStore } from '../stores/authStore';
import { changeLanguage, getCurrentLanguage } from '../i18n';

const AUTH_INIT_TIMEOUT_MS = 8000;
const PROFILE_LOAD_TIMEOUT_MS = 7000;
const PUBLIC_ROUTES = new Set([
  'index',
  'delete-account',
  'email-action',
  'email-confirmed',
  'family-invite',
  'manage-subscription',
  'privacy',
  'terms',
]);

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
    promise
      .then(resolve)
      .catch(reject)
      .finally(() => clearTimeout(timer));
  });
}

export function useAuth() {
  const { user, profile, isLoading, isInitialized, profileMode, isPremium } = useAuthStore();
  return { user, profile, isLoading, isInitialized, profileMode, isPremium };
}

export function useAuthGuard() {
  const { user, profile, isInitialized, isProfileLoading } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!isInitialized) return;
    if (isProfileLoading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const isPublicRoute = !segments[0] || PUBLIC_ROUTES.has(String(segments[0]));
    // Landing page: root `/` — segmentul e undefined, '' sau 'index'
    const isLandingPage = !segments[0] || segments[0] === '' || segments[0] === 'index';

    if (!user && !inAuthGroup && !isPublicRoute) {
      router.replace('/');
    } else if (user && inAuthGroup) {
      if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
        const pendingInvite = localStorage.getItem('mamiapp_pending_family_invite');
        if (pendingInvite) {
          router.replace(pendingInvite as any);
          return;
        }
      }
      if (!profile?.onboardingCompleted) {
        router.replace('/(auth)/onboarding');
      } else {
        router.replace('/(tabs)');
      }
    } else if (user && isLandingPage) {
      // User autentificat pe landing page.
      // _layout.tsx afișează AppLoadingScreen în loc de Stack când detectează această situație,
      // deci LandingPage nu se poate monta să facă redirectul singur — îl facem noi din guard.
      if (!profile?.onboardingCompleted) {
        router.replace('/(auth)/onboarding');
      } else {
        router.replace('/(tabs)');
      }
    }
  }, [user, profile, isInitialized, isProfileLoading, segments]);
}

export function useInitializeAuth() {
  const { setUser, setProfile, setProfileLoading, setLoading, setInitialized, setIsPremium } = useAuthStore();

  useEffect(() => {
    if (Platform.OS !== 'web') {
      import('../services/purchasesService')
        .then(({ purchasesService }) => purchasesService.configure())
        .catch(() => {});
    }

    const initFallback = setTimeout(() => {
      const state = useAuthStore.getState();
      if (state.isInitialized) return;
      setProfileLoading(false);
      setLoading(false);
      setInitialized(true);
    }, AUTH_INIT_TIMEOUT_MS);

    const unsubscribe = authService.onAuthStateChanged(async (user) => {
      clearTimeout(initFallback);

      if (user) {
        await user.reload().catch(() => {});
        if (!user.emailVerified) {
          if (isVerificationAuthBypassActive()) {
            setUser(null);
            setProfile(null);
            setProfileLoading(false);
            setIsPremium(false);
            setLoading(false);
            setInitialized(true);
            return;
          }
          await authService.logout().catch(() => {});
          setUser(null);
          setProfile(null);
          setProfileLoading(false);
          setIsPremium(false);
          setLoading(false);
          setInitialized(true);
          return;
        }

        setProfileLoading(true);
        setUser(user);

        try {
          const profile = await withTimeout(
            authService.getUserProfile(user.uid),
            PROFILE_LOAD_TIMEOUT_MS,
            'User profile load'
          );

          // Auto-fix: dacă onboardingCompleted e false dar userul are deja copii/sarcina,
          // îl marcăm ca terminat (cont creat înainte de introducerea flag-ului sau edge case)
          if (profile && !profile.onboardingCompleted) {
            const hasSetup = await authService.checkUserHasSetupData(user.uid).catch(() => false);
            if (hasSetup) {
              await authService.updateUserProfile(user.uid, { onboardingCompleted: true }).catch(() => {});
              profile.onboardingCompleted = true;
            }
          }

          if (profile?.locale && profile.locale !== getCurrentLanguage()) {
            await changeLanguage(profile.locale).catch(() => {});
          }

          setProfile(profile);
        } catch {
          setProfile(null);
        }

        setProfileLoading(false);
        setLoading(false);
        setInitialized(true);

        if (Platform.OS !== 'web') {
          import('../services/purchasesService')
            .then(({ purchasesService }) => purchasesService.logIn(user.uid)
            .then(() => purchasesService.isPremiumActive())
            .then(setIsPremium))
            .catch(() => {});
        }
      } else {
        setUser(null);
        setProfile(null);
        setIsPremium(false);
        if (Platform.OS !== 'web') {
          import('../services/purchasesService')
            .then(({ purchasesService }) => purchasesService.logOut())
            .catch(() => {});
        }
        setLoading(false);
        setInitialized(true);
      }
    });

    return () => {
      clearTimeout(initFallback);
      unsubscribe();
    };
  }, []);
}
