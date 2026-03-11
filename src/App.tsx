import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { initializeMockData } from './data/mockData';
import { getCurrentUser } from './types/index';
import Layout from './components/Layout';

// ─── Seed localStorage on first load ─────────────────────────────────────────
initializeMockData();

// ─── Lazy page imports ───────────────────────────────────────────────────────
const Login = React.lazy(() => import('./pages/Login'));
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const LeadPipeline = React.lazy(() => import('./pages/LeadPipeline'));
const Inbox = React.lazy(() => import('./pages/Inbox'));
const Reminders = React.lazy(() => import('./pages/Reminders'));
const Analytics = React.lazy(() => import('./pages/Analytics'));
const Settings = React.lazy(() => import('./pages/Settings'));
const Calling = React.lazy(() => import('./pages/Calling'));
const Documents = React.lazy(() => import('./pages/Documents'));
const Leaderboard = React.lazy(() => import('./pages/Leaderboard'));
const SocialMedia = React.lazy(() => import('./pages/SocialMedia'));

// ─── Loading spinner ─────────────────────────────────────────────────────────
function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-screen w-full">
      <div className="animate-spin rounded-full border-4 border-blue-600 border-t-transparent w-12 h-12" />
    </div>
  );
}

// ─── ProtectedRoute ──────────────────────────────────────────────────────────
function ProtectedRoute({ allowedRoles }: { allowedRoles?: string[] }) {
  const user = getCurrentUser();

  if (!user || !user.isLoggedIn) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}

// ─── RootRedirect ────────────────────────────────────────────────────────────
function RootRedirect() {
  const user = getCurrentUser();
  return user && user.isLoggedIn ? (
    <Navigate to="/dashboard" replace />
  ) : (
    <Navigate to="/login" replace />
  );
}

// ─── App ─────────────────────────────────────────────────────────────────────
function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingSpinner />}>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<RootRedirect />} />

          {/* Protected — all roles */}
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/leads" element={<LeadPipeline />} />
              <Route path="/inbox" element={<Inbox />} />
              <Route path="/reminders" element={<Reminders />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/calling" element={<Calling />} />
              <Route path="/documents" element={<Documents />} />
              <Route path="/leaderboard" element={<Leaderboard />} />
              <Route path="/social" element={<SocialMedia />} />
            </Route>
          </Route>

          {/* Protected — Admin & Manager only */}
          <Route element={<ProtectedRoute allowedRoles={['Admin', 'Manager']} />}>
            <Route element={<Layout />}>
              <Route path="/settings" element={<Settings />} />
            </Route>
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
