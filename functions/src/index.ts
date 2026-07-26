import { initializeApp } from 'firebase-admin/app';
import { DocumentData, FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';

initializeApp();
const db = getFirestore();
const region = 'southamerica-east1';

export const joinClassByCode = onCall({ region }, async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta para usar o convite.');
  const inviteCode = String(request.data?.inviteCode ?? '').trim().toUpperCase();
  if (inviteCode.length < 5) throw new HttpsError('invalid-argument', 'Código de convite inválido.');

  const classes = await db.collection('classes')
    .where('inviteCode', '==', inviteCode)
    .where('active', '==', true)
    .limit(1)
    .get();
  if (classes.empty) throw new HttpsError('not-found', 'Nenhuma classe ativa foi encontrada.');

  const classRef = classes.docs[0].ref;
  const userRef = db.collection('users').doc(request.auth.uid);
  await db.runTransaction(async transaction => {
    const user = await transaction.get(userRef);
    if (!user.exists) throw new HttpsError('failed-precondition', 'Perfil do usuário não encontrado.');
    const currentClasses = (user.data()?.classIds ?? []) as string[];
    if (currentClasses.includes(classRef.id)) return;
    transaction.update(userRef, { classIds: FieldValue.arrayUnion(classRef.id) });
    transaction.update(classRef, { activeMemberCount: FieldValue.increment(1) });
  });
  return { classId: classRef.id, className: classes.docs[0].data().name };
});

export const scoreStudy = onDocumentCreated({ document: 'studyRecords/{recordId}', region }, async event => {
  const study = event.data?.data();
  if (!study) return;
  const scoreRef = db.collection('scores').doc(`study_${event.params.recordId}`);
  await scoreRef.set({
    userId: study.userId,
    classId: study.classId,
    districtId: study.districtId ?? '',
    ageGroup: study.ageGroup ?? 'adolescentes',
    source: 'study',
    points: 15,
    createdAt: FieldValue.serverTimestamp(),
  }, { merge: false });
  await db.collection('notifications').add({
    userId: study.userId,
    type: 'study',
    title: 'Estudo registrado',
    body: 'Você ganhou 15 pontos por estudar nesta semana.',
    read: false,
    createdAt: FieldValue.serverTimestamp(),
  });
});

export const scoreApprovedAttendance = onDocumentUpdated({ document: 'attendance/{recordId}', region }, async event => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!before || !after || before.status === 'approved' || after.status !== 'approved') return;
  await db.collection('scores').doc(`attendance_${event.params.recordId}`).set({
    userId: after.userId,
    classId: after.classId,
    districtId: after.districtId ?? '',
    ageGroup: after.ageGroup ?? 'adolescentes',
    source: 'attendance',
    points: 10,
    createdAt: FieldValue.serverTimestamp(),
  }, { merge: false });
  await db.collection('notifications').add({
    userId: after.userId,
    type: 'attendance',
    title: 'Presença aprovada',
    body: 'Seu avatar avançou uma semana na trilha.',
    read: false,
    createdAt: FieldValue.serverTimestamp(),
  });
});

export const notifyWeeklyContent = onDocumentCreated({ document: 'weeklyContent/{contentId}', region }, async event => {
  const content = event.data?.data();
  if (!content?.classId) return;
  const members = await db.collection('users').where('classIds', 'array-contains', content.classId).get();
  const writes = members.docs.map(member => db.collection('notifications').add({
    userId: member.id,
    type: 'content',
    title: 'Nova lição disponível',
    body: content.title,
    read: false,
    createdAt: FieldValue.serverTimestamp(),
  }));
  await Promise.all(writes);
});

