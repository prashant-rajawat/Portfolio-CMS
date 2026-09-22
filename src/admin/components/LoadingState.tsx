import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingStateProps {
  message?: string;
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading data...',
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center p-12 text-slate-400 space-y-3 ${className}`}
    >
      <Loader2 className="w-7 h-7 text-indigo-400 animate-spin" />
      <p className="text-xs font-medium text-slate-300 tracking-wide">{message}</p>
    </div>
  );
};
