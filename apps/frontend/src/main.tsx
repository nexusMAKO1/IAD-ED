import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Layouts & Auth
import { DashboardLayout } from './layouts/DashboardLayout';
import { LoginPage } from './pages/LoginPage';

// Pages
import { OverviewPage } from './pages/OverviewPage';
import { LiveAnalyticsPage } from './pages/analytics/LiveAnalyticsPage';
import { AudienceAnalyticsPage } from './pages/audience/AudienceAnalyticsPage';
import { HeatmapPage } from './pages/heatmap/HeatmapPage';
import { SitesPage } from './pages/sites/SitesPage';
import { CamerasPage } from './pages/cameras/CamerasPage';
import { FleetPage } from './pages/fleet/FleetPage';
import { CampaignsPage } from './pages/campaigns/CampaignsPage';
import { ReportsPage } from './pages/reports/ReportsPage';
import { AlertsPage } from './pages/alerts/AlertsPage';
import { MonitoringPage } from './pages/monitoring/MonitoringPage';
import { SettingsPage } from './pages/settings/SettingsPage';
import { ProfilePage } from './pages/profile/ProfilePage';

// Providers & Global CSS
import { Toaster } from './components/ui/toaster';
import { mqttClient } from './mqtt/mqtt.client';
import './index.css';

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

// A simple Route Guard to protect dashboard paths
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('access_token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
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
            <Route path="fleet" element={<FleetPage />} />
            <Route path="campaigns" element={<CampaignsPage />} />
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
      </BrowserRouter>
      <Toaster />
    </QueryClientProvider>
  </React.StrictMode>,
);
