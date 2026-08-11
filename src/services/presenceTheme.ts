import { collection, doc, getDoc, getDocs, limit, query, updateDoc, where } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

export interface PresenceScenario { id: string; world: string; name: string; icon: string; goal: string; intro: string; color: string; accent: string; }

const worlds = [
  { world: 'Montanhas', icon: '🏔️', goal: 'CUME', color: '#DCEDE9', accent: '#16504D', intro: 'Cada presença leva seu avatar mais perto do cume.' },
  { world: 'Oceanos', icon: '⛵', goal: 'ILHA', color: '#DCEFFA', accent: '#4E88A8', intro: 'Cada presença aproxima sua embarcação da ilha.' },
  { world: 'Jornadas', icon: '🧭', goal: 'DESTINO', color: '#F8E8C8', accent: '#E7A93D', intro: 'Cada presença abre uma nova etapa do caminho.' },
  { world: 'Jardins', icon: '🌱', goal: 'JARDIM', color: '#E3F0D8', accent: '#5D8C55', intro: 'Cada presença faz o jardim da turma florescer.' },
  { world: 'Espaço', icon: '🚀', goal: 'PLANETA', color: '#E4E0FA', accent: '#7769A8', intro: 'Cada presença impulsiona a missão para um novo planeta.' },
  { world: 'Deserto', icon: '🏜️', goal: 'OÁSIS', color: '#F8E4C9', accent: '#C87B3C', intro: 'Cada presença conduz a caravana para mais perto do oásis.' },
  { world: 'Floresta', icon: '🌳', goal: 'CLAREIRA', color: '#D9EBD8', accent: '#397552', intro: 'Cada presença revela um novo trecho da floresta.' },
  { world: 'Cidades', icon: '🏙️', goal: 'PRAÇA', color: '#E1E8EF', accent: '#536A80', intro: 'Cada presença ilumina mais uma parte da cidade.' },
  { world: 'Reinos', icon: '🏰', goal: 'CASTELO', color: '#F1DFEB', accent: '#9A5B82', intro: 'Cada presença aproxima a turma do grande castelo.' },
  { world: 'Céus', icon: '🎈', goal: 'NUVENS', color: '#DDF0F3', accent: '#438A96', intro: 'Cada presença faz a aventura subir ainda mais alto.' },
] as const;
const variations = ['da Coragem', 'da Esperança', 'da Amizade', 'da Fé', 'da Promessa', 'da União', 'da Alegria', 'da Descoberta', 'da Luz', 'do Propósito'];

export const presenceScenarios: PresenceScenario[] = worlds.flatMap((world, worldIndex) => variations.map((variation, variationIndex) => ({ id: `scenario-${worldIndex * 10 + variationIndex + 1}`, ...world, name: `${world.world} ${variation}` })));

const scenarioIndex = (classId: string) => {
  const now = new Date(); const quarter = Math.floor(now.getMonth() / 3) + 1;
  return [...`${classId}-${now.getFullYear()}-${quarter}`].reduce((total, char) => total + char.charCodeAt(0), 0) % presenceScenarios.length;
};

export function resolvePresenceScenario(setting: string, classId: string) {
  if (setting !== 'auto') return presenceScenarios.find(item => item.id === setting) ?? presenceScenarios[0];
  return presenceScenarios[scenarioIndex(classId)];
}

export async function getPresenceScenario(classId: string): Promise<{ setting: string; scenario: PresenceScenario }> {
  if (!db || !classId) return { setting: 'auto', scenario: presenceScenarios[0] };
  const snapshot = await getDoc(doc(db, 'classes', classId));
  const legacy = snapshot.data()?.presenceTheme as string | undefined;
  const legacyMap: Record<string, string> = { mountain: 'scenario-1', ocean: 'scenario-11', journey: 'scenario-21', garden: 'scenario-31' };
  const setting = String(snapshot.data()?.presenceScenario ?? legacyMap[legacy ?? ''] ?? 'auto');
  const custom = snapshot.data()?.customPresenceScenario as PresenceScenario | undefined;
  return { setting, scenario: setting === 'custom' && custom ? custom : resolvePresenceScenario(setting, classId) };
}

export async function updatePresenceScenario(setting: string, selectedClassId?: string) {
  if (!db || !auth?.currentUser) throw new Error('Entre novamente para alterar o cenário.');
  if (setting !== 'auto' && !presenceScenarios.some(item => item.id === setting)) throw new Error('Cenário inválido.');
  const directed = await getDocs(query(collection(db, 'classes'), where('directorIds', 'array-contains', auth.currentUser.uid), limit(10)));
  if (directed.empty) throw new Error('Nenhuma base está vinculada à sua conta.');
  const selected = selectedClassId ? directed.docs.find(item => item.id === selectedClassId) : directed.docs[0];
  if (!selected) throw new Error('A base selecionada não está vinculada à sua conta.');
  await updateDoc(doc(db, 'classes', selected.id), { presenceScenario: setting });
}

export async function importPresenceScenario(scenario: PresenceScenario, selectedClassId?: string) {
  if (!db || !auth?.currentUser) throw new Error('Entre novamente para importar o cenário.');
  if (!scenario.name.trim() || !scenario.intro.trim() || !scenario.goal.trim()) throw new Error('O cenário precisa de nome, descrição e meta final.');
  const directed = await getDocs(query(collection(db, 'classes'), where('directorIds', 'array-contains', auth.currentUser.uid), limit(10)));
  const selected = selectedClassId ? directed.docs.find(item => item.id === selectedClassId) : directed.docs[0];
  if (!selected) throw new Error('A base selecionada não está vinculada à sua conta.');
  const normalized: PresenceScenario = { ...scenario, id: 'custom', world: scenario.world || 'Personalizado', icon: scenario.icon || '✨', color: scenario.color || '#E3F0D8', accent: scenario.accent || '#16504D' };
  await updateDoc(doc(db, 'classes', selected.id), { presenceScenario: 'custom', customPresenceScenario: normalized });
  return normalized;
}
