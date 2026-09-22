import React from 'react';

interface FormFieldProps {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  helperText?: string;
  children: React.ReactNode;
  className?: string;
}

export const FormField: React.FC<FormFieldProps> = ({
  id,
  label,
  required = false,
  error,
  helperText,
  children,
  className = '',
}) => {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="block text-xs font-medium text-slate-300">
          {label} {required && <span className="text-rose-400 font-bold">*</span>}
        </label>
        {helperText && !error && (
          <span className="text-[11px] text-slate-500">{helperText}</span>
        )}
      </div>

      <div>{children}</div>

      {error && <p className="text-[11px] font-medium text-rose-400 mt-1">{error}</p>}
    </div>
  );
};
