import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingStateProps {
  message?: string;
  variant?: 'spinner' | 'skeleton-grid' | 'skeleton-cards';
  count?: number;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading content...',
  variant = 'spinner',
  count = 3,
}) => {
  if (variant === 'skeleton-cards') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 space-y-4"
          >
            <div className="h-40 bg-slate-800/60 rounded-lg w-full" />
            <div className="h-5 bg-slate-800 rounded w-3/4" />
            <div className="space-y-2">
              <div className="h-3 bg-slate-800/80 rounded w-full" />
              <div className="h-3 bg-slate-800/80 rounded w-5/6" />
            </div>
            <div className="flex gap-2 pt-2">
              <div className="h-6 w-16 bg-slate-800 rounded-md" />
              <div className="h-6 w-16 bg-slate-800 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="py-12 flex flex-col items-center justify-center text-slate-400 space-y-3">
      <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
      <p className="text-sm font-medium text-slate-400">{message}</p>
    </div>
  );
};
