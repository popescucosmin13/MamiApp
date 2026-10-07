import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { Colors } from '../../theme/colors';
import { Spacing, BorderRadius, Shadow } from '../../theme/spacing';
import { ShowcaseMockup, MockupKind } from '../../components/auth/ShowcaseMockup';

const ONBOARD_MODE_KEY = '@mamiapp_onboard_mode';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Slide {
  emoji: string;
  titleKey: string;
  descKey: string;
  gradient: [string, string];
  iconBg: string;
  mockup: MockupKind;
  aiQuestionKey?: string;
  aiAnswerKey?: string;
}

const CHILD_SLIDES: Slide[] = [
  {
    emoji: '🍼',
    titleKey: 'showcase.child_1_title',
    descKey: 'showcase.child_1_desc',
    gradient: [Colors.feeding, '#E8997A'],
    iconBg: Colors.feeding + '20',
    mockup: 'feeding',
  },
  {
    emoji: '😴',
    titleKey: 'showcase.child_2_title',
    descKey: 'showcase.child_2_desc',
    gradient: [Colors.sleep, '#5C8A7A'],
    iconBg: Colors.sleep + '20',
    mockup: 'sleep',
  },
  {
    emoji: '📊',
    titleKey: 'showcase.child_3_title',
    descKey: 'showcase.child_3_desc',
    gradient: [Colors.growth, '#C4A882'],
    iconBg: Colors.growth + '20',
    mockup: 'growth',
  },
  {
    emoji: '💉',
    titleKey: 'showcase.child_4_title',
    descKey: 'showcase.child_4_desc',
    gradient: [Colors.vaccine, '#4A7A6C'],
    iconBg: Colors.vaccine + '20',
    mockup: 'vaccine',
  },
  {
    emoji: '✨',
    titleKey: 'showcase.child_5_title',
    descKey: 'showcase.child_5_desc',
    gradient: [Colors.ai, '#7A5C8A'],
    iconBg: Colors.ai + '20',
    mockup: 'ai',
    aiQuestionKey: 'showcase.ai_question_child',
    aiAnswerKey: 'showcase.ai_answer_child',
  },
];

const PREGNANCY_SLIDES: Slide[] = [
  {
    emoji: '🌸',
    titleKey: 'showcase.pregnancy_1_title',
    descKey: 'showcase.pregnancy_1_desc',
    gradient: [Colors.pregnancy.primary, Colors.pregnancy.primaryDark],
    iconBg: Colors.pregnancy.primary + '20',
    mockup: 'pregnancyWeek',
  },
  {
    emoji: '📅',
    titleKey: 'showcase.pregnancy_2_title',
    descKey: 'showcase.pregnancy_2_desc',
    gradient: ['#64748B', '#475569'],
    iconBg: '#64748B20',
    mockup: 'appointments',
  },
  {
    emoji: '⚖️',
    titleKey: 'showcase.pregnancy_3_title',
    descKey: 'showcase.pregnancy_3_desc',
    gradient: [Colors.pregnancy.primaryDark, '#9A5C70'],
    iconBg: Colors.pregnancy.primary + '20',
    mockup: 'weight',
  },
  {
    emoji: '🏥',
    titleKey: 'showcase.pregnancy_4_title',
    descKey: 'showcase.pregnancy_4_desc',
    gradient: [Colors.sage, '#4A7A6C'],
    iconBg: Colors.sage + '20',
    mockup: 'hospitalBag',
  },
  {
    emoji: '✨',
    titleKey: 'showcase.pregnancy_5_title',
    descKey: 'showcase.pregnancy_5_desc',
    gradient: [Colors.ai, '#7A5C8A'],
    iconBg: Colors.ai + '20',
    mockup: 'ai',
    aiQuestionKey: 'showcase.ai_question_pregnancy',
    aiAnswerKey: 'showcase.ai_answer_pregnancy',
  },
];

const SLIDE_COUNT = Math.max(CHILD_SLIDES.length, PREGNANCY_SLIDES.length);

