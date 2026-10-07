import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Colors } from '../../../theme/colors';
import { Spacing, BorderRadius, Shadow } from '../../../theme/spacing';
import { useFoodStore } from '../../../stores/foodStore';

interface ShoppingItem {
  id: string;
  name: string;
  category: CategoryKey;
  bought: boolean;
  isCustom?: boolean;
}

type CategoryKey = 'vegetables' | 'fruits' | 'proteins' | 'dairy' | 'cereals' | 'other';

const CATEGORY_META: Record<CategoryKey, { labelRo: string; labelEn: string; emoji: string; color: string }> = {
  vegetables: { labelRo: 'Legume', labelEn: 'Vegetables', emoji: '🥕', color: Colors.success },
  fruits: { labelRo: 'Fructe', labelEn: 'Fruits', emoji: '🍎', color: Colors.amber },
  proteins: { labelRo: 'Proteine', labelEn: 'Protein', emoji: '🥩', color: Colors.coral },
  dairy: { labelRo: 'Lactate', labelEn: 'Dairy', emoji: '🧀', color: Colors.milestone },
  cereals: { labelRo: 'Cereale', labelEn: 'Cereal', emoji: '🌾', color: Colors.taupe },
  other: { labelRo: 'Diverse', labelEn: 'Other', emoji: '🛒', color: Colors.slate },
};

const SUGGESTIONS_BY_AGE_RO: Record<string, Omit<ShoppingItem, 'id' | 'bought'>[]> = {
  '6': [
    { name: 'Morcovi bio', category: 'vegetables' },
    { name: 'Cartofi dulci', category: 'vegetables' },
    { name: 'Dovlecel', category: 'vegetables' },
    { name: 'Broccoli', category: 'vegetables' },
    { name: 'Banane coapte', category: 'fruits' },
    { name: 'Avocado copt', category: 'fruits' },
    { name: 'Pere', category: 'fruits' },
    { name: 'Piept de pui fără os', category: 'proteins' },
    { name: 'Linte roșie', category: 'proteins' },
    { name: 'Fulgi de ovăz fini', category: 'cereals' },
  ],
  '7': [
    { name: 'Morcovi bio', category: 'vegetables' },
    { name: 'Spanac proaspăt', category: 'vegetables' },
    { name: 'Sfeclă roșie', category: 'vegetables' },
    { name: 'Mango copt', category: 'fruits' },
    { name: 'Piersici', category: 'fruits' },
    { name: 'Iaurt natural integral', category: 'dairy' },
    { name: 'Brânză de vaci', category: 'dairy' },
    { name: 'Carne de vită tocată', category: 'proteins' },
    { name: 'Paste mici', category: 'cereals' },
    { name: 'Orez cu bob rotund', category: 'cereals' },
  ],
  '8': [
    { name: 'Somon file fără oase', category: 'proteins' },
    { name: 'Ouă întregi', category: 'proteins' },
    { name: 'Paste orzo', category: 'cereals' },
    { name: 'Pâine integrală', category: 'cereals' },
    { name: 'Afine', category: 'fruits' },
    { name: 'Zmeura', category: 'fruits' },
    { name: 'Tofu moale', category: 'proteins' },
    { name: 'Parmezan ras', category: 'dairy' },
    { name: 'Roșii cherry', category: 'vegetables' },
    { name: 'Ulei de măsline extra virgin', category: 'other' },
  ],
};

