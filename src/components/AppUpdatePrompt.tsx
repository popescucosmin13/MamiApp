import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Linking } from 'react-native';
import { useTranslation } from 'react-i18next';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuthStore } from '../stores/authStore';
import { Colors } from '../theme/colors';
import { Spacing, BorderRadius, Shadow } from '../theme/spacing';

const PLAY_STORE_URL = 'market://details?id=com.example.mamiapp';
const PLAY_STORE_WEB_URL = 'https://play.google.com/store/apps/details?id=com.example.mamiapp';
const DISMISS_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000; // 3 zile între re-afișări

/**
 * Popup de actualizare pentru Android (instalări din Google Play).
 * Compară versionCode-ul aplicației cu appConfig/global:
 *  - latestAndroidBuild: ultimul build publicat → popup cu "mai târziu" (cooldown 3 zile)
 *  - forceUpdateBelowBuild: build-urile mai vechi de acest prag sunt blocate (fără "mai târziu")
 * Câmpurile se setează din admin panel → Setări Aplicație → Actualizare Android.
 */
export default function AppUpdatePrompt({ onVisibilityChange }: {
  onVisibilityChange?: (visible: boolean) => void;
}) {
  const { user, profile } = useAuthStore();
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [forced, setForced] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [latestBuild, setLatestBuild] = useState(0);

  useEffect(() => {
    onVisibilityChange?.(visible);
    // La demontare anunțăm false, altfel părintele ar rămâne cu flag-ul blocat
    return () => onVisibilityChange?.(false);
  }, [visible, onVisibilityChange]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    if (!user) return;
    // Expo Go / build-uri de dev nu se actualizează din Play Store
    if (Constants.appOwnership === 'expo') return;

    const currentBuild = Number(Constants.nativeBuildVersion) || 0;
    if (!currentBuild) return;

    let cancelled = false;

    const check = async () => {
      const snap = await getDoc(doc(db, 'appConfig', 'global'));
      const data = snap.data();
      if (!data || cancelled) return;

      const latest = Number(data.latestAndroidBuild) || 0;
      const forceBelow = Number(data.forceUpdateBelowBuild) || 0;
      const isForced = currentBuild < forceBelow;
      const isOutdated = latest > 0 && currentBuild < latest;
      if (!isForced && !isOutdated) return;

      if (!isForced) {
        try {
          // Cheia include build-ul țintă: o versiune nouă re-afișează imediat popup-ul
          const dismissedAt = await AsyncStorage.getItem(`@mami_update_prompt_${latest}`);
          if (dismissedAt && Date.now() - Number(dismissedAt) < DISMISS_COOLDOWN_MS) return;
        } catch {
          // continuăm
        }
      }

      if (cancelled) return;
      setForced(isForced);
      setLatestBuild(latest || forceBelow);
      setMessage(typeof data.updateMessage === 'string' && data.updateMessage.trim() ? data.updateMessage.trim() : null);
      setVisible(true);
    };

    const timer = setTimeout(() => {
      check().catch(() => {});
    }, 800);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [user?.uid]);

  const openStore = async () => {
    try {
      await Linking.openURL(PLAY_STORE_URL);
    } catch {
      Linking.openURL(PLAY_STORE_WEB_URL).catch(() => {});
    }
  };

  const dismissLater = async () => {
    setVisible(false);
    try {
      await AsyncStorage.setItem(`@mami_update_prompt_${latestBuild}`, String(Date.now()));
    } catch {
      // non-critic
    }
  };

  if (!visible) return null;

  const accent = profile?.profileMode === 'pregnancy' ? Colors.pregnancy.primary : Colors.child.primary;

  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        <Text style={styles.emoji}>🔄</Text>
        <Text style={styles.title}>{t('update_prompt.title')}</Text>
        <Text style={styles.subtitle}>
          {message || (forced ? t('update_prompt.subtitle_forced') : t('update_prompt.subtitle'))}
        </Text>

        <TouchableOpacity
          style={[styles.updateButton, { backgroundColor: accent }]}
          onPress={openStore}
          activeOpacity={0.85}
        >
          <Text style={styles.updateText}>{t('update_prompt.update_btn')}</Text>
        </TouchableOpacity>

        {!forced && (
          <TouchableOpacity style={styles.laterButton} onPress={dismissLater} hitSlop={10}>
            <Text style={styles.laterText}>{t('update_prompt.later_btn')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10010,
    padding: Spacing.xl,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    ...Shadow.lg,
  },
  emoji: { fontSize: 36, marginBottom: Spacing.sm },
  title: {
    fontSize: 18,
    fontFamily: 'Fraunces',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: 'Geist',
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: Spacing.lg,
  },
  updateButton: {
    width: '100%',
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  updateText: {
    fontSize: 15,
    fontFamily: 'Geist-SemiBold',
    color: Colors.white,
  },
  laterButton: {
    marginTop: Spacing.md,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  laterText: {
    fontSize: 11,
    fontFamily: 'Geist',
    color: Colors.textTertiary,
  },
});
