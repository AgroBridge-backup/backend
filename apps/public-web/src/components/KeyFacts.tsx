'use client';

import {
  Calendar,
  MapPin,
  Scale,
  Award,
  Leaf,
  Thermometer,
  Truck,
  Fingerprint,
} from 'lucide-react';

interface KeyFact {
  icon: string;
  label: string;
  value: string;
  highlight?: boolean;
}

interface KeyFactsProps {
  facts: KeyFact[];
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  calendar: Calendar,
  location: MapPin,
  weight: Scale,
  award: Award,
  leaf: Leaf,
  temperature: Thermometer,
  truck: Truck,
  seal: Fingerprint,
};

export function KeyFacts({ facts }: KeyFactsProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {facts.slice(0, 4).map((fact, index) => {
        const Icon = iconMap[fact.icon] || Leaf;

        return (
          <div
            key={fact.label}
            className={`key-fact animate-in stagger-${index + 1} ${
              fact.highlight ? 'bg-primary-50 ring-1 ring-primary-200' : ''
            }`}
          >
            <Icon className={`mb-2 h-5 w-5 ${fact.highlight ? 'text-primary-600' : 'text-neutral-400'}`} />
            <span className="text-xs text-neutral-500">{fact.label}</span>
            <span className={`mt-0.5 font-semibold ${fact.highlight ? 'text-primary-700' : 'text-neutral-900'}`}>
              {fact.value}
            </span>
          </div>
        );
      })}
    </div>
  );
}
