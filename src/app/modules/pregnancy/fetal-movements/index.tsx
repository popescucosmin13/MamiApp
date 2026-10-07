import { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Timestamp } from 'firebase/firestore';
import { useLoadPregnancyData } from '../../../../hooks/usePregnancy';
import { usePregnancyStore } from '../../../../stores/pregnancyStore';
import type { FetalMovement } from '../../../../types/pregnancy';
import { Colors } from '../../../../theme/colors';
import { Spacing, BorderRadius, Shadow } from '../../../../theme/spacing';

type MovementDayGroup = {
  key: string;
  label: string;
  subtitle: string;
  total: number;
  items: FetalMovement[];
};

function getDayKey(timestamp: Timestamp): string {
  return timestamp.toDate().toLocaleDateString('ro-RO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function formatDay(timestamp: Timestamp): string {
  return timestamp.toDate().toLocaleDateString('ro-RO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function formatDaySubtitle(timestamp: Timestamp): string {
  return timestamp.toDate().toLocaleDateString('ro-RO', {
    year: 'numeric',
  });
}

function formatTime(timestamp: Timestamp): string {
  return timestamp.toDate().toLocaleTimeString('ro-RO', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function FetalMovementsHistoryScreen() {
  useLoadPregnancyData();
  const router = useRouter();
  const { movements, isLoading } = usePregnancyStore();

  const sortedMovements = useMemo(
    () => [...movements].sort((a, b) => b.date.toMillis() - a.date.toMillis()),
    [movements]
  );

  const groups = useMemo(() => {
    return sortedMovements.reduce<MovementDayGroup[]>((acc, movement) => {
      const key = getDayKey(movement.date);
      const existing = acc.find((group) => group.key === key);
      if (existing) {
        existing.total += movement.count;
        existing.items.push(movement);
      } else {
        acc.push({
          key,
          label: formatDay(movement.date),
          subtitle: formatDaySubtitle(movement.date),
          total: movement.count,
          items: [movement],
        });
      }
      return acc;
    }, []);
  }, [sortedMovements]);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayTotal = sortedMovements
    .filter((movement) => movement.date.toMillis() >= todayStart.getTime())
    .reduce((sum, movement) => sum + movement.count, 0);
  const allTotal = sortedMovements.reduce((sum, movement) => sum + movement.count, 0);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Istoric mișcări</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={[Colors.pregnancy.primary, Colors.pregnancy.primaryDark]}
          style={styles.hero}
        >
          <Text style={styles.heroLabel}>Mișcări fetale</Text>
          <Text style={styles.heroValue}>{todayTotal}</Text>
          <Text style={styles.heroText}>înregistrate azi</Text>
          <View style={styles.goalTrack}>
            <View style={[styles.goalFill, { width: `${Math.min((todayTotal / 10) * 100, 100)}%` }]} />
          </View>
          <Text style={styles.goalText}>{todayTotal >= 10 ? 'Ținta de azi este atinsă.' : `Încă ${10 - todayTotal} până la ținta de 10.`}</Text>
        </LinearGradient>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{allTotal}</Text>
            <Text style={styles.statLabel}>total mișcări</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{groups.length}</Text>
            <Text style={styles.statLabel}>zile active</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{sortedMovements.length}</Text>
            <Text style={styles.statLabel}>înregistrări</Text>
          </View>
        </View>

        {groups.length === 0 && !isLoading ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>👶</Text>
            <Text style={styles.emptyTitle}>Nu ai încă mișcări salvate</Text>
            <Text style={styles.emptyText}>Când adaugi mișcări fetale, le vei vedea aici grupate pe zile și ore.</Text>
          </View>
        ) : (
          groups.map((group) => (
            <View key={group.key} style={styles.dayCard}>
              <View style={styles.dayHeader}>
                <View>
                  <Text style={styles.dayTitle}>{group.label}</Text>
                  <Text style={styles.daySubtitle}>{group.subtitle}</Text>
                </View>
                <View style={styles.dayTotalBadge}>
                  <Text style={styles.dayTotalValue}>{group.total}</Text>
                  <Text style={styles.dayTotalLabel}>total</Text>
                </View>
              </View>

              <View style={styles.timeline}>
                {group.items.map((movement, index) => (
                  <View key={movement.id || `${group.key}-${index}`} style={styles.timelineRow}>
                    <View style={styles.timelineRail}>
                      <View style={styles.timelineDot} />
                      {index < group.items.length - 1 && <View style={styles.timelineLine} />}
                    </View>
                    <View style={styles.movementCard}>
                      <Text style={styles.movementTime}>{formatTime(movement.date)}</Text>
                      <Text style={styles.movementCount}>
                        {movement.count} mișcare{movement.count !== 1 ? 'i' : ''}
                      </Text>
                      {!!movement.notes && <Text style={styles.movementNotes}>{movement.notes}</Text>}
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ))
        )}
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
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backArrow: { fontSize: 24, color: Colors.textPrimary },
  headerTitle: { fontFamily: 'Fraunces', fontSize: 20, color: Colors.textPrimary },
  scroll: { flex: 1 },
  content: { padding: Spacing.lg, paddingBottom: Spacing['3xl'] },
  hero: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    marginBottom: Spacing.md,
    ...Shadow.md,
  },
  heroLabel: { fontFamily: 'Geist-SemiBold', fontSize: 12, color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', letterSpacing: 0.8 },
  heroValue: { fontFamily: 'Fraunces', fontSize: 58, color: Colors.white, marginTop: Spacing.xs, lineHeight: 66 },
  heroText: { fontFamily: 'Geist', fontSize: 15, color: 'rgba(255,255,255,0.86)', marginBottom: Spacing.md },
  goalTrack: { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' },
  goalFill: { height: 8, borderRadius: 4, backgroundColor: Colors.white },
  goalText: { fontFamily: 'Geist-SemiBold', fontSize: 12, color: Colors.white, marginTop: Spacing.sm },
  statsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  statCard: { flex: 1, backgroundColor: Colors.white, borderRadius: BorderRadius.lg, padding: Spacing.md, alignItems: 'center', ...Shadow.sm },
  statValue: { fontFamily: 'Geist-Bold', fontSize: 18, color: Colors.pregnancy.primary },
  statLabel: { fontFamily: 'Geist', fontSize: 10, color: Colors.textTertiary, textAlign: 'center', marginTop: 2 },
  emptyCard: { backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing['2xl'], alignItems: 'center', ...Shadow.sm },
  emptyIcon: { fontSize: 42, marginBottom: Spacing.md },
  emptyTitle: { fontFamily: 'Geist-SemiBold', fontSize: 16, color: Colors.textPrimary, marginBottom: Spacing.xs, textAlign: 'center' },
  emptyText: { fontFamily: 'Geist', fontSize: 13, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  dayCard: { backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.lg, marginBottom: Spacing.md, ...Shadow.sm },
  dayHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.lg },
  dayTitle: { fontFamily: 'Fraunces', fontSize: 20, color: Colors.textPrimary, textTransform: 'capitalize' },
  daySubtitle: { fontFamily: 'Geist', fontSize: 12, color: Colors.textTertiary, marginTop: 2 },
  dayTotalBadge: { minWidth: 58, borderRadius: BorderRadius.lg, backgroundColor: Colors.pregnancy.primaryLight, paddingVertical: Spacing.xs, paddingHorizontal: Spacing.sm, alignItems: 'center' },
  dayTotalValue: { fontFamily: 'Geist-Bold', fontSize: 18, color: Colors.pregnancy.primaryDark },
  dayTotalLabel: { fontFamily: 'Geist', fontSize: 10, color: Colors.textSecondary },
  timeline: { gap: Spacing.xs },
  timelineRow: { flexDirection: 'row', alignItems: 'stretch' },
  timelineRail: { width: 22, alignItems: 'center' },
  timelineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.pregnancy.primary, marginTop: 18 },
  timelineLine: { flex: 1, width: 2, backgroundColor: Colors.pregnancy.primaryLight, marginTop: 2 },
  movementCard: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.backgroundSoft, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.sm },
  movementTime: { width: 58, fontFamily: 'Geist-SemiBold', fontSize: 14, color: Colors.textPrimary },
  movementCount: { flex: 1, fontFamily: 'Geist-SemiBold', fontSize: 14, color: Colors.pregnancy.primaryDark },
  movementNotes: { flex: 1, fontFamily: 'Geist', fontSize: 12, color: Colors.textSecondary },
});
