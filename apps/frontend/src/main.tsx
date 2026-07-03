import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DashboardLayout } from './layouts/DashboardLayout';
import { OverviewPage } from './pages/OverviewPage';
import { FleetPage } from './pages/fleet/FleetPage';
import { LoginPage } from './pages/LoginPage';
import { Toaster } from './components/ui/toaster';
import { mqttClient } from './mqtt/mqtt.client';
import './index.css';

// ---------------------------------------------------------------------------
// MQTT Initialisation
// ---------------------------------------------------------------------------
// Connect to the MQTT broker only when:
//   1. The user is already authenticated (access_token in localStorage), AND
//   2. MQTT credentials are available (VITE_MQTT_USERNAME / VITE_MQTT_PASSWORD).
//
// This prevents "Not authorized" spam on the login page and for unauthenticated users.
// The mqttClient.connect() itself is a no-op when credentials are absent.
// The mqttClient.connect() is now handled strictly after user login (e.g., in LoginPage.tsx).

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
            <Route path="fleet" element={<FleetPage />} />
          </Route>

          {/* Fallbacks */}
          <Route path="/" element={<Navigate to="/dashboard/fleet" replace />} />
          <Route path="*" element={<Navigate to="/dashboard/fleet" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster />
    </QueryClientProvider>
  </React.StrictMode>,
);
