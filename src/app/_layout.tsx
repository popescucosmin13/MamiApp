import { useEffect, useRef, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as WebBrowser from 'expo-web-browser';
import { useFonts } from 'expo-font';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { Platform, View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import Constants from 'expo-constants';
import { useInitializeAuth, useAuthGuard } from '../hooks/useAuth';
import { useSegments, usePathname } from 'expo-router';
import { useAuthStore } from '../stores/authStore';
import { moduleTracking } from '../services/moduleTracking';
import { analyticsService } from '../services/analyticsService';
import { AppState } from 'react-native';
import { authService } from '../services/authService';
import { useAccessControl } from '../hooks/useAccessControl';
import { useAppearance } from '../hooks/useAppearance';
import { AppErrorBoundary } from '../components/AppErrorBoundary';
import { Colors } from '../theme/colors';
import { Spacing } from '../theme/spacing';
import PWAInstallBanner from '../components/PWAInstallBanner';
import PWAUpdateBanner from '../components/PWAUpdateBanner';
import InAppBrowserPrompt from '../components/InAppBrowserPrompt';
import AppLoadingScreen from '../components/AppLoadingScreen';
import PersistentTimerBar from '../components/PersistentTimerBar';
import NotificationPermissionPrompt from '../components/NotificationPermissionPrompt';
import AppUpdatePrompt from '../components/AppUpdatePrompt';
import { TIMER_NOTIFICATION_ACTIONS, useTimerNotifications } from '../hooks/useTimerNotification';
import { useSmartReminders } from '../hooks/useSmartReminders';
import { useQuickLogActions } from '../hooks/useQuickLogActions';
import { useSaveTimer } from '../hooks/useSaveTimer';
import { useTimerStore } from '../stores/timerStore';
import { APP_VERSION } from '../constants/appVersion';
import { useTranslation } from 'react-i18next';
import { initI18n } from '../i18n';
import { installRuntimeTextTranslations } from '../i18n/runtimeText';

WebBrowser.maybeCompleteAuthSession({ skipRedirectCheck: true });
SplashScreen.preventAutoHideAsync();

const WEB_ACCENT_COLORS: Record<string, string> = {
  coral: Colors.feeding,
  sage: Colors.sage,
  plum: Colors.plum,
  slate: Colors.slate,
};

const WEB_TEXT_SCALE: Record<string, string> = {
  small: '0.94',
  medium: '1',
  large: '1.08',
};

function applySavedWebAppearance(preferences: any) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  const appearance = preferences?.appearance ?? {};

  document.documentElement.dataset.mamiTheme = 'light';
  document.documentElement.style.setProperty('--mami-accent', WEB_ACCENT_COLORS[appearance.accent] ?? Colors.child.primary);
  document.documentElement.style.setProperty('--mami-text-scale', WEB_TEXT_SCALE[appearance.textSize] ?? '1');
  document.body.style.background = Colors.background;
  document.body.style.color = Colors.textPrimary;
}

// Elimină outline-ul implicit al browser-ului de pe toate input-urile
// + previne zoom-ul la focus pe input în iOS Safari/Chrome
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  // Setează viewport cu maximum-scale=1 pentru a preveni zoom-ul la focus
  const viewportMeta = document.querySelector('meta[name="viewport"]');
  if (viewportMeta) {
    viewportMeta.setAttribute(
      'content',
      'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no'
    );
  } else {
    const meta = document.createElement('meta');
    meta.name = 'viewport';
    meta.content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no';
    document.head.appendChild(meta);
  }

  const style = document.createElement('style');
  style.textContent = `
    /* Previne zoom-ul la focus — iOS Safari zoomează dacă font-size < 16px */
    html, body, #root {
      min-height: var(--app-viewport-height, 100dvh);
      overscroll-behavior-y: contain;
    }
    input, textarea, select {
      font-size: 16px !important;
      outline: none !important;
      scroll-margin-bottom: calc(var(--keyboard-inset, 0px) + 96px);
    }
    input:focus, textarea:focus, select:focus {
      outline: none !important;
      box-shadow: none !important;
    }
    button { outline: none !important; }
    * { -webkit-tap-highlight-color: transparent; }
  `;
  document.head.appendChild(style);

  const updateViewportVars = () => {
    const viewport = window.visualViewport;
    const height = viewport?.height ?? window.innerHeight;
    const keyboardInset = Math.max(0, window.innerHeight - height - (viewport?.offsetTop ?? 0));
    document.documentElement.style.setProperty('--app-viewport-height', `${height}px`);
    document.documentElement.style.setProperty('--keyboard-inset', `${keyboardInset}px`);
  };
  updateViewportVars();
  window.visualViewport?.addEventListener('resize', updateViewportVars);
  window.visualViewport?.addEventListener('scroll', updateViewportVars);
  window.addEventListener('orientationchange', updateViewportVars);

  const launchQueue = (window as any).launchQueue;
  if (launchQueue?.setConsumer) {
    launchQueue.setConsumer((launchParams: { targetURL?: string }) => {
      if (!launchParams.targetURL) return;
      const target = new URL(launchParams.targetURL);
      if (target.origin !== window.location.origin) return;
      const nextUrl = `${target.pathname}${target.search}${target.hash}`;
      if (nextUrl !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
        window.location.assign(nextUrl);
      }
    });
  }

  document.addEventListener('focusin', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (!target.matches('input, textarea, select, [contenteditable="true"]')) return;
    window.setTimeout(() => {
      target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
    }, 80);
  });

  // Suprimăm eroarea globală de DOM pentru react-native-chart-kit în React 19 pe Web
  const originalError = console.error;
  console.error = (...args) => {
    if (typeof args[0] === 'string' && args[0].includes('transform-origin')) {
      return;
    }
    // Don't suppress Warning: React.createElement: type is invalid!
    originalError(...args);
  };

  // Înregistrare Service Worker + auto-update silențios (iOS & Android)
  if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      // Capturăm dacă există deja un SW activ ÎNAINTE de înregistrare.
      // Dacă nu există (prima instalare), nu facem reload după activare.
      const hadController = !!navigator.serviceWorker.controller;

      const SW_RELOAD_KEY = 'sw_reload_at';
      const DEDUP_MS = 60_000;

      function safeReload() {
        try {
          const last = sessionStorage.getItem(SW_RELOAD_KEY);
          if (last && Date.now() - Number(last) < DEDUP_MS) return;
          sessionStorage.setItem(SW_RELOAD_KEY, String(Date.now()));
        } catch {}
        window.location.reload();
      }

      // controllerchange = noul SW a preluat controlul → reîncărcăm pentru bundle-uri noi
      // Funcționează pe Android; pe iOS e backup pentru SW_ACTIVATED
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (hadController) safeReload();
      });

      navigator.serviceWorker.register('/sw-custom.js', {
        updateViaCache: 'none',
      }).then((reg) => {
        reg.update().catch(() => {});

        // SW_ACTIVATED = mesaj explicit din SW după activate + clients.claim()
        // Mai fiabil pe iOS Safari standalone (PWA instalat pe ecranul principal)
        navigator.serviceWorker.addEventListener('message', (event) => {
          if (event.data?.type === 'SW_ACTIVATED' && hadController) {
            safeReload();
          }
        });
      }).catch(() => {});
    });
  }
}


