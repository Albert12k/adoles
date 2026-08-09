import { collection, doc, getDoc, getDocs, query, serverTimestamp, where, writeBatch } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

const slugify = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');

const inviteCode = () => `VIVA-${Math.floor(1000 + Math.random() * 9000)}`;

export async function createInitialStructure(input: { districtName: string; churchName: string; className: string; ageGroup: 'adolescentes' | 'pre-adolescentes' }) {
  if (!db) throw new Error('Firebase ainda não foi configurado.');
  const districtId = slugify(input.districtName);
  const churchId = `${districtId}-${slugify(input.churchName)}`;
  const classId = `${churchId}-${slugify(input.className)}`;
  if (!districtId || !churchId || !classId) throw new Error('Preencha os nomes da estrutura.');

  const code = inviteCode();
  const batch = writeBatch(db);
  batch.set(doc(db, 'districts', districtId), {
    name: input.districtName.trim(), active: true, createdAt: serverTimestamp(),
  });
  batch.set(doc(db, 'churches', churchId), {
    name: input.churchName.trim(), districtId, active: true, createdAt: serverTimestamp(),
  });
  batch.set(doc(db, 'classes', classId), {
    name: input.className.trim(), districtId, churchId, ageGroup: input.ageGroup,
    directorIds: [], activeMemberCount: 0, active: true, createdAt: serverTimestamp(),
  });
  batch.set(doc(db, 'classInvites', classId), {
    classId, districtId, inviteCode: code, active: true, updatedAt: serverTimestamp(),
  });
  batch.set(doc(db, 'classInviteCodes', code), {
    classId, districtId, active: true, createdAt: serverTimestamp(),
  });
  await batch.commit();
  return { districtId, churchId, classId, inviteCode: code };
}

export interface StructureItem { id: string; name: string; kind: 'district' | 'church' | 'class'; detail: string; }

export async function listStructures(): Promise<StructureItem[]> {
  if (!db || !auth?.currentUser) return [];
  const profile = (await getDoc(doc(db, 'users', auth.currentUser.uid))).data();
  const districtId = profile?.role === 'coordinator' ? profile.districtId : '';
  const [districts, churches, classes] = await Promise.all([
    getDocs(districtId ? query(collection(db, 'districts'), where('__name__', '==', districtId)) : collection(db, 'districts')),
    getDocs(districtId ? query(collection(db, 'churches'), where('districtId', '==', districtId)) : collection(db, 'churches')),
    getDocs(districtId ? query(collection(db, 'classes'), where('districtId', '==', districtId)) : collection(db, 'classes')),
  ]);
  return [
    ...districts.docs.map(item => ({ id: item.id, name: item.data().name, kind: 'district' as const, detail: 'Distrito' })),
    ...churches.docs.map(item => ({ id: item.id, name: item.data().name, kind: 'church' as const, detail: 'Igreja' })),
    ...classes.docs.map(item => ({ id: item.id, name: item.data().name, kind: 'class' as const, detail: item.data().ageGroup === 'pre-adolescentes' ? 'Base de pré-adolescentes' : 'Base de adolescentes' })),
  ];
}

export async function createCoordinatorStructure(input: { churchName: string; className: string; ageGroup: 'adolescentes' | 'pre-adolescentes' }) {
  if (!db || !auth?.currentUser) throw new Error('Entre novamente para continuar.');
  const profile = (await getDoc(doc(db, 'users', auth.currentUser.uid))).data();
  const districtId = String(profile?.districtId || '');
  if (profile?.role !== 'coordinator' || !districtId) throw new Error('Sua conta ainda não possui um distrito aprovado.');
  const churchId = `${districtId}-${slugify(input.churchName)}`;
  const classId = `${churchId}-${slugify(input.className)}`;
  const code = inviteCode();
  const batch = writeBatch(db);
  batch.set(doc(db, 'churches', churchId), { name: input.churchName.trim(), districtId, active: true, createdAt: serverTimestamp() });
  batch.set(doc(db, 'classes', classId), { name: input.className.trim(), districtId, churchId, ageGroup: input.ageGroup, directorIds: [], activeMemberCount: 0, active: true, createdAt: serverTimestamp() });
  batch.set(doc(db, 'classInvites', classId), { classId, districtId, inviteCode: code, active: true, updatedAt: serverTimestamp() });
  batch.set(doc(db, 'classInviteCodes', code), { classId, districtId, active: true, createdAt: serverTimestamp() });
  await batch.commit();
  return { classId, inviteCode: code };
}
