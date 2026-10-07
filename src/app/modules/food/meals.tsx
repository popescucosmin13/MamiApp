import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useFoodStore } from '../../../stores/foodStore';
import { Colors } from '../../../theme/colors';
import { Spacing, BorderRadius, Shadow } from '../../../theme/spacing';

export default function MealsScreen() {
  const router = useRouter();
  const { i18n } = useTranslation();
  const isEnglish = i18n.language === 'en';
  const { meals } = useFoodStore();

  const mealTypeMap: any = isEnglish
    ? { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' }
    : { breakfast: 'Mic dejun', lunch: 'Prânz', dinner: 'Cina', snack: 'Gustare' };
  const acceptanceMap: any = isEnglish
    ? { good: '😋 Ate everything', medium: '🙂 Medium', poor: '🤏 A little / Refused' }
    : { good: '😋 A mancat tot', medium: '🙂 Mediu', poor: '🤏 Putin / Refuz' };
  const textureMap: any = isEnglish
    ? { puree: 'smooth puree', mashed: 'mashed', soft_pieces: 'soft pieces', finger_food: 'finger food', mixed: 'mixed' }
    : { puree: 'piure fin', mashed: 'pasat grosier', soft_pieces: 'bucăți moi', finger_food: 'finger food', mixed: 'mixt' };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEnglish ? 'Meal history' : 'Istoric mese'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: Spacing['3xl'] }}>
        {meals.length === 0 ? (
          <Text style={styles.emptyText}>{isEnglish ? 'You have not added any meals yet.' : 'Nu ai adăugat nicio masă încă.'}</Text>
        ) : (
          meals.map(meal => {
            const d = meal.date as any;
            const date = d?.toDate ? d.toDate() : (typeof d === 'string' ? new Date(d) : null);
            const dateStr = date ? date.toLocaleDateString(isEnglish ? 'en-US' : 'ro-RO') : '';
            
            return (
              <View key={meal.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.mealType}>{mealTypeMap[meal.mealType] || (isEnglish ? 'Meal' : 'Masa')}</Text>
                  <Text style={styles.mealDate}>{dateStr}</Text>
                </View>
                <Text style={styles.foodsList}>{meal.foods.map(f => f.name).join(', ')}</Text>
                <View style={styles.cardFooter}>
                  <Text style={styles.acceptance}>{acceptanceMap[meal.acceptance]}</Text>
                  <Text style={styles.texture}>{isEnglish ? 'Texture' : 'Textura'}: {textureMap[meal.texture] || meal.texture}</Text>
                </View>
                {meal.notes ? <Text style={styles.notes}>"{meal.notes}"</Text> : null}
              </View>
            );
          })
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
  card: { backgroundColor: Colors.white, padding: Spacing.lg, borderRadius: BorderRadius.xl, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border, ...Shadow.sm },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.xs },
  mealType: { fontSize: 14, fontFamily: 'Geist-SemiBold', color: Colors.feeding },
  mealDate: { fontSize: 12, fontFamily: 'Geist', color: Colors.textTertiary },
  foodsList: { fontSize: 16, fontFamily: 'Geist-Bold', color: Colors.textPrimary, marginBottom: Spacing.sm },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.xs },
  acceptance: { fontSize: 14, fontFamily: 'Geist', color: Colors.textSecondary },
  texture: { fontSize: 12, fontFamily: 'Geist', color: Colors.textTertiary },
  notes: { fontSize: 13, fontFamily: 'Geist-Italic', color: Colors.textSecondary, marginTop: Spacing.xs, backgroundColor: Colors.backgroundSoft, padding: Spacing.sm, borderRadius: BorderRadius.md },
});
