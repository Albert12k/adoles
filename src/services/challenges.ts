import { addDoc, collection, doc, getDocs, limit, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

export interface ClassChallenge { id: string; classId: string; title: string; description: string; evidence: string; bonusPoints: number; status: 'pending' | 'approved' | 'rejected'; reviewerFeedback?: string; resubmissionCount?: number; }

export async function submitClassChallenge(input: { classId?: string; title: string; description: string; evidence: string; bonusPoints: number }) {
  if (!db || !auth?.currentUser) throw new Error('Entre novamente para enviar o desafio.');
  const directed = await getDocs(query(collection(db, 'classes'), where('directorIds', 'array-contains', auth.currentUser.uid), limit(10)));
  if (directed.empty) throw new Error('Nenhuma base está vinculada à sua conta.');
  const classDoc = input.classId ? directed.docs.find(item => item.id === input.classId) : directed.docs[0];
  if (!classDoc) throw new Error('A base selecionada não está vinculada à sua conta.');
  const classData = classDoc.data();
  return addDoc(collection(db, 'challenges'), { classId: classDoc.id, className: classData.name ?? 'Base', districtId: classData.districtId, ageGroup: classData.ageGroup ?? 'adolescentes', title: input.title.trim(), description: input.description.trim(), evidence: input.evidence.trim(), bonusPoints: Math.min(500, Math.max(10, input.bonusPoints)), status: 'pending', createdBy: auth.currentUser.uid, createdAt: serverTimestamp() });
}

export async function listApprovedChallenges(classId: string): Promise<ClassChallenge[]> {
  if (!db || !classId) return [];
  const result = await getDocs(query(collection(db, 'challenges'), where('classId', '==', classId), limit(20)));
  return result.docs.map(item => ({ id: item.id, ...(item.data() as Omit<ClassChallenge, 'id'>) })).filter(item => item.status === 'approved');
}

export async function listDirectedChallenges(selectedClassId?: string): Promise<ClassChallenge[]> {
  if (!db || !auth?.currentUser) return [];
  const directed = await getDocs(query(collection(db, 'classes'), where('directorIds', 'array-contains', auth.currentUser.uid), limit(10)));
  const selected = selectedClassId ? directed.docs.find(item => item.id === selectedClassId) : directed.docs[0];
  if (!selected) return [];
  const result = await getDocs(query(collection(db, 'challenges'), where('classId', '==', selected.id), limit(30)));
  return result.docs.map(item => ({ id: item.id, ...(item.data() as Omit<ClassChallenge, 'id'>) }));
}

export async function resubmitClassChallenge(challenge: ClassChallenge, input: { description: string; evidence: string }) {
  if (!db || !auth?.currentUser) throw new Error('Entre novamente para reenviar o desafio.');
  if (challenge.status !== 'rejected') throw new Error('Somente desafios devolvidos podem ser reenviados.');
  await updateDoc(doc(db, 'challenges', challenge.id), { description: input.description.trim(), evidence: input.evidence.trim(), status: 'pending', reviewerFeedback: '', resubmissionCount: Number(challenge.resubmissionCount ?? 0) + 1, resubmittedAt: serverTimestamp() });
}
