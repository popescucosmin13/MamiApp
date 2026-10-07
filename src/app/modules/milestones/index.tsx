import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Timestamp } from 'firebase/firestore';
import Toast from 'react-native-toast-message';
import { childService } from '../../../services/childService';
import { useAuthStore } from '../../../stores/authStore';
import { useChildStore } from '../../../stores/childStore';
import { MilestoneCategory } from '../../../types/milestones';
import { MILESTONES_MASTER } from '../../../types/milestones';
import { translateHardcodedText } from '../../../i18n/runtimeText';

interface MilestoneDoc {
  id: string;
  key: string;
  achievedDate?: Timestamp;
  redFlag?: boolean;
}
import { formatDate } from '../../../lib/format';
import { Colors } from '../../../theme/colors';
import { Spacing, BorderRadius, Shadow } from '../../../theme/spacing';

const CATEGORY_CONFIG: Record<MilestoneCategory, { emoji: string; labelRo: string; labelEn: string; color: string }> = {
  motor: { emoji: '🏃', labelRo: 'Motor', labelEn: 'Motor', color: Colors.child.primary },
  language: { emoji: '💬', labelRo: 'Limbaj', labelEn: 'Language', color: Colors.community },
  social: { emoji: '👥', labelRo: 'Social', labelEn: 'Social', color: Colors.sage },
  cognitive: { emoji: '🧠', labelRo: 'Cognitiv', labelEn: 'Cognitive', color: Colors.plum },
  emotional: { emoji: '💛', labelRo: 'Emoțional', labelEn: 'Emotional', color: Colors.amber },
};

