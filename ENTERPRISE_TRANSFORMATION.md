TECH LEAD - TRANSFORMACIÓN ENTERPRISE AGROBRIDGE
PRESUPUESTO: $100,000 USD | 56 MEJORAS | OBJETIVO: $5M ARR EN 18 MESES


REGLAS DE OPERACIÓN AUTÓNOMA
================================================================================

1. SIEMPRE lee archivos antes de editarlos (usa read_file)
2. NUNCA uses placeholders o TODOs - implementa código completo
3. EJECUTA tests después de cada cambio crítico
4. DOCUMENTA decisiones con comentarios en código
5. MANTÉN consistencia con convenciones existentes
6. PROPÓN plan detallado ANTES de ejecutar (espera aprobación)
7. AUTO-CORRIGE errores (si falla, ajusta y reintenta)
8. COMMITS pequeños e incrementales (no cambios masivos)
9. VALIDA con linters y type-checkers antes de siguiente tarea
10. REPORTA progreso en formato estructurado después de cada paso

================================================================================
STACK TECNOLÓGICO OBJETIVO
================================================================================

FRONTEND
--------
- Next.js 15 con App Router (NO Pages Router)
- TypeScript 5.3+ strict mode
- React 19 Server Components como default
- Tailwind CSS 4.0 con design system custom
- Framer Motion 11 para micro-animaciones
- Radix UI para componentes accesibles (WCAG 2.1 AA)
- Zustand para estado global (NO Redux)
- React Query v5 para server state management
- React Hook Form + Zod para validación type-safe
- Vitest + Testing Library para unit tests
- Playwright para E2E tests
- Lighthouse CI con score objetivo 95+

BACKEND
-------
- Node.js 22 LTS
- Fastify 4.x (NO Express - 2x más rápido)
- GraphQL con Apollo Server 4
- Prisma 5.x como ORM
- PostgreSQL 16 + TimescaleDB para blockchain data
- Redis 7.2 para cache/sessions/rate limiting
- BullMQ para background jobs (mining, emails, PDFs)
- Auth0 o NextAuth.js v5 con JWT
- CASL para attribute-based access control (ABAC)
- OpenTelemetry para distributed tracing
- Pino para structured JSON logging
- Sentry para error tracking

INFRAESTRUCTURA
---------------
- Amazon EKS (Kubernetes 1.28+)
- Terraform para Infrastructure as Code
- ArgoCD para GitOps continuous deployment
- GitHub Actions para CI/CD pipeline
- Amazon RDS PostgreSQL Multi-AZ
- ElastiCache Redis cluster
- S3 + CloudFront para assets estáticos
- Route53 + Certificate Manager para DNS/TLS
- AWS WAF + Shield para security
- Datadog APM para observability
- PagerDuty para alerting 24/7

================================================================================
DESIGN SYSTEM - IDENTIDAD VISUAL
================================================================================

PALETA DE COLORES
-----------------
Primary 50:  #F7F7F2  (Lienzo Natural - backgrounds)
Primary 100: #EEEDDF  (Hover states)
Primary 500: #8B9D83  (Aguacate Suave - secondary actions)
Primary 900: #2E4034  (Aguacate Profundo - text, headings)

Accent:      #C1A576  (Oro Sutil - primary buttons, links)
Accent Hover:#D4AF37  (Hover states)
Berry:       #B92E3A  (Frambuesa - CTAs, highlights)

Success:     #4CAF50
Error:       #EF4444
Warning:     #F59E0B
Info:        #3B82F6

TIPOGRAFÍA
----------
Headings: "Playfair Display", serif (elegante, editorial)
Body:     "Inter", sans-serif (moderna, legible)

ANIMACIONES
-----------
Spring:  { type: 'spring', stiffness: 300, damping: 30 }
FadeIn:  { opacity: [0, 1], y: [20, 0], duration: 0.5s }
Scale:   whileHover: 1.02, whileTap: 0.98

BORDER RADIUS
-------------
sm:      4px
default: 8px
lg:      16px
full:    9999px

================================================================================
PASO 1: AUDITORÍA TÉCNICA COMPLETA
================================================================================

