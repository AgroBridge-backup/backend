import { TimelineEvent } from '../types';
import { useGSAP } from '@/hooks/useGSAP';
import { gsap } from 'gsap';
import { Sprout, Shield, Scissors, Package, Link, Truck, CheckCircle, Clock, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TraceabilityTimelineProps {
  events: TimelineEvent[];
}

const iconMap = {
  siembra: Sprout,
  certificacion: Shield,
  cosecha: Scissors,
  empaque: Package,
  blockchain: Link,
  envio: Truck,
};

const statusConfig = {
  completed: {
    icon: CheckCircle,
    color: 'text-green-500',
    bg: 'bg-green-500/10',
    border: 'border-green-500/30',
  },
  current: {
    icon: Clock,
    color: 'text-tech-gold',
    bg: 'bg-tech-gold/10',
    border: 'border-tech-gold/30',
  },
  pending: {
    icon: XCircle,
    color: 'text-gray-500',
    bg: 'bg-gray-500/10',
    border: 'border-gray-500/30',
  },
};

export function TraceabilityTimeline({ events }: TraceabilityTimelineProps) {
  useGSAP(() => {
    const tl = gsap.timeline();

    tl.from('.timeline-line', {
      scaleY: 0,
      transformOrigin: 'top',
      duration: 1,
      ease: 'power2.out',
    })
    .from('.timeline-event', {
      x: -30,
      opacity: 0,
      stagger: 0.15,
      duration: 0.5,
      ease: 'power2.out',
    }, '-=0.5');
  }, []);

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary-500 via-primary-600 to-primary-700 timeline-line" />

      {/* Events */}
      <div className="space-y-8">
        {events.map((event, index) => {
          const Icon = iconMap[event.tipo];
          const statusCfg = statusConfig[event.status];
          const StatusIcon = statusCfg.icon;

          return (
            <div key={event.id} className="timeline-event relative pl-16">
              {/* Icon circle */}
              <div
                className={cn(
                  'absolute left-0 w-12 h-12 rounded-full border-2 flex items-center justify-center',
                  statusCfg.bg,
                  statusCfg.border,
                  event.status === 'current' && 'animate-pulse'
                )}
              >
                <Icon className={cn('w-6 h-6', statusCfg.color)} />
              </div>

              {/* Content */}
              <div className="bg-surface-elevated border border-surface-border rounded-xl p-4 hover:border-primary-500/30 transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="text-white font-semibold text-lg">{event.titulo}</h4>
                    <p className="text-gray-400 text-sm mt-1">{event.descripcion}</p>
                  </div>
                  <div className={cn('flex items-center gap-1.5 px-2 py-1 rounded', statusCfg.bg)}>
                    <StatusIcon className={cn('w-4 h-4', statusCfg.color)} />
                    <span className={cn('text-xs font-medium capitalize', statusCfg.color)}>
                      {event.status === 'completed' ? 'Completado' : event.status === 'current' ? 'En proceso' : 'Pendiente'}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-gray-400">
                  {event.timestamp && (
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4" />
                      {new Date(event.timestamp).toLocaleString('es-MX', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </div>
                  )}
                  {event.responsable && (
                    <div>
                      <span className="text-gray-500">Por:</span> {event.responsable}
                    </div>
                  )}
                  {event.ubicacion && (
                    <div>
                      <span className="text-gray-500">Ubicación:</span> {event.ubicacion}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
