import { useCallback } from 'react';
import Toast from 'react-native-toast-message';
import type * as ExpoNotifications from 'expo-notifications';
import { useAuthStore } from '../stores/authStore';
import { useChildStore } from '../stores/childStore';
import { useTimerStore } from '../stores/timerStore';
import {
  notificationService,
  SMART_REMINDER_ACTIONS,
  SMART_MEAL_CATEGORY,
  SMART_SLEEP_CATEGORY,
} from '../services/notificationService';

/**
 * Acțiuni rapide de pe reminderele smart — înregistrare direct din notificare,
 * fără să deschizi aplicația:
 *  - „Alăptare acum" / „Biberon acum" → scrie masa în Firestore pe loc
 *  - „A adormit" → pornește timerul de somn (apare pe lock screen, stop = salvare)
 *  - „Amână 30 min" → reprogramează același reminder
 *
 * Returnează un handler(response) → true dacă acțiunea a fost gestionată.
 */
export function useQuickLogActions() {
  const { user } = useAuthStore();
  const { activeChild, addFeed } = useChildStore();
  const { startTimer } = useTimerStore();

  return useCallback(async (response: ExpoNotifications.NotificationResponse): Promise<boolean> => {
    const actionId = response.actionIdentifier;
    const values = Object.values(SMART_REMINDER_ACTIONS) as string[];
    if (!values.includes(actionId)) return false;

    const content = response.notification.request.content;
    const data = (content.data || {}) as Record<string, string>;

    // ── Amână 30 min: reprogramăm exact aceeași notificare ──
    if (actionId === SMART_REMINDER_ACTIONS.snooze30) {
      const category = data.type === 'sleep_window' ? SMART_SLEEP_CATEGORY : SMART_MEAL_CATEGORY;
      await notificationService.scheduleLocalNotification(
        content.title || 'MamiApp',
        content.body || '',
        { type: 'date', date: new Date(Date.now() + 30 * 60 * 1000) } as any,
        data,
        { categoryIdentifier: category }
      ).catch(() => {});
      return true;
    }

    if (!user) return true; // acțiune consumată, dar fără sesiune nu putem scrie

    // childId din payload (robust la cold start), cu fallback pe copilul activ
    const childId = data.childId || activeChild?.id;
    const childOwnerId = data.childOwnerId || activeChild?.ownerId || user.uid;
    if (!childId) return true;

    // ── Înregistrare masă cu un singur tap ──
    if (actionId === SMART_REMINDER_ACTIONS.logFeedBreast || actionId === SMART_REMINDER_ACTIONS.logFeedBottle) {
      const isBottle = actionId === SMART_REMINDER_ACTIONS.logFeedBottle;
      try {
        const [{ Timestamp }, { feedingService }] = await Promise.all([
          import('firebase/firestore'),
          import('../services/feedingService'),
        ]);
        const feed = {
          timestamp: Timestamp.now(),
          type: (isBottle ? 'bottle' : 'breastfeeding') as 'bottle' | 'breastfeeding',
          ...(isBottle ? {} : { side: 'left' as const }),
          createdBy: user.uid,
        };
        const id = await feedingService.addFeed(childOwnerId, childId, feed);
        if (activeChild?.id === childId) addFeed({ ...feed, id });
        Toast.show({
          type: 'success',
          text1: isBottle ? '🍼 Biberon înregistrat' : '🤱 Alăptare înregistrată',
          text2: 'Poți edita detaliile din modulul Hrănire.',
        });
      } catch {
        Toast.show({ type: 'error', text1: 'Nu am putut salva masa. Deschide modulul Hrănire.' });
      }
      return true;
    }

    // ── A adormit: pornim timerul de somn (stop = salvare automată) ──
    if (actionId === SMART_REMINDER_ACTIONS.logSleepStart) {
      const hour = new Date().getHours();
      startTimer({
        type: 'sleep',
        label: 'Somn',
        startTime: Date.now(),
        metadata: { sleepType: hour >= 19 || hour < 6 ? 'night' : 'nap' },
      });
      Toast.show({
        type: 'success',
        text1: '😴 Timer de somn pornit',
        text2: 'Apasă Stop pe notificare la trezire — somnul se salvează automat.',
      });
      return true;
    }

    return false;
  }, [user?.uid, activeChild?.id, activeChild?.ownerId, addFeed, startTimer]);
}
