# Arquitectura Actual e Inventario de Servicios (2025-11-27)

Este documento detalla el estado actual de la arquitectura backend de AgroBridge para guiar la integración de clientes externos (App Android).

## 📊 1. Inventario de Servicios (Directorio `apps/`)

A continuación se presenta el análisis de cada carpeta en el monorepo.

| Servicio | Estado | Puerto | Tamaño Aprox. | Descripción y Notas |
| :--- | :--- | :--- | :--- | :--- |
| **api** | 🟢 **ACTIVO (Monolito)** | **4000** | ~677 MB | **Backend Principal.** Contiene toda la lógica de negocio (Auth, Productores, Lotes, Eventos). Es un monolito modular bien estructurado. |
| **blockchain** | 🟡 **EN DESARROLLO** | N/A | ~4.8 MB | **Smart Contracts (Hardhat).** No es un servicio HTTP. Contiene contratos Solidity y scripts de despliegue. Se usa como librería interna o para tareas manuales. |
| **berry-service** | ⚪ PLACEHOLDER | N/A | ~96 KB | Carpeta casi vacía. Probable residuo de un intento previo de microservicios. |
| **api-gateway** | ⚪ PLACEHOLDER | N/A | 0 B | Carpeta vacía. No hay API Gateway separado implementado. |
| **auth-service** | ⚪ PLACEHOLDER | N/A | 0 B | Carpeta vacía. La autenticación vive dentro de `apps/api`. |
| **analytics-service** | ⚪ PLACEHOLDER | N/A | 0 B | Carpeta vacía. |
| **avocado-service** | ⚪ PLACEHOLDER | N/A | 0 B | Carpeta vacía. |
| **blockchain-service**| ⚪ PLACEHOLDER | N/A | 0 B | Carpeta vacía. |
| **certification-service** | ⚪ PLACEHOLDER | N/A | 0 B | Carpeta vacía. |
| **notification-service** | ⚪ PLACEHOLDER | N/A | 0 B | Carpeta vacía. |

> **Conclusión:** La arquitectura real es un **Monolito Modular** (`apps/api`) que centraliza toda la funcionalidad. Las carpetas vacías sugieren una intención futura de migrar a microservicios, pero **HOY no están operativas**.

---

## 🏗️ 2. Arquitectura Lógica Actual

No existe un API Gateway separado ni una malla de microservicios compleja. Todo el tráfico debe dirigirse al servicio `api`.

```mermaid
graph TD
    Android[App Android] -->|HTTP REST / JSON| API_Monolito
    NextJS[Frontend Web] -->|HTTP REST / JSON| API_Monolito
    
    subgraph "Backend Server (Puerto 4000)"
        API_Monolito[apps/api (Express + Node.js)]
        
        subgraph "Módulos Internos"
            Auth[Auth Module]
            Producers[Producer Module]
            Batches[Batch Module]
            Events[Events Module]
        end
        
        API_Monolito --> Auth
        API_Monolito --> Producers
        API_Monolito --> Batches
        API_Monolito --> Events
    end
    
    API_Monolito -->|Lee/Escribe| DB[(PostgreSQL)]
    API_Monolito -->|Cache/Sesiones| Redis[(Redis)]
    API_Monolito -.->|Despliegue Opcional| Blockchain[Smart Contracts (Polygon)]
```

**Puntos Clave:**
*   **Punto de Entrada Único:** `http://<TU_IP_LOCAL>:4000/api/v1/`
*   **Base de Datos Compartida:** Todos los módulos usan la misma instancia de PostgreSQL y Redis.
*   **Endpoints:** Todos están prefijados con `/api/v1`.

---

## 📱 3. Recomendación para App Android

### ¿A dónde conectarse?
Tu aplicación Android debe apuntar directamente al servicio `api` que ya tienes corriendo.

*   **Base URL (Desarrollo Local):** `http://10.0.2.2:4000/api/v1/` (Si usas Emulador Android estándar) o `http://<TU_IP_LAN>:4000/api/v1/` (Si usas dispositivo físico).
*   **No busques otros puertos:** Ignora puertos 5000, 8080, etc. Todo está en el 4000.

### Ubicación del Código Android
**RECOMENDACIÓN: Mantener en Desktop por ahora.**

*   **Razón:** Mover una app nativa (Gradle, Android Studio) a un monorepo de JavaScript (npm/pnpm workspaces) añade una complejidad innecesaria en este momento.
*   **Riesgos de Moverla:**
    *   Conflictos de configuración de CI/CD (mezclar Node.js con Java/Kotlin pipelines).
    *   El `package.json` raíz no sabrá qué hacer con el proyecto Android.
    *   Posibles problemas con rutas relativas en Android Studio.

**Estrategia:** Trata el repositorio `AgroBridgeInt.com` como tu "Backend Repo" y mantén tu carpeta en Desktop como "Mobile Repo". Intégralos solo a nivel de API (HTTP), no de código fuente.

---

## ✅ 4. Próximos Pasos (Plan de Acción)

### 🚨 Prioridad 1: HOY (Conexión Básica)
1.  **Configurar Base URL en Android:** Abre tu proyecto en Android Studio y asegura que Retrofit (o lo que uses) apunte a `http://10.0.2.2:4000/api/v1/` (Emulador) o tu IP local.
2.  **Probar Ping:** Intenta hacer un GET a `/status` desde la app Android. Deberías recibir `{"status": "ok"}`.
3.  **Limpieza Mental:** Puedes ignorar o incluso borrar localmente las carpetas vacías (`api-gateway`, `auth-service`, etc.) para reducir ruido visual, pero **no las borres del repo git** aún para no generar conflictos con el historial.

### 📅 Prioridad 2: ESTA SEMANA (Autenticación)
1.  **Login:** Implementa el flujo de login en Android contra `POST /api/v1/auth/login`.
2.  **Guardar Token:** Guarda el `accessToken` y `refreshToken` de la respuesta.
3.  **Headers:** Asegúrate de enviar el header `Authorization: Bearer <TOKEN>` en cada request subsiguiente.

### 🔮 Prioridad 3: FUTURO (Refinamiento)
1.  **Rate Limiting:** Si tu app hace muchos requests de sincronización, podrías topar con el Rate Limit del backend. Observa si recibes errores `429`.
2.  **Trace IDs:** Considera enviar un header `X-Trace-ID` generado en Android para facilitar el debugging cruzado si algo falla.

---

**Resumen para tu tranquilidad:**
No has roto nada. El proyecto tiene una estructura de carpetas "ambiciosa" (preparada para microservicios futuros) pero opera de forma **monolítica y segura** en `apps/api`. Conecta tu Android ahí y todo funcionará.
