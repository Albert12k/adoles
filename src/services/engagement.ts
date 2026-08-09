import { collection, doc, getDocs, limit, query, serverTimestamp, Timestamp, updateDoc, where, writeBatch } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

export interface EngagementMember { userId: string; name: string; risk: 'high' | 'medium' | 'regular'; daysInactive: number; studies: number; attendance: number; quizzes: number; activities: number; engagement: number; lastContactAt?: Date; lastOutcome?: EngagementOutcome; }
export type EngagementOutcome = 'contacted' | 'no_response' | 'reengaged';
export interface EngagementFollowUp { id: string; classId: string; userId: string; userName: string; riskAtContact: string; outcome: EngagementOutcome; note: string; lastContactAt?: Date; nextFollowUpAt?: Date; resolved: boolean; }

const toDate = (value: unknown) => value && typeof (value as { toDate?: () => Date }).toDate === 'function' ? (value as { toDate: () => Date }).toDate() : null;

export async function listClassEngagement(selectedClassId?: string): Promise<{ classId: string; members: EngagementMember[] }> {
  if (!db || !auth?.currentUser) return { classId: '', members: [] };
  const classes = await getDocs(query(collection(db, 'classes'), where('directorIds', 'array-contains', auth.currentUser.uid), limit(10)));
  if (classes.empty) return { classId: '', members: [] };
  const selected = selectedClassId ? classes.docs.find(item => item.id === selectedClassId) : classes.docs[0];
  if (!selected) return { classId: '', members: [] };
  const classId = selected.id;
  const [members, studies, attendance, quizzes, activities, followUps] = await Promise.all([
    getDocs(query(collection(db, 'classMembers'), where('classId', '==', classId), where('active', '==', true))),
    getDocs(query(collection(db, 'studyRecords'), where('classId', '==', classId))),
    getDocs(query(collection(db, 'attendance'), where('classId', '==', classId))),
    getDocs(query(collection(db, 'quizAttempts'), where('classId', '==', classId), where('status', '==', 'reviewed'))),
    getDocs(query(collection(db, 'activityParticipants'), where('classId', '==', classId))),
    getDocs(query(collection(db, 'engagementFollowUps'), where('classId', '==', classId))),
  ]);
  const now = Date.now(); const windowStart = now - 13 * 7 * 86400000;
  const result = members.docs.filter(item => item.data().role !== 'director').map(member => {
    const userId = String(member.data().userId);
    const userStudies = studies.docs.filter(item => item.data().userId === userId && (toDate(item.data().createdAt)?.getTime() ?? 0) >= windowStart);
    const userAttendance = attendance.docs.filter(item => item.data().userId === userId && item.data().status === 'approved' && (toDate(item.data().createdAt)?.getTime() ?? 0) >= windowStart);
    const userQuizzes = quizzes.docs.filter(item => item.data().userId === userId && (toDate(item.data().createdAt)?.getTime() ?? 0) >= windowStart);
    const userActivities = activities.docs.filter(item => item.data().userId === userId && item.data().status === 'attended' && (toDate(item.data().reviewedAt)?.getTime() ?? 0) >= windowStart);
    const dates = [...userStudies.map(item => toDate(item.data().createdAt)), ...userAttendance.map(item => toDate(item.data().createdAt)), ...userQuizzes.map(item => toDate(item.data().createdAt)), ...userActivities.map(item => toDate(item.data().reviewedAt))].filter((date): date is Date => !!date);
    const last = dates.sort((a, b) => b.getTime() - a.getTime())[0];
    const daysInactive = last ? Math.floor((now - last.getTime()) / 86400000) : 999;
    const risk = daysInactive >= 21 ? 'high' : daysInactive >= 14 ? 'medium' : 'regular';
    const engagement = Math.min(100, userStudies.length * 8 + userAttendance.length * 8 + userQuizzes.length * 10 + userActivities.length * 12);
    const lastFollowUp = followUps.docs.filter(item => item.data().userId === userId).sort((a, b) => Number(toDate(b.data().lastContactAt)?.getTime() ?? 0) - Number(toDate(a.data().lastContactAt)?.getTime() ?? 0))[0]?.data();
    return { userId, name: member.data().name ?? 'Adolescente', risk, daysInactive, studies: userStudies.length, attendance: userAttendance.length, quizzes: userQuizzes.length, activities: userActivities.length, engagement, lastContactAt: toDate(lastFollowUp?.lastContactAt) ?? undefined, lastOutcome: lastFollowUp?.outcome } as EngagementMember;
  }).sort((a, b) => b.daysInactive - a.daysInactive);
  return { classId, members: result };
}

export async function recordEngagementFollowUp(classId: string, member: EngagementMember, input: { outcome: EngagementOutcome; note: string; nextFollowUpDays?: number }) {
  if (!db || !auth?.currentUser) throw new Error('Entre novamente para registrar o acompanhamento.');
  const existing = await getDocs(query(collection(db, 'engagementFollowUps'), where('classId', '==', classId)));
  const batch = writeBatch(db);
  existing.docs.filter(item => item.data().userId === member.userId && item.data().resolved !== true).forEach(item => batch.update(item.ref, { resolved: true, resolvedAt: serverTimestamp(), resolvedBy: auth!.currentUser!.uid }));
  const followUpDays = Number(input.nextFollowUpDays ?? (input.outcome === 'no_response' ? 3 : input.outcome === 'contacted' ? 7 : 14));
  const nextFollowUpAt = followUpDays > 0 ? Timestamp.fromDate(new Date(Date.now() + followUpDays * 86400000)) : null;
  batch.set(doc(collection(db, 'engagementFollowUps')), { classId, userId: member.userId, userName: member.name, riskAtContact: member.risk, outcome: input.outcome, note: input.note.trim().slice(0, 500), nextFollowUpAt, resolved: !nextFollowUpAt, contactedBy: auth.currentUser.uid, lastContactAt: serverTimestamp() });
  await batch.commit();
}

export async function listEngagementFollowUps(classId: string): Promise<EngagementFollowUp[]> {
  if (!db || !auth?.currentUser || !classId) return [];
  const result = await getDocs(query(collection(db, 'engagementFollowUps'), where('classId', '==', classId)));
  return result.docs.map(item => ({ id: item.id, classId: String(item.data().classId), userId: String(item.data().userId), userName: String(item.data().userName ?? 'Adolescente'), riskAtContact: String(item.data().riskAtContact ?? 'regular'), outcome: item.data().outcome as EngagementOutcome, note: String(item.data().note ?? ''), lastContactAt: toDate(item.data().lastContactAt) ?? undefined, nextFollowUpAt: toDate(item.data().nextFollowUpAt) ?? undefined, resolved: item.data().resolved === true || !item.data().nextFollowUpAt })).sort((a, b) => Number(b.lastContactAt?.getTime() ?? 0) - Number(a.lastContactAt?.getTime() ?? 0));
}

export async function resolveEngagementFollowUp(item: EngagementFollowUp) {
  if (!db || !auth?.currentUser) throw new Error('Entre novamente para concluir o retorno.');
  await updateDoc(doc(db, 'engagementFollowUps', item.id), { resolved: true, resolvedAt: serverTimestamp(), resolvedBy: auth.currentUser.uid });
}
