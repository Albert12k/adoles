import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore';
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
