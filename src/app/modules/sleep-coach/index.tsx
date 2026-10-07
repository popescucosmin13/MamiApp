import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useChildStore } from '../../../stores/childStore';
import { getGuidelineForAge } from '../../../services/sleepEngine';
import { Colors } from '../../../theme/colors';
import { Spacing, BorderRadius, Shadow } from '../../../theme/spacing';

const SLEEP_METHODS = [
  {
    nameRo: 'Metoda Ferber (extincție graduală)',
    nameEn: 'Ferber method (gradual extinction)',
    icon: 'M',
    descriptionRo: 'Lăsați copilul să plângă la intervale crescânde (5-10-15 min) înainte de a interveni.',
    descriptionEn: 'You check on the child at increasing intervals (5-10-15 min) before intervening.',
    ageRangeRo: '6+ luni',
    ageRangeEn: '6+ months',
    prosRo: ['Eficient în 1-2 săptămâni', 'Copilul învață să adoarmă singur'],
    prosEn: ['Often effective in 1-2 weeks', 'The child learns to fall asleep independently'],
    consRo: ['Poate fi stresant pentru părinți', 'Nu pentru toți copiii'],
    consEn: ['Can be stressful for parents', 'Not suitable for every child'],
  },
  {
    nameRo: 'Metoda No-Cry (fără plâns)',
    nameEn: 'No-Cry method',
    icon: 'N',
    descriptionRo: 'Însoțiți copilul în procesul de adormire, reducând treptat intervenția.',
    descriptionEn: 'You support the child while falling asleep and gradually reduce your help.',
    ageRangeRo: 'Orice vârstă',
    ageRangeEn: 'Any age',
    prosRo: ['Fără plâns', 'Construiește securitate'],
    prosEn: ['No crying approach', 'Builds security'],
    consRo: ['Mai lent (4-8 săptămâni)', 'Necesită consecvență'],
    consEn: ['Slower (4-8 weeks)', 'Requires consistency'],
  },
  {
    nameRo: 'Metoda Fading (scaunul)',
    nameEn: 'Fading method (chair method)',
    icon: 'F',
    descriptionRo: 'Stați lângă copil, mișcând scaunul mai departe în fiecare noapte.',
    descriptionEn: 'You sit near the child and move the chair farther away each night.',
    ageRangeRo: '6+ luni',
    ageRangeEn: '6+ months',
    prosRo: ['Echilibru între metodele extreme', 'Mai puțin plâns ca Ferber'],
    prosEn: ['Balanced between extremes', 'Usually less crying than Ferber'],
    consRo: ['Durează 2-4 săptămâni', 'Copilul te vede și poate protesta'],
    consEn: ['Takes 2-4 weeks', 'The child sees you and may protest'],
  },
];

const SLEEP_TIPS = [
  { icon: 'R', titleRo: 'Rutina înainte de somn', titleEn: 'Bedtime routine', textRo: 'Baie caldă, carte, cântec, pat. Același ritual în fiecare seară la aceeași oră.', textEn: 'Warm bath, book, song, bed. Keep the same ritual every evening at the same time.' },
  { icon: 'T', titleRo: 'Temperatura camerei', titleEn: 'Room temperature', textRo: '18-20°C este ideală. Hainele de dormit se aleg în funcție de temperatură (TOG rating).', textEn: '18-20°C is ideal. Choose sleepwear according to room temperature (TOG rating).' },
  { icon: 'W', titleRo: 'Zgomot alb', titleEn: 'White noise', textRo: 'Sunetele constante maschează zgomotele bruște și pot calma copilul.', textEn: 'Constant background sounds can mask sudden noises and help the child settle.' },
  { icon: 'D', titleRo: 'Întuneric total', titleEn: 'Dark room', textRo: 'Perdelele blackout ajută. Lumina inhibă producția de melatonină.', textEn: 'Blackout curtains help. Light can inhibit melatonin production.' },
  { icon: 'W', titleRo: 'Ferestrele de somn', titleEn: 'Wake windows', textRo: 'Respectați semnele de oboseală. Un copil prea obosit adoarme mai greu.', textEn: 'Watch tiredness cues. An overtired child often falls asleep harder.' },
];

