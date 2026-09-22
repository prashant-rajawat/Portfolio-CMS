import React, { useState, useEffect, useCallback } from 'react';
import {
  FolderGit2,
  Plus,
  Edit2,
  Trash2,
  RefreshCw,
  Loader2,
  ExternalLink,
  Github,
  Globe,
  CheckCircle2,
  X,
  ImageIcon,
  Sparkles,
  Layers,
} from 'lucide-react';
import { api } from '../lib/api.ts';
import { FormField } from '../components/FormField.tsx';
import { Modal } from '../components/Modal.tsx';
import { ConfirmDialog } from '../components/ConfirmDialog.tsx';
import { AlertMessage } from '../components/AlertMessage.tsx';
import { LoadingState } from '../components/LoadingState.tsx';
import { EmptyState } from '../components/EmptyState.tsx';

export interface ProjectItem {
  id: string;
  title: string;
  slug: string;
  short_description: string;
  full_description: string;
  image_url: string | null;
  technologies: string[];
  live_url: string | null;
  github_url: string | null;
  display_order: number;
  created_at?: string;
  updated_at?: string;
}

interface ProjectFormData {
  title: string;
  slug: string;
  short_description: string;
  full_description: string;
  image_url: string;
  technologies: string[];
  techInput: string;
  live_url: string;
  github_url: string;
  display_order: string;
}

