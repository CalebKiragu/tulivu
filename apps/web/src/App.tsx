import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell, ScrollToTop } from "@/components/app-shell";
import { Wordmark } from "@/components/brand";

const LandingPage = lazy(() => import("@/pages/landing"));
const OverviewPage = lazy(() => import("@/pages/overview"));
const BusinessesPage = lazy(() => import("@/pages/businesses"));
const CampaignsPage = lazy(() => import("@/pages/campaigns"));
const NewCampaignPage = lazy(() => import("@/pages/new-campaign"));
const CampaignDetailPage = lazy(() => import("@/pages/campaign-detail"));
const StudioPage = lazy(() => import("@/pages/studio"));
const ActivityPage = lazy(() => import("@/pages/activity"));
const SettingsPage = lazy(() => import("@/pages/settings"));
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

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/app" element={<AppShell />}>
            <Route index element={<Navigate to="/app/overview" replace />} />
            <Route path="overview" element={<OverviewPage />} />
            <Route path="businesses" element={<BusinessesPage />} />
            <Route path="campaigns" element={<CampaignsPage />} />
            <Route path="campaigns/new" element={<NewCampaignPage />} />
            <Route path="campaigns/:campaignId" element={<CampaignDetailPage />} />
            <Route path="studio" element={<StudioPage />} />
            <Route path="activity" element={<ActivityPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </>
  );
}
