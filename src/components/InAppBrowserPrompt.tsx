import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Colors } from '../theme/colors';
import { BorderRadius, Spacing } from '../theme/spacing';

type PromptOS = 'ios' | 'android';

function detectInAppBrowser(): { os: PromptOS; appName: string } | null {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined' || typeof window === 'undefined') {
    return null;
  }

  const ua = navigator.userAgent || '';
  const uaLower = ua.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(uaLower);
  const isAndroid = /android/.test(uaLower);
  if (!isIOS && !isAndroid) return null;

  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true;
  if (isStandalone) return null;

  const appName =
    /instagram/i.test(ua) ? 'Instagram'
    : /messenger|fb_iab|fban|fbav/i.test(ua) ? 'Facebook'
    : /line\//i.test(ua) ? 'LINE'
    : /tiktok/i.test(ua) ? 'TikTok'
    : /wv|; wv\)/i.test(ua) && isAndroid ? 'aplicatie'
    : '';

  if (!appName) return null;
  return { os: isIOS ? 'ios' : 'android', appName };
}

export function isInAppBrowserWeb(): boolean {
  return detectInAppBrowser() !== null;
}

export default function InAppBrowserPrompt() {
  const { t } = useTranslation();
  const [prompt, setPrompt] = useState<{ os: PromptOS; appName: string } | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const slideAnim = useRef(new Animated.Value(120)).current;

  useEffect(() => {
    const detected = detectInAppBrowser();
    if (!detected) return;

    const dismissedKey = `mamiapp_in_app_browser_prompt_${detected.os}`;
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(dismissedKey) === '1') {
      return;
    }

    setPrompt(detected);
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      friction: 8,
    }).start();
  }, [slideAnim]);

  const dismiss = () => {
    if (prompt && typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(`mamiapp_in_app_browser_prompt_${prompt.os}`, '1');
    }
    Animated.timing(slideAnim, {
      toValue: 160,
      duration: 220,
      useNativeDriver: true,
    }).start(() => setDismissed(true));
  };

  if (!prompt || dismissed || Platform.OS !== 'web') return null;

  const browserName = prompt.os === 'ios' ? t('in_app_browser.safari') : t('in_app_browser.chrome');
  const steps = prompt.os === 'ios'
    ? [t('in_app_browser.ios_step1'), t('in_app_browser.ios_step2')]
    : [t('in_app_browser.android_step1'), t('in_app_browser.android_step2')];

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY: slideAnim }] }]}>
      <View style={styles.banner}>
        <View style={styles.header}>
          <Text style={styles.icon}>{prompt.os === 'ios' ? '🧭' : '🌐'}</Text>
          <View style={styles.headerText}>
            <Text style={styles.title}>{t('in_app_browser.title', { browser: browserName })}</Text>
            <Text style={styles.subtitle}>{t('in_app_browser.subtitle', { app: prompt.appName, browser: browserName })}</Text>
          </View>
          <TouchableOpacity onPress={dismiss} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('common.close')}>
            <Text style={styles.close}>x</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.steps}>
          {steps.map((step) => (
            <Text key={step} style={styles.step}>{step}</Text>
          ))}
        </View>

        <Text style={styles.hint}>{t('in_app_browser.hint', { browser: browserName })}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10020,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  banner: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: Spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 12,
    borderTopWidth: 3,
    borderTopColor: Colors.info,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  icon: { fontSize: 26 },
  headerText: { flex: 1 },
  title: {
    fontSize: 15,
    fontFamily: 'Geist-SemiBold',
    color: Colors.textPrimary,
    marginBottom: 3,
  },
  subtitle: {
    fontSize: 12,
    fontFamily: 'Geist',
    color: Colors.textSecondary,
    lineHeight: 17,
  },
  close: {
    fontSize: 16,
    fontFamily: 'Geist-SemiBold',
    color: Colors.textTertiary,
    paddingHorizontal: Spacing.xs,
  },
  steps: {
    gap: Spacing.xs,
    backgroundColor: Colors.backgroundSoft,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  step: {
    fontSize: 13,
    fontFamily: 'Geist',
    color: Colors.textPrimary,
    lineHeight: 19,
  },
  hint: {
    fontSize: 11,
    fontFamily: 'Geist',
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 16,
  },
});