export const rebuildClassRankings = onSchedule({ schedule: '0 3 * * *', timeZone: 'America/Bahia', region }, async () => {
  const [classes, scores] = await Promise.all([
    db.collection('classes').where('active', '==', true).get(),
    db.collection('scores').get(),
  ]);
  const totals = new Map<string, number>();
  scores.forEach(score => {
    const data = score.data();
    totals.set(data.classId, (totals.get(data.classId) ?? 0) + Number(data.points ?? 0));
  });
  const batch = db.batch();
  classes.forEach(item => {
    const data = item.data();
    const totalPoints = totals.get(item.id) ?? 0;
    const activeMembers = Math.max(Number(data.activeMemberCount ?? 0), 1);
    batch.set(db.collection('classRankings').doc(item.id), {
      classId: item.id,
      className: data.name,
      districtId: data.districtId,
      ageGroup: data.ageGroup,
      totalPoints,
      activeMembers,
      normalizedScore: Math.round((totalPoints / activeMembers) * 100) / 100,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
  await batch.commit();
});

export const detectLowEngagement = onSchedule({ schedule: '0 8 * * 1', timeZone: 'America/Bahia', region }, async () => {
  const cutoff = Timestamp.fromMillis(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const [students, recentAttendance] = await Promise.all([
    db.collection('users').where('role', '==', 'student').where('active', '==', true).get(),
    db.collection('attendance').where('createdAt', '>=', cutoff).get(),
  ]);
  const presentUsers = new Set(recentAttendance.docs.map(item => item.data().userId));
  const atRisk = students.docs.filter(student => !presentUsers.has(student.id));
  await Promise.all(atRisk.map(student => db.collection('engagementAlerts').doc(student.id).set({
    userId: student.id,
    classIds: student.data().classIds ?? [],
    level: 'high',
    reason: 'Sem presença registrada há pelo menos duas semanas',
    active: true,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true })));
});

export const getWeeklyQuiz = onCall({ region }, async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta para acessar o quiz.');
  const classId = String(request.data?.classId ?? '');
  const profile = await db.collection('users').doc(request.auth.uid).get();
  const classIds = (profile.data()?.classIds ?? []) as string[];
  if (!classIds.includes(classId)) throw new HttpsError('permission-denied', 'Você não pertence a esta classe.');

  const quizzes = await db.collection('quizzes')
    .where('classId', '==', classId)
    .where('active', '==', true)
    .orderBy('releaseAt', 'desc')
    .limit(1)
    .get();
  if (quizzes.empty) return null;
  const item = quizzes.docs[0];
  const quiz = item.data();
  const now = Date.now();
  if (quiz.releaseAt?.toMillis() > now || quiz.closesAt?.toMillis() < now) return null;
  return {
    id: item.id,
    classId: quiz.classId,
    title: quiz.title,
    releaseAt: quiz.releaseAt.toDate().toISOString(),
    closesAt: quiz.closesAt.toDate().toISOString(),
    questions: (quiz.questions ?? []).map((question: Record<string, unknown>, index: number) => ({
      id: String(question.id ?? index),
      prompt: question.prompt,
      options: question.options,
    })),
  };
});

export const submitQuiz = onCall({ region }, async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta para responder.');
  const quizId = String(request.data?.quizId ?? '');
  const answers = request.data?.answers as number[] | undefined;
  if (!quizId || !Array.isArray(answers)) throw new HttpsError('invalid-argument', 'Respostas inválidas.');
  const quizRef = db.collection('quizzes').doc(quizId);
  const attemptRef = db.collection('quizAttempts').doc(`${quizId}_${request.auth.uid}`);

  return db.runTransaction(async transaction => {
    const [quizSnapshot, attemptSnapshot, profileSnapshot] = await Promise.all([
      transaction.get(quizRef), transaction.get(attemptRef), transaction.get(db.collection('users').doc(request.auth!.uid)),
    ]);
    if (!quizSnapshot.exists) throw new HttpsError('not-found', 'Quiz não encontrado.');
    if (attemptSnapshot.exists) throw new HttpsError('already-exists', 'Este quiz já foi respondido.');
    const quiz = quizSnapshot.data()!;
    if (!((profileSnapshot.data()?.classIds ?? []) as string[]).includes(quiz.classId)) throw new HttpsError('permission-denied', 'Quiz indisponível.');
    const questions = (quiz.questions ?? []) as Array<{ correctIndex: number }>;
    if (answers.length !== questions.length) throw new HttpsError('invalid-argument', 'Responda todas as perguntas.');
    const correctAnswers = questions.reduce((total, question, index) => total + (question.correctIndex === answers[index] ? 1 : 0), 0);
    const points = correctAnswers * Number(quiz.pointsPerQuestion ?? 10);
    transaction.create(attemptRef, { quizId, userId: request.auth!.uid, classId: quiz.classId, answers, correctAnswers, totalQuestions: questions.length, points, createdAt: FieldValue.serverTimestamp() });
    transaction.set(db.collection('scores').doc(`quiz_${quizId}_${request.auth!.uid}`), { userId: request.auth!.uid, classId: quiz.classId, districtId: quiz.districtId ?? '', ageGroup: quiz.ageGroup ?? 'adolescentes', source: 'quiz', points, createdAt: FieldValue.serverTimestamp() });
    return { attemptId: attemptRef.id, correctAnswers, totalQuestions: questions.length, points };
  });
});

export const approveChallenge = onDocumentUpdated({ document: 'challenges/{challengeId}', region }, async event => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!before || !after || before.status === 'approved' || after.status !== 'approved') return;
  const batch = db.batch();
  batch.set(db.collection('scores').doc(`challenge_${event.params.challengeId}`), { classId: after.classId, districtId: after.districtId, ageGroup: after.ageGroup ?? 'adolescentes', source: 'challenge', points: Number(after.bonusPoints ?? 0), createdAt: FieldValue.serverTimestamp() });
  batch.set(db.collection('muralPosts').doc(`challenge_${event.params.challengeId}`), { classId: after.classId, districtId: after.districtId, type: 'challenge', title: after.title, body: 'Desafio aprovado pelo distrito!', evidenceUrl: after.evidenceUrl ?? null, reactions: {}, createdAt: FieldValue.serverTimestamp() });
  await batch.commit();
});

export const awardAutomaticBadges = onDocumentCreated({ document: 'scores/{scoreId}', region }, async event => {
  const score = event.data?.data();
  if (!score?.userId) return;
  const userScores = await db.collection('scores').where('userId', '==', score.userId).get();
  const totalPoints = userScores.docs.reduce((total, item) => total + Number(item.data().points ?? 0), 0);
  const studyCount = userScores.docs.filter(item => item.data().source === 'study').length;
  const badges = [
    ...(studyCount >= 5 ? [{ key: 'reader_5', title: 'Leitor constante', description: 'Completou cinco estudos.' }] : []),
    ...(totalPoints >= 100 ? [{ key: 'points_100', title: 'Primeiros 100', description: 'Conquistou 100 pontos.' }] : []),
    ...(totalPoints >= 500 ? [{ key: 'points_500', title: 'Jornada de ouro', description: 'Conquistou 500 pontos.' }] : []),
  ];
  for (const badge of badges) {
    const badgeRef = db.collection('badges').doc(`${score.userId}_${badge.key}`);
    const created = await db.runTransaction(async transaction => {
      const existing = await transaction.get(badgeRef);
      if (existing.exists) return false;
      transaction.create(badgeRef, { userId: score.userId, ...badge, earnedAt: FieldValue.serverTimestamp() });
      return true;
    });
    if (created) await db.collection('notifications').add({ userId: score.userId, type: 'badge', title: `Nova conquista: ${badge.title}`, body: badge.description, read: false, createdAt: FieldValue.serverTimestamp() });
  }
});

export const getLeadershipReport = onCall({ region }, async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta.');
  const profileSnapshot = await db.collection('users').doc(request.auth.uid).get();
  const profile = profileSnapshot.data();
  if (!profile || !['admin', 'coordinator', 'director'].includes(profile.role)) throw new HttpsError('permission-denied', 'Acesso exclusivo da liderança.');
  const requestedClassId = String(request.data?.classId ?? '');
  const requestedDistrictId = String(request.data?.districtId ?? '');
  if (profile.role === 'director' && requestedClassId && !(profile.classIds ?? []).includes(requestedClassId)) throw new HttpsError('permission-denied', 'Classe não autorizada.');
  if (profile.role === 'coordinator' && requestedDistrictId && profile.districtId !== requestedDistrictId) throw new HttpsError('permission-denied', 'Distrito não autorizado.');

  let allowedClassIds: string[];
  if (profile.role === 'director') {
    allowedClassIds = requestedClassId ? [requestedClassId] : (profile.classIds ?? []);
  } else {
    const districtScope = profile.role === 'coordinator' ? profile.districtId : requestedDistrictId;
    const classQuery = districtScope ? db.collection('classes').where('districtId', '==', districtScope) : db.collection('classes').where('active', '==', true);
    const classes = await classQuery.get();
    allowedClassIds = classes.docs.map(item => item.id);
  }
  const [users, studies, attendance, scores] = await Promise.all([
    db.collection('users').where('role', '==', 'student').where('active', '==', true).get(),
    db.collection('studyRecords').get(), db.collection('attendance').where('status', '==', 'approved').get(), db.collection('scores').get(),
  ]);
  const belongs = (data: DocumentData) => allowedClassIds.includes(data.classId);
  return {
    activeStudents: users.docs.filter(item => ((item.data().classIds ?? []) as string[]).some(id => allowedClassIds.includes(id))).length,
    activeClasses: allowedClassIds.length,
    studies: studies.docs.filter(item => belongs(item.data())).length,
    approvedAttendance: attendance.docs.filter(item => belongs(item.data())).length,
    totalPoints: scores.docs.filter(item => belongs(item.data())).reduce((total, item) => total + Number(item.data().points ?? 0), 0),
    generatedAt: new Date().toISOString(),
  };
});

