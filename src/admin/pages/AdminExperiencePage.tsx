import React, { useState, useEffect, useCallback } from 'react';
import {
  Briefcase,
  Plus,
  Edit2,
  Trash2,
  RefreshCw,
  Loader2,
  CheckCircle2,
  Calendar,
  Building2,
  Clock,
  ArrowUpDown,
  Check,
} from 'lucide-react';
import { api } from '../lib/api.ts';
import { FormField } from '../components/FormField.tsx';
import { Modal } from '../components/Modal.tsx';
import { ConfirmDialog } from '../components/ConfirmDialog.tsx';
import { AlertMessage } from '../components/AlertMessage.tsx';
import { LoadingState } from '../components/LoadingState.tsx';
import { EmptyState } from '../components/EmptyState.tsx';

export interface ExperienceItem {
  id: string;
  company: string;
  position: string;
  description: string;
  start_date: string;
  end_date: string | null;
  is_current: boolean;
  display_order: number;
  created_at?: string;
  updated_at?: string;
}

interface ExperienceFormData {
  company: string;
  position: string;
  description: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  display_order: number;
}

interface ExperienceFormErrors {
  company?: string;
  position?: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  display_order?: string;
  general?: string;
}

export const AdminExperiencePage: React.FC = () => {
  const [experiences, setExperiences] = useState<ExperienceItem[]>([]);
  const [initialLoading, setInitialLoading] = useState<boolean>(true);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<ExperienceItem | null>(null);

  const [formData, setFormData] = useState<ExperienceFormData>({
    company: '',
    position: '',
    description: '',
    start_date: '',
    end_date: '',
    is_current: false,
    display_order: 0,
  });

  const [formErrors, setFormErrors] = useState<ExperienceFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Delete Dialog State
  const [deleteTarget, setDeleteTarget] = useState<ExperienceItem | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const fetchExperiences = useCallback(async () => {
    setInitialLoading(true);
    setErrorMessage(null);
    try {
      const response = await api.get<ExperienceItem[]>('/api/experience');
      const items: ExperienceItem[] = Array.isArray(response.data) ? [...response.data] : [];
      setExperiences(items);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Unable to load career experience history from the server.';
      setErrorMessage(msg);
    } finally {
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExperiences();
  }, [fetchExperiences]);

  const normalizeDateInput = (val?: string | null): string => {
    if (!val) return '';
    // If val is YYYY-MM-DD, return as is
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
    // If val is an ISO string like 2024-01-01T00:00:00.000Z
    try {
      const d = new Date(val);
      if (isNaN(d.getTime())) return '';
      return d.toISOString().slice(0, 10);
    } catch {
      return '';
    }
  };

  const formatDisplayDate = (val?: string | null): string => {
    if (!val) return '';
    try {
      const datePart = val.slice(0, 10);
      const [year, month, day] = datePart.split('-').map(Number);
      if (!year || !month) return val;
      // Construct UTC date to avoid timezone shift
      const d = new Date(Date.UTC(year, month - 1, day || 1));
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(d);
    } catch {
      return val;
    }
  };

  const validateForm = (): boolean => {
    const errors: ExperienceFormErrors = {};

    if (!formData.company.trim()) {
      errors.company = 'Company is required';
    } else if (formData.company.length > 255) {
      errors.company = 'Company must not exceed 255 characters';
    }

    if (!formData.position.trim()) {
      errors.position = 'Position is required';
    } else if (formData.position.length > 255) {
      errors.position = 'Position must not exceed 255 characters';
    }

    if (!formData.description.trim()) {
      errors.description = 'Description is required';
    }

    if (!formData.start_date.trim()) {
      errors.start_date = 'Start date is required';
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(formData.start_date.trim())) {
      errors.start_date = 'Start date must be in YYYY-MM-DD format';
    }

    if (!formData.is_current) {
      if (formData.end_date.trim()) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(formData.end_date.trim())) {
          errors.end_date = 'End date must be in YYYY-MM-DD format';
        } else if (
          formData.start_date.trim() &&
          new Date(formData.end_date.trim()) < new Date(formData.start_date.trim())
        ) {
          errors.end_date = 'End date must be equal to or after start date';
        }
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
    setFormData({
      company: '',
      position: '',
      description: '',
      start_date: '',
      end_date: '',
      is_current: false,
      display_order: experiences.length > 0 ? Math.max(...experiences.map((e) => e.display_order)) + 1 : 0,
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item: ExperienceItem) => {
    setEditingItem(item);
    setFormData({
      company: item.company,
      position: item.position,
      description: item.description,
      start_date: normalizeDateInput(item.start_date),
      end_date: normalizeDateInput(item.end_date),
      is_current: Boolean(item.is_current),
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
      company: formData.company.trim(),
      position: formData.position.trim(),
      description: formData.description.trim(),
      start_date: formData.start_date.trim(),
      end_date: formData.is_current ? null : formData.end_date.trim() || null,
      is_current: formData.is_current,
      display_order: Number(formData.display_order) || 0,
    };

    try {
      if (editingItem) {
        // PUT /api/experience/:id
        const res = await api.put<ExperienceItem>(`/api/experience/${editingItem.id}`, payload);
        if (res.success && res.data) {
          const updated = res.data;
          setExperiences((prev) =>
            prev
              .map((item) => (item.id === editingItem.id ? { ...item, ...updated } : item))
              .sort((a, b) => a.display_order - b.display_order)
          );
          setSuccessMessage(`Experience at "${payload.company}" updated successfully.`);
          setIsModalOpen(false);
          setEditingItem(null);
        } else {
          const errMsg = res.error || res.message || 'Failed to update experience entry.';
          setFormErrors((prev) => ({ ...prev, general: errMsg }));
        }
      } else {
        // POST /api/experience
        const res = await api.post<ExperienceItem>('/api/experience', payload);
        if (res.success && res.data) {
          const created = res.data;
          setExperiences((prev) =>
            [...prev, created].sort((a, b) => a.display_order - b.display_order)
          );
          setSuccessMessage(`Experience at "${payload.company}" added successfully.`);
          setIsModalOpen(false);
          setEditingItem(null);
        } else {
          const errMsg = res.error || res.message || 'Failed to create experience entry.';
          setFormErrors((prev) => ({ ...prev, general: errMsg }));
        }
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        'Failed to save experience entry. Please check your inputs.';
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
      const res = await api.delete(`/api/experience/${deleteTarget.id}`);
      if (res.success) {
        setExperiences((prev) => prev.filter((item) => item.id !== deleteTarget.id));
        setSuccessMessage(`Experience at "${deleteTarget.company}" deleted successfully.`);
        setDeleteTarget(null);
      } else {
        setErrorMessage(res.error || `Failed to delete experience at "${deleteTarget.company}".`);
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        `Failed to delete experience at "${deleteTarget.company}".`;
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
              <Briefcase className="w-4 h-4" />
            </div>
            <h1 className="text-base font-bold text-slate-100">Experience & Timeline CMS</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Manage your employment history, roles, key achievements, and career trajectory.
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            type="button"
            onClick={fetchExperiences}
            disabled={initialLoading || isSubmitting || isDeleting}
            className="inline-flex items-center space-x-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700/80 text-slate-300 hover:text-white text-xs font-medium rounded-lg border border-slate-700/60 transition cursor-pointer disabled:opacity-50"
            title="Refresh experience timeline"
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
            <span>Add Experience</span>
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
          <LoadingState message="Loading experience timeline from server..." />
        </div>
      ) : experiences.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No experience records yet"
          description="You haven't listed any employment history, company positions, or contract roles yet. Add your first role to populate your career timeline."
          actionLabel="Add Experience"
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
                  <th className="py-3 px-4 w-48">Company</th>
                  <th className="py-3 px-4 w-52">Position</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4 w-44">Dates</th>
                  <th className="py-3 px-4 w-28 text-center">Status</th>
                  <th className="py-3 px-4 text-right w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {experiences.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/30 transition">
                    {/* Display Order */}
                    <td className="py-3.5 px-4 text-center">
                      <span className="font-mono text-[11px] font-semibold text-slate-400 bg-slate-800/70 px-2 py-0.5 rounded border border-slate-700/60">
                        #{item.display_order}
                      </span>
                    </td>

                    {/* Company */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center space-x-2">
                        <Building2 className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                        <span className="font-semibold text-slate-100">{item.company}</span>
                      </div>
                    </td>

                    {/* Position */}
                    <td className="py-3.5 px-4">
                      <span className="text-slate-300 font-medium">{item.position}</span>
                    </td>

                    {/* Description */}
                    <td className="py-3.5 px-4">
                      <p className="text-slate-400 text-[11px] line-clamp-2 max-w-sm">
                        {item.description}
                      </p>
                    </td>

                    {/* Dates */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center space-x-1.5 text-slate-400 text-[11px]">
                        <Calendar className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
                        <span>
                          {formatDisplayDate(item.start_date)} —{' '}
                          {item.is_current ? (
                            <span className="text-emerald-400 font-medium">Present</span>
                          ) : item.end_date ? (
                            formatDisplayDate(item.end_date)
                          ) : (
                            '—'
                          )}
                        </span>
                      </div>
                    </td>

                    {/* Status Badge */}
                    <td className="py-3.5 px-4 text-center">
                      {item.is_current ? (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-800/80">
                          <Check className="w-3 h-3" />
                          <span>Present</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                          <Clock className="w-3 h-3" />
                          <span>Completed</span>
                        </span>
                      )}
                    </td>

                    {/* Action Buttons */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center space-x-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(item)}
                          className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-800/80 rounded-lg transition cursor-pointer"
                          title="Edit experience"
                          aria-label={`Edit ${item.position} at ${item.company}`}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(item)}
                          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800/80 rounded-lg transition cursor-pointer"
                          title="Delete experience"
                          aria-label={`Delete ${item.position} at ${item.company}`}
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
            {experiences.map((item) => (
              <div
                key={item.id}
                className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="text-xs font-semibold text-slate-200">{item.company}</h3>
                      <span className="font-mono text-[10px] text-slate-400 bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-700/60">
                        #{item.display_order}
                      </span>
                    </div>
                    <p className="text-[11px] text-indigo-400 font-medium mt-0.5">{item.position}</p>
                  </div>

                  <div className="flex items-center space-x-1 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(item)}
                      className="p-2 text-slate-400 hover:text-indigo-400 hover:bg-slate-800/80 rounded-lg transition cursor-pointer"
                      aria-label={`Edit ${item.position} at ${item.company}`}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(item)}
                      className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800/80 rounded-lg transition cursor-pointer"
                      aria-label={`Delete ${item.position} at ${item.company}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <p className="text-xs text-slate-400">{item.description}</p>

                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-800/60">
                  <div className="flex items-center space-x-1.5">
                    <Calendar className="w-3 h-3 text-slate-600" />
                    <span>
                      {formatDisplayDate(item.start_date)} —{' '}
                      {item.is_current ? (
                        <span className="text-emerald-400 font-medium">Present</span>
                      ) : item.end_date ? (
                        formatDisplayDate(item.end_date)
                      ) : (
                        '—'
                      )}
                    </span>
                  </div>

                  {item.is_current ? (
                    <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-950/80 text-emerald-400 border border-emerald-800/80">
                      <Check className="w-2.5 h-2.5" />
                      <span>Present</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
                      <span>Completed</span>
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add / Edit Experience Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingItem ? `Edit Experience: ${editingItem.company}` : 'Add Experience Entry'}
        description={
          editingItem
            ? 'Update company details, role title, duration, and key career achievements.'
            : 'Record a new employment milestone, company role, or freelance engagement.'
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

          {/* Grid: Company & Position */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Company */}
            <FormField
              id="exp-company"
              label="Company / Organization"
              required
              error={formErrors.company}
              helperText="e.g. Acme Corp, Vercel, Google"
            >
              <input
                id="exp-company"
                type="text"
                value={formData.company}
                onChange={(e) => {
                  setFormData({ ...formData, company: e.target.value });
                  if (formErrors.company) setFormErrors({ ...formErrors, company: undefined });
                }}
                placeholder="Acme Corp"
                maxLength={255}
                disabled={isSubmitting}
                className={`w-full px-3.5 py-2 bg-slate-950/70 border rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 transition ${
                  formErrors.company
                    ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20'
                    : 'border-slate-800 focus:border-indigo-500 focus:ring-indigo-500/20'
                }`}
              />
            </FormField>

            {/* Position */}
            <FormField
              id="exp-position"
              label="Position / Role Title"
              required
              error={formErrors.position}
              helperText="e.g. Senior Full Stack Engineer"
            >
              <input
                id="exp-position"
                type="text"
                value={formData.position}
                onChange={(e) => {
                  setFormData({ ...formData, position: e.target.value });
                  if (formErrors.position) setFormErrors({ ...formErrors, position: undefined });
                }}
                placeholder="Senior Full Stack Engineer"
                maxLength={255}
                disabled={isSubmitting}
                className={`w-full px-3.5 py-2 bg-slate-950/70 border rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 transition ${
                  formErrors.position
                    ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20'
                    : 'border-slate-800 focus:border-indigo-500 focus:ring-indigo-500/20'
                }`}
              />
            </FormField>
          </div>

          {/* Description */}
          <FormField
            id="exp-description"
            label="Role Responsibilities & Achievements"
            required
            error={formErrors.description}
            helperText="Summarize architectural achievements, technologies used, and business impact"
          >
            <textarea
              id="exp-description"
              rows={4}
              value={formData.description}
              onChange={(e) => {
                setFormData({ ...formData, description: e.target.value });
                if (formErrors.description) setFormErrors({ ...formErrors, description: undefined });
              }}
              placeholder="Led the distributed backend modernization initiative, migrating monolithic services to event-driven microservices with Redis and PostgreSQL..."
              disabled={isSubmitting}
              className={`w-full px-3.5 py-2 bg-slate-950/70 border rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 transition ${
                formErrors.description
                  ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20'
                  : 'border-slate-800 focus:border-indigo-500 focus:ring-indigo-500/20'
              }`}
            />
          </FormField>

          {/* Dates & Timeline Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Start Date */}
            <FormField
              id="exp-start-date"
              label="Start Date"
              required
              error={formErrors.start_date}
              helperText="Date joined"
            >
              <input
                id="exp-start-date"
                type="date"
                value={formData.start_date}
                onChange={(e) => {
                  setFormData({ ...formData, start_date: e.target.value });
                  if (formErrors.start_date) setFormErrors({ ...formErrors, start_date: undefined });
                }}
                disabled={isSubmitting}
                className={`w-full px-3.5 py-2 bg-slate-950/70 border rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 transition ${
                  formErrors.start_date
                    ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20'
                    : 'border-slate-800 focus:border-indigo-500 focus:ring-indigo-500/20'
                }`}
              />
            </FormField>

            {/* End Date */}
            <FormField
              id="exp-end-date"
              label="End Date"
              error={formErrors.end_date}
              helperText={formData.is_current ? 'Disabled (currently active)' : 'Date concluded'}
            >
              <input
                id="exp-end-date"
                type="date"
                value={formData.is_current ? '' : formData.end_date}
                onChange={(e) => {
                  setFormData({ ...formData, end_date: e.target.value });
                  if (formErrors.end_date) setFormErrors({ ...formErrors, end_date: undefined });
                }}
                disabled={isSubmitting || formData.is_current}
                className={`w-full px-3.5 py-2 bg-slate-950/70 border rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 transition disabled:opacity-40 disabled:cursor-not-allowed ${
                  formErrors.end_date
                    ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20'
                    : 'border-slate-800 focus:border-indigo-500 focus:ring-indigo-500/20'
                }`}
              />
            </FormField>

            {/* Display Order */}
            <FormField
              id="exp-display-order"
              label="Display Order"
              error={formErrors.display_order}
              helperText="Sequence index (0 = first)"
            >
              <div className="relative">
                <input
                  id="exp-display-order"
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

          {/* Current / Present Toggle */}
          <div className="p-3 bg-slate-950/50 border border-slate-800/80 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-200">
                I currently work here
              </span>
              <p className="text-[11px] text-slate-400">
                {formData.is_current
                  ? 'Active role — displays "Present" as the conclusion date'
                  : 'Past role — requires or accepts a specific completion date'}
              </p>
            </div>

            {/* Toggle Switch */}
            <label
              htmlFor="exp-current-toggle"
              className="relative inline-flex items-center cursor-pointer"
            >
              <input
                id="exp-current-toggle"
                type="checkbox"
                checked={formData.is_current}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setFormData((prev) => ({
                    ...prev,
                    is_current: checked,
                    end_date: checked ? '' : prev.end_date,
                  }));
                  if (formErrors.end_date) {
                    setFormErrors((prev) => ({ ...prev, end_date: undefined }));
                  }
                }}
                disabled={isSubmitting}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
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
                  <span>{editingItem ? 'Update Experience' : 'Save Experience'}</span>
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
        title="Delete Experience Entry"
        message={
          deleteTarget
            ? `Are you sure you want to delete the experience entry for "${deleteTarget.position}" at "${deleteTarget.company}"? This action cannot be undone.`
            : 'Are you sure you want to delete this experience entry?'
        }
        confirmLabel="Delete Experience"
        cancelLabel="Cancel"
        isLoading={isDeleting}
        isDestructive={true}
      />
    </div>
  );
};
