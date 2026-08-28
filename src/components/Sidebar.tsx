import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  MessageCircle,
  Bell,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  Phone,
  FolderOpen,
  Trophy,
  Share2,
  Workflow,
  Headset,
  MapPin,
} from 'lucide-react';
import { useCrmStore } from '../store/useCrmStore';

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ isCollapsed, onToggle }: SidebarProps) {
  const navigate = useNavigate();
  const user = useCrmStore((s) => s.currentUser);
  const leads = useCrmStore((s) => s.leads);
  const messages = useCrmStore((s) => s.messages);
  const reminders = useCrmStore((s) => s.reminders);
  const logout = useCrmStore((s) => s.logout);

  const leadCount = leads.length;
  const unreadMessages = messages.filter((m) => !m.isRead).length;
  const pendingReminders = reminders.filter((r) => !r.isCompleted).length;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: Users, label: 'Leads', path: '/leads', badge: leadCount },
    { icon: MessageSquare, label: 'Inbox', path: '/inbox', badge: unreadMessages },
    { icon: MapPin, label: 'Field Ops', path: '/fieldops' },
    { icon: MessageCircle, label: 'Comms', path: '/comms' },
    { icon: Bell, label: 'Reminders', path: '/reminders', badge: pendingReminders },
    { icon: BarChart3, label: 'Analytics', path: '/analytics' },
  ];

  const moreItems = [
    { icon: Phone, label: 'Calling', path: '/calling' },
    { icon: FolderOpen, label: 'Documents', path: '/documents' },
    { icon: Trophy, label: 'Leaderboard', path: '/leaderboard' },
    { icon: Share2, label: 'Social Media', path: '/social' },
    { icon: Users, label: 'Team', path: '/team' },
    { icon: Workflow, label: 'Workflows', path: '/workflows' },
    { icon: Headset, label: 'Support', path: '/support' },
  ];

  const showSettings = user?.role === 'Admin' || user?.role === 'Manager';

  const roleColor: Record<string, string> = {
    Admin: 'bg-red-500/20 text-red-400',
    Manager: 'bg-amber-500/20 text-amber-400',
    Sales: 'bg-green-500/20 text-green-400',
    Viewer: 'bg-gray-500/20 text-gray-400',
  };

  const initials = user?.name?.charAt(0)?.toUpperCase() ?? '?';

  return (
    <aside
      className="fixed left-0 top-0 h-screen z-40 bg-slate-900 flex flex-col transition-all duration-300 overflow-hidden border-r border-slate-800/50 shadow-2xl"
      style={{ width: isCollapsed ? '64px' : '240px' }}
    >
      {/* ── Top ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800/60 h-16 flex-shrink-0 bg-slate-900/50 backdrop-blur-sm">
          {!isCollapsed && (
            <div className="flex flex-col">
              <span className="text-lg font-bold leading-tight">
                <span className="text-white">Velara</span>
                <span className="text-[#2563EB]">CRM</span>
              </span>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-gradient-to-r from-blue-600 to-purple-600 text-white w-fit shadow-sm">
                  Powered by Gemini
                </span>
              </div>
            </div>
          )}
          <button
            onClick={onToggle}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-all duration-200"
          >
            {isCollapsed ? <Menu size={20} /> : <X size={20} />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="mt-2 flex flex-col gap-1 px-2">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors mx-2 my-0.5 ${
                  isActive
                    ? 'bg-[#2563EB] text-white'
                    : 'text-[#94A3B8] hover:bg-[#334155]'
                }`
              }
            >
              <item.icon className={`w-5 h-5 flex-shrink-0 transition-transform duration-200 group-hover:scale-110`} />
              <span
                className="text-sm font-medium whitespace-nowrap overflow-hidden transition-all duration-300"
                style={{ width: isCollapsed ? '0' : 'auto', opacity: isCollapsed ? 0 : 1 }}
              >
                {item.label}
              </span>
              {item.badge !== undefined && item.badge > 0 && (
                <span className="text-[10px] font-bold rounded-full bg-white/20 text-white flex items-center justify-center min-w-[20px] h-5 px-1.5 shadow-sm">
                  {item.badge}
                </span>
              )}
            </NavLink>
          ))}

          {/* More Tools divider */}
          <div className="mt-4 mb-2 px-3">
            <div className="border-t border-slate-800/60" />
            {!isCollapsed && (
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mt-3 block">More Tools</span>
            )}
          </div>

          {moreItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors mx-2 my-0.5 ${
                  isActive
                    ? 'bg-[#2563EB] text-white'
                    : 'text-[#94A3B8] hover:bg-[#334155]'
                }`
              }
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              <span
                className="text-sm font-medium whitespace-nowrap overflow-hidden transition-all duration-300"
                style={{ width: isCollapsed ? '0' : 'auto', opacity: isCollapsed ? 0 : 1 }}
              >
                {item.label}
              </span>
            </NavLink>
          ))}

          {showSettings && (
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 mx-2 my-1 group ${
                  isActive
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20'
                    : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
                }`
              }
            >
              <Settings className={`w-5 h-5 flex-shrink-0 transition-transform duration-200 group-hover:scale-110 group-hover:rotate-45`} />
              <span
                className="text-sm font-medium whitespace-nowrap overflow-hidden transition-all duration-300"
                style={{ width: isCollapsed ? '0' : 'auto', opacity: isCollapsed ? 0 : 1 }}
              >
                Settings
              </span>
            </NavLink>
          )}
        </nav>
      </div>

      {/* ── Bottom – user info ──────────────────────────────── */}
      <div className="border-t border-slate-800/60 p-3 flex-shrink-0 bg-slate-900/80 backdrop-blur-md">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
            {initials}
          </div>

          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {user?.name}
              </p>
              <span
                className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                  roleColor[user?.role ?? 'Viewer']
                }`}
              >
                {user?.role}
              </span>
            </div>
          )}

          {!isCollapsed && (
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-colors"
              title="Logout"
            >
              <LogOut size={18} />
            </button>
          )}
        </div>

        {isCollapsed && (
          <button
            onClick={handleLogout}
            className="mt-2 w-full flex justify-center p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-colors"
            title="Logout"
          >
            <LogOut size={18} />
          </button>
        )}
      </div>
    </aside>
  );
}
