import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  FileText,
  Mail,
  Layers,
  Code2,
  Briefcase,
  Terminal,
  Cpu,
  User,
  Quote,
  Sparkles,
  BookOpen,
} from 'lucide-react';
import { publicApi } from '../../lib/publicApi.ts';
import {
  AboutRecord,
  SkillRecord,
  ProjectRecord,
  BlogRecord,
  ExperienceRecord,
  TestimonialRecord,
  ServiceRecord,
} from '../../types.ts';
import { SectionHeading } from '../../components/public/SectionHeading.tsx';
import { LoadingState } from '../../components/public/LoadingState.tsx';
import { ErrorState } from '../../components/public/ErrorState.tsx';
import { EmptyState } from '../../components/public/EmptyState.tsx';
import { ProjectCard } from '../../components/public/ProjectCard.tsx';
import { SkillCard } from '../../components/public/SkillCard.tsx';
import { ServiceCard } from '../../components/public/ServiceCard.tsx';
import { TestimonialCard } from '../../components/public/TestimonialCard.tsx';
import { ExperienceItem } from '../../components/public/ExperienceItem.tsx';
import { BlogCard } from '../../components/public/BlogCard.tsx';

export const HomePage: React.FC = () => {
  // CMS State collections
  const [about, setAbout] = useState<AboutRecord | null>(null);
  const [skills, setSkills] = useState<SkillRecord[]>([]);
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [experience, setExperience] = useState<ExperienceRecord[]>([]);
  const [testimonials, setTestimonials] = useState<TestimonialRecord[]>([]);
  const [blogs, setBlogs] = useState<BlogRecord[]>([]);

  // Section Loading States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [heroImageError, setHeroImageError] = useState(false);

  const loadAllCmsData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [
        aboutData,
        skillsData,
        servicesData,
        projectsData,
        experienceData,
        testimonialsData,
        blogsData,
      ] = await Promise.all([
        publicApi.getAbout(),
        publicApi.getSkills(),
        publicApi.getServices(),
        publicApi.getProjects(),
        publicApi.getExperience(),
        publicApi.getTestimonials(),
        publicApi.getBlogs(),
      ]);

      setAbout(aboutData || null);
      setSkills((skillsData || []).slice().sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)));
      setServices((servicesData || []).slice().sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)));
      setProjects((projectsData || []).slice().sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)));
      setExperience((experienceData || []).slice().sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)));
      setTestimonials((testimonialsData || []).slice().sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)));
      setBlogs((blogsData || []).filter((b) => b && b.published));
    } catch (err: any) {
      console.error('Failed to load portfolio CMS content:', err);
      setError(err?.message || 'Unable to load portfolio content.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllCmsData();
  }, []);

  if (loading) {
    return (
      <div className="py-24 max-w-7xl mx-auto px-4">
        <LoadingState message="Fetching portfolio showcase from CMS..." variant="skeleton-cards" count={6} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-24 max-w-7xl mx-auto px-4">
        <ErrorState
          title="Error Connecting to Portfolio API"
          message={error}
          onRetry={loadAllCmsData}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full">
      {/* ==================================================================== */}
      {/* 1. HERO SECTION */}
      {/* ==================================================================== */}
      <section
        id="hero"
        className="relative pt-16 pb-20 md:pt-24 md:pb-32 overflow-hidden border-b border-slate-900 bg-gradient-to-b from-slate-950 via-slate-900/40 to-slate-950"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Content */}
            <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                <span>Available for Architecture & Engineering Roles</span>
              </div>

              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight">
                {about?.title ? (
                  about.title
                ) : (
                  <>
                    Principal Software <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-400">Architect</span> & Engineer
                  </>
                )}
              </h1>

              <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto lg:mx-0 leading-relaxed font-normal">
                {about?.short_description ||
                  'Building resilient, high-performance distributed systems, modern full-stack web applications, and scalable cloud architectures.'}
              </p>

              {/* CTAs */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 pt-4">
                <Link
                  to="/projects"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-sm transition-colors shadow-lg shadow-cyan-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                >
                  <span>Explore Projects</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>

                <Link
                  to="/contact"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm border border-slate-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                >
                  <Mail className="w-4 h-4" />
                  <span>Get In Touch</span>
                </Link>

                {about?.resume_url && (
                  <a
                    href={about.resume_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-transparent hover:bg-slate-800/80 text-slate-300 hover:text-white font-medium text-sm border border-slate-800 transition-colors"
                  >
                    <FileText className="w-4 h-4 text-cyan-400" />
                    <span>Download CV / Resume</span>
                  </a>
                )}
              </div>
            </div>

            {/* Right Profile / Visual Container */}
            <div className="lg:col-span-5 flex justify-center lg:justify-end">
              <div className="relative w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96">
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-tr from-cyan-500/20 to-indigo-500/20 blur-2xl transform rotate-6 scale-95" />
                <div className="relative w-full h-full rounded-3xl border border-slate-800 bg-slate-900 overflow-hidden flex items-center justify-center shadow-2xl">
                  {about?.profile_image_url && !heroImageError ? (
                    <img
                      src={about.profile_image_url}
                      alt={about.title || 'Profile'}
                      onError={() => setHeroImageError(true)}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center p-8 text-center text-slate-600">
                      <Terminal className="w-20 h-20 mb-4 text-slate-700 stroke-[1.2]" />
                      <span className="font-mono text-xs text-slate-500">
                        {about?.title || 'Engineer Profile'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================================================================== */}
      {/* 2. ABOUT PREVIEW SECTION */}
      {/* ==================================================================== */}
      <section id="about" className="py-20 md:py-28 border-b border-slate-900 bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            badge="Biography"
            title="Engineering Background & Philosophy"
            description="Proven track record in architecting cloud-native platforms, high-throughput APIs, and mission-critical applications."
          />

          <div className="max-w-4xl mx-auto bg-slate-900/40 border border-slate-800/80 rounded-2xl p-8 md:p-12 space-y-6">
            <h3 className="text-xl sm:text-2xl font-bold text-slate-100">
              {about?.title || 'Professional Biography'}
            </h3>

            <p className="text-slate-300 leading-relaxed whitespace-pre-line text-base sm:text-lg font-normal">
              {about?.full_description ||
                about?.short_description ||
                'Welcome to my technical portfolio. I specialize in designing scalable distributed applications, modern web infrastructure, and high-performance services.'}
            </p>

            <div className="pt-6 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-sm font-mono text-cyan-400">
                <Sparkles className="w-4 h-4" />
                <span>Custom CMS Dynamic Data Verified</span>
              </div>
              <div className="flex items-center gap-3">
                <Link
                  to="/about"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  <span>Full Profile Page</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================================================================== */}
      {/* 3. SKILLS PREVIEW SECTION */}
      {/* ==================================================================== */}
      <section id="skills" className="py-20 md:py-28 border-b border-slate-900 bg-slate-900/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            badge="Technical Capabilities"
            title="Skills & Technologies"
            description="Comprehensive stack proficiency across frontend engineering, backend services, cloud databases, and DevOps."
          />

          {skills.length > 0 ? (
            <div className="space-y-10">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {skills.map((skill) => (
                  <SkillCard key={skill.id} skill={skill} />
                ))}
              </div>

              <div className="text-center pt-4">
                <Link
                  to="/skills"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium border border-slate-700 transition-colors"
                >
                  <span>Explore All Categorized Skills</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          ) : (
            <EmptyState
              icon={Code2}
              title="No Skills Registered"
              description="Technical skills will appear here once added through the CMS Admin portal."
            />
          )}
        </div>
      </section>

      {/* ==================================================================== */}
      {/* 4. SERVICES SECTION */}
      {/* ==================================================================== */}
      <section id="services" className="py-20 md:py-28 border-b border-slate-900 bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            badge="Offerings"
            title="Engineering & Architecture Services"
            description="Expert technical solutions ranging from full-stack system development to database design and cloud migration."
          />

          {services.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {services.map((service) => (
                <ServiceCard key={service.id} service={service} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Cpu}
              title="No Services Configured"
              description="Professional services will appear here once published in the Admin CMS."
            />
          )}
        </div>
      </section>

      {/* ==================================================================== */}
      {/* 5. PROJECTS SECTION */}
      {/* ==================================================================== */}
      <section id="projects" className="py-20 md:py-28 border-b border-slate-900 bg-slate-900/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            badge="Featured Work"
            title="Featured Engineering Projects"
            description="Production platforms, distributed microservices, and client applications built with modern stacks."
          />

          {projects.length > 0 ? (
            <div className="space-y-12">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {projects.slice(0, 6).map((project) => (
                  <ProjectCard key={project.id} project={project} />
                ))}
              </div>

              {projects.length > 6 && (
                <div className="text-center pt-4">
                  <Link
                    to="/projects"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold border border-slate-700 transition-colors"
                  >
                    <span>View All {projects.length} Projects</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <EmptyState
              icon={Layers}
              title="No Projects in Portfolio"
              description="Showcase projects published via the CMS will be displayed here."
            />
          )}
        </div>
      </section>

      {/* ==================================================================== */}
      {/* 6. EXPERIENCE SECTION */}
      {/* ==================================================================== */}
      <section id="experience" className="py-20 md:py-28 border-b border-slate-900 bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            badge="Career History"
            title="Work Experience & Positions"
            description="Professional journey delivering technical leadership, systems architecture, and software development."
          />

          {experience.length > 0 ? (
            <div className="max-w-3xl mx-auto space-y-2">
              {experience.map((item, idx) => (
                <ExperienceItem
                  key={item.id}
                  experience={item}
                  isLast={idx === experience.length - 1}
                />
              ))}

              <div className="text-center pt-8">
                <Link
                  to="/experience"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  <span>View Complete Career Timeline</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          ) : (
            <EmptyState
              icon={Briefcase}
              title="No Experience Records Found"
              description="Career entries added in the CMS Admin panel will be chronologically listed here."
            />
          )}
        </div>
      </section>

      {/* ==================================================================== */}
      {/* 7. TESTIMONIALS SECTION */}
      {/* ==================================================================== */}
      <section id="testimonials" className="py-20 md:py-28 border-b border-slate-900 bg-slate-900/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            badge="Recommendations"
            title="Client & Peer Testimonials"
            description="Feedback from engineering leaders, product stakeholders, and collaborative clients."
          />

          {testimonials.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {testimonials.map((testimonial) => (
                <TestimonialCard key={testimonial.id} testimonial={testimonial} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Quote}
              title="No Testimonials Yet"
              description="Client recommendations published in the CMS will be featured here."
            />
          )}
        </div>
      </section>

      {/* ==================================================================== */}
      {/* 8. BLOG PREVIEW SECTION */}
      {/* ==================================================================== */}
      <section id="blog" className="py-20 md:py-28 border-b border-slate-900 bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            badge="Publications"
            title="Latest Articles & Insights"
            description="Deep dives into backend architecture, database optimization, and software engineering practices."
          />

          {blogs.length > 0 ? (
            <div className="space-y-12">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {blogs.slice(0, 3).map((blog) => (
                  <BlogCard key={blog.id} blog={blog} />
                ))}
              </div>

              <div className="text-center pt-4">
                <Link
                  to="/blog"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold border border-slate-700 transition-colors"
                >
                  <span>View All Articles</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          ) : (
            <EmptyState
              icon={BookOpen}
              title="No Published Articles"
              description="Technical posts authored and published through the CMS will appear here."
            />
          )}
        </div>
      </section>

      {/* ==================================================================== */}
      {/* 9. CONTACT CALL TO ACTION SECTION */}
      {/* ==================================================================== */}
      <section id="contact-cta" className="py-20 md:py-28 bg-gradient-to-b from-slate-950 to-slate-900/60">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-8 sm:p-12 md:p-16 backdrop-blur-sm relative overflow-hidden shadow-2xl">
            <div className="relative z-10 space-y-6">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-mono font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                Let&apos;s Connect
              </span>

              <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight">
                Have a project in mind?
              </h2>

              <p className="text-slate-300 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
                Whether you need a senior architectural consultation, a full-stack system build, or technical advisory, I&apos;m always open to discussing new opportunities.
              </p>

              <div className="pt-4 flex flex-wrap items-center justify-center gap-4">
                <Link
                  to="/contact"
                  className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm transition-all shadow-lg shadow-cyan-500/25"
                >
                  <Mail className="w-4 h-4" />
                  <span>Send a Direct Inquiry</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  to="/about"
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm border border-slate-700 transition-colors"
                >
                  <User className="w-4 h-4" />
                  <span>Learn More About Me</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
