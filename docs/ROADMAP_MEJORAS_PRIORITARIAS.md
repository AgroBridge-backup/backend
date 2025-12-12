# 🛣️ Roadmap de Mejoras Prioritarias - AgroBridge Android

**Fecha:** November 28, 2024
**Estado:** 📋 Planificación Estratégica
**Basado en:** Análisis exhaustivo de codebase (200+ criterios evaluados)

---

## 📊 Executive Summary

Después de un análisis exhaustivo del codebase, hemos identificado **42 oportunidades de mejora** organizadas en **3 niveles de prioridad**:

| Nivel | Cantidad | Esfuerzo Total | Impacto |
|-------|----------|----------------|---------|
| 🔴 **CRÍTICO** | 4 | 2 semanas | Muy Alto |
| 🟠 **ALTO** | 11 | 4 semanas | Alto |
| 🟡 **MEDIO** | 19 | 6 semanas | Medio |
| 🟢 **BAJO** | 8 | 2 semanas | Bajo |

**Tiempo Total Estimado:** 14 semanas | **Equipo Recomendado:** 2 ingenieros

---

## 🔴 TIER 1: CRÍTICO (2 Semanas)

Estos son bloqueadores para producción. **DEBEN completarse antes del launch.**

### 1. Completar Repository Interface ⚠️ BLOQUEADOR

**Problema:**
```kotlin
// ❌ Interface incompleta
interface LoteRepository {
    fun getLotes(): Flow<List<Lote>>
    fun getActiveLotes(): Flow<List<Lote>>
    // FALTA:
    // fun createLote(lote: Lote): Result<Unit>
    // fun updateLote(id: String, lote: Lote): Result<Unit>
    // fun getPendingLotes(): List<Lote>
    // fun getPendingLotesCount(): Int
}

// ✅ Implementación existe pero sin interfaz
class LoteRepositoryImpl {
    fun createLote(lote: Lote): Result<Unit> { ... }  // Sin contrato
}
```

**Impacto:** Tests y inyección de dependencias fallan para crear/actualizar lotes

**Fix Tiempo:** 30 minutos
**Pasos:**
1. Agregar métodos a `LoteRepository` interface:
   ```kotlin
   suspend fun createLote(lote: Lote): Result<Unit>
   suspend fun updateLote(loteId: String, lote: Lote): Result<Unit>
   fun getPendingLotes(): Flow<List<Lote>>
   fun getPendingLotesCount(): Flow<Int>
   ```
2. Verificar implementación en `LoteRepositoryImpl`
3. Ejecutar tests

**Archivo:** `app/src/main/java/com/agrobridge/data/repository/LoteRepository.kt`

---

### 2. Seguridad: API Keys en Keystore ⚠️ BLOQUEADOR

**Problema:**
```kotlin
// ❌ Hardcodeado en build.gradle - visible en APK disassembly
buildConfigField("String", "OPENWEATHER_API_KEY", "\"YOUR_OPENWEATHER_API_KEY\"")
buildConfigField("String", "MAPS_API_KEY", "\"YOUR_MAPS_API_KEY\"")

// Un atacante con 10 minutos puede extraer las claves:
// apktool decode app.apk → buscar buildConfigField
```

**Riesgo:** API quota robbery, datos de productor comprometidos

**Fix Tiempo:** 1 hora

**Solución (Opción A - Recomendada para Desarrollo):**
```kotlin
// En local.properties (⚠️ NUNCA committed a git)
OPENWEATHER_API_KEY=tu_key_real
MAPS_API_KEY=tu_key_real

// En build.gradle.kts
val openWeatherKey = project.findProperty("OPENWEATHER_API_KEY")?.toString()
    ?: "MISSING_KEY"
buildConfigField("String", "OPENWEATHER_API_KEY", "\"$openWeatherKey\"")
```

**Solución (Opción B - Para Producción):**
```kotlin
// Usar AWS Secrets Manager o similar en backend
// Backend devuelve API keys firmadas al app después de autenticar
// App nunca almacena claves, siempre las obtiene del servidor
```

**Pasos:**
1. Mover keys a `local.properties`
2. Agregar a `.gitignore`:
   ```
   local.properties
   *.jks
   *.keystore
   ```
3. Actualizar `build.gradle.kts` para leer desde properties
4. Documentar en `SETUP.md`: "Crear local.properties con tus API keys"

