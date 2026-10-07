import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { httpsCallable } from 'firebase/functions';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { purchasesService } from '../../../../services/purchasesService';
import { authService } from '../../../../services/authService';
import { getFirebaseFunctions } from '../../../../services/firebase';
import { useAuthStore } from '../../../../stores/authStore';
import { Colors } from '../../../../theme/colors';
import { Spacing, BorderRadius, Shadow } from '../../../../theme/spacing';

const PREMIUM_FEATURES = [
  { emoji: 'AI', titleKey: 'subscription.f1_title', descKey: 'subscription.f1_desc' },
  { emoji: 'R', titleKey: 'subscription.f2_title', descKey: 'subscription.f2_desc' },
  { emoji: 'A', titleKey: 'subscription.f3_title', descKey: 'subscription.f3_desc' },
  { emoji: 'F', titleKey: 'subscription.f4_title', descKey: 'subscription.f4_desc' },
  { emoji: 'C', titleKey: 'subscription.f5_title', descKey: 'subscription.f5_desc' },
  { emoji: 'N', titleKey: 'subscription.f6_title', descKey: 'subscription.f6_desc' },
  { emoji: 'B', titleKey: 'subscription.f7_title', descKey: 'subscription.f7_desc' },
  { emoji: 'S', titleKey: 'subscription.f8_title', descKey: 'subscription.f8_desc' },
];

type PurchasesPackage = Awaited<ReturnType<typeof purchasesService.getOfferings>>[number];

