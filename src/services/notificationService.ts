import * as ExpoNotifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { doc, setDoc, updateDoc, collection, query, orderBy, limit, getDocs, Timestamp, increment } from 'firebase/firestore';
import { db } from './firebase';

// VAPID key din Firebase Console → Project settings → Cloud Messaging → Web Push certificates
// Înlocuiește cu cheia ta reală (obținută din Firebase Console)
const VAPID_KEY = process.env.EXPO_PUBLIC_FIREBASE_VAPID_KEY || '';
let didWarnMissingAndroidFirebaseConfig = false;

// Acțiuni rapide pe reminderele smart — logging direct din notificare,
// fără a deschide aplicația. Gestionate în useQuickLogActions.
export const SMART_REMINDER_ACTIONS = {
  logFeedBreast: 'MAMI_LOG_FEED_BREAST',
  logFeedBottle: 'MAMI_LOG_FEED_BOTTLE',
  logSleepStart: 'MAMI_LOG_SLEEP_START',
  snooze30: 'MAMI_SNOOZE_30',
} as const;

export const SMART_MEAL_CATEGORY = 'MAMI_SMART_MEAL';
export const SMART_SLEEP_CATEGORY = 'MAMI_SMART_SLEEP';

// Configurare handler notificări
ExpoNotifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export const notificationService = {
  async configure(): Promise<void> {
    if (Platform.OS !== 'web') {
      // Butoane de acțiune pe remindere: înregistrare cu un singur tap
      await Promise.all([
        ExpoNotifications.setNotificationCategoryAsync(SMART_MEAL_CATEGORY, [
          { identifier: SMART_REMINDER_ACTIONS.logFeedBreast, buttonTitle: '🤱 Alăptare acum' },
          { identifier: SMART_REMINDER_ACTIONS.logFeedBottle, buttonTitle: '🍼 Biberon acum' },
          { identifier: SMART_REMINDER_ACTIONS.snooze30, buttonTitle: 'Amână 30 min' },
        ]),
        ExpoNotifications.setNotificationCategoryAsync(SMART_SLEEP_CATEGORY, [
          { identifier: SMART_REMINDER_ACTIONS.logSleepStart, buttonTitle: '😴 A adormit — pornește timerul' },
          { identifier: SMART_REMINDER_ACTIONS.snooze30, buttonTitle: 'Amână 30 min' },
        ]),
      ]).catch(() => {});
    }

    if (Platform.OS === 'android') {
      const baseChannel = {
        importance: ExpoNotifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#E8997A',
        sound: 'default' as const,
      };

      await Promise.all([
        ExpoNotifications.setNotificationChannelAsync('default', {
          ...baseChannel,
          name: 'MamiApp',
          description: 'Notificari generale MamiApp',
        }),
        ExpoNotifications.setNotificationChannelAsync('reminders', {
          ...baseChannel,
          name: 'Remindere',
          description: 'Hrana, somn, vaccinuri si rezumate zilnice',
        }),
        ExpoNotifications.setNotificationChannelAsync('campaigns', {
          ...baseChannel,
          name: 'Noutati MamiApp',
          description: 'Anunturi si mesaje trimise de echipa MamiApp',
        }),
        // Canal dedicat timerelor active (alaptare/somn/contractii):
        // vizibil pe ecranul blocat, silentios (se actualizeaza la 10s,
        // sunetul/vibratia la fiecare update ar fi insuportabile)
        ExpoNotifications.setNotificationChannelAsync('timers', {
          name: 'Timere active',
          description: 'Timerul de alaptare/somn in desfasurare, cu pauza si stop',
          importance: ExpoNotifications.AndroidImportance.DEFAULT,
          lockscreenVisibility: ExpoNotifications.AndroidNotificationVisibility.PUBLIC,
          sound: undefined,
          enableVibrate: false,
          vibrationPattern: undefined,
          showBadge: false,
        }),
      ]).catch(() => {});
    }
  },

  async getPermissionStatus(): Promise<'granted' | 'denied' | 'undetermined'> {
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined' || !('Notification' in window)) return 'denied';
      return Notification.permission === 'default' ? 'undetermined' : Notification.permission;
    }

    const { status } = await ExpoNotifications.getPermissionsAsync();
    return status as 'granted' | 'denied' | 'undetermined';
  },
  // Cere permisiunea notificărilor
  async requestPermission(): Promise<boolean> {
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined' || !('Notification' in window)) return false;
      if (Notification.permission === 'granted') return true;
      if (Notification.permission === 'denied') return false;
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }

    const { status: existingStatus } = await ExpoNotifications.getPermissionsAsync();
    if (existingStatus === 'granted') return true;
    const { status } = await ExpoNotifications.requestPermissionsAsync();
    if (status === 'granted') {
      await notificationService.configure();
    }
    return status === 'granted';
  },

  // Obține token-ul device-ului
  // IMPORTANT: În Expo SDK 54+, projectId este obligatoriu
  async getDeviceToken(): Promise<string | null> {
    try {
      if (Platform.OS === 'web') return null;
      await notificationService.configure();
      if (Platform.OS === 'android' && !Constants.expoConfig?.android?.googleServicesFile) {
        if (!didWarnMissingAndroidFirebaseConfig) {
          didWarnMissingAndroidFirebaseConfig = true;
          console.warn(
            'Android push disabled: add google-services.json and expo.android.googleServicesFile, then rebuild the native app.'
          );
        }
        return null;
      }
      const projectId =
        Constants.easConfig?.projectId ??
        Constants.expoConfig?.extra?.eas?.projectId ??
        Constants.expoConfig?.extra?.projectId;
      if (projectId === 'mamiapp-project-id') {
        console.warn('Expo projectId este placeholder. Ruleaza `eas init` inainte de notificari native.');
        return null;
      }
      const token = await ExpoNotifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined
      );
      return token.data;
    } catch (e) {
      console.warn('Push token unavailable:', e);
      return null;
    }
  },

  // Salvează Expo Push Token în Firestore — pentru native iOS/Android
  async saveDeviceToken(userId: string, token: string): Promise<void> {
    const projectId =
      Constants.easConfig?.projectId ??
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.expoConfig?.extra?.projectId ??
      null;
    const appVersion = Constants.nativeAppVersion || Constants.expoConfig?.version || '';
    const appBuildVersion =
      Constants.nativeBuildVersion ||
      (Platform.OS === 'android'
        ? Constants.expoConfig?.android?.versionCode?.toString?.()
        : Constants.expoConfig?.ios?.buildNumber) ||
      '';
    const tokenRef = doc(collection(db, 'users', userId, 'devices'), token);
    await setDoc(tokenRef, {
      token,
      platform: Platform.OS,
      type: 'expo',
      projectId,
      appOwnership: Constants.appOwnership || 'unknown',
      appVersion,
      appBuildVersion,
      registeredAt: Timestamp.now(),
      lastUsed: Timestamp.now(),
    }, { merge: true });

    // fcmToken = Expo Push Token (denumire istorică, menținută pentru compatibilitate)
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, {
      fcmToken: token,
      nativePushPlatform: Platform.OS,
      nativePushRegisteredAt: Timestamp.now(),
    }, { merge: true });
  },

  /**
   * Înregistrează Web Push pentru PWA (Android Chrome, iOS Safari 16.4+).
   * Obține FCM Registration Token via Firebase Web SDK și îl salvează ca
   * `webPushToken` în profilul utilizatorului — Cloud Functions îl folosesc
   * pentru a trimite notificări push când aplicația e închisă.
   *
   * Trebuie apelat DUPĂ ce utilizatorul a acordat permisiunea de notificări.
   */
  async registerWebPush(userId: string): Promise<void> {
    if (Platform.OS !== 'web') return;
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    if (Notification.permission !== 'granted') return;
    if (!VAPID_KEY) {
      console.warn('[MamiApp] VAPID key lipsă — adaugă EXPO_PUBLIC_FIREBASE_VAPID_KEY în .env');
      return;
    }

    try {
      // Importăm Firebase Messaging dinamic (nu e necesar pe native)
      const { getMessaging, getToken } = await import('firebase/messaging');
      const { app } = await import('./firebase');

      const messaging = getMessaging(app);

      // Așteptăm înregistrarea service worker-ului dedicat Firebase Messaging
      let swRegistration = await navigator.serviceWorker.getRegistration('/');
      const activeScriptUrl =
        swRegistration?.active?.scriptURL ||
        swRegistration?.waiting?.scriptURL ||
        swRegistration?.installing?.scriptURL ||
        '';

      if (!swRegistration || !activeScriptUrl.endsWith('/sw-custom.js')) {
        swRegistration = await navigator.serviceWorker.register('/sw-custom.js', {
          scope: '/',
          updateViaCache: 'none',
        });
      }

      await swRegistration.update().catch(() => {});
      if (!swRegistration.active) {
        swRegistration = await navigator.serviceWorker.ready;
      }

      const token = await getToken(messaging, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: swRegistration,
      });

      if (!token) return;

      // Salvăm token-ul ca webPushToken — separat de Expo Push Token
      const userRef = doc(db, 'users', userId);
      await setDoc(userRef, { webPushToken: token }, { merge: true });

      // Salvăm și în subcollecția devices pentru audit
      const deviceRef = doc(collection(db, 'users', userId, 'devices'), `web_${token.slice(-16)}`);
      await setDoc(deviceRef, {
        token,
        platform: 'web',
        type: 'fcm_web',
        registeredAt: Timestamp.now(),
        lastUsed: Timestamp.now(),
      });

      console.log('[MamiApp] Web Push token înregistrat.');
    } catch (err) {
      // Non-fatal — aplicația funcționează fără web push
      console.warn('[MamiApp] Web Push registration failed:', err);
    }
  },

  /**
   * Înregistrează o deschidere a aplicației în histograma orelor.
   * Orchestratorul server-side folosește histograma pentru a alege
   * ora personală de trimitere a notificărilor smart.
   */
  async trackAppOpen(userId: string): Promise<void> {
    try {
      const hour = new Date().getHours();
      const ref = doc(db, 'users', userId, 'engagement', 'stats');
      await setDoc(ref, {
        hours: { [String(hour)]: increment(1) },
        opens: increment(1),
        lastOpenAt: Timestamp.now(),
      }, { merge: true });
    } catch {
      // Non-critical
    }
  },

  /**
   * Marchează o notificare smart ca deschisă (tap). Cloud Function-ul
   * onNotificationLogOpened agregă CTR-ul per tip din acest câmp.
   */
  async markNotificationOpened(userId: string, logId: string): Promise<void> {
    try {
      const ref = doc(db, 'users', userId, 'notificationLog', logId);
      await updateDoc(ref, { opened: true, openedAt: Timestamp.now() });
    } catch {
      // Non-critical — logul poate lipsi (ex. notificare locală)
    }
  },

  // Obține cea mai recentă campanie activă
  async getLatestCampaign(): Promise<any> {
    try {
      const q = query(
        collection(db, 'notificationCampaigns'),
        orderBy('createdAt', 'desc'),
        limit(20)
      );
      const snap = await getDocs(q);
      const doc = snap.docs.find(d => d.data().status === 'sent');
      if (!doc) return null;
      return { id: doc.id, ...doc.data() };
    } catch (e) {
      console.warn('Failed to fetch latest campaign:', e);
      return null;
    }
  },

  // Programează notificare locală
  async scheduleLocalNotification(
    title: string,
    body: string,
    trigger: ExpoNotifications.NotificationTriggerInput,
    data?: Record<string, unknown>,
    options?: { categoryIdentifier?: string }
  ): Promise<string> {
    return ExpoNotifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data || {},
        ...(options?.categoryIdentifier ? { categoryIdentifier: options.categoryIdentifier } : {}),
      },
      trigger,
    });
  },

  // Notificare la o dată specifică
  async scheduleAt(
    title: string,
    body: string,
    date: Date,
    data?: Record<string, unknown>
  ): Promise<string> {
    return notificationService.scheduleLocalNotification(
      title,
      body,
      { type: 'date', date } as ExpoNotifications.NotificationTriggerInput,
      data
    );
  },

  // Anulează toate notificările programate
  async cancelAll(): Promise<void> {
    await ExpoNotifications.cancelAllScheduledNotificationsAsync();
  },

  // Anulează o notificare specifică
  async cancel(id: string): Promise<void> {
    await ExpoNotifications.cancelScheduledNotificationAsync(id);
  },

  /**
   * Programează notificările locale pe baza preferințelor (fără date de context).
   * Menținut pentru compatibilitate — deleagă către scheduleSmartReminders.
   */
  async scheduleFromPreferences(
    prefs: Record<string, boolean>,
    childAgeMonths: number = 0
  ): Promise<void> {
    return notificationService.scheduleSmartReminders(prefs, { childAgeMonths });
  },

  /**
   * Programează notificările locale INTELIGENT, pe baza datelor reale ale copilului:
   *  - hrănire: intervalul median al ultimelor mese (nu un interval fix de 4h)
   *  - somn: sfârșitul ferestrei de veghe pentru vârstă, calculat de la ultima trezire
   *  - sumar zilnic la 20:00 (neschimbat)
   *
   * Reprogramat automat după fiecare masă/somn înregistrat (useSmartReminders).
   */
  async scheduleSmartReminders(
    prefs: Record<string, boolean>,
    input: {
      childAgeMonths?: number;
      /** timestamps ale ultimelor mese, cele mai recente primele */
      feedTimes?: Date[];
      /** ultima trezire înregistrată (sfârșitul ultimului somn) */
      lastWakeAt?: Date | null;
      /** copilul activ — pentru logging direct din notificare (quick actions) */
      child?: { id: string; ownerId?: string };
    } = {}
  ): Promise<void> {
    if (Platform.OS === 'web') return; // local scheduling not supported on web

    const status = await notificationService.getPermissionStatus();
    if (status !== 'granted') return;

    // Anulăm toate notificările locale anterioare (se reprogramează complet)
    await ExpoNotifications.cancelAllScheduledNotificationsAsync();

    const now = new Date();
    const childAgeMonths = input.childAgeMonths ?? 0;
    // Datele copilului merg în payload ca quick actions să poată scrie
    // înregistrarea chiar și când aplicația pornește la rece din notificare
    const childData = input.child?.id
      ? { childId: input.child.id, childOwnerId: input.child.ownerId || '' }
      : {};

    // ── Reminder hrănire: din ritmul real al bebelușului ──
    if (prefs.meals) {
      const feedTimes = (input.feedTimes || []).slice(0, 10);
      const intervalMs = notificationService.computeMedianIntervalMs(feedTimes)
        ?? 3.5 * 60 * 60 * 1000; // fallback: 3h30
      const intervalHours = Math.round((intervalMs / 3_600_000) * 10) / 10;
      const lastFeed = feedTimes[0];
      let nextAt = lastFeed
        ? new Date(lastFeed.getTime() + intervalMs)
        : new Date(now.getTime() + intervalMs);
      // Dacă momentul a trecut deja (ex. app deschis târziu), amânăm cu un interval de la acum
      if (nextAt.getTime() <= now.getTime() + 5 * 60 * 1000) {
        nextAt = new Date(now.getTime() + intervalMs);
      }
      const body = lastFeed
        ? `De obicei mesele vin la ~${intervalHours}h. Ultima masă: ${lastFeed.getHours()}:${String(lastFeed.getMinutes()).padStart(2, '0')}.`
        : 'Nu a fost înregistrată nicio masă recent.';
      await notificationService.scheduleLocalNotification(
        '🍼 Se apropie ora mesei',
        body,
        { type: 'date', date: nextAt } as any,
        { type: 'meal_reminder', screen: '/modules/feeding', ...childData },
        { categoryIdentifier: SMART_MEAL_CATEGORY }
      ).catch(() => {});
    }

    // ── Fereastră somn: de la ultima trezire + fereastra de veghe pentru vârstă ──
    if (prefs.sleep && childAgeMonths <= 18) {
      const wakeWindowMs = notificationService.wakeWindowMsForAge(childAgeMonths);
      const lastWake = input.lastWakeAt;
      const wakeIsRecent = lastWake && now.getTime() - lastWake.getTime() < 12 * 60 * 60 * 1000;
      let scheduled = false;

      if (lastWake && wakeIsRecent) {
        // Anunțăm cu 15 minute înainte de închiderea ferestrei de veghe
        const windowAt = new Date(lastWake.getTime() + wakeWindowMs - 15 * 60 * 1000);
        if (windowAt.getTime() > now.getTime() + 60 * 1000) {
          await notificationService.scheduleLocalNotification(
            '😴 Fereastra de somn se apropie',
            'În ~15 minute se închide fereastra de veghe. Începe rutina de somn pentru o adormire ușoară.',
            { type: 'date', date: windowAt } as any,
            { type: 'sleep_window', screen: '/modules/sleep', ...childData },
            { categoryIdentifier: SMART_SLEEP_CATEGORY }
          ).catch(() => {});
          scheduled = true;
        }
      }

      // Fallback: rutina de seară clasică la 19:30 pentru copii până la 12 luni
      if (!scheduled && childAgeMonths <= 12) {
        const sleepTime = new Date();
        sleepTime.setHours(19, 30, 0, 0);
        if (sleepTime <= now) sleepTime.setDate(sleepTime.getDate() + 1);
        await notificationService.scheduleLocalNotification(
          '😴 Fereastra de somn',
          'A venit momentul somnului! Rutina de seară ajută la un somn mai lung.',
          { type: 'date', date: sleepTime } as any,
          { type: 'sleep_window', screen: '/modules/sleep', ...childData },
          { categoryIdentifier: SMART_SLEEP_CATEGORY }
        ).catch(() => {});
      }
    }

    // ── Sumar zilnic AI la 20:00 ──
    if (prefs.aiSummary) {
      const summaryTime = new Date();
      summaryTime.setHours(20, 0, 0, 0);
      if (summaryTime <= now) summaryTime.setDate(summaryTime.getDate() + 1);
      await notificationService.scheduleLocalNotification(
        '📊 Rezumatul zilei',
        'Ziua ta cu bebelușul — statistici și recomandări personalizate.',
        { type: 'date', date: summaryTime } as any,
        { type: 'daily_summary', screen: '/(tabs)' }
      ).catch(() => {});
    }
  },

  /** Intervalul median între evenimente consecutive (minim 3 evenimente). Clamp 2h–5h. */
  computeMedianIntervalMs(times: Date[]): number | null {
    if (times.length < 3) return null;
    const sorted = [...times].sort((a, b) => b.getTime() - a.getTime());
    const intervals: number[] = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      const diff = sorted[i].getTime() - sorted[i + 1].getTime();
      // Ignorăm pauzele lungi (noaptea) și dublurile
      if (diff > 20 * 60 * 1000 && diff < 8 * 60 * 60 * 1000) intervals.push(diff);
    }
    if (intervals.length < 2) return null;
    intervals.sort((a, b) => a - b);
    const median = intervals[Math.floor(intervals.length / 2)];
    return Math.max(2 * 60 * 60 * 1000, Math.min(5 * 60 * 60 * 1000, median));
  },

  /** Fereastra de veghe recomandată pentru vârstă (în ms). */
  wakeWindowMsForAge(ageMonths: number): number {
    const table: Array<{ maxMonths: number; hours: number }> = [
      { maxMonths: 1, hours: 1 },
      { maxMonths: 3, hours: 1.5 },
      { maxMonths: 6, hours: 2.25 },
      { maxMonths: 9, hours: 3 },
      { maxMonths: 12, hours: 3.75 },
      { maxMonths: 18, hours: 5 },
      { maxMonths: 60, hours: 6 },
    ];
    const entry = table.find((e) => ageMonths <= e.maxMonths) || table[table.length - 1];
    return entry.hours * 60 * 60 * 1000;
  },

  /**
   * Răspunsul la notificarea care a PORNIT aplicația (cold start).
   * Listenerul obișnuit se înregistrează prea târziu ca să-l prindă —
   * fără apelul ăsta, tap-urile pe notificări cu aplicația închisă
   * nu navighează și nu se contorizează la statistici.
   */
  async getLastNotificationResponse(): Promise<ExpoNotifications.NotificationResponse | null> {
    if (Platform.OS === 'web') return null;
    try {
      return await ExpoNotifications.getLastNotificationResponseAsync();
    } catch {
      return null;
    }
  },

  // Listeneruri pentru notificări primite
  addNotificationReceivedListener(
    callback: (notification: ExpoNotifications.Notification) => void
  ) {
    return ExpoNotifications.addNotificationReceivedListener(callback);
  },

  addNotificationResponseReceivedListener(
    callback: (response: ExpoNotifications.NotificationResponse) => void
  ) {
    return ExpoNotifications.addNotificationResponseReceivedListener(callback);
  },
};
