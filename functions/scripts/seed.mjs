process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080';
process.env.GCLOUD_PROJECT ||= 'demo-viva-iasd';

const { initializeApp } = await import('firebase-admin/app');
const { getFirestore, Timestamp } = await import('firebase-admin/firestore');

initializeApp({ projectId: process.env.GCLOUD_PROJECT });
const db = getFirestore();
const batch = db.batch();
const now = Date.now();

const district = db.collection('districts').doc('salvador-centro');
const church = db.collection('churches').doc('iasd-central');
const ministryClass = db.collection('classes').doc('base-geracao');

batch.set(district, { name: 'Salvador Centro', active: true });
batch.set(church, { name: 'IASD Central', districtId: district.id, active: true });
batch.set(ministryClass, {
  name: 'Base Geração', churchId: church.id, districtId: district.id,
  ageGroup: 'adolescentes', directorIds: ['director-demo'], inviteCode: 'VIVA-7429',
  activeMemberCount: 4, active: true,
});

batch.set(db.collection('users').doc('director-demo'), {
  name: 'Albert Santos', email: 'diretor@viva.demo', role: 'director',
  districtId: district.id, churchId: church.id, classIds: [ministryClass.id], active: true,
});

for (const [id, name] of [['daniel-demo', 'Daniel Oliveira'], ['marina-demo', 'Marina Costa'], ['joao-demo', 'João Pedro'], ['sara-demo', 'Sara Lima']]) {
  batch.set(db.collection('users').doc(id), {
    name, email: `${id}@viva.demo`, role: 'student', districtId: district.id,
    churchId: church.id, classIds: [ministryClass.id], active: true,
  });
}

batch.set(db.collection('weeklyContent').doc('licao-5-demo'), {
  classId: ministryClass.id, title: 'Escolhas que transformam', week: 5,
  quarter: 3, year: new Date().getFullYear(), createdBy: 'director-demo',
  publishedAt: Timestamp.fromMillis(now),
});

batch.set(db.collection('quizzes').doc('quiz-5-demo'), {
  classId: ministryClass.id, districtId: district.id, ageGroup: 'adolescentes',
  title: 'Quiz da lição 5', active: true, pointsPerQuestion: 10,
  releaseAt: Timestamp.fromMillis(now - 60_000), closesAt: Timestamp.fromMillis(now + 7 * 24 * 60 * 60 * 1000),
  questions: [
    { id: 'q1', prompt: 'Quem conduziu o povo após Moisés?', options: ['Josué', 'Daniel', 'Davi', 'Samuel'], correctIndex: 0 },
    { id: 'q2', prompt: 'Onde encontramos “Seja forte e corajoso”?', options: ['Salmos 23', 'Josué 1', 'João 3', 'Gênesis 1'], correctIndex: 1 },
  ],
});

await batch.commit();
console.log('Base demonstrativa criada no Firestore Emulator. Código da classe: VIVA-7429');
