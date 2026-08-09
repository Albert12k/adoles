import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

export interface LeadershipReport { scopeLabel: string; activeStudents: number; activeClasses: number; studies: number; approvedAttendance: number; quizCorrect: number; activities: number; totalPoints: number; closedPeriods: number; generatedAt: number; }
const escapeHtml = (value: string | number) => String(value).replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]!));
const groupsOf = <T,>(items: T[], size = 30) => Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));

export async function loadLeadershipReport(): Promise<LeadershipReport> {
  if (!db || !auth?.currentUser) throw new Error('Entre novamente para gerar o relatório.');
  const profile = (await getDoc(doc(db, 'users', auth.currentUser.uid))).data();
  if (!profile) throw new Error('Perfil de liderança não encontrado.');
  const classesSnapshot = profile.role === 'admin' ? await getDocs(collection(db, 'classes')) : profile.role === 'coordinator' ? await getDocs(query(collection(db, 'classes'), where('districtId', '==', profile.districtId))) : await getDocs(query(collection(db, 'classes'), where('directorIds', 'array-contains', auth.currentUser.uid)));
  const classIds = classesSnapshot.docs.map(item => item.id);
  const classGroups = groupsOf(classIds);
  const [memberGroups, closureGroups] = await Promise.all([
    Promise.all(classGroups.map(ids => getDocs(query(collection(db!, 'classMembers'), where('classId', 'in', ids), where('active', '==', true))))),
    Promise.all(classGroups.map(ids => getDocs(query(collection(db!, 'periodClosures'), where('classId', 'in', ids))))),
  ]);
  const activeStudents = new Set(memberGroups.flatMap(group => group.docs).filter(item => item.data().role !== 'director').map(item => item.data().userId)).size;
  const closures = closureGroups.flatMap(group => group.docs).map(item => item.data());
  const entries = closures.flatMap(closure => closure.entries ?? []) as Array<{ summaries?: number; attendance?: number; correctQuizAnswers?: number; activities?: number; points?: number }>;
  const districtName = profile.districtId ? (await getDoc(doc(db, 'districts', profile.districtId))).data()?.name : '';
  const scopeLabel = profile.role === 'admin' ? 'Visão geral do projeto' : profile.role === 'coordinator' ? `Distrito ${districtName ?? ''}`.trim() : classesSnapshot.docs[0]?.data().name ?? 'Base';
  return { scopeLabel, activeStudents, activeClasses: classIds.length, studies: entries.reduce((sum, item) => sum + Number(item.summaries ?? 0), 0), approvedAttendance: entries.reduce((sum, item) => sum + Number(item.attendance ?? 0), 0), quizCorrect: entries.reduce((sum, item) => sum + Number(item.correctQuizAnswers ?? 0), 0), activities: entries.reduce((sum, item) => sum + Number(item.activities ?? 0), 0), totalPoints: entries.reduce((sum, item) => sum + Number(item.points ?? 0), 0), closedPeriods: closures.length, generatedAt: Date.now() };
}

export async function exportLeadershipReport() {
  const report = await loadLeadershipReport();
  const cards = [['Membros ativos', report.activeStudents], ['Bases ativas', report.activeClasses], ['Resumos', report.studies], ['Presenças aprovadas', report.approvedAttendance], ['Acertos nos quizzes', report.quizCorrect], ['Atividades externas', report.activities], ['Pontos acumulados', report.totalPoints], ['Períodos encerrados', report.closedPeriods]].map(([label, value]) => `<div class="card"><div class="value">${escapeHtml(value)}</div><div class="label">${escapeHtml(label)}</div></div>`).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;color:#152420;padding:36px}h1{color:#0F3535;margin-bottom:4px}.sub{color:#60706A;margin-bottom:28px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.card{border:1px solid #DCE5DF;border-radius:14px;padding:18px}.value{font-size:28px;font-weight:800;color:#16504D}.label{font-size:12px;color:#60706A;margin-top:5px}.footer{margin-top:32px;padding-top:14px;border-top:1px solid #DCE5DF;color:#60706A;font-size:10px}</style></head><body><h1>Relatório VIVA IASD</h1><div class="sub">${escapeHtml(report.scopeLabel)} · dados de períodos oficialmente encerrados</div><div class="grid">${cards}</div><div class="footer">Gerado em ${escapeHtml(new Date(report.generatedAt).toLocaleString('pt-BR'))}</div></body></html>`;
  if (Platform.OS === 'web') { await Print.printAsync({ html }); return null; }
  const file = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', dialogTitle: 'Compartilhar relatório VIVA IASD' });
  return file.uri;
}
