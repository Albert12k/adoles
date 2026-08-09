import { addDoc, collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

export interface DistrictEvent { id: string; title: string; location: string; districtId: string; dateLabel: string; active: boolean; }

export async function createDistrictEvent(input: { title: string; location: string; dateLabel: string }) {
  if (!db || !auth?.currentUser) throw new Error('Entre novamente para criar o encontro.');
  const profile = (await getDoc(doc(db, 'users', auth.currentUser.uid))).data();
  if (!profile?.districtId) throw new Error('Seu perfil ainda não possui um distrito.');
  const reference = await addDoc(collection(db, 'districtEvents'), {
    title: input.title.trim(), location: input.location.trim(), dateLabel: input.dateLabel.trim(),
    districtId: profile.districtId, active: true, createdBy: auth.currentUser.uid, createdAt: serverTimestamp(),
  });
  return reference.id;
}

export async function listDistrictEvents(districtId: string): Promise<DistrictEvent[]> {
  if (!db || !districtId) return [];
  const result = await getDocs(query(collection(db, 'districtEvents'), where('districtId', '==', districtId), where('active', '==', true)));
  return result.docs.map(item => ({ id: item.id, ...(item.data() as Omit<DistrictEvent, 'id'>) }));
}

export async function listCurrentDistrictEvents() {
  if (!db || !auth?.currentUser) return [];
  const profile = (await getDoc(doc(db, 'users', auth.currentUser.uid))).data();
  return listDistrictEvents(profile?.districtId ?? '');
}

export async function confirmEventAttendance(event: DistrictEvent) {
  if (!db || !auth?.currentUser) throw new Error('Entre novamente para confirmar.');
  await setDoc(doc(db, 'eventRsvps', `${event.id}_${auth.currentUser.uid}`), {
    eventId: event.id, userId: auth.currentUser.uid, districtId: event.districtId, status: 'confirmed', confirmedAt: serverTimestamp(),
  });
}
