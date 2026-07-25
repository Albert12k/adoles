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

type Tab = 'Início' | 'Estudo' | 'Presença' | 'Quiz' | 'Perfil';
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
  { label: 'Perfil', icon: '●' },
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
      <Pressable style={[styles.primaryButton, completed && styles.buttonDone]} onPress={() => setCompleted(!completed)}>
        <Text style={styles.primaryButtonText}>{completed ? '✓ Estudo registrado' : 'Registrar estudo de hoje'}</Text>
      </Pressable>
    </View>
  );
}

function AttendanceScreen() {
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
          {tab === 'Perfil' && <ProfileScreen />}
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

function AuthFlow({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState<AuthStep>('welcome');
  const [role, setRole] = useState<Role>('adolescente');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [invite, setInvite] = useState('');
  const [inviteState, setInviteState] = useState<'idle' | 'valid'>('idle');

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
          <Pressable style={styles.authPrimary} onPress={() => role === 'adolescente' ? setStep('invite') : onComplete()}><Text style={styles.authPrimaryText}>Continuar</Text></Pressable>
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
              <Pressable style={styles.authPrimary} onPress={onComplete}><Text style={styles.authPrimaryText}>Entrar na Base Geração</Text></Pressable>
            )}
            <Pressable onPress={onComplete}><Text style={styles.skipLink}>Ainda não tenho um código</Text></Pressable>
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
            onPress={() => isLogin ? onComplete() : setStep('role')}
          >
            <Text style={styles.authPrimaryText}>{isLogin ? 'Entrar' : 'Continuar'}</Text>
          </Pressable>
          <Pressable onPress={() => setStep(isLogin ? 'register' : 'login')}><Text style={styles.authSwitch}>{isLogin ? 'Ainda não tem conta? ' : 'Já tem uma conta? '}<Text style={styles.authSwitchStrong}>{isLogin ? 'Cadastre-se' : 'Entrar'}</Text></Text></Pressable>
          <View style={styles.demoBox}><Text style={styles.demoText}>Protótipo: use qualquer e-mail e uma senha com 6 caracteres.</Text></View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export default function App() {
  const [authenticated, setAuthenticated] = useState(false);
  return authenticated ? <MainApp onExit={() => setAuthenticated(false)} /> : <AuthFlow onComplete={() => setAuthenticated(true)} />;
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
  roleCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: 18, borderWidth: 2, borderColor: 'transparent', padding: 14, marginBottom: 10 }, roleCardActive: { borderColor: colors.coral, backgroundColor: '#FFF8F5' }, roleIcon: { width: 46, height: 46, borderRadius: 14, backgroundColor: '#E4ECE8', alignItems: 'center', justifyContent: 'center', marginRight: 12 }, roleIconActive: { backgroundColor: colors.coral }, roleIconText: { color: colors.teal, fontSize: 18, fontWeight: '900' }, roleIconTextActive: { color: colors.white }, roleTitle: { color: colors.ink, fontSize: 14, fontWeight: '900' }, roleCopy: { color: colors.muted, fontSize: 10, lineHeight: 14, marginTop: 3, maxWidth: 250 }, radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#B4C1BC', alignItems: 'center', justifyContent: 'center', marginLeft: 8 }, radioActive: { borderColor: colors.coral }, radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.coral }, approvalHint: { color: colors.muted, fontSize: 10, lineHeight: 15, textAlign: 'center', marginTop: 12 },
  inviteIllustration: { width: 80, height: 80, borderRadius: 25, backgroundColor: '#DCEDE9', alignItems: 'center', justifyContent: 'center', marginBottom: 23 }, inviteIllustrationText: { color: colors.tealMedium, fontSize: 44, fontWeight: '900' }, classFound: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#DCEDE9', borderRadius: 16, padding: 14, marginTop: -4, marginBottom: 10 }, classFoundIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center', marginRight: 11 }, classFoundTitle: { color: colors.teal, fontSize: 14, fontWeight: '900' }, classFoundCopy: { color: colors.muted, fontSize: 10, marginTop: 2 }, skipLink: { color: colors.tealMedium, fontSize: 12, fontWeight: '800', textAlign: 'center', marginTop: 21 },
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
