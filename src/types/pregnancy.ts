import type { Timestamp } from 'firebase/firestore';

export interface Pregnancy {
  isActive: boolean;
  lmpDate: Timestamp;
  dueDate: Timestamp;
  conceptionDate?: Timestamp;
  babyName: string;
  gender: 'male' | 'female' | 'unknown';
  weekStarted: number;
  doctorName?: string;
  maternityChosen?: string;
  birthPlan?: BirthPlan;
  bagChecklist: ChecklistItem[];
  actsChecklist: ChecklistItem[];
  nurseryChecklist: ChecklistItem[];
}

export interface BirthPlan {
  // Delivery preferences
  preferredBirthType?: 'natural' | 'cesarean' | 'no_preference';
  epidural?: 'yes' | 'no' | 'on_request';
  // Labor & positioning
  laborPositions?: string[];
  waterBirth?: boolean;
  // Companion & atmosphere
  companion?: string;
  musicDuringLabor?: string;
  photography?: boolean;
  // Immediate postpartum
  skinToSkin: boolean;
  delayedCordClamping: boolean;
  cordCutting?: 'partner' | 'doctor' | 'no_preference';
  breastfeedingFirstHour: boolean;
  // Emergency
  emergencyPreference?: 'immediate_medical' | 'discuss_first';
  // Extra
  notes?: string;
  savedAt?: string;
}

export interface ChecklistItem {
  item: string;
  done: boolean;
}

export interface WeightLog {
  id?: string;
  week: number;
  weight: number; // kg
  date: Timestamp;
}

export interface Symptom {
  id?: string;
  date: Timestamp;
  symptom: string;
  severity: 1 | 2 | 3 | 4 | 5;
  notes?: string;
}

export interface FetalMovement {
  id?: string;
  date: Timestamp;
  count: number;
  durationMinutes: number;
  notes?: string;
}

export interface Contraction {
  id?: string;
  startTime: Timestamp;
  endTime?: Timestamp;
  duration?: number; // secunde
  intensity: 1 | 2 | 3 | 4 | 5;
}

export interface PregnancyAppointment {
  id?: string;
  date: Timestamp;
  type: string;
  doctor?: string;
  location?: string;
  status: 'scheduled' | 'completed' | 'missed';
  notes?: string;
  documentUrl?: string;
}

export interface Vital {
  id?: string;
  date: Timestamp;
  type: 'blood_pressure' | 'glucose' | 'hemoglobin' | 'weight' | 'heart_rate' | 'sleep';
  values: {
    systolic?: number;  // mmHg
    diastolic?: number; // mmHg
    glucose?: number;   // mg/dL
    hemoglobin?: number; // g/dL
    weight?: number;    // kg
    heartRate?: number; // bpm
    sleepHours?: number; // ore
  };
  notes?: string;
}

export interface JournalEntry {
  id?: string;
  date: Timestamp;
  content: string;
  mood?: string;
  photos?: string[];
}

export interface DoctorQuestion {
  id?: string;
  question: string;
  asked: boolean;
  answer?: string;
  askedAt?: Timestamp;
  createdAt: Timestamp;
}

export interface PregnancyWeekInfo {
  week: number;
  babySize: string;
  babyWeight: string;
  babyLength: string;
  motherChanges: string;
  development: string;
  emoji: string;
  tips: string[];
}

// Calcule sarcină — conform planului
export function calculateCurrentWeek(lmpDate: Date): { week: number; day: number } {
  const now = new Date();
  const diffMs = now.getTime() - lmpDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const week = Math.floor(diffDays / 7);
  const day = diffDays % 7;
  return { week, day };
}

export function calculateDueDate(lmpDate: Date): Date {
  // Regula Naegele: LMP + 280 zile
  return new Date(lmpDate.getTime() + 280 * 24 * 60 * 60 * 1000);
}

export function getTrimester(week: number): 1 | 2 | 3 {
  if (week <= 13) return 1;
  if (week <= 27) return 2;
  return 3;
}
