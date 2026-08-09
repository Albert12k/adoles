import { addDoc, collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

export interface EventParticipant { userId: string; name: string; status: 'confirmed' | 'waitlisted' | 'cancelled'; checkedIn: boolean; waitlistOrder?: number; }
export interface DistrictEvent { id: string; title: string; description?: string; location: string; districtId: string; dateLabel: string; capacity?: number; active: boolean; status?: 'scheduled' | 'cancelled' | 'completed'; participantCount?: number; waitlistCount?: number; checkedInCount?: number; participants?: EventParticipant[]; }
export interface MyEventRegistration { eventId: string; status: 'confirmed' | 'waitlisted'; position?: number; checkedIn?: boolean; }
export interface EventFeedback { id: string; eventId: string; userId: string; userName: string; districtId: string; rating: number; comment: string; }
export interface CompletedEvent extends DistrictEvent { myCheckedIn: boolean; myRating?: number; myComment?: string; }

export async function createDistrictEvent(input: { title: string; description?: string; location: string; dateLabel: string; capacity?: number }) {
  if (!db || !auth?.currentUser) throw new Error('Entre novamente para criar o encontro.');
  const profile = (await getDoc(doc(db, 'users', auth.currentUser.uid))).data();
  if (!profile?.districtId) throw new Error('Seu perfil ainda não possui um distrito.');
  const reference = await addDoc(collection(db, 'districtEvents'), {
    title: input.title.trim(), description: input.description?.trim() ?? '', location: input.location.trim(), dateLabel: input.dateLabel.trim(), capacity: Math.max(0, Number(input.capacity ?? 0)),
    districtId: profile.districtId, active: true, status: 'scheduled', createdBy: auth.currentUser.uid, createdAt: serverTimestamp(),
  });
  return reference.id;
}

export async function listDistrictEvents(districtId: string): Promise<DistrictEvent[]> {
  if (!db || !districtId) return [];
  const result = await getDocs(query(collection(db, 'districtEvents'), where('districtId', '==', districtId), where('active', '==', true)));
  return result.docs.map(item => ({ id: item.id, ...(item.data() as Omit<DistrictEvent, 'id'>) }));
}

export async function listMyCompletedEvents(districtId: string): Promise<CompletedEvent[]> {
  if (!db || !auth?.currentUser || !districtId) return [];
  const [events, registrations, feedbacks] = await Promise.all([
    getDocs(query(collection(db, 'districtEvents'), where('districtId', '==', districtId))),
    getDocs(query(collection(db, 'eventRsvps'), where('userId', '==', auth.currentUser.uid))),
    getDocs(query(collection(db, 'eventFeedback'), where('userId', '==', auth.currentUser.uid))),
  ]);
  const joined = registrations.docs.filter(item => item.data().status === 'confirmed').map(item => item.data());
  return events.docs.map(item => ({ id: item.id, ...(item.data() as Omit<DistrictEvent, 'id'>) })).filter(event => event.status === 'completed' && joined.some(item => item.eventId === event.id)).map(event => {
    const registration = joined.find(item => item.eventId === event.id);
    const feedback = feedbacks.docs.find(item => item.data().eventId === event.id)?.data();
    return { ...event, myCheckedIn: registration?.checkedIn === true, myRating: feedback?.rating, myComment: feedback?.comment };
  });
}

export async function listCurrentDistrictEvents() {
  if (!db || !auth?.currentUser) return [];
  const profile = (await getDoc(doc(db, 'users', auth.currentUser.uid))).data();
  const districtId = String(profile?.districtId ?? '');
  const [events, rsvps] = await Promise.all([getDocs(query(collection(db, 'districtEvents'), where('districtId', '==', districtId))), getDocs(query(collection(db, 'eventRsvps'), where('districtId', '==', districtId)))]);
  return events.docs.map(item => ({ id: item.id, ...(item.data() as Omit<DistrictEvent, 'id'>) })).map(event => {
    const participants = rsvps.docs.filter(item => item.data().eventId === event.id).map(item => ({ userId: String(item.data().userId), name: String(item.data().userName ?? 'Adolescente'), status: item.data().status as EventParticipant['status'], checkedIn: item.data().checkedIn === true, waitlistOrder: Number(item.data().waitlistOrder ?? 0) })).sort((a, b) => Number(a.waitlistOrder ?? 0) - Number(b.waitlistOrder ?? 0));
    return { ...event, participantCount: participants.filter(item => item.status === 'confirmed').length, waitlistCount: participants.filter(item => item.status === 'waitlisted').length, checkedInCount: participants.filter(item => item.checkedIn).length, participants };
  });
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
  await updateDoc(doc(db, 'districtEvents', event.id), { active: false, status: 'cancelled', cancelledBy: auth.currentUser.uid, cancelledAt: serverTimestamp() });
  return notifyEventParticipants(event, 'Encontro cancelado', `${event.title} foi cancelado pelo coordenador.`);
}

export async function remindEventParticipants(event: DistrictEvent) {
  return notifyEventParticipants(event, 'Lembrete de encontro', `${event.title} acontecerá em ${event.dateLabel}, no local ${event.location}.`);
}

export async function cancelEventAttendance(event: DistrictEvent) {
  if (!db || !auth?.currentUser) throw new Error('Entre novamente para cancelar.');
  const reference = doc(db, 'eventRsvps', `${event.id}_${auth.currentUser.uid}`);
  await updateDoc(reference, { status: 'cancelled', checkedIn: false, updatedAt: serverTimestamp() });
}

export async function listMyEventRsvps() {
  if (!db || !auth?.currentUser) return [] as string[];
  const result = await getDocs(query(collection(db, 'eventRsvps'), where('userId', '==', auth.currentUser.uid)));
  return result.docs.filter(item => item.data().status === 'confirmed').map(item => String(item.data().eventId));
}

export async function listMyEventRegistrations(): Promise<MyEventRegistration[]> {
  if (!db || !auth?.currentUser) return [];
  const result = await getDocs(query(collection(db, 'eventRsvps'), where('userId', '==', auth.currentUser.uid)));
  return result.docs.map(item => item.data()).filter(item => item.status === 'confirmed' || item.status === 'waitlisted').map(item => ({
    eventId: String(item.eventId), status: item.status, checkedIn: item.checkedIn === true,
    position: item.status === 'waitlisted' ? Number(item.waitlistPosition ?? 1) : undefined,
  }));
}

export async function confirmEventAttendance(event: DistrictEvent): Promise<MyEventRegistration> {
  if (!db || !auth?.currentUser) throw new Error('Entre novamente para confirmar.');
  const eventSnapshot = await getDoc(doc(db, 'districtEvents', event.id));
  if (!eventSnapshot.exists() || eventSnapshot.data().active !== true) throw new Error('Este encontro não está mais disponível.');
  const capacity = Number(eventSnapshot.data().capacity ?? 0);
  const confirmed = await getDocs(query(collection(db, 'eventRsvps'), where('eventId', '==', event.id), where('status', '==', 'confirmed')));
  const waiting = await getDocs(query(collection(db, 'eventRsvps'), where('eventId', '==', event.id)));
  const waitlisted = capacity > 0 && confirmed.size >= capacity;
  const waitlistPosition = waiting.docs.filter(item => item.data().status === 'waitlisted').length + 1;
  const waitlistOrder = Date.now();
  const profile = await getDoc(doc(db, 'users', auth.currentUser.uid));
  await setDoc(doc(db, 'eventRsvps', `${event.id}_${auth.currentUser.uid}`), {
    eventId: event.id, userId: auth.currentUser.uid, userName: profile.data()?.name ?? 'Adolescente', districtId: event.districtId, status: waitlisted ? 'waitlisted' : 'confirmed', checkedIn: false, waitlistOrder, waitlistPosition: waitlisted ? waitlistPosition : null, confirmedAt: serverTimestamp(),
  }, { merge: true });
  return { eventId: event.id, status: waitlisted ? 'waitlisted' : 'confirmed', position: waitlisted ? waitlistPosition : undefined };
}

export async function setEventCheckIn(eventId: string, userId: string, checkedIn: boolean) {
  if (!db || !auth?.currentUser) throw new Error('Entre novamente para registrar a presença.');
  await updateDoc(doc(db, 'eventRsvps', `${eventId}_${userId}`), { checkedIn, checkedInBy: auth.currentUser.uid, checkedInAt: checkedIn ? serverTimestamp() : null });
}

export async function promoteNextWaitlisted(event: DistrictEvent) {
  if (!db || !auth?.currentUser) throw new Error('Entre novamente para liberar a vaga.');
  const waiting = (event.participants ?? []).filter(item => item.status === 'waitlisted');
  if (!waiting.length) throw new Error('Não há ninguém na lista de espera.');
  if (Number(event.capacity ?? 0) > 0 && Number(event.participantCount ?? 0) >= Number(event.capacity)) throw new Error('O encontro ainda não possui vaga livre.');
  const next = waiting[0];
  await updateDoc(doc(db, 'eventRsvps', `${event.id}_${next.userId}`), { status: 'confirmed', promotedBy: auth.currentUser.uid, promotedAt: serverTimestamp() });
  await addDoc(collection(db, 'notifications'), { userId: next.userId, districtId: event.districtId, type: 'event', title: 'Sua vaga foi confirmada', body: `Uma vaga foi liberada para ${event.title}. Sua participação agora está confirmada.`, read: false, createdBy: auth.currentUser.uid, createdAt: serverTimestamp() });
}

export async function completeDistrictEvent(event: DistrictEvent) {
  if (!db || !auth?.currentUser) throw new Error('Entre novamente para encerrar o encontro.');
  const participants = event.participants ?? [];
  await updateDoc(doc(db, 'districtEvents', event.id), { active: false, status: 'completed', finalConfirmed: participants.filter(item => item.status === 'confirmed').length, finalAttendance: participants.filter(item => item.checkedIn).length, completedBy: auth.currentUser.uid, completedAt: serverTimestamp() });
}

export async function submitEventFeedback(event: DistrictEvent, rating: number, comment: string) {
  if (!db || !auth?.currentUser) throw new Error('Entre novamente para avaliar o encontro.');
  const registration = await getDoc(doc(db, 'eventRsvps', `${event.id}_${auth.currentUser.uid}`));
  if (!registration.exists() || registration.data().status !== 'confirmed') throw new Error('Somente participantes confirmados podem avaliar.');
  const profile = await getDoc(doc(db, 'users', auth.currentUser.uid));
  await setDoc(doc(db, 'eventFeedback', `${event.id}_${auth.currentUser.uid}`), { eventId: event.id, userId: auth.currentUser.uid, userName: profile.data()?.name ?? 'Adolescente', districtId: event.districtId, rating: Math.min(5, Math.max(1, Math.round(rating))), comment: comment.trim().slice(0, 500), updatedAt: serverTimestamp() }, { merge: true });
}

export async function listDistrictEventFeedback(): Promise<EventFeedback[]> {
  if (!db || !auth?.currentUser) return [];
  const profile = await getDoc(doc(db, 'users', auth.currentUser.uid));
  const districtId = String(profile.data()?.districtId ?? '');
  if (!districtId) return [];
  const result = await getDocs(query(collection(db, 'eventFeedback'), where('districtId', '==', districtId)));
  return result.docs.map(item => ({ id: item.id, ...(item.data() as Omit<EventFeedback, 'id'>) }));
}
