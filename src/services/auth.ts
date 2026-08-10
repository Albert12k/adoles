import { createUserWithEmailAndPassword, deleteUser, onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signOut, User } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
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
  try {
    await setDoc(doc(services.db, 'users', credential.user.uid), {
      name,
      email: email.toLowerCase(),
      role: 'student',
      pendingRole: role === 'student' ? null : role,
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
  } catch (error) {
    await deleteUser(credential.user).catch(() => undefined);
    throw error;
  }
  return credential.user;
}

export interface RegistrationOptions {
  districts: Array<{ id: string; name: string }>;
  churches: Array<{ id: string; districtId: string; name: string }>;
  classes: Array<{ id: string; districtId: string; churchId: string; name: string; ageGroup: string }>;
}

export async function getRegistrationOptions() {
  if (!db) return { districts: [], churches: [], classes: [] } as RegistrationOptions;
  const [districts, churches, classes] = await Promise.all([
    getDocs(query(collection(db, 'districts'), where('active', '==', true))),
    getDocs(query(collection(db, 'churches'), where('active', '==', true))),
    getDocs(query(collection(db, 'classes'), where('active', '==', true))),
  ]);
  return {
    districts: districts.docs.map(item => ({ id: item.id, name: String(item.data().name ?? 'Distrito') })),
    churches: churches.docs.map(item => ({ id: item.id, districtId: String(item.data().districtId), name: String(item.data().name ?? 'Igreja') })),
    classes: classes.docs.map(item => ({ id: item.id, districtId: String(item.data().districtId), churchId: String(item.data().churchId), name: String(item.data().name ?? 'Base'), ageGroup: String(item.data().ageGroup ?? 'adolescentes') })),
  };
}

export async function loginUser(email: string, password: string) {
  const services = requireFirebase();
  const user = (await signInWithEmailAndPassword(services.auth, email, password)).user;
  const profile = await getDoc(doc(services.db, 'users', user.uid));
  if (profile.exists() && profile.data().active === false) {
    await signOut(services.auth);
    throw new Error('Este acesso está suspenso. Procure o administrador geral.');
  }
  return user;
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
  if (snapshot.exists() && snapshot.data().active === false) {
    await signOut(services.auth);
    throw new Error('Acesso suspenso.');
  }
  if (snapshot.data()?.pendingRole) throw new Error('Seu acesso de liderança ainda está aguardando aprovação.');
  return (snapshot.data()?.role as UserRole | undefined) ?? 'student';
}
