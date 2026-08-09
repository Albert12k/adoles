import { collection, doc, getDoc, getDocs, query, where, type DocumentData, type QueryDocumentSnapshot } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

export type ActivityCategory = 'cadastro' | 'estudo' | 'presenca' | 'desafio' | 'evento' | 'lideranca';
export interface LeadershipActivity { id: string; category: ActivityCategory; icon: string; title: string; copy: string; occurredAt: Date; }

const dateOf = (data: DocumentData) => {
  const value = data.updatedAt ?? data.reviewedAt ?? data.completedAt ?? data.cancelledAt ?? data.changedAt ?? data.requestedAt ?? data.createdAt ?? data.confirmedAt;
  return value?.toDate?.() ?? new Date(0);
};

const item = (docItem: QueryDocumentSnapshot<DocumentData>, category: ActivityCategory, icon: string, title: string, copy: string): LeadershipActivity => ({ id: `${category}_${docItem.id}`, category, icon, title, copy, occurredAt: dateOf(docItem.data()) });

export async function listLeadershipActivity(role: 'diretor' | 'coordenador' | 'admin', classId = ''): Promise<LeadershipActivity[]> {
  if (!db || !auth?.currentUser) return [];
  const profile = (await getDoc(doc(db, 'users', auth.currentUser.uid))).data();
  const districtId = String(profile?.districtId ?? '');
  let activities: LeadershipActivity[] = [];

  if (role === 'diretor' && classId) {
    const [attendance, studies, joins] = await Promise.all([
      getDocs(query(collection(db, 'attendance'), where('classId', '==', classId))),
      getDocs(query(collection(db, 'studyRecords'), where('classId', '==', classId))),
      getDocs(query(collection(db, 'classJoinRequests'), where('classId', '==', classId))),
    ]);
    activities = [
      ...attendance.docs.map(entry => item(entry, 'presenca', '✓', `Presença ${entry.data().status === 'approved' ? 'aprovada' : entry.data().status === 'rejected' ? 'devolvida' : 'recebida'}`, `${entry.data().userName ?? 'Adolescente'} · semana ${entry.data().week ?? 'atual'}`)),
      ...studies.docs.map(entry => item(entry, 'estudo', '▤', entry.data().evaluation ? 'Resumo avaliado' : 'Novo resumo recebido', `${entry.data().userName ?? 'Adolescente'} · ${entry.data().type ?? 'estudo semanal'}`)),
      ...joins.docs.map(entry => item(entry, 'cadastro', '♙', `Entrada ${entry.data().status === 'approved' ? 'aprovada' : entry.data().status === 'rejected' ? 'recusada' : 'solicitada'}`, entry.data().name ?? entry.data().userName ?? 'Novo adolescente')),
    ];
  } else if (role === 'coordenador' && districtId) {
    const [requests, challenges, events] = await Promise.all([
      getDocs(query(collection(db, 'roleRequests'), where('districtId', '==', districtId))),
      getDocs(query(collection(db, 'challenges'), where('districtId', '==', districtId))),
      getDocs(query(collection(db, 'districtEvents'), where('districtId', '==', districtId))),
    ]);
    activities = [
      ...requests.docs.map(entry => item(entry, 'lideranca', '♙', `Diretor ${entry.data().status === 'approved' ? 'aprovado' : entry.data().status === 'rejected' ? 'recusado' : 'aguardando análise'}`, entry.data().name ?? 'Solicitação de liderança')),
      ...challenges.docs.map(entry => item(entry, 'desafio', '◆', `Desafio ${entry.data().status === 'approved' ? 'validado' : entry.data().status === 'rejected' ? 'devolvido' : 'recebido'}`, entry.data().title ?? 'Desafio da base')),
      ...events.docs.map(entry => item(entry, 'evento', '◉', entry.data().status === 'completed' ? 'Encontro concluído' : entry.data().status === 'cancelled' ? 'Encontro cancelado' : 'Encontro publicado', entry.data().title ?? 'Encontro distrital')),
    ];
  } else if (role === 'admin') {
    const [requests, audits, transfers] = await Promise.all([
      getDocs(collection(db, 'roleRequests')),
      getDocs(collection(db, 'coordinatorAudit')),
      getDocs(collection(db, 'leadershipTransfers')),
    ]);
    activities = [
      ...requests.docs.map(entry => item(entry, 'lideranca', '♙', 'Solicitação de liderança', `${entry.data().name ?? 'Usuário'} · ${entry.data().status ?? 'pending'}`)),
      ...audits.docs.map(entry => item(entry, 'lideranca', '⚙', 'Alteração de coordenador', entry.data().coordinatorName ?? 'Conta administrativa')),
      ...transfers.docs.map(entry => item(entry, 'lideranca', '⇄', 'Transferência de direção', `${entry.data().status ?? 'pending'} · ${entry.data().className ?? 'base'}`)),
    ];
  }
  return activities.filter(entry => entry.occurredAt.getTime() > 0).sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime()).slice(0, 80);
}
