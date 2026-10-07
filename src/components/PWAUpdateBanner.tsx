/**
 * PWAUpdateBanner
 *
 * Update-urile PWA sunt acum automate (skipWaiting pe install + SW_ACTIVATED în _layout.tsx).
 * Acest component afișează doar un link de reset pentru cazurile în care aplicația
 * rămâne blocată cu o versiune veche (rar, după un SW corupt sau cache persistent).
 *
 * Banner-ul apare doar dacă există un SW în "waiting" mai mult de 8 secunde
 * după ce pagina s-a încărcat — semn că auto-update-ul nu a funcționat.
 */

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
import { Colors } from '../theme/colors';
import { Spacing, BorderRadius } from '../theme/spacing';

const SW_CHECK_INTERVAL_MS = 3 * 60_000;
// Timp de grație înainte să arătăm bannerul de reset (dacă SW-ul tot nu s-a actualizat)
const STUCK_TIMEOUT_MS = 8_000;

export default function PWAUpdateBanner() {
  const [stuck, setStuck] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const slideAnim = useRef(new Animated.Value(80)).current;
  const stuckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { t } = useTranslation();

  const showBanner = () => {
    setDismissed(false);
    setStuck(true);
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      friction: 8,
      tension: 80,
    }).start();
  };

  const hideBanner = () => {
    Animated.timing(slideAnim, {
      toValue: 80,
      duration: 250,
      useNativeDriver: true,
    }).start(() => setDismissed(true));
  };

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    let intervalId: ReturnType<typeof setInterval>;
    let onVisibility: (() => void) | null = null;

    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => {
        const checkForUpdates = () =>
          registrations.forEach((reg) => reg.update().catch(() => {}));

        // Dacă există deja un SW în waiting la încărcare → auto-update a eșuat → banner
        registrations.forEach((reg) => {
          if (reg.waiting && navigator.serviceWorker.controller) {
            stuckTimer.current = setTimeout(showBanner, STUCK_TIMEOUT_MS);
          }
          reg.addEventListener('updatefound', () => {
            // Noul SW se instalează — dacă rămâne în waiting mai mult de STUCK_TIMEOUT,
            // înseamnă că skipWaiting nu a funcționat → arătăm bannerul de reset
            const installing = reg.installing;
            if (!installing) return;
            installing.addEventListener('statechange', () => {
              if (installing.state === 'installed' && navigator.serviceWorker.controller) {
                if (stuckTimer.current) clearTimeout(stuckTimer.current);
                stuckTimer.current = setTimeout(showBanner, STUCK_TIMEOUT_MS);
              }
            });
          });
        });

        intervalId = setInterval(checkForUpdates, SW_CHECK_INTERVAL_MS);
        onVisibility = () => {
          if (document.visibilityState === 'visible') checkForUpdates();
        };
        document.addEventListener('visibilitychange', onVisibility);
      })
      .catch(() => {});

    return () => {
      if (intervalId) clearInterval(intervalId);
      if (stuckTimer.current) clearTimeout(stuckTimer.current);
      if (onVisibility) document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  if (!stuck || dismissed || Platform.OS !== 'web') return null;

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY: slideAnim }] }]}>
      <View style={styles.banner}>
        <View style={styles.content}>
          <Text style={styles.icon}>⚠️</Text>
          <View style={styles.textBlock}>
            <Text style={styles.title}>{t('pwa.update_stuck_title')}</Text>
            <Text style={styles.subtitle}>{t('pwa.update_stuck_subtitle')}</Text>
          </View>
          <TouchableOpacity
            onPress={hideBanner}
            style={styles.closeBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.laterBtn} onPress={hideBanner} activeOpacity={0.7}>
            <Text style={styles.laterText}>{t('pwa.ignore')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.resetBtn}
            onPress={() => { window.location.href = '/reset-pwa.html'; }}
            activeOpacity={0.85}
          >
            <Text style={styles.resetBtnText}>{t('pwa.reset')}</Text>
          </TouchableOpacity>
        </View>
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
    zIndex: 10000,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  banner: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 12,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
    gap: Spacing.md,
  },
  icon: { fontSize: 24, flexShrink: 0 },
  textBlock: { flex: 1 },
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
  closeBtn: { padding: 4, flexShrink: 0 },
  closeText: { fontSize: 15, color: Colors.textTertiary },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    paddingTop: Spacing.xs,
    gap: Spacing.sm,
  },
  laterBtn: {
    flex: 1,
    height: 44,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  laterText: {
    fontSize: 14,
    fontFamily: 'Geist',
    color: Colors.textSecondary,
  },
  resetBtn: {
    flex: 2,
    height: 44,
    borderRadius: BorderRadius.lg,
    backgroundColor: '#E8997A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetBtnText: {
    fontSize: 14,
    fontFamily: 'Geist-SemiBold',
    color: Colors.white,
  },
});
