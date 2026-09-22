import React, { useState, useEffect, useCallback } from 'react';
import { Save, UserCircle, RefreshCw, Loader2, ExternalLink, Link as LinkIcon } from 'lucide-react';
import { api } from '../lib/api';
import { FormField } from '../components/FormField';
import { AlertMessage } from '../components/AlertMessage';
import { LoadingState } from '../components/LoadingState';

interface AboutData {
  id?: string;
  title: string;
  short_description: string;
  full_description: string;
  profile_image_url: string | null;
  resume_url: string | null;
  created_at?: string;
  updated_at?: string;
}

interface FormErrors {
  title?: string;
  short_description?: string;
  full_description?: string;
  profile_image_url?: string;
  resume_url?: string;
}

export const AdminAboutPage: React.FC = () => {
  const [formData, setFormData] = useState<AboutData>({
    title: '',
    short_description: '',
    full_description: '',
    profile_image_url: '',
    resume_url: '',
  });

  const [initialLoading, setInitialLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchAboutData = useCallback(async () => {
    setInitialLoading(true);
    setErrorMessage(null);
    try {
      const response = await api.get<AboutData | null>('/api/about');
      if (response.data) {
        const about = response.data;
        setFormData({
          id: about.id,
          title: about.title || '',
          short_description: about.short_description || '',
          full_description: about.full_description || '',
          profile_image_url: about.profile_image_url || '',
          resume_url: about.resume_url || '',
          created_at: about.created_at,
          updated_at: about.updated_at,
        });
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Unable to load About section data from the server.';
      setErrorMessage(msg);
    } finally {
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAboutData();
  }, [fetchAboutData]);

  const validateUrl = (url: string): boolean => {
    if (!url.trim()) return true;
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    } else if (formData.title.length > 255) {
      newErrors.title = 'Title must not exceed 255 characters';
    }

    if (!formData.short_description.trim()) {
      newErrors.short_description = 'Short description is required';
    }

    if (!formData.full_description.trim()) {
      newErrors.full_description = 'Full description is required';
    }

    if (formData.profile_image_url && !validateUrl(formData.profile_image_url)) {
      newErrors.profile_image_url = 'Please enter a valid URL (starting with http:// or https://)';
    }

    if (formData.resume_url && !validateUrl(formData.resume_url)) {
      newErrors.resume_url = 'Please enter a valid URL (starting with http:// or https://)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage(null);
    setErrorMessage(null);

    if (isSaving) return;

    if (!validate()) {
      setErrorMessage('Please fix the validation errors before saving.');
      return;
    }

    setIsSaving(true);

    const payload = {
      title: formData.title.trim(),
      short_description: formData.short_description.trim(),
      full_description: formData.full_description.trim(),
      profile_image_url: formData.profile_image_url?.trim() || null,
      resume_url: formData.resume_url?.trim() || null,
    };

    try {
      const response = await api.put<AboutData>('/api/about', payload);
      if (response.success) {
        setSuccessMessage('About section profile updated successfully.');
        if (response.data) {
          const updated = response.data;
          setFormData({
            ...formData,
            ...updated,
            profile_image_url: updated.profile_image_url || '',
            resume_url: updated.resume_url || '',
          });
        }
      } else {
        setErrorMessage(response.error || 'Failed to save About section. Please try again.');
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to save About section. Please try again.';
      setErrorMessage(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleInputChange = (field: keyof AboutData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
    if (successMessage) setSuccessMessage(null);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-950/60 border border-indigo-800/80 flex items-center justify-center text-indigo-400">
              <UserCircle className="w-4 h-4" />
            </div>
            <h1 className="text-base font-bold text-slate-100">About CMS</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Manage your personal profile, bio summaries, portrait avatar URL, and resume links.
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            type="button"
            onClick={fetchAboutData}
            disabled={initialLoading || isSaving}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700/80 text-slate-300 hover:text-white text-xs font-medium rounded-lg border border-slate-700/60 transition cursor-pointer disabled:opacity-50"
            title="Refresh from server"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${initialLoading ? 'animate-spin' : ''}`} />
            <span>Reload</span>
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

      {/* Loading State */}
      {initialLoading ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl">
          <LoadingState message="Fetching About profile data from server..." />
        </div>
      ) : (
        /* Form Card */
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 md:p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {/* Title / Headline */}
            <FormField
              id="about-title"
              label="Professional Headline / Title"
              required
              error={errors.title}
              helperText="e.g. Senior Full-Stack Engineer & Cloud Architect"
            >
              <input
                id="about-title"
                type="text"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                placeholder="Senior Full-Stack Engineer & Cloud Architect"
                maxLength={255}
                disabled={isSaving}
                className={`w-full px-3.5 py-2.5 bg-slate-950/70 border rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 transition ${
                  errors.title
                    ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20'
                    : 'border-slate-800 focus:border-indigo-500 focus:ring-indigo-500/20'
                }`}
              />
            </FormField>

            {/* Short Description */}
            <FormField
              id="about-short-desc"
              label="Short Bio Summary"
              required
              error={errors.short_description}
              helperText="Concise hook displayed in hero cards and profile previews"
            >
              <textarea
                id="about-short-desc"
                rows={2}
                value={formData.short_description}
                onChange={(e) => handleInputChange('short_description', e.target.value)}
                placeholder="Passionate engineer with 8+ years building enterprise microservices and reactive interfaces."
                disabled={isSaving}
                className={`w-full px-3.5 py-2.5 bg-slate-950/70 border rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 transition ${
                  errors.short_description
                    ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20'
                    : 'border-slate-800 focus:border-indigo-500 focus:ring-indigo-500/20'
                }`}
              />
            </FormField>

            {/* Full Description */}
            <FormField
              id="about-full-desc"
              label="Full Biography & Experience Summary"
              required
              error={errors.full_description}
              helperText="Comprehensive background story and technical philosophy"
            >
              <textarea
                id="about-full-desc"
                rows={6}
                value={formData.full_description}
                onChange={(e) => handleInputChange('full_description', e.target.value)}
                placeholder="Detailed background, key leadership initiatives, architectural principles..."
                disabled={isSaving}
                className={`w-full px-3.5 py-2.5 bg-slate-950/70 border rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 transition ${
                  errors.full_description
                    ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20'
                    : 'border-slate-800 focus:border-indigo-500 focus:ring-indigo-500/20'
                }`}
              />
            </FormField>

            {/* URL Fields Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2 border-t border-slate-800/80">
              {/* Profile Image URL */}
              <FormField
                id="about-profile-image"
                label="Profile Image URL"
                error={errors.profile_image_url}
                helperText="Public image link for avatar / headshot"
              >
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <LinkIcon className="w-3.5 h-3.5" />
                  </div>
                  <input
                    id="about-profile-image"
                    type="url"
                    value={formData.profile_image_url || ''}
                    onChange={(e) => handleInputChange('profile_image_url', e.target.value)}
                    placeholder="https://example.com/avatar.jpg"
                    disabled={isSaving}
                    className={`w-full pl-9 pr-3.5 py-2.5 bg-slate-950/70 border rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 transition ${
                      errors.profile_image_url
                        ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20'
                        : 'border-slate-800 focus:border-indigo-500 focus:ring-indigo-500/20'
                    }`}
                  />
                </div>
              </FormField>

              {/* Resume URL */}
              <FormField
                id="about-resume-url"
                label="Resume / CV Link URL"
                error={errors.resume_url}
                helperText="Public document link for downloadable resume"
              >
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </div>
                  <input
                    id="about-resume-url"
                    type="url"
                    value={formData.resume_url || ''}
                    onChange={(e) => handleInputChange('resume_url', e.target.value)}
                    placeholder="https://example.com/resume.pdf"
                    disabled={isSaving}
                    className={`w-full pl-9 pr-3.5 py-2.5 bg-slate-950/70 border rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 transition ${
                      errors.resume_url
                        ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20'
                        : 'border-slate-800 focus:border-indigo-500 focus:ring-indigo-500/20'
                    }`}
                  />
                </div>
              </FormField>
            </div>

            {/* Timestamps if present */}
            {formData.updated_at && (
              <p className="text-[11px] text-slate-500 pt-2">
                Last updated: {new Date(formData.updated_at).toLocaleString()}
              </p>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-800">
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center space-x-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-sm transition cursor-pointer"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving Changes...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Save About Profile</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
