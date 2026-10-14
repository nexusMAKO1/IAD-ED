import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Layouts & Auth (eagerly loaded for instant boot)
import { DashboardLayout } from './layouts/DashboardLayout';
import { LoginPage } from './pages/LoginPage';

// Core Landing Page (eagerly loaded)
import { OverviewPage } from './pages/OverviewPage';

// Lazy-loaded route pages for code-splitting
const LiveAnalyticsPage = React.lazy(() =>
  import('./pages/analytics/LiveAnalyticsPage').then((m) => ({ default: m.LiveAnalyticsPage })),
);
const AudienceAnalyticsPage = React.lazy(() =>
  import('./pages/audience/AudienceAnalyticsPage').then((m) => ({ default: m.AudienceAnalyticsPage })),
);
const HeatmapPage = React.lazy(() =>
  import('./pages/heatmap/HeatmapPage').then((m) => ({ default: m.HeatmapPage })),
);
const SitesPage = React.lazy(() =>
  import('./pages/sites/SitesPage').then((m) => ({ default: m.SitesPage })),
);
const CamerasPage = React.lazy(() =>
  import('./pages/cameras/CamerasPage').then((m) => ({ default: m.CamerasPage })),
);
const DisplaysPage = React.lazy(() =>
  import('./pages/displays/DisplaysPage').then((m) => ({ default: m.DisplaysPage })),
);
const FleetPage = React.lazy(() =>
  import('./pages/fleet/FleetPage').then((m) => ({ default: m.FleetPage })),
);
const CampaignsPage = React.lazy(() =>
  import('./pages/campaigns/CampaignsPage').then((m) => ({ default: m.CampaignsPage })),
);
const CampaignPerformancePage = React.lazy(() =>
  import('./pages/campaign-analytics/CampaignPerformancePage').then((m) => ({ default: m.CampaignPerformancePage })),
);
const CampaignDetailPage = React.lazy(() =>
  import('./pages/campaign-analytics/CampaignDetailPage').then((m) => ({ default: m.CampaignDetailPage })),
);
const CampaignComparisonPage = React.lazy(() =>
  import('./pages/campaign-analytics/CampaignComparisonPage').then((m) => ({ default: m.CampaignComparisonPage })),
);
const ReportsPage = React.lazy(() =>
  import('./pages/reports/ReportsPage').then((m) => ({ default: m.ReportsPage })),
);
const AlertsPage = React.lazy(() =>
  import('./pages/alerts/AlertsPage').then((m) => ({ default: m.AlertsPage })),
);
const MonitoringPage = React.lazy(() =>
  import('./pages/monitoring/MonitoringPage').then((m) => ({ default: m.MonitoringPage })),
);
const SettingsPage = React.lazy(() =>
  import('./pages/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })),
);
const ProfilePage = React.lazy(() =>
  import('./pages/profile/ProfilePage').then((m) => ({ default: m.ProfilePage })),
);

// Providers & Global CSS
import { Toaster } from './components/ui/toaster';
import { AuthProvider, useAuth } from './store/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';
import './i18n';

// ---------------------------------------------------------------------------
// MQTT Initialisation
// ---------------------------------------------------------------------------
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function PageLoadingFallback() {
  return (
    <div className="flex h-64 w-full items-center justify-center" role="status" aria-label="Chargement">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
        <p className="text-sm text-slate-400">Chargement de la page…</p>
      </div>
    </div>
  );
}

// A simple Route Guard to protect dashboard paths
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) {
    return <div className="flex h-screen w-full items-center justify-center">Chargement de la session…</div>;
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <ErrorBoundary>
            <React.Suspense fallback={<PageLoadingFallback />}>
              <Routes>
                {/* Public login page */}
                <Route path="/login" element={<LoginPage />} />

                {/* Protected dashboard routes */}
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <DashboardLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<OverviewPage />} />
                  <Route path="analytics" element={<LiveAnalyticsPage />} />
                  <Route path="audience" element={<AudienceAnalyticsPage />} />
                  <Route path="heatmap" element={<HeatmapPage />} />
                  <Route path="sites" element={<SitesPage />} />
                  <Route path="cameras" element={<CamerasPage />} />
                  <Route path="displays" element={<DisplaysPage />} />
                  <Route path="fleet" element={<FleetPage />} />
                  <Route path="campaigns" element={<CampaignsPage />} />
                  <Route path="campaigns/performance" element={<CampaignPerformancePage />} />
                  <Route path="campaigns/compare" element={<CampaignComparisonPage />} />
                  <Route path="campaigns/:id/analytics" element={<CampaignDetailPage />} />
                  <Route path="reports" element={<ReportsPage />} />
                  <Route path="alerts" element={<AlertsPage />} />
                  <Route path="monitoring" element={<MonitoringPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                  <Route path="profile" element={<ProfilePage />} />
                </Route>

                {/* Fallbacks */}
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </React.Suspense>
          </ErrorBoundary>
        </BrowserRouter>
      </AuthProvider>
      <Toaster />
    </QueryClientProvider>
  </React.StrictMode>,
);
