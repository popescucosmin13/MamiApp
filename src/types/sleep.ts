import { Timestamp } from 'firebase/firestore';

// ─── Core sleep log ──────────────────────────────────────────────────────────
export interface SleepLog {
  id: string;
  userId: string;
  childId: string;
  sleepType: 'nap' | 'night';
  startTime: string;        // ISO
  endTime?: string;         // ISO
  durationMinutes?: number;
  wakeUps?: number;
  sleepQuality?: 'poor' | 'medium' | 'good';
  moodBefore?: 'calm' | 'fussy' | 'crying' | 'sleepy' | 'active';
  moodAfter?: 'rested' | 'fussy' | 'sleepy' | 'neutral';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Sleep signals (tiredness cues) ─────────────────────────────────────────
export type SleepSignal =
  | 'yawning' | 'rubbing_eyes' | 'fussy' | 'clingy'
  | 'staring' | 'crying' | 'hyperactive';

export interface SleepSignalLog {
  id: string;
  userId: string;
  childId: string;
  date: string;             // YYYY-MM-DD
  time: string;             // HH:MM
  signals: SleepSignal[];
  intensity: 1 | 2 | 3 | 4 | 5;
  notes?: string;
  createdAt: string;
}

// ─── Age-based guideline table ───────────────────────────────────────────────
export interface SleepGuideline {
  id: string;
  minAgeDays: number;
  maxAgeDays: number;
  totalSleepMinHours: number;
  totalSleepMaxHours: number;
  napsMin?: number;
  napsMax?: number;
  wakeWindowMinMinutes?: number;
  wakeWindowMaxMinutes?: number;
  sourceType: 'official' | 'clinical_reference' | 'practical_range';
  sourceName: string;
  note: string;
}

// ─── Next sleep recommendation output ───────────────────────────────────────
export type SleepRecommendationStatus =
  | 'too_early'
  | 'getting_ready'
  | 'recommended_now'
  | 'possibly_overtired'
  | 'adjust_bedtime'
  | 'no_recommendation';

export interface NextSleepRecommendation {
  recommendedStart: string;
  recommendedEnd: string;
  currentWakeWindowMinutes: number;
  targetWakeWindowMinMinutes: number;
  targetWakeWindowMaxMinutes: number;
  status: SleepRecommendationStatus;
  title: string;
  message: string;
  suggestions: string[];
  safetyNote?: string;
}

// ─── Child personal sleep profile (built from 7+ days history) ──────────────
export interface ChildSleepProfile {
  childId: string;
  averageWakeWindowBeforeNap1?: number;
  averageWakeWindowBeforeNap2?: number;
  averageWakeWindowBeforeNap3?: number;
  averageWakeWindowBeforeBedtime?: number;
  averageTotalSleep24h?: number;
  averageNightSleep?: number;
  averageDaySleep?: number;
  averageBedtime?: string;   // HH:MM
  averageWakeTime?: string;  // HH:MM
  daysOfData: number;
  confidence: 'low' | 'medium' | 'high';
  updatedAt: string;
}

// ─── Red flag symptoms ───────────────────────────────────────────────────────
export type RedFlag =
  | 'fever' | 'lethargy' | 'breathing_difficulty'
  | 'refusing_feeds' | 'dehydration_signs'
  | 'inconsolable_crying' | 'unusual_sleepiness';

// ─── Backwards-compatible with old SleepRecord (for existing code) ───────────
export interface SleepRecord {
  id: string;
  startTime: Timestamp;
  endTime?: Timestamp;
  duration?: number;   // seconds
  type: 'nap' | 'night';
  quality?: 'bun' | 'mediu' | 'slab' | 'good' | 'medium' | 'poor';
  notes?: string;
  createdBy?: string;
}

export interface SleepStats {
  totalHoursToday: number;
  totalNaps: number;
  nightSleepHours: number;
  napHours: number;
  avgQuality: string;
  lastSleepStart?: Timestamp;
}
