import { collection, doc, getDocs, limit, query, serverTimestamp, setDoc, where, addDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

export interface ClassActivity { id: string; classId: string; title: string; description: string; location: string; dateLabel: string; points: number; active: boolean; participantCount?: number; }

export async function createClassActivity(input: { classId?: string; title: string; description: string; location: string; dateLabel: string; points: number }) {
  if (!db || !auth?.currentUser) throw new Error('Entre novamente para publicar a atividade.');
  const directed = await getDocs(query(collection(db, 'classes'), where('directorIds', 'array-contains', auth.currentUser.uid), limit(10)));
  if (directed.empty) throw new Error('Nenhuma base está vinculada à sua conta.');
  const selected = input.classId ? directed.docs.find(item => item.id === input.classId) : directed.docs[0];
  if (!selected) throw new Error('A base selecionada não está vinculada à sua conta.');
  return addDoc(collection(db, 'classActivities'), { classId: selected.id, title: input.title.trim(), description: input.description.trim(), location: input.location.trim(), dateLabel: input.dateLabel.trim(), points: Math.min(100, Math.max(0, input.points)), active: true, createdBy: auth.currentUser.uid, createdAt: serverTimestamp() });
}

export async function listClassActivities(classId: string): Promise<ClassActivity[]> {
  if (!db || !classId) return [];
  const result = await getDocs(query(collection(db, 'classActivities'), where('classId', '==', classId), limit(30)));
  return result.docs.map(item => ({ id: item.id, ...(item.data() as Omit<ClassActivity, 'id'>) })).filter(item => item.active);
}

export async function joinClassActivity(activity: ClassActivity, userName: string) {
  if (!db || !auth?.currentUser) throw new Error('Entre novamente para confirmar sua participação.');
  await setDoc(doc(db, 'activityParticipants', `${activity.id}_${auth.currentUser.uid}`), { activityId: activity.id, classId: activity.classId, userId: auth.currentUser.uid, userName, points: activity.points, status: 'confirmed', confirmedAt: serverTimestamp() });
}

export async function listDirectedActivities(selectedClassId?: string): Promise<ClassActivity[]> {
  if (!db || !auth?.currentUser) return [];
  const directed = await getDocs(query(collection(db, 'classes'), where('directorIds', 'array-contains', auth.currentUser.uid), limit(10)));
  if (directed.empty) return [];
  const selected = selectedClassId ? directed.docs.find(item => item.id === selectedClassId) : directed.docs[0];
  if (!selected) return [];
  const activities = await listClassActivities(selected.id);
  return Promise.all(activities.map(async activity => {
    const participants = await getDocs(query(collection(db!, 'activityParticipants'), where('activityId', '==', activity.id), limit(100)));
    return { ...activity, participantCount: participants.size };
  }));
}
