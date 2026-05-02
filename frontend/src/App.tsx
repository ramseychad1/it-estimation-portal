import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { AuthGuard } from "./components/AuthGuard";
import { RoleGuard } from "./components/RoleGuard";
import { ROLE_ADMIN, ROLE_REQUESTER, ROLE_SOLUTION_OWNER } from "./lib/types";
import { LoginPage } from "./pages/LoginPage";
import { TemplateHistoryPage } from "./pages/placeholders";
import { DashboardPage } from "./pages/DashboardPage";
import { MyRequestsPage } from "./pages/MyRequestsPage";
import { NewEstimateRequestPage } from "./pages/NewEstimateRequestPage";
import { EstimateDetailPage } from "./pages/EstimateDetailPage";
import { ReviewQueuePage } from "./pages/ReviewQueuePage";
import { ReviewScreenPage } from "./pages/ReviewScreenPage";
import { TeamsPage } from "./pages/admin/TeamsPage";
import { SdlcPhasesPage } from "./pages/admin/SdlcPhasesPage";
import { BlendedRatesPage } from "./pages/admin/BlendedRatesPage";
import { UsersPage } from "./pages/admin/UsersPage";
import { ChangeLogPage } from "./pages/admin/ChangeLogPage";
import { ProductsPage } from "./pages/admin/ProductsPage";
import { ProductDetailPage } from "./pages/admin/products/ProductDetailPage";
import { SubFeatureDetailPage } from "./pages/admin/products/SubFeatureDetailPage";
import { QuestionsBrowserPage } from "./pages/admin/QuestionsBrowserPage";
import { AcceptInvitePage } from "./pages/AcceptInvitePage";

function ProtectedShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <AppShell>{children}</AppShell>
    </AuthGuard>
  );
}

/**
 * Phase 7.5 — three-line wrapper that pairs AuthGuard (logged in) with
 * RoleGuard (logged in AND has the required role, with Admin
 * implication). Use it instead of {@code ProtectedShell} for any route
 * that should be role-gated. Routes everyone-with-an-account can hit
 * (Dashboard) keep using {@code ProtectedShell}.
 */
function RoleProtectedShell({
  requires,
  children,
}: {
  requires: string;
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <AppShell>
        <RoleGuard requires={requires}>{children}</RoleGuard>
      </AppShell>
    </AuthGuard>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/invite/:token" element={<AcceptInvitePage />} />

      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      {/* Dashboard visible to every authenticated user (the page itself
          adapts content by role). */}
      <Route path="/dashboard" element={<ProtectedShell><DashboardPage /></ProtectedShell>} />

      {/* Requester surface — Admins inherit. */}
      <Route path="/requests" element={<RoleProtectedShell requires={ROLE_REQUESTER}><MyRequestsPage /></RoleProtectedShell>} />
      <Route path="/requests/new" element={<RoleProtectedShell requires={ROLE_REQUESTER}><NewEstimateRequestPage /></RoleProtectedShell>} />
      <Route path="/requests/:id" element={<RoleProtectedShell requires={ROLE_REQUESTER}><EstimateDetailPage /></RoleProtectedShell>} />

      {/* Reviewer surface — Admins inherit. */}
      <Route path="/review" element={<RoleProtectedShell requires={ROLE_SOLUTION_OWNER}><ReviewQueuePage /></RoleProtectedShell>} />
      <Route path="/review/:id" element={<RoleProtectedShell requires={ROLE_SOLUTION_OWNER}><ReviewScreenPage /></RoleProtectedShell>} />

      {/* Catalog surface — Admins inherit. */}
      <Route path="/catalog/products" element={<RoleProtectedShell requires={ROLE_SOLUTION_OWNER}><ProductsPage /></RoleProtectedShell>} />
      <Route path="/catalog/products/:productId" element={<RoleProtectedShell requires={ROLE_SOLUTION_OWNER}><ProductDetailPage /></RoleProtectedShell>} />
      <Route path="/catalog/products/:productId/sub-features/:subFeatureId" element={<RoleProtectedShell requires={ROLE_SOLUTION_OWNER}><SubFeatureDetailPage /></RoleProtectedShell>} />
      <Route path="/catalog/questions" element={<RoleProtectedShell requires={ROLE_SOLUTION_OWNER}><QuestionsBrowserPage /></RoleProtectedShell>} />
      <Route path="/catalog/template-history" element={<RoleProtectedShell requires={ROLE_SOLUTION_OWNER}><TemplateHistoryPage /></RoleProtectedShell>} />

      {/* Admin surface — explicit Admin requirement (no implication needed; Admin IS the bar). */}
      <Route path="/admin/teams" element={<RoleProtectedShell requires={ROLE_ADMIN}><TeamsPage /></RoleProtectedShell>} />
      <Route path="/admin/phases" element={<RoleProtectedShell requires={ROLE_ADMIN}><SdlcPhasesPage /></RoleProtectedShell>} />
      <Route path="/admin/rates" element={<RoleProtectedShell requires={ROLE_ADMIN}><BlendedRatesPage /></RoleProtectedShell>} />
      <Route path="/admin/users" element={<RoleProtectedShell requires={ROLE_ADMIN}><UsersPage /></RoleProtectedShell>} />
      <Route path="/admin/change-log" element={<RoleProtectedShell requires={ROLE_ADMIN}><ChangeLogPage /></RoleProtectedShell>} />

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
