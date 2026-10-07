import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Animated,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { usePathname } from 'expo-router';
import { Colors } from '../theme/colors';
import { Spacing } from '../theme/spacing';
import { isInAppBrowserWeb } from './InAppBrowserPrompt';

type OSType = 'ios' | 'android' | 'desktop' | null;

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

function detectOS(): OSType {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return null;

  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  if (/android/.test(ua)) return 'android';
  return 'desktop';
}

function isRunningAsPWA(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  );
}

export default function PWAInstallBanner() {
  const [visible, setVisible] = useState(false);
  const [os, setOs] = useState<OSType>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const slideAnim = useRef(new Animated.Value(120)).current;
  const { t } = useTranslation();
  const pathname = usePathname();
  const isLandingPage = pathname === '/';

  const showBanner = () => {
    if (isRunningAsPWA()) {
      setIsInstalled(true);
      setVisible(false);
      return;
    }

    setVisible(true);
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      friction: 8,
    }).start();
  };

  const hideBanner = () => {
    Animated.timing(slideAnim, {
      toValue: 160,
      duration: 220,
      useNativeDriver: true,
    }).start(() => setVisible(false));
  };

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const detectedOS = detectOS();
    setOs(detectedOS);
    if (isLandingPage && detectedOS !== 'ios') return;

    if (isRunningAsPWA()) {
      setIsInstalled(true);
      return;
    }
    if (isInAppBrowserWeb()) return;

    const handleBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      showBanner();
    };

    const handleInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      hideBanner();
    };

    const standaloneQuery = window.matchMedia('(display-mode: standalone)');
    const handleStandaloneChange = () => {
      if (isRunningAsPWA()) handleInstalled();
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleInstalled);
    standaloneQuery.addEventListener?.('change', handleStandaloneChange);

    const fallbackTimer = window.setTimeout(showBanner, detectedOS === 'android' ? 1800 : 3000);

    return () => {
      window.clearTimeout(fallbackTimer);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleInstalled);
      standaloneQuery.removeEventListener?.('change', handleStandaloneChange);
    };
  }, [isLandingPage]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    setDeferredPrompt(null);

    if (result.outcome === 'accepted' || isRunningAsPWA()) {
      setIsInstalled(true);
      hideBanner();
      return;
    }

    showBanner();
  };

  const handleGooglePlay = () => {
    window.open('https://play.google.com/store/apps/details?id=com.example.mamiapp', '_blank');
    hideBanner();
  };

  if ((isLandingPage && os !== 'ios') || !visible || isInstalled || Platform.OS !== 'web' || os === 'desktop') return null;

  const content = (() => {
    switch (os) {
      case 'ios':
        return {
          icon: '📱',
          title: t('pwa.ios_title'),
          steps: [t('pwa.ios_step1'), t('pwa.ios_step2'), t('pwa.ios_step3')],
        };
      case 'android':
        return {
          icon: '📲',
          title: 'MamiApp pentru Android',
          steps: ['Descarcă aplicația nativă din Google Play pentru cea mai bună experiență și notificări sigure.'],
        };
      default:
        return null;
    }
  })();

  if (!content) return null;

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY: slideAnim }] }]}>
      <View style={styles.banner}>
        <View style={styles.header}>
          <Text style={styles.icon}>{content.icon}</Text>
          <Text style={styles.title}>{content.title}</Text>
        </View>

        <View style={styles.steps}>
          {content.steps.map((step, index) => (
            <Text key={index} style={styles.stepText}>{step}</Text>
          ))}
        </View>

        {os === 'android' && (
          <TouchableOpacity style={styles.installButton} onPress={handleGooglePlay} activeOpacity={0.85}>
            <Text style={styles.installButtonText}>Deschide Google Play</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.keepText}>{t('pwa.auto_dismiss')}</Text>
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
    zIndex: 9999,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  banner: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: Spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
    borderTopWidth: 3,
    borderTopColor: Colors.child.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  icon: {
    fontSize: 24,
  },
  title: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  steps: {
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  stepText: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  installButton: {
    backgroundColor: Colors.child.primary,
    borderRadius: 12,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  installButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.white,
  },
  keepText: {
    fontSize: 11,
    color: Colors.textTertiary,
    lineHeight: 16,
    textAlign: 'center',
  },
});