export const archiveQuarterHallOfFame = onSchedule({ schedule: '0 2 1 1,4,7,10 *', timeZone: 'America/Bahia', region }, async () => {
  const rankings = await db.collection('classRankings').orderBy('normalizedScore', 'desc').limit(20).get();
  const now = new Date();
  const currentQuarter = Math.floor(now.getMonth() / 3) + 1;
  const quarter = currentQuarter === 1 ? 4 : currentQuarter - 1;
  const year = currentQuarter === 1 ? now.getFullYear() - 1 : now.getFullYear();
  await Promise.all(rankings.docs.map((item, index) => db.collection('hallOfFame').doc(`${year}_Q${quarter}_${item.id}`).set({ year, quarter, classId: item.id, place: index + 1, ...item.data(), archivedAt: FieldValue.serverTimestamp() })));
});

async function requireLeader(uid: string) {
  const snapshot = await db.collection('users').doc(uid).get();
  const profile = snapshot.data();
  if (!profile || !['admin', 'coordinator', 'director'].includes(profile.role)) throw new HttpsError('permission-denied', 'Acesso exclusivo da liderança.');
  return profile;
}

async function requireClassAccess(profile: DocumentData, classId: string) {
  const classSnapshot = await db.collection('classes').doc(classId).get();
  if (!classSnapshot.exists) throw new HttpsError('not-found', 'Classe não encontrada.');
  const classData = classSnapshot.data()!;
  if (profile.role === 'director' && !profile.classIds?.includes(classId)) throw new HttpsError('permission-denied', 'Classe não autorizada.');
  if (profile.role === 'coordinator' && profile.districtId !== classData.districtId) throw new HttpsError('permission-denied', 'Classe fora do seu distrito.');
  return classData;
}

