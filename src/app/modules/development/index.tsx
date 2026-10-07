import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Colors } from '../../../theme/colors';
import { Spacing, BorderRadius, Shadow } from '../../../theme/spacing';
import { useAuthStore } from '../../../stores/authStore';
import { useChild, useLoadChildData } from '../../../hooks/useChild';
import { developmentService, CDC_MILESTONES, detectInsights } from '../../../services/developmentService';
import type { DevelopmentInsight, CDCMilestone } from '../../../types/development';
import { Timestamp } from 'firebase/firestore';
import { translateHardcodedText } from '../../../i18n/runtimeText';

const TERRA = '#C4704A';
const CREAM = '#FBF5EE';
const SAGE  = '#6ECFB0';
const AMBER = '#D4A040';
const ALERT = '#E05040';

const INSIGHT_META: Record<string, { color: string; bg: string; icon: string }> = {
  possible_growth_spurt: { color: TERRA,  bg: '#FBF0EB', icon: '📈' },
  sleep_adjustment:      { color: '#5A88C0', bg: '#EBF2FA', icon: '🌙' },
  developmental_change:  { color: SAGE,   bg: '#EDFAF5', icon: '🌱' },
  new_milestone:         { color: AMBER,  bg: '#FBF5E8', icon: '⭐' },
  teething:              { color: '#9B7AA8', bg: '#F5EEFF', icon: '🦷' },
  feeding_change:        { color: TERRA,  bg: '#FBF0EB', icon: '🍼' },
  emotional_phase:       { color: '#D4786A', bg: '#FBF0EE', icon: '💛' },
};

const CONFIDENCE_LABEL: Record<string, string> = {
  low: 'Semnal slab', medium: 'Semnal moderat', high: 'Semnal puternic',
};
const CONFIDENCE_LABEL_EN: Record<string, string> = {
  low: 'Weak signal', medium: 'Moderate signal', high: 'Strong signal',
};
const CONFIDENCE_COLOR: Record<string, string> = {
  low: '#C8BAB0', medium: AMBER, high: TERRA,
};

const CATEGORY_ICONS: Record<string, string> = {
  social: '👥', language: '💬', cognitive: '🧠', motor: '🏃',
};
const CATEGORY_LABELS: Record<string, string> = {
  social: 'Social', language: 'Limbaj', cognitive: 'Cognitiv', motor: 'Motor',
};
const CATEGORY_LABELS_EN: Record<string, string> = {
  social: 'Social', language: 'Language', cognitive: 'Cognitive', motor: 'Motor',
};

