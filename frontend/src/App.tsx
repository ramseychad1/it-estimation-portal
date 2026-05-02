import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { AuthGuard } from "./components/AuthGuard";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage, TemplateHistoryPage } from "./pages/placeholders";
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

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/invite/:token" element={<AcceptInvitePage />} />

      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      <Route path="/dashboard" element={<ProtectedShell><DashboardPage /></ProtectedShell>} />
      <Route path="/requests" element={<ProtectedShell><MyRequestsPage /></ProtectedShell>} />
      <Route path="/requests/new" element={<ProtectedShell><NewEstimateRequestPage /></ProtectedShell>} />
      <Route path="/requests/:id" element={<ProtectedShell><EstimateDetailPage /></ProtectedShell>} />

      <Route path="/review" element={<ProtectedShell><ReviewQueuePage /></ProtectedShell>} />
      <Route path="/review/:id" element={<ProtectedShell><ReviewScreenPage /></ProtectedShell>} />

      <Route path="/catalog/products" element={<ProtectedShell><ProductsPage /></ProtectedShell>} />
      <Route path="/catalog/products/:productId" element={<ProtectedShell><ProductDetailPage /></ProtectedShell>} />
      <Route path="/catalog/products/:productId/sub-features/:subFeatureId" element={<ProtectedShell><SubFeatureDetailPage /></ProtectedShell>} />
      <Route path="/catalog/questions" element={<ProtectedShell><QuestionsBrowserPage /></ProtectedShell>} />
      <Route path="/catalog/template-history" element={<ProtectedShell><TemplateHistoryPage /></ProtectedShell>} />

      <Route path="/admin/teams" element={<ProtectedShell><TeamsPage /></ProtectedShell>} />
      <Route path="/admin/phases" element={<ProtectedShell><SdlcPhasesPage /></ProtectedShell>} />
      <Route path="/admin/rates" element={<ProtectedShell><BlendedRatesPage /></ProtectedShell>} />
      <Route path="/admin/users" element={<ProtectedShell><UsersPage /></ProtectedShell>} />
      <Route path="/admin/change-log" element={<ProtectedShell><ChangeLogPage /></ProtectedShell>} />

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
