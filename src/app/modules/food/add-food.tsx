import { useState } from 'react';
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
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { useAuthStore } from '../../../stores/authStore';
import { useChildStore } from '../../../stores/childStore';
import { useFoodStore } from '../../../stores/foodStore';
import { foodService } from '../../../services/foodService';
import { FOODS_MASTER, FoodMaster, IntroducedFood, getFoodEmoji } from '../../../types/food';
import { Colors } from '../../../theme/colors';
import { BorderRadius, Shadow, Spacing } from '../../../theme/spacing';

function mapFoodCategory(category: FoodMaster['category']): IntroducedFood['category'] {
  return category === 'grain' ? 'cereal' : category;
}

export default function AddFoodScreen() {
  const router = useRouter();
  const { i18n } = useTranslation();
  const isEnglish = i18n.language === 'en';
  const { user } = useAuthStore();
  const { activeChild } = useChildStore();
  const { introducedFoods, addIntroducedFood } = useFoodStore();

  const [search, setSearch] = useState('');
  const [selectedFood, setSelectedFood] = useState<FoodMaster | null>(null);
  const [customFoodName, setCustomFoodName] = useState('');
  const [customFoodCategory, setCustomFoodCategory] = useState<IntroducedFood['category']>('other');
  const [isCustomFood, setIsCustomFood] = useState(false);
  const [texture, setTexture] = useState<IntroducedFood['texture'] | null>(null);
  const [acceptance, setAcceptance] = useState<IntroducedFood['acceptance'] | null>(null);
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);

  const getFoodName = (food: FoodMaster) => isEnglish ? food.name_en : food.name_ro;
  const riskLabel = (risk: FoodMaster['allergyRisk']) => {
    if (risk === 'high') return isEnglish ? 'Allergen' : 'Alergen';
    if (risk === 'medium') return isEnglish ? 'Moderate' : 'Moderat';
    return isEnglish ? 'Safe' : 'Sigur';
  };

  const existingFoodIds = introducedFoods.map((food) => food.name.toLowerCase());
  const availableFoods = FOODS_MASTER.filter((food) => {
    const ro = food.name_ro.toLowerCase();
    const en = food.name_en.toLowerCase();
    return !existingFoodIds.includes(ro) && !existingFoodIds.includes(en);
  });
  const searchQuery = search.toLowerCase();
  const searchResults = availableFoods.filter((food) =>
    food.name_ro.toLowerCase().includes(searchQuery) ||
    food.name_en.toLowerCase().includes(searchQuery)
  );
  const activeFoodName = isCustomFood ? customFoodName.trim() : selectedFood ? getFoodName(selectedFood) : '';
  const canSave = !!user && !!activeChild && !!activeFoodName && !!texture && !!acceptance;

  const handleSave = async () => {
    if (!canSave) {
      Toast.show({ type: 'error', text1: isEnglish ? 'Complete all fields' : 'Completează toate câmpurile' });
      return;
    }

    setIsSaving(true);
    try {
      const newFood: Omit<IntroducedFood, 'id'> = {
        childId: activeChild!.id,
        userId: user!.uid,
        name: activeFoodName,
        category: isCustomFood ? customFoodCategory : mapFoodCategory(selectedFood!.category),
        introducedAt: new Date().toISOString(),
        testDay: 1,
        isAllergen: !isCustomFood && selectedFood!.allergyRisk === 'high',
        reactionStatus: 'none',
        acceptance: acceptance!,
        texture: texture!,
        notes,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const id = await foodService.addIntroducedFood(user!.uid, activeChild!.id, newFood);
      addIntroducedFood({ ...newFood, id });
      Toast.show({
        type: 'success',
        text1: isEnglish ? 'Food added!' : 'Aliment adăugat!',
        text2: isEnglish ? 'We will track it for 3 days for reactions.' : 'Îl vom urmări 3 zile pentru reacții.',
      });
      router.back();
    } catch (error) {
      console.warn('Error adding food', error);
      Toast.show({ type: 'error', text1: isEnglish ? 'Something went wrong' : 'A apărut o eroare' });
    } finally {
      setIsSaving(false);
    }
  };

  const textures: { id: IntroducedFood['texture']; label: string }[] = [
    { id: 'puree', label: isEnglish ? 'Smooth puree' : 'Piure fin' },
    { id: 'mashed', label: isEnglish ? 'Mashed' : 'Pasat grosier' },
    { id: 'soft_pieces', label: isEnglish ? 'Soft pieces' : 'Bucăți moi' },
    { id: 'finger_food', label: 'Finger food' },
  ];

  const acceptances: { id: IntroducedFood['acceptance']; label: string; emoji: string }[] = [
    { id: 'liked', label: isEnglish ? 'Liked it' : 'I-a plăcut', emoji: '😋' },
    { id: 'neutral', label: isEnglish ? 'Neutral' : 'Neutru', emoji: '😐' },
    { id: 'refused', label: isEnglish ? 'Refused' : 'Refuzat', emoji: '🤏' },
  ];

  const categories: { id: IntroducedFood['category']; label: string }[] = [
    { id: 'vegetable', label: `🥕 ${isEnglish ? 'Vegetable' : 'Legumă'}` },
    { id: 'fruit', label: `🍎 ${isEnglish ? 'Fruit' : 'Fruct'}` },
    { id: 'protein', label: `🥩 ${isEnglish ? 'Protein' : 'Proteină'}` },
    { id: 'dairy', label: `🧀 ${isEnglish ? 'Dairy' : 'Lactat'}` },
    { id: 'cereal', label: `🌾 ${isEnglish ? 'Cereal' : 'Cereal'}` },
    { id: 'other', label: `🍽️ ${isEnglish ? 'Other' : 'Altele'}` },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backArrow}>×</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEnglish ? 'Introduce new food' : 'Introdu aliment nou'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: Spacing['3xl'] }}>
        <View style={styles.foodToggle}>
          <TouchableOpacity
            style={[styles.foodToggleBtn, !isCustomFood && styles.foodToggleBtnActive]}
            onPress={() => { setIsCustomFood(false); setCustomFoodName(''); }}
          >
            <Text style={[styles.foodToggleBtnText, !isCustomFood && styles.foodToggleBtnTextActive]}>
              📋 {isEnglish ? 'From list' : 'Din lista'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.foodToggleBtn, isCustomFood && styles.foodToggleBtnActive]}
            onPress={() => { setIsCustomFood(true); setSelectedFood(null); }}
          >
            <Text style={[styles.foodToggleBtnText, isCustomFood && styles.foodToggleBtnTextActive]}>
              ✏️ {isEnglish ? 'Custom food' : 'Aliment propriu'}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>
          {isCustomFood
            ? (isEnglish ? 'Food name' : 'Numele alimentului')
            : (isEnglish ? 'What new food did baby taste today?' : 'Ce aliment nou a gustat azi?')}
        </Text>

        {isCustomFood ? (
          <>
            <TextInput
              style={styles.input}
              value={customFoodName}
              onChangeText={setCustomFoodName}
              placeholder={isEnglish ? 'ex: homemade soup, rye bread...' : 'ex: supă de casă, pâine de secară...'}
              placeholderTextColor={Colors.textTertiary}
            />
            <Text style={styles.label}>{isEnglish ? 'Category' : 'Categorie'}</Text>
            <View style={styles.chipsRow}>
              {categories.map((category) => (
                <TouchableOpacity
                  key={category.id}
                  style={[styles.chip, customFoodCategory === category.id && styles.chipActive]}
                  onPress={() => setCustomFoodCategory(category.id)}
                >
                  <Text style={[styles.chipText, customFoodCategory === category.id && styles.chipTextActive]}>
                    {category.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        ) : (
          <>
            <TouchableOpacity style={styles.foodSelector} onPress={() => setShowSearchModal(true)}>
              {selectedFood ? (
                <View style={styles.selectedFoodRow}>
                  <View style={styles.foodThumb}>
                    <Text style={styles.foodThumbEmoji}>{getFoodEmoji(selectedFood)}</Text>
                  </View>
                  <Text style={styles.selectedFoodText}>{getFoodName(selectedFood)}</Text>
                </View>
              ) : (
                <Text style={styles.placeholderText}>{isEnglish ? 'Choose from list...' : 'Selectează din listă...'}</Text>
              )}
              <Text style={styles.selectorIcon}>▾</Text>
            </TouchableOpacity>
            {selectedFood && selectedFood.allergyRisk === 'high' && (
              <View style={styles.allergyAlert}>
                <Text style={styles.allergyAlertText}>
                  ⚠️ {isEnglish
                    ? 'This food is a common allergen. Watch your child carefully over the next few hours.'
                    : 'Acest aliment este un alergen comun. Urmărește copilul cu atenție în următoarele ore.'}
                </Text>
              </View>
            )}
          </>
        )}

        <Text style={styles.label}>{isEnglish ? 'What texture did it have?' : 'Ce textură a avut?'}</Text>
        <View style={styles.chipsRow}>
          {textures.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.chip, texture === item.id && styles.chipActive]}
              onPress={() => setTexture(item.id)}
            >
              <Text style={[styles.chipText, texture === item.id && styles.chipTextActive]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>{isEnglish ? 'How did baby accept it?' : 'Cum l-a acceptat?'}</Text>
        <View style={styles.chipsRow}>
          {acceptances.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.chip, acceptance === item.id && styles.chipActive]}
              onPress={() => setAcceptance(item.id)}
            >
              <Text style={[styles.chipText, acceptance === item.id && styles.chipTextActive]}>
                {item.emoji} {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>{isEnglish ? 'Notes (optional)' : 'Observații (opțional)'}</Text>
        <TextInput
          style={styles.input}
          value={notes}
          onChangeText={setNotes}
          placeholder={isEnglish ? 'How did it seem? Any reaction?' : 'Cum i s-a părut? S-a strâmbat?'}
          placeholderTextColor={Colors.textTertiary}
          multiline
        />

        <TouchableOpacity
          style={[styles.saveBtn, (!canSave || isSaving) && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={!canSave || isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.saveBtnText}>{isEnglish ? 'Save and track' : 'Salvează și urmărește'}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={showSearchModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => setShowSearchModal(false)} style={styles.modalCloseBtn}>
            <Text style={styles.modalCloseText}>×</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>{isEnglish ? 'Choose food' : 'Alege alimentul'}</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.searchBarContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder={isEnglish ? 'Search (e.g. Carrot, Apple)...' : 'Caută (ex: Morcov, Măr)...'}
            value={search}
            onChangeText={setSearch}
            autoFocus
          />
        </View>
        <ScrollView style={styles.modalScroll}>
          {searchResults.map((food) => (
            <TouchableOpacity
              key={food.key}
              style={styles.searchResultItem}
              onPress={() => {
                setSelectedFood(food);
                setShowSearchModal(false);
              }}
            >
              <View style={styles.searchResultEmojiBox}>
                <Text style={styles.searchResultEmoji}>{getFoodEmoji(food)}</Text>
              </View>
              <Text style={styles.searchResultName}>{getFoodName(food)}</Text>
              <View style={[styles.riskBadge, { backgroundColor: food.allergyRisk === 'high' ? Colors.error + '20' : Colors.success + '20' }]}>
                <Text style={[styles.riskText, { color: food.allergyRisk === 'high' ? Colors.error : Colors.success }]}>
                  {riskLabel(food.allergyRisk)}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
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
  label: { fontSize: 15, fontFamily: 'Geist-SemiBold', color: Colors.textPrimary, marginBottom: Spacing.sm, marginTop: Spacing.lg },
  foodToggle: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  foodToggleBtn: { flex: 1, paddingVertical: Spacing.sm, borderRadius: BorderRadius.xl, alignItems: 'center', backgroundColor: Colors.backgroundSoft, borderWidth: 1, borderColor: Colors.border },
  foodToggleBtnActive: { backgroundColor: Colors.feeding + '15', borderColor: Colors.feeding },
  foodToggleBtnText: { fontSize: 14, fontFamily: 'Geist-SemiBold', color: Colors.textSecondary },
  foodToggleBtnTextActive: { color: Colors.feeding },
  foodSelector: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.white, padding: Spacing.lg, borderRadius: BorderRadius.xl, borderWidth: 1, borderColor: Colors.border, ...Shadow.sm },
  selectedFoodRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
  selectedFoodText: { fontSize: 16, fontFamily: 'Geist-SemiBold', color: Colors.feeding },
  foodThumb: { width: 36, height: 36, borderRadius: BorderRadius.md, backgroundColor: Colors.backgroundSoft, alignItems: 'center', justifyContent: 'center' },
  foodThumbEmoji: { fontSize: 22 },
  placeholderText: { fontSize: 16, fontFamily: 'Geist', color: Colors.textTertiary },
  selectorIcon: { fontSize: 20, color: Colors.textSecondary },
  allergyAlert: { backgroundColor: Colors.error + '15', padding: Spacing.md, borderRadius: BorderRadius.lg, marginTop: Spacing.sm, borderWidth: 1, borderColor: Colors.error + '30' },
  allergyAlertText: { fontSize: 13, fontFamily: 'Geist', color: Colors.error, lineHeight: 18 },
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
  searchBarContainer: { padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border },
  searchInput: { backgroundColor: Colors.backgroundSoft, borderRadius: BorderRadius.lg, padding: Spacing.md, fontSize: 16, fontFamily: 'Geist' },
  modalScroll: { flex: 1 },
  searchResultItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border },
  searchResultEmojiBox: { width: 44, height: 44, borderRadius: BorderRadius.lg, backgroundColor: Colors.backgroundSoft, alignItems: 'center', justifyContent: 'center' },
  searchResultEmoji: { fontSize: 24 },
  searchResultName: { flex: 1, fontSize: 16, fontFamily: 'Geist-SemiBold', color: Colors.textPrimary },
  riskBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: BorderRadius.full },
  riskText: { fontSize: 12, fontFamily: 'Geist-SemiBold' },
});