/** Maps notification `type` field to an app route for deep linking. */
function getRouteFromNotificationData(data: Record<string, string> | undefined): string | null {
  if (!data) return null;
  // `screen` field set explicitly by Cloud Functions takes priority
  if (data.screen) return data.screen;
  // Fallback by notification type
  switch (data.type) {
    case 'vaccine_reminder': return '/modules/vaccines';
    case 'daily_summary': return '/(tabs)';
    case 'milestone_due': return '/modules/milestones';
    case 'appointment_reminder': return '/modules/appointments';
    case 'community_reply': return data.postId ? `/modules/community/post/${data.postId}` : '/modules/community';
    case 'daily_pregnancy':
    case 'pregnancy_milestone': return '/modules/pregnancy';
    case 'daily_child':
    case 'weekly_insight':
    case 'winback': return '/(tabs)';
    case 'monthly_birthday': return '/modules/growth';
    case 'diversification': return '/modules/food';
    case 'streak': return '/(tabs)/add';
    case 'meal_reminder': return '/modules/feeding';
    case 'sleep_window': return '/modules/sleep';
    default: return null;
  }
}

const LANDING_SEGMENTS = new Set(['index', '', undefined]);

async function getServiceWorkerVersion(): Promise<string | null> {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const worker = registration.active || navigator.serviceWorker.controller;
    if (!worker) return null;

    return await new Promise((resolve) => {
      const channel = new MessageChannel();
      const timeout = window.setTimeout(() => resolve(null), 1500);
      channel.port1.onmessage = (event) => {
        window.clearTimeout(timeout);
        resolve(event.data?.type === 'SW_VERSION' ? event.data.version || null : null);
      };
      worker.postMessage({ type: 'GET_SW_VERSION' }, [channel.port2]);
    });
  } catch {
    return null;
  }
}

