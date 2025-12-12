/**
 * Centralized TypeScript Interfaces for AgroBridge
 * All type definitions for the application
 */

// ============================================================================
// ENUMS & UNIONS
// ============================================================================

export type Status = 'verified' | 'pending' | 'rejected';
export type ViewMode = 'grid' | 'list';
export type Theme = 'light' | 'dark';
export type TrendDirection = 'up' | 'down' | 'neutral';
export type StatColor = 'primary' | 'cyan' | 'gold' | 'success' | 'danger';
export type EventType = 'siembra' | 'certificacion' | 'cosecha' | 'empaque' | 'blockchain' | 'envio';
export type EventStatus = 'completed' | 'current' | 'pending';
export type Unit = 'kg' | 'ton';

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
  status: Status;
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
// DASHBOARD & STATS
// ============================================================================

export interface StatCard {
  label: string;
  value: number;
  suffix?: string;
  prefix?: string;
  change: number;
  trend: TrendDirection;
  icon: string;
  color: StatColor;
}

export interface ChartDataPoint {
  mes: string;
  value: number;
  label?: string;
}

export interface ActivityLog {
  id: string;
  accion: string;
  usuario: string;
  timestamp: string;
  tipo: 'create' | 'update' | 'delete' | 'verify';
  entidad: 'lote' | 'productor' | 'certificacion';
  entidadId: string;
}

// ============================================================================
// FILTERS & SORTING
// ============================================================================

export interface LotesFilter {
  search: string;
  status: Status | 'all';
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
// UI STATE
// ============================================================================

export interface ModalState {
  isOpen: boolean;
  mode: 'create' | 'edit';
  data?: Partial<Lote>;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
}

// ============================================================================
// CONTEXT TYPES
// ============================================================================

export interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

export interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

export interface User {
  id: string;
  nombre: string;
  email: string;
  rol: 'admin' | 'productor' | 'verificador';
  avatar?: string;
}

// ============================================================================
// BACKEND API TYPES (Certificates & Orders)
// ============================================================================

export type CertificateType =
  | 'ORGANIC'
  | 'FAIR_TRADE'
  | 'RAINFOREST_ALLIANCE'
  | 'GLOBALGAP'
  | 'BLOCKCHAIN_PROOF'
  | 'CO2_FOOTPRINT'
  | 'QUALITY_ASSURANCE';

export type CertificateStatus = 'PENDING' | 'ISSUED' | 'REVOKED';

export interface Certificate {
  id: string;
  lotId: string;
  type: CertificateType;
  status: CertificateStatus;
  issuedAt: string;
  issuer: string;
  blockchainTxHash?: string;
  expiresAt?: string;
  metadata?: Record<string, unknown>;
}

export type OrderStatus = 'CREATED' | 'CONFIRMED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';

export interface Order {
  id: string;
  lotId: string;
  buyerName: string;
  destinationCountry: string;
  status: OrderStatus;
  createdAt: string;
  updatedAt?: string;
  shippedAt?: string;
  deliveredAt?: string;
  quantity?: number;
  unitPrice?: number;
  totalPrice?: number;
}

// Backend Lot Type (might differ from frontend Lote)
export type LotStatus = 'PENDING' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED';

export interface BackendLot {
  id: string;
  code: string;
  crop: string;
  status: LotStatus;
  producerId: string;
  harvestedAt: string;
  createdAt: string;
  updatedAt: string;
  quantity?: number;
  unit?: string;
}
