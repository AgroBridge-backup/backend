import { DashboardLayout } from '@features/dashboard/components/DashboardLayout';
import { TraceabilityTimeline } from '../components/TraceabilityTimeline';
import { Badge } from '@shared/components/ui/Badge';
// import { mockLotes } from '@/data/mockLotes'; // TODO: Remove - mock data deleted
// import { mockTimelineLote001, createMockTimeline } from '@/data/mockTimeline'; // TODO: Remove - mock data deleted
import { ArrowLeft, MapPin, Calendar, Package, User, Shield, QrCode, Link as LinkIcon } from 'lucide-react';

export default function LoteDetailPage() {
  // TODO: Implement backend integration - fetch lot by ID from URL params
  // Using placeholder data until backend integration
  const lote = {
    id: 'placeholder-001',
    codigo: 'PLACEHOLDER-001',
    producto: 'Placeholder Product',
    status: 'pending' as const,
    productor: { id: '1', nombre: 'Placeholder Producer', rfc: '', email: '', telefono: '' },
    ubicacion: { parcela: 'N/A', municipio: 'N/A', estado: 'N/A' },
    cantidad: 0,
    unidad: 'kg' as const,
    fechaCosecha: new Date().toISOString(),
    fechaRegistro: new Date().toISOString(),
    certificaciones: [],
  };
  const timeline: any[] = []; // Empty timeline until backend integration

  const statusConfig = {
    verified: { variant: 'verified' as const, label: 'Verificado' },
    pending: { variant: 'gold' as const, label: 'Pendiente' },
    rejected: { variant: 'error' as const, label: 'Rechazado' },
  };

  const status = statusConfig[lote.status];

  return (
    <DashboardLayout>
      {/* Back button */}
      <button className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-6">
        <ArrowLeft className="w-5 h-5" />
        <span>Volver a lotes</span>
      </button>

      {/* Header */}
      <div className="bg-surface-elevated border border-surface-border rounded-2xl p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-white text-3xl font-bold">{lote.codigo}</h1>
              <Badge variant={status.variant} size="lg">{status.label}</Badge>
            </div>
            <p className="text-gray-400 text-lg">{lote.producto} {lote.variedad && `• ${lote.variedad}`}</p>
          </div>
          <button className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium">
            Editar Lote
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary-500/10 flex items-center justify-center">
              <Package className="w-5 h-5 text-primary-400" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Cantidad</p>
              <p className="text-white font-semibold">{lote.cantidad} {lote.unidad}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-tech-cyan/10 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-tech-cyan" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Cosecha</p>
              <p className="text-white font-semibold">{new Date(lote.fechaCosecha).toLocaleDateString('es-MX')}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-tech-gold/10 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-tech-gold" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Ubicación</p>
              <p className="text-white font-semibold">{lote.ubicacion.municipio}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-tech-electric/10 flex items-center justify-center">
              <User className="w-5 h-5 text-tech-electric" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Productor</p>
              <p className="text-white font-semibold">{lote.productor.nombre.split(' ')[0]}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Traceability Timeline */}
        <div className="lg:col-span-2 bg-surface-elevated border border-surface-border rounded-2xl p-6">
          <h2 className="text-white text-xl font-bold mb-6">Trazabilidad Completa</h2>
          <TraceabilityTimeline events={timeline} />
        </div>

        {/* Info Sidebar */}
        <div className="space-y-6">
          {/* QR Code */}
          {lote.qrCode && (
            <div className="bg-surface-elevated border border-surface-border rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <QrCode className="w-5 h-5 text-primary-400" />
                <h3 className="text-white font-bold">Código QR</h3>
              </div>
              <div className="bg-white rounded-lg p-4 flex items-center justify-center">
                <img src={lote.qrCode} alt="QR Code" className="w-40 h-40" />
              </div>
            </div>
          )}

          {/* Blockchain */}
          {lote.blockchainHash && (
            <div className="bg-surface-elevated border border-primary-500/20 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <LinkIcon className="w-5 h-5 text-tech-electric" />
                <h3 className="text-white font-bold">Blockchain</h3>
              </div>
              <div className="space-y-2">
                <div>
                  <p className="text-gray-400 text-xs mb-1">Hash</p>
                  <p className="text-white font-mono text-xs break-all">{lote.blockchainHash}</p>
                </div>
                <button className="w-full mt-3 px-3 py-2 bg-tech-electric/10 border border-tech-electric/30 text-tech-electric rounded-lg text-sm font-medium hover:bg-tech-electric/20 transition-colors">
                  Ver en Explorador
                </button>
              </div>
            </div>
          )}

          {/* Certifications */}
          {lote.certificaciones.length > 0 && (
            <div className="bg-surface-elevated border border-surface-border rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="w-5 h-5 text-tech-gold" />
                <h3 className="text-white font-bold">Certificaciones</h3>
              </div>
              <div className="space-y-2">
                {lote.certificaciones.map((cert) => (
                  <div key={cert} className="flex items-center justify-between px-3 py-2 bg-tech-gold/10 border border-tech-gold/30 rounded-lg">
                    <span className="text-tech-gold text-sm font-medium">{cert}</span>
                    <span className="text-xs text-gray-400">Activa</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