const CDC_MILESTONE_TEXT_EN: Record<string, string> = {
  cdc_2_s1: 'Smile at people',
  cdc_2_s2: 'Calms down when held or spoken to',
  cdc_2_l1: 'Coos and makes sounds like "ooh" and "aah"',
  cdc_2_m1: 'Holds head up for a few seconds during tummy time',
  cdc_2_c1: 'Follows objects with their eyes',
  cdc_4_s1: 'Smiles spontaneously, especially at familiar people',
  cdc_4_s2: 'Enjoys playing with people',
  cdc_4_l1: 'Coos and babbles',
  cdc_4_l2: 'Imitates sounds they hear',
  cdc_4_m1: 'Holds head steady without support',
  cdc_4_m2: 'Pushes down on legs when held standing',
  cdc_4_c1: 'Responds to affection',
  cdc_6_s1: 'Recognizes familiar faces and may cry around strangers',
  cdc_6_l1: 'Responds to sounds by making sounds',
  cdc_6_l2: 'Babbles when alone or with others',
  cdc_6_m1: 'Rolls over in both directions',
  cdc_6_m2: 'Sits with support',
  cdc_6_m3: 'Supports weight on legs',
  cdc_6_c1: 'Brings objects to mouth',
  cdc_6_c2: 'Shows curiosity and tries to reach things',
  cdc_9_s1: 'May be shy or anxious around new people',
  cdc_9_s2: 'Has favorite toys',
  cdc_9_l1: 'Understands "no"',
  cdc_9_l2: 'Makes consonant sounds such as mama, baba, tata',
  cdc_9_m1: 'Sits without support',
  cdc_9_m2: 'Pulls to stand while holding on',
  cdc_9_c1: 'Looks for hidden objects',
  cdc_12_s1: 'May be shy or anxious around new people',
  cdc_12_l1: 'Says mama or dada with meaning',
  cdc_12_l2: 'Tries to imitate words',
  cdc_12_m1: 'Stands up alone',
  cdc_12_m2: 'Takes a few steps without support',
  cdc_12_c1: 'Explores objects in different ways',
  cdc_15_l1: 'Says a few words',
  cdc_15_m1: 'Walks independently',
  cdc_15_m2: 'Drinks from a cup with little help',
  cdc_15_c1: 'Points to things',
  cdc_18_l1: 'Says at least 10 words',
  cdc_18_l2: 'Says and points to show what they want',
  cdc_18_m1: 'Walks well',
  cdc_18_c1: 'Knows what common objects are used for',
  cdc_24_l1: 'Uses two-word phrases',
  cdc_24_l2: 'Follows simple two-step instructions',
  cdc_24_m1: 'Goes up and down stairs with support',
  cdc_24_c1: 'Sorts objects by color and shape',
  cdc_36_l1: 'Speaks in two- to three-word sentences',
  cdc_36_s1: 'Plays with other children',
  cdc_48_l1: 'Talks about daily activities',
  cdc_48_m1: 'Hops or stands on one foot',
  cdc_60_l1: 'Says name and address',
  cdc_60_m1: 'Jumps, rolls, and climbs',
};

function cdcText(milestone: Omit<CDCMilestone, 'achieved' | 'achievedDate'>, isEnglish: boolean): string {
  return isEnglish ? (CDC_MILESTONE_TEXT_EN[milestone.id] ?? translateHardcodedText(milestone.text)) : milestone.text;
}

function formatAgeRange(months: number, isEnglish: boolean): string {
  if (months < 12) return isEnglish ? `${months} months` : `${months} luni`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (rem === 0) {
    return isEnglish
      ? `${years} ${years === 1 ? 'year' : 'years'}`
      : `${years} ${years === 1 ? 'an' : 'ani'}`;
  }
  return isEnglish
    ? `${years} ${years === 1 ? 'year' : 'years'} and ${rem} ${rem === 1 ? 'month' : 'months'}`
    : `${years} ${years === 1 ? 'an' : 'ani'} și ${rem} luni`;
}

function shortAge(months: number, isEnglish: boolean): string {
  return months < 12 ? `${months}${isEnglish ? 'M' : 'L'}` : `${Math.floor(months / 12)}${isEnglish ? 'Y' : 'A'}`;
}

function formatChildAge(months: number, isEnglish: boolean): string {
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  const parts: string[] = [];
  if (years > 0) parts.push(`${years} ${isEnglish ? (years === 1 ? 'year' : 'years') : (years === 1 ? 'an' : 'ani')}`);
  if (remainingMonths > 0) {
    parts.push(`${remainingMonths} ${isEnglish ? (remainingMonths === 1 ? 'month' : 'months') : (remainingMonths === 1 ? 'lună' : 'luni')}`);
  }
  return parts.join(isEnglish ? ' and ' : ' și ') || (isEnglish ? '0 months' : '0 luni');
}