export default function ShowcaseScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [mode, setMode] = useState<'pregnancy' | 'child'>('child');
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  // Animations — one scale/opacity pair per slide so a stuck native-driver
  // animation on web can never leave a different card permanently faded.
  const cardScales = useRef(
    Array.from({ length: SLIDE_COUNT }, (_, i) => new Animated.Value(i === 0 ? 0.92 : 1)),
  ).current;
  const cardOpacities = useRef(
    Array.from({ length: SLIDE_COUNT }, (_, i) => new Animated.Value(i === 0 ? 0 : 1)),
  ).current;
  const footerOpacity = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const hintNudge = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AsyncStorage.getItem(ONBOARD_MODE_KEY).then((val) => {
      if (val === 'pregnancy' || val === 'child') setMode(val);
    });
  }, []);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(cardScales[0], {
        toValue: 1,
        friction: 6,
        tension: 70,
        useNativeDriver: true,
      }),
      Animated.timing(cardOpacities[0], {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(footerOpacity, {
        toValue: 1,
        duration: 600,
        delay: 300,
        useNativeDriver: true,
      }),
    ]).start();

    // Gentle pulsing glow behind the icon
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1800, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0, duration: 1800, useNativeDriver: true }),
      ]),
    ).start();

    // Swipe hint nudge on the first slide
    Animated.loop(
      Animated.sequence([
        Animated.timing(hintNudge, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(hintNudge, { toValue: 0, duration: 700, useNativeDriver: true }),
        Animated.delay(600),
      ]),
    ).start();
  }, []);

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: (currentIndex + 1) / (mode === 'pregnancy' ? PREGNANCY_SLIDES.length : CHILD_SLIDES.length),
      duration: 350,
      useNativeDriver: false,
    }).start();
  }, [currentIndex, mode]);

  const slides = mode === 'pregnancy' ? PREGNANCY_SLIDES : CHILD_SLIDES;
  const isLastSlide = currentIndex === slides.length - 1;

  const animateSlideTransition = useCallback(
    (index: number) => {
      const scale = cardScales[index];
      const opacity = cardOpacities[index];
      if (!scale || !opacity) return;
      scale.setValue(0.96);
      opacity.setValue(0.5);
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1,
          friction: 8,
          tension: 80,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        // Safety net: guarantee the card lands fully visible even if the
        // native-driver animation gets interrupted mid-flight on web.
        if (finished) {
          scale.setValue(1);
          opacity.setValue(1);
        }
      });
    },
    [cardScales, cardOpacities],
  );

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = e.nativeEvent.contentOffset.x;
      const index = Math.round(offsetX / SCREEN_WIDTH);
      if (index !== currentIndex && index >= 0 && index < slides.length) {
        setCurrentIndex(index);
        animateSlideTransition(index);
      }
    },
    [currentIndex, slides.length, animateSlideTransition],
  );

  const goToNext = () => {
    if (isLastSlide) {
      router.push('/(auth)/register');
    } else {
      const nextIndex = currentIndex + 1;
      scrollRef.current?.scrollTo({ x: nextIndex * SCREEN_WIDTH, animated: true });
      setCurrentIndex(nextIndex);
      animateSlideTransition(nextIndex);
    }
  };

  const goToLogin = () => {
    router.push('/(auth)/login');
  };

  const currentSlide = slides[currentIndex];
  const accentColor = mode === 'pregnancy' ? Colors.pregnancy.primary : Colors.child.primary;

  const glowScale = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] });
  const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0.15] });
  const hintTranslate = hintNudge.interpolate({ inputRange: [0, 1], outputRange: [0, 6] });

  return (
    <View style={styles.container}>
      {/* Background gradient based on current slide */}
      <LinearGradient
        colors={[currentSlide.gradient[0] + '12', Colors.background, Colors.background]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 0.5 }}
        style={StyleSheet.absoluteFillObject}
      />

      <SafeAreaView style={styles.safeArea}>
        {/* Top bar with back + skip */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.topBtn}>
            <Text style={styles.topBtnText}>←</Text>
          </TouchableOpacity>
          {!isLastSlide && (
            <TouchableOpacity onPress={() => router.push('/(auth)/login')} style={styles.topBtn}>
              <Text style={styles.skipText}>{t('welcome.skip')}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Slide content — horizontal scroll */}
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleScroll}
          decelerationRate="fast"
          scrollEventThrottle={16}
          style={styles.slideScroll}
        >
          {slides.map((slide, index) => (
            <View key={index} style={[styles.slideContainer, { width: SCREEN_WIDTH }]}>
              <Animated.View
                style={[
                  styles.slideCard,
                  {
                    opacity: cardOpacities[index],
                    transform: [{ scale: cardScales[index] }],
                  },
                ]}
              >
                {/* Big emoji icon with pulsing glow */}
                <View style={styles.iconWrap}>
                  <Animated.View
                    style={[
                      styles.iconGlow,
                      {
                        backgroundColor: slide.gradient[0],
                        opacity: index === currentIndex ? glowOpacity : 0.15,
                        transform: [{ scale: index === currentIndex ? glowScale : 1 }],
                      },
                    ]}
                  />
                  <View style={[styles.iconCircle, { backgroundColor: slide.iconBg }]}>
                    <LinearGradient
                      colors={[slide.gradient[0] + '20', slide.gradient[1] + '08']}
                      style={styles.iconGradient}
                    >
                      <Text style={styles.slideEmoji}>{slide.emoji}</Text>
                    </LinearGradient>
                  </View>
                </View>

                {/* Slide counter */}
                <View style={[styles.counterBadge, { backgroundColor: slide.gradient[0] + '15' }]}>
                  <Text style={[styles.counterText, { color: slide.gradient[0] }]}>
                    {index + 1} / {slides.length}
                  </Text>
                </View>

                {/* Title & description */}
                <Text style={[styles.slideTitle, { color: slide.gradient[0] }]}>
                  {t(slide.titleKey)}
                </Text>
                <Text style={styles.slideDesc}>{t(slide.descKey)}</Text>

                {/* Realistic module preview */}
                <View style={styles.mockupWrap}>
                  <ShowcaseMockup
                    kind={slide.mockup}
                    accentColor={slide.gradient[0]}
                    aiQuestion={slide.aiQuestionKey ? t(slide.aiQuestionKey) : undefined}
                    aiAnswer={slide.aiAnswerKey ? t(slide.aiAnswerKey) : undefined}
                  />
                </View>
              </Animated.View>

              {/* Last slide: CTA section */}
              {index === slides.length - 1 && (
                <View style={styles.finalCta}>
                  <Text style={styles.finalTitle}>{t('showcase.final_title')}</Text>
                  <Text style={styles.finalDesc}>{t('showcase.final_desc')}</Text>
                </View>
              )}
            </View>
          ))}
        </ScrollView>

        {/* Bottom section */}
        <Animated.View
          style={[
            styles.footer,
            {
              opacity: footerOpacity,
              paddingBottom: Math.max(insets.bottom + Spacing.md, Spacing['2xl']),
            },
          ]}
        >
          {/* Animated progress bar */}
          <View style={styles.progressTrack}>
            <Animated.View
              style={[
                styles.progressFill,
                {
                  backgroundColor: currentSlide.gradient[0],
                  width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                },
              ]}
            />
          </View>

          {/* Swipe hint on the first slide */}
          {currentIndex === 0 && (
            <Animated.View style={[styles.swipeHint, { transform: [{ translateX: hintTranslate }] }]}>
              <Text style={styles.swipeHintText}>{t('showcase.swipe_hint')}</Text>
              <ChevronRight size={14} color={Colors.textTertiary} />
            </Animated.View>
          )}

          {/* CTA button */}
          <TouchableOpacity
            style={styles.ctaButton}
            onPress={goToNext}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={isLastSlide ? [accentColor, currentSlide.gradient[1]] : [currentSlide.gradient[0], currentSlide.gradient[1]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaGradient}
            >
              <Text style={styles.ctaText}>
                {isLastSlide ? t('showcase.create_account') : t('showcase.next')}
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Secondary link */}
          {isLastSlide && (
            <TouchableOpacity style={styles.loginLink} onPress={goToLogin}>
              <Text style={styles.loginLinkText}>{t('showcase.already_account')}</Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  safeArea: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
  },
  topBtn: {
    padding: Spacing.xs,
  },
  topBtnText: {
    fontSize: 24,
    color: Colors.textPrimary,
  },
  skipText: {
    fontSize: 14,
    fontFamily: 'Geist',
    color: Colors.textTertiary,
  },
  slideScroll: {
    flex: 1,
  },
  slideContainer: {
    height: '100%',
    paddingHorizontal: Spacing.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  slideCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: Colors.white,
    borderRadius: 28,
    padding: Spacing['2xl'],
    paddingVertical: Spacing['2xl'],
    alignItems: 'center',
    ...Shadow.md,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  iconWrap: {
    width: 92,
    height: 92,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  iconGlow: {
    position: 'absolute',
    width: 112,
    height: 112,
    borderRadius: 56,
  },
  iconCircle: {
    width: 92,
    height: 92,
    borderRadius: 46,
    overflow: 'hidden',
  },
  iconGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slideEmoji: {
    fontSize: 44,
  },
  counterBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.lg,
  },
  counterText: {
    fontSize: 12,
    fontFamily: 'Geist-SemiBold',
  },
  slideTitle: {
    fontSize: 24,
    fontFamily: 'Fraunces',
    textAlign: 'center',
    marginBottom: Spacing.sm,
    lineHeight: 30,
  },
  slideDesc: {
    fontSize: 14,
    fontFamily: 'Geist',
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 300,
    marginBottom: Spacing.lg,
  },
  mockupWrap: {
    width: '100%',
  },
  finalCta: {
    marginTop: Spacing.xl,
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
  },
  finalTitle: {
    fontSize: 22,
    fontFamily: 'Fraunces',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  finalDesc: {
    fontSize: 14,
    fontFamily: 'Geist',
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 300,
  },
  footer: {
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.md,
    paddingTop: Spacing.lg,
  },
  progressTrack: {
    width: '100%',
    maxWidth: 380,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.border,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  swipeHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  swipeHintText: {
    fontSize: 12,
    fontFamily: 'Geist',
    color: Colors.textTertiary,
  },
  ctaButton: {
    width: '100%',
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    ...Shadow.sm,
  },
  ctaGradient: {
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.xl,
  },
  ctaText: {
    fontSize: 17,
    fontFamily: 'Geist-Bold',
    color: Colors.white,
  },
  loginLink: {
    paddingVertical: Spacing.xs,
  },
  loginLinkText: {
    fontSize: 14,
    fontFamily: 'Geist',
    color: Colors.textTertiary,
    textDecorationLine: 'underline',
  },
});