**Archivos:**
- `app/build.gradle.kts` (líneas 28-29)
- `.gitignore`

---

### 3. Refactorizar Screens con ViewModels ⚠️ BLOQUEADOR

**Problema:**
```kotlin
// ❌ LotesListScreen - Usando state local, NO ViewModel
@Composable
fun LotesListScreen(onNavigateBack: () -> Unit, onNavigateToLote: (String) -> Unit) {
    var lotes by remember { mutableStateOf(emptyList<Lote>()) }  // ❌ Perdido en recomposición

    LaunchedEffect(Unit) {
        // Mock delay, no datos reales
        delay(800)
        lotes = emptyList()
    }
}

// ✅ Debería ser:
@Composable
fun LotesListScreen(
    viewModel: LotesViewModel = hiltViewModel(),  // Inyectado
    onNavigateBack: () -> Unit,
    onNavigateToLote: (String) -> Unit
) {
    val lotesState by viewModel.lotesState.collectAsState()

    LaunchedEffect(Unit) {
        viewModel.loadLotes()
    }
}
```

**Screens Afectadas:**
1. `LotesListScreen` - sin ViewModel
2. `LoteDetailScreen` - sin ViewModel
3. `DashboardScreen` - usando mock data

**Fix Tiempo:** 3 horas (por screen)

**Pasos por Screen:**
1. Inyectar `ViewModel` vía `hiltViewModel()`
2. Colectar state flows
3. Eliminar `LaunchedEffect` mock delays
4. Conectar callbacks a ViewModel actions
5. Actualizar tests

**Archivos:**
- `app/src/main/java/com/agrobridge/presentation/screens/lote/LotesListScreen.kt`
- `app/src/main/java/com/agrobridge/presentation/screens/lote/LoteDetailScreen.kt`
- `app/src/main/java/com/agrobridge/presentation/screens/dashboard/DashboardScreen.kt`

**Crear:**
- `app/src/main/java/com/agrobridge/presentation/screens/lote/LotesViewModel.kt`
- `app/src/main/java/com/agrobridge/presentation/screens/lote/LoteDetailViewModel.kt`
- `app/src/main/java/com/agrobridge/presentation/screens/dashboard/DashboardViewModel.kt`

---

### 4. Crear ProGuard Rules para Release Build ⚠️ BLOQUEADOR

**Problema:**
```kotlin
// ❌ Release APK sin ProGuard rules
isMinifyEnabled = true  // Habilitado pero sin reglas = crash en producción
isShrinkResources = true
proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
// ❌ proguard-rules.pro está vacío o no existe
```

**Riesgo:**
- App crashea cuando Hilt intenta inyectar dependencias (clases renombradas)
- Room database no encuentra entidades
- Retrofit no serializa JSON

**Fix Tiempo:** 1.5 horas

**Crear:** `app/proguard-rules.pro`

```proguard
# =============================================================================
# HILT - Dependency Injection
# =============================================================================
-keep class hilt_aggregated_deps.** { *; }
-keep class **_Hilt_* { *; }
-keep class dagger.** { *; }
-keep interface dagger.** { *; }
-keep class javax.inject.** { *; }
-keep @javax.inject.Qualifier class * { *; }
-keep @dagger.Module class * { *; }
-keep @dagger.hilt.** class * { *; }

# =============================================================================
# ROOM DATABASE
# =============================================================================
-keep class androidx.room.** { *; }
-keep @androidx.room.Entity class * {
    public <init>(...);
}
-keep @androidx.room.Dao interface * { *; }
-keep @androidx.room.Database class * { *; }
-keepclassmembers class * {
    @androidx.room.* <fields>;
}

# =============================================================================
# RETROFIT + GSON
# =============================================================================
-keep class com.squareup.retrofit2.** { *; }
-keep interface com.squareup.retrofit2.** { *; }
-keep class com.google.gson.** { *; }
-keep interface com.google.gson.** { *; }
-keep class okhttp3.** { *; }
-keep interface okhttp3.** { *; }

-keepattributes Signature
-keepattributes *Annotation*

# Keep JSON serializable fields
-keep class * extends java.io.Serializable {
    static final long serialVersionUID;
    !static !transient <fields>;
    private static final java.io.ObjectStreamField[] serialPersistentFields;
    !static !transient <methods>;
}

# =============================================================================
# KOTLINX SERIALIZATION
# =============================================================================
-keep class kotlinx.serialization.** { *; }
-keep @kotlinx.serialization.Serializable class * { *; }
-keepclassmembers class * {
    @kotlinx.serialization.Serializable <methods>;
}

# =============================================================================
# COROUTINES
# =============================================================================
-keep class kotlinx.coroutines.** { *; }
-keep interface kotlinx.coroutines.** { *; }

# =============================================================================
# ANDROIDX
# =============================================================================
-keep class androidx.lifecycle.** { *; }
-keep interface androidx.lifecycle.** { *; }
-keep class androidx.compose.** { *; }
-keep interface androidx.compose.** { *; }

# =============================================================================
# DATA CLASSES (AgroBridge Models)
# =============================================================================
-keep class com.agrobridge.data.model.** { *; }
-keep class com.agrobridge.data.dto.** { *; }
-keep class com.agrobridge.data.local.entity.** { *; }
-keep class com.agrobridge.presentation.model.** { *; }

# =============================================================================
# TIMBER LOGGING
# =============================================================================
-keep class timber.log.Timber { *; }

# =============================================================================
# OPTIMIZATION
# =============================================================================
-optimizationpasses 5
-allowaccessmodification
-dontobfuscate
```