const GUIDELINE_NOTES: Record<string, { ro: string; en: string }> = {
  '0_3_months': {
    ro: 'Somnul este extrem de variabil în primele 3 luni. Nu există un program fix.',
    en: 'Sleep is highly variable in the first 3 months. There is no fixed schedule.',
  },
  '4_6_months': {
    ro: 'Ritmul circadian începe să se consolideze. 3-4 somnuri de zi obișnuite.',
    en: 'Circadian rhythm starts to consolidate. 3-4 daytime naps are common.',
  },
  '6_9_months': {
    ro: 'Mulți copii au 2-3 somnuri de zi. Somnul de noapte se consolidează.',
    en: 'Many children have 2-3 daytime naps. Night sleep becomes more consolidated.',
  },
  '9_12_months': {
    ro: 'De obicei 2 somnuri de zi. Unii copii încep tranziția la un somn.',
    en: 'Usually 2 daytime naps. Some children start transitioning to one nap.',
  },
  '12_18_months': {
    ro: 'Tranziție de la 2 la 1 somn de zi. Variabilitate mare individuală.',
    en: 'Transition from 2 naps to 1 daytime nap. Individual variability is high.',
  },
  '18_36_months': {
    ro: 'De obicei un singur somn de zi. Somnul nocturn dominant.',
    en: 'Usually one daytime nap. Night sleep becomes dominant.',
  },
  '3_5_years': {
    ro: 'Mulți copii renunță la somnul de zi. Somnul nocturn este prioritar.',
    en: 'Many children stop daytime naps. Night sleep is the priority.',
  },
};

