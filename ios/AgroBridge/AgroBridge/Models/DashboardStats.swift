import Foundation

// MARK: - DashboardStats Model
/// Modelo que representa las estadísticas del dashboard principal
struct DashboardStats: Codable {
    let totalProductores: Int
    let lotesActivos: Int
    let bloquesCertificados: Int
    let ultimaSincronizacion: Date?
    let estadoConexion: EstadoConexion
    let metricas: DashboardMetricas?

    enum CodingKeys: String, CodingKey {
        case totalProductores = "total_productores"
        case lotesActivos = "lotes_activos"
        case bloquesCertificados = "bloques_certificados"
        case ultimaSincronizacion = "ultima_sincronizacion"
        case estadoConexion = "estado_conexion"
        case metricas
    }
}

// MARK: - EstadoConexion
enum EstadoConexion: String, Codable {
    case online = "online"
    case offline = "offline"
    case sincronizando = "sincronizando"

    var displayName: String {
        switch self {
        case .online: return "Conectado"
        case .offline: return "Sin conexión"
        case .sincronizando: return "Sincronizando..."
        }
    }

    var icon: String {
        switch self {
        case .online: return "wifi"
        case .offline: return "wifi.slash"
        case .sincronizando: return "arrow.triangle.2.circlepath"
        }
    }

    var color: String {
        switch self {
        case .online: return "green"
        case .offline: return "red"
        case .sincronizando: return "orange"
        }
    }
}

// MARK: - DashboardMetricas
struct DashboardMetricas: Codable {
    let productosRegistrados: Int?
    let calidadPromedio: Double?
    let alertasActivas: Int?

    enum CodingKeys: String, CodingKey {
        case productosRegistrados = "productos_registrados"
        case calidadPromedio = "calidad_promedio"
        case alertasActivas = "alertas_activas"
    }
}

// MARK: - Productor Model (Básico)
/// Modelo básico de Productor (se expandirá en fases futuras)
struct Productor: Codable, Identifiable {
    let id: String
    let nombre: String
    let email: String?
    let telefono: String?
    let ubicacion: String?
    let totalLotes: Int?
    let estado: String?

    enum CodingKeys: String, CodingKey {
        case id
        case nombre
        case email
        case telefono
        case ubicacion
        case totalLotes = "total_lotes"
        case estado
    }
}
