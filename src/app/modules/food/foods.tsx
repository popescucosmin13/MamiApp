import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Colors } from '../../../theme/colors';
import { Spacing, BorderRadius, Shadow } from '../../../theme/spacing';
import { useFoodStore } from '../../../stores/foodStore';
import { FOODS_MASTER, getFoodEmoji, type IntroducedFood } from '../../../types/food';

type FilterKey = 'all' | 'vegetable' | 'fruit' | 'protein' | 'dairy' | 'cereal' | 'reaction';

const FILTERS: { key: FilterKey; labelKey: string }[] = [
  { key: 'all', labelKey: 'food_list.filter_all' },
  { key: 'vegetable', labelKey: 'food_list.filter_vegetables' },
  { key: 'fruit', labelKey: 'food_list.filter_fruits' },
  { key: 'protein', labelKey: 'food_list.filter_protein' },
  { key: 'dairy', labelKey: 'food_list.filter_dairy' },
  { key: 'cereal', labelKey: 'food_list.filter_cereal' },
  { key: 'reaction', labelKey: 'food_list.filter_reaction' },
];

const CATEGORY_EMOJI: Record<string, string> = {
  vegetable: '🥕',
  fruit: '🍎',
  cereal: '🌾',
  protein: '🥚',
  dairy: '🥛',
  legume: '🫘',
  fat: '🥑',
  other: '🍽️',
};

const REACTION_COLOR: Record<string, string> = {
  none: Colors.success,
  mild: Colors.warning,
  moderate: Colors.amber,
  severe: Colors.error,
  unknown: Colors.textTertiary,
};

const ACCEPTANCE_EMOJI: Record<string, string> = {
  liked: '😋',
  neutral: '😐',
  refused: '🤢',
  unknown: '❔',
};

function normalizeFoodName(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{Letter}\p{Number}]+/gu, ' ')
    .trim();
}

function findMasterFood(name: string) {
  const normalized = normalizeFoodName(name);
  return FOODS_MASTER.find((food) => {
    const ro = normalizeFoodName(food.name_ro);
    const en = normalizeFoodName(food.name_en);
    return normalized === ro || normalized === en || normalized.includes(ro) || normalized.includes(en);
  });
}

const FOOD_FALLBACKS: Record<string, { en: string; ro: string; emoji: string; category: string }> = {
  morcov: { en: 'Carrot', ro: 'Morcov', emoji: '🥕', category: 'vegetable' },
  mazare: { en: 'Peas', ro: 'Mazăre', emoji: '🟢', category: 'vegetable' },
  'cartof dulce': { en: 'Sweet potato', ro: 'Cartof dulce', emoji: '🍠', category: 'vegetable' },
  cartof: { en: 'Potato', ro: 'Cartof', emoji: '🥔', category: 'vegetable' },
  dovlecel: { en: 'Zucchini', ro: 'Dovlecel', emoji: '🥒', category: 'vegetable' },
  broccoli: { en: 'Broccoli', ro: 'Broccoli', emoji: '🥦', category: 'vegetable' },
  spanac: { en: 'Spinach', ro: 'Spanac', emoji: '🥬', category: 'vegetable' },
  conopida: { en: 'Cauliflower', ro: 'Conopidă', emoji: '🥦', category: 'vegetable' },
  dovleac: { en: 'Pumpkin', ro: 'Dovleac', emoji: '🎃', category: 'vegetable' },
  banana: { en: 'Banana', ro: 'Banană', emoji: '🍌', category: 'fruit' },
  mar: { en: 'Apple', ro: 'Măr', emoji: '🍎', category: 'fruit' },
  avocado: { en: 'Avocado', ro: 'Avocado', emoji: '🥑', category: 'fruit' },
};

function findFoodFallback(name: string) {
  const normalized = normalizeFoodName(name);
  return Object.entries(FOOD_FALLBACKS).find(([key]) => normalized === key || normalized.includes(key))?.[1];
}

function testDayLabel(testDay: IntroducedFood['testDay'], t: (key: string, options?: Record<string, unknown>) => string): string {
  if (testDay === 'completed') return t('food_list.tested');
  return t('food_list.test_day', { day: testDay });
}

function testDayColor(testDay: IntroducedFood['testDay']): string {
  if (testDay === 'completed') return Colors.success;
  return Colors.amber;
}

function formatDate(val: string | { toDate: () => Date }, locale: string): string {
  const d = typeof val === 'string' ? new Date(val) : val.toDate();
  return d.toLocaleDateString(locale === 'en' ? 'en-US' : 'ro-RO', { day: '2-digit', month: 'short' });
}

