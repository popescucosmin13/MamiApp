import { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { Colors } from '../../theme/colors';
import { Spacing, BorderRadius, Shadow } from '../../theme/spacing';
import { useState } from 'react';

const ONBOARD_MODE_KEY = '@mamiapp_onboard_mode';

type Mode = 'pregnancy' | 'child';

export default function ModeSelectScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [selectedMode, setSelectedMode] = useState<Mode>('child');

  // Entrance animations
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const headerTranslateY = useRef(new Animated.Value(16)).current;
  const pregnancyCardAnim = useRef(new Animated.Value(0)).current;
  const childCardAnim = useRef(new Animated.Value(0)).current;
  const ctaOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(120, [
      Animated.parallel([
        Animated.timing(headerOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(headerTranslateY, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ]),
      Animated.spring(pregnancyCardAnim, {
        toValue: 1,
        friction: 7,
        tension: 60,
        useNativeDriver: true,
      }),
      Animated.spring(childCardAnim, {
        toValue: 1,
        friction: 7,
        tension: 60,
        useNativeDriver: true,
      }),
      Animated.timing(ctaOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleContinue = async () => {
    await AsyncStorage.setItem(ONBOARD_MODE_KEY, selectedMode);
    router.push('/(auth)/showcase');
  };

  const renderCard = (
    mode: Mode,
    emoji: string,
    titleKey: string,
    descKey: string,
    gradientColors: [string, string],
    animValue: Animated.Value,
    accentColor: string,
  ) => {
    const isActive = selectedMode === mode;

    return (
      <Animated.View
        style={{
          opacity: animValue,
          transform: [
            {
              scale: animValue.interpolate({
                inputRange: [0, 1],
                outputRange: [0.92, 1],
              }),
            },
          ],
        }}
      >
        <TouchableOpacity
          style={[
            styles.modeCard,
            isActive && [styles.modeCardActive, { borderColor: accentColor }],
          ]}
          onPress={() => setSelectedMode(mode)}
          activeOpacity={0.85}
        >
          {isActive && (
            <LinearGradient
              colors={[gradientColors[0] + '15', gradientColors[1] + '08']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
          )}
          <View style={styles.cardContent}>
            <View style={[styles.emojiCircle, { backgroundColor: gradientColors[0] + '18' }]}>
              <Text style={styles.emoji}>{emoji}</Text>
            </View>
            <View style={styles.cardText}>
              <Text style={[styles.cardTitle, isActive && { color: accentColor }]}>
                {t(titleKey)}
              </Text>
              <Text style={styles.cardDesc}>{t(descKey)}</Text>
            </View>
            <View
              style={[
                styles.radioOuter,
                isActive && { borderColor: accentColor },
              ]}
            >
              {isActive && (
                <View style={[styles.radioInner, { backgroundColor: accentColor }]} />
              )}
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View
        style={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom + Spacing.md, Spacing['2xl']) },
        ]}
      >
        {/* Back button */}
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>

        {/* Header */}
        <Animated.View
          style={[
            styles.header,
            {
              opacity: headerOpacity,
              transform: [{ translateY: headerTranslateY }],
            },
          ]}
        >
          <Text style={styles.title}>{t('mode_select.title')}</Text>
          <Text style={styles.subtitle}>{t('mode_select.subtitle')}</Text>
        </Animated.View>

        {/* Mode cards */}
        <View style={styles.cardsContainer}>
          {renderCard(
            'pregnancy',
            '🌸',
            'mode_select.pregnancy_title',
            'mode_select.pregnancy_desc',
            [Colors.pregnancy.primary, Colors.pregnancy.primaryDark],
            pregnancyCardAnim,
            Colors.pregnancy.primary,
          )}
          {renderCard(
            'child',
            '👶',
            'mode_select.child_title',
            'mode_select.child_desc',
            [Colors.child.primary, Colors.child.primaryDark],
            childCardAnim,
            Colors.child.primary,
          )}
        </View>

        {/* Continue button */}
        <Animated.View style={{ opacity: ctaOpacity, width: '100%', marginTop: 'auto' }}>
          <TouchableOpacity
            style={[
              styles.ctaButton,
              {
                backgroundColor:
                  selectedMode === 'pregnancy'
                    ? Colors.pregnancy.primary
                    : Colors.child.primary,
              },
            ]}
            onPress={handleContinue}
            activeOpacity={0.85}
          >
            <Text style={styles.ctaText}>{t('mode_select.continue')}</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
  },
  backButton: {
    marginBottom: Spacing.md,
    width: 40,
  },
  backArrow: {
    fontSize: 24,
    color: Colors.textPrimary,
  },
  header: {
    marginBottom: Spacing['2xl'],
  },
  title: {
    fontSize: 30,
    fontFamily: 'Fraunces',
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: 'Geist',
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  cardsContainer: {
    gap: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  modeCard: {
    borderRadius: 22,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
    overflow: 'hidden',
    ...Shadow.sm,
  },
  modeCardActive: {
    borderWidth: 2.5,
    ...Shadow.md,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.xl,
    gap: Spacing.lg,
  },
  emojiCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 32,
  },
  cardText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontFamily: 'Fraunces',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 13,
    fontFamily: 'Geist',
    color: Colors.textSecondary,
    lineHeight: 19,
  },
  radioOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  ctaButton: {
    height: 56,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.sm,
  },
  ctaText: {
    fontSize: 17,
    fontFamily: 'Geist-Bold',
    color: Colors.white,
  },
});
