import { useEffect } from 'react';
import { Platform } from 'react-native';
import type { Timestamp } from 'firebase/firestore';
import { useAuthStore } from '../stores/authStore';
import { useChildStore } from '../stores/childStore';
import { notificationService } from '../services/notificationService';

function toDate(value: Timestamp | Date | undefined | null): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof (value as Timestamp).toDate === 'function') return (value as Timestamp).toDate();
  return null;
}

/**
 * Reprogramează notificările locale inteligente ori de câte ori se schimbă
 * datele copilului activ (mese, somn) sau preferințele:
 *  - reminder hrănire la intervalul median real al bebelușului
 *  - alertă fereastră de somn calculată de la ultima trezire înregistrată
 *
 * Montat o singură dată în root layout.
 */
export function useSmartReminders() {
  const { user, profile } = useAuthStore();
  const { activeChild, feeds, sleeps } = useChildStore();

  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (!user || !profile?.preferences?.notifications) return;

    // Debounce — adăugările optimiste pot veni în rafală
    const timer = setTimeout(() => {
      const prefs = profile.preferences.notifications as unknown as Record<string, boolean>;

      const birthDate = toDate(activeChild?.birthDate as Timestamp | undefined);
      const childAgeMonths = birthDate
        ? Math.max(0, Math.floor((Date.now() - birthDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44)))
        : 0;

      const feedTimes = feeds
        .map((feed) => toDate(feed.timestamp))
        .filter((d): d is Date => d !== null)
        .sort((a, b) => b.getTime() - a.getTime())
        .slice(0, 10);

      // Ultima trezire = sfârșitul celui mai recent somn încheiat
      const lastWakeAt = sleeps
        .map((sleep) => {
          const end = toDate(sleep.endTime);
          if (end) return end;
          const start = toDate(sleep.startTime);
          return start && sleep.duration ? new Date(start.getTime() + sleep.duration * 1000) : null;
        })
        .filter((d): d is Date => d !== null)
        .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

      notificationService
        .scheduleSmartReminders(prefs, {
          childAgeMonths,
          feedTimes,
          lastWakeAt,
          child: activeChild?.id
            ? { id: activeChild.id, ownerId: activeChild.ownerId }
            : undefined,
        })
        .catch(() => {});
    }, 3000);

    return () => clearTimeout(timer);
  }, [user?.uid, profile?.preferences?.notifications, activeChild?.id, feeds, sleeps]);
}
