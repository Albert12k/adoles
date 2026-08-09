import { useEffect, useState } from 'react';
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

export interface WeeklyTask { key: string; label: string; points: number; done: boolean; tab: 'Estudo' | 'Presença' | 'Quiz' | 'Mais'; }
const toMillis = (value: unknown) => value && typeof (value as { toMillis?: () => number }).toMillis === 'function' ? (value as { toMillis: () => number }).toMillis() : 0;
const verses = [
  ['Seja forte e corajoso. Não tenha medo.', 'Josué 1:9'], ['Tudo posso naquele que me fortalece.', 'Filipenses 4:13'], ['O Senhor é o meu pastor; nada me faltará.', 'Salmo 23:1'], ['Lâmpada para os meus pés é a tua palavra.', 'Salmo 119:105'], ['Entrega o teu caminho ao Senhor; confia nele.', 'Salmo 37:5'], ['Alegrem-se sempre no Senhor.', 'Filipenses 4:4'], ['Nós amamos porque ele nos amou primeiro.', '1 João 4:19'], ['A resposta branda desvia o furor.', 'Provérbios 15:1'], ['O amigo ama em todos os momentos.', 'Provérbios 17:17'], ['Cria em mim, ó Deus, um coração puro.', 'Salmo 51:10'], ['Busquem primeiro o Reino de Deus.', 'Mateus 6:33'], ['Bem-aventurados os pacificadores.', 'Mateus 5:9'], ['A minha graça é suficiente para você.', '2 Coríntios 12:9'], ['Lancem sobre ele toda a sua ansiedade.', '1 Pedro 5:7'], ['O fruto do Espírito é amor, alegria e paz.', 'Gálatas 5:22'], ['Sejam bondosos e compassivos uns para com os outros.', 'Efésios 4:32'], ['O Senhor é a minha luz e a minha salvação.', 'Salmo 27:1'], ['Confie no Senhor de todo o seu coração.', 'Provérbios 3:5'], ['A fé vem por ouvir a mensagem.', 'Romanos 10:17'], ['Sirvam uns aos outros mediante o amor.', 'Gálatas 5:13'], ['Deus é o nosso refúgio e a nossa fortaleza.', 'Salmo 46:1'], ['Aquele que começou boa obra em vocês vai completá-la.', 'Filipenses 1:6'], ['Não se deixem vencer pelo mal, mas vençam o mal com o bem.', 'Romanos 12:21'], ['O coração alegre é bom remédio.', 'Provérbios 17:22'], ['A tua graça é melhor do que a vida.', 'Salmo 63:3'], ['Ensina-nos a contar os nossos dias.', 'Salmo 90:12'], ['Ame o seu próximo como a si mesmo.', 'Mateus 22:39'], ['Permaneçam firmes na fé.', '1 Coríntios 16:13'], ['O Senhor está perto de todos os que o invocam.', 'Salmo 145:18'], ['Façam tudo para a glória de Deus.', '1 Coríntios 10:31'], ['Jesus Cristo é o mesmo ontem, hoje e para sempre.', 'Hebreus 13:8'],
];
export const verseOfTheDay = () => { const now = new Date(); const start = new Date(now.getFullYear(), 0, 0); const day = Math.floor((now.getTime() - start.getTime()) / 86400000); const [text, reference] = verses[day % verses.length]; return { text, reference }; };

export function useWeeklyJourney(classId: string) {
  const [state, setState] = useState<{ title: string; tasks: WeeklyTask[] }>({ title: 'Semana atual', tasks: [] });
  useEffect(() => {
    if (!db || !auth?.currentUser || !classId) return;
    let active = true;
    const load = async () => {
      const uid = auth!.currentUser!.uid; const now = new Date(); const start = new Date(now); start.setDate(now.getDate() - ((now.getDay() + 6) % 7)); start.setHours(0, 0, 0, 0);
      const [contents, studies, attendance, quizzes, attempts, activities] = await Promise.all([
        getDocs(query(collection(db!, 'weeklyContent'), where('classId', '==', classId), orderBy('publishedAt', 'desc'), limit(1))),
        getDocs(query(collection(db!, 'studyRecords'), where('userId', '==', uid))),
        getDocs(query(collection(db!, 'attendance'), where('userId', '==', uid))),
        getDocs(query(collection(db!, 'quizzes'), where('classId', '==', classId), where('active', '==', true), orderBy('releaseAt', 'desc'), limit(1))),
        getDocs(query(collection(db!, 'quizAttempts'), where('userId', '==', uid))),
        getDocs(query(collection(db!, 'activityParticipants'), where('userId', '==', uid))),
      ]);
      const afterStart = (value: unknown) => toMillis(value) >= start.getTime();
      const quizId = quizzes.docs[0]?.id;
      const tasks: WeeklyTask[] = [
        { key: 'study', label: 'Estudo e resumo', points: 20, done: studies.docs.some(item => afterStart(item.data().createdAt)), tab: 'Estudo' },
        { key: 'attendance', label: 'Presença na base', points: 10, done: attendance.docs.some(item => item.data().status === 'approved' && afterStart(item.data().createdAt)), tab: 'Presença' },
        { key: 'quiz', label: 'Quiz semanal', points: 10, done: !!quizId && attempts.docs.some(item => item.data().quizId === quizId), tab: 'Quiz' },
        { key: 'activity', label: 'Atividade da base', points: 20, done: activities.docs.some(item => item.data().status === 'attended' && afterStart(item.data().reviewedAt)), tab: 'Mais' },
      ];
      if (active) setState({ title: contents.docs[0]?.data().title ?? 'Estudo da semana', tasks });
    };
    load().catch(() => undefined); return () => { active = false; };
  }, [classId]);
  return state;
}
