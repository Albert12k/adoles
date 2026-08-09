import { useEffect, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { auth, db, firebaseEnabled } from '../config/firebase';

export interface LiveNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  createdAt?: Date;
}

export interface LiveRanking {
  id: string;
  className: string;
  normalizedScore: number;
}

export function useLiveDashboard() {
  const [notifications, setNotifications] = useState<LiveNotification[]>([]);
  const [rankings, setRankings] = useState<LiveRanking[]>([]);
  const [points, setPoints] = useState<number | null>(null);

  useEffect(() => {
    const user = auth?.currentUser;
    if (!firebaseEnabled || !db || !user) return;
    const unsubscribeNotifications = onSnapshot(query(collection(db, 'notifications'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'), limit(20)), snapshot => {
      setNotifications(snapshot.docs.map(item => ({ id: item.id, ...(item.data() as Omit<LiveNotification, 'id' | 'createdAt'>), createdAt: item.data().createdAt?.toDate?.() })));
    });
    const unsubscribeScores = onSnapshot(query(collection(db, 'scores'), where('userId', '==', user.uid), orderBy('createdAt', 'desc')), snapshot => {
      setPoints(snapshot.docs.reduce((total, item) => total + Number(item.data().points ?? 0), 0));
    });
    const unsubscribeRanking = onSnapshot(query(collection(db, 'classRankings'), orderBy('normalizedScore', 'desc'), limit(10)), snapshot => {
      setRankings(snapshot.docs.map(item => ({ id: item.id, className: item.data().className ?? item.id, normalizedScore: Number(item.data().normalizedScore ?? 0) })));
    });
    return () => { unsubscribeNotifications(); unsubscribeScores(); unsubscribeRanking(); };
  }, []);

  return { notifications, rankings, points };
}
