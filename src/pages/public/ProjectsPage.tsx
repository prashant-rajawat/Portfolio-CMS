import React, { useState, useEffect, useMemo } from 'react';
import { Layers, Search, Code2 } from 'lucide-react';
import { publicApi } from '../../lib/publicApi.ts';
import { ProjectRecord } from '../../types.ts';
import { SectionHeading } from '../../components/public/SectionHeading.tsx';
import { LoadingState } from '../../components/public/LoadingState.tsx';
import { ErrorState } from '../../components/public/ErrorState.tsx';
import { EmptyState } from '../../components/public/EmptyState.tsx';
import { ProjectCard } from '../../components/public/ProjectCard.tsx';

export const ProjectsPage: React.FC = () => {
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTech, setSelectedTech] = useState<string>('all');

  const fetchProjects = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await publicApi.getProjects();
      setProjects(data.sort((a, b) => a.display_order - b.display_order));
    } catch (err: any) {
      setError(err?.message || 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.title = 'Projects | Portfolio';
    fetchProjects();
  }, []);

  // Extract unique technologies across all projects
  const allTechnologies = useMemo(() => {
    const techSet = new Set<string>();
    projects.forEach((p) => {
      if (Array.isArray(p.technologies)) {
        p.technologies.forEach((t) => techSet.add(t));
      }
    });
    return Array.from(techSet).sort();
  }, [projects]);

  // Filter projects by search query and tech tag
  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const matchesSearch =
        searchQuery === '' ||
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.short_description.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesTech =
        selectedTech === 'all' ||
        (Array.isArray(p.technologies) && p.technologies.includes(selectedTech));

      return matchesSearch && matchesTech;
    });
  }, [projects, searchQuery, selectedTech]);

  if (loading) {
    return (
      <div className="py-20 max-w-7xl mx-auto px-4">
        <LoadingState message="Loading projects showcase..." variant="skeleton-cards" count={6} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-20 max-w-7xl mx-auto px-4">
        <ErrorState message={error} onRetry={fetchProjects} />
      </div>
    );
  }

  return (
    <div className="py-12 md:py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
      <SectionHeading
        badge="Showcase"
        title="Engineering Projects & Systems"
        description="Explore production software systems, distributed services, and open-source contributions."
      />

      {/* Filter and Search Controls */}
      {projects.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900/40 p-4 rounded-xl border border-slate-800">
          {/* Search Input */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg bg-slate-800/80 border border-slate-700/80 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Tech Filter Dropdown */}
          {allTechnologies.length > 0 && (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs font-mono text-slate-400 whitespace-nowrap">Filter Stack:</span>
              <select
                value={selectedTech}
                onChange={(e) => setSelectedTech(e.target.value)}
                className="w-full sm:w-auto px-3 py-2 rounded-lg bg-slate-800/80 border border-slate-700/80 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                <option value="all">All Technologies ({projects.length})</option>
                {allTechnologies.map((tech) => (
                  <option key={tech} value={tech}>
                    {tech}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Projects Grid */}
      {filteredProjects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      ) : projects.length > 0 ? (
        <div className="py-12 text-center text-slate-400 bg-slate-900/20 rounded-xl border border-slate-800 p-8">
          <p className="text-sm">No projects matched your search criteria.</p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedTech('all');
            }}
            className="mt-3 text-xs font-mono text-cyan-400 hover:underline"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <EmptyState
          icon={Layers}
          title="No Projects in Portfolio"
          description="Projects registered in the CMS Admin panel will be showcased here."
        />
      )}
    </div>
  );
};
