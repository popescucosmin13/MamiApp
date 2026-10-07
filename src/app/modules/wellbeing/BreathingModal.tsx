import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  cancelAnimation
} from 'react-native-reanimated';
import { Colors } from '../../../theme/colors';
import { Spacing, BorderRadius, Shadow } from '../../../theme/spacing';

interface BreathingModalProps {
  exerciseKey: string | null;
  onClose: () => void;
}

type Phase = 'inhale' | 'hold1' | 'exhale' | 'hold2';

export function BreathingModal({ exerciseKey, onClose }: BreathingModalProps) {
  const { t } = useTranslation();
  const scale = useSharedValue(1);
  const [isActive, setIsActive] = useState(false);
  const [phase, setPhase] = useState<Phase>('inhale');
  const stopBreathingRef = React.useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!exerciseKey) {
      setIsActive(false);
      scale.value = 1;
    }
  }, [exerciseKey]);


  const isBoxBreathing = exerciseKey === 'box_breathing';
  const is478 = exerciseKey === 'breathing_478';
  
  // If it's a simple text exercise, we don't animate
  const isInteractive = isBoxBreathing || is478;

  const startBreathing = () => {
    if (!isInteractive) return;
    setIsActive(true);
    let phaseIndex = 0;
    let isCancelled = false;
    
    stopBreathingRef.current = () => {
      isCancelled = true;
    };
    
    // Config for 4-7-8
    const phases478: Phase[] = ['inhale', 'hold1', 'exhale'];
    const durations478 = [4000, 7000, 8000];
    
    // Config for Box Breathing
    const phasesBox: Phase[] = ['inhale', 'hold1', 'exhale', 'hold2'];
    const durationsBox = [4000, 4000, 4000, 4000];

    const currentPhases = isBoxBreathing ? phasesBox : phases478;
    const currentDurations = isBoxBreathing ? durationsBox : durations478;
    const totalCycles = 4;
    const totalSteps = currentPhases.length * totalCycles;

    const animate = () => {
      if (isCancelled) return;
      
      const step = phaseIndex % currentPhases.length;
      const currentPhase = currentPhases[step];
      setPhase(currentPhase);
      const dur = currentDurations[step];

      if (currentPhase === 'inhale') {
        scale.value = withTiming(1.5, { duration: dur, easing: Easing.inOut(Easing.ease) });
      } else if (currentPhase === 'hold1' || currentPhase === 'hold2') {
        // stay at current scale
      } else if (currentPhase === 'exhale') {
        scale.value = withTiming(1, { duration: dur, easing: Easing.inOut(Easing.ease) });
      }

      phaseIndex++;
      if (phaseIndex < totalSteps) {
        setTimeout(animate, dur);
      } else {
        setIsActive(false);
        setPhase('inhale');
        scale.value = withTiming(1, { duration: 1000 });
      }
    };

    animate();
  };

  const stopBreathing = () => {
    setIsActive(false);
    if (stopBreathingRef.current) {
      stopBreathingRef.current();
      stopBreathingRef.current = null;
    }
    cancelAnimation(scale);
    scale.value = withTiming(1);
    setPhase('inhale');
  };

  const handleClose = () => {
    stopBreathing();
    onClose();
  };

  const phaseColors = {
    inhale: Colors.info,
    hold1: Colors.warning,
    exhale: Colors.success,
    hold2: Colors.warning
  };

  const phaseLabels = {
    inhale: t('wellbeing_simple.inhale', { defaultValue: 'Inspiră...' }),
    hold1: t('wellbeing_simple.hold', { defaultValue: 'Ține...' }),
    exhale: t('wellbeing_simple.exhale', { defaultValue: 'Expiră...' }),
    hold2: t('wellbeing_simple.hold', { defaultValue: 'Pauză...' })
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const title = t(`wellbeing.exercise_${exerciseKey}_title`);
  const body = t(`wellbeing.exercise_${exerciseKey}_body`);

  if (!exerciseKey) return null;

  return (
    <View style={[StyleSheet.absoluteFill, styles.modalOverlay]}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>{title}</Text>
          
          {isInteractive ? (
            <View style={styles.interactiveContainer}>
              <Text style={styles.modalSubtitle}>{body}</Text>
              
              <TouchableOpacity
                onPress={isActive ? stopBreathing : startBreathing}
                activeOpacity={isActive ? 0.8 : 0.8}
                style={styles.circleWrapper}
              >
                <Animated.View 
                  style={[
                    styles.breathingCircle, 
                    animatedStyle, 
                    { borderColor: isActive ? phaseColors[phase] : '#7C3AED' }
                  ]}
                >
                  <Text style={styles.breathingEmoji}>🌬️</Text>
                  <Text style={[styles.breathingPhase, { color: isActive ? phaseColors[phase] : Colors.textSecondary }]}>
                    {isActive ? phaseLabels[phase] : t('wellbeing_simple.start', { defaultValue: 'Pornește' })}
                  </Text>
                </Animated.View>
              </TouchableOpacity>

              <Text style={styles.breathingHint}>
                {isActive 
                  ? t('wellbeing_simple.tap_to_stop', { defaultValue: 'Atinge pentru a opri' }) 
                  : t('wellbeing_simple.tap_to_start', { defaultValue: 'Atinge cercul pentru a începe' })}
              </Text>
            </View>
          ) : (
            <View style={styles.textContainer}>
              <Text style={styles.modalBody}>{body}</Text>
            </View>
          )}

          <TouchableOpacity onPress={handleClose} style={styles.modalCloseBtn}>
            <Text style={styles.modalCloseBtnText}>{t('close', { defaultValue: 'Închide' })}</Text>
          </TouchableOpacity>
        </View>
    </View>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: Spacing.xl, zIndex: 1000, elevation: 10 },
  modalContent: { backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.xl, width: '100%', maxHeight: '90%', ...Shadow.md },
  modalTitle: { fontFamily: 'Fraunces', fontSize: 24, color: Colors.textPrimary, marginBottom: Spacing.sm, textAlign: 'center' },
  modalSubtitle: { fontFamily: 'Geist', fontSize: 15, color: Colors.textSecondary, textAlign: 'center', marginBottom: Spacing.xl },
  interactiveContainer: { alignItems: 'center', paddingVertical: Spacing.lg },
  circleWrapper: { padding: Spacing['3xl'] },
  breathingCircle: {
    width: 160, height: 160, borderRadius: 80,
    borderWidth: 4, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F3F4F6'
  },
  breathingEmoji: { fontSize: 48, marginBottom: 8 },
  breathingPhase: { fontSize: 16, fontFamily: 'Geist-Bold' },
  breathingHint: { fontFamily: 'Geist', fontSize: 13, color: Colors.textTertiary, marginTop: Spacing.xl, textAlign: 'center' },
  textContainer: { paddingVertical: Spacing.xl, marginBottom: Spacing.lg },
  modalBody: { fontFamily: 'Geist', fontSize: 16, color: Colors.textSecondary, lineHeight: 24, textAlign: 'center' },
  modalCloseBtn: { backgroundColor: '#7C3AED', borderRadius: BorderRadius.full, paddingVertical: Spacing.md, alignItems: 'center', marginTop: Spacing.xl },
  modalCloseBtnText: { fontFamily: 'Geist-Bold', fontSize: 16, color: Colors.white },
});
