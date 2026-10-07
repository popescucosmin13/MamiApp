import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Timestamp } from 'firebase/firestore';
import Toast from 'react-native-toast-message';
import { useTranslation } from 'react-i18next';
import { feedingService } from '../../../services/feedingService';
import { useAuthStore } from '../../../stores/authStore';
import { useChildStore } from '../../../stores/childStore';
import { useFoodStore } from '../../../stores/foodStore';
import { useLoadFoodData } from '../../../hooks/useFood';
import {
  useTimerStore,
  getElapsedSeconds,
  isTimerPaused,
} from '../../../stores/timerStore';
import { FeedRecord, FeedSide } from '../../../types/feeding';
import { formatDuration, formatRelativeTime } from '../../../lib/format';
import { Colors } from '../../../theme/colors';
import { Spacing, BorderRadius, Shadow } from '../../../theme/spacing';
import { AppDatePicker } from '../../../components/ui/AppDatePicker';

function useElapsed(timerId: string | undefined, pausedAt: number | undefined, totalPausedMs: number, startTime: number | undefined) {
  const { getTimer } = useTimerStore();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!timerId) { setElapsed(0); return; }
    const timer = getTimer('feeding');
    if (!timer) { setElapsed(0); return; }

    const tick = () => setElapsed(getElapsedSeconds(timer));
    tick();

    if (isTimerPaused(timer)) return; // don't tick when paused

    const interval = setInterval(() => {
      const t = useTimerStore.getState().getTimer('feeding');
      if (t) setElapsed(getElapsedSeconds(t));
    }, 1000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerId, pausedAt, totalPausedMs, startTime]);

  return elapsed;
}

// Date helpers not needed

