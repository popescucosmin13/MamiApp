import Purchases, {
  type PurchasesPackage,
  type CustomerInfo,
  LOG_LEVEL,
} from 'react-native-purchases';
import { Platform } from 'react-native';

const IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS ?? '';
const ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID ?? '';
const MIN_REVENUECAT_KEY_LENGTH = 16;

let isConfigured = false;
let didWarnInvalidKey = false;

function getPlatformApiKey() {
  return Platform.OS === 'ios' ? IOS_KEY.trim() : ANDROID_KEY.trim();
}

function getApiKeyValidationIssue(apiKey: string): string | null {
  if (!apiKey) return 'missing';
  if (apiKey.length < MIN_REVENUECAT_KEY_LENGTH) return 'too short';

  const validPrefixes = Platform.OS === 'ios' ? ['appl_', 'test_'] : ['goog_', 'test_'];
  if (!validPrefixes.some((prefix) => apiKey.startsWith(prefix))) {
    return `expected ${validPrefixes.join(' or ')} key`;
  }

  return null;
}

function warnInvalidApiKey(issue: string) {
  if (didWarnInvalidKey) return;
  didWarnInvalidKey = true;
  console.warn(`[RevenueCat] API key ${issue} for ${Platform.OS} - purchases disabled`);
}

/**
 * RevenueCat service - wraps react-native-purchases SDK.
 *
 * Entitlement identifier in RevenueCat dashboard must be "premium".
 * Products (monthly / yearly) must be created in App Store Connect & Google Play.
 */
export const purchasesService = {
  /**
   * Call once on app start (after fonts load, before auth guard).
   * If userId is provided the SDK identity is set immediately.
   */
  async configure(userId?: string): Promise<void> {
    // Skip RevenueCat on web (subscriptions not supported)
    if (Platform.OS === 'web') {
      console.log('[RevenueCat] Skipped on web platform');
      return;
    }

    const apiKey = getPlatformApiKey();
    const apiKeyIssue = getApiKeyValidationIssue(apiKey);
    if (apiKeyIssue) {
      warnInvalidApiKey(apiKeyIssue);
      return;
    }

    Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.WARN);
    Purchases.configure({ apiKey });
    isConfigured = true;

    if (userId) {
      await Purchases.logIn(userId).catch(() => {
        // Non-critical - will retry on next call.
      });
    }
  },

  /** Call after Firebase Auth sign-in so RevenueCat links purchase history to the user. */
  async logIn(userId: string): Promise<void> {
    if (Platform.OS === 'web') return;
    if (!isConfigured) return;
    await Purchases.logIn(userId);
  },

  /** Call after Firebase Auth sign-out. */
  async logOut(): Promise<void> {
    if (Platform.OS === 'web') return;
    if (!isConfigured) return;
    await Purchases.logOut().catch(() => {});
  },

  /** Returns the latest CustomerInfo from RevenueCat (cached + fresh). */
  async getCustomerInfo(): Promise<CustomerInfo> {
    if (Platform.OS === 'web') {
      throw new Error('RevenueCat is not available on web');
    }
    if (!isConfigured) {
      throw new Error('RevenueCat is not configured');
    }
    return Purchases.getCustomerInfo();
  },

  /**
   * Returns true when the user has an active "premium" entitlement.
   * Used to gate Premium features without a Cloud Function round-trip.
   */
  async isPremiumActive(): Promise<boolean> {
    if (Platform.OS === 'web') return false;
    if (!isConfigured) return false;
    try {
      const info = await Purchases.getCustomerInfo();
      return info.entitlements.active['premium'] !== undefined;
    } catch {
      return false;
    }
  },

  /**
   * Returns available packages from the current offering.
   * Packages are named by platform (monthly / annual identifiers
   * configured in the RevenueCat dashboard).
   */
  async getOfferings(): Promise<PurchasesPackage[]> {
    if (Platform.OS === 'web') return [];
    if (!isConfigured) return [];
    try {
      const offerings = await Purchases.getOfferings();
      return offerings.current?.availablePackages ?? [];
    } catch {
      return [];
    }
  },

  /**
   * Initiates a purchase flow.
   * Throws with `userCancelled: true` if the user dismisses the paywall.
   */
  async purchasePackage(pkg: PurchasesPackage): Promise<CustomerInfo> {
    if (Platform.OS === 'web') {
      throw new Error('RevenueCat purchases are not available on web');
    }
    if (!isConfigured) {
      throw new Error('RevenueCat is not configured');
    }
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return customerInfo;
  },

  /**
   * Restores previous purchases (required by App Store / Play Store rules).
   * Updates the CustomerInfo and entitlements if valid purchases are found.
   */
  async restorePurchases(): Promise<CustomerInfo> {
    if (Platform.OS === 'web') {
      throw new Error('RevenueCat restore is not available on web');
    }
    if (!isConfigured) {
      throw new Error('RevenueCat is not configured');
    }
    return Purchases.restorePurchases();
  },
};
