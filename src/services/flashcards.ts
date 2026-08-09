import { addDoc, collection, getDocs, query, serverTimestamp, where } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

export interface Flashcard { id: string; classId: string; userId: string; userName: string; front: string; back: string; status: 'pending' | 'published' | 'rejected'; }

export async function createFlashcard(input: { classId: string; userName: string; front: string; back: string }) {
  if (!db || !auth?.currentUser) throw new Error('Entre novamente para criar um flashcard.');
  if (!input.classId) throw new Error('Aguarde sua entrada em uma classe.');
  return addDoc(collection(db, 'flashcards'), { classId: input.classId, userId: auth.currentUser.uid, userName: input.userName, front: input.front.trim(), back: input.back.trim(), status: 'pending', createdAt: serverTimestamp() });
}

export async function listPublishedFlashcards(classId: string): Promise<Flashcard[]> {
  if (!db || !classId) return [];
  const result = await getDocs(query(collection(db, 'flashcards'), where('classId', '==', classId), where('status', '==', 'published')));
  return result.docs.map(item => ({ id: item.id, ...(item.data() as Omit<Flashcard, 'id'>) }));
}
