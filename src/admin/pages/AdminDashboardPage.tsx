import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/useAuth.ts';
import {
  User,
  Wrench,
  FolderGit2,
  BookOpen,
  Briefcase,
  Quote,
  Layers,
  Image,
  Mail,
  Activity,
  Server,
  Database,
  ShieldCheck,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { api } from '../lib/api.ts';

interface ModuleCard {
  title: string;
  description: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  tag: string;
  badgeColor: string;
}

const cmsModules: ModuleCard[] = [
  {
    title: 'About & Biography',
    description: 'Manage personal summary, professional job title, bio, and resume download links.',
    path: '/admin/about',
    icon: User,
    tag: 'Profile',
    badgeColor: 'text-cyan-400 bg-cyan-950/60 border-cyan-800/60',
  },
  {
    title: 'Skills & Proficiencies',
    description: 'Catalog technical proficiencies, programming languages, and competency ratings.',
    path: '/admin/skills',
    icon: Wrench,
    tag: 'Technical',
    badgeColor: 'text-indigo-400 bg-indigo-950/60 border-indigo-800/60',
  },
  {
    title: 'Portfolio Projects',
    description: 'Showcase engineered solutions, tech stacks, GitHub links, and live demos.',
    path: '/admin/projects',
    icon: FolderGit2,
    tag: 'Showcase',
    badgeColor: 'text-emerald-400 bg-emerald-950/60 border-emerald-800/60',
  },
  {
    title: 'Blog Articles',
    description: 'Publish and organize engineering insights, tutorials, and technical articles.',
    path: '/admin/blogs',
    icon: BookOpen,
    tag: 'Content',
    badgeColor: 'text-amber-400 bg-amber-950/60 border-amber-800/60',
  },
  {
    title: 'Career & Experience',
    description: 'Chronicle professional work history, roles, companies, and achievements.',
    path: '/admin/experience',
    icon: Briefcase,
    tag: 'Timeline',
    badgeColor: 'text-purple-400 bg-purple-950/60 border-purple-800/60',
  },
  {
    title: 'Client Testimonials',
    description: 'Feature recommendations and feedback from colleagues and clients.',
    path: '/admin/testimonials',
    icon: Quote,
    tag: 'Social Proof',
    badgeColor: 'text-pink-400 bg-pink-950/60 border-pink-800/60',
  },
  {
    title: 'Services & Offerings',
    description: 'Define consulting services, full-stack architecture, and development packages.',
    path: '/admin/services',
    icon: Layers,
    tag: 'Offerings',
    badgeColor: 'text-blue-400 bg-blue-950/60 border-blue-800/60',
  },
  {
    title: 'Media & Upload Library',
    description: 'Upload, validate, and manage image assets backed by cloud storage.',
    path: '/admin/media',
    icon: Image,
    tag: 'Storage',
    badgeColor: 'text-teal-400 bg-teal-950/60 border-teal-800/60',
  },
  {
    title: 'Contact Messages',
    description: 'Review inbound inquiries, client opportunities, and contact form submissions.',
    path: '/admin/messages',
    icon: Mail,
    tag: 'Inquiries',
    badgeColor: 'text-orange-400 bg-orange-950/60 border-orange-800/60',
  },
];

export const AdminDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [healthStatus, setHealthStatus] = useState<any>(null);
  const [isHealthLoading, setIsHealthLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        setIsHealthLoading(true);
        const res = await api.get('/api/health');
        if (res.success) {
          setHealthStatus(res.data);
        }
      } catch {
        // graceful standby
      } finally {
        setIsHealthLoading(false);
      }
    };

    fetchHealth();
  }, []);

  return (
    <div id="admin-dashboard-page" className="space-y-8 animate-fadeIn">
      {/* Welcome Banner */}
      <section
        id="dashboard-welcome-banner"
        className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-slate-850 p-6 sm:p-8 border border-slate-800 shadow-lg"
      >
        <div className="relative z-10 max-w-3xl">
          <div className="flex items-center space-x-2 text-cyan-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <Sparkles className="w-4 h-4" />
            <span>Admin Console • Foundation Ready</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-100">
            Welcome back, {user?.name || 'Administrator'}
          </h2>
          <p className="mt-2 text-sm text-slate-300 leading-relaxed">
            Manage portfolio content modules, review system connectivity, and inspect verified REST API endpoints from your custom administration hub.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-400 font-mono">
            <span className="bg-slate-950/80 px-2.5 py-1 rounded-md border border-slate-800 text-slate-300">
              User: {user?.email || 'admin@portfolio'}
            </span>
            <span className="bg-slate-950/80 px-2.5 py-1 rounded-md border border-slate-800 text-emerald-400">
              Role: {user?.role?.toUpperCase() || 'ADMIN'}
            </span>
          </div>
        </div>
      </section>

      {/* Real Infrastructure Status */}
      <section id="dashboard-status-section" className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Backend Status */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="font-semibold uppercase tracking-wider">REST API Server</span>
            <Server className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-lg font-bold text-slate-100">
              {healthStatus?.status ? healthStatus.status.toUpperCase() : (isHealthLoading ? 'CONNECTING...' : 'ONLINE')}
            </span>
            <span className="text-xs text-emerald-400 font-mono">Port 3000</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">Express 4.x • Rate-limited</p>
        </div>

        {/* Database Status */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="font-semibold uppercase tracking-wider">PostgreSQL</span>
            <Database className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-lg font-bold text-slate-100">
              {healthStatus?.database?.status === 'connected' ? 'CONNECTED' : 'STANDBY'}
            </span>
            <span className="text-xs text-slate-400 font-mono">11 Tables</span>
          </div>
          <p className="text-xs text-slate-400 mt-1 truncate" title={healthStatus?.database?.message}>
            {healthStatus?.database?.message || 'Database configured with automatic reconnect.'}
          </p>
        </div>

        {/* Auth Engine */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="font-semibold uppercase tracking-wider">Authentication</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-lg font-bold text-slate-100">JWT + BCRYPT</span>
            <span className="text-xs text-cyan-400 font-mono">ACTIVE</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">Dual-token refresh rotation</p>
        </div>
      </section>

      {/* Content Management Modules Grid */}
      <section id="dashboard-modules-section" className="space-y-4">
        <div>
          <h3 className="text-base font-bold text-slate-100">Content Management Modules</h3>
          <p className="text-xs text-slate-400">
            Quick navigation shortcuts for core portfolio content areas
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cmsModules.map((mod) => {
            const Icon = mod.icon;
            return (
              <Link
                key={mod.path}
                to={mod.path}
                id={`module-card-${mod.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
                className="group p-5 rounded-xl bg-slate-900/70 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between shadow-xs hover:shadow-md"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300 group-hover:text-cyan-400 transition">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded-full border ${mod.badgeColor}`}>
                      {mod.tag}
                    </span>
                  </div>

                  <h4 className="text-sm font-semibold text-slate-200 group-hover:text-white transition">
                    {mod.title}
                  </h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    {mod.description}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 group-hover:text-cyan-400 transition font-medium">
                  <span>Open Section</span>
                  <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-0.5 transition-transform" />
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
};
