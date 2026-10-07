import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Pressable,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../stores/authStore';
import { useChildStore } from '../../stores/childStore';
import { useChild, useLoadChildData } from '../../hooks/useChild';
import { useLoadPregnancyData, usePregnancy } from '../../hooks/usePregnancy';
import { useAccessControl } from '../../hooks/useAccessControl';
import { useAppearance } from '../../hooks/useAppearance';
import { useGreeting } from '../../hooks/useGreeting';
import { childService } from '../../services/childService';
import { authService } from '../../services/authService';
import { Child } from '../../types/child';
import { Colors } from '../../theme/colors';
import { Spacing, BorderRadius, Shadow } from '../../theme/spacing';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { formatRelativeTime, formatDuration } from '../../lib/format';
import { Timestamp } from 'firebase/firestore';
import { Alert } from 'react-native';
import Toast from 'react-native-toast-message';
import { usePregnancyStore } from '../../stores/pregnancyStore';
import { useTimerStore, isTimerPaused, getElapsedSeconds } from '../../stores/timerStore';
import { useQuickTimerStore, type TimerKey } from '../../stores/quickTimerStore';
import { pregnancyService } from '../../services/pregnancyService';
import { feedingService } from '../../services/feedingService';
import { sleepService } from '../../services/sleepService';
import { useTranslation } from 'react-i18next';

function formatContDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

import { getCurrentLanguage } from '../../i18n';
import { getPregnancyWeekData } from '../../data/pregnancy';

function formatDateShort(ts: Timestamp): string {
  const d = ts.toDate();
  const locale = getCurrentLanguage() === 'en' ? 'en-GB' : 'ro-RO';
  return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}

function TimerIcon({ name }: { name: 'pause' | 'play' | 'save' }) {
  const glyph = name === 'pause' ? 'II' : name === 'play' ? '▶' : '✓';
  return <Text style={styles.timerGlyph}>{glyph}</Text>;
}

function safeBadgeColor(color?: string) {
  return /^#[0-9A-Fa-f]{6}$/.test(color || '') ? color : Colors.amber;
}

const INTEN_COLORS: Record<number, string> = {
  1: '#10B981', 2: '#8B5CF6', 3: '#F59E0B', 4: '#F97316', 5: '#EF4444',
};

type ModuleItem = { id: string; emoji: string; label: string; color: string; route: string; badge?: string; badgeColor?: string };
type FirstStepItem = { id: string; title: string; route: string; done: boolean };

