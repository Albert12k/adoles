import { useEffect, useState } from 'react';
import { collection, doc, getDoc, getDocs, limit, onSnapshot, query, where } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

export function useStudentProfile() {
  const [state, setState] = useState({ name: 'Adolescente', className: 'Sem turma', classId: '', districtId: '', ageGroup: 'adolescentes', pending: false, status: '', themeColor: '', ready: false });
  useEffect(() => {
    if (!db || !auth?.currentUser) return;
    let active = true;
    const unsubscribe = onSnapshot(doc(db, 'users', auth.currentUser.uid), async snapshot => {
      const data = snapshot.data();
      if (!data || !active) return;
      const classId = data.classIds?.[0];
      let className = 'Sem turma';
      let ageGroup = 'adolescentes';
      if (classId) { const classData = (await getDoc(doc(db!, 'classes', classId))).data(); className = classData?.name ?? 'Turma'; ageGroup = classData?.ageGroup ?? 'adolescentes'; }
      const pending = !classId && !(await getDocs(query(collection(db!, 'classJoinRequests'), where('userId', '==', auth!.currentUser!.uid), where('status', '==', 'pending'), limit(1)))).empty;
      if (active) setState({ name: data.name ?? 'Adolescente', className, classId: classId ?? '', districtId: data.districtId ?? '', ageGroup, pending, status: data.status ?? '', themeColor: data.themeColor ?? '', ready: true });
    });
    return () => { active = false; unsubscribe(); };
  }, []);
  return state;
}
