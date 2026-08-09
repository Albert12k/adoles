import { httpsCallable } from 'firebase/functions';
import { addDoc, arrayRemove, arrayUnion, collection, doc, getDocs, limit, query, runTransaction, serverTimestamp, where, writeBatch } from 'firebase/firestore';
import { auth, cloudFunctions, db } from '../config/firebase';

const requireFunctions = () => {
  if (!cloudFunctions) throw new Error('Firebase ainda não foi configurado.');
  return cloudFunctions;
};

export async function publishContent(input: { title: string; classId?: string; lessonPdfUrl?: string; bookPdfUrl?: string; week?: number; quarter?: number; year?: number }) {
  if (!db || !auth?.currentUser) throw new Error('Entre novamente para publicar.');
  let classId = input.classId;
  if (!classId) {
    const directed = await getDocs(query(collection(db, 'classes'), where('directorIds', 'array-contains', auth.currentUser.uid), limit(1)));
    classId = directed.docs[0]?.id;
  }
  if (!classId) throw new Error('Nenhuma classe foi vinculada ao seu perfil.');
  const reference = await addDoc(collection(db, 'weeklyContent'), {
    classId, title: input.title.trim(), lessonPdfUrl: input.lessonPdfUrl ?? null, bookPdfUrl: input.bookPdfUrl ?? null,
    week: input.week ?? 1, quarter: input.quarter ?? 1, year: input.year ?? new Date().getFullYear(),
    createdBy: auth.currentUser.uid, publishedAt: serverTimestamp(),
  });
  return { contentId: reference.id };
}

export async function publishQuizContent(input: {
  title: string;
  classId?: string;
  releaseAt: number;
  closesAt: number;
  questions: Array<{ prompt: string; options: string[]; correctIndex: number }>;
}) {
  if (!db || !auth?.currentUser) throw new Error('Entre novamente para publicar o quiz.');
  let classId = input.classId;
  if (!classId) {
    const directed = await getDocs(query(collection(db, 'classes'), where('directorIds', 'array-contains', auth.currentUser.uid), limit(1)));
    classId = directed.docs[0]?.id;
  }
  if (!classId) throw new Error('Nenhuma classe foi vinculada ao seu perfil.');
  const quizRef = doc(collection(db, 'quizzes'));
  const batch = writeBatch(db);
  batch.set(quizRef, { classId, title: input.title, active: true, releaseAt: input.releaseAt, closesAt: input.closesAt, questions: input.questions.map(({ prompt, options }) => ({ prompt, options })), createdBy: auth.currentUser.uid, createdAt: serverTimestamp() });
  batch.set(doc(db, 'quizAnswerKeys', quizRef.id), { classId, correctIndexes: input.questions.map(item => item.correctIndex), createdBy: auth.currentUser.uid });
  await batch.commit();
  return { quizId: quizRef.id };
}

