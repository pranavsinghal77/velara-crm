import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import Layout from './components/Layout';
import Login from './pages/Login';
import { useCrmStore } from './store/useCrmStore';
import type { Role } from './types/models';

/**
 * Routes are code-split. Every page used to be imported eagerly, which is why
 * the production bundle was a single 1.06 MB chunk - a poor trade for an app
 * that advertises low-bandwidth performance.
 */
const Dashboard = lazy(() => import('./pages/Dashboard'));
const LeadPipeline = lazy(() => import('./pages/LeadPipeline'));
const Inbox = lazy(() => import('./pages/Inbox'));
const Comms = lazy(() => import('./pages/Comms'));
const Reminders = lazy(() => import('./pages/Reminders'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Calling = lazy(() => import('./pages/Calling'));
const Documents = lazy(() => import('./pages/Documents'));
const Leaderboard = lazy(() => import('./pages/Leaderboard'));
const SocialMedia = lazy(() => import('./pages/SocialMedia'));
const Team = lazy(() => import('./pages/Team'));
const Workflows = lazy(() => import('./pages/Workflows'));
const Support = lazy(() => import('./pages/Support'));
const Settings = lazy(() => import('./pages/Settings'));
const FieldOps = lazy(() => import('./pages/FieldOps'));

// Operator console. Its own chunk, so tenant users never download it.
const PlatformLayout = lazy(() => import('./pages/platform/PlatformLayout'));
const PlatformOverview = lazy(() => import('./pages/platform/PlatformOverview'));
const TenantList = lazy(() => import('./pages/platform/TenantList'));
const TenantDetail = lazy(() => import('./pages/platform/TenantDetail'));

function FullPageSpinner({ label }: { label: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-gray-50">
      <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-gray-500">{label}</p>
    </div>
  );
}

function PageSpinner() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

/**
 * Route guard. The check is still client-side (it has to be - it decides what
 * to render), but it no longer *is* the security boundary: the access token
 * lives in memory, the session is proven by an httpOnly cookie the page cannot
 * read, and every API call is authorised server-side regardless of what the
 * router decides to show.
 */
function RequireAuth() {
  const currentUser = useCrmStore((s) => s.currentUser);
  const isBootstrapping = useCrmStore((s) => s.isBootstrapping);

  if (isBootstrapping) return <FullPageSpinner label="Restoring your session" />;
  if (!currentUser) return <Navigate to="/login" replace />;

  return <Outlet />;
}

/** Blocks a page for roles that have no business seeing it. */
function RequireRole({ allow }: { allow: Role[] }) {
  const currentUser = useCrmStore((s) => s.currentUser);

  if (!currentUser) return <Navigate to="/login" replace />;
  if (!allow.includes(currentUser.role)) {
    return (
      <div className="p-10 text-center">
        <h2 className="text-lg font-semibold text-gray-900">Not available on your plan seat</h2>
        <p className="mt-2 text-sm text-gray-500">
          This section needs {allow.join(' or ')} access. Ask an admin if you need it.
        </p>
      </div>
    );
  }

  return <Outlet />;
}

/**
 * Gate for the operator console. The flag comes from the server on every
 * session bootstrap, and the API re-checks it per request, so this only decides
 * what to render.
 */
function RequirePlatformAdmin() {
  const currentUser = useCrmStore((s) => s.currentUser);
  const isBootstrapping = useCrmStore((s) => s.isBootstrapping);

  if (isBootstrapping) return <FullPageSpinner label="Checking your access" />;
  if (!currentUser) return <Navigate to="/login" replace />;
  // Deliberately a redirect, not an explanation: a tenant user has no reason to
  // learn that a cross-tenant console exists.
  if (!currentUser.isPlatformAdmin) return <Navigate to="/dashboard" replace />;

  return <Outlet />;
}

function LoginRoute() {
  const currentUser = useCrmStore((s) => s.currentUser);
  const isBootstrapping = useCrmStore((s) => s.isBootstrapping);

  if (isBootstrapping) return <FullPageSpinner label="Checking your session" />;
  if (currentUser) return <Navigate to="/dashboard" replace />;

  return <Login />;
}

/** Wraps a lazy page in its own boundary so one broken page cannot blank the app. */
function Page({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageSpinner />}>{children}</Suspense>
    </ErrorBoundary>
  );
}

export default function App() {
  const bootstrap = useCrmStore((s) => s.bootstrap);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginRoute />} />

          <Route element={<RequireAuth />}>
            <Route element={<Layout />}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Page><Dashboard /></Page>} />
              <Route path="/leads" element={<Page><LeadPipeline /></Page>} />
              <Route path="/inbox" element={<Page><Inbox /></Page>} />
              <Route path="/comms" element={<Page><Comms /></Page>} />
              <Route path="/reminders" element={<Page><Reminders /></Page>} />
              <Route path="/calling" element={<Page><Calling /></Page>} />
              <Route path="/documents" element={<Page><Documents /></Page>} />
              <Route path="/leaderboard" element={<Page><Leaderboard /></Page>} />
              <Route path="/social" element={<Page><SocialMedia /></Page>} />
              <Route path="/support" element={<Page><Support /></Page>} />
              <Route path="/fieldops" element={<Page><FieldOps /></Page>} />

              {/* Reporting and team management are not for every seat. */}
              <Route element={<RequireRole allow={['Admin', 'Manager']} />}>
                <Route path="/analytics" element={<Page><Analytics /></Page>} />
                <Route path="/team" element={<Page><Team /></Page>} />
                <Route path="/workflows" element={<Page><Workflows /></Page>} />
              </Route>

              <Route element={<RequireRole allow={['Admin']} />}>
                <Route path="/settings" element={<Page><Settings /></Page>} />
              </Route>
            </Route>
          </Route>

          {/* Operator console: outside the tenant Layout, since it is not
              scoped to one workspace. */}
          <Route element={<RequirePlatformAdmin />}>
            <Route
              path="/platform"
              element={
                <Page>
                  <PlatformLayout />
                </Page>
              }
            >
              <Route index element={<Page><PlatformOverview /></Page>} />
              <Route path="tenants" element={<Page><TenantList /></Page>} />
              <Route path="tenants/:id" element={<Page><TenantDetail /></Page>} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
