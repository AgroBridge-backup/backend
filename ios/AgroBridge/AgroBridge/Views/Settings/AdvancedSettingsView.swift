import SwiftUI

// MARK: - AdvancedSettingsView
/// Vista de configuraciones avanzadas
struct AdvancedSettingsView: View {
    // MARK: - Properties
    @Environment(\.dismiss) var dismiss
    @AppStorage("syncInterval") private var syncInterval: Double = 15.0
    @AppStorage("enableAutoSync") private var enableAutoSync = true
    @AppStorage("cacheSize") private var cacheSize: Double = 100.0
    @AppStorage("enableDebugMode") private var enableDebugMode = false
    @AppStorage("enableAnalytics") private var enableAnalytics = true
    @AppStorage("enableCrashReporting") private var enableCrashReporting = true
    @AppStorage("dataQuality") private var dataQuality = "alta"

    @State private var showClearCacheAlert = false
    @State private var showResetAlert = false

    var body: some View {
        NavigationView {
            Form {
                // MARK: - Sincronización
                Section(header: Text("Sincronización"), footer: Text("Configura la frecuencia de sincronización automática con el servidor")) {
                    Toggle(isOn: $enableAutoSync) {
                        HStack {
                            Image(systemName: "arrow.triangle.2.circlepath")
                                .foregroundColor(.agrobridgePrimary)
                                .frame(width: 24)

                            Text("Sincronización Automática")
                                .foregroundColor(.primary)
                        }
                    }
                    .tint(.agrobridgePrimary)

                    if enableAutoSync {
                        VStack(alignment: .leading, spacing: 8) {
                            HStack {
                                Image(systemName: "clock")
                                    .foregroundColor(.blue)
                                    .frame(width: 24)

                                Text("Intervalo de Sincronización")
                                    .foregroundColor(.primary)

                                Spacer()

                                Text("\(Int(syncInterval)) min")
                                    .foregroundColor(.secondary)
                            }

                            Slider(value: $syncInterval, in: 5...60, step: 5)
                                .tint(.agrobridgePrimary)
                        }
                    }
                }

                // MARK: - Calidad de Datos
                Section(header: Text("Calidad de Datos"), footer: Text("Mayor calidad consume más datos y espacio de almacenamiento")) {
                    Picker(selection: $dataQuality, label:
                        HStack {
                            Image(systemName: "chart.bar.fill")
                                .foregroundColor(.green)
                                .frame(width: 24)

                            Text("Calidad de Imágenes")
                                .foregroundColor(.primary)
                        }
                    ) {
                        Text("Baja").tag("baja")
                        Text("Media").tag("media")
                        Text("Alta").tag("alta")
                    }

                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Image(systemName: "internaldrive")
                                .foregroundColor(.purple)
                                .frame(width: 24)

                            Text("Tamaño de Caché")
                                .foregroundColor(.primary)

                            Spacer()

                            Text("\(Int(cacheSize)) MB")
                                .foregroundColor(.secondary)
                        }

                        Slider(value: $cacheSize, in: 50...500, step: 50)
                            .tint(.agrobridgePrimary)
                    }

                    Button(action: {
                        showClearCacheAlert = true
                    }) {
                        HStack {
                            Image(systemName: "trash.circle")
                                .foregroundColor(.red)
                                .frame(width: 24)

                            Text("Limpiar Caché")
                                .foregroundColor(.red)

                            Spacer()
                        }
                    }
                }

                // MARK: - Privacidad y Seguridad
                Section(header: Text("Privacidad y Seguridad")) {
                    Toggle(isOn: $enableAnalytics) {
                        HStack {
                            Image(systemName: "chart.xyaxis.line")
                                .foregroundColor(.blue)
                                .frame(width: 24)

                            VStack(alignment: .leading, spacing: 2) {
                                Text("Analytics")
                                    .foregroundColor(.primary)

                                Text("Ayuda a mejorar la app")
                                    .font(.system(size: 12))
                                    .foregroundColor(.secondary)
                            }
                        }
                    }
                    .tint(.agrobridgePrimary)

                    Toggle(isOn: $enableCrashReporting) {
                        HStack {
                            Image(systemName: "exclamationmark.triangle")
                                .foregroundColor(.orange)
                                .frame(width: 24)

                            VStack(alignment: .leading, spacing: 2) {
                                Text("Reportes de Errores")
                                    .foregroundColor(.primary)

                                Text("Envía reportes automáticamente")
                                    .font(.system(size: 12))
                                    .foregroundColor(.secondary)
                            }
                        }
                    }
                    .tint(.agrobridgePrimary)
                }

                // MARK: - Desarrollo
                Section(header: Text("Desarrollo y Debug")) {
                    Toggle(isOn: $enableDebugMode) {
                        HStack {
                            Image(systemName: "ladybug")
                                .foregroundColor(.red)
                                .frame(width: 24)

                            VStack(alignment: .leading, spacing: 2) {
                                Text("Modo Debug")
                                    .foregroundColor(.primary)

                                Text("Muestra logs detallados")
                                    .font(.system(size: 12))
                                    .foregroundColor(.secondary)
                            }
                        }
                    }
                    .tint(.agrobridgePrimary)

                    if enableDebugMode {
                        NavigationLink(destination: DebugLogsView()) {
                            HStack {
                                Image(systemName: "doc.text")
                                    .foregroundColor(.agrobridgePrimary)
                                    .frame(width: 24)

                                Text("Ver Logs del Sistema")
                                    .foregroundColor(.primary)
                            }
                        }
                    }
                }

                // MARK: - Información del Sistema
                Section(header: Text("Información del Sistema")) {
                    InfoRow(icon: "iphone", label: "Versión de iOS", value: UIDevice.current.systemVersion, color: .blue)
                    InfoRow(icon: "app.badge", label: "Versión de App", value: "1.0.0", color: .green)
                    InfoRow(icon: "server.rack", label: "Entorno", value: AppConfiguration.environment.rawValue.capitalized, color: .purple)
                    InfoRow(icon: "network", label: "API URL", value: getShortAPIURL(), color: .orange)
                }

                // MARK: - Zona de Peligro
                Section(header: Text("Zona de Peligro"), footer: Text("Estas acciones no se pueden deshacer")) {
                    Button(action: {
                        showResetAlert = true
                    }) {
                        HStack {
                            Image(systemName: "arrow.counterclockwise.circle")
                                .foregroundColor(.red)
                                .frame(width: 24)

                            Text("Restablecer Configuración")
                                .foregroundColor(.red)

                            Spacer()
                        }
                    }

                    Button(action: {
                        // TODO: Implementar eliminación de datos
                    }) {
                        HStack {
                            Image(systemName: "trash.circle.fill")
                                .foregroundColor(.red)
                                .frame(width: 24)

                            Text("Eliminar Todos los Datos")
                                .foregroundColor(.red)

                            Spacer()
                        }
                    }
                }
            }
            .navigationTitle("Configuración Avanzada")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Listo") {
                        dismiss()
                    }
                }
            }
        }
        .alert("Limpiar Caché", isPresented: $showClearCacheAlert) {
            Button("Cancelar", role: .cancel) {}
            Button("Limpiar", role: .destructive) {
                // TODO: Implementar limpieza de caché
            }
        } message: {
            Text("Se eliminarán todos los datos en caché. La app descargará los datos nuevamente cuando sea necesario.")
        }
        .alert("Restablecer Configuración", isPresented: $showResetAlert) {
            Button("Cancelar", role: .cancel) {}
            Button("Restablecer", role: .destructive) {
                resetToDefaults()
            }
        } message: {
            Text("Se restablecerán todas las configuraciones a sus valores predeterminados.")
        }
    }

    // MARK: - Helper Methods
    private func resetToDefaults() {
        syncInterval = 15.0
        enableAutoSync = true
        cacheSize = 100.0
        enableDebugMode = false
        enableAnalytics = true
        enableCrashReporting = true
        dataQuality = "alta"
    }

    private func getShortAPIURL() -> String {
        let url = AppConfiguration.baseURL
        if let host = URL(string: url)?.host {
            return host
        }
        return url
    }
}

