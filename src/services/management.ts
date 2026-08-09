import { httpsCallable } from 'firebase/functions';
import { addDoc, arrayRemove, arrayUnion, collection, doc, getDocs, limit, query, runTransaction, serverTimestamp, where, writeBatch } from 'firebase/firestore';
import { auth, cloudFunctions, db } from '../config/firebase';

const requireFunctions = () => {
  if (!cloudFunctions) throw new Error('Firebase ainda não foi configurado.');
  return cloudFunctions;
};

const quizWeek = (timestamp = Date.now()) => {
  const date = new Date(timestamp);
  const start = new Date(date.getFullYear(), 0, 1);
  const week = Math.ceil(((date.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7);
  return { weekKey: `${date.getFullYear()}-W${String(week).padStart(2, '0')}`, weekLabel: `Semana ${week} · ${date.getFullYear()}` };
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
  questions: Array<{ type: 'multiple_choice' | 'true_false' | 'assertion_reason' | 'open' | 'identify_false'; prompt: string; options: string[]; correctAnswer: number | string }>;
}) {
  if (!db || !auth?.currentUser) throw new Error('Entre novamente para publicar o quiz.');
  let classId = input.classId;
  if (!classId) {
    const directed = await getDocs(query(collection(db, 'classes'), where('directorIds', 'array-contains', auth.currentUser.uid), limit(1)));
    classId = directed.docs[0]?.id;
  }
  if (!classId) throw new Error('Nenhuma classe foi vinculada ao seu perfil.');
  const quizRef = doc(collection(db, 'quizzes'));
  const week = quizWeek(input.releaseAt);
  const batch = writeBatch(db);
  batch.set(quizRef, { classId, title: input.title, ...week, active: true, releaseAt: input.releaseAt, closesAt: input.closesAt, questions: input.questions.map(({ type, prompt, options }) => ({ type, prompt, options })), createdBy: auth.currentUser.uid, createdAt: serverTimestamp() });
  batch.set(doc(db, 'quizAnswerKeys', quizRef.id), { classId, answers: input.questions.map(item => item.correctAnswer), types: input.questions.map(item => item.type), createdBy: auth.currentUser.uid });
  await batch.commit();
  return { quizId: quizRef.id };
}

export async function reviewLeadershipItem(type: 'attendance' | 'challenge' | 'roleRequest' | 'classJoinRequest' | 'studyRecord' | 'quizAttempt' | 'flashcard', itemId: string, approved: boolean) {
  if (type === 'challenge') {
    if (!db || !auth?.currentUser) throw new Error('Entre novamente para validar o desafio.');
    await runTransaction(db, async transaction => {
      const challengeRef = doc(db!, 'challenges', itemId);
      const challenge = await transaction.get(challengeRef);
      if (!challenge.exists()) throw new Error('Desafio não encontrado.');
      const data = challenge.data();
      const status = approved ? 'approved' : 'rejected';
      transaction.update(challengeRef, { status, reviewedBy: auth!.currentUser!.uid, reviewedAt: serverTimestamp() });
      if (approved) {
        transaction.set(doc(db!, 'scores', `challenge_${itemId}`), { classId: data.classId, districtId: data.districtId, ageGroup: data.ageGroup ?? 'adolescentes', source: 'challenge', points: Number(data.bonusPoints ?? 0), createdAt: serverTimestamp() });
        transaction.set(doc(db!, 'muralPosts', `challenge_${itemId}`), { classId: data.classId, districtId: data.districtId, type: 'challenge', icon: '◆', title: data.title, copy: `${data.className ?? 'A base'} concluiu o desafio e ganhou +${data.bonusPoints ?? 0} pontos!`, evidence: data.evidence ?? '', reactions: [], createdAt: serverTimestamp() });
      }
    });
    return { status: approved ? 'approved' : 'rejected' };
  }
  if (type === 'flashcard') {
    if (!db || !auth?.currentUser) throw new Error('Entre novamente para moderar o flashcard.');
    await runTransaction(db, async transaction => {
      const cardRef = doc(db!, 'flashcards', itemId);
      const card = await transaction.get(cardRef);
      if (!card.exists()) throw new Error('Flashcard não encontrado.');
      transaction.update(cardRef, { status: approved ? 'published' : 'rejected', reviewedBy: auth!.currentUser!.uid, reviewedAt: serverTimestamp() });
    });
    return { status: approved ? 'published' : 'rejected' };
  }
  if (type === 'quizAttempt') {
    if (!db || !auth?.currentUser) throw new Error('Entre novamente para corrigir o quiz.');
    await runTransaction(db, async transaction => {
      const attemptRef = doc(db!, 'quizAttempts', itemId);
      const attempt = await transaction.get(attemptRef);
      if (!attempt.exists()) throw new Error('Resposta não encontrada.');
      const key = await transaction.get(doc(db!, 'quizAnswerKeys', attempt.data().quizId));
      if (!key.exists()) throw new Error('Gabarito não encontrado.');
      const submitted = attempt.data().answers ?? [];
      const expected = key.data().answers ?? [];
      const types = key.data().types ?? [];
      const results = expected.map((answer: number | string, index: number) => types[index] === 'open' ? approved && String(submitted[index] ?? '').trim().length > 0 : submitted[index] === answer);
      const correctAnswers = results.filter(Boolean).length;
      transaction.update(attemptRef, { status: 'reviewed', score: correctAnswers * 10, correctAnswers, totalQuestions: expected.length, correct: correctAnswers === expected.length, resultPublished: false, reviewedBy: auth!.currentUser!.uid, reviewedAt: serverTimestamp() });
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

export async function publishLatestQuizRanking() {
  if (!db || !auth?.currentUser) throw new Error('Entre novamente para publicar o ranking.');
  const directed = await getDocs(query(collection(db, 'classes'), where('directorIds', 'array-contains', auth.currentUser.uid), limit(1)));
  if (directed.empty) throw new Error('Nenhuma classe foi vinculada ao seu perfil.');
  const classId = directed.docs[0].id;
  const classData = directed.docs[0].data();
  const quizzes = await getDocs(query(collection(db, 'quizzes'), where('classId', '==', classId), where('active', '==', true), limit(20)));
  const latest = quizzes.docs.sort((a, b) => Number(b.data().releaseAt ?? 0) - Number(a.data().releaseAt ?? 0))[0];
  if (!latest) throw new Error('Nenhum quiz ativo foi encontrado.');
  const attempts = await getDocs(query(collection(db, 'quizAttempts'), where('quizId', '==', latest.id), where('status', '==', 'reviewed')));
  if (attempts.empty) throw new Error('Ainda não há respostas corrigidas para publicar.');
  const sorted = attempts.docs.map(item => ({ userId: item.data().userId, name: item.data().userName ?? 'Adolescente', score: Number(item.data().score ?? 0) })).sort((a, b) => b.score - a.score);
  let lastScore: number | null = null;
  let lastPosition = 0;
  const entries = sorted.map((entry, index) => { if (entry.score !== lastScore) lastPosition = index + 1; lastScore = entry.score; return { ...entry, position: lastPosition }; });
  const batch = writeBatch(db);
  attempts.docs.forEach(item => batch.update(item.ref, { resultPublished: true, publishedAt: serverTimestamp() }));
  batch.set(doc(db, 'quizRankings', latest.id), { quizId: latest.id, classId, title: latest.data().title, weekKey: latest.data().weekKey ?? quizWeek(latest.data().releaseAt).weekKey, weekLabel: latest.data().weekLabel ?? quizWeek(latest.data().releaseAt).weekLabel, entries, published: true, publishedBy: auth.currentUser.uid, publishedAt: serverTimestamp() });
  const activeMembers = await getDocs(query(collection(db, 'classMembers'), where('classId', '==', classId), where('active', '==', true)));
  const publishedWeek = latest.data().weekKey ?? quizWeek(latest.data().releaseAt).weekKey;
  batch.set(doc(db, 'publishedClassScores', `${publishedWeek}_${classId}`), { classId, className: classData.name ?? 'Base', districtId: classData.districtId, ageGroup: classData.ageGroup ?? 'adolescentes', weekKey: publishedWeek, quarter: Math.floor(new Date().getMonth() / 3) + 1, year: new Date().getFullYear(), activeMembers: Math.max(1, activeMembers.size), entries, publishedAt: serverTimestamp() });
  await batch.commit();
  return { quizId: latest.id, entries: entries.length };
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
