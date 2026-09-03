import { useState, useRef, useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Bell, Search, Sparkles, LogOut } from 'lucide-react';
import Sidebar from './Sidebar';
import AIAssistant from './AIAssistant';
import CommandPalette from './CommandPalette';
import { useCrmStore } from '../store/useCrmStore';

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/leads': 'Lead Pipeline',
  '/inbox': 'Unified Inbox',
  '/fieldops': 'Field Operations',
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
  const [showCmdPalette, setShowCmdPalette] = useState(false);
  const [notice, setNotice] = useState('');
  const user = useCrmStore((s) => s.currentUser);
  const notifications = useCrmStore((s) => s.notifications);
  const logout = useCrmStore((s) => s.logout);
  const unreadCount = notifications.filter((n) => !n.isRead).length;
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
    logout();
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

  // Keyboard shortcut Ctrl+K / Cmd+K
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowCmdPalette((prev) => !prev);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
        className="fixed top-0 right-0 z-30 glass-panel flex items-center justify-between px-6 h-16 transition-all duration-300"
        style={{ left: isCollapsed ? '64px' : '240px' }}
      >
        {/* Left – Company Switcher & page title */}
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-slate-900 to-indigo-950 text-white border border-slate-700/60 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-bold tracking-tight">Velara Technologies</span>
            <span className="text-[10px] text-indigo-300 font-mono">HQ</span>
          </div>

          <div className="h-5 w-px bg-gray-200 hidden sm:block" />

          <h1 className="text-base font-bold text-gray-900 whitespace-nowrap">{pageTitle}</h1>
        </div>

        {/* Right – actions */}
        <div className="flex items-center gap-3 ml-auto">
          {/* Universal Command Palette search button */}
          <button
            onClick={() => setShowCmdPalette(true)}
            className="hidden md:flex items-center justify-between gap-2 bg-slate-100/80 hover:bg-slate-200/80 rounded-xl px-3.5 py-1.5 w-60 lg:w-72 text-left transition-all border border-slate-200/60 group shadow-2xs"
          >
            <div className="flex items-center gap-2 text-slate-400 group-hover:text-slate-600">
              <Search className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="text-xs text-slate-500 font-medium truncate">Search or action...</span>
            </div>
            <div className="flex items-center gap-0.5">
              <kbd className="px-1.5 py-0.5 text-[10px] font-bold text-slate-500 bg-white border border-slate-200 rounded shadow-2xs font-mono">
                Ctrl+K
              </kbd>
            </div>
          </button>

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

      {/* ── Universal Command Palette (Ctrl+K) ────────────── */}
      {/* Mounted only while open, so its query and selection reset naturally
          instead of being cleared by an effect on every toggle. */}
      {showCmdPalette && <CommandPalette onClose={() => setShowCmdPalette(false)} />}
    </div>
  );
}

