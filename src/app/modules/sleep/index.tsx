import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Timestamp } from 'firebase/firestore';
import Toast from 'react-native-toast-message';

import { sleepService } from '../../../services/sleepService';
import { useAuthStore } from '../../../stores/authStore';
import { useChildStore } from '../../../stores/childStore';
import {
  useTimerStore,
  getElapsedSeconds,
  isTimerPaused,
} from '../../../stores/timerStore';
import { SleepRecord, SleepLog, SleepSignalLog, ChildSleepProfile } from '../../../types/sleep';
import { formatDuration } from '../../../lib/format';
import { Colors } from '../../../theme/colors';
import { Spacing, BorderRadius, Shadow } from '../../../theme/spacing';
import { AppDatePicker } from '../../../components/ui/AppDatePicker';

import {
  getGuidelineForAge,
  calculateNextSleep,
  calcTotalSleepMinutes,
  formatWakeWindow,
  formatTime,
  getSleepTotalStatus,
} from '../../../services/sleepEngine';

const SLEEP_BLUE = '#5A88C0';
const SLEEP_DARK = '#3A5880';
const CREAM = '#FBF5EE';

// Timer hook
function useElapsed(timerId: string | undefined, pausedAt: number | undefined, totalPausedMs: number, startTime: number | undefined) {
  const { getTimer } = useTimerStore();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!timerId) { setElapsed(0); return; }
    const timer = getTimer('sleep');
    if (!timer) { setElapsed(0); return; }

    const tick = () => setElapsed(getElapsedSeconds(timer));
    tick();

    if (isTimerPaused(timer)) return; 

    const interval = setInterval(() => {
      const t = useTimerStore.getState().getTimer('sleep');
      if (t) setElapsed(getElapsedSeconds(t));
    }, 1000);
    return () => clearInterval(interval);
  }, [timerId, pausedAt, totalPausedMs, startTime]);

  return elapsed;
}

// Helper logic functions not needed since AppDatePicker handles Date objects

