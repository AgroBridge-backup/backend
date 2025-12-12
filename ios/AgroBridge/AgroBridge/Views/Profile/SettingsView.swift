import SwiftUI

// MARK: - SettingsView
/// Vista de configuración de la aplicación
struct SettingsView: View {
    // MARK: - Properties
    @Environment(\.dismiss) var dismiss
    @AppStorage("notificationsEnabled") private var notificationsEnabled = true
    @AppStorage("darkModeEnabled") private var darkModeEnabled = false

    var body: some View {
        NavigationView {
            Form {
                // Sección: Notificaciones
                Section(header: Text("Notificaciones")) {
                    Toggle(isOn: $notificationsEnabled) {
                        HStack {
                            Image(systemName: "bell.fill")
                                .foregroundColor(.agrobridgePrimary)
                                .frame(width: 24)

                            Text("Activar Notificaciones")
                                .foregroundColor(.primary)
                        }
                    }
                    .tint(.agrobridgePrimary)

                    if notificationsEnabled {
                        Text("Recibirás notificaciones sobre actualizaciones de lotes, productores y sistema")
                            .font(.system(size: 12))
                            .foregroundColor(.secondary)
                    }
                }

                // Sección: Apariencia
                Section(header: Text("Apariencia")) {
                    Toggle(isOn: $darkModeEnabled) {
                        HStack {
                            Image(systemName: "moon.fill")
                                .foregroundColor(.purple)
                                .frame(width: 24)

                            Text("Modo Oscuro")
                                .foregroundColor(.primary)
                        }
                    }
                    .tint(.agrobridgePrimary)

                    Text("El modo oscuro está en desarrollo y se habilitará en una futura versión")
                        .font(.system(size: 12))
                        .foregroundColor(.secondary)
                }

                // Sección: Acerca de
                Section(header: Text("Acerca de")) {
                    HStack {
                        Image(systemName: "info.circle.fill")
                            .foregroundColor(.blue)
                            .frame(width: 24)

                        Text("Versión")
                            .foregroundColor(.primary)

                        Spacer()

                        Text("1.0.0")
                            .foregroundColor(.secondary)
                    }

                    HStack {
                        Image(systemName: "building.2.fill")
                            .foregroundColor(.green)
                            .frame(width: 24)

                        Text("Desarrollado por")
                            .foregroundColor(.primary)

                        Spacer()

                        Text("AgroBridge Team")
                            .foregroundColor(.secondary)
                    }

                    HStack {
                        Image(systemName: "calendar")
                            .foregroundColor(.orange)
                            .frame(width: 24)

                        Text("Año")
                            .foregroundColor(.primary)

                        Spacer()

                        Text("2024")
                            .foregroundColor(.secondary)
                    }
                }

                // Sección: Avanzado
                Section(header: Text("Avanzado")) {
                    NavigationLink(destination: AdvancedSettingsView()) {
                        HStack {
                            Image(systemName: "gear.circle.fill")
                                .foregroundColor(.purple)
                                .frame(width: 24)

                            Text("Configuración Avanzada")
                                .foregroundColor(.primary)

                            Spacer()

                            Image(systemName: "chevron.right")
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundColor(.secondary)
                        }
                    }
                }

                // Sección: Soporte
                Section(header: Text("Soporte")) {
                    Button(action: {
                        // TODO: Abrir email de soporte
                    }) {
                        HStack {
                            Image(systemName: "envelope.fill")
                                .foregroundColor(.agrobridgePrimary)
                                .frame(width: 24)

                            Text("Contactar Soporte")
                                .foregroundColor(.primary)

                            Spacer()

                            Image(systemName: "chevron.right")
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundColor(.secondary)
                        }
                    }

                    Button(action: {
                        // TODO: Abrir términos y condiciones
                    }) {
                        HStack {
                            Image(systemName: "doc.text.fill")
                                .foregroundColor(.blue)
                                .frame(width: 24)

                            Text("Términos y Condiciones")
                                .foregroundColor(.primary)

                            Spacer()

                            Image(systemName: "chevron.right")
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundColor(.secondary)
                        }
                    }

                    Button(action: {
                        // TODO: Abrir política de privacidad
                    }) {
                        HStack {
                            Image(systemName: "hand.raised.fill")
                                .foregroundColor(.purple)
                                .frame(width: 24)

                            Text("Política de Privacidad")
                                .foregroundColor(.primary)

                            Spacer()

                            Image(systemName: "chevron.right")
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundColor(.secondary)
                        }
                    }
                }

                // Sección: Datos
                Section(header: Text("Datos de la Aplicación")) {
                    Button(action: {
                        // TODO: Limpiar caché
                    }) {
                        HStack {
                            Image(systemName: "trash.fill")
                                .foregroundColor(.red)
                                .frame(width: 24)

                            Text("Limpiar Caché")
                                .foregroundColor(.red)

                            Spacer()
                        }
                    }
                }
            }
            .navigationTitle("Configuración")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Listo") {
                        dismiss()
                    }
                }
            }
        }
    }
}

// MARK: - Preview
struct SettingsView_Previews: PreviewProvider {
    static var previews: some View {
        SettingsView()
    }
}
