import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { Layout } from './components/Layout';
import { ClubLayout } from './pages/club/ClubLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AccessGate } from './components/AccessGate';
import { AdminRoute } from './components/AdminRoute';
import { HomePage } from './pages/HomePage';
import { ClubHomePage } from './pages/club/ClubHomePage';
import { ClubCalendarPage } from './pages/club/ClubCalendarPage';
import { HallOfFamePage } from './pages/club/HallOfFamePage';
import { ExamScopePage } from './pages/club/ExamScopePage';
import { ClubNotificationsPage, ClubNotificationDetailPage } from './pages/club/ClubNotificationsPage';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { VerifyEmailPage } from './pages/VerifyEmailPage';
import { ResendVerificationPage } from './pages/ResendVerificationPage';
import { ChangePasswordPage } from './pages/ChangePasswordPage';
import { RegisterNamePage } from './pages/RegisterNamePage';
import { PatchNotesPage } from './pages/PatchNotesPage';
import { ProblemListPage } from './pages/ProblemListPage';
import { ProblemDetailPage } from './pages/ProblemDetailPage';
import { SubmitPage } from './pages/SubmitPage';
import { MyProblemsPage } from './pages/MyProblemsPage';
import { SubmissionPage } from './pages/SubmissionPage';
import { MySubmissionsPage } from './pages/MySubmissionsPage';
import { SubmissionFeedPage } from './pages/SubmissionFeedPage';
import { ContestListPage } from './pages/contests/ContestListPage';
import { ContestDetailPage } from './pages/contests/ContestDetailPage';
import { ContestLeaderboardPage } from './pages/contests/ContestLeaderboardPage';
import { RankingPage } from './pages/RankingPage';
import { ProfilePage } from './pages/ProfilePage';
import { SettingsPage } from './pages/SettingsPage';
import { EditProblemPage } from './pages/EditProblemPage';
import { NewProblemPage } from './pages/admin/NewProblemPage';
import { AdminLayout } from './pages/admin/AdminLayout';
import { ProposalsPage } from './pages/admin/ProposalsPage';
import { BulkUsersPage } from './pages/admin/BulkUsersPage';
import { JudgeConfigPage } from './pages/admin/JudgeConfigPage';
import { ApiKeysPage } from './pages/admin/ApiKeysPage';
import { AccountsPage } from './pages/admin/AccountsPage';
import { NotificationsPage } from './pages/admin/NotificationsPage';
import { StudentIdAdminPage } from './pages/admin/StudentIdAdminPage';
import { ContestsAdminPage } from './pages/admin/ContestsAdminPage';
import { GroupsAdminPage } from './pages/admin/GroupsAdminPage';
import { ClassesAdminPage } from './pages/admin/ClassesAdminPage';
import { AdminOverviewPage } from './pages/admin/AdminOverviewPage';
import { AdminProblemsPage } from './pages/admin/AdminProblemsPage';
import { MailSettingsPage } from './pages/admin/MailSettingsPage';
import { BannerSettingsPage } from './pages/admin/BannerSettingsPage';
import { ClassListPage } from './pages/classes/ClassListPage';
import { ClassDetailPage } from './pages/classes/ClassDetailPage';
import { CommunityListPage } from './pages/community/CommunityListPage';
import { CommunityPostPage } from './pages/community/CommunityPostPage';
import { NewCommunityPostPage } from './pages/community/NewCommunityPostPage';
import { ClubSchedulesAdminPage } from './pages/admin/ClubSchedulesAdminPage';
import { DeployPage } from './pages/admin/DeployPage';
import { ServerInfoPage } from './pages/admin/ServerInfoPage';
import { ReportsAdminPage } from './pages/admin/ReportsAdminPage';
import { SendNotificationPage } from './pages/admin/SendNotificationPage';
import { NotificationsPage as MyNotificationsPage, NotificationDetailPage } from './pages/NotificationsPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* 동아리 홈페이지 마이그레이션(club-homepage → 이 앱). OJ 공용 Layout이 아니라
              자체 헤더(ClubLayout, 예전 club-homepage 헤더를 그대로 옮김)를 쓴다.
              진행 중에는 nginx가 아직 /home/*를 옛 정적 사이트 컨테이너로 프록시하므로,
              배포 전환(인프라 마지막 단계) 전까지는 로컬 개발 서버에서만 들어올 수 있다. */}
          <Route element={<ClubLayout />}>
            <Route path="/home" element={<ClubHomePage />} />
            <Route path="/home/calendar" element={<ClubCalendarPage />} />
            {/* 공개 게시판(HOME 보드): club-homepage/community.html과 같은 기준(로그인만 필요). */}
            <Route
              path="/home/community"
              element={
                <AccessGate level="login">
                  <CommunityListPage board="HOME" basePath="/home/community" />
                </AccessGate>
              }
            />
            <Route
              path="/home/community/new"
              element={
                <AccessGate level="login">
                  <NewCommunityPostPage board="HOME" basePath="/home/community" />
                </AccessGate>
              }
            />
            <Route
              path="/home/community/:id"
              element={
                <AccessGate level="login">
                  <CommunityPostPage basePath="/home/community" />
                </AccessGate>
              }
            />
            {/* 동아리 게시판(CLUB 보드): club-board.html과 같은 기준(로그인 + 부원). */}
            <Route
              path="/home/club-board"
              element={
                <AccessGate level="member">
                  <CommunityListPage board="CLUB" basePath="/home/club-board" />
                </AccessGate>
              }
            />
            <Route
              path="/home/club-board/new"
              element={
                <AccessGate level="member">
                  <NewCommunityPostPage board="CLUB" basePath="/home/club-board" />
                </AccessGate>
              }
            />
            <Route
              path="/home/club-board/:id"
              element={
                <AccessGate level="member">
                  <CommunityPostPage basePath="/home/club-board" />
                </AccessGate>
              }
            />
            {/* 명예의 전당: 백엔드(GET /users/hall-of-fame)가 로그인만 요구한다(부원 불필요). */}
            <Route
              path="/home/hall-of-fame"
              element={
                <AccessGate level="login">
                  <HallOfFamePage />
                </AccessGate>
              }
            />
            {/* 시험범위: GET /api/exam-scopes는 가드가 없어 완전 공개다. */}
            <Route path="/home/exam-scope" element={<ExamScopePage />} />
            {/* 알림: 본인 것만 보이므로 로그인 필요. OJ 자체 /notifications와는 의도적으로 분리. */}
            <Route
              path="/home/notifications"
              element={
                <AccessGate level="login">
                  <ClubNotificationsPage />
                </AccessGate>
              }
            />
            <Route
              path="/home/notifications/:id"
              element={
                <AccessGate level="login">
                  <ClubNotificationDetailPage />
                </AccessGate>
              }
            />
          </Route>
          <Route element={<Layout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route path="/resend-verification" element={<ResendVerificationPage />} />
            <Route path="/patch-notes" element={<PatchNotesPage />} />
            <Route path="/problems" element={<ProblemListPage />} />
            <Route path="/ranking" element={<RankingPage />} />
            <Route path="/notifications" element={<MyNotificationsPage />} />
            <Route path="/notifications/:id" element={<NotificationDetailPage />} />
            <Route path="/users/:username" element={<ProfilePage />} />
            {/* 대회는 내용 열람까지 공개. 참가만 로그인이 필요하다(대회 상세에서 처리). */}
            <Route path="/contests" element={<ContestListPage />} />
            <Route path="/contests/:slug" element={<ContestDetailPage />} />
            <Route path="/contests/:slug/leaderboard" element={<ContestLeaderboardPage />} />
            {/* 로그인이 필요한 화면은 리다이렉트 대신 안내 화면을 보여준다.
                (헤더 탭은 그대로 두고, 들어가면 왜 못 보는지 알려준다.) */}
            <Route path="/community" element={<AccessGate level="login"><CommunityListPage /></AccessGate>} />
            <Route path="/community/:id" element={<AccessGate level="login"><CommunityPostPage /></AccessGate>} />
            <Route path="/problems/mine" element={<AccessGate level="login"><MyProblemsPage /></AccessGate>} />
            <Route path="/classes" element={<AccessGate level="login"><ClassListPage /></AccessGate>} />
            <Route path="/classes/:slug" element={<AccessGate level="login"><ClassDetailPage /></AccessGate>} />
            <Route path="/settings" element={<AccessGate level="login"><SettingsPage /></AccessGate>} />
            <Route element={<ProtectedRoute />}>
              <Route path="/change-password" element={<ChangePasswordPage />} />
              <Route path="/register-name" element={<RegisterNamePage />} />
              <Route path="/community/new" element={<NewCommunityPostPage />} />
              <Route path="/problems/new" element={<NewProblemPage />} />
              <Route path="/problems/:slug/edit" element={<EditProblemPage />} />
              <Route path="/problems/:slug/submit" element={<SubmitPage />} />
            </Route>
            <Route path="/problems/:slug" element={<ProblemDetailPage />} />
            <Route path="/submissions" element={<AccessGate level="login"><SubmissionFeedPage /></AccessGate>} />
            {/* ':id'보다 먼저 둬서 'me'가 제출 ID로 해석되지 않게 한다. */}
            <Route path="/submissions/me" element={<AccessGate level="login"><MySubmissionsPage /></AccessGate>} />
            <Route element={<ProtectedRoute />}>
              <Route path="/submissions/:id" element={<SubmissionPage />} />
            </Route>
            <Route element={<AdminRoute />}>
              <Route element={<AdminLayout />}>
                <Route path="/admin" element={<AdminOverviewPage />} />
                <Route path="/admin/problems" element={<AdminProblemsPage />} />
                <Route path="/admin/reports" element={<ReportsAdminPage />} />
                <Route path="/admin/send-notification" element={<SendNotificationPage />} />
                <Route path="/admin/problems/new" element={<NewProblemPage />} />
                <Route path="/admin/proposals" element={<ProposalsPage />} />
                <Route path="/admin/users/bulk" element={<BulkUsersPage />} />
                <Route path="/admin/judge-config" element={<JudgeConfigPage />} />
                <Route path="/admin/mail" element={<MailSettingsPage />} />
                <Route path="/admin/banner" element={<BannerSettingsPage />} />
                <Route path="/admin/club-schedules" element={<ClubSchedulesAdminPage />} />
                <Route path="/admin/server" element={<ServerInfoPage />} />
                <Route path="/admin/deploy" element={<DeployPage />} />
                <Route path="/admin/api-keys" element={<ApiKeysPage />} />
                <Route path="/admin/accounts" element={<AccountsPage />} />
                <Route path="/admin/notifications" element={<NotificationsPage />} />
                <Route path="/admin/student-id" element={<StudentIdAdminPage />} />
                <Route path="/admin/contests" element={<ContestsAdminPage />} />
                <Route path="/admin/groups" element={<GroupsAdminPage />} />
                <Route path="/admin/classes" element={<ClassesAdminPage />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