export default function SubscriptionScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user, isPremium, setIsPremium, setProfile } = useAuthStore();
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [voucherCode, setVoucherCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [voucherLoading, setVoucherLoading] = useState(false);
  const [offeringsLoading, setOfferingsLoading] = useState(true);

  useEffect(() => {
    loadOfferings();
  }, []);

  const loadOfferings = async () => {
    setOfferingsLoading(true);
    try {
      const pkgs = await purchasesService.getOfferings();
      setPackages(pkgs);
      // Pre-select first package
      if (pkgs.length > 0) {
        setSelectedPackageId(pkgs[0].identifier);
      }
    } catch {
      // Offerings unavailable (no network / keys not configured)
    } finally {
      setOfferingsLoading(false);
    }
  };

  const handleSubscribe = async () => {
    const pkg = packages.find((p) => p.identifier === selectedPackageId);
    if (!pkg) {
      // Fallback when SDK not configured (dev / CI)
      Alert.alert('Premium', t('subscription.fallback_msg'));
      return;
    }

    setLoading(true);
    try {
      const info = await purchasesService.purchasePackage(pkg);
      const active = info.entitlements.active['premium'] !== undefined;
      setIsPremium(active);
      if (active) {
        Alert.alert(t('subscription.active_alert_title'), t('subscription.active_alert_msg'), [
          { text: t('subscription.thanks'), onPress: () => router.back() },
        ]);
      }
    } catch (err: any) {
      if (!err.userCancelled) {
        Alert.alert(t('common.error'), t('subscription.payment_error'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    setLoading(true);
    try {
      const info = await purchasesService.restorePurchases();
      const active = info.entitlements.active['premium'] !== undefined;
      setIsPremium(active);
      if (active) {
        Alert.alert(t('subscription.restored_title'), t('subscription.restored_msg'));
        router.back();
      } else {
        Alert.alert(t('subscription.none_found_title'), t('subscription.none_found_msg'));
      }
    } catch {
      Alert.alert(t('common.error'), t('subscription.restore_error'));
    } finally {
      setLoading(false);
    }
  };

  const handleRedeemVoucher = async () => {
    const code = voucherCode.trim().toUpperCase();
    if (!code) {
      Alert.alert(t('subscription.missing_code_title'), t('subscription.missing_code_msg'));
      return;
    }
    if (!user) {
      Alert.alert(t('subscription.auth_required_title'), t('subscription.auth_required_msg'));
      return;
    }

    setVoucherLoading(true);
    try {
      const functions = await getFirebaseFunctions();
      const redeem = httpsCallable(functions, 'redeemPremiumVoucher');
      await redeem({ code });
      const freshProfile = await authService.getUserProfile(user.uid);
      setProfile(freshProfile);
      setIsPremium(freshProfile?.subscription?.plan === 'premium');
      Alert.alert(t('subscription.voucher_active_title'), t('subscription.voucher_active_msg'), [
        { text: t('subscription.perfect'), onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert(t('subscription.voucher_invalid_title'), err?.message || t('subscription.voucher_invalid_msg'));
    } finally {
      setVoucherLoading(false);
    }
  };

  if (isPremium) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('subscription.header')}</Text>
          <View style={{ width: 32 }} />
        </View>
        <View style={styles.activeCard}>
          <Text style={styles.activeEmoji}>⭐</Text>
          <Text style={styles.activeTitle}>{t('subscription.active_title')}</Text>
          <Text style={styles.activeSubtitle}>{t('subscription.active_subtitle')}</Text>
          <TouchableOpacity onPress={() => router.push('/manage-subscription' as any)}>
            <Text style={styles.manageLink}>{t('subscription.manage')}</Text>
          </TouchableOpacity>
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
        <Text style={styles.headerTitle}>{t('subscription.premium_header')}</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.heroEmoji}>✨</Text>
          <Text style={styles.heroTitle}>{t('subscription.hero_title')}</Text>
          <Text style={styles.heroSubtitle}>{t('subscription.hero_subtitle')}</Text>
        </View>

        {/* Features */}
        <View style={styles.featuresSection}>
          <Text style={styles.featuresTitle}>{t('subscription.features_title')}</Text>
          <View style={styles.featuresGrid}>
            {PREMIUM_FEATURES.map((f, i) => (
              <View key={i} style={styles.featureCard}>
                <Text style={styles.featureEmoji}>{f.emoji}</Text>
                <View style={styles.featureText}>
                  <Text style={styles.featureTitle}>{t(f.titleKey)}</Text>
                  <Text style={styles.featureDesc}>{t(f.descKey)}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Plans — from RevenueCat or static fallback */}
        <View style={styles.plansSection}>
          <Text style={styles.plansTitle}>{t('subscription.plans_title')}</Text>

          {offeringsLoading ? (
            <ActivityIndicator color={Colors.plum} style={{ marginVertical: Spacing.xl }} />
          ) : packages.length > 0 ? (
            packages.map((pkg) => {
              const isSelected = selectedPackageId === pkg.identifier;
              const priceString = pkg.product.priceString;
              const period = pkg.packageType === 'ANNUAL' ? t('subscription.year') : t('subscription.month');
              const isAnnual = pkg.packageType === 'ANNUAL';

              return (
                <TouchableOpacity
                  key={pkg.identifier}
                  style={[styles.planCard, isSelected && styles.planCardActive]}
                  onPress={() => setSelectedPackageId(pkg.identifier)}
                >
                  <View style={styles.planRadio}>
                    {isSelected && <View style={styles.planRadioDot} />}
                  </View>
                  <View style={styles.planInfo}>
                    <Text style={[styles.planLabel, isSelected && styles.planLabelActive]}>
                      {isAnnual ? t('subscription.annual') : t('subscription.monthly')}
                    </Text>
                    <Text style={styles.planPrice}>
                      <Text style={[styles.planPriceAmount, isSelected && styles.planPriceAmountActive]}>
                        {priceString}
                      </Text>
                      <Text style={styles.planPricePeriod}> / {period}</Text>
                    </Text>
                  </View>
                  {isAnnual && (
                    <View style={styles.savingsBadge}>
                      <Text style={styles.savingsText}>{t('subscription.savings', { value: '~37%' })}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })
          ) : (
            // Fallback static plans when RevenueCat keys not configured
            [
              { id: 'monthly', label: t('subscription.monthly'), price: '39 lei', period: t('subscription.month'), annual: false },
              { id: 'yearly', label: t('subscription.annual'), price: '299 lei', period: t('subscription.year'), annual: true },
            ].map((plan) => (
              <TouchableOpacity
                key={plan.id}
                style={[styles.planCard, selectedPackageId === plan.id && styles.planCardActive]}
                onPress={() => setSelectedPackageId(plan.id)}
              >
                <View style={styles.planRadio}>
                  {selectedPackageId === plan.id && <View style={styles.planRadioDot} />}
                </View>
                <View style={styles.planInfo}>
                  <Text style={[styles.planLabel, selectedPackageId === plan.id && styles.planLabelActive]}>
                    {plan.label}
                  </Text>
                  <Text style={styles.planPrice}>
                    <Text style={[styles.planPriceAmount, selectedPackageId === plan.id && styles.planPriceAmountActive]}>
                      {plan.price}
                    </Text>
                    <Text style={styles.planPricePeriod}> / {plan.period}</Text>
                  </Text>
                </View>
                {plan.annual && (
                  <View style={styles.savingsBadge}>
                    <Text style={styles.savingsText}>{t('subscription.savings', { value: '37%' })}</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))
          )}
        </View>

        <View style={styles.voucherSection}>
          <Text style={styles.voucherTitle}>{t('subscription.voucher_title')}</Text>
          <Text style={styles.voucherSubtitle}>{t('subscription.voucher_subtitle')}</Text>
          <View style={styles.voucherRow}>
            <TextInput
              style={styles.voucherInput}
              value={voucherCode}
              onChangeText={setVoucherCode}
              placeholder="ex: MAMI30"
              placeholderTextColor={Colors.textTertiary}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={[styles.voucherBtn, voucherLoading && styles.subscribeBtnDisabled]}
              onPress={handleRedeemVoucher}
              disabled={voucherLoading}
            >
              {voucherLoading ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.voucherBtnText}>{t('subscription.activate')}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* CTA */}
        <View style={styles.ctaSection}>
          <TouchableOpacity
            style={[styles.subscribeBtn, loading && styles.subscribeBtnDisabled]}
            onPress={handleSubscribe}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.subscribeBtnText}>{t('subscription.start')}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.restoreBtn} onPress={handleRestore} disabled={loading}>
            <Text style={styles.restoreBtnText}>{t('subscription.restore')}</Text>
          </TouchableOpacity>

          <Text style={styles.legalText}>{t('subscription.legal')}</Text>
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
  activeCard: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  activeEmoji: { fontSize: 64, marginBottom: Spacing.lg },
  activeTitle: { fontSize: 24, fontFamily: 'Fraunces', color: Colors.plum, marginBottom: Spacing.sm },
  activeSubtitle: { fontSize: 15, fontFamily: 'Geist', color: Colors.textSecondary, textAlign: 'center' },
  manageLink: { fontSize: 14, fontFamily: 'Geist-SemiBold', color: Colors.plum, marginTop: Spacing.xl },
  hero: {
    alignItems: 'center', padding: Spacing.xl, paddingTop: Spacing['2xl'],
    backgroundColor: Colors.plum + '08',
  },
  heroEmoji: { fontSize: 56, marginBottom: Spacing.md },
  heroTitle: { fontSize: 22, fontFamily: 'Fraunces', color: Colors.textPrimary, marginBottom: Spacing.sm, textAlign: 'center' },
  heroSubtitle: { fontSize: 14, fontFamily: 'Geist', color: Colors.textSecondary, textAlign: 'center', lineHeight: 21 },
  featuresSection: { padding: Spacing.xl },
  featuresTitle: { fontSize: 16, fontFamily: 'Geist-SemiBold', color: Colors.textPrimary, marginBottom: Spacing.lg },
  featuresGrid: { gap: Spacing.sm },
  featureCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md,
    backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.md, ...Shadow.sm,
  },
  featureEmoji: { fontSize: 22, width: 32 },
  featureText: { flex: 1 },
  featureTitle: { fontSize: 14, fontFamily: 'Geist-SemiBold', color: Colors.textPrimary },
  featureDesc: { fontSize: 12, fontFamily: 'Geist', color: Colors.textSecondary, marginTop: 2 },
  plansSection: { paddingHorizontal: Spacing.xl, marginBottom: Spacing.xl },
  plansTitle: { fontSize: 16, fontFamily: 'Geist-SemiBold', color: Colors.textPrimary, marginBottom: Spacing.md },
  voucherSection: {
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.xl,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    ...Shadow.sm,
  },
  voucherTitle: { fontSize: 15, fontFamily: 'Geist-SemiBold', color: Colors.textPrimary },
  voucherSubtitle: {
    fontSize: 12,
    fontFamily: 'Geist',
    color: Colors.textSecondary,
    marginTop: 3,
    marginBottom: Spacing.md,
  },
  voucherRow: { flexDirection: 'row', gap: Spacing.sm },
  voucherInput: {
    flex: 1,
    height: 48,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
    fontFamily: 'Geist-SemiBold',
    color: Colors.textPrimary,
    backgroundColor: Colors.background,
  },
  voucherBtn: {
    height: 48,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.plum,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voucherBtnText: { fontSize: 13, fontFamily: 'Geist-SemiBold', color: Colors.white },
  planCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.lg, marginBottom: Spacing.sm,
    borderWidth: 2, borderColor: Colors.border, ...Shadow.sm,
  },
  planCardActive: { borderColor: Colors.plum },
  planRadio: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: Colors.plum,
    alignItems: 'center', justifyContent: 'center',
  },
  planRadioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.plum },
  planInfo: { flex: 1 },
  planLabel: { fontSize: 15, fontFamily: 'Geist-SemiBold', color: Colors.textSecondary },
  planLabelActive: { color: Colors.plum },
  planPrice: {},
  planPriceAmount: { fontSize: 20, fontFamily: 'Geist-Bold', color: Colors.textPrimary },
  planPriceAmountActive: { color: Colors.plum },
  planPricePeriod: { fontSize: 13, fontFamily: 'Geist', color: Colors.textTertiary },
  savingsBadge: { backgroundColor: Colors.success + '20', paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: BorderRadius.full },
  savingsText: { fontSize: 11, fontFamily: 'Geist-SemiBold', color: Colors.success },
  ctaSection: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing['2xl'], gap: Spacing.md },
  subscribeBtn: {
    height: 56, borderRadius: BorderRadius.xl, backgroundColor: Colors.plum,
    alignItems: 'center', justifyContent: 'center', ...Shadow.md,
  },
  subscribeBtnDisabled: { opacity: 0.5 },
  subscribeBtnText: { fontSize: 16, fontFamily: 'Geist-SemiBold', color: Colors.white },
  restoreBtn: { height: 44, alignItems: 'center', justifyContent: 'center' },
  restoreBtnText: { fontSize: 14, fontFamily: 'Geist', color: Colors.textSecondary },
  legalText: { fontSize: 11, fontFamily: 'Geist', color: Colors.textTertiary, textAlign: 'center', lineHeight: 16 },
});
