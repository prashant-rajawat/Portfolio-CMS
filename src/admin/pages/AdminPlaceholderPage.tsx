import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { ArrowLeft, Clock, Layers, ShieldCheck } from 'lucide-react';

interface PlaceholderConfig {
  title: string;
  description: string;
  endpoint: string;
  step: string;
}

const placeholderConfigs: Record<string, PlaceholderConfig> = {
  '/admin/about': {
    title: 'About & Profile Management',
    description: 'Manage biography, headline, technical summary, and downloadable resume links.',
    endpoint: 'GET / PUT /api/about',
    step: 'Step 7 — Individual CMS Screens',
  },
  '/admin/skills': {
    title: 'Skills Catalog Management',
    description: 'Add, update, categorize, and reorder technical proficiencies.',
    endpoint: 'GET / POST / PUT / DELETE /api/skills',
    step: 'Step 7 — Individual CMS Screens',
  },
  '/admin/projects': {
    title: 'Portfolio Projects Management',
    description: 'Showcase engineered solutions with tech stack tags, URLs, and unique slug routing.',
    endpoint: 'GET / POST / PUT / DELETE /api/projects',
    step: 'Step 7 — Individual CMS Screens',
  },
  '/admin/blogs': {
    title: 'Blog Articles Management',
    description: 'Publish, edit, and organize engineering articles with authenticated author relations.',
    endpoint: 'GET / POST / PUT / DELETE /api/blogs',
    step: 'Step 7 — Individual CMS Screens',
  },
  '/admin/experience': {
    title: 'Career & Experience Management',
    description: 'Manage timeline of employment history, current role flags, and job descriptions.',
    endpoint: 'GET / POST / PUT / DELETE /api/experience',
    step: 'Step 7 — Individual CMS Screens',
  },
  '/admin/testimonials': {
    title: 'Testimonials Management',
    description: 'Curate client reviews, peer recommendations, and testimonials.',
    endpoint: 'GET / POST / PUT / DELETE /api/testimonials',
    step: 'Step 7 — Individual CMS Screens',
  },
  '/admin/services': {
    title: 'Services Management',
    description: 'Configure offered technical architecture, consulting, and development offerings.',
    endpoint: 'GET / POST / PUT / DELETE /api/services',
    step: 'Step 7 — Individual CMS Screens',
  },
  '/admin/media': {
    title: 'Media & Asset Library',
    description: 'Upload, validate, inspect, and manage images backed by cloud storage.',
    endpoint: 'POST /api/upload/image & GET /api/upload',
    step: 'Step 8 — Media Management UI',
  },
  '/admin/messages': {
    title: 'Contact Messages Inbox',
    description: 'Review inbound inquiries, mark messages as read, and manage contact requests.',
    endpoint: 'GET / PUT / DELETE /api/messages',
    step: 'Step 9 — Contact Inbox UI',
  },
};

export const AdminPlaceholderPage: React.FC = () => {
  const location = useLocation();
  const config = placeholderConfigs[location.pathname] || {
    title: 'CMS Module',
    description: 'This management section is part of the custom Portfolio CMS foundation.',
    endpoint: '/api/*',
    step: 'Future Implementation Step',
  };

  return (
    <div id="admin-placeholder-page" className="space-y-6 max-w-4xl mx-auto py-4">
      {/* Header with back navigation */}
      <div className="flex items-center space-x-3">
        <Link
          to="/admin/dashboard"
          className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition"
          aria-label="Back to Dashboard"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h2 className="text-xl font-bold text-slate-100">{config.title}</h2>
          <p className="text-xs text-slate-400">{config.description}</p>
        </div>
      </div>

      {/* Main Container Card */}
      <div className="p-8 rounded-2xl bg-slate-900/60 border border-slate-800 text-center flex flex-col items-center justify-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-cyan-950/60 border border-cyan-800/60 flex items-center justify-center text-cyan-400 shadow-inner">
          <Layers className="w-7 h-7" />
        </div>

        <div className="max-w-md space-y-2">
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-slate-800 text-slate-300 text-xs font-mono border border-slate-700">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span>{config.step}</span>
          </div>

          <h3 className="text-base font-semibold text-slate-200">
            Foundation Route Ready
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            The route, navigation, authentication guards, and REST API controllers for this module are verified. Complete CRUD editing forms and table grids will be attached in the next implementation phase.
          </p>
        </div>

        {/* API Info Chip */}
        <div className="pt-3 border-t border-slate-800/80 w-full max-w-md flex items-center justify-between text-xs font-mono text-slate-400">
          <span>Target API:</span>
          <span className="text-cyan-400 bg-slate-950 px-2.5 py-1 rounded border border-slate-800">
            {config.endpoint}
          </span>
        </div>
      </div>
    </div>
  );
};
