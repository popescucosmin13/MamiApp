import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Timestamp } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';
import { useChildStore } from '../../../stores/childStore';
import { useFoodStore } from '../../../stores/foodStore';
import { useLoadFoodData } from '../../../hooks/useFood';
import { Colors } from '../../../theme/colors';
import { BorderRadius, Shadow, Spacing } from '../../../theme/spacing';

const DEFAULT_QUESTION_KEYS = [
  'constipation',
  'cow_milk',
  'meals_per_day',
  'allergy_vs_intolerance',
  'avoid_first_year',
  'food_refusal',
  'iron',
  'emergency_reaction',
];

const SEVERITY_COLOR: Record<string, string> = {
  mild: Colors.warning,
  moderate: Colors.amber,
  severe: Colors.error,
};

function formatTimestamp(value: string | Timestamp | undefined | null, locale: string, fallback: string): string {
  if (!value) return fallback;
  try {
    const date = value instanceof Timestamp ? value.toDate() : new Date(value);
    return date.toLocaleDateString(locale === 'en' ? 'en-US' : 'ro-RO', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return fallback;
  }
}

function formatAge(birthDate: Timestamp | undefined | null, locale: string, unknown: string): string {
  if (!birthDate) return unknown;
  try {
    const birth = birthDate.toDate();
    const now = new Date();
    let months = (now.getFullYear() - birth.getFullYear()) * 12 + now.getMonth() - birth.getMonth();
    if (months < 0) months = 0;
    if (months < 24) return locale === 'en' ? `${months} months` : `${months} luni`;
    const years = Math.floor(months / 12);
    const rest = months % 12;
    if (locale === 'en') return rest > 0 ? `${years} years ${rest} months` : `${years} years`;
    return rest > 0 ? `${years} ani și ${rest} luni` : `${years} ani`;
  } catch {
    return unknown;
  }
}

export default function ReportScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  useLoadFoodData();

  const { profile, introducedFoods, meals, reactions } = useFoodStore();
  const { activeChild } = useChildStore();
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [showAddQuestion, setShowAddQuestion] = useState(false);
  const [customQuestions, setCustomQuestions] = useState<string[]>([]);
  const [newQuestion, setNewQuestion] = useState('');

  const unknown = t('common.unknown');
  const reportDate = useMemo(() => formatTimestamp(Timestamp.now(), i18n.language, unknown), [i18n.language, unknown]);
  const last7DaysMeals = useMemo(() => {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return meals.filter((meal) => {
      try {
        const date = meal.date instanceof Timestamp ? meal.date.toDate() : new Date(meal.date as string);
        return date >= cutoff;
      } catch {
        return false;
      }
    });
  }, [meals]);

  const foodsWithReaction = introducedFoods.filter((food) => food.reactionStatus !== 'none' && food.reactionStatus !== 'unknown');
  const allergensIntroduced = introducedFoods.filter((food) => food.isAllergen);
  const allergensWithReaction = allergensIntroduced.filter((food) => food.reactionStatus !== 'none' && food.reactionStatus !== 'unknown');

  const mealsByType = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const meal of last7DaysMeals) counts[meal.mealType] = (counts[meal.mealType] ?? 0) + 1;
    return counts;
  }, [last7DaysMeals]);

  const addQuestion = () => {
    const trimmed = newQuestion.trim();
    if (!trimmed) return;
    setCustomQuestions((prev) => [...prev, trimmed]);
    setNewQuestion('');
    setShowAddQuestion(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('food_report.title')}</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.introCard}>
          <Text style={styles.introEmoji}>📋</Text>
          <Text style={styles.introTitle}>{t('food_report.intro_title')}</Text>
          <Text style={styles.introDate}>{t('food_report.generated_at', { date: reportDate })}</Text>
          <Text style={styles.introDesc}>{t('food_report.intro_desc')}</Text>
        </View>

        <Section title={`👶 ${t('food_report.child_data')}`}>
          <DataRow label={t('food_report.name')} value={activeChild?.name ?? t('food_report.unspecified')} />
          <DataRow label={t('food_report.age')} value={formatAge(activeChild?.birthDate ?? null, i18n.language, t('food_report.unknown_age'))} />
        </Section>

        <Section title={`🥕 ${t('food_report.weaning')}`}>
          {!profile ? (
            <Text style={styles.emptyText}>{t('food_report.profile_missing')}</Text>
          ) : (
            <>
              <DataRow label={t('food_report.status')} value={t(`food_report.status_${profile.status}`, { defaultValue: profile.status })} />
              <DataRow label={t('food_report.start_date')} value={formatTimestamp(profile.startedAt, i18n.language, unknown)} />
              <DataRow label={t('food_report.method')} value={t(`food_report.method_${profile.method}`, { defaultValue: profile.method })} />
              <DataRow label={t('food_report.meals_day')} value={String(profile.mealsPerDay ?? '-')} />
              {profile.restrictions?.length ? (
                <DataRow label={t('food_report.restrictions')} value={profile.restrictions.join(', ')} />
              ) : null}
            </>
          )}
        </Section>

        <Section title={`🍽️ ${t('food_report.introduced_foods', { count: introducedFoods.length })}`}>
          {introducedFoods.length === 0 ? (
            <Text style={styles.emptyText}>{t('food_report.no_foods')}</Text>
          ) : (
            introducedFoods.map((food) => (
              <View key={food.id} style={styles.foodRow}>
                <View style={styles.foodRowLeft}>
                  <Text style={styles.foodCategory}>{t(`food_list.category_${food.category}`, { defaultValue: food.category })}</Text>
                  <Text style={styles.foodName}>{food.name}</Text>
                  <Text style={styles.foodDate}>{t('food_list.introduced_on', { date: formatTimestamp(food.introducedAt, i18n.language, unknown) })}</Text>
                </View>
                <ReactionBadge status={food.reactionStatus} />
              </View>
            ))
          )}
          {foodsWithReaction.length > 0 ? (
            <AlertBox text={t('food_report.foods_with_reaction', { count: foodsWithReaction.length, foods: foodsWithReaction.map((f) => f.name).join(', ') })} />
          ) : null}
        </Section>

        <Section title={`⚠️ ${t('food_report.allergens', { count: allergensIntroduced.length })}`}>
          {allergensIntroduced.length === 0 ? (
            <Text style={styles.emptyText}>{t('food_report.no_allergens')}</Text>
          ) : (
            allergensIntroduced.map((food) => (
              <View key={food.id} style={styles.allergenRow}>
                <Text style={styles.allergenName}>{food.allergenType ?? food.name}</Text>
                <ReactionBadge status={food.reactionStatus} />
              </View>
            ))
          )}
          {allergensWithReaction.length > 0 ? (
            <AlertBox text={t('food_report.allergens_with_reaction', { foods: allergensWithReaction.map((f) => f.allergenType ?? f.name).join(', ') })} />
          ) : null}
        </Section>

        <Section title={`📅 ${t('food_report.meals_last_week')}`}>
          {last7DaysMeals.length === 0 ? (
            <Text style={styles.emptyText}>{t('food_report.no_recent_meals')}</Text>
          ) : (
            <>
              <DataRow label={t('food_report.total_meals')} value={String(last7DaysMeals.length)} />
              {Object.entries(mealsByType).map(([type, count]) => (
                <DataRow key={type} label={t(`food_report.meal_${type}`, { defaultValue: type })} value={String(count)} />
              ))}
            </>
          )}
        </Section>

        <Section title={`🔴 ${t('food_report.reactions', { count: reactions.length })}`}>
          {reactions.length === 0 ? (
            <Text style={styles.emptyText}>{t('food_report.no_reactions')}</Text>
          ) : (
            reactions.map((reaction) => (
              <View key={reaction.id} style={styles.reactionCard}>
                <View style={styles.reactionCardHeader}>
                  <Text style={styles.reactionFoodName}>{reaction.suspectedFoodName}</Text>
                  <View style={[styles.severityBadge, { backgroundColor: (SEVERITY_COLOR[reaction.severity] ?? Colors.warning) + '20' }]}>
                    <Text style={[styles.severityText, { color: SEVERITY_COLOR[reaction.severity] ?? Colors.warning }]}>
                      {t(`food_report.severity_${reaction.severity}`, { defaultValue: reaction.severity })}
                    </Text>
                  </View>
                </View>
                <Text style={styles.reactionDate}>{formatTimestamp(reaction.reactionAt, i18n.language, unknown)}</Text>
                {reaction.symptoms.length > 0 ? <Text style={styles.reactionSymptoms}>{t('food_report.symptoms', { symptoms: reaction.symptoms.join(', ') })}</Text> : null}
                {reaction.contactedDoctor ? <Text style={styles.doctorContacted}>✅ {t('food_report.doctor_contacted')}</Text> : null}
                {reaction.notes ? <Text style={styles.reactionNotes}>{reaction.notes}</Text> : null}
              </View>
            ))
          )}
        </Section>

        <View style={styles.questionsCard}>
          <View style={styles.questionsTitleRow}>
            <Text style={styles.questionsTitle}>💬 {t('food_report.questions_title')}</Text>
            <TouchableOpacity style={styles.addQBtn} onPress={() => setShowAddQuestion(true)}>
              <Text style={styles.addQBtnText}>+ {t('common.add')}</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.questionsSubtitle}>{t('food_report.questions_subtitle')}</Text>
          {[...DEFAULT_QUESTION_KEYS.map((key) => t(`food_report.question_${key}`)), ...customQuestions].map((question, index) => (
            <View key={`${question}-${index}`} style={styles.questionRow}>
              <Text style={styles.questionNumber}>{index + 1}.</Text>
              <Text style={styles.questionText}>{question}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity style={styles.pdfBtn} onPress={() => setShowPdfModal(true)}>
          <Text style={styles.pdfBtnText}>📄 {t('food_report.generate_pdf')}</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={showAddQuestion} animationType="slide" transparent onRequestClose={() => setShowAddQuestion(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.addQModal}>
            <Text style={styles.addQModalTitle}>{t('food_report.add_question')}</Text>
            <TextInput
              style={styles.addQInput}
              value={newQuestion}
              onChangeText={setNewQuestion}
              placeholder={t('food_report.question_placeholder')}
              placeholderTextColor={Colors.textTertiary}
              multiline
              autoFocus
            />
            <View style={styles.addQActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAddQuestion(false)}>
                <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.confirmBtn, !newQuestion.trim() && { opacity: 0.4 }]} onPress={addQuestion} disabled={!newQuestion.trim()}>
                <Text style={styles.confirmBtnText}>{t('common.add')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showPdfModal} animationType="fade" transparent onRequestClose={() => setShowPdfModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowPdfModal(false)}>
          <View style={styles.modalBox}>
            <Text style={styles.modalEmoji}>📄</Text>
            <Text style={styles.modalTitle}>{t('food_report.pdf_title')}</Text>
            <Text style={styles.modalText}>{t('food_report.pdf_soon')}</Text>
            <TouchableOpacity style={styles.modalBtn} onPress={() => setShowPdfModal(false)}>
              <Text style={styles.modalBtnText}>{t('common.understood')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.dataRow}>
      <Text style={styles.dataLabel}>{label}</Text>
      <Text style={styles.dataValue}>{value}</Text>
    </View>
  );
}

function ReactionBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const isOk = status === 'none';
  return (
    <View style={[styles.reactionBadge, { backgroundColor: (isOk ? Colors.success : Colors.error) + '20' }]}>
      <Text style={[styles.reactionBadgeText, { color: isOk ? Colors.success : Colors.error }]}>
        {t(`food_list.reaction_${status}`, { defaultValue: status })}
      </Text>
    </View>
  );
}

function AlertBox({ text }: { text: string }) {
  return (
    <View style={styles.alertBox}>
      <Text style={styles.alertText}>⚠️ {text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  backBtn: { width: 40, height: 40, borderRadius: BorderRadius.full, backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center', ...Shadow.sm },
  backIcon: { fontSize: 18, color: Colors.textPrimary },
  headerTitle: { flex: 1, fontFamily: 'Fraunces', fontSize: 18, color: Colors.textPrimary, textAlign: 'center' },
  headerRight: { width: 40 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: Spacing['3xl'] },
  introCard: { margin: Spacing.lg, backgroundColor: Colors.feeding + '12', borderRadius: BorderRadius['2xl'], padding: Spacing.xl, alignItems: 'center', borderWidth: 1, borderColor: Colors.feeding + '30' },
  introEmoji: { fontSize: 48, marginBottom: Spacing.sm },
  introTitle: { fontFamily: 'Fraunces', fontSize: 22, color: Colors.textPrimary, marginBottom: Spacing.xs },
  introDate: { fontFamily: 'Geist', fontSize: 13, color: Colors.textTertiary, marginBottom: Spacing.md },
  introDesc: { fontFamily: 'Geist', fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  sectionCard: { marginHorizontal: Spacing.lg, marginBottom: Spacing.md, backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.lg, ...Shadow.sm },
  sectionTitle: { fontFamily: 'Fraunces', fontSize: 17, color: Colors.textPrimary, marginBottom: Spacing.md },
  emptyText: { fontFamily: 'Geist', fontSize: 14, color: Colors.textTertiary, fontStyle: 'italic' },
  dataRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: Spacing.lg },
  dataLabel: { fontFamily: 'Geist', fontSize: 14, color: Colors.textSecondary },
  dataValue: { fontFamily: 'Geist-SemiBold', fontSize: 14, color: Colors.textPrimary, flex: 1, textAlign: 'right' },
  foodRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: Spacing.sm },
  foodRowLeft: { flex: 1 },
  foodCategory: { fontFamily: 'Geist', fontSize: 11, color: Colors.textTertiary, marginBottom: 2 },
  foodName: { fontFamily: 'Geist-SemiBold', fontSize: 14, color: Colors.textPrimary },
  foodDate: { fontFamily: 'Geist', fontSize: 12, color: Colors.textTertiary },
  reactionBadge: { borderRadius: BorderRadius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 3, flexShrink: 0 },
  reactionBadgeText: { fontFamily: 'Geist-SemiBold', fontSize: 11 },
  allergenRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: Spacing.sm },
  allergenName: { fontFamily: 'Geist-SemiBold', fontSize: 14, color: Colors.textPrimary, flex: 1 },
  alertBox: { marginTop: Spacing.md, borderRadius: BorderRadius.lg, padding: Spacing.md, backgroundColor: Colors.error + '12' },
  alertText: { fontFamily: 'Geist-SemiBold', fontSize: 13, lineHeight: 20, color: Colors.error },
  reactionCard: { backgroundColor: Colors.backgroundSoft, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.sm },
  reactionCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xs, gap: Spacing.sm },
  reactionFoodName: { fontFamily: 'Geist-Bold', fontSize: 14, color: Colors.textPrimary, flex: 1 },
  severityBadge: { borderRadius: BorderRadius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 3 },
  severityText: { fontFamily: 'Geist-SemiBold', fontSize: 11 },
  reactionDate: { fontFamily: 'Geist', fontSize: 12, color: Colors.textTertiary, marginBottom: Spacing.xs },
  reactionSymptoms: { fontFamily: 'Geist', fontSize: 13, color: Colors.textSecondary, marginBottom: Spacing.xs },
  doctorContacted: { fontFamily: 'Geist-SemiBold', fontSize: 12, color: Colors.success },
  reactionNotes: { fontFamily: 'Geist', fontSize: 12, color: Colors.textSecondary, marginTop: 2, fontStyle: 'italic' },
  questionsCard: { marginHorizontal: Spacing.lg, marginBottom: Spacing.md, backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.lg, ...Shadow.sm, borderLeftWidth: 4, borderLeftColor: Colors.feeding },
  questionsTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xs },
  questionsTitle: { fontFamily: 'Fraunces', fontSize: 17, color: Colors.textPrimary },
  addQBtn: { backgroundColor: Colors.feeding + '20', paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: BorderRadius.full },
  addQBtnText: { fontFamily: 'Geist-SemiBold', fontSize: 13, color: Colors.feeding },
  questionsSubtitle: { fontFamily: 'Geist', fontSize: 13, color: Colors.textSecondary, marginBottom: Spacing.md },
  questionRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm, alignItems: 'flex-start' },
  questionNumber: { fontFamily: 'Geist-Bold', fontSize: 14, color: Colors.textTertiary, width: 22 },
  questionText: { fontFamily: 'Geist', fontSize: 14, color: Colors.textPrimary, flex: 1, lineHeight: 20 },
  pdfBtn: { marginHorizontal: Spacing.lg, backgroundColor: Colors.feeding, borderRadius: BorderRadius.xl, paddingVertical: Spacing.lg, alignItems: 'center', marginBottom: Spacing.md, ...Shadow.sm },
  pdfBtnText: { fontFamily: 'Geist-Bold', fontSize: 16, color: Colors.white },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  addQModal: { backgroundColor: Colors.white, borderRadius: BorderRadius['2xl'], padding: Spacing.xl, marginHorizontal: Spacing.xl, marginBottom: Spacing.xl, ...Shadow.md },
  addQModalTitle: { fontFamily: 'Fraunces', fontSize: 20, color: Colors.textPrimary, marginBottom: Spacing.lg },
  addQInput: { backgroundColor: Colors.backgroundSoft, borderRadius: BorderRadius.xl, padding: Spacing.md, fontSize: 15, fontFamily: 'Geist', color: Colors.textPrimary, minHeight: 80, textAlignVertical: 'top', marginBottom: Spacing.lg },
  addQActions: { flexDirection: 'row', gap: Spacing.md },
  cancelBtn: { flex: 1, paddingVertical: Spacing.md, borderRadius: BorderRadius.xl, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  cancelBtnText: { fontFamily: 'Geist-SemiBold', fontSize: 15, color: Colors.textSecondary },
  confirmBtn: { flex: 1, paddingVertical: Spacing.md, borderRadius: BorderRadius.xl, backgroundColor: Colors.feeding, alignItems: 'center' },
  confirmBtnText: { fontFamily: 'Geist-SemiBold', fontSize: 15, color: Colors.white },
  modalBox: { backgroundColor: Colors.white, borderRadius: BorderRadius['2xl'], padding: Spacing['2xl'], width: '85%', alignItems: 'center', ...Shadow.md },
  modalEmoji: { fontSize: 48, marginBottom: Spacing.md },
  modalTitle: { fontFamily: 'Fraunces', fontSize: 22, color: Colors.textPrimary, marginBottom: Spacing.md },
  modalText: { fontFamily: 'Geist', fontSize: 15, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: Spacing.xl },
  modalBtn: { backgroundColor: Colors.feeding, borderRadius: BorderRadius.xl, paddingHorizontal: Spacing['2xl'], paddingVertical: Spacing.md },
  modalBtnText: { fontFamily: 'Geist-Bold', fontSize: 15, color: Colors.white },
});
