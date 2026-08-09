import { httpsCallable } from 'firebase/functions';
import { addDoc, arrayRemove, arrayUnion, collection, doc, getDoc, getDocs, limit, query, runTransaction, serverTimestamp, where, writeBatch } from 'firebase/firestore';
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

async function notifyClass(classId: string, type: string, title: string, body: string) {
  if (!db || !auth?.currentUser) return;
  const members = await getDocs(query(collection(db, 'classMembers'), where('classId', '==', classId), where('active', '==', true), limit(300)));
  const batch = writeBatch(db);
  members.docs.filter(item => item.data().role !== 'director').forEach(member => {
    const reference = doc(collection(db!, 'notifications'));
    batch.set(reference, { userId: member.data().userId, classId, type, title, body, read: false, createdBy: auth!.currentUser!.uid, createdAt: serverTimestamp() });
  });
  await batch.commit();
}

async function notifyUser(userId: string, classId: string, type: string, title: string, body: string) {
  if (!db || !auth?.currentUser) return;
  await addDoc(collection(db, 'notifications'), { userId, classId, type, title, body, read: false, createdBy: auth.currentUser.uid, createdAt: serverTimestamp() });
}

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
  await notifyClass(classId, 'conteudo', 'Novo conteúdo semanal', `${input.title.trim()} já está disponível para estudo.`).catch(() => undefined);
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
  const scheduled = input.releaseAt > Date.now() + 60000;
  await notifyClass(classId, 'quiz', scheduled ? 'Quiz semanal programado' : 'Novo quiz semanal', scheduled ? `${input.title} será liberado em breve para a sua base.` : `${input.title} foi publicado para a sua base.`).catch(() => undefined);
  return { quizId: quizRef.id };
}

export interface ManagedQuiz { id: string; title: string; releaseAt: number; closesAt: number; active: boolean; }
export async function listManagedQuizzes(selectedClassId?: string): Promise<ManagedQuiz[]> {
  if (!db || !auth?.currentUser) return [];
  let classId = selectedClassId;
  if (!classId) { const directed = await getDocs(query(collection(db, 'classes'), where('directorIds', 'array-contains', auth.currentUser.uid), limit(1))); classId = directed.docs[0]?.id; }
  if (!classId) return [];
  const result = await getDocs(query(collection(db, 'quizzes'), where('classId', '==', classId), where('active', '==', true), limit(20)));
  return result.docs.map(item => ({ id: item.id, title: item.data().title ?? 'Quiz semanal', releaseAt: Number(item.data().releaseAt ?? 0), closesAt: Number(item.data().closesAt ?? 0), active: item.data().active === true })).sort((a, b) => b.releaseAt - a.releaseAt);
}

export async function endQuizNow(quizId: string) {
  if (!db || !auth?.currentUser) throw new Error('Entre novamente para encerrar o quiz.');
  await runTransaction(db, async transaction => {
    const quizRef = doc(db!, 'quizzes', quizId); const quiz = await transaction.get(quizRef);
    if (!quiz.exists() || !quiz.data().active) throw new Error('Este quiz já foi encerrado.');
    transaction.update(quizRef, { active: false, closesAt: Date.now(), endedBy: auth!.currentUser!.uid, endedAt: serverTimestamp() });
  });
  return { success: true };
}

