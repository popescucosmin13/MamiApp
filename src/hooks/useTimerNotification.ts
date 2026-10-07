import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform } from 'react-native';
import { ActiveTimer, getElapsedSeconds, isTimerPaused, useTimerStore } from '../stores/timerStore';

const TIMER_EMOJIS: Record<string, string> = {
  feeding: '🍼',
  sleep: '😴',
  contraction: '⏱️',
};

export const TIMER_NOTIFICATION_ACTIONS = {
  pause: 'MAMI_TIMER_PAUSE',
  resume: 'MAMI_TIMER_RESUME',
  stop: 'MAMI_TIMER_STOP',
} as const;

const TIMER_RUNNING_CATEGORY = 'MAMI_TIMER_RUNNING';
const TIMER_PAUSED_CATEGORY = 'MAMI_TIMER_PAUSED';

export function useTimerNotifications() {
  const { t, i18n } = useTranslation();
  const { activeTimers } = useTimerStore();
  const notifIds = useRef<Map<string, string>>(new Map());
  const webNotifs = useRef<Map<string, Notification>>(new Map());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const getTimerLabel = (timer: ActiveTimer) => {
    const key = `timer_notifications.labels.${timer.type}`;
    const translated = t(key);
    return translated === key ? timer.label : translated;
  };

  useEffect(() => {
    if (Platform.OS === 'web') return;
    import('expo-notifications').then((Notifications) => {
      Notifications.setNotificationCategoryAsync(TIMER_RUNNING_CATEGORY, [
        { identifier: TIMER_NOTIFICATION_ACTIONS.pause, buttonTitle: t('common.pause') },
        { identifier: TIMER_NOTIFICATION_ACTIONS.stop, buttonTitle: t('common.stop') },
      ]).catch(() => {});
      Notifications.setNotificationCategoryAsync(TIMER_PAUSED_CATEGORY, [
        { identifier: TIMER_NOTIFICATION_ACTIONS.resume, buttonTitle: t('common.resume') },
        { identifier: TIMER_NOTIFICATION_ACTIONS.stop, buttonTitle: t('common.stop') },
      ]).catch(() => {});
    }).catch(() => {});
  }, [t, i18n.language]);

  const postOrUpdateWebNotif = async (timer: ActiveTimer) => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    const paused = isTimerPaused(timer);
    const elapsed = getElapsedSeconds(timer);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    const timeStr = `${minutes}:${String(seconds).padStart(2, '0')}`;
    const title = `${TIMER_EMOJIS[timer.type] ?? ''} ${getTimerLabel(timer)}${paused ? ' paused' : ''}`.trim();
    const body = paused
      ? t('timer_notifications.web_paused_body', { time: timeStr })
      : t('timer_notifications.web_running_body', { time: timeStr });
    const actions = [
      {
        action: paused ? TIMER_NOTIFICATION_ACTIONS.resume : TIMER_NOTIFICATION_ACTIONS.pause,
        title: paused ? t('common.resume') : t('common.pause'),
      },
      { action: TIMER_NOTIFICATION_ACTIONS.stop, title: t('common.stop') },
    ];

    webNotifs.current.get(timer.id)?.close();
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready;
        const existing = await registration.getNotifications({ tag: `mamiapp-${timer.id}` });
        existing.forEach((notification) => notification.close());
        await registration.showNotification(title, {
          body,
          tag: `mamiapp-${timer.id}`,
          renotify: true,
          silent: true,
          icon: '/assets/pwa-icon-512.png',
          badge: '/assets/notification-icon.png',
          data: { timerId: timer.id, timerType: timer.type },
          actions,
        } as NotificationOptions & { actions: { action: string; title: string }[] });
        return;
      } catch {}
    }

    const notification = new Notification(title, {
      body,
      tag: `mamiapp-${timer.id}`,
      silent: true,
      icon: '/assets/pwa-icon-512.png',
      badge: '/assets/notification-icon.png',
      data: { timerId: timer.id, timerType: timer.type },
      actions,
    } as NotificationOptions & { actions: { action: string; title: string }[] });
    notification.onclick = () => window.focus();
    webNotifs.current.set(timer.id, notification);
  };

  const postOrUpdateTimerNotif = async (timer: ActiveTimer) => {
    if (Platform.OS === 'web') {
      postOrUpdateWebNotif(timer);
      return;
    }

    const paused = isTimerPaused(timer);
    const elapsed = getElapsedSeconds(timer);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    const timeStr = `${minutes}:${String(seconds).padStart(2, '0')}`;

    const title = `${TIMER_EMOJIS[timer.type] ?? ''} ${getTimerLabel(timer)}${paused ? ' paused' : ''}`.trim();
    const body = paused
      ? t('timer_notifications.native_paused_body', { time: timeStr })
      : t('timer_notifications.native_running_body', { time: timeStr });

    const existingId = notifIds.current.get(timer.id);
    try {
      const Notifications = await import('expo-notifications');
      if (existingId) {
        await Notifications.dismissNotificationAsync(existingId).catch(() => {});
      }
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: { timerId: timer.id, timerType: timer.type },
          categoryIdentifier: paused ? TIMER_PAUSED_CATEGORY : TIMER_RUNNING_CATEGORY,
          sticky: true,
          autoDismiss: false,
        } as any,
        // Canalul 'timers' e configurat cu lockscreenVisibility PUBLIC și fără
        // sunet/vibrație — timerul apare pe ecranul blocat cu Pauză/Stop,
        // iar Stop salvează înregistrarea (useSaveTimer)
        trigger: Platform.OS === 'android' ? ({ channelId: 'timers' } as any) : null,
      });
      notifIds.current.set(timer.id, id);
    } catch {}
  };

  const clearTimerNotif = async (timerId: string) => {
    if (Platform.OS === 'web') {
      webNotifs.current.get(timerId)?.close();
      webNotifs.current.delete(timerId);
      return;
    }

    const id = notifIds.current.get(timerId);
    if (id) {
      const Notifications = await import('expo-notifications');
      await Notifications.dismissNotificationAsync(id).catch(() => {});
      await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
      notifIds.current.delete(timerId);
    }
  };

  useEffect(() => {
    const activeIds = new Set(activeTimers.map(t => t.id));

    notifIds.current.forEach((_, timerId) => {
      if (!activeIds.has(timerId)) clearTimerNotif(timerId);
    });
    webNotifs.current.forEach((_, timerId) => {
      if (!activeIds.has(timerId)) clearTimerNotif(timerId);
    });

    activeTimers.forEach(timer => {
      postOrUpdateTimerNotif(timer);
    });

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (activeTimers.length > 0 && Platform.OS !== 'web') {
      intervalRef.current = setInterval(() => {
        const currentTimers = useTimerStore.getState().activeTimers;
        currentTimers.forEach(timer => postOrUpdateTimerNotif(timer));
      }, 10_000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [activeTimers.length, activeTimers.map(t => `${t.id}-${t.pausedAt}`).join(','), i18n.language]);
}
