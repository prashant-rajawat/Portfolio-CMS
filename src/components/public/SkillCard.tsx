import React, { useState } from 'react';
import { Code, CheckCircle2 } from 'lucide-react';
import { SkillRecord } from '../../types.ts';

interface SkillCardProps {
  skill: SkillRecord;
}

export const SkillCard: React.FC<SkillCardProps> = ({ skill }) => {
  const [iconError, setIconError] = useState(false);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 hover:border-slate-700 hover:bg-slate-900/70 transition-all duration-200">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0 text-cyan-400 overflow-hidden">
            {skill.icon_url && !iconError ? (
              <img
                src={skill.icon_url}
                alt=""
                onError={() => setIconError(true)}
                className="w-5 h-5 object-contain"
                loading="lazy"
              />
            ) : (
              <Code className="w-4 h-4 text-cyan-400" />
            )}
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-200 leading-none">
              {skill.name}
            </h4>
            <span className="text-[11px] font-mono text-slate-400 mt-1 block">
              {skill.category}
            </span>
          </div>
        </div>

        {skill.proficiency !== null && skill.proficiency !== undefined && (
          <span className="text-xs font-mono font-medium text-cyan-400 bg-cyan-950/40 border border-cyan-800/40 px-2 py-0.5 rounded">
            {skill.proficiency}%
          </span>
        )}
      </div>

      {skill.proficiency !== null && skill.proficiency !== undefined && (
        <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden mt-3">
          <div
            className="bg-gradient-to-r from-cyan-500 to-indigo-500 h-1.5 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(Math.max(skill.proficiency, 0), 100)}%` }}
          />
        </div>
      )}
    </div>
  );
};
