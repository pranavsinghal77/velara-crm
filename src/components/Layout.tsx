import { useState, useRef, useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Bell, Search, Sparkles, LogOut } from 'lucide-react';
import Sidebar from './Sidebar';
import AIAssistant from './AIAssistant';
import { getCurrentUser, getNotifications, clearAuth } from '../types/index';

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/leads': 'Lead Pipeline',
  '/inbox': 'Unified Inbox',
  '/comms': 'Comms Intelligence Hub',
  '/reminders': 'Reminders & Follow-ups',
  '/analytics': 'Analytics',
  '/settings': 'Settings',
  '/calling': 'Calling',
  '/documents': 'Documents',
  '/leaderboard': 'Leaderboard',
  '/social': 'Social Media',
  '/team': 'Team Workspace',
  '/workflows': 'Workflow Studio',
  '/support': 'Support Command',
};

export default function Layout() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [notice, setNotice] = useState('');
  const [user] = useState(() => getCurrentUser());
  const [unreadCount] = useState(() => getNotifications().filter((n) => !n.isRead).length);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();

  const pageTitle = pageTitles[location.pathname] ?? 'Velara CRM';
  const initials = user?.name?.charAt(0)?.toUpperCase() ?? '?';

  const roleColor: Record<string, string> = {
    Admin: 'bg-red-100 text-red-700',
    Manager: 'bg-amber-100 text-amber-700',
    Sales: 'bg-green-100 text-green-700',
    Viewer: 'bg-gray-100 text-gray-700',
  };

  const handleLogout = () => {
    clearAuth();
    navigate('/login');
  };

  const openAssistant = () => {
    window.dispatchEvent(new CustomEvent('velara:assistant-open'));
    setNotice('Velara AI assistant opened.');
  };

  const openNotifications = () => {
    if (unreadCount > 0) {
      navigate('/support');
      setNotice(`Redirected to Support Command with ${unreadCount} pending alerts.`);
      return;
    }
    setNotice('No unread alerts at the moment.');
  };

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(''), 2400);
    return () => clearTimeout(id);
  }, [notice]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar isCollapsed={isCollapsed} onToggle={() => setIsCollapsed((c) => !c)} />

      {/* ── Top Navbar ────────────────────────────────────── */}
      <header
        className="fixed top-0 right-0 z-30 bg-white border-b border-gray-200 flex items-center justify-between px-6 h-16 transition-all duration-300"
        style={{ left: isCollapsed ? '64px' : '240px' }}
      >
        {/* Left – page title */}
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-gray-800 whitespace-nowrap">{pageTitle}</h1>
        </div>

        {/* Right – actions */}
        <div className="flex items-center gap-3 ml-auto">
          {/* Search */}
          <div className="hidden md:flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2 w-48 lg:w-64">
            <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search..."
              className="bg-transparent text-sm outline-none text-gray-700 placeholder-gray-400 w-full"
            />
          </div>

          {/* Notification bell */}
          <button onClick={openNotifications} className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0">
            <Bell className="w-5 h-5 text-gray-600" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">{unreadCount}</span>
              </span>
            )}
          </button>

          {/* AI Assistant button */}
          <button onClick={openAssistant} className="flex items-center gap-2 px-3 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg transition-colors text-sm font-medium flex-shrink-0 border border-purple-200">
            <Sparkles className="w-4 h-4 flex-shrink-0" />
            <span className="hidden sm:inline">Velara AI</span>
          </button>

          {/* User avatar + dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowDropdown((v) => !v)}
              className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-blue-300 transition-all"
            >
              <span className="text-white text-xs font-bold">{initials}</span>
            </button>

            {showDropdown && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-50">
                <div className="px-4 py-2 border-b border-gray-100">
                  <p className="text-sm font-semibold text-gray-900">{user?.name}</p>
                  <p className="text-xs text-gray-500">{user?.email}</p>
                  <span
                    className={`inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded ${
                      roleColor[user?.role ?? 'Viewer']
                    }`}
                  >
                    {user?.role}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut size={16} />
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main area — offset by sidebar width and navbar height */}
      <div
        className="transition-all duration-300"
        style={{
          marginLeft: isCollapsed ? '64px' : '240px',
          paddingTop: '64px',
        }}
      >
        {notice ? (
          <div className="mx-6 mt-3 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-xs font-medium text-blue-700">
            {notice}
          </div>
        ) : null}

        {/* ── Page content ──────────────────────────────────── */}
        <div className="p-6">
          <Outlet />
        </div>
      </div>

      {/* ── Floating AI Assistant (visible on all pages) ──── */}
      <AIAssistant />
    </div>
  );
}
