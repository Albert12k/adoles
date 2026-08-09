import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

export interface MyDataSummary { name: string; email: string; role: string; studies: number; attendance: number; quizzes: number; activities: number; events: number; feedbacks: number; generatedAt: number; }
const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]!));
const dateLabel = (value: unknown) => (value as { toDate?: () => Date })?.toDate?.().toLocaleDateString('pt-BR') ?? '';

async function loadMyData() {
  if (!db || !auth?.currentUser) throw new Error('Entre novamente para acessar seus dados.');
  const uid = auth.currentUser.uid;
  const [profile, studies, attendance, quizzes, activities, events, feedbacks] = await Promise.all([
    getDoc(doc(db, 'users', uid)),
    getDocs(query(collection(db, 'studyRecords'), where('userId', '==', uid))),
    getDocs(query(collection(db, 'attendance'), where('userId', '==', uid))),
    getDocs(query(collection(db, 'quizAttempts'), where('userId', '==', uid))),
    getDocs(query(collection(db, 'activityParticipants'), where('userId', '==', uid))),
    getDocs(query(collection(db, 'eventRsvps'), where('userId', '==', uid))),
    getDocs(query(collection(db, 'eventFeedback'), where('userId', '==', uid))),
  ]);
  return { profile: profile.data() ?? {}, studies: studies.docs.map(item => item.data()), attendance: attendance.docs.map(item => item.data()), quizzes: quizzes.docs.map(item => item.data()), activities: activities.docs.map(item => item.data()), events: events.docs.map(item => item.data()), feedbacks: feedbacks.docs.map(item => item.data()) };
}

export async function loadMyDataSummary(): Promise<MyDataSummary> {
  const data = await loadMyData();
  return { name: String(data.profile.name ?? ''), email: String(data.profile.email ?? ''), role: String(data.profile.role ?? 'student'), studies: data.studies.length, attendance: data.attendance.length, quizzes: data.quizzes.length, activities: data.activities.length, events: data.events.length, feedbacks: data.feedbacks.length, generatedAt: Date.now() };
}

export async function exportMyData() {
  const data = await loadMyData();
  const summary: MyDataSummary = { name: String(data.profile.name ?? ''), email: String(data.profile.email ?? ''), role: String(data.profile.role ?? 'student'), studies: data.studies.length, attendance: data.attendance.length, quizzes: data.quizzes.length, activities: data.activities.length, events: data.events.length, feedbacks: data.feedbacks.length, generatedAt: Date.now() };
  const cards = [['Estudos', summary.studies], ['Presenças', summary.attendance], ['Quizzes', summary.quizzes], ['Atividades', summary.activities], ['Encontros', summary.events], ['Avaliações', summary.feedbacks]].map(([label, value]) => `<div class="card"><b>${value}</b><span>${label}</span></div>`).join('');
  const studyRows = data.studies.map(item => `<tr><td>${escapeHtml(dateLabel(item.createdAt))}</td><td>${escapeHtml(item.source ?? 'estudo')}</td><td>${escapeHtml(item.passage ?? '')}</td><td>${escapeHtml(item.summary ?? '')}</td><td>${escapeHtml(item.score ?? 0)}</td><td>${escapeHtml(item.feedback ?? '')}</td></tr>`).join('');
  const participationRows = [...data.attendance.map(item => ({ date: dateLabel(item.createdAt), type: 'Presença', status: item.status, detail: `Semana ${item.week ?? ''}` })), ...data.activities.map(item => ({ date: dateLabel(item.reviewedAt ?? item.registeredAt), type: 'Atividade', status: item.status, detail: `${item.points ?? 0} pontos` })), ...data.events.map(item => ({ date: dateLabel(item.confirmedAt), type: 'Encontro', status: item.status, detail: item.checkedIn ? 'Presença registrada' : 'Sem check-in' }))].map(item => `<tr><td>${escapeHtml(item.date)}</td><td>${escapeHtml(item.type)}</td><td>${escapeHtml(item.status)}</td><td>${escapeHtml(item.detail)}</td></tr>`).join('');
  const quizRows = data.quizzes.map(item => `<tr><td>${escapeHtml(dateLabel(item.createdAt))}</td><td>${escapeHtml(item.status)}</td><td>${escapeHtml(item.correctAnswers ?? 0)}</td><td>${escapeHtml(item.score ?? 0)}</td></tr>`).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>@page{size:A4;margin:16mm}body{font-family:Arial;color:#152420;font-size:10px}.hero{background:#0F3535;color:white;padding:24px;border-radius:16px}.hero h1{margin:6px 0}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:18px 0}.card{border:1px solid #DCE5DF;border-radius:10px;padding:12px}.card b{font-size:20px;color:#16504D;display:block}.card span{color:#60706A}h2{color:#0F3535;margin-top:22px}table{width:100%;border-collapse:collapse;font-size:8px}th{background:#16504D;color:white}th,td{padding:7px;border:1px solid #DCE5DF;vertical-align:top}.privacy{margin-top:20px;background:#EEF2ED;padding:12px;border-left:4px solid #E7A93D}</style></head><body><div class="hero"><div>VIVA IASD · CÓPIA DE DADOS PESSOAIS</div><h1>${escapeHtml(summary.name)}</h1><div>${escapeHtml(summary.email)} · ${escapeHtml(summary.role)}</div></div><div class="grid">${cards}</div><h2>Estudos e avaliações</h2><table><thead><tr><th>Data</th><th>Tipo</th><th>Referência</th><th>Resumo</th><th>Pontos</th><th>Retorno</th></tr></thead><tbody>${studyRows || '<tr><td colspan="6">Nenhum estudo registrado.</td></tr>'}</tbody></table><h2>Participações</h2><table><thead><tr><th>Data</th><th>Tipo</th><th>Status</th><th>Detalhe</th></tr></thead><tbody>${participationRows || '<tr><td colspan="4">Nenhuma participação registrada.</td></tr>'}</tbody></table><h2>Quizzes</h2><table><thead><tr><th>Data</th><th>Status</th><th>Acertos</th><th>Pontos</th></tr></thead><tbody>${quizRows || '<tr><td colspan="4">Nenhum quiz registrado.</td></tr>'}</tbody></table><div class="privacy">Este documento contém informações pessoais. Guarde-o em local seguro e evite compartilhá-lo publicamente.<br>Gerado em ${escapeHtml(new Date(summary.generatedAt).toLocaleString('pt-BR'))}.</div></body></html>`;
  if (Platform.OS === 'web') { await Print.printAsync({ html }); return null; }
  const file = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', dialogTitle: 'Minha cópia de dados VIVA IASD' });
  return file.uri;
}
