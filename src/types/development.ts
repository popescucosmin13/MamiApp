// ─── Development Phase Insight ────────────────────────────────────────────────

export type InsightType =
  | 'possible_growth_spurt'
  | 'sleep_adjustment'
  | 'developmental_change'
  | 'feeding_change'
  | 'emotional_phase'
  | 'new_milestone'
  | 'teething';

export type Confidence = 'low' | 'medium' | 'high';

export interface InsightSignals {
  feedingIncreasePercent?: number;   // % față de media 7 zile
  sleepChangeMins?: number;          // minute +/- față de media 7 zile
  wakeupsChange?: number;            // treziri +/- față de media 7 zile
  fussinessLogged?: boolean;
  newMilestone?: string;
  teethingSignal?: boolean;
  symptomsPresent?: boolean;
  diaperCountNormal?: boolean;
}

export interface DevelopmentInsight {
  id: string;
  childId: string;
  userId: string;
  generatedAt: string;               // ISO date

  type: InsightType;
  confidence: Confidence;
  signals: InsightSignals;

  title: string;
  message: string;
  suggestions: string[];
  safetyNote?: string;

  // auto-expire after 3 days
  expiresAt: string;
}

// ─── CDC Milestone ─────────────────────────────────────────────────────────────

export interface CDCMilestone {
  id: string;
  ageMonths: number;                 // 2, 4, 6, 9, 12, 15, 18, 24, 36, 48, 60
  category: 'social' | 'language' | 'cognitive' | 'motor';
  text: string;                      // description RO
  achieved?: boolean;
  achievedDate?: string;
}

// ─── Development Period (admin-configurable) ───────────────────────────────────

export interface SensitivePeriod {
  id: string;
  name: string;
  ageFromWeeks: number;
  ageToWeeks: number;
  description: string;
  possibleSigns: string[];
  suggestions: string[];
  isActive: boolean;
  createdBy?: string;                // admin uid
  updatedAt?: string;
}

// ─── Admin Plan ────────────────────────────────────────────────────────────────

export interface DevelopmentPlan {
  id: string;
  name: string;
  targetAgeMonthsMin: number;
  targetAgeMonthsMax: number;
  milestones: string[];              // milestone IDs
  sensitiveperiodIds: string[];
  tips: string[];
  isPremium: boolean;
  isActive: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}
