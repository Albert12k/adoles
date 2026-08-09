import { collection, doc, getDoc, getDocs, limit, query, serverTimestamp, setDoc, updateDoc, where, addDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

export interface ActivityParticipant { userId: string; userName: string; status: 'registered' | 'attended' | 'cancelled'; }
export interface ClassActivity { id: string; classId: string; title: string; description: string; location: string; dateLabel: string; points: number; active: boolean; participantCount?: number; attendedCount?: number; participants?: ActivityParticipant[]; }

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
  const reference = doc(db, 'activityParticipants', `${activity.id}_${auth.currentUser.uid}`);
  if ((await getDoc(reference)).exists()) await updateDoc(reference, { points: 0, status: 'registered', registeredAt: serverTimestamp() });
  else await setDoc(reference, { activityId: activity.id, classId: activity.classId, userId: auth.currentUser.uid, userName, points: 0, status: 'registered', registeredAt: serverTimestamp() });
}

export async function cancelClassActivityRegistration(activityId: string) {
  if (!db || !auth?.currentUser) throw new Error('Entre novamente para cancelar sua inscrição.');
  await updateDoc(doc(db, 'activityParticipants', `${activityId}_${auth.currentUser.uid}`), { status: 'cancelled', points: 0, updatedAt: serverTimestamp() });
}

export async function listMyActivityRegistrations() {
  if (!db || !auth?.currentUser) return [] as Array<{ activityId: string; status: string }>;
  const result = await getDocs(query(collection(db, 'activityParticipants'), where('userId', '==', auth.currentUser.uid)));
  return result.docs.map(item => ({ activityId: String(item.data().activityId), status: String(item.data().status) })).filter(item => item.status !== 'cancelled');
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
    const list = participants.docs.map(item => ({ userId: String(item.data().userId), userName: String(item.data().userName ?? 'Adolescente'), status: item.data().status as ActivityParticipant['status'] })).filter(item => item.status !== 'cancelled');
    return { ...activity, participantCount: list.length, attendedCount: list.filter(item => item.status === 'attended').length, participants: list };
  }));
}

export async function updateClassActivity(activityId: string, input: { title: string; description: string; location: string; dateLabel: string; points: number }) {
  if (!db || !auth?.currentUser) throw new Error('Entre novamente para editar a atividade.');
  await updateDoc(doc(db, 'classActivities', activityId), { title: input.title.trim(), description: input.description.trim(), location: input.location.trim(), dateLabel: input.dateLabel.trim(), points: Math.min(100, Math.max(0, input.points)), updatedBy: auth.currentUser.uid, updatedAt: serverTimestamp() });
}

export async function closeClassActivity(activityId: string) {
  if (!db || !auth?.currentUser) throw new Error('Entre novamente para encerrar a atividade.');
  await updateDoc(doc(db, 'classActivities', activityId), { active: false, closedBy: auth.currentUser.uid, closedAt: serverTimestamp() });
}

export async function confirmClassActivityAttendance(activity: ClassActivity, userId: string, attended: boolean) {
  if (!db || !auth?.currentUser) throw new Error('Entre novamente para confirmar a presença.');
  await updateDoc(doc(db, 'activityParticipants', `${activity.id}_${userId}`), { status: attended ? 'attended' : 'registered', points: attended ? activity.points : 0, reviewedBy: auth.currentUser.uid, reviewedAt: serverTimestamp() });
}
