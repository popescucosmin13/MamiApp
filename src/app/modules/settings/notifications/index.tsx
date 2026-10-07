import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../../../stores/authStore';
import { useChildStore } from '../../../../stores/childStore';
import { authService } from '../../../../services/authService';
import { notificationService } from '../../../../services/notificationService';
import { Colors } from '../../../../theme/colors';
import { Spacing, BorderRadius, Shadow } from '../../../../theme/spacing';

interface NotificationSetting {
  id: keyof {
    vaccines: boolean;
    meals: boolean;
    sleep: boolean;
    appointments: boolean;
    aiSummary: boolean;
    community: boolean;
    milestones: boolean;
    dailyContent: boolean;
  };
  emoji: string;
  titleKey: string;
  descKey: string;
  value: boolean;
}

const QUIET_HOURS_OPTIONS = [
  { labelKey: 'notifications_screen.no_quiet_hours', start: null, end: null },
  { labelKey: '22:00 – 07:00', start: 22, end: 7 },
  { labelKey: '23:00 – 08:00', start: 23, end: 8 },
  { labelKey: '00:00 – 09:00', start: 0, end: 9 },
];

const DEFAULT_SETTINGS: NotificationSetting[] = [
  { id: 'dailyContent',emoji: '✨', titleKey: 'notifications_screen.daily_content',descKey: 'notifications_screen.daily_content_desc',value: true  },
  { id: 'vaccines',     emoji: '💉', titleKey: 'notifications_screen.vaccines',     descKey: 'notifications_screen.vaccines_desc',     value: true  },
  { id: 'milestones',  emoji: '🏆', titleKey: 'notifications_screen.milestones',   descKey: 'notifications_screen.milestones_desc',   value: true  },
  { id: 'meals',       emoji: '🍼', titleKey: 'notifications_screen.meals',        descKey: 'notifications_screen.meals_desc',        value: false },
  { id: 'sleep',       emoji: '😴', titleKey: 'notifications_screen.sleep',        descKey: 'notifications_screen.sleep_desc',        value: false },
  { id: 'appointments',emoji: '📅', titleKey: 'notifications_screen.appointments', descKey: 'notifications_screen.appointments_desc', value: true  },
  { id: 'aiSummary',   emoji: '📊', titleKey: 'notifications_screen.ai_summary',   descKey: 'notifications_screen.ai_summary_desc',   value: true  },
  { id: 'community',   emoji: '💬', titleKey: 'notifications_screen.community',    descKey: 'notifications_screen.community_desc',    value: false },
];

