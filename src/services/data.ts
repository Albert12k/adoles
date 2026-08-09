import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { auth, cloudFunctions, db, storage } from '../config/firebase';
import type { StudyRecord } from '../domain/models';
import type { LeadershipReport, Quiz, QuizResult } from '../domain/models';

const requireFirestore = () => {
  if (!db) throw new Error('Firebase ainda não foi configurado.');
  return db;
};

export async function requestClassEntry(userId: string, inviteCode: string) {
  const firestore = requireFirestore();
  if (!userId) throw new Error('Entre na sua conta para usar o convite.');
  const code = inviteCode.trim().toUpperCase();
  const invite = await getDoc(doc(firestore, 'classInviteCodes', code));
  if (!invite.exists() || !invite.data().active) throw new Error('Código de convite inválido ou expirado.');
  const classId = invite.data().classId as string;
  const profile = await getDoc(doc(firestore, 'users', userId));
  await setDoc(doc(firestore, 'classJoinRequests', `${classId}_${userId}`), {
    userId, classId, districtId: invite.data().districtId, name: profile.data()?.name ?? 'Adolescente', status: 'pending', createdAt: serverTimestamp(),
  });
  return { classId, className: '' };
}

export async function validateClassInviteCode(inviteCode: string) {
  const firestore = requireFirestore();
  const code = inviteCode.trim().toUpperCase();
  const invite = await getDoc(doc(firestore, 'classInviteCodes', code));
  if (!invite.exists() || !invite.data().active) throw new Error('Código de convite inválido ou expirado.');
  return { code, classId: String(invite.data().classId), className: String(invite.data().className ?? 'Base encontrada'), churchName: String(invite.data().churchName ?? 'Igreja local'), ageGroup: String(invite.data().ageGroup ?? 'adolescentes') };
}

export async function listWeeklyContent(classId: string) {
  const firestore = requireFirestore();
  const result = await getDocs(query(
    collection(firestore, 'weeklyContent'),
    where('classId', '==', classId),
    orderBy('publishedAt', 'desc'),
    limit(13),
  ));
  return result.docs.filter(item => item.data().archived !== true).map(item => ({ id: item.id, ...(item.data() as { title?: string }) }));
}

export async function saveStudy(input: Omit<StudyRecord, 'id' | 'createdAt'> & { userName?: string }) {
  const firestore = requireFirestore();
  const now = new Date(); const dayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const recordRef = doc(firestore, 'studyRecords', `${input.userId}_${dayKey}_${input.source}`);
  await runTransaction(firestore, async transaction => {
    const existing = await transaction.get(recordRef);
    if (existing.exists()) {
      if (existing.data().evaluation !== 'revise' || existing.data().feedbackVisible !== true) throw new Error('Você já registrou este tipo de estudo hoje.');
      transaction.update(recordRef, { summary: input.summary, passage: input.passage ?? null, feedbackVisible: false, evaluation: 'resubmitted', previousFeedback: existing.data().feedback ?? '', score: 0, revisionCount: Number(existing.data().revisionCount ?? 0) + 1, revisedAt: serverTimestamp() });
      return;
    }
    transaction.set(recordRef, { ...input, dayKey, revisionCount: 0, createdAt: serverTimestamp() });
  });
  return recordRef;
}

export async function listMyStudyRecords(userId: string) {
  const firestore = requireFirestore();
  const result = await getDocs(query(collection(firestore, 'studyRecords'), where('userId', '==', userId), orderBy('createdAt', 'desc'), limit(10)));
  return result.docs.map(item => ({ id: item.id, ...(item.data() as { source?: 'lesson' | 'bible' | 'book'; passage?: string; summary?: string; score?: number; evaluation?: string; revisionCount?: number; feedbackVisible?: boolean; feedback?: string; createdAt?: { toDate?: () => Date } }) }));
}

export async function uploadAttendanceEvidence(userId: string, classId: string, localUri: string) {
  if (!storage) throw new Error('Firebase Storage ainda não foi configurado.');
  const response = await fetch(localUri);
  const blob = await response.blob();
  const path = `attendance/${classId}/${userId}/${Date.now()}.jpg`;
  const snapshot = await uploadBytes(ref(storage, path), blob, { contentType: blob.type || 'image/jpeg' });
  return getDownloadURL(snapshot.ref);
}

export async function submitAttendance(input: {
  userId: string;
  classId: string;
  week: number;
  quarter: number;
  year: number;
  evidenceUrl?: string;
  userName?: string;
  districtId?: string;
  ageGroup?: string;
}) {
  const firestore = requireFirestore();
  const record = doc(firestore, 'attendance', `${input.year}_${input.quarter}_${input.week}_${input.userId}`);
  await setDoc(record, {
    ...input,
    evidenceUrl: input.evidenceUrl ?? null,
    status: 'pending',
    createdAt: serverTimestamp(),
  });
  return record;
}

