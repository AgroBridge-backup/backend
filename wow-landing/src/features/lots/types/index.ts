/**
 * Lots Feature Types
 * Type definitions specific to the lots/lotes feature
 */

// ============================================================================
// ENUMS & UNIONS
// ============================================================================

export type LoteStatus = 'verified' | 'pending' | 'rejected';
export type Unit = 'kg' | 'ton';
export type EventType = 'siembra' | 'certificacion' | 'cosecha' | 'empaque' | 'blockchain' | 'envio';
export type EventStatus = 'completed' | 'current' | 'pending';

// ============================================================================
// CORE ENTITIES
// ============================================================================

export interface Productor {
  id: string;
  nombre: string;
  rfc: string;
  email: string;
  telefono: string;
  direccion?: string;
  municipio?: string;
  estado?: string;
  certificaciones?: string[];
  fechaRegistro?: string;
}

export interface Ubicacion {
  parcela: string;
  municipio: string;
  estado: string;
  coordenadas?: {
    lat: number;
    lng: number;
  };
}

export interface Lote {
  id: string;
  codigo: string;
  productor: Productor;
  producto: string;
  variedad?: string;
  cantidad: number;
  unidad: Unit;
  fechaCosecha: string;
  fechaRegistro: string;
  status: LoteStatus;
  ubicacion: Ubicacion;
  certificaciones: string[];
  blockchainHash?: string;
  qrCode?: string;
  notas?: string;
}

// ============================================================================
// TIMELINE & TRACEABILITY
// ============================================================================

export interface TimelineEvent {
  id: string;
  titulo: string;
  descripcion: string;
  timestamp: string;
  status: EventStatus;
  tipo: EventType;
  metadata?: Record<string, unknown>;
  responsable?: string;
  ubicacion?: string;
}

// ============================================================================
// FILTERS & SORTING
// ============================================================================

export interface LotesFilter {
  search: string;
  status: LoteStatus | 'all';
  productor: string | 'all';
  producto: string | 'all';
  dateFrom?: string;
  dateTo?: string;
}

export interface SortConfig {
  key: keyof Lote;
  direction: 'asc' | 'desc';
}

// ============================================================================
// FORM DATA
// ============================================================================

export interface LoteFormData {
  codigo: string;
  productorId: string;
  producto: string;
  variedad?: string;
  cantidad: number;
  unidad: Unit;
  fechaCosecha: string;
  parcela: string;
  municipio: string;
  estado: string;
  certificaciones: string[];
  notas?: string;
}

// ============================================================================
// BACKEND API TYPES
// ============================================================================

export type BackendLotStatus = 'PENDING' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED';

export interface BackendLot {
  id: string;
  code: string;
  crop: string;
  status: BackendLotStatus;
  producerId: string;
  harvestedAt: string;
  createdAt: string;
  updatedAt: string;
  quantity?: number;
  unit?: string;
}