const SHOPPING_ITEM_EN: Record<string, string> = {
  'morcovi bio': 'Organic carrots',
  'cartofi dulci': 'Sweet potatoes',
  dovlecel: 'Zucchini',
  broccoli: 'Broccoli',
  'banane coapte': 'Ripe bananas',
  'avocado copt': 'Ripe avocado',
  pere: 'Pears',
  'piept de pui fara os': 'Boneless chicken breast',
  'linte rosie': 'Red lentils',
  'fulgi de ovaz fini': 'Fine oat flakes',
  'spanac proaspat': 'Fresh spinach',
  'sfecla rosie': 'Beetroot',
  'mango copt': 'Ripe mango',
  piersici: 'Peaches',
  'iaurt natural integral': 'Plain whole milk yogurt',
  'branza de vaci': 'Cottage cheese',
  'carne de vita tocata': 'Ground beef',
  'paste mici': 'Small pasta',
  'orez cu bob rotund': 'Short-grain rice',
  'somon file fara oase': 'Boneless salmon fillet',
  'oua intregi': 'Whole eggs',
  'paste orzo': 'Orzo pasta',
  'paine integrala': 'Whole wheat bread',
  afine: 'Blueberries',
  zmeura: 'Raspberries',
  'tofu moale': 'Soft tofu',
  'parmezan ras': 'Grated parmesan',
  'rosii cherry': 'Cherry tomatoes',
  'ulei de masline extra virgin': 'Extra virgin olive oil',
  mazare: 'Peas',
  morcov: 'Carrot',
  'cartof dulce': 'Sweet potato',
};

let nextId = 100;
const genId = () => `item-${nextId++}`;

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function labelForCategory(category: CategoryKey, isEnglish: boolean): string {
  const meta = CATEGORY_META[category];
  return isEnglish ? meta.labelEn : meta.labelRo;
}

function displayItemName(name: string, isEnglish: boolean): string {
  if (!isEnglish) return name;
  return SHOPPING_ITEM_EN[normalizeName(name)] ?? name;
}

function guessCategory(name: string): CategoryKey {
  const lower = normalizeName(name);
  if (/morcov|broccoli|cartof|dovle|spanac|sfecl|conopid|ardei|rosii|tomato|praz|fasole verde/.test(lower)) return 'vegetables';
  if (/banana|mar|para|piersic|mango|avocado|fruct|zmeura|afine|portocal|lamaie|mere|pear|apple|berries/.test(lower)) return 'fruits';
  if (/pui|vita|curcan|somon|cod|peste|ou|linte|naut|tofu|carne|chicken|beef|egg|salmon/.test(lower)) return 'proteins';
  if (/lapte|iaurt|branza|cas|smantana|parmezan|lactate|milk|yogurt|cheese|dairy/.test(lower)) return 'dairy';
  if (/orez|paste|paine|ovaz|gris|cereale|faina|stelline|rice|pasta|bread|oat/.test(lower)) return 'cereals';
  return 'other';
}

function buildMenuItems(menuFoodsStr: string): ShoppingItem[] {
  if (!menuFoodsStr) return [];
  return menuFoodsStr.split('||').filter(Boolean).map(name => ({
    id: genId(),
    name,
    category: guessCategory(name),
    bought: false,
    isCustom: false,
  }));
}

function buildInitialItems(ageMonths: number): ShoppingItem[] {
  let key = '6';
  if (ageMonths >= 8) key = '8';
  else if (ageMonths >= 7) key = '7';
  const suggestions = SUGGESTIONS_BY_AGE_RO[key] ?? SUGGESTIONS_BY_AGE_RO['6'];
  return suggestions.map(s => ({ ...s, id: genId(), bought: false }));
}