function FirstStepsCard({
  storageKey,
  title,
  subtitle,
  steps,
  accent,
}: {
  storageKey: string;
  title: string;
  subtitle: string;
  steps: FirstStepItem[];
  accent: string;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(false);
  const completedCount = steps.filter((step) => step.done).length;
  const progress = steps.length ? completedCount / steps.length : 0;

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(storageKey)
      .then((value: string | null) => {
        if (mounted) setDismissed(value === '1');
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [storageKey]);

  const handleDismiss = () => {
    setDismissed(true);
    AsyncStorage.setItem(storageKey, '1').catch(() => {});
  };

  if (dismissed || completedCount === steps.length) return null;

  return (
    <View style={styles.firstStepsCard}>
      <View style={styles.firstStepsHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.firstStepsTitle}>{title}</Text>
          <Text style={styles.firstStepsSubtitle}>{subtitle}</Text>
        </View>
        <TouchableOpacity onPress={handleDismiss} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('first_steps.dismiss')}>
          <Text style={styles.firstStepsClose}>x</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.firstStepsProgressTrack}>
        <View
          style={[
            styles.firstStepsProgressFill,
            { width: `${Math.round(progress * 100)}%` as `${number}%`, backgroundColor: accent },
          ]}
        />
      </View>
      <Text style={styles.firstStepsProgressText}>
        {t('first_steps.progress', { done: completedCount, total: steps.length })}
      </Text>

      <View style={styles.firstStepsList}>
        {steps.map((step) => (
          <TouchableOpacity
            key={step.id}
            style={[styles.firstStepRow, step.done && styles.firstStepRowDone]}
            onPress={() => router.push(step.route as any)}
            activeOpacity={0.78}
          >
            <View style={[styles.firstStepCheck, step.done && { backgroundColor: accent, borderColor: accent }]}>
              <Text style={[styles.firstStepCheckText, step.done && styles.firstStepCheckTextDone]}>
                {step.done ? '✓' : ''}
              </Text>
            </View>
            <Text style={[styles.firstStepTitle, step.done && styles.firstStepTitleDone]}>{step.title}</Text>
            <Text style={styles.firstStepArrow}>{'>'}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function getChildModules(t: (key: string) => string): ModuleItem[] {
  return [
    { id: 'feeding',    emoji: '🍼', label: t('modules.feeding'),     color: Colors.feeding,   route: '/modules/feeding' },
    { id: 'sleep',      emoji: '😴', label: t('modules.sleep'),       color: Colors.sleep,     route: '/modules/sleep' },
    { id: 'diapers',    emoji: '🧷', label: t('modules.diapers'),     color: Colors.diaper,    route: '/modules/diapers' },
    { id: 'growth',     emoji: '📏', label: t('modules.growth'),      color: Colors.growth,    route: '/modules/growth' },
    { id: 'vaccines',   emoji: '💉', label: t('modules.vaccines'),    color: Colors.vaccine,   route: '/modules/vaccines' },
    { id: 'milestones', emoji: '⭐', label: t('modules.milestones'),  color: Colors.milestone, route: '/modules/milestones' },
    { id: 'food',       emoji: '🥕', label: t('modules.food'),        color: Colors.food,      route: '/modules/food' },
    { id: 'emotions',   emoji: '💛', label: t('modules.emotions'),    color: Colors.emotions,  route: '/modules/emotions' },
    { id: 'development',emoji: '🌱', label: t('modules.development'), color: '#5BAA90',        route: '/modules/development' },
    { id: 'teeth',      emoji: '🦷', label: t('modules.teeth'),       color: '#6ECFB0',        route: '/modules/teeth' },
    { id: 'activities', emoji: '🎨', label: t('modules.activities'),  color: Colors.activities,route: '/modules/activities' },
    { id: 'sleep-coach',emoji: '🌙', label: t('modules.sleep_coach'), color: Colors.sleep,     route: '/modules/sleep-coach' },
    { id: 'articles',   emoji: '📰', label: t('modules.articles'),    color: '#9B7AA8',        route: '/modules/articles' },
    { id: 'documents',  emoji: '📄', label: t('modules.documents'),   color: Colors.documents, route: '/modules/documents' },
    { id: 'emergency',  emoji: '🚨', label: t('modules.emergency'),   color: Colors.emergency, route: '/modules/emergency' },
  ];
}

function getPregnancyModules(t: (key: string) => string): ModuleItem[] {
  return [
    { id: 'pregnancy',   emoji: '🌸', label: t('modules.pregnancy'),     color: Colors.pregnancy.primary, route: '/modules/pregnancy' },
    { id: 'birth',       emoji: '🏥', label: t('modules.birth'),         color: Colors.sage,              route: '/modules/birth' },
    { id: 'appointments',emoji: '📅', label: t('modules.appointments'),  color: Colors.slate,             route: '/modules/appointments' },
    { id: 'documents',   emoji: '📄', label: t('modules.documents'),     color: Colors.documents,         route: '/modules/documents' },
    { id: 'nutrition',   emoji: '🥗', label: t('modules.nutrition'),     color: Colors.food,              route: '/modules/nutrition' },
    { id: 'articles',    emoji: '📰', label: t('modules.articles'),      color: '#9B7AA8',                route: '/modules/articles' },
    { id: 'wellbeing',   emoji: '💜', label: t('modules.wellbeing'),     color: Colors.wellbeing,         route: '/modules/wellbeing' },
    { id: 'emergency',   emoji: '🚨', label: t('modules.emergency'),     color: Colors.emergency,         route: '/modules/emergency' },
    { id: 'community',   emoji: '👥', label: t('modules.community'),     color: Colors.community,         route: '/(tabs)/community' },
  ];
}

function NoBabyState() {
  const router = useRouter();
  const { user, profile } = useAuthStore();
  const { t, i18n } = useTranslation();
  const switchToPregnancy = () => {
    useAuthStore.getState().setProfileMode('pregnancy');
    if (user) authService.updateUserProfile(user.uid, { profileMode: 'pregnancy' } as any).catch(() => {});
  };
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={[styles.scrollContent, styles.emptyStateContainer]} showsVerticalScrollIndicator={false}>
      <View style={styles.emptyIllustration}>
        <Text style={styles.emptyIllustrationEmoji}>👶</Text>
        <View style={styles.emptyIllustrationRing} />
      </View>
      <Text style={styles.emptyTitle}>{t('home.no_baby_title')}</Text>
      <Text style={styles.emptySubtitle}>{t('home.no_baby_subtitle')}</Text>
      <TouchableOpacity style={styles.emptyPrimaryBtn} onPress={() => router.push('/modules/settings/add-child' as any)} activeOpacity={0.85}>
        <Text style={styles.emptyPrimaryBtnText}>✨ {t('home.add_baby')}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.emptySecondaryBtn} onPress={switchToPregnancy} activeOpacity={0.7}>
        <Text style={styles.emptySecondaryBtnText}>🌸 {t('home.still_pregnant')}</Text>
      </TouchableOpacity>
      <View style={styles.emptyPreviewGrid}>
        {[
          { emoji: '🍼', key: 'modules.feeding' },
          { emoji: '😴', key: 'modules.sleep' },
          { emoji: '📏', key: 'modules.growth' },
          { emoji: '💉', key: 'modules.vaccines' },
          { emoji: '⭐', key: 'modules.milestones' },
          { emoji: '🥕', key: 'modules.food' },
        ].map(item => (
          <View key={item.key} style={styles.emptyPreviewCard}>
            <Text style={styles.emptyPreviewEmoji}>{item.emoji}</Text>
            <Text style={styles.emptyPreviewLabel}>{t(item.key)}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.emptyPreviewHint}>{t('home.and_more')}</Text>
    </ScrollView>
  );
}

function NoPregnancyState() {
  const router = useRouter();
  const { t } = useTranslation();
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={[styles.scrollContent, styles.emptyStateContainer]} showsVerticalScrollIndicator={false}>
      <View style={styles.emptyIllustration}>
        <Text style={styles.emptyIllustrationEmoji}>🌸</Text>
        <View style={[styles.emptyIllustrationRing, { borderColor: Colors.pregnancy.primaryLight }]} />
      </View>
      <Text style={styles.emptyTitle}>{t('home.no_pregnancy_title')}</Text>
      <Text style={styles.emptySubtitle}>{t('home.no_pregnancy_subtitle')}</Text>
      <TouchableOpacity style={[styles.emptyPrimaryBtn, { backgroundColor: Colors.pregnancy.primary }]} onPress={() => router.push('/modules/settings/add-pregnancy' as any)} activeOpacity={0.85}>
        <Text style={styles.emptyPrimaryBtnText}>{t('home.add_pregnancy')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── DevelopmentInsightCard (home widget) ─────────────────────────────────────
import { developmentService } from '../../services/developmentService';
import type { DevelopmentInsight } from '../../types/development';

const DEV_INSIGHT_META: Record<string, { color: string; gradStart: string; gradEnd: string; icon: string; label: string }> = {
  possible_growth_spurt: { color: '#D4906C', gradStart: '#EAB090', gradEnd: '#C87858', icon: '📈', label: 'Puseu creștere' },
  sleep_adjustment:      { color: '#7A9EC8', gradStart: '#9AB8D8', gradEnd: '#6A88B8', icon: '🌙', label: 'Somn ajustat' },
  new_milestone:         { color: '#C8AA50', gradStart: '#E0C870', gradEnd: '#B89040', icon: '⭐', label: 'Achiziție nouă' },
  teething:              { color: '#A888C0', gradStart: '#C0A0D8', gradEnd: '#9070A8', icon: '🦷', label: 'Dentiție' },
  default:               { color: '#5BAA90', gradStart: '#80C4A8', gradEnd: '#4A9878', icon: '🌱', label: 'Dezvoltare' },
};

// Built-in sensitive periods by age (weeks) as fallback
const BUILTIN_PERIODS = [
  { weeks: [4, 5],   icon: '👁️', color: '#9AB8D8', g1: '#9AB8D8', g2: '#6A88B8', name: 'Primele senzații', desc: 'Bebelușul devine mai receptiv la lumină, sunete și atingeri. Poate fi mai agitat sau mai somnoros.' },
  { weeks: [8, 10],  icon: '😄', color: '#D4906C', g1: '#EAB090', g2: '#C87858', name: 'Primele zâmbete sociale', desc: 'Apar primele zâmbete intenționate. Poate fi mai atașat de tine și mai agitat când e singur.' },
  { weeks: [11, 13], icon: '🌍', color: '#5BAA90', g1: '#80C4A8', g2: '#4A9878', name: 'Lumea ca un întreg', desc: 'Copilul începe să perceapă patterns și conexiuni. Perioadă de curiozitate intensă.' },
  { weeks: [14, 20], icon: '🎯', color: '#C8AA50', g1: '#E0C870', g2: '#B89040', name: 'Primele abilități motorii', desc: 'Încearcă să apuce obiecte, se rostogolește, explorează cu mâinile.' },
  { weeks: [22, 26], icon: '🔗', color: '#A888C0', g1: '#C0A0D8', g2: '#9070A8', name: 'Relații și distanțe', desc: 'Înțelege că obiectele există chiar și când nu le vede. Anxietate de separare posibilă.' },
  { weeks: [33, 37], icon: '📦', color: '#D4906C', g1: '#EAB090', g2: '#C87858', name: 'Categorii și grupuri', desc: 'Sortează, grupează, clasifică. Poate fi selectiv cu mâncarea sau jucăriile.' },
  { weeks: [41, 46], icon: '🔁', color: '#7A9EC8', g1: '#9AB8D8', g2: '#6A88B8', name: 'Secvențe și rutine', desc: 'Înțelege ordinea lucrurilor. Poate fi rigid față de schimbări în rutină.' },
  { weeks: [50, 55], icon: '🗺️', color: '#5BAA90', g1: '#80C4A8', g2: '#4A9878', name: 'Programe și sisteme', desc: 'Încearcă să controleze mediul. Perioadă intensă de explorare și autonomie.' },
];

function getCurrentPeriod(ageWeeks: number) {
  const match = BUILTIN_PERIODS.find(p => ageWeeks >= p.weeks[0] - 2 && ageWeeks <= p.weeks[1] + 2);
  return match ?? null;
}

function DevelopmentHomeCard() {
  const router = useRouter();
  const { user, profile } = useAuthStore();
  const { activeChild } = useChild();
  const [insight, setInsight] = useState<DevelopmentInsight | null>(null);

  useEffect(() => {
    if (!user || !activeChild) return;
    developmentService.getInsights(user.uid, activeChild.id).then(all => {
      const valid = all.filter(i => new Date(i.expiresAt).getTime() > Date.now());
      if (valid.length) setInsight(valid[0]);
    });
  }, [user?.uid, activeChild?.id]);

  const hasInsight = !!insight;
  const meta = hasInsight
    ? (DEV_INSIGHT_META[insight!.type] ?? DEV_INSIGHT_META.default)
    : DEV_INSIGHT_META.default;

  // Compute age in weeks for sensitive period
  const ageWeeks = activeChild?.birthDate
    ? Math.floor((Date.now() - activeChild.birthDate.toDate().getTime()) / (1000 * 60 * 60 * 24 * 7))
    : null;
  const period = !hasInsight && ageWeeks !== null ? getCurrentPeriod(ageWeeks) : null;

  // Resolved display values
  const gradColors: [string, string] = hasInsight
    ? [meta.gradStart, meta.gradEnd]
    : period
      ? [period.g1, period.g2]
      : ['#5BAA90', '#3A8A70'];
  const cardIcon   = hasInsight ? meta.icon   : period ? period.icon   : '🌱';
  const cardBadge  = hasInsight ? meta.label  : period ? 'Perioadă sensibilă' : 'Dezvoltare';
  const cardTitle  = hasInsight ? insight!.title : period ? period.name  : 'Urmărește dezvoltarea';
  const cardDesc   = hasInsight
    ? insight!.message.slice(0, 90) + (insight!.message.length > 90 ? '…' : '')
    : period
      ? period.desc
      : 'Achiziții CDC, pusee de creștere și perioade sensibile detectate din datele copilului.';
  const isLight = !hasInsight && !period;

  return (
    <TouchableOpacity
      onPress={() => router.push('/modules/development' as any)}
      activeOpacity={0.88}
      style={devCardStyle.wrap}
    >
      <LinearGradient
        colors={gradColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={devCardStyle.gradient}
      >
        {/* decorative orbs */}
        <View style={[devCardStyle.orb1, { backgroundColor: 'rgba(255,255,255,0.12)' }]} />
        <View style={[devCardStyle.orb2, { backgroundColor: 'rgba(255,255,255,0.07)' }]} />

        <View style={devCardStyle.inner}>
          <View style={devCardStyle.iconPill}>
            <Text style={devCardStyle.iconText}>{cardIcon}</Text>
          </View>

          <View style={{ flex: 1 }}>
            <View style={devCardStyle.badge}>
              <View style={devCardStyle.badgeDot} />
              <Text style={devCardStyle.badgeText}>{cardBadge}</Text>
            </View>
            <Text style={devCardStyle.title}>{cardTitle}</Text>
            <Text style={devCardStyle.subtitle} numberOfLines={2}>{cardDesc}</Text>
          </View>

          <View style={devCardStyle.arrowCircle}>
            <Text style={devCardStyle.arrowText}>›</Text>
          </View>
        </View>

        {hasInsight && insight!.suggestions.length > 0 ? (
          <View style={devCardStyle.suggestionsStrip}>
            <Text style={devCardStyle.suggestionsText} numberOfLines={1}>
              💡 {insight!.suggestions[0]}
            </Text>
          </View>
        ) : null}
        {!hasInsight && period ? (
          <View style={devCardStyle.suggestionsStrip}>
            <Text style={devCardStyle.suggestionsText} numberOfLines={1}>
              🔍 Apasă pentru achiziții CDC și recomandări
            </Text>
          </View>
        ) : null}
      </LinearGradient>
    </TouchableOpacity>
  );
}

const devCardStyle = StyleSheet.create({
  wrap:            { marginHorizontal: 20, marginBottom: 14, borderRadius: 22,
                     shadowColor: '#3A4A50', shadowOpacity: 0.13, shadowOffset: { width: 0, height: 4 }, shadowRadius: 12, elevation: 4 },
  gradient:        { borderRadius: 22, overflow: 'hidden', padding: 18 },
  orb1:            { position: 'absolute', width: 130, height: 130, borderRadius: 65, top: -45, right: -30 },
  orb2:            { position: 'absolute', width: 80,  height: 80,  borderRadius: 40, bottom: -20, left: 20 },
  inner:           { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  iconPill:        { width: 52, height: 52, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  iconText:        { fontSize: 26 },
  badge:           { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', borderRadius: 20,
                     backgroundColor: 'rgba(255,255,255,0.22)', paddingHorizontal: 9, paddingVertical: 3, marginBottom: 6, gap: 5 },
  badgeDot:        { width: 5, height: 5, borderRadius: 3, backgroundColor: '#FFFFFF' },
  badgeText:       { fontFamily: 'Geist-SemiBold', fontSize: 10, color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: 0.5 },
  title:           { fontFamily: 'Fraunces', fontSize: 16, color: '#FFFFFF', lineHeight: 22, marginBottom: 4 },
  subtitle:        { fontFamily: 'Geist', fontSize: 12, color: 'rgba(255,255,255,0.82)', lineHeight: 18 },
  arrowCircle:     { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 4 },
  arrowText:       { fontSize: 22, fontWeight: '700', color: '#FFFFFF', lineHeight: 26 },
  suggestionsStrip:{ marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.22)' },
  suggestionsText: { fontFamily: 'Geist', fontSize: 12, color: 'rgba(255,255,255,0.85)' },
});


function ChildHomeContent() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { canUseModule, modules: remoteModules } = useAccessControl();
  const { user, profile } = useAuthStore();
  const { activeChild, feeds, sleeps, diapers, measurements, isLoading } = useChild();
  useLoadChildData();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={Colors.child.primary} size="large" />
      </View>
    );
  }

  if (!activeChild) return <NoBabyState />;

  const lastFeed = feeds[0];
  const lastDiaper = diapers[0];

  const lastWeight = [...measurements].reverse().find(m => m.weight != null);
  const lastHeight = [...measurements].reverse().find(m => m.height != null);
  const lastHead   = [...measurements].reverse().find(m => m.headCircumference != null);

  const ageInDays = activeChild?.birthDate
    ? Math.floor((Date.now() - activeChild.birthDate.toDate().getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const ageDisplay = ageInDays !== null
    ? ageInDays < 30
      ? t('home.age_days', { count: ageInDays })
      : ageInDays < 365
      ? t('home.age_months', { count: Math.floor(ageInDays / 30) })
      : `${Math.floor(ageInDays / 365)} ${t('home.years')} ${Math.floor((ageInDays % 365) / 30)} ${t('home.months')}`
    : '';

  const scuteceAzi = diapers.filter(d => {
    const t = (d.timestamp as Timestamp).toDate();
    return Date.now() - t.getTime() < 24 * 60 * 60 * 1000;
  }).length;

  // Total somn 24h
  const now24 = Date.now();
  const totalSleep24hSec = sleeps
    .filter(s => {
      const st = (s.startTime as any)?.toDate?.() ?? new Date((s.startTime as any));
      return now24 - st.getTime() < 24 * 60 * 60 * 1000;
    })
    .reduce((acc, s) => acc + (s.duration || 0), 0);
  const sleep24hDisplay = totalSleep24hSec > 0 ? formatDuration(totalSleep24hSec) : '0h';

  const avatarEmoji = activeChild?.gender === 'female' ? '👧' : activeChild?.gender === 'male' ? '👦' : '👶';
  const childFirstSteps: FirstStepItem[] = [
    { id: 'feeding', title: t('first_steps.child_feeding'), route: '/modules/feeding', done: feeds.length > 0 },
    { id: 'sleep', title: t('first_steps.child_sleep'), route: '/modules/sleep', done: sleeps.length > 0 },
    { id: 'diapers', title: t('first_steps.child_diaper'), route: '/modules/diapers', done: diapers.length > 0 },
    {
      id: 'notifications',
      title: t('first_steps.child_notifications'),
      route: '/modules/settings/notifications',
      done: Boolean(profile?.preferences?.notifications?.meals || profile?.preferences?.notifications?.sleep),
    },
  ];

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

      {/* ══════════════════════════════════════════════
           HERO CARD — premium redesign
      ══════════════════════════════════════════════ */}
      <View style={heroS.cardShadow}>
        <LinearGradient
          colors={['#EAB090', '#D4906C', '#BA7050']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={heroS.cardGradient}
        >
          {/* Background orbs */}
          <View style={heroS.orbTopRight} />
          <View style={heroS.orbBottomLeft} />
          <View style={heroS.orbMid} />

          {/* ── TOP ROW: avatar + name + age ── */}
          <View style={heroS.topRow}>
            <TouchableOpacity onPress={() => router.push('/modules/settings/edit-profile' as any)} activeOpacity={0.85}>
              <View style={heroS.avatarRing}>
                <LinearGradient colors={['rgba(255,255,255,0.35)', 'rgba(255,255,255,0.1)']} style={heroS.avatarInner}>
                  <Text style={heroS.avatarEmoji}>{avatarEmoji}</Text>
                </LinearGradient>
              </View>
            </TouchableOpacity>

            <View style={heroS.nameBlock}>
              <Text style={heroS.nameSup}>{t('home.baby_your')}</Text>
              <Text style={heroS.nameMain} numberOfLines={1}>{activeChild?.name || t('home.baby_default')}</Text>
              <View style={heroS.agePill}>
                <View style={heroS.agePillDot} />
                <Text style={heroS.agePillText}>{ageDisplay}</Text>
              </View>
            </View>

            {/* Action buttons */}
            <View style={heroS.actionCol}>
              <TouchableOpacity style={heroS.actionBtn} onPress={() => router.push('/modules/growth')} activeOpacity={0.8}>
                <Text style={heroS.actionBtnEmoji}>📈</Text>
              </TouchableOpacity>
              <TouchableOpacity style={heroS.actionBtn} onPress={() => router.push('/modules/development' as any)} activeOpacity={0.8}>
                <Text style={heroS.actionBtnEmoji}>🌱</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ── GROWTH STATS ── */}
          <View style={heroS.divider} />
          <View style={heroS.statsRow}>
            {[
              { emoji: '⚖️', value: lastWeight ? `${lastWeight.weight!.toFixed(1)} kg` : null, empty: `+ ${t('home.weight')}`, label: t('home.weight'), route: '/modules/growth' },
              { emoji: '📏', value: lastHeight  ? `${lastHeight.height} cm`               : null, empty: `+ ${t('home.height')}`, label: t('home.height'),  route: '/modules/growth' },
              { emoji: '🔵', value: lastHead    ? `${lastHead.headCircumference} cm`       : null, empty: `+ ${t('home.head_circ')}`, label: t('home.head_circ'), route: '/modules/growth' },
            ].map((s, i, arr) => (
              <View key={s.label} style={{ flexDirection: 'row', flex: 1, alignItems: 'center' }}>
                <TouchableOpacity style={heroS.statItem} onPress={() => router.push(s.route as any)} activeOpacity={0.75}>
                  <Text style={heroS.statEmoji}>{s.emoji}</Text>
                  {s.value
                    ? <Text style={heroS.statValue}>{s.value}</Text>
                    : <Text style={heroS.statEmpty}>{s.empty}</Text>
                  }
                  <Text style={heroS.statLabel}>{s.label}</Text>
                </TouchableOpacity>
                {i < arr.length - 1 ? <View style={heroS.statDivider} /> : null}
              </View>
            ))}
          </View>
        </LinearGradient>
      </View>

      {/* ══════════════════════════════════════════════
           QUICK ACTIVITY PILLS
      ══════════════════════════════════════════════ */}
      <View style={heroS.pillsRow}>
        <TouchableOpacity style={heroS.pill} onPress={() => router.push('/modules/feeding')} activeOpacity={0.8}>
          <LinearGradient colors={['#FBF0EB', '#F5E5DC']} style={heroS.pillGrad}>
            <Text style={heroS.pillEmoji}>🍼</Text>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={heroS.pillValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{lastFeed ? formatRelativeTime(lastFeed.timestamp, i18n.language) : '—'}</Text>
              <Text style={heroS.pillLabel} numberOfLines={1}>{t('modules.feeding')}</Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity style={heroS.pill} onPress={() => router.push('/modules/sleep')} activeOpacity={0.8}>
          <LinearGradient colors={totalSleep24hSec === 0 ? ['#FFF3E0', '#FFE0B2'] : ['#EBF2FA', '#DDE8F5']} style={heroS.pillGrad}>
            <Text style={heroS.pillEmoji}>{totalSleep24hSec === 0 ? '⚠️' : '😴'}</Text>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[heroS.pillValue, { color: totalSleep24hSec === 0 ? '#E65100' : '#3A68A0' }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{sleep24hDisplay}</Text>
              <Text style={[heroS.pillLabel, { color: totalSleep24hSec === 0 ? '#BF360C' : '#6A90B8' }]} numberOfLines={1}>{t('home.sleep_24h')}</Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity style={heroS.pill} onPress={() => router.push('/modules/diapers')} activeOpacity={0.8}>
          <LinearGradient colors={['#EDFAF5', '#DDF5EC']} style={heroS.pillGrad}>
            <Text style={heroS.pillEmoji}>🧷</Text>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[heroS.pillValue, { color: '#2A7A58' }]} numberOfLines={1}>{scuteceAzi}</Text>
              <Text style={[heroS.pillLabel, { color: '#5AAA88' }]} numberOfLines={1}>{t('modules.diapers')}</Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {totalSleep24hSec === 0 && (
        <TouchableOpacity
          style={heroS.noSleepWarning}
          onPress={() => router.push('/modules/sleep')}
          activeOpacity={0.85}
        >
          <View style={{ flex: 1 }}>
            <Text style={heroS.noSleepTitle}>{t('home.no_sleep_today')}</Text>
            <Text style={heroS.noSleepDesc}>{t('home.no_sleep_desc')}</Text>
          </View>
          <View style={heroS.noSleepBtn}>
            <Text style={heroS.noSleepBtnText}>+ {t('home.add_sleep')}</Text>
          </View>
        </TouchableOpacity>
      )}

      {user && (
        <FirstStepsCard
          storageKey={`mamiapp_first_steps_child_${user.uid}_${activeChild.id}`}
          title={t('first_steps.child_title')}
          subtitle={t('first_steps.child_subtitle')}
          steps={childFirstSteps}
          accent={Colors.child.primary}
        />
      )}

      <DevelopmentHomeCard />

      <View style={[styles.moduleGrid, { marginBottom: 24 }]}>
        {getChildModules(t).map((mod) => {
          const locked = !canUseModule(mod.id);
          const remoteMod = remoteModules?.[mod.id];
          const badgeText = remoteMod?.badge || mod.badge;
          const badgeColor = remoteMod?.badgeColor || mod.badgeColor;

          return (
            <TouchableOpacity
              key={mod.id}
              style={[
                styles.moduleCard,
                locked && styles.moduleCardLocked,
                mod.id === 'emergency' && styles.moduleCardUrgent,
              ]}
              onPress={() => router.push(mod.route as any)}
              activeOpacity={0.8}
            >
              {badgeText ? (
                <View style={[styles.moduleLockBadge, { backgroundColor: safeBadgeColor(badgeColor) }]}>
                  <Text style={[styles.moduleLockText, { fontSize: 7, textTransform: 'uppercase', letterSpacing: 0.3 }]}>{badgeText}</Text>
                </View>
              ) : locked ? (
                <View style={styles.moduleLockBadge}>
                  <Text style={styles.moduleLockText}>Premium</Text>
                </View>
              ) : null}

              <View style={[styles.moduleIcon, { backgroundColor: mod.color + '22' }]}>
                <Text style={styles.moduleEmoji}>{mod.emoji}</Text>
              </View>
              <Text style={styles.moduleLabel}>{mod.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}


function PregnancyHomeContent() {
  const router = useRouter();
  const { t } = useTranslation();
  const { canUseModule, modules: remoteModules } = useAccessControl();
  const { user, profile } = useAuthStore();
  const { pregnancy, currentWeek, trimester, weeksLeft, progress, isLoading, appointments } = usePregnancy();
  useLoadPregnancyData();

  const { contractions, movements, addContraction, addMovement: addMovementToStore } = usePregnancyStore();
  const { startTimer, stopTimer, pauseTimer, resumeTimer, getTimer } = useTimerStore();
  const [contractionIntensity, setContractionIntensity] = useState<1|2|3|4|5>(3);
  const [contrElapsed, setContrElapsed] = useState(0);
  const timer = getTimer('contraction');
  const paused = !!timer && isTimerPaused(timer);
  const isTracking = !!timer;

  useEffect(() => {
    if (!timer) { setContrElapsed(0); return; }
    const tick = () => {
      const t = useTimerStore.getState().getTimer('contraction');
      if (t) setContrElapsed(getElapsedSeconds(t));
    };
    tick();
    if (paused) return;
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [timer?.id, paused, timer?.totalPausedMs]);

  const stopAndSaveContraction = async () => {
    if (!user || !timer) return;
    const startTs = Timestamp.fromMillis(timer.startTime);
    const endTs = Timestamp.now();
    const duration = contrElapsed;
    stopTimer(timer.id);
    try {
      const c = { startTime: startTs, endTime: endTs, duration, intensity: contractionIntensity };
      const id = await pregnancyService.addContraction(user.uid, c);
      addContraction({ ...c, id });
      Toast.show({ type: 'success', text1: t('home.contraction_saved') });
    } catch {
      Alert.alert(t('common.error'), t('home.contraction_save_error'));
    }
  };

  const [savingMovement, setSavingMovement] = useState(false);
  const todayStart = new Date();
  todayStart.setHours(0,0,0,0);
  const todayStartMs = todayStart.getTime();
  const todayMovementsCount = movements
    .filter(m => m.date.toMillis() >= todayStartMs)
    .reduce((acc, m) => acc + m.count, 0);

  const addMovement = async () => {
    if (!user || savingMovement) return;
    setSavingMovement(true);
    try {
      const m = { date: Timestamp.now(), count: 1, durationMinutes: 0 };
      const id = await pregnancyService.addMovement(user.uid, m);
      addMovementToStore({ ...m, id });
      Toast.show({ type: 'success', text1: t('home.movement_saved') });
    } catch {
      Toast.show({ type: 'error', text1: t('common.save_error') });
    } finally {
      setSavingMovement(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={Colors.pregnancy.primary} size="large" />
      </View>
    );
  }

  if (!pregnancy?.lmpDate) return <NoPregnancyState />;

  const trimesterLabel = trimester === 1 ? t('home.trimester_1') : trimester === 2 ? t('home.trimester_2') : t('home.trimester_3');
  const weekData = currentWeek?.week ? getPregnancyWeekData(currentWeek.week, getCurrentLanguage()) : null;
  const pregnancyFirstSteps: FirstStepItem[] = [
    { id: 'appointments', title: t('first_steps.pregnancy_appointment'), route: '/modules/appointments', done: appointments.length > 0 },
    { id: 'movement', title: t('first_steps.pregnancy_movement'), route: '/modules/pregnancy/fetal-movements', done: movements.length > 0 },
    {
      id: 'birth',
      title: t('first_steps.pregnancy_birth'),
      route: '/modules/birth',
      done: Boolean(pregnancy.birthPlan || pregnancy.bagChecklist?.some((item) => item.done)),
    },
    {
      id: 'notifications',
      title: t('first_steps.pregnancy_notifications'),
      route: '/modules/settings/notifications',
      done: Boolean(profile?.preferences?.notifications?.appointments || profile?.preferences?.notifications?.aiSummary),
    },
  ];

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      {/* Hero sarcină */}
      <TouchableOpacity activeOpacity={0.95} style={styles.heroCardWrap} onPress={() => router.push('/modules/pregnancy')}>
        <LinearGradient
          colors={[Colors.pregnancy.primary, Colors.pregnancy.primaryDark]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.heroCardGradient}
        >
          <View style={styles.heroOrb1} />
          <View style={styles.heroOrb2} />
          <View style={styles.heroTopRow}>
            <View style={styles.heroAvatarRing}>
              <View style={styles.heroAvatarInner}>
                <Text style={styles.heroAvatarEmoji}>{weekData?.babyEmoji ?? '🌸'}</Text>
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.pregnancyWeekTitle}>
                {currentWeek?.week ? t('home.week_title', { week: currentWeek.week }) : t('home.your_pregnancy')}
              </Text>
              {weekData && (
                <Text style={styles.pregnancySizeText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
                  {t('home.baby_size_line', { size: weekData.babySize })}
                </Text>
              )}
            </View>
            <View style={styles.heroChevron}>
              <Text style={styles.heroChevronText}>›</Text>
            </View>
          </View>

          <View style={styles.pregnancyProgressWrap}>
            <View style={styles.pregnancyProgressTrack}>
              <View style={[styles.pregnancyProgressFill, { width: `${Math.min(progress, 100)}%` as `${number}%` }]} />
            </View>
            <View style={styles.pregnancyProgressLabels}>
              <Text style={styles.pregnancyProgressPct}>{trimesterLabel}</Text>
              <Text style={styles.pregnancyProgressLeft}>{t('home.weeks_left', { count: weeksLeft })}</Text>
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>

      {user && (
        <FirstStepsCard
          storageKey={`mamiapp_first_steps_pregnancy_${user.uid}`}
          title={t('first_steps.pregnancy_title')}
          subtitle={t('first_steps.pregnancy_subtitle')}
          steps={pregnancyFirstSteps}
          accent={Colors.pregnancy.primary}
        />
      )}

      {/* Module Grid */}
      <View style={[styles.moduleGrid, { marginBottom: 16 }]}>
        {getPregnancyModules(t).map((mod) => {
          const locked = !canUseModule(mod.id);
          const remoteMod = remoteModules?.[mod.id];
          const badgeText = remoteMod?.badge || mod.badge;
          const badgeColor = remoteMod?.badgeColor || mod.badgeColor;
          return (
            <TouchableOpacity
              key={mod.id}
              style={[styles.moduleCard, locked && styles.moduleCardLocked, mod.id === 'emergency' && styles.moduleCardUrgent]}
              onPress={() => router.push(mod.route as any)}
              activeOpacity={0.8}
            >
              {badgeText ? (
                <View style={[styles.moduleLockBadge, { backgroundColor: safeBadgeColor(badgeColor) }]}>
                  <Text style={[styles.moduleLockText, { fontSize: 7, textTransform: 'uppercase', letterSpacing: 0.3 }]}>{badgeText}</Text>
                </View>
              ) : locked ? (
                <View style={styles.moduleLockBadge}>
                  <Text style={styles.moduleLockText}>Premium</Text>
                </View>
              ) : null}
              <View style={[styles.moduleIcon, { backgroundColor: mod.color + '22' }]}>
                <Text style={styles.moduleEmoji}>{mod.emoji}</Text>
              </View>
              <Text style={styles.moduleLabel}>{mod.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={[styles.card, { borderWidth: isTracking ? 2 : 0, borderColor: isTracking ? Colors.error : 'transparent' }]}>
        <Text style={styles.cardTitle}>⏱️ {t('home.contractions')}</Text>
        <View style={{ alignItems: 'center', marginVertical: Spacing.sm }}>
          <Text style={{ fontSize: 48, fontFamily: 'Geist-Bold', color: isTracking && !paused ? Colors.error : Colors.textPrimary }}>
            {formatContDuration(contrElapsed)}
          </Text>
          {paused ? <Text style={{ fontSize: 12, color: Colors.textTertiary, marginTop: 2 }}>⏸ {t('home.paused')}</Text> : null}
        </View>
        {!isTracking ? (
          <View style={{ marginBottom: Spacing.md }}>
            <Text style={[styles.inputLabel, { textAlign: 'center' }]}>{t('home.intensity')}:</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: Spacing.sm, marginTop: Spacing.xs }}>
              {([1,2,3,4,5] as const).map(lvl => (
                <TouchableOpacity key={lvl}
                  style={{ width: 36, height: 36, borderRadius: 18,
                    backgroundColor: contractionIntensity === lvl ? INTEN_COLORS[lvl] : Colors.backgroundSoft,
                    alignItems: 'center', justifyContent: 'center',
                    borderWidth: 1.5, borderColor: contractionIntensity === lvl ? INTEN_COLORS[lvl] : Colors.border }}
                  onPress={() => setContractionIntensity(lvl)}>
                  <Text style={{ fontSize: 13, fontFamily: 'Geist-SemiBold', color: contractionIntensity === lvl ? Colors.white : Colors.textSecondary }}>{lvl}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : null}
        {!isTracking ? (
          <TouchableOpacity style={[styles.saveBtn, { backgroundColor: Colors.error }]}
            onPress={() => startTimer({ type: 'contraction', label: t('home.contraction_label'), startTime: Date.now() })}>
            <Text style={styles.saveBtnText}>{t('home.start_contraction')}</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
            <TouchableOpacity style={[styles.saveBtn, { flex: 1, backgroundColor: paused ? Colors.pregnancy.primary : Colors.warning }]}
              onPress={paused ? () => resumeTimer(timer!.id) : () => pauseTimer(timer!.id)}>
              <Text style={styles.saveBtnText}>{paused ? t('home.resume') : t('home.pause')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.saveBtn, { flex: 1, backgroundColor: Colors.error }]} onPress={stopAndSaveContraction}>
              <Text style={styles.saveBtnText}>{t('home.stop_and_save')}</Text>
            </TouchableOpacity>
          </View>
        )}
        {contractions.length > 0 ? (
          <View style={{ marginTop: Spacing.lg, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border }}>
            <Text style={{ fontSize: 13, fontFamily: 'Geist-SemiBold', color: Colors.textSecondary, marginBottom: Spacing.sm }}>{t('home.recent_contractions')}</Text>
            {contractions.slice(0, 3).map((c, i) => (
              <View key={c.id || i} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.xs }}>
                <Text style={{ fontSize: 13, fontFamily: 'Geist', color: Colors.textPrimary }}>{formatDateShort(c.startTime)}</Text>
                <Text style={{ fontSize: 13, fontFamily: 'Geist-SemiBold', color: Colors.textPrimary }}>{c.duration ? formatContDuration(c.duration) : '—'} • {t('home.intensity_abbr')} {c.intensity}</Text>
              </View>
            ))}
          </View>
        ) : null}
        <TouchableOpacity style={{ marginTop: Spacing.md, alignSelf: 'center' }} onPress={() => router.push('/modules/pregnancy/contractions' as any)}>
          <Text style={{ fontSize: 12, color: Colors.pregnancy.primary, fontFamily: 'Geist-SemiBold' }}>{t('home.open_full_history')}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('home.fetal_movements_today')}</Text>
        <View style={{ alignItems: 'center', marginVertical: Spacing.sm }}>
          <Text style={{ fontSize: 52, fontFamily: 'Geist-Bold', color: Colors.pregnancy.primary }}>{todayMovementsCount}</Text>
          <Text style={{ fontSize: 13, color: Colors.textSecondary, fontFamily: 'Geist' }}>{t('home.kicks_today')}</Text>
          {todayMovementsCount >= 10 ? <Text style={{ fontSize: 12, color: Colors.success, fontFamily: 'Geist-SemiBold', marginTop: 4 }}>✅ {t('home.baby_active')}</Text> : null}
          {todayMovementsCount > 0 && todayMovementsCount < 10 ? <Text style={{ fontSize: 12, color: Colors.warning, fontFamily: 'Geist', marginTop: 4 }}>{t('home.movements_target')}</Text> : null}
        </View>
        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: savingMovement ? Colors.textTertiary : Colors.pregnancy.primary }]}
          onPress={addMovement} disabled={savingMovement}>
          {savingMovement ? <ActivityIndicator color={Colors.white} size="small" /> : <Text style={styles.saveBtnText}>+ {t('home.add_movement')}</Text>}
        </TouchableOpacity>
        {movements.length > 0 ? (
          <TouchableOpacity style={styles.historyLinkBtn} onPress={() => router.push('/modules/pregnancy/fetal-movements' as any)}>
            <Text style={styles.historyLinkText}>{t('home.open_full_history')}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </ScrollView>
  );
}


// ─── Active Timer Banner ──────────────────────────────────────────────────────

function ActiveTimerBanner() {
  const { timers, pauseTimer, resumeTimer, resetTimer, getElapsed } = useQuickTimerStore();
  const { user } = useAuthStore();
  const { activeChild } = useChild();
  const { t } = useTranslation();
  const childStore = useChildStore();
  const router = useRouter();
  const [saving, setSaving] = useState<TimerKey | null>(null);
  const [, forceRender] = useState(0);

  useEffect(() => {
    const anyRunning = Object.values(timers).some((t) => t?.running);
    if (!anyRunning) return;
    const id = setInterval(() => forceRender((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [timers]);

  const activeTimers = (Object.entries(timers) as [TimerKey, NonNullable<typeof timers[TimerKey]>][])
    .filter(([, t]) => t !== undefined);

  if (activeTimers.length === 0) return null;

  const META: Record<TimerKey, { emoji: string; label: string; color: string }> = {
    breastfeeding: { emoji: '🤱', label: t('modules.breastfeeding'), color: Colors.feeding },
    sleep:         { emoji: '😴', label: t('modules.sleep'),         color: Colors.sleep },
  };

  const formatSec = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return h > 0 ? `${h}:${m}:${sec}` : `${m}:${sec}`;
  };

  const stopAndSave = async (key: TimerKey) => {
    if (!user || !activeChild) { Alert.alert(t('common.error'), t('home.save_error_no_profile')); return; }
    const elapsed = getElapsed(key);
    if (elapsed === 0) { resetTimer(key); return; }
    setSaving(key);
    try {
      const timer = timers[key]!;
      if (key === 'breastfeeding') {
        const feed = { timestamp: Timestamp.now(), type: 'breastfeeding' as const, side: timer.side ?? 'left', duration: elapsed, createdBy: user.uid };
        const id = await feedingService.addFeed(user.uid, activeChild.id, feed);
        childStore.addFeed({ ...feed, id });
      }
      if (key === 'sleep') {
        const endTime = Timestamp.now();
        const startTime = Timestamp.fromDate(new Date(Date.now() - elapsed * 1000));
        const sleep = { startTime, endTime, duration: elapsed, quality: 'good' as const, type: timer.sleepType ?? 'nap', createdBy: user.uid };
        const id = await sleepService.addSleep(user.uid, activeChild.id, sleep);
        childStore.addSleep({ ...sleep, id });
      }
      resetTimer(key);
      Toast.show({ type: 'success', text1: `${META[key].label} ✅`, text2: formatSec(elapsed) });
    } catch (err: any) {
      Alert.alert(t('common.save_error'), err?.message || t('common.try_again'));
    } finally {
      setSaving(null);
    }
  };

  return (
    <>
      {activeTimers.map(([key, timer]) => {
        const meta = META[key];
        const elapsed = getElapsed(key);
        const running = timer.running;
        const isSaving = saving === key;
        return (
          <TouchableOpacity key={key} activeOpacity={0.92} onPress={() => router.push('/(tabs)/add' as any)}>
            <LinearGradient colors={[meta.color, meta.color + 'CC']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={bannerStyles.banner}>
              <View style={bannerStyles.left}>
                <Text style={bannerStyles.emoji}>{meta.emoji}</Text>
                <View>
                  <Text style={bannerStyles.label}>{meta.label}</Text>
                  <Text style={bannerStyles.elapsed}>{formatSec(elapsed)}</Text>
                </View>
                {running ? <View style={bannerStyles.liveDot} /> : null}
              </View>
              <View style={bannerStyles.right}>
                <TouchableOpacity style={bannerStyles.actionBtn} onPress={() => running ? pauseTimer(key) : resumeTimer(key)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <TimerIcon name={running ? 'pause' : 'play'} />
                </TouchableOpacity>
                <TouchableOpacity style={[bannerStyles.actionBtn, bannerStyles.stopBtn]} onPress={() => stopAndSave(key)} disabled={isSaving} hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}>
                  {isSaving ? <ActivityIndicator color={Colors.white} size="small" /> : <TimerIcon name="save" />}
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        );
      })}
    </>
  );
}

// ─── heroS — Hero Card Premium StyleSheet ─────────────────────────────────────
const heroS = StyleSheet.create({
  cardShadow:     { marginHorizontal: 16, marginBottom: 0, borderRadius: 28,
                    backgroundColor: '#EAB090',
                    shadowColor: '#BA7050', shadowOpacity: 0.20, shadowOffset: { width: 0, height: 6 }, shadowRadius: 16, elevation: 7 },
  cardGradient:   { borderRadius: 28, overflow: 'hidden', padding: 20 },

  // Orbs
  orbTopRight:    { position: 'absolute', width: 200, height: 200, borderRadius: 100,
                    backgroundColor: 'rgba(255,255,255,0.08)', top: -80, right: -60 },
  orbBottomLeft:  { position: 'absolute', width: 120, height: 120, borderRadius: 60,
                    backgroundColor: 'rgba(255,255,255,0.05)', bottom: -40, left: -20 },
  orbMid:         { position: 'absolute', width: 70, height: 70, borderRadius: 35,
                    backgroundColor: 'rgba(255,255,255,0.06)', top: 30, left: '48%' },

  // Top row
  topRow:         { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 18 },
  avatarRing:     { width: 64, height: 64, borderRadius: 32,
                    borderWidth: 2, borderColor: 'rgba(255,255,255,0.35)',
                    padding: 3, flexShrink: 0 },
  avatarInner:    { flex: 1, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  avatarEmoji:    { fontSize: 28 },
  nameBlock:      { flex: 1 },
  nameSup:        { fontFamily: 'Geist', fontSize: 10, color: 'rgba(255,255,255,0.65)',
                    textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 2 },
  nameMain:       { fontFamily: 'Fraunces', fontSize: 22, color: '#FFFFFF', lineHeight: 26, marginBottom: 6 },
  agePill:        { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
                    backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 20,
                    paddingHorizontal: 10, paddingVertical: 4 },
  agePillDot:     { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.9)' },
  agePillText:    { fontFamily: 'Geist-SemiBold', fontSize: 12, color: '#FFFFFF' },

  // Action buttons column
  actionCol:      { gap: 8 },
  actionBtn:      { width: 36, height: 36, borderRadius: 12,
                    backgroundColor: 'rgba(255,255,255,0.18)',
                    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
                    alignItems: 'center', justifyContent: 'center' },
  actionBtnEmoji: { fontSize: 16 },

  // Growth stats inside card
  divider:        { height: 1, backgroundColor: 'rgba(255,255,255,0.18)', marginBottom: 16 },
  statsRow:       { flexDirection: 'row', alignItems: 'center' },
  statItem:       { flex: 1, alignItems: 'center', gap: 3 },
  statEmoji:      { fontSize: 16, marginBottom: 2 },
  statValue:      { fontFamily: 'Geist-Bold', fontSize: 15, color: '#FFFFFF' },
  statEmpty:      { fontFamily: 'Geist', fontSize: 10, color: 'rgba(255,255,255,0.6)' },
  statLabel:      { fontFamily: 'Geist', fontSize: 9, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 0.3 },
  statDivider:    { width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.18)', marginHorizontal: 4 },

  // Quick-activity pills row (below hero card)
  pillsRow:       { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginTop: 12, marginBottom: 14 },
  pill:           { flex: 1, borderRadius: 18, minWidth: 0,
                    shadowColor: '#000', shadowOpacity: 0.06, shadowOffset: { width: 0, height: 3 }, shadowRadius: 8, elevation: 3 },
  pillGrad:       { flexDirection: 'row', alignItems: 'center', gap: 8,
                    borderRadius: 18, paddingHorizontal: 10, paddingVertical: 12 },
  pillEmoji:      { fontSize: 20, flexShrink: 0 },
  pillValue:      { fontFamily: 'Geist-Bold', fontSize: 13, color: '#C4704A', lineHeight: 17 },
  pillLabel:      { fontFamily: 'Geist', fontSize: 10, color: '#C4704A', opacity: 0.8, marginTop: 1 },

  // No-sleep warning card
  noSleepWarning: { marginHorizontal: 16, marginBottom: 14, borderRadius: 18,
                    backgroundColor: '#FFF8F0', borderWidth: 1.5, borderColor: '#FFB74D',
                    flexDirection: 'row', alignItems: 'center', gap: 10,
                    paddingHorizontal: 14, paddingVertical: 12 },
  noSleepTitle:   { fontFamily: 'Geist-SemiBold', fontSize: 13, color: '#E65100', marginBottom: 2 },
  noSleepDesc:    { fontFamily: 'Geist', fontSize: 11, color: '#9E6630' },
  noSleepBtn:     { backgroundColor: '#FF9800', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, flexShrink: 0 },
  noSleepBtnText: { fontFamily: 'Geist-SemiBold', fontSize: 11, color: '#FFFFFF' },
});

const bannerStyles = StyleSheet.create({
  banner: { marginHorizontal: Spacing.xl, marginBottom: Spacing.sm, borderRadius: BorderRadius.xl, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', ...Shadow.md },
  left: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  emoji: { fontSize: 28 },
  label: { fontFamily: 'Geist-SemiBold', fontSize: 14, color: Colors.white },
  elapsed: { fontFamily: 'Fraunces', fontSize: 20, color: Colors.white, marginTop: 1 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.white, opacity: 0.85, marginLeft: Spacing.xs, alignSelf: 'flex-start', marginTop: 4 },
  right: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  actionBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  stopBtn: { backgroundColor: 'rgba(0,0,0,0.18)' },
  actionBtnText: { fontSize: 18, color: Colors.white },
});

// ─── Child Switcher ───────────────────────────────────────────────────────────

function ChildSwitcher() {
  const { user } = useAuthStore();
  const { activeChild, setActiveChild } = useChildStore();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);

  const handleOpen = async () => {
    setOpen(true);
    if (!user || children.length > 0) return;
    setLoading(true);
    try { const all = await childService.getAllChildren(user.uid); setChildren(all); }
    finally { setLoading(false); }
  };

  const handleSwitch = async (child: Child) => {
    if (!user || child.id === activeChild?.id) { setOpen(false); return; }
    setSwitching(child.id);
    try {
      if (!child.isShared) await childService.setActiveChild(user.uid, child.id);
      setActiveChild(child);
      setChildren(prev => prev.map(c => ({ ...c, isActive: c.id === child.id })));
    } finally { setSwitching(null); setOpen(false); }
  };

  if (!activeChild) return null;
  const emoji = activeChild.gender === 'female' ? '👧' : activeChild.gender === 'male' ? '👦' : '👶';

  return (
    <>
      <TouchableOpacity style={styles.childPill} onPress={handleOpen} activeOpacity={0.7}>
        <Text style={styles.childPillEmoji}>{emoji}</Text>
        <Text style={styles.childPillName} numberOfLines={1}>{activeChild.name}</Text>
        <Text style={styles.childPillChevron}>▾</Text>
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.switcherOverlay} onPress={() => setOpen(false)}>
          <View style={styles.switcherSheet}>
            <Text style={styles.switcherTitle}>{t('home.switch_baby')}</Text>
            {loading ? (
              <ActivityIndicator color={Colors.child.primary} style={{ marginVertical: Spacing.lg }} />
            ) : (
              children.map(child => {
                const isActive = child.id === activeChild?.id;
                const childEmoji = child.gender === 'female' ? '👧' : child.gender === 'male' ? '👦' : '👶';
                const days = child.birthDate ? Math.floor((Date.now() - child.birthDate.toDate().getTime()) / 86400000) : 0;
                const age = days < 30
                  ? t('home.age_days', { count: days })
                  : days < 365
                  ? t('home.age_months', { count: Math.floor(days / 30) })
                  : `${Math.floor(days / 365)} ${t('home.years')} ${Math.floor((days % 365) / 30)} ${t('home.months')}`;
                return (
                  <TouchableOpacity key={child.id} style={[styles.switcherRow, isActive && styles.switcherRowActive]} onPress={() => handleSwitch(child)} disabled={switching === child.id}>
                    <View style={[styles.switcherAvatar, isActive && { backgroundColor: Colors.child.primary + '25' }]}>
                      <Text style={styles.switcherAvatarEmoji}>{childEmoji}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.switcherName, isActive && { color: Colors.child.primaryDark }]}>{child.name}</Text>
                      <Text style={styles.switcherAge}>{age}</Text>
                    </View>
                    {switching === child.id ? <ActivityIndicator size="small" color={Colors.child.primary} /> : isActive ? <Text style={styles.switcherCheck}>✓</Text> : null}
                  </TouchableOpacity>
                );
              })
            )}
            <TouchableOpacity style={styles.switcherAddBtn} onPress={() => setOpen(false)}>
              <Text style={styles.switcherAddText}>+ {t('home.add_baby_family')}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

// ─── Home Screen ──────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { profileMode, profile } = useAuthStore();
  const greeting = useGreeting();
  const { t } = useTranslation();
  const router = useRouter();
  const appearance = useAppearance();
  const isPregnancy = profileMode === 'pregnancy';
  const accentColor = appearance.accentColor || (isPregnancy ? Colors.pregnancy.primary : Colors.child.primary);
  const accentLight = appearance.accentLight || (isPregnancy ? Colors.pregnancy.primaryLight : Colors.child.primaryLight);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: appearance.colors.background }]} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.topBarLeft} onPress={() => router.push('/(tabs)/profile' as any)} activeOpacity={0.8}>
          <LinearGradient
            colors={[accentColor, appearance.accentDark]}
            style={styles.avatarCircle}
          >
            <Text style={styles.avatarEmoji}>{isPregnancy ? '🌸' : '👶'}</Text>
          </LinearGradient>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.greeting} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{greeting}, {profile?.displayName?.split(' ')[0] || t('home.mom_default')} 👋</Text>
          </View>
        </TouchableOpacity>
        <View style={styles.topBarRight}>
          {profileMode === 'child' ? <ChildSwitcher /> : null}
          <TouchableOpacity style={[styles.modePill, { backgroundColor: accentLight }]} onPress={() => router.push('/(tabs)/profile' as any)} activeOpacity={0.8}>
            <Text style={{ fontSize: 16 }}>{isPregnancy ? '🤰' : '👶'}</Text>
          </TouchableOpacity>
        </View>
      </View>
      <ActiveTimerBanner />
      {profileMode === 'pregnancy' ? <PregnancyHomeContent /> : <ChildHomeContent />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: Colors.background },
  topBar:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.xl, paddingTop: Spacing.sm, paddingBottom: Spacing.md },
  topBarLeft:       { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flex: 1 },
  topBarRight:      { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  avatarCircle:     { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', ...Shadow.sm },
  avatarEmoji:      { fontSize: 20 },
  greeting:         { fontSize: 12, fontFamily: 'Geist', color: Colors.textTertiary, letterSpacing: 0.2 },
  userName:         { fontSize: 17, fontFamily: 'Fraunces', color: Colors.textPrimary, marginTop: 1 },
  modePill:         { alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: BorderRadius.full },
  childPill:        { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.child.primaryLight, borderRadius: BorderRadius.full, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, gap: 4, maxWidth: 130 },
  childPillEmoji:   { fontSize: 15 },
  childPillName:    { fontSize: 13, fontFamily: 'Geist-SemiBold', color: Colors.child.primaryDark, flex: 1 },
  childPillChevron: { fontSize: 11, color: Colors.child.primaryDark },
  switcherOverlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-start', alignItems: 'flex-end', paddingTop: 80, paddingRight: Spacing.xl },
  switcherSheet:    { backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.lg, minWidth: 220, maxWidth: 280, ...Shadow.md },
  switcherTitle:    { fontSize: 13, fontFamily: 'Geist-SemiBold', color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.md },
  switcherRow:      { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, paddingHorizontal: Spacing.sm, borderRadius: BorderRadius.lg, gap: Spacing.sm, marginBottom: 2 },
  switcherRowActive:{ backgroundColor: Colors.child.primaryLight },
  switcherAvatar:   { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.backgroundSoft, alignItems: 'center', justifyContent: 'center' },
  switcherAvatarEmoji: { fontSize: 18 },
  switcherName:     { fontSize: 14, fontFamily: 'Geist-SemiBold', color: Colors.textPrimary },
  switcherAge:      { fontSize: 11, fontFamily: 'Geist', color: Colors.textTertiary },
  switcherCheck:    { fontSize: 16, color: Colors.child.primary, fontWeight: '700' },
  switcherAddBtn:   { marginTop: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border, alignItems: 'center' },
  switcherAddText:  { fontSize: 12, fontFamily: 'Geist', color: Colors.textTertiary },
  scroll:           { flex: 1 },
  scrollContent:    { paddingTop: Spacing.sm, paddingBottom: Spacing['3xl'] },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  timerGlyph: { fontSize: 16, lineHeight: 18, fontFamily: 'Geist-Bold', color: Colors.white },

  // Hero card
  heroCardWrap: { marginBottom: Spacing.md, overflow: 'hidden', ...Shadow.sm },
  heroCardGradient: { paddingHorizontal: Spacing.xl, paddingVertical: Spacing.lg, overflow: 'hidden' },
  heroOrb1: { position: 'absolute', width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.07)', top: -60, right: -40 },
  heroOrb2: { position: 'absolute', width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.05)', bottom: -30, left: 10 },
  heroOrb3: { position: 'absolute', width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.06)', top: 20, left: '45%' },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.md },
  heroAvatarRing: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.35)', alignItems: 'center', justifyContent: 'center' },
  heroAvatarInner: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  heroAvatarEmoji: { fontSize: 24 },
  heroActionBtns: { flexDirection: 'column', gap: 6 },
  heroActionBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  growthRow: { flexDirection: 'row', alignItems: 'center' },
  growthStat: { flex: 1, alignItems: 'center', gap: 1 },
  growthStatEmpty: { opacity: 0.65 },
  growthStatEmoji: { fontSize: 14, marginBottom: 1 },
  growthStatValueWhite: { fontSize: 14, fontFamily: 'Geist-Bold', color: Colors.white },
  growthStatLabelWhite: { fontSize: 9, fontFamily: 'Geist', color: 'rgba(255,255,255,0.72)' },
  // Pregnancy specifics
  pregnancyWeekTitle: { fontSize: 22, fontFamily: 'Fraunces', color: Colors.white, marginBottom: 2 },
  pregnancySizeText: { fontSize: 13, fontFamily: 'Geist', color: 'rgba(255,255,255,0.85)' },
  heroChevron: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  heroChevronText: { fontSize: 18, fontFamily: 'Geist-SemiBold', color: Colors.white, lineHeight: 20 },
  pregnancyProgressWrap: { marginBottom: Spacing.xs },
  pregnancyProgressTrack: { height: 5, backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: BorderRadius.full, overflow: 'hidden', marginBottom: 6 },
  pregnancyProgressFill: { height: '100%', backgroundColor: Colors.white, borderRadius: BorderRadius.full },
  pregnancyProgressLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  pregnancyProgressPct: { fontSize: 11, fontFamily: 'Geist-SemiBold', color: 'rgba(255,255,255,0.9)' },
  pregnancyProgressLeft: { fontSize: 11, fontFamily: 'Geist', color: 'rgba(255,255,255,0.7)' },

  // Stats row
  statsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.xl, paddingHorizontal: Spacing.xl },
  statCard: { flex: 1, backgroundColor: Colors.white, borderRadius: BorderRadius.lg, padding: Spacing.md, alignItems: 'center', ...Shadow.sm },
  statEmoji: { fontSize: 22, marginBottom: Spacing.xs },
  statValue: { fontSize: 13, fontFamily: 'Geist-SemiBold', color: Colors.textPrimary, textAlign: 'center' },
  statLabel: { fontSize: 11, fontFamily: 'Geist', color: Colors.textTertiary, marginTop: 2 },

  // Module grid
  moduleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.md, paddingHorizontal: Spacing.xl },
  moduleCard: { width: '22%', aspectRatio: 0.85, backgroundColor: Colors.white, borderRadius: BorderRadius.lg, alignItems: 'center', justifyContent: 'center', padding: Spacing.sm, borderWidth: 1, borderColor: '#EDE3D6', ...Shadow.sm },
  moduleCardLocked: { opacity: 0.62 },
  moduleCardHighlight: { backgroundColor: '#FBF0EB', borderColor: '#E8A882' },
  moduleCardUrgent: { backgroundColor: '#FDF0EE', borderColor: '#F0B0A8' },
  moduleLockBadge: { position: 'absolute', top: 4, right: 4, backgroundColor: Colors.amber, borderRadius: BorderRadius.full, paddingHorizontal: 5, paddingVertical: 2, zIndex: 1 },
  moduleLockText: { fontSize: 8, fontFamily: 'Geist-SemiBold', color: Colors.white },
  moduleNewBadge: { position: 'absolute', top: -4, right: -4, backgroundColor: '#C4704A', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2, zIndex: 2, borderWidth: 1.5, borderColor: Colors.background },
  moduleNewText: { fontSize: 7, fontFamily: 'Geist-SemiBold', color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: 0.3 },
  moduleIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.xs },
  moduleEmoji: { fontSize: 20 },
  moduleLabel: { fontSize: 10, fontFamily: 'Geist-SemiBold', color: Colors.textSecondary, textAlign: 'center', lineHeight: 13 },

  firstStepsCard: {
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: '#EDE3D6',
    ...Shadow.sm,
  },
  firstStepsHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  firstStepsTitle: {
    fontSize: 17,
    fontFamily: 'Fraunces',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  firstStepsSubtitle: {
    fontSize: 13,
    fontFamily: 'Geist',
    color: Colors.textSecondary,
    lineHeight: 19,
  },
  firstStepsClose: {
    fontSize: 18,
    fontFamily: 'Geist-SemiBold',
    color: Colors.textTertiary,
    paddingHorizontal: Spacing.xs,
  },
  firstStepsProgressTrack: {
    height: 6,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.backgroundSoft,
    overflow: 'hidden',
    marginBottom: Spacing.xs,
  },
  firstStepsProgressFill: {
    height: '100%',
    borderRadius: BorderRadius.full,
  },
  firstStepsProgressText: {
    fontSize: 12,
    fontFamily: 'Geist',
    color: Colors.textTertiary,
    marginBottom: Spacing.md,
  },
  firstStepsList: {
    gap: Spacing.sm,
  },
  firstStepRow: {
    minHeight: 46,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.background,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  firstStepRowDone: {
    backgroundColor: Colors.backgroundSoft,
  },
  firstStepCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
  },
  firstStepCheckText: {
    fontSize: 13,
    fontFamily: 'Geist-Bold',
    color: Colors.white,
  },
  firstStepCheckTextDone: {
    color: Colors.white,
  },
  firstStepTitle: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Geist-SemiBold',
    color: Colors.textPrimary,
  },
  firstStepTitleDone: {
    color: Colors.textSecondary,
    textDecorationLine: 'line-through',
  },
  firstStepArrow: {
    fontSize: 16,
    fontFamily: 'Geist-SemiBold',
    color: Colors.textTertiary,
  },

  // Empty states
  emptyStateContainer: { alignItems: 'center', paddingTop: Spacing['2xl'], paddingBottom: 48 },
  emptyIllustration: { width: 120, height: 120, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.xl, position: 'relative' },
  emptyIllustrationEmoji: { fontSize: 64, zIndex: 1 },
  emptyIllustrationRing: { position: 'absolute', width: 100, height: 100, borderRadius: 50, borderWidth: 2, borderColor: Colors.child.primaryLight, borderStyle: 'dashed' },
  emptyTitle: { fontFamily: 'Fraunces', fontSize: 26, color: Colors.textPrimary, textAlign: 'center', lineHeight: 34, marginBottom: Spacing.md, paddingHorizontal: Spacing.xl },
  emptySubtitle: { fontFamily: 'Geist', fontSize: 15, color: Colors.textSecondary, textAlign: 'center', lineHeight: 24, paddingHorizontal: Spacing['2xl'], marginBottom: Spacing['2xl'] },
  emptyPrimaryBtn: { backgroundColor: Colors.child.primary, paddingHorizontal: Spacing['2xl'], paddingVertical: Spacing.md + 2, borderRadius: BorderRadius.full, marginBottom: Spacing.md, ...Shadow.md },
  emptyPrimaryBtnText: { fontFamily: 'Geist-SemiBold', fontSize: 16, color: Colors.white },
  emptySecondaryBtn: { paddingHorizontal: Spacing['2xl'], paddingVertical: Spacing.sm, borderRadius: BorderRadius.full, borderWidth: 1.5, borderColor: Colors.pregnancy.primary, marginBottom: Spacing['2xl'] },
  emptySecondaryBtnText: { fontFamily: 'Geist-SemiBold', fontSize: 14, color: Colors.pregnancy.primary },
  emptyPreviewGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.xl, marginBottom: Spacing.md },
  emptyPreviewCard: { width: 80, height: 72, backgroundColor: Colors.white, borderRadius: BorderRadius.lg, alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, ...Shadow.sm, opacity: 0.5 },
  emptyPreviewEmoji: { fontSize: 22 },
  emptyPreviewLabel: { fontFamily: 'Geist', fontSize: 10, color: Colors.textSecondary },
  emptyPreviewHint: { fontFamily: 'Geist', fontSize: 12, color: Colors.textTertiary, fontStyle: 'italic' },

  // Pregnancy cards
  card: { backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.lg, marginBottom: Spacing.lg, marginHorizontal: Spacing.xl, ...Shadow.sm },
  cardTitle: { fontSize: 16, fontFamily: 'Geist-SemiBold', color: Colors.textPrimary, marginBottom: Spacing.sm },
  inputLabel: { fontSize: 13, fontFamily: 'Geist', color: Colors.textSecondary, marginBottom: 4 },
  saveBtn: { paddingVertical: 12, paddingHorizontal: Spacing.lg, borderRadius: BorderRadius.lg, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { fontSize: 14, fontFamily: 'Geist-SemiBold', color: Colors.white },
  historyLinkBtn: { marginTop: Spacing.md, alignSelf: 'center', paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md },
  historyLinkText: { fontSize: 12, color: Colors.pregnancy.primary, fontFamily: 'Geist-SemiBold' },
});