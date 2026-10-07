import { useMemo, useState } from 'react';
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
import { Colors } from '../../../theme/colors';
import { Spacing, BorderRadius, Shadow } from '../../../theme/spacing';

type TabKey = 'nutrients' | 'avoid' | 'plan';
type Language = 'ro' | 'en';

const TEXT = {
  ro: {
    title: 'Nutriție',
    tabs: {
      nutrients: 'Nutrienți',
      avoid: 'De evitat',
      plan: 'Plan mese',
    },
    introTitle: 'Nutrienți esențiali în sarcină',
    introText:
      'O alimentație echilibrată în sarcină susține dezvoltarea optimă a fătului și sănătatea mamei. Discutați cu medicul despre suplimentele potrivite pentru dumneavoastră.',
    sources: 'Surse:',
    avoidTitle: 'Alimente de evitat',
    avoidText:
      'Anumite alimente prezintă risc de infecții sau conțin substanțe dăunătoare fătului. Consultați medicul pentru liste complete.',
    priorities: 'Priorități nutriționale:',
    hydrationTitle: 'Hidratare',
    hydrationText:
      'Beți 8-10 pahare de apă pe zi (2-2.5 litri). Hidratarea previne contracțiile premature, constipația și infecțiile urinare frecvente în sarcină.',
    nutrients: [
      { name: 'Acid folic', amount: '400-800 mcg/zi', icon: 'F', importance: 'Previne defecte de tub neural', sources: 'Legume verzi, leguminoase, cereale fortifiate' },
      { name: 'Fier', amount: '27 mg/zi', icon: 'Fe', importance: 'Transportul oxigenului la făt', sources: 'Carne roșie, fasole, spanac, linte' },
      { name: 'Calciu', amount: '1000 mg/zi', icon: 'Ca', importance: 'Dezvoltarea oaselor și dinților', sources: 'Lactate, broccoli, migdale, sardine' },
      { name: 'Vitamina D', amount: '600 IU/zi', icon: 'D', importance: 'Absorbția calciului, imunitate', sources: 'Pești grași, ouă, lapte fortifiat, soare' },
      { name: 'Omega-3 DHA', amount: '200-300 mg/zi', icon: 'DHA', importance: 'Dezvoltarea creierului și ochilor', sources: 'Somon, sardine, semințe chia, nuci' },
      { name: 'Iod', amount: '220 mcg/zi', icon: 'I', importance: 'Funcția tiroidiană, creierul fătului', sources: 'Pește, sare iodată, lactate, alge' },
      { name: 'Proteine', amount: '71 g/zi', icon: 'P', importance: 'Creșterea țesuturilor și a placentei', sources: 'Carne, ouă, lactate, leguminoase, tofu' },
    ],
    avoidFoods: [
      { icon: 'Hg', item: 'Pești cu mercur mare', detail: 'Ton albacor, pește spadă, macrou regal, rechin' },
      { icon: 'M', item: 'Carne crudă sau incomplet gătită', detail: 'Risc de toxoplasmoză și salmonella' },
      { icon: 'L', item: 'Brânzeturi moi nematurate', detail: 'Brie, camembert, feta nepasteurizată (listeria)' },
      { icon: 'E', item: 'Ouă crude sau moi', detail: 'Salmonella. Gătiți bine ouăle.' },
      { icon: '0%', item: 'Alcool', detail: 'Nu există doză sigură în sarcină' },
      { icon: 'Caf', item: 'Cafeină în exces', detail: 'Maxim 200 mg/zi (1-2 cafele mici)' },
      { icon: 'Herb', item: 'Plante medicinale neverificate', detail: 'Consultați medicul înainte de orice supliment' },
      { icon: 'Wash', item: 'Salate spălate insuficient', detail: 'Risc de listeria și toxoplasmoză' },
    ],
    mealPlan: [
      {
        trimester: 'Trimestrul 1 (săpt. 1-13)',
        color: Colors.pregnancy.primary,
        calories: '+0-100 kcal',
        tip: 'Grețurile matinale sunt frecvente. Mâncați mese mici și frecvente.',
        foods: ['Biscuiți simpli pentru grețuri', 'Ghimbir natural', 'Proteine ușoare', 'Citrice pentru vitamina C', 'Acid folic esențial'],
      },
      {
        trimester: 'Trimestrul 2 (săpt. 14-27)',
        color: Colors.warning,
        calories: '+340 kcal',
        tip: 'Pofta revine. Concentrați-vă pe nutrienți, nu calorii goale.',
        foods: ['Proteine la fiecare masă', 'Calciu - 4 porții lactate', 'Fier din carne slabă', 'Fructe și legume variate', 'Cereale integrale'],
      },
      {
        trimester: 'Trimestrul 3 (săpt. 28-40)',
        color: Colors.coral,
        calories: '+450 kcal',
        tip: 'Fătul crește rapid. Alegeți mese mici din cauza presiunii pe stomac.',
        foods: ['DHA pentru creierul fătului', 'Calciu intensificat', 'Fibre pentru constipație', 'Apă - 2-3 litri/zi', 'Vitamina K pentru coagulare'],
      },
    ],
  },
  en: {
    title: 'Nutrition',
    tabs: {
      nutrients: 'Nutrients',
      avoid: 'Avoid',
      plan: 'Meal plan',
    },
    introTitle: 'Essential nutrients in pregnancy',
    introText:
      'A balanced diet during pregnancy supports healthy fetal development and maternal wellbeing. Talk to your doctor about the supplements that are right for you.',
    sources: 'Sources:',
    avoidTitle: 'Foods to avoid',
    avoidText:
      'Some foods carry infection risks or contain substances that may harm the fetus. Ask your doctor for a complete personalized list.',
    priorities: 'Nutrition priorities:',
    hydrationTitle: 'Hydration',
    hydrationText:
      'Drink 8-10 glasses of water per day (2-2.5 liters). Good hydration helps prevent premature contractions, constipation and urinary infections during pregnancy.',
    nutrients: [
      { name: 'Folic acid', amount: '400-800 mcg/day', icon: 'F', importance: 'Helps prevent neural tube defects', sources: 'Leafy greens, legumes, fortified cereals' },
      { name: 'Iron', amount: '27 mg/day', icon: 'Fe', importance: 'Carries oxygen to the fetus', sources: 'Red meat, beans, spinach, lentils' },
      { name: 'Calcium', amount: '1000 mg/day', icon: 'Ca', importance: 'Supports bone and tooth development', sources: 'Dairy, broccoli, almonds, sardines' },
      { name: 'Vitamin D', amount: '600 IU/day', icon: 'D', importance: 'Calcium absorption and immunity', sources: 'Fatty fish, eggs, fortified milk, sunlight' },
      { name: 'Omega-3 DHA', amount: '200-300 mg/day', icon: 'DHA', importance: 'Supports brain and eye development', sources: 'Salmon, sardines, chia seeds, walnuts' },
      { name: 'Iodine', amount: '220 mcg/day', icon: 'I', importance: 'Thyroid function and fetal brain development', sources: 'Fish, iodized salt, dairy, seaweed' },
      { name: 'Protein', amount: '71 g/day', icon: 'P', importance: 'Supports tissue and placenta growth', sources: 'Meat, eggs, dairy, legumes, tofu' },
    ],
    avoidFoods: [
      { icon: 'Hg', item: 'High-mercury fish', detail: 'Albacore tuna, swordfish, king mackerel, shark' },
      { icon: 'M', item: 'Raw or undercooked meat', detail: 'Risk of toxoplasmosis and salmonella' },
      { icon: 'L', item: 'Unpasteurized soft cheeses', detail: 'Brie, camembert, unpasteurized feta (listeria risk)' },
      { icon: 'E', item: 'Raw or soft eggs', detail: 'Salmonella risk. Cook eggs thoroughly.' },
      { icon: '0%', item: 'Alcohol', detail: 'There is no known safe amount during pregnancy' },
      { icon: 'Caf', item: 'Excess caffeine', detail: 'Maximum 200 mg/day (1-2 small coffees)' },
      { icon: 'Herb', item: 'Unverified herbal remedies', detail: 'Ask your doctor before taking any supplement' },
      { icon: 'Wash', item: 'Poorly washed salads', detail: 'Risk of listeria and toxoplasmosis' },
    ],
    mealPlan: [
      {
        trimester: 'Trimester 1 (weeks 1-13)',
        color: Colors.pregnancy.primary,
        calories: '+0-100 kcal',
        tip: 'Morning sickness is common. Eat small, frequent meals.',
        foods: ['Plain crackers for nausea', 'Natural ginger', 'Light proteins', 'Citrus for vitamin C', 'Essential folic acid'],
      },
      {
        trimester: 'Trimester 2 (weeks 14-27)',
        color: Colors.warning,
        calories: '+340 kcal',
        tip: 'Appetite often returns. Focus on nutrients, not empty calories.',
        foods: ['Protein with every meal', 'Calcium - 4 dairy servings', 'Iron from lean meat', 'Varied fruits and vegetables', 'Whole grains'],
      },
      {
        trimester: 'Trimester 3 (weeks 28-40)',
        color: Colors.coral,
        calories: '+450 kcal',
        tip: 'The fetus grows quickly. Smaller meals may feel better as the stomach has less room.',
        foods: ['DHA for fetal brain development', 'Extra calcium focus', 'Fiber for constipation', 'Water - 2-3 liters/day', 'Vitamin K for clotting'],
      },
    ],
  },
} as const;

