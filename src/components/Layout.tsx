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
    Viewer: 'bg-slate-100 text-slate-700',
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
    <div className="min-h-screen bg-slate-50">
      {/* Sidebar */}
      <Sidebar isCollapsed={isCollapsed} onToggle={() => setIsCollapsed((c) => !c)} />

      {/* ── Top Navbar ────────────────────────────────────── */}
      <header
        className="fixed top-0 right-0 z-30 glass-panel transition-all duration-300"
        style={{
          left: isCollapsed ? 'var(--sidebar-w-collapsed)' : 'var(--sidebar-w)',
          height: 'var(--topbar-h)',
        }}
      >
        {/* Same shell as the page content, so the page title lines up with the
            left edge of the cards beneath it instead of floating 8px off. */}
        <div className="page-shell h-full flex items-center justify-between gap-4">
        {/* Left – Company Switcher & page title */}
        <div className="flex items-center gap-4 min-w-0">
          <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-slate-900 to-indigo-950 text-white border border-slate-700/60 shadow-2xs shrink-0">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-bold tracking-tight">Velara Technologies</span>
            <span className="text-[10px] text-indigo-300 font-mono">HQ</span>
          </div>

          <div className="h-5 w-px bg-slate-200 hidden xl:block shrink-0" />

          {/* Chrome, not the page heading. Pages own an h2-weight <h1> of their
                own, and when this sat at the same size and weight the two read as
                the title being printed twice. */}
          <p className="text-sm font-medium text-slate-500 truncate">{pageTitle}</p>
        </div>

        {/* Right – actions */}
        <div className="flex items-center gap-2 sm:gap-3 ml-auto shrink-0">
          {/* Universal Command Palette search button */}
          <button
            onClick={() => setShowCmdPalette(true)}
            className="hidden lg:flex items-center justify-between gap-2 bg-slate-100/80 hover:bg-slate-200/80 rounded-xl px-3.5 py-1.5 w-48 xl:w-64 min-w-0 shrink text-left transition-all border border-slate-200/60 group shadow-2xs"
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
          <button onClick={openNotifications} className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors flex-shrink-0">
            <Bell className="w-5 h-5 text-slate-600" />
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
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-slate-200 py-2 z-50">
                <div className="px-4 py-2 border-b border-slate-100">
                  <p className="text-sm font-semibold text-slate-900">{user?.name}</p>
                  <p className="text-xs text-slate-500">{user?.email}</p>
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
        </div>
      </header>

      {/* Main area — offset by sidebar width and navbar height */}
      <div
        className="transition-all duration-300"
        style={{
          marginLeft: isCollapsed ? 'var(--sidebar-w-collapsed)' : 'var(--sidebar-w)',
          paddingTop: 'var(--topbar-h)',
        }}
      >
        {notice ? (
          <div className="page-shell pt-4">
            <div
              role="status"
              className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-xs font-medium text-blue-700"
            >
              {notice}
            </div>
          </div>
        ) : null}

        {/*
          The app's only page-level padding. Pages render their sections and
          nothing else — nine of them used to add another `p-6` here, which is
          why content shifted horizontally depending on which page you were on.
        */}
        <main className="page-shell py-6">
          <Outlet />
        </main>
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

