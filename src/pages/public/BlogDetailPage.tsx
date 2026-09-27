import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Calendar, User, BookOpen, Clock, Share2, Check } from 'lucide-react';
import { publicApi } from '../../lib/publicApi.ts';
import { BlogRecord } from '../../types.ts';
import { LoadingState } from '../../components/public/LoadingState.tsx';
import { ErrorState } from '../../components/public/ErrorState.tsx';
import { EmptyState } from '../../components/public/EmptyState.tsx';

export const BlogDetailPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [blog, setBlog] = useState<BlogRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchBlog = async () => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    try {
      const data = await publicApi.getBlogBySlug(slug);
      // Security: Never display unpublished blog posts publicly
      if (data && data.published) {
        setBlog(data);
      } else {
        setBlog(null);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load blog post');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBlog();
  }, [slug]);

  useEffect(() => {
    if (blog?.title) {
      document.title = `${blog.title} | Portfolio`;
    } else {
      document.title = 'Blog Article | Portfolio';
    }
  }, [blog]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatDate = (dateStr: string | Date | null | undefined) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return String(dateStr);
      return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    } catch {
      return String(dateStr);
    }
  };

  if (loading) {
    return (
      <div className="py-20 max-w-4xl mx-auto px-4">
        <LoadingState message="Loading article content..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-20 max-w-4xl mx-auto px-4">
        <ErrorState message={error} onRetry={fetchBlog} />
      </div>
    );
  }

  if (!blog) {
    return (
      <div className="py-20 max-w-4xl mx-auto px-4 space-y-6">
        <Link
          to="/blog"
          className="inline-flex items-center gap-2 text-sm font-mono text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to all publications</span>
        </Link>
        <EmptyState
          icon={BookOpen}
          title="Article Not Found"
          description="The requested publication does not exist or has not been published yet."
        />
      </div>
    );
  }

  const publishDate = formatDate(blog.published_at || blog.created_at);
  const wordCount = (blog.content || blog.excerpt || '').trim().split(/\s+/).filter(Boolean).length;
  const readTimeMin = Math.max(1, Math.ceil(wordCount / 200));

  return (
    <div className="py-12 md:py-20 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
      {/* Back Navigation & Actions Bar */}
      <div className="flex items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <Link
          to="/blog"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-cyan-400 transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>Back to all articles</span>
        </Link>

        <button
          type="button"
          onClick={handleCopyLink}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-slate-300 hover:text-white hover:border-slate-700 transition-colors"
          title="Copy link to clipboard"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <Share2 className="w-3.5 h-3.5" />
              <span>Share Article</span>
            </>
          )}
        </button>
      </div>

      {/* Article Header */}
      <header className="space-y-6">
        <div className="flex items-center gap-3 text-xs font-mono text-cyan-400">
          <span className="px-2.5 py-1 rounded-md bg-cyan-950/40 border border-cyan-800/40">
            Technical Insight
          </span>
          <span className="text-slate-500">&bull;</span>
          <span className="flex items-center gap-1 text-slate-400">
            <Clock className="w-3.5 h-3.5" />
            {readTimeMin} min read
          </span>
        </div>

        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight leading-tight">
          {blog.title}
        </h1>

        {/* Metadata Row */}
        <div className="flex flex-wrap items-center gap-6 text-sm text-slate-400 border-y border-slate-800/80 py-4 font-mono">
          {blog.author_name && (
            <div className="flex items-center gap-2 text-slate-300">
              <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-cyan-400">
                <User className="w-3.5 h-3.5" />
              </div>
              <span>{blog.author_name}</span>
            </div>
          )}

          {publishDate && (
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-slate-500" />
              <span>{publishDate}</span>
            </div>
          )}
        </div>
      </header>

      {/* Featured Banner Image */}
      {blog.featured_image_url && !imageError && (
        <div className="relative aspect-[16/9] w-full rounded-2xl overflow-hidden border border-slate-800 bg-slate-900 shadow-2xl">
          <img
            src={blog.featured_image_url}
            alt={blog.title}
            onError={() => setImageError(true)}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Excerpt Lead */}
      {blog.excerpt && (
        <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 text-lg sm:text-xl text-slate-300 font-normal leading-relaxed italic border-l-4 border-l-cyan-500">
          {blog.excerpt}
        </div>
      )}

      {/* Main Content Body */}
      <article className="prose prose-invert max-w-none space-y-6 text-slate-300 text-base sm:text-lg leading-relaxed">
        {blog.content ? (
          blog.content.split('\n\n').map((paragraph, index) => {
            const trimmed = paragraph.trim();
            if (!trimmed) return null;

            // Handle code blocks
            if (trimmed.startsWith('```') && trimmed.endsWith('```')) {
              const codeLines = trimmed.slice(3, -3).trim().split('\n');
              return (
                <div
                  key={index}
                  className="my-6 rounded-xl bg-slate-950 border border-slate-800 p-4 font-mono text-sm text-cyan-300 overflow-x-auto shadow-inner"
                >
                  <pre>{codeLines.join('\n')}</pre>
                </div>
              );
            }

            // Handle subheadings
            if (trimmed.startsWith('### ')) {
              return (
                <h3 key={index} className="text-xl sm:text-2xl font-bold text-white mt-8 mb-4">
                  {trimmed.replace('### ', '')}
                </h3>
              );
            }
            if (trimmed.startsWith('## ')) {
              return (
                <h2 key={index} className="text-2xl sm:text-3xl font-bold text-white mt-10 mb-4 border-b border-slate-800 pb-2">
                  {trimmed.replace('## ', '')}
                </h2>
              );
            }

            // Standard paragraphs
            return (
              <p key={index} className="leading-relaxed whitespace-pre-line text-slate-300">
                {trimmed}
              </p>
            );
          })
        ) : (
          <p className="text-slate-500 italic">No article content available.</p>
        )}
      </article>

      {/* Article Footer */}
      <div className="pt-10 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
        <Link
          to="/blog"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 font-medium text-sm border border-slate-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>All Publications</span>
        </Link>

        <Link
          to="/contact"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-sm transition-colors shadow-md shadow-cyan-500/10"
        >
          <span>Discuss this topic</span>
        </Link>
      </div>
    </div>
  );
};
