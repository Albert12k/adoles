import { httpsCallable } from 'firebase/functions';
import { cloudFunctions } from '../config/firebase';

const requireFunctions = () => {
  if (!cloudFunctions) throw new Error('Firebase ainda não foi configurado.');
  return cloudFunctions;
};

export async function publishContent(input: { title: string; classId?: string; lessonPdfUrl?: string; bookPdfUrl?: string; week?: number; quarter?: number; year?: number }) {
  const callable = httpsCallable<typeof input, { contentId: string }>(requireFunctions(), 'publishWeeklyContent');
  return (await callable(input)).data;
}

export async function publishQuizContent(input: {
  title: string;
  classId?: string;
  releaseAt: number;
  closesAt: number;
  questions: Array<{ prompt: string; options: string[]; correctIndex: number }>;
}) {
  const callable = httpsCallable<typeof input, { quizId: string }>(requireFunctions(), 'publishQuiz');
  return (await callable(input)).data;
}

export async function reviewLeadershipItem(type: 'attendance' | 'challenge' | 'roleRequest', itemId: string, approved: boolean) {
  const callable = httpsCallable<{ type: string; itemId: string; approved: boolean }, { status: string }>(requireFunctions(), 'reviewLeadershipItem');
  return (await callable({ type, itemId, approved })).data;
}

export async function manageClassMembership(input: { action: 'regenerateCode' | 'removeMember' | 'transferLeadership' | 'revokeDirector'; classId: string; targetUserId?: string }) {
  const callable = httpsCallable<typeof input, { success?: boolean; inviteCode?: string; className?: string }>(requireFunctions(), 'manageClassMembership');
  return (await callable(input)).data;
}

export async function getManagedClass(classId?: string) {
  const callable = httpsCallable<{ classId?: string }, { classId: string; className: string; inviteCode: string; members: Array<{ id: string; name: string; role: string }> }>(requireFunctions(), 'getManagedClass');
  return (await callable({ classId })).data;
}
