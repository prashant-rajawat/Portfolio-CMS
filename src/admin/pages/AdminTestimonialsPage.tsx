import React, { useState, useEffect, useCallback } from 'react';
import {
  MessageSquareQuote,
  Plus,
  Edit2,
  Trash2,
  RefreshCw,
  Loader2,
  CheckCircle2,
  Building2,
  User,
  ArrowUpDown,
  Quote,
  Image as ImageIcon,
} from 'lucide-react';
import { api } from '../lib/api.ts';
import { FormField } from '../components/FormField.tsx';
import { Modal } from '../components/Modal.tsx';
import { ConfirmDialog } from '../components/ConfirmDialog.tsx';
import { AlertMessage } from '../components/AlertMessage.tsx';
import { LoadingState } from '../components/LoadingState.tsx';
import { EmptyState } from '../components/EmptyState.tsx';

export interface TestimonialItem {
  id: string;
  name: string;
  role: string;
  company: string | null;
  content: string;
  profile_image_url: string | null;
  display_order: number;
  created_at?: string;
  updated_at?: string;
}

interface TestimonialFormData {
  name: string;
  role: string;
  company: string;
  content: string;
  profile_image_url: string;
  display_order: number;
}

interface TestimonialFormErrors {
  name?: string;
  role?: string;
  company?: string;
  content?: string;
  profile_image_url?: string;
  display_order?: string;
  general?: string;
}

