import { arrayUnion, collection, doc, getDocs, limit, orderBy, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

export interface PublicProfile { id: string; name: string; status?: string; themeColor?: string; classIds?: string[]; }
export interface MuralPost { id: string; icon: string; title: string; copy: string; reactions: string[]; }

export async function updateMyPublicProfile(status: string, themeColor: string) {
  if (!db || !auth?.currentUser) throw new Error('Entre novamente para editar seu perfil.');
  await updateDoc(doc(db, 'users', auth.currentUser.uid), { status: status.trim().slice(0, 80), themeColor });
}

export async function listClassProfiles(classId: string): Promise<PublicProfile[]> {
  if (!db || !classId) return [];
  const result = await getDocs(query(collection(db, 'users'), where('classIds', 'array-contains', classId), limit(60)));
  return result.docs.map(item => ({ id: item.id, ...(item.data() as Omit<PublicProfile, 'id'>) }));
}

export async function listMuralPosts(classId: string): Promise<MuralPost[]> {
  if (!db || !classId) return [];
  const result = await getDocs(query(collection(db, 'muralPosts'), where('classId', '==', classId), orderBy('createdAt', 'desc'), limit(30)));
  return result.docs.map(item => { const data = item.data() as Omit<MuralPost, 'id'>; return { id: item.id, ...data, icon: data.icon ?? '★', reactions: data.reactions ?? [] }; });
}

export async function reactToMuralPost(postId: string, emoji: string) {
  if (!db || !auth?.currentUser) throw new Error('Entre novamente para reagir.');
  await updateDoc(doc(db, 'muralPosts', postId), { reactions: arrayUnion(`${auth.currentUser.uid}:${emoji}`), updatedAt: serverTimestamp() });
}
