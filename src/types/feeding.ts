import type { Timestamp } from 'firebase/firestore';

export interface FeedRecord {
  id?: string;
  timestamp: Timestamp;
  type: 'breastfeeding' | 'bottle' | 'solid';
  side?: 'left' | 'right' | 'both'; // pentru breastfeeding
  duration?: number; // secunde, pentru breastfeeding
  amount?: number; // ml, pentru bottle
  milkType?: 'breast' | 'formula' | 'mixed'; // pentru bottle
  foods?: string[]; // pentru solid
  notes?: string;
  createdBy: string; // userId
}

export type FeedSide = 'left' | 'right';
export type FeedType = 'breastfeeding' | 'bottle' | 'solid';
export type MilkType = 'breast' | 'formula' | 'mixed';

export interface FeedingStats {
  totalToday: number;
  totalBreastfeeding: number;
  totalBottle: number;
  totalSolid: number;
  lastFeedTime?: Timestamp;
  avgDurationBreastfeeding?: number; // secunde
  avgAmountBottle?: number; // ml
}