**Pasos:**
1. Crear archivo `app/proguard-rules.pro`
2. Copiar reglas arriba
3. Test: `./gradlew assembleRelease --info`
4. Verificar que release APK se crea sin warnings

---

## 🟠 TIER 2: ALTO (4 Semanas)

Estos mejoran calidad y estabilidad. **Recomendado antes de beta.**

### 5. Suite Completa de Tests

**Tests Faltantes (0% coverage actual):**

**Prioridad 1: Repository Tests** (1.5 semanas)
```kotlin
// Crear: app/src/test/java/com/agrobridge/data/repository/LoteRepositoryImplTest.kt
class LoteRepositoryImplTest {
    @Test
    fun testRefreshLotes_Success() { /* ... */ }

    @Test
    fun testRefreshLotes_NetworkError_UsesCachedData() { /* ... */ }

    @Test
    fun testCreateLote_Offline_MarksPending() { /* ... */ }

    @Test
    fun testCreateLote_Online_SyncsImmediately() { /* ... */ }

    @Test
    fun testUpdateLote_ConflictResolution() { /* ... */ }

    @Test
    fun testSyncWorker_ProcessesPendingLotes() { /* ... */ }
}
```

**Prioridad 2: Database Integration Tests** (1 week)
```kotlin
// Crear: app/src/androidTest/java/com/agrobridge/data/local/dao/LoteDaoTest.kt
class LoteDaoTest {
    @Test
    fun testInsertAndRetrieveLote() { /* ... */ }

    @Test
    fun testQueryPerformance_1000Items() { /* ... */ }

    @Test
    fun testIndexEffectiveness() { /* ... */ }
}
```

**Prioridad 3: UI Component Tests** (1 week)
```kotlin
// Crear: app/src/androidTest/java/com/agrobridge/presentation/screens/DashboardScreenTest.kt
class DashboardScreenTest {
    @get:Rule val composeTestRule = createComposeRule()

    @Test
    fun testMetricsCalculation() { /* ... */ }

    @Test
    fun testNavigateToLoteDetail() { /* ... */ }
}
```

**Metric Goal:** Reach 60% code coverage (from 0%)

---

### 6. Optimización de Base de Datos

**Agregar Índices:**
```kotlin
// En LoteEntity.kt
@Entity(
    tableName = "lotes",
    indices = [
        Index("productorId"),           // Para filtros by productor
        Index("estado"),                // Para filtros by estado
        Index("localSyncTimestamp"),    // Para ordenamiento
        Index(arrayOf("productorId", "estado"))  // Índice compuesto
    ]
)
data class LoteEntity(...)
```

**Optimizar Queries:**
```kotlin
// Antes: Carga coordenadas completas
@Query("SELECT * FROM lotes")
fun getAllLotes(): Flow<List<LoteEntity>>

// Después: Projection para lista (sin coords)
@Query("SELECT id, nombre, cultivo, estado FROM lotes")
fun getLotesSummary(): Flow<List<LoteSummary>>

// Y para detalle (con coords)
@Query("SELECT * FROM lotes WHERE id = :loteId")
suspend fun getLoteDetail(loteId: String): LoteEntity
```

