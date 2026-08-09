import { createUserWithEmailAndPassword, onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signOut, User } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, cloudFunctions, db } from '../config/firebase';
import { httpsCallable } from 'firebase/functions';
import type { UserRole } from '../domain/models';
import { validateCoordinatorInvite } from './coordinatorInvites';

const requireFirebase = () => {
  if (!auth || !db) throw new Error('Firebase ainda não foi configurado. Preencha o arquivo .env.');
  return { auth, db };
};

export async function registerUser(name: string, email: string, password: string, role: UserRole, scope: { districtId?: string; classId?: string; inviteCode?: string } = {}) {
  if (role === 'admin') throw new Error('Administradores são cadastrados diretamente no painel seguro do projeto.');
  const services = requireFirebase();
  const coordinatorInvite = role === 'coordinator' ? await validateCoordinatorInvite(scope.inviteCode ?? '') : null;
  const credential = await createUserWithEmailAndPassword(services.auth, email, password);
  await setDoc(doc(services.db, 'users', credential.user.uid), {
    name,
    email: email.toLowerCase(),
    role: 'student',
    classIds: [],
    active: true,
    createdAt: serverTimestamp(),
  });
  if (role !== 'student') {
    await setDoc(doc(services.db, 'roleRequests', credential.user.uid), {
      userId: credential.user.uid,
      name,
      requestedRole: role,
      districtId: coordinatorInvite?.districtId ?? scope.districtId ?? null,
      classId: scope.classId ?? null,
      inviteCode: coordinatorInvite?.code ?? null,
      status: 'pending',
      createdAt: serverTimestamp(),
    });
  }
  return credential.user;
}

export interface RegistrationOptions {
  districts: Array<{ id: string; name: string }>;
  churches: Array<{ id: string; districtId: string; name: string }>;
  classes: Array<{ id: string; districtId: string; churchId: string; name: string; ageGroup: string }>;
}

export async function getRegistrationOptions() {
  if (!cloudFunctions) return { districts: [], churches: [], classes: [] } as RegistrationOptions;
  const callable = httpsCallable<Record<string, never>, RegistrationOptions>(cloudFunctions, 'getRegistrationOptions');
  return (await callable({})).data;
}

export async function loginUser(email: string, password: string) {
  const services = requireFirebase();
  return (await signInWithEmailAndPassword(services.auth, email, password)).user;
}

export async function logoutUser() {
  const services = requireFirebase();
  await signOut(services.auth);
}

export async function resetUserPassword(email: string) {
  const services = requireFirebase();
  await sendPasswordResetEmail(services.auth, email.trim().toLowerCase());
}

export function subscribeToAuth(callback: (user: User | null) => void) {
  if (!auth) return () => undefined;
  return onAuthStateChanged(auth, callback);
}

export async function getUserRole(userId: string): Promise<UserRole> {
  const services = requireFirebase();
  const snapshot = await getDoc(doc(services.db, 'users', userId));
  return (snapshot.data()?.role as UserRole | undefined) ?? 'student';
}