export const AdminTestimonialsPage: React.FC = () => {
  const [testimonials, setTestimonials] = useState<TestimonialItem[]>([]);
  const [initialLoading, setInitialLoading] = useState<boolean>(true);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<TestimonialItem | null>(null);

  const [formData, setFormData] = useState<TestimonialFormData>({
    name: '',
    role: '',
    company: '',
    content: '',
    profile_image_url: '',
    display_order: 0,
  });

  const [formErrors, setFormErrors] = useState<TestimonialFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [imagePreviewError, setImagePreviewError] = useState<boolean>(false);

  // Delete Dialog State
  const [deleteTarget, setDeleteTarget] = useState<TestimonialItem | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const fetchTestimonials = useCallback(async () => {
    setInitialLoading(true);
    setErrorMessage(null);
    try {
      const response = await api.get<TestimonialItem[]>('/api/testimonials');
      const items: TestimonialItem[] = Array.isArray(response.data) ? [...response.data] : [];
      setTestimonials(items);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Unable to load testimonials from the server.';
      setErrorMessage(msg);
    } finally {
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTestimonials();
  }, [fetchTestimonials]);

  const validateForm = (): boolean => {
    const errors: TestimonialFormErrors = {};

    if (!formData.name.trim()) {
      errors.name = 'Name is required';
    } else if (formData.name.length > 255) {
      errors.name = 'Name must not exceed 255 characters';
    }

    if (!formData.role.trim()) {
      errors.role = 'Role is required';
    } else if (formData.role.length > 255) {
      errors.role = 'Role must not exceed 255 characters';
    }

    if (formData.company.trim() && formData.company.length > 255) {
      errors.company = 'Company must not exceed 255 characters';
    }

    if (!formData.content.trim()) {
      errors.content = 'Content is required';
    }

    if (formData.profile_image_url.trim()) {
      const url = formData.profile_image_url.trim();
      if (!/^https?:\/\//i.test(url) && !url.startsWith('/') && !url.startsWith('data:image/')) {
        errors.profile_image_url = 'Please provide a valid URL or path';
      }
    }

    if (isNaN(Number(formData.display_order))) {
      errors.display_order = 'Display order must be an integer';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleOpenAddModal = () => {
    setEditingItem(null);
    setImagePreviewError(false);
    setFormData({
      name: '',
      role: '',
      company: '',
      content: '',
      profile_image_url: '',
      display_order: testimonials.length > 0 ? Math.max(...testimonials.map((t) => t.display_order)) + 1 : 0,
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item: TestimonialItem) => {
    setEditingItem(item);
    setImagePreviewError(false);
    setFormData({
      name: item.name,
      role: item.role,
      company: item.company || '',
      content: item.content,
      profile_image_url: item.profile_image_url || '',
      display_order: item.display_order ?? 0,
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    if (isSubmitting) return;
    setIsModalOpen(false);
    setEditingItem(null);
    setFormErrors({});
    setImagePreviewError(false);
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
      name: formData.name.trim(),
      role: formData.role.trim(),
      company: formData.company.trim() || null,
      content: formData.content.trim(),
      profile_image_url: formData.profile_image_url.trim() || null,
      display_order: Number(formData.display_order) || 0,
    };

    try {
      if (editingItem) {
        // PUT /api/testimonials/:id
        const res = await api.put<TestimonialItem>(`/api/testimonials/${editingItem.id}`, payload);
        if (res.success && res.data) {
          const updated = res.data;
          setTestimonials((prev) =>
            prev
              .map((item) => (item.id === editingItem.id ? { ...item, ...updated } : item))
              .sort((a, b) => a.display_order - b.display_order)
          );
          setSuccessMessage(`Testimonial from "${payload.name}" updated successfully.`);
          setIsModalOpen(false);
          setEditingItem(null);
        } else {
          const errMsg = res.error || res.message || 'Failed to update testimonial.';
          setFormErrors((prev) => ({ ...prev, general: errMsg }));
        }
      } else {
        // POST /api/testimonials
        const res = await api.post<TestimonialItem>('/api/testimonials', payload);
        if (res.success && res.data) {
          const created = res.data;
          setTestimonials((prev) =>
            [...prev, created].sort((a, b) => a.display_order - b.display_order)
          );
          setSuccessMessage(`Testimonial from "${payload.name}" added successfully.`);
          setIsModalOpen(false);
          setEditingItem(null);
        } else {
          const errMsg = res.error || res.message || 'Failed to create testimonial.';
          setFormErrors((prev) => ({ ...prev, general: errMsg }));
        }
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        'Failed to save testimonial. Please check your inputs.';
      setFormErrors((prev) => ({ ...prev, general: msg }));
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
      const res = await api.delete(`/api/testimonials/${deleteTarget.id}`);
      if (res.success) {
        setTestimonials((prev) => prev.filter((item) => item.id !== deleteTarget.id));
        setSuccessMessage(`Testimonial from "${deleteTarget.name}" deleted successfully.`);
        setDeleteTarget(null);
      } else {
        setErrorMessage(res.error || `Failed to delete testimonial from "${deleteTarget.name}".`);
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        `Failed to delete testimonial from "${deleteTarget.name}".`;
      setErrorMessage(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  const getInitials = (name: string): string => {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-950/60 border border-indigo-800/80 flex items-center justify-center text-indigo-400">
              <MessageSquareQuote className="w-4 h-4" />
            </div>
            <h1 className="text-base font-bold text-slate-100">Testimonials CMS</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Manage client reviews, endorsements, peer recommendations, and executive feedback.
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            type="button"
            onClick={fetchTestimonials}
            disabled={initialLoading || isSubmitting || isDeleting}
            className="inline-flex items-center space-x-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700/80 text-slate-300 hover:text-white text-xs font-medium rounded-lg border border-slate-700/60 transition cursor-pointer disabled:opacity-50"
            title="Refresh testimonials"
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
            <span>Add Testimonial</span>
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
          <LoadingState message="Loading testimonials from server..." />
        </div>
      ) : testimonials.length === 0 ? (
        <EmptyState
          icon={MessageSquareQuote}
          title="No testimonials found"
          description="You haven't added any client recommendations or peer testimonials yet. Add your first testimonial to showcase endorsements."
          actionLabel="Add Testimonial"
          onAction={handleOpenAddModal}
        />
      ) : (
        <div className="space-y-4">
          {/* Desktop Table View */}
          <div className="hidden md:block bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 font-medium">
                  <th className="py-3 px-4 w-16 text-center">Order</th>
                  <th className="py-3 px-4 w-60">Reviewer</th>
                  <th className="py-3 px-4 w-52">Role & Company</th>
                  <th className="py-3 px-4">Testimonial Quote</th>
                  <th className="py-3 px-4 text-right w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {testimonials.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/30 transition">
                    {/* Display Order */}
                    <td className="py-3.5 px-4 text-center">
                      <span className="font-mono text-[11px] font-semibold text-slate-400 bg-slate-800/70 px-2 py-0.5 rounded border border-slate-700/60">
                        #{item.display_order}
                      </span>
                    </td>

                    {/* Reviewer / Avatar */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center overflow-hidden flex-shrink-0">
                          {item.profile_image_url ? (
                            <img
                              src={item.profile_image_url}
                              alt={item.name}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                // Fallback to initials avatar
                                (e.currentTarget as HTMLElement).style.display = 'none';
                                const parent = (e.currentTarget as HTMLElement).parentElement;
                                if (parent) {
                                  parent.innerHTML = `<span class="text-[11px] font-bold text-slate-400 font-mono">${getInitials(item.name)}</span>`;
                                }
                              }}
                            />
                          ) : (
                            <span className="text-[11px] font-bold text-slate-400 font-mono">
                              {getInitials(item.name)}
                            </span>
                          )}
                        </div>
                        <div>
                          <span className="font-semibold text-slate-100 block">{item.name}</span>
                        </div>
                      </div>
                    </td>

                    {/* Role & Company */}
                    <td className="py-3.5 px-4">
                      <div>
                        <span className="text-slate-300 font-medium block">{item.role}</span>
                        {item.company && (
                          <div className="flex items-center space-x-1 text-slate-500 text-[11px] mt-0.5">
                            <Building2 className="w-3 h-3 text-slate-600 flex-shrink-0" />
                            <span>{item.company}</span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Content Preview */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-start space-x-1.5">
                        <Quote className="w-3.5 h-3.5 text-indigo-400/70 flex-shrink-0 mt-0.5" />
                        <p className="text-slate-400 text-[11px] line-clamp-2 max-w-md italic">
                          "{item.content}"
                        </p>
                      </div>
                    </td>

                    {/* Action Buttons */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center space-x-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(item)}
                          className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-800/80 rounded-lg transition cursor-pointer"
                          title="Edit testimonial"
                          aria-label={`Edit testimonial from ${item.name}`}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(item)}
                          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800/80 rounded-lg transition cursor-pointer"
                          title="Delete testimonial"
                          aria-label={`Delete testimonial from ${item.name}`}
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
            {testimonials.map((item) => (
              <div
                key={item.id}
                className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {item.profile_image_url ? (
                        <img
                          src={item.profile_image_url}
                          alt={item.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display = 'none';
                            const parent = (e.currentTarget as HTMLElement).parentElement;
                            if (parent) {
                              parent.innerHTML = `<span class="text-xs font-bold text-slate-400 font-mono">${getInitials(item.name)}</span>`;
                            }
                          }}
                        />
                      ) : (
                        <span className="text-xs font-bold text-slate-400 font-mono">
                          {getInitials(item.name)}
                        </span>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="text-xs font-semibold text-slate-200">{item.name}</h3>
                        <span className="font-mono text-[10px] text-slate-400 bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-700/60">
                          #{item.display_order}
                        </span>
                      </div>
                      <p className="text-[11px] text-indigo-400 font-medium">
                        {item.role} {item.company ? `at ${item.company}` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(item)}
                      className="p-2 text-slate-400 hover:text-indigo-400 hover:bg-slate-800/80 rounded-lg transition cursor-pointer"
                      aria-label={`Edit testimonial from ${item.name}`}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(item)}
                      className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800/80 rounded-lg transition cursor-pointer"
                      aria-label={`Delete testimonial from ${item.name}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="flex items-start space-x-2 bg-slate-950/40 p-3 rounded-lg border border-slate-800/60">
                  <Quote className="w-3.5 h-3.5 text-indigo-400/80 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-slate-400 italic">"{item.content}"</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add / Edit Testimonial Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingItem ? `Edit Testimonial: ${editingItem.name}` : 'Add Testimonial Entry'}
        description={
          editingItem
            ? 'Update reviewer identity, organizational affiliation, and endorsement statement.'
            : 'Record a new client review, executive recommendation, or colleague quote.'
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

          {/* Grid: Name & Role */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Reviewer Name */}
            <FormField
              id="test-name"
              label="Reviewer Full Name"
              required
              error={formErrors.name}
              helperText="e.g. Rahul Sharma"
            >
              <input
                id="test-name"
                type="text"
                value={formData.name}
                onChange={(e) => {
                  setFormData({ ...formData, name: e.target.value });
                  if (formErrors.name) setFormErrors({ ...formErrors, name: undefined });
                }}
                placeholder="Rahul Sharma"
                maxLength={255}
                disabled={isSubmitting}
                className={`w-full px-3.5 py-2 bg-slate-950/70 border rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 transition ${
                  formErrors.name
                    ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20'
                    : 'border-slate-800 focus:border-indigo-500 focus:ring-indigo-500/20'
                }`}
              />
            </FormField>

            {/* Role / Job Title */}
            <FormField
              id="test-role"
              label="Role / Designation"
              required
              error={formErrors.role}
              helperText="e.g. Founder & CEO, VP of Engineering"
            >
              <input
                id="test-role"
                type="text"
                value={formData.role}
                onChange={(e) => {
                  setFormData({ ...formData, role: e.target.value });
                  if (formErrors.role) setFormErrors({ ...formErrors, role: undefined });
                }}
                placeholder="Founder & CEO"
                maxLength={255}
                disabled={isSubmitting}
                className={`w-full px-3.5 py-2 bg-slate-950/70 border rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 transition ${
                  formErrors.role
                    ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20'
                    : 'border-slate-800 focus:border-indigo-500 focus:ring-indigo-500/20'
                }`}
              />
            </FormField>
          </div>

          {/* Grid: Company & Display Order */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Company */}
            <FormField
              id="test-company"
              label="Company / Organization"
              error={formErrors.company}
              helperText="e.g. ABC Technologies (Optional)"
            >
              <input
                id="test-company"
                type="text"
                value={formData.company}
                onChange={(e) => {
                  setFormData({ ...formData, company: e.target.value });
                  if (formErrors.company) setFormErrors({ ...formErrors, company: undefined });
                }}
                placeholder="ABC Technologies"
                maxLength={255}
                disabled={isSubmitting}
                className={`w-full px-3.5 py-2 bg-slate-950/70 border rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 transition ${
                  formErrors.company
                    ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20'
                    : 'border-slate-800 focus:border-indigo-500 focus:ring-indigo-500/20'
                }`}
              />
            </FormField>

            {/* Display Order */}
            <FormField
              id="test-display-order"
              label="Display Order"
              error={formErrors.display_order}
              helperText="Sequence priority index (0 = first)"
            >
              <div className="relative">
                <input
                  id="test-display-order"
                  type="number"
                  min={0}
                  step={1}
                  value={formData.display_order}
                  onChange={(e) => {
                    setFormData({ ...formData, display_order: parseInt(e.target.value, 10) || 0 });
                    if (formErrors.display_order) setFormErrors({ ...formErrors, display_order: undefined });
                  }}
                  disabled={isSubmitting}
                  className={`w-full px-3.5 py-2 bg-slate-950/70 border rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 transition ${
                    formErrors.display_order
                      ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20'
                      : 'border-slate-800 focus:border-indigo-500 focus:ring-indigo-500/20'
                  }`}
                />
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </FormField>
          </div>

          {/* Profile Image URL with live preview */}
          <FormField
            id="test-profile-image"
            label="Profile Avatar Image URL"
            error={formErrors.profile_image_url}
            helperText="Direct image URL or avatar link (Optional)"
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center overflow-hidden flex-shrink-0">
                {formData.profile_image_url.trim() && !imagePreviewError ? (
                  <img
                    src={formData.profile_image_url.trim()}
                    alt="Preview"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                    onError={() => setImagePreviewError(true)}
                  />
                ) : (
                  <User className="w-4 h-4 text-slate-500" />
                )}
              </div>
              <input
                id="test-profile-image"
                type="text"
                value={formData.profile_image_url}
                onChange={(e) => {
                  setFormData({ ...formData, profile_image_url: e.target.value });
                  setImagePreviewError(false);
                  if (formErrors.profile_image_url) setFormErrors({ ...formErrors, profile_image_url: undefined });
                }}
                placeholder="https://images.unsplash.com/photo-..."
                disabled={isSubmitting}
                className={`w-full px-3.5 py-2 bg-slate-950/70 border rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 transition ${
                  formErrors.profile_image_url
                    ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20'
                    : 'border-slate-800 focus:border-indigo-500 focus:ring-indigo-500/20'
                }`}
              />
            </div>
          </FormField>

          {/* Testimonial Content */}
          <FormField
            id="test-content"
            label="Testimonial Quote / Endorsement"
            required
            error={formErrors.content}
            helperText="The recommendation statement or client review text"
          >
            <textarea
              id="test-content"
              rows={4}
              value={formData.content}
              onChange={(e) => {
                setFormData({ ...formData, content: e.target.value });
                if (formErrors.content) setFormErrors({ ...formErrors, content: undefined });
              }}
              placeholder="Exceptional engineering leadership. Delivered our high-throughput distributed messaging pipeline ahead of schedule with flawless reliability..."
              disabled={isSubmitting}
              className={`w-full px-3.5 py-2 bg-slate-950/70 border rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 transition ${
                formErrors.content
                  ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20'
                  : 'border-slate-800 focus:border-indigo-500 focus:ring-indigo-500/20'
              }`}
            />
          </FormField>

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
                  <span>{editingItem ? 'Update Testimonial' : 'Save Testimonial'}</span>
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
        title="Delete Testimonial"
        message={
          deleteTarget
            ? `Are you sure you want to delete the testimonial from "${deleteTarget.name}" (${deleteTarget.role}${deleteTarget.company ? ` at ${deleteTarget.company}` : ''})? This action cannot be undone.`
            : 'Are you sure you want to delete this testimonial?'
        }
        confirmLabel="Delete Testimonial"
        cancelLabel="Cancel"
        isLoading={isDeleting}
        isDestructive={true}
      />
    </div>
  );
};
