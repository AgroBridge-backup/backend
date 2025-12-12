# 📘 Guía Completa de Setup - AgroBridge iOS

Esta guía te llevará paso a paso desde cero hasta tener la aplicación corriendo en tu simulador o dispositivo.

---

## 📑 Tabla de Contenidos

1. [Prerrequisitos](#1-prerrequisitos)
2. [Crear Proyecto Xcode](#2-crear-proyecto-xcode)
3. [Importar Código Fuente](#3-importar-código-fuente)
4. [Configurar Info.plist](#4-configurar-infoplist)
5. [Configurar Build Settings](#5-configurar-build-settings)
6. [Primera Compilación](#6-primera-compilación)
7. [Configurar Firebase (Opcional)](#7-configurar-firebase-opcional)
8. [Troubleshooting](#8-troubleshooting)

---

## 1. Prerrequisitos

### ✅ Checklist de Software

- [ ] macOS Ventura (13.0) o superior
- [ ] Xcode 15.0 o superior instalado desde Mac App Store
- [ ] Command Line Tools instalados
- [ ] Cuenta Apple ID (para ejecutar en simulador)
- [ ] Cuenta Apple Developer (para ejecutar en dispositivo físico)

### Verificar Instalación de Xcode

Abre Terminal y ejecuta:

```bash
xcode-select --version
# Debe mostrar: xcode-select version 2396 o superior

xcodebuild -version
# Debe mostrar: Xcode 15.x y Build version...
```

Si falta Command Line Tools:

```bash
xcode-select --install
```

---

## 2. Crear Proyecto Xcode

### Paso 2.1: Abrir Xcode

1. Abre **Xcode** desde Applications o Spotlight
2. Espera a que se cargue completamente

### Paso 2.2: Crear Nuevo Proyecto

1. En la ventana de bienvenida, selecciona **"Create New Project"**
   - O desde el menú: `File > New > Project...`

2. Seleccionar plantilla:
   - **iOS > App**
   - Click **Next**

### Paso 2.3: Configurar Proyecto

Completa los campos:

| Campo | Valor |
|-------|-------|
| **Product Name** | `AgroBridge` |
| **Team** | Selecciona tu equipo o deja en "None" |
| **Organization Identifier** | `com.agrobridge` |
| **Bundle Identifier** | Se autogenera: `com.agrobridge.AgroBridge` |
| **Interface** | SwiftUI |
| **Language** | Swift |
| **Storage** | Ninguno (desmarcar todas las opciones) |
| **Include Tests** | ✅ Sí (dejar marcado) |

Click **Next**

### Paso 2.4: Guardar Proyecto

1. Navega a: `/Users/mac/Desktop/App IOS/AgroBridge/`
2. **IMPORTANTE:** Asegúrate de estar DENTRO de la carpeta `AgroBridge` que contiene el código
3. Click **Create**

### Resultado Esperado

Deberías ver:

```
/Users/mac/Desktop/App IOS/AgroBridge/
├── AgroBridge/              # Código fuente existente
├── AgroBridge.xcodeproj     # ✨ Proyecto Xcode (nuevo)
└── AgroBridge/              # Archivos generados por Xcode
    ├── AgroBridgeApp.swift  # (Eliminar después)
    ├── ContentView.swift    # (Eliminar después)
    └── Assets.xcassets
```

---

## 3. Importar Código Fuente

### Paso 3.1: Limpiar Archivos Generados

Xcode crea archivos de plantilla que debemos eliminar:

1. En el **Project Navigator** (panel izquierdo), busca:
   - `AgroBridgeApp.swift` (el generado por Xcode, NO el del código)
   - `ContentView.swift`

2. Clic derecho en cada uno > **Delete**
3. En el diálogo, selecciona **"Move to Trash"** (NO "Remove Reference")

### Paso 3.2: Importar Carpetas de Código

Ahora vamos a importar TODAS las carpetas con el código:

1. Desde **Finder**, abre `/Users/mac/Desktop/App IOS/AgroBridge/AgroBridge/`

2. Selecciona TODAS estas carpetas:
   - `App/`
   - `Configuration/`
   - `Core/`
   - `Models/`
   - `Services/`
   - `ViewModels/`
   - `Views/`

3. **Arrastra** las 7 carpetas al **Project Navigator** de Xcode
   - Suelta sobre el grupo `AgroBridge` (la carpeta azul)

4. En el diálogo "Choose options for adding these files":
   - ✅ **Copy items if needed** (marcado)
   - ✅ **Create groups** (seleccionado, NO "Create folder references")
   - ✅ **Add to targets:** AgroBridge (marcado)
   - Click **Finish**

### Paso 3.3: Verificar Estructura

Tu Project Navigator debe verse así:

```
AgroBridge
├── App
│   └── AgroBridgeApp.swift
├── Configuration
│   └── AppConfiguration.swift
├── Core
│   ├── Extensions
│   ├── Networking
│   └── Persistence
├── Models
│   ├── User.swift
│   ├── Lote.swift
│   └── DashboardStats.swift
├── Services
├── ViewModels
├── Views
│   ├── Auth
│   ├── Dashboard
│   ├── Lote
│   └── Components
└── Assets.xcassets
```

### Paso 3.4: Eliminar Carpeta `Resources` (si existe)

Si se creó una carpeta `Resources` vacía, elimínala (solo si está vacía).

---

## 4. Configurar Info.plist

### Paso 4.1: Abrir Info.plist

1. En Project Navigator, busca `Info.plist`
   - Usualmente está en `AgroBridge/AgroBridge/Info.plist`
   - Si no lo ves, selecciona el target **AgroBridge** > tab **Info**

### Paso 4.2: Agregar Permisos

Debes agregar permisos para Cámara, Ubicación y Galería (necesarios para features futuras):

**Método 1: Editor Visual**

1. En `Info.plist`, clic en el **+** para agregar nueva row
2. Agregar estas 3 keys:

| Key | Type | Value |
|-----|------|-------|
| `Privacy - Camera Usage Description` | String | `AgroBridge necesita acceso a la cámara para tomar fotos de los lotes` |
| `Privacy - Location When In Use Usage Description` | String | `AgroBridge necesita tu ubicación para geolocalizar los lotes` |
| `Privacy - Photo Library Usage Description` | String | `AgroBridge necesita acceso a tu galería para seleccionar fotos` |

**Método 2: Editar como Source Code**

1. Clic derecho en `Info.plist` > **Open As > Source Code**
2. Agregar dentro de `<dict>`:

```xml
<key>NSCameraUsageDescription</key>
<string>AgroBridge necesita acceso a la cámara para tomar fotos de los lotes</string>

<key>NSLocationWhenInUseUsageDescription</key>
<string>AgroBridge necesita tu ubicación para geolocalizar los lotes</string>

<key>NSPhotoLibraryUsageDescription</key>
<string>AgroBridge necesita acceso a tu galería para seleccionar fotos</string>
```

---

## 5. Configurar Build Settings

### Paso 5.1: Seleccionar Target

1. Click en **AgroBridge** (icono azul) en el Project Navigator
2. Asegúrate de seleccionar el **TARGET** "AgroBridge" (no PROJECT)

### Paso 5.2: Configurar General

En el tab **General**:

| Setting | Valor |
|---------|-------|
| **Display Name** | AgroBridge |
| **Bundle Identifier** | com.agrobridge.AgroBridge |
| **Version** | 1.0.0 |
| **Build** | 1 |
| **Minimum Deployments** | iOS 15.0 |

### Paso 5.3: Configurar Signing (Solo para Dispositivo Físico)

Si vas a ejecutar en un **iPhone físico**:

1. Tab **Signing & Capabilities**
2. ✅ **Automatically manage signing**
3. Seleccionar tu **Team** (Apple Developer Account)

**Para simulador:** No necesitas configurar signing.

---

## 6. Primera Compilación

### Paso 6.1: Seleccionar Destino

En la barra superior de Xcode:

1. Click en el selector de destino (al lado del botón Play)
2. Selecciona:
   - **iPhone 15** (simulador recomendado)
   - O cualquier iPhone con iOS 15+

### Paso 6.2: Compilar

1. Presiona `Cmd + B` o click en el botón **Play** (▶️)

2. Espera la compilación...

### Paso 6.3: Resultado Esperado

✅ **Build Succeeded**

Deberías ver:

- Simulador de iPhone abre automáticamente
- Pantalla de **Login** de AgroBridge se muestra
- Logo verde con "AgroBridge"
- Campos de Email y Contraseña

### 📸 Screenshots Esperados

**Pantalla de Login:**
- Fondo verde claro
- Logo hoja verde
- Título "AgroBridge"
- Campos de email y password
- Botón "Iniciar Sesión"
- Versión en footer

**Al Hacer Login (requiere backend):**
- Dashboard con 4 StatCards
- Acciones Rápidas
- TabBar con 4 tabs

---

## 7. Configurar Firebase (Opcional)

**NOTA:** Firebase NO está configurado aún. Este paso es para cuando quieras agregarlo.

### Paso 7.1: Crear Proyecto Firebase

1. Ve a [Firebase Console](https://console.firebase.google.com)
2. Click **Add Project**
3. Nombre: `AgroBridge`
4. Habilita Google Analytics (opcional)
5. Click **Create Project**

### Paso 7.2: Agregar App iOS

1. En Firebase Console, click en **iOS+**
2. Bundle ID: `com.agrobridge.AgroBridge`
3. App nickname: `AgroBridge iOS`
4. Click **Register App**

### Paso 7.3: Descargar GoogleService-Info.plist

1. Click **Download GoogleService-Info.plist**
2. Arrastra el archivo a Xcode en la carpeta `AgroBridge/`
3. ✅ **Copy items if needed**
4. ✅ **Add to targets:** AgroBridge

### Paso 7.4: Instalar Firebase SDK

1. En Xcode, `File > Add Package Dependencies...`
2. URL: `https://github.com/firebase/firebase-ios-sdk`
3. Version: `Up to Next Major Version` - `10.0.0`
4. Click **Add Package**

5. Seleccionar productos:
   - ✅ FirebaseAnalytics
   - ✅ FirebaseCrashlytics
   - Click **Add Package**

### Paso 7.5: Inicializar Firebase

En `App/AgroBridgeApp.swift`, descomentar la línea:

```swift
// FirebaseApp.configure()
```

Agregar import:

```swift
import Firebase
```

Cambiar a:

```swift
import SwiftUI
import Firebase  // ← Agregar

@main
struct AgroBridgeApp: App {
    init() {
        FirebaseApp.configure()  // ← Descomentar
        setupAppearance()
        // ...
    }
}
```

### Paso 7.6: Compilar

1. `Cmd + B` para compilar
2. Verificar que no hay errores
3. Firebase está listo ✅

---

## 8. Troubleshooting

### Problema 1: "No such module 'Firebase'"

**Síntoma:** Error de compilación: `No such module 'Firebase'`

**Solución:**
1. Verifica que Firebase esté agregado en Package Dependencies
2. `File > Packages > Reset Package Caches`
3. `Product > Clean Build Folder` (`Cmd + Shift + K`)
4. Compilar de nuevo

---

### Problema 2: Archivos duplicados / Compilación falla

**Síntoma:** Errores como "Multiple commands produce..." o archivos duplicados

**Solución:**
1. En Project Navigator, busca archivos duplicados (mismo nombre dos veces)
2. Elimina la copia (generalmente la que NO está en grupos/carpetas)
3. `Product > Clean Build Folder`
4. Compilar de nuevo

---

### Problema 3: "Module compiled with Swift X expected Y"

**Síntoma:** Error de versión de Swift

**Solución:**
1. Verifica versión de Xcode: debe ser 15.0+
2. En Build Settings del target:
   - Buscar "Swift Language Version"
   - Asegurar que sea **Swift 5** o **Swift 5.9**

---

### Problema 4: Simulador no abre / se queda en negro

**Síntoma:** Simulador abre pero pantalla negra o app no aparece

**Solución:**
1. Cerrar simulador completamente (`Cmd + Q`)
2. En Xcode: `Product > Clean Build Folder`
3. Eliminar derived data:
   ```bash
   rm -rf ~/Library/Developer/Xcode/DerivedData
   ```
4. Reiniciar Xcode
5. Compilar de nuevo

---

### Problema 5: "Code signing error"

**Síntoma:** Error de firma de código al compilar

**Solución:**
1. En target **AgroBridge** > **Signing & Capabilities**
2. ✅ **Automatically manage signing**
3. Seleccionar tu **Team**
4. Si no tienes Team:
   - Ejecutar solo en simulador (no necesita firma)
   - O crear Apple ID gratis en [appleid.apple.com](https://appleid.apple.com)

---

### Problema 6: Login falla con error de red

**Síntoma:** App abre bien, pero al hacer login aparece error "No se pudo conectar al servidor"

**Explicación:** Es normal. El backend de AgroBridge debe estar corriendo.

**Solución:**

**Opción A: Backend en Localhost (Desarrollo)**
1. Editar `Configuration/AppConfiguration.swift`:
   ```swift
   case .development:
       return "http://localhost:3000/v1"
   ```
2. Asegurar que el backend esté corriendo en tu Mac

**Opción B: Usar Backend de Staging**
1. Verificar que `https://staging-api.agrobridge.io` esté disponible
2. Cambiar environment a staging

**Opción C: Mock Data (Para Testing UI)**
1. Comentar la llamada al API en `AuthService.swift`
2. Simular respuesta exitosa:
   ```swift
   // Simular login exitoso para testing
   currentUser = User(id: "test", email: email, nombre: "Usuario Test", rol: .productor, createdAt: nil, updatedAt: nil)
   isAuthenticated = true
   ```

---

### Problema 7: Errores de Keychain en simulador

**Síntoma:** Errores de Keychain / "errSecDuplicateItem"

**Solución:**
1. En simulador, ir a **Settings > General > Transfer or Reset > Reset > Erase All Content and Settings**
2. O desde Terminal:
   ```bash
   xcrun simctl erase all
   ```
3. Compilar de nuevo

---

## ✅ Checklist Final

Antes de dar por terminado el setup:

- [ ] Proyecto Xcode creado
- [ ] Código fuente importado (7 carpetas)
- [ ] Info.plist configurado con permisos
- [ ] Build Settings configurado (iOS 15.0 min)
- [ ] Compilación exitosa (`Cmd + B`)
- [ ] Simulador abre correctamente
- [ ] LoginView se muestra correctamente
- [ ] (Opcional) Firebase configurado

---

## 🎉 ¡Listo!

Si llegaste hasta aquí, tienes AgroBridge iOS compilando y corriendo.

**Próximos pasos:**

1. Configurar el backend para testing
2. Implementar features de Fase 2 (40%)
3. Agregar Firebase Analytics
4. Testing en dispositivo físico

---

## 📞 Ayuda

Si encuentras un problema no cubierto aquí:

1. Verifica los logs de Xcode en la consola
2. Revisa el README.md para más detalles
3. Contacta al equipo de desarrollo

**Happy Coding! 🚀**
