import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Plus,
  Edit2,
  Trash2,
  RefreshCw,
  Loader2,
  CheckCircle2,
  ImageIcon,
  Sparkles,
  BookOpen,
  Calendar,
  User,
  Check,
  Clock,
} from 'lucide-react';
import { api } from '../lib/api.ts';
import { FormField } from '../components/FormField.tsx';
import { Modal } from '../components/Modal.tsx';
import { ConfirmDialog } from '../components/ConfirmDialog.tsx';
import { AlertMessage } from '../components/AlertMessage.tsx';
import { LoadingState } from '../components/LoadingState.tsx';
import { EmptyState } from '../components/EmptyState.tsx';

export interface BlogItem {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  featured_image_url: string | null;
  author_id?: string | null;
  author_name?: string | null;
  published: boolean;
  published_at: string | null;
  created_at?: string;
  updated_at?: string;
}

interface BlogFormData {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  featured_image_url: string;
  published: boolean;
  published_at: string;
}

interface BlogFormErrors {
  title?: string;
  slug?: string;
  excerpt?: string;
  content?: string;
  featured_image_url?: string;
  published_at?: string;
  general?: string;
}

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const AdminBlogsPage: React.FC = () => {
  const [blogs, setBlogs] = useState<BlogItem[]>([]);
  const [initialLoading, setInitialLoading] = useState<boolean>(true);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingBlog, setEditingBlog] = useState<BlogItem | null>(null);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState<boolean>(false);

  const [formData, setFormData] = useState<BlogFormData>({
    title: '',
    slug: '',
    excerpt: '',
    content: '',
    featured_image_url: '',
    published: false,
    published_at: '',
  });

  const [formErrors, setFormErrors] = useState<BlogFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Delete Dialog State
  const [deleteTarget, setDeleteTarget] = useState<BlogItem | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const fetchBlogs = useCallback(async () => {
    setInitialLoading(true);
    setErrorMessage(null);
    try {
      const response = await api.get<BlogItem[]>('/api/blogs');
      const items: BlogItem[] = Array.isArray(response.data) ? [...response.data] : [];
      setBlogs(items);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Unable to load blog posts from the server.';
      setErrorMessage(msg);
    } finally {
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBlogs();
  }, [fetchBlogs]);

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
      if (!editingBlog && !slugManuallyEdited) {
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

  const validateForm = (): boolean => {
    const errors: BlogFormErrors = {};

    if (!formData.title.trim()) {
      errors.title = 'Blog title is required';
    } else if (formData.title.length > 255) {
      errors.title = 'Title must not exceed 255 characters';
    }

    if (!formData.slug.trim()) {
      errors.slug = 'Slug is required';
    } else if (formData.slug.length > 255) {
      errors.slug = 'Slug must not exceed 255 characters';
    } else if (!SLUG_REGEX.test(formData.slug.trim())) {
      errors.slug =
        'Slug must consist of lowercase letters, numbers, and hyphens (e.g. "my-first-post")';
    }

    if (!formData.excerpt.trim()) {
      errors.excerpt = 'Excerpt is required';
    }

    if (!formData.content.trim()) {
      errors.content = 'Content is required';
    }

    if (formData.featured_image_url.trim() && !validateUrl(formData.featured_image_url.trim())) {
      errors.featured_image_url =
        'Please enter a valid URL (starting with http:// or https://)';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const formatIsoForInput = (isoDate?: string | null): string => {
    if (!isoDate) return '';
    try {
      const d = new Date(isoDate);
      if (isNaN(d.getTime())) return '';
      // Return YYYY-MM-DDTHH:mm
      return d.toISOString().slice(0, 16);
    } catch {
      return '';
    }
  };

  const handleOpenAddModal = () => {
    setEditingBlog(null);
    setSlugManuallyEdited(false);
    setFormData({
      title: '',
      slug: '',
      excerpt: '',
      content: '',
      featured_image_url: '',
      published: false,
      published_at: '',
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (blog: BlogItem) => {
    setEditingBlog(blog);
    setSlugManuallyEdited(true);
    setFormData({
      title: blog.title,
      slug: blog.slug,
      excerpt: blog.excerpt,
      content: blog.content,
      featured_image_url: blog.featured_image_url || '',
      published: Boolean(blog.published),
      published_at: formatIsoForInput(blog.published_at),
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    if (isSubmitting) return;
    setIsModalOpen(false);
    setEditingBlog(null);
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
      excerpt: formData.excerpt.trim(),
      content: formData.content.trim(),
      featured_image_url: formData.featured_image_url.trim() || null,
      published: formData.published,
      published_at:
        formData.published && formData.published_at.trim()
          ? new Date(formData.published_at.trim()).toISOString()
          : formData.published
          ? undefined // Backend will assign current timestamp
          : null,
    };

    try {
      if (editingBlog) {
        // PUT /api/blogs/:id
        const res = await api.put<BlogItem>(`/api/blogs/${editingBlog.id}`, payload);
        if (res.success && res.data) {
          const updated = res.data;
          setBlogs((prev) =>
            prev.map((b) => (b.id === editingBlog.id ? { ...b, ...updated } : b))
          );
          setSuccessMessage(`Blog post "${payload.title}" updated successfully.`);
          setIsModalOpen(false);
          setEditingBlog(null);
        } else {
          const errMsg = res.error || res.message || 'Failed to update blog post.';
          if (
            errMsg.toLowerCase().includes('slug') ||
            errMsg.toLowerCase().includes('already exists')
          ) {
            setFormErrors((prev) => ({
              ...prev,
              slug: 'A blog with this slug already exists.',
            }));
          } else {
            setFormErrors((prev) => ({ ...prev, general: errMsg }));
          }
        }
      } else {
        // POST /api/blogs
        const res = await api.post<BlogItem>('/api/blogs', payload);
        if (res.success && res.data) {
          const created = res.data;
          setBlogs((prev) => [created, ...prev]);
          setSuccessMessage(`Blog post "${payload.title}" created successfully.`);
          setIsModalOpen(false);
          setEditingBlog(null);
        } else {
          const errMsg = res.error || res.message || 'Failed to create blog post.';
          if (
            errMsg.toLowerCase().includes('slug') ||
            errMsg.toLowerCase().includes('already exists')
          ) {
            setFormErrors((prev) => ({
              ...prev,
              slug: 'A blog with this slug already exists.',
            }));
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
        'Failed to save blog post. Please check your inputs.';
      if (
        msg.toLowerCase().includes('slug') ||
        msg.toLowerCase().includes('already exists')
      ) {
        setFormErrors((prev) => ({
          ...prev,
          slug: 'A blog with this slug already exists.',
        }));
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
      const res = await api.delete(`/api/blogs/${deleteTarget.id}`);
      if (res.success) {
        setBlogs((prev) => prev.filter((b) => b.id !== deleteTarget.id));
        setSuccessMessage(`Blog post "${deleteTarget.title}" deleted successfully.`);
        setDeleteTarget(null);
      } else {
        setErrorMessage(res.error || `Failed to delete blog post "${deleteTarget.title}".`);
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        `Failed to delete blog post "${deleteTarget.title}".`;
      setErrorMessage(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (isoDate?: string | null): string => {
    if (!isoDate) return '—';
    try {
      const date = new Date(isoDate);
      if (isNaN(date.getTime())) return '—';
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).format(date);
    } catch {
      return '—';
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-950/60 border border-indigo-800/80 flex items-center justify-center text-indigo-400">
              <FileText className="w-4 h-4" />
            </div>
            <h1 className="text-base font-bold text-slate-100">Blog Posts CMS</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Author, publish, and curate technical articles, architecture deep-dives, and tutorials.
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            type="button"
            onClick={fetchBlogs}
            disabled={initialLoading || isSubmitting || isDeleting}
            className="inline-flex items-center space-x-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700/80 text-slate-300 hover:text-white text-xs font-medium rounded-lg border border-slate-700/60 transition cursor-pointer disabled:opacity-50"
            title="Refresh blog posts"
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
            <span>Create Blog</span>
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
          <LoadingState message="Loading blog posts from server..." />
        </div>
      ) : blogs.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No blog posts yet"
          description="You haven't written any blog articles or deep-dives yet. Create your first post to share engineering insights."
          actionLabel="Create Blog"
          onAction={handleOpenAddModal}
        />
      ) : (
        <div className="space-y-4">
          {/* Desktop Table View */}
          <div className="hidden md:block bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 font-medium">
                  <th className="py-3 px-4 w-16">Cover</th>
                  <th className="py-3 px-4">Title & Excerpt</th>
                  <th className="py-3 px-4 w-32">Author</th>
                  <th className="py-3 px-4 w-28 text-center">Status</th>
                  <th className="py-3 px-4 w-32">Published</th>
                  <th className="py-3 px-4 text-right w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {blogs.map((blog) => (
                  <tr key={blog.id} className="hover:bg-slate-800/30 transition">
                    {/* Featured Image */}
                    <td className="py-3.5 px-4">
                      {blog.featured_image_url ? (
                        <div className="w-12 h-9 rounded bg-slate-800 border border-slate-700/60 overflow-hidden flex items-center justify-center">
                          <img
                            src={blog.featured_image_url}
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

                    {/* Title & Excerpt */}
                    <td className="py-3.5 px-4">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-slate-100 text-xs">
                            {blog.title}
                          </span>
                          <span className="font-mono text-[10px] text-indigo-400 bg-indigo-950/50 px-1.5 py-0.5 rounded border border-indigo-900/60">
                            /{blog.slug}
                          </span>
                        </div>
                        <p className="text-slate-400 text-[11px] line-clamp-2 max-w-md">
                          {blog.excerpt}
                        </p>
                      </div>
                    </td>

                    {/* Author */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center space-x-1.5 text-slate-300 text-xs">
                        <User className="w-3.5 h-3.5 text-slate-500" />
                        <span>{blog.author_name || 'Admin'}</span>
                      </div>
                    </td>

                    {/* Status Badge */}
                    <td className="py-3.5 px-4 text-center">
                      {blog.published ? (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-800/80">
                          <Check className="w-3 h-3" />
                          <span>Published</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-amber-950/80 text-amber-400 border border-amber-800/80">
                          <Clock className="w-3 h-3" />
                          <span>Draft</span>
                        </span>
                      )}
                    </td>

                    {/* Published Date */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center space-x-1.5 text-slate-400 text-[11px]">
                        <Calendar className="w-3.5 h-3.5 text-slate-600" />
                        <span>{formatDate(blog.published_at)}</span>
                      </div>
                    </td>

                    {/* Action Buttons */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center space-x-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(blog)}
                          className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-800/80 rounded-lg transition cursor-pointer"
                          title="Edit blog post"
                          aria-label={`Edit ${blog.title}`}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(blog)}
                          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800/80 rounded-lg transition cursor-pointer"
                          title="Delete blog post"
                          aria-label={`Delete ${blog.title}`}
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

          {/* Mobile Card List View */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {blogs.map((blog) => (
              <div
                key={blog.id}
                className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start space-x-3">
                    {blog.featured_image_url ? (
                      <div className="w-12 h-10 rounded bg-slate-800 border border-slate-700/60 overflow-hidden flex-shrink-0">
                        <img
                          src={blog.featured_image_url}
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
                      <h3 className="text-xs font-semibold text-slate-200">{blog.title}</h3>
                      <span className="font-mono text-[10px] text-indigo-400 bg-indigo-950/50 px-1.5 py-0.5 rounded border border-indigo-900/60 inline-block mt-0.5">
                        /{blog.slug}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(blog)}
                      className="p-2 text-slate-400 hover:text-indigo-400 hover:bg-slate-800/80 rounded-lg transition cursor-pointer"
                      aria-label={`Edit ${blog.title}`}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(blog)}
                      className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800/80 rounded-lg transition cursor-pointer"
                      aria-label={`Delete ${blog.title}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <p className="text-xs text-slate-400">{blog.excerpt}</p>

                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-800/60">
                  <div className="flex items-center space-x-2">
                    {blog.published ? (
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-950/80 text-emerald-400 border border-emerald-800/80">
                        <Check className="w-2.5 h-2.5" />
                        <span>Published</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-medium bg-amber-950/80 text-amber-400 border border-amber-800/80">
                        <Clock className="w-2.5 h-2.5" />
                        <span>Draft</span>
                      </span>
                    )}
                    <span>by {blog.author_name || 'Admin'}</span>
                  </div>
                  <span>{formatDate(blog.published_at)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add / Edit Blog Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingBlog ? `Edit Blog: ${editingBlog.title}` : 'Create Blog Post'}
        description={
          editingBlog
            ? 'Update article details, markdown content, cover image, and publishing status.'
            : 'Write and publish a new engineering case study or technical deep-dive.'
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
              id="blog-title"
              label="Blog Post Title"
              required
              error={formErrors.title}
              helperText="e.g. Scaling Distributed State with CRDTs"
            >
              <input
                id="blog-title"
                type="text"
                value={formData.title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="Scaling Distributed State with CRDTs"
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
              id="blog-slug"
              label="URL Slug"
              required
              error={formErrors.slug}
              helperText="Lowercase letters, numbers, and hyphens (e.g. scaling-crdts)"
            >
              <div className="relative">
                <input
                  id="blog-slug"
                  type="text"
                  value={formData.slug}
                  onChange={(e) => {
                    setSlugManuallyEdited(true);
                    setFormData({ ...formData, slug: e.target.value });
                    if (formErrors.slug) setFormErrors({ ...formErrors, slug: undefined });
                  }}
                  placeholder="scaling-crdts"
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

          {/* Excerpt */}
          <FormField
            id="blog-excerpt"
            label="Short Excerpt"
            required
            error={formErrors.excerpt}
            helperText="Short summary displayed on cards, social cards, and article listings"
          >
            <textarea
              id="blog-excerpt"
              rows={2}
              value={formData.excerpt}
              onChange={(e) => {
                setFormData({ ...formData, excerpt: e.target.value });
                if (formErrors.excerpt) setFormErrors({ ...formErrors, excerpt: undefined });
              }}
              placeholder="A comprehensive study on resolving merge anomalies across peer-to-peer data stores..."
              disabled={isSubmitting}
              className={`w-full px-3.5 py-2 bg-slate-950/70 border rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 transition ${
                formErrors.excerpt
                  ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20'
                  : 'border-slate-800 focus:border-indigo-500 focus:ring-indigo-500/20'
              }`}
            />
          </FormField>

          {/* Content */}
          <FormField
            id="blog-content"
            label="Article Content"
            required
            error={formErrors.content}
            helperText="Full blog post content and technical discussion"
          >
            <textarea
              id="blog-content"
              rows={7}
              value={formData.content}
              onChange={(e) => {
                setFormData({ ...formData, content: e.target.value });
                if (formErrors.content) setFormErrors({ ...formErrors, content: undefined });
              }}
              placeholder="Write your article in plain text or markdown..."
              disabled={isSubmitting}
              className={`w-full px-3.5 py-2 bg-slate-950/70 border rounded-lg text-xs text-slate-100 placeholder-slate-500 font-mono focus:outline-none focus:ring-1 transition ${
                formErrors.content
                  ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20'
                  : 'border-slate-800 focus:border-indigo-500 focus:ring-indigo-500/20'
              }`}
            />
          </FormField>

          {/* Featured Image URL & Preview */}
          <FormField
            id="blog-image-url"
            label="Featured Cover Image URL"
            error={formErrors.featured_image_url}
            helperText="Optional URL for the banner and card thumbnail"
          >
            <div className="space-y-2">
              <input
                id="blog-image-url"
                type="url"
                value={formData.featured_image_url}
                onChange={(e) => {
                  setFormData({ ...formData, featured_image_url: e.target.value });
                  if (formErrors.featured_image_url) {
                    setFormErrors({ ...formErrors, featured_image_url: undefined });
                  }
                }}
                placeholder="https://example.com/featured-cover.jpg"
                disabled={isSubmitting}
                className={`w-full px-3.5 py-2 bg-slate-950/70 border rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 transition ${
                  formErrors.featured_image_url
                    ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20'
                    : 'border-slate-800 focus:border-indigo-500 focus:ring-indigo-500/20'
                }`}
              />

              {/* Preview Thumbnail if URL is valid */}
              {formData.featured_image_url.trim() &&
                validateUrl(formData.featured_image_url.trim()) && (
                  <div className="flex items-center space-x-3 p-2 bg-slate-950/50 rounded-lg border border-slate-800/80">
                    <div className="w-16 h-10 rounded bg-slate-800 border border-slate-700/60 overflow-hidden flex-shrink-0 flex items-center justify-center">
                      <img
                        src={formData.featured_image_url.trim()}
                        alt="Cover preview"
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    </div>
                    <span className="text-[11px] text-slate-400 truncate">
                      Image preview loaded
                    </span>
                  </div>
                )}
            </div>
          </FormField>

          {/* Publishing Controls: Toggle & Published Date */}
          <div className="p-3 bg-slate-950/50 border border-slate-800/80 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-200">
                  Publication Status
                </span>
                <p className="text-[11px] text-slate-400">
                  {formData.published
                    ? 'Published — Visible to the public on your blog'
                    : 'Draft — Saved privately in your CMS'}
                </p>
              </div>

              {/* Toggle Switch */}
              <label
                htmlFor="blog-published-toggle"
                className="relative inline-flex items-center cursor-pointer"
              >
                <input
                  id="blog-published-toggle"
                  type="checkbox"
                  checked={formData.published}
                  onChange={(e) =>
                    setFormData({ ...formData, published: e.target.checked })
                  }
                  disabled={isSubmitting}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            {/* Custom Published Date (when published is true) */}
            {formData.published && (
              <div className="pt-2 border-t border-slate-800/60">
                <FormField
                  id="blog-published-at"
                  label="Custom Published Date (Optional)"
                  error={formErrors.published_at}
                  helperText="Leave blank to automatically use the current timestamp"
                >
                  <input
                    id="blog-published-at"
                    type="datetime-local"
                    value={formData.published_at}
                    onChange={(e) =>
                      setFormData({ ...formData, published_at: e.target.value })
                    }
                    disabled={isSubmitting}
                    className="w-full px-3.5 py-2 bg-slate-950/70 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none transition"
                  />
                </FormField>
              </div>
            )}
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
                  <span>{editingBlog ? 'Update Post' : 'Publish / Save Post'}</span>
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
        title="Delete Blog Post"
        message={
          deleteTarget
            ? `Are you sure you want to delete "${deleteTarget.title}"? This action cannot be undone.`
            : 'Are you sure you want to delete this blog post?'
        }
        confirmLabel="Delete Post"
        cancelLabel="Cancel"
        isLoading={isDeleting}
        isDestructive={true}
      />
    </div>
  );
};
