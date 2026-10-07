import type { Timestamp } from 'firebase/firestore';

export type DocumentType =
  | 'birth_certificate'
  | 'vaccine_card'
  | 'ultrasound'
  | 'analysis'
  | 'prescription'
  | 'discharge_letter'
  | 'other';

export interface DocumentRecord {
  id?: string;
  name: string;
  type: DocumentType;
  fileUrl: string;
  fileName: string;
  mimeType: string;
  size: number; // bytes
  uploadedAt: Timestamp;
  expiresAt?: Timestamp;
  ocrText?: string; // textul extras automat
  tags?: string[];
  childId?: string; // dacă e legat de un copil specific
}
