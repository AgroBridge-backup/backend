'use client';

import { CheckCircle, AlertTriangle, HelpCircle } from 'lucide-react';

interface VerificationBadgeProps {
  status: 'VERIFIED' | 'PARTIAL' | 'UNVERIFIED';
  score: number;
  stages: string;
}

export function VerificationBadge({ status, score, stages }: VerificationBadgeProps) {
  const config = {
    VERIFIED: {
      icon: CheckCircle,
      bgColor: 'bg-green-500',
      borderColor: 'border-green-400',
      label: 'Fully Verified',
      sublabel: 'All stages complete',
    },
    PARTIAL: {
      icon: AlertTriangle,
      bgColor: 'bg-amber-500',
      borderColor: 'border-amber-400',
      label: 'Partially Verified',
      sublabel: 'Some stages pending',
    },
    UNVERIFIED: {
      icon: HelpCircle,
      bgColor: 'bg-neutral-500',
      borderColor: 'border-neutral-400',
      label: 'Verification Pending',
      sublabel: 'Data being collected',
    },
  };

  const { icon: Icon, bgColor, borderColor, label, sublabel } = config[status];

  return (
    <div className={`relative inline-flex flex-col items-center rounded-2xl ${bgColor} px-6 py-4 shadow-lg border-2 ${borderColor}`}>
      {/* Animated glow effect for verified */}
      {status === 'VERIFIED' && (
        <div className="absolute inset-0 rounded-2xl bg-green-400 opacity-20 animate-pulse-slow" />
      )}

      <div className="relative flex items-center gap-2">
        <Icon className="h-5 w-5" />
        <span className="text-lg font-bold">{label}</span>
      </div>

      <div className="relative mt-1 flex items-center gap-3 text-sm text-white/80">
        <span>{stages} stages</span>
        <span className="h-1 w-1 rounded-full bg-white/50" />
        <span>{score}% score</span>
      </div>
    </div>
  );
}
