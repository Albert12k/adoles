import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { firebaseEnabled } from './src/config/firebase';
import { getUserRole, loginUser, registerUser } from './src/services/auth';

type Tab = 'Início' | 'Estudo' | 'Presença' | 'Quiz' | 'Mais';
type Role = 'adolescente' | 'diretor' | 'coordenador' | 'admin';
type AuthStep = 'welcome' | 'login' | 'register' | 'role' | 'invite';

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

function HomeScreen({ onNavigate }: { onNavigate: (tab: Tab) => void }) {
  return (
    <>
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View>
            <Text style={styles.eyebrowLight}>SÁBADO, 25 DE JULHO</Text>
            <Text style={styles.greeting}>Olá, Daniel! 👋</Text>
          </View>
          <View style={styles.avatar}><Text style={styles.avatarText}>D</Text></View>
        </View>
        <Text style={styles.verse}>“Seja forte e corajoso. Não tenha medo.”</Text>
        <Text style={styles.verseRef}>Josué 1:9</Text>
      </View>

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

function StudyScreen() {
  const [completed, setCompleted] = useState(false);
  const [summary, setSummary] = useState('');
  return (
    <View style={styles.pagePad}>
      <Text style={styles.pageEyebrow}>ESTUDO SEMANAL</Text>
      <Text style={styles.pageTitle}>Cresça um pouco a cada dia.</Text>
      <Text style={styles.pageIntro}>Registre o que você aprendeu. Suas anotações são privadas.</Text>
      {[
        ['📖', 'Lição', 'Escolhas que transformam', '12 min de leitura', '#F8E8C8'],
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
      <Pressable style={[styles.primaryButton, completed && styles.buttonDone]} onPress={() => setCompleted(!completed)}>
        <Text style={styles.primaryButtonText}>{completed ? '✓ Estudo e resumo registrados' : 'Registrar estudo de hoje'}</Text>
      </Pressable>
    </View>
  );
}

function AttendanceScreen() {
  const [sent, setSent] = useState(false);
  return (
    <View style={styles.pagePad}>
      <Text style={styles.pageEyebrow}>TRIMESTRE 3 · SEMANA 7</Text>
      <Text style={styles.pageTitle}>Rumo ao topo! 🏔️</Text>
      <Text style={styles.pageIntro}>Cada presença leva seu avatar mais perto do cume.</Text>
      <View style={styles.mountainCard}>
        <View style={styles.summit}><Text style={styles.summitText}>🏆 CUME</Text></View>
        <View style={styles.trail} />
        {[13, 11, 9, 7, 5, 3, 1].map((week, index) => (
          <View key={week} style={[styles.checkpoint, { top: 55 + index * 47, left: index % 2 === 0 ? '64%' : '27%' }, week === 7 && styles.currentCheckpoint]}>
            <Text style={styles.checkpointText}>{week === 7 ? 'D' : week}</Text>
          </View>
        ))}
      </View>
      <View style={styles.statsRow}>
        <View style={styles.stat}><Text style={styles.statValue}>7</Text><Text style={styles.cardCaption}>presenças</Text></View>
        <View style={styles.stat}><Text style={styles.statValue}>54%</Text><Text style={styles.cardCaption}>do caminho</Text></View>
        <View style={styles.stat}><Text style={styles.statValue}>+70</Text><Text style={styles.cardCaption}>pontos</Text></View>
      </View>
      <Pressable style={[styles.primaryButton, sent && styles.buttonDone]} onPress={() => setSent(true)}><Text style={styles.primaryButtonText}>{sent ? '✓ Presença enviada para aprovação' : '📷 Enviar foto da presença'}</Text></Pressable>
      {sent && <Text style={styles.pendingHint}>Seu diretor receberá a foto e confirmará seu avanço na trilha.</Text>}
    </View>
  );
}

function QuizScreen() {
  const [selected, setSelected] = useState<number | null>(null);
  const options = ['Daniel', 'Josué', 'Moisés', 'Davi'];
  return (
    <View style={styles.pagePad}>
      <View style={styles.quizHeader}>
        <Pill tone="coral">QUESTÃO 1 DE 5</Pill>
        <Text style={styles.quizPoints}>+10 pts</Text>
      </View>
      <Text style={styles.pageTitle}>Quem recebeu de Deus a missão de conduzir o povo após Moisés?</Text>
      <Text style={styles.pageIntro}>Escolha uma alternativa.</Text>
      {options.map((option, index) => (
        <Pressable key={option} style={[styles.option, selected === index && styles.optionSelected]} onPress={() => setSelected(index)}>
          <Text style={[styles.optionLetter, selected === index && styles.optionLetterSelected]}>{String.fromCharCode(65 + index)}</Text>
          <Text style={styles.optionText}>{option}</Text>
        </Pressable>
      ))}
      <Pressable style={[styles.primaryButton, selected === null && styles.buttonDisabled]} disabled={selected === null}>
        <Text style={styles.primaryButtonText}>Confirmar resposta</Text>
      </Pressable>
    </View>
  );
}

function ProfileScreen() {
  const [communityView, setCommunityView] = useState<'hub' | 'ranking' | 'mural' | 'flashcards' | 'desafios' | 'hall' | 'notificacoes'>('hub');
  if (communityView !== 'hub') {
    const content = {
      ranking: { title: 'Rankings', eyebrow: 'PONTUAÇÃO DO TRIMESTRE', copy: 'Classificação normalizada para valorizar participação, não o tamanho da classe.' },
      mural: { title: 'Mural', eyebrow: 'NOSSA COMUNIDADE', copy: 'Conquistas e desafios aprovados da sua turma.' },
      flashcards: { title: 'Flashcards', eyebrow: 'IDEIAS PARA GUARDAR', copy: 'Seus lembretes da lição, Bíblia e livro.' },
      desafios: { title: 'Desafios', eyebrow: 'MISSÃO DO MÊS', copy: 'Participe com toda a sua classe e some pontos.' },
      hall: { title: 'Hall da fama', eyebrow: 'TRIMESTRES ANTERIORES', copy: 'Quem deixou sua marca na história da turma.' },
      notificacoes: { title: 'Notificações', eyebrow: 'FIQUE POR DENTRO', copy: 'Atualizações importantes da sua jornada.' },
    }[communityView];
    return (
      <View style={styles.pagePad}>
        <BackButton onPress={() => setCommunityView('hub')} />
        <Text style={styles.pageEyebrow}>{content.eyebrow}</Text><Text style={styles.pageTitle}>{content.title}</Text><Text style={styles.pageIntro}>{content.copy}</Text>
        {communityView === 'ranking' && <>
          <View style={styles.rankingTabs}><Text style={styles.rankingTabActive}>Classe</Text><Text style={styles.rankingTab}>Distrito</Text><Text style={styles.rankingTab}>Turmas</Text></View>
          {[['1', 'Marina Costa', '510'], ['2', 'João Pedro', '465'], ['3', 'Daniel Oliveira', '420'], ['4', 'Sara Lima', '398'], ['5', 'Lucas Rocha', '372']].map(([place, name, points]) => <View key={place} style={[styles.rankRow, place === '3' && styles.rankRowCurrent]}><Text style={styles.rankPlace}>{place}</Text><View style={styles.rankAvatar}><Text style={styles.rankAvatarText}>{name[0]}</Text></View><Text style={styles.rankName}>{name}</Text><Text style={styles.rankPoints}>{points} pts</Text></View>)}
        </>}
        {communityView === 'mural' && <>
          {[['🏆', 'Marina conquistou “Leitora do mês”', 'Há 2 horas · 12 reações'], ['🔥', 'João completou 6 semanas seguidas', 'Ontem · 8 reações'], ['◆', 'Desafio solidário aprovado!', 'A Base Geração ganhou +100 pontos']].map(([icon, title, copy]) => <View key={title} style={styles.feedCard}><Text style={styles.feedEmoji}>{icon}</Text><View style={styles.flex}><Text style={styles.manageTitle}>{title}</Text><Text style={styles.manageCopy}>{copy}</Text><Text style={styles.reactions}>♥  🙌  ⚡</Text></View></View>)}
        </>}
        {communityView === 'flashcards' && <View style={styles.flashGrid}>{[['A fé cresce quando é exercitada.', '#FFF1A8'], ['Josué 1:9 — coragem não é ausência de medo.', '#CFEDE5'], ['Servir também é uma forma de adorar.', '#FFD9CE'], ['Pergunta para o sábado: como aplicar isso?', '#DCE0FA']].map(([text, bg], index) => <View key={text} style={[styles.flashCard, { backgroundColor: bg, transform: [{ rotate: index % 2 ? '2deg' : '-2deg' }] }]}><Text style={styles.flashLabel}>NOTA {index + 1}</Text><Text style={styles.flashText}>{text}</Text></View>)}</View>}
        {communityView === 'desafios' && <View style={styles.challengeCard}><Pill tone="coral">JULHO · EM ANDAMENTO</Pill><Text style={styles.challengeTitle}>Corrente do bem</Text><Text style={styles.challengeCopy}>Como turma, realizem uma ação de cuidado na comunidade e registrem uma foto.</Text><View style={styles.challengeMeta}><Text style={styles.challengePoints}>+100 pontos</Text><Text style={styles.cardCaption}>Termina em 6 dias</Text></View><Progress value={70} color={colors.coral} /><Text style={styles.challengeStatus}>Evidência enviada pelo diretor · aguardando aprovação</Text></View>}
        {communityView === 'hall' && <>{[['🥇', 'Marina Costa', 'Campeã · Trimestre 2', '1.860 pts'], ['🥈', 'João Pedro', 'Vice-campeão · Trimestre 2', '1.720 pts'], ['🏆', 'Base Geração', 'Classe destaque do distrito', '92%']].map(([icon, name, copy, points]) => <View key={name} style={styles.hallCard}><Text style={styles.hallIcon}>{icon}</Text><View style={styles.flex}><Text style={styles.manageTitle}>{name}</Text><Text style={styles.manageCopy}>{copy}</Text></View><Text style={styles.rankPoints}>{points}</Text></View>)}</>}
        {communityView === 'notificacoes' && <>{[['NOVO', 'A lição 5 já está disponível', 'Comece seu estudo desta semana · agora'], ['QUIZ', 'Quiz liberado!', 'Você tem até domingo para responder · há 2h'], ['NOTA', 'Seu resumo foi avaliado', 'O diretor enviou um retorno privado · ontem'], ['EVENTO', 'Conexão Distrital', '16 de agosto, às 15h · há 2 dias']].map(([tag, title, copy], index) => <View key={title} style={[styles.notificationCard, index === 0 && styles.notificationUnread]}><Text style={styles.notificationTag}>{tag}</Text><View style={styles.flex}><Text style={styles.manageTitle}>{title}</Text><Text style={styles.manageCopy}>{copy}</Text></View>{index === 0 && <View style={styles.unreadDot} />}</View>)}</>}
      </View>
    );
  }
  return (
    <View style={styles.pagePad}>
      <View style={styles.profileTop}>
        <View style={styles.profileAvatar}><Text style={styles.profileAvatarText}>D</Text></View>
        <Text style={styles.profileName}>Daniel Oliveira</Text>
        <Text style={styles.profileClass}>Base Geração · Adolescentes</Text>
        <Text style={styles.profileStatus}>“Vivendo com propósito.”</Text>
      </View>
      <View style={styles.statsRow}>
        <View style={styles.stat}><Text style={styles.statValue}>420</Text><Text style={styles.cardCaption}>pontos</Text></View>
        <View style={styles.stat}><Text style={styles.statValue}>#3</Text><Text style={styles.cardCaption}>na classe</Text></View>
        <View style={styles.stat}><Text style={styles.statValue}>4</Text><Text style={styles.cardCaption}>semanas</Text></View>
      </View>
      <Text style={styles.sectionTitle}>Comunidade</Text>
      <View style={styles.communityGrid}>
        {[
          ['ranking', '🏆', 'Rankings', '#F8E8C8'], ['mural', '◉', 'Mural', '#DCEDE9'], ['flashcards', '▤', 'Flashcards', '#FFF1A8'], ['desafios', '◆', 'Desafios', '#FBE0D6'], ['hall', '★', 'Hall da fama', '#E4E0FA'], ['notificacoes', '●', 'Notificações', '#DCEDE9'],
        ].map(([key, icon, label, bg]) => <Pressable key={key} style={[styles.communityCard, { backgroundColor: bg }]} onPress={() => setCommunityView(key as typeof communityView)}><Text style={styles.communityIcon}>{icon}</Text><Text style={styles.communityLabel}>{label}</Text><Text style={styles.communityLink}>Abrir ›</Text></Pressable>)}
      </View>
      <Text style={styles.sectionTitle}>Conquistas</Text>
      <View style={styles.badgeRow}>
        {['🔥\nConstante', '📖\nLeitor', '⚡\nQuiz 10', '🏔️\nPresente'].map((badge) => (
          <View key={badge} style={styles.badge}><Text style={styles.badgeText}>{badge}</Text></View>
        ))}
      </View>
      <View style={styles.weekCard}>
        <View style={styles.weekRow}><Text style={styles.weekTitle}>Evolução no trimestre</Text><Text style={styles.percent}>+18%</Text></View>
        <Progress value={68} color={colors.coral} />
        <Text style={[styles.cardCaption, { marginTop: 12 }]}>Seu engajamento cresceu nas últimas quatro semanas.</Text>
      </View>
    </View>
  );
}

function MainApp({ onExit }: { onExit: () => void }) {
  const [tab, setTab] = useState<Tab>('Início');
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
          {tab === 'Início' && <HomeScreen onNavigate={setTab} />}
          {tab === 'Estudo' && <StudyScreen />}
          {tab === 'Presença' && <AttendanceScreen />}
          {tab === 'Quiz' && <QuizScreen />}
          {tab === 'Mais' && <ProfileScreen />}
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

  const mapRole = (selectedRole: Role) => selectedRole === 'adolescente' ? 'student' : selectedRole === 'diretor' ? 'director' : selectedRole === 'coordenador' ? 'coordinator' : 'admin';
  const finishRegistration = async (selectedRole: Role) => {
    if (!firebaseEnabled) return onComplete(selectedRole);
    setAuthBusy(true); setAuthError('');
    try {
      await registerUser(name, email, password, mapRole(selectedRole));
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
      onComplete(savedRole === 'director' ? 'diretor' : savedRole === 'coordinator' ? 'coordenador' : savedRole === 'admin' ? 'admin' : 'adolescente');
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'E-mail ou senha inválidos.');
    } finally { setAuthBusy(false); }
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
          <Text style={styles.authCopy}>Isso define a experiência inicial da sua conta.</Text>
          {roles.map((item) => (
            <Pressable key={item.key} style={[styles.roleCard, role === item.key && styles.roleCardActive]} onPress={() => setRole(item.key)}>
              <View style={[styles.roleIcon, role === item.key && styles.roleIconActive]}><Text style={[styles.roleIconText, role === item.key && styles.roleIconTextActive]}>{item.icon}</Text></View>
              <View style={styles.flex}><Text style={styles.roleTitle}>{item.title}</Text><Text style={styles.roleCopy}>{item.copy}</Text></View>
              <View style={[styles.radio, role === item.key && styles.radioActive]}>{role === item.key && <View style={styles.radioDot} />}</View>
            </Pressable>
          ))}
          <Pressable style={styles.authPrimary} disabled={authBusy} onPress={() => role === 'adolescente' ? setStep('invite') : finishRegistration(role)}><Text style={styles.authPrimaryText}>{authBusy ? 'Criando conta...' : 'Continuar'}</Text></Pressable>
          {role !== 'adolescente' && <Text style={styles.approvalHint}>O acesso de liderança ficará pendente até a aprovação responsável.</Text>}
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
          {isLogin && <Pressable><Text style={styles.forgotLink}>Esqueci minha senha</Text></Pressable>}
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

function ManagementDetail({ title, onBack }: { title: string; onBack: () => void }) {
  const [saved, setSaved] = useState(false);
  const [lessonTitle, setLessonTitle] = useState('Escolhas que transformam');
  const [question, setQuestion] = useState('Quem recebeu a missão de conduzir o povo após Moisés?');
  const [approved, setApproved] = useState<string[]>([]);
  const [memberNotice, setMemberNotice] = useState('');
  const toggleApproval = (name: string) => setApproved(items => items.includes(name) ? items.filter(item => item !== name) : [...items, name]);
  const isApproval = title.includes('Aprovar') || title.includes('Avaliar') || title.includes('Validar');
  const isContent = title.includes('Conteúdo');
  const isQuiz = title.includes('Quiz');
  const isReport = title.includes('Relatório');
  const isEvent = title.includes('Encontros');
  const isStructure = title.includes('Classes') || title.includes('Distritos') || title.includes('Igrejas') || title.includes('coordenadores');
  const isRisk = title.includes('Acompanhamento');
  const isMembers = title.includes('membros');

  return (
    <View>
      <BackButton onPress={onBack} />
      <Text style={styles.pageEyebrow}>GESTÃO DA TURMA</Text><Text style={styles.pageTitle}>{title}</Text>
      <Text style={styles.pageIntro}>{isApproval ? 'Analise os itens pendentes e registre sua decisão.' : 'Prepare as informações que ficarão disponíveis para a turma.'}</Text>
      {isContent && <>
        <AuthField label="Título da lição" placeholder="Título da semana" value={lessonTitle} onChangeText={setLessonTitle} />
        <View style={styles.uploadBox}><Text style={styles.uploadIcon}>＋</Text><Text style={styles.uploadTitle}>Adicionar arquivo</Text><Text style={styles.uploadCopy}>PDF da lição ou do livro · até 25 MB</Text></View>
        <View style={styles.scheduleRow}><View><Text style={styles.manageTitle}>Publicar agora</Text><Text style={styles.manageCopy}>A turma receberá uma notificação</Text></View><View style={styles.toggleOn}><View style={styles.toggleKnob} /></View></View>
      </>}
      {isQuiz && <>
        <View style={styles.formCard}><Text style={styles.authLabel}>Pergunta 1</Text><TextInput multiline value={question} onChangeText={setQuestion} style={[styles.authInput, styles.textArea]} />{['Josué', 'Daniel', 'Davi', 'Samuel'].map((option, index) => <View key={option} style={[styles.quizEditOption, index === 0 && styles.quizEditCorrect]}><Text style={styles.optionLetter}>{String.fromCharCode(65 + index)}</Text><Text style={styles.optionText}>{option}</Text>{index === 0 && <Text style={styles.correctLabel}>CORRETA</Text>}</View>)}<Pressable style={styles.addQuestion}><Text style={styles.addQuestionText}>＋ Adicionar pergunta</Text></Pressable></View>
        <View style={styles.scheduleRow}><View><Text style={styles.manageTitle}>Liberar no sábado</Text><Text style={styles.manageCopy}>Abertura automática às 00h</Text></View><View style={styles.toggleOn}><View style={styles.toggleKnob} /></View></View>
      </>}
      {isApproval && <>{[
        ['Marina Costa', title.includes('Presença') ? 'Foto enviada hoje · 09:12' : 'Resumo da lição 4 · 246 palavras'],
        ['João Pedro', title.includes('Presença') ? 'Foto enviada hoje · 09:36' : 'Resumo da Bíblia · Josué 1'],
        ['Sara Lima', title.includes('Presença') ? 'Foto enviada hoje · 10:04' : 'Resumo do livro · capítulo 3'],
      ].map(([name, copy]) => { const done = approved.includes(name); return <View key={name} style={styles.approvalCard}><View style={styles.rankAvatar}><Text style={styles.rankAvatarText}>{name[0]}</Text></View><View style={styles.flex}><Text style={styles.manageTitle}>{name}</Text><Text style={styles.manageCopy}>{copy}</Text></View><Pressable style={[styles.approveButton, done && styles.approveButtonDone]} onPress={() => toggleApproval(name)}><Text style={[styles.approveButtonText, done && styles.approveButtonTextDone]}>{done ? '✓ Aprovado' : 'Aprovar'}</Text></Pressable></View>; })}</>}
      {isReport && <>
        <View style={styles.reportHero}><Text style={styles.reportValue}>82%</Text><View style={styles.flex}><Text style={styles.reportTitle}>Engajamento médio</Text><Text style={styles.reportCopy}>Trimestre 3 · crescimento de 12%</Text></View></View>
        {[['Presença', '78%', 78, colors.tealMedium], ['Estudos', '84%', 84, colors.gold], ['Quiz', '71%', 71, colors.coral], ['Desafios', '92%', 92, '#6C83B8']].map(([label, value, progress, color]) => <View key={label as string} style={styles.reportRow}><View style={styles.reportRowTop}><Text style={styles.manageTitle}>{label}</Text><Text style={styles.reportPercent}>{value}</Text></View><Progress value={progress as number} color={color as string} /></View>)}
        <Pressable style={styles.exportButton}><Text style={styles.exportButtonText}>⇩ Exportar relatório em PDF</Text></Pressable>
      </>}
      {isEvent && <>
        <View style={styles.eventCard}><View style={styles.eventDate}><Text style={styles.eventDay}>16</Text><Text style={styles.eventMonth}>AGO</Text></View><View style={styles.flex}><Text style={styles.eventTitle}>Conexão Distrital</Text><Text style={styles.eventCopy}>IASD Central · 15h às 18h</Text><Text style={styles.eventPeople}>186 participantes confirmados</Text></View></View>
        <View style={styles.formCard}><AuthField label="Nome do encontro" placeholder="Ex.: Conexão Distrital" value={lessonTitle} onChangeText={setLessonTitle} /><AuthField label="Local" placeholder="Igreja ou endereço" value="IASD Central" onChangeText={() => {}} /><Pressable style={styles.addQuestion}><Text style={styles.addQuestionText}>＋ Criar novo encontro</Text></Pressable></View>
      </>}
      {isStructure && <>
        <View style={styles.searchBox}><Text style={styles.searchIcon}>⌕</Text><Text style={styles.searchPlaceholder}>Buscar distrito, igreja ou classe</Text></View>
        {[
          ['Salvador Centro', '12 classes · 286 membros', '82%'], ['Salvador Norte', '9 classes · 214 membros', '76%'], ['Litoral', '7 classes · 168 membros', '88%'], ['Metropolitano', '11 classes · 241 membros', '71%'],
        ].map(([name, copy, percent]) => <Pressable key={name} style={styles.structureCard}><View style={styles.structureIcon}><Text style={styles.structureIconText}>⌂</Text></View><View style={styles.flex}><Text style={styles.manageTitle}>{name}</Text><Text style={styles.manageCopy}>{copy}</Text></View><Text style={styles.structurePercent}>{percent}</Text><Text style={styles.chevron}>›</Text></Pressable>)}
        <Pressable style={styles.outlineButton}><Text style={styles.outlineButtonText}>＋ Adicionar novo cadastro</Text></Pressable>
      </>}
      {isRisk && <>{[
        ['Lucas Rocha', 'Sem presença há 3 semanas', 'ALTO', colors.coral], ['Beatriz Souza', 'Sem estudo há 2 semanas', 'MÉDIO', colors.gold], ['Rafael Lima', 'Queda de 35% no engajamento', 'MÉDIO', colors.gold],
      ].map(([name, copy, level, color]) => <View key={name} style={styles.riskCard}><View style={[styles.riskLine, { backgroundColor: color }]} /><View style={styles.rankAvatar}><Text style={styles.rankAvatarText}>{name[0]}</Text></View><View style={styles.flex}><Text style={styles.manageTitle}>{name}</Text><Text style={styles.manageCopy}>{copy}</Text></View><View><Text style={[styles.riskLevel, { color }]}>{level}</Text><Pressable onPress={() => setMemberNotice(`Lembrete preparado para ${name}`)}><Text style={styles.contactLink}>Lembrar</Text></Pressable></View></View>)}</>}
      {memberNotice !== '' && <Text style={styles.successNotice}>✓ {memberNotice}</Text>}
      {!isContent && !isQuiz && !isApproval && !isReport && !isEvent && !isStructure && !isRisk && <>
        <View style={styles.inviteCodeCard}><Text style={styles.authEyebrow}>CÓDIGO ATUAL</Text><Text style={styles.inviteCode}>VIVA-7429</Text><Text style={styles.cardCaption}>Compartilhe somente com os membros da turma.</Text><Pressable style={styles.copyButton}><Text style={styles.copyButtonText}>Copiar código</Text></Pressable></View>
        {['Marina Costa', 'João Pedro', 'Daniel Oliveira', 'Sara Lima'].map((name, index) => <View key={name} style={styles.memberRow}><View style={styles.rankAvatar}><Text style={styles.rankAvatarText}>{name[0]}</Text></View><View style={styles.flex}><Text style={styles.manageTitle}>{name}</Text><Text style={styles.manageCopy}>{index === 0 ? 'Diretora auxiliar' : 'Membro ativo'}</Text></View><Pressable onPress={() => setMemberNotice(`Ações abertas para ${name}`)}><Text style={styles.memberMenu}>•••</Text></Pressable></View>)}
        {isMembers && <View style={styles.memberActions}><Pressable style={styles.memberActionButton} onPress={() => setMemberNotice('Transferência de liderança preparada')}><Text style={styles.memberActionText}>⇄ Transferir liderança</Text></Pressable><Pressable style={styles.memberDangerButton} onPress={() => setMemberNotice('Acesso selecionado para revogação')}><Text style={styles.memberDangerText}>Revogar acesso</Text></Pressable></View>}
      </>}
      {!isApproval && !isReport && !isStructure && <Pressable style={[styles.authPrimary, saved && styles.buttonDone]} onPress={() => setSaved(true)}><Text style={styles.authPrimaryText}>{saved ? '✓ Alterações salvas' : isQuiz ? 'Salvar quiz' : isContent ? 'Publicar conteúdo' : isEvent ? 'Salvar encontro' : 'Salvar alterações'}</Text></Pressable>}
    </View>
  );
}

function ManagementApp({ role, onExit }: { role: Exclude<Role, 'adolescente'>; onExit: () => void }) {
  const [section, setSection] = useState<'painel' | 'gestao' | 'atividade' | 'perfil'>('painel');
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const roleName = role === 'diretor' ? 'Diretor de classe' : role === 'coordenador' ? 'Coordenador distrital' : 'Administrador geral';
  const scope = role === 'diretor' ? 'Base Geração · Adolescentes' : role === 'coordenador' ? 'Distrito Salvador Centro' : 'Visão geral do projeto';
  const metrics = role === 'diretor'
    ? [['24', 'membros ativos', colors.tealMedium], ['82%', 'engajamento', colors.gold], ['3', 'pendências', colors.coral]]
    : role === 'coordenador'
      ? [['12', 'classes', colors.tealMedium], ['286', 'adolescentes', colors.gold], ['5', 'aprovações', colors.coral]]
      : [['8', 'distritos', colors.tealMedium], ['47', 'classes', colors.gold], ['1.124', 'membros', colors.coral]];
  const actions = role === 'diretor'
    ? [
      ['▤', 'Conteúdo semanal', 'Publicar lição e livro por turma', 'NOVO'],
      ['?', 'Quiz semanal', 'Criar perguntas e programar liberação', 'RASCUNHO'],
      ['✓', 'Avaliar resumos', 'Notas privadas dos adolescentes', '7'],
      ['⚑', 'Aprovar presenças', 'Validar fotos enviadas na igreja', '3'],
      ['◉', 'Acompanhamento e risco', 'Identificar queda de participação', '3'],
      ['✦', 'Flashcards publicados', 'Moderar cards enviados pela turma', '4'],
      ['◆', 'Desafio mensal', 'Publicar evidência para o distrito', ''],
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
          <View style={styles.managementTop}><View><Text style={styles.eyebrowLight}>{roleName.toUpperCase()}</Text><Text style={styles.managementGreeting}>Olá, Albert</Text></View><Pressable style={styles.avatar} onLongPress={onExit}><Text style={styles.avatarText}>A</Text></Pressable></View>
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
          {section === 'gestao' && (selectedAction ? <ManagementDetail title={selectedAction} onBack={() => setSelectedAction(null)} /> : <><Text style={styles.pageEyebrow}>FERRAMENTAS</Text><Text style={styles.pageTitle}>Gestão</Text><Text style={styles.pageIntro}>Tudo que você precisa para acompanhar seu ministério.</Text>{actions.map(([icon, title, copy, badge]) => <ActionRow key={title} icon={icon} title={title} copy={copy} badge={badge || undefined} onPress={() => setSelectedAction(title)} />)}{role === 'diretor' && <ActionRow icon="♙" title="Gerenciar membros" copy="Convite, lista, transferências e acessos" onPress={() => setSelectedAction('Gerenciar membros')} />}</>)}
          {section === 'atividade' && <><Text style={styles.pageEyebrow}>ÚLTIMAS ATUALIZAÇÕES</Text><Text style={styles.pageTitle}>Atividade</Text><Text style={styles.pageIntro}>Acompanhe o que aconteceu recentemente.</Text>{[
            ['✓', 'Presença aprovada', 'Daniel avançou para a semana 7 · há 12 min'],
            ['★', 'Nova conquista', 'Marina completou 4 semanas de estudo · há 1h'],
            ['◆', 'Desafio enviado', 'Evidência do desafio de julho · ontem'],
            ['▤', 'Resumo recebido', '7 novos resumos aguardam avaliação · ontem'],
          ].map(([icon, title, copy]) => <ActionRow key={title} icon={icon} title={title} copy={copy} />)}</>}
          {section === 'perfil' && <><View style={styles.profileTop}><View style={styles.profileAvatar}><Text style={styles.profileAvatarText}>A</Text></View><Text style={styles.profileName}>Albert Santos</Text><Text style={styles.profileClass}>{roleName}</Text><Text style={styles.profileStatus}>{scope}</Text></View><ActionRow icon="⚙" title="Configurações" copy="Conta, notificações e privacidade" /><ActionRow icon="?" title="Ajuda" copy="Orientações sobre o aplicativo" /><Pressable style={styles.signOutButton} onPress={onExit}><Text style={styles.signOutText}>Sair do protótipo</Text></Pressable></>}
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
  if (!activeRole) return <AuthFlow onComplete={setActiveRole} />;
  if (activeRole === 'adolescente') return <MainApp onExit={() => setActiveRole(null)} />;
  return <ManagementApp role={activeRole} onExit={() => setActiveRole(null)} />;
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
  roleCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: 18, borderWidth: 2, borderColor: 'transparent', padding: 14, marginBottom: 10 }, roleCardActive: { borderColor: colors.coral, backgroundColor: '#FFF8F5' }, roleIcon: { width: 46, height: 46, borderRadius: 14, backgroundColor: '#E4ECE8', alignItems: 'center', justifyContent: 'center', marginRight: 12 }, roleIconActive: { backgroundColor: colors.coral }, roleIconText: { color: colors.teal, fontSize: 18, fontWeight: '900' }, roleIconTextActive: { color: colors.white }, roleTitle: { color: colors.ink, fontSize: 14, fontWeight: '900' }, roleCopy: { color: colors.muted, fontSize: 10, lineHeight: 14, marginTop: 3, maxWidth: 250 }, radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#B4C1BC', alignItems: 'center', justifyContent: 'center', marginLeft: 8 }, radioActive: { borderColor: colors.coral }, radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.coral }, approvalHint: { color: colors.muted, fontSize: 10, lineHeight: 15, textAlign: 'center', marginTop: 12 },
  inviteIllustration: { width: 80, height: 80, borderRadius: 25, backgroundColor: '#DCEDE9', alignItems: 'center', justifyContent: 'center', marginBottom: 23 }, inviteIllustrationText: { color: colors.tealMedium, fontSize: 44, fontWeight: '900' }, classFound: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#DCEDE9', borderRadius: 16, padding: 14, marginTop: -4, marginBottom: 10 }, classFoundIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center', marginRight: 11 }, classFoundTitle: { color: colors.teal, fontSize: 14, fontWeight: '900' }, classFoundCopy: { color: colors.muted, fontSize: 10, marginTop: 2 }, skipLink: { color: colors.tealMedium, fontSize: 12, fontWeight: '800', textAlign: 'center', marginTop: 21 },
  managementHero: { backgroundColor: colors.teal, padding: 22, paddingBottom: 28, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 }, managementTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, managementGreeting: { color: colors.white, fontSize: 26, fontWeight: '900', marginTop: 3 }, managementScope: { color: '#BFD2CD', fontSize: 13, marginTop: 18 }, classSelector: { alignSelf: 'flex-start', backgroundColor: colors.tealMedium, borderWidth: 1, borderColor: '#43736E', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, marginTop: 13 }, classSelectorText: { color: colors.white, fontSize: 11, fontWeight: '800' }, managementContent: { padding: 20, paddingBottom: 30 },
  metricsGrid: { flexDirection: 'row', gap: 9, marginTop: 13, marginBottom: 18 }, metricCard: { flex: 1, minHeight: 95, backgroundColor: colors.white, borderRadius: 16, borderTopWidth: 4, padding: 12, justifyContent: 'center' }, metricValue: { color: colors.teal, fontSize: 23, fontWeight: '900' }, metricLabel: { color: colors.muted, fontSize: 9, lineHeight: 13, marginTop: 4 },
  alertCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FBE4DA', borderRadius: 17, padding: 14 }, alertDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.coral, marginRight: 12 }, alertTitle: { color: '#9A3D23', fontSize: 12, fontWeight: '900' }, alertCopy: { color: '#805343', fontSize: 10, lineHeight: 15, marginTop: 3 }, sectionHeaderManagement: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, marginBottom: 12 }, seeAll: { color: colors.coral, fontSize: 11, fontWeight: '900' },
  performanceCard: { backgroundColor: colors.white, borderRadius: 19, padding: 16 }, performanceTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, performanceUp: { color: colors.tealMedium, fontSize: 12, fontWeight: '900' }, barChart: { height: 105, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', marginTop: 17, borderBottomWidth: 1, borderBottomColor: colors.line }, chartBar: { width: 20, backgroundColor: '#BFD2CD', borderTopLeftRadius: 5, borderTopRightRadius: 5 }, chartBarActive: { backgroundColor: colors.gold }, chartLabels: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 7 }, chartLabel: { color: colors.muted, fontSize: 8 },
  manageRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: 17, padding: 13, marginBottom: 10 }, manageIcon: { width: 43, height: 43, borderRadius: 13, backgroundColor: '#DCEDE9', alignItems: 'center', justifyContent: 'center', marginRight: 12 }, manageIconText: { color: colors.teal, fontSize: 17, fontWeight: '900' }, manageTitle: { color: colors.ink, fontSize: 13, fontWeight: '900' }, manageCopy: { color: colors.muted, fontSize: 9, lineHeight: 14, marginTop: 3 }, manageBadge: { backgroundColor: '#FBE0D6', color: colors.coral, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 9, overflow: 'hidden', fontSize: 8, fontWeight: '900' }, signOutButton: { minHeight: 52, borderRadius: 16, borderWidth: 1, borderColor: '#D6A28E', alignItems: 'center', justifyContent: 'center', marginTop: 15 }, signOutText: { color: colors.coral, fontSize: 13, fontWeight: '900' },
  communityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12, marginBottom: 24 }, communityCard: { width: '48%', minHeight: 116, borderRadius: 18, padding: 14 }, communityIcon: { color: colors.teal, fontSize: 20, fontWeight: '900' }, communityLabel: { color: colors.ink, fontSize: 14, fontWeight: '900', marginTop: 12 }, communityLink: { color: colors.tealMedium, fontSize: 10, fontWeight: '800', marginTop: 6 },
  rankingTabs: { flexDirection: 'row', backgroundColor: '#E1E9E4', borderRadius: 14, padding: 4, marginBottom: 13 }, rankingTab: { flex: 1, textAlign: 'center', color: colors.muted, fontSize: 10, fontWeight: '800', paddingVertical: 9 }, rankingTabActive: { flex: 1, textAlign: 'center', color: colors.white, backgroundColor: colors.tealMedium, borderRadius: 10, overflow: 'hidden', fontSize: 10, fontWeight: '900', paddingVertical: 9 }, rankRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: 16, padding: 12, marginBottom: 8 }, rankRowCurrent: { borderWidth: 2, borderColor: colors.gold, backgroundColor: '#FFF9EC' }, rankPlace: { width: 28, color: colors.teal, fontSize: 16, fontWeight: '900' }, rankAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#DCEDE9', alignItems: 'center', justifyContent: 'center', marginRight: 10 }, rankAvatarText: { color: colors.teal, fontWeight: '900' }, rankName: { flex: 1, color: colors.ink, fontSize: 12, fontWeight: '800' }, rankPoints: { color: '#9A6815', fontSize: 11, fontWeight: '900' },
  feedCard: { flexDirection: 'row', backgroundColor: colors.white, borderRadius: 18, padding: 15, marginBottom: 11 }, feedEmoji: { width: 42, fontSize: 25 }, reactions: { color: colors.coral, fontSize: 12, marginTop: 12, letterSpacing: 5 }, flashGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, flashCard: { width: '47%', minHeight: 150, borderRadius: 4, padding: 15, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } }, flashLabel: { color: colors.muted, fontSize: 8, fontWeight: '900', letterSpacing: 1 }, flashText: { color: colors.ink, fontSize: 13, lineHeight: 20, fontWeight: '700', marginTop: 12 },
  challengeCard: { backgroundColor: colors.white, borderRadius: 22, padding: 18 }, challengeTitle: { color: colors.ink, fontSize: 23, fontWeight: '900', marginTop: 17 }, challengeCopy: { color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: 8 }, challengeMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 22, marginBottom: 8 }, challengePoints: { color: colors.coral, fontSize: 13, fontWeight: '900' }, challengeStatus: { color: colors.tealMedium, backgroundColor: '#DCEDE9', borderRadius: 12, overflow: 'hidden', padding: 11, fontSize: 9, fontWeight: '800', marginTop: 13 },
  hallCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: 17, padding: 14, marginBottom: 10, borderLeftWidth: 4, borderLeftColor: colors.gold }, hallIcon: { width: 43, fontSize: 25 }, notificationCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: 17, padding: 14, marginBottom: 9 }, notificationUnread: { backgroundColor: '#FFF8E9', borderWidth: 1, borderColor: '#EED49D' }, notificationTag: { color: colors.coral, backgroundColor: '#FBE0D6', borderRadius: 9, overflow: 'hidden', paddingHorizontal: 7, paddingVertical: 5, fontSize: 7, fontWeight: '900', marginRight: 10 }, unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.coral, marginLeft: 8 },
  uploadBox: { minHeight: 130, borderRadius: 18, borderWidth: 2, borderStyle: 'dashed', borderColor: '#B9C9C2', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F6F8F5', marginBottom: 15 }, uploadIcon: { color: colors.coral, fontSize: 28, fontWeight: '600' }, uploadTitle: { color: colors.ink, fontSize: 13, fontWeight: '900', marginTop: 4 }, uploadCopy: { color: colors.muted, fontSize: 9, marginTop: 4 }, scheduleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.white, borderRadius: 17, padding: 15, marginBottom: 11 }, toggleOn: { width: 44, height: 25, borderRadius: 13, backgroundColor: colors.tealMedium, padding: 3, alignItems: 'flex-end' }, toggleKnob: { width: 19, height: 19, borderRadius: 10, backgroundColor: colors.white }, formCard: { backgroundColor: colors.white, borderRadius: 18, padding: 15, marginBottom: 12 }, textArea: { height: 82, paddingTop: 13, textAlignVertical: 'top', marginBottom: 12 }, quizEditOption: { minHeight: 49, flexDirection: 'row', alignItems: 'center', borderRadius: 13, backgroundColor: colors.sage, padding: 7, marginBottom: 7, borderWidth: 1, borderColor: 'transparent' }, quizEditCorrect: { backgroundColor: '#E1F0E9', borderColor: colors.tealMedium }, correctLabel: { color: colors.tealMedium, fontSize: 8, fontWeight: '900', marginLeft: 'auto', marginRight: 7 }, addQuestion: { minHeight: 43, alignItems: 'center', justifyContent: 'center', marginTop: 5 }, addQuestionText: { color: colors.coral, fontSize: 11, fontWeight: '900' }, approvalCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: 17, padding: 12, marginBottom: 9 }, approveButton: { backgroundColor: '#FBE0D6', borderRadius: 11, paddingHorizontal: 10, paddingVertical: 8 }, approveButtonDone: { backgroundColor: '#DCEDE9' }, approveButtonText: { color: colors.coral, fontSize: 9, fontWeight: '900' }, approveButtonTextDone: { color: colors.tealMedium }, inviteCodeCard: { backgroundColor: colors.teal, borderRadius: 20, padding: 18, marginBottom: 14 }, inviteCode: { color: colors.gold, fontSize: 28, fontWeight: '900', letterSpacing: 3, marginVertical: 12 }, copyButton: { alignSelf: 'flex-start', backgroundColor: colors.white, borderRadius: 11, paddingHorizontal: 12, paddingVertical: 8, marginTop: 13 }, copyButtonText: { color: colors.teal, fontSize: 10, fontWeight: '900' }, memberRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: 15, padding: 11, marginBottom: 8 },
  reportHero: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.teal, borderRadius: 20, padding: 18, marginBottom: 13 }, reportValue: { color: colors.gold, fontSize: 31, fontWeight: '900', marginRight: 17 }, reportTitle: { color: colors.white, fontSize: 13, fontWeight: '900' }, reportCopy: { color: '#BFD2CD', fontSize: 9, marginTop: 4 }, reportRow: { backgroundColor: colors.white, borderRadius: 15, padding: 14, marginBottom: 8 }, reportRowTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }, reportPercent: { color: colors.teal, fontSize: 12, fontWeight: '900' }, exportButton: { minHeight: 52, borderRadius: 16, backgroundColor: colors.coral, alignItems: 'center', justifyContent: 'center', marginTop: 10 }, exportButtonText: { color: colors.white, fontSize: 12, fontWeight: '900' },
  eventCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.teal, borderRadius: 20, padding: 16, marginBottom: 14 }, eventDate: { width: 58, height: 65, borderRadius: 15, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center', marginRight: 14 }, eventDay: { color: colors.teal, fontSize: 25, fontWeight: '900' }, eventMonth: { color: colors.teal, fontSize: 9, fontWeight: '900' }, eventTitle: { color: colors.white, fontSize: 15, fontWeight: '900' }, eventCopy: { color: '#BFD2CD', fontSize: 10, marginTop: 4 }, eventPeople: { color: colors.gold, fontSize: 9, fontWeight: '800', marginTop: 8 },
  searchBox: { height: 50, borderRadius: 15, backgroundColor: colors.white, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, marginBottom: 12 }, searchIcon: { color: colors.teal, fontSize: 20, marginRight: 10 }, searchPlaceholder: { color: '#8A9892', fontSize: 11 }, structureCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: 17, padding: 12, marginBottom: 9 }, structureIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#DCEDE9', alignItems: 'center', justifyContent: 'center', marginRight: 11 }, structureIconText: { color: colors.teal, fontSize: 17, fontWeight: '900' }, structurePercent: { color: colors.tealMedium, fontSize: 11, fontWeight: '900' }, outlineButton: { minHeight: 50, borderRadius: 16, borderWidth: 1, borderColor: colors.coral, alignItems: 'center', justifyContent: 'center', marginTop: 8 }, outlineButtonText: { color: colors.coral, fontSize: 11, fontWeight: '900' },
  riskCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: 17, padding: 12, marginBottom: 9, overflow: 'hidden' }, riskLine: { width: 4, alignSelf: 'stretch', borderRadius: 3, marginRight: 10 }, riskLevel: { fontSize: 8, fontWeight: '900', textAlign: 'right' }, contactLink: { color: colors.tealMedium, fontSize: 9, fontWeight: '900', marginTop: 7 }, successNotice: { color: colors.tealMedium, backgroundColor: '#DCEDE9', borderRadius: 13, overflow: 'hidden', padding: 11, textAlign: 'center', fontSize: 9, fontWeight: '800', marginBottom: 10 }, memberMenu: { color: colors.teal, fontSize: 16, fontWeight: '900', padding: 8 }, memberActions: { flexDirection: 'row', gap: 8, marginTop: 6 }, memberActionButton: { flex: 1, minHeight: 44, borderRadius: 13, backgroundColor: '#DCEDE9', alignItems: 'center', justifyContent: 'center' }, memberActionText: { color: colors.teal, fontSize: 9, fontWeight: '900' }, memberDangerButton: { flex: 1, minHeight: 44, borderRadius: 13, backgroundColor: '#FBE0D6', alignItems: 'center', justifyContent: 'center' }, memberDangerText: { color: colors.coral, fontSize: 9, fontWeight: '900' },
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
  checkpoint: { position: 'absolute', width: 34, height: 34, borderRadius: 17, backgroundColor: colors.white, borderWidth: 3, borderColor: '#B8CFC7', alignItems: 'center', justifyContent: 'center' }, currentCheckpoint: { width: 46, height: 46, borderRadius: 23, marginLeft: -6, marginTop: -6, backgroundColor: colors.coral, borderColor: colors.white, shadowOpacity: 0.18, shadowRadius: 8 }, checkpointText: { fontSize: 11, fontWeight: '900', color: colors.teal },
  statsRow: { flexDirection: 'row', backgroundColor: colors.white, borderRadius: 18, paddingVertical: 16, marginBottom: 22 }, stat: { flex: 1, alignItems: 'center', borderRightWidth: 1, borderRightColor: colors.line }, statValue: { color: colors.teal, fontSize: 20, fontWeight: '900', marginBottom: 3 },
  quizHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }, quizPoints: { color: '#A36B0A', fontWeight: '900' },
  option: { minHeight: 62, borderRadius: 17, padding: 12, backgroundColor: colors.white, flexDirection: 'row', alignItems: 'center', marginBottom: 10, borderWidth: 2, borderColor: 'transparent' }, optionSelected: { borderColor: colors.coral, backgroundColor: '#FFF7F4' }, optionLetter: { width: 37, height: 37, borderRadius: 12, backgroundColor: colors.sage, color: colors.teal, textAlign: 'center', lineHeight: 37, fontWeight: '900', marginRight: 13 }, optionLetterSelected: { backgroundColor: colors.coral, color: colors.white }, optionText: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  profileTop: { alignItems: 'center', paddingVertical: 15 }, profileAvatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.gold, borderWidth: 5, borderColor: '#F7E3BA', alignItems: 'center', justifyContent: 'center' }, profileAvatarText: { color: colors.teal, fontSize: 36, fontWeight: '900' }, profileName: { color: colors.ink, fontSize: 24, fontWeight: '900', marginTop: 12 }, profileClass: { color: colors.coral, fontWeight: '800', marginTop: 4, fontSize: 12 }, profileStatus: { color: colors.muted, marginTop: 10, fontStyle: 'italic' },
  badgeRow: { flexDirection: 'row', gap: 8, marginTop: 12, marginBottom: 24 }, badge: { flex: 1, aspectRatio: 0.85, borderRadius: 17, backgroundColor: '#F8E8C8', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#EED49D' }, badgeText: { textAlign: 'center', color: colors.teal, fontSize: 11, lineHeight: 20, fontWeight: '800' },
  nav: { height: 76, backgroundColor: colors.white, flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 8, paddingBottom: 5 },
  navItem: { flex: 1, alignItems: 'center' }, navIconWrap: { width: 34, height: 30, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, navIconActive: { backgroundColor: '#DCEDE9' }, navIcon: { color: '#81908A', fontSize: 17, fontWeight: '900' }, navIconTextActive: { color: colors.teal }, navLabel: { color: '#81908A', fontSize: 9, fontWeight: '700', marginTop: 3 }, navLabelActive: { color: colors.teal, fontWeight: '900' },
});