interface ProjectFormErrors {
  title?: string;
  slug?: string;
  short_description?: string;
  full_description?: string;
  image_url?: string;
  technologies?: string;
  live_url?: string;
  github_url?: string;
  display_order?: string;
  general?: string;
}

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const AdminProjectsPage: React.FC = () => {
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [initialLoading, setInitialLoading] = useState<boolean>(true);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingProject, setEditingProject] = useState<ProjectItem | null>(null);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState<boolean>(false);

  const [formData, setFormData] = useState<ProjectFormData>({
    title: '',
    slug: '',
    short_description: '',
    full_description: '',
    image_url: '',
    technologies: [],
    techInput: '',
    live_url: '',
    github_url: '',
    display_order: '0',
  });

  const [formErrors, setFormErrors] = useState<ProjectFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Delete Dialog State
  const [deleteTarget, setDeleteTarget] = useState<ProjectItem | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const fetchProjects = useCallback(async () => {
    setInitialLoading(true);
    setErrorMessage(null);
    try {
      const response = await api.get<ProjectItem[]>('/api/projects');
      const items: ProjectItem[] = Array.isArray(response.data) ? [...response.data] : [];
      // Sort by display_order ascending, then created_at
      items.sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
      setProjects(items);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Unable to load projects from the server.';
      setErrorMessage(msg);
    } finally {
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const validateUrl = (url: string): boolean => {
    if (!url.trim()) return true;
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const generateSlug = (text: string): string => {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
  };

  const handleTitleChange = (val: string) => {
    setFormData((prev) => {
      const updated = { ...prev, title: val };
      if (!editingProject && !slugManuallyEdited) {
        updated.slug = generateSlug(val);
      }
      return updated;
    });

    if (formErrors.title) {
      setFormErrors((prev) => ({ ...prev, title: undefined }));
    }
    if (!slugManuallyEdited && formErrors.slug) {
      setFormErrors((prev) => ({ ...prev, slug: undefined }));
    }
  };

  const handleAddTechnology = () => {
    const rawTag = formData.techInput.trim();
    if (!rawTag) return;

    if (formData.technologies.some((t) => t.toLowerCase() === rawTag.toLowerCase())) {
      setFormErrors((prev) => ({ ...prev, technologies: `"${rawTag}" is already in the list.` }));
      return;
    }

    setFormData((prev) => ({
      ...prev,
      technologies: [...prev.technologies, rawTag],
      techInput: '',
    }));

    if (formErrors.technologies) {
      setFormErrors((prev) => ({ ...prev, technologies: undefined }));
    }
  };

  const handleRemoveTechnology = (techToRemove: string) => {
    setFormData((prev) => ({
      ...prev,
      technologies: prev.technologies.filter((t) => t !== techToRemove),
    }));
  };

  const handleTechKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTechnology();
    }
  };

  const validateForm = (): boolean => {
    const errors: ProjectFormErrors = {};

    if (!formData.title.trim()) {
      errors.title = 'Project title is required';
    } else if (formData.title.length > 255) {
      errors.title = 'Title must not exceed 255 characters';
    }

    if (!formData.slug.trim()) {
      errors.slug = 'Slug is required';
    } else if (formData.slug.length > 255) {
      errors.slug = 'Slug must not exceed 255 characters';
    } else if (!SLUG_REGEX.test(formData.slug.trim())) {
      errors.slug = 'Slug must consist of lowercase letters, numbers, and hyphens (e.g. "my-project-1")';
    }

    if (!formData.short_description.trim()) {
      errors.short_description = 'Short description is required';
    }

    if (!formData.full_description.trim()) {
      errors.full_description = 'Full description is required';
    }

    if (formData.image_url.trim() && !validateUrl(formData.image_url.trim())) {
      errors.image_url = 'Please enter a valid URL (starting with http:// or https://)';
    }

    if (formData.live_url.trim() && !validateUrl(formData.live_url.trim())) {
      errors.live_url = 'Please enter a valid URL (starting with http:// or https://)';
    }

    if (formData.github_url.trim() && !validateUrl(formData.github_url.trim())) {
      errors.github_url = 'Please enter a valid URL (starting with http:// or https://)';
    }

    if (formData.display_order.trim() !== '') {
      const orderNum = Number(formData.display_order);
      if (isNaN(orderNum) || !Number.isInteger(orderNum)) {
        errors.display_order = 'Display order must be an integer';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleOpenAddModal = () => {
    setEditingProject(null);
    setSlugManuallyEdited(false);
    setFormData({
      title: '',
      slug: '',
      short_description: '',
      full_description: '',
      image_url: '',
      technologies: [],
      techInput: '',
      live_url: '',
      github_url: '',
      display_order: String(projects.length),
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (project: ProjectItem) => {
    setEditingProject(project);
    setSlugManuallyEdited(true);
    setFormData({
      title: project.title,
      slug: project.slug,
      short_description: project.short_description,
      full_description: project.full_description,
      image_url: project.image_url || '',
      technologies: Array.isArray(project.technologies) ? [...project.technologies] : [],
      techInput: '',
      live_url: project.live_url || '',
      github_url: project.github_url || '',
      display_order: String(project.display_order ?? 0),
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    if (isSubmitting) return;
    setIsModalOpen(false);
    setEditingProject(null);
    setFormErrors({});
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage(null);
    setErrorMessage(null);

    if (isSubmitting) return;

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    const payload = {
      title: formData.title.trim(),
      slug: formData.slug.trim(),
      short_description: formData.short_description.trim(),
      full_description: formData.full_description.trim(),
      image_url: formData.image_url.trim() || null,
      technologies: formData.technologies,
      live_url: formData.live_url.trim() || null,
      github_url: formData.github_url.trim() || null,
      display_order:
        formData.display_order.trim() !== '' ? parseInt(formData.display_order, 10) : 0,
    };

    try {
      if (editingProject) {
        // PUT /api/projects/:id
        const res = await api.put<ProjectItem>(`/api/projects/${editingProject.id}`, payload);
        if (res.success && res.data) {
          const updated = res.data;
          setProjects((prev) =>
            prev
              .map((p) => (p.id === editingProject.id ? { ...p, ...updated } : p))
              .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
          );
          setSuccessMessage(`Project "${payload.title}" updated successfully.`);
          setIsModalOpen(false);
          setEditingProject(null);
        } else {
          // Handle 409 or validation message safely
          const errMsg = res.error || res.message || 'Failed to update project.';
          if (errMsg.toLowerCase().includes('slug') || errMsg.toLowerCase().includes('already exists')) {
            setFormErrors((prev) => ({ ...prev, slug: 'A project with this slug already exists.' }));
          } else {
            setFormErrors((prev) => ({ ...prev, general: errMsg }));
          }
        }
      } else {
        // POST /api/projects
        const res = await api.post<ProjectItem>('/api/projects', payload);
        if (res.success && res.data) {
          const created = res.data;
          setProjects((prev) =>
            [...prev, created].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
          );
          setSuccessMessage(`Project "${payload.title}" created successfully.`);
          setIsModalOpen(false);
          setEditingProject(null);
        } else {
          // Handle 409 or validation message safely
          const errMsg = res.error || res.message || 'Failed to create project.';
          if (errMsg.toLowerCase().includes('slug') || errMsg.toLowerCase().includes('already exists')) {
            setFormErrors((prev) => ({ ...prev, slug: 'A project with this slug already exists.' }));
          } else {
            setFormErrors((prev) => ({ ...prev, general: errMsg }));
          }
        }
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        'Failed to save project. Please check your network and inputs.';
      if (msg.toLowerCase().includes('slug') || msg.toLowerCase().includes('already exists')) {
        setFormErrors((prev) => ({ ...prev, slug: 'A project with this slug already exists.' }));
      } else {
        setFormErrors((prev) => ({ ...prev, general: msg }));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || isDeleting) return;

    setIsDeleting(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const res = await api.delete(`/api/projects/${deleteTarget.id}`);
      if (res.success) {
        setProjects((prev) => prev.filter((p) => p.id !== deleteTarget.id));
        setSuccessMessage(`Project "${deleteTarget.title}" deleted successfully.`);
        setDeleteTarget(null);
      } else {
        setErrorMessage(res.error || `Failed to delete project "${deleteTarget.title}".`);
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        `Failed to delete project "${deleteTarget.title}".`;
      setErrorMessage(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-950/60 border border-indigo-800/80 flex items-center justify-center text-indigo-400">
              <FolderGit2 className="w-4 h-4" />
            </div>
            <h1 className="text-base font-bold text-slate-100">Projects CMS</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Manage your portfolio case studies, technical stacks, live deployment links, and repositories.
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            type="button"
            onClick={fetchProjects}
            disabled={initialLoading || isSubmitting || isDeleting}
            className="inline-flex items-center space-x-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700/80 text-slate-300 hover:text-white text-xs font-medium rounded-lg border border-slate-700/60 transition cursor-pointer disabled:opacity-50"
            title="Refresh projects"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${initialLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            type="button"
            onClick={handleOpenAddModal}
            className="inline-flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg shadow-sm transition active:scale-[0.98] cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Project</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <AlertMessage
          type="success"
          message={successMessage}
          onClose={() => setSuccessMessage(null)}
        />
      )}
      {errorMessage && (
        <AlertMessage
          type="error"
          message={errorMessage}
          onClose={() => setErrorMessage(null)}
        />
      )}

      {/* Main Content Area */}
      {initialLoading ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl">
          <LoadingState message="Loading projects showcase from server..." />
        </div>
      ) : projects.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No projects added yet"
          description="Your portfolio doesn't have any showcase projects listed yet. Create your first case study or architectural build."
          actionLabel="Add Project"
          onAction={handleOpenAddModal}
        />
      ) : (
        <div className="space-y-4">
          {/* Desktop Table View (Hidden on mobile) */}
          <div className="hidden md:block bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 font-medium">
                  <th className="py-3 px-4 w-14 text-center">Order</th>
                  <th className="py-3 px-4 w-16">Image</th>
                  <th className="py-3 px-4">Project & Details</th>
                  <th className="py-3 px-4">Technologies</th>
                  <th className="py-3 px-4 w-28 text-center">Links</th>
                  <th className="py-3 px-4 text-right w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {projects.map((project) => (
                  <tr key={project.id} className="hover:bg-slate-800/30 transition">
                    {/* Display Order */}
                    <td className="py-3.5 px-4 text-center font-mono text-slate-500 text-[11px]">
                      {project.display_order ?? 0}
                    </td>

                    {/* Image Thumbnail */}
                    <td className="py-3.5 px-4">
                      {project.image_url ? (
                        <div className="w-12 h-9 rounded bg-slate-800 border border-slate-700/60 overflow-hidden flex items-center justify-center">
                          <img
                            src={project.image_url}
                            alt=""
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        </div>
                      ) : (
                        <div className="w-12 h-9 rounded bg-slate-800/60 border border-slate-700/40 flex items-center justify-center text-slate-600">
                          <ImageIcon className="w-4 h-4" />
                        </div>
                      )}
                    </td>

                    {/* Project Title, Slug, and Short Desc */}
                    <td className="py-3.5 px-4">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-slate-100 text-xs">
                            {project.title}
                          </span>
                          <span className="font-mono text-[10px] text-indigo-400 bg-indigo-950/50 px-1.5 py-0.5 rounded border border-indigo-900/60">
                            /{project.slug}
                          </span>
                        </div>
                        <p className="text-slate-400 text-[11px] line-clamp-2 max-w-md">
                          {project.short_description}
                        </p>
                      </div>
                    </td>

                    {/* Technologies */}
                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {project.technologies && project.technologies.length > 0 ? (
                          project.technologies.map((tech, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700/60"
                            >
                              {tech}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-600 text-[11px]">—</span>
                        )}
                      </div>
                    </td>

                    {/* Links */}
                    <td className="py-3.5 px-4 text-center">
                      <div className="inline-flex items-center space-x-1.5">
                        {project.live_url ? (
                          <a
                            href={project.live_url}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded transition"
                            title={`Live: ${project.live_url}`}
                            aria-label={`Open live site for ${project.title}`}
                          >
                            <Globe className="w-4 h-4" />
                          </a>
                        ) : (
                          <span
                            className="p-1 text-slate-700 cursor-not-allowed"
                            title="No live demo link"
                          >
                            <Globe className="w-4 h-4" />
                          </span>
                        )}

                        {project.github_url ? (
                          <a
                            href={project.github_url}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded transition"
                            title={`Repository: ${project.github_url}`}
                            aria-label={`Open GitHub repository for ${project.title}`}
                          >
                            <Github className="w-4 h-4" />
                          </a>
                        ) : (
                          <span
                            className="p-1 text-slate-700 cursor-not-allowed"
                            title="No repository link"
                          >
                            <Github className="w-4 h-4" />
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Action Buttons */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center space-x-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(project)}
                          className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-800/80 rounded-lg transition cursor-pointer"
                          title="Edit project"
                          aria-label={`Edit ${project.title}`}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(project)}
                          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800/80 rounded-lg transition cursor-pointer"
                          title="Delete project"
                          aria-label={`Delete ${project.title}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List View (Visible on small screens) */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {projects.map((project) => (
              <div
                key={project.id}
                className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start space-x-3">
                    {project.image_url ? (
                      <div className="w-12 h-10 rounded bg-slate-800 border border-slate-700/60 overflow-hidden flex-shrink-0">
                        <img
                          src={project.image_url}
                          alt=""
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      </div>
                    ) : (
                      <div className="w-12 h-10 rounded bg-slate-800/60 border border-slate-700/40 flex items-center justify-center text-slate-600 flex-shrink-0">
                        <ImageIcon className="w-4 h-4" />
                      </div>
                    )}
                    <div>
                      <h3 className="text-xs font-semibold text-slate-200">{project.title}</h3>
                      <span className="font-mono text-[10px] text-indigo-400 bg-indigo-950/50 px-1.5 py-0.5 rounded border border-indigo-900/60 inline-block mt-0.5">
                        /{project.slug}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(project)}
                      className="p-2 text-slate-400 hover:text-indigo-400 hover:bg-slate-800/80 rounded-lg transition cursor-pointer"
                      aria-label={`Edit ${project.title}`}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(project)}
                      className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800/80 rounded-lg transition cursor-pointer"
                      aria-label={`Delete ${project.title}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <p className="text-xs text-slate-400">{project.short_description}</p>

                {project.technologies && project.technologies.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {project.technologies.map((tech, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700/60"
                      >
                        {tech}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-800/60">
                  <span>Order: {project.display_order ?? 0}</span>
                  <div className="flex items-center space-x-3">
                    {project.live_url && (
                      <a
                        href={project.live_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-emerald-400 hover:underline inline-flex items-center space-x-1"
                      >
                        <Globe className="w-3 h-3" />
                        <span>Live</span>
                      </a>
                    )}
                    {project.github_url && (
                      <a
                        href={project.github_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-400 hover:underline inline-flex items-center space-x-1"
                      >
                        <Github className="w-3 h-3" />
                        <span>Code</span>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add / Edit Project Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingProject ? `Edit Project: ${editingProject.title}` : 'Add New Project'}
        description={
          editingProject
            ? 'Update project showcase details, technologies, and deployment links.'
            : 'Fill in the project details to publish it on your portfolio showcase.'
        }
        maxWidth="2xl"
      >
        <form onSubmit={handleFormSubmit} className="space-y-4" noValidate>
          {formErrors.general && (
            <AlertMessage
              type="error"
              message={formErrors.general}
              onClose={() => setFormErrors((prev) => ({ ...prev, general: undefined }))}
            />
          )}

          {/* Grid: Title & Slug */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Title */}
            <FormField
              id="project-title"
              label="Project Title"
              required
              error={formErrors.title}
              helperText="e.g. Cloud Vault Architecture"
            >
              <input
                id="project-title"
                type="text"
                value={formData.title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="Cloud Vault Architecture"
                maxLength={255}
                disabled={isSubmitting}
                className={`w-full px-3.5 py-2 bg-slate-950/70 border rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 transition ${
                  formErrors.title
                    ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20'
                    : 'border-slate-800 focus:border-indigo-500 focus:ring-indigo-500/20'
                }`}
              />
            </FormField>

            {/* Slug */}
            <FormField
              id="project-slug"
              label="URL Slug"
              required
              error={formErrors.slug}
              helperText="Lowercase letters, numbers, and hyphens (e.g. cloud-vault)"
            >
              <div className="relative">
                <input
                  id="project-slug"
                  type="text"
                  value={formData.slug}
                  onChange={(e) => {
                    setSlugManuallyEdited(true);
                    setFormData({ ...formData, slug: e.target.value });
                    if (formErrors.slug) setFormErrors({ ...formErrors, slug: undefined });
                  }}
                  placeholder="cloud-vault"
                  maxLength={255}
                  disabled={isSubmitting}
                  className={`w-full px-3.5 py-2 bg-slate-950/70 border rounded-lg text-xs text-slate-100 placeholder-slate-500 font-mono focus:outline-none focus:ring-1 transition ${
                    formErrors.slug
                      ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20'
                      : 'border-slate-800 focus:border-indigo-500 focus:ring-indigo-500/20'
                  }`}
                />
                {!slugManuallyEdited && formData.title && (
                  <button
                    type="button"
                    onClick={() => {
                      setFormData({ ...formData, slug: generateSlug(formData.title) });
                      if (formErrors.slug) setFormErrors({ ...formErrors, slug: undefined });
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-indigo-400 p-1 transition cursor-pointer"
                    title="Generate slug from title"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </FormField>
          </div>

          {/* Short Description */}
          <FormField
            id="project-short-desc"
            label="Short Summary Description"
            required
            error={formErrors.short_description}
            helperText="Concise summary displayed on cards and overview grids"
          >
            <textarea
              id="project-short-desc"
              rows={2}
              value={formData.short_description}
              onChange={(e) => {
                setFormData({ ...formData, short_description: e.target.value });
                if (formErrors.short_description) {
                  setFormErrors({ ...formErrors, short_description: undefined });
                }
              }}
              placeholder="High-performance cloud storage manager with encrypted multi-tenant storage."
              disabled={isSubmitting}
              className={`w-full px-3.5 py-2 bg-slate-950/70 border rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 transition ${
                formErrors.short_description
                  ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20'
                  : 'border-slate-800 focus:border-indigo-500 focus:ring-indigo-500/20'
              }`}
            />
          </FormField>

          {/* Full Description */}
          <FormField
            id="project-full-desc"
            label="Full Project Story & Architecture Description"
            required
            error={formErrors.full_description}
            helperText="Complete project case study details, architecture decisions, and metrics"
          >
            <textarea
              id="project-full-desc"
              rows={5}
              value={formData.full_description}
              onChange={(e) => {
                setFormData({ ...formData, full_description: e.target.value });
                if (formErrors.full_description) {
                  setFormErrors({ ...formErrors, full_description: undefined });
                }
              }}
              placeholder="Architected a distributed asset storage system handling millions of concurrent requests..."
              disabled={isSubmitting}
              className={`w-full px-3.5 py-2 bg-slate-950/70 border rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 transition ${
                formErrors.full_description
                  ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20'
                  : 'border-slate-800 focus:border-indigo-500 focus:ring-indigo-500/20'
              }`}
            />
          </FormField>

          {/* Technologies Tag Manager */}
          <FormField
            id="project-tech-input"
            label="Technologies & Tools (Tags)"
            error={formErrors.technologies}
            helperText="Type a technology and click Add or press Enter"
          >
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <div className="relative flex-1">
                  <input
                    id="project-tech-input"
                    type="text"
                    value={formData.techInput}
                    onChange={(e) => {
                      setFormData({ ...formData, techInput: e.target.value });
                      if (formErrors.technologies) {
                        setFormErrors({ ...formErrors, technologies: undefined });
                      }
                    }}
                    onKeyDown={handleTechKeyDown}
                    placeholder="e.g. React, TypeScript, Docker, PostgreSQL"
                    disabled={isSubmitting}
                    className="w-full px-3.5 py-2 bg-slate-950/70 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none transition"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddTechnology}
                  disabled={!formData.techInput.trim() || isSubmitting}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700/90 disabled:opacity-50 text-slate-200 text-xs font-medium rounded-lg border border-slate-700/60 transition cursor-pointer"
                >
                  Add
                </button>
              </div>

              {/* Tag Chips Container */}
              <div className="flex flex-wrap gap-1.5 min-h-[28px] p-2 bg-slate-950/40 rounded-lg border border-slate-800/80">
                {formData.technologies.length === 0 ? (
                  <span className="text-[11px] text-slate-600 italic">No technologies added yet.</span>
                ) : (
                  formData.technologies.map((tech) => (
                    <span
                      key={tech}
                      className="inline-flex items-center space-x-1 pl-2 pr-1 py-0.5 rounded-md text-xs font-medium bg-indigo-950/70 text-indigo-300 border border-indigo-800/60"
                    >
                      <span>{tech}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveTechnology(tech)}
                        disabled={isSubmitting}
                        className="p-0.5 text-indigo-400 hover:text-indigo-200 hover:bg-indigo-900/80 rounded transition cursor-pointer"
                        aria-label={`Remove ${tech}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))
                )}
              </div>
            </div>
          </FormField>

          {/* Grid: Image URL & Display Order */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Image URL */}
            <FormField
              id="project-image-url"
              label="Cover Image URL"
              error={formErrors.image_url}
              helperText="Optional public image link for project thumbnail"
            >
              <input
                id="project-image-url"
                type="url"
                value={formData.image_url}
                onChange={(e) => {
                  setFormData({ ...formData, image_url: e.target.value });
                  if (formErrors.image_url) setFormErrors({ ...formErrors, image_url: undefined });
                }}
                placeholder="https://example.com/project-cover.jpg"
                disabled={isSubmitting}
                className={`w-full px-3.5 py-2 bg-slate-950/70 border rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 transition ${
                  formErrors.image_url
                    ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20'
                    : 'border-slate-800 focus:border-indigo-500 focus:ring-indigo-500/20'
                }`}
              />
            </FormField>

            {/* Display Order */}
            <FormField
              id="project-display-order"
              label="Display Order"
              error={formErrors.display_order}
              helperText="Integer sequence for sorting (0, 1, 2...)"
            >
              <input
                id="project-display-order"
                type="number"
                step={1}
                value={formData.display_order}
                onChange={(e) => {
                  setFormData({ ...formData, display_order: e.target.value });
                  if (formErrors.display_order) {
                    setFormErrors({ ...formErrors, display_order: undefined });
                  }
                }}
                placeholder="0"
                disabled={isSubmitting}
                className={`w-full px-3.5 py-2 bg-slate-950/70 border rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 transition ${
                  formErrors.display_order
                    ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20'
                    : 'border-slate-800 focus:border-indigo-500 focus:ring-indigo-500/20'
                }`}
              />
            </FormField>
          </div>

          {/* Grid: Live URL & GitHub URL */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Live URL */}
            <FormField
              id="project-live-url"
              label="Live Demo URL"
              error={formErrors.live_url}
              helperText="Optional public link to deployed application"
            >
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Globe className="w-3.5 h-3.5" />
                </div>
                <input
                  id="project-live-url"
                  type="url"
                  value={formData.live_url}
                  onChange={(e) => {
                    setFormData({ ...formData, live_url: e.target.value });
                    if (formErrors.live_url) setFormErrors({ ...formErrors, live_url: undefined });
                  }}
                  placeholder="https://myproject.com"
                  disabled={isSubmitting}
                  className={`w-full pl-9 pr-3.5 py-2 bg-slate-950/70 border rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 transition ${
                    formErrors.live_url
                      ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20'
                      : 'border-slate-800 focus:border-indigo-500 focus:ring-indigo-500/20'
                  }`}
                />
              </div>
            </FormField>

            {/* GitHub URL */}
            <FormField
              id="project-github-url"
              label="GitHub Repository URL"
              error={formErrors.github_url}
              helperText="Optional public link to source code repository"
            >
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Github className="w-3.5 h-3.5" />
                </div>
                <input
                  id="project-github-url"
                  type="url"
                  value={formData.github_url}
                  onChange={(e) => {
                    setFormData({ ...formData, github_url: e.target.value });
                    if (formErrors.github_url) {
                      setFormErrors({ ...formErrors, github_url: undefined });
                    }
                  }}
                  placeholder="https://github.com/username/repo"
                  disabled={isSubmitting}
                  className={`w-full pl-9 pr-3.5 py-2 bg-slate-950/70 border rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 transition ${
                    formErrors.github_url
                      ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20'
                      : 'border-slate-800 focus:border-indigo-500 focus:ring-indigo-500/20'
                  }`}
                />
              </div>
            </FormField>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end space-x-2.5 pt-3 border-t border-slate-800/80">
            <button
              type="button"
              onClick={handleCloseModal}
              disabled={isSubmitting}
              className="px-3.5 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700/80 disabled:opacity-50 rounded-lg transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] disabled:opacity-50 text-white text-xs font-medium rounded-lg shadow-sm transition cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{editingProject ? 'Update Project' : 'Create Project'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => !isDeleting && setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Project"
        message={
          deleteTarget
            ? `Are you sure you want to delete "${deleteTarget.title}"? This action cannot be undone.`
            : 'Are you sure you want to delete this project?'
        }
        confirmLabel="Delete Project"
        cancelLabel="Cancel"
        isLoading={isDeleting}
        isDestructive={true}
      />
    </div>
  );
};
