import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Timestamp } from 'firebase/firestore';
import { useAuthStore } from '../../../../stores/authStore';
import { usePregnancyStore } from '../../../../stores/pregnancyStore';
import {
  useTimerStore,
  getElapsedSeconds,
  isTimerPaused,
} from '../../../../stores/timerStore';
import { pregnancyService } from '../../../../services/pregnancyService';
import { Contraction } from '../../../../types/pregnancy';
import { Colors } from '../../../../theme/colors';
import { Spacing, BorderRadius, Shadow } from '../../../../theme/spacing';

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function formatInterval(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m} min`;
}

function formatTime(ts: Timestamp): string {
  return ts.toDate().toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatDateTime(ts: Timestamp): string {
  const d = ts.toDate();
  return `${d.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })} · ${d.toLocaleDateString('ro-RO', { day: '2-digit', month: 'short' })}`;
}

const INTENSITY_LABELS = ['', 'Ușoară', 'Moderată', 'Medie', 'Intensă', 'Maximă'];
const INTENSITY_COLORS = ['', Colors.success, '#A0C878', Colors.warning, '#E87050', Colors.error];

function useElapsed(timerId: string | undefined, pausedAt: number | undefined, totalPausedMs: number) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!timerId) { setElapsed(0); return; }
    const tick = () => {
      const t = useTimerStore.getState().getTimer('contraction');
      if (t) setElapsed(getElapsedSeconds(t));
    };
    tick();
    if (pausedAt !== undefined) return;
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerId, pausedAt, totalPausedMs]);
  return elapsed;
}

export default function ContractionsScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { contractions, addContraction } = usePregnancyStore();
  const { startTimer, stopTimer, pauseTimer, resumeTimer, getTimer } = useTimerStore();

  const [intensity, setIntensity] = useState<1 | 2 | 3 | 4 | 5>(3);

  const timer = getTimer('contraction');
  const elapsed = useElapsed(timer?.id, timer?.pausedAt, timer?.totalPausedMs ?? 0);
  const paused = !!timer && isTimerPaused(timer);
  const isTracking = !!timer;

  const startContraction = () => {
    startTimer({
      type: 'contraction',
      label: `Contracție · ${INTENSITY_LABELS[intensity]}`,
      startTime: Date.now(),
    });
  };

  const stopContraction = async () => {
    if (!user || !timer) return;

    const startTs = Timestamp.fromMillis(timer.startTime);
    const endTs = Timestamp.now();
    const duration = elapsed;

    stopTimer(timer.id);

    const contraction: Omit<Contraction, 'id'> = {
      startTime: startTs,
      endTime: endTs,
      duration,
      intensity,
    };

    try {
      const id = await pregnancyService.addContraction(user.uid, contraction);
      addContraction({ ...contraction, id });
    } catch {
      Alert.alert('Eroare', 'Nu s-a putut salva contracția');
    }
  };

  const recentContractions = contractions.slice(0, 10);

  const avgInterval = recentContractions.length >= 2
    ? Math.round(
        recentContractions.slice(0, -1).reduce((sum, c, i) => {
          const next = recentContractions[i + 1];
          return sum + (c.startTime.toMillis() - next.startTime.toMillis()) / 1000;
        }, 0) / (recentContractions.length - 1)
      )
    : null;

  const avgDuration = recentContractions.length > 0
    ? Math.round(recentContractions.reduce((s, c) => s + (c.duration || 0), 0) / recentContractions.length)
    : null;

  const shouldCallDoctor = avgInterval !== null && avgInterval <= 300 && avgDuration !== null && avgDuration >= 60;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Contracții ⏱️</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Stats */}
        {recentContractions.length >= 2 && (
          <View style={styles.statsCard}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{avgInterval ? formatInterval(avgInterval) : '—'}</Text>
              <Text style={styles.statLabel}>Interval mediu</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{avgDuration ? formatDuration(avgDuration) : '—'}</Text>
              <Text style={styles.statLabel}>Durată medie</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{recentContractions.length}</Text>
              <Text style={styles.statLabel}>Contracții</Text>
            </View>
          </View>
        )}

        {shouldCallDoctor && (
          <View style={styles.alertCard}>
            <Text style={styles.alertTitle}>🏥 Contactați medicul</Text>
            <Text style={styles.alertText}>
              Contracțiile vin la intervale de {formatInterval(avgInterval!)} și durează {formatDuration(avgDuration!)}. Aceasta poate indica nașterea activă.
            </Text>
          </View>
        )}

        {/* Timer */}
        <View style={styles.timerCard}>
          <Text style={styles.timerTitle}>
            {isTracking ? '⏱️ Contracție în desfășurare' : 'Apăsați pentru a înregistra'}
          </Text>

          {timer && (
            <Text style={styles.timerStartedAt}>
              Început la {formatDateTime(Timestamp.fromMillis(timer.startTime))}
            </Text>
          )}

          <Text style={[styles.timerDisplay, { color: isTracking && !paused ? Colors.error : Colors.textPrimary }]}>
            {formatDuration(elapsed)}
          </Text>
          {paused && <Text style={styles.pausedLabel}>⏸ În pauză</Text>}

          {/* Intensity (only when not tracking) */}
          {!isTracking && (
            <View style={styles.intensityRow}>
              <Text style={styles.intensityLabel}>Intensitate anticipată:</Text>
              <View style={styles.intensityButtons}>
                {([1, 2, 3, 4, 5] as const).map((level) => (
                  <TouchableOpacity
                    key={level}
                    style={[styles.intensityBtn, intensity === level && { backgroundColor: INTENSITY_COLORS[level] }]}
                    onPress={() => setIntensity(level)}
                  >
                    <Text style={[styles.intensityBtnText, intensity === level && { color: Colors.white }]}>
                      {level}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={[styles.intensityName, { color: INTENSITY_COLORS[intensity] }]}>
                {INTENSITY_LABELS[intensity]}
              </Text>
            </View>
          )}

          {!isTracking ? (
            <TouchableOpacity
              style={[styles.trackBtn, { backgroundColor: Colors.pregnancy.primary }]}
              onPress={startContraction}
            >
              <Text style={styles.trackBtnText}>▶ Start contracție</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.controlRow}>
              {/* PAUSE / RESUME */}
              <TouchableOpacity
                style={[styles.trackBtn, { flex: 1, backgroundColor: paused ? Colors.pregnancy.primary : Colors.warning }]}
                onPress={paused ? () => resumeTimer(timer!.id) : () => pauseTimer(timer!.id)}
              >
                <Text style={styles.trackBtnText}>{paused ? '▶ Continuă' : '⏸ Pauză'}</Text>
              </TouchableOpacity>

              {/* STOP & SAVE */}
              <TouchableOpacity
                style={[styles.trackBtn, { flex: 1, backgroundColor: Colors.error }]}
                onPress={stopContraction}
              >
                <Text style={styles.trackBtnText}>■ Stop & Salvează</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Regula 5-1-1 */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>📏 Regula 5-1-1</Text>
          <Text style={styles.infoText}>
            Mergeți la spital când contracțiile vin la fiecare <Text style={styles.bold}>5 minute</Text>,
            durează cel puțin <Text style={styles.bold}>1 minut</Text>, timp de
            <Text style={styles.bold}> 1 oră</Text>.
          </Text>
        </View>

        {/* History */}
        {recentContractions.length > 0 && (
          <View style={styles.historySection}>
            <Text style={styles.historyTitle}>Istoric recent</Text>
            {recentContractions.map((c, i) => (
              <View key={c.id || i} style={styles.historyRow}>
                <View style={styles.historyTimeCol}>
                  <Text style={styles.historyTime}>{formatTime(c.startTime)}</Text>
                  <Text style={styles.historyDate}>
                    {c.startTime.toDate().toLocaleDateString('ro-RO', { day: '2-digit', month: 'short' })}
                  </Text>
                </View>
                <Text style={styles.historyDuration}>{c.duration ? formatDuration(c.duration) : '—'}</Text>
                <View style={[styles.intensityDot, { backgroundColor: INTENSITY_COLORS[c.intensity] }]} />
                <Text style={styles.historyIntensity}>{INTENSITY_LABELS[c.intensity]}</Text>
                {i < recentContractions.length - 1 && (
                  <Text style={styles.historyInterval}>
                    +{formatInterval(Math.round((recentContractions[i].startTime.toMillis() - recentContractions[i + 1].startTime.toMillis()) / 1000))}
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backArrow: { fontSize: 22, color: Colors.textPrimary },
  headerTitle: { fontSize: 18, fontFamily: 'Fraunces', color: Colors.textPrimary },
  statsCard: {
    flexDirection: 'row', marginHorizontal: Spacing.xl, marginTop: Spacing.xl,
    backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.lg, ...Shadow.sm,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 18, fontFamily: 'Geist-Bold', color: Colors.pregnancy.primary },
  statLabel: { fontSize: 11, fontFamily: 'Geist', color: Colors.textSecondary },
  statDivider: { width: 1, backgroundColor: Colors.border },
  alertCard: {
    margin: Spacing.xl, marginTop: Spacing.md,
    backgroundColor: Colors.error + '10', borderRadius: BorderRadius.xl, padding: Spacing.lg,
    borderWidth: 1, borderColor: Colors.error + '30',
  },
  alertTitle: { fontSize: 15, fontFamily: 'Geist-SemiBold', color: Colors.error, marginBottom: Spacing.xs },
  alertText: { fontSize: 13, fontFamily: 'Geist', color: Colors.error, lineHeight: 19 },
  timerCard: {
    margin: Spacing.xl, backgroundColor: Colors.white, borderRadius: BorderRadius['2xl'],
    padding: Spacing.xl, alignItems: 'center', ...Shadow.md,
  },
  timerTitle: { fontSize: 14, fontFamily: 'Geist', color: Colors.textSecondary, marginBottom: Spacing.sm },
  timerStartedAt: { fontSize: 12, fontFamily: 'Geist', color: Colors.textTertiary, marginBottom: Spacing.md },
  timerDisplay: { fontSize: 64, fontFamily: 'Geist-Bold', marginBottom: Spacing.xs },
  pausedLabel: { fontSize: 13, fontFamily: 'Geist', color: Colors.textTertiary, marginBottom: Spacing.xl },
  intensityRow: { width: '100%', marginBottom: Spacing.xl, alignItems: 'center', marginTop: Spacing.lg },
  intensityLabel: { fontSize: 13, fontFamily: 'Geist', color: Colors.textSecondary, marginBottom: Spacing.sm },
  intensityButtons: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.xs },
  intensityBtn: {
    width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.backgroundSoft,
  },
  intensityBtnText: { fontSize: 14, fontFamily: 'Geist-SemiBold', color: Colors.textSecondary },
  intensityName: { fontSize: 13, fontFamily: 'Geist-SemiBold' },
  controlRow: { flexDirection: 'row', gap: Spacing.md, width: '100%', marginTop: Spacing.lg },
  trackBtn: {
    width: '100%', height: 56, borderRadius: BorderRadius.xl,
    alignItems: 'center', justifyContent: 'center', marginTop: Spacing.lg,
  },
  trackBtnText: { fontSize: 16, fontFamily: 'Geist-SemiBold', color: Colors.white },
  infoCard: {
    marginHorizontal: Spacing.xl, marginBottom: Spacing.xl,
    backgroundColor: Colors.pregnancy.primaryLight, borderRadius: BorderRadius.xl, padding: Spacing.lg,
  },
  infoTitle: { fontSize: 15, fontFamily: 'Geist-SemiBold', color: Colors.textPrimary, marginBottom: Spacing.sm },
  infoText: { fontSize: 13, fontFamily: 'Geist', color: Colors.textSecondary, lineHeight: 20 },
  bold: { fontFamily: 'Geist-SemiBold', color: Colors.pregnancy.primary },
  historySection: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing['2xl'] },
  historyTitle: { fontSize: 15, fontFamily: 'Geist-SemiBold', color: Colors.textPrimary, marginBottom: Spacing.md },
  historyRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  historyTimeCol: { width: 80 },
  historyTime: { fontSize: 13, fontFamily: 'Geist-SemiBold', color: Colors.textPrimary },
  historyDate: { fontSize: 11, fontFamily: 'Geist', color: Colors.textTertiary },
  historyDuration: { width: 56, fontSize: 13, fontFamily: 'Geist', color: Colors.pregnancy.primary },
  intensityDot: { width: 8, height: 8, borderRadius: 4 },
  historyIntensity: { flex: 1, fontSize: 12, fontFamily: 'Geist', color: Colors.textSecondary },
  historyInterval: { fontSize: 11, fontFamily: 'Geist', color: Colors.textTertiary },
});
