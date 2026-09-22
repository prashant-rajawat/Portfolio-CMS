import React from 'react';

interface SectionHeadingProps {
  id?: string;
  badge?: string;
  title: string;
  description?: string;
  align?: 'left' | 'center';
  className?: string;
}

export const SectionHeading: React.FC<SectionHeadingProps> = ({
  id,
  badge,
  title,
  description,
  align = 'center',
  className = '',
}) => {
  const alignmentClasses = align === 'center' ? 'text-center mx-auto' : 'text-left';

  return (
    <div id={id} className={`max-w-3xl mb-12 md:mb-16 ${alignmentClasses} ${className}`}>
      {badge && (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-mono font-medium tracking-wide bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 mb-3">
          {badge}
        </span>
      )}
      <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-slate-100">
        {title}
      </h2>
      {description && (
        <p className="mt-4 text-base sm:text-lg text-slate-400 leading-relaxed max-w-2xl mx-auto">
          {description}
        </p>
      )}
    </div>
  );
};
