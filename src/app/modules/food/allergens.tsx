import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useFoodStore } from '../../../stores/foodStore';
import { IntroducedFood } from '../../../types/food';
import { Colors } from '../../../theme/colors';
import { Spacing, BorderRadius, Shadow } from '../../../theme/spacing';
import { translateHardcodedText } from '../../../i18n/runtimeText';

interface AllergenDef {
  key: string;
  name: string;
  emoji: string;
  description: string;
  keywords: string[]; // match against introduced food names
}

const MAJOR_ALLERGENS: AllergenDef[] = [
  {
    key: 'egg',
    name: 'Ou',
    emoji: '🥚',
    description: 'Introduce gălbenușul mai întâi (6 luni), albușul după 8 luni',
    keywords: ['ou', 'galbenus', 'gălbenuș', 'albus', 'albușul', 'egg'],
  },
  {
    key: 'milk',
    name: 'Lapte / Lactate',
    emoji: '🥛',
    description: 'Iaurt și brânză de la 6 luni; lapte de vacă ca băutură după 12 luni',
    keywords: ['lapte', 'iaurt', 'brânză', 'branza', 'lactat', 'caș', 'smântână', 'milk', 'dairy', 'cottage'],
  },
  {
    key: 'peanut',
    name: 'Arahide',
    emoji: '🥜',
    description: 'Introduceți devreme (ghid LEAP) sub formă de pastă fluidă diluată',
    keywords: ['arahide', 'arahidă', 'peanut', 'unt de arahide'],
  },
  {
    key: 'treenuts',
    name: 'Nuci de copac',
    emoji: '🌰',
    description: 'Migdale, caju, nuci, fistic - sub formă de pastă fluidă. Niciodată întregi!',
    keywords: ['nuci', 'nucă', 'migdale', 'migdală', 'caju', 'fistic', 'pecan', 'alune de pădure'],
  },
  {
    key: 'fish',
    name: 'Pește',
    emoji: '🐟',
    description: 'Recomandat de la 8 luni. Bogat în omega-3. Verificați oasele!',
    keywords: ['pește', 'peste', 'somon', 'cod', 'tilapia', 'dorada', 'ton', 'fish'],
  },
  {
    key: 'shellfish',
    name: 'Fructe de mare',
    emoji: '🦐',
    description: 'Creveți, midii, calmar - introduceți după 12 luni cu atenție maximă',
    keywords: ['fructe de mare', 'creveți', 'creveti', 'midii', 'calmar', 'homar', 'crab', 'shellfish'],
  },
  {
    key: 'wheat',
    name: 'Grâu / Gluten',
    emoji: '🌾',
    description: 'Introduce la 6 luni - nici prea devreme, nici prea târziu. Paste, pâine, griș',
    keywords: ['grâu', 'grau', 'gluten', 'pâine', 'paine', 'paste', 'griș', 'gris', 'biscuiți', 'wheat'],
  },
  {
    key: 'soy',
    name: 'Soia',
    emoji: '🫘',
    description: 'Tofu moale sau edamame piure. Urmăriți reacțiile digestive',
    keywords: ['soia', 'tofu', 'edamame', 'lapte de soia', 'soy'],
  },
  {
    key: 'sesame',
    name: 'Susan',
    emoji: '🌱',
    description: 'Pastă tahini diluată cu apă. Prezent în multe alimente procesate',
    keywords: ['susan', 'tahini', 'sesame'],
  },
  {
    key: 'celery',
    name: 'Țelină',
    emoji: '🥬',
    description: 'Frunze și rădăcină. Introduce cu atenție în supe și piure',
    keywords: ['țelină', 'telina', 'celery'],
  },
  {
    key: 'mustard',
    name: 'Muștar',
    emoji: '🌿',
    description: 'Semințe de muștar sau condiment. Rar folosit în alimentația bebelușilor',
    keywords: ['muștar', 'mustar', 'mustard'],
  },
  {
    key: 'lupin',
    name: 'Lupin',
    emoji: '🌻',
    description: 'Prezent în unele făinuri și produse de panificație. Rar, dar alergenic',
    keywords: ['lupin', 'lupine'],
  },
  {
    key: 'molluscs',
    name: 'Moluște',
    emoji: '🐚',
    description: 'Melci, caracatițe - introduceți după 12 luni, rar și monitorizat',
    keywords: ['moluște', 'moluste', 'caracatița', 'caracatita', 'melci', 'molluscs'],
  },
  {
    key: 'sulphites',
    name: 'Sulfiți',
    emoji: '🍇',
    description: 'Conservanți E220-E228. Prezenți în fructe uscate, oțet, vin. Evitați în primul an',
    keywords: ['sulfiți', 'sulfiti', 'dioxid de sulf', 'sulphites'],
  },
];

