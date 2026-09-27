import React, { useState, useEffect, useMemo } from 'react';
import { BookOpen, Search } from 'lucide-react';
import { publicApi } from '../../lib/publicApi.ts';
import { BlogRecord } from '../../types.ts';
import { SectionHeading } from '../../components/public/SectionHeading.tsx';
import { LoadingState } from '../../components/public/LoadingState.tsx';
import { ErrorState } from '../../components/public/ErrorState.tsx';
import { EmptyState } from '../../components/public/EmptyState.tsx';
import { BlogCard } from '../../components/public/BlogCard.tsx';

export const BlogPage: React.FC = () => {
  const [blogs, setBlogs] = useState<BlogRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchBlogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await publicApi.getBlogs();
      setBlogs(data.filter((b) => b.published));
    } catch (err: any) {
      setError(err?.message || 'Failed to load blog posts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.title = 'Blog | Portfolio';
    fetchBlogs();
  }, []);

  const filteredBlogs = useMemo(() => {
    return blogs.filter((b) => {
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      return (
        b.title.toLowerCase().includes(query) ||
        b.excerpt.toLowerCase().includes(query) ||
        (b.author_name && b.author_name.toLowerCase().includes(query))
      );
    });
  }, [blogs, searchQuery]);

  if (loading) {
    return (
      <div className="py-20 max-w-7xl mx-auto px-4">
        <LoadingState message="Loading publications..." variant="skeleton-cards" count={3} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-20 max-w-7xl mx-auto px-4">
        <ErrorState message={error} onRetry={fetchBlogs} />
      </div>
    );
  }

  return (
    <div className="py-12 md:py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
      <SectionHeading
        badge="Publications"
        title="Technical Articles & Insights"
        description="Essays on system architecture, database performance, distributed computing, and web engineering."
      />

      {blogs.length > 0 && (
        <div className="max-w-md mx-auto relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search articles by title or topic..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>
      )}

      {filteredBlogs.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredBlogs.map((blog) => (
            <BlogCard key={blog.id} blog={blog} />
          ))}
        </div>
      ) : blogs.length > 0 ? (
        <div className="py-12 text-center text-slate-400 bg-slate-900/20 rounded-xl border border-slate-800 p-8">
          <p className="text-sm">No articles matched your search query.</p>
          <button
            onClick={() => setSearchQuery('')}
            className="mt-3 text-xs font-mono text-cyan-400 hover:underline"
          >
            Clear search
          </button>
        </div>
      ) : (
        <EmptyState
          icon={BookOpen}
          title="No Published Articles"
          description="Technical posts authored in the CMS Admin panel will be published here."
        />
      )}
    </div>
  );
};