export default function ShoppingListScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ fromMenu?: string }>();
  const { profile } = useFoodStore();
  const { i18n } = useTranslation();
  const isEnglish = i18n.language === 'en';

  const ageMonths = useMemo(() => {
    if (!profile?.startedAt) return 6;
    const start = typeof profile.startedAt === 'string' ? new Date(profile.startedAt) : (profile.startedAt as any).toDate();
    const monthsAgo = Math.floor((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24 * 30));
    return Math.min(12, 6 + monthsAgo);
  }, [profile]);

  const fromMenuItems = useMemo(() => buildMenuItems(params.fromMenu ?? ''), [params.fromMenu]);
  const fromMenu = fromMenuItems.length > 0;

  const [items, setItems] = useState<ShoppingItem[]>(() =>
    fromMenu ? fromMenuItems : buildInitialItems(ageMonths),
  );
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState<CategoryKey>('other');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  const toggleItem = (id: string) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, bought: !item.bought } : item));
  };

  const deleteItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const addCustomItem = () => {
    const name = newItemName.trim();
    if (!name) return;
    setItems(prev => [...prev, { id: genId(), name, category: newItemCategory, bought: false, isCustom: true }]);
    setNewItemName('');
  };

  const clearBought = () => {
    Alert.alert(
      isEnglish ? 'Clear checked items' : 'Șterge cumpărate',
      isEnglish ? 'Remove all checked items?' : 'Vrei să elimini toate articolele bifate?',
      [
        { text: isEnglish ? 'Cancel' : 'Anulează', style: 'cancel' },
        { text: isEnglish ? 'Clear' : 'Șterge', style: 'destructive', onPress: () => setItems(prev => prev.filter(i => !i.bought)) },
      ],
    );
  };

  const shareList = () => {
    const unbought = items.filter(i => !i.bought);
    const lines = unbought.map(i => `• ${displayItemName(i.name, isEnglish)}`).join('\n');
    Alert.alert(
      isEnglish ? 'Send list' : 'Trimite lista',
      `${isEnglish ? 'Your shopping list' : 'Lista ta de cumpărături'} (${unbought.length} ${isEnglish ? 'items' : 'articole'}):\n\n${lines}`,
      [
        { text: isEnglish ? 'Close' : 'Închide', style: 'cancel' },
        { text: isEnglish ? 'Copy text' : 'Copiază text', onPress: () => Alert.alert('', isEnglish ? 'List copied!' : 'Lista a fost copiată!') },
      ],
    );
  };

  const grouped = useMemo(() => {
    const map: Partial<Record<CategoryKey, ShoppingItem[]>> = {};
    for (const item of items) {
      if (!map[item.category]) map[item.category] = [];
      map[item.category]!.push(item);
    }
    return map;
  }, [items]);

  const boughtCount = items.filter(i => i.bought).length;
  const totalCount = items.length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEnglish ? 'Shopping list' : 'Lista cumpărături'}</Text>
        {boughtCount > 0 ? (
          <TouchableOpacity onPress={clearBought}>
            <Text style={styles.clearText}>{isEnglish ? 'Clear checked' : 'Șterge bif.'}</Text>
          </TouchableOpacity>
        ) : <View style={styles.headerRight} />}
      </View>

      <View style={styles.progressCard}>
        <View style={styles.progressRow}>
          <Text style={styles.progressLabel}>{isEnglish ? 'Shopping progress' : 'Progres cumpărături'}</Text>
          <Text style={styles.progressCount}>{boughtCount}/{totalCount}</Text>
        </View>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: totalCount > 0 ? `${(boughtCount / totalCount) * 100}%` : '0%' as `${number}%` }]} />
        </View>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {fromMenu && (
          <View style={styles.menuBanner}>
            <Text style={styles.menuBannerEmoji}>📅</Text>
            <View style={styles.menuBannerText}>
              <Text style={styles.menuBannerTitle}>{isEnglish ? 'Generated from weekly menu' : 'Generată din meniul săptămânal'}</Text>
              <Text style={styles.menuBannerSub}>
                {fromMenuItems.length} {isEnglish ? 'foods imported automatically' : 'alimente importate automat'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.menuBannerBtn}
              onPress={() => router.push('/modules/food/weekly-menu')}
            >
              <Text style={styles.menuBannerBtnText}>{isEnglish ? 'Edit' : 'Editează'}</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.addSection}>
          <Text style={styles.addSectionTitle}>{isEnglish ? 'Add item' : 'Adaugă articol'}</Text>
          <View style={styles.addRow}>
            <TextInput
              style={styles.addInput}
              value={newItemName}
              onChangeText={setNewItemName}
              placeholder={isEnglish ? 'Product name...' : 'Nume produs...'}
              placeholderTextColor={Colors.textTertiary}
              returnKeyType="done"
              onSubmitEditing={addCustomItem}
            />
            <TouchableOpacity style={styles.addBtn} onPress={addCustomItem}>
              <Text style={styles.addBtnText}>+</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.categoryPickerBtn}
            onPress={() => setShowCategoryPicker(!showCategoryPicker)}
          >
            <Text style={styles.categoryPickerText}>
              {CATEGORY_META[newItemCategory].emoji} {labelForCategory(newItemCategory, isEnglish)}
            </Text>
            <Text style={styles.categoryPickerArrow}>{showCategoryPicker ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          {showCategoryPicker && (
            <View style={styles.categoryOptions}>
              {(Object.keys(CATEGORY_META) as CategoryKey[]).map(key => (
                <TouchableOpacity
                  key={key}
                  style={[styles.categoryOption, newItemCategory === key && styles.categoryOptionActive]}
                  onPress={() => { setNewItemCategory(key); setShowCategoryPicker(false); }}
                >
                  <Text style={styles.categoryOptionText}>
                    {CATEGORY_META[key].emoji} {labelForCategory(key, isEnglish)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {(Object.keys(CATEGORY_META) as CategoryKey[]).map(catKey => {
          const catItems = grouped[catKey];
          if (!catItems || catItems.length === 0) return null;
          const meta = CATEGORY_META[catKey];
          return (
            <View key={catKey} style={styles.categorySection}>
              <View style={styles.categoryHeader}>
                <Text style={styles.categoryEmoji}>{meta.emoji}</Text>
                <Text style={styles.categoryLabel}>{labelForCategory(catKey, isEnglish)}</Text>
                <View style={[styles.categoryBadge, { backgroundColor: meta.color + '20' }]}>
                  <Text style={[styles.categoryBadgeText, { color: meta.color }]}>{catItems.length}</Text>
                </View>
              </View>
              {catItems.map(item => (
                <View key={item.id} style={[styles.itemCard, item.bought && styles.itemCardBought]}>
                  <TouchableOpacity style={styles.checkbox} onPress={() => toggleItem(item.id)}>
                    <View style={[styles.checkboxInner, item.bought && styles.checkboxChecked]}>
                      {item.bought && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                  </TouchableOpacity>
                  <Text style={[styles.itemName, item.bought && styles.itemNameBought]} numberOfLines={1}>
                    {displayItemName(item.name, isEnglish)}
                    {item.isCustom && <Text style={styles.customBadge}> ✏️</Text>}
                  </Text>
                  <TouchableOpacity onPress={() => deleteItem(item.id)} style={styles.deleteBtn}>
                    <Text style={styles.deleteIcon}>×</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          );
        })}

        {items.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🛒</Text>
            <Text style={styles.emptyTitle}>{isEnglish ? 'The list is empty' : 'Lista e goală'}</Text>
            <Text style={styles.emptyText}>{isEnglish ? 'Add items above' : 'Adaugă articole de mai sus'}</Text>
          </View>
        )}

        <View style={styles.bottomSpacing} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.shareBtn} onPress={shareList}>
          <Text style={styles.shareBtnText}>📤  {isEnglish ? 'Send list' : 'Trimite lista'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  backBtn: { width: 40, height: 40, borderRadius: BorderRadius.full, backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center', ...Shadow.sm },
  backIcon: { fontSize: 18, color: Colors.textPrimary },
  headerTitle: { flex: 1, fontFamily: 'Fraunces', fontSize: 18, color: Colors.textPrimary, textAlign: 'center' },
  clearText: { fontFamily: 'Geist-SemiBold', fontSize: 13, color: Colors.error },
  headerRight: { width: 60 },
  progressCard: { marginHorizontal: Spacing.lg, backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.lg, marginBottom: Spacing.md, ...Shadow.sm },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  progressLabel: { fontFamily: 'Geist-SemiBold', fontSize: 14, color: Colors.textPrimary },
  progressCount: { fontFamily: 'Geist-Bold', fontSize: 14, color: Colors.food },
  progressBar: { height: 8, backgroundColor: Colors.backgroundSoft, borderRadius: BorderRadius.full, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.food, borderRadius: BorderRadius.full },
  scroll: { flex: 1 },
  menuBanner: { marginHorizontal: Spacing.lg, marginBottom: Spacing.md, backgroundColor: Colors.feeding + '15', borderRadius: BorderRadius.xl, padding: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: Spacing.md, borderWidth: 1, borderColor: Colors.feeding + '30' },
  menuBannerEmoji: { fontSize: 28 },
  menuBannerText: { flex: 1 },
  menuBannerTitle: { fontSize: 14, fontFamily: 'Geist-SemiBold', color: Colors.textPrimary },
  menuBannerSub: { fontSize: 12, fontFamily: 'Geist', color: Colors.textSecondary },
  menuBannerBtn: { backgroundColor: Colors.feeding, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: BorderRadius.full },
  menuBannerBtnText: { fontSize: 12, fontFamily: 'Geist-SemiBold', color: Colors.white },
  addSection: { marginHorizontal: Spacing.lg, marginBottom: Spacing.md },
  addSectionTitle: { fontFamily: 'Geist-SemiBold', fontSize: 14, color: Colors.textSecondary, marginBottom: Spacing.sm },
  addRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  addInput: { flex: 1, height: 48, backgroundColor: Colors.white, borderRadius: BorderRadius.lg, paddingHorizontal: Spacing.md, fontFamily: 'Geist', fontSize: 15, color: Colors.textPrimary, ...Shadow.sm },
  addBtn: { width: 48, height: 48, borderRadius: BorderRadius.lg, backgroundColor: Colors.food, alignItems: 'center', justifyContent: 'center' },
  addBtnText: { fontSize: 24, color: Colors.white, lineHeight: 28 },
  categoryPickerBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderRadius: BorderRadius.lg, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, justifyContent: 'space-between', ...Shadow.sm },
  categoryPickerText: { fontFamily: 'Geist-SemiBold', fontSize: 14, color: Colors.textPrimary },
  categoryPickerArrow: { fontSize: 12, color: Colors.textTertiary },
  categoryOptions: { backgroundColor: Colors.white, borderRadius: BorderRadius.lg, marginTop: Spacing.xs, ...Shadow.md, overflow: 'hidden' },
  categoryOption: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2, borderBottomWidth: 1, borderBottomColor: Colors.border },
  categoryOptionActive: { backgroundColor: Colors.food + '15' },
  categoryOptionText: { fontFamily: 'Geist-SemiBold', fontSize: 14, color: Colors.textPrimary },
  categorySection: { marginHorizontal: Spacing.lg, marginBottom: Spacing.md },
  categoryHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  categoryEmoji: { fontSize: 18 },
  categoryLabel: { fontFamily: 'Geist-Bold', fontSize: 15, color: Colors.textPrimary, flex: 1 },
  categoryBadge: { borderRadius: BorderRadius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  categoryBadgeText: { fontFamily: 'Geist-Bold', fontSize: 12 },
  itemCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.xs, gap: Spacing.md, ...Shadow.sm },
  itemCardBought: { opacity: 0.55 },
  checkbox: { padding: Spacing.xs / 2 },
  checkboxInner: { width: 24, height: 24, borderRadius: BorderRadius.sm, borderWidth: 2, borderColor: Colors.food, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: Colors.food, borderColor: Colors.food },
  checkmark: { fontSize: 13, color: Colors.white, fontFamily: 'Geist-Bold' },
  itemName: { flex: 1, fontFamily: 'Geist-SemiBold', fontSize: 15, color: Colors.textPrimary },
  itemNameBought: { textDecorationLine: 'line-through', color: Colors.textTertiary },
  customBadge: { fontSize: 12 },
  deleteBtn: { padding: Spacing.xs },
  deleteIcon: { fontSize: 14, color: Colors.textTertiary },
  emptyState: { alignItems: 'center', paddingVertical: Spacing['3xl'] },
  emptyEmoji: { fontSize: 48, marginBottom: Spacing.md },
  emptyTitle: { fontFamily: 'Fraunces', fontSize: 20, color: Colors.textPrimary, marginBottom: Spacing.xs },
  emptyText: { fontFamily: 'Geist', fontSize: 14, color: Colors.textSecondary },
  bottomSpacing: { height: 100 },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: Spacing.lg, paddingBottom: Spacing.xl, backgroundColor: Colors.white, ...Shadow.md },
  shareBtn: { backgroundColor: Colors.food, borderRadius: BorderRadius.xl, paddingVertical: Spacing.lg, alignItems: 'center' },
  shareBtnText: { fontFamily: 'Geist-Bold', fontSize: 16, color: Colors.white },
});
