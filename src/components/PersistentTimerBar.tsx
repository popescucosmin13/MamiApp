import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Pressable,
} from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  useTimerStore,
  ActiveTimer,
  TimerType,
  getElapsedSeconds,
  isTimerPaused,
} from '../stores/timerStore';
import { useSaveTimer } from '../hooks/useSaveTimer';
import { Colors } from '../theme/colors';
import { Spacing } from '../theme/spacing';

/** Route where each timer type lives — bar hides that chip while on that page. */
const TIMER_ROUTES: Record<TimerType, string> = {
  feeding: '/modules/feeding',
  sleep: '/modules/sleep',
  contraction: '/modules/pregnancy/contractions',
};

function useElapsed(timer: ActiveTimer) {
  const [elapsed, setElapsed] = useState(() => getElapsedSeconds(timer));

  useEffect(() => {
    // If paused, just display current elapsed and stop ticking
    if (isTimerPaused(timer)) {
      setElapsed(getElapsedSeconds(timer));
      return;
    }
    setElapsed(getElapsedSeconds(timer));
    const interval = setInterval(() => setElapsed(getElapsedSeconds(timer)), 1000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timer.pausedAt, timer.totalPausedMs, timer.startTime]);

  return elapsed;
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function getTimerConfig(type: TimerType) {
  switch (type) {
    case 'feeding':    return { emoji: '🍼', color: Colors.feeding,           route: TIMER_ROUTES.feeding };
    case 'sleep':      return { emoji: '😴', color: Colors.sleep,             route: TIMER_ROUTES.sleep };
    case 'contraction':return { emoji: '⏱️', color: Colors.pregnancy.primary, route: TIMER_ROUTES.contraction };
  }
}

function TimerChip({ timer, onSaveStop }: { timer: ActiveTimer; onSaveStop: (t: ActiveTimer) => void }) {
  const elapsed = useElapsed(timer);
  const config = getTimerConfig(timer.type);
  const paused = isTimerPaused(timer);
  const router = useRouter();
  const { pauseTimer, resumeTimer } = useTimerStore();
  const { t } = useTranslation();

  return (
    <Pressable
      style={[styles.chip, { borderColor: config.color }]}
      onPress={() => router.push(config.route as any)}
    >
      <Text style={styles.chipEmoji}>{config.emoji}</Text>
      <View style={styles.chipInfo}>
        <Text style={styles.chipLabel} numberOfLines={1}>{timer.label}</Text>
        <Text style={[styles.chipTime, { color: paused ? Colors.textTertiary : config.color }]}>
          {formatTime(elapsed)}{paused ? ` ${t('timer_bar.paused_label')}` : ''}
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.actionBtn, { backgroundColor: paused ? config.color : Colors.border }]}
        onPress={(e) => {
          e.stopPropagation?.();
          paused ? resumeTimer(timer.id) : pauseTimer(timer.id);
        }}
        hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
        accessibilityLabel={paused ? t('timer_bar.continue_timer') : t('timer_bar.pause_timer')}
      >
        <Text style={[styles.actionIcon, { color: paused ? Colors.white : Colors.textSecondary }]}>
          {paused ? '▶' : 'Ⅱ'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.actionBtn, styles.saveStopBtn]}
        onPress={(e) => {
          e.stopPropagation?.();
          onSaveStop(timer);
        }}
        hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
        accessibilityLabel={t('timer_bar.stop_save_timer')}
      >
        <Text style={[styles.actionIcon, { color: Colors.white }]}>✓</Text>
      </TouchableOpacity>
    </Pressable>
  );
}

export default function PersistentTimerBar() {
  const { activeTimers } = useTimerStore();
  const pathname = usePathname();
  const saveAndStop = useSaveTimer();
  const { t } = useTranslation();

  // Hide chips whose module page is currently open
  const visibleTimers = activeTimers.filter(
    (timer) => !pathname.startsWith(TIMER_ROUTES[timer.type])
  );

  if (visibleTimers.length === 0) return null;

  return (
    <View style={styles.container} pointerEvents="box-none">
      <View style={styles.bar}>
        <Text style={styles.barTitle}>{t('timer_bar.active_timers')}</Text>
        <View style={styles.chips}>
          {visibleTimers.map(timer => (
            <TimerChip key={timer.id} timer={timer} onSaveStop={saveAndStop} />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: Platform.OS === 'web' ? 70 : 90,
    left: 0,
    right: 0,
    zIndex: 1000,
    paddingHorizontal: Spacing.md,
    pointerEvents: 'box-none',
  } as any,
  bar: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  barTitle: {
    fontSize: 11,
    color: Colors.textTertiary,
    fontWeight: '600',
    marginBottom: Spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingVertical: 6,
    paddingLeft: 8,
    paddingRight: 4,
    gap: 4,
    minWidth: 160,
  },
  chipEmoji: { fontSize: 18 },
  chipInfo: { flex: 1 },
  chipLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  chipTime: {
    fontSize: 15,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  actionBtn: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIcon: {
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 16,
  },
  saveStopBtn: {
    backgroundColor: Colors.success,
  },
});
