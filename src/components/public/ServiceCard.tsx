import React, { useState } from 'react';
import { Cpu, Terminal, Layout, ShieldCheck, Database, Cloud } from 'lucide-react';
import { ServiceRecord } from '../../types.ts';

interface ServiceCardProps {
  service: ServiceRecord;
}

export const ServiceCard: React.FC<ServiceCardProps> = ({ service }) => {
  const [iconError, setIconError] = useState(false);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 md:p-8 hover:border-slate-700/80 hover:bg-slate-900/70 transition-all duration-300 flex flex-col justify-between">
      <div>
        <div className="w-12 h-12 rounded-xl bg-cyan-950/40 border border-cyan-800/40 flex items-center justify-center text-cyan-400 mb-6 overflow-hidden">
          {service.icon_url && !iconError ? (
            <img
              src={service.icon_url}
              alt=""
              onError={() => setIconError(true)}
              className="w-6 h-6 object-contain"
              loading="lazy"
            />
          ) : (
            <Cpu className="w-6 h-6 text-cyan-400" />
          )}
        </div>

        <h3 className="text-lg font-bold text-slate-100 mb-3">
          {service.title}
        </h3>
        <p className="text-sm text-slate-400 leading-relaxed">
          {service.description}
        </p>
      </div>

      <div className="mt-6 pt-4 border-t border-slate-800/60 flex items-center gap-2 text-xs font-mono text-slate-400">
        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
        <span>Architecture & Engineering</span>
      </div>
    </div>
  );
};
