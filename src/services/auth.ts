import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import type { UserRole } from '../domain/models';

const requireFirebase = () => {
  if (!auth || !db) throw new Error('Firebase ainda não foi configurado. Preencha o arquivo .env.');
  return { auth, db };
};

export async function registerUser(name: string, email: string, password: string, role: UserRole) {
  if (role === 'admin') throw new Error('Administradores são cadastrados diretamente no painel seguro do projeto.');
  const services = requireFirebase();
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
      requestedRole: role,
      status: 'pending',
      createdAt: serverTimestamp(),
    });
  }
  return credential.user;
}

export async function loginUser(email: string, password: string) {
  const services = requireFirebase();
  return (await signInWithEmailAndPassword(services.auth, email, password)).user;
}

export async function logoutUser() {
  const services = requireFirebase();
  await signOut(services.auth);
}

export async function getUserRole(userId: string): Promise<UserRole> {
  const services = requireFirebase();
  const snapshot = await getDoc(doc(services.db, 'users', userId));
  return (snapshot.data()?.role as UserRole | undefined) ?? 'student';
}
