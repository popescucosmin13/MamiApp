import type { Timestamp } from 'firebase/firestore';

export interface VaccineRecord {
  id?: string;
  name: string;
  type: 'mandatory' | 'recommended';
  ageGroup: string; // ex: "2 months", "12 months"
  ageMonths: number; // pentru calcul programare
  scheduledDate?: Timestamp;
  completedDate?: Timestamp;
  status: 'pending' | 'scheduled' | 'completed' | 'skipped';
  batchNumber?: string;
  doctor?: string;
  reactions?: string;
  documentUrl?: string;
  notes?: string;
}

export interface VaccineCalendarEntry {
  name: string;
  ageGroup: string;
  ageMonths: number;
  type: 'mandatory' | 'recommended';
  description: string;
  sideEffects: string[];
}

// Calendarul național de vaccinare RO (sursă INSP, actualizat 2024)
export const VACCINE_CALENDAR_RO: VaccineCalendarEntry[] = [
  {
    name: 'Hepatita B (HepB)',
    ageGroup: 'La naștere',
    ageMonths: 0,
    type: 'mandatory',
    description: 'Administrat în maternitate în primele 24 ore de viață.',
    sideEffects: ['Ușoară durere la locul injecției', 'Subfebrilitate'],
  },
  {
    name: 'BCG (Tuberculoză)',
    ageGroup: 'La naștere',
    ageMonths: 0,
    type: 'mandatory',
    description: 'Administrat în maternitate, protejează împotriva formelor grave de tuberculoză.',
    sideEffects: ['Reacție locală specifică (nodul, ulcerație care se vindecă cu cicatrice)'],
  },
  {
    name: 'Hexavalent doza 1 (DTPa-VPI-Hib-HepB)',
    ageGroup: '2 luni',
    ageMonths: 2,
    type: 'mandatory',
    description: 'Protejează împotriva difteriei, tetanosului, pertussis, poliomielitei, Haemophilus influenzae tip b și hepatitei B.',
    sideEffects: ['Durere locală', 'Roșeață', 'Febră moderată', 'Iritabilitate'],
  },
  {
    name: 'Pneumococic PCV13 doza 1',
    ageGroup: '2 luni',
    ageMonths: 2,
    type: 'mandatory',
    description: 'Protejează împotriva pneumoniei, meningitei și sepsisului cauzate de pneumococ.',
    sideEffects: ['Durere locală', 'Febră', 'Iritabilitate'],
  },
  {
    name: 'Rotavirus doza 1',
    ageGroup: '2 luni',
    ageMonths: 2,
    type: 'recommended',
    description: 'Vaccin oral. Protejează împotriva gastroenteritei cu rotavirus. Se administrează opțional.',
    sideEffects: ['Iritabilitate ușoară', 'Diaree ușoară temporară'],
  },
  {
    name: 'Meningococic B doza 1 (Bexsero)',
    ageGroup: '2 luni',
    ageMonths: 2,
    type: 'recommended',
    description: 'Protejează împotriva meningitei cauzate de meningococul de grup B. (Opțional)',
    sideEffects: ['Febră', 'Durere la locul injecției', 'Somnolență'],
  },
  {
    name: 'Hexavalent doza 2',
    ageGroup: '4 luni',
    ageMonths: 4,
    type: 'mandatory',
    description: 'A doua doză din schema Hexavalent.',
    sideEffects: ['Durere locală', 'Febră'],
  },
  {
    name: 'Pneumococic PCV13 doza 2',
    ageGroup: '4 luni',
    ageMonths: 4,
    type: 'mandatory',
    description: 'A doua doză din schema PCV13.',
    sideEffects: ['Durere locală', 'Febră'],
  },
  {
    name: 'Rotavirus doza 2',
    ageGroup: '4 luni',
    ageMonths: 4,
    type: 'recommended',
    description: 'A doua doză de vaccin oral rotavirus.',
    sideEffects: ['Iritabilitate ușoară'],
  },
  {
    name: 'Meningococic B doza 2 (Bexsero)',
    ageGroup: '4 luni',
    ageMonths: 4,
    type: 'recommended',
    description: 'A doua doză de vaccin meningococic B. (Opțional)',
    sideEffects: ['Febră', 'Durere locală'],
  },
  {
    name: 'Antigripal (sezonier)',
    ageGroup: '6+ luni',
    ageMonths: 6,
    type: 'recommended',
    description: 'Recomandat anual în sezonul rece pentru toți copiii peste 6 luni. (Opțional)',
    sideEffects: ['Durere locală', 'Febră ușoară', 'Dureri musculare'],
  },
  {
    name: 'Hexavalent doza 3 (rapel)',
    ageGroup: '11 luni',
    ageMonths: 11,
    type: 'mandatory',
    description: 'Doza de rapel din schema Hexavalent.',
    sideEffects: ['Durere locală', 'Febră', 'Iritabilitate'],
  },
  {
    name: 'Pneumococic PCV13 doza 3 (rapel)',
    ageGroup: '11 luni',
    ageMonths: 11,
    type: 'mandatory',
    description: 'Doza de rapel din schema PCV13.',
    sideEffects: ['Durere locală', 'Febră'],
  },
  {
    name: 'ROR doza 1 (Rujeolă-Oreion-Rubeolă)',
    ageGroup: '12 luni',
    ageMonths: 12,
    type: 'mandatory',
    description: 'Protejează împotriva rujeolei, oreionului și rubeolei.',
    sideEffects: ['Febră 5-12 zile după vaccinare', 'Erupție cutanată ușoară', 'Tumefacție ganglionară'],
  },
  {
    name: 'Meningococic ACWY (Nimenrix)',
    ageGroup: '12 luni',
    ageMonths: 12,
    type: 'recommended',
    description: 'Protejează împotriva meningococului de tip A, C, W, Y. (Opțional)',
    sideEffects: ['Febră ușoară', 'Eritem local'],
  },
  {
    name: 'Varicelă doza 1',
    ageGroup: '12 luni',
    ageMonths: 12,
    type: 'recommended',
    description: 'Protejează împotriva varicelei. (Opțional)',
    sideEffects: ['Erupție ușoară', 'Febră moderată'],
  },
  {
    name: 'Hepatită A doza 1',
    ageGroup: '12 luni',
    ageMonths: 12,
    type: 'recommended',
    description: 'Protejează împotriva infecției cu virusul hepatitei A. (Opțional)',
    sideEffects: ['Durere locală', 'Febră ușoară'],
  },
  {
    name: 'Varicelă doza 2',
    ageGroup: '6 săptămâni - 3 luni după doza 1',
    ageMonths: 15,
    type: 'recommended',
    description: 'A doua doză de vaccin varicelic. (Opțional)',
    sideEffects: ['Erupție ușoară', 'Febră moderată'],
  },
  {
    name: 'Hepatită A doza 2',
    ageGroup: '6-12 luni după doza 1',
    ageMonths: 18,
    type: 'recommended',
    description: 'A doua doză de vaccin anti-hepatic A. (Opțional)',
    sideEffects: ['Durere locală'],
  },
  {
    name: 'ROR doza 2',
    ageGroup: '5 ani',
    ageMonths: 60,
    type: 'mandatory',
    description: 'A doua doză de ROR, introdusă la vârsta de 5 ani (înainte era la 7 ani).',
    sideEffects: ['Febră moderată'],
  },
  {
    name: 'Tetravalent (DTPa-VPI)',
    ageGroup: '6 ani',
    ageMonths: 72,
    type: 'mandatory',
    description: 'Rapel difterie-tetanos-pertussis-poliomielită.',
    sideEffects: ['Durere locală', 'Febră moderată'],
  },
  {
    name: 'HPV',
    ageGroup: '11-14 ani',
    ageMonths: 132,
    type: 'recommended',
    description: 'Recomandat pentru fete și băieți. Protejează împotriva papilomavirusului uman. (Gratuit cu rețetă compensată în RO)',
    sideEffects: ['Durere locală', 'Amețeală tranzitorie'],
  },
  {
    name: 'dT rapel',
    ageGroup: '14 ani',
    ageMonths: 168,
    type: 'mandatory',
    description: 'Rapel difterie-tetanos la adolescenți.',
    sideEffects: ['Durere locală', 'Oboseală'],
  }
];
