import { addDoc, collection, doc, getDocs, limit, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

export interface Flashcard { id: string; classId: string; userId: string; userName: string; front: string; back: string; status: 'pending' | 'published' | 'rejected'; reviewerFeedback?: string; resubmissionCount?: number; }

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

export async function listMyFlashcards(): Promise<Flashcard[]> {
  if (!db || !auth?.currentUser) return [];
  const result = await getDocs(query(collection(db, 'flashcards'), where('userId', '==', auth.currentUser.uid), limit(30)));
  return result.docs.map(item => ({ id: item.id, ...(item.data() as Omit<Flashcard, 'id'>) }));
}

export async function resubmitFlashcard(card: Flashcard, input: { front: string; back: string }) {
  if (!db || !auth?.currentUser) throw new Error('Entre novamente para reenviar o cartão.');
  if (card.status !== 'rejected' || card.userId !== auth.currentUser.uid) throw new Error('Este cartão não pode ser reenviado.');
  if (input.front.trim().length < 3 || input.back.trim().length < 3) throw new Error('Preencha a frente e a resposta do cartão.');
  await updateDoc(doc(db, 'flashcards', card.id), { front: input.front.trim().slice(0, 180), back: input.back.trim().slice(0, 300), status: 'pending', reviewerFeedback: '', resubmissionCount: Number(card.resubmissionCount ?? 0) + 1, resubmittedAt: serverTimestamp() });
}
