import { useEffect, useState } from 'react';
import { collection, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { auth, db, firebaseEnabled } from '../config/firebase';
import { getManagedClass } from '../services/management';
import { getEquivalentClassIds } from '../services/classAliases';

export type ApprovalType = 'attendance' | 'challenge' | 'roleRequest' | 'classJoinRequest' | 'studyRecord' | 'quizAttempt' | 'flashcard' | 'leadershipTransfer';
export interface ApprovalItem { id: string; name: string; copy: string; userId?: string; details?: Array<{ question: string; answer: string }>; evidenceUrl?: string; }
export interface ClassMember { id: string; name: string; role: string; }
export interface LeadershipHistoryItem { id: string; className: string; action: 'transfer' | 'revoke'; targetName: string; status: string; reviewedAt?: Date; }

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
      const selectedIds = selectedClassId ? await getEquivalentClassIds(selectedClassId) : [];
      let approvalsQuery;
      if (type === 'attendance' || type === 'studyRecord' || type === 'quizAttempt') {
        const directed = await getDocs(query(collection(db!, 'classes'), where('directorIds', 'array-contains', user.uid), limit(10)));
        const ids = selectedClassId ? [selectedClassId] : directed.docs.map(item => item.id);
        if (!ids.length) return;
        approvalsQuery = type === 'attendance' ? query(collection(db!, 'attendance'), where('classId', '==', ids[0]), where('status', '==', 'pending'), orderBy('createdAt', 'desc'), limit(30)) : type === 'quizAttempt' ? query(collection(db!, 'quizAttempts'), where('classId', '==', ids[0]), where('status', '==', 'pending'), limit(30)) : query(collection(db!, 'studyRecords'), where('classId', '==', ids[0]), where('feedbackVisible', '==', false), limit(30));
      } else if (type === 'classJoinRequest' || type === 'flashcard') {
        if (profile.role === 'admin') {
          approvalsQuery = query(collection(db!, type === 'flashcard' ? 'flashcards' : 'classJoinRequests'), where('status', '==', 'pending'), limit(100));
        } else {
        const directed = await getDocs(query(collection(db!, 'classes'), where('directorIds', 'array-contains', user.uid), limit(10)));
        const ids = selectedIds.length ? selectedIds : directed.docs.map(item => item.id);
        if (!ids.length) return;
        approvalsQuery = selectedClassId
          ? type === 'classJoinRequest'
            ? query(collection(db!, 'classJoinRequests'), where('classId', '==', selectedClassId), where('status', '==', 'pending'), limit(100))
            : selectedIds.length === 1
              ? query(collection(db!, 'flashcards'), where('classId', '==', selectedIds[0]), limit(100))
              : query(collection(db!, 'flashcards'), where('classId', 'in', selectedIds.slice(0, 10)), limit(100))
          : query(collection(db!, type === 'flashcard' ? 'flashcards' : 'classJoinRequests'), where('classId', 'in', ids), limit(100));
        }
      } else if (type === 'leadershipTransfer') {
        approvalsQuery = profile.role === 'admin' ? query(collection(db!, 'leadershipTransfers'), where('status', '==', 'pending'), limit(30)) : query(collection(db!, 'leadershipTransfers'), where('districtId', '==', profile.districtId), where('status', '==', 'pending'), limit(30));
      } else if (type === 'challenge') {
        if (profile.role === 'admin') approvalsQuery = query(collection(db!, 'challenges'), where('status', '==', 'pending'), limit(30));
        else approvalsQuery = query(collection(db!, 'challenges'), where('districtId', '==', profile.districtId), where('status', '==', 'pending'), limit(30));
      } else {
        if (profile.role === 'admin') approvalsQuery = query(collection(db!, 'roleRequests'), where('status', '==', 'pending'), limit(30));
        else approvalsQuery = query(collection(db!, 'roleRequests'), where('districtId', '==', profile.districtId), where('status', '==', 'pending'), limit(30));
      }
      unsubscribe = onSnapshot(approvalsQuery, async snapshot => {
        const pending = snapshot.docs.filter(item => item.data().status === 'pending' || type === 'studyRecord' && item.data().feedbackVisible === false || type === 'flashcard' && item.data().status !== 'approved');
        const mapped = await Promise.all(pending.map(async item => {
          const data = item.data();
          let details: ApprovalItem['details'];
          let quizTitle = '';
          if (type === 'quizAttempt' && data.quizId) {
            const quiz = await getDoc(doc(db!, 'quizzes', String(data.quizId)));
            quizTitle = String(quiz.data()?.title ?? 'Quiz semanal');
            const questions = (quiz.data()?.questions ?? []) as Array<{ prompt?: string; options?: string[] }>;
            details = questions.map((question, index) => { const raw = (data.answers ?? [])[index]; const answer = typeof raw === 'number' && question.options?.[raw] != null ? question.options[raw] : String(raw ?? 'Sem resposta'); return { question: question.prompt ?? `Questão ${index + 1}`, answer }; });
          }
          return { id: item.id, userId: data.userId, name: data.name ?? data.title ?? data.userName ?? 'Adolescente', details, evidenceUrl: type === 'attendance' || type === 'challenge' ? data.evidenceUrl : undefined, copy: type === 'leadershipTransfer' ? (data.action === 'transfer' ? `Transferir ${data.className} para ${data.targetName}` : `Revogar direção de ${data.className}`) : type === 'flashcard' ? `${data.front} → ${data.back}` : type === 'quizAttempt' ? `${quizTitle} · ${details?.length ?? 0} resposta(s)` : type === 'studyRecord' ? `${data.source === 'bible' ? `Bíblia${data.passage ? ` · ${data.passage}` : ''}` : data.source === 'book' ? 'Livro' : 'Lição'} — ${String(data.summary ?? 'Resumo enviado')}` : type === 'attendance' ? `Semana ${data.week} · foto enviada para validação` : type === 'classJoinRequest' ? `${data.className ?? 'Base'} · ${data.ageGroup === 'pre-adolescentes' ? 'Pré-adolescentes' : 'Adolescentes'}` : type === 'challenge' ? `${data.className ?? 'Base'} · desafio mensal` : `Pedido para ${data.requestedRole === 'director' ? 'diretor' : data.requestedRole === 'teacher' ? 'professor' : 'coordenador'}` } as ApprovalItem;
        }));
        if (active) setItems(mapped);
      }, () => setItems([]));
    })();
    return () => { active = false; unsubscribe(); };
  }, [type, selectedClassId]);
  return items;
}

