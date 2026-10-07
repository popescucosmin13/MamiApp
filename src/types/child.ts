import type { Timestamp } from 'firebase/firestore';

export interface Child {
  id: string;
  ownerId?: string;
  isShared?: boolean;
  name: string;
  avatar?: string; // emoji sau URL
  gender: 'male' | 'female' | 'other';
  birthDate: Timestamp;
  bloodType?: string;
  birthWeight: number; // grame
  birthHeight: number; // cm
  birthHeadCircumference: number; // cm
  apgarScore?: { min1: number; min5: number };
  birthType: 'natural' | 'cesarean' | 'assisted';
  maternityName?: string;
  doctorName?: string;
  isActive: boolean;
  allergies?: string[];
  chronicConditions?: string[];
  doctorInfo?: DoctorInfo;
}

export interface DoctorInfo {
  name: string;
  phone?: string;
  clinic?: string;
  address?: string;
}

export function calculateAge(birthDate: Date): string {
  const now = new Date();
  const months =
    (now.getFullYear() - birthDate.getFullYear()) * 12 +
    (now.getMonth() - birthDate.getMonth());
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  if (years === 0) return `${months} ${months === 1 ? 'lună' : 'luni'}`;
  if (remainingMonths === 0)
    return `${years} ${years === 1 ? 'an' : 'ani'}`;
  return `${years} ${years === 1 ? 'an' : 'ani'} ${remainingMonths} ${remainingMonths === 1 ? 'lună' : 'luni'}`;
}

export function calculateAgeMonths(birthDate: Date): number {
  const now = new Date();
  return (
    (now.getFullYear() - birthDate.getFullYear()) * 12 +
    (now.getMonth() - birthDate.getMonth())
  );
}
