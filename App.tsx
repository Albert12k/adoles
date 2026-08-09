import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  ActivityIndicator,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { auth, firebaseEnabled } from './src/config/firebase';
import { getRegistrationOptions, getUserRole, loginUser, logoutUser, registerUser, resetUserPassword, subscribeToAuth } from './src/services/auth';
import type { RegistrationOptions } from './src/services/auth';
import { getMyQuizAttempt, getQuizRanking, getWeeklyQuiz, listMyAttendance, listMyStudyRecords, listQuizRankingHistory, listWeeklyContent, requestClassEntry, saveStudy, submitAttendance, submitQuizAnswers } from './src/services/data';
import { useLiveDashboard } from './src/hooks/useLiveDashboard';
import { manageClassMembership, publishContent, publishLatestQuizRanking, publishQuizContent, reviewLeadershipItem } from './src/services/management';
import { exportLeadershipReport } from './src/services/report';
import { selectAndUploadContentPdf } from './src/services/media';
import { registerPushNotifications } from './src/services/notifications';
import { useClassManagement, usePendingApprovals } from './src/hooks/useLeadershipData';
import type { ApprovalType } from './src/hooks/useLeadershipData';
import { createFlashcard, listPublishedFlashcards, type Flashcard } from './src/services/flashcards';
import { listApprovedChallenges, submitClassChallenge, type ClassChallenge } from './src/services/challenges';
import { createClassActivity, joinClassActivity, listClassActivities, listDirectedActivities, type ClassActivity } from './src/services/activities';
import { listClassProfiles, listMuralPosts, reactToMuralPost, updateMyPublicProfile, type MuralPost, type PublicProfile } from './src/services/community';
import { createCoordinatorStructure, createInitialStructure, listStructures, type StructureItem } from './src/services/structure';
import { useLeadershipProfile } from './src/hooks/useLeadershipProfile';
import { useStudentProfile } from './src/hooks/useStudentProfile';
import { useStudentProgress } from './src/hooks/useStudentProgress';
import { getPresenceTheme, updatePresenceTheme, type PresenceTheme } from './src/services/presenceTheme';
import { confirmEventAttendance, createDistrictEvent, listCurrentDistrictEvents, listDistrictEvents, type DistrictEvent } from './src/services/events';
import { closeCurrentPeriod, exportPeriodClosure, listPeriodClosures, type PeriodClosure, type PeriodKind } from './src/services/periods';

type Tab = 'Início' | 'Estudo' | 'Presença' | 'Quiz' | 'Mais';
type Role = 'adolescente' | 'diretor' | 'coordenador' | 'admin';
type AuthStep = 'welcome' | 'login' | 'register' | 'role' | 'invite';
type QuizQuestionDraft = { type: 'multiple_choice' | 'true_false' | 'assertion_reason' | 'open' | 'identify_false'; prompt: string; options: string[]; correctAnswer: number | string };

const quizQuestionTemplates: QuizQuestionDraft[] = [
  { type: 'multiple_choice', prompt: 'Quem recebeu a missão de conduzir o povo após Moisés?', options: ['Josué', 'Daniel', 'Davi', 'Samuel'], correctAnswer: 0 },
  { type: 'true_false', prompt: 'A coragem bíblica significa nunca sentir medo.', options: ['Verdadeiro', 'Falso'], correctAnswer: 1 },
  { type: 'assertion_reason', prompt: 'I. Josué deveria ser forte e corajoso. II. Porque Deus prometeu estar com ele. Como as afirmações se relacionam?', options: ['As duas são verdadeiras, e II explica I', 'As duas são verdadeiras, mas II não explica I', 'I é verdadeira e II é falsa', 'I é falsa e II é verdadeira'], correctAnswer: 0 },
  { type: 'identify_false', prompt: 'Qual alternativa NÃO combina com a mensagem de Josué 1?', options: ['Confiar em Deus', 'Agir com coragem', 'Desistir diante do medo', 'Guardar a Palavra'], correctAnswer: 2 },
  { type: 'open', prompt: 'Conte uma situação em que você pode praticar coragem nesta semana.', options: [], correctAnswer: 'avaliação do diretor' },
];

const colors = {
  ink: '#152420',
  teal: '#0F3535',
  tealMedium: '#16504D',
  gold: '#E7A93D',
  coral: '#E8683F',
  sage: '#EEF2ED',
  white: '#FFFFFF',
  muted: '#60706A',
  line: '#DCE5DF',
};

const tabs: { label: Tab; icon: string }[] = [
  { label: 'Início', icon: '⌂' },
  { label: 'Estudo', icon: '▤' },
  { label: 'Presença', icon: '⚑' },
  { label: 'Quiz', icon: '?' },
  { label: 'Mais', icon: '✦' },
];

function Pill({ children, tone = 'gold' }: { children: React.ReactNode; tone?: 'gold' | 'coral' | 'teal' }) {
  const backgroundColor = tone === 'gold' ? '#F8E8C8' : tone === 'coral' ? '#FBE0D6' : '#D9E8E4';
  const color = tone === 'gold' ? '#865A10' : tone === 'coral' ? '#A33A1D' : colors.teal;
  return <Text style={[styles.pill, { backgroundColor, color }]}>{children}</Text>;
}

