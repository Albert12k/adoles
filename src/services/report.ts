import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { getLeadershipReport } from './data';

const escapeHtml = (value: string | number) => String(value).replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]!));

export async function exportLeadershipReport(scope: { districtId?: string; classId?: string } = {}) {
  const report = await getLeadershipReport(scope);
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    body{font-family:Arial,sans-serif;color:#152420;padding:36px}h1{color:#0F3535;margin-bottom:4px}.sub{color:#60706A;margin-bottom:28px}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.card{border:1px solid #DCE5DF;border-radius:14px;padding:18px}.value{font-size:28px;font-weight:800;color:#16504D}.label{font-size:12px;color:#60706A;margin-top:5px}
    .footer{margin-top:32px;padding-top:14px;border-top:1px solid #DCE5DF;color:#60706A;font-size:10px}
  </style></head><body><h1>Relatório VIVA IASD</h1><div class="sub">Resumo consolidado do ministério</div><div class="grid">
    <div class="card"><div class="value">${escapeHtml(report.activeStudents)}</div><div class="label">Membros ativos</div></div>
    <div class="card"><div class="value">${escapeHtml(report.activeClasses)}</div><div class="label">Classes ativas</div></div>
    <div class="card"><div class="value">${escapeHtml(report.studies)}</div><div class="label">Estudos registrados</div></div>
    <div class="card"><div class="value">${escapeHtml(report.approvedAttendance)}</div><div class="label">Presenças aprovadas</div></div>
    <div class="card"><div class="value">${escapeHtml(report.totalPoints)}</div><div class="label">Pontos acumulados</div></div>
  </div><div class="footer">Gerado em ${escapeHtml(new Date(report.generatedAt).toLocaleString('pt-BR'))}</div></body></html>`;
  if (Platform.OS === 'web') {
    await Print.printAsync({ html });
    return null;
  }
  const file = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', dialogTitle: 'Compartilhar relatório VIVA IASD' });
  return file.uri;
}
