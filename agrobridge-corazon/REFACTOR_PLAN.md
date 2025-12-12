# Frontend Refactor & Architecture Plan

> **Audience:** Frontend Engineering Team, UI/UX Designers
> **Objective:** To outline a phased plan for refactoring the `agrobridge-corazon` frontend, elevating it to an enterprise-grade standard of performance, maintainability, and user experience.
>
> ---
> **Last Reviewed:** 2025-11-20
> **Document Owner:** Frontend Lead

---
## English

### 1. Priority & Goal

**The #3 priority is to solidify the frontend architecture.** A clean, performant, and well-structured frontend is crucial for user satisfaction and long-term maintainability.

*   **Goal:** Complete a full dependency audit, component refactor, and architectural pattern integration by **End of Q2 2026**.

### 2. Phase 1: Dependency & Code Hygiene

1.  **Dependency Audit:**
    *   **Action:** Run `pnpm outdated` to identify stale packages.
    *   **Action:** Manually audit `package.json`. Remove any commented-out, unused, or redundant dependencies. Pay special attention to ensuring a single, consistent version of libraries like React.
    *   **Action:** Delete `node_modules` and `pnpm-lock.yaml`, then run `pnpm install` to generate a clean, deterministic lockfile.
2.  **Linter & Formatter Setup:**
    *   **Action:** Enforce a strict `ESLint` configuration for code quality and a `Prettier` configuration for consistent formatting.
    *   **Action:** Integrate `pnpm lint` and `pnpm format` checks into a CI pipeline for all frontend Pull Requests.

### 3. Phase 2: Component & Directory Restructure

1.  **New Directory Structure:** Reorganize the `agrobridge-corazon` directory to follow a standard, scalable pattern.
    ```
    /src
    ├── /app/         # Next.js App Router (Pages & Layouts)
    ├── /components/
    │   ├── /ui/      # Reusable, "dumb" UI elements (Button.tsx, Card.tsx)
    │   ├── /forms/   # Complex form components with state
    │   └── /layout/  # Main layout components (Navbar.tsx, Footer.tsx)
    ├── /hooks/       # Custom React hooks (e.g., useApi.ts, useDebounce.ts)
    ├── /lib/         # Utility functions, helpers, constants
    ├── /services/    # API interaction layer (e.g., api.ts)
    └── /styles/      # Global CSS and Tailwind directives
    ```
2.  **Component Refactoring:**
    *   **Action:** Audit all existing components. Any large, monolithic component should be broken down into smaller, single-purpose components.
    *   **Action:** Enforce a clear separation between "Container" components (which handle data fetching and state) and "Presentational" components (which only receive props and render UI).

### 4. Phase 3: Premium Architecture & User Experience

1.  **Standardize Data Fetching:**
    *   **Action:** Standardize all client-side API calls to use a modern data-fetching hook like `SWR` or `React Query`. This provides caching, revalidation, and a consistent state management pattern. The existing `useApi` hook should be refactored to use one of these libraries.
2.  **Performance Optimization:**
    *   **Action:** Use `next/image` for all images to get automatic optimization, resizing, and modern format delivery (WebP).
    *   **Action:** Use `next/dynamic` to lazy-load large components that are not visible on the initial screen.
    *   **Action:** Judiciously apply `React.useMemo` and `React.useCallback` to prevent unnecessary re-renders in complex components.
3.  **Enhance User Experience:**
    *   **Action:** Integrate `framer-motion` to add subtle, professional animations to page transitions and component interactions.
    *   **Action:** Ensure all forms and interactive elements are fully accessible and follow WCAG 2.1 guidelines.
    *   **Action:** Integrate the company's official branding and storytelling (from the Culture Playbook) into key UI sections like the hero banner, login page, and footer.

---
## Español

### 1. Prioridad y Objetivo

**La prioridad #3 es solidificar la arquitectura del frontend.** Un frontend limpio, performante y bien estructurado es crucial para la satisfacción del usuario y la mantenibilidad a largo plazo.

*   **Objetivo:** Completar la auditoría de dependencias, refactorización de componentes e integración de patrones de arquitectura para el **Final del Q2 2026**.

### 2. Fase 1: Higiene de Código y Dependencias

1.  **Auditoría de Dependencias:**
    *   **Acción:** Ejecutar `pnpm outdated` y auditar manualmente el `package.json` para eliminar librerías no utilizadas.
    *   **Acción:** Borrar `node_modules` y `pnpm-lock.yaml`, luego ejecutar `pnpm install` para generar un lockfile limpio y determinista.
2.  **Configuración de Linter y Formatter:**
    *   **Acción:** Implementar una configuración estricta de `ESLint` y `Prettier` e integrarla en la CI para todos los PRs.

### 3. Fase 2: Reestructuración de Directorios y Componentes

1.  **Nueva Estructura de Directorios:** Reorganizar el proyecto para seguir un patrón estándar y escalable.
    ```
    /src
    ├── /app/       # Rutas y Layouts de Next.js
    ├── /components/
    │   ├── /ui/    # Componentes de UI reutilizables (Button.tsx)
    │   └── /layout/ # Componentes principales de la UI (Navbar.tsx)
    ├── /hooks/     # Hooks de React personalizados (useApi.ts)
    └── /services/  # Capa de interacción con la API
    ```
2.  **Refactorización de Componentes:**
    *   **Acción:** Dividir componentes monolíticos en componentes más pequeños y de propósito único.
    *   **Acción:** Forzar una separación clara entre componentes "Contenedores" (manejan datos) y "Presentacionales" (solo renderizan UI).

### 4. Fase 3: Arquitectura Premium y Experiencia de Usuario

1.  **Estandarizar la Obtención de Datos:**
    *   **Acción:** Estandarizar todas las llamadas a la API del lado del cliente para usar un hook moderno como `SWR` o `React Query` para caching y revalidación.
2.  **Optimización de Rendimiento:**
    *   **Acción:** Usar `next/image` para todas las imágenes.
    *   **Acción:** Usar `next/dynamic` para cargar de forma perezosa (lazy-load) componentes grandes.
    *   **Acción:** Aplicar `useMemo` y `useCallback` para prevenir re-renders innecesarios.
3.  **Mejorar la Experiencia de Usuario:**
    *   **Acción:** Integrar `framer-motion` para añadir animaciones sutiles y profesionales.
    *   **Acción:** Asegurar que todos los formularios sean accesibles y cumplan con las guías WCAG 2.1.
    *   **Acción:** Integrar el branding y storytelling de la empresa en secciones clave de la UI.
