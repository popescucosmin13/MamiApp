import type { Timestamp } from 'firebase/firestore';

export type NotificationType =
  | 'vaccine'
  | 'appointment'
  | 'feeding'
  | 'sleep_routine'
  | 'ai_summary'
  | 'milestone'
  | 'family_member'
  | 'community'
  | 'wellbeing';

export interface NotificationRecord {
  id?: string;
  type: NotificationType;
  title: string;
  body: string;
  scheduledFor: Timestamp;
  sent: boolean;
  relatedDocId?: string;
  isCritical?: boolean; // nu poate fi dezactivată
}

export interface DeviceToken {
  token: string;
  platform: 'ios' | 'android';
  registeredAt: Timestamp;
  lastUsed: Timestamp;
}
