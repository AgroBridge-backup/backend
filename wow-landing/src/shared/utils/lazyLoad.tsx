import { lazy, Suspense, ComponentType } from 'react';

/**
 * Lazy load utility with automatic Suspense wrapper
 * Supports both default and named exports
 * Used for code splitting components >50KB
 */

interface LazyLoadOptions {
  fallback?: React.ReactNode;
}

/**
 * Lazy load a component with default export
 */
export function lazyLoad<T extends ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>,
  options?: LazyLoadOptions
): React.FC<React.ComponentProps<T>>;

/**
 * Lazy load a component with named export
 */
export function lazyLoad<T extends ComponentType<any>>(
  importFunc: () => Promise<{ [key: string]: T }>,
  exportName: string,
  options?: LazyLoadOptions
): React.FC<React.ComponentProps<T>>;

export function lazyLoad<T extends ComponentType<any>>(
  importFunc: () => Promise<any>,
  exportNameOrOptions?: string | LazyLoadOptions,
  optionsArg?: LazyLoadOptions
) {
  const isNamedExport = typeof exportNameOrOptions === 'string';
  const exportName = isNamedExport ? exportNameOrOptions : undefined;
  const options = isNamedExport ? optionsArg : exportNameOrOptions;

  const LazyComponent = lazy(() =>
    importFunc().then((mod) => {
      if (exportName) {
        // Named export: wrap in default
        return { default: mod[exportName] };
      }
      // Default export: use as-is
      return mod;
    })
  );

  const { fallback = <LoadingFallback /> } = options || {};

  return function LazyWrapper(props: React.ComponentProps<T>) {
    return (
      <Suspense fallback={fallback}>
        <LazyComponent {...props} />
      </Suspense>
    );
  };
}

/**
 * Default loading fallback
 * Minimal HTML to avoid layout shift
 */
function LoadingFallback() {
  return (
    <div
      className="min-h-screen bg-surface-base flex items-center justify-center"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-primary-500/20 border-t-primary-500 rounded-full animate-spin" />
        <p className="text-gray-400 text-sm">Cargando...</p>
      </div>
    </div>
  );
}
