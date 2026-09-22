import React from 'react';
import { Menu, LogOut, ExternalLink, ShieldCheck, UserCheck } from 'lucide-react';
import { useAuth } from '../auth/useAuth.ts';
import { useNavigate, Link } from 'react-router-dom';

interface AdminHeaderProps {
  onToggleSidebar: () => void;
  title?: string;
}

export const AdminHeader: React.FC<AdminHeaderProps> = ({ onToggleSidebar, title }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/admin/login', { replace: true });
  };

  return (
    <header
      id="admin-header"
      className="h-16 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 sticky top-0 z-30 px-4 sm:px-6 flex items-center justify-between"
    >
      {/* Left: Mobile Toggle & Page Title */}
      <div className="flex items-center space-x-3">
        <button
          id="admin-sidebar-toggle-btn"
          onClick={onToggleSidebar}
          className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition"
          aria-label="Toggle navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <h1 className="text-base sm:text-lg font-semibold text-slate-100 tracking-tight">
            {title || 'CMS Dashboard'}
          </h1>
        </div>
      </div>

      {/* Right: User Badge & Actions */}
      <div className="flex items-center space-x-3 sm:space-x-4">
        {/* Link to Public Developer/API View */}
        <Link
          to="/"
          className="hidden sm:flex items-center space-x-1 text-xs text-slate-400 hover:text-cyan-400 font-medium transition px-2.5 py-1.5 rounded-md hover:bg-slate-800"
          title="Switch to public preview"
        >
          <span>Live API</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>

        {/* User Identity Chip */}
        <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60">
          <div className="w-6 h-6 rounded-full bg-cyan-600/30 border border-cyan-500/40 flex items-center justify-center text-cyan-300">
            <UserCheck className="w-3.5 h-3.5" />
          </div>
          <div className="flex flex-col text-left">
            <span className="text-xs font-semibold text-slate-200 leading-tight">
              {user?.name || 'Administrator'}
            </span>
            <span className="text-[10px] font-mono text-cyan-400 leading-none">
              {user?.role?.toUpperCase() || 'ADMIN'}
            </span>
          </div>
        </div>

        {/* Header Logout */}
        <button
          id="admin-header-logout-btn"
          onClick={handleLogout}
          className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
          title="Sign Out"
          aria-label="Sign Out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
