import { DashboardLayout } from '../components/DashboardLayout';
import { StatsGrid } from '../components/StatsGrid';
import { RecentActivityTable } from '../components/RecentActivityTable';
import { lazyLoad } from '@/utils/lazyLoad';

// Lazy load ProductionChart (uses Recharts - heavy charting library ~100KB)
const ProductionChart = lazyLoad(() => import('@/components/dashboard/ProductionChart').then(m => ({ default: m.ProductionChart })), {
  fallback: <div className="lg:col-span-2 bg-surface-elevated border border-surface-border rounded-2xl p-6 h-80 flex items-center justify-center"><div className="animate-pulse text-gray-400">Cargando gráfica...</div></div>
});

export default function DashboardPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Stats Grid */}
        <StatsGrid />

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <ProductionChart />

          {/* Quick Stats Card */}
          <div className="bg-gradient-to-br from-primary-600/10 to-primary-700/5 border border-primary-500/20 rounded-2xl p-6 backdrop-blur-sm">
            <h3 className="text-white text-lg font-bold mb-4">Resumen Rápido</h3>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400 text-sm">Tasa de Verificación</span>
                  <span className="text-white font-semibold">94%</span>
                </div>
                <div className="h-2 bg-surface-muted rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-primary-600 to-primary-700 w-[94%] rounded-full" />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400 text-sm">Certificaciones</span>
                  <span className="text-white font-semibold">87%</span>
                </div>
                <div className="h-2 bg-surface-muted rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-tech-cyan to-blue-500 w-[87%] rounded-full" />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400 text-sm">Calidad Promedio</span>
                  <span className="text-white font-semibold">96%</span>
                </div>
                <div className="h-2 bg-surface-muted rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-tech-gold to-tech-amber w-[96%] rounded-full" />
                </div>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-surface-border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400 text-sm">Próxima cosecha</span>
                <span className="text-tech-electric text-xs font-semibold">En 3 días</span>
              </div>
              <p className="text-white text-sm font-medium">Lote AVT-2024-013</p>
              <p className="text-gray-400 text-xs">Aguacate Hass • 2,800 kg estimados</p>
            </div>
          </div>
        </div>

        {/* Activity Table */}
        <RecentActivityTable />
      </div>
    </DashboardLayout>
  );
}
