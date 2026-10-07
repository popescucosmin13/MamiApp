import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  FlatList,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Colors } from '../../../theme/colors';
import { Spacing, BorderRadius, Shadow } from '../../../theme/spacing';

interface Recipe {
  id: string;
  title: string;
  emoji: string;
  ageMonths: 6 | 7 | 8 | 9 | 10 | 12;
  method: 'puree' | 'blw' | 'mixed';
  prepTime: string;
  category: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  ingredients: string[];
  steps: string[];
  allergens: string[];
}

const RECIPES: Recipe[] = [
  {
    id: '1',
    title: 'Piure de morcov și cartof dulce',
    emoji: '🥕',
    ageMonths: 6,
    method: 'puree',
    prepTime: '20 min',
    category: 'lunch',
    ingredients: ['1 morcov mediu', '1/2 cartof dulce mic', 'Lapte matern sau formulă (opțional)'],
    steps: [
      'Curăță și taie morcovul și cartoful dulce în bucăți mici.',
      'Fierbe la abur 15–18 minute până devin moi.',
      'Blendează fin. Adaugă lapte matern pentru textura dorită.',
      'Răcește la temperatura camerei înainte de servire.',
    ],
    allergens: [],
  },
  {
    id: '2',
    title: 'Piure de avocado și banană',
    emoji: '🥑',
    ageMonths: 6,
    method: 'puree',
    prepTime: '5 min',
    category: 'breakfast',
    ingredients: ['1/2 avocado copt', '1/4 banană coaptă'],
    steps: [
      'Zdrobește avocado cu o furculiță până obții o pastă fină.',
      'Zdrobește banana și amestecă cu avocado.',
      'Servește imediat — avocado se oxidează rapid.',
    ],
    allergens: [],
  },
  {
    id: '3',
    title: 'Supă cremă de dovleac',
    emoji: '🎃',
    ageMonths: 6,
    method: 'puree',
    prepTime: '30 min',
    category: 'lunch',
    ingredients: ['200g dovleac curățat', '1 morcov mic', '1 cartof mic', 'Apă sau supă de legume fără sare'],
    steps: [
      'Taie toate legumele în cuburi mici.',
      'Fierbe în apă sau supă de legume 20 min.',
      'Blendează totul împreună cu puțin lichid de fierbere.',
      'Filtrează dacă dorești o textură extra fină.',
    ],
    allergens: [],
  },
  {
    id: '4',
    title: 'Piure de mazăre și pui',
    emoji: '🐓',
    ageMonths: 6,
    method: 'puree',
    prepTime: '25 min',
    category: 'lunch',
    ingredients: ['100g piept de pui fiert', '80g mazăre congelată', 'Apă de fierbere'],
    steps: [
      'Fierbe pieptul de pui până este complet gătit (20 min).',
      'Fierbe mazărea 5 min separat sau împreună cu puiul la final.',
      'Blendează totul cu puțin lichid de fierbere.',
      'Filtrează printr-o sită fină pentru textură perfectă la 6 luni.',
    ],
    allergens: [],
  },
  {
    id: '5',
    title: 'Porridge de ovăz cu măr',
    emoji: '🍎',
    ageMonths: 6,
    method: 'puree',
    prepTime: '15 min',
    category: 'breakfast',
    ingredients: ['3 linguri fulgi de ovăz fini', '1/2 măr mic', 'Apă sau lapte matern'],
    steps: [
      'Rade mărul fin sau fierbe-l la abur 5 min.',
      'Fierbe fulgii de ovăz în apă 5–7 min amestecând continuu.',
      'Amestecă cu mărul ras/piure.',
      'Adaugă lapte matern dacă dorești mai lichid.',
    ],
    allergens: [],
  },
  {
    id: '6',
    title: 'Piure de spanac cu cartof',
    emoji: '🥬',
    ageMonths: 6,
    method: 'puree',
    prepTime: '20 min',
    category: 'lunch',
    ingredients: ['50g spanac proaspăt', '1 cartof mediu', '1 linguriță ulei de măsline extra virgin'],
    steps: [
      'Fierbe cartoful în cuburi 15 min.',
      'Adaugă spanacul în ultimele 2 min.',
      'Blendează totul cu ulei de măsline.',
      'Servește la temperatura camerei.',
    ],
    allergens: [],
  },
  {
    id: '7',
    title: 'Piure de pere și prune',
    emoji: '🍐',
    ageMonths: 6,
    method: 'puree',
    prepTime: '15 min',
    category: 'snack',
    ingredients: ['1 pară coaptă', '2 prune (fără sâmburi)'],
    steps: [
      'Cojește pera și prunele.',
      'Fierbe la abur 8–10 min sau folosește fructe bine coapte crude.',
      'Blendează fin.',
      'Ideal dacă bebelușul are constipație — prunele sunt ușor laxative.',
    ],
    allergens: [],
  },
  {
    id: '8',
    title: 'Piure de broccoli și conopidă',
    emoji: '🥦',
    ageMonths: 6,
    method: 'puree',
    prepTime: '20 min',
    category: 'dinner',
    ingredients: ['100g broccoli', '100g conopidă', 'Lapte matern sau formulă'],
    steps: [
      'Sparge broccoli și conopida în buchețele mici.',
      'Fierbe la abur 12–15 min.',
      'Blendează cu puțin lapte matern pentru cremozitate.',
      'Introduce gustul amar devreme — bebelușii acceptă mai ușor la această vârstă.',
    ],
    allergens: [],
  },
  {
    id: '9',
    title: 'Gălbenuș de ou cu legume',
    emoji: '🥚',
    ageMonths: 6,
    method: 'puree',
    prepTime: '20 min',
    category: 'lunch',
    ingredients: ['1 gălbenuș de ou fiert tare', '2 linguri piure de morcov', '1 linguriță ulei de măsline'],
    steps: [
      'Fierbe oul tare 12 minute, răcește în apă rece.',
      'Separă gălbenușul de albuș (albușul nu se dă la 6 luni).',
      'Zdrobește gălbenușul fin cu o furculiță.',
      'Amestecă cu piure de morcov și ulei de măsline.',
    ],
    allergens: ['Ou'],
  },
  {
    id: '10',
    title: 'Piure de linte roșie',
    emoji: '🫘',
    ageMonths: 6,
    method: 'puree',
    prepTime: '30 min',
    category: 'dinner',
    ingredients: ['50g linte roșie', '1/2 morcov', '1/4 ceapă (opțional)', 'Ulei de măsline'],
    steps: [
      'Clătește bine lintea.',
      'Fierbe lintea cu morcovul 20–25 min.',
      'Blendează fin cu puțin ulei de măsline.',
      'Lintea este bogată în fier — combinate cu vitamina C cresc absorbția.',
    ],
    allergens: [],
  },
  {
    id: '11',
    title: 'Piure de mango și orez',
    emoji: '🥭',
    ageMonths: 7,
    method: 'puree',
    prepTime: '20 min',
    category: 'breakfast',
    ingredients: ['1/2 mango copt', '2 linguri orez fiert', 'Lapte matern sau formulă'],
    steps: [
      'Fierbe orezul bine (extra moale).',
      'Piurează mango cu un blender.',
      'Amestecă orezul fiert cu piureul de mango.',
      'Adaugă lapte matern pentru consistență.',
    ],
    allergens: [],
  },
  {
    id: '12',
    title: 'Degete de morcov BLW',
    emoji: '🥕',
    ageMonths: 7,
    method: 'blw',
    prepTime: '20 min',
    category: 'lunch',
    ingredients: ['2 morcovi medii', '1 linguriță ulei de măsline'],
    steps: [
      'Taie morcovii în bastoane de 6–7 cm lungime.',
      'Fierbe la abur 15–18 min — trebuie să cedeze ușor la presiunea degetului.',
      'Lasă să se răcească la temperatura potrivită.',
      'Bebelușul apucă bastonul și roadă capătul moale.',
    ],
    allergens: [],
  },
  {
    id: '13',
    title: 'Iaurt cu piure de piersică',
    emoji: '🍑',
    ageMonths: 7,
    method: 'puree',
    prepTime: '10 min',
    category: 'snack',
    ingredients: ['3 linguri iaurt natural integral', '1 piersică coaptă (fără coajă și sâmbure)'],
    steps: [
      'Opărește piersica 1 min pentru coajă ușoară, sau cojește manual.',
      'Blendează sau zdrobește piersica fin.',
      'Amestecă cu iaurtul.',
      'Servește imediat sau păstrează la frigider max 24h.',
    ],
    allergens: ['Lapte/Lactate'],
  },
  {
    id: '14',
    title: 'Omletă moale cu brânză',
    emoji: '🍳',
    ageMonths: 8,
    method: 'blw',
    prepTime: '10 min',
    category: 'breakfast',
    ingredients: ['1 ou întreg', '1 lingură brânză de vaci', '1 linguriță ulei de cocos sau unt'],
    steps: [
      'Bate oul bine, adaugă brânza de vaci.',
      'Încălzește uleiul la foc mic.',
      'Toarnă amestecul și gătește acoperit 3–4 min.',
      'Nu întoarce — trebuie să rămână moale.',
      'Taie în fâșii sau pătrate pentru BLW.',
    ],
    allergens: ['Ou', 'Lapte/Lactate'],
  },
  {
    id: '15',
    title: 'Somon cu cartofi fierți',
    emoji: '🐟',
    ageMonths: 8,
    method: 'mixed',
    prepTime: '25 min',
    category: 'dinner',
    ingredients: ['80g file de somon fără oase', '1 cartof mediu', '1 linguriță ulei de măsline'],
    steps: [
      'Fierbe cartoful în cuburi 15 min.',
      'Gătește somonul la abur sau copt la 180°C timp de 12–15 min.',
      'Verifică de două ori că nu există oase.',
      'Zdrobește cartoful cu ulei de măsline.',
      'Frange somonul în bucăți mici și servește alături sau amestecat.',
    ],
    allergens: ['Pește'],
  },
  {
    id: '16',
    title: 'Paste moi cu sos de roșii și pui',
    emoji: '🍝',
    ageMonths: 8,
    method: 'blw',
    prepTime: '25 min',
    category: 'dinner',
    ingredients: ['50g paste mici (stelline, orzo)', '50g pui fiert tocat fin', '2 roșii coapte', '1 linguriță ulei de măsline'],
    steps: [
      'Fierbe pastele extra bine (dublul timpului recomandat).',
      'Pisează roșiile și gătește-le 5 min cu ulei.',
      'Amestecă pastele cu sosul și puiul tocat.',
      'Pastele trebuie să se strivească ușor între degete.',
    ],
    allergens: ['Grâu/Gluten'],
  },
  {
    id: '17',
    title: 'Terci de griș cu caise',
    emoji: '🍊',
    ageMonths: 8,
    method: 'puree',
    prepTime: '15 min',
    category: 'breakfast',
    ingredients: ['3 linguri griș', '200ml lapte matern sau formulă', '2 caise coapte (fără sâmburi)'],
    steps: [
      'Fierbe laptele, adaugă grișul în ploaie amestecând.',
      'Gătește 5 min la foc mic amestecând continuu.',
      'Piurează caisele separat.',
      'Amestecă terciul cu piureul de caise când s-a răcit puțin.',
    ],
    allergens: [],
  },
  {
    id: '18',
    title: 'Degete de banană învelite în ovăz',
    emoji: '🍌',
    ageMonths: 9,
    method: 'blw',
    prepTime: '15 min',
    category: 'snack',
    ingredients: ['1 banană fermă', '4 linguri fulgi de ovăz fini', '1 ou bătut'],
    steps: [
      'Taie banana în bastoane.',
      'Trece prin ou bătut, apoi tăvălește în fulgi de ovăz.',
      'Gătește în tigaie cu puțin ulei la foc mic, câte 2 min pe fiecare parte.',
      'Răcește complet înainte de servire.',
    ],
    allergens: ['Ou'],
  },
  {
    id: '19',
    title: 'Budincă de orez cu lapte și vanilie',
    emoji: '🍚',
    ageMonths: 9,
    method: 'puree',
    prepTime: '35 min',
    category: 'dessert' as 'snack',
    ingredients: ['50g orez cu bob rotund', '300ml lapte de formulă sau matern', '1 vârf cuțit vanilie naturală'],
    steps: [
      'Fierbe orezul în lapte la foc mic 30 min amestecând des.',
      'Adaugă vanilia naturală.',
      'Consitența trebuie să fie cremoasă, nu lichidă.',
      'Răcește la frigider — devine mai dens răcit.',
    ],
    allergens: ['Lapte/Lactate'],
  },
  {
    id: '20',
    title: 'Chiftele moi de vită și morcov BLW',
    emoji: '🥩',
    ageMonths: 10,
    method: 'blw',
    prepTime: '30 min',
    category: 'dinner',
    ingredients: ['150g carne de vită tocată', '1 morcov mic ras', '1 ou', '2 linguri fulgi de ovăz fini', 'Ulei de măsline'],
    steps: [
      'Amestecă carnea cu morcovul ras, oul și ovăzul.',
      'Formează chiftele mici, plate (2cm grosime).',
      'Prăjește la foc mic cu puțin ulei, 4–5 min pe fiecare parte.',
      'Asigură-te că sunt bine gătite interior (fă un test de tăiere).',
    ],
    allergens: ['Ou'],
  },
  {
    id: '21',
    title: 'Supă de pui cu fidea pentru bebeluși',
    emoji: '🍜',
    ageMonths: 9,
    method: 'mixed',
    prepTime: '40 min',
    category: 'lunch',
    ingredients: ['100g piept de pui', '1 morcov', '1 pastârnac', '50g fidea fără ou', 'Frunze de pătrunjel'],
    steps: [
      'Fierbe puiul cu morcovul și pastârnacul 30 min.',
      'Scoate puiul, toacă fin sau frange în fire.',
      'Adaugă fideaua în supă și fierbe 8 min.',
      'Toacă morcovul fin și adaugă puiul înapoi.',
      'Adaugă puțin pătrunjel proaspăt la final.',
    ],
    allergens: ['Grâu/Gluten'],
  },
  {
    id: '22',
    title: 'Pancakes de banană pentru BLW',
    emoji: '🥞',
    ageMonths: 9,
    method: 'blw',
    prepTime: '15 min',
    category: 'breakfast',
    ingredients: ['1 banană coaptă', '1 ou', '2 linguri fulgi de ovăz fini'],
    steps: [
      'Zdrobește banana, adaugă oul bătut și ovăzul.',
      'Amestecă bine — fără zahăr sau sare.',
      'Toarnă linguri mici în tigaie cu puțin unt la foc mic.',
      'Gătește 2 min pe fiecare parte.',
      'Ideale pentru micul dejun — bogat în potasiu și fibre.',
    ],
    allergens: ['Ou'],
  },
  {
    id: '23',
    title: 'Brânzică de vaci cu fructe de pădure',
    emoji: '🫐',
    ageMonths: 8,
    method: 'puree',
    prepTime: '5 min',
    category: 'snack',
    ingredients: ['3 linguri brânză de vaci', '30g afine sau zmeură', '1 linguriță miere (doar după 12 luni — fără miere sub 1 an!)'],
    steps: [
      'Zdrobește fructele de pădure cu o furculiță.',
      'Amestecă cu brânza de vaci.',
      'NU adăuga miere dacă copilul are sub 12 luni.',
      'Servește imediat sau păstrează la frigider max 24h.',
    ],
    allergens: ['Lapte/Lactate'],
  },
];

