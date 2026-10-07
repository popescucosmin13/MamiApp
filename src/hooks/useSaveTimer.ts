import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import Toast from 'react-native-toast-message';
import { useAuthStore } from '../stores/authStore';
import { useChildStore } from '../stores/childStore';
import { usePregnancyStore } from '../stores/pregnancyStore';
import { useTimerStore, ActiveTimer, getElapsedSeconds } from '../stores/timerStore';

function fmt(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function useSaveTimer() {
  const { t, i18n } = useTranslation();
  const { user } = useAuthStore();
  const { activeChild, addFeed, addSleep } = useChildStore();
  const { addContraction } = usePregnancyStore();
  const { stopTimer } = useTimerStore();

  const saveAndStop = useCallback(async (timer: ActiveTimer) => {
    const elapsed = getElapsedSeconds(timer);
    const locale = i18n.language === 'en' ? 'en-US' : 'ro-RO';

    if (!user) {
      stopTimer(timer.id);
      return;
    }

    if (timer.type === 'feeding') {
      if (!activeChild?.id) { stopTimer(timer.id); return; }
      if (elapsed < 5) {
        stopTimer(timer.id);
        Toast.show({ type: 'info', text1: t('timer_save.feeding_too_short') });
        return;
      }
      try {
        const [{ Timestamp }, { feedingService }] = await Promise.all([
          import('firebase/firestore'),
          import('../services/feedingService'),
        ]);
        const startTs = Timestamp.fromMillis(timer.startTime);
        const childOwnerId = activeChild.ownerId || user.uid;
        const feed = {
          timestamp: startTs,
          type: 'breastfeeding' as const,
          side: timer.metadata?.side ?? 'left',
          duration: elapsed,
          createdBy: user.uid,
        };
        const id = await feedingService.addFeed(childOwnerId, activeChild.id, feed);
        addFeed({ ...feed, id });
        stopTimer(timer.id);
        Toast.show({
          type: 'success',
          text1: t('timer_save.feeding_saved'),
          text2: `${fmt(elapsed)} · ${startTs.toDate().toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}`,
        });
      } catch {
        Toast.show({ type: 'error', text1: t('common.save_error') });
      }
      return;
    }

    if (timer.type === 'sleep') {
      if (!activeChild?.id) { stopTimer(timer.id); return; }
      if (elapsed < 60) {
        stopTimer(timer.id);
        Toast.show({ type: 'info', text1: t('timer_save.sleep_too_short') });
        return;
      }
      try {
        const [{ Timestamp }, { sleepService }] = await Promise.all([
          import('firebase/firestore'),
          import('../services/sleepService'),
        ]);
        const startTs = Timestamp.fromMillis(timer.startTime);
        const endTs = Timestamp.now();
        const childOwnerId = activeChild.ownerId || user.uid;
        const record = {
          startTime: startTs,
          endTime: endTs,
          duration: elapsed,
          type: (timer.metadata?.sleepType ?? 'nap') as 'nap' | 'night',
          quality: 'good' as const,
          createdBy: user.uid,
        };
        const id = await sleepService.addSleep(childOwnerId, activeChild.id, record);
        addSleep({ ...record, id });
        stopTimer(timer.id);
        Toast.show({
          type: 'success',
          text1: t('timer_save.sleep_saved'),
          text2: `${fmt(elapsed)} · ${startTs.toDate().toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}`,
        });
      } catch {
        Toast.show({ type: 'error', text1: t('common.save_error') });
      }
      return;
    }

    if (timer.type === 'contraction') {
      try {
        const [{ Timestamp }, { pregnancyService }] = await Promise.all([
          import('firebase/firestore'),
          import('../services/pregnancyService'),
        ]);
        const startTs = Timestamp.fromMillis(timer.startTime);
        const endTs = Timestamp.now();
        const contraction = {
          startTime: startTs,
          endTime: endTs,
          duration: elapsed,
          intensity: 3 as const,
        };
        const id = await pregnancyService.addContraction(user.uid, contraction);
        addContraction({ ...contraction, id });
        stopTimer(timer.id);
        Toast.show({
          type: 'success',
          text1: t('timer_save.contraction_saved'),
          text2: fmt(elapsed),
        });
      } catch {
        Toast.show({ type: 'error', text1: t('common.save_error') });
      }
      return;
    }

    stopTimer(timer.id);
  }, [user, activeChild, addFeed, addSleep, addContraction, stopTimer, t, i18n.language]);

  return saveAndStop;
}
