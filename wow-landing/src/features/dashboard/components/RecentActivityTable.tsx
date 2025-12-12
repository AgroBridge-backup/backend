import { motion } from 'framer-motion';
import { mockActivityLogs } from '@/data/mockStats';
import { GlassCard } from '/components/ui/GlassCard';
import { Badge } from '/components/ui/Badge';
import { Eye, Edit, Trash2, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

// Type badge mapping
const typeBadgeMap = {
  create: { variant: 'primary' as const, label: 'Creado' },
  update: { variant: 'gold' as const, label: 'Actualizado' },
  delete: { variant: 'error' as const, label: 'Eliminado' },
  verify: { variant: 'verified' as const, label: 'Verificado' },
};

// Format relative time
const formatRelativeTime = (timestamp: string) => {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));

  if (hours < 1) {
    const minutes = Math.floor(diff / (1000 * 60));
    return `Hace ${minutes}m`;
  }
  if (hours < 24) return `Hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Hace ${days}d`;
};

export function RecentActivityTable() {
  return (
    <GlassCard variant="premium" padding="lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-white text-xl font-bold mb-1">Actividad Reciente</h3>
          <p className="text-gray-400 text-sm">Últimas acciones en el sistema</p>
        </div>
        <button className="text-primary-400 hover:text-primary-300 text-sm font-medium transition-colors">
          Ver todo →
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-surface-border">
              <th className="text-left text-gray-400 text-sm font-medium pb-3">Acción</th>
              <th className="text-left text-gray-400 text-sm font-medium pb-3">Usuario</th>
              <th className="text-left text-gray-400 text-sm font-medium pb-3">Tipo</th>
              <th className="text-left text-gray-400 text-sm font-medium pb-3">Hora</th>
              <th className="text-right text-gray-400 text-sm font-medium pb-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {mockActivityLogs.slice(0, 8).map((log, index) => {
              const badge = typeBadgeMap[log.tipo];
              return (
                <motion.tr
                  key={log.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05, duration: 0.3 }}
                  className={cn(
                    'border-b border-surface-border/50 hover:bg-surface-overlay/30 transition-colors group'
                  )}
                >
                  <td className="py-4 pr-4">
                    <p className="text-white text-sm font-medium">{log.accion}</p>
                    <p className="text-gray-400 text-xs mt-0.5">
                      {log.entidad} • {log.entidadId}
                    </p>
                  </td>
                  <td className="py-4 pr-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-600 to-primary-700 flex items-center justify-center text-xs text-white font-semibold">
                        {log.usuario.split(' ').map(n => n[0]).join('')}
                      </div>
                      <span className="text-gray-300 text-sm">{log.usuario}</span>
                    </div>
                  </td>
                  <td className="py-4 pr-4">
                    <Badge variant={badge.variant} size="sm">
                      {badge.label}
                    </Badge>
                  </td>
                  <td className="py-4 pr-4">
                    <div className="flex items-center gap-1.5 text-gray-400 text-sm">
                      <Clock className="w-3.5 h-3.5" />
                      {formatRelativeTime(log.timestamp)}
                    </div>
                  </td>
                  <td className="py-4">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-1.5 rounded hover:bg-surface-elevated text-gray-400 hover:text-primary-400 transition-colors">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button className="p-1.5 rounded hover:bg-surface-elevated text-gray-400 hover:text-primary-400 transition-colors">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button className="p-1.5 rounded hover:bg-surface-elevated text-gray-400 hover:text-red-400 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </GlassCard>
  );
}