export default function SleepModuleScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { user } = useAuthStore();
  const { activeChild, sleeps, addSleep, updateSleep, removeSleep } = useChildStore();

  const { startTimer, stopTimer, pauseTimer, resumeTimer, getTimer } = useTimerStore();

  const [activeTab, setActiveTab] = useState<'nap' | 'night'>('nap');
  const [isSaving, setIsSaving] = useState(false);
  const [editingSleepId, setEditingSleepId] = useState<string | null>(null);
  const [manualStart, setManualStart] = useState(new Date());
  const [manualEnd, setManualEnd] = useState(new Date());

  // Data for recommendations
  const [signalLogs, setSignalLogs] = useState<SleepSignalLog[]>([]);
  const [profile, setProfile] = useState<ChildSleepProfile | null>(null);

  const loadData = useCallback(async () => {
    if (!user || !activeChild) return;
    try {
      const [todaySignals, sleepProf] = await Promise.all([
        sleepService.getSignalsToday(user.uid, activeChild.id),
        sleepService.getSleepProfile(user.uid, activeChild.id),
      ]);
      setSignalLogs(todaySignals);
      setProfile(sleepProf);
    } catch (e) {
      console.warn("Load sleep data error:", e);
    }
  }, [user, activeChild]);

  useEffect(() => { loadData(); }, [loadData]);

  // Recommendation engine
  const { recommendation, guideline, total24hMins, hasSleepToday } = useMemo(() => {
    if (!activeChild) return {};
    const ageDays = activeChild.birthDate 
      ? Math.floor((Date.now() - activeChild.birthDate.toDate().getTime()) / 86400000)
      : 0;
    
    const guide = getGuidelineForAge(ageDays);
    if (!guide) return {};

    const now = new Date();
    
    // Create SleepLog format from legacy sleeps for the engine
    const mappedLogs: SleepLog[] = sleeps.map(s => ({
      id: s.id,
      userId: user?.uid || '',
      childId: activeChild.id,
      sleepType: s.type,
      startTime: s.startTime.toDate().toISOString(),
      endTime: s.endTime ? s.endTime.toDate().toISOString() : undefined,
      durationMinutes: s.duration ? Math.round(s.duration / 60) : undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })).sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
    
    const lastSleep = mappedLogs.find(s => s.endTime); 
    const lastWakeTime = lastSleep?.endTime ? new Date(lastSleep.endTime) : new Date(now.getTime() - 120 * 60000); 
    
    const total24h = calcTotalSleepMinutes(mappedLogs, 24);
    
    const startOfToday = new Date(); startOfToday.setHours(0,0,0,0);
    const napsTodayLogs = mappedLogs.filter(s => s.sleepType === 'nap' && new Date(s.startTime).getTime() >= startOfToday.getTime());
    const hasSleepToday = mappedLogs.some(s => new Date(s.startTime).getTime() >= startOfToday.getTime());

    const rec = calculateNextSleep({
      childAgeDays: ageDays,
      lastWakeTime,
      now,
      totalSleepLast24hMinutes: total24h,
      napsToday: napsTodayLogs.length,
      lastNapDurationMinutes: napsTodayLogs[0]?.durationMinutes,
      sleepSignalsCount: signalLogs.length,
      hasRedFlags: false,
      guideline: guide,
      profile,
    });

    return { recommendation: rec, guideline: guide, total24hMins: total24h, hasSleepToday };
  }, [activeChild, sleeps, signalLogs, profile, user?.uid]);

  // Timer logic
  const timer = getTimer('sleep');
  const elapsed = useElapsed(
    timer?.id,
    timer?.pausedAt,
    timer?.totalPausedMs ?? 0,
    timer?.startTime,
  );
  const running = !!timer && !isTimerPaused(timer);
  const paused = !!timer && isTimerPaused(timer);
  const manualDuration = (() => {
    if (manualEnd.getTime() <= manualStart.getTime()) return null;
    return Math.round((manualEnd.getTime() - manualStart.getTime()) / 1000);
  })();

  const handleStart = () => {
    startTimer({
      type: 'sleep',
      label: activeTab === 'nap' ? t('sleep.timer_label_day') : t('sleep.timer_label_night'),
      startTime: Date.now(),
      metadata: { sleepType: activeTab },
    });
  };

  const handlePause = () => { if (timer) pauseTimer(timer.id); };
  const handleResume = () => { if (timer) resumeTimer(timer.id); };

  const handleStop = async () => {
    if (!user || !activeChild?.id || !timer) return;
    if (elapsed < 5) {
      Toast.show({ type: 'error', text1: t('sleep.too_short') });
      stopTimer(timer.id);
      return;
    }
    setIsSaving(true);
    const startTs = Timestamp.fromMillis(timer.startTime);
    const endTs = Timestamp.now();
    try {
      const childOwnerId = activeChild.ownerId || user.uid;
      const tType = (timer.metadata?.sleepType as 'nap' | 'night') || 'nap';
      const sleepRec: Omit<SleepRecord, 'id'> = {
        startTime: startTs,
        endTime: endTs,
        duration: elapsed,
        type: tType,
        quality: 'bun',
        createdBy: user.uid,
      };
      const id = await sleepService.addSleep(childOwnerId, activeChild.id, sleepRec);
      addSleep({ ...sleepRec, id });
      stopTimer(timer.id);
      Toast.show({
        type: 'success',
        text1: t('sleep.saved'),
        text2: `${formatDuration(elapsed)}`,
      });
    } catch {
      Toast.show({ type: 'error', text1: t('sleep.save_error') });
    } finally {
      setIsSaving(false);
    }
  };

  const saveManualEdit = async () => {
    if (!user || !activeChild?.id) return;
    const startDate = manualStart;
    const endDate = manualEnd;
    
    const duration = Math.round((endDate.getTime() - startDate.getTime()) / 1000);
    if (duration <= 0) {
      Alert.alert(t('sleep.invalid_interval_title'), t('sleep.invalid_interval_msg'));
      return;
    }
    setIsSaving(true);

    try {
      const childOwnerId = activeChild.ownerId || user.uid;
      
      if (editingSleepId) {
        const updates: Partial<SleepRecord> = {
          startTime: Timestamp.fromDate(startDate),
          endTime: Timestamp.fromDate(endDate),
          duration,
          type: activeTab,
        };
        await sleepService.updateSleep(childOwnerId, activeChild.id, editingSleepId, updates);
        updateSleep(editingSleepId, updates);
        setEditingSleepId(null);
        Toast.show({ type: 'success', text1: t('sleep.updated') });
      } else {
        const newRec: Omit<SleepRecord, 'id'> = {
          startTime: Timestamp.fromDate(startDate),
          endTime: Timestamp.fromDate(endDate),
          duration,
          type: activeTab,
          quality: 'bun',
          createdBy: user.uid,
        };
        const id = await sleepService.addSleep(childOwnerId, activeChild.id, newRec);
        addSleep({ ...newRec, id });
        Toast.show({ type: 'success', text1: t('sleep.added') });
      }
    } catch {
      Toast.show({ type: 'error', text1: t('sleep.save_error') });
    } finally {
      setIsSaving(false);
    }
  };

  const startEditSleep = (s: SleepRecord) => {
    if (!s.id) return;
    setEditingSleepId(s.id);
    setActiveTab(s.type);
    const start = s.startTime.toDate();
    const end = s.endTime ? s.endTime.toDate() : new Date(start.getTime() + (s.duration ?? 0) * 1000);
    setManualStart(start);
    setManualEnd(end);
  };

  const startAddManual = () => {
    setEditingSleepId(null);
    const now = new Date();
    const start = new Date(now.getTime() - 60*60*1000);
    setManualStart(start);
    setManualEnd(now);
  };

  const cancelEdit = () => {
    setEditingSleepId(null);
    setActiveTab('nap');
    const now = new Date();
    setManualStart(now);
    setManualEnd(now);
  };

  const handleDeleteSleep = (s: SleepRecord) => {
    const doDelete = async () => {
      if (!user || !activeChild?.id || !s.id) return;
      try {
        const childOwnerId = activeChild.ownerId || user.uid;
        await sleepService.deleteSleep(childOwnerId, activeChild.id, s.id);
        removeSleep(s.id);
        Toast.show({ type: 'success', text1: t('sleep.deleted') });
      } catch {
        Toast.show({ type: 'error', text1: t('sleep.delete_error') });
      }
    };
    if (Platform.OS === 'web') {
      if (window.confirm(t('sleep.delete_confirm_web'))) doDelete();
    } else {
      Alert.alert(t('sleep.delete_title'), t('sleep.delete_msg'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.delete'), style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  const renderRecommendationCard = () => {
    if (!recommendation) return null;
    // No sleep logged today → suggestion is based on stale data from a previous day
    if (!hasSleepToday) return null;
    // Ages 3+ years (napsMin === 0): daytime naps are no longer mandatory
    if ((guideline?.napsMin ?? 1) === 0) return null;
    let badgeColor = SLEEP_BLUE;
    if (recommendation.status === 'too_early') badgeColor = '#9A8070';
    if (recommendation.status === 'recommended_now') badgeColor = '#5BAA90';
    if (recommendation.status === 'possibly_overtired') badgeColor = '#D4786A';

    return (
      <View style={[styles.card, { borderColor: badgeColor, borderWidth: 1 }]}>
        <View style={styles.recHeader}>
          <Text style={styles.recTitle}>{t('sleep.next_sleep_suggestion')}</Text>
          <View style={[styles.statusBadge, { backgroundColor: badgeColor + '20' }]}>
            <Text style={[styles.statusBadgeText, { color: badgeColor }]}>
              {recommendation.status === 'recommended_now' ? t('sleep.status_now') :
               recommendation.status === 'too_early' ? t('sleep.status_early') :
               recommendation.status === 'possibly_overtired' ? t('sleep.status_overtired') : t('sleep.status_soon')}
            </Text>
          </View>
        </View>
        
        <View style={styles.recBody}>
          <Text style={styles.recMainText}>{recommendation.title}</Text>
          <Text style={styles.recSubText}>{recommendation.message}</Text>
          
          {recommendation.recommendedStart && recommendation.recommendedEnd && (
            <View style={styles.targetBox}>
              <Text style={styles.windowLabel}>{t('sleep.recommended_window')}</Text>
              <Text style={styles.windowValue}>
                {formatTime(recommendation.recommendedStart)} – {formatTime(recommendation.recommendedEnd)}
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('sleep.title')}</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={{ padding: Spacing.xl, paddingBottom: 0 }}>
          {renderRecommendationCard()}
        </View>

        {/* Tab Selector */}
        <View style={styles.tabBar}>
          {(['nap', 'night'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab === 'nap' ? t('sleep.tab_day') : t('sleep.tab_night')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {editingSleepId && (
          <View style={styles.editBanner}>
            <Text style={styles.editBannerText}>{t('sleep.edit_banner')}</Text>
            <TouchableOpacity onPress={cancelEdit}>
              <Text style={styles.editCancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.trackerCard}>
          <View style={styles.timeEditCard}>
            <View style={styles.timeEditRow}>
              <View style={styles.timeInputWrap}>
                <Text style={styles.timeInputLabel}>{t('sleep.bed_date')}</Text>
                <AppDatePicker value={manualStart} onChange={setManualStart} mode="date" style={{ borderWidth: 1, backgroundColor: Colors.white }} />
              </View>
              <View style={styles.timeInputWrap}>
                <Text style={styles.timeInputLabel}>{t('sleep.bed_time')}</Text>
                <AppDatePicker value={manualStart} onChange={setManualStart} mode="time" style={{ borderWidth: 1, backgroundColor: Colors.white }} />
              </View>
            </View>
            <View style={styles.timeEditRow}>
              <View style={styles.timeInputWrap}>
                <Text style={styles.timeInputLabel}>{t('sleep.wake_date')}</Text>
                <AppDatePicker value={manualEnd} onChange={setManualEnd} mode="date" style={{ borderWidth: 1, backgroundColor: Colors.white }} />
              </View>
              <View style={styles.timeInputWrap}>
                <Text style={styles.timeInputLabel}>{t('sleep.wake_time')}</Text>
                <AppDatePicker value={manualEnd} onChange={setManualEnd} mode="time" style={{ borderWidth: 1, backgroundColor: Colors.white }} />
              </View>
            </View>
            <Text style={styles.timeHint}>
              {t('sleep.calculated_duration', { duration: manualDuration !== null ? formatDuration(manualDuration) : t('sleep.invalid_time') })}
            </Text>
          </View>

          {/* Timer Display */}
          {!editingSleepId && (
            <View style={[styles.timerDisplay, editingSleepId && styles.timerDisplayCompact]}>
              {timer && (
                <Text style={styles.timerStartedAt}>
                  {t('sleep.started_at', { time: new Date(timer.startTime).toLocaleTimeString(i18n.language === 'en' ? 'en-US' : 'ro-RO', { hour: '2-digit', minute: '2-digit' }) })}
                </Text>
              )}
              <Text style={[styles.timerText, paused && { color: Colors.textTertiary }]}>
                {formatDuration(elapsed)}
              </Text>
              {paused && <Text style={styles.pausedLabel}>{t('sleep.paused')}</Text>}
            </View>
          )}

          {/* Controls */}
          <View style={styles.timerControls}>
            {editingSleepId ? (
              <TouchableOpacity
                style={[styles.timerButton, { backgroundColor: SLEEP_BLUE }, isSaving && { opacity: 0.5 }]}
                onPress={saveManualEdit}
                disabled={isSaving}
              >
                <Text style={styles.timerButtonText}>{t('sleep.save_changes')}</Text>
              </TouchableOpacity>
            ) : !timer ? (
              <>
                <TouchableOpacity
                  style={[styles.timerButton, { backgroundColor: SLEEP_BLUE }]}
                  onPress={handleStart}
                >
                  <Text style={styles.timerButtonText}>{t('sleep.start_timer')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.timerButton, { backgroundColor: 'transparent', borderWidth: 1, borderColor: SLEEP_BLUE }]}
                  onPress={saveManualEdit}
                >
                  <Text style={[styles.timerButtonText, { color: SLEEP_BLUE }]}>{t('sleep.add_manual')}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.timerButton, { backgroundColor: paused ? SLEEP_BLUE : Colors.warning }]}
                  onPress={paused ? handleResume : handlePause}
                >
                  <Text style={styles.timerButtonText}>{paused ? t('sleep.continue_timer') : t('sleep.pause_timer')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.timerButton, { backgroundColor: Colors.success }, isSaving && { opacity: 0.5 }]}
                  onPress={handleStop}
                  disabled={isSaving}
                >
                  <Text style={styles.timerButtonText}>{t('sleep.stop_save')}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {/* History */}
        <View style={styles.historySection}>
          <Text style={styles.historySectionTitle}>{t('sleep.history')}</Text>
          {sleeps.length === 0 ? (
            <Text style={styles.emptyText}>{t('sleep.empty_history')}</Text>
          ) : (
            sleeps.slice(0, 15).map((s) => (
              <View key={s.id} style={styles.feedItem}>
                <View style={[styles.feedIcon, { backgroundColor: SLEEP_BLUE + '20' }]}>
                  <Text style={styles.feedIconText}>
                    {s.type === 'night' ? '🌙' : '☀️'}
                  </Text>
                </View>
                <View style={styles.feedInfo}>
                  <Text style={styles.feedType}>
                    {s.type === 'night' ? t('sleep.night_sleep') : t('sleep.day_sleep')}
                  </Text>
                  {s.duration && <Text style={styles.feedDetail}>{formatDuration(s.duration)}</Text>}
                </View>
                <View style={styles.feedTimeCol}>
                  <Text style={styles.feedTime}>
                    {s.startTime.toDate().toLocaleTimeString(i18n.language === 'en' ? 'en-US' : 'ro-RO', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                  <Text style={styles.feedDate}>
                    {s.startTime.toDate().toLocaleDateString(i18n.language === 'en' ? 'en-US' : 'ro-RO', { day: '2-digit', month: 'short' })}
                  </Text>
                </View>
                <TouchableOpacity style={styles.editBtn} onPress={() => startEditSleep(s)}>
                  <Text style={styles.editBtnText}>{t('sleep.edit')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeleteSleep(s)}>
                  <Text style={{ fontSize: 14 }}>🗑</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: CREAM },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backButton: { padding: Spacing.xs },
  backArrow: { fontSize: 22, color: SLEEP_BLUE },
  headerTitle: { fontSize: 18, fontFamily: 'Fraunces', color: '#1C130D' },
  headerRight: { width: 32 },

  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, ...Shadow.sm, marginBottom: 16 },
  recHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  recTitle: { fontFamily: 'Fraunces', fontSize: 16, color: '#1C130D' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusBadgeText: { fontFamily: 'Geist-SemiBold', fontSize: 11, textTransform: 'uppercase' },
  recBody: { gap: 8 },
  recMainText: { fontFamily: 'Geist-SemiBold', fontSize: 15, color: '#1C130D' },
  recSubText: { fontFamily: 'Geist', fontSize: 13, color: '#5A4030', lineHeight: 18 },
  targetBox: { backgroundColor: '#EDFAF5', padding: 10, borderRadius: 12, flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  windowLabel: { fontFamily: 'Geist', fontSize: 13, color: '#5A4030' },
  windowValue: { fontFamily: 'Geist-SemiBold', fontSize: 13, color: '#1C130D' },

  tabBar: { flexDirection: 'row', paddingHorizontal: Spacing.xl, gap: Spacing.sm, marginTop: Spacing.md, marginBottom: Spacing.lg },
  tab: { flex: 1, paddingVertical: Spacing.sm, borderRadius: BorderRadius.lg, alignItems: 'center', backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border },
  tabActive: { backgroundColor: SLEEP_BLUE, borderColor: SLEEP_BLUE },
  tabText: { fontSize: 12, fontFamily: 'Geist', color: Colors.textSecondary },
  tabTextActive: { color: Colors.white, fontFamily: 'Geist-SemiBold' },

  editBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: Spacing.xl, marginBottom: Spacing.lg, backgroundColor: SLEEP_BLUE + '12', borderRadius: BorderRadius.lg, padding: Spacing.md },
  editBannerText: { fontSize: 13, fontFamily: 'Geist-SemiBold', color: Colors.textPrimary },
  editCancelText: { fontSize: 13, fontFamily: 'Geist-SemiBold', color: Colors.error },

  trackerCard: { marginHorizontal: Spacing.xl, backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.xl, ...Shadow.sm, marginBottom: Spacing.xl },
  timeEditCard: { backgroundColor: Colors.backgroundSoft, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.lg, overflow: 'hidden' },
  timeEditRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginBottom: Spacing.md },
  timeInputWrap: { flex: 1, minWidth: 128 },
  timeInputLabel: { fontSize: 12, fontFamily: 'Geist-SemiBold', color: Colors.textSecondary, marginBottom: Spacing.xs },
  timeInput: { height: 46, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.white, paddingHorizontal: Spacing.md, fontSize: 18, fontFamily: 'Geist-SemiBold', color: Colors.textPrimary },
  dateInput: { fontSize: 15 },
  timeHint: { fontSize: 12, fontFamily: 'Geist-SemiBold', color: SLEEP_BLUE },

  timerDisplay: { alignItems: 'center', paddingVertical: Spacing.md },
  timerDisplayCompact: { paddingVertical: Spacing.sm },
  timerStartedAt: { fontSize: 12, fontFamily: 'Geist', color: Colors.textTertiary, marginBottom: Spacing.sm },
  timerText: { fontSize: 56, fontFamily: 'Geist-Bold', color: SLEEP_BLUE },
  pausedLabel: { fontSize: 13, fontFamily: 'Geist', color: Colors.textTertiary, marginTop: Spacing.xs },

  timerControls: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.md },
  timerButton: { flex: 1, height: 52, borderRadius: BorderRadius.xl, alignItems: 'center', justifyContent: 'center' },
  timerButtonText: { fontSize: 15, fontFamily: 'Geist-SemiBold', color: Colors.white },

  historySection: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing['2xl'] },
  historySectionTitle: { fontSize: 16, fontFamily: 'Geist-SemiBold', color: Colors.textPrimary, marginBottom: Spacing.md },
  feedItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: Spacing.md },
  feedIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  feedIconText: { fontSize: 20 },
  feedInfo: { flex: 1 },
  feedType: { fontSize: 14, fontFamily: 'Geist-SemiBold', color: Colors.textPrimary },
  feedDetail: { fontSize: 12, fontFamily: 'Geist', color: Colors.textSecondary },
  feedTimeCol: { alignItems: 'flex-end' },
  feedTime: { fontSize: 13, fontFamily: 'Geist-SemiBold', color: Colors.textSecondary },
  feedDate: { fontSize: 11, fontFamily: 'Geist', color: Colors.textTertiary },
  emptyText: { fontSize: 14, fontFamily: 'Geist', color: Colors.textTertiary, textAlign: 'center', paddingVertical: Spacing.xl },
  editBtn: { height: 32, borderRadius: 8, paddingHorizontal: Spacing.sm, backgroundColor: SLEEP_BLUE + '14', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  editBtnText: { fontSize: 12, fontFamily: 'Geist-SemiBold', color: SLEEP_BLUE },
  deleteBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: Colors.error + '12', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
});
