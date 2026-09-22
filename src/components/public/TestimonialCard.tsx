import React, { useState } from 'react';
import { Quote, User } from 'lucide-react';
import { TestimonialRecord } from '../../types.ts';

interface TestimonialCardProps {
  testimonial: TestimonialRecord;
}

export const TestimonialCard: React.FC<TestimonialCardProps> = ({ testimonial }) => {
  const [avatarError, setAvatarError] = useState(false);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 md:p-8 flex flex-col justify-between hover:border-slate-700/80 transition-all duration-200">
      <div>
        <div className="w-8 h-8 rounded-lg bg-slate-800/80 flex items-center justify-center text-cyan-400 mb-4">
          <Quote className="w-4 h-4" />
        </div>
        <p className="text-sm md:text-base text-slate-300 italic leading-relaxed">
          &ldquo;{testimonial.content}&rdquo;
        </p>
      </div>

      <div className="mt-6 pt-6 border-t border-slate-800/60 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center overflow-hidden flex-shrink-0">
          {testimonial.profile_image_url && !avatarError ? (
            <img
              src={testimonial.profile_image_url}
              alt={testimonial.name}
              onError={() => setAvatarError(true)}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <User className="w-5 h-5 text-slate-400" />
          )}
        </div>
        <div>
          <h4 className="text-sm font-semibold text-slate-100">{testimonial.name}</h4>
          <p className="text-xs text-slate-400">
            {testimonial.role}
            {testimonial.company ? ` at ${testimonial.company}` : ''}
          </p>
        </div>
      </div>
    </div>
  );
};
