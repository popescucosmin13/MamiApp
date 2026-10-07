import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Colors } from '../../../theme/colors';
import { Spacing, BorderRadius, Shadow } from '../../../theme/spacing';
import { translateHardcodedText } from '../../../i18n/runtimeText';

const PARENTING_TECHNIQUES = [
  {
    emoji: '🤗',
    title: 'Validarea emoțiilor',
    description: 'Recunoașteți emoția copilului înainte de orice altceva. "Văd că ești foarte frustrat."',
    steps: ['Numiți emoția', 'Validați fără a judeca', 'Oferiți confort fizic', 'Rezolvați problema după ce s-a calmat'],
  },
  {
    emoji: '⏱️',
    title: 'Time-in în loc de time-out',
    description: 'Rămâneți cu copilul în loc să-l izolați. Conexiunea calmează sistemul nervos.',
    steps: ['Rămâneți calm', 'Stați aproape', 'Respirați împreună', 'Vorbiți după ce s-a calmat'],
  },
  {
    emoji: '🗺️',
    title: 'Harta emoțiilor',
    description: 'Ajutați copilul să identifice și să numească emoțiile.',
    steps: ['Folosiți cărți/imagini cu fețe', 'Jucați-vă "cum te simți azi?"', 'Normalizați toate emoțiile', 'Modelați exprimarea propriilor emoții'],
  },
  {
    emoji: '🎭',
    title: 'Jocul de rol',
    description: 'Repetați situații dificile în joc pentru a construi abilități sociale.',
    steps: ['Identificați situația problematică', 'Jucați scenariul', 'Alternați rolurile', 'Discutați ce s-a simțit'],
  },
];

function BreathingExercise({ isEnglish }: { isEnglish: boolean }) {
  const scale = useSharedValue(1);
  const [isActive, setIsActive] = useState(false);
  const [phase, setPhase] = useState<'inhale' | 'hold' | 'exhale'>('inhale');

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const startBreathing = () => {
    setIsActive(true);
    let phaseIndex = 0;
    const phases = ['inhale', 'hold', 'exhale'] as const;
    const durations = [4000, 2000, 6000]; // 4-2-6 breathing

    const animate = () => {
      const currentPhase = phases[phaseIndex % 3];
      setPhase(currentPhase);
      const dur = durations[phaseIndex % 3];

      if (currentPhase === 'inhale') {
        scale.value = withTiming(1.5, { duration: dur, easing: Easing.inOut(Easing.ease) });
      } else if (currentPhase === 'hold') {
        // stay at current scale
      } else {
        scale.value = withTiming(1, { duration: dur, easing: Easing.inOut(Easing.ease) });
      }

      phaseIndex++;
      if (phaseIndex < 18) { // 6 cycles
        setTimeout(animate, dur);
      } else {
        setIsActive(false);
        setPhase('inhale');
      }
    };

    animate();
  };

  const phaseLabels = isEnglish
    ? { inhale: 'Inhale...', hold: 'Hold...', exhale: 'Exhale...' }
    : { inhale: 'Inspiră...', hold: 'Ține...', exhale: 'Expiră...' };
  const phaseColors = { inhale: Colors.info, hold: Colors.warning, exhale: Colors.success };

  return (
    <View style={styles.breathingCard}>
      <Text style={styles.breathingTitle}>{isEnglish ? 'Breathing exercise' : 'Exercițiu de respirație'}</Text>
      <Text style={styles.breathingSubtitle}>{isEnglish ? '4-2-6 technique for quick calm' : 'Tehnica 4-2-6 pentru calm rapid'}</Text>

      <TouchableOpacity
        onPress={isActive ? undefined : startBreathing}
        activeOpacity={isActive ? 1 : 0.8}
      >
        <Animated.View style={[styles.breathingCircle, animatedStyle, { borderColor: isActive ? phaseColors[phase] : Colors.emotions }]}>
          <Text style={[styles.breathingEmoji]}>🌬️</Text>
          <Text style={[styles.breathingPhase, { color: isActive ? phaseColors[phase] : Colors.textSecondary }]}>
            {isActive ? phaseLabels[phase] : (isEnglish ? 'Start' : 'Pornește')}
          </Text>
        </Animated.View>
      </TouchableOpacity>

      {!isActive && (
        <Text style={styles.breathingHint}>{isEnglish ? 'Tap the circle to start 6 breathing cycles' : 'Atinge cercul pentru a începe 6 cicluri de respirație'}</Text>
      )}
    </View>
  );
}