export default function SleepCoachScreen() {
  const router = useRouter();
  const { i18n } = useTranslation();
  const isEnglish = i18n.language === 'en';
  const { activeChild, sleeps } = useChildStore();

  const ageDays = activeChild?.birthDate
    ? Math.floor((Date.now() - activeChild.birthDate.toDate().getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  const recommendation = getGuidelineForAge(ageDays);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Sleep Coach 🌙</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Recommendation Card */}
        {recommendation ? (
          <View style={[styles.recCard, { backgroundColor: Colors.sleep + '15' }]}>
            <Text style={styles.recTitle}>{isEnglish ? 'Recommended sleep' : 'Somn recomandat'} ({recommendation.sourceName})</Text>
            <View style={styles.recStats}>
              <View style={styles.recStat}>
                <Text style={[styles.recValue, { color: Colors.sleep }]}>
                  {recommendation.totalSleepMinHours}–{recommendation.totalSleepMaxHours}h
                </Text>
                <Text style={styles.recLabel}>{isEnglish ? 'total/day' : 'total/zi'}</Text>
              </View>
              <View style={styles.recStat}>
                <Text style={[styles.recValue, { color: Colors.sleep }]}>
                  {recommendation.napsMin !== undefined && recommendation.napsMax !== undefined 
                    ? `${recommendation.napsMin}–${recommendation.napsMax}` 
                    : recommendation.napsMax !== undefined 
                      ? recommendation.napsMax 
                      : '-'}
                </Text>
                <Text style={styles.recLabel}>{isEnglish ? 'day naps' : 'somnuri zi'}</Text>
              </View>
              <View style={styles.recStat}>
                <Text style={[styles.recValue, { color: Colors.sleep }]}>
                  {recommendation.wakeWindowMinMinutes && recommendation.wakeWindowMaxMinutes
                    ? `${Math.round(recommendation.wakeWindowMinMinutes / 60)}–${Math.round(recommendation.wakeWindowMaxMinutes / 60)}h`
                    : '-'}
                </Text>
                <Text style={styles.recLabel}>{isEnglish ? 'wake window' : 'fereastră veghe'}</Text>
              </View>
            </View>
            <Text style={{fontSize: 12, color: Colors.textSecondary, marginTop: 16, textAlign: 'center'}}>
              {GUIDELINE_NOTES[recommendation.id]?.[isEnglish ? 'en' : 'ro'] ?? recommendation.note}
            </Text>
          </View>
        ) : null}

        {/* Tips */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{isEnglish ? 'Tips for better sleep' : 'Sfaturi pentru un somn mai bun'}</Text>
          {SLEEP_TIPS.map((tip, i) => (
            <View key={i} style={styles.tipCard}>
              <Text style={styles.tipEmoji}>{tip.icon}</Text>
              <View style={styles.tipContent}>
                <Text style={styles.tipTitle}>{isEnglish ? tip.titleEn : tip.titleRo}</Text>
                <Text style={styles.tipText}>{isEnglish ? tip.textEn : tip.textRo}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Sleep Methods */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{isEnglish ? 'Sleep training methods' : 'Metode de antrenament somn'}</Text>
          {SLEEP_METHODS.map((method, i) => (
            <View key={i} style={styles.methodCard}>
              <View style={styles.methodHeader}>
                <Text style={styles.methodEmoji}>{method.icon}</Text>
                <View style={styles.methodInfo}>
                  <Text style={styles.methodName}>{isEnglish ? method.nameEn : method.nameRo}</Text>
                  <Text style={styles.methodAge}>{isEnglish ? method.ageRangeEn : method.ageRangeRo}</Text>
                </View>
              </View>
              <Text style={styles.methodDesc}>{isEnglish ? method.descriptionEn : method.descriptionRo}</Text>
              <View style={styles.prosConsRow}>
                <View style={styles.prosCons}>
                  <Text style={styles.prosLabel}>Pro</Text>
                  {(isEnglish ? method.prosEn : method.prosRo).map((p, j) => <Text key={j} style={styles.prosText}>• {p}</Text>)}
                </View>
                <View style={styles.prosCons}>
                  <Text style={styles.consLabel}>{isEnglish ? 'Cons' : 'Contra'}</Text>
                  {(isEnglish ? method.consEn : method.consRo).map((c, j) => <Text key={j} style={styles.consText}>• {c}</Text>)}
                </View>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {isEnglish
              ? 'There is no universal method. Choose what fits your family and stay consistent.'
              : 'Nu există o metodă universală. Alegeți ce se potrivește familiei voastre și fiți consecvenți.'}
          </Text>
        </View>
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
  recCard: { margin: Spacing.xl, borderRadius: BorderRadius.xl, padding: Spacing.xl },
  recTitle: { fontSize: 14, fontFamily: 'Geist-SemiBold', color: Colors.textSecondary, marginBottom: Spacing.lg },
  recStats: { flexDirection: 'row', justifyContent: 'space-around' },
  recStat: { alignItems: 'center' },
  recValue: { fontSize: 22, fontFamily: 'Geist-Bold' },
  recLabel: { fontSize: 11, fontFamily: 'Geist', color: Colors.textSecondary },
  section: { paddingHorizontal: Spacing.xl, marginBottom: Spacing.xl },
  sectionTitle: { fontSize: 16, fontFamily: 'Geist-SemiBold', color: Colors.textPrimary, marginBottom: Spacing.md },
  tipCard: {
    flexDirection: 'row', gap: Spacing.md, backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl, padding: Spacing.lg, marginBottom: Spacing.sm, ...Shadow.sm,
  },
  tipEmoji: { fontSize: 24 },
  tipContent: { flex: 1 },
  tipTitle: { fontSize: 14, fontFamily: 'Geist-SemiBold', color: Colors.textPrimary, marginBottom: Spacing.xs },
  tipText: { fontSize: 13, fontFamily: 'Geist', color: Colors.textSecondary, lineHeight: 19 },
  methodCard: {
    backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.xl,
    marginBottom: Spacing.md, ...Shadow.sm,
  },
  methodHeader: { flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start', marginBottom: Spacing.md },
  methodEmoji: { fontSize: 28 },
  methodInfo: { flex: 1 },
  methodName: { fontSize: 15, fontFamily: 'Geist-SemiBold', color: Colors.textPrimary },
  methodAge: { fontSize: 12, fontFamily: 'Geist', color: Colors.textTertiary },
  methodDesc: { fontSize: 14, fontFamily: 'Geist', color: Colors.textSecondary, lineHeight: 20, marginBottom: Spacing.md },
  prosConsRow: { flexDirection: 'row', gap: Spacing.md },
  prosCons: { flex: 1 },
  prosLabel: { fontSize: 13, fontFamily: 'Geist-SemiBold', color: Colors.success, marginBottom: Spacing.xs },
  consLabel: { fontSize: 13, fontFamily: 'Geist-SemiBold', color: Colors.error, marginBottom: Spacing.xs },
  prosText: { fontSize: 12, fontFamily: 'Geist', color: Colors.textSecondary, lineHeight: 18 },
  consText: { fontSize: 12, fontFamily: 'Geist', color: Colors.textSecondary, lineHeight: 18 },
  footer: {
    marginHorizontal: Spacing.xl, marginBottom: Spacing['2xl'],
    backgroundColor: Colors.sleep + '15', borderRadius: BorderRadius.xl, padding: Spacing.lg,
  },
  footerText: { fontSize: 13, fontFamily: 'Geist', color: Colors.sleep, lineHeight: 19, textAlign: 'center' },
});
