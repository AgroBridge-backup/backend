'use client';

import { Check, Clock, Circle } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface JourneyStage {
  id: string;
  name: string;
  icon: string;
  status: 'completed' | 'current' | 'pending';
  completedAt: string | null;
  details: string | null;
  location: string | null;
}

interface JourneyTimelineProps {
  stages: JourneyStage[];
}

export function JourneyTimeline({ stages }: JourneyTimelineProps) {
  return (
    <div className="card overflow-hidden">
      <div className="relative pl-8">
        {/* Vertical line */}
        <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-gradient-to-b from-primary-500 via-primary-300 to-neutral-200" />

        {stages.map((stage, index) => (
          <div
            key={stage.id}
            className={`relative py-4 px-4 ${
              index !== stages.length - 1 ? 'border-b border-neutral-100' : ''
            }`}
          >
            {/* Status dot */}
            <div
              className={`absolute left-0 top-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 border-white ${
                stage.status === 'completed'
                  ? 'bg-primary-500 text-white'
                  : stage.status === 'current'
                  ? 'bg-amber-500 text-white'
                  : 'bg-neutral-200 text-neutral-400'
              }`}
            >
              {stage.status === 'completed' ? (
                <Check className="h-4 w-4" />
              ) : stage.status === 'current' ? (
                <Clock className="h-4 w-4" />
              ) : (
                <Circle className="h-3 w-3" />
              )}
            </div>

            {/* Content */}
            <div>
              <div className="flex items-center justify-between">
                <h3
                  className={`font-medium ${
                    stage.status === 'pending' ? 'text-neutral-400' : 'text-neutral-900'
                  }`}
                >
                  {stage.name}
                </h3>
                {stage.completedAt && (
                  <span className="text-xs text-neutral-500">
                    {format(parseISO(stage.completedAt), 'MMM d, h:mm a')}
                  </span>
                )}
              </div>

              {stage.details && (
                <p className="mt-1 text-sm text-neutral-500">{stage.details}</p>
              )}

              {stage.location && (
                <p className="mt-1 text-xs text-neutral-400">
                  {stage.location}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
