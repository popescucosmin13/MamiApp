import { useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Toast from 'react-native-toast-message';
import { Colors } from '../../../theme/colors';
import { BorderRadius, Shadow, Spacing } from '../../../theme/spacing';
import { BreathingModal } from './BreathingModal';

type MoodValue = 1 | 2 | 3 | 4;

const MOODS: { emoji: string; key: string; value: MoodValue; color: string }[] = [
  { emoji: '😊', key: 'good', value: 4, color: Colors.success },
  { emoji: '🙂', key: 'ok', value: 3, color: Colors.info },
  { emoji: '😐', key: 'neutral', value: 2, color: Colors.warning },
  { emoji: '😔', key: 'hard', value: 1, color: Colors.error },
];

const BURNOUT_KEYS = [
  'exhausted',
  'overwhelmed',
  'irritable',
  'isolated',
  'self_needs',
];

const EXERCISE_KEYS = [
  { emoji: '🌬️', key: 'breathing_478', color: '#7C3AED' },
  { emoji: '⬛', key: 'box_breathing', color: '#7C3AED' },
  { emoji: '🧘', key: 'body_scan', color: '#059669' },
  { emoji: '🙏', key: 'gratitude', color: '#059669' },
  { emoji: '💗', key: 'affirmations', color: '#D88FA8' },
  { emoji: '🌱', key: 'grounding', color: '#DC2626' },
];

export default function WellbeingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'state' | 'exercises'>('state');
  const [selectedMood, setSelectedMood] = useState<MoodValue | null>(null);
  const [journal, setJournal] = useState('');
  const [burnoutAnswers, setBurnoutAnswers] = useState<number[]>(Array(BURNOUT_KEYS.length).fill(0));
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null);

  const burnoutScore = burnoutAnswers.reduce((sum, value) => sum + value, 0);
  const burnoutPct = burnoutScore / (BURNOUT_KEYS.length * 4);
  const burnoutLevel = useMemo(() => {
    if (burnoutPct < 0.33) return { label: t('wellbeing.level_low'), color: Colors.success };
    if (burnoutPct < 0.66) return { label: t('wellbeing.level_medium'), color: Colors.warning };
    return { label: t('wellbeing.level_high'), color: Colors.error };
  }, [burnoutPct, t]);

  const saveMood = () => {
    if (!selectedMood) {
      Toast.show({ type: 'error', text1: t('wellbeing.select_mood') });
      return;
    }
    Toast.show({ type: 'success', text1: t('wellbeing.mood_saved') });
  };

  const startExercise = (key: string) => {
    setSelectedExercise(key);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient colors={['#7C3AED', '#5B21B6']} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerTextWrap}>
            <Text style={styles.headerTitle}>{t('wellbeing.title')}</Text>
            <Text style={styles.headerSubtitle}>{t('wellbeing.subtitle')}</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'state' && styles.tabActive]}
            onPress={() => setActiveTab('state')}
          >
            <Text style={[styles.tabText, activeTab === 'state' && styles.tabTextActive]}>💗 {t('wellbeing.tab_state')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'exercises' && styles.tabActive]}
            onPress={() => setActiveTab('exercises')}
          >
            <Text style={[styles.tabText, activeTab === 'exercises' && styles.tabTextActive]}>🧘 {t('wellbeing.tab_exercises')}</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {activeTab === 'state' ? (
        <ScrollView style={styles.content} contentContainerStyle={styles.contentPad}>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t('wellbeing.how_feel')}</Text>
            <View style={styles.moodRow}>
              {MOODS.map((mood) => (
                <TouchableOpacity
                  key={mood.value}
                  style={[
                    styles.moodBtn,
                    selectedMood === mood.value && { borderColor: mood.color, backgroundColor: mood.color + '18' },
                  ]}
                  onPress={() => setSelectedMood(mood.value)}
                >
                  <Text style={styles.moodEmoji}>{mood.emoji}</Text>
                  <Text style={[styles.moodLabel, selectedMood === mood.value && { color: mood.color }]}>
                    {t(`wellbeing.mood_${mood.key}`)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t('wellbeing.notes_optional')}</Text>
            <TextInput
              style={styles.journalInput}
              multiline
              value={journal}
              onChangeText={setJournal}
              placeholder={t('wellbeing.notes_placeholder')}
              placeholderTextColor={Colors.textTertiary}
            />
          </View>

          <TouchableOpacity style={styles.saveBtn} onPress={saveMood}>
            <Text style={styles.saveBtnText}>{t('wellbeing.save_state')}</Text>
          </TouchableOpacity>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>🔎 {t('wellbeing.burnout_check')}</Text>
            {BURNOUT_KEYS.map((key, index) => (
              <View key={key} style={styles.burnoutQuestion}>
                <Text style={styles.questionText}>{t(`wellbeing.burnout_${key}`)}</Text>
                <View style={styles.scaleRow}>
                  {[0, 1, 2, 3, 4].map((value) => (
                    <TouchableOpacity
                      key={value}
                      style={[styles.scaleBtn, burnoutAnswers[index] === value && styles.scaleBtnActive]}
                      onPress={() => {
                        const next = [...burnoutAnswers];
                        next[index] = value;
                        setBurnoutAnswers(next);
                      }}
                    >
                      <Text style={[styles.scaleText, burnoutAnswers[index] === value && styles.scaleTextActive]}>
                        {value}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))}
            <View style={[styles.resultBox, { borderColor: burnoutLevel.color }]}>
              <Text style={styles.resultLabel}>{t('wellbeing.burnout_level')}</Text>
              <Text style={[styles.resultValue, { color: burnoutLevel.color }]}>{burnoutLevel.label}</Text>
            </View>
          </View>

          <View style={styles.ppdCard}>
            <Text style={styles.ppdTitle}>💙 {t('wellbeing.ppd_title')}</Text>
            <Text style={styles.ppdText}>{t('wellbeing.ppd_text')}</Text>
            <TouchableOpacity style={styles.ppdBtn}>
              <Text style={styles.ppdBtnText}>📞 0800 801 200</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : (
        <ScrollView style={styles.content} contentContainerStyle={styles.contentPad}>
          <Text style={styles.exercisesTitle}>{t('wellbeing.exercises_title')}</Text>
          <Text style={styles.exercisesSubtitle}>{t('wellbeing.exercises_subtitle')}</Text>
          <View style={styles.exerciseGrid}>
            {EXERCISE_KEYS.map((exercise) => (
              <TouchableOpacity
                key={exercise.key}
                style={styles.exerciseCard}
                onPress={() => startExercise(exercise.key)}
              >
                <View style={[styles.exerciseIcon, { backgroundColor: exercise.color + '18' }]}>
                  <Text style={styles.exerciseEmoji}>{exercise.emoji}</Text>
                </View>
                <Text style={styles.exerciseTitle}>{t(`wellbeing.exercise_${exercise.key}_title`)}</Text>
                <Text style={styles.exerciseBody}>{t(`wellbeing.exercise_${exercise.key}_short`)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}

      <BreathingModal exerciseKey={selectedExercise} onClose={() => setSelectedExercise(null)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingTop: Spacing.md, paddingBottom: Spacing.lg },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  backBtnText: { fontFamily: 'Geist-Bold', fontSize: 20, color: Colors.white },
  headerTextWrap: { flex: 1, alignItems: 'center' },
  headerTitle: { fontFamily: 'Fraunces', fontSize: 22, color: Colors.white },
  headerSubtitle: { fontFamily: 'Geist', fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  headerSpacer: { width: 40 },
  tabBar: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: BorderRadius.full, padding: 3 },
  tab: { flex: 1, paddingVertical: Spacing.sm, alignItems: 'center', borderRadius: BorderRadius.full },
  tabActive: { backgroundColor: Colors.white },
  tabText: { fontFamily: 'Geist-SemiBold', fontSize: 14, color: 'rgba(255,255,255,0.85)' },
  tabTextActive: { color: '#7C3AED' },
  content: { flex: 1 },
  contentPad: { padding: Spacing.lg, paddingBottom: Spacing['3xl'] },
  card: { backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.lg, marginBottom: Spacing.lg, ...Shadow.sm },
  sectionTitle: { fontFamily: 'Geist-SemiBold', fontSize: 16, color: Colors.textPrimary, marginBottom: Spacing.md },
  moodRow: { flexDirection: 'row', gap: Spacing.sm },
  moodBtn: { flex: 1, alignItems: 'center', paddingVertical: Spacing.md, borderRadius: BorderRadius.lg, backgroundColor: Colors.backgroundSoft, borderWidth: 2, borderColor: 'transparent' },
  moodEmoji: { fontSize: 28, marginBottom: Spacing.xs },
  moodLabel: { fontFamily: 'Geist', fontSize: 12, color: Colors.textSecondary },
  journalInput: { backgroundColor: Colors.backgroundSoft, borderRadius: BorderRadius.lg, padding: Spacing.md, fontFamily: 'Geist', fontSize: 15, color: Colors.textPrimary, minHeight: 110, textAlignVertical: 'top', borderWidth: 1, borderColor: Colors.border },
  saveBtn: { backgroundColor: '#7C3AED', borderRadius: BorderRadius.full, paddingVertical: Spacing.md, alignItems: 'center', marginBottom: Spacing.lg },
  saveBtnText: { fontFamily: 'Geist-Bold', fontSize: 16, color: Colors.white },
  burnoutQuestion: { marginBottom: Spacing.lg },
  questionText: { fontFamily: 'Geist', fontSize: 14, color: Colors.textPrimary, marginBottom: Spacing.sm },
  scaleRow: { flexDirection: 'row', gap: Spacing.sm },
  scaleBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.backgroundSoft, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },
  scaleBtnActive: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  scaleText: { fontFamily: 'Geist-SemiBold', fontSize: 14, color: Colors.textSecondary },
  scaleTextActive: { color: Colors.white },
  resultBox: { borderWidth: 1, borderRadius: BorderRadius.lg, padding: Spacing.md, backgroundColor: Colors.backgroundSoft },
  resultLabel: { fontFamily: 'Geist', fontSize: 13, color: Colors.textSecondary },
  resultValue: { fontFamily: 'Geist-Bold', fontSize: 18, marginTop: 4 },
  ppdCard: { backgroundColor: '#EFF6FF', borderRadius: BorderRadius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: '#BFDBFE' },
  ppdTitle: { fontFamily: 'Geist-Bold', fontSize: 16, color: '#1E40AF', marginBottom: Spacing.sm },
  ppdText: { fontFamily: 'Geist', fontSize: 14, color: '#1E3A8A', lineHeight: 20, marginBottom: Spacing.md },
  ppdBtn: { backgroundColor: '#1E40AF', borderRadius: BorderRadius.full, paddingVertical: Spacing.sm, alignItems: 'center' },
  ppdBtnText: { fontFamily: 'Geist-SemiBold', fontSize: 13, color: Colors.white },
  exercisesTitle: { fontFamily: 'Fraunces', fontSize: 22, color: Colors.textPrimary, marginBottom: 4 },
  exercisesSubtitle: { fontFamily: 'Geist', fontSize: 14, color: Colors.textSecondary, marginBottom: Spacing.lg },
  exerciseGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  exerciseCard: { width: '47%', backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.lg, ...Shadow.sm },
  exerciseIcon: { width: 44, height: 44, borderRadius: BorderRadius.lg, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md },
  exerciseEmoji: { fontSize: 24 },
  exerciseTitle: { fontFamily: 'Geist-SemiBold', fontSize: 14, color: Colors.textPrimary, marginBottom: 4 },
  exerciseBody: { fontFamily: 'Geist', fontSize: 12, color: Colors.textSecondary, lineHeight: 17 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  modalContent: { backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.xl, width: '100%', maxHeight: '80%', ...Shadow.md },
  modalTitle: { fontFamily: 'Fraunces', fontSize: 20, color: Colors.textPrimary, marginBottom: Spacing.lg, textAlign: 'center' },
  modalScroll: { marginBottom: Spacing.lg },
  modalBody: { fontFamily: 'Geist', fontSize: 15, color: Colors.textSecondary, lineHeight: 22 },
  modalCloseBtn: { backgroundColor: '#7C3AED', borderRadius: BorderRadius.full, paddingVertical: Spacing.md, alignItems: 'center' },
  modalCloseBtnText: { fontFamily: 'Geist-SemiBold', fontSize: 15, color: Colors.white },
});