OBJETIVO: Analizar código actual y detectar 56 mejoras prioritarias

ACCIONES REQUERIDAS
-------------------
1.1. Leer archivo frontend-nextjs/package.json
1.2. Leer archivo backend/package.json
1.3. Listar directorios frontend-nextjs/src
1.4. Listar directorios backend/src
1.5. Leer archivo frontend-nextjs/next.config.js
1.6. Leer archivo backend/index.js (o archivo principal detectado)

OUTPUT ESPERADO
---------------

--- AUDITORÍA TÉCNICA AGROBRIDGE ---

FRONTEND ACTUAL
- Framework: [Next.js version detectada]
- Node version: [detectada en package.json]
- Dependencias críticas: [listar con versiones]
- Estructura de carpetas: [describir organización]
- Routing: [Pages Router o App Router]
- Estado: [Redux/Context/otro]
- Styling: [Tailwind/CSS/otro]
- Testing: [Jest/Vitest/ninguno]

ISSUES FRONTEND (20 mejoras identificadas)
1. [Issue detectado] - Prioridad: Alta/Media/Baja - Impacto: [descripción]
2. [Issue detectado] - Prioridad: Alta/Media/Baja - Impacto: [descripción]
...
20. [Issue detectado] - Prioridad: Alta/Media/Baja - Impacto: [descripción]

BACKEND ACTUAL
- Framework: [Express/Fastify/otro]
- Base de datos: [tipo y método de conexión]
- API style: [REST/GraphQL]
- Autenticación: [método actual]
- Blockchain: [implementación actual - filesystem/DB]
- Logging: [console.log/Winston/Pino]
- Testing: [framework usado]

ISSUES BACKEND (22 mejoras identificadas)
1. [Issue detectado] - Prioridad: Alta/Media/Baja - Impacto: [descripción]
2. [Issue detectado] - Prioridad: Alta/Media/Baja - Impacto: [descripción]
...
22. [Issue detectado] - Prioridad: Alta/Media/Baja - Impacto: [descripción]

INFRAESTRUCTURA ACTUAL
- Hosting: [proveedor actual]
- Deployment: [método - manual/CI/CD]
- Monitoring: [herramientas usadas]
- Backups: [estrategia actual]

ISSUES INFRAESTRUCTURA (14 mejoras identificadas)
1. [Issue detectado] - Prioridad: Alta/Media/Baja - Impacto: [descripción]
2. [Issue detectado] - Prioridad: Alta/Media/Baja - Impacto: [descripción]
...
14. [Issue detectado] - Prioridad: Alta/Media/Baja - Impacto: [descripción]

TOTAL: 56 MEJORAS IDENTIFICADAS

SIGUIENTE PASO RECOMENDADO: PASO 2

--- FIN AUDITORÍA ---

================================================================================
PASO 2: PLANIFICACIÓN SECUENCIAL
================================================================================

OBJETIVO: Crear roadmap de implementación paso a paso

ACCIONES REQUERIDAS
-------------------
2.1. Analizar dependencias entre las 56 mejoras
2.2. Agrupar mejoras en fases lógicas
2.3. Priorizar por impacto vs esfuerzo
2.4. Generar secuencia óptima de ejecución

OUTPUT ESPERADO
---------------

--- PLAN DE EJECUCIÓN SECUENCIAL ---

FASE 1: FRONTEND FOUNDATION (20 mejoras)
Pasos 3-22

FASE 2: BACKEND REFACTOR (22 mejoras)
Pasos 23-44

FASE 3: INFRASTRUCTURE (14 mejoras)
Pasos 45-58

ESTIMACIÓN TOTAL: 58 pasos secuenciales

--- FIN PLAN ---

SIGUIENTE PASO RECOMENDADO: PASO 3

================================================================================
PASO 3: CREAR PROYECTO NEXT.JS 15
================================================================================

PREREQUISITO: Aprobación del PASO 2

ACCIONES REQUERIDAS
-------------------
3.1. Navegar a directorio temporal: /tmp/agrobridge-next15
3.2. Ejecutar: npx create-next-app@latest . --typescript --tailwind --app --src-dir --import-alias "@/*"
3.3. Confirmar instalación completada exitosamente

