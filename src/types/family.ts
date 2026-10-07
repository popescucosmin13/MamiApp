import type { Timestamp } from 'firebase/firestore';

export interface SharedAccess {
  primaryUserId: string;
  childIds: string[];
  permissions: FamilyPermissionsMap;
  grantedAt: Timestamp;
}

export interface FamilyPermissionsMap {
  canViewChildren: boolean;
  canEditFeeding: boolean;
  canEditSleep: boolean;
  canEditDiapers: boolean;
  canViewMedical: boolean;
  canViewDocuments: boolean;
  canViewWellbeing: boolean;
}

export const ROLE_PERMISSIONS: Record<string, FamilyPermissionsMap> = {
  father: {
    canViewChildren: true,
    canEditFeeding: true,
    canEditSleep: true,
    canEditDiapers: true,
    canViewMedical: false,
    canViewDocuments: false,
    canViewWellbeing: false,
  },
  grandparent: {
    canViewChildren: true,
    canEditFeeding: false,
    canEditSleep: false,
    canEditDiapers: false,
    canViewMedical: false,
    canViewDocuments: false,
    canViewWellbeing: false,
  },
  nanny: {
    canViewChildren: true,
    canEditFeeding: true,
    canEditSleep: true,
    canEditDiapers: true,
    canViewMedical: false,
    canViewDocuments: false,
    canViewWellbeing: false,
  },
  doctor: {
    canViewChildren: true,
    canEditFeeding: false,
    canEditSleep: false,
    canEditDiapers: false,
    canViewMedical: true,
    canViewDocuments: true,
    canViewWellbeing: false,
  },
};