export const publishWeeklyContent = onCall({ region }, async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta.');
  const profile = await requireLeader(request.auth.uid);
  const classId = String(request.data?.classId || profile.classIds?.[0] || '');
  if (!classId) throw new HttpsError('invalid-argument', 'Selecione uma classe.');
  await requireClassAccess(profile, classId);
  const title = String(request.data?.title ?? '').trim();
  if (title.length < 3) throw new HttpsError('invalid-argument', 'Informe o título do conteúdo.');
  const reference = await db.collection('weeklyContent').add({
    classId, title, lessonPdfUrl: request.data?.lessonPdfUrl ?? null,
    bookPdfUrl: request.data?.bookPdfUrl ?? null, week: Number(request.data?.week ?? 1),
    quarter: Number(request.data?.quarter ?? 1), year: Number(request.data?.year ?? new Date().getFullYear()),
    createdBy: request.auth.uid, publishedAt: FieldValue.serverTimestamp(),
  });
  return { contentId: reference.id };
});

export const publishQuiz = onCall({ region }, async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta.');
  const profile = await requireLeader(request.auth.uid);
  const classId = String(request.data?.classId || profile.classIds?.[0] || '');
  if (!classId) throw new HttpsError('invalid-argument', 'Selecione uma classe.');
  const classData = await requireClassAccess(profile, classId);
  const questions = request.data?.questions as Array<{ prompt: string; options: string[]; correctIndex: number }> | undefined;
  if (!questions?.length || questions.some(item => !item.prompt || item.options?.length < 2 || item.correctIndex < 0 || item.correctIndex >= item.options.length)) throw new HttpsError('invalid-argument', 'Revise as perguntas e alternativas.');
  const reference = await db.collection('quizzes').add({
    classId, districtId: classData.districtId ?? '', ageGroup: classData.ageGroup ?? 'adolescentes',
    title: String(request.data?.title ?? 'Quiz semanal'), active: true,
    pointsPerQuestion: Math.min(Number(request.data?.pointsPerQuestion ?? 10), 20), questions,
    releaseAt: Timestamp.fromMillis(Number(request.data?.releaseAt ?? Date.now())),
    closesAt: Timestamp.fromMillis(Number(request.data?.closesAt ?? Date.now() + 7 * 24 * 60 * 60 * 1000)),
    createdBy: request.auth.uid, createdAt: FieldValue.serverTimestamp(),
  });
  return { quizId: reference.id };
});