OUTPUT ESPERADO
---------------
- Directorio /tmp/agrobridge-next15 creado
- Proyecto Next.js 15 inicializado
- package.json con dependencias base instaladas

VALIDACIÓN
----------
- Verificar existencia de src/app/page.tsx
- Verificar tsconfig.json con "strict": true
- Verificar tailwind.config.ts existe

SIGUIENTE PASO: PASO 4

================================================================================
PASO 4: CONFIGURAR TYPESCRIPT STRICT MODE
================================================================================

PREREQUISITO: PASO 3 completado

ACCIONES REQUERIDAS
-------------------
4.1. Leer archivo /tmp/agrobridge-next15/tsconfig.json
4.2. Modificar compilerOptions con configuraciones strict:
    - "strict": true
    - "strictNullChecks": true
    - "noUncheckedIndexedAccess": true
    - "noImplicitAny": true
    - "exactOptionalPropertyTypes": true
4.3. Guardar cambios

OUTPUT ESPERADO
---------------
- tsconfig.json actualizado con strict mode completo

VALIDACIÓN
----------
- Ejecutar: npm run type-check (0 errores esperados en proyecto base)

SIGUIENTE PASO: PASO 5

================================================================================
PASO 5: INSTALAR DEPENDENCIAS ENTERPRISE
================================================================================

PREREQUISITO: PASO 4 completado

ACCIONES REQUERIDAS
-------------------
5.1. Navegar a /tmp/agrobridge-next15
5.2. Ejecutar: npm install zustand @tanstack/react-query framer-motion next-intl react-hook-form zod
5.3. Ejecutar: npm install @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-select
5.4. Ejecutar: npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event
5.5. Ejecutar: npm install -D playwright @playwright/test

OUTPUT ESPERADO
---------------
- package.json actualizado con todas las dependencias
- node_modules instalado correctamente
- 0 vulnerabilidades críticas detectadas

VALIDACIÓN
----------
- Ejecutar: npm audit (verificar 0 high/critical)
- Verificar package.json contiene todas las dependencias listadas

SIGUIENTE PASO: PASO 6

================================================================================
PASO 6: CREAR ESTRUCTURA DE CARPETAS ENTERPRISE
================================================================================

PREREQUISITO: PASO 5 completado

ACCIONES REQUERIDAS
-------------------
6.1. Crear src/lib/design-system (para tokens y utilities)
6.2. Crear src/lib/utils (para helpers)
6.3. Crear src/lib/hooks (para custom hooks)
6.4. Crear src/components/ui (para design system components)
6.5. Crear src/components/layout (para Header, Footer, etc)
6.6. Crear src/components/features (para feature-specific components)
6.7. Crear src/app/(marketing) (para landing pages)
6.8. Crear src/app/(dashboard) (para authenticated routes)
6.9. Crear src/app/api (para API routes)

OUTPUT ESPERADO
---------------
- Estructura de carpetas enterprise creada
- Todos los directorios existen y están vacíos

VALIDACIÓN
----------
- Listar src/lib (debe mostrar 3 subdirectorios)
- Listar src/components (debe mostrar 3 subdirectorios)
- Listar src/app (debe mostrar 3 subdirectorios + page.tsx)

SIGUIENTE PASO: PASO 7

================================================================================
PASO 7: CREAR DESIGN SYSTEM TOKENS
================================================================================

PREREQUISITO: PASO 6 completado

ACCIONES REQUERIDAS
-------------------
7.1. Crear archivo src/lib/design-system/tokens.ts
7.2. Implementar colors object con paleta completa (Primary 50/100/500/900, Accent, Berry, etc)
7.3. Implementar typography object (Playfair Display, Inter)
7.4. Implementar animation presets (spring, fadeIn, scale)
7.5. Implementar borderRadius tokens
7.6. Exportar tokens con "as const" para type safety

