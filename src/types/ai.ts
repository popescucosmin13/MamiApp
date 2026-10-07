import type { Timestamp } from 'firebase/firestore';

export interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Timestamp;
}

export interface AIConversation {
  id?: string;
  messages: AIMessage[];
  context: 'pregnancy' | 'child';
  childId?: string;
  createdAt: Timestamp;
  lastMessageAt: Timestamp;
}

export interface AISummary {
  id?: string;
  date: Timestamp;
  childId?: string; // sau "pregnancy"
  content: string;
  highlights: string[];
  recommendations: string[];
  generatedAt: Timestamp;
}

export interface AIUsageQuota {
  messagesUsedToday: number;
  maxMessagesPerDay: number; // 10 free, unlimited premium
  summariesGenerated: number;
  lastResetDate: Timestamp;
}
