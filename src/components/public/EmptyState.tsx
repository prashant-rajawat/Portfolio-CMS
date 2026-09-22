import React from 'react';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  icon?: React.ElementType;
  title: string;
  description: string;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon = Inbox,
  title,
  description,
  className = '',
}) => {
  return (
    <div
      className={`rounded-xl border border-slate-800/80 bg-slate-900/30 p-8 text-center max-w-md mx-auto ${className}`}
    >
      <div className="w-12 h-12 rounded-full bg-slate-800/60 border border-slate-700/60 flex items-center justify-center mx-auto mb-4 text-slate-400">
        <Icon className="w-6 h-6" />
      </div>
      <h4 className="text-base font-medium text-slate-200 mb-1">{title}</h4>
      <p className="text-sm text-slate-400">{description}</p>
    </div>
  );
};
