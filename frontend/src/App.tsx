import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { AuthGuard } from "./components/AuthGuard";
import { LoginPage } from "./pages/LoginPage";
import {
  CriticalQuestionsPage,
  DashboardPage,
  ProductsPage,
  RequestsPage,
  TemplateHistoryPage,
} from "./pages/placeholders";
import { TeamsPage } from "./pages/admin/TeamsPage";
import { SdlcPhasesPage } from "./pages/admin/SdlcPhasesPage";
import { BlendedRatesPage } from "./pages/admin/BlendedRatesPage";
import { UsersPage } from "./pages/admin/UsersPage";
import { ChangeLogPage } from "./pages/admin/ChangeLogPage";
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
      <Route path="/requests" element={<ProtectedShell><RequestsPage /></ProtectedShell>} />

      <Route path="/catalog/products" element={<ProtectedShell><ProductsPage /></ProtectedShell>} />
      <Route path="/catalog/questions" element={<ProtectedShell><CriticalQuestionsPage /></ProtectedShell>} />
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
