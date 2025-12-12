# 🏗️ AgroBridge Frontend Architecture

**Last Updated**: December 2, 2025
**Version**: 2.1 (Feature-Based Architecture)

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Folder Structure](#folder-structure)
3. [Architecture Principles](#architecture-principles)
4. [Feature Modules](#feature-modules)
5. [Shared Code](#shared-code)
6. [Import Rules](#import-rules)
7. [Adding New Features](#adding-new-features)
8. [Best Practices](#best-practices)
9. [Path Aliases](#path-aliases)

---

## Overview

This project uses a **feature-based architecture** instead of the traditional file-type organization. Each business domain (feature) is self-contained with its own components, hooks, services, and types.

### Why Feature-Based Architecture?

✅ **Better Scalability** - Add new features without touching existing code
✅ **Clear Boundaries** - Easy to understand what belongs where
✅ **Team Collaboration** - Multiple developers can work on different features without conflicts
✅ **Easier Testing** - Test entire features in isolation
✅ **Better Colocation** - Related code lives together

---

## Folder Structure

```
src/
├── features/                    # Feature modules (business domains)
│   ├── lots/                   # Lotes/Lots management feature
│   │   ├── components/         # Lots-specific components
│   │   │   ├── LoteCard.tsx
│   │   │   ├── TraceabilityTimeline.tsx
│   │   │   └── QrScanner.tsx
│   │   ├── hooks/              # Lots-specific hooks
│   │   ├── services/           # Lots API services
│   │   │   └── lotsService.ts
│   │   ├── types/              # Lots-specific types
│   │   │   └── index.ts
│   │   ├── pages/              # Lots route components
│   │   │   ├── LotesPage.tsx
│   │   │   └── LoteDetailPage.tsx
│   │   └── index.ts            # Public API (barrel file)
│   │
│   ├── dashboard/              # Dashboard feature
│   │   ├── components/
│   │   │   ├── StatsGrid.tsx
│   │   │   ├── RecentActivityTable.tsx
│   │   │   ├── ProductionChart.tsx
│   │   │   └── DashboardLayout.tsx
│   │   ├── pages/
│   │   │   └── DashboardPage.tsx
│   │   └── index.ts
│   │
│   ├── landing/                # Landing page feature
│   │   ├── components/
│   │   │   ├── Background.tsx
│   │   │   ├── WebglLanding.tsx
│   │   │   ├── DataParticles.tsx
│   │   │   ├── NodosFibonacci.tsx
│   │   │   └── InteractiveDemo.tsx
│   │   ├── hooks/
│   │   │   ├── useFibonacciNodes.ts
│   │   │   └── useOrganicBreath.ts
│   │   ├── shaders/            # WebGL shaders for landing
│   │   └── index.ts
│   │
│   ├── certificates/           # Certificates feature (future)
│   └── producers/              # Producers feature (future)
│
├── shared/                     # Shared code (used by 2+ features)
│   ├── components/
│   │   ├── ui/                # Reusable UI primitives
│   │   │   ├── StatCard.tsx
│   │   │   ├── ThemeToggle.tsx
│   │   │   ├── Button.tsx
│   │   │   ├── Badge.tsx
│   │   │   └── GlassCard.tsx
│   │   └── layout/            # Layout components
│   │       ├── LoadingScreen.tsx
│   │       └── GlassMorphUI.tsx
│   ├── hooks/                 # Shared React hooks
│   │   ├── useApi.ts          # Generic API fetching hook
│   │   └── usePerformanceMonitor.ts
│   ├── lib/                   # Shared utilities & libraries
│   │   └── apiClient.ts       # HTTP client
│   ├── types/                 # Shared TypeScript types
│   │   └── index.ts
│   ├── contexts/              # React contexts
│   │   └── ThemeContext.tsx
│   ├── utils/                 # Utility functions
│   │   └── lazyLoad.tsx
│   ├── config/                # App configuration
│   │   └── api.ts
│   └── index.ts               # Shared public API
│
├── assets/                     # Static assets (images, fonts)
├── App.tsx                     # Root app component
└── main.tsx                    # Entry point
```

---

## Architecture Principles

### 1. **Feature Independence**
Each feature should be as self-contained as possible.

✅ **Good**: Lots feature has its own `lotsService.ts` and `Lote` types
❌ **Bad**: Lots components directly importing from Dashboard feature

### 2. **Shared Code Rule**
Code moves to `shared/` when used by **2 or more** features.

✅ **Good**: `useApi` hook used by lots, dashboard, and certificates → `shared/hooks/`
❌ **Bad**: Moving `LoteCard` to shared/ when only used by lots feature

### 3. **Explicit Public APIs**
Each feature exports through its `index.ts` barrel file.

```typescript
// features/lots/index.ts - Public API
export { LotesPage } from './pages/LotesPage';
export { LoteCard } from './components/LoteCard';
export { useLots } from './hooks/useLots';

// TraceabilityTimeline is NOT exported - internal to feature
```

### 4. **No Circular Dependencies**
Features can import from `shared/`, but **never** from other features.

```typescript
// ✅ GOOD
import { useApi } from '@shared/hooks/useApi';
import { Lote } from '../types'; // Within same feature

// ❌ BAD
import { DashboardLayout } from '@features/dashboard/components/DashboardLayout';
```

**Exception**: Cross-feature imports are allowed only for layout/shell components like `DashboardLayout`.

---

## Feature Modules

### Lots Feature (`features/lots/`)

**Responsibility**: Manage agricultural lots/lotes - CRUD operations, QR scanning, traceability

**Key Components**:
- `LoteCard` - Display lot summary cards
- `QrScanner` - QR code simulation
- `TraceabilityTimeline` - Show lot timeline (internal)

**API Services**:
- `lotsService.ts` - Fetch lots, lot details, certificates

**Types**:
- `Lote`, `LoteStatus`, `BackendLot`, `TimelineEvent`

### Dashboard Feature (`features/dashboard/`)

**Responsibility**: Analytics dashboard with stats and charts

**Key Components**:
- `StatsGrid` - Statistics cards grid
- `ProductionChart` - Production visualization
- `RecentActivityTable` - Activity logs
- `DashboardLayout` - Main layout wrapper

### Landing Feature (`features/landing/`)

**Responsibility**: Landing page with 3D WebGL visualization

**Key Components**:
- `WebglLanding` - Main 3D canvas
- `NodosFibonacci` - Fibonacci network visualization
- `DataParticles` - Animated particles
- `Background` - Background effects

**Hooks**:
- `useFibonacciNodes` - Generate Fibonacci node positions
- `useOrganicBreath` - Organic breathing animation

---

## Shared Code

### UI Components (`shared/components/ui/`)

Reusable, atomic UI components used across features:

- `StatCard` - Metric display card
- `ThemeToggle` - Dark/light mode toggle
- `Button`, `Badge`, `GlassCard` - UI primitives

### Layout Components (`shared/components/layout/`)

Layout and structural components:

- `LoadingScreen` - Full-screen loader
- `GlassMorphUI` - Glassmorphism wrapper

### Hooks (`shared/hooks/`)

Reusable React hooks:

- `useApi<T>` - Generic API data fetching with loading/error states
- `usePerformanceMonitor` - FPS monitoring

### Library (`shared/lib/`)

Core utilities and clients:

- `apiClient.ts` - Type-safe HTTP client with timeout & error handling

### Types (`shared/types/`)

Shared TypeScript interfaces:

- `Theme`, `ViewMode`, `TrendDirection`
- `StatCard`, `ActivityLog`
- `Certificate`, `Order`

---

## Import Rules

### Path Aliases

The project uses TypeScript path aliases for cleaner imports:

```typescript
// ✅ GOOD - Use path aliases
import { useApi } from '@shared/hooks/useApi';
import { LoteCard } from '@features/lots/components/LoteCard';
import logo from '@assets/logo.png';

// ❌ BAD - Avoid relative paths for cross-feature imports
import { useApi } from '../../../../shared/hooks/useApi';
```

### Import Hierarchy

```
┌─────────────────┐
│   App.tsx       │  Can import from: features, shared
└─────────────────┘
         │
    ┌────┴────┐
    │         │
┌───▼────┐ ┌─▼──────┐
│Features│ │ Shared │  Features can import from: shared, same feature
└───┬────┘ └────────┘
    │
    └─── Cannot import from other features ───X
```

### Within Features

Use relative imports for files within the same feature:

```typescript
// Inside features/lots/pages/LotesPage.tsx
import { LoteCard } from '../components/LoteCard';  // ✅ Relative
import { lotsService } from '../services/lotsService';  // ✅ Relative
import { Lote } from '../types';  // ✅ Relative
```

### Cross-Feature Imports

```typescript
// Inside features/lots/pages/LotesPage.tsx
import { DashboardLayout } from '@features/dashboard/components/DashboardLayout';  // ✅ Allowed for layout
import { useApi } from '@shared/hooks/useApi';  // ✅ Good
```

---

## Adding New Features

### Step 1: Create Feature Folder

```bash
mkdir -p src/features/my-feature/{components,hooks,services,types,pages}
```

### Step 2: Create Barrel File

```typescript
// src/features/my-feature/index.ts
export { MyFeaturePage } from './pages/MyFeaturePage';
export { MyComponent } from './components/MyComponent';
export { useMyFeature } from './hooks/useMyFeature';
export type { MyFeatureType } from './types';
```

### Step 3: Add Types

```typescript
// src/features/my-feature/types/index.ts
export interface MyFeatureType {
  id: string;
  name: string;
  // ...
}
```

### Step 4: Create Components

```typescript
// src/features/my-feature/components/MyComponent.tsx
import { useMyFeature } from '../hooks/useMyFeature';
import { MyFeatureType } from '../types';

export function MyComponent() {
  // Component implementation
}
```

### Step 5: Add to Routes

```typescript
// src/App.tsx
import { MyFeaturePage } from '@features/my-feature';

// Add to router
```

---

## Best Practices

### ✅ DO

- **Keep features independent** - Minimize cross-feature dependencies
- **Use path aliases** - Import with `@features/*`, `@shared/*`
- **Follow folder structure** - Put files in the right place
- **Export through barrel files** - Use `index.ts` for public APIs
- **Move to shared/ when reused** - Follow the 2+ features rule
- **Use relative imports within features** - Keep feature code cohesive
- **Type everything** - Use TypeScript strict mode
- **Document complex logic** - Add comments for non-obvious code

### ❌ DON'T

- **Don't import between features** - Use shared/ instead
- **Don't create circular dependencies** - Follow import hierarchy
- **Don't bypass barrel files** - Always import from `index.ts`
- **Don't put feature-specific code in shared/** - Respect boundaries
- **Don't use default exports** - Prefer named exports for better refactoring
- **Don't skip TypeScript** - No `any` types without good reason

---

## Path Aliases

Configured in `tsconfig.app.json` and `vite.config.ts`:

| Alias | Path | Usage |
|-------|------|-------|
| `@/*` | `./src/*` | Any src file (legacy, avoid) |
| `@features/*` | `./src/features/*` | Feature modules |
| `@shared/*` | `./src/shared/*` | Shared code |
| `@assets/*` | `./src/assets/*` | Static assets |

### Configuration

**tsconfig.app.json**:
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@features/*": ["./src/features/*"],
      "@shared/*": ["./src/shared/*"],
      "@assets/*": ["./src/assets/*"]
    }
  }
}
```

**vite.config.ts**:
```typescript
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@features': path.resolve(__dirname, './src/features'),
      '@shared': path.resolve(__dirname, './src/shared'),
      '@assets': path.resolve(__dirname, './src/assets'),
    },
  },
});
```

---

## Migration Notes

**Date**: December 2, 2025
**From**: File-type organization
**To**: Feature-based architecture

### Key Changes

1. ✅ **Migrated all features** to `features/` folder
2. ✅ **Created barrel files** for public APIs
3. ✅ **Updated path aliases** in tsconfig and vite.config
4. ✅ **Fixed all imports** to use new structure
5. ✅ **Removed mock data** from `data/` folder

### Files Moved

- `components/{lotes,dashboard,landing}/*` → `features/*/components/`
- `pages/*` → `features/*/pages/`
- `services/*` → `features/*/services/`
- `components/ui/*` → `shared/components/ui/`
- `hooks/*` → `shared/hooks/` or `features/*/hooks/`
- `lib/*` → `shared/lib/`

---

## Next Steps

1. **Phase 2**: Implement strict ESLint rules to enforce architecture
2. **Phase 3**: Add Storybook for component documentation
3. **Phase 4**: Set up Lighthouse CI for performance monitoring
4. **Phase 5**: Add integration tests for each feature

---

## Resources

- [MIGRATION_PLAN.md](./MIGRATION_PLAN.md) - Detailed migration steps
- [CODE_AUDIT_REPORT.md](./CODE_AUDIT_REPORT.md) - Code quality audit
- [CEO_DEMO_BRIEF.md](./CEO_DEMO_BRIEF.md) - Executive demo guide

---

**Questions?** Check existing features for examples or refer to the migration plan.
