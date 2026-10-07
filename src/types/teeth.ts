export type ToothStatus = 'none' | 'partial' | 'erupted';
export type ToothType = 'incisiv' | 'canin' | 'molar';
export type Jaw = 'upper' | 'lower';

export interface ToothDef {
  id: string;
  name: string;
  jaw: Jaw;
  side: 'dreapta' | 'stânga';
  type: ToothType;
  eruptionAge: string;
}

export interface ToothState {
  status: ToothStatus;
  date: string;
  note: string;
}

export interface TeethState {
  [id: string]: ToothState;
}
