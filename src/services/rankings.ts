import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';

export interface RankingEntry { id: string; name: string; points: number; position: number; }
export interface DistrictRankings { individuals: RankingEntry[]; classes: RankingEntry[]; }

const rank = (items: Array<{ id: string; name: string; points: number }>) => {
  const sorted = items.sort((a, b) => b.points - a.points); let last: number | null = null; let position = 0;
  return sorted.map((item, index) => { if (item.points !== last) position = index + 1; last = item.points; return { ...item, position }; });
};

export async function getDistrictRankings(classId: string): Promise<DistrictRankings> {
  if (!db || !classId) return { individuals: [], classes: [] };
  const classSnapshot = await getDoc(doc(db, 'classes', classId));
  const districtId = String(classSnapshot.data()?.districtId ?? '');
  const ageGroup = String(classSnapshot.data()?.ageGroup ?? 'adolescentes');
  if (!districtId) return { individuals: [], classes: [] };
  const quarter = Math.floor(new Date().getMonth() / 3) + 1;
  const year = new Date().getFullYear();
  const snapshots = await getDocs(query(collection(db, 'publishedClassScores'), where('districtId', '==', districtId)));
  const valid = snapshots.docs.map(item => item.data()).filter(item => item.ageGroup === ageGroup && item.quarter === quarter && item.year === year);
  const people = new Map<string, { id: string; name: string; points: number }>();
  const classes = new Map<string, { id: string; name: string; total: number; activeMembers: number }>();
  valid.forEach(snapshot => {
    (snapshot.entries as Array<{ userId: string; name: string; score: number }>).forEach(entry => { const current = people.get(entry.userId) ?? { id: entry.userId, name: entry.name, points: 0 }; current.points += Number(entry.score ?? 0); people.set(entry.userId, current); });
    const currentClass = classes.get(snapshot.classId) ?? { id: snapshot.classId, name: snapshot.className, total: 0, activeMembers: Number(snapshot.activeMembers ?? 1) };
    currentClass.total += (snapshot.entries as Array<{ score: number }>).reduce((sum, entry) => sum + Number(entry.score ?? 0), 0); classes.set(snapshot.classId, currentClass);
  });
  return { individuals: rank([...people.values()]), classes: rank([...classes.values()].map(item => ({ id: item.id, name: item.name, points: Math.round((item.total / Math.max(1, item.activeMembers)) * 100) / 100 }))) };
}
