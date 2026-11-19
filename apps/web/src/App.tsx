import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell, ScrollToTop } from "@/components/app-shell";
import { Wordmark } from "@/components/brand";
import { useAuth, useConfig } from "@/lib/queries";

const LandingPage = lazy(() => import("@/pages/landing"));
const AuthPage = lazy(() => import("@/pages/auth"));
const OverviewPage = lazy(() => import("@/pages/overview"));
const BusinessesPage = lazy(() => import("@/pages/businesses"));
const CampaignsPage = lazy(() => import("@/pages/campaigns"));
const NewCampaignPage = lazy(() => import("@/pages/new-campaign"));
const CampaignDetailPage = lazy(() => import("@/pages/campaign-detail"));
const StudioPage = lazy(() => import("@/pages/studio"));
const ActivityPage = lazy(() => import("@/pages/activity"));
const SettingsPage = lazy(() => import("@/pages/settings"));
const CalendarPage = lazy(() => import("@/pages/calendar"));
const BookingsPage = lazy(() => import("@/pages/bookings"));
const CustomersPage = lazy(() => import("@/pages/customers"));
const ServicesPage = lazy(() => import("@/pages/services"));
const TeamPage = lazy(() => import("@/pages/team"));
const NotFoundPage = lazy(() => import("@/pages/not-found"));

function RouteFallback() {
  return (
    <div className="grid min-h-[60vh] place-items-center" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-4 text-[var(--muted)]">
        <Wordmark />
        <span className="text-sm">Opening the workspace…</span>
      </div>
    </div>
  );
}

function WorkspaceRoutes() {
  const config = useConfig();
  const authRequired = config.data?.config?.authMode === "required";
  const auth = useAuth(authRequired);

  if (authRequired && (config.isLoading || auth.isLoading)) return <RouteFallback />;
  if (authRequired && !auth.data) return <Navigate to="/auth" replace />;

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/app" element={<AppShell />}>
        <Route index element={<Navigate to="/app/overview" replace />} />
        <Route path="overview" element={<OverviewPage />} />
        <Route path="businesses" element={<BusinessesPage />} />
        <Route path="campaigns" element={<CampaignsPage />} />
        <Route path="campaigns/new" element={<NewCampaignPage />} />
        <Route path="campaigns/:campaignId" element={<CampaignDetailPage />} />
        <Route path="studio" element={<StudioPage />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="bookings" element={<BookingsPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="services" element={<ServicesPage />} />
        <Route path="team" element={<TeamPage />} />
        <Route path="activity" element={<ActivityPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Suspense fallback={<RouteFallback />}>
        <WorkspaceRoutes />
      </Suspense>
    </>
  );
}