type AllergenStatus = 'not_introduced' | 'introduced_ok' | 'reaction' | 'avoid';

const STATUS_META: Record<AllergenStatus, { label: string; emoji: string; color: string; bg: string }> = {
  not_introduced: { label: 'Neintrodus', emoji: '⏳', color: Colors.textTertiary, bg: Colors.backgroundSoft },
  introduced_ok: { label: 'Introdus ? fără reacție', emoji: '✅', color: Colors.success, bg: Colors.success + '15' },
  reaction: { label: 'Reacție notată', emoji: '⚠️', color: Colors.error, bg: Colors.error + '15' },
  avoid: { label: 'De evitat', emoji: '🚫', color: Colors.warning, bg: Colors.warning + '20' },
};

const STATUS_LABEL_EN: Record<AllergenStatus, string> = {
  not_introduced: 'Not introduced',
  introduced_ok: 'Introduced, no reaction',
  reaction: 'Reaction noted',
  avoid: 'Avoid',
};

const ALLERGEN_NAME_EN: Record<string, string> = {
  egg: 'Egg',
  milk: 'Milk / Dairy',
  peanut: 'Peanuts',
  treenuts: 'Tree nuts',
  fish: 'Fish',
  shellfish: 'Shellfish',
  wheat: 'Wheat / Gluten',
  soy: 'Soy',
  sesame: 'Sesame',
  celery: 'Celery',
  mustard: 'Mustard',
  lupin: 'Lupin',
  molluscs: 'Molluscs',
  sulphites: 'Sulphites',
};

// Allergens not suitable before 12 months
const AVOID_UNDER_12 = ['shellfish', 'molluscs', 'sulphites'];

function getStatus(allergen: AllergenDef, introducedFoods: IntroducedFood[]): AllergenStatus {
  if (AVOID_UNDER_12.includes(allergen.key)) return 'avoid';
  const matched = introducedFoods.filter(f => {
    const nameLower = f.name.toLowerCase();
    return allergen.keywords.some(kw => nameLower.includes(kw));
  });
  if (matched.length === 0) return 'not_introduced';
  const hasReaction = matched.some(f => f.reactionStatus !== 'none' && f.reactionStatus !== 'unknown');
  if (hasReaction) return 'reaction';
  return 'introduced_ok';
}

