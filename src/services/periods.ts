import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { collection, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

export type PeriodKind = 'quarter' | 'year';
export interface PeriodEntry { userId: string; name: string; summaries: number; activities: number; correctQuizAnswers: number; attendance: number; points: number; position: number; }
export interface PeriodClosure { id: string; classId: string; className: string; kind: PeriodKind; periodLabel: string; entries: PeriodEntry[]; }

const dateOf = (value: unknown) => value && typeof (value as { toDate?: () => Date }).toDate === 'function' ? (value as { toDate: () => Date }).toDate() : null;

export async function closeCurrentPeriod(kind: PeriodKind): Promise<PeriodClosure> {
  if (!db || !auth?.currentUser) throw new Error('Entre novamente para encerrar o período.');
  const classes = await getDocs(query(collection(db, 'classes'), where('directorIds', 'array-contains', auth.currentUser.uid), limit(1)));
  if (classes.empty) throw new Error('Nenhuma classe foi vinculada ao seu perfil.');
  const classDoc = classes.docs[0];
  const classId = classDoc.id;
  const now = new Date();
  const year = now.getFullYear();
  const quarter = Math.floor(now.getMonth() / 3) + 1;
  const periodKey = kind === 'quarter' ? `${year}-Q${quarter}` : `${year}-YEAR`;
  const closureId = `${classId}_${periodKey}`;
  if ((await getDoc(doc(db, 'periodClosures', closureId))).exists()) throw new Error('Este período já foi encerrado.');
  const start = kind === 'quarter' ? new Date(year, (quarter - 1) * 3, 1) : new Date(year, 0, 1);
  const end = kind === 'quarter' ? new Date(year, quarter * 3, 1) : new Date(year + 1, 0, 1);
  const [members, studies, attendance, attempts] = await Promise.all([
    getDocs(query(collection(db, 'classMembers'), where('classId', '==', classId), where('active', '==', true))),
    getDocs(query(collection(db, 'studyRecords'), where('classId', '==', classId))),
    getDocs(query(collection(db, 'attendance'), where('classId', '==', classId))),
    getDocs(query(collection(db, 'quizAttempts'), where('classId', '==', classId), where('status', '==', 'reviewed'))),
  ]);
  const inPeriod = (value: unknown) => { const date = dateOf(value); return !!date && date >= start && date < end; };
  const entries = members.docs.map(member => {
    const userId = member.data().userId as string;
    const userStudies = studies.docs.filter(item => item.data().userId === userId && inPeriod(item.data().createdAt));
    const userAttendance = attendance.docs.filter(item => item.data().userId === userId && item.data().status === 'approved' && inPeriod(item.data().createdAt));
    const userAttempts = attempts.docs.filter(item => item.data().userId === userId && inPeriod(item.data().createdAt));
    const correctQuizAnswers = userAttempts.reduce((total, item) => total + Number(item.data().correctAnswers ?? 0), 0);
    const summaries = userStudies.length;
    const presence = userAttendance.length;
    return { userId, name: member.data().name ?? 'Adolescente', summaries, activities: summaries + presence + userAttempts.length, correctQuizAnswers, attendance: presence, points: summaries * 20 + presence * 10 + correctQuizAnswers * 10, position: 0 };
  }).sort((a, b) => b.points - a.points);
  let previousPoints: number | null = null;
  let position = 0;
  const ranked = entries.map((entry, index) => { if (entry.points !== previousPoints) position = index + 1; previousPoints = entry.points; return { ...entry, position }; });
  const periodLabel = kind === 'quarter' ? `${quarter}º trimestre de ${year}` : `Ano de ${year}`;
  const closure = { classId, className: classDoc.data().name, kind, periodKey, periodLabel, entries: ranked, closedBy: auth.currentUser.uid, closedAt: serverTimestamp() };
  await setDoc(doc(db, 'periodClosures', closureId), closure);
  return { id: closureId, classId, className: classDoc.data().name, kind, periodLabel, entries: ranked };
}

export async function listPeriodClosures(classId?: string): Promise<PeriodClosure[]> {
  if (!db || !auth?.currentUser) return [];
  let selectedClassId = classId;
  if (!selectedClassId) {
    const classes = await getDocs(query(collection(db, 'classes'), where('directorIds', 'array-contains', auth.currentUser.uid), limit(1)));
    selectedClassId = classes.docs[0]?.id;
  }
  if (!selectedClassId) return [];
  const result = await getDocs(query(collection(db, 'periodClosures'), where('classId', '==', selectedClassId), orderBy('closedAt', 'desc'), limit(12)));
  return result.docs.map(item => ({ id: item.id, ...(item.data() as Omit<PeriodClosure, 'id'>) }));
}

const escapeHtml = (value: string | number) => String(value).replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]!));

export async function exportPeriodClosure(report: PeriodClosure) {
  const rows = report.entries.map(entry => `<tr><td>${entry.position}º</td><td>${escapeHtml(entry.name)}</td><td>${entry.summaries}</td><td>${entry.activities}</td><td>${entry.correctQuizAnswers}</td><td>${entry.attendance}</td><td><b>${entry.points}</b></td></tr>`).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:Arial;color:#152420;padding:32px}h1{color:#0F3535}.sub{color:#60706A;margin-bottom:24px}table{width:100%;border-collapse:collapse}th{background:#0F3535;color:white}th,td{padding:10px;border:1px solid #DCE5DF;text-align:left}tr:nth-child(even){background:#F3F6F3}.footer{margin-top:24px;color:#60706A;font-size:10px}</style></head><body><h1>Relatório VIVA IASD</h1><div class="sub">${escapeHtml(report.className)} · ${escapeHtml(report.periodLabel)}</div><table><thead><tr><th>Pos.</th><th>Adolescente</th><th>Resumos</th><th>Atividades</th><th>Acertos</th><th>Presenças</th><th>Pontos</th></tr></thead><tbody>${rows}</tbody></table><div class="footer">Documento gerado pelo VIVA IASD em ${escapeHtml(new Date().toLocaleString('pt-BR'))}</div></body></html>`;
  if (Platform.OS === 'web') { await Print.printAsync({ html }); return null; }
  const file = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', dialogTitle: `Relatório ${report.periodLabel}` });
  return file.uri;
}