export function useClassManagement(selectedClassId?: string) {
  const [state, setState] = useState<{ classId: string; inviteCode: string; members: ClassMember[]; error: string }>({ classId: '', inviteCode: '', members: [], error: '' });
  useEffect(() => {
    const user = auth?.currentUser;
    if (!firebaseEnabled || !db || !user) return;
    let active = true;
    let unsubscribe: () => void = () => {};
    getManagedClass(selectedClassId).then(result => {
      if (!active) return;
      setState({ classId: result.classId, inviteCode: result.inviteCode, members: result.members, error: '' });
      if (result.classId) unsubscribe = onSnapshot(query(collection(db!, 'classMembers'), where('classId', '==', result.classId), where('active', '==', true), limit(100)), snapshot => {
        setState(current => ({ ...current, error: '', members: snapshot.docs.map(item => ({ id: item.data().userId, name: item.data().name, role: item.data().role })) }));
      }, error => setState(current => ({ ...current, error: error.message })));
    }).catch(error => setState(current => ({ ...current, error: error instanceof Error ? error.message : 'Não foi possível carregar os membros.' })));
    return () => { active = false; unsubscribe(); };
  }, [selectedClassId]);
  return state;
}

export function useLeadershipHistory(enabled: boolean) {
  const [items, setItems] = useState<LeadershipHistoryItem[]>([]);
  useEffect(() => {
    const user = auth?.currentUser;
    if (!enabled || !firebaseEnabled || !db || !user) return;
    let unsubscribe: () => void = () => {};
    getDoc(doc(db, 'users', user.uid)).then(profile => {
      const data = profile.data();
      if (!data) return;
      const historyQuery = data.role === 'admin'
        ? query(collection(db!, 'leadershipTransfers'), limit(50))
        : data.role === 'coordinator'
          ? query(collection(db!, 'leadershipTransfers'), where('districtId', '==', data.districtId), limit(50))
          : query(collection(db!, 'leadershipTransfers'), where('requestedBy', '==', user.uid), limit(50));
      unsubscribe = onSnapshot(historyQuery, snapshot => setItems(snapshot.docs.map(item => {
        const entry = item.data();
        return { id: item.id, className: entry.className ?? 'Base', action: entry.action ?? 'revoke', targetName: entry.targetName ?? '', status: entry.status ?? 'pending', reviewedAt: entry.reviewedAt?.toDate?.() };
      }).sort((a, b) => (b.reviewedAt?.getTime() ?? 0) - (a.reviewedAt?.getTime() ?? 0))));
    }).catch(() => undefined);
    return () => unsubscribe();
  }, [enabled]);
  return items;
}
