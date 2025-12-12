# ⚡ AgroBridge iOS - Inicio Rápido

## 🚀 Setup en 5 Minutos

### 1. Crear Proyecto Xcode (2 min)

```
1. Abre Xcode
2. File > New > Project
3. iOS > App
4. Nombre: "AgroBridge"
5. Interface: SwiftUI
6. Guarda en: /Users/mac/Desktop/App IOS/AgroBridge/
```

### 2. Importar Código (1 min)

```
1. Elimina: AgroBridgeApp.swift y ContentView.swift (generados por Xcode)
2. Arrastra estas 7 carpetas al proyecto:
   - App/
   - Configuration/
   - Core/
   - Models/
   - Services/
   - ViewModels/
   - Views/
3. Selecciona: ✅ Copy items, ✅ Create groups
```

### 3. Configurar Permisos (1 min)

Agregar a `Info.plist`:

```xml
<key>NSCameraUsageDescription</key>
<string>AgroBridge necesita acceso a la cámara</string>

<key>NSLocationWhenInUseUsageDescription</key>
<string>AgroBridge necesita tu ubicación</string>
```

### 4. Compilar (1 min)

```
Cmd + B
```

✅ **¡Listo!** La app está corriendo.

---

## 📱 Testing Local

### Configurar Backend Local

En `Configuration/AppConfiguration.swift`:

```swift
case .development:
    return "http://localhost:3000/v1"  // Tu backend local
```

### Credenciales de Prueba

```
Email: test@agrobridge.com
Password: test123
```

---

## 📚 Documentación Completa

- **Setup detallado:** `SETUP_GUIDE.md`
- **Documentación:** `README.md`
- **Implementación:** `IMPLEMENTATION_SUMMARY.md`

---

## 🆘 Problemas Comunes

**Error: "No such module"**
```bash
Product > Clean Build Folder (Cmd + Shift + K)
```

**Error: Login falla**
- Verifica que el backend esté corriendo
- Revisa la URL en `AppConfiguration.swift`

**Error: Simulador no abre**
```bash
rm -rf ~/Library/Developer/Xcode/DerivedData
```

---

## ✅ Features Disponibles

- ✅ Login con email/password
- ✅ Dashboard con estadísticas
- ✅ Crear lote nuevo
- ✅ Manejo de errores completo
- ✅ Loading states

---

## 🚧 Roadmap

**Próximo:** Fase 2 (40%)
- Lista de lotes
- Detalle de lote
- Gestión de productores
- Firebase Analytics

---

**Happy Coding! 🎉**
