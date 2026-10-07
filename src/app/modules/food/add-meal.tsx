import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { useAuthStore } from '../../../stores/authStore';
import { useChildStore } from '../../../stores/childStore';
import { useFoodStore } from '../../../stores/foodStore';
import { foodService } from '../../../services/foodService';
import { FOODS_MASTER, getFoodEmoji } from '../../../types/food';
import { Colors } from '../../../theme/colors';
import { BorderRadius, Shadow, Spacing } from '../../../theme/spacing';

export default function AddMealScreen() {
  const router = useRouter();
  const { i18n } = useTranslation();
  const params = useLocalSearchParams();
  const preselectedType = params.type as any || null;
  const { user } = useAuthStore();
  const { activeChild } = useChildStore();
  const { introducedFoods, addMeal } = useFoodStore();

  const [mealType, setMealType] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack' | null>(preselectedType);
  const [selectedFoods, setSelectedFoods] = useState<string[]>([]);
  const [texture, setTexture] = useState<'puree' | 'mashed' | 'soft_pieces' | 'finger_food' | 'mixed' | null>(null);
  const [acceptance, setAcceptance] = useState<'poor' | 'medium' | 'good' | null>(null);
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [foodSearch, setFoodSearch] = useState('');
  const [manualFoodName, setManualFoodName] = useState('');
  const isEnglish = i18n.language === 'en';

  const mealTypes = [
    { id: 'breakfast', label: 'Mic dejun' },
    { id: 'lunch', label: 'Prânz' },
    { id: 'snack', label: 'Gustare' },
    { id: 'dinner', label: 'Cina' },
  ];

  const textures = [
    { id: 'puree', label: 'Piure fin' },
    { id: 'mashed', label: 'Pasat grosier' },
    { id: 'soft_pieces', label: 'Bucăți moi' },
    { id: 'finger_food', label: 'Finger food' },
    { id: 'mixed', label: 'Mixt' },
  ];

  const acceptances = [
    { id: 'good', label: 'A mâncat tot' },
    { id: 'medium', label: 'Mediu' },
    { id: 'poor', label: 'Foarte puțin / Refuz' },
  ];

  const toggleFood = (foodName: string) => {
    if (selectedFoods.includes(foodName)) {
      setSelectedFoods((prev) => prev.filter((food) => food !== foodName));
    } else {
      setSelectedFoods((prev) => [...prev, foodName]);
    }
  };

  const addManualFood = () => {
    const foodName = manualFoodName.trim();
    if (!foodName) return;
    if (!selectedFoods.some((food) => food.toLowerCase() === foodName.toLowerCase())) {
      setSelectedFoods((prev) => [...prev, foodName]);
    }
    setManualFoodName('');
    setFoodSearch('');
  };

  const foodOptions = useMemo(() => {
    const byName = new Map<string, { id: string; name: string; category: string; source: string; emoji: string }>();

    introducedFoods.forEach((food) => {
      byName.set(food.name.trim().toLowerCase(), {
        id: `introduced-${food.id}`,
        name: food.name,
        category: food.category,
        source: 'Adăugat',
        emoji: getFoodEmoji(food.name),
      });
    });

    FOODS_MASTER.forEach((food) => {
      const name = isEnglish ? food.name_en : food.name_ro;
      const key = name.trim().toLowerCase();
      if (!byName.has(key)) {
        byName.set(key, {
          id: `master-${food.key}`,
          name,
          category: food.category,
          source: isEnglish ? `${food.minAgeMonths}+ months` : `${food.minAgeMonths}+ luni`,
          emoji: getFoodEmoji(food),
        });
      }
    });

    const search = foodSearch.trim().toLowerCase();
    return Array.from(byName.values())
      .filter((food) => !search || food.name.toLowerCase().includes(search) || food.category.toLowerCase().includes(search))
      .sort((a, b) => a.name.localeCompare(b.name, isEnglish ? 'en' : 'ro'));
  }, [foodSearch, introducedFoods, isEnglish]);

  const handleSave = async () => {
    if (!user || !activeChild || !mealType || selectedFoods.length === 0 || !texture || !acceptance) {
      Toast.show({ type: 'error', text1: 'Completează câmpurile obligatorii' });
      return;
    }

    setIsSaving(true);
    try {
      const childOwnerId = activeChild.ownerId || user.uid;
      const newMeal: any = {
        childId: activeChild.id,
        userId: user.uid,
        date: new Date().toISOString(),
        time: new Date().toISOString(),
        mealType,
        foods: selectedFoods.map((food) => ({ name: food })),
        texture,
        acceptance,
        notes,
      };

      const id = await foodService.addMeal(childOwnerId, activeChild.id, newMeal);
      addMeal({ ...newMeal, id });
      Toast.show({ type: 'success', text1: 'Masa a fost salvată!' });
      router.back();
    } catch (error) {
      console.warn('Eroare adăugare masă', error);
      Toast.show({ type: 'error', text1: 'A apărut o eroare' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backArrow}>x</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Adaugă masă</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: Spacing['3xl'] }}>
        <Text style={styles.label}>Ce masă este?</Text>
        <View style={styles.chipsRow}>
          {mealTypes.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.chip, mealType === item.id && styles.chipActive]}
              onPress={() => setMealType(item.id as any)}
            >
              <Text style={[styles.chipText, mealType === item.id && styles.chipTextActive]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.labelRow}>
          <Text style={styles.label}>Ce a mâncat?</Text>
          <TouchableOpacity onPress={() => setShowSearchModal(true)}>
            <Text style={styles.linkText}>+ Adaugă</Text>
          </TouchableOpacity>
        </View>

        {selectedFoods.length === 0 ? (
          <TouchableOpacity style={styles.emptyFoods} onPress={() => setShowSearchModal(true)}>
            <Text style={styles.emptyFoodsText}>Apasă aici pentru a adăuga alimente</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.selectedFoodsList}>
            {selectedFoods.map((food) => (
              <View key={food} style={styles.selectedFoodChip}>
                <Text style={styles.selectedFoodName}>{food}</Text>
                <TouchableOpacity onPress={() => toggleFood(food)}>
                  <Text style={styles.removeFoodText}>x</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.label}>Textura</Text>
        <View style={styles.chipsRow}>
          {textures.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.chip, texture === item.id && styles.chipActive]}
              onPress={() => setTexture(item.id as any)}
            >
              <Text style={[styles.chipText, texture === item.id && styles.chipTextActive]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Cât a mâncat?</Text>
        <View style={styles.chipsRow}>
          {acceptances.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.chip, acceptance === item.id && styles.chipActive]}
              onPress={() => setAcceptance(item.id as any)}
            >
              <Text style={[styles.chipText, acceptance === item.id && styles.chipTextActive]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Observații</Text>
        <TextInput
          style={styles.input}
          value={notes}
          onChangeText={setNotes}
          placeholder="Ex: A aruncat mâncarea pe jos"
          placeholderTextColor={Colors.textTertiary}
          multiline
        />

        <TouchableOpacity
          style={[styles.saveBtn, (!mealType || selectedFoods.length === 0 || !texture || !acceptance || isSaving) && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={!mealType || selectedFoods.length === 0 || !texture || !acceptance || isSaving}
        >
          {isSaving ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.saveBtnText}>Salvează masa</Text>}
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={showSearchModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => setShowSearchModal(false)} style={styles.modalCloseBtn}>
            <Text style={styles.modalCloseText}>x</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Alege alimente</Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView style={styles.modalScroll}>
          <View style={styles.searchBox}>
            <TextInput
              style={styles.searchInput}
              value={foodSearch}
              onChangeText={setFoodSearch}
              placeholder="Caută aliment..."
              placeholderTextColor={Colors.textTertiary}
              autoCapitalize="none"
            />
            <View style={styles.manualRow}>
              <TextInput
                style={styles.manualInput}
                value={manualFoodName}
                onChangeText={setManualFoodName}
                placeholder="Adaugă manual: ex. supă cremă"
                placeholderTextColor={Colors.textTertiary}
                returnKeyType="done"
                onSubmitEditing={addManualFood}
              />
              <TouchableOpacity style={styles.manualAddBtn} onPress={addManualFood}>
                <Text style={styles.manualAddText}>Adaugă</Text>
              </TouchableOpacity>
            </View>
          </View>

          {foodOptions.map((food) => {
            const isSelected = selectedFoods.includes(food.name);
            return (
              <TouchableOpacity
                key={food.id}
                style={[styles.searchResultItem, isSelected && { backgroundColor: Colors.feeding + '10' }]}
                onPress={() => toggleFood(food.name)}
              >
                <View style={styles.searchResultEmojiBox}>
                  <Text style={styles.searchResultEmoji}>{food.emoji}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.searchResultName, isSelected && { color: Colors.feeding }]}>{food.name}</Text>
                  <Text style={styles.searchResultMeta}>{food.category} - {food.source}</Text>
                </View>
                {isSelected && <Text style={{ color: Colors.feeding, fontSize: 18 }}>OK</Text>}
              </TouchableOpacity>
            );
          })}
          {foodOptions.length === 0 && (
            <View style={styles.noResults}>
              <Text style={styles.noResultsText}>Nu am găsit alimentul. Îl poți adăuga manual mai sus.</Text>
            </View>
          )}
        </ScrollView>
        <TouchableOpacity style={styles.modalDoneBtn} onPress={() => setShowSearchModal(false)}>
          <Text style={styles.modalDoneText}>Gata ({selectedFoods.length} selectate)</Text>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  backArrow: { fontSize: 24, color: Colors.textPrimary },
  headerTitle: { fontSize: 18, fontFamily: 'Fraunces', color: Colors.textPrimary },
  content: { flex: 1, padding: Spacing.xl },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.xl, marginBottom: Spacing.sm },
  label: { fontSize: 15, fontFamily: 'Geist-SemiBold', color: Colors.textPrimary, marginBottom: Spacing.sm, marginTop: Spacing.xl },
  linkText: { fontSize: 14, fontFamily: 'Geist-SemiBold', color: Colors.feeding },
  emptyFoods: { backgroundColor: Colors.backgroundSoft, padding: Spacing.xl, borderRadius: BorderRadius.xl, alignItems: 'center', borderWidth: 1, borderColor: Colors.border, borderStyle: 'dashed' },
  emptyFoodsText: { fontSize: 14, fontFamily: 'Geist', color: Colors.textSecondary },
  selectedFoodsList: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  selectedFoodChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.feeding, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.lg },
  selectedFoodName: { color: Colors.white, fontFamily: 'Geist-SemiBold', fontSize: 14, marginRight: Spacing.sm },
  removeFoodText: { color: Colors.white, fontSize: 14 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: { backgroundColor: Colors.white, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full, borderWidth: 1, borderColor: Colors.border },
  chipActive: { backgroundColor: Colors.feeding, borderColor: Colors.feeding },
  chipText: { fontSize: 14, fontFamily: 'Geist', color: Colors.textSecondary },
  chipTextActive: { color: Colors.white, fontFamily: 'Geist-SemiBold' },
  input: { backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.md, fontSize: 15, fontFamily: 'Geist', color: Colors.textPrimary, minHeight: 100, textAlignVertical: 'top', borderWidth: 1, borderColor: Colors.border },
  saveBtn: { backgroundColor: Colors.feeding, height: 56, borderRadius: BorderRadius.xl, alignItems: 'center', justifyContent: 'center', marginTop: Spacing['2xl'], ...Shadow.sm },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { fontSize: 16, fontFamily: 'Geist-SemiBold', color: Colors.white },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalCloseBtn: { width: 40, height: 40, justifyContent: 'center' },
  modalCloseText: { fontSize: 24, color: Colors.textPrimary },
  modalTitle: { fontSize: 18, fontFamily: 'Fraunces', color: Colors.textPrimary },
  modalScroll: { flex: 1 },
  searchBox: { padding: Spacing.lg, gap: Spacing.sm, backgroundColor: Colors.backgroundSoft, borderBottomWidth: 1, borderBottomColor: Colors.border },
  searchInput: { backgroundColor: Colors.white, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.md, height: 44, fontSize: 15, fontFamily: 'Geist', color: Colors.textPrimary },
  manualRow: { flexDirection: 'row', gap: Spacing.sm },
  manualInput: { flex: 1, backgroundColor: Colors.white, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.md, height: 44, fontSize: 14, fontFamily: 'Geist', color: Colors.textPrimary },
  manualAddBtn: { backgroundColor: Colors.feeding, borderRadius: BorderRadius.lg, paddingHorizontal: Spacing.md, alignItems: 'center', justifyContent: 'center' },
  manualAddText: { color: Colors.white, fontSize: 13, fontFamily: 'Geist-SemiBold' },
  searchResultItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border },
  searchResultEmojiBox: { width: 44, height: 44, borderRadius: BorderRadius.lg, backgroundColor: Colors.backgroundSoft, alignItems: 'center', justifyContent: 'center' },
  searchResultEmoji: { fontSize: 24 },
  searchResultName: { fontSize: 16, fontFamily: 'Geist-SemiBold', color: Colors.textPrimary },
  searchResultMeta: { marginTop: 2, fontSize: 12, fontFamily: 'Geist', color: Colors.textTertiary },
  noResults: { padding: Spacing.xl, alignItems: 'center' },
  noResultsText: { fontSize: 14, fontFamily: 'Geist', color: Colors.textSecondary, textAlign: 'center' },
  modalDoneBtn: { backgroundColor: Colors.feeding, margin: Spacing.xl, height: 56, borderRadius: BorderRadius.xl, alignItems: 'center', justifyContent: 'center' },
  modalDoneText: { color: Colors.white, fontSize: 16, fontFamily: 'Geist-SemiBold' },
});
