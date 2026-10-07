import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../../../stores/authStore';
import { useChildStore } from '../../../../stores/childStore';
import { useFoodStore } from '../../../../stores/foodStore';
import { foodService } from '../../../../services/foodService';
import { Colors } from '../../../../theme/colors';
import { Spacing, BorderRadius, Shadow } from '../../../../theme/spacing';
import { useState } from 'react';
import Toast from 'react-native-toast-message';
import { FOODS_MASTER } from '../../../../types/food';

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

const FOOD_FALLBACKS: Record<string, { en: string; ro: string }> = {
  morcov: { en: 'Carrot', ro: 'Morcov' },
  mazare: { en: 'Peas', ro: 'Mazăre' },
  'cartof dulce': { en: 'Sweet potato', ro: 'Cartof dulce' },
  cartof: { en: 'Potato', ro: 'Cartof' },
  dovlecel: { en: 'Zucchini', ro: 'Dovlecel' },
};

function findFoodFallback(name: string) {
  const normalized = normalizeFoodName(name);
  return Object.entries(FOOD_FALLBACKS).find(([key]) => normalized === key || normalized.includes(key))?.[1];
}

function acceptanceLabel(value: string | undefined, isEnglish: boolean): string {
  const labels: Record<string, { ro: string; en: string }> = {
    liked: { ro: 'Plăcut', en: 'Liked' },
    neutral: { ro: 'Neutru', en: 'Neutral' },
    refused: { ro: 'Refuzat', en: 'Refused' },
    unknown: { ro: 'Necunoscut', en: 'Unknown' },
  };
  const label = labels[value || 'unknown'] ?? labels.unknown;
  return isEnglish ? label.en : label.ro;
}

