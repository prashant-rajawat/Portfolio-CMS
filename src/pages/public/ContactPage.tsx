import React, { useState } from 'react';
import { Mail, Send, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { publicApi } from '../../lib/publicApi.ts';
import { SectionHeading } from '../../components/public/SectionHeading.tsx';

export const ContactPage: React.FC = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.name.trim()) errors.name = 'Name is required';
    if (!formData.email.trim()) {
      errors.email = 'Email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      errors.email = 'Please provide a valid email address';
    }
    if (!formData.subject.trim()) errors.subject = 'Subject is required';
    if (!formData.message.trim()) errors.message = 'Message content is required';

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage(null);
    setErrorMessage(null);

    if (!validate()) return;

    setSubmitting(true);
    try {
      const res = await publicApi.submitContact({
        name: formData.name.trim(),
        email: formData.email.trim(),
        subject: formData.subject.trim(),
        message: formData.message.trim(),
      });

      if (res.success) {
        setSuccessMessage(res.message || 'Thank you! Your message has been received.');
        setFormData({ name: '', email: '', subject: '', message: '' });
        setFieldErrors({});
      } else {
        setErrorMessage(res.error || 'Failed to submit inquiry. Please try again.');
        if (Array.isArray(res.errors)) {
          const mapped: Record<string, string> = {};
          res.errors.forEach((err: any) => {
            const field = err.path?.[0] || 'general';
            mapped[field] = err.message;
          });
          setFieldErrors(mapped);
        }
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="py-12 md:py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
      <SectionHeading
        badge="Inquiries"
        title="Get In Touch"
        description="Have a question or looking to collaborate on high-impact software systems? Send a direct message below."
      />

      <div className="max-w-2xl mx-auto bg-slate-900/40 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-xl">
        {/* Success Alert */}
        {successMessage && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5 text-emerald-400" />
            <div>
              <p className="font-semibold text-sm">Message Transmitted Successfully</p>
              <p className="text-xs text-emerald-400/90 mt-1">{successMessage}</p>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-400" />
            <div>
              <p className="font-semibold text-sm">Transmission Error</p>
              <p className="text-xs text-rose-400/90 mt-1">{errorMessage}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6" noValidate>
          {/* Name & Email Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label htmlFor="contact-name" className="block text-xs font-mono text-slate-300 mb-2">
                Your Full Name <span className="text-cyan-400">*</span>
              </label>
              <input
                id="contact-name"
                type="text"
                placeholder="Jane Doe"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={`w-full px-4 py-2.5 rounded-xl bg-slate-800/80 border text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 ${
                  fieldErrors.name ? 'border-rose-500' : 'border-slate-700/80'
                }`}
              />
              {fieldErrors.name && (
                <p className="text-xs text-rose-400 mt-1.5">{fieldErrors.name}</p>
              )}
            </div>

            <div>
              <label htmlFor="contact-email" className="block text-xs font-mono text-slate-300 mb-2">
                Email Address <span className="text-cyan-400">*</span>
              </label>
              <input
                id="contact-email"
                type="email"
                placeholder="jane.doe@enterprise.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className={`w-full px-4 py-2.5 rounded-xl bg-slate-800/80 border text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 ${
                  fieldErrors.email ? 'border-rose-500' : 'border-slate-700/80'
                }`}
              />
              {fieldErrors.email && (
                <p className="text-xs text-rose-400 mt-1.5">{fieldErrors.email}</p>
              )}
            </div>
          </div>

          {/* Subject */}
          <div>
            <label htmlFor="contact-subject" className="block text-xs font-mono text-slate-300 mb-2">
              Inquiry Subject <span className="text-cyan-400">*</span>
            </label>
            <input
              id="contact-subject"
              type="text"
              placeholder="e.g. Distributed System Architecture Consultation"
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              className={`w-full px-4 py-2.5 rounded-xl bg-slate-800/80 border text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 ${
                fieldErrors.subject ? 'border-rose-500' : 'border-slate-700/80'
              }`}
            />
            {fieldErrors.subject && (
              <p className="text-xs text-rose-400 mt-1.5">{fieldErrors.subject}</p>
            )}
          </div>

          {/* Message Content */}
          <div>
            <label htmlFor="contact-message" className="block text-xs font-mono text-slate-300 mb-2">
              Message Content <span className="text-cyan-400">*</span>
            </label>
            <textarea
              id="contact-message"
              rows={5}
              placeholder="Provide context regarding your project goals, timelines, and technical requirements..."
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              className={`w-full px-4 py-2.5 rounded-xl bg-slate-800/80 border text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 ${
                fieldErrors.message ? 'border-rose-500' : 'border-slate-700/80'
              }`}
            />
            {fieldErrors.message && (
              <p className="text-xs text-rose-400 mt-1.5">{fieldErrors.message}</p>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Transmitting Message...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Send Direct Inquiry</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
