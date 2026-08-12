import { collection, doc, getDocs, limit, orderBy, query, runTransaction, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

export interface PublicProfile { id: string; name: string; status?: string; themeColor?: string; classIds?: string[]; role?: string; ageGroup?: string; }
export interface MuralPost { id: string; icon: string; title: string; copy: string; reactions: string[]; type?: string; evidence?: string; createdAt?: Date; }

export async function updateMyPublicProfile(status: string, themeColor: string) {
  if (!db || !auth?.currentUser) throw new Error('Entre novamente para editar seu perfil.');
  await updateDoc(doc(db, 'users', auth.currentUser.uid), { status: status.trim().slice(0, 80), themeColor });
}

export async function listClassProfiles(classId: string): Promise<PublicProfile[]> {
  if (!db || !classId) return [];
  const result = await getDocs(query(collection(db, 'users'), where('classIds', 'array-contains', classId), limit(60)));
  return result.docs
    .map(item => ({ id: item.id, ...(item.data() as Omit<PublicProfile, 'id'>) }))
    .filter(profile => !profile.role || profile.role === 'student');
}

export async function listMuralPosts(classId: string): Promise<MuralPost[]> {
  if (!db || !classId) return [];
  const result = await getDocs(query(collection(db, 'muralPosts'), where('classId', '==', classId), orderBy('createdAt', 'desc'), limit(30)));
  return result.docs.map(item => { const data = item.data(); return { id: item.id, ...(data as Omit<MuralPost, 'id' | 'createdAt'>), icon: data.icon ?? '★', reactions: data.reactions ?? [], createdAt: data.createdAt?.toDate?.() }; });
}

export async function reactToMuralPost(postId: string, emoji: string) {
  if (!db || !auth?.currentUser) throw new Error('Entre novamente para reagir.');
  let updated: string[] = [];
  await runTransaction(db, async transaction => {
    const reference = doc(db!, 'muralPosts', postId);
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists()) throw new Error('Publicação não encontrada.');
    const prefix = `${auth!.currentUser!.uid}:`;
    const current = (snapshot.data().reactions ?? []) as string[];
    const own = current.find(value => value.startsWith(prefix));
    updated = current.filter(value => !value.startsWith(prefix));
    if (own !== `${prefix}${emoji}`) updated.push(`${prefix}${emoji}`);
    transaction.update(reference, { reactions: updated, updatedAt: serverTimestamp() });
  });
  return updated;
}
