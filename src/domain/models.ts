export type UserRole = 'admin' | 'coordinator' | 'director' | 'student';
export type AgeGroup = 'adolescentes' | 'pre_adolescentes';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  districtId?: string;
  churchId?: string;
  classIds: string[];
  photoUrl?: string;
  status?: string;
  active: boolean;
  createdAt: string;
}

export interface District {
  id: string;
  name: string;
  coordinatorId?: string;
  active: boolean;
}

export interface Church {
  id: string;
  districtId: string;
  name: string;
  active: boolean;
}

export interface MinistryClass {
  id: string;
  churchId: string;
  districtId: string;
  name: string;
  ageGroup: AgeGroup;
  directorIds: string[];
  inviteCode: string;
  activeMemberCount: number;
  active: boolean;
}

export interface WeeklyContent {
  id: string;
  classId: string;
  title: string;
  lessonPdfUrl?: string;
  bookPdfUrl?: string;
  week: number;
  quarter: number;
  year: number;
  publishedAt?: string;
  createdBy: string;
}

export interface StudyRecord {
  id: string;
  userId: string;
  classId: string;
  contentId: string;
  source: 'lesson' | 'bible' | 'book';
  passage?: string;
  summary: string;
  score?: number;
  feedbackVisible: boolean;
  createdAt: string;
}

export interface AttendanceRecord {
  id: string;
  userId: string;
  classId: string;
  week: number;
  quarter: number;
  year: number;
  evidenceUrl: string;
  status: ApprovalStatus;
  reviewedBy?: string;
  createdAt: string;
}

export interface Challenge {
  id: string;
  classId: string;
  districtId: string;
  title: string;
  description: string;
  evidenceUrl?: string;
  bonusPoints: number;
  status: ApprovalStatus;
  month: number;
  year: number;
}

export interface ScoreEntry {
  id: string;
  userId?: string;
  classId: string;
  districtId: string;
  ageGroup: AgeGroup;
  source: 'study' | 'attendance' | 'quiz' | 'challenge' | 'badge';
  points: number;
  createdAt: string;
}

export const normalizedClassScore = (totalPoints: number, activeMembers: number) =>
  activeMembers > 0 ? Math.round((totalPoints / activeMembers) * 100) / 100 : 0;
