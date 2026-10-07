// src/types/index.ts

export type AdminRole =
  | 'super_admin'
  | 'admin'
  | 'content_editor'
  | 'medical_reviewer'
  | 'community_moderator'
  | 'support_agent'
  | 'finance_manager'
  | 'developer';

export interface AdminUser {
  uid: string;
  email: string;
  displayName: string;
  role: AdminRole;
  createdAt: any;
  lastLogin?: any;
  isActive: boolean;
}

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  profileMode: 'pregnancy' | 'child';
  subscription?: {
    plan: 'free' | 'basic' | 'premium' | string;
    status: 'active' | 'inactive' | 'expired' | 'cancelled' | 'trial' | string;
    source?: 'revenuecat' | 'admin' | 'voucher' | string;
    provider?: string;
    startedAt?: any;
    expiresAt?: any;
    updatedAt?: any;
    updatedBy?: string;
    voucherCode?: string;
  };
  isPremium?: boolean;
  moduleOverrides?: Record<string, boolean>;
  createdAt: any;
  updatedAt?: any;
  onboardingCompleted: boolean;
  locale: string;
  fcmToken?: string;
  webPushToken?: string;
  nativePushPlatform?: string;
  nativePushRegisteredAt?: any;
  isPWA?: boolean;
  platform?: string;
  appVersion?: string;
  appBuildVersion?: string;
  appPlatform?: string;
  appOwnership?: string;
  appInstallSource?: string;
  appInstallSourceDetail?: string;
  appLastSeenAt?: any;
  serviceWorkerVersion?: string;
  emailVerified?: boolean;
  authProviderIds?: string[];
  authProvider?: string;
  authProviderLabel?: string;
  usesGoogleAuth?: boolean;
  usesPasswordAuth?: boolean;
  emailMarketingUnsubscribed?: boolean;
  emailMarketingUnsubscribedAt?: any;
  emailPreferences?: {
    marketing?: boolean;
    [key: string]: any;
  };
  authDisabled?: boolean;
  lastSignInTime?: string;
  authOnly?: boolean;
  authMissing?: boolean;
  activeChildId?: string;
  preferences?: {
    notifications?: Record<string, boolean>;
    [key: string]: any;
  };
  isBetaTester?: boolean;
  betaTester?: boolean;
}

export interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  enabledFor: 'all' | 'admin' | 'beta' | 'premium' | 'none';
  rolloutPercent?: number;
  updatedAt: any;
  updatedBy: string;
}

export interface AuditLog {
  id: string;
  adminId: string;
  adminEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  reason?: string;
  timestamp: any;
  ip?: string;
  metadata?: Record<string, any>;
}

export interface CommunityPost {
  id: string;
  authorId: string;
  authorName: string;
  isAnonymous: boolean;
  isVerifiedSpecialist: boolean;
  category: string;
  title: string;
  content: string;
  likesCount: number;
  commentsCount: number;
  createdAt: any;
  isPinned: boolean;
  status: 'published' | 'hidden' | 'deleted' | 'review';
  reportCount?: number;
  aiModerationScore?: number;
}

export interface NotificationCampaign {
  id: string;
  title: string;
  body: string;
  targetAudience: string;
  status: 'draft' | 'scheduled' | 'sent' | 'cancelled';
  scheduledAt?: any;
  sentAt?: any;
  sentCount?: number;
  openedCount?: number;
  createdBy: string;
  createdAt: any;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  html: string;
  text?: string;
  type: 'auth_verify_email' | 'welcome' | 'marketing' | 'transactional' | string;
  isActive: boolean;
  updatedAt?: any;
  updatedBy?: string;
  createdAt?: any;
  createdBy?: string;
}

export interface SupportTicket {
  id: string;
  userId?: string;
  email: string;
  subject: string;
  message: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignedTo?: string;
  createdAt: any;
  updatedAt?: any;
  deviceInfo?: string;
  appVersion?: string;
}

export interface AppConfig {
  maintenanceMode: boolean;
  maintenanceMessage: string;
  minAppVersion: string;
  /** versionCode-ul ultimului build Android publicat — sub el apare popup de update */
  latestAndroidBuild?: number;
  /** build-urile Android sub acest versionCode sunt blocate până actualizează */
  forceUpdateBelowBuild?: number;
  /** mesaj custom afișat în popup-ul de update (opțional) */
  updateMessage?: string;
  aiLimitFreePerDay: number;
  aiLimitBasicPerDay?: number;
  aiLimitPremiumPerDay: number;
  aiLimitsByPlan?: {
    free?: number;
    basic?: number;
    premium?: number;
  };
  storageLimitFreeMb: number;
  storageLimitPremiumMb: number;
  supportEmail: string;
  availableCountries: string[];
}

export interface DashboardStats {
  totalUsers: number;
  activeToday: number;
  activeThisMonth: number;
  pregnantUsers: number;
  children: number;
  premiumUsers: number;
  aiInsightsToday: number;
  aiCostThisMonth: number;
  communityPostsToday: number;
  documentsUploaded: number;
  errorsToday: number;
  notificationsSent: number;
}
