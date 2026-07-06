export type Role = 'USER' | 'ADMIN';

export interface User {
  id: string;
  email: string;
  username: string;
  role: Role;
  rating: number;
  studentId: string | null;
  mustChangePassword?: boolean;
}

export interface StudentIdWindow {
  startsAt: string | null;
  endsAt: string | null;
  isOpen: boolean;
}

export interface ClubRosterEntry {
  id: string;
  studentId: string;
  name: string | null;
  createdAt: string;
}

export interface BulkRosterResult {
  addedCount: number;
  skippedCount: number;
  added: string[];
  skipped: string[];
}

export type Difficulty = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND' | 'RUBY';

export interface ProblemSummary {
  id: string;
  displayId: number;
  title: string;
  slug: string;
  difficulty: Difficulty;
  level: number; // 1(브론즈V) ~ 30(루비I)
  tags: string[];
  createdAt: string;
  submissionCount: number;
  acceptedCount: number;
  solvedCount: number;
  accuracy: number;
}

export interface TestCase {
  id: string;
  input: string;
  output: string;
  isSample: boolean;
  order: number;
}

export interface ProblemDetail extends ProblemSummary {
  description: string;
  timeLimitMs: number;
  memoryLimitMb: number;
  authorId: string;
  testCases: TestCase[];
  difficultyVoteCount: number;
  difficultyVoteAverage: number | null;
  myDifficultyVote: number | null;
  canVoteDifficulty: boolean;
}

export type Language = 'C' | 'CPP' | 'JAVA' | 'PYTHON3' | 'JAVASCRIPT' | 'GO';

export type SubmissionStatus =
  | 'PENDING'
  | 'JUDGING'
  | 'ACCEPTED'
  | 'WRONG_ANSWER'
  | 'TIME_LIMIT_EXCEEDED'
  | 'MEMORY_LIMIT_EXCEEDED'
  | 'RUNTIME_ERROR'
  | 'COMPILE_ERROR'
  | 'INTERNAL_ERROR';

export interface SubmissionTestResult {
  id: string;
  status: SubmissionStatus;
  runtimeMs: number | null;
  testCase: { isSample: boolean; order: number };
}

export interface SubmissionSummary {
  id: string;
  problemId: string;
  language: Language;
  status: SubmissionStatus;
  runtimeMs: number | null;
  memoryKb: number | null;
  createdAt: string;
  // 전체 채점 현황 피드(GET /submissions)에서만 내려온다. 내 제출 목록(GET /submissions/me)엔 없음.
  user?: { username: string };
  problem?: { title: string; slug: string; displayId: number };
}

export interface SubmissionDetail extends SubmissionSummary {
  sourceCode: string;
  errorMessage: string | null;
  testResults: SubmissionTestResult[];
}

export type ProblemStatus = 'DRAFT' | 'PENDING_REVIEW' | 'PUBLISHED' | 'REJECTED';

export interface MyProblem {
  id: string;
  displayId: number;
  title: string;
  slug: string;
  difficulty: Difficulty;
  level: number;
  status: ProblemStatus;
  reviewNote: string | null;
  createdAt: string;
}

export interface ProblemProposal {
  id: string;
  displayId: number;
  title: string;
  slug: string;
  difficulty: Difficulty;
  level: number;
  tags: string[];
  createdAt: string;
  author: { username: string };
}

export type ContestPhase = 'UPCOMING' | 'RUNNING' | 'ENDED';

export interface ContestSummary {
  id: string;
  title: string;
  slug: string;
  startsAt: string;
  endsAt: string;
  phase: ContestPhase;
  participantCount: number;
  problemCount: number;
}

export interface ContestProblemRef {
  problemId: string;
  label: string;
  points: number;
  title: string;
  slug: string;
  difficulty: Difficulty;
  level: number;
}

export interface ContestDetail {
  id: string;
  title: string;
  slug: string;
  description: string;
  startsAt: string;
  endsAt: string;
  phase: ContestPhase;
  registered: boolean;
  participantCount: number;
  createdBy: string;
  problems: ContestProblemRef[];
}

export interface LeaderboardRow {
  rank: number;
  userId: string;
  username: string;
  solvedCount: number;
  score: number;
  totalMinutes: number;
  solved: Array<{ problemId: string; label: string; minutes: number }>;
}

export interface LanguageRunnerConfig {
  fileName: string;
  compileImage?: string;
  compileCmd: string[] | null;
  runImage: string;
  runCmd: string[];
}

export type JudgeConfigEffective = Record<Language, LanguageRunnerConfig>;

export interface ApiKeySummary {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
  revoked: boolean;
}

export interface ApiKeyCreated extends ApiKeySummary {
  key: string;
}

export interface BulkCreatedUser {
  username: string;
  email: string;
  password: string;
  role: string;
}

export interface BulkCreateResult {
  createdCount: number;
  skippedCount: number;
  created: BulkCreatedUser[];
  skipped: Array<{ username: string; reason: string }>;
}

export interface RankingRow {
  rank: number;
  username: string;
  rating: number;
  solvedCount: number;
}

export interface UserProfileProblem {
  id: string;
  displayId: number;
  title: string;
  slug: string;
  difficulty: Difficulty;
  level: number;
}

export interface UserProfile {
  id: string;
  username: string;
  role: Role;
  rating: number;
  solvedCount: number;
  rank: number | null;
  solvedProblems: UserProfileProblem[];
}

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  role: Role;
  rating: number;
  banned: boolean;
  bannedReason: string | null;
  bannedAt: string | null;
  createdAt: string;
}

export interface AdminNotification {
  id: string;
  type: string;
  message: string;
  read: boolean;
  createdAt: string;
  problem: { displayId: number; title: string; slug: string } | null;
  voter: { username: string } | null;
}