type FilterAge = 'all' | '6' | '7' | '8' | '9' | '10' | '12';
type FilterMethod = 'all' | 'puree' | 'blw' | 'mixed';
type FilterTag = FilterAge | FilterMethod | 'no_dairy';

const METHOD_LABEL_KEY: Record<string, string> = {
  puree: 'food_recipes.method_puree',
  blw: 'food_recipes.method_blw',
  mixed: 'food_recipes.method_mixed',
};

const CATEGORY_LABEL_KEY: Record<string, string> = {
  breakfast: 'food_recipes.category_breakfast',
  lunch: 'food_recipes.category_lunch',
  dinner: 'food_recipes.category_dinner',
  snack: 'food_recipes.category_snack',
};

const ALLERGEN_LABEL_KEY: Record<string, string> = {
  Ou: 'food_recipes.allergen_egg',
  'Lapte/Lactate': 'food_recipes.allergen_dairy',
  Pește: 'food_recipes.allergen_fish',
  'Grâu/Gluten': 'food_recipes.allergen_gluten',
};

export default function RecipesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

  const filters: { key: string; label: string }[] = [
    { key: 'all', label: t('food_recipes.all') },
    { key: '6', label: t('food_recipes.months_plus', { count: 6 }) },
    { key: '7', label: t('food_recipes.months_plus', { count: 7 }) },
    { key: '8', label: t('food_recipes.months_plus', { count: 8 }) },
    { key: 'puree', label: t('food_recipes.method_puree') },
    { key: 'blw', label: 'BLW' },
    { key: 'no_dairy', label: t('food_recipes.no_dairy') },
  ];

  const filteredRecipes = useMemo(() => {
    if (activeFilter === 'all') return RECIPES;
    if (activeFilter === 'no_dairy') return RECIPES.filter(r => !r.allergens.includes('Lapte/Lactate'));
    if (['puree', 'blw', 'mixed'].includes(activeFilter)) return RECIPES.filter(r => r.method === activeFilter);
    const age = parseInt(activeFilter, 10);
    return RECIPES.filter(r => r.ageMonths >= age);
  }, [activeFilter]);

  const renderRecipeCard = ({ item, index }: { item: Recipe; index: number }) => (
    <TouchableOpacity
      style={[styles.card, index % 2 === 0 ? styles.cardLeft : styles.cardRight]}
      onPress={() => setSelectedRecipe(item)}
      activeOpacity={0.85}
    >
      <Text style={styles.cardEmoji}>{item.emoji}</Text>
      <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
      <View style={styles.cardBadges}>
        <View style={styles.ageBadge}>
          <Text style={styles.ageBadgeText}>{t('food_recipes.months_plus', { count: item.ageMonths })}</Text>
        </View>
        <View style={[styles.methodBadge, item.method === 'blw' ? styles.methodBLW : styles.methodPuree]}>
          <Text style={[styles.methodText, item.method === 'blw' ? styles.methodBLWText : styles.methodPureeText]}>
            {t(METHOD_LABEL_KEY[item.method])}
          </Text>
        </View>
      </View>
      <View style={styles.timeRow}>
        <Text style={styles.timeIcon}>⏱</Text>
        <Text style={styles.timeText}>{item.prepTime}</Text>
        <Text style={styles.categoryText}>{item.category === 'breakfast' ? '🌅' : item.category === 'lunch' ? '☀️' : item.category === 'dinner' ? '🌙' : '🍎'}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('food_recipes.title')}</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filtersScroll}
        contentContainerStyle={styles.filtersContent}
      >
        {filters.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterChip, activeFilter === f.key && styles.filterChipActive]}
            onPress={() => setActiveFilter(f.key)}
          >
            <Text style={[styles.filterChipText, activeFilter === f.key && styles.filterChipTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Count */}
      <Text style={styles.countText}>{t(filteredRecipes.length === 1 ? 'food_recipes.recipe_count_one' : 'food_recipes.recipe_count', { count: filteredRecipes.length })}</Text>

      {/* Grid */}
      <FlatList
        data={filteredRecipes}
        keyExtractor={item => item.id}
        numColumns={2}
        renderItem={renderRecipeCard}
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
      />

      {/* Recipe Detail Modal */}
      <Modal
        visible={!!selectedRecipe}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedRecipe(null)}
      >
        {selectedRecipe && (
          <SafeAreaView style={styles.modalContainer} edges={['top', 'bottom']}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setSelectedRecipe(null)} style={styles.modalCloseBtn}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.modalEmoji}>{selectedRecipe.emoji}</Text>
              <Text style={styles.modalTitle}>{selectedRecipe.title}</Text>

              <View style={styles.modalMeta}>
                <View style={styles.metaItem}>
                  <Text style={styles.metaIcon}>👶</Text>
                  <Text style={styles.metaText}>{t('food_recipes.months_plus', { count: selectedRecipe.ageMonths })}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Text style={styles.metaIcon}>⏱</Text>
                  <Text style={styles.metaText}>{selectedRecipe.prepTime}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Text style={styles.metaIcon}>🍴</Text>
                  <Text style={styles.metaText}>{t(METHOD_LABEL_KEY[selectedRecipe.method])}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Text style={styles.metaIcon}>🕐</Text>
                  <Text style={styles.metaText}>{t(CATEGORY_LABEL_KEY[selectedRecipe.category])}</Text>
                </View>
              </View>

              {/* Allergens warning */}
              {selectedRecipe.allergens.length > 0 && (
                <View style={styles.allergenCard}>
                  <Text style={styles.allergenTitle}>{t('food_recipes.allergens_present')}</Text>
                  <Text style={styles.allergenText}>{selectedRecipe.allergens.map((a) => t(ALLERGEN_LABEL_KEY[a] ?? a)).join(', ')}</Text>
                  <Text style={styles.allergenHint}>{t('food_recipes.allergen_hint')}</Text>
                </View>
              )}

              {/* Ingredients */}
              <Text style={styles.sectionTitle}>{t('food_recipes.ingredients')}</Text>
              {selectedRecipe.ingredients.map((ing, i) => (
                <View key={i} style={styles.ingredientRow}>
                  <Text style={styles.bullet}>•</Text>
                  <Text style={styles.ingredientText}>{ing}</Text>
                </View>
              ))}

              {/* Steps */}
              <Text style={styles.sectionTitle}>{t('food_recipes.preparation')}</Text>
              {selectedRecipe.steps.map((step, i) => (
                <View key={i} style={styles.stepRow}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>{i + 1}</Text>
                  </View>
                  <Text style={styles.stepText}>{step}</Text>
                </View>
              ))}

              <View style={styles.bottomSpacing} />
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.addMealBtn}
                onPress={() => {
                  setSelectedRecipe(null);
                  Alert.alert(t('food_recipes.added_title'), t('food_recipes.added_msg', { title: selectedRecipe.title }));
                }}
              >
                <Text style={styles.addMealBtnText}>{t('food_recipes.add_to_today')}</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        )}
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
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
  backIcon: {
    fontSize: 18,
    color: Colors.textPrimary,
  },
  headerTitle: {
    flex: 1,
    fontFamily: 'Fraunces',
    fontSize: 18,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  headerRight: { width: 40 },
  filtersScroll: {
    maxHeight: 50,
  },
  filtersContent: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    alignItems: 'center',
  },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: Spacing.xs,
  },
  filterChipActive: {
    backgroundColor: Colors.food,
    borderColor: Colors.food,
  },
  filterChipText: {
    fontFamily: 'Geist-SemiBold',
    fontSize: 13,
    color: Colors.textSecondary,
  },
  filterChipTextActive: {
    color: Colors.white,
  },
  countText: {
    fontFamily: 'Geist',
    fontSize: 13,
    color: Colors.textTertiary,
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  grid: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing['3xl'],
  },
  card: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadow.sm,
  },
  cardLeft: { marginRight: Spacing.xs },
  cardRight: { marginLeft: Spacing.xs },
  cardEmoji: {
    fontSize: 36,
    marginBottom: Spacing.sm,
  },
  cardTitle: {
    fontFamily: 'Geist-SemiBold',
    fontSize: 14,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    lineHeight: 20,
  },
  cardBadges: {
    flexDirection: 'row',
    gap: Spacing.xs,
    flexWrap: 'wrap',
    marginBottom: Spacing.xs,
  },
  ageBadge: {
    backgroundColor: Colors.food + '20',
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
  },
  ageBadgeText: {
    fontFamily: 'Geist-SemiBold',
    fontSize: 11,
    color: Colors.food,
  },
  methodBadge: {
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
  },
  methodPuree: { backgroundColor: Colors.sleep + '20' },
  methodBLW: { backgroundColor: Colors.milestone + '20' },
  methodText: { fontFamily: 'Geist-SemiBold', fontSize: 11 },
  methodPureeText: { color: Colors.sleep },
  methodBLWText: { color: Colors.amber },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  timeIcon: { fontSize: 12 },
  timeText: {
    fontFamily: 'Geist',
    fontSize: 12,
    color: Colors.textTertiary,
    flex: 1,
  },
  categoryText: { fontSize: 14 },

  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: Spacing.lg,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.backgroundSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseText: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  modalScroll: { flex: 1, paddingHorizontal: Spacing.lg },
  modalEmoji: {
    fontSize: 64,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  modalTitle: {
    fontFamily: 'Fraunces',
    fontSize: 24,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  modalMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    ...Shadow.sm,
  },
  metaIcon: { fontSize: 14 },
  metaText: {
    fontFamily: 'Geist-SemiBold',
    fontSize: 13,
    color: Colors.textPrimary,
  },
  allergenCard: {
    backgroundColor: Colors.warning + '20',
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderLeftWidth: 3,
    borderLeftColor: Colors.warning,
  },
  allergenTitle: {
    fontFamily: 'Geist-Bold',
    fontSize: 14,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  allergenText: {
    fontFamily: 'Geist-SemiBold',
    fontSize: 13,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  allergenHint: {
    fontFamily: 'Geist',
    fontSize: 12,
    color: Colors.textSecondary,
  },
  sectionTitle: {
    fontFamily: 'Fraunces',
    fontSize: 18,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
    marginTop: Spacing.lg,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  bullet: {
    fontSize: 16,
    color: Colors.food,
    lineHeight: 22,
  },
  ingredientText: {
    fontFamily: 'Geist',
    fontSize: 14,
    color: Colors.textPrimary,
    flex: 1,
    lineHeight: 22,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
    gap: Spacing.md,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.food,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stepNumberText: {
    fontFamily: 'Geist-Bold',
    fontSize: 13,
    color: Colors.white,
  },
  stepText: {
    fontFamily: 'Geist',
    fontSize: 14,
    color: Colors.textPrimary,
    flex: 1,
    lineHeight: 22,
    paddingTop: Spacing.xs / 2,
  },
  bottomSpacing: { height: Spacing['2xl'] },
  modalFooter: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xl,
    backgroundColor: Colors.white,
    ...Shadow.md,
  },
  addMealBtn: {
    backgroundColor: Colors.food,
    borderRadius: BorderRadius.xl,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
  addMealBtnText: {
    fontFamily: 'Geist-Bold',
    fontSize: 16,
    color: Colors.white,
  },
});
