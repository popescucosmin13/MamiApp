import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Linking } from 'react-native';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../stores/authStore';
import { notificationService } from '../services/notificationService';
import { Colors } from '../theme/colors';
import { Spacing, BorderRadius, Shadow } from '../theme/spacing';

const DISMISS_STORAGE_KEY = '@mami_notif_prompt_dismissed_at';
// Cooldown escaladat: prima amânare = 4 zile, a doua = 10, apoi la fiecare 30.
// Re-întrebăm periodic (inclusiv utilizatorii care au refuzat dialogul de sistem),
// dar cu frecvență descrescătoare ca să nu devină sâcâitor.
const DISMISS_COOLDOWN_DAYS = [4, 10, 30];

type DismissState = { at: number; count: number };

async function readDismissState(): Promise<DismissState | null> {
  try {
    const raw = await AsyncStorage.getItem(DISMISS_STORAGE_KEY);
    if (!raw) return null;
    // Compatibilitate cu formatul vechi (doar timestamp-ul ca string)
    if (/^\d+$/.test(raw)) return { at: Number(raw), count: 1 };
    const parsed = JSON.parse(raw);
    if (typeof parsed?.at === 'number') {
      return { at: parsed.at, count: Number(parsed.count) || 1 };
    }
    return null;
  } catch {
    return null;
  }
}

async function writeDismissState(previous: DismissState | null): Promise<void> {
  const next: DismissState = { at: Date.now(), count: (previous?.count || 0) + 1 };
  try {
    await AsyncStorage.setItem(DISMISS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // non-critic
  }
}

function cooldownMsForCount(count: number): number {
  const days = DISMISS_COOLDOWN_DAYS[Math.min(count, DISMISS_COOLDOWN_DAYS.length) - 1]
    ?? DISMISS_COOLDOWN_DAYS[DISMISS_COOLDOWN_DAYS.length - 1];
  return days * 24 * 60 * 60 * 1000;
}

const NOTIFICATION_TYPES = [
  { emoji: '✨', key: 'daily_content' },
  { emoji: '💉', key: 'vaccines' },
  { emoji: '🏆', key: 'milestones' },
  { emoji: '🍼', key: 'meals' },
  { emoji: '😴', key: 'sleep' },
  { emoji: '📅', key: 'appointments' },
  { emoji: '📊', key: 'ai_summary' },
  { emoji: '💬', key: 'community' },
] as const;

/**
 * Popup de "priming" pentru permisiunea de notificări — arătat o singură dată
 * (cu cooldown) utilizatorilor cu aplicația instalată din Google Play care nu
 * au notificările activate. Explicăm valoarea ÎNAINTE de dialogul de sistem,
 * ca să nu irosim singura șansă de a cere permisiunea fără context.
 *
 * Efectul de auto-request din _layout.tsx e dezactivat pentru acest segment
 * cât timp status-ul e 'undetermined' — cererea reală pleacă doar din acest popup.
 */
interface Props {
  /** Notifică părintele când popup-ul devine vizibil/ascuns, ca să nu se suprapună cu alte overlay-uri (ex. campanii). */
  onVisibilityChange?: (visible: boolean) => void;
}

export default function NotificationPermissionPrompt({ onVisibilityChange }: Props) {
  const { user, profile } = useAuthStore();
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    onVisibilityChange?.(visible);
    // La demontare anunțăm false, altfel părintele ar rămâne cu flag-ul blocat
    return () => onVisibilityChange?.(false);
  }, [visible, onVisibilityChange]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    if (!user || !profile?.onboardingCompleted) return;
    if (profile.appInstallSource !== 'google_play') return;

    let cancelled = false;

    const check = async () => {
      const status = await notificationService.getPermissionStatus();
      if (status === 'granted') return;

      const dismissed = await readDismissState();
      if (dismissed && Date.now() - dismissed.at < cooldownMsForCount(dismissed.count)) return;

      if (!cancelled) setVisible(true);
    };

    const timer = setTimeout(() => {
      check().catch(() => {});
    }, 1200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [user?.uid, profile?.onboardingCompleted, profile?.appInstallSource]);

  const dismissLater = async () => {
    setVisible(false);
    await writeDismissState(await readDismissState());
  };

  const activate = async () => {
    if (!user) return;
    setRequesting(true);
    try {
      const currentStatus = await notificationService.getPermissionStatus();
      if (currentStatus === 'denied') {
        // Android nu mai arată dialogul de sistem după un refuz anterior —
        // singura cale e Setările aplicației. Intră în ciclul de re-întrebare
        // ca popup-ul să nu reapară imediat la următoarea deschidere.
        setVisible(false);
        await writeDismissState(await readDismissState());
        Linking.openSettings();
        return;
      }

      await notificationService.configure();
      const granted = await notificationService.requestPermission();
      setVisible(false);

      if (granted) {
        const token = await notificationService.getDeviceToken();
        if (token) await notificationService.saveDeviceToken(user.uid, token);
      } else {
        // A refuzat dialogul de sistem — intră în același ciclu de re-întrebare
        await writeDismissState(await readDismissState());
      }
    } finally {
      setRequesting(false);
    }
  };

  if (!visible) return null;

  const accent = profile?.profileMode === 'pregnancy' ? Colors.pregnancy.primary : Colors.child.primary;

  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        <Text style={styles.bellEmoji}>🔔</Text>
        <Text style={styles.title}>{t('notif_prompt.title')}</Text>
        <Text style={styles.subtitle}>{t('notif_prompt.subtitle')}</Text>

        <View style={styles.list}>
          {NOTIFICATION_TYPES.map((item) => (
            <View key={item.key} style={styles.listRow}>
              <Text style={styles.listEmoji}>{item.emoji}</Text>
              <Text style={styles.listLabel}>{t(`notifications_screen.${item.key}`)}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.activateButton, { backgroundColor: accent }]}
          onPress={activate}
          disabled={requesting}
          activeOpacity={0.85}
        >
          <Text style={styles.activateText}>
            {requesting ? t('notif_prompt.activating') : t('notif_prompt.activate_btn')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.laterButton} onPress={dismissLater} hitSlop={10}>
          <Text style={styles.laterText}>{t('notif_prompt.later_btn')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9998,
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
  bellEmoji: { fontSize: 36, marginBottom: Spacing.sm },
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
  list: {
    width: '100%',
    backgroundColor: Colors.backgroundSoft,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.lg,
    gap: Spacing.xs,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  listEmoji: { fontSize: 16, width: 22, textAlign: 'center' },
  listLabel: {
    fontSize: 13,
    fontFamily: 'Geist',
    color: Colors.textPrimary,
    flex: 1,
  },
  activateButton: {
    width: '100%',
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  activateText: {
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
