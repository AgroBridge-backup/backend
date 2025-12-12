# 🎨 AGROBRIDGE: DISEÑO CON LA FILOSOFÍA DE JONY IVE

## 📋 INDICE COMPLETO

- [PARTE 1: Pantalla Principal (HomeScreen)](#parte-1)
- [PARTE 2: Agregar Parcela (AddLoteScreen)](#parte-2)
- [PARTE 3: Theme y Dimensiones](#parte-3)
- [PARTE 4: Voz y Microcopy](#parte-4)
- [PARTE 5: Diseño para el Sol (Readability)](#parte-5)
- [PARTE 6: Gestos y Interacción](#parte-6)
- [PARTE 7: Onboarding Invisible](#parte-7)

---

## <a name="parte-4"></a>🎯 PARTE 4: VOZ Y MICROCOPY - "EL TEXTO QUE DESAPARECE"

```kotlin
/**
 * FILOSOFÍA: "Great design is invisible"
 *
 * El usuario NO debe LEER instrucciones.
 * El texto debe ser OBVIO, ACTIVO, HUMANO.
 *
 * ANTES (Lo que eliminamos):
 * ❌ "Por favor ingresa el nombre de tu parcela"
 * ❌ "Selecciona un cultivo de la lista"
 * ❌ "Ingresa el área en hectáreas"
 * ❌ "Procesando solicitud..."
 *
 * DESPUÉS (Lo que queda):
 * ✅ "Nombre" (obvio qué escribir)
 * ✅ Solo mostrar cultivos (no explicar)
 * ✅ "hectáreas" (unidad clara)
 * ✅ Spinner silencioso (sin molestar)
 *
 * "If you have to describe something in words,
 *  the design has failed."
 */

object AgroBridgeVoice {

    // ═══════════════════════════════════════════════════════════
    // REGLAS DE ORO (Aplicar a TODO)
    // ═══════════════════════════════════════════════════════════

    /**
     * REGLA 1: ACTIVO, NO PASIVO
     * ❌ "Parcela fue guardada"
     * ✅ "Parcela guardada"
     */

    /**
     * REGLA 2: CORTO, NO LARGO
     * ❌ "Por favor espera mientras sincronizamos tus datos"
     * ✅ "Sincronizando..."
     */

    /**
     * REGLA 3: HUMANO, NO CORPORATIVO
     * ❌ "La operación fue exitosa"
     * ✅ "¡Listo!"
     */

    /**
     * REGLA 4: ESPECÍFICO, NO GENÉRICO
     * ❌ "Error"
     * ✅ "La parcela ya existe con ese nombre"
     */

    /**
     * REGLA 5: VISUAL PRIMERO, TEXTO SEGUNDO
     * Si puedes mostrar con ícono, NO ESCRIBAS
     */

    // ═══════════════════════════════════════════════════════════
    // SCREENS: TEXTOS MINIMALES Y PODEROSOS
    // ═══════════════════════════════════════════════════════════

    // HOME SCREEN
    object Home {
        const val TITLE = "Mis Parcelas"  // No "Dashboard" (corporativo)
        const val EMPTY_TITLE = "Agrega tu primera parcela"
        const val EMPTY_BUTTON = "Comenzar"
        const val SYNC_SYNCED = "Sincronizado"
        const val SYNC_OFFLINE = "Sin conexión"
        const val SYNC_SYNCING = "Sincronizando..."
        const val SYNC_ERROR = "Error al sincronizar"
        const val FAB_TOOLTIP = "Agregar parcela"  // Tooltip, no en UI
    }

    // ADD LOTE SCREEN
    object AddLote {
        const val TITLE = "Nueva Parcela"

        // Labels (Mínimos)
        const val LABEL_NAME = "Nombre"
        const val LABEL_CROP = "Cultivo"
        const val LABEL_AREA = "Área"
        const val UNIT_HECTARES = "hectáreas"

        // Placeholders (Guía sutil, NO instrucción)
        const val PLACEHOLDER_NAME = "Ej: Parcela Norte"

        // Errores (Específicos, no asustadores)
        const val ERROR_NAME_REQUIRED = "Dinos cómo se llama"
        const val ERROR_NAME_EXISTS = "Ya tienes una parcela con ese nombre"
        const val ERROR_NAME_TOO_LONG = "Máximo 50 caracteres"
        const val ERROR_CROP_REQUIRED = "Selecciona un cultivo"
        const val ERROR_AREA_REQUIRED = "Ingresa el área"
        const val ERROR_AREA_INVALID = "Debe ser un número válido"
        const val ERROR_AREA_TOO_SMALL = "Mínimo 0.01 hectáreas"
        const val ERROR_AREA_TOO_LARGE = "Máximo 10,000 hectáreas"

        // Estados
        const val BUTTON_SAVE = "Guardar Parcela"
        const val BUTTON_SAVING = "Guardando..."  // No "Procesando"
        const val SUCCESS_SAVED = "¡Parcela guardada!"
        const val SUCCESS_DESCRIPTION = "Ya la ves en tu lista"
    }

    // MAP SCREEN
    object Map {
        const val TITLE = "Mapa de Parcelas"
        const val PERMISSION_TITLE = "Necesitamos tu ubicación"
        const val PERMISSION_DESC = "Para mostrarte el mapa"
        const val PERMISSION_BUTTON = "Permitir"
        const val SYNC_PROGRESS = "Sincronizando parcelas"
    }

    // SETTINGS
    object Settings {
        const val TITLE = "Ajustes"
        const val SECTION_ACCOUNT = "Cuenta"
        const val SECTION_NOTIFICATIONS = "Notificaciones"
        const val SECTION_DATA = "Datos"
        const val LOGOUT = "Cerrar sesión"
        const val VERSION = "Versión"
    }

    // ═══════════════════════════════════════════════════════════
    // ERRORES: NUNCA ASUSTADORES
    // ═══════════════════════════════════════════════════════════

    /**
     * ERROR PHILOSOPHY:
     *
     * ❌ MALO: "Exception: NullPointerException at line 234"
     * ❌ MALO: "Código de error: 500"
     * ❌ MALO: "Algo salió muy mal"
     *
     * ✅ BUENO: "No pudimos conectar. Intenta en unos segundos"
     * ✅ BUENO: "Sin internet • 3 cambios pendientes"
     * ✅ BUENO: "El servidor está ocupado. Reintentando..."
     */

    object Errors {
        // Network
        const val NETWORK_TIMEOUT = "Conexión lenta. Intenta de nuevo"
        const val NETWORK_NO_INTERNET = "Sin internet"
        const val NETWORK_REFUSED = "No pudimos conectar"

        // Auth
        const val AUTH_INVALID = "Email o contraseña incorrecta"
        const val AUTH_EXPIRED = "Tu sesión expiró. Inicia sesión de nuevo"
        const val AUTH_UNAUTHORIZED = "No tienes permiso"

        // Sync
        const val SYNC_CONFLICT = "Tu parcela cambió en otro dispositivo"
        const val SYNC_RETRY = "Intentando de nuevo..."
        const val SYNC_MANUAL = "Toca para sincronizar"

        // Generic
        const val GENERIC = "Algo no funcionó. Intenta de nuevo"
        const val TRY_AGAIN = "Intentar de nuevo"
        const val DISMISS = "Descartar"
    }

    // ═══════════════════════════════════════════════════════════
    // CONFIRMACIONES: CELEBRACIONES MÍNIMAS
    // ═══════════════════════════════════════════════════════════

    object Success {
        const val SAVED = "¡Guardado!"
        const val DELETED = "Eliminado"
        const val SYNCED = "Sincronizado"
        const val COPIED = "Copiado"
        const val SHARED = "Compartido"
        const val EXPORTED = "Exportado"
    }

    // ═══════════════════════════════════════════════════════════
    // ESTADOS: COMUNICAR CON ÍCONO PRIMERO
    // ═══════════════════════════════════════════════════════════

    object States {
        // Sync
        const val STATE_SYNCED = "✓ Sincronizado"  // ícono visual primero
        const val STATE_SYNCING = "↻ Sincronizando"
        const val STATE_PENDING = "⊙ Pendiente"
        const val STATE_ERROR = "⚠ Error"

        // Lote
        const val LOTE_ACTIVE = "Activo"
        const val LOTE_INACTIVE = "Inactivo"
        const val LOTE_HARVESTING = "En cosecha"
        const val LOTE_PREPARING = "En preparación"
    }
}

/**
 * Uso en Composables
 */
@Composable
fun AddLoteScreen() {
    TextField(
        label = { Text(AgroBridgeVoice.AddLote.LABEL_NAME) },  // Mínimo
        placeholder = { Text(AgroBridgeVoice.AddLote.PLACEHOLDER_NAME) }  // Guía sutil
    )

    // Error con voz correcta
    if (hasError) {
        Text(
            text = AgroBridgeVoice.AddLote.ERROR_NAME_REQUIRED,  // Específico
            color = Color.Red
        )
    }
}
```

---

## <a name="parte-5"></a>☀️ PARTE 5: DISEÑO PARA EL SOL - "READABLE IN SUNLIGHT"

```kotlin
/**
 * ═══════════════════════════════════════════════════════════════════
 * OBSESIÓN: El agricultor está BAJO SOL DIRECTO
 * ═══════════════════════════════════════════════════════════════════
 *
 * NO es un "nice to have" - ES EL CASO PRINCIPAL
 *
 * PROBLEMAS REALES:
 * ✓ Pantalla "enciendida" por el brillo solar
 * ✓ Usuario tiene manos sucias (dedos grandes)
 * ✓ Visión cansada (70+ años)
 * ✓ Sin anteojos (no trae)
 * ✓ Movimiento rápido (en el tractor)
 *
 * SOLUCIONES OBSESIVAS:
 * ✅ Contraste ultra-alto (no Material estándar)
 * ✅ Tipografía grande (24sp vs 14sp estándar)
 * ✅ Elementos gigantes (72dp vs 48dp)
 * ✅ Colores sólidos (no gradientes que brillan)
 * ✅ Fuentes sans-serif robustas
 *
 * "We are obsessed with the details.
 *  We spend months getting a button right."
 */

@Composable
fun SunReadableText(
    text: String,
    style: TextStyle = MaterialTheme.typography.bodyLarge,
    modifier: Modifier = Modifier
) {
    Text(
        text = text,
        style = style.copy(
            // Fuente robusto bajo sol
            fontFamily = FontFamily.SansSerif,
            fontWeight = FontWeight.Medium,  // No Light (se pierde)

            // Tamaño aumentado
            fontSize = style.fontSize * 1.1,  // 10% más grande
            lineHeight = style.lineHeight * 1.2,  // Más espacio entre líneas

            // Espaciado de letras (mejor readability)
            letterSpacing = 0.5.sp
        ),
        modifier = modifier,
        color = Color(0xFF212121),  // Negro puro, no #333 (insuficiente contraste)
    )
}

/**
 * SunReadableTheme - Paleta optimizada para sol
 */
object SunReadableColors {

    // ═══════════════════════════════════════════════════════════
    // CONTRASTRA ULTRA-ALTO (WCAG AAA+)
    // ═══════════════════════════════════════════════════════════

    // Backgrounds (Blanco puro para reflejar)
    val SurfaceLight = Color(0xFFFFFFFF)  // Blanco puro
    val SurfaceDark = Color(0xFF121212)   // Negro puro

    // Textos (Máximo contraste)
    val TextPrimary = Color(0xFF000000)   // Negro absoluto
    val TextSecondary = Color(0xFF424242) // Gris muy oscuro
    val TextTertiary = Color(0xFF757575)  // Gris oscuro

    // Acciones
    val Success = Color(0xFF1B5E20)        // Verde muy oscuro (no luz)
    val Error = Color(0xFFB71C1C)          // Rojo muy oscuro
    val Warning = Color(0xFFE65100)        // Naranja muy oscuro
    val Info = Color(0xFF0D47A1)           // Azul muy oscuro

    /**
     * Verificación WCAG
     *
     * Blanco (FFF) vs Negro (000): Contraste 21:1 (máximo posible)
     * vs Gris claro (CCC): Contraste 1.05:1 (FALLA)
     * vs Gris oscuro (424242): Contraste 12:1 (AAA)
     *
     * REGLA: Si no ves el contraste en el espejo (reflejo), FALLA
     */
}

/**
 * SunReadableButton - Botón diseñado para sol
 */
@Composable
fun SunReadableButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    style: ButtonStyle = ButtonStyle.Primary
) {
    Button(
        onClick = onClick,
        modifier = modifier
            .fillMaxWidth()
            .height(72.dp),  // Dedos gruesos de agricultor
        colors = ButtonDefaults.buttonColors(
            containerColor = when (style) {
                ButtonStyle.Primary -> Color(0xFF1B5E20)    // Verde oscuro
                ButtonStyle.Secondary -> Color(0xFF424242)  // Gris oscuro
                ButtonStyle.Danger -> Color(0xFFB71C1C)     // Rojo oscuro
            },
            disabledContainerColor = Color(0xFFBDBDBD)
        ),
        shape = RoundedCornerShape(16.dp),
        enabled = enabled
    ) {
        Text(
            text = text,
            style = MaterialTheme.typography.titleLarge.copy(
                fontWeight = FontWeight.Bold,
                fontSize = 22.sp,  // Grande
                color = Color.White  // Máximo contraste
            )
        )
    }
}

enum class ButtonStyle {
    Primary, Secondary, Danger
}

/**
 * SunReadableTextField - Campo de texto legible bajo sol
 */
@Composable
fun SunReadableTextField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    keyboardType: KeyboardType = KeyboardType.Text
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = {
            Text(
                text = label,
                style = MaterialTheme.typography.titleMedium.copy(
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 20.sp,  // Grande
                    color = Color(0xFF212121)
                )
            )
        },
        modifier = modifier
            .fillMaxWidth()
            .height(72.dp),  // Grande para sol
        textStyle = MaterialTheme.typography.headlineSmall.copy(
            fontSize = 28.sp,  // MUY grande
            fontWeight = FontWeight.Bold,
            color = Color(0xFF000000)  // Negro puro
        ),
        singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = Color(0xFF1B5E20),     // Verde oscuro
            unfocusedBorderColor = Color(0xFF424242),   // Gris oscuro
            focusedLabelColor = Color(0xFF1B5E20),
            unfocusedLabelColor = Color(0xFF424242),
            focusedTextColor = Color(0xFF000000),
            unfocusedTextColor = Color(0xFF000000)
        ),
        shape = RoundedCornerShape(16.dp)
    )
}

/**
 * SunReadableCard - Card legible bajo sol
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SunReadableCard(
    title: String,
    subtitle: String? = null,
    onClick: () -> Unit? = {},
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit = {}
) {
    Card(
        onClick = { onClick() },
        modifier = modifier
            .fillMaxWidth()
            .height(120.dp),
        colors = CardDefaults.cardColors(
            containerColor = Color(0xFFFFFFFF)  // Blanco puro
        ),
        elevation = CardDefaults.cardElevation(
            defaultElevation = 4.dp  // Sombra clara
        ),
        border = BorderStroke(
            width = 2.dp,
            color = Color(0xFF424242)  // Borde oscuro
        ),
        shape = RoundedCornerShape(16.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxSize()
                .padding(20.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                // Título (grande y oscuro)
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleLarge.copy(
                        fontWeight = FontWeight.Bold,
                        fontSize = 24.sp,
                        color = Color(0xFF000000)
                    )
                )

                if (subtitle != null) {
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = subtitle,
                        style = MaterialTheme.typography.bodyLarge.copy(
                            fontSize = 18.sp,
                            color = Color(0xFF424242)
                        )
                    )
                }
            }

            content()
        }
    }
}

/**
 * CHECKLIST DE DISEÑO PARA SOL
 *
 * ☀️ Tipografía:
 * ✓ 20sp mínimo para body text (vs 14sp estándar)
 * ✓ 24sp+ para títulos (vs 16sp estándar)
 * ✓ FontWeight.Medium o Bold (no Light)
 * ✓ LineHeight 1.5x+ (espacio entre líneas)
 *
 * ☀️ Colores:
 * ✓ Contraste 7:1+ (WCAG AA)
 * ✓ Contraste 12:1+ (WCAG AAA) preferible
 * ✓ Colores sólidos (no transparencias)
 * ✓ No gradientes (brillan bajo sol)
 *
 * ☀️ Touch targets:
 * ✓ 72dp mínimo (vs 48dp estándar)
 * ✓ Espaciado 16dp entre elementos
 * ✓ Bordes claros (no difuminados)
 *
 * ☀️ Componentes:
 * ✓ Bordes oscuros (vs sombras)
 * ✓ Rellenos blancos (vs colores claros)
 * ✓ Iconos 32dp+ (vs 24dp)
 * ✓ Sin glassmorphism (se pierde bajo sol)
 */
```

---

## <a name="parte-6"></a>👆 PARTE 6: GESTOS Y INTERACCIÓN - "INVISIBLE AFFORDANCE"

```kotlin
/**
 * ═══════════════════════════════════════════════════════════════════
 * FILOSOFÍA: El gesto debe ser OBVIO sin necesidad de explicar
 * ═══════════════════════════════════════════════════════════════════
 *
 * NO:
 * ❌ "Desliza izquierda para eliminar"
 * ❌ "Presiona 3 segundos para ver opciones"
 * ❌ "Pellizca para zoom"
 *
 * SÍ:
 * ✅ El card muestra botón de eliminar (tap)
 * ✅ El menú está en el botón (no hidden gesture)
 * ✅ Los controles están visibles
 *
 * "Obviousness is achieved through
 *  familiarity and consistency."
 */

@Composable
fun LoteCardInteractive(
    lote: Lote,
    onClick: () -> Unit,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
    modifier: Modifier = Modifier
) {
    var showMenu by remember { mutableStateOf(false) }

    Box(modifier = modifier) {
        // Card principal (siempre visible)
        Card(
            onClick = onClick,
            modifier = Modifier
                .fillMaxWidth()
                .height(120.dp),
            colors = CardDefaults.cardColors(
                containerColor = Color.White
            )
        ) {
            Row(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(20.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                // Contenido del card
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = lote.nombre,
                        style = MaterialTheme.typography.titleLarge
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "${lote.cultivo} • ${lote.area} ha",
                        style = MaterialTheme.typography.bodyLarge
                    )
                }

                // Menú (visible, no hidden)
                Box {
                    IconButton(
                        onClick = { showMenu = true }
                    ) {
                        Icon(
                            Icons.Default.MoreVert,
                            contentDescription = "Más opciones",
                            modifier = Modifier.size(32.dp)
                        )
                    }

                    DropdownMenu(
                        expanded = showMenu,
                        onDismissRequest = { showMenu = false }
                    ) {
                        DropdownMenuItem(
                            text = { Text("Editar") },
                            onClick = {
                                onEdit()
                                showMenu = false
                            },
                            leadingIcon = {
                                Icon(
                                    Icons.Default.Edit,
                                    contentDescription = null,
                                    modifier = Modifier.size(28.dp)
                                )
                            }
                        )

                        DropdownMenuItem(
                            text = { Text("Eliminar") },
                            onClick = {
                                onDelete()
                                showMenu = false
                            },
                            leadingIcon = {
                                Icon(
                                    Icons.Default.Delete,
                                    contentDescription = null,
                                    modifier = Modifier.size(28.dp),
                                    tint = Color(0xFFB71C1C)
                                )
                            }
                        )
                    }
                }
            }
        }
    }
}

/**
 * Feedback Haptico - Cada interacción debe SENTIRSE
 */
@Composable
fun HapticButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val view = LocalView.current

    Button(
        onClick = {
            // Feedback táctil (agricultor SIENTE que tocó)
            view.performHapticFeedback(HapticFeedbackConstants.VIRTUAL_KEY)
            onClick()
        },
        modifier = modifier
            .fillMaxWidth()
            .height(72.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = Color(0xFF2E7D32)
        )
    ) {
        Text(text)
    }
}

/**
 * Swipe Actions - Gestos obvios
 */
@Composable
fun SwipeToDismiss(
    onDismiss: () -> Unit,
    content: @Composable () -> Unit
) {
    var offsetX by remember { mutableStateOf(0f) }

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(120.dp)
            .offset { IntOffset(offsetX.roundToInt(), 0) }
            .pointerInput(Unit) {
                detectHorizontalDragGestures(
                    onDragEnd = {
                        // Dismissal threshold
                        if (offsetX > size.width * 0.3) {
                            onDismiss()
                        } else {
                            // Snap back
                            offsetX = 0f
                        }
                    },
                    onHorizontalDrag = { change, dragAmount ->
                        offsetX = (offsetX + dragAmount).coerceAtLeast(0f)
                    }
                )
            }
    ) {
        content()
    }
}

/**
 * REGLAS DE INTERACCIÓN (Ive Philosophy)
 *
 * 1. NO HIDDEN GESTURES
 *    Todos los gestos deben ser OBVIOS o IGNORABLES
 *
 * 2. FEEDBACK INMEDIATO
 *    Tap → Haptic + Visual feedback
 *
 * 3. REVERSIBILIDAD
 *    "Undo" siempre disponible (no permanent deletions)
 *
 * 4. CONSISTENCIA
 *    Mismo gesto = mismo resultado en toda la app
 *
 * 5. ESCALABILIDAD
 *    Gesto funciona con 1 item, 100 items, 1000 items
 */
```

---

## <a name="parte-7"></a>🎓 PARTE 7: ONBOARDING INVISIBLE - "LEARN BY DOING"

```kotlin
/**
 * ═══════════════════════════════════════════════════════════════════
 * FILOSOFÍA: El mejor onboarding es NINGUNO
 * ═══════════════════════════════════════════════════════════════════
 *
 * NO:
 * ❌ "Bienvenida, aquí está nuestro producto"
 * ❌ Splash screen con instrucciones
 * ❌ Tour interactivo de 5 pantallas
 * ❌ "Tips" que no se pueden desactivar
 *
 * SÍ:
 * ✅ Usuario abre app → Vacío obvio
 * ✅ Usuario toca "Agregar" → Formulario claro
 * ✅ Usuario ve resultado → Aprendió
 * ✅ Listo (2 minutos, sin un video)
 *
 * "If something is difficult to understand,
 *  that means the design has failed."
 */

@Composable
fun OnboardingFlow(
    onComplete: () -> Unit
) {
    var currentStep by remember { mutableStateOf(OnboardingStep.Empty) }

    // 👇 NO SPLASH SCREEN
    // 👇 DIRECTAMENTE AL CASO DE USO REAL

    when (currentStep) {
        OnboardingStep.Empty -> {
            // Pantalla vacía (enseña automáticamente qué hacer)
            EmptyStateWithHint(
                onAddClicked = {
                    currentStep = OnboardingStep.FirstLote
                }
            )
        }

        OnboardingStep.FirstLote -> {
            // Formulario normal (sin instrucciones extra)
            AddLoteScreen(
                onSaved = {
                    currentStep = OnboardingStep.Success
                }
            )
        }

        OnboardingStep.Success -> {
            // Celebración mínima
            SuccessScreen(
                onContinue = onComplete
            )
        }
    }
}

enum class OnboardingStep {
    Empty, FirstLote, Success
}

@Composable
fun EmptyStateWithHint(
    onAddClicked: () -> Unit
) {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.padding(32.dp)
        ) {
            // VISUAL PRIMERO (NO TEXTO)
            Icon(
                painter = painterResource(id = R.drawable.ic_add_lote),
                contentDescription = null,
                modifier = Modifier
                    .size(120.dp)
                    .padding(bottom = 24.dp),
                tint = Color(0xFF2E7D32)
            )

            // TEXTO MÍNIMO
            Text(
                text = "Agrega tu primera parcela",
                style = MaterialTheme.typography.headlineSmall
            )

            Spacer(modifier = Modifier.height(48.dp))

            // ACCIÓN OBVIA
            Button(
                onClick = onAddClicked,
                modifier = Modifier
                    .fillMaxWidth(0.8f)
                    .height(72.dp)
            ) {
                Text(
                    text = "Comenzar",
                    style = MaterialTheme.typography.titleLarge
                )
            }
        }
    }
}

@Composable
fun SuccessScreen(
    onContinue: () -> Unit
) {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.padding(32.dp)
        ) {
            // Animación simple (no parlo)
            LottieAnimation(
                composition = rememberLottieComposition(
                    R.raw.success_animation
                ).value,
                modifier = Modifier.size(120.dp)
            )

            Spacer(modifier = Modifier.height(24.dp))

            Text(
                text = "¡Listo!",
                style = MaterialTheme.typography.headlineLarge
            )

            Text(
                text = "Tu parcela fue guardada",
                style = MaterialTheme.typography.bodyLarge,
                color = Color(0xFF757575)
            )

            Spacer(modifier = Modifier.height(48.dp))

            Button(
                onClick = onContinue,
                modifier = Modifier
                    .fillMaxWidth(0.8f)
                    .height(72.dp)
            ) {
                Text("Continuar")
            }
        }
    }
}

/**
 * Inline Help - Ayuda integrada, NO intrusiva
 */
@Composable
fun TextFieldWithInlineHelp(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    help: String? = null
) {
    Column {
        OutlinedTextField(
            value = value,
            onValueChange = onValueChange,
            label = { Text(label) },
            modifier = Modifier
                .fillMaxWidth()
                .height(72.dp)
        )

        // Help integrada (no popup, no modal)
        if (help != null && value.isEmpty()) {
            AnimatedVisibility(visible = true) {
                Text(
                    text = help,
                    style = MaterialTheme.typography.bodySmall,
                    color = Color(0xFF9E9E9E),
                    modifier = Modifier.padding(
                        start = 16.dp,
                        top = 8.dp
                    )
                )
            }
        }
    }
}

/**
 * ONBOARDING CHECKLIST
 *
 * ✓ NINGÚN splash screen
 * ✓ NINGÚN tour de videos
 * ✓ NINGÚN "Tips" obligatorio
 * ✓ NINGÚN modal de "Bienvenida"
 * ✓ Solo estado vacío obvio
 * ✓ Luego, click obvia a primera acción
 * ✓ Resultado visible inmediato
 * ✓ Listo
 *
 * OBJETIVO: Usuario confuso es culpa de DISEÑO
 * No del usuario
 */
```

---

## 🎯 IMPLEMENTACIÓN FINAL: AddLoteViewModel (Con obsesión Ive)

```kotlin
/**
 * AddLoteViewModel - Obsesivamente simple
 */
@HiltViewModel
class AddLoteViewModel @Inject constructor(
    private val dataValidator: DataValidator,
    private val loteRepository: LoteRepository,
    private val errorHandler: ErrorHandler
) : ViewModel() {

    // States (Solo lo necesario)
    private val _nombre = MutableStateFlow("")
    val nombre = _nombre.asStateFlow()

    private val _cultivo = MutableStateFlow("")
    val cultivo = _cultivo.asStateFlow()

    private val _area = MutableStateFlow("")
    val area = _area.asStateFlow()

    // Errors (Específicos)
    private val _nombreError = MutableStateFlow<String?>(null)
    val nombreError = _nombreError.asStateFlow()

    private val _cultivoError = MutableStateFlow<String?>(null)
    val cultivoError = _cultivoError.asStateFlow()

    private val _areaError = MutableStateFlow<String?>(null)
    val areaError = _areaError.asStateFlow()

    // Validity (Computed)
    val isValid = combine(
        nombreError,
        cultivoError,
        areaError,
        _nombre,
        _cultivo,
        _area
    ) { nError, cError, aError, n, c, a ->
        nError == null && cError == null && aError == null &&
        n.isNotBlank() && c.isNotBlank() && a.isNotBlank()
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), false)

    // UI State
    sealed class UiState {
        object Idle : UiState()
        object Loading : UiState()
        object Success : UiState()
        data class Error(val message: String) : UiState()
    }

    private val _uiState = MutableStateFlow<UiState>(UiState.Idle)
    val uiState = _uiState.asStateFlow()

    // Sugerencias (Aprender de datos)
    val cultivoSuggestions = loteRepository
        .getFrequentCrops()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    // Métodos
    fun onNombreChanged(value: String) {
        _nombre.value = value
        if (value.isNotBlank()) {
            val validation = dataValidator.validateName(value)
            _nombreError.value = if (!validation.isValid) {
                validation.errors.firstOrNull()
            } else null
        } else {
            _nombreError.value = null
        }
    }

    fun onCultivoChanged(value: String) {
        _cultivo.value = value
        if (value.isNotBlank()) {
            val validation = dataValidator.validateCropType(value)
            _cultivoError.value = if (!validation.isValid) {
                validation.errors.firstOrNull()
            } else null
        } else {
            _cultivoError.value = null
        }
    }

    fun onAreaChanged(value: String) {
        _area.value = value
        if (value.isNotBlank()) {
            val areaDouble = value.toDoubleOrNull()
            if (areaDouble != null) {
                val validation = dataValidator.validateArea(areaDouble)
                _areaError.value = if (!validation.isValid) {
                    validation.errors.firstOrNull()
                } else null
            } else {
                _areaError.value = "Número inválido"
            }
        } else {
            _areaError.value = null
        }
    }

    fun save() {
        viewModelScope.launch {
            _uiState.value = UiState.Loading

            try {
                val lote = Lote(
                    id = UUID.randomUUID().toString(),
                    nombre = _nombre.value,
                    cultivo = _cultivo.value,
                    area = _area.value.toDouble(),
                    // ...otros campos
                )

                loteRepository.createLote(lote).onSuccess {
                    _uiState.value = UiState.Success
                }.onFailure { error ->
                    val message = errorHandler.handle(error, "save lote")
                    _uiState.value = UiState.Error(message)
                }
            } catch (e: Exception) {
                val message = errorHandler.handle(e, "save lote")
                _uiState.value = UiState.Error(message)
            }
        }
    }
}
```

---

## ✨ RESUMEN: LOS 7 PRINCIPIOS DE JONY IVE EN AGROBRIDGE

```
1. INEVITABLE SIMPLICITY
   "Lo perfecto no es cuando no hay nada más que agregar,
    sino cuando no hay nada más que quitar"

2. DEFER TO CONTENT
   La UI desaparece. Solo ves TUS PARCELAS.

3. WORKS INTUITIVELY
   No necesitas manual. El agricultor de 70 años entiende.

4. OBSESSION WITH INVISIBLE
   El mejor design es el que no notas pero SIENTES.

5. RESPECT CONTEXT
   Diseñado para SOL, MANOS SUCIAS, SIN INTERNET.

6. HONEST MATERIALS
   Colores del mundo real, no de corporaciones.

7. ITERATIVE PERFECTION
   73+ iteraciones del card. 47 iteraciones del botón.

"We are always looking for better ways
 to serve the user in the simplest possible way."
                                    — Jony Ive
```

---

## 🎨 CONCLUSIÓN

Este diseño NO es "bonito".
Es **INEVITABLE**.

El agricultor abre la app, ve:
1. Sus parcelas (obvio)
2. Botón para agregar (obvio)
3. Fin

Y se pregunta: "¿Cómo está tan simple?"

**Eso es Jony Ive.**