export default function FoodDetailScreen() {
  const router = useRouter();
  const { i18n } = useTranslation();
  const isEnglish = i18n.language === 'en';
  const { id } = useLocalSearchParams();
  const { user } = useAuthStore();
  const { activeChild } = useChildStore();
  const { introducedFoods, updateIntroducedFood } = useFoodStore();

  const [isSaving, setIsSaving] = useState(false);

  const food = introducedFoods.find(f => f.id === id);
  const masterFood = food ? findMasterFood(food.name) : undefined;
  const fallbackFood = food ? findFoodFallback(food.name) : undefined;
  const displayFoodName = food
    ? masterFood
      ? (isEnglish ? masterFood.name_en : masterFood.name_ro)
      : fallbackFood
        ? (isEnglish ? fallbackFood.en : fallbackFood.ro)
        : food.name
    : '';

  if (!food) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.emptyText}>{isEnglish ? 'Food not found.' : 'Alimentul nu a fost gasit.'}</Text>
      </SafeAreaView>
    );
  }

  const handleNextDay = async () => {
    if (!user || !activeChild) return;
    setIsSaving(true);
    try {
      let newTestDay: any = typeof food.testDay === 'number' ? food.testDay + 1 : 'completed';
      if (newTestDay > 3) newTestDay = 'completed';

      await foodService.updateIntroducedFood(user.uid, activeChild.id, food.id!, { testDay: newTestDay });
      updateIntroducedFood(food.id!, { testDay: newTestDay });
      Toast.show({ type: 'success', text1: isEnglish ? 'Day marked successfully!' : 'Zi marcata cu succes!' });
      if (newTestDay === 'completed') {
         router.back();
      }
    } catch (e) {
      console.warn('Eroare update test day', e);
      Toast.show({ type: 'error', text1: isEnglish ? 'An error occurred' : 'A aparut o eroare' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{displayFoodName}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: Spacing['3xl'] }}>
        <View style={styles.infoCard}>
          <Text style={styles.label}>{isEnglish ? 'Introduction details' : 'Detalii introducere'}</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>{isEnglish ? 'First test date:' : 'Data primei testari:'}</Text>
            <Text style={styles.rowValue}>{new Date(food.introducedAt as string).toLocaleDateString(isEnglish ? 'en-US' : 'ro-RO')}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>{isEnglish ? 'Allergen:' : 'Alergen:'}</Text>
            <Text style={[styles.rowValue, food.isAllergen && { color: Colors.error }]}>{food.isAllergen ? (isEnglish ? 'Yes' : 'Da') : (isEnglish ? 'No' : 'Nu')}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>{isEnglish ? 'Reaction noted:' : 'Reactie notata:'}</Text>
            <Text style={[styles.rowValue, food.reactionStatus !== 'none' && { color: Colors.error }]}>
              {food.reactionStatus === 'none' ? (isEnglish ? 'None' : 'Niciuna') : food.reactionStatus}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>{isEnglish ? 'Initial acceptance:' : 'Acceptare initiala:'}</Text>
            <Text style={styles.rowValue}>{acceptanceLabel(food.acceptance, isEnglish)}</Text>
          </View>
        </View>

        {food.testDay !== 'completed' && (
          <View style={styles.trackerCard}>
            <Text style={styles.trackerTitle}>{isEnglish ? '3-day rule' : 'Regula de 3 zile'}</Text>
            <Text style={styles.trackerDesc}>
              {isEnglish ? 'You are on ' : 'Esti la '}
              <Text style={{fontFamily: 'Geist-Bold'}}>{isEnglish ? `day ${food.testDay}` : `ziua ${food.testDay}`}</Text>
              {isEnglish
                ? ' of testing. If your baby has not had allergic reactions today, you can move forward.'
                : ' de testare. Dacă bebelușul nu a prezentat reacții alergice astăzi, poți avansa.'}
            </Text>
            <TouchableOpacity 
              style={styles.actionBtn}
              onPress={handleNextDay}
              disabled={isSaving}
            >
              {isSaving ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.actionBtnText}>{isEnglish ? `Mark day ${food.testDay} as successful` : `Bifeaza ziua ${food.testDay} cu succes`}</Text>}
            </TouchableOpacity>
          </View>
        )}

        {food.testDay === 'completed' && (
          <View style={styles.successCard}>
            <Text style={styles.successEmoji}>✅</Text>
            <Text style={styles.successTitle}>{isEnglish ? 'Testing complete' : 'Testare completa'}</Text>
            <Text style={styles.successText}>{isEnglish ? 'This food was tested successfully and can be combined with other foods already tested.' : 'Acest aliment a fost testat cu succes si poate fi combinat cu alte alimente testate deja.'}</Text>
          </View>
        )}

      </ScrollView>
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
  emptyText: { textAlign: 'center', color: Colors.textSecondary, fontFamily: 'Geist', marginTop: Spacing.xl },
  
  infoCard: { backgroundColor: Colors.white, padding: Spacing.xl, borderRadius: BorderRadius.xl, marginBottom: Spacing.xl, borderWidth: 1, borderColor: Colors.border, ...Shadow.sm },
  label: { fontSize: 16, fontFamily: 'Geist-Bold', color: Colors.textPrimary, marginBottom: Spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.sm },
  rowLabel: { fontSize: 14, fontFamily: 'Geist', color: Colors.textSecondary },
  rowValue: { fontSize: 14, fontFamily: 'Geist-SemiBold', color: Colors.textPrimary },

  trackerCard: { backgroundColor: Colors.feeding + '10', padding: Spacing.xl, borderRadius: BorderRadius.xl, borderWidth: 1, borderColor: Colors.feeding + '40' },
  trackerTitle: { fontSize: 16, fontFamily: 'Geist-Bold', color: Colors.feeding, marginBottom: Spacing.xs },
  trackerDesc: { fontSize: 14, fontFamily: 'Geist', color: Colors.textSecondary, lineHeight: 20, marginBottom: Spacing.lg },
  actionBtn: { backgroundColor: Colors.feeding, height: 48, borderRadius: BorderRadius.lg, alignItems: 'center', justifyContent: 'center' },
  actionBtnText: { color: Colors.white, fontSize: 15, fontFamily: 'Geist-SemiBold' },

  successCard: { alignItems: 'center', backgroundColor: Colors.success + '10', padding: Spacing.xl, borderRadius: BorderRadius.xl, borderWidth: 1, borderColor: Colors.success + '40' },
  successEmoji: { fontSize: 40, marginBottom: Spacing.sm },
  successTitle: { fontSize: 18, fontFamily: 'Geist-Bold', color: Colors.success, marginBottom: Spacing.xs },
  successText: { fontSize: 14, fontFamily: 'Geist', color: Colors.success, textAlign: 'center', lineHeight: 20 },
});
