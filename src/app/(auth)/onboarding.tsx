import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { AppDatePicker } from '../../components/ui/AppDatePicker';
import Toast from 'react-native-toast-message';
import { Timestamp } from 'firebase/firestore';
import { authService } from '../../services/authService';
import { pregnancyService } from '../../services/pregnancyService';
import { childService } from '../../services/childService';
import { useAuthStore } from '../../stores/authStore';
import { useChildStore } from '../../stores/childStore';
import { Validators } from '../../lib/validation';
import { Colors } from '../../theme/colors';
import { Spacing, BorderRadius, Shadow } from '../../theme/spacing';
import { GradientButton } from '../../components/ui/GradientButton';
import { AuthBackground } from '../../components/auth/AuthBackground';
import { useTranslation } from 'react-i18next';
import { getCurrentLanguage, SupportedLanguage } from '../../i18n';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARD_MODE_KEY = '@mamiapp_onboard_mode';
const DAY_MS = 24 * 60 * 60 * 1000;

type Mode = 'pregnancy' | 'child';

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { user, profile, setProfile } = useAuthStore();
  const [mode, setMode] = useState<Mode>('child');
  const [isLoading, setIsLoading] = useState(false);
  const [preferredLanguage] = useState<SupportedLanguage>(getCurrentLanguage());

  // Read mode from AsyncStorage (set in mode-select screen)
  useEffect(() => {
    AsyncStorage.getItem(ONBOARD_MODE_KEY).then((val) => {
      if (val === 'pregnancy' || val === 'child') setMode(val);
    });
  }, []);

  // Child mode state
  const [childName, setChildName] = useState('');
  const [childGender, setChildGender] = useState<'male' | 'female' | 'other'>('other');
  const [birthDate, setBirthDate] = useState(new Date());

  // Pregnancy mode state
  const [lmpDate, setLmpDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 70); // ~10 weeks ago default
    return d;
  });

  const isPregnancy = mode === 'pregnancy';
  const accent = isPregnancy ? Colors.pregnancy : Colors.child;
  const gradientColors: [string, string] = [accent.primary, accent.primaryDark];
  const firstName = profile?.displayName?.trim().split(/\s+/)[0] || '';

  // Live pregnancy summary
  const dueDate = new Date(lmpDate.getTime() + 280 * DAY_MS);
  const pregnancyWeek = Math.min(
    42,
    Math.max(1, Math.floor((Date.now() - lmpDate.getTime()) / (7 * DAY_MS)) + 1),
  );
  const trimester = pregnancyWeek <= 13 ? 1 : pregnancyWeek <= 27 ? 2 : 3;

  const getAgeLabel = (birth: Date): string => {
    const now = new Date();
    let months =
      (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
    if (now.getDate() < birth.getDate()) months--;
    if (months < 1) return t('onboarding.newborn');
    if (months < 24) return t('onboarding.age_months', { count: months });
    return t('onboarding.age_years', { count: Math.floor(months / 12) });
  };

  const handleComplete = async () => {
    if (isLoading) return;
    if (!user) return;

    if (mode === 'child' && !childName.trim()) {
      Toast.show({ type: 'error', text1: t('onboarding.enter_baby_name') });
      return;
    }

    setIsLoading(true);
    try {
      if (mode === 'pregnancy') {
        const lmpErr = Validators.lmpDate(lmpDate);
        if (lmpErr) {
          Toast.show({ type: 'error', text1: t('onboarding.invalid_date'), text2: lmpErr });
          setIsLoading(false);
          return;
        }
        await pregnancyService.createPregnancy(user.uid, {
          lmpDate: Timestamp.fromDate(lmpDate),
          dueDate: Timestamp.fromDate(new Date(lmpDate.getTime() + 280 * DAY_MS)),
          babyName: '',
          gender: 'unknown' as any,
          weekStarted: 0,
          bagChecklist: [],
          actsChecklist: [],
          nurseryChecklist: [],
        });
      } else {
        const childData = {
          name: childName.trim(),
          gender: childGender,
          birthDate: Timestamp.fromDate(birthDate),
          birthWeight: 0,
          birthHeight: 0,
          birthHeadCircumference: 0,
          birthType: 'natural' as const,
          isActive: true,
        };
        const childId = await childService.createOrGetChild(user.uid, childData);
        useChildStore.getState().setActiveChild({ id: childId, ...childData });
        // Rulăm în paralel pentru viteză maximă
        await Promise.allSettled([
          childService.initializeVaccines(user.uid, childId, birthDate),
          childService.initializeMilestones(user.uid, childId),
        ]);
      }

      const profilePatch = {
        // profileMode urmează selecția din onboarding
        profileMode: mode,
        locale: preferredLanguage,
        onboardingCompleted: true,
      } as const;
      await authService.updateUserProfile(user.uid, profilePatch);
      if (profile) setProfile({ ...profile, ...profilePatch });

      router.replace('/(tabs)');
    } catch (err) {
      Toast.show({ type: 'error', text1: t('common.error'), text2: t('onboarding.save_error') });
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (d: Date) => {
    const locale = getCurrentLanguage() === 'en' ? 'en-GB' : 'ro-RO';
    return d.toLocaleDateString(locale, { day: '2-digit', month: 'long', year: 'numeric' });
  };

  return (
    <AuthBackground variant={mode}>
      <SafeAreaView style={styles.container}>
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: Math.max(insets.bottom + Spacing.md, Spacing['2xl']) },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header cu progres */}
          <Animated.View entering={FadeInDown.duration(500)}>
            <View style={styles.progressHeader}>
              <View style={[styles.stepPill, { backgroundColor: accent.primaryLight }]}>
                <Text style={[styles.stepPillText, { color: accent.primaryDark }]}>
                  {t('onboarding.last_step')}
                </Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { backgroundColor: accent.primary }]} />
              </View>
            </View>

            <Text style={styles.title}>
              {firstName
                ? t('onboarding.welcome_user', { name: firstName })
                : isPregnancy
                ? t('onboarding.pregnancy_details')
                : t('onboarding.about_baby')}
            </Text>
            <Text style={styles.subtitle}>
              {isPregnancy ? t('onboarding.pregnancy_details_sub') : t('onboarding.about_baby_sub')}
            </Text>
          </Animated.View>

          {isPregnancy ? (
            <>
              {/* Hero card — data nașterii, live */}
              <Animated.View entering={FadeInDown.delay(120).duration(500)}>
                <LinearGradient
                  colors={gradientColors}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.heroCard}
                >
                  <Text style={styles.heroLabel}>{t('onboarding.estimated_due_date')}</Text>
                  <Text style={styles.heroValue}>{formatDate(dueDate)}</Text>
                  <View style={styles.heroPills}>
                    <View style={styles.heroPill}>
                      <Text style={styles.heroPillText}>
                        {t('onboarding.current_week', { week: pregnancyWeek })}
                      </Text>
                    </View>
                    <View style={styles.heroPill}>
                      <Text style={styles.heroPillText}>
                        {t('onboarding.trimester', { n: trimester })}
                      </Text>
                    </View>
                  </View>
                </LinearGradient>
              </Animated.View>

              <Animated.View
                entering={FadeInDown.delay(220).duration(500)}
                style={styles.sectionCard}
              >
                <Text style={styles.label}>{t('onboarding.lmp_label')}</Text>
                <AppDatePicker
                  value={lmpDate}
                  onChange={setLmpDate}
                  mode="date"
                  style={styles.dateInput}
                />
              </Animated.View>
            </>
          ) : (
            <>
              {/* Hero card — preview bebeluș, live */}
              <Animated.View entering={FadeInDown.delay(120).duration(500)}>
                <LinearGradient
                  colors={gradientColors}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.heroCard, styles.heroCardRow]}
                >
                  <View style={styles.heroAvatar}>
                    <Text style={styles.heroAvatarText}>
                      {childName.trim() ? childName.trim().charAt(0).toUpperCase() : '👶'}
                    </Text>
                  </View>
                  <View style={styles.heroInfo}>
                    <Text style={styles.heroValue} numberOfLines={1}>
                      {childName.trim() || t('onboarding.baby_placeholder')}
                    </Text>
                    <View style={styles.heroPills}>
                      <View style={styles.heroPill}>
                        <Text style={styles.heroPillText}>{getAgeLabel(birthDate)}</Text>
                      </View>
                    </View>
                  </View>
                </LinearGradient>
              </Animated.View>

              <Animated.View
                entering={FadeInDown.delay(220).duration(500)}
                style={styles.sectionCard}
              >
                <Text style={styles.label}>{t('onboarding.baby_name_label')}</Text>
                <TextInput
                  style={styles.textInput}
                  value={childName}
                  onChangeText={setChildName}
                  placeholder={t('onboarding.baby_name_placeholder')}
                  placeholderTextColor={Colors.textTertiary}
                />
              </Animated.View>

              <Animated.View
                entering={FadeInDown.delay(300).duration(500)}
                style={styles.sectionCard}
              >
                <Text style={styles.label}>{t('onboarding.gender_label')}</Text>
                <View style={styles.genderRow}>
                  {(['female', 'male', 'other'] as const).map((g) => (
                    <TouchableOpacity
                      key={g}
                      style={[styles.genderButton, childGender === g && styles.genderButtonActive]}
                      onPress={() => setChildGender(g)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.genderEmoji}>
                        {g === 'female' ? '👧' : g === 'male' ? '👦' : '🤍'}
                      </Text>
                      <Text
                        style={[styles.genderLabel, childGender === g && styles.genderLabelActive]}
                      >
                        {g === 'female' ? t('common.girl') : g === 'male' ? t('common.boy') : t('common.unknown')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </Animated.View>

              <Animated.View
                entering={FadeInDown.delay(380).duration(500)}
                style={styles.sectionCard}
              >
                <Text style={styles.label}>{t('onboarding.birth_date_label')}</Text>
                <AppDatePicker
                  value={birthDate}
                  onChange={setBirthDate}
                  mode="date"
                  style={styles.dateInput}
                />
              </Animated.View>
            </>
          )}

          <Animated.View
            entering={FadeInDown.delay(460).duration(500)}
            style={styles.ctaContainer}
          >
            <GradientButton
              title={isLoading ? t('common.saving') : t('onboarding.lets_start')}
              onPress={handleComplete}
              loading={isLoading}
              colors={gradientColors}
            />
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </AuthBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  stepPill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
  },
  stepPillText: {
    fontSize: 11,
    fontFamily: 'Geist-Bold',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  progressTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.7)',
    overflow: 'hidden',
  },
  progressFill: {
    width: '88%',
    height: '100%',
    borderRadius: 3,
  },
  title: {
    fontSize: 30,
    fontFamily: 'Fraunces',
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: 'Geist',
    color: Colors.textSecondary,
    marginBottom: Spacing.xl,
    lineHeight: 22,
  },
  heroCard: {
    borderRadius: BorderRadius['2xl'],
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
    ...Shadow.lg,
  },
  heroCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  heroAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroAvatarText: {
    fontSize: 28,
    fontFamily: 'Fraunces',
    color: Colors.white,
  },
  heroInfo: {
    flex: 1,
  },
  heroLabel: {
    fontSize: 12,
    fontFamily: 'Geist-SemiBold',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: Spacing.xs,
  },
  heroValue: {
    fontSize: 24,
    fontFamily: 'Fraunces',
    color: Colors.white,
    marginBottom: Spacing.sm,
  },
  heroPills: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  heroPill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  heroPillText: {
    fontSize: 12,
    fontFamily: 'Geist-SemiBold',
    color: Colors.white,
  },
  sectionCard: {
    backgroundColor: Colors.surfaceStrong,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadow.sm,
  },
  label: {
    fontSize: 14,
    fontFamily: 'Geist-SemiBold',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  textInput: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.md,
    fontSize: 15,
    fontFamily: 'Geist',
    color: Colors.textPrimary,
  },
  dateInput: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 14,
    backgroundColor: Colors.white,
    width: '100%',
  },
  genderRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  genderButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  genderButtonActive: {
    borderColor: Colors.child.primary,
    backgroundColor: Colors.child.primaryLight,
  },
  genderEmoji: {
    fontSize: 24,
  },
  genderLabel: {
    fontSize: 12,
    fontFamily: 'Geist',
    color: Colors.textSecondary,
  },
  genderLabelActive: {
    fontFamily: 'Geist-SemiBold',
    color: Colors.child.primaryDark,
  },
  ctaContainer: {
    marginTop: Spacing.lg,
  },
});
