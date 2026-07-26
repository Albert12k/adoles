import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { cloudFunctions, db, storage } from '../config/firebase';
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
  await setDoc(doc(firestore, 'classJoinRequests', `${classId}_${userId}`), {
    userId, classId, districtId: invite.data().districtId, status: 'pending', createdAt: serverTimestamp(),
  });
  return { classId, className: '' };
}

export async function listWeeklyContent(classId: string) {
  const firestore = requireFirestore();
  const result = await getDocs(query(
    collection(firestore, 'weeklyContent'),
    where('classId', '==', classId),
    orderBy('publishedAt', 'desc'),
    limit(13),
  ));
  return result.docs.map(item => ({ id: item.id, ...item.data() }));
}

export async function saveStudy(input: Omit<StudyRecord, 'id' | 'createdAt'>) {
  const firestore = requireFirestore();
  return addDoc(collection(firestore, 'studyRecords'), {
    ...input,
    createdAt: serverTimestamp(),
  });
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
  evidenceUrl: string;
  districtId?: string;
  ageGroup?: string;
}) {
  const firestore = requireFirestore();
  return addDoc(collection(firestore, 'attendance'), {
    ...input,
    status: 'pending',
    createdAt: serverTimestamp(),
  });
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
  if (!cloudFunctions) throw new Error('Firebase ainda não foi configurado.');
  const loadQuiz = httpsCallable<{ classId: string }, Quiz | null>(cloudFunctions, 'getWeeklyQuiz');
  return (await loadQuiz({ classId })).data;
}

export async function submitQuizAnswers(quizId: string, answers: number[]) {
  if (!cloudFunctions) throw new Error('Firebase ainda não foi configurado.');
  const submit = httpsCallable<{ quizId: string; answers: number[] }, QuizResult>(cloudFunctions, 'submitQuiz');
  return (await submit({ quizId, answers })).data;
}

export async function getLeadershipReport(scope: { districtId?: string; classId?: string }) {
  if (!cloudFunctions) throw new Error('Firebase ainda não foi configurado.');
  const report = httpsCallable<typeof scope, LeadershipReport>(cloudFunctions, 'getLeadershipReport');
  return (await report(scope)).data;
}