export async function reviewLeadershipItem(type: 'attendance' | 'challenge' | 'roleRequest' | 'classJoinRequest' | 'studyRecord' | 'quizAttempt' | 'flashcard' | 'leadershipTransfer', itemId: string, approved: boolean) {
  if (type === 'leadershipTransfer') {
    if (!db || !auth?.currentUser) throw new Error('Entre novamente para analisar a troca.');
    let requestData: Record<string, any> = {};
    await runTransaction(db, async transaction => {
      const requestRef = doc(db!, 'leadershipTransfers', itemId); const requestDoc = await transaction.get(requestRef);
      if (!requestDoc.exists() || requestDoc.data().status !== 'pending') throw new Error('Solicitação não encontrada ou já analisada.');
      const request = requestDoc.data();
      requestData = request;
      if (!approved) { transaction.update(requestRef, { status: 'rejected', reviewedBy: auth!.currentUser!.uid, reviewedAt: serverTimestamp() }); return; }
      const classRef = doc(db!, 'classes', request.classId); const selectedClass = await transaction.get(classRef);
      const currentRef = doc(db!, 'users', request.requestedBy); const current = await transaction.get(currentRef);
      const targetRef = request.targetUserId ? doc(db!, 'users', request.targetUserId) : null;
      const target = targetRef ? await transaction.get(targetRef) : null;
      const currentMemberRef = doc(db!, 'classMembers', `${request.classId}_${request.requestedBy}`); const currentMember = await transaction.get(currentMemberRef);
      const targetMemberRef = request.targetUserId ? doc(db!, 'classMembers', `${request.classId}_${request.targetUserId}`) : null;
      const targetMember = targetMemberRef ? await transaction.get(targetMemberRef) : null;
      if (!selectedClass.exists() || !current.exists() || (targetRef && !target?.exists()) || (targetMemberRef && !targetMember?.exists())) throw new Error('Usuário ou base da transferência não encontrado.');
      const directorIds = (selectedClass.data().directorIds ?? []).filter((id: string) => id !== request.requestedBy);
      if (request.action === 'transfer' && request.targetUserId && !directorIds.includes(request.targetUserId)) directorIds.push(request.targetUserId);
      transaction.update(classRef, { directorIds });
      if (targetRef) transaction.update(targetRef, { role: 'director', districtId: request.districtId, classIds: arrayUnion(request.classId) });
      if (targetMemberRef) transaction.update(targetMemberRef, { role: 'director', promotedAt: serverTimestamp(), promotedBy: auth!.currentUser!.uid });
      const remaining = (current.data().classIds ?? []).filter((id: string) => id !== request.classId);
      transaction.update(currentRef, { classIds: arrayRemove(request.classId), ...(remaining.length === 0 ? { role: 'student' } : {}) });
      if (currentMember.exists()) transaction.update(currentMemberRef, { role: 'student', leadershipEndedAt: serverTimestamp(), leadershipEndedBy: auth!.currentUser!.uid });
      transaction.update(requestRef, { status: 'approved', reviewedBy: auth!.currentUser!.uid, reviewedAt: serverTimestamp() });
    });
    const decision = approved ? 'aprovada' : 'recusada';
    await notifyUser(requestData.requestedBy, requestData.classId, 'leadership', 'Solicitação de liderança analisada', `Sua solicitação para ${requestData.className ?? 'a base'} foi ${decision}.`).catch(() => undefined);
    if (approved && requestData.action === 'transfer' && requestData.targetUserId) await notifyUser(requestData.targetUserId, requestData.classId, 'leadership', 'Você agora dirige uma base', `A liderança de ${requestData.className ?? 'sua base'} foi transferida para você.`).catch(() => undefined);
    return { status: approved ? 'approved' : 'rejected' };
  }
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
    let attemptUserId = ''; let attemptClassId = '';
    await runTransaction(db, async transaction => {
      const attemptRef = doc(db!, 'quizAttempts', itemId);
      const attempt = await transaction.get(attemptRef);
      if (!attempt.exists()) throw new Error('Resposta não encontrada.');
      attemptUserId = String(attempt.data().userId ?? ''); attemptClassId = String(attempt.data().classId ?? '');
      const key = await transaction.get(doc(db!, 'quizAnswerKeys', attempt.data().quizId));
      if (!key.exists()) throw new Error('Gabarito não encontrado.');
      const submitted = attempt.data().answers ?? [];
      const expected = key.data().answers ?? [];
      const types = key.data().types ?? [];
      const results = expected.map((answer: number | string, index: number) => types[index] === 'open' ? approved && String(submitted[index] ?? '').trim().length > 0 : submitted[index] === answer);
      const correctAnswers = results.filter(Boolean).length;
      transaction.update(attemptRef, { status: 'reviewed', score: correctAnswers * 10, correctAnswers, totalQuestions: expected.length, correct: correctAnswers === expected.length, resultPublished: false, reviewedBy: auth!.currentUser!.uid, reviewedAt: serverTimestamp() });
    });
    if (attemptUserId) await notifyUser(attemptUserId, attemptClassId, 'quiz', 'Quiz corrigido', 'Sua resposta foi corrigida. O resultado será mostrado quando o diretor publicar o ranking.').catch(() => undefined);
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
    let studyUserId = ''; let studyClassId = '';
    await runTransaction(db, async transaction => {
      const recordRef = doc(db!, 'studyRecords', itemId);
      const record = await transaction.get(recordRef);
      if (!record.exists()) throw new Error('Resumo não encontrado.');
      studyUserId = String(record.data().userId ?? ''); studyClassId = String(record.data().classId ?? '');
      transaction.update(recordRef, { score: approved ? 20 : 0, feedbackVisible: true, feedback: approved ? 'Resumo analisado pelo diretor. Continue estudando!' : 'Revise o resumo e envie novamente.', reviewedBy: auth!.currentUser!.uid, reviewedAt: serverTimestamp() });
    });
    if (studyUserId) await notifyUser(studyUserId, studyClassId, 'avaliacao', 'Resumo avaliado', approved ? 'Seu resumo foi analisado pelo diretor.' : 'Seu resumo precisa de uma revisão antes de ser concluído.').catch(() => undefined);
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
          if (!request.inviteCode) throw new Error('A solicitação não possui convite administrativo.');
          const coordinatorInvite = await transaction.get(doc(db!, 'coordinatorInvites', request.inviteCode));
          if (!coordinatorInvite.exists() || !coordinatorInvite.data().active || coordinatorInvite.data().districtId !== request.districtId) throw new Error('Este convite não está mais disponível.');
          transaction.update(userRef, { role: 'coordinator', districtId: request.districtId });
          transaction.update(doc(db!, 'coordinatorInvites', request.inviteCode), { active: false, usedBy: request.userId, usedAt: serverTimestamp() });
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

export async function publishLatestQuizRanking(selectedClassId?: string) {
  if (!db || !auth?.currentUser) throw new Error('Entre novamente para publicar o ranking.');
  const directed = await getDocs(query(collection(db, 'classes'), where('directorIds', 'array-contains', auth.currentUser.uid), limit(10)));
  if (directed.empty) throw new Error('Nenhuma classe foi vinculada ao seu perfil.');
  const selected = selectedClassId ? directed.docs.find(item => item.id === selectedClassId) : directed.docs[0];
  if (!selected) throw new Error('A base selecionada não está vinculada à sua conta.');
  const classId = selected.id;
  const classData = selected.data();
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
  await notifyClass(classId, 'ranking', 'Ranking semanal publicado', 'As notas e o placar da semana já estão disponíveis.').catch(() => undefined);
  return { quizId: latest.id, entries: entries.length };
}

export async function manageClassMembership(input: { action: 'regenerateCode' | 'removeMember' | 'transferLeadership' | 'revokeDirector'; classId: string; targetUserId?: string }) {
  if (input.action === 'regenerateCode') {
    if (!db || !auth?.currentUser) throw new Error('Entre novamente para continuar.');
    const code = `VIVA-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
    await runTransaction(db, async transaction => {
      const inviteRef = doc(db!, 'classInvites', input.classId);
      const current = await transaction.get(inviteRef);
      const selectedClass = await transaction.get(doc(db!, 'classes', input.classId));
      const data = current.data();
      if (!data) throw new Error('Convite da classe não encontrado.');
      if (data.inviteCode) transaction.update(doc(db!, 'classInviteCodes', data.inviteCode), { active: false });
      transaction.set(doc(db!, 'classInviteCodes', code), { classId: input.classId, districtId: data.districtId, className: selectedClass.data()?.name ?? 'Base', ageGroup: selectedClass.data()?.ageGroup ?? 'adolescentes', active: true, createdAt: serverTimestamp() });
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
  if (input.action === 'transferLeadership' || input.action === 'revokeDirector') {
    if (!db || !auth?.currentUser) throw new Error('Entre novamente para solicitar a alteração.');
    const selectedClass = await getDoc(doc(db, 'classes', input.classId));
    if (!selectedClass.exists()) throw new Error('Base não encontrada.');
    const classData = selectedClass.data();
    const duplicate = await getDocs(query(collection(db, 'leadershipTransfers'), where('requestedBy', '==', auth.currentUser.uid), where('status', '==', 'pending'), limit(1)));
    if (!duplicate.empty) throw new Error('Você já possui uma solicitação de liderança aguardando análise.');
    let targetName = '';
    if (input.action === 'transferLeadership') {
      if (!input.targetUserId) throw new Error('Selecione o novo diretor.');
      const target = await getDoc(doc(db, 'classMembers', `${input.classId}_${input.targetUserId}`));
      if (!target.exists() || !target.data().active) throw new Error('O novo responsável precisa ser membro ativo da base.');
      targetName = target.data().name ?? 'Novo diretor';
    }
    await addDoc(collection(db, 'leadershipTransfers'), { classId: input.classId, className: classData.name ?? 'Base', districtId: classData.districtId, action: input.action === 'transferLeadership' ? 'transfer' : 'revoke', requestedBy: auth.currentUser.uid, targetUserId: input.action === 'transferLeadership' ? input.targetUserId : null, targetName, name: auth.currentUser.displayName ?? 'Diretor atual', status: 'pending', createdAt: serverTimestamp() });
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
