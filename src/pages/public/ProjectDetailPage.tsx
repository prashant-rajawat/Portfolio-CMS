import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Github, Layers, Code2, Globe, Cpu, CheckCircle2 } from 'lucide-react';
import { publicApi } from '../../lib/publicApi.ts';
import { ProjectRecord } from '../../types.ts';
import { LoadingState } from '../../components/public/LoadingState.tsx';
import { ErrorState } from '../../components/public/ErrorState.tsx';
import { EmptyState } from '../../components/public/EmptyState.tsx';

export const ProjectDetailPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);

  const fetchProject = async () => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    try {
      const data = await publicApi.getProjectBySlug(slug);
      setProject(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load project details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProject();
  }, [slug]);

  useEffect(() => {
    if (project?.title) {
      document.title = `${project.title} | Portfolio`;
    } else {
      document.title = 'Project Showcase | Portfolio';
    }
  }, [project]);

  if (loading) {
    return (
      <div className="py-20 max-w-4xl mx-auto px-4">
        <LoadingState message="Loading project details..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-20 max-w-4xl mx-auto px-4">
        <ErrorState message={error} onRetry={fetchProject} />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="py-20 max-w-4xl mx-auto px-4 space-y-6">
        <Link
          to="/projects"
          className="inline-flex items-center gap-2 text-sm font-mono text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to projects directory</span>
        </Link>
        <EmptyState
          icon={Layers}
          title="Project Not Found"
          description="The requested project could not be found or has been removed from the directory."
        />
      </div>
    );
  }

  return (
    <div className="py-12 md:py-20 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
      {/* Back Navigation */}
      <div>
        <Link
          to="/projects"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-cyan-400 transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>Back to all projects</span>
        </Link>
      </div>

      {/* Project Header */}
      <header className="space-y-4">
        <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 uppercase tracking-wider">
          <Layers className="w-4 h-4" />
          <span>Project Architecture & Overview</span>
        </div>

        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight">
          {project.title}
        </h1>

        <p className="text-lg sm:text-xl text-slate-300 leading-relaxed font-normal">
          {project.short_description}
        </p>
      </header>

      {/* Action Links Bar */}
      <div className="flex flex-wrap items-center gap-4 border-y border-slate-800 py-4">
        {project.live_url && (
          <a
            href={project.live_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-sm transition-colors shadow-md shadow-cyan-500/10"
          >
            <Globe className="w-4 h-4" />
            <span>Visit Live Demo</span>
            <ExternalLink className="w-3.5 h-3.5 ml-0.5" />
          </a>
        )}

        {project.github_url && (
          <a
            href={project.github_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-sm border border-slate-700 transition-colors"
          >
            <Github className="w-4 h-4" />
            <span>View Source Code</span>
          </a>
        )}

        {!project.live_url && !project.github_url && (
          <span className="text-xs font-mono text-slate-500 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800">
            Internal / Enterprise Deployment
          </span>
        )}
      </div>

      {/* Hero Showcase Image */}
      {project.image_url && !imageError && (
        <div className="relative aspect-video w-full rounded-2xl overflow-hidden border border-slate-800 bg-slate-900 shadow-2xl">
          <img
            src={project.image_url}
            alt={project.title}
            onError={() => setImageError(true)}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Technologies Used */}
      {Array.isArray(project.technologies) && project.technologies.length > 0 && (
        <div className="space-y-3 bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6">
          <h2 className="text-xs font-mono text-cyan-400 uppercase tracking-wider flex items-center gap-2">
            <Cpu className="w-3.5 h-3.5" />
            <span>Technologies & Engineering Stack</span>
          </h2>
          <div className="flex flex-wrap gap-2 pt-1">
            {project.technologies.map((tech, idx) => (
              <span
                key={idx}
                className="px-3 py-1 rounded-lg text-xs font-mono font-medium bg-slate-800 text-slate-200 border border-slate-700/80"
              >
                {tech}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Full Description / Architecture Details */}
      <div className="space-y-4 bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 sm:p-8">
        <h2 className="text-xs font-mono text-slate-400 uppercase tracking-wider">
          System Overview & Technical Description
        </h2>
        <div className="text-slate-300 leading-relaxed text-base sm:text-lg space-y-4 whitespace-pre-line font-normal">
          {project.full_description || project.short_description}
        </div>
      </div>

      {/* Navigation Footer */}
      <div className="pt-8 border-t border-slate-800 flex items-center justify-between">
        <Link
          to="/projects"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 font-medium text-sm border border-slate-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>All Projects</span>
        </Link>

        <Link
          to="/contact"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-sm transition-colors"
        >
          <span>Request Collaboration</span>
        </Link>
      </div>
    </div>
  );
};
