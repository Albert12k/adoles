import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

export interface ReportClassRow { classId: string; className: string; activeStudents: number; studies: number; attendance: number; quizCorrect: number; activities: number; points: number; closedPeriods: number; }
export interface LeadershipReport { scopeLabel: string; activeStudents: number; activeClasses: number; studies: number; approvedAttendance: number; quizCorrect: number; activities: number; totalPoints: number; closedPeriods: number; classes: ReportClassRow[]; generatedAt: number; }
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
  const memberDocs = memberGroups.flatMap(group => group.docs).filter(item => item.data().role !== 'director');
  const activeStudents = new Set(memberDocs.map(item => item.data().userId)).size;
  const closures = closureGroups.flatMap(group => group.docs).map(item => item.data());
  const entries = closures.flatMap(closure => closure.entries ?? []) as Array<{ summaries?: number; attendance?: number; correctQuizAnswers?: number; activities?: number; points?: number }>;
  const districtName = profile.districtId ? (await getDoc(doc(db, 'districts', profile.districtId))).data()?.name : '';
  const scopeLabel = profile.role === 'admin' ? 'Visão geral do projeto' : profile.role === 'coordinator' ? `Distrito ${districtName ?? ''}`.trim() : classesSnapshot.docs[0]?.data().name ?? 'Base';
  const classRows = classesSnapshot.docs.map(classDoc => {
    const classClosures = closures.filter(closure => closure.classId === classDoc.id);
    const classEntries = classClosures.flatMap(closure => closure.entries ?? []) as typeof entries;
    return { classId: classDoc.id, className: classDoc.data().name ?? 'Base', activeStudents: new Set(memberDocs.filter(item => item.data().classId === classDoc.id).map(item => item.data().userId)).size, studies: classEntries.reduce((sum, item) => sum + Number(item.summaries ?? 0), 0), attendance: classEntries.reduce((sum, item) => sum + Number(item.attendance ?? 0), 0), quizCorrect: classEntries.reduce((sum, item) => sum + Number(item.correctQuizAnswers ?? 0), 0), activities: classEntries.reduce((sum, item) => sum + Number(item.activities ?? 0), 0), points: classEntries.reduce((sum, item) => sum + Number(item.points ?? 0), 0), closedPeriods: classClosures.length };
  }).sort((a, b) => b.points - a.points);
  return { scopeLabel, activeStudents, activeClasses: classIds.length, studies: entries.reduce((sum, item) => sum + Number(item.summaries ?? 0), 0), approvedAttendance: entries.reduce((sum, item) => sum + Number(item.attendance ?? 0), 0), quizCorrect: entries.reduce((sum, item) => sum + Number(item.correctQuizAnswers ?? 0), 0), activities: entries.reduce((sum, item) => sum + Number(item.activities ?? 0), 0), totalPoints: entries.reduce((sum, item) => sum + Number(item.points ?? 0), 0), closedPeriods: closures.length, classes: classRows, generatedAt: Date.now() };
}

export async function exportLeadershipReport() {
  const report = await loadLeadershipReport();
  const cards = [['Membros ativos', report.activeStudents], ['Bases ativas', report.activeClasses], ['Resumos', report.studies], ['Presenças aprovadas', report.approvedAttendance], ['Acertos nos quizzes', report.quizCorrect], ['Atividades externas', report.activities], ['Pontos acumulados', report.totalPoints], ['Períodos encerrados', report.closedPeriods]].map(([label, value]) => `<div class="card"><div class="value">${escapeHtml(value)}</div><div class="label">${escapeHtml(label)}</div></div>`).join('');
  const rows = report.classes.map((item, index) => `<tr><td>${index + 1}</td><td><b>${escapeHtml(item.className)}</b></td><td>${item.activeStudents}</td><td>${item.studies}</td><td>${item.attendance}</td><td>${item.quizCorrect}</td><td>${item.activities}</td><td><b>${item.points}</b></td><td>${item.closedPeriods}</td></tr>`).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>@page{size:A4;margin:18mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#152420;margin:0;font-size:11px}.hero{background:#0F3535;color:white;border-radius:18px;padding:26px;margin-bottom:22px}.brand{color:#E7A93D;font-size:12px;font-weight:800;letter-spacing:2px}.hero h1{font-size:28px;margin:8px 0 4px}.hero p{color:#D9E8E4;margin:0}.section-title{font-size:16px;color:#0F3535;margin:24px 0 12px}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:9px}.card{border:1px solid #DCE5DF;border-radius:12px;padding:13px;min-height:70px}.value{font-size:22px;font-weight:800;color:#16504D}.label{font-size:9px;color:#60706A;margin-top:5px}table{width:100%;border-collapse:collapse;font-size:8px}thead{display:table-header-group}th{background:#16504D;color:white;padding:8px 5px;text-align:left}td{padding:8px 5px;border-bottom:1px solid #DCE5DF}tr:nth-child(even){background:#F4F7F4}.privacy{margin-top:20px;background:#EEF2ED;border-left:4px solid #E7A93D;padding:12px;color:#60706A}.footer{margin-top:22px;padding-top:12px;border-top:1px solid #DCE5DF;color:#60706A;font-size:8px;display:flex;justify-content:space-between}.detail{break-before:auto}</style></head><body><div class="hero"><div class="brand">VIVA IASD</div><h1>Relatório de liderança</h1><p>${escapeHtml(report.scopeLabel)} · dados consolidados de períodos oficialmente encerrados</p></div><h2 class="section-title">Resumo geral</h2><div class="grid">${cards}</div><div class="detail"><h2 class="section-title">Detalhamento por base</h2><table><thead><tr><th>#</th><th>Base</th><th>Membros</th><th>Resumos</th><th>Presenças</th><th>Acertos</th><th>Atividades</th><th>Pontos</th><th>Fechamentos</th></tr></thead><tbody>${rows || '<tr><td colspan="9">Nenhuma base disponível.</td></tr>'}</tbody></table></div><div class="privacy"><b>Privacidade:</b> este documento apresenta somente dados consolidados. Textos de resumos, respostas e avaliações individuais não são incluídos.</div><div class="footer"><span>Gerado em ${escapeHtml(new Date(report.generatedAt).toLocaleString('pt-BR'))}</span><span>VIVA IASD · Ministério de Adolescentes</span></div></body></html>`;
  if (Platform.OS === 'web') { await Print.printAsync({ html }); return null; }
  const file = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', dialogTitle: 'Compartilhar relatório VIVA IASD' });
  return file.uri;
}
