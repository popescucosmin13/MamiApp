import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../../../stores/authStore';
import { authService } from '../../../../services/authService';
import { getCurrentLanguage } from '../../../../i18n';
import { Colors } from '../../../../theme/colors';
import { Spacing, BorderRadius, Shadow } from '../../../../theme/spacing';

export default function EditProfileScreen() {
  const router = useRouter();
  const { user, profile, setProfile } = useAuthStore();
  const { t } = useTranslation();

  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!user) return;
    if (!displayName.trim()) {
      Alert.alert(t('edit_profile.required_field'), t('edit_profile.enter_display_name'));
      return;
    }
    setSaving(true);
    try {
      await authService.updateUserProfile(user.uid, { displayName: displayName.trim() });
      if (profile) {
        setProfile({ ...profile, displayName: displayName.trim() });
      }
      Alert.alert(t('edit_profile.saved'), t('edit_profile.profile_updated'));
      router.back();
    } catch {
      Alert.alert(t('edit_profile.error'), t('edit_profile.update_failed'));
    } finally {
      setSaving(false);
    }
  };

  const locale = getCurrentLanguage() === 'en' ? 'en-GB' : 'ro-RO';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('edit_profile.title')}</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving}>
          <Text style={[styles.saveBtn, saving && { opacity: 0.5 }]}>{t('edit_profile.save')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarEmoji}>
              {profile?.profileMode === 'pregnancy' ? '🌸' : '👶'}
            </Text>
          </View>
          <Text style={styles.avatarHint}>{t('edit_profile.avatar_hint')}</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>{t('edit_profile.display_name_label')}</Text>
            <TextInput
              style={styles.input}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder={t('edit_profile.first_name_placeholder')}
              placeholderTextColor={Colors.textTertiary}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>{t('edit_profile.email_label')}</Text>
            <View style={styles.inputReadonly}>
              <Text style={styles.inputReadonlyText}>{user?.email}</Text>
            </View>
            <Text style={styles.fieldHint}>{t('edit_profile.email_readonly_hint')}</Text>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>{t('edit_profile.profile_mode_label')}</Text>
            <View style={styles.inputReadonly}>
              <Text style={styles.inputReadonlyText}>
                {profile?.profileMode === 'pregnancy' ? t('edit_profile.pregnancy_mode') : t('edit_profile.child_mode')}
              </Text>
            </View>
            <Text style={styles.fieldHint}>{t('edit_profile.change_mode_hint')}</Text>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>{t('edit_profile.account_created_label')}</Text>
            <View style={styles.inputReadonly}>
              <Text style={styles.inputReadonlyText}>
                {user?.metadata.creationTime
                  ? new Date(user.metadata.creationTime).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
                  : '—'}
              </Text>
            </View>
          </View>
        </View>
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
  saveBtn: { fontSize: 15, fontFamily: 'Geist-SemiBold', color: Colors.child.primary },
  avatarSection: { alignItems: 'center', paddingVertical: Spacing.xl },
  avatar: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.child.primaryLight,
    alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm,
  },
  avatarEmoji: { fontSize: 40 },
  avatarHint: { fontSize: 12, fontFamily: 'Geist', color: Colors.textTertiary },
  form: { paddingHorizontal: Spacing.xl, gap: Spacing.lg, paddingBottom: Spacing['2xl'] },
  fieldGroup: {},
  fieldLabel: { fontSize: 13, fontFamily: 'Geist-SemiBold', color: Colors.textSecondary, marginBottom: Spacing.sm },
  input: {
    borderRadius: BorderRadius.lg, borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.white, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    fontSize: 14, fontFamily: 'Geist', color: Colors.textPrimary,
  },
  inputReadonly: {
    borderRadius: BorderRadius.lg, borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.backgroundSoft, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
  },
  inputReadonlyText: { fontSize: 14, fontFamily: 'Geist', color: Colors.textTertiary },
  fieldHint: { fontSize: 11, fontFamily: 'Geist', color: Colors.textTertiary, marginTop: 4 },
});
