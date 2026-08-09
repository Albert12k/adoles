import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Image,
  Linking,
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
import { getMyQuizAttempt, getQuizRanking, getWeeklyQuiz, listMyAttendance, listMyStudyRecords, listQuizRankingHistory, listWeeklyContent, requestClassEntry, saveStudy, submitQuizAnswers, subscribeToQuizAvailability, validateClassInviteCode } from './src/services/data';
import { useLiveDashboard } from './src/hooks/useLiveDashboard';
import { archiveWeeklyContent, endQuizNow, getAttendanceProgress, listManagedContent, listManagedQuizzes, manageClassMembership, publishContent, publishLatestQuizRanking, publishQuizContent, reviewLeadershipItem, sendAttendanceReminder, sendQuizReminder, subscribeQuizParticipation, type AttendanceProgress, type ManagedContent, type ManagedQuiz } from './src/services/management';
import { exportLeadershipReport, loadLeadershipReport, type LeadershipReport } from './src/services/report';
import { selectAndUploadContentPdf, selectAttendancePhoto, uploadSelectedAttendancePhoto } from './src/services/media';
import { markNotificationRead, registerPushNotifications } from './src/services/notifications';
import { useClassManagement, useLeadershipHistory, usePendingApprovals } from './src/hooks/useLeadershipData';
import type { ApprovalType } from './src/hooks/useLeadershipData';
import { createFlashcard, listPublishedFlashcards, type Flashcard } from './src/services/flashcards';
import { listApprovedChallenges, submitClassChallenge, type ClassChallenge } from './src/services/challenges';
import { cancelClassActivityRegistration, closeClassActivity, confirmClassActivityAttendance, createClassActivity, joinClassActivity, listClassActivities, listDirectedActivities, listMyActivityRegistrations, updateClassActivity, type ClassActivity } from './src/services/activities';
import { listClassProfiles, listMuralPosts, reactToMuralPost, updateMyPublicProfile, type MuralPost, type PublicProfile } from './src/services/community';
import { createCoordinatorStructure, createInitialStructure, listStructures, type StructureItem } from './src/services/structure';
import { useLeadershipProfile } from './src/hooks/useLeadershipProfile';
import { useStudentProfile } from './src/hooks/useStudentProfile';
import { useStudentProgress } from './src/hooks/useStudentProgress';
import { getPresenceScenario, presenceScenarios, resolvePresenceScenario, updatePresenceScenario, type PresenceScenario } from './src/services/presenceTheme';
import { getDistrictRankings, type DistrictRankings } from './src/services/rankings';
import { listClassEngagement, recordEngagementFollowUp, type EngagementMember } from './src/services/engagement';
import { useWeeklyJourney, verseOfTheDay } from './src/hooks/useWeeklyJourney';
import { cancelCoordinatorInvite, createCoordinatorInvite, listCoordinatorAccounts, listCoordinatorAudit, listCoordinatorInvites, updateCoordinatorAccount, type CoordinatorAccount, type CoordinatorAuditItem, type CoordinatorInvite } from './src/services/coordinatorInvites';
import { cancelDistrictEvent, cancelEventAttendance, completeDistrictEvent, confirmEventAttendance, createDistrictEvent, listCurrentDistrictEvents, listDistrictEventFeedback, listDistrictEvents, listMyCompletedEvents, listMyEventRegistrations, promoteNextWaitlisted, remindEventParticipants, setEventCheckIn, submitEventFeedback, updateDistrictEvent, type CompletedEvent, type DistrictEvent, type EventFeedback, type MyEventRegistration } from './src/services/events';
import { closeCurrentPeriod, exportPeriodClosure, listPeriodClosures, type PeriodClosure, type PeriodKind } from './src/services/periods';
import { listLeadershipActivity, type ActivityCategory, type LeadershipActivity } from './src/services/activityFeed';
import { getAccountDeletionRequest, getLeadershipSettings, requestAccountDeletion, saveLeadershipSettings, type LeadershipSettings } from './src/services/settings';
import { loadDashboardInsights, type DashboardInsights } from './src/services/dashboard';

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
const quizTypeLabels: Record<QuizQuestionDraft['type'], string> = { multiple_choice: '🎯 Múltipla escolha', true_false: '⚡ Verdadeiro ou falso', assertion_reason: '🧩 Afirmação + complemento', open: '✍️ Questão aberta', identify_false: '🔎 Identifique a falsa' };
const nextSaturdayAt = () => { const date = new Date(); const days = (6 - date.getDay() + 7) % 7 || 7; date.setDate(date.getDate() + days); date.setHours(0, 0, 0, 0); return date.getTime(); };

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

