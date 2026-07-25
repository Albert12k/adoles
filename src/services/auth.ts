import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import type { UserRole } from '../domain/models';

const requireFirebase = () => {
  if (!auth || !db) throw new Error('Firebase ainda não foi configurado. Preencha o arquivo .env.');
  return { auth, db };
};

export async function registerUser(name: string, email: string, password: string, role: UserRole) {
  if (role !== 'student') throw new Error('Contas de liderança precisam ser aprovadas por um responsável.');
  const services = requireFirebase();
  const credential = await createUserWithEmailAndPassword(services.auth, email, password);
  await setDoc(doc(services.db, 'users', credential.user.uid), {
    name,
    email: email.toLowerCase(),
    role,
    classIds: [],
    active: true,
    createdAt: serverTimestamp(),
  });
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
