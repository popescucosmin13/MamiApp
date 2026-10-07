import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Colors } from '../../../theme/colors';
import { Spacing, BorderRadius, Shadow } from '../../../theme/spacing';

export default function BirthScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'postpartum' | 'first_week' | 'acts'>('postpartum');

  const POSTPARTUM_TOPICS = t('birth_module.postpartum_topics', { returnObjects: true }) as Array<{ emoji: string; title: string; content: string }>;
  const WARNINGS = t('birth_module.warnings', { returnObjects: true }) as string[];
  const FIRST_WEEK_MILESTONES = t('birth_module.first_week_milestones', { returnObjects: true }) as Array<{ day: string; items: string[] }>;
  const HOSPITAL_ACTS = t('birth_module.hospital_acts', { returnObjects: true }) as string[];
  const DEADLINES = t('birth_module.deadlines', { returnObjects: true }) as Array<{ days: string; desc: string }>;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('birth_module.title')}</Text>
        <View style={{ width: 32 }} />
      </View>

      <View style={styles.tabs}>
        {([
          { key: 'postpartum', label: t('birth_module.tab_postpartum') },
          { key: 'first_week', label: t('birth_module.tab_first_week') },
          { key: 'acts', label: t('birth_module.tab_acts') },
        ] as const).map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {activeTab === 'postpartum' && (
          <View style={styles.content}>
            <View style={styles.heroBanner}>
              <Text style={styles.heroEmoji}>🌸</Text>
              <Text style={styles.heroTitle}>{t('birth_module.hero_title')}</Text>
              <Text style={styles.heroSubtitle}>{t('birth_module.hero_subtitle')}</Text>
            </View>
            {POSTPARTUM_TOPICS.map((topic, i) => (
              <View key={i} style={styles.topicCard}>
                <View style={styles.topicHeader}>
                  <Text style={styles.topicEmoji}>{topic.emoji}</Text>
                  <Text style={styles.topicTitle}>{topic.title}</Text>
                </View>
                <Text style={styles.topicContent}>{topic.content}</Text>
              </View>
            ))}

            <View style={styles.warningCard}>
              <Text style={styles.warningTitle}>{t('birth_module.warning_title')}</Text>
              {WARNINGS.map((item, i) => (
                <Text key={i} style={styles.warningItem}>• {item}</Text>
              ))}
            </View>
          </View>
        )}

        {activeTab === 'first_week' && (
          <View style={styles.content}>
            {FIRST_WEEK_MILESTONES.map((milestone, i) => (
              <View key={i} style={styles.weekCard}>
                <View style={styles.weekHeader}>
                  <Text style={styles.weekDay}>{milestone.day}</Text>
                </View>
                {milestone.items.map((item, j) => (
                  <View key={j} style={styles.weekItem}>
                    <Text style={styles.weekDot}>●</Text>
                    <Text style={styles.weekItemText}>{item}</Text>
                  </View>
                ))}
              </View>
            ))}

            <View style={styles.tipCard}>
              <Text style={styles.tipTitle}>{t('birth_module.tip_title')}</Text>
              <Text style={styles.tipText}>{t('birth_module.tip_text')}</Text>
            </View>
          </View>
        )}

        {activeTab === 'acts' && (
          <View style={styles.content}>
            <View style={styles.actsIntro}>
              <Text style={styles.actsIntroTitle}>{t('birth_module.acts_intro_title')}</Text>
              <Text style={styles.actsIntroText}>{t('birth_module.acts_intro_text')}</Text>
            </View>
            {HOSPITAL_ACTS.map((act, i) => (
              <View key={i} style={styles.actRow}>
                <Text style={styles.actText}>{act}</Text>
              </View>
            ))}

            <View style={styles.deadlineCard}>
              <Text style={styles.deadlineTitle}>{t('birth_module.deadline_title')}</Text>
              {DEADLINES.map((deadline, i) => (
                <View key={i} style={styles.deadlineRow}>
                  <Text style={styles.deadlineDays}>{deadline.days}</Text>
                  <Text style={styles.deadlineDesc}>{deadline.desc}</Text>
                </View>
              ))}
            </View>
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
  tabs: {
    flexDirection: 'row', paddingHorizontal: Spacing.xl, paddingVertical: Spacing.sm, gap: Spacing.xs,
    borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.white,
  },
  tab: {
    flex: 1, height: 34, borderRadius: BorderRadius.full, alignItems: 'center', justifyContent: 'center',
  },
  tabActive: { backgroundColor: Colors.pregnancy.primary + '20' },
  tabText: { fontSize: 12, fontFamily: 'Geist', color: Colors.textSecondary },
  tabTextActive: { fontFamily: 'Geist-SemiBold', color: Colors.pregnancy.primary },
  content: { padding: Spacing.xl, gap: Spacing.md, paddingBottom: Spacing['2xl'] },
  heroBanner: {
    backgroundColor: Colors.pregnancy.primaryLight, borderRadius: BorderRadius['2xl'],
    padding: Spacing.xl, alignItems: 'center',
  },
  heroEmoji: { fontSize: 48, marginBottom: Spacing.sm },
  heroTitle: { fontSize: 18, fontFamily: 'Fraunces', color: Colors.textPrimary, marginBottom: Spacing.xs },
  heroSubtitle: { fontSize: 13, fontFamily: 'Geist', color: Colors.textSecondary, textAlign: 'center', lineHeight: 19 },
  topicCard: {
    backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.lg, ...Shadow.sm,
  },
  topicHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  topicEmoji: { fontSize: 22 },
  topicTitle: { fontSize: 15, fontFamily: 'Geist-SemiBold', color: Colors.textPrimary },
  topicContent: { fontSize: 13, fontFamily: 'Geist', color: Colors.textSecondary, lineHeight: 19 },
  warningCard: {
    backgroundColor: Colors.error + '10', borderRadius: BorderRadius.xl, padding: Spacing.lg,
    borderWidth: 1, borderColor: Colors.error + '30',
  },
  warningTitle: { fontSize: 15, fontFamily: 'Geist-SemiBold', color: Colors.error, marginBottom: Spacing.md },
  warningItem: { fontSize: 13, fontFamily: 'Geist', color: Colors.error, lineHeight: 22 },
  weekCard: { backgroundColor: Colors.white, borderRadius: BorderRadius.xl, overflow: 'hidden', ...Shadow.sm },
  weekHeader: { backgroundColor: Colors.pregnancy.primary + '20', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
  weekDay: { fontSize: 14, fontFamily: 'Geist-SemiBold', color: Colors.pregnancy.primary },
  weekItem: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.xs },
  weekDot: { fontSize: 8, color: Colors.pregnancy.primary, lineHeight: 20 },
  weekItemText: { flex: 1, fontSize: 13, fontFamily: 'Geist', color: Colors.textSecondary, lineHeight: 19 },
  tipCard: {
    backgroundColor: Colors.pregnancy.primaryLight, borderRadius: BorderRadius.xl, padding: Spacing.lg,
  },
  tipTitle: { fontSize: 14, fontFamily: 'Geist-SemiBold', color: Colors.textPrimary, marginBottom: Spacing.xs },
  tipText: { fontSize: 13, fontFamily: 'Geist', color: Colors.textSecondary, lineHeight: 19 },
  actsIntro: { backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.lg, ...Shadow.sm },
  actsIntroTitle: { fontSize: 15, fontFamily: 'Geist-SemiBold', color: Colors.textPrimary, marginBottom: Spacing.xs },
  actsIntroText: { fontSize: 13, fontFamily: 'Geist', color: Colors.textSecondary, lineHeight: 19 },
  actRow: {
    backgroundColor: Colors.white, borderRadius: BorderRadius.lg, padding: Spacing.md,
    borderLeftWidth: 3, borderLeftColor: Colors.pregnancy.primary,
  },
  actText: { fontSize: 13, fontFamily: 'Geist', color: Colors.textPrimary },
  deadlineCard: { backgroundColor: Colors.warning + '10', borderRadius: BorderRadius.xl, padding: Spacing.lg },
  deadlineTitle: { fontSize: 14, fontFamily: 'Geist-SemiBold', color: Colors.warning, marginBottom: Spacing.md },
  deadlineRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.sm, alignItems: 'center' },
  deadlineDays: { width: 64, fontSize: 14, fontFamily: 'Geist-Bold', color: Colors.warning },
  deadlineDesc: { flex: 1, fontSize: 13, fontFamily: 'Geist', color: Colors.textSecondary },
});
