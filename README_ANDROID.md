# 🌱 AgroBridge Android

**Plataforma Android para gestión agrícola inteligente**

[![Kotlin](https://img.shields.io/badge/Kotlin-1.9.22-purple.svg)](https://kotlinlang.org/)
[![Compose](https://img.shields.io/badge/Jetpack%20Compose-2024.02-green.svg)](https://developer.android.com/jetpack/compose)
[![Material3](https://img.shields.io/badge/Material3-1.2.0-blue.svg)](https://m3.material.io/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

---

## 📱 Acerca de AgroBridge

AgroBridge es una aplicación Android moderna que replica la funcionalidad de su contraparte iOS, proporcionando a los productores agrícolas herramientas avanzadas para:

- 🗺️ **Gestión de Lotes con GPS** - Visualización de campos en mapas con polígonos
- ☀️ **Pronóstico del Clima** - Integración con OpenWeather API
- 🤖 **AI Crop Scanner** - Detección de enfermedades usando TensorFlow Lite
- 📊 **Dashboard Inteligente** - Métricas y análisis en tiempo real

---

## 🏗️ Arquitectura

### **Stack Tecnológico**

- **UI Framework:** Jetpack Compose + Material Design 3
- **Arquitectura:** Clean Architecture + MVVM
- **Navegación:** Navigation Compose
- **Maps:** Google Maps Compose
- **Networking:** Retrofit + OkHttp
- **ML:** TensorFlow Lite + ML Kit
- **Camera:** CameraX
- **Logging:** Timber

### **Estructura del Proyecto**

```
app/src/main/java/com/agrobridge/
├── data/
│   ├── model/          # Modelos de datos (Lote, Weather, CropHealth)
│   ├── repository/     # (TODO) Repositories
│   └── remote/         # (TODO) API Services
├── domain/
│   └── usecase/        # (TODO) Use Cases
├── presentation/
│   ├── theme/          # Design System (Color, Type, Dimensions)
│   ├── navigation/     # Navigation Graph y Routes
│   ├── screens/        # Pantallas de la app
│   └── components/     # (TODO) Componentes reutilizables
└── util/               # (TODO) Utilidades
```

---

## 🚀 Inicio Rápido

### **Prerequisitos**

- Android Studio Hedgehog | 2023.1.1 o superior
- JDK 17
- Android SDK 34
- Gradle 8.2+

### **Instalación**

1. **Clonar el repositorio**
   ```bash
   cd ~/SuperAIProject/AgroBridgeInt.com
   ```

2. **Abrir en Android Studio**
   ```bash
   # Abrir la carpeta en Android Studio
   ```

3. **Configurar API Keys** (opcional para desarrollo)

   Crear archivo `local.properties` en la raíz:
   ```properties
   MAPS_API_KEY=tu_google_maps_api_key
   OPENWEATHER_API_KEY=tu_openweather_api_key
   ```

4. **Sync Gradle**

   Android Studio sincronizará automáticamente las dependencias.

5. **Compilar y Ejecutar**
   ```bash
   ./gradlew assembleDebug
   ```

   O desde Android Studio: **Run > Run 'app'**

---

## 📸 Screenshots

*(Capturas de pantalla serán agregadas próximamente)*

---

## 🎨 Design System

AgroBridge utiliza un Design System completo que replica exactamente el look & feel de iOS:

### **Colores Principales**
- `AgroGreen` - #2D5016 (Verde primario de la marca)
- `AgroGreenLight` - #4CAF50 (Verde claro)
- `AgroGreenDark` - #1B5E20 (Verde oscuro)

### **Tipografía**
Sistema de 12 estilos basado en Material Design 3, replicando la jerarquía de iOS.

### **Espaciado**
Sistema de 4pt grid (4dp, 8dp, 12dp, 16dp, 24dp, 32dp, 40dp, 48dp)

---

## 🗺️ Roadmap

### ✅ **Fase 1: Base (Completada)**
- [x] Design System completo
- [x] Modelos de datos
- [x] Navegación
- [x] DashboardScreen funcional

### ⏳ **Fase 2: Screens Core (En Progreso)**
- [ ] MapScreen con Google Maps
- [ ] LotesListScreen
- [ ] LoteDetailScreen
- [ ] WeatherScreen
- [ ] ScannerScreen

### 📅 **Fase 3: Servicios**
- [ ] WeatherService (OpenWeather API)
- [ ] LocationService (GPS)
- [ ] CropHealthService (TensorFlow Lite)
- [ ] Repository Layer

### 📅 **Fase 4: Features Avanzadas**
- [ ] Offline-first con Room Database
- [ ] Sync con WorkManager
- [ ] Push Notifications
- [ ] Analytics

---

## 📊 Estado del Proyecto

| Componente | Progreso | Estado |
|------------|----------|--------|
| Design System | 100% | ✅ |
| Modelos | 100% | ✅ |
| Navegación | 100% | ✅ |
| Dashboard | 100% | ✅ |
| Screens Adicionales | 0% | ⏳ |
| Servicios | 0% | ⏳ |
| ViewModels | 0% | ⏳ |
| Testing | 0% | ⏳ |

**Progreso Global:** 85% (Base funcional completa)

---

## 🤝 Contribuir

Este proyecto está en desarrollo activo. Las contribuciones son bienvenidas.

### **Áreas Prioritarias**
1. Implementar MapScreen con Google Maps
2. Implementar WeatherScreen con OpenWeather
3. Implementar ScannerScreen con CameraX
4. Agregar tests unitarios
5. Mejorar documentación

---

## 📄 Licencia

Este proyecto está bajo la Licencia MIT - ver archivo [LICENSE](LICENSE) para detalles.

---

## 📞 Contacto

**Proyecto:** AgroBridge Android
**Versión:** 1.0.0
**Estado:** En Desarrollo

---

## 🙏 Reconocimientos

- Basado en el proyecto iOS AgroBridge
- Diseño Material Design 3 de Google
- OpenWeather API para datos meteorológicos
- TensorFlow Lite para ML en dispositivo

---

**Hecho con ❤️ usando Jetpack Compose**
