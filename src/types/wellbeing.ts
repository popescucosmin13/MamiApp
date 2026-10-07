import type { Timestamp } from 'firebase/firestore';

export interface WellbeingRecord {
  id?: string;
  date: Timestamp; // data zilei, ora 00:00
  sleepHours?: number;
  mood?: 1 | 2 | 3 | 4 | 5;
  hydration?: number; // litri
  energy?: 1 | 2 | 3 | 4 | 5;
  pain?: {
    hasIt: boolean;
    location?: string;
    severity?: 1 | 2 | 3 | 4 | 5;
  };
  breastfeeding?: {
    sessions?: number;
    difficulties?: string[];
  };
  journal?: string;
  gratitude?: string;
}

export interface EmotionRecord {
  id?: string;
  date: Timestamp;
  mood: 'happy' | 'calm' | 'agitated' | 'sad' | 'sleepy' | 'anxious';
  intensity: 1 | 2 | 3 | 4 | 5;
  triggers?: string[];
  duration?: number; // minute, pentru tantrumuri
  whatHelped?: string;
  notes?: string;
}

export const EMOTION_TRIGGERS = [
  'foame',
  'oboseală',
  'frustrare',
  'schimbare rutină',
  'supra-stimulare',
  'dentiție',
  'boală',
  'separare',
  'atenție',
  'altul',
];
