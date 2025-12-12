# 📘 AgroBridge iOS - Documentación Completa

**Desarrollado por:** Alejandro Navarro Ayala - CEO & Senior Developer

**Proyecto:** AgroBridge iOS
**Versión:** 1.0.0
**Fecha:** 28 de Noviembre 2024
**Estado:** Fase 1 Completada (15%) → Iniciando Fase 2 (40%)

---

## 📑 Tabla de Contenidos

1. [Contexto del Proyecto](#1-contexto-del-proyecto)
2. [Auditoría del Código Original](#2-auditoría-del-código-original)
3. [Fase 1: Implementación Completada](#3-fase-1-implementación-completada)
4. [Fase 2: Plan de Implementación](#4-fase-2-plan-de-implementación)
5. [Arquitectura Técnica](#5-arquitectura-técnica)
6. [Convenciones y Estándares](#6-convenciones-y-estándares)
7. [Troubleshooting y Notas](#7-troubleshooting-y-notas)

---

## 1. Contexto del Proyecto

### 1.1 Visión General

AgroBridge es una plataforma AgTech empresarial que conecta productores agrícolas con compradores, gestionando:
- Trazabilidad de lotes y bloques de producción
- Gestión de productores y perfiles
- Análisis de datos en tiempo real
- Integración blockchain para certificación (fase futura)
- Sistema de sensores IoT para monitoreo de cultivos (fase futura)

### 1.2 Stack Tecnológico

**Backend (Producción)**
- Framework: Express.js + TypeScript
- Base de datos: PostgreSQL con Prisma ORM
- APIs: RESTful
- Cloud: AWS (EC2, RDS, S3)
- Base URL: `https://api.agrobridge.io/v1`

**Android (Referencia - 15% completado)**
- Lenguaje: Kotlin
- UI: Jetpack Compose
- Arquitectura: MVVM + Clean Architecture
- Networking: Retrofit + OkHttp
- Base de datos: Room
- Firebase: Analytics + Crashlytics

**iOS (Estado actual - 15% completado)**
- Lenguaje: Swift 5.9+
- UI: SwiftUI
- Target: iOS 15.0+
- Arquitectura: MVVM + Clean Architecture
- Networking: URLSession nativo
- Persistencia: Keychain Services
- Reactive: Combine

### 1.3 Objetivo del Proyecto iOS

Alcanzar **paridad completa (100%)** con la app Android en múltiples fases:

- ✅ **Fase 1 (15%):** Fundación - COMPLETADA
- 🚧 **Fase 2 (40%):** Features Core - EN PROGRESO
- 📋 **Fase 3 (30%):** Features Avanzadas
- 📋 **Fase 4 (15%):** Features Premium

---

## 2. Auditoría del Código Original

### 2.1 Hallazgos Críticos

**Situación encontrada:**
El directorio `/Users/mac/Desktop/App IOS/` contenía código Swift de un proyecto DIFERENTE llamado **"AgriChain Premium"**, NO AgroBridge.

**Proyecto encontrado vs. Proyecto esperado:**

| Aspecto | Esperado (AgroBridge) | Encontrado (AgriChain) |
|---------|----------------------|------------------------|
| Nombre | AgroBridge | AgriChain Premium |
| Propósito | Plataforma productores-compradores | Blockchain de trazabilidad |
| Backend | API REST en api.agrobridge.io | Sin backend (solo local) |
| Features | Login, Dashboard, Lotes, Productores | Blockchain mining, Sensores BLE, AR |
| Networking | ❌ No implementado | ❌ No implementado |
| Firebase | ❌ No configurado | ❌ No configurado |
| Proyecto Xcode | ❌ No existe | ❌ No existe |

**Archivos encontrados (AgriChain - 18 archivos):**
```
- ContentView.swift (580 líneas - MONOLÍTICO)
- DashboardView.swift (blockchain, no AgroBridge)
- AddBlockView.swift (crear bloque blockchain)
- BluetoothManager.swift (sensores BLE)
- BlockchainManager.swift (lógica blockchain)
- SensorDashboardView.swift (monitor sensores)
- ARContentView.swift (realidad aumentada)
- QRGeneratorView.swift (generador QR)
- AnalyticsView.swift (analytics blockchain)
- Blockchainview.swift
- QuickActionGrid.swift
- RecentBlocksView.swift
- Components.swift
```

### 2.2 Problemas Detectados

1. **Código duplicado masivo** - Vistas definidas múltiples veces en ContentView.swift
2. **Sin proyecto Xcode** - Solo archivos Swift sueltos
3. **Sin autenticación** - No hay login ni manejo de usuarios
4. **Sin networking** - Todo es local (UserDefaults)
5. **Sin Firebase** - No configurado
6. **Arquitectura inconsistente** - Mezcla de patrones

### 2.3 Decisión Tomada

**✅ EMPEZAR DESDE CERO**

Razones:
- El código existente no es reutilizable para AgroBridge
- Más rápido implementar desde cero que adaptar
- Arquitectura limpia desde el inicio
- Evita deuda técnica

---

## 3. Fase 1: Implementación Completada

### 3.1 Resumen de Fase 1

**Estado:** ✅ 100% COMPLETADA
**Duración:** 1 sesión intensiva
**Archivos creados:** 29 archivos (26 Swift + 3 MD)
**Líneas de código:** ~3,500 líneas
**Paridad con Android:** 15% alcanzado

### 3.2 Archivos Implementados

#### 3.2.1 App & Configuration (2 archivos)
```
App/AgroBridgeApp.swift                 # Entry point, TabView, navegación principal
Configuration/AppConfiguration.swift     # URLs, environments, feature flags
```

#### 3.2.2 Core Layer (10 archivos)
```
Core/Networking/
├── APIClient.swift                      # Cliente HTTP principal (async/await)
├── Endpoint.swift                       # Definición de endpoints
├── HTTPMethod.swift                     # GET, POST, PUT, PATCH, DELETE
└── NetworkError.swift                   # Errores de red personalizados

Core/Persistence/
└── KeychainManager.swift                # Almacenamiento seguro JWT

Core/Extensions/
├── Color+Extensions.swift               # Colores de marca AgroBridge
├── Date+Extensions.swift                # Formatters, validaciones
└── String+Extensions.swift              # Validación email, trim
```

#### 3.2.3 Models (3 archivos)
```
Models/User.swift                        # User, LoginRequest, LoginResponse, UserRole
Models/Lote.swift                        # Lote, CreateLoteRequest, LoteEstado, LoteMetadata
Models/DashboardStats.swift              # DashboardStats, EstadoConexion, Productor
```

#### 3.2.4 Services (3 archivos)
```
Services/AuthService.swift               # Login, logout, refresh token, session check
Services/LoteService.swift               # CRUD completo de lotes
Services/DashboardService.swift          # Fetch stats del dashboard
```

#### 3.2.5 ViewModels (3 archivos)
```
ViewModels/LoginViewModel.swift          # Validaciones, login logic
ViewModels/DashboardViewModel.swift      # Load/refresh stats
ViewModels/CreateLoteViewModel.swift     # Validaciones, create lote
```

#### 3.2.6 Views (7 archivos)
```
Views/Auth/LoginView.swift               # Pantalla de login
Views/Dashboard/DashboardView.swift      # Dashboard principal con StatCards
Views/Lote/CreateLoteView.swift          # Formulario crear lote

Views/Components/
├── StatCard.swift                       # Card de métrica
├── CustomButton.swift                   # Botón personalizado
├── CustomTextField.swift                # TextField con icono
└── LoadingView.swift                    # Loading states
```

#### 3.2.7 Documentación (3 archivos)
```
README.md                                # Documentación principal del proyecto
SETUP_GUIDE.md                           # Guía paso a paso de instalación
QUICKSTART.md                            # Setup rápido en 5 minutos
IMPLEMENTATION_SUMMARY.md                # Resumen técnico completo
```

### 3.3 Features Implementadas (Detalle)

#### Feature 1: Autenticación ✅ 100%

**Archivos:**
- `AuthService.swift` (194 líneas)
- `LoginViewModel.swift` (72 líneas)
- `LoginView.swift` (138 líneas)
- `KeychainManager.swift` (94 líneas)

**Funcionalidades:**
```swift
// Login
func login(email: String, password: String) async throws -> LoginResponse

// Logout
func logout() async

// Refresh Token
func refreshToken() async -> Bool

// Check Existing Session
func checkExistingSession()
```

**Endpoints:**
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`

**UI Features:**
- Validación email en tiempo real (regex)
- Validación password mínimo 6 caracteres
- Loading state durante login
- Error alerts con mensajes claros
- Show/hide password toggle
- Persistencia de sesión en Keychain
- Auto-logout en 401 Unauthorized

---

#### Feature 2: Dashboard ✅ 100%

**Archivos:**
- `DashboardService.swift` (54 líneas)
- `DashboardViewModel.swift` (46 líneas)
- `DashboardView.swift` (203 líneas)
- `StatCard.swift` (55 líneas)

**Funcionalidades:**
```swift
// Fetch Stats
func fetchStats() async throws -> DashboardStats

// Refresh
func refresh() async
```

**Endpoints:**
- `GET /dashboard/stats`

**UI Components:**
- 4 StatCards:
  - Total Productores (verde)
  - Lotes Activos (azul)
  - Bloques Certificados (verde success)
  - Estado Conexión (dinámico: verde/rojo/naranja)
- Grid de 4 Acciones Rápidas:
  - Crear Lote
  - Ver Lotes
  - Productores
  - Estadísticas
- Pull-to-refresh
- Loading state inicial
- Error handling con retry

---

#### Feature 3: Crear Lote ✅ 100%

**Archivos:**
- `LoteService.swift` (125 líneas)
- `CreateLoteViewModel.swift` (85 líneas)
- `CreateLoteView.swift` (198 líneas)

**Funcionalidades:**
```swift
// Create Lote
func createLote(_ request: CreateLoteRequest) async throws -> Lote

// Fetch Lotes
func fetchLotes() async throws

// Fetch by ID
func fetchLote(id: String) async throws -> Lote

// Update
func updateLote(id: String, request: CreateLoteRequest) async throws -> Lote

// Delete
func deleteLote(id: String) async throws
```

**Endpoints:**
- `POST /lotes`
- `GET /lotes`
- `GET /lotes/:id`
- `PUT /lotes/:id`
- `DELETE /lotes/:id`

**Formulario:**
- Nombre del lote * (obligatorio)
- Ubicación * (obligatorio)
- Tipo de cultivo * (obligatorio)
- Área en hectáreas (opcional, decimal)
- Notas adicionales (opcional, TextEditor)

**Validaciones:**
- Botón deshabilitado si campos obligatorios vacíos
- Parsing de área a Double
- Trim de espacios en strings

**UI Flow:**
1. Usuario llena formulario
2. Toca "Crear Lote"
3. Loading state (botón con spinner)
4. POST al backend
5. Success → Alert "Lote creado" → Cierra vista
6. Error → Alert con mensaje de error

---

#### Feature 4: Networking Layer ✅ 100%

**Archivos:**
- `APIClient.swift` (190 líneas)
- `Endpoint.swift` (68 líneas)
- `NetworkError.swift` (68 líneas)

**APIClient Features:**
```swift
// Request genérico con tipo de retorno
func request<T: Decodable>(
    endpoint: Endpoint,
    method: HTTPMethod,
    body: Encodable? = nil,
    headers: [String: String]? = nil
) async throws -> T

// Request sin response (DELETE, etc)
func requestWithoutResponse(...) async throws
```

**Características:**
- ✅ Async/await (NO callbacks)
- ✅ Genérico con Codable
- ✅ Interceptor JWT automático (Bearer token en header)
- ✅ JSON encoding/decoding con fechas ISO8601
- ✅ Timeouts configurables (30s default)
- ✅ Retry logic preparada
- ✅ Logging extensivo en modo DEBUG
- ✅ Error handling robusto

**NetworkError Cases:**
```swift
case invalidURL
case invalidResponse
case unauthorized          // 401 → Auto logout
case forbidden            // 403
case notFound             // 404
case serverError(statusCode: Int)  // 500+
case decodingError(Error)
case encodingError(Error)
case noInternetConnection
case timeout
case unknown(Error)
```

**Endpoints Definidos:**
```swift
// Auth
POST /auth/login
POST /auth/refresh
POST /auth/logout

// Dashboard
GET /dashboard/stats

// Lotes
GET /lotes
POST /lotes
GET /lotes/:id
PUT /lotes/:id
DELETE /lotes/:id

// Productores (preparado)
GET /productores
GET /productores/:id

// Bloques (preparado)
GET /bloques
GET /bloques/:id
```

---

### 3.4 Arquitectura MVVM + Clean

```
┌─────────────────────────────────────────┐
│         VIEWS (SwiftUI)                 │
│  - Declarativas, sin lógica             │
│  - Observan ViewModels                  │
└────────────────┬────────────────────────┘
                 │ @StateObject
                 │ @Published
                 ▼
┌─────────────────────────────────────────┐
│         VIEW MODELS                     │
│  - Lógica de presentación               │
│  - Validaciones de formularios          │
│  - Transformación de datos para UI      │
└────────────────┬────────────────────────┘
                 │ Llama a
                 ▼
┌─────────────────────────────────────────┐
│         SERVICES                        │
│  - Lógica de negocio                    │
│  - Orquestación de APIClient            │
│  - Manejo de estado global              │
└────────────────┬────────────────────────┘
                 │ Usa
                 ▼
┌─────────────────────────────────────────┐
│         API CLIENT                      │
│  - Networking genérico                  │
│  - HTTP requests                        │
│  - Error handling                       │
└────────────────┬────────────────────────┘
                 │ HTTP/JSON
                 ▼
          ┌──────────────┐
          │   BACKEND    │
          │ AgroBridge   │
          └──────────────┘
```

**Flujo de Datos:**
1. User toca botón en **View**
2. **View** llama método en **ViewModel**
3. **ViewModel** valida y llama **Service**
4. **Service** llama **APIClient**
5. **APIClient** hace HTTP request
6. Backend responde JSON
7. **APIClient** decodifica a Models
8. **Service** actualiza estado
9. **ViewModel** publica cambios (@Published)
10. **View** se re-renderiza (SwiftUI automático)

---

### 3.5 Convenciones de Código (Fase 1)

#### Naming
- **Archivos:** PascalCase (LoginView.swift)
- **Clases/Structs:** PascalCase (LoginViewModel)
- **Funciones/Variables:** camelCase (isLoading, fetchStats)
- **Constantes:** camelCase (authService)
- **Enums:** PascalCase (UserRole)

#### Comentarios
- **SIEMPRE en ESPAÑOL**
- Secciones con `// MARK: -`
- Explicar el "por qué", no el "qué"

#### Async/Await
```swift
// ✅ Correcto
func login() async throws -> User {
    let response = try await apiClient.request(...)
    return response.user
}

// ❌ Incorrecto (callbacks)
func login(completion: @escaping (Result<User, Error>) -> Void) {
    // NO usar callbacks
}
```

#### Error Handling
```swift
// En Services
do {
    let data = try await apiClient.request(...)
    return data
} catch {
    throw error  // Propagar
}

// En ViewModels
do {
    try await service.login()
} catch {
    errorMessage = (error as? NetworkError)?.errorDescription
    showError = true
}
```

---

## 4. Fase 2: Plan de Implementación

### 4.1 Objetivo de Fase 2

**Meta:** Alcanzar 55% de paridad total (15% actual + 40% nuevo)

**Features a implementar:**
1. Lista de Lotes con búsqueda y filtros (10%)
2. Detalle de Lote (5%)
3. Editar/Eliminar Lote (5%)
4. Gestión de Productores CRUD (15%)
5. Perfil de Usuario completo (5%)

### 4.2 Roadmap Detallado

#### 4.2.1 Lista de Lotes (10% - Prioridad 1)

**Archivos a crear:**
```
ViewModels/LotesListViewModel.swift
Views/Lote/LotesListView.swift
Views/Components/LoteCard.swift
Views/Components/SearchBar.swift
Views/Components/FilterSheet.swift
```

**Funcionalidades:**
- ✅ Lista de todos los lotes (GET /lotes)
- ✅ SearchBar para buscar por nombre
- ✅ Filtros:
  - Por tipo de cultivo
  - Por estado (activo, inactivo, etc.)
  - Por área (rango)
- ✅ Ordenar por: nombre, fecha, área
- ✅ Pull-to-refresh
- ✅ Paginación (si el backend lo soporta)
- ✅ Empty state cuando no hay lotes
- ✅ Loading skeleton
- ✅ Tap en lote → Navega a detalle

**UI:**
```
┌──────────────────────────────┐
│  🔍 Buscar lotes...      🎚  │
├──────────────────────────────┤
│  ┌────────────────────────┐  │
│  │ 🌿 Lote Norte          │  │
│  │ Aguacate • 5.5 ha      │  │
│  │ Valle Central          │  │
│  │ 🟢 Activo              │  │
│  └────────────────────────┘  │
│  ┌────────────────────────┐  │
│  │ 🍓 Lote Sur            │  │
│  │ Fresa • 2.3 ha         │  │
│  │ ...                    │  │
│  └────────────────────────┘  │
└──────────────────────────────┘
```

---

#### 4.2.2 Detalle de Lote (5% - Prioridad 2)

**Archivos a crear:**
```
ViewModels/LoteDetailViewModel.swift
Views/Lote/LoteDetailView.swift
Views/Components/InfoRow.swift
Views/Components/ActionButtonsRow.swift
```

**Funcionalidades:**
- ✅ Ver todos los datos del lote
- ✅ Mapa con ubicación GPS (si existe)
- ✅ Galería de fotos (si existen)
- ✅ Historial de cambios (si backend provee)
- ✅ Botones de acción:
  - Editar
  - Eliminar (con confirmación)
  - Compartir
- ✅ Datos del productor asociado

**UI:**
```
┌──────────────────────────────┐
│  ← Lote Norte                │
├──────────────────────────────┤
│  🌿 Lote Norte               │
│  📍 Valle Central            │
│  🌾 Tipo: Aguacate           │
│  📐 Área: 5.5 hectáreas      │
│  📅 Creado: 15 Nov 2024      │
│  🟢 Estado: Activo           │
│                              │
│  👤 Productor                │
│  Juan Pérez                  │
│                              │
│  📝 Notas                    │
│  Lote con buen rendimiento   │
│                              │
│  [ Editar ] [ Eliminar ]     │
└──────────────────────────────┘
```

---

#### 4.2.3 Editar/Eliminar Lote (5% - Prioridad 3)

**Archivos a crear:**
```
ViewModels/EditLoteViewModel.swift
Views/Lote/EditLoteView.swift
```

**Funcionalidades:**
- ✅ Reutilizar formulario de CreateLoteView
- ✅ Pre-llenar campos con datos actuales
- ✅ PUT /lotes/:id para guardar cambios
- ✅ DELETE /lotes/:id para eliminar
- ✅ Confirmación antes de eliminar
- ✅ Volver a lista después de eliminar

**Flow Editar:**
1. Usuario en LoteDetailView
2. Toca "Editar"
3. Abre EditLoteView (sheet)
4. Modifica campos
5. Toca "Guardar"
6. PUT al backend
7. Success → Actualiza detalle y lista

**Flow Eliminar:**
1. Usuario en LoteDetailView
2. Toca "Eliminar"
3. Alert de confirmación
4. Confirma → DELETE al backend
5. Success → Vuelve a lista
6. Lista actualizada sin el lote

---

#### 4.2.4 Gestión de Productores (15% - Prioridad 4)

**Archivos a crear:**
```
Models/Productor.swift (expandir el existente)
Services/ProductorService.swift
ViewModels/ProductoresListViewModel.swift
ViewModels/ProductorDetailViewModel.swift
ViewModels/CreateProductorViewModel.swift
Views/Productor/ProductoresListView.swift
Views/Productor/ProductorDetailView.swift
Views/Productor/CreateProductorView.swift
Views/Components/ProductorCard.swift
```

**Modelo Productor (completo):**
```swift
struct Productor: Codable, Identifiable {
    let id: String
    let nombre: String
    let email: String?
    let telefono: String?
    let direccion: String?
    let ubicacion: String?
    let documentoIdentidad: String?
    let tipoDocumento: TipoDocumento?
    let totalLotes: Int?
    let estado: ProductorEstado
    let fechaRegistro: Date?
    let metadata: ProductorMetadata?
}

enum ProductorEstado: String, Codable {
    case activo = "activo"
    case inactivo = "inactivo"
    case suspendido = "suspendido"
}

enum TipoDocumento: String, Codable {
    case dni = "DNI"
    case pasaporte = "Pasaporte"
    case ruc = "RUC"
}
```

**Endpoints:**
```
GET /productores
POST /productores
GET /productores/:id
PUT /productores/:id
DELETE /productores/:id
```

**Funcionalidades:**

**Lista de Productores:**
- Lista con SearchBar
- Filtros por estado
- Ver total de lotes por productor
- Tap → Detalle

**Crear Productor:**
- Formulario completo
- Validaciones (email, teléfono)
- POST al backend

**Detalle Productor:**
- Ver todos los datos
- Lista de lotes asociados
- Editar/Eliminar
- Ver estadísticas

---

#### 4.2.5 Perfil de Usuario (5% - Prioridad 5)

**Archivos a crear:**
```
ViewModels/ProfileViewModel.swift
Views/Profile/ProfileView.swift (reemplazar placeholder)
Views/Profile/EditProfileView.swift
Views/Profile/ChangePasswordView.swift
Views/Profile/SettingsView.swift
```

**Funcionalidades:**

**ProfileView:**
- Ver datos del usuario actual
- Avatar/Foto (placeholder por ahora)
- Nombre, Email, Rol
- Fecha de registro
- Botones:
  - Editar Perfil
  - Cambiar Contraseña
  - Configuración
  - Cerrar Sesión

**EditProfileView:**
- Editar nombre
- Editar email (con re-autenticación)
- Cambiar foto (futuro)

**ChangePasswordView:**
- Password actual
- Password nueva
- Confirmar password
- PUT /auth/change-password

**SettingsView:**
- Notificaciones (toggle)
- Idioma (futuro)
- Tema (dark/light)
- Acerca de
- Versión de la app

---

### 4.3 Orden de Implementación

**Sesión 1: Lista y Detalle de Lotes**
1. LotesListViewModel + LotesListView
2. LoteCard component
3. SearchBar component
4. LoteDetailViewModel + LoteDetailView

**Sesión 2: Editar/Eliminar + Productores Base**
5. EditLoteViewModel + EditLoteView
6. Delete confirmation
7. Modelo Productor completo
8. ProductorService

**Sesión 3: Productores CRUD**
9. ProductoresListViewModel + View
10. CreateProductorViewModel + View
11. ProductorDetailViewModel + View

**Sesión 4: Perfil de Usuario**
12. ProfileViewModel + ProfileView
13. EditProfileView
14. ChangePasswordView
15. SettingsView

---

## 5. Arquitectura Técnica

### 5.1 Estructura de Carpetas (Completa)

```
AgroBridge/
│
├── App/
│   └── AgroBridgeApp.swift
│
├── Configuration/
│   └── AppConfiguration.swift
│
├── Core/
│   ├── Networking/
│   │   ├── APIClient.swift
│   │   ├── Endpoint.swift
│   │   ├── HTTPMethod.swift
│   │   └── NetworkError.swift
│   ├── Persistence/
│   │   ├── KeychainManager.swift
│   │   └── UserDefaultsManager.swift (futuro)
│   ├── Extensions/
│   │   ├── Color+Extensions.swift
│   │   ├── Date+Extensions.swift
│   │   ├── String+Extensions.swift
│   │   └── View+Extensions.swift (futuro)
│   └── Utils/
│       ├── Logger.swift (futuro)
│       └── Validator.swift (futuro)
│
├── Models/
│   ├── User.swift
│   ├── Lote.swift
│   ├── Productor.swift
│   ├── DashboardStats.swift
│   └── Common.swift (tipos compartidos)
│
├── Services/
│   ├── AuthService.swift
│   ├── LoteService.swift
│   ├── ProductorService.swift
│   ├── DashboardService.swift
│   └── UserService.swift (futuro)
│
├── ViewModels/
│   ├── Auth/
│   │   └── LoginViewModel.swift
│   ├── Dashboard/
│   │   └── DashboardViewModel.swift
│   ├── Lote/
│   │   ├── LotesListViewModel.swift
│   │   ├── LoteDetailViewModel.swift
│   │   ├── CreateLoteViewModel.swift
│   │   └── EditLoteViewModel.swift
│   ├── Productor/
│   │   ├── ProductoresListViewModel.swift
│   │   ├── ProductorDetailViewModel.swift
│   │   └── CreateProductorViewModel.swift
│   └── Profile/
│       ├── ProfileViewModel.swift
│       └── SettingsViewModel.swift
│
└── Views/
    ├── Auth/
    │   └── LoginView.swift
    ├── Dashboard/
    │   └── DashboardView.swift
    ├── Lote/
    │   ├── LotesListView.swift
    │   ├── LoteDetailView.swift
    │   ├── CreateLoteView.swift
    │   └── EditLoteView.swift
    ├── Productor/
    │   ├── ProductoresListView.swift
    │   ├── ProductorDetailView.swift
    │   └── CreateProductorView.swift
    ├── Profile/
    │   ├── ProfileView.swift
    │   ├── EditProfileView.swift
    │   ├── ChangePasswordView.swift
    │   └── SettingsView.swift
    ├── Components/
    │   ├── StatCard.swift
    │   ├── CustomButton.swift
    │   ├── CustomTextField.swift
    │   ├── LoadingView.swift
    │   ├── LoteCard.swift (nuevo)
    │   ├── ProductorCard.swift (nuevo)
    │   ├── SearchBar.swift (nuevo)
    │   ├── FilterSheet.swift (nuevo)
    │   └── InfoRow.swift (nuevo)
    └── Common/
        ├── EmptyStateView.swift (nuevo)
        └── ErrorView.swift (nuevo)
```

---

## 6. Convenciones y Estándares

### 6.1 Código

**Comentarios:**
- Siempre en ESPAÑOL
- Usar `// MARK: -` para secciones
- Explicar decisiones complejas
- No comentar código obvio

**Naming:**
```swift
// Archivos
LoginView.swift
LoteService.swift

// Tipos
struct User { }
class APIClient { }
enum NetworkError { }

// Propiedades
@Published var isLoading = false
private let apiClient = APIClient.shared

// Funciones
func fetchLotes() async throws
private func validateForm() -> Bool
```

**Async/Await:**
```swift
// ✅ Usar async/await
func login() async throws -> User

// ❌ NO usar callbacks
func login(completion: @escaping (Result<User, Error>) -> Void)
```

**Error Handling:**
```swift
// Servicios: propagar errores
throw NetworkError.unauthorized

// ViewModels: capturar y manejar
catch {
    errorMessage = error.localizedDescription
    showError = true
}
```

### 6.2 UI/UX

**Loading States:**
- Siempre mostrar ProgressView durante operaciones async
- Deshabilitar botones durante loading
- Texto descriptivo: "Cargando...", "Guardando...", etc.

**Error Handling:**
- Mostrar alerts con mensajes claros
- Opción de "Reintentar" cuando sea posible
- Logging en consola para debugging

**Empty States:**
- Icono grande
- Título descriptivo
- Mensaje de ayuda
- Botón de acción (ej: "Crear Primer Lote")

**Navegación:**
- NavigationView para stacks
- Sheet para modales
- TabView para tabs principales

---

## 7. Troubleshooting y Notas

### 7.1 Problemas Comunes

**Error de compilación: "No such module"**
```bash
# Limpiar build
Cmd + Shift + K
# Reset package caches
rm -rf ~/Library/Developer/Xcode/DerivedData
```

**Login falla con NetworkError**
- Verificar que backend esté corriendo
- Revisar URL en AppConfiguration.swift
- Verificar logs en consola de Xcode

**Keychain errors en simulador**
```bash
# Reset simulador
xcrun simctl erase all
```

### 7.2 Backend Endpoints Reference

**Base URL:** `https://api.agrobridge.io/v1`

**Headers:**
```
Content-Type: application/json
Accept: application/json
Authorization: Bearer {token}  # Excepto en login
```

**Autenticación:**
```http
POST /auth/login
Body: { "email": "...", "password": "..." }
Response: { "token": "...", "user": {...} }

POST /auth/refresh
Body: { "refreshToken": "..." }
Response: { "token": "..." }

POST /auth/logout
Headers: Authorization
```

**Lotes:**
```http
GET /lotes
GET /lotes/:id
POST /lotes
PUT /lotes/:id
DELETE /lotes/:id
```

**Productores:**
```http
GET /productores
GET /productores/:id
POST /productores
PUT /productores/:id
DELETE /productores/:id
```

---

## 📝 Changelog

### Fase 1 (15%) - Completada
- ✅ Arquitectura MVVM + Clean
- ✅ Autenticación completa
- ✅ Dashboard con estadísticas
- ✅ Crear lote
- ✅ Networking layer
- ✅ Componentes UI reutilizables
- ✅ Documentación completa

### Fase 2 (40%) - En Progreso
- 🚧 Lista de lotes
- 📋 Detalle de lote
- 📋 Editar/Eliminar lote
- 📋 Gestión de productores
- 📋 Perfil de usuario

---

**Última actualización:** 28 de Noviembre 2024
**Próxima fase:** Fase 2 - Features Core (40%)
**Objetivo final:** 100% de paridad con Android
