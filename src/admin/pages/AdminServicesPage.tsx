import React, { useState, useEffect, useCallback } from 'react';
import {
  Layers,
  Plus,
  Edit2,
  Trash2,
  RefreshCw,
  Loader2,
  CheckCircle2,
  ArrowUpDown,
  Sparkles,
  Image as ImageIcon,
} from 'lucide-react';
import { api } from '../lib/api.ts';
import { FormField } from '../components/FormField.tsx';
import { Modal } from '../components/Modal.tsx';
import { ConfirmDialog } from '../components/ConfirmDialog.tsx';
import { AlertMessage } from '../components/AlertMessage.tsx';
import { LoadingState } from '../components/LoadingState.tsx';
import { EmptyState } from '../components/EmptyState.tsx';

export interface ServiceItem {
  id: string;
  title: string;
  description: string;
  icon_url: string | null;
  display_order: number;
  created_at?: string;
  updated_at?: string;
}

interface ServiceFormData {
  title: string;
  description: string;
  icon_url: string;
  display_order: number;
}

interface ServiceFormErrors {
  title?: string;
  description?: string;
  icon_url?: string;
  display_order?: string;
  general?: string;
}

export const AdminServicesPage: React.FC = () => {
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [initialLoading, setInitialLoading] = useState<boolean>(true);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<ServiceItem | null>(null);

  const [formData, setFormData] = useState<ServiceFormData>({
    title: '',
    description: '',
    icon_url: '',
    display_order: 0,
  });

  const [formErrors, setFormErrors] = useState<ServiceFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [iconPreviewError, setIconPreviewError] = useState<boolean>(false);

  // Delete Dialog State
  const [deleteTarget, setDeleteTarget] = useState<ServiceItem | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const fetchServices = useCallback(async () => {
    setInitialLoading(true);
    setErrorMessage(null);
    try {
      const response = await api.get<ServiceItem[]>('/api/services');
      const items: ServiceItem[] = Array.isArray(response.data) ? [...response.data] : [];
      setServices(items);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Unable to load services from the server.';
      setErrorMessage(msg);
    } finally {
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  const validateForm = (): boolean => {
    const errors: ServiceFormErrors = {};

    if (!formData.title.trim()) {
      errors.title = 'Title is required';
    } else if (formData.title.length > 255) {
      errors.title = 'Title must not exceed 255 characters';
    }

    if (!formData.description.trim()) {
      errors.description = 'Description is required';
    }

    if (formData.icon_url.trim()) {
      const url = formData.icon_url.trim();
      if (!/^https?:\/\//i.test(url) && !url.startsWith('/') && !url.startsWith('data:image/')) {
        errors.icon_url = 'Please provide a valid URL or path';
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
    setIconPreviewError(false);
    setFormData({
      title: '',
      description: '',
      icon_url: '',
      display_order: services.length > 0 ? Math.max(...services.map((s) => s.display_order)) + 1 : 0,
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item: ServiceItem) => {
    setEditingItem(item);
    setIconPreviewError(false);
    setFormData({
      title: item.title,
      description: item.description,
      icon_url: item.icon_url || '',
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
    setIconPreviewError(false);
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
      description: formData.description.trim(),
      icon_url: formData.icon_url.trim() || null,
      display_order: Number(formData.display_order) || 0,
    };

    try {
      if (editingItem) {
        // PUT /api/services/:id
        const res = await api.put<ServiceItem>(`/api/services/${editingItem.id}`, payload);
        if (res.success && res.data) {
          const updated = res.data;
          setServices((prev) =>
            prev
              .map((item) => (item.id === editingItem.id ? { ...item, ...updated } : item))
              .sort((a, b) => a.display_order - b.display_order)
          );
          setSuccessMessage(`Service "${payload.title}" updated successfully.`);
          setIsModalOpen(false);
          setEditingItem(null);
        } else {
          const errMsg = res.error || res.message || 'Failed to update service.';
          setFormErrors((prev) => ({ ...prev, general: errMsg }));
        }
      } else {
        // POST /api/services
        const res = await api.post<ServiceItem>('/api/services', payload);
        if (res.success && res.data) {
          const created = res.data;
          setServices((prev) =>
            [...prev, created].sort((a, b) => a.display_order - b.display_order)
          );
          setSuccessMessage(`Service "${payload.title}" added successfully.`);
          setIsModalOpen(false);
          setEditingItem(null);
        } else {
          const errMsg = res.error || res.message || 'Failed to create service.';
          setFormErrors((prev) => ({ ...prev, general: errMsg }));
        }
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        'Failed to save service offering. Please check your inputs.';
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
      const res = await api.delete(`/api/services/${deleteTarget.id}`);
      if (res.success) {
        setServices((prev) => prev.filter((item) => item.id !== deleteTarget.id));
        setSuccessMessage(`Service "${deleteTarget.title}" deleted successfully.`);
        setDeleteTarget(null);
      } else {
        setErrorMessage(res.error || `Failed to delete service "${deleteTarget.title}".`);
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        `Failed to delete service "${deleteTarget.title}".`;
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
              <Layers className="w-4 h-4" />
            </div>
            <h1 className="text-base font-bold text-slate-100">Services CMS</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Manage professional offerings, technical specializations, and consulting solutions.
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            type="button"
            onClick={fetchServices}
            disabled={initialLoading || isSubmitting || isDeleting}
            className="inline-flex items-center space-x-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700/80 text-slate-300 hover:text-white text-xs font-medium rounded-lg border border-slate-700/60 transition cursor-pointer disabled:opacity-50"
            title="Refresh services"
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
            <span>Add Service</span>
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
          <LoadingState message="Loading services from server..." />
        </div>
      ) : services.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No services found"
          description="You haven't configured any service offerings yet. Add your first service to showcase your professional solutions and technical specializations."
          actionLabel="Add Service"
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
                  <th className="py-3 px-4 w-72">Service</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4 text-right w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {services.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/30 transition">
                    {/* Display Order */}
                    <td className="py-3.5 px-4 text-center">
                      <span className="font-mono text-[11px] font-semibold text-slate-400 bg-slate-800/70 px-2 py-0.5 rounded border border-slate-700/60">
                        #{item.display_order}
                      </span>
                    </td>

                    {/* Service / Icon & Title */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center overflow-hidden flex-shrink-0">
                          {item.icon_url ? (
                            <img
                              src={item.icon_url}
                              alt={item.title}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                // Fallback icon
                                (e.currentTarget as HTMLElement).style.display = 'none';
                                const parent = (e.currentTarget as HTMLElement).parentElement;
                                if (parent) {
                                  parent.innerHTML = `<span class="text-indigo-400"><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg></span>`;
                                }
                              }}
                            />
                          ) : (
                            <Sparkles className="w-4 h-4 text-indigo-400" />
                          )}
                        </div>
                        <div>
                          <span className="font-semibold text-slate-100 block">{item.title}</span>
                        </div>
                      </div>
                    </td>

                    {/* Description Preview */}
                    <td className="py-3.5 px-4">
                      <p className="text-slate-400 text-[11px] line-clamp-2 max-w-xl leading-relaxed">
                        {item.description}
                      </p>
                    </td>

                    {/* Action Buttons */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center space-x-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(item)}
                          className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-800/80 rounded-lg transition cursor-pointer"
                          title="Edit service"
                          aria-label={`Edit service ${item.title}`}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(item)}
                          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800/80 rounded-lg transition cursor-pointer"
                          title="Delete service"
                          aria-label={`Delete service ${item.title}`}
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
            {services.map((item) => (
              <div
                key={item.id}
                className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {item.icon_url ? (
                        <img
                          src={item.icon_url}
                          alt={item.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display = 'none';
                            const parent = (e.currentTarget as HTMLElement).parentElement;
                            if (parent) {
                              parent.innerHTML = `<span class="text-indigo-400"><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg></span>`;
                            }
                          }}
                        />
                      ) : (
                        <Sparkles className="w-4 h-4 text-indigo-400" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="text-xs font-semibold text-slate-200">{item.title}</h3>
                        <span className="font-mono text-[10px] text-slate-400 bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-700/60">
                          #{item.display_order}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(item)}
                      className="p-2 text-slate-400 hover:text-indigo-400 hover:bg-slate-800/80 rounded-lg transition cursor-pointer"
                      aria-label={`Edit service ${item.title}`}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(item)}
                      className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800/80 rounded-lg transition cursor-pointer"
                      aria-label={`Delete service ${item.title}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-800/60">
                  <p className="text-xs text-slate-400 leading-relaxed">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add / Edit Service Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingItem ? `Edit Service: ${editingItem.title}` : 'Add Service Offering'}
        description={
          editingItem
            ? 'Update service specifications, technical scope, and display priority.'
            : 'Define a new client service offering, technical specialization, or solution tier.'
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

          {/* Grid: Title & Display Order */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Service Title */}
            <div className="sm:col-span-2">
              <FormField
                id="service-title"
                label="Service Title"
                required
                error={formErrors.title}
                helperText="e.g. Full-Stack Web Development, Cloud Architecture"
              >
                <input
                  id="service-title"
                  type="text"
                  value={formData.title}
                  onChange={(e) => {
                    setFormData({ ...formData, title: e.target.value });
                    if (formErrors.title) setFormErrors({ ...formErrors, title: undefined });
                  }}
                  placeholder="Web Development"
                  maxLength={255}
                  disabled={isSubmitting}
                  className={`w-full px-3.5 py-2 bg-slate-950/70 border rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 transition ${
                    formErrors.title
                      ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20'
                      : 'border-slate-800 focus:border-indigo-500 focus:ring-indigo-500/20'
                  }`}
                />
              </FormField>
            </div>

            {/* Display Order */}
            <div>
              <FormField
                id="service-display-order"
                label="Display Order"
                error={formErrors.display_order}
                helperText="Sequence index (0 = first)"
              >
                <div className="relative">
                  <input
                    id="service-display-order"
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
          </div>

          {/* Icon URL with live preview */}
          <FormField
            id="service-icon-url"
            label="Service Icon or Badge URL"
            error={formErrors.icon_url}
            helperText="Direct SVG/image URL for service badge (Optional)"
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center overflow-hidden flex-shrink-0">
                {formData.icon_url.trim() && !iconPreviewError ? (
                  <img
                    src={formData.icon_url.trim()}
                    alt="Preview"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                    onError={() => setIconPreviewError(true)}
                  />
                ) : (
                  <Sparkles className="w-4 h-4 text-slate-500" />
                )}
              </div>
              <input
                id="service-icon-url"
                type="text"
                value={formData.icon_url}
                onChange={(e) => {
                  setFormData({ ...formData, icon_url: e.target.value });
                  setIconPreviewError(false);
                  if (formErrors.icon_url) setFormErrors({ ...formErrors, icon_url: undefined });
                }}
                placeholder="https://images.unsplash.com/photo-... or icon link"
                disabled={isSubmitting}
                className={`w-full px-3.5 py-2 bg-slate-950/70 border rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 transition ${
                  formErrors.icon_url
                    ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20'
                    : 'border-slate-800 focus:border-indigo-500 focus:ring-indigo-500/20'
                }`}
              />
            </div>
          </FormField>

          {/* Description */}
          <FormField
            id="service-description"
            label="Service Description"
            required
            error={formErrors.description}
            helperText="Detailed summary of technical deliverables and consulting scope"
          >
            <textarea
              id="service-description"
              rows={4}
              value={formData.description}
              onChange={(e) => {
                setFormData({ ...formData, description: e.target.value });
                if (formErrors.description) setFormErrors({ ...formErrors, description: undefined });
              }}
              placeholder="Building responsive and scalable modern web applications with cutting-edge frontends and distributed resilient backends."
              disabled={isSubmitting}
              className={`w-full px-3.5 py-2 bg-slate-950/70 border rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 transition ${
                formErrors.description
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
                  <span>{editingItem ? 'Update Service' : 'Save Service'}</span>
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
        title="Delete Service Offering"
        message={
          deleteTarget
            ? `Are you sure you want to delete the service "${deleteTarget.title}"? This action cannot be undone.`
            : 'Are you sure you want to delete this service?'
        }
        confirmLabel="Delete Service"
        cancelLabel="Cancel"
        isLoading={isDeleting}
        isDestructive={true}
      />
    </div>
  );
};
