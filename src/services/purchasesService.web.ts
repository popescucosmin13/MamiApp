type WebPurchasesPackage = {
  identifier: string;
  packageType: string;
  product: {
    priceString: string;
  };
};

type WebCustomerInfo = {
  entitlements: {
    active: Record<string, unknown>;
  };
};

const unavailable = (feature: string) => new Error(`RevenueCat ${feature} is not available on web`);

export const purchasesService = {
  async configure(): Promise<void> {
    return undefined;
  },

  async logIn(): Promise<void> {
    return undefined;
  },

  async logOut(): Promise<void> {
    return undefined;
  },

  async getCustomerInfo(): Promise<WebCustomerInfo> {
    throw unavailable('customer info');
  },

  async isPremiumActive(): Promise<boolean> {
    return false;
  },

  async getOfferings(): Promise<WebPurchasesPackage[]> {
    return [];
  },

  async purchasePackage(): Promise<WebCustomerInfo> {
    throw unavailable('purchases');
  },

  async restorePurchases(): Promise<WebCustomerInfo> {
    throw unavailable('restore');
  },
};
