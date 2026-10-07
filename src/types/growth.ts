import type { Timestamp } from 'firebase/firestore';

export interface MeasurementRecord {
  id?: string;
  date: Timestamp;
  weight?: number; // kg
  height?: number; // cm
  headCircumference?: number; // cm
  ageMonths: number; // calculat la moment
  percentile?: {
    weight?: number;
    height?: number;
    head?: number;
  };
  notes?: string;
}

export interface GrowthStats {
  lastWeight?: number;
  lastHeight?: number;
  lastHead?: number;
  weightChange?: number; // față de măsurătoarea anterioară
  heightChange?: number;
  lastMeasurementDate?: Timestamp;
}

// WHO LMS growth data structure
export interface WHOGrowthData {
  gender: 'male' | 'female';
  metric: 'weight' | 'height' | 'head';
  ageMonths: number;
  L: number;
  M: number;
  S: number;
  SD3neg: number; // P3
  SD2neg: number; // P15
  SD0: number;    // P50
  SD2: number;    // P85
  SD3: number;    // P97
}

export function calculateZScore(value: number, L: number, M: number, S: number): number {
  if (L !== 0) {
    return (Math.pow(value / M, L) - 1) / (L * S);
  }
  return Math.log(value / M) / S;
}

export function zScoreToPercentile(z: number): number {
  // Approximation of cumulative distribution function
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z >= 0 ? (1 - p) * 100 : p * 100;
}
