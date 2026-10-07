/**
 * AppLoadingScreen — ecran de încărcare cu flori de cireș animate
 *
 * Afișat după autentificare, cât timp datele de acces (moduleCatalog,
 * featureFlags, planConfigs) se sincronizează din Firestore.
 * Previne accesul la module înainte ca regulile de acces să fie gata.
 */

import { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';

const { width, height } = Dimensions.get('window');

// ─── Petale ───────────────────────────────────────────────────────────────────

const PETALS = [
  { emoji: '🌸', size: 28, startX: 0.12, delay: 0 },
  { emoji: '🌸', size: 20, startX: 0.28, delay: 600 },
  { emoji: '🌸', size: 24, startX: 0.45, delay: 200 },
  { emoji: '🌸', size: 18, startX: 0.62, delay: 900 },
  { emoji: '🌸', size: 26, startX: 0.78, delay: 400 },
  { emoji: '🌸', size: 16, startX: 0.90, delay: 1100 },
  { emoji: '🌸', size: 22, startX: 0.05, delay: 750 },
  { emoji: '🌸', size: 20, startX: 0.55, delay: 1300 },
];

function Petal({
  emoji,
  size,
  startX,
  delay,
}: {
  emoji: string;
  size: number;
  startX: number;
  delay: number;
}) {
  const translateY = useRef(new Animated.Value(-size * 2)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity    = useRef(new Animated.Value(0)).current;
  const rotate     = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const duration = 3200 + Math.random() * 1800;
    const swayX    = 30 + Math.random() * 40;

    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(translateY, {
            toValue: height + size * 2,
            duration,
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.timing(opacity, { toValue: 0.9, duration: 300, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0.9, duration: duration - 600, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
          ]),
          Animated.sequence([
            Animated.timing(translateX, { toValue: swayX, duration: duration / 3, useNativeDriver: true }),
            Animated.timing(translateX, { toValue: -swayX / 2, duration: duration / 3, useNativeDriver: true }),
            Animated.timing(translateX, { toValue: swayX / 3, duration: duration / 3, useNativeDriver: true }),
          ]),
          Animated.timing(rotate, { toValue: 1, duration, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(translateY, { toValue: -size * 2, duration: 0, useNativeDriver: true }),
          Animated.timing(translateX, { toValue: 0, duration: 0, useNativeDriver: true }),
          Animated.timing(opacity,    { toValue: 0, duration: 0, useNativeDriver: true }),
          Animated.timing(rotate,     { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      ])
    );

    loop.start();
    return () => loop.stop();
  }, []);

  const spin = rotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.Text
      style={{
        position: 'absolute',
        left: startX * width,
        top: 0,
        fontSize: size,
        opacity,
        transform: [{ translateY }, { translateX }, { rotate: spin }],
      }}
    >
      {emoji}
    </Animated.Text>
  );
}

// ─── Puncte de loading ────────────────────────────────────────────────────────

function LoadingDots() {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const makeDot = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: -6, duration: 300, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0,  duration: 300, useNativeDriver: true }),
          Animated.delay(600),
        ])
      );

    const a1 = makeDot(dot1, 0);
    const a2 = makeDot(dot2, 200);
    const a3 = makeDot(dot3, 400);
    a1.start(); a2.start(); a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, []);

  const dotStyle = (anim: Animated.Value) => ({
    width: 7, height: 7, borderRadius: 4,
    backgroundColor: '#D88FA8',
    marginHorizontal: 4,
    transform: [{ translateY: anim }],
  });

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={dotStyle(dot1)} />
      <Animated.View style={dotStyle(dot2)} />
      <Animated.View style={dotStyle(dot3)} />
    </View>
  );
}

// ─── Floarea centrală ─────────────────────────────────────────────────────────

function CentralFlower() {
  const scale  = useRef(new Animated.Value(0.6)).current;
  const glow   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Apare cu spring, apoi pulsează lin
    Animated.spring(scale, {
      toValue: 1,
      friction: 6,
      tension: 80,
      useNativeDriver: true,
    }).start(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scale, { toValue: 1.06, duration: 1200, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 0.97, duration: 1200, useNativeDriver: true }),
        ])
      ).start();
    });

    Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1400, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 1400, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.40] });

  return (
    <View style={styles.flowerWrap}>
      {/* Halo / glow */}
      <Animated.View style={[styles.flowerGlow, { opacity: glowOpacity }]} />
      {/* Floarea */}
      <Animated.Text style={[styles.flowerEmoji, { transform: [{ scale }] }]}>
        🌸
      </Animated.Text>
    </View>
  );
}

// ─── Ecranul principal ────────────────────────────────────────────────────────

export default function AppLoadingScreen({ message }: { message?: string }) {
  const { t } = useTranslation();
  const fadeIn = useRef(new Animated.Value(0)).current;
  const displayMessage = message ?? t('app.preparing_data');

  useEffect(() => {
    Animated.timing(fadeIn, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: fadeIn }]}>
      {/* Petale căzătoare */}
      {PETALS.map((p, i) => (
        <Petal key={i} {...p} />
      ))}

      {/* Conținut central */}
      <View style={styles.center}>
        <CentralFlower />

        <Text style={styles.appName}>{t('app.name')}</Text>
        <Text style={styles.tagline}>{t('app.tagline')}</Text>

        <View style={styles.dotsWrap}>
          <LoadingDots />
        </View>

        <Text style={styles.message}>{displayMessage}</Text>
      </View>

      {/* Gradient jos */}
      {Platform.OS === 'web' && (
        <View style={styles.bottomFade as any} />
      )}
    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FDF4EF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  } as any,

  center: {
    alignItems: 'center',
    zIndex: 10,
  },

  // Flower
  flowerWrap: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  flowerGlow: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#EAB090',
  },
  flowerEmoji: {
    fontSize: 72,
  },

  // Text
  appName: {
    fontSize: 32,
    fontFamily: 'Fraunces',
    color: '#2D1A0E',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  tagline: {
    fontSize: 15,
    fontFamily: 'Geist',
    color: '#7A5C4A',
    marginBottom: 36,
  },

  // Dots
  dotsWrap: {
    marginBottom: 16,
  },

  // Message
  message: {
    fontSize: 13,
    fontFamily: 'Geist',
    color: '#B89880',
    textAlign: 'center',
  },

  // Web gradient (bottom)
  bottomFade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
    ...(Platform.OS === 'web'
      ? { backgroundImage: 'linear-gradient(to top, #FDF4EF, transparent)' }
      : {}),
  },
});
