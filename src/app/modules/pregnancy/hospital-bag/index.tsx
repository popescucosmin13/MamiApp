import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../../../stores/authStore';
import { usePregnancyStore } from '../../../../stores/pregnancyStore';
import { pregnancyService } from '../../../../services/pregnancyService';
import { ChecklistItem } from '../../../../types/pregnancy';
import { Colors } from '../../../../theme/colors';
import { Spacing, BorderRadius, Shadow } from '../../../../theme/spacing';

const DEFAULT_BAG_ITEMS: ChecklistItem[] = [
  // Acte
  { item: '📋 Carte de identitate', done: false },
  { item: '📋 Card sănătate / asigurare', done: false },
  { item: '📋 Fișa medicală / ecografii', done: false },
  { item: '📋 Grup sânge (hârtie)', done: false },
  // Mamă îmbrăcăminte
  { item: '👚 Cămăși de noapte (2-3)', done: false },
  { item: '🩱 Sutiene pentru alăptat', done: false },
  { item: '🩴 Papuci confortabili', done: false },
  { item: '🧥 Trening/pijama largă', done: false },
  { item: '🧦 Ciorapi compresie', done: false },
  // Igienă mamă
  { item: '🧴 Produse igienă personală', done: false },
  { item: '🩹 Absorbante postpartum', done: false },
  { item: '🧴 Cremă pentru mameloane', done: false },
  { item: '💊 Medicamente prescrise', done: false },
  // Bebeluș
  { item: '👶 Body-uri bebe (3-4)', done: false },
  { item: '🧦 Șosete bebe', done: false },
  { item: '🎩 Căciulă bebe', done: false },
  { item: '🧷 Scutece NB (10-15)', done: false },
  { item: '🧴 Șervețele umede', done: false },
  { item: '🛁 Prosop bebe', done: false },
  { item: '🍼 Sac de dormit bebe', done: false },
  // Ieșire din spital
  { item: '👗 Outfit ieșire spital', done: false },
  { item: '🚗 Scaun auto omologat', done: false },
  // Extra
  { item: '📱 Încărcătoare telefon', done: false },
  { item: '🎵 Căști + muzică relaxantă', done: false },
  { item: '💰 Cash pentru eventualități', done: false },
];

const CATEGORIES = [
  { key: 'all', label: 'Toate' },
  { key: 'done', label: '✓ Bifate' },
  { key: 'pending', label: '○ Nebifate' },
];

