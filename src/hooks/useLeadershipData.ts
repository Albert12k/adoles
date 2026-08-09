import { useEffect, useState } from 'react';
import { collection, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { auth, db, firebaseEnabled } from '../config/firebase';
import { getManagedClass } from '../services/management';

export type ApprovalType = 'attendance' | 'challenge' | 'roleRequest' | 'classJoinRequest' | 'studyRecord' | 'quizAttempt' | 'flashcard';
export interface ApprovalItem { id: string; name: string; copy: string; }
export interface ClassMember { id: string; name: string; role: string; }

export function usePendingApprovals(type: ApprovalType | null, selectedClassId?: string) {
  const [items, setItems] = useState<ApprovalItem[]>([]);
  useEffect(() => {
    const user = auth?.currentUser;
    if (!firebaseEnabled || !db || !user || !type) return;
    let unsubscribe: () => void = () => {};
    let active = true;
    (async () => {
      const profile = (await getDoc(doc(db!, 'users', user.uid))).data();
      if (!profile || !active) return;
      let approvalsQuery;
      if (type === 'attendance' || type === 'studyRecord' || type === 'quizAttempt') {
        const directed = await getDocs(query(collection(db!, 'classes'), where('directorIds', 'array-contains', user.uid), limit(10)));
        const ids = selectedClassId ? [selectedClassId] : directed.docs.map(item => item.id);
        if (!ids.length) return;
        approvalsQuery = type === 'attendance' ? query(collection(db!, 'attendance'), where('classId', 'in', ids), where('status', '==', 'pending'), orderBy('createdAt', 'desc'), limit(30)) : type === 'quizAttempt' ? query(collection(db!, 'quizAttempts'), where('classId', 'in', ids), where('status', '==', 'pending'), limit(30)) : query(collection(db!, 'studyRecords'), where('classId', 'in', ids), where('feedbackVisible', '==', false), limit(30));
      } else if (type === 'classJoinRequest' || type === 'flashcard') {
        const directed = await getDocs(query(collection(db!, 'classes'), where('directorIds', 'array-contains', user.uid), limit(10)));
        const ids = selectedClassId ? [selectedClassId] : directed.docs.map(item => item.id);
        if (!ids.length) return;
        approvalsQuery = query(collection(db!, type === 'flashcard' ? 'flashcards' : 'classJoinRequests'), where('classId', 'in', ids), where('status', '==', 'pending'), limit(30));
      } else if (type === 'challenge') {
        if (profile.role === 'admin') approvalsQuery = query(collection(db!, 'challenges'), where('status', '==', 'pending'), limit(30));
        else approvalsQuery = query(collection(db!, 'challenges'), where('districtId', '==', profile.districtId), where('status', '==', 'pending'), limit(30));
      } else {
        if (profile.role === 'admin') approvalsQuery = query(collection(db!, 'roleRequests'), where('status', '==', 'pending'), limit(30));
        else approvalsQuery = query(collection(db!, 'roleRequests'), where('districtId', '==', profile.districtId), where('status', '==', 'pending'), limit(30));
      }
      unsubscribe = onSnapshot(approvalsQuery, snapshot => setItems(snapshot.docs.map(item => {
        const data = item.data();
        return { id: item.id, name: data.name ?? data.title ?? data.userName ?? 'Adolescente', copy: type === 'flashcard' ? `${data.front} → ${data.back}` : type === 'quizAttempt' ? 'Resposta do quiz aguardando correção' : type === 'studyRecord' ? String(data.summary ?? 'Resumo enviado') : type === 'attendance' ? `Semana ${data.week} · aguardando presença` : type === 'classJoinRequest' ? 'Solicitação para entrar na classe' : type === 'challenge' ? `${data.bonusPoints ?? 0} pontos · desafio mensal` : `Pedido para ${data.requestedRole === 'director' ? 'diretor' : 'coordenador'}` };
      })));
    })();
    return () => { active = false; unsubscribe(); };
  }, [type, selectedClassId]);
  return items;
}

export function useClassManagement(selectedClassId?: string) {
  const [state, setState] = useState<{ classId: string; inviteCode: string; members: ClassMember[] }>({ classId: '', inviteCode: '', members: [] });
  useEffect(() => {
    const user = auth?.currentUser;
    if (!firebaseEnabled || !db || !user) return;
    let active = true;
    let unsubscribe: () => void = () => {};
    getManagedClass(selectedClassId).then(result => {
      if (!active) return;
      setState({ classId: result.classId, inviteCode: result.inviteCode, members: result.members });
      if (result.classId) unsubscribe = onSnapshot(query(collection(db!, 'classMembers'), where('classId', '==', result.classId), where('active', '==', true), limit(100)), snapshot => {
        setState(current => ({ ...current, members: snapshot.docs.map(item => ({ id: item.data().userId, name: item.data().name, role: item.data().role })) }));
      });
    }).catch(() => undefined);
    return () => { active = false; unsubscribe(); };
  }, [selectedClassId]);
  return state;
}