function InsightCard({ insight, onDismiss, isEnglish }: { insight: DevelopmentInsight; onDismiss: () => void; isEnglish: boolean }) {
  const meta = INSIGHT_META[insight.type] ?? INSIGHT_META.developmental_change;
  const [expanded, setExpanded] = useState(false);
  return (
    <View style={[s.insightCard, { borderLeftColor: meta.color, backgroundColor: meta.bg }]}>
      <TouchableOpacity onPress={() => setExpanded(e => !e)} activeOpacity={0.8}>
        <View style={s.insightHeader}>
          <View style={[s.insightIconBox, { backgroundColor: meta.color + '22' }]}>
            <Text style={{ fontSize: 20 }}>{meta.icon}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.insightTitle}>{isEnglish ? translateHardcodedText(insight.title) : insight.title}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
              <View style={[s.confDot, { backgroundColor: CONFIDENCE_COLOR[insight.confidence] }]} />
              <Text style={[s.confLabel, { color: CONFIDENCE_COLOR[insight.confidence] }]}>
                {isEnglish ? CONFIDENCE_LABEL_EN[insight.confidence] : CONFIDENCE_LABEL[insight.confidence]}
              </Text>
            </View>
          </View>
          <Text style={{ color: '#C8BAB0', fontSize: 18 }}>{expanded ? '▲' : '▽'}</Text>
        </View>
        <Text style={s.insightMessage}>{isEnglish ? translateHardcodedText(insight.message) : insight.message}</Text>
      </TouchableOpacity>
      {expanded && (
        <View style={s.insightExpanded}>
          <Text style={s.insightSectionLabel}>{isEnglish ? 'What you can do:' : 'Ce poți face:'}</Text>
          {insight.suggestions.map((sug, i) => (
            <View key={i} style={s.suggRow}>
              <Text style={[s.suggDot, { color: meta.color }]}>•</Text>
              <Text style={s.suggText}>{isEnglish ? translateHardcodedText(sug) : sug}</Text>
            </View>
          ))}
          {insight.safetyNote && (
            <View style={s.safetyBox}>
              <Text style={s.safetyText}>! {isEnglish ? translateHardcodedText(insight.safetyNote) : insight.safetyNote}</Text>
            </View>
          )}
          <TouchableOpacity style={s.dismissBtn} onPress={onDismiss}>
            <Text style={s.dismissText}>{isEnglish ? 'Archive' : 'Arhivează'}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function MilestoneSection({ ageMonths, milestones, achieved, onToggle, isEnglish }: {
  ageMonths: number;
  milestones: typeof CDC_MILESTONES;
  achieved: Set<string>;
  onToggle: (id: string, cur: boolean) => void;
  isEnglish: boolean;
}) {
  const [open, setOpen] = useState(false);
  const done = milestones.filter(m => achieved.has(m.id)).length;

  // Format: "0–2 luni", "1 an", "2 ani și 6 luni"
  function formatAgeRangeRo(months: number): string {
    if (months < 12) return `${months} luni`;
    const years = Math.floor(months / 12);
    const rem = months % 12;
    if (rem === 0) return `${years} ${years === 1 ? 'an' : 'ani'}`;
    return `${years} ${years === 1 ? 'an' : 'ani'} și ${rem} luni`;
  }

  return (
    <View style={s.msGroup}>
      <TouchableOpacity style={s.msGroupHeader} onPress={() => setOpen(o => !o)} activeOpacity={0.8}>
        <View style={s.msAgeBubble}>
          <Text style={s.msAgeText}>{shortAge(ageMonths, isEnglish)}</Text>
        </View>
        <Text style={s.msGroupTitle}>{formatAgeRange(ageMonths, isEnglish)}</Text>
        <View style={s.msProgress}>
          <Text style={s.msProgressText}>{done}/{milestones.length}</Text>
        </View>
        <Text style={{ color: '#C8BAB0' }}>{open ? '▲' : '▽'}</Text>
      </TouchableOpacity>
      {open && (
        <View style={s.msList}>
          {['social','language','cognitive','motor'].map(cat => {
            const items = milestones.filter(m => m.category === cat);
            if (!items.length) return null;
            return (
              <View key={cat}>
                <View style={s.msCatRow}>
                  <Text style={s.msCatIcon}>{CATEGORY_ICONS[cat]}</Text>
                  <Text style={s.msCatLabel}>{isEnglish ? CATEGORY_LABELS_EN[cat] : CATEGORY_LABELS[cat]}</Text>
                </View>
                {items.map(m => {
                  const isAchieved = achieved.has(m.id);
                  return (
                    <TouchableOpacity key={m.id} style={s.msItem} onPress={() => onToggle(m.id, isAchieved)} activeOpacity={0.8}>
                      <View style={[s.msCheckbox, isAchieved && { backgroundColor: SAGE, borderColor: SAGE }]}>
                        {isAchieved && <Text style={{ color: '#fff', fontSize: 12 }}>✓</Text>}
                      </View>
                      <Text style={[s.msItemText, isAchieved && s.msItemDone]}>{cdcText(m, isEnglish)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

export default function DevelopmentScreen() {
  const router = useRouter();
  const { i18n } = useTranslation();
  const isEnglish = i18n.language === 'en';
  const { user } = useAuthStore();
  const { activeChild, feeds, sleeps, diapers } = useChild();
  useLoadChildData();

  const [insights, setInsights] = useState<DevelopmentInsight[]>([]);
  const [achieved, setAchieved] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'milestones'>('overview');

  const load = useCallback(async () => {
    if (!user || !activeChild) return;
    try {
      const [storedInsights, storedMilestones] = await Promise.all([
        developmentService.getInsights(user.uid, activeChild.id),
        developmentService.getChildMilestones(user.uid, activeChild.id),
      ]);
      const validInsights = storedInsights.filter(i => new Date(i.expiresAt).getTime() > Date.now());
      setInsights(validInsights);
      setAchieved(new Set(storedMilestones.map(m => m.id)));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, activeChild]);

  useEffect(() => { load(); }, [load]);

  const generateInsights = useCallback(async () => {
    if (!user || !activeChild) return;
    const recentMilestones = CDC_MILESTONES
      .filter(m => achieved.has(m.id))
      .slice(0, 3)
      .map(m => cdcText(m, isEnglish));
    const newInsights = detectInsights({
      feeds, sleeps, diapers,
      recentMilestones,
      symptomsPresent: false,
      teethingSignal: false,
      fussinessLogged: false,
    });
    for (const ins of newInsights) {
      const full = { ...ins, childId: activeChild.id, userId: user.uid };
      const id = await developmentService.saveInsight(user.uid, activeChild.id, full);
      setInsights(prev => [{ ...full, id }, ...prev]);
    }
    if (newInsights.length === 0) {
      Alert.alert(
        isEnglish ? 'Everything looks ok' : 'Totul pare ok',
        isEnglish
          ? 'No significant changes were detected compared with the last few days.'
          : 'Nu am detectat schimbări semnificative față de ultimele zile.',
      );
    }
  }, [user, activeChild, feeds, sleeps, diapers, achieved, isEnglish]);

  const dismissInsight = async (insightId: string) => {
    if (!user || !activeChild) return;
    await developmentService.deleteInsight(user.uid, activeChild.id, insightId);
    setInsights(prev => prev.filter(i => i.id !== insightId));
  };

  const toggleMilestone = async (id: string, current: boolean) => {
    if (!user || !activeChild) return;
    await developmentService.markMilestone(user.uid, activeChild.id, id, !current);
    setAchieved(prev => {
      const next = new Set(prev);
      if (current) next.delete(id); else next.add(id);
      return next;
    });
  };

  const ageMonthsList = [...new Set(CDC_MILESTONES.map(m => m.ageMonths))].sort((a, b) => a - b);

  const childAgeMonths = activeChild?.birthDate
    ? Math.floor((Date.now() - activeChild.birthDate.toDate().getTime()) / (1000 * 60 * 60 * 24 * 30.4))
    : null;

  // Stats
  const totalMilestones = CDC_MILESTONES.length;
  const achievedCount = achieved.size;

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backText}>‹</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>{isEnglish ? 'Development' : 'Dezvoltare'}</Text>
          <Text style={s.headerSub}>{isEnglish ? "Your child's sensitive periods" : 'Perioadele sensibile ale copilului tău'}</Text>
        </View>
        <TouchableOpacity style={s.aiBtn} onPress={generateInsights}>
          <Text style={s.aiBtnText}>{isEnglish ? 'Analyze' : 'Analizează'}</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={s.tabs}>
        {(['overview', 'milestones'] as const).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[s.tab, activeTab === tab && s.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[s.tabText, activeTab === tab && s.tabTextActive]}>
              {tab === 'overview' ? (isEnglish ? 'Sensitive period' : 'Perioadă sensibilă') : (isEnglish ? 'CDC milestones' : 'Achiziții CDC')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={s.loadingWrap}>
          <ActivityIndicator color={TERRA} size="large" />
        </View>
      ) : (
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={TERRA} />}
        >
          {activeTab === 'overview' ? (
            <>
              {/* Age context */}
              {childAgeMonths !== null && (
                <View style={s.ageCard}>
                  <Text style={s.ageCardEmoji}>👶</Text>
                  <View style={{ flex: 1 }}>
                  <Text style={s.ageCardName}>{activeChild?.name}</Text>
                    <Text style={s.ageCardAge}>
                      {(() => {
                        if (childAgeMonths === null) return '';
                        const age = formatChildAge(childAgeMonths, isEnglish);
                        return `${age} - ${achievedCount}/${totalMilestones} ${isEnglish ? 'milestones' : 'achiziții'}`;
                      })()}
                    </Text>
                  </View>
                  <View style={s.ageProgress}>
                    <View style={[s.ageProgressFill, { height: `${Math.round(achievedCount / totalMilestones * 100)}%` as any }]} />
                  </View>
                </View>
              )}

              {/* Insights */}
              {insights.length === 0 ? (
                <View style={s.emptyInsights}>
                  <Text style={{ fontSize: 40, marginBottom: 12 }}>🌿</Text>
                  <Text style={s.emptyTitle}>{isEnglish ? 'Everything looks okay' : 'Totul pare în ordine'}</Text>
                  <Text style={s.emptyText}>{isEnglish ? 'Tap Analyze to detect changes compared with the last few days.' : 'Apasă Analizează pentru a detecta schimbări față de ultimele zile.'}</Text>
                  <TouchableOpacity style={s.analyzeBtn} onPress={generateInsights}>
                    <Text style={s.analyzeBtnText}>{isEnglish ? 'Analyze now' : 'Analizează acum'}</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={{ gap: 12 }}>
                  {insights.map(ins => (
                    <InsightCard key={ins.id} insight={ins} isEnglish={isEnglish} onDismiss={() => dismissInsight(ins.id)} />
                  ))}
                </View>
              )}

              {/* Info block */}
              <View style={s.infoCard}>
                <Text style={s.infoTitle}>{isEnglish ? 'How it works' : 'Cum funcționează'}</Text>
                <Text style={s.infoText}>{isEnglish ? "The app compares your child's sleep, feeds, and diapers with the last 7 days and detects possible changes.\n\nThe cards above are observations, not diagnoses.\nEvery child has their own rhythm." : 'Aplicația analizează somnul, mesele și scutecele copilului față de media ultimelor 7 zile și detectează schimbări posibile.\n\nCardurile de mai sus sunt observații, nu diagnostice.\nFiecare copil are ritmul lui.'}</Text>
              </View>

              <View style={s.redFlagCard}>
                <Text style={s.redFlagTitle}>{isEnglish ? 'When to call the doctor' : 'Când mergi la medic'}</Text>
                {(isEnglish ? [
                  'Fever over 38?C in a baby under 3 months',
                  'Complete refusal to feed or dehydration',
                  'Excessive lethargy or hard to wake',
                  'Inconsolable crying for more than 3 hours',
                  'Any sign that gives you a strong feeling of concern',
                ] : [
                  'Febră peste 38?C la sugar sub 3 luni',
                  'Refuz alimentar total sau deshidratare',
                'Letargie excesivă sau greu de trezit',
                'Plâns inconsolabil peste 3 ore',
                'Orice semn care îți dă un sentiment de alertă',
                ]).map((flag, i) => (
                  <View key={i} style={s.flagRow}>
                    <Text style={s.flagDot}>•</Text>
                    <Text style={s.flagText}>{flag}</Text>
                  </View>
                ))}
              </View>
            </>
          ) : (
            <>
              <Text style={s.msIntro}>{isEnglish ? 'Based on official CDC/AAP milestones. Tick each milestone as you observe it.' : 'Bazate pe milestone-urile oficiale CDC/AAP. Bifează fiecare achiziție pe măsură ce o observi.'}</Text>
              {ageMonthsList.map(age => {
                const items = CDC_MILESTONES.filter(m => m.ageMonths === age);
                const isPast = childAgeMonths !== null && age <= childAgeMonths;
                const isCurrent = childAgeMonths !== null && Math.abs(age - childAgeMonths) <= 2;
                return (
                  <View key={age} style={[s.msGroupWrap, isCurrent && s.msGroupCurrent]}>
                    {isCurrent && (
                      <View style={s.currentBadge}>
                        <Text style={s.currentBadgeText}>{isEnglish ? "Your child's age" : 'Vârsta copilului tău'}</Text>
                      </View>
                    )}
                    <MilestoneSection
                      ageMonths={age}
                      milestones={items}
                      achieved={achieved}
                      onToggle={toggleMilestone}
                      isEnglish={isEnglish}
                    />
                  </View>
                );
              })}
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: CREAM },
  header:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: CREAM },
  backBtn:        { marginRight: 12, width: 36, height: 36, borderRadius: 18, backgroundColor: '#F0E8E0', alignItems: 'center', justifyContent: 'center' },
  backText:       { fontSize: 22, color: TERRA, lineHeight: 28 },
  headerTitle:    { fontSize: 18, fontFamily: 'Fraunces', color: '#1C130D' },
  headerSub:      { fontSize: 11, fontFamily: 'Geist', color: '#9A8070', marginTop: 1 },
  aiBtn:          { backgroundColor: TERRA, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  aiBtnText:      { fontFamily: 'Geist-SemiBold', fontSize: 12, color: '#FFFFFF' },
  tabs:           { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 4 },
  tab:            { flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: '#F0E8E0', alignItems: 'center' },
  tabActive:      { backgroundColor: TERRA },
  tabText:        { fontFamily: 'Geist-SemiBold', fontSize: 12, color: '#9A8070' },
  tabTextActive:  { color: '#FFFFFF' },
  scroll:         { flex: 1 },
  scrollContent:  { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 48, gap: 12 },
  loadingWrap:    { flex: 1, alignItems: 'center', justifyContent: 'center' },

  ageCard:        { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16, gap: 12, borderWidth: 1, borderColor: '#EDE3D6', ...Shadow.sm },
  ageCardEmoji:   { fontSize: 36 },
  ageCardName:    { fontFamily: 'Fraunces', fontSize: 16, color: '#1C130D' },
  ageCardAge:     { fontFamily: 'Geist', fontSize: 12, color: '#9A8070', marginTop: 2 },
  ageProgress:    { width: 8, height: 48, backgroundColor: '#EDE3D6', borderRadius: 4, overflow: 'hidden', justifyContent: 'flex-end' },
  ageProgressFill:{ width: '100%', backgroundColor: SAGE, borderRadius: 4 },

  insightCard:    { borderRadius: 18, padding: 16, borderLeftWidth: 4, gap: 8 },
  insightHeader:  { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  insightIconBox: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  insightTitle:   { fontFamily: 'Fraunces', fontSize: 15, color: '#1C130D' },
  confDot:        { width: 6, height: 6, borderRadius: 3 },
  confLabel:      { fontFamily: 'Geist-SemiBold', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  insightMessage: { fontFamily: 'Geist', fontSize: 13, color: '#5A4030', lineHeight: 20 },
  insightExpanded:{ marginTop: 8, gap: 8 },
  insightSectionLabel: { fontFamily: 'Geist-SemiBold', fontSize: 11, color: '#9A8070', textTransform: 'uppercase', letterSpacing: 0.5 },
  suggRow:        { flexDirection: 'row', gap: 8 },
  suggDot:        { fontSize: 16, lineHeight: 20 },
  suggText:       { fontFamily: 'Geist', fontSize: 13, color: '#5A4030', flex: 1, lineHeight: 20 },
  safetyBox:      { backgroundColor: '#FDF0EE', borderRadius: 12, padding: 12, borderLeftWidth: 3, borderLeftColor: ALERT },
  safetyText:     { fontFamily: 'Geist', fontSize: 12, color: '#5A4030', lineHeight: 18 },
  dismissBtn:     { alignSelf: 'flex-end', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.06)' },
  dismissText:    { fontFamily: 'Geist-SemiBold', fontSize: 11, color: '#9A8070' },

  emptyInsights:  { alignItems: 'center', paddingVertical: 32 },
  emptyTitle:     { fontFamily: 'Fraunces', fontSize: 18, color: '#1C130D', marginBottom: 8 },
  emptyText:      { fontFamily: 'Geist', fontSize: 13, color: '#9A8070', textAlign: 'center', lineHeight: 20, paddingHorizontal: 24 },
  analyzeBtn:     { marginTop: 20, backgroundColor: TERRA, borderRadius: 20, paddingHorizontal: 24, paddingVertical: 12 },
  analyzeBtnText: { fontFamily: 'Geist-SemiBold', fontSize: 14, color: '#FFFFFF' },

  infoCard:       { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#EDE3D6' },
  infoTitle:      { fontFamily: 'Fraunces', fontSize: 14, color: '#1C130D', marginBottom: 8 },
  infoText:       { fontFamily: 'Geist', fontSize: 12, color: '#9A8070', lineHeight: 20 },

  redFlagCard:    { backgroundColor: '#FDF0EE', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#F0B0A8' },
  redFlagTitle:   { fontFamily: 'Fraunces', fontSize: 14, color: ALERT, marginBottom: 10 },
  flagRow:        { flexDirection: 'row', gap: 8, marginBottom: 6 },
  flagDot:        { color: ALERT, fontSize: 16, lineHeight: 20 },
  flagText:       { fontFamily: 'Geist', fontSize: 12, color: '#5A4030', flex: 1, lineHeight: 20 },

  msIntro:        { fontFamily: 'Geist', fontSize: 12, color: '#9A8070', lineHeight: 20, marginBottom: 4 },
  msGroupWrap:    { borderRadius: 18, overflow: 'hidden' },
  msGroupCurrent: { borderWidth: 2, borderColor: TERRA },
  currentBadge:   { backgroundColor: TERRA, paddingHorizontal: 14, paddingVertical: 5 },
  currentBadgeText: { fontFamily: 'Geist-SemiBold', fontSize: 11, color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: 0.4 },
  msGroup:        { backgroundColor: '#FFFFFF', borderRadius: 16 },
  msGroupHeader:  { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  msAgeBubble:    { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FBF0EB', alignItems: 'center', justifyContent: 'center' },
  msAgeText:      { fontFamily: 'Geist-Bold', fontSize: 12, color: TERRA },
  msGroupTitle:   { fontFamily: 'Fraunces', fontSize: 14, color: '#1C130D', flex: 1 },
  msProgress:     { backgroundColor: '#F0E8E0', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  msProgressText: { fontFamily: 'Geist-SemiBold', fontSize: 11, color: '#9A8070' },
  msList:         { paddingHorizontal: 14, paddingBottom: 14, gap: 4 },
  msCatRow:       { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, marginBottom: 4 },
  msCatIcon:      { fontSize: 14 },
  msCatLabel:     { fontFamily: 'Geist-SemiBold', fontSize: 11, color: '#9A8070', textTransform: 'uppercase', letterSpacing: 0.4 },
  msItem:         { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 6 },
  msCheckbox:     { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#D9CCBC', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 },
  msItemText:     { fontFamily: 'Geist', fontSize: 13, color: '#5A4030', flex: 1, lineHeight: 20 },
  msItemDone:     { textDecorationLine: 'line-through', color: '#9A8070' },
});