export default function FeedingScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { user } = useAuthStore();
  const { activeChild, feeds, addFeed, removeFeed } = useChildStore();
  const { meals } = useFoodStore();
  useLoadFoodData();

  const { startTimer, stopTimer, pauseTimer, resumeTimer, getTimer } = useTimerStore();

  const [activeTab, setActiveTab] = useState<'breastfeeding' | 'bottle' | 'solid'>('breastfeeding');
  const [activeSide, setActiveSide] = useState<FeedSide>('left');
  const [bottleAmount, setBottleAmount] = useState(120);
  const [isSaving, setIsSaving] = useState(false);
  const [editingFeedId, setEditingFeedId] = useState<string | null>(null);
  const [editingDate, setEditingDate] = useState(new Date());
  const [manualStart, setManualStart] = useState(new Date());
  const [manualEnd, setManualEnd] = useState(new Date());

  const timer = getTimer('feeding');
  const elapsed = useElapsed(
    timer?.id,
    timer?.pausedAt,
    timer?.totalPausedMs ?? 0,
    timer?.startTime,
  );
  const running = !!timer && !isTimerPaused(timer);
  const paused = !!timer && isTimerPaused(timer);
  const manualDuration = (() => {
    const start = new Date(editingDate);
    start.setHours(manualStart.getHours(), manualStart.getMinutes(), 0, 0);
    const end = new Date(editingDate);
    end.setHours(manualEnd.getHours(), manualEnd.getMinutes(), 0, 0);
    const normalizedEnd = end.getTime() < start.getTime()
      ? new Date(end.getTime() + 24 * 60 * 60 * 1000)
      : end;
    const duration = Math.round((normalizedEnd.getTime() - start.getTime()) / 1000);
    return duration > 0 ? duration : null;
  })();

  const todayFeeds = feeds.filter((f) => {
    const t = f.timestamp as Timestamp;
    if (!t) return false;
    const d = t.toDate();
    const today = new Date();
    return d.getDate() === today.getDate() && d.getMonth() === today.getMonth();
  });

  const handleStart = () => {
    const sideIcon = activeSide === 'left' ? '⬅️' : '➡️';
    startTimer({
      type: 'feeding',
      label: t('feeding.timer_label', { side: sideIcon }),
      startTime: Date.now(),
      metadata: { side: activeSide },
    });
  };

  const handlePause = () => { if (timer) pauseTimer(timer.id); };
  const handleResume = () => { if (timer) resumeTimer(timer.id); };

  /** Stop & auto-save the breastfeeding session. */
  const handleStop = async () => {
    if (!user || !activeChild?.id || !timer) return;
    if (elapsed < 5) {
      Toast.show({ type: 'error', text1: t('feeding.session_too_short') });
      stopTimer(timer.id);
      return;
    }
    setIsSaving(true);
    const startTs = Timestamp.fromMillis(timer.startTime);
    const endTs = Timestamp.now();
    try {
      const childOwnerId = activeChild.ownerId || user.uid;
      const feed: Omit<FeedRecord, 'id'> = {
        timestamp: startTs,        // when feeding started
        type: 'breastfeeding',
        side: activeSide,
        duration: elapsed,
        createdBy: user.uid,
      };
      const id = await feedingService.addFeed(childOwnerId, activeChild.id, feed);
      addFeed({ ...feed, id });
      stopTimer(timer.id);
      Toast.show({
        type: 'success',
        text1: t('feeding.saved_breastfeeding'),
        text2: `${formatDuration(elapsed)} · ${startTs.toDate().toLocaleTimeString(i18n.language === 'en' ? 'en-US' : 'ro-RO', { hour: '2-digit', minute: '2-digit' })}`,
      });
    } catch {
      Toast.show({ type: 'error', text1: t('feeding.save_error') });
    } finally {
      setIsSaving(false);
    }
  };

  const saveBottleFeed = async () => {
    if (!user || !activeChild?.id) return;
    setIsSaving(true);
    try {
      const childOwnerId = activeChild.ownerId || user.uid;
      if (editingFeedId) {
        const updates: Partial<FeedRecord> = { type: activeTab };
        if (activeTab === 'breastfeeding') updates.side = activeSide;
        if (activeTab === 'bottle') updates.amount = bottleAmount;
        await feedingService.updateFeed(childOwnerId, activeChild.id, editingFeedId, updates);
        useChildStore.getState().updateFeed(editingFeedId, updates);
        setEditingFeedId(null);
        Toast.show({ type: 'success', text1: t('feeding.meal_updated') });
        return;
      }
      const feed: Omit<FeedRecord, 'id'> = {
        timestamp: Timestamp.now(),
        type: 'bottle',
        amount: bottleAmount,
        createdBy: user.uid,
      };
      const id = await feedingService.addFeed(childOwnerId, activeChild.id, feed);
      addFeed({ ...feed, id });
      Toast.show({ type: 'success', text1: t('feeding.bottle_saved'), text2: `${bottleAmount} ml` });
    } catch {
      Toast.show({ type: 'error', text1: t('feeding.save_error') });
    } finally {
      setIsSaving(false);
    }
  };

  const saveBreastfeedingEdit = async () => {
    if (!user || !activeChild?.id || !editingFeedId) return;
    const startDate = new Date(editingDate);
    startDate.setHours(manualStart.getHours(), manualStart.getMinutes(), 0, 0);
    const endDate = new Date(editingDate);
    endDate.setHours(manualEnd.getHours(), manualEnd.getMinutes(), 0, 0);
    const normalizedEndDate = endDate.getTime() < startDate.getTime()
      ? new Date(endDate.getTime() + 24 * 60 * 60 * 1000)
      : endDate;
    const duration = Math.round((normalizedEndDate.getTime() - startDate.getTime()) / 1000);
    if (duration <= 0) {
      Alert.alert(t('feeding.invalid_interval_title'), t('feeding.invalid_interval_msg'));
      return;
    }
    setIsSaving(true);
    const updates: Partial<FeedRecord> = {
      timestamp: Timestamp.fromDate(startDate),
      type: 'breastfeeding',
      side: activeSide,
      duration,
    };
    try {
      const childOwnerId = activeChild.ownerId || user.uid;
      await feedingService.updateFeed(childOwnerId, activeChild.id, editingFeedId, updates);
      useChildStore.getState().updateFeed(editingFeedId, updates);
      setEditingFeedId(null);
      Toast.show({ type: 'success', text1: t('feeding.breastfeeding_updated') });
    } catch {
      Toast.show({ type: 'error', text1: t('feeding.update_error') });
    } finally {
      setIsSaving(false);
    }
  };

  const startEditFeed = (feed: FeedRecord) => {
    if (!feed.id) return;
    setEditingFeedId(feed.id);
    setActiveTab(feed.type);
    if (feed.type === 'breastfeeding') {
      const start = (feed.timestamp as Timestamp).toDate();
      const end = new Date(start.getTime() + (feed.duration ?? 0) * 1000);
      setEditingDate(start);
      setManualStart(start);
      setManualEnd(end);
      setActiveSide((feed.side === 'both' ? 'left' : feed.side) ?? 'left');
    }
    if (feed.type === 'bottle') setBottleAmount(feed.amount ?? 120);
  };

  const cancelEdit = () => {
    setEditingFeedId(null);
    setActiveTab('breastfeeding');
    setActiveSide('left');
    setBottleAmount(120);
    const now = new Date();
    setEditingDate(now);
    setManualStart(now);
    setManualEnd(now);
  };

  const handleDeleteFeed = (feed: FeedRecord) => {
    const doDelete = async () => {
      if (!user || !activeChild?.id) return;
      if (!feed.id) return;
      try {
        const childOwnerId = activeChild.ownerId || user.uid;
        await feedingService.deleteFeed(childOwnerId, activeChild.id, feed.id);
        removeFeed(feed.id);
        Toast.show({ type: 'success', text1: t('feeding.deleted') });
      } catch {
        Toast.show({ type: 'error', text1: t('feeding.delete_error') });
      }
    };
    if (Platform.OS === 'web') {
      if (window.confirm(t('feeding.delete_confirm_web'))) doDelete();
    } else {
      Alert.alert(t('feeding.delete_title'), t('feeding.delete_msg'), [
        { text: t('feeding.cancel'), style: 'cancel' },
        { text: t('feeding.delete_title'), style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('feeding.title')} 🍼</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Today Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>{t('feeding.today')}</Text>
          <View style={styles.summaryRow}>
            <View style={styles.summaryStat}>
              <Text style={styles.summaryValue}>{todayFeeds.length}</Text>
              <Text style={styles.summaryLabel}>{t('feeding.meals')}</Text>
            </View>
            <View style={styles.summaryStat}>
              <Text style={styles.summaryValue}>
                {todayFeeds.filter(f => f.type === 'breastfeeding').length}
              </Text>
              <Text style={styles.summaryLabel}>{t('feeding.breastfeedings')}</Text>
            </View>
            <View style={styles.summaryStat}>
              <Text style={styles.summaryValue}>
                {todayFeeds.filter(f => f.type === 'bottle').reduce((s, f) => s + (f.amount || 0), 0)} ml
              </Text>
              <Text style={styles.summaryLabel}>{t('feeding.bottle')}</Text>
            </View>
          </View>
        </View>

        {/* Tab Selector */}
        <View style={styles.tabBar}>
          {(['breastfeeding', 'bottle', 'solid'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab === 'breastfeeding' ? t('feeding.tab_breastfeeding_label') : tab === 'bottle' ? t('feeding.tab_bottle_label') : t('feeding.tab_solid_label')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {editingFeedId && (
          <View style={styles.editBanner}>
            <Text style={styles.editBannerText}>{t('feeding.edit_banner')}</Text>
            <TouchableOpacity onPress={cancelEdit}>
              <Text style={styles.editCancelText}>{t('feeding.cancel')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Breastfeeding */}
        {activeTab === 'breastfeeding' && (
          <View style={styles.trackerCard}>
            {/* Side Selector — visible only when timer is not running */}
            {!timer && (
              <View style={styles.sideSelector}>
                {(['left', 'right'] as FeedSide[]).map((side) => (
                  <TouchableOpacity
                    key={side}
                    style={[styles.sideButton, activeSide === side && styles.sideButtonActive]}
                    onPress={() => setActiveSide(side)}
                  >
                    <Text style={styles.sideEmoji}>
                      {side === 'left' ? '⬅️' : '➡️'}
                    </Text>
                    <Text style={[styles.sideLabel, activeSide === side && styles.sideLabelActive]}>
                      {side === 'left' ? t('feeding.side_left') : t('feeding.side_right')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {editingFeedId && (
              <View style={styles.timeEditCard}>
                <View style={styles.timeEditRow}>
                  <View style={styles.timeInputWrap}>
                    <Text style={styles.timeInputLabel}>{t('feeding.start_label')}</Text>
                    <AppDatePicker value={manualStart} onChange={setManualStart} mode="time" style={{ borderWidth: 1, backgroundColor: Colors.white }} />
                  </View>
                  <View style={styles.timeInputWrap}>
                    <Text style={styles.timeInputLabel}>{t('feeding.end_label')}</Text>
                    <AppDatePicker value={manualEnd} onChange={setManualEnd} mode="time" style={{ borderWidth: 1, backgroundColor: Colors.white }} />
                  </View>
                </View>
                <Text style={styles.timeHint}>
                  {t('feeding.calculated_duration', { duration: manualDuration !== null ? formatDuration(manualDuration) : t('feeding.invalid_time_short') })}
                </Text>
              </View>
            )}

            {/* Timer Display */}
            <View style={[styles.timerDisplay, editingFeedId && styles.timerDisplayCompact]}>
              {timer && (
                <Text style={styles.timerStartedAt}>
                  {t('feeding.started_at', {
                    time: new Date(timer.startTime).toLocaleTimeString(i18n.language === 'en' ? 'en-US' : 'ro-RO', { hour: '2-digit', minute: '2-digit' }),
                    date: new Date(timer.startTime).toLocaleDateString(i18n.language === 'en' ? 'en-US' : 'ro-RO', { day: '2-digit', month: 'short' }),
                  })}
                </Text>
              )}
              <Text style={[styles.timerText, paused && { color: Colors.textTertiary }]}>
                {editingFeedId && manualDuration !== null ? formatDuration(manualDuration) : formatDuration(elapsed)}
              </Text>
              {paused && <Text style={styles.pausedLabel}>{t('feeding.paused')}</Text>}
            </View>

            {/* Controls */}
            <View style={styles.timerControls}>
              {editingFeedId ? (
                <TouchableOpacity
                  style={[styles.timerButton, { backgroundColor: Colors.feeding }, isSaving && { opacity: 0.5 }]}
                  onPress={saveBreastfeedingEdit}
                  disabled={isSaving}
                >
                  <Text style={styles.timerButtonText}>{t('feeding.save_changes')}</Text>
                </TouchableOpacity>
              ) : !timer ? (
                /* START */
                <TouchableOpacity
                  style={[styles.timerButton, { backgroundColor: Colors.feeding }]}
                  onPress={handleStart}
                >
                  <Text style={styles.timerButtonText}>{t('feeding.start')}</Text>
                </TouchableOpacity>
              ) : (
                <>
                  {/* PAUSE / RESUME */}
                  <TouchableOpacity
                    style={[styles.timerButton, { backgroundColor: paused ? Colors.feeding : Colors.warning }]}
                    onPress={paused ? handleResume : handlePause}
                  >
                    <Text style={styles.timerButtonText}>{paused ? t('feeding.continue') : t('feeding.pause')}</Text>
                  </TouchableOpacity>

                  {/* STOP & SAVE */}
                  <TouchableOpacity
                    style={[styles.timerButton, { backgroundColor: Colors.success }, isSaving && { opacity: 0.5 }]}
                    onPress={handleStop}
                    disabled={isSaving}
                  >
                    <Text style={styles.timerButtonText}>{t('feeding.stop_save')}</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        )}

        {/* Bottle */}
        {activeTab === 'bottle' && (
          <View style={styles.trackerCard}>
            <Text style={styles.amountLabel}>{t('feeding.amount')}</Text>
            <View style={styles.amountRow}>
              {[60, 90, 120, 150, 180, 210, 240].map((ml) => (
                <TouchableOpacity
                  key={ml}
                  style={[styles.amountChip, bottleAmount === ml && styles.amountChipActive]}
                  onPress={() => setBottleAmount(ml)}
                >
                  <Text style={[styles.amountChipText, bottleAmount === ml && styles.amountChipTextActive]}>
                    {ml}ml
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={[styles.timerButton, { backgroundColor: Colors.feeding, marginTop: Spacing.xl }, isSaving && { opacity: 0.5 }]}
              onPress={saveBottleFeed}
              disabled={isSaving}
            >
              <Text style={styles.timerButtonText}>
                {editingFeedId ? t('feeding.save_changes') : t('feeding.save_amount', { amount: bottleAmount })}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Solid */}
        {activeTab === 'solid' && (
          <View style={styles.trackerCard}>
            <TouchableOpacity
              style={[styles.timerButton, { backgroundColor: Colors.feeding }]}
              onPress={() => router.push('/modules/food' as any)}
            >
              <Text style={styles.timerButtonText}>{t('feeding.add_food')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Feed History */}
        <View style={styles.historySection}>
          <Text style={styles.historySectionTitle}>{t('feeding.history')}</Text>
          {feeds.length === 0 && meals.length === 0 ? (
            <Text style={styles.emptyText}>{t('feeding.no_meals')}</Text>
          ) : (
            <>
            {feeds.slice(0, 15).map((f) => (
              <View key={f.id} style={styles.feedItem}>
                <View style={[styles.feedIcon, { backgroundColor: Colors.feeding + '20' }]}>
                  <Text style={styles.feedIconText}>
                    {f.type === 'breastfeeding' ? '🤱' : f.type === 'bottle' ? '🍼' : '🥄'}
                  </Text>
                </View>
                <View style={styles.feedInfo}>
                  <Text style={styles.feedType}>
                    {f.type === 'breastfeeding'
                      ? t('feeding.feed_breastfeeding', { side: f.side === 'right' ? t('feeding.side_right_lower') : t('feeding.side_left_lower') })
                      : f.type === 'bottle'
                      ? t('feeding.feed_bottle', { amount: f.amount })
                      : t('feeding.feed_solid')}
                  </Text>
                  {f.duration && <Text style={styles.feedDetail}>{formatDuration(f.duration)}</Text>}
                </View>
                <View style={styles.feedTimeCol}>
                  <Text style={styles.feedTime}>
                    {(f.timestamp as Timestamp).toDate().toLocaleTimeString(i18n.language === 'en' ? 'en-US' : 'ro-RO', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                  <Text style={styles.feedDate}>
                    {(f.timestamp as Timestamp).toDate().toLocaleDateString(i18n.language === 'en' ? 'en-US' : 'ro-RO', { day: '2-digit', month: 'short' })}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.editBtn}
                  onPress={() => startEditFeed(f)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 4 }}
                >
                  <Text style={styles.editBtnText}>{t('feeding.edit')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => handleDeleteFeed(f)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={{ fontSize: 14 }}>🗑</Text>
                </TouchableOpacity>
              </View>
            ))}
            {meals.slice(0, 10).map((meal) => {
              const d = meal.date as any;
              const mealDate = d?.toDate ? d.toDate() : new Date(typeof d === 'string' ? d : Date.now());
              return (
                <View key={`solid-${meal.id}`} style={styles.feedItem}>
                  <View style={[styles.feedIcon, { backgroundColor: Colors.food + '20' }]}>
                    <Text style={styles.feedIconText}>🥄</Text>
                  </View>
                  <View style={styles.feedInfo}>
                    <Text style={styles.feedType}>{t('feeding.meal_solid', { foods: meal.foods.map((food) => food.name).join(', ') })}</Text>
                    <Text style={styles.feedDetail}>
                      {meal.mealType === 'breakfast' ? t('feeding.meal_breakfast') : meal.mealType === 'lunch' ? t('feeding.meal_lunch') : meal.mealType === 'dinner' ? t('feeding.meal_dinner') : t('feeding.meal_snack')}
                    </Text>
                  </View>
                  <View style={styles.feedTimeCol}>
                    <Text style={styles.feedTime}>{mealDate.toLocaleTimeString(i18n.language === 'en' ? 'en-US' : 'ro-RO', { hour: '2-digit', minute: '2-digit' })}</Text>
                    <Text style={styles.feedDate}>{mealDate.toLocaleDateString(i18n.language === 'en' ? 'en-US' : 'ro-RO', { day: '2-digit', month: 'short' })}</Text>
                  </View>
                </View>
              );
            })}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: { padding: Spacing.xs },
  backArrow: { fontSize: 22, color: Colors.textPrimary },
  headerTitle: { fontSize: 18, fontFamily: 'Fraunces', color: Colors.textPrimary },
  headerRight: { width: 32 },
  summaryCard: {
    margin: Spacing.xl,
    backgroundColor: Colors.child.primaryLight,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
  },
  summaryTitle: { fontSize: 13, fontFamily: 'Geist-SemiBold', color: Colors.textSecondary, marginBottom: Spacing.md },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-around' },
  summaryStat: { alignItems: 'center' },
  summaryValue: { fontSize: 24, fontFamily: 'Geist-Bold', color: Colors.child.primaryDark },
  summaryLabel: { fontSize: 12, fontFamily: 'Geist', color: Colors.textSecondary },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tabActive: { backgroundColor: Colors.feeding, borderColor: Colors.feeding },
  tabText: { fontSize: 12, fontFamily: 'Geist', color: Colors.textSecondary },
  tabTextActive: { color: Colors.white, fontFamily: 'Geist-SemiBold' },
  editBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
    backgroundColor: Colors.feeding + '12',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
  },
  editBannerText: { fontSize: 13, fontFamily: 'Geist-SemiBold', color: Colors.textPrimary },
  editCancelText: { fontSize: 13, fontFamily: 'Geist-SemiBold', color: Colors.error },
  trackerCard: {
    marginHorizontal: Spacing.xl,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    ...Shadow.sm,
    marginBottom: Spacing.xl,
  },
  sideSelector: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.xl },
  sideButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    backgroundColor: Colors.backgroundSoft,
    gap: Spacing.xs,
  },
  sideButtonActive: { backgroundColor: Colors.feeding + '25', borderWidth: 1.5, borderColor: Colors.feeding },
  sideEmoji: { fontSize: 20 },
  sideLabel: { fontSize: 12, fontFamily: 'Geist', color: Colors.textSecondary },
  sideLabelActive: { fontFamily: 'Geist-SemiBold', color: Colors.child.primaryDark },
  timeEditCard: {
    backgroundColor: Colors.backgroundSoft,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  timeEditRow: { flexDirection: 'row', gap: Spacing.md },
  timeInputWrap: { flex: 1 },
  timeInputLabel: {
    fontSize: 12,
    fontFamily: 'Geist-SemiBold',
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  timeInput: {
    height: 46,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.md,
    fontSize: 18,
    fontFamily: 'Geist-SemiBold',
    color: Colors.textPrimary,
  },
  timeHint: {
    marginTop: Spacing.sm,
    fontSize: 12,
    fontFamily: 'Geist-SemiBold',
    color: Colors.feeding,
  },
  timerDisplay: { alignItems: 'center', paddingVertical: Spacing['2xl'] },
  timerDisplayCompact: { paddingVertical: Spacing.md },
  timerStartedAt: { fontSize: 12, fontFamily: 'Geist', color: Colors.textTertiary, marginBottom: Spacing.sm },
  timerText: { fontSize: 56, fontFamily: 'Geist-Bold', color: Colors.feeding },
  pausedLabel: { fontSize: 13, fontFamily: 'Geist', color: Colors.textTertiary, marginTop: Spacing.xs },
  timerControls: { flexDirection: 'row', gap: Spacing.md },
  timerButton: {
    flex: 1,
    height: 52,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerButtonText: { fontSize: 15, fontFamily: 'Geist-SemiBold', color: Colors.white },
  amountLabel: { fontSize: 14, fontFamily: 'Geist-SemiBold', color: Colors.textPrimary, marginBottom: Spacing.md },
  amountRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  amountChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.backgroundSoft,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  amountChipActive: { backgroundColor: Colors.feeding, borderColor: Colors.feeding },
  amountChipText: { fontSize: 13, fontFamily: 'Geist', color: Colors.textSecondary },
  amountChipTextActive: { color: Colors.white, fontFamily: 'Geist-SemiBold' },
  historySection: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing['2xl'] },
  historySectionTitle: {
    fontSize: 16,
    fontFamily: 'Geist-SemiBold',
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  feedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.md,
  },
  feedIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  feedIconText: { fontSize: 20 },
  feedInfo: { flex: 1 },
  feedType: { fontSize: 14, fontFamily: 'Geist-SemiBold', color: Colors.textPrimary },
  feedDetail: { fontSize: 12, fontFamily: 'Geist', color: Colors.textSecondary },
  feedTimeCol: { alignItems: 'flex-end' },
  feedTime: { fontSize: 13, fontFamily: 'Geist-SemiBold', color: Colors.textSecondary },
  feedDate: { fontSize: 11, fontFamily: 'Geist', color: Colors.textTertiary },
  emptyText: { fontSize: 14, fontFamily: 'Geist', color: Colors.textTertiary, textAlign: 'center', paddingVertical: Spacing.xl },
  editBtn: {
    height: 32,
    borderRadius: 8,
    paddingHorizontal: Spacing.sm,
    backgroundColor: Colors.feeding + '14',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  editBtnText: { fontSize: 12, fontFamily: 'Geist-SemiBold', color: Colors.feeding },
  deleteBtn: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: Colors.error + '12',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
});
