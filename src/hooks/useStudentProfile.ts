import { useEffect, useState } from 'react';
import { collection, doc, getDoc, getDocs, limit, onSnapshot, query, where } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

export function useStudentProfile() {
  const [state, setState] = useState({ name: 'Adolescente', className: 'Sem turma', classId: '', districtId: '', pending: false });
  useEffect(() => {
    if (!db || !auth?.currentUser) return;
    let active = true;
    const unsubscribe = onSnapshot(doc(db, 'users', auth.currentUser.uid), async snapshot => {
      const data = snapshot.data();
      if (!data || !active) return;
      const classId = data.classIds?.[0];
      let className = 'Sem turma';
      if (classId) className = (await getDoc(doc(db!, 'classes', classId))).data()?.name ?? 'Turma';
      const pending = !classId && !(await getDocs(query(collection(db!, 'classJoinRequests'), where('userId', '==', auth!.currentUser!.uid), where('status', '==', 'pending'), limit(1)))).empty;
      if (active) setState({ name: data.name ?? 'Adolescente', className, classId: classId ?? '', districtId: data.districtId ?? '', pending });
    });
    return () => { active = false; unsubscribe(); };
  }, []);
  return state;
}