**Refactorizar Transacciones:**
```kotlin
// Antes: DELETE + INSERT (2 operaciones)
@Transaction
suspend fun refreshLotes(lotes: List<LoteEntity>) {
    deleteAll()
    insertAll(lotes)
}

// Después: REPLACE (1 operación, 2x más rápido)
@Insert(onConflict = OnConflictStrategy.REPLACE)
suspend fun insertLotes(lotes: List<LoteEntity>)
```

**Tiempo:** 1-2 semanas

---

### 7. Imagen Caching con Coil

**Problema:** Coil dependency added pero nunca usado

**Solución:**
```kotlin
// En AgroBridgeApplication.kt
override fun onCreate() {
    super.onCreate()

    // Configurar Coil image loader
    val imageLoader = ImageLoader.Builder(this)
        .crossfade(true)
        .diskCachePolicy(CachePolicy.ENABLED)
        .diskCacheSize(100 * 1024 * 1024)  // 100MB
        .memoryCachePolicy(CachePolicy.ENABLED)
        .memoryCache { size = 32 * 1024 * 1024 }  // 32MB
        .build()

    Coil.setImageLoader(imageLoader)
}

// En screens, reemplazar Image() con AsyncImage()
AsyncImage(
    model = lote.fotoUrl,
    contentDescription = "Foto del lote ${lote.nombre}",
    modifier = Modifier.size(200.dp),
    contentScale = ContentScale.Crop,
    placeholder = painterResource(id = R.drawable.placeholder_lote),
    fallback = painterResource(id = R.drawable.placeholder_lote),
)
```

**Tiempo:** 3-4 hours

---

### 8. Permisos con Accompanist (Already Depended)

**Crear:** `PermissionManager.kt`

```kotlin
@Composable
fun CameraPermissionScreen(
    onPermissionGranted: () -> Unit,
    content: @Composable () -> Unit
) {
    val cameraPermissionState = rememberPermissionState(
        permission = android.Manifest.permission.CAMERA,
        onPermissionResult = { isGranted ->
            if (isGranted) onPermissionGranted()
        }
    )

    when {
        cameraPermissionState.hasPermission -> content()
        cameraPermissionState.shouldShowRationale -> {
            AlertDialog(
                onDismissRequest = { },
                title = { Text("Permiso de Cámara") },
                text = { Text("Necesitamos acceso a tu cámara para escanear cultivos") },
                confirmButton = {
                    Button(onClick = { cameraPermissionState.launchPermissionRequest() }) {
                        Text("Permitir")
                    }
                }
            )
        }
        else -> {
            Button(onClick = { cameraPermissionState.launchPermissionRequest() }) {
                Text("Permitir Cámara")
            }
        }
    }
}
```

**Tiempo:** 4-5 hours

---

### 9. Accessibility - Content Descriptions

**Agregar en todos los composables:**

```kotlin
// ❌ Antes
Icon(
    imageVector = Icons.Default.Home,
    contentDescription = null  // ❌ Invisible para lectores de pantalla
)

// ✅ Después
Icon(
    imageVector = Icons.Default.Home,
    contentDescription = "Pantalla de Inicio",
    modifier = Modifier.semantics {
        contentDescription = "Botón para ir a inicio"
    }
)
```

**Screens a Actualizar:**
- `Cards.kt` - Emoji descriptions
- `Buttons.kt` - Button labels
- `LotesListScreen.kt` - List item descriptions
- `MapScreen.kt` - Map marker descriptions

**Tiempo:** 3-4 hours

---

### 10. Resolver 36+ TODOs

**Por Categoría:**

**TODOs en Screens (18):**
- ❌ Dashboard: Notifications, Profile, Scanner, Reports (4 TODOs)
- ❌ LotesListScreen: Search, Options, Create (3 TODOs)
- ❌ MapScreen: Create lote from map, Location (2 TODOs)

**Implementar:**
```kotlin
// Dashboard - Notifications TODO
NavLink("Notificaciones", Icons.Default.Notifications) {
    viewModel.navigateToNotifications()
}

// LotesListScreen - Search TODO
SearchBar(
    query = searchQuery,
    onQueryChange = { searchQuery = it },
    placeholder = "Buscar lote..."
)
```

**Tiempo:** 2 weeks (depende de complejidad)

