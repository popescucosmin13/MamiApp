import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { authService } from '../../services/authService';
import { pregnancyService } from '../../services/pregnancyService';
import { db } from '../../services/firebase';
import { useAuthStore } from '../../stores/authStore';
import { useChildStore } from '../../stores/childStore';
import { usePregnancyStore } from '../../stores/pregnancyStore';
import { useAccessControl } from '../../hooks/useAccessControl';
import { useAppearance } from '../../hooks/useAppearance';
import { Colors } from '../../theme/colors';
import { Spacing, BorderRadius, Shadow } from '../../theme/spacing';
import { useTranslation } from 'react-i18next';
import { APP_VERSION } from '../../constants/appVersion';

interface SettingItem {
  emoji: string;
  label: string;
  sublabel?: string;
  route?: string;
  onPress?: () => void;
  badge?: string;
  isDestructive?: boolean;
}

export default function ProfileScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { profile, user, profileMode } = useAuthStore();
  const { canUseModule } = useAccessControl();
  const appearance = useAppearance();
  const { reset: resetChild } = useChildStore();
  const { reset: resetPregnancy } = usePregnancyStore();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showPremiumUpgrade, setShowPremiumUpgrade] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'featureFlags', 'enablePremiumUpgrade'), (snap) => {
      if (snap.exists()) {
        setShowPremiumUpgrade(snap.data().enabled !== false);
      } else {
        setShowPremiumUpgrade(false);
      }
    });
    return () => unsub();
  }, []);

  const doLogout = async () => {
    setIsLoggingOut(true);
    try {
      // 1. Curăță store-urile locale ÎNAINTE de signOut
      resetChild();
      resetPregnancy();
      // 2. Șterge preferințele de aspect locale (tema nu trebuie să persiste între utilizatori)
      await AsyncStorage.removeItem('mamiapp_appearance').catch(() => {});
      // 3. Resetează tema CSS pe web la light imediat
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        document.documentElement.dataset.mamiTheme = 'light';
      }
      // 4. Deconectare Firebase
      await authService.logout();
      useAuthStore.getState().reset();
      // 5. Redirect explicit spre landing
      router.replace('/');
    } catch {
      Toast.show({ type: 'error', text1: t('profile.logout_error') });
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(t('profile.logout_confirm'))) {
        doLogout();
      }
    } else {
      Alert.alert(t('profile.logout'), t('profile.logout_confirm'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('profile.logout_action'), style: 'destructive', onPress: doLogout },
      ]);
    }
  };

  const SETTINGS_SECTIONS: { title: string; items: SettingItem[] }[] = [
    {
      title: t('profile.section_account'),
      items: [
        { emoji: '✏️', label: t('profile.edit_profile'), route: '/modules/settings/edit-profile' },
        { emoji: '🔒', label: t('profile.change_password'), route: '/modules/settings/change-password' },
        { emoji: '🔔', label: t('profile.notifications'), route: '/modules/settings/notifications' },
      ],
    },
    {
      title: t('profile.section_subscription'),
      items: showPremiumUpgrade ? [
        {
          emoji: '💎',
          label: profile?.subscription?.plan === 'premium' ? t('profile.premium_active_label') : t('profile.upgrade_premium'),
          sublabel: profile?.subscription?.plan === 'premium' ? t('profile.active') : t('profile.premium_price'),
          badge: profile?.subscription?.plan === 'premium' ? undefined : t('profile.badge_new'),
          route: '/modules/settings/subscription',
        },
      ] : profile?.subscription?.plan === 'premium' ? [
        {
          emoji: '💎',
          label: t('profile.premium_active_label'),
          sublabel: t('profile.active'),
          route: '/modules/settings/subscription',
        },
      ] : [],
    },
    {
      title: t('profile.section_app'),
      items: [
        { emoji: '👨‍👩‍👦', label: t('profile.family_access'), route: '/modules/family' },
        { emoji: '💬', label: t('profile.send_feedback'), sublabel: t('profile.send_feedback_sub'), route: '/modules/settings/feedback' },
        { emoji: '🌐', label: t('profile.language'), sublabel: t('profile.language_current'), route: '/modules/settings/language' },
      ],
    },
    {
      title: t('profile.section_privacy'),
      items: [
        { emoji: '📥', label: t('profile.export_data'), route: '/modules/settings/export-data' },
        { emoji: '📋', label: t('profile.privacy_policy'), route: '/modules/settings/privacy' },
        { emoji: '📄', label: t('profile.terms'), route: '/modules/settings/terms' },
        { emoji: '🗑️', label: t('profile.delete_account'), isDestructive: true, route: '/modules/settings/delete-account' },
      ],
    },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: appearance.colors.background }]} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={[styles.avatar, { backgroundColor: profileMode === 'pregnancy' ? Colors.pregnancy.primaryLight : Colors.child.primaryLight }]}>
            <Text style={styles.avatarEmoji}>
              {profileMode === 'pregnancy' ? '🌸' : '👶'}
            </Text>
          </View>
          <Text style={styles.displayName}>{profile?.displayName || (profile as any)?.firstName ? `${(profile as any)?.firstName ?? ''} ${(profile as any)?.lastName ?? ''}`.trim() : user?.email?.split('@')[0] || t('profile.user_default')}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          {profile?.subscription?.plan === 'premium' && (
            <View style={styles.premiumBadge}>
              <Text style={styles.premiumBadgeText}>💎 Premium</Text>
            </View>
          )}
        </View>

        {/* Mode Toggle */}
        <View style={styles.modeToggleCard}>
          <Text style={styles.modeToggleLabel}>{t('profile.active_mode')}</Text>
          <View style={styles.modeToggleButtons}>
            <TouchableOpacity
              style={[styles.modeButton, profileMode === 'child' && styles.modeButtonActive]}
              onPress={() => {
                useAuthStore.getState().setProfileMode('child');
                authService.updateUserProfile(user!.uid, { profileMode: 'child' });
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.modeButtonEmoji}>👶</Text>
              <Text style={[styles.modeButtonText, profileMode === 'child' && styles.modeButtonTextActive]}>{t('profile.mode_baby')}</Text>
              {profileMode === 'child' && (
                <View style={[styles.modeActiveBadge, { backgroundColor: Colors.child.primary }]}>
                  <Text style={styles.modeActiveBadgeText}>✓ {t('profile.active')}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeButton, profileMode === 'pregnancy' && styles.modeButtonActivePregnancy]}
              onPress={async () => {
                if (!user) return;
                if (!canUseModule('pregnancy')) {
                  Toast.show({ type: 'info', text1: t('profile.pregnancy_module_unavailable') });
                  return;
                }
                const pregnancy = await pregnancyService.getPregnancy(user.uid).catch(() => null);
                if (!pregnancy?.lmpDate) {
                  router.push('/modules/settings/add-pregnancy' as any);
                  return;
                }
                useAuthStore.getState().setProfileMode('pregnancy');
                authService.updateUserProfile(user.uid, { profileMode: 'pregnancy' });
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.modeButtonEmoji}>🌸</Text>
              <Text style={[styles.modeButtonText, profileMode === 'pregnancy' && styles.modeButtonTextActivePregnancy]}>{t('profile.mode_pregnancy')}</Text>
              {profileMode === 'pregnancy' && (
                <View style={[styles.modeActiveBadge, { backgroundColor: Colors.pregnancy.primary }]}>
                  <Text style={styles.modeActiveBadgeText}>✓ {t('profile.active')}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Settings Sections */}
        {SETTINGS_SECTIONS.filter(s => s.items.length > 0).map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.sectionCard}>
              {section.items.map((item, index) => (
                <TouchableOpacity
                  key={item.label}
                  style={[styles.settingItem, index > 0 && styles.settingItemBorder]}
                  onPress={item.onPress || (item.route ? () => router.push(item.route as any) : undefined)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.settingEmoji}>{item.emoji}</Text>
                  <View style={styles.settingContent}>
                    <Text style={[styles.settingLabel, item.isDestructive && styles.settingLabelDestructive]}>
                      {item.label}
                    </Text>
                    {item.sublabel && <Text style={styles.settingSublabel}>{item.sublabel}</Text>}
                  </View>
                  {item.badge && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{item.badge}</Text>
                    </View>
                  )}
                  <Text style={styles.chevron}>›</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {/* Logout */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          disabled={isLoggingOut}
        >
          {isLoggingOut ? (
            <ActivityIndicator color={Colors.error} />
          ) : (
            <Text style={styles.logoutText}>{t('profile.logout')}</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.version}>MamiApp v{APP_VERSION}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: Spacing['2xl'],
    paddingHorizontal: Spacing.xl,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  avatarEmoji: {
    fontSize: 44,
  },
  displayName: {
    fontSize: 22,
    fontFamily: 'Fraunces',
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  email: {
    fontSize: 14,
    fontFamily: 'Geist',
    color: Colors.textSecondary,
  },
  premiumBadge: {
    marginTop: Spacing.sm,
    backgroundColor: Colors.amber + '25',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  premiumBadgeText: {
    fontSize: 13,
    fontFamily: 'Geist-SemiBold',
    color: Colors.amber,
  },
  modeToggleCard: {
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.xl,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    ...Shadow.sm,
  },
  modeToggleLabel: {
    fontSize: 13,
    fontFamily: 'Geist-SemiBold',
    color: Colors.textTertiary,
    marginBottom: Spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modeToggleButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  modeButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    backgroundColor: Colors.backgroundSoft,
    borderWidth: 2,
    borderColor: 'transparent',
    gap: 4,
  },
  modeButtonActive: {
    backgroundColor: Colors.child.primaryLight,
    borderColor: Colors.child.primary,
    ...Shadow.sm,
  },
  modeButtonActivePregnancy: {
    backgroundColor: Colors.pregnancy.primaryLight,
    borderColor: Colors.pregnancy.primary,
    ...Shadow.sm,
  },
  modeButtonEmoji: {
    fontSize: 28,
    marginBottom: 2,
  },
  modeButtonText: {
    fontSize: 14,
    fontFamily: 'Geist-SemiBold',
    color: Colors.textSecondary,
  },
  modeButtonTextActive: {
    color: Colors.child.primaryDark,
  },
  modeButtonTextActivePregnancy: {
    color: Colors.pregnancy.primaryDark,
  },
  modeActiveBadge: {
    marginTop: 4,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  modeActiveBadgeText: {
    fontSize: 11,
    fontFamily: 'Geist-SemiBold',
    color: Colors.white,
  },
  section: {
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.xl,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'Geist-SemiBold',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
    marginLeft: Spacing.xs,
  },
  sectionCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    ...Shadow.sm,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  settingItemBorder: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  settingEmoji: {
    fontSize: 20,
    width: 28,
    textAlign: 'center',
  },
  settingContent: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 15,
    fontFamily: 'Geist',
    color: Colors.textPrimary,
  },
  settingLabelDestructive: {
    color: Colors.error,
  },
  settingSublabel: {
    fontSize: 12,
    fontFamily: 'Geist',
    color: Colors.textTertiary,
    marginTop: 2,
  },
  badge: {
    backgroundColor: Colors.child.primary,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: 'Geist-SemiBold',
    color: Colors.white,
  },
  chevron: {
    fontSize: 20,
    color: Colors.textTertiary,
    fontFamily: 'Geist',
  },
  logoutButton: {
    marginHorizontal: Spacing.xl,
    marginVertical: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.error,
  },
  logoutText: {
    fontSize: 15,
    fontFamily: 'Geist-SemiBold',
    color: Colors.error,
  },
  version: {
    fontSize: 12,
    fontFamily: 'Geist',
    color: Colors.textTertiary,
    textAlign: 'center',
    marginBottom: Spacing['2xl'],
  },
});
