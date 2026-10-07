import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../../stores/authStore';
import { useChildStore } from '../../../stores/childStore';
import { useFoodStore } from '../../../stores/foodStore';
import { foodService } from '../../../services/foodService';
import { Colors } from '../../../theme/colors';
import { Spacing, BorderRadius, Shadow } from '../../../theme/spacing';

export default function StartDiversification() {
  const router = useRouter();
  const { i18n } = useTranslation();
  const isEnglish = i18n.language === 'en';
  const { user } = useAuthStore();
  const { activeChild } = useChildStore();
  const { setProfile } = useFoodStore();
  
  const [isSaving, setIsSaving] = useState(false);

  const checks = isEnglish
    ? [
        'Is your baby around 6 months old?',
        'Can baby sit with support?',
        'Can baby hold their head steady?',
        'Does baby show interest in your food?',
        'Can baby bring objects to their mouth?',
      ]
    : [
        'Are aproximativ 6 luni?',
        'Stă în șezut cu sprijin?',
        'Își ține capul stabil?',
        'Arată interes pentru mâncarea ta?',
        'Poate duce obiecte la gura singur?',
      ];
  
  const [checkedItems, setCheckedItems] = useState<boolean[]>(new Array(checks.length).fill(false));

  const toggleCheck = (index: number) => {
    const newChecks = [...checkedItems];
    newChecks[index] = !newChecks[index];
    setCheckedItems(newChecks);
  };

  const allChecked = checkedItems.every(c => c);

  const handleComplete = async () => {
    if (!user || !activeChild) return;
    setIsSaving(true);
    try {
      const newProfile: any = {
        status: 'active',
        method: 'mixed',
        mealsPerDay: 1,
        restrictions: [],
      };
      await foodService.upsertProfile(user.uid, activeChild.id, newProfile);
      setProfile(newProfile as any);
      router.back();
    } catch (e) {
      console.warn('Error starting weaning', e);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backArrow}>×</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEnglish ? 'Start weaning' : 'Start diversificare'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: Spacing['3xl'] }}>
        <View style={styles.stepContainer}>
          <Text style={styles.emoji}>👶</Text>
          <Text style={styles.title}>{isEnglish ? 'Readiness signs' : 'Semne de pregătire'}</Text>
          <Text style={styles.subtitle}>
            {isEnglish
              ? 'According to pediatric guidance (CDC, AAP), baby is ready for solids when these signs are present. Tick the ones you notice:'
              : 'Conform medicilor pediatri (CDC, AAP), bebelușul este pregătit pentru solide când îndeplinește următoarele condiții. Bifează-le pe cele pe care le observi:'}
          </Text>

          <View style={styles.checklist}>
            {checks.map((check, idx) => (
              <TouchableOpacity 
                key={idx} 
                style={[styles.checkItem, checkedItems[idx] && styles.checkItemActive]} 
                onPress={() => toggleCheck(idx)}
                activeOpacity={0.7}
              >
                <View style={[styles.checkbox, checkedItems[idx] && styles.checkboxActive]}>
                  {checkedItems[idx] && <Text style={styles.checkMark}>✓</Text>}
                </View>
                <Text style={[styles.checkText, checkedItems[idx] && styles.checkTextActive]}>{check}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.alertBox}>
            <Text style={styles.alertText}>
              {isEnglish
                ? 'This guide is informational. For prematurity, allergies, growth concerns, medical conditions or special situations, talk to your pediatrician first.'
                : 'Acest ghid este informativ. Pentru prematuritate, alergii, probleme de creștere, boli sau situații speciale, discută obligatoriu cu pediatrul.'}
            </Text>
          </View>

          <TouchableOpacity 
            style={[styles.nextBtn, (!allChecked || isSaving) && styles.nextBtnDisabled]}
            onPress={handleComplete}
            disabled={!allChecked || isSaving}
          >
            {isSaving ? <ActivityIndicator color={Colors.white} /> : (
              <Text style={styles.nextBtnText}>{isEnglish ? 'Start weaning' : 'Începe diversificarea'}</Text>
            )}
          </TouchableOpacity>
        </View>
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
  stepContainer: { alignItems: 'center' },
  emoji: { fontSize: 64, marginBottom: Spacing.lg },
  title: { fontSize: 24, fontFamily: 'Fraunces', color: Colors.textPrimary, marginBottom: Spacing.sm, textAlign: 'center' },
  subtitle: { fontSize: 15, fontFamily: 'Geist', color: Colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: Spacing.xl },
  
  checklist: { width: '100%', marginBottom: Spacing.xl, gap: Spacing.sm },
  checkItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, padding: Spacing.lg, borderRadius: BorderRadius.xl, borderWidth: 1, borderColor: Colors.border, ...Shadow.sm },
  checkItemActive: { borderColor: Colors.feeding, backgroundColor: Colors.feeding + '05' },
  checkbox: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center', marginRight: Spacing.md },
  checkboxActive: { backgroundColor: Colors.feeding, borderColor: Colors.feeding },
  checkMark: { color: Colors.white, fontSize: 14, fontFamily: 'Geist-Bold' },
  checkText: { flex: 1, fontSize: 15, fontFamily: 'Geist', color: Colors.textSecondary },
  checkTextActive: { fontFamily: 'Geist-SemiBold', color: Colors.textPrimary },

  alertBox: { backgroundColor: Colors.backgroundSoft, padding: Spacing.lg, borderRadius: BorderRadius.lg, marginBottom: Spacing.xl },
  alertText: { fontSize: 13, fontFamily: 'Geist-Italic', color: Colors.textSecondary, textAlign: 'center', lineHeight: 18 },

  nextBtn: { width: '100%', backgroundColor: Colors.feeding, height: 56, borderRadius: BorderRadius.xl, alignItems: 'center', justifyContent: 'center', ...Shadow.sm },
  nextBtnDisabled: { opacity: 0.5 },
  nextBtnText: { fontSize: 16, fontFamily: 'Geist-SemiBold', color: Colors.white },
  
  methods: { width: '100%', gap: Spacing.md, marginBottom: Spacing['2xl'] },
  methodCard: { backgroundColor: Colors.white, padding: Spacing.xl, borderRadius: BorderRadius.xl, borderWidth: 2, borderColor: Colors.border, ...Shadow.sm },
  methodCardActive: { borderColor: Colors.feeding, backgroundColor: Colors.feeding + '05' },
  methodTitle: { fontSize: 16, fontFamily: 'Geist-Bold', color: Colors.textPrimary, marginBottom: Spacing.xs },
  methodDesc: { fontSize: 14, fontFamily: 'Geist', color: Colors.textSecondary, lineHeight: 20 },
  recommendedBadge: { position: 'absolute', top: -12, right: 16, backgroundColor: Colors.feeding, paddingHorizontal: 12, paddingVertical: 4, borderRadius: BorderRadius.full },
  recommendedText: { fontSize: 11, fontFamily: 'Geist-SemiBold', color: Colors.white },
  
  backStepBtn: { marginTop: Spacing.lg, padding: Spacing.md },
  backStepText: { fontSize: 15, fontFamily: 'Geist-SemiBold', color: Colors.textTertiary },
});
