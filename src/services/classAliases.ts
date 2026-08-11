import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';

export async function getEquivalentClassIds(classId: string): Promise<string[]> {
  if (!db || !classId) return classId ? [classId] : [];
  const selected = await getDoc(doc(db, 'classes', classId));
  if (!selected.exists()) return [classId];
  const data = selected.data();
  if (!data.churchId) return [classId];
  const siblings = await getDocs(query(collection(db, 'classes'), where('churchId', '==', data.churchId)));
  const normalizedName = String(data.name ?? '').trim().toLowerCase();
  const ids = siblings.docs.filter(item => {
    const sibling = item.data();
    return sibling.active !== false && sibling.ageGroup === data.ageGroup && String(sibling.name ?? '').trim().toLowerCase() === normalizedName;
  }).map(item => item.id);
  return ids.includes(classId) ? ids : [classId, ...ids];
}
