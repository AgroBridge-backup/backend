# 📋 Feature Folder Structure Migration Plan

**Date**: December 2, 2025
**Task**: Migrate from file-type organization to feature-based architecture
**Priority**: 🔴 Critical (Foundation for all future work)

---

## 📊 Current Structure Analysis

### Current Organization (File-Type Based)
```
src/
├── components/           # Mixed: feature-specific + shared
│   ├── ui/              # Shared UI components
│   ├── lotes/           # Lots feature components
│   ├── dashboard/       # Dashboard feature components
│   ├── marketing/       # Marketing feature components
│   └── [landing]        # Landing page components (Background, WebGL, etc.)
├── pages/               # Route components
│   ├── DashboardPage.tsx
│   ├── LotesPage.tsx
│   └── LoteDetailPage.tsx
├── hooks/               # Mixed: feature + shared hooks
│   ├── useApi.ts        # Shared
│   ├── useFibonacciNodes.ts  # Landing
│   ├── useOrganicBreath.ts   # Landing
│   └── usePerformanceMonitor.ts  # Shared
├── services/            # Feature services
│   └── lotsService.ts   # Lots feature
├── lib/                 # Shared utilities
│   └── apiClient.ts
├── data/                # Mock data (will be removed after backend integration)
│   ├── mockLotes.ts
│   ├── mockStats.ts
│   ├── mockProductores.ts
│   └── mockTimeline.ts
├── types/               # Shared types
│   └── index.ts
├── contexts/            # Shared contexts
│   └── ThemeContext.tsx
├── config/              # App configuration
│   └── api.ts
├── utils/               # Shared utilities
│   └── lazyLoad.tsx
├── assets/              # Static assets
└── shaders/             # WebGL shaders
```

### Problems with Current Structure
1. ❌ **No clear boundaries** - Hard to know what belongs to which feature
2. ❌ **Tight coupling** - Components import from anywhere
3. ❌ **Difficult scalability** - Adding new features requires touching multiple folders
4. ❌ **Poor discoverability** - Need to check multiple folders to understand a feature
5. ❌ **No encapsulation** - All code is public by default

---

## 🎯 Proposed Structure (Feature-Based)

### New Organization
```
src/
├── features/                    # Feature modules (business domains)
│   ├── lots/                   # Lotes/Lots feature
│   │   ├── components/
│   │   │   ├── LoteCard.tsx
│   │   │   ├── TraceabilityTimeline.tsx
│   │   │   └── QrScanner.tsx
│   │   ├── hooks/
│   │   │   └── useLots.ts      # Feature-specific hooks
│   │   ├── services/
│   │   │   └── lotsService.ts
│   │   ├── types/
│   │   │   └── index.ts        # Lot, BackendLot types
│   │   ├── pages/
│   │   │   ├── LotesPage.tsx
│   │   │   └── LoteDetailPage.tsx
│   │   └── index.ts            # Public API exports
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
│   ├── certificates/           # Certificates feature (future)
│   │   └── index.ts
│   │
│   ├── producers/              # Producers feature (future)
│   │   └── index.ts
│   │
│   └── landing/                # Landing page feature
│       ├── components/
│       │   ├── Background.tsx
│       │   ├── WebglLanding.tsx
│       │   ├── DataParticles.tsx
│       │   ├── NodosFibonacci.tsx
│       │   └── InteractiveDemo.tsx
│       ├── hooks/
│       │   ├── useFibonacciNodes.ts
│       │   └── useOrganicBreath.ts
│       ├── shaders/
│       └── index.ts
│
├── shared/                     # Shared code (used by 2+ features)
│   ├── components/
│   │   ├── ui/                # Reusable UI components
│   │   │   ├── StatCard.tsx
│   │   │   ├── ThemeToggle.tsx
│   │   │   └── Button.tsx
│   │   └── layout/            # Layout components
│   │       ├── LoadingScreen.tsx
│   │       └── GlassMorphUI.tsx
│   ├── hooks/
│   │   ├── useApi.ts
│   │   └── usePerformanceMonitor.ts
│   ├── lib/
│   │   └── apiClient.ts
│   ├── types/
│   │   └── index.ts           # Shared types only
│   ├── contexts/
│   │   └── ThemeContext.tsx
│   ├── utils/
│   │   └── lazyLoad.tsx
│   └── config/
│       └── api.ts
│
├── assets/                     # Static assets (images, fonts)
├── App.tsx                     # Root app component
└── main.tsx                    # Entry point
```

### Benefits of New Structure
1. ✅ **Clear boundaries** - Each feature is self-contained
2. ✅ **Easy to understand** - All feature code in one place
3. ✅ **Scalable** - Add new features without touching existing code
4. ✅ **Better colocation** - Related code lives together
5. ✅ **Explicit APIs** - Features export through index.ts
6. ✅ **Easier testing** - Test entire feature in isolation
7. ✅ **Team collaboration** - Multiple devs can work on different features without conflicts

---

## 🗺️ Migration Strategy

