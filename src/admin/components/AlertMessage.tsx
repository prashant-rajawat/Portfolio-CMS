import React from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

interface AlertMessageProps {
  type: 'success' | 'error' | 'info';
  message: string;
  onClose?: () => void;
  className?: string;
}

export const AlertMessage: React.FC<AlertMessageProps> = ({
  type,
  message,
  onClose,
  className = '',
}) => {
  if (!message) return null;

  const isSuccess = type === 'success';
  const isError = type === 'error';

  return (
    <div
      role="alert"
      className={`p-3.5 rounded-lg border text-xs flex items-start justify-between space-x-3 transition ${
        isSuccess
          ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-300'
          : isError
          ? 'bg-rose-950/40 border-rose-800/80 text-rose-300'
          : 'bg-cyan-950/40 border-cyan-800/80 text-cyan-300'
      } ${className}`}
    >
      <div className="flex items-start space-x-2.5">
        {isSuccess ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
        ) : (
          <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
        )}
        <span className="leading-relaxed">{message}</span>
      </div>

      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-slate-200 transition p-0.5 cursor-pointer"
          aria-label="Dismiss alert"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
