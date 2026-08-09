import { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

export interface ProgressBadge { icon: string; label: string; unlocked: boolean; detail: string; }
export interface StudentProgress { points: number; streak: number; evolution: number; badges: ProgressBadge[]; summaries: number; attendance: number; quizCorrect: number; activities: number; }

const empty: StudentProgress = { points: 0, streak: 0, evolution: 0, badges: [], summaries: 0, attendance: 0, quizCorrect: 0, activities: 0 };
const toDate = (value: unknown) => value && typeof (value as { toDate?: () => Date }).toDate === 'function' ? (value as { toDate: () => Date }).toDate() : null;
const weekKey = (date: Date) => { const first = new Date(date.getFullYear(), 0, 1); return `${date.getFullYear()}-${Math.ceil(((date.getTime() - first.getTime()) / 86400000 + first.getDay() + 1) / 7)}`; };

export function useStudentProgress() {
  const [progress, setProgress] = useState<StudentProgress>(empty);
  useEffect(() => {
    if (!db || !auth?.currentUser) return;
    let active = true;
    const load = async () => {
      const uid = auth!.currentUser!.uid;
      const [studies, attendanceDocs, attempts, activityDocs] = await Promise.all([
        getDocs(query(collection(db!, 'studyRecords'), where('userId', '==', uid))),
        getDocs(query(collection(db!, 'attendance'), where('userId', '==', uid))),
        getDocs(query(collection(db!, 'quizAttempts'), where('userId', '==', uid))),
        getDocs(query(collection(db!, 'activityParticipants'), where('userId', '==', uid))),
      ]);
      const approvedAttendance = attendanceDocs.docs.filter(item => item.data().status === 'approved');
      const reviewedAttempts = attempts.docs.filter(item => item.data().status === 'reviewed');
      const confirmedActivities = activityDocs.docs.filter(item => item.data().status === 'confirmed');
      const correct = reviewedAttempts.reduce((sum, item) => sum + Number(item.data().correctAnswers ?? 0), 0);
      const points = studies.size * 20 + approvedAttendance.length * 10 + correct * 10 + confirmedActivities.reduce((sum, item) => sum + Number(item.data().points ?? 0), 0);
      const dates = [...studies.docs.map(item => toDate(item.data().createdAt)), ...approvedAttendance.map(item => toDate(item.data().createdAt))].filter((date): date is Date => !!date);
      const activeWeeks = new Set(dates.map(weekKey));
      let streak = 0; const cursor = new Date();
      while (activeWeeks.has(weekKey(cursor))) { streak++; cursor.setDate(cursor.getDate() - 7); }
      const now = Date.now(); const recent = dates.filter(date => now - date.getTime() <= 28 * 86400000).length; const previous = dates.filter(date => now - date.getTime() > 28 * 86400000 && now - date.getTime() <= 56 * 86400000).length;
      const evolution = previous === 0 ? (recent > 0 ? 100 : 0) : Math.round(((recent - previous) / previous) * 100);
      const badges: ProgressBadge[] = [
        { icon: '🔥', label: 'Constante', unlocked: streak >= 4, detail: '4 semanas seguidas' },
        { icon: '📖', label: 'Leitor', unlocked: studies.size >= 5, detail: '5 resumos enviados' },
        { icon: '⚡', label: 'Quiz 10', unlocked: correct >= 10, detail: '10 respostas corretas' },
        { icon: '🏔️', label: 'Presente', unlocked: approvedAttendance.length >= 5, detail: '5 presenças aprovadas' },
        { icon: '⚑', label: 'Participante', unlocked: confirmedActivities.length >= 3, detail: '3 atividades externas' },
      ];
      if (active) setProgress({ points, streak, evolution, badges, summaries: studies.size, attendance: approvedAttendance.length, quizCorrect: correct, activities: confirmedActivities.length });
    };
    load().catch(() => undefined);
    return () => { active = false; };
  }, []);
  return progress;
}