export async function listMyAttendance(userId: string) {
  const firestore = requireFirestore();
  const result = await getDocs(query(collection(firestore, 'attendance'), where('userId', '==', userId), orderBy('createdAt', 'desc'), limit(20)));
  return result.docs.map(item => ({ id: item.id, ...(item.data() as { status?: string; week?: number; quarter?: number; year?: number }) }));
}

export async function reviewAttendance(recordId: string, reviewerId: string, approved: boolean) {
  const firestore = requireFirestore();
  await updateDoc(doc(firestore, 'attendance', recordId), {
    status: approved ? 'approved' : 'rejected',
    reviewedBy: reviewerId,
    reviewedAt: serverTimestamp(),
  });
}

export async function getWeeklyQuiz(classId: string) {
  const firestore = requireFirestore();
  const result = await getDocs(query(collection(firestore, 'quizzes'), where('classId', '==', classId), where('active', '==', true), orderBy('releaseAt', 'desc'), limit(10)));
  const now = Date.now();
  const available = result.docs.find(item => Number(item.data().releaseAt ?? 0) <= now && Number(item.data().closesAt ?? Number.MAX_SAFE_INTEGER) > now);
  return available ? { id: available.id, ...available.data() } as unknown as Quiz : null;
}

export function subscribeToQuizAvailability(quizId: string, callback: (available: boolean) => void) {
  const firestore = requireFirestore();
  return onSnapshot(doc(firestore, 'quizzes', quizId), snapshot => {
    const data = snapshot.data(); const now = Date.now();
    callback(Boolean(snapshot.exists() && data?.active === true && Number(data.releaseAt ?? 0) <= now && Number(data.closesAt ?? Number.MAX_SAFE_INTEGER) > now));
  });
}

export async function submitQuizAnswers(quizId: string, answers: Array<number | string>) {
  const firestore = requireFirestore();
  if (!auth?.currentUser) throw new Error('Entre novamente para responder.');
  const [quiz, profile] = await Promise.all([getDoc(doc(firestore, 'quizzes', quizId)), getDoc(doc(firestore, 'users', auth.currentUser.uid))]);
  if (!quiz.exists()) throw new Error('Quiz não encontrado.');
  if (!quiz.data().active || Number(quiz.data().releaseAt ?? 0) > Date.now() || Number(quiz.data().closesAt ?? 0) <= Date.now()) throw new Error('Este quiz foi encerrado e não aceita mais respostas.');
  const attemptRef = doc(firestore, 'quizAttempts', `${quizId}_${auth.currentUser.uid}`);
  await setDoc(attemptRef, { quizId, classId: quiz.data().classId, userId: auth.currentUser.uid, userName: profile.data()?.name ?? 'Adolescente', answers, status: 'pending', createdAt: serverTimestamp() });
  return { attemptId: attemptRef.id, correctAnswers: 0, totalQuestions: answers.length, points: 0 } as QuizResult;
}

export async function getMyQuizAttempt(quizId: string) {
  const firestore = requireFirestore();
  if (!auth?.currentUser) return null;
  const snapshot = await getDoc(doc(firestore, 'quizAttempts', `${quizId}_${auth.currentUser.uid}`));
  return snapshot.exists() ? snapshot.data() as { status?: string; score?: number; correct?: boolean; resultPublished?: boolean } : null;
}

export async function getQuizRanking(quizId: string) {
  const firestore = requireFirestore();
  const snapshot = await getDoc(doc(firestore, 'quizRankings', quizId));
  return snapshot.exists() ? snapshot.data() as { published?: boolean; weekLabel?: string; entries?: Array<{ userId: string; name: string; score: number; position: number }> } : null;
}

export async function listQuizRankingHistory(classId: string) {
  const firestore = requireFirestore();
  const result = await getDocs(query(collection(firestore, 'quizRankings'), where('classId', '==', classId), where('published', '==', true), orderBy('publishedAt', 'desc'), limit(13)));
  return result.docs.map(item => ({ id: item.id, ...(item.data() as { weekLabel?: string; entries?: Array<{ userId: string; name: string; score: number; position: number }> }) }));
}

export async function getLeadershipReport(scope: { districtId?: string; classId?: string }) {
  if (!cloudFunctions) throw new Error('Firebase ainda não foi configurado.');
  const report = httpsCallable<typeof scope, LeadershipReport>(cloudFunctions, 'getLeadershipReport');
  return (await report(scope)).data;
}