function HomeScreen({ onNavigate, name, pending, classId, districtId }: { onNavigate: (tab: Tab) => void; name: string; pending: boolean; classId: string; districtId: string }) {
  const progress = useStudentProgress();
  const weekly = useWeeklyJourney(classId);
  const dailyVerse = verseOfTheDay();
  const [homeQuiz, setHomeQuiz] = useState<{ releaseAt?: number | { toMillis?: () => number }; title?: string } | null>(null);
  const [nextEvent, setNextEvent] = useState<DistrictEvent | null>(null);
  const [homeEventRegistrations, setHomeEventRegistrations] = useState<MyEventRegistration[]>([]);
  const [clock, setClock] = useState(Date.now());
  useEffect(() => { if (classId) getWeeklyQuiz(classId).then(item => setHomeQuiz(item as unknown as typeof homeQuiz)).catch(() => undefined); }, [classId]);
  useEffect(() => { if (districtId) listDistrictEvents(districtId).then(items => setNextEvent(items[0] ?? null)).catch(() => undefined); }, [districtId]);
  useEffect(() => { listMyEventRegistrations().then(setHomeEventRegistrations).catch(() => undefined); }, []);
  useEffect(() => { const timer = setInterval(() => setClock(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const releaseAt = typeof homeQuiz?.releaseAt === 'number' ? homeQuiz.releaseAt : homeQuiz?.releaseAt?.toMillis?.() ?? 0;
  const remaining = Math.max(0, releaseAt - clock);
  const countdown = releaseAt <= clock ? 'Disponível agora' : `${String(Math.floor(remaining / 3600000)).padStart(2, '0')}:${String(Math.floor((remaining % 3600000) / 60000)).padStart(2, '0')}:${String(Math.floor((remaining % 60000) / 1000)).padStart(2, '0')}`;
  const todayLabel = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }).format(new Date()).toUpperCase();
  const completedTasks = weekly.tasks.filter(item => item.done).length;
  const weeklyPercent = weekly.tasks.length ? Math.round(completedTasks / weekly.tasks.length * 100) : 0;
  const nextTask = weekly.tasks.find(item => !item.done);
  const today = new Date();
  const currentQuarter = Math.floor(today.getMonth() / 3) + 1;
  const currentQuarterStart = new Date(today.getFullYear(), (currentQuarter - 1) * 3, 1);
  const currentPresenceWeek = Math.min(13, Math.floor((today.getTime() - currentQuarterStart.getTime()) / (7 * 86400000)) + 1);
  return (
    <>
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View>
            <Text style={styles.eyebrowLight}>{todayLabel}</Text>
            <Text style={styles.greeting}>Olá, {name}! 👋</Text>
          </View>
          <View style={styles.avatar}><Text style={styles.avatarText}>{name[0]?.toUpperCase() ?? 'A'}</Text></View>
        </View>
        <Text style={styles.verse}>“{dailyVerse.text}”</Text>
        <Text style={styles.verseRef}>{dailyVerse.reference}</Text>
      </View>

      {pending && <View style={styles.alertCard}><View style={styles.alertDot} /><View style={styles.flex}><Text style={styles.alertTitle}>Entrada aguardando aprovação</Text><Text style={styles.alertCopy}>O diretor da classe recebeu seu pedido. Você terá acesso ao conteúdo assim que ele aprovar.</Text></View></View>}

      <View style={styles.streakCard}>
        <View style={styles.streakIcon}><Text style={styles.streakEmoji}>🔥</Text></View>
        <View style={styles.flex}>
          <Text style={styles.streakTitle}>{progress.streak > 0 ? `${progress.streak} semana${progress.streak === 1 ? '' : 's'} em sequência!` : 'Comece sua sequência!'}</Text>
          <Text style={styles.cardCaption}>Continue estudando para manter seu ritmo.</Text>
        </View>
        <Text style={styles.streakNumber}>{progress.streak}</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.stat}><Text style={styles.statValue}>{progress.points}</Text><Text style={styles.cardCaption}>pontos reais</Text></View>
        <View style={styles.stat}><Text style={styles.statValue}>{progress.attendance}</Text><Text style={styles.cardCaption}>presenças</Text></View>
        <View style={styles.stat}><Text style={styles.statValue}>{progress.quizCorrect}</Text><Text style={styles.cardCaption}>acertos no quiz</Text></View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Sua semana</Text>
        <Pill tone="teal">{completedTasks} de {weekly.tasks.length || 4} feitos</Pill>
      </View>
      <View style={styles.weekCard}>
        <View style={styles.weekRow}>
          <Text style={styles.weekTitle}>{weekly.title}</Text>
          <Text style={styles.percent}>{weeklyPercent}%</Text>
        </View>
        <Progress value={weeklyPercent} />
        {weekly.tasks.map(task => <Pressable key={task.key} style={styles.taskRow} onPress={() => !task.done && onNavigate(task.tab)}><Text style={task.done ? styles.taskDone : styles.taskOpen}>{task.done ? '✓' : '○'}</Text><Text style={task.done ? styles.taskTextDone : styles.taskText}>{task.label}</Text><Text style={task.done ? styles.points : styles.taskAction}>{task.done ? `+${task.points} pts` : 'Fazer ›'}</Text></Pressable>)}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Próximos passos</Text>
      </View>
      {nextTask ? <Pressable style={styles.formCard} onPress={() => onNavigate(nextTask.tab)}><Pill tone="coral">RECOMENDADO AGORA</Pill><Text style={styles.manageTitle}>{nextTask.label}</Text><Text style={styles.manageCopy}>Continue sua semana e avance até +{nextTask.points} pontos.</Text><Text style={styles.raceLink}>Começar atividade ›</Text></Pressable> : weekly.tasks.length > 0 && <View style={styles.successNotice}><Text style={styles.manageTitle}>✓ Semana completa!</Text><Text style={styles.manageCopy}>Você concluiu todas as atividades disponíveis.</Text></View>}
      <View style={styles.quickGrid}>
        <Pressable style={[styles.quickCard, styles.quizCard]} onPress={() => onNavigate('Quiz')}>
          <Text style={styles.quickIcon}>?</Text>
          <Text style={styles.quickTitle}>{homeQuiz?.title ?? 'Quiz semanal'}</Text>
          <Text style={styles.quickMeta}>{homeQuiz ? (releaseAt <= clock ? 'Já está liberado' : 'Contagem para liberação') : 'Aguardando publicação'}</Text>
          <Text style={styles.countdown}>{homeQuiz ? countdown : '--:--:--'}</Text>
        </Pressable>
        <Pressable style={[styles.quickCard, styles.raceCard]} onPress={() => onNavigate('Presença')}>
          <Text style={styles.quickIcon}>⚑</Text>
          <Text style={styles.quickTitle}>Corrida</Text>
          <Text style={styles.quickMeta}>Trimestre {currentQuarter} · semana {currentPresenceWeek}</Text>
          <Text style={styles.raceLink}>Ver trilha ›</Text>
        </Pressable>
      </View>
      {nextEvent && <View style={styles.formCard}><Pill tone="gold">PRÓXIMO ENCONTRO</Pill><Text style={styles.manageTitle}>{nextEvent.title}</Text><Text style={styles.manageCopy}>{nextEvent.dateLabel} · {nextEvent.location}</Text>{homeEventRegistrations.find(item => item.eventId === nextEvent.id)?.status === 'confirmed' && <Text style={styles.challengeStatus}>✓ Sua participação está confirmada</Text>}{homeEventRegistrations.find(item => item.eventId === nextEvent.id)?.status === 'waitlisted' && <Text style={styles.challengeStatus}>⏳ Você está na lista de espera</Text>}</View>}
    </>
  );
}

function StudyScreen({ classId, userName }: { classId: string; userName: string }) {
  const [completed, setCompleted] = useState(false);
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState<{ id: string; title?: string; lessonPdfUrl?: string; bookPdfUrl?: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [studyError, setStudyError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [studySource, setStudySource] = useState<'lesson' | 'bible' | 'book'>('lesson');
  const [biblePassage, setBiblePassage] = useState('');
  const [studyHistory, setStudyHistory] = useState<Array<{ id: string; source?: 'lesson' | 'bible' | 'book'; passage?: string; summary?: string; score?: number; evaluation?: string; revisionCount?: number; feedbackVisible?: boolean; feedback?: string; createdAt?: { toDate?: () => Date } }>>([]);
  useEffect(() => { if (classId) listWeeklyContent(classId).then(items => setContent((items[0] as { id: string; title?: string; lessonPdfUrl?: string; bookPdfUrl?: string } | undefined) ?? null)).catch(() => undefined); }, [classId]);
  useEffect(() => { if (auth?.currentUser) listMyStudyRecords(auth.currentUser.uid).then(items => { setStudyHistory(items); const reviewed = items.find(item => item.feedbackVisible); if (reviewed) setFeedback(String(reviewed.feedback ?? 'Resumo avaliado pelo diretor.')); }).catch(() => undefined); }, [completed]);
  const registerStudy = async () => {
    if (!firebaseEnabled) return setCompleted(!completed);
    if (!auth?.currentUser || !classId) return setStudyError('Aguarde a aprovação da sua entrada na classe.');
    if (studySource !== 'bible' && !content) return setStudyError('O diretor ainda não publicou o conteúdo desta semana.');
    if (studySource === 'bible' && biblePassage.trim().length < 3) return setStudyError('Informe o livro e o capítulo que você leu.');
    if (summary.trim().length < 10) return setStudyError('Escreva um resumo com pelo menos 10 caracteres.');
    setSaving(true); setStudyError('');
    try {
      await saveStudy({ userId: auth.currentUser.uid, userName, classId, contentId: content?.id ?? 'leitura-biblica-livre', source: studySource, passage: studySource === 'bible' ? biblePassage.trim() : undefined, summary: summary.trim(), feedbackVisible: false });
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
        ['lesson', '📖', 'Lição', content?.title ?? 'Aguardando publicação do diretor', content?.lessonPdfUrl ? 'Selecionar e abrir o PDF' : 'Ainda não disponível', '#F8E8C8', content?.lessonPdfUrl],
        ['bible', '✦', 'Bíblia', 'Escolha seu texto', 'Leitura livre', '#DCEDE9', ''],
        ['book', '▣', 'Livro', content?.title ?? 'Livro da semana', content?.bookPdfUrl ? 'Selecionar e abrir o PDF' : 'Ainda não disponível', '#FBE0D6', content?.bookPdfUrl],
      ].map(([source, icon, title, subtitle, meta, bg, url]) => (
        <Pressable key={source} style={[styles.studyCard, studySource === source && styles.studyCardSelected]} onPress={() => { setStudySource(source as 'lesson' | 'bible' | 'book'); setCompleted(false); if (url) Linking.openURL(url).catch(() => setStudyError('Não foi possível abrir este PDF.')); }}>
          <View style={[styles.studyIcon, { backgroundColor: bg }]}><Text style={styles.studyEmoji}>{icon}</Text></View>
          <View style={styles.flex}>
            <Text style={styles.studyLabel}>{title}</Text>
            <Text style={styles.studyTitle}>{subtitle}</Text>
            <Text style={styles.cardCaption}>{meta}</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      ))}
      {studySource === 'bible' && <AuthField label="Referência bíblica" placeholder="Ex.: João 3:16-21" value={biblePassage} onChangeText={setBiblePassage} />}
      <View style={styles.summaryCard}>
        <Text style={styles.authLabel}>Meu resumo de {studySource === 'lesson' ? 'lição' : studySource === 'bible' ? 'leitura bíblica' : 'livro'} de hoje</Text>
        <Text style={styles.privateHint}>🔒 Somente você e seu diretor podem visualizar.</Text>
        <TextInput multiline value={summary} onChangeText={setSummary} placeholder="O que mais chamou sua atenção?" placeholderTextColor="#8A9892" style={[styles.authInput, styles.summaryInput]} />
        <Text style={styles.charCount}>{summary.length}/500</Text>
      </View>
      <Pressable style={[styles.primaryButton, completed && styles.buttonDone]} disabled={saving || completed} onPress={registerStudy}>
        <Text style={styles.primaryButtonText}>{saving ? 'Salvando...' : completed ? '✓ Estudo e resumo registrados' : 'Registrar estudo de hoje'}</Text>
      </Pressable>
      {studyError !== '' && <Text style={styles.authError}>{studyError}</Text>}
      {feedback !== '' && <Text style={styles.successNotice}>✓ {feedback}</Text>}
      {studyHistory.length > 0 && <><Text style={styles.sectionTitle}>Meus estudos recentes</Text>{studyHistory.slice(0, 6).map(item => <View key={item.id} style={styles.formCard}><View style={styles.weekRow}><Text style={styles.manageTitle}>{item.source === 'lesson' ? '📖 Lição' : item.source === 'bible' ? '✦ Bíblia' : '▣ Livro'}</Text><Text style={styles.cardCaption}>{item.createdAt?.toDate?.().toLocaleDateString('pt-BR') ?? ''}</Text></View>{item.passage && <Text style={styles.challengeStatus}>{item.passage}</Text>}<Text style={styles.manageCopy} numberOfLines={2}>{item.summary}</Text>{Number(item.revisionCount ?? 0) > 0 && <Text style={styles.challengeStatus}>{item.revisionCount} revisão(ões) enviada(s)</Text>}{item.feedbackVisible && <View style={styles.successNotice}><Text style={styles.manageTitle}>Avaliação · {item.score ?? 0} pontos</Text><Text style={styles.manageCopy}>{item.feedback}</Text></View>}{item.evaluation === 'revise' && item.feedbackVisible && <Pressable style={styles.memberActionButton} onPress={() => { setStudySource(item.source ?? 'lesson'); setBiblePassage(item.passage ?? ''); setSummary(item.summary ?? ''); setCompleted(false); setStudyError(''); }}><Text style={styles.memberActionText}>✎ Corrigir e reenviar este resumo</Text></Pressable>}</View>)}</>}
    </View>
  );
}

function AttendanceScreen({ classId, userName }: { classId: string; userName: string }) {
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState('');
  const [attendanceCount, setAttendanceCount] = useState(0);
  const [currentStatus, setCurrentStatus] = useState('');
  const [attendanceReviewNote, setAttendanceReviewNote] = useState('');
  const [approvedWeeks, setApprovedWeeks] = useState<number[]>([]);
  const [attendancePhoto, setAttendancePhoto] = useState('');
  const [sendingAttendance, setSendingAttendance] = useState(false);
  const [presenceScenario, setPresenceScenario] = useState<PresenceScenario>(presenceScenarios[0]);
  const now = new Date();
  const quarter = Math.floor(now.getMonth() / 3) + 1;
  const quarterStart = new Date(now.getFullYear(), (quarter - 1) * 3, 1);
  const currentWeek = Math.min(13, Math.floor((now.getTime() - quarterStart.getTime()) / (7 * 86400000)) + 1);
  const loadAttendance = () => { if (auth?.currentUser) listMyAttendance(auth.currentUser.uid).then(items => { const periodItems = items.filter(item => item.quarter === quarter && item.year === now.getFullYear()); const weeks = periodItems.filter(item => item.status === 'approved').map(item => item.week ?? 0); const current = periodItems.find(item => item.week === currentWeek); setApprovedWeeks(weeks); setAttendanceCount(weeks.length); setCurrentStatus(current?.status ?? ''); setAttendanceReviewNote(current?.reviewNote ?? ''); }).catch(() => undefined); };
  useEffect(loadAttendance, [classId]);
  useEffect(() => { if (classId) getPresenceScenario(classId).then(result => setPresenceScenario(result.scenario)).catch(() => undefined); }, [classId]);
  const requestAttendance = async () => {
    if (!firebaseEnabled) return setSent(true);
    if (!auth?.currentUser || !classId) return setSendError('Você precisa estar em uma classe aprovada.');
    if (!attendancePhoto) return setSendError('Adicione uma foto da presença antes de enviar.');
    setSendError('');
    setSendingAttendance(true);
    try { await uploadSelectedAttendancePhoto(attendancePhoto, currentWeek, quarter, now.getFullYear(), userName); setSent(true); setCurrentStatus('pending'); }
    catch (error) { setSendError(error instanceof Error ? error.message : 'Não foi possível solicitar a presença.'); }
    finally { setSendingAttendance(false); }
  };
  return (
    <View style={styles.pagePad}>
      <Text style={styles.pageEyebrow}>TRIMESTRE {quarter} · SEMANA {currentWeek}</Text>
      <Text style={styles.pageTitle}>{presenceScenario.icon} {presenceScenario.name}</Text>
      <Text style={styles.pageIntro}>{presenceScenario.intro}</Text>
      <View style={[styles.mountainCard, { backgroundColor: presenceScenario.color }]}>
        <View style={[styles.summit, { backgroundColor: presenceScenario.accent }]}><Text style={[styles.summitText, { color: colors.white }]}>{presenceScenario.icon} {presenceScenario.goal}</Text></View>
        <View style={[styles.trail, { backgroundColor: presenceScenario.accent, opacity: 0.35 }]} />
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
      {currentStatus !== 'approved' && currentStatus !== 'pending' && <Pressable style={styles.uploadBox} onPress={async () => { try { const uri = await selectAttendancePhoto(); if (uri) { setAttendancePhoto(uri); setSendError(''); } } catch (error) { setSendError(error instanceof Error ? error.message : 'Não foi possível selecionar a foto.'); } }}>{attendancePhoto ? <Image source={{ uri: attendancePhoto }} style={styles.attendancePreview} /> : <><Text style={styles.uploadIcon}>＋</Text><Text style={styles.uploadTitle}>Adicionar foto da presença</Text><Text style={styles.uploadCopy}>Você poderá conferir antes de enviar</Text></>}</Pressable>}
      <Pressable style={[styles.primaryButton, (sent || currentStatus === 'pending' || currentStatus === 'approved') && styles.buttonDone, sendingAttendance && styles.buttonDisabled]} disabled={sendingAttendance || currentStatus === 'pending' || currentStatus === 'approved'} onPress={requestAttendance}><Text style={styles.primaryButtonText}>{sendingAttendance ? 'Enviando foto...' : currentStatus === 'approved' ? '✓ Presença confirmada' : sent || currentStatus === 'pending' ? '✓ Aguardando confirmação' : 'Enviar foto para confirmação'}</Text></Pressable>
      {(sent || currentStatus === 'pending') && <Text style={styles.pendingHint}>Seu diretor recebeu a solicitação e confirmará sua presença.</Text>}
      {currentStatus === 'rejected' && <View style={styles.warningCard}><Text style={styles.manageTitle}>Envie uma nova foto</Text><Text style={styles.manageCopy}>{attendanceReviewNote || 'A presença não foi confirmada. Confira a foto e tente novamente.'}</Text></View>}
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
  useEffect(() => { if (!quiz?.id || quizStatus === 'pending' || quizStatus === 'reviewed') return; return subscribeToQuizAvailability(quiz.id, available => { if (!available) { setQuiz(null); setQuizError('O diretor encerrou este quiz. As respostas não podem mais ser enviadas.'); } }); }, [quiz?.id, quizStatus]);
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

function ProfileScreen({ name, className, classId, districtId, ageGroup, initialStatus, initialThemeColor, onExit }: { name: string; className: string; classId: string; districtId: string; ageGroup: string; initialStatus: string; initialThemeColor: string; onExit: () => Promise<void> }) {
  const [communityView, setCommunityView] = useState<'hub' | 'ranking' | 'mural' | 'flashcards' | 'desafios' | 'hall' | 'notificacoes' | 'eventos' | 'colegas' | 'atividades' | 'configuracoes'>('hub');
  const [events, setEvents] = useState<DistrictEvent[]>([]);
  const [eventRegistrations, setEventRegistrations] = useState<MyEventRegistration[]>([]);
  const [completedEvents, setCompletedEvents] = useState<CompletedEvent[]>([]);
  const [eventRatings, setEventRatings] = useState<Record<string, number>>({});
  const [eventComments, setEventComments] = useState<Record<string, string>>({});
  const [rankingHistory, setRankingHistory] = useState<Array<{ id: string; weekLabel?: string; entries?: Array<{ userId: string; name: string; score: number; position: number }> }>>([]);
  const [rankingMode, setRankingMode] = useState<'class' | 'districtPeople' | 'districtClasses'>('class');
  const [districtRankings, setDistrictRankings] = useState<DistrictRankings>({ individuals: [], classes: [] });
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
  const [joinedActivities, setJoinedActivities] = useState<Array<{ activityId: string; status: string }>>([]);
  const [studentSettings, setStudentSettings] = useState<LeadershipSettings | null>(null);
  const [deletionCountdown, setDeletionCountdown] = useState(-1);
  const [deletionReason, setDeletionReason] = useState('');
  const [deletionPending, setDeletionPending] = useState(false);
  useEffect(() => { if (initialStatus) setPublicStatus(initialStatus); }, [initialStatus]);
  useEffect(() => { if (initialThemeColor) setProfileColor(initialThemeColor); }, [initialThemeColor]);
  useEffect(() => { if (districtId) listDistrictEvents(districtId).then(setEvents).catch(() => undefined); }, [districtId]);
  useEffect(() => { listMyEventRegistrations().then(setEventRegistrations).catch(() => undefined); }, []);
  useEffect(() => { if (districtId) listMyCompletedEvents(districtId).then(items => { setCompletedEvents(items); setEventRatings(Object.fromEntries(items.filter(item => item.myRating).map(item => [item.id, Number(item.myRating)]))); setEventComments(Object.fromEntries(items.filter(item => item.myComment).map(item => [item.id, String(item.myComment)]))); }).catch(() => undefined); }, [districtId]);
  useEffect(() => { if (classId) listQuizRankingHistory(classId).then(setRankingHistory).catch(() => undefined); }, [classId]);
  useEffect(() => { if (classId) getDistrictRankings(classId).then(setDistrictRankings).catch(() => undefined); }, [classId]);
  useEffect(() => { if (classId) listPeriodClosures(classId).then(setPeriodHistory).catch(() => undefined); }, [classId]);
  useEffect(() => { if (classId) listPublishedFlashcards(classId).then(setFlashcards).catch(() => undefined); }, [classId]);
  useEffect(() => { if (classId) listClassProfiles(classId).then(setClassProfiles).catch(() => undefined); }, [classId]);
  useEffect(() => { if (classId) listMuralPosts(classId).then(setMuralPosts).catch(() => undefined); }, [classId]);
  useEffect(() => { if (classId) listApprovedChallenges(classId).then(setClassChallenges).catch(() => undefined); }, [classId]);
  useEffect(() => { if (classId) listClassActivities(classId).then(setClassActivities).catch(() => undefined); }, [classId]);
  useEffect(() => { listMyActivityRegistrations().then(setJoinedActivities).catch(() => undefined); }, []);
  useEffect(() => { if (communityView === 'configuracoes' && !studentSettings) { getLeadershipSettings().then(setStudentSettings).catch(() => setProfileNotice('Não foi possível abrir as configurações.')); getAccountDeletionRequest().then(item => setDeletionPending(item?.status === 'pending')).catch(() => undefined); } }, [communityView, studentSettings]);
  useEffect(() => { if (deletionCountdown <= 0) return; const timer = setTimeout(() => setDeletionCountdown(value => value - 1), 1000); return () => clearTimeout(timer); }, [deletionCountdown]);
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
      configuracoes: { title: 'Configurações', eyebrow: 'CONTA E PRIVACIDADE', copy: 'Controle seus avisos e conheça como seus dados são protegidos.' },
    }[communityView];
    return (
      <View style={styles.pagePad}>
        <BackButton onPress={() => setCommunityView('hub')} />
        <Text style={styles.pageEyebrow}>{content.eyebrow}</Text><Text style={styles.pageTitle}>{content.title}</Text><Text style={styles.pageIntro}>{content.copy}</Text>
        {communityView === 'ranking' && <>
          <View style={styles.rankingTabs}><Pressable onPress={() => setRankingMode('class')}><Text style={rankingMode === 'class' ? styles.rankingTabActive : styles.rankingTab}>Base</Text></Pressable><Pressable onPress={() => setRankingMode('districtPeople')}><Text style={rankingMode === 'districtPeople' ? styles.rankingTabActive : styles.rankingTab}>Distrito</Text></Pressable><Pressable onPress={() => setRankingMode('districtClasses')}><Text style={rankingMode === 'districtClasses' ? styles.rankingTabActive : styles.rankingTab}>Bases</Text></Pressable></View>
          {rankingMode === 'class' && <>{rankingHistory.length === 0 && <Text style={styles.pageIntro}>O diretor ainda não publicou o ranking semanal.</Text>}{rankingHistory.slice(0, 1).map(week => <View key={week.id} style={styles.formCard}><Text style={styles.sectionTitle}>{week.weekLabel ?? 'Semana atual'}</Text>{week.entries?.map(entry => <View key={entry.userId} style={styles.rankRow}><Text style={styles.rankPlace}>{entry.position}</Text><View style={styles.rankAvatar}><Text style={styles.rankAvatarText}>{entry.name[0]}</Text></View><Text style={styles.rankName}>{entry.name}</Text><Text style={styles.rankPoints}>{entry.score} pts</Text></View>)}</View>)}</>}
          {rankingMode === 'districtPeople' && <>{districtRankings.individuals.length === 0 && <Text style={styles.pageIntro}>Os resultados distritais aparecerão após as bases publicarem seus rankings.</Text>}{districtRankings.individuals.slice(0, 30).map(entry => <View key={entry.id} style={styles.rankRow}><Text style={styles.rankPlace}>{entry.position}</Text><View style={styles.rankAvatar}><Text style={styles.rankAvatarText}>{entry.name[0]}</Text></View><Text style={styles.rankName}>{entry.name}</Text><Text style={styles.rankPoints}>{entry.points} pts</Text></View>)}</>}
          {rankingMode === 'districtClasses' && <><View style={styles.fairRankHint}><Text style={styles.manageCopy}>Pontuação justa: total publicado ÷ adolescentes ativos.</Text></View>{districtRankings.classes.length === 0 && <Text style={styles.pageIntro}>Ainda não há bases classificadas neste trimestre.</Text>}{districtRankings.classes.map(entry => <View key={entry.id} style={styles.rankRow}><Text style={styles.rankPlace}>{entry.position}</Text><View style={styles.rankAvatar}><Text style={styles.rankAvatarText}>{entry.name[0]}</Text></View><Text style={styles.rankName}>{entry.name}</Text><Text style={styles.rankPoints}>{entry.points} média</Text></View>)}</>}
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
        {communityView === 'notificacoes' && <>{live.notifications.length === 0 && <Text style={styles.pageIntro}>Você não possui notificações no momento.</Text>}{live.notifications.map(item => <Pressable key={item.id} onPress={() => !item.read && markNotificationRead(item.id)} style={[styles.notificationCard, !item.read && styles.notificationUnread]}><Text style={styles.notificationTag}>{item.type.toUpperCase()}</Text><View style={styles.flex}><Text style={styles.manageTitle}>{item.title}</Text><Text style={styles.manageCopy}>{item.body}</Text>{!item.read && <Text style={styles.notificationReadHint}>Toque para marcar como lida</Text>}</View>{!item.read && <View style={styles.unreadDot} />}</Pressable>)}</>}
        {communityView === 'eventos' && <>
          {events.length === 0 && <Text style={styles.pageIntro}>Nenhum encontro publicado para seu distrito.</Text>}
          {events.map(event => { const registration = eventRegistrations.find(item => item.eventId === event.id); const registered = Boolean(registration); return <View key={event.id} style={styles.formCard}><Text style={styles.manageTitle}>{event.title}</Text><Text style={styles.manageCopy}>{event.dateLabel} · {event.location}</Text>{event.description && <Text style={styles.manageCopy}>{event.description}</Text>}{Number(event.capacity ?? 0) > 0 && <Text style={styles.challengeStatus}>Limite de {event.capacity} participantes</Text>}{registration?.status === 'waitlisted' && <Text style={styles.challengeStatus}>⏳ Lista de espera · posição {registration.position}</Text>}{registration?.checkedIn && <Text style={styles.challengeStatus}>✓ Presença registrada no encontro</Text>}<Pressable style={[styles.approveButton, registered && styles.approveButtonDone]} onPress={async () => { try { if (registered) { await cancelEventAttendance(event); setEventRegistrations(items => items.filter(item => item.eventId !== event.id)); setProfileNotice('Participação cancelada'); } else { const result = await confirmEventAttendance(event); setEventRegistrations(items => [...items, result]); setProfileNotice(result.status === 'waitlisted' ? `Você entrou na lista de espera, na posição ${result.position}.` : 'Participação confirmada'); } } catch (error) { setProfileNotice(error instanceof Error ? error.message : 'Não foi possível alterar sua participação.'); } }}><Text style={[styles.approveButtonText, registered && styles.approveButtonTextDone]}>{registration?.status === 'waitlisted' ? 'Sair da lista de espera' : registered ? '✓ Confirmado · toque para cancelar' : 'Confirmar participação'}</Text></Pressable></View>; })}
          {completedEvents.length > 0 && <Text style={styles.sectionTitle}>Encontros que participei</Text>}
          {completedEvents.map(event => <View key={`completed_${event.id}`} style={styles.formCard}><Pill tone="teal">CONCLUÍDO</Pill><Text style={styles.manageTitle}>{event.title}</Text><Text style={styles.manageCopy}>{event.dateLabel} · {event.location}</Text><Text style={styles.challengeStatus}>{event.myCheckedIn ? '✓ Sua presença foi registrada' : 'Inscrição confirmada · presença não registrada'}</Text><Text style={styles.manageTitle}>Como foi o encontro?</Text><View style={styles.scopeWrap}>{[1, 2, 3, 4, 5].map(rating => <Pressable key={rating} onPress={() => setEventRatings(current => ({ ...current, [event.id]: rating }))}><Text style={{ fontSize: 28 }}>{rating <= (eventRatings[event.id] ?? 0) ? '★' : '☆'}</Text></Pressable>)}</View><TextInput multiline value={eventComments[event.id] ?? ''} onChangeText={text => setEventComments(current => ({ ...current, [event.id]: text }))} placeholder="Conte o que você mais gostou" placeholderTextColor="#8A9892" style={[styles.authInput, styles.textArea]} /><Pressable disabled={!eventRatings[event.id]} style={[styles.memberActionButton, !eventRatings[event.id] && styles.buttonDisabled]} onPress={async () => { try { await submitEventFeedback(event, eventRatings[event.id], eventComments[event.id] ?? ''); setProfileNotice('Obrigado! Sua avaliação foi salva.'); } catch (error) { setProfileNotice(error instanceof Error ? error.message : 'Não foi possível salvar sua avaliação.'); } }}><Text style={styles.memberActionText}>{event.myRating ? 'Atualizar avaliação' : 'Enviar avaliação'}</Text></Pressable></View>)}
          {profileNotice !== '' && <Text style={styles.successNotice}>{profileNotice}</Text>}
        </>}
        {communityView === 'configuracoes' && <>{!studentSettings && <ActivityIndicator color={colors.tealMedium} />}{studentSettings && <><Text style={styles.sectionTitle}>Preferências de avisos</Text>{([['quizReminders', 'Quiz e resultados'], ['attendanceReminders', 'Presenças e revisões'], ['eventReminders', 'Encontros e atividades']] as const).map(([key, label]) => <Pressable key={key} style={styles.memberRow} onPress={() => setStudentSettings(current => current ? { ...current, [key]: !current[key] } : current)}><Text style={styles.manageTitle}>{label}</Text><Pill tone={studentSettings[key] ? 'teal' : 'coral'}>{studentSettings[key] ? 'ATIVO' : 'PAUSADO'}</Pill></Pressable>)}<View style={styles.formCard}><Text style={styles.sectionTitle}>Horário silencioso</Text><Text style={styles.manageCopy}>Escolha o período em que você prefere não receber alertas.</Text><AuthField label="Início" placeholder="22:00" value={studentSettings.quietStart} onChangeText={quietStart => setStudentSettings(current => current ? { ...current, quietStart } : current)} /><AuthField label="Fim" placeholder="07:00" value={studentSettings.quietEnd} onChangeText={quietEnd => setStudentSettings(current => current ? { ...current, quietEnd } : current)} /><Pressable style={styles.authPrimary} onPress={async () => { try { await saveLeadershipSettings(studentSettings); setProfileNotice('Preferências salvas'); } catch (error) { setProfileNotice(error instanceof Error ? error.message : 'Não foi possível salvar.'); } }}><Text style={styles.authPrimaryText}>Salvar preferências</Text></Pressable></View><View style={styles.formCard}><Text style={styles.sectionTitle}>Senha</Text><Text style={styles.manageCopy}>{studentSettings.email}</Text><Pressable style={styles.memberActionButton} onPress={async () => { try { await resetUserPassword(studentSettings.email); setProfileNotice('Link para troca de senha enviado ao seu e-mail.'); } catch (error) { setProfileNotice(error instanceof Error ? error.message : 'Não foi possível enviar o link.'); } }}><Text style={styles.memberActionText}>Enviar link para trocar senha</Text></Pressable></View><View style={styles.formCard}><Text style={styles.sectionTitle}>Sua privacidade</Text><Text style={styles.manageCopy}>Seus resumos e avaliações são privados entre você e a liderança responsável. Outros adolescentes veem apenas seu nome, frase, cor do perfil e resultados publicados nos rankings.</Text><Text style={styles.manageCopy}>Não existe conversa privada entre adolescentes dentro do aplicativo.</Text></View><View style={styles.warningCard}><Text style={styles.manageTitle}>Exclusão da conta</Text>{deletionPending ? <Text style={styles.manageCopy}>Sua solicitação está pendente. O administrador fará a conferência antes da remoção definitiva dos dados.</Text> : <><Text style={styles.manageCopy}>A exclusão não acontece imediatamente. Primeiro será criada uma solicitação para análise segura.</Text><TextInput multiline value={deletionReason} onChangeText={setDeletionReason} placeholder="Motivo opcional" placeholderTextColor="#8A9892" style={[styles.authInput, styles.textArea]} />{deletionCountdown < 0 ? <Pressable style={styles.memberDangerButton} onPress={() => setDeletionCountdown(10)}><Text style={styles.memberDangerText}>Solicitar exclusão da conta</Text></Pressable> : deletionCountdown > 0 ? <Pressable disabled style={[styles.memberDangerButton, styles.buttonDisabled]}><Text style={styles.memberDangerText}>Aguarde {deletionCountdown} segundos</Text></Pressable> : <><Text style={styles.authError}>Confirme somente se realmente deseja solicitar a exclusão.</Text><View style={styles.memberActions}><Pressable style={styles.memberDangerButton} onPress={async () => { try { await requestAccountDeletion(deletionReason); setDeletionPending(true); setDeletionCountdown(-1); setProfileNotice('Solicitação de exclusão enviada com segurança.'); } catch (error) { setProfileNotice(error instanceof Error ? error.message : 'Não foi possível enviar a solicitação.'); } }}><Text style={styles.memberDangerText}>Confirmar solicitação</Text></Pressable><Pressable style={styles.memberActionButton} onPress={() => setDeletionCountdown(-1)}><Text style={styles.memberActionText}>Cancelar</Text></Pressable></View></>}</>}</View></>}{profileNotice !== '' && <Text style={styles.successNotice}>{profileNotice}</Text>}</>}
        {communityView === 'colegas' && <>{classProfiles.length === 0 && <Text style={styles.pageIntro}>Os perfis dos colegas aparecerão quando a entrada deles na turma for aprovada.</Text>}{classProfiles.map(profile => <View key={profile.id} style={styles.profilePeerCard}><View style={[styles.rankAvatar, { backgroundColor: profile.themeColor ?? colors.gold }]}><Text style={styles.rankAvatarText}>{profile.name[0]?.toUpperCase()}</Text></View><View style={styles.flex}><Text style={styles.manageTitle}>{profile.name}</Text><Text style={styles.manageCopy}>“{profile.status || 'Caminhando com propósito.'}”</Text></View></View>)}</>}
        {communityView === 'atividades' && <>{classActivities.length === 0 && <Text style={styles.pageIntro}>Nenhuma atividade externa foi publicada para sua base.</Text>}{classActivities.map(activity => { const registration = joinedActivities.find(item => item.activityId === activity.id); return <View key={activity.id} style={styles.formCard}><Pill tone="teal">ATIVIDADE DA BASE</Pill><Text style={styles.challengeTitle}>{activity.title}</Text><Text style={styles.challengeCopy}>{activity.description}</Text><Text style={styles.manageCopy}>{activity.dateLabel} · {activity.location}</Text><Text style={styles.challengePoints}>+{activity.points} pontos após a presença ser confirmada</Text>{registration?.status === 'attended' ? <Text style={styles.successNotice}>✓ Presença confirmada · pontos liberados</Text> : registration ? <><Text style={styles.challengeStatus}>Inscrição realizada · aguardando a atividade</Text><Pressable style={styles.memberDangerButton} onPress={async () => { await cancelClassActivityRegistration(activity.id); setJoinedActivities(items => items.filter(item => item.activityId !== activity.id)); }}><Text style={styles.memberDangerText}>Cancelar minha inscrição</Text></Pressable></> : <Pressable style={styles.authPrimary} onPress={async () => { await joinClassActivity(activity, name); setJoinedActivities(items => [...items, { activityId: activity.id, status: 'registered' }]); }}><Text style={styles.authPrimaryText}>Eu vou participar</Text></Pressable>}</View>; })}</>}
      </View>
    );
  }
  return (
    <View style={styles.pagePad}>
      <View style={styles.profileTop}>
        <View style={[styles.profileAvatar, { backgroundColor: profileColor }]}><Text style={styles.profileAvatarText}>{name[0]?.toUpperCase() ?? 'A'}</Text></View>
        <Text style={styles.profileName}>{name}</Text>
        <Text style={styles.profileClass}>{className} · {ageGroup === 'pre-adolescentes' ? 'Pré-adolescentes' : 'Adolescentes'}</Text>
        <Text style={styles.profileStatus}>“{publicStatus}”</Text>
      </View>
      <View style={styles.formCard}><Text style={styles.sectionTitle}>Personalize seu perfil</Text><AuthField label="Frase de status" placeholder="Uma frase curta sobre você" value={publicStatus} onChangeText={setPublicStatus} /><Text style={styles.authLabel}>Cor do perfil</Text><View style={styles.colorChoices}>{['#E7A93D', '#E8683F', '#16504D', '#7769A8', '#4E88A8'].map(color => <Pressable key={color} onPress={() => setProfileColor(color)} style={[styles.colorChoice, { backgroundColor: color }, profileColor === color && styles.colorChoiceActive]} />)}</View><Pressable style={styles.approveButton} onPress={savePublicProfile}><Text style={styles.approveButtonText}>Salvar meu perfil</Text></Pressable>{profileNotice !== '' && <Text style={styles.manageCopy}>{profileNotice}</Text>}</View>
      <View style={styles.statsRow}>
        <View style={styles.stat}><Text style={styles.statValue}>{progress.points}</Text><Text style={styles.cardCaption}>pontos</Text></View>
        <View style={styles.stat}><Text style={styles.statValue}>{progress.summaries}</Text><Text style={styles.cardCaption}>resumos</Text></View>
        <View style={styles.stat}><Text style={styles.statValue}>{progress.streak}</Text><Text style={styles.cardCaption}>semanas seguidas</Text></View>
      </View>
      <View style={styles.formCard}><Text style={styles.sectionTitle}>Minha jornada de estudos</Text><View style={styles.reportMiniGrid}><Text style={styles.reportMiniItem}>📖 {progress.lessonStudies} lições aprovadas</Text><Text style={styles.reportMiniItem}>✦ {progress.bibleStudies} leituras bíblicas</Text><Text style={styles.reportMiniItem}>▣ {progress.bookStudies} leituras de livro</Text><Text style={styles.reportMiniItem}>⭐ {progress.lessonStudies + progress.bibleStudies + progress.bookStudies} estudos pontuados</Text></View></View>
      <Text style={styles.sectionTitle}>Comunidade</Text>
      <View style={styles.communityGrid}>
        {[
          ['ranking', '🏆', 'Rankings', '#F8E8C8'], ['mural', '◉', 'Mural', '#DCEDE9'], ['colegas', '☺', 'Minha turma', '#DCE0FA'], ['flashcards', '▤', 'Flashcards', '#FFF1A8'], ['desafios', '◆', 'Desafios', '#FBE0D6'], ['atividades', '⚑', 'Atividades', '#CFEDE5'], ['eventos', '◉', 'Encontros', '#F8E8C8'], ['hall', '★', 'Hall da fama', '#E4E0FA'], ['notificacoes', '●', 'Notificações', '#DCEDE9'], ['configuracoes', '⚙', 'Configurações', '#E8ECE8'],
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
            <Pill tone="teal">{student.ageGroup === 'pre-adolescentes' ? 'PRÉ-ADOLESCENTES' : 'ADOLESCENTES'}</Pill>
          </View>
        )}
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {tab === 'Início' && <HomeScreen onNavigate={setTab} name={student.name} pending={student.pending} classId={student.classId} districtId={student.districtId} />}
          {tab === 'Estudo' && <StudyScreen classId={student.classId} userName={student.name} />}
          {tab === 'Presença' && <AttendanceScreen classId={student.classId} userName={student.name} />}
          {tab === 'Quiz' && <QuizScreen classId={student.classId} />}
          {tab === 'Mais' && <ProfileScreen name={student.name} className={student.className} classId={student.classId} districtId={student.districtId} ageGroup={student.ageGroup} initialStatus={student.status} initialThemeColor={student.themeColor} onExit={onExit} />}
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
  const [foundClass, setFoundClass] = useState<{ className: string; churchName: string; ageGroup: string } | null>(null);
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
      if (selectedRole === 'adolescente' && invite.trim() && inviteState !== 'valid') throw new Error('Verifique o código da base antes de criar a conta.');
      const user = await registerUser(name, email, password, mapRole(selectedRole), { districtId: selectedDistrict || undefined, classId: selectedClass || undefined, inviteCode: selectedRole === 'coordenador' ? invite : undefined });
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

  const validateInvite = async () => {
    setAuthBusy(true); setAuthError(''); setFoundClass(null);
    try { const result = await validateClassInviteCode(invite); setFoundClass(result); setInviteState('valid'); }
    catch (error) { setInviteState('idle'); setAuthError(error instanceof Error ? error.message : 'Código inválido ou expirado.'); }
    finally { setAuthBusy(false); }
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
          {role === 'diretor' && <View style={styles.scopeSection}>
            <Text style={styles.authLabel}>Distrito desejado</Text>
            <View style={styles.scopeWrap}>{(registrationOptions.districts.length ? registrationOptions.districts : [{ id: 'salvador-centro', name: 'Salvador Centro' }]).map(item => <Pressable key={item.id} style={[styles.scopeChip, selectedDistrict === item.id && styles.scopeChipActive]} onPress={() => { setSelectedDistrict(item.id); setSelectedClass(''); }}><Text style={[styles.scopeChipText, selectedDistrict === item.id && styles.scopeChipTextActive]}>{item.name}</Text></Pressable>)}</View>
            {role === 'diretor' && <><Text style={[styles.authLabel, { marginTop: 13 }]}>Classe desejada</Text><View style={styles.scopeWrap}>{(registrationOptions.classes.filter(item => item.districtId === selectedDistrict).length ? registrationOptions.classes.filter(item => item.districtId === selectedDistrict) : [{ id: 'base-geracao', name: 'Base Geração', districtId: selectedDistrict, churchId: '', ageGroup: 'adolescentes' }]).map(item => <Pressable key={item.id} style={[styles.scopeChip, selectedClass === item.id && styles.scopeChipActive]} onPress={() => setSelectedClass(item.id)}><Text style={[styles.scopeChipText, selectedClass === item.id && styles.scopeChipTextActive]}>{item.name}</Text></Pressable>)}</View></>}
          </View>}
          {role === 'coordenador' && <View style={styles.scopeSection}><Text style={styles.authLabel}>Código de convite do administrador</Text><AuthField label="Convite" placeholder="Ex.: COORD-ABCD-1234" value={invite} onChangeText={text => setInvite(text.toUpperCase())} /><Text style={styles.manageCopy}>O convite já identifica automaticamente o seu distrito.</Text></View>}
          <Pressable
            style={[styles.authPrimary, firebaseEnabled && ((role === 'diretor' && (!selectedDistrict || !selectedClass)) || (role === 'coordenador' && invite.trim().length < 10)) && styles.buttonDisabled]}
            disabled={authBusy || (firebaseEnabled && ((role === 'diretor' && (!selectedDistrict || !selectedClass)) || (role === 'coordenador' && invite.trim().length < 10)))}
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
            <AuthField label="Código da classe" placeholder="Ex.: VIVA-AB12CD34" value={invite} onChangeText={(text) => { setInvite(text.toUpperCase()); setInviteState('idle'); setFoundClass(null); setAuthError(''); }} />
            {inviteState === 'valid' && foundClass && (
              <View style={styles.classFound}>
                <View style={styles.classFoundIcon}><Text>✓</Text></View>
                <View><Text style={styles.classFoundTitle}>{foundClass.className}</Text><Text style={styles.classFoundCopy}>{foundClass.churchName} · {foundClass.ageGroup === 'pre-adolescentes' ? 'Pré-adolescentes' : 'Adolescentes'}</Text></View>
              </View>
            )}
            {inviteState === 'idle' ? (
              <Pressable style={[styles.authPrimary, (invite.length < 5 || authBusy) && styles.buttonDisabled]} disabled={invite.length < 5 || authBusy} onPress={validateInvite}><Text style={styles.authPrimaryText}>{authBusy ? 'Verificando...' : 'Verificar código'}</Text></Pressable>
            ) : (
              <Pressable style={styles.authPrimary} disabled={authBusy} onPress={() => finishRegistration('adolescente')}><Text style={styles.authPrimaryText}>{authBusy ? 'Criando conta...' : `Solicitar entrada em ${foundClass?.className ?? 'minha base'}`}</Text></Pressable>
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

function PeriodClosurePanel({ selectedClassId }: { selectedClassId?: string }) {
  const [armedKind, setArmedKind] = useState<PeriodKind | null>(null);
  const [seconds, setSeconds] = useState(10);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<PeriodClosure | null>(null);
  const [history, setHistory] = useState<PeriodClosure[]>([]);
  useEffect(() => { listPeriodClosures(selectedClassId).then(setHistory).catch(() => undefined); }, [selectedClassId]);
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
    try { const closure = await closeCurrentPeriod(armedKind, selectedClassId); setResult(closure); setHistory(await listPeriodClosures(selectedClassId)); setArmedKind(null); }
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

function ManagementDetail({ title, role, selectedClassId, onBack }: { title: string; role: Exclude<Role, 'adolescente'>; selectedClassId?: string; onBack: () => void }) {
  const [saved, setSaved] = useState(false);
  const [lessonTitle, setLessonTitle] = useState('Escolhas que transformam');
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestionDraft[]>(quizQuestionTemplates);
  const [quizTitle, setQuizTitle] = useState('Jornada bíblica semanal');
  const [quizReleaseMode, setQuizReleaseMode] = useState<'now' | 'saturday'>('saturday');
  const [quizDurationDays, setQuizDurationDays] = useState(7);
  const [managedQuizzes, setManagedQuizzes] = useState<ManagedQuiz[]>([]);
  const [quizToEnd, setQuizToEnd] = useState('');
  const [approved, setApproved] = useState<string[]>([]);
  const [studyEvaluations, setStudyEvaluations] = useState<Record<string, 'excellent' | 'good' | 'revise'>>({});
  const [studyFeedbacks, setStudyFeedbacks] = useState<Record<string, string>>({});
  const [attendanceNotes, setAttendanceNotes] = useState<Record<string, string>>({});
  const [attendanceProgress, setAttendanceProgress] = useState<AttendanceProgress | null>(null);
  const [memberNotice, setMemberNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const [lessonPdf, setLessonPdf] = useState<{ name: string; url: string } | null>(null);
  const [bookPdf, setBookPdf] = useState<{ name: string; url: string } | null>(null);
  const [contentWeek, setContentWeek] = useState(Math.min(13, Math.max(1, Math.ceil((new Date().getDate() + new Date().getDay()) / 7))));
  const [contentQuarter, setContentQuarter] = useState(Math.floor(new Date().getMonth() / 3) + 1);
  const [managedContent, setManagedContent] = useState<ManagedContent[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [districtName, setDistrictName] = useState('Central');
  const [churchName, setChurchName] = useState('Alto do Guarani');
  const [className, setClassName] = useState('Base Cordilheira');
  const [structureAgeGroup, setStructureAgeGroup] = useState<'adolescentes' | 'pre-adolescentes'>('adolescentes');
  const [structureBusy, setStructureBusy] = useState(false);
  const [eventLocation, setEventLocation] = useState('Alto do Guarani');
  const [eventDate, setEventDate] = useState('16 de agosto · 15h');
  const [eventDescription, setEventDescription] = useState('Um encontro especial para fortalecer a amizade e a fé.');
  const [eventCapacity, setEventCapacity] = useState('0');
  const [editingEventId, setEditingEventId] = useState('');
  const [eventToCancel, setEventToCancel] = useState('');
  const [districtEvents, setDistrictEvents] = useState<DistrictEvent[]>([]);
  const [eventFeedback, setEventFeedback] = useState<EventFeedback[]>([]);
  const [structures, setStructures] = useState<StructureItem[]>([]);
  const [challengeDescription, setChallengeDescription] = useState('Uma ação que envolva toda a base e ajude a comunidade.');
  const [challengeEvidence, setChallengeEvidence] = useState('Descreva aqui o que a turma realizou.');
  const [challengePoints, setChallengePoints] = useState('100');
  const [activityDescription, setActivityDescription] = useState('Uma programação especial para fortalecer a amizade e a fé da nossa base.');
  const [activityPoints, setActivityPoints] = useState('20');
  const [directedActivities, setDirectedActivities] = useState<ClassActivity[]>([]);
  const [editingActivityId, setEditingActivityId] = useState('');
  const [selectedScenario, setSelectedScenario] = useState('auto');
  const [scenarioPreviewIndex, setScenarioPreviewIndex] = useState(0);
  const [engagementMembers, setEngagementMembers] = useState<EngagementMember[]>([]);
  const [engagementClassId, setEngagementClassId] = useState('');
  const [riskFilter, setRiskFilter] = useState<'all' | 'high' | 'medium' | 'regular'>('all');
  const [leadershipReport, setLeadershipReport] = useState<LeadershipReport | null>(null);
  const [coordinatorInvites, setCoordinatorInvites] = useState<CoordinatorInvite[]>([]);
  const [coordinatorAccounts, setCoordinatorAccounts] = useState<CoordinatorAccount[]>([]);
  const [coordinatorAudit, setCoordinatorAudit] = useState<CoordinatorAuditItem[]>([]);
  const [coordinatorTransfers, setCoordinatorTransfers] = useState<Record<string, string>>({});
  const [coordinatorDistrictId, setCoordinatorDistrictId] = useState('');
  const toggleApproval = (name: string) => setApproved(items => items.includes(name) ? items.filter(item => item !== name) : [...items, name]);
  const isApproval = title.includes('Aprovar') || title.includes('Avaliar') || title.includes('Validar') || title.includes('Corrigir') || title.includes('Moderar');
  const isContent = title.includes('Conteúdo');
  const isQuiz = title.includes('Quiz');
  const isReport = title.includes('Relatório');
  const isEvent = title.includes('Encontros');
  const isCoordinatorInvites = title === 'Gerenciar coordenadores';
  const isStructure = !isCoordinatorInvites && (title.includes('Classes') || title.includes('Distritos') || title.includes('Igrejas'));
  const isRisk = title.includes('Acompanhamento');
  const isMembers = title.includes('membros');
  const isQuizRanking = title.includes('ranking semanal');
  const isPeriodClosure = title.includes('Encerrar período');
  const isChallengeCreation = title === 'Desafio mensal';
  const isClassActivity = title === 'Atividades externas';
  const isPresenceTheme = title === 'Tema da presença';
  const isLeadershipHistory = title === 'Histórico de lideranças';
  const isAttendanceApproval = title.includes('presenças') || title.includes('Presenças');
  const leadershipHistory = useLeadershipHistory(isLeadershipHistory);
  useEffect(() => { if (isEvent) { listCurrentDistrictEvents().then(setDistrictEvents).catch(() => undefined); listDistrictEventFeedback().then(setEventFeedback).catch(() => undefined); } }, [isEvent]);
  useEffect(() => { if (isAttendanceApproval) getAttendanceProgress(selectedClassId).then(setAttendanceProgress).catch(() => undefined); }, [isAttendanceApproval, selectedClassId]);
  useEffect(() => { if (isContent) listManagedContent(selectedClassId).then(setManagedContent).catch(() => undefined); }, [isContent, selectedClassId]);
  useEffect(() => { if (isQuiz) listManagedQuizzes(selectedClassId).then(setManagedQuizzes).catch(() => undefined); }, [isQuiz, selectedClassId]);
  useEffect(() => { if (!isQuiz || !selectedClassId) return; return subscribeQuizParticipation(selectedClassId, () => listManagedQuizzes(selectedClassId).then(setManagedQuizzes).catch(() => undefined)); }, [isQuiz, selectedClassId]);
  useEffect(() => { if (isStructure) listStructures().then(setStructures).catch(() => undefined); }, [isStructure]);
  useEffect(() => { if (isCoordinatorInvites) Promise.all([listStructures(), listCoordinatorInvites(), listCoordinatorAccounts(), listCoordinatorAudit()]).then(([items, invites, accounts, audit]) => { setStructures(items); setCoordinatorInvites(invites); setCoordinatorAccounts(accounts); setCoordinatorAudit(audit); setCoordinatorTransfers(Object.fromEntries(accounts.map(item => [item.id, item.districtId]))); setCoordinatorDistrictId(current => current || items.find(item => item.kind === 'district')?.id || ''); }).catch(() => undefined); }, [isCoordinatorInvites]);
  useEffect(() => { if (isClassActivity) listDirectedActivities(selectedClassId).then(setDirectedActivities).catch(() => undefined); }, [isClassActivity, selectedClassId]);
  useEffect(() => { if (isRisk) listClassEngagement(selectedClassId).then(result => { setEngagementClassId(result.classId); setEngagementMembers(result.members); }).catch(() => undefined); }, [isRisk, selectedClassId]);
  useEffect(() => { if (isReport) loadLeadershipReport().then(setLeadershipReport).catch(error => setActionError(error instanceof Error ? error.message : 'Não foi possível carregar o relatório.')); }, [isReport]);
  const approvalType: ApprovalType | null = title.includes('transferências') ? 'leadershipTransfer' : title.includes('flashcards') ? 'flashcard' : title.includes('quizzes') ? 'quizAttempt' : title.includes('resumos') ? 'studyRecord' : title.includes('entradas') ? 'classJoinRequest' : title.includes('Presenças') || title.includes('presenças') ? 'attendance' : title.includes('desafios') || title.includes('Desafios') ? 'challenge' : title.includes('diretores') || title.includes('Aprovações') ? 'roleRequest' : null;
  const liveApprovals = usePendingApprovals(approvalType, role === 'diretor' ? selectedClassId : undefined);
  const classManagement = useClassManagement(role === 'diretor' ? selectedClassId : undefined);
  useEffect(() => { if (isPresenceTheme && classManagement.classId) getPresenceScenario(classManagement.classId).then(result => { setSelectedScenario(result.setting); setScenarioPreviewIndex(Math.max(0, presenceScenarios.findIndex(item => item.id === result.scenario.id))); }).catch(() => undefined); }, [isPresenceTheme, classManagement.classId]);
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
    try { await reviewLeadershipItem(approvalType, item.id, true, approvalType === 'studyRecord' ? { evaluation: studyEvaluations[item.id] ?? 'good', feedback: studyFeedbacks[item.id] } : approvalType === 'attendance' ? { attendanceNote: attendanceNotes[item.id] } : undefined); toggleApproval(item.name); if (approvalType === 'attendance') setAttendanceProgress(await getAttendanceProgress(selectedClassId)); }
    catch (error) { setActionError(error instanceof Error ? error.message : 'Não foi possível aprovar.'); }
  };
  const rejectItem = async (item: { id: string; name: string }) => {
    if (!firebaseEnabled || !approvalType || !item.id) return;
    setActionError('');
    try { await reviewLeadershipItem(approvalType, item.id, false, approvalType === 'studyRecord' ? { evaluation: 'revise', feedback: studyFeedbacks[item.id] } : approvalType === 'attendance' ? { attendanceNote: attendanceNotes[item.id] } : undefined); setMemberNotice(`Solicitação de ${item.name} recusada`); if (approvalType === 'attendance') setAttendanceProgress(await getAttendanceProgress(selectedClassId)); }
    catch (error) { setActionError(error instanceof Error ? error.message : 'Não foi possível recusar.'); }
  };
  const runMembershipAction = async (action: 'regenerateCode' | 'removeMember' | 'transferLeadership' | 'revokeDirector') => {
    if (!firebaseEnabled) return setMemberNotice('Ação concluída no modo demonstrativo');
    if (!classManagement.classId) return setActionError('Nenhuma classe de liderança foi encontrada.');
    if ((action === 'removeMember' || action === 'transferLeadership') && !selectedMemberId) return setActionError('Selecione um membro primeiro.');
    setActionError('');
    try {
      const result = await manageClassMembership({ action, classId: classManagement.classId, targetUserId: selectedMemberId || undefined });
      setMemberNotice(result.inviteCode ? `Novo código: ${result.inviteCode}` : action === 'transferLeadership' || action === 'revokeDirector' ? 'Solicitação enviada ao coordenador' : 'Ação concluída com sucesso');
    } catch (error) { setActionError(error instanceof Error ? error.message : 'Não foi possível concluir a ação.'); }
  };
  const saveManagement = async () => {
    setActionError('');
    try {
      if (isQuiz) {
        if (!quizTitle.trim()) throw new Error('Informe um título para o quiz.');
        if (!quizQuestions.length) throw new Error('Adicione pelo menos uma fase ao quiz.');
        const invalid = quizQuestions.find(item => !item.prompt.trim() || (item.type !== 'open' && (item.options.length < 2 || item.options.some(option => !option.trim()) || typeof item.correctAnswer !== 'number' || item.correctAnswer < 0 || item.correctAnswer >= item.options.length)));
        if (invalid) throw new Error('Revise os enunciados, alternativas e gabaritos antes de publicar.');
      }
      if (firebaseEnabled && isContent) { if (!lessonPdf && !bookPdf) throw new Error('Adicione o PDF da lição, do livro ou ambos.'); await publishContent({ classId: selectedClassId, title: lessonTitle, lessonPdfUrl: lessonPdf?.url, bookPdfUrl: bookPdf?.url, week: contentWeek, quarter: contentQuarter, year: new Date().getFullYear() }); setManagedContent(await listManagedContent(selectedClassId)); setMemberNotice('Conteúdo semanal publicado'); }
      if (firebaseEnabled && isQuiz) { const releaseAt = quizReleaseMode === 'now' ? Date.now() : nextSaturdayAt(); await publishQuizContent({ classId: selectedClassId, title: quizTitle.trim(), releaseAt, closesAt: releaseAt + quizDurationDays * 24 * 60 * 60 * 1000, questions: quizQuestions }); setManagedQuizzes(await listManagedQuizzes(selectedClassId)); setMemberNotice(quizReleaseMode === 'now' ? 'Quiz publicado para a base' : 'Quiz agendado para o próximo sábado'); }
      if (firebaseEnabled && isEvent) { const input = { title: lessonTitle, description: eventDescription, location: eventLocation, dateLabel: eventDate, capacity: Number(eventCapacity) || 0 }; if (editingEventId) { await updateDistrictEvent(editingEventId, input); setMemberNotice('Encontro atualizado'); setEditingEventId(''); } else { await createDistrictEvent(input); setMemberNotice('Encontro publicado'); } setDistrictEvents(await listCurrentDistrictEvents()); }
      if (firebaseEnabled && isQuizRanking) { const result = await publishLatestQuizRanking(selectedClassId); setMemberNotice(`Ranking publicado para ${result.entries} participante(s)`); }
      if (firebaseEnabled && isChallengeCreation) { await submitClassChallenge({ classId: selectedClassId, title: lessonTitle, description: challengeDescription, evidence: challengeEvidence, bonusPoints: Number(challengePoints) || 100 }); setMemberNotice('Desafio enviado ao coordenador para validação'); }
      if (firebaseEnabled && isClassActivity) { const input = { title: lessonTitle, description: activityDescription, location: eventLocation, dateLabel: eventDate, points: Number(activityPoints) || 20 }; if (editingActivityId) { await updateClassActivity(editingActivityId, input); setEditingActivityId(''); setMemberNotice('Atividade atualizada'); } else { await createClassActivity({ classId: selectedClassId, ...input }); setMemberNotice('Atividade publicada para a sua base'); } setDirectedActivities(await listDirectedActivities(selectedClassId)); }
      if (firebaseEnabled && isPresenceTheme) { await updatePresenceScenario(selectedScenario, selectedClassId); setMemberNotice(selectedScenario === 'auto' ? 'Rotação automática ativada para a base' : 'Cenário aplicado para toda a base'); }
      setSaved(true);
    } catch (error) { setActionError(error instanceof Error ? error.message : 'Não foi possível salvar.'); }
  };
  const uploadPdf = async (kind: 'lesson' | 'book') => {
    if (!firebaseEnabled) { const file = { name: kind === 'lesson' ? 'licao-demonstrativa.pdf' : 'livro-demonstrativo.pdf', url: 'demo' }; return kind === 'lesson' ? setLessonPdf(file) : setBookPdf(file); }
    setActionError('');
    try { const file = await selectAndUploadContentPdf(); if (file) kind === 'lesson' ? setLessonPdf(file) : setBookPdf(file); }
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
        ? await createCoordinatorStructure({ churchName, className, ageGroup: structureAgeGroup })
        : await createInitialStructure({ districtName, churchName, className, ageGroup: structureAgeGroup });
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
        <View style={styles.scopeSection}><Text style={styles.authLabel}>Trimestre</Text><View style={styles.scopeWrap}>{[1, 2, 3, 4].map(quarter => <Pressable key={quarter} style={[styles.scopeChip, contentQuarter === quarter && styles.scopeChipActive]} onPress={() => setContentQuarter(quarter)}><Text style={[styles.scopeChipText, contentQuarter === quarter && styles.scopeChipTextActive]}>{quarter}º trimestre</Text></Pressable>)}</View><Text style={[styles.authLabel, { marginTop: 12 }]}>Semana</Text><View style={styles.scopeWrap}>{Array.from({ length: 13 }, (_, index) => index + 1).map(week => <Pressable key={week} style={[styles.scopeChip, contentWeek === week && styles.scopeChipActive]} onPress={() => setContentWeek(week)}><Text style={[styles.scopeChipText, contentWeek === week && styles.scopeChipTextActive]}>S{week}</Text></Pressable>)}</View></View>
        <Pressable style={styles.uploadBox} onPress={() => uploadPdf('lesson')}><Text style={styles.uploadIcon}>{lessonPdf ? '✓' : '＋'}</Text><Text style={styles.uploadTitle}>{lessonPdf?.name ?? 'Adicionar PDF da lição'}</Text><Text style={styles.uploadCopy}>{lessonPdf ? 'Lição pronta para publicação' : 'Arquivo opcional · até 25 MB'}</Text></Pressable>
        <Pressable style={styles.uploadBox} onPress={() => uploadPdf('book')}><Text style={styles.uploadIcon}>{bookPdf ? '✓' : '＋'}</Text><Text style={styles.uploadTitle}>{bookPdf?.name ?? 'Adicionar PDF do livro'}</Text><Text style={styles.uploadCopy}>{bookPdf ? 'Livro pronto para publicação' : 'Arquivo opcional · até 25 MB'}</Text></Pressable>
        {managedContent.length > 0 && <><Text style={styles.sectionTitle}>Histórico publicado</Text>{managedContent.map(item => <View key={item.id} style={styles.formCard}><View style={styles.weekRow}><View style={styles.flex}><Text style={styles.manageTitle}>{item.title}</Text><Text style={styles.manageCopy}>T{item.quarter} · Semana {item.week} · {item.year} · {item.lessonPdfUrl ? 'lição' : ''}{item.lessonPdfUrl && item.bookPdfUrl ? ' + ' : ''}{item.bookPdfUrl ? 'livro' : ''}</Text></View><Pressable onPress={async () => { try { await archiveWeeklyContent(item.id); setManagedContent(await listManagedContent(selectedClassId)); setMemberNotice('Conteúdo arquivado'); } catch (error) { setActionError(error instanceof Error ? error.message : 'Não foi possível arquivar.'); } }}><Text style={styles.phaseRemoveText}>Arquivar</Text></Pressable></View></View>)}</>}
      </>}
      {isQuiz && <>
        {managedQuizzes.some(item => item.active) && <><Text style={styles.sectionTitle}>Quizzes ativos ou agendados</Text>{managedQuizzes.filter(item => item.active).map(item => <View key={item.id} style={styles.formCard}><View style={styles.weekRow}><View style={styles.flex}><Text style={styles.manageTitle}>{item.title}</Text><Text style={styles.manageCopy}>{item.releaseAt > Date.now() ? `Agendado para ${new Date(item.releaseAt).toLocaleDateString('pt-BR')}` : 'Disponível agora'} · encerramento previsto em {new Date(item.closesAt).toLocaleDateString('pt-BR')}</Text></View><Pill tone={item.releaseAt > Date.now() ? 'gold' : 'teal'}>{item.releaseAt > Date.now() ? 'AGENDADO' : 'ABERTO'}</Pill></View>{quizToEnd === item.id ? <View style={styles.warningCard}><Text style={styles.manageTitle}>Encerrar imediatamente?</Text><Text style={styles.manageCopy}>Quem estiver respondendo será interrompido e não poderá enviar as respostas.</Text><View style={styles.memberActions}><Pressable style={styles.memberDangerButton} onPress={async () => { try { const result = await endQuizNow(item.id); setQuizToEnd(''); setManagedQuizzes(await listManagedQuizzes(selectedClassId)); setMemberNotice(`Quiz encerrado · ${result.submittedAttempts} resposta(s) recebida(s)`); } catch (error) { setActionError(error instanceof Error ? error.message : 'Não foi possível encerrar o quiz.'); } }}><Text style={styles.memberDangerText}>Sim, encerrar agora</Text></Pressable><Pressable style={styles.memberActionButton} onPress={() => setQuizToEnd('')}><Text style={styles.memberActionText}>Cancelar</Text></Pressable></View></View> : <Pressable style={styles.memberDangerButton} onPress={() => setQuizToEnd(item.id)}><Text style={styles.memberDangerText}>Encerrar quiz agora</Text></Pressable>}</View>)}</>}
        {managedQuizzes.some(item => !item.active) && <><Text style={styles.sectionTitle}>Histórico de quizzes encerrados</Text>{managedQuizzes.filter(item => !item.active).slice(0, 10).map(item => <View key={`ended-${item.id}`} style={styles.formCard}><View style={styles.weekRow}><View style={styles.flex}><Text style={styles.manageTitle}>{item.title}</Text><Text style={styles.manageCopy}>{item.submittedAttempts} resposta(s) recebida(s){item.endedAt ? ` · encerrado em ${item.endedAt.toLocaleDateString('pt-BR')}` : ''}</Text></View><Pill tone="coral">ENCERRADO</Pill></View></View>)}</>}
        <View style={styles.formCard}><AuthField label="Título do quiz" placeholder="Ex.: Jornada de Josué" value={quizTitle} onChangeText={setQuizTitle} /><Text style={styles.authLabel}>Quando liberar?</Text><View style={styles.scopeWrap}>{([['now', 'Agora'], ['saturday', 'Próximo sábado · 00h']] as const).map(([value, label]) => <Pressable key={value} style={[styles.scopeChip, quizReleaseMode === value && styles.scopeChipActive]} onPress={() => setQuizReleaseMode(value)}><Text style={[styles.scopeChipText, quizReleaseMode === value && styles.scopeChipTextActive]}>{label}</Text></Pressable>)}</View><Text style={[styles.authLabel, { marginTop: 14 }]}>Prazo para responder</Text><View style={styles.scopeWrap}>{[3, 7, 14].map(days => <Pressable key={days} style={[styles.scopeChip, quizDurationDays === days && styles.scopeChipActive]} onPress={() => setQuizDurationDays(days)}><Text style={[styles.scopeChipText, quizDurationDays === days && styles.scopeChipTextActive]}>{days} dias</Text></Pressable>)}</View></View>
        <View style={styles.formCard}><Text style={styles.manageTitle}>Jornada com {quizQuestions.length} fases</Text><Text style={styles.manageCopy}>Misture formatos para manter o quiz dinâmico, reflexivo e divertido.</Text></View>
        {quizQuestions.map((item, questionIndex) => <View key={`${item.type}_${questionIndex}`} style={styles.formCard}>
          <View style={styles.phaseControls}><Pill tone={questionIndex % 2 ? 'teal' : 'coral'}>FASE {questionIndex + 1} · {quizTypeLabels[item.type].toUpperCase()}</Pill><View style={styles.phaseButtons}><Pressable disabled={questionIndex === 0} onPress={() => setQuizQuestions(items => { const copy = [...items]; [copy[questionIndex - 1], copy[questionIndex]] = [copy[questionIndex], copy[questionIndex - 1]]; return copy; })}><Text style={[styles.phaseButtonText, questionIndex === 0 && styles.phaseButtonDisabled]}>↑</Text></Pressable><Pressable disabled={questionIndex === quizQuestions.length - 1} onPress={() => setQuizQuestions(items => { const copy = [...items]; [copy[questionIndex + 1], copy[questionIndex]] = [copy[questionIndex], copy[questionIndex + 1]]; return copy; })}><Text style={[styles.phaseButtonText, questionIndex === quizQuestions.length - 1 && styles.phaseButtonDisabled]}>↓</Text></Pressable><Pressable onPress={() => setQuizQuestions(items => items.filter((_, index) => index !== questionIndex))}><Text style={styles.phaseRemoveText}>Remover</Text></Pressable></View></View>
          <Text style={styles.authLabel}>Formato da fase</Text><View style={styles.quizTypeGrid}>{quizQuestionTemplates.map(template => <Pressable key={template.type} style={[styles.quizTypeButton, item.type === template.type && styles.scopeChipActive]} onPress={() => setQuizQuestions(items => items.map((questionItem, index) => index === questionIndex ? { ...template, options: [...template.options] } : questionItem))}><Text style={[styles.quizTypeText, item.type === template.type && styles.scopeChipTextActive]}>{quizTypeLabels[template.type]}</Text></Pressable>)}</View>
          <TextInput multiline value={item.prompt} onChangeText={text => setQuizQuestions(items => items.map((questionItem, index) => index === questionIndex ? { ...questionItem, prompt: text } : questionItem))} style={[styles.authInput, styles.textArea, { marginTop: 12 }]} />
          {item.options.map((option, optionIndex) => <View key={optionIndex} style={[styles.quizEditOption, item.correctAnswer === optionIndex && styles.quizEditCorrect]}><Pressable onPress={() => setQuizQuestions(items => items.map((questionItem, index) => index === questionIndex ? { ...questionItem, correctAnswer: optionIndex } : questionItem))}><Text style={[styles.optionLetter, item.correctAnswer === optionIndex && styles.optionLetterSelected]}>{String.fromCharCode(65 + optionIndex)}</Text></Pressable><TextInput value={option} onChangeText={text => setQuizQuestions(items => items.map((questionItem, index) => index === questionIndex ? { ...questionItem, options: questionItem.options.map((entry, entryIndex) => entryIndex === optionIndex ? text : entry) } : questionItem))} style={styles.quizOptionInput} />{item.correctAnswer === optionIndex && <Text style={styles.correctLabel}>GABARITO</Text>}</View>)}
          {item.type === 'open' && <Text style={styles.manageCopy}>A resposta será analisada manualmente pelo diretor.</Text>}
        </View>)}
        <Text style={styles.sectionTitle}>Adicionar nova fase</Text><View style={styles.quizTypeGrid}>{quizQuestionTemplates.map(template => <Pressable key={`add-${template.type}`} style={styles.quizTypeButton} onPress={() => setQuizQuestions(items => [...items, { ...template, options: [...template.options] }])}><Text style={styles.quizTypeText}>＋ {quizTypeLabels[template.type]}</Text></Pressable>)}</View>
        <View style={styles.inviteCodeCard}><Text style={styles.authEyebrow}>RESUMO DA PUBLICAÇÃO</Text><Text style={styles.manageCopy}>{quizTitle || 'Quiz sem título'} · {quizQuestions.length} fase(s)</Text><Text style={[styles.cardCaption, { color: colors.white }]}>{quizReleaseMode === 'now' ? 'Liberação imediata' : `Agendado para ${new Date(nextSaturdayAt()).toLocaleDateString('pt-BR')} às 00h`} · encerra após {quizDurationDays} dias</Text></View>
      </>}
      {isQuizRanking && <View style={styles.formCard}><Text style={styles.pageEyebrow}>CONTROLE DO DIRETOR</Text><Text style={styles.pageTitle}>Publique quando a turma estiver reunida.</Text><Text style={styles.pageIntro}>As notas continuam privadas até você liberar. Ao publicar, todos verão o ranking semanal ao mesmo tempo.</Text><View style={styles.inviteCodeCard}><Text style={styles.authEyebrow}>STATUS ATUAL</Text><Text style={styles.inviteCode}>🔒 PRIVADO</Text><Text style={styles.cardCaption}>Corrija todas as respostas antes de liberar o placar.</Text></View></View>}
      {isPeriodClosure && <PeriodClosurePanel selectedClassId={selectedClassId} />}
      {isChallengeCreation && <View style={styles.formCard}><AuthField label="Nome do desafio" placeholder="Ex.: Corrente do bem" value={lessonTitle} onChangeText={setLessonTitle} /><AuthField label="Missão da turma" placeholder="Explique o que deve ser realizado" value={challengeDescription} onChangeText={setChallengeDescription} /><AuthField label="Evidência realizada" placeholder="Conte como a turma concluiu a missão" value={challengeEvidence} onChangeText={setChallengeEvidence} /><AuthField label="Pontos extras da base" placeholder="100" value={challengePoints} onChangeText={setChallengePoints} /><Text style={styles.manageCopy}>O coordenador distrital analisará a evidência antes de liberar os pontos e publicar no mural.</Text></View>}
      {isClassActivity && <><View style={styles.formCard}><Text style={styles.sectionTitle}>{editingActivityId ? 'Editar atividade' : 'Nova atividade'}</Text><AuthField label="Nome da atividade" placeholder="Ex.: Piquenique da base" value={lessonTitle} onChangeText={setLessonTitle} /><AuthField label="Descrição" placeholder="Explique a programação" value={activityDescription} onChangeText={setActivityDescription} /><AuthField label="Local" placeholder="Igreja ou endereço" value={eventLocation} onChangeText={setEventLocation} /><AuthField label="Data e horário" placeholder="Ex.: 16 de agosto · 15h" value={eventDate} onChangeText={setEventDate} /><AuthField label="Pontos por participação" placeholder="20" value={activityPoints} onChangeText={setActivityPoints} />{editingActivityId && <Pressable onPress={() => setEditingActivityId('')}><Text style={styles.skipLink}>Cancelar edição</Text></Pressable>}</View><Text style={styles.sectionTitle}>Atividades publicadas</Text>{directedActivities.map(activity => <View key={activity.id} style={styles.formCard}><Text style={styles.manageTitle}>{activity.title}</Text><Text style={styles.manageCopy}>{activity.dateLabel} · {activity.location}</Text><Text style={styles.challengeStatus}>{activity.participantCount ?? 0} inscrito(s) · {activity.attendedCount ?? 0} presença(s) confirmada(s)</Text>{activity.participants?.map(participant => <View key={participant.userId} style={styles.memberRow}><View style={styles.flex}><Text style={styles.manageTitle}>{participant.userName}</Text><Text style={styles.manageCopy}>{participant.status === 'attended' ? `Presente · +${activity.points} pontos` : 'Inscrito'}</Text></View><Pressable style={[styles.scopeChip, participant.status === 'attended' && styles.scopeChipActive]} onPress={async () => { await confirmClassActivityAttendance(activity, participant.userId, participant.status !== 'attended'); setDirectedActivities(await listDirectedActivities(selectedClassId)); }}><Text style={[styles.scopeChipText, participant.status === 'attended' && styles.scopeChipTextActive]}>{participant.status === 'attended' ? '✓ Presente' : 'Confirmar presença'}</Text></Pressable></View>)}<View style={styles.scopeWrap}><Pressable style={styles.scopeChip} onPress={() => { setEditingActivityId(activity.id); setLessonTitle(activity.title); setActivityDescription(activity.description); setEventLocation(activity.location); setEventDate(activity.dateLabel); setActivityPoints(String(activity.points)); }}><Text style={styles.scopeChipText}>Editar</Text></Pressable><Pressable style={styles.scopeChip} onPress={async () => { await closeClassActivity(activity.id); setDirectedActivities(await listDirectedActivities(selectedClassId)); setMemberNotice('Atividade encerrada'); }}><Text style={[styles.scopeChipText, { color: colors.coral }]}>Encerrar</Text></Pressable></View></View>)}</>}
      {isPresenceTheme && <View style={styles.formCard}><Text style={styles.sectionTitle}>100 cenários para a jornada</Text><Text style={styles.manageCopy}>No modo surpresa, o aplicativo escolhe um cenário diferente automaticamente a cada trimestre.</Text><Pressable onPress={() => setSelectedScenario('auto')} style={[styles.autoScenarioCard, selectedScenario === 'auto' && styles.themeCardActive]}><Text style={styles.themeIcon}>🎲</Text><View style={styles.flex}><Text style={styles.manageTitle}>Surpresa automática</Text><Text style={styles.manageCopy}>Recomendado · muda a cada trimestre</Text></View>{selectedScenario === 'auto' && <Text style={styles.correctLabel}>ATIVO</Text>}</Pressable><View style={[styles.scenarioPreview, { backgroundColor: presenceScenarios[scenarioPreviewIndex].color }]}><Text style={styles.scenarioPreviewIcon}>{presenceScenarios[scenarioPreviewIndex].icon}</Text><Text style={styles.challengeTitle}>{presenceScenarios[scenarioPreviewIndex].name}</Text><Text style={styles.manageCopy}>{presenceScenarios[scenarioPreviewIndex].intro}</Text><Text style={styles.challengeStatus}>Cenário {scenarioPreviewIndex + 1} de 100 · {presenceScenarios[scenarioPreviewIndex].goal}</Text></View><View style={styles.memberActions}><Pressable style={styles.memberActionButton} onPress={() => setScenarioPreviewIndex(index => (index + 1) % presenceScenarios.length)}><Text style={styles.memberActionText}>🎲 Sortear outro</Text></Pressable><Pressable style={styles.memberActionButton} onPress={() => setSelectedScenario(presenceScenarios[scenarioPreviewIndex].id)}><Text style={styles.memberActionText}>Usar este cenário</Text></Pressable></View>{selectedScenario !== 'auto' && <Text style={styles.successNotice}>✓ Cenário fixo selecionado: {resolvePresenceScenario(selectedScenario, '').name}</Text>}<Text style={styles.sectionTitle}>Mundos disponíveis</Text><View style={styles.worldChips}>{[...new Set(presenceScenarios.map(item => item.world))].map(world => <Pressable key={world} style={styles.worldChip} onPress={() => setScenarioPreviewIndex(presenceScenarios.findIndex(item => item.world === world))}><Text style={styles.worldChipText}>{world}</Text></Pressable>)}</View></View>}
      {isApproval && <>{displayApprovals.length === 0 && <View style={styles.formCard}><Text style={styles.manageTitle}>Nenhuma solicitação pendente</Text><Text style={styles.manageCopy}>Os novos pedidos aparecerão aqui automaticamente.</Text></View>}{displayApprovals.map(item => { const done = approved.includes(item.name); return <View key={`${item.id}_${item.name}`} style={styles.approvalCard}><View style={styles.rankAvatar}><Text style={styles.rankAvatarText}>{item.name[0]}</Text></View><View style={styles.flex}><Text style={styles.manageTitle}>{item.name}</Text><Text style={styles.manageCopy}>{item.copy}</Text>{approvalType === 'attendance' && item.evidenceUrl && <Image source={{ uri: item.evidenceUrl }} style={styles.approvalEvidence} />}{approvalType === 'attendance' && !done && <TextInput value={attendanceNotes[item.id] ?? ''} onChangeText={text => setAttendanceNotes(current => ({ ...current, [item.id]: text }))} placeholder="Orientação privada, especialmente se recusar" placeholderTextColor="#8A9892" style={[styles.authInput, { marginTop: 8 }]} />}{approvalType === 'studyRecord' && !done && <><View style={styles.scopeWrap}>{([['excellent', 'Excelente · 20 pts'], ['good', 'Bom · 15 pts'], ['revise', 'Revisar · 0 pts']] as const).map(([value, label]) => <Pressable key={value} style={[styles.scopeChip, (studyEvaluations[item.id] ?? 'good') === value && styles.scopeChipActive]} onPress={() => setStudyEvaluations(current => ({ ...current, [item.id]: value }))}><Text style={[styles.scopeChipText, (studyEvaluations[item.id] ?? 'good') === value && styles.scopeChipTextActive]}>{label}</Text></Pressable>)}</View><TextInput value={studyFeedbacks[item.id] ?? ''} onChangeText={text => setStudyFeedbacks(current => ({ ...current, [item.id]: text }))} placeholder="Comentário privado para o adolescente" placeholderTextColor="#8A9892" style={[styles.authInput, { marginTop: 8 }]} /></>}</View><View><Pressable style={[styles.approveButton, done && styles.approveButtonDone]} onPress={() => approveItem(item)}><Text style={[styles.approveButtonText, done && styles.approveButtonTextDone]}>{done ? '✓ Avaliado' : approvalType === 'studyRecord' ? 'Enviar avaliação' : approvalType === 'attendance' ? 'Confirmar' : 'Aprovar'}</Text></Pressable>{!done && <Pressable onPress={() => rejectItem(item)}><Text style={styles.contactLink}>{approvalType === 'studyRecord' ? 'Pedir revisão' : approvalType === 'attendance' ? 'Pedir nova foto' : 'Recusar'}</Text></Pressable>}</View></View>; })}</>}
      {isLeadershipHistory && <><View style={styles.formCard}><Text style={styles.sectionTitle}>Registro de mudanças</Text><Text style={styles.manageCopy}>Transferências, revogações e decisões ficam registradas para acompanhamento.</Text></View>{leadershipHistory.length === 0 && <Text style={styles.pageIntro}>Nenhuma alteração de liderança registrada.</Text>}{leadershipHistory.map(item => <View key={item.id} style={styles.approvalCard}><View style={styles.rankAvatar}><Text style={styles.rankAvatarText}>{item.action === 'transfer' ? '⇄' : '×'}</Text></View><View style={styles.flex}><Text style={styles.manageTitle}>{item.className}</Text><Text style={styles.manageCopy}>{item.action === 'transfer' ? `Transferência para ${item.targetName}` : 'Revogação da direção'}{item.reviewedAt ? ` · ${item.reviewedAt.toLocaleDateString('pt-BR')}` : ''}</Text></View><Pill tone={item.status === 'approved' ? 'teal' : item.status === 'rejected' ? 'coral' : 'gold'}>{item.status === 'approved' ? 'APROVADA' : item.status === 'rejected' ? 'RECUSADA' : 'PENDENTE'}</Pill></View>)}</>}
      {isReport && <>
        {!leadershipReport && <ActivityIndicator color={colors.tealMedium} />}
        {leadershipReport && <><View style={styles.reportHero}><Text style={styles.reportValue}>{leadershipReport.activeStudents}</Text><View style={styles.flex}><Text style={styles.reportTitle}>Membros ativos</Text><Text style={styles.reportCopy}>{leadershipReport.scopeLabel} · {leadershipReport.activeClasses} base(s)</Text></View></View><Text style={styles.sectionTitle}>Visão gráfica dos fechamentos</Text>{[['Resumos', leadershipReport.studies, colors.tealMedium], ['Presenças aprovadas', leadershipReport.approvedAttendance, colors.gold], ['Acertos nos quizzes', leadershipReport.quizCorrect, colors.coral], ['Atividades externas', leadershipReport.activities, '#6C83B8']].map(([label, value, color]) => <View key={label as string} style={styles.reportRow}><View style={styles.reportRowTop}><Text style={styles.manageTitle}>{label}</Text><Text style={styles.reportPercent}>{value}</Text></View><Progress value={Number(value) / Math.max(1, leadershipReport.studies, leadershipReport.approvedAttendance, leadershipReport.quizCorrect, leadershipReport.activities) * 100} color={color as string} /></View>)}<View style={styles.reportTotalsRow}><Text style={styles.reportMiniItem}>{leadershipReport.totalPoints} pontos acumulados</Text><Text style={styles.reportMiniItem}>{leadershipReport.closedPeriods} períodos encerrados</Text></View><Text style={styles.sectionTitle}>Comparação entre bases</Text>{leadershipReport.classes.map((item, index) => <View key={item.classId} style={styles.reportClassCard}><View style={styles.weekRow}><View style={styles.flex}><Text style={styles.manageTitle}>{index + 1}. {item.className}</Text><Text style={styles.manageCopy}>{item.activeStudents} membros · {item.closedPeriods} fechamento(s)</Text></View><Text style={styles.rankPoints}>{item.points} pts</Text></View><Progress value={item.points / Math.max(1, ...leadershipReport.classes.map(entry => entry.points)) * 100} color={colors.tealMedium} /><View style={styles.reportMiniGrid}><Text style={styles.reportMiniItem}>{item.studies} resumos</Text><Text style={styles.reportMiniItem}>{item.attendance} presenças</Text><Text style={styles.reportMiniItem}>{item.quizCorrect} acertos</Text><Text style={styles.reportMiniItem}>{item.activities} atividades</Text></View></View>)}<View style={styles.privacyCard}><Text style={styles.manageTitle}>🔒 Dados consolidados</Text><Text style={styles.manageCopy}>Resumos, respostas e avaliações individuais não são incluídos neste relatório.</Text></View></>}
        <Pressable style={styles.exportButton} onPress={exportReport}><Text style={styles.exportButtonText}>⇩ Exportar relatório em PDF</Text></Pressable>
      </>}
      {isEvent && <>
        {districtEvents.filter(event => event.active).map(event => <View key={event.id} style={styles.eventCard}><View style={styles.eventDate}><Text style={styles.eventDay}>◉</Text></View><View style={styles.flex}>
          <Text style={styles.eventTitle}>{event.title}</Text><Text style={styles.eventCopy}>{event.location} · {event.dateLabel}</Text><Text style={styles.manageCopy}>{event.description}</Text>
          <Text style={styles.challengeStatus}>{event.participantCount ?? 0}{Number(event.capacity ?? 0) > 0 ? ` de ${event.capacity}` : ''} confirmado(s) · {event.waitlistCount ?? 0} na espera · {event.checkedInCount ?? 0} presente(s)</Text>
          {(event.participants ?? []).filter(item => item.status === 'confirmed').map(item => <View key={`${event.id}_${item.userId}`} style={styles.memberRow}><View style={styles.flex}><Text style={styles.manageTitle}>{item.name}</Text><Text style={styles.manageCopy}>{item.checkedIn ? 'Presença registrada' : 'Aguardando chegada'}</Text></View><Pressable style={[styles.scopeChip, item.checkedIn && styles.scopeChipActive]} onPress={async () => { try { await setEventCheckIn(event.id, item.userId, !item.checkedIn); setDistrictEvents(await listCurrentDistrictEvents()); } catch (error) { setActionError(error instanceof Error ? error.message : 'Não foi possível registrar a presença.'); } }}><Text style={[styles.scopeChipText, item.checkedIn && styles.scopeChipTextActive]}>{item.checkedIn ? '✓ Presente' : 'Confirmar chegada'}</Text></Pressable></View>)}
          {(event.waitlistCount ?? 0) > 0 && <View style={styles.warningCard}><Text style={styles.manageTitle}>Lista de espera</Text><Text style={styles.manageCopy}>{event.participants?.filter(item => item.status === 'waitlisted').map(item => item.name).join(', ')}</Text><Pressable style={styles.memberActionButton} onPress={async () => { try { await promoteNextWaitlisted(event); setDistrictEvents(await listCurrentDistrictEvents()); setMemberNotice('Primeira pessoa da fila promovida e avisada'); } catch (error) { setActionError(error instanceof Error ? error.message : 'Não foi possível liberar a vaga.'); } }}><Text style={styles.memberActionText}>Liberar próxima vaga</Text></Pressable></View>}
          <View style={styles.scopeWrap}><Pressable style={styles.scopeChip} onPress={() => { setEditingEventId(event.id); setLessonTitle(event.title); setEventDescription(event.description ?? ''); setEventLocation(event.location); setEventDate(event.dateLabel); setEventCapacity(String(event.capacity ?? 0)); }}><Text style={styles.scopeChipText}>Editar</Text></Pressable><Pressable style={styles.scopeChip} onPress={async () => { try { const count = await remindEventParticipants(event); setMemberNotice(`Lembrete enviado para ${count} participante(s)`); } catch (error) { setActionError(error instanceof Error ? error.message : 'Não foi possível enviar o lembrete.'); } }}><Text style={styles.scopeChipText}>🔔 Lembrar confirmados</Text></Pressable><Pressable style={styles.scopeChip} onPress={async () => { try { await completeDistrictEvent(event); setDistrictEvents(await listCurrentDistrictEvents()); setMemberNotice('Encontro encerrado e resumo salvo'); } catch (error) { setActionError(error instanceof Error ? error.message : 'Não foi possível encerrar o encontro.'); } }}><Text style={styles.scopeChipText}>Encerrar encontro</Text></Pressable><Pressable style={styles.scopeChip} onPress={() => setEventToCancel(event.id)}><Text style={[styles.scopeChipText, { color: colors.coral }]}>Cancelar encontro</Text></Pressable></View>
          {eventToCancel === event.id && <View style={styles.warningCard}><Text style={styles.manageTitle}>Confirmar cancelamento?</Text><Text style={styles.manageCopy}>Todos os participantes confirmados serão avisados.</Text><View style={styles.memberActions}><Pressable style={styles.memberDangerButton} onPress={async () => { try { const count = await cancelDistrictEvent(event); setEventToCancel(''); setDistrictEvents(await listCurrentDistrictEvents()); setMemberNotice(`Encontro cancelado · ${count} participante(s) avisado(s)`); } catch (error) { setActionError(error instanceof Error ? error.message : 'Não foi possível cancelar.'); } }}><Text style={styles.memberDangerText}>Sim, cancelar</Text></Pressable><Pressable style={styles.memberActionButton} onPress={() => setEventToCancel('')}><Text style={styles.memberActionText}>Voltar</Text></Pressable></View></View>}
        </View></View>)}
        {districtEvents.some(event => !event.active) && <><Text style={styles.sectionTitle}>Histórico de encontros</Text>{districtEvents.filter(event => !event.active).map(event => { const feedbacks = eventFeedback.filter(item => item.eventId === event.id); const average = feedbacks.length ? feedbacks.reduce((sum, item) => sum + item.rating, 0) / feedbacks.length : 0; const attendanceRate = Number(event.participantCount ?? 0) ? Math.round(Number(event.checkedInCount ?? 0) / Number(event.participantCount) * 100) : 0; return <View key={`history-${event.id}`} style={styles.formCard}><Text style={styles.manageTitle}>{event.title}</Text><Text style={styles.manageCopy}>{event.dateLabel} · {event.location}</Text>{event.status === 'completed' ? <><Pill tone="teal">CONCLUÍDO</Pill><View style={styles.engagementSummary}><View style={styles.stat}><Text style={styles.statValue}>{event.checkedInCount ?? 0}</Text><Text style={styles.cardCaption}>presentes</Text></View><View style={styles.stat}><Text style={styles.statValue}>{attendanceRate}%</Text><Text style={styles.cardCaption}>comparecimento</Text></View><View style={styles.stat}><Text style={styles.statValue}>{average ? average.toFixed(1) : '—'}</Text><Text style={styles.cardCaption}>média de 5</Text></View></View><Text style={styles.challengeStatus}>{feedbacks.length} avaliação(ões) recebida(s)</Text>{feedbacks.filter(item => item.comment).map(item => <View key={item.id} style={styles.memberRow}><View style={styles.flex}><Text style={styles.manageTitle}>{'★'.repeat(item.rating)} · {item.userName}</Text><Text style={styles.manageCopy}>{item.comment}</Text></View></View>)}</> : <Pill tone="coral">CANCELADO</Pill>}</View>; })}</>}
        <View style={styles.formCard}><Text style={styles.sectionTitle}>{editingEventId ? 'Editar encontro' : 'Novo encontro distrital'}</Text><AuthField label="Nome do encontro" placeholder="Ex.: Conexão Distrital" value={lessonTitle} onChangeText={setLessonTitle} /><AuthField label="Descrição" placeholder="Conte o que acontecerá" value={eventDescription} onChangeText={setEventDescription} /><AuthField label="Local" placeholder="Igreja ou endereço" value={eventLocation} onChangeText={setEventLocation} /><AuthField label="Data e horário" placeholder="Ex.: 16 de agosto · 15h" value={eventDate} onChangeText={setEventDate} /><AuthField label="Limite de vagas · use 0 para ilimitado" placeholder="0" value={eventCapacity} onChangeText={setEventCapacity} />{editingEventId && <Pressable onPress={() => setEditingEventId('')}><Text style={styles.skipLink}>Cancelar edição</Text></Pressable>}</View>
      </>}
      {isStructure && <>
        {structures.map(item => <View key={`${item.kind}-${item.id}`} style={styles.structureCard}><View style={styles.structureIcon}><Text style={styles.structureIconText}>{item.kind === 'district' ? '⌘' : item.kind === 'church' ? '⌂' : '◆'}</Text></View><View style={styles.flex}><Text style={styles.manageTitle}>{item.name}</Text><Text style={styles.manageCopy}>{item.detail}</Text></View></View>)}
        <View style={styles.formCard}>
          <Text style={styles.manageTitle}>Nova estrutura</Text>
          <Text style={styles.manageCopy}>{role === 'coordenador' ? 'Cadastre uma igreja e sua classe dentro do seu distrito.' : 'O administrador cadastra o distrito, a igreja e a primeira classe.'}</Text>
          {role === 'admin' && <AuthField label="Distrito" placeholder="Ex.: Central" value={districtName} onChangeText={setDistrictName} />}
          <AuthField label="Igreja" placeholder="Ex.: Alto do Guarani" value={churchName} onChangeText={setChurchName} />
          <AuthField label="Classe" placeholder="Ex.: Base Cordilheira" value={className} onChangeText={setClassName} />
          <Text style={styles.authLabel}>Faixa etária da base</Text><View style={styles.ageGroupRow}><Pressable style={[styles.ageGroupChoice, structureAgeGroup === 'adolescentes' && styles.ageGroupChoiceActive]} onPress={() => setStructureAgeGroup('adolescentes')}><Text style={[styles.ageGroupChoiceText, structureAgeGroup === 'adolescentes' && styles.ageGroupChoiceTextActive]}>Adolescentes</Text><Text style={styles.manageCopy}>13 a 17 anos</Text></Pressable><Pressable style={[styles.ageGroupChoice, structureAgeGroup === 'pre-adolescentes' && styles.ageGroupChoiceActive]} onPress={() => setStructureAgeGroup('pre-adolescentes')}><Text style={[styles.ageGroupChoiceText, structureAgeGroup === 'pre-adolescentes' && styles.ageGroupChoiceTextActive]}>Pré-adolescentes</Text><Text style={styles.manageCopy}>10 a 12 anos</Text></Pressable></View>
          <Pressable style={[styles.authPrimary, (structureBusy || !districtName.trim() || !churchName.trim() || !className.trim()) && styles.buttonDisabled]} disabled={structureBusy || !districtName.trim() || !churchName.trim() || !className.trim()} onPress={saveStructure}>
            <Text style={styles.authPrimaryText}>{structureBusy ? 'Criando estrutura...' : role === 'coordenador' ? 'Criar igreja e classe' : 'Criar distrito, igreja e classe'}</Text>
          </Pressable>
        </View>
      </>}
      {isCoordinatorInvites && <><Text style={styles.sectionTitle}>Coordenadores cadastrados</Text>{coordinatorAccounts.length === 0 && <Text style={styles.pageIntro}>Nenhum coordenador ativo foi cadastrado.</Text>}{coordinatorAccounts.map(account => <View key={account.id} style={styles.formCard}><View style={styles.weekRow}><View style={styles.flex}><Text style={styles.manageTitle}>{account.name}</Text><Text style={styles.manageCopy}>{account.email} · {account.districtName}</Text></View><Pill tone={account.active ? 'teal' : 'coral'}>{account.active ? 'ATIVO' : 'SUSPENSO'}</Pill></View><Text style={styles.authLabel}>Distrito responsável</Text><View style={styles.scopeWrap}>{structures.filter(item => item.kind === 'district').map(district => <Pressable key={district.id} style={[styles.scopeChip, coordinatorTransfers[account.id] === district.id && styles.scopeChipActive]} onPress={() => setCoordinatorTransfers(current => ({ ...current, [account.id]: district.id }))}><Text style={[styles.scopeChipText, coordinatorTransfers[account.id] === district.id && styles.scopeChipTextActive]}>{district.name}</Text></Pressable>)}</View><View style={styles.memberActions}><Pressable style={styles.memberActionButton} onPress={async () => { try { await updateCoordinatorAccount(account.id, { districtId: coordinatorTransfers[account.id] }); setCoordinatorAccounts(await listCoordinatorAccounts()); setMemberNotice(`Distrito de ${account.name} atualizado`); } catch (error) { setActionError(error instanceof Error ? error.message : 'Não foi possível transferir.'); } }}><Text style={styles.memberActionText}>Transferir distrito</Text></Pressable><Pressable style={account.active ? styles.memberDangerButton : styles.memberActionButton} onPress={async () => { try { await updateCoordinatorAccount(account.id, { active: !account.active }); setCoordinatorAccounts(await listCoordinatorAccounts()); setMemberNotice(account.active ? 'Acesso suspenso' : 'Acesso reativado'); } catch (error) { setActionError(error instanceof Error ? error.message : 'Não foi possível alterar o acesso.'); } }}><Text style={account.active ? styles.memberDangerText : styles.memberActionText}>{account.active ? 'Suspender acesso' : 'Reativar acesso'}</Text></Pressable></View></View>)}<View style={styles.formCard}><Text style={styles.sectionTitle}>Novo convite de coordenador</Text><Text style={styles.manageCopy}>Escolha o distrito que ficará vinculado ao convite.</Text><View style={styles.scopeWrap}>{structures.filter(item => item.kind === 'district').map(item => <Pressable key={item.id} style={[styles.scopeChip, coordinatorDistrictId === item.id && styles.scopeChipActive]} onPress={() => setCoordinatorDistrictId(item.id)}><Text style={[styles.scopeChipText, coordinatorDistrictId === item.id && styles.scopeChipTextActive]}>{item.name}</Text></Pressable>)}</View><Pressable style={[styles.authPrimary, !coordinatorDistrictId && styles.buttonDisabled]} disabled={!coordinatorDistrictId} onPress={async () => { try { const code = await createCoordinatorInvite(coordinatorDistrictId); setCoordinatorInvites(await listCoordinatorInvites()); setMemberNotice(`Convite criado: ${code}`); } catch (error) { setActionError(error instanceof Error ? error.message : 'Não foi possível criar o convite.'); } }}><Text style={styles.authPrimaryText}>Gerar convite seguro</Text></Pressable></View><Text style={styles.sectionTitle}>Convites gerados</Text>{coordinatorInvites.length === 0 && <Text style={styles.pageIntro}>Nenhum convite de coordenador foi criado.</Text>}{coordinatorInvites.map(item => <View key={item.id} style={styles.inviteAdminCard}><View style={styles.flex}><Text style={styles.inviteAdminCode}>{item.code}</Text><Text style={styles.manageCopy}>{item.districtName}</Text></View><Pill tone={item.active ? 'gold' : 'teal'}>{item.active ? 'PENDENTE' : 'UTILIZADO'}</Pill></View>)}</>}
      {isRisk && <><View style={styles.engagementSummary}><View style={styles.stat}><Text style={styles.statValue}>{engagementMembers.length}</Text><Text style={styles.cardCaption}>acompanhados</Text></View><View style={styles.stat}><Text style={styles.statValue}>{engagementMembers.filter(item => item.risk === 'high').length}</Text><Text style={styles.cardCaption}>risco alto</Text></View><View style={styles.stat}><Text style={styles.statValue}>{Math.round(engagementMembers.reduce((sum, item) => sum + item.engagement, 0) / Math.max(1, engagementMembers.length))}%</Text><Text style={styles.cardCaption}>engajamento</Text></View></View><View style={styles.filterRow}>{(['all', 'high', 'medium', 'regular'] as const).map(filter => <Pressable key={filter} onPress={() => setRiskFilter(filter)} style={[styles.filterChip, riskFilter === filter && styles.filterChipActive]}><Text style={[styles.filterChipText, riskFilter === filter && styles.filterChipTextActive]}>{({ all: 'Todos', high: 'Alto', medium: 'Médio', regular: 'Regular' } as const)[filter]}</Text></Pressable>)}</View>{engagementMembers.filter(item => riskFilter === 'all' || item.risk === riskFilter).map(member => { const color = member.risk === 'high' ? colors.coral : member.risk === 'medium' ? colors.gold : colors.tealMedium; return <View key={member.userId} style={styles.riskCard}><View style={[styles.riskLine, { backgroundColor: color }]} /><View style={styles.rankAvatar}><Text style={styles.rankAvatarText}>{member.name[0]}</Text></View><View style={styles.flex}><Text style={styles.manageTitle}>{member.name}</Text><Text style={styles.manageCopy}>{member.daysInactive === 999 ? 'Ainda sem participação registrada' : `${member.daysInactive} dia(s) sem atividade`} · {member.engagement}% engajamento</Text><Text style={styles.riskMetrics}>{member.studies} estudos · {member.attendance} presenças · {member.quizzes} quizzes · {member.activities} atividades</Text></View><View><Text style={[styles.riskLevel, { color }]}>{member.risk === 'high' ? 'ALTO' : member.risk === 'medium' ? 'MÉDIO' : 'REGULAR'}</Text><Pressable onPress={async () => { await recordEngagementFollowUp(engagementClassId, member); setMemberNotice(`Acompanhamento de ${member.name} registrado`); }}><Text style={styles.contactLink}>Registrar contato</Text></Pressable></View></View>; })}{engagementMembers.length === 0 && <Text style={styles.pageIntro}>Nenhum adolescente ativo foi encontrado nesta base.</Text>}</>}
      {isCoordinatorInvites && <><Text style={styles.sectionTitle}>Histórico administrativo</Text>{coordinatorAudit.length === 0 && <Text style={styles.pageIntro}>Nenhuma alteração administrativa registrada.</Text>}{coordinatorAudit.slice(0, 20).map(item => <View key={item.id} style={styles.inviteAdminCard}><View style={styles.flex}><Text style={styles.manageTitle}>{item.coordinatorName}</Text><Text style={styles.manageCopy}>{typeof item.active === 'boolean' ? item.active ? 'Acesso reativado' : 'Acesso suspenso' : `Transferido para ${structures.find(entry => entry.id === item.districtId)?.name ?? 'outro distrito'}`}{item.changedAt ? ` · ${item.changedAt.toLocaleDateString('pt-BR')}` : ''}</Text></View><Text style={styles.memberMenu}>◷</Text></View>)}</>}
      {isCoordinatorInvites && coordinatorInvites.some(item => item.active) && <><Text style={styles.sectionTitle}>Controle de convites pendentes</Text>{coordinatorInvites.filter(item => item.active).map(item => <View key={`pending-${item.id}`} style={styles.formCard}><View style={styles.weekRow}><View style={styles.flex}><Text style={styles.inviteAdminCode}>{item.code}</Text><Text style={styles.manageCopy}>{item.districtName}{item.expiresAt ? ` · válido até ${item.expiresAt.toLocaleDateString('pt-BR')}` : ''}</Text></View><Pill tone="gold">PENDENTE</Pill></View><Pressable style={styles.memberDangerButton} onPress={async () => { try { await cancelCoordinatorInvite(item.id); setCoordinatorInvites(await listCoordinatorInvites()); setMemberNotice('Convite cancelado com segurança'); } catch (error) { setActionError(error instanceof Error ? error.message : 'Não foi possível cancelar o convite.'); } }}><Text style={styles.memberDangerText}>Cancelar convite</Text></Pressable></View>)}</>}
      {isQuiz && managedQuizzes.some(item => item.active && item.releaseAt <= Date.now()) && <><Text style={styles.sectionTitle}>Acompanhamento das respostas</Text>{managedQuizzes.filter(item => item.active && item.releaseAt <= Date.now()).map(item => { const reminderBlocked = Boolean(item.lastReminderAt && Date.now() - item.lastReminderAt.getTime() < 60 * 60 * 1000); return <View key={`progress-${item.id}`} style={styles.formCard}><View style={styles.reportRowTop}><Text style={styles.manageTitle}>{item.title}</Text><Text style={styles.reportPercent}>{item.submittedAttempts}/{item.totalMembers}</Text></View><Progress value={item.totalMembers ? item.submittedAttempts / item.totalMembers * 100 : 0} color={colors.tealMedium} /><Text style={styles.manageCopy}>{item.pendingMembers.length ? `Pendentes: ${item.pendingMembers.slice(0, 8).map(member => member.name).join(', ')}${item.pendingMembers.length > 8 ? ` e mais ${item.pendingMembers.length - 8}` : ''}` : 'Todos os adolescentes já responderam.'}</Text>{item.reminderCount > 0 && <Text style={styles.challengeStatus}>{item.reminderCount} lembrete(s) enviado(s) neste quiz</Text>}{item.pendingMembers.length > 0 && <Pressable disabled={reminderBlocked} style={[styles.memberActionButton, reminderBlocked && styles.buttonDisabled]} onPress={async () => { try { const result = await sendQuizReminder(item.id); setMemberNotice(`Lembrete enviado para ${result.notified} adolescente(s)`); } catch (error) { setActionError(error instanceof Error ? error.message : 'Não foi possível enviar o lembrete.'); } }}><Text style={styles.memberActionText}>{reminderBlocked ? 'Aguarde uma hora para lembrar novamente' : '🔔 Lembrar quem ainda não respondeu'}</Text></Pressable>}</View>; })}</>}
      {isAttendanceApproval && attendanceProgress && <><Text style={styles.sectionTitle}>Resumo da semana {attendanceProgress.week}</Text><View style={styles.engagementSummary}><View style={styles.stat}><Text style={styles.statValue}>{attendanceProgress.approved}</Text><Text style={styles.cardCaption}>aprovadas</Text></View><View style={styles.stat}><Text style={styles.statValue}>{attendanceProgress.pending}</Text><Text style={styles.cardCaption}>pendentes</Text></View><View style={styles.stat}><Text style={styles.statValue}>{attendanceProgress.missing.length}</Text><Text style={styles.cardCaption}>sem envio</Text></View></View>{attendanceProgress.rejected > 0 && <Text style={styles.challengeStatus}>{attendanceProgress.rejected} presença(s) aguardando nova foto</Text>}{attendanceProgress.missing.length > 0 && <View style={styles.formCard}><Text style={styles.manageTitle}>Ainda não enviaram</Text><Text style={styles.manageCopy}>{attendanceProgress.missing.map(member => member.name).join(', ')}</Text><Pressable style={styles.memberActionButton} onPress={async () => { try { const result = await sendAttendanceReminder(selectedClassId); setMemberNotice(`Lembrete enviado para ${result.notified} adolescente(s)`); } catch (error) { setActionError(error instanceof Error ? error.message : 'Não foi possível enviar os lembretes.'); } }}><Text style={styles.memberActionText}>🔔 Lembrar quem ainda não enviou</Text></Pressable></View>}</>}
      {memberNotice !== '' && <Text style={styles.successNotice}>✓ {memberNotice}</Text>}
      {actionError !== '' && <Text style={styles.authError}>{actionError}</Text>}
      {!isContent && !isQuiz && !isApproval && !isReport && !isEvent && !isStructure && !isCoordinatorInvites && !isRisk && !isChallengeCreation && !isClassActivity && !isPresenceTheme && !isLeadershipHistory && <>
        <View style={styles.inviteCodeCard}><Text style={styles.authEyebrow}>CÓDIGO ATUAL</Text><Text style={styles.inviteCode}>{classManagement.inviteCode || 'VIVA-7429'}</Text><Text style={styles.cardCaption}>Compartilhe somente com os membros da turma.</Text><Pressable style={styles.copyButton} onPress={() => runMembershipAction('regenerateCode')}><Text style={styles.copyButtonText}>Gerar novo código</Text></Pressable></View>
        {displayMembers.map(member => <Pressable key={member.id} style={[styles.memberRow, selectedMemberId === member.id && styles.memberRowSelected]} onPress={() => setSelectedMemberId(member.id)}><View style={styles.rankAvatar}><Text style={styles.rankAvatarText}>{member.name[0]}</Text></View><View style={styles.flex}><Text style={styles.manageTitle}>{member.name}</Text><Text style={styles.manageCopy}>{member.role === 'director' ? 'Diretor(a)' : 'Membro ativo'}</Text></View><Text style={styles.memberMenu}>{selectedMemberId === member.id ? '✓' : '•••'}</Text></Pressable>)}
        {isMembers && <><View style={styles.memberActions}><Pressable style={styles.memberActionButton} onPress={() => runMembershipAction('transferLeadership')}><Text style={styles.memberActionText}>⇄ Transferir liderança</Text></Pressable><Pressable style={styles.memberDangerButton} onPress={() => runMembershipAction('revokeDirector')}><Text style={styles.memberDangerText}>Revogar direção</Text></Pressable></View><Pressable style={styles.removeMemberButton} onPress={() => runMembershipAction('removeMember')}><Text style={styles.removeMemberText}>Remover membro da classe</Text></Pressable></>}
      </>}
      {!isApproval && !isReport && !isStructure && !isCoordinatorInvites && !isPeriodClosure && !isLeadershipHistory && <Pressable style={[styles.authPrimary, saved && styles.buttonDone]} onPress={saveManagement}><Text style={styles.authPrimaryText}>{saved ? '✓ Alterações salvas' : isPresenceTheme ? 'Aplicar tema à base' : isClassActivity ? editingActivityId ? 'Salvar edição' : 'Publicar atividade' : isChallengeCreation ? 'Enviar para validação' : isQuizRanking ? 'Publicar notas e ranking' : isQuiz ? quizReleaseMode === 'now' ? 'Publicar quiz agora' : 'Agendar quiz' : isContent ? 'Publicar conteúdo' : isEvent ? 'Salvar encontro' : 'Salvar alterações'}</Text></Pressable>}
    </View>
  );
}

function ManagementApp({ role, onExit }: { role: Exclude<Role, 'adolescente'>; onExit: () => Promise<void> }) {
  const [section, setSection] = useState<'painel' | 'gestao' | 'atividade' | 'perfil'>('painel');
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [leadershipActivity, setLeadershipActivity] = useState<LeadershipActivity[]>([]);
  const [activityFilter, setActivityFilter] = useState<ActivityCategory | 'all'>('all');
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState('');
  const [profilePanel, setProfilePanel] = useState<'main' | 'settings' | 'help'>('main');
  const [leadershipSettings, setLeadershipSettings] = useState<LeadershipSettings | null>(null);
  const [settingsNotice, setSettingsNotice] = useState('');
  const [settingsError, setSettingsError] = useState('');
  const [dashboardInsights, setDashboardInsights] = useState<DashboardInsights>({ pending: 0, recent: 0, alert: 'Atualizando o painel...', weeklyValues: Array(7).fill(0), weeklyLabels: ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7'], trend: 0 });
  const leadership = useLeadershipProfile(role);
  const [activeClassId, setActiveClassId] = useState('');
  useEffect(() => { if (role === 'diretor' && !activeClassId && leadership.managedClasses.length) setActiveClassId(leadership.managedClasses[0].id); }, [role, activeClassId, leadership.managedClasses]);
  const activeManagedClass = leadership.managedClasses.find(item => item.id === activeClassId) ?? leadership.managedClasses[0];
  const refreshActivity = async () => { setActivityLoading(true); setActivityError(''); try { setLeadershipActivity(await listLeadershipActivity(role, activeClassId)); } catch (error) { setActivityError(error instanceof Error ? error.message : 'Não foi possível carregar as atividades.'); } finally { setActivityLoading(false); } };
  useEffect(() => { if (section === 'atividade') refreshActivity(); }, [section, role, activeClassId]);
  useEffect(() => { if (section === 'perfil' && profilePanel === 'settings' && !leadershipSettings) getLeadershipSettings().then(setLeadershipSettings).catch(error => setSettingsError(error instanceof Error ? error.message : 'Não foi possível abrir as configurações.')); }, [section, profilePanel, leadershipSettings]);
  useEffect(() => { loadDashboardInsights(role, activeClassId).then(setDashboardInsights).catch(() => undefined); }, [role, activeClassId]);
  const roleName = role === 'diretor' ? 'Diretor de classe' : role === 'coordenador' ? 'Coordenador distrital' : 'Administrador geral';
  const scope = role === 'diretor' && activeManagedClass ? activeManagedClass.name : leadership.scope;
  const metrics = leadership.metrics.map((item, index) => [index === 1 ? String(dashboardInsights.pending) : index === 2 ? String(dashboardInsights.recent) : item[0], index === 1 ? 'pendências' : index === 2 ? 'ações em 7 dias' : item[1], [colors.tealMedium, colors.gold, colors.coral][index]]);
  const maxWeeklyActivity = Math.max(1, ...dashboardInsights.weeklyValues);
  const performSignOut = async () => { setSigningOut(true); try { await onExit(); } finally { setSigningOut(false); } };
  const relativeActivityTime = (date: Date) => { const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000)); if (minutes < 1) return 'agora'; if (minutes < 60) return `há ${minutes} min`; const hours = Math.floor(minutes / 60); if (hours < 24) return `há ${hours}h`; const days = Math.floor(hours / 24); return days === 1 ? 'ontem' : `há ${days} dias`; };
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
      ['◷', 'Histórico de lideranças', 'Acompanhar solicitações e decisões', ''],
    ]
    : role === 'coordenador'
      ? [
        ['✓', 'Aprovar diretores', 'Novos responsáveis aguardando análise', '3'],
        ['⇄', 'Aprovar transferências', 'Trocas de liderança aguardando análise', ''],
        ['◷', 'Histórico de lideranças', 'Transferências e revogações registradas', ''],
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
            <View style={styles.alertCard}><View style={styles.alertDot} /><View style={styles.flex}><Text style={styles.alertTitle}>{dashboardInsights.pending ? 'Atenção necessária' : 'Tudo em dia'}</Text><Text style={styles.alertCopy}>{dashboardInsights.alert}</Text></View></View>
            <View style={styles.sectionHeaderManagement}><Text style={styles.sectionTitle}>Desempenho</Text><Text style={styles.seeAll}>Ver relatório ›</Text></View>
            <View style={styles.performanceCard}><View style={styles.performanceTop}><Text style={styles.weekTitle}>Atividade nas últimas 7 semanas</Text><Text style={[styles.performanceUp, dashboardInsights.trend < 0 && { color: colors.coral }]}>{dashboardInsights.trend >= 0 ? '↑' : '↓'} {Math.abs(dashboardInsights.trend)}%</Text></View><View style={styles.barChart}>{dashboardInsights.weeklyValues.map((value, index) => <View key={index} style={[styles.chartBar, { height: value ? Math.max(12, Math.round(value / maxWeeklyActivity * 100)) : 4 }, index === 6 && styles.chartBarActive]} />)}</View><View style={styles.chartLabels}>{dashboardInsights.weeklyLabels.map(label => <Text key={label} style={styles.chartLabel}>{label}</Text>)}</View></View>
          </>}
          {role === 'diretor' && leadership.managedClasses.length > 0 && <View style={styles.classSwitcher}><Text style={styles.authLabel}>BASE ATIVA</Text><ScrollView horizontal showsHorizontalScrollIndicator={false}>{leadership.managedClasses.map(item => <Pressable key={item.id} onPress={() => { setActiveClassId(item.id); setSelectedAction(null); }} style={[styles.classSwitchButton, activeClassId === item.id && styles.classSwitchButtonActive]}><Text style={[styles.classSwitchName, activeClassId === item.id && styles.classSwitchNameActive]}>{item.name}</Text><Text style={styles.classSwitchGroup}>{item.ageGroup === 'pre-adolescentes' ? 'Pré-adolescentes' : 'Adolescentes'}</Text></Pressable>)}</ScrollView></View>}
          {section === 'gestao' && (selectedAction ? <ManagementDetail title={selectedAction} role={role} selectedClassId={activeClassId} onBack={() => setSelectedAction(null)} /> : <><Text style={styles.pageEyebrow}>FERRAMENTAS</Text><Text style={styles.pageTitle}>Gestão</Text><Text style={styles.pageIntro}>Tudo que você precisa para acompanhar seu ministério.</Text>{actions.map(([icon, title, copy, badge]) => <ActionRow key={title} icon={icon} title={title} copy={copy} badge={badge || undefined} onPress={() => setSelectedAction(title)} />)}{role === 'diretor' && <ActionRow icon="♙" title="Gerenciar membros" copy="Convite, lista, transferências e acessos" onPress={() => setSelectedAction('Gerenciar membros')} />}</>)}
          {section === 'atividade' && <><Text style={styles.pageEyebrow}>ÚLTIMAS ATUALIZAÇÕES</Text><Text style={styles.pageTitle}>Atividade</Text><Text style={styles.pageIntro}>Acompanhe o que realmente aconteceu no seu alcance de liderança.</Text><View style={styles.scopeWrap}>{(['all', 'cadastro', 'estudo', 'presenca', 'desafio', 'evento', 'lideranca'] as const).map(filter => { const labels = { all: 'Tudo', cadastro: 'Cadastros', estudo: 'Estudos', presenca: 'Presenças', desafio: 'Desafios', evento: 'Encontros', lideranca: 'Liderança' }; return <Pressable key={filter} style={[styles.scopeChip, activityFilter === filter && styles.scopeChipActive]} onPress={() => setActivityFilter(filter)}><Text style={[styles.scopeChipText, activityFilter === filter && styles.scopeChipTextActive]}>{labels[filter]}</Text></Pressable>; })}</View><Pressable style={styles.memberActionButton} disabled={activityLoading} onPress={refreshActivity}><Text style={styles.memberActionText}>{activityLoading ? 'Atualizando...' : '↻ Atualizar histórico'}</Text></Pressable>{activityLoading && <ActivityIndicator color={colors.tealMedium} />}{activityError !== '' && <Text style={styles.authError}>{activityError}</Text>}{!activityLoading && leadershipActivity.filter(item => activityFilter === 'all' || item.category === activityFilter).length === 0 && <View style={styles.formCard}><Text style={styles.manageTitle}>Nenhuma atividade nesta categoria</Text><Text style={styles.manageCopy}>As novas ações aparecerão aqui automaticamente.</Text></View>}{leadershipActivity.filter(item => activityFilter === 'all' || item.category === activityFilter).map(item => <ActionRow key={item.id} icon={item.icon} title={item.title} copy={`${item.copy} · ${relativeActivityTime(item.occurredAt)}`} />)}</>}
          {section === 'perfil' && profilePanel === 'main' && <><View style={styles.profileTop}><View style={styles.profileAvatar}><Text style={styles.profileAvatarText}>{(leadershipSettings?.name ?? leadership.name)[0]?.toUpperCase() ?? 'U'}</Text></View><Text style={styles.profileName}>{leadershipSettings?.name ?? leadership.name}</Text><Text style={styles.profileClass}>{roleName}</Text><Text style={styles.profileStatus}>{scope}</Text></View><ActionRow icon="⚙" title="Configurações" copy="Conta, notificações e privacidade" onPress={() => setProfilePanel('settings')} /><ActionRow icon="?" title="Ajuda" copy="Orientações sobre o aplicativo" onPress={() => setProfilePanel('help')} /><Pressable style={styles.signOutButton} disabled={signingOut} onPress={performSignOut}><Text style={styles.signOutText}>{signingOut ? 'Saindo...' : 'Sair da conta'}</Text></Pressable></>}
          {section === 'perfil' && profilePanel === 'settings' && <><BackButton onPress={() => setProfilePanel('main')} /><Text style={styles.pageEyebrow}>SUA CONTA</Text><Text style={styles.pageTitle}>Configurações</Text>{!leadershipSettings && !settingsError && <ActivityIndicator color={colors.tealMedium} />}{leadershipSettings && <><View style={styles.formCard}><AuthField label="Nome de exibição" placeholder="Seu nome" value={leadershipSettings.name} onChangeText={name => setLeadershipSettings(current => current ? { ...current, name } : current)} /><Text style={styles.authLabel}>E-MAIL DA CONTA</Text><Text style={styles.manageCopy}>{leadershipSettings.email}</Text></View><Text style={styles.sectionTitle}>Notificações</Text>{([['quizReminders', 'Quiz e resultados', 'Avisos sobre publicação, correção e ranking'], ['attendanceReminders', 'Presenças', 'Lembretes e retornos das comprovações'], ['eventReminders', 'Encontros', 'Mudanças, vagas e lembretes distritais']] as const).map(([key, title, copy]) => <Pressable key={key} style={styles.memberRow} onPress={() => setLeadershipSettings(current => current ? { ...current, [key]: !current[key] } : current)}><View style={styles.flex}><Text style={styles.manageTitle}>{title}</Text><Text style={styles.manageCopy}>{copy}</Text></View><Pill tone={leadershipSettings[key] ? 'teal' : 'coral'}>{leadershipSettings[key] ? 'ATIVO' : 'PAUSADO'}</Pill></Pressable>)}<View style={styles.formCard}><Text style={styles.sectionTitle}>Horário silencioso</Text><Text style={styles.manageCopy}>Nesse intervalo, os avisos poderão aguardar até o horário seguinte.</Text><AuthField label="Início" placeholder="22:00" value={leadershipSettings.quietStart} onChangeText={quietStart => setLeadershipSettings(current => current ? { ...current, quietStart } : current)} /><AuthField label="Fim" placeholder="07:00" value={leadershipSettings.quietEnd} onChangeText={quietEnd => setLeadershipSettings(current => current ? { ...current, quietEnd } : current)} /></View><Pressable style={styles.authPrimary} onPress={async () => { setSettingsError(''); setSettingsNotice(''); try { await saveLeadershipSettings(leadershipSettings); setSettingsNotice('Configurações salvas com segurança'); } catch (error) { setSettingsError(error instanceof Error ? error.message : 'Não foi possível salvar.'); } }}><Text style={styles.authPrimaryText}>Salvar configurações</Text></Pressable></>}{settingsNotice !== '' && <Text style={styles.successNotice}>✓ {settingsNotice}</Text>}{settingsError !== '' && <Text style={styles.authError}>{settingsError}</Text>}</>}
          {section === 'perfil' && profilePanel === 'help' && <><BackButton onPress={() => setProfilePanel('main')} /><Text style={styles.pageEyebrow}>CENTRAL DE AJUDA</Text><Text style={styles.pageTitle}>Como podemos ajudar?</Text>{[['Quem aprova cada cadastro?', 'O diretor aprova adolescentes da própria base, o coordenador aprova diretores e o administrador gerencia coordenadores.'], ['Como funcionam os rankings?', 'O diretor decide quando publicar o ranking semanal. Os relatórios trimestrais e anuais ficam registrados no histórico.'], ['Como encerrar um quiz?', 'Abra Quiz semanal na Gestão e use Encerrar agora. Quem estiver respondendo será interrompido imediatamente.'], ['Meus dados ficam visíveis?', 'Cada liderança visualiza somente as informações necessárias ao seu alcance. Adolescentes não possuem mensagens privadas entre si.']].map(([title, copy]) => <View key={title} style={styles.formCard}><Text style={styles.manageTitle}>{title}</Text><Text style={styles.manageCopy}>{copy}</Text></View>)}<Pressable style={styles.memberActionButton} onPress={async () => { setSettingsError(''); const email = leadershipSettings?.email ?? auth?.currentUser?.email ?? ''; try { if (!email) throw new Error('Sua conta não possui um e-mail cadastrado.'); await resetUserPassword(email); setSettingsNotice('Enviamos um link de redefinição para seu e-mail.'); } catch (error) { setSettingsError(error instanceof Error ? error.message : 'Não foi possível enviar o link.'); } }}><Text style={styles.memberActionText}>Enviar link para trocar minha senha</Text></Pressable>{settingsNotice !== '' && <Text style={styles.successNotice}>{settingsNotice}</Text>}{settingsError !== '' && <Text style={styles.authError}>{settingsError}</Text>}</>}
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
      try {
        const savedRole = await getUserRole(user.uid);
        setActiveRole(savedRole === 'director' ? 'diretor' : savedRole === 'coordinator' ? 'coordenador' : savedRole === 'admin' ? 'admin' : 'adolescente');
      } catch { setActiveRole(null); }
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
  managementHero: { backgroundColor: colors.teal, padding: 22, paddingBottom: 28, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 }, managementTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, managementGreeting: { color: colors.white, fontSize: 26, fontWeight: '900', marginTop: 3 }, managementScope: { color: '#BFD2CD', fontSize: 13, marginTop: 18 }, classSelector: { alignSelf: 'flex-start', backgroundColor: colors.tealMedium, borderWidth: 1, borderColor: '#43736E', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, marginTop: 13 }, classSelectorText: { color: colors.white, fontSize: 11, fontWeight: '800' }, managementContent: { padding: 20, paddingBottom: 30 }, classSwitcher: { backgroundColor: colors.white, borderRadius: 17, padding: 12, marginBottom: 15 }, classSwitchButton: { minWidth: 145, borderRadius: 13, backgroundColor: colors.sage, borderWidth: 2, borderColor: 'transparent', padding: 11, marginRight: 8 }, classSwitchButtonActive: { backgroundColor: '#FFF3DB', borderColor: colors.gold }, classSwitchName: { color: colors.ink, fontSize: 11, fontWeight: '800' }, classSwitchNameActive: { color: colors.teal, fontWeight: '900' }, classSwitchGroup: { color: colors.muted, fontSize: 8, marginTop: 4 },
  metricsGrid: { flexDirection: 'row', gap: 9, marginTop: 13, marginBottom: 18 }, metricCard: { flex: 1, minHeight: 95, backgroundColor: colors.white, borderRadius: 16, borderTopWidth: 4, padding: 12, justifyContent: 'center' }, metricValue: { color: colors.teal, fontSize: 23, fontWeight: '900' }, metricLabel: { color: colors.muted, fontSize: 9, lineHeight: 13, marginTop: 4 },
  alertCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FBE4DA', borderRadius: 17, padding: 14 }, alertDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.coral, marginRight: 12 }, alertTitle: { color: '#9A3D23', fontSize: 12, fontWeight: '900' }, alertCopy: { color: '#805343', fontSize: 10, lineHeight: 15, marginTop: 3 }, sectionHeaderManagement: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, marginBottom: 12 }, seeAll: { color: colors.coral, fontSize: 11, fontWeight: '900' },
  performanceCard: { backgroundColor: colors.white, borderRadius: 19, padding: 16 }, performanceTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, performanceUp: { color: colors.tealMedium, fontSize: 12, fontWeight: '900' }, barChart: { height: 105, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', marginTop: 17, borderBottomWidth: 1, borderBottomColor: colors.line }, chartBar: { width: 20, backgroundColor: '#BFD2CD', borderTopLeftRadius: 5, borderTopRightRadius: 5 }, chartBarActive: { backgroundColor: colors.gold }, chartLabels: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 7 }, chartLabel: { color: colors.muted, fontSize: 8 },
  manageRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: 17, padding: 13, marginBottom: 10 }, manageIcon: { width: 43, height: 43, borderRadius: 13, backgroundColor: '#DCEDE9', alignItems: 'center', justifyContent: 'center', marginRight: 12 }, manageIconText: { color: colors.teal, fontSize: 17, fontWeight: '900' }, manageTitle: { color: colors.ink, fontSize: 13, fontWeight: '900' }, manageCopy: { color: colors.muted, fontSize: 9, lineHeight: 14, marginTop: 3 }, manageBadge: { backgroundColor: '#FBE0D6', color: colors.coral, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 9, overflow: 'hidden', fontSize: 8, fontWeight: '900' }, signOutButton: { minHeight: 52, borderRadius: 16, borderWidth: 1, borderColor: '#D6A28E', alignItems: 'center', justifyContent: 'center', marginTop: 15 }, signOutText: { color: colors.coral, fontSize: 13, fontWeight: '900' },
  communityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12, marginBottom: 24 }, communityCard: { width: '48%', minHeight: 116, borderRadius: 18, padding: 14 }, communityIcon: { color: colors.teal, fontSize: 20, fontWeight: '900' }, communityLabel: { color: colors.ink, fontSize: 14, fontWeight: '900', marginTop: 12 }, communityLink: { color: colors.tealMedium, fontSize: 10, fontWeight: '800', marginTop: 6 },
  rankingTabs: { flexDirection: 'row', backgroundColor: '#E1E9E4', borderRadius: 14, padding: 4, marginBottom: 13 }, rankingTab: { flex: 1, textAlign: 'center', color: colors.muted, fontSize: 10, fontWeight: '800', paddingVertical: 9 }, rankingTabActive: { flex: 1, textAlign: 'center', color: colors.white, backgroundColor: colors.tealMedium, borderRadius: 10, overflow: 'hidden', fontSize: 10, fontWeight: '900', paddingVertical: 9 }, rankRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: 16, padding: 12, marginBottom: 8 }, rankRowCurrent: { borderWidth: 2, borderColor: colors.gold, backgroundColor: '#FFF9EC' }, rankPlace: { width: 28, color: colors.teal, fontSize: 16, fontWeight: '900' }, rankAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#DCEDE9', alignItems: 'center', justifyContent: 'center', marginRight: 10 }, rankAvatarText: { color: colors.teal, fontWeight: '900' }, rankName: { flex: 1, color: colors.ink, fontSize: 12, fontWeight: '800' }, rankPoints: { color: '#9A6815', fontSize: 11, fontWeight: '900' }, fairRankHint: { backgroundColor: '#FFF3DB', borderRadius: 14, padding: 11, marginBottom: 12 },
  feedCard: { flexDirection: 'row', backgroundColor: colors.white, borderRadius: 18, padding: 15, marginBottom: 11 }, feedEmoji: { width: 42, fontSize: 25 }, reactions: { color: colors.coral, fontSize: 11, fontWeight: '800' }, reactionRow: { flexDirection: 'row', gap: 7, marginTop: 11 }, reactionButton: { backgroundColor: '#FFF3EC', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 7 }, flashGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, flashCard: { width: '47%', minHeight: 150, borderRadius: 4, padding: 15, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } }, flashLabel: { color: colors.muted, fontSize: 8, fontWeight: '900', letterSpacing: 1 }, flashText: { color: colors.ink, fontSize: 13, lineHeight: 20, fontWeight: '700', marginTop: 12 },
  challengeCard: { backgroundColor: colors.white, borderRadius: 22, padding: 18 }, challengeTitle: { color: colors.ink, fontSize: 23, fontWeight: '900', marginTop: 17 }, challengeCopy: { color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: 8 }, challengeMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 22, marginBottom: 8 }, challengePoints: { color: colors.coral, fontSize: 13, fontWeight: '900' }, challengeStatus: { color: colors.tealMedium, backgroundColor: '#DCEDE9', borderRadius: 12, overflow: 'hidden', padding: 11, fontSize: 9, fontWeight: '800', marginTop: 13 },
  hallCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: 17, padding: 14, marginBottom: 10, borderLeftWidth: 4, borderLeftColor: colors.gold }, hallIcon: { width: 43, fontSize: 25 }, notificationCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: 17, padding: 14, marginBottom: 9 }, notificationUnread: { backgroundColor: '#FFF8E9', borderWidth: 1, borderColor: '#EED49D' }, notificationTag: { color: colors.coral, backgroundColor: '#FBE0D6', borderRadius: 9, overflow: 'hidden', paddingHorizontal: 7, paddingVertical: 5, fontSize: 7, fontWeight: '900', marginRight: 10 }, notificationReadHint: { color: colors.coral, fontSize: 8, fontWeight: '800', marginTop: 5 }, unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.coral, marginLeft: 8 },
  uploadBox: { minHeight: 130, borderRadius: 18, borderWidth: 2, borderStyle: 'dashed', borderColor: '#B9C9C2', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F6F8F5', marginBottom: 15 }, uploadIcon: { color: colors.coral, fontSize: 28, fontWeight: '600' }, uploadTitle: { color: colors.ink, fontSize: 13, fontWeight: '900', marginTop: 4 }, uploadCopy: { color: colors.muted, fontSize: 9, marginTop: 4 }, scheduleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.white, borderRadius: 17, padding: 15, marginBottom: 11 }, toggleOn: { width: 44, height: 25, borderRadius: 13, backgroundColor: colors.tealMedium, padding: 3, alignItems: 'flex-end' }, toggleKnob: { width: 19, height: 19, borderRadius: 10, backgroundColor: colors.white }, formCard: { backgroundColor: colors.white, borderRadius: 18, padding: 15, marginBottom: 12 }, textArea: { height: 82, paddingTop: 13, textAlignVertical: 'top', marginBottom: 12 }, quizEditOption: { minHeight: 49, flexDirection: 'row', alignItems: 'center', borderRadius: 13, backgroundColor: colors.sage, padding: 7, marginBottom: 7, borderWidth: 1, borderColor: 'transparent' }, quizEditCorrect: { backgroundColor: '#E1F0E9', borderColor: colors.tealMedium }, quizOptionInput: { flex: 1, minHeight: 40, color: colors.ink, fontSize: 12, fontWeight: '700' }, correctLabel: { color: colors.tealMedium, fontSize: 8, fontWeight: '900', marginLeft: 'auto', marginRight: 7 }, addQuestion: { minHeight: 43, alignItems: 'center', justifyContent: 'center', marginTop: 5 }, addQuestionText: { color: colors.coral, fontSize: 11, fontWeight: '900' }, quizTypeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 10 }, quizTypeButton: { backgroundColor: colors.sage, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 9, borderWidth: 1, borderColor: colors.line }, quizTypeText: { color: colors.teal, fontSize: 8, fontWeight: '800' }, phaseControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }, phaseButtons: { flexDirection: 'row', alignItems: 'center', gap: 10 }, phaseButtonText: { color: colors.teal, fontSize: 17, fontWeight: '900' }, phaseButtonDisabled: { color: '#B8C2BE' }, phaseRemoveText: { color: colors.coral, fontSize: 9, fontWeight: '900' }, approvalCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: 17, padding: 12, marginBottom: 9 }, approveButton: { backgroundColor: '#FBE0D6', borderRadius: 11, paddingHorizontal: 10, paddingVertical: 8 }, approveButtonDone: { backgroundColor: '#DCEDE9' }, approveButtonText: { color: colors.coral, fontSize: 9, fontWeight: '900' }, approveButtonTextDone: { color: colors.tealMedium }, inviteCodeCard: { backgroundColor: colors.teal, borderRadius: 20, padding: 18, marginBottom: 14 }, inviteCode: { color: colors.gold, fontSize: 28, fontWeight: '900', letterSpacing: 3, marginVertical: 12 }, copyButton: { alignSelf: 'flex-start', backgroundColor: colors.white, borderRadius: 11, paddingHorizontal: 12, paddingVertical: 8, marginTop: 13 }, copyButtonText: { color: colors.teal, fontSize: 10, fontWeight: '900' }, memberRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: 15, padding: 11, marginBottom: 8 },
  reportHero: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.teal, borderRadius: 20, padding: 18, marginBottom: 13 }, reportValue: { color: colors.gold, fontSize: 31, fontWeight: '900', marginRight: 17 }, reportTitle: { color: colors.white, fontSize: 13, fontWeight: '900' }, reportCopy: { color: '#BFD2CD', fontSize: 9, marginTop: 4 }, reportRow: { backgroundColor: colors.white, borderRadius: 15, padding: 14, marginBottom: 8 }, reportRowTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }, reportPercent: { color: colors.teal, fontSize: 12, fontWeight: '900' }, reportClassCard: { backgroundColor: colors.white, borderRadius: 17, padding: 14, marginBottom: 9, borderLeftWidth: 4, borderLeftColor: colors.tealMedium }, reportMiniGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 11 }, reportTotalsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 10 }, reportMiniItem: { color: colors.muted, backgroundColor: colors.sage, borderRadius: 9, overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 6, fontSize: 8, fontWeight: '700' }, privacyCard: { backgroundColor: '#FFF3DB', borderRadius: 15, padding: 13, marginTop: 8 }, exportButton: { minHeight: 52, borderRadius: 16, backgroundColor: colors.coral, alignItems: 'center', justifyContent: 'center', marginTop: 10 }, exportButtonText: { color: colors.white, fontSize: 12, fontWeight: '900' },
  eventCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.teal, borderRadius: 20, padding: 16, marginBottom: 14 }, eventDate: { width: 58, height: 65, borderRadius: 15, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center', marginRight: 14 }, eventDay: { color: colors.teal, fontSize: 25, fontWeight: '900' }, eventMonth: { color: colors.teal, fontSize: 9, fontWeight: '900' }, eventTitle: { color: colors.white, fontSize: 15, fontWeight: '900' }, eventCopy: { color: '#BFD2CD', fontSize: 10, marginTop: 4 }, eventPeople: { color: colors.gold, fontSize: 9, fontWeight: '800', marginTop: 8 },
  searchBox: { height: 50, borderRadius: 15, backgroundColor: colors.white, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, marginBottom: 12 }, searchIcon: { color: colors.teal, fontSize: 20, marginRight: 10 }, searchPlaceholder: { color: '#8A9892', fontSize: 11 }, structureCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: 17, padding: 12, marginBottom: 9 }, structureIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#DCEDE9', alignItems: 'center', justifyContent: 'center', marginRight: 11 }, structureIconText: { color: colors.teal, fontSize: 17, fontWeight: '900' }, structurePercent: { color: colors.tealMedium, fontSize: 11, fontWeight: '900' }, ageGroupRow: { flexDirection: 'row', gap: 9, marginBottom: 14 }, ageGroupChoice: { flex: 1, borderRadius: 14, backgroundColor: colors.sage, borderWidth: 2, borderColor: 'transparent', padding: 12 }, ageGroupChoiceActive: { backgroundColor: '#FFF3DB', borderColor: colors.gold }, ageGroupChoiceText: { color: colors.ink, fontSize: 10, fontWeight: '800' }, ageGroupChoiceTextActive: { color: colors.teal, fontWeight: '900' }, inviteAdminCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: 16, padding: 14, marginBottom: 9 }, inviteAdminCode: { color: colors.teal, fontSize: 15, fontWeight: '900', letterSpacing: 1 }, outlineButton: { minHeight: 50, borderRadius: 16, borderWidth: 1, borderColor: colors.coral, alignItems: 'center', justifyContent: 'center', marginTop: 8 }, outlineButtonText: { color: colors.coral, fontSize: 11, fontWeight: '900' },
  riskCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: 17, padding: 12, marginBottom: 9, overflow: 'hidden' }, riskLine: { width: 4, alignSelf: 'stretch', borderRadius: 3, marginRight: 10 }, riskLevel: { fontSize: 8, fontWeight: '900', textAlign: 'right' }, riskMetrics: { color: colors.muted, fontSize: 7, marginTop: 5 }, engagementSummary: { flexDirection: 'row', backgroundColor: colors.white, borderRadius: 18, padding: 10, marginBottom: 11 }, filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 12 }, filterChip: { backgroundColor: '#E1E9E4', borderRadius: 13, paddingHorizontal: 11, paddingVertical: 8 }, filterChipActive: { backgroundColor: colors.tealMedium }, filterChipText: { color: colors.muted, fontSize: 9, fontWeight: '800' }, filterChipTextActive: { color: colors.white }, contactLink: { color: colors.tealMedium, fontSize: 9, fontWeight: '900', marginTop: 7 }, successNotice: { color: colors.tealMedium, backgroundColor: '#DCEDE9', borderRadius: 13, overflow: 'hidden', padding: 11, textAlign: 'center', fontSize: 9, fontWeight: '800', marginBottom: 10 }, memberMenu: { color: colors.teal, fontSize: 16, fontWeight: '900', padding: 8 }, memberActions: { flexDirection: 'row', gap: 8, marginTop: 6 }, memberActionButton: { flex: 1, minHeight: 44, borderRadius: 13, backgroundColor: '#DCEDE9', alignItems: 'center', justifyContent: 'center' }, memberActionText: { color: colors.teal, fontSize: 9, fontWeight: '900' }, memberDangerButton: { flex: 1, minHeight: 44, borderRadius: 13, backgroundColor: '#FBE0D6', alignItems: 'center', justifyContent: 'center' }, memberDangerText: { color: colors.coral, fontSize: 9, fontWeight: '900' },
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
  studyCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: 18, padding: 14, marginBottom: 11, borderWidth: 2, borderColor: 'transparent' }, studyCardSelected: { borderColor: colors.coral, backgroundColor: '#FFF8F5' },
  studyIcon: { width: 50, height: 50, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginRight: 13 }, studyEmoji: { fontSize: 21 }, studyLabel: { color: colors.coral, fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 }, studyTitle: { color: colors.ink, fontSize: 15, fontWeight: '800', marginVertical: 3 }, cardCaption: { color: colors.muted, fontSize: 11, lineHeight: 16 }, chevron: { color: colors.tealMedium, fontSize: 28 },
  summaryCard: { backgroundColor: colors.white, borderRadius: 18, padding: 15, marginTop: 3 }, privateHint: { color: colors.tealMedium, fontSize: 9, marginBottom: 10 }, summaryInput: { height: 110, textAlignVertical: 'top', paddingTop: 13 }, charCount: { color: colors.muted, fontSize: 8, textAlign: 'right', marginTop: 5 }, pendingHint: { color: colors.tealMedium, fontSize: 9, lineHeight: 14, textAlign: 'center', marginTop: 10 },
  attendancePreview: { width: '100%', height: 210, borderRadius: 16, resizeMode: 'cover' }, approvalEvidence: { width: '100%', height: 180, borderRadius: 14, marginTop: 10, resizeMode: 'cover' },
  warningCard: { backgroundColor: '#FFF3DB', borderRadius: 14, borderWidth: 1, borderColor: colors.gold, padding: 12, marginTop: 10 },
  primaryButton: { backgroundColor: colors.coral, borderRadius: 16, minHeight: 52, alignItems: 'center', justifyContent: 'center', marginTop: 13 }, primaryButtonText: { color: colors.white, fontSize: 14, fontWeight: '900' }, buttonDone: { backgroundColor: colors.tealMedium }, buttonDisabled: { opacity: 0.4 },
  mountainCard: { height: 380, backgroundColor: '#DCEDE9', borderRadius: 24, overflow: 'hidden', position: 'relative', marginBottom: 14 },
  trail: { position: 'absolute', top: 62, bottom: 25, left: '49%', width: 5, borderRadius: 4, backgroundColor: '#B8CFC7', transform: [{ rotate: '12deg' }] }, summit: { position: 'absolute', top: 20, alignSelf: 'center', backgroundColor: colors.gold, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 }, summitText: { color: colors.teal, fontSize: 10, fontWeight: '900' },
  checkpoint: { position: 'absolute', width: 28, height: 28, borderRadius: 14, backgroundColor: colors.white, borderWidth: 3, borderColor: '#B8CFC7', alignItems: 'center', justifyContent: 'center' }, currentCheckpoint: { width: 38, height: 38, borderRadius: 19, marginLeft: -5, marginTop: -5, backgroundColor: colors.coral, borderColor: colors.white, shadowOpacity: 0.18, shadowRadius: 8 }, approvedCheckpoint: { backgroundColor: colors.tealMedium, borderColor: colors.white }, checkpointText: { fontSize: 10, fontWeight: '900', color: colors.teal },
  statsRow: { flexDirection: 'row', backgroundColor: colors.white, borderRadius: 18, paddingVertical: 16, marginBottom: 22 }, stat: { flex: 1, alignItems: 'center', borderRightWidth: 1, borderRightColor: colors.line }, statValue: { color: colors.teal, fontSize: 20, fontWeight: '900', marginBottom: 3 },
  quizHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }, quizPoints: { color: '#A36B0A', fontWeight: '900' },
  option: { minHeight: 62, borderRadius: 17, padding: 12, backgroundColor: colors.white, flexDirection: 'row', alignItems: 'center', marginBottom: 10, borderWidth: 2, borderColor: 'transparent' }, optionSelected: { borderColor: colors.coral, backgroundColor: '#FFF7F4' }, optionLetter: { width: 37, height: 37, borderRadius: 12, backgroundColor: colors.sage, color: colors.teal, textAlign: 'center', lineHeight: 37, fontWeight: '900', marginRight: 13 }, optionLetterSelected: { backgroundColor: colors.coral, color: colors.white }, optionText: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  profileTop: { alignItems: 'center', paddingVertical: 15 }, profileAvatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.gold, borderWidth: 5, borderColor: '#F7E3BA', alignItems: 'center', justifyContent: 'center' }, profileAvatarText: { color: colors.teal, fontSize: 36, fontWeight: '900' }, profileName: { color: colors.ink, fontSize: 24, fontWeight: '900', marginTop: 12 }, profileClass: { color: colors.coral, fontWeight: '800', marginTop: 4, fontSize: 12 }, profileStatus: { color: colors.muted, marginTop: 10, fontStyle: 'italic' }, colorChoices: { flexDirection: 'row', gap: 12, marginBottom: 15 }, colorChoice: { width: 34, height: 34, borderRadius: 17 }, colorChoiceActive: { borderWidth: 4, borderColor: colors.ink }, profilePeerCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: 17, padding: 14, marginBottom: 9 }, themeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 }, themeCard: { width: '47%', minHeight: 105, borderRadius: 16, backgroundColor: colors.sage, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' }, themeCardActive: { backgroundColor: '#FFF3DB', borderColor: colors.gold }, themeIcon: { fontSize: 30, marginRight: 10 }, autoScenarioCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, backgroundColor: colors.sage, padding: 14, borderWidth: 2, borderColor: 'transparent', marginTop: 15 }, scenarioPreview: { minHeight: 210, borderRadius: 20, padding: 18, alignItems: 'center', justifyContent: 'center', marginTop: 14 }, scenarioPreviewIcon: { fontSize: 48 }, worldChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, worldChip: { backgroundColor: colors.sage, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 8 }, worldChipText: { color: colors.teal, fontSize: 9, fontWeight: '800' },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, marginBottom: 24 }, badge: { width: '31%', minHeight: 112, borderRadius: 17, backgroundColor: '#F8E8C8', alignItems: 'center', justifyContent: 'center', padding: 7, borderWidth: 1, borderColor: '#EED49D' }, badgeLocked: { backgroundColor: '#E8ECE8', borderColor: '#D1D8D3', opacity: 0.75 }, badgeText: { textAlign: 'center', color: colors.teal, fontSize: 11, lineHeight: 20, fontWeight: '800' }, badgeDetail: { textAlign: 'center', color: colors.muted, fontSize: 7, marginTop: 4 },
  nav: { height: 76, backgroundColor: colors.white, flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 8, paddingBottom: 5 },
  navItem: { flex: 1, alignItems: 'center' }, navIconWrap: { width: 34, height: 30, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, navIconActive: { backgroundColor: '#DCEDE9' }, navIcon: { color: '#81908A', fontSize: 17, fontWeight: '900' }, navIconTextActive: { color: colors.teal }, navLabel: { color: '#81908A', fontSize: 9, fontWeight: '700', marginTop: 3 }, navLabelActive: { color: colors.teal, fontWeight: '900' },
});
