import { httpsCallable } from 'firebase/functions';
import { arrayUnion, doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { auth, cloudFunctions, db } from '../config/firebase';

const requireFunctions = () => {
  if (!cloudFunctions) throw new Error('Firebase ainda não foi configurado.');
  return cloudFunctions;
};

export async function publishContent(input: { title: string; classId?: string; lessonPdfUrl?: string; bookPdfUrl?: string; week?: number; quarter?: number; year?: number }) {
  const callable = httpsCallable<typeof input, { contentId: string }>(requireFunctions(), 'publishWeeklyContent');
  return (await callable(input)).data;
}

export async function publishQuizContent(input: {
  title: string;
  classId?: string;
  releaseAt: number;
  closesAt: number;
  questions: Array<{ prompt: string; options: string[]; correctIndex: number }>;
}) {
  const callable = httpsCallable<typeof input, { quizId: string }>(requireFunctions(), 'publishQuiz');
  return (await callable(input)).data;
}

export async function reviewLeadershipItem(type: 'attendance' | 'challenge' | 'roleRequest', itemId: string, approved: boolean) {
  if (type === 'roleRequest') {
    if (!db || !auth?.currentUser) throw new Error('Entre novamente para aprovar a solicitação.');
    await runTransaction(db, async transaction => {
      const requestRef = doc(db!, 'roleRequests', itemId);
      const requestSnapshot = await transaction.get(requestRef);
      if (!requestSnapshot.exists()) throw new Error('Solicitação não encontrada.');
      const request = requestSnapshot.data();
      if (request.status !== 'pending') throw new Error('Esta solicitação já foi analisada.');
      if (approved) {
        const userRef = doc(db!, 'users', request.userId);
        if (request.requestedRole === 'director') {
          if (!request.classId) throw new Error('A solicitação não possui uma classe válida.');
          transaction.update(userRef, { role: 'director', districtId: request.districtId, classIds: arrayUnion(request.classId) });
          transaction.update(doc(db!, 'classes', request.classId), { directorIds: arrayUnion(request.userId) });
        } else if (request.requestedRole === 'coordinator') {
          transaction.update(userRef, { role: 'coordinator', districtId: request.districtId });
        }
      }
      transaction.update(requestRef, {
        status: approved ? 'approved' : 'rejected', reviewedBy: auth!.currentUser!.uid, reviewedAt: serverTimestamp(),
      });
    });
    return { status: approved ? 'approved' : 'rejected' };
  }
  const callable = httpsCallable<{ type: string; itemId: string; approved: boolean }, { status: string }>(requireFunctions(), 'reviewLeadershipItem');
  return (await callable({ type, itemId, approved })).data;
}

export async function manageClassMembership(input: { action: 'regenerateCode' | 'removeMember' | 'transferLeadership' | 'revokeDirector'; classId: string; targetUserId?: string }) {
  const callable = httpsCallable<typeof input, { success?: boolean; inviteCode?: string; className?: string }>(requireFunctions(), 'manageClassMembership');
  return (await callable(input)).data;
}

export async function getManagedClass(classId?: string) {
  const callable = httpsCallable<{ classId?: string }, { classId: string; className: string; inviteCode: string; members: Array<{ id: string; name: string; role: string }> }>(requireFunctions(), 'getManagedClass');
  return (await callable({ classId })).data;
}