export default function EmotionsScreen() {
  const router = useRouter();
  const { i18n } = useTranslation();
  const isEnglish = i18n.language === 'en';
  const tx = (text: string) => isEnglish ? translateHardcodedText(text) : text;
  const [tantrumNote, setTantrumNote] = useState('');
  const [tantrumTrigger, setTantrumTrigger] = useState('');

  const TRIGGERS = ['Oboseală', 'Foame', 'Frustrare', 'Schimbare rutină', 'Atenție', 'Durere', 'Tranziție'];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEnglish ? 'Emotions' : 'Emoții'}</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Breathing Exercise */}
        <BreathingExercise isEnglish={isEnglish} />

        {/* Tantrum Logger */}
        <View style={styles.section}>
          <View style={styles.tantrumCard}>
            <Text style={styles.cardTitle}>{isEnglish ? 'Emotional outburst journal' : 'Jurnal crize emoționale'}</Text>
            <Text style={styles.cardSubtitle}>{isEnglish ? 'Identify patterns to prevent outbursts' : 'Identifică tipare pentru a preveni crizele'}</Text>

            <Text style={styles.fieldLabel}>{isEnglish ? 'Possible trigger' : 'Declanșator posibil'}</Text>
            <View style={styles.triggersRow}>
              {TRIGGERS.map((t) => (
                <TouchableOpacity
                  key={tx(t)}
                  style={[styles.triggerChip, tantrumTrigger === t && styles.triggerChipActive]}
                  onPress={() => setTantrumTrigger(t === tantrumTrigger ? '' : t)}
                >
                  <Text style={[styles.triggerChipText, tantrumTrigger === t && styles.triggerChipTextActive]}>
                    {tx(t)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>{isEnglish ? 'Notes' : 'Note'}</Text>
            <TextInput
              style={styles.noteInput}
              value={tantrumNote}
              onChangeText={setTantrumNote}
              placeholder={isEnglish ? 'What happened? How did your child react?' : 'Ce s-a întâmplat? Cum a reacționat copilul?'}
              placeholderTextColor={Colors.textTertiary}
              multiline
              numberOfLines={3}
            />

            <TouchableOpacity style={styles.saveButton}>
              <Text style={styles.saveButtonText}>{isEnglish ? 'Save event' : 'Salvează evenimentul'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Techniques */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{isEnglish ? 'Parenting techniques' : 'Tehnici parentale'}</Text>
          {PARENTING_TECHNIQUES.map((tech, i) => (
            <View key={i} style={styles.techniqueCard}>
              <View style={styles.techniqueHeader}>
                <Text style={styles.techniqueEmoji}>{tech.emoji}</Text>
                <Text style={styles.techniqueTitle}>{tx(tech.title)}</Text>
              </View>
              <Text style={styles.techniqueDesc}>{tx(tech.description)}</Text>
              <View style={styles.techniqueSteps}>
                {tech.steps.map((step, j) => (
                  <View key={j} style={styles.step}>
                    <Text style={styles.stepNumber}>{j + 1}</Text>
                    <Text style={styles.stepText}>{tx(step)}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
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
  breathingCard: {
    margin: Spacing.xl, backgroundColor: Colors.white, borderRadius: BorderRadius['2xl'],
    padding: Spacing.xl, alignItems: 'center', ...Shadow.md,
  },
  breathingTitle: { fontSize: 18, fontFamily: 'Fraunces', color: Colors.textPrimary, marginBottom: Spacing.xs },
  breathingSubtitle: { fontSize: 13, fontFamily: 'Geist', color: Colors.textSecondary, marginBottom: Spacing.xl },
  breathingCircle: {
    width: 160, height: 160, borderRadius: 80, borderWidth: 3,
    alignItems: 'center', justifyContent: 'center', gap: Spacing.xs,
    backgroundColor: Colors.emotions + '10',
  },
  breathingEmoji: { fontSize: 48 },
  breathingPhase: { fontSize: 14, fontFamily: 'Geist-SemiBold' },
  breathingHint: {
    fontSize: 12, fontFamily: 'Geist', color: Colors.textTertiary,
    textAlign: 'center', marginTop: Spacing.md,
  },
  section: { paddingHorizontal: Spacing.xl, marginBottom: Spacing.xl },
  tantrumCard: {
    backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.xl, ...Shadow.sm,
  },
  cardTitle: { fontSize: 16, fontFamily: 'Geist-SemiBold', color: Colors.textPrimary, marginBottom: Spacing.xs },
  cardSubtitle: { fontSize: 13, fontFamily: 'Geist', color: Colors.textSecondary, marginBottom: Spacing.lg },
  fieldLabel: { fontSize: 13, fontFamily: 'Geist-SemiBold', color: Colors.textSecondary, marginBottom: Spacing.sm },
  triggersRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.lg },
  triggerChip: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: BorderRadius.full,
    backgroundColor: Colors.backgroundSoft, borderWidth: 1, borderColor: Colors.border,
  },
  triggerChipActive: { backgroundColor: Colors.emotions, borderColor: Colors.emotions },
  triggerChipText: { fontSize: 13, fontFamily: 'Geist', color: Colors.textSecondary },
  triggerChipTextActive: { color: Colors.white, fontFamily: 'Geist-SemiBold' },
  noteInput: {
    borderRadius: BorderRadius.lg, borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.backgroundSoft, padding: Spacing.md, fontSize: 14,
    fontFamily: 'Geist', color: Colors.textPrimary, height: 88, textAlignVertical: 'top',
    marginBottom: Spacing.lg,
  },
  saveButton: {
    height: 48, borderRadius: BorderRadius.xl, backgroundColor: Colors.emotions,
    alignItems: 'center', justifyContent: 'center',
  },
  saveButtonText: { fontSize: 14, fontFamily: 'Geist-SemiBold', color: Colors.white },
  sectionTitle: { fontSize: 16, fontFamily: 'Geist-SemiBold', color: Colors.textPrimary, marginBottom: Spacing.md },
  techniqueCard: {
    backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.xl,
    marginBottom: Spacing.md, ...Shadow.sm,
  },
  techniqueHeader: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center', marginBottom: Spacing.sm },
  techniqueEmoji: { fontSize: 24 },
  techniqueTitle: { fontSize: 15, fontFamily: 'Geist-SemiBold', color: Colors.textPrimary },
  techniqueDesc: { fontSize: 14, fontFamily: 'Geist', color: Colors.textSecondary, lineHeight: 20, marginBottom: Spacing.md },
  techniqueSteps: { gap: Spacing.sm },
  step: { flexDirection: 'row', gap: Spacing.sm },
  stepNumber: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.emotions + '20',
    fontSize: 12, fontFamily: 'Geist-Bold', color: Colors.emotions,
    textAlign: 'center', lineHeight: 22, flexShrink: 0,
  },
  stepText: { flex: 1, fontSize: 13, fontFamily: 'Geist', color: Colors.textSecondary, lineHeight: 19 },
});