export default function AllergensScreen() {
  const router = useRouter();
  const { i18n } = useTranslation();
  const isEnglish = i18n.language === 'en';
  const tx = (text: string) => isEnglish ? translateHardcodedText(text) : text;
  const { introducedFoods } = useFoodStore();

  const allergenStatuses = useMemo(
    () => MAJOR_ALLERGENS.map(a => ({ allergen: a, status: getStatus(a, introducedFoods) })),
    [introducedFoods],
  );

  const introducedCount = allergenStatuses.filter(a => a.status === 'introduced_ok' || a.status === 'reaction').length;
  const totalIntroducible = MAJOR_ALLERGENS.length - AVOID_UNDER_12.length;
  const progressPct = totalIntroducible > 0 ? (introducedCount / totalIntroducible) * 100 : 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEnglish ? 'Major allergens' : 'Alergeni majori'}</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Progress card */}
        <View style={styles.progressCard}>
          <View style={styles.progressRow}>
            <View>
              <Text style={styles.progressTitle}>{isEnglish ? 'Introduced allergens' : 'Alergeni introduși'}</Text>
              <Text style={styles.progressSubtitle}>{isEnglish ? `of ${totalIntroducible} recommended in the first year` : `din ${totalIntroducible} recomandați în primul an`}</Text>
            </View>
            <Text style={styles.progressCount}>{introducedCount}/{totalIntroducible}</Text>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${progressPct}%` as `${number}%` }]} />
          </View>
          <View style={styles.legendRow}>
            {(['introduced_ok', 'reaction', 'not_introduced', 'avoid'] as AllergenStatus[]).map(s => (
              <View key={s} style={styles.legendItem}>
                <Text style={styles.legendEmoji}>{STATUS_META[s].emoji}</Text>
                <Text style={styles.legendLabel}>{isEnglish ? STATUS_LABEL_EN[s] : STATUS_META[s].label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Guidance card */}
        <View style={styles.guidanceCard}>
          <Text style={styles.guidanceTitle}>{isEnglish ? 'Why introduce allergens early?' : 'De ce să introduci alergenii devreme?'}</Text>
          <Text style={styles.guidanceText}>
            {isEnglish
              ? 'Recent studies (LEAP, EAT) show that introducing major allergens early and repeatedly (6-12 months) can reduce allergy risk. Introduce each allergen separately, 3 days apart, and watch your baby for 2 hours after the first dose.'
              : 'Studii recente (LEAP, EAT) arată că introducerea alergenilor majori devreme și în mod repetat (6-12 luni) poate reduce riscul de alergie. Introdu fiecare alergen separat, la 3 zile distanță, și urmărește copilul 2 ore după prima doză.'}
          </Text>
          <View style={styles.guideSteps}>
            <Text style={styles.guideStep}>{isEnglish ? '1. Introduce one allergen at a time' : '1. Introdu câte un alergen pe rând'}</Text>
            <Text style={styles.guideStep}>{isEnglish ? '2. Wait 3 days before another new allergen' : '2. Așteaptă 3 zile înainte de alt alergen nou'}</Text>
            <Text style={styles.guideStep}>{isEnglish ? '3. First dose: morning, on a free day' : '3. Prima doză: dimineața, într-o zi liberă'}</Text>
            <Text style={styles.guideStep}>{isEnglish ? '4. Continue regular exposure (1-2x/week)' : '4. Continuă expunerea regulată (1-2x/săptămână)'}</Text>
          </View>
        </View>

        {/* Allergen list */}
        <Text style={styles.sectionLabel}>{isEnglish ? 'The 14 major allergens' : 'Lista celor 14 alergeni majori'}</Text>
        {allergenStatuses.map(({ allergen, status }) => {
          const meta = STATUS_META[status];
          return (
            <View key={allergen.key} style={[styles.allergenCard, { borderLeftColor: meta.color }]}>
              <View style={[styles.allergenIconBox, { backgroundColor: meta.bg }]}>
                <Text style={styles.allergenEmoji}>{allergen.emoji}</Text>
              </View>
              <View style={styles.allergenCenter}>
                <Text style={styles.allergenName}>{isEnglish ? (ALLERGEN_NAME_EN[allergen.key] ?? tx(allergen.name)) : allergen.name}</Text>
                <Text style={styles.allergenDesc}>{tx(allergen.description)}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
                <Text style={styles.statusEmoji}>{meta.emoji}</Text>
                <Text style={[styles.statusLabel, { color: meta.color }]} numberOfLines={2}>
                  {isEnglish ? STATUS_LABEL_EN[status] : meta.label}
                </Text>
              </View>
            </View>
          );
        })}

        {/* Safety warning */}
        <View style={styles.safetyCard}>
          <Text style={styles.safetyTitle}>{isEnglish ? 'Signs of an allergic reaction' : 'Semne de reacție alergică'}</Text>
          <Text style={styles.safetyText}>
            {isEnglish
              ? 'Watch for hives, swelling of lips/tongue, vomiting, wheezing, or unusual behavior. Mild symptoms (local redness, small rash): talk to your doctor. Severe symptoms (breathing difficulty, pallor): call 112 immediately.'
              : 'Urmareste urticarie, umflarea buzelor/limbii, varsaturi, wheezing sau comportament neobisnuit. Simptome usoare (roseata locala, eruptie mica): consulta medicul. Simptome severe (dificultati respiratorii, paloare): suna 112 imediat.'}
          </Text>
        </View>

        <View style={styles.bottomSpacing} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.sm,
  },
  backIcon: { fontSize: 18, color: Colors.textPrimary },
  headerTitle: {
    flex: 1,
    fontFamily: 'Fraunces',
    fontSize: 20,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  headerRight: { width: 40 },

  scroll: { flex: 1 },

  progressCard: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius['2xl'],
    padding: Spacing.lg,
    ...Shadow.sm,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  progressTitle: {
    fontFamily: 'Geist-Bold',
    fontSize: 16,
    color: Colors.textPrimary,
  },
  progressSubtitle: {
    fontFamily: 'Geist',
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  progressCount: {
    fontFamily: 'Fraunces',
    fontSize: 28,
    color: Colors.food,
  },
  progressBarBg: {
    height: 10,
    backgroundColor: Colors.backgroundSoft,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.food,
    borderRadius: BorderRadius.full,
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  legendEmoji: { fontSize: 14 },
  legendLabel: {
    fontFamily: 'Geist',
    fontSize: 11,
    color: Colors.textSecondary,
  },

  guidanceCard: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    backgroundColor: Colors.sleep + '15',
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.sleep + '30',
  },
  guidanceTitle: {
    fontFamily: 'Fraunces',
    fontSize: 16,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  guidanceText: {
    fontFamily: 'Geist',
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 21,
    marginBottom: Spacing.md,
  },
  guidanceBold: {
    fontFamily: 'Geist-Bold',
    color: Colors.textPrimary,
  },
  guideSteps: { gap: Spacing.sm },
  guideStep: {
    fontFamily: 'Geist-SemiBold',
    fontSize: 13,
    color: Colors.textPrimary,
  },

  sectionLabel: {
    fontFamily: 'Geist-SemiBold',
    fontSize: 13,
    color: Colors.textTertiary,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  allergenCard: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    padding: Spacing.md,
    alignItems: 'center',
    gap: Spacing.md,
    borderLeftWidth: 4,
    ...Shadow.sm,
  },
  allergenIconBox: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  allergenEmoji: { fontSize: 26 },
  allergenCenter: { flex: 1 },
  allergenName: {
    fontFamily: 'Geist-Bold',
    fontSize: 15,
    color: Colors.textPrimary,
    marginBottom: 3,
  },
  allergenDesc: {
    fontFamily: 'Geist',
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 17,
  },
  statusBadge: {
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    alignItems: 'center',
    maxWidth: 90,
    flexShrink: 0,
  },
  statusEmoji: { fontSize: 18, marginBottom: 2 },
  statusLabel: {
    fontFamily: 'Geist-SemiBold',
    fontSize: 10,
    textAlign: 'center',
  },

  safetyCard: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
    backgroundColor: Colors.error + '10',
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.error + '30',
  },
  safetyTitle: {
    fontFamily: 'Fraunces',
    fontSize: 16,
    color: Colors.error,
    marginBottom: Spacing.sm,
  },
  safetyText: {
    fontFamily: 'Geist',
    fontSize: 14,
    color: Colors.textPrimary,
    lineHeight: 21,
  },
  safetyBold: {
    fontFamily: 'Geist-Bold',
  },
  emergency: {
    fontFamily: 'Geist-Bold',
    color: Colors.error,
  },

  bottomSpacing: { height: Spacing['3xl'] },
});
