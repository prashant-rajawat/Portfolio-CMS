import React from 'react';
import { Briefcase, Calendar } from 'lucide-react';
import { ExperienceRecord } from '../../types.ts';

interface ExperienceItemProps {
  experience: ExperienceRecord;
  isLast?: boolean;
}

export const ExperienceItem: React.FC<ExperienceItemProps> = ({ experience, isLast = false }) => {
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const startFormatted = formatDate(experience.start_date);
  const endFormatted = experience.is_current ? 'Present' : formatDate(experience.end_date);

  return (
    <div className="relative flex gap-6 pb-12 last:pb-0 group">
      {/* Timeline Node Line */}
      {!isLast && (
        <div className="absolute left-[19px] top-9 bottom-0 w-0.5 bg-slate-800 group-hover:bg-slate-700 transition-colors" />
      )}

      {/* Timeline Bullet Icon */}
      <div className="relative z-10 w-10 h-10 rounded-full bg-slate-900 border border-slate-700/80 flex items-center justify-center flex-shrink-0 text-cyan-400 group-hover:border-cyan-500/50 group-hover:shadow-[0_0_12px_rgba(6,182,212,0.25)] transition-all">
        <Briefcase className="w-4 h-4" />
      </div>

      {/* Experience Details */}
      <div className="flex-1 bg-slate-900/40 border border-slate-800/80 rounded-xl p-6 group-hover:border-slate-700 transition-all">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-100">
              {experience.position}
            </h3>
            <span className="text-sm font-medium text-cyan-400">
              {experience.company}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-mono text-slate-400 bg-slate-800/60 px-2.5 py-1 rounded-md border border-slate-700/60 self-start sm:self-auto">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>{startFormatted} &mdash; {endFormatted}</span>
            {experience.is_current && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Active
              </span>
            )}
          </div>
        </div>

        <p className="text-sm text-slate-400 leading-relaxed whitespace-pre-line">
          {experience.description}
        </p>
      </div>
    </div>
  );
};
