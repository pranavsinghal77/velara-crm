import { useEffect } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import Dashboard from './pages/Dashboard';
import LeadPipeline from './pages/LeadPipeline';
import Inbox from './pages/Inbox';
import Reminders from './pages/Reminders';
import Analytics from './pages/Analytics';
import Calling from './pages/Calling';
import Documents from './pages/Documents';
import Leaderboard from './pages/Leaderboard';
import SocialMedia from './pages/SocialMedia';
import Settings from './pages/Settings';
import FieldOps from './pages/FieldOps';
import Login from './pages/Login';
import Comms from './pages/Comms';
import Team from './pages/Team';
import Workflows from './pages/Workflows';
import Support from './pages/Support';
import { initializeMockData } from './data/mockData';
import { useCrmStore } from './store/useCrmStore';

function RequireAuth() {
  const currentUser = useCrmStore((s) => s.currentUser);
  if (!currentUser?.isLoggedIn) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}

function LoginRoute() {
  const currentUser = useCrmStore((s) => s.currentUser);
  if (currentUser?.isLoggedIn) {
    return <Navigate to="/dashboard" replace />;
  }
  return <Login />;
}

export default function App() {
  const fetchInitialData = useCrmStore((s) => s.fetchInitialData);

  useEffect(() => {
    initializeMockData();
    fetchInitialData();
  }, [fetchInitialData]);

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginRoute />} />

          <Route element={<RequireAuth />}>
            <Route element={<Layout />}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
              <Route path="/leads" element={<ErrorBoundary><LeadPipeline /></ErrorBoundary>} />
              <Route path="/inbox" element={<ErrorBoundary><Inbox /></ErrorBoundary>} />
              <Route path="/comms" element={<ErrorBoundary><Comms /></ErrorBoundary>} />
              <Route path="/reminders" element={<ErrorBoundary><Reminders /></ErrorBoundary>} />
              <Route path="/analytics" element={<ErrorBoundary><Analytics /></ErrorBoundary>} />
              <Route path="/calling" element={<ErrorBoundary><Calling /></ErrorBoundary>} />
              <Route path="/documents" element={<ErrorBoundary><Documents /></ErrorBoundary>} />
              <Route path="/leaderboard" element={<ErrorBoundary><Leaderboard /></ErrorBoundary>} />
              <Route path="/social" element={<ErrorBoundary><SocialMedia /></ErrorBoundary>} />
              <Route path="/team" element={<ErrorBoundary><Team /></ErrorBoundary>} />
              <Route path="/workflows" element={<ErrorBoundary><Workflows /></ErrorBoundary>} />
              <Route path="/support" element={<ErrorBoundary><Support /></ErrorBoundary>} />
              <Route path="/settings" element={<ErrorBoundary><Settings /></ErrorBoundary>} />
              <Route path="/fieldops" element={<ErrorBoundary><FieldOps /></ErrorBoundary>} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
