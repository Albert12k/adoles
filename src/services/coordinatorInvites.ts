import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, Timestamp, updateDoc, where, writeBatch } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

export interface CoordinatorInvite { id: string; code: string; districtId: string; districtName: string; active: boolean; usedBy?: string; cancelled?: boolean; expiresAt?: Date; }
export interface CoordinatorAccount { id: string; name: string; email: string; districtId: string; districtName: string; active: boolean; }
export interface CoordinatorAuditItem { id: string; coordinatorName: string; districtId?: string; active?: boolean; changedAt?: Date; }
const newCode = () => `COORD-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

export async function createCoordinatorInvite(districtId: string) {
  if (!db || !auth?.currentUser) throw new Error('Entre novamente para criar o convite.');
  if (!districtId) throw new Error('Selecione um distrito.');
  const district = await getDoc(doc(db, 'districts', districtId));
  if (!district.exists()) throw new Error('Distrito não encontrado.');
  const code = newCode();
  await setDoc(doc(db, 'coordinatorInvites', code), { code, districtId, districtName: district.data().name ?? districtId, active: true, createdBy: auth.currentUser.uid, createdAt: serverTimestamp(), expiresAt: Timestamp.fromDate(new Date(Date.now() + 7 * 86400000)) });
  return code;
}

export async function validateCoordinatorInvite(code: string) {
  if (!db) throw new Error('Firebase ainda não foi configurado.');
  const normalized = code.trim().toUpperCase();
  const invite = await getDoc(doc(db, 'coordinatorInvites', normalized));
  if (!invite.exists() || !invite.data().active || invite.data().cancelled) throw new Error('Convite de coordenador inválido ou já utilizado.');
  if (invite.data().expiresAt?.toMillis?.() < Date.now()) throw new Error('Este convite expirou. Solicite um novo código ao administrador.');
  return { code: normalized, districtId: String(invite.data().districtId), districtName: String(invite.data().districtName ?? '') };
}

export async function listCoordinatorInvites(): Promise<CoordinatorInvite[]> {
  if (!db || !auth?.currentUser) return [];
  const result = await getDocs(query(collection(db, 'coordinatorInvites'), where('createdBy', '==', auth.currentUser.uid)));
  return result.docs.map(item => ({ id: item.id, ...(item.data() as Omit<CoordinatorInvite, 'id' | 'expiresAt'>), expiresAt: item.data().expiresAt?.toDate?.() }));
}

export async function cancelCoordinatorInvite(inviteId: string) {
  if (!db || !auth?.currentUser) throw new Error('Entre novamente para cancelar o convite.');
  await updateDoc(doc(db, 'coordinatorInvites', inviteId), { active: false, cancelled: true, cancelledBy: auth.currentUser.uid, cancelledAt: serverTimestamp() });
}

export async function listCoordinatorAudit(): Promise<CoordinatorAuditItem[]> {
  if (!db || !auth?.currentUser) return [];
  const result = await getDocs(collection(db, 'coordinatorAudit'));
  return result.docs.map(item => ({ id: item.id, coordinatorName: item.data().coordinatorName ?? 'Coordenador', districtId: item.data().districtId, active: item.data().active, changedAt: item.data().changedAt?.toDate?.() })).sort((a, b) => (b.changedAt?.getTime() ?? 0) - (a.changedAt?.getTime() ?? 0));
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
