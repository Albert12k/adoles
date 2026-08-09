import { collection, doc, getDocs, limit, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

export interface EngagementMember { userId: string; name: string; risk: 'high' | 'medium' | 'regular'; daysInactive: number; studies: number; attendance: number; quizzes: number; activities: number; engagement: number; }

const toDate = (value: unknown) => value && typeof (value as { toDate?: () => Date }).toDate === 'function' ? (value as { toDate: () => Date }).toDate() : null;

export async function listClassEngagement(selectedClassId?: string): Promise<{ classId: string; members: EngagementMember[] }> {
  if (!db || !auth?.currentUser) return { classId: '', members: [] };
  const classes = await getDocs(query(collection(db, 'classes'), where('directorIds', 'array-contains', auth.currentUser.uid), limit(10)));
  if (classes.empty) return { classId: '', members: [] };
  const selected = selectedClassId ? classes.docs.find(item => item.id === selectedClassId) : classes.docs[0];
  if (!selected) return { classId: '', members: [] };
  const classId = selected.id;
  const [members, studies, attendance, quizzes, activities] = await Promise.all([
    getDocs(query(collection(db, 'classMembers'), where('classId', '==', classId), where('active', '==', true))),
    getDocs(query(collection(db, 'studyRecords'), where('classId', '==', classId))),
    getDocs(query(collection(db, 'attendance'), where('classId', '==', classId))),
    getDocs(query(collection(db, 'quizAttempts'), where('classId', '==', classId), where('status', '==', 'reviewed'))),
    getDocs(query(collection(db, 'activityParticipants'), where('classId', '==', classId))),
  ]);
  const now = Date.now(); const windowStart = now - 13 * 7 * 86400000;
  const result = members.docs.filter(item => item.data().role !== 'director').map(member => {
    const userId = String(member.data().userId);
    const userStudies = studies.docs.filter(item => item.data().userId === userId && (toDate(item.data().createdAt)?.getTime() ?? 0) >= windowStart);
    const userAttendance = attendance.docs.filter(item => item.data().userId === userId && item.data().status === 'approved' && (toDate(item.data().createdAt)?.getTime() ?? 0) >= windowStart);
    const userQuizzes = quizzes.docs.filter(item => item.data().userId === userId && (toDate(item.data().createdAt)?.getTime() ?? 0) >= windowStart);
    const userActivities = activities.docs.filter(item => item.data().userId === userId && item.data().status === 'confirmed' && (toDate(item.data().confirmedAt)?.getTime() ?? 0) >= windowStart);
    const dates = [...userStudies.map(item => toDate(item.data().createdAt)), ...userAttendance.map(item => toDate(item.data().createdAt)), ...userQuizzes.map(item => toDate(item.data().createdAt)), ...userActivities.map(item => toDate(item.data().confirmedAt))].filter((date): date is Date => !!date);
    const last = dates.sort((a, b) => b.getTime() - a.getTime())[0];
    const daysInactive = last ? Math.floor((now - last.getTime()) / 86400000) : 999;
    const risk = daysInactive >= 21 ? 'high' : daysInactive >= 14 ? 'medium' : 'regular';
    const engagement = Math.min(100, userStudies.length * 8 + userAttendance.length * 8 + userQuizzes.length * 10 + userActivities.length * 12);
    return { userId, name: member.data().name ?? 'Adolescente', risk, daysInactive, studies: userStudies.length, attendance: userAttendance.length, quizzes: userQuizzes.length, activities: userActivities.length, engagement } as EngagementMember;
  }).sort((a, b) => b.daysInactive - a.daysInactive);
  return { classId, members: result };
}

export async function recordEngagementFollowUp(classId: string, member: EngagementMember) {
  if (!db || !auth?.currentUser) throw new Error('Entre novamente para registrar o acompanhamento.');
  await setDoc(doc(db, 'engagementFollowUps', `${classId}_${member.userId}`), { classId, userId: member.userId, userName: member.name, riskAtContact: member.risk, contactedBy: auth.currentUser.uid, lastContactAt: serverTimestamp() }, { merge: true });
}
