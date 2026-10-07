import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from './firebase';

export interface SavedAIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface SavedAIConversation {
  id: string;
  title: string;
  preview: string;
  context: 'pregnancy' | 'child';
  messages: SavedAIMessage[];
  messageCount: number;
  createdAt?: Date;
  lastMessageAt?: Date;
  updatedAt?: Date;
}

function toDate(value: unknown): Date | undefined {
  if (!value) return undefined;
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    return (value as { toDate: () => Date }).toDate();
  }
  const parsed = new Date(value as string);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function serializeMessages(messages: SavedAIMessage[]) {
  return messages.map((message) => ({
    ...message,
    timestamp: message.timestamp,
  }));
}

function parseConversation(id: string, data: Record<string, any>): SavedAIConversation {
  return {
    id,
    title: data.title || 'Conversatie AI',
    preview: data.preview || '',
    context: data.context === 'pregnancy' ? 'pregnancy' : 'child',
    messages: Array.isArray(data.messages)
      ? data.messages.map((message: any, index: number) => ({
          id: String(message.id || `${id}-${index}`),
          role: message.role === 'user' ? 'user' : 'assistant',
          content: String(message.content || ''),
          timestamp: toDate(message.timestamp) || new Date(),
        }))
      : [],
    messageCount: Number(data.messageCount || data.messages?.length || 0),
    createdAt: toDate(data.createdAt),
    lastMessageAt: toDate(data.lastMessageAt),
    updatedAt: toDate(data.updatedAt),
  };
}

export const aiService = {
  async listConversations(userId: string): Promise<SavedAIConversation[]> {
    const ref = collection(db, 'users', userId, 'ai_conversations');
    const snap = await getDocs(query(ref, orderBy('lastMessageAt', 'desc'), limit(30)));
    return snap.docs.map((item) => parseConversation(item.id, item.data()));
  },

  async createConversation(
    userId: string,
    payload: Omit<SavedAIConversation, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    const ref = collection(db, 'users', userId, 'ai_conversations');
    const docRef = await addDoc(ref, {
      ...payload,
      messages: serializeMessages(payload.messages),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  },

  async updateConversation(
    userId: string,
    conversationId: string,
    payload: Pick<SavedAIConversation, 'title' | 'preview' | 'context' | 'messages' | 'messageCount' | 'lastMessageAt'>
  ): Promise<void> {
    await updateDoc(doc(db, 'users', userId, 'ai_conversations', conversationId), {
      ...payload,
      messages: serializeMessages(payload.messages),
      updatedAt: serverTimestamp(),
    });
  },

  async deleteConversation(userId: string, conversationId: string): Promise<void> {
    await deleteDoc(doc(db, 'users', userId, 'ai_conversations', conversationId));
  },
};
