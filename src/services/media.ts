import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { doc, getDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { auth, db, storage } from '../config/firebase';
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
  if (!storage) throw new Error('Firebase Storage ainda não foi configurado.');
  const scope = await currentScope();
  const selection = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true, multiple: false });
  if (selection.canceled) return null;
  const asset = selection.assets[0];
  if ((asset.size ?? 0) > 25 * 1024 * 1024) throw new Error('O PDF deve ter no máximo 25 MB.');
  const blob = await (await fetch(asset.uri)).blob();
  const safeName = asset.name.replace(/[^a-zA-Z0-9._-]/g, '-');
  const snapshot = await uploadBytes(ref(storage, `weekly-content/${scope.classId}/${Date.now()}-${safeName}`), blob, { contentType: 'application/pdf' });
  return { name: asset.name, url: await getDownloadURL(snapshot.ref) };
}

export async function selectAndSubmitAttendancePhoto(week: number, quarter: number, year: number) {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error('Permita o acesso às fotos para enviar a presença.');
  const selection = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsEditing: true, aspect: [4, 3] });
  if (selection.canceled) return null;
  const scope = await currentScope();
  const evidenceUrl = await uploadAttendanceEvidence(scope.user.uid, scope.classId, selection.assets[0].uri);
  const result = await submitAttendance({
    userId: scope.user.uid, classId: scope.classId, week, quarter, year, evidenceUrl,
    districtId: scope.classData?.districtId ?? '', ageGroup: scope.classData?.ageGroup ?? 'adolescentes',
  });
  return result.id;
}
