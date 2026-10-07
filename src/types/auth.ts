import type { Timestamp } from 'firebase/firestore';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  locale: 'ro' | 'en';
  timezone: string;
  subscription: UserSubscription;
  isPremium?: boolean;
  moduleOverrides?: Record<string, boolean>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  onboardingCompleted: boolean;
  profileMode: 'pregnancy' | 'child';
  preferences: UserPreferences;
  appVersion?: string;
  appBuildVersion?: string;
  appPlatform?: string;
  appOwnership?: string;
  appInstallSource?: string;
  appInstallSourceDetail?: string;
  appLastSeenAt?: Timestamp;
  serviceWorkerVersion?: string;
  isPWA?: boolean;
  platform?: string;
}

export interface UserSubscription {
  plan: 'free' | 'basic' | 'premium';
  expiresAt?: Timestamp;
  status: 'active' | 'cancelled' | 'expired' | 'trial';
  trialEndsAt?: Timestamp;
  source?: 'revenuecat' | 'admin' | 'voucher' | string;
  provider?: string;
  voucherCode?: string;
}

export interface UserPreferences {
  notifications: NotificationPreferences;
  theme: 'auto' | 'light' | 'dark';
  appearance?: {
    accent?: 'coral' | 'sage' | 'plum' | 'slate';
    textSize?: 'small' | 'medium' | 'large';
    compact?: boolean;
  };
  quietHoursStart: number; // 22 = 22:00
  quietHoursEnd: number;   // 7 = 07:00
}

export interface NotificationPreferences {
  vaccines: boolean;
  meals: boolean;
  sleep: boolean;
  appointments: boolean;
  aiSummary: boolean;
  community: boolean;
  milestones: boolean;
  /** Conținut zilnic personalizat (sarcină/copil) trimis de orchestratorul server-side */
  dailyContent?: boolean;
}

export interface FamilyMember {
  id: string;
  name: string;
  role: 'father' | 'grandparent' | 'nanny' | 'doctor' | 'other';
  email: string;
  avatar?: string;
  color: string;
  permissions: FamilyPermissions;
  inviteStatus: 'pending' | 'accepted' | 'declined';
  invitedAt: Timestamp;
}

export interface FamilyPermissions {
  canViewChildren: boolean;
  canEditFeeding: boolean;
  canEditSleep: boolean;
  canEditDiapers: boolean;
  canViewMedical: boolean;
  canEditMedical: boolean;
  canViewDocuments: boolean;
  canViewWellbeing: boolean;
  canViewGrowth: boolean;
}
