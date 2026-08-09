import { addDoc, collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

export interface DistrictEvent { id: string; title: string; description?: string; location: string; districtId: string; dateLabel: string; capacity?: number; active: boolean; participantCount?: number; participants?: Array<{ userId: string; name: string }>; }

export async function createDistrictEvent(input: { title: string; description?: string; location: string; dateLabel: string; capacity?: number }) {
  if (!db || !auth?.currentUser) throw new Error('Entre novamente para criar o encontro.');
  const profile = (await getDoc(doc(db, 'users', auth.currentUser.uid))).data();
  if (!profile?.districtId) throw new Error('Seu perfil ainda não possui um distrito.');
  const reference = await addDoc(collection(db, 'districtEvents'), {
    title: input.title.trim(), description: input.description?.trim() ?? '', location: input.location.trim(), dateLabel: input.dateLabel.trim(), capacity: Math.max(0, Number(input.capacity ?? 0)),
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
  const districtId = String(profile?.districtId ?? '');
  const [events, rsvps] = await Promise.all([getDocs(query(collection(db, 'districtEvents'), where('districtId', '==', districtId))), getDocs(query(collection(db, 'eventRsvps'), where('districtId', '==', districtId)))]);
  return events.docs.map(item => ({ id: item.id, ...(item.data() as Omit<DistrictEvent, 'id'>) })).map(event => { const participants = rsvps.docs.filter(item => item.data().eventId === event.id && item.data().status === 'confirmed').map(item => ({ userId: String(item.data().userId), name: String(item.data().userName ?? 'Adolescente') })); return { ...event, participantCount: participants.length, participants }; });
}

export async function updateDistrictEvent(eventId: string, input: { title: string; description?: string; location: string; dateLabel: string; capacity?: number }) {
  if (!db || !auth?.currentUser) throw new Error('Entre novamente para editar o encontro.');
  const capacity = Math.max(0, Number(input.capacity ?? 0));
  if (capacity > 0) {
    const confirmed = await getDocs(query(collection(db, 'eventRsvps'), where('eventId', '==', eventId), where('status', '==', 'confirmed')));
    if (confirmed.size > capacity) throw new Error(`Este encontro já possui ${confirmed.size} participante(s) confirmado(s).`);
  }
  await updateDoc(doc(db, 'districtEvents', eventId), { title: input.title.trim(), description: input.description?.trim() ?? '', location: input.location.trim(), dateLabel: input.dateLabel.trim(), capacity, updatedBy: auth.currentUser.uid, updatedAt: serverTimestamp() });
}

async function notifyEventParticipants(event: DistrictEvent, title: string, body: string) {
  if (!db || !auth?.currentUser) return 0;
  const rsvps = await getDocs(query(collection(db, 'eventRsvps'), where('eventId', '==', event.id)));
  const confirmed = rsvps.docs.filter(item => item.data().status === 'confirmed');
  const batch = writeBatch(db);
  confirmed.forEach(item => batch.set(doc(collection(db!, 'notifications')), { userId: item.data().userId, districtId: event.districtId, type: 'event', title, body, read: false, createdBy: auth!.currentUser!.uid, createdAt: serverTimestamp() }));
  await batch.commit(); return confirmed.length;
}

export async function cancelDistrictEvent(event: DistrictEvent) {
  if (!db || !auth?.currentUser) throw new Error('Entre novamente para cancelar o encontro.');
  await updateDoc(doc(db, 'districtEvents', event.id), { active: false, cancelledBy: auth.currentUser.uid, cancelledAt: serverTimestamp() });
  return notifyEventParticipants(event, 'Encontro cancelado', `${event.title} foi cancelado pelo coordenador.`);
}

export async function remindEventParticipants(event: DistrictEvent) {
  return notifyEventParticipants(event, 'Lembrete de encontro', `${event.title} acontecerá em ${event.dateLabel}, no local ${event.location}.`);
}

export async function cancelEventAttendance(event: DistrictEvent) {
  if (!db || !auth?.currentUser) throw new Error('Entre novamente para cancelar.');
  await updateDoc(doc(db, 'eventRsvps', `${event.id}_${auth.currentUser.uid}`), { status: 'cancelled', updatedAt: serverTimestamp() });
}

export async function listMyEventRsvps() {
  if (!db || !auth?.currentUser) return [] as string[];
  const result = await getDocs(query(collection(db, 'eventRsvps'), where('userId', '==', auth.currentUser.uid)));
  return result.docs.filter(item => item.data().status === 'confirmed').map(item => String(item.data().eventId));
}

export async function confirmEventAttendance(event: DistrictEvent) {
  if (!db || !auth?.currentUser) throw new Error('Entre novamente para confirmar.');
  const eventSnapshot = await getDoc(doc(db, 'districtEvents', event.id));
  if (!eventSnapshot.exists() || eventSnapshot.data().active !== true) throw new Error('Este encontro não está mais disponível.');
  const capacity = Number(eventSnapshot.data().capacity ?? 0);
  const confirmed = await getDocs(query(collection(db, 'eventRsvps'), where('eventId', '==', event.id), where('status', '==', 'confirmed')));
  if (capacity > 0 && confirmed.size >= capacity) throw new Error('As vagas deste encontro já foram preenchidas.');
  const profile = await getDoc(doc(db, 'users', auth.currentUser.uid));
  await setDoc(doc(db, 'eventRsvps', `${event.id}_${auth.currentUser.uid}`), {
    eventId: event.id, userId: auth.currentUser.uid, userName: profile.data()?.name ?? 'Adolescente', districtId: event.districtId, status: 'confirmed', confirmedAt: serverTimestamp(),
  }, { merge: true });
}
