import { useEffect, useState } from 'react';
import { collection, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { auth, db, firebaseEnabled } from '../config/firebase';
import { getManagedClass } from '../services/management';

export type ApprovalType = 'attendance' | 'challenge' | 'roleRequest';
export interface ApprovalItem { id: string; name: string; copy: string; }
export interface ClassMember { id: string; name: string; role: string; }

export function usePendingApprovals(type: ApprovalType | null) {
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
      if (type === 'attendance') {
        const directed = await getDocs(query(collection(db!, 'classes'), where('directorIds', 'array-contains', user.uid), limit(10)));
        const ids = directed.docs.map(item => item.id);
        if (!ids.length) return;
        approvalsQuery = query(collection(db!, 'attendance'), where('classId', 'in', ids), where('status', '==', 'pending'), orderBy('createdAt', 'desc'), limit(30));
      } else if (type === 'challenge') {
        if (profile.role === 'admin') approvalsQuery = query(collection(db!, 'challenges'), where('status', '==', 'pending'), limit(30));
        else approvalsQuery = query(collection(db!, 'challenges'), where('districtId', '==', profile.districtId), where('status', '==', 'pending'), limit(30));
      } else {
        if (profile.role === 'admin') approvalsQuery = query(collection(db!, 'roleRequests'), where('status', '==', 'pending'), limit(30));
        else approvalsQuery = query(collection(db!, 'roleRequests'), where('districtId', '==', profile.districtId), where('status', '==', 'pending'), limit(30));
      }
      unsubscribe = onSnapshot(approvalsQuery, snapshot => setItems(snapshot.docs.map(item => {
        const data = item.data();
        return { id: item.id, name: data.name ?? data.title ?? data.userName ?? 'Solicitação pendente', copy: type === 'attendance' ? `Semana ${data.week} · aguardando presença` : type === 'challenge' ? `${data.bonusPoints ?? 0} pontos · desafio mensal` : `Pedido para ${data.requestedRole === 'director' ? 'diretor' : 'coordenador'}` };
      })));
    })();
    return () => { active = false; unsubscribe(); };
  }, [type]);
  return items;
}

export function useClassManagement() {
  const [state, setState] = useState<{ classId: string; inviteCode: string; members: ClassMember[] }>({ classId: '', inviteCode: '', members: [] });
  useEffect(() => {
    const user = auth?.currentUser;
    if (!firebaseEnabled || !db || !user) return;
    let active = true;
    getManagedClass().then(result => { if (active) setState({ classId: result.classId, inviteCode: result.inviteCode, members: result.members }); }).catch(() => undefined);
    return () => { active = false; };
  }, []);
  return state;
}