export default function FoodsScreen() {
  const { t, i18n } = useTranslation();
  const isEnglish = i18n.language === 'en';
  const router = useRouter();
  const { introducedFoods } = useFoodStore();
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredFoods = useMemo(() => {
    let list = introducedFoods;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(f => f.name.toLowerCase().includes(q));
    }
    if (activeFilter === 'all') return list;
    if (activeFilter === 'reaction') return list.filter(f => f.reactionStatus !== 'none' && f.reactionStatus !== 'unknown');
    if (activeFilter === 'cereal') return list.filter(f => f.category === 'cereal');
    return list.filter(f => f.category === activeFilter);
  }, [introducedFoods, activeFilter, searchQuery]);

  const renderFood = ({ item }: { item: IntroducedFood }) => {
    const masterFood = findMasterFood(item.name);
    const fallbackFood = findFoodFallback(item.name);
    const displayName = masterFood ? (isEnglish ? masterFood.name_en : masterFood.name_ro) : fallbackFood ? (isEnglish ? fallbackFood.en : fallbackFood.ro) : item.name;
    const displayCategory = masterFood?.category ?? fallbackFood?.category ?? item.category;
    const reactionColor = REACTION_COLOR[item.reactionStatus] ?? REACTION_COLOR.unknown;
    const reactionLabel = t(`food_list.reaction_${item.reactionStatus}`, { defaultValue: item.reactionStatus });
    const tdColor = testDayColor(item.testDay);
    return (
      <View style={styles.foodCard}>
        <View style={styles.foodCardLeft}>
          <Text style={styles.foodEmoji}>{fallbackFood?.emoji ?? (masterFood ? getFoodEmoji(masterFood) : (CATEGORY_EMOJI[item.category] ?? '🍽️'))}</Text>
        </View>
        <View style={styles.foodCardCenter}>
          <View style={styles.foodNameRow}>
            <Text style={styles.foodName}>{displayName}</Text>
            <Text style={styles.acceptanceEmoji}>{ACCEPTANCE_EMOJI[item.acceptance] ?? '❔'}</Text>
          </View>
          <Text style={styles.foodCategoryLabel}>{t(`food_list.category_${displayCategory}`, { defaultValue: displayCategory })}</Text>
          <Text style={styles.foodDate}>{t('food_list.introduced_on', { date: formatDate(item.introducedAt, i18n.language) })}</Text>
          <View style={styles.badgeRow}>
            <View style={[styles.badge, { backgroundColor: tdColor + '20' }]}>
              <Text style={[styles.badgeText, { color: tdColor }]}>{testDayLabel(item.testDay, t)}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: reactionColor + '20' }]}>
              <Text style={[styles.badgeText, { color: reactionColor }]}>{reactionLabel}</Text>
            </View>
          </View>
        </View>
        {item.isAllergen && (
          <View style={styles.allergenFlag}>
            <Text style={styles.allergenFlagText}>!</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('food_list.title')}</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{introducedFoods.length}</Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={t('food_list.search_placeholder')}
          placeholderTextColor={Colors.textTertiary}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Text style={styles.clearSearch}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filtersScroll}
        contentContainerStyle={styles.filtersContent}
      >
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterChip, activeFilter === f.key && styles.filterChipActive]}
            onPress={() => setActiveFilter(f.key)}
          >
            <Text style={[styles.filterChipText, activeFilter === f.key && styles.filterChipTextActive]}>
              {t(f.labelKey)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* List */}
      {filteredFoods.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>🥗</Text>
          <Text style={styles.emptyTitle}>
            {introducedFoods.length === 0 ? t('food_list.empty_title') : t('food_list.no_match_title')}
          </Text>
          <Text style={styles.emptyText}>
            {introducedFoods.length === 0
              ? t('food_list.empty_text')
              : t('food_list.no_match_text')}
          </Text>
          {introducedFoods.length === 0 && (
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => router.push('/modules/food/add-food')}
            >
              <Text style={styles.emptyBtnText}>+ {t('food_list.add_first')}</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={filteredFoods}
          keyExtractor={item => item.id}
          renderItem={renderFood}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/modules/food/add-food')}
        activeOpacity={0.85}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
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
    gap: Spacing.sm,
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
  },
  countBadge: {
    backgroundColor: Colors.food,
    borderRadius: BorderRadius.full,
    minWidth: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.sm,
  },
  countText: {
    fontFamily: 'Geist-Bold',
    fontSize: 14,
    color: Colors.white,
  },

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    marginHorizontal: Spacing.lg,
    paddingHorizontal: Spacing.md,
    height: 48,
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
    ...Shadow.sm,
  },
  searchIcon: { fontSize: 16 },
  searchInput: {
    flex: 1,
    fontFamily: 'Geist',
    fontSize: 15,
    color: Colors.textPrimary,
    height: '100%',
  },
  clearSearch: {
    fontSize: 14,
    color: Colors.textTertiary,
    padding: Spacing.xs,
  },

  filtersScroll: { maxHeight: 46 },
  filtersContent: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.xs,
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
  filterChipTextActive: { color: Colors.white },

  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: 100,
  },
  foodCard: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    alignItems: 'flex-start',
    gap: Spacing.md,
    ...Shadow.sm,
  },
  foodCardLeft: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.backgroundSoft,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  foodEmoji: { fontSize: 26 },
  foodCardCenter: { flex: 1 },
  foodNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: 2,
  },
  foodName: {
    fontFamily: 'Geist-Bold',
    fontSize: 15,
    color: Colors.textPrimary,
    flex: 1,
  },
  acceptanceEmoji: { fontSize: 18 },
  foodCategoryLabel: {
    fontFamily: 'Geist',
    fontSize: 12,
    color: Colors.textTertiary,
    marginBottom: Spacing.xs,
  },
  foodDate: {
    fontFamily: 'Geist',
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    flexWrap: 'wrap',
  },
  badge: {
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
  },
  badgeText: {
    fontFamily: 'Geist-SemiBold',
    fontSize: 11,
  },
  allergenFlag: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
  },
  allergenFlagText: { fontSize: 16 },

  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing['2xl'],
  },
  emptyEmoji: { fontSize: 64, marginBottom: Spacing.lg },
  emptyTitle: {
    fontFamily: 'Fraunces',
    fontSize: 22,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  emptyText: {
    fontFamily: 'Geist',
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.xl,
  },
  emptyBtn: {
    backgroundColor: Colors.food,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.md,
  },
  emptyBtnText: {
    fontFamily: 'Geist-Bold',
    fontSize: 15,
    color: Colors.white,
  },

  fab: {
    position: 'absolute',
    bottom: Spacing.xl,
    right: Spacing.xl,
    width: 56,
    height: 56,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.food,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.md,
  },
  fabText: {
    fontSize: 28,
    color: Colors.white,
    lineHeight: 32,
  },
});
