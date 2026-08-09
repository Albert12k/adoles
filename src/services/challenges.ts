import { addDoc, collection, doc, getDoc, getDocs, limit, query, serverTimestamp, where } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

export interface ClassChallenge { id: string; classId: string; title: string; description: string; evidence: string; bonusPoints: number; status: 'pending' | 'approved' | 'rejected'; }

export async function submitClassChallenge(input: { title: string; description: string; evidence: string; bonusPoints: number }) {
  if (!db || !auth?.currentUser) throw new Error('Entre novamente para enviar o desafio.');
  const directed = await getDocs(query(collection(db, 'classes'), where('directorIds', 'array-contains', auth.currentUser.uid), limit(1)));
  if (directed.empty) throw new Error('Nenhuma base está vinculada à sua conta.');
  const classDoc = directed.docs[0];
  const classData = classDoc.data();
  return addDoc(collection(db, 'challenges'), { classId: classDoc.id, className: classData.name ?? 'Base', districtId: classData.districtId, ageGroup: classData.ageGroup ?? 'adolescentes', title: input.title.trim(), description: input.description.trim(), evidence: input.evidence.trim(), bonusPoints: Math.min(500, Math.max(10, input.bonusPoints)), status: 'pending', createdBy: auth.currentUser.uid, createdAt: serverTimestamp() });
}

export async function listApprovedChallenges(classId: string): Promise<ClassChallenge[]> {
  if (!db || !classId) return [];
  const result = await getDocs(query(collection(db, 'challenges'), where('classId', '==', classId), limit(20)));
  return result.docs.map(item => ({ id: item.id, ...(item.data() as Omit<ClassChallenge, 'id'>) })).filter(item => item.status === 'approved');
}
