import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

export type SupportTicketCategory = 'feedback' | 'bug' | 'idea' | 'account' | 'other';

export interface CreateSupportTicketInput {
  userId: string;
  userEmail?: string | null;
  userName?: string | null;
  subject: string;
  message: string;
  category: SupportTicketCategory;
}

export const supportService = {
  async createTicket(input: CreateSupportTicketInput): Promise<string> {
    const ref = await addDoc(collection(db, 'supportTickets'), {
      userId: input.userId,
      userEmail: input.userEmail ?? '',
      userName: input.userName ?? '',
      subject: input.subject.trim(),
      message: input.message.trim(),
      category: input.category,
      status: 'open',
      priority: input.category === 'bug' ? 'medium' : 'low',
      source: 'mobile_app',
      platform: Platform.OS,
      appVersion: Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? '',
      appBuildVersion:
        Platform.OS === 'android'
          ? Constants.expoConfig?.android?.versionCode?.toString() ?? ''
          : Constants.expoConfig?.ios?.buildNumber ?? Constants.nativeBuildVersion ?? '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return ref.id;
  },
};