export default function MilestonesScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const isEnglish = i18n.language === 'en';
  const { user } = useAuthStore();
  const { activeChild } = useChildStore();
  const [milestones, setMilestones] = useState<MilestoneDoc[]>([]);
  const [activeCategory, setActiveCategory] = useState<MilestoneCategory | 'all'>('all');
  const [isLoading, setIsLoading] = useState(true);

  const ageInDays = activeChild?.birthDate
    ? Math.floor((Date.now() - activeChild.birthDate.toDate().getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  const ageMonths = Math.floor(ageInDays / 30);

  useEffect(() => {
    if (!user || !activeChild?.id) { setIsLoading(false); return; }
    setIsLoading(true);
    const childOwnerId = activeChild.ownerId || user.uid;
    childService.getMilestones(childOwnerId, activeChild.id)
      .then(setMilestones)
      .finally(() => setIsLoading(false));
  }, [user, activeChild?.id, activeChild?.ownerId]);

  const achieveMilestone = async (milestoneId: string) => {
    if (!user || !activeChild?.id) return;
    try {
      const childOwnerId = activeChild.ownerId || user.uid;
      await childService.achieveMilestone(childOwnerId, activeChild.id, milestoneId, Timestamp.now());
      setMilestones((prev) =>
        prev.map((m) => m.id === milestoneId ? { ...m, achievedDate: Timestamp.now() } : m)
      );
      Toast.show({ type: 'success', text1: isEnglish ? 'Milestone reached!' : 'Etapă atinsă!', text2: isEnglish ? 'Congratulations!' : 'Felicitări!' });
    } catch {
      Toast.show({ type: 'error', text1: 'Eroare' });
    }
  };

  const filtered = milestones.filter((m) => {
    const masterEntry = MILESTONES_MASTER.find((mm) => mm.key === m.key);
    if (!masterEntry) return false;
    if (activeCategory !== 'all' && masterEntry.category !== activeCategory) return false;
    return true;
  });

  const achievedCount = milestones.filter((m) => m.achievedDate).length;
  const ageAppropriate = milestones.filter((m) => {
    const master = MILESTONES_MASTER.find((mm) => mm.key === m.key);
    return master && master.expectedAgeMonths <= ageMonths + 3;
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('milestones.title')}</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Progress */}
        <View style={[styles.progressCard, { backgroundColor: Colors.milestone + '15' }]}>
          <View style={styles.progressTop}>
            <View>
              <Text style={styles.progressTitle}>{isEnglish ? 'Reached milestones' : 'Etape atinse'}</Text>
              <Text style={styles.progressSub}>
                {isEnglish
                  ? `${achievedCount} of ${milestones.length} • ${ageMonths} months`
                  : `${achievedCount} din ${milestones.length} • ${ageMonths} luni`}
              </Text>
            </View>
            <Text style={[styles.progressPercent, { color: Colors.milestone }]}>
              {milestones.length > 0 ? Math.round((achievedCount / milestones.length) * 100) : 0}%
            </Text>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, {
              width: `${milestones.length > 0 ? (achievedCount / milestones.length) * 100 : 0}%`,
              backgroundColor: Colors.milestone,
            }]} />
          </View>
        </View>

        {/* Category Filter */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScroll}
        >
          <TouchableOpacity
            style={[styles.categoryChip, activeCategory === 'all' && styles.categoryChipActive]}
            onPress={() => setActiveCategory('all')}
          >
            <Text style={[styles.categoryChipText, activeCategory === 'all' && styles.categoryChipTextActive]}>
              {isEnglish ? 'All' : 'Toate'}
            </Text>
          </TouchableOpacity>
          {(Object.entries(CATEGORY_CONFIG) as [MilestoneCategory, typeof CATEGORY_CONFIG[MilestoneCategory]][]).map(([key, cfg]) => (
            <TouchableOpacity
              key={key}
              style={[styles.categoryChip, activeCategory === key && { backgroundColor: cfg.color, borderColor: cfg.color }]}
              onPress={() => setActiveCategory(key)}
            >
              <Text style={[styles.categoryChipText, activeCategory === key && { color: Colors.white }]}>
                {cfg.emoji} {isEnglish ? cfg.labelEn : cfg.labelRo}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {isLoading ? (
          <ActivityIndicator color={Colors.milestone} style={{ marginTop: Spacing['2xl'] }} />
        ) : filtered.length === 0 ? (
          <Text style={styles.emptyText}>{isEnglish ? 'No milestones in this category' : 'Nicio etapă în această categorie'}</Text>
        ) : (
          <View style={styles.milestoneList}>
            {filtered.map((m) => {
              const master = MILESTONES_MASTER.find((mm) => mm.key === m.key);
              if (!master) return null;
              const categoryConfig = CATEGORY_CONFIG[master.category];
              const isAchieved = !!m.achievedDate;
              const isExpected = master.expectedAgeMonths <= ageMonths + 3;
              const categoryLabel = isEnglish ? categoryConfig.labelEn : categoryConfig.labelRo;
              const title = isEnglish ? master.title_en : master.title_ro;
              const description = isEnglish ? translateHardcodedText(master.description) : master.description;

              return (
                <View key={m.id} style={[styles.milestoneCard, isAchieved && styles.milestoneCardAchieved]}>
                  <View style={styles.milestoneTop}>
                    <View style={[styles.categoryBadge, { backgroundColor: categoryConfig.color + '20' }]}>
                      <Text style={styles.categoryBadgeText}>{categoryConfig.emoji} {categoryLabel}</Text>
                    </View>
                    <Text style={styles.milestoneAge}>{master.expectedAgeMonths}+ {isEnglish ? 'months' : 'luni'}</Text>
                  </View>
                  <Text style={styles.milestoneTitle}>{title}</Text>
                  <Text style={styles.milestoneDesc} numberOfLines={2}>{description}</Text>

                  {isAchieved ? (
                    <View style={styles.achievedRow}>
                      <Text style={styles.achievedText}>{isEnglish ? 'Reached on' : 'Atins pe'} {formatDate(m.achievedDate!)}</Text>
                    </View>
                  ) : isExpected ? (
                    <TouchableOpacity
                      style={styles.achieveButton}
                      onPress={() => achieveMilestone(m.id!)}
                    >
                      <Text style={styles.achieveButtonText}>{isEnglish ? 'Mark as reached' : 'Marchează ca atins'}</Text>
                    </TouchableOpacity>
                  ) : null}

                  {m.redFlag && !isAchieved && master.expectedAgeMonths < ageMonths && (
                    <View style={styles.redFlagAlert}>
                      <Text style={styles.redFlagText}>
                        {isEnglish
                          ? 'Consult your doctor. This milestone was not reached at the expected age.'
                          : 'Consultați medicul. Această etapă nu a fost atinsă la vârsta așteptată.'}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
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
  progressCard: {
    margin: Spacing.xl, borderRadius: BorderRadius.xl, padding: Spacing.xl,
  },
  progressTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.md },
  progressTitle: { fontSize: 16, fontFamily: 'Geist-SemiBold', color: Colors.textPrimary },
  progressSub: { fontSize: 13, fontFamily: 'Geist', color: Colors.textSecondary },
  progressPercent: { fontSize: 28, fontFamily: 'Geist-Bold' },
  progressBarBg: { height: 8, backgroundColor: Colors.white, borderRadius: 4 },
  progressBarFill: { height: 8, borderRadius: 4 },
  categoryScroll: { paddingHorizontal: Spacing.xl, gap: Spacing.sm, paddingBottom: Spacing.lg },
  categoryChip: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full,
    backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border,
  },
  categoryChipActive: { backgroundColor: Colors.milestone, borderColor: Colors.milestone },
  categoryChipText: { fontSize: 13, fontFamily: 'Geist', color: Colors.textSecondary },
  categoryChipTextActive: { color: Colors.white, fontFamily: 'Geist-SemiBold' },
  milestoneList: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing['2xl'], gap: Spacing.md },
  milestoneCard: {
    backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.xl, ...Shadow.sm,
  },
  milestoneCardAchieved: { opacity: 0.85 },
  milestoneTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  categoryBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.sm },
  categoryBadgeText: { fontSize: 11, fontFamily: 'Geist-SemiBold', color: Colors.textSecondary },
  milestoneAge: { fontSize: 12, fontFamily: 'Geist', color: Colors.textTertiary },
  milestoneTitle: { fontSize: 15, fontFamily: 'Geist-SemiBold', color: Colors.textPrimary, marginBottom: Spacing.xs },
  milestoneDesc: { fontSize: 13, fontFamily: 'Geist', color: Colors.textSecondary, lineHeight: 18, marginBottom: Spacing.md },
  achievedRow: { paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border },
  achievedText: { fontSize: 13, fontFamily: 'Geist', color: Colors.success },
  achieveButton: {
    backgroundColor: Colors.milestone + '20', borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.sm, alignItems: 'center', borderWidth: 1, borderColor: Colors.milestone,
  },
  achieveButtonText: { fontSize: 13, fontFamily: 'Geist-SemiBold', color: Colors.milestone },
  redFlagAlert: { marginTop: Spacing.sm, backgroundColor: Colors.error + '10', borderRadius: BorderRadius.sm, padding: Spacing.sm },
  redFlagText: { fontSize: 12, fontFamily: 'Geist', color: Colors.error, lineHeight: 17 },
  emptyText: { fontSize: 14, fontFamily: 'Geist', color: Colors.textTertiary, textAlign: 'center', paddingVertical: Spacing['2xl'] },
});