function getAppVersionPayload(serviceWorkerVersion?: string | null) {
  const expoConfig = Constants.expoConfig;
  const appVersion = Platform.OS === 'web'
    ? APP_VERSION
    : Constants.nativeAppVersion || expoConfig?.version || APP_VERSION;
  const appOwnership = Constants.appOwnership || 'unknown';
  const appInstallSource =
    Platform.OS === 'android'
      ? appOwnership === 'expo' ? 'expo_go' : 'google_play'
      : Platform.OS === 'ios'
        ? appOwnership === 'expo' ? 'expo_go' : 'app_store'
        : 'web_browser';

  return {
    appVersion,
    appBuildVersion: Constants.nativeBuildVersion || (expoConfig as any)?.ios?.buildNumber || (expoConfig as any)?.android?.versionCode?.toString?.() || 'web',
    appPlatform: Platform.OS,
    appOwnership,
    appInstallSource,
    serviceWorkerVersion: serviceWorkerVersion || null,
  };
}

function AppContent() {
  useInitializeAuth();
  useAuthGuard();
  useTimerNotifications();
  useSmartReminders();
  const handleQuickLogAction = useQuickLogActions();
  const { t } = useTranslation();
  const { user, isInitialized, profile } = useAuthStore();
  const { canUseFeature, isLoadingAccess } = useAccessControl();
  const segments = useSegments();
  const pathname = usePathname();
  const appearance = useAppearance();
  const showMaintenanceBanner = canUseFeature('maintenanceMode');
  const { pauseTimer, resumeTimer } = useTimerStore();
  const saveAndStopTimer = useSaveTimer();
  const [activeCampaign, setActiveCampaign] = useState<any>(null);
  const [notifPromptVisible, setNotifPromptVisible] = useState(false);
  const [updatePromptVisible, setUpdatePromptVisible] = useState(false);

  useEffect(() => {
    applySavedWebAppearance(profile?.preferences);
  }, [profile?.preferences]);

  // ─── Module tracking ──────────────────────────────────────────────────────
  useEffect(() => {
    moduleTracking.setUser(user?.uid ?? null);
  }, [user?.uid]);

  useEffect(() => {
    if (pathname) moduleTracking.enter(pathname);
  }, [pathname]);

  useEffect(() => {
    analyticsService.init();
  }, []);

  useEffect(() => {
    if (pathname) analyticsService.trackPageView(pathname);
  }, [pathname]);

  // ─── Deep link handling (articole) ──────────────────────────────────────
  useEffect(() => {
    const handleDeepLink = (url: string) => {
      if (!url) return;
      try {
        // Extrage pathname din URL (funcționează pe web și native)
        const match = url.match(/\/modules\/articles\/([a-zA-Z0-9]+)/);
        if (match && match[0]) {
          router.push(match[0] as any);
        }
      } catch {}
    };

    if (Platform.OS === 'web') return;

    // Native: ascult la linkuri primite din deep links
    const subscription = Linking.addEventListener('url', (event) => {
      handleDeepLink(event.url);
    });

    // Verifi dacă app-ul s-a deschis prin deep link
    Linking.getInitialURL()
      .then(url => url && handleDeepLink(url))
      .catch(() => {});

    return () => subscription.remove();
  }, []);
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    // Web: flush la vizibilitate ascunsă
    if (Platform.OS === 'web') {
      const onVisibility = () => {
        if (document.visibilityState === 'hidden') moduleTracking.flushNow();
      };
      document.addEventListener('visibilitychange', onVisibility);
      return () => document.removeEventListener('visibilitychange', onVisibility);
    }
    // Native: flush la background
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') moduleTracking.flushNow();
    });
    return () => sub.remove();
  }, []);
  // ─────────────────────────────────────────────────────────────────────────

  // Verifică periodic actualizări SW (la fiecare 10 min când app-ul e în foreground)
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof navigator === 'undefined') return;
    const checkUpdate = () => {
      navigator.serviceWorker?.getRegistration?.('/')
        .then(reg => reg?.update?.())
        .catch(() => {});
    };
    const interval = setInterval(checkUpdate, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // ── Engagement tracking: histograma orelor de deschidere ────────────────
  // Folosită de orchestratorul de notificări pentru ora personală de trimitere.
  const lastTrackedOpenRef = useRef(0);
  useEffect(() => {
    if (!user) return;

    const trackOpen = () => {
      const now = Date.now();
      if (now - lastTrackedOpenRef.current < 30 * 60 * 1000) return; // max o dată la 30 min
      lastTrackedOpenRef.current = now;
      import('../services/notificationService')
        .then(({ notificationService }) => notificationService.trackAppOpen(user.uid))
        .catch(() => {});
    };

    trackOpen();

    if (Platform.OS === 'web') {
      const onVisibility = () => {
        if (document.visibilityState === 'visible') trackOpen();
      };
      document.addEventListener('visibilitychange', onVisibility);
      return () => document.removeEventListener('visibilitychange', onVisibility);
    }

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') trackOpen();
    });
    return () => sub.remove();
  }, [user?.uid]);

  useEffect(() => {
    if (!user) return;

    const checkCampaign = async () => {
      const { notificationService } = await import('../services/notificationService');
      const campaign = await notificationService.getLatestCampaign();
      if (campaign) {
        const seenKey = `@seen_campaign_${campaign.id}`;
        let seen = null;
        if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
          seen = localStorage.getItem(seenKey);
        }
        
        if (!seen) {
          setActiveCampaign(campaign);
        }
      }
    };
    const timer = setTimeout(() => {
      checkCampaign().catch(() => {});
    }, Platform.OS === 'web' ? 3000 : 500);
    return () => clearTimeout(timer);
  }, [user]);

  const router = useRouter();
  const notificationListener = useRef<any>(undefined);
  const responseListener = useRef<any>(undefined);
  // Identificatorii notificărilor deja procesate — evită dubla contorizare
  // când răspunsul de cold start ajunge și prin listener
  const processedNotificationIdsRef = useRef<Set<string>>(new Set());

  const handleTimerNotificationAction = (action: string | undefined, timerId: string | undefined) => {
    if (!timerId) return false;
    const timer = useTimerStore.getState().activeTimers.find((item) => item.id === timerId);
    if (!timer) return false;

    if (action === TIMER_NOTIFICATION_ACTIONS.pause) {
      pauseTimer(timerId);
      return true;
    }
    if (action === TIMER_NOTIFICATION_ACTIONS.resume) {
      resumeTimer(timerId);
      return true;
    }
    if (action === TIMER_NOTIFICATION_ACTIONS.stop) {
      saveAndStopTimer(timer);
      return true;
    }
    return false;
  };

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data) return;

      // Navigare din notificare push (apăsată cu app-ul în background)
      if (data.type === 'MAMI_PUSH_NAVIGATE' && data.path) {
        // Marchează notificarea smart ca deschisă — SW-ul transmite payload-ul
        // FCM (inclusiv logId) în câmpul `data` al mesajului
        const logId = data.data?.logId;
        const uid = useAuthStore.getState().user?.uid;
        if (logId && uid) {
          import('../services/notificationService')
            .then(({ notificationService }) => notificationService.markNotificationOpened(uid, logId))
            .catch(() => {});
        }
        setTimeout(() => router.push(data.path as any), 100);
        return;
      }

      // Acțiuni timer (alăptare/somn)
      if (data.type === 'MAMI_TIMER_NOTIFICATION_ACTION') {
        if (!handleTimerNotificationAction(data.action, data.timerId) && data.action === 'open') {
          router.push(data.timerType === 'sleep' ? '/modules/sleep' : '/modules/feeding');
        }
      }
    };

    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [pauseTimer, resumeTimer, saveAndStopTimer, router]);

  // Web: dacă PWA-ul a fost deschis dintr-o notificare cu app-ul închis, SW-ul
  // face openWindow() și postMessage-ul se pierde (listenerul de mai sus nu e
  // încă montat) — logId ajunge atunci prin query string, ca fallback fiabil.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !user?.uid) return;

    const params = new URLSearchParams(window.location.search);
    const logId = params.get('notif_log');
    if (!logId) return;

    import('../services/notificationService')
      .then(({ notificationService }) => notificationService.markNotificationOpened(user.uid, logId))
      .catch(() => {});

    params.delete('notif_log');
    const query = params.toString();
    window.history.replaceState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);
  }, [user?.uid]);

  // Înregistrare token push la autentificare
  useEffect(() => {
    if (!user) return;

    const registerPush = async () => {
      const { notificationService } = await import('../services/notificationService');

      if (Platform.OS === 'web') {
        // PWA — înregistrare Web Push via Firebase Messaging
        // Cere permisiunea dacă nu e deja acordată, apoi înregistrează token-ul FCM web
        const granted = await notificationService.requestPermission();
        if (granted) {
          await notificationService.registerWebPush(user.uid);
        }
        return;
      }

      // Native iOS / Android — înregistrare Expo Push Token
      await notificationService.configure();

      // Pe Android, instalările din Google Play fără o decizie luată încă
      // ("undetermined") nu sunt cerute automat aici — NotificationPermissionPrompt
      // arată întâi popup-ul cu context, ca să nu irosim singura șansă de dialog
      // de sistem pe o cerere fără explicație. getState() ca să citim profilul
      // proaspăt, chiar dacă s-a încărcat după ce acest efect a pornit.
      const currentStatus = await notificationService.getPermissionStatus();
      const primedByCustomPrompt =
        Platform.OS === 'android' &&
        useAuthStore.getState().profile?.appInstallSource === 'google_play' &&
        currentStatus === 'undetermined';
      if (primedByCustomPrompt) return;

      const granted = await notificationService.requestPermission();
      if (granted) {
        const token = await notificationService.getDeviceToken();
        if (token) {
          await notificationService.saveDeviceToken(user.uid, token);
        }
      }
    };

    const syncAppInstallInfo = async () => {
      const serviceWorkerVersion = await getServiceWorkerVersion();
      const appVersionPayload = getAppVersionPayload(serviceWorkerVersion);

      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const isPWA = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
        if (isPWA) {
          const userAgent = window.navigator.userAgent.toLowerCase();
          let os = 'pwa_other';
          if (userAgent.includes('iphone') || userAgent.includes('ipad')) os = 'pwa_ios';
          else if (userAgent.includes('android')) os = 'pwa_android';
          else if (userAgent.includes('windows')) os = 'pwa_windows';
          else if (userAgent.includes('mac')) os = 'pwa_macos';
          else if (userAgent.includes('linux')) os = 'pwa_linux';

          await authService.updateUserProfile(user.uid, {
            ...appVersionPayload,
            isPWA: true,
            platform: os,
            appInstallSource: 'pwa',
            appInstallSourceDetail: os,
          } as any);
          return;
        }
      }

      await authService.updateUserProfile(user.uid, appVersionPayload as any);
    };

    const pushTimer = setTimeout(() => {
      registerPush().catch(() => {
        // Non-critical — ignore errors
      });
    }, 1200);

    syncAppInstallInfo().catch((e) => {
      console.warn('Failed to save app install info', e);
    });

    // Listener notificări primite în foreground — afișate automat de handler-ul configurat
    let isMounted = true;
    if (Platform.OS !== 'web') {
      import('../services/notificationService').then(({ notificationService }) => {
        if (!isMounted) return;
        notificationListener.current = notificationService.addNotificationReceivedListener(
          (_notification) => {}
        );

        // Procesare comună tap pe notificare (listener + cold start), cu deduplicare —
        // răspunsul de cold start poate ajunge și prin listener pe unele device-uri
        const processResponse = (response: import('expo-notifications').NotificationResponse) => {
          const identifier = response.notification.request.identifier;
          if (processedNotificationIdsRef.current.has(identifier)) return;
          processedNotificationIdsRef.current.add(identifier);

          const data = response.notification.request.content.data as Record<string, string> | undefined;
          if (handleTimerNotificationAction(response.actionIdentifier, data?.timerId)) {
            return;
          }
          // Acțiuni rapide (alăptare/biberon/somn/amânare) — logging fără a deschide app-ul
          handleQuickLogAction(response).then((handled) => {
            if (handled) return;
            // Tap simplu pe notificare → deep link
            const route = getRouteFromNotificationData(data);
            if (route) {
              setTimeout(() => {
                router.push(route as any);
              }, 300);
            }
          }).catch(() => {});
          // Marchează notificarea smart ca deschisă (pentru CTR per tip)
          if (data?.logId && user?.uid) {
            notificationService.markNotificationOpened(user.uid, data.logId).catch(() => {});
          }
        };

        // Listener tap pe notificare → deep link (app deschis sau în background)
        responseListener.current = notificationService.addNotificationResponseReceivedListener(processResponse);

        // Cold start: notificarea care a PORNIT aplicația nu ajunge la listener —
        // fără asta, tap-urile cu app-ul închis nu navighează și nu se contorizează
        notificationService.getLastNotificationResponse()
          .then((response) => {
            if (response && isMounted) processResponse(response);
          })
          .catch(() => {});
      }).catch(() => {});
    }

    return () => {
      isMounted = false;
      clearTimeout(pushTimer);
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [user?.uid]);

  const dismissCampaign = () => {
    if (activeCampaign) {
      const seenKey = `@seen_campaign_${activeCampaign.id}`;
      if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
        localStorage.setItem(seenKey, 'true');
      }
      setActiveCampaign(null);
    }
  };

  // ── Ecran inițializare (înainte de a ști dacă utilizatorul e logat) ──────────
  if (!isInitialized) {
    return <AppLoadingScreen message={t('loading.initializing')} />;
  }

  if (user && isLoadingAccess) {
    return <AppLoadingScreen message={t('loading.checking_access')} />;
  }

  // ── Previne flash-ul landing page-ului când userul e deja autentificat ──────
  // useAuthGuard redirectează (spre (tabs) sau onboarding), dar are nevoie de un
  // ciclu de render pentru a rula. În acel interval, landing page-ul ar apărea
  // scurt. Afișăm loading în locul lui, indiferent de starea onboarding-ului.
  if (user && LANDING_SEGMENTS.has(segments[0] as string | undefined)) {
    return <AppLoadingScreen message="" />;
  }

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: appearance.colors.background },
        }}
      >
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="modules" />
      </Stack>

      {showMaintenanceBanner && (
        <View style={styles.maintenanceBanner}>
          <Text style={styles.maintenanceText}>
            {t('app.maintenance')}
          </Text>
        </View>
      )}

      {/* Update-ul are prioritate: cât e vizibil, celelalte popup-uri nu apar */}
      <AppUpdatePrompt onVisibilityChange={setUpdatePromptVisible} />

      {!updatePromptVisible && (
        <NotificationPermissionPrompt onVisibilityChange={setNotifPromptVisible} />
      )}

      {activeCampaign && !notifPromptVisible && !updatePromptVisible && (
        <View style={styles.popupOverlay}>
          <View style={styles.popupContent}>
            <View style={styles.popupHeader}>
              <Text style={styles.popupTitle}>{activeCampaign.title}</Text>
              <TouchableOpacity onPress={dismissCampaign} style={styles.popupCloseBtn}>
                <Text style={styles.popupCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.popupBody}>{activeCampaign.body}</Text>
            <TouchableOpacity style={styles.popupButton} onPress={dismissCampaign}>
              <Text style={styles.popupButtonText}>{t('common.understood')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    // Fraunces: require('../../assets/fonts/Fraunces-Regular.ttf'),
    // Geist fonts temporarily disabled — using system fonts
  });
  const [i18nReady, setI18nReady] = useState(false);

  const { isInitialized } = useAuthStore();
  const appearance = useAppearance();

  useEffect(() => {
    initI18n()
      .then(() => {
        installRuntimeTextTranslations();
        setI18nReady(true);
      })
      .catch(() => {
        installRuntimeTextTranslations();
        setI18nReady(true);
      });
  }, []);

  useEffect(() => {
    if (isInitialized) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [isInitialized]);

  if (!fontsLoaded || !i18nReady) return null;

  return (
    <GestureHandlerRootView style={[styles.root, { backgroundColor: appearance.colors.background }]}>
      <SafeAreaProvider>
        <StatusBar style={appearance.isDark ? 'light' : 'dark'} backgroundColor={appearance.colors.background} />
        <AppErrorBoundary>
          <AppContent />
          <Toast />
          <PersistentTimerBar />
          <PWAUpdateBanner />
          <InAppBrowserPrompt />
          <PWAInstallBanner />
        </AppErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  popupOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    padding: 20,
  },
  maintenanceBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9000,
    backgroundColor: Colors.warning,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  maintenanceText: {
    fontFamily: 'Geist-SemiBold',
    fontSize: 13,
    color: Colors.white,
    textAlign: 'center',
  },
  popupContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  popupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  popupTitle: {
    fontSize: 18,
    fontFamily: 'Geist-SemiBold',
    color: Colors.textPrimary,
  },
  popupCloseBtn: {
    padding: 4,
  },
  popupCloseText: {
    fontSize: 18,
    color: Colors.textTertiary,
  },
  popupBody: {
    fontSize: 14,
    fontFamily: 'Geist',
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 20,
  },
  popupButton: {
    backgroundColor: Colors.child.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  popupButtonText: {
    color: 'white',
    fontSize: 14,
    fontFamily: 'Geist-SemiBold',
  },
});