export default function HospitalBagScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { pregnancy, updatePregnancy } = usePregnancyStore();

  const items: ChecklistItem[] = pregnancy?.bagChecklist?.length
    ? pregnancy.bagChecklist
    : DEFAULT_BAG_ITEMS;

  const [filter, setFilter] = useState<'all' | 'done' | 'pending'>('all');
  const [newItem, setNewItem] = useState('');

  const doneCount = items.filter((i) => i.done).length;
  const progress = items.length > 0 ? (doneCount / items.length) * 100 : 0;

  const filtered = items.filter((item) => {
    if (filter === 'done') return item.done;
    if (filter === 'pending') return !item.done;
    return true;
  });

  const toggleItem = async (index: number) => {
    const globalIndex = items.findIndex((it) => it.item === filtered[index].item);
    const updated = items.map((it, i) => i === globalIndex ? { ...it, done: !it.done } : it);
    updatePregnancy({ bagChecklist: updated });
    if (user) {
      pregnancyService.updatePregnancy(user.uid, { bagChecklist: updated }).catch(() => {});
    }
  };

  const addItem = async () => {
    if (!newItem.trim()) return;
    const updated = [...items, { item: newItem.trim(), done: false }];
    updatePregnancy({ bagChecklist: updated });
    if (user) {
      pregnancyService.updatePregnancy(user.uid, { bagChecklist: updated }).catch(() => {});
    }
    setNewItem('');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Geantă maternitate 🎒</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Progress */}
        <View style={styles.progressCard}>
          <View style={styles.progressTop}>
            <Text style={styles.progressText}>{doneCount} / {items.length} bifate</Text>
            <Text style={styles.progressPct}>{Math.round(progress)}%</Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
          {progress === 100 && (
            <Text style={styles.readyText}>🎉 Geanta este pregătită!</Text>
          )}
        </View>

        {/* Filter */}
        <View style={styles.filterRow}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.key}
              style={[styles.filterChip, filter === cat.key && styles.filterChipActive]}
              onPress={() => setFilter(cat.key as any)}
            >
              <Text style={[styles.filterChipText, filter === cat.key && styles.filterChipTextActive]}>
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Items */}
        <View style={styles.list}>
          {filtered.map((item, i) => (
            <TouchableOpacity key={i} style={styles.itemRow} onPress={() => toggleItem(i)}>
              <View style={[styles.checkbox, item.done && styles.checkboxDone]}>
                {item.done && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={[styles.itemText, item.done && styles.itemTextDone]}>
                {item.item}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Add item */}
        <View style={styles.addRow}>
          <TextInput
            style={styles.addInput}
            value={newItem}
            onChangeText={setNewItem}
            placeholder="Adaugă alt articol..."
            placeholderTextColor={Colors.textTertiary}
            onSubmitEditing={addItem}
            returnKeyType="done"
          />
          <TouchableOpacity style={styles.addBtn} onPress={addItem}>
            <Text style={styles.addBtnText}>+</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.tipCard}>
          <Text style={styles.tipTitle}>💡 Sfat</Text>
          <Text style={styles.tipText}>
            Pregătiți geanta din săptămâna 36. Verificați că scaunul auto este instalat corect înainte de naștere.
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
  progressCard: {
    margin: Spacing.xl, backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.xl, ...Shadow.sm,
  },
  progressTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.sm },
  progressText: { fontSize: 14, fontFamily: 'Geist-SemiBold', color: Colors.textSecondary },
  progressPct: { fontSize: 14, fontFamily: 'Geist-SemiBold', color: Colors.pregnancy.primary },
  progressBar: { height: 8, backgroundColor: Colors.backgroundSoft, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: 8, backgroundColor: Colors.pregnancy.primary, borderRadius: 4 },
  readyText: { fontSize: 14, fontFamily: 'Geist-SemiBold', color: Colors.success, marginTop: Spacing.sm, textAlign: 'center' },
  filterRow: { flexDirection: 'row', paddingHorizontal: Spacing.xl, marginBottom: Spacing.lg, gap: Spacing.sm },
  filterChip: {
    flex: 1, height: 34, borderRadius: BorderRadius.full, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.white,
  },
  filterChipActive: { backgroundColor: Colors.pregnancy.primary, borderColor: Colors.pregnancy.primary },
  filterChipText: { fontSize: 12, fontFamily: 'Geist', color: Colors.textSecondary },
  filterChipTextActive: { color: Colors.white, fontFamily: 'Geist-SemiBold' },
  list: { paddingHorizontal: Spacing.xl, gap: 2, marginBottom: Spacing.lg },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.sm },
  checkbox: {
    width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  checkboxDone: { backgroundColor: Colors.pregnancy.primary, borderColor: Colors.pregnancy.primary },
  checkmark: { fontSize: 14, color: Colors.white, fontFamily: 'Geist-SemiBold' },
  itemText: { flex: 1, fontSize: 14, fontFamily: 'Geist', color: Colors.textPrimary },
  itemTextDone: { color: Colors.textTertiary, textDecorationLine: 'line-through' },
  addRow: { flexDirection: 'row', paddingHorizontal: Spacing.xl, marginBottom: Spacing.lg, gap: Spacing.sm },
  addInput: {
    flex: 1, height: 44, borderRadius: BorderRadius.lg, borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.white, paddingHorizontal: Spacing.md,
    fontSize: 14, fontFamily: 'Geist', color: Colors.textPrimary,
  },
  addBtn: {
    width: 44, height: 44, borderRadius: BorderRadius.lg, backgroundColor: Colors.pregnancy.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  addBtnText: { fontSize: 22, color: Colors.white, fontWeight: '300' },
  tipCard: {
    marginHorizontal: Spacing.xl, marginBottom: Spacing['2xl'],
    backgroundColor: Colors.pregnancy.primaryLight, borderRadius: BorderRadius.xl, padding: Spacing.lg,
  },
  tipTitle: { fontSize: 14, fontFamily: 'Geist-SemiBold', color: Colors.textPrimary, marginBottom: Spacing.xs },
  tipText: { fontSize: 13, fontFamily: 'Geist', color: Colors.textSecondary, lineHeight: 19 },
});
