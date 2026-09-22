import React from 'react';
import { Plus, LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center p-12 text-center rounded-xl border border-dashed border-slate-800 bg-slate-900/30 ${className}`}
    >
      {Icon && (
        <div className="w-12 h-12 rounded-full bg-slate-800/80 border border-slate-700/60 flex items-center justify-center mb-3.5 text-slate-400">
          <Icon className="w-6 h-6" />
        </div>
      )}
      <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
      {description && (
        <p className="text-xs text-slate-400 mt-1 max-w-sm leading-relaxed">{description}</p>
      )}

      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-4.5 inline-flex items-center space-x-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg shadow-sm transition active:scale-[0.98] cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{actionLabel}</span>
        </button>
      )}
    </div>
  );
};