export const reviewLeadershipItem = onCall({ region }, async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta.');
  const profile = await requireLeader(request.auth.uid);
  const type = String(request.data?.type ?? '');
  const itemId = String(request.data?.itemId ?? '');
  const approved = Boolean(request.data?.approved);
  if (!itemId || !['attendance', 'challenge', 'roleRequest'].includes(type)) throw new HttpsError('invalid-argument', 'Item inválido.');

  if (type === 'attendance') {
    const reference = db.collection('attendance').doc(itemId);
    const item = await reference.get();
    if (!item.exists) throw new HttpsError('not-found', 'Presença não encontrada.');
    await requireClassAccess(profile, item.data()!.classId);
    await reference.update({ status: approved ? 'approved' : 'rejected', reviewedBy: request.auth.uid, reviewedAt: FieldValue.serverTimestamp() });
  } else if (type === 'challenge') {
    const reference = db.collection('challenges').doc(itemId);
    const item = await reference.get();
    if (!item.exists || profile.role === 'director' || (profile.role === 'coordinator' && profile.districtId !== item.data()?.districtId)) throw new HttpsError('permission-denied', 'Desafio não autorizado.');
    await reference.update({ status: approved ? 'approved' : 'rejected', reviewedBy: request.auth.uid, reviewedAt: FieldValue.serverTimestamp() });
  } else {
    if (!['admin', 'coordinator'].includes(profile.role)) throw new HttpsError('permission-denied', 'Aprovação não autorizada.');
    const requestRef = db.collection('roleRequests').doc(itemId);
    const roleRequest = await requestRef.get();
    const data = roleRequest.data();
    if (!data || (data.requestedRole === 'coordinator' && profile.role !== 'admin') || (profile.role === 'coordinator' && profile.districtId !== data.districtId)) throw new HttpsError('permission-denied', 'Solicitação não autorizada.');
    const batch = db.batch();
    batch.update(requestRef, { status: approved ? 'approved' : 'rejected', reviewedBy: request.auth.uid, reviewedAt: FieldValue.serverTimestamp() });
    if (approved) batch.update(db.collection('users').doc(data.userId), { role: data.requestedRole, districtId: data.districtId ?? null, classIds: data.classId ? FieldValue.arrayUnion(data.classId) : [] });
    await batch.commit();
  }
  return { status: approved ? 'approved' : 'rejected' };
});
