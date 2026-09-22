import React, { useState, useEffect } from 'react';
import { Briefcase } from 'lucide-react';
import { publicApi } from '../../lib/publicApi.ts';
import { ExperienceRecord } from '../../types.ts';
import { SectionHeading } from '../../components/public/SectionHeading.tsx';
import { LoadingState } from '../../components/public/LoadingState.tsx';
import { ErrorState } from '../../components/public/ErrorState.tsx';
import { EmptyState } from '../../components/public/EmptyState.tsx';
import { ExperienceItem } from '../../components/public/ExperienceItem.tsx';

export const ExperiencePage: React.FC = () => {
  const [experience, setExperience] = useState<ExperienceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchExperience = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await publicApi.getExperience();
      setExperience(data.sort((a, b) => a.display_order - b.display_order));
    } catch (err: any) {
      setError(err?.message || 'Failed to load experience');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExperience();
  }, []);

  if (loading) {
    return (
      <div className="py-20 max-w-7xl mx-auto px-4">
        <LoadingState message="Loading career experience..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-20 max-w-7xl mx-auto px-4">
        <ErrorState message={error} onRetry={fetchExperience} />
      </div>
    );
  }

  return (
    <div className="py-12 md:py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
      <SectionHeading
        badge="Career History"
        title="Professional Experience"
        description="Chronological record of roles, responsibilities, engineering leadership, and achievements."
      />

      {experience.length > 0 ? (
        <div className="max-w-3xl mx-auto space-y-2">
          {experience.map((item, idx) => (
            <ExperienceItem
              key={item.id}
              experience={item}
              isLast={idx === experience.length - 1}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Briefcase}
          title="No Experience Records"
          description="Career history records managed via the CMS will be chronologically presented here."
        />
      )}
    </div>
  );
};