export default function NutritionScreen() {
  const router = useRouter();
  const { i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabKey>('nutrients');
  const lang: Language = i18n.language === 'en' ? 'en' : 'ro';
  const copy = useMemo(() => TEXT[lang], [lang]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{copy.title}</Text>
        <View style={{ width: 32 }} />
      </View>

      <View style={styles.tabs}>
        {(['nutrients', 'avoid', 'plan'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {copy.tabs[tab]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {activeTab === 'nutrients' && (
          <View style={styles.section}>
            <View style={styles.introCard}>
              <Text style={styles.introTitle}>{copy.introTitle}</Text>
              <Text style={styles.introText}>{copy.introText}</Text>
            </View>

            {copy.nutrients.map((n) => (
              <View key={n.name} style={styles.nutrientCard}>
                <View style={styles.nutrientHeader}>
                  <View style={styles.iconBadge}>
                    <Text style={styles.iconText}>{n.icon}</Text>
                  </View>
                  <View style={styles.nutrientInfo}>
                    <Text style={styles.nutrientName}>{n.name}</Text>
                    <Text style={styles.nutrientAmount}>{n.amount}</Text>
                  </View>
                </View>
                <Text style={styles.nutrientImportance}>{n.importance}</Text>
                <View style={styles.sourcesRow}>
                  <Text style={styles.sourcesLabel}>{copy.sources} </Text>
                  <Text style={styles.sourcesText}>{n.sources}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {activeTab === 'avoid' && (
          <View style={styles.section}>
            <View style={[styles.introCard, styles.warningCard]}>
              <Text style={[styles.introTitle, { color: Colors.error }]}>{copy.avoidTitle}</Text>
              <Text style={styles.introText}>{copy.avoidText}</Text>
            </View>
            {copy.avoidFoods.map((f) => (
              <View key={f.item} style={styles.avoidCard}>
                <View style={[styles.iconBadge, styles.avoidIconBadge]}>
                  <Text style={[styles.iconText, styles.avoidIconText]}>{f.icon}</Text>
                </View>
                <View style={styles.avoidInfo}>
                  <Text style={styles.avoidItem}>{f.item}</Text>
                  <Text style={styles.avoidDetail}>{f.detail}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {activeTab === 'plan' && (
          <View style={styles.section}>
            {copy.mealPlan.map((plan) => (
              <View key={plan.trimester} style={styles.planCard}>
                <View style={[styles.planHeader, { backgroundColor: plan.color + '15' }]}>
                  <Text style={[styles.planTrimester, { color: plan.color }]}>{plan.trimester}</Text>
                  <View style={[styles.caloriesBadge, { backgroundColor: plan.color + '20' }]}>
                    <Text style={[styles.caloriesText, { color: plan.color }]}>{plan.calories}</Text>
                  </View>
                </View>
                <View style={styles.planBody}>
                  <Text style={styles.planTip}>{plan.tip}</Text>
                  <Text style={styles.planFoodsLabel}>{copy.priorities}</Text>
                  {plan.foods.map((food) => (
                    <View key={food} style={styles.planFood}>
                      <Text style={[styles.planFoodDot, { color: plan.color }]}>●</Text>
                      <Text style={styles.planFoodText}>{food}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}

            <View style={styles.hydrationCard}>
              <Text style={styles.hydrationTitle}>{copy.hydrationTitle}</Text>
              <Text style={styles.hydrationText}>{copy.hydrationText}</Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backArrow: { fontSize: 22, color: Colors.textPrimary },
  headerTitle: { fontSize: 18, fontFamily: 'Fraunces', color: Colors.textPrimary },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tab: {
    flex: 1,
    height: 36,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
  },
  tabActive: { backgroundColor: Colors.pregnancy.primary, borderColor: Colors.pregnancy.primary },
  tabText: { fontSize: 13, fontFamily: 'Geist', color: Colors.textSecondary },
  tabTextActive: { color: Colors.white, fontFamily: 'Geist-SemiBold' },
  section: { padding: Spacing.xl, gap: Spacing.md },
  introCard: {
    backgroundColor: Colors.pregnancy.primaryLight,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
  },
  warningCard: {
    backgroundColor: Colors.error + '10',
    borderColor: Colors.error + '30',
    borderWidth: 1,
  },
  introTitle: { fontSize: 15, fontFamily: 'Geist-SemiBold', color: Colors.textPrimary, marginBottom: Spacing.xs },
  introText: { fontSize: 13, fontFamily: 'Geist', color: Colors.textSecondary, lineHeight: 19 },
  nutrientCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    ...Shadow.sm,
  },
  nutrientHeader: { flexDirection: 'row', gap: Spacing.md, alignItems: 'center', marginBottom: Spacing.sm },
  iconBadge: {
    minWidth: 42,
    height: 42,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    backgroundColor: Colors.pregnancy.primary + '18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: { fontSize: 13, fontFamily: 'Geist-Bold', color: Colors.pregnancy.primary },
  nutrientInfo: { flex: 1 },
  nutrientName: { fontSize: 15, fontFamily: 'Geist-SemiBold', color: Colors.textPrimary },
  nutrientAmount: { fontSize: 12, fontFamily: 'Geist-SemiBold', color: Colors.pregnancy.primary },
  nutrientImportance: { fontSize: 13, fontFamily: 'Geist', color: Colors.textSecondary, lineHeight: 18, marginBottom: Spacing.xs },
  sourcesRow: { flexDirection: 'row', flexWrap: 'wrap' },
  sourcesLabel: { fontSize: 12, fontFamily: 'Geist-SemiBold', color: Colors.textTertiary },
  sourcesText: { fontSize: 12, fontFamily: 'Geist', color: Colors.textTertiary, flex: 1 },
  avoidCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    flexDirection: 'row',
    gap: Spacing.md,
    alignItems: 'flex-start',
    ...Shadow.sm,
  },
  avoidIconBadge: { backgroundColor: Colors.error + '12' },
  avoidIconText: { color: Colors.error },
  avoidInfo: { flex: 1 },
  avoidItem: { fontSize: 14, fontFamily: 'Geist-SemiBold', color: Colors.textPrimary, marginBottom: Spacing.xs },
  avoidDetail: { fontSize: 13, fontFamily: 'Geist', color: Colors.textSecondary, lineHeight: 18 },
  planCard: { backgroundColor: Colors.white, borderRadius: BorderRadius.xl, overflow: 'hidden', ...Shadow.sm },
  planHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: Spacing.sm },
  planTrimester: { fontSize: 14, fontFamily: 'Geist-SemiBold', flex: 1 },
  caloriesBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.full },
  caloriesText: { fontSize: 12, fontFamily: 'Geist-SemiBold' },
  planBody: { padding: Spacing.lg },
  planTip: { fontSize: 13, fontFamily: 'Geist', color: Colors.textSecondary, lineHeight: 18, marginBottom: Spacing.md },
  planFoodsLabel: { fontSize: 12, fontFamily: 'Geist-SemiBold', color: Colors.textTertiary, marginBottom: Spacing.sm },
  planFood: { flexDirection: 'row', gap: Spacing.sm, marginBottom: 4 },
  planFoodDot: { fontSize: 8, lineHeight: 20 },
  planFoodText: { fontSize: 13, fontFamily: 'Geist', color: Colors.textSecondary, flex: 1 },
  hydrationCard: {
    backgroundColor: Colors.info + '10',
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.info + '30',
  },
  hydrationTitle: { fontSize: 15, fontFamily: 'Geist-SemiBold', color: Colors.info, marginBottom: Spacing.sm },
  hydrationText: { fontSize: 13, fontFamily: 'Geist', color: Colors.textSecondary, lineHeight: 19 },
});
