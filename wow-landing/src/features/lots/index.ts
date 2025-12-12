/**
 * Lots Feature - Public API
 * This is the only file that should be imported by other features
 */

// Pages
export { default as LotesPage } from './pages/LotesPage';
export { default as LoteDetailPage } from './pages/LoteDetailPage';

// Components
export { LoteCard } from './components/LoteCard';
export { QrScanner } from './components/QrScanner';
// Note: TraceabilityTimeline is internal to LoteDetailPage, not exported

// Services
export { fetchLots, fetchLotById, fetchLotCertificates, mapBackendStatusToFrontend } from './services/lotsService';

// Types
export type { Lote, LoteStatus, Productor, Ubicacion, TimelineEvent, BackendLot } from './types';
