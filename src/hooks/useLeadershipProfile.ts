import { useEffect, useState } from 'react';
import { collection, doc, getCountFromServer, getDoc, getDocs, limit, query, where } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

type LeadershipRole = 'diretor' | 'coordenador' | 'admin';

export function useLeadershipProfile(role: LeadershipRole) {
  const [state, setState] = useState({ name: 'Usuário', scope: 'Carregando...', metrics: [['0', 'cadastros'], ['0', 'classes'], ['0', 'membros']] as string[][] });
  useEffect(() => {
    if (!db || !auth?.currentUser) return;
    let active = true;
    (async () => {
      const profile = (await getDoc(doc(db!, 'users', auth!.currentUser!.uid))).data();
      if (!profile) return;
      if (role === 'admin') {
        const [districts, classes, members] = await Promise.all([
          getCountFromServer(collection(db!, 'districts')),
          getCountFromServer(collection(db!, 'classes')),
          getCountFromServer(query(collection(db!, 'classMembers'), where('active', '==', true))),
        ]);
        if (active) setState({ name: profile.name ?? 'Administrador', scope: 'Visão geral do projeto', metrics: [[String(districts.data().count), 'distritos'], [String(classes.data().count), 'classes'], [String(members.data().count), 'membros']] });
      } else if (role === 'coordenador') {
        const district = await getDoc(doc(db!, 'districts', profile.districtId));
        const [churches, classes] = await Promise.all([
          getCountFromServer(query(collection(db!, 'churches'), where('districtId', '==', profile.districtId))),
          getCountFromServer(query(collection(db!, 'classes'), where('districtId', '==', profile.districtId))),
        ]);
        if (active) setState({ name: profile.name ?? 'Coordenador', scope: `Distrito ${district.data()?.name ?? ''}`.trim(), metrics: [[String(churches.data().count), 'igrejas'], [String(classes.data().count), 'classes'], ['0', 'pendências']] });
      } else {
        const classes = await getDocs(query(collection(db!, 'classes'), where('directorIds', 'array-contains', auth!.currentUser!.uid), limit(1)));
        const selected = classes.docs[0];
        const members = selected ? await getCountFromServer(query(collection(db!, 'classMembers'), where('classId', '==', selected.id), where('active', '==', true))) : null;
        if (active) setState({ name: profile.name ?? 'Diretor', scope: selected?.data().name ?? 'Classe ainda não definida', metrics: [[String(members?.data().count ?? 0), 'membros ativos'], ['0', 'pendências'], ['0', 'atividades']] });
      }
    })().catch(() => undefined);
    return () => { active = false; };
  }, [role]);
  return state;
}
