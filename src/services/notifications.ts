import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { collection, doc, getDocs, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

export async function registerPushNotifications() {
  const user = auth?.currentUser;
  if (!Device.isDevice || !user || !db) return null;
  const current = await Notifications.getPermissionsAsync();
  const permission = current.granted ? current : await Notifications.requestPermissionsAsync();
  if (!permission.granted) return null;
  const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) return null;
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  await setDoc(doc(db, 'pushTokens', user.uid), { userId: user.uid, expoPushToken: token, platform: Device.osName ?? 'unknown', updatedAt: serverTimestamp() }, { merge: true });
  return token;
}

export async function markNotificationRead(notificationId: string) {
  if (!db || !auth?.currentUser || !notificationId) return;
  await updateDoc(doc(db, 'notifications', notificationId), { read: true });
}

export async function markAllNotificationsRead() {
  if (!db || !auth?.currentUser) return 0;
  const result = await getDocs(query(collection(db, 'notifications'), where('userId', '==', auth.currentUser.uid), where('read', '==', false)));
  const batch = writeBatch(db);
  result.docs.forEach(item => batch.update(item.ref, { read: true }));
  await batch.commit();
  return result.size;
}