export default function NotificationsScreen() {
  const router = useRouter();
  const { user, profile } = useAuthStore();
  const { activeChild } = useChildStore();
  const { t } = useTranslation();

  const [permStatus, setPermStatus] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');
  const [settings, setSettings] = useState<NotificationSetting[]>(DEFAULT_SETTINGS);
  const [quietHoursIdx, setQuietHoursIdx] = useState(1);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const status = await notificationService.getPermissionStatus();
      setPermStatus(status);

      const notifPrefs = profile?.preferences?.notifications;
      if (notifPrefs) {
        setSettings(prev => prev.map(s => ({
          ...s,
          value: (notifPrefs as any)[s.id] ?? s.value,
        })));
      }

      const qhStart = profile?.preferences?.quietHoursStart;
      if (qhStart !== undefined) {
        const idx = QUIET_HOURS_OPTIONS.findIndex(o => o.start === qhStart);
        if (idx >= 0) setQuietHoursIdx(idx);
      }

      setLoading(false);
    };
    init();
  }, [profile]);

  const requestPermission = async () => {
    const granted = await notificationService.requestPermission();
    const status = await notificationService.getPermissionStatus();
    setPermStatus(status);
    if (!granted) {
      Alert.alert(
        t('notifications_screen.perm_denied_title'),
        t('notifications_screen.perm_denied_msg'),
        [
          { text: t('notifications_screen.perm_denied_cancel'), style: 'cancel' },
          { text: t('notifications_screen.perm_denied_open'), onPress: () => Platform.OS === 'web' ? undefined : Linking.openSettings() },
        ]
      );
    }
  };

  const toggleSetting = (id: string) => {
    setSettings(prev => prev.map(s => s.id === id ? { ...s, value: !s.value } : s));
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const notifPrefs = settings.reduce((acc, s) => ({ ...acc, [s.id]: s.value }), {} as Record<string, boolean>);
      const quietHours = QUIET_HOURS_OPTIONS[quietHoursIdx];
      const previousPrefs = profile?.preferences ?? {};

      await authService.updateUserProfile(user.uid, {
        preferences: {
          ...previousPrefs,
          notifications: notifPrefs as any,
          quietHoursStart: quietHours.start ?? 22,
          quietHoursEnd: quietHours.end ?? 7,
        },
      } as any);

      const childAgeMonths = activeChild?.birthDate
        ? Math.floor((Date.now() - (activeChild.birthDate as any).toDate().getTime()) / (1000 * 60 * 60 * 24 * 30))
        : 0;
      notificationService.scheduleFromPreferences(notifPrefs, childAgeMonths).catch(() => {});

      Alert.alert(t('notifications_screen.saved_title'), t('notifications_screen.saved_msg'));
      router.back();
    } catch {
      Alert.alert(t('common.error'), t('notifications_screen.save_error'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('notifications_screen.title')}</Text>
          <View style={{ width: 60 }} />
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={Colors.child.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('notifications_screen.title')}</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving}>
          <Text style={[styles.saveBtn, saving && { opacity: 0.4 }]}>
            {saving ? t('notifications_screen.saving') : t('notifications_screen.save_btn')}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>

        {permStatus === 'denied' && (
          <TouchableOpacity style={styles.permBanner} onPress={requestPermission} activeOpacity={0.85}>
            <Text style={styles.permBannerEmoji}>🔕</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.permBannerTitle}>{t('notifications_screen.perm_blocked_title')}</Text>
              <Text style={styles.permBannerSub}>{t('notifications_screen.perm_blocked_sub')}</Text>
            </View>
            <Text style={styles.permBannerArrow}>→</Text>
          </TouchableOpacity>
        )}

        {permStatus === 'undetermined' && (
          <TouchableOpacity style={styles.permWarningBanner} onPress={requestPermission} activeOpacity={0.85}>
            <Text style={styles.permBannerEmoji}>🔔</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.permWarningTitle}>{t('notifications_screen.perm_undetermined_title')}</Text>
              <Text style={styles.permBannerSub}>{t('notifications_screen.perm_undetermined_sub')}</Text>
            </View>
            <Text style={styles.permBannerArrow}>→</Text>
          </TouchableOpacity>
        )}

        {permStatus === 'granted' && (
          <View style={styles.permOkBanner}>
            <Text style={styles.permOkEmoji}>✅</Text>
            <Text style={styles.permOkText}>{t('notifications_screen.perm_ok')}</Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('notifications_screen.types_section')}</Text>
          <View style={styles.settingsCard}>
            {settings.map((setting, idx) => (
              <View key={setting.id} style={[styles.settingRow, idx < settings.length - 1 && styles.settingRowBorder]}>
                <View style={styles.emojiWrap}>
                  <Text style={styles.settingEmoji}>{setting.emoji}</Text>
                </View>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>{t(setting.titleKey)}</Text>
                  <Text style={styles.settingDesc}>{t(setting.descKey)}</Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.toggle,
                    setting.value && styles.toggleOn,
                    setting.value && permStatus !== 'granted' && styles.toggleOnPending,
                  ]}
                  onPress={() => toggleSetting(setting.id)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.toggleThumb, setting.value && styles.toggleThumbOn]} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('notifications_screen.quiet_hours_section')}</Text>
          <Text style={styles.sectionSubtitle}>{t('notifications_screen.quiet_hours_subtitle')}</Text>
          <View style={styles.settingsCard}>
            {QUIET_HOURS_OPTIONS.map((opt, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.quietRow, i < QUIET_HOURS_OPTIONS.length - 1 && styles.settingRowBorder]}
                onPress={() => setQuietHoursIdx(i)}
                activeOpacity={0.7}
              >
                <View style={[styles.radio, quietHoursIdx === i && styles.radioActive]}>
                  {quietHoursIdx === i && <View style={styles.radioDot} />}
                </View>
                <Text style={[styles.quietLabel, quietHoursIdx === i && styles.quietLabelActive]}>
                  {i === 0 ? t(opt.labelKey) : opt.labelKey}
                </Text>
                {quietHoursIdx === i && <Text style={styles.quietCheck}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoText}>
            {t('notifications_screen.info_text')}
            {permStatus !== 'granted'
              ? t('notifications_screen.info_enable')
              : t('notifications_screen.info_active')}
          </Text>
        </View>

        {permStatus !== 'granted' && (
          <TouchableOpacity
            style={styles.openSettingsBtn}
            onPress={() => Platform.OS === 'web' ? requestPermission() : Linking.openSettings()}
          >
            <Text style={styles.openSettingsBtnText}>{t('notifications_screen.open_settings')}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backArrow: { fontSize: 22, color: Colors.textPrimary },
  headerTitle: { fontSize: 18, fontFamily: 'Fraunces', color: Colors.textPrimary },
  saveBtn: { fontSize: 14, fontFamily: 'Geist-SemiBold', color: Colors.child.primary },

  permBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    margin: Spacing.xl, backgroundColor: '#FFF7ED',
    borderRadius: BorderRadius.xl, padding: Spacing.lg,
    borderWidth: 1, borderColor: '#FED7AA',
  },
  permBannerEmoji: { fontSize: 24 },
  permBannerTitle: { fontSize: 14, fontFamily: 'Geist-SemiBold', color: '#92400E' },
  permBannerSub: { fontSize: 12, fontFamily: 'Geist', color: '#B45309', marginTop: 2 },
  permBannerArrow: { fontSize: 18, color: '#F97316' },
  permWarningBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    margin: Spacing.xl, backgroundColor: '#FFFBEB',
    borderRadius: BorderRadius.xl, padding: Spacing.lg,
    borderWidth: 1, borderColor: '#FDE68A',
  },
  permWarningTitle: { fontSize: 14, fontFamily: 'Geist-SemiBold', color: '#92400E' },
  permOkBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    marginHorizontal: Spacing.xl, marginTop: Spacing.lg, marginBottom: Spacing.sm,
    backgroundColor: '#F0FDF4', borderRadius: BorderRadius.xl,
    padding: Spacing.md, borderWidth: 1, borderColor: '#BBF7D0',
  },
  permOkEmoji: { fontSize: 16 },
  permOkText: { fontSize: 13, fontFamily: 'Geist-SemiBold', color: '#15803D' },

  section: { paddingHorizontal: Spacing.xl, marginTop: Spacing.xl },
  sectionTitle: { fontSize: 15, fontFamily: 'Geist-SemiBold', color: Colors.textPrimary, marginBottom: Spacing.xs },
  sectionSubtitle: { fontSize: 12, fontFamily: 'Geist', color: Colors.textTertiary, marginBottom: Spacing.md },

  settingsCard: {
    backgroundColor: Colors.white, borderRadius: BorderRadius.xl,
    ...Shadow.sm, overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg,
  },
  settingRowBorder: {
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  emojiWrap: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: Colors.backgroundSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  settingEmoji: { fontSize: 20 },
  settingInfo: { flex: 1 },
  settingTitle: { fontSize: 14, fontFamily: 'Geist-SemiBold', color: Colors.textPrimary },
  settingDesc: { fontSize: 11, fontFamily: 'Geist', color: Colors.textTertiary, lineHeight: 16, marginTop: 1 },

  toggle: {
    width: 48, height: 28, borderRadius: 14,
    backgroundColor: Colors.border,
    justifyContent: 'center', paddingHorizontal: 2,
  },
  toggleOn: { backgroundColor: Colors.child.primary },
  toggleOnPending: { backgroundColor: '#C8A88A' },
  toggleThumb: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.white,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 2, elevation: 2,
  },
  toggleThumbOn: { alignSelf: 'flex-end' },

  quietRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg,
  },
  radio: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  radioActive: { borderColor: Colors.child.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.child.primary },
  quietLabel: { flex: 1, fontSize: 14, fontFamily: 'Geist', color: Colors.textSecondary },
  quietLabelActive: { fontFamily: 'Geist-SemiBold', color: Colors.child.primary },
  quietCheck: { fontSize: 14, color: Colors.child.primary },

  infoCard: {
    marginHorizontal: Spacing.xl, marginTop: Spacing.xl,
    backgroundColor: Colors.backgroundSoft,
    borderRadius: BorderRadius.xl, padding: Spacing.lg,
  },
  infoText: { fontSize: 12, fontFamily: 'Geist', color: Colors.textSecondary, lineHeight: 18 },

  openSettingsBtn: {
    marginHorizontal: Spacing.xl, marginTop: Spacing.lg,
    backgroundColor: Colors.white, borderRadius: BorderRadius.xl,
    padding: Spacing.md, alignItems: 'center',
    borderWidth: 1.5, borderColor: Colors.border, ...Shadow.sm,
  },
  openSettingsBtnText: { fontSize: 14, fontFamily: 'Geist-SemiBold', color: Colors.textPrimary },
});