function Progress({ value, color = colors.gold }: { value: number; color?: string }) {
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${value}%`, backgroundColor: color }]} />
    </View>
  );
}

function HomeScreen({ onNavigate, name, pending }: { onNavigate: (tab: Tab) => void; name: string; pending: boolean }) {
  return (
    <>
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View>
            <Text style={styles.eyebrowLight}>SÁBADO, 25 DE JULHO</Text>
            <Text style={styles.greeting}>Olá, {name}! 👋</Text>
          </View>
          <View style={styles.avatar}><Text style={styles.avatarText}>D</Text></View>
        </View>
        <Text style={styles.verse}>“Seja forte e corajoso. Não tenha medo.”</Text>
        <Text style={styles.verseRef}>Josué 1:9</Text>
      </View>

      {pending && <View style={styles.alertCard}><View style={styles.alertDot} /><View style={styles.flex}><Text style={styles.alertTitle}>Entrada aguardando aprovação</Text><Text style={styles.alertCopy}>O diretor da classe recebeu seu pedido. Você terá acesso ao conteúdo assim que ele aprovar.</Text></View></View>}

      <View style={styles.streakCard}>
        <View style={styles.streakIcon}><Text style={styles.streakEmoji}>🔥</Text></View>
        <View style={styles.flex}>
          <Text style={styles.streakTitle}>4 semanas em sequência!</Text>
          <Text style={styles.cardCaption}>Continue estudando para manter seu ritmo.</Text>
        </View>
        <Text style={styles.streakNumber}>4</Text>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Sua semana</Text>
        <Pill tone="teal">3 de 4 feitos</Pill>
      </View>
      <View style={styles.weekCard}>
        <View style={styles.weekRow}>
          <Text style={styles.weekTitle}>Lição 4 · Escolhas que transformam</Text>
          <Text style={styles.percent}>75%</Text>
        </View>
        <Progress value={75} />
        <View style={styles.taskRow}>
          <Text style={styles.taskDone}>✓</Text><Text style={styles.taskTextDone}>Lição da semana</Text>
          <Text style={styles.points}>+20 pts</Text>
        </View>
        <View style={styles.taskRow}>
          <Text style={styles.taskDone}>✓</Text><Text style={styles.taskTextDone}>Leitura da Bíblia</Text>
          <Text style={styles.points}>+15 pts</Text>
        </View>
        <Pressable style={styles.taskRow} onPress={() => onNavigate('Estudo')}>
          <Text style={styles.taskOpen}>○</Text><Text style={styles.taskText}>Resumo do livro</Text>
          <Text style={styles.taskAction}>Continuar ›</Text>
        </Pressable>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Próximos passos</Text>
      </View>
      <View style={styles.quickGrid}>
        <Pressable style={[styles.quickCard, styles.quizCard]} onPress={() => onNavigate('Quiz')}>
          <Text style={styles.quickIcon}>?</Text>
          <Text style={styles.quickTitle}>Quiz semanal</Text>
          <Text style={styles.quickMeta}>Liberado hoje · 19h</Text>
          <Text style={styles.countdown}>03:42:18</Text>
        </Pressable>
        <Pressable style={[styles.quickCard, styles.raceCard]} onPress={() => onNavigate('Presença')}>
          <Text style={styles.quickIcon}>⚑</Text>
          <Text style={styles.quickTitle}>Corrida</Text>
          <Text style={styles.quickMeta}>Você está na semana 7</Text>
          <Text style={styles.raceLink}>Ver trilha ›</Text>
        </Pressable>
      </View>
    </>
  );
}

function StudyScreen({ classId, userName }: { classId: string; userName: string }) {
  const [completed, setCompleted] = useState(false);
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState<{ id: string; title?: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [studyError, setStudyError] = useState('');
  const [feedback, setFeedback] = useState('');
  useEffect(() => { if (classId) listWeeklyContent(classId).then(items => setContent((items[0] as { id: string; title?: string } | undefined) ?? null)).catch(() => undefined); }, [classId]);
  useEffect(() => { if (auth?.currentUser) listMyStudyRecords(auth.currentUser.uid).then(items => { const reviewed = items.find(item => item.feedbackVisible); if (reviewed) setFeedback(String(reviewed.feedback ?? 'Resumo avaliado pelo diretor.')); }).catch(() => undefined); }, [completed]);
  const registerStudy = async () => {
    if (!firebaseEnabled) return setCompleted(!completed);
    if (!auth?.currentUser || !classId) return setStudyError('Aguarde a aprovação da sua entrada na classe.');
    if (!content) return setStudyError('O diretor ainda não publicou a lição desta semana.');
    if (summary.trim().length < 10) return setStudyError('Escreva um resumo com pelo menos 10 caracteres.');
    setSaving(true); setStudyError('');
    try {
      await saveStudy({ userId: auth.currentUser.uid, userName, classId, contentId: content.id, source: 'lesson', summary: summary.trim(), feedbackVisible: false });
      setCompleted(true);
    } catch (error) { setStudyError(error instanceof Error ? error.message : 'Não foi possível registrar o estudo.'); }
    finally { setSaving(false); }
  };
  return (
    <View style={styles.pagePad}>
      <Text style={styles.pageEyebrow}>ESTUDO SEMANAL</Text>
      <Text style={styles.pageTitle}>Cresça um pouco a cada dia.</Text>
      <Text style={styles.pageIntro}>Registre o que você aprendeu. Suas anotações são privadas.</Text>
      {[
        ['📖', 'Lição', content?.title ?? 'Aguardando publicação do diretor', content ? 'Conteúdo da semana' : 'Ainda não disponível', '#F8E8C8'],
        ['✦', 'Bíblia', 'Escolha seu texto', 'Leitura livre', '#DCEDE9'],
        ['▣', 'Livro', 'O maior discurso de Cristo', 'Capítulo 3', '#FBE0D6'],
      ].map(([icon, title, subtitle, meta, bg]) => (
        <Pressable key={title} style={styles.studyCard}>
          <View style={[styles.studyIcon, { backgroundColor: bg }]}><Text style={styles.studyEmoji}>{icon}</Text></View>
          <View style={styles.flex}>
            <Text style={styles.studyLabel}>{title}</Text>
            <Text style={styles.studyTitle}>{subtitle}</Text>
            <Text style={styles.cardCaption}>{meta}</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      ))}
      <View style={styles.summaryCard}>
        <Text style={styles.authLabel}>Meu resumo de hoje</Text>
        <Text style={styles.privateHint}>🔒 Somente você e seu diretor podem visualizar.</Text>
        <TextInput multiline value={summary} onChangeText={setSummary} placeholder="O que mais chamou sua atenção?" placeholderTextColor="#8A9892" style={[styles.authInput, styles.summaryInput]} />
        <Text style={styles.charCount}>{summary.length}/500</Text>
      </View>
      <Pressable style={[styles.primaryButton, completed && styles.buttonDone]} disabled={saving || completed} onPress={registerStudy}>
        <Text style={styles.primaryButtonText}>{saving ? 'Salvando...' : completed ? '✓ Estudo e resumo registrados' : 'Registrar estudo de hoje'}</Text>
      </Pressable>
      {studyError !== '' && <Text style={styles.authError}>{studyError}</Text>}
      {feedback !== '' && <Text style={styles.successNotice}>✓ {feedback}</Text>}
    </View>
  );
}

function AttendanceScreen({ classId, userName }: { classId: string; userName: string }) {
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState('');
  const [attendanceCount, setAttendanceCount] = useState(0);
  const [currentStatus, setCurrentStatus] = useState('');
  const [approvedWeeks, setApprovedWeeks] = useState<number[]>([]);
  const [presenceTheme, setPresenceTheme] = useState<PresenceTheme>('mountain');
  const now = new Date();
  const quarter = Math.floor(now.getMonth() / 3) + 1;
  const quarterStart = new Date(now.getFullYear(), (quarter - 1) * 3, 1);
  const currentWeek = Math.min(13, Math.floor((now.getTime() - quarterStart.getTime()) / (7 * 86400000)) + 1);
  const theme = ({ mountain: { title: 'Rumo ao topo! 🏔️', intro: 'Cada presença leva seu avatar mais perto do cume.', goal: '🏆 CUME', color: '#DCEDE9' }, ocean: { title: 'Navegando juntos! ⛵', intro: 'Cada presença aproxima sua embarcação da ilha.', goal: '🏝️ ILHA', color: '#DCEFFA' }, journey: { title: 'Jornada da fé! 🧭', intro: 'Cada presença abre uma nova etapa do caminho.', goal: '⭐ DESTINO', color: '#F8E8C8' }, garden: { title: 'Cultivando a fé! 🌱', intro: 'Cada presença faz o jardim da turma florescer.', goal: '🌻 JARDIM', color: '#E3F0D8' } } as const)[presenceTheme];
  const loadAttendance = () => { if (auth?.currentUser) listMyAttendance(auth.currentUser.uid).then(items => { const periodItems = items.filter(item => item.quarter === quarter && item.year === now.getFullYear()); const weeks = periodItems.filter(item => item.status === 'approved').map(item => item.week ?? 0); setApprovedWeeks(weeks); setAttendanceCount(weeks.length); setCurrentStatus(periodItems.find(item => item.week === currentWeek)?.status ?? ''); }).catch(() => undefined); };
  useEffect(loadAttendance, [classId]);
  useEffect(() => { if (classId) getPresenceTheme(classId).then(setPresenceTheme).catch(() => undefined); }, [classId]);
  const requestAttendance = async () => {
    if (!firebaseEnabled) return setSent(true);
    if (!auth?.currentUser || !classId) return setSendError('Você precisa estar em uma classe aprovada.');
    setSendError('');
    try { await submitAttendance({ userId: auth.currentUser.uid, userName, classId, week: currentWeek, quarter, year: now.getFullYear() }); setSent(true); setCurrentStatus('pending'); }
    catch (error) { setSendError(error instanceof Error ? error.message : 'Não foi possível solicitar a presença.'); }
  };
  return (
    <View style={styles.pagePad}>
      <Text style={styles.pageEyebrow}>TRIMESTRE {quarter} · SEMANA {currentWeek}</Text>
      <Text style={styles.pageTitle}>{theme.title}</Text>
      <Text style={styles.pageIntro}>{theme.intro}</Text>
      <View style={[styles.mountainCard, { backgroundColor: theme.color }]}>
        <View style={styles.summit}><Text style={styles.summitText}>{theme.goal}</Text></View>
        <View style={styles.trail} />
        {[13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((week, index) => (
          <View key={week} style={[styles.checkpoint, { top: 48 + index * 25, left: index % 2 === 0 ? '60%' : '32%' }, week === currentWeek && styles.currentCheckpoint, approvedWeeks.includes(week) && styles.approvedCheckpoint]}>
            <Text style={styles.checkpointText}>{approvedWeeks.includes(week) ? '✓' : week === currentWeek ? 'D' : week}</Text>
          </View>
        ))}
      </View>
      <View style={styles.statsRow}>
        <View style={styles.stat}><Text style={styles.statValue}>{attendanceCount}</Text><Text style={styles.cardCaption}>presenças</Text></View>
        <View style={styles.stat}><Text style={styles.statValue}>{Math.round((attendanceCount / 13) * 100)}%</Text><Text style={styles.cardCaption}>do caminho</Text></View>
        <View style={styles.stat}><Text style={styles.statValue}>+{attendanceCount * 10}</Text><Text style={styles.cardCaption}>pontos</Text></View>
      </View>
      <Pressable style={[styles.primaryButton, (sent || currentStatus === 'pending' || currentStatus === 'approved') && styles.buttonDone]} disabled={currentStatus === 'pending' || currentStatus === 'approved'} onPress={requestAttendance}><Text style={styles.primaryButtonText}>{currentStatus === 'approved' ? '✓ Presença confirmada' : sent || currentStatus === 'pending' ? '✓ Aguardando confirmação' : 'Solicitar confirmação de presença'}</Text></Pressable>
      {(sent || currentStatus === 'pending') && <Text style={styles.pendingHint}>Seu diretor recebeu a solicitação e confirmará sua presença.</Text>}
      {currentStatus === 'rejected' && <Text style={styles.authError}>A presença não foi confirmada. Converse com seu diretor.</Text>}
      {sendError !== '' && <Text style={styles.authError}>{sendError}</Text>}
    </View>
  );
}

function QuizScreen({ classId }: { classId: string }) {
  type PublicQuestion = { type: 'multiple_choice' | 'true_false' | 'assertion_reason' | 'open' | 'identify_false'; prompt: string; options: string[] };
  const [quiz, setQuiz] = useState<{ id: string; title: string; questions: PublicQuestion[] } | null>(null);
  const [quizStatus, setQuizStatus] = useState('');
  const [quizScore, setQuizScore] = useState<number | null>(null);
  const [resultPublished, setResultPublished] = useState(false);
  const [quizRanking, setQuizRanking] = useState<Array<{ userId: string; name: string; score: number; position: number }>>([]);
  const [rankingWeek, setRankingWeek] = useState('Ranking da semana');
  const [quizError, setQuizError] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Array<number | string | null>>([]);
  useEffect(() => { if (classId) getWeeklyQuiz(classId).then(async item => { const current = item as unknown as typeof quiz; setQuiz(current); if (current) { const attempt = await getMyQuizAttempt(current.id); if (attempt) { setQuizStatus(attempt.status ?? ''); setResultPublished(attempt.resultPublished === true); setQuizScore(attempt.resultPublished ? attempt.score ?? null : null); if (attempt.resultPublished) { const ranking = await getQuizRanking(current.id); setQuizRanking(ranking?.entries ?? []); setRankingWeek(ranking?.weekLabel ?? 'Ranking da semana'); } } } }).catch(() => undefined); }, [classId]);
  const question = quiz?.questions?.[currentIndex];
  const options = question?.options ?? [];
  const answer = answers[currentIndex] ?? null;
  const typeInfo = { multiple_choice: ['🎯', 'Escolha certeira'], true_false: ['⚡', 'Verdadeiro ou falso'], assertion_reason: ['🧩', 'Afirmação e complemento'], open: ['✍️', 'Explique com suas palavras'], identify_false: ['🔎', 'Encontre a alternativa falsa'] }[question?.type ?? 'multiple_choice'];
  const setCurrentAnswer = (value: number | string) => setAnswers(items => { const next = [...items]; next[currentIndex] = value; return next; });
  const advance = async () => {
    if (!quiz || answer === null || String(answer).trim() === '') return;
    if (currentIndex < quiz.questions.length - 1) { setCurrentIndex(index => index + 1); return; }
    setQuizError('');
    try { await submitQuizAnswers(quiz.id, answers.map(item => item ?? '')); setQuizStatus('pending'); }
    catch (error) { setQuizError(error instanceof Error ? error.message : 'Não foi possível enviar as respostas.'); }
  };
  return (
    <View style={styles.pagePad}>
      <View style={styles.quizHeader}>
        <Pill tone="coral">FASE {Math.min(currentIndex + 1, quiz?.questions.length ?? 1)} DE {quiz?.questions.length ?? 1}</Pill>
        <Text style={styles.quizPoints}>+10 pts</Text>
      </View>
      <Progress value={quiz?.questions.length ? ((currentIndex + 1) / quiz.questions.length) * 100 : 0} color={colors.coral} />
      <Text style={[styles.pageEyebrow, { marginTop: 22 }]}>{typeInfo[0]} {typeInfo[1].toUpperCase()}</Text>
      <Text style={styles.pageTitle}>{question?.prompt ?? 'O diretor ainda não publicou o quiz semanal.'}</Text>
      <Text style={styles.pageIntro}>Complete esta fase para avançar na jornada.</Text>
      {question?.type === 'open' ? <TextInput multiline value={typeof answer === 'string' ? answer : ''} onChangeText={setCurrentAnswer} placeholder="Escreva sua resposta aqui..." placeholderTextColor="#8A9892" style={[styles.authInput, styles.textArea]} /> : options.map((option, index) => (
        <Pressable key={`${index}_${option}`} style={[styles.option, answer === index && styles.optionSelected]} onPress={() => setCurrentAnswer(index)}>
          <Text style={[styles.optionLetter, answer === index && styles.optionLetterSelected]}>{question?.type === 'true_false' ? (index === 0 ? 'V' : 'F') : String.fromCharCode(65 + index)}</Text>
          <Text style={styles.optionText}>{option}</Text>
        </Pressable>
      ))}
      <Pressable style={[styles.primaryButton, (answer === null || !quiz || quizStatus === 'pending' || quizStatus === 'reviewed') && styles.buttonDisabled]} disabled={answer === null || !quiz || quizStatus === 'pending' || quizStatus === 'reviewed'} onPress={advance}>
        <Text style={styles.primaryButtonText}>{quizStatus === 'pending' ? '⏳ Aguardando correção' : quizStatus === 'reviewed' && !resultPublished ? '🔒 Nota corrigida · aguardando publicação' : quizStatus === 'reviewed' ? `🏆 Resultado: ${quizScore ?? 0} pontos` : currentIndex === (quiz?.questions.length ?? 1) - 1 ? '🚀 Finalizar jornada' : 'Próxima fase →'}</Text>
      </Pressable>
      {resultPublished && quizRanking.length > 0 && <View style={styles.formCard}><Text style={styles.sectionTitle}>🏆 {rankingWeek}</Text>{quizRanking.map(entry => <View key={entry.userId} style={styles.rankRow}><Text style={styles.rankPlace}>{entry.position}</Text><View style={styles.rankAvatar}><Text style={styles.rankAvatarText}>{entry.name[0]}</Text></View><Text style={styles.rankName}>{entry.name}</Text><Text style={styles.rankPoints}>{entry.score} pts</Text></View>)}</View>}
      {currentIndex > 0 && quizStatus === '' && <Pressable onPress={() => setCurrentIndex(index => index - 1)}><Text style={styles.skipLink}>← Voltar uma fase</Text></Pressable>}
      {quizError !== '' && <Text style={styles.authError}>{quizError}</Text>}
    </View>
  );
}

function ProfileScreen({ name, className, classId, districtId, initialStatus, initialThemeColor, onExit }: { name: string; className: string; classId: string; districtId: string; initialStatus: string; initialThemeColor: string; onExit: () => Promise<void> }) {
  const [communityView, setCommunityView] = useState<'hub' | 'ranking' | 'mural' | 'flashcards' | 'desafios' | 'hall' | 'notificacoes' | 'eventos' | 'colegas' | 'atividades'>('hub');
  const [events, setEvents] = useState<DistrictEvent[]>([]);
  const [confirmedEvents, setConfirmedEvents] = useState<string[]>([]);
  const [rankingHistory, setRankingHistory] = useState<Array<{ id: string; weekLabel?: string; entries?: Array<{ userId: string; name: string; score: number; position: number }> }>>([]);
  const [periodHistory, setPeriodHistory] = useState<PeriodClosure[]>([]);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [flashFront, setFlashFront] = useState('');
  const [flashBack, setFlashBack] = useState('');
  const [revealedCards, setRevealedCards] = useState<string[]>([]);
  const [flashNotice, setFlashNotice] = useState('');
  const [publicStatus, setPublicStatus] = useState('Vivendo com propósito.');
  const [profileColor, setProfileColor] = useState('#E7A93D');
  const [profileNotice, setProfileNotice] = useState('');
  const [classProfiles, setClassProfiles] = useState<PublicProfile[]>([]);
  const [muralPosts, setMuralPosts] = useState<MuralPost[]>([]);
  const [classChallenges, setClassChallenges] = useState<ClassChallenge[]>([]);
  const [classActivities, setClassActivities] = useState<ClassActivity[]>([]);
  const [joinedActivities, setJoinedActivities] = useState<string[]>([]);
  useEffect(() => { if (initialStatus) setPublicStatus(initialStatus); }, [initialStatus]);
  useEffect(() => { if (initialThemeColor) setProfileColor(initialThemeColor); }, [initialThemeColor]);
  useEffect(() => { if (districtId) listDistrictEvents(districtId).then(setEvents).catch(() => undefined); }, [districtId]);
  useEffect(() => { if (classId) listQuizRankingHistory(classId).then(setRankingHistory).catch(() => undefined); }, [classId]);
  useEffect(() => { if (classId) listPeriodClosures(classId).then(setPeriodHistory).catch(() => undefined); }, [classId]);
  useEffect(() => { if (classId) listPublishedFlashcards(classId).then(setFlashcards).catch(() => undefined); }, [classId]);
  useEffect(() => { if (classId) listClassProfiles(classId).then(setClassProfiles).catch(() => undefined); }, [classId]);
  useEffect(() => { if (classId) listMuralPosts(classId).then(setMuralPosts).catch(() => undefined); }, [classId]);
  useEffect(() => { if (classId) listApprovedChallenges(classId).then(setClassChallenges).catch(() => undefined); }, [classId]);
  useEffect(() => { if (classId) listClassActivities(classId).then(setClassActivities).catch(() => undefined); }, [classId]);
  const savePublicProfile = async () => {
    setProfileNotice('');
    try { await updateMyPublicProfile(publicStatus, profileColor); setProfileNotice('Perfil atualizado para sua turma!'); }
    catch (error) { setProfileNotice(error instanceof Error ? error.message : 'Não foi possível atualizar o perfil.'); }
  };
  const react = async (post: MuralPost, emoji: string) => {
    if (!post.id) return;
    try { await reactToMuralPost(post.id, emoji); setMuralPosts(items => items.map(item => item.id === post.id && auth?.currentUser ? { ...item, reactions: [...item.reactions, `${auth.currentUser.uid}:${emoji}`] } : item)); } catch { setProfileNotice('Não foi possível registrar a reação.'); }
  };
  const submitFlashcard = async () => {
    setFlashNotice('');
    if (flashFront.trim().length < 3 || flashBack.trim().length < 3) return setFlashNotice('Preencha a frente e a resposta do cartão.');
    try {
      await createFlashcard({ classId, userName: name, front: flashFront, back: flashBack });
      setFlashFront(''); setFlashBack(''); setFlashNotice('Cartão enviado! O diretor vai revisar antes de publicar.');
    } catch (error) { setFlashNotice(error instanceof Error ? error.message : 'Não foi possível enviar o cartão.'); }
  };
  const live = useLiveDashboard();
  const progress = useStudentProgress();
  if (communityView !== 'hub') {
    const content = {
      ranking: { title: 'Rankings', eyebrow: 'PONTUAÇÃO DO TRIMESTRE', copy: 'Classificação normalizada para valorizar participação, não o tamanho da classe.' },
      mural: { title: 'Mural', eyebrow: 'NOSSA COMUNIDADE', copy: 'Conquistas e desafios aprovados da sua turma.' },
      flashcards: { title: 'Flashcards', eyebrow: 'IDEIAS PARA GUARDAR', copy: 'Seus lembretes da lição, Bíblia e livro.' },
      desafios: { title: 'Desafios', eyebrow: 'MISSÃO DO MÊS', copy: 'Participe com toda a sua classe e some pontos.' },
      hall: { title: 'Hall da fama', eyebrow: 'TRIMESTRES ANTERIORES', copy: 'Quem deixou sua marca na história da turma.' },
      notificacoes: { title: 'Notificações', eyebrow: 'FIQUE POR DENTRO', copy: 'Atualizações importantes da sua jornada.' },
      eventos: { title: 'Encontros', eyebrow: 'AGENDA DISTRITAL', copy: 'Próximos encontros preparados pelo seu coordenador.' },
      colegas: { title: 'Minha turma', eyebrow: 'PERFIS DA BASE', copy: 'Conheça melhor quem caminha com você, sem mensagens privadas.' },
      atividades: { title: 'Atividades da base', eyebrow: 'VAMOS PARTICIPAR', copy: 'Programações externas organizadas pelo diretor da sua turma.' },
    }[communityView];
    return (
      <View style={styles.pagePad}>
        <BackButton onPress={() => setCommunityView('hub')} />
        <Text style={styles.pageEyebrow}>{content.eyebrow}</Text><Text style={styles.pageTitle}>{content.title}</Text><Text style={styles.pageIntro}>{content.copy}</Text>
        {communityView === 'ranking' && <>
          <View style={styles.rankingTabs}><Text style={styles.rankingTabActive}>Classe</Text><Text style={styles.rankingTab}>Distrito</Text><Text style={styles.rankingTab}>Turmas</Text></View>
          {rankingHistory.length > 0 ? rankingHistory.map(week => <View key={week.id} style={styles.formCard}><Text style={styles.sectionTitle}>{week.weekLabel ?? 'Semana'}</Text>{week.entries?.map(entry => <View key={entry.userId} style={styles.rankRow}><Text style={styles.rankPlace}>{entry.position}</Text><View style={styles.rankAvatar}><Text style={styles.rankAvatarText}>{entry.name[0]}</Text></View><Text style={styles.rankName}>{entry.name}</Text><Text style={styles.rankPoints}>{entry.score} pts</Text></View>)}</View>) : (live.rankings.length > 0 ? live.rankings.map((item, index) => [String(index + 1), item.className, String(item.normalizedScore)]) : [['1', 'Ranking ainda não publicado', '0']]).map(([place, rankingName, points]) => <View key={`${place}_${rankingName}`} style={styles.rankRow}><Text style={styles.rankPlace}>{place}</Text><View style={styles.rankAvatar}><Text style={styles.rankAvatarText}>{rankingName[0]}</Text></View><Text style={styles.rankName}>{rankingName}</Text><Text style={styles.rankPoints}>{points} pts</Text></View>)}
        </>}
        {communityView === 'mural' && <>{muralPosts.length === 0 && <Text style={styles.pageIntro}>As conquistas e os desafios aprovados da turma aparecerão aqui.</Text>}{muralPosts.map(post => <View key={post.id} style={styles.feedCard}><Text style={styles.feedEmoji}>{post.icon}</Text><View style={styles.flex}><Text style={styles.manageTitle}>{post.title}</Text><Text style={styles.manageCopy}>{post.copy}</Text><View style={styles.reactionRow}>{['♥', '🙌', '⚡'].map(emoji => { const count = post.reactions.filter(value => value.endsWith(`:${emoji}`)).length; return <Pressable key={emoji} style={styles.reactionButton} onPress={() => react(post, emoji)}><Text style={styles.reactions}>{emoji} {count}</Text></Pressable>; })}</View></View></View>)}</>}
        {communityView === 'flashcards' && <>
          <View style={styles.formCard}><Text style={styles.sectionTitle}>Crie um cartão para a turma</Text><Text style={styles.manageCopy}>Transforme algo importante do estudo em uma pergunta e resposta curta.</Text><AuthField label="Frente do cartão" placeholder="Ex.: Quem liderou o povo depois de Moisés?" value={flashFront} onChangeText={setFlashFront} /><AuthField label="Resposta" placeholder="Ex.: Josué" value={flashBack} onChangeText={setFlashBack} /><Pressable style={styles.primaryButton} onPress={submitFlashcard}><Text style={styles.primaryButtonText}>Enviar para moderação</Text></Pressable>{flashNotice !== '' && <Text style={styles.manageCopy}>{flashNotice}</Text>}</View>
          <Text style={styles.sectionTitle}>Baralho da turma</Text>
          {flashcards.length === 0 && <Text style={styles.pageIntro}>Os cartões aparecerão aqui depois que o diretor aprovar.</Text>}
          <View style={styles.flashGrid}>{flashcards.map((card, index) => { const revealed = revealedCards.includes(card.id); return <Pressable key={card.id} onPress={() => setRevealedCards(items => revealed ? items.filter(id => id !== card.id) : [...items, card.id])} style={[styles.flashCard, { backgroundColor: ['#FFF1A8', '#CFEDE5', '#FFD9CE', '#DCE0FA'][index % 4], transform: [{ rotate: index % 2 ? '2deg' : '-2deg' }] }]}><Text style={styles.flashLabel}>{revealed ? 'RESPOSTA' : 'TOQUE PARA REVELAR'}</Text><Text style={styles.flashText}>{revealed ? card.back : card.front}</Text><Text style={styles.cardCaption}>por {card.userName}</Text></Pressable>; })}</View>
        </>}
        {communityView === 'desafios' && <>{classChallenges.length === 0 && <Text style={styles.pageIntro}>Nenhum desafio aprovado para sua base neste momento.</Text>}{classChallenges.map(challenge => <View key={challenge.id} style={styles.challengeCard}><Pill tone="coral">DESAFIO APROVADO</Pill><Text style={styles.challengeTitle}>{challenge.title}</Text><Text style={styles.challengeCopy}>{challenge.description}</Text><View style={styles.challengeMeta}><Text style={styles.challengePoints}>+{challenge.bonusPoints} pontos para a base</Text></View><Text style={styles.challengeStatus}>✓ Validado pelo coordenador distrital</Text></View>)}</>}
        {communityView === 'hall' && <>{periodHistory.length === 0 && <Text style={styles.pageIntro}>O Hall da Fama será aberto após o primeiro encerramento de trimestre.</Text>}{periodHistory.map(period => <View key={period.id} style={styles.formCard}><Text style={styles.sectionTitle}>{period.kind === 'year' ? '🏆 Melhores do ano' : '⭐ Ranking trimestral'}</Text><Text style={styles.manageCopy}>{period.periodLabel}</Text>{period.entries.slice(0, 10).map(entry => <View key={entry.userId} style={styles.hallCard}><Text style={styles.hallIcon}>{entry.position === 1 ? '🥇' : entry.position === 2 ? '🥈' : entry.position === 3 ? '🥉' : '★'}</Text><View style={styles.flex}><Text style={styles.manageTitle}>{entry.position}º · {entry.name}</Text><Text style={styles.manageCopy}>{entry.summaries} resumos · {entry.attendance} presenças · {entry.correctQuizAnswers} acertos</Text></View><Text style={styles.rankPoints}>{entry.points} pts</Text></View>)}</View>)}</>}
        {communityView === 'notificacoes' && <>{(live.notifications.length > 0 ? live.notifications.map(item => [item.type.toUpperCase(), item.title, item.body, item.read ? 'read' : 'unread']) : [['NOVO', 'A lição 5 já está disponível', 'Comece seu estudo desta semana · agora', 'unread'], ['QUIZ', 'Quiz liberado!', 'Você tem até domingo para responder · há 2h', 'read'], ['NOTA', 'Seu resumo foi avaliado', 'O diretor enviou um retorno privado · ontem', 'read'], ['EVENTO', 'Conexão Distrital', '16 de agosto, às 15h · há 2 dias', 'read']]).map(([tag, title, copy, status]) => <View key={`${tag}_${title}`} style={[styles.notificationCard, status === 'unread' && styles.notificationUnread]}><Text style={styles.notificationTag}>{tag}</Text><View style={styles.flex}><Text style={styles.manageTitle}>{title}</Text><Text style={styles.manageCopy}>{copy}</Text></View>{status === 'unread' && <View style={styles.unreadDot} />}</View>)}</>}
        {communityView === 'eventos' && <>{events.length === 0 && <Text style={styles.pageIntro}>Nenhum encontro publicado para seu distrito.</Text>}{events.map(event => <View key={event.id} style={styles.formCard}><Text style={styles.manageTitle}>{event.title}</Text><Text style={styles.manageCopy}>{event.dateLabel} · {event.location}</Text><Pressable style={[styles.approveButton, confirmedEvents.includes(event.id) && styles.approveButtonDone]} disabled={confirmedEvents.includes(event.id)} onPress={async () => { await confirmEventAttendance(event); setConfirmedEvents(items => [...items, event.id]); }}><Text style={styles.approveButtonText}>{confirmedEvents.includes(event.id) ? '✓ Participação confirmada' : 'Confirmar participação'}</Text></Pressable></View>)}</>}
        {communityView === 'colegas' && <>{classProfiles.length === 0 && <Text style={styles.pageIntro}>Os perfis dos colegas aparecerão quando a entrada deles na turma for aprovada.</Text>}{classProfiles.map(profile => <View key={profile.id} style={styles.profilePeerCard}><View style={[styles.rankAvatar, { backgroundColor: profile.themeColor ?? colors.gold }]}><Text style={styles.rankAvatarText}>{profile.name[0]?.toUpperCase()}</Text></View><View style={styles.flex}><Text style={styles.manageTitle}>{profile.name}</Text><Text style={styles.manageCopy}>“{profile.status || 'Caminhando com propósito.'}”</Text></View></View>)}</>}
        {communityView === 'atividades' && <>{classActivities.length === 0 && <Text style={styles.pageIntro}>Nenhuma atividade externa foi publicada para sua base.</Text>}{classActivities.map(activity => { const joined = joinedActivities.includes(activity.id); return <View key={activity.id} style={styles.formCard}><Pill tone="teal">ATIVIDADE DA BASE</Pill><Text style={styles.challengeTitle}>{activity.title}</Text><Text style={styles.challengeCopy}>{activity.description}</Text><Text style={styles.manageCopy}>{activity.dateLabel} · {activity.location}</Text><Text style={styles.challengePoints}>+{activity.points} pontos ao participar</Text><Pressable disabled={joined} style={[styles.authPrimary, joined && styles.buttonDone]} onPress={async () => { await joinClassActivity(activity, name); setJoinedActivities(items => [...items, activity.id]); }}><Text style={styles.authPrimaryText}>{joined ? '✓ Participação confirmada' : 'Eu vou participar'}</Text></Pressable></View>; })}</>}
      </View>
    );
  }
  return (
    <View style={styles.pagePad}>
      <View style={styles.profileTop}>
        <View style={[styles.profileAvatar, { backgroundColor: profileColor }]}><Text style={styles.profileAvatarText}>{name[0]?.toUpperCase() ?? 'A'}</Text></View>
        <Text style={styles.profileName}>{name}</Text>
        <Text style={styles.profileClass}>{className} · Adolescentes</Text>
        <Text style={styles.profileStatus}>“{publicStatus}”</Text>
      </View>
      <View style={styles.formCard}><Text style={styles.sectionTitle}>Personalize seu perfil</Text><AuthField label="Frase de status" placeholder="Uma frase curta sobre você" value={publicStatus} onChangeText={setPublicStatus} /><Text style={styles.authLabel}>Cor do perfil</Text><View style={styles.colorChoices}>{['#E7A93D', '#E8683F', '#16504D', '#7769A8', '#4E88A8'].map(color => <Pressable key={color} onPress={() => setProfileColor(color)} style={[styles.colorChoice, { backgroundColor: color }, profileColor === color && styles.colorChoiceActive]} />)}</View><Pressable style={styles.approveButton} onPress={savePublicProfile}><Text style={styles.approveButtonText}>Salvar meu perfil</Text></Pressable>{profileNotice !== '' && <Text style={styles.manageCopy}>{profileNotice}</Text>}</View>
      <View style={styles.statsRow}>
        <View style={styles.stat}><Text style={styles.statValue}>{progress.points}</Text><Text style={styles.cardCaption}>pontos</Text></View>
        <View style={styles.stat}><Text style={styles.statValue}>{progress.summaries}</Text><Text style={styles.cardCaption}>resumos</Text></View>
        <View style={styles.stat}><Text style={styles.statValue}>{progress.streak}</Text><Text style={styles.cardCaption}>semanas seguidas</Text></View>
      </View>
      <Text style={styles.sectionTitle}>Comunidade</Text>
      <View style={styles.communityGrid}>
        {[
          ['ranking', '🏆', 'Rankings', '#F8E8C8'], ['mural', '◉', 'Mural', '#DCEDE9'], ['colegas', '☺', 'Minha turma', '#DCE0FA'], ['flashcards', '▤', 'Flashcards', '#FFF1A8'], ['desafios', '◆', 'Desafios', '#FBE0D6'], ['atividades', '⚑', 'Atividades', '#CFEDE5'], ['eventos', '◉', 'Encontros', '#F8E8C8'], ['hall', '★', 'Hall da fama', '#E4E0FA'], ['notificacoes', '●', 'Notificações', '#DCEDE9'],
        ].map(([key, icon, label, bg]) => <Pressable key={key} style={[styles.communityCard, { backgroundColor: bg }]} onPress={() => setCommunityView(key as typeof communityView)}><Text style={styles.communityIcon}>{icon}</Text><Text style={styles.communityLabel}>{label}</Text><Text style={styles.communityLink}>Abrir ›</Text></Pressable>)}
      </View>
      <Text style={styles.sectionTitle}>Conquistas</Text>
      <View style={styles.badgeRow}>
        {progress.badges.map(badge => <View key={badge.label} style={[styles.badge, !badge.unlocked && styles.badgeLocked]}><Text style={styles.badgeText}>{badge.unlocked ? badge.icon : '🔒'}{`\n${badge.label}`}</Text><Text style={styles.badgeDetail}>{badge.detail}</Text></View>)}
      </View>
      <View style={styles.weekCard}>
        <View style={styles.weekRow}><Text style={styles.weekTitle}>Evolução nas últimas semanas</Text><Text style={styles.percent}>{progress.evolution > 0 ? '+' : ''}{progress.evolution}%</Text></View>
        <Progress value={Math.max(0, Math.min(100, 50 + progress.evolution))} color={progress.evolution >= 0 ? colors.coral : colors.gold} />
        <Text style={[styles.cardCaption, { marginTop: 12 }]}>{progress.evolution > 0 ? 'Seu engajamento cresceu em relação às quatro semanas anteriores.' : progress.evolution < 0 ? 'Uma nova sequência de estudos pode recuperar seu ritmo.' : 'Continue participando para construir sua evolução.'}</Text>
      </View>
      <Pressable style={styles.signOutButton} onPress={onExit}><Text style={styles.signOutText}>Sair da conta</Text></Pressable>
    </View>
  );
}

function MainApp({ onExit }: { onExit: () => Promise<void> }) {
  const [tab, setTab] = useState<Tab>('Início');
  const student = useStudentProfile();
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style={tab === 'Início' ? 'light' : 'dark'} />
      <View style={styles.shell}>
        {tab !== 'Início' && (
          <View style={styles.appHeader}>
            <Pressable style={styles.brandMark} onLongPress={onExit}><Text style={styles.brandMarkText}>V</Text></Pressable>
            <Text style={styles.brand}>VIVA</Text>
            <Pill tone="teal">ADOLESCENTES</Pill>
          </View>
        )}
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {tab === 'Início' && <HomeScreen onNavigate={setTab} name={student.name} pending={student.pending} />}
          {tab === 'Estudo' && <StudyScreen classId={student.classId} userName={student.name} />}
          {tab === 'Presença' && <AttendanceScreen classId={student.classId} userName={student.name} />}
          {tab === 'Quiz' && <QuizScreen classId={student.classId} />}
          {tab === 'Mais' && <ProfileScreen name={student.name} className={student.className} classId={student.classId} districtId={student.districtId} initialStatus={student.status} initialThemeColor={student.themeColor} onExit={onExit} />}
        </ScrollView>
        <View style={styles.nav}>
          {tabs.map((item) => {
            const active = item.label === tab;
            return (
              <Pressable key={item.label} style={styles.navItem} onPress={() => setTab(item.label)}>
                <View style={[styles.navIconWrap, active && styles.navIconActive]}><Text style={[styles.navIcon, active && styles.navIconTextActive]}>{item.icon}</Text></View>
                <Text style={[styles.navLabel, active && styles.navLabelActive]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </SafeAreaView>
  );
}

function AuthField({ label, placeholder, secure = false, value, onChangeText }: { label: string; placeholder: string; secure?: boolean; value: string; onChangeText: (text: string) => void }) {
  return (
    <View style={styles.authField}>
      <Text style={styles.authLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#8A9892"
        secureTextEntry={secure}
        autoCapitalize={secure || label === 'E-mail' ? 'none' : 'words'}
        style={styles.authInput}
      />
    </View>
  );
}

function BackButton({ onPress }: { onPress: () => void }) {
  return <Pressable onPress={onPress} style={styles.backButton}><Text style={styles.backButtonText}>‹</Text></Pressable>;
}

function AuthFlow({ onComplete }: { onComplete: (role: Role) => void }) {
  const [step, setStep] = useState<AuthStep>('welcome');
  const [role, setRole] = useState<Role>('adolescente');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [invite, setInvite] = useState('');
  const [inviteState, setInviteState] = useState<'idle' | 'valid'>('idle');
  const [authError, setAuthError] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState('');
  const [registrationOptions, setRegistrationOptions] = useState<RegistrationOptions>({ districts: [], churches: [], classes: [] });
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedClass, setSelectedClass] = useState('');

  useEffect(() => {
    if (step !== 'role' || !firebaseEnabled) return;
    getRegistrationOptions().then(options => {
      setRegistrationOptions(options);
      setSelectedDistrict(current => current || options.districts[0]?.id || '');
    }).catch(() => setAuthError('Não foi possível carregar os distritos.'));
  }, [step]);

  const mapRole = (selectedRole: Role) => selectedRole === 'adolescente' ? 'student' : selectedRole === 'diretor' ? 'director' : selectedRole === 'coordenador' ? 'coordinator' : 'admin';
  const finishRegistration = async (selectedRole: Role) => {
    if (!firebaseEnabled) return onComplete(selectedRole);
    setAuthBusy(true); setAuthError('');
    try {
      const user = await registerUser(name, email, password, mapRole(selectedRole), { districtId: selectedDistrict || undefined, classId: selectedClass || undefined });
      if (selectedRole === 'adolescente' && invite.trim().length >= 5) {
        await requestClassEntry(user.uid, invite);
      }
      onComplete(selectedRole === 'adolescente' ? 'adolescente' : selectedRole);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Não foi possível criar a conta.');
    } finally { setAuthBusy(false); }
  };
  const finishLogin = async () => {
    if (!firebaseEnabled) return onComplete('adolescente');
    setAuthBusy(true); setAuthError('');
    try {
      const user = await loginUser(email, password);
      const savedRole = await getUserRole(user.uid);
      registerPushNotifications().catch(() => undefined);
      onComplete(savedRole === 'director' ? 'diretor' : savedRole === 'coordinator' ? 'coordenador' : savedRole === 'admin' ? 'admin' : 'adolescente');
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'E-mail ou senha inválidos.');
    } finally { setAuthBusy(false); }
  };
  const recoverPassword = async () => {
    if (!firebaseEnabled) return setAuthMessage('No modo demonstrativo, nenhuma conta real precisa ser recuperada.');
    if (!email.includes('@')) return setAuthError('Informe seu e-mail antes de recuperar a senha.');
    setAuthBusy(true); setAuthError(''); setAuthMessage('');
    try { await resetUserPassword(email); setAuthMessage('Enviamos o link de recuperação para o seu e-mail.'); }
    catch (error) { setAuthError(error instanceof Error ? error.message : 'Não foi possível enviar o e-mail.'); }
    finally { setAuthBusy(false); }
  };

  const validateInvite = () => {
    if (invite.trim().length >= 5) setInviteState('valid');
  };

  if (step === 'welcome') {
    return (
      <SafeAreaView style={styles.welcomeSafe}>
        <StatusBar style="light" />
        <View style={styles.welcomeDecorOne} />
        <View style={styles.welcomeDecorTwo} />
        <View style={styles.welcomeBody}>
          <View style={styles.welcomeLogo}><Text style={styles.welcomeLogoText}>V</Text></View>
          <Text style={styles.welcomeBrand}>VIVA</Text>
          <Text style={styles.welcomeTagline}>Estude. Participe. Cresça.</Text>
          <Text style={styles.welcomeCopy}>Uma jornada de fé para viver junto com a sua turma.</Text>
        </View>
        <View style={styles.welcomeActions}>
          <Pressable style={styles.welcomePrimary} onPress={() => setStep('register')}><Text style={styles.welcomePrimaryText}>Criar minha conta</Text></Pressable>
          <Pressable style={styles.welcomeSecondary} onPress={() => setStep('login')}><Text style={styles.welcomeSecondaryText}>Já tenho uma conta</Text></Pressable>
          <Text style={styles.welcomeTerms}>Ao continuar, você concorda com nossos termos de uso e privacidade.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (step === 'role') {
    const roles: { key: Role; icon: string; title: string; copy: string }[] = [
      { key: 'adolescente', icon: '✦', title: 'Adolescente', copy: 'Estudar, participar e acompanhar minha jornada' },
      { key: 'diretor', icon: '◆', title: 'Diretor de classe', copy: 'Cuidar de uma ou mais turmas da minha igreja' },
      { key: 'coordenador', icon: '⌘', title: 'Coordenador distrital', copy: 'Acompanhar as classes do meu distrito' },
      { key: 'admin', icon: '★', title: 'Administrador geral', copy: 'Gerenciar toda a estrutura do projeto' },
    ];
    return (
      <SafeAreaView style={styles.authSafe}>
        <ScrollView contentContainerStyle={styles.authPage}>
          <BackButton onPress={() => setStep('register')} />
          <Text style={styles.authEyebrow}>SEU PAPEL NO VIVA</Text>
          <Text style={styles.authTitle}>Como você vai participar?</Text>
          <Text style={styles.authCopy}>Escolha uma das opções abaixo. Contas de liderança passam por aprovação.</Text>
          {roles.map((item) => (
            <Pressable key={item.key} style={[styles.roleCard, role === item.key && styles.roleCardActive]} onPress={() => setRole(item.key)}>
              <View style={[styles.roleIcon, role === item.key && styles.roleIconActive]}><Text style={[styles.roleIconText, role === item.key && styles.roleIconTextActive]}>{item.icon}</Text></View>
              <View style={styles.flex}><Text style={styles.roleTitle}>{item.title}</Text><Text style={styles.roleCopy}>{item.copy}</Text></View>
              <View style={[styles.radio, role === item.key && styles.radioActive]}>{role === item.key && <View style={styles.radioDot} />}</View>
            </Pressable>
          ))}
          {(role === 'diretor' || role === 'coordenador') && <View style={styles.scopeSection}>
            <Text style={styles.authLabel}>Distrito desejado</Text>
            <View style={styles.scopeWrap}>{(registrationOptions.districts.length ? registrationOptions.districts : [{ id: 'salvador-centro', name: 'Salvador Centro' }]).map(item => <Pressable key={item.id} style={[styles.scopeChip, selectedDistrict === item.id && styles.scopeChipActive]} onPress={() => { setSelectedDistrict(item.id); setSelectedClass(''); }}><Text style={[styles.scopeChipText, selectedDistrict === item.id && styles.scopeChipTextActive]}>{item.name}</Text></Pressable>)}</View>
            {role === 'diretor' && <><Text style={[styles.authLabel, { marginTop: 13 }]}>Classe desejada</Text><View style={styles.scopeWrap}>{(registrationOptions.classes.filter(item => item.districtId === selectedDistrict).length ? registrationOptions.classes.filter(item => item.districtId === selectedDistrict) : [{ id: 'base-geracao', name: 'Base Geração', districtId: selectedDistrict, churchId: '', ageGroup: 'adolescentes' }]).map(item => <Pressable key={item.id} style={[styles.scopeChip, selectedClass === item.id && styles.scopeChipActive]} onPress={() => setSelectedClass(item.id)}><Text style={[styles.scopeChipText, selectedClass === item.id && styles.scopeChipTextActive]}>{item.name}</Text></Pressable>)}</View></>}
          </View>}
          <Pressable
            style={[styles.authPrimary, firebaseEnabled && ((role === 'diretor' && (!selectedDistrict || !selectedClass)) || (role === 'coordenador' && !selectedDistrict)) && styles.buttonDisabled]}
            disabled={authBusy || (firebaseEnabled && ((role === 'diretor' && (!selectedDistrict || !selectedClass)) || (role === 'coordenador' && !selectedDistrict)))}
            onPress={() => role === 'admin' ? setStep('login') : role === 'adolescente' ? setStep('invite') : finishRegistration(role)}
          >
            <Text style={styles.authPrimaryText}>{authBusy ? 'Criando conta...' : role === 'admin' ? 'Entrar como administrador' : 'Continuar'}</Text>
          </Pressable>
          {(role === 'diretor' || role === 'coordenador') && <Text style={styles.approvalHint}>O acesso de liderança ficará pendente até a aprovação responsável.</Text>}
          {role === 'admin' && <Text style={styles.approvalHint}>Por segurança, o administrador geral é criado diretamente no Firebase e entra por esta tela.</Text>}
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (step === 'invite') {
    return (
      <SafeAreaView style={styles.authSafe}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.authPage} keyboardShouldPersistTaps="handled">
            <BackButton onPress={() => setStep('role')} />
            <View style={styles.inviteIllustration}><Text style={styles.inviteIllustrationText}>⌁</Text></View>
            <Text style={styles.authEyebrow}>ENTRE NA SUA TURMA</Text>
            <Text style={styles.authTitle}>Você recebeu um código?</Text>
            <Text style={styles.authCopy}>Peça ao seu diretor o código de convite da classe. Ele conecta sua conta à turma certa.</Text>
            <AuthField label="Código da classe" placeholder="Ex.: VIVA-7429" value={invite} onChangeText={(text) => { setInvite(text.toUpperCase()); setInviteState('idle'); }} />
            {inviteState === 'valid' && (
              <View style={styles.classFound}>
                <View style={styles.classFoundIcon}><Text>✓</Text></View>
                <View><Text style={styles.classFoundTitle}>Base Geração</Text><Text style={styles.classFoundCopy}>IASD Central · Adolescentes</Text></View>
              </View>
            )}
            {inviteState === 'idle' ? (
              <Pressable style={[styles.authPrimary, invite.length < 5 && styles.buttonDisabled]} disabled={invite.length < 5} onPress={validateInvite}><Text style={styles.authPrimaryText}>Verificar código</Text></Pressable>
            ) : (
              <Pressable style={styles.authPrimary} disabled={authBusy} onPress={() => finishRegistration('adolescente')}><Text style={styles.authPrimaryText}>{authBusy ? 'Criando conta...' : 'Entrar na Base Geração'}</Text></Pressable>
            )}
            <Pressable disabled={authBusy} onPress={() => finishRegistration('adolescente')}><Text style={styles.skipLink}>Ainda não tenho um código</Text></Pressable>
            {authError !== '' && <Text style={styles.authError}>{authError}</Text>}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  const isLogin = step === 'login';
  return (
    <SafeAreaView style={styles.authSafe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.authPage} keyboardShouldPersistTaps="handled">
          <BackButton onPress={() => setStep('welcome')} />
          <View style={styles.authMiniLogo}><Text style={styles.brandMarkText}>V</Text></View>
          <Text style={styles.authEyebrow}>{isLogin ? 'BEM-VINDO DE VOLTA' : 'SUA JORNADA COMEÇA AQUI'}</Text>
          <Text style={styles.authTitle}>{isLogin ? 'Entre na sua conta.' : 'Crie sua conta.'}</Text>
          <Text style={styles.authCopy}>{isLogin ? 'Continue de onde você parou.' : 'Leva menos de um minuto.'}</Text>
          {!isLogin && <AuthField label="Nome" placeholder="Como você quer ser chamado?" value={name} onChangeText={setName} />}
          <AuthField label="E-mail" placeholder="voce@exemplo.com" value={email} onChangeText={setEmail} />
          <AuthField label="Senha" placeholder="Mínimo de 6 caracteres" secure value={password} onChangeText={setPassword} />
          {isLogin && <Pressable onPress={recoverPassword}><Text style={styles.forgotLink}>Esqueci minha senha</Text></Pressable>}
          <Pressable
            style={[styles.authPrimary, (email.length < 4 || password.length < 6 || (!isLogin && name.length < 2)) && styles.buttonDisabled]}
            disabled={email.length < 4 || password.length < 6 || (!isLogin && name.length < 2)}
            onPress={() => isLogin ? finishLogin() : setStep('role')}
          >
            <Text style={styles.authPrimaryText}>{authBusy ? 'Aguarde...' : isLogin ? 'Entrar' : 'Continuar'}</Text>
          </Pressable>
          <Pressable onPress={() => setStep(isLogin ? 'register' : 'login')}><Text style={styles.authSwitch}>{isLogin ? 'Ainda não tem conta? ' : 'Já tem uma conta? '}<Text style={styles.authSwitchStrong}>{isLogin ? 'Cadastre-se' : 'Entrar'}</Text></Text></Pressable>
          <View style={styles.demoBox}><Text style={styles.demoText}>Protótipo: use qualquer e-mail e uma senha com 6 caracteres.</Text></View>
          {authError !== '' && <Text style={styles.authError}>{authError}</Text>}
          {authMessage !== '' && <Text style={styles.authSuccess}>{authMessage}</Text>}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function MetricCard({ value, label, accent }: { value: string; label: string; accent: string }) {
  return <View style={[styles.metricCard, { borderTopColor: accent }]}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
}

function ActionRow({ icon, title, copy, badge, onPress }: { icon: string; title: string; copy: string; badge?: string; onPress?: () => void }) {
  return (
    <Pressable style={styles.manageRow} onPress={onPress}>
      <View style={styles.manageIcon}><Text style={styles.manageIconText}>{icon}</Text></View>
      <View style={styles.flex}><Text style={styles.manageTitle}>{title}</Text><Text style={styles.manageCopy}>{copy}</Text></View>
      {badge && <Text style={styles.manageBadge}>{badge}</Text>}
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

function PeriodClosurePanel() {
  const [armedKind, setArmedKind] = useState<PeriodKind | null>(null);
  const [seconds, setSeconds] = useState(10);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<PeriodClosure | null>(null);
  const [history, setHistory] = useState<PeriodClosure[]>([]);
  useEffect(() => { listPeriodClosures().then(setHistory).catch(() => undefined); }, []);
  useEffect(() => {
    if (!armedKind || seconds <= 0) return;
    const timer = setTimeout(() => setSeconds(value => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [armedKind, seconds]);
  const arm = (kind: PeriodKind) => { setArmedKind(kind); setSeconds(10); setError(''); setResult(null); };
  const cancel = () => { setArmedKind(null); setSeconds(10); };
  const confirm = async () => {
    if (!armedKind || seconds > 0) return;
    setBusy(true); setError('');
    try { const closure = await closeCurrentPeriod(armedKind); setResult(closure); setHistory(await listPeriodClosures()); setArmedKind(null); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Não foi possível encerrar o período.'); }
    finally { setBusy(false); }
  };
  return <View>
    <View style={styles.formCard}><Text style={styles.pageEyebrow}>FECHAMENTO OFICIAL</Text><Text style={styles.pageTitle}>Consolide a jornada da turma.</Text><Text style={styles.pageIntro}>O relatório reúne resumos, atividades, acertos nos quizzes e presenças de todos os adolescentes da base.</Text><View style={styles.memberActions}><Pressable style={styles.memberActionButton} onPress={() => arm('quarter')}><Text style={styles.memberActionText}>Encerrar trimestre</Text></Pressable><Pressable style={styles.memberActionButton} onPress={() => arm('year')}><Text style={styles.memberActionText}>Encerrar ano</Text></Pressable></View></View>
    {armedKind && <View style={styles.inviteCodeCard}><Text style={styles.authEyebrow}>ATENÇÃO · AÇÃO DEFINITIVA</Text><Text style={styles.inviteCode}>{seconds > 0 ? seconds : 'CONFIRMAR?'}</Text><Text style={styles.cardCaption}>{armedKind === 'quarter' ? 'Você está encerrando o trimestre atual.' : 'Você está encerrando o ano atual e gerando os melhores do ano.'}</Text><Pressable style={[styles.copyButton, seconds > 0 && styles.buttonDisabled]} disabled={seconds > 0 || busy} onPress={confirm}><Text style={styles.copyButtonText}>{busy ? 'Gerando relatório...' : seconds > 0 ? `Aguarde ${seconds}s` : 'Sim, encerrar agora'}</Text></Pressable><Pressable onPress={cancel}><Text style={[styles.skipLink, { color: colors.white }]}>Cancelar encerramento</Text></Pressable></View>}
    {error !== '' && <Text style={styles.authError}>{error}</Text>}
    {result && <View><Text style={styles.pageEyebrow}>RELATÓRIO CONCLUÍDO</Text><Text style={styles.pageTitle}>{result.periodLabel}</Text>{result.entries.map(entry => <View key={entry.userId} style={styles.formCard}><View style={styles.weekRow}><Text style={styles.manageTitle}>{entry.position}º · {entry.name}</Text><Text style={styles.rankPoints}>{entry.points} pts</Text></View><Text style={styles.manageCopy}>{entry.summaries} resumos · {entry.activities} atividades · {entry.correctQuizAnswers} acertos · {entry.attendance} presenças</Text></View>)}<Pressable style={styles.exportButton} onPress={() => exportPeriodClosure(result)}><Text style={styles.exportButtonText}>⇩ Exportar relatório em PDF</Text></Pressable></View>}
    {history.length > 0 && <View><Text style={styles.sectionTitle}>Histórico de fechamentos</Text>{history.map(report => <View key={report.id} style={styles.formCard}><View style={styles.weekRow}><View><Text style={styles.manageTitle}>{report.periodLabel}</Text><Text style={styles.manageCopy}>{report.entries.length} adolescentes · {report.className}</Text></View><Pressable style={styles.approveButton} onPress={() => exportPeriodClosure(report)}><Text style={styles.approveButtonText}>PDF</Text></Pressable></View></View>)}</View>}
  </View>;
}

function ManagementDetail({ title, role, onBack }: { title: string; role: Exclude<Role, 'adolescente'>; onBack: () => void }) {
  const [saved, setSaved] = useState(false);
  const [lessonTitle, setLessonTitle] = useState('Escolhas que transformam');
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestionDraft[]>(quizQuestionTemplates);
  const [approved, setApproved] = useState<string[]>([]);
  const [memberNotice, setMemberNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const [uploadedPdf, setUploadedPdf] = useState<{ name: string; url: string } | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [districtName, setDistrictName] = useState('Central');
  const [churchName, setChurchName] = useState('Alto do Guarani');
  const [className, setClassName] = useState('Base Cordilheira');
  const [structureBusy, setStructureBusy] = useState(false);
  const [eventLocation, setEventLocation] = useState('Alto do Guarani');
  const [eventDate, setEventDate] = useState('16 de agosto · 15h');
  const [districtEvents, setDistrictEvents] = useState<DistrictEvent[]>([]);
  const [structures, setStructures] = useState<StructureItem[]>([]);
  const [challengeDescription, setChallengeDescription] = useState('Uma ação que envolva toda a base e ajude a comunidade.');
  const [challengeEvidence, setChallengeEvidence] = useState('Descreva aqui o que a turma realizou.');
  const [challengePoints, setChallengePoints] = useState('100');
  const [activityDescription, setActivityDescription] = useState('Uma programação especial para fortalecer a amizade e a fé da nossa base.');
  const [activityPoints, setActivityPoints] = useState('20');
  const [directedActivities, setDirectedActivities] = useState<ClassActivity[]>([]);
  const [selectedPresenceTheme, setSelectedPresenceTheme] = useState<PresenceTheme>('mountain');
  const toggleApproval = (name: string) => setApproved(items => items.includes(name) ? items.filter(item => item !== name) : [...items, name]);
  const isApproval = title.includes('Aprovar') || title.includes('Avaliar') || title.includes('Validar') || title.includes('Corrigir') || title.includes('Moderar');
  const isContent = title.includes('Conteúdo');
  const isQuiz = title.includes('Quiz');
  const isReport = title.includes('Relatório');
  const isEvent = title.includes('Encontros');
  const isStructure = title.includes('Classes') || title.includes('Distritos') || title.includes('Igrejas') || title.includes('coordenadores');
  const isRisk = title.includes('Acompanhamento');
  const isMembers = title.includes('membros');
  const isQuizRanking = title.includes('ranking semanal');
  const isPeriodClosure = title.includes('Encerrar período');
  const isChallengeCreation = title === 'Desafio mensal';
  const isClassActivity = title === 'Atividades externas';
  const isPresenceTheme = title === 'Tema da presença';
  useEffect(() => { if (isEvent) listCurrentDistrictEvents().then(setDistrictEvents).catch(() => undefined); }, [isEvent]);
  useEffect(() => { if (isStructure) listStructures().then(setStructures).catch(() => undefined); }, [isStructure]);
  useEffect(() => { if (isClassActivity) listDirectedActivities().then(setDirectedActivities).catch(() => undefined); }, [isClassActivity]);
  const approvalType: ApprovalType | null = title.includes('flashcards') ? 'flashcard' : title.includes('quizzes') ? 'quizAttempt' : title.includes('resumos') ? 'studyRecord' : title.includes('entradas') ? 'classJoinRequest' : title.includes('Presenças') || title.includes('presenças') ? 'attendance' : title.includes('desafios') || title.includes('Desafios') ? 'challenge' : title.includes('diretores') || title.includes('Aprovações') ? 'roleRequest' : null;
  const liveApprovals = usePendingApprovals(approvalType);
  const classManagement = useClassManagement();
  const displayApprovals = liveApprovals.length ? liveApprovals : firebaseEnabled ? [] : [
    { id: '', name: 'Marina Costa', copy: title.includes('Presença') ? 'Foto enviada hoje · 09:12' : 'Resumo da lição 4 · 246 palavras' },
    { id: '', name: 'João Pedro', copy: title.includes('Presença') ? 'Foto enviada hoje · 09:36' : 'Resumo da Bíblia · Josué 1' },
    { id: '', name: 'Sara Lima', copy: title.includes('Presença') ? 'Foto enviada hoje · 10:04' : 'Resumo do livro · capítulo 3' },
  ];
  const displayMembers = classManagement.members.length ? classManagement.members : [
    { id: 'marina-demo', name: 'Marina Costa', role: 'director' }, { id: 'joao-demo', name: 'João Pedro', role: 'student' }, { id: 'daniel-demo', name: 'Daniel Oliveira', role: 'student' }, { id: 'sara-demo', name: 'Sara Lima', role: 'student' },
  ];
  const approveItem = async (item: { id: string; name: string }) => {
    if (!firebaseEnabled || !approvalType || !item.id) return toggleApproval(item.name);
    setActionError('');
    try { await reviewLeadershipItem(approvalType, item.id, true); toggleApproval(item.name); }
    catch (error) { setActionError(error instanceof Error ? error.message : 'Não foi possível aprovar.'); }
  };
  const rejectItem = async (item: { id: string; name: string }) => {
    if (!firebaseEnabled || !approvalType || !item.id) return;
    setActionError('');
    try { await reviewLeadershipItem(approvalType, item.id, false); setMemberNotice(`Solicitação de ${item.name} recusada`); }
    catch (error) { setActionError(error instanceof Error ? error.message : 'Não foi possível recusar.'); }
  };
  const runMembershipAction = async (action: 'regenerateCode' | 'removeMember' | 'transferLeadership' | 'revokeDirector') => {
    if (!firebaseEnabled) return setMemberNotice('Ação concluída no modo demonstrativo');
    if (!classManagement.classId) return setActionError('Nenhuma classe de liderança foi encontrada.');
    if (action !== 'regenerateCode' && !selectedMemberId) return setActionError('Selecione um membro primeiro.');
    setActionError('');
    try {
      const result = await manageClassMembership({ action, classId: classManagement.classId, targetUserId: selectedMemberId || undefined });
      setMemberNotice(result.inviteCode ? `Novo código: ${result.inviteCode}` : 'Ação concluída com sucesso');
    } catch (error) { setActionError(error instanceof Error ? error.message : 'Não foi possível concluir a ação.'); }
  };
  const saveManagement = async () => {
    setActionError('');
    try {
      if (firebaseEnabled && isContent) await publishContent({ title: lessonTitle, lessonPdfUrl: uploadedPdf?.url, week: 1, quarter: Math.floor(new Date().getMonth() / 3) + 1, year: new Date().getFullYear() });
      if (firebaseEnabled && isQuiz) await publishQuizContent({ title: 'Jornada bíblica semanal', releaseAt: Date.now(), closesAt: Date.now() + 7 * 24 * 60 * 60 * 1000, questions: quizQuestions });
      if (firebaseEnabled && isEvent) { await createDistrictEvent({ title: lessonTitle, location: eventLocation, dateLabel: eventDate }); setDistrictEvents(await listCurrentDistrictEvents()); }
      if (firebaseEnabled && isQuizRanking) { const result = await publishLatestQuizRanking(); setMemberNotice(`Ranking publicado para ${result.entries} participante(s)`); }
      if (firebaseEnabled && isChallengeCreation) { await submitClassChallenge({ title: lessonTitle, description: challengeDescription, evidence: challengeEvidence, bonusPoints: Number(challengePoints) || 100 }); setMemberNotice('Desafio enviado ao coordenador para validação'); }
      if (firebaseEnabled && isClassActivity) { await createClassActivity({ title: lessonTitle, description: activityDescription, location: eventLocation, dateLabel: eventDate, points: Number(activityPoints) || 20 }); setDirectedActivities(await listDirectedActivities()); setMemberNotice('Atividade publicada para a sua base'); }
      if (firebaseEnabled && isPresenceTheme) { await updatePresenceTheme(selectedPresenceTheme); setMemberNotice('Tema da corrida atualizado para toda a base'); }
      setSaved(true);
    } catch (error) { setActionError(error instanceof Error ? error.message : 'Não foi possível salvar.'); }
  };
  const uploadPdf = async () => {
    if (!firebaseEnabled) return setUploadedPdf({ name: 'licao-demonstrativa.pdf', url: 'demo' });
    setActionError('');
    try { const file = await selectAndUploadContentPdf(); if (file) setUploadedPdf(file); }
    catch (error) { setActionError(error instanceof Error ? error.message : 'Não foi possível enviar o PDF.'); }
  };
  const exportReport = async () => {
    setActionError(''); setMemberNotice('Preparando relatório...');
    try { await exportLeadershipReport(); setMemberNotice('Relatório gerado com sucesso'); }
    catch (error) { setMemberNotice(''); setActionError(error instanceof Error ? error.message : 'Não foi possível gerar o relatório.'); }
  };
  const saveStructure = async () => {
    setActionError(''); setMemberNotice(''); setStructureBusy(true);
    try {
      const result = role === 'coordenador'
        ? await createCoordinatorStructure({ churchName, className })
        : await createInitialStructure({ districtName, churchName, className });
      setMemberNotice(`Estrutura criada. Código da classe: ${result.inviteCode}`);
      setStructures(await listStructures());
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Não foi possível criar a estrutura.');
    } finally { setStructureBusy(false); }
  };

  return (
    <View>
      <BackButton onPress={onBack} />
      <Text style={styles.pageEyebrow}>GESTÃO DA TURMA</Text><Text style={styles.pageTitle}>{title}</Text>
      <Text style={styles.pageIntro}>{isApproval ? 'Analise os itens pendentes e registre sua decisão.' : 'Prepare as informações que ficarão disponíveis para a turma.'}</Text>
      {isContent && <>
        <AuthField label="Título da lição" placeholder="Título da semana" value={lessonTitle} onChangeText={setLessonTitle} />
        <Pressable style={styles.uploadBox} onPress={uploadPdf}><Text style={styles.uploadIcon}>{uploadedPdf ? '✓' : '＋'}</Text><Text style={styles.uploadTitle}>{uploadedPdf?.name ?? 'Adicionar arquivo'}</Text><Text style={styles.uploadCopy}>{uploadedPdf ? 'PDF pronto para publicação' : 'PDF da lição ou do livro · até 25 MB'}</Text></Pressable>
        <View style={styles.scheduleRow}><View><Text style={styles.manageTitle}>Publicar agora</Text><Text style={styles.manageCopy}>A turma receberá uma notificação</Text></View><View style={styles.toggleOn}><View style={styles.toggleKnob} /></View></View>
      </>}
      {isQuiz && <>
        <View style={styles.formCard}><Text style={styles.manageTitle}>Jornada com {quizQuestions.length} fases</Text><Text style={styles.manageCopy}>Misture formatos para manter o quiz dinâmico, reflexivo e divertido.</Text></View>
        {quizQuestions.map((item, questionIndex) => <View key={`${item.type}_${questionIndex}`} style={styles.formCard}><Pill tone={questionIndex % 2 ? 'teal' : 'coral'}>{({ multiple_choice: '🎯 MÚLTIPLA ESCOLHA', true_false: '⚡ VERDADEIRO OU FALSO', assertion_reason: '🧩 AFIRMAÇÃO + COMPLEMENTO', open: '✍️ QUESTÃO ABERTA', identify_false: '🔎 IDENTIFIQUE A FALSA' } as const)[item.type]}</Pill><TextInput multiline value={item.prompt} onChangeText={text => setQuizQuestions(items => items.map((questionItem, index) => index === questionIndex ? { ...questionItem, prompt: text } : questionItem))} style={[styles.authInput, styles.textArea, { marginTop: 12 }]} />{item.options.map((option, index) => <View key={`${index}_${option}`} style={[styles.quizEditOption, item.correctAnswer === index && styles.quizEditCorrect]}><Text style={styles.optionLetter}>{String.fromCharCode(65 + index)}</Text><Text style={styles.optionText}>{option}</Text>{item.correctAnswer === index && <Text style={styles.correctLabel}>GABARITO</Text>}</View>)}{item.type === 'open' && <Text style={styles.manageCopy}>A resposta será analisada pelo diretor.</Text>}</View>)}
        <Pressable style={styles.addQuestion} onPress={() => setQuizQuestions(items => [...items, { ...quizQuestionTemplates[0], prompt: 'Nova pergunta de múltipla escolha' }])}><Text style={styles.addQuestionText}>＋ Adicionar outra fase</Text></Pressable>
        <View style={styles.scheduleRow}><View><Text style={styles.manageTitle}>Liberar no sábado</Text><Text style={styles.manageCopy}>Abertura automática às 00h</Text></View><View style={styles.toggleOn}><View style={styles.toggleKnob} /></View></View>
      </>}
      {isQuizRanking && <View style={styles.formCard}><Text style={styles.pageEyebrow}>CONTROLE DO DIRETOR</Text><Text style={styles.pageTitle}>Publique quando a turma estiver reunida.</Text><Text style={styles.pageIntro}>As notas continuam privadas até você liberar. Ao publicar, todos verão o ranking semanal ao mesmo tempo.</Text><View style={styles.inviteCodeCard}><Text style={styles.authEyebrow}>STATUS ATUAL</Text><Text style={styles.inviteCode}>🔒 PRIVADO</Text><Text style={styles.cardCaption}>Corrija todas as respostas antes de liberar o placar.</Text></View></View>}
      {isPeriodClosure && <PeriodClosurePanel />}
      {isChallengeCreation && <View style={styles.formCard}><AuthField label="Nome do desafio" placeholder="Ex.: Corrente do bem" value={lessonTitle} onChangeText={setLessonTitle} /><AuthField label="Missão da turma" placeholder="Explique o que deve ser realizado" value={challengeDescription} onChangeText={setChallengeDescription} /><AuthField label="Evidência realizada" placeholder="Conte como a turma concluiu a missão" value={challengeEvidence} onChangeText={setChallengeEvidence} /><AuthField label="Pontos extras da base" placeholder="100" value={challengePoints} onChangeText={setChallengePoints} /><Text style={styles.manageCopy}>O coordenador distrital analisará a evidência antes de liberar os pontos e publicar no mural.</Text></View>}
      {isClassActivity && <><View style={styles.formCard}><AuthField label="Nome da atividade" placeholder="Ex.: Piquenique da base" value={lessonTitle} onChangeText={setLessonTitle} /><AuthField label="Descrição" placeholder="Explique a programação" value={activityDescription} onChangeText={setActivityDescription} /><AuthField label="Local" placeholder="Igreja ou endereço" value={eventLocation} onChangeText={setEventLocation} /><AuthField label="Data e horário" placeholder="Ex.: 16 de agosto · 15h" value={eventDate} onChangeText={setEventDate} /><AuthField label="Pontos por participação" placeholder="20" value={activityPoints} onChangeText={setActivityPoints} /></View><Text style={styles.sectionTitle}>Atividades publicadas</Text>{directedActivities.map(activity => <View key={activity.id} style={styles.formCard}><Text style={styles.manageTitle}>{activity.title}</Text><Text style={styles.manageCopy}>{activity.dateLabel} · {activity.location}</Text><Text style={styles.challengeStatus}>{activity.participantCount ?? 0} participante(s) confirmado(s)</Text></View>)}</>}
      {isPresenceTheme && <View style={styles.formCard}><Text style={styles.sectionTitle}>Escolha a jornada do trimestre</Text><Text style={styles.manageCopy}>O tema muda a aparência da trilha para todos os adolescentes da base.</Text><View style={styles.themeGrid}>{([{ key: 'mountain', icon: '🏔️', label: 'Montanha' }, { key: 'ocean', icon: '⛵', label: 'Oceano' }, { key: 'journey', icon: '🧭', label: 'Jornada' }, { key: 'garden', icon: '🌱', label: 'Jardim' }] as Array<{ key: PresenceTheme; icon: string; label: string }>).map(item => <Pressable key={item.key} onPress={() => setSelectedPresenceTheme(item.key)} style={[styles.themeCard, selectedPresenceTheme === item.key && styles.themeCardActive]}><Text style={styles.themeIcon}>{item.icon}</Text><Text style={styles.manageTitle}>{item.label}</Text>{selectedPresenceTheme === item.key && <Text style={styles.correctLabel}>SELECIONADO</Text>}</Pressable>)}</View></View>}
      {isApproval && <>{displayApprovals.length === 0 && <View style={styles.formCard}><Text style={styles.manageTitle}>Nenhuma solicitação pendente</Text><Text style={styles.manageCopy}>Os novos pedidos de liderança aparecerão aqui automaticamente.</Text></View>}{displayApprovals.map(item => { const done = approved.includes(item.name); return <View key={`${item.id}_${item.name}`} style={styles.approvalCard}><View style={styles.rankAvatar}><Text style={styles.rankAvatarText}>{item.name[0]}</Text></View><View style={styles.flex}><Text style={styles.manageTitle}>{item.name}</Text><Text style={styles.manageCopy}>{item.copy}</Text></View><View><Pressable style={[styles.approveButton, done && styles.approveButtonDone]} onPress={() => approveItem(item)}><Text style={[styles.approveButtonText, done && styles.approveButtonTextDone]}>{done ? '✓ Aprovado' : 'Aprovar'}</Text></Pressable>{!done && <Pressable onPress={() => rejectItem(item)}><Text style={styles.contactLink}>Recusar</Text></Pressable>}</View></View>; })}</>}
      {isReport && <>
        <View style={styles.reportHero}><Text style={styles.reportValue}>82%</Text><View style={styles.flex}><Text style={styles.reportTitle}>Engajamento médio</Text><Text style={styles.reportCopy}>Trimestre 3 · crescimento de 12%</Text></View></View>
        {[['Presença', '78%', 78, colors.tealMedium], ['Estudos', '84%', 84, colors.gold], ['Quiz', '71%', 71, colors.coral], ['Desafios', '92%', 92, '#6C83B8']].map(([label, value, progress, color]) => <View key={label as string} style={styles.reportRow}><View style={styles.reportRowTop}><Text style={styles.manageTitle}>{label}</Text><Text style={styles.reportPercent}>{value}</Text></View><Progress value={progress as number} color={color as string} /></View>)}
        <Pressable style={styles.exportButton} onPress={exportReport}><Text style={styles.exportButtonText}>⇩ Exportar relatório em PDF</Text></Pressable>
      </>}
      {isEvent && <>
        {districtEvents.map(event => <View key={event.id} style={styles.eventCard}><View style={styles.eventDate}><Text style={styles.eventDay}>◉</Text></View><View style={styles.flex}><Text style={styles.eventTitle}>{event.title}</Text><Text style={styles.eventCopy}>{event.location} · {event.dateLabel}</Text></View></View>)}
        <View style={styles.formCard}><AuthField label="Nome do encontro" placeholder="Ex.: Conexão Distrital" value={lessonTitle} onChangeText={setLessonTitle} /><AuthField label="Local" placeholder="Igreja ou endereço" value={eventLocation} onChangeText={setEventLocation} /><AuthField label="Data e horário" placeholder="Ex.: 16 de agosto · 15h" value={eventDate} onChangeText={setEventDate} /></View>
      </>}
      {isStructure && <>
        {structures.map(item => <View key={`${item.kind}-${item.id}`} style={styles.structureCard}><View style={styles.structureIcon}><Text style={styles.structureIconText}>{item.kind === 'district' ? '⌘' : item.kind === 'church' ? '⌂' : '◆'}</Text></View><View style={styles.flex}><Text style={styles.manageTitle}>{item.name}</Text><Text style={styles.manageCopy}>{item.detail}</Text></View></View>)}
        <View style={styles.formCard}>
          <Text style={styles.manageTitle}>Nova estrutura</Text>
          <Text style={styles.manageCopy}>{role === 'coordenador' ? 'Cadastre uma igreja e sua classe dentro do seu distrito.' : 'O administrador cadastra o distrito, a igreja e a primeira classe.'}</Text>
          {role === 'admin' && <AuthField label="Distrito" placeholder="Ex.: Central" value={districtName} onChangeText={setDistrictName} />}
          <AuthField label="Igreja" placeholder="Ex.: Alto do Guarani" value={churchName} onChangeText={setChurchName} />
          <AuthField label="Classe" placeholder="Ex.: Base Cordilheira" value={className} onChangeText={setClassName} />
          <Pressable style={[styles.authPrimary, (structureBusy || !districtName.trim() || !churchName.trim() || !className.trim()) && styles.buttonDisabled]} disabled={structureBusy || !districtName.trim() || !churchName.trim() || !className.trim()} onPress={saveStructure}>
            <Text style={styles.authPrimaryText}>{structureBusy ? 'Criando estrutura...' : role === 'coordenador' ? 'Criar igreja e classe' : 'Criar distrito, igreja e classe'}</Text>
          </Pressable>
        </View>
      </>}
      {isRisk && <>{[
        ['Lucas Rocha', 'Sem presença há 3 semanas', 'ALTO', colors.coral], ['Beatriz Souza', 'Sem estudo há 2 semanas', 'MÉDIO', colors.gold], ['Rafael Lima', 'Queda de 35% no engajamento', 'MÉDIO', colors.gold],
      ].map(([name, copy, level, color]) => <View key={name} style={styles.riskCard}><View style={[styles.riskLine, { backgroundColor: color }]} /><View style={styles.rankAvatar}><Text style={styles.rankAvatarText}>{name[0]}</Text></View><View style={styles.flex}><Text style={styles.manageTitle}>{name}</Text><Text style={styles.manageCopy}>{copy}</Text></View><View><Text style={[styles.riskLevel, { color }]}>{level}</Text><Pressable onPress={() => setMemberNotice(`Lembrete preparado para ${name}`)}><Text style={styles.contactLink}>Lembrar</Text></Pressable></View></View>)}</>}
      {memberNotice !== '' && <Text style={styles.successNotice}>✓ {memberNotice}</Text>}
      {actionError !== '' && <Text style={styles.authError}>{actionError}</Text>}
      {!isContent && !isQuiz && !isApproval && !isReport && !isEvent && !isStructure && !isRisk && !isChallengeCreation && !isClassActivity && !isPresenceTheme && <>
        <View style={styles.inviteCodeCard}><Text style={styles.authEyebrow}>CÓDIGO ATUAL</Text><Text style={styles.inviteCode}>{classManagement.inviteCode || 'VIVA-7429'}</Text><Text style={styles.cardCaption}>Compartilhe somente com os membros da turma.</Text><Pressable style={styles.copyButton} onPress={() => runMembershipAction('regenerateCode')}><Text style={styles.copyButtonText}>Gerar novo código</Text></Pressable></View>
        {displayMembers.map(member => <Pressable key={member.id} style={[styles.memberRow, selectedMemberId === member.id && styles.memberRowSelected]} onPress={() => setSelectedMemberId(member.id)}><View style={styles.rankAvatar}><Text style={styles.rankAvatarText}>{member.name[0]}</Text></View><View style={styles.flex}><Text style={styles.manageTitle}>{member.name}</Text><Text style={styles.manageCopy}>{member.role === 'director' ? 'Diretor(a)' : 'Membro ativo'}</Text></View><Text style={styles.memberMenu}>{selectedMemberId === member.id ? '✓' : '•••'}</Text></Pressable>)}
        {isMembers && <><View style={styles.memberActions}><Pressable style={styles.memberActionButton} onPress={() => runMembershipAction('transferLeadership')}><Text style={styles.memberActionText}>⇄ Transferir liderança</Text></Pressable><Pressable style={styles.memberDangerButton} onPress={() => runMembershipAction('revokeDirector')}><Text style={styles.memberDangerText}>Revogar direção</Text></Pressable></View><Pressable style={styles.removeMemberButton} onPress={() => runMembershipAction('removeMember')}><Text style={styles.removeMemberText}>Remover membro da classe</Text></Pressable></>}
      </>}
      {!isApproval && !isReport && !isStructure && !isPeriodClosure && <Pressable style={[styles.authPrimary, saved && styles.buttonDone]} onPress={saveManagement}><Text style={styles.authPrimaryText}>{saved ? '✓ Alterações salvas' : isPresenceTheme ? 'Aplicar tema à base' : isClassActivity ? 'Publicar atividade' : isChallengeCreation ? 'Enviar para validação' : isQuizRanking ? 'Publicar notas e ranking' : isQuiz ? 'Salvar quiz' : isContent ? 'Publicar conteúdo' : isEvent ? 'Salvar encontro' : 'Salvar alterações'}</Text></Pressable>}
    </View>
  );
}

function ManagementApp({ role, onExit }: { role: Exclude<Role, 'adolescente'>; onExit: () => Promise<void> }) {
  const [section, setSection] = useState<'painel' | 'gestao' | 'atividade' | 'perfil'>('painel');
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const leadership = useLeadershipProfile(role);
  const roleName = role === 'diretor' ? 'Diretor de classe' : role === 'coordenador' ? 'Coordenador distrital' : 'Administrador geral';
  const scope = leadership.scope;
  const metrics = leadership.metrics.map((item, index) => [item[0], item[1], [colors.tealMedium, colors.gold, colors.coral][index]]);
  const performSignOut = async () => { setSigningOut(true); try { await onExit(); } finally { setSigningOut(false); } };
  const actions = role === 'diretor'
    ? [
      ['♙', 'Aprovar entradas', 'Novos adolescentes aguardando entrada', ''],
      ['✓', 'Corrigir quizzes', 'Respostas aguardando correção', ''],
      ['🏆', 'Publicar ranking semanal', 'Liberar notas e placar para a turma', ''],
      ['★', 'Encerrar período', 'Relatório trimestral e melhores do ano', ''],
      ['▤', 'Conteúdo semanal', 'Publicar lição e livro por turma', 'NOVO'],
      ['?', 'Quiz semanal', 'Criar perguntas e programar liberação', 'RASCUNHO'],
      ['✓', 'Avaliar resumos', 'Notas privadas dos adolescentes', '7'],
      ['⚑', 'Aprovar presenças', 'Validar fotos enviadas na igreja', '3'],
      ['◉', 'Acompanhamento e risco', 'Identificar queda de participação', '3'],
      ['✦', 'Moderar flashcards', 'Aprovar cartões enviados pela turma', ''],
      ['◆', 'Desafio mensal', 'Publicar evidência para o distrito', ''],
      ['⚑', 'Atividades externas', 'Criar programações para a própria base', ''],
      ['🏔️', 'Tema da presença', 'Escolher a jornada trimestral da base', ''],
    ]
    : role === 'coordenador'
      ? [
        ['✓', 'Aprovar diretores', 'Novos responsáveis aguardando análise', '3'],
        ['◆', 'Validar desafios', 'Evidências enviadas pelas classes', '2'],
        ['⌘', 'Classes do distrito', 'Desempenho por igreja e faixa', '12'],
        ['◉', 'Encontros distritais', 'Criar e gerenciar próximos eventos', ''],
        ['⇩', 'Relatório trimestral', 'Exportar dados consolidados', ''],
      ]
      : [
        ['⌘', 'Distritos', 'Coordenadores e estrutura regional', '8'],
        ['⌂', 'Igrejas e classes', 'Todas as turmas cadastradas', '47'],
        ['✓', 'Aprovações pendentes', 'Intervenções que precisam de atenção', '5'],
        ['♙', 'Gerenciar coordenadores', 'Convites, transferências e acessos', ''],
        ['⇩', 'Relatório geral', 'Indicadores consolidados do projeto', ''],
      ];

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <View style={styles.shell}>
        <View style={styles.managementHero}>
          <View style={styles.managementTop}><View><Text style={styles.eyebrowLight}>{roleName.toUpperCase()}</Text><Text style={styles.managementGreeting}>Olá, {leadership.name}</Text></View><View style={styles.avatar}><Text style={styles.avatarText}>{leadership.name[0]?.toUpperCase() ?? 'U'}</Text></View></View>
          <Text style={styles.managementScope}>{scope}</Text>
          {role === 'diretor' && <Pressable style={styles.classSelector}><Text style={styles.classSelectorText}>Turma ativa: Adolescentes⌄</Text></Pressable>}
        </View>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.managementContent} showsVerticalScrollIndicator={false}>
          {section === 'painel' && <>
            <Text style={styles.sectionTitle}>Visão de hoje</Text>
            <View style={styles.metricsGrid}>{metrics.map(([value, label, accent]) => <MetricCard key={label} value={value} label={label} accent={accent} />)}</View>
            <View style={styles.alertCard}><View style={styles.alertDot} /><View style={styles.flex}><Text style={styles.alertTitle}>Atenção necessária</Text><Text style={styles.alertCopy}>{role === 'diretor' ? '2 adolescentes estão há duas semanas sem presença.' : role === 'coordenador' ? '3 solicitações de diretor aguardam sua aprovação.' : 'O Distrito Norte ainda não possui coordenador.'}</Text></View></View>
            <View style={styles.sectionHeaderManagement}><Text style={styles.sectionTitle}>Desempenho</Text><Text style={styles.seeAll}>Ver relatório ›</Text></View>
            <View style={styles.performanceCard}><View style={styles.performanceTop}><Text style={styles.weekTitle}>Engajamento no trimestre</Text><Text style={styles.performanceUp}>↑ 12%</Text></View><View style={styles.barChart}>{[42, 58, 51, 72, 66, 81, 86].map((height, index) => <View key={index} style={[styles.chartBar, { height }, index === 6 && styles.chartBarActive]} />)}</View><View style={styles.chartLabels}>{['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7'].map(label => <Text key={label} style={styles.chartLabel}>{label}</Text>)}</View></View>
          </>}
          {section === 'gestao' && (selectedAction ? <ManagementDetail title={selectedAction} role={role} onBack={() => setSelectedAction(null)} /> : <><Text style={styles.pageEyebrow}>FERRAMENTAS</Text><Text style={styles.pageTitle}>Gestão</Text><Text style={styles.pageIntro}>Tudo que você precisa para acompanhar seu ministério.</Text>{actions.map(([icon, title, copy, badge]) => <ActionRow key={title} icon={icon} title={title} copy={copy} badge={badge || undefined} onPress={() => setSelectedAction(title)} />)}{role === 'diretor' && <ActionRow icon="♙" title="Gerenciar membros" copy="Convite, lista, transferências e acessos" onPress={() => setSelectedAction('Gerenciar membros')} />}</>)}
          {section === 'atividade' && <><Text style={styles.pageEyebrow}>ÚLTIMAS ATUALIZAÇÕES</Text><Text style={styles.pageTitle}>Atividade</Text><Text style={styles.pageIntro}>Acompanhe o que aconteceu recentemente.</Text>{[
            ['✓', 'Presença aprovada', 'Daniel avançou para a semana 7 · há 12 min'],
            ['★', 'Nova conquista', 'Marina completou 4 semanas de estudo · há 1h'],
            ['◆', 'Desafio enviado', 'Evidência do desafio de julho · ontem'],
            ['▤', 'Resumo recebido', '7 novos resumos aguardam avaliação · ontem'],
          ].map(([icon, title, copy]) => <ActionRow key={title} icon={icon} title={title} copy={copy} />)}</>}
          {section === 'perfil' && <><View style={styles.profileTop}><View style={styles.profileAvatar}><Text style={styles.profileAvatarText}>{leadership.name[0]?.toUpperCase() ?? 'U'}</Text></View><Text style={styles.profileName}>{leadership.name}</Text><Text style={styles.profileClass}>{roleName}</Text><Text style={styles.profileStatus}>{scope}</Text></View><ActionRow icon="⚙" title="Configurações" copy="Conta, notificações e privacidade" /><ActionRow icon="?" title="Ajuda" copy="Orientações sobre o aplicativo" /><Pressable style={styles.signOutButton} disabled={signingOut} onPress={performSignOut}><Text style={styles.signOutText}>{signingOut ? 'Saindo...' : 'Sair da conta'}</Text></Pressable></>}
        </ScrollView>
        <View style={styles.nav}>{[
          ['painel', '⌂', 'Painel'], ['gestao', '▤', 'Gestão'], ['atividade', '◉', 'Atividade'], ['perfil', '●', 'Perfil'],
        ].map(([key, icon, label]) => <Pressable key={key} style={styles.navItem} onPress={() => { setSection(key as typeof section); setSelectedAction(null); }}><View style={[styles.navIconWrap, section === key && styles.navIconActive]}><Text style={[styles.navIcon, section === key && styles.navIconTextActive]}>{icon}</Text></View><Text style={[styles.navLabel, section === key && styles.navLabelActive]}>{label}</Text></Pressable>)}</View>
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  const [activeRole, setActiveRole] = useState<Role | null>(null);
  const [authReady, setAuthReady] = useState(!firebaseEnabled);
  useEffect(() => {
    if (!firebaseEnabled) return;
    return subscribeToAuth(async user => {
      if (!user) { setActiveRole(null); setAuthReady(true); return; }
      const savedRole = await getUserRole(user.uid);
      setActiveRole(savedRole === 'director' ? 'diretor' : savedRole === 'coordinator' ? 'coordenador' : savedRole === 'admin' ? 'admin' : 'adolescente');
      setAuthReady(true);
    });
  }, []);
  const exit = async () => { if (firebaseEnabled) await logoutUser(); setActiveRole(null); };
  if (!authReady) return <SafeAreaView style={styles.loadingScreen}><ActivityIndicator size="large" color={colors.gold} /><Text style={styles.loadingText}>Preparando sua jornada...</Text></SafeAreaView>;
  if (!activeRole) return <AuthFlow onComplete={setActiveRole} />;
  if (activeRole === 'adolescente') return <MainApp onExit={exit} />;
  return <ManagementApp role={activeRole} onExit={exit} />;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.sage },
  welcomeSafe: { flex: 1, backgroundColor: colors.teal, overflow: 'hidden' },
  welcomeDecorOne: { position: 'absolute', width: 290, height: 290, borderRadius: 145, backgroundColor: colors.tealMedium, top: -95, right: -105 },
  welcomeDecorTwo: { position: 'absolute', width: 220, height: 220, borderRadius: 110, borderWidth: 35, borderColor: '#194A48', bottom: 115, left: -125 },
  welcomeBody: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 34 },
  welcomeLogo: { width: 90, height: 90, borderRadius: 27, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-4deg' }], shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } },
  welcomeLogoText: { color: colors.teal, fontSize: 48, fontWeight: '900' }, welcomeBrand: { color: colors.white, fontSize: 42, fontWeight: '900', letterSpacing: 7, marginTop: 24 },
  welcomeTagline: { color: colors.gold, fontSize: 17, fontWeight: '900', marginTop: 8 }, welcomeCopy: { color: '#BFD2CD', fontSize: 14, lineHeight: 21, textAlign: 'center', maxWidth: 290, marginTop: 16 },
  welcomeActions: { padding: 24, paddingBottom: 18 }, welcomePrimary: { backgroundColor: colors.coral, minHeight: 56, borderRadius: 17, alignItems: 'center', justifyContent: 'center' }, welcomePrimaryText: { color: colors.white, fontWeight: '900', fontSize: 15 },
  welcomeSecondary: { minHeight: 54, borderRadius: 17, borderWidth: 1, borderColor: '#6B8A84', alignItems: 'center', justifyContent: 'center', marginTop: 11 }, welcomeSecondaryText: { color: colors.white, fontWeight: '800', fontSize: 14 }, welcomeTerms: { color: '#79958E', textAlign: 'center', fontSize: 9, lineHeight: 14, marginTop: 15 },
  authSafe: { flex: 1, backgroundColor: colors.sage }, authPage: { flexGrow: 1, width: '100%', maxWidth: 520, alignSelf: 'center', padding: 22, paddingBottom: 40 },
  backButton: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', marginBottom: 25 }, backButtonText: { color: colors.teal, fontSize: 31, lineHeight: 34 },
  authMiniLogo: { width: 45, height: 45, borderRadius: 14, backgroundColor: colors.teal, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  authEyebrow: { color: colors.coral, fontSize: 10, fontWeight: '900', letterSpacing: 1.35, marginBottom: 7 }, authTitle: { color: colors.ink, fontSize: 30, lineHeight: 37, fontWeight: '900' }, authCopy: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: 7, marginBottom: 24 },
  authField: { marginBottom: 16 }, authLabel: { color: colors.ink, fontSize: 12, fontWeight: '800', marginBottom: 7 }, authInput: { height: 54, borderRadius: 16, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 16, color: colors.ink, fontSize: 14 },
  authPrimary: { minHeight: 55, backgroundColor: colors.coral, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginTop: 9 }, authPrimaryText: { color: colors.white, fontSize: 14, fontWeight: '900' }, forgotLink: { color: colors.coral, fontSize: 12, fontWeight: '800', textAlign: 'right', marginTop: -6, marginBottom: 8 },
  authSwitch: { textAlign: 'center', color: colors.muted, fontSize: 12, marginTop: 22 }, authSwitchStrong: { color: colors.coral, fontWeight: '900' }, demoBox: { padding: 12, borderRadius: 13, backgroundColor: '#E0E9E4', marginTop: 24 }, demoText: { color: colors.muted, fontSize: 10, textAlign: 'center' },
  authError: { color: '#A33A1D', backgroundColor: '#FBE0D6', borderRadius: 12, overflow: 'hidden', padding: 10, textAlign: 'center', fontSize: 10, marginTop: 12 },
  authSuccess: { color: colors.tealMedium, backgroundColor: '#DCEDE9', borderRadius: 12, overflow: 'hidden', padding: 10, textAlign: 'center', fontSize: 10, marginTop: 12 }, loadingScreen: { flex: 1, backgroundColor: colors.teal, alignItems: 'center', justifyContent: 'center' }, loadingText: { color: colors.white, fontSize: 12, fontWeight: '800', marginTop: 14 },
  roleCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: 18, borderWidth: 2, borderColor: 'transparent', padding: 14, marginBottom: 10 }, roleCardActive: { borderColor: colors.coral, backgroundColor: '#FFF8F5' }, roleIcon: { width: 46, height: 46, borderRadius: 14, backgroundColor: '#E4ECE8', alignItems: 'center', justifyContent: 'center', marginRight: 12 }, roleIconActive: { backgroundColor: colors.coral }, roleIconText: { color: colors.teal, fontSize: 18, fontWeight: '900' }, roleIconTextActive: { color: colors.white }, roleTitle: { color: colors.ink, fontSize: 14, fontWeight: '900' }, roleCopy: { color: colors.muted, fontSize: 10, lineHeight: 14, marginTop: 3, maxWidth: 250 }, radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#B4C1BC', alignItems: 'center', justifyContent: 'center', marginLeft: 8 }, radioActive: { borderColor: colors.coral }, radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.coral }, approvalHint: { color: colors.muted, fontSize: 10, lineHeight: 15, textAlign: 'center', marginTop: 12 },
  scopeSection: { backgroundColor: colors.white, borderRadius: 18, padding: 14, marginTop: 4, marginBottom: 10 }, scopeWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, scopeChip: { borderRadius: 12, backgroundColor: colors.sage, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 11, paddingVertical: 8 }, scopeChipActive: { backgroundColor: colors.tealMedium, borderColor: colors.tealMedium }, scopeChipText: { color: colors.teal, fontSize: 9, fontWeight: '800' }, scopeChipTextActive: { color: colors.white },
  inviteIllustration: { width: 80, height: 80, borderRadius: 25, backgroundColor: '#DCEDE9', alignItems: 'center', justifyContent: 'center', marginBottom: 23 }, inviteIllustrationText: { color: colors.tealMedium, fontSize: 44, fontWeight: '900' }, classFound: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#DCEDE9', borderRadius: 16, padding: 14, marginTop: -4, marginBottom: 10 }, classFoundIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center', marginRight: 11 }, classFoundTitle: { color: colors.teal, fontSize: 14, fontWeight: '900' }, classFoundCopy: { color: colors.muted, fontSize: 10, marginTop: 2 }, skipLink: { color: colors.tealMedium, fontSize: 12, fontWeight: '800', textAlign: 'center', marginTop: 21 },
  managementHero: { backgroundColor: colors.teal, padding: 22, paddingBottom: 28, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 }, managementTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, managementGreeting: { color: colors.white, fontSize: 26, fontWeight: '900', marginTop: 3 }, managementScope: { color: '#BFD2CD', fontSize: 13, marginTop: 18 }, classSelector: { alignSelf: 'flex-start', backgroundColor: colors.tealMedium, borderWidth: 1, borderColor: '#43736E', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, marginTop: 13 }, classSelectorText: { color: colors.white, fontSize: 11, fontWeight: '800' }, managementContent: { padding: 20, paddingBottom: 30 },
  metricsGrid: { flexDirection: 'row', gap: 9, marginTop: 13, marginBottom: 18 }, metricCard: { flex: 1, minHeight: 95, backgroundColor: colors.white, borderRadius: 16, borderTopWidth: 4, padding: 12, justifyContent: 'center' }, metricValue: { color: colors.teal, fontSize: 23, fontWeight: '900' }, metricLabel: { color: colors.muted, fontSize: 9, lineHeight: 13, marginTop: 4 },
  alertCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FBE4DA', borderRadius: 17, padding: 14 }, alertDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.coral, marginRight: 12 }, alertTitle: { color: '#9A3D23', fontSize: 12, fontWeight: '900' }, alertCopy: { color: '#805343', fontSize: 10, lineHeight: 15, marginTop: 3 }, sectionHeaderManagement: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, marginBottom: 12 }, seeAll: { color: colors.coral, fontSize: 11, fontWeight: '900' },
  performanceCard: { backgroundColor: colors.white, borderRadius: 19, padding: 16 }, performanceTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, performanceUp: { color: colors.tealMedium, fontSize: 12, fontWeight: '900' }, barChart: { height: 105, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', marginTop: 17, borderBottomWidth: 1, borderBottomColor: colors.line }, chartBar: { width: 20, backgroundColor: '#BFD2CD', borderTopLeftRadius: 5, borderTopRightRadius: 5 }, chartBarActive: { backgroundColor: colors.gold }, chartLabels: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 7 }, chartLabel: { color: colors.muted, fontSize: 8 },
  manageRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: 17, padding: 13, marginBottom: 10 }, manageIcon: { width: 43, height: 43, borderRadius: 13, backgroundColor: '#DCEDE9', alignItems: 'center', justifyContent: 'center', marginRight: 12 }, manageIconText: { color: colors.teal, fontSize: 17, fontWeight: '900' }, manageTitle: { color: colors.ink, fontSize: 13, fontWeight: '900' }, manageCopy: { color: colors.muted, fontSize: 9, lineHeight: 14, marginTop: 3 }, manageBadge: { backgroundColor: '#FBE0D6', color: colors.coral, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 9, overflow: 'hidden', fontSize: 8, fontWeight: '900' }, signOutButton: { minHeight: 52, borderRadius: 16, borderWidth: 1, borderColor: '#D6A28E', alignItems: 'center', justifyContent: 'center', marginTop: 15 }, signOutText: { color: colors.coral, fontSize: 13, fontWeight: '900' },
  communityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12, marginBottom: 24 }, communityCard: { width: '48%', minHeight: 116, borderRadius: 18, padding: 14 }, communityIcon: { color: colors.teal, fontSize: 20, fontWeight: '900' }, communityLabel: { color: colors.ink, fontSize: 14, fontWeight: '900', marginTop: 12 }, communityLink: { color: colors.tealMedium, fontSize: 10, fontWeight: '800', marginTop: 6 },
  rankingTabs: { flexDirection: 'row', backgroundColor: '#E1E9E4', borderRadius: 14, padding: 4, marginBottom: 13 }, rankingTab: { flex: 1, textAlign: 'center', color: colors.muted, fontSize: 10, fontWeight: '800', paddingVertical: 9 }, rankingTabActive: { flex: 1, textAlign: 'center', color: colors.white, backgroundColor: colors.tealMedium, borderRadius: 10, overflow: 'hidden', fontSize: 10, fontWeight: '900', paddingVertical: 9 }, rankRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: 16, padding: 12, marginBottom: 8 }, rankRowCurrent: { borderWidth: 2, borderColor: colors.gold, backgroundColor: '#FFF9EC' }, rankPlace: { width: 28, color: colors.teal, fontSize: 16, fontWeight: '900' }, rankAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#DCEDE9', alignItems: 'center', justifyContent: 'center', marginRight: 10 }, rankAvatarText: { color: colors.teal, fontWeight: '900' }, rankName: { flex: 1, color: colors.ink, fontSize: 12, fontWeight: '800' }, rankPoints: { color: '#9A6815', fontSize: 11, fontWeight: '900' },
  feedCard: { flexDirection: 'row', backgroundColor: colors.white, borderRadius: 18, padding: 15, marginBottom: 11 }, feedEmoji: { width: 42, fontSize: 25 }, reactions: { color: colors.coral, fontSize: 11, fontWeight: '800' }, reactionRow: { flexDirection: 'row', gap: 7, marginTop: 11 }, reactionButton: { backgroundColor: '#FFF3EC', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 7 }, flashGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, flashCard: { width: '47%', minHeight: 150, borderRadius: 4, padding: 15, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } }, flashLabel: { color: colors.muted, fontSize: 8, fontWeight: '900', letterSpacing: 1 }, flashText: { color: colors.ink, fontSize: 13, lineHeight: 20, fontWeight: '700', marginTop: 12 },
  challengeCard: { backgroundColor: colors.white, borderRadius: 22, padding: 18 }, challengeTitle: { color: colors.ink, fontSize: 23, fontWeight: '900', marginTop: 17 }, challengeCopy: { color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: 8 }, challengeMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 22, marginBottom: 8 }, challengePoints: { color: colors.coral, fontSize: 13, fontWeight: '900' }, challengeStatus: { color: colors.tealMedium, backgroundColor: '#DCEDE9', borderRadius: 12, overflow: 'hidden', padding: 11, fontSize: 9, fontWeight: '800', marginTop: 13 },
  hallCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: 17, padding: 14, marginBottom: 10, borderLeftWidth: 4, borderLeftColor: colors.gold }, hallIcon: { width: 43, fontSize: 25 }, notificationCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: 17, padding: 14, marginBottom: 9 }, notificationUnread: { backgroundColor: '#FFF8E9', borderWidth: 1, borderColor: '#EED49D' }, notificationTag: { color: colors.coral, backgroundColor: '#FBE0D6', borderRadius: 9, overflow: 'hidden', paddingHorizontal: 7, paddingVertical: 5, fontSize: 7, fontWeight: '900', marginRight: 10 }, unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.coral, marginLeft: 8 },
  uploadBox: { minHeight: 130, borderRadius: 18, borderWidth: 2, borderStyle: 'dashed', borderColor: '#B9C9C2', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F6F8F5', marginBottom: 15 }, uploadIcon: { color: colors.coral, fontSize: 28, fontWeight: '600' }, uploadTitle: { color: colors.ink, fontSize: 13, fontWeight: '900', marginTop: 4 }, uploadCopy: { color: colors.muted, fontSize: 9, marginTop: 4 }, scheduleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.white, borderRadius: 17, padding: 15, marginBottom: 11 }, toggleOn: { width: 44, height: 25, borderRadius: 13, backgroundColor: colors.tealMedium, padding: 3, alignItems: 'flex-end' }, toggleKnob: { width: 19, height: 19, borderRadius: 10, backgroundColor: colors.white }, formCard: { backgroundColor: colors.white, borderRadius: 18, padding: 15, marginBottom: 12 }, textArea: { height: 82, paddingTop: 13, textAlignVertical: 'top', marginBottom: 12 }, quizEditOption: { minHeight: 49, flexDirection: 'row', alignItems: 'center', borderRadius: 13, backgroundColor: colors.sage, padding: 7, marginBottom: 7, borderWidth: 1, borderColor: 'transparent' }, quizEditCorrect: { backgroundColor: '#E1F0E9', borderColor: colors.tealMedium }, correctLabel: { color: colors.tealMedium, fontSize: 8, fontWeight: '900', marginLeft: 'auto', marginRight: 7 }, addQuestion: { minHeight: 43, alignItems: 'center', justifyContent: 'center', marginTop: 5 }, addQuestionText: { color: colors.coral, fontSize: 11, fontWeight: '900' }, approvalCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: 17, padding: 12, marginBottom: 9 }, approveButton: { backgroundColor: '#FBE0D6', borderRadius: 11, paddingHorizontal: 10, paddingVertical: 8 }, approveButtonDone: { backgroundColor: '#DCEDE9' }, approveButtonText: { color: colors.coral, fontSize: 9, fontWeight: '900' }, approveButtonTextDone: { color: colors.tealMedium }, inviteCodeCard: { backgroundColor: colors.teal, borderRadius: 20, padding: 18, marginBottom: 14 }, inviteCode: { color: colors.gold, fontSize: 28, fontWeight: '900', letterSpacing: 3, marginVertical: 12 }, copyButton: { alignSelf: 'flex-start', backgroundColor: colors.white, borderRadius: 11, paddingHorizontal: 12, paddingVertical: 8, marginTop: 13 }, copyButtonText: { color: colors.teal, fontSize: 10, fontWeight: '900' }, memberRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: 15, padding: 11, marginBottom: 8 },
  reportHero: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.teal, borderRadius: 20, padding: 18, marginBottom: 13 }, reportValue: { color: colors.gold, fontSize: 31, fontWeight: '900', marginRight: 17 }, reportTitle: { color: colors.white, fontSize: 13, fontWeight: '900' }, reportCopy: { color: '#BFD2CD', fontSize: 9, marginTop: 4 }, reportRow: { backgroundColor: colors.white, borderRadius: 15, padding: 14, marginBottom: 8 }, reportRowTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }, reportPercent: { color: colors.teal, fontSize: 12, fontWeight: '900' }, exportButton: { minHeight: 52, borderRadius: 16, backgroundColor: colors.coral, alignItems: 'center', justifyContent: 'center', marginTop: 10 }, exportButtonText: { color: colors.white, fontSize: 12, fontWeight: '900' },
  eventCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.teal, borderRadius: 20, padding: 16, marginBottom: 14 }, eventDate: { width: 58, height: 65, borderRadius: 15, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center', marginRight: 14 }, eventDay: { color: colors.teal, fontSize: 25, fontWeight: '900' }, eventMonth: { color: colors.teal, fontSize: 9, fontWeight: '900' }, eventTitle: { color: colors.white, fontSize: 15, fontWeight: '900' }, eventCopy: { color: '#BFD2CD', fontSize: 10, marginTop: 4 }, eventPeople: { color: colors.gold, fontSize: 9, fontWeight: '800', marginTop: 8 },
  searchBox: { height: 50, borderRadius: 15, backgroundColor: colors.white, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, marginBottom: 12 }, searchIcon: { color: colors.teal, fontSize: 20, marginRight: 10 }, searchPlaceholder: { color: '#8A9892', fontSize: 11 }, structureCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: 17, padding: 12, marginBottom: 9 }, structureIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#DCEDE9', alignItems: 'center', justifyContent: 'center', marginRight: 11 }, structureIconText: { color: colors.teal, fontSize: 17, fontWeight: '900' }, structurePercent: { color: colors.tealMedium, fontSize: 11, fontWeight: '900' }, outlineButton: { minHeight: 50, borderRadius: 16, borderWidth: 1, borderColor: colors.coral, alignItems: 'center', justifyContent: 'center', marginTop: 8 }, outlineButtonText: { color: colors.coral, fontSize: 11, fontWeight: '900' },
  riskCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: 17, padding: 12, marginBottom: 9, overflow: 'hidden' }, riskLine: { width: 4, alignSelf: 'stretch', borderRadius: 3, marginRight: 10 }, riskLevel: { fontSize: 8, fontWeight: '900', textAlign: 'right' }, contactLink: { color: colors.tealMedium, fontSize: 9, fontWeight: '900', marginTop: 7 }, successNotice: { color: colors.tealMedium, backgroundColor: '#DCEDE9', borderRadius: 13, overflow: 'hidden', padding: 11, textAlign: 'center', fontSize: 9, fontWeight: '800', marginBottom: 10 }, memberMenu: { color: colors.teal, fontSize: 16, fontWeight: '900', padding: 8 }, memberActions: { flexDirection: 'row', gap: 8, marginTop: 6 }, memberActionButton: { flex: 1, minHeight: 44, borderRadius: 13, backgroundColor: '#DCEDE9', alignItems: 'center', justifyContent: 'center' }, memberActionText: { color: colors.teal, fontSize: 9, fontWeight: '900' }, memberDangerButton: { flex: 1, minHeight: 44, borderRadius: 13, backgroundColor: '#FBE0D6', alignItems: 'center', justifyContent: 'center' }, memberDangerText: { color: colors.coral, fontSize: 9, fontWeight: '900' },
  memberRowSelected: { borderWidth: 2, borderColor: colors.gold, backgroundColor: '#FFF9EC' }, removeMemberButton: { minHeight: 42, alignItems: 'center', justifyContent: 'center', marginTop: 7 }, removeMemberText: { color: colors.coral, fontSize: 9, fontWeight: '800' },
  shell: { flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center', backgroundColor: colors.sage },
  scroll: { flex: 1 }, content: { paddingBottom: 28 }, flex: { flex: 1 },
  hero: { backgroundColor: colors.teal, paddingHorizontal: 22, paddingTop: 25, paddingBottom: 42, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
  eyebrowLight: { color: '#9FC1B9', fontSize: 11, fontWeight: '800', letterSpacing: 1.3 },
  greeting: { color: colors.white, fontSize: 27, fontWeight: '900', marginTop: 4 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#F6DCA7' },
  avatarText: { fontSize: 20, fontWeight: '900', color: colors.teal },
  verse: { color: colors.white, fontSize: 20, lineHeight: 28, fontWeight: '700', maxWidth: 340 },
  verseRef: { color: colors.gold, fontSize: 13, fontWeight: '800', marginTop: 8 },
  streakCard: { marginHorizontal: 18, marginTop: -20, backgroundColor: colors.white, borderRadius: 20, padding: 15, flexDirection: 'row', alignItems: 'center', shadowColor: '#0F3535', shadowOpacity: 0.1, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  streakIcon: { width: 46, height: 46, borderRadius: 14, backgroundColor: '#FCE7DE', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  streakEmoji: { fontSize: 23 }, streakTitle: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  streakNumber: { fontSize: 28, color: colors.coral, fontWeight: '900', marginLeft: 8 },
  sectionHeader: { marginHorizontal: 20, marginTop: 25, marginBottom: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: colors.ink, fontSize: 20, fontWeight: '900' },
  pill: { fontSize: 10, fontWeight: '900', letterSpacing: 0.7, overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 99 },
  weekCard: { marginHorizontal: 18, padding: 17, borderRadius: 20, backgroundColor: colors.white },
  weekRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  weekTitle: { color: colors.ink, fontSize: 15, fontWeight: '800', flex: 1, paddingRight: 10 }, percent: { color: colors.tealMedium, fontWeight: '900' },
  progressTrack: { height: 8, backgroundColor: '#E6ECE8', borderRadius: 8, overflow: 'hidden', marginBottom: 12 }, progressFill: { height: '100%', borderRadius: 8 },
  taskRow: { minHeight: 42, flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#EDF1EE' },
  taskDone: { color: colors.tealMedium, fontSize: 16, fontWeight: '900', width: 25 }, taskOpen: { color: colors.coral, fontSize: 19, width: 25 },
  taskText: { flex: 1, color: colors.ink, fontSize: 13, fontWeight: '700' }, taskTextDone: { flex: 1, color: colors.muted, fontSize: 13, textDecorationLine: 'line-through' },
  points: { color: '#A36B0A', fontWeight: '800', fontSize: 11 }, taskAction: { color: colors.coral, fontWeight: '900', fontSize: 12 },
  quickGrid: { flexDirection: 'row', gap: 12, marginHorizontal: 18 }, quickCard: { flex: 1, borderRadius: 20, padding: 16, minHeight: 168 }, quizCard: { backgroundColor: colors.coral }, raceCard: { backgroundColor: colors.tealMedium },
  quickIcon: { color: colors.white, fontSize: 22, fontWeight: '900', marginBottom: 13 }, quickTitle: { color: colors.white, fontSize: 17, fontWeight: '900' }, quickMeta: { color: '#F9E9E2', fontSize: 11, marginTop: 5, lineHeight: 16 },
  countdown: { color: colors.white, fontSize: 19, fontWeight: '900', marginTop: 12, letterSpacing: 1 }, raceLink: { color: colors.gold, fontSize: 13, fontWeight: '900', marginTop: 18 },
  appHeader: { height: 64, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.line },
  brandMark: { width: 30, height: 30, backgroundColor: colors.teal, borderRadius: 9, alignItems: 'center', justifyContent: 'center' }, brandMarkText: { color: colors.gold, fontWeight: '900' },
  brand: { color: colors.teal, fontSize: 16, fontWeight: '900', letterSpacing: 1.5, flex: 1 }, pagePad: { padding: 20 },
  pageEyebrow: { color: colors.coral, fontSize: 11, fontWeight: '900', letterSpacing: 1.2, marginTop: 6 },
  pageTitle: { color: colors.ink, fontSize: 27, lineHeight: 35, fontWeight: '900', marginTop: 7 }, pageIntro: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: 8, marginBottom: 20 },
  studyCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: 18, padding: 14, marginBottom: 11 },
  studyIcon: { width: 50, height: 50, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginRight: 13 }, studyEmoji: { fontSize: 21 }, studyLabel: { color: colors.coral, fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 }, studyTitle: { color: colors.ink, fontSize: 15, fontWeight: '800', marginVertical: 3 }, cardCaption: { color: colors.muted, fontSize: 11, lineHeight: 16 }, chevron: { color: colors.tealMedium, fontSize: 28 },
  summaryCard: { backgroundColor: colors.white, borderRadius: 18, padding: 15, marginTop: 3 }, privateHint: { color: colors.tealMedium, fontSize: 9, marginBottom: 10 }, summaryInput: { height: 110, textAlignVertical: 'top', paddingTop: 13 }, charCount: { color: colors.muted, fontSize: 8, textAlign: 'right', marginTop: 5 }, pendingHint: { color: colors.tealMedium, fontSize: 9, lineHeight: 14, textAlign: 'center', marginTop: 10 },
  primaryButton: { backgroundColor: colors.coral, borderRadius: 16, minHeight: 52, alignItems: 'center', justifyContent: 'center', marginTop: 13 }, primaryButtonText: { color: colors.white, fontSize: 14, fontWeight: '900' }, buttonDone: { backgroundColor: colors.tealMedium }, buttonDisabled: { opacity: 0.4 },
  mountainCard: { height: 380, backgroundColor: '#DCEDE9', borderRadius: 24, overflow: 'hidden', position: 'relative', marginBottom: 14 },
  trail: { position: 'absolute', top: 62, bottom: 25, left: '49%', width: 5, borderRadius: 4, backgroundColor: '#B8CFC7', transform: [{ rotate: '12deg' }] }, summit: { position: 'absolute', top: 20, alignSelf: 'center', backgroundColor: colors.gold, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 }, summitText: { color: colors.teal, fontSize: 10, fontWeight: '900' },
  checkpoint: { position: 'absolute', width: 28, height: 28, borderRadius: 14, backgroundColor: colors.white, borderWidth: 3, borderColor: '#B8CFC7', alignItems: 'center', justifyContent: 'center' }, currentCheckpoint: { width: 38, height: 38, borderRadius: 19, marginLeft: -5, marginTop: -5, backgroundColor: colors.coral, borderColor: colors.white, shadowOpacity: 0.18, shadowRadius: 8 }, approvedCheckpoint: { backgroundColor: colors.tealMedium, borderColor: colors.white }, checkpointText: { fontSize: 10, fontWeight: '900', color: colors.teal },
  statsRow: { flexDirection: 'row', backgroundColor: colors.white, borderRadius: 18, paddingVertical: 16, marginBottom: 22 }, stat: { flex: 1, alignItems: 'center', borderRightWidth: 1, borderRightColor: colors.line }, statValue: { color: colors.teal, fontSize: 20, fontWeight: '900', marginBottom: 3 },
  quizHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }, quizPoints: { color: '#A36B0A', fontWeight: '900' },
  option: { minHeight: 62, borderRadius: 17, padding: 12, backgroundColor: colors.white, flexDirection: 'row', alignItems: 'center', marginBottom: 10, borderWidth: 2, borderColor: 'transparent' }, optionSelected: { borderColor: colors.coral, backgroundColor: '#FFF7F4' }, optionLetter: { width: 37, height: 37, borderRadius: 12, backgroundColor: colors.sage, color: colors.teal, textAlign: 'center', lineHeight: 37, fontWeight: '900', marginRight: 13 }, optionLetterSelected: { backgroundColor: colors.coral, color: colors.white }, optionText: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  profileTop: { alignItems: 'center', paddingVertical: 15 }, profileAvatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.gold, borderWidth: 5, borderColor: '#F7E3BA', alignItems: 'center', justifyContent: 'center' }, profileAvatarText: { color: colors.teal, fontSize: 36, fontWeight: '900' }, profileName: { color: colors.ink, fontSize: 24, fontWeight: '900', marginTop: 12 }, profileClass: { color: colors.coral, fontWeight: '800', marginTop: 4, fontSize: 12 }, profileStatus: { color: colors.muted, marginTop: 10, fontStyle: 'italic' }, colorChoices: { flexDirection: 'row', gap: 12, marginBottom: 15 }, colorChoice: { width: 34, height: 34, borderRadius: 17 }, colorChoiceActive: { borderWidth: 4, borderColor: colors.ink }, profilePeerCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: 17, padding: 14, marginBottom: 9 }, themeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 }, themeCard: { width: '47%', minHeight: 105, borderRadius: 16, backgroundColor: colors.sage, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' }, themeCardActive: { backgroundColor: '#FFF3DB', borderColor: colors.gold }, themeIcon: { fontSize: 30, marginBottom: 7 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, marginBottom: 24 }, badge: { width: '31%', minHeight: 112, borderRadius: 17, backgroundColor: '#F8E8C8', alignItems: 'center', justifyContent: 'center', padding: 7, borderWidth: 1, borderColor: '#EED49D' }, badgeLocked: { backgroundColor: '#E8ECE8', borderColor: '#D1D8D3', opacity: 0.75 }, badgeText: { textAlign: 'center', color: colors.teal, fontSize: 11, lineHeight: 20, fontWeight: '800' }, badgeDetail: { textAlign: 'center', color: colors.muted, fontSize: 7, marginTop: 4 },
  nav: { height: 76, backgroundColor: colors.white, flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 8, paddingBottom: 5 },
  navItem: { flex: 1, alignItems: 'center' }, navIconWrap: { width: 34, height: 30, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, navIconActive: { backgroundColor: '#DCEDE9' }, navIcon: { color: '#81908A', fontSize: 17, fontWeight: '900' }, navIconTextActive: { color: colors.teal }, navLabel: { color: '#81908A', fontSize: 9, fontWeight: '700', marginTop: 3 }, navLabelActive: { color: colors.teal, fontWeight: '900' },
});
