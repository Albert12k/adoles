import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { cloudFunctions, db, storage } from '../config/firebase';
import type { StudyRecord } from '../domain/models';

const requireFirestore = () => {
  if (!db) throw new Error('Firebase ainda não foi configurado.');
  return db;
};

export async function requestClassEntry(userId: string, inviteCode: string) {
  if (!cloudFunctions) throw new Error('Firebase ainda não foi configurado.');
  if (!userId) throw new Error('Entre na sua conta para usar o convite.');
  const joinClass = httpsCallable<{ inviteCode: string }, { classId: string; className: string }>(cloudFunctions, 'joinClassByCode');
  return (await joinClass({ inviteCode: inviteCode.trim().toUpperCase() })).data;
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

export async function uploadAttendanceEvidence(userId: string, localUri: string) {
  if (!storage) throw new Error('Firebase Storage ainda não foi configurado.');
  const response = await fetch(localUri);
  const blob = await response.blob();
  const path = `attendance/${userId}/${Date.now()}.jpg`;
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
