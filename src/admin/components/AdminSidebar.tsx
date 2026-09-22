import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  User,
  Wrench,
  FolderGit2,
  BookOpen,
  Briefcase,
  Quote,
  Layers,
  Image,
  Mail,
  LogOut,
  X,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../auth/useAuth.ts';
import { api } from '../lib/api.ts';

interface AdminSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NavItem {
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  tag?: string;
  getBadge?: (unreadCount: number) => React.ReactNode;
}

const navItems: NavItem[] = [
  { name: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
  { name: 'About', path: '/admin/about', icon: User },
  { name: 'Skills', path: '/admin/skills', icon: Wrench },
  { name: 'Projects', path: '/admin/projects', icon: FolderGit2 },
  { name: 'Blogs', path: '/admin/blogs', icon: BookOpen },
  { name: 'Experience', path: '/admin/experience', icon: Briefcase },
  { name: 'Testimonials', path: '/admin/testimonials', icon: Quote },
  { name: 'Services', path: '/admin/services', icon: Layers },
  { name: 'Media', path: '/admin/media', icon: Image },
  {
    name: 'Messages',
    path: '/admin/messages',
    icon: Mail,
    getBadge: (unread) =>
      unread > 0 ? (
        <span
          id="sidebar-unread-messages-count"
          className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 font-semibold"
        >
          {unread}
        </span>
      ) : null,
  },
];

export const AdminSidebar: React.FC<AdminSidebarProps> = ({ isOpen, onClose }) => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState<number>(0);

  useEffect(() => {
    let isMounted = true;
    api
      .get<{ unread_count?: number; unreadCount?: number }>('/api/messages')
      .then((res) => {
        if (isMounted) {
          const count = res.unread_count ?? res.unreadCount ?? 0;
          setUnreadCount(count);
        }
      })
      .catch(() => {
        // Silently catch to avoid any navigation disruption
      });

    return () => {
      isMounted = false;
    };
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/admin/login', { replace: true });
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          id="admin-sidebar-backdrop"
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-40 lg:hidden transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container */}
      <aside
        id="admin-sidebar"
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Top Header / Branding */}
        <div>
          <div className="h-16 px-5 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-cyan-600 flex items-center justify-center text-white shadow-md shadow-cyan-950">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold tracking-tight text-slate-100">CMS Admin</span>
                <span className="text-[10px] font-mono text-cyan-400 leading-none">Portfolio Manager</span>
              </div>
            </div>

            {/* Close Button for Mobile */}
            <button
              id="close-sidebar-btn"
              onClick={onClose}
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
              aria-label="Close sidebar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links List */}
          <nav className="p-3 space-y-1 overflow-y-auto max-h-[calc(100vh-10rem)]">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => {
                    if (window.innerWidth < 1024) onClose();
                  }}
                  className={({ isActive }) =>
                    `flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                      isActive
                        ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-xs'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`
                  }
                >
                  <div className="flex items-center space-x-3">
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span>{item.name}</span>
                  </div>
                  {item.tag && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                      {item.tag}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* User Info & Logout Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-900/50">
          <div className="px-3 py-2 mb-2 rounded-lg bg-slate-950/60 border border-slate-800/80">
            <p className="text-xs font-semibold text-slate-200 truncate">{user?.name || 'Administrator'}</p>
            <p className="text-[11px] font-mono text-slate-400 truncate">{user?.email || 'admin@portfolio'}</p>
          </div>

          <button
            id="admin-sidebar-logout-btn"
            onClick={handleLogout}
            className="w-full flex items-center justify-center space-x-2 px-3 py-2 text-xs font-semibold rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-rose-500/20 transition cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
};
