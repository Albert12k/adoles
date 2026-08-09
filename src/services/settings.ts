import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

export interface LeadershipSettings {
  name: string;
  email: string;
  quizReminders: boolean;
  attendanceReminders: boolean;
  eventReminders: boolean;
  quietStart: string;
  quietEnd: string;
}

export async function getLeadershipSettings(): Promise<LeadershipSettings> {
  if (!db || !auth?.currentUser) throw new Error('Entre novamente para abrir as configurações.');
  const profile = (await getDoc(doc(db, 'users', auth.currentUser.uid))).data();
  const preferences = profile?.notificationPreferences ?? {};
  const quietHours = profile?.quietHours ?? {};
  return { name: String(profile?.name ?? ''), email: String(profile?.email ?? auth.currentUser.email ?? ''), quizReminders: preferences.quiz !== false, attendanceReminders: preferences.attendance !== false, eventReminders: preferences.events !== false, quietStart: String(quietHours.start ?? '22:00'), quietEnd: String(quietHours.end ?? '07:00') };
}

export async function saveLeadershipSettings(settings: LeadershipSettings) {
  if (!db || !auth?.currentUser) throw new Error('Entre novamente para salvar as configurações.');
  if (settings.name.trim().length < 2) throw new Error('Informe um nome com pelo menos duas letras.');
  const hourPattern = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (!hourPattern.test(settings.quietStart) || !hourPattern.test(settings.quietEnd)) throw new Error('Use o horário no formato 22:00 ou 07:00.');
  await updateDoc(doc(db, 'users', auth.currentUser.uid), { name: settings.name.trim(), notificationPreferences: { quiz: settings.quizReminders, attendance: settings.attendanceReminders, events: settings.eventReminders }, quietHours: { start: settings.quietStart, end: settings.quietEnd, timezone: 'America/Bahia' }, settingsUpdatedAt: serverTimestamp() });
}

export async function requestAccountDeletion(reason = '') {
  if (!db || !auth?.currentUser) throw new Error('Entre novamente para solicitar a exclusão.');
  const profile = await getDoc(doc(db, 'users', auth.currentUser.uid));
  await setDoc(doc(db, 'accountDeletionRequests', auth.currentUser.uid), { userId: auth.currentUser.uid, name: profile.data()?.name ?? '', email: profile.data()?.email ?? auth.currentUser.email ?? '', role: profile.data()?.role ?? 'student', reason: reason.trim().slice(0, 300), status: 'pending', requestedAt: serverTimestamp() }, { merge: true });
}

export async function getAccountDeletionRequest() {
  if (!db || !auth?.currentUser) return null;
  const result = await getDoc(doc(db, 'accountDeletionRequests', auth.currentUser.uid));
  return result.exists() ? { status: String(result.data().status ?? 'pending') } : null;
}
