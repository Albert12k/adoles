import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where, writeBatch } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

export interface CoordinatorInvite { id: string; code: string; districtId: string; districtName: string; active: boolean; usedBy?: string; }
export interface CoordinatorAccount { id: string; name: string; email: string; districtId: string; districtName: string; active: boolean; }
const newCode = () => `COORD-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

export async function createCoordinatorInvite(districtId: string) {
  if (!db || !auth?.currentUser) throw new Error('Entre novamente para criar o convite.');
  if (!districtId) throw new Error('Selecione um distrito.');
  const district = await getDoc(doc(db, 'districts', districtId));
  if (!district.exists()) throw new Error('Distrito não encontrado.');
  const code = newCode();
  await setDoc(doc(db, 'coordinatorInvites', code), { code, districtId, districtName: district.data().name ?? districtId, active: true, createdBy: auth.currentUser.uid, createdAt: serverTimestamp() });
  return code;
}

export async function validateCoordinatorInvite(code: string) {
  if (!db) throw new Error('Firebase ainda não foi configurado.');
  const normalized = code.trim().toUpperCase();
  const invite = await getDoc(doc(db, 'coordinatorInvites', normalized));
  if (!invite.exists() || !invite.data().active) throw new Error('Convite de coordenador inválido ou já utilizado.');
  return { code: normalized, districtId: String(invite.data().districtId), districtName: String(invite.data().districtName ?? '') };
}

export async function listCoordinatorInvites(): Promise<CoordinatorInvite[]> {
  if (!db || !auth?.currentUser) return [];
  const result = await getDocs(query(collection(db, 'coordinatorInvites'), where('createdBy', '==', auth.currentUser.uid)));
  return result.docs.map(item => ({ id: item.id, ...(item.data() as Omit<CoordinatorInvite, 'id'>) }));
}

export async function listCoordinatorAccounts(): Promise<CoordinatorAccount[]> {
  if (!db || !auth?.currentUser) return [];
  const [users, districts] = await Promise.all([
    getDocs(query(collection(db, 'users'), where('role', '==', 'coordinator'))),
    getDocs(collection(db, 'districts')),
  ]);
  const districtNames = new Map(districts.docs.map(item => [item.id, String(item.data().name ?? item.id)]));
  return users.docs.map(item => ({ id: item.id, name: item.data().name ?? 'Coordenador', email: item.data().email ?? '', districtId: item.data().districtId ?? '', districtName: districtNames.get(item.data().districtId) ?? 'Sem distrito', active: item.data().active !== false }));
}

export async function updateCoordinatorAccount(userId: string, change: { active?: boolean; districtId?: string }) {
  if (!db || !auth?.currentUser) throw new Error('Entre novamente para gerenciar o coordenador.');
  const user = await getDoc(doc(db, 'users', userId));
  if (!user.exists() || user.data().role !== 'coordinator') throw new Error('Coordenador não encontrado.');
  const update: Record<string, unknown> = {};
  if (typeof change.active === 'boolean') update.active = change.active;
  if (change.districtId) {
    const district = await getDoc(doc(db, 'districts', change.districtId));
    if (!district.exists()) throw new Error('Distrito não encontrado.');
    update.districtId = change.districtId;
  }
  if (!Object.keys(update).length) return;
  const batch = writeBatch(db);
  batch.update(doc(db, 'users', userId), update);
  const auditRef = doc(collection(db, 'coordinatorAudit'));
  batch.set(auditRef, { coordinatorId: userId, coordinatorName: user.data().name ?? 'Coordenador', previousDistrictId: user.data().districtId ?? null, previousActive: user.data().active !== false, ...update, changedBy: auth.currentUser.uid, changedAt: serverTimestamp() });
  await batch.commit();
}