CÓDIGO REQUERIDO
----------------
export const tokens = {
  colors: {
    primary: {
      50: '#F7F7F2',
      100: '#EEEDDF',
      500: '#8B9D83',
      900: '#2E4034',
    },
    accent: {
      DEFAULT: '#C1A576',
      hover: '#D4AF37',
    },
    berry: '#B92E3A',
    success: '#4CAF50',
    error: '#EF4444',
    warning: '#F59E0B',
    info: '#3B82F6',
  },
  typography: {
    heading: '"Playfair Display", serif',
    body: '"Inter", sans-serif',
  },
  animation: {
    spring: { type: 'spring' as const, stiffness: 300, damping: 30 },
    fadeIn: {
      initial: { opacity: 0, y: 20 },
      animate: { opacity: 1, y: 0 },
      transition: { duration: 0.5 },
    },
    scale: {
      whileHover: { scale: 1.02 },
      whileTap: { scale: 0.98 },
    },
  },
  borderRadius: {
    sm: '4px',
    DEFAULT: '8px',
    lg: '16px',
    full: '9999px',
  },
} as const;

OUTPUT ESPERADO
---------------
- Archivo tokens.ts creado con types inferidos correctamente

VALIDACIÓN
----------
- Importar tokens en otro archivo y verificar autocomplete de TypeScript
- Ejecutar npm run type-check (0 errores)

SIGUIENTE PASO: PASO 8

================================================================================
PASO 8: IMPLEMENTAR COMPONENTE BUTTON
================================================================================

PREREQUISITO: PASO 7 completado

ACCIONES REQUERIDAS
-------------------
8.1. Crear archivo src/components/ui/Button.tsx
8.2. Importar tokens y Framer Motion
8.3. Definir ButtonProps interface (variant, size, ...HTMLButtonAttributes)
8.4. Implementar variantes: primary, secondary, ghost
8.5. Implementar sizes: sm, md, lg
8.6. Agregar animaciones whileHover y whileTap
8.7. Usar forwardRef para refs
8.8. Exportar componente

CÓDIGO REQUERIDO
----------------
'use client';

import { motion } from 'framer-motion';
import { forwardRef } from 'react';
import { tokens } from '@/lib/design-system/tokens';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className = '', children, ...props }, ref) => {
    const baseStyles = 'rounded-lg font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-2';
    
    const variants = {
      primary: `bg-[${tokens.colors.accent.DEFAULT}] hover:bg-[${tokens.colors.accent.hover}] text-white focus:ring-[${tokens.colors.accent.DEFAULT}]`,
      secondary: `bg-[${tokens.colors.primary[50]}] hover:bg-[${tokens.colors.primary[100]}] text-[${tokens.colors.primary[900]}] focus:ring-[${tokens.colors.primary[500]}]`,
      ghost: 'bg-transparent hover:bg-gray-100 text-gray-700 focus:ring-gray-300',
    };
    
    const sizes = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-base',
      lg: 'px-6 py-3 text-lg',
    };

    return (
      <motion.button
        ref={ref}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
        {...props}
      >
        {children}
      </motion.button>
    );
  }
);

Button.displayName = 'Button';

OUTPUT ESPERADO
---------------
- Componente Button creado con variantes y animaciones

VALIDACIÓN
----------
- Importar Button en page.tsx y renderizar
- Verificar hover animations funcionan
- Ejecutar npm run type-check (0 errores)

SIGUIENTE PASO: PASO 9

================================================================================
PASO 9: CREAR TEST PARA BUTTON COMPONENT
================================================================================

PREREQUISITO: PASO 8 completado

ACCIONES REQUERIDAS
-------------------
9.1. Crear archivo src/components/ui/Button.test.tsx
9.2. Setup Vitest con @testing-library/react
9.3. Crear test: renders correctly
9.4. Crear test: handles click events
9.5. Crear test: applies variant styles correctly
9.6. Crear test: applies size styles correctly
9.7. Ejecutar tests

CÓDIGO REQUERIDO
----------------
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from './Button';

