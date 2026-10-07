import type { Timestamp } from 'firebase/firestore';

export interface DiaperRecord {
  id?: string;
  timestamp: Timestamp;
  type: 'wet' | 'dirty' | 'both' | 'dry';
  color?: string; // pentru dirty
  consistency?: 'liquid' | 'soft' | 'formed' | 'hard';
  notes?: string;
  createdBy: string;
}

export interface DiaperStats {
  totalToday: number;
  wetToday: number;
  dirtyToday: number;
  lastChangeTime?: Timestamp;
}