// MARK: - InfoRow
struct InfoRow: View {
    let icon: String
    let label: String
    let value: String
    let color: Color

    var body: some View {
        HStack {
            Image(systemName: icon)
                .foregroundColor(color)
                .frame(width: 24)

            Text(label)
                .foregroundColor(.primary)

            Spacer()

            Text(value)
                .foregroundColor(.secondary)
                .font(.system(size: 14))
        }
    }
}

// MARK: - DebugLogsView
struct DebugLogsView: View {
    @State private var logs: [String] = [
        "2024-11-28 10:23:45 [INFO] App iniciada",
        "2024-11-28 10:23:46 [INFO] Autenticación exitosa",
        "2024-11-28 10:23:50 [INFO] Dashboard cargado",
        "2024-11-28 10:24:12 [INFO] Lotes sincronizados (15 items)",
        "2024-11-28 10:24:30 [WARNING] Conexión lenta detectada",
        "2024-11-28 10:25:00 [INFO] Productores cargados (8 items)",
    ]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                ForEach(logs, id: \.self) { log in
                    Text(log)
                        .font(.system(size: 12, design: .monospaced))
                        .foregroundColor(colorForLog(log))
                        .padding(.horizontal)
                }
            }
            .padding(.vertical)
        }
        .background(Color(.systemGray6))
        .navigationTitle("Debug Logs")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func colorForLog(_ log: String) -> Color {
        if log.contains("[ERROR]") { return .red }
        if log.contains("[WARNING]") { return .orange }
        if log.contains("[INFO]") { return .primary }
        return .secondary
    }
}

// MARK: - Preview
struct AdvancedSettingsView_Previews: PreviewProvider {
    static var previews: some View {
        AdvancedSettingsView()
    }
}