---

### 11. Base de Datos - Query Optimization

**Problemas Identificados:**
- No hay proyecciones (carga todos los campos)
- No hay índices de búsqueda
- Transacciones ineficientes

**Plan:**
1. Crear `LoteSummary` data class (solo campos para lista)
2. Agregar `@Index` en LoteEntity
3. Refactorizar `refreshLotes()` para usar REPLACE
4. Test: Medir mejora de performance

**Tiempo:** 1 week

---

## 🟡 TIER 3: MEDIO (6 Semanas)

### 12. Compose Stability - ImmutableList

**Refactorizar UIState a usar ImmutableList:**

```kotlin
// Antes
data class UIState<T>(
    val data: List<T> = emptyList()  // ❌ Recomposición en cada cambio
)

// Después
data class UIState<T>(
    val data: ImmutableList<T> = persistentListOf()  // ✅ Smart recomposition
)
```

**Beneficio:** 30-40% menos recomposiciones en listas largas

**Tiempo:** 1 week

---

### 13. Soporte para Tablet (Responsive Design)

**Implementar WindowSizeClass:**

```kotlin
@Composable
fun DashboardScreen(windowSize: WindowSizeClass) {
    when (windowSize.widthSizeClass) {
        WindowWidthSizeClass.Compact -> SinglePaneLayout()
        WindowWidthSizeClass.Medium -> TwoColumnLayout()
        WindowWidthSizeClass.Expanded -> ThreeColumnLayout()
    }
}
```

**Tiempo:** 2 weeks

---

### 14. Documentación Completa

**Crear:**
- ✅ `README.md` - Visión general y setup
- ✅ `docs/ARCHITECTURE.md` - Diagramas y explicación
- ✅ `docs/API.md` - Endpoints y schemas
- ✅ `docs/SETUP.md` - Guía de desarrollo
- ✅ `docs/CODE_STYLE.md` - Convenciones
- ✅ `docs/TROUBLESHOOTING.md` - Problemas comunes

**Tiempo:** 1 week

---

### 15. CI/CD Completo

**Crear `.github/workflows/`:**
- Android build + test on push
- APK upload to artifacts
- Test reports generation
- Release signing

**Tiempo:** 1.5 weeks

---

## 🟢 TIER 4: BAJO (2 Semanas)

### 16-23. Mejoras Menores

- Centralizar magic numbers
- Remover dead code (mockLotes)
- Agregar @Preview composables
- Dark mode testing
- Lint rules personalizadas
- Analytics integration
- Etc.

---

## 📅 Plan de Implementación Recomendado

### **Phase 1: Estabilidad (2 semanas)**
1. ✅ Repository interface
2. ✅ API keys security
3. ✅ ProGuard rules
4. ✅ ViewModel integration en screens

**Objetivo:** Código productionizable

### **Phase 2: Calidad (4 semanas)**
5. ✅ Test suite completa
6. ✅ Database optimization
7. ✅ Compose Stability
8. ✅ Resolución de TODOs

**Objetivo:** 60%+ test coverage, performance optimizado

### **Phase 3: Pulido (4 semanas)**
9. ✅ Documentación completa
10. ✅ CI/CD setup
11. ✅ Responsive design
12. ✅ Accessibility fixes

**Objetivo:** Production-ready, maintainable

---

## 🎯 Success Metrics

| Métrica | Antes | Target | Timeline |
|---------|-------|--------|----------|
| Test Coverage | 0% | 60% | 4 weeks |
| Build Time | ~40s | <35s | 2 weeks |
| APK Size | TBD | <50MB | 6 weeks |
| Performance (LazyColumn 1000 items) | Laggy | Smooth 60fps | 4 weeks |
| Crash Rate | TBD | <0.1% | Throughout |
| Security Issues | API keys exposed | Zero | 1 week |

---

## 💡 Recomendación Final

**Start with Tier 1 (CRÍTICO):** Estos son bloqueadores verdaderos. Sin ellos, la app no debería ir a producción.

**En paralelo:**
- Tier 1 (blocking): 2 people
- Tier 2 (testing/optimization): 1 person
- Tier 3 (documentation): 1 person

**Timeline realista:** 12-14 semanas con equipo de 2-3 personas

¿Quieres que comencemos con el Tier 1 de inmediato? Puedo implementar los 4 items críticos en la próxima sesión.

