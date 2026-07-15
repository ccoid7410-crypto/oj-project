export type Role = 'USER' | 'MEMBER' | 'ADMIN';

export type ThemePref = 'system' | 'light' | 'dark';

export interface User {
  id: string;
  email: string;
  username: string;
  name: string | null;
  preferredLanguage: Language | null;
  role: Role;
  customTitle: string | null;
  rating: number;
  studentId: string | null;
  theme?: ThemePref; // 계정에 저장된 UI 테마 설정
  createdAt?: string; // GET /users/me 응답에만 포함 (본인 전용)
  generation?: string | null; // 기수. GET /users/me 응답에만 포함 (본인 전용)
  avatarVersion?: number | null; // 아바타 캐시 무효화용. null이면 기본(회색) 아바타
  mustChangePassword?: boolean;
}

export interface StudentIdWindow {
  startsAt: string | null;
  endsAt: string | null;
  isOpen: boolean;
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
  myStatus: 'solved' | 'attempted' | null; // 로그인한 사용자의 정답/오답 여부 (비로그인은 null)
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
  customTitle: string | null;
  rating: number;
  avatarVersion: number | null;
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
  customTitle: string | null;
  rating: number;
  bio: string | null;
  websites: string[];
  avatarVersion: number | null; // 아바타 캐시 무효화용 타임스탬프. null이면 기본(회색) 아바타
  bannerVersion: number | null; // 배너 캐시 무효화용. null이면 배너 없음
  solvedCount: number;
  rank: number | null;
  solvedProblems: UserProfileProblem[];
}

export interface AdminUser {
  id: string;
  username: string;
  name: string | null;
  email: string;
  role: Role;
  customTitle: string | null;
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

export interface Group {
  id: string;
  name: string;
  createdAt: string;
  memberCount: number;
}

export interface GroupMember {
  id: string;
  username: string;
  email: string;
  rating: number;
}

export interface ClassSummary {
  id: string;
  name: string;
  slug: string;
  description: string;
  memberCount: number;
  problemCount: number;
  createdAt?: string;
}

export interface ClassNotice {
  id: string;
  title: string;
  content: string;
  createdAt: string;
}

export interface ClassProblemRef {
  id: string;
  displayId: number;
  title: string;
  slug: string;
  difficulty: Difficulty;
  level: number;
  order: number;
}

export interface ClassRankingRow {
  userId: string;
  username: string;
  rating: number;
  solvedCount: number;
}

export interface ClassDetail {
  id: string;
  name: string;
  slug: string;
  description: string;
  problems: ClassProblemRef[];
  notices: ClassNotice[];
  ranking: ClassRankingRow[];
}

export interface AdminProblemRow {
  id: string;
  displayId: number;
  title: string;
  slug: string;
  status: string;
  contestOnly: boolean;
  createdAt: string;
  author: { username: string };
}

export interface AdminOverviewStats {
  users: { total: number; members: number; banned: number };
  problems: { total: number; draft: number; pendingReview: number; published: number; rejected: number };
  submissions: { today: number; total: number };
  judgeHealth: {
    queueDepth: number;
    oldestPendingAgeSec: number;
    internalErrorsLast24h: number;
    compileErrorsLast24h: number;
  };
}

export interface ProblemComment {
  id: string;
  problemId: string;
  content: string;
  parentId: string | null;
  createdAt: string;
  user: { username: string; customTitle: string | null; avatarVersion: number | null };
}

export interface CommunityAuthor {
  username: string;
  customTitle: string | null;
  avatarVersion: number | null;
}

export interface VoteSummary {
  likeCount: number;
  dislikeCount: number;
  myVote: number; // 1 = 좋아요, -1 = 싫어요, 0 = 없음
}

export interface CommunityPostSummary {
  id: string;
  title: string;
  author: CommunityAuthor;
  createdAt: string;
  commentCount: number;
  likeCount: number;
  dislikeCount: number;
  myVote: number;
}

export interface CommunityComment {
  id: string;
  content: string;
  parentId: string | null;
  createdAt: string;
  user: CommunityAuthor;
  likeCount: number;
  dislikeCount: number;
  myVote: number;
}

export interface CommunityPostDetail {
  id: string;
  title: string;
  content: string;
  author: CommunityAuthor;
  createdAt: string;
  updatedAt: string;
  likeCount: number;
  dislikeCount: number;
  myVote: number;
  comments: CommunityComment[];
}
