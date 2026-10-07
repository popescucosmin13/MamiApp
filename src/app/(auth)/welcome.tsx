import { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { Colors } from '../../theme/colors';
import { Spacing, BorderRadius } from '../../theme/spacing';

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  // Animations
  const logoScale = useRef(new Animated.Value(0)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleTranslateY = useRef(new Animated.Value(20)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const ctaOpacity = useRef(new Animated.Value(0)).current;
  const ctaScale = useRef(new Animated.Value(0.9)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Stagger entrance animations
    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1,
          friction: 5,
          tension: 80,
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(titleOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(titleTranslateY, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(subtitleOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(ctaOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(ctaScale, {
          toValue: 1,
          friction: 6,
          tension: 80,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    // Gentle floating animation for the logo
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1,
          duration: 2400,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 2400,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  const floatTranslateY = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -10],
  });

  return (
    <LinearGradient
      colors={['#FDF6F0', '#F4E4D6', '#F4DEE6']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          {/* Floating Logo */}
          <Animated.View
            style={[
              styles.logoContainer,
              {
                opacity: logoOpacity,
                transform: [
                  { scale: logoScale },
                  { translateY: floatTranslateY },
                ],
              },
            ]}
          >
            <View style={styles.logoOuter}>
              <View style={styles.logoInner}>
                <Image source={require('../../../assets/icon.png')} style={{ width: 96, height: 96, borderRadius: 48 }} resizeMode="cover" />
              </View>
            </View>
            {/* Decorative rings */}
            <View style={[styles.ring, styles.ringOuter]} />
            <View style={[styles.ring, styles.ringMiddle]} />
          </Animated.View>

          {/* Title */}
          <Animated.View
            style={{
              opacity: titleOpacity,
              transform: [{ translateY: titleTranslateY }],
            }}
          >
            <Text style={styles.title}>{t('welcome.hero_title')}</Text>
          </Animated.View>

          {/* Subtitle */}
          <Animated.Text
            style={[styles.subtitle, { opacity: subtitleOpacity }]}
          >
            {t('welcome.hero_subtitle')}
          </Animated.Text>

          {/* Decorative dots */}
          <Animated.View
            style={[styles.dotsRow, { opacity: subtitleOpacity }]}
          >
            <View style={[styles.decorDot, { backgroundColor: Colors.pregnancy.primary }]} />
            <View style={[styles.decorDot, { backgroundColor: Colors.child.primary }]} />
            <View style={[styles.decorDot, { backgroundColor: Colors.plum }]} />
          </Animated.View>
        </View>

        {/* Bottom CTA */}
        <View
          style={[
            styles.footer,
            { paddingBottom: Math.max(insets.bottom + Spacing.md, Spacing['2xl']) },
          ]}
        >
          <Animated.View
            style={{
              opacity: ctaOpacity,
              transform: [{ scale: ctaScale }],
              width: '100%',
            }}
          >
            <TouchableOpacity
              style={styles.ctaButton}
              onPress={() => router.push('/(auth)/mode-select')}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={[Colors.child.primary, Colors.pregnancy.primary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.ctaGradient}
              >
                <Text style={styles.ctaText}>{t('welcome.hero_cta')}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          <Animated.View style={{ opacity: ctaOpacity }}>
            <TouchableOpacity
              style={styles.loginLink}
              onPress={() => router.push('/(auth)/login')}
            >
              <Text style={styles.loginLinkText}>{t('showcase.already_account')}</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing['2xl'],
  },
  logoContainer: {
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing['2xl'],
  },
  logoOuter: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.child.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 8,
  },
  logoInner: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  logoEmoji: {
    fontSize: 52,
  },
  ring: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 1.5,
  },
  ringOuter: {
    width: 160,
    height: 160,
    borderColor: 'rgba(232,153,122,0.12)',
    top: -10,
    left: -10,
  },
  ringMiddle: {
    width: 200,
    height: 200,
    borderColor: 'rgba(216,143,168,0.08)',
    top: -30,
    left: -30,
  },
  title: {
    fontSize: 42,
    fontFamily: 'Fraunces',
    color: Colors.textPrimary,
    textAlign: 'center',
    lineHeight: 50,
    marginBottom: Spacing.lg,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Geist',
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 340,
    paddingHorizontal: Spacing.md,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xl,
  },
  decorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  footer: {
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.md,
  },
  ctaButton: {
    width: '100%',
    overflow: 'hidden',
    borderRadius: BorderRadius.xl,
    shadowColor: Colors.child.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 6,
  },
  ctaGradient: {
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.xl,
  },
  ctaText: {
    fontSize: 18,
    fontFamily: 'Geist-Bold',
    color: Colors.white,
    letterSpacing: 0.5,
  },
  loginLink: {
    paddingVertical: Spacing.sm,
  },
  loginLinkText: {
    fontSize: 14,
    fontFamily: 'Geist',
    color: Colors.textTertiary,
    textDecorationLine: 'underline',
  },
});
