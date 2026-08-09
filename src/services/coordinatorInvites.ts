import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

export interface CoordinatorInvite { id: string; code: string; districtId: string; districtName: string; active: boolean; usedBy?: string; }
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
