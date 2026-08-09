import { collection, doc, getDoc, getDocs, limit, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

export type PeriodKind = 'quarter' | 'year';
export interface PeriodEntry { userId: string; name: string; summaries: number; activities: number; correctQuizAnswers: number; attendance: number; points: number; position: number; }
export interface PeriodClosure { id: string; classId: string; className: string; kind: PeriodKind; periodLabel: string; entries: PeriodEntry[]; }

const dateOf = (value: unknown) => value && typeof (value as { toDate?: () => Date }).toDate === 'function' ? (value as { toDate: () => Date }).toDate() : null;

export async function closeCurrentPeriod(kind: PeriodKind): Promise<PeriodClosure> {
  if (!db || !auth?.currentUser) throw new Error('Entre novamente para encerrar o período.');
  const classes = await getDocs(query(collection(db, 'classes'), where('directorIds', 'array-contains', auth.currentUser.uid), limit(1)));
  if (classes.empty) throw new Error('Nenhuma classe foi vinculada ao seu perfil.');
  const classDoc = classes.docs[0];
  const classId = classDoc.id;
  const now = new Date();
  const year = now.getFullYear();
  const quarter = Math.floor(now.getMonth() / 3) + 1;
  const periodKey = kind === 'quarter' ? `${year}-Q${quarter}` : `${year}-YEAR`;
  const closureId = `${classId}_${periodKey}`;
  if ((await getDoc(doc(db, 'periodClosures', closureId))).exists()) throw new Error('Este período já foi encerrado.');
  const start = kind === 'quarter' ? new Date(year, (quarter - 1) * 3, 1) : new Date(year, 0, 1);
  const end = kind === 'quarter' ? new Date(year, quarter * 3, 1) : new Date(year + 1, 0, 1);
  const [members, studies, attendance, attempts] = await Promise.all([
    getDocs(query(collection(db, 'classMembers'), where('classId', '==', classId), where('active', '==', true))),
    getDocs(query(collection(db, 'studyRecords'), where('classId', '==', classId))),
    getDocs(query(collection(db, 'attendance'), where('classId', '==', classId))),
    getDocs(query(collection(db, 'quizAttempts'), where('classId', '==', classId), where('status', '==', 'reviewed'))),
  ]);
  const inPeriod = (value: unknown) => { const date = dateOf(value); return !!date && date >= start && date < end; };
  const entries = members.docs.map(member => {
    const userId = member.data().userId as string;
    const userStudies = studies.docs.filter(item => item.data().userId === userId && inPeriod(item.data().createdAt));
    const userAttendance = attendance.docs.filter(item => item.data().userId === userId && item.data().status === 'approved' && inPeriod(item.data().createdAt));
    const userAttempts = attempts.docs.filter(item => item.data().userId === userId && inPeriod(item.data().createdAt));
    const correctQuizAnswers = userAttempts.reduce((total, item) => total + Number(item.data().correctAnswers ?? 0), 0);
    const summaries = userStudies.length;
    const presence = userAttendance.length;
    return { userId, name: member.data().name ?? 'Adolescente', summaries, activities: summaries + presence + userAttempts.length, correctQuizAnswers, attendance: presence, points: summaries * 20 + presence * 10 + correctQuizAnswers * 10, position: 0 };
  }).sort((a, b) => b.points - a.points);
  let previousPoints: number | null = null;
  let position = 0;
  const ranked = entries.map((entry, index) => { if (entry.points !== previousPoints) position = index + 1; previousPoints = entry.points; return { ...entry, position }; });
  const periodLabel = kind === 'quarter' ? `${quarter}º trimestre de ${year}` : `Ano de ${year}`;
  const closure = { classId, className: classDoc.data().name, kind, periodKey, periodLabel, entries: ranked, closedBy: auth.currentUser.uid, closedAt: serverTimestamp() };
  await setDoc(doc(db, 'periodClosures', closureId), closure);
  return { id: closureId, classId, className: classDoc.data().name, kind, periodLabel, entries: ranked };
}
