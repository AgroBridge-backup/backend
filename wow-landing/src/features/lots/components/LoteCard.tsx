import { motion } from 'framer-motion';
import { Lote } from '../types';
import { Badge } from '@shared/components/ui/Badge';
import { MapPin, Calendar, Package, Shield, Eye } from 'lucide-react';
import { cn } from '@shared/lib/utils';

interface LoteCardProps {
  lote: Lote;
  index: number;
}

const statusConfig = {
  verified: { variant: 'verified' as const, label: 'Verificado' },
  pending: { variant: 'gold' as const, label: 'Pendiente' },
  rejected: { variant: 'error' as const, label: 'Rechazado' },
};

export function LoteCard({ lote, index }: LoteCardProps) {
  const status = statusConfig[lote.status];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="bg-surface-elevated border border-surface-border rounded-2xl p-6 hover:border-primary-500/30 hover:shadow-glow-sm transition-all duration-300 group cursor-pointer"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-white font-bold text-lg mb-1">{lote.codigo}</h3>
          <p className="text-gray-400 text-sm">{lote.producto}</p>
        </div>
        <Badge variant={status.variant} size="sm">
          {status.label}
        </Badge>
      </div>

      {/* Details */}
      <div className="space-y-3 mb-4">
        <div className="flex items-center gap-2 text-gray-300 text-sm">
          <Package className="w-4 h-4 text-primary-400" />
          <span>{lote.cantidad} {lote.unidad}</span>
        </div>
        <div className="flex items-center gap-2 text-gray-300 text-sm">
          <MapPin className="w-4 h-4 text-primary-400" />
          <span>{lote.ubicacion.municipio}, {lote.ubicacion.estado}</span>
        </div>
        <div className="flex items-center gap-2 text-gray-300 text-sm">
          <Calendar className="w-4 h-4 text-primary-400" />
          <span>{new Date(lote.fechaCosecha).toLocaleDateString('es-MX')}</span>
        </div>
      </div>

      {/* Certifications */}
      {lote.certificaciones.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-1 mb-2">
            <Shield className="w-3.5 h-3.5 text-tech-gold" />
            <span className="text-xs text-gray-400">Certificaciones</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {lote.certificaciones.map((cert) => (
              <span
                key={cert}
                className="px-2 py-1 bg-tech-gold/10 border border-tech-gold/30 rounded text-xs text-tech-gold"
              >
                {cert}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Producer */}
      <div className="pt-4 border-t border-surface-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-600 to-primary-700 flex items-center justify-center text-xs text-white font-semibold">
              {lote.productor.nombre.split(' ').map(n => n[0]).join('').slice(0, 2)}
            </div>
            <div>
              <p className="text-white text-sm font-medium">{lote.productor.nombre}</p>
              <p className="text-gray-400 text-xs">{lote.productor.rfc}</p>
            </div>
          </div>
          <button className="p-2 rounded-lg bg-surface-overlay border border-surface-border text-primary-400 opacity-0 group-hover:opacity-100 transition-opacity">
            <Eye className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Blockchain indicator */}
      {lote.blockchainHash && (
        <div className="mt-3 pt-3 border-t border-surface-border">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">Blockchain</span>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-tech-electric animate-pulse" />
              <span className="text-xs text-tech-electric font-mono">
                {lote.blockchainHash.slice(0, 10)}...
              </span>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
