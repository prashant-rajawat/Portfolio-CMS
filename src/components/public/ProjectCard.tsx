import React, { useState } from 'react';
import { ExternalLink, Github, Layers, Code2 } from 'lucide-react';
import { ProjectRecord } from '../../types.ts';

interface ProjectCardProps {
  project: ProjectRecord;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({ project }) => {
  const [imageError, setImageError] = useState(false);

  return (
    <div className="group rounded-xl border border-slate-800 bg-slate-900/50 hover:bg-slate-900/80 hover:border-slate-700/80 transition-all duration-300 flex flex-col overflow-hidden shadow-sm">
      {/* Project Thumbnail */}
      <div className="relative aspect-video w-full bg-slate-950 overflow-hidden border-b border-slate-800/80 flex items-center justify-center">
        {project.image_url && !imageError ? (
          <img
            src={project.image_url}
            alt={project.title}
            onError={() => setImageError(true)}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-slate-600 p-6 text-center">
            <Layers className="w-10 h-10 mb-2 stroke-[1.5] text-slate-700 group-hover:text-cyan-500/60 transition-colors" />
            <span className="text-xs font-mono text-slate-500">Project Showcase</span>
          </div>
        )}
      </div>

      {/* Card Content */}
      <div className="p-6 flex-1 flex flex-col justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-100 group-hover:text-cyan-400 transition-colors">
            {project.title}
          </h3>
          <p className="mt-2 text-sm text-slate-400 line-clamp-3 leading-relaxed">
            {project.short_description}
          </p>
        </div>

        {/* Tech Stack & Links */}
        <div className="mt-6 pt-4 border-t border-slate-800/80 space-y-4">
          {project.technologies && project.technologies.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {project.technologies.map((tech, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded-md text-[11px] font-mono font-medium bg-slate-800/80 text-slate-300 border border-slate-700/60"
                >
                  {tech}
                </span>
              ))}
            </div>
          )}

          {/* Action Links */}
          <div className="flex items-center gap-3 pt-1">
            {project.live_url && (
              <a
                href={project.live_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-cyan-400 hover:text-cyan-300 transition-colors"
                aria-label={`View live demo for ${project.title}`}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Live Demo</span>
              </a>
            )}
            {project.github_url && (
              <a
                href={project.github_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-300 hover:text-white transition-colors"
                aria-label={`View GitHub repository for ${project.title}`}
              >
                <Github className="w-3.5 h-3.5" />
                <span>Source</span>
              </a>
            )}
            {!project.live_url && !project.github_url && (
              <span className="text-xs text-slate-500 font-mono">Internal / Proprietary</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
