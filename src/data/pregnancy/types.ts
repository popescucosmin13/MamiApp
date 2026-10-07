export interface WeekEntry {
  baby: string;
  babySize: string;
  babyFruit: string;
  babyEmoji: string;
  babyLength: string;
  babyWeight: string;
  mother: string;
  symptoms: string[];
  tips: string[];
  doctorQuestions: string[];
  checklist: string[];
}

export interface PregnancyData {
  WEEKS: Record<number, WeekEntry>;
  CHECKLIST_T1: string[];
  CHECKLIST_T2: string[];
  CHECKLIST_T3: string[];
  WATCH_SYMPTOMS: string[];
}
