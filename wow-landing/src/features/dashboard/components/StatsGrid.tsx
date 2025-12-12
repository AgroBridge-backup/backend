import { StatCard } from '@shared/components/ui/StatCard';
import { CheckCircle2, Clock, Users, TrendingUp, Award, Target, AlertCircle } from 'lucide-react';
import { useApi } from '@shared/hooks/useApi';
import { fetchLots, mapBackendStatusToFrontend } from '@features/lots/services/lotsService';
import { useMemo } from 'react';

// Icon mapping
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  CheckCircle2,
  Clock,
  Users,
  TrendingUp,
  Award,
  Target,
};

export function StatsGrid() {
  const { data: lots, loading, error, refetch } = useApi(() => fetchLots(), []);

  const stats = useMemo(() => {
    if (!lots || lots.length === 0) {
      return [
        { label: 'Total Lotes', value: 0, suffix: '', prefix: '', change: 0, trend: 'neutral' as const, icon: 'Target' },
        { label: 'Verificados', value: 0, suffix: '', prefix: '', change: 0, trend: 'up' as const, icon: 'CheckCircle2' },
        { label: 'Pendientes', value: 0, suffix: '', prefix: '', change: 0, trend: 'neutral' as const, icon: 'Clock' },
        { label: 'En Tránsito', value: 0, suffix: '', prefix: '', change: 0, trend: 'up' as const, icon: 'TrendingUp' },
        { label: 'Certificaciones', value: 0, suffix: '', prefix: '', change: 0, trend: 'up' as const, icon: 'Award' },
        { label: 'Productores', value: 0, suffix: '', prefix: '', change: 0, trend: 'up' as const, icon: 'Users' },
      ];
    }

    // Single-pass calculation for efficiency
    const counts = lots.reduce((acc, lot) => {
      const status = mapBackendStatusToFrontend(lot.status);
      acc.statusCounts[status]++;
      if (lot.status === 'IN_TRANSIT') acc.inTransit++;
      acc.producerIds.add(lot.producerId);
      return acc;
    }, {
      statusCounts: { verified: 0, pending: 0, rejected: 0 },
      inTransit: 0,
      producerIds: new Set<string>(),
    });

    const totalLotes = lots.length;
    const verificados = counts.statusCounts.verified;
    const pendientes = counts.statusCounts.pending;
    const enTransito = counts.inTransit;
    const uniqueProducers = counts.producerIds.size;

    // Note: Trend percentages are mocked - calculate from historical data in production
    return [
      { label: 'Total Lotes', value: totalLotes, suffix: '', prefix: '', change: 12, trend: 'up' as const, icon: 'Target' },
      { label: 'Verificados', value: verificados, suffix: '', prefix: '', change: 8, trend: 'up' as const, icon: 'CheckCircle2' },
      { label: 'Pendientes', value: pendientes, suffix: '', prefix: '', change: 5, trend: 'neutral' as const, icon: 'Clock' },
      { label: 'En Tránsito', value: enTransito, suffix: '', prefix: '', change: 15, trend: 'up' as const, icon: 'TrendingUp' },
      { label: 'Certificaciones', value: verificados * 2, suffix: '', prefix: '', change: 10, trend: 'up' as const, icon: 'Award' }, // TODO: Fetch real certificate count
      { label: 'Productores', value: uniqueProducers, suffix: '', prefix: '', change: 3, trend: 'up' as const, icon: 'Users' },
    ];
  }, [lots]);

  // Loading state
  if (loading) {
    return (
      <div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        role="status"
        aria-label="Cargando estadísticas"
      >
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="bg-surface-elevated border border-surface-border rounded-2xl p-6 h-32 animate-pulse"
            aria-hidden="true"
          />
        ))}
      </div>
    );
  }

  // Error state with retry
  if (error) {
    console.error('Error loading stats:', error);
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6" role="alert">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex-1">
            <h3 className="text-red-500 font-semibold mb-1">Error al Cargar Estadísticas</h3>
            <p className="text-red-400 text-sm mb-3">
              {error.message || 'No se pudieron cargar las estadísticas del backend.'}
            </p>
            <button
              onClick={() => refetch()}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors font-medium"
            >
              Reintentar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Success state with data
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {stats.map((stat) => {
        const IconComponent = iconMap[stat.icon] || Users;
        return (
          <StatCard
            key={stat.label}
            label={stat.label}
            value={stat.value}
            suffix={stat.suffix}
            prefix={stat.prefix}
            trend={stat.trend}
            trendValue={`${stat.change > 0 ? '+' : ''}${stat.change}%`}
            icon={<IconComponent className="w-6 h-6" />}
            variant="primary"
          />
        );
      })}
    </div>
  );
}
