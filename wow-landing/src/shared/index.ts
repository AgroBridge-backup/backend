/**
 * Shared Code - Public API
 * Code used by 2+ features
 */

// UI Components
export { ThemeToggle } from './components/ui/ThemeToggle';
export { StatCard } from './components/ui/StatCard';
export { Badge } from './components/ui/Badge';
export { GlassCard } from './components/ui/GlassCard';
export { GlowButton } from './components/ui/GlowButton';

// Layout Components
export { LoadingScreen } from './components/layout/LoadingScreen';
export { GlassMorphUI } from './components/layout/GlassMorphUI';

// Hooks
export { useApi } from './hooks/useApi';
export { usePerformanceMonitor } from './hooks/usePerformanceMonitor';

// Lib
export { apiRequest, get, post, put, patch, del } from './lib/apiClient';
export type { ApiError, ApiRequestOptions } from './lib/apiClient';
export { cn } from './lib/utils';

// Types
export type {
  Status,
  ViewMode,
  Theme,
  TrendDirection,
  StatColor,
  StatCard,
  ChartDataPoint,
  ActivityLog,
  ModalState,
  ToastMessage,
  ThemeContextType,
  AuthContextType,
  User,
  Certificate,
  CertificateType,
  CertificateStatus,
  Order,
  OrderStatus,
} from './types';

// Contexts
export { ThemeProvider, useTheme } from './contexts/ThemeContext';

// Utils
export { lazyLoad } from './utils/lazyLoad';

// Config
export { API_BASE_URL, API_TIMEOUT_MS, API_ENDPOINTS } from './config/api';
