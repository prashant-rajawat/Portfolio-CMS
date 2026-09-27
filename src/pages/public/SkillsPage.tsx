import React, { useState, useEffect, useMemo } from 'react';
import { Code2, Layers, Cpu } from 'lucide-react';
import { publicApi } from '../../lib/publicApi.ts';
import { SkillRecord } from '../../types.ts';
import { SectionHeading } from '../../components/public/SectionHeading.tsx';
import { LoadingState } from '../../components/public/LoadingState.tsx';
import { ErrorState } from '../../components/public/ErrorState.tsx';
import { EmptyState } from '../../components/public/EmptyState.tsx';
import { SkillCard } from '../../components/public/SkillCard.tsx';

export const SkillsPage: React.FC = () => {
  const [skills, setSkills] = useState<SkillRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSkills = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await publicApi.getSkills();
      setSkills(data.sort((a, b) => a.display_order - b.display_order));
    } catch (err: any) {
      setError(err?.message || 'Failed to load skills');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.title = 'Skills | Portfolio';
    fetchSkills();
  }, []);

  // Group skills by category
  const skillsByCategory = useMemo(() => {
    const grouped: Record<string, SkillRecord[]> = {};
    skills.forEach((skill) => {
      const cat = skill.category || 'General';
      if (!grouped[cat]) {
        grouped[cat] = [];
      }
      grouped[cat].push(skill);
    });
    return grouped;
  }, [skills]);

  if (loading) {
    return (
      <div className="py-20 max-w-7xl mx-auto px-4">
        <LoadingState message="Loading technical skills..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-20 max-w-7xl mx-auto px-4">
        <ErrorState message={error} onRetry={fetchSkills} />
      </div>
    );
  }

  const categoryNames = Object.keys(skillsByCategory);

  return (
    <div className="py-12 md:py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
      <SectionHeading
        badge="Competencies"
        title="Technical Skills & Expertise"
        description="Comprehensive evaluation of programming languages, architecture frameworks, cloud infrastructure, and databases."
      />

      {categoryNames.length > 0 ? (
        <div className="space-y-12">
          {categoryNames.map((category) => (
            <div
              key={category}
              className="bg-slate-900/30 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6"
            >
              <div className="flex items-center gap-2 border-b border-slate-800 pb-4">
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                <h3 className="text-lg sm:text-xl font-bold text-slate-100 uppercase tracking-wide text-xs font-mono">
                  {category} ({skillsByCategory[category].length})
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {skillsByCategory[category].map((skill) => (
                  <SkillCard key={skill.id} skill={skill} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Code2}
          title="No Skills in Directory"
          description="Skills added and categorized in the Admin CMS will appear here."
        />
      )}
    </div>
  );
};
