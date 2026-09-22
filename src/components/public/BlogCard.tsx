import React, { useState } from 'react';
import { Calendar, User, ArrowRight, BookOpen } from 'lucide-react';
import { BlogRecord } from '../../types.ts';

interface BlogCardProps {
  blog: BlogRecord;
}

export const BlogCard: React.FC<BlogCardProps> = ({ blog }) => {
  const [imageError, setImageError] = useState(false);

  const formatDate = (dateStr: string | Date | null | undefined) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return String(dateStr);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return String(dateStr);
    }
  };

  const publishDate = formatDate(blog.published_at || blog.created_at);

  return (
    <article className="group rounded-xl border border-slate-800 bg-slate-900/40 hover:bg-slate-900/70 hover:border-slate-700 transition-all duration-300 flex flex-col overflow-hidden">
      {/* Featured Image */}
      <div className="relative aspect-[16/9] w-full bg-slate-950 overflow-hidden border-b border-slate-800/80 flex items-center justify-center">
        {blog.featured_image_url && !imageError ? (
          <img
            src={blog.featured_image_url}
            alt={blog.title}
            onError={() => setImageError(true)}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-slate-600 p-6 text-center">
            <BookOpen className="w-10 h-10 mb-2 stroke-[1.5] text-slate-700 group-hover:text-cyan-500/60 transition-colors" />
            <span className="text-xs font-mono text-slate-500">Architecture Article</span>
          </div>
        )}
      </div>

      {/* Article Body */}
      <div className="p-6 flex-1 flex flex-col justify-between">
        <div>
          {/* Metadata */}
          <div className="flex items-center gap-3 text-xs font-mono text-slate-400 mb-3">
            {publishDate && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {publishDate}
              </span>
            )}
            {blog.author_name && (
              <span className="flex items-center gap-1">
                <User className="w-3.5 h-3.5" />
                {blog.author_name}
              </span>
            )}
          </div>

          <h3 className="text-lg font-bold text-slate-100 group-hover:text-cyan-400 transition-colors line-clamp-2">
            {blog.title}
          </h3>

          <p className="mt-2 text-sm text-slate-400 line-clamp-3 leading-relaxed">
            {blog.excerpt}
          </p>
        </div>

        {/* Read Post Link */}
        <div className="mt-6 pt-4 border-t border-slate-800/60">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-400 group-hover:text-cyan-300 transition-colors">
            <span>Read Publication</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </span>
        </div>
      </div>
    </article>
  );
};
