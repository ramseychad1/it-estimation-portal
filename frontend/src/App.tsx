import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { AuthGuard } from "./components/AuthGuard";
import { RoleGuard } from "./components/RoleGuard";
import { ROLE_ADMIN, ROLE_REQUESTER, ROLE_REVENUE_MANAGER, ROLE_SOLUTION_OWNER } from "./lib/types";
import { LoginPage } from "./pages/LoginPage";
import { TemplateHistoryPage } from "./pages/placeholders";
import { ClientPricingPage } from "./pages/admin/ClientPricingPage";
import { DashboardPage } from "./pages/DashboardPage";
import { MyRequestsPage } from "./pages/MyRequestsPage";
import { NewEstimateRequestPage } from "./pages/NewEstimateRequestPage";
import { EstimateDetailPage } from "./pages/EstimateDetailPage";
import { ReviewQueuePage } from "./pages/ReviewQueuePage";
import { ReviewScreenPage } from "./pages/ReviewScreenPage";
import { TeamWorkloadPage } from "./pages/TeamWorkloadPage";
import { TeamWorkloadDetailPage } from "./pages/TeamWorkloadDetailPage";
import { TeamsPage } from "./pages/admin/TeamsPage";
import { SdlcPhasesPage } from "./pages/admin/SdlcPhasesPage";
import { BlendedRatesPage } from "./pages/admin/BlendedRatesPage";
import { UsersPage } from "./pages/admin/UsersPage";
import { ChangeLogPage } from "./pages/admin/ChangeLogPage";
import { ProductsPage } from "./pages/admin/ProductsPage";
import { ProductDetailPage } from "./pages/admin/products/ProductDetailPage";
import { SubFeatureDetailPage } from "./pages/admin/products/SubFeatureDetailPage";
import { QuestionsBrowserPage } from "./pages/admin/QuestionsBrowserPage";
import { ProgramTypesPage } from "./pages/admin/ProgramTypesPage";
import { CategoriesPage } from "./pages/admin/CategoriesPage";
import { ClientsPage } from "./pages/admin/ClientsPage";
import { ProgramsPage } from "./pages/admin/ProgramsPage";
import { AcceptInvitePage } from "./pages/AcceptInvitePage";
import { GlobalSettingsPage } from "./pages/admin/GlobalSettingsPage";
import { PricingReviewQueuePage } from "./pages/PricingReviewQueuePage";
import { PricingReviewDetailPage } from "./pages/PricingReviewDetailPage";

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
  requires: string | string[];
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

      {/* Requester surface — Admins + Revenue Managers inherit. */}
      <Route path="/requests" element={<RoleProtectedShell requires={[ROLE_REQUESTER, ROLE_REVENUE_MANAGER]}><MyRequestsPage /></RoleProtectedShell>} />
      <Route path="/requests/new" element={<RoleProtectedShell requires={[ROLE_REQUESTER, ROLE_REVENUE_MANAGER]}><NewEstimateRequestPage /></RoleProtectedShell>} />
      <Route path="/requests/:id" element={<RoleProtectedShell requires={[ROLE_REQUESTER, ROLE_REVENUE_MANAGER]}><EstimateDetailPage /></RoleProtectedShell>} />

      {/* Reviewer surface — Admins + Revenue Managers inherit. */}
      <Route path="/review" element={<RoleProtectedShell requires={[ROLE_SOLUTION_OWNER, ROLE_REVENUE_MANAGER]}><ReviewQueuePage /></RoleProtectedShell>} />
      <Route path="/review/:id" element={<RoleProtectedShell requires={[ROLE_SOLUTION_OWNER, ROLE_REVENUE_MANAGER]}><ReviewScreenPage /></RoleProtectedShell>} />

      {/* Reports surface — SO + Admin + Revenue Manager. */}
      <Route path="/reports/team-workload" element={<RoleProtectedShell requires={[ROLE_SOLUTION_OWNER, ROLE_REVENUE_MANAGER]}><TeamWorkloadPage /></RoleProtectedShell>} />
      <Route path="/reports/team-workload/:teamId" element={<RoleProtectedShell requires={[ROLE_SOLUTION_OWNER, ROLE_REVENUE_MANAGER]}><TeamWorkloadDetailPage /></RoleProtectedShell>} />

      {/* Catalog surface — SO + Admin + Revenue Manager. */}
      <Route path="/catalog/products" element={<RoleProtectedShell requires={[ROLE_SOLUTION_OWNER, ROLE_REVENUE_MANAGER]}><ProductsPage /></RoleProtectedShell>} />
      <Route path="/catalog/products/:productId" element={<RoleProtectedShell requires={[ROLE_SOLUTION_OWNER, ROLE_REVENUE_MANAGER]}><ProductDetailPage /></RoleProtectedShell>} />
      <Route path="/catalog/products/:productId/sub-features/:subFeatureId" element={<RoleProtectedShell requires={[ROLE_SOLUTION_OWNER, ROLE_REVENUE_MANAGER]}><SubFeatureDetailPage /></RoleProtectedShell>} />
      <Route path="/catalog/questions" element={<RoleProtectedShell requires={[ROLE_SOLUTION_OWNER, ROLE_REVENUE_MANAGER]}><QuestionsBrowserPage /></RoleProtectedShell>} />
      <Route path="/catalog/template-history" element={<RoleProtectedShell requires={[ROLE_SOLUTION_OWNER, ROLE_REVENUE_MANAGER]}><TemplateHistoryPage /></RoleProtectedShell>} />

      {/* Pricing Review surface — Revenue Manager + Admin. */}
      <Route path="/pricing-review" element={<RoleProtectedShell requires={[ROLE_REVENUE_MANAGER, ROLE_ADMIN]}><PricingReviewQueuePage /></RoleProtectedShell>} />
      <Route path="/pricing-review/:id" element={<RoleProtectedShell requires={[ROLE_REVENUE_MANAGER, ROLE_ADMIN]}><PricingReviewDetailPage /></RoleProtectedShell>} />

      {/* Admin surface — explicit Admin requirement except where Revenue Manager is also allowed. */}
      <Route path="/admin/settings" element={<RoleProtectedShell requires={ROLE_ADMIN}><GlobalSettingsPage /></RoleProtectedShell>} />
      <Route path="/admin/teams" element={<RoleProtectedShell requires={ROLE_ADMIN}><TeamsPage /></RoleProtectedShell>} />
      <Route path="/admin/phases" element={<RoleProtectedShell requires={ROLE_ADMIN}><SdlcPhasesPage /></RoleProtectedShell>} />
      <Route path="/admin/rates" element={<RoleProtectedShell requires={ROLE_ADMIN}><BlendedRatesPage /></RoleProtectedShell>} />
      <Route path="/admin/program-types" element={<RoleProtectedShell requires={ROLE_ADMIN}><ProgramTypesPage /></RoleProtectedShell>} />
      <Route path="/admin/clients" element={<RoleProtectedShell requires={ROLE_ADMIN}><ClientsPage /></RoleProtectedShell>} />
      <Route path="/admin/programs" element={<RoleProtectedShell requires={ROLE_ADMIN}><ProgramsPage /></RoleProtectedShell>} />
      <Route path="/admin/categories" element={<RoleProtectedShell requires={[ROLE_ADMIN, ROLE_REVENUE_MANAGER]}><CategoriesPage /></RoleProtectedShell>} />
      <Route path="/admin/client-pricing" element={<RoleProtectedShell requires={[ROLE_ADMIN, ROLE_REVENUE_MANAGER]}><ClientPricingPage /></RoleProtectedShell>} />
      <Route path="/admin/users" element={<RoleProtectedShell requires={ROLE_ADMIN}><UsersPage /></RoleProtectedShell>} />
      <Route path="/admin/change-log" element={<RoleProtectedShell requires={ROLE_ADMIN}><ChangeLogPage /></RoleProtectedShell>} />

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
