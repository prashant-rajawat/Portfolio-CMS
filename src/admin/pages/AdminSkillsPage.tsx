import React, { useState, useEffect, useCallback } from 'react';
import {
  Wrench,
  Plus,
  Edit2,
  Trash2,
  RefreshCw,
  Loader2,
  ExternalLink,
  Layers,
  ArrowUpDown,
  CheckCircle2,
} from 'lucide-react';
import { api } from '../lib/api';
import { FormField } from '../components/FormField';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { AlertMessage } from '../components/AlertMessage';
import { LoadingState } from '../components/LoadingState';
import { EmptyState } from '../components/EmptyState';

export interface SkillItem {
  id: string;
  name: string;
  category: string;
  proficiency: number | null;
  icon_url: string | null;
  display_order: number;
  created_at?: string;
  updated_at?: string;
}

interface SkillFormData {
  name: string;
  category: string;
  proficiency: string; // string for controlled input handling
  icon_url: string;
  display_order: string;
}

interface SkillFormErrors {
  name?: string;
  category?: string;
  proficiency?: string;
  icon_url?: string;
  display_order?: string;
}

export const AdminSkillsPage: React.FC = () => {
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [initialLoading, setInitialLoading] = useState<boolean>(true);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingSkill, setEditingSkill] = useState<SkillItem | null>(null);
  const [formData, setFormData] = useState<SkillFormData>({
    name: '',
    category: '',
    proficiency: '80',
    icon_url: '',
    display_order: '0',
  });
  const [formErrors, setFormErrors] = useState<SkillFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Delete Dialog State
  const [deleteTarget, setDeleteTarget] = useState<SkillItem | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const fetchSkills = useCallback(async () => {
    setInitialLoading(true);
    setErrorMessage(null);
    try {
      const response = await api.get<SkillItem[]>('/api/skills');
      const items: SkillItem[] = Array.isArray(response.data) ? [...response.data] : [];
      // Sort by display_order ascending, then name
      items.sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
      setSkills(items);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Unable to load skills from the server.';
      setErrorMessage(msg);
    } finally {
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  const validateUrl = (url: string): boolean => {
    if (!url.trim()) return true;
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const validateForm = (): boolean => {
    const errors: SkillFormErrors = {};

    if (!formData.name.trim()) {
      errors.name = 'Skill name is required';
    } else if (formData.name.length > 100) {
      errors.name = 'Skill name must not exceed 100 characters';
    }

    if (!formData.category.trim()) {
      errors.category = 'Category is required';
    } else if (formData.category.length > 100) {
      errors.category = 'Category must not exceed 100 characters';
    }

    if (formData.proficiency.trim() !== '') {
      const profNum = Number(formData.proficiency);
      if (isNaN(profNum) || !Number.isInteger(profNum) || profNum < 0 || profNum > 100) {
        errors.proficiency = 'Proficiency must be an integer between 0 and 100';
      }
    }

    if (formData.icon_url && !validateUrl(formData.icon_url)) {
      errors.icon_url = 'Please enter a valid URL (starting with http:// or https://)';
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
    setEditingSkill(null);
    setFormData({
      name: '',
      category: '',
      proficiency: '80',
      icon_url: '',
      display_order: String(skills.length),
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (skill: SkillItem) => {
    setEditingSkill(skill);
    setFormData({
      name: skill.name,
      category: skill.category,
      proficiency: skill.proficiency !== null && skill.proficiency !== undefined ? String(skill.proficiency) : '',
      icon_url: skill.icon_url || '',
      display_order: String(skill.display_order ?? 0),
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    if (isSubmitting) return;
    setIsModalOpen(false);
    setEditingSkill(null);
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
      category: formData.category.trim(),
      proficiency:
        formData.proficiency.trim() !== '' ? parseInt(formData.proficiency, 10) : null,
      icon_url: formData.icon_url.trim() || null,
      display_order:
        formData.display_order.trim() !== '' ? parseInt(formData.display_order, 10) : 0,
    };

    try {
      if (editingSkill) {
        // PUT /api/skills/:id
        const res = await api.put<SkillItem>(`/api/skills/${editingSkill.id}`, payload);
        if (res.success && res.data) {
          const updatedSkill = res.data;
          setSkills((prev) =>
            prev
              .map((s) => (s.id === editingSkill.id ? { ...s, ...updatedSkill } : s))
              .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
          );
          setSuccessMessage(`Skill "${payload.name}" updated successfully.`);
        } else {
          throw new Error(res.error || 'Failed to update skill');
        }
      } else {
        // POST /api/skills
        const res = await api.post<SkillItem>('/api/skills', payload);
        if (res.success && res.data) {
          const newSkill = res.data;
          setSkills((prev) =>
            [...prev, newSkill].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
          );
          setSuccessMessage(`Skill "${payload.name}" created successfully.`);
        } else {
          throw new Error(res.error || 'Failed to create skill');
        }
      }
      setIsModalOpen(false);
      setEditingSkill(null);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to save skill. Please verify your inputs and try again.';
      setErrorMessage(msg);
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
      await api.delete(`/api/skills/${deleteTarget.id}`);
      setSkills((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      setSuccessMessage(`Skill "${deleteTarget.name}" deleted successfully.`);
      setDeleteTarget(null);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        `Failed to delete skill "${deleteTarget.name}".`;
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
              <Wrench className="w-4 h-4" />
            </div>
            <h1 className="text-base font-bold text-slate-100">Skills CMS</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Manage your technical competencies, categorization, proficiency metrics, and display ordering.
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            type="button"
            onClick={fetchSkills}
            disabled={initialLoading || isSubmitting || isDeleting}
            className="inline-flex items-center space-x-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700/80 text-slate-300 hover:text-white text-xs font-medium rounded-lg border border-slate-700/60 transition cursor-pointer disabled:opacity-50"
            title="Refresh skills"
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
            <span>Add Skill</span>
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
          <LoadingState message="Loading skills repository from server..." />
        </div>
      ) : skills.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No skills added yet"
          description="Your portfolio doesn't have any technical skills listed yet. Add your core languages, frameworks, and tools."
          actionLabel="Add First Skill"
          onAction={handleOpenAddModal}
        />
      ) : (
        <div className="space-y-4">
          {/* Desktop Table View (Hidden on mobile) */}
          <div className="hidden md:block bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 font-medium">
                  <th className="py-3 px-4 w-16 text-center">Order</th>
                  <th className="py-3 px-4">Skill Name</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Proficiency</th>
                  <th className="py-3 px-4">Icon URL</th>
                  <th className="py-3 px-4 text-right w-28">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {skills.map((skill) => (
                  <tr key={skill.id} className="hover:bg-slate-800/30 transition">
                    <td className="py-3 px-4 text-center font-mono text-slate-500 text-[11px]">
                      {skill.display_order ?? 0}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-200">
                      <div className="flex items-center space-x-2">
                        {skill.icon_url && (
                          <img
                            src={skill.icon_url}
                            alt=""
                            className="w-4 h-4 object-contain rounded"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        )}
                        <span>{skill.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-800 text-slate-300 border border-slate-700/60">
                        {skill.category}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {skill.proficiency !== null && skill.proficiency !== undefined ? (
                        <div className="flex items-center space-x-2.5 max-w-[140px]">
                          <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-indigo-500 h-1.5 rounded-full"
                              style={{ width: `${Math.min(100, Math.max(0, skill.proficiency))}%` }}
                            />
                          </div>
                          <span className="text-[11px] font-mono text-slate-400">
                            {skill.proficiency}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-500 text-[11px]">N/A</span>
                      )}
                    </td>
                    <td className="py-3 px-4 max-w-[180px] truncate text-slate-400 text-[11px]">
                      {skill.icon_url ? (
                        <a
                          href={skill.icon_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-indigo-400 hover:underline inline-flex items-center space-x-1"
                        >
                          <span className="truncate max-w-[150px]">{skill.icon_url}</span>
                          <ExternalLink className="w-3 h-3 flex-shrink-0 ml-0.5" />
                        </a>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center space-x-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(skill)}
                          className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-800/80 rounded-lg transition cursor-pointer"
                          title="Edit skill"
                          aria-label={`Edit ${skill.name}`}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(skill)}
                          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800/80 rounded-lg transition cursor-pointer"
                          title="Delete skill"
                          aria-label={`Delete ${skill.name}`}
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
            {skills.map((skill) => (
              <div
                key={skill.id}
                className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3 shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2">
                    {skill.icon_url && (
                      <img
                        src={skill.icon_url}
                        alt=""
                        className="w-5 h-5 object-contain rounded"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    )}
                    <div>
                      <h3 className="text-xs font-semibold text-slate-200">{skill.name}</h3>
                      <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700/60">
                        {skill.category}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1">
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(skill)}
                      className="p-2 text-slate-400 hover:text-indigo-400 hover:bg-slate-800/80 rounded-lg transition cursor-pointer"
                      aria-label={`Edit ${skill.name}`}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(skill)}
                      className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800/80 rounded-lg transition cursor-pointer"
                      aria-label={`Delete ${skill.name}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {skill.proficiency !== null && skill.proficiency !== undefined && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>Proficiency</span>
                      <span className="font-mono text-slate-300">{skill.proficiency}%</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-indigo-500 h-1.5 rounded-full"
                        style={{ width: `${Math.min(100, Math.max(0, skill.proficiency))}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-800/60">
                  <span>Order: {skill.display_order ?? 0}</span>
                  {skill.icon_url && (
                    <a
                      href={skill.icon_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-400 hover:underline inline-flex items-center space-x-1"
                    >
                      <span>Icon Link</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add / Edit Skill Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingSkill ? `Edit Skill: ${editingSkill.name}` : 'Add New Skill'}
        description={
          editingSkill
            ? 'Update skill properties, taxonomy, or proficiency level.'
            : 'Fill in the skill details to register it in your portfolio repository.'
        }
        maxWidth="md"
      >
        <form onSubmit={handleFormSubmit} className="space-y-4" noValidate>
          {/* Skill Name */}
          <FormField
            id="skill-name"
            label="Skill Name"
            required
            error={formErrors.name}
            helperText="e.g. TypeScript, React, PostgreSQL, Docker"
          >
            <input
              id="skill-name"
              type="text"
              value={formData.name}
              onChange={(e) => {
                setFormData({ ...formData, name: e.target.value });
                if (formErrors.name) setFormErrors({ ...formErrors, name: undefined });
              }}
              placeholder="e.g. TypeScript"
              maxLength={100}
              disabled={isSubmitting}
              className={`w-full px-3.5 py-2 bg-slate-950/70 border rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 transition ${
                formErrors.name
                  ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20'
                  : 'border-slate-800 focus:border-indigo-500 focus:ring-indigo-500/20'
              }`}
            />
          </FormField>

          {/* Category */}
          <FormField
            id="skill-category"
            label="Category / Taxonomy"
            required
            error={formErrors.category}
            helperText="e.g. Languages, Frontend, Backend, Cloud & DevOps, Database"
          >
            <input
              id="skill-category"
              type="text"
              value={formData.category}
              onChange={(e) => {
                setFormData({ ...formData, category: e.target.value });
                if (formErrors.category) setFormErrors({ ...formErrors, category: undefined });
              }}
              placeholder="e.g. Backend"
              maxLength={100}
              disabled={isSubmitting}
              className={`w-full px-3.5 py-2 bg-slate-950/70 border rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 transition ${
                formErrors.category
                  ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20'
                  : 'border-slate-800 focus:border-indigo-500 focus:ring-indigo-500/20'
              }`}
            />
          </FormField>

          {/* Grid: Proficiency & Display Order */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Proficiency */}
            <FormField
              id="skill-proficiency"
              label="Proficiency (0–100%)"
              error={formErrors.proficiency}
              helperText="Optional integer rating (0 to 100)"
            >
              <input
                id="skill-proficiency"
                type="number"
                min={0}
                max={100}
                step={1}
                value={formData.proficiency}
                onChange={(e) => {
                  setFormData({ ...formData, proficiency: e.target.value });
                  if (formErrors.proficiency) setFormErrors({ ...formErrors, proficiency: undefined });
                }}
                placeholder="e.g. 90"
                disabled={isSubmitting}
                className={`w-full px-3.5 py-2 bg-slate-950/70 border rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 transition ${
                  formErrors.proficiency
                    ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20'
                    : 'border-slate-800 focus:border-indigo-500 focus:ring-indigo-500/20'
                }`}
              />
            </FormField>

            {/* Display Order */}
            <FormField
              id="skill-order"
              label="Display Order"
              error={formErrors.display_order}
              helperText="Numeric sequence for sorting"
            >
              <input
                id="skill-order"
                type="number"
                step={1}
                value={formData.display_order}
                onChange={(e) => {
                  setFormData({ ...formData, display_order: e.target.value });
                  if (formErrors.display_order) setFormErrors({ ...formErrors, display_order: undefined });
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

          {/* Icon URL */}
          <FormField
            id="skill-icon-url"
            label="Icon URL"
            error={formErrors.icon_url}
            helperText="Optional public image / SVG link (e.g. https://icons.dev/ts.svg)"
          >
            <input
              id="skill-icon-url"
              type="url"
              value={formData.icon_url}
              onChange={(e) => {
                setFormData({ ...formData, icon_url: e.target.value });
                if (formErrors.icon_url) setFormErrors({ ...formErrors, icon_url: undefined });
              }}
              placeholder="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/typescript/typescript-original.svg"
              disabled={isSubmitting}
              className={`w-full px-3.5 py-2 bg-slate-950/70 border rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 transition ${
                formErrors.icon_url
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
                  <span>{editingSkill ? 'Update Skill' : 'Create Skill'}</span>
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
        title="Delete Skill"
        message={
          deleteTarget
            ? `Are you sure you want to delete "${deleteTarget.name}"? This action cannot be undone.`
            : 'Are you sure you want to delete this skill?'
        }
        confirmLabel="Delete Skill"
        cancelLabel="Cancel"
        isLoading={isDeleting}
        isDestructive={true}
      />
    </div>
  );
};
