import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AdminRoute } from './components/AdminRoute';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { VerifyEmailPage } from './pages/VerifyEmailPage';
import { ResendVerificationPage } from './pages/ResendVerificationPage';
import { ChangePasswordPage } from './pages/ChangePasswordPage';
import { RegisterNamePage } from './pages/RegisterNamePage';
import { ProblemListPage } from './pages/ProblemListPage';
import { ProblemDetailPage } from './pages/ProblemDetailPage';
import { MyProblemsPage } from './pages/MyProblemsPage';
import { SubmissionPage } from './pages/SubmissionPage';
import { MySubmissionsPage } from './pages/MySubmissionsPage';
import { ContestListPage } from './pages/contests/ContestListPage';
import { ContestDetailPage } from './pages/contests/ContestDetailPage';
import { ContestLeaderboardPage } from './pages/contests/ContestLeaderboardPage';
import { RankingPage } from './pages/RankingPage';
import { ProfilePage } from './pages/ProfilePage';
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
import { ClassListPage } from './pages/classes/ClassListPage';
import { ClassDetailPage } from './pages/classes/ClassDetailPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route path="/resend-verification" element={<ResendVerificationPage />} />
            <Route path="/problems" element={<ProblemListPage />} />
            <Route path="/contests" element={<ContestListPage />} />
            <Route path="/contests/:slug" element={<ContestDetailPage />} />
            <Route path="/contests/:slug/leaderboard" element={<ContestLeaderboardPage />} />
            <Route path="/ranking" element={<RankingPage />} />
            <Route path="/users/:username" element={<ProfilePage />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/change-password" element={<ChangePasswordPage />} />
              <Route path="/register-name" element={<RegisterNamePage />} />
              <Route path="/problems/mine" element={<MyProblemsPage />} />
              <Route path="/problems/new" element={<NewProblemPage />} />
              <Route path="/problems/:slug/edit" element={<EditProblemPage />} />
              <Route path="/classes" element={<ClassListPage />} />
              <Route path="/classes/:slug" element={<ClassDetailPage />} />
            </Route>
            <Route path="/problems/:slug" element={<ProblemDetailPage />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/submissions" element={<MySubmissionsPage />} />
              <Route path="/submissions/:id" element={<SubmissionPage />} />
            </Route>
            <Route element={<AdminRoute />}>
              <Route element={<AdminLayout />}>
                <Route path="/admin" element={<AdminOverviewPage />} />
                <Route path="/admin/problems" element={<AdminProblemsPage />} />
                <Route path="/admin/problems/new" element={<NewProblemPage />} />
                <Route path="/admin/proposals" element={<ProposalsPage />} />
                <Route path="/admin/users/bulk" element={<BulkUsersPage />} />
                <Route path="/admin/judge-config" element={<JudgeConfigPage />} />
                <Route path="/admin/mail" element={<MailSettingsPage />} />
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
