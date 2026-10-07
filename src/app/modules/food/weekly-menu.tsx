import { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { useTranslation } from 'react-i18next';
import { useFoodStore, WeeklySlot } from '../../../stores/foodStore';
import { Colors } from '../../../theme/colors';
import { Spacing, BorderRadius, Shadow } from '../../../theme/spacing';

const DAYS_RO = ['Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sam', 'Dum'];
const DAYS_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAYS_FULL_RO = ['Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă', 'Duminică'];
const DAYS_FULL_EN = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const MEAL_TYPES: { key: WeeklySlot['mealType']; labelRo: string; labelEn: string; emoji: string; color: string }[] = [
  { key: 'breakfast', labelRo: 'Mic dejun', labelEn: 'Breakfast', emoji: '🌅', color: Colors.amber },
  { key: 'lunch', labelRo: 'Prânz', labelEn: 'Lunch', emoji: '☀️', color: Colors.feeding },
  { key: 'dinner', labelRo: 'Cina', labelEn: 'Dinner', emoji: '🌙', color: Colors.sleep },
  { key: 'snack', labelRo: 'Gustare', labelEn: 'Snack', emoji: '🍎', color: Colors.success },
];

const FOOD_NAME_EN: Record<string, string> = {
  'ovaz cu lapte matern': 'Oats with breast milk',
  'piure de legume': 'Vegetable puree',
  'supa de pui': 'Chicken soup',
  'iaurt natural': 'Plain yogurt',
  'paine integrala moale': 'Soft whole wheat bread',
  'banana zdrobita': 'Mashed banana',
  'morcov fiert': 'Cooked carrot',
  avocado: 'Avocado',
  'branza de vaci': 'Cottage cheese',
  'orez fiert': 'Cooked rice',
  morcov: 'Carrot',
  mazare: 'Peas',
  'cartof dulce': 'Sweet potato',
  cartof: 'Potato',
  dovlecel: 'Zucchini',
  broccoli: 'Broccoli',
  spanac: 'Spinach',
  conopida: 'Cauliflower',
  dovleac: 'Pumpkin',
  banana: 'Banana',
  mar: 'Apple',
  para: 'Pear',
};

function getMondayOf(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(d.getDate() + n);
  return r;
}

function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function fmtShortDate(d: Date, isEnglish: boolean): string {
  return d.toLocaleDateString(isEnglish ? 'en-US' : 'ro-RO', { day: '2-digit', month: 'short' });
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function displayFoodName(name: string, isEnglish: boolean): string {
  if (!isEnglish) return name;
  return FOOD_NAME_EN[normalizeName(name)] ?? name;
}

export default function WeeklyMenuScreen() {
  const router = useRouter();
  const { introducedFoods, weeklyMenus, updateWeeklySlot } = useFoodStore();
  const { i18n } = useTranslation();
  const isEnglish = i18n.language === 'en';
  const daysFull = isEnglish ? DAYS_FULL_EN : DAYS_FULL_RO;

  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [selectedMealType, setSelectedMealType] = useState<WeeklySlot['mealType'] | null>(null);
  const [showSlotModal, setShowSlotModal] = useState(false);
  const [slotSearch, setSlotSearch] = useState('');
  const [slotFoods, setSlotFoods] = useState<string[]>([]);
  const [customInput, setCustomInput] = useState('');

  const monday = useMemo(() => {
    const base = getMondayOf(new Date());
    return addDays(base, weekOffset * 7);
  }, [weekOffset]);

  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(monday, i)), [monday]);
  const weekStart = localDateStr(monday);

  const slotsForWeek = useMemo(
    () => weeklyMenus[weekStart]?.slots ?? [],
    [weeklyMenus, weekStart],
  );

  const getSlotFoods = (day: number, mealType: WeeklySlot['mealType']): string[] => {
    const s = slotsForWeek.find(slot => slot.day === day && slot.mealType === mealType);
    return s?.foods ?? [];
  };

  const mealLabel = (meal: typeof MEAL_TYPES[number]) => isEnglish ? meal.labelEn : meal.labelRo;

  const openSlotEditor = (day: number, mealType: WeeklySlot['mealType']) => {
    setSelectedDay(day);
    setSelectedMealType(mealType);
    setSlotFoods(getSlotFoods(day, mealType));
    setSlotSearch('');
    setCustomInput('');
    setShowSlotModal(true);
  };

  const saveSlot = useCallback(() => {
    if (selectedDay === null || !selectedMealType) return;
    updateWeeklySlot(weekStart, selectedDay, selectedMealType, slotFoods);
    Toast.show({ type: 'success', text1: isEnglish ? 'Meal saved!' : 'Masa salvată!', visibilityTime: 1500 });
    setShowSlotModal(false);
  }, [isEnglish, selectedDay, selectedMealType, slotFoods, weekStart, updateWeeklySlot]);

  const toggleFood = (name: string) => {
    setSlotFoods(prev =>
      prev.includes(name) ? prev.filter(f => f !== name) : [...prev, name],
    );
  };

  const addCustomFood = () => {
    const trimmed = customInput.trim();
    if (!trimmed || slotFoods.includes(trimmed)) return;
    setSlotFoods(prev => [...prev, trimmed]);
    setCustomInput('');
  };

  const suggestions = useMemo(() => {
    const introduced = introducedFoods.map(f => f.name);
    const extras = [
      'Ovaz cu lapte matern',
      'Piure de legume',
      'Supa de pui',
      'Iaurt natural',
      'Paine integrala moale',
      'Banana zdrobita',
      'Morcov fiert',
      'Avocado',
      'Branza de vaci',
      'Orez fiert',
    ];
    const combined = [...new Set([...introduced, ...extras])];
    if (!slotSearch.trim()) return combined;
    const query = normalizeName(slotSearch);
    return combined.filter(food => normalizeName(displayFoodName(food, isEnglish)).includes(query) || normalizeName(food).includes(query));
  }, [introducedFoods, isEnglish, slotSearch]);

  const totalPlanned = useMemo(
    () => slotsForWeek.filter(s => s.foods.length > 0).length,
    [slotsForWeek],
  );

  const generateShoppingList = () => {
    const allFoods = slotsForWeek.flatMap(s => s.foods);
    const unique = [...new Set(allFoods)];
    if (unique.length === 0) {
      Toast.show({
        type: 'info',
        text1: isEnglish ? 'The menu is empty' : 'Meniul este gol',
        text2: isEnglish ? 'Add foods to the calendar first.' : 'Adaugă mâncăruri în calendar mai întâi.',
      });
      return;
    }
    router.push({
      pathname: '/modules/food/shopping-list',
      params: { fromMenu: unique.join('||') },
    });
  };

  const selectedMeal = selectedMealType ? MEAL_TYPES.find(m => m.key === selectedMealType) : undefined;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{isEnglish ? 'Weekly menu' : 'Meniu săptămânal'}</Text>
          <Text style={styles.headerSub}>
            {fmtShortDate(weekDates[0], isEnglish)} – {fmtShortDate(weekDates[6], isEnglish)}
          </Text>
        </View>
        <View style={styles.headerRight} />
      </View>

      <View style={styles.weekNav}>
        <TouchableOpacity style={styles.weekNavBtn} onPress={() => setWeekOffset(w => w - 1)}>
          <Text style={styles.weekNavArrow}>‹</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.weekNavCenter} onPress={() => setWeekOffset(0)}>
          <Text style={styles.weekNavLabel}>
            {weekOffset === 0
              ? (isEnglish ? 'Current week' : 'Săptămâna curentă')
              : weekOffset > 0
                ? `+${weekOffset} ${isEnglish ? 'wk' : 'sapt.'}`
                : `${weekOffset} ${isEnglish ? 'wk' : 'sapt.'}`}
          </Text>
          <Text style={styles.weekNavSub}>
            {totalPlanned} {isEnglish ? 'planned meals' : 'mese planificate'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.weekNavBtn} onPress={() => setWeekOffset(w => w + 1)}>
          <Text style={styles.weekNavArrow}>›</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {weekDates.map((date, dayIdx) => {
          const isToday = date.toDateString() === new Date().toDateString();
          const isPast = date < new Date() && !isToday;
          return (
            <View key={dayIdx} style={[styles.daySection, isPast && styles.daySectionPast]}>
              <View style={[styles.dayHeader, isToday && styles.dayHeaderToday]}>
                <Text style={[styles.dayName, isToday && styles.dayNameToday]}>{daysFull[dayIdx]}</Text>
                <Text style={[styles.dayDate, isToday && styles.dayDateToday]}>{fmtShortDate(date, isEnglish)}</Text>
                {isToday && <View style={styles.todayDot} />}
              </View>

              <View style={styles.slotsContainer}>
                {MEAL_TYPES.map(meal => {
                  const foods = getSlotFoods(dayIdx, meal.key);
                  const hasContent = foods.length > 0;
                  return (
                    <TouchableOpacity
                      key={meal.key}
                      style={[styles.slotCard, hasContent && styles.slotCardFilled]}
                      onPress={() => openSlotEditor(dayIdx, meal.key)}
                      activeOpacity={0.75}
                    >
                      <View style={[styles.slotMealType, { backgroundColor: meal.color + '20' }]}>
                        <Text style={styles.slotMealEmoji}>{meal.emoji}</Text>
                      </View>
                      <View style={styles.slotContent}>
                        <Text style={styles.slotMealLabel}>{mealLabel(meal)}</Text>
                        {hasContent ? (
                          <Text style={styles.slotFoods} numberOfLines={2}>
                            {foods.map(food => displayFoodName(food, isEnglish)).join(', ')}
                          </Text>
                        ) : (
                          <Text style={styles.slotEmpty}>{isEnglish ? 'Tap to add' : 'Apasă pentru a adăuga'}</Text>
                        )}
                      </View>
                      <View style={[styles.slotAddBtn, hasContent && { backgroundColor: meal.color + '20' }]}>
                        <Text style={[styles.slotAddText, hasContent && { color: meal.color }]}>
                          {hasContent ? '✎' : '+'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          );
        })}

        <TouchableOpacity style={styles.shoppingBtn} onPress={generateShoppingList} activeOpacity={0.85}>
          <Text style={styles.shoppingBtnEmoji}>🛒</Text>
          <View style={styles.shoppingBtnText}>
            <Text style={styles.shoppingBtnTitle}>{isEnglish ? 'Generate shopping list' : 'Generează lista de cumpărături'}</Text>
            <Text style={styles.shoppingBtnSub}>{isEnglish ? 'From all foods in the menu' : 'Din toate alimentele din meniu'}</Text>
          </View>
          <Text style={styles.shoppingBtnArrow}>→</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={showSlotModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer} edges={['top', 'bottom']}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowSlotModal(false)} style={styles.modalCancelBtn}>
              <Text style={styles.modalCancelText}>{isEnglish ? 'Cancel' : 'Anulează'}</Text>
            </TouchableOpacity>
            <View style={styles.modalTitleWrap}>
              <Text style={styles.modalTitle}>
                {selectedMeal ? selectedMeal.emoji : ''}{' '}
                {selectedMeal ? mealLabel(selectedMeal) : ''}
              </Text>
              <Text style={styles.modalSub}>
                {selectedDay !== null ? daysFull[selectedDay] : ''}
              </Text>
            </View>
            <TouchableOpacity onPress={saveSlot} style={styles.modalSaveBtn}>
              <Text style={styles.modalSaveText}>{isEnglish ? 'Save' : 'Salvează'}</Text>
            </TouchableOpacity>
          </View>

          {slotFoods.length > 0 && (
            <View style={styles.selectedFoodsWrap}>
              <Text style={styles.selectedFoodsLabel}>{isEnglish ? 'Selected:' : 'Selectate:'}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.selectedFoodsScroll}>
                {slotFoods.map((f, i) => (
                  <TouchableOpacity key={`${f}-${i}`} style={styles.selectedFoodChip} onPress={() => toggleFood(f)}>
                    <Text style={styles.selectedFoodChipText}>{displayFoodName(f, isEnglish)}</Text>
                    <Text style={styles.selectedFoodChipRemove}> ×</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          <View style={styles.customInputRow}>
            <TextInput
              style={styles.customInput}
              value={customInput}
              onChangeText={setCustomInput}
              placeholder={isEnglish ? 'Write your own food...' : 'Scrie un aliment propriu...'}
              placeholderTextColor={Colors.textTertiary}
              returnKeyType="done"
              onSubmitEditing={addCustomFood}
            />
            <TouchableOpacity
              style={[styles.customInputBtn, !customInput.trim() && { opacity: 0.4 }]}
              onPress={addCustomFood}
              disabled={!customInput.trim()}
            >
              <Text style={styles.customInputBtnText}>+</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.searchWrap}>
            <TextInput
              style={styles.searchInput}
              value={slotSearch}
              onChangeText={setSlotSearch}
              placeholder={isEnglish ? '🔍 Search food...' : '🔍 Cauta aliment...'}
              placeholderTextColor={Colors.textTertiary}
            />
          </View>

          <FlatList
            data={suggestions}
            keyExtractor={(item) => item}
            renderItem={({ item }) => {
              const selected = slotFoods.includes(item);
              return (
                <TouchableOpacity
                  style={[styles.foodItem, selected && styles.foodItemSelected]}
                  onPress={() => toggleFood(item)}
                >
                  <Text style={[styles.foodItemText, selected && styles.foodItemTextSelected]}>
                    {displayFoodName(item, isEnglish)}
                  </Text>
                  {selected && <Text style={styles.foodItemCheck}>✓</Text>}
                </TouchableOpacity>
              );
            }}
            contentContainerStyle={{ paddingBottom: Spacing['3xl'] }}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  backArrow: { fontSize: 24, color: Colors.textPrimary },
  headerCenter: { alignItems: 'center' },
  headerTitle: { fontSize: 18, fontFamily: 'Fraunces', color: Colors.textPrimary },
  headerSub: { fontSize: 12, fontFamily: 'Geist', color: Colors.textSecondary, marginTop: 2 },
  headerRight: { width: 40 },
  weekNav: { flexDirection: 'row', alignItems: 'center', marginHorizontal: Spacing.xl, marginBottom: Spacing.md, backgroundColor: Colors.white, borderRadius: BorderRadius.xl, ...Shadow.sm, overflow: 'hidden' },
  weekNavBtn: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  weekNavArrow: { fontSize: 26, color: Colors.feeding, fontFamily: 'Geist-Bold' },
  weekNavCenter: { flex: 1, alignItems: 'center', paddingVertical: Spacing.md },
  weekNavLabel: { fontSize: 14, fontFamily: 'Geist-SemiBold', color: Colors.textPrimary },
  weekNavSub: { fontSize: 12, fontFamily: 'Geist', color: Colors.textSecondary },
  scrollContent: { paddingBottom: Spacing['3xl'] },
  daySection: { marginBottom: Spacing.md },
  daySectionPast: { opacity: 0.7 },
  dayHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.sm },
  dayHeaderToday: { backgroundColor: Colors.feeding + '10' },
  dayName: { fontSize: 15, fontFamily: 'Geist-Bold', color: Colors.textPrimary },
  dayNameToday: { color: Colors.feeding },
  dayDate: { fontSize: 13, fontFamily: 'Geist', color: Colors.textTertiary },
  dayDateToday: { color: Colors.feeding },
  todayDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.feeding },
  slotsContainer: { paddingHorizontal: Spacing.xl, gap: Spacing.sm },
  slotCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  slotCardFilled: { borderColor: Colors.feeding + '40', backgroundColor: Colors.feeding + '05' },
  slotMealType: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  slotMealEmoji: { fontSize: 18 },
  slotContent: { flex: 1 },
  slotMealLabel: { fontSize: 11, fontFamily: 'Geist-SemiBold', color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  slotFoods: { fontSize: 14, fontFamily: 'Geist-SemiBold', color: Colors.textPrimary, lineHeight: 18 },
  slotEmpty: { fontSize: 13, fontFamily: 'Geist', color: Colors.textTertiary, fontStyle: 'italic' },
  slotAddBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.backgroundSoft, alignItems: 'center', justifyContent: 'center' },
  slotAddText: { fontSize: 18, color: Colors.textTertiary, lineHeight: 20 },
  shoppingBtn: { marginHorizontal: Spacing.xl, marginTop: Spacing.lg, backgroundColor: Colors.feeding, borderRadius: BorderRadius.xl, padding: Spacing.lg, flexDirection: 'row', alignItems: 'center', gap: Spacing.md, ...Shadow.md },
  shoppingBtnEmoji: { fontSize: 28 },
  shoppingBtnText: { flex: 1 },
  shoppingBtnTitle: { fontSize: 15, fontFamily: 'Geist-Bold', color: Colors.white },
  shoppingBtnSub: { fontSize: 12, fontFamily: 'Geist', color: Colors.white + 'CC' },
  shoppingBtnArrow: { fontSize: 22, color: Colors.white },
  modalContainer: { flex: 1, backgroundColor: Colors.background },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalCancelBtn: { padding: Spacing.sm },
  modalCancelText: { fontSize: 15, fontFamily: 'Geist', color: Colors.textSecondary },
  modalTitleWrap: { alignItems: 'center' },
  modalTitle: { fontSize: 18, fontFamily: 'Fraunces', color: Colors.textPrimary },
  modalSub: { fontSize: 13, fontFamily: 'Geist', color: Colors.textSecondary },
  modalSaveBtn: { backgroundColor: Colors.feeding, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full },
  modalSaveText: { fontSize: 15, fontFamily: 'Geist-SemiBold', color: Colors.white },
  selectedFoodsWrap: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
  selectedFoodsLabel: { fontSize: 12, fontFamily: 'Geist-SemiBold', color: Colors.textTertiary, marginBottom: Spacing.sm },
  selectedFoodsScroll: { gap: Spacing.sm },
  selectedFoodChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.feeding + '20', borderRadius: BorderRadius.full, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs },
  selectedFoodChipText: { fontSize: 13, fontFamily: 'Geist-SemiBold', color: Colors.feeding },
  selectedFoodChipRemove: { fontSize: 12, color: Colors.feeding },
  customInputRow: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
  customInput: { flex: 1, backgroundColor: Colors.white, borderRadius: BorderRadius.xl, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontSize: 14, fontFamily: 'Geist', color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.border },
  customInputBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.feeding, alignItems: 'center', justifyContent: 'center' },
  customInputBtnText: { fontSize: 24, color: Colors.white, lineHeight: 28 },
  searchWrap: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm },
  searchInput: { backgroundColor: Colors.backgroundSoft, borderRadius: BorderRadius.xl, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontSize: 14, fontFamily: 'Geist', color: Colors.textPrimary },
  foodItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  foodItemSelected: { backgroundColor: Colors.feeding + '10' },
  foodItemText: { fontSize: 15, fontFamily: 'Geist', color: Colors.textPrimary },
  foodItemTextSelected: { fontFamily: 'Geist-SemiBold', color: Colors.feeding },
  foodItemCheck: { fontSize: 16, color: Colors.feeding },
});
