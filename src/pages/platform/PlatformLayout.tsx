import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, LayoutDashboard, ShieldCheck } from 'lucide-react';
import { useCrmStore } from '../../store/useCrmStore';

/**
 * Shell for the operator console.
 *
 * Visually distinct from the tenant app on purpose: this view spans every
 * customer, and an operator should never be in any doubt about which of the two
 * they are looking at.
 */
export default function PlatformLayout() {
  const navigate = useNavigate();
  const currentUser = useCrmStore((s) => s.currentUser);

  const link = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
      isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
    }`;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-amber-400" />
            <div>
              <p className="text-sm font-bold">Velara Platform Console</p>
              <p className="text-[11px] text-slate-400">
                Cross-tenant operator view — {currentUser?.email}
              </p>
            </div>
          </div>

          <button
            onClick={() => navigate('/dashboard')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to my workspace
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <nav className="flex items-center gap-1 mb-6">
          <NavLink to="/platform" end className={link}>
            <LayoutDashboard className="w-4 h-4" /> Overview
          </NavLink>
          <NavLink to="/platform/tenants" className={link}>
            <Building2 className="w-4 h-4" /> Workspaces
          </NavLink>
        </nav>

        <Outlet />
      </div>
    </div>
  );
}
