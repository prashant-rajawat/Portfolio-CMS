import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Mail, Terminal, ArrowRight, Sparkles, CheckCircle2 } from 'lucide-react';
import { publicApi } from '../../lib/publicApi.ts';
import { AboutRecord, ServiceRecord } from '../../types.ts';
import { SectionHeading } from '../../components/public/SectionHeading.tsx';
import { LoadingState } from '../../components/public/LoadingState.tsx';
import { ErrorState } from '../../components/public/ErrorState.tsx';
import { ServiceCard } from '../../components/public/ServiceCard.tsx';

export const AboutPage: React.FC = () => {
  const [about, setAbout] = useState<AboutRecord | null>(null);
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [aboutRes, servicesRes] = await Promise.all([
        publicApi.getAbout(),
        publicApi.getServices(),
      ]);
      setAbout(aboutRes);
      setServices(servicesRes.sort((a, b) => a.display_order - b.display_order));
    } catch (err: any) {
      setError(err?.message || 'Failed to load about data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="py-20 max-w-7xl mx-auto px-4">
        <LoadingState message="Loading about information..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-20 max-w-7xl mx-auto px-4">
        <ErrorState message={error} onRetry={fetchData} />
      </div>
    );
  }

  return (
    <div className="py-12 md:py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
      <SectionHeading
        badge="About Me"
        title="Background & Engineering Philosophy"
        description="A deeper look into technical foundations, experience building robust architectures, and design principles."
      />

      {/* Main Bio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
        {/* Left Profile Card */}
        <div className="lg:col-span-4 flex flex-col items-center">
          <div className="relative w-64 h-64 sm:w-72 sm:h-72 rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden shadow-xl mb-6">
            {about?.profile_image_url && !imageError ? (
              <img
                src={about.profile_image_url}
                alt={about.title || 'Profile'}
                onError={() => setImageError(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-600 p-6 text-center">
                <Terminal className="w-16 h-16 mb-2 text-slate-700" />
                <span className="font-mono text-xs text-slate-500">{about?.title || 'Engineer Profile'}</span>
              </div>
            )}
          </div>

          <div className="w-full space-y-3">
            {about?.resume_url && (
              <a
                href={about.resume_url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-sm transition-colors shadow-md shadow-cyan-500/10"
              >
                <FileText className="w-4 h-4" />
                <span>Download Resume / CV</span>
              </a>
            )}
            <Link
              to="/contact"
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-sm border border-slate-700 transition-colors"
            >
              <Mail className="w-4 h-4" />
              <span>Contact Directly</span>
            </Link>
          </div>
        </div>

        {/* Right Biography Content */}
        <div className="lg:col-span-8 space-y-8 bg-slate-900/40 border border-slate-800/80 rounded-2xl p-8 md:p-10">
          <div>
            <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider block mb-2">
              Professional Overview
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
              {about?.title || 'Principal Software Architect & Engineer'}
            </h2>
            <p className="text-base sm:text-lg text-slate-300 leading-relaxed font-normal">
              {about?.short_description}
            </p>
          </div>

          <div className="pt-6 border-t border-slate-800">
            <h3 className="text-base font-semibold text-slate-200 uppercase tracking-wider text-xs font-mono mb-4">
              Full Detailed Biography
            </h3>
            <div className="text-slate-300 leading-relaxed space-y-4 whitespace-pre-line text-sm sm:text-base font-normal">
              {about?.full_description ||
                'I am dedicated to crafting scalable web applications, designing resilient database systems, and establishing sustainable engineering practices.'}
            </div>
          </div>
        </div>
      </div>

      {/* Services Provided Section */}
      {services.length > 0 && (
        <div className="pt-12 border-t border-slate-900 space-y-8">
          <div className="text-center max-w-2xl mx-auto">
            <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider">
              Core Capabilities
            </span>
            <h3 className="text-2xl sm:text-3xl font-bold text-white mt-1">
              Services & Consulting
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((service) => (
              <ServiceCard key={service.id} service={service} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