### Phase 1: Setup Foundation (Day 1)
1. Create new folder structure (features/, shared/)
2. Update tsconfig.json with path aliases
3. Create index.ts barrel files for each feature

### Phase 2: Migrate Lots Feature (Day 2)
**Why first?** Most complete feature with backend integration

**Files to move:**
- `components/lotes/*` → `features/lots/components/`
- `services/lotsService.ts` → `features/lots/services/`
- `pages/LotesPage.tsx` → `features/lots/pages/`
- `pages/LoteDetailPage.tsx` → `features/lots/pages/`
- Extract lot types from `types/index.ts` → `features/lots/types/`

**Create:**
- `features/lots/index.ts` - Export public API
- `features/lots/hooks/useLots.ts` - Wrap useApi for lots

### Phase 3: Migrate Dashboard Feature (Day 2)
**Files to move:**
- `components/dashboard/*` → `features/dashboard/components/`
- `pages/DashboardPage.tsx` → `features/dashboard/pages/`

### Phase 4: Migrate Landing Feature (Day 3)
**Files to move:**
- `components/Background.tsx` → `features/landing/components/`
- `components/WebglLanding.tsx` → `features/landing/components/`
- `components/DataParticles.tsx` → `features/landing/components/`
- `components/NodosFibonacci.tsx` → `features/landing/components/`
- `components/marketing/InteractiveDemo.tsx` → `features/landing/components/`
- `hooks/useFibonacciNodes.ts` → `features/landing/hooks/`
- `hooks/useOrganicBreath.ts` → `features/landing/hooks/`
- `shaders/*` → `features/landing/shaders/`

### Phase 5: Migrate Shared Code (Day 3)
**Files to move:**
- `components/ui/*` → `shared/components/ui/`
- `components/LoadingScreen.tsx` → `shared/components/layout/`
- `components/GlassMorphUI.tsx` → `shared/components/layout/`
- `hooks/useApi.ts` → `shared/hooks/`
- `hooks/usePerformanceMonitor.ts` → `shared/hooks/`
- `lib/*` → `shared/lib/`
- `types/*` → `shared/types/`
- `contexts/*` → `shared/contexts/`
- `utils/*` → `shared/utils/`
- `config/*` → `shared/config/`

### Phase 6: Update Imports (Day 4)
Update all imports to use new paths:
```typescript
// ❌ OLD
import { LoteCard } from '@/components/lotes/LoteCard';
import { useApi } from '@/hooks/useApi';

// ✅ NEW
import { LoteCard } from '@features/lots';
import { useApi } from '@shared/hooks';
```

### Phase 7: Cleanup (Day 4)
1. Remove old empty folders
2. Remove data/ folder (mock data no longer needed)
3. Verify build passes
4. Run tests
5. Update documentation

---

## 📝 TypeScript Configuration

### Update tsconfig.json
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

### Vite Configuration
Update `vite.config.ts`:
```typescript
import path from 'path';

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

## 🎯 Feature Public API Pattern

Each feature should have an `index.ts` that exports its public API:

```typescript
// features/lots/index.ts
export { LotesPage } from './pages/LotesPage';
export { LoteDetailPage } from './pages/LoteDetailPage';
export { LoteCard } from './components/LoteCard';
export { QrScanner } from './components/QrScanner';
export { useLots } from './hooks/useLots';
export type { Lote, LoteStatus } from './types';

// Internal components NOT exported:
// - TraceabilityTimeline (only used within LoteDetailPage)
```

---

## ✅ Success Criteria

- [ ] All features follow the same structure
- [ ] No circular dependencies
- [ ] Clear public API per feature (index.ts)
- [ ] Build passes without errors
- [ ] All imports use path aliases
- [ ] No files in old folder structure
- [ ] Documentation updated (ARCHITECTURE.md)
- [ ] Team can navigate codebase easily

---

## 🚨 Migration Risks & Mitigations

### Risk 1: Breaking imports during migration
**Mitigation**: Migrate one feature at a time, keep both old and new imports working temporarily

### Risk 2: Circular dependencies
**Mitigation**: Follow strict rule - features can only import from shared/, never from other features/

### Risk 3: Lost git history
**Mitigation**: Use `git mv` command to preserve file history

---

## 📊 Estimated Timeline

- **Day 1**: Setup + Documentation (4 hours)
- **Day 2**: Migrate lots + dashboard features (6 hours)
- **Day 3**: Migrate landing + shared code (6 hours)
- **Day 4**: Update imports + cleanup + testing (4 hours)

**Total**: 4 days (1 person) or 2 days (2 people in parallel)

---

## 🔄 Next Steps

1. ✅ Create this migration plan
2. ⏭️ Create migration script
3. ⏭️ Execute migration feature by feature
4. ⏭️ Update all imports
5. ⏭️ Verify build and tests
6. ⏭️ Create ARCHITECTURE.md
7. ⏭️ Commit changes with clear message

---

**Status**: 📝 Planning complete, ready to start migration
**Next Agent**: Can continue from Phase 2 (Migrate Lots Feature)
