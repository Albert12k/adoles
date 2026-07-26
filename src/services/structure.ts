import { doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../config/firebase';

const slugify = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');

const inviteCode = () => `VIVA-${Math.floor(1000 + Math.random() * 9000)}`;

export async function createInitialStructure(input: { districtName: string; churchName: string; className: string }) {
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
    name: input.className.trim(), districtId, churchId, ageGroup: 'adolescentes',
    directorIds: [], activeMemberCount: 0, active: true, createdAt: serverTimestamp(),
  });
  batch.set(doc(db, 'classInvites', classId), {
    classId, districtId, inviteCode: code, active: true, updatedAt: serverTimestamp(),
  });
  await batch.commit();
  return { districtId, churchId, classId, inviteCode: code };
}
