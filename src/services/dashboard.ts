import { collection, doc, getDoc, getDocs, query, where, type DocumentData, type QueryDocumentSnapshot } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

export interface DashboardInsights { pending: number; recent: number; alert: string; weeklyValues: number[]; weeklyLabels: string[]; trend: number; }

const timestampOf = (entry: QueryDocumentSnapshot<DocumentData>) => {
  const data = entry.data();
  return (data.updatedAt ?? data.reviewedAt ?? data.completedAt ?? data.createdAt ?? data.confirmedAt)?.toDate?.() as Date | undefined;
};

export async function loadDashboardInsights(role: 'diretor' | 'coordenador' | 'admin', classId = ''): Promise<DashboardInsights> {
  if (!db || !auth?.currentUser) return { pending: 0, recent: 0, alert: 'Entre novamente para atualizar o painel.', weeklyValues: Array(7).fill(0), weeklyLabels: [], trend: 0 };
  const profile = (await getDoc(doc(db, 'users', auth.currentUser.uid))).data();
  const districtId = String(profile?.districtId ?? '');
  let entries: QueryDocumentSnapshot<DocumentData>[] = [];
  let pending = 0;
  let alert = 'Nenhuma pendência urgente neste momento.';

  if (role === 'diretor' && classId) {
    const [joins, attendance, studies] = await Promise.all([
      getDocs(query(collection(db, 'classJoinRequests'), where('classId', '==', classId))),
      getDocs(query(collection(db, 'attendance'), where('classId', '==', classId))),
      getDocs(query(collection(db, 'studyRecords'), where('classId', '==', classId))),
    ]);
    entries = [...joins.docs, ...attendance.docs, ...studies.docs];
    const joinsPending = joins.docs.filter(item => item.data().status === 'pending').length;
    const attendancePending = attendance.docs.filter(item => item.data().status === 'pending').length;
    const studiesPending = studies.docs.filter(item => !item.data().evaluation || item.data().evaluation === 'resubmitted').length;
    pending = joinsPending + attendancePending + studiesPending;
    if (pending) alert = `${pending} item(ns) aguardam atenção: ${joinsPending} entrada(s), ${attendancePending} presença(s) e ${studiesPending} resumo(s).`;
  } else if (role === 'coordenador' && districtId) {
    const [requests, challenges, events] = await Promise.all([
      getDocs(query(collection(db, 'roleRequests'), where('districtId', '==', districtId))),
      getDocs(query(collection(db, 'challenges'), where('districtId', '==', districtId))),
      getDocs(query(collection(db, 'districtEvents'), where('districtId', '==', districtId))),
    ]);
    entries = [...requests.docs, ...challenges.docs, ...events.docs];
    const directors = requests.docs.filter(item => item.data().requestedRole === 'director' && item.data().status === 'pending').length;
    const challengePending = challenges.docs.filter(item => item.data().status === 'pending').length;
    pending = directors + challengePending;
    if (pending) alert = `${directors} solicitação(ões) de diretor e ${challengePending} desafio(s) aguardam análise.`;
  } else if (role === 'admin') {
    const [requests, audits, districts] = await Promise.all([getDocs(collection(db, 'roleRequests')), getDocs(collection(db, 'coordinatorAudit')), getDocs(collection(db, 'districts'))]);
    entries = [...requests.docs, ...audits.docs];
    const approvals = requests.docs.filter(item => item.data().status === 'pending').length;
    const uncovered = districts.docs.filter(item => !item.data().coordinatorId && !(item.data().coordinatorIds?.length > 0)).length;
    pending = approvals + uncovered;
    if (pending) alert = `${approvals} aprovação(ões) pendente(s) e ${uncovered} distrito(s) sem coordenador.`;
  }

  const now = Date.now();
  const week = 7 * 24 * 60 * 60 * 1000;
  const weeklyValues = Array.from({ length: 7 }, (_, index) => entries.filter(entry => { const time = timestampOf(entry)?.getTime(); if (!time) return false; const age = now - time; return age >= (6 - index) * week && age < (7 - index) * week; }).length);
  const weeklyLabels = Array.from({ length: 7 }, (_, index) => `S${index + 1}`);
  const recent = entries.filter(entry => { const time = timestampOf(entry)?.getTime(); return time && now - time < week; }).length;
  const previous = weeklyValues[5] ?? 0;
  const current = weeklyValues[6] ?? 0;
  const trend = previous ? Math.round((current - previous) / previous * 100) : current ? 100 : 0;
  return { pending, recent, alert, weeklyValues, weeklyLabels, trend };
}
