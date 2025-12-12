import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { mockChartData } from '@/data/mockStats';
import { GlassCard } from '/components/ui/GlassCard';
import { TrendingUp } from 'lucide-react';

// Custom tooltip
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-surface-elevated border border-primary-500/30 rounded-lg p-3 shadow-glow-md">
        <p className="text-gray-400 text-sm mb-1">{payload[0].payload.mes}</p>
        <p className="text-white text-lg font-bold">
          {payload[0].value.toLocaleString()} <span className="text-sm font-normal text-gray-400">kg</span>
        </p>
      </div>
    );
  }
  return null;
};

export function ProductionChart() {
  return (
    <GlassCard variant="premium" padding="lg" className="col-span-full lg:col-span-2">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-white text-xl font-bold mb-1">Producción Mensual</h3>
          <p className="text-gray-400 text-sm">Volumen total de lotes verificados (kg)</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/30">
          <TrendingUp className="w-4 h-4 text-green-500" />
          <span className="text-green-500 text-sm font-semibold">+24.5%</span>
        </div>
      </div>

      {/* Chart */}
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={mockChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#059669" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#059669" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
            <XAxis
              dataKey="mes"
              stroke="#6B7280"
              tick={{ fill: '#9CA3AF' }}
              tickLine={{ stroke: '#404040' }}
            />
            <YAxis
              stroke="#6B7280"
              tick={{ fill: '#9CA3AF' }}
              tickLine={{ stroke: '#404040' }}
              tickFormatter={(value) => `${(value / 1000).toFixed(1)}K`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#059669"
              strokeWidth={2}
              fill="url(#colorValue)"
              animationDuration={1500}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </GlassCard>
  );
}
