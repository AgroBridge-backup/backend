import { useState, useMemo } from 'react';
import { DashboardLayout } from '@features/dashboard/components/DashboardLayout';
import { LoteCard } from '../components/LoteCard';
import { Search, Filter, Grid3x3, List } from 'lucide-react';
import { useApi } from '@shared/hooks/useApi';
import { fetchLots, mapBackendStatusToFrontend } from '../services/lotsService';
import type { Lote } from '../types';

export default function LotesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode] = useState<'grid' | 'list'>('grid');
  const { data: backendLots, loading, error } = useApi(() => fetchLots(), []);

  // Transform backend lots to frontend format for compatibility with existing components
  const lotes: Lote[] = useMemo(() => {
    if (!backendLots) return [];

    return backendLots.map(lot => ({
      id: lot.id,
      codigo: lot.code,
      productor: {
        id: lot.producerId,
        nombre: `Productor ${lot.producerId}`,
        rfc: '',
        email: '',
        telefono: '',
      },
      producto: lot.crop,
      variedad: lot.crop,
      cantidad: lot.quantity || 0,
      unidad: (lot.unit as 'kg' | 'ton') || 'kg',
      fechaCosecha: lot.harvestedAt,
      fechaRegistro: lot.createdAt,
      status: mapBackendStatusToFrontend(lot.status),
      ubicacion: {
        parcela: 'N/A',
        municipio: 'N/A',
        estado: 'N/A',
      },
      certificaciones: [],
      qrCode: `https://api.qrserver.com/v1/create-qr-code/?data=AB-${lot.code}&size=200x200`,
    }));
  }, [backendLots]);

  const filteredLotes = useMemo(() =>
    lotes.filter(
      (lote) =>
        lote.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lote.producto.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lote.productor.nombre.toLowerCase().includes(searchTerm.toLowerCase())
    ), [lotes, searchTerm]);

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-white text-3xl font-bold mb-2">Gestión de Lotes</h1>
        <p className="text-gray-400">Administra todos los lotes registrados en el sistema</p>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por código, producto o productor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-surface-elevated border border-surface-border rounded-lg text-white placeholder-gray-400 focus:border-primary-500/50 focus:outline-none transition-colors"
          />
        </div>
        <button className="px-4 py-3 bg-surface-elevated border border-surface-border rounded-lg text-gray-300 hover:text-white hover:border-primary-500/30 transition-all flex items-center gap-2">
          <Filter className="w-5 h-5" />
          <span className="hidden md:inline">Filtros</span>
        </button>
        <div className="flex bg-surface-elevated border border-surface-border rounded-lg p-1">
          <button className={`px-3 py-2 rounded ${viewMode === 'grid' ? 'bg-primary-600 text-white' : 'text-gray-400'}`}>
            <Grid3x3 className="w-5 h-5" />
          </button>
          <button className={`px-3 py-2 rounded ${viewMode === 'list' ? 'bg-primary-600 text-white' : 'text-gray-400'}`}>
            <List className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Stats Summary */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-surface-elevated border border-surface-border rounded-lg p-4 h-20 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
          <p className="text-red-500 text-sm">Error al cargar los lotes. Usando datos de respaldo.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
            <p className="text-green-500 text-sm font-medium mb-1">Verificados</p>
            <p className="text-white text-2xl font-bold">{lotes.filter(l => l.status === 'verified').length}</p>
          </div>
          <div className="bg-tech-gold/10 border border-tech-gold/30 rounded-lg p-4">
            <p className="text-tech-gold text-sm font-medium mb-1">Pendientes</p>
            <p className="text-white text-2xl font-bold">{lotes.filter(l => l.status === 'pending').length}</p>
          </div>
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
            <p className="text-red-500 text-sm font-medium mb-1">Rechazados</p>
            <p className="text-white text-2xl font-bold">{lotes.filter(l => l.status === 'rejected').length}</p>
          </div>
          <div className="bg-primary-500/10 border border-primary-500/30 rounded-lg p-4">
            <p className="text-primary-400 text-sm font-medium mb-1">Total</p>
            <p className="text-white text-2xl font-bold">{lotes.length}</p>
          </div>
        </div>
      )}

      {/* Results */}
      <div className="mb-4">
        <p className="text-gray-400 text-sm">
          Mostrando <span className="text-white font-semibold">{filteredLotes.length}</span> lotes
        </p>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-surface-elevated border border-surface-border rounded-2xl p-6 h-64 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredLotes.map((lote, index) => (
              <LoteCard key={lote.id} lote={lote} index={index} />
            ))}
          </div>

          {filteredLotes.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-400">
                {searchTerm ? 'No se encontraron lotes con ese criterio de búsqueda' : 'No hay lotes disponibles'}
              </p>
            </div>
          )}
        </>
      )}
    </DashboardLayout>
  );
}
