import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { uploadPrivateFile } from '../config/supabase';
import { submitAttendance, uploadAttendanceEvidence } from './data';

async function currentScope() {
  const user = auth?.currentUser;
  if (!user || !db) throw new Error('Entre na sua conta para enviar arquivos.');
  const profile = await getDoc(doc(db, 'users', user.uid));
  const classId = profile.data()?.classIds?.[0] as string | undefined;
  if (!classId) throw new Error('Sua conta ainda não está vinculada a uma classe.');
  const classSnapshot = await getDoc(doc(db, 'classes', classId));
  return { user, classId, classData: classSnapshot.data() };
}

export async function selectAndUploadContentPdf() {
  const scope = await currentScope();
  const selection = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true, multiple: false });
  if (selection.canceled) return null;
  const asset = selection.assets[0];
  if ((asset.size ?? 0) > 25 * 1024 * 1024) throw new Error('O PDF deve ter no máximo 25 MB.');
  const blob = await (await fetch(asset.uri)).blob();
  const safeName = asset.name.replace(/[^a-zA-Z0-9._-]/g, '-');
  const path = `${scope.user.uid}/${scope.classId}/${Date.now()}-${safeName}`;
  return { name: asset.name, url: await uploadPrivateFile('weekly-content', path, blob, 'application/pdf') };
}

export async function selectAttendancePhoto() {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error('Permita o acesso às fotos para enviar a presença.');
  const selection = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsEditing: true, aspect: [4, 3] });
  if (selection.canceled) return null;
  return selection.assets[0].uri;
}

export async function selectAndUploadChallengePhoto(classId?: string) {
  const user = auth?.currentUser;
  if (!user) throw new Error('Entre novamente para enviar a foto do desafio.');
  if (!classId) throw new Error('Selecione a base antes de enviar a foto.');
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error('Permita o acesso às fotos para enviar a evidência.');
  const selection = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.82, allowsEditing: true, aspect: [4, 3] });
  if (selection.canceled) return null;
  const localUri = selection.assets[0].uri;
  const blob = await (await fetch(localUri)).blob();
  const path = `${user.uid}/${classId}/challenges/${Date.now()}.jpg`;
  const url = await uploadPrivateFile('attendance', path, blob, blob.type || 'image/jpeg');
  return { localUri, url };
}

export async function uploadSelectedAttendancePhoto(localUri: string, week: number, quarter: number, year: number, userName?: string) {
  const scope = await currentScope();
  const evidenceUrl = await uploadAttendanceEvidence(scope.user.uid, scope.classId, localUri);
  const result = await submitAttendance({
    userId: scope.user.uid, classId: scope.classId, week, quarter, year, evidenceUrl,
    userName, districtId: scope.classData?.districtId ?? '', ageGroup: scope.classData?.ageGroup ?? 'adolescentes',
  });
  return result.id;
}

export async function selectAndSubmitAttendancePhoto(week: number, quarter: number, year: number) {
  const localUri = await selectAttendancePhoto();
  return localUri ? uploadSelectedAttendancePhoto(localUri, week, quarter, year) : null;
}