describe('Button', () => {
  it('renders correctly', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('handles click events', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    fireEvent.click(screen.getByText('Click me'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('applies primary variant by default', () => {
    render(<Button>Primary</Button>);
    const button = screen.getByText('Primary');
    expect(button.className).toContain('bg-[');
  });

  it('applies size styles correctly', () => {
    render(<Button size="sm">Small</Button>);
    const button = screen.getByText('Small');
    expect(button.className).toContain('px-3');
  });
});

OUTPUT ESPERADO
---------------
- 4 tests pasando correctamente

VALIDACIÓN
----------
- Ejecutar: npm run test (4/4 tests passed)
- Coverage del Button.tsx debe ser 80%+

SIGUIENTE PASO: PASO 10

================================================================================
PASOS 10-58: CONTINUACIÓN DE LA TRANSFORMACIÓN
================================================================================

Los siguientes pasos seguirán la misma estructura secuencial:

PASO 10: Implementar componente Input
PASO 11: Implementar componente Card
PASO 12: Implementar componente Modal con Radix UI
PASO 13: Configurar Tailwind CSS 4.0 con tokens custom
PASO 14: Crear Storybook para component library
PASO 15: Configurar Vitest completo con coverage
PASO 16: Setup Playwright para E2E tests
PASO 17: Configurar Lighthouse CI en GitHub Actions
PASO 18: Migrar layout principal a App Router
PASO 19: Convertir page.tsx a Server Component
PASO 20: Implementar hero section con video optimizado
PASO 21: Crear features section con Framer Motion animations
PASO 22: Implementar modal de verificación interactivo

... [Pasos 23-44 para Backend]
... [Pasos 45-58 para Infrastructure]

Cada paso incluirá:
- Prerequisitos claros
- Acciones requeridas numeradas
- Código completo a implementar
- Output esperado
- Validación específica
- Siguiente paso indicado

================================================================================
COMANDOS DE VALIDACIÓN CONTINUA
================================================================================

EJECUTAR DESPUÉS DE CADA PASO CRÍTICO
--------------------------------------
npm run lint              # 0 errores esperados
npm run type-check        # 0 errores esperados
npm run test              # Todos los tests pasando
npm run build             # Build exitoso

MÉTRICAS OBJETIVO
-----------------
- Test coverage: 80%+ (frontend), 70%+ (backend)
- Lighthouse Performance: 95+
- Lighthouse Accessibility: 100
- TypeScript errors: 0
- ESLint errors: 0
- Security vulnerabilities: 0 high/critical

================================================================================
OUTPUT FORMAT DESPUÉS DE CADA PASO
================================================================================

--- PASO [número] COMPLETADO: [Nombre del paso] ---

ARCHIVOS CREADOS
- [ruta/archivo] - [Descripción y propósito]

ARCHIVOS MODIFICADOS
- [ruta/archivo] - [Cambios realizados]

COMANDOS EJECUTADOS
[comando] → Exitoso/Fallido

VALIDACIÓN
✓ [check 1]
✓ [check 2]
✗ [check fallido] - [razón y solución propuesta]

MÉTRICAS ACTUALES
- Tests: [X]/[total] pasando ([%] coverage)
- Build: Exitoso/Fallido
- Lighthouse: [score] (si aplica)

SIGUIENTE PASO RECOMENDADO: PASO [número + 1]

ESPERAR CONFIRMACIÓN: Sí/No

--- FIN REPORTE PASO [número] ---

================================================================================
INICIO DE SESIÓN - COMANDOS INICIALES
================================================================================

Al cargar este documento por primera vez, ejecuta:

PASO 1.1: read_file frontend-nextjs/package.json
PASO 1.2: read_file backend/package.json
PASO 1.3: list_directory frontend-nextjs/src
PASO 1.4: list_directory backend/src

Luego genera el reporte de auditoría (PASO 1) y pregunta:

"📊 AUDITORÍA COMPLETADA - PASO 1 FINALIZADO

Detecté [X] issues críticos en el proyecto actual:
- Frontend: [número] issues de alta prioridad
- Backend: [número] issues de alta prioridad
- Infraestructura: [número] issues de alta prioridad

TOTAL: 56 mejoras identificadas y priorizadas

¿Procedo con PASO 2 (Planificación Secuencial)?
¿O prefieres saltar directamente a PASO 3 (Implementación Frontend)?"

ESPERA MI CONFIRMACIÓN antes de proceder al siguiente paso.

================================================================================
PRESUPUESTO: $100,000 USD | 58 PASOS SECUENCIALES | OBJETIVO: $5M ARR
================================================================================

