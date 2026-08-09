import { collection, doc, getDoc, getDocs, limit, query, updateDoc, where } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

export type PresenceTheme = 'mountain' | 'ocean' | 'journey' | 'garden';

export async function getPresenceTheme(classId: string): Promise<PresenceTheme> {
  if (!db || !classId) return 'mountain';
  const snapshot = await getDoc(doc(db, 'classes', classId));
  return (snapshot.data()?.presenceTheme as PresenceTheme | undefined) ?? 'mountain';
}

export async function updatePresenceTheme(theme: PresenceTheme) {
  if (!db || !auth?.currentUser) throw new Error('Entre novamente para alterar o tema.');
  const directed = await getDocs(query(collection(db, 'classes'), where('directorIds', 'array-contains', auth.currentUser.uid), limit(1)));
  if (directed.empty) throw new Error('Nenhuma base está vinculada à sua conta.');
  await updateDoc(doc(db, 'classes', directed.docs[0].id), { presenceTheme: theme });
}