export async function reviewLeadershipItem(type: 'attendance' | 'challenge' | 'roleRequest' | 'classJoinRequest' | 'studyRecord' | 'quizAttempt', itemId: string, approved: boolean) {
  if (type === 'quizAttempt') {
    if (!db || !auth?.currentUser) throw new Error('Entre novamente para corrigir o quiz.');
    await runTransaction(db, async transaction => {
      const attemptRef = doc(db!, 'quizAttempts', itemId);
      const attempt = await transaction.get(attemptRef);
      if (!attempt.exists()) throw new Error('Resposta não encontrada.');
      const key = await transaction.get(doc(db!, 'quizAnswerKeys', attempt.data().quizId));
      if (!key.exists()) throw new Error('Gabarito não encontrado.');
      const correct = approved && attempt.data().answers?.[0] === key.data().correctIndexes?.[0];
      transaction.update(attemptRef, { status: 'reviewed', score: correct ? 10 : 0, correct, reviewedBy: auth!.currentUser!.uid, reviewedAt: serverTimestamp() });
    });
    return { status: 'reviewed' };
  }
  if (type === 'attendance') {
    if (!db || !auth?.currentUser) throw new Error('Entre novamente para avaliar a presença.');
    await runTransaction(db, async transaction => {
      const recordRef = doc(db!, 'attendance', itemId);
      const record = await transaction.get(recordRef);
      if (!record.exists()) throw new Error('Registro de presença não encontrado.');
      transaction.update(recordRef, { status: approved ? 'approved' : 'rejected', reviewedBy: auth!.currentUser!.uid, reviewedAt: serverTimestamp() });
    });
    return { status: approved ? 'approved' : 'rejected' };
  }
  if (type === 'studyRecord') {
    if (!db || !auth?.currentUser) throw new Error('Entre novamente para avaliar.');
    await runTransaction(db, async transaction => {
      const recordRef = doc(db!, 'studyRecords', itemId);
      const record = await transaction.get(recordRef);
      if (!record.exists()) throw new Error('Resumo não encontrado.');
      transaction.update(recordRef, { score: approved ? 20 : 0, feedbackVisible: true, feedback: approved ? 'Resumo analisado pelo diretor. Continue estudando!' : 'Revise o resumo e envie novamente.', reviewedBy: auth!.currentUser!.uid, reviewedAt: serverTimestamp() });
    });
    return { status: approved ? 'approved' : 'rejected' };
  }
  if (type === 'roleRequest' || type === 'classJoinRequest') {
    if (!db || !auth?.currentUser) throw new Error('Entre novamente para aprovar a solicitação.');
    await runTransaction(db, async transaction => {
      const requestRef = doc(db!, type === 'roleRequest' ? 'roleRequests' : 'classJoinRequests', itemId);
      const requestSnapshot = await transaction.get(requestRef);
      if (!requestSnapshot.exists()) throw new Error('Solicitação não encontrada.');
      const request = requestSnapshot.data();
      if (request.status !== 'pending') throw new Error('Esta solicitação já foi analisada.');
      if (approved && type === 'classJoinRequest') {
        transaction.update(doc(db!, 'users', request.userId), { classIds: arrayUnion(request.classId), districtId: request.districtId });
        transaction.set(doc(db!, 'classMembers', `${request.classId}_${request.userId}`), { classId: request.classId, userId: request.userId, name: request.name ?? 'Adolescente', role: 'student', active: true, joinedAt: serverTimestamp() });
      } else if (approved) {
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
  if (input.action === 'regenerateCode') {
    if (!db || !auth?.currentUser) throw new Error('Entre novamente para continuar.');
    const code = `VIVA-${Math.floor(1000 + Math.random() * 9000)}`;
    await runTransaction(db, async transaction => {
      const inviteRef = doc(db!, 'classInvites', input.classId);
      const current = await transaction.get(inviteRef);
      const data = current.data();
      if (!data) throw new Error('Convite da classe não encontrado.');
      if (data.inviteCode) transaction.update(doc(db!, 'classInviteCodes', data.inviteCode), { active: false });
      transaction.set(doc(db!, 'classInviteCodes', code), { classId: input.classId, districtId: data.districtId, active: true, createdAt: serverTimestamp() });
      transaction.update(inviteRef, { inviteCode: code, updatedAt: serverTimestamp(), updatedBy: auth!.currentUser!.uid });
    });
    return { success: true, inviteCode: code };
  }
  if (input.action === 'removeMember') {
    if (!db || !auth?.currentUser || !input.targetUserId) throw new Error('Selecione um membro para remover.');
    await runTransaction(db, async transaction => {
      const memberRef = doc(db!, 'classMembers', `${input.classId}_${input.targetUserId}`);
      const member = await transaction.get(memberRef);
      if (!member.exists()) throw new Error('Membro não encontrado nesta classe.');
      transaction.update(doc(db!, 'users', input.targetUserId!), { classIds: arrayRemove(input.classId) });
      transaction.update(memberRef, { active: false, removedAt: serverTimestamp(), removedBy: auth!.currentUser!.uid });
    });
    return { success: true };
  }
  const callable = httpsCallable<typeof input, { success?: boolean; inviteCode?: string; className?: string }>(requireFunctions(), 'manageClassMembership');
  return (await callable(input)).data;
}

export async function getManagedClass(classId?: string) {
  if (!db || !auth?.currentUser) throw new Error('Entre novamente para continuar.');
  const classes = classId
    ? await getDocs(query(collection(db, 'classes'), where('__name__', '==', classId), limit(1)))
    : await getDocs(query(collection(db, 'classes'), where('directorIds', 'array-contains', auth.currentUser.uid), limit(1)));
  if (classes.empty) return { classId: '', className: '', inviteCode: '', members: [] };
  const selected = classes.docs[0];
  const [invites, members] = await Promise.all([
    getDocs(query(collection(db, 'classInvites'), where('classId', '==', selected.id), limit(1))),
    getDocs(query(collection(db, 'classMembers'), where('classId', '==', selected.id), where('active', '==', true), limit(100))),
  ]);
  return { classId: selected.id, className: selected.data().name, inviteCode: invites.docs[0]?.data().inviteCode ?? '', members: members.docs.map(item => ({ id: item.data().userId, name: item.data().name, role: item.data().role })) };
}
