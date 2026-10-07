import { pregnancyDataEn } from './en';
import { pregnancyDataRo } from './ro';
import { PregnancyData, WeekEntry } from './types';

export type * from './types';

export function getPregnancyData(language: string): PregnancyData {
  if (language === 'en') {
    return pregnancyDataEn;
  }
  return pregnancyDataRo;
}

export function getPregnancyWeekData(week: number, language: string): WeekEntry {
  const data = getPregnancyData(language);
  const clamped = Math.max(4, Math.min(40, week));
  return data.WEEKS[clamped] ?? data.WEEKS[20];
}
