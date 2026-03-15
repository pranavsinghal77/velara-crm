import { useEffect } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
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
import Login from './pages/Login';
import Comms from './pages/Comms';
import Team from './pages/Team';
import Workflows from './pages/Workflows';
import Support from './pages/Support';
import { initializeMockData } from './data/mockData';
import { getCurrentUser } from './types/index';

function RequireAuth() {
  const user = getCurrentUser();
  if (!user?.isLoggedIn) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}

function LoginRoute() {
  const user = getCurrentUser();
  if (user?.isLoggedIn) {
    return <Navigate to="/dashboard" replace />;
  }
  return <Login />;
}

export default function App() {
  useEffect(() => {
    initializeMockData();
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginRoute />} />

        <Route element={<RequireAuth />}>
          <Route element={<Layout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/leads" element={<LeadPipeline />} />
            <Route path="/inbox" element={<Inbox />} />
            <Route path="/comms" element={<Comms />} />
            <Route path="/reminders" element={<Reminders />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/calling" element={<Calling />} />
            <Route path="/documents" element={<Documents />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/social" element={<SocialMedia />} />
            <Route path="/team" element={<Team />} />
            <Route path="/workflows" element={<Workflows />} />
            <Route path="/support" element={<Support />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
