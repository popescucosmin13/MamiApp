import type { Timestamp } from 'firebase/firestore';

export interface CommunityGroup {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  category: string;
  location?: string;
  moderators: string[]; // userIds
  createdAt: Timestamp;
  emoji: string;
}

export interface CommunityPost {
  id?: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  content: string;
  mediaUrls?: string[];
  likes: number;
  commentsCount: number;
  isAnonymous: boolean;
  createdAt: Timestamp;
  isVerifiedAuthor: boolean; // medic, specialist verificat
  groupId: string;
}

export interface PostComment {
  id?: string;
  authorId: string;
  authorName: string;
  content: string;
  likes: number;
  createdAt: Timestamp;
}
