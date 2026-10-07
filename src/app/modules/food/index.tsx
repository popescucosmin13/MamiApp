import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useChild, useLoadChildData } from '../../../hooks/useChild';
import { useFood, useLoadFoodData } from '../../../hooks/useFood';
import { Colors } from '../../../theme/colors';
import { Spacing, BorderRadius, Shadow } from '../../../theme/spacing';
import { FOODS_MASTER, getFoodEmoji } from '../../../types/food';

export default function DiversificationDashboard() {
  const { t, i18n } = useTranslation();
  const isEnglish = i18n.language === 'en';
  const router = useRouter();
  const { activeChild, isLoading: isChildLoading } = useChild();
  useLoadChildData();
  
  // Încarcă datele de pe Firebase pentru copilul curent
  useLoadFoodData();
  const { profile, introducedFoods, meals, isLoading } = useFood();

  const hasChildAge = Boolean(activeChild?.birthDate);
  const ageInDays = activeChild?.birthDate
    ? Math.floor((Date.now() - activeChild.birthDate.toDate().getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  const ageMonths = Math.floor(ageInDays / 30);
  const childName = activeChild?.name || t('food_dashboard.baby_fallback');

  // Calculează date reale
  const allergensIntroduced = introducedFoods.filter(f => f.isAllergen).length;
  const totalAllergens = FOODS_MASTER.filter(f => f.allergyRisk === 'high').length;
  
  const todayStr = new Date().toISOString().split('T')[0]; // simple YYYY-MM-DD
  const mealsToday = meals.filter(m => {
    const d = m.date as any;
    const dateStr = d?.toDate ? d.toDate().toISOString().split('T')[0] : (typeof d === 'string' ? d.split('T')[0] : '');
    return dateStr === todayStr;
  });

  const trackedFoods = introducedFoods.filter(f => f.testDay !== 'completed');
  const activeTrackedFood = trackedFoods.length > 0 ? trackedFoods[0] : null;

  const getEmojiForFood = (name: string) => {
    const found = FOODS_MASTER.find((food) => food.name_ro.toLowerCase() === name.toLowerCase());
    return found ? getFoodEmoji(found) : getFoodEmoji(name);
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <Text style={styles.backArrow}>←</Text>
      </TouchableOpacity>
      <View style={styles.headerTitles}>
        <Text style={styles.headerTitle}>{t('food_dashboard.title')}</Text>
        <Text style={styles.headerSubtitle}>
          {hasChildAge
            ? t('food_dashboard.child_age', { name: childName, months: ageMonths })
            : t('food_dashboard.child_loading', { defaultValue: isEnglish ? 'Loading child profile...' : 'Se încarcă profilul copilului...' })}
        </Text>
      </View>
      <View style={{ width: 40 }} />
    </View>
  );

  const renderStartScreen = () => (
    <View style={styles.startContainer}>
      <Text style={styles.startEmoji}>🥣</Text>
      <Text style={styles.startTitle}>{t('food_dashboard.start_title')}</Text>
      <Text style={styles.startText}>
        {t('food_dashboard.start_text')}
      </Text>
      <TouchableOpacity 
        style={styles.startBtn}
        onPress={() => router.push('/modules/food/start')}
      >
        <Text style={styles.startBtnText}>{t('food_dashboard.start_profile')}</Text>
      </TouchableOpacity>
      <View style={styles.safetyAlert}>
        <Text style={styles.safetyAlertText}>
          {t('food_dashboard.pediatrician_note')}
        </Text>
      </View>
    </View>
  );

  const renderTrackedFood = () => {
    if (!activeTrackedFood) return null;
    
    return (
      <View style={styles.trackedCard}>
        <View style={styles.trackedHeader}>
          <View style={styles.trackedIconWrap}>
            <Text style={styles.trackedEmoji}>{getEmojiForFood(activeTrackedFood.name)}</Text>
          </View>
          <View style={styles.trackedInfo}>
            <Text style={styles.trackedLabel}>{t('food_dashboard.tracked_now')}</Text>
            <Text style={styles.trackedName}>{activeTrackedFood.name}</Text>
          </View>
          <View style={styles.trackedDayBadge}>
            <Text style={styles.trackedDayText}>{t('food_dashboard.test_day', { day: activeTrackedFood.testDay })}</Text>
          </View>
        </View>
        <View style={styles.trackedFooter}>
          <Text style={styles.trackedStatus}>
            {t('food_dashboard.status_prefix')} {activeTrackedFood.reactionStatus === 'none' ? t('food_dashboard.no_reactions') : t('food_dashboard.reaction_noted')}
          </Text>
          <TouchableOpacity style={styles.trackedBtn} onPress={() => router.push(`/modules/food/food/${activeTrackedFood.id}`)}>
            <Text style={styles.trackedBtnText}>{t('food_dashboard.view_details')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderStats = () => (
    <View style={styles.statsRow}>
      <TouchableOpacity style={styles.statCard} onPress={() => router.push('/modules/food/foods')}>
        <Text style={styles.statValue}>{introducedFoods.length}</Text>
        <Text style={styles.statLabel}>{t('food_dashboard.foods')}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.statCard} onPress={() => router.push('/modules/food/allergens')}>
        <Text style={styles.statValue}>{allergensIntroduced}/{totalAllergens}</Text>
        <Text style={styles.statLabel}>{t('food_dashboard.allergens')}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.statCard} onPress={() => router.push('/modules/food/meals')}>
        <Text style={styles.statValue}>{mealsToday.length}</Text>
        <Text style={styles.statLabel}>{t('food_dashboard.meals_today')}</Text>
      </TouchableOpacity>
    </View>
  );

  const renderQuickActions = () => (
    <View style={styles.actionsGrid}>
      <TouchableOpacity style={styles.actionBtn} activeOpacity={0.8} onPress={() => router.push('/modules/food/add-meal')}>
        <View style={[styles.actionIconWrap, { backgroundColor: Colors.feeding + '15' }]}>
          <Text style={styles.actionIcon}>🍽️</Text>
        </View>
        <Text style={styles.actionText}>{t('food_dashboard.add_meal')}</Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.actionBtn} activeOpacity={0.8} onPress={() => router.push('/modules/food/add-food')}>
        <View style={[styles.actionIconWrap, { backgroundColor: Colors.success + '15' }]}>
          <Text style={styles.actionIcon}>🥑</Text>
        </View>
        <Text style={styles.actionText}>{t('food_dashboard.new_food')}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.actionBtn} activeOpacity={0.8} onPress={() => router.push('/modules/food/log-reaction')}>
        <View style={[styles.actionIconWrap, { backgroundColor: Colors.error + '15' }]}>
          <Text style={styles.actionIcon}>🚨</Text>
        </View>
        <Text style={styles.actionText}>{t('food_dashboard.reaction')}</Text>
      </TouchableOpacity>
    </View>
  );

  const renderTodayPlan = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{t('food_dashboard.today_plan')}</Text>
        <TouchableOpacity onPress={() => router.push('/modules/food/meals')}>
          <Text style={styles.sectionLink}>{t('food_dashboard.all_meals')}</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.planCard}>
        {['breakfast', 'lunch', 'dinner'].map((type, idx, arr) => {
          const mealTypeMap: any = { breakfast: t('food_dashboard.breakfast'), lunch: t('food_dashboard.lunch'), dinner: t('food_dashboard.dinner') };
          const existingMeal = mealsToday.find(m => m.mealType === type);
          
          return (
            <View key={type} style={[styles.planRow, idx < arr.length - 1 && styles.planRowBorder]}>
              <View style={styles.planInfo}>
                <Text style={styles.planType}>{mealTypeMap[type]}</Text>
                {existingMeal ? (
                  <Text style={styles.planContent}>{existingMeal.foods.map(f => f.name).join(', ')}</Text>
                ) : (
                  <Text style={[styles.planContent, { color: Colors.textTertiary, fontStyle: 'italic' }]}>
                    {t('food_dashboard.not_completed')}
                  </Text>
                )}
              </View>
              <View style={styles.planStatus}>
                {existingMeal ? (
                  <Text style={styles.checkIcon}>✅</Text>
                ) : (
                  <TouchableOpacity style={styles.addPlanBtn} onPress={() => router.push({ pathname: '/modules/food/add-meal', params: { type } })}>
                    <Text style={styles.addPlanBtnText}>+</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );

  const renderRecentFoods = () => {
    if (introducedFoods.length === 0) return null;
    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('food_dashboard.recent_foods')}</Text>
          <TouchableOpacity onPress={() => router.push('/modules/food/foods')}>
            <Text style={styles.sectionLink}>{t('food_dashboard.view_all')}</Text>
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recentScroll}>
          {introducedFoods.slice(0, 5).map((food) => (
            <TouchableOpacity key={food.id} style={styles.recentCard} onPress={() => router.push(`/modules/food/food/${food.id}`)}>
              <Text style={styles.recentEmoji}>{getEmojiForFood(food.name)}</Text>
              <Text style={styles.recentName}>{food.name}</Text>
              {food.reactionStatus !== 'none' && (
                <View style={styles.reactionBadge}>
                  <Text style={styles.reactionBadgeText}>{t('food_dashboard.reaction')}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderSafety = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t('food_dashboard.food_safety')}</Text>
      <TouchableOpacity style={styles.safetyCard} activeOpacity={0.8} onPress={() => router.push('/modules/food/safety')}>
        <View style={styles.safetyIconWrap}>
          <Text style={styles.safetyIcon}>🛡️</Text>
        </View>
        <View style={styles.safetyInfo}>
          <Text style={styles.safetyTitle}>{t('food_dashboard.safety_title')}</Text>
          <Text style={styles.safetySubtitle}>{t('food_dashboard.safety_subtitle')}</Text>
        </View>
        <Text style={styles.safetyArrow}>→</Text>
      </TouchableOpacity>
    </View>
  );

  const renderMoreTools = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t('food_dashboard.useful_tools')}</Text>
      <View style={styles.toolsGrid}>
        {[
          { emoji: '👩‍🍳', label: t('food_dashboard.recipes'), sublabel: t('food_dashboard.recipes_sub'), route: '/modules/food/recipes', color: Colors.feeding },
          { emoji: '📅', label: t('food_dashboard.weekly_menu'), sublabel: t('food_dashboard.weekly_menu_sub'), route: '/modules/food/weekly-menu', color: Colors.sleep },
          { emoji: '🛒', label: t('food_dashboard.shopping'), sublabel: t('food_dashboard.shopping_sub'), route: '/modules/food/shopping-list', color: Colors.amber },
          { emoji: '📋', label: t('food_dashboard.pediatrician_report'), sublabel: t('food_dashboard.pediatrician_report_sub'), route: '/modules/food/report', color: '#E8997A' },
          { emoji: '⚠️', label: t('food_dashboard.allergens'), sublabel: t('food_dashboard.allergens_sub', { introduced: allergensIntroduced, total: totalAllergens }), route: '/modules/food/allergens', color: Colors.error },
        ].map((tool) => (
          <TouchableOpacity
            key={tool.label}
            style={styles.toolCard}
            activeOpacity={0.8}
            onPress={() => router.push(tool.route as any)}
          >
            <View style={[styles.toolIconWrap, { backgroundColor: tool.color + '15' }]}>
              <Text style={styles.toolEmoji}>{tool.emoji}</Text>
            </View>
            <Text style={styles.toolLabel}>{tool.label}</Text>
            <Text style={styles.toolSublabel}>{tool.sublabel}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {renderHeader()}
      {isLoading || isChildLoading || !activeChild ? (
        <View style={styles.centerLoad}>
          <ActivityIndicator size="large" color={Colors.feeding} />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {(!profile || profile.status === 'not_started') && ageMonths < 6 ? (
            renderStartScreen()
          ) : (
            <>
              {renderTrackedFood()}
              {renderStats()}
              {renderQuickActions()}
              {renderTodayPlan()}
              {renderRecentFoods()}
              {renderMoreTools()}
              {renderSafety()}
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centerLoad: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  backArrow: { fontSize: 24, color: Colors.textPrimary },
  headerTitles: { alignItems: 'center' },
  headerTitle: { fontSize: 18, fontFamily: 'Fraunces', color: Colors.textPrimary },
  headerSubtitle: { fontSize: 13, fontFamily: 'Geist', color: Colors.textSecondary, marginTop: 2 },
  
  startContainer: { paddingHorizontal: Spacing.xl, paddingTop: Spacing['3xl'], alignItems: 'center' },
  startEmoji: { fontSize: 64, marginBottom: Spacing.xl },
  startTitle: { fontSize: 22, fontFamily: 'Fraunces', color: Colors.textPrimary, marginBottom: Spacing.md, textAlign: 'center' },
  startText: { fontSize: 15, fontFamily: 'Geist', color: Colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: Spacing['2xl'] },
  startBtn: { backgroundColor: Colors.feeding, paddingHorizontal: Spacing.xl, paddingVertical: 16, borderRadius: BorderRadius.xl, width: '100%', alignItems: 'center', marginBottom: Spacing.xl },
  startBtnText: { color: Colors.white, fontSize: 16, fontFamily: 'Geist-SemiBold' },
  safetyAlert: { backgroundColor: Colors.warning + '15', padding: Spacing.lg, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.warning + '40' },
  safetyAlertText: { fontSize: 13, fontFamily: 'Geist', color: Colors.warning, lineHeight: 18 },

  scrollContent: { paddingBottom: Spacing['3xl'] },
  
  trackedCard: {
    marginHorizontal: Spacing.xl, marginTop: Spacing.md, marginBottom: Spacing.lg,
    backgroundColor: Colors.white, borderRadius: BorderRadius['2xl'], padding: Spacing.lg,
    borderWidth: 1, borderColor: Colors.feeding + '30', ...Shadow.md,
  },
  trackedHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md },
  trackedIconWrap: {
    width: 50, height: 50, borderRadius: 25, backgroundColor: Colors.backgroundSoft,
    alignItems: 'center', justifyContent: 'center', marginRight: Spacing.md,
  },
  trackedEmoji: { fontSize: 26 },
  trackedInfo: { flex: 1 },
  trackedLabel: { fontSize: 12, fontFamily: 'Geist-SemiBold', color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 },
  trackedName: { fontSize: 18, fontFamily: 'Geist-Bold', color: Colors.textPrimary, marginTop: 2 },
  trackedDayBadge: { backgroundColor: Colors.feeding + '15', paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: BorderRadius.full },
  trackedDayText: { fontSize: 12, fontFamily: 'Geist-SemiBold', color: Colors.feeding },
  trackedFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.md },
  trackedStatus: { fontSize: 13, fontFamily: 'Geist', color: Colors.textSecondary },
  trackedBtn: { backgroundColor: Colors.feeding, paddingHorizontal: Spacing.md, paddingVertical: 8, borderRadius: BorderRadius.full },
  trackedBtnText: { fontSize: 13, fontFamily: 'Geist-SemiBold', color: Colors.white },

  statsRow: { flexDirection: 'row', paddingHorizontal: Spacing.xl, gap: Spacing.md, marginBottom: Spacing.xl },
  statCard: {
    flex: 1, backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.md,
    alignItems: 'center', ...Shadow.sm, borderWidth: 1, borderColor: 'rgba(232, 153, 122, 0.5)',
  },
  statValue: { fontSize: 22, fontFamily: 'Geist-Bold', color: Colors.textPrimary },
  statLabel: { fontSize: 11, fontFamily: 'Geist', color: Colors.textSecondary, marginTop: 2 },

  actionsGrid: { flexDirection: 'row', paddingHorizontal: Spacing.xl, gap: Spacing.md, marginBottom: Spacing.xl },
  actionBtn: { flex: 1, alignItems: 'center' },
  actionIconWrap: {
    width: 60, height: 60, borderRadius: 30, backgroundColor: Colors.white,
    alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm, ...Shadow.sm,
  },
  actionIcon: { fontSize: 24 },
  actionText: { fontSize: 12, fontFamily: 'Geist-SemiBold', color: Colors.textSecondary },

  section: { marginBottom: Spacing.xl },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.xl, marginBottom: Spacing.md },
  sectionTitle: { fontSize: 18, fontFamily: 'Geist-Bold', color: Colors.textPrimary, paddingHorizontal: Spacing.xl },
  sectionLink: { fontSize: 13, fontFamily: 'Geist-SemiBold', color: Colors.feeding },

  planCard: { marginHorizontal: Spacing.xl, backgroundColor: Colors.white, borderRadius: BorderRadius['2xl'], ...Shadow.sm },
  planRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.lg },
  planRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  planInfo: { flex: 1 },
  planType: { fontSize: 12, fontFamily: 'Geist-SemiBold', color: Colors.textSecondary, marginBottom: 4 },
  planContent: { fontSize: 15, fontFamily: 'Geist', color: Colors.textPrimary },
  planStatus: { width: 40, alignItems: 'flex-end' },
  checkIcon: { fontSize: 20 },
  addPlanBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.backgroundSoft, alignItems: 'center', justifyContent: 'center' },
  addPlanBtnText: { fontSize: 18, color: Colors.textSecondary, marginTop: -2 },

  recentScroll: { paddingHorizontal: Spacing.xl, gap: Spacing.md },
  recentCard: {
    width: 120, backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.md,
    alignItems: 'center', ...Shadow.sm,
  },
  recentEmoji: { fontSize: 32, marginBottom: Spacing.sm },
  recentName: { fontSize: 14, fontFamily: 'Geist-SemiBold', color: Colors.textPrimary, textAlign: 'center' },
  reactionBadge: { marginTop: Spacing.sm, backgroundColor: Colors.error + '15', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  reactionBadgeText: { fontSize: 10, fontFamily: 'Geist-SemiBold', color: Colors.error },

  toolsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, paddingHorizontal: Spacing.xl,
  },
  toolCard: {
    width: '47%', backgroundColor: Colors.white, borderRadius: BorderRadius.xl,
    padding: Spacing.lg, ...Shadow.sm, borderWidth: 1, borderColor: 'rgba(232, 153, 122, 0.4)',
  },
  toolIconWrap: {
    width: 48, height: 48, borderRadius: BorderRadius.lg, alignItems: 'center',
    justifyContent: 'center', marginBottom: Spacing.sm,
  },
  toolEmoji: { fontSize: 22 },
  toolLabel: { fontSize: 14, fontFamily: 'Geist-SemiBold', color: Colors.textPrimary, marginBottom: 2 },
  toolSublabel: { fontSize: 11, fontFamily: 'Geist', color: Colors.textTertiary },

  safetyCard: {
    marginHorizontal: Spacing.xl, marginTop: Spacing.md, backgroundColor: Colors.white, borderRadius: BorderRadius.xl,
    padding: Spacing.md, flexDirection: 'row', alignItems: 'center', ...Shadow.sm,
  },
  safetyIconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.warning + '20', alignItems: 'center', justifyContent: 'center', marginRight: Spacing.md },
  safetyIcon: { fontSize: 20 },
  safetyInfo: { flex: 1 },
  safetyTitle: { fontSize: 14, fontFamily: 'Geist-SemiBold', color: Colors.textPrimary, marginBottom: 2 },
  safetySubtitle: { fontSize: 12, fontFamily: 'Geist', color: Colors.textSecondary },
  safetyArrow: { fontSize: 20, color: Colors.textTertiary, marginLeft: Spacing.sm },
});
