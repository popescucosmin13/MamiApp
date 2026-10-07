import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
  where,
  Timestamp,
  doc,
  deleteDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import { FeedRecord, FeedingStats } from '../types/feeding';

const feedDocRef = (userId: string, childId: string, feedId: string) =>
  doc(db, 'users', userId, 'children', childId, 'feeds', feedId);

const feedsRef = (userId: string, childId: string) =>
  collection(db, 'users', userId, 'children', childId, 'feeds');

function startOfToday(): Timestamp {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return Timestamp.fromDate(d);
}

export const feedingService = {
  async addFeed(userId: string, childId: string, feed: Omit<FeedRecord, 'id'>): Promise<string> {
    const ref = await addDoc(feedsRef(userId, childId), feed);
    return ref.id;
  },

  async deleteFeed(userId: string, childId: string, feedId: string): Promise<void> {
    await deleteDoc(feedDocRef(userId, childId, feedId));
  },

  async updateFeed(
    userId: string,
    childId: string,
    feedId: string,
    data: Partial<Omit<FeedRecord, 'id'>>
  ): Promise<void> {
    await updateDoc(feedDocRef(userId, childId, feedId), data);
  },

  async getFeedsToday(userId: string, childId: string): Promise<FeedRecord[]> {
    const q = query(
      feedsRef(userId, childId),
      where('timestamp', '>=', startOfToday()),
      orderBy('timestamp', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as FeedRecord));
  },

  async getFeedsRange(
    userId: string,
    childId: string,
    from: Timestamp,
    to: Timestamp
  ): Promise<FeedRecord[]> {
    const q = query(
      feedsRef(userId, childId),
      where('timestamp', '>=', from),
      where('timestamp', '<=', to),
      orderBy('timestamp', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as FeedRecord));
  },

  async getRecentFeeds(userId: string, childId: string, limitN = 20): Promise<FeedRecord[]> {
    const q = query(feedsRef(userId, childId), orderBy('timestamp', 'desc'), limit(limitN));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as FeedRecord));
  },

  calculateStats(feeds: FeedRecord[]): FeedingStats {
    const breastfeeding = feeds.filter((f) => f.type === 'breastfeeding');
    const bottle = feeds.filter((f) => f.type === 'bottle');
    const solid = feeds.filter((f) => f.type === 'solid');
    const durations = breastfeeding.map((f) => f.duration || 0).filter((d) => d > 0);
    const amounts = bottle.map((f) => f.amount || 0).filter((a) => a > 0);
    return {
      totalToday: feeds.length,
      totalBreastfeeding: breastfeeding.length,
      totalBottle: bottle.length,
      totalSolid: solid.length,
      lastFeedTime: feeds[0]?.timestamp,
      avgDurationBreastfeeding:
        durations.length > 0
          ? durations.reduce((a, b) => a + b, 0) / durations.length
          : undefined,
      avgAmountBottle:
        amounts.length > 0
          ? amounts.reduce((a, b) => a + b, 0) / amounts.length
          : undefined,
    };
  },
};
