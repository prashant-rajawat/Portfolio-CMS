import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Server, 
  Database, 
  ShieldCheck, 
  Layers, 
  Code2, 
  CheckCircle2, 
  Terminal, 
  Activity, 
  ArrowRight,
  Lock,
} from 'lucide-react';

interface HealthStatus {
  status: string;
  uptime: number;
  environment: string;
  database: {
    status: string;
    message: string;
    driver: string;
    connectionConfigured: boolean;
  };
}

export const PublicApiExplorer: React.FC = () => {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'endpoints' | 'schema' | 'auth'>('endpoints');

  const fetchHealth = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/health');
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const data = await res.json();
      setHealth(data);
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Failed to reach API server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const endpoints = [
    { method: 'GET', path: '/api/health', tag: 'System', desc: 'System uptime & PostgreSQL connection status', auth: 'Public' },
    { method: 'POST', path: '/api/auth/login', tag: 'Auth', desc: 'Admin login issuing JWT Access + Refresh token', auth: 'Public' },
    { method: 'POST', path: '/api/auth/refresh', tag: 'Auth', desc: 'Rotate access token via hashed refresh token', auth: 'Public' },
    { method: 'GET', path: '/api/about', tag: 'About', desc: 'Retrieve portfolio biography and resume links', auth: 'Public' },
    { method: 'PUT', path: '/api/about', tag: 'About', desc: 'Upsert bio, job title, and resume URL', auth: 'Admin' },
    { method: 'GET', path: '/api/skills', tag: 'Skills', desc: 'List technical skills ordered by priority', auth: 'Public' },
    { method: 'POST', path: '/api/skills', tag: 'Skills', desc: 'Create skill entry with proficiency 0-100', auth: 'Admin' },
    { method: 'GET', path: '/api/projects', tag: 'Projects', desc: 'Showcase projects ordered by display order', auth: 'Public' },
    { method: 'GET', path: '/api/projects/:slug', tag: 'Projects', desc: 'Get specific project by unique slug', auth: 'Public' },
    { method: 'POST', path: '/api/projects', tag: 'Projects', desc: 'Create project with unique slug check', auth: 'Admin' },
    { method: 'GET', path: '/api/blogs', tag: 'Blogs', desc: 'Published blog posts with author profile join', auth: 'Public' },
    { method: 'POST', path: '/api/blogs', tag: 'Blogs', desc: 'Author post as authenticated admin', auth: 'Admin' },
    { method: 'GET', path: '/api/experience', tag: 'Experience', desc: 'Career timeline ordered by start_date DESC', auth: 'Public' },
    { method: 'GET', path: '/api/testimonials', tag: 'Social', desc: 'Client and colleague recommendations', auth: 'Public' },
    { method: 'GET', path: '/api/services', tag: 'Services', desc: 'Service offerings & architectural consulting', auth: 'Public' },
    { method: 'POST', path: '/api/upload/image', tag: 'Upload', desc: 'Upload validated media with magic-byte verification', auth: 'Admin' },
  ];

  const tables = [
    { name: 'users', rows: 'Admin authentication, bcrypt password hashes, and user roles' },
    { name: 'about', rows: 'Single-row portfolio profile, bio summary, and resume links' },
    { name: 'skills', rows: 'Categorized technical capabilities and proficiency ratings' },
    { name: 'projects', rows: 'Showcase projects with tech stack arrays and unique slugs' },
    { name: 'blogs', rows: 'Rich articles with author relation foreign key' },
    { name: 'experience', rows: 'Work history with current role flags & date ordering' },
    { name: 'testimonials', rows: 'Client endorsements and professional reviews' },
    { name: 'services', rows: 'Offered technical services, architecture, and consulting' },
    { name: 'messages', rows: 'Inbound contact queries with read status flags' },
    { name: 'media', rows: 'File metadata registry for uploaded assets' },
    { name: 'refresh_tokens', rows: 'Secure SHA-256 hashed refresh token store' },
  ];

  return (
    <div id="portfolio-cms-root" className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-cyan-500/20 selection:text-cyan-300">
      {/* Top Banner Navigation */}
      <header id="cms-header" className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-950">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-semibold text-slate-100 tracking-tight text-base">Portfolio CMS</span>
              <span className="ml-2.5 px-2 py-0.5 text-xs font-medium rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800/60">
                v1.0 Core Backend
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <Link
              to="/admin/login"
              id="goto-admin-btn"
              className="text-xs px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold transition flex items-center gap-1.5 shadow-md shadow-cyan-950"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Admin Panel</span>
            </Link>

            <button
              id="refresh-health-btn"
              onClick={fetchHealth}
              disabled={loading}
              className="text-xs px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition flex items-center gap-1.5"
            >
              <Activity className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh Health
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main id="cms-main-content" className="max-w-6xl mx-auto px-6 py-10">
        {/* System Overview Dashboard */}
        <section id="system-status-section" className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
          {/* Card 1: API Server Status */}
          <div id="card-api-status" className="bg-slate-900/80 rounded-xl p-5 border border-slate-800 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">REST API Server</span>
              <Server className="w-5 h-5 text-cyan-400" />
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl font-bold tracking-tight text-slate-100">
                {health?.status ? health.status.toUpperCase() : (loading ? 'CONNECTING...' : 'ONLINE')}
              </span>
              <span className="text-xs text-emerald-400 font-medium">Port 3000</span>
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Express 4.x with Helmet, CORS, Rate Limiting & Zod request validation
            </p>
          </div>

          {/* Card 2: Database Driver Status */}
          <div id="card-db-status" className="bg-slate-900/80 rounded-xl p-5 border border-slate-800 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">PostgreSQL Connection</span>
              <Database className="w-5 h-5 text-indigo-400" />
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl font-bold tracking-tight text-slate-100">
                {health?.database.status === 'connected' ? 'CONNECTED' : 'STANDBY'}
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {health?.database.driver || 'pg / supabase'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-2 truncate" title={health?.database.message}>
              {health?.database.message || 'Database configured with automatic reconnect.'}
            </p>
          </div>

          {/* Card 3: Security & Auth Engine */}
          <div id="card-auth-status" className="bg-slate-900/80 rounded-xl p-5 border border-slate-800 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Security Architecture</span>
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl font-bold tracking-tight text-slate-100">JWT + BCRYPT</span>
              <span className="text-xs text-cyan-400 font-mono">RBAC</span>
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Dual-token refresh rotation & UUID strict validation on all routes
            </p>
          </div>
        </section>

        {/* Navigation Tabs */}
        <div id="cms-tabs" className="flex border-b border-slate-800 mb-8 space-x-6">
          <button
            id="tab-endpoints-btn"
            onClick={() => setActiveTab('endpoints')}
            className={`pb-3 text-sm font-medium transition relative flex items-center gap-2 cursor-pointer ${
              activeTab === 'endpoints'
                ? 'text-cyan-400 border-b-2 border-cyan-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code2 className="w-4 h-4" />
            Active API Endpoints ({endpoints.length})
          </button>
          <button
            id="tab-schema-btn"
            onClick={() => setActiveTab('schema')}
            className={`pb-3 text-sm font-medium transition relative flex items-center gap-2 cursor-pointer ${
              activeTab === 'schema'
                ? 'text-cyan-400 border-b-2 border-cyan-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Database className="w-4 h-4" />
            PostgreSQL Schema ({tables.length} Tables)
          </button>
          <button
            id="tab-auth-btn"
            onClick={() => setActiveTab('auth')}
            className={`pb-3 text-sm font-medium transition relative flex items-center gap-2 cursor-pointer ${
              activeTab === 'auth'
                ? 'text-cyan-400 border-b-2 border-cyan-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-4 h-4" />
            Admin Panel Foundation (Step 6)
          </button>
        </div>

        {/* Tab 1: API Endpoints Table */}
        {activeTab === 'endpoints' && (
          <section id="endpoints-tab-content" className="bg-slate-900/60 rounded-xl border border-slate-800 overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-800 bg-slate-900/40 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-slate-200 text-sm">Documented CMS API Endpoints</h3>
                <p className="text-xs text-slate-400 mt-0.5">Fully operational routes with parameter sanitization and security middlewares</p>
              </div>
              <span className="text-xs bg-slate-800 text-slate-300 px-2.5 py-1 rounded-md font-mono">
                BASE_URL: /api
              </span>
            </div>
            <div className="divide-y divide-slate-800/80">
              {endpoints.map((ep, idx) => (
                <div key={idx} className="p-4 flex items-center justify-between hover:bg-slate-800/30 transition text-sm">
                  <div className="flex items-center space-x-3">
                    <span
                      className={`text-xs font-mono font-bold px-2 py-0.5 rounded w-16 text-center ${
                        ep.method === 'GET'
                          ? 'bg-blue-950 text-blue-400 border border-blue-800/60'
                          : ep.method === 'POST'
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
                          : ep.method === 'PUT'
                          ? 'bg-amber-950 text-amber-400 border border-amber-800/60'
                          : 'bg-rose-950 text-rose-400 border border-rose-800/60'
                      }`}
                    >
                      {ep.method}
                    </span>
                    <span className="font-mono text-slate-200 font-medium text-xs sm:text-sm">{ep.path}</span>
                    <span className="text-xs text-slate-400 hidden md:inline">— {ep.desc}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded font-mono ${
                        ep.auth === 'Public'
                          ? 'bg-slate-800 text-slate-400'
                          : 'bg-purple-950 text-purple-300 border border-purple-800/60'
                      }`}
                    >
                      {ep.auth}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Tab 2: PostgreSQL Schema */}
        {activeTab === 'schema' && (
          <section id="schema-tab-content" className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tables.map((t, idx) => (
              <div key={idx} className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
                <div>
                  <div className="flex items-center space-x-2 mb-1.5">
                    <Database className="w-4 h-4 text-cyan-400" />
                    <span className="font-mono font-semibold text-slate-200 text-sm">{t.name}</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">{t.rows}</p>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400 font-mono">
                  <span>UUID Primary Key</span>
                  <span>Auto-updated_at trigger</span>
                </div>
              </div>
            ))}
          </section>
        )}

        {/* Tab 3: Auth & Admin Info */}
        {activeTab === 'auth' && (
          <section id="cli-tab-content" className="space-y-5">
            <div className="bg-slate-900/80 rounded-xl p-5 border border-slate-800 font-mono text-xs">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
                <span className="text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-cyan-400" /> Custom Admin Console Access
                </span>
                <span className="text-cyan-400">Step 6 Ready</span>
              </div>
              <div className="space-y-3">
                <p className="text-slate-300 leading-relaxed">
                  The custom React CMS Admin foundation is active with JWT authentication, protected routes, automated token refresh, and responsive navigation.
                </p>
                <div className="pt-2">
                  <Link
                    to="/admin/login"
                    className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold transition"
                  >
                    <span>Launch Admin Login (/admin/login)</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </div>

            <div className="bg-slate-900/60 rounded-xl p-5 border border-slate-800 text-xs text-slate-300 space-y-2">
              <h4 className="font-semibold text-slate-100 flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Step 6 Custom Admin Panel Foundation Active
              </h4>
              <p className="text-slate-400">
                Authentication state is managed centrally by AuthContext and protected by JWT verification. Non-admin visitors cannot access protected admin routes.
              </p>
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer id="cms-footer" className="border-t border-slate-800/80 mt-16 py-6 text-center text-xs text-slate-400">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span>Portfolio CMS • TypeScript • React • Express • PostgreSQL</span>
          <Link to="/admin/login" className="text-cyan-400 hover:underline">
            Admin Portal
          </Link>
        </div>
      </footer>
    </div>
  );
};
